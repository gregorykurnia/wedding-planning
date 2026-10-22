import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { inDays, openAt, put, resetData, restorePairing, stored, storedDoc, type Value } from "../stories";

test.afterEach(closeOtherContexts);
test.afterAll(restorePairing);

// Task 8.1a, stories B1–B4, B6 and B8–B10, B12: bookings and money (guide §5.4–§5.10, §6.9). B5, B7 and B11
// have their tests in veil-budget, veil-who-pays and veil-who. Each story seeds a few documents, drives the
// screen by roles and labels, and reads back what was stored.

const vendor = (name: string, over: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  category: "Catering",
  contractStatus: "Chosen",
  funder: "f-greg",
  totalPrice: 30_000_000,
  budgetSpent: 10_000_000,
  nextTargetDate: null,
  nextAction: "",
  subEntries: [],
  booking: { on: "2026-03-01", from: "vendor", removed: false },
  estimate: null,
  createdAt: new Date("2026-02-01T10:00:00Z"),
  ...over,
});

const part = (id: string, name: string, totalPrice: number, budgetSpent: number, due: string | null): Value => ({
  id,
  name,
  funder: "f-greg",
  totalPrice,
  budgetSpent,
  nextTargetDate: due,
  nextAction: "",
  files: [],
});

test.beforeEach(async () => {
  await resetData();
  await put("funders", "f-greg", { name: "Greg", order: 0 });
  await put("funders", "f-bella", { name: "Bella", order: 1 });
});

const toasts = (page: Page) => page.getByRole("status");
const bookingRows = (page: Page) => page.locator("[data-booking-id]");

test("B1 a booking is created automatically: Chosen on a vendor, Booked on a venue, each with a toast that opens it", async ({ page }) => {
  await put("vendors", "v1", {
    name: "Kebun Bunga Atelier",
    category: "Decoration",
    contractStatus: "Consideration",
    priceOptions: [{ id: "o1", description: "Gold", price: 62_500_000, selected: true }],
    notes: "",
    starred: false,
    files: [],
    subEntries: [],
    createdAt: new Date("2026-05-02T10:00:00Z"),
  });
  await put("venues", "ven1", {
    name: "Puri Taman Sari",
    location: "Seminyak, Bali",
    budgetEstimate: 180_000_000,
    guestMax: 200,
    status: "Toured",
    notes: "",
    files: [],
    subEntries: [],
    createdAt: new Date("2026-05-02T10:00:00Z"),
  });

  await openAt(page, "/vendors/v1");
  await page.getByRole("radio", { name: "Chosen" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(toasts(page).getByText("Kebun Bunga Atelier is now a booking")).toBeVisible();
  await expect.poll(async () => (await storedDoc("vendors", "v1"))?.estimate).toBe(62_500_000);
  await toasts(page).getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL("/budget/bookings/vendor-v1", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("heading", { name: "Kebun Bunga Atelier", level: 1 })).toBeVisible();
  await expect(page.getByText(/^Booked from Vendors on /)).toBeVisible();

  await page.goto("/vendors/venues");
  await page.getByRole("link", { name: "Puri Taman Sari", exact: true }).click({ timeout: COMPILE_TIMEOUT });
  await page.getByRole("dialog", { name: "Puri Taman Sari" }).getByRole("radio", { name: "Booked" }).click();
  await expect(toasts(page).getByText("Puri Taman Sari is now a booking")).toBeVisible();
  await toasts(page).getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL("/budget/bookings/venue-ven1", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByText(/^Booked from Venues on /)).toBeVisible();

  // Both are in the budget's list, and choosing again made no second booking.
  await page.goto("/budget/bookings");
  await expect(bookingRows(page)).toHaveCount(2, { timeout: COMPILE_TIMEOUT });
});

test("B2 add a booking directly: a name is needed, the rest is kept, and it lands on Bookings", async ({ page }) => {
  await openAt(page, "/budget/bookings/new");
  await expect(page.getByRole("heading", { name: "Add a booking", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });

  await page.getByRole("button", { name: "Add booking" }).click();
  await expect(page.getByText("Give the booking a name so you can find it later.")).toBeVisible();
  await expect(page.getByLabel("What it is")).toBeFocused();

  await page.getByLabel("What it is").fill("Wedding rings");
  await page.getByLabel("Category").selectOption("Music/DJ");
  await page.getByLabel("Agreed price").fill("25000000");
  await page.getByLabel("Agreed price").blur();
  await expect(page.getByLabel("Agreed price")).toHaveValue("Rp 25.000.000");
  await page.getByLabel("Paid so far").fill("5000000");
  await page.getByLabel("Paid so far").blur();
  await page.getByRole("radiogroup", { name: "Funder" }).getByRole("radio", { name: "Bella" }).click();
  await page.getByLabel("Next due date").fill(inDays(30));
  await page.getByLabel("Next step").fill("Collect");
  await page.getByRole("button", { name: "Add booking" }).click();

  await expect(page).toHaveURL("/budget/bookings", { timeout: COMPILE_TIMEOUT });
  await expect(toasts(page).getByText("Added Wedding rings")).toBeVisible();
  await expect(bookingRows(page).filter({ hasText: "Wedding rings" })).toContainText("Rp 20.000.000 to pay");
  const doc = (await stored("vendors")).find((d) => d.name === "Wedding rings");
  expect(doc).toMatchObject({ funder: "f-bella", totalPrice: 25_000_000, budgetSpent: 5_000_000, nextTargetDate: inDays(30), nextAction: "Collect" });
});

test("B3 a booking's details save as you go, and the figure and the next step follow", async ({ page }) => {
  await put("vendors", "b3", vendor("Dapur Lestari Catering", { nextTargetDate: inDays(5), nextAction: "Pay the balance" }));
  await openAt(page, "/budget/bookings/vendor-b3");
  await expect(page.getByRole("heading", { name: "Dapur Lestari Catering", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("Every change saves as you go")).toBeVisible();
  await expect(page.getByText("of Rp 30.000.000, with Rp 10.000.000 paid")).toBeVisible();

  const price = page.getByLabel("Agreed price");
  await price.fill("35.000.000");
  await price.blur();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.getByText("of Rp 35.000.000, with Rp 10.000.000 paid")).toBeVisible();
  await page.getByLabel("Funder").selectOption({ label: "Bella" });
  await page.getByLabel("Next step").fill("Send the final menu");
  await page.getByLabel("Next step").blur();
  await expect(page.getByLabel("Next payment")).toContainText("Send the final menu");
  await expect.poll(async () => await storedDoc("vendors", "b3")).toMatchObject({ totalPrice: 35_000_000, funder: "f-bella", nextAction: "Send the final menu" });

  // A cleared name comes back, and words typed as an amount are refused.
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("");
  await name.blur();
  await expect(name).toHaveValue("Dapur Lestari Catering");
  await price.fill("a lot");
  await price.blur();
  await expect(price).toHaveValue("Rp 35.000.000");
});

test("B4 parts: split into a deposit and a balance, add a part, remove it and Undo, and the totals follow", async ({ page }) => {
  await put("vendors", "b4", vendor("Bunga Melati Florist", { category: "Flowers", totalPrice: 8_000_000, budgetSpent: 3_000_000 }));
  await openAt(page, "/budget/bookings/vendor-b4");
  await page.getByRole("button", { name: "Split into parts" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("Split into 2 parts")).toBeVisible();
  await expect(page.locator("summary", { hasText: "Deposit" })).toContainText("paid in full");
  await expect(page.locator("summary", { hasText: "Balance" })).toContainText("Rp 5.000.000");
  await expect(page.getByLabel("Agreed price")).toHaveCount(0);
  await expect(page.getByText("from 2 parts")).toBeVisible();
  await expect.poll(async () => ((await storedDoc("vendors", "b4"))?.subEntries as unknown[]).length).toBe(2);

  await page.getByRole("button", { name: "Add a part" }).click();
  const addon = page.locator("details", { hasText: "Add-on" });
  await addon.getByLabel("Price").fill("2.500.000");
  await addon.getByLabel("Price").blur();
  await expect(page.getByText("from 3 parts")).toBeVisible();
  await expect(page.getByText("Rp 10.500.000").first()).toBeVisible();

  await addon.getByRole("button", { name: "Remove this part" }).click();
  await page.getByRole("button", { name: "Remove part" }).click();
  await expect(addon).toHaveCount(0);
  await expect(page.getByText("from 2 parts")).toBeVisible();
  await toasts(page).locator("[data-kind]", { hasText: "Removed Add-on" }).getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("details", { hasText: "Add-on" })).toBeVisible();
  await expect(page.getByText("from 3 parts")).toBeVisible();
});

test("B6 payments due: late, then soon, then later; recording what's owed takes it off the list", async ({ page }) => {
  await put("vendors", "late", vendor("Dapur Lestari Catering", { totalPrice: 10_000_000, budgetSpent: 6_000_000, nextTargetDate: inDays(-3) }));
  await put("vendors", "soon", vendor("Bunga Melati Florist", { category: "Flowers", totalPrice: 20_000_000, budgetSpent: 0, nextTargetDate: inDays(5) }));
  await put("vendors", "later", vendor("Harmoni String Quartet", { category: "Music", totalPrice: 3_000_000, budgetSpent: 0, nextTargetDate: inDays(60) }));
  await put("vendors", "paid", vendor("Paid Up Photography", { totalPrice: 1_000_000, budgetSpent: 1_000_000, nextTargetDate: inDays(-10) }));
  await put("vendors", "undated", vendor("No Date Decoration", { totalPrice: 2_000_000, budgetSpent: 0 }));

  await openAt(page, "/budget/payments");
  await expect(page.getByText("Late, across 1 payment")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("heading", { name: /^Late/, level: 2 })).toContainText("Rp 4.000.000");
  await expect(page.getByRole("heading", { name: /^In the next 14 days/, level: 2 })).toContainText("Rp 20.000.000");
  await expect(bookingRows(page)).toHaveCount(3);
  await expect(bookingRows(page).nth(0)).toContainText("3 days late");
  await expect(bookingRows(page).nth(1)).toContainText("due in 5 days");
  await expect(bookingRows(page).nth(2)).toContainText("Harmoni String Quartet");
  await expect(page.getByText("Paid Up Photography")).toHaveCount(0);
  await expect(page.getByText("No Date Decoration")).toHaveCount(0);

  await bookingRows(page).nth(0).getByRole("button", { name: "Record payment" }).click();
  const sheet = page.getByRole("dialog", { name: "Record a payment" });
  await expect(sheet.getByLabel("Amount paid")).toHaveValue("Rp 4.000.000");
  await sheet.getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(sheet).toHaveCount(0, { timeout: 15_000 });
  await expect(bookingRows(page)).toHaveCount(2);
  await expect(page.getByText("Dapur Lestari Catering")).toHaveCount(0);
  await expect.poll(async () => (await storedDoc("vendors", "late"))?.budgetSpent).toBe(10_000_000);
});

const whatIf = (name: string, over: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  type: "Decoration",
  totalPrice: 12_000_000,
  funder: "f-greg",
  subEntries: [],
  createdAt: new Date("2026-05-01T10:00:00Z"),
  ...over,
});

async function openWhatIf(page: Page) {
  await put("vendors", "v1", vendor("Villa Samaya", { category: "Other", totalPrice: 300_000_000, budgetSpent: 0 }));
  await put("hypotheticalItems", "w1", whatIf("Fireworks over the lake"));
  await put("hypotheticalItems", "w2", whatIf("Live band for the reception", {
    type: "Music/DJ",
    totalPrice: 0,
    funder: null,
    subEntries: [
      { id: "p1", name: "Deposit", totalPrice: 10_000_000, funder: "f-bella" },
      { id: "p2", name: "Balance", totalPrice: 20_000_000, funder: "f-greg" },
    ],
    createdAt: new Date("2026-05-02T10:00:00Z"),
  }));
  await put("hypotheticalItems", "w3", whatIf("Second photographer", { type: "Photos and Videos", totalPrice: 8_000_000, funder: null, createdAt: new Date("2026-05-03T10:00:00Z") }));
  await openAt(page, "/budget/what-if");
  await expect(page.getByRole("heading", { name: "What-if items", level: 1 })).toBeAttached({ timeout: COMPILE_TIMEOUT });
}

const entry = (page: Page, id: string) => page.locator(`[data-whatif-id="${id}"]`);

test("B8 what-if items: the projected total adds them to what's committed, and an added item moves it", async ({ page }) => {
  await openWhatIf(page);
  await expect(page.getByText("If you went ahead with everything here")).toBeVisible();
  await expect(page.getByText(/^Rp\s?350\.000\.000$/)).toBeVisible();
  await expect(page.getByText("Rp 300.000.000 already committed, plus Rp 50.000.000 in what-if items")).toBeVisible();
  await expect(entry(page, "w2")).toContainText("Rp 30.000.000");

  // Parts: Greg's second item in two parts, then an item added with a price.
  await page.getByRole("button", { name: "Add a what-if item" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a what-if item" });
  await sheet.getByLabel("What it is").fill("Photo booth");
  await sheet.getByLabel("Price").fill("15000000");
  await sheet.getByRole("button", { name: "Add item" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText(/^Rp\s?365\.000\.000$/)).toBeVisible();
  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(/^Rp\s?350\.000\.000$/)).toBeVisible();

  // Splitting an item gives it parts that add up to its price.
  await entry(page, "w3").getByRole("button", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit Second photographer" });
  await edit.getByRole("button", { name: "Split into parts" }).click();
  await expect(edit.getByText("Rp 8.000.000 in all")).toBeVisible();
  await expect(edit.getByLabel("Part name")).toHaveCount(2);
});

test("B9 order bookings and what-ifs: price from the biggest, name from A, and the direction word flips", async ({ page }) => {
  await put("vendors", "a", vendor("Dapur Lestari Catering", { totalPrice: 30_000_000, budgetSpent: 10_000_000, nextTargetDate: inDays(5) }));
  await put("vendors", "b", vendor("Bunga Melati Florist", { category: "Flowers", totalPrice: 8_000_000, budgetSpent: 0 }));
  await put("vendors", "c", vendor("Pelaminan Ayu", { category: "Decoration", totalPrice: 15_000_000, budgetSpent: 10_000_000, subEntries: [part("p1", "Deposit", 10_000_000, 10_000_000, null), part("p2", "Balance", 5_000_000, 0, null)] }));
  await openAt(page, "/budget/bookings");
  await expect(bookingRows(page)).toHaveCount(3, { timeout: COMPILE_TIMEOUT });
  const order = page.getByLabel("Order by");
  await order.selectOption({ label: "Price" });
  await expect(bookingRows(page).first()).toContainText("Dapur Lestari Catering");
  await expect(bookingRows(page).last()).toContainText("Bunga Melati Florist");
  await page.getByRole("button", { name: "Descending" }).click();
  await expect(bookingRows(page).first()).toContainText("Bunga Melati Florist");
  await order.selectOption({ label: "Name" });
  await expect(bookingRows(page).first()).toContainText("Bunga Melati Florist");
  await expect(bookingRows(page).last()).toContainText("Pelaminan Ayu");
  // Parts stay with their booking.
  await expect(bookingRows(page).last()).toContainText("Balance");
});

test("B10 who would pay: an item takes a funder, a part takes its own, and the carry lines follow", async ({ page }) => {
  await openWhatIf(page);
  const carry = page.locator("ul").filter({ hasText: "Not assigned yet" }).first().locator("li");
  await expect(carry).toHaveText([/Greg.*\+ Rp 32\.000\.000/, /Bella.*\+ Rp 10\.000\.000/, /Not assigned yet.*\+ Rp 8\.000\.000/]);

  await entry(page, "w3").getByRole("button", { name: "Edit" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit Second photographer" });
  await sheet.getByRole("radio", { name: "Bella" }).click();
  await expect(sheet.getByText("Saved")).toBeVisible();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(entry(page, "w3")).toContainText("would be paid by Bella");
  await expect(page.locator("li", { hasText: /Bella.*\+ Rp 18\.000\.000/ })).toBeVisible();
  await expect(page.locator("li", { hasText: /Greg.*\+ Rp 32\.000\.000/ })).toBeVisible();
  await expect(page.locator("li", { hasText: /Not assigned yet.*\+/ })).toHaveCount(0);
  await expect.poll(async () => (await storedDoc("hypotheticalItems", "w3"))?.funder).toBe("f-bella");

  // A part can be set to Not assigned, and it stays.
  await entry(page, "w1").getByRole("button", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit Fireworks over the lake" });
  await edit.getByRole("button", { name: "Split into parts" }).click();
  await edit.getByLabel("Who would pay").nth(1).selectOption("");
  await expect(edit.getByText("Saved")).toBeVisible();
  await edit.getByRole("button", { name: "Done" }).click();
  await expect(entry(page, "w1")).toContainText("Rp 0, no funder yet");
});

test("B12 estimate apart from price: the booking says the difference without changing either, and Bookings orders by it", async ({ page }) => {
  await put("vendors", "e1", vendor("Dapur Lestari Catering", { totalPrice: 35_000_000, estimate: 32_000_000 }));
  await put("vendors", "e2", vendor("Bunga Melati Florist", { category: "Flowers", totalPrice: 8_000_000, estimate: 12_000_000 }));
  await put("vendors", "e3", vendor("Harmoni String Quartet", { category: "Music", totalPrice: 5_000_000, estimate: null }));
  await put("venues", "ven1", {
    name: "Villa Samaya Ubud",
    location: "Ubud, Bali",
    budgetEstimate: 250_000_000,
    agreedPrice: 255_000_000,
    guestMax: 300,
    status: "Booked",
    booking: { on: "2026-03-01", from: "venue", removed: false },
    notes: "",
    files: [],
    subEntries: [],
    createdAt: new Date("2026-05-02T10:00:00Z"),
  });

  await openAt(page, "/budget/bookings/vendor-e1");
  await expect(page.getByText(/You estimated\s+Rp 32\.000\.000 while comparing\. The agreed price is\s+Rp 3\.000\.000 higher\./)).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByLabel("Agreed price")).toHaveValue("Rp 35.000.000");
  await page.goto("/budget/bookings/vendor-e2");
  await expect(page.getByText(/The agreed price is\s+Rp 4\.000\.000 lower\./)).toBeVisible({ timeout: COMPILE_TIMEOUT });

  // The estimate field is its own: changing the price leaves the estimate where it was.
  const price = page.getByLabel("Agreed price");
  await price.fill("9.000.000");
  await price.blur();
  await expect.poll(async () => await storedDoc("vendors", "e2")).toMatchObject({ totalPrice: 9_000_000, estimate: 12_000_000 });

  await page.goto("/budget/bookings");
  await page.getByLabel("Order by").selectOption({ label: "Difference from estimate" });
  await expect(bookingRows(page)).toHaveCount(4, { timeout: COMPILE_TIMEOUT });
  // Biggest difference first (the venue's Rp 5.000.000 over); a booking with no estimate goes last.
  await expect(bookingRows(page).first()).toContainText("Villa Samaya Ubud");
  await expect(bookingRows(page).last()).toContainText("Harmoni String Quartet");
});
