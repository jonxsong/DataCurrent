"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Clock, Rows3, Sparkles, TerminalSquare } from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { QueryDetail as QueryDetailType } from "@/lib/types";
import { formatCompact, formatDuration } from "@/lib/utils";

export function QueryDetail({ workspace, queryId }: { workspace: string; queryId: string }) {
  const query = useQuery({
    queryKey: ["query", workspace, queryId],
    queryFn: () => apiFetch<QueryDetailType>(`/workspaces/${workspace}/queries/${queryId}?hours=168`),
  });
  if (query.isPending) {
    return <p className="font-mono text-xs text-muted-foreground">Loading query evidence…</p>;
  }
  if (!query.data) {
    return <p className="text-sm text-danger">{query.error?.message ?? "Query not found"}</p>;
  }
  const data = query.data;
  const trend = data.trend.map((point) => ({
    time: new Date(point.captured_at).toLocaleString(),
    mean: Number(point.mean_time_ms),
  }));
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-5 -ml-3">
        <Link href={`/app/${workspace}/queries`}><ArrowLeft className="size-4" /> Query Explorer</Link>
      </Button>
      <PageHeader
        eyebrow={`${data.provider} / Query fingerprint`}
        title="Query detail"
        description="Historical behavior and collected evidence for this normalized query."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href={`/app/${workspace}/query-lab?query=${data.id}`}>
                <TerminalSquare className="size-4" /> Explain plan
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/app/${workspace}/investigator?query=${data.id}`}>
                <Sparkles className="size-4" /> Investigate
              </Link>
            </Button>
          </div>
        }
      />
      <Card>
        <CardHeader>
          <div><Badge>{data.operation ?? "SQL"}</Badge><CardTitle className="mt-3">Normalized SQL</CardTitle></div>
          <Badge tone={data.sample_kind === "cumulative" ? "success" : "warning"}>{data.sample_kind}</Badge>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md border border-border bg-background p-4 font-mono text-xs leading-6"><code>{data.normalized_sql}</code></pre>
          {data.referenced_objects.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.referenced_objects.map((item) => <Badge key={item}>{item}</Badge>)}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="my-3 grid gap-3 sm:grid-cols-3">
        {([
          ["Mean latency", formatDuration(data.mean_time_ms), Clock],
          ["Executions", formatCompact(data.calls), BarChart3],
          ["Rows processed", formatCompact(data.rows_processed), Rows3],
        ] as const).map(([label, value, Icon]) => (
          <Card key={label}><CardContent className="flex items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded bg-elevated"><Icon className="size-4 text-accent" /></span><div><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-mono text-lg">{value}</p></div></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><div><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">History / 7 days</p><CardTitle className="mt-1">Mean query latency</CardTitle></div></CardHeader>
        <CardContent>
          {trend.length > 1 ? (
            <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><CartesianGrid vertical={false} stroke="#1d272a" /><XAxis dataKey="time" hide /><YAxis tick={{ fill: "#718084", fontSize: 9 }} /><Tooltip contentStyle={{ background: "#11181b", border: "1px solid #222c30" }} /><Area dataKey="mean" stroke="#42e5c2" fill="#42e5c222" /></AreaChart></ResponsiveContainer></div>
          ) : <p className="py-16 text-center text-sm text-muted-foreground">More snapshots are required to chart a trend.</p>}
        </CardContent>
      </Card>
    </>
  );
}
