import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { demoQueries } from "@/lib/demo-data";
import { formatCompact, formatDuration } from "@/lib/utils";

export function QueryTable({
  workspace,
  limit,
}: {
  workspace: string;
  limit?: number;
}) {
  const rows = limit ? demoQueries.slice(0, limit) : demoQueries;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="hidden grid-cols-[minmax(280px,2.2fr)_.7fr_.55fr_.55fr_.45fr_28px] gap-4 bg-elevated px-4 py-2.5 font-mono text-[8px] uppercase tracking-[.12em] text-muted-foreground md:grid">
        <span>Query</span>
        <span>Database</span>
        <span>Calls</span>
        <span>Mean</span>
        <span>Change</span>
        <span />
      </div>
      {rows.map((query) => (
        <Link
          key={query.id}
          href={`/app/${workspace}/queries/${query.id}`}
          className="grid gap-3 border-t border-border bg-surface px-4 py-4 first:border-t-0 hover:bg-elevated/70 md:grid-cols-[minmax(280px,2.2fr)_.7fr_.55fr_.55fr_.45fr_28px] md:items-center"
        >
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <Badge
                tone={query.provider === "Snowflake" ? "accent" : "neutral"}
              >
                {query.operation}
              </Badge>
              <span className="font-mono text-[9px] text-muted-foreground md:hidden">
                {query.provider}
              </span>
            </div>
            <code className="block truncate font-mono text-[11px] text-foreground">
              {query.sql}
            </code>
          </div>
          <span className="hidden text-xs text-muted-foreground md:block">
            {query.provider}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {formatCompact(query.calls)}
          </span>
          <span className="font-mono text-xs">
            {formatDuration(query.mean)}
          </span>
          <span
            className={`flex items-center gap-1 font-mono text-xs ${query.change > 10 ? "text-danger" : query.change < 0 ? "text-success" : "text-muted-foreground"}`}
          >
            {query.change > 0 ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )}
            {Math.abs(query.change)}%
          </span>
          <ChevronRight className="hidden size-4 text-muted-foreground md:block" />
        </Link>
      ))}
    </div>
  );
}
