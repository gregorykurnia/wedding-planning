import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.10: What-if items in demonstration mode. There is no database, so there
// are no items, and Add opens the sheet with its button off.

test("shows the empty what-if items, and an Add item that is off and says why", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/budget/what-if");
  await expect(page.getByRole("heading", { name: "What-if items", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await expect(page.getByRole("link", { name: "Budget", exact: true }).first()).toHaveAttribute("href", "/budget");
  await expect(page.getByRole("heading", { name: "Try an idea before you commit", level: 2 })).toBeVisible();
  await expect(page.getByText("It stays apart from your real bookings.")).toBeVisible();

  await page.getByRole("button", { name: "Add a what-if item" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a what-if item" });
  await expect(sheet.getByText("Kept apart from your bookings until you decide.")).toBeVisible();
  await expect(sheet.getByLabel("What it is")).toBeVisible();
  await expect(sheet.getByRole("radiogroup", { name: "Who would pay" })).toBeVisible();
  await expect(sheet.getByText("Paying in stages? Add the item first, then split it into parts.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Add item" })).toBeDisabled();
  await expect(sheet.getByText("Demonstration mode: adding is turned off.")).toBeVisible();
});
