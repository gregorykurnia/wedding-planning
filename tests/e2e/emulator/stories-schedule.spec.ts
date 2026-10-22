import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { inDays, openAt, put, resetData, restorePairing, storedDoc, stored, type Value } from "../stories";

test.afterEach(closeOtherContexts);
test.afterAll(restorePairing);

// Task 8.1b, stories S4 (the month), S8 and S9 (tasks), by roles and labels (guide §5.20, §5.21, §8).
// S1–S3 and S5–S7 have their tests in veil-schedule.spec.ts and veil-tasks.spec.ts.

const CREATED = new Date("2026-01-01T00:00:00Z");

// ---------- S4 month ----------

// A fixed March, so the marks don't depend on the day this runs.
const DRESS = "2031-03-10";
const CAKE = "2031-03-11";
const QUIET = "2031-03-14";
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dayCell(page: Page, day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return page.getByRole("button", { name: new RegExp(`^${WEEKDAY[new Date(year, month - 1, date).getDay()]} ${date} ${MONTH[month - 1]}`) });
}

const event = (title: string, type: string, startAt: string): Record<string, Value> => ({
  title,
  type,
  startAt,
  endAt: null,
  allDay: false,
  status: "scheduled",
  notes: "",
  location: "",
  relatedVendorId: null,
  relatedVenueId: null,
  reminderMinutes: [],
});

test("S4 month: days carry their events, choosing a day lists it, Earlier and Later move the month, and Add something adds to the day", async ({ page }) => {
  await resetData();
  await put("scheduleEvents", "m-dress", event("Dress fitting", "appointment", `${DRESS}T10:00`));
  await put("scheduleEvents", "m-florist", event("Florist call", "vendor_call", `${DRESS}T15:00`));
  await put("scheduleEvents", "m-cake", event("Cake tasting", "appointment", `${CAKE}T11:00`));

  await openAt(page, `/schedule/month?day=${DRESS}`);
  await expect(page.getByRole("heading", { name: "March 2031", exact: true })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("navigation", { name: "Agenda, month and tasks" }).getByRole("link", { name: "Month" })).toHaveAttribute("aria-current", "page");
  await expect(dayCell(page, DRESS)).toHaveAttribute("aria-label", /, selected, 2 events$/);
  await expect(dayCell(page, CAKE)).toHaveAttribute("aria-label", /, 1 event$/);
  await expect(dayCell(page, QUIET)).toHaveAttribute("aria-label", /, nothing$/);

  // Choosing a day lists what is on it.
  await dayCell(page, CAKE).click();
  await expect(dayCell(page, CAKE)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Cake tasting").first()).toBeVisible();
  await expect(page.getByText("Dress fitting")).toHaveCount(0);

  // Later and Earlier move the month, and the chosen day stays chosen.
  await page.getByRole("button", { name: /^Later:/ }).click();
  await expect(page.getByRole("heading", { name: "April 2031", exact: true })).toBeVisible();
  await expect(page.getByText("Cake tasting").first()).toBeVisible();
  await page.getByRole("button", { name: /^Earlier:/ }).click();
  await expect(page.getByRole("heading", { name: "March 2031", exact: true })).toBeVisible();

  // An empty day offers to add to it.
  await dayCell(page, QUIET).click();
  await expect(page.getByText("Nothing on this day.")).toBeVisible();
  await page.getByRole("button", { name: "Add something" }).click();
  const sheet = page.getByRole("dialog", { name: "Add to the schedule" });
  await expect(sheet.getByLabel("Date")).toHaveValue(QUIET);
  await sheet.getByLabel("Title").fill("Rehearsal dinner");
  await sheet.getByRole("button", { name: "Add to the schedule" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(dayCell(page, QUIET)).toHaveAttribute("aria-label", /, selected, 1 event$/);
  await expect.poll(async () => (await stored("scheduleEvents")).some((e) => e.title === "Rehearsal dinner")).toBe(true);
});

// ---------- S8 and S9 tasks ----------

const step = (id: string, title: string, done = false): Record<string, Value> => ({ id, title, notes: "", dueDate: null, done });

async function openTasks(page: Page, path = "/schedule/tasks") {
  await openAt(page, path);
  await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
}

const task = (page: Page, id: string) => page.locator(`[data-task-id="${id}"]`);
const toasts = (page: Page) => page.getByRole("status");
const subtasks = async (id: string) => ((await storedDoc("todos", id))?.subtasks ?? []) as { title: string; done: boolean }[];

test("S8 tasks with steps: add a task, add and tick its steps, and watch the progress", async ({ page }) => {
  await resetData();
  await openTasks(page);
  await page.getByRole("button", { name: "Add a task" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add a task" });
  await sheet.getByLabel("What needs doing").fill("Choose the rings");
  await sheet.getByLabel("Due date", { exact: true }).fill(inDays(10));
  await sheet.getByRole("button", { name: "Add task" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(toasts(page).getByText("Added Choose the rings")).toBeVisible();
  await expect.poll(async () => (await stored("todos")).length).toBe(1);
  const [added] = await stored("todos");
  expect(added).toMatchObject({ title: "Choose the rings", dueDate: inDays(10), done: false });

  // The new task opens; its steps are added one by one and saved on their own.
  const rings = task(page, String(added.id));
  await expect(rings).toHaveAttribute("open", "");
  await rings.getByRole("button", { name: "Add a step" }).click();
  await rings.getByLabel("Step", { exact: true }).first().fill("Visit the jeweller");
  await rings.getByLabel("Step", { exact: true }).first().press("Enter");
  await rings.getByRole("button", { name: "Add a step" }).click();
  await rings.getByLabel("Step", { exact: true }).nth(1).fill("Pick the metal");
  await rings.getByLabel("Step", { exact: true }).nth(1).press("Enter");
  await expect.poll(async () => (await subtasks(String(added.id))).map((s) => s.title)).toEqual(["Visit the jeweller", "Pick the metal"]);

  await rings.getByRole("checkbox", { name: "Step done: Pick the metal" }).click();
  await expect.poll(async () => (await subtasks(String(added.id))).map((s) => s.done)).toEqual([false, true]);
  await expect(rings).toContainText("1 of 2 steps done");
  await expect(rings.getByRole("img", { name: "50% of steps done" })).toBeVisible();

  // A step goes with its own Undo.
  await rings.getByRole("button", { name: "Remove step" }).first().click();
  await expect(toasts(page).getByText("Removed a step")).toBeVisible();
  await expect.poll(async () => (await subtasks(String(added.id))).length).toBe(1);
  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await subtasks(String(added.id))).length).toBe(2);
});

test("S9 order, finished, delete: due order with undated last, Finish and Reopen, and Delete with Undo", async ({ page }) => {
  await resetData();
  const base = { notes: "", done: false, subtasks: [] as Value[], createdAt: CREATED };
  await put("todos", "t-later", { ...base, title: "Plan the honeymoon", dueDate: inDays(20) });
  await put("todos", "t-none", { ...base, title: "Write the vows", dueDate: null });
  await put("todos", "t-soon", { ...base, title: "Book the dress fitting", dueDate: inDays(-2), subtasks: [step("s1", "Call the atelier")] });
  await put("todos", "t-done", { ...base, title: "Send the invitations", dueDate: inDays(-9), done: true, doneOn: inDays(-5) });
  await openTasks(page);

  // Open tasks by due date (late first), undated last; finished ones wait in a disclosure.
  await expect(page.getByText("3 open, 1 done")).toBeVisible();
  expect(await page.locator("[data-task-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-task-id")))).toEqual(["t-soon", "t-later", "t-none", "t-done"]);
  await expect(task(page, "t-soon")).toContainText("2 days late");
  await expect(task(page, "t-none")).toContainText("No date");
  await page.getByText(/^Show 1 finished task$/).click();
  await expect(page.getByRole("checkbox", { name: "Reopen Send the invitations" })).toBeVisible();

  // Finishing records today and can be undone; reopening clears it.
  await page.getByRole("checkbox", { name: "Finish Plan the honeymoon" }).click();
  await expect(toasts(page).getByText("Finished Plan the honeymoon")).toBeVisible();
  await expect.poll(async () => (await storedDoc("todos", "t-later"))?.doneOn).toBe(inDays(0));
  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await storedDoc("todos", "t-later"))?.done).toBe(false);
  await page.getByRole("checkbox", { name: "Reopen Send the invitations" }).click();
  await expect.poll(async () => (await storedDoc("todos", "t-done"))?.done).toBe(false);
  await expect(page.getByText("4 open", { exact: true })).toBeVisible();

  // Deleting asks first, names the steps it takes along, and Undo brings the task back.
  await page.goto("/schedule/tasks?open=t-soon");
  await expect(task(page, "t-soon")).toHaveAttribute("open", "", { timeout: COMPILE_TIMEOUT });
  await task(page, "t-soon").getByRole("button", { name: "Delete task" }).click();
  const confirm = page.getByRole("dialog").filter({ hasText: "Delete Book the dress fitting?" });
  await expect(confirm.getByText("Its 1 step goes with it. You can undo for a few seconds.")).toBeVisible();
  await confirm.getByRole("button", { name: "Keep it" }).click();
  expect(await storedDoc("todos", "t-soon")).toBeTruthy();
  await task(page, "t-soon").getByRole("button", { name: "Delete task" }).click();
  await page.getByRole("dialog").filter({ hasText: "Delete Book the dress fitting?" }).getByRole("button", { name: "Delete task" }).click();
  await expect(toasts(page).getByText("Deleted Book the dress fitting")).toBeVisible();
  await expect.poll(async () => await storedDoc("todos", "t-soon")).toBeNull();
  await toasts(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await storedDoc("todos", "t-soon"))?.title).toBe("Book the dress fitting");
  expect(await subtasks("t-soon")).toHaveLength(1);
});
