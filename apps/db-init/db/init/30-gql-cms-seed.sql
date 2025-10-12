-- Seed an initial admin user to bootstrap:
-- Temporarily disable RLS on all tables for initial bootstrap
ALTER TABLE app.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_acl DISABLE ROW LEVEL SECURITY;

-- Seed an initial admin user to bootstrap:
INSERT INTO app.users (email, auth_provider, full_name) VALUES ('admin@example.com','local','Admin');

-- The trigger trg_user_set_self_owner will automatically create the user_acl entry

-- Assign admin role
INSERT INTO app.user_roles(user_id, role_name)
VALUES ((SELECT id FROM app.users WHERE email = 'admin@example.com'),'admin');
INSERT INTO app.user_acl(target_user_id, user_id, role_name)
  VALUES ((SELECT id FROM app.users WHERE email = 'admin@example.com'), (SELECT id FROM app.users WHERE email = 'admin@example.com'), 'owner');

-- Re-enable RLS on all tables
ALTER TABLE app.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_acl ENABLE ROW LEVEL SECURITY;
