import { Play } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { BenchmarkComparison } from "@/components/benchmarks/benchmark-comparison";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function BenchmarksPage() {
  return <><PageHeader eyebrow="Verification / Isolated environment" title="Benchmarks" description="Turn optimization hypotheses into measured results with warmups, repeated runs, plan comparisons, and empirical result validation." actions={<Button size="sm"><Play className="size-3.5"/> New benchmark</Button>}/><Card className="mb-3"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><Badge tone="success">Complete</Badge><div className="min-w-0 flex-1"><p className="truncate font-mono text-[11px]">orders.created_at index candidate</p><p className="mt-1 font-mono text-[9px] text-muted-foreground">benchmark_reader · PostgreSQL 17 · run bm_demo_0042</p></div><span className="font-mono text-sm text-accent">7.26× faster</span></CardContent></Card><BenchmarkComparison/></>;
}
