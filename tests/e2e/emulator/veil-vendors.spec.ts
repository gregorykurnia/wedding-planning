import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { restorePairing } from "../seed";

test.afterEach(closeOtherContexts);

// Task 4.11: the Vendors screen at /vendors, against the emulators (guide §5.11).

const DOCUMENTS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Value = string | number | boolean | null | Date | Value[] | { [key: string]: Value };

/** A JS value as a Firestore REST value. */
function encode(value: Value): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
}

async function put(collection: string, id: string, fields: Record<string, Value>) {
  const res = await fetch(`${DOCUMENTS}/${collection}/${id}`, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, encode(v)])) }),
  });
  expect(res.ok).toBe(true);
}

const vendor = (name: string, over: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  category: "Other",
  contactName: "",
  contactPhone: "",
  contractStatus: "List",
  priceOptions: [],
  notes: "",
  starred: false,
  files: [],
  subEntries: [],
  createdAt: new Date("2026-05-02T10:00:00Z"),
  ...over,
});

// This spec empties Firestore, so the specs after it get the accounts paired again.
test.afterAll(restorePairing);

test.beforeEach(async () => {
  const res = await fetch(`${DOCUMENTS.replace("/v1/", "/emulator/v1/")}`, { method: "DELETE" });
  expect(res.ok).toBe(true);
  await put("settings", "wedding", {
    yourName: "Greg",
    partnerName: "Bella",
    partnerEmail: TEST_ACCOUNTS[1].email,
  });
  await put("vendorCategories", "cat-henna", { name: "Henna art", createdAt: new Date("2026-06-01T10:00:00Z") });
  await put(
    "vendors",
    "v1",
    vendor("Kebun Bunga Atelier", {
      category: "Decoration",
      contactName: "Bu Ayu",
      contactPhone: "0812 3456 7890",
      contractStatus: "Consideration",
      starred: true,
      bridestoryRating: 4.8,
      bridestoryReviewCount: 120,
      priceOptions: [
        { id: "o1", description: "Silver", price: 45_000_000, selected: false },
        { id: "o2", description: "Gold", price: 62_500_000, selected: true },
      ],
    }),
  );
  await put("vendors", "v2", vendor("Dapur Lestari Catering", { category: "Food", contractStatus: "Inquiring" }));
  await put("vendors", "v3", vendor("Pelaminan Ayu", { category: "Decoration", contractStatus: "Rejected" }));
  await put("vendors", "v4", vendor("Sunday Sound", { category: "Music/DJ", notes: "Do they have a harpist?" }));
  await put("vendors", "v5", vendor("Mehndi House", { category: "Henna art" }));
  await put("shortlist", "s1", { name: "Kebun Bunga Atelier", type: "Decoration", sourceVendorId: "v1", subEntries: [] });
});

async function signInAs(browser: Browser, account: (typeof TEST_ACCOUNTS)[number], viewport?: { width: number; height: number }) {
  const context = await browser.newContext({ acceptDownloads: true, ...(viewport ? { viewport } : {}) });
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/vendors");
  await expect(page.getByRole("heading", { name: "Vendors", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page;
}

const rowOf = (page: Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });

test("lists the vendors under their categories, with the hero, chips and rows", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);

  await expect(page.getByText("5 vendors, 1 you’re keen on")).toBeVisible();
  await expect(page.getByRole("link", { name: "Shortlist", exact: true })).toBeVisible();

  // Chips: only categories that hold a vendor, with counts, then Edit categories.
  const chips = page.getByRole("group", { name: "Focus on a category" });
  await expect(chips.getByRole("button", { name: /^All\s*5$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(chips.getByRole("button", { name: /^Decoration\s*2$/ })).toBeVisible();
  await expect(chips.getByRole("button", { name: /^Music\/DJ\s*1$/ })).toBeVisible();
  await expect(chips.getByRole("button", { name: "Edit categories" })).toBeVisible();

  // Headings with counts, built-ins first in the shared order, ours after, and Other last.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([/Decoration\s*2 vendors/, /Food\s*1 vendor/, /Music\/DJ\s*1 vendor/, /Henna art\s*1 vendor/]);

  // A full row: the preferred price, rating, stage, WhatsApp, shortlist and options.
  const row = rowOf(page, "Kebun Bunga Atelier");
  await expect(row).toContainText("Rp 62.500.000");
  await expect(row).toContainText("Bu Ayu");
  await expect(row).toContainText("4,8 from 120 reviews");
  await expect(row).toContainText("Considering");
  await expect(row).toContainText("2 price options");
  await expect(row.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/6281234567890");
  await expect(row.getByRole("link", { name: "On the shortlist" })).toHaveAttribute("href", "/vendors/shortlist/s1");
  await expect(row.getByRole("link", { name: "Kebun Bunga Atelier" })).toHaveAttribute("href", "/vendors/v1");
  await expect(row.getByRole("button", { name: "Keen on Kebun Bunga Atelier" })).toHaveAttribute("aria-pressed", "true");

  // A bare row and a ruled-out one.
  await expect(rowOf(page, "Dapur Lestari Catering")).toContainText("No price yet");
  await expect(rowOf(page, "Dapur Lestari Catering")).toContainText("No rating yet");
  await expect(rowOf(page, "Pelaminan Ayu")).toContainText("Ruled out");
});

test("search, a category, the keen filter and the orders narrow the list, with a way back", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);

  await page.getByRole("searchbox", { name: "Search vendors" }).fill("harpist");
  await expect(page.getByText("1 vendor here")).toBeVisible();
  await expect(rowOf(page, "Sunday Sound")).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search vendors" })).toBeFocused();

  await page.getByRole("searchbox", { name: "Search vendors" }).fill("zither");
  await expect(page.getByRole("heading", { name: "No vendors match “zither”" })).toBeVisible();
  await expect(page.getByText("Search looks through names, contact people and notes.")).toBeVisible();
  await page.getByRole("button", { name: "Clear the search" }).click();
  await expect(page.getByText("5 vendors", { exact: false }).first()).toBeVisible();

  // A category focus shows its rows without headings or the category in the meta.
  await page.getByRole("button", { name: /^Decoration\s*2$/ }).click();
  await expect(page.getByText("2 vendors here")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  await expect(rowOf(page, "Pelaminan Ayu")).not.toContainText("Decoration");

  // Keen only, inside that category, then everything again.
  await page.getByRole("checkbox", { name: "Only ones we’re keen on" }).check();
  await expect(page.getByText("1 vendor here")).toBeVisible();
  await page.getByRole("button", { name: "Show every vendor" }).first().click();
  await expect(page.getByRole("button", { name: /^All\s*5$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("checkbox", { name: "Only ones we’re keen on" })).not.toBeChecked();

  // A sorted list is flat, with the category in each row's meta; the order flips.
  await page.getByLabel("Order by").selectOption("name");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  const names = page.locator('ul[aria-label="Vendors"] > li a[href^="/vendors/v"]');
  await expect(names.first()).toHaveText("Dapur Lestari Catering");
  await expect(rowOf(page, "Dapur Lestari Catering")).toContainText("Food");
  await page.getByRole("button", { name: "Ascending" }).click();
  await expect(page.getByRole("button", { name: "Descending" })).toBeVisible();
  await expect(names.first()).toHaveText("Sunday Sound");
});

test("the keen heart saves, toasts, counts and survives a reload", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  const heart = rowOf(page, "Dapur Lestari Catering").getByRole("button", { name: "Keen on Dapur Lestari Catering" });
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").getByText("Marked Dapur Lestari Catering as one you’re keen on")).toBeVisible();
  await expect(page.getByText("5 vendors, 2 you’re keen on")).toBeVisible();

  await page.reload();
  await expect(
    rowOf(page, "Dapur Lestari Catering").getByRole("button", { name: "Keen on Dapur Lestari Catering" }),
  ).toHaveAttribute("aria-pressed", "true", { timeout: COMPILE_TIMEOUT });

  await rowOf(page, "Dapur Lestari Catering").getByRole("button", { name: "Keen on Dapur Lestari Catering" }).click();
  await expect(page.getByRole("status").getByText("Unmarked Dapur Lestari Catering")).toBeVisible();
});

test("adds a vendor with a name, starts another, and undoes the add", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await page.getByRole("button", { name: "Add a vendor" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a vendor" });
  await expect(sheet.getByText("Just the name is enough for now.")).toBeVisible();

  // A name is required: the field says so and keeps focus.
  await sheet.getByRole("button", { name: "Add vendor" }).click();
  await expect(sheet.getByText("Give the vendor a name.")).toBeVisible();
  await expect(sheet.getByLabel("Name")).toBeFocused();

  // Add and start another: the sheet stays, the form clears, the category is kept.
  await sheet.getByLabel("Name").fill("Bunga Melati Florist");
  await sheet.getByLabel("Category").selectOption("Decoration");
  await sheet.getByLabel("Contact person").fill("Bu Melati");
  await sheet.getByLabel("Phone").fill("0812 0000 1111");
  await sheet.getByLabel("Notes").fill("Found at the wedding fair");
  await sheet.getByRole("button", { name: "Add and start another" }).click();
  await expect(page.getByRole("status").getByText("Added Bunga Melati Florist")).toBeVisible();
  await expect(sheet.getByLabel("Name")).toHaveValue("");
  await expect(sheet.getByLabel("Name")).toBeFocused();
  await expect(sheet.getByLabel("Category")).toHaveValue("Decoration");

  await sheet.getByLabel("Name").fill("Lumina Wedding Photography");
  await sheet.getByRole("button", { name: "Add vendor" }).click();
  await expect(sheet).toBeHidden();

  // The row just added flashes (2.4 s), so look at it before the earlier one's wash has gone.
  await expect(rowOf(page, "Lumina Wedding Photography")).toHaveClass(/\bflash\b/);
  const added = rowOf(page, "Bunga Melati Florist");
  await expect(added).toContainText("No price yet");
  await expect(added).toContainText("Bu Melati");
  await expect(added.getByText("Noted")).toBeVisible();
  await expect(page.getByText("7 vendors, 1 you’re keen on")).toBeVisible();

  // The undo window belongs to the last add.
  await page.getByRole("status").getByRole("button", { name: "Undo" }).last().click();
  await expect(rowOf(page, "Lumina Wedding Photography")).toHaveCount(0);
  await expect(rowOf(page, "Bunga Melati Florist")).toHaveCount(1);
  await expect(page.getByText("6 vendors, 1 you’re keen on")).toBeVisible();
});

test("adding from a focused category starts in that category", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await page.getByRole("button", { name: /^Food\s*1$/ }).click();
  await page.getByRole("button", { name: "Add a vendor" }).click();
  await expect(page.getByRole("dialog", { name: "Add a vendor" }).getByLabel("Category")).toHaveValue("Food");
});

test("the categories sheet adds, renames and removes ours, each with its undo", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await page.getByRole("button", { name: "Edit categories" }).click();
  const sheet = page.getByRole("dialog", { name: "Vendor categories" });
  await expect(sheet.getByText("Categories you add are shared with Bella.")).toBeVisible();

  // Ours, built-in and the catch-all, with their counts.
  const card = sheet.getByRole("listitem");
  await expect(card.filter({ hasText: "Henna art" })).toContainText("Ours, 1 vendor");
  await expect(card.filter({ hasText: "Food" })).toContainText("1 vendor");
  await expect(card.filter({ hasText: "Other" })).toContainText("Catch-all, 0 vendors");
  await expect(card.filter({ hasText: "Food" }).getByRole("button", { name: "Rename" })).toHaveCount(0);

  // A new category: counting down, refused when taken, then added.
  const field = sheet.getByLabel("New category");
  await expect(sheet.getByText("40 characters left")).toBeVisible();
  await field.fill("Catering");
  await expect(sheet.getByText("32 characters left")).toBeVisible();
  await field.fill("food");
  await sheet.getByRole("button", { name: "Add category" }).click();
  await expect(sheet.getByText("There's already a category called Food.")).toBeVisible();
  await field.fill("Live band");
  await field.press("Enter");
  await expect(card.filter({ hasText: "Live band" })).toContainText("Ours, 0 vendors");
  await expect(page.getByRole("status").getByText("Added Live band")).toBeVisible();
  await expect(field).toHaveValue("");

  // Rename: a taken name is refused in place, a good one saves with an undo.
  await card.filter({ hasText: "Henna art" }).getByRole("button", { name: "Rename" }).click();
  const rename = sheet.getByLabel("Rename Henna art");
  // A category's own cap, not the rename field's usual 60 (P4-S12, P5-S15).
  await expect(rename).toHaveAttribute("maxlength", "40");
  await rename.fill("Food");
  await rename.press("Enter");
  await expect(sheet.getByText("There's already a category called Food.")).toBeVisible();
  await rename.fill("Mehndi");
  await rename.press("Enter");
  await expect(card.filter({ hasText: "Mehndi" })).toContainText("Ours, 1 vendor");
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(card.filter({ hasText: "Henna art" })).toBeVisible();

  // Remove: asked inline, its vendors move to Other, and Undo brings it all back.
  await card.filter({ hasText: "Henna art" }).getByRole("button", { name: "Remove" }).click();
  await expect(sheet.getByText("Remove Henna art? Its 1 vendor move to Other.")).toBeVisible();
  await sheet.getByRole("button", { name: "Keep it" }).click();
  await expect(card.filter({ hasText: "Henna art" })).toBeVisible();
  await card.filter({ hasText: "Henna art" }).getByRole("button", { name: "Remove" }).click();
  await sheet.getByRole("button", { name: "Remove category" }).click();
  await expect(card.filter({ hasText: "Henna art" })).toHaveCount(0);
  await expect(card.filter({ hasText: "Other" })).toContainText("Catch-all, 1 vendor");
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(card.filter({ hasText: "Henna art" })).toContainText("Ours, 1 vendor");
  await expect(card.filter({ hasText: "Other" })).toContainText("Catch-all, 0 vendors");

  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();
});

test("renaming the focused category keeps the focus on it", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await page.getByRole("button", { name: /^Henna art\s*1$/ }).click();
  await page.getByRole("button", { name: "Edit categories" }).click();
  const sheet = page.getByRole("dialog", { name: "Vendor categories" });
  await sheet.getByRole("listitem").filter({ hasText: "Henna art" }).getByRole("button", { name: "Rename" }).click();
  await sheet.getByLabel("Rename Henna art").fill("Mehndi");
  await sheet.getByLabel("Rename Henna art").press("Enter");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: /^Mehndi\s*1$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(rowOf(page, "Mehndi House")).toBeVisible();
});

test("exports the vendors in view as a spreadsheet named for the two of us", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await page.getByRole("button", { name: /^Decoration\s*2$/ }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export these to a spreadsheet" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("vendors-greg-bella.csv");
  await expect(page.getByRole("status").getByText("Exported 2 vendors to vendors-greg-bella.csv")).toBeVisible();

  const text = await readFile((await file.path())!, "utf8");
  expect(text.startsWith("﻿\"Name\",\"Category\",\"Stage\"")).toBe(true);
  const lines = text.slice(1).split("\r\n");
  expect(lines).toHaveLength(3);
  expect(lines[1]).toContain('"Kebun Bunga Atelier","Decoration","Considering","Yes","Bu Ayu","0812 3456 7890","https://wa.me/6281234567890","4.8","120","Gold","62500000","2","Silver: Rp 45.000.000; Gold: Rp 62.500.000","Yes","No","0"');
  expect(lines[2]).toContain('"Pelaminan Ayu","Decoration","Ruled out","No"');
});

test("with every vendor in view the export says all", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await expect(page.getByRole("button", { name: "Export all to a spreadsheet" })).toBeVisible();
});

test("Bella adds a vendor and Greg sees the row flash and a toast", async ({ browser }) => {
  const greg = await signInAs(browser, TEST_ACCOUNTS[0]);
  const bella = await signInAs(browser, TEST_ACCOUNTS[1]);

  await bella.getByRole("button", { name: "Add a vendor" }).click();
  const sheet = bella.getByRole("dialog", { name: "Add a vendor" });
  await sheet.getByLabel("Name").fill("Bunga Melati Florist");
  await sheet.getByRole("button", { name: "Add vendor" }).click();

  await expect(greg.getByRole("status").getByText("Bella added Bunga Melati Florist")).toBeVisible({ timeout: 15_000 });
  const row = rowOf(greg, "Bunga Melati Florist");
  await expect(row).toBeVisible();
  await expect(row).toHaveClass(/\bflash\b/);
  // Bella's own add isn't news to her.
  await expect(bella.getByRole("status").getByText(/Bella added/)).toHaveCount(0);
});

test("on a phone the rows stay readable and the chips scroll sideways", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], { width: 390, height: 844 });
  const chips = page.getByRole("group", { name: "Focus on a category" });
  expect(await chips.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(rowOf(page, "Kebun Bunga Atelier")).toContainText("Rp 62.500.000");
});
