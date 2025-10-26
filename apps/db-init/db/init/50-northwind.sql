-- ----------------------------
-- Table: categories
-- ----------------------------
CREATE TABLE categories (
    category_id SMALLINT NOT NULL PRIMARY KEY,
    category_name VARCHAR(15) NOT NULL,
    description TEXT,
    picture BYTEA
);

-- ----------------------------
-- Table: customer_demographics
-- ----------------------------
CREATE TABLE customer_demographics (
    customer_type_id CHAR(10) NOT NULL PRIMARY KEY,
    customer_desc TEXT
);

-- ----------------------------
-- Table: customers
-- ----------------------------
CREATE TABLE customers (
    customer_id CHAR(5) NOT NULL PRIMARY KEY,
    company_name VARCHAR(40) NOT NULL,
    contact_name VARCHAR(30),
    contact_title VARCHAR(30),
    address VARCHAR(60),
    city VARCHAR(15),
    region VARCHAR(15),
    postal_code VARCHAR(10),
    country VARCHAR(15),
    phone VARCHAR(24),
    fax VARCHAR(24)
);

-- ----------------------------
-- Table: customer_customer_demo (link table between customers and customer_demographics)
-- ----------------------------
CREATE TABLE customer_customer_demo (
    customer_id CHAR(5) NOT NULL,
    customer_type_id CHAR(10) NOT NULL,
    PRIMARY KEY (customer_id, customer_type_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (customer_type_id) REFERENCES customer_demographics(customer_type_id)
);

-- ----------------------------
-- Table: employees
-- ----------------------------
CREATE TABLE employees (
    employee_id SMALLINT NOT NULL PRIMARY KEY,
    last_name VARCHAR(20) NOT NULL,
    first_name VARCHAR(10) NOT NULL,
    title VARCHAR(30),
    title_of_courtesy VARCHAR(25),
    birth_date DATE,
    hire_date DATE,
    address VARCHAR(60),
    city VARCHAR(15),
    region VARCHAR(15),
    postal_code VARCHAR(10),
    country VARCHAR(15),
    home_phone VARCHAR(24),
    extension VARCHAR(4),
    photo BYTEA,
    notes TEXT,
    reports_to SMALLINT,
    photo_path VARCHAR(255),
    FOREIGN KEY (reports_to) REFERENCES employees(employee_id)
);

-- ----------------------------
-- Table: suppliers
-- ----------------------------
CREATE TABLE suppliers (
    supplier_id SMALLINT NOT NULL PRIMARY KEY,
    company_name VARCHAR(40) NOT NULL,
    contact_name VARCHAR(30),
    contact_title VARCHAR(30),
    address VARCHAR(60),
    city VARCHAR(15),
    region VARCHAR(15),
    postal_code VARCHAR(10),
    country VARCHAR(15),
    phone VARCHAR(24),
    fax VARCHAR(24),
    homepage TEXT
);

-- ----------------------------
-- Table: products
-- ----------------------------
CREATE TABLE products (
    product_id SMALLINT NOT NULL PRIMARY KEY,
    product_name VARCHAR(40) NOT NULL,
    supplier_id SMALLINT,
    category_id SMALLINT,
    quantity_per_unit VARCHAR(20),
    unit_price NUMERIC(15,2),
    units_in_stock SMALLINT,
    units_on_order SMALLINT,
    reorder_level SMALLINT,
    discontinued BOOLEAN NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- ----------------------------
-- Table: region
-- ----------------------------
CREATE TABLE region (
    region_id SMALLINT NOT NULL PRIMARY KEY,
    region_description CHAR(50) NOT NULL
);

-- ----------------------------
-- Table: shippers
-- ----------------------------
CREATE TABLE shippers (
    shipper_id SMALLINT NOT NULL PRIMARY KEY,
    company_name VARCHAR(40) NOT NULL,
    phone VARCHAR(24)
);

-- ----------------------------
-- Table: orders
-- ----------------------------
CREATE TABLE orders (
    order_id SMALLINT NOT NULL PRIMARY KEY,
    customer_id CHAR(5),
    employee_id SMALLINT,
    order_date DATE,
    required_date DATE,
    shipped_date DATE,
    ship_via SMALLINT,
    freight NUMERIC(15,2),
    ship_name VARCHAR(40),
    ship_address VARCHAR(60),
    ship_city VARCHAR(15),
    ship_region VARCHAR(15),
    ship_postal_code VARCHAR(10),
    ship_country VARCHAR(15),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (ship_via) REFERENCES shippers(shipper_id)
);

-- ----------------------------
-- Table: territories
-- ----------------------------
CREATE TABLE territories (
    territory_id VARCHAR(20) NOT NULL PRIMARY KEY,
    territory_description CHAR(50) NOT NULL,
    region_id SMALLINT NOT NULL,
    FOREIGN KEY (region_id) REFERENCES region(region_id)
);

-- ----------------------------
-- Table: employee_territories (link table between employees and territories)
-- ----------------------------
CREATE TABLE employee_territories (
    employee_id SMALLINT NOT NULL,
    territory_id VARCHAR(20) NOT NULL,
    PRIMARY KEY (employee_id, territory_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (territory_id) REFERENCES territories(territory_id)
);

-- ----------------------------
-- Table: order_details (link table between orders and products)
-- ----------------------------
CREATE TABLE order_details (
    order_id SMALLINT NOT NULL,
    product_id SMALLINT NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    quantity SMALLINT NOT NULL,
    discount REAL NOT NULL,
    PRIMARY KEY (order_id, product_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Create indexes on key fields (as per official design)
CREATE INDEX idx_category_name ON categories(category_name);
CREATE INDEX idx_customers_company ON customers(company_name);
CREATE INDEX idx_customers_city ON customers(city);
CREATE INDEX idx_customers_region ON customers(region);
CREATE INDEX idx_customers_postal ON customers(postal_code);
CREATE INDEX idx_employees_lastname ON employees(last_name);
CREATE INDEX idx_employees_postal ON employees(postal_code);
CREATE INDEX idx_orders_orderdate ON orders(order_date);
CREATE INDEX idx_orders_shippeddate ON orders(shipped_date);
CREATE INDEX idx_orders_ship_postal ON orders(ship_postal_code);
CREATE INDEX idx_products_name ON products(product_name);
CREATE INDEX idx_suppliers_company ON suppliers(company_name);
CREATE INDEX idx_suppliers_postal ON suppliers(postal_code);
