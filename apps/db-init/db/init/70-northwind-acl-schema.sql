-- 70-northwind-acl-schema.sql
-- ReBAC (relationship-based access control) with Row-Level Security for Northwind

-- Requirements:
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()

BEGIN;

CREATE SCHEMA IF NOT EXISTS acl;

-- ---------- Types ----------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'principal_kind') THEN
        CREATE TYPE acl.principal_kind AS ENUM ('employee','customer','supplier','service','group');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission') THEN
        CREATE TYPE acl.permission AS ENUM ('read','write','manage','create');
    END IF;
END$$;

-- ---------- Principals (users, groups, services) ----------
CREATE TABLE IF NOT EXISTS acl.principals (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind          acl.principal_kind NOT NULL,
    external_id   TEXT UNIQUE,                  -- e.g. 'employee:1' / 'customer:ALFKI'
    display_name  TEXT
);

-- Group membership (principal ∈ group)
CREATE TABLE IF NOT EXISTS acl.principal_memberships (
    member_id   UUID NOT NULL REFERENCES acl.principals(id) ON DELETE CASCADE,
    group_id    UUID NOT NULL REFERENCES acl.principals(id) ON DELETE CASCADE,
    PRIMARY KEY(member_id, group_id)
);

-- ---------- Resource catalog ----------
-- Resource type registry
CREATE TABLE IF NOT EXISTS acl.resource_types (
    name TEXT PRIMARY KEY  -- e.g., 'customer', 'order', 'order_detail', 'product'
);

-- Canonical object addresses: (type, pk-as-text)
CREATE TABLE IF NOT EXISTS acl.objects (
    resource_type TEXT NOT NULL REFERENCES acl.resource_types(name) ON DELETE CASCADE,
    resource_pk   TEXT NOT NULL,
    -- optional metadata
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(resource_type, resource_pk)
);

-- Containment edges (child ⟶ parent), enables ancestor checks (order ⟶ customer, detail ⟶ order)
CREATE TABLE IF NOT EXISTS acl.object_edges (
    child_type   TEXT NOT NULL,
    child_pk     TEXT NOT NULL,
    parent_type  TEXT NOT NULL,
    parent_pk    TEXT NOT NULL,
    PRIMARY KEY(child_type, child_pk, parent_type, parent_pk),
    FOREIGN KEY (child_type, child_pk)  REFERENCES acl.objects(resource_type, resource_pk) ON DELETE CASCADE,
    FOREIGN KEY (parent_type, parent_pk)REFERENCES acl.objects(resource_type, resource_pk) ON DELETE CASCADE
);

-- ---------- Relations & permissions ----------
-- Named relations (e.g., owner, manager, editor, viewer, sales_rep, customer_self)
CREATE TABLE IF NOT EXISTS acl.relations (
    name TEXT PRIMARY KEY
);

-- Which permissions each relation implies
CREATE TABLE IF NOT EXISTS acl.relation_permissions (
    relation   TEXT NOT NULL REFERENCES acl.relations(name) ON DELETE CASCADE,
    permission acl.permission NOT NULL,
    PRIMARY KEY(relation, permission)
);

-- Zanzibar-like tuples: (principal) has (relation) on (object)
CREATE TABLE IF NOT EXISTS acl.tuples (
    principal_id  UUID NOT NULL REFERENCES acl.principals(id) ON DELETE CASCADE,
    relation      TEXT NOT NULL REFERENCES acl.relations(name) ON DELETE CASCADE,
    resource_type TEXT NOT NULL REFERENCES acl.resource_types(name) ON DELETE CASCADE,
    resource_pk   TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (principal_id, relation, resource_type, resource_pk),
    FOREIGN KEY (resource_type, resource_pk) REFERENCES acl.objects(resource_type, resource_pk) ON DELETE CASCADE
);

-- ---------- Performance indexes ----------
CREATE INDEX IF NOT EXISTS idx_acl_tuples_object ON acl.tuples(resource_type, resource_pk);
CREATE INDEX IF NOT EXISTS idx_acl_tuples_principal ON acl.tuples(principal_id);
CREATE INDEX IF NOT EXISTS idx_acl_obj_edges_child  ON acl.object_edges(child_type, child_pk);
CREATE INDEX IF NOT EXISTS idx_acl_obj_edges_parent ON acl.object_edges(parent_type, parent_pk);
CREATE INDEX IF NOT EXISTS idx_acl_memberships_member ON acl.principal_memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_acl_memberships_group  ON acl.principal_memberships(group_id);

-- ---------- Helper: principal expansion (self + groups, recursive) ----------
CREATE OR REPLACE FUNCTION acl.expand_principals(p UUID)
RETURNS TABLE(effective_principal UUID)
LANGUAGE sql STABLE AS $$
    WITH RECURSIVE rec(p_id) AS (
        SELECT p
        UNION
        SELECT pm.group_id
        FROM rec
        JOIN acl.principal_memberships pm ON pm.member_id = rec.p_id
    )
    SELECT p_id FROM rec
$$;

-- ---------- Helper: object ancestry (self + parents, recursive) ----------
CREATE OR REPLACE FUNCTION acl.expand_objects(t TEXT, k TEXT)
RETURNS TABLE(obj_type TEXT, obj_pk TEXT)
LANGUAGE sql STABLE AS $$
    WITH RECURSIVE rec(obj_type, obj_pk) AS (
        SELECT t, k
        UNION
        SELECT e.parent_type, e.parent_pk
        FROM rec
        JOIN acl.object_edges e
          ON (e.child_type = rec.obj_type AND e.child_pk = rec.obj_pk)
    )
    SELECT obj_type, obj_pk FROM rec
$$;

-- ---------- Permission check ----------
CREATE OR REPLACE FUNCTION acl.has_permission(
    p_principal UUID,
    p_permission acl.permission,
    p_type TEXT,
    p_pk   TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    -- Expand principals (self + groups) and object ancestors (self + parents),
    -- then check any tuple whose relation implies the requested permission.
    WITH ep AS (SELECT effective_principal FROM acl.expand_principals(p_principal)),
         eo AS (SELECT obj_type, obj_pk FROM acl.expand_objects(p_type, p_pk)),
         rels AS (
           SELECT relation
           FROM acl.relation_permissions
           WHERE permission = p_permission
         )
    SELECT EXISTS (
        SELECT 1
        FROM acl.tuples t
        JOIN ep ON ep.effective_principal = t.principal_id
        JOIN eo ON eo.obj_type = t.resource_type AND eo.obj_pk = t.resource_pk
        JOIN rels r ON r.relation = t.relation
    );
$$;

-- ---------- Session helper (store current principal) ----------
-- app code should call: SELECT acl.set_principal('<uuid>');
CREATE OR REPLACE FUNCTION acl.set_principal(p UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM set_config('app.principal_id', p::text, true);
END$$;

-- Acquire principal for this session; returns NULL if not set
CREATE OR REPLACE FUNCTION acl.current_principal()
RETURNS UUID
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.principal_id', true), '')::uuid;
$$;

-- ---------- Database roles (runtime principals use tuples; DB roles gate RLS) ----------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
        CREATE ROLE app_admin NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN
        CREATE ROLE app_readonly NOINHERIT;
    END IF;
END$$;

-- Grant function usage
GRANT USAGE ON SCHEMA acl TO app_user, app_readonly, app_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA acl TO app_user, app_readonly, app_admin;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA acl TO app_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA acl TO app_user, app_readonly, app_admin;

-- ---------- RLS bindings for Northwind tables ----------
-- Convention:
--   customers     -> resource ('customer', customer_id)
--   orders        -> resource ('order', order_id)
--   order_details -> resource ('order_detail', order_id||':'||product_id)
--   products      -> resource ('product', product_id)

-- Helper to fetch current principal or fail closed
CREATE OR REPLACE FUNCTION acl.require_principal()
RETURNS UUID
LANGUAGE plpgsql STABLE AS $$
DECLARE p UUID;
BEGIN
    p := acl.current_principal();
    IF p IS NULL THEN
        RETURN NULL; -- evaluate FALSE in USING (safe fail-closed)
    END IF;
    RETURN p;
END$$;

-- Customers
ALTER TABLE northwind.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customers_read ON northwind.customers;
DROP POLICY IF EXISTS customers_write ON northwind.customers;

CREATE POLICY customers_read ON northwind.customers
FOR SELECT
USING (
    acl.has_permission(
        acl.require_principal(),
        'read',
        'customer',
        customer_id::text
    )
);

CREATE POLICY customers_write ON northwind.customers
FOR UPDATE, DELETE
USING (
    acl.has_permission(
        acl.require_principal(),
        'write',
        'customer',
        customer_id::text
    )
);

-- Products
ALTER TABLE northwind.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_read ON northwind.products;
DROP POLICY IF EXISTS products_write ON northwind.products;

CREATE POLICY products_read ON northwind.products
FOR SELECT
USING (
    acl.has_permission(
        acl.require_principal(),
        'read',
        'product',
        product_id::text
    )
);

CREATE POLICY products_write ON northwind.products
FOR UPDATE, DELETE
USING (
    acl.has_permission(
        acl.require_principal(),
        'write',
        'product',
        product_id::text
    )
);

-- Orders
ALTER TABLE northwind.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orders_read ON northwind.orders;
DROP POLICY IF EXISTS orders_write ON northwind.orders;

CREATE POLICY orders_read ON northwind.orders
FOR SELECT
USING (
    acl.has_permission(
        acl.require_principal(),
        'read',
        'order',
        order_id::text
    )
);

CREATE POLICY orders_write ON northwind.orders
FOR UPDATE, DELETE
USING (
    acl.has_permission(
        acl.require_principal(),
        'write',
        'order',
        order_id::text
    )
);

-- Order Details
ALTER TABLE northwind.order_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_details_read ON northwind.order_details;
DROP POLICY IF EXISTS order_details_write ON northwind.order_details;

CREATE POLICY order_details_read ON northwind.order_details
FOR SELECT
USING (
    acl.has_permission(
        acl.require_principal(),
        'read',
        'order_detail',
        (order_id::text || ':' || product_id::text)
    )
);

CREATE POLICY order_details_write ON northwind.order_details
FOR UPDATE, DELETE
USING (
    acl.has_permission(
        acl.require_principal(),
        'write',
        'order_detail',
        (order_id::text || ':' || product_id::text)
    )
);

-- Allow app_admin to bypass RLS
ALTER TABLE northwind.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE northwind.products  FORCE ROW LEVEL SECURITY;
ALTER TABLE northwind.orders    FORCE ROW LEVEL SECURITY;
ALTER TABLE northwind.order_details FORCE ROW LEVEL SECURITY;

-- app_admin can DISABLE RLS via session role escalation if desired; or grant table privileges directly:
GRANT SELECT, INSERT, UPDATE, DELETE ON northwind.customers, northwind.products, northwind.orders, northwind.order_details TO app_user, app_readonly;
GRANT SELECT ON northwind.customers, northwind.products, northwind.orders, northwind.order_details TO app_readonly;
GRANT ALL ON northwind.customers, northwind.products, northwind.orders, northwind.order_details TO app_admin;

COMMIT;
