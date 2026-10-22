import { expect, test, type Browser, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { restorePairing } from "../seed";

test.afterEach(closeOtherContexts);

// Task 4.12: a vendor's own screen at /vendors/<id>, against the emulators (guide §5.12).

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

/** A Firestore REST value as a JS value (timestamps stay strings). */
function decode(raw: Record<string, unknown>): Value {
  if ("nullValue" in raw) return null;
  if ("stringValue" in raw) return raw.stringValue as string;
  if ("booleanValue" in raw) return raw.booleanValue as boolean;
  if ("integerValue" in raw) return Number(raw.integerValue);
  if ("doubleValue" in raw) return raw.doubleValue as number;
  if ("timestampValue" in raw) return raw.timestampValue as string;
  if ("arrayValue" in raw) {
    const values = (raw.arrayValue as { values?: Record<string, unknown>[] }).values ?? [];
    return values.map(decode);
  }
  const fields = ((raw.mapValue as { fields?: Record<string, Record<string, unknown>> })?.fields ?? {});
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));
}

async function put(collection: string, id: string, fields: Record<string, Value>) {
  const res = await fetch(`${DOCUMENTS}/${collection}/${id}`, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, encode(v)])) }),
  });
  expect(res.ok).toBe(true);
}

/** The stored document, or null when there is none. */
async function stored(collection: string, id: string): Promise<Record<string, Value> | null> {
  const res = await fetch(`${DOCUMENTS}/${collection}/${id}`, { headers: ADMIN });
  if (res.status === 404) return null;
  const body = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  return Object.fromEntries(Object.entries(body.fields ?? {}).map(([k, v]) => [k, decode(v)]));
}

async function shortlistFor(vendorId: string) {
  const res = await fetch(`${DOCUMENTS}/shortlist`, { headers: ADMIN });
  const body = (await res.json()) as { documents?: { name: string; fields: Record<string, Record<string, unknown>> }[] };
  return (body.documents ?? []).filter((d) => d.fields.sourceVendorId?.stringValue === vendorId);
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
  await put("settings", "accounts", { slots: {} });
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
      notes: "Ask about the arch. https://example.com/arch",
      priceOptions: [
        { id: "o1", description: "Silver", price: 45_000_000, selected: false, includes: "Arch and aisle flowers" },
        { id: "o2", description: "Gold", price: 62_500_000, selected: true },
      ],
    }),
  );
  await put("vendors", "v2", vendor("Dapur Lestari Catering", { category: "Food", contractStatus: "Inquiring" }));
  await put("vendors", "v3", vendor("Nusantara Pelaminan", { category: "Decoration", contractStatus: "Rejected" }));
  await put("shortlist", "s1", { name: "Kebun Bunga Atelier", type: "Decoration", sourceVendorId: "v1", subEntries: [] });
  await put("weddingFiles", "f1", {
    name: "Quote.pdf",
    url: "https://example.com/quote.pdf",
    folderId: null,
    fileType: "application/pdf",
    fileSize: 2_400_000,
    recordRef: { kind: "vendor", id: "v1" },
    createdAt: new Date("2026-05-03T10:00:00Z"),
  });
});

async function signInAs(
  browser: Browser,
  account: (typeof TEST_ACCOUNTS)[number],
  id: string,
  viewport?: { width: number; height: number },
) {
  const context = await browser.newContext(viewport ? { viewport } : {});
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto(`/vendors/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page;
}

const toasts = (page: Page) => page.getByRole("status");

test("shows the hero, the rows, the prices, the notes, the files and the shortlist card", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "v1");

  await expect(page.getByRole("link", { name: "Vendors", exact: true }).first()).toHaveAttribute("href", "/vendors");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Kebun Bunga Atelier/);
  await expect(page.getByText("Decoration", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Keen on Kebun Bunga Atelier" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Every change saves as you go")).toBeVisible();

  // The stage chips, with the stored stage chosen, and the figure from the option we lean towards.
  const stage = page.getByRole("radiogroup", { name: "Stage" });
  await expect(stage.getByRole("radio", { name: "Considering" })).toHaveAttribute("aria-checked", "true");
  await expect(stage.getByRole("radio")).toHaveText(["Noted", "Inquiring", "Considering", "Chosen", "Done", "Ruled out"]);
  await expect(page.getByText("Leaning towards Gold")).toBeVisible();
  await expect(page.locator("p", { hasText: /^Rp62\.500\.000$|^Rp\s*62\.500\.000$/ }).first()).toBeVisible();

  // Contact and reputation.
  await expect(page.getByLabel("Contact person")).toHaveValue("Bu Ayu");
  await expect(page.getByLabel("Phone")).toHaveValue("0812 3456 7890");
  await expect(page.getByRole("link", { name: "Message on WhatsApp" })).toHaveAttribute("href", "https://wa.me/6281234567890");
  await expect(page.getByLabel("Category")).toHaveValue("Decoration");
  await expect(page.getByLabel("Review rating")).toHaveValue("4,8");
  await expect(page.getByText("Out of 5, from their public reviews")).toBeVisible();
  await expect(page.getByLabel("Number of reviewers")).toHaveValue("120");

  // The menu card: the one we lean towards says so, the other offers it.
  await expect(page.getByRole("heading", { name: /^Prices\s*2 options$/ })).toBeVisible();
  const silver = page.getByRole("listitem").filter({ hasText: "Silver" });
  await expect(silver).toContainText("Rp 45.000.000");
  await expect(silver).toContainText("Arch and aisle flowers");
  await expect(silver.getByRole("button", { name: "Lean towards this one" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Gold" })).toContainText("The one we’re leaning towards");

  // Notes read as text with a link, and the file is a tile.
  await expect(page.getByRole("link", { name: "example.com/arch" })).toHaveAttribute("href", "https://example.com/arch");
  await expect(page.getByRole("heading", { name: /^Files\s*1 file$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Quote\.pdf/ })).toHaveAttribute("href", "https://example.com/quote.pdf");

  // It is on the shortlist already.
  await expect(page.getByRole("heading", { name: "On the shortlist" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open on the shortlist" })).toHaveAttribute("href", "/vendors/shortlist/s1");
  await expect(page.getByRole("button", { name: "Copy to the shortlist" })).toHaveCount(0);
});

test("a vendor with no prices says so, and offers the shortlist", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "v2");
  await expect(page.getByText("No price yet", { exact: true })).toBeVisible();
  await expect(page.getByText("Add the prices they give you below, and mark the one you’re leaning towards.")).toBeVisible();
  await expect(page.getByText("No prices yet. When they send a price list, add each option here.")).toBeVisible();
  await expect(page.getByText("Nothing written yet.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Files\s*None yet$/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Narrowing down Food?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy to the shortlist" })).toBeVisible();
});

test("a ruled-out vendor has its name struck through and Ruled out chosen", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "v3");
  await expect(page.getByRole("radio", { name: "Ruled out" })).toHaveAttribute("aria-checked", "true");
  const name = page.getByRole("heading", { level: 1 }).getByText("Nusantara Pelaminan");
  await expect(name).toHaveCSS("text-decoration-line", "line-through");
});

test("a link that leads nowhere says the vendor isn't here", async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(TEST_ACCOUNTS[0].email);
  await page.getByLabel("Password").fill(TEST_ACCOUNTS[0].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/vendors/old-link");
  await expect(page.getByRole("heading", { name: "This vendor isn’t here" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("The link may be out of date, or the vendor was removed a while ago.")).toBeVisible();
  await expect(page.getByRole("link", { name: "See all vendors" })).toHaveAttribute("href", "/vendors");
});

test("fields save as you go, say so, and survive a reload", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "v1");

  await page.getByLabel("Contact person").fill("Bu Ayu Lestari");
  await page.getByLabel("Contact person").blur();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect.poll(async () => (await stored("vendors", "v1"))?.contactName).toBe("Bu Ayu Lestari");

  await page.getByLabel("Category").selectOption("Food");
  await expect.poll(async () => (await stored("vendors", "v1"))?.category).toBe("Food");
  expect((await stored("vendors", "v1"))?.confirmedType).toBe("Food");
  await expect(page.getByRole("heading", { name: "Narrowing down Food?" })).toHaveCount(0); // it is on the shortlist already

  await page.getByLabel("Review rating").fill("4,9");
  await page.getByLabel("Review rating").blur();
  await expect.poll(async () => (await stored("vendors", "v1"))?.bridestoryRating).toBe(4.9);
  await expect(page.getByLabel("Review rating")).toHaveValue("4,9");

  await page.getByLabel("Number of reviewers").fill("1.250");
  await page.getByLabel("Number of reviewers").blur();
  await expect.poll(async () => (await stored("vendors", "v1"))?.bridestoryReviewCount).toBe(1250);
  await expect(page.getByLabel("Number of reviewers")).toHaveValue("1.250");

  await page.reload();
  await expect(page.getByLabel("Contact person")).toHaveValue("Bu Ayu Lestari", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByLabel("Review rating")).toHaveValue("4,9");
});

test("a rating or a reviewer count that isn't one is refused, quoting it", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "v1");

  await page.getByLabel("Review rating").fill("great");
  await page.getByLabel("Review rating").blur();
  await expect(page.getByText("“great” isn’t a rating. Use a number from 0 to 5, like 4,8. It stays 4,8.")).toBeVisible();
  await expect(page.getByLabel("Review rating")).toHaveValue("4,8");

  await page.getByLabel("Review rating").fill("7");
  await page.getByLabel("Review rating").blur();
  await expect(page.getByText("“7” is outside the scale. A rating runs from 0 to 5, like 4,8. It stays 4,8.")).toBeVisible();

  // The line goes as soon as a usable rating is typed, and a blank field clears the rating.
  await page.getByLabel("Review rating").fill("");
  await expect(page.getByText(/outside the scale/)).toHaveCount(0);
  await page.getByLabel("Review rating").blur();
  await expect.poll(async () => (await stored("vendors", "v1"))?.bridestoryRating).toBeNull();

  await page.getByLabel("Number of reviewers").fill("a few");
  await page.getByLabel("Number of reviewers").blur();
  await expect(page.getByText("“a few” isn’t a number of people. Use digits, like 120. It stays 120.")).toBeVisible();
  expect((await stored("vendors", "v1"))?.bridestoryReviewCount).toBe(120);
});

test("the keen heart saves and toasts", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "v1");
  await page.getByRole("button", { name: "Keen on Kebun Bunga Atelier" }).click();
  await expect(toasts(page).getByText("Unmarked Kebun Bunga Atelier")).toBeVisible();
  await expect(page.getByRole("button", { name: "Keen on Kebun Bunga Atelier" })).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await stored("vendors", "v1"))?.starred).toBe(false);
});

test("choosing Chosen makes the vendor a booking, with a toast to open it", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "v1");
  await page.getByRole("radio", { name: "Chosen" }).click();

  await expect(toasts(page).getByText("Kebun Bunga Atelier is now a booking")).toBeVisible();
  await expect(toasts(page).getByRole("button", { name: "Open" })).toBeVisible();
  await expect(page.getByText("Chosen, and now a booking.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the booking" })).toHaveAttribute("href", "/budget/bookings/vendor-v1");

  const doc = await stored("vendors", "v1");
  expect(doc?.contractStatus).toBe("Chosen");
  expect((doc?.booking as { from: string; removed: boolean }).from).toBe("vendor");
  expect((doc?.booking as { removed: boolean }).removed).toBe(false);
  expect(doc?.estimate).toBe(62_500_000);

  // Another stage afterwards moves only the stage: the booking stays, and is said to.
  await page.getByRole("radio", { name: "Done" }).click();
  await expect.poll(async () => (await stored("vendors", "v1"))?.contractStatus).toBe("Done");
  await page.getByRole("radio", { name: "Inquiring" }).click();
  await expect.poll(async () => (await stored("vendors", "v1"))?.contractStatus).toBe("Inquiring");
  await expect(page.getByText("Now a booking.")).toBeVisible();
  expect(((await stored("vendors", "v1"))?.booking as { removed: boolean }).removed).toBe(false);
});

test("price options: add with Cancel, edit as you go, lean towards one, remove with undo", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "v1");

  // Add: Cancel leaves nothing; Add option puts it in, leaning when ticked, with an Undo.
  await page.getByRole("button", { name: "Add a price option" }).click();
  const add = page.getByRole("dialog", { name: "Add a price option" });
  await expect(add.getByText("Kebun Bunga Atelier")).toBeVisible();
  await expect(add.getByLabel("Name")).toBeFocused();
  await expect(add.getByRole("checkbox", { name: "The one we’re leaning towards" })).not.toBeChecked();
  await add.getByRole("button", { name: "Cancel" }).click();
  await expect(add).toBeHidden();
  expect(((await stored("vendors", "v1"))?.priceOptions as unknown[]).length).toBe(2);

  await page.getByRole("button", { name: "Add a price option" }).click();
  await add.getByLabel("Name").fill("Platinum");
  await add.getByLabel("Price").fill("90000000");
  await add.getByLabel("What’s included").fill("Everything, plus the arch");
  await add.getByRole("checkbox", { name: "The one we’re leaning towards" }).check();
  await add.getByRole("button", { name: "Add option" }).click();
  await expect(add).toBeHidden();
  await expect(toasts(page).getByText("Added Platinum")).toBeVisible();
  await expect(page.getByText("Leaning towards Platinum")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Prices\s*3 options$/ })).toBeVisible();
  const options = (await stored("vendors", "v1"))?.priceOptions as { description: string; price: number; selected: boolean; includes: string }[];
  expect(options.map((o) => [o.description, o.selected])).toEqual([["Silver", false], ["Gold", false], ["Platinum", true]]);
  expect(options[2]).toMatchObject({ price: 90_000_000, includes: "Everything, plus the arch" });

  // Undo puts the list back, Gold included as the one we lean towards.
  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Leaning towards Gold")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Prices\s*2 options$/ })).toBeVisible();

  // Edit saves as you go; Done closes.
  await page.getByRole("listitem").filter({ hasText: "Silver" }).getByRole("button", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit price option" });
  await edit.getByLabel("Price").fill("48000000");
  await edit.getByLabel("Price").blur();
  await expect(edit.getByText("Saved", { exact: true })).toBeVisible();
  await edit.getByLabel("Name").fill("Silver plus");
  await edit.getByLabel("Name").blur();
  await edit.getByRole("checkbox", { name: "The one we’re leaning towards" }).check();
  await expect(edit.getByText("Saved", { exact: true })).toBeVisible();
  await edit.getByRole("button", { name: "Done" }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByText("Leaning towards Silver plus")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Silver plus" })).toContainText("Rp 48.000.000");
  const edited = (await stored("vendors", "v1"))?.priceOptions as { description: string; selected: boolean; price: number }[];
  expect(edited.map((o) => [o.description, o.selected, o.price])).toEqual([
    ["Silver plus", true, 48_000_000],
    ["Gold", false, 62_500_000],
  ]);

  // Lean towards another one from the menu card.
  await page.getByRole("listitem").filter({ hasText: "Gold" }).getByRole("button", { name: "Lean towards this one" }).click();
  await expect(page.getByText("Leaning towards Gold")).toBeVisible();

  // Remove asks, names the consequence, and can be undone.
  await page.getByRole("listitem").filter({ hasText: "Gold" }).getByRole("button", { name: "Remove" }).click();
  const confirm = page.getByRole("dialog", { name: "Remove Gold?" });
  await expect(confirm).toContainText("Rp 62.500.000. It’s the one you’re leaning towards, so no price will count until you choose another.");
  await confirm.getByRole("button", { name: "Remove option" }).click();
  await expect(page.getByText("No price yet", { exact: true })).toBeVisible();
  await expect(toasts(page).getByText("Removed Gold")).toBeVisible();
  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Leaning towards Gold")).toBeVisible();
});

test("copying to the shortlist makes one copy, flips the card, and can be undone", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "v2");
  await page.getByRole("button", { name: "Copy to the shortlist" }).click();
  await expect(page.getByRole("heading", { name: "On the shortlist" })).toBeVisible();
  await expect(toasts(page).getByText("Copied Dapur Lestari Catering to the shortlist")).toBeVisible();
  expect(await shortlistFor("v2")).toHaveLength(1);

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: "Copy to the shortlist" })).toBeVisible();
  expect(await shortlistFor("v2")).toHaveLength(0);
});

test("removing a vendor asks first, says it in place, and can be undone", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "v1");
  await page.getByRole("button", { name: "Remove this vendor" }).click();
  const confirm = page.getByRole("dialog", { name: "Remove Kebun Bunga Atelier?" });
  await expect(confirm).toContainText(
    "It leaves Vendors, with its 2 price options and notes. Its file stays in Files › Vendors › Kebun Bunga Atelier. Its copy on the shortlist stays. You can undo for a few seconds.",
  );
  await confirm.getByRole("button", { name: "Keep it" }).click();
  expect(await stored("vendors", "v1")).not.toBeNull();

  await page.getByRole("button", { name: "Remove this vendor" }).click();
  await confirm.getByRole("button", { name: "Remove vendor" }).click();
  await expect(page.getByRole("heading", { name: "Kebun Bunga Atelier was removed" })).toBeVisible();
  await expect(page.getByText("It’s no longer in Vendors.")).toBeVisible();
  await expect(page.getByRole("link", { name: "See all vendors" })).toHaveAttribute("href", "/vendors");
  expect(await stored("vendors", "v1")).toBeNull();
  // What came from it stays.
  expect(await stored("weddingFiles", "f1")).not.toBeNull();
  expect(await shortlistFor("v1")).toHaveLength(1);

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Kebun Bunga Atelier/);
  await expect(page.getByLabel("Contact person")).toHaveValue("Bu Ayu");
  expect((await stored("vendors", "v1"))?.name).toBe("Kebun Bunga Atelier");
});

test("removing a vendor that is a booking keeps the booking in the budget", async ({ browser }) => {
  await put(
    "vendors",
    "v4",
    vendor("Booked Band", { category: "Music/DJ", contractStatus: "Chosen", booking: { on: "2026-09-01", from: "vendor", removed: false }, totalPrice: 5_000_000 }),
  );
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "v4");
  await page.getByRole("button", { name: "Remove this vendor" }).click();
  const confirm = page.getByRole("dialog", { name: "Remove Booked Band?" });
  await expect(confirm).toContainText("Its booking stays in the budget.");
  await confirm.getByRole("button", { name: "Remove vendor" }).click();
  await expect(page.getByRole("heading", { name: "Booked Band was removed" })).toBeVisible();

  // The record is still there as a booking made directly, so it left the list and not the budget.
  const doc = await stored("vendors", "v4");
  expect(doc).not.toBeNull();
  expect(doc?.booking).toMatchObject({ from: "direct", removed: false });
  expect(doc?.totalPrice).toBe(5_000_000);

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Booked Band/);
  await expect.poll(async () => ((await stored("vendors", "v4"))?.booking as { from: string }).from).toBe("vendor");
});

test("when Bella removes the vendor Greg is looking at, Greg is told", async ({ browser }) => {
  const greg = await signInAs(browser, TEST_ACCOUNTS[0], "v2");
  const bella = await signInAs(browser, TEST_ACCOUNTS[1], "v2");
  await bella.getByRole("button", { name: "Remove this vendor" }).click();
  await bella.getByRole("dialog").getByRole("button", { name: "Remove vendor" }).click();
  await expect(bella.getByRole("heading", { name: "Dapur Lestari Catering was removed" })).toBeVisible();

  await expect(greg.getByRole("heading", { name: "This vendor was removed" })).toBeVisible({ timeout: 15_000 });
  await expect(greg.getByText("Bella removed it on another device a moment ago.")).toBeVisible();
});

test("on a phone nothing runs off the side", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "v1", { width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Kebun Bunga Atelier", level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
