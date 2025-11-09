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
INSERT INTO gql_cms.users (email, auth_provider, full_name, password_hash, email_verified)
VALUES (
  'manager@example.com',
  'local',
  'Manager User',
  '$argon2id$v=19$m=65536,t=3,p=4$SPyg2gc+TtNEkV1ilKNwFg$R/sQiWwOHegOmQPlv2qs/j+2X0CYs5O0K5ZQrFYNEuk',
  true
) ON CONFLICT (email) DO NOTHING;

-- Assign manager role
INSERT INTO gql_cms.user_roles(user_id, role_name)
VALUES (
  (SELECT id FROM gql_cms.users WHERE email = 'manager@example.com'),
  'manager'
) ON CONFLICT DO NOTHING;

-- Grant owner permission to manager for their own user record
INSERT INTO gql_cms.user_acl(target_user_id, user_id, role_name)
VALUES (
  (SELECT id FROM gql_cms.users WHERE email = 'manager@example.com'),
  (SELECT id FROM gql_cms.users WHERE email = 'manager@example.com'),
  'owner'
) ON CONFLICT DO NOTHING;
