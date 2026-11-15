CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

CREATE TABLE customers (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL UNIQUE,
    full_name text NOT NULL,
    region text NOT NULL,
    status text NOT NULL CHECK (status IN ('active', 'inactive', 'trial')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku text NOT NULL UNIQUE,
    name text NOT NULL,
    category text NOT NULL,
    price numeric(12,2) NOT NULL CHECK (price >= 0),
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE orders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id bigint NOT NULL REFERENCES customers(id),
    status text NOT NULL CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
    total_amount numeric(14,2) NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id bigint NOT NULL REFERENCES products(id),
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price numeric(12,2) NOT NULL
);

CREATE TABLE payments (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint NOT NULL REFERENCES orders(id),
    provider text NOT NULL,
    status text NOT NULL,
    amount numeric(14,2) NOT NULL,
    processed_at timestamptz
);

CREATE TABLE inventory (
    product_id bigint PRIMARY KEY REFERENCES products(id),
    quantity_on_hand integer NOT NULL,
    reorder_point integer NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id bigint REFERENCES customers(id),
    event_type text NOT NULL,
    properties jsonb NOT NULL DEFAULT '{}',
    occurred_at timestamptz NOT NULL
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_events_customer_id ON events(customer_id);

CREATE VIEW customer_lifetime_value AS
SELECT c.id AS customer_id,
       c.full_name,
       count(o.id) AS order_count,
       coalesce(sum(o.total_amount) FILTER (WHERE o.status <> 'cancelled'), 0) AS lifetime_value
  FROM customers c
  LEFT JOIN orders o ON o.customer_id = c.id
 GROUP BY c.id, c.full_name;

CREATE MATERIALIZED VIEW daily_revenue AS
SELECT date_trunc('day', created_at) AS day,
       sum(total_amount) AS revenue,
       count(*) AS order_count
  FROM orders
 WHERE status IN ('paid', 'shipped')
 GROUP BY 1;

CREATE ROLE demo_reader LOGIN PASSWORD 'demo_reader';
GRANT CONNECT ON DATABASE commerce TO demo_reader;
GRANT USAGE ON SCHEMA public TO demo_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO demo_reader;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO demo_reader;
GRANT SELECT ON pg_stat_statements TO demo_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO demo_reader;
ALTER ROLE demo_reader SET default_transaction_read_only = on;
ALTER ROLE demo_reader SET statement_timeout = '15s';

CREATE ROLE benchmark_reader LOGIN PASSWORD 'benchmark_reader';
GRANT CONNECT ON DATABASE commerce TO benchmark_reader;
GRANT USAGE ON SCHEMA public TO benchmark_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO benchmark_reader;
ALTER ROLE benchmark_reader SET default_transaction_read_only = on;
ALTER ROLE benchmark_reader SET statement_timeout = '30s';
