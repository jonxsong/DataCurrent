export type Workspace = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member" | "viewer";
};

export type Session = {
  user: { id: string; email: string; display_name: string };
  workspaces: Workspace[];
};

export type WorkspaceSettings = Workspace & {
  retention_days: number;
  member_count: number;
  ai_configured: boolean;
  encryption_configured: boolean;
};

export type Connection = {
  id: string;
  name: string;
  provider: "postgresql" | "snowflake";
  status: "pending" | "healthy" | "degraded" | "unreachable" | "disabled";
  capabilities: Record<string, unknown>;
  tls_verify: boolean;
  collect_enabled: boolean;
  benchmark_only: boolean;
  last_checked_at: string | null;
  last_collected_at: string | null;
  last_error_code: string | null;
};

export type QuerySummary = {
  id: string;
  connection_id: string;
  provider: string;
  fingerprint_hash: string;
  normalized_sql: string;
  operation: string | null;
  calls: number;
  mean_time_ms: number;
  total_time_ms: number;
  rows_processed: number;
  captured_at: string;
  sample_kind: string;
};

export type QueryPage = {
  items: QuerySummary[];
  page: number;
  page_size: number;
  total: number;
};

export type QueryDetail = QuerySummary & {
  referenced_objects: string[];
  first_seen_at: string;
  last_seen_at: string;
  trend: Array<{
    captured_at: string;
    mean_time_ms: number;
    calls_delta: number | null;
    total_time_delta_ms: number | null;
    counter_reset: boolean;
  }>;
};

export type Overview = {
  time_range_hours: number;
  execution_count: Metric;
  mean_latency_ms: Metric;
  total_execution_time_ms: Metric;
  active_queries: Metric;
  latency_series: Array<{
    captured_at: string;
    mean_time_ms: number;
    p95_time_ms: number;
  }>;
  recent_regressions: Array<Record<string, unknown>>;
  slowest_queries: QuerySummary[];
  data_freshness: string | null;
  limitations: string[];
};

type Metric = {
  value: number | null;
  previous_value: number | null;
  available: boolean;
  note: string | null;
};

export type LineageGraphResponse = {
  nodes: Array<{
    id: string;
    label: string;
    kind: string;
    metadata: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relationship: string;
    evidence_kind: string;
    evidence: Record<string, unknown>;
  }>;
};
