import { expect, test, type Browser, type Page } from "@playwright/test";
import { TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { inDays, openAt, put, resetData, restorePairing, storedDoc, type Value } from "../stories";

test.afterEach(closeOtherContexts);
test.afterAll(restorePairing);

// Task 8.1b, stories A2, A4 and A5: the partner's changes arriving live (two browser contexts), the two sizes, and
// the account, settings and signing out, by roles and labels (guide §5.1, §5.25, §8). A1, A3 and A6 have their tests
// in smoke.spec.ts, the sign-in and install specs and the field specs.

/** A second signed-in browser, one account each. */
async function openAs(browser: Browser, account: (typeof TEST_ACCOUNTS)[number], path: string, viewport = { width: 1280, height: 900 }): Promise<Page> {
  const page = await (await browser.newContext({ viewport })).newPage();
  await openAt(page, path, account);
  return page;
}

const guest = (name: string, number: number, over: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  number,
  connection: "Bride's aunt",
  country: "Indonesia",
  rsvpStatus: "pending",
  eventType: "Both",
  inviteSent: true,
  plusOnes: 0,
  allergies: "",
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, number)),
  ...over,
});

test("A2 live partner changes: Bella's reply arrives on Greg's guest list with a toast and a flash, and isn't news to Bella", async ({ browser }) => {
  await resetData();
  await put("guestMeta", "counter", { next: 3 });
  await put("guests", "g-lily", guest("Tante Lily", 1));
  await put("guests", "g-hendra", guest("Hendra Santoso", 2, { connection: "Groom's uncle" }));
  const greg = await openAs(browser, TEST_ACCOUNTS[0], "/guests");
  const bella = await openAs(browser, TEST_ACCOUNTS[1], "/guests");
  const reply = (page: Page, label: "Waiting" | "Attending" | "Not attending") =>
    page.locator('[data-guest-id="g-lily"]').getByRole("radio", { name: label, exact: true });
  await expect(reply(greg, "Waiting")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(reply(bella, "Waiting")).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await reply(bella, "Attending").click();
  await expect(greg.getByRole("status").getByText("Bella marked Tante Lily as attending")).toBeVisible({ timeout: 15_000 });
  await expect(reply(greg, "Attending")).toHaveAttribute("aria-checked", "true");
  await expect(greg.locator('[data-guest-id="g-lily"]')).toHaveClass(/\bflash\b/);
  await expect(bella.getByRole("status").getByText(/marked/)).toHaveCount(0);
  await expect(bella.locator('[data-guest-id="g-lily"]')).not.toHaveClass(/\bflash\b/);

  // The other way round, on another screen: Greg finishes a step, and Bella is told.
  await put("todos", "t-rings", {
    title: "Choose the rings",
    notes: "",
    dueDate: inDays(3),
    done: false,
    subtasks: [{ id: "s1", title: "Visit the jeweller", notes: "", dueDate: null, done: false }],
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
  await greg.goto("/schedule/tasks?open=t-rings");
  await bella.goto("/schedule/tasks");
  await expect(greg.getByRole("checkbox", { name: "Step done: Visit the jeweller" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(bella.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await greg.getByRole("checkbox", { name: "Step done: Visit the jeweller" }).click();
  await expect(bella.getByRole("status").getByText("Greg finished “Visit the jeweller”")).toBeVisible({ timeout: 15_000 });
});

test("A2 live partner changes: in the same document each sees the banner, and one's deletion is named to the other", async ({ browser }) => {
  await resetData();
  await put("notes", "sangjit", {
    title: "Sangjit checklist",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hampers" }] }] },
    createdAt: new Date(),
    updatedAt: new Date(),
    updatedBy: null,
  });
  const greg = await openAs(browser, TEST_ACCOUNTS[0], "/documents/sangjit");
  const bella = await openAs(browser, TEST_ACCOUNTS[1], "/documents/sangjit");
  await expect(greg.getByLabel("Title")).toHaveValue("Sangjit checklist", { timeout: COMPILE_TIMEOUT });
  await expect(bella.getByLabel("Title")).toHaveValue("Sangjit checklist", { timeout: COMPILE_TIMEOUT });
  await expect(greg.getByText("Bella is also in this document. Their changes appear as they type.")).toBeVisible({ timeout: 30_000 });
  await expect(bella.getByText("Greg is also in this document.")).toBeVisible({ timeout: 30_000 });

  await bella.getByRole("button", { name: "Delete this document" }).click();
  await bella.getByRole("dialog").getByRole("button", { name: "Delete for good" }).click();
  await expect(bella.getByRole("heading", { name: "Document deleted", level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(greg.getByRole("heading", { name: "This document was deleted", level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(greg.getByText("Bella deleted it on another device. It can’t be brought back.")).toBeVisible();
});

test("A4 phone and computer: the main screens fit a phone with nothing scrolling sideways, and use the width on a computer", async ({ page }) => {
  test.setTimeout(400_000);
  await resetData({ weddingDate: inDays(120), startedOn: inDays(-60) });
  await openAt(page, "/");
  const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const screens = ["/", "/budget", "/vendors", "/items", "/guests", "/schedule", "/documents", "/settings"];
  for (const path of screens) {
    await test.step(path, async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      await expect(page.getByRole("link", { name: "Greg & Bella" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
      if (path !== "/") await expect(page.getByRole("heading", { level: 1 }).first()).toBeAttached({ timeout: COMPILE_TIMEOUT });
      expect(await sideways(), `${path} at 390px`).toBeLessThanOrEqual(0);
      const narrow = await page.locator("main").boundingBox();
      expect(narrow!.width, `${path} fills the phone`).toBeGreaterThan(300);

      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(page.getByRole("link", { name: "Greg & Bella" })).toBeVisible();
      expect(await sideways(), `${path} at 1440px`).toBeLessThanOrEqual(0);
      const wide = await page.locator("main").boundingBox();
      expect(wide!.width, `${path} is wider on a computer`).toBeGreaterThan(narrow!.width);
    });
  }
  // The top bar and its Menu are there at both sizes.
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
});

test("A5 account, settings, sign out: the menu says who is signed in, settings lists both accounts, and Sign out leaves", async ({ browser, page }) => {
  await resetData();
  // Bella signs in on another browser, so both accounts are recorded.
  const other = await openAs(browser, TEST_ACCOUNTS[1], "/");
  await expect(other.getByRole("button", { name: "Menu" })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await openAt(page, "/");
  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByText(`Signed in as ${TEST_ACCOUNTS[0].email}`)).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await menu.getByRole("link", { name: "Wedding settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Wedding settings", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  const accounts = page.locator("main ul").first().locator("li");
  await expect(accounts.nth(0)).toContainText("Greg, you");
  await expect(accounts.nth(0)).toContainText(TEST_ACCOUNTS[0].email);
  await expect(accounts.nth(1)).toContainText("Bella");
  await expect(accounts.nth(1)).toContainText(TEST_ACCOUNTS[1].email);
  await expect(page.getByText("Only these two accounts can see or change anything.")).toBeVisible();

  // The names are the planner's own settings, saved as you go.
  await page.getByLabel("Second name").fill("Isabella");
  await page.getByLabel("Second name").blur();
  await expect.poll(async () => (await storedDoc("settings", "wedding"))?.partnerName).toBe("Isabella");

  await page.getByRole("button", { name: "Sign out of this computer" }).click();
  await expect(page).toHaveURL("/sign-in?next=%2Fsettings", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("You’ve signed out. Nothing is shown on this device")).toBeVisible();
  // Signed out, the gate keeps every screen shut.
  await page.goto("/budget");
  await expect(page).toHaveURL(/\/sign-in/, { timeout: COMPILE_TIMEOUT });
});
