"use client";

import { CheckCircle2, FlaskConical, Info, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { metric: "Median", original: 842, candidate: 116 },
  { metric: "p95", original: 1184, candidate: 168 },
];

export function BenchmarkComparison() {
  return (
    <div className="grid gap-3 xl:grid-cols-[1.4fr_.8fr]">
      <Card>
        <CardHeader>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Latency comparison
            </p>
            <CardTitle className="mt-1">
              Repeated isolated measurements
            </CardTitle>
          </div>
          <Badge tone="success">10 iterations</Badge>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: -8, right: 10 }}>
                <CartesianGrid vertical={false} stroke="#1d272a" />
                <XAxis
                  dataKey="metric"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#718084", fontSize: 10 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#718084", fontSize: 9 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#11181b",
                    border: "1px solid #222c30",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="original" fill="#536367" radius={[3, 3, 0, 0]} />
                <Bar dataKey="candidate" fill="#42e5c2" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            <div className="bg-elevated p-4">
              <span className="font-mono text-[8px] uppercase text-muted-foreground">
                Median speedup
              </span>
              <strong className="mt-2 block font-mono text-2xl text-accent">
                7.26×
              </strong>
            </div>
            <div className="bg-elevated p-4">
              <span className="font-mono text-[8px] uppercase text-muted-foreground">
                Result comparison
              </span>
              <strong className="mt-2 flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-success" /> Empirical match
              </strong>
            </div>
            <div className="bg-elevated p-4">
              <span className="font-mono text-[8px] uppercase text-muted-foreground">
                Confidence
              </span>
              <strong className="mt-2 block text-sm">Medium</strong>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <Card>
          <CardHeader>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Methodology
              </p>
              <CardTitle className="mt-1">Benchmark protocol</CardTitle>
            </div>
            <FlaskConical className="size-4 text-accent" />
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-xs">
              {[
                ["Environment", "demo-postgres · isolated"],
                ["Warmups", "2 per candidate"],
                ["Measurements", "10 alternating runs"],
                ["Comparison", "Exact multiset digest"],
                ["Order sensitivity", "Not declared"],
              ].map(([term, value]) => (
                <div
                  key={term}
                  className="flex justify-between gap-4 border-b border-border pb-3 last:border-0"
                >
                  <dt className="text-muted-foreground">{term}</dt>
                  <dd className="text-right font-mono text-[10px]">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="p-5">
            <div className="flex gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-xs leading-5 text-muted-foreground">
                Matching outputs on one dataset are empirical agreement, not
                formal SQL equivalence. Index write and storage costs still
                require review.
              </p>
            </div>
          </CardContent>
        </Card>
        <Button className="w-full">
          <TrendingUp className="size-4" /> Review plan differences
        </Button>
      </div>
    </div>
  );
}
