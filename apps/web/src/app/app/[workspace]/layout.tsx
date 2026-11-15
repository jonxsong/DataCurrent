import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar workspace={workspace} />
      <div className="lg:pl-60">
        <AppHeader workspace={workspace} />
        <main className="p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
