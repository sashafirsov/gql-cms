-- 80-northwind-acl-seed.sql
-- Seed ReBAC catalog + derive initial grants from Northwind sample data

BEGIN;

-- Resource types
INSERT INTO acl.resource_types(name) VALUES
    ('customer'), ('order'), ('order_detail'), ('product')
ON CONFLICT DO NOTHING;

-- Relations
INSERT INTO acl.relations(name) VALUES
    ('owner'), ('manager'), ('editor'), ('viewer'),
    ('sales_rep'),         -- employee assigned to a customer/order
    ('customer_self')      -- self-access for customer principal
ON CONFLICT DO NOTHING;

-- Relation → Permission mapping
INSERT INTO acl.relation_permissions(relation, permission) VALUES
    ('owner','read'), ('owner','write'), ('owner','manage'),
    ('manager','read'), ('manager','write'), ('manager','manage'),
    ('editor','read'), ('editor','write'),
    ('viewer','read'),
    ('sales_rep','read'),
    ('customer_self','read')
ON CONFLICT DO NOTHING;

-- ---------- Principals ----------
-- Map existing Northwind actors to principals.
-- Employees 1..9 as employees, a sales_admins group, and some customer principals.

-- Sales admins group
WITH g AS (
  INSERT INTO acl.principals(kind, external_id, display_name)
  VALUES ('group','group:sales_admins','Sales Admins')
  ON CONFLICT (external_id) DO UPDATE SET display_name=EXCLUDED.display_name
  RETURNING id
)
SELECT * FROM g;

-- Employees -> principals
INSERT INTO acl.principals(kind, external_id, display_name)
SELECT 'employee', 'employee:'||employee_id::text, first_name||' '||last_name
FROM northwind.employees
WHERE employee_id BETWEEN 1 AND 9
ON CONFLICT (external_id) DO NOTHING;

-- Make employees 2 and 5 members of sales_admins
WITH g AS (
  SELECT id FROM acl.principals WHERE external_id = 'group:sales_admins'
),
e AS (
  SELECT p.id
  FROM acl.principals p
  WHERE p.external_id IN ('employee:2','employee:5')
)
INSERT INTO acl.principal_memberships(member_id, group_id)
SELECT e.id, g.id FROM e CROSS JOIN g
ON CONFLICT DO NOTHING;

-- Customer-company principals for selected customers (match your seed)
INSERT INTO acl.principals(kind, external_id, display_name)
SELECT 'customer', 'customer:'||customer_id, company_name
FROM northwind.customers
WHERE customer_id IN ('ALFKI','VINET','TOMSP','HANAR','VICTE','SUPRD','CHOPS','RICSU','WELLI','HILAA','ERNSH','CENTC','OTTIK')
ON CONFLICT (external_id) DO NOTHING;

-- ---------- Objects ----------
-- Customers
INSERT INTO acl.objects(resource_type, resource_pk)
SELECT 'customer', customer_id FROM northwind.customers
ON CONFLICT DO NOTHING;

-- Products
INSERT INTO acl.objects(resource_type, resource_pk)
SELECT 'product', product_id::text FROM northwind.products
ON CONFLICT DO NOTHING;

-- Orders
INSERT INTO acl.objects(resource_type, resource_pk)
SELECT 'order', order_id::text FROM northwind.orders
ON CONFLICT DO NOTHING;

-- Order Details (composite key serialized as "orderId:productId")
INSERT INTO acl.objects(resource_type, resource_pk)
SELECT 'order_detail', (order_id::text || ':' || product_id::text) FROM northwind.order_details
ON CONFLICT DO NOTHING;

-- ---------- Object containment edges ----------
-- order ⟶ customer
INSERT INTO acl.object_edges(child_type, child_pk, parent_type, parent_pk)
SELECT 'order', o.order_id::text, 'customer', o.customer_id
FROM northwind.orders o
ON CONFLICT DO NOTHING;

-- order_detail ⟶ order
INSERT INTO acl.object_edges(child_type, child_pk, parent_type, parent_pk)
SELECT 'order_detail', (d.order_id::text||':'||d.product_id::text), 'order', d.order_id::text
FROM northwind.order_details d
ON CONFLICT DO NOTHING;

-- ---------- Tuples (who has which relation on what) ----------

-- 1) Customers get 'customer_self' on their own customer object
INSERT INTO acl.tuples(principal_id, relation, resource_type, resource_pk)
SELECT p.id, 'customer_self', 'customer', c.customer_id
FROM northwind.customers c
JOIN acl.principals p ON p.external_id = 'customer:'||c.customer_id
ON CONFLICT DO NOTHING;

-- 2) Sales admins group gets 'manager' on ALL customers, orders, and products
WITH g AS (SELECT id FROM acl.principals WHERE external_id='group:sales_admins')
INSERT INTO acl.tuples(principal_id, relation, resource_type, resource_pk)
SELECT g.id, 'manager', 'customer', c.customer_id     FROM g, northwind.customers c
UNION ALL
SELECT g.id, 'manager', 'order',    o.order_id::text  FROM g, northwind.orders o
UNION ALL
SELECT g.id, 'manager', 'product',  p.product_id::text FROM g, northwind.products p
ON CONFLICT DO NOTHING;

-- 3) Derive 'sales_rep' for employees on orders (and bubble to the customer via containment)
--    (Grant directly on the ORDER; read also flows to order_details by containment.)
INSERT INTO acl.tuples(principal_id, relation, resource_type, resource_pk)
SELECT ep.id, 'sales_rep', 'order', o.order_id::text
FROM northwind.orders o
JOIN acl.principals ep ON ep.external_id = 'employee:'||o.employee_id::text
ON CONFLICT DO NOTHING;

-- 4) Give each order's customer principal 'owner' on that order (common B2C pattern)
INSERT INTO acl.tuples(principal_id, relation, resource_type, resource_pk)
SELECT cp.id, 'owner', 'order', o.order_id::text
FROM northwind.orders o
JOIN acl.principals cp ON cp.external_id = 'customer:'||o.customer_id
ON CONFLICT DO NOTHING;

-- 5) Make all customers 'viewer' of all products (catalog is globally readable to customers)
INSERT INTO acl.tuples(principal_id, relation, resource_type, resource_pk)
SELECT cp.id, 'viewer', 'product', pr.product_id::text
FROM acl.principals cp
JOIN northwind.products pr ON cp.kind = 'customer'
ON CONFLICT DO NOTHING;

-- 6) Make all employees 'viewer' of all products and customers by default (typical internal visibility)
INSERT INTO acl.tuples(principal_id, relation, resource_type, resource_pk)
SELECT ep.id, 'viewer', 'product', pr.product_id::text
FROM acl.principals ep
JOIN northwind.products pr ON ep.kind = 'employee'
UNION ALL
SELECT ep.id, 'viewer', 'customer', c.customer_id
FROM acl.principals ep
JOIN northwind.customers c ON ep.kind = 'employee'
ON CONFLICT DO NOTHING;

COMMIT;

-- -----------------------
-- HOW TO USE (examples)
-- -----------------------
-- -- find principal for employee 5
-- SELECT id FROM acl.principals WHERE external_id = 'employee:5';
-- -- set principal for session:
-- SELECT acl.set_principal('<uuid-from-above>');
-- -- now SELECT * FROM orders; will be filtered by RLS
