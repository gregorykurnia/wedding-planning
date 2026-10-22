import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 2.3: with no Firebase config, the new UI runs in demonstration mode.
test("demo mode offers Look around, then opens the overview", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/sign-in", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);
  await page.getByRole("button", { name: "Look around" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "When is the wedding?" })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  // Look around lasts for the browser session.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "When is the wedding?" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
});
