import { WorkspaceShell } from "@/components/app/workspace-shell";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return <WorkspaceShell workspace={workspace}>{children}</WorkspaceShell>;
}
