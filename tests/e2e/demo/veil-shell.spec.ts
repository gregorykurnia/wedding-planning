import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 2.6: the sheet host, confirm and toasts, on the dev-only demo page.

async function openDemos(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery/shell");
  await expect(page.getByRole("heading", { name: "Sheets, confirm and toasts" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
}

const records = (page: Page) => page.getByRole("list", { name: "Fake records" }).getByRole("listitem");

test("confirm, remove and undo put the record back where it was", async ({ page }) => {
  await openDemos(page);
  await expect(records(page)).toHaveCount(3);

  const opener = page.getByRole("button", { name: "Remove Dapur Lestari Catering" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Remove Dapur Lestari Catering?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("You can undo for a few seconds.")).toBeVisible();
  // Keep it is the first focus.
  await expect(dialog.getByRole("button", { name: "Keep it" })).toBeFocused();

  // The action is busy until the write resolves.
  await dialog.getByRole("button", { name: "Remove booking" }).click();
  await expect(dialog.getByRole("button", { name: "Removing" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep it" })).toBeDisabled();
  await expect(dialog).toHaveCount(0);
  await expect(records(page)).toHaveCount(2);

  // The toast carries Undo; undo is busy until the restore resolves.
  const toast = page.getByRole("status").getByText("Removed Dapur Lestari Catering");
  await expect(toast).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: "Restoring" })).toBeDisabled();
  await expect(records(page)).toHaveCount(3);
  await expect(toast).toHaveCount(0);

  // Back in the same place: second of three.
  await expect(records(page).nth(1)).toContainText("Dapur Lestari Catering");
});

test("Keep it, Escape and a tap outside leave the record, and focus goes back", async ({ page }) => {
  await openDemos(page);
  const opener = page.getByRole("button", { name: "Remove Villa Samaya Ubud" });

  await opener.click();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();

  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();

  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect(records(page)).toHaveCount(3);
});

test("a write that fails keeps the confirm open, and trying again works", async ({ page }) => {
  await openDemos(page);
  await page.getByLabel("Make the next write fail").check();
  await page.getByRole("button", { name: "Remove Bunga Melati Florist" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Remove booking" }).click();

  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Remove booking" })).toBeVisible();
  await expect(records(page)).toHaveCount(3);

  await dialog.getByRole("button", { name: "Remove booking" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(records(page)).toHaveCount(2);
});

test("a sheet opened over a sheet stacks, and the one underneath keeps what was typed", async ({ page }) => {
  await openDemos(page);
  await page.getByRole("button", { name: "Open a sheet" }).click();
  const sheet = page.getByRole("dialog", { name: "A demo sheet" });
  // The field that asked for focus has it.
  const name = sheet.getByLabel("Name");
  await expect(name).toBeFocused();
  await name.fill("Kirana");

  // Tab stays inside the sheet.
  for (let i = 0; i < 5; i += 1) await page.keyboard.press("Tab");
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  const del = sheet.getByRole("button", { name: "Delete" });
  await del.click();
  const confirm = page.getByRole("dialog", { name: "Delete this sheet?" });
  await expect(confirm).toBeVisible();
  await expect(sheet).toBeHidden();

  // Escape closes only the top one; typing and focus are as they were.
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await expect(name).toHaveValue("Kirana");
  await expect(del).toBeFocused();

  // Confirming closes both.
  await del.click();
  await page.getByRole("dialog", { name: "Delete this sheet?" }).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open a sheet" })).toBeFocused();
});

test("toasts stack, last 6 seconds (9 for a partner), and Open acts at once", async ({ page }) => {
  await openDemos(page);
  await page.clock.install();

  await page.getByRole("button", { name: "Show a confirmation" }).click();
  await page.getByRole("button", { name: "Show a partner change" }).click();
  const box = page.getByRole("status");
  await expect(box).toHaveAttribute("aria-live", "polite");
  await expect(box.getByText("Saved")).toBeVisible();
  await expect(box.getByText("Bella recorded Rp 55.500.000 for Dapur Lestari Catering")).toBeVisible();
  await expect(box.getByText("B", { exact: true })).toBeVisible();

  await page.clock.runFor(5500);
  await expect(box.getByText("Saved")).toBeVisible();
  await page.clock.runFor(1000);
  await expect(box.getByText("Saved")).toHaveCount(0);
  await expect(box.getByText("Bella recorded")).toBeVisible();
  await page.clock.runFor(3000);
  await expect(box.getByText("Bella recorded")).toHaveCount(0);

  await page.getByRole("button", { name: "Show a next step" }).click();
  await box.getByRole("button", { name: "Open" }).click();
  await expect(box.getByText("Kebun Bunga Atelier is now a booking")).toHaveCount(0);
  await expect(box.getByText("Opened")).toBeVisible();

  await page.getByRole("button", { name: "Show the demonstration toast" }).click();
  await expect(box.getByText("Not saved: demonstration mode")).toBeVisible();
});
