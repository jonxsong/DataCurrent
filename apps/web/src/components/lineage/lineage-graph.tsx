"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { Database, RefreshCcw, Search, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { Connection, LineageGraphResponse } from "@/lib/types";
import { cn, formatCompact } from "@/lib/utils";

type DbNode = Node<{ label: string; kind: string; rows?: string; provider: string }, "database">;

function DatabaseNode({ data, selected }: NodeProps<DbNode>) {
  return (
    <div className={cn("w-56 rounded-lg border bg-surface shadow-xl", selected ? "border-accent" : "border-border")}>
      <Handle type="target" position={Position.Left} className="!size-2 !border-background !bg-muted-foreground" />
      <div className="flex items-center gap-3 border-b border-border p-3"><span className="grid size-8 place-items-center rounded bg-elevated text-accent">{data.kind === "table" ? <Table2 className="size-4" /> : <Database className="size-4" />}</span><div className="min-w-0"><p className="truncate font-mono text-[10px] font-medium">{data.label}</p><p className="mt-0.5 font-mono text-[8px] uppercase text-muted-foreground">{data.kind}</p></div></div>
      <div className="flex items-center justify-between px-3 py-2 font-mono text-[8px] text-muted-foreground"><span>{data.provider}</span><span>{data.rows ?? "derived"}</span></div>
      <Handle type="source" position={Position.Right} className="!size-2 !border-background !bg-accent" />
    </div>
  );
}

const nodeTypes = { database: DatabaseNode };

export function LineageGraph({ workspace }: { workspace: string }) {
  const queryClient = useQueryClient();
  const [connectionId, setConnectionId] = useState("");
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<DbNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const connections = useQuery({
    queryKey: ["connections", workspace],
    queryFn: () => apiFetch<Connection[]>(`/workspaces/${workspace}/connections`),
  });
  const graph = useQuery({
    queryKey: ["lineage", workspace, connectionId],
    queryFn: () => apiFetch<LineageGraphResponse>(`/workspaces/${workspace}/lineage/graph${connectionId ? `?connection_id=${connectionId}` : ""}`),
  });

  useEffect(() => {
    if (!graph.data) return;
    const provider = connections.data?.find((item) => item.id === connectionId)?.provider ?? "database";
    setNodes(graph.data.nodes.map((node, index) => ({
      id: node.id,
      type: "database",
      position: { x: (index % 4) * 280, y: Math.floor(index / 4) * 170 },
      data: {
        label: node.label,
        kind: node.kind,
        provider,
        ...(typeof node.metadata.estimated_rows === "number"
          ? { rows: formatCompact(node.metadata.estimated_rows) }
          : {}),
      },
    })));
    setEdges(graph.data.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.relationship.replaceAll("_", " "),
      type: "smoothstep",
      animated: edge.evidence_kind !== "observed",
      data: { kind: edge.evidence_kind },
      style: { stroke: edge.evidence_kind === "observed" ? "#42e5c2" : "#f3b45f", strokeDasharray: edge.evidence_kind === "observed" ? undefined : "4 4" },
    })));
  }, [connectionId, connections.data, graph.data, setEdges, setNodes]);

  async function sync() {
    if (!connectionId) {
      setError("Select a connection to sync its catalog.");
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      await apiFetch(`/workspaces/${workspace}/lineage/connections/${connectionId}/sync`, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["lineage", workspace, connectionId] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Catalog sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const visible = useMemo(() => nodes.map((node) => ({ ...node, hidden: Boolean(search && !node.data.label.toLowerCase().includes(search.toLowerCase())) })), [nodes, search]);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={connectionId} onChange={(event) => setConnectionId(event.target.value)} className="h-9 min-w-60 rounded-md border border-border bg-surface px-3 text-xs outline-none"><option value="">All connections</option>{(connections.data ?? []).map((connection) => <option key={connection.id} value={connection.id}>{connection.name} · {connection.provider}</option>)}</select>
        <Button size="sm" variant="secondary" onClick={sync} disabled={syncing || !connectionId}><RefreshCcw className={cn("size-3.5", syncing && "animate-spin")} /> {syncing ? "Syncing…" : "Sync catalog"}</Button>
      </div>
      {error && <p className="mb-3 rounded-md border border-danger/25 bg-danger/10 p-3 text-xs text-danger">{error}</p>}
      <div className="relative h-[680px] overflow-hidden rounded-lg border border-border bg-[#090d0f]">
        <div className="absolute left-4 top-4 z-10 flex w-[calc(100%-2rem)] flex-wrap items-center gap-2">
          <label className="flex h-9 w-72 items-center gap-2 rounded-md border border-border bg-surface px-3 shadow-xl"><Search className="size-3.5 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find tables or views…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>
          <div className="ml-auto hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 md:flex"><Badge tone="success">Verified</Badge><Badge tone="warning">Parsed SQL</Badge><Badge>Inferred</Badge></div>
        </div>
        {graph.isPending ? <div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">Loading lineage graph…</div> : visible.length === 0 ? <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground"><p>There are no catalog objects yet. Select a connection and sync its catalog.</p></div> : <ReactFlow nodes={visible} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={nodeTypes} fitView minZoom={0.25} maxZoom={1.8} colorMode="dark"><Background color="#1d272a" gap={28} size={1} /><Controls position="bottom-left" className="!border-border !bg-surface !fill-foreground" /><MiniMap position="bottom-right" nodeColor="#283538" maskColor="rgba(8,12,14,.72)" className="!border !border-border !bg-surface" /></ReactFlow>}
      </div>
    </div>
  );
}
