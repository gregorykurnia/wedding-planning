import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";
import { restorePairing } from "../seed";

// Task 4.19: the Files screen at /new/documents/files, against the emulators (guide §5.18, R8–R14).
// Folders and files are written as the emulator's owner (which skips the rules); the screen reads them
// live. Deleting a file for good goes through the server, so only its question is tested here.

const DOCUMENTS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Value = string | number | null | Date;

function encode(value: Value): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  return { timestampValue: value.toISOString() };
}

async function put(collection: string, id: string, fields: Record<string, Value>) {
  const res = await fetch(`${DOCUMENTS}/${collection}/${id}`, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, encode(v)])) }),
  });
  expect(res.ok).toBe(true);
}

const DAY = 86_400_000;
const PICTURE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"></svg>')}`;

const folder = (name: string, parentId: string | null) => ({ name, parentId });
const stored = (
  name: string,
  folderId: string | null,
  daysAgo: number,
  extra: Record<string, Value> = {},
): Record<string, Value> => ({
  name,
  folderId,
  category: "",
  description: "",
  url: "https://example.com/" + encodeURIComponent(name),
  fileType: name.endsWith(".jpg") ? "image/jpeg" : "application/pdf",
  fileSize: 1_048_576,
  createdAt: new Date(Date.now() - daysAgo * DAY),
  ...extra,
});

// This spec empties Firestore, so the specs after it get the accounts paired again.
test.afterAll(restorePairing);

test.beforeEach(async () => {
  const res = await fetch(`${DOCUMENTS.replace("/v1/", "/emulator/v1/")}`, { method: "DELETE" });
  expect(res.ok).toBe(true);
  await put("settings", "wedding", { yourName: "Greg", partnerName: "Bella", partnerEmail: TEST_ACCOUNTS[1].email });
  await put("fileFolders", "vendors", folder("Vendors", null));
  await put("fileFolders", "catering", folder("Catering", "vendors"));
  await put("fileFolders", "old", folder("Old quotes", "catering"));
  await put("fileFolders", "venue", folder("Venue", null));
  await put("fileFolders", "legal", folder("Legal and church", null));
  await put("fileFolders", "rings", folder("Rings", null));
  await put(
    "weddingFiles",
    "f1",
    stored("Villa Samaya contract.pdf", "venue", 40, { category: "Contract", description: "Signed by both of us", fileSize: 2_516_582 }),
  );
  await put("weddingFiles", "f2", stored("Deposit receipt.jpg", "venue", 30, { url: PICTURE, category: "Receipt" }));
  await put("weddingFiles", "f3", stored("Catering quote.pdf", "catering", 20));
  await put("weddingFiles", "f4", stored("Guest list draft.xlsx", null, 5, { category: "Guest list", description: "First pass" }));
  await put("weddingFiles", "f5", stored("Rasa Nusantara quote.pdf", "old", 60));
});

async function open(page: Page, path = "/new/documents/files") {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

const sheet = (page: Page) => page.getByRole("dialog");

test("the top level shows the folders, then the files, with their counts", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { name: "Files", level: 1 })).toBeVisible();
  await expect(page.getByText(/^5 files, .+ in all$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Files", exact: true }).first()).toHaveAttribute("aria-current", "page");

  await expect(page.getByRole("heading", { name: "Folders", level: 2 })).toBeVisible();
  const folders = page.getByRole("list", { name: "Folders" }).getByRole("link");
  await expect(folders).toHaveCount(4);
  await expect(page.locator('[data-folder-id="vendors"]')).toContainText("1 folder");
  await expect(page.locator('[data-folder-id="venue"]')).toContainText("2 files");
  await expect(page.locator('[data-folder-id="rings"]')).toContainText("Empty");

  await expect(page.getByRole("heading", { name: /^Files newest first$/, level: 2 })).toBeVisible();
  await expect(page.locator('[data-file-id="f4"]')).toContainText("Guest list draft.xlsx");
  await expect(page.getByRole("button", { name: "Upload files" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New folder" })).toBeVisible();
});

test("a folder shows its path, its counts and its own actions", async ({ page }) => {
  await open(page);
  await page.locator('[data-folder-id="vendors"]').click();
  await expect(page).toHaveURL(/\?folder=vendors$/);
  await page.locator('[data-folder-id="catering"]').click();

  await expect(page.getByRole("heading", { name: "Catering", level: 1 })).toBeVisible();
  await expect(page.getByText("1 folder, 1 file", { exact: true })).toBeVisible();
  const trail = page.getByRole("navigation", { name: "Where you are" });
  await expect(trail).toContainText("Files");
  await expect(trail.getByRole("link", { name: "Vendors" })).toBeVisible();
  for (const name of ["Rename", "Move", "Delete folder"]) await expect(page.getByRole("button", { name })).toBeVisible();
  await expect(page.locator('[data-file-id="f3"]')).toBeVisible();

  await trail.getByRole("link", { name: "Files" }).click();
  await expect(page.getByRole("heading", { name: "Files", level: 1 })).toBeVisible();
});

test("the search looks in every folder, by name and description", async ({ page }) => {
  await open(page);
  await page.getByRole("searchbox", { name: "Find a file" }).fill("signed");
  await expect(page.getByText("1 file in all folders")).toBeVisible();
  await expect(page.locator('[data-file-id="f1"]')).toContainText("in Venue");

  await page.getByRole("searchbox", { name: "Find a file" }).fill("passport");
  await expect(page.getByRole("heading", { name: "No files match “passport”" })).toBeVisible();
  await expect(page.getByText("The search looks at every folder, by file name and description.")).toBeVisible();
  await page.getByRole("button", { name: "Clear the search" }).click();
  await expect(page.getByRole("heading", { name: "Folders", level: 2 })).toBeVisible();
});

test("a new folder refuses a name already there, and then appears", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "New folder" }).click();
  await expect(sheet(page).getByRole("heading", { name: "New folder" })).toBeVisible();
  await expect(sheet(page).getByText("Inside Files")).toBeVisible();

  await sheet(page).getByLabel("Name").fill("rings");
  await sheet(page).getByLabel("Name").press("Enter");
  await expect(sheet(page).getByText("There’s already a folder called rings here.")).toBeVisible();

  await sheet(page).getByLabel("Name").fill("Flowers");
  await sheet(page).getByLabel("Name").press("Enter");
  await expect(page.getByText("Made Flowers")).toBeVisible();
  await expect(page.getByRole("list", { name: "Folders" }).getByRole("link", { name: /Flowers/ })).toBeVisible();
  await expect(sheet(page)).toHaveCount(0);
});

test("renaming a folder saves, and Undo puts the old name back", async ({ page }) => {
  await open(page, "/new/documents/files?folder=rings");
  await expect(page.getByRole("heading", { name: "This folder is empty", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Rename" }).click();
  await sheet(page).getByLabel("Name").fill("Rings and bands");
  await sheet(page).getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("heading", { name: "Rings and bands", level: 1 })).toBeVisible();
  await expect(page.getByText("Renamed to Rings and bands")).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { name: "Rings", level: 1 })).toBeVisible();
});

test("an empty folder is deleted after a question, and Undo brings it back", async ({ page }) => {
  await open(page, "/new/documents/files?folder=rings");
  await page.getByRole("button", { name: "Delete folder" }).click();
  await expect(sheet(page).getByRole("heading", { name: "Delete Rings?" })).toBeVisible();
  await expect(sheet(page).getByText("The folder is empty. You can undo for a few seconds.")).toBeVisible();
  await sheet(page).getByRole("button", { name: "Delete folder" }).click();

  await expect(page).toHaveURL(/\/new\/documents\/files$/);
  await expect(page.getByText("Deleted Rings")).toBeVisible();
  await expect(page.locator('[data-folder-id="rings"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page).toHaveURL(/\?folder=rings$/);
  await expect(page.getByRole("heading", { name: "Rings", level: 1 })).toBeVisible();
});

test("a folder with things inside can't be deleted: it says what to empty first", async ({ page }) => {
  await open(page, "/new/documents/files?folder=catering");
  await page.getByRole("button", { name: "Delete folder" }).click();
  await expect(sheet(page).getByRole("heading", { name: "Empty Catering first" })).toBeVisible();
  await expect(sheet(page).getByText("It still holds 2 files and 1 folder. Move or delete them, then delete the folder.")).toBeVisible();
  await sheet(page).getByRole("button", { name: "OK" }).click();
  await expect(page.getByRole("heading", { name: "Catering", level: 1 })).toBeVisible();
});

test("a file's sheet shows its details and saves changes as you go, with Undo for a new name", async ({ page }) => {
  await open(page, "/new/documents/files?folder=venue");
  await page.locator('[data-file-id="f1"]').click();
  await expect(sheet(page).getByRole("heading", { name: "Villa Samaya contract.pdf" })).toBeVisible();
  await expect(sheet(page).getByText(/^2,4 MB, added .+, in Files › Venue$/)).toBeVisible();
  await expect(sheet(page).getByLabel("Category")).toHaveValue("Contract");
  await expect(sheet(page).getByLabel("Description")).toHaveValue("Signed by both of us");
  await expect(sheet(page).getByRole("link", { name: "Open" })).toHaveAttribute("href", /example\.com/);
  await expect(sheet(page).getByRole("link", { name: "Open" })).toHaveAttribute("target", "_blank");
  await expect(sheet(page).getByRole("link", { name: "Download" })).toHaveAttribute("download", "");

  await sheet(page).getByLabel("Name").fill("Villa contract, signed.pdf");
  await sheet(page).getByLabel("Name").press("Tab");
  await expect(page.getByText("Renamed to Villa contract, signed.pdf")).toBeVisible();
  await expect(page.locator('[data-file-id="f1"]')).toContainText("Villa contract, signed.pdf");

  await sheet(page).getByLabel("Description").fill("Both signed, final payment 15 January");
  await sheet(page).getByLabel("Description").press("Tab");
  await expect(sheet(page).getByText("Saved")).toBeVisible();
  await sheet(page).getByRole("button", { name: "Done" }).click();
  await expect(page.locator('[data-file-id="f1"]')).toContainText("Both signed, final payment 15 January");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator('[data-file-id="f1"]')).toContainText("Villa Samaya contract.pdf");
});

test("moving a file shows where it is, disables where it already is, and Undo moves it back", async ({ page }) => {
  await open(page, "/new/documents/files?folder=venue");
  await page.locator('[data-file-id="f2"]').click();
  await sheet(page).getByRole("button", { name: "Move" }).click();

  await expect(sheet(page).getByRole("heading", { name: "Move Deposit receipt.jpg" })).toBeVisible();
  await expect(sheet(page).getByText("Now in Files › Venue.")).toBeVisible();
  await expect(sheet(page).getByRole("radio", { name: /^Venue \(it's here now\)$/ })).toBeDisabled();
  await expect(sheet(page).getByRole("button", { name: "Move here" })).toBeDisabled();

  await sheet(page).getByRole("radio", { name: /^Legal and church$/ }).check();
  await sheet(page).getByRole("button", { name: "Move here" }).click();
  await expect(page.getByText("Moved to Files › Legal and church")).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Moved to Files › Legal and church")).toHaveCount(0);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator('[data-file-id="f2"]')).toBeVisible();
});

test("Undo after Bella moved the same file again changes nothing and says where it is now (N13)", async ({ page }) => {
  await open(page, "/new/documents/files?folder=venue");
  await page.locator('[data-file-id="f2"]').click();
  await sheet(page).getByRole("button", { name: "Move" }).click();
  await sheet(page).getByRole("radio", { name: /^Legal and church$/ }).check();
  await sheet(page).getByRole("button", { name: "Move here" }).click();
  await expect(page.getByText("Moved to Files › Legal and church")).toBeVisible();

  // Bella moves it again, to Catering, before Greg taps Undo.
  await put("weddingFiles", "f2", stored("Deposit receipt.jpg", "catering", 30, { url: PICTURE, category: "Receipt" }));
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByText("Can’t move it back: Bella has since moved Deposit receipt.jpg to Files › Vendors › Catering. It stays there."),
  ).toBeVisible();
});

test("Undo after Bella deleted the old folder says so and goes, and the file stays (P5-S9)", async ({ page }) => {
  await open(page, "/new/documents/files?folder=venue");
  await page.locator('[data-file-id="f2"]').click();
  await sheet(page).getByRole("button", { name: "Move" }).click();
  await sheet(page).getByRole("radio", { name: /^Legal and church$/ }).check();
  await sheet(page).getByRole("button", { name: "Move here" }).click();
  await expect(page.getByText("Moved to Files › Legal and church")).toBeVisible();

  // Bella deletes Venue, now empty of this file, before Greg taps Undo.
  await fetch(`${DOCUMENTS}/fileFolders/venue`, { method: "DELETE", headers: ADMIN });
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByText("Can’t move Deposit receipt.jpg back: that folder isn’t there any more. It stays where it is now."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
});

test("moving a folder takes everything inside it, and can't go inside itself", async ({ page }) => {
  await open(page, "/new/documents/files?folder=catering");
  await page.getByRole("button", { name: "Move" }).click();
  await expect(sheet(page).getByRole("heading", { name: "Move Catering" })).toBeVisible();
  await expect(sheet(page).getByText("With everything inside it: 2 files and 1 folder.")).toBeVisible();
  await expect(sheet(page).getByRole("radio", { name: /^Catering \(this folder\)$/ })).toBeDisabled();
  await expect(sheet(page).getByRole("radio", { name: /^Old quotes \(inside it\)$/ })).toBeDisabled();
  await expect(sheet(page).getByRole("radio", { name: /^Vendors \(it's here now\)$/ })).toBeDisabled();

  await sheet(page).getByRole("radio", { name: /^Venue$/ }).check();
  await sheet(page).getByRole("button", { name: "Move here" }).click();
  await expect(page.getByText("Moved to Files › Venue")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Catering", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Where you are" })).toContainText("Venue");
});

test("Delete for good asks first, says it can't be undone, and Keep it leaves the file", async ({ page }) => {
  await open(page);
  await page.locator('[data-file-id="f4"]').click();
  await sheet(page).getByRole("button", { name: "Delete for good" }).click();
  await expect(sheet(page).getByRole("heading", { name: "Delete Guest list draft.xlsx?" })).toBeVisible();
  await expect(sheet(page).getByText("It’s removed from storage for good, freeing 1 MB. It can’t be brought back.")).toBeVisible();
  await sheet(page).getByRole("button", { name: "Keep it" }).click();
  await expect(sheet(page).getByRole("heading", { name: "Guest list draft.xlsx" })).toBeVisible();
});

test("a file's own link opens its sheet on arrival", async ({ page }) => {
  await open(page, "/new/documents/files?folder=venue&file=f1");
  await expect(sheet(page).getByRole("heading", { name: "Villa Samaya contract.pdf" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
});

test("the upload sheet files into the folder you are in", async ({ page }) => {
  await open(page, "/new/documents/files?folder=catering");
  await page.getByRole("button", { name: "Upload files" }).click();
  await expect(sheet(page).getByText(/^Into Files › Vendors › Catering\./)).toBeVisible();
});
