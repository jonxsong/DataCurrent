import { RefreshCcw } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { LineageGraph } from "@/components/lineage/lineage-graph";
import { Button } from "@/components/ui/button";

export default function LineagePage() {
  return <><PageHeader eyebrow="Catalog / Impact analysis" title="Data Lineage" description="Explore verified foreign keys and view dependencies alongside SQL-parsed relationships. Evidence types remain visually distinct." actions={<Button size="sm" variant="secondary"><RefreshCcw className="size-3.5"/> Sync catalog</Button>}/><LineageGraph/></>;
}
