-- Core schema for the Akshar Paaul portal.
-- IDs use BIGSERIAL to keep setup friendly; passwords are always stored as bcrypt hashes.

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(180) UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'faculty')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faculty_work (
  id BIGSERIAL PRIMARY KEY,
  faculty_id BIGINT NOT NULL REFERENCES users(id),
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title VARCHAR(180) NOT NULL,
  details TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'changes_requested')),
  latest_feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- A revision row is saved before a faculty member edits/resubmits an activity.
CREATE TABLE IF NOT EXISTS faculty_work_revisions (
  id BIGSERIAL PRIMARY KEY,
  work_id BIGINT NOT NULL REFERENCES faculty_work(id) ON DELETE CASCADE,
  saved_by BIGINT NOT NULL REFERENCES users(id),
  work_date DATE NOT NULL,
  title VARCHAR(180) NOT NULL,
  details TEXT NOT NULL,
  prior_status VARCHAR(30) NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each admin decision/comment is kept, even if the record is reviewed more than once.
CREATE TABLE IF NOT EXISTS work_reviews (
  id BIGSERIAL PRIMARY KEY,
  work_id BIGINT NOT NULL REFERENCES faculty_work(id) ON DELETE CASCADE,
  admin_id BIGINT NOT NULL REFERENCES users(id),
  action VARCHAR(30) NOT NULL CHECK (action IN ('approved', 'changes_requested')),
  feedback TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS books (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(220) NOT NULL,
  author VARCHAR(180) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- New rubric versions are inserted rather than overwriting an old rubric.
-- Submissions keep both the rubric ID and a JSON snapshot for historical accuracy.
CREATE TABLE IF NOT EXISTS grading_standards (
  id BIGSERIAL PRIMARY KEY,
  book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL,
  total_marks NUMERIC(8,2) NOT NULL CHECK (total_marks > 0),
  criteria JSONB NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (book_id, version)
);

CREATE TABLE IF NOT EXISTS submissions (
  id BIGSERIAL PRIMARY KEY,
  book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  standard_id BIGINT NOT NULL REFERENCES grading_standards(id),
  standard_snapshot JSONB NOT NULL,
  student_name VARCHAR(160) NOT NULL,
  student_class VARCHAR(80) NOT NULL DEFAULT '',
  student_section VARCHAR(80) NOT NULL DEFAULT '',
  image_bytes BYTEA NOT NULL,
  image_mime VARCHAR(80) NOT NULL,
  image_filename VARCHAR(255) NOT NULL,
  extracted_text TEXT NOT NULL DEFAULT '',
  detected_language VARCHAR(80) NOT NULL DEFAULT '',
  ai_score NUMERIC(8,2),
  ai_feedback TEXT NOT NULL DEFAULT '',
  ai_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_score NUMERIC(8,2),
  final_feedback TEXT NOT NULL DEFAULT '',
  final_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'ai_reviewed', 'reviewed')),
  submitted_by BIGINT NOT NULL REFERENCES users(id),
  reviewed_by BIGINT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_status_date ON faculty_work(status, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_faculty_date ON faculty_work(faculty_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_books_creator ON books(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_book_date ON submissions(book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, created_at DESC);
