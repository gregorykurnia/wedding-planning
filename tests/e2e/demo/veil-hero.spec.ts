import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.1: the hero, kicker, figure, context and thread, in their section of the
// component gallery. The model test in tests/model/hero.test.tsx checks the markup.

// Opens the gallery and returns Task 3.1's section. Other sections have headings
// too, so every locator in these tests starts from this section.
async function openSection(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/gallery");
  const section = page.locator("#section-3-1");
  await expect(
    section.getByRole("heading", { name: "Still to pay, the budget", exact: true }),
  ).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return section;
}

// Colours worked out by hand from tokens.css: --accent-attention-text #b8355b,
// --accent-gold-text #8a6a2e, --accent-attention #d9466f, --accent-thread #c6a466.
const ROSE_INK = "rgb(184, 53, 91)";
const GOLD_INK = "rgb(138, 106, 46)";
const ROSE = "rgb(217, 70, 111)";
const CHAMPAGNE = "rgb(198, 164, 102)";

test("every thread is an image labelled in words, with both ends", async ({ page }) => {
  const section = await openSection(page);
  const labels = [
    "54% paid, 46% to go",
    "100% paid, overpaid",
    "100% paid, 0% to go",
    "88% committed, the rest what-if",
    "60% paid",
  ];
  await expect(section.getByRole("img")).toHaveCount(labels.length);
  for (const label of labels) {
    await expect(section.getByRole("img", { name: label, exact: true })).toBeVisible();
  }
});

test("late and overpaid figures are rose, and paid in full is gold", async ({ page }) => {
  const section = await openSection(page);
  await expect(section.getByText("Rp55.500.000", { exact: true })).toHaveCSS("color", ROSE_INK);
  await expect(section.getByText("Rp2.500.000", { exact: true })).toHaveCSS("color", ROSE_INK);
  await expect(section.getByText("Rp18.000.000", { exact: true })).toHaveCSS("color", GOLD_INK);
});

test("a thread fills champagne, rose when overpaid, and the what-if run is dashed with no dot", async ({
  page,
}) => {
  const section = await openSection(page);
  const budget = section.getByRole("img", { name: "54% paid, 46% to go", exact: true });
  await expect(budget.locator("span").first()).toHaveCSS("background-color", CHAMPAGNE);

  const overpaid = section.getByRole("img", { name: "100% paid, overpaid", exact: true });
  await expect(overpaid.locator("span").first()).toHaveCSS("background-color", ROSE);

  // Done fill, dashed run, then the two ends: five spans, and no dot (a sixth).
  const whatIf = section.getByRole("img", {
    name: "88% committed, the rest what-if",
    exact: true,
  });
  await expect(whatIf.locator("span")).toHaveCount(5);
  await expect(whatIf.locator("span").nth(1)).toHaveCSS("border-top-style", "dashed");
});

test("figure and title sizes come from the tokens, at a laptop and at a phone", async ({
  page,
}) => {
  const section = await openSection(page);
  const budgetFigure = section.getByText("Rp409.650.000", { exact: true });
  const mdFigure = section.getByText("Rp55.500.000", { exact: true });
  const title = section.getByRole("heading", { name: "Budget", exact: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(budgetFigure).toHaveCSS("font-size", "124px");
  await expect(mdFigure).toHaveCSS("font-size", "88px");
  await expect(title).toHaveCSS("font-size", "40px");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(budgetFigure).toHaveCSS("font-size", "56px");
  await expect(mdFigure).toHaveCSS("font-size", "46px");
  await expect(title).toHaveCSS("font-size", "34px");
});

test("a figure over 13 digits stays on one line inside its block, down to 30px", async ({
  page,
}) => {
  const section = await openSection(page);
  const longFigure = section.getByText("Rp98.765.432.109.876", { exact: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(longFigure).toHaveCSS("font-size", "30px");
  await expect(longFigure).toHaveCSS("white-space", "nowrap");
  const fits = await longFigure.evaluate(
    (el) => el.getBoundingClientRect().width <= (el.parentElement?.getBoundingClientRect().width ?? 0),
  );
  expect(fits).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(longFigure).toHaveCSS("font-size", "72px");
});

test("the figure block sits 30px under the title, and the thread is at most 460px wide", async ({
  page,
}) => {
  const section = await openSection(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const title = await section.getByRole("heading", { name: "Budget", exact: true }).boundingBox();
  // The budget's kicker is the first "Still to pay" in the section; the long-figure demo has another.
  const kicker = await section.getByText("Still to pay", { exact: true }).first().boundingBox();
  const thread = await section
    .getByRole("img", { name: "54% paid, 46% to go", exact: true })
    .boundingBox();
  expect(title && kicker).toBeTruthy();
  expect(kicker!.y - (title!.y + title!.height)).toBeCloseTo(30, 0);
  expect(thread!.width).toBeLessThanOrEqual(460);
});
