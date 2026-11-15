import { expect, test } from "@playwright/test";

test.skip(
  !process.env.DATACURRENT_LIVE_E2E,
  "requires the running Docker stack",
);

test("the real application completes the collected-data workflow", async ({
  page,
}) => {
  const email = process.env.DATACURRENT_E2E_EMAIL;
  const password = process.env.DATACURRENT_E2E_PASSWORD;
  if (!email || !password) throw new Error("live E2E credentials are required");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Top query fingerprints")).toBeVisible();

  await page.getByRole("link", { name: "Query Explorer" }).click();
  await expect(
    page.getByRole("heading", { name: "Query Explorer" }),
  ).toBeVisible();
  await expect(page.locator('a[href*="/queries/"]').first()).toBeVisible();

  await page.getByRole("link", { name: "Query Lab" }).click();
  await expect(page.getByRole("heading", { name: "Query Lab" })).toBeVisible();
  await page.getByRole("button", { name: "Explain plan" }).click();
  await expect(page.getByText("Safe explain")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("link", { name: "Data Lineage" }).click();
  await expect(
    page.getByRole("heading", { name: "Data Lineage" }),
  ).toBeVisible();
  await expect(page.getByText("public.orders")).toBeVisible();

  await page.getByRole("link", { name: "Benchmarks" }).click();
  await expect(page.getByRole("heading", { name: "Benchmarks" })).toBeVisible();
  await expect(page.getByText("Recent benchmark runs")).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("45 days")).toBeVisible();
});
