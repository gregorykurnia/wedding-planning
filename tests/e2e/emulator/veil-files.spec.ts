import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, TEST_ACCOUNTS, TEST_PORTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.10: the real pipeline on the gallery page, against the Firebase
// emulators. Every request to Cloudinary is answered here; nothing leaves the
// machine. The page uploads for a vendor called "Kebun Bunga Atelier".

const MB = 1_048_576;
const DOCS = `http://127.0.0.1:${TEST_PORTS.firestore}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const OWNER = { Authorization: "Bearer owner" };
const VENDOR = "gallery-vendor";

type Value = Record<string, unknown>;

/** Firestore's typed JSON, as plain values. */
function plain(value: Value): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (((value.arrayValue as Value).values as Value[]) ?? []).map(plain);
  if ("mapValue" in value) return fields(((value.mapValue as Value).fields as Record<string, Value>) ?? {});
  return value.timestampValue ?? null;
}
const fields = (raw: Record<string, Value>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, plain(v)]));

async function list(collection: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${DOCS}/${collection}?pageSize=100`, { headers: OWNER });
  const body = (await response.json()) as { documents?: { name: string; fields?: Record<string, Value> }[] };
  return (body.documents ?? []).map((d) => ({ id: d.name.split("/").at(-1), ...fields(d.fields ?? {}) }));
}

async function clear() {
  for (const collection of ["weddingFiles", "fileFolders", "vendors"]) {
    for (const doc of await list(collection)) await fetch(`${DOCS}/${collection}/${doc.id}`, { method: "DELETE", headers: OWNER });
  }
  await fetch(`${DOCS}/vendors/${VENDOR}`, {
    method: "PATCH",
    headers: { ...OWNER, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        name: { stringValue: "Kebun Bunga Atelier" },
        files: { arrayValue: { values: [] } },
      },
    }),
  });
}

test.beforeEach(clear);
test.afterAll(clear);

const stub = (page: Page, seen: { size: number }[] = []) =>
  page.route("https://api.cloudinary.com/**", async (route) => {
    seen.push({ size: route.request().postDataBuffer()?.length ?? 0 });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        public_id: `test-upload/file-${seen.length}`,
        secure_url: `https://res.cloudinary.com/test-cloud/raw/upload/v1/test-upload/file-${seen.length}.pdf`,
        resource_type: "raw",
        format: "pdf",
        bytes: 24,
      }),
    });
  });

async function openGallery(page: Page) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery");
  await expect(page.getByRole("group", { name: "Files on a record" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText(/Uploading to: the emulator/)).toBeVisible();
}

const tiles = (page: Page) => page.getByRole("group", { name: "Files on a record" });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Upload files" });

async function openSheet(page: Page) {
  await tiles(page).getByRole("button", { name: /Add files/ }).click();
  await expect(sheet(page)).toBeVisible();
}

const pdf = (name: string, bytes = 1) => ({ name, mimeType: "application/pdf", buffer: Buffer.alloc(bytes, "x") });

test("an upload is filed in the record's folder, with the typed fields, and shows on the tiles after a reload", async ({ page }) => {
  const seen: { size: number }[] = [];
  await stub(page, seen);
  await openGallery(page);
  await openSheet(page);
  const dialog = sheet(page);
  await dialog.locator('input[type="file"]').setInputFiles(pdf("Quote.pdf", 100));
  await expect(dialog.getByText("Uploaded", { exact: true })).toBeVisible();
  const name = dialog.getByLabel("Name for Quote.pdf");
  await name.fill("Florist quote");
  await dialog.getByLabel("Category for Quote.pdf").fill("Quote");
  await dialog.getByLabel("Description for Quote.pdf").fill("First round");
  await dialog.getByLabel("Description for Quote.pdf").blur();
  expect(seen).toHaveLength(1);

  await expect.poll(async () => (await list("weddingFiles"))[0]?.description).toBe("First round");
  const [file] = await list("weddingFiles");
  const folders = await list("fileFolders");
  const root = folders.find((f) => f.name === "Vendors");
  const own = folders.find((f) => f.name === "Kebun Bunga Atelier");
  expect(folders).toHaveLength(2);
  expect(root).toMatchObject({ parentId: null });
  expect(own).toMatchObject({ parentId: root!.id, recordRef: { kind: "vendor", id: VENDOR } });
  expect(file).toMatchObject({
    name: "Florist quote.pdf",
    category: "Quote",
    originalFilename: "Quote.pdf",
    fileType: "application/pdf",
    recordRef: { kind: "vendor", id: VENDOR },
    folderId: own!.id,
    url: "https://res.cloudinary.com/test-cloud/raw/upload/v1/test-upload/file-1.pdf",
  });
  // The record's old list has it too, for the frozen old UI, under the name it had when it was uploaded.
  const vendor = (await list("vendors")).find((v) => v.id === VENDOR);
  expect(vendor?.files).toEqual([{ id: file.id, name: "Quote.pdf", url: file.url }]);

  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(tiles(page).getByText("Florist quote.pdf")).toBeVisible();
  await page.reload();
  await expect(tiles(page).getByText("Florist quote.pdf")).toBeVisible({ timeout: COMPILE_TIMEOUT });
});

test("a description typed after the upload saves when Escape closes the sheet (P3-S9)", async ({ page }) => {
  await stub(page);
  await openGallery(page);
  await openSheet(page);
  const dialog = sheet(page);
  await dialog.locator('input[type="file"]').setInputFiles(pdf("Quote.pdf"));
  await expect(dialog.getByText("Uploaded", { exact: true })).toBeVisible();
  await expect.poll(async () => (await list("weddingFiles")).length).toBe(1);
  await dialog.getByLabel("Description for Quote.pdf").fill("Typed, then Escape");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await list("weddingFiles"))[0]?.description).toBe("Typed, then Escape");
});

test("two files uploaded together share one folder", async ({ page }) => {
  await stub(page);
  await openGallery(page);
  await openSheet(page);
  await sheet(page).locator('input[type="file"]').setInputFiles([pdf("A.pdf"), pdf("B.pdf")]);
  await expect(sheet(page).getByText("Uploaded", { exact: true })).toHaveCount(2);
  await expect.poll(async () => (await list("weddingFiles")).length).toBe(2);
  const [a, b] = await list("weddingFiles");
  expect(a.folderId).toBe(b.folderId);
  expect(await list("fileFolders")).toHaveLength(2);
  // Both landed on the record's old list, though they were added at the same moment.
  await expect.poll(async () => ((await list("vendors")).find((v) => v.id === VENDOR)?.files as unknown[]).length).toBe(2);
});

test("a failed request leaves nothing behind, and Try again files it once", async ({ page }) => {
  let calls = 0;
  await page.route("https://api.cloudinary.com/**", async (route) => {
    if (calls++ === 0) return route.abort("failed");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ public_id: "p", secure_url: "https://res.cloudinary.com/test-cloud/raw/upload/v1/p.pdf", resource_type: "raw", format: "pdf", bytes: 24 }),
    });
  });
  await openGallery(page);
  await openSheet(page);
  const dialog = sheet(page);
  await dialog.locator('input[type="file"]').setInputFiles(pdf("Invoice.pdf"));
  await expect(dialog.getByText(/^Upload failed\./)).toBeVisible();
  expect(await list("weddingFiles")).toHaveLength(0);
  expect(await list("fileFolders")).toHaveLength(0);

  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByText("Uploaded", { exact: true })).toBeVisible();
  await expect.poll(async () => (await list("weddingFiles")).length).toBe(1);
  expect(calls).toBe(2);
});

test("a big file that isn't a PDF is refused and never sent", async ({ page }) => {
  const seen: { size: number }[] = [];
  await stub(page, seen);
  await openGallery(page);
  await openSheet(page);
  await sheet(page)
    .locator('input[type="file"]')
    .setInputFiles({ name: "All photos.zip", mimeType: "application/zip", buffer: Buffer.alloc(11 * MB) });
  await expect(sheet(page).getByText("Too large: 11 MB. Files can be up to 10 MB; only PDFs are shrunk.", { exact: true })).toBeVisible();
  expect(seen).toHaveLength(0);
  expect(await list("weddingFiles")).toHaveLength(0);
});

/** A one-page PDF whose page content is padded with comments until it is `bytes` long. */
function bigPdf(bytes: number): Buffer {
  const header = "%PDF-1.4\n";
  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  );
  const text = "BT /F1 24 Tf 40 150 Td (Signed contract) Tj ET\n";
  const padding = `% ${"x".repeat(78)}\n`.repeat(Math.ceil(bytes / 81));
  const content = text + padding;
  objects.push(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  let body = header;
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

test("a PDF over 10 MB is really shrunk in the browser, and the smaller file is what is sent", async ({ page }) => {
  test.setTimeout(120_000);
  const seen: { size: number }[] = [];
  await stub(page, seen);
  await openGallery(page);
  await openSheet(page);
  const dialog = sheet(page);
  const original = bigPdf(11 * MB);
  expect(original.length).toBeGreaterThan(10 * MB);
  await dialog.locator('input[type="file"]').setInputFiles({ name: "Signed contract.pdf", mimeType: "application/pdf", buffer: original });
  await expect(dialog.getByText(/^Shrinking from 11 MB to fit under 10 MB$|^Shrinking from 11,\d MB to fit under 10 MB$/)).toBeVisible();
  await expect(dialog.getByText(/^Uploaded, shrunk to /)).toBeVisible({ timeout: 90_000 });
  expect(seen).toHaveLength(1);
  expect(seen[0].size).toBeGreaterThan(0);
  expect(seen[0].size).toBeLessThan(10 * MB);
  await expect.poll(async () => (await list("weddingFiles")).length).toBe(1);
});
