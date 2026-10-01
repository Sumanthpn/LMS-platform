"""End-to-end check of the full user flow against a running API.

Usage:
    python -m scripts.smoke_test            against a local server on :8000

    $env:SMOKE_BASE = "https://your-api.onrender.com"
    $env:MONGODB_URI = "mongodb+srv://..."
    python -m scripts.smoke_test            against a deployment

Both variables are needed for a deployment: SMOKE_BASE picks the API, and
MONGODB_URI must point at the same database that API uses, because the score
check is computed from the database rather than trusted from the response.

Beyond exercising the happy path, this asserts the two rules the brief calls
out: the answer key never reaches the client, and the backend owns scoring.
It talks to Mongo directly only to work out what the score *should* be.
"""

import asyncio
import json
import os
import urllib.error
import urllib.request
import uuid

from bson import ObjectId

from app.db import connect, disconnect, get_db

# Defaults to a local server; set SMOKE_BASE to point at a deployment.
BASE = os.environ.get("SMOKE_BASE", "http://127.0.0.1:8000").rstrip("/")


def call(method: str, path: str, body: dict | None = None, token: str | None = None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE + path, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.loads(response.read() or "null")
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read() or "null")


def check(label: str, condition: bool) -> None:
    print(f"  {'PASS' if condition else 'FAIL'}  {label}")
    if not condition:
        raise SystemExit(1)


async def main() -> None:
    await connect()
    db = get_db()
    email = f"smoke-{uuid.uuid4().hex[:8]}@example.com"

    print("\n1. Signup")
    status, signup = call("POST", "/api/auth/signup", {"name": "Smoke Test", "email": email, "password": "password123"})
    check("returns 201", status == 201)
    check("returns a token", bool(signup.get("access_token")))
    check("never returns password_hash", "password_hash" not in json.dumps(signup))
    check("starts un-onboarded", signup["user"]["onboarding"] is None)
    token = signup["access_token"]

    print("\n2. Duplicate signup and bad login are rejected")
    status, _ = call("POST", "/api/auth/signup", {"name": "Dupe", "email": email, "password": "password123"})
    check("duplicate email returns 409", status == 409)
    status, _ = call("POST", "/api/auth/login", {"email": email, "password": "wrong-password"})
    check("wrong password returns 401", status == 401)
    status, _ = call("GET", "/api/auth/me")
    check("no token returns 401", status == 401)

    print("\n3. Login")
    status, login = call("POST", "/api/auth/login", {"email": email, "password": "password123"})
    check("returns 200", status == 200)
    token = login["access_token"]

    print("\n4. Catalog")
    status, domains = call("GET", "/api/domains", token=token)
    check("returns 200", status == 200)
    check("has 3 domains", len(domains) == 3)
    check("domains carry topics", all(d["topics"] for d in domains))
    check("topics carry question counts", all(t["question_count"] >= 12 for d in domains for t in d["topics"]))
    domain = domains[0]
    topic = domain["topics"][0]

    print("\n5. Onboarding")
    status, user = call("POST", "/api/onboarding", {"domain_id": domain["id"], "topic_id": topic["id"]}, token)
    check("returns 200", status == 200)
    check("onboarding is persisted", user["onboarding"]["topic_name"] == topic["name"])
    status, _ = call("POST", "/api/onboarding", {"domain_id": domain["id"], "topic_id": domains[1]["topics"][0]["id"]}, token)
    check("mismatched domain/topic returns 404", status == 404)

    print("\n6. Start exam")
    status, exam = call("POST", "/api/exams/start", {"domain_id": domain["id"], "topic_id": topic["id"]}, token)
    check("returns 201", status == 201)
    check("draws 5-10 questions", 5 <= len(exam["questions"]) <= 10)
    check("NO correct_option in payload", "correct_option" not in json.dumps(exam))
    check("every question has options", all(len(q["options"]) == 4 for q in exam["questions"]))
    session_id = exam["id"]

    print("\n7. Answer every question with option 0, then submit")
    answers = [{"question_id": q["id"], "selected_option": 0} for q in exam["questions"]]
    # Work out the true score independently, straight from the database.
    docs = await db.questions.find({"_id": {"$in": [ObjectId(q["id"]) for q in exam["questions"]]}}).to_list(None)
    expected = sum(1 for d in docs if d["correct_option"] == 0)

    status, result = call("POST", f"/api/exams/{session_id}/submit", {"answers": answers}, token)
    check("returns 200", status == 200)
    check(f"backend score matches database ({result['score']} == {expected})", result["score"] == expected)
    check("total matches question count", result["total"] == len(exam["questions"]))
    check("breakdown reveals answers only after submit", all("correct_option" in b for b in result["breakdown"]))

    print("\n8. Submission rules")
    status, _ = call("POST", f"/api/exams/{session_id}/submit", {"answers": answers}, token)
    check("double submit returns 409", status == 409)
    status, fetched = call("GET", f"/api/exams/{session_id}/result", token=token)
    check("result is retrievable", status == 200 and fetched["score"] == expected)

    print("\n9. Another user cannot read this session")
    _, other = call("POST", "/api/auth/signup", {"name": "Other", "email": f"other-{uuid.uuid4().hex[:8]}@example.com", "password": "password123"})
    status, _ = call("GET", f"/api/exams/{session_id}/result", token=other["access_token"])
    check("returns 404 for a different user", status == 404)

    print("\n10. Blank answers are allowed and score zero")
    _, exam2 = call("POST", "/api/exams/start", {"domain_id": domain["id"], "topic_id": topic["id"]}, token)
    status, result2 = call("POST", f"/api/exams/{exam2['id']}/submit", {"answers": []}, token)
    check("empty submission returns 200", status == 200)
    check("scores zero", result2["score"] == 0)
    check("still counts all questions", result2["total"] == len(exam2["questions"]))

    print("\n11. In-progress answers survive a reload")
    _, exam3 = call("POST", "/api/exams/start", {"domain_id": domain["id"], "topic_id": topic["id"]}, token)
    check("new exam starts with no saved answers", exam3["answers"] == [])

    picked = [
        {"question_id": q["id"], "selected_option": index % 4}
        for index, q in enumerate(exam3["questions"][:3])
    ]
    status, _ = call("PUT", f"/api/exams/{exam3['id']}/answers", {"answers": picked}, token)
    check("saving progress returns 204", status == 204)

    status, reloaded = call("GET", f"/api/exams/{exam3['id']}", token=token)
    saved = {a["question_id"]: a["selected_option"] for a in reloaded["answers"]}
    check("returns 200", status == 200)
    check("reload returns the saved answers", saved == {p["question_id"]: p["selected_option"] for p in picked})
    check("reload still hides the answer key", "correct_option" not in json.dumps(reloaded))
    check(
        "question set is unchanged on reload",
        [q["id"] for q in reloaded["questions"]] == [q["id"] for q in exam3["questions"]],
    )

    print("\n12. Saved progress cannot smuggle in a foreign question")
    served = [ObjectId(q["id"]) for q in exam3["questions"]]
    foreign = await db.questions.find_one({"_id": {"$nin": served}})
    status, _ = call(
        "PUT",
        f"/api/exams/{exam3['id']}/answers",
        {"answers": picked + [{"question_id": str(foreign["_id"]), "selected_option": 0}]},
        token,
    )
    check("foreign question id is accepted but ignored", status == 204)
    _, reloaded = call("GET", f"/api/exams/{exam3['id']}", token=token)
    check("foreign answer was not stored", len(reloaded["answers"]) == len(picked))

    print("\n13. Submitting scores the saved answers")
    docs3 = await db.questions.find({"_id": {"$in": served}}).to_list(None)
    correct_by_id = {str(d["_id"]): d["correct_option"] for d in docs3}
    expected3 = sum(1 for p in picked if correct_by_id[p["question_id"]] == p["selected_option"])

    status, result3 = call("POST", f"/api/exams/{exam3['id']}/submit", {"answers": picked}, token)
    check("returns 200", status == 200)
    check(f"score matches the saved answers ({result3['score']} == {expected3})", result3["score"] == expected3)

    status, _ = call("PUT", f"/api/exams/{exam3['id']}/answers", {"answers": picked}, token)
    check("saving after submit returns 409", status == 409)

    print("\n14. Attempt history")
    status, history = call("GET", "/api/exams", token=token)
    check("lists all three attempts", status == 200 and len(history) == 3)

    # Clean up everything this run created, sessions first so none are left
    # orphaned. Matching on the ids we were handed rather than on an email
    # pattern keeps the delete scoped to this run, which matters when the
    # target is a deployment rather than a throwaway local database.
    created_users = [ObjectId(signup["user"]["id"]), ObjectId(other["user"]["id"])]
    removed_sessions = await db.exam_sessions.delete_many({"user_id": {"$in": created_users}})
    removed_users = await db.users.delete_many({"_id": {"$in": created_users}})
    print(
        f"Cleaned up {removed_users.deleted_count} test user(s) "
        f"and {removed_sessions.deleted_count} exam session(s)."
    )

    await disconnect()
    print("\nAll checks passed.\n")


if __name__ == "__main__":
    asyncio.run(main())
