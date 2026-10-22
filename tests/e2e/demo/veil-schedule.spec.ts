import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.20: the Schedule in demonstration mode. There is no database, so
// nothing is scheduled; adding is turned off with its reason, and the screen
// keeps its title, sub-navigation and add button (guide §5.19).

async function openSchedule(page: Page, path = "/schedule") {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Schedule", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("says nothing is scheduled yet, with the sub-navigation and no figure", async ({ page }) => {
  await openSchedule(page);
  await expect(page.getByText("Appointments, calls, payments and tasks, in one line of time")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Agenda, month and tasks" });
  await expect(nav.getByRole("link", { name: "Agenda" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Month" })).toHaveAttribute("href", "/schedule/month");
  await expect(nav.getByRole("link", { name: "Tasks" })).toHaveAttribute("href", "/schedule/tasks");

  await expect(page.getByRole("heading", { name: "Nothing scheduled yet", level: 2 })).toBeVisible();
  await expect(
    page.getByText("Add appointments, vendor calls and deadlines. Payments due on bookings and tasks with dates appear here by themselves."),
  ).toBeVisible();
  await expect(page.getByText("Late or due today")).toHaveCount(0);
});

test("Add to the schedule opens the sheet with adding turned off and its reason", async ({ page }) => {
  await openSchedule(page);
  await page.getByRole("button", { name: "Add to the schedule" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Add to the schedule", level: 2 })).toBeVisible();
  await expect(dialog.getByText("Demonstration mode: adding is turned off.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Add to the schedule" })).toBeDisabled();
  // Only the choices that can arrive are offered, and an event today has lost both mornings.
  await expect(dialog.getByLabel("Remind us").locator("option")).toHaveText([
    "No reminder",
    "The morning before (that morning has gone)",
    "A week before, in the morning (that morning has gone)",
  ]);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
});

test("?new=1 opens the add sheet and clears the address", async ({ page }) => {
  await openSchedule(page, "/schedule?new=1");
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Add to the schedule", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/\/schedule$/);
});

// Task 4.21: the month route has the same empty state, with Month marked current (guide §5.20).
test("the month says nothing is scheduled yet, with Month marked current", async ({ page }) => {
  await openSchedule(page, "/schedule/month");
  const nav = page.getByRole("navigation", { name: "Agenda, month and tasks" });
  await expect(nav.getByRole("link", { name: "Month" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Agenda" })).not.toHaveAttribute("aria-current");
  await expect(page.getByRole("heading", { name: "Nothing scheduled yet", level: 2 })).toBeVisible();
});
