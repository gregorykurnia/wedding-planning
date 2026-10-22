import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.9: Who pays against the emulators. Funders and bookings are written as
// the emulator's owner (which skips the rules); everything else goes through
// the screen.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Fields = Record<string, string | number | null>;

const typed = (value: string | number | null) =>
  value === null ? { nullValue: null } : typeof value === "number" ? { integerValue: String(value) } : { stringValue: value };

async function put(collection: string, id: string, fields: Fields) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typed(v)])) };
  const res = await fetch(`${DOCS}/${collection}/${id}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

const IDS = {
  funders: ["wp-greg", "wp-family", "wp-empty"],
  vendors: ["wp-catering", "wp-photo", "wp-flowers"],
};

const booked = (name: string, funder: string | null, totalPrice: number, budgetSpent: number): Fields => ({
  name,
  category: "Other",
  contractStatus: "Chosen",
  funder,
  totalPrice,
  budgetSpent,
});

test.beforeAll(async () => {
  await put("funders", "wp-greg", { name: "Greg", order: 0 });
  await put("funders", "wp-family", { name: "Bella’s family", order: 1 });
  await put("funders", "wp-empty", { name: "Tante Lily", order: 2 });
  await put("vendors", "wp-catering", booked("Dapur Lestari Catering", "wp-greg", 30_000_000, 10_000_000));
  // Overpaid: more was paid than the price.
  await put("vendors", "wp-photo", booked("Lumina Photography", "wp-family", 12_000_000, 14_000_000));
  await put("vendors", "wp-flowers", booked("Bunga Melati Florist", null, 5_000_000, 0));
});

test.afterAll(async () => {
  for (const id of IDS.funders) await fetch(`${DOCS}/funders/${id}`, { method: "DELETE", headers: ADMIN });
  for (const id of IDS.vendors) await fetch(`${DOCS}/vendors/${id}`, { method: "DELETE", headers: ADMIN });
});

async function openWhoPays(page: Page) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto("/budget/who-pays");
  await expect(page.getByRole("heading", { name: "Who pays", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

const rowOf = (page: Page, name: string) =>
  page.locator("main li").filter({ has: page.locator("span[dir=auto]").getByText(name, { exact: true }) });

test("each funder shows what's still to pay and what's been paid, with Not assigned last", async ({ page }) => {
  await openWhoPays(page);
  await expect(rowOf(page, "Greg")).toContainText("Rp 20.000.000");
  await expect(rowOf(page, "Greg")).toContainText("Paid Rp 10.000.000 of Rp 30.000.000");
  await expect(rowOf(page, "Greg").getByRole("img")).toHaveAccessibleName("33% paid");

  // Overpaid is shown in rose as a positive number, and the thread is full.
  await expect(rowOf(page, "Bella’s family")).toContainText("Rp 2.000.000 overpaid");
  await expect(rowOf(page, "Bella’s family")).not.toContainText("still to pay");
  await expect(rowOf(page, "Bella’s family").getByRole("img")).toHaveAccessibleName("100% paid");

  // A funder with nothing booked says so, and has no thread.
  await expect(rowOf(page, "Tante Lily")).toContainText("Nothing assigned yet");
  await expect(rowOf(page, "Tante Lily").getByRole("img")).toHaveCount(0);

  const rows = page.locator("main li");
  await expect(rows).toHaveCount(4);
  await expect(rows.last()).toContainText("Not assigned");
  await expect(rows.last()).toContainText("Rp 5.000.000");

  // The same totals as the budget: 24 paid, 21 to pay (23 minus 2 overpaid).
  await expect(page.getByText(/^Together that’s Rp 24\.000\.000 paid and Rp 23\.000\.000 still to pay/)).toBeVisible();
  await expect(page.getByText(/^Nothing is booked yet/)).toHaveCount(0);
});

test("Not assigned links to Bookings searched for what has no funder", async ({ page }) => {
  await openWhoPays(page);
  const link = page.getByRole("link", { name: "See what has no funder" });
  await expect(link).toHaveAttribute("href", "/budget/bookings?q=Not%20assigned");
  await expect(page.getByRole("link", { name: "Budget" })).toHaveAttribute("href", "/budget");
});

test("rename: Escape cancels, Enter saves with Undo, and focus returns to Rename", async ({ page }) => {
  await openWhoPays(page);
  const row = rowOf(page, "Tante Lily");

  await row.getByRole("button", { name: "Rename" }).click();
  const input = page.getByLabel("Funder name");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Tante Lily");
  await input.press("Escape");
  await expect(row.getByRole("button", { name: "Rename" })).toBeFocused();
  await expect(page.getByRole("status").getByText(/Renamed/)).toHaveCount(0);

  await row.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Funder name").fill("Tante Lily & Om Budi");
  await page.getByLabel("Funder name").press("Enter");
  await expect(rowOf(page, "Tante Lily & Om Budi")).toBeVisible();
  const toast = page.getByRole("status").filter({ hasText: "Renamed to Tante Lily & Om Budi" });
  await expect(toast).toBeVisible();
  await expect(rowOf(page, "Tante Lily & Om Budi").getByRole("button", { name: "Rename" })).toBeFocused();

  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(rowOf(page, "Tante Lily")).toBeVisible();
  await expect(rowOf(page, "Tante Lily & Om Budi")).toHaveCount(0);
});

test("a cleared name or the same name changes nothing", async ({ page }) => {
  await openWhoPays(page);
  const row = rowOf(page, "Tante Lily");
  await row.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Funder name").fill("   ");
  await page.getByLabel("Funder name").press("Enter");
  await expect(rowOf(page, "Tante Lily")).toBeVisible();
  await expect(page.getByLabel("Funder name")).toHaveCount(0);
  await expect(page.getByRole("status").getByText(/Renamed/)).toHaveCount(0);
});

test("add: the funder joins the list in order with Undo, and the add button comes back", async ({ page }) => {
  await openWhoPays(page);
  await page.getByRole("button", { name: "Add a funder" }).click();
  await expect(page.getByRole("button", { name: "Add funder" })).toBeEnabled();
  await page.getByLabel("New funder’s name").fill("Om Budi");
  await page.getByRole("button", { name: "Add funder" }).click();

  const added = rowOf(page, "Om Budi");
  await expect(added).toContainText("Nothing assigned yet", { timeout: 15_000 });
  await expect(page.locator("main li").last()).toContainText("Not assigned");
  const toast = page.getByRole("status").filter({ hasText: "Added Om Budi" });
  await expect(toast).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a funder" })).toBeFocused();

  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(added).toHaveCount(0);
});

test("add: an empty name just closes the row", async ({ page }) => {
  await openWhoPays(page);
  await page.getByRole("button", { name: "Add a funder" }).click();
  await page.getByRole("button", { name: "Add funder" }).click();
  await expect(page.getByLabel("New funder’s name")).toHaveCount(0);
  await expect(page.locator("main li")).toHaveCount(4);
});

test("remove: the confirm names what moves, Undo gives the costs back", async ({ page }) => {
  await openWhoPays(page);
  await rowOf(page, "Greg").getByRole("button", { name: "Remove" }).click();
  const dialog = page.getByRole("dialog", { name: "Remove Greg?" });
  await expect(dialog).toContainText(
    "1 cost (Rp 30.000.000) will move to Not assigned. Payments already recorded stay as they are. You can undo for a few seconds.",
  );

  // Keep it leaves everything as it was.
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(rowOf(page, "Greg")).toBeVisible();

  await rowOf(page, "Greg").getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog", { name: "Remove Greg?" }).getByRole("button", { name: "Remove funder" }).click();
  await expect(rowOf(page, "Greg")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator("main li").last()).toContainText("Rp 25.000.000");
  const toast = page.getByRole("status").filter({ hasText: "Removed Greg" });
  await expect(toast).toBeVisible();

  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(rowOf(page, "Greg")).toContainText("Rp 20.000.000", { timeout: 15_000 });
  await expect(page.locator("main li").last()).toContainText("Rp 5.000.000");
});

test("a funder with nothing assigned says so in the confirm", async ({ page }) => {
  await openWhoPays(page);
  await rowOf(page, "Tante Lily").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("dialog", { name: "Remove Tante Lily?" })).toContainText(
    "Nothing is assigned to them. You can undo for a few seconds.",
  );
  await page.getByRole("button", { name: "Keep it" }).click();
});

test("remove: the confirm counts the what-if items the funder pays, from the what-if read (P5-S2, who-pays.tsx)", async ({ page }) => {
  await put("hypotheticalItems", "wp-whatif", { name: "Photo booth", type: "Other", totalPrice: 4_000_000, funder: "wp-family" });
  try {
    await openWhoPays(page);
    await rowOf(page, "Bella’s family").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("dialog", { name: "Remove Bella’s family?" })).toContainText(
      "1 cost (Rp 12.000.000) will move to Not assigned, and so will 1 what-if item.",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: "Keep it" }).click();
  } finally {
    await fetch(`${DOCS}/hypotheticalItems/wp-whatif`, { method: "DELETE", headers: ADMIN });
  }
});

test("the partner's payment arrives in place, with no reload", async ({ page }) => {
  await openWhoPays(page);
  await expect(rowOf(page, "Greg")).toContainText("Rp 20.000.000");
  await put("vendors", "wp-catering", booked("Dapur Lestari Catering", "wp-greg", 30_000_000, 25_000_000));
  await expect(rowOf(page, "Greg")).toContainText("Rp 5.000.000", { timeout: 15_000 });
  await expect(rowOf(page, "Greg")).toContainText("Paid Rp 25.000.000 of Rp 30.000.000");
  await put("vendors", "wp-catering", booked("Dapur Lestari Catering", "wp-greg", 30_000_000, 10_000_000));
});
