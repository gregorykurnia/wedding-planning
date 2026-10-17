import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.2: the overview against the emulators. Everything is written as the
// emulator's owner (which skips the rules), with dates counted from today so
// the days figure and the agenda are the same whenever this runs.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Value = string | number | boolean | string[] | Date | null;
type Fields = Record<string, Value>;

const typed = (value: Value): Record<string, unknown> =>
  value === null
    ? { nullValue: null }
    : Array.isArray(value)
      ? { arrayValue: { values: value.map((v) => ({ stringValue: v })) } }
      : value instanceof Date
        ? { timestampValue: value.toISOString() }
        : typeof value === "boolean"
        ? { booleanValue: value }
        : typeof value === "number"
          ? { integerValue: String(value) }
          : { stringValue: value };

// The old screens' collections are read in creation order, which leaves out a document with no `createdAt`.
const CREATED = new Date("2026-01-01T00:00:00Z");

async function put(collection: string, id: string, fields: Fields) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typed(v)])) };
  const res = await fetch(`${DOCS}/${collection}/${id}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

async function del(collection: string, id: string) {
  await fetch(`${DOCS}/${collection}/${id}`, { method: "DELETE", headers: ADMIN });
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** A date `n` days from today, in this machine's calendar, as `YYYY-MM-DD`. */
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

const settings = (extra: Fields) => put("settings", "wedding", { yourName: "Greg", partnerName: "Bella", ...extra });

const IDS = {
  events: ["ov-cake"],
  todos: ["ov-task-done", "ov-task-open"],
  guests: ["ov-guest-yes", "ov-guest-pending"],
  items: ["ov-item-1", "ov-item-2"],
  vendors: ["ov-catering"],
};

test.beforeAll(async () => {
  await put("scheduleEvents", "ov-cake", {
    title: "Cake tasting",
    type: "appointment",
    startAt: `${inDays(1)}T10:00`,
    allDay: false,
    status: "scheduled",
    notes: "",
    location: "",
  });
  await put("todos", "ov-task-done", { title: "Book the venue", notes: "", dueDate: null, done: true, createdAt: CREATED });
  await put("todos", "ov-task-open", { title: "Choose the rings", notes: "", dueDate: inDays(3), done: false, createdAt: CREATED });
  await put("guests", "ov-guest-yes", { name: "Tante Lily", rsvpStatus: "yes", eventType: "Both", plusOnes: 1, inviteSent: true, createdAt: CREATED });
  await put("guests", "ov-guest-pending", { name: "Om Budi", rsvpStatus: "pending", eventType: "Both", plusOnes: 0, inviteSent: true, createdAt: CREATED });
  await put("masterListItems", "ov-item-1", { item: "Wedding cake", vendor: "Kirana", confirmed: true, types: [], persons: [], next: false, sortOrder: 1 });
  await put("masterListItems", "ov-item-2", { item: "Flowers", vendor: "", confirmed: false, types: [], persons: [], next: false, sortOrder: 2 });
  await put("vendors", "ov-catering", {
    name: "Dapur Lestari Catering",
    category: "Catering",
    contractStatus: "Chosen",
    funder: null,
    totalPrice: 30_000_000,
    budgetSpent: 10_000_000,
    nextTargetDate: inDays(5),
  });
});

test.afterAll(async () => {
  for (const [collection, ids] of Object.entries({
    scheduleEvents: IDS.events,
    todos: IDS.todos,
    guests: IDS.guests,
    masterListItems: IDS.items,
    vendors: IDS.vendors,
  })) {
    for (const id of ids) await del(collection, id);
  }
  await put("settings", "wedding", { yourName: "", partnerName: "", weddingDate: null, startedOn: null });
});

async function openOverview(page: Page) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
}

const door = (page: Page, name: string) => page.locator("main").getByRole("link", { name: new RegExp(`^${name}`) });

test("shows the names, the days to go and the time gone, then the next dated things and the doors", async ({ page }) => {
  await settings({ weddingDate: inDays(157), startedOn: inDays(-73) });
  await openOverview(page);

  await expect(page.locator("main").getByText("Greg & Bella", { exact: true })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.locator("main").getByText("157", { exact: true })).toBeVisible();
  await expect(page.getByText(/^days until \w+ \d+ \w+/)).toBeVisible();
  // 73 of 230 days have passed.
  await expect(page.getByRole("img", { name: "32% of the preparation time has passed" })).toBeVisible();
  await expect(page.getByText("32% of the time gone")).toBeVisible();

  // Coming up: the event tomorrow, the task in 3 days and the payment in 5, soonest first.
  await expect(page.getByRole("heading", { name: "Coming up", level: 2 })).toBeVisible();
  const rows = page.locator("main li[data-agenda-key]");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Cake tasting");
  await expect(rows.nth(1)).toContainText("Choose the rings");
  await expect(rows.nth(2)).toContainText("Dapur Lestari Catering");
  await expect(page.getByRole("link", { name: "See the whole schedule" })).toHaveAttribute("href", "/new/schedule");

  await expect(door(page, "Budget")).toContainText("Rp 10.000.000 paid of Rp 30.000.000");
  await expect(door(page, "Tasks")).toContainText("1 of 2 tasks done");
  await expect(door(page, "Guests")).toContainText("2 attending of 2 guests invited");
  await expect(door(page, "Wedding items")).toContainText("1 of 2 confirmed");
});

test("an event's title opens the schedule on that event", async ({ page }) => {
  await settings({ weddingDate: inDays(157), startedOn: inDays(-73) });
  await openOverview(page);
  await page.getByRole("button", { name: "Cake tasting" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/new/schedule?event=ov-cake");
});

test("the day before says tomorrow; the wedding day says Today; after it the count ends", async ({ page }) => {
  await settings({ weddingDate: inDays(1), startedOn: inDays(-73) });
  await openOverview(page);
  await expect(page.locator("main").getByText("1", { exact: true })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText(/^day to go: tomorrow, /)).toBeVisible();

  await settings({ weddingDate: inDays(0) });
  await expect(page.getByText("The wedding day", { exact: true })).toBeVisible();
  await expect(page.locator("main").getByText("Today", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Everything for today is below\.$/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today and next", level: 2 })).toBeVisible();
  await expect(page.getByRole("img", { name: "All of the preparation time has passed" })).toBeVisible();
  await expect(page.getByText("The day is here")).toBeVisible();

  await settings({ weddingDate: inDays(-9) });
  await expect(page.getByText("Married", { exact: true })).toBeVisible();
  await expect(page.locator("main").getByRole("img")).toHaveCount(0);
  await expect(page.getByText(/days until|day to go/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Coming up", level: 2 })).toBeVisible();
});

test("a start date is not needed: without one the thread is left out", async ({ page }) => {
  await settings({ weddingDate: inDays(100), startedOn: null });
  await openOverview(page);
  await expect(page.locator("main").getByText("100", { exact: true })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.locator("main").getByRole("img")).toHaveCount(0);
});

test("a change from the partner arrives in place", async ({ page }) => {
  await settings({ weddingDate: inDays(157), startedOn: inDays(-73) });
  await openOverview(page);
  await expect(page.locator("main").getByText("157", { exact: true })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await settings({ weddingDate: inDays(150), startedOn: inDays(-73) });
  await expect(page.locator("main").getByText("150", { exact: true })).toBeVisible();
});

test("no wedding date: the date form saves it, keeps the names, and the countdown appears", async ({ page }) => {
  await settings({ weddingDate: null, startedOn: inDays(-73) });
  await openOverview(page);

  await expect(page.getByRole("heading", { name: "When is the wedding?", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.locator("main").getByText("Greg & Bella", { exact: true })).toBeVisible();

  // Saving with nothing chosen goes to the field.
  await page.getByRole("button", { name: "Save the date" }).click();
  await expect(page.getByLabel("Wedding date")).toBeFocused();

  await page.getByLabel("Wedding date").fill(inDays(200));
  await page.getByRole("button", { name: "Save the date" }).click();
  await expect(page.getByText(/^Wedding date set to /)).toBeVisible();
  await expect(page.locator("main").getByText("200", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "When is the wedding?" })).toHaveCount(0);

  // The names and the start day are still stored.
  const stored = await (await fetch(`${DOCS}/settings/wedding`, { headers: ADMIN })).json();
  expect(stored.fields.weddingDate.stringValue).toBe(inDays(200));
  expect(stored.fields.yourName.stringValue).toBe("Greg");
  expect(stored.fields.startedOn.stringValue).toBe(inDays(-73));
});

test("the install card shows on a phone, goes with Not now, and stays gone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await settings({ weddingDate: inDays(157), startedOn: inDays(-73) });
  await openOverview(page);

  await expect(page.getByText("Add the planner to your home screen to open it like an app.")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("link", { name: "Show me how" })).toHaveAttribute("href", "/new/settings#install");
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByText("Add the planner to your home screen")).toHaveCount(0);

  await page.reload();
  await expect(page.locator("main").getByText("157", { exact: true })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("Add the planner to your home screen")).toHaveCount(0);
});

test("a computer gets no install card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await settings({ weddingDate: inDays(157), startedOn: inDays(-73) });
  await openOverview(page);
  await expect(page.locator("main").getByText("157", { exact: true })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("Add the planner to your home screen")).toHaveCount(0);
});
