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
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** What a failure line says while offline (`SAVE_OFFLINE`). */
const OFFLINE_LINE = "Not saved: you’re offline. Keep this page open.";

/** Opens a screen through the menu from the overview, so Back stays in the app and lands on the overview. */
async function openFromMenu(browser: Browser, title: string): Promise<Page> {
  const page = await openAs(browser, "/");
  await page.getByRole("button", { name: "Menu" }).click({ timeout: COMPILE_TIMEOUT });
  await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: new RegExp(`^${title}`) }).click();
  return page;
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
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
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
    const page = await openAs(browser, "/guests?fault=save:demo");
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
    const page = await openAs(browser, "/budget/bookings?fault=load");
    await expect(page.getByRole("heading", { name: "Your bookings didn’t load" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await page.goto("/budget/payments?fault=load");
    await expect(page.getByRole("heading", { name: "Payments due didn’t load" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    // Add a booking keeps its form when a read fails; its noun is in the loading line.
    await page.goto("/budget/bookings/new?fault=loading");
    await expect(page.getByText("Loading the budget", { exact: true })).toBeAttached({ timeout: COMPILE_TIMEOUT });
  });

  test("P5-S26: more than three of Bella's changes arriving together make one toast (usePartnerNews, partner.ts)", async ({ browser }) => {
    const page = await openAs(browser, "/schedule/tasks");
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
    const page = await openAs(browser, "/schedule");
    // Moved within the app, so Back below stays in it too.
    await page.getByRole("link", { name: "Tasks" }).click({ timeout: COMPILE_TIMEOUT });
    await expect(page).toHaveURL("/schedule/tasks");
    await page.getByRole("button", { name: "Add a task" }).click({ timeout: COMPILE_TIMEOUT });
    const sheet = page.getByRole("dialog", { name: "Add a task" });
    await sheet.getByLabel("What needs doing").fill("Hold the sheet open");

    // Offline, the add waits for its 10-second timeout, holding the sheet.
    await page.context().setOffline(true);
    await sheet.getByRole("button", { name: "Add task" }).click();
    await expect(sheet.getByRole("button", { name: "Adding" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("/schedule");
    await expect(sheet).toBeVisible();
    // The add times out: the sheet stays, says so, and keeps what was typed (it used to close with no word).
    await expect(sheet.getByText(OFFLINE_LINE)).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByLabel("What needs doing")).toHaveValue("Hold the sheet open");
    await page.context().setOffline(false);
    await sheet.getByRole("button", { name: "Try again" }).click();
    await expect(sheet).toBeHidden({ timeout: 15_000 });
  });

  test("P7-S18: a sheet held by its save across a move closes once the save lands, with no word (sheet.tsx)", async ({ browser }) => {
    const page = await openFromMenu(browser, "Guests");
    await page.locator("[data-guest-id]", { hasText: "Sarah Lim" }).getByRole("button", { name: /^Sarah Lim/ }).click({ timeout: COMPILE_TIMEOUT });
    const sheet = page.getByRole("dialog", { name: "Sarah Lim" });
    // The save's request is held for 4 s, so it is still on its way after the move.
    let held = false;
    await page.route(/google\.firestore\.v1\.Firestore\/Write\/channel/, async (route) => {
      if (!held && route.request().postData()?.includes("LandingCountry")) {
        held = true;
        await new Promise((done) => setTimeout(done, 4_000));
      }
      await route.continue();
    });
    const country = sheet.getByLabel("Country");
    await country.fill("LandingCountry");
    await country.press("Tab");
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(sheet).toBeVisible();
    // It lands: the hold goes with no failure showing, and the sheet closes on its own.
    await expect(sheet).toBeHidden({ timeout: 15_000 });
    expect(held).toBe(true);
  });

  test("P7-S16: an edit sheet whose change is saving stays across a move to say it didn't save, with Try again (save-scope.tsx)", async ({ browser }) => {
    const page = await openFromMenu(browser, "Guests");
    await page.locator("[data-guest-id]", { hasText: "Sarah Lim" }).getByRole("button", { name: /^Sarah Lim/ }).click({ timeout: COMPILE_TIMEOUT });
    const sheet = page.getByRole("dialog", { name: "Sarah Lim" });
    await page.context().setOffline(true);
    const country = sheet.getByLabel("Country");
    await country.fill("Held country");
    await country.press("Tab");
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(sheet).toBeVisible();
    // The save times out: the line and Try again stay with what was typed (the sheet used to close).
    await expect(sheet.getByText(OFFLINE_LINE).first()).toBeVisible({ timeout: 20_000 });
    await expect(country).toHaveValue("Held country");
    await page.context().setOffline(false);
    await sheet.getByRole("button", { name: "Try again" }).first().click();
    await expect(sheet.getByText(OFFLINE_LINE)).toHaveCount(0, { timeout: 15_000 });
  });

  test("Phase 8 review B2: Done while a change saves, then a move: the failure still keeps the sheet open (sheet.tsx)", async ({ browser }) => {
    const page = await openFromMenu(browser, "Guests");
    await page.locator("[data-guest-id]", { hasText: "Sarah Lim" }).getByRole("button", { name: /^Sarah Lim/ }).click({ timeout: COMPILE_TIMEOUT });
    const sheet = page.getByRole("dialog", { name: "Sarah Lim" });
    await page.context().setOffline(true);
    const country = sheet.getByLabel("Country");
    await country.fill("Held after Done");
    await country.press("Tab");
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(sheet.getByText("Saving, then this closes")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("/");
    // The save times out: the held line and Try again stay (the sheet used to close with no word).
    await expect(sheet.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 20_000 });
    await expect(country).toHaveValue("Held after Done");
  });

  test("Phase 8 review S2: Escape while a change saves says it closes once saved (sheet.tsx)", async ({ browser }) => {
    const page = await openFromMenu(browser, "Guests");
    await page.locator("[data-guest-id]", { hasText: "Sarah Lim" }).getByRole("button", { name: /^Sarah Lim/ }).click({ timeout: COMPILE_TIMEOUT });
    const sheet = page.getByRole("dialog", { name: "Sarah Lim" });
    await page.context().setOffline(true);
    const country = sheet.getByLabel("Country");
    await country.fill("Escape while saving");
    await country.press("Tab");
    await page.keyboard.press("Escape");
    await expect(sheet.getByText("Saving, then this closes")).toBeVisible();
  });

  test("P7-S13: the categories sheet's failed add keeps it open across a move to say so (categories-sheet.tsx)", async ({ browser }) => {
    const page = await openFromMenu(browser, "Vendors");
    await page.getByRole("button", { name: "Edit categories" }).click({ timeout: COMPILE_TIMEOUT });
    const sheet = page.getByRole("dialog", { name: "Vendor categories" });
    await page.context().setOffline(true);
    await sheet.getByLabel("New category").fill("Held category");
    await sheet.getByRole("button", { name: "Add category" }).click();
    await expect(sheet.getByRole("button", { name: "Adding" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(OFFLINE_LINE)).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByLabel("New category")).toHaveValue("Held category");
  });

  test("P7-S12: a confirm whose removal fails after a move stays to say nothing was removed (confirm.tsx)", async ({ browser }) => {
    const page = await openFromMenu(browser, "Guests");
    await page.locator("[data-guest-id]", { hasText: "Sarah Lim" }).getByRole("button", { name: /^Sarah Lim/ }).click({ timeout: COMPILE_TIMEOUT });
    await page.getByRole("dialog", { name: "Sarah Lim" }).getByRole("button", { name: "Remove guest" }).click();
    const confirm = page.getByRole("dialog", { name: "Remove Sarah Lim?" });
    // Offline, the removal waits for its timeout, holding the confirm. The page closes offline, so it never lands.
    await page.context().setOffline(true);
    await confirm.getByRole("button", { name: "Remove guest" }).click();
    await expect(confirm.getByRole("button", { name: "Removing" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText("Nothing was removed.")).toBeVisible({ timeout: 20_000 });
    await expect(confirm.getByRole("button", { name: "Try again" })).toBeVisible();
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
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });

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
  await expect(page).toHaveURL("/sign-in");
});
