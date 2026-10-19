import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.19: Files in demonstration mode. There is no database, so there are no files,
// but the two starts are there, and nothing can be added, uploaded or moved.

test("shows no files yet, with the starts and the sub-navigation", async ({ page }) => {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/documents/files");
  await expect(page.getByRole("heading", { name: "Files", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await expect(page.getByText("Contracts, quotes, receipts and photos")).toBeVisible();
  await expect(page.getByRole("link", { name: "Files", exact: true }).first()).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "No files yet", level: 2 })).toBeVisible();
  await expect(page.getByText("Upload quotes, contracts and photos from vendors.")).toBeVisible();

  await page.getByRole("button", { name: "New folder" }).click();
  await expect(page.getByRole("dialog").getByText("Demonstration mode: adding is turned off.")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Make folder" })).toBeDisabled();
});
