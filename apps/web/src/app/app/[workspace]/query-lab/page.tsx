import { PageHeader } from "@/components/app/page-header";
import { QueryLabWorkspace } from "@/components/query-lab/query-lab-workspace";

export default async function QueryLabPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return (
    <>
      <PageHeader
        eyebrow="Query intelligence / Safe explain"
        title="Query Lab"
        description="Inspect structured execution plans and deterministic findings. DataCurrent never runs EXPLAIN ANALYZE automatically."
      />
      <Suspense fallback={<p className="font-mono text-xs text-muted-foreground">Loading Query Lab…</p>}>
        <QueryLabWorkspace workspace={workspace} />
      </Suspense>
    </>
  );
}
import { Suspense } from "react";

