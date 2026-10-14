import { expect, test } from "@playwright/test";
import { expectStored, signInAndGoto, uniqueName } from "../helpers";

test("add a schedule item, complete it and delete it", async ({ page }) => {
  await signInAndGoto(page, "/schedule");
  await expect(
    page.getByRole("heading", { name: "Schedule", level: 1 }),
  ).toBeVisible();

  const title = uniqueName("Call");
  const notes = `Ask about ${title}`;

  await page.getByRole("button", { name: "Add to schedule" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add to schedule" });
  await expect(dialog).toBeVisible();

  // The title is required.
  await dialog.getByRole("button", { name: "Add to schedule" }).click();
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Notes").fill(notes);
  await dialog.getByRole("button", { name: "Add to schedule" }).click();
  await expect(dialog).toBeHidden();

  // A new item starts an hour from now, so it shows in the agenda.
  const item = page.getByRole("article").filter({ hasText: title });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText(notes);

  // Search narrows the agenda to it.
  await page.getByLabel("Search schedule").fill(title);
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByLabel("Search schedule").fill("");

  // Completing hides it until completed items are shown.
  await item.getByRole("button", { name: "Mark as completed" }).click();
  await expect(item).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show completed & cancelled" })
    .click();
  await expect(item).toHaveCount(1);
  await expect(item.getByText("Completed", { exact: true })).toBeVisible();

  // Reload: saved, and still completed.
  await expectStored(
    "scheduleEvents",
    (d) => d.title === title && d.status === "completed",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Show completed & cancelled" })
    .click();
  await expect(
    page.getByRole("article").filter({ hasText: title }),
  ).toHaveCount(1);

  // Delete asks the browser to confirm.
  page.once("dialog", async (confirm) => {
    expect(confirm.message()).toContain(title);
    await confirm.accept();
  });
  await page
    .getByRole("article")
    .filter({ hasText: title })
    .getByRole("button", { name: "Delete schedule item" })
    .click();
  await expect(
    page.getByRole("article").filter({ hasText: title }),
  ).toHaveCount(0);
});
