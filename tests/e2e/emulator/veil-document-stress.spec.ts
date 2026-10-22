import { expect, test, type Page } from "@playwright/test";
import { loadFixture } from "../../fixtures/load";
import { TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";
import { seed } from "../seed";

// Task 5.4: Documents, a document and Files on the "stress" fixture set (guide §5.16 to §5.18):
// 1.504 documents, 3.006 files, 72 folders, a title with no spaces, a table 50 rows long, folders 30
// levels down. The app server runs with NEXT_PUBLIC_VEIL_DEV=1 (playwright.config.ts).

// The set stays in Firestore, so the emulators are cleaned for the specs after this one.
test.beforeAll(async () => {
  // Thousands of records go into the emulator one by one, which takes a few minutes.
  test.setTimeout(480_000);
  await loadFixture("stress");
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

/** Whether the page itself scrolls sideways, which only a table's own scroller may do. */
const pageScrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

test("a long list shows 60 documents at a time, and the count says how many there are in all", async ({ page }) => {
  await open(page, "/documents");
  await expect(page.getByText(/^1[.,]504 documents, newest first$/)).toBeVisible({ timeout: COMPILE_TIMEOUT });
  const rows = page.getByRole("list", { name: "Documents" }).getByRole("listitem");
  await expect(rows).toHaveCount(60);
  await page.getByRole("button", { name: "Show 60 more" }).click();
  await expect(rows).toHaveCount(120);
});

test("on a phone, a title with no spaces and non-Latin titles don't push the list sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/documents");
  await expect(page.getByText(/^1[.,]504 documents, newest first$/)).toBeVisible({ timeout: COMPILE_TIMEOUT });
  expect(await pageScrollsSideways(page)).toBe(false);
  await page.getByRole("searchbox", { name: "Search documents" }).fill("RencanaLengkap");
  await expect(page.getByText("RencanaLengkapPernikahanDanResepsiKeluargaBesarWijayakusumaningratDanSetyaningsih2027").first()).toBeVisible();
  expect(await pageScrollsSideways(page)).toBe(false);
});

test("a long document opens with its unbroken title and a wide table that scrolls inside itself, on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/documents/s-long");
  await expect(page.getByLabel("Title")).toHaveValue(/^RencanaLengkap/, { timeout: COMPILE_TIMEOUT });
  const table = page.getByRole("textbox", { name: "Document" }).locator("table").first();
  await expect(table).toBeVisible();
  expect(await pageScrollsSideways(page)).toBe(false);
  // Some ancestor of the table is the one that scrolls sideways.
  const scrolls = await table.evaluate((el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowX;
      if ((overflow === "auto" || overflow === "scroll") && node.scrollWidth > node.clientWidth) return true;
    }
    return false;
  });
  expect(scrolls).toBe(true);
});

test("non-Latin titles open in their own direction", async ({ page }) => {
  await open(page, "/documents/s-ar");
  await expect(page.getByLabel("Title")).toHaveValue("قائمة الضيوف من عائلة العروس", { timeout: COMPILE_TIMEOUT });
  await page.goto("/documents/s-empty");
  await expect(page.getByLabel("Title")).toHaveValue("", { timeout: COMPILE_TIMEOUT });
});

test("searching 3.000 photos shows 200 at a time, and says how many there are in all", async ({ page }) => {
  await open(page, "/documents/files");
  await page.getByRole("searchbox", { name: "Find a file" }).fill("DSC");
  await expect(page.getByText(/^3[.,]000 files in all folders, showing 200$/)).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.getByRole("button", { name: "Show 200 more" }).click();
  await expect(page.getByText(/^3[.,]000 files in all folders, showing 400$/)).toBeVisible();
});

test("a folder 30 levels down folds the middle of its path, and the dots open it", async ({ page }) => {
  await open(page, "/documents/files?folder=deep29");
  const trail = page.getByRole("navigation", { name: "Where you are" });
  await expect(trail).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(trail.getByRole("button", { name: "Show the full path" })).toBeVisible();
  const folded = await trail.getByRole("link").count();
  await trail.getByRole("button", { name: "Show the full path" }).click();
  expect(await trail.getByRole("link").count()).toBeGreaterThan(folded);
});
