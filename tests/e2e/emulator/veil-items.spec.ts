import { expect, test, type Browser, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.23: Wedding items at /new/items against the emulators (guide §5.22,
// §6.8, T1–T10, N12). Everything is written as the emulator's owner (which
// skips the rules), so the order and the counts read the same whenever this runs.

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

const CREATED = new Date("2026-01-01T00:00:00Z");

async function put(collection: string, id: string, fields: Record<string, Value>) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typed(v)])) };
  const res = await fetch(`${DOCS}/${collection}/${id}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

/** Many documents of one collection in a single request, for the long list. */
async function putMany(collection: string, docs: [string, Record<string, Value>][]) {
  const writes = docs.map(([id, fields]) => ({
    update: {
      name: `projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/${collection}/${id}`,
      fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typed(v)])),
    },
  }));
  const res = await fetch(`${DOCS}:commit`, { method: "POST", headers: ADMIN, body: JSON.stringify({ writes }) });
  expect(res.ok).toBe(true);
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

const read = async (id: string) => (await all("masterListItems")).find((d) => d.id === id) ?? null;

/** The items in our own order, as stored. */
const stored = async () => (await all("masterListItems")).sort((a, z) => (a.sortOrder as number) - (z.sortOrder as number));
const names = async () => (await stored()).map((d) => d.item as string);

async function clearAll() {
  for (const collection of ["masterListItems", "masterListMeta", "activity"]) {
    const docs = await all(collection);
    for (let from = 0; from < docs.length; from += 200) {
      const writes = docs.slice(from, from + 200).map((d) => ({ delete: `projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/${collection}/${d.id}` }));
      await fetch(`${DOCS}:commit`, { method: "POST", headers: ADMIN, body: JSON.stringify({ writes }) });
    }
  }
}

const item = (name: string, sortOrder: number, over: Record<string, Value> = {}): Record<string, Value> => ({
  item: name,
  vendor: "",
  confirmed: false,
  types: [],
  persons: [],
  next: false,
  sortOrder,
  createdAt: CREATED,
  ...over,
});

const SEED: [string, Record<string, Value>][] = [
  ["it-venue", item("Reception venue", 0, { vendor: "The Langham", confirmed: true, types: ["Reception"] })],
  ["it-cake", item("Wedding cake", 1, { types: ["Reception"], next: true })],
  ["it-gown", item("Bride's gown", 2, { vendor: "Maison Ayu", confirmed: true, types: ["Matrimony", "Reception"], persons: ["Bride"] })],
  ["it-makeup", item("Makeup for both mothers", 3, { vendor: "Sherly Team", types: ["Sangjit"], persons: ["Bride Mom", "Groom Mom"], next: true })],
  ["it-suits", item("Suits for the groom's father and brother", 4, { types: ["Matrimony"], persons: ["Groom Dad", "Groom Brother"] })],
  ["it-pillow", item("Ring bearer's pillow", 5, { next: true })],
  // Written by the old screen: an unknown vendor as "???", and General as a person.
  ["it-photo", item("Photo booth", 6, { vendor: "???", persons: ["General"] })],
];

async function seed() {
  await put("settings", "wedding", { yourName: "Greg", partnerName: "Bella", partnerEmail: TEST_ACCOUNTS[1].email });
  await put("masterListMeta", "initialization", { initialized: true, nextSortOrder: SEED.length });
  for (const [id, fields] of SEED) await put("masterListItems", id, fields);
}

test.beforeEach(async () => {
  await clearAll();
  await seed();
});

test.afterEach(async () => {
  await clearAll();
  await put("settings", "wedding", { yourName: "", partnerName: "", weddingDate: null, startedOn: null });
});

async function openItems(browser: Browser, size = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(TEST_ACCOUNTS[0].email);
  await page.getByLabel("Password").fill(TEST_ACCOUNTS[0].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/items");
  await expect(page.getByRole("heading", { name: "Wedding items", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page;
}

const row = (page: Page, id: string) => page.locator(`[data-item-id="${id}"]`);
const rowIds = (page: Page) => page.locator("[data-item-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-item-id")));
const toasts = (page: Page) => page.getByRole("status");
/** The rows shown, in order, once the page has caught up with the last change. */
const expectRows = (page: Page, ids: string[]) => expect.poll(() => rowIds(page)).toEqual(ids);

test("the figure, the card and the rows read as designed, an item for several people too", async ({ browser }) => {
  const page = await openItems(browser);

  await expect(page.getByText("Every piece of the day, and who provides it")).toBeVisible();
  await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
  await expect(page.locator("p", { hasText: /^2of 7$/ })).toBeVisible();
  await expect(page.getByText("3 marked to work on next")).toBeVisible();
  await expect(page.getByRole("img", { name: "29% confirmed, 5 to go" })).toBeVisible();

  // The card lists what is marked, in our own order.
  const card = page.getByRole("region", { name: "To work on next" });
  await expect(card.getByRole("button")).toHaveText(["Wedding cake", "Makeup for both mothers", "Ring bearer's pillow"]);

  await expectRows(page, ["it-venue", "it-cake", "it-gown", "it-makeup", "it-suits", "it-pillow", "it-photo"]);
  // N12: who it's for reads as text; none (and the old General) is General.
  await expect(row(page, "it-makeup").getByText("Bride's mother, Groom's mother")).toBeVisible();
  await expect(row(page, "it-suits").getByText("Groom's father, Groom's brother")).toBeVisible();
  await expect(row(page, "it-gown").getByLabel("Who Bride's gown is for: Bride")).toHaveText("Bride");
  await expect(row(page, "it-venue").getByLabel("Who Reception venue is for: General")).toHaveText("General");
  await expect(row(page, "it-photo").getByLabel("Who Photo booth is for: General")).toHaveText("General");
  // An unknown vendor from the old screen shows the placeholder.
  await expect(row(page, "it-photo").getByLabel("Vendor for Photo booth")).toHaveValue("");
  await expect(row(page, "it-photo").getByPlaceholder("Vendor not known yet")).toBeVisible();
  await expect(row(page, "it-venue").getByRole("button", { name: "Confirmed: Reception venue" })).toHaveAttribute("aria-pressed", "true");
  await expect(row(page, "it-cake").getByRole("button", { name: "Work on next: Wedding cake" })).toHaveAttribute("aria-pressed", "true");
});

test("every change saves at once: name, vendor, events, people, star and tick", async ({ browser }) => {
  const page = await openItems(browser);
  const cake = row(page, "it-cake");

  const name = cake.getByLabel("Item", { exact: true });
  await name.fill("Wedding cake and cupcakes");
  await name.press("Enter");
  await expect.poll(async () => (await read("it-cake"))?.item).toBe("Wedding cake and cupcakes");

  const vendor = cake.getByLabel("Vendor for Wedding cake and cupcakes");
  await vendor.fill("Manis Cake Studio");
  await vendor.press("Enter");
  await expect.poll(async () => (await read("it-cake"))?.vendor).toBe("Manis Cake Studio");

  await cake.getByRole("group", { name: /^Events for/ }).getByRole("button", { name: "Sangjit" }).click();
  await expect.poll(async () => (await read("it-cake"))?.types).toEqual(["Reception", "Sangjit"]);

  // Ticking people clears General; each tick saves; clearing everyone means General.
  await cake.getByLabel("Who Wedding cake and cupcakes is for: General").click();
  await cake.getByRole("checkbox", { name: "Groom's mother" }).check();
  await expect.poll(async () => (await read("it-cake"))?.persons).toEqual(["Groom Mom"]);
  await cake.getByRole("checkbox", { name: "Bride's father" }).check();
  await expect.poll(async () => (await read("it-cake"))?.persons).toEqual(["Groom Mom", "Bride Dad"]);
  await expect(cake.getByLabel(/^Who Wedding cake and cupcakes is for/)).toHaveText("Groom's mother, Bride's father");
  await cake.getByRole("checkbox", { name: "General, no one in particular" }).check();
  await expect.poll(async () => (await read("it-cake"))?.persons).toEqual([]);
  await expect(cake.getByLabel(/^Who Wedding cake and cupcakes is for/)).toHaveText("General");

  // The menu closes when a press lands elsewhere.
  await page.getByRole("heading", { name: "Wedding items", level: 1 }).click();
  await expect(cake.getByRole("checkbox", { name: "General, no one in particular" })).toBeHidden();

  await cake.getByRole("button", { name: /^Work on next:/ }).click();
  await expect.poll(async () => (await read("it-cake"))?.next).toBe(false);
  await cake.getByRole("button", { name: /^Confirmed:/ }).click();
  await expect.poll(async () => (await read("it-cake"))?.confirmed).toBe(true);
  await expect(page.locator("p", { hasText: /^3of 7$/ })).toBeVisible();

  // Confirming tells the partner.
  await expect.poll(async () => (await all("activity")).map((a) => a.kind)).toContain("item.confirmed");
});

test("an emptied name comes back, and a vendor can be cleared", async ({ browser }) => {
  const page = await openItems(browser);
  const gown = row(page, "it-gown");
  const name = gown.getByLabel("Item", { exact: true });
  await name.fill("");
  await name.press("Enter");
  await expect(name).toHaveValue("Bride's gown");
  expect((await read("it-gown"))?.item).toBe("Bride's gown");

  const vendor = gown.getByLabel("Vendor for Bride's gown");
  await vendor.fill("");
  await vendor.press("Enter");
  await expect.poll(async () => (await read("it-gown"))?.vendor).toBe("");
});

test("search, any-of events and people, confirmed, work on next, and the way back to everything", async ({ browser }) => {
  const page = await openItems(browser);
  const search = page.getByRole("searchbox", { name: "Search items, vendors and people" });

  // Search covers items, vendors and people.
  await search.fill("ayu");
  await expectRows(page, ["it-gown"]);
  await expect(page.getByText("1 item of 7")).toBeVisible();
  await search.fill("bride's mother");
  await expectRows(page, ["it-makeup"]);
  await expect(search).toBeFocused();
  await search.fill("general");
  await expectRows(page, ["it-venue", "it-cake", "it-pillow", "it-photo"]);
  // With a filter on, the card steps aside.
  await expect(page.getByRole("region", { name: "To work on next" })).toHaveCount(0);

  await search.fill("photo booth zzz");
  await expect(page.getByRole("heading", { name: "Nothing matches “photo booth zzz”", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Show everything" }).first().click();
  await expect.poll(async () => (await rowIds(page)).length).toBe(7);
  await expect(search).toHaveValue("");

  // Several events: any of them.
  const events = page.getByRole("group", { name: "Events", exact: true });
  await events.getByRole("button", { name: "Sangjit" }).click();
  await expectRows(page, ["it-makeup"]);
  await events.getByRole("button", { name: "Holy matrimony" }).click();
  await expectRows(page, ["it-gown", "it-makeup", "it-suits"]);
  await page.getByRole("button", { name: "Show everything" }).first().click();

  // Several people: an item for both mothers shows for either one, and General is the items for no one.
  await page.getByText("Anyone", { exact: true }).click();
  const people = page.getByRole("group", { name: "People" });
  await people.getByLabel("Bride's mother").check();
  await expectRows(page, ["it-makeup"]);
  await people.getByLabel("Groom's mother").check();
  await expectRows(page, ["it-makeup"]);
  await expect(page.getByText("Bride's mother, Groom's mother").first()).toBeVisible();
  await people.getByLabel("Bride's mother").uncheck();
  await people.getByLabel("Groom's mother").uncheck();
  await people.getByLabel("General", { exact: true }).check();
  await expectRows(page, ["it-venue", "it-cake", "it-pillow", "it-photo"]);
  await page.getByRole("button", { name: "Show everything" }).first().click();

  await page.getByLabel("Show", { exact: true }).selectOption("yes");
  await expectRows(page, ["it-venue", "it-gown"]);
  await page.getByLabel("Show", { exact: true }).selectOption("no");
  await expect.poll(async () => (await rowIds(page)).length).toBe(5);
  await page.getByRole("button", { name: "Show everything" }).first().click();

  await page.getByLabel("Work on next only").check();
  await expectRows(page, ["it-cake", "it-makeup", "it-pillow"]);
  await page.getByRole("button", { name: "Show everything" }).first().click();
  await expect(page.getByRole("button", { name: "Show everything" })).toHaveCount(0);
});

test("a sort is temporary: handles go, the note says so, and Back to our order brings the handles back", async ({ browser }) => {
  const page = await openItems(browser);
  await expect(row(page, "it-cake").getByRole("button", { name: /^Move Wedding cake/ })).toBeVisible();

  await page.getByLabel("Order by").selectOption("name");
  await expect(page.getByText("Sorted by item for now. Your own order is kept.")).toBeVisible();
  await expectRows(page, ["it-gown", "it-makeup", "it-photo", "it-venue", "it-pillow", "it-suits", "it-cake"]);
  await expect(page.getByRole("button", { name: /^Move Wedding cake/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Ascending" }).click();
  await expectRows(page, ["it-cake", "it-suits", "it-pillow", "it-venue", "it-photo", "it-makeup", "it-gown"]);
  // Our own order is never changed.
  expect((await stored()).map((d) => d.id)).toEqual(["it-venue", "it-cake", "it-gown", "it-makeup", "it-suits", "it-pillow", "it-photo"]);

  await page.getByRole("button", { name: "Back to our order" }).click();
  await expectRows(page, ["it-venue", "it-cake", "it-gown", "it-makeup", "it-suits", "it-pillow", "it-photo"]);
  await expect(row(page, "it-cake").getByRole("button", { name: /^Move Wedding cake/ })).toBeVisible();
});

test("our own order moves by Alt and the arrows, by the row menu, and by dragging the handle", async ({ browser }) => {
  const page = await openItems(browser);

  const handle = row(page, "it-gown").getByRole("button", { name: /^Move Bride's gown/ });
  await handle.focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect.poll(async () => (await stored()).map((d) => d.id).slice(0, 3)).toEqual(["it-venue", "it-gown", "it-cake"]);
  await expect(handle).toBeFocused();
  await expect(page.getByText("Bride's gown moved to 2 of 7")).toBeAttached();

  await row(page, "it-venue").getByRole("button", { name: "More for Reception venue" }).click();
  await page.getByRole("menuitem", { name: "Move down" }).click();
  await expect.poll(async () => (await stored()).map((d) => d.id).slice(0, 2)).toEqual(["it-gown", "it-venue"]);
  await expectRows(page, ["it-gown", "it-venue", "it-cake", "it-makeup", "it-suits", "it-pillow", "it-photo"]);

  // Drag the last row above the first.
  await row(page, "it-photo").dragTo(row(page, "it-gown"), { targetPosition: { x: 40, y: 4 }, sourcePosition: { x: 3, y: 20 } });
  await expect.poll(async () => (await stored())[0].id).toBe("it-photo");
  await expectRows(page, ["it-photo", "it-gown", "it-venue", "it-cake", "it-makeup", "it-suits", "it-pillow"]);
  // Only the item that moved changed its position.
  expect((await read("it-gown"))?.sortOrder).toBe(0.5);
});

test("Add an item below puts a blank row beneath, copying the events and people, with the cursor in its name", async ({ browser }) => {
  const page = await openItems(browser);

  await row(page, "it-makeup").getByRole("button", { name: "More for Makeup for both mothers" }).click();
  await page.getByRole("menuitem", { name: "Add an item below" }).click();
  await expect.poll(async () => (await names()).indexOf("")).toBe(4);
  const blank = (await stored())[4];
  expect(blank.types).toEqual(["Sangjit"]);
  expect(blank.persons).toEqual(["Bride Mom", "Groom Mom"]);
  expect(blank.sortOrder).toBe(3.5);
  const blankRow = row(page, blank.id);
  await expect(blankRow.getByLabel("Item", { exact: true })).toBeFocused();
  await blankRow.getByLabel("Item", { exact: true }).fill("Mothers' corsages");
  await blankRow.getByLabel("Item", { exact: true }).press("Enter");
  await expect.poll(async () => (await names())[4]).toBe("Mothers' corsages");
});

test("Add items takes one per line, below a row or at the end, and Undo takes them out", async ({ browser }) => {
  const page = await openItems(browser);

  await row(page, "it-gown").getByRole("button", { name: "More for Bride's gown" }).click();
  await page.getByRole("menuitem", { name: "Add several below" }).click();
  const sheet = page.getByRole("dialog", { name: "Add items" });
  await expect(sheet.getByText("Below “Bride's gown”. One item per line.")).toBeVisible();
  await sheet.getByRole("textbox").fill("Veil\n\n  Bouquet \nGarter");
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(toasts(page).getByText("Added 3 items")).toBeVisible();
  await expect.poll(async () => (await names()).slice(2, 6)).toEqual(["Bride's gown", "Veil", "Bouquet", "Garter"]);
  expect((await stored())[3].types).toEqual(["Matrimony", "Reception"]);
  expect((await stored())[3].persons).toEqual(["Bride"]);

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await names()).length).toBe(7);

  // At the end of the list, from the floating button.
  await page.getByRole("button", { name: "Add items" }).last().click();
  const end = page.getByRole("dialog", { name: "Add items" });
  await expect(end.getByText("At the end of the list. One item per line.")).toBeVisible();
  await end.getByRole("textbox").fill("Photo album");
  await end.getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(async () => (await names())[7]).toBe("Photo album");
  expect((await stored())[7].types).toEqual([]);
  // Nothing typed: Add does nothing.
  await page.getByRole("button", { name: "Add items" }).last().click();
  await page.getByRole("dialog", { name: "Add items" }).getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add items" })).toBeVisible();
});

test("Remove asks first, and Undo puts the item back exactly where it was", async ({ browser }) => {
  const page = await openItems(browser);

  await row(page, "it-cake").getByRole("button", { name: "More for Wedding cake" }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  const confirm = page.getByRole("dialog", { name: "Remove Wedding cake?" });
  await expect(confirm.getByText("You can undo for a few seconds, and it goes back exactly where it was.")).toBeVisible();
  await confirm.getByRole("button", { name: "Keep it" }).click();
  expect((await names()).length).toBe(7);

  await row(page, "it-cake").getByRole("button", { name: "More for Wedding cake" }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await page.getByRole("dialog", { name: "Remove Wedding cake?" }).getByRole("button", { name: "Remove item" }).click();
  await expect(toasts(page).getByText("Removed Wedding cake")).toBeVisible();
  await expect.poll(async () => (await names()).length).toBe(6);
  await expect.poll(() => rowIds(page)).not.toContain("it-cake");

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await names()).length).toBe(7);
  const back = await read("it-cake");
  expect(back).toMatchObject({ item: "Wedding cake", sortOrder: 1, next: true, types: ["Reception"] });
  await expectRows(page, ["it-venue", "it-cake", "it-gown", "it-makeup", "it-suits", "it-pillow", "it-photo"]);
});

test("a pill in the card scrolls to its row and puts the cursor in the item's name", async ({ browser }) => {
  const page = await openItems(browser);
  await page.getByRole("region", { name: "To work on next" }).getByRole("button", { name: "Ring bearer's pillow" }).click();
  await expect(row(page, "it-pillow").getByLabel("Item", { exact: true })).toBeFocused();
});

test("a long list shows 150 at a time and says how many more", async ({ browser }) => {
  await putMany(
    "masterListItems",
    Array.from({ length: 150 }, (_, i) => [`it-more-${String(i).padStart(3, "0")}`, item(`More item ${i + 1}`, 100 + i)]),
  );
  const page = await openItems(browser);

  await expect(page.getByText("Showing 150 of 157")).toBeVisible();
  await expect.poll(async () => (await rowIds(page)).length).toBe(150);
  await page.getByRole("button", { name: "Show 7 more" }).click();
  await expect.poll(async () => (await rowIds(page)).length).toBe(157);
  await expect(page.getByRole("button", { name: /^Show \d+ more/ })).toHaveCount(0);

  // A marked item past the first page is still reachable from the card.
  await put("masterListItems", "it-far", item("Far away item", 1000, { next: true }));
  await expect(page.getByRole("region", { name: "To work on next" }).getByRole("button", { name: "Far away item" })).toBeVisible();
  await page.getByRole("region", { name: "To work on next" }).getByRole("button", { name: "Far away item" }).click();
  await expect(row(page, "it-far").getByLabel("Item", { exact: true })).toBeFocused();
});

test("the first time, an empty tracker fills itself in with the common items and says so", async ({ browser }) => {
  await clearAll();
  await put("settings", "wedding", { yourName: "Greg", partnerName: "Bella", partnerEmail: TEST_ACCOUNTS[1].email });
  const page = await openItems(browser);

  await expect(page.getByText("The tracker starts with 44 common items. Rename, fill in or remove any of them.")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect.poll(async () => (await rowIds(page)).length).toBe(44);
  expect((await stored())[3].item).toBe("Hotel H-1 Venue");
  // An unknown vendor is an empty one in the new screen.
  expect((await read("master-04-hotel-h-1-venue"))?.vendor).toBe("");
  await expect(page.getByLabel("Vendor for Hotel H-1 Venue")).toHaveValue("");
});

test("an emptied tracker says nothing is tracked, and Start with common items fills it again, with Undo", async ({ browser }) => {
  // A tracker that was started before and then emptied on purpose is never filled in by itself.
  await clearAll();
  await put("settings", "wedding", { yourName: "Greg", partnerName: "Bella", partnerEmail: TEST_ACCOUNTS[1].email });
  await put("masterListMeta", "initialization", { initialized: true, nextSortOrder: 44 });
  const page = await openItems(browser);

  await expect(page.getByRole("heading", { name: "Nothing tracked yet", level: 2 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("List every piece the wedding needs")).toBeVisible();
  await expect(page.getByText("The tracker starts with")).toHaveCount(0);

  await page.getByRole("button", { name: "Start with common items" }).click();
  await expect(toasts(page).getByText("Added 44 common items")).toBeVisible();
  await expect.poll(async () => (await names()).length).toBe(44);

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await names()).length).toBe(0);
  await expect(page.getByRole("heading", { name: "Nothing tracked yet", level: 2 })).toBeVisible();

  // Add items from the empty screen.
  await page.getByRole("button", { name: "Add items" }).first().click();
  await page.getByRole("dialog", { name: "Add items" }).getByRole("textbox").fill("Venue");
  await page.getByRole("dialog", { name: "Add items" }).getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(async () => await names()).toEqual(["Venue"]);
  await expect(row(page, (await stored())[0].id).getByLabel("Item", { exact: true })).toHaveValue("Venue");
});

test("on a phone the rows stack and the tools fit", async ({ browser }) => {
  const page = await openItems(browser, { width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Wedding items", level: 1 })).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(wide).toBeLessThanOrEqual(0);
  // The column heads are gone and the vendor sits under the name.
  await expect(page.getByText("Who it’s for", { exact: true })).toBeHidden();
  const name = await row(page, "it-gown").getByLabel("Item", { exact: true }).boundingBox();
  const vendor = await row(page, "it-gown").getByLabel("Vendor for Bride's gown").boundingBox();
  expect(vendor!.y).toBeGreaterThan(name!.y);
});
