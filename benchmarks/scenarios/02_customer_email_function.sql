-- Problem: function-wrapped predicate cannot use the ordinary unique email index directly.
SELECT id, full_name
FROM customers
WHERE lower(email) = lower('customer12000@example.test');

-- Candidate: normalize input and compare the stored canonical email directly.
SELECT id, full_name
FROM customers
WHERE email = 'customer12000@example.test';
