"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Braces, CheckCircle2, Clock3, Play, ShieldCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { Connection, QueryDetail } from "@/lib/types";
import { cn, formatCompact } from "@/lib/utils";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="grid h-[430px] place-items-center bg-[#090d0f] font-mono text-xs text-muted-foreground">Loading SQL editor…</div>,
});

const starter = `SELECT current_timestamp AS observed_at;`;

type PlanNodeData = {
  id: string;
  node_type: string;
  relation: string | null;
  total_cost: number | null;
  estimated_rows: number | null;
  actual_rows: number | null;
  filter: string | null;
  index_name: string | null;
  children: PlanNodeData[];
};

type AnalyzeResponse = {
  plan_id: string;
  provider: string;
  parsed_query: Record<string, unknown>;
  plan: { tree?: PlanNodeData | null; raw?: unknown };
  findings: Array<{
    code: string;
    severity: string;
    title: string;
    evidence: string;
    recommendation: string;
    node_id: string;
  }>;
  safety: Record<string, boolean>;
};

export function QueryLabWorkspace({ workspace }: { workspace: string }) {
  const searchParams = useSearchParams();
  const queryId = searchParams.get("query");
  const [sqlOverride, setSqlOverride] = useState<string | null>(null);
  const [connectionOverride, setConnectionOverride] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"plan" | "findings" | "json">("plan");
  const connections = useQuery({
    queryKey: ["connections", workspace],
    queryFn: () => apiFetch<Connection[]>(`/workspaces/${workspace}/connections`),
  });
  const sourceQuery = useQuery({
    queryKey: ["query", workspace, queryId],
    queryFn: () => apiFetch<QueryDetail>(`/workspaces/${workspace}/queries/${queryId}`),
    enabled: Boolean(queryId),
  });

  const sql = sqlOverride ?? sourceQuery.data?.normalized_sql ?? starter;
  const connectionId =
    connectionOverride ??
    sourceQuery.data?.connection_id ??
    connections.data?.[0]?.id ??
    "";

  async function analyze() {
    if (!connectionId) {
      setError("Connect a database before analyzing SQL.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      setResult(await apiFetch<AnalyzeResponse>(`/workspaces/${workspace}/query-lab/analyze`, {
        method: "POST",
        body: JSON.stringify({ connection_id: connectionId, query_id: queryId, sql }),
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Plan analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  const selected = connections.data?.find((item) => item.id === connectionId);
  return (
    <div className="grid min-h-[calc(100vh-180px)] gap-3 xl:grid-cols-[1.05fr_.95fr]">
      <Card className="overflow-hidden">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
          <select value={connectionId} onChange={(event) => { setConnectionOverride(event.target.value); setResult(null); }} className="h-8 rounded-md border border-border bg-background px-3 text-xs outline-none">
            <option value="">Select a connection</option>
            {(connections.data ?? []).map((connection) => <option key={connection.id} value={connection.id}>{connection.name} · {connection.provider}</option>)}
          </select>
          <div className="flex items-center gap-2">
            {selected && <Badge>{selected.provider}</Badge>}
            <Button size="sm" onClick={analyze} disabled={analyzing || !connectionId || sql.trim().length === 0}>
              <Play className={cn("size-3.5", analyzing && "animate-pulse")} />
              {analyzing ? "Analyzing…" : "Explain plan"}
            </Button>
          </div>
        </div>
        <Editor
          height="430px"
          defaultLanguage={selected?.provider === "snowflake" ? "sql" : "pgsql"}
          theme="vs-dark"
          value={sql}
          onChange={(value) => setSqlOverride(value ?? "")}
          options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: "var(--font-geist-mono)", lineHeight: 22, padding: { top: 18 }, scrollBeyondLastLine: false, renderLineHighlight: "line", automaticLayout: true, wordWrap: "on" }}
        />
        {error && <p className="border-t border-danger/25 bg-danger/10 p-3 text-xs text-danger">{error}</p>}
        <div className="border-t border-border p-4">
          <div className="grid gap-2 text-[10px] text-muted-foreground sm:grid-cols-2">
            {([ ["SELECT only", CheckCircle2], ["No ANALYZE", ShieldCheck], ["15s timeout", Clock3], ["Read-only session", ShieldCheck] ] as const).map(([label, Icon]) => <span key={label} className="flex items-center gap-2"><Icon className="size-3.5 text-success" />{label}</span>)}
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="flex h-12 items-center gap-1 border-b border-border px-3">{(["plan", "findings", "json"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={cn("rounded px-3 py-1.5 font-mono text-[10px] capitalize text-muted-foreground", tab === item && "bg-elevated text-foreground")}>{item}</button>)}</div>
        {!result ? (
          <div className="grid h-[500px] place-items-center p-10 text-center"><div><div className="mx-auto grid size-12 place-items-center rounded-lg border border-border bg-elevated text-muted-foreground"><Braces className="size-5" /></div><h3 className="mt-4 font-semibold">Execution plan awaits</h3><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Select a real connection and explain a supported SELECT without executing it.</p></div></div>
        ) : (
          <div className="p-5">
            {tab === "plan" && <div><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Plan tree</p><p className="mt-1 text-xs">Estimated costs · query not executed</p></div><Badge tone="success">Safe explain</Badge></div>{result.plan.tree ? <PlanNode node={result.plan.tree} findings={result.findings} /> : <p className="text-sm text-muted-foreground">The provider returned no structured plan tree.</p>}</div>}
            {tab === "findings" && <div className="space-y-3">{result.findings.length === 0 ? <p className="text-sm text-muted-foreground">No deterministic risk heuristics fired for this plan.</p> : result.findings.map((finding) => <div key={`${finding.code}-${finding.node_id}`} className="rounded-lg border border-warning/25 bg-warning/5 p-4"><div className="flex items-center gap-2"><TriangleAlert className="size-4 text-warning" /><strong className="text-sm">{finding.title}</strong><Badge tone="warning" className="ml-auto">{finding.severity}</Badge></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{finding.evidence}</p><div className="mt-3 border-l-2 border-accent pl-3 text-xs leading-5"><span className="font-mono text-[8px] uppercase text-accent">Recommendation</span><p className="mt-1">{finding.recommendation}</p></div></div>)}</div>}
            {tab === "json" && <pre className="max-h-[520px] overflow-auto rounded-md bg-background p-4 font-mono text-[10px] leading-5 text-muted-foreground">{JSON.stringify(result, null, 2)}</pre>}
          </div>
        )}
      </Card>
    </div>
  );
}

function PlanNode({ node, findings, depth = 0 }: { node: PlanNodeData; findings: AnalyzeResponse["findings"]; depth?: number }) {
  const finding = findings.find((item) => item.node_id === node.id);
  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div className={cn("mb-2 rounded-md border bg-elevated p-3", finding ? "border-warning/35" : "border-border")}>
        <div className="flex items-center justify-between"><strong className="font-mono text-[11px]">{node.node_type}{node.relation ? ` · ${node.relation}` : ""}</strong>{finding && <Badge tone="warning">{finding.severity}</Badge>}</div>
        <div className="mt-2 flex gap-4 font-mono text-[9px] text-muted-foreground"><span>cost {formatCompact(node.total_cost ?? 0)}</span><span>rows {formatCompact(node.actual_rows ?? node.estimated_rows ?? 0)}</span>{node.index_name && <span>index {node.index_name}</span>}</div>
        {node.filter && <code className="mt-2 block truncate font-mono text-[9px] text-warning">Filter: {node.filter}</code>}
      </div>
      {node.children.map((child) => <PlanNode key={child.id} node={child} findings={findings} depth={depth + 1} />)}
    </div>
  );
}
