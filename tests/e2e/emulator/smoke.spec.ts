import { expect, test } from "@playwright/test";
import { TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { openAt, resetData, restorePairing, stored } from "../stories";

test.afterEach(closeOtherContexts);
test.afterAll(restorePairing);

// Task 8.1a: the smoke tests, rewritten for the new UI (they replace the old-UI ones of Task 1.2 for sign-in,
// venues, vendors, bookings and guests). Each is one short journey a planner makes, by roles and labels, against
// the emulators with nothing seeded but the couple's names.

test.beforeEach(async () => {
  await resetData();
});

test("sign in with an allowlisted account, and signing out leads back to the gate", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/sign-in", { timeout: COMPILE_TIMEOUT });
  const { email, password } = TEST_ACCOUNTS[0];
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("link", { name: "Greg & Bella" })).toBeVisible();

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/, { timeout: COMPILE_TIMEOUT });
});

test("add a venue and mark it Booked: it becomes a booking in the budget", async ({ page }) => {
  await openAt(page, "/vendors/venues");
  await page.getByRole("button", { name: "Add a venue" }).first().click({ timeout: COMPILE_TIMEOUT });
  const sheet = page.getByRole("dialog", { name: "Add a venue" });
  await sheet.getByLabel("Name").fill("Villa Samaya");
  await sheet.getByLabel("Estimated cost").fill("250000000");
  await sheet.getByRole("button", { name: "Add venue" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("link", { name: "Villa Samaya", exact: true }).click();
  await page.getByRole("dialog", { name: "Villa Samaya" }).getByRole("radio", { name: "Booked" }).click();
  await expect(page.getByRole("status").getByText("Villa Samaya is now a booking")).toBeVisible();

  await page.goto("/budget/bookings");
  await expect(page.locator("[data-booking-id]").filter({ hasText: "Villa Samaya" })).toContainText("Rp 250.000.000", { timeout: COMPILE_TIMEOUT });
});

test("add a vendor, mark it Chosen, split its booking into parts and record a payment", async ({ page }) => {
  await openAt(page, "/vendors");
  await page.getByRole("button", { name: "Add a vendor" }).click({ timeout: COMPILE_TIMEOUT });
  const sheet = page.getByRole("dialog", { name: "Add a vendor" });
  await sheet.getByLabel("Name").fill("Dapur Lestari Catering");
  await sheet.getByLabel("Category").selectOption("Food");
  await sheet.getByRole("button", { name: "Add vendor" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("link", { name: "Dapur Lestari Catering", exact: true }).click();
  await page.getByRole("radio", { name: "Chosen" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("status").getByText("Dapur Lestari Catering is now a booking")).toBeVisible();
  await page.getByRole("link", { name: "Open the booking" }).click();

  await expect(page.getByRole("heading", { name: "Dapur Lestari Catering", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  const price = page.getByLabel("Agreed price");
  await price.fill("30000000");
  await price.blur();
  await expect(page.getByText("of Rp 30.000.000, with Rp 0 paid")).toBeVisible();
  await page.getByRole("button", { name: "Split into parts" }).click();
  await expect(page.getByText("from 1 part")).toBeVisible();
  await page.getByRole("button", { name: "Add a part" }).click();
  await expect(page.getByText("from 2 parts")).toBeVisible();

  await page.getByRole("button", { name: "Record a payment" }).first().click();
  const payment = page.getByRole("dialog", { name: "Record a payment" });
  await payment.getByLabel("Amount paid").fill("5000000");
  await payment.getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(payment).toHaveCount(0, { timeout: 15_000 });
  // The payment is on the part that was open (the booking's parts hold what's paid).
  await expect
    .poll(async () => {
      const doc = (await stored("vendors")).find((v) => v.name === "Dapur Lestari Catering");
      return (doc?.subEntries as { budgetSpent: number }[]).reduce((sum, p) => sum + p.budgetSpent, 0);
    })
    .toBe(5_000_000);
});

test("add a guest, remove them, and Undo brings them back", async ({ page }) => {
  await openAt(page, "/guests");
  await page.getByRole("button", { name: "Add a guest" }).first().click({ timeout: COMPILE_TIMEOUT });
  const sheet = page.getByRole("dialog", { name: "Add a guest" });
  await sheet.getByLabel("Name", { exact: true }).fill("Tante Lily");
  await sheet.getByRole("button", { name: "Add guest" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: /^Tante Lily/ }).click();
  await page.getByRole("dialog", { name: "Tante Lily" }).getByRole("button", { name: "Remove guest" }).click();
  await page.getByRole("dialog", { name: "Remove Tante Lily?" }).getByRole("button", { name: "Remove guest" }).click();
  await expect(page.getByRole("button", { name: /^Tante Lily/ })).toHaveCount(0);

  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: /^Tante Lily/ })).toBeVisible();
  await expect.poll(async () => (await stored("guests")).some((g) => g.name === "Tante Lily")).toBe(true);
});
