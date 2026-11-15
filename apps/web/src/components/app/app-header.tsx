"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { apiFetch } from "@/lib/api";

export function AppHeader({
  workspaceName,
  role,
}: {
  workspace: string;
  workspaceName: string;
  role: string;
}) {
  const router = useRouter();
  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full bg-success" />
          {workspaceName}
        </div>
        <Badge tone="success">{role}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Sign out" onClick={logout}>
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
