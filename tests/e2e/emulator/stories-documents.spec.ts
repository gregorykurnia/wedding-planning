import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { openAt, put, resetData, restorePairing, storedDoc, type Value } from "../stories";

test.afterEach(closeOtherContexts);
test.afterAll(restorePairing);

// Task 8.1b, stories R2, R3, R4 and R6: tables, sorting, totals and finding documents, by roles and labels
// (guide §5.17, §5.18, §8). R1, R5 and R7 have their tests in veil-document.spec.ts.

const text = (t: string): Value => ({ type: "text", text: t });
const para = (t: string): Value => ({ type: "paragraph", content: [text(t)] });
const cell = (type: "tableHeader" | "tableCell", t: string): Value => ({ type, content: [t ? para(t) : { type: "paragraph" }] });
const tableRow = (type: "tableHeader" | "tableCell", ...cols: string[]): Value => ({ type: "tableRow", content: cols.map((c) => cell(type, c)) });
const doc = (...content: Value[]): Value => ({ type: "doc", content });
const prices = (): Value => ({
  type: "table",
  content: [
    tableRow("tableHeader", "Item", "Price"),
    tableRow("tableCell", "Flowers", "Rp 12.500.000"),
    tableRow("tableCell", "Cake", "2.000.000"),
    tableRow("tableCell", "Music", "8.000.000"),
    tableRow("tableCell", "Total", "=SUM(B2:B)"),
  ],
});

const note = (title: string, content: Value, hoursAgo: number): Record<string, Value> => ({
  title,
  content,
  createdAt: new Date(Date.now() - (hoursAgo + 1) * 3_600_000),
  updatedAt: new Date(Date.now() - hoursAgo * 3_600_000),
  updatedBy: null,
});

const body = (page: Page) => page.getByRole("textbox", { name: "Document" });
const tableBar = (page: Page) => page.getByRole("toolbar", { name: "Table" });
const cells = (page: Page) => body(page).locator("td, th");

/** Puts the cursor just after the first match of `text` in the body. */
async function caretAfter(page: Page, wanted: string) {
  await body(page).click();
  await body(page).evaluate((root, needle) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent!.indexOf(needle);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at + needle.length);
      range.collapse(true);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
      return;
    }
    throw new Error(`No text "${needle}"`);
  }, wanted);
}

async function openDocument(page: Page, id: string) {
  await openAt(page, `/documents/${id}`);
  await expect(page.getByLabel("Title")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("toolbar", { name: "Formatting" })).toBeVisible();
}

test("R2 tables: Table opens a size grid, the new table is typed into with Tab, and rows and columns are added and removed", async ({ page }) => {
  await resetData();
  await put("notes", "r2", { title: "Seating", content: doc(para("Tables")), createdAt: new Date(), updatedAt: new Date(), updatedBy: null });
  await openDocument(page, "r2");

  await caretAfter(page, "Tables");
  await page.getByRole("button", { name: "Table", exact: true }).click();
  const pop = page.getByRole("dialog", { name: "Table size" });
  await expect(pop.getByRole("button")).toHaveCount(64);
  await pop.getByRole("button", { name: "3 rows, 4 columns" }).click();
  await expect(body(page).locator("tr")).toHaveCount(3);
  await expect(body(page).locator("th")).toHaveCount(4);

  await page.keyboard.type("Table");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Guests");
  await expect(cells(page).nth(1)).toHaveText("Guests");
  await page.keyboard.press("Shift+Tab");
  await expect(tableBar(page).getByLabel("Cell A1")).toBeVisible();

  // One row below, then one column; the table bar acts where the cursor is.
  await tableBar(page).getByRole("button", { name: "Below" }).click();
  await expect(body(page).locator("tr")).toHaveCount(4);
  await tableBar(page).getByLabel("Add").fill("2");
  await tableBar(page).getByLabel("Rows or columns").selectOption("columns");
  await tableBar(page).getByRole("button", { name: "Add", exact: true }).click();
  await expect(body(page).locator("tr").first().locator("th")).toHaveCount(6);

  // The table is saved with the document.
  await expect(page.getByRole("toolbar", { name: "Formatting" }).getByRole("status")).toHaveText("Saved just now", { timeout: 15_000 });
  await expect.poll(async () => JSON.stringify((await storedDoc("notes", "r2"))?.content)).toContain('"type":"table"');
});

test("R3 sort a table: Descending and Ascending reorder the rows by the column, and the title row and the total stay put", async ({ page }) => {
  await resetData();
  await put("notes", "r3", { title: "Quotes", content: doc(para("Prices"), prices()), createdAt: new Date(), updatedAt: new Date(), updatedBy: null });
  await openDocument(page, "r3");

  await caretAfter(page, "Flowers");
  await page.keyboard.press("Tab");
  await expect(tableBar(page).getByLabel("Cell B2")).toBeVisible();
  const firsts = () => body(page).locator("tr").evaluateAll((rows) => rows.map((r) => r.firstElementChild!.textContent));
  await tableBar(page).getByRole("button", { name: "Descending" }).click();
  expect(await firsts()).toEqual(["Item", "Flowers", "Music", "Cake", "Total"]);
  await tableBar(page).getByRole("button", { name: "Ascending" }).click();
  expect(await firsts()).toEqual(["Item", "Cake", "Music", "Flowers", "Total"]);
});

test("R4 SUM totals: a total adds its column, follows added rows, and a bad reference is named", async ({ page }) => {
  await resetData();
  const withMistake: Value = {
    type: "table",
    content: [
      tableRow("tableHeader", "Item", "Price"),
      tableRow("tableCell", "Flowers", "Rp 12.500.000"),
      tableRow("tableCell", "Cake", "2.000.000"),
      tableRow("tableCell", "Total", "=SUM(B2:B)"),
      tableRow("tableCell", "Oops", "=SUM(B2:B3, D9)"),
    ],
  };
  await put("notes", "r4", { title: "Scratchpad", content: doc(para("Prices"), withMistake), createdAt: new Date(), updatedAt: new Date(), updatedBy: null });
  await openDocument(page, "r4");

  const total = cells(page).nth(7);
  await expect(total).toHaveAttribute("data-total", "Rp 14.500.000");
  await expect(cells(page).nth(9)).toHaveAttribute("data-total", "Bad reference");

  // The cell shows its formula while the cursor is in it, and the bar names a mistake.
  await total.click();
  await expect(tableBar(page).locator("code")).toHaveText("=SUM(B2:B)");
  await cells(page).nth(9).click();
  await expect(tableBar(page)).toContainText("D9 is outside this table, which has 2 columns and 5 rows.");

  // A row added above the total is taken in, because B2:B keeps growing.
  await caretAfter(page, "Cake");
  await tableBar(page).getByRole("button", { name: "Below" }).click();
  await body(page).locator("tr").nth(3).locator("td").nth(1).click();
  await page.keyboard.type("1.000.000");
  await caretAfter(page, "Prices");
  // The new row sits above the total, which moved down one row.
  await expect(cells(page).nth(9)).toHaveAttribute("data-total", "Rp 15.500.000");
});

test("R6 find documents: newest first with the newest three as cards, search reads inside tables, and an empty search says so", async ({ page }) => {
  await resetData();
  await put("notes", "n1", note("Meeting: Kebun Bunga Atelier", doc(para("Booked the garden for the ceremony.")), 2));
  await put("notes", "n2", note("Seating ideas", doc(para("Family by the water.")), 5));
  await put("notes", "n3", note("Honeymoon", doc(para("Flights to Lombok.")), 30));
  await put("notes", "n4", note("Catering prices", doc({ type: "table", content: [{ type: "tableRow", content: [cell("tableCell", "Photographer contract"), cell("tableCell", "12.000.000")] }] }), 50));
  await put("notes", "n5", note("Vows", doc(para("Short and kind.")), 90));
  await openAt(page, "/documents");
  await expect(page.getByRole("heading", { name: "Documents", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await expect(page.getByText("5 documents, newest first")).toBeVisible();
  const cards = page.locator("a[data-doc-id]").filter({ has: page.locator("h2") });
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Meeting: Kebun Bunga Atelier");
  await expect(cards.nth(1)).toContainText("Seating ideas");
  const earlier = page.getByRole("list", { name: "Documents" }).locator("a[data-doc-id]");
  await expect(earlier).toHaveCount(2);
  await expect(earlier.nth(0)).toContainText("Catering prices");

  // Search looks through titles and what's inside tables, and marks the match.
  const search = page.getByRole("searchbox", { name: "Search documents" });
  await search.fill("photographer contract");
  await expect(page.getByText("1 document match")).toBeVisible();
  await expect(page.locator("a[data-doc-id='n4'] mark")).toHaveText("Photographer contract");
  await search.fill("zebra");
  await expect(page.getByRole("heading", { name: "No documents match “zebra”", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Clear the search" }).click();
  await expect(search).toBeFocused();
  await expect(page.getByText("5 documents, newest first")).toBeVisible();

  // A card opens its document.
  await page.locator("a[data-doc-id='n2']").click();
  await expect(page).toHaveURL("/documents/n2", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByLabel("Title")).toHaveValue("Seating ideas", { timeout: COMPILE_TIMEOUT });
});
