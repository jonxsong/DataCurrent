import { ArrowLeft, BarChart3, Clock, Rows3, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { demoPlan, demoQueries } from "@/lib/demo-data";
import { formatCompact, formatDuration } from "@/lib/utils";

export default async function QueryDetailPage({ params }: { params: Promise<{ workspace: string; queryId: string }> }) {
  const { workspace, queryId } = await params;
  const query = demoQueries.find(item => item.id === queryId);
  if (!query) notFound();
  return <><Button asChild variant="ghost" size="sm" className="mb-5 -ml-3"><Link href={`/app/${workspace}/queries`}><ArrowLeft className="size-4"/> Query Explorer</Link></Button><PageHeader eyebrow={`${query.provider} / Query fingerprint`} title="Query detail" description="Historical behavior, plan evidence, and deterministic findings for this normalized query." actions={<Button asChild><Link href={`/app/${workspace}/investigator?query=${query.id}`}><Sparkles className="size-4"/> Investigate</Link></Button>}/><Card><CardHeader><div><Badge>{query.operation}</Badge><CardTitle className="mt-3">Normalized SQL</CardTitle></div><span className="font-mono text-[9px] text-muted-foreground">Literals redacted</span></CardHeader><CardContent><pre className="overflow-x-auto rounded-md border border-border bg-background p-4 font-mono text-xs leading-6 text-foreground"><code>{query.sql}</code></pre></CardContent></Card><div className="my-3 grid gap-3 sm:grid-cols-3">{[["Mean latency",formatDuration(query.mean),Clock],["Executions",formatCompact(query.calls),BarChart3],["Rows processed",formatCompact(query.rows),Rows3]].map(([label,value,Icon])=><Card key={String(label)}><CardContent className="flex items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded bg-elevated"><Icon className="size-4 text-accent"/></span><div><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{String(label)}</p><p className="mt-1 font-mono text-lg">{String(value)}</p></div></CardContent></Card>)}</div><Card><CardHeader><div><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Execution plan</p><CardTitle className="mt-1">Operator tree</CardTitle></div><Badge tone="warning">1 finding</Badge></CardHeader><CardContent><div className="space-y-3"><div className="rounded-md border border-border bg-elevated p-4"><div className="flex items-center justify-between"><strong className="font-mono text-xs">{demoPlan.nodeType}</strong><span className="font-mono text-[9px] text-muted-foreground">cost {formatCompact(demoPlan.cost)}</span></div><div className="ml-6 mt-3 rounded-md border border-danger/30 bg-danger/5 p-4"><div className="flex items-center justify-between"><strong className="font-mono text-xs">Seq Scan · orders</strong><Badge tone="danger">High</Badge></div><p className="mt-2 font-mono text-[10px] text-muted-foreground">rows {formatCompact(demoPlan.children[0]?.rows)} · filter created_at</p></div></div></div></CardContent></Card></>;
}
