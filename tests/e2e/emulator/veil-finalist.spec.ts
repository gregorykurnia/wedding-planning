import { expect, test, type Browser, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { restorePairing } from "../seed";

test.afterEach(closeOtherContexts);

// Task 4.14: a finalist's own screen at /vendors/shortlist/<id>, against the emulators (guide §5.14).

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

const vendor = (name: string, over: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  category: "Decoration",
  contactName: "",
  contactPhone: "",
  contractStatus: "Consideration",
  priceOptions: [],
  notes: "",
  starred: false,
  files: [],
  subEntries: [],
  createdAt: new Date("2026-05-02T10:00:00Z"),
  ...over,
});

const file = (name: string, recordRef: Value, extra: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  url: `https://example.com/${name.toLowerCase().replace(/\W+/g, "-")}`,
  folderId: null,
  fileType: "application/pdf",
  fileSize: 2_400_000,
  recordRef,
  createdAt: new Date("2026-05-03T10:00:00Z"),
  ...extra,
});

// This spec empties Firestore, so the specs after it get the accounts paired again.
test.afterAll(restorePairing);

test.beforeEach(async () => {
  const res = await fetch(`${DOCUMENTS.replace("/v1/", "/emulator/v1/")}`, { method: "DELETE" });
  expect(res.ok).toBe(true);
  await put("settings", "wedding", { yourName: "Greg", partnerName: "Bella", partnerEmail: TEST_ACCOUNTS[1].email });
  await put("settings", "accounts", { slots: {} });

  // s1 is copied from the vendor v1, with a second package that has its own words and file.
  await put("vendors", "v1", vendor("Kebun Bunga Atelier", { category: "Decoration" }));
  await put(
    "shortlist",
    "s1",
    finalist("Kebun Bunga Atelier", {
      type: "Decoration",
      contactName: "Bu Ayu",
      contactPhone: "0812 3456 7890",
      price: 45_000_000,
      priceDescription: "Silver",
      includes: "Arch and aisle flowers",
      bridestoryReviewers: 120,
      igFollowers: 12_300,
      nextAction: "Ask about the arch",
      notes: "Prefers sage. https://example.com/sage",
      sourceVendorId: "v1",
      preferredPackageId: "k1",
      subEntries: [
        {
          id: "k1",
          name: "Gold",
          type: "Decoration",
          price: 62_500_000,
          priceDescription: "Gold",
          includes: "Everything, plus the arch",
          bridestoryReviewers: 40,
          igFollowers: null,
          nextAction: "Send the quote",
          notes: "Quote https://example.com/gold",
          files: [],
        },
      ],
    }),
  );
  await put("weddingFiles", "f-vendor", file("Vendor-quote.pdf", { kind: "vendor", id: "v1" }));
  await put("weddingFiles", "f-own", file("Moodboard.pdf", { kind: "finalist", id: "s1" }, { createdAt: new Date("2026-05-04T10:00:00Z") }));
  await put("weddingFiles", "f-gold", file("Gold-contract.pdf", { kind: "finalist", id: "s1", partId: "k1" }));

  // s2 was added straight to the shortlist; s3 has no packages yet.
  await put(
    "shortlist",
    "s2",
    finalist("Arka Visual", {
      type: "Photos and Videos",
      price: 15_000_000,
      priceDescription: "Full day",
      subEntries: [{ id: "k2", name: "Half day", type: "Photos and Videos", price: 9_000_000, priceDescription: "Half day" }],
      preferredPackageId: "main",
    }),
  );
  await put("shortlist", "s3", finalist("Bare Studio", { type: "Music/DJ" }));
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
  await page.goto(`/vendors/shortlist/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page;
}

const toasts = (page: Page) => page.getByRole("status");

test("shows the hero, where it came from, the packages, the rows, the notes and every file", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s1");

  await expect(page.getByRole("link", { name: "Shortlist", exact: true }).first()).toHaveAttribute("href", "/vendors/shortlist");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kebun Bunga Atelier");
  await expect(page.getByText("Decoration", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Every change saves as you go")).toBeVisible();
  await expect(page.getByText(/^Copied from Kebun Bunga Atelier in Vendors\. Changes here don’t touch it\.$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Kebun Bunga Atelier", exact: true }).first()).toHaveAttribute("href", "/vendors/v1");

  // The figure is the package we lean towards.
  await expect(page.getByText("Leaning towards Gold")).toBeVisible();
  await expect(page.locator("p", { hasText: /^Rp\s*62\.500\.000$/ }).first()).toBeVisible();

  // The menu card: the finalist's own price first, then Gold with its own words, reviews, step, notes and file.
  await expect(page.getByRole("heading", { name: /^Packages\s*2 packages$/ })).toBeVisible();
  const silver = page.getByRole("listitem").filter({ hasText: "Silver" });
  await expect(silver).toContainText("Rp 45.000.000");
  await expect(silver).toContainText("Arch and aisle flowers");
  await expect(silver.getByRole("button", { name: "Lean towards this one" })).toBeVisible();
  const gold = page.getByRole("listitem").filter({ hasText: "Gold" }).first();
  await expect(gold).toContainText("The one we’re leaning towards");
  await expect(gold).toContainText("Everything, plus the arch");
  await expect(gold).toContainText("40 reviews. Next: Send the quote. 1 file");
  await expect(gold.getByRole("link", { name: "example.com/gold" })).toHaveAttribute("href", "https://example.com/gold");

  // Contact and popularity.
  await expect(page.getByLabel("Contact person")).toHaveValue("Bu Ayu");
  await expect(page.getByLabel("Phone")).toHaveValue("0812 3456 7890");
  await expect(page.getByRole("link", { name: "Message on WhatsApp" })).toHaveAttribute("href", "https://wa.me/6281234567890");
  await expect(page.getByLabel("Reviews")).toHaveValue("120");
  await expect(page.getByLabel("Instagram followers")).toHaveValue("12.300");
  await expect(page.getByLabel("Next step")).toHaveValue("Ask about the arch");

  // Notes read as text with a link; the files are its own and the vendor's.
  await expect(page.getByRole("link", { name: "example.com/sage" })).toHaveAttribute("href", "https://example.com/sage");
  await expect(page.getByRole("heading", { name: /^Files\s*2 files$/ })).toBeVisible();
  await expect(page.getByText("Files added to Kebun Bunga Atelier in Vendors appear here by themselves.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Moodboard\.pdf/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Vendor-quote\.pdf.*, from the vendor/ })).toBeVisible();
  // A package's own file is on the package, not among the finalist's.
  await expect(page.getByRole("link", { name: /Gold-contract\.pdf/ })).toHaveCount(0);

  // Copied from a vendor: only Book it, no Move into Vendors.
  await expect(page.getByRole("heading", { name: "Chosen this one?" })).toBeVisible();
  await expect(page.getByText("Book it to make it a confirmed booking. Its details come along, so nothing is typed twice.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Move into Vendors" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Book it", exact: true })).toBeVisible();
});

test("a finalist added straight to the shortlist says so and can move into Vendors", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s2");
  await expect(page.getByText("Added straight to the shortlist")).toBeVisible();
  await expect(page.getByText("Leaning towards Full day")).toBeVisible();
  await expect(page.getByText("Files added to")).toHaveCount(0);
  await expect(page.getByText("Book it to make it a confirmed booking, or move it into Vendors to keep it on file.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Move into Vendors" })).toBeVisible();
});

test("a finalist with no packages says so, and Book it starts without a price", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s3");
  await expect(page.getByText("No package chosen yet", { exact: true })).toBeVisible();
  await expect(page.getByText("No packages yet. Add each offer they make, with its own price and what’s included.")).toBeVisible();
  await expect(page.getByText("Nothing written yet.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Files\s*None yet$/ })).toBeVisible();

  await page.getByRole("button", { name: "Book it", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Book Bare Studio" });
  await expect(sheet.getByText("No packages yet, so the booking starts without a price.")).toBeVisible();
  await expect(sheet.getByRole("radio")).toHaveCount(0);
});

test("a finalist from a vendor that was removed says so, and offers no move", async ({ browser }) => {
  await put("shortlist", "s5", finalist("Orphan Florals", { type: "Decoration", sourceVendorId: "gone-vendor", price: 5_000_000, priceDescription: "Basic" }));
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s5");
  await expect(page.getByText("Copied from a vendor that’s no longer in Vendors. Changes here don’t touch anything.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Move into Vendors" })).toHaveCount(0);
  await expect(page.getByText("Files added to")).toHaveCount(0);
});

test("a link that leads nowhere says the finalist isn't here", async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(TEST_ACCOUNTS[0].email);
  await page.getByLabel("Password").fill(TEST_ACCOUNTS[0].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/vendors/shortlist/old-link");
  await expect(page.getByRole("heading", { name: "This finalist isn’t here" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("The link may be out of date, or the finalist was removed a while ago.")).toBeVisible();
  await expect(page.getByRole("link", { name: "See the shortlist" })).toHaveAttribute("href", "/vendors/shortlist");
});

test("a finalist that became a booking carries the flag and a way to the booking, and offers no more booking", async ({ browser }) => {
  await put("vendors", "v4", vendor("Booked Band", { contractStatus: "Chosen", booking: { on: "2026-09-01", from: "finalist", removed: false } }));
  await put("shortlist", "s4", finalist("Booked Band", { type: "Music/DJ", price: 5_000_000, priceDescription: "Evening", movedTo: { kind: "booking", id: "vendor-v4" } }));
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s4");
  await expect(page.getByText("Now a booking", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the booking" })).toHaveAttribute("href", "/budget/bookings/vendor-v4");
  await expect(page.getByRole("heading", { name: "Chosen this one?" })).toHaveCount(0);
});

test("the flag follows the vendor: booked from its own screen, or its booking removed (review P4-S10)", async ({ browser }) => {
  await put("vendors", "v1", vendor("Kebun Bunga Atelier", { category: "Decoration", contractStatus: "Chosen", booking: { on: "2026-09-01", from: "vendor", removed: false } }));
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s1");
  await expect(page.getByText("Now a booking", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the booking" })).toHaveAttribute("href", "/budget/bookings/vendor-v1");
  await expect(page.getByRole("button", { name: "Book it", exact: true })).toHaveCount(0);

  await put("vendors", "v1", vendor("Kebun Bunga Atelier", { category: "Decoration", contractStatus: "Chosen", booking: { on: "2026-09-01", from: "vendor", removed: true } }));
  await expect(page.getByText("Now a booking", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Book it", exact: true })).toBeVisible();
});

test("fields save as you go, say so, and survive a reload", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s1");

  await page.getByLabel("Contact person").fill("Bu Ayu Lestari");
  await page.getByLabel("Contact person").blur();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect.poll(async () => (await stored("shortlist", "s1"))?.contactName).toBe("Bu Ayu Lestari");

  await page.getByLabel("Reviews").fill("1.250");
  await page.getByLabel("Reviews").blur();
  await expect.poll(async () => (await stored("shortlist", "s1"))?.bridestoryReviewers).toBe(1250);
  await expect(page.getByLabel("Reviews")).toHaveValue("1.250");

  await page.getByLabel("Instagram followers").fill("20000");
  await page.getByLabel("Instagram followers").blur();
  await expect.poll(async () => (await stored("shortlist", "s1"))?.igFollowers).toBe(20_000);

  await page.getByLabel("Next step").fill("Visit the studio");
  await page.getByLabel("Next step").blur();
  await expect.poll(async () => (await stored("shortlist", "s1"))?.nextAction).toBe("Visit the studio");

  // Notes: Edit turns them into a textarea, the text saves on blur and Done leaves the editor.
  await page.getByRole("region", { name: "Notes" }).getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Notes" }).fill("Prefers sage and white.");
  await page.getByRole("textbox", { name: "Notes" }).blur();
  await expect.poll(async () => (await stored("shortlist", "s1"))?.notes).toBe("Prefers sage and white.");

  await page.reload();
  await expect(page.getByLabel("Contact person")).toHaveValue("Bu Ayu Lestari", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByLabel("Reviews")).toHaveValue("1.250");
});

test("a count that isn't one is refused, quoting it", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s1");
  await page.getByLabel("Reviews").fill("lots");
  await page.getByLabel("Reviews").blur();
  await expect(page.getByText("“lots” isn’t a number of reviews. Use digits, like 120. It stays 120.")).toBeVisible();
  await expect(page.getByLabel("Reviews")).toHaveValue("120");
  expect((await stored("shortlist", "s1"))?.bridestoryReviewers).toBe(120);

  await page.getByLabel("Instagram followers").fill("12k");
  await page.getByLabel("Instagram followers").blur();
  await expect(page.getByText("“12k” isn’t a number of followers. Use digits, like 12000. It stays 12.300.")).toBeVisible();
});

test("packages: add with Cancel, edit as you go with its own files, lean towards one, remove with undo", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s1");

  // Add: Cancel leaves nothing; Add package puts it in with an Undo.
  await page.getByRole("button", { name: "Add a package" }).click();
  const add = page.getByRole("dialog", { name: "Add a package" });
  await expect(add.getByText("Kebun Bunga Atelier")).toBeVisible();
  await expect(add.getByLabel("Name")).toBeFocused();
  await expect(add.getByText("Add the package first, then attach its files.")).toBeVisible();
  await add.getByRole("button", { name: "Cancel" }).click();
  await expect(add).toBeHidden();
  expect(((await stored("shortlist", "s1"))?.subEntries as unknown[]).length).toBe(1);

  await page.getByRole("button", { name: "Add a package" }).click();
  await add.getByLabel("Name").fill("Platinum");
  await add.getByLabel("Price").fill("90000000");
  await add.getByLabel("What’s included").fill("Everything");
  await add.getByLabel("Reviews").fill("7");
  await add.getByLabel("Next step").fill("Book a visit");
  await add.getByLabel("Notes").fill("Ask about the bridal arch");
  await add.getByRole("button", { name: "Add package" }).click();
  await expect(add).toBeHidden();
  await expect(toasts(page).getByText("Added Platinum")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Packages\s*3 packages$/ })).toBeVisible();
  const added = (await stored("shortlist", "s1"))?.subEntries as { name: string; price: number; includes: string; bridestoryReviewers: number; nextAction: string; notes: string }[];
  expect(added[1]).toMatchObject({
    name: "Platinum",
    price: 90_000_000,
    includes: "Everything",
    bridestoryReviewers: 7,
    nextAction: "Book a visit",
    notes: "Ask about the bridal arch",
  });
  await expect(page.getByRole("listitem").filter({ hasText: "Platinum" })).toContainText("7 reviews. Next: Book a visit");

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { name: /^Packages\s*2 packages$/ })).toBeVisible();

  // Edit saves as you go; the package's own file is in its sheet; Done closes.
  await page.getByRole("listitem").filter({ hasText: "Gold" }).first().getByRole("button", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit package" });
  await expect(edit.getByLabel("Name")).toHaveValue("Gold");
  await expect(edit.getByLabel("Reviews")).toHaveValue("40");
  await expect(edit.getByRole("link", { name: /Gold-contract\.pdf/ })).toBeVisible();
  await expect(edit.getByRole("button", { name: /Add files/ })).toBeVisible();
  await edit.getByLabel("Price").fill("65000000");
  await edit.getByLabel("Price").blur();
  await expect(edit.getByText("Saved", { exact: true })).toBeVisible();
  await edit.getByLabel("Name").fill("Gold plus");
  await edit.getByLabel("Name").blur();
  await edit.getByLabel("Next step").fill("Pay the deposit");
  await edit.getByLabel("Next step").blur();
  await expect(edit.getByText("Saved", { exact: true })).toBeVisible();
  await edit.getByRole("button", { name: "Done" }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByText("Leaning towards Gold plus")).toBeVisible();
  const edited = (await stored("shortlist", "s1"))?.subEntries as { name: string; priceDescription: string; price: number; nextAction: string }[];
  expect(edited[0]).toMatchObject({ name: "Gold plus", priceDescription: "Gold plus", price: 65_000_000, nextAction: "Pay the deposit" });

  // The finalist's own price edits its top-level fields and has no reviews, step, notes or files of its own.
  await page.getByRole("listitem").filter({ hasText: "Silver" }).getByRole("button", { name: "Edit" }).click();
  await expect(edit.getByLabel("Name")).toHaveValue("Silver");
  await expect(edit.getByLabel("Reviews")).toHaveCount(0);
  await edit.getByLabel("Price").fill("46000000");
  await edit.getByLabel("Price").blur();
  await expect(edit.getByText("Saved", { exact: true })).toBeVisible();
  await edit.getByRole("button", { name: "Done" }).click();
  await expect.poll(async () => (await stored("shortlist", "s1"))?.price).toBe(46_000_000);

  // Lean towards another one from the menu card.
  await page.getByRole("listitem").filter({ hasText: "Silver" }).getByRole("button", { name: "Lean towards this one" }).click();
  await expect(page.getByText("Leaning towards Silver")).toBeVisible();
  await expect.poll(async () => (await stored("shortlist", "s1"))?.preferredPackageId).toBe("main");

  // Remove asks, and can be undone.
  await page.getByRole("listitem").filter({ hasText: "Gold plus" }).getByRole("button", { name: "Remove" }).click();
  const confirm = page.getByRole("dialog", { name: "Remove Gold plus?" });
  await expect(confirm).toContainText("Rp 65.000.000. You can undo for a few seconds.");
  await confirm.getByRole("button", { name: "Remove package" }).click();
  await expect(page.getByRole("heading", { name: /^Packages\s*1 package$/ })).toBeVisible();
  await expect(toasts(page).getByText("Removed Gold plus")).toBeVisible();
  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { name: /^Packages\s*2 packages$/ })).toBeVisible();
});

test("Book it: the package chips lean on the one we like, and booking makes a booking with a toast to open it", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s1");
  await page.getByRole("button", { name: "Book it", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Book Kebun Bunga Atelier" });
  await expect(sheet.getByText("It becomes a confirmed booking, with the package you choose as its price.")).toBeVisible();
  await expect(sheet.getByText("Contact, notes and files come along. You’ll set the funder and due dates on the booking.")).toBeVisible();
  const chips = sheet.getByRole("radiogroup", { name: "Package" });
  await expect(chips.getByRole("radio")).toHaveText(["Silver, Rp 45.000.000", "Gold, Rp 62.500.000"]);
  await expect(chips.getByRole("radio", { name: "Gold, Rp 62.500.000" })).toHaveAttribute("aria-checked", "true");

  // Cancel books nothing.
  await sheet.getByRole("button", { name: "Cancel" }).click();
  expect((await stored("shortlist", "s1"))?.movedTo ?? null).toBeNull();

  await page.getByRole("button", { name: "Book it", exact: true }).click();
  await chips.getByRole("radio", { name: "Silver, Rp 45.000.000" }).click();
  await sheet.getByRole("button", { name: "Book it" }).click();
  await expect(sheet).toBeHidden();

  await expect(toasts(page).getByText("Kebun Bunga Atelier is now a booking")).toBeVisible();
  await expect(toasts(page).getByRole("button", { name: "Open" })).toBeVisible();
  await expect(page.getByText("Now a booking", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the booking" })).toHaveAttribute("href", "/budget/bookings/vendor-v1");
  await expect(page.getByRole("heading", { name: "Chosen this one?" })).toHaveCount(0);

  const booked = await stored("vendors", "v1");
  expect(booked?.estimate).toBe(45_000_000);
  expect((booked?.booking as { from: string; removed: boolean }).from).toBe("finalist");
  expect((await stored("shortlist", "s1"))?.movedTo).toEqual({ kind: "booking", id: "vendor-v1" });

  await toasts(page).getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL("/budget/bookings/vendor-v1");
  // The finalist's own files come along with the vendor's (review P4-S11).
  await expect(page.getByText("Moodboard.pdf")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("Vendor-quote.pdf")).toBeVisible();
});

test("Move into Vendors makes a vendor at Considering with the packages as price options, and undo takes it back", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s2");
  await page.getByRole("button", { name: "Move into Vendors" }).click();
  const sheet = page.getByRole("dialog", { name: "Move Arka Visual into Vendors?" });
  await expect(
    sheet.getByText("Its packages become price options, and contact, reviews, notes and files come along. It stays on the shortlist too."),
  ).toBeVisible();
  await sheet.getByRole("button", { name: "Move into Vendors" }).click();
  await expect(sheet).toBeHidden();

  await expect(toasts(page).getByText("Arka Visual is now in Vendors")).toBeVisible();
  // It is copied from that vendor now, so the origin line links to it and the move is no longer offered.
  await expect(page.getByText(/^Copied from Arka Visual in Vendors\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Move into Vendors" })).toHaveCount(0);
  const sourceId = (await stored("shortlist", "s2"))?.sourceVendorId as string;
  const made = await stored("vendors", sourceId);
  expect(made?.contractStatus).toBe("Consideration");
  expect((made?.priceOptions as { description: string; selected: boolean }[]).map((o) => [o.description, o.selected])).toEqual([
    ["Full day", true],
    ["Half day", false],
  ]);

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Added straight to the shortlist")).toBeVisible();
  expect(await stored("vendors", sourceId)).toBeNull();
});

test("removing a finalist asks first, says it in place, and can be undone", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s1");
  await page.getByRole("button", { name: "Remove from the shortlist" }).click();
  const confirm = page.getByRole("dialog", { name: "Remove Kebun Bunga Atelier from the shortlist?" });
  await expect(confirm).toContainText(
    "It leaves the shortlist, with its 2 packages. Kebun Bunga Atelier stays in Vendors, files and all. You can undo for a few seconds.",
  );
  await confirm.getByRole("button", { name: "Keep it" }).click();
  expect(await stored("shortlist", "s1")).not.toBeNull();

  await page.getByRole("button", { name: "Remove from the shortlist" }).click();
  await confirm.getByRole("button", { name: "Remove finalist" }).click();
  await expect(page.getByRole("heading", { name: "Kebun Bunga Atelier was removed from the shortlist" })).toBeVisible();
  await expect(page.getByRole("link", { name: "See the shortlist" })).toHaveAttribute("href", "/vendors/shortlist");
  expect(await stored("shortlist", "s1")).toBeNull();
  // What came from it stays.
  expect(await stored("vendors", "v1")).not.toBeNull();
  expect(await stored("weddingFiles", "f-vendor")).not.toBeNull();

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kebun Bunga Atelier");
  await expect(page.getByLabel("Contact person")).toHaveValue("Bu Ayu");
  // The screen shows the undo before the write reaches the server.
  await expect.poll(async () => (await stored("shortlist", "s1"))?.name).toBe("Kebun Bunga Atelier");
});

test("removing one with no vendor behind it says its own files stay, and a booking stays in the budget", async ({ browser }) => {
  await put("vendors", "v4", vendor("Booked Band", { contractStatus: "Chosen", booking: { on: "2026-09-01", from: "finalist", removed: false } }));
  await put("shortlist", "s4", finalist("Booked Band", { type: "Music/DJ", price: 5_000_000, priceDescription: "Evening", movedTo: { kind: "booking", id: "vendor-v4" } }));
  await put("weddingFiles", "f-band", file("Band-rider.pdf", { kind: "finalist", id: "s4" }));
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s4");
  await page.getByRole("button", { name: "Remove from the shortlist" }).click();
  await expect(page.getByRole("dialog", { name: "Remove Booked Band from the shortlist?" })).toContainText(
    "It leaves the shortlist, with its 1 package. Its file stays in Files › Shortlist › Booked Band. Its booking stays in the budget. You can undo for a few seconds.",
  );
});

test("when Bella removes the finalist Greg is looking at, Greg is told", async ({ browser }) => {
  const greg = await signInAs(browser, TEST_ACCOUNTS[0], "s3");
  const bella = await signInAs(browser, TEST_ACCOUNTS[1], "s3");
  await bella.getByRole("button", { name: "Remove from the shortlist" }).click();
  await bella.getByRole("dialog").getByRole("button", { name: "Remove finalist" }).click();
  await expect(bella.getByRole("heading", { name: "Bare Studio was removed from the shortlist" })).toBeVisible();

  await expect(greg.getByRole("heading", { name: "This finalist was removed" })).toBeVisible({ timeout: 15_000 });
  await expect(greg.getByText("Bella removed it on another device a moment ago.")).toBeVisible();
});

test("on a phone nothing runs off the side", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], "s1", { width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Kebun Bunga Atelier", level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
