import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";
import { seed } from "../seed";

// Task 5.7: the Wedding settings' states that no other spec reaches on this screen (guide §5.3, §6.1,
// N6): a name that didn't save, the reminder states on this computer or phone, and installed on the home
// screen. The browser's notification permission, the home-screen flag and push support are set in the
// page, as the Task 5.5 spec does. Loading and offline-before-data are fixme: with the Firestore listener
// aborted, the SDK answers from its empty cache after about ten seconds, and the app takes that for the
// settings, so the names prompt appears instead (raised for the Phase 5 review; the read is in
// src/lib/collections/settings.ts). The app server runs with NEXT_PUBLIC_VEIL_DEV=1 (playwright.config.ts).

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const LISTEN = "**/google.firestore.v1.Firestore/Listen/**";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

async function put(path: string, fields: Record<string, string>) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { stringValue: v }])) };
  const res = await fetch(`${DOCS}/${path}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

async function storedPartnerName(): Promise<string | undefined> {
  const res = await fetch(`${DOCS}/settings/wedding`, { headers: ADMIN });
  return ((await res.json()) as { fields?: { partnerName?: { stringValue?: string } } }).fields?.partnerName?.stringValue;
}

async function open(page: Page, path = "/new/settings") {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
}

test.describe("Wedding settings states", () => {
  test.beforeAll(async () => {
    await seed();
  });
  test.beforeEach(async () => {
    await put("settings/wedding", { yourName: "Greg", partnerName: "Bella", weddingDate: "2027-06-12" });
  });
  test.afterAll(async () => {
    await seed();
  });

  test("a name that didn't save keeps what was typed, rings its field and says so, and Try again fails the same", async ({
    page,
  }) => {
    await open(page, "/new/settings?fault=save");
    const second = page.getByLabel("Second name");
    await second.fill("Isabella");
    await second.blur();

    const notSaved = page.getByRole("status").filter({ hasText: "1 change not saved" });
    await expect(notSaved).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await expect(second).toHaveValue("Isabella");
    await expect(second).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Couldn’t save this change. What you typed is kept.")).toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(notSaved).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await expect(second).toHaveValue("Isabella");
    expect(await storedPartnerName()).toBe("Bella");
  });

  test("notifications not yet allowed: the note says so, and Allow notifications is there to press", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "default" }));
    await open(page);
    await expect(page.getByText("Not allowed yet on this")).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await expect(page.getByRole("button", { name: "Allow notifications" })).toBeEnabled();
  });

  test("notifications turned off: a rose note says where to turn them on", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "denied" }));
    await open(page);
    const off = page.locator("p", { hasText: "Turned off for the planner on this" });
    await expect(off).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await expect(off).toContainText("the browser’s site settings for the planner");
  });

  test("installed on this phone: the home-screen note replaces the install steps", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
    await open(page);
    await expect(page.getByText("Installed on this phone. Open it from your home screen like any app.")).toBeVisible({
      timeout: COMPILE_TIMEOUT,
    });
    await expect(page.getByText("open the planner in Safari, tap Share")).toHaveCount(0);
  });

  test("a browser that can't show reminders says so, in rose, and says they still reach the other devices", async ({
    page,
  }) => {
    await page.addInitScript(() => delete (window as unknown as { PushManager?: unknown }).PushManager);
    await open(page);
    const note = page.locator("p", { hasText: "This browser can’t show reminders from the planner" });
    await expect(note).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await expect(note).toContainText("They still arrive on your other devices where they’re allowed.");
  });

  test.fixme("while the settings are read, Loading your settings keeps the page busy", async ({ page }) => {
    await open(page);
    await page.route(LISTEN, (route) => route.abort());
    await page.goto("/new/settings");
    await expect(page.getByText("Loading your settings", { exact: true })).toBeAttached({ timeout: COMPILE_TIMEOUT });
    await expect(page.locator("main")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByLabel("Second name")).toHaveCount(0);
  });

  test.fixme("offline before any data has arrived, the offline message shows and no form does", async ({ page }) => {
    await open(page);
    await page.route(LISTEN, (route) => route.abort());
    await page.goto("/new/settings?fault=offline");
    await expect(page.getByRole("heading", { name: "You’re offline" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await expect(page.getByText("The planner needs a connection to show your settings.")).toBeVisible();
    await expect(page.getByLabel("Second name")).toHaveCount(0);
  });

  test.describe("on an iPhone that isn't on the home screen", () => {
    test.use({ userAgent: IPHONE });

    test("reminders need the home screen first, and Show me how goes to the install steps", async ({ page }) => {
      await page.addInitScript(() => delete (window as unknown as { PushManager?: unknown }).PushManager);
      await open(page);
      await expect(
        page.getByText("On an iPhone, reminders can only arrive once the planner is on your home screen."),
      ).toBeVisible({ timeout: COMPILE_TIMEOUT });
      await expect(page.getByRole("link", { name: "Show me how" })).toHaveAttribute("href", "#install");
    });
  });
});
