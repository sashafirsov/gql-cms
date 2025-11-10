-- 90-northwind-auth-functions.sql
-- Authentication helper functions for Northwind ACL

BEGIN;

-- ---------- Authentication Helper Functions ----------

-- Find principal by email (for login)
CREATE OR REPLACE FUNCTION acl.find_principal_by_email(p_email CITEXT)
RETURNS UUID
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
    SELECT principal_id FROM acl.user_credentials WHERE email = p_email;
$$;

COMMENT ON FUNCTION acl.find_principal_by_email IS
'Finds a principal UUID by email address. Returns NULL if email not found.';

-- Get password hash for verification (application should use argon2.verify in NestJS, not SQL)
-- This is just a helper to fetch hash for verification
CREATE OR REPLACE FUNCTION acl.get_password_hash(p_email CITEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT password_hash FROM acl.user_credentials WHERE email = p_email;
$$;

COMMENT ON FUNCTION acl.get_password_hash IS
'Returns password hash for verification. Used by application to verify user credentials. SECURITY DEFINER allows app to read hash without exposing via RLS.';

-- Link OAuth identity to existing principal or create new
CREATE OR REPLACE FUNCTION acl.upsert_oauth_identity(
    p_provider TEXT,
    p_provider_sub TEXT,
    p_provider_email CITEXT,
    p_profile_data JSONB,
    p_principal_kind acl.principal_kind DEFAULT 'customer',
    p_display_name TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
    v_principal_id UUID;
    v_existing_oauth UUID;
BEGIN
    -- Check if OAuth identity already exists
    SELECT principal_id INTO v_existing_oauth
    FROM acl.oauth_identities
    WHERE provider = p_provider AND provider_sub = p_provider_sub;

    IF v_existing_oauth IS NOT NULL THEN
        -- Update existing OAuth record
        UPDATE acl.oauth_identities
        SET provider_email = p_provider_email,
            profile_data = p_profile_data,
            updated_at = now()
        WHERE provider = p_provider AND provider_sub = p_provider_sub;

        RETURN v_existing_oauth;
    END IF;

    -- Try to find existing principal by email (account linking)
    SELECT principal_id INTO v_principal_id
    FROM acl.user_credentials
    WHERE email = p_provider_email;

    IF v_principal_id IS NULL THEN
        -- Create new principal
        INSERT INTO acl.principals(kind, external_id, display_name)
        VALUES (
            p_principal_kind,
            p_provider || ':' || p_provider_sub,
            COALESCE(p_display_name, p_provider_email)
        )
        RETURNING id INTO v_principal_id;

        -- Create user_credentials record (no password)
        INSERT INTO acl.user_credentials(principal_id, email, email_verified)
        VALUES (v_principal_id, p_provider_email, TRUE);
    END IF;

    -- Create OAuth identity
    INSERT INTO acl.oauth_identities(
        principal_id, provider, provider_sub,
        provider_email, profile_data
    )
    VALUES (
        v_principal_id, p_provider, p_provider_sub,
        p_provider_email, p_profile_data
    );

    RETURN v_principal_id;
END;
$$;

COMMENT ON FUNCTION acl.upsert_oauth_identity IS
'Creates or updates an OAuth identity. If email matches existing user_credentials, links to that principal (account linking). Otherwise creates new principal.';

-- Revoke all tokens for a principal (logout all devices)
CREATE OR REPLACE FUNCTION acl.revoke_principal_tokens(p_principal_id UUID)
RETURNS VOID
LANGUAGE sql AS $$
    UPDATE acl.refresh_tokens
    SET revoked_at = now(),
        revoked_reason = 'user_initiated_logout_all'
    WHERE principal_id = p_principal_id
      AND revoked_at IS NULL;
$$;

COMMENT ON FUNCTION acl.revoke_principal_tokens IS
'Revokes all active refresh tokens for a principal. Used for "logout all devices" functionality.';

-- Revoke single token (logout current device)
CREATE OR REPLACE FUNCTION acl.revoke_token(p_jti UUID)
RETURNS VOID
LANGUAGE sql AS $$
    UPDATE acl.refresh_tokens
    SET revoked_at = now(),
        revoked_reason = 'user_initiated_logout'
    WHERE jti = p_jti
      AND revoked_at IS NULL;
$$;

COMMENT ON FUNCTION acl.revoke_token IS
'Revokes a single refresh token by JTI. Used for logout from current device.';

-- Check if token is revoked
CREATE OR REPLACE FUNCTION acl.is_token_revoked(p_jti UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1
        FROM acl.refresh_tokens
        WHERE jti = p_jti
          AND revoked_at IS NOT NULL
    );
$$;

COMMENT ON FUNCTION acl.is_token_revoked IS
'Checks if a refresh token has been revoked. Returns TRUE if revoked, FALSE if active or not found.';

-- Check if token exists and is valid
CREATE OR REPLACE FUNCTION acl.is_token_valid(p_jti UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1
        FROM acl.refresh_tokens
        WHERE jti = p_jti
          AND revoked_at IS NULL
          AND expires_at > now()
    );
$$;

COMMENT ON FUNCTION acl.is_token_valid IS
'Checks if a refresh token is valid (exists, not revoked, not expired).';

-- Clean expired/revoked tokens (maintenance)
CREATE OR REPLACE FUNCTION acl.cleanup_expired_tokens()
RETURNS INTEGER
LANGUAGE sql AS $$
    WITH deleted AS (
        DELETE FROM acl.refresh_tokens
        WHERE expires_at < now() - INTERVAL '30 days'
           OR (revoked_at IS NOT NULL AND revoked_at < now() - INTERVAL '30 days')
        RETURNING 1
    )
    SELECT COUNT(*)::INTEGER FROM deleted;
$$;

COMMENT ON FUNCTION acl.cleanup_expired_tokens IS
'Removes expired and revoked tokens older than 30 days. Should be run periodically via cron.';

-- Determine PostgreSQL role for a principal (for pgSettings mapping)
CREATE OR REPLACE FUNCTION acl.get_db_role(p_principal_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT CASE
        -- Admin users get app_admin role
        WHEN EXISTS (
            SELECT 1 FROM acl.tuples t
            WHERE t.principal_id = p_principal_id
              AND t.relation = 'owner'
              AND t.resource_type = 'system'
        ) THEN 'app_admin'

        -- Employees and services get app_user role
        WHEN EXISTS (
            SELECT 1 FROM acl.principals p
            WHERE p.id = p_principal_id
              AND p.kind IN ('employee', 'service')
        ) THEN 'app_user'

        -- Customers get app_user role
        WHEN EXISTS (
            SELECT 1 FROM acl.principals p
            WHERE p.id = p_principal_id
              AND p.kind = 'customer'
        ) THEN 'app_user'

        -- Default to app_readonly for unknown/group principals
        ELSE 'app_readonly'
    END;
$$;

COMMENT ON FUNCTION acl.get_db_role IS
'Maps a principal to a PostgreSQL database role for pgSettings. This enables stateless GraphQL transport while enforcing RLS via role switching.';

-- Get principal details for JWT generation
CREATE OR REPLACE FUNCTION acl.get_principal_details(p_principal_id UUID)
RETURNS TABLE(
    principal_id UUID,
    email CITEXT,
    kind acl.principal_kind,
    display_name TEXT,
    db_role TEXT,
    email_verified BOOLEAN
)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
    SELECT
        p.id,
        c.email,
        p.kind,
        p.display_name,
        acl.get_db_role(p.id),
        c.email_verified
    FROM acl.principals p
    JOIN acl.user_credentials c ON c.principal_id = p.id
    WHERE p.id = p_principal_id;
$$;

COMMENT ON FUNCTION acl.get_principal_details IS
'Returns principal details needed for JWT generation. Used after successful authentication.';

-- Create principal with password credentials (registration)
CREATE OR REPLACE FUNCTION acl.create_principal_with_password(
    p_email CITEXT,
    p_password_hash TEXT,
    p_kind acl.principal_kind DEFAULT 'customer',
    p_display_name TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_principal_id UUID;
BEGIN
    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM acl.user_credentials WHERE email = p_email) THEN
        RAISE EXCEPTION 'Email already registered';
    END IF;

    -- Create principal
    INSERT INTO acl.principals(kind, external_id, display_name)
    VALUES (
        p_kind,
        'email:' || p_email,
        COALESCE(p_display_name, p_email)
    )
    RETURNING id INTO v_principal_id;

    -- Create credentials
    INSERT INTO acl.user_credentials(principal_id, email, password_hash, email_verified)
    VALUES (v_principal_id, p_email, p_password_hash, FALSE);

    RETURN v_principal_id;
END;
$$;

COMMENT ON FUNCTION acl.create_principal_with_password IS
'Creates a new principal with password credentials. Used for user registration. Raises exception if email already exists.';

-- Update password
CREATE OR REPLACE FUNCTION acl.update_password(
    p_principal_id UUID,
    p_new_password_hash TEXT
) RETURNS VOID
LANGUAGE sql AS $$
    UPDATE acl.user_credentials
    SET password_hash = p_new_password_hash,
        updated_at = now()
    WHERE principal_id = p_principal_id;
$$;

COMMENT ON FUNCTION acl.update_password IS
'Updates password hash for a principal. Used for password reset/change functionality.';

-- Mark email as verified
CREATE OR REPLACE FUNCTION acl.verify_email(p_principal_id UUID)
RETURNS VOID
LANGUAGE sql AS $$
    UPDATE acl.user_credentials
    SET email_verified = TRUE,
        updated_at = now()
    WHERE principal_id = p_principal_id;
$$;

COMMENT ON FUNCTION acl.verify_email IS
'Marks email as verified for a principal. Used after email verification flow.';

-- Grant execute permissions to application roles
GRANT EXECUTE ON FUNCTION acl.find_principal_by_email TO app_user, app_readonly, app_admin;
GRANT EXECUTE ON FUNCTION acl.get_password_hash TO app_user, app_admin;
GRANT EXECUTE ON FUNCTION acl.upsert_oauth_identity TO app_user, app_admin;
GRANT EXECUTE ON FUNCTION acl.revoke_principal_tokens TO app_user, app_admin;
GRANT EXECUTE ON FUNCTION acl.revoke_token TO app_user, app_admin;
GRANT EXECUTE ON FUNCTION acl.is_token_revoked TO app_user, app_readonly, app_admin;
GRANT EXECUTE ON FUNCTION acl.is_token_valid TO app_user, app_readonly, app_admin;
GRANT EXECUTE ON FUNCTION acl.cleanup_expired_tokens TO app_admin;
GRANT EXECUTE ON FUNCTION acl.get_db_role TO app_user, app_readonly, app_admin;
GRANT EXECUTE ON FUNCTION acl.get_principal_details TO app_user, app_readonly, app_admin;
GRANT EXECUTE ON FUNCTION acl.create_principal_with_password TO app_user, app_admin;
GRANT EXECUTE ON FUNCTION acl.update_password TO app_user, app_admin;
GRANT EXECUTE ON FUNCTION acl.verify_email TO app_user, app_admin;

COMMIT;
