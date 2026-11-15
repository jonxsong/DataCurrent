import { SettingsWorkspace } from "@/components/settings/settings-workspace";

export default async function SettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return <SettingsWorkspace workspace={workspace} />;
}
