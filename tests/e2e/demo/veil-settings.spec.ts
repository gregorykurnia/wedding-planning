import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.25: Wedding settings in demonstration mode. There is no database and
// nobody is signed in, so the name fields are empty and off, the accounts give
// way to one sentence, and there is nothing to sign out of.

async function openSettings(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Wedding settings", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("the fields are empty and off, and the save line says nothing is saved", async ({ page }) => {
  await openSettings(page);
  await expect(page).toHaveTitle(/Wedding settings/);
  await expect(page.getByRole("status").filter({ hasText: "Demonstration mode: changes aren’t saved" })).toBeVisible();

  for (const label of ["First name", "Second name", "Wedding date"]) {
    await expect(page.getByLabel(label)).toBeDisabled();
    await expect(page.getByLabel(label)).toHaveValue("");
  }
  await expect(page.getByText("Every countdown and date works from this.")).toBeVisible();
  await expect(page.getByText("Used wherever the planner addresses you.")).toBeVisible();
});

test("says nobody is signed in instead of the two accounts, and has no Sign out", async ({ page }) => {
  await openSettings(page);
  await expect(page.getByRole("heading", { name: "Who can open the planner", level: 2 })).toBeVisible();
  await expect(
    page.getByText("Demonstration mode: nobody is signed in. Once the planner is connected, only your two accounts can open it."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign out of this/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Swap them" })).toHaveCount(0);
});

test("has the reminders, the install steps and the two doors", async ({ page }) => {
  await openSettings(page);
  await expect(page.getByRole("heading", { name: /^Reminders on this (phone|computer)$/, level: 2 })).toBeVisible();

  const install = page.getByRole("heading", { name: "On your phone", level: 2 });
  await expect(install).toHaveAttribute("id", "install");
  await expect(page.getByText("Add the planner to your home screen and it opens like an app")).toBeVisible();
  await expect(page.getByText("open the planner in Safari, tap Share, then Add to Home Screen.")).toBeVisible();
  await expect(page.getByText("open it in Chrome, tap the menu, then Install app.")).toBeVisible();

  await expect(page.getByRole("link", { name: /Who pays/ })).toHaveAttribute("href", "/budget/who-pays");
  await expect(page.getByRole("link", { name: /^Categories/ })).toHaveAttribute("href", "/vendors?categories=1");
});

test("the notification button is off in demonstration mode", async ({ page }) => {
  await openSettings(page);
  // A browser that has notifications offers Allow, off here; one without them (N6) says so instead.
  const allow = page.getByRole("button", { name: "Allow notifications" });
  if (await allow.count()) await expect(allow).toBeDisabled();
});
