import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 6.5: an address that no page matches (guide §5.25). The top
// bar and menu stay, the address is shown, and the ways back are the overview
// and the three doors.

async function lookAround(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
}

test("an address that leads nowhere says so, inside the planner's own top bar", async ({
  page,
}) => {
  await lookAround(page);
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "This page isn’t here" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeVisible();
  await expect(page.getByText("/no-such-page", { exact: true })).toBeVisible();
});

test("Open the menu opens the menu, and Go to the overview goes home", async ({ page }) => {
  await lookAround(page);
  await page.goto("/no-such-page");
  await page.getByRole("button", { name: "Open the menu" }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("link", { name: "Go to the overview" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: COMPILE_TIMEOUT });
});

test("the three doors lead to Budget, Schedule and Guests", async ({ page }) => {
  await lookAround(page);
  await page.goto("/no-such-page");
  await expect(page.getByRole("link", { name: /^Budget/ })).toHaveAttribute("href", "/budget");
  await expect(page.getByRole("link", { name: /^Schedule/ })).toHaveAttribute(
    "href",
    "/schedule",
  );
  await expect(page.getByRole("link", { name: /^Guests/ })).toHaveAttribute("href", "/guests");
});
