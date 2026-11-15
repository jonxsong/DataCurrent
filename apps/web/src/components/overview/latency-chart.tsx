"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { latencySeries } from "@/lib/demo-data";

export function LatencyChart() {
  return <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={latencySeries} margin={{left:-18,right:4,top:12,bottom:0}}><defs><linearGradient id="p95" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#42e5c2" stopOpacity={.2}/><stop offset="1" stopColor="#42e5c2" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#1d272a"/><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill:'#657377',fontSize:9}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#657377',fontSize:9}}/><Tooltip contentStyle={{background:'#11181b',border:'1px solid #222c30',borderRadius:6,fontSize:11}}/><Area type="monotone" dataKey="p95" stroke="#42e5c2" fill="url(#p95)" strokeWidth={2}/><Area type="monotone" dataKey="mean" stroke="#5f7478" fill="transparent" strokeWidth={1}/></AreaChart></ResponsiveContainer></div>;
}
