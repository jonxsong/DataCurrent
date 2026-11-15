import { PageHeader } from "@/components/app/page-header";
import { ConnectionManager } from "@/components/connections/connection-manager";

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
      />
      <ConnectionManager workspace={workspace} />
    </>
  );
}
