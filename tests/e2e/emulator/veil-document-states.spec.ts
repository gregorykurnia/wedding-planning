import { expect, test, type Browser, type Page } from "@playwright/test";
import { loadFixture } from "../../fixtures/load";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";
import { accountUids, seed } from "../seed";

// Task 5.4: the states of Documents, a document and Files that a dev fault (Task 5.1, `?fault=`), the
// partner or a slow connection brings about, on the "normal" fixture set (guide §5.16 to §5.18). The
// app server runs with NEXT_PUBLIC_VEIL_DEV=1 (playwright.config.ts). The partner is written as the
// emulator's owner, which skips the rules, the way the partner's own device would write it.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

// The set stays in Firestore, so the emulators are cleaned for the specs after this one.
test.beforeAll(async () => {
  await loadFixture("normal");
});
test.afterAll(seed);

type Account = (typeof TEST_ACCOUNTS)[number];

async function signIn(page: Page, account: Account) {
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
}

async function open(page: Page, path: string, account: Account = TEST_ACCOUNTS[0]) {
  await signIn(page, account);
  await page.goto(path);
}

async function openAs(browser: Browser, account: Account, path: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await open(page, path, account);
  return page;
}

/**
 * Offline with nothing on the device to show: the page opens as offline (`?fault=offline`) on one
 * screen, then the browser says it is offline and the database's traffic is refused (the planner's own
 * pages still load, which a really offline browser would stop), and the other screen is opened by its
 * link. (With the database reachable the fault leaves a screen's data on it, as a dropped line would.)
 */
async function goOfflineThen(page: Page, from: string, link: string) {
  await open(page, `${from}?fault=offline`);
  await expect(page.getByRole("link", { name: link, exact: true })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.evaluate(() => Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true }));
  await page.route("**/google.firestore.v1.Firestore/**", (route) => route.abort());
  await page.getByRole("link", { name: link, exact: true }).click();
}

const saveState = (page: Page) => page.getByRole("toolbar", { name: "Formatting" }).getByRole("status");

// ---------- the shared states: couldn't load, offline ----------

test("Documents says it's offline when nothing has arrived, with Try again", async ({ page }) => {
  await goOfflineThen(page, "/new/documents/files", "Documents");
  await expect(page.getByText("You’re offline")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("The planner needs a connection to show your documents.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  // Not the empty state, which would say there is nothing written.
  await expect(page.getByText("Nothing written yet")).toHaveCount(0);
});

test("Files says it's offline when nothing has arrived", async ({ page }) => {
  await goOfflineThen(page, "/new/documents", "Files");
  await expect(page.getByText("You’re offline")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("The planner needs a connection to show your files.")).toBeVisible();
});

test("a document and the Files screen each say they didn't load under ?fault=load", async ({ page }) => {
  await open(page, "/new/documents/seating?fault=load");
  await expect(page.getByText("This document didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("This document didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/documents/files");
  await expect(page.getByText("Your files didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
});

// ---------- the editor's own states ----------

test("while the write is on its way the save state says Saving, then Saved", async ({ page }) => {
  await open(page, "/new/documents/questions");
  const title = page.getByLabel("Title");
  await expect(title).toBeVisible({ timeout: COMPILE_TIMEOUT });
  // Holds the write back for a while, so the state between typing and the server's answer shows.
  await page.route("**/google.firestore.v1.Firestore/Write/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.continue();
  });
  await title.fill("Questions to ask every vendor, slowly");
  await expect(saveState(page)).toHaveText("Saving", { timeout: 15_000 });
  await expect(saveState(page)).toContainText("Saved", { timeout: 30_000 });
  await page.unroute("**/google.firestore.v1.Firestore/Write/**");
});

test("a delete that can't finish keeps the question open with Nothing was deleted and Try again", async ({ page }) => {
  await open(page, "/new/documents/seating?fault=save");
  await expect(page.getByLabel("Title")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.getByRole("button", { name: "Delete this document" }).click();
  const sheet = page.getByRole("dialog", { name: "Delete “Seating ideas”?" });
  await sheet.getByRole("button", { name: "Delete for good" }).click();
  await expect(sheet.getByText("Nothing was deleted.")).toBeVisible({ timeout: 30_000 });
  await expect(sheet.getByRole("button", { name: "Try again" })).toBeVisible();
  await sheet.getByRole("button", { name: "Keep it" }).click();
  // The document is still there, and still open.
  await expect(page.getByLabel("Title")).toHaveValue("Seating ideas");
});

test("deleting a file that can't finish says Nothing was deleted and offers Try again", async ({ page }) => {
  await open(page, "/new/documents/files?folder=venue&file=f1&fault=save");
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Villa Samaya contract.pdf" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await sheet.getByRole("button", { name: "Delete for good" }).click();
  await sheet.getByRole("button", { name: "Delete for good" }).click();
  await expect(sheet.getByText("Nothing was deleted.")).toBeVisible({ timeout: 30_000 });
  await expect(sheet.getByRole("button", { name: "Try again" })).toBeVisible();
});

// ---------- the partner ----------

/** A timestamp value, the way Firestore's REST API takes one. */
const stamp = (at = new Date()) => ({ timestampValue: at.toISOString() });

async function putRaw(collection: string, id: string, fields: Record<string, unknown>) {
  const res = await fetch(`${DOCS}/${collection}/${id}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify({ fields }) });
  expect(res.ok).toBe(true);
}

const str = (value: string) => ({ stringValue: value });
const map = (fields: Record<string, unknown>) => ({ mapValue: { fields } });

/** The partner's news: what her device writes next to the change itself (guide §6.3). */
async function bellaNews(kind: string, name: string, target: { kind: string; id: string }) {
  const [, bella] = await accountUids();
  await putRaw("activity", `e2e-${kind}-${target.id}`, {
    by: str(bella),
    at: stamp(),
    kind: str(kind),
    params: map({ name: str(name) }),
    target: map({ kind: str(target.kind), id: str(target.id) }),
    device: str("bella-phone"),
    deviceKind: str("phone"),
  });
  return bella;
}

test("Bella starts a document: a toast names it and its card flashes", async ({ page }) => {
  await open(page, "/new/documents");
  await expect(page.getByText("6 documents, newest first")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  const bella = (await accountUids())[1];
  await putRaw("notes", "e2e-bella-doc", {
    title: str("Bella’s florist questions"),
    content: map({
      type: str("doc"),
      content: { arrayValue: { values: [map({ type: str("paragraph") })] } },
    }),
    createdAt: stamp(),
    createdBy: str(bella),
    updatedAt: stamp(),
    updatedBy: str(bella),
  });
  await bellaNews("document.added", "Bella’s florist questions", { kind: "document", id: "e2e-bella-doc" });
  await expect(page.getByRole("status").getByText("Bella started “Bella’s florist questions”")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("li", { has: page.locator('[data-doc-id="e2e-bella-doc"]') })).toHaveClass(/\bflash\b/);
});

test("Bella uploads a file: a toast names it and its row flashes", async ({ page }) => {
  await open(page, "/new/documents/files?folder=venue");
  await expect(page.locator('[data-file-id="f1"]')).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await putRaw("weddingFiles", "e2e-bella-file", {
    name: str("Bella’s dress fitting.jpg"),
    folderId: str("venue"),
    category: str("Photo"),
    description: str(""),
    url: str("https://example.com/dress.jpg"),
    fileType: str("image/jpeg"),
    fileSize: { integerValue: "2306867" },
    createdAt: stamp(),
  });
  await bellaNews("file.uploaded", "Bella’s dress fitting.jpg", { kind: "file", id: "e2e-bella-file" });
  await expect(page.getByRole("status").getByText("Bella uploaded Bella’s dress fitting.jpg")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-file-id="e2e-bella-file"]')).toBeVisible();
  await expect(page.locator("li", { has: page.locator('[data-file-id="e2e-bella-file"]') })).toHaveClass(/\bflash\b/);
});

test("Bella in the same document shows the gold banner; when she deletes it, Greg is told by name", async ({ browser }) => {
  const greg = await openAs(browser, TEST_ACCOUNTS[0], "/new/documents/sangjit");
  const bella = await openAs(browser, TEST_ACCOUNTS[1], "/new/documents/sangjit");
  await expect(greg.getByLabel("Title")).toHaveValue("Sangjit checklist", { timeout: COMPILE_TIMEOUT });
  await expect(bella.getByLabel("Title")).toHaveValue("Sangjit checklist", { timeout: COMPILE_TIMEOUT });
  await expect(greg.getByText("Bella is also in this document. Their changes appear as they type.")).toBeVisible({ timeout: 30_000 });
  await expect(bella.getByText("Greg is also in this document.")).toBeVisible({ timeout: 30_000 });

  await bella.getByRole("button", { name: "Delete this document" }).click();
  await bella.getByRole("dialog").getByRole("button", { name: "Delete for good" }).click();
  await expect(bella.getByRole("heading", { name: "Document deleted", level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(greg.getByRole("heading", { name: "This document was deleted", level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(greg.getByText("Bella deleted it on another device. It can’t be brought back.")).toBeVisible();
});
