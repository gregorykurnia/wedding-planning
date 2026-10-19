import { expect, test, type Page } from "@playwright/test";
import { TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.1: the sign-in gate against the emulators, one test for each way a
// sign-in can end that the guide (§5.1) designs.

const WRONG =
  "That email and password don’t match. Check them and try again, or continue with Google.";

async function open(page: Page) {
  await page.goto("/new/sign-in");
  await expect(page.getByLabel("Email")).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("the tab reads Sign in · Our wedding planner", async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle("Sign in · Our wedding planner");
});

test("the normal gate: Google, or with email, the two fields and Sign in, and no note", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { name: "Our wedding planner", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  await expect(page.getByText("or with email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeEditable();
  await expect(page.getByLabel("Password")).toBeEditable();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("a wrong password keeps the email, rings the password and says so", async ({ page }) => {
  const { email } = TEST_ACCOUNTS[0];
  await open(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.locator("main").getByRole("alert")).toHaveText(WRONG);
  await expect(page.getByLabel("Email")).toHaveValue(email);
  const password = page.getByLabel("Password");
  await expect(password).toHaveValue("");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(password).toBeFocused();
  await expect(page).toHaveURL("/new/sign-in");
});

test("an address nobody has used reads the same as a wrong password", async ({ page }) => {
  await open(page);
  await page.getByLabel("Email").fill("nobody.at.all@example.com");
  await page.getByLabel("Password").fill("whatever-it-is");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(WRONG);
});

test("signing in with nothing typed says the same, without asking Firebase", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(WRONG);
});

test("while signing in the fields are read-only and the button says Signing in", async ({ page }) => {
  const { email, password } = TEST_ACCOUNTS[0];
  await open(page);
  // Hold the sign-in request so the busy state can be looked at.
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/accounts:signInWithPassword*", async (route) => {
    await held;
    await route.continue();
  });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  const busy = page.getByRole("button", { name: "Signing in" });
  await expect(busy).toHaveAttribute("aria-busy", "true");
  await expect(page.getByLabel("Email")).toHaveAttribute("readonly", "");
  await expect(page.getByLabel("Password")).toHaveAttribute("readonly", "");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();

  release();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
});

test("a blocked Google window says so, and the button offers another try", async ({ page }) => {
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await open(page);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Your browser blocked the Google window.");
  await expect(page.getByRole("button", { name: "Continue with Google again" })).toBeEnabled();
  // Email is still a way in.
  await expect(page.getByLabel("Email")).toBeEditable();
});

test("a Google window that is closed says so, calmly", async ({ page }) => {
  await page.addInitScript(() => {
    // A window that is already closed: Firebase notices and gives up.
    window.open = () => ({ closed: true, close() {}, focus() {}, location: { href: "" } }) as never;
  });
  await open(page);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const waiting = page.getByRole("button", { name: "Waiting for Google" });
  await expect(waiting).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Finish signing in in the Google window.")).toBeVisible();

  const closed = page.locator("main").getByRole("status").filter({ hasText: "The Google window closed" });
  await expect(closed).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Continue with Google again" })).toBeEnabled();
});

test("Cancel stops waiting for Google and leaves email usable", async ({ page }) => {
  await page.addInitScript(() => {
    // A window that stays open and never answers.
    window.open = () => ({ closed: false, close() {}, focus() {}, location: { href: "" } }) as never;
  });
  await open(page);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByText("Finish signing in in the Google window.")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeEditable();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Finish signing in in the Google window.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
});

test("offline, both ways in are disabled and a calm note says why", async ({ page, context }) => {
  await open(page);
  await context.setOffline(true);
  await expect(page.locator("main").getByRole("status")).toContainText("You’re offline.");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
});
