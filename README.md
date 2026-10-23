# Akshar Paaul Portal

A web portal for the Akshar Paaul NGO with two workflows:

1.  **Faculty daily work:** faculty submit activities; administrators
    approve them or request changes with comments. Resubmissions retain
    previous versions and review history.
2.  **Handwritten student book summaries:** educators create books and
    grading rubrics, upload student handwriting, use Groq to extract
    text and suggest marks, then review and save the final teacher
    assessment.

## Project status

The application is deployed and has been tested successfully using
**Vercel** for the frontend and API and **Neon PostgreSQL** for the
production database.

-   Frontend and API are deployed as separate Vercel projects.
-   The Neon schema has been initialized and a production administrator
    has been seeded.
-   Admin login and site usage have been tested.
-   API health endpoint: `/api/health`.

Insert your actual deployment URLs here if you want them documented.
Never include passwords, tokens, database connection strings, or API
keys in this file.

## Live demo

The production portal is available at:

- **Login page:** <https://akshar-paaul-portal-vcim.vercel.app/login>
- **Home page:** <https://akshar-paaul-portal-vcim.vercel.app/>

### Authentication flow

- Opening the login URL displays the sign-in page.
- After a successful login, the user is redirected to the home page (`/`).
- Visiting the home page while logged out redirects the user to `/login`.

The login flow and general site usage have been tested on the deployed application. Do not publish administrator credentials or other account passwords in this README.

## Technology stack

  -----------------------------------------------------------------------
  Layer                               Technology
  ----------------------------------- -----------------------------------
  Frontend                            React + Vite

  Styling                             Tailwind CSS

  Backend                             Node.js + Express

  API                                 REST (`/api/...`)

  Authentication                      JWT + role-based access control
                                      (`admin` / `faculty`)

  Database                            PostgreSQL (Neon in production;
                                      local PostgreSQL for development)

  AI / OCR                            Groq vision API (`groq-sdk`)

  Hosting                             Vercel frontend and API projects;
                                      Neon PostgreSQL
  -----------------------------------------------------------------------

The local AI runtime is intentionally not included. Handwriting images
are sent to the configured Groq model for processing, so a high-memory
local computer or Ollama installation is not required.

## Features

-   Password-hash-based sign-in and expiring JWT sessions.
-   Admin-only faculty account creation/deactivation.
-   Faculty daily-work submissions, admin approval/change requests,
    comments, revision history, and review history.
-   Book library with custom grading criteria and mark allocations.
-   Rubric versioning: each submission retains the rubric version used
    at upload time.
-   JPG, PNG, and WEBP uploads up to 4 MB. Student page images are
    stored in PostgreSQL, not a public upload folder.
-   Groq vision requests for handwritten transcription, language label,
    evidence, criterion-wise marks, and feedback.
-   Teachers can edit extracted text, marks, and feedback and save the
    final assessment. AI suggestions are not automatically treated as
    final.
-   Responsive interface with guided forms, status labels, and simple
    navigation.

## Requirements

-   Node.js 20 or newer
-   npm 10 or newer recommended
-   Docker Desktop for local PostgreSQL, or another PostgreSQL database
-   A Groq API key from the [Groq
    Console](https://console.groq.com/keys)

## Run locally

Run commands from the repository root unless noted otherwise.

### 1. Install packages

``` bash
npm install
```

### 2. Start PostgreSQL

``` bash
docker compose up -d postgres
```

This starts the local `akshar_paaul` database on port `5432` using the
development credentials in `docker-compose.yml`. Do not use these
credentials for a publicly accessible database.

### 3. Configure the API

Copy the example environment file.

**PowerShell**

``` powershell
Copy-Item server/.env.example server/.env
```

**macOS / Linux**

``` bash
cp server/.env.example server/.env
```

Edit `server/.env` and configure:

-   `DATABASE_URL` --- local Docker URL for the included Compose setup,
    or your own PostgreSQL connection string.
-   `JWT_SECRET` --- a unique random secret of at least 32 characters.
-   `GROQ_API_KEY` --- your private Groq API key.
-   `GROQ_VISION_MODEL` --- an image-capable model available to your
    Groq account. The starter value is `qwen/qwen3.8-27b`; availability
    and limits can change.
-   `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME` ---
    initial administrator credentials and display name. Use a long,
    unique password.

Keep `server/.env` private and out of Git.

### 4. Initialize the database and seed the administrator

``` bash
npm run db:init
npm run seed:admin
```

The schema script creates tables and indexes. The seed script creates
the administrator if the username does not already exist; it does not
overwrite an existing account with that username.

### 5. Start the app

``` bash
npm run dev
```

-   Frontend: <http://localhost:5173>
-   API health check: <http://localhost:4000/api/health>

Sign in with the `ADMIN_USERNAME` and `ADMIN_PASSWORD` configured in
your local environment. An administrator can create faculty accounts
from **Faculty accounts**.

## First-time use

1.  The administrator signs in and creates a faculty account.
2.  Faculty sign in and create or select a book.
3.  Add a grading standard, for example main ideas (5 marks),
    understanding (5 marks), and clarity (5 marks). The total is
    calculated from the criteria.
4.  Upload a clear photo of a student's handwritten summary.
5.  Open the submission and select **Extract text and suggest marks**.
6.  Compare the transcription with the image and correct any errors.
7.  Review criterion-wise evidence, marks, and feedback. Adjust anything
    that requires teacher judgement.
8.  Save the final teacher assessment.
9.  Faculty can separately submit daily-work records. An administrator
    can approve them or request changes with comments visible to the
    faculty member.

## Environment variables

  -----------------------------------------------------------------------
  Variable                            Purpose
  ----------------------------------- -----------------------------------
  `DATABASE_URL`                      PostgreSQL connection string

  `DATABASE_SSL`                      Optional SSL toggle; production
                                      code enables SSL when
                                      `NODE_ENV=production`

  `JWT_SECRET`                        Secret used to sign login tokens

  `JWT_EXPIRES_IN`                    Token lifetime; defaults to `8h`

  `PORT`                              Local API port; defaults to `4000`

  `CLIENT_ORIGIN`                     Allowed frontend origin(s);
                                      multiple origins may be
                                      comma-separated

  `GROQ_API_KEY`                      Private Groq API key; backend only

  `GROQ_VISION_MODEL`                 Configurable image-capable Groq
                                      model ID

  `ADMIN_USERNAME`                    Initial administrator username for
                                      the seed script

  `ADMIN_PASSWORD`                    Initial administrator password for
                                      the seed script

  `ADMIN_NAME`                        Optional administrator display name
  -----------------------------------------------------------------------

Set environment variables in Vercel project settings for production.
`DATABASE_URL`, `JWT_SECRET`, and `GROQ_API_KEY` must never be exposed
to the browser. Never put `GROQ_API_KEY` in a `VITE_` variable.

## Production deployment

The production setup uses two Vercel projects and Neon PostgreSQL.

### Neon database

1.  Create a Neon PostgreSQL project and copy its connection string from
    the Neon **Connect** dialog.
2.  Store the connection string securely. If the Neon password is reset,
    update the API project's `DATABASE_URL` and redeploy.
3.  Run `npm run db:init` against the production database.
4.  Run `npm run seed:admin` once against the production database.
5.  Remember that the local Docker database and Neon are separate.
    Schema initialization and admin seeding do **not** migrate local
    books, faculty accounts, grading standards, or submissions into
    Neon.

Run production database scripts with the production `DATABASE_URL`
supplied securely. Avoid placing credentials in source files,
screenshots, chat, or shell history, and clear temporary environment
variables when finished.

### API project (Vercel)

1.  Import the repository into Vercel as a separate project.
2.  Set **Root Directory** to `server`.
3.  Use Vercel's Node.js / Express deployment configuration. The entry
    point is `server/index.js`.
4.  Configure these environment variables in the API project:
    -   `DATABASE_URL`
    -   `JWT_SECRET`
    -   `JWT_EXPIRES_IN` (for example, `8h`)
    -   `CLIENT_ORIGIN` (the exact deployed frontend origin, without a
        trailing slash)
    -   `GROQ_API_KEY`
    -   `GROQ_VISION_MODEL`
    -   `NODE_ENV=production`
    -   `PG_POOL_MAX=3` as a conservative starting point for a
        serverless database connection pool
5.  If the frontend domain changes, update `CLIENT_ORIGIN` and redeploy
    the API.
6.  Verify `https://YOUR-API-DOMAIN/api/health` returns a successful
    JSON response.

`DATABASE_SSL` is not required when `NODE_ENV=production` because the
current database connection code enables SSL in production.

### Frontend project (Vercel)

1.  Import the same repository into Vercel as a second project.
2.  Set **Root Directory** to `client`.
3.  Set `VITE_API_URL` to the deployed API origin followed by `/api`,
    such as `https://YOUR-API-DOMAIN/api`.
4.  Deploy. Vite builds the React app; `client/vercel.json` routes
    browser paths back to `index.html`.

Use Vercel's current Express deployment documentation if its
auto-detection or deployment behavior changes. Never expose database
credentials to the frontend.

## Production verification checklist

After deployment or environment-variable changes, verify:

-   [ ] The frontend loads without blocking browser-console errors.
-   [ ] Admin can sign in and sign out.
-   [ ] Faculty can sign in and access intended features.
-   [ ] Faculty cannot access other faculty members' private
    submissions.
-   [ ] Daily-work submission, review, change requests, and history
    work.
-   [ ] Books and grading standards can be created and retrieved.
-   [ ] A test image uploads and remains available after refresh.
-   [ ] AI transcription and suggested assessment work when Groq is
    available.
-   [ ] Teachers can edit and save the final assessment.
-   [ ] Data persists after refresh or a new session.
-   [ ] The API health endpoint responds successfully.

For login failures or server errors, inspect Vercel API runtime logs and
the failed request's status/response in browser Developer Tools →
Network. A PostgreSQL `password authentication failed` error usually
means the API's `DATABASE_URL` contains an incorrect or outdated
database password; update the variable and redeploy the API.

## Privacy, accuracy, and operational notes

-   Student page images are sent to Groq for AI processing. Before using
    real student information, the NGO should review Groq's current
    privacy/data-handling terms and obtain any required consent. Remove
    student names from photos when practical.
-   Handwriting recognition can make errors in Hindi, Marathi, English,
    low-light images, and cursive writing. Teachers must verify
    transcription and assessment.
-   Groq model names, availability, free-tier limits, and rate limits
    can change. If AI processing is unavailable or rate-limited, the app
    may show an error; the saved photo remains available for a later
    retry.
-   The current workflow accepts one image per submission (one page).
    For multi-page summaries, upload pages as separate submissions or
    extend the data model.
-   A production rollout should include tested backups, monitoring, a
    data-retention policy, and a password-reset process.
-   Use strong, unique production secrets and rotate any credential that
    may have been exposed. Never commit `.env` files, database URLs, JWT
    secrets, or API keys.
-   Limit access to production database and Vercel projects to
    authorized maintainers.

## Repository map

``` text
akshar-paaul-portal/
├── client/                     # React + Vite + Tailwind UI
│   └── src/
│       ├── components/         # Layout, loading and status components
│       ├── context/            # JWT login/session state
│       ├── pages/              # Dashboard, work, books, assessment and users
│       ├── api.js              # Centralized REST helper
│       └── App.jsx
├── server/
│   ├── src/
│   │   ├── middleware/         # Authentication and role checks
│   │   ├── routes/             # REST endpoint handlers
│   │   ├── services/groq.js    # Groq vision/OCR and rubric evaluation
│   │   ├── scripts/             # DB initialization and admin setup
│   │   ├── app.js               # Express app and error handling
│   │   └── db.js                # PostgreSQL connection pool
│   ├── sql/schema.sql          # Tables and indexes
│   └── index.js                # Vercel Express entry point
└── docker-compose.yml          # Local PostgreSQL for development
```

## API overview

  ------------------------------------------------------------------------------
  Endpoint                                   Purpose
  ------------------------------------------ -----------------------------------
  `GET /api/health`                          API health check

  `POST /api/auth/login`                     Sign in and return a JWT

  `GET /api/auth/me`                         Validate the current session

  `GET /api/work` / `POST /api/work`         List / submit daily work

  `PATCH /api/work/:id`                      Resubmit activity after changes are
                                             requested

  `POST /api/work/:id/review`                Admin approves or requests changes
                                             with feedback

  `GET /api/work/:id/history`                Revision and review history

  `GET /api/books` / `POST /api/books`       Browse / create books

  `GET /api/books/:id`                       Book details and current rubric

  `POST /api/books/:id/standards`            Create a new rubric version

  `POST /api/submissions/for-book/:bookId`   Upload a student's page photo

  `POST /api/submissions/:id/evaluate`       Extract handwriting and get Groq
                                             rubric suggestions

  `PATCH /api/submissions/:id/final`         Save teacher-verified
                                             transcription, marks, and feedback

  `GET /api/users` /                         Admin manages faculty accounts
  `POST /api/users/faculty`                  
  ------------------------------------------------------------------------------

------------------------------------------------------------------------

Built for the Akshar Paaul NGO. Review security, privacy, backups, and
data-retention requirements before using the portal with real student
records.
