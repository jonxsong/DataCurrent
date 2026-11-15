"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { ApiError, apiFetch } from "@/lib/api";
import type { Session, WorkspaceSettings } from "@/lib/types";

export function WorkspaceShell({
  workspace,
  children,
}: {
  workspace: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<Session>("/auth/session"),
    retry: false,
  });
  const settings = useQuery({
    queryKey: ["workspace", workspace],
    queryFn: () => apiFetch<WorkspaceSettings>(`/workspaces/${workspace}`),
    enabled: session.isSuccess,
    retry: false,
  });

  useEffect(() => {
    const error = session.error ?? settings.error;
    if (error instanceof ApiError && [401, 404].includes(error.status)) {
      router.replace("/login");
    }
  }, [router, session.error, settings.error]);

  if (session.isPending || settings.isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-center">
          <div className="mx-auto size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="mt-3 font-mono text-[10px] text-muted-foreground">
            Loading authorized workspace…
          </p>
        </div>
      </div>
    );
  }

  if (!session.data || !settings.data) return null;
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        workspace={workspace}
        workspaceName={settings.data.name}
        user={session.data.user}
      />
      <div className="lg:pl-60">
        <AppHeader
          workspace={workspace}
          workspaceName={settings.data.name}
          role={settings.data.role}
        />
        <main className="p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
