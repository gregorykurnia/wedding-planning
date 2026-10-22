import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { restorePairing } from "../seed";

test.afterEach(closeOtherContexts);

// Task 4.10: the What-if items screen at /budget/what-if, against the emulators (guide §5.10).

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

interface Stored {
  integerValue?: string;
  stringValue?: string;
  nullValue?: null;
  arrayValue?: { values?: { mapValue: { fields: Record<string, Stored> } }[] };
}

/** A stored document's fields, as Firestore's REST API writes them; null when it is gone. */
async function stored(collection: string, id: string): Promise<Record<string, Stored> | null> {
  const res = await fetch(`${DOCUMENTS}/${collection}/${id}`, { headers: ADMIN });
  return res.ok ? ((await res.json()).fields as Record<string, Stored>) : null;
}

const parts = (fields: Record<string, Stored>) => (fields.subEntries.arrayValue?.values ?? []).map((v) => v.mapValue.fields);

// This spec empties Firestore, so the specs after it get the accounts paired again.
test.afterAll(restorePairing);

test.beforeEach(async () => {
  const res = await fetch(`${DOCUMENTS.replace("/v1/", "/emulator/v1/")}`, { method: "DELETE" });
  expect(res.ok).toBe(true);
  await put("settings", "wedding", { yourName: "Greg", partnerName: "Bella", partnerEmail: TEST_ACCOUNTS[1].email });
  await put("funders", "f-greg", { name: "Greg", order: 0 });
  await put("funders", "f-bella", { name: "Bella", order: 1 });
  // Rp 300.000.000 committed.
  await put("vendors", "v1", {
    name: "Villa Samaya",
    category: "Other",
    contractStatus: "Chosen",
    funder: "f-greg",
    totalPrice: 300_000_000,
    budgetSpent: 0,
  });
  await put("hypotheticalItems", "w1", {
    name: "Fireworks over the lake",
    type: "Decoration",
    totalPrice: 12_000_000,
    funder: "f-greg",
    subEntries: [],
    createdAt: new Date("2026-05-01T10:00:00Z"),
  });
  await put("hypotheticalItems", "w2", {
    name: "Live band for the reception",
    type: "Music/DJ",
    totalPrice: 0,
    funder: null,
    subEntries: [
      { id: "p1", name: "Deposit", totalPrice: 10_000_000, funder: "f-bella" },
      { id: "p2", name: "Balance", totalPrice: 20_000_000, funder: "f-greg" },
    ],
    createdAt: new Date("2026-05-02T10:00:00Z"),
  });
  await put("hypotheticalItems", "w3", {
    name: "Second photographer",
    type: "Photos and Videos",
    totalPrice: 8_000_000,
    funder: null,
    subEntries: [],
    createdAt: new Date("2026-05-03T10:00:00Z"),
  });
});

async function signInAs(browser: Browser, viewport?: { width: number; height: number }) {
  const account = TEST_ACCOUNTS[0];
  const context = await browser.newContext(viewport ? { viewport } : {});
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/budget/what-if");
  await expect(page.getByRole("heading", { name: "What-if items", level: 1 })).toBeAttached({ timeout: COMPILE_TIMEOUT });
  return page;
}

/** The values of every control the locator matches, in order. */
const valuesOf = (locator: Locator) => locator.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));

const entry = (page: Page, id: string) => page.locator(`[data-whatif-id="${id}"]`);
const toasts = (page: Page) => page.getByRole("status");
const names = (page: Page) => page.locator('ul[aria-label="What-if items"] [data-whatif-id] > span:first-child');

test("shows the projected total, who would pay the extra and the items", async ({ browser }) => {
  const page = await signInAs(browser);

  await expect(page.getByText("If you went ahead with everything here")).toBeVisible();
  await expect(page.getByText(/^Rp\s?350\.000\.000$/)).toBeVisible();
  await expect(page.getByText("Rp 300.000.000 already committed, plus Rp 50.000.000 in what-if items")).toBeVisible();
  await expect(page.getByRole("img", { name: "86% committed, the rest what-if" })).toBeVisible();

  // Biggest share first: Greg 12 + 20, Bella 10, and the 8 nobody has taken on.
  const carry = page.locator("ul").filter({ hasText: "Not assigned yet" }).first().locator("li");
  await expect(carry).toHaveText([/Greg.*\+ Rp 32\.000\.000/, /Bella.*\+ Rp 10\.000\.000/, /Not assigned yet.*\+ Rp 8\.000\.000/]);

  await expect(page.getByRole("heading", { name: /Items/ })).toContainText("3 items");
  await expect(entry(page, "w1")).toContainText("Rp 12.000.000");
  await expect(entry(page, "w1")).toContainText("Decoration, would be paid by Greg");
  await expect(entry(page, "w3")).toContainText("Photos and Videos, would be paid by nobody yet");
  // An item in parts: the price is the parts added up, with each part under it.
  await expect(entry(page, "w2")).toContainText("Rp 30.000.000");
  await expect(entry(page, "w2")).toContainText("Deposit");
  await expect(entry(page, "w2")).toContainText("Rp 10.000.000, Bella");
  await expect(entry(page, "w2")).toContainText("Rp 20.000.000, Greg");
});

test("orders the items, price from the biggest, and the direction flips", async ({ browser }) => {
  const page = await signInAs(browser);

  // Order added, oldest first.
  await expect(names(page)).toHaveText(["Fireworks over the lake", "Live band for the reception", "Second photographer"]);
  await page.getByLabel("Order by").selectOption("price");
  await expect(names(page)).toHaveText(["Live band for the reception", "Fireworks over the lake", "Second photographer"]);
  await page.getByRole("button", { name: "Descending" }).click();
  await expect(names(page)).toHaveText(["Second photographer", "Fireworks over the lake", "Live band for the reception"]);
  await page.getByLabel("Order by").selectOption("name");
  await expect(names(page).first()).toHaveText("Fireworks over the lake");
  await page.getByLabel("Order by").selectOption("funder");
  // Bella (the band's first part) before Greg, nobody yet last.
  await expect(names(page)).toHaveText(["Live band for the reception", "Fireworks over the lake", "Second photographer"]);
});

test("adds an item, turns back a missing name, and undoes the add", async ({ browser }) => {
  const page = await signInAs(browser);
  await page.getByRole("button", { name: "Add a what-if item" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a what-if item" });
  await expect(sheet.getByRole("radio")).toHaveText(["Greg", "Bella", "Not assigned"]);
  await expect(sheet.getByRole("radio", { name: "Not assigned" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByLabel("Category")).toHaveValue("Other");

  // A name is required: the field says so and keeps focus.
  await sheet.getByRole("button", { name: "Add item" }).click();
  await expect(sheet.getByText("Give the what-if item a name.")).toBeVisible();
  await expect(sheet.getByLabel("What it is")).toBeFocused();

  await sheet.getByLabel("What it is").fill("Photo booth");
  await sheet.getByLabel("Category").selectOption("Photos and Videos");
  await sheet.getByLabel("Price").fill("15000000");
  await sheet.getByRole("radio", { name: "Bella" }).click();
  await sheet.getByRole("button", { name: "Add item" }).click();
  await expect(sheet).toBeHidden();

  const added = page.locator('[data-whatif-id]').filter({ hasText: "Photo booth" });
  await expect(added).toContainText("Rp 15.000.000");
  await expect(added).toContainText("Photos and Videos, would be paid by Bella");
  await expect(toasts(page).getByText("Added Photo booth")).toBeVisible();
  await expect(page.getByText(/^Rp\s?365\.000\.000$/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Items/ })).toContainText("4 items");

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.locator('[data-whatif-id]').filter({ hasText: "Photo booth" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Items/ })).toContainText("3 items");
});

test("an item's sheet saves as you go and the numbers follow", async ({ browser }) => {
  const page = await signInAs(browser);
  await entry(page, "w1").getByRole("button", { name: "Edit" }).click();
  // The sheet is titled with the item's name, which this test changes.
  const sheet = page.getByRole("dialog", { name: /^Edit / });
  await expect(sheet).toHaveAccessibleName("Edit Fireworks over the lake");
  await expect(sheet.getByLabel("What it is")).toHaveValue("Fireworks over the lake");
  await expect(sheet.getByLabel("Category")).toHaveValue("Decoration");
  await expect(sheet.getByLabel("Price")).toHaveValue("Rp 12.000.000");
  await expect(sheet.getByRole("radio", { name: "Greg" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByText("Paying in stages?")).toContainText("Split into parts");

  await sheet.getByLabel("Price").fill("15000000");
  await sheet.getByLabel("Price").press("Enter");
  await sheet.getByRole("radio", { name: "Bella" }).click();
  await sheet.getByLabel("Category").selectOption("Photos and Videos");
  await sheet.getByLabel("What it is").fill("Fireworks and lanterns");
  await sheet.getByLabel("What it is").press("Enter");
  await expect(sheet.getByText("Saved")).toBeVisible();

  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();
  await expect(entry(page, "w1")).toContainText("Fireworks and lanterns");
  await expect(entry(page, "w1")).toContainText("Rp 15.000.000");
  await expect(entry(page, "w1")).toContainText("Photos and Videos, would be paid by Bella");
  await expect(page.getByText("Rp 300.000.000 already committed, plus Rp 53.000.000 in what-if items")).toBeVisible();

  const doc = await stored("hypotheticalItems", "w1");
  expect(doc?.name.stringValue).toBe("Fireworks and lanterns");
  expect(doc?.type.stringValue).toBe("Photos and Videos");
  expect(doc?.totalPrice.integerValue).toBe("15000000");
  expect(doc?.funder.stringValue).toBe("f-bella");

  // Text for a price is refused in place and the old price kept.
  await entry(page, "w1").getByRole("button", { name: "Edit" }).click();
  await sheet.getByLabel("Price").fill("lots");
  await sheet.getByLabel("Price").press("Enter");
  await expect(sheet.getByLabel("Price")).toHaveValue("Rp 15.000.000");
  await expect(sheet.getByRole("alert")).toBeVisible();
});

test("splits an item into parts, edits them, and merges back when one is left", async ({ browser }) => {
  const page = await signInAs(browser);
  await entry(page, "w3").getByRole("button", { name: "Edit" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit Second photographer" });
  await sheet.getByRole("button", { name: "Split into parts" }).click();

  // Part 1 takes the price, Part 2 starts at Rp 0, and the item's own price and funder go.
  await expect(sheet.getByRole("heading", { name: /Parts/ })).toContainText("2 parts; the price comes from them");
  await expect(sheet.getByText("Rp 8.000.000 in all")).toBeVisible();
  await expect.poll(() => valuesOf(sheet.getByLabel("Part name"))).toEqual(["Part 1", "Part 2"]);
  await expect.poll(() => valuesOf(sheet.getByLabel("Price"))).toEqual(["Rp 8.000.000", "Rp 0"]);
  await expect(sheet.getByLabel("Part name").first()).toBeFocused();
  await expect(sheet.getByRole("radio")).toHaveCount(0);

  const second = sheet.getByLabel("Part name").nth(1);
  await second.fill("Album");
  await second.press("Enter");
  await sheet.getByLabel("Price").nth(1).fill("2000000");
  await sheet.getByLabel("Price").nth(1).press("Enter");
  await sheet.getByLabel("Who would pay").nth(1).selectOption("f-bella");
  await expect(sheet.getByText("Rp 10.000.000 in all")).toBeVisible();

  await sheet.getByRole("button", { name: "Add a part" }).click();
  await expect(sheet.getByLabel("Part name")).toHaveCount(3);
  await expect(sheet.getByLabel("Part name").nth(2)).toHaveValue("Part 3");
  await expect(sheet.getByLabel("Part name").nth(2)).toBeFocused();

  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(entry(page, "w3")).toContainText("Rp 10.000.000");
  await expect(entry(page, "w3")).toContainText("Album");
  await expect(entry(page, "w3")).toContainText("Rp 2.000.000, Bella");
  const doc = await stored("hypotheticalItems", "w3");
  expect(parts(doc!).map((p) => [p.name.stringValue, p.totalPrice.integerValue])).toEqual([
    ["Part 1", "8000000"],
    ["Album", "2000000"],
    ["Part 3", "0"],
  ]);
  expect(doc?.funder.nullValue).toBeNull();

  // Removing down to one part merges it back into a single item with that part's price and funder.
  await entry(page, "w3").getByRole("button", { name: "Edit" }).click();
  await sheet.getByRole("button", { name: /Remove Part 3/ }).click();
  await expect(sheet.getByLabel("Part name")).toHaveCount(2);
  await sheet.getByRole("button", { name: /Remove Part 1/ }).click();
  await expect(sheet.getByLabel("Part name")).toHaveCount(0);
  await expect(sheet.getByLabel("Price")).toHaveValue("Rp 2.000.000");
  await expect(sheet.getByRole("radio", { name: "Bella" })).toHaveAttribute("aria-checked", "true");
  const merged = await stored("hypotheticalItems", "w3");
  expect(merged?.totalPrice.integerValue).toBe("2000000");
  expect(merged?.funder.stringValue).toBe("f-bella");
  expect(parts(merged!)).toHaveLength(0);
});

test("a part can be set to Not assigned, and it stays", async ({ browser }) => {
  const page = await signInAs(browser);
  await entry(page, "w1").getByRole("button", { name: "Edit" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit Fireworks over the lake" });
  await sheet.getByRole("button", { name: "Split into parts" }).click();
  await expect.poll(() => valuesOf(sheet.getByLabel("Who would pay"))).toEqual(["f-greg", "f-greg"]);
  await sheet.getByLabel("Who would pay").nth(1).selectOption("");
  await expect(sheet.getByText("Saved")).toBeVisible();
  await expect.poll(() => valuesOf(sheet.getByLabel("Who would pay"))).toEqual(["f-greg", ""]);
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(entry(page, "w1")).toContainText("Rp 0, no funder yet");
});

test("removing an item asks first, says what leaves, and Undo brings it back", async ({ browser }) => {
  const page = await signInAs(browser);
  await entry(page, "w1").getByRole("button", { name: "Remove" }).click();
  const confirm = page.getByRole("dialog", { name: "Remove Fireworks over the lake?" });
  await expect(confirm.getByText("Rp 12.000.000 comes off the projected total. You can undo for a few seconds.")).toBeVisible();
  await confirm.getByRole("button", { name: "Keep it" }).click();
  await expect(entry(page, "w1")).toBeVisible();

  await entry(page, "w1").getByRole("button", { name: "Remove" }).click();
  await confirm.getByRole("button", { name: "Remove item" }).click();
  await expect(entry(page, "w1")).toHaveCount(0);
  await expect(toasts(page).getByText("Removed Fireworks over the lake")).toBeVisible();
  await expect(page.getByText("Rp 300.000.000 already committed, plus Rp 38.000.000 in what-if items")).toBeVisible();
  await expect.poll(() => stored("hypotheticalItems", "w1")).toBeNull();

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(entry(page, "w1")).toBeVisible();
  await expect.poll(async () => (await stored("hypotheticalItems", "w1"))?.name.stringValue).toBe("Fireworks over the lake");
});

test("removing the last item shows the empty layout, and the page fits a phone", async ({ browser }) => {
  const page = await signInAs(browser, { width: 390, height: 844 });
  // No sideways scroll with a part in the list.
  await entry(page, "w2").getByRole("button", { name: "Edit" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit Live band for the reception" });
  await expect.poll(() => valuesOf(sheet.getByLabel("Part name"))).toEqual(["Deposit", "Balance"]);
  const overflow = await sheet.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(overflow).toBe(false);
  await sheet.getByRole("button", { name: "Done" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  for (const id of ["w1", "w2", "w3"]) {
    await entry(page, id).getByRole("button", { name: "Remove" }).click();
    await page.getByRole("dialog", { name: /^Remove / }).getByRole("button", { name: "Remove item" }).click();
    await expect(entry(page, id)).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "Try an idea before you commit", level: 2 })).toBeVisible();
});
