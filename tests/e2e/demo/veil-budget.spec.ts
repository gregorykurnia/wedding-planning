import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.3: the budget in demonstration mode. There is no database, so nothing
// is booked: the empty layout shows with Add booking and Try a what-if item, and
// there is no closing line, since there is no wedding date to count to.

async function openBudget(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/budget");
  await expect(page.getByRole("heading", { name: "Budget", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("shows the empty layout: nothing booked, with Add booking and Try a what-if item", async ({ page }) => {
  await openBudget(page);
  await expect(page).toHaveTitle("Budget · Our wedding planner");
  await expect(page.getByRole("heading", { name: "Nothing booked yet", level: 2 })).toBeVisible();
  await expect(page.getByText("When you choose a vendor or book a venue, it lands here")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add booking" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Add booking" })).toHaveAttribute("href", "/budget/bookings/new");
  await expect(page.getByRole("link", { name: "Try a what-if item" })).toHaveAttribute("href", "/budget/what-if");
  await expect(page.getByText(/days until/)).toHaveCount(0);
  await expect(page.getByText("Still to pay", { exact: true })).toHaveCount(0);
});

test("the menu opens from the budget, with Budget marked as the current section", async ({ page }) => {
  await openBudget(page);
  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await expect(menu.locator('[aria-current="page"]')).toContainText("Budget");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the empty layout fits the width, with no sideways scroll", async ({ page }) => {
    await openBudget(page);
    await expect(page.getByRole("heading", { name: "Nothing booked yet", level: 2 })).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
  });
});
