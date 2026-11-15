import { expect, test } from "@playwright/test";

test("a visitor can move from the product story into a real investigation", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Understand your data/i }),
  ).toBeVisible();
  await expect(page.getByLabel("DataCurrent").first()).toBeVisible();

  await page.getByRole("link", { name: /Explore the working demo/i }).click();
  await expect(page).toHaveURL(/\/app\/demo\/overview$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Snowflake", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("PostgreSQL", { exact: true }).last()).toBeVisible();

  await page.getByRole("link", { name: "AI Investigator" }).click();
  await expect(page.getByRole("heading", { name: "AI Investigator" })).toBeVisible();
  await expect(page.getByText(/grounded in authorized query/i)).toBeVisible();
});
