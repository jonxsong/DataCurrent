import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("sends authenticated JSON requests to the versioned API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch<{ status: string }>("/healthz")).resolves.toEqual({
      status: "ok",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/healthz",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("maps the API error envelope to a typed error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "forbidden", message: "No access" } }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const request = apiFetch("/workspaces/private");
    await expect(request).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
      message: "No access",
    });
  });
});
