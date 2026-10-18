import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.7: the add-a-booking form in demonstration mode. Nothing is written: the
// form shows with its fields, and Add booking is off with the line that says why.

async function openForm(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/budget/bookings/new");
  await expect(page.getByRole("heading", { name: "Add a booking", level: 1 })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
}

test("shows the form in demonstration mode, with Add booking off and the reason", async ({ page }) => {
  await openForm(page);
  await expect(page).toHaveTitle("Add a booking · Our wedding planner");
  await expect(page.getByLabel("What it is")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add booking" })).toBeDisabled();
  await expect(page.getByText("Demonstration mode: adding is turned off.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/new/budget");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the form fits the width, with no sideways scroll", async ({ page }) => {
    await openForm(page);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
  });
});
