import { expect, test, type Browser, type Page } from "@playwright/test";
import { loadFixture } from "../../fixtures/load";
import { TEST_ACCOUNTS, TEST_PORTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts, uniqueName } from "../helpers";
import { createAccount, seed } from "../seed";

test.afterEach(closeOtherContexts);

// Phase 5 review P5-S24: Task 4.F5's fixes for P3-S6, P3-S5 and P2-S1 were tested only in the model, so
// taking their wiring out of the screens left every test green. Each test here fails without its wiring.

async function signInAt(page: Page, email: string, password: string) {
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
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

  test("P3-S6: a sheet kept open by its save across a move to another screen closes once the save ends (sheet.tsx)", async ({ browser }) => {
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
    await expect(sheet).toBeHidden({ timeout: 20_000 });
    await page.context().setOffline(false);
  });
});

test("P2-S1: an account let in because the database couldn't be asked is asked again, and turned away (reprobe.ts)", async ({ page }) => {
  const email = `${uniqueName("someone")}@example.com`;
  await createAccount(email, "test-password-3");
  // The database can't be reached at sign-in, so the account is let in on trust.
  const toFirestore = (url: URL) => url.port === String(TEST_PORTS.firestore);
  await page.route(toFirestore, (route) => route.abort());
  await signInAt(page, email, "test-password-3");
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });

  // Reachable again, with nothing telling the browser it was ever offline: the page showing again asks.
  await page.unroute(toFirestore);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator("main").getByRole("alert")).toContainText(
    `You’re signed in as ${email}, which isn’t one of the two accounts that can open this planner.`,
    { timeout: 45_000 },
  );
  await expect(page).toHaveURL("/new/sign-in");
});
