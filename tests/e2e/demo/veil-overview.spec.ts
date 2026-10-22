import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.2: the overview in demonstration mode. There is no database, so there
// are no names, no wedding date and nothing dated: it asks for the date, with
// saving turned off, and every door says nothing yet.

async function openOverview(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("heading", { name: "When is the wedding?", level: 1 })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
}

test("asks for the wedding date, and Save the date is off with its reason", async ({ page }) => {
  await openOverview(page);
  await expect(page.getByText("Set the date once and every countdown and due date works from it.")).toBeVisible();
  await expect(page.getByLabel("Wedding date")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save the date" })).toBeDisabled();
  await expect(page.getByText("Demonstration mode: saving is turned off.")).toBeVisible();
});

test("Coming up has nothing dated, and the four doors say nothing yet", async ({ page }) => {
  await openOverview(page);
  await expect(page.getByRole("heading", { name: "Coming up", level: 2 })).toBeVisible();
  await expect(page.getByText(/^Nothing dated yet\./)).toBeVisible();
  await expect(page.getByRole("link", { name: "See the whole schedule" })).toHaveCount(0);

  const door = (name: string) => page.locator("main").getByRole("link", { name: new RegExp(`^${name}`) });
  await expect(door("Budget")).toHaveAttribute("href", "/budget");
  await expect(door("Budget")).toContainText("Nothing booked yet");
  await expect(door("Tasks")).toHaveAttribute("href", "/schedule/tasks");
  await expect(door("Tasks")).toContainText("No tasks yet");
  await expect(door("Guests")).toHaveAttribute("href", "/guests");
  await expect(door("Guests")).toContainText("No guests yet");
  await expect(door("Wedding items")).toHaveAttribute("href", "/items");
  await expect(door("Wedding items")).toContainText("Nothing tracked yet");
});

test("demonstration mode shows no install card, even on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openOverview(page);
  await expect(page.getByText("Add the planner to your home screen")).toHaveCount(0);
});

test("the sections stack in one column at 390px, with no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openOverview(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
