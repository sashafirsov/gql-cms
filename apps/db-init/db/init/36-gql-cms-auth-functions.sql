-- 36-gql-cms-auth-functions.sql
-- Authentication helper functions for gql_cms ACL
-- Adapted from northwind-auth-functions.sql

BEGIN;

-- ---------- Authentication Helper Functions ----------

-- Find user by email (for login)
CREATE OR REPLACE FUNCTION gql_cms.find_user_by_email(p_email CITEXT)
RETURNS UUID
LANGUAGE sql STABLE AS $$
    SELECT id FROM gql_cms.users WHERE email = p_email;
$$;

COMMENT ON FUNCTION gql_cms.find_user_by_email IS
'Finds a user UUID by email address. Returns NULL if email not found.';

-- Get password hash for verification (application should use argon2.verify in NestJS, not SQL)
CREATE OR REPLACE FUNCTION gql_cms.get_password_hash(p_email CITEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT password_hash FROM gql_cms.users WHERE email = p_email;
$$;

COMMENT ON FUNCTION gql_cms.get_password_hash IS
'Returns password hash for verification. Used by application to verify user credentials. SECURITY DEFINER allows app to read hash without exposing via RLS.';

-- Link OAuth identity to existing user or create new
CREATE OR REPLACE FUNCTION gql_cms.upsert_oauth_identity(
    p_provider TEXT,
    p_provider_sub TEXT,
    p_provider_email CITEXT,
    p_profile_data JSONB,
    p_full_name TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
    v_user_id UUID;
    v_existing_oauth UUID;
BEGIN
    -- Check if OAuth identity already exists
    SELECT user_id INTO v_existing_oauth
    FROM gql_cms.oauth_identities
    WHERE provider = p_provider AND provider_sub = p_provider_sub;

    IF v_existing_oauth IS NOT NULL THEN
        -- Update existing OAuth record
        UPDATE gql_cms.oauth_identities
        SET provider_email = p_provider_email,
            profile_data = p_profile_data,
            updated_at = now()
        WHERE provider = p_provider AND provider_sub = p_provider_sub;

        RETURN v_existing_oauth;
    END IF;

    -- Try to find existing user by email (account linking)
    SELECT id INTO v_user_id
    FROM gql_cms.users
    WHERE email = p_provider_email;

    IF v_user_id IS NULL THEN
        -- Create new user
        INSERT INTO gql_cms.users(email, auth_provider, full_name, email_verified)
        VALUES (
            p_provider_email,
            p_provider,
            COALESCE(p_full_name, p_provider_email),
            TRUE  -- OAuth emails are pre-verified
        )
        RETURNING id INTO v_user_id;
    END IF;

    -- Create OAuth identity
    INSERT INTO gql_cms.oauth_identities(
        user_id, provider, provider_sub,
        provider_email, profile_data
    )
    VALUES (
        v_user_id, p_provider, p_provider_sub,
        p_provider_email, p_profile_data
    );

    RETURN v_user_id;
END;
$$;

COMMENT ON FUNCTION gql_cms.upsert_oauth_identity IS
'Creates or updates an OAuth identity. If email matches existing user, links to that user (account linking). Otherwise creates new user.';

-- Revoke all tokens for a user (logout all devices)
CREATE OR REPLACE FUNCTION gql_cms.revoke_user_tokens(p_user_id UUID)
RETURNS VOID
LANGUAGE sql AS $$
    UPDATE gql_cms.refresh_tokens
    SET revoked_at = now(),
        revoked_reason = 'user_initiated_logout_all'
    WHERE user_id = p_user_id
      AND revoked_at IS NULL;
$$;

COMMENT ON FUNCTION gql_cms.revoke_user_tokens IS
'Revokes all active refresh tokens for a user. Used for "logout all devices" functionality.';

-- Revoke single token (logout current device)
CREATE OR REPLACE FUNCTION gql_cms.revoke_token(p_jti UUID)
RETURNS VOID
LANGUAGE sql AS $$
    UPDATE gql_cms.refresh_tokens
    SET revoked_at = now(),
        revoked_reason = 'user_initiated_logout'
    WHERE jti = p_jti
      AND revoked_at IS NULL;
$$;

COMMENT ON FUNCTION gql_cms.revoke_token IS
'Revokes a single refresh token by JTI. Used for logout from current device.';

-- Check if token is revoked
CREATE OR REPLACE FUNCTION gql_cms.is_token_revoked(p_jti UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1
        FROM gql_cms.refresh_tokens
        WHERE jti = p_jti
          AND revoked_at IS NOT NULL
    );
$$;

COMMENT ON FUNCTION gql_cms.is_token_revoked IS
'Checks if a refresh token has been revoked. Returns TRUE if revoked, FALSE if active or not found.';

-- Check if token exists and is valid
CREATE OR REPLACE FUNCTION gql_cms.is_token_valid(p_jti UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1
        FROM gql_cms.refresh_tokens
        WHERE jti = p_jti
          AND revoked_at IS NULL
          AND expires_at > now()
    );
$$;

COMMENT ON FUNCTION gql_cms.is_token_valid IS
'Checks if a refresh token is valid (exists, not revoked, not expired).';

-- Clean expired/revoked tokens (maintenance)
CREATE OR REPLACE FUNCTION gql_cms.cleanup_expired_tokens()
RETURNS INTEGER
LANGUAGE sql AS $$
    WITH deleted AS (
        DELETE FROM gql_cms.refresh_tokens
        WHERE expires_at < now() - INTERVAL '30 days'
           OR (revoked_at IS NOT NULL AND revoked_at < now() - INTERVAL '30 days')
        RETURNING 1
    )
    SELECT COUNT(*)::INTEGER FROM deleted;
$$;

COMMENT ON FUNCTION gql_cms.cleanup_expired_tokens IS
'Removes expired and revoked tokens older than 30 days. Should be run periodically via cron.';

-- Get user details for JWT generation
CREATE OR REPLACE FUNCTION gql_cms.get_user_details(p_user_id UUID)
RETURNS TABLE(
    user_id UUID,
    email CITEXT,
    full_name TEXT,
    auth_provider TEXT,
    email_verified BOOLEAN
)
LANGUAGE sql STABLE AS $$
    SELECT
        id,
        email,
        full_name,
        auth_provider,
        email_verified
    FROM gql_cms.users
    WHERE id = p_user_id;
$$;

COMMENT ON FUNCTION gql_cms.get_user_details IS
'Returns user details needed for JWT generation. Used after successful authentication.';

-- Create user with password credentials (registration)
CREATE OR REPLACE FUNCTION gql_cms.create_user_with_password(
    p_email CITEXT,
    p_password_hash TEXT,
    p_full_name TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM gql_cms.users WHERE email = p_email) THEN
        RAISE EXCEPTION 'Email already registered';
    END IF;

    -- Create user
    INSERT INTO gql_cms.users(email, auth_provider, full_name, password_hash, email_verified)
    VALUES (
        p_email,
        'password',
        COALESCE(p_full_name, p_email),
        p_password_hash,
        FALSE  -- Requires email verification
    )
    RETURNING id INTO v_user_id;

    RETURN v_user_id;
END;
$$;

COMMENT ON FUNCTION gql_cms.create_user_with_password IS
'Creates a new user with password credentials. Used for user registration. Raises exception if email already exists.';

-- Update password
CREATE OR REPLACE FUNCTION gql_cms.update_password(
    p_user_id UUID,
    p_new_password_hash TEXT
) RETURNS VOID
LANGUAGE sql AS $$
    UPDATE gql_cms.users
    SET password_hash = p_new_password_hash,
        updated_at = now()
    WHERE id = p_user_id;
$$;

COMMENT ON FUNCTION gql_cms.update_password IS
'Updates password hash for a user. Used for password reset/change functionality.';

-- Mark email as verified
CREATE OR REPLACE FUNCTION gql_cms.verify_email(p_user_id UUID)
RETURNS VOID
LANGUAGE sql AS $$
    UPDATE gql_cms.users
    SET email_verified = TRUE,
        updated_at = now()
    WHERE id = p_user_id;
$$;

COMMENT ON FUNCTION gql_cms.verify_email IS
'Marks email as verified for a user. Used after email verification flow.';

COMMIT;
