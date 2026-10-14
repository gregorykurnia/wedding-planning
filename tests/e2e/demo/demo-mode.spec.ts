import { expect, test } from "@playwright/test";

test("with no Firebase config the app shows the demo layout", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Firebase isn't connected yet")).toBeVisible();
});
