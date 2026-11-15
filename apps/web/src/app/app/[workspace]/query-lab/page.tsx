import { PageHeader } from "@/components/app/page-header";
import { QueryLabWorkspace } from "@/components/query-lab/query-lab-workspace";

export default async function QueryLabPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return <><PageHeader eyebrow="Query intelligence / Safe explain" title="Query Lab" description="Inspect structured execution plans and deterministic findings. DataCurrent never runs EXPLAIN ANALYZE automatically."/><QueryLabWorkspace workspace={workspace}/></>;
}
