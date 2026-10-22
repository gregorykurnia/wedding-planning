import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.9: Who pays in demonstration mode. There is no database, so there are
// no funders and nothing is booked: only Not assigned, and adding is turned off.

async function openWhoPays(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/budget/who-pays");
  await expect(page.getByRole("heading", { name: "Who pays", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("shows only Not assigned, the nothing-booked note and a way back to the budget", async ({ page }) => {
  await openWhoPays(page);
  await expect(page.getByText("What each of you and your families have paid, and what’s still to pay")).toBeVisible();
  await expect(page.getByRole("link", { name: "Budget" })).toHaveAttribute("href", "/budget");
  await expect(page.getByText(/^Nothing is booked yet, so nobody owes anything\./)).toBeVisible();

  const rows = page.locator("main li");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Not assigned");
  await expect(rows.first()).toContainText("Every cost has a funder");
  await expect(rows.first()).toContainText("Rp 0");
  // Nothing has no funder, so there is nothing to look at.
  await expect(page.getByRole("link", { name: "See what has no funder" })).toHaveCount(0);
  // The closing note only appears once something is booked.
  await expect(page.getByText(/Together that’s/)).toHaveCount(0);
});

test("Add a funder opens its row, but Add funder is off and says why", async ({ page }) => {
  await openWhoPays(page);
  await page.getByRole("button", { name: "Add a funder" }).click();

  const input = page.getByLabel("New funder’s name");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("placeholder", "For example, Tante Lily");
  await expect(page.getByRole("button", { name: "Add funder" })).toBeDisabled();
  await expect(page.getByText("Demonstration mode: adding is turned off.")).toBeVisible();
  // The add button is the row's while it's open.
  await expect(page.getByRole("button", { name: "Add a funder" })).toHaveCount(0);

  // Enter adds nothing either.
  await input.fill("Tante Lily");
  await input.press("Enter");
  await expect(page.locator("main li")).toHaveCount(2);
  await expect(input).toBeVisible();
});

test("Escape and Cancel close the row and give focus back to Add a funder", async ({ page }) => {
  await openWhoPays(page);
  const add = page.getByRole("button", { name: "Add a funder" });

  await add.click();
  await page.getByLabel("New funder’s name").press("Escape");
  await expect(page.getByLabel("New funder’s name")).toHaveCount(0);
  await expect(add).toBeFocused();

  await add.click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("New funder’s name")).toHaveCount(0);
  await expect(add).toBeFocused();
});

test("is one column inside the page at both widths, with the figures on one line", async ({ page }) => {
  await openWhoPays(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const row = page.locator("main li").first();
    const box = await row.boundingBox();
    expect(box).not.toBeNull();
    // The default column is 680px wide on a desktop, with 20px sides on a phone.
    if (width === 1440) expect(Math.round(box!.width)).toBeLessThanOrEqual(680);
    else expect(Math.round(box!.x)).toBeGreaterThanOrEqual(20);
    const rest = row.locator("span", { hasText: /^Rp 0$/ });
    const lines = await rest.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
    expect(lines).toBe(1);
  }
});
