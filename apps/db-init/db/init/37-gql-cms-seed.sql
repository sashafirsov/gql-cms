-- -- Seed an initial admin user to bootstrap:
-- INSERT INTO gql_cms.users (email, auth_provider, full_name) VALUES ('admin@example.com','local','Admin') RETURNING id;
-- -- Assign admin role
-- INSERT INTO gql_cms.user_roles(user_id, role_name)
-- VALUES ((SELECT id FROM gql_cms.users WHERE email = 'admin@example.com'),'admin');
--
-- INSERT INTO gql_cms.user_acl(target_user_id, user_id, role_name)
--   VALUES ((SELECT id FROM gql_cms.users WHERE email = 'admin@example.com'), (SELECT id FROM gql_cms.users WHERE email = 'admin@example.com'), 'owner');

-- Seed manager user for analytics access
-- Password: Manager123#
-- Hash generated with: argon2.hash('Manager123#', {type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4})
-- IMPORTANT: Use the same UUID as the principal in acl.principals to ensure RLS policies work correctly
INSERT INTO gql_cms.users (id, email, auth_provider, full_name, password_hash, email_verified)
SELECT
  p.id,  -- Use the same UUID from acl.principals
  'manager@example.com',
  'local',
  'Manager User',
  '$argon2id$v=19$m=65536,t=3,p=4$SPyg2gc+TtNEkV1ilKNwFg$R/sQiWwOHegOmQPlv2qs/j+2X0CYs5O0K5ZQrFYNEuk',
  true
FROM acl.principals p
WHERE p.external_id = 'email:manager@example.com'
ON CONFLICT (email) DO UPDATE SET
  id = EXCLUDED.id,  -- Update UUID if email already exists
  password_hash = EXCLUDED.password_hash,
  email_verified = EXCLUDED.email_verified;

-- Assign manager role
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
