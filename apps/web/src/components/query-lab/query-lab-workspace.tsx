"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  Braces,
  CheckCircle2,
  Clock3,
  Play,
  Save,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { demoPlan } from "@/lib/demo-data";
import { cn, formatCompact } from "@/lib/utils";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[430px] place-items-center bg-[#090d0f] font-mono text-xs text-muted-foreground">
      Loading SQL editor…
    </div>
  ),
});
const starter = `SELECT
  o.id,
  o.customer_id,
  o.total_amount,
  o.created_at
FROM orders AS o
WHERE o.created_at >= now() - interval '7 days'
ORDER BY o.created_at DESC;`;

type AnalyzeResponse = {
  plan_id: string;
  plan: { tree?: typeof demoPlan | null };
  findings: Array<{
    code: string;
    severity: string;
    title: string;
    evidence: string;
    recommendation: string;
  }>;
  safety: Record<string, boolean>;
};

export function QueryLabWorkspace({ workspace }: { workspace: string }) {
  const [sql, setSql] = useState(starter);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [tab, setTab] = useState<"plan" | "findings" | "json">("plan");
  async function analyze() {
    setAnalyzing(true);
    try {
      if (workspace === "demo") {
        await new Promise((resolve) => setTimeout(resolve, 650));
        setResult({
          plan_id: "demo-plan",
          plan: { tree: demoPlan },
          findings: [
            {
              code: "large_sequential_scan",
              severity: "high",
              title: "Large sequential scan",
              evidence:
                "Seq Scan reads approximately 8,421,900 rows from orders.",
              recommendation:
                "Benchmark an index on orders.created_at in the isolated demo database.",
            },
          ],
          safety: {
            query_executed: false,
            explain_analyze: false,
            read_only_session: true,
            statement_timeout_enforced: true,
          },
        });
      } else {
        setResult(
          await apiFetch(`/workspaces/${workspace}/query-lab/analyze`, {
            method: "POST",
            body: JSON.stringify({
              connection_id: localStorage.getItem("dc_connection_id"),
              sql,
            }),
          }),
        );
      }
    } finally {
      setAnalyzing(false);
    }
  }
  return (
    <div className="grid min-h-[calc(100vh-180px)] gap-3 xl:grid-cols-[1.05fr_.95fr]">
      <Card className="overflow-hidden">
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Badge>PostgreSQL</Badge>
            <span className="font-mono text-[9px] text-muted-foreground">
              demo-commerce
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              <Save className="size-3.5" /> Save
            </Button>
            <Button size="sm" onClick={analyze} disabled={analyzing}>
              <Play className={cn("size-3.5", analyzing && "animate-pulse")} />
              {analyzing ? "Analyzing…" : "Explain plan"}
            </Button>
          </div>
        </div>
        <Editor
          height="430px"
          defaultLanguage="pgsql"
          theme="vs-dark"
          value={sql}
          onChange={(value) => setSql(value ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "var(--font-geist-mono)",
            lineHeight: 22,
            padding: { top: 18 },
            scrollBeyondLastLine: false,
            renderLineHighlight: "line",
            automaticLayout: true,
            wordWrap: "on",
          }}
          beforeMount={(monaco) => {
            monaco.languages.registerCompletionItemProvider("pgsql", {
              provideCompletionItems: () => ({
                suggestions: [
                  "orders",
                  "customers",
                  "order_items",
                  "products",
                  "events",
                  "created_at",
                  "customer_id",
                ].map((label) => ({
                  label,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: label,
                  range: undefined as never,
                })),
              }),
            });
          }}
        />
        <div className="border-t border-border p-4">
          <div className="grid gap-2 text-[10px] text-muted-foreground sm:grid-cols-2">
            {(
              [
                ["SELECT only", CheckCircle2],
                ["No ANALYZE", ShieldCheck],
                ["15s timeout", Clock3],
                ["Read-only role", ShieldCheck],
              ] as const
            ).map(([label, Icon]) => (
              <span key={String(label)} className="flex items-center gap-2">
                <Icon className="size-3.5 text-success" />
                {String(label)}
              </span>
            ))}
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="flex h-12 items-center gap-1 border-b border-border px-3">
          {(["plan", "findings", "json"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={cn(
                "rounded px-3 py-1.5 font-mono text-[10px] capitalize text-muted-foreground",
                tab === item && "bg-elevated text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        {!result ? (
          <div className="grid h-[500px] place-items-center p-10 text-center">
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-lg border border-border bg-elevated text-muted-foreground">
                <Braces className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">Execution plan awaits</h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                Explain the supported SELECT to inspect operators without
                executing the query.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5">
            {tab === "plan" && (
              <div>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      Plan tree
                    </p>
                    <p className="mt-1 text-xs">
                      Estimated costs · query not executed
                    </p>
                  </div>
                  <Badge tone="success">Safe explain</Badge>
                </div>
                <PlanNode node={result.plan.tree ?? demoPlan} />
              </div>
            )}
            {tab === "findings" && (
              <div className="space-y-3">
                {result.findings.map((finding) => (
                  <div
                    key={finding.code}
                    className="rounded-lg border border-danger/25 bg-danger/5 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <TriangleAlert className="size-4 text-danger" />
                      <strong className="text-sm">{finding.title}</strong>
                      <Badge tone="danger" className="ml-auto">
                        {finding.severity}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      {finding.evidence}
                    </p>
                    <div className="mt-3 border-l-2 border-accent pl-3 text-xs leading-5">
                      <span className="font-mono text-[8px] uppercase text-accent">
                        Recommendation
                      </span>
                      <p className="mt-1">{finding.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab === "json" && (
              <pre className="max-h-[520px] overflow-auto rounded-md bg-background p-4 font-mono text-[10px] leading-5 text-muted-foreground">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function PlanNode({
  node,
  depth = 0,
}: {
  node: typeof demoPlan | (typeof demoPlan.children)[number];
  depth?: number;
}) {
  const children = "children" in node ? node.children : [];
  const severity = "severity" in node ? node.severity : undefined;
  return (
    <div style={{ marginLeft: depth * 24 }} className="relative">
      <div
        className={cn(
          "mb-2 rounded-md border bg-elevated p-3",
          severity === "high" ? "border-danger/35" : "border-border",
        )}
      >
        <div className="flex items-center justify-between">
          <strong className="font-mono text-[11px]">
            {node.nodeType}
            {"relation" in node && node.relation ? ` · ${node.relation}` : ""}
          </strong>
          {severity && <Badge tone="danger">{severity}</Badge>}
        </div>
        <div className="mt-2 flex gap-4 font-mono text-[9px] text-muted-foreground">
          <span>cost {formatCompact(node.cost)}</span>
          <span>rows {formatCompact(node.rows)}</span>
        </div>
        {"filter" in node && node.filter && (
          <code className="mt-2 block truncate font-mono text-[9px] text-warning">
            Filter: {node.filter}
          </code>
        )}
      </div>
      {children?.map((child) => (
        <PlanNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
