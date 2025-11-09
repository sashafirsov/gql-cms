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

COMMIT;
