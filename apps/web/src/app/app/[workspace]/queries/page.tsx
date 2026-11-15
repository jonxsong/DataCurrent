import { Filter, Search } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { QueryTable } from "@/components/queries/query-table";
import { Button } from "@/components/ui/button";

export default async function QueriesPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return <><PageHeader eyebrow="Observability / Fingerprints" title="Query Explorer" description="Search normalized SQL and compare cumulative PostgreSQL statistics with sampled Snowflake observations."/><div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row"><label className="flex h-9 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3"><Search className="size-4 text-muted-foreground"/><input aria-label="Search queries" placeholder="Search SQL, tables, or fingerprints…" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"/></label><Button variant="secondary"><Filter className="size-4"/> Filters</Button></div><QueryTable workspace={workspace}/><p className="mt-3 font-mono text-[9px] text-muted-foreground">Demo workspace · PostgreSQL rows are cumulative snapshots; Snowflake rows are sampled query-history observations.</p></>;
}
