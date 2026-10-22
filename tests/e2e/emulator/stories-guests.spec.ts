import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { openAt, put, resetData, restorePairing, stored, storedDoc, type Value } from "../stories";

test.afterEach(closeOtherContexts);
test.afterAll(restorePairing);

// Task 8.1a, stories G1–G8: Guests at /guests (guide §5.23, §6.7, §6.8). One short flow per story.

const guest = (name: string, number: number, over: Record<string, Value> = {}): Record<string, Value> => ({
  name,
  number,
  connection: "",
  country: "Indonesia",
  rsvpStatus: "pending",
  eventType: "Both",
  inviteSent: true,
  plusOnes: 0,
  allergies: "",
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, number)),
  ...over,
});

// 7 guests, 12 people with plus-ones; 5 attending and 4 still to reply. Both events: 7 people. The groom's
// family is 2, the bride's family 1 and the bride's business 3; Dewi's connection names neither side.
const SEED: [string, Record<string, Value>][] = [
  ["g-hendra", guest("Hendra Santoso", 1, { connection: "Groom's uncle", rsvpStatus: "yes", plusOnes: 1 })],
  ["g-lily", guest("Tante Lily", 2, { connection: "Bride's aunt", allergies: "Vegetarian" })],
  ["g-joko", guest("Pak Joko Susilo", 3, { connection: "Groom's business client", rsvpStatus: "no", plusOnes: 2, eventType: "Reception", inviteSent: false })],
  ["g-xiao", guest("王小明", 12, { country: "Singapore", eventType: "Reception Shortlist", inviteSent: false })],
  ["g-maria", guest("Maria Goretti", 5, { connection: "Bride's colleague", rsvpStatus: "yes", plusOnes: 2 })],
  ["g-wayan", guest("Wayan Sudarta", 6, { connection: "Cousin", eventType: "Matrimony" })],
  ["g-dewi", guest("Dewi Lestari", 7, { connection: "Neighbour", country: "Malaysia" })],
];

test.beforeEach(async ({ page }) => {
  await resetData();
  await put("guestMeta", "counter", { next: 13 });
  for (const [id, fields] of SEED) await put("guests", id, fields);
  await openAt(page, "/guests");
  await expect(page.getByRole("heading", { name: "Guests", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
});

const row = (page: Page, id: string) => page.locator(`[data-guest-id="${id}"]`);
const rowIds = (page: Page) => page.locator("[data-guest-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-guest-id")));
const card = (page: Page, title: string) => page.locator("section", { has: page.getByRole("heading", { name: title, level: 2 }) });
const toasts = (page: Page) => page.getByRole("status");
const read = (id: string) => storedDoc("guests", id);
const openSheet = async (page: Page, id: string, name: RegExp) => {
  await row(page, id).getByRole("button", { name }).click();
};

test("G1 guest details: a guest's sheet saves each field as you go", async ({ page }) => {
  await openSheet(page, "g-lily", /^Tante Lily/);
  const sheet = page.getByRole("dialog", { name: "Tante Lily" });

  const connection = sheet.getByLabel("How they’re connected");
  await connection.fill("Bride’s mother’s sister");
  await connection.press("Enter");
  await expect.poll(async () => (await read("g-lily"))?.connection).toBe("Bride’s mother’s sister");
  const country = sheet.getByLabel("Country");
  await country.fill("Australia");
  await country.press("Enter");
  await expect.poll(async () => (await read("g-lily"))?.country).toBe("Australia");
  await sheet.getByRole("checkbox", { name: "Sent" }).uncheck();
  await expect.poll(async () => (await read("g-lily"))?.inviteSent).toBe(false);
  await sheet.getByRole("radiogroup", { name: "RSVP" }).getByRole("radio", { name: "Attending", exact: true }).click();
  await expect.poll(async () => (await read("g-lily"))?.rsvpStatus).toBe("yes");
  await sheet.getByRole("button", { name: "One more" }).click();
  await expect.poll(async () => (await read("g-lily"))?.plusOnes).toBe(1);
  await sheet.getByLabel("Food notes").fill("Vegetarian, no onion");
  await sheet.getByLabel("Food notes").blur();
  await expect.poll(async () => (await read("g-lily"))?.allergies).toBe("Vegetarian, no onion");

  // An emptied name comes back as it was.
  const name = sheet.getByLabel("Name", { exact: true });
  await name.fill("");
  await name.press("Enter");
  await expect(name).toHaveValue("Tante Lily");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(row(page, "g-lily")).toContainText("Tante Lily+1");
});

test("G2 event options: invited to is one choice of five, and the row says it", async ({ page }) => {
  await openSheet(page, "g-wayan", /^Wayan Sudarta/);
  const sheet = page.getByRole("dialog", { name: "Wayan Sudarta" });
  const options = sheet.getByRole("radiogroup").filter({ has: page.getByRole("radio", { name: "Ceremony only" }) });
  await expect(options.getByRole("radio")).toHaveCount(5);
  await expect(options.getByRole("radio", { name: "Ceremony only" })).toHaveAttribute("aria-checked", "true");

  await sheet.getByRole("radio", { name: "Reception only" }).click();
  await expect.poll(async () => (await read("g-wayan"))?.eventType).toBe("Reception");
  await expect(sheet.getByRole("radio", { name: "Ceremony only" })).toHaveAttribute("aria-checked", "false");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(row(page, "g-wayan")).toContainText("Reception only");
});

test("G3 headcounts: people per event, plus-ones in, not attending out, if space allows apart", async ({ page }) => {
  await expect(page.getByText("7 guests invited, 12 people with plus-ones")).toBeVisible();
  await expect(page.getByText("people, plus-ones included.")).toContainText("4 still to reply.");
  // Each line is its label then its count, read whole, so a 17 can't pass for a 7.
  const lines = card(page, "Headcounts").getByRole("listitem");
  const line = (label: string, count: number) => lines.filter({ hasText: new RegExp(`^${label}\\s*${count}$`) });
  await expect(line("Both events", 7)).toHaveCount(1);
  await expect(line("Reception", 8)).toHaveCount(1);
  await expect(line("of which, if space allows", 1)).toHaveCount(1);
  await expect(line("Ceremony", 8)).toHaveCount(1);

  // Pak Joko is not attending, so changing him changes nothing; Maria's three leave the count when she declines.
  await row(page, "g-maria").getByRole("radio", { name: "Not attending", exact: true }).click();
  await expect.poll(async () => (await read("g-maria"))?.rsvpStatus).toBe("no");
  await expect(line("Both events", 4)).toHaveCount(1);
  const hero = page.locator("section").filter({ has: page.getByRole("heading", { level: 1, name: "Guests" }) });
  await expect(hero).toContainText(/Attending so far\s*2\s*people, plus-ones included/);
});

test("G4 both sides: the first side named wins, friends are family, and an unnamed side is counted apart", async ({ page }) => {
  const sides = card(page, "Both sides");
  await expect(sides.getByText("Guests invited to both events; friends count as family")).toBeVisible();
  await expect(sides.getByText("1 person not counted: their connection doesn’t say groom’s or bride’s.")).toBeVisible();

  // Naming a side for Dewi counts her.
  await openSheet(page, "g-dewi", /^Dewi Lestari/);
  const sheet = page.getByRole("dialog", { name: "Dewi Lestari" });
  await sheet.getByLabel("How they’re connected").fill("Bride’s friend");
  await sheet.getByLabel("How they’re connected").press("Enter");
  await expect.poll(async () => (await read("g-dewi"))?.connection).toBe("Bride’s friend");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sides.getByText(/not counted/)).toHaveCount(0);
});

test("G5 find guests: search, the RSVP and Invited to filters, and the orders", async ({ page }) => {
  const search = page.getByRole("searchbox", { name: "Search guests" });
  await search.fill("singapore");
  await expect.poll(() => rowIds(page)).toEqual(["g-xiao"]);
  await search.fill("vegetarian");
  await expect.poll(() => rowIds(page)).toEqual(["g-lily"]);
  await search.fill("Surabaya");
  await expect(page.getByRole("heading", { name: "No guests match “Surabaya”", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Show everyone" }).last().click();
  await expect.poll(async () => (await rowIds(page)).length).toBe(7);

  await page.getByLabel("RSVP", { exact: true }).selectOption("pending");
  await expect.poll(() => rowIds(page)).toEqual(["g-lily", "g-wayan", "g-dewi", "g-xiao"]);
  await page.getByLabel("Invited to").selectOption("Reception Shortlist");
  await expect.poll(() => rowIds(page)).toEqual(["g-xiao"]);
  await page.getByRole("button", { name: "Show everyone" }).click();

  await page.getByLabel("Order by").selectOption("name");
  await expect.poll(() => rowIds(page)).toEqual(["g-dewi", "g-hendra", "g-maria", "g-joko", "g-lily", "g-wayan", "g-xiao"]);
  await page.getByLabel("Order by").selectOption("plus");
  await expect.poll(() => rowIds(page)).toEqual(["g-joko", "g-maria", "g-hendra", "g-lily", "g-wayan", "g-dewi", "g-xiao"]);
});

test("G6 stable number: a new guest takes the next number, and a number is never reused", async ({ page }) => {
  await page.getByRole("button", { name: "Add a guest" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a guest" });
  await expect(sheet.getByText("Will be guest number 13")).toBeVisible();
  await sheet.getByLabel("Name", { exact: true }).fill("Kirana Putri");
  await sheet.getByRole("button", { name: "Add guest" }).click();
  await expect(toasts(page).getByText("Added Kirana Putri as guest 13")).toBeVisible();
  await expect.poll(async () => (await stored("guests")).find((g) => g.name === "Kirana Putri")?.number).toBe(13);

  // Removing the newest guest doesn't free its number.
  const kirana = (await stored("guests")).find((g) => g.name === "Kirana Putri")!;
  await openSheet(page, String(kirana.id), /^Kirana Putri/);
  await page.getByRole("dialog", { name: "Kirana Putri" }).getByRole("button", { name: "Remove guest" }).click();
  await page.getByRole("dialog", { name: "Remove Kirana Putri?" }).getByRole("button", { name: "Remove guest" }).click();
  await expect.poll(async () => await read(String(kirana.id))).toBeNull();
  await page.getByRole("button", { name: "Add a guest" }).first().click();
  await expect(page.getByRole("dialog", { name: "Add a guest" }).getByText("Will be guest number 14")).toBeVisible();
});

test("G7 remove with undo: the confirm names the plus-ones, and Undo brings the guest back with their number", async ({ page }) => {
  await openSheet(page, "g-maria", /^Maria Goretti/);
  await page.getByRole("dialog", { name: "Maria Goretti" }).getByRole("button", { name: "Remove guest" }).click();
  const confirm = page.getByRole("dialog", { name: "Remove Maria Goretti?" });
  await expect(confirm.getByText("Maria Goretti was bringing 2 plus-ones, so the headcount drops by 3. You can undo for a few seconds.")).toBeVisible();
  // Cancelling keeps her.
  await confirm.getByRole("button", { name: "Keep it" }).click();
  await expect(confirm).toBeHidden();
  expect(await read("g-maria")).not.toBeNull();

  // Keeping her leaves her sheet open; removing from it asks again.
  await page.getByRole("dialog", { name: "Maria Goretti" }).getByRole("button", { name: "Remove guest" }).click();
  await page.getByRole("dialog", { name: "Remove Maria Goretti?" }).getByRole("button", { name: "Remove guest" }).click();
  await expect(toasts(page).getByText("Removed Maria Goretti")).toBeVisible();
  await expect.poll(async () => await read("g-maria")).toBeNull();
  await expect(row(page, "g-maria")).toHaveCount(0);

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await read("g-maria"))?.number).toBe(5);
  await expect(row(page, "g-maria")).toBeVisible();
  expect(await read("g-maria")).toMatchObject({ name: "Maria Goretti", plusOnes: 2, rsvpStatus: "yes" });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("G8 on the phone: the cards stack, the reply switch sits under the name and nothing scrolls sideways", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Guests", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const headcounts = await card(page, "Headcounts").boundingBox();
    const sides = await card(page, "Both sides").boundingBox();
    expect(sides!.y).toBeGreaterThan(headcounts!.y + headcounts!.height - 1);
    const name = await row(page, "g-hendra").getByRole("button", { name: /^Hendra Santoso/ }).boundingBox();
    const group = await row(page, "g-hendra").getByRole("radiogroup").boundingBox();
    expect(group!.y).toBeGreaterThan(name!.y + name!.height - 1);
    expect(group!.height).toBeGreaterThanOrEqual(36);
  });
});
