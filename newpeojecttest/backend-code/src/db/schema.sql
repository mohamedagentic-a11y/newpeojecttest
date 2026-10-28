CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('member', 'librarian');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'book_status') THEN
    CREATE TYPE book_status AS ENUM ('available', 'borrowed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'member',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS books (
  book_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      VARCHAR(500) NOT NULL,
  author     VARCHAR(255) NOT NULL,
  isbn       VARCHAR(32) NOT NULL UNIQUE,
  status     book_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_books_title_lower ON books (LOWER(title));
CREATE INDEX IF NOT EXISTS idx_books_author_lower ON books (LOWER(author));

CREATE TABLE IF NOT EXISTS loans (
  loan_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  book_id     UUID NOT NULL REFERENCES books(book_id) ON DELETE RESTRICT,
  borrow_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date    TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ NULL,
  CONSTRAINT loans_due_after_borrow CHECK (due_date >= borrow_date),
  CONSTRAINT loans_return_after_borrow CHECK (return_date IS NULL OR return_date >= borrow_date)
);

CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans (user_id);
CREATE INDEX IF NOT EXISTS idx_loans_book_id ON loans (book_id);

-- The same copy cannot have more than one active (unreturned) loan.
CREATE UNIQUE INDEX IF NOT EXISTS uq_loans_active_book
  ON loans (book_id)
  WHERE return_date IS NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  log_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(100) NOT NULL,
  actor_id    UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs ("timestamp");