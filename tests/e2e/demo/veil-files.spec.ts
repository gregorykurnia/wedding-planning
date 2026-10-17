import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.10: file tiles, the upload sheet and the pipeline, on the gallery's
// stand-in. Nothing is sent anywhere: the stand-in sends in steps, can be made
// to fail, and shrinks a PDF to about half.

const MB = 1_048_576;

async function openDemo(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery");
  await expect(page.getByRole("group", { name: "Files on a record" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

const tiles = (page: Page) => page.getByRole("group", { name: "Files on a record" });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Upload files" });

async function setSwitch(page: Page, name: string, on: boolean) {
  // The fields demo (3.4) has a switch of the same name, so stay inside this task's section.
  await page
    .getByRole("region", { name: /Task 3\.10/ })
    .getByRole("group", { name: "Demo switches" })
    .getByLabel(name)
    .setChecked(on);
}

async function openSheet(page: Page) {
  await tiles(page).getByRole("button", { name: /Add files/ }).click();
  await expect(sheet(page)).toBeVisible();
}

const pick = (page: Page, files: { name: string; mimeType: string; buffer: Buffer }[]) =>
  sheet(page).locator('input[type="file"]').setInputFiles(files);

const small = (name: string, mimeType = "application/pdf") => ({ name, mimeType, buffer: Buffer.from("x") });

test("a record's tiles show each file's name and size, where it came from, and the Add files tile", async ({ page }) => {
  await openDemo(page);
  const grid = tiles(page);
  await expect(grid.getByText("Quote from the florist.pdf")).toBeVisible();
  await expect(grid.getByText("2,4 MB", { exact: true })).toBeVisible();
  await expect(grid.getByText("310 KB")).toBeVisible();
  await expect(grid.getByText("1,1 MB, from the vendor")).toBeVisible();
  await expect(grid.getByText("pdf", { exact: true }).first()).toBeVisible();
  await expect(grid.getByRole("button", { name: /Add files/ })).toContainText("Quotes, contracts, photos. Up to 10 MB each; big PDFs are shrunk for you.");
  // A long name wraps inside its tile.
  const long = grid.getByText(/A name that goes on and on/);
  const box = await long.boundingBox();
  const tile = await long.locator("xpath=ancestor::li[1]").boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(tile!.x + tile!.width + 1);
});

test("every state shows on its tile: shrinking, uploading, too large and failed with Try again", async ({ page }) => {
  await openDemo(page);
  await setSwitch(page, "Slow uploads", false);
  await page.getByRole("button", { name: "Add one of every state" }).click();
  const grid = tiles(page);
  await expect(grid.getByText("Shrinking from 14,2 MB to fit under 10 MB")).toBeVisible();
  await expect(grid.getByText("Uploading, 1,3 of 2,1 MB")).toBeVisible();
  await expect(grid.getByText("Too large: 48 MB. Files can be up to 10 MB; only PDFs are shrunk.")).toBeVisible();
  await expect(grid.getByText(/^Upload failed\./)).toBeVisible();
  await expect(grid.getByRole("button", { name: "Try again" })).toBeVisible();
  // The running ones have a bar, the refused and failed ones don't.
  await expect(grid.getByRole("progressbar")).toHaveCount(2);
  await expect(grid.getByRole("progressbar", { name: /Transfer receipt hold.jpg/ })).toHaveAttribute("aria-valuenow", "62");
});

test("the sheet names where files go, takes several files, and each uploads with its own status", async ({ page }) => {
  await openDemo(page);
  await openSheet(page);
  const dialog = sheet(page);
  await expect(dialog).toContainText("Into Files › Vendors › Kebun Bunga Atelier");
  await expect(dialog).toContainText("up to 10 MB each. Bigger PDFs are shrunk to fit.");
  await expect(dialog.getByText("Drop files here")).toBeVisible();

  await pick(page, [small("Quote.pdf"), small("Photo.jpg", "image/jpeg")]);
  // Both are under way at once.
  await expect(dialog.getByText(/^Uploading, \d+%$/)).toHaveCount(2);
  await expect(dialog.getByText("Uploaded", { exact: true })).toHaveCount(2, { timeout: 10_000 });
  await expect(dialog.getByLabel("Name for Quote.pdf")).toHaveValue("Quote");
});

test("a name typed while the file uploads is the name it's filed under", async ({ page }) => {
  await openDemo(page);
  await openSheet(page);
  const dialog = sheet(page);
  await pick(page, [small("Quote.pdf")]);
  await dialog.getByLabel("Name for Quote.pdf").fill("Florist quote");
  await dialog.getByLabel("Category for Quote.pdf").fill("Quote");
  await expect(dialog.getByText("Uploaded", { exact: true })).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(tiles(page).getByText("Florist quote.pdf")).toBeVisible();

});

test("a rename after the upload reaches the tile", async ({ page }) => {
  await openDemo(page);
  await setSwitch(page, "Slow uploads", false);
  await openSheet(page);
  const dialog = sheet(page);
  await pick(page, [small("Receipt.pdf")]);
  await expect(dialog.getByText("Uploaded", { exact: true })).toBeVisible();
  const name = dialog.getByLabel("Name for Receipt.pdf");
  await name.fill("Deposit receipt");
  await name.blur();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(tiles(page).getByText("Deposit receipt.pdf")).toBeVisible();
  await expect(tiles(page).getByText("Receipt.pdf", { exact: true })).toHaveCount(0);
});

test("a big PDF is shrunk and the status says so, and any other big file is refused with the designed words", async ({ page }) => {
  await openDemo(page);
  await openSheet(page);
  const dialog = sheet(page);
  await pick(page, [
    { name: "Signed contract.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(12 * MB) },
    { name: "All photos.zip", mimeType: "application/zip", buffer: Buffer.alloc(11 * MB) },
  ]);
  await expect(dialog.getByText("Shrinking from 12 MB to fit under 10 MB")).toBeVisible();
  await expect(dialog.getByText("Too large: 11 MB. Files can be up to 10 MB; only PDFs are shrunk.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Uploaded, shrunk to 6,6 MB", { exact: true })).toBeVisible({ timeout: 15_000 });
  // A refused file has no name fields and no Try again.
  await expect(dialog.getByLabel("Name for All photos.zip")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Try again" })).toHaveCount(0);
});

test("a PDF that is still over the limit after shrinking is refused with its own words", async ({ page }) => {
  await openDemo(page);
  await setSwitch(page, "A shrunk PDF stays over the limit", true);
  await openSheet(page);
  await pick(page, [{ name: "Huge.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(12 * MB) }]);
  await expect(sheet(page).getByText(
      "Shrunk from 12 MB to 10,5 MB, still over 10 MB. Shrinking wasn’t enough, so it wasn’t uploaded. Choose a smaller PDF, or split it into parts.",
      { exact: true },
    )).toBeVisible({
    timeout: 15_000,
  });
});

test("a failed upload offers Try again on that file only, and Try again uploads it", async ({ page }) => {
  await openDemo(page);
  await setSwitch(page, "Slow uploads", false);
  await openSheet(page);
  const dialog = sheet(page);
  // A name with "fail" fails its first attempt only.
  await pick(page, [small("Invoice fail.pdf")]);
  await expect(dialog.getByText(/^Upload failed\./)).toBeVisible();
  await expect(dialog.getByLabel("Name for Invoice fail.pdf")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByText("Uploaded", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Name for Invoice fail.pdf")).toHaveValue("Invoice fail");
});

test("one failure doesn't stop the other file", async ({ page }) => {
  await openDemo(page);
  await setSwitch(page, "Slow uploads", false);
  await openSheet(page);
  const dialog = sheet(page);
  await pick(page, [small("Fine.pdf"), small("Broken fail.pdf")]);
  await expect(dialog.getByText("Uploaded", { exact: true })).toHaveCount(1);
  await expect(dialog.getByText(/^Upload failed\./)).toHaveCount(1);
});

test("demonstration mode opens the sheet and refuses each file with its own line", async ({ page }) => {
  await openDemo(page);
  await setSwitch(page, "Demonstration mode", true);
  await openSheet(page);
  const dialog = sheet(page);
  await expect(dialog.getByText("Demonstration mode: uploading is turned off.")).toBeVisible();
  await pick(page, [small("Quote.pdf")]);
  await expect(dialog.getByText("Not uploaded: demonstration mode", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Name for Quote.pdf")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Done" }).click();
  // The refused file stays on the record as a rose tile saying so; it isn't one of the record's files.
  await expect(tiles(page).getByText("Not uploaded: demonstration mode", { exact: true })).toBeVisible();
  await expect(tiles(page).getByRole("progressbar")).toHaveCount(0);
});

test("dragging over the drop zone turns it rose-washed, and dropping files queues them", async ({ page }) => {
  await openDemo(page);
  await setSwitch(page, "Slow uploads", false);
  await openSheet(page);
  const zone = sheet(page).getByText("Drop files here").locator("xpath=..");
  await zone.dispatchEvent("dragover");
  await expect(zone).toHaveClass(/over/);
  const data = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["x"], "Dropped.pdf", { type: "application/pdf" }));
    return transfer;
  });
  await zone.dispatchEvent("drop", { dataTransfer: data });
  await expect(zone).not.toHaveClass(/over/);
  await expect(sheet(page).getByLabel("Name for Dropped.pdf")).toBeVisible();
});

test("uploads carry on after Done and show on the tiles", async ({ page }) => {
  await openDemo(page);
  await openSheet(page);
  await pick(page, [small("Slow one.pdf")]);
  await sheet(page).getByRole("button", { name: "Done" }).click();
  await expect(tiles(page).getByText("Slow one.pdf")).toBeVisible();
  await expect(tiles(page).getByText(/Uploading, /)).toBeVisible();
  await expect(tiles(page).getByText("Slow one.pdf")).toBeVisible({ timeout: 10_000 });
  await expect(tiles(page).getByText(/Uploading, /)).toHaveCount(0, { timeout: 10_000 });
});

test("the sheet is keyboard-reachable and Escape closes it", async ({ page }) => {
  await openDemo(page);
  await openSheet(page);
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
});
