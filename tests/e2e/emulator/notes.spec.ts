import { expect, test } from "@playwright/test";
import { signInAndGoto, uniqueName } from "../helpers";

test("write a note with a =SUM table and see the total", async ({ page }) => {
  await signInAndGoto(page, "/old/notes");
  await expect(
    page.getByRole("heading", { name: "Notes", level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "New document" }).first().click();
  const title = uniqueName("Budget note");
  const titleBox = page.getByRole("textbox", { name: "Document title" });
  // Until the new document is stored, the editor may still show another one.
  await expect(titleBox).toHaveValue("Untitled document");
  await titleBox.fill(title);

  // Insert a 4 x 3 table: a header row and three body rows, three columns.
  await page.getByLabel("Insert table").selectOption("4x3");
  const editor = page.locator(".ProseMirror");
  await expect(editor.getByRole("columnheader")).toHaveCount(3);
  await expect(editor.getByRole("cell")).toHaveCount(9);

  // The app shows a formula's result by writing it to the cell's
  // data-formula-value attribute (a stylesheet then paints it over the cell).
  // Today the editor redraws the cell a millisecond later and the attribute
  // is lost again, so the total never stays on screen. To keep checking the
  // calculation itself, record every value the app writes.
  await editor.evaluate((el) => {
    const w = window as unknown as { __formulaValues: string[] };
    w.__formulaValues = [];
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        const value = (m.target as HTMLElement).getAttribute(
          "data-formula-value",
        );
        if (m.attributeName === "data-formula-value" && value !== null)
          w.__formulaValues.push(value);
      }
    }).observe(el, { attributes: true, subtree: true });
  });
  const lastTotal = () =>
    page.evaluate(() => {
      const values = (window as unknown as { __formulaValues: string[] })
        .__formulaValues;
      return values.at(-1) ?? null;
    });

  // The cursor is in the first header cell; Tab moves to the next cell.
  const typeCells = async (values: string[]) => {
    for (const [index, value] of values.entries()) {
      if (value) await page.keyboard.type(value);
      if (index < values.length - 1) await page.keyboard.press("Tab");
    }
  };
  await typeCells([
    "Item",
    "Amount",
    "Note",
    "Rent",
    "100",
    "",
    "Food",
    "250",
    "",
    "Total",
    "=SUM(B2:B)",
  ]);

  // =SUM(B2:B) adds the numbers above it: 100 + 250.
  await expect.poll(lastTotal).toBe("350");
  await expect(editor.getByRole("cell", { name: "=SUM(B2:B)" })).toBeVisible();

  // The total follows the numbers: Rent 100 becomes 1000.
  await editor.getByRole("cell", { name: "100", exact: true }).click();
  await page.keyboard.press("End");
  await page.keyboard.type("0");
  await expect(
    editor.getByRole("cell", { name: "1000", exact: true }),
  ).toBeVisible();
  await expect.poll(lastTotal).toBe("1,250");

  // Autosave, then everything comes back after a reload.
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.reload();
  await page
    .getByRole("button", { name: new RegExp(title) })
    .first()
    .click();
  await expect(
    page.getByRole("textbox", { name: "Document title" }),
  ).toHaveValue(title);
  await expect(
    editor.getByRole("cell", { name: "1000", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    editor.getByRole("cell", { name: "250", exact: true }),
  ).toBeVisible();
  await expect(editor.getByRole("cell", { name: "=SUM(B2:B)" })).toBeVisible();

  // Delete asks the browser to confirm.
  page.once("dialog", async (confirm) => {
    expect(confirm.message()).toContain(title);
    await confirm.accept();
  });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(title) }),
  ).toHaveCount(0);
});
