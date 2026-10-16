import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Phase 2 review S5 and S6: the shell draws the top bar and the demonstration
// banner above main, outside it, and screens sit in a centred page column.

async function lookAround(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
}

const BANNER = "Demonstration mode. The planner isn’t connected to its database yet";

test("the top bar and the demonstration banner come before main, outside it", async ({ page }) => {
  await lookAround(page);

  // The top bar is the page's banner landmark, which it can't be inside main
  // (the hero's own header there isn't one).
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("banner").getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(page.locator("main").getByRole("button", { name: "Menu" })).toHaveCount(0);
  await expect(page.locator("main").getByText(BANNER, { exact: false })).toHaveCount(0);

  // In order: the top bar, the banner, then main.
  const inOrder = await page.evaluate(() => {
    const header = document.querySelector("body header:not(main header)");
    const main = document.querySelector("main");
    const banner = [...document.querySelectorAll("p")].find((p) =>
      p.textContent?.startsWith("Demonstration mode"),
    );
    if (!header || !main || !banner) return false;
    const before = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return before(header, banner) && before(banner, main);
  });
  expect(inOrder).toBe(true);
});

test("sign-in has no top bar and no banner", async ({ page }) => {
  await page.goto("/new/sign-in");
  await expect(page.getByRole("button", { name: "Look around" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
  await expect(page.getByRole("button", { name: "Menu" })).toHaveCount(0);
  await expect(page.getByText(BANNER, { exact: false })).toHaveCount(0);
});

test("the screen sits in a centred 680px column, and main stays full width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await lookAround(page);

  const column = page.locator("main > div").first();
  const box = await column.boundingBox();
  const main = await page.locator("main").boundingBox();
  const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(main?.width).toBe(pageWidth);
  expect(box?.width).toBe(680);
  expect(box!.x).toBe(main!.x + (main!.width - 680) / 2);
});

test("on a phone the column fills the width, with 20px sides", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await lookAround(page);
  const column = page.locator("main > div").first();
  await expect(column).toBeVisible();
  expect((await column.boundingBox())?.width).toBe(390);
  await expect(column).toHaveCSS("padding-left", "20px");
  await expect(column).toHaveCSS("padding-right", "20px");
});
