import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 2.6: the sheet host, confirm and toasts, on the dev-only demo page.

async function openDemos(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/gallery/shell");
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
  await page.getByRole("button", { name: "Undo", exact: true }).click();
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

  // N14: nothing changed, and the box says so; the button asks again and has focus.
  await expect(dialog.getByRole("alert")).toHaveText(
    "Nothing was removed. The planner couldn’t reach its database, so everything is just as it was. Try again, or keep it for now.",
  );
  const again = dialog.getByRole("button", { name: "Try again" });
  await expect(again).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Keep it" })).toBeEnabled();
  await expect(records(page)).toHaveCount(3);

  await again.click();
  await expect(dialog).toHaveCount(0);
  await expect(records(page)).toHaveCount(2);
  // The removal landed this time, so it has its undo as usual.
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
});

test("an undo that finds the thing changed says so, in the partner's circle, and takes nothing back", async ({
  page,
}) => {
  await openDemos(page);
  const status = page.getByRole("status");

  await page.getByRole("button", { name: "Show a split that can’t be undone" }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restoring" })).toBeDisabled();
  const conflict = status.getByText(
    "Can’t undo the split: Bella recorded Rp 5.000.000 on the balance since. Both parts stay as they are now.",
  );
  await expect(conflict).toBeVisible();
  // The undo toast is gone and the new one has no action: there is nothing left to try.
  await expect(status.getByText("Split Villa Samaya Ubud")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveCount(0);

  // Without a sentence of its own, the generic line names the partner.
  await page.getByRole("button", { name: "Show an undo that can’t" }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    status.getByText("Can’t undo: Your partner has changed this since. It’s kept as it is now."),
  ).toBeVisible();
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

// Phase 2 review: leaving the screen while a confirm is busy doesn't lose the undo.
test("leaving while Removing keeps the sheet until the write lands, then offers Undo", async ({ page }) => {
  // Compile the page it leaves for first, so the move lands inside the write.
  await page.goto("/gallery/partner");
  await openDemos(page);
  await page.getByLabel("Make the next write slow").check();
  await page.getByRole("button", { name: "Remove Villa Samaya Ubud" }).click();
  const dialog = page.getByRole("dialog", { name: "Remove Villa Samaya Ubud?" });
  await dialog.getByRole("button", { name: "Remove booking" }).click();
  await expect(dialog.getByRole("button", { name: "Removing" })).toBeVisible();

  // The link sits behind the modal, so it is clicked from script, as a
  // navigation from elsewhere (a partner toast's Open, the back button) would be.
  await page.evaluate(() => document.getElementById("leave-demo")?.click());
  await expect(page).toHaveURL("/gallery/partner", { timeout: COMPILE_TIMEOUT });
  await expect(dialog.getByRole("button", { name: "Removing" })).toBeVisible();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status").getByText("Removed Villa Samaya Ubud")).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
});

test("leaving the screen closes an idle sheet", async ({ page }) => {
  await openDemos(page);
  await page.getByRole("button", { name: "Open a sheet" }).click();
  await expect(page.getByRole("dialog", { name: "A demo sheet" })).toBeVisible();
  await page.evaluate(() => document.getElementById("leave-demo")?.click());
  await expect(page).toHaveURL("/gallery/partner", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
