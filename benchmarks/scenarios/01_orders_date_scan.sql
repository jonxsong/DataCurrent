-- Problem: no index on orders.created_at; recent-order analysis scans the table.
SELECT id, customer_id, total_amount
FROM orders
WHERE created_at >= now() - interval '7 days'
ORDER BY created_at DESC;

-- Candidate index for isolated benchmark only:
-- CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
