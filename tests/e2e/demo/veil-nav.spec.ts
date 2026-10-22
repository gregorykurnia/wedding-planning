import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 2.4: the top bar and its menu, the sub-navigation, the back link and the
// add button. The menu is on the new UI's own page; the others are on the
// dev-only gallery at /gallery/nav.

async function lookAround(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
}

async function openNavDemos(page: Page) {
  await lookAround(page);
  await page.goto("/gallery/nav");
  await expect(page.getByRole("heading", { name: "Shell pieces" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
}

test("the top bar shows the app's name in demonstration mode, and Menu is closed", async ({ page }) => {
  await lookAround(page);
  await expect(page.getByRole("link", { name: "Our wedding planner" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
});

test("the couple's names in the top bar are 24px on a phone and on a computer alike (N15)", async ({ page }) => {
  await lookAround(page);
  const names = page.getByRole("link", { name: "Our wedding planner" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(names).toHaveCSS("font-size", "24px");
  }
});

test("Escape closes the menu and returns focus to Menu", async ({ page }) => {
  await lookAround(page);
  const menu = page.getByRole("button", { name: "Menu" });
  await menu.click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});

test("Close returns focus to Menu too", async ({ page }) => {
  await lookAround(page);
  const menu = page.getByRole("button", { name: "Menu" });
  await menu.click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
  await expect(menu).toBeFocused();
});

test("the menu lists the sections, marks the current one, and keeps Tab inside", async ({
  page,
}) => {
  await lookAround(page);
  await page.getByRole("button", { name: "Menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Menu" });

  // The page is the overview, so that entry is the marked one.
  await expect(dialog.getByRole("link", { name: /^Overview/ })).toHaveAttribute("aria-current", "page");
  await expect(dialog.getByRole("link", { name: /^Budget/ })).toHaveAttribute("href", "/budget");
  await expect(dialog.getByRole("link", { name: /^Budget/ })).not.toHaveAttribute("aria-current");
  await expect(dialog.getByRole("link", { name: /^Wedding items/ })).toHaveAttribute("href", "/items");
  await expect(dialog.getByText("Demonstration mode: nobody is signed in")).toBeVisible();

  // Shift+Tab from the first control (Close) wraps to the last (Back to sign-in), and Tab wraps back.
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Back to sign-in" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
});

test("Back to sign-in leaves Look around and shows the sign-in screen", async ({ page }) => {
  await lookAround(page);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: "Back to sign-in" }).click();
  await expect(page).toHaveURL("/sign-in", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("button", { name: "Look around" })).toBeVisible();
});

test("the sub-navigation marks its current word and links to its pages", async ({ page }) => {
  await openNavDemos(page);
  const subnav = page.getByRole("navigation", { name: "Vendors, shortlist and venues" });
  await expect(subnav.getByRole("link", { name: "Shortlist" })).toHaveAttribute("aria-current", "page");
  await expect(subnav.getByRole("link", { name: "Vendors", exact: true })).not.toHaveAttribute("aria-current");
  await expect(subnav.getByRole("link", { name: "Venues" })).toHaveAttribute("href", "/vendors/venues");
});

test("the back link names its parent screen and goes to it", async ({ page }) => {
  await openNavDemos(page);
  await expect(page.getByRole("link", { name: "Budget" })).toHaveAttribute("href", "/budget");
});

test("the add button is a link to its screen, or a button that counts its presses", async ({ page }) => {
  await openNavDemos(page);
  await expect(page.getByRole("link", { name: "Add a finalist" })).toHaveAttribute(
    "href",
    "/vendors/shortlist/new",
  );

  await page.getByRole("button", { name: "Show it as a button" }).click();
  await page.getByRole("button", { name: "Add a finalist" }).click();
  await page.getByRole("button", { name: "Add a finalist" }).click();
  await expect(page.getByText("Pressed 2 times")).toBeVisible();
});
