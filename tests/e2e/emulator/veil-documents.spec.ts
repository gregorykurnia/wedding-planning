import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.16: the Documents list at /new/documents, against the emulators (guide §5.16, R6).
// Documents are written as the emulator's owner (which skips the rules); the screen reads them live.

const DOCUMENTS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Value = string | number | boolean | null | Date | Value[] | { [key: string]: Value };

/** A JS value as a Firestore REST value. */
function encode(value: Value): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
}

async function put(collection: string, id: string, fields: Record<string, Value>) {
  const res = await fetch(`${DOCUMENTS}/${collection}/${id}`, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, encode(v)])) }),
  });
  expect(res.ok).toBe(true);
}

const text = (t: string): Value => ({ type: "text", text: t });
const para = (t: string): Value => ({ type: "paragraph", content: [text(t)] });
const cell = (t: string): Value => ({ type: "tableCell", content: [para(t)] });
const body = (...content: Value[]): Value => ({ type: "doc", content });

const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

/** A stored document, last saved `hours` ago; `by` is an account that isn't Greg's, so it reads as Bella's. */
const note = (title: string, content: Value, hours: number, by: string | null = null): Record<string, Value> => ({
  title,
  content,
  createdAt: ago(hours + 1),
  updatedAt: ago(hours),
  updatedBy: by,
});

test.beforeEach(async () => {
  const res = await fetch(`${DOCUMENTS.replace("/v1/", "/emulator/v1/")}`, { method: "DELETE" });
  expect(res.ok).toBe(true);
  await put("settings", "wedding", { yourName: "Greg", partnerName: "Bella", partnerEmail: TEST_ACCOUNTS[1].email });
  await put("notes", "n1", note("Meeting: Kebun Bunga Atelier", body(para("Booked the garden for the ceremony.")), 2, "bella-uid"));
  await put("notes", "n2", note("Seating ideas", body(para("Family by the water.")), 5));
  await put("notes", "n3", note("Honeymoon", body(para("Flights to Lombok.")), 30));
  await put(
    "notes",
    "n4",
    note(
      "Catering prices",
      body({ type: "table", content: [{ type: "tableRow", content: [cell("Photographer contract"), cell("12.000.000")] }] }),
      50,
    ),
  );
  await put("notes", "n5", note("", body(para("A thought with no title yet.")), 70));
  await put("notes", "n6", note("Vows", body(para("Short and kind.")), 90));
});

async function open(page: Page) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/documents");
  await expect(page.getByRole("heading", { name: "Documents", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("shows the three newest as cards and the rest as rows under Earlier", async ({ page }) => {
  await open(page);
  await expect(page.getByText("6 documents, newest first")).toBeVisible();
  await expect(page.getByRole("link", { name: "Documents", exact: true }).first()).toHaveAttribute("aria-current", "page");

  const cards = page.locator("a[data-doc-id]").filter({ has: page.locator("h2") });
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Meeting: Kebun Bunga Atelier");
  await expect(cards.nth(0)).toContainText("Booked the garden for the ceremony.");
  await expect(cards.nth(0)).toContainText("Edited 2 hours ago by Bella");
  // Yours isn't named.
  await expect(cards.nth(1)).toContainText("Edited 5 hours ago");
  await expect(cards.nth(1).getByText(/^Edited/)).not.toContainText("by");
  await expect(cards.nth(0)).toHaveAttribute("href", "/new/documents/n1");

  await expect(page.getByRole("heading", { name: /^Earlier/, level: 2 })).toContainText("3 documents");
  const rows = page.getByRole("list", { name: "Documents" }).locator("a[data-doc-id]");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Catering prices");
  await expect(rows.nth(1)).toContainText("Untitled");
  await expect(rows.nth(2)).toContainText("Vows");
});

test("search reads titles and what's inside tables, marks the match and shows rows only", async ({ page }) => {
  await open(page);
  await page.getByRole("searchbox", { name: "Search documents" }).fill("photographer contract");

  await expect(page.getByText("1 document match")).toBeVisible();
  await expect(page.locator("h2").filter({ hasText: /Seating|Honeymoon/ })).toHaveCount(0);
  const row = page.locator("a[data-doc-id='n4']");
  await expect(row).toBeVisible();
  await expect(row.locator("mark")).toHaveText("Photographer contract");
  await expect(page.getByRole("heading", { name: /^Earlier/ })).toHaveCount(0);

  await page.getByRole("searchbox", { name: "Search documents" }).fill("vow");
  await expect(page.locator("a[data-doc-id='n6'] mark")).toHaveText("Vow");
});

test("a search that finds nothing says so and clears", async ({ page }) => {
  await open(page);
  await page.getByRole("searchbox", { name: "Search documents" }).fill("zebra");
  await expect(page.getByRole("heading", { name: "No documents match “zebra”", level: 2 })).toBeVisible();
  await expect(page.getByText("Search looks through titles and everything written inside, tables included.")).toBeVisible();

  await page.getByRole("button", { name: "Clear the search" }).click();
  await expect(page.getByRole("searchbox", { name: "Search documents" })).toHaveValue("");
  await expect(page.getByText("6 documents, newest first")).toBeVisible();
  await expect(page.locator("a[data-doc-id='n1']")).toBeVisible();
});

test("the two starts open a new document", async ({ page }) => {
  await open(page);
  await page.getByRole("link", { name: "Meeting notes" }).click();
  await expect(page).toHaveURL(/\/new\/documents\/new\?start=meeting/, { timeout: COMPILE_TIMEOUT });
  await expect(page.getByLabel("Title")).toHaveValue(/^Meeting: /, { timeout: COMPILE_TIMEOUT });

  await page.goto("/new/documents");
  await page.getByRole("link", { name: "New document" }).click();
  await expect(page).toHaveURL(/\/new\/documents\/new\?start=blank/, { timeout: COMPILE_TIMEOUT });
  await expect(page.getByLabel("Title")).toHaveValue("", { timeout: COMPILE_TIMEOUT });
});

test("a document card opens its document", async ({ page }) => {
  await open(page);
  await page.locator("a[data-doc-id='n2']").click();
  await expect(page).toHaveURL("/new/documents/n2", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByLabel("Title")).toHaveValue("Seating ideas", { timeout: COMPILE_TIMEOUT });
});

test("on a phone the cards stack into one column", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await open(page);
  const first = await page.locator("a[data-doc-id='n1']").boundingBox();
  const second = await page.locator("a[data-doc-id='n2']").boundingBox();
  expect(first && second && Math.abs(first.x - second.x) < 1 && second.y > first.y).toBe(true);
  await context.close();
});

test("nothing written yet keeps the starts above the message", async ({ page }) => {
  for (const id of ["n1", "n2", "n3", "n4", "n5", "n6"]) {
    await fetch(`${DOCUMENTS}/notes/${id}`, { method: "DELETE", headers: ADMIN });
  }
  await open(page);
  await expect(page.getByText("Plans, research and meeting notes")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing written yet", level: 2 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Meeting notes" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search documents" })).toHaveCount(0);
});
