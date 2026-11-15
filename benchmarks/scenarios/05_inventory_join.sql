-- Problem: unnecessary DISTINCT forces duplicate elimination after a fan-out join.
SELECT DISTINCT p.id, p.name, i.quantity_on_hand
FROM products p
JOIN inventory i ON i.product_id = p.id
JOIN order_items oi ON oi.product_id = p.id
WHERE i.quantity_on_hand < i.reorder_point;

-- Candidate: EXISTS preserves one row per product without a global distinct operation.
SELECT p.id, p.name, i.quantity_on_hand
FROM products p
JOIN inventory i ON i.product_id = p.id
WHERE i.quantity_on_hand < i.reorder_point
  AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id);
