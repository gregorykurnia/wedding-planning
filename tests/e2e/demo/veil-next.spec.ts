import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.2: the next card, its after line and the doors, in their section of the
// component gallery. The model tests in tests/model/next-*.test.* check the markup.

// Opens the gallery and returns Task 3.2's section. Other sections have headings
// too, so every locator in these tests starts from this section.
async function openSection(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/gallery");
  const section = page.locator("#section-3-2");
  await expect(
    section.getByRole("heading", { name: "Three late, the first one shown", exact: true }),
  ).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return section;
}

// Colours worked out by hand from tokens.css: --accent-attention-text #b8355b on
// --accent-attention-wash #fde8ee, --accent-gold-text-on-tint #7d5f27 on
// --accent-thread-track #f4ead7, --surface-flag-calm #f6eef0, --color-decor #a8979e.
const ROSE_INK = "rgb(184, 53, 91)";
const ROSE_SOFT = "rgb(253, 232, 238)";
const GOLD_TINT = "rgb(125, 95, 39)";
const CHAMPAGNE = "rgb(244, 234, 215)";
const CALM_WASH = "rgb(246, 238, 240)";

test("the flag is rose when late, gold within 14 days and calm after", async ({ page }) => {
  const section = await openSection(page);

  const late = section.getByText("5 days late", { exact: true });
  await expect(late).toHaveCSS("color", ROSE_INK);
  await expect(late).toHaveCSS("background-color", ROSE_SOFT);

  const soon = section.getByText("due in 4 days", { exact: true });
  await expect(soon).toHaveCSS("color", GOLD_TINT);
  await expect(soon).toHaveCSS("background-color", CHAMPAGNE);

  const later = section.getByText("2 Dec", { exact: true });
  await expect(later).toHaveCSS("background-color", CALM_WASH);
  await expect(later).toHaveCSS("font-weight", "400");
});

test("the label counts the late payments, and the after line names the next one", async ({
  page,
}) => {
  const section = await openSection(page);
  await expect(section.getByText("Next to pay, 1 of 3 late", { exact: true })).toBeVisible();
  await expect(section.locator("p", { hasText: "After that," }).first()).toHaveText(
    "After that, Rp 18.000.000 to Kirana Florist on Sunday 11 October.",
  );
});

test("the name links to the booking, and Record payment is pressed in the card", async ({
  page,
}) => {
  const section = await openSection(page);
  const card = section.getByRole("region", { name: "Next payment" }).first();
  await expect(card.getByRole("link", { name: "Dapur Lestari Catering", exact: true })).toHaveAttribute(
    "href",
    "/budget/bookings/vendor-catering",
  );

  await card.getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(section.getByText("Record payment pressed 1 time", { exact: true })).toBeVisible();
});

test("on a desktop the flag sits top right; on a phone it comes first, above the label", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const section = await openSection(page);
  const card = section.getByRole("region", { name: "Next payment" }).first();
  const flag = await card.getByText("5 days late", { exact: true }).boundingBox();
  const label = await card.getByText("Next to pay, 1 of 3 late", { exact: true }).boundingBox();
  if (!flag || !label) throw new Error("the flag and the label should be on the page");

  // Desktop: the flag is in the label's row, on the right.
  expect(Math.abs(flag.y + flag.height / 2 - (label.y + label.height / 2))).toBeLessThan(4);
  expect(flag.x).toBeGreaterThan(label.x + label.width);

  await page.setViewportSize({ width: 390, height: 844 });
  const phoneFlag = await card.getByText("5 days late", { exact: true }).boundingBox();
  const phoneLabel = await card.getByText("Next to pay, 1 of 3 late", { exact: true }).boundingBox();
  const name = await card.getByRole("heading", { level: 2 }).boundingBox();
  const amount = await card.getByText("Rp 55.500.000", { exact: true }).boundingBox();
  const cardBox = await card.boundingBox();
  if (!phoneFlag || !phoneLabel || !name || !amount || !cardBox) {
    throw new Error("the card should be on the page at 390px");
  }

  // Phone: one column, the flag, the label, the name, then the amount, all left-aligned.
  expect(phoneFlag.y + phoneFlag.height).toBeLessThanOrEqual(phoneLabel.y);
  expect(phoneLabel.y).toBeLessThan(name.y);
  expect(name.y).toBeLessThan(amount.y);
  expect(amount.x - cardBox.x).toBeLessThan(60);
});

test("each door is a link with its summary in its name, and a rose fragment reads late", async ({
  page,
}) => {
  const section = await openSection(page);
  const payments = section.getByRole("link", { name: /Payments due\s*1 late, 6 payments until March/ });
  await expect(payments).toHaveAttribute("href", "/budget/payments");
  await expect(payments.getByText("1 late", { exact: true })).toHaveCSS("color", ROSE_INK);

  const budget = section.getByRole("link", {
    name: /Budget\s*Rp 473\.150\.000 paid of Rp 882\.800\.000/,
  });
  await expect(budget).toHaveAttribute("href", "/budget");
});

test("on a phone each door's summary moves under its name, left-aligned", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const section = await openSection(page);
  const door = section.getByRole("link", { name: /Payments due/ });
  const name = await door.getByText("Payments due", { exact: true }).boundingBox();
  const summary = await door.getByText("1 late", { exact: true }).boundingBox();
  if (!name || !summary) throw new Error("the door's name and summary should be on the page");

  expect(summary.y).toBeGreaterThanOrEqual(name.y + name.height - 2);
  expect(Math.abs(summary.x - name.x)).toBeLessThan(2);
});

test("the empty card says nothing is due, with no amount or button", async ({ page }) => {
  const section = await openSection(page);
  const empty = section.getByRole("region", { name: "Next payment" }).last();
  await expect(empty.getByRole("heading", { name: "Nothing due right now", exact: true })).toBeVisible();
  await expect(
    empty.getByText("Every booking with a due date is paid up.", { exact: false }),
  ).toBeVisible();
  await expect(empty.getByRole("button")).toHaveCount(0);
});
