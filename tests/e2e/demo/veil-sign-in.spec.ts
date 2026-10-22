import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.1: the sign-in gate in demonstration mode (no Firebase configuration).

test("the gate names the planner, and the tab says Sign in", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Our wedding planner" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
  await expect(page.getByText("For the two of us only. Sign in to see everything.")).toBeVisible();
  await expect(page).toHaveTitle("Sign in · Our wedding planner");
});

test("demonstration mode has no form, only a note and Look around", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.locator("main").getByRole("status")).toContainText("isn’t connected to its database yet", {
    timeout: COMPILE_TIMEOUT,
  });
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await page.getByRole("button", { name: "Look around" }).click();
  await expect(page).toHaveURL("/");
});

test("the gate stays inside the phone's width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/sign-in");
  const gate = page.getByRole("heading", { level: 1 });
  await expect(gate).toBeVisible({ timeout: COMPILE_TIMEOUT });
  const box = await gate.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
