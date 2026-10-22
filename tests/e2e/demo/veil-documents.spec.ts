import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.16: Documents in demonstration mode. There is no database, so the list is
// empty, but the two starts are there.

test("shows nothing written yet, with the starts and the sub-navigation", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: "Documents", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await expect(page.getByText("Plans, research and meeting notes")).toBeVisible();
  await expect(page.getByRole("link", { name: "Documents", exact: true }).first()).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Meeting notes" })).toHaveAttribute("href", "/documents/new?start=meeting");
  await expect(page.getByRole("link", { name: "New document" })).toHaveAttribute("href", "/documents/new?start=blank");
  await expect(page.getByRole("heading", { name: "Nothing written yet", level: 2 })).toBeVisible();
});
