# LMS Platform

A minimal learning-management platform: sign up, choose a domain and topic, take a randomised
multiple-choice exam, and get a score calculated on the server.

**Stack** — Next.js 16 · React 19 · TypeScript · Redux Toolkit · FastAPI · MongoDB · REST

---

## User flow

```
Signup → Login → Onboarding → Dashboard → Select domain + topic
                                              ↓
                                         Start exam
                                              ↓
                                   Exam session (one question at a time)
                                              ↓
                                           Submit
                                              ↓
                                           Result
```

---

## Two rules the design is built around

**The answer key never leaves the backend.** Questions are served through a Pydantic model
(`ExamQuestion`) that has no `correct_option` field at all, so the key cannot leak even if a raw
Mongo document is passed into a response. Correct answers appear in exactly one place — the result
payload, after submission.

**The backend owns scoring.** When an exam starts, the chosen question IDs are frozen onto the
`exam_sessions` document. On submit, the server re-reads those questions from the database, ignores
any answer whose `question_id` is not in the session, and computes the score itself. A client cannot
answer a question it was never served, submit twice, or influence its own score.

`backend/scripts/smoke_test.py` asserts both of these against a running server.

---

## Prerequisites

| Requirement | Version used | Notes |
|---|---|---|
| Python | 3.13 | 3.11+ should work |
| Node.js | 22 | 20+ should work |
| MongoDB | 8.x Community | or a MongoDB Atlas cluster |

MongoDB must be running before you start the backend. On Windows the installer registers it as a
service that starts automatically; verify with:

```bash
mongosh --eval "db.runCommand({ ping: 1 })"   # expect { ok: 1 }
```

---

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env          # Windows: copy .env.example .env
```

Open `backend/.env` and set a real `JWT_SECRET`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Seed the catalog, then start the API:

```bash
python -m app.seed            # 3 domains, 6 topics, 72 questions
uvicorn app.main:app --reload
```

The API is now on **http://localhost:8000**, with interactive docs at
**http://localhost:8000/docs**.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env.local    # Windows: copy .env.example .env.local
npm run dev
```

The app is now on **http://localhost:3000**.

### 3. Verify (optional)

With both servers running:

```bash
cd backend
python -m scripts.smoke_test
```

This walks the entire flow — signup, duplicate rejection, login, catalog, onboarding, exam start,
submission, scoring, and cross-user access — and checks the result against the database directly.
It cleans up the accounts it creates.

---

## Environment variables

### `backend/.env`

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017` | Connection string |
| `MONGODB_DB_NAME` | `lms_platform` | Database name |
| `JWT_SECRET` | — | **Change this.** Signs access tokens |
| `JWT_ALGORITHM` | `HS256` | |
| `JWT_EXPIRE_MINUTES` | `10080` | Token lifetime (7 days) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `EXAM_MIN_QUESTIONS` | `5` | Lower bound of the random draw |
| `EXAM_MAX_QUESTIONS` | `10` | Upper bound of the random draw |

### `frontend/.env.local`

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL, no trailing slash |

---

## API

All routes are prefixed `/api`. Authenticated routes take `Authorization: Bearer <token>`.

| Method | Path | Auth | Purpose |
|---|---|:--:|---|
| `POST` | `/auth/signup` | — | Create an account, return a token |
| `POST` | `/auth/login` | — | Exchange credentials for a token |
| `GET` | `/auth/me` | ✓ | Current user |
| `POST` | `/onboarding` | ✓ | Save the chosen domain + topic |
| `GET` | `/domains` | ✓ | Domains, each with its topics and question counts |
| `GET` | `/domains/{id}` | ✓ | One domain |
| `GET` | `/topics?domain_id=` | ✓ | Topics in a domain |
| `POST` | `/exams/start` | ✓ | Draw 5–10 random questions, open a session |
| `GET` | `/exams` | ✓ | Recent attempts |
| `GET` | `/exams/{id}` | ✓ | Re-serve an in-progress session |
| `POST` | `/exams/{id}/submit` | ✓ | Score the attempt |
| `GET` | `/exams/{id}/result` | ✓ | Fetch a completed result |
| `GET` | `/health` | — | Liveness, including a database ping |

---

## MongoDB collections

```
users          _id, name, email (unique index), password_hash,
               onboarding: { domain_id, topic_id, domain_name, topic_name } | null

domains        _id, name, slug (unique index), description

topics         _id, domain_id → domains, name, slug, description
               compound unique index on (domain_id, slug)

questions      _id, topic_id → topics (indexed), text,
               options: string[], correct_option: int

exam_sessions  _id, user_id → users, domain_id, topic_id,
               domain_name, topic_name,          # denormalised for cheap listing
               question_ids: ObjectId[],         # frozen at start
               answers: [{ question_id, selected_option }],
               score, total, status: in_progress | submitted,
               started_at, submitted_at
               index on (user_id, started_at desc)
```

`domain_name` and `topic_name` are duplicated onto the session on purpose: the dashboard history
then renders without a join, and a past result keeps the name it was taken under even if the topic
is later renamed.

---

## Architecture notes

### Backend

```
backend/app/
├── main.py          FastAPI app, CORS, lifespan, health
├── config.py        pydantic-settings, reads .env
├── db.py            Motor client, index creation on startup
├── core/security.py bcrypt hashing, JWT, the get_current_user dependency
├── models/          Pydantic request/response schemas
├── routers/         auth · onboarding · catalog · exams
└── seed.py          Catalog seed data
```

Indexes are created at startup, so correctness does not depend on remembering to run a migration.
The unique index on `users.email` is what makes duplicate signup safe under concurrency — the
route catches `DuplicateKeyError` rather than doing a check-then-insert, which would race.

### Frontend

```
frontend/src/
├── proxy.ts              Server-side route protection (Next 16's middleware convention)
├── app/
│   ├── (auth)/           login · signup
│   ├── onboarding/       domain + topic selection
│   ├── dashboard/        catalog, exam launcher, attempt history
│   ├── exam/[sessionId]/ one question at a time, Previous / Next
│   └── result/[sessionId]/ score and answer review
├── store/
│   ├── index.ts          configureStore
│   ├── hooks.ts          pre-typed useAppDispatch / useAppSelector
│   ├── Providers.tsx     client-side store provider
│   └── slices/           authSlice · catalogSlice · examSlice
├── components/           AppShell, DomainTopicPicker, ui primitives
├── lib/                  api.ts (typed fetch + ApiError) · token.ts
└── types/                TypeScript mirrors of the Pydantic models
```

**Redux Toolkit** holds exam state in `examSlice`: the question list, `currentIndex`, and an
`answers` map of question ID to selected option index. Previous/Next are plain reducers;
`startExam`, `loadExam`, `submitExam`, `fetchResult` and `fetchHistory` are `createAsyncThunk`s
whose pending/fulfilled/rejected cases drive every loading and error state in the UI. A failed
submission deliberately returns status to `active` rather than `failed`, so a network blip does not
cost the user their answers.

**Route protection runs in two layers.** `proxy.ts` checks for the token cookie on the server and
redirects before any HTML is sent, so a protected page never flashes on screen. `AppShell` then
restores the user into Redux and enforces the rule the server cannot see from the token alone —
that an authenticated but un-onboarded user belongs on `/onboarding`.

**Error handling** is centralised in `lib/api.ts`. It normalises both FastAPI error shapes (a
string `detail` for raised `HTTPException`s, an array for Pydantic validation failures) into one
message, and turns a network failure into an `ApiError` with status `0` so the UI can say something
more useful than "failed to fetch".

---

## Security notes

- Passwords are hashed with **bcrypt** and never returned by any endpoint. `UserPublic` has no
  `password_hash` field, so it cannot be serialised by accident.
- Login returns the same message for an unknown email and a wrong password, so the endpoint cannot
  be used to enumerate registered addresses.
- Exam sessions are always queried scoped by `user_id`, so one user reading another's result gets a
  404 rather than a 403 — no confirmation that the session exists.
- **Known trade-off:** the JWT is stored in a cookie that is *not* `httpOnly`. The token is issued
  by FastAPI rather than a Next.js route handler, and the browser must attach it to cross-origin API
  calls, so JavaScript on the page has to be able to read it — the same exposure `localStorage`
  carries. Using a cookie rather than `localStorage` at least lets `proxy.ts` gate routes on the
  server. Hardening this properly means proxying auth through a Next route handler that sets an
  `httpOnly` cookie, which is beyond the scope of this assignment.

---

## Deployment

The two services deploy independently.

**Database** — create a free MongoDB Atlas M0 cluster, allow access from anywhere (`0.0.0.0/0`) or
from your backend host's IPs, and copy the `mongodb+srv://` connection string.

**Backend** (Render, Railway, or Fly.io):

- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment: `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET`, and `CORS_ORIGINS` set to the
  deployed frontend origin
- After the first deploy, run `python -m app.seed` once against the production database

**Frontend** (Vercel):

- Root directory: `frontend`
- Environment: `NEXT_PUBLIC_API_URL` set to the deployed backend URL

Two things that commonly bite on first deploy: `CORS_ORIGINS` must list the exact frontend origin
with no trailing slash, and Render's free tier sleeps after 15 minutes idle, so the first request
after a pause can take ~50 seconds to wake.

---

## Seed data

Three domains, two topics each, twelve questions per topic:

| Domain | Topics |
|---|---|
| Cloud Computing | AWS Fundamentals · Kubernetes |
| Web Development | JavaScript Fundamentals · React & Next.js |
| Data & AI | SQL & Databases · Machine Learning Basics |

Twelve questions per topic is deliberate — more than the maximum draw of ten, so consecutive
attempts on the same topic visibly differ.

Re-running `python -m app.seed` replaces the catalog collections only; `users` and `exam_sessions`
are left untouched, so re-seeding during development never destroys the account you are testing
with.
