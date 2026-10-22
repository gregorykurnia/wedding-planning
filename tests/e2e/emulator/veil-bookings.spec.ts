import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, expectNoLeftoverBookings } from "../helpers";

// Task 4.5: the Bookings list against the emulators. Funders and vendors are written
// as the emulator's owner (which skips the rules); the screen reads them live. Every
// document this file writes is removed at the end, and the one a test changes is
// written back to what it was.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** The Firestore REST form of a plain value, with nested maps and arrays. */
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

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Five days from today: due soon, so it is "to pay" and never late. */
const DUE_SOON = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return isoOf(d);
})();

const CK = "bk-ck";
const GREGORY = "bk-greg";

type VendorFields = {
  name: string;
  category: string;
  funder: string | null;
  totalPrice: number;
  budgetSpent: number;
  nextTargetDate: string | null;
  nextAction?: string;
  subEntries?: Json[];
};

/** A vendor that counts as booked: Chosen, which is how records read before migration 1.11 gave them a booking field. */
const booked = (v: VendorFields): Record<string, Json> => ({
  name: v.name,
  category: v.category,
  contractStatus: "Chosen",
  funder: v.funder,
  totalPrice: v.totalPrice,
  budgetSpent: v.budgetSpent,
  nextTargetDate: v.nextTargetDate,
  nextAction: v.nextAction ?? "",
  subEntries: v.subEntries ?? [],
});

/** A part of Pelaminan Ayu, with its own funder and amounts. */
function stage(n: number, name: string, totalPrice: number, budgetSpent: number): Json {
  return { id: `bk-pel-${n}`, name, funder: CK, totalPrice, budgetSpent, nextTargetDate: null, nextAction: "" };
}

const DAPUR: VendorFields = {
  name: "Dapur Lestari Catering",
  category: "Catering",
  funder: CK,
  totalPrice: 30_000_000,
  budgetSpent: 10_000_000,
  nextTargetDate: DUE_SOON,
  nextAction: "Pay the balance",
};

// Four bookings: 30m + 5m + 2m + 15m is 52m committed. Pelaminan Ayu has six parts,
// the first paid in full, so four still owing show and "and 2 more parts" is counted.
const BASE: Record<string, Record<string, Json>> = {
  "bk-dapur": booked(DAPUR),
  "bk-bunga": booked({
    name: "Bunga Melati Florist",
    category: "Flowers",
    funder: GREGORY,
    totalPrice: 5_000_000,
    budgetSpent: 0,
    nextTargetDate: null,
  }),
  "bk-harmoni": booked({
    name: "Harmoni String Quartet",
    category: "Music",
    funder: null,
    totalPrice: 2_000_000,
    budgetSpent: 0,
    nextTargetDate: null,
  }),
  "bk-pelaminan": booked({
    name: "Pelaminan Ayu",
    category: "Decoration",
    funder: CK,
    totalPrice: 15_000_000,
    budgetSpent: 10_000_000,
    nextTargetDate: null,
    subEntries: [
      stage(0, "Deposit", 10_000_000, 10_000_000),
      stage(1, "Stage one", 1_000_000, 0),
      stage(2, "Stage two", 1_000_000, 0),
      stage(3, "Stage three", 1_000_000, 0),
      stage(4, "Stage four", 1_000_000, 0),
      stage(5, "Stage five", 1_000_000, 0),
    ],
  }),
};

test.beforeAll(async () => {
  await expectNoLeftoverBookings("bk-");
  await put("funders", CK, { name: "CK", order: 0 });
  await put("funders", GREGORY, { name: "Gregory", order: 1 });
  for (const [id, fields] of Object.entries(BASE)) await put("vendors", id, fields);
});

test.afterAll(async () => {
  for (const id of Object.keys(BASE)) await remove("vendors", id);
  await remove("funders", CK);
  await remove("funders", GREGORY);
});

async function openBookings(page: Page, path = "/new/budget/bookings") {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Bookings", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

const rows = (page: Page) => page.locator("[data-booking-id]");

test("lists every booking with the next due first, and says what's committed", async ({ page }) => {
  await openBookings(page);
  await expect(page).toHaveTitle("Bookings · Our wedding planner");
  await expect(page.getByText("4 bookings, Rp 52.000.000 committed")).toBeVisible();
  await expect(rows(page)).toHaveCount(4);
  await expect(rows(page).first()).toContainText("Dapur Lestari Catering");
  await expect(rows(page).last()).toContainText("Pelaminan Ayu");
});

test("gives each booking its status and meta, and collapses a long list of parts", async ({ page }) => {
  await openBookings(page);
  const dapur = page.locator('[data-booking-id="vendor-bk-dapur"]');
  await expect(dapur).toContainText("Rp 20.000.000 to pay");
  await expect(dapur).toContainText("Catering, paid by CK");

  await expect(page.locator('[data-booking-id="vendor-bk-harmoni"]')).toContainText("Music, no funder yet");

  const pelaminan = page.locator('[data-booking-id="vendor-bk-pelaminan"]');
  await expect(pelaminan).toContainText("Rp 5.000.000 to pay");
  await expect(pelaminan).toContainText("Stage four");
  await expect(pelaminan).not.toContainText("Stage five");
  await expect(pelaminan).toContainText("and 2 more parts");
});

test("each row links to its booking, Add booking floats, and the back link goes to the budget", async ({ page }) => {
  await openBookings(page);
  await expect(page.locator('[data-booking-id="vendor-bk-dapur"]')).toHaveAttribute(
    "href",
    "/new/budget/bookings/vendor-bk-dapur",
  );
  await expect(page.getByRole("link", { name: "Add booking" })).toHaveAttribute("href", "/new/budget/bookings/new");
  await expect(page.getByRole("link", { name: "Budget", exact: true })).toHaveAttribute("href", "/new/budget");
});

test("orders by the chosen order, and the direction word flips it", async ({ page }) => {
  await openBookings(page);
  const order = page.getByLabel("Order by");

  // Price starts biggest first.
  await order.selectOption({ label: "Price" });
  await expect(rows(page).first()).toContainText("Dapur Lestari Catering");
  await expect(rows(page).last()).toContainText("Harmoni String Quartet");

  await page.getByRole("button", { name: "Descending" }).click();
  await expect(rows(page).first()).toContainText("Harmoni String Quartet");

  // Name starts A to Z.
  await order.selectOption({ label: "Name" });
  await expect(rows(page).first()).toContainText("Bunga Melati Florist");
  await expect(rows(page).last()).toContainText("Pelaminan Ayu");
});

test("searches the bookings, keeps focus in the search, and says when nothing matches", async ({ page }) => {
  await openBookings(page);
  const search = page.getByRole("searchbox", { name: "Search bookings" });

  await search.fill("harmoni");
  await expect(search).toBeFocused();
  await expect(page.getByText("1 booking matches")).toBeVisible();
  await expect(rows(page)).toHaveCount(1);

  // A part's name counts, as the booking it belongs to shows.
  await search.fill("stage three");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Pelaminan Ayu");

  await search.fill("fireworks");
  await expect(page.getByRole("heading", { name: "No bookings match “fireworks”", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Clear the search" }).click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(rows(page)).toHaveCount(4);
});

test("opens with the search Who pays sends for Not assigned, and clears the address", async ({ page }) => {
  await openBookings(page, "/new/budget/bookings?q=Not%20assigned");
  await expect(page.getByRole("searchbox", { name: "Search bookings" })).toHaveValue("Not assigned");
  await expect(page.getByText("1 booking matches")).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Harmoni String Quartet");
  await expect(page).toHaveURL("/new/budget/bookings");
});

test("a booking paid in full elsewhere lands in the list without a reload", async ({ page }) => {
  await openBookings(page);
  const dapur = page.locator('[data-booking-id="vendor-bk-dapur"]');
  await expect(dapur).toContainText("Rp 20.000.000 to pay");
  await put("vendors", "bk-dapur", booked({ ...DAPUR, budgetSpent: 30_000_000 }));
  try {
    await expect(dapur).toContainText("Paid in full");
  } finally {
    await put("vendors", "bk-dapur", BASE["bk-dapur"]);
  }
});

test.describe("a long list", () => {
  const MANY = Array.from({ length: 101 }, (_, i) => `bk-many-${String(i).padStart(3, "0")}`);

  test.beforeAll(async () => {
    await Promise.all(
      MANY.map((id, i) =>
        put(
          "vendors",
          id,
          booked({
            name: `Caterer ${String(i).padStart(3, "0")}`,
            category: "Catering",
            funder: null,
            totalPrice: 1_000_000,
            budgetSpent: 0,
            nextTargetDate: null,
          }),
        ),
      ),
    );
  });

  test.afterAll(async () => {
    await Promise.all(MANY.map((id) => remove("vendors", id)));
  });

  test("shows 100 at a time, with the count and Show more for the rest", async ({ page }) => {
    await openBookings(page);
    await expect(rows(page)).toHaveCount(100);
    await expect(page.getByText("Showing 100 of 105")).toBeVisible();

    await page.getByRole("button", { name: "Show 5 more" }).click();
    await expect(rows(page)).toHaveCount(105);
    await expect(page.getByText(/^Showing \d/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Show \d+ more$/ })).toHaveCount(0);
  });
});
