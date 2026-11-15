"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { QueryTable } from "@/components/queries/query-table";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { QueryPage } from "@/lib/types";

export function QueryExplorer({ workspace }: { workspace: string }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("total_time");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["queries", workspace, search, sort, page],
    queryFn: () =>
      apiFetch<QueryPage>(
        `/workspaces/${workspace}/queries?search=${encodeURIComponent(search)}&sort=${sort}&page=${page}&page_size=25`,
      ),
  });
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 25));
  return (
    <>
      <PageHeader
        eyebrow="Observability / Fingerprints"
        title="Query Explorer"
        description="Search normalized SQL and inspect cumulative PostgreSQL statistics or sampled Snowflake observations."
      />
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row">
        <label className="flex h-9 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            aria-label="Search queries"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search normalized SQL…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <select
          aria-label="Sort queries"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-border bg-background px-3 text-xs outline-none"
        >
          <option value="total_time">Total execution time</option>
          <option value="mean_time">Mean latency</option>
          <option value="calls">Execution count</option>
          <option value="last_seen">Last seen</option>
        </select>
      </div>
      {query.error && (
        <p className="mb-3 rounded-lg border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
          {query.error.message}
        </p>
      )}
      <QueryTable
        workspace={workspace}
        rows={query.data?.items ?? []}
        loading={query.isPending}
      />
      <div className="mt-4 flex items-center justify-between">
        <p className="font-mono text-[9px] text-muted-foreground">
          {query.data?.total ?? 0} fingerprints · page {page} of {pages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
