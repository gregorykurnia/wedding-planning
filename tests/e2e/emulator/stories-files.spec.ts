import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { openAt, put, resetData, restorePairing, stored, storedDoc, type Value } from "../stories";

test.afterEach(closeOtherContexts);
test.afterAll(restorePairing);

// Task 8.1b, stories R8, R11, R12 and R14: folders, a file's sheet, moving a folder and finding a file, by roles
// and labels (guide §5.18, §8). R9, R10 and R13 have their tests in veil-files.spec.ts and the files specs of the
// screens that hold records.

const DAY = 86_400_000;
const folder = (name: string, parentId: string | null): Record<string, Value> => ({ name, parentId });
const file = (name: string, folderId: string | null, daysAgo: number, extra: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  folderId,
  category: "",
  description: "",
  url: `https://example.com/${encodeURIComponent(name)}`,
  fileType: "application/pdf",
  fileSize: 1_048_576,
  createdAt: new Date(Date.now() - daysAgo * DAY),
  ...extra,
});

test.beforeEach(async () => {
  await resetData();
  await put("fileFolders", "vendors", folder("Vendors", null));
  await put("fileFolders", "catering", folder("Catering", "vendors"));
  await put("fileFolders", "venue", folder("Venue", null));
  await put("fileFolders", "legal", folder("Legal and church", null));
  await put("fileFolders", "rings", folder("Rings", null));
  await put("weddingFiles", "f1", file("Villa Samaya contract.pdf", "venue", 40, { category: "Contract", description: "Signed by both of us" }));
  await put("weddingFiles", "f2", file("Deposit receipt.pdf", "venue", 30, { category: "Receipt" }));
  await put("weddingFiles", "f3", file("Catering quote.pdf", "catering", 20));
  await put("weddingFiles", "f4", file("Guest list draft.pdf", null, 5));
});

const dialog = (page: Page) => page.getByRole("dialog");
const toasts = (page: Page) => page.getByRole("status");

async function openFiles(page: Page, path = "/documents/files") {
  await openAt(page, path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("R8 folders: make one, open it by its path, rename it with Undo, and delete it only when it is empty", async ({ page }) => {
  await openFiles(page);
  await expect(page.getByRole("heading", { name: "Files", level: 1 })).toBeVisible();

  // A new folder refuses a name already there.
  await page.getByRole("button", { name: "New folder" }).click();
  await dialog(page).getByLabel("Name").fill("rings");
  await dialog(page).getByLabel("Name").press("Enter");
  await expect(dialog(page).getByText("There’s already a folder called rings here.")).toBeVisible();
  await dialog(page).getByLabel("Name").fill("Flowers");
  await dialog(page).getByLabel("Name").press("Enter");
  await expect(toasts(page).getByText("Made Flowers")).toBeVisible();
  await expect.poll(async () => (await stored("fileFolders")).some((f) => f.name === "Flowers" && f.parentId === null)).toBe(true);

  // A nested folder shows where it is, and the way back.
  await page.locator('[data-folder-id="vendors"]').click();
  await page.locator('[data-folder-id="catering"]').click();
  await expect(page.getByRole("heading", { name: "Catering", level: 1 })).toBeVisible();
  const trail = page.getByRole("navigation", { name: "Where you are" });
  await expect(trail.getByRole("link", { name: "Vendors" })).toBeVisible();

  // A folder with things inside can't be deleted, and says what to empty first.
  await page.getByRole("button", { name: "Delete folder" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Empty Catering first" })).toBeVisible();
  await dialog(page).getByRole("button", { name: "OK" }).click();

  // An empty one is renamed with Undo, then deleted after a question, with Undo.
  await page.goto("/documents/files?folder=rings");
  await expect(page.getByRole("heading", { name: "This folder is empty", level: 2 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.getByRole("button", { name: "Rename" }).click();
  await dialog(page).getByLabel("Name").fill("Rings and bands");
  await dialog(page).getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("heading", { name: "Rings and bands", level: 1 })).toBeVisible();
  await expect.poll(async () => (await storedDoc("fileFolders", "rings"))?.name).toBe("Rings and bands");
  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await storedDoc("fileFolders", "rings"))?.name).toBe("Rings");

  await page.getByRole("button", { name: "Delete folder" }).click();
  await dialog(page).getByRole("button", { name: "Delete folder" }).click();
  await expect(toasts(page).getByText("Deleted Rings")).toBeVisible();
  await expect.poll(async () => await storedDoc("fileFolders", "rings")).toBeNull();
  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await storedDoc("fileFolders", "rings"))?.name).toBe("Rings");
});

test("R11 open, download, move, edit, delete: a file's sheet links to it, saves as you go, moves with Undo, and Delete for good asks first", async ({ page }) => {
  await openFiles(page, "/documents/files?folder=venue");
  await page.locator('[data-file-id="f1"]').click();
  await expect(dialog(page).getByRole("heading", { name: "Villa Samaya contract.pdf" })).toBeVisible();
  await expect(dialog(page).getByRole("link", { name: "Open" })).toHaveAttribute("href", /example\.com/);
  await expect(dialog(page).getByRole("link", { name: "Open" })).toHaveAttribute("target", "_blank");
  await expect(dialog(page).getByRole("link", { name: "Download" })).toHaveAttribute("download", "");

  // Edit: each field saves as you leave it.
  await dialog(page).getByLabel("Name").fill("Villa contract, signed.pdf");
  await dialog(page).getByLabel("Name").press("Tab");
  await expect.poll(async () => (await storedDoc("weddingFiles", "f1"))?.name).toBe("Villa contract, signed.pdf");
  await dialog(page).getByLabel("Description").fill("Final payment 15 January");
  await dialog(page).getByLabel("Description").press("Tab");
  await expect.poll(async () => (await storedDoc("weddingFiles", "f1"))?.description).toBe("Final payment 15 January");

  // Move: where it is now can't be picked; Undo moves it back.
  await dialog(page).getByRole("button", { name: "Move" }).click();
  await expect(dialog(page).getByRole("radio", { name: /^Venue \(it's here now\)$/ })).toBeDisabled();
  await dialog(page).getByRole("radio", { name: /^Legal and church$/ }).check();
  await dialog(page).getByRole("button", { name: "Move here" }).click();
  await expect(toasts(page).getByText("Moved to Files › Legal and church")).toBeVisible();
  await expect.poll(async () => (await storedDoc("weddingFiles", "f1"))?.folderId).toBe("legal");
  // The earlier rename's toast may still be up; the move's is the newest.
  await page.getByRole("button", { name: "Undo" }).last().click();
  await expect.poll(async () => (await storedDoc("weddingFiles", "f1"))?.folderId).toBe("venue");

  // Delete for good asks first; Keep it leaves the file.
  await dialog(page).getByRole("button", { name: "Delete for good" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Delete Villa contract, signed.pdf?" })).toBeVisible();
  await expect(dialog(page).getByText(/can’t be brought back\.$/)).toBeVisible();
  await dialog(page).getByRole("button", { name: "Keep it" }).click();
  expect(await storedDoc("weddingFiles", "f1")).toBeTruthy();
});

// Phase 8 review S4: a record's file opens the same sheet as in Files (guide §4.20), so it can be deleted
// for good from the record too; and the tab follows the names in the top bar (guide §4.31, G1).
test("a vendor's file tile opens the file's sheet, and the tab reads the screen and the names", async ({ page }) => {
  // The vendor goes again at the end (`resetData`): the Budget and Bookings specs count every vendor.
  await put("vendors", "v1", { name: "Kebun Bunga Atelier", category: "Decoration", contractStatus: "Considering", files: [], createdAt: new Date() });
  await put("weddingFiles", "f5", file("Kebun quote.pdf", null, 2, { recordRef: { kind: "vendor", id: "v1" } }));
  await openAt(page, "/vendors/v1");
  await expect(page.getByRole("heading", { level: 1, name: "Kebun Bunga Atelier" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveTitle("Vendor · Greg & Bella");

  const tile = page.getByRole("link", { name: /Kebun quote\.pdf/ });
  await expect(tile).toHaveAttribute("href", /example\.com/);
  await tile.click();
  await expect(dialog(page).getByRole("heading", { name: "Kebun quote.pdf" })).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Delete for good" })).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
  await resetData();
});

test("R12 move a folder: it takes everything inside, and can't go inside itself", async ({ page }) => {
  await openFiles(page, "/documents/files?folder=catering");
  await page.getByRole("button", { name: "Move" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Move Catering" })).toBeVisible();
  await expect(dialog(page).getByRole("radio", { name: /^Catering \(this folder\)$/ })).toBeDisabled();

  await dialog(page).getByRole("radio", { name: /^Venue$/ }).check();
  await dialog(page).getByRole("button", { name: "Move here" }).click();
  await expect(toasts(page).getByText("Moved to Files › Venue")).toBeVisible();
  await expect.poll(async () => (await storedDoc("fileFolders", "catering"))?.parentId).toBe("venue");
  await expect(page.getByRole("navigation", { name: "Where you are" })).toContainText("Venue");
  // What was inside is still inside, now under Venue.
  await expect(page.locator('[data-file-id="f3"]')).toBeVisible();
  expect((await storedDoc("weddingFiles", "f3"))?.folderId).toBe("catering");
});

test("R14 find a file anywhere: the search reads every folder by name and description, and Clear brings the folders back", async ({ page }) => {
  await openFiles(page);
  const search = page.getByRole("searchbox", { name: "Find a file" });
  await search.fill("signed");
  await expect(page.getByText("1 file in all folders")).toBeVisible();
  await expect(page.locator('[data-file-id="f1"]')).toContainText("in Venue");

  await search.fill("quote");
  await expect(page.locator('[data-file-id="f3"]')).toContainText("in Vendors › Catering");

  await search.fill("passport");
  await expect(page.getByRole("heading", { name: "No files match “passport”" })).toBeVisible();
  await page.getByRole("button", { name: "Clear the search" }).click();
  await expect(page.getByRole("heading", { name: "Folders", level: 2 })).toBeVisible();
});
