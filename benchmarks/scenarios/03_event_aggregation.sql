-- Problem: a wide event time range performs a large scan and aggregation.
SELECT event_type, count(*)
FROM events
WHERE occurred_at >= now() - interval '30 days'
GROUP BY event_type
ORDER BY count(*) DESC;

-- Candidate index for isolated benchmark only:
-- CREATE INDEX idx_events_occurred_type ON events(occurred_at, event_type);
