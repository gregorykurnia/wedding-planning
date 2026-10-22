import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.23: Wedding items in demonstration mode. There is no database, so the
// list is empty, "Start with common items" is off, and the Add items sheet's Add
// is off, each with the demonstration line.

test("shows nothing tracked, with Start with common items and Add off and the reason said", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/items");
  await expect(page.getByRole("heading", { name: "Wedding items", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await expect(page.getByText("Every piece of the day, and who provides it")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing tracked yet", level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start with common items" })).toBeDisabled();
  await expect(page.getByText("Demonstration mode: adding is turned off.").first()).toBeVisible();

  await page.getByRole("button", { name: "Add items" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add items" });
  await expect(sheet.getByText("At the end of the list. One item per line.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
  await expect(sheet.getByText("Demonstration mode: adding is turned off.")).toBeVisible();
});
