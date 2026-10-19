import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.6: a booking's screen in demonstration mode. There is no database, so
// there is no booking to open: the screen says so, with the way back to Bookings.

async function openBooking(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/budget/bookings/vendor-samaya");
  await expect(page.getByRole("heading", { name: "No bookings in demonstration mode", level: 1 })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
}

test("says there are no bookings in demonstration mode, with a way back to Bookings", async ({ page }) => {
  await openBooking(page);
  await expect(page).toHaveTitle("Booking · Our wedding planner");
  // The demonstration banner says the first half too, so match the message whole.
  await expect(page.getByText("The planner isn’t connected to its database yet, so there are no bookings to open.")).toBeVisible();
  await expect(page.getByRole("link", { name: "See all bookings" })).toHaveAttribute("href", "/new/budget/bookings");
  await expect(page.getByRole("link", { name: "Bookings", exact: true })).toHaveAttribute("href", "/new/budget/bookings");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the message fits the width, with no sideways scroll", async ({ page }) => {
    await openBooking(page);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
  });
});
