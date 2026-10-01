import random
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.core.security import CurrentUser
from app.db import get_db
from app.models.exam import (
    AnswerSubmission,
    ExamResult,
    ExamSession,
    ExamSummary,
    QuestionResult,
    StartExamRequest,
    SubmitExamRequest,
)
from app.routers.catalog import parse_object_id

router = APIRouter(prefix="/api/exams", tags=["exams"])

PASS_PERCENTAGE = 60.0


async def _load_owned_session(session_id: str, user_id: ObjectId) -> dict:
    """Fetch a session, 404ing unless it belongs to the caller.

    Scoping the query by user_id means one user cannot read or submit
    someone else's exam, and gets the same 404 either way.
    """
    session = await get_db().exam_sessions.find_one(
        {"_id": parse_object_id(session_id, "session_id"), "user_id": user_id}
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam session not found")
    return session


def _ordered_questions(question_ids: list[ObjectId], questions: list[dict]) -> list[dict]:
    """Restore the order questions were drawn in; a $in query does not preserve it."""
    by_id = {q["_id"]: q for q in questions}
    return [by_id[qid] for qid in question_ids if qid in by_id]


def _accepted_answers(
    submitted: list[AnswerSubmission], allowed: set[ObjectId]
) -> dict[ObjectId, int | None]:
    """Keep only answers belonging to this session; last value wins on duplicates.

    Discarding unknown question ids here is what stops a client scoring itself
    on questions it was never served.
    """
    accepted: dict[ObjectId, int | None] = {}
    for answer in submitted:
        try:
            question_id = ObjectId(answer.question_id)
        except (InvalidId, TypeError):
            continue
        if question_id in allowed:
            accepted[question_id] = answer.selected_option
    return accepted


@router.post("/start", response_model=ExamSession, status_code=status.HTTP_201_CREATED)
async def start_exam(payload: StartExamRequest, user: CurrentUser) -> ExamSession:
    db = get_db()
    domain_id = parse_object_id(payload.domain_id, "domain_id")
    topic_id = parse_object_id(payload.topic_id, "topic_id")

    domain = await db.domains.find_one({"_id": domain_id})
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")

    topic = await db.topics.find_one({"_id": topic_id, "domain_id": domain_id})
    if topic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found in that domain",
        )

    available = await db.questions.count_documents({"topic_id": topic_id})
    if available < settings.exam_min_questions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"This topic needs at least {settings.exam_min_questions} "
                "questions before an exam can start"
            ),
        )

    # Random size in the configured range, capped by what the topic actually has.
    size = min(random.randint(settings.exam_min_questions, settings.exam_max_questions), available)
    questions = await db.questions.aggregate(
        [{"$match": {"topic_id": topic_id}}, {"$sample": {"size": size}}]
    ).to_list(None)

    started_at = datetime.now(timezone.utc)
    session = {
        "user_id": user["_id"],
        "domain_id": domain_id,
        "topic_id": topic_id,
        "domain_name": domain["name"],
        "topic_name": topic["name"],
        # The question set is frozen here. Submissions are scored against this
        # list, so a client cannot answer questions it was never served.
        "question_ids": [q["_id"] for q in questions],
        "answers": [],
        "score": None,
        "total": len(questions),
        "status": "in_progress",
        "started_at": started_at,
        "submitted_at": None,
    }
    result = await db.exam_sessions.insert_one(session)

    # ExamQuestion has no correct_option field, so validation drops the answer key.
    return ExamSession.model_validate(
        {
            "_id": result.inserted_id,
            "domain_id": domain_id,
            "topic_id": topic_id,
            "domain_name": domain["name"],
            "topic_name": topic["name"],
            "status": "in_progress",
            "started_at": started_at,
            "questions": questions,
            "answers": [],
        }
    )


@router.get("", response_model=list[ExamSummary])
async def list_exams(user: CurrentUser) -> list[ExamSummary]:
    """Recent attempts, newest first, for the dashboard history panel."""
    sessions = (
        await get_db()
        .exam_sessions.find({"user_id": user["_id"]})
        .sort("started_at", -1)
        .limit(20)
        .to_list(None)
    )
    return [ExamSummary.model_validate(s) for s in sessions]


@router.get("/{session_id}", response_model=ExamSession)
async def get_exam(session_id: str, user: CurrentUser) -> ExamSession:
    """Re-serve an in-progress exam so a page refresh does not lose the question set."""
    session = await _load_owned_session(session_id, user["_id"])
    if session["status"] != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This exam has already been submitted",
        )

    questions = await get_db().questions.find({"_id": {"$in": session["question_ids"]}}).to_list(None)
    ordered = _ordered_questions(session["question_ids"], questions)
    return ExamSession.model_validate({**session, "questions": ordered})


@router.put("/{session_id}/answers", status_code=status.HTTP_204_NO_CONTENT)
async def save_answers(session_id: str, payload: SubmitExamRequest, user: CurrentUser) -> None:
    """Persist in-progress answers so a refresh or a resume does not lose them.

    This only records what the user has picked. It never scores, and the saved
    values are re-validated at submit time, so storing them early gives a
    client no influence over its own result.
    """
    session = await _load_owned_session(session_id, user["_id"])

    if session["status"] != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This exam has already been submitted",
        )

    accepted = _accepted_answers(payload.answers, set(session["question_ids"]))

    # Preserve the order questions were drawn in rather than dict insertion order.
    stored = [
        {"question_id": question_id, "selected_option": accepted[question_id]}
        for question_id in session["question_ids"]
        if question_id in accepted and accepted[question_id] is not None
    ]

    await get_db().exam_sessions.update_one(
        {"_id": session["_id"], "status": "in_progress"},
        {"$set": {"answers": stored}},
    )


@router.post("/{session_id}/submit", response_model=ExamResult)
async def submit_exam(session_id: str, payload: SubmitExamRequest, user: CurrentUser) -> ExamResult:
    db = get_db()
    session = await _load_owned_session(session_id, user["_id"])

    if session["status"] == "submitted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This exam has already been submitted",
        )

    question_ids = session["question_ids"]
    submitted = _accepted_answers(payload.answers, set(question_ids))

    questions = await db.questions.find({"_id": {"$in": question_ids}}).to_list(None)
    by_id = {q["_id"]: q for q in questions}

    breakdown: list[QuestionResult] = []
    stored_answers: list[dict] = []
    score = 0

    for qid in question_ids:
        question = by_id.get(qid)
        if question is None:
            continue

        selected = submitted.get(qid)
        # Drop an index that is out of range for this particular question.
        if selected is not None and not 0 <= selected < len(question["options"]):
            selected = None

        is_correct = selected is not None and selected == question["correct_option"]
        if is_correct:
            score += 1

        stored_answers.append({"question_id": qid, "selected_option": selected})
        breakdown.append(
            QuestionResult(
                question_id=str(qid),
                text=question["text"],
                options=question["options"],
                selected_option=selected,
                correct_option=question["correct_option"],
                is_correct=is_correct,
            )
        )

    total = len(breakdown)
    percentage = round(score / total * 100, 1) if total else 0.0
    submitted_at = datetime.now(timezone.utc)

    # The status filter makes this idempotent: a double submit updates nothing.
    await db.exam_sessions.update_one(
        {"_id": session["_id"], "status": "in_progress"},
        {
            "$set": {
                "answers": stored_answers,
                "score": score,
                "total": total,
                "status": "submitted",
                "submitted_at": submitted_at,
            }
        },
    )

    return ExamResult.model_validate(
        {
            "_id": session["_id"],
            "domain_name": session["domain_name"],
            "topic_name": session["topic_name"],
            "score": score,
            "total": total,
            "percentage": percentage,
            "passed": percentage >= PASS_PERCENTAGE,
            "submitted_at": submitted_at,
            "breakdown": breakdown,
        }
    )


@router.get("/{session_id}/result", response_model=ExamResult)
async def get_result(session_id: str, user: CurrentUser) -> ExamResult:
    db = get_db()
    session = await _load_owned_session(session_id, user["_id"])

    if session["status"] != "submitted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This exam has not been submitted yet",
        )

    questions = await db.questions.find({"_id": {"$in": session["question_ids"]}}).to_list(None)
    by_id = {q["_id"]: q for q in questions}
    selected_by_id = {a["question_id"]: a["selected_option"] for a in session["answers"]}

    breakdown = [
        QuestionResult(
            question_id=str(qid),
            text=by_id[qid]["text"],
            options=by_id[qid]["options"],
            selected_option=selected_by_id.get(qid),
            correct_option=by_id[qid]["correct_option"],
            is_correct=selected_by_id.get(qid) == by_id[qid]["correct_option"],
        )
        for qid in session["question_ids"]
        if qid in by_id
    ]

    total = session["total"]
    percentage = round(session["score"] / total * 100, 1) if total else 0.0

    return ExamResult.model_validate(
        {
            **session,
            "percentage": percentage,
            "passed": percentage >= PASS_PERCENTAGE,
            "breakdown": breakdown,
        }
    )
