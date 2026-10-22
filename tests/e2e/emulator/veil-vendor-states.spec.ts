import { expect, test, type Page } from "@playwright/test";
import { loadFixture } from "../../fixtures/load";
import { TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";
import { seed } from "../seed";

// Task 5.3: the Vendors group's states that a dev fault (Task 5.1, `?fault=`) or a stored
// record brings about, on the "normal" fixture set (guide §5.11 to §5.15). The app server
// runs with NEXT_PUBLIC_VEIL_DEV=1 (playwright.config.ts).

// The set stays in Firestore, so the emulators are cleaned for the specs after this one.
test.beforeAll(async () => {
  await loadFixture("normal");
});
test.afterAll(seed);

async function open(page: Page, path: string) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
}

test("the Vendors list says it didn't load under ?fault=load, and Try again says so again", async ({ page }) => {
  await open(page, "/new/vendors?fault=load");
  await expect(page.getByText("Your vendors didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Your vendors didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
});

test("the Shortlist, the Venues and a vendor's own screen each say they didn't load under ?fault=load", async ({ page }) => {
  await open(page, "/new/vendors/shortlist?fault=load");
  await expect(page.getByText("Your shortlist didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/vendors/venues?fault=load");
  await expect(page.getByText("Your venues didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/vendors/kebun?fault=load");
  await expect(page.getByText("This vendor didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
});

test("a rating that doesn't save keeps what was typed, with the rose line and the save line saying so", async ({ page }) => {
  await open(page, "/new/vendors/kebun?fault=save");
  const rating = page.getByLabel("Review rating");
  await expect(rating).toBeVisible({ timeout: COMPILE_TIMEOUT });
  // 4,9, not the stored 4,8: a value that hasn't changed isn't written, so nothing would fail.
  await rating.fill("4,9");
  await rating.blur();
  await expect(page.getByText("Couldn’t save this change. What you typed is kept.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("1 change not saved")).toBeVisible();
  await expect(rating).toHaveValue("4,9");
});

test("a finalist with no packages says so on its card, where the packages would be", async ({ page }) => {
  await open(page, "/new/vendors/shortlist");
  await page.getByRole("button", { name: "Add a finalist" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a finalist" });
  await sheet.getByLabel("Name").fill("Card with no packages");
  await sheet.getByRole("button", { name: "Add finalist" }).click();
  const card = page.locator("li", { has: page.getByRole("link", { name: "Card with no packages" }) });
  await expect(card.getByText("No packages yet", { exact: true })).toBeVisible({ timeout: COMPILE_TIMEOUT });
});
