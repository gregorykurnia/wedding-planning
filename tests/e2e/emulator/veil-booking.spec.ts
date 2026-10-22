import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.6: a booking's screen against the emulators. Funders and vendors are
// written as the emulator's owner (which skips the rules); the screen reads them
// live. Every document this file writes is removed at the end.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function toValue(value: Json): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (typeof value === "number") return { integerValue: String(value) };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toValue(v)])) } };
}

async function put(collection: string, id: string, fields: Record<string, Json>) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])) };
  const res = await fetch(`${DOCS}/${collection}/${id}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

async function remove(collection: string, id: string) {
  await fetch(`${DOCS}/${collection}/${id}`, { method: "DELETE", headers: ADMIN });
}

/** One stored field of a document, as the REST API gives it. */
async function read(collection: string, id: string, field: string): Promise<Record<string, unknown> | undefined> {
  const res = await fetch(`${DOCS}/${collection}/${id}`, { headers: ADMIN });
  const body = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  return body.fields?.[field];
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoOf(d);
};

const CK = "b6-ck";
const GREGORY = "b6-greg";

const base = (over: Record<string, Json>): Record<string, Json> => ({
  category: "Catering",
  contractStatus: "Chosen",
  funder: CK,
  totalPrice: 30_000_000,
  budgetSpent: 10_000_000,
  nextTargetDate: inDays(5),
  nextAction: "Pay the balance",
  subEntries: [],
  booking: { on: "2026-03-01", from: "vendor", removed: false },
  estimate: 32_000_000,
  ...over,
});

const part = (id: string, name: string, totalPrice: number, budgetSpent: number, due: string | null): Json => ({
  id,
  name,
  funder: CK,
  totalPrice,
  budgetSpent,
  nextTargetDate: due,
  nextAction: "",
  files: [],
});

const DOCS_TO_CLEAN = {
  single: "b6-single",
  split: "b6-split",
  conflict: "b6-conflict",
  parts: "b6-parts",
  over: "b6-over",
  gone: "b6-gone",
  late: "b6-late",
} as const;

test.beforeAll(async () => {
  await put("funders", CK, { name: "CK", order: 0 });
  await put("funders", GREGORY, { name: "Gregory", order: 1 });
  await put("vendors", DOCS_TO_CLEAN.single, base({ name: "Dapur Lestari Catering" }));
  await put("vendors", DOCS_TO_CLEAN.split, base({ name: "Bunga Melati Florist", category: "Flowers", totalPrice: 8_000_000, budgetSpent: 3_000_000, nextAction: "Choose the flowers" }));
  await put("vendors", DOCS_TO_CLEAN.conflict, base({ name: "Kebun Bunga Atelier", category: "Flowers", totalPrice: 8_000_000, budgetSpent: 3_000_000 }));
  await put(
    "vendors",
    DOCS_TO_CLEAN.parts,
    base({
      name: "Pelaminan Ayu",
      category: "Decoration",
      subEntries: [
        part("b6-p1", "Deposit", 10_000_000, 10_000_000, null),
        part("b6-p2", "Balance", 5_000_000, 0, inDays(9)),
      ],
    }),
  );
  await put("vendors", DOCS_TO_CLEAN.over, base({ name: "Kirana Florist", totalPrice: 10_000_000, budgetSpent: 12_000_000, nextTargetDate: null, estimate: null }));
  await put("vendors", DOCS_TO_CLEAN.gone, base({ name: "Harmoni String Quartet", category: "Music", subEntries: [] }));
  await put(
    "vendors",
    DOCS_TO_CLEAN.late,
    base({ name: "Rana Photography", category: "Photo", nextTargetDate: inDays(-4), booking: { on: null, from: "direct", removed: false } }),
  );
});

test.afterAll(async () => {
  for (const id of Object.values(DOCS_TO_CLEAN)) await remove("vendors", id);
  await remove("funders", CK);
  await remove("funders", GREGORY);
});

async function openBooking(page: Page, id: string, heading: string | RegExp) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto(`/new/budget/bookings/vendor-${id}`);
  await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("shows the figure, the thread, the next step and where it came from", async ({ page }) => {
  await openBooking(page, DOCS_TO_CLEAN.single, "Dapur Lestari Catering");
  await expect(page).toHaveTitle("Booking · Our wedding planner");
  await expect(page.getByText("Still to pay")).toBeVisible();
  await expect(page.getByText("of Rp 30.000.000, with Rp 10.000.000 paid")).toBeVisible();
  await expect(page.getByRole("img", { name: "33% paid, 67% to go" })).toBeVisible();
  const next = page.getByLabel("Next payment");
  await expect(next).toContainText("Next step");
  await expect(next).toContainText("Pay the balance");
  await expect(next).toContainText("Rp 20.000.000");
  await expect(next).toContainText("CK");
  await expect(page.getByText("Booked from Vendors on Sunday 1 March")).toBeVisible();
  await expect(page.getByRole("link", { name: "Bookings", exact: true })).toHaveAttribute("href", "/new/budget/bookings");
  await expect(page.getByText("Every change saves as you go")).toBeVisible();
});

test("a single booking's fields save as you go, and the figure follows", async ({ page }) => {
  await openBooking(page, DOCS_TO_CLEAN.single, "Dapur Lestari Catering");
  const price = page.getByLabel("Agreed price");
  await price.fill("35.000.000");
  await price.blur();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(price).toHaveValue("Rp 35.000.000");
  await expect(page.getByText("of Rp 35.000.000, with Rp 10.000.000 paid")).toBeVisible();
  expect(await read("vendors", DOCS_TO_CLEAN.single, "totalPrice")).toEqual({ integerValue: "35000000" });
  // The estimate sentence compares the agreed price with the estimate and never changes it.
  await expect(page.getByText(/You estimated\s+Rp 32\.000\.000 while comparing\. The agreed price is\s+Rp 3\.000\.000 higher\./)).toBeVisible();

  await page.getByLabel("Funder").selectOption({ label: "Gregory" });
  await expect.poll(() => read("vendors", DOCS_TO_CLEAN.single, "funder")).toEqual({ stringValue: GREGORY });

  await page.getByLabel("Next step").fill("Send the final menu");
  await page.getByLabel("Next step").blur();
  await expect.poll(() => read("vendors", DOCS_TO_CLEAN.single, "nextAction")).toEqual({ stringValue: "Send the final menu" });
  await expect(page.getByLabel("Next payment")).toContainText("Send the final menu");
});

test("a cleared name comes back, and words typed into an amount are refused", async ({ page }) => {
  await openBooking(page, DOCS_TO_CLEAN.single, "Dapur Lestari Catering");
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("");
  await name.blur();
  await expect(name).toHaveValue("Dapur Lestari Catering");

  const paid = page.getByLabel("Paid so far");
  await paid.fill("a lot");
  await paid.blur();
  await expect(paid).toHaveValue("Rp 10.000.000");
  await expect(page.getByRole("alert").filter({ hasText: "a lot" })).toBeVisible();
  expect(await read("vendors", DOCS_TO_CLEAN.single, "budgetSpent")).toEqual({ integerValue: "10000000" });
});

test("shows an overpaid booking in rose words, with no next card", async ({ page }) => {
  await openBooking(page, DOCS_TO_CLEAN.over, "Kirana Florist");
  await expect(page.getByText("Overpaid by")).toBeVisible();
  await expect(page.getByText("Rp 12.000.000 paid against a price of Rp 10.000.000. Check whether the price or a payment is wrong.")).toBeVisible();
  await expect(page.getByRole("img", { name: "100% paid, overpaid" })).toBeVisible();
  await expect(page.getByLabel("Next payment")).toHaveCount(0);
});

test("a late payment shows its flag on the next step, and a direct booking drops the day", async ({ page }) => {
  await openBooking(page, DOCS_TO_CLEAN.late, "Rana Photography");
  await expect(page.getByLabel("Next payment")).toContainText("4 days late");
  await expect(page.getByLabel("Next payment")).toContainText("was due");
  await expect(page.getByText("Added directly", { exact: true })).toBeVisible();
});

test("Undo of a split after a payment on the balance says what was recorded, and the parts stay (N13, P5-S3)", async ({ page }) => {
  await openBooking(page, DOCS_TO_CLEAN.conflict, "Kebun Bunga Atelier");
  await page.getByRole("button", { name: "Split into parts" }).click();
  await expect(page.getByText("Split into 2 parts")).toBeVisible();

  // Rp 1.000.000 recorded on the balance meanwhile, written straight to the store.
  type Stored = { arrayValue: { values: { mapValue: { fields: Record<string, { integerValue?: string; stringValue?: string }> } }[] } };
  let parts: Stored | undefined;
  await expect
    .poll(async () => {
      parts = (await read("vendors", DOCS_TO_CLEAN.conflict, "subEntries")) as Stored | undefined;
      return parts?.arrayValue.values?.length ?? 0;
    })
    .toBe(2);
  const balance = parts!.arrayValue.values[1].mapValue.fields;
  balance.budgetSpent = { integerValue: String(Number(balance.budgetSpent?.integerValue ?? 0) + 1_000_000) };
  const res = await fetch(`${DOCS}/vendors/${DOCS_TO_CLEAN.conflict}?updateMask.fieldPaths=subEntries`, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({ fields: { subEntries: parts } }),
  });
  expect(res.ok).toBe(true);
  await expect(page.locator("summary", { hasText: "Balance" })).toContainText("Rp 4.000.000");

  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByRole("status").getByText(/^Can’t undo the split: \S+ recorded Rp 1\.000\.000 on the balance since\. Both parts stay as they are now\.$/),
  ).toBeVisible();
  await expect(page.locator("summary", { hasText: "Deposit" })).toBeVisible();
});

test("splits into parts, opens the balance, and Undo puts it back as one", async ({ page }) => {
  await openBooking(page, DOCS_TO_CLEAN.split, "Bunga Melati Florist");
  await page.getByRole("button", { name: "Split into parts" }).click();
  await expect(page.getByText("Split into 2 parts")).toBeVisible();
  const deposit = page.locator("summary", { hasText: "Deposit" });
  const balance = page.locator("summary", { hasText: "Balance" });
  await expect(deposit).toContainText("paid in full");
  await expect(balance).toContainText("Rp 5.000.000");
  // The booking's own fields give way to its parts.
  await expect(page.getByLabel("Agreed price")).toHaveCount(0);
  await expect(page.getByText("from 2 parts")).toBeVisible();
  // The last part opens in place, and only it.
  await expect(page.locator("details[open]")).toHaveCount(1);
  await expect(page.locator("details[open]")).toContainText("Balance");
  await expect(page.locator("details[open]").getByLabel("Paid so far")).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: "Split into parts" })).toBeVisible();
  await expect(page.getByLabel("Agreed price")).toHaveValue("Rp 8.000.000");
});

test("a part has its own fields, and adding and removing a part can be undone", async ({ page }) => {
  await openBooking(page, DOCS_TO_CLEAN.parts, "Pelaminan Ayu");
  await expect(page.getByText("2 parts; totals, funders and dates come from them")).toBeVisible();
  await expect(page.getByText("Rp 15.000.000", { exact: false }).first()).toBeVisible();

  await page.getByRole("button", { name: "Add a part" }).click();
  const addon = page.locator("details", { hasText: "Add-on" });
  await expect(addon).toBeVisible();
  await expect(addon.getByLabel("Name")).toBeFocused();
  await addon.getByLabel("Price").fill("2.500.000");
  await addon.getByLabel("Price").blur();
  await expect(page.getByText("from 3 parts")).toBeVisible();
  await expect(page.getByText("Rp 17.500.000").first()).toBeVisible();

  await addon.getByRole("button", { name: "Remove this part" }).click();
  await page.getByRole("button", { name: "Remove part" }).click();
  await expect(addon).toHaveCount(0);
  await expect(page.getByText("Removed Add-on")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("details", { hasText: "Add-on" })).toBeVisible();
});

test("Record payment on the next step opens the sheet for that part", async ({ page }) => {
  await openBooking(page, DOCS_TO_CLEAN.parts, "Pelaminan Ayu");
  await page.getByLabel("Next payment").getByRole("button", { name: "Record payment" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Pelaminan Ayu, balance");
});

test("removes the booking in place, and Undo brings it back", async ({ page }) => {
  await openBooking(page, DOCS_TO_CLEAN.gone, "Harmoni String Quartet");
  await page.getByRole("button", { name: "Remove this booking" }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm).toContainText("Remove Harmoni String Quartet?");
  await expect(confirm).toContainText("It leaves the budget, with its Rp 10.000.000 of recorded payments. You can undo for a few seconds.");
  await confirm.getByRole("button", { name: "Remove booking" }).click();
  await expect(page.getByRole("heading", { name: "Harmoni String Quartet was removed", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "See all bookings" })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { name: "Harmoni String Quartet", level: 1 })).toBeVisible();
});

test("an old link says the booking isn't here", async ({ page }) => {
  await openBooking(page, "no-such-booking", "This booking isn’t here");
  await expect(page.getByRole("link", { name: "See all bookings" })).toHaveAttribute("href", "/new/budget/bookings");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("fits the width with its parts open", async ({ page }) => {
    await openBooking(page, DOCS_TO_CLEAN.parts, "Pelaminan Ayu");
    await page.locator("summary", { hasText: "Balance" }).click();
    await expect(page.locator("details[open]").getByLabel("Paid so far")).toBeVisible();
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
  });
});
