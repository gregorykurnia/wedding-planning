import { expect, test, type Browser, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { restorePairing } from "../seed";

test.afterEach(closeOtherContexts);

// Task 4.15: the Venues screen at /vendors/venues, against the emulators (guide §5.15).

const DOCUMENTS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Value = string | number | boolean | null | Date | Value[] | { [key: string]: Value };

/** A JS value as a Firestore REST value. */
function encode(value: Value): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
}

async function put(collection: string, id: string, fields: Record<string, Value>) {
  const res = await fetch(`${DOCUMENTS}/${collection}/${id}`, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, encode(v)])) }),
  });
  expect(res.ok).toBe(true);
}

interface Stored {
  integerValue?: string;
  stringValue?: string;
  booleanValue?: boolean;
  mapValue?: { fields: Record<string, Stored> };
}

/** A stored document's fields, as Firestore's REST API writes them; null when it is gone. */
async function stored(collection: string, id: string): Promise<Record<string, Stored> | null> {
  const res = await fetch(`${DOCUMENTS}/${collection}/${id}`, { headers: ADMIN });
  return res.ok ? ((await res.json()).fields as Record<string, Stored>) : null;
}

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

const LONG_NOTE = `${"Rain plan and a very long list of things to ask about the sound limit. ".repeat(3)}END`;

// This spec empties Firestore, so the specs after it get the accounts paired again.
test.afterAll(restorePairing);

test.beforeEach(async () => {
  const res = await fetch(`${DOCUMENTS.replace("/v1/", "/emulator/v1/")}`, { method: "DELETE" });
  expect(res.ok).toBe(true);
  await put("settings", "wedding", {
    yourName: "Greg",
    partnerName: "Bella",
    partnerEmail: TEST_ACCOUNTS[1].email,
  });
  await put(
    "venues",
    "ven1",
    venue("Villa Samaya Ubud", {
      location: "Ubud, Bali",
      budgetEstimate: 250_000_000,
      agreedPrice: 250_000_000,
      guestMax: 300,
      status: "Booked",
      booking: { on: "2026-09-01", from: "venue", removed: false },
      notes: "Pool and garden. Rain plan: https://villasamaya.example/rain",
    }),
  );
  await put(
    "venues",
    "ven2",
    venue("Puri Taman Sari", { location: "Seminyak, Bali", budgetEstimate: 180_000_000, guestMax: 200, status: "Toured", notes: LONG_NOTE }),
  );
  await put("venues", "ven3", venue("Bukit Ungasan Cliff"));
  await put(
    "venues",
    "ven4",
    venue("Pantai Gelap", { location: "Canggu, Bali", budgetEstimate: 90_000_000, guestMax: 120, status: "Rejected" }),
  );
  await put("weddingFiles", "f1", {
    name: "Brochure.pdf",
    url: "https://example.com/brochure.pdf",
    folderId: null,
    fileType: "application/pdf",
    fileSize: 1_200_000,
    recordRef: { kind: "venue", id: "ven2" },
    createdAt: new Date("2026-05-03T10:00:00Z"),
  });
});

async function signInAs(
  browser: Browser,
  account: (typeof TEST_ACCOUNTS)[number],
  viewport?: { width: number; height: number },
  path = "/vendors/venues",
) {
  const context = await browser.newContext(viewport ? { viewport } : {});
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Venues", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page;
}

const rowOf = (page: Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });
const toasts = (page: Page) => page.getByRole("status");

test("shows the booked line, the rows and the count with the ruled-out one hidden", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);

  await expect(page.getByRole("link", { name: "Villa Samaya Ubud", exact: true }).first()).toHaveAttribute(
    "href",
    "/budget/bookings/venue-ven1",
  );
  await expect(page.getByText("Booked:")).toBeVisible();
  await expect(page.getByText("3 venues, 1 ruled out hidden")).toBeVisible();
  await expect(rowOf(page, "Pantai Gelap")).toHaveCount(0);

  // A full row: cost, place, capacity, stage, files and the note with its link.
  const booked = rowOf(page, "Villa Samaya Ubud");
  await expect(booked).toContainText("Rp 250.000.000");
  await expect(booked).toContainText("Ubud, Bali");
  await expect(booked).toContainText("Up to 300 guests");
  await expect(booked).toContainText("Booked");
  await expect(booked.getByRole("link", { name: "villasamaya.example/rain" })).toHaveAttribute(
    "href",
    "https://villasamaya.example/rain",
  );
  const tour = rowOf(page, "Puri Taman Sari");
  await expect(tour).toContainText("Visited");
  await expect(tour).toContainText("1 file");
  // The note stops at 140 characters.
  await expect(tour).toContainText("…");
  await expect(tour).not.toContainText("END");

  // A bare row.
  const bare = rowOf(page, "Bukit Ungasan Cliff");
  await expect(bare).toContainText("No estimate");
  await expect(bare).toContainText("No location");
  await expect(bare).toContainText("Capacity unknown");
  await expect(bare).toContainText("Noted");

  // The default order is cost, cheapest first, blanks last.
  const names = page.locator('ul[aria-label="Venues"] > li a[href^="/vendors/venues"]');
  await expect(names).toHaveText(["Puri Taman Sari", "Villa Samaya Ubud", "Bukit Ungasan Cliff"]);
});

test("search, the filters and the orders narrow the list, with a way back", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  const search = page.getByRole("searchbox", { name: "Search venues" });

  await search.fill("seminyak");
  await expect(page.getByText("1 venue here")).toBeVisible();
  await expect(rowOf(page, "Puri Taman Sari")).toBeVisible();
  await expect(search).toBeFocused();

  // Nothing fits: the title, what was asked and a way back that also shows ruled-out venues.
  await search.fill("beach");
  await page.getByRole("textbox", { name: "Costs at most" }).fill("200000000");
  await page.getByRole("textbox", { name: "Costs at most" }).blur();
  await expect(page.getByRole("heading", { name: "No venues match" })).toBeVisible();
  await expect(page.getByText("Nothing fits “beach”, at most Rp 200.000.000.")).toBeVisible();
  await page.getByRole("button", { name: "Show every venue" }).first().click();
  await expect(page.getByText("4 venues")).toBeVisible();
  await expect(rowOf(page, "Pantai Gelap")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Hide ruled out" })).not.toBeChecked();

  // Hide ruled out comes back, and a limit leaves out venues that don't say.
  await page.getByRole("checkbox", { name: "Hide ruled out" }).check();
  await page.getByRole("textbox", { name: "Holds at least guests" }).fill("250");
  await page.getByRole("textbox", { name: "Holds at least guests" }).blur();
  await expect(page.getByText("1 venue here")).toBeVisible();
  await expect(rowOf(page, "Villa Samaya Ubud")).toBeVisible();
  await expect(rowOf(page, "Puri Taman Sari")).toHaveCount(0);
  await expect(rowOf(page, "Bukit Ungasan Cliff")).toHaveCount(0);
  await page.getByRole("button", { name: "Show every venue" }).first().click();

  // Stage: choosing Ruled out shows them.
  await page.getByLabel("Stage", { exact: true }).selectOption("Rejected");
  await expect(rowOf(page, "Pantai Gelap")).toBeVisible();
  await expect(rowOf(page, "Villa Samaya Ubud")).toHaveCount(0);
  await page.getByRole("button", { name: "Show every venue" }).first().click();

  // Orders: capacity starts with the largest, name from A.
  await page.getByLabel("Order by").selectOption("capacity");
  const names = page.locator('ul[aria-label="Venues"] > li a[href^="/vendors/venues"]');
  await expect(names.first()).toHaveText("Villa Samaya Ubud");
  await page.getByLabel("Order by").selectOption("name");
  await expect(names.first()).toHaveText("Bukit Ungasan Cliff");
  await page.getByRole("button", { name: "Ascending" }).click();
  await expect(names.first()).toHaveText("Villa Samaya Ubud");
});

test("a venue's sheet saves as you go, shows its files and the partner's address opens it", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await rowOf(page, "Puri Taman Sari").getByRole("link", { name: "Puri Taman Sari" }).click();
  const sheet = page.getByRole("dialog", { name: "Puri Taman Sari" });
  await expect(sheet.getByRole("radio", { name: "Visited" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByRole("radio")).toHaveText(["Noted", "Contacted", "Visited", "Booked", "Ruled out"]);
  await expect(sheet.getByLabel("Location")).toHaveValue("Seminyak, Bali");
  await expect(sheet.getByLabel("Estimated cost")).toHaveValue("Rp 180.000.000");
  await expect(sheet.getByLabel("Most guests")).toHaveValue("200");
  await expect(sheet.getByRole("heading", { name: "Files" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: /Brochure\.pdf/ })).toHaveAttribute("href", "https://example.com/brochure.pdf");

  await sheet.getByLabel("Estimated cost").fill("200000000");
  await sheet.getByLabel("Estimated cost").press("Enter");
  await expect(sheet.getByLabel("Estimated cost")).toHaveValue("Rp 200.000.000");
  await sheet.getByLabel("Most guests").fill("250");
  await sheet.getByLabel("Most guests").press("Enter");
  await sheet.getByLabel("Location").fill("Seminyak");
  await sheet.getByLabel("Location").blur();
  await sheet.getByRole("radio", { name: "Contacted" }).click();
  await expect(sheet.getByText("Saved")).toBeVisible();

  // Text for a number is refused in place, quoting it and keeping the old number.
  await sheet.getByLabel("Most guests").fill("lots");
  await sheet.getByLabel("Most guests").press("Enter");
  await expect(sheet.getByText("“lots” isn’t a number of guests. Use digits, like 250. It stays 250.")).toBeVisible();
  await expect(sheet.getByLabel("Most guests")).toHaveValue("250");

  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();
  const row = rowOf(page, "Puri Taman Sari");
  await expect(row).toContainText("Rp 200.000.000");
  await expect(row).toContainText("Up to 250 guests");
  await expect(row).toContainText("Seminyak");
  await expect(row).toContainText("Contacted");
  expect((await stored("venues", "ven2"))?.budgetEstimate.integerValue).toBe("200000000");
  expect((await stored("venues", "ven2"))?.status.stringValue).toBe("Contacted");

  // `?venue=<id>` (the agenda and the overview link here) opens the sheet and clears the address.
  await page.goto("/vendors/venues?venue=ven3");
  await expect(page.getByRole("dialog", { name: "Bukit Ungasan Cliff" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/vendors/venues");
});

test("choosing Booked makes the venue a booking, once, and the toast opens it", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await rowOf(page, "Puri Taman Sari").getByRole("link", { name: "Puri Taman Sari" }).click();
  const sheet = page.getByRole("dialog", { name: "Puri Taman Sari" });
  await sheet.getByRole("radio", { name: "Booked" }).click();
  await expect(toasts(page).getByText("Puri Taman Sari is now a booking")).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "Booked" })).toHaveAttribute("aria-checked", "true");

  const doc = await stored("venues", "ven2");
  expect(doc?.booking.mapValue?.fields.from.stringValue).toBe("venue");
  expect(doc?.agreedPrice.integerValue).toBe("180000000");

  await toasts(page).getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL("/budget/bookings/venue-ven2", { timeout: COMPILE_TIMEOUT });
});

test("adds a venue with a name, books one at once, and undoes the add", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await page.getByRole("button", { name: "Add a venue" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a venue" });
  await expect(sheet.getByRole("radio", { name: "Noted" })).toHaveAttribute("aria-checked", "true");

  // A name is required: the field says so and keeps focus.
  await sheet.getByRole("button", { name: "Add venue" }).click();
  await expect(sheet.getByText("Give the venue a name.")).toBeVisible();
  await expect(sheet.getByLabel("Name")).toBeFocused();

  await sheet.getByLabel("Name").fill("Bukit Jimbaran Lawn");
  await sheet.getByLabel("Location").fill("Jimbaran, Bali");
  await sheet.getByLabel("Estimated cost").fill("295000000");
  await sheet.getByLabel("Most guests").fill("350");
  await sheet.getByLabel("Notes").fill("Ask about the rain plan.");
  await sheet.getByRole("button", { name: "Add venue" }).click();
  await expect(sheet).toBeHidden();

  const added = rowOf(page, "Bukit Jimbaran Lawn");
  await expect(added).toHaveClass(/\bflash\b/);
  await expect(added).toContainText("Rp 295.000.000");
  await expect(added).toContainText("Jimbaran, Bali");
  await expect(added).toContainText("Up to 350 guests");
  await expect(added).toContainText("Noted");
  await expect(page.getByText("4 venues, 1 ruled out hidden")).toBeVisible();

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect(rowOf(page, "Bukit Jimbaran Lawn")).toHaveCount(0);
  await expect(page.getByText("3 venues, 1 ruled out hidden")).toBeVisible();

  // Added as Booked it is a booking from the start, and the toast opens it.
  await page.getByRole("button", { name: "Add a venue" }).click();
  await sheet.getByRole("radio", { name: "Booked" }).click();
  await sheet.getByLabel("Name").fill("Hotel Ballroom");
  await sheet.getByLabel("Estimated cost").fill("120000000");
  await sheet.getByRole("button", { name: "Add venue" }).click();
  await expect(toasts(page).getByText("Hotel Ballroom is now a booking")).toBeVisible();
  await expect(rowOf(page, "Hotel Ballroom")).toContainText("Booked");
  await expect(page.getByText("Booked:").first()).toBeVisible();
  const doc = (await fetch(`${DOCUMENTS}/venues`, { headers: ADMIN }).then((r) => r.json())).documents.find(
    (d: { fields: { name: { stringValue: string } } }) => d.fields.name.stringValue === "Hotel Ballroom",
  );
  expect(doc.fields.booking.mapValue.fields.from.stringValue).toBe("venue");
  expect(doc.fields.agreedPrice.integerValue).toBe("120000000");
});

test("removing a venue asks first, says what stays, and Undo brings it back", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await rowOf(page, "Puri Taman Sari").getByRole("link", { name: "Puri Taman Sari" }).click();
  const sheet = page.getByRole("dialog", { name: "Puri Taman Sari" });
  await sheet.getByRole("button", { name: "Remove venue" }).click();

  const confirm = page.getByRole("dialog", { name: "Remove Puri Taman Sari?" });
  await expect(
    confirm.getByText(
      "It leaves Venues, with its notes. Its file stays in Files › Venues › Puri Taman Sari. You can undo for a few seconds.",
    ),
  ).toBeVisible();
  await confirm.getByRole("button", { name: "Keep it" }).click();
  await expect(rowOf(page, "Puri Taman Sari")).toBeVisible();

  await sheet.getByRole("button", { name: "Remove venue" }).click();
  await confirm.getByRole("button", { name: "Remove venue" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(rowOf(page, "Puri Taman Sari")).toHaveCount(0);
  await expect(toasts(page).getByText("Removed Puri Taman Sari")).toBeVisible();
  expect(await stored("venues", "ven2")).toBeNull();

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  const back = rowOf(page, "Puri Taman Sari");
  await expect(back).toBeVisible();
  await expect(back).toHaveClass(/\bflash\b/);
  await expect(back).toContainText("Rp 180.000.000");
});

test("removing a booked venue leaves Venues but keeps its booking in the budget", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0]);
  await rowOf(page, "Villa Samaya Ubud").getByRole("link", { name: "Villa Samaya Ubud" }).click();
  const sheet = page.getByRole("dialog", { name: "Villa Samaya Ubud" });
  await sheet.getByRole("button", { name: "Remove venue" }).click();
  const confirm = page.getByRole("dialog", { name: "Remove Villa Samaya Ubud?" });
  await expect(confirm.getByText("Its booking stays in the budget.")).toBeVisible();
  await confirm.getByRole("button", { name: "Remove venue" }).click();

  await expect(rowOf(page, "Villa Samaya Ubud")).toHaveCount(0);
  await expect(page.getByText("Booked:")).toHaveCount(0);
  const doc = await stored("venues", "ven1");
  expect(doc?.booking.mapValue?.fields.from.stringValue).toBe("direct");
  expect(doc?.booking.mapValue?.fields.removed.booleanValue).toBe(false);

  // The booking is still there.
  await page.goto("/budget/bookings/venue-ven1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Villa Samaya Ubud/, { timeout: COMPILE_TIMEOUT });

});

test("a venue's sheet closes when the partner removes it", async ({ browser }) => {
  const greg = await signInAs(browser, TEST_ACCOUNTS[0]);
  await rowOf(greg, "Bukit Ungasan Cliff").getByRole("link", { name: "Bukit Ungasan Cliff" }).click();
  await expect(greg.getByRole("dialog", { name: "Bukit Ungasan Cliff" })).toBeVisible();

  const bella = await signInAs(browser, TEST_ACCOUNTS[1]);
  await rowOf(bella, "Bukit Ungasan Cliff").getByRole("link", { name: "Bukit Ungasan Cliff" }).click();
  await bella.getByRole("button", { name: "Remove venue" }).click();
  await bella.getByRole("dialog", { name: "Remove Bukit Ungasan Cliff?" }).getByRole("button", { name: "Remove venue" }).click();

  await expect(greg.getByRole("dialog", { name: "Bukit Ungasan Cliff" })).toBeHidden({ timeout: 15_000 });
  await expect(rowOf(greg, "Bukit Ungasan Cliff")).toHaveCount(0);
});

test("Bella adds a venue and Greg sees the row flash and a toast", async ({ browser }) => {
  const greg = await signInAs(browser, TEST_ACCOUNTS[0]);
  const bella = await signInAs(browser, TEST_ACCOUNTS[1]);

  await bella.getByRole("button", { name: "Add a venue" }).click();
  const sheet = bella.getByRole("dialog", { name: "Add a venue" });
  await sheet.getByLabel("Name").fill("Bukit Jimbaran Lawn");
  await sheet.getByRole("button", { name: "Add venue" }).click();

  await expect(greg.getByRole("status").getByText("Bella added Bukit Jimbaran Lawn")).toBeVisible({ timeout: 15_000 });
  const row = rowOf(greg, "Bukit Jimbaran Lawn");
  await expect(row).toBeVisible();
  await expect(row).toHaveClass(/\bflash\b/);
  await expect(bella.getByRole("status").getByText(/Bella added/)).toHaveCount(0);
});

test("on a phone the rows stay readable and nothing scrolls sideways", async ({ browser }) => {
  const page = await signInAs(browser, TEST_ACCOUNTS[0], { width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(rowOf(page, "Villa Samaya Ubud")).toContainText("Rp 250.000.000");
  await rowOf(page, "Villa Samaya Ubud").getByRole("link", { name: "Villa Samaya Ubud" }).click();
  await expect(page.getByRole("dialog", { name: "Villa Samaya Ubud" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
