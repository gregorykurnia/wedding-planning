import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { inDays, openAt, put, resetData, restorePairing, storedDoc } from "../stories";

test.afterEach(closeOtherContexts);
test.afterAll(restorePairing);

// Task 8.1a, stories O2, O5 and O6: the overview and what feeds it, by roles and labels (guide §5.1, §5.2, §5.4).

const main = (page: import("@playwright/test").Page) => page.locator("main");

test("O2 coming up: the next dated things run soonest first, and each payment leads to paying it", async ({ page }) => {
  await resetData({ weddingDate: inDays(120), startedOn: inDays(-60) });
  await put("scheduleEvents", "o2-cake", { title: "Cake tasting", type: "appointment", startAt: `${inDays(1)}T10:00`, allDay: false, status: "scheduled", notes: "", location: "" });
  await put("todos", "o2-rings", { title: "Choose the rings", notes: "", dueDate: inDays(3), done: false, createdAt: new Date("2026-01-01T00:00:00Z") });
  await put("vendors", "o2-catering", {
    name: "Dapur Lestari Catering",
    category: "Catering",
    contractStatus: "Chosen",
    funder: null,
    totalPrice: 30_000_000,
    budgetSpent: 10_000_000,
    nextTargetDate: inDays(5),
    nextAction: "Pay the balance",
    subEntries: [],
  });
  await put("vendors", "o2-florist", { name: "Bunga Melati Florist", category: "Flowers", contractStatus: "Chosen", funder: null, totalPrice: 8_000_000, budgetSpent: 0, nextTargetDate: inDays(40), subEntries: [] });

  // The overview: event, task and payment, then the later payment, in date order.
  await openAt(page, "/");
  await expect(page.getByRole("heading", { name: "Coming up", level: 2 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  const rows = main(page).locator("li[data-agenda-key]");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Cake tasting");
  await expect(rows.nth(1)).toContainText("Choose the rings");
  await expect(rows.nth(2)).toContainText("Dapur Lestari Catering");
  await expect(rows.nth(3)).toContainText("Bunga Melati Florist");

  // The budget names the next payment, and Payments due lists both with who and when.
  await page.goto("/budget");
  const next = page.getByRole("region", { name: "Next payment" });
  await expect(next.getByRole("link", { name: "Dapur Lestari Catering" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(next.getByText("due in 5 days")).toBeVisible();
  await expect(next.getByText("Rp 20.000.000")).toBeVisible();
  await page.goto("/budget/payments");
  await expect(page.getByRole("heading", { name: "Payments due", level: 1 })).toBeAttached({ timeout: COMPILE_TIMEOUT });
  const due = page.locator("[data-booking-id]");
  await expect(due).toHaveCount(2);
  await expect(due.nth(0)).toContainText("due in 5 days");
  // Beyond 14 days a payment says its date, not a countdown.
  await expect(due.nth(1)).toContainText("Bunga Melati Florist");
  await expect(due.nth(1)).not.toContainText("due in");

  // Paying from the overview's row opens the sheet for that booking, with what's left.
  await page.goto("/");
  await main(page).locator("li[data-agenda-key]").nth(2).getByRole("button", { name: "Record payment" }).click({ timeout: COMPILE_TIMEOUT });
  const sheet = page.getByRole("dialog", { name: "Record a payment" });
  await expect(sheet).toContainText("Dapur Lestari Catering");
  await expect(sheet.getByLabel("Amount paid")).toHaveValue("Rp 20.000.000");
});

test("O5 the wedding date is entered once, and every countdown reads it", async ({ page }) => {
  await resetData({ weddingDate: null, startedOn: inDays(-73) });
  await openAt(page, "/");
  await expect(page.getByRole("heading", { name: "When is the wedding?", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await page.getByLabel("Wedding date").fill(inDays(200));
  await page.getByRole("button", { name: "Save the date" }).click();
  await expect(main(page).getByText("200", { exact: true })).toBeVisible();

  // Settings shows the same date, and changing it there moves the overview's count.
  await page.goto("/settings");
  await expect(page.getByLabel("Wedding date")).toHaveValue(inDays(200), { timeout: COMPILE_TIMEOUT });
  await page.getByLabel("Wedding date").fill(inDays(150));
  await page.getByLabel("Wedding date").blur();
  await expect.poll(async () => (await storedDoc("settings", "wedding"))?.weddingDate).toBe(inDays(150));
  await page.goto("/");
  await expect(main(page).getByText("150", { exact: true })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText(/^days until \w+ \d+ \w+/)).toBeVisible();
});

test("O6 our two names are entered once, and the top bar and the overview carry them", async ({ page }) => {
  await resetData({ weddingDate: inDays(120), startedOn: inDays(-60) });
  await openAt(page, "/settings");
  await expect(page.getByLabel("First name")).toHaveValue("Greg", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("link", { name: "Greg & Bella" })).toBeVisible();

  const second = page.getByLabel("Second name");
  await second.fill("Isabella");
  await second.blur();
  await expect(page.getByRole("link", { name: "Greg & Isabella" })).toBeVisible();
  await expect.poll(async () => (await storedDoc("settings", "wedding"))?.partnerName).toBe("Isabella");

  await page.goto("/");
  await expect(main(page).getByText("Greg & Isabella", { exact: true })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("link", { name: "Greg & Isabella" })).toBeVisible();

  // A cleared name comes back as it was.
  await page.goto("/settings");
  const first = page.getByLabel("First name");
  await first.fill("");
  await first.blur();
  await expect(first).toHaveValue("Greg");
});
