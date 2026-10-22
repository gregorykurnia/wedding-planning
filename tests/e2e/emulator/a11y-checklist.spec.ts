import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { inDays, openAt, put, resetData, restorePairing, type Value } from "../stories";

test.afterEach(closeOtherContexts);
test.afterAll(restorePairing);

// Task 8.4, the guide §8 checklist where focus has to land after a press (P3-S8, P3-S12, P4-S19) and the
// few checklist lines no other spec asserts. axe runs over every screen and state in `npm run screenshots -- --axe`.

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

async function seedItems(count: number) {
  await resetData();
  await put("masterListMeta", "initialization", { initialized: true, nextSortOrder: count });
  const names = ["Reception venue", "Wedding cake", "Bride's gown", "Makeup for both mothers"];
  for (let i = 0; i < count; i += 1) {
    await put("masterListItems", `it-${String(i).padStart(3, "0")}`, item(names[i] ?? `Item ${i}`, i, { next: i === 1 }));
  }
}

async function openItems(page: Page) {
  await openAt(page, "/items");
  await expect(page.getByRole("heading", { name: "Wedding items", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

test.describe("items", () => {
  test("P3-S12 Move down in the row menu returns focus to the row's handle and announces the move", async ({ page }) => {
    await seedItems(4);
    await openItems(page);
    await page.getByRole("button", { name: "More for Reception venue" }).click();
    await page.getByRole("menuitem", { name: "Move down" }).click();
    await expect(page.getByRole("button", { name: /^Move Reception venue/ })).toBeFocused();
    await expect(page.getByRole("status").getByText("Reception venue moved to 2 of 4")).toBeAttached();
  });

  test("P3-S8 Show everything and Back to our order give focus to the search field", async ({ page }) => {
    await seedItems(4);
    await openItems(page);
    const search = page.getByRole("searchbox");
    await page.getByLabel("Work on next only").check();
    await page.getByRole("button", { name: "Show everything" }).first().click();
    await expect(search).toBeFocused();

    await page.getByLabel("Order by").selectOption("name");
    await page.getByRole("button", { name: "Back to our order" }).click();
    await expect(search).toBeFocused();

    // With nothing found, the message's own Show everything does the same.
    await search.fill("zzzz");
    await page.getByRole("button", { name: "Show everything" }).nth(1).click();
    await expect(search).toBeFocused();
  });

  test("P3-S8 the last Show more gives focus to the first thing in the row it added", async ({ page }) => {
    await seedItems(151);
    await openItems(page);
    await page.getByRole("button", { name: /^Show 1 more/ }).click();
    await expect(page.locator('[data-item-id="it-150"] [data-handle]')).toBeFocused();
  });

  test("item text carries dir=auto, and Escape closes the row menu and returns focus to its button", async ({ page }) => {
    await seedItems(4);
    await openItems(page);
    const row = page.locator('[data-item-id="it-001"]');
    await expect(row.getByLabel("Item", { exact: true })).toHaveAttribute("dir", "auto");
    await expect(row.getByLabel("Vendor for Wedding cake")).toHaveAttribute("dir", "auto");
    const more = page.getByRole("button", { name: "More for Wedding cake" });
    await more.click();
    await expect(page.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(more).toBeFocused();
  });
});

test.describe("tasks", () => {
  const step = (id: string, title: string) => ({ id, title, notes: "", dueDate: null, done: false });
  const base = { notes: "", done: false, subtasks: [] as Value[], createdAt: CREATED };

  test.beforeEach(async ({ page }) => {
    await resetData();
    await put("todos", "t-a", { ...base, title: "Book the florist", dueDate: inDays(3), subtasks: [step("s1", "Call"), step("s2", "Pay deposit")] });
    await put("todos", "t-b", { ...base, title: "Order the invitations", dueDate: inDays(6) });
    await put("todos", "t-c", { ...base, title: "Write the vows", dueDate: inDays(9) });
    await put("todos", "t-d", { ...base, title: "Choose the music", dueDate: inDays(-9), done: true });
    await openAt(page, "/schedule/tasks");
    await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  });

  test("P4-S19 finishing a task moves focus to the next task's tick; reopening one keeps it on its own tick", async ({ page }) => {
    const tick = (title: string) => page.getByRole("checkbox", { name: new RegExp(`^(Finish|Reopen) ${title}`) });
    await tick("Order the invitations").click();
    await expect(tick("Write the vows")).toBeFocused();

    await page.getByText(/finished tasks/).click();
    await tick("Choose the music").click();
    await expect(page.getByRole("checkbox", { name: "Finish Choose the music" })).toBeFocused();
  });

  test("P4-S19 removing a step moves focus to the next step, then to Add a step", async ({ page }) => {
    const task = page.locator('[data-task-id="t-a"]');
    await task.locator("summary").click();
    await task.getByRole("button", { name: "Remove step" }).first().click();
    await expect(task.getByLabel("Step", { exact: true })).toHaveCount(1);
    await expect(task.getByLabel("Step", { exact: true })).toBeFocused();
    await task.getByRole("button", { name: "Remove step" }).click();
    await expect(task.getByRole("button", { name: "Add a step" })).toBeFocused();
  });
});

test("reduced motion: transitions and animations run in 0.001ms", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await resetData();
  await openAt(page, "/");
  const times = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector("main") ?? document.body);
    return [style.transitionDuration, style.animationDuration];
  });
  for (const t of times) expect(parseFloat(t.split(",")[0])).toBeLessThan(0.001);
});
