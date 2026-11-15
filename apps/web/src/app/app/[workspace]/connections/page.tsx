import { Plus } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { ConnectionManager } from "@/components/connections/connection-manager";
import { Button } from "@/components/ui/button";

export default async function ConnectionsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return (
    <>
      <PageHeader
        eyebrow="Sources / Credentials"
        title="Connections"
        description="Connect PostgreSQL and Snowflake using restricted read-only roles. Credentials are authenticated-encrypted at rest."
        actions={
          <Button size="sm">
            <Plus className="size-3.5" /> Add connection
          </Button>
        }
      />
      <ConnectionManager workspace={workspace} />
    </>
  );
}
