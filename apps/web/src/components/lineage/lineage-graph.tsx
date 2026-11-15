"use client";

import { useCallback, useMemo, useState } from "react";
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps, useEdgesState, useNodesState } from "@xyflow/react";
import { Database, Search, Table2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DbNode = Node<{ label: string; kind: string; rows?: string; provider: string }, "database">;
const initialNodes: DbNode[] = [
  { id:'customers',type:'database',position:{x:0,y:160},data:{label:'public.customers',kind:'table',rows:'25k',provider:'PostgreSQL'} },
  { id:'orders',type:'database',position:{x:280,y:80},data:{label:'public.orders',kind:'table',rows:'220k',provider:'PostgreSQL'} },
  { id:'items',type:'database',position:{x:560,y:20},data:{label:'public.order_items',kind:'table',rows:'640k',provider:'PostgreSQL'} },
  { id:'payments',type:'database',position:{x:560,y:165},data:{label:'public.payments',kind:'table',rows:'184k',provider:'PostgreSQL'} },
  { id:'ltv',type:'database',position:{x:280,y:280},data:{label:'customer_lifetime_value',kind:'view',provider:'PostgreSQL'} },
  { id:'revenue',type:'database',position:{x:820,y:115},data:{label:'analytics.daily_revenue',kind:'materialized view',provider:'Snowflake'} }
];
const initialEdges: Edge[] = [
  {id:'customers-orders',source:'customers',target:'orders',label:'foreign key',type:'smoothstep',animated:false,data:{kind:'observed'},style:{stroke:'#42e5c2'}},
  {id:'orders-items',source:'orders',target:'items',label:'foreign key',type:'smoothstep',data:{kind:'observed'},style:{stroke:'#42e5c2'}},
  {id:'orders-payments',source:'orders',target:'payments',label:'foreign key',type:'smoothstep',data:{kind:'observed'},style:{stroke:'#42e5c2'}},
  {id:'customers-ltv',source:'customers',target:'ltv',label:'view dependency',type:'smoothstep',data:{kind:'observed'},style:{stroke:'#42e5c2'}},
  {id:'orders-ltv',source:'orders',target:'ltv',label:'view dependency',type:'smoothstep',data:{kind:'observed'},style:{stroke:'#42e5c2'}},
  {id:'items-revenue',source:'items',target:'revenue',label:'parsed SQL',type:'smoothstep',animated:true,data:{kind:'heuristic'},style:{stroke:'#f3b45f',strokeDasharray:'4 4'}}
];

function DatabaseNode({ data, selected }: NodeProps<DbNode>) {
  return <div className={cn("w-56 rounded-lg border bg-surface shadow-xl",selected?'border-accent':'border-border')}><Handle type="target" position={Position.Left} className="!size-2 !border-background !bg-muted-foreground"/><div className="flex items-center gap-3 border-b border-border p-3"><span className="grid size-8 place-items-center rounded bg-elevated text-accent">{data.kind==='table'?<Table2 className="size-4"/>:<Database className="size-4"/>}</span><div className="min-w-0"><p className="truncate font-mono text-[10px] font-medium">{data.label}</p><p className="mt-0.5 font-mono text-[8px] uppercase text-muted-foreground">{data.kind}</p></div></div><div className="flex items-center justify-between px-3 py-2 font-mono text-[8px] text-muted-foreground"><span>{data.provider}</span><span>{data.rows??'derived'}</span></div><Handle type="source" position={Position.Right} className="!size-2 !border-background !bg-accent"/></div>;
}

const nodeTypes = { database: DatabaseNode };

export function LineageGraph() {
  const [nodes,setNodes,onNodesChange] = useNodesState(initialNodes);
  const [edges,setEdges,onEdgesChange] = useEdgesState(initialEdges);
  const [search,setSearch] = useState('');
  const [selected,setSelected] = useState<string|null>(null);
  const visible = useMemo(()=>nodes.map(node=>({...node,hidden:Boolean(search&&!node.data.label.toLowerCase().includes(search.toLowerCase()))})),[nodes,search]);
  const focusNode = useCallback((_: unknown,node:DbNode)=>{setSelected(node.id);const connected=new Set([node.id]);edges.forEach(edge=>{if(edge.source===node.id)connected.add(edge.target);if(edge.target===node.id)connected.add(edge.source)});setNodes(current=>current.map(item=>({...item,style:{opacity:connected.has(item.id)?1:.25}})));setEdges(current=>current.map(edge=>({...edge,style:{...edge.style,opacity:edge.source===node.id||edge.target===node.id?1:.15}})));},[edges,setEdges,setNodes]);
  function reset(){setSelected(null);setNodes(current=>current.map(item=>({...item,style:{opacity:1}})));setEdges(current=>current.map(edge=>({...edge,style:{...edge.style,opacity:1}})));}
  return <div className="relative h-[680px] overflow-hidden rounded-lg border border-border bg-[#090d0f]"><div className="absolute left-4 top-4 z-10 flex w-[calc(100%-2rem)] flex-wrap items-center gap-2"><label className="flex h-9 w-72 items-center gap-2 rounded-md border border-border bg-surface px-3 shadow-xl"><Search className="size-3.5 text-muted-foreground"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Find tables or views…" className="min-w-0 flex-1 bg-transparent text-xs outline-none"/></label>{selected&&<Button variant="secondary" size="sm" onClick={reset}>Clear focus</Button>}<div className="ml-auto hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 md:flex"><Badge tone="success">Verified</Badge><Badge tone="warning">Parsed SQL</Badge><Badge>Inferred</Badge></div></div><ReactFlow nodes={visible} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={focusNode} nodeTypes={nodeTypes} fitView minZoom={.35} maxZoom={1.8} colorMode="dark"><Background color="#1d272a" gap={28} size={1}/><Controls position="bottom-left" className="!border-border !bg-surface !fill-foreground"/><MiniMap position="bottom-right" nodeColor="#283538" maskColor="rgba(8,12,14,.72)" className="!border !border-border !bg-surface"/></ReactFlow></div>;
}
