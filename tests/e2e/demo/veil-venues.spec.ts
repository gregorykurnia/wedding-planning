import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.15: Venues in demonstration mode. There is no database, so the list is
// empty, and adding is turned off.

test("shows the empty venues, and an Add a venue that is off and says why", async ({ page }) => {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/vendors/venues");
  await expect(page.getByRole("heading", { name: "Venues", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await expect(page.getByText("Places you’re weighing up")).toBeVisible();
  await expect(page.getByRole("link", { name: "Venues", exact: true }).first()).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "No venues yet", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "Add a venue" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a venue" });
  await expect(sheet.getByRole("button", { name: "Add venue" })).toBeDisabled();
  await expect(sheet.getByText("Demonstration mode: adding is turned off.")).toBeVisible();
});
