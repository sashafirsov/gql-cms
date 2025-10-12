-- Description: Row-Level Security (RLS) policies for a simple CMS with ACLs
-- === Helpers ================================================================

-- Global-role check for the current actor
CREATE OR REPLACE FUNCTION app.has_global_role(role_name text)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.user_roles ur
    WHERE ur.user_id = app.current_user_id() AND ur.role_name = $1
  )
$$;

-- Is current actor owner/manager of a document?
CREATE OR REPLACE FUNCTION app.has_doc_role(doc_id uuid, roles text[])
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.document_acl a
    WHERE a.document_id = doc_id
      AND a.user_id = app.current_user_id()
      AND a.role_name = ANY($2)
  )
$$;

-- === Triggers to set "owner" automatically ==================================

-- When a document is created, give the actor owner on that document
CREATE OR REPLACE FUNCTION app.tg_document_after_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_actor uuid := app.current_user_id();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'app.user_id not set for this session; cannot assign document owner';
  END IF;

  INSERT INTO app.document_acl(document_id, user_id, role_name)
  VALUES (NEW.id, v_actor, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_set_owner ON app.documents;
CREATE TRIGGER trg_document_set_owner
AFTER INSERT ON app.documents
FOR EACH ROW EXECUTE FUNCTION app.tg_document_after_insert();

-- When a user is created, grant them owner on their own user record
CREATE OR REPLACE FUNCTION app.tg_user_after_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO app.user_acl(target_user_id, user_id, role_name)
  VALUES (NEW.id, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_set_self_owner ON app.users;
CREATE TRIGGER trg_user_set_self_owner
AFTER INSERT ON app.users
FOR EACH ROW EXECUTE FUNCTION app.tg_user_after_insert();

-- === Row-Level Security Policies ============================================

-- Enable RLS
ALTER TABLE app.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_roles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.document_acl ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_acl     ENABLE ROW LEVEL SECURITY;

-- ---- USERS table ------------------------------------------------------------
-- Read your own user row; managers/admins can read all.
DROP POLICY IF EXISTS users_select ON app.users;
CREATE POLICY users_select ON app.users
FOR SELECT
USING (
  id = app.current_user_id()
  OR app.has_global_role('manager')
  OR app.has_global_role('admin')
);

-- Insert: authorizer can create users; manager/admin can too.
DROP POLICY IF EXISTS users_insert ON app.users;
CREATE POLICY users_insert ON app.users
FOR INSERT
WITH CHECK (
  app.has_global_role('authorizer')
  OR app.has_global_role('manager')
  OR app.has_global_role('admin')
);

-- Update/Delete: self via owner on own record; manager/admin can CRUD.
DROP POLICY IF EXISTS users_update ON app.users;
CREATE POLICY users_update ON app.users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM app.user_acl ua
    WHERE ua.target_user_id = app.users.id
      AND ua.user_id = app.current_user_id()
      AND ua.role_name = 'owner'
  )
  OR app.has_global_role('manager')
  OR app.has_global_role('admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM app.user_acl ua
    WHERE ua.target_user_id = app.users.id
      AND ua.user_id = app.current_user_id()
      AND ua.role_name = 'owner'
  )
  OR app.has_global_role('manager')
  OR app.has_global_role('admin')
);

DROP POLICY IF EXISTS users_delete ON app.users;
CREATE POLICY users_delete ON app.users
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM app.user_acl ua
    WHERE ua.target_user_id = app.users.id
      AND ua.user_id = app.current_user_id()
      AND ua.role_name = 'owner'
  )
  OR app.has_global_role('manager')
  OR app.has_global_role('admin')
);

-- ---- USER_ROLES table -------------------------------------------------------
-- Only manager/admin can view/modify user role assignments.
DROP POLICY IF EXISTS user_roles_select ON app.user_roles;
CREATE POLICY user_roles_select ON app.user_roles
FOR SELECT USING (app.has_global_role('manager') OR app.has_global_role('admin'));

DROP POLICY IF EXISTS user_roles_modify ON app.user_roles;
CREATE POLICY user_roles_modify ON app.user_roles
FOR ALL
USING (app.has_global_role('manager') OR app.has_global_role('admin'))
WITH CHECK (app.has_global_role('manager') OR app.has_global_role('admin'));

-- ---- DOCUMENTS table --------------------------------------------------------
-- SELECT: owner/manager on that doc, any global manager/admin, or global bot can read ALL docs.
DROP POLICY IF EXISTS documents_select ON app.documents;
CREATE POLICY documents_select ON app.documents
FOR SELECT
USING (
  app.has_doc_role(id, ARRAY['owner','manager'])
  OR app.has_global_role('manager')
  OR app.has_global_role('admin')
  OR app.has_global_role('bot')
);

-- INSERT: any authenticated user EXCEPT an authorizer-only account.
-- (Managers/admins can insert too.)
DROP POLICY IF EXISTS documents_insert ON app.documents;
CREATE POLICY documents_insert ON app.documents
FOR INSERT
WITH CHECK (
  -- block pure 'authorizer' from creating documents
  (NOT app.has_global_role('authorizer'))
  OR app.has_global_role('manager')
  OR app.has_global_role('admin')
);

-- UPDATE/DELETE: owner/manager of the doc, or global manager/admin.
DROP POLICY IF EXISTS documents_update ON app.documents;
CREATE POLICY documents_update ON app.documents
FOR UPDATE
USING (
  app.has_doc_role(id, ARRAY['owner','manager'])
  OR app.has_global_role('manager')
  OR app.has_global_role('admin')
)
WITH CHECK (
  app.has_doc_role(id, ARRAY['owner','manager'])
  OR app.has_global_role('manager')
  OR app.has_global_role('admin')
);

DROP POLICY IF EXISTS documents_delete ON app.documents;
CREATE POLICY documents_delete ON app.documents
FOR DELETE
USING (
  app.has_doc_role(id, ARRAY['owner','manager'])
  OR app.has_global_role('manager')
  OR app.has_global_role('admin')
);

-- ---- DOCUMENT_ACL table -----------------------------------------------------
-- Let owners/managers of a document (and global manager/admin) manage that doc's ACL.
DROP POLICY IF EXISTS document_acl_select ON app.document_acl;
CREATE POLICY document_acl_select ON app.document_acl
FOR SELECT
USING (
  app.has_global_role('manager') OR app.has_global_role('admin')
  OR app.has_doc_role(document_id, ARRAY['owner','manager'])
);

DROP POLICY IF EXISTS document_acl_modify ON app.document_acl;
CREATE POLICY document_acl_modify ON app.document_acl
FOR ALL
USING (
  app.has_global_role('manager') OR app.has_global_role('admin')
  OR app.has_doc_role(document_id, ARRAY['owner','manager'])
)
WITH CHECK (
  app.has_global_role('manager') OR app.has_global_role('admin')
  OR app.has_doc_role(document_id, ARRAY['owner','manager'])
);

-- ---- USER_ACL table ---------------------------------------------------------
-- Only manager/admin (or the subject themselves reading) can see user ACL;
-- modification is restricted to manager/admin.
DROP POLICY IF EXISTS user_acl_select ON app.user_acl;
CREATE POLICY user_acl_select ON app.user_acl
FOR SELECT
USING (
  app.has_global_role('manager') OR app.has_global_role('admin')
  OR app.current_user_id() = target_user_id  -- user can see their own ACL row
);

DROP POLICY IF EXISTS user_acl_modify ON app.user_acl;
CREATE POLICY user_acl_modify ON app.user_acl
FOR ALL
USING (app.has_global_role('manager') OR app.has_global_role('admin'))
WITH CHECK (app.has_global_role('manager') OR app.has_global_role('admin'));

-- === Grants (example: one application DB role) ===============================
-- Create a single DB role used by your app and let RLS do the filtering.
-- CREATE ROLE app_client NOINHERIT LOGIN PASSWORD '***';  -- (optional)
GRANT USAGE ON SCHEMA app TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  app.users, app.user_roles, app.documents, app.document_acl, app.user_acl
TO PUBLIC;  -- rely on RLS; tighten to your app role in production
