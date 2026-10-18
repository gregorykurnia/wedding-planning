import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.8: Payments due in demonstration mode. There is no database, so nothing
// is booked: the empty layout shows, with See bookings and a link back to the budget.

async function openPayments(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/budget/payments");
  await expect(page.getByRole("heading", { name: "Payments due", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("shows the empty layout: nothing to pay, with See bookings and a link back to the budget", async ({ page }) => {
  await openPayments(page);
  await expect(page).toHaveTitle("Payments due · Our wedding planner");
  await expect(page.getByRole("heading", { name: "Nothing to pay right now", level: 2 })).toBeVisible();
  await expect(page.getByText("Once you have bookings with due dates")).toBeVisible();
  await expect(page.getByRole("link", { name: "See bookings" })).toHaveAttribute("href", "/new/budget/bookings");
  await expect(page.getByRole("link", { name: "Budget", exact: true })).toHaveAttribute("href", "/new/budget");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the empty layout fits the width, with no sideways scroll", async ({ page }) => {
    await openPayments(page);
    await expect(page.getByRole("heading", { name: "Nothing to pay right now", level: 2 })).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
  });
});
