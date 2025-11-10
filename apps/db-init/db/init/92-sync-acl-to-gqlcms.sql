-- 92-sync-acl-to-gqlcms.sql
-- Sync acl.principals to gql_cms.users automatically
-- When a principal is created in acl schema, also create them in gql_cms schema

BEGIN;

-- Function to sync principal to gql_cms.users
-- Triggered when a user_credentials row is created (not when principal is created)
CREATE OR REPLACE FUNCTION acl.sync_user_credentials_to_gqlcms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_principal RECORD;
BEGIN
  -- Get principal details
  SELECT id, display_name, kind INTO v_principal
  FROM acl.principals
  WHERE id = NEW.principal_id;

  -- Insert into gql_cms.users with the same UUID
  INSERT INTO gql_cms.users (id, email, auth_provider, full_name, email_verified)
  VALUES (
    NEW.principal_id,
    NEW.email,
    'local',
    v_principal.display_name,
    NEW.email_verified
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    email_verified = EXCLUDED.email_verified;

  RETURN NEW;
END;
$$;

-- Create trigger on acl.user_credentials (not principals)
-- This ensures only users with credentials (actual registered users) get synced
DROP TRIGGER IF EXISTS trg_sync_user_credentials_to_gqlcms ON acl.user_credentials;
CREATE TRIGGER trg_sync_user_credentials_to_gqlcms
AFTER INSERT ON acl.user_credentials
FOR EACH ROW
EXECUTE FUNCTION acl.sync_user_credentials_to_gqlcms();

-- Sync existing users with credentials that aren't in gql_cms.users yet
INSERT INTO gql_cms.users (id, email, auth_provider, full_name, email_verified)
SELECT
  p.id,
  uc.email,
  'local' as auth_provider,
  p.display_name as full_name,
  uc.email_verified
FROM acl.principals p
INNER JOIN acl.user_credentials uc ON uc.principal_id = p.id
WHERE NOT EXISTS (SELECT 1 FROM gql_cms.users u WHERE u.id = p.id)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  email_verified = EXCLUDED.email_verified;

COMMIT;
