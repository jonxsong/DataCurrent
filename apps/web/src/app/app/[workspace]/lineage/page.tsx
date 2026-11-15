import { PageHeader } from "@/components/app/page-header";
import { LineageGraph } from "@/components/lineage/lineage-graph";
export default async function LineagePage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return (
    <>
      <PageHeader
        eyebrow="Catalog / Impact analysis"
        title="Data Lineage"
        description="Explore verified foreign keys and view dependencies alongside SQL-parsed relationships. Evidence types remain visually distinct."
      />
      <LineageGraph workspace={workspace} />
    </>
  );
}
