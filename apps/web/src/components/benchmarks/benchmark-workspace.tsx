"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FlaskConical, Info, Play, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { Connection } from "@/lib/types";

type Measurement = { latencies_ms: number[]; median_ms: number; p95_ms: number; row_count: number; truncated: boolean };
type Result = { benchmark_id: string; status: string; original: Measurement; candidate: Measurement; speedup_ratio: number; result_agreement: string; caveats: string[] };
type History = {
  id: string;
  status: string;
  original_sql: string;
  candidate_sql: string;
  speedup_ratio: number | null;
  result_agreement: string | null;
  created_at: string;
};

const originalStarter = "SELECT id, customer_id, total_amount FROM orders WHERE created_at >= now() - interval '7 days' ORDER BY created_at DESC";
const candidateStarter = "SELECT id, customer_id, total_amount FROM orders WHERE created_at >= now() - interval '7 days' ORDER BY created_at DESC";

export function BenchmarkWorkspace({ workspace }: { workspace: string }) {
  const queryClient = useQueryClient();
  const [connectionId, setConnectionId] = useState("");
  const [originalSql, setOriginalSql] = useState(originalStarter);
  const [candidateSql, setCandidateSql] = useState(candidateStarter);
  const [warmups, setWarmups] = useState(2);
  const [iterations, setIterations] = useState(10);
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connections = useQuery({
    queryKey: ["connections", workspace],
    queryFn: () => apiFetch<Connection[]>(`/workspaces/${workspace}/connections`),
  });
  const history = useQuery({
    queryKey: ["benchmarks", workspace],
    queryFn: () => apiFetch<History[]>(`/workspaces/${workspace}/benchmarks`),
  });
  const targets = (connections.data ?? []).filter((item) => item.benchmark_only);

  async function run() {
    if (!connectionId) {
      setError("Choose a connection explicitly marked as an isolated benchmark target.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      setResult(await apiFetch<Result>(`/workspaces/${workspace}/benchmarks`, {
        method: "POST",
        body: JSON.stringify({ connection_id: connectionId, original_sql: originalSql, candidate_sql: candidateSql, warmup_iterations: warmups, measured_iterations: iterations }),
      }));
      await queryClient.invalidateQueries({ queryKey: ["benchmarks", workspace] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Benchmark failed");
    } finally {
      setRunning(false);
    }
  }

  const chartData = result ? [
    { metric: "Median", original: result.original.median_ms, candidate: result.candidate.median_ms },
    { metric: "p95", original: result.original.p95_ms, candidate: result.candidate.p95_ms },
  ] : [];
  return (
    <>
      <PageHeader eyebrow="Verification / Isolated environment" title="Benchmarks" description="Measure optimization candidates with warmups, repeated runs, and empirical result comparison on an explicitly isolated connection." />
      <Card className="mb-3">
        <CardHeader><div><p className="font-mono text-[9px] uppercase text-muted-foreground">New comparison</p><CardTitle className="mt-1">Benchmark two read-only queries</CardTitle></div><FlaskConical className="size-5 text-accent" /></CardHeader>
        <CardContent className="space-y-4">
          <select value={connectionId} onChange={(event) => setConnectionId(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none"><option value="">Select isolated target</option>{targets.map((connection) => <option key={connection.id} value={connection.id}>{connection.name} · {connection.provider}</option>)}</select>
          {targets.length === 0 && <p className="rounded border border-warning/20 bg-warning/5 p-3 text-xs text-warning">Create or reconnect a database with “Isolated benchmark target” enabled before running comparisons.</p>}
          <div className="grid gap-3 lg:grid-cols-2"><SqlField label="Original SQL" value={originalSql} onChange={setOriginalSql} /><SqlField label="Candidate SQL" value={candidateSql} onChange={setCandidateSql} /></div>
          <div className="flex flex-wrap items-end gap-3"><NumberField label="Warmups" value={warmups} min={0} max={20} onChange={setWarmups} /><NumberField label="Measured iterations" value={iterations} min={3} max={100} onChange={setIterations} /><Button onClick={run} disabled={running || targets.length === 0}><Play className="size-4" /> {running ? "Running measured iterations…" : "Run benchmark"}</Button></div>
          {error && <p className="rounded border border-danger/25 bg-danger/10 p-3 text-xs text-danger">{error}</p>}
        </CardContent>
      </Card>
      {result ? <div className="grid gap-3 xl:grid-cols-[1.4fr_.8fr]">
        <Card><CardHeader><div><p className="font-mono text-[9px] uppercase text-muted-foreground">Latency comparison</p><CardTitle className="mt-1">Measured results</CardTitle></div><Badge tone="success">{iterations} iterations</Badge></CardHeader><CardContent><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid vertical={false} stroke="#1d272a" /><XAxis dataKey="metric" tick={{ fill: "#718084", fontSize: 10 }} /><YAxis tick={{ fill: "#718084", fontSize: 9 }} /><Tooltip contentStyle={{ background: "#11181b", border: "1px solid #222c30" }} /><Bar dataKey="original" fill="#536367" /><Bar dataKey="candidate" fill="#42e5c2" /></BarChart></ResponsiveContainer></div><div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3"><Metric label="Median speedup" value={`${result.speedup_ratio.toFixed(2)}×`} /><Metric label="Result comparison" value={result.result_agreement.replaceAll("_", " ")} icon /><Metric label="Rows compared" value={String(result.original.row_count)} /></div></CardContent></Card>
        <div className="space-y-3"><Card><CardHeader><CardTitle>Benchmark protocol</CardTitle><TrendingUp className="size-4 text-accent" /></CardHeader><CardContent><dl className="space-y-3 text-xs">{[["Warmups", String(warmups)], ["Measurements", String(iterations)], ["Original median", `${result.original.median_ms.toFixed(2)} ms`], ["Candidate median", `${result.candidate.median_ms.toFixed(2)} ms`]].map(([term, value]) => <div key={term} className="flex justify-between border-b border-border pb-3"><dt className="text-muted-foreground">{term}</dt><dd className="font-mono text-[10px]">{value}</dd></div>)}</dl></CardContent></Card><Card className="border-warning/20 bg-warning/5"><CardContent className="p-5"><div className="flex gap-3"><Info className="mt-0.5 size-4 shrink-0 text-warning" /><ul className="space-y-2 text-xs leading-5 text-muted-foreground">{result.caveats.map((item) => <li key={item}>{item}</li>)}</ul></div></CardContent></Card></div>
      </div> : <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No benchmark has been run in this session.</CardContent></Card>}
      {history.data && history.data.length > 0 && <div className="mt-5"><h2 className="mb-3 text-sm font-semibold">Recent benchmark runs</h2><div className="space-y-2">{history.data.map((item) => <Card key={item.id}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><Badge tone={item.status === "complete" ? "success" : "warning"}>{item.status}</Badge><div className="min-w-0 flex-1"><p className="truncate font-mono text-[10px]">{item.original_sql}</p><p className="mt-1 font-mono text-[8px] text-muted-foreground">{new Date(item.created_at).toLocaleString()} · {item.result_agreement?.replaceAll("_", " ")}</p></div><span className="font-mono text-sm text-accent">{item.speedup_ratio ? `${item.speedup_ratio.toFixed(2)}×` : "—"}</span></CardContent></Card>)}</div></div>}
    </>
  );
}

function SqlField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="mb-1.5 block font-mono text-[9px] uppercase text-muted-foreground">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={7} className="w-full rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-5 outline-none focus:border-accent" /></label>;
}
function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label><span className="mb-1.5 block font-mono text-[9px] uppercase text-muted-foreground">{label}</span><input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="h-10 w-32 rounded-md border border-border bg-background px-3 text-sm" /></label>;
}
function Metric({ label, value, icon = false }: { label: string; value: string; icon?: boolean }) {
  return <div className="bg-elevated p-4"><span className="font-mono text-[8px] uppercase text-muted-foreground">{label}</span><strong className="mt-2 flex items-center gap-2 text-sm">{icon && <CheckCircle2 className="size-4 text-success" />}{value}</strong></div>;
}
