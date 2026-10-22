import { expect, test, type Locator, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.5: the ledger rows and their states in the component gallery. Everything
// is held in the page, so a test changes nothing anywhere. "Today" in the demo is
// Wednesday 14 October 2026, 11:30 in Jakarta.

async function openSection(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/gallery");
  await expect(page.locator("#section-3-5")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page.locator("#section-3-5");
}

const log = (section: Locator) => section.getByRole("status").first();
const list = (section: Locator, name: string) => section.getByRole("list", { name });

// The rows are the list's own items: a booking's parts are items inside its row.
const rows = (section: Locator, name: string) => list(section, name).locator(":scope > li");

test("draws every ledger row type from its stress names", async ({ page }) => {
  const section = await openSection(page);
  await expect(rows(section, "Bookings")).toHaveCount(6);
  await expect(rows(section, "What-if items")).toHaveCount(3);
  await expect(rows(section, "Vendors")).toHaveCount(5);
  await expect(rows(section, "Payments due")).toHaveCount(5);
  await expect(rows(section, "Documents")).toHaveCount(4);
  await expect(rows(section, "Folders")).toHaveCount(3);
  await expect(rows(section, "Files")).toHaveCount(5);

  await expect(section.getByText("Rp 10.000.000 late")).toBeVisible();
  await expect(section.getByText("Overpaid by Rp 1.000.000")).toBeVisible();
  await expect(section.getByText("Paid in full")).toBeVisible();
  await expect(section.getByText("and 3 more parts")).toBeVisible();
  // Studio Dimas and the Hotel Ballroom have no reviews yet.
  await expect(section.getByText("No rating yet")).toHaveCount(2);
  await expect(section.getByText("from 1.200 reviews")).toBeVisible();
  await expect(section.getByText("Photography, would be paid by Bella’s family")).toBeVisible();
  await expect(section.getByText("Rp 13.500.000")).toBeVisible();
  await expect(section.getByText("6 folders, 12 files")).toBeVisible();
});

test("a late payment is rose with its Record payment filled, and a later one stays quiet", async ({ page }) => {
  const section = await openSection(page);
  const late = section.locator('li[data-booking-id="vendor-v3"]');
  await expect(late).toHaveClass(/dueLate/);
  await expect(late).toContainText("4 days late, paid by CK. Second payment");
  await expect(late.getByRole("button", { name: "Record payment" })).not.toHaveClass(/quiet/);

  const later = section.locator('li[data-booking-id="vendor-v1"]');
  await expect(later).not.toHaveClass(/dueLate/);
  await expect(later).toContainText("Friday 30 October, paid by Bella’s family. Pay the balance");
  await expect(later.getByRole("button", { name: "Record payment" })).toHaveClass(/quiet/);
});

test("a search marks its matches in the documents, and clearing it takes the marks away", async ({ page }) => {
  const section = await openSection(page);
  const documents = list(section, "Documents");
  await expect(documents.locator("mark")).toHaveCount(0);

  await section.getByLabel("Search the documents").fill("contract");
  // "Photographer contract" and "Vendor contracts 2026…" each have one match in the title.
  await expect(documents.locator("mark")).toHaveCount(2);
  await expect(documents.locator('li:has(a[data-doc-id="d3"]) mark')).toHaveText("contract");

  await section.getByLabel("Search the documents").fill("");
  await expect(documents.locator("mark")).toHaveCount(0);
});

test("a flash highlights the row that changed and fades after it", async ({ page }) => {
  const section = await openSection(page);
  const entry = section.locator('li:has(a[data-booking-id="vendor-v1"])');
  const due = section.locator('li[data-booking-id="vendor-v1"]');
  await expect(entry).not.toHaveClass(/\bflash\b/);

  await section.getByRole("button", { name: "Flash Pelaminan Ayu" }).click();
  await expect(log(section)).toHaveText("Flashed the Pelaminan Ayu entry");
  await expect(entry).toHaveClass(/\bflash\b/);
  await expect(entry).not.toHaveClass(/\bflash\b/, { timeout: 8000 });

  // A part flashes its own payment, not the whole booking.
  await section.getByRole("button", { name: "Flash the final payment" }).click();
  await expect(due).toHaveClass(/\bflash\b/);
  await expect(entry).not.toHaveClass(/\bflash\b/);
});

test("a folder is a link to its page, and a file reports which one was opened", async ({ page }) => {
  const section = await openSection(page);
  await expect(section.locator('a[data-folder-id="fo1"]')).toHaveAttribute("href", "/gallery#section-3-5");
  await section.locator('button[data-file-id="f2"]').click();
  await expect(log(section)).toHaveText("Opened Moodboard.jpg");
});

test("an empty meta line keeps its height, and an empty folder says so", async ({ page }) => {
  const section = await openSection(page);
  const bare = section.locator('li:has(button[data-file-id="f3"])');
  const meta = await bare.locator('[class*="fmeta"]').textContent();
  expect(meta).toBe(" ");
  await expect(section.locator('a[data-folder-id="fo3"]')).toContainText("Empty");
});

test("the row states show: ruled out, completed and cancelled, done, next and failed", async ({ page }) => {
  const section = await openSection(page);
  await expect(list(section, "Vendors").locator("li", { hasText: "Organ and Co" })).toHaveClass(/ruled/);

  const agenda = list(section, "Completed and cancelled");
  await expect(agenda).toContainText("Vendor call, completed");
  await expect(agenda).toContainText("Appointment, cancelled");

  await expect(list(section, "Done task").locator('[data-task-id="t4"]')).toHaveClass(/done/);

  const items = list(section, "Item rows in a state");
  await expect(items.locator("li").first()).toHaveClass(/next/);
  await expect(items.locator("li").nth(1)).toHaveClass(/failed/);
  await expect(items.locator("li").nth(1)).toContainText("What you typed is kept");
});

test("on a phone a file's name keeps its width, and its meta line moves under it", async ({ page }) => {
  const section = await openSection(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const file = section.locator('li:has(button[data-file-id="f5"])');
  const name = await file.locator('[class*="fname"]').boundingBox();
  const meta = await file.locator('[class*="fmeta"]').boundingBox();
  expect(name).not.toBeNull();
  expect(meta).not.toBeNull();
  expect(name!.width).toBeGreaterThan(200);
  expect(meta!.y).toBeGreaterThan(name!.y + name!.height - 1);
});

test("on a phone the Record payment button moves under the amount", async ({ page }) => {
  const section = await openSection(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const due = section.locator('li[data-booking-id="vendor-v3"]');
  const amount = await due.locator('[class*="amt"]').boundingBox();
  const button = await due.getByRole("button", { name: "Record payment" }).boundingBox();
  expect(amount).not.toBeNull();
  expect(button).not.toBeNull();
  expect(button!.y).toBeGreaterThan(amount!.y + amount!.height - 1);
});
