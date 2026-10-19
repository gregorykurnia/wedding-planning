import { expect, test, type Browser, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.24: Guests at /new/guests against the emulators (guide §5.23, §6.1, §6.2, G1–G8). Everything is
// written as the emulator's owner (which skips the rules), so the numbers and counts read the same whenever
// this runs.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Value = string | number | boolean | null | Value[] | { [key: string]: Value } | Date;

const typed = (value: Value): Record<string, unknown> =>
  value === null
    ? { nullValue: null }
    : Array.isArray(value)
      ? { arrayValue: { values: value.map(typed) } }
      : value instanceof Date
        ? { timestampValue: value.toISOString() }
        : typeof value === "boolean"
          ? { booleanValue: value }
          : typeof value === "number"
            ? Number.isInteger(value)
              ? { integerValue: String(value) }
              : { doubleValue: value }
            : typeof value === "string"
              ? { stringValue: value }
              : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typed(v)])) } };

async function put(collection: string, id: string, fields: Record<string, Value>) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typed(v)])) };
  const res = await fetch(`${DOCS}/${collection}/${id}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

/** Many documents of one collection, a few hundred to a request, for the long list. */
async function putMany(collection: string, docs: [string, Record<string, Value>][]) {
  for (let from = 0; from < docs.length; from += 400) {
    const writes = docs.slice(from, from + 400).map(([id, fields]) => ({
      update: {
        name: `projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/${collection}/${id}`,
        fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typed(v)])),
      },
    }));
    const res = await fetch(`${DOCS}:commit`, { method: "POST", headers: ADMIN, body: JSON.stringify({ writes }) });
    expect(res.ok).toBe(true);
  }
}

type Plain = string | number | boolean | null | Plain[] | { [key: string]: Plain };

const plain = (v: Record<string, unknown>): Plain =>
  "stringValue" in v
    ? (v.stringValue as string)
    : "integerValue" in v
      ? Number(v.integerValue)
      : "doubleValue" in v
        ? (v.doubleValue as number)
        : "booleanValue" in v
          ? (v.booleanValue as boolean)
          : "arrayValue" in v
            ? ((v.arrayValue as { values?: Record<string, unknown>[] }).values ?? []).map(plain)
            : "mapValue" in v
              ? Object.fromEntries(Object.entries((v.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {}).map(([k, x]) => [k, plain(x)]))
              : null;

type Doc = Record<string, Plain> & { id: string };

/** Every document in a collection, as plain values. */
async function all(collection: string): Promise<Doc[]> {
  const out: Doc[] = [];
  let token = "";
  do {
    const res = await fetch(`${DOCS}/${collection}?pageSize=300${token}`, { headers: ADMIN });
    const page = (await res.json()) as { documents?: { name: string; fields?: Record<string, Record<string, unknown>> }[]; nextPageToken?: string };
    for (const d of page.documents ?? []) {
      out.push({ id: d.name.split("/").pop() as string, ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, plain(v)])) });
    }
    token = page.nextPageToken ? `&pageToken=${page.nextPageToken}` : "";
  } while (token);
  return out;
}

const read = async (id: string) => (await all("guests")).find((d) => d.id === id) ?? null;
const byName = async (name: string) => (await all("guests")).find((d) => d.name === name) ?? null;

async function clearAll() {
  for (const collection of ["guests", "guestMeta", "activity"]) {
    const docs = await all(collection);
    for (let from = 0; from < docs.length; from += 200) {
      const writes = docs.slice(from, from + 200).map((d) => ({ delete: `projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/${collection}/${d.id}` }));
      await fetch(`${DOCS}:commit`, { method: "POST", headers: ADMIN, body: JSON.stringify({ writes }) });
    }
  }
}

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

const LONG_FOOD =
  "Allergic to peanuts and shellfish; the children eat halal food only, and Grandma needs a soft meal without any spice or strong flavours at all";

// 7 guests, 12 people with plus-ones; 5 attending and 4 still to reply. Both events: 7 people (Hendra and
// his plus-one, Tante Lily, Maria and her two, Dewi). The groom's family is 2, the bride's family 1 and the
// bride's business 3; Dewi's connection names neither side.
const SEED: [string, Record<string, Value>][] = [
  ["g-hendra", guest("Hendra Santoso", 1, { connection: "Groom's uncle", rsvpStatus: "yes", plusOnes: 1 })],
  ["g-lily", guest("Tante Lily", 2, { connection: "Bride's aunt", allergies: "Vegetarian" })],
  ["g-joko", guest("Pak Joko Susilo", 3, { connection: "Groom's business client", rsvpStatus: "no", plusOnes: 2, eventType: "Reception", inviteSent: false })],
  ["g-xiao", guest("王小明", 12, { country: "Singapore", eventType: "Reception Shortlist", inviteSent: false, allergies: LONG_FOOD })],
  ["g-maria", guest("Maria Goretti", 5, { connection: "Bride's colleague", rsvpStatus: "yes", plusOnes: 2 })],
  ["g-wayan", guest("Wayan Sudarta", 6, { connection: "Cousin", eventType: "Matrimony" })],
  ["g-dewi", guest("Dewi Lestari", 7, { connection: "Neighbour", country: "Malaysia" })],
];

async function seed() {
  await put("settings", "wedding", { yourName: "Greg", partnerName: "Bella", partnerEmail: TEST_ACCOUNTS[1].email });
  await put("guestMeta", "counter", { next: 13 });
  for (const [id, fields] of SEED) await put("guests", id, fields);
}

test.beforeEach(async () => {
  await clearAll();
  await seed();
});

test.afterEach(async () => {
  await clearAll();
  await put("settings", "wedding", { yourName: "", partnerName: "", weddingDate: null, startedOn: null });
});

async function openAs(browser: Browser, account: (typeof TEST_ACCOUNTS)[number] = TEST_ACCOUNTS[0], size = { width: 1280, height: 900 }, path = "/new/guests") {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Guests", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page;
}

const openGuests = (browser: Browser, size?: { width: number; height: number }) => openAs(browser, TEST_ACCOUNTS[0], size);

const row = (page: Page, id: string) => page.locator(`[data-guest-id="${id}"]`);
const rowIds = (page: Page) => page.locator("[data-guest-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-guest-id")));
/** A card on the guests screen: the section holding the heading. */
const card = (page: Page, title: string) => page.locator("section", { has: page.getByRole("heading", { name: title, level: 2 }) });
const toasts = (page: Page) => page.getByRole("status");
const expectRows = (page: Page, ids: string[]) => expect.poll(() => rowIds(page)).toEqual(ids);
const reply = (page: Page, id: string, label: "Waiting" | "Attending" | "Not attending") => row(page, id).getByRole("radio", { name: label, exact: true });

test("the figure, both cards and the rows read as designed", async ({ browser }) => {
  const page = await openGuests(browser);

  await expect(page.getByText("7 guests invited, 12 people with plus-ones")).toBeVisible();
  await expect(page.getByText("Attending so far")).toBeVisible();
  await expect(page.locator("p", { hasText: /^5$/ })).toBeVisible();
  await expect(page.getByText("people, plus-ones included.")).toContainText("4 still to reply.");

  const headcounts = card(page, "Headcounts");
  await expect(headcounts.getByText("Plus-ones included; anyone not attending left out")).toBeVisible();
  const line = (label: string) => headcounts.locator("li", { hasText: label });
  await expect(line("Both events")).toContainText("7");
  await expect(line("Reception").filter({ hasNotText: "if space" })).toContainText("8");
  await expect(line("of which, if space allows")).toContainText("1");
  await expect(line("Ceremony")).toContainText("8");
  await expect(line("Unsure, living abroad")).toContainText("0");

  const sides = card(page, "Both sides");
  await expect(sides.getByText("Guests invited to both events; friends count as family")).toBeVisible();
  await expect(sides.getByText("1 person not counted: their connection doesn’t say groom’s or bride’s.")).toBeVisible();

  // Rows run by number, with the number, plus-ones, who they're invited to and the line of notes.
  await expectRows(page, ["g-hendra", "g-lily", "g-joko", "g-maria", "g-wayan", "g-dewi", "g-xiao"]);
  await expect(page.getByText("7 guests", { exact: true })).toBeVisible();
  await expect(row(page, "g-hendra")).toContainText("Hendra Santoso+1");
  await expect(row(page, "g-hendra")).toContainText("Groom's uncle, Indonesia");
  await expect(row(page, "g-joko")).toContainText("Reception only, invitation not sent");
  await expect(row(page, "g-xiao")).toContainText("Reception if space allows, invitation not sent");
  await expect(row(page, "g-xiao")).toContainText("…");
  await expect(reply(page, "g-hendra", "Attending")).toHaveAttribute("aria-checked", "true");
  await expect(reply(page, "g-joko", "Not attending")).toHaveAttribute("aria-checked", "true");
  await expect(reply(page, "g-lily", "Waiting")).toHaveAttribute("aria-checked", "true");
});

test("one tap records a reply, tells the partner, moves the figure, and Undo takes it back", async ({ browser }) => {
  const page = await openGuests(browser);

  await reply(page, "g-lily", "Attending").click();
  await expect(toasts(page).getByText("Tante Lily: attending")).toBeVisible();
  await expect.poll(async () => (await read("g-lily"))?.rsvpStatus).toBe("yes");
  await expect(page.locator("p", { hasText: /^6$/ })).toBeVisible();
  await expect(page.getByText("people, plus-ones included.")).toContainText("3 still to reply.");
  await expect.poll(async () => (await all("activity")).map((a) => `${a.kind}:${(a.params as { reply: string }).reply}`)).toContain("guest.replied:yes");

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await read("g-lily"))?.rsvpStatus).toBe("pending");
  await expect(reply(page, "g-lily", "Waiting")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("p", { hasText: /^5$/ })).toBeVisible();

  // The arrow keys move and choose, as in any radio group.
  await reply(page, "g-lily", "Waiting").focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await read("g-lily"))?.rsvpStatus).toBe("yes");
  await expect(reply(page, "g-lily", "Attending")).toBeFocused();
});

test("a double tap ends on the second reply, and Undo on the first says it was your own change (P4-S22)", async ({ browser }) => {
  const page = await openGuests(browser);

  await reply(page, "g-lily", "Attending").click();
  await reply(page, "g-lily", "Not attending").click();
  await expect(toasts(page).getByText("Tante Lily: not attending")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await read("g-lily"))?.rsvpStatus).toBe("no");
  await expect(reply(page, "g-lily", "Not attending")).toHaveAttribute("aria-checked", "true");

  // The first toast's Undo would erase the second tap: it refuses, naming you, not the partner.
  await toasts(page).locator("[data-kind]", { hasText: "Tante Lily: attending" }).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Can’t undo the reply: you’ve changed Tante Lily since. It’s kept as it is now.")).toBeVisible();
  expect((await read("g-lily"))?.rsvpStatus).toBe("no");
});

test("two replies that didn't save stay chosen together, another row's save clears neither, and each Try again saves its own", async ({ browser }) => {
  const page = await openGuests(browser);
  const lilyLine = row(page, "g-lily").getByText("Couldn’t save the reply for Tante Lily. Your choice is kept.");
  const dewiLine = row(page, "g-dewi").getByText("Couldn’t save the reply for Dewi Lestari. Your choice is kept.");

  await page.context().setOffline(true);
  await reply(page, "g-lily", "Attending").click();
  await reply(page, "g-dewi", "Not attending").click();
  await expect(lilyLine).toBeVisible({ timeout: 30_000 });
  await expect(dewiLine).toBeVisible({ timeout: 30_000 });

  await page.context().setOffline(false);
  await reply(page, "g-wayan", "Attending").click();
  await expect.poll(async () => (await read("g-wayan"))?.rsvpStatus, { timeout: 30_000 }).toBe("yes");
  await expect(lilyLine).toBeVisible();
  await expect(dewiLine).toBeVisible();
  await expect(reply(page, "g-lily", "Attending")).toHaveAttribute("aria-checked", "true");
  await expect(reply(page, "g-dewi", "Not attending")).toHaveAttribute("aria-checked", "true");

  await row(page, "g-lily").getByRole("button", { name: "Try again" }).click();
  await expect(lilyLine).toHaveCount(0, { timeout: 30_000 });
  await expect(dewiLine).toBeVisible();
  await row(page, "g-dewi").getByRole("button", { name: "Try again" }).click();
  await expect(dewiLine).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => (await read("g-lily"))?.rsvpStatus).toBe("yes");
  await expect.poll(async () => (await read("g-dewi"))?.rsvpStatus).toBe("no");
});

test("search, the two filters and Show everyone, and a search that finds nothing", async ({ browser }) => {
  const page = await openGuests(browser);

  // Names, connections, countries and food notes.
  const search = page.getByRole("searchbox", { name: "Search guests" });
  await search.fill("singapore");
  await expectRows(page, ["g-xiao"]);
  await expect(page.getByText("1 guest of 7")).toBeVisible();
  await search.fill("vegetarian");
  await expectRows(page, ["g-lily"]);
  await search.fill("colleague");
  await expectRows(page, ["g-maria"]);

  await search.fill("Surabaya");
  await expect(page.getByRole("heading", { name: "No guests match “Surabaya”", level: 2 })).toBeVisible();
  await expect(page.getByText("Search looks at names, connections, countries and food notes.")).toBeVisible();
  await page.getByRole("button", { name: "Show everyone" }).last().click();
  await expect(search).toHaveValue("");
  await expect.poll(async () => (await rowIds(page)).length).toBe(7);

  // Who hasn't replied, and who is invited to the ceremony only.
  await page.getByLabel("RSVP", { exact: true }).selectOption("pending");
  await expectRows(page, ["g-lily", "g-wayan", "g-dewi", "g-xiao"]);
  await page.getByLabel("Invited to").selectOption("Reception Shortlist");
  await expectRows(page, ["g-xiao"]);
  await page.getByRole("button", { name: "Show everyone" }).click();
  await expect.poll(async () => (await rowIds(page)).length).toBe(7);
  await expect(page.getByLabel("RSVP", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Show everyone" })).toHaveCount(0);
});

test("the nine orders, each starting the way the guide says, and the direction flips", async ({ browser }) => {
  const page = await openGuests(browser);
  const order = page.getByLabel("Order by");
  await expect(order.locator("option")).toHaveText(["Number", "Name", "Connection", "Country", "Invited to", "Invitation sent", "RSVP", "Plus-ones", "Food notes"]);

  await order.selectOption("name");
  await expectRows(page, ["g-dewi", "g-hendra", "g-maria", "g-joko", "g-lily", "g-wayan", "g-xiao"]);

  // Text starts ascending; ties fall back to the number.
  await order.selectOption("country");
  await expectRows(page, ["g-hendra", "g-lily", "g-joko", "g-maria", "g-wayan", "g-dewi", "g-xiao"]);
  await order.selectOption("rsvp");
  await expectRows(page, ["g-lily", "g-wayan", "g-dewi", "g-xiao", "g-hendra", "g-maria", "g-joko"]);

  // Plus-ones start biggest first, and the direction word flips them.
  await order.selectOption("plus");
  await expectRows(page, ["g-joko", "g-maria", "g-hendra", "g-lily", "g-wayan", "g-dewi", "g-xiao"]);
  await page.getByRole("button", { name: "Descending" }).click();
  await expectRows(page, ["g-lily", "g-wayan", "g-dewi", "g-xiao", "g-hendra", "g-joko", "g-maria"]);

  // Number starts at 1.
  await order.selectOption("number");
  await expectRows(page, ["g-hendra", "g-lily", "g-joko", "g-maria", "g-wayan", "g-dewi", "g-xiao"]);
});

test("a guest's sheet saves every field as you go, and a cleared name comes back", async ({ browser }) => {
  const page = await openGuests(browser);
  await row(page, "g-lily").getByRole("button", { name: /^Tante Lily/ }).click();
  const sheet = page.getByRole("dialog", { name: "Tante Lily" });
  await expect(sheet.getByText("Guest number 2")).toBeVisible();
  await expect(sheet.getByText("Mention groom’s or bride’s so the two sides add up.")).toBeVisible();

  const name = sheet.getByLabel("Name", { exact: true });
  await name.fill("Tante Lily Wijaya");
  await name.press("Enter");
  await expect.poll(async () => (await read("g-lily"))?.name).toBe("Tante Lily Wijaya");
  await expect(page.getByRole("dialog", { name: "Tante Lily Wijaya" })).toBeVisible();

  const connection = sheet.getByLabel("How they’re connected");
  await connection.fill("Bride’s mother’s sister");
  await connection.press("Enter");
  await expect.poll(async () => (await read("g-lily"))?.connection).toBe("Bride’s mother’s sister");

  const country = sheet.getByLabel("Country");
  await country.fill("Australia");
  await country.press("Enter");
  await expect.poll(async () => (await read("g-lily"))?.country).toBe("Australia");

  await sheet.getByRole("radio", { name: "Reception only" }).click();
  await expect.poll(async () => (await read("g-lily"))?.eventType).toBe("Reception");
  await sheet.getByRole("checkbox", { name: "Sent" }).uncheck();
  await expect.poll(async () => (await read("g-lily"))?.inviteSent).toBe(false);
  await sheet.getByRole("radiogroup", { name: "RSVP" }).getByRole("radio", { name: "Attending", exact: true }).click();
  await expect.poll(async () => (await read("g-lily"))?.rsvpStatus).toBe("yes");
  await sheet.getByRole("button", { name: "One more" }).click();
  await sheet.getByRole("button", { name: "One more" }).click();
  await expect.poll(async () => (await read("g-lily"))?.plusOnes).toBe(2);
  await sheet.getByRole("button", { name: "One fewer" }).click();
  await expect.poll(async () => (await read("g-lily"))?.plusOnes).toBe(1);

  const food = sheet.getByLabel("Food notes");
  await food.fill("Vegetarian, no onion");
  await food.blur();
  await expect.poll(async () => (await read("g-lily"))?.allergies).toBe("Vegetarian, no onion");
  await expect(sheet.getByText("Saved")).toBeVisible();

  // An emptied name goes back to the old one rather than saving nothing.
  await name.fill("");
  await name.press("Enter");
  await expect(name).toHaveValue("Tante Lily Wijaya");
  expect((await read("g-lily"))?.name).toBe("Tante Lily Wijaya");

  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();
  // The row follows: the new name, the plus-one, the reception line and the reply.
  await expect(row(page, "g-lily")).toContainText("Tante Lily Wijaya+1");
  await expect(row(page, "g-lily")).toContainText("Reception only, invitation not sent");
  await expect(reply(page, "g-lily", "Attending")).toHaveAttribute("aria-checked", "true");
});

test("a link with ?guest= opens that guest's sheet and clears the address", async ({ browser }) => {
  const page = await openAs(browser, TEST_ACCOUNTS[0], undefined, "/new/guests?guest=g-maria");
  await expect(page.getByRole("dialog", { name: "Maria Goretti" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL("/new/guests");
});

test("Add a guest says which number is next, adds with the number issued once, and Add and start another keeps going", async ({ browser }) => {
  const page = await openGuests(browser);
  await page.getByRole("button", { name: "Add a guest" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a guest" });
  // The counter has run past the highest number (12), so the next is 13.
  await expect(sheet.getByText("Will be guest number 13")).toBeVisible();

  // A name is required.
  await sheet.getByRole("button", { name: "Add guest" }).click();
  await expect(sheet.getByText("Give the guest a name.")).toBeVisible();
  await expect(sheet.getByLabel("Name", { exact: true })).toBeFocused();

  await sheet.getByLabel("Name", { exact: true }).fill("Kirana Putri");
  await sheet.getByLabel("How they’re connected").fill("Bride’s friend");
  await sheet.getByRole("radio", { name: "Ceremony only" }).click();
  await sheet.getByRole("button", { name: "One more" }).click();
  await sheet.getByLabel("Food notes").fill("Halal");
  await sheet.getByRole("button", { name: "Add and start another" }).click();

  await expect(toasts(page).getByText("Added Kirana Putri as guest 13")).toBeVisible();
  await expect.poll(async () => (await byName("Kirana Putri"))?.number).toBe(13);
  expect(await byName("Kirana Putri")).toMatchObject({
    connection: "Bride’s friend",
    country: "Indonesia",
    eventType: "Matrimony",
    inviteSent: false,
    rsvpStatus: "pending",
    plusOnes: 1,
    allergies: "Halal",
  });
  expect((await all("guestMeta")).find((d) => d.id === "counter")?.next).toBe(14);

  // The sheet is still open, empty, for the next one.
  await expect(sheet.getByText("Will be guest number 14")).toBeVisible();
  await expect(sheet.getByLabel("Name", { exact: true })).toHaveValue("");
  await expect(sheet.getByLabel("Name", { exact: true })).toBeFocused();
  await sheet.getByLabel("Name", { exact: true }).fill("王小红");
  await sheet.getByRole("button", { name: "Add guest" }).click();
  await expect(toasts(page).getByText("Added 王小红 as guest 14")).toBeVisible();
  await expect(sheet).toBeHidden();
  await expect.poll(async () => (await byName("王小红"))?.number).toBe(14);

  // Both are on the screen, the last in view, and the counts moved.
  await expect(page.getByText("9 guests invited, 15 people with plus-ones")).toBeVisible();
  await expect(page.locator(`[data-guest-id="${(await byName("王小红"))?.id}"]`)).toBeVisible();
});

test("removing names the plus-ones and the headcount drop, Undo puts the guest back with the same number, and a number is never reused", async ({ browser }) => {
  const page = await openGuests(browser);
  await row(page, "g-maria").getByRole("button", { name: /^Maria Goretti/ }).click();
  await page.getByRole("dialog", { name: "Maria Goretti" }).getByRole("button", { name: "Remove guest" }).click();

  const confirm = page.getByRole("dialog", { name: "Remove Maria Goretti?" });
  await expect(confirm.getByText("Maria Goretti was bringing 2 plus-ones, so the headcount drops by 3. You can undo for a few seconds.")).toBeVisible();
  await confirm.getByRole("button", { name: "Remove guest" }).click();

  await expect(toasts(page).getByText("Removed Maria Goretti")).toBeVisible();
  await expect.poll(async () => await read("g-maria")).toBeNull();
  await expect(row(page, "g-maria")).toHaveCount(0);
  await expect(page.getByText("people, plus-ones included.")).toContainText("4 still to reply.");
  await expect(page.locator("p", { hasText: /^2$/ })).toBeVisible();

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await read("g-maria"))?.number).toBe(5);
  await expect(row(page, "g-maria")).toBeVisible();
  expect(await read("g-maria")).toMatchObject({ name: "Maria Goretti", connection: "Bride's colleague", plusOnes: 2, rsvpStatus: "yes" });

  // A guest with no plus-ones says the number isn't reused; after they go, the next guest still takes a new number.
  await row(page, "g-wayan").getByRole("button", { name: /^Wayan Sudarta/ }).click();
  await page.getByRole("dialog", { name: "Wayan Sudarta" }).getByRole("button", { name: "Remove guest" }).click();
  await expect(page.getByRole("dialog", { name: "Remove Wayan Sudarta?" }).getByText("You can undo for a few seconds. Their number isn’t reused.")).toBeVisible();
  await page.getByRole("dialog", { name: "Remove Wayan Sudarta?" }).getByRole("button", { name: "Remove guest" }).click();
  await expect.poll(async () => await read("g-wayan")).toBeNull();

  await page.getByRole("button", { name: "Add a guest" }).first().click();
  await expect(page.getByRole("dialog", { name: "Add a guest" }).getByText("Will be guest number 13")).toBeVisible();
});

test("a long list shows 100 at a time and says how many more", async ({ browser }) => {
  await putMany(
    "guests",
    Array.from({ length: 150 }, (_, i): [string, Record<string, Value>] => [`g-more-${String(i).padStart(3, "0")}`, guest(`More guest ${i + 1}`, 100 + i)]),
  );
  const page = await openGuests(browser);

  await expect(page.getByText("157 guests, showing 100")).toBeVisible();
  await expect.poll(async () => (await rowIds(page)).length).toBe(100);
  await page.getByRole("button", { name: "Show 57 more" }).click();
  await expect.poll(async () => (await rowIds(page)).length).toBe(157);
  await expect(page.getByRole("button", { name: /^Show \d+ more/ })).toHaveCount(0);
});

test("with no guests it invites the first one, and the sheet says the first number", async ({ browser }) => {
  await clearAll();
  await put("settings", "wedding", { yourName: "Greg", partnerName: "Bella", partnerEmail: TEST_ACCOUNTS[1].email });
  const page = await openGuests(browser);

  await expect(page.getByText("Who’s coming to what")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No guests yet", level: 2 })).toBeVisible();
  await expect(page.getByText("Headcounts for each event work themselves out.")).toBeVisible();
  await expect(page.getByText("Attending so far")).toHaveCount(0);

  await page.getByRole("button", { name: "Add a guest" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a guest" });
  await expect(sheet.getByText("Will be guest number 1")).toBeVisible();
  await sheet.getByLabel("Name", { exact: true }).fill("Hendra Santoso");
  await sheet.getByRole("button", { name: "Add guest" }).click();
  await expect.poll(async () => (await byName("Hendra Santoso"))?.number).toBe(1);
  await expect(page.getByText("1 guest invited, 1 person with plus-ones")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No guests yet" })).toHaveCount(0);
});

test("a reply the partner records arrives in place, flashes the row and says so", async ({ browser }) => {
  const greg = await openGuests(browser);
  const bella = await openAs(browser, TEST_ACCOUNTS[1]);

  await reply(bella, "g-lily", "Attending").click();
  await expect(toasts(greg).getByText("Bella marked Tante Lily as attending")).toBeVisible({ timeout: 15_000 });
  await expect(reply(greg, "g-lily", "Attending")).toHaveAttribute("aria-checked", "true");
  await expect(row(greg, "g-lily")).toHaveClass(/\bflash\b/);
  await expect(greg.locator("p", { hasText: /^6$/ })).toBeVisible();
  // Her own change is not news to her.
  await expect(toasts(bella).getByText(/marked/)).toHaveCount(0);
});

test("on a phone the cards stack, the switch moves under the name and nothing scrolls sideways", async ({ browser }) => {
  const page = await openGuests(browser, { width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Guests", level: 1 })).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(wide).toBeLessThanOrEqual(0);

  const headcounts = await card(page, "Headcounts").boundingBox();
  const sides = await card(page, "Both sides").boundingBox();
  expect(sides!.y).toBeGreaterThan(headcounts!.y + headcounts!.height - 1);

  const name = await row(page, "g-hendra").getByRole("button", { name: /^Hendra Santoso/ }).boundingBox();
  const group = await row(page, "g-hendra").getByRole("radiogroup").boundingBox();
  expect(group!.y).toBeGreaterThan(name!.y + name!.height - 1);
  // The segments are bigger than on a desktop, for thumbs.
  expect(group!.height).toBeGreaterThanOrEqual(36);
});
