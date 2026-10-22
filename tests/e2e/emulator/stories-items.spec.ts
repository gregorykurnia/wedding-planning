import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { openAt, put, resetData, restorePairing, stored, type Value } from "../stories";

test.afterEach(closeOtherContexts);
test.afterAll(restorePairing);

// Task 8.1b, stories T1–T8 and T10: Wedding items at /items, by roles and labels (guide §5.22, §8).
// T9 (a failed save keeps what was typed) has its test in veil-items.spec.ts.

const CREATED = new Date("2026-01-01T00:00:00Z");

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
  ["it-pillow", item("Ring bearer's pillow", 4)],
];

async function seed() {
  await resetData();
  await put("masterListMeta", "initialization", { initialized: true, nextSortOrder: SEED.length });
  for (const [id, fields] of SEED) await put("masterListItems", id, fields);
}

async function openItems(page: Page) {
  await openAt(page, "/items");
  await expect(page.getByRole("heading", { name: "Wedding items", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

const row = (page: Page, id: string) => page.locator(`[data-item-id="${id}"]`);
const rowIds = (page: Page) => page.locator("[data-item-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-item-id")));
const expectRows = (page: Page, ids: string[]) => expect.poll(() => rowIds(page)).toEqual(ids);
const toasts = (page: Page) => page.getByRole("status");
/** The items in our own order, as stored. */
const inOrder = async () => (await stored("masterListItems")).sort((a, z) => (a.sortOrder as number) - (z.sortOrder as number));
const readItem = async (id: string) => (await stored("masterListItems")).find((d) => d.id === id);

test.describe("with five items", () => {
  test.beforeEach(seed);

  test("T1 item and vendor: a name and a vendor are typed in the row and kept, and a name can't be emptied", async ({ page }) => {
    await openItems(page);
    const pillow = row(page, "it-pillow");
    await pillow.getByLabel("Item", { exact: true }).fill("Ring bearer's cushion");
    await pillow.getByLabel("Item", { exact: true }).press("Enter");
    await expect.poll(async () => (await readItem("it-pillow"))?.item).toBe("Ring bearer's cushion");

    await pillow.getByLabel("Vendor for Ring bearer's cushion").fill("Toko Seruni");
    await pillow.getByLabel("Vendor for Ring bearer's cushion").press("Enter");
    await expect.poll(async () => (await readItem("it-pillow"))?.vendor).toBe("Toko Seruni");

    // An emptied name comes back as it was; a vendor can be cleared.
    await pillow.getByLabel("Item", { exact: true }).fill("");
    await pillow.getByLabel("Item", { exact: true }).press("Enter");
    await expect(pillow.getByLabel("Item", { exact: true })).toHaveValue("Ring bearer's cushion");
    await pillow.getByLabel("Vendor for Ring bearer's cushion").fill("");
    await pillow.getByLabel("Vendor for Ring bearer's cushion").press("Enter");
    await expect.poll(async () => (await readItem("it-pillow"))?.vendor).toBe("");
  });

  test("T2 confirmed, events, person: the tick, the event chips and the people each save, and General means no one", async ({ page }) => {
    await openItems(page);
    const cake = row(page, "it-cake");

    await cake.getByRole("button", { name: "Confirmed: Wedding cake" }).click();
    await expect.poll(async () => (await readItem("it-cake"))?.confirmed).toBe(true);
    await cake.getByRole("group", { name: /^Events for/ }).getByRole("button", { name: "Sangjit" }).click();
    await expect.poll(async () => (await readItem("it-cake"))?.types).toEqual(["Reception", "Sangjit"]);

    await cake.getByLabel("Who Wedding cake is for: General").click();
    await cake.getByRole("checkbox", { name: "Groom's mother" }).check();
    await cake.getByRole("checkbox", { name: "Bride's father" }).check();
    await expect.poll(async () => (await readItem("it-cake"))?.persons).toEqual(["Groom Mom", "Bride Dad"]);
    await expect(cake.getByLabel(/^Who Wedding cake is for/)).toHaveText("Groom's mother, Bride's father");
    await cake.getByRole("checkbox", { name: "General, no one in particular" }).check();
    await expect.poll(async () => (await readItem("it-cake"))?.persons).toEqual([]);
    await expect(cake.getByLabel(/^Who Wedding cake is for/)).toHaveText("General");
  });

  test("T3 work on next: the star marks an item, and the card lists the marked ones in our order and jumps to a row", async ({ page }) => {
    await openItems(page);
    const card = page.getByRole("region", { name: "To work on next" });
    await expect(card.getByRole("button")).toHaveText(["Wedding cake", "Makeup for both mothers"]);

    await row(page, "it-pillow").getByRole("button", { name: "Work on next: Ring bearer's pillow" }).click();
    await expect.poll(async () => (await readItem("it-pillow"))?.next).toBe(true);
    await expect(card.getByRole("button")).toHaveText(["Wedding cake", "Makeup for both mothers", "Ring bearer's pillow"]);
    await expect(page.getByText("3 marked to work on next")).toBeVisible();

    await row(page, "it-cake").getByRole("button", { name: "Work on next: Wedding cake" }).click();
    await expect.poll(async () => (await readItem("it-cake"))?.next).toBe(false);
    await expect(card.getByRole("button")).toHaveText(["Makeup for both mothers", "Ring bearer's pillow"]);

    await card.getByRole("button", { name: "Ring bearer's pillow" }).click();
    await expect(row(page, "it-pillow").getByLabel("Item", { exact: true })).toBeFocused();
  });

  test("T4 counts: the figure, the ring and the sentence follow each tick", async ({ page }) => {
    await openItems(page);
    await expect(page.locator("p", { hasText: /^2of 5$/ })).toBeVisible();
    await expect(page.getByRole("img", { name: "40% confirmed, 3 to go" })).toBeVisible();

    await row(page, "it-cake").getByRole("button", { name: "Confirmed: Wedding cake" }).click();
    await expect(page.locator("p", { hasText: /^3of 5$/ })).toBeVisible();
    await expect(page.getByRole("img", { name: "60% confirmed, 2 to go" })).toBeVisible();
    await row(page, "it-venue").getByRole("button", { name: "Confirmed: Reception venue" }).click();
    await expect(page.locator("p", { hasText: /^2of 5$/ })).toBeVisible();
  });

  test("T5 narrow items: search, events (any of them), people, confirmed and work on next, then Show everything", async ({ page }) => {
    await openItems(page);
    const search = page.getByRole("searchbox", { name: "Search items, vendors and people" });

    await search.fill("ayu");
    await expectRows(page, ["it-gown"]);
    await expect(page.getByText("1 item of 5")).toBeVisible();
    await search.fill("zzz");
    await expect(page.getByRole("heading", { name: "Nothing matches “zzz”", level: 2 })).toBeVisible();
    await page.getByRole("button", { name: "Show everything" }).first().click();
    await expectRows(page, ["it-venue", "it-cake", "it-gown", "it-makeup", "it-pillow"]);
    await expect(search).toHaveValue("");

    const events = page.getByRole("group", { name: "Events", exact: true });
    await events.getByRole("button", { name: "Sangjit" }).click();
    await expectRows(page, ["it-makeup"]);
    await events.getByRole("button", { name: "Holy matrimony" }).click();
    await expectRows(page, ["it-gown", "it-makeup"]);
    await page.getByRole("button", { name: "Show everything" }).first().click();

    await page.getByText("Anyone", { exact: true }).click();
    const people = page.getByRole("group", { name: "People" });
    await people.getByLabel("Bride's mother").check();
    await people.getByLabel("Bride", { exact: true }).check();
    await expectRows(page, ["it-gown", "it-makeup"]);
    await page.getByRole("button", { name: "Show everything" }).first().click();

    await page.getByLabel("Show", { exact: true }).selectOption("yes");
    await expectRows(page, ["it-venue", "it-gown"]);
    await page.getByRole("button", { name: "Show everything" }).first().click();
    await page.getByLabel("Work on next only").check();
    await expectRows(page, ["it-cake", "it-makeup"]);
    await page.getByRole("button", { name: "Show everything" }).first().click();
    await expect(page.getByRole("button", { name: "Show everything" })).toHaveCount(0);
  });

  test("T6 temporary order: a sort hides the handles and says so, and Back to our order brings them back, our order untouched", async ({ page }) => {
    await openItems(page);
    await expect(row(page, "it-cake").getByRole("button", { name: /^Move Wedding cake/ })).toBeVisible();

    await page.getByLabel("Order by").selectOption("name");
    await expect(page.getByText("Sorted by item for now. Your own order is kept.")).toBeVisible();
    await expectRows(page, ["it-gown", "it-makeup", "it-venue", "it-pillow", "it-cake"]);
    await expect(page.getByRole("button", { name: /^Move Wedding cake/ })).toHaveCount(0);
    expect((await inOrder()).map((d) => d.id)).toEqual(["it-venue", "it-cake", "it-gown", "it-makeup", "it-pillow"]);

    await page.getByRole("button", { name: "Back to our order" }).click();
    await expectRows(page, ["it-venue", "it-cake", "it-gown", "it-makeup", "it-pillow"]);
    await expect(row(page, "it-cake").getByRole("button", { name: /^Move Wedding cake/ })).toBeVisible();
  });

  test("T7 own order and insert: Alt+arrow, the row menu and a drag move an item, and items are added below a row", async ({ page }) => {
    await openItems(page);
    const handle = row(page, "it-gown").getByRole("button", { name: /^Move Bride's gown/ });
    await handle.focus();
    await page.keyboard.press("Alt+ArrowUp");
    await expect.poll(async () => (await inOrder()).map((d) => d.id).slice(0, 3)).toEqual(["it-venue", "it-gown", "it-cake"]);
    await expect(handle).toBeFocused();

    await row(page, "it-venue").getByRole("button", { name: "More for Reception venue" }).click();
    await page.getByRole("menuitem", { name: "Move down" }).click();
    await expect.poll(async () => (await inOrder()).map((d) => d.id).slice(0, 2)).toEqual(["it-gown", "it-venue"]);

    await row(page, "it-pillow").dragTo(row(page, "it-gown"), { targetPosition: { x: 40, y: 4 }, sourcePosition: { x: 3, y: 20 } });
    await expect.poll(async () => (await inOrder())[0].id).toBe("it-pillow");

    // Several at once, one per line, below a row; the new ones copy its events and people.
    await row(page, "it-makeup").getByRole("button", { name: "More for Makeup for both mothers" }).click();
    await page.getByRole("menuitem", { name: "Add several below" }).click();
    const sheet = page.getByRole("dialog", { name: "Add items" });
    await sheet.getByRole("textbox").fill("Corsages\n\nHair pins");
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
    await expect(toasts(page).getByText("Added 2 items")).toBeVisible();
    await expect
      .poll(async () => (await inOrder()).map((d) => d.item))
      .toEqual(["Ring bearer's pillow", "Bride's gown", "Reception venue", "Wedding cake", "Makeup for both mothers", "Corsages", "Hair pins"]);
    expect((await inOrder())[5]).toMatchObject({ types: ["Sangjit"], persons: ["Bride Mom", "Groom Mom"] });
  });

  test("T8 remove with undo: Remove asks first, and Undo puts the item back exactly where it was", async ({ page }) => {
    await openItems(page);
    await row(page, "it-cake").getByRole("button", { name: "More for Wedding cake" }).click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    const confirm = page.getByRole("dialog", { name: "Remove Wedding cake?" });
    await confirm.getByRole("button", { name: "Keep it" }).click();
    expect(await readItem("it-cake")).toBeTruthy();

    await row(page, "it-cake").getByRole("button", { name: "More for Wedding cake" }).click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await page.getByRole("dialog", { name: "Remove Wedding cake?" }).getByRole("button", { name: "Remove item" }).click();
    await expect(toasts(page).getByText("Removed Wedding cake")).toBeVisible();
    await expect.poll(async () => await readItem("it-cake")).toBeUndefined();

    await toasts(page).getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => (await readItem("it-cake"))?.item).toBe("Wedding cake");
    expect(await readItem("it-cake")).toMatchObject({ sortOrder: 1, next: true, types: ["Reception"] });
    await expectRows(page, ["it-venue", "it-cake", "it-gown", "it-makeup", "it-pillow"]);
  });
});

test("T10 starts filled in: a new tracker fills itself with the common items and says so; an emptied one offers them again", async ({ page }) => {
  await resetData();
  await openItems(page);
  await expect(page.getByText("The tracker starts with 44 common items. Rename, fill in or remove any of them.")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect.poll(async () => (await rowIds(page)).length).toBe(44);
  await expect.poll(async () => (await stored("masterListItems")).length).toBe(44);

  // Emptied on purpose, it stays empty until asked.
  await resetData();
  await put("masterListMeta", "initialization", { initialized: true, nextSortOrder: 44 });
  await page.goto("/items");
  await expect(page.getByRole("heading", { name: "Nothing tracked yet", level: 2 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.getByRole("button", { name: "Start with common items" }).click();
  await expect(toasts(page).getByText("Added 44 common items")).toBeVisible();
  await expect.poll(async () => (await stored("masterListItems")).length).toBe(44);
});
