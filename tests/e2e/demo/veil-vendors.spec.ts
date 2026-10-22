import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 5.3: the Vendors list and a vendor's own screen in demonstration mode. There is no
// database, so the list is empty, a vendor's own screen says there's no vendor to show, and
// adding is turned off.

test.beforeEach(async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
});

test("the Vendors list is empty, and adding a vendor is off and says why", async ({ page }) => {
  await page.goto("/vendors");
  await expect(page.getByRole("heading", { name: "Vendors", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("heading", { name: "No vendors yet", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "Add a vendor" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a vendor" });
  await expect(sheet.getByRole("button", { name: "Add vendor" })).toBeDisabled();
  await expect(sheet.getByText("Demonstration mode: adding is turned off.")).toBeVisible();
});

test("a vendor's own screen says there's no vendor in demonstration mode, and offers the list", async ({ page }) => {
  await page.goto("/vendors/kebun");
  await expect(page.getByRole("heading", { name: "No vendors in demonstration mode", level: 1 })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
  await expect(page.getByRole("link", { name: "See all vendors" })).toHaveAttribute("href", "/vendors");
});
