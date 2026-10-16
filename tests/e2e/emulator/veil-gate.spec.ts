import { expect, test, type Page } from "@playwright/test";
import { TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, uniqueName } from "../helpers";
import { createAccount } from "../seed";

// Task 2.3: the new UI's gate, against the emulators.

async function signInAt(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a signed-out visitor to /new is sent to sign-in", async ({ page }) => {
  await page.goto("/new");
  await expect(page).toHaveURL("/new/sign-in", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("an allowed account signs in to /new, and signing out says so", async ({ page }) => {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await signInAt(page, email, password);
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await expect(page.locator("main")).not.toHaveAttribute("aria-busy", "true");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/new/sign-in");
  await expect(page.getByText("You’ve signed out. Nothing is shown on this device")).toBeVisible();
});

test("a third account is signed out and told it isn't allowed", async ({ page }) => {
  const email = `${uniqueName("someone")}@example.com`;
  await createAccount(email, "test-password-3");

  await page.goto("/new/sign-in");
  await signInAt(page, email, "test-password-3");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    `You’re signed in as ${email}, which isn’t one of the two accounts that can open this planner.`,
    { timeout: COMPILE_TIMEOUT },
  );
  await expect(page.getByRole("button", { name: "Use a different Google account" })).toBeVisible();
  await expect(page).toHaveURL("/new/sign-in");

  // Signed out for real: a reload doesn't let the account in.
  await page.goto("/new");
  await expect(page).toHaveURL("/new/sign-in", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
