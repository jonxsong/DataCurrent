import {
  Activity,
  Clock3,
  Database,
  RefreshCcw,
  TriangleAlert,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { LatencyChart } from "@/components/overview/latency-chart";
import { QueryTable } from "@/components/queries/query-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { demoMetrics } from "@/lib/demo-data";
import { formatCompact, formatDuration } from "@/lib/utils";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const metrics = [
    ["Executions", formatCompact(demoMetrics.executions), "+8.2%", Zap],
    ["Mean latency", formatDuration(demoMetrics.meanLatency), "−12.4%", Clock3],
    ["Total time", formatDuration(demoMetrics.totalTime), "+4.1%", Activity],
    ["Active queries", String(demoMetrics.activeQueries), "stable", Database],
  ] as const;
  return (
    <>
      <PageHeader
        eyebrow="Workload / Last 24 hours"
        title="Overview"
        description="Current workload health, query behavior, and performance regressions from collected database evidence."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm">
              <RefreshCcw className="size-3.5" /> Refresh
            </Button>
            <Button asChild size="sm">
              <Link href={`/app/${workspace}/query-lab`}>Open Query Lab</Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, change, Icon]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">
                  {label}
                </span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-5 flex items-end justify-between">
                <strong className="font-mono text-2xl font-medium">
                  {value}
                </strong>
                <span className="font-mono text-[10px] text-accent">
                  {change}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.65fr_.85fr]">
        <Card>
          <CardHeader>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Query latency
              </p>
              <CardTitle className="mt-1">Mean / p95</CardTitle>
            </div>
            <Badge tone="success">Collected 42s ago</Badge>
          </CardHeader>
          <CardContent>
            <LatencyChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Regression
              </p>
              <CardTitle className="mt-1">Evidence requires review</CardTitle>
            </div>
            <Badge tone="danger">High</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid size-11 place-items-center rounded-md border border-warning/20 bg-warning/10 text-warning">
              <TriangleAlert className="size-5" />
            </div>
            <h3 className="mt-5 font-semibold">Sequential scan on orders</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Mean latency increased 62% after the estimated row count diverged
              from observations.
            </p>
            <div className="mt-5 border-l-2 border-warning bg-elevated p-3 font-mono text-[10px] text-muted-foreground">
              Observed · 8.4M rows · Seq Scan
            </div>
            <Button asChild className="mt-5" variant="secondary" size="sm">
              <Link href={`/app/${workspace}/queries/q-orders-date`}>
                Inspect query
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="mt-3">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Expensive workload
            </p>
            <h2 className="mt-1 text-sm font-semibold">
              Top query fingerprints
            </h2>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/app/${workspace}/queries`}>View all queries</Link>
          </Button>
        </div>
        <QueryTable workspace={workspace} limit={4} />
      </div>
    </>
  );
}
