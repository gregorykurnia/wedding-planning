import { expect, test } from "@playwright/test";
import {
  expectStored,
  signInAndGoto,
  storedDocs,
  uniqueName,
} from "../helpers";

test("add master-list rows, reorder with the arrows, delete and undo", async ({
  page,
}) => {
  await signInAndGoto(page, "/master-list");
  await expect(
    page.getByRole("heading", { name: "Master List" }),
  ).toBeVisible();
  // The first visit fills in the 44 starting rows.
  await expect(page.getByText(/^\d+ items?$/)).toBeVisible({ timeout: 30_000 });

  const rowOf = (item: string) =>
    page
      .getByRole("row")
      .filter({
        has: page.getByRole("button", { name: `Edit Item: ${item}` }),
      });

  // "Add row" appends a blank row and puts the cursor in its Item cell.
  const addRow = async (item: string) => {
    await page.getByRole("button", { name: "Add row", exact: true }).click();
    const editor = page.getByRole("textbox", { name: "Edit Item" });
    await expect(editor).toBeFocused();
    await editor.fill(item);
    await editor.press("Enter");
    await expect(rowOf(item)).toHaveCount(1);
  };

  const first = uniqueName("Row-A");
  const second = uniqueName("Row-B");
  await addRow(first);
  await addRow(second);

  const order = async () => {
    const labels = await page
      .getByRole("button", { name: /^Edit Item: / })
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
    return labels.map((l) => l?.replace("Edit Item: ", ""));
  };
  const position = async (item: string) => (await order()).indexOf(item);

  // New rows land at the end, in the order they were added.
  expect(await position(second)).toBe((await position(first)) + 1);

  // Move the second row up: it now sits above the first.
  await page.getByRole("button", { name: `Move ${second} up` }).click();
  await expect
    .poll(async () => (await position(second)) < (await position(first)))
    .toBe(true);
  // The new order is stored, and kept after a reload.
  await expect
    .poll(async () => {
      const docs = await storedDocs("masterListItems");
      const orderOf = (item: string) =>
        docs.find((d) => d.item === item)?.sortOrder as number;
      return orderOf(second) < orderOf(first);
    })
    .toBe(true);
  await page.reload();
  await expect(rowOf(second)).toHaveCount(1, { timeout: 30_000 });
  expect(await position(second)).toBeLessThan(await position(first));

  // And back down again.
  await page.getByRole("button", { name: `Move ${second} down` }).click();
  await expect
    .poll(async () => (await position(second)) > (await position(first)))
    .toBe(true);
  expect(await position(second)).toBe((await position(first)) + 1);

  // Delete asks for confirmation, then offers a 10-second undo.
  await page.getByRole("button", { name: `Delete ${second}` }).click();
  const dialog = page.getByRole("dialog", { name: "Delete Master List row?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete row" }).click();
  await expect(dialog).toBeHidden();
  await expect(rowOf(second)).toHaveCount(0);

  const toast = page
    .getByRole("status")
    .filter({ hasText: `Deleted “${second}”.` });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(rowOf(second)).toHaveCount(1);
  // Restored in its old place.
  expect(await position(second)).toBe((await position(first)) + 1);
});
