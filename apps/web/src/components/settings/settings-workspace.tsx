"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Shield, TimerReset, Users } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { WorkspaceSettings } from "@/lib/types";

type Member = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  joined_at: string;
};

export function SettingsWorkspace({ workspace }: { workspace: string }) {
  const queryClient = useQueryClient();
  const [retentionOverride, setRetentionOverride] = useState<number | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const settings = useQuery({
    queryKey: ["workspace", workspace],
    queryFn: () => apiFetch<WorkspaceSettings>(`/workspaces/${workspace}`),
  });
  const members = useQuery({
    queryKey: ["members", workspace],
    queryFn: () => apiFetch<Member[]>(`/workspaces/${workspace}/members`),
  });
  const retention = retentionOverride ?? settings.data?.retention_days ?? 30;
  async function saveRetention() {
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch(`/workspaces/${workspace}`, {
        method: "PATCH",
        body: JSON.stringify({ retention_days: retention }),
      });
      await queryClient.invalidateQueries({
        queryKey: ["workspace", workspace],
      });
      setMessage("Retention policy saved.");
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Unable to save retention",
      );
    } finally {
      setSaving(false);
    }
  }
  const data = settings.data;
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Policy"
        title="Settings"
        description="Review membership, retention, AI availability, and credential-encryption status."
      />
      {message && (
        <p className="mb-3 rounded-md border border-border bg-elevated p-3 text-xs">
          {message}
        </p>
      )}
      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-md bg-elevated text-accent">
                <Users className="size-4" />
              </span>
              <CardTitle>Workspace members</CardTitle>
            </div>
            <Badge tone="success">{data?.member_count ?? 0}</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(members.data ?? []).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div>
                    <p className="text-sm">{member.display_name}</p>
                    <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                  <Badge>{member.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-md bg-elevated text-accent">
                <TimerReset className="size-4" />
              </span>
              <CardTitle>Metric retention</CardTitle>
            </div>
            <Badge>{data?.retention_days ?? "—"} days</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Historical snapshots older than this policy are removed by the
              idempotent retention worker.
            </p>
            <div className="mt-5 flex items-end gap-3">
              <label>
                <span className="mb-1.5 block font-mono text-[9px] uppercase text-muted-foreground">
                  Days
                </span>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={retention}
                  onChange={(event) =>
                    setRetentionOverride(Number(event.target.value))
                  }
                  className="h-10 w-32 rounded-md border border-border bg-background px-3"
                />
              </label>
              <Button
                onClick={saveRetention}
                disabled={
                  saving || !["owner", "admin"].includes(data?.role ?? "")
                }
              >
                {saving ? "Saving…" : "Save policy"}
              </Button>
            </div>
          </CardContent>
        </Card>
        <StatusCard
          icon={Shield}
          title="AI investigator"
          configured={Boolean(data?.ai_configured)}
          copy="The OpenAI key is held server-side. SQL literals are redacted and only authorized evidence enters model context."
        />
        <StatusCard
          icon={KeyRound}
          title="Credential encryption"
          configured={Boolean(data?.encryption_configured)}
          copy="Database credentials are authenticated-encrypted at rest with the separately configured application key."
        />
      </div>
    </>
  );
}

function StatusCard({
  icon: Icon,
  title,
  configured,
  copy,
}: {
  icon: typeof Shield;
  title: string;
  configured: boolean;
  copy: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-elevated text-accent">
            <Icon className="size-4" />
          </span>
          <CardTitle>{title}</CardTitle>
        </div>
        <Badge tone={configured ? "success" : "warning"}>
          {configured ? "Configured" : "Unavailable"}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">{copy}</p>
      </CardContent>
    </Card>
  );
}
