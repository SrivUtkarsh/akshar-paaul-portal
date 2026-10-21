# Akshar Paaul Portal

A simple web portal for the Akshar Paaul NGO with two connected workflows:

1. **Faculty daily work** — faculty submit activities; administrators approve them or request changes with comments. Resubmissions keep the previous version and review history.
2. **Handwritten student book summaries** — educators create books and reusable grading rubrics, upload student handwriting, ask Groq to extract text and suggest marks, then edit and save the final teacher assessment.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Vite |
| Styling | Tailwind CSS |
| Backend | Node.js + Express.js |
| API | REST (`/api/...`) |
| Authentication | JWT + role-based access control (admin / faculty) |
| Database | PostgreSQL |
| AI / OCR | Groq vision API (`groq-sdk`) |
| Deployment target | Vercel for frontend and Express API; managed PostgreSQL for the database |

The local AI runtime is intentionally not included in this version. Handwriting images are processed by the configured Groq model, so the application does not need a high-memory local computer or Ollama installation. This is a cloud-processing choice made for the project's resource constraints; see the privacy note below.

## Features

- Sign-in with secure password hashes and expiring JWT sessions.
- Admin-only faculty account creation/deactivation.
- Faculty daily-work submissions, admin approval/change requests, comments, revision history, and review history.
- Book library with custom rubric criteria and mark allocations.
- Rubric versioning: a submission stores the rubric version used at the time it was uploaded.
- JPG, PNG, and WEBP uploads (up to 4 MB to stay within typical Vercel request-body limits). Student page images are stored in PostgreSQL rather than a public upload folder.
- Groq vision prompt requests a handwritten transcription, language label, evidence, criterion-wise marks, and feedback in JSON.
- Teacher can edit extracted text, adjust marks/feedback, and save the final decision. AI scores are never automatically treated as final.
- Responsive layout with guided forms, readable status labels, and simple navigation.

## Requirements

- Node.js 20 or newer recommended
- npm 10 or newer recommended
- Docker Desktop (for local PostgreSQL) **or** an existing PostgreSQL database
- A Groq API key from [Groq Console](https://console.groq.com/keys)

## Run locally

Run these commands from the repository root.

### 1. Install packages

```bash
npm install
```

### 2. Start PostgreSQL

Docker is the easiest option:

```bash
docker compose up -d postgres
```

This starts a local database called `akshar_paaul` on port `5432` with local development credentials shown in `docker-compose.yml`. Do not use those passwords for a publicly accessible database.

### 3. Configure the API

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set:

- `JWT_SECRET` to a random secret of at least 32 characters.
- `GROQ_API_KEY` to your key from Groq Console.
- `GROQ_VISION_MODEL` to a currently supported vision model enabled for your Groq account. The starter value is `qwen/qwen3.8-27b`; model availability and free-tier limits can change.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME` for the first administrator. Use a long, unique temporary password.

The database URL is already set for the included Docker Compose configuration. If you use an existing database, update `DATABASE_URL`.

### 4. Create tables and first administrator

```bash
npm run db:init
npm run seed:admin
```

The schema script is safe to rerun. The admin seed script does not overwrite an existing user with the same username. Keep your administrator password private.

### 5. Start the app

```bash
npm run dev
```

- React app: <http://localhost:5173>
- Express API health check: <http://localhost:4000/api/health>

Sign in with the `ADMIN_USERNAME` and `ADMIN_PASSWORD` you set in `server/.env`. An administrator can create faculty accounts from **Faculty accounts**.

## First-time use

1. The admin signs in and creates a faculty account.
2. Faculty sign in and create or select a book.
3. Add a grading standard, such as main ideas (5 marks), understanding (5 marks), and clarity (5 marks). Total marks are calculated from the criteria.
4. Upload a clear photo of a student's handwritten summary.
5. Open the submission and select **Extract text and suggest marks**.
6. Compare the extracted text with the original image; edit unclear or incorrectly read words.
7. Review criterion-wise evidence and marks. Change any score or feedback that needs teacher judgement.
8. Save the final teacher assessment.
9. Separately, faculty submit daily-work records. An admin can approve or request changes, with comments visible to the faculty member.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_SSL` | Set to `true` if your database provider requires SSL |
| `JWT_SECRET` | Long random secret for signing login tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `8h`) |
| `PORT` | Local API port (default `4000`) |
| `CLIENT_ORIGIN` | Allowed browser origin(s); use comma-separated origins in production |
| `GROQ_API_KEY` | Private key for Groq requests; server only |
| `GROQ_VISION_MODEL` | Configurable Groq model ID supporting images |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Initial administrator seed credentials |

Never add real API keys, database passwords, or production JWT secrets to Git. Never place `GROQ_API_KEY` in a `VITE_` frontend variable.

## Deploy to Vercel

Vercel does not itself provide a persistent PostgreSQL database. Use a PostgreSQL-compatible managed database and its connection string, then deploy the UI and API as separate Vercel projects from this repository.

### API project

1. Import the repository in Vercel and set **Root Directory** to `server`.
2. Use the Node.js runtime / Express detection (the entry point is `server/index.js`).
3. Add production environment variables: `DATABASE_URL`, `DATABASE_SSL=true` if required, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN`, `GROQ_API_KEY`, and `GROQ_VISION_MODEL`.
4. Set `CLIENT_ORIGIN` to the exact deployed frontend origin, such as `https://your-portal.vercel.app`.
5. Run `npm run db:init` against the production database before using the API. Seed the initial administrator once, using the production `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_NAME`, then remove those seed variables if you do not need them later.
6. Verify `https://your-api-domain/api/health` returns `{ "ok": true, ... }`.

### Frontend project

1. Import the same repository as another Vercel project and set **Root Directory** to `client`.
2. Set `VITE_API_URL` to the API origin plus `/api`, for example `https://your-api-domain/api`.
3. Deploy. Vite builds the React app; `client/vercel.json` routes browser paths back to `index.html`.

If Vercel's Express auto-detection changes, use Vercel's current Express deployment instructions for the API project rather than exposing database credentials to the frontend.

## Important privacy and accuracy notes

- This version sends student page images to Groq for AI processing. Before using it with real student information, the NGO should review Groq's current privacy/data-handling terms and obtain any required consent. Remove student names from photo pages when practical.
- AI handwriting recognition may make errors in Hindi, Marathi, English, low-light images, and cursive writing. A model supporting image input does not guarantee perfect handwriting OCR. Teachers must verify transcription and assessment.
- API free tiers, model names, model availability, and rate limits may change. When a Groq request is limited or unavailable, the app displays a readable error; the saved photo remains available to retry later.
- This starter accepts one image per submission (one page). For multi-page summaries, upload pages as separate submissions or extend the data model with multiple page records.
- A production rollout should also include tested backups, monitoring, a formal data-retention policy, and password-reset support.

## Repository map

```text
akshar-paaul-portal/
├── client/                    # React + Vite + Tailwind UI
│   └── src/
│       ├── components/        # Layout, loading and status components
│       ├── context/            # JWT login/session state
│       ├── pages/              # Dashboard, work, books, assessment and users
│       ├── api.js               # Centralized REST helper
│       └── App.jsx
├── server/
│   ├── src/
│   │   ├── middleware/         # Authentication and role checks
│   │   ├── routes/             # REST endpoint handlers
│   │   ├── services/groq.js    # Isolated Groq vision/OCR + rubric evaluation
│   │   ├── scripts/            # DB init and initial admin setup
│   │   ├── app.js               # Express app and central error handling
│   │   └── db.js                # PostgreSQL connection pool
│   ├── sql/schema.sql          # Tables and indexes
│   └── index.js                # Vercel Express entry point
└── docker-compose.yml          # Local PostgreSQL for development
```

## API overview

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/login` | Sign in and return JWT |
| `GET /api/auth/me` | Validate current session |
| `GET /api/work` / `POST /api/work` | List / submit daily work |
| `PATCH /api/work/:id` | Resubmit activity after changes requested |
| `POST /api/work/:id/review` | Admin approves or requests changes with feedback |
| `GET /api/work/:id/history` | Revision and review history |
| `GET /api/books` / `POST /api/books` | Browse / create books |
| `GET /api/books/:id` | Book details and current rubric |
| `POST /api/books/:id/standards` | Create a new rubric version |
| `POST /api/submissions/for-book/:bookId` | Upload a student's page photo |
| `POST /api/submissions/:id/evaluate` | Extract handwriting and get Groq rubric suggestions |
| `PATCH /api/submissions/:id/final` | Save teacher-verified transcription, marks and feedback |
| `GET /api/users` / `POST /api/users/faculty` | Admin manages faculty accounts |
