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

async function signInAndOpenForm(page: Page) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/budget/bookings/new");
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

  await expect(page).toHaveURL("/new/budget/bookings", { timeout: COMPILE_TIMEOUT });
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
  await expect(page).toHaveURL("/new/budget/bookings/new");
});
