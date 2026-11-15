import { Bell, ChevronsUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AppHeader({ workspace }: { workspace: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full bg-success" />
          {workspace === "demo" ? "demo-commerce" : "Primary database"}
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </button>
        <Badge tone={workspace === "demo" ? "warning" : "success"}>
          {workspace === "demo" ? "Demo" : "Live"}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
      </div>
    </header>
  );
}
