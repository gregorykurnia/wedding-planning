import { expect, test } from "@playwright/test";

const BANNER = "Firebase isn't connected yet";

test("with no Firebase config the app shows the demo layout", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(BANNER)).toBeVisible();
});

test("demo mode shows the app shell without signing in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(BANNER)).toBeVisible();
  await expect(
    page.getByText("You're viewing demo layouts with empty data."),
  ).toBeVisible();

  // The brand and the main navigation render, and there is no sign-in gate.
  await expect(page.getByText("Our Wedding").first()).toBeVisible();
  const nav = page.getByRole("navigation");
  for (const label of [
    "Dashboard",
    "Guests",
    "Schedule",
    "To Do",
    "Notes",
    "Files",
  ]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(page).toHaveURL("/");
});

test("demo mode renders Guests empty, and adding a guest does not crash the page", async ({
  page,
}) => {
  // Every write throws "Firebase is not configured." in demo mode. Collect what
  // reaches the page, and make sure the page itself keeps working.
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/guests");
  await expect(page.getByText(BANNER)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Guests" })).toBeVisible();
  await expect(page.getByText("0 listed (incl. plus-ones)")).toBeVisible();

  await page.getByRole("button", { name: "Add guest" }).first().click();

  // Still the same page, with the banner and no guest rows or error screen.
  await expect(page.getByRole("heading", { name: "Guests" })).toBeVisible();
  await expect(page.getByText(BANNER)).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "New Guest" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/application error|unhandled runtime error/i),
  ).toHaveCount(0);

  // The app still responds afterwards: navigating works.
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Schedule" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Schedule", level: 1 }),
  ).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(BANNER)).toBeVisible();

  // Failed writes may surface as page errors, but only the expected one.
  for (const message of pageErrors)
    expect(message).toContain("Firebase is not configured");
});
