import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.22: Tasks in demonstration mode. There is no database, so the list is
// empty, and adding is turned off.

test("shows no tasks, the sub-navigation, and an Add a task that is off and says why", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/schedule/tasks");
  await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await expect(page.getByText("Big jobs, broken into steps")).toBeVisible();
  await expect(page.getByRole("link", { name: "Tasks", exact: true }).first()).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Agenda", exact: true })).toHaveAttribute("href", "/schedule");
  await expect(page.getByRole("heading", { name: "No tasks yet", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "Add a task" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a task" });
  await expect(sheet.getByRole("button", { name: "Add task" })).toBeDisabled();
  await expect(sheet.getByText("Demonstration mode: adding is turned off.")).toBeVisible();
});
