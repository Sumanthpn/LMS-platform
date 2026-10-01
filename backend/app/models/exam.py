from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import MongoModel, PyObjectId


class ExamQuestion(MongoModel):
    """A question as the client sees it.

    Deliberately has no `correct_option` field, so the answer key cannot leak
    into an API response even if a raw question document is passed in.
    """

    text: str
    options: list[str]


class StartExamRequest(BaseModel):
    domain_id: str
    topic_id: str


class SavedAnswer(BaseModel):
    """An answer already recorded against an in-progress session."""

    question_id: PyObjectId
    selected_option: int | None = None


class ExamSession(MongoModel):
    domain_id: PyObjectId
    topic_id: PyObjectId
    domain_name: str
    topic_name: str
    status: str
    started_at: datetime
    questions: list[ExamQuestion]
    # Answers saved so far, so a refresh or a resume restores the attempt.
    answers: list[SavedAnswer] = []


class AnswerSubmission(BaseModel):
    question_id: str
    # None means "left blank"; otherwise an index into the question's options.
    selected_option: int | None = Field(default=None, ge=0)


class SubmitExamRequest(BaseModel):
    answers: list[AnswerSubmission] = []


class QuestionResult(BaseModel):
    """Per-question breakdown, returned only after submission."""

    question_id: PyObjectId
    text: str
    options: list[str]
    selected_option: int | None
    correct_option: int
    is_correct: bool


class ExamResult(MongoModel):
    domain_name: str
    topic_name: str
    score: int
    total: int
    percentage: float
    passed: bool
    submitted_at: datetime
    breakdown: list[QuestionResult]


class ExamSummary(MongoModel):
    """Compact row for the dashboard's attempt history."""

    domain_name: str
    topic_name: str
    status: str
    score: int | None = None
    total: int
    started_at: datetime
    submitted_at: datetime | None = None
