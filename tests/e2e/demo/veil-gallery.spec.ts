import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.0: the component gallery lists a section for each later task, links the
// Phase 2 demos and shows the icon set. The demo server runs with the gallery on.

const LATER_TASKS = Array.from({ length: 12 }, (_, index) => `3.${index + 1}`);

async function openGallery(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery");
  await expect(page.getByRole("heading", { name: "Component gallery" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
}

test("lists the icon set, then a section for each later task, in plan order", async ({ page }) => {
  await openGallery(page);
  // Only the gallery's own sections: a demo can hold sections of its own (the Notes part has one).
  const headings = await page.locator('section[id^="section-"] > h2').allTextContents();
  const tasks = headings.map((text) => text.match(/Task (\d+\.\d+)/)?.[1]);
  expect(tasks).toEqual(["2.2", ...LATER_TASKS]);
});

// Every section of Phase 3 has a demo now, so none says it isn't built yet. A later
// task's section that has no demo yet would say so, as the sections file explains.
test("every section is built, so none says it is not built yet", async ({ page }) => {
  await openGallery(page);
  await expect(page.locator('section[id^="section-"]').first()).toBeVisible();
  await expect(page.getByText("Not built yet")).toHaveCount(0);
});

test("links to the Phase 2 demos", async ({ page }) => {
  await openGallery(page);
  for (const [name, href] of [
    ["Shell pieces", "/new/gallery/nav"],
    ["Screen states, messages and banners", "/new/gallery/states"],
    ["Sheets, confirm and toasts", "/new/gallery/shell"],
    ["Partner changes and presence", "/new/gallery/partner"],
  ]) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
  await page.getByRole("link", { name: "Screen states, messages and banners", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Screen states, messages and banners" }),
  ).toBeVisible({ timeout: COMPILE_TIMEOUT });
});

test("the icon set draws every icon, hidden from screen readers, in both colours", async ({
  page,
}) => {
  await openGallery(page);
  const text = page.getByRole("list", { name: "Icons in the text colour" });
  const gold = page.getByRole("list", { name: "Icons in the gold accent" });
  await expect(text.locator("svg")).toHaveCount(12);
  await expect(text.locator("svg[aria-hidden='true']")).toHaveCount(12);
  await expect(text.locator("svg").first()).toBeVisible();
  await expect(text.getByText("File type tag")).toBeVisible();
  await expect(gold.locator("svg")).toHaveCount(12);
});
