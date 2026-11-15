-- Problem: correlated aggregate repeats work per customer.
SELECT c.id,
       (SELECT sum(o.total_amount) FROM orders o WHERE o.customer_id = c.id) AS total
FROM customers c
WHERE c.status = 'active';

-- Candidate: pre-aggregate once and join.
SELECT c.id, totals.total
FROM customers c
LEFT JOIN (
    SELECT customer_id, sum(total_amount) AS total
    FROM orders GROUP BY customer_id
) totals ON totals.customer_id = c.id
WHERE c.status = 'active';
