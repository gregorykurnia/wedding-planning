import { expect, test, type Browser, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { restorePairing } from "../seed";
import { DEFAULT_STORED } from "@/lib/model/categories";

test.afterEach(closeOtherContexts);

// Task 4.13: the Shortlist at /vendors/shortlist, against the emulators (guide §5.13).

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

const finalist = (name: string, over: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  type: "Other",
  contactName: "",
  contactPhone: "",
  price: 0,
  priceDescription: "",
  bridestoryReviewers: null,
  igFollowers: null,
  nextAction: "",
  notes: "",
  files: [],
  subEntries: [],
  createdAt: new Date("2026-05-02T10:00:00Z"),
  ...over,
});

const pkg = (id: string, name: string, price: number): Value => ({
  id,
  name,
  type: "Other",
  price,
  priceDescription: name,
  bridestoryReviewers: null,
  igFollowers: null,
  nextAction: "",
  notes: "",
  files: [],
});

async function seedShortlist(withFinalists = true) {
  const res = await fetch(`${DOCUMENTS.replace("/v1/", "/emulator/v1/")}`, { method: "DELETE" });
  expect(res.ok).toBe(true);
  await put("settings", "wedding", {
    yourName: "Greg",
    partnerName: "Bella",
    partnerEmail: TEST_ACCOUNTS[1].email,
  });
  // The common categories and one of the couple's own, Food, which sorts between Decoration and Photo and Video.
  for (const c of DEFAULT_STORED) await put("vendorCategories", c.id, { name: c.name, createdAt: new Date("2026-05-01T10:00:00Z") });
  await put("vendorCategories", "cat-food", { name: "Food", createdAt: new Date("2026-05-01T10:00:00Z") });
  if (!withFinalists) return;
  await put(
    "shortlist",
    "f1",
    finalist("Kebun Bunga Atelier", {
      type: "Decoration",
      price: 45_000_000,
      priceDescription: "Silver",
      subEntries: [pkg("p2", "Gold", 62_500_000)],
      preferredPackageId: "p2",
      bridestoryReviewers: 120,
      igFollowers: 12_300,
      nextAction: "Ask about the delivery fee",
    }),
  );
  await put(
    "shortlist",
    "f2",
    finalist("Pelaminan Ayu", {
      type: "Decoration",
      price: 30_000_000,
      priceDescription: "Classic",
      subEntries: [
        pkg("a", "Garden", 35_000_000),
        pkg("b", "Pavilion", 40_000_000),
        pkg("c", "Grand", 55_000_000),
        pkg("d", "Palace", 90_000_000),
        pkg("e", "Royal", 120_000_000),
      ],
      createdAt: new Date("2026-05-03T10:00:00Z"),
    }),
  );
  await put(
    "shortlist",
    "f3",
    finalist("Arka Visual", {
      type: "Photo and Video",
      price: 18_000_000,
      priceDescription: "Signature",
      bridestoryReviewers: 64,
      igFollowers: 98_765_432,
    }),
  );
  await put(
    "shortlist",
    "f4",
    finalist("Dapur Lestari Catering", {
      type: "Food",
      price: 80_000_000,
      priceDescription: "Buffet for 300",
      movedTo: { kind: "booking", id: "vendor-v9" },
      nextAction: "x".repeat(130),
    }),
  );
  // "Now a booking" follows the vendor's booking (review P4-S10).
  await put("vendors", "v9", {
    name: "Dapur Lestari Catering",
    category: "Food",
    contractStatus: "Chosen",
    booking: { on: "2026-09-01", from: "finalist", removed: false },
  });
}

// This spec empties Firestore, so the specs after it get the accounts paired again.
test.afterAll(restorePairing);

test.beforeEach(async () => {
  await seedShortlist();
});

async function signInAs(browser: Browser, account: (typeof TEST_ACCOUNTS)[number], viewport?: { width: number; height: number }) {
  const context = await browser.newContext(viewport ? { viewport } : {});
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/vendors/shortlist");
  await expect(page.getByRole("heading", { name: "Shortlist", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page;
}

const cardOf = (page: Page, name: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });

test("lists the finalists under their categories, as cards", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);

  await expect(page.getByText("4 finalists in 3 categories")).toBeVisible();
  const chips = page.getByRole("group", { name: "Focus on a category" });
  await expect(chips.getByRole("button", { name: /^All$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(chips.getByRole("button", { name: /^Decoration\s*2$/ })).toBeVisible();
  await expect(chips.getByRole("button", { name: /^Food\s*1$/ })).toBeVisible();
  await expect(chips.getByRole("button", { name: /^Photo and Video\s*1$/ })).toBeVisible();
  await expect(chips.getByRole("button", { name: "Edit categories" })).toHaveCount(0);

  // Headings follow the shared category order, with counts.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    /Decoration\s*2 finalists/,
    /Food\s*1 finalist/,
    /Photo and Video\s*1 finalist/,
  ]);

  // A full card: reviews and followers, packages with the leaning one marked, the next step.
  const kebun = cardOf(page, "Kebun Bunga Atelier");
  await expect(kebun).toContainText("120 reviews, 12,3k followers");
  await expect(kebun).toContainText("Silver");
  await expect(kebun).toContainText("Rp 45.000.000");
  await expect(kebun).toContainText("Gold, the one we’re leaning towards");
  await expect(kebun).toContainText("Next: Ask about the delivery fee");
  await expect(kebun.getByRole("link", { name: "Kebun Bunga Atelier" })).toHaveAttribute(
    "href",
    "/vendors/shortlist/f1",
  );

  // Six packages: four listed, then how many more.
  const ayu = cardOf(page, "Pelaminan Ayu");
  await expect(ayu).toContainText("and 2 more packages");
  await expect(ayu).not.toContainText("Palace");
  await expect(ayu).toContainText("No reviews or followers yet");
  await expect(ayu).toContainText("No next step");

  // Big counts stay short.
  await expect(cardOf(page, "Arka Visual")).toContainText("64 reviews, 98,8M followers");
});

test("a finalist that became a booking fades and carries the flag; a long step is cut", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  const booked = cardOf(page, "Dapur Lestari Catering");
  await expect(booked.getByText("Now a booking")).toBeVisible();
  // Only the name fades, so the flag and the lines keep their contrast (8.4, G44).
  expect(await booked.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  expect(await booked.getByRole("link", { name: "Dapur Lestari Catering" }).evaluate((el) => getComputedStyle(el).opacity)).toBe("0.7");
  await expect(booked).toContainText("x".repeat(118) + "…");
  await expect(booked).not.toContainText("x".repeat(119));
  expect(await cardOf(page, "Arka Visual").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
});

test("a category focus and the four orders narrow and reorder the cards", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);

  await page.getByRole("button", { name: /^Decoration\s*2$/ }).click();
  await expect(page.getByRole("button", { name: /^Decoration\s*2$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(cardOf(page, "Kebun Bunga Atelier")).toBeVisible();
  await expect(cardOf(page, "Arka Visual")).toHaveCount(0);
  await page.getByRole("button", { name: /^All$/ }).click();

  const names = page.locator('a[href^="/vendors/shortlist/f"]');
  await expect(names).toHaveText(["Kebun Bunga Atelier", "Pelaminan Ayu", "Dapur Lestari Catering", "Arka Visual"]);

  // Preferred price starts low to high; a finalist with no price is last either way.
  await page.getByLabel("Order by").selectOption("price");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ascending" })).toBeVisible();
  await expect(names).toHaveText(["Arka Visual", "Pelaminan Ayu", "Kebun Bunga Atelier", "Dapur Lestari Catering"]);
  await page.getByRole("button", { name: "Ascending" }).click();
  await expect(names).toHaveText(["Dapur Lestari Catering", "Kebun Bunga Atelier", "Pelaminan Ayu", "Arka Visual"]);

  // Reviews and followers start high to low, finalists without any last.
  await page.getByLabel("Order by").selectOption("reviews");
  await expect(page.getByRole("button", { name: "Descending" })).toBeVisible();
  await expect(names.first()).toHaveText("Kebun Bunga Atelier");
  await expect(names.nth(1)).toHaveText("Arka Visual");
  await page.getByLabel("Order by").selectOption("followers");
  await expect(names.first()).toHaveText("Arka Visual");
  await expect(names.nth(1)).toHaveText("Kebun Bunga Atelier");
});

test("adds a finalist straight to the shortlist, then undoes it", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await page.getByRole("button", { name: "Add a finalist" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a finalist" });
  await expect(sheet.getByText("Straight onto the shortlist, without adding a vendor first.")).toBeVisible();

  // A name is required: the field says so and keeps focus.
  await sheet.getByRole("button", { name: "Add finalist" }).click();
  await expect(sheet.getByText("Give the finalist a name.")).toBeVisible();
  await expect(sheet.getByLabel("Name")).toBeFocused();

  await sheet.getByLabel("Name").fill("Lumina Wedding Photography");
  await sheet.getByLabel("Category").selectOption("Photo and Video");
  await sheet.getByLabel("First package").fill("Full day");
  await sheet.getByLabel("Its price").fill("24000000");
  await sheet.getByRole("button", { name: "Add finalist" }).click();
  await expect(sheet).toBeHidden();

  const added = cardOf(page, "Lumina Wedding Photography");
  await expect(added).toHaveClass(/\bflash\b/);
  await expect(added).toContainText("Full day");
  await expect(added).toContainText("Rp 24.000.000");
  await expect(added).toContainText("No reviews or followers yet");
  await expect(page.getByText("5 finalists in 3 categories")).toBeVisible();
  await expect(page.getByRole("status").getByText("Added Lumina Wedding Photography to the shortlist")).toBeVisible();

  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(cardOf(page, "Lumina Wedding Photography")).toHaveCount(0);
  await expect(page.getByText("4 finalists in 3 categories")).toBeVisible();
});

test("a finalist can be added with only a name, and starts in the focused category", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await page.getByRole("button", { name: /^Food\s*1$/ }).click();
  await page.getByRole("button", { name: "Add a finalist" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a finalist" });
  await expect(sheet.getByLabel("Category")).toHaveValue("Food");
  await sheet.getByLabel("Name").fill("Sate Senayan");
  await sheet.getByRole("button", { name: "Add finalist" }).click();
  await expect(sheet).toBeHidden();
  const added = cardOf(page, "Sate Senayan");
  await expect(added).toBeVisible();
  await expect(added).toContainText("No next step");
  await expect(added.getByRole("listitem")).toHaveCount(0);
});

test("Bella adds a finalist and Greg sees the card flash and a toast", async ({ browser }) => {
  const greg = await signInAs(browser, TEST_ACCOUNTS[0]);
  const bella = await signInAs(browser, TEST_ACCOUNTS[1]);

  await bella.getByRole("button", { name: "Add a finalist" }).click();
  const sheet = bella.getByRole("dialog", { name: "Add a finalist" });
  await sheet.getByLabel("Name").fill("Lumina Wedding Photography");
  await sheet.getByRole("button", { name: "Add finalist" }).click();

  await expect(greg.getByRole("status").getByText("Bella added Lumina Wedding Photography to the shortlist")).toBeVisible({
    timeout: 15_000,
  });
  await expect(cardOf(greg, "Lumina Wedding Photography")).toHaveClass(/\bflash\b/);
  await expect(bella.getByRole("status").getByText(/Bella added/)).toHaveCount(0);
});

test("nothing on the shortlist: the message, a way to Vendors and the add sheet", async ({ browser }) => {
  await seedShortlist(false);
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await expect(page.getByText("Finalists, side by side")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing on the shortlist yet", level: 2 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Vendors" })).toHaveAttribute("href", "/vendors");
  await page.getByRole("button", { name: "Add a finalist" }).first().click();
  await expect(page.getByRole("dialog", { name: "Add a finalist" })).toBeVisible();
});

test("on a phone: one card per row, chips scroll sideways, nothing runs off the screen", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], { width: 390, height: 844 });
  const chips = page.getByRole("group", { name: "Focus on a category" });
  expect(await chips.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const a = await cardOf(page, "Kebun Bunga Atelier").boundingBox();
  const b = await cardOf(page, "Pelaminan Ayu").boundingBox();
  expect(a && b && Math.abs(a.x - b.x) < 1 && b.y > a.y).toBe(true);
});

test("on a computer cards sit side by side from 280px each", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], { width: 1440, height: 900 });
  const a = await cardOf(page, "Kebun Bunga Atelier").boundingBox();
  const b = await cardOf(page, "Pelaminan Ayu").boundingBox();
  expect(a && b && b.x > a.x && Math.abs(a.y - b.y) < 1).toBe(true);
  expect(a!.width).toBeGreaterThanOrEqual(280);
});
