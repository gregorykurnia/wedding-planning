import { expect, test } from "@playwright/test";
import { editCell, expectStored, signInAndGoto, uniqueName } from "../helpers";

test("add a to-do with a subtask", async ({ page }) => {
  await signInAndGoto(page, "/todo");
  await expect(
    page.getByRole("heading", { name: "To Do", level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add task" }).click();
  const title = uniqueName("Task");
  await editCell(
    page,
    page.getByRole("button", { name: "New task", exact: true }),
    title,
  );
  const taskTitle = page.getByRole("button", { name: title, exact: true });
  await expect(taskTitle).toBeVisible();

  // The chevron just before the title opens the task (it has no accessible name).
  const row = taskTitle.locator(
    "xpath=ancestor::div[contains(@class,'rounded-lg')][1]",
  );
  await row.getByRole("button").first().click();
  await row.getByRole("button", { name: "Add subtask" }).click();

  const subtask = uniqueName("Step");
  await editCell(
    page,
    row.getByRole("button", { name: "New subtask", exact: true }),
    subtask,
  );
  await expect(
    row.getByRole("button", { name: subtask, exact: true }),
  ).toBeVisible();
  await expect(row.getByText("0/1 subtasks")).toBeVisible();

  // Ticking the subtask is counted on the task.
  await row.getByRole("checkbox").nth(1).click();
  await expect(row.getByText("1/1 subtasks")).toBeVisible();

  // Ticking the task moves it to Archived.
  await row.getByRole("checkbox").first().click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toHaveCount(0);
  await page.getByText("Archived").click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();

  // And it was saved.
  await expectStored("todos", (d) => {
    const subtasks = (d.subtasks as { title: string; done: boolean }[]) ?? [];
    return (
      d.title === title &&
      d.done === true &&
      subtasks.some((s) => s.title === subtask && s.done)
    );
  });
  await page.reload();
  await page.getByText("Archived").click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
});
