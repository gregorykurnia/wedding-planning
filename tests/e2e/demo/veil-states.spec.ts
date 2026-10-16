import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 2.5: the whole-screen states, messages, banners and skeleton, on the
// dev-only gallery page. The page shows each state from a fake read.

async function openDemos(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery/states");
  await expect(
    page.getByRole("heading", { name: "Screen states, messages and banners" }),
  ).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

async function choose(page: Page, label: string) {
  await page
    .getByRole("group", { name: "Fake status" })
    .getByRole("button", { name: label, exact: true })
    .click();
}

test("loading says what it loads and keeps main busy until the data is there", async ({
  page,
}) => {
  await openDemos(page);
  await choose(page, "Loading");
  await expect(page.getByText("Loading the budget", { exact: true })).toBeAttached();
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "true");
  await choose(page, "Ready");
  await expect(page.locator("main")).not.toHaveAttribute("aria-busy");
});

test("a failed read says so, and Try again asks the screen to read again", async ({ page }) => {
  await openDemos(page);
  await choose(page, "Couldn’t load");
  await expect(page.getByRole("heading", { name: "The budget didn’t load" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Retries requested: 1")).toBeVisible();
});

test("offline with no data shows the cloud message and a quiet Try again", async ({ page }) => {
  await openDemos(page);
  await choose(page, "Offline");
  await expect(page.getByRole("heading", { name: "You’re offline" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByText("The empty data set.")).toHaveCount(0);
});

test("offline with data keeps the data on screen", async ({ page }) => {
  await openDemos(page);
  await choose(page, "Offline, with data");
  await expect(page.getByText("Sample data from a read that has arrived.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "You’re offline" })).toHaveCount(0);
});

// The gold banner is the shell's, above main; veil-frame.spec.ts checks it.
test("demonstration mode shows the empty data set", async ({ page }) => {
  await openDemos(page);
  await choose(page, "Demonstration mode");
  await expect(page.getByText("The empty data set.")).toBeVisible();
});

test("each message kind has its own title and heading level", async ({ page }) => {
  await openDemos(page);
  await expect(page.getByRole("heading", { level: 2, name: "Nothing booked yet" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "No bookings match “fireworks”" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "This booking was removed" }),
  ).toBeVisible();
});

test("a sign-in problem is announced as an alert", async ({ page }) => {
  await openDemos(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "That email and password don’t match." }),
  ).toBeVisible();
});
