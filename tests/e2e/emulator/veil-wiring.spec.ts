import { expect, test, type Browser, type Page } from "@playwright/test";
import { loadFixture } from "../../fixtures/load";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS, TEST_PORTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts, uniqueName } from "../helpers";
import { createAccount, seed } from "../seed";
import { REPROBE_MS } from "@/lib/data/reprobe";

test.afterEach(closeOtherContexts);

// Phase 5 review P5-S24: Task 4.F5's fixes for P3-S6, P3-S5 and P2-S1 were tested only in the model, so
// taking their wiring out of the screens left every test green. Each test here fails without its wiring.

async function signInAt(page: Page, email: string, password: string) {
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

/** Bella's "finished a task" entries, written in one commit as the emulator's owner. */
async function addActivity(titles: string[]) {
  const at = new Date().toISOString();
  const writes = titles.map((title) => ({
    update: {
      name: `projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/activity/${uniqueName("news")}`,
      fields: {
        by: { stringValue: "bella-elsewhere" },
        at: { timestampValue: at },
        kind: { stringValue: "task.finished" },
        params: { mapValue: { fields: { name: { stringValue: title } } } },
        target: { nullValue: null },
        device: { stringValue: "bella-phone" },
      },
    },
  }));
  const res = await fetch(`${DOCS}:commit`, { method: "POST", headers: ADMIN, body: JSON.stringify({ writes }) });
  expect(res.ok).toBe(true);
}

async function openAs(browser: Browser, path: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const { email, password } = TEST_ACCOUNTS[0];
  await signInAt(page, email, password);
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
  return page;
}

test.describe("the normal set", () => {
  // The set stays in Firestore, so the emulators are cleaned for the specs after this one.
  test.beforeAll(async () => {
    await loadFixture("normal");
  });
  test.afterAll(seed);

  test("P3-S5: a removal refused in demonstration mode says why and offers no Try again (confirm.tsx)", async ({ browser }) => {
    const page = await openAs(browser, "/new/guests?fault=save:demo");
    const sarah = page.locator("[data-guest-id]", { hasText: "Sarah Lim" });
    await sarah.getByRole("button", { name: /^Sarah Lim/ }).click({ timeout: COMPILE_TIMEOUT });
    await page.getByRole("dialog", { name: "Sarah Lim" }).getByRole("button", { name: "Remove guest" }).click();
    const confirm = page.getByRole("dialog", { name: "Remove Sarah Lim?" });
    await confirm.getByRole("button", { name: "Remove guest" }).click();
    await expect(confirm.getByText("This is demonstration mode, so nothing can be changed and everything is just as it was.")).toBeVisible();
    await expect(confirm.getByRole("button", { name: "Try again" })).toHaveCount(0);
    await expect(confirm.getByRole("button", { name: "Keep it" })).toBeFocused();
  });

  test("P5-S12: Bookings, Payments due and Add a booking name what they show as the prototype does (ScreenState's what)", async ({ browser }) => {
    const page = await openAs(browser, "/new/budget/bookings?fault=load");
    await expect(page.getByRole("heading", { name: "Your bookings didn’t load" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await page.goto("/new/budget/payments?fault=load");
    await expect(page.getByRole("heading", { name: "Payments due didn’t load" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    // Add a booking keeps its form when a read fails; its noun is in the loading line.
    await page.goto("/new/budget/bookings/new?fault=loading");
    await expect(page.getByText("Loading the budget", { exact: true })).toBeAttached({ timeout: COMPILE_TIMEOUT });
  });

  test("P5-S26: more than three of Bella's changes arriving together make one toast (usePartnerNews, partner.ts)", async ({ browser }) => {
    const page = await openAs(browser, "/new/schedule/tasks");
    await expect(page.getByRole("button", { name: "Add a task" }).first()).toBeVisible({ timeout: COMPILE_TIMEOUT });
    // Entries count as news once the activity read has had its first answer: one alone first, until it shows.
    await expect(async () => {
      const name = uniqueName("Warm-up");
      await addActivity([name]);
      await expect(page.getByRole("status").getByText(`Bella finished “${name}”`)).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    // Four in one commit reach the screen in one answer: one toast for all four, none of their own.
    await addActivity(["Burst one", "Burst two", "Burst three", "Burst four"]);
    await expect(page.getByRole("status").getByText("Bella made 4 changes. Everything here is up to date.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("status").getByText(/Burst/)).toHaveCount(0);
  });

  test("P3-S6, P6-S14: a sheet kept open by its save across a move to another screen stays to say the save failed, and Try again adds it (sheet.tsx)", async ({ browser }) => {
    const page = await openAs(browser, "/new/schedule");
    // Moved within the app, so Back below stays in it too.
    await page.getByRole("link", { name: "Tasks" }).click({ timeout: COMPILE_TIMEOUT });
    await expect(page).toHaveURL("/new/schedule/tasks");
    await page.getByRole("button", { name: "Add a task" }).click({ timeout: COMPILE_TIMEOUT });
    const sheet = page.getByRole("dialog", { name: "Add a task" });
    await sheet.getByLabel("What needs doing").fill("Hold the sheet open");

    // Offline, the add waits for its 10-second timeout, holding the sheet.
    await page.context().setOffline(true);
    await sheet.getByRole("button", { name: "Add task" }).click();
    await expect(sheet.getByRole("button", { name: "Adding" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("/new/schedule");
    await expect(sheet).toBeVisible();
    // The add times out: the sheet stays, says so, and keeps what was typed (it used to close with no word).
    await expect(sheet.getByText("The task wasn’t added. What you typed is still here.")).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByLabel("What needs doing")).toHaveValue("Hold the sheet open");
    await page.context().setOffline(false);
    await sheet.getByRole("button", { name: "Try again" }).click();
    await expect(sheet).toBeHidden({ timeout: 15_000 });
  });
});

test("P2-S1: an account let in because the database couldn't be asked is asked again, and turned away (reprobe.ts)", async ({ page }) => {
  // The 30-second re-probe timer never fires here, so only the page showing again can ask: without
  // the `visibilitychange` wiring this stays signed in (the timer used to answer within the wait).
  await page.addInitScript((every) => {
    const real = window.setInterval.bind(window);
    window.setInterval = ((handler: TimerHandler, ms?: number, ...args: unknown[]) =>
      ms === every ? real(() => {}, ms) : real(handler, ms, ...args)) as typeof window.setInterval;
  }, REPROBE_MS);
  const email = `${uniqueName("someone")}@example.com`;
  await createAccount(email, "test-password-3");
  // The database can't be reached at sign-in, so the account is let in on trust.
  const toFirestore = (url: URL) => url.port === String(TEST_PORTS.firestore);
  await page.route(toFirestore, (route) => route.abort());
  await signInAt(page, email, "test-password-3");
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });

  // Reachable again, with nothing telling the browser it was ever offline: the page showing again asks.
  // The database takes a moment to be reached again, so it shows again every few seconds until asked.
  await page.unroute(toFirestore);
  await expect(async () => {
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.locator("main").getByRole("alert")).toContainText(
      `You’re signed in as ${email}, which isn’t one of the two accounts that can open this planner.`,
      { timeout: 5_000 },
    );
  }).toPass({ timeout: 60_000 });
  await expect(page).toHaveURL("/new/sign-in");
});
