import { expect, test, type Page } from "@playwright/test";
import { loadFixture } from "../../fixtures/load";
import { TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";
import { seed } from "../seed";

// Task 5.5: the Schedule's, its month's and Tasks' states that a dev fault (Task 5.1, `?fault=`), a
// finished task or the browser's notification permission brings about (guide §5.19 to §5.21, N6, N14).
// The app server runs with NEXT_PUBLIC_VEIL_DEV=1 (playwright.config.ts).

async function open(page: Page, path: string) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
}

const agendaRow = (page: Page, title: string) => page.locator("li[data-agenda-key]").filter({ hasText: title });

test.describe("the normal set", () => {
  // The set stays in Firestore, so the emulators are cleaned for the specs after this one.
  test.beforeAll(async () => {
    await loadFixture("normal");
  });
  test.afterAll(seed);

  test("the Schedule, its month and Tasks each say they didn't load under ?fault=load", async ({ page }) => {
    await open(page, "/schedule?fault=load");
    await expect(page.getByText("Your schedule didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await page.goto("/schedule/month?fault=load");
    await expect(page.getByText("Your schedule didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await page.goto("/schedule/tasks?fault=load");
    await expect(page.getByText("Your tasks didn’t load")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  });

  test("an event whose delete doesn't finish keeps its confirm open with Try again, and the event stays", async ({ page }) => {
    const title = "Tasting at Sendok Emas";
    await open(page, "/schedule?fault=save");
    await agendaRow(page, title).getByRole("button", { name: title }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    const confirm = page.getByRole("dialog").filter({ hasText: `Delete ${title}?` });
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(confirm.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 30_000 });
    await confirm.getByRole("button", { name: "Keep it" }).click();
    await expect(agendaRow(page, title)).toHaveCount(1);
  });

  test("a task whose delete doesn't finish keeps its confirm open with Try again, and the task stays", async ({ page }) => {
    await open(page, "/schedule/tasks?fault=save");
    const first = page.locator("[data-task-id]").first();
    await first.locator("summary").click();
    await first.getByRole("button", { name: "Delete task" }).click();
    const confirm = page.getByRole("dialog");
    await confirm.getByRole("button", { name: "Delete task" }).click();
    await expect(confirm.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 30_000 });
    await confirm.getByRole("button", { name: "Keep it" }).click();
    await expect(first).toBeVisible();
  });

  test("the event sheet says notifications aren't allowed yet, and offers to allow them", async ({ page }) => {
    // This browser reports "denied" unless told otherwise; "default" is the permission not allowed yet.
    await page.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "default" }));
    await open(page, "/schedule?new=1");
    const sheet = page.getByRole("dialog", { name: "Add to the schedule" });
    await expect(sheet.getByText(/Not allowed yet on this/)).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await expect(sheet.getByRole("button", { name: "Allow notifications" })).toBeVisible();
  });

  test("the event sheet says notifications are turned off, and where to turn them on", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "denied" }));
    await open(page, "/schedule?new=1");
    await expect(page.getByRole("dialog").getByText(/Turned off for the planner on this/)).toBeVisible({
      timeout: COMPILE_TIMEOUT,
    });
  });
});

test.describe("the empty set", () => {
  test.beforeAll(async () => {
    await loadFixture("empty");
  });
  test.afterAll(seed);

  test("when nothing is left open, the screen says so and the finished task is open below", async ({ page }) => {
    await open(page, "/schedule/tasks");
    await expect(page.getByText("No tasks yet")).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await page.getByRole("button", { name: "Add a task" }).click();
    const sheet = page.getByRole("dialog", { name: "Add a task" });
    await sheet.getByLabel("What needs doing").fill("Order the cake");
    await sheet.getByRole("button", { name: "Add task" }).click();
    await page.getByRole("button", { name: "Add a task" }).click();
    await sheet.getByLabel("What needs doing").fill("Book the band");
    await sheet.getByRole("button", { name: "Add task" }).click();
    await page.getByRole("checkbox", { name: "Finish Order the cake" }).click();
    // One still open: the finished one can be folded away.
    const finished = page.locator("details", { hasText: /finished task/ });
    if ((await finished.getAttribute("open")) !== null) await finished.locator("summary").click();
    await expect(finished).not.toHaveAttribute("open");
    // Ticking the last open one opens them again at once, with no reload (P5-S17).
    await page.getByRole("checkbox", { name: "Finish Book the band" }).click();
    await expect(page.getByText("Everything’s done")).toBeVisible();
    await expect(page.locator("details", { hasText: "Hide 2 finished tasks" })).toHaveAttribute("open", "");

    await page.reload();
    await expect(page.getByText("Everything’s done")).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await expect(page.locator("details", { hasText: "Hide 2 finished tasks" })).toHaveAttribute("open", "");
  });
});
