import { PageHeader } from "@/components/app/page-header";
import { InvestigatorWorkspace } from "@/components/investigator/investigator-workspace";

export default async function InvestigatorPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return (
    <>
      <PageHeader
        eyebrow="AI / Evidence tools"
        title="AI Investigator"
        description="Ask performance questions grounded in authorized query, plan, metric, schema, and lineage evidence."
      />
      <InvestigatorWorkspace workspace={workspace} />
    </>
  );
}
