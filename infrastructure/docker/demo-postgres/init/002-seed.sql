SELECT setseed(0.4242);

INSERT INTO customers (email, full_name, region, status, created_at)
SELECT 'customer' || n || '@example.test',
       'Customer ' || n,
       (ARRAY['west','west','west','east','central','international'])[1 + floor(random() * 6)::int],
       (ARRAY['active','active','active','trial','inactive'])[1 + floor(random() * 5)::int],
       now() - random() * interval '730 days'
  FROM generate_series(1, 25000) AS n;

INSERT INTO products (sku, name, category, price, active)
SELECT 'SKU-' || lpad(n::text, 6, '0'),
       'Product ' || n,
       (ARRAY['hardware','software','accessories','services'])[1 + (n % 4)],
       round((5 + random() * 995)::numeric, 2),
       random() > 0.03
  FROM generate_series(1, 3000) AS n;

INSERT INTO orders (customer_id, status, total_amount, created_at)
SELECT 1 + floor(random() * 25000)::bigint,
       (ARRAY['pending','paid','paid','paid','shipped','shipped','cancelled'])[1 + floor(random() * 7)::int],
       round((20 + random() * 2500)::numeric, 2),
       now() - power(random(), 2) * interval '365 days'
  FROM generate_series(1, 220000);

INSERT INTO order_items (order_id, product_id, quantity, unit_price)
SELECT o.id,
       1 + floor(random() * 3000)::bigint,
       1 + floor(random() * 5)::int,
       round((5 + random() * 995)::numeric, 2)
  FROM orders o
 CROSS JOIN LATERAL generate_series(1, 1 + floor(random() * 4)::int);

INSERT INTO payments (order_id, provider, status, amount, processed_at)
SELECT id,
       (ARRAY['stripe','adyen','paypal'])[1 + floor(random() * 3)::int],
       CASE WHEN status = 'cancelled' THEN 'refunded' ELSE 'succeeded' END,
       total_amount,
       created_at + interval '5 minutes'
  FROM orders WHERE status <> 'pending';

INSERT INTO inventory (product_id, quantity_on_hand, reorder_point)
SELECT id, floor(random() * 500)::int, 25 + floor(random() * 50)::int FROM products;

INSERT INTO events (customer_id, event_type, properties, occurred_at)
SELECT 1 + floor(random() * 25000)::bigint,
       (ARRAY['page_view','search','add_to_cart','checkout','login'])[1 + floor(random() * 5)::int],
       jsonb_build_object('source', (ARRAY['web','mobile','api'])[1 + floor(random() * 3)::int]),
       now() - random() * interval '90 days'
  FROM generate_series(1, 450000);

REFRESH MATERIALIZED VIEW daily_revenue;
ANALYZE;

-- Populate pg_stat_statements with deterministic investigation candidates.
SELECT count(*) FROM orders WHERE created_at >= now() - interval '30 days';
SELECT c.region, count(*), sum(o.total_amount)
  FROM customers c JOIN orders o ON o.customer_id = c.id
 WHERE lower(c.email) LIKE '%example.test'
 GROUP BY c.region;
SELECT p.category, sum(oi.quantity)
  FROM products p JOIN order_items oi ON oi.product_id = p.id
 GROUP BY p.category ORDER BY sum(oi.quantity) DESC;
