import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.17: a document in demonstration mode (guide §5.17, §6.4). There is no
// database: a start can be read but not changed, and an id finds nothing.

async function lookAround(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
}

test("meeting notes open read-only and say nothing is saved", async ({ page }) => {
  await lookAround(page);
  await page.goto("/documents/new?start=meeting");
  const body = page.getByRole("textbox", { name: "Document" });
  await expect(body).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(body).toHaveAttribute("contenteditable", "false");
  await expect(page.getByLabel("Title")).toHaveAttribute("readonly", "");
  await expect(page.getByRole("toolbar", { name: "Formatting" }).getByRole("status")).toHaveText(
    "Demonstration mode: not saved",
  );
  await expect(page.getByRole("button", { name: "Bold" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete this document" })).toHaveCount(0);
});

test("a document's address finds nothing, and says why", async ({ page }) => {
  await lookAround(page);
  await page.goto("/documents/kebun-meeting");
  await expect(page.getByRole("heading", { name: "No documents in demonstration mode", level: 1 })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
  await expect(page.getByRole("link", { name: "See all documents" })).toHaveAttribute("href", "/documents");
  await expect(page.getByRole("link", { name: "Documents", exact: true })).toHaveAttribute("href", "/documents");
});
