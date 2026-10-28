-- Library portal schema (PostgreSQL 16)
-- Idempotent: safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums (CREATE TYPE has no IF NOT EXISTS; guard with DO blocks)
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

-- Users
CREATE TABLE IF NOT EXISTS users (
  user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  full_name      VARCHAR(255) NOT NULL,
  role           user_role NOT NULL DEFAULT 'member',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Books
CREATE TABLE IF NOT EXISTS books (
  book_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(500) NOT NULL,
  author      VARCHAR(255) NOT NULL,
  isbn        VARCHAR(20)  NOT NULL UNIQUE,
  status      book_status  NOT NULL DEFAULT 'available',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_books_title  ON books (LOWER(title));
CREATE INDEX IF NOT EXISTS idx_books_author ON books (LOWER(author));
CREATE INDEX IF NOT EXISTS idx_books_status ON books (status);

-- Loans
CREATE TABLE IF NOT EXISTS loans (
  loan_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
  book_id      UUID NOT NULL REFERENCES books (book_id) ON DELETE RESTRICT,
  borrow_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date     TIMESTAMPTZ NOT NULL,
  return_date  TIMESTAMPTZ NULL,
  CONSTRAINT chk_loans_due_after_borrow CHECK (due_date > borrow_date),
  CONSTRAINT chk_loans_return_after_borrow CHECK (return_date IS NULL OR return_date >= borrow_date)
);

-- At most one active (unreturned) loan per book
CREATE UNIQUE INDEX IF NOT EXISTS uq_loans_active_book
  ON loans (book_id)
  WHERE return_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans (user_id);
CREATE INDEX IF NOT EXISTS idx_loans_user_active
  ON loans (user_id)
  WHERE return_date IS NULL;

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NULL REFERENCES users (user_id) ON DELETE SET NULL,
  action       VARCHAR(100) NOT NULL,
  entity_type  VARCHAR(50)  NULL,
  entity_id    UUID NULL,
  details      JSONB NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity     ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);