-- 91-northwind-auth-seed.sql
-- Seed authentication data for Northwind ACL system
-- Must run after 85-northwind-auth-schema.sql (creates tables) and 90-northwind-auth-functions.sql

BEGIN;

-- ---------- Manager User for UI Login ----------
-- Seed manager user for web app authentication
-- Password: Manager123#
-- Hash generated with: argon2.hash('Manager123#', {type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4})

-- Create principal
INSERT INTO acl.principals(kind, external_id, display_name)
VALUES (
  'employee',
  'email:manager@example.com',
  'Manager User'
) ON CONFLICT (external_id) DO NOTHING;

-- Create credentials
INSERT INTO acl.user_credentials(principal_id, email, password_hash, email_verified)
SELECT
  p.id,
  'manager@example.com',
  '$argon2id$v=19$m=65536,t=3,p=4$SPyg2gc+TtNEkV1ilKNwFg$R/sQiWwOHegOmQPlv2qs/j+2X0CYs5O0K5ZQrFYNEuk',
  true
FROM acl.principals p
WHERE p.external_id = 'email:manager@example.com'
ON CONFLICT (email) DO NOTHING;

-- Sync to gql_cms schema with same UUID (for RLS policies)
INSERT INTO gql_cms.users (id, email, auth_provider, full_name, email_verified)
SELECT
  p.id,
  'manager@example.com',
  'local',
  p.display_name,
  true
FROM acl.principals p
WHERE p.external_id = 'email:manager@example.com'
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  email_verified = EXCLUDED.email_verified;

-- Assign manager role in gql_cms
INSERT INTO gql_cms.user_roles(user_id, role_name)
SELECT p.id, 'manager'
FROM acl.principals p
WHERE p.external_id = 'email:manager@example.com'
ON CONFLICT DO NOTHING;

-- Grant owner permission to manager for their own user record
INSERT INTO gql_cms.user_acl(target_user_id, user_id, role_name)
SELECT p.id, p.id, 'owner'
FROM acl.principals p
WHERE p.external_id = 'email:manager@example.com'
ON CONFLICT DO NOTHING;

COMMIT;
