import { expect, test, type Browser, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.22: Tasks at /new/schedule/tasks against the emulators (guide §5.21,
// §6.2, S8, S9). Everything is written as the emulator's owner (which skips the
// rules), with dates counted from today, so the order, the late line and the
// finished days read the same whenever this runs.

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
            ? { integerValue: String(value) }
            : typeof value === "string"
              ? { stringValue: value }
              : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typed(v)])) } };

const CREATED = new Date("2026-01-01T00:00:00Z");

async function put(collection: string, id: string, fields: Record<string, Value>) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typed(v)])) };
  const res = await fetch(`${DOCS}/${collection}/${id}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

async function del(collection: string, id: string) {
  await fetch(`${DOCS}/${collection}/${id}`, { method: "DELETE", headers: ADMIN });
}

type Plain = string | number | boolean | null | Plain[] | { [key: string]: Plain };

const plain = (v: Record<string, unknown>): Plain =>
  "stringValue" in v
    ? (v.stringValue as string)
    : "integerValue" in v
      ? Number(v.integerValue)
      : "booleanValue" in v
        ? (v.booleanValue as boolean)
        : "arrayValue" in v
          ? ((v.arrayValue as { values?: Record<string, unknown>[] }).values ?? []).map(plain)
          : "mapValue" in v
            ? Object.fromEntries(Object.entries((v.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {}).map(([k, x]) => [k, plain(x)]))
            : null;

/** A stored document as plain values, or null when it isn't there. */
async function read(collection: string, id: string): Promise<Record<string, Plain> | null> {
  const res = await fetch(`${DOCS}/${collection}/${id}`, { headers: ADMIN });
  if (res.status === 404) return null;
  const { fields } = (await res.json()) as { fields: Record<string, Record<string, unknown>> };
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, plain(v)]));
}

/** Tasks written by the page itself: found by title, since their ids are made in the browser. */
async function findByTitle(title: string): Promise<(Record<string, Plain> & { id: string }) | null> {
  const res = await fetch(`${DOCS}:runQuery`, {
    method: "POST",
    headers: ADMIN,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "todos" }],
        where: { fieldFilter: { field: { fieldPath: "title" }, op: "EQUAL", value: { stringValue: title } } },
      },
    }),
  });
  const rows = (await res.json()) as { document?: { name: string } }[];
  const name = rows.find((r) => r.document)?.document?.name;
  if (!name) return null;
  const id = name.split("/").pop() as string;
  const doc = await read("todos", id);
  return doc ? { id, ...doc } : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

const step = (id: string, title: string, done = false, dueDate: string | null = null) => ({ id, title, notes: "", dueDate, done });

const IDS = ["tk-rings", "tk-dress", "tk-trip", "tk-sent", "tk-church"];
const MANY = Array.from({ length: 101 }, (_, i) => `tk-many-${i}`);

test.beforeEach(async () => {
  await put("settings", "wedding", { yourName: "Greg", partnerName: "Bella", partnerEmail: TEST_ACCOUNTS[1].email });
  await put("todos", "tk-rings", {
    title: "Choose the rings",
    notes: "",
    dueDate: inDays(3),
    done: false,
    subtasks: [step("s1", "Visit the jeweller"), step("s2", "Pick the metal", true)],
    createdAt: CREATED,
  });
  await put("todos", "tk-dress", {
    title: "Book the dress fitting",
    notes: "Ask about alterations first",
    dueDate: inDays(-2),
    done: false,
    subtasks: [],
    createdAt: CREATED,
  });
  await put("todos", "tk-trip", { title: "Plan the honeymoon", notes: "", dueDate: null, done: false, subtasks: [], createdAt: CREATED });
  // Finished with a day recorded, and finished before the day was kept (N8).
  await put("todos", "tk-sent", { title: "Send the invitations", notes: "", dueDate: inDays(-9), done: true, doneOn: inDays(-5), subtasks: [], createdAt: CREATED });
  await put("todos", "tk-church", { title: "Book the church", notes: "", dueDate: inDays(-30), done: true, subtasks: [], createdAt: CREATED });
});

test.afterEach(async () => {
  for (const id of [...IDS, ...MANY]) await del("todos", id);
  for (const title of ["Order the cake", "Hire a photographer"]) {
    const found = await findByTitle(title);
    if (found) await del("todos", found.id);
  }
  await put("settings", "wedding", { yourName: "", partnerName: "", weddingDate: null, startedOn: null });
});

async function openTasks(browser: Browser, account: (typeof TEST_ACCOUNTS)[number] = TEST_ACCOUNTS[0], path = "/new/schedule/tasks") {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page;
}

const task = (page: Page, id: string) => page.locator(`[data-task-id="${id}"]`);
const toasts = (page: Page) => page.getByRole("status");
const finishedDisclosure = (page: Page) => page.getByText(/^(Show|Hide) \d+ finished tasks?$/);

test("open tasks run by due date with undated last, and finished ones sit in a disclosure", async ({ browser }) => {
  const page = await openTasks(browser);

  await expect(page.getByText("3 open, 2 done")).toBeVisible();
  await expect(page.getByRole("link", { name: "Tasks", exact: true }).first()).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: /^Open/, level: 2 })).toContainText("by due date, undated last");

  // Open by due date (late first), undated last; then the finished ones, the latest first and the one with no day last.
  const ids = await page.locator("[data-task-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-task-id")));
  expect(ids).toEqual(["tk-dress", "tk-rings", "tk-trip", "tk-sent", "tk-church"]);

  await expect(task(page, "tk-dress")).toContainText("2 days late");
  await expect(task(page, "tk-dress")).toContainText("Ask about alterations first");
  await expect(task(page, "tk-rings")).toContainText("1 of 2 steps done");
  await expect(task(page, "tk-rings").getByRole("img", { name: "50% of steps done" })).toBeVisible();
  await expect(task(page, "tk-trip")).toContainText("No date");

  await expect(page.getByRole("checkbox", { name: "Finish Choose the rings" })).toBeVisible();
  await finishedDisclosure(page).click();
  await expect(page.getByText("Hide 2 finished tasks")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Reopen Send the invitations" })).toBeVisible();
  // N8: a finished task with no recorded day says Done, never its due date or today.
  await expect(task(page, "tk-church").locator("summary")).toHaveText(/Book the church\s*Done$/);
  await expect(task(page, "tk-sent").locator("summary")).toHaveText(/Send the invitations\s*Done \d+ \w+/);
});

test("?open= opens that task, and a finished one opens the finished disclosure", async ({ browser }) => {
  const page = await openTasks(browser, TEST_ACCOUNTS[0], "/new/schedule/tasks?open=tk-rings");
  await expect(task(page, "tk-rings")).toHaveAttribute("open", "");
  await expect(task(page, "tk-rings").getByLabel("Due date", { exact: true })).toHaveValue(inDays(3));
  await expect(task(page, "tk-dress")).not.toHaveAttribute("open", "");

  const finished = await openTasks(browser, TEST_ACCOUNTS[0], "/new/schedule/tasks?open=tk-church");
  await expect(task(finished, "tk-church")).toHaveAttribute("open", "");
  await expect(task(finished, "tk-church")).toBeVisible();
  await expect(finished.getByText("Hide 2 finished tasks")).toBeVisible();
});

test("Finish records today, Reopen clears it, and Undo puts either back", async ({ browser }) => {
  const page = await openTasks(browser);

  await page.getByRole("checkbox", { name: "Finish Choose the rings" }).click();
  await expect(toasts(page).getByText("Finished Choose the rings")).toBeVisible();
  await expect(page.getByText("2 open, 3 done")).toBeVisible();
  await expect.poll(async () => (await read("todos", "tk-rings"))?.doneOn).toBe(inDays(0));
  expect((await read("todos", "tk-rings"))?.done).toBe(true);
  // Finishing doesn't open or close its disclosure.
  await expect(task(page, "tk-rings")).not.toHaveAttribute("open", "");

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await read("todos", "tk-rings"))?.done).toBe(false);
  // The seeded task had no `doneOn`, so undo takes the field away again.
  expect((await read("todos", "tk-rings"))?.doneOn ?? null).toBeNull();
  await expect(page.getByText("3 open, 2 done")).toBeVisible();

  // Finish, then reopen it from the finished list.
  await page.getByRole("checkbox", { name: "Finish Plan the honeymoon" }).click();
  await expect(toasts(page).getByText("Finished Plan the honeymoon")).toBeVisible();
  await finishedDisclosure(page).click();
  await page.getByRole("checkbox", { name: "Reopen Plan the honeymoon" }).click();
  await expect(toasts(page).getByText("Reopened Plan the honeymoon")).toBeVisible();
  await expect.poll(async () => (await read("todos", "tk-trip"))?.done).toBe(false);
  expect((await read("todos", "tk-trip"))?.doneOn).toBeNull();
});

test("steps: add, name, date, tick and remove, each saved on its own, with Undo for a removal", async ({ browser }) => {
  const page = await openTasks(browser, TEST_ACCOUNTS[0], "/new/schedule/tasks?open=tk-rings");
  const rings = task(page, "tk-rings");

  await rings.getByRole("button", { name: "Add a step" }).click();
  const added = rings.getByLabel("Step", { exact: true }).nth(2);
  await expect(added).toBeFocused();
  await added.fill("Compare prices");
  await added.press("Enter");
  await expect.poll(async () => ((await read("todos", "tk-rings"))?.subtasks as { title: string }[]).map((s) => s.title)).toEqual(["Visit the jeweller", "Pick the metal", "Compare prices"]);

  await rings.getByLabel("Step due date").nth(2).fill(inDays(7));
  await rings.getByLabel("Step due date").nth(2).blur();
  await expect.poll(async () => ((await read("todos", "tk-rings"))?.subtasks as { dueDate: string | null }[])[2].dueDate).toBe(inDays(7));

  await rings.getByRole("checkbox", { name: "Step done: Compare prices" }).click();
  await expect.poll(async () => ((await read("todos", "tk-rings"))?.subtasks as { done: boolean }[])[2].done).toBe(true);
  await expect(rings).toContainText("2 of 3 steps done");

  // Removing the first step asks nothing, says so, and Undo puts it back at the same place.
  await rings.getByRole("button", { name: "Remove step" }).first().click();
  await expect(toasts(page).getByText("Removed a step")).toBeVisible();
  await expect.poll(async () => ((await read("todos", "tk-rings"))?.subtasks as unknown[]).length).toBe(2);
  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => ((await read("todos", "tk-rings"))?.subtasks as { title: string }[]).map((s) => s.title)).toEqual(["Visit the jeweller", "Pick the metal", "Compare prices"]);
});

test("the due date and notes save as you go, and the order follows the date", async ({ browser }) => {
  const page = await openTasks(browser, TEST_ACCOUNTS[0], "/new/schedule/tasks?open=tk-trip");
  const trip = task(page, "tk-trip");

  await trip.getByLabel("Notes").fill("Bali or Lombok");
  await trip.getByLabel("Notes").blur();
  await expect.poll(async () => (await read("todos", "tk-trip"))?.notes).toBe("Bali or Lombok");

  await trip.getByLabel("Due date", { exact: true }).fill(inDays(-10));
  await trip.getByLabel("Due date", { exact: true }).blur();
  await expect.poll(async () => (await read("todos", "tk-trip"))?.dueDate).toBe(inDays(-10));
  const ids = await page.locator("[data-task-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-task-id")));
  expect(ids.slice(0, 3)).toEqual(["tk-trip", "tk-dress", "tk-rings"]);
  await expect(trip).toHaveAttribute("open", "");

  // Clearing the date makes it undated again.
  await trip.getByLabel("Due date", { exact: true }).fill("");
  await trip.getByLabel("Due date", { exact: true }).blur();
  await expect.poll(async () => (await read("todos", "tk-trip"))?.dueDate).toBeNull();
});

test("Delete task asks first, names its steps, and Undo brings it back exactly", async ({ browser }) => {
  const page = await openTasks(browser, TEST_ACCOUNTS[0], "/new/schedule/tasks?open=tk-rings");
  const before = await read("todos", "tk-rings");

  await task(page, "tk-rings").getByRole("button", { name: "Delete task" }).click();
  const confirm = page.getByRole("dialog").filter({ hasText: "Delete Choose the rings?" });
  await expect(confirm.getByText("Its 2 steps go with it. You can undo for a few seconds.")).toBeVisible();
  await confirm.getByRole("button", { name: "Keep it" }).click();
  expect(await read("todos", "tk-rings")).not.toBeNull();

  await task(page, "tk-rings").getByRole("button", { name: "Delete task" }).click();
  await page.getByRole("dialog").filter({ hasText: "Delete Choose the rings?" }).getByRole("button", { name: "Delete task" }).click();
  await expect(toasts(page).getByText("Deleted Choose the rings")).toBeVisible();
  await expect(task(page, "tk-rings")).toHaveCount(0);
  expect(await read("todos", "tk-rings")).toBeNull();

  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => read("todos", "tk-rings")).not.toBeNull();
  const after = await read("todos", "tk-rings");
  for (const key of ["title", "notes", "dueDate", "done", "subtasks"]) expect(after?.[key]).toEqual(before?.[key]);
  await expect(task(page, "tk-rings")).toBeVisible();
});

test("Add a task says what's missing and keeps the date, then adds and opens it", async ({ browser }) => {
  const page = await openTasks(browser);
  await page.getByRole("button", { name: "Add a task" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a task" });

  await sheet.getByLabel("Due date", { exact: true }).fill(inDays(20));
  await sheet.getByRole("button", { name: "Add task" }).click();
  await expect(sheet.getByText("Say what needs doing, so you can find the task later.")).toBeVisible();
  await expect(sheet.getByLabel("What needs doing")).toBeFocused();
  await expect(sheet.getByLabel("Due date", { exact: true })).toHaveValue(inDays(20));
  expect(await findByTitle("Order the cake")).toBeNull();

  await sheet.getByLabel("What needs doing").fill("Order the cake");
  await sheet.getByRole("button", { name: "Add task" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(toasts(page).getByText("Added Order the cake")).toBeVisible();
  await expect(page.getByText("4 open, 2 done")).toBeVisible();
  await expect.poll(async () => findByTitle("Order the cake")).not.toBeNull();
  const stored = await findByTitle("Order the cake");
  expect(stored).toMatchObject({ notes: "", dueDate: inDays(20), done: false, doneOn: null, subtasks: [] });
  await expect(page.locator(`[data-task-id="${stored?.id}"]`)).toHaveAttribute("open", "");
});

test("a step that can't be saved keeps what was typed, and Try again saves it", async ({ browser }) => {
  const page = await openTasks(browser, TEST_ACCOUNTS[0], "/new/schedule/tasks?open=tk-rings");
  const rings = task(page, "tk-rings");
  const second = rings.getByLabel("Step", { exact: true }).nth(1);

  await page.context().setOffline(true);
  await second.fill("Pick the metal and the size");
  await second.press("Enter");
  await expect(rings.getByText("Couldn’t save this step. What you typed is kept.")).toBeVisible({ timeout: 30_000 });
  await expect(second).toHaveValue("Pick the metal and the size");
  await expect(second).toHaveAttribute("aria-invalid", "true");

  await page.context().setOffline(false);
  await rings.getByRole("button", { name: "Try again" }).click();
  await expect(rings.getByText("Couldn’t save this step. What you typed is kept.")).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => ((await read("todos", "tk-rings"))?.subtasks as { title: string }[])[1].title).toBe("Pick the metal and the size");
});

test("Bella finishes a step: Greg sees a toast", async ({ browser }) => {
  const greg = await openTasks(browser, TEST_ACCOUNTS[0]);
  const bella = await openTasks(browser, TEST_ACCOUNTS[1], "/new/schedule/tasks?open=tk-rings");

  await bella.getByRole("checkbox", { name: "Step done: Visit the jeweller" }).click();
  await expect(greg.getByRole("status").getByText("Bella finished “Visit the jeweller”")).toBeVisible({ timeout: 15_000 });
  await expect(task(greg, "tk-rings")).toContainText("2 of 2 steps done");
  // Her own change isn't news to her.
  await expect(bella.getByRole("status").getByText(/Bella finished/)).toHaveCount(0);
});

test("long lists show 100 tasks at a time", async ({ browser }) => {
  for (const [i, id] of MANY.entries()) {
    await put("todos", id, { title: `Extra task ${i}`, notes: "", dueDate: inDays(30 + (i % 20)), done: false, subtasks: [], createdAt: CREATED });
  }
  const page = await openTasks(browser);

  // 3 open from before and 101 more.
  await expect(page.getByText("104 open, 2 done")).toBeVisible();
  await expect(page.getByText("Showing 100 of 104")).toBeVisible();
  await expect(page.locator("main [data-task-id]")).toHaveCount(100 + 2);
  await page.getByRole("button", { name: "Show 4 more" }).click();
  await expect(page.getByText("Showing 100 of 104")).toHaveCount(0);
  await expect(page.locator("main [data-task-id]")).toHaveCount(104 + 2);
});
