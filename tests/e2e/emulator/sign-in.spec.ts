import { expect, test } from "@playwright/test";
import { TEST_ACCOUNTS } from "../emulator-config";

test("an allowlisted account signs in against the emulators", async ({ page }) => {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/old/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // The first visit compiles the dashboard in dev mode, which can be slow.
  await expect(page).toHaveURL("/old", { timeout: 60_000 });
  await expect(page.getByText("Signed in").or(page.getByText("Our Wedding")).first()).toBeVisible();
});
