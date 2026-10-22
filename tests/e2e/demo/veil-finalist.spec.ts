import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.14: a finalist's own screen in demonstration mode. There is no database, so there are no
// finalists: any address says so, and offers the way back.

test("says there is nothing on the shortlist in demonstration mode, and offers the way back", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/vendors/shortlist/f-kebun");

  await expect(
    page.getByRole("heading", { name: "Nothing on the shortlist in demonstration mode", level: 1 }),
  ).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("link", { name: "See the shortlist" })).toHaveAttribute("href", "/vendors/shortlist");
  await expect(page.getByRole("link", { name: "Shortlist", exact: true }).first()).toHaveAttribute("href", "/vendors/shortlist");
});
