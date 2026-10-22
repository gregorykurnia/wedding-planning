import { expect, test, type Page } from "@playwright/test";
import { loadFixture } from "../../fixtures/load";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";
import { accountUids, seed } from "../seed";

// Task 5.7: the overview's states that no other spec reaches on this screen (guide §5.2, §6.3, §6.5,
// §6.6): nothing booked or dated yet, a read that failed (`?fault=load`), and a partner's payment
// arriving, and the loading and offline-before-data states: with the Firestore listener aborted, the SDK
// answers from its empty cache, which the settings read now ignores (Phase 5 review B1). The app server runs with NEXT_PUBLIC_VEIL_DEV=1 (playwright.config.ts).

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const LISTEN = "**/google.firestore.v1.Firestore/Listen/**";

type Value = string | number | boolean | null;

const typed = (value: Value): Record<string, unknown> =>
  value === null
    ? { nullValue: null }
    : typeof value === "boolean"
      ? { booleanValue: value }
      : typeof value === "number"
        ? { integerValue: String(value) }
        : { stringValue: value };

async function put(path: string, fields: Record<string, Value>) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typed(v)])) };
  const res = await fetch(`${DOCS}/${path}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** A date `n` days from today, in this machine's calendar, as `YYYY-MM-DD`. */
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

/** The one booked vendor: a caterer whose price is 80 million, with `paid` already paid. */
const catering = (paid: number) => ({
  name: "Dapur Lestari Catering",
  category: "Catering",
  contractStatus: "Chosen",
  funder: null,
  totalPrice: 80_000_000,
  budgetSpent: paid,
  nextTargetDate: inDays(5),
});

async function open(page: Page, path = "/") {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  if (path !== "/") await page.goto(path);
}

const door = (page: Page, name: string) => page.locator("main").getByRole("link", { name: new RegExp(`^${name}`) });

test.describe("with nothing booked, dated or tracked yet", () => {
  // The prototype's empty set keeps the couple and the wedding date, and nothing else.
  test.beforeAll(async () => {
    await loadFixture("empty");
  });
  test.afterAll(async () => {
    await seed();
  });

  test("Coming up says nothing is dated, and the four doors say nothing yet", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { name: "Coming up", level: 2 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await expect(page.getByText("Nothing dated yet. Appointments, payments due and tasks with dates will show here.")).toBeVisible();
    await expect(door(page, "Budget")).toContainText("Nothing booked yet");
    await expect(door(page, "Tasks")).toContainText("No tasks yet");
    await expect(door(page, "Guests")).toContainText("No guests yet");
    await expect(door(page, "Wedding items")).toContainText("Nothing tracked yet");
  });
});

test.describe("when a read fails, hasn't arrived, or the connection is down", () => {
  test.beforeAll(async () => {
    await seed();
    // Named settings: with none, the first sign-in asks "Which of you is this?" (N3) instead of the overview.
    await put("settings/wedding", { yourName: "Greg", partnerName: "Bella" });
  });
  test.afterAll(async () => {
    await seed();
  });

  test("?fault=load: the overview says it didn't load, and Try again reads it again", async ({ page }) => {
    await open(page, "/?fault=load");
    const failed = page.getByRole("heading", { name: "Your overview didn’t load" });
    await expect(failed).toBeVisible({ timeout: COMPILE_TIMEOUT });

    const reloaded = page.waitForEvent("load");
    await page.getByRole("button", { name: "Try again" }).click();
    await reloaded;
    await expect(failed).toBeVisible({ timeout: COMPILE_TIMEOUT });
  });

  test("a read that hasn't arrived shows Loading your overview, with the page busy", async ({ page }) => {
    await open(page);
    await page.route(LISTEN, (route) => route.abort());
    await page.goto("/");
    await expect(page.getByText("Loading your overview", { exact: true })).toBeAttached({ timeout: COMPILE_TIMEOUT });
    await expect(page.locator("main")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { name: "Coming up", level: 2 })).toHaveCount(0);
  });

  test("offline before any data has arrived, the full offline message shows and never an empty overview", async ({ page }) => {
    await open(page);
    await page.route(LISTEN, (route) => route.abort());
    await page.goto("/?fault=offline");
    await expect(page.getByRole("heading", { name: "You’re offline" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await expect(page.getByText("The planner needs a connection to show your overview.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coming up", level: 2 })).toHaveCount(0);
  });
});

test.describe("a partner's payment", () => {
  test.beforeAll(async () => {
    await seed();
    await put("settings/wedding", {
      yourName: "Greg",
      partnerName: "Bella",
      weddingDate: inDays(157),
      startedOn: inDays(-73),
    });
    await put("vendors/ov-catering", catering(10_000_000));
  });
  test.afterAll(async () => {
    await seed();
  });

  test("arrives in place: the budget door changes, and a toast names Bella", async ({ page }) => {
    await open(page);
    const budget = door(page, "Budget");
    await expect(budget).toContainText("Rp 10.000.000 paid of Rp 80.000.000", { timeout: COMPILE_TIMEOUT });

    // Bella's account writes the payment: the activity entry is the news, the vendor is the number.
    const [, bella] = await accountUids();
    const res = await fetch(`${DOCS}/activity/ov-payment`, {
      method: "PATCH",
      headers: ADMIN,
      body: JSON.stringify({
        fields: {
          by: { stringValue: bella },
          at: { timestampValue: new Date().toISOString() },
          kind: { stringValue: "payment.recorded" },
          params: {
            mapValue: {
              fields: { amount: { integerValue: "55500000" }, name: { stringValue: "Dapur Lestari Catering" } },
            },
          },
          target: { mapValue: { fields: { kind: { stringValue: "vendor" }, id: { stringValue: "ov-catering" } } } },
        },
      }),
    });
    expect(res.ok).toBe(true);
    await put("vendors/ov-catering", catering(65_500_000));

    await expect(budget).toContainText("Rp 65.500.000 paid of Rp 80.000.000", { timeout: 15_000 });
    await expect(page.getByRole("status").getByText("Bella recorded Rp 55.500.000 for Dapur Lestari Catering")).toBeVisible({
      timeout: 15_000,
    });
  });
});
