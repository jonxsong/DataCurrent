"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useRef, useState } from "react";
import { CheckCircle2, Database, Plus, RefreshCcw, Server, Snowflake, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { Connection } from "@/lib/types";

type TestResult = {
  ok: boolean;
  latency_ms: number;
  server_version: string | null;
  capabilities: Record<string, unknown>;
  guidance: string[];
};

export function ConnectionManager({ workspace }: { workspace: string }) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<"postgresql" | "snowflake">("postgresql");
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connections = useQuery({
    queryKey: ["connections", workspace],
    queryFn: () => apiFetch<Connection[]>(`/workspaces/${workspace}/connections`),
  });

  function payload(form: FormData) {
    const config = provider === "postgresql"
      ? {
          provider,
          host: form.get("host"),
          port: Number(form.get("port")),
          database: form.get("database"),
          username: form.get("username"),
          password: form.get("password"),
          ssl_mode: form.get("ssl_mode"),
        }
      : {
          provider,
          account: form.get("account"),
          username: form.get("username"),
          password: form.get("password"),
          warehouse: form.get("warehouse") || null,
          database: form.get("database") || null,
          schema: form.get("schema") || null,
          role: form.get("role") || null,
        };
    return {
      name: form.get("name"),
      config,
      benchmark_only: form.get("benchmark_only") === "on",
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = payload(new FormData(event.currentTarget));
      if (!tested) {
        setTested(await apiFetch<TestResult>(`/workspaces/${workspace}/connections/test`, {
          method: "POST",
          body: JSON.stringify(body),
        }));
      } else {
        const created = await apiFetch<Connection>(`/workspaces/${workspace}/connections`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        await apiFetch(`/workspaces/${workspace}/connections/${created.id}/collect`, {
          method: "POST",
        }).catch(() => undefined);
        await queryClient.invalidateQueries({ queryKey: ["connections", workspace] });
        setOpen(false);
        setTested(null);
        event.currentTarget.reset();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection operation failed");
    } finally {
      setBusy(false);
    }
  }

  async function retest(connection: Connection) {
    setError(null);
    try {
      await apiFetch(`/workspaces/${workspace}/connections/${connection.id}/test`, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["connections", workspace] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection test failed");
    }
  }

  async function remove(connection: Connection) {
    if (!window.confirm(`Remove ${connection.name}? Stored telemetry for this connection will also be removed.`)) return;
    await apiFetch(`/workspaces/${workspace}/connections/${connection.id}`, { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["connections", workspace] });
  }

  return (
    <>
      {error && <p className="mb-3 rounded-lg border border-danger/25 bg-danger/10 p-4 text-sm text-danger">{error}</p>}
      <div className="grid gap-3 xl:grid-cols-2">
        {(connections.data ?? []).map((connection) => {
          const capabilities = Object.entries(connection.capabilities)
            .filter(([, enabled]) => Boolean(enabled))
            .map(([name]) => name.replaceAll("_", " "));
          return (
            <Card key={connection.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-md border border-border bg-elevated text-accent">
                    {connection.provider === "snowflake" ? <Snowflake className="size-5" /> : <Database className="size-5" />}
                  </span>
                  <div><CardTitle>{connection.name}</CardTitle><p className="mt-1 font-mono text-[9px] capitalize text-muted-foreground">{connection.provider} · {connection.tls_verify ? "TLS verified" : "TLS verification disabled"}</p></div>
                </div>
                <Badge tone={connection.status === "healthy" ? "success" : "warning"}>{connection.status}</Badge>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-wrap gap-3 font-mono text-[9px] text-muted-foreground">
                  <span>Checked · {connection.last_checked_at ? new Date(connection.last_checked_at).toLocaleString() : "never"}</span>
                  <span>Collected · {connection.last_collected_at ? new Date(connection.last_collected_at).toLocaleString() : "pending"}</span>
                </div>
                <div className="flex flex-wrap gap-2">{capabilities.map((capability) => <Badge key={capability}>{capability}</Badge>)}</div>
                {connection.benchmark_only && <Badge className="mt-3" tone="accent">Isolated benchmark target</Badge>}
                <div className="mt-5 flex gap-2 border-t border-border pt-4">
                  <Button variant="secondary" size="sm" onClick={() => retest(connection)}><RefreshCcw className="size-3.5" /> Test</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(connection)}><Trash2 className="size-3.5" /> Remove</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {connections.isPending && <p className="py-12 text-center font-mono text-xs text-muted-foreground">Loading connections…</p>}
      {!connections.isPending && (connections.data?.length ?? 0) === 0 && <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">No databases connected yet.</div>}
      <button onClick={() => setOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-8 text-sm text-muted-foreground transition hover:border-accent/40 hover:bg-accent/5 hover:text-foreground"><Plus className="size-4" /> Add database connection</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <form ref={formRef} onSubmit={submit} onChange={() => setTested(null)} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-5"><div><h2 className="font-semibold">Add database connection</h2><p className="mt-1 text-xs text-muted-foreground">Credentials are encrypted before storage and never returned.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="size-4" /></Button></div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-2">{(["postgresql", "snowflake"] as const).map((item) => <button type="button" onClick={() => { setProvider(item); setTested(null); }} key={item} className={`flex items-center justify-center gap-2 rounded-md border p-3 text-sm ${provider === item ? "border-accent bg-accent/5 text-accent" : "border-border"}`}>{item === "postgresql" ? <Database className="size-4" /> : <Snowflake className="size-4" />}{item === "postgresql" ? "PostgreSQL" : "Snowflake"}</button>)}</div>
              <Field label="Connection name" name="name" placeholder={provider === "postgresql" ? "Production PostgreSQL" : "Analytics Snowflake"} required />
              {provider === "postgresql" ? <><div className="grid grid-cols-[1fr_120px] gap-3"><Field label="Host" name="host" placeholder="db.example.com" required /><Field label="Port" name="port" defaultValue="5432" required /></div><Field label="Database" name="database" placeholder="app_production" required /></> : <><Field label="Account identifier" name="account" placeholder="org-account" required /><div className="grid grid-cols-2 gap-3"><Field label="Warehouse" name="warehouse" placeholder="COMPUTE_WH" /><Field label="Role" name="role" placeholder="DATACURRENT_READER" /></div><div className="grid grid-cols-2 gap-3"><Field label="Database" name="database" placeholder="ANALYTICS" /><Field label="Schema" name="schema" placeholder="PUBLIC" /></div></>}
              <div className="grid grid-cols-2 gap-3"><Field label="Username" name="username" autoComplete="username" required /><Field label="Password" name="password" type="password" autoComplete="new-password" required /></div>
              {provider === "postgresql" && <label className="block"><span className="mb-1.5 block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">TLS mode</span><select name="ssl_mode" defaultValue="verify-full" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none"><option value="verify-full">Verify full (recommended)</option><option value="verify-ca">Verify CA</option><option value="require">Require encryption</option><option value="disable">Disable (local development only)</option></select></label>}
              <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-xs"><input type="checkbox" name="benchmark_only" className="mt-0.5" /><span><strong className="block text-foreground">Isolated benchmark target</strong><span className="mt-1 block text-muted-foreground">Required before DataCurrent will execute repeated comparison queries.</span></span></label>
              {error && <p className="rounded-md border border-danger/25 bg-danger/10 p-3 text-xs text-danger">{error}</p>}
              {tested && <div className="rounded-md border border-success/25 bg-success/10 p-3 text-xs text-success"><div className="flex items-center gap-2"><CheckCircle2 className="size-4" /> Connection succeeded in {tested.latency_ms.toFixed(1)}ms</div>{tested.server_version && <p className="mt-2 font-mono text-[9px]">{tested.server_version}</p>}</div>}
            </div>
            <div className="flex items-center justify-between border-t border-border p-5"><p className="flex items-center gap-2 font-mono text-[8px] text-muted-foreground"><Server className="size-3" /> bounded timeouts · read-only role required</p><div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Working…" : tested ? "Save connection" : "Test connection"}</Button></div></div>
          </form>
        </div>
      )}
    </>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...input } = props;
  return <label className="block"><span className="mb-1.5 block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span><input {...input} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-accent" /></label>;
}
