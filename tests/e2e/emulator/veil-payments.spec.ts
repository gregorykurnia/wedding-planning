import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.8: Payments due against the emulators. Funders and vendors are written as
// the emulator's owner (which skips the rules); the screen reads them live. Every
// document this file writes is removed at the end. Dates are worked out from today,
// since late and soon are never stored.

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

const pad = (n: number) => String(n).padStart(2, "0");
const daysFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const CK = "pd-ck";

const vendor = (name: string, totalPrice: number, budgetSpent: number, nextTargetDate: string | null, extra: Record<string, Json> = {}): Record<string, Json> => ({
  name,
  category: "Catering",
  contractStatus: "Chosen",
  funder: CK,
  totalPrice,
  budgetSpent,
  nextTargetDate,
  nextAction: "",
  subEntries: [],
  ...extra,
});

// Late: 4m. Soon: 20m. Later: 3m, sixty days on. Paid up and undated ones never show.
const VENDORS: Record<string, Record<string, Json>> = {
  "pd-late": vendor("Dapur Lestari Catering", 10_000_000, 6_000_000, daysFromToday(-3), { nextAction: "Pay the balance" }),
  "pd-soon": vendor("Bunga Melati Florist", 20_000_000, 0, daysFromToday(5)),
  "pd-later": vendor("Harmoni String Quartet", 3_000_000, 0, daysFromToday(60)),
  "pd-paid": vendor("Paid Up Photography", 1_000_000, 1_000_000, daysFromToday(-10)),
  "pd-undated": vendor("No Date Decoration", 2_000_000, 0, null),
};

test.beforeAll(async () => {
  await put("funders", CK, { name: "CK", order: 0 });
  for (const [id, fields] of Object.entries(VENDORS)) await put("vendors", id, fields);
});

test.afterAll(async () => {
  for (const id of Object.keys(VENDORS)) await remove("vendors", id);
  await remove("funders", CK);
});

async function openPayments(page: Page) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/budget/payments");
  await expect(page.getByRole("heading", { name: "Payments due", level: 1 })).toBeAttached({ timeout: COMPILE_TIMEOUT });
}

const rows = (page: Page) => page.locator("[data-booking-id]");

test("shows what's late in the hero, and lists late, then soon, then the later month", async ({ page }) => {
  await openPayments(page);
  await expect(page).toHaveTitle("Payments due · Our wedding planner");
  await expect(page.getByText("Late, across 1 payment")).toBeVisible();
  await expect(page.getByText("and Rp 20.000.000 more due in the next 14 days. In all, Rp 27.000.000 across 3 payments.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Late/, level: 2 })).toContainText("Rp 4.000.000");
  await expect(page.getByRole("heading", { name: /^In the next 14 days/, level: 2 })).toContainText("Rp 20.000.000");
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).nth(0)).toContainText("Dapur Lestari Catering");
  await expect(rows(page).nth(1)).toContainText("Bunga Melati Florist");
  await expect(rows(page).nth(2)).toContainText("Harmoni String Quartet");
});

test("leaves out what's paid up and what has no date", async ({ page }) => {
  await openPayments(page);
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByText("Paid Up Photography")).toHaveCount(0);
  await expect(page.getByText("No Date Decoration")).toHaveCount(0);
});

test("each row says when and who, and links to its booking", async ({ page }) => {
  await openPayments(page);
  const late = page.locator('[data-booking-id="vendor-pd-late"]');
  await expect(late).toContainText("3 days late");
  await expect(late).toContainText("paid by CK");
  await expect(late).toContainText("Pay the balance");
  await expect(late.getByRole("link", { name: "Dapur Lestari Catering" })).toHaveAttribute(
    "href",
    "/budget/bookings/vendor-pd-late",
  );
  await expect(page.locator('[data-booking-id="vendor-pd-soon"]')).toContainText("due in 5 days");
  await expect(page.getByRole("link", { name: "Budget", exact: true })).toHaveAttribute("href", "/budget");
});

test("Record payment opens the sheet for that booking", async ({ page }) => {
  await openPayments(page);
  await page.locator('[data-booking-id="vendor-pd-late"]').getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog", { name: "Record a payment" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Amount paid")).toHaveValue("Rp 4.000.000");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the list fits the width, with no sideways scroll", async ({ page }) => {
    await openPayments(page);
    await expect(rows(page)).toHaveCount(3);
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
  });
});
