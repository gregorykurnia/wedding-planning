import { expect, test } from "@playwright/test";
import { editCell, expectStored, signInAndGoto, uniqueName } from "../helpers";

test("delete a guest and undo it from the toast", async ({ page }) => {
  await signInAndGoto(page, "/old/guests");
  await expect(page.getByRole("heading", { name: "Guests" })).toBeVisible();

  // Two "Add guest" buttons exist (header and floating); either one works.
  await page.getByRole("button", { name: "Add guest" }).first().click();
  const newRow = page.getByRole("row").filter({ hasText: "New Guest" });
  await expect(newRow).toHaveCount(1);

  const name = uniqueName("Guest");
  await editCell(
    page,
    newRow.getByRole("button", { name: "New Guest", exact: true }),
    name,
  );
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toHaveCount(1);

  // Delete asks for confirmation first; cancelling keeps the guest.
  await row.getByRole("button", { name: `Delete ${name}` }).click();
  const dialog = page.getByRole("dialog", { name: "Delete guest?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toHaveCount(1);

  await row.getByRole("button", { name: `Delete ${name}` }).click();
  await dialog.getByRole("button", { name: "Delete guest" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);

  // The undo toast stays for 10 seconds and brings the guest back.
  const toast = page
    .getByRole("status")
    .filter({ hasText: `Deleted “${name}”.` });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(1);
  await expect(toast).toBeHidden();

  // The guest is really back in the database.
  await expectStored("guests", (d) => d.name === name);
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(1);
});
