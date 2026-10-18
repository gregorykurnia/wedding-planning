import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.25: Wedding settings against the emulators. The names and the date
// save as you go, the two accounts are listed with Swap them and Undo, Sign out
// leaves, and the doors lead on. Documents are written as the emulator's owner
// (which skips the rules); everything else goes through the screen.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Doc = { fields?: Record<string, unknown> };
type Fields = Record<string, string | number | boolean | string[] | number[] | null>;

const typed = (value: Fields[string]): unknown =>
  value === null
    ? { nullValue: null }
    : Array.isArray(value)
      ? { arrayValue: { values: (value as (string | number)[]).map((v) => typed(v)) } }
      : typeof value === "number"
        ? { integerValue: String(value) }
        : typeof value === "boolean"
          ? { booleanValue: value }
          : { stringValue: value };

async function read(path: string): Promise<Doc | null> {
  const res = await fetch(`${DOCS}/${path}`, { headers: ADMIN });
  return res.ok ? ((await res.json()) as Doc) : null;
}

async function write(path: string, doc: Doc | null) {
  const res = doc
    ? await fetch(`${DOCS}/${path}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(doc) })
    : await fetch(`${DOCS}/${path}`, { method: "DELETE", headers: ADMIN });
  expect(res.ok).toBe(true);
}

const put = (path: string, fields: Fields) =>
  write(path, { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typed(v)])) });

const text = (doc: Doc | null, field: string) => (doc?.fields?.[field] as { stringValue?: string } | undefined)?.stringValue;

/** The stored pairing as { uid: place }. */
async function slots(): Promise<Record<string, string>> {
  const doc = await read("settings/accounts");
  const map = (doc?.fields?.slots as { mapValue?: { fields?: Record<string, { stringValue: string }> } } | undefined)
    ?.mapValue?.fields;
  return Object.fromEntries(Object.entries(map ?? {}).map(([uid, v]) => [uid, v.stringValue]));
}

let seededAccounts: Doc | null = null;
let seededWedding: Doc | null = null;

test.beforeAll(async () => {
  seededAccounts = await read("settings/accounts");
  seededWedding = await read("settings/wedding");
});

test.beforeEach(async () => {
  await put("settings/wedding", {
    yourName: "Greg",
    partnerName: "Bella",
    partnerEmail: TEST_ACCOUNTS[1].email,
    weddingDate: "2027-06-12",
  });
});

test.afterAll(async () => {
  await write("settings/accounts", seededAccounts);
  await write("settings/wedding", seededWedding);
  await write("scheduleEvents/set-old-reminder", null);
});

async function signInAs(page: Page, account: (typeof TEST_ACCOUNTS)[number]) {
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
}

async function openSettings(page: Page) {
  await signInAs(page, TEST_ACCOUNTS[0]);
  await page.goto("/new/settings");
  await expect(page.getByRole("heading", { name: "Wedding settings", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByLabel("First name")).toHaveValue("Greg");
}

const saveLine = (page: Page) => page.getByRole("status").filter({ hasText: /Every change saves|Saving|Saved|not saved/ });

test("shows the saved names and date, and saves a change as you go", async ({ page }) => {
  await openSettings(page);
  await expect(page.getByLabel("Second name")).toHaveValue("Bella");
  await expect(page.getByLabel("Wedding date")).toHaveValue("2027-06-12");
  await expect(page.getByText("Used wherever the planner addresses you, like Greg & Bella at the top.")).toBeVisible();
  await expect(saveLine(page)).toHaveText("Every change saves as you go");

  const second = page.getByLabel("Second name");
  await second.fill("Isabella");
  await second.blur();
  await expect(saveLine(page)).toHaveText("Saved", { timeout: COMPILE_TIMEOUT });
  expect(text(await read("settings/wedding"), "partnerName")).toBe("Isabella");
  // Only that field was written: the other name and the date are as they were.
  expect(text(await read("settings/wedding"), "yourName")).toBe("Greg");
  expect(text(await read("settings/wedding"), "weddingDate")).toBe("2027-06-12");
  await expect(page.getByRole("link", { name: "Greg & Isabella" })).toBeVisible();

  const date = page.getByLabel("Wedding date");
  await date.fill("2027-07-03");
  await date.blur();
  await expect(async () => expect(text(await read("settings/wedding"), "weddingDate")).toBe("2027-07-03")).toPass();
});

test("a cleared name comes back as it was, and nothing is saved", async ({ page }) => {
  await openSettings(page);
  const first = page.getByLabel("First name");
  await first.fill("");
  await first.blur();
  await expect(first).toHaveValue("Greg");
  await expect(saveLine(page)).toHaveText("Every change saves as you go");
  expect(text(await read("settings/wedding"), "yourName")).toBe("Greg");
});

test("lists the two accounts, and Swap them trades them with Undo", async ({ browser, page }) => {
  // Bella signs in on another browser, so both accounts are recorded.
  const other = await (await browser.newContext()).newPage();
  await signInAs(other, TEST_ACCOUNTS[1]);
  await expect(other.getByRole("button", { name: "Menu" })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await openSettings(page);
  const rows = page.locator("main ul").first().locator("li");
  await expect(rows.nth(0)).toContainText("Greg, you");
  await expect(rows.nth(0)).toContainText(`${TEST_ACCOUNTS[0].email}, signed in with a password`);
  await expect(rows.nth(1)).toContainText("Bella");
  await expect(rows.nth(1)).toContainText(TEST_ACCOUNTS[1].email);
  await expect(page.getByText("Only these two accounts can see or change anything.")).toBeVisible();

  const before = await slots();
  await page.getByRole("button", { name: "Swap them" }).click();
  const toast = page.getByRole("status").filter({ hasText: "Swapped: this account is now Bella" });
  await expect(toast).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(rows.nth(0)).toContainText("Bella, you");
  await expect(rows.nth(1)).toContainText("Greg");
  const after = await slots();
  expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
  for (const uid of Object.keys(before)) expect(after[uid]).not.toBe(before[uid]);

  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(rows.nth(0)).toContainText("Greg, you");
  expect(await slots()).toEqual(before);
});

test("Sign out of this computer leaves, and says so on the sign-in screen", async ({ page }) => {
  await openSettings(page);
  await page.getByRole("button", { name: "Sign out of this computer" }).click();
  // The gate keeps where we were, so signing in again comes back to settings.
  await expect(page).toHaveURL("/new/sign-in?next=%2Fnew%2Fsettings", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("You’ve signed out. Nothing is shown on this device")).toBeVisible();
});

test("a reminder set for a time of day is counted, with a way to choose again", async ({ page }) => {
  const tomorrow = new Date(Date.now() + 2 * 86_400_000);
  const day = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await put("scheduleEvents/set-old-reminder", {
    title: "Call with the organiser",
    type: "organiser_call",
    startAt: `${day}T15:00`,
    endAt: null,
    allDay: false,
    status: "scheduled",
    notes: "",
    location: "",
    relatedVendorId: null,
    relatedVenueId: null,
    reminderMinutes: [60],
  });
  await openSettings(page);
  const line = page.locator("p", { hasText: "1 appointment or call has a reminder you set before for a time of day, which can’t arrive." });
  await expect(line).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(line.getByRole("link", { name: "Choose again in the schedule" })).toHaveAttribute("href", "/new/schedule");

  // Once it is chosen again (no reminder), the line goes.
  await put("scheduleEvents/set-old-reminder", {
    title: "Call with the organiser",
    type: "organiser_call",
    startAt: `${day}T15:00`,
    endAt: null,
    allDay: false,
    status: "scheduled",
    notes: "",
    location: "",
    relatedVendorId: null,
    relatedVenueId: null,
    reminderMinutes: [1440],
  });
  await expect(line).toHaveCount(0);
});

test("the doors lead to Who pays and open the vendor categories", async ({ page }) => {
  await openSettings(page);
  await expect(page.getByRole("link", { name: /Who pays/ })).toHaveAttribute("href", "/new/budget/who-pays");

  await page.getByRole("link", { name: /Vendor categories/ }).click();
  await expect(page.getByRole("dialog", { name: "Vendor categories" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/new/vendors");
});
