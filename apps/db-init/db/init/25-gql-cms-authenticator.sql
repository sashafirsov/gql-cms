-- Create authenticator role for PostGraphile
-- This role can switch between the application roles (anonymous, app_user, etc.)
-- It should not have direct privileges but can SET ROLE to other roles

-- Create application roles if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anonymous') THEN
    CREATE ROLE anonymous;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin') THEN
    CREATE ROLE app_admin NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_readonly') THEN
    CREATE ROLE app_readonly NOINHERIT;
  END IF;
END $$;

-- Grant schema usage to application roles
GRANT USAGE ON SCHEMA gql_cms TO anonymous;
GRANT USAGE ON SCHEMA gql_cms TO app_user;
GRANT USAGE ON SCHEMA gql_cms TO app_admin;
GRANT USAGE ON SCHEMA gql_cms TO app_readonly;

CREATE ROLE gql_cms_authenticator WITH LOGIN PASSWORD 'app_password';

-- Grant the ability to switch to these roles
GRANT anonymous, app_user, app_admin, app_readonly TO gql_cms_authenticator;

-- Grant schema usage
GRANT USAGE ON SCHEMA gql_cms TO gql_cms_authenticator;
-- Grant usage on acl schema if it exists (created later in northwind setup)
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = 'acl') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA acl TO gql_cms_authenticator';
  END IF;
END $$;

-- Grant table permissions (these will be filtered by RLS when using SET ROLE)
GRANT ALL ON ALL TABLES IN SCHEMA gql_cms TO gql_cms_authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA gql_cms TO gql_cms_authenticator;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA gql_cms TO gql_cms_authenticator;

-- Grant default privileges for future objects in gql_cms schema
ALTER DEFAULT PRIVILEGES IN SCHEMA gql_cms GRANT ALL ON TABLES TO gql_cms_authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA gql_cms GRANT ALL ON SEQUENCES TO gql_cms_authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA gql_cms GRANT ALL ON FUNCTIONS TO gql_cms_authenticator;

-- Grant permissions on acl schema if it exists (handled later in northwind setup at 85-northwind-auth-schema.sql)
