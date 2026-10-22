import { expect, test, type Page } from "@playwright/test";
import { loadFixture } from "../../fixtures/load";
import { TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";
import { seed } from "../seed";

// Task 5.1: the dev-only faults (`?fault=`) each bring one screen to its designed
// state, on the "normal" fixture set. The app server runs with NEXT_PUBLIC_VEIL_DEV=1
// (playwright.config.ts).

// The set stays in Firestore, so the emulators are cleaned for the specs after this one.
test.beforeAll(async () => {
  await loadFixture("normal");
});
test.afterAll(seed);

async function open(page: Page, path: string) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
}

const saveState = (page: Page) => page.getByRole("toolbar", { name: "Formatting" }).getByRole("status");

test("without a fault, the Documents screen shows the fixture's six documents", async ({ page }) => {
  await open(page, "/documents");
  await expect(page.getByText("6 documents, newest first")).toBeVisible({ timeout: COMPILE_TIMEOUT });
});

test("?fault=load shows Documents' couldn't-load state, and stays through Try again and a move to another screen", async ({ page }) => {
  await open(page, "/documents?fault=load");
  await expect(page.getByText("Your documents didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Your documents didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  // The query is dropped by a move between screens; the fault is kept for the tab.
  await page.getByRole("link", { name: "Our wedding planner" }).first().click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText(/didn’t load/)).toBeVisible({ timeout: COMPILE_TIMEOUT });
  // `off` clears it.
  await page.goto("/documents?fault=off");
  await expect(page.getByText("6 documents, newest first")).toBeVisible({ timeout: COMPILE_TIMEOUT });
});

test("?fault=save makes a document's save fail with its text kept, and Try again fails the same", async ({ page }) => {
  await open(page, "/documents/seating?fault=save");
  const title = page.getByLabel("Title");
  await expect(title).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await title.fill("Seating ideas, again");
  await expect(saveState(page)).toContainText("Couldn’t save your last changes. They’re still here.", { timeout: 30_000 });
  await expect(title).toHaveValue("Seating ideas, again");
  await saveState(page).getByRole("button", { name: "Try again" }).click();
  await expect(saveState(page)).toContainText("Couldn’t save your last changes. They’re still here.", { timeout: 30_000 });
});

test("?fault=offline makes the device read as offline, so a document says it isn't saved because of that", async ({ page }) => {
  await open(page, "/documents/seating?fault=offline");
  const title = page.getByLabel("Title");
  await expect(title).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await title.fill("Seating ideas, offline");
  await expect(saveState(page)).toContainText("Not saved: you’re offline. Keep this page open.", { timeout: 30_000 });
});

test("?fault=upload makes an upload fail part-way, with Try again", async ({ page }) => {
  await open(page, "/documents/files?fault=upload");
  await page.getByRole("button", { name: "Upload files" }).click({ timeout: COMPILE_TIMEOUT });
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles({ name: "Invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await expect(dialog.getByText(/^Upload failed\./)).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("?fault=loading holds Documents in its loading state, and ?fault=offline:cold in its offline one (P5-S23)", async ({ page }) => {
  await open(page, "/documents?fault=loading");
  await expect(page.getByText("Loading your documents")).toBeAttached({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("6 documents, newest first")).toHaveCount(0);
  // Plain `offline` keeps what has loaded, as a connection lost mid-session does; `cold` is a page
  // opened with no connection at all.
  await page.goto("/documents?fault=offline");
  await expect(page.getByText("6 documents, newest first")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.goto("/documents?fault=offline:cold");
  await expect(page.getByRole("heading", { name: "You’re offline" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("6 documents, newest first")).toHaveCount(0);
});
