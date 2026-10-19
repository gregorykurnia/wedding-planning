import { expect, test, type Browser, type Page } from "@playwright/test";
import { loadFixture } from "../../fixtures/load";
import { TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";
import { seed } from "../seed";

// Task 5.6: the Wedding items' and Guests' states that a dev fault (Task 5.1, `?fault=`), a remove that
// doesn't finish, the partner's tick or a dropped connection brings about (guide §5.22, §5.23, N12, N14).
// The app server runs with NEXT_PUBLIC_VEIL_DEV=1 (playwright.config.ts). The stress set isn't loaded here:
// it takes longer than a hook's timeout; its paging is the long-list tests in the item and guest specs.

async function openAs(browser: Browser, account: (typeof TEST_ACCOUNTS)[number], path: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
  return page;
}

const itemRow = (page: Page, name: string) => page.locator("[data-item-id]", { has: page.getByRole("button", { name: `More for ${name}` }) });
const guestRow = (page: Page, name: string) => page.locator("[data-guest-id]", { hasText: name });
const toasts = (page: Page) => page.getByRole("status");

test.describe("the normal set", () => {
  // The set stays in Firestore, so the emulators are cleaned for the specs after this one.
  test.beforeAll(async () => {
    await loadFixture("normal");
  });
  test.afterAll(seed);

  test("Wedding items says it didn't load under ?fault=load, and Try again says so again", async ({ browser }) => {
    const page = await openAs(browser, TEST_ACCOUNTS[0], "/new/items?fault=load");
    await expect(page.getByText("Your wedding items didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Your wedding items didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  });

  test("Guests says it didn't load under ?fault=load, and Try again says so again", async ({ browser }) => {
    const page = await openAs(browser, TEST_ACCOUNTS[0], "/new/guests?fault=load");
    await expect(page.getByText("Your guests didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Your guests didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  });

  test("an item whose removal doesn't finish keeps its confirm open with Try again, and the item stays (N14)", async ({ browser }) => {
    const page = await openAs(browser, TEST_ACCOUNTS[0], "/new/items?fault=save");
    const cake = itemRow(page, "Wedding cake");
    await cake.getByRole("button", { name: "More for Wedding cake" }).click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    const confirm = page.getByRole("dialog", { name: "Remove Wedding cake?" });
    await confirm.getByRole("button", { name: "Remove item" }).click();
    await expect(confirm.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 30_000 });
    await confirm.getByRole("button", { name: "Keep it" }).click();
    await expect(cake).toHaveCount(1);
  });

  test("a guest whose removal doesn't finish keeps the confirm open with Try again, and the guest stays (N14)", async ({ browser }) => {
    const page = await openAs(browser, TEST_ACCOUNTS[0], "/new/guests?fault=save");
    const sarah = guestRow(page, "Sarah Lim");
    await sarah.getByRole("button", { name: /^Sarah Lim/ }).click();
    await page.getByRole("dialog", { name: "Sarah Lim" }).getByRole("button", { name: "Remove guest" }).click();
    const confirm = page.getByRole("dialog", { name: "Remove Sarah Lim?" });
    await confirm.getByRole("button", { name: "Remove guest" }).click();
    await expect(confirm.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 30_000 });
    await confirm.getByRole("button", { name: "Keep it" }).click();
    await expect(sarah).toHaveCount(1);
  });

  test("Bella's tick on Wedding cake reaches Greg's list in place: the row flashes and says so", async ({ browser }) => {
    const greg = await openAs(browser, TEST_ACCOUNTS[0], "/new/items");
    const bella = await openAs(browser, TEST_ACCOUNTS[1], "/new/items");

    await itemRow(bella, "Wedding cake").getByRole("button", { name: /^Confirmed:/ }).click();
    await expect(toasts(greg).getByText("Bella confirmed Wedding cake")).toBeVisible({ timeout: 15_000 });
    await expect(itemRow(greg, "Wedding cake")).toHaveClass(/\bflash\b/);
    // Her own tick is not news to her.
    await expect(toasts(bella).getByText(/confirmed/)).toHaveCount(0);
  });

  test("a dropped connection keeps every item on screen once the list has loaded", async ({ browser }) => {
    const page = await openAs(browser, TEST_ACCOUNTS[0], "/new/items");
    const rows = page.locator("[data-item-id]");
    await expect(rows.first()).toBeVisible({ timeout: COMPILE_TIMEOUT });
    const shown = await rows.count();

    await page.context().setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await expect(page.getByText("You’re offline")).toHaveCount(0);
    await expect(rows).toHaveCount(shown);
    await page.context().setOffline(false);
  });

  test("a dropped connection keeps every guest on screen once the list has loaded", async ({ browser }) => {
    const page = await openAs(browser, TEST_ACCOUNTS[0], "/new/guests");
    const rows = page.locator("[data-guest-id]");
    await expect(rows.first()).toBeVisible({ timeout: COMPILE_TIMEOUT });
    const shown = await rows.count();

    await page.context().setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await expect(page.getByText("You’re offline")).toHaveCount(0);
    await expect(rows).toHaveCount(shown);
    await page.context().setOffline(false);
  });
});
