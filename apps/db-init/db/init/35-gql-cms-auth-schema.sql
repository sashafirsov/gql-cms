-- 35-gql-cms-auth-schema.sql
-- Authentication schema extension for gql_cms
-- Adds password and OAuth/OIDC authentication support

BEGIN;

-- Ensure citext extension for case-insensitive emails
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- Extend users table with password field ----------

-- Add password_hash column to existing users table
ALTER TABLE gql_cms.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE gql_cms.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE gql_cms.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Make email case-insensitive
ALTER TABLE gql_cms.users ALTER COLUMN email TYPE CITEXT;

COMMENT ON COLUMN gql_cms.users.password_hash IS
'argon2id hash of user password. NULL for OAuth-only users.';

COMMENT ON COLUMN gql_cms.users.email_verified IS
'Whether email has been verified via confirmation link.';

-- ---------- Authentication Tables ----------

-- A. OAuth/OIDC identities
CREATE TABLE IF NOT EXISTS gql_cms.oauth_identities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES gql_cms.users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,  -- 'google', 'github', 'azure', etc.
    provider_sub    TEXT NOT NULL,  -- Provider's subject/user ID
    provider_email  CITEXT,
    profile_data    JSONB DEFAULT '{}'::jsonb,
    access_token_enc BYTEA,  -- Encrypted provider access token (optional)
    refresh_token_enc BYTEA, -- Encrypted provider refresh token (optional)
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider, provider_sub)
);

COMMENT ON TABLE gql_cms.oauth_identities IS
'Stores OAuth/OIDC provider identities linked to users. Supports account linking (one user, multiple OAuth providers).';

CREATE INDEX idx_gql_cms_oauth_identities_user ON gql_cms.oauth_identities(user_id);
CREATE INDEX idx_gql_cms_oauth_identities_provider ON gql_cms.oauth_identities(provider, provider_sub);

-- B. Refresh token ledger (JWT rotation)
CREATE TABLE IF NOT EXISTS gql_cms.refresh_tokens (
    jti             UUID PRIMARY KEY,  -- JWT ID
    user_id         UUID NOT NULL REFERENCES gql_cms.users(id) ON DELETE CASCADE,
    token_family    UUID NOT NULL,  -- For token rotation chains
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  TEXT,
    user_agent      TEXT,
    ip_address      INET,
    last_used_at    TIMESTAMPTZ
);

CREATE INDEX idx_gql_cms_refresh_tokens_user ON gql_cms.refresh_tokens(user_id);
CREATE INDEX idx_gql_cms_refresh_tokens_family ON gql_cms.refresh_tokens(token_family);
CREATE INDEX idx_gql_cms_refresh_tokens_expires ON gql_cms.refresh_tokens(expires_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE gql_cms.refresh_tokens IS
'Audit trail and revocation list for refresh JWTs. Supports token rotation with family detection for security.';

-- C. Session tracking (optional, for audit/analytics)
CREATE TABLE IF NOT EXISTS gql_cms.sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES gql_cms.users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    user_agent      TEXT,
    ip_address      INET,
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_gql_cms_sessions_user ON gql_cms.sessions(user_id);
CREATE INDEX idx_gql_cms_sessions_active ON gql_cms.sessions(user_id, expires_at);

COMMENT ON TABLE gql_cms.sessions IS
'Tracks active sessions for audit and analytics purposes. Sessions are informational only; authentication uses JWT tokens.';

-- ---------- RLS Policies for Auth Tables ----------

-- OAuth identities: Users can only see their own
ALTER TABLE gql_cms.oauth_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY oauth_identities_select ON gql_cms.oauth_identities
FOR SELECT
USING (user_id = gql_cms.current_user_id());

CREATE POLICY oauth_identities_admin_all ON gql_cms.oauth_identities
FOR ALL
USING (gql_cms.has_global_role('admin'));

-- Refresh tokens: Read-only for users, admin full access, allow INSERT for auth service
ALTER TABLE gql_cms.refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY refresh_tokens_insert ON gql_cms.refresh_tokens
FOR INSERT
WITH CHECK (true);  -- Allow auth service to insert tokens

CREATE POLICY refresh_tokens_select ON gql_cms.refresh_tokens
FOR SELECT
USING (
    user_id = gql_cms.current_user_id()
    OR gql_cms.has_global_role('admin')
);

CREATE POLICY refresh_tokens_admin_all ON gql_cms.refresh_tokens
FOR ALL
USING (gql_cms.has_global_role('admin'));

-- Sessions: Users can see their own
ALTER TABLE gql_cms.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_select ON gql_cms.sessions
FOR SELECT
USING (
    user_id = gql_cms.current_user_id()
    OR gql_cms.has_global_role('admin')
);

CREATE POLICY sessions_admin_all ON gql_cms.sessions
FOR ALL
USING (gql_cms.has_global_role('admin'));

COMMIT;
