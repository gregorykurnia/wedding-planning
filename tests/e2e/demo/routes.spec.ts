import { expect, test } from "@playwright/test";

// Guards the route-group move (Task 1.3): every old address keeps working.
const OLD_PATHS = [
  "/",
  "/login",
  "/venues",
  "/vendors",
  "/shortlist",
  "/confirmed",
  "/master-list",
  "/guests",
  "/schedule",
  "/todo",
  "/notes",
  "/files",
  "/settings",
  "/budget",
  "/checklist",
];

for (const path of OLD_PATHS) {
  test(`old address ${path} still renders`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Our Wedding").or(page.getByText("Welcome back")).first()).toBeVisible();
  });
}

test("/new renders the placeholder", async ({ page }) => {
  const response = await page.goto("/new");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("New UI placeholder")).toBeVisible();
});
