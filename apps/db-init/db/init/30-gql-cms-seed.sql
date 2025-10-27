-- Seed an initial admin user to bootstrap:
-- Temporarily disable RLS on all tables for initial bootstrap
ALTER TABLE gql_cms.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE gql_cms.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE gql_cms.user_acl DISABLE ROW LEVEL SECURITY;

-- Seed an initial admin user to bootstrap:
INSERT INTO gql_cms.users (email, auth_provider, full_name) VALUES ('admin@example.com','local','Admin');

-- The trigger trg_user_set_self_owner will automatically create the user_acl entry

-- Assign admin role
INSERT INTO gql_cms.user_roles(user_id, role_name)
VALUES ((SELECT id FROM gql_cms.users WHERE email = 'admin@example.com'),'admin');
-- Note: user_acl owner entry is automatically created by trg_user_set_self_owner trigger

-- Re-enable RLS on all tables
ALTER TABLE gql_cms.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE gql_cms.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gql_cms.user_acl ENABLE ROW LEVEL SECURITY;
