import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { QuerySummary } from "@/lib/types";
import { formatCompact, formatDuration } from "@/lib/utils";

export function QueryTable({
  workspace,
  rows,
  loading = false,
}: {
  workspace: string;
  rows: QuerySummary[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid h-48 place-items-center rounded-lg border border-border bg-surface font-mono text-[10px] text-muted-foreground">
        Loading collected query evidence…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-14 text-center">
        <p className="text-sm font-medium">No query telemetry yet</p>
        <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-muted-foreground">
          Add a database connection and allow the collector to capture its first
          workload snapshot. PostgreSQL requires pg_stat_statements.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="hidden grid-cols-[minmax(280px,2.2fr)_.7fr_.55fr_.55fr_.55fr_28px] gap-4 bg-elevated px-4 py-2.5 font-mono text-[8px] uppercase tracking-[.12em] text-muted-foreground md:grid">
        <span>Query</span>
        <span>Provider</span>
        <span>Calls</span>
        <span>Mean</span>
        <span>Evidence</span>
        <span />
      </div>
      {rows.map((query) => (
        <Link
          key={query.id}
          href={`/app/${workspace}/queries/${query.id}`}
          className="grid gap-3 border-t border-border bg-surface px-4 py-4 first:border-t-0 hover:bg-elevated/70 md:grid-cols-[minmax(280px,2.2fr)_.7fr_.55fr_.55fr_.55fr_28px] md:items-center"
        >
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <Badge>{query.operation ?? "SQL"}</Badge>
              <span className="font-mono text-[9px] text-muted-foreground md:hidden">
                {query.provider}
              </span>
            </div>
            <code className="block truncate font-mono text-[11px] text-foreground">
              {query.normalized_sql}
            </code>
          </div>
          <span className="hidden text-xs capitalize text-muted-foreground md:block">
            {query.provider}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {formatCompact(query.calls)}
          </span>
          <span className="font-mono text-xs">
            {formatDuration(query.mean_time_ms)}
          </span>
          <Badge tone={query.sample_kind === "cumulative" ? "success" : "warning"}>
            {query.sample_kind}
          </Badge>
          <ChevronRight className="hidden size-4 text-muted-foreground md:block" />
        </Link>
      ))}
    </div>
  );
}
