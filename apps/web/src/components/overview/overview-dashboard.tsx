"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, Database, RefreshCcw, Zap } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { LatencyChart } from "@/components/overview/latency-chart";
import { QueryTable } from "@/components/queries/query-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { Overview } from "@/lib/types";
import { formatCompact, formatDuration } from "@/lib/utils";

export function OverviewDashboard({ workspace }: { workspace: string }) {
  const overview = useQuery({
    queryKey: ["overview", workspace],
    queryFn: () => apiFetch<Overview>(`/workspaces/${workspace}/overview?hours=24`),
    refetchInterval: 60_000,
  });
  const data = overview.data;
  const metrics = [
    ["Executions", data?.execution_count.value, "count", Zap],
    ["Mean latency", data?.mean_latency_ms.value, "duration", Clock3],
    ["Total time", data?.total_execution_time_ms.value, "duration", Activity],
    ["Tracked queries", data?.active_queries.value, "count", Database],
  ] as const;
  const chart = (data?.latency_series ?? []).map((point) => ({
    time: new Date(point.captured_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    mean: Number(point.mean_time_ms),
    p95: Number(point.p95_time_ms),
  }));
  return (
    <>
      <PageHeader
        eyebrow="Workload / Last 24 hours"
        title="Overview"
        description="Current workload health and performance evidence collected from your connected databases."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => overview.refetch()}
              disabled={overview.isFetching}
            >
              <RefreshCcw className="size-3.5" /> Refresh
            </Button>
            <Button asChild size="sm">
              <Link href={`/app/${workspace}/query-lab`}>Open Query Lab</Link>
            </Button>
          </div>
        }
      />
      {overview.error && (
        <p className="mb-3 rounded-lg border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
          {overview.error.message}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, kind, Icon]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                  {label}
                </span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <strong className="mt-5 block font-mono text-2xl font-medium">
                {value == null
                  ? "—"
                  : kind === "duration"
                    ? formatDuration(Number(value))
                    : formatCompact(Number(value))}
              </strong>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-3">
        <CardHeader>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Query latency
            </p>
            <CardTitle className="mt-1">Mean / p95</CardTitle>
          </div>
          {data?.data_freshness && (
            <Badge tone="success">
              Collected {new Date(data.data_freshness).toLocaleTimeString()}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {chart.length > 0 ? (
            <LatencyChart data={chart} />
          ) : (
            <div className="grid h-72 place-items-center text-sm text-muted-foreground">
              Historical telemetry has not been collected yet.
            </div>
          )}
        </CardContent>
      </Card>
      <div className="mt-5 mb-3 flex items-end justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Expensive workload
          </p>
          <h2 className="mt-1 text-sm font-semibold">Top query fingerprints</h2>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/app/${workspace}/queries`}>View all queries</Link>
        </Button>
      </div>
      <QueryTable
        workspace={workspace}
        rows={data?.slowest_queries ?? []}
        loading={overview.isPending}
      />
    </>
  );
}
