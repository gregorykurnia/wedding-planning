import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.4: Record a payment against the emulators, from the gallery's section
// for it, which lists the emulator's bookings and opens the real sheet with the
// real write and the real upload pipeline. Bookings and funders are written as
// the emulator's owner (which skips the rules); everything else goes through
// the sheet. Every request to Cloudinary is answered here.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Plain = string | number | boolean | null | Plain[] | { [key: string]: Plain };
type Value = Record<string, unknown>;

const typed = (value: Plain): Value =>
  value === null
    ? { nullValue: null }
    : typeof value === "number"
      ? { integerValue: String(value) }
      : typeof value === "boolean"
        ? { booleanValue: value }
        : typeof value === "string"
          ? { stringValue: value }
          : Array.isArray(value)
            ? { arrayValue: { values: value.map(typed) } }
            : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typed(v)])) } };

const untyped = (value: Value): Plain => {
  if ("stringValue" in value) return value.stringValue as string;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("booleanValue" in value) return value.booleanValue as boolean;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (((value.arrayValue as Value).values as Value[]) ?? []).map(untyped);
  if ("mapValue" in value) return fieldsOf(((value.mapValue as Value).fields as Record<string, Value>) ?? {});
  return (value.timestampValue as string) ?? null;
};
const fieldsOf = (raw: Record<string, Value>): { [key: string]: Plain } =>
  Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, untyped(v)]));

async function put(collection: string, id: string, data: Record<string, Plain>) {
  const body = { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typed(v)])) };
  const res = await fetch(`${DOCS}/${collection}/${id}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

async function read(collection: string, id: string): Promise<Record<string, Plain>> {
  const res = await fetch(`${DOCS}/${collection}/${id}`, { headers: ADMIN });
  const body = (await res.json()) as { fields?: Record<string, Value> };
  return fieldsOf(body.fields ?? {});
}

async function list(collection: string): Promise<Record<string, Plain>[]> {
  const res = await fetch(`${DOCS}/${collection}?pageSize=100`, { headers: ADMIN });
  const body = (await res.json()) as { documents?: { name: string; fields?: Record<string, Value> }[] };
  return (body.documents ?? []).map((d) => ({ id: d.name.split("/").at(-1) as string, ...fieldsOf(d.fields ?? {}) }));
}

const SINGLE = "pay-catering";
const PARTS = "pay-villa";
const FUNDERS = ["pay-greg", "pay-family"];

const booked = (name: string, funder: string | null, totalPrice: number, budgetSpent: number, extra: Record<string, Plain> = {}) => ({
  name,
  category: "Other",
  contractStatus: "Chosen",
  funder,
  totalPrice,
  budgetSpent,
  nextTargetDate: "2026-10-30",
  nextAction: "",
  ...extra,
});

const part = (id: string, name: string, totalPrice: number, budgetSpent: number, nextTargetDate: string | null) => ({
  id,
  name,
  funder: "pay-family",
  totalPrice,
  budgetSpent,
  nextTargetDate,
  nextAction: "",
  files: [],
});

async function seed() {
  await put("funders", "pay-greg", { name: "Greg", order: 0 });
  await put("funders", "pay-family", { name: "Bella’s family", order: 1 });
  await put("vendors", SINGLE, booked("Dapur Lestari Catering", "pay-greg", 30_000_000, 10_000_000));
  await put(
    "vendors",
    PARTS,
    booked("Villa Samaya Ubud", "pay-family", 50_000_000, 25_000_000, {
      subEntries: [part("deposit", "Deposit", 25_000_000, 25_000_000, null), part("balance", "Balance", 25_000_000, 0, "2026-10-30")],
    }),
  );
}

async function clear() {
  for (const id of FUNDERS) await fetch(`${DOCS}/funders/${id}`, { method: "DELETE", headers: ADMIN });
  for (const id of [SINGLE, PARTS]) await fetch(`${DOCS}/vendors/${id}`, { method: "DELETE", headers: ADMIN });
  for (const collection of ["weddingFiles", "fileFolders"]) {
    for (const doc of await list(collection)) await fetch(`${DOCS}/${collection}/${doc.id}`, { method: "DELETE", headers: ADMIN });
  }
}

test.beforeEach(async () => {
  await clear();
  await seed();
});
test.afterAll(clear);

const stub = (page: Page) =>
  page.route("https://api.cloudinary.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        public_id: "test-upload/receipt",
        secure_url: "https://res.cloudinary.com/test-cloud/raw/upload/v1/test-upload/receipt.pdf",
        resource_type: "raw",
        format: "pdf",
        bytes: 24,
      }),
    }),
  );

async function openGallery(page: Page) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery");
  const section = page.locator("#section-4-4");
  await expect(section.getByRole("button", { name: "Record payment for Dapur Lestari Catering" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (el) =>
        el.textContent?.trim() === "Record payment for Dapur Lestari Catering" &&
        Object.keys(el).some((key) => key.startsWith("__reactProps")),
    ),
  );
  return section;
}

const dialogOf = (page: Page) => page.getByRole("dialog", { name: "Record a payment" });
const rowOf = (page: Page, name: string) =>
  page.locator("#section-4-4").getByRole("listitem").filter({ hasText: name });
const record = (page: Page) => dialogOf(page).getByRole("button", { name: "Record payment", exact: true });

test("records a payment on a booking: what's paid goes up, and the payment keeps its date, payer and amount", async ({ page }) => {
  const section = await openGallery(page);
  await expect(rowOf(page, "Dapur Lestari Catering")).toContainText("Rp 10.000.000");
  await section.getByRole("button", { name: "Record payment for Dapur Lestari Catering" }).click();

  const dialog = dialogOf(page);
  await expect(dialog.getByLabel("Amount paid")).toHaveValue("Rp 20.000.000");
  await expect(dialog.getByRole("radio", { name: "Greg" })).toHaveAttribute("aria-checked", "true");
  await dialog.getByLabel("Amount paid").fill("5000000");
  await dialog.getByRole("radio", { name: "Bella’s family" }).click();
  await dialog.getByLabel("Paid on").fill("2026-10-01");
  await record(page).click();

  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  const toast = page.getByRole("status").filter({ hasText: "Recorded Rp 5.000.000 for Dapur Lestari Catering" });
  await expect(toast).toBeVisible();
  // The screen's own read moves, with no reload.
  await expect(rowOf(page, "Dapur Lestari Catering")).toContainText("Rp 15.000.000");

  const doc = await read("vendors", SINGLE);
  expect(doc.budgetSpent).toBe(15_000_000);
  expect(doc.payments).toEqual([
    expect.objectContaining({ amount: 5_000_000, paidOn: "2026-10-01", funder: "pay-family", receiptFileId: null }),
  ]);
  // The part of the record that wasn't paid on is untouched.
  expect(doc.totalPrice).toBe(30_000_000);
  expect(doc.funder).toBe("pay-greg");
});

test("Undo takes the payment back out", async ({ page }) => {
  const section = await openGallery(page);
  await section.getByRole("button", { name: "Record payment for Dapur Lestari Catering" }).click();
  await dialogOf(page).getByLabel("Amount paid").fill("5000000");
  await record(page).click();
  const toast = page.getByRole("status").filter({ hasText: "Recorded Rp 5.000.000" });
  await expect(toast).toBeVisible({ timeout: 15_000 });
  await toast.getByRole("button", { name: "Undo" }).click();

  await expect(rowOf(page, "Dapur Lestari Catering")).toContainText("Rp 10.000.000", { timeout: 15_000 });
  await expect.poll(async () => (await read("vendors", SINGLE)).budgetSpent).toBe(10_000_000);
  expect((await read("vendors", SINGLE)).payments).toEqual([]);
});

test("a booking in parts records on the part pressed, and only that part", async ({ page }) => {
  const section = await openGallery(page);
  await section.getByRole("button", { name: "Record payment on Balance" }).click();
  const dialog = dialogOf(page);
  await expect(dialog).toContainText("Villa Samaya Ubud, balance");
  await expect(dialog.getByLabel("Amount paid")).toHaveValue("Rp 25.000.000");
  await expect(dialog.getByRole("radio", { name: "Bella’s family" })).toHaveAttribute("aria-checked", "true");
  await dialog.getByLabel("Amount paid").fill("10000000");
  await record(page).click();

  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  await expect(rowOf(page, "Villa Samaya Ubud")).toContainText("Rp 35.000.000");
  const doc = await read("vendors", PARTS);
  const [deposit, balance] = doc.subEntries as { id: string; budgetSpent: number; payments?: unknown[] }[];
  expect(deposit).toMatchObject({ id: "deposit", budgetSpent: 25_000_000 });
  expect(deposit.payments ?? []).toEqual([]);
  expect(balance).toMatchObject({ id: "balance", budgetSpent: 10_000_000 });
  expect(balance.payments).toEqual([expect.objectContaining({ amount: 10_000_000, funder: "pay-family" })]);
  // The booking itself holds no payment: a booking in parts takes its paid from its parts.
  expect(doc.budgetSpent).toBe(25_000_000);
});

test("a payment more than what's left is recorded, and the sheet said it would show as overpaid", async ({ page }) => {
  const section = await openGallery(page);
  await section.getByRole("button", { name: "Record payment for Dapur Lestari Catering" }).click();
  const dialog = dialogOf(page);
  await dialog.getByLabel("Amount paid").fill("22000000");
  await expect(dialog).toContainText("This is Rp 2.000.000 more than what’s left. It will show as overpaid.");
  await record(page).click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  expect((await read("vendors", SINGLE)).budgetSpent).toBe(32_000_000);
});

test("the line under the amount follows a payment the partner records while the sheet is open", async ({ page }) => {
  const section = await openGallery(page);
  await section.getByRole("button", { name: "Record payment for Dapur Lestari Catering" }).click();
  const dialog = dialogOf(page);
  await expect(dialog).toContainText("Pays this in full");

  await put("vendors", SINGLE, booked("Dapur Lestari Catering", "pay-greg", 30_000_000, 30_000_000));
  await expect(dialog).toContainText("This is Rp 20.000.000 more than what’s left. It will show as overpaid.", {
    timeout: 15_000,
  });
  // What was typed at opening stays: the amount doesn't jump under the cursor.
  await expect(dialog.getByLabel("Amount paid")).toHaveValue("Rp 20.000.000");
});

test("a receipt is filed in the booking's folder and linked to the payment", async ({ page }) => {
  await stub(page);
  const section = await openGallery(page);
  await section.getByRole("button", { name: "Record payment for Dapur Lestari Catering" }).click();
  const dialog = dialogOf(page);
  await dialog.getByRole("button", { name: "Attach a receipt" }).click();

  const upload = page.getByRole("dialog", { name: "Upload files" });
  await upload.locator("input[type=file]").setInputFiles({ name: "Transfer.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(upload.getByText("Uploaded", { exact: true })).toBeVisible({ timeout: 15_000 });
  await upload.getByRole("button", { name: "Done" }).click();
  await expect(dialog.getByRole("list", { name: "Receipts" })).toContainText("Transfer.pdf");

  await dialog.getByLabel("Amount paid").fill("5000000");
  await record(page).click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });

  const [file] = await list("weddingFiles");
  expect(file).toMatchObject({ recordRef: { kind: "booking", id: `vendor-${SINGLE}` }, originalFilename: "Transfer.pdf" });
  const folders = await list("fileFolders");
  const root = folders.find((f) => f.name === "Bookings");
  const own = folders.find((f) => f.name === "Dapur Lestari Catering");
  expect(own).toMatchObject({ parentId: root!.id });
  expect(file.folderId).toBe(own!.id);
  expect((await read("vendors", SINGLE)).payments).toEqual([expect.objectContaining({ amount: 5_000_000, receiptFileId: file.id })]);
});

test("a receipt on a part goes in the part's folder", async ({ page }) => {
  await stub(page);
  const section = await openGallery(page);
  await section.getByRole("button", { name: "Record payment on Balance" }).click();
  await dialogOf(page).getByRole("button", { name: "Attach a receipt" }).click();
  const upload = page.getByRole("dialog", { name: "Upload files" });
  await upload.locator("input[type=file]").setInputFiles({ name: "Transfer.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(upload.getByText("Uploaded", { exact: true })).toBeVisible({ timeout: 15_000 });

  await expect.poll(async () => (await list("fileFolders")).map((f) => f.name).sort()).toEqual(["Balance", "Bookings", "Villa Samaya Ubud"]);
  const [file] = await list("weddingFiles");
  expect(file).toMatchObject({ recordRef: { kind: "booking", id: `vendor-${PARTS}`, partId: "balance" } });
});

test("a payment that can't reach the database keeps the sheet, and Try again records it once", async ({ page, context }) => {
  const section = await openGallery(page);
  await section.getByRole("button", { name: "Record payment for Dapur Lestari Catering" }).click();
  const dialog = dialogOf(page);
  await dialog.getByLabel("Amount paid").fill("5000000");

  await context.setOffline(true);
  await record(page).click();
  await expect(dialog.getByRole("button", { name: "Recording" })).toBeVisible();
  await expect(dialog.getByText("The payment wasn’t recorded. What you typed is still here.")).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByLabel("Amount paid")).toHaveValue("Rp 5.000.000");
  expect((await read("vendors", SINGLE)).budgetSpent).toBe(10_000_000);

  await context.setOffline(false);
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => (await read("vendors", SINGLE)).budgetSpent).toBe(15_000_000);
  expect((await read("vendors", SINGLE)).payments).toHaveLength(1);
});
