import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.24: Guests in demonstration mode. There is no database, so the list is empty, and the Add a guest
// sheet's two buttons are off, with the demonstration line.

test("shows no guests yet, with adding off and the reason said", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/guests");
  await expect(page.getByRole("heading", { name: "Guests", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await expect(page.getByText("Who’s coming to what").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "No guests yet", level: 2 })).toBeVisible();
  await expect(page.getByText("Demonstration mode: adding is turned off.").first()).toBeVisible();

  await page.getByRole("button", { name: "Add a guest" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a guest" });
  await expect(sheet.getByText("Will be guest number 1")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Add guest" })).toBeDisabled();
  await expect(sheet.getByRole("button", { name: "Add and start another" })).toBeDisabled();
  await expect(sheet.getByText("Demonstration mode: adding is turned off.")).toBeVisible();
});
