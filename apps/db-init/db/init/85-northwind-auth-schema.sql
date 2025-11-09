-- 85-northwind-auth-schema.sql
-- Authentication schema extension for Northwind ACL
-- Adds password and OAuth/OIDC authentication support

BEGIN;

-- Ensure citext extension for case-insensitive emails
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- Authentication Tables ----------

-- A. User credentials for password authentication
CREATE TABLE IF NOT EXISTS acl.user_credentials (
    principal_id    UUID PRIMARY KEY REFERENCES acl.principals(id) ON DELETE CASCADE,
    email           CITEXT UNIQUE NOT NULL,
    password_hash   TEXT,  -- argon2id hash; NULL for OAuth-only users
    email_verified  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE acl.user_credentials IS
'Stores password credentials linked to principals. Email is the primary identifier for authentication.';

CREATE INDEX idx_user_credentials_email ON acl.user_credentials(email);

-- B. OAuth/OIDC identities
CREATE TABLE IF NOT EXISTS acl.oauth_identities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id    UUID NOT NULL REFERENCES acl.principals(id) ON DELETE CASCADE,
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

COMMENT ON TABLE acl.oauth_identities IS
'Stores OAuth/OIDC provider identities linked to principals. Supports account linking (one principal, multiple OAuth providers).';

CREATE INDEX idx_oauth_identities_principal ON acl.oauth_identities(principal_id);
CREATE INDEX idx_oauth_identities_provider ON acl.oauth_identities(provider, provider_sub);

-- C. Refresh token ledger (JWT rotation)
CREATE TABLE IF NOT EXISTS acl.refresh_tokens (
    jti             UUID PRIMARY KEY,  -- JWT ID
    principal_id    UUID NOT NULL REFERENCES acl.principals(id) ON DELETE CASCADE,
    token_family    UUID NOT NULL,  -- For token rotation chains
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  TEXT,
    user_agent      TEXT,
    ip_address      INET,
    last_used_at    TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_principal ON acl.refresh_tokens(principal_id);
CREATE INDEX idx_refresh_tokens_family ON acl.refresh_tokens(token_family);
CREATE INDEX idx_refresh_tokens_expires ON acl.refresh_tokens(expires_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE acl.refresh_tokens IS
'Audit trail and revocation list for refresh JWTs. Supports token rotation with family detection for security.';

-- D. Session tracking (optional, for audit/analytics)
CREATE TABLE IF NOT EXISTS acl.sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id    UUID NOT NULL REFERENCES acl.principals(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    user_agent      TEXT,
    ip_address      INET,
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_sessions_principal ON acl.sessions(principal_id);
CREATE INDEX idx_sessions_active ON acl.sessions(principal_id, expires_at);

COMMENT ON TABLE acl.sessions IS
'Tracks active sessions for audit and analytics purposes. Sessions are informational only; authentication uses JWT tokens.';

-- ---------- RLS Policies for Auth Tables ----------

-- User credentials: Users can only see their own
ALTER TABLE acl.user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE acl.user_credentials FORCE ROW LEVEL SECURITY;

CREATE POLICY user_credentials_insert ON acl.user_credentials
FOR INSERT
WITH CHECK (true);  -- Allow auth service to insert credentials during registration

CREATE POLICY user_credentials_select ON acl.user_credentials
FOR SELECT
USING (principal_id = acl.current_principal() OR current_user = 'app_admin');

CREATE POLICY user_credentials_update ON acl.user_credentials
FOR UPDATE
USING (principal_id = acl.current_principal() OR current_user = 'app_admin')
WITH CHECK (principal_id = acl.current_principal() OR current_user = 'app_admin');

-- OAuth identities: Users can see their own
ALTER TABLE acl.oauth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE acl.oauth_identities FORCE ROW LEVEL SECURITY;

CREATE POLICY oauth_identities_select ON acl.oauth_identities
FOR SELECT
USING (principal_id = acl.current_principal() OR current_user = 'app_admin');

-- Refresh tokens: Read-only for users, admin full access, allow INSERT for auth service
ALTER TABLE acl.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE acl.refresh_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY refresh_tokens_insert ON acl.refresh_tokens
FOR INSERT
WITH CHECK (true);  -- Allow auth service to insert tokens

CREATE POLICY refresh_tokens_select ON acl.refresh_tokens
FOR SELECT
USING (principal_id = acl.current_principal() OR current_user = 'app_admin');

-- Sessions: Users can see their own
ALTER TABLE acl.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE acl.sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY sessions_select ON acl.sessions
FOR SELECT
USING (principal_id = acl.current_principal() OR current_user = 'app_admin');

-- Grant permissions to database roles
GRANT SELECT ON acl.user_credentials TO app_user, app_readonly;
GRANT UPDATE ON acl.user_credentials TO app_user;
GRANT ALL ON acl.user_credentials TO app_admin;

GRANT SELECT ON acl.oauth_identities TO app_user, app_readonly;
GRANT ALL ON acl.oauth_identities TO app_admin;

GRANT SELECT ON acl.refresh_tokens TO app_user, app_readonly;
GRANT ALL ON acl.refresh_tokens TO app_admin;

GRANT SELECT ON acl.sessions TO app_user, app_readonly;
GRANT ALL ON acl.sessions TO app_admin;

COMMIT;
