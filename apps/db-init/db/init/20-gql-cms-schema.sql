-- === Bootstrap ===============================================================
CREATE SCHEMA IF NOT EXISTS app;

-- Needed for UUIDs and case-insensitive unique emails
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- App session actor helper: set once per request like:
--   SELECT set_config('app.user_id', '<uuid-of-acting-user>', true);
--   (Your API should set this immediately after auth.)
-- ============================================================================
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

-- Convenience: check a global role by name for the current actor
CREATE TABLE IF NOT EXISTS app.roles (
  name        text PRIMARY KEY,                 -- 'admin','manager','bot','authorizer','owner'
  description text
);

INSERT INTO app.roles(name, description) VALUES
  ('admin','full admin'),
  ('manager','global manager'),
  ('bot','read-only bot for documents'),
  ('authorizer','can only create users'),
  ('owner','per-record owner')
ON CONFLICT (name) DO NOTHING;

-- === Core entities ===========================================================
CREATE TABLE IF NOT EXISTS app.users (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext  NOT NULL UNIQUE,
  auth_provider text    NOT NULL,
  full_name     text    NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_url   text NOT NULL,
  short_url  text NOT NULL UNIQUE,
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Global roles assigned to users
CREATE TABLE IF NOT EXISTS app.user_roles (
  user_id   uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  role_name text NOT NULL REFERENCES app.roles(name) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, role_name)
);

-- Per-document access: owner/manager on a specific document
CREATE TABLE IF NOT EXISTS app.document_acl (
  document_id uuid NOT NULL REFERENCES app.documents(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  role_name   text NOT NULL REFERENCES app.roles(name) ON DELETE RESTRICT,
  CHECK (role_name IN ('owner','manager')),
  PRIMARY KEY (document_id, user_id, role_name)
);

-- Per-user access to their own user record (owner only)
CREATE TABLE IF NOT EXISTS app.user_acl (
  target_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  role_name      text NOT NULL REFERENCES app.roles(name) ON DELETE RESTRICT,
  CHECK (role_name = 'owner'),
  PRIMARY KEY (target_user_id, user_id, role_name)
);
