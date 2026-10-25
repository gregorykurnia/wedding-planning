import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { openAt, put, resetData, restorePairing, stored, storedDoc, type Value } from "../stories";

test.afterEach(closeOtherContexts);
test.afterAll(restorePairing);

// Task 8.1a, stories F1, F3–F5, F7, F17–F22 and F24: finding and choosing venues, vendors and finalists (guide
// §5.13–§5.16). F6, F8–F16 and F23 have their tests in veil-vendors and veil-vendor.

const venue = (name: string, over: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  location: "",
  budgetEstimate: 0,
  guestMax: 0,
  status: "Shortlist",
  notes: "",
  files: [],
  subEntries: [],
  createdAt: new Date("2026-05-02T10:00:00Z"),
  ...over,
});

const vendor = (name: string, over: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  category: "Decoration",
  contactName: "",
  contactPhone: "",
  contractStatus: "Consideration",
  priceOptions: [],
  notes: "",
  starred: false,
  files: [],
  subEntries: [],
  createdAt: new Date("2026-05-02T10:00:00Z"),
  ...over,
});

const finalist = (name: string, over: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  type: "Other",
  contactName: "",
  contactPhone: "",
  price: 0,
  priceDescription: "",
  bridestoryReviewers: null,
  igFollowers: null,
  nextAction: "",
  notes: "",
  files: [],
  subEntries: [],
  createdAt: new Date("2026-05-02T10:00:00Z"),
  ...over,
});

const file = (name: string, recordRef: Value, extra: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  url: `https://example.com/${name.toLowerCase().replace(/\W+/g, "-")}`,
  folderId: null,
  fileType: "application/pdf",
  fileSize: 2_400_000,
  recordRef,
  createdAt: new Date("2026-05-03T10:00:00Z"),
  ...extra,
});

const toasts = (page: Page) => page.getByRole("status");
const venueRow = (page: Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });
const venueNames = (page: Page) => page.locator('ul[aria-label="Venues"] > li a[href^="/vendors/venues"]');
const card = (page: Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });

async function seedVenues() {
  await put("venues", "ven1", venue("Villa Samaya Ubud", { location: "Ubud, Bali", budgetEstimate: 250_000_000, agreedPrice: 250_000_000, guestMax: 300, status: "Booked", booking: { on: "2026-09-01", from: "venue", removed: false } }));
  await put("venues", "ven2", venue("Puri Taman Sari", { location: "Seminyak, Bali", budgetEstimate: 180_000_000, guestMax: 200, status: "Toured" }));
  await put("venues", "ven3", venue("Bukit Ungasan Cliff"));
  await put("venues", "ven4", venue("Pantai Gelap", { location: "Canggu, Bali", budgetEstimate: 90_000_000, guestMax: 120, status: "Rejected" }));
}

async function openVenues(page: Page) {
  await openAt(page, "/vendors/venues");
  await expect(page.getByRole("heading", { name: "Venues", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test("F1 capture a venue: a name is needed, the rest is kept, and the row says it with an Undo", async ({ page }) => {
  await resetData();
  await openVenues(page);
  await page.getByRole("button", { name: "Add a venue" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a venue" });
  await sheet.getByRole("button", { name: "Add venue" }).click();
  await expect(sheet.getByText("Give the venue a name.")).toBeVisible();

  await sheet.getByLabel("Name").fill("Bukit Jimbaran Lawn");
  await sheet.getByLabel("Location").fill("Jimbaran, Bali");
  await sheet.getByLabel("Estimated cost").fill("295000000");
  await sheet.getByLabel("Most guests").fill("350");
  await sheet.getByLabel("Notes").fill("Ask about the rain plan.");
  await sheet.getByRole("button", { name: "Add venue" }).click();
  await expect(sheet).toBeHidden();

  const row = venueRow(page, "Bukit Jimbaran Lawn");
  await expect(row).toContainText("Rp 295.000.000");
  await expect(row).toContainText("Jimbaran, Bali");
  await expect(row).toContainText("Up to 350 guests");
  await expect(row).toContainText("Noted");
  expect((await stored("venues")).find((d) => d.name === "Bukit Jimbaran Lawn")).toMatchObject({ location: "Jimbaran, Bali", budgetEstimate: 295_000_000, guestMax: 350, notes: "Ask about the rain plan." });

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(venueRow(page, "Bukit Jimbaran Lawn")).toHaveCount(0);
});

test("F3 venue stage: five stages in order, Booked makes one booking, and Ruled out leaves the list", async ({ page }) => {
  await resetData();
  await seedVenues();
  await openVenues(page);
  await venueRow(page, "Puri Taman Sari").getByRole("link", { name: "Puri Taman Sari" }).click();
  const sheet = page.getByRole("dialog", { name: "Puri Taman Sari" });
  await expect(sheet.getByRole("radio")).toHaveText(["Noted", "Contacted", "Visited", "Booked", "Ruled out"]);
  await expect(sheet.getByRole("radio", { name: "Visited" })).toHaveAttribute("aria-checked", "true");

  await sheet.getByRole("radio", { name: "Booked" }).click();
  await expect(toasts(page).getByText("Puri Taman Sari is now a booking")).toBeVisible();
  await expect.poll(async () => (await storedDoc("venues", "ven2"))?.status).toBe("Booked");
  expect(((await storedDoc("venues", "ven2"))?.booking as { from: string }).from).toBe("venue");

  // Moving off Booked and back doesn't make a second booking.
  await sheet.getByRole("radio", { name: "Contacted" }).click();
  await expect.poll(async () => (await storedDoc("venues", "ven2"))?.status).toBe("Contacted");
  await sheet.getByRole("radio", { name: "Booked" }).click();
  await expect.poll(async () => (await storedDoc("venues", "ven2"))?.status).toBe("Booked");

  await sheet.getByRole("radio", { name: "Ruled out" }).click();
  await expect.poll(async () => (await storedDoc("venues", "ven2"))?.status).toBe("Rejected");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(venueRow(page, "Puri Taman Sari")).toHaveCount(0);
  await expect(page.getByText("2 ruled out hidden")).toBeVisible();
});

test("F4 narrow venues: search, cost and capacity limits, ruled-out venues, and a way back", async ({ page }) => {
  await resetData();
  await seedVenues();
  await openVenues(page);
  await expect(page.getByText("3 venues, 1 ruled out hidden")).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Search venues" });
  await search.fill("seminyak");
  await expect(page.getByText("1 venue here")).toBeVisible();
  await expect(venueRow(page, "Puri Taman Sari")).toBeVisible();
  await expect(search).toBeFocused();

  await search.fill("beach");
  await page.getByRole("textbox", { name: "Costs at most" }).fill("200000000");
  await page.getByRole("textbox", { name: "Costs at most" }).blur();
  await expect(page.getByRole("heading", { name: "No venues match" })).toBeVisible();
  await page.getByRole("button", { name: "Show every venue" }).first().click();
  await expect(page.getByText("4 venues")).toBeVisible();
  await expect(venueRow(page, "Pantai Gelap")).toBeVisible();

  await page.getByRole("checkbox", { name: "Hide ruled out" }).check();
  await page.getByRole("textbox", { name: "Holds at least guests" }).fill("250");
  await page.getByRole("textbox", { name: "Holds at least guests" }).blur();
  await expect(page.getByText("1 venue here")).toBeVisible();
  await expect(venueRow(page, "Villa Samaya Ubud")).toBeVisible();
  await page.getByRole("button", { name: "Show every venue" }).first().click();

  await page.getByLabel("Stage", { exact: true }).selectOption("Rejected");
  await expect(venueRow(page, "Pantai Gelap")).toBeVisible();
  await expect(venueRow(page, "Villa Samaya Ubud")).toHaveCount(0);
});

test("F5 order venues: cost cheapest first by default, capacity largest first, name from A, and the direction flips", async ({ page }) => {
  await resetData();
  await seedVenues();
  await openVenues(page);
  await expect(venueNames(page)).toHaveText(["Puri Taman Sari", "Villa Samaya Ubud", "Bukit Ungasan Cliff"]);
  await page.getByLabel("Order by").selectOption("capacity");
  await expect(venueNames(page).first()).toHaveText("Villa Samaya Ubud");
  await page.getByLabel("Order by").selectOption("name");
  await expect(venueNames(page).first()).toHaveText("Bukit Ungasan Cliff");
  await page.getByRole("button", { name: "Ascending" }).click();
  await expect(venueNames(page).first()).toHaveText("Villa Samaya Ubud");
});

test("F22 files on a venue: its files show in the venue's sheet, and a file uploaded there joins them", async ({ page }) => {
  await resetData();
  await seedVenues();
  await put("weddingFiles", "f1", file("Brochure.pdf", { kind: "venue", id: "ven2" }));
  await page.route("https://api.cloudinary.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        public_id: "test-upload/floorplan",
        secure_url: "https://res.cloudinary.com/test-cloud/raw/upload/v1/test-upload/floorplan.pdf",
        resource_type: "raw",
        format: "pdf",
        bytes: 24,
      }),
    }),
  );
  await openVenues(page);
  await expect(venueRow(page, "Puri Taman Sari")).toContainText("1 file");
  await venueRow(page, "Puri Taman Sari").getByRole("link", { name: "Puri Taman Sari" }).click();
  const sheet = page.getByRole("dialog", { name: "Puri Taman Sari" });
  await expect(sheet.getByRole("link", { name: /Brochure\.pdf/ })).toHaveAttribute("href", "https://example.com/brochure-pdf");

  await sheet.getByRole("button", { name: /Add files/ }).click();
  const upload = page.getByRole("dialog", { name: "Upload files" });
  await upload.locator('input[type="file"]').setInputFiles({ name: "Floorplan.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(100, "x") });
  await expect(upload.getByText("Uploaded", { exact: true })).toBeVisible();
  await upload.getByRole("button", { name: "Done" }).click();
  await expect(sheet.getByRole("link", { name: /Floorplan\.pdf/ })).toBeVisible();
  await expect
    .poll(async () => (await stored("weddingFiles")).some((f) => f.name === "Floorplan.pdf" && (f.recordRef as { id: string }).id === "ven2"))
    .toBe(true);
});

test("F7 WhatsApp: a phone number with a leading 0 opens WhatsApp on the country code, on a vendor and on a finalist", async ({ page }) => {
  await resetData();
  await put("vendors", "v1", vendor("Kebun Bunga Atelier", { contactName: "Bu Ayu", contactPhone: "0812 3456 7890" }));
  await put("shortlist", "s1", finalist("Kebun Bunga Atelier", { type: "Decoration", contactName: "Bu Ayu", contactPhone: "0812 3456 7890", sourceVendorId: "v1" }));
  await put("shortlist", "s2", finalist("Bare Studio", { type: "Entertainment" }));
  await openAt(page, "/vendors/v1");
  await expect(page.getByRole("link", { name: "Message on WhatsApp" })).toHaveAttribute("href", "https://wa.me/6281234567890", { timeout: COMPILE_TIMEOUT });
  await page.goto("/vendors/shortlist/s1");
  await expect(page.getByRole("link", { name: "Message on WhatsApp" })).toHaveAttribute("href", "https://wa.me/6281234567890", { timeout: COMPILE_TIMEOUT });

  // Changing the number changes the link; no number, no link.
  await page.getByLabel("Phone").fill("+62 811 222 333");
  await page.getByLabel("Phone").blur();
  await expect(page.getByRole("link", { name: "Message on WhatsApp" })).toHaveAttribute("href", "https://wa.me/62811222333");
  await page.goto("/vendors/shortlist/s2");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bare Studio", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("link", { name: "Message on WhatsApp" })).toHaveCount(0);
});

const pkg = (id: string, name: string, price: number): Value => ({ id, name, type: "Decoration", price, priceDescription: name, includes: "", bridestoryReviewers: null, igFollowers: null, nextAction: "", notes: "", files: [] });

async function seedFinalists() {
  await put("vendors", "v1", vendor("Kebun Bunga Atelier"));
  await put("shortlist", "s1", finalist("Kebun Bunga Atelier", {
    type: "Decoration",
    price: 45_000_000,
    priceDescription: "Silver",
    includes: "Arch and aisle flowers",
    bridestoryReviewers: 120,
    igFollowers: 12_300,
    nextAction: "Ask about the delivery fee",
    sourceVendorId: "v1",
    preferredPackageId: "k1",
    subEntries: [pkg("k1", "Gold", 62_500_000)],
  }));
  await put("shortlist", "s2", finalist("Arka Visual", { type: "Photo and Video", price: 18_000_000, priceDescription: "Signature", bridestoryReviewers: 64, igFollowers: 98_765_432, subEntries: [pkg("k2", "Half day", 9_000_000)], preferredPackageId: "main" }));
  await put("shortlist", "s3", finalist("Dapur Lestari Catering", { type: "Catering", price: 80_000_000, priceDescription: "Buffet for 300", createdAt: new Date("2026-05-04T10:00:00Z") }));
  await put("shortlist", "s4", finalist("Pelaminan Ayu", { type: "Decoration", price: 30_000_000, priceDescription: "Classic", createdAt: new Date("2026-05-03T10:00:00Z") }));
}

test("F17 packages: add one, lean towards another, and remove with Undo", async ({ page }) => {
  await resetData();
  await seedFinalists();
  await openAt(page, "/vendors/shortlist/s1");
  await expect(page.getByRole("heading", { name: /^Packages\s*2 packages$/ })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("Leaning towards Gold")).toBeVisible();

  await page.getByRole("button", { name: "Add a package" }).click();
  const add = page.getByRole("dialog", { name: "Add a package" });
  await add.getByLabel("Name").fill("Platinum");
  await add.getByLabel("Price").fill("90000000");
  await add.getByRole("button", { name: "Add package" }).click();
  await expect(page.getByRole("heading", { name: /^Packages\s*3 packages$/ })).toBeVisible();
  await expect.poll(async () => ((await storedDoc("shortlist", "s1"))?.subEntries as { name: string; price: number }[]).map((p) => [p.name, p.price])).toContainEqual(["Platinum", 90_000_000]);

  await page.getByRole("listitem").filter({ hasText: "Silver" }).getByRole("button", { name: "Lean towards this one" }).click();
  await expect(page.getByText("Leaning towards Silver")).toBeVisible();
  await expect.poll(async () => (await storedDoc("shortlist", "s1"))?.preferredPackageId).toBe("main");

  await page.getByRole("listitem").filter({ hasText: "Platinum" }).getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog", { name: "Remove Platinum?" }).getByRole("button", { name: "Remove package" }).click();
  await expect(page.getByRole("heading", { name: /^Packages\s*2 packages$/ })).toBeVisible();
  await toasts(page).locator("[data-kind]", { hasText: "Removed Platinum" }).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { name: /^Packages\s*3 packages$/ })).toBeVisible();
});

test("F18 reviews and followers: counts stay short on a card, and a number that isn't one is refused", async ({ page }) => {
  await resetData();
  await seedFinalists();
  await openAt(page, "/vendors/shortlist");
  await expect(card(page, "Kebun Bunga Atelier")).toContainText("120 reviews, 12,3k followers", { timeout: COMPILE_TIMEOUT });
  await expect(card(page, "Arka Visual")).toContainText("64 reviews, 98,8M followers");
  await expect(card(page, "Pelaminan Ayu")).toContainText("No reviews or followers yet");

  await page.goto("/vendors/shortlist/s1");
  await page.getByLabel("Reviews").fill("lots");
  await page.getByLabel("Reviews").blur();
  await expect(page.getByText("“lots” isn’t a number of reviews. Use digits, like 120. It stays 120.")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByLabel("Reviews")).toHaveValue("120");
  await page.getByLabel("Reviews").fill("150");
  await page.getByLabel("Reviews").blur();
  await expect.poll(async () => (await storedDoc("shortlist", "s1"))?.bridestoryReviewers).toBe(150);
});

test("F19 finalists by category: a focus narrows the cards, and the orders reorder them", async ({ page }) => {
  await resetData();
  await seedFinalists();
  await openAt(page, "/vendors/shortlist");
  await expect(page.getByText("4 finalists in 3 categories")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([/Catering\s*1 finalist/, /Decoration\s*2 finalists/, /Photo and Video\s*1 finalist/]);

  await page.getByRole("button", { name: /^Decoration\s*2$/ }).click();
  await expect(page.getByRole("button", { name: /^Decoration\s*2$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(card(page, "Kebun Bunga Atelier")).toBeVisible();
  await expect(card(page, "Arka Visual")).toHaveCount(0);
  await page.getByRole("button", { name: /^All$/ }).click();

  const names = page.locator('a[href^="/vendors/shortlist/s"]');
  await page.getByLabel("Order by").selectOption("price");
  await expect(names).toHaveText(["Arka Visual", "Pelaminan Ayu", "Kebun Bunga Atelier", "Dapur Lestari Catering"]);
  await page.getByRole("button", { name: "Ascending" }).click();
  await expect(names.first()).toHaveText("Dapur Lestari Catering");
});

test("F20 vendor files appear: a finalist copied from a vendor lists the vendor's files, as from the vendor", async ({ page }) => {
  await resetData();
  await seedFinalists();
  await put("weddingFiles", "f-own", file("Moodboard.pdf", { kind: "finalist", id: "s1" }));
  await openAt(page, "/vendors/shortlist/s1");
  await expect(page.getByRole("heading", { name: /^Files\s*1 file$/ })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("Files added to Kebun Bunga Atelier in Vendors appear here by themselves.")).toBeVisible();

  // A file added to the vendor afterwards arrives without a reload.
  await put("weddingFiles", "f-vendor", file("Vendor-quote.pdf", { kind: "vendor", id: "v1" }, { createdAt: new Date() }));
  await expect(page.getByRole("link", { name: /Vendor-quote\.pdf.*, from the vendor/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Moodboard\.pdf/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Files\s*2 files$/ })).toBeVisible();
});

test("F21 finalist from scratch: added straight to the shortlist with a package and a price, and Undo takes it off", async ({ page }) => {
  await resetData();
  await seedFinalists();
  await openAt(page, "/vendors/shortlist");
  await page.getByRole("button", { name: "Add a finalist" }).click({ timeout: COMPILE_TIMEOUT });
  const sheet = page.getByRole("dialog", { name: "Add a finalist" });
  await sheet.getByRole("button", { name: "Add finalist" }).click();
  await expect(sheet.getByText("Give the finalist a name.")).toBeVisible();

  await sheet.getByLabel("Name").fill("Lumina Wedding Photography");
  await sheet.getByLabel("Category").selectOption("Photo and Video");
  await sheet.getByLabel("First package").fill("Full day");
  await sheet.getByLabel("Its price").fill("24000000");
  await sheet.getByRole("button", { name: "Add finalist" }).click();
  await expect(sheet).toBeHidden();
  const added = card(page, "Lumina Wedding Photography");
  await expect(added).toContainText("Full day");
  await expect(added).toContainText("Rp 24.000.000");
  await expect(page.getByText("5 finalists in 3 categories")).toBeVisible();
  const doc = (await stored("shortlist")).find((d) => d.name === "Lumina Wedding Photography");
  expect(doc).toMatchObject({ type: "Photo and Video", price: 24_000_000, priceDescription: "Full day" });
  expect(doc?.sourceVendorId ?? null).toBeNull();

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(card(page, "Lumina Wedding Photography")).toHaveCount(0);
});

test("F24 move into vendors or book: Move into Vendors makes a vendor and Undo takes it back; Book it makes a booking", async ({ page }) => {
  await resetData();
  await seedFinalists();
  await openAt(page, "/vendors/shortlist/s2");
  await page.getByRole("button", { name: "Move into Vendors" }).click({ timeout: COMPILE_TIMEOUT });
  const move = page.getByRole("dialog", { name: "Move Arka Visual into Vendors?" });
  await move.getByRole("button", { name: "Move into Vendors" }).click();
  await expect(toasts(page).getByText("Arka Visual is now in Vendors")).toBeVisible();
  await expect.poll(async () => (await storedDoc("shortlist", "s2"))?.sourceVendorId).toBeTruthy();
  const made = String((await storedDoc("shortlist", "s2"))?.sourceVendorId);
  expect((await storedDoc("vendors", made))?.contractStatus).toBe("Consideration");
  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => await storedDoc("vendors", made)).toBeNull();

  await page.goto("/vendors/shortlist/s1");
  await page.getByRole("button", { name: "Book it", exact: true }).click({ timeout: COMPILE_TIMEOUT });
  const book = page.getByRole("dialog", { name: "Book Kebun Bunga Atelier" });
  const chips = book.getByRole("radiogroup", { name: "Package" });
  await expect(chips.getByRole("radio", { name: "Gold, Rp 62.500.000" })).toHaveAttribute("aria-checked", "true");
  await chips.getByRole("radio", { name: "Silver, Rp 45.000.000" }).click();
  await book.getByRole("button", { name: "Book it" }).click();
  await expect(toasts(page).getByText("Kebun Bunga Atelier is now a booking")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the booking" })).toHaveAttribute("href", "/budget/bookings/vendor-v1");
  await expect.poll(async () => (await storedDoc("vendors", "v1"))?.estimate).toBe(45_000_000);
  expect((await storedDoc("shortlist", "s1"))?.movedTo).toEqual({ kind: "booking", id: "vendor-v1" });
});
