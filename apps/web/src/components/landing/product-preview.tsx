"use client";

import { useState } from "react";
import {
  Activity,
  ArrowRight,
  Database,
  GitBranch,
  Search,
  Sparkles,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const chart = [
  { time: "00:00", p50: 32, p95: 88 },
  { time: "04:00", p50: 35, p95: 104 },
  { time: "08:00", p50: 39, p95: 96 },
  { time: "12:00", p50: 48, p95: 142 },
  { time: "16:00", p50: 44, p95: 118 },
  { time: "20:00", p50: 51, p95: 184 },
  { time: "Now", p50: 43, p95: 152 },
];

const modes = [
  { label: "Overview", icon: Activity },
  { label: "Queries", icon: Search },
  { label: "Lineage", icon: GitBranch },
  { label: "Investigator", icon: Sparkles },
];

export function ProductPreview() {
  const [active, setActive] = useState("Overview");
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#090e10] shadow-[0_50px_140px_rgba(0,0,0,.5)]">
      <div className="flex h-11 items-center border-b border-border px-4 font-mono text-[10px] text-muted-foreground">
        <div className="flex gap-1.5">
          <i className="size-1.5 rounded-full bg-border" />
          <i className="size-1.5 rounded-full bg-border" />
          <i className="size-1.5 rounded-full bg-border" />
        </div>
        <span className="mx-auto">acme-production / workload</span>
        <span className="flex items-center gap-1.5">
          <i className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_#42e5c2]" />{" "}
          live
        </span>
      </div>
      <div className="flex min-h-[580px]">
        <aside className="hidden w-16 shrink-0 flex-col items-center gap-2 border-r border-border py-5 sm:flex">
          <Database className="mb-5 size-4 text-accent" />
          {modes.map(({ label, icon: Icon }) => (
            <button
              key={label}
              aria-label={label}
              onClick={() => setActive(label)}
              className={cn(
                "grid size-9 place-items-center rounded-md text-muted-foreground transition",
                active === label && "bg-accent/10 text-accent",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </aside>
        <div className="min-w-0 flex-1 p-4 sm:p-7">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
                Workload /
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-[-.04em]">
                {active}
              </h3>
            </div>
            <Badge tone="accent">Demo telemetry</Badge>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
            {[
              ["Executions", "2.48M", "+8.2%"],
              ["Mean latency", "42.8ms", "−12.4%"],
              ["DB load", "18.4", "stable"],
              ["Regressions", "03", "review"],
            ].map(([label, value, delta]) => (
              <div key={label} className="bg-surface p-4">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </span>
                <div className="mt-3 flex items-end justify-between">
                  <strong className="font-mono text-xl font-medium">
                    {value}
                  </strong>
                  <small className="font-mono text-[9px] text-accent">
                    {delta}
                  </small>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1.65fr_.85fr]">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Query latency
                  </p>
                  <p className="mt-1 text-xs font-medium">p50 / p95</p>
                </div>
                <span className="font-mono text-[9px] text-accent">● p95</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <defs>
                      <linearGradient id="latency" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0"
                          stopColor="#42e5c2"
                          stopOpacity={0.24}
                        />
                        <stop offset="1" stopColor="#42e5c2" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#657377", fontSize: 9 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#11181b",
                        border: "1px solid #222c30",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="p95"
                      stroke="#42e5c2"
                      fill="url(#latency)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="p50"
                      stroke="#52666a"
                      fill="transparent"
                      strokeWidth={1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Current finding
                </span>
                <Badge tone="warning">High</Badge>
              </div>
              <div className="my-6 grid size-10 place-items-center rounded-md border border-warning/20 bg-warning/10 text-warning">
                <Activity className="size-5" />
              </div>
              <h4 className="font-semibold">Sequential scan regression</h4>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                A filter on{" "}
                <code className="text-foreground">orders.created_at</code> scans
                8.4M rows after cardinality drift.
              </p>
              <div className="mt-5 border-l-2 border-warning bg-elevated p-3 font-mono text-[9px] text-muted-foreground">
                Seq Scan · cost 284,901
              </div>
              <button
                onClick={() => setActive("Investigator")}
                className="mt-5 flex items-center gap-2 font-mono text-[10px] text-accent"
              >
                Inspect evidence <ArrowRight className="size-3" />
              </button>
            </Card>
          </div>
          <div className="mt-3 hidden overflow-hidden rounded-lg border border-border md:block">
            <div className="grid grid-cols-[2fr_.7fr_.5fr_.5fr] bg-surface px-4 py-2 font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
              <span>Query fingerprint</span>
              <span>Database</span>
              <span>Calls</span>
              <span>Mean</span>
            </div>
            {[
              [
                "SELECT o.id, c.name FROM orders o…",
                "PostgreSQL",
                "48.2k",
                "842ms",
              ],
              [
                "SELECT event_type, COUNT(*) FROM events…",
                "Snowflake",
                "12.8k",
                "318ms",
              ],
            ].map((row) => (
              <div
                key={row[0]}
                className="grid grid-cols-[2fr_.7fr_.5fr_.5fr] border-t border-border bg-surface/60 px-4 py-3 font-mono text-[10px] text-muted-foreground"
              >
                <code className="text-foreground">{row[0]}</code>
                <span>{row[1]}</span>
                <span>{row[2]}</span>
                <span>{row[3]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
