import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.7: the search, ordering, filter, count and paging tools, in their
// section of the component gallery. The model test in tests/model/tools.test.tsx
// checks the markup.

// Opens the gallery and returns Task 3.7's section. Other sections have search
// fields and selects too, so every locator starts from this section.
async function openSection(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery");
  const section = page.locator("#section-3-7");
  await expect(section.getByRole("heading", { name: "Search, a filter and an order" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
  // The last select in the section is the last control to get its handlers
  // (React hydrates in document order), and dev mode re-renders once more when
  // its chunks arrive. A change made before that does nothing, so wait for both.
  await page.waitForFunction(() => {
    const selects = [...document.querySelectorAll("#section-3-7 select")];
    const last = selects[selects.length - 1];
    return !!last && Object.keys(last).some((key) => key.startsWith("__reactProps"));
  });
  await page.waitForLoadState("networkidle");
  return section;
}

// Colours worked out by hand from tokens.css: --color-edge #e6d3d9 (the
// underline at rest) and --accent-attention #d9466f (rose, on focus).
const EDGE = "rgb(230, 211, 217)";
const ROSE = "rgb(217, 70, 111)";

test("the search underline is faint at rest and turns rose on focus", async ({ page }) => {
  const section = await openSection(page);
  const search = section.getByLabel("Search vendors");
  const field = section.locator("label", { hasText: "Search vendors" });
  await expect(field).toHaveCSS("border-bottom-color", EDGE);
  await search.focus();
  await expect(field).toHaveCSS("border-bottom-color", ROSE);
});

test("searching keeps focus in the field while the results change", async ({ page }) => {
  const section = await openSection(page);
  const search = section.getByLabel("Search vendors");
  await search.click();
  await search.pressSequentially("fig");
  await expect(section.getByText("1 vendor here")).toBeVisible();
  await expect(search).toBeFocused();
});

test("Show everything appears while a filter is on, and clears the search", async ({ page }) => {
  const section = await openSection(page);
  const showAll = section.getByRole("button", { name: "Show everything" });
  await expect(showAll).toHaveCount(0);
  await section.getByLabel("Search vendors").pressSequentially("fig");
  await expect(showAll).toHaveCount(1);
  await showAll.click();
  await expect(section.getByLabel("Search vendors")).toHaveValue("");
  await expect(section.getByText("8 vendors", { exact: true })).toBeVisible();
  await expect(showAll).toHaveCount(0);
});

test("a new order starts in the model's direction, and the direction word flips it", async ({ page }) => {
  const section = await openSection(page);
  const order = section.getByLabel("Order by").first();
  await expect(order).toHaveValue("name");
  await expect(section.getByRole("button", { name: "Ascending" }).first()).toBeVisible();

  // Rating starts descending, and a blank rating goes last.
  await order.selectOption("rating");
  await expect(section.getByRole("button", { name: "Descending" }).first()).toBeVisible();
  await expect(section.locator("ul").first().locator("li").first()).toHaveText("Little Bell Strings");

  await section.getByRole("button", { name: "Descending" }).first().click();
  await expect(section.getByRole("button", { name: "Ascending" }).first()).toBeVisible();
});

test("a box that holds an amount reads it when left, and text that isn't an amount puts the old one back", async ({
  page,
}) => {
  const section = await openSection(page);
  const cost = section.getByRole("textbox", { name: /Costs at most/ });
  await cost.fill("45000000");
  await cost.press("Tab");
  await expect(cost).toHaveValue("Rp 45.000.000");
  await expect(section.getByText("3 venues here")).toBeVisible();

  await cost.fill("a lot");
  await cost.press("Tab");
  await expect(cost).toHaveValue("Rp 45.000.000");
});

test("Show more pages the venues three at a time and always says how many more", async ({ page }) => {
  const section = await openSection(page);
  await expect(section.getByText("7 venues, showing 3")).toBeVisible();

  await section.getByRole("button", { name: "Show 3 more" }).click();
  await expect(section.getByText("7 venues, showing 6")).toBeVisible();

  await section.getByRole("button", { name: "Show 1 more" }).click();
  await expect(section.getByText("7 venues", { exact: true })).toBeVisible();
  await expect(section.getByRole("button", { name: /Show \d+ more/ })).toHaveCount(0);
});

test("a list sorted for now says so, and Back to our order puts it back", async ({ page }) => {
  const section = await openSection(page);
  const items = section.getByLabel("Order by").nth(2);
  await expect(items).toHaveValue("own");

  await items.selectOption("name");
  await expect(section.getByText("Sorted by item for now. Your own order is kept.")).toBeVisible();

  await section.getByRole("button", { name: "Back to our order" }).click();
  await expect(items).toHaveValue("own");
  await expect(section.getByText("Sorted by item for now")).toHaveCount(0);
});

test("the count line words are the guide's", async ({ page }) => {
  const section = await openSection(page);
  await expect(section.getByText("1.206 bookings, showing 100")).toBeVisible();
  await expect(section.getByText("12 of 2.004")).toBeVisible();
  await expect(section.getByText("Showing 60 of 1.507")).toBeVisible();
  await expect(section.getByText("3 bookings match")).toBeVisible();
});
