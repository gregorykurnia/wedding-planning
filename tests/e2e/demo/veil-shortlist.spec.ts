import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.13: the Shortlist in demonstration mode. There is no database, so the
// shortlist is empty, and adding is turned off.

test("shows the empty shortlist, a way to Vendors, and an Add finalist that is off and says why", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/vendors/shortlist");
  await expect(page.getByRole("heading", { name: "Shortlist", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await expect(page.getByText("Finalists, side by side")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing on the shortlist yet", level: 2 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Vendors" })).toHaveAttribute("href", "/vendors");

  await page.getByRole("button", { name: "Add a finalist" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a finalist" });
  await expect(sheet.getByRole("button", { name: "Add finalist" })).toBeDisabled();
  await expect(sheet.getByText("Demonstration mode: adding is turned off.")).toBeVisible();
});
