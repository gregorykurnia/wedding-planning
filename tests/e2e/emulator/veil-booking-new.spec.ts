import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.7: adding a booking against the emulators. The funders are written as
// the emulator's owner (which skips the rules). The form writes the booking, and
// Bookings shows it. Each run names its booking uniquely, and every document this
// file writes is removed at the end.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

const CK = "b7-ck";
const GREGORY = "b7-greg";
const added: string[] = [];

async function put(collection: string, id: string, fields: Record<string, string | number>) {
  const value = (v: string | number) => (typeof v === "number" ? { integerValue: String(v) } : { stringValue: v });
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, value(v)])) };
  const res = await fetch(`${DOCS}/${collection}/${id}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

async function remove(collection: string, id: string) {
  await fetch(`${DOCS}/${collection}/${id}`, { method: "DELETE", headers: ADMIN });
}

/** One stored field of a document, as the REST API gives it. */
async function read(collection: string, id: string, field: string): Promise<Record<string, unknown> | undefined> {
  const res = await fetch(`${DOCS}/${collection}/${id}`, { headers: ADMIN });
  const body = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  return body.fields?.[field];
}

test.beforeAll(async () => {
  await put("funders", CK, { name: "CK", order: 0 });
  await put("funders", GREGORY, { name: "Gregory", order: 1 });
});

test.afterAll(async () => {
  for (const id of added) await remove("vendors", id);
  await remove("funders", CK);
  await remove("funders", GREGORY);
});

async function signInAndOpenForm(page: Page, query = "") {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto(`/budget/bookings/new${query}`);
  await expect(page.getByRole("heading", { name: "Add a booking", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("adds a booking that lands on Bookings with its amounts, funder, date and next step", async ({ page }) => {
  const name = `Rings ${Date.now()}`;
  await signInAndOpenForm(page);
  await page.getByLabel("What it is").fill(name);
  await page.getByLabel("Category").selectOption("Music/DJ");
  await page.getByLabel("Agreed price").fill("25000000");
  await page.getByLabel("Agreed price").blur();
  await expect(page.getByLabel("Agreed price")).toHaveValue("Rp 25.000.000");
  await page.getByLabel("Paid so far").fill("5000000");
  await page.getByLabel("Paid so far").blur();
  await page.getByRole("radiogroup", { name: "Funder" }).getByRole("radio", { name: "Gregory" }).click();
  await page.getByLabel("Next due date").fill("2026-11-30");
  await page.getByLabel("Next step").fill("Collect");
  await page.getByRole("button", { name: "Add booking" }).click();

  await expect(page).toHaveURL("/budget/bookings", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByText(`Added ${name}`)).toBeVisible();
  const row = page.locator('[data-booking-id^="vendor-"]').filter({ hasText: name });
  await expect(row).toBeVisible({ timeout: COMPILE_TIMEOUT });
  const id = ((await row.getAttribute("data-booking-id")) ?? "").replace("vendor-", "");
  added.push(id);

  expect(await read("vendors", id, "name")).toEqual({ stringValue: name });
  expect(await read("vendors", id, "funder")).toEqual({ stringValue: GREGORY });
  expect(await read("vendors", id, "totalPrice")).toEqual({ integerValue: "25000000" });
  expect(await read("vendors", id, "nextTargetDate")).toEqual({ stringValue: "2026-11-30" });
  expect(await read("vendors", id, "nextAction")).toEqual({ stringValue: "Collect" });
});

test("asks for a name before it writes anything, and keeps the form", async ({ page }) => {
  await signInAndOpenForm(page);
  await page.getByRole("button", { name: "Add booking" }).click();
  await expect(page.getByText("Give the booking a name so you can find it later.")).toBeVisible();
  await expect(page.getByLabel("What it is")).toBeFocused();
  await expect(page).toHaveURL("/budget/bookings/new");
});

// Task 5.2: the couldn't-add state (guide §5.7), reached with `?fault=save`, which fails every write.
test("a booking the planner can't add keeps what was typed, says it wasn't added, and offers Try again", async ({ page }) => {
  const name = `Harp ${Date.now()}`;
  await signInAndOpenForm(page, "?fault=save");
  await page.getByLabel("What it is").fill(name);
  await page.getByRole("button", { name: "Add booking" }).click();

  await expect(
    page.getByText("The booking wasn’t added: the planner lost its connection. Everything you entered is still here."),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("What it is")).toHaveValue(name);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

/** Every document in a collection, with its fields as the REST API gives them. */
async function all(collection: string): Promise<{ id: string; fields: Record<string, Record<string, unknown>> }[]> {
  const res = await fetch(`${DOCS}/${collection}?pageSize=300`, { headers: ADMIN });
  const body = (await res.json()) as { documents?: { name: string; fields?: Record<string, Record<string, unknown>> }[] };
  return (body.documents ?? []).map((d) => ({ id: d.name.split("/").at(-1)!, fields: d.fields ?? {} }));
}

test("a file attached while adding goes into Files › Bookings › its name (P4-S6)", async ({ page }) => {
  const name = `Sakura ${Date.now()}`;
  await page.route("https://api.cloudinary.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        public_id: "test-upload/b7-file",
        secure_url: "https://res.cloudinary.com/test-cloud/raw/upload/v1/test-upload/b7-file.pdf",
        resource_type: "raw",
        format: "pdf",
        bytes: 24,
      }),
    }),
  );
  await signInAndOpenForm(page);
  await page.getByLabel("What it is").fill(name);
  await page.getByRole("button", { name: "Attach a contract or receipt" }).click();
  const sheet = page.getByRole("dialog", { name: "Upload files" });
  await expect(sheet.getByText(`Into Files › Bookings › ${name}`)).toBeVisible();
  await sheet.locator('input[type="file"]').setInputFiles({ name: "Invoice.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(24, "x") });
  await expect(sheet.getByText("Uploaded", { exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Add booking" }).click();
  await expect(page).toHaveURL("/budget/bookings", { timeout: COMPILE_TIMEOUT });

  const file = (await all("weddingFiles")).find((f) => f.fields.originalFilename?.stringValue === "Invoice.pdf")!;
  const folders = await all("fileFolders");
  const own = folders.find((f) => f.id === file.fields.folderId?.stringValue);
  const root = folders.find((f) => f.id === own?.fields.parentId?.stringValue);
  try {
    expect(own?.fields.name).toEqual({ stringValue: name });
    expect(root?.fields.name).toEqual({ stringValue: "Bookings" });
    expect(root?.fields.parentId).toEqual({ nullValue: null });
  } finally {
    const vendor = (file.fields.recordRef?.mapValue as { fields?: Record<string, { stringValue?: string }> })?.fields?.id?.stringValue;
    if (vendor) added.push(vendor.replace("vendor-", ""));
    await remove("weddingFiles", file.id);
    if (own) await remove("fileFolders", own.id);
    if (root) await remove("fileFolders", root.id);
  }
});
