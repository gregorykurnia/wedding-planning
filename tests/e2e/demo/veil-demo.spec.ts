import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 2.3: with no Firebase config, the new UI runs in demonstration mode.
test("demo mode offers Look around, then opens /new", async ({ page }) => {
  await page.goto("/new");
  await expect(page).toHaveURL("/new/sign-in", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);
  await page.getByRole("button", { name: "Look around" }).click();
  await expect(page).toHaveURL("/new");
  await expect(page.getByText("New UI placeholder")).toBeVisible();

  // Look around lasts for the browser session.
  await page.reload();
  await expect(page.getByText("New UI placeholder")).toBeVisible();
});
