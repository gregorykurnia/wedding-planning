import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.3: the budget against the emulators. Funders, bookings, a what-if item
// and the wedding date are written as the emulator's owner (which skips the
// rules); the screen reads them live. The payment recorded in the last test goes
// through the real sheet and the real write. Dates are worked out from today, so
// the test holds on any day.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const SETTINGS = `${DOCS}/settings/wedding`;
const WEDDING = "2027-03-20";
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
const TODAY = isoOf(new Date());
const DAYS_TO_WEDDING = Math.round((Date.parse(`${WEDDING}T00:00:00Z`) - Date.parse(`${TODAY}T00:00:00Z`)) / 86_400_000);
const DUE_SOON = plusDays(5);
// The month the due payment falls in, as the screen writes it: with the year only when it isn't this year.
const dueMonth = (() => {
  const [y, m] = DUE_SOON.split("-").map(Number);
  return `${MONTHS[m - 1]}${y !== Number(TODAY.slice(0, 4)) ? ` ${y}` : ""}`;
})();

type Fields = Record<string, string | number | null>;

const typed = (value: string | number | null) =>
  value === null ? { nullValue: null } : typeof value === "number" ? { integerValue: String(value) } : { stringValue: value };

async function put(collection: string, id: string, fields: Fields) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typed(v)])) };
  const res = await fetch(`${DOCS}/${collection}/${id}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

async function remove(collection: string, id: string) {
  await fetch(`${DOCS}/${collection}/${id}`, { method: "DELETE", headers: ADMIN });
}

/** A booked vendor, as the screen reads it: Chosen, so it counts as booked. */
const booked = (name: string, funder: string, totalPrice: number, budgetSpent: number, nextTargetDate: string | null): Fields => ({
  name,
  category: "Catering",
  contractStatus: "Chosen",
  funder,
  totalPrice,
  budgetSpent,
  nextTargetDate,
});

/** The wedding date is the only field of settings this test changes; it's put back afterwards. */
async function readWeddingDate(): Promise<string | null> {
  const res = await fetch(SETTINGS, { headers: ADMIN });
  if (!res.ok) return null;
  const body = (await res.json()) as { fields?: { weddingDate?: { stringValue?: string } } };
  return body.fields?.weddingDate?.stringValue ?? null;
}

async function setWeddingDate(value: string | null) {
  const res = await fetch(`${SETTINGS}?updateMask.fieldPaths=weddingDate`, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({ fields: { weddingDate: typed(value) } }),
  });
  expect(res.ok).toBe(true);
}

let previousWeddingDate: string | null = null;

test.beforeAll(async () => {
  previousWeddingDate = await readWeddingDate();
  await setWeddingDate(WEDDING);
  await put("funders", "bd-ck", { name: "CK", order: 0 });
  await put("funders", "bd-greg", { name: "Gregory", order: 1 });
  // 30.000.000 committed and 10.000.000 paid, with a payment due in five days; and 5.000.000 committed with nothing paid.
  await put("vendors", "bd-catering", booked("Dapur Lestari Catering", "bd-ck", 30_000_000, 10_000_000, DUE_SOON));
  await put("vendors", "bd-flowers", booked("Bunga Melati Florist", "bd-greg", 5_000_000, 0, null));
  // A what-if item of 5.000.000 (no subentries).
  await fetch(`${DOCS}/hypotheticalItems/bd-idea`, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({
      fields: {
        name: { stringValue: "Live band" },
        type: { stringValue: "Music" },
        totalPrice: { integerValue: "5000000" },
        subEntries: { arrayValue: {} },
      },
    }),
  });
});

test.afterAll(async () => {
  await setWeddingDate(previousWeddingDate);
  await remove("funders", "bd-ck");
  await remove("funders", "bd-greg");
  await remove("vendors", "bd-catering");
  await remove("vendors", "bd-flowers");
  await remove("hypotheticalItems", "bd-idea");
});

async function openBudget(page: Page, account: (typeof TEST_ACCOUNTS)[number] = TEST_ACCOUNTS[0]) {
  const { email, password } = account;
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/budget");
  await expect(page.getByRole("heading", { name: "Budget", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("shows what is still to pay, the next payment, the doors and the closing line", async ({ page }) => {
  await openBudget(page);
  await expect(page).toHaveTitle("Budget · Our wedding planner");

  await expect(page.getByText("Still to pay", { exact: true })).toBeVisible();
  await expect(page.locator(".num").filter({ hasText: "25.000.000" })).toBeVisible();
  await expect(page.getByText("of Rp 35.000.000 committed, with Rp 10.000.000 already paid")).toBeVisible();
  await expect(page.getByRole("img", { name: "29% paid, 71% to go" })).toBeVisible();

  const next = page.getByRole("region", { name: "Next payment" });
  await expect(next.getByText("Next to pay", { exact: true })).toBeVisible();
  await expect(next.getByRole("link", { name: "Dapur Lestari Catering" })).toHaveAttribute(
    "href",
    "/new/budget/bookings/vendor-bd-catering",
  );
  await expect(next.getByText("due in 5 days")).toBeVisible();
  await expect(next.getByText("Rp 20.000.000")).toBeVisible();
  await expect(next.getByText(/paid by CK/)).toBeVisible();
  await expect(next.getByRole("button", { name: "Record payment" })).toBeVisible();

  await expect(page.getByRole("link").filter({ hasText: /^Bookings/ })).toContainText("2 bookings");
  await expect(page.getByRole("link").filter({ hasText: /^Payments due/ })).toContainText(`1 payment until ${dueMonth}`);
  await expect(page.getByRole("link").filter({ hasText: /^Who pays/ })).toContainText("CK and Gregory");
  await expect(page.getByRole("link").filter({ hasText: /^What-if items/ })).toContainText(
    "Would bring the total to Rp 40.000.000",
  );

  await expect(page.getByText(`${DAYS_TO_WEDDING} days until Saturday 20 March 2027`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Add booking" })).toHaveAttribute("href", "/new/budget/bookings/new");
});

test("paid more than committed says overpaid, with the amount over and the overpaid thread", async ({ page }) => {
  await put("vendors", "bd-photo", booked("Lumina Photography", "bd-greg", 12_000_000, 40_000_000, null));
  try {
    await openBudget(page);
    await expect(page.getByText("Overpaid by", { exact: true })).toBeVisible();
    await expect(page.locator(".num").filter({ hasText: "3.000.000" })).toBeVisible();
    await expect(
      page.getByText("Rp 50.000.000 paid against Rp 47.000.000 committed. Check the overpaid bookings."),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: "100% paid, overpaid" })).toBeVisible();
    await expect(page.getByRole("link").filter({ hasText: /^Bookings/ })).toContainText("3 bookings, 1 overpaid");
  } finally {
    await remove("vendors", "bd-photo");
  }
});

test("Record payment opens the sheet, and the payment it records moves the figure", async ({ page }) => {
  await openBudget(page);
  const next = page.getByRole("region", { name: "Next payment" });
  await next.getByRole("button", { name: "Record payment" }).click();

  const dialog = page.getByRole("dialog", { name: "Record a payment" });
  await expect(dialog.getByLabel("Amount paid")).toHaveValue("Rp 20.000.000");
  await dialog.getByLabel("Amount paid").fill("5000000");
  await dialog.getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });

  await expect(
    page.getByRole("status").filter({ hasText: "Recorded Rp 5.000.000 for Dapur Lestari Catering" }),
  ).toBeVisible();
  await expect(page.getByText("of Rp 35.000.000 committed, with Rp 15.000.000 already paid")).toBeVisible();
  await expect(page.locator(".num").filter({ hasText: "20.000.000" })).toBeVisible();
});

/** The partner's names and email: the only settings the partner test changes, put back afterwards. */
const PARTNER_FIELDS = ["yourName", "partnerName", "partnerEmail"];

async function readSettingStrings(fields: string[]): Promise<Record<string, string | null>> {
  const res = await fetch(SETTINGS, { headers: ADMIN });
  const body = (await res.json()) as { fields?: Record<string, { stringValue?: string }> };
  return Object.fromEntries(fields.map((field) => [field, body.fields?.[field]?.stringValue ?? null]));
}

async function setSettingStrings(values: Record<string, string | null>) {
  const mask = Object.keys(values).map((field) => `updateMask.fieldPaths=${field}`).join("&");
  const res = await fetch(`${SETTINGS}?${mask}`, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typed(v)])) }),
  });
  expect(res.ok).toBe(true);
}

// Task 5.2: the partner's change flashes the next payment card (guide §5.4, §6.3). Runs last, after the payment above.
test.describe("with Bella signed in too", () => {
  let previous: Record<string, string | null> = {};

  test.beforeAll(async () => {
    previous = await readSettingStrings(PARTNER_FIELDS);
    await setSettingStrings({ yourName: "Greg", partnerName: "Bella", partnerEmail: TEST_ACCOUNTS[1].email });
  });

  test.afterAll(async () => {
    await setSettingStrings(previous);
  });

  test("a payment Bella records flashes Greg's next payment card, with her toast", async ({ browser }) => {
    const greg = await (await browser.newContext()).newPage();
    const bella = await (await browser.newContext()).newPage();
    await openBudget(greg);
    await openBudget(bella, TEST_ACCOUNTS[1]);
    const gregNext = greg.getByRole("region", { name: "Next payment" });
    await expect(gregNext).not.toHaveClass(/\bflash\b/);

    // A part of the same booking stays next, so the flash lands on the card Greg is looking at.
    await bella.getByRole("region", { name: "Next payment" }).getByRole("button", { name: "Record payment" }).click();
    const dialog = bella.getByRole("dialog", { name: "Record a payment" });
    await dialog.getByLabel("Amount paid").fill("5000000");
    await dialog.getByRole("button", { name: "Record payment", exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 15_000 });

    await expect(
      greg.getByRole("status").filter({ hasText: "Bella recorded Rp 5.000.000 for Dapur Lestari Catering" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(gregNext).toHaveClass(/\bflash\b/);
  });
});
