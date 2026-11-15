import { OverviewDashboard } from "@/components/overview/overview-dashboard";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return <OverviewDashboard workspace={workspace} />;
}
