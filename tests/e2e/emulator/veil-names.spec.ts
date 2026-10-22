import { expect, test } from "@playwright/test";
import { EMULATOR_PROJECT_ID, TEST_ACCOUNTS, TEST_PORTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 2.4: the top bar shows the couple's names from settings, against the emulators.

const SETTINGS_URL = `http://127.0.0.1:${TEST_PORTS.firestore}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/settings/wedding`;

/** Writes the two names as the emulator's owner, which skips the rules. */
async function writeNames(yourName: string, partnerName: string) {
  const response = await fetch(SETTINGS_URL, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        yourName: { stringValue: yourName },
        partnerName: { stringValue: partnerName },
      },
    }),
  });
  expect(response.ok).toBe(true);
}

test.afterAll(async () => {
  await writeNames("", "");
});

test("the top bar shows the names from settings, and the menu says who is signed in", async ({ page }) => {
  await writeNames("Greg", "Bella");
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });

  await expect(page.getByRole("link", { name: "Greg & Bella" })).toBeVisible();
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" }).getByText(`Signed in as ${email}`)).toBeVisible();
});
