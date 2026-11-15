import { QueryDetail } from "@/components/queries/query-detail";

export default async function QueryDetailPage({ params }: { params: Promise<{ workspace: string; queryId: string }> }) {
  const { workspace, queryId } = await params;
  return <QueryDetail workspace={workspace} queryId={queryId} />;
}
