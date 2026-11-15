"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bot, Database, FileSearch, Send, ShieldCheck, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { QueryPage } from "@/lib/types";

type Evidence = { source_type: string; source_id: string; observation: string };
type Report = {
  summary: string;
  findings: Array<{
    title: string;
    kind: "observed" | "heuristic" | "hypothesis";
    explanation: string;
    evidence: Evidence[];
    recommendation?: string;
    proposed_sql?: string;
    tradeoffs: string[];
    confidence: string;
    missing_evidence: string[];
  }>;
  verification_plan: string[];
  limitations: string[];
};
type InvestigationSummary = {
  id: string;
  query_id: string | null;
  title: string;
  status: string;
  summary: string | null;
  created_at: string;
};

export function InvestigatorWorkspace({ workspace }: { workspace: string }) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("Why did this query get slower?");
  const [queryId, setQueryId] = useState(searchParams.get("query") ?? "");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queries = useQuery({
    queryKey: ["investigator-queries", workspace],
    queryFn: () => apiFetch<QueryPage>(`/workspaces/${workspace}/queries?page_size=100&sort=total_time`),
  });
  const history = useQuery({
    queryKey: ["investigations", workspace],
    queryFn: () => apiFetch<InvestigationSummary[]>(`/workspaces/${workspace}/investigations`),
  });

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ report: Report }>(`/workspaces/${workspace}/investigations`, {
        method: "POST",
        body: JSON.stringify({ question, query_id: queryId || null }),
      });
      setReport(response.report);
      await queryClient.invalidateQueries({ queryKey: ["investigations", workspace] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Investigation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-190px)] gap-3 xl:grid-cols-[.72fr_1.28fr]">
      <Card className="flex flex-col overflow-hidden">
        <div className="border-b border-border p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-accent/10 text-accent"><Sparkles className="size-4" /></span><div><p className="text-sm font-semibold">New investigation</p><p className="font-mono text-[9px] text-muted-foreground">Evidence tools only · no database mutations</p></div></div></div>
        <div className="space-y-3 border-b border-border p-4">
          <label className="block"><span className="mb-1.5 block font-mono text-[9px] uppercase text-muted-foreground">Evidence query</span><select value={queryId} onChange={(event) => setQueryId(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs outline-none"><option value="">Workspace-level question</option>{(queries.data?.items ?? []).map((query) => <option key={query.id} value={query.id}>{query.operation ?? "SQL"} · {query.normalized_sql.slice(0, 72)}</option>)}</select></label>
        </div>
        <div className="flex-1 space-y-3 p-4">
          <div className="rounded-lg border border-border bg-elevated p-4"><div className="flex items-center gap-2"><User className="size-3.5 text-muted-foreground" /><span className="font-mono text-[9px] uppercase text-muted-foreground">You</span></div><p className="mt-3 text-sm">{question}</p></div>
          {report && <div className="rounded-lg border border-accent/20 bg-accent/5 p-4"><div className="flex items-center gap-2"><Bot className="size-3.5 text-accent" /><span className="font-mono text-[9px] uppercase text-accent">DataCurrent</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{report.summary}</p></div>}
          {history.data && history.data.length > 0 && <div><p className="mb-2 font-mono text-[8px] uppercase text-muted-foreground">Saved investigations</p>{history.data.slice(0, 4).map((item) => <div key={item.id} className="mb-2 rounded border border-border p-2"><p className="truncate text-xs">{item.title}</p><p className="mt-1 font-mono text-[8px] text-muted-foreground">{new Date(item.created_at).toLocaleString()} · {item.status}</p></div>)}</div>}
        </div>
        <div className="border-t border-border p-3">
          {error && <p className="mb-2 rounded border border-danger/25 bg-danger/10 p-2 text-xs text-danger">{error}</p>}
          <label className="flex items-end gap-2 rounded-lg border border-border bg-background p-2"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none" /><Button size="icon" onClick={run} disabled={loading || question.length < 3} aria-label="Run investigation"><Send className="size-4" /></Button></label>
          <div className="mt-2 flex gap-2 font-mono text-[8px] text-muted-foreground"><ShieldCheck className="size-3 text-success" /> SQL literals redacted before model context</div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="flex h-14 items-center justify-between border-b border-border px-5"><div><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Investigation report</p><p className="mt-1 text-xs">Observed evidence → hypothesis → verification</p></div>{report && <Badge tone="success">Structured output</Badge>}</div>
        {!report ? <div className="grid h-[560px] place-items-center text-center"><div><FileSearch className="mx-auto size-8 text-muted-foreground" /><h3 className="mt-4 font-semibold">Ask an evidence question</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Choose a collected query for grounded metrics, or ask a workspace-level question. The investigator cannot execute SQL or change schemas.</p></div></div> : (
          <div className="max-h-[720px] space-y-4 overflow-y-auto p-5">
            {report.findings.map((finding, index) => <section key={`${finding.title}-${index}`} className="rounded-lg border border-border bg-elevated/50 p-5"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[9px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><h3 className="font-semibold">{finding.title}</h3><Badge tone={finding.kind === "observed" ? "success" : finding.kind === "heuristic" ? "warning" : "neutral"}>{finding.kind}</Badge><Badge className="ml-auto">{finding.confidence} confidence</Badge></div><p className="mt-4 text-sm leading-6 text-muted-foreground">{finding.explanation}</p><div className="mt-4 space-y-2">{finding.evidence.map((item, evidenceIndex) => <div key={`${item.source_id}-${evidenceIndex}`} className="flex gap-3 border-l-2 border-accent bg-background p-3"><Database className="mt-0.5 size-3.5 shrink-0 text-accent" /><div><span className="font-mono text-[8px] uppercase text-accent">{item.source_type} · {item.source_id}</span><p className="mt-1 text-xs text-muted-foreground">{item.observation}</p></div></div>)}</div>{finding.recommendation && <div className="mt-4 rounded-md border border-border bg-surface p-4"><span className="font-mono text-[8px] uppercase tracking-wider text-accent">Recommendation</span><p className="mt-2 text-sm">{finding.recommendation}</p>{finding.proposed_sql && <pre className="mt-3 overflow-auto rounded bg-background p-3 font-mono text-[10px]">{finding.proposed_sql}</pre>}{finding.tradeoffs.length > 0 && <p className="mt-3 text-xs text-warning">Tradeoffs · {finding.tradeoffs.join(" · ")}</p>}</div>}</section>)}
            <section className="rounded-lg border border-accent/20 bg-accent/5 p-5"><h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-accent" /> Verification plan</h3><ol className="mt-4 space-y-3">{report.verification_plan.map((step, index) => <li key={`${step}-${index}`} className="flex gap-3 text-sm text-muted-foreground"><span className="font-mono text-[9px] text-accent">{index + 1}</span>{step}</li>)}</ol><Button asChild className="mt-5" size="sm"><Link href={`/app/${workspace}/benchmarks`}>Open benchmark <ArrowRight className="size-3.5" /></Link></Button></section>
            {report.limitations.length > 0 && <section className="rounded-lg border border-warning/20 bg-warning/5 p-4"><p className="font-mono text-[8px] uppercase text-warning">Limitations</p><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{report.limitations.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul></section>}
          </div>
        )}
      </Card>
    </div>
  );
}
