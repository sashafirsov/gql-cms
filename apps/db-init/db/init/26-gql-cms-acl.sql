-- Description: Row-Level Security (RLS) policies for a simple CMS with ACLs
-- === Helpers ================================================================

-- Global-role check for the current actor
CREATE OR REPLACE FUNCTION gql_cms.has_global_role(role_name text)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM gql_cms.user_roles ur
    WHERE ur.user_id = gql_cms.current_user_id() AND ur.role_name = $1
  )
$$;

-- Is current actor owner/manager of a document?
CREATE OR REPLACE FUNCTION gql_cms.has_doc_role(doc_id uuid, roles text[])
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM gql_cms.document_acl a
    WHERE a.document_id = doc_id
      AND a.user_id = gql_cms.current_user_id()
      AND a.role_name = ANY($2)
  )
$$;

-- === Triggers to set "owner" automatically ==================================

-- When a document is created, give the actor owner on that document
-- Anonymous users (v_actor IS NULL) can create documents without ownership
CREATE OR REPLACE FUNCTION gql_cms.tg_document_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- Run as function owner to bypass RLS
AS $$
DECLARE v_actor uuid := gql_cms.current_user_id();
BEGIN
  -- Only set owner if user is authenticated
  -- Anonymous users can create documents without ownership
  IF v_actor IS NOT NULL THEN
    INSERT INTO gql_cms.document_acl(document_id, user_id, role_name)
    VALUES (NEW.id, v_actor, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_set_owner ON gql_cms.documents;
CREATE TRIGGER trg_document_set_owner
AFTER INSERT ON gql_cms.documents
FOR EACH ROW EXECUTE FUNCTION gql_cms.tg_document_after_insert();

-- When a user is created, grant them owner on their own user record
CREATE OR REPLACE FUNCTION gql_cms.tg_user_after_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO gql_cms.user_acl(target_user_id, user_id, role_name)
  VALUES (NEW.id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_set_self_owner ON gql_cms.users;
CREATE TRIGGER trg_user_set_self_owner
AFTER INSERT ON gql_cms.users
FOR EACH ROW EXECUTE FUNCTION gql_cms.tg_user_after_insert();

-- === Row-Level Security Policies ============================================

-- Enable RLS
ALTER TABLE gql_cms.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gql_cms.user_roles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gql_cms.documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE gql_cms.document_acl ENABLE ROW LEVEL SECURITY;
ALTER TABLE gql_cms.user_acl     ENABLE ROW LEVEL SECURITY;

-- ---- USERS table ------------------------------------------------------------
-- Read your own user row; managers/admins can read all.
DROP POLICY IF EXISTS users_select ON gql_cms.users;
CREATE POLICY users_select ON gql_cms.users
FOR SELECT
USING (
  id = gql_cms.current_user_id()
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
);

-- Insert: authorizer can create users; manager/admin can too.
DROP POLICY IF EXISTS users_insert ON gql_cms.users;
CREATE POLICY users_insert ON gql_cms.users
FOR INSERT
WITH CHECK (
  gql_cms.has_global_role('authorizer')
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
);

-- Update/Delete: self via owner on own record; manager/admin can CRUD.
DROP POLICY IF EXISTS users_update ON gql_cms.users;
CREATE POLICY users_update ON gql_cms.users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM gql_cms.user_acl ua
    WHERE ua.target_user_id = gql_cms.users.id
      AND ua.user_id = gql_cms.current_user_id()
      AND ua.role_name = 'owner'
  )
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM gql_cms.user_acl ua
    WHERE ua.target_user_id = gql_cms.users.id
      AND ua.user_id = gql_cms.current_user_id()
      AND ua.role_name = 'owner'
  )
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
);

DROP POLICY IF EXISTS users_delete ON gql_cms.users;
CREATE POLICY users_delete ON gql_cms.users
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM gql_cms.user_acl ua
    WHERE ua.target_user_id = gql_cms.users.id
      AND ua.user_id = gql_cms.current_user_id()
      AND ua.role_name = 'owner'
  )
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
);

-- ---- USER_ROLES table -------------------------------------------------------
-- Allow SELECT for all to avoid infinite recursion (has_global_role queries this table)
-- Only manager/admin can modify user role assignments.
DROP POLICY IF EXISTS user_roles_select ON gql_cms.user_roles;
CREATE POLICY user_roles_select ON gql_cms.user_roles
FOR SELECT USING (true);

DROP POLICY IF EXISTS user_roles_modify ON gql_cms.user_roles;
CREATE POLICY user_roles_modify ON gql_cms.user_roles
FOR ALL
USING (gql_cms.has_global_role('manager') OR gql_cms.has_global_role('admin'))
WITH CHECK (gql_cms.has_global_role('manager') OR gql_cms.has_global_role('admin'));

-- ---- DOCUMENTS table --------------------------------------------------------
-- SELECT: owner/manager on that doc, any global manager/admin, or global bot can read ALL docs.
-- Note: Separate policies for NOINHERIT roles
DROP POLICY IF EXISTS documents_select ON gql_cms.documents;
CREATE POLICY documents_select ON gql_cms.documents
FOR SELECT
TO PUBLIC
USING (
  gql_cms.has_doc_role(id, ARRAY['owner','manager'])
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
  OR gql_cms.has_global_role('bot')
);

CREATE POLICY documents_select_app_user ON gql_cms.documents
FOR SELECT
TO app_user
USING (
  gql_cms.has_doc_role(id, ARRAY['owner','manager'])
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
  OR gql_cms.has_global_role('bot')
  -- Allow seeing documents with no ACL yet (for RETURNING clause after INSERT)
  OR NOT EXISTS (SELECT 1 FROM gql_cms.document_acl WHERE document_id = gql_cms.documents.id)
);

CREATE POLICY documents_select_authenticator ON gql_cms.documents
FOR SELECT
TO gql_cms_authenticator
USING (
  gql_cms.has_doc_role(id, ARRAY['owner','manager'])
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
  OR gql_cms.has_global_role('bot')
  -- Allow seeing documents with no ACL yet (for RETURNING clause after INSERT)
  OR NOT EXISTS (SELECT 1 FROM gql_cms.document_acl WHERE document_id = gql_cms.documents.id)
);

-- INSERT: Allow anyone (including anonymous users) to create documents
-- This is needed for the URL shortener functionality
-- Note: We need separate policies for each role because app_user has NOINHERIT
DROP POLICY IF EXISTS documents_insert ON gql_cms.documents;
CREATE POLICY documents_insert ON gql_cms.documents
FOR INSERT
TO PUBLIC
WITH CHECK (true);

CREATE POLICY documents_insert_app_user ON gql_cms.documents
FOR INSERT
TO app_user
WITH CHECK (true);

CREATE POLICY documents_insert_authenticator ON gql_cms.documents
FOR INSERT
TO gql_cms_authenticator
WITH CHECK (true);

-- UPDATE/DELETE: owner/manager of the doc, or global manager/admin.
DROP POLICY IF EXISTS documents_update ON gql_cms.documents;
CREATE POLICY documents_update ON gql_cms.documents
FOR UPDATE
USING (
  gql_cms.has_doc_role(id, ARRAY['owner','manager'])
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
)
WITH CHECK (
  gql_cms.has_doc_role(id, ARRAY['owner','manager'])
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
);

DROP POLICY IF EXISTS documents_delete ON gql_cms.documents;
CREATE POLICY documents_delete ON gql_cms.documents
FOR DELETE
USING (
  gql_cms.has_doc_role(id, ARRAY['owner','manager'])
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
);

-- ---- DOCUMENT_ACL table -----------------------------------------------------
-- Let owners/managers of a document (and global manager/admin) manage that doc's ACL.
-- NOTE: Use simple policies to avoid recursion - managers/admins only for modification
DROP POLICY IF EXISTS document_acl_select ON gql_cms.document_acl;
CREATE POLICY document_acl_select ON gql_cms.document_acl
FOR SELECT
USING (
  gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('admin')
  OR user_id = gql_cms.current_user_id()  -- Users can see their own ACL entries
);

DROP POLICY IF EXISTS document_acl_modify ON gql_cms.document_acl;
CREATE POLICY document_acl_modify ON gql_cms.document_acl
FOR ALL
USING (
  gql_cms.has_global_role('manager') OR gql_cms.has_global_role('admin')
)
WITH CHECK (
  gql_cms.has_global_role('manager') OR gql_cms.has_global_role('admin')
);

-- ---- USER_ACL table ---------------------------------------------------------
-- Only manager/admin (or the subject themselves reading) can see user ACL;
-- modification is restricted to manager/admin.
DROP POLICY IF EXISTS user_acl_select ON gql_cms.user_acl;
CREATE POLICY user_acl_select ON gql_cms.user_acl
FOR SELECT
USING (
  gql_cms.has_global_role('manager') OR gql_cms.has_global_role('admin')
  OR gql_cms.current_user_id() = target_user_id  -- user can see their own ACL row
);

DROP POLICY IF EXISTS user_acl_modify ON gql_cms.user_acl;
CREATE POLICY user_acl_modify ON gql_cms.user_acl
FOR ALL
USING (gql_cms.has_global_role('manager') OR gql_cms.has_global_role('admin'))
WITH CHECK (gql_cms.has_global_role('manager') OR gql_cms.has_global_role('admin'));

-- === Grants (example: one application DB role) ===============================
-- Create a single DB role used by your app and let RLS do the filtering.
-- CREATE ROLE app_client NOINHERIT LOGIN PASSWORD '***';  -- (optional)
GRANT USAGE ON SCHEMA gql_cms TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  gql_cms.users, gql_cms.user_roles, gql_cms.documents, gql_cms.document_acl, gql_cms.user_acl
TO PUBLIC;  -- rely on RLS; tighten to your app role in production

-- Explicit grants for NOINHERIT roles (app_user, app_admin, etc)
GRANT USAGE ON SCHEMA gql_cms TO app_user, app_admin, app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  gql_cms.users, gql_cms.user_roles, gql_cms.documents, gql_cms.document_acl, gql_cms.user_acl
TO app_user, app_admin;
GRANT SELECT ON
  gql_cms.users, gql_cms.user_roles, gql_cms.documents, gql_cms.document_acl, gql_cms.user_acl
TO app_readonly;
