"use client";

import {
  Activity,
  Beaker,
  Database,
  GitBranch,
  Search,
  Settings,
  Sparkles,
  SquareTerminal,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const navigation = [
  ["Overview", "overview", Activity],
  ["Query Lab", "query-lab", SquareTerminal],
  ["Query Explorer", "queries", Search],
  ["Data Lineage", "lineage", GitBranch],
  ["AI Investigator", "investigator", Sparkles],
  ["Benchmarks", "benchmarks", Beaker],
  ["Connections", "connections", Database],
  ["Settings", "settings", Settings],
] as const;

export function AppSidebar({ workspace }: { workspace: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-border bg-[#090d0f] lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link href="/">
          <Logo className="text-accent" />
        </Link>
      </div>
      <div className="px-4 py-5">
        <p className="mb-2 px-2 font-mono text-[9px] uppercase tracking-[.13em] text-muted-foreground">
          Workspace
        </p>
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs">
          <span className="grid size-6 place-items-center rounded bg-accent/10 font-mono text-[9px] text-accent">
            DC
          </span>
          <span>{workspace === "demo" ? "Demo workspace" : "Production"}</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {navigation.map(([label, path, Icon]) => {
          const href = `/app/${workspace}/${path}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={path}
              href={href}
              className={cn(
                "flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-elevated hover:text-foreground",
                active && "bg-elevated text-foreground",
              )}
            >
              <Icon className={cn("size-4", active && "text-accent")} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-elevated text-xs font-semibold">
            DZ
          </span>
          <div>
            <p className="text-xs font-medium">Demo operator</p>
            <p className="font-mono text-[9px] text-muted-foreground">
              workspace owner
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
