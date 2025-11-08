-- Create authenticator role for PostGraphile
-- This role can switch between the application roles (anonymous, app_user, etc.)
-- It should not have direct privileges but can SET ROLE to other roles

CREATE ROLE gql_cms_authenticator WITH LOGIN PASSWORD 'app_password';

-- Grant the ability to switch to these roles
GRANT anonymous, app_user, app_admin, app_readonly TO gql_cms_authenticator;

-- Grant schema usage
GRANT USAGE ON SCHEMA gql_cms TO gql_cms_authenticator;
GRANT USAGE ON SCHEMA acl TO gql_cms_authenticator;

-- Grant table permissions (these will be filtered by RLS when using SET ROLE)
GRANT ALL ON ALL TABLES IN SCHEMA gql_cms TO gql_cms_authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA gql_cms TO gql_cms_authenticator;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA gql_cms TO gql_cms_authenticator;

GRANT ALL ON ALL TABLES IN SCHEMA acl TO gql_cms_authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA acl TO gql_cms_authenticator;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA acl TO gql_cms_authenticator;

-- Grant default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA gql_cms GRANT ALL ON TABLES TO gql_cms_authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA gql_cms GRANT ALL ON SEQUENCES TO gql_cms_authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA gql_cms GRANT ALL ON FUNCTIONS TO gql_cms_authenticator;

ALTER DEFAULT PRIVILEGES IN SCHEMA acl GRANT ALL ON TABLES TO gql_cms_authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA acl GRANT ALL ON SEQUENCES TO gql_cms_authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA acl GRANT ALL ON FUNCTIONS TO gql_cms_authenticator;
