import { expect, test } from "@playwright/test";

const workspaceId = "11111111-1111-4111-8111-111111111111";

test("a user creates an account and enters a live-data workspace", async ({
  page,
}) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/config")) {
      await route.fulfill({ json: { registration_enabled: true } });
      return;
    }
    if (path.endsWith("/auth/register") || path.endsWith("/auth/session")) {
      await route.fulfill({
        json: {
          user: {
            id: "user-1",
            email: "owner@example.com",
            display_name: "Release Owner",
          },
          workspaces: [
            {
              id: workspaceId,
              name: "Production",
              slug: "production",
              role: "owner",
            },
          ],
        },
      });
      return;
    }
    if (path.endsWith(`/workspaces/${workspaceId}`)) {
      await route.fulfill({
        json: {
          id: workspaceId,
          name: "Production",
          slug: "production",
          role: "owner",
          retention_days: 30,
          member_count: 1,
          ai_configured: true,
          encryption_configured: true,
        },
      });
      return;
    }
    if (path.endsWith("/overview")) {
      await route.fulfill({
        json: {
          time_range_hours: 24,
          execution_count: { value: 1200, available: true },
          mean_latency_ms: { value: 18.4, available: true },
          total_execution_time_ms: { value: 22080, available: true },
          active_queries: { value: 1, available: true },
          latency_series: [
            {
              captured_at: new Date().toISOString(),
              mean_time_ms: 18.4,
              p95_time_ms: 31.2,
            },
          ],
          recent_regressions: [],
          slowest_queries: [],
          data_freshness: new Date().toISOString(),
          limitations: [],
        },
      });
      return;
    }
    if (path.endsWith("/queries")) {
      await route.fulfill({
        json: { items: [], page: 1, page_size: 100, total: 0 },
      });
      return;
    }
    if (path.endsWith("/investigations")) {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fulfill({ json: [] });
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Understand your data/i }),
  ).toBeVisible();
  await expect(page.getByLabel("DataCurrent").first()).toBeVisible();

  await page.getByRole("link", { name: /Open the application/i }).click();
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Release Owner");
  await page.getByLabel("Workspace name").fill("Production");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("ProductionPass123!");
  await page.getByRole("button", { name: /Create workspace/i }).click();

  await expect(page).toHaveURL(new RegExp(`/app/${workspaceId}/overview$`));
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("1.2K")).toBeVisible();
  await page.getByRole("link", { name: "AI Investigator" }).click();
  await expect(
    page.getByRole("heading", { name: "AI Investigator" }),
  ).toBeVisible();
  await expect(page.getByText(/Choose a collected query/i)).toBeVisible();
});
