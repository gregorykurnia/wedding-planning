import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.5: the Bookings screen in demonstration mode. There is no database, so
// nothing is booked: the empty layout shows, with Add booking and a link back to
// the budget, and there is no search or order to use.

async function openBookings(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/budget/bookings");
  await expect(page.getByRole("heading", { name: "Bookings", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("shows the empty layout: nothing booked, with Add booking and a link back to the budget", async ({ page }) => {
  await openBookings(page);
  await expect(page).toHaveTitle("Bookings · Our wedding planner");
  await expect(page.getByRole("heading", { name: "Nothing booked yet", level: 2 })).toBeVisible();
  await expect(page.getByText("Everything you’ve committed to")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add booking" })).toHaveAttribute("href", "/budget/bookings/new");
  await expect(page.getByRole("link", { name: "Budget", exact: true })).toHaveAttribute("href", "/budget");
  await expect(page.getByRole("searchbox")).toHaveCount(0);
});

test("the menu opens from the bookings, with Budget marked as the current section", async ({ page }) => {
  await openBookings(page);
  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await expect(menu.locator('[aria-current="page"]')).toContainText("Budget");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the empty layout fits the width, with no sideways scroll", async ({ page }) => {
    await openBookings(page);
    await expect(page.getByRole("heading", { name: "Nothing booked yet", level: 2 })).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
  });
});
