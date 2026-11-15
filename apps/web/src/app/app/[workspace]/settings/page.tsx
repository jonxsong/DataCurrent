import { KeyRound, Shield, TimerReset, Users } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Workspace / Policy"
        title="Settings"
        description="Control membership, metric retention, AI data minimization, and workspace security."
      />
      <div className="grid gap-3 xl:grid-cols-2">
        {[
          {
            icon: Users,
            title: "Workspace members",
            copy: "Role-based access is enforced in API queries and database filters.",
            detail: "1 owner · 0 members",
            action: "Manage members",
          },
          {
            icon: TimerReset,
            title: "Metric retention",
            copy: "Historical snapshots are removed by an hourly idempotent retention job.",
            detail: "30 days",
            action: "Change retention",
          },
          {
            icon: Shield,
            title: "AI privacy",
            copy: "SQL literals are redacted and schema context is minimized before external model calls.",
            detail: "Strict minimization",
            action: "Review policy",
          },
          {
            icon: KeyRound,
            title: "Application keys",
            copy: "Database credentials use authenticated encryption with a separately configured key.",
            detail: "Encryption configured",
            action: "View status",
          },
        ].map(({ icon: Icon, title, copy, detail, action }) => (
          <Card key={title}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-md bg-elevated text-accent">
                  <Icon className="size-4" />
                </span>
                <CardTitle>{title}</CardTitle>
              </div>
              <Badge tone="success">Configured</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{copy}</p>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="font-mono text-[10px]">{detail}</span>
                <Button variant="secondary" size="sm">
                  {action}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
