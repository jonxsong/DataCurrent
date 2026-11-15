import { QueryExplorer } from "@/components/queries/query-explorer";

export default async function QueriesPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return <QueryExplorer workspace={workspace} />;
}
