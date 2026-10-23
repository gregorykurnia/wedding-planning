import { expect, test, type Browser, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";

test.afterEach(closeOtherContexts);

// Task 4.20: the Schedule at /schedule and its event sheet, against the
// emulators (guide §5.19, §6.12). Everything is written as the emulator's owner
// (which skips the rules), with dates counted from today, so the figure, the
// groups and the reminder choices are the same whenever this runs.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Value = string | number | boolean | number[] | Date | null;
type Fields = Record<string, Value>;

const typed = (value: Value): Record<string, unknown> =>
  value === null
    ? { nullValue: null }
    : Array.isArray(value)
      ? { arrayValue: { values: value.map((v) => ({ integerValue: String(v) })) } }
      : value instanceof Date
        ? { timestampValue: value.toISOString() }
        : typeof value === "boolean"
          ? { booleanValue: value }
          : typeof value === "number"
            ? { integerValue: String(value) }
            : { stringValue: value };

const CREATED = new Date("2026-01-01T00:00:00Z");

async function put(collection: string, id: string, fields: Fields) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typed(v)])) };
  const res = await fetch(`${DOCS}/${collection}/${id}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

/** Changes only the given fields of a stored document. */
async function patch(collection: string, id: string, fields: Fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typed(v)])) };
  const res = await fetch(`${DOCS}/${collection}/${id}?${mask}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

async function del(collection: string, id: string) {
  await fetch(`${DOCS}/${collection}/${id}`, { method: "DELETE", headers: ADMIN });
}

type Doc = Record<string, string | number | boolean | null | (string | number | boolean | null)[]>;

/** A stored document as plain values, or null when it isn't there. */
async function read(collection: string, id: string): Promise<Doc | null> {
  const res = await fetch(`${DOCS}/${collection}/${id}`, { headers: ADMIN });
  if (res.status === 404) return null;
  const { fields } = (await res.json()) as { fields: Record<string, Record<string, unknown>> };
  const plain = (v: Record<string, unknown>): Doc[string] =>
    "stringValue" in v
      ? (v.stringValue as string)
      : "integerValue" in v
        ? Number(v.integerValue)
        : "booleanValue" in v
          ? (v.booleanValue as boolean)
          : "arrayValue" in v
            ? (((v.arrayValue as { values?: Record<string, unknown>[] }).values ?? []).map((x) => plain(x)) as never)
            : null;
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, plain(v)]));
}

/** Events written by the page itself: found by title, since their ids are made in the browser. */
async function findByTitle(title: string): Promise<(Doc & { id: string }) | null> {
  const res = await fetch(`${DOCS}:runQuery`, {
    method: "POST",
    headers: ADMIN,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "scheduleEvents" }],
        where: { fieldFilter: { field: { fieldPath: "title" }, op: "EQUAL", value: { stringValue: title } } },
      },
    }),
  });
  const rows = (await res.json()) as { document?: { name: string } }[];
  const name = rows.find((r) => r.document)?.document?.name;
  if (!name) return null;
  const id = name.split("/").pop() as string;
  const doc = await read("scheduleEvents", id);
  return doc ? { id, ...doc } : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

const IDS = {
  scheduleEvents: ["sc-late", "sc-call", "sc-tasting", "sc-fitting", "sc-sync", "sc-month-dress", "sc-month-florist", "sc-month-cake", "sc-month-menu", "sc-month-live"],
  todos: ["sc-task"],
  vendors: ["sc-vendor"],
};

test.beforeEach(async () => {
  await put("settings", "wedding", {
    yourName: "Greg",
    partnerName: "Bella",
    partnerEmail: TEST_ACCOUNTS[1].email,
  });
  // Late, an all-day deadline set with a reminder for a time of day (which can't arrive, but it's late, so the row stays quiet).
  await put("scheduleEvents", "sc-late", {
    title: "Organiser check-in",
    type: "organiser_call",
    startAt: inDays(-3),
    endAt: null,
    allDay: true,
    status: "scheduled",
    notes: "",
    location: "",
    relatedVendorId: null,
    relatedVenueId: null,
    reminderMinutes: [0],
  });
  // Today, a call with a link and a vendor, a reminder for "1 hour before" that can't arrive.
  await put("scheduleEvents", "sc-call", {
    title: "Call with Laras about the arch",
    type: "vendor_call",
    startAt: `${inDays(0)}T15:00`,
    endAt: `${inDays(0)}T15:30`,
    allDay: false,
    status: "scheduled",
    notes: "",
    location: "https://meet.google.com/kbn-arch-call",
    relatedVendorId: "sc-vendor",
    relatedVenueId: null,
    reminderMinutes: [60],
  });
  await put("scheduleEvents", "sc-tasting", {
    title: "Tasting at Sendok Emas",
    type: "appointment",
    startAt: `${inDays(1)}T10:00`,
    endAt: `${inDays(1)}T11:00`,
    allDay: false,
    status: "scheduled",
    notes: "Bring the guest list",
    location: "Jl. Sunset 12",
    relatedVendorId: null,
    relatedVenueId: null,
    reminderMinutes: [1440],
  });
  await put("scheduleEvents", "sc-fitting", {
    title: "Gown fitting",
    type: "appointment",
    startAt: `${inDays(2)}T13:00`,
    endAt: null,
    allDay: false,
    status: "completed",
    notes: "",
    location: "",
    relatedVendorId: null,
    relatedVenueId: null,
    reminderMinutes: [],
  });
  // Ten days out, set for "1 hour before": it can still be chosen again.
  await put("scheduleEvents", "sc-sync", {
    title: "Organiser sync",
    type: "organiser_call",
    startAt: `${inDays(10)}T09:00`,
    endAt: null,
    allDay: false,
    status: "scheduled",
    notes: "",
    location: "",
    relatedVendorId: null,
    relatedVenueId: null,
    reminderMinutes: [60],
  });
  await put("todos", "sc-task", { title: "Choose the rings", notes: "", dueDate: inDays(3), done: false, createdAt: CREATED });
  await put("vendors", "sc-vendor", {
    name: "Dapur Lestari Catering",
    category: "Catering",
    contractStatus: "Chosen",
    funder: null,
    totalPrice: 30_000_000,
    budgetSpent: 10_000_000,
    nextTargetDate: inDays(5),
  });
});

test.afterEach(async () => {
  for (const [collection, ids] of Object.entries(IDS)) for (const id of ids) await del(collection, id);
  // Events the tests added from the page.
  for (const title of ["Makeup trial with Kirana", "Dress shop", "Added by Bella", "Lunch with Ibu Ratna"]) {
    const found = await findByTitle(title);
    if (found) await del("scheduleEvents", found.id);
  }
  await put("settings", "wedding", { yourName: "", partnerName: "", weddingDate: null, startedOn: null });
});

async function openSchedule(browser: Browser, account: (typeof TEST_ACCOUNTS)[number] = TEST_ACCOUNTS[0], viewport?: { width: number; height: number }, path = "/schedule") {
  const context = await browser.newContext(viewport ? { viewport } : {});
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Schedule", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page;
}

const row = (page: Page, title: string) => page.locator("li[data-agenda-key]").filter({ hasText: title });
const sheet = (page: Page) => page.getByRole("dialog");

/** Opens an event's sheet from its row. */
async function openEvent(page: Page, title: string) {
  await row(page, title).getByRole("button", { name: title }).click();
  await expect(sheet(page).getByRole("heading", { name: title, level: 2 })).toBeVisible();
}

test("leads with what is late or due today, then the groups, in one line of time", async ({ browser }) => {
  const page = await openSchedule(browser);

  // 1 late and 1 today make 2; then what is tomorrow and in the next 14 days.
  await expect(page.getByText("Late or due today", { exact: true })).toBeVisible();
  await expect(page.getByText("2", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("1 late and 1 today, then 1 tomorrow. 3 more things in the next 14 days.")).toBeVisible();
  await expect(page.getByText("Appointments, calls, payments and tasks, in one line of time")).toBeVisible();

  // Late first, then the days: today, tomorrow, and later ones.
  const heads = page.locator("main h2");
  await expect(heads.nth(0)).toContainText("Late");
  await expect(heads.nth(0)).toContainText("1 thing");
  await expect(heads.nth(1)).toContainText("Today,");
  await expect(heads.nth(1)).toContainText("Today");
  await expect(heads.nth(2)).toContainText("Tomorrow,");

  // A late event shows its date and how late; the completed one isn't shown yet.
  await expect(row(page, "Organiser check-in")).toContainText("3 days late");
  await expect(row(page, "Gown fitting")).toHaveCount(0);

  // A call: the time column, the kind, a call link and the vendor it's about.
  const call = row(page, "Call with Laras about the arch");
  await expect(call).toContainText("15:00");
  await expect(call).toContainText("15:30");
  await expect(call).toContainText("Vendor call");
  await expect(call.getByRole("link", { name: "Join the call" })).toHaveAttribute("href", "https://meet.google.com/kbn-arch-call");
  await expect(call.getByRole("link", { name: "Dapur Lestari Catering" })).toHaveAttribute("href", "/vendors/sc-vendor");

  // A payment and a task link to where they live; only the payment has Record payment.
  const payment = row(page, "Dapur Lestari Catering").filter({ hasText: "Payment" });
  await expect(payment.getByRole("link", { name: "Dapur Lestari Catering" }).first()).toHaveAttribute("href", /\/budget\/bookings\//);
  await expect(payment).toContainText("Rp 20.000.000, no funder yet");
  await expect(payment.getByRole("button", { name: "Record payment" })).toBeVisible();
  const task = row(page, "Choose the rings");
  await expect(task.getByRole("link", { name: "Choose the rings" })).toHaveAttribute("href", "/schedule/tasks?open=sc-task");
  await expect(task.getByRole("button", { name: "Record payment" })).toHaveCount(0);
});

test("Record payment on a payment opens the sheet for that booking", async ({ browser }) => {
  const page = await openSchedule(browser);
  await row(page, "Dapur Lestari Catering").filter({ hasText: "Payment" }).getByRole("button", { name: "Record payment" }).click();
  await expect(sheet(page).getByRole("heading", { name: "Record a payment" })).toBeVisible();
  await expect(sheet(page).getByText(/Dapur Lestari Catering/)).toBeVisible();
});

test("kind chips, search and completed things narrow the agenda, with a way back", async ({ browser }) => {
  const page = await openSchedule(browser);

  const chips = page.getByRole("group", { name: "Show" });
  await expect(chips.getByRole("button", { name: "Everything" })).toHaveAttribute("aria-pressed", "true");
  await chips.getByRole("button", { name: "Payments" }).click();
  await expect(page.locator("li[data-agenda-key]")).toHaveCount(1);
  await chips.getByRole("button", { name: "Tasks" }).click();
  await expect(row(page, "Choose the rings")).toBeVisible();
  await chips.getByRole("button", { name: "Calls" }).click();
  await expect(page.locator("li[data-agenda-key]")).toHaveCount(3); // the two organiser calls and the vendor call
  await chips.getByRole("button", { name: "Everything" }).click();

  // Search looks at titles, places and notes.
  const search = page.getByRole("searchbox", { name: "Search the schedule" });
  await search.fill("sunset");
  await expect(page.locator("li[data-agenda-key]")).toHaveCount(1);
  await expect(row(page, "Tasting at Sendok Emas")).toBeVisible();
  await expect(search).toBeFocused();
  await search.fill("guest list");
  await expect(row(page, "Tasting at Sendok Emas")).toBeVisible();

  await search.fill("zither");
  await expect(page.getByRole("heading", { name: "Nothing matches “zither”" })).toBeVisible();
  await expect(page.getByText("Search looks through titles, places and notes of everything with a date.")).toBeVisible();
  await page.getByRole("button", { name: "Show everything" }).click();
  await expect(search).toHaveValue("");
  await expect(page.locator("li[data-agenda-key]").first()).toBeVisible();

  // Completed and cancelled things come back on request, struck through.
  await page.getByLabel("Show completed and cancelled").check();
  await expect(row(page, "Gown fitting")).toContainText("Appointment, completed");
});

test("a reminder set for a time of day is named in a box above the agenda and on its row", async ({ browser }) => {
  const page = await openSchedule(browser);

  const box = page.getByRole("status").filter({ hasText: "you set before can’t arrive" });
  await expect(box).toContainText("2 reminders you set before can’t arrive, because reminders now come only in the morning:");
  await expect(box).toContainText("Choose again for each.");
  await expect(box.getByRole("button", { name: "Call with Laras about the arch" })).toBeVisible();
  await expect(box.getByRole("button", { name: "Organiser sync" })).toBeVisible();

  // Its own row says so; a late event's doesn't.
  await expect(row(page, "Organiser sync")).toContainText("Its reminder can’t arrive. Choose another");
  await expect(row(page, "Organiser check-in")).not.toContainText("Its reminder can’t arrive");

  // The name opens its sheet, where Remind us says what was chosen and what can still arrive.
  await box.getByRole("button", { name: "Organiser sync" }).click();
  const dialog = sheet(page);
  await expect(dialog.getByLabel("Remind us")).toHaveValue("old");
  await expect(dialog.getByRole("option", { name: "Choose again" })).toBeDisabled();
  await expect(dialog.getByText("You chose “1 hour before” when you set this up. That can’t arrive: reminders come once a day, in the morning. Choose the morning before, a week before or no reminder.")).toBeVisible();

  await dialog.getByLabel("Remind us").selectOption("7d");
  await expect(dialog.getByText("Saved", { exact: true })).toBeVisible();
  await expect.poll(async () => (await read("scheduleEvents", "sc-sync"))?.reminderMinutes).toEqual([10080]);
  await expect(dialog.getByText("Reminders come once a day, in the morning.")).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();

  // Nothing is left but the other one.
  await expect(box).toContainText("1 reminder you set before can’t arrive");
  await expect(row(page, "Organiser sync")).not.toContainText("Its reminder can’t arrive");
});

test("the event sheet shows the event and saves each change as you go", async ({ browser }) => {
  const page = await openSchedule(browser);
  await openEvent(page, "Tasting at Sendok Emas");
  const dialog = sheet(page);

  await expect(dialog.getByText(/^Tomorrow|^\w+day \d+ \w+/).first()).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "Appointment" })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByLabel("Title")).toHaveValue("Tasting at Sendok Emas");
  await expect(dialog.getByLabel("Date")).toHaveValue(inDays(1));
  await expect(dialog.getByLabel("Starts")).toHaveValue("10:00");
  await expect(dialog.getByLabel("Ends, optional")).toHaveValue("11:00");
  await expect(dialog.getByLabel("Where, or a call link")).toHaveValue("Jl. Sunset 12");
  await expect(dialog.getByLabel("Notes")).toHaveValue("Bring the guest list");
  await expect(dialog.getByLabel("Remind us")).toHaveValue("1d");
  await expect(dialog.getByText("Every change saves as you go")).toBeVisible();

  // Text saves on leaving the field, a kind on a pick.
  await dialog.getByLabel("Title").fill("Tasting at Sendok Emas, Sanur");
  await dialog.getByLabel("Where, or a call link").click();
  await expect(dialog.getByText("Saved", { exact: true })).toBeVisible();
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.title).toBe("Tasting at Sendok Emas, Sanur");
  await dialog.getByRole("radio", { name: "Key date" }).click();
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.type).toBe("key_date");

  // A new time keeps the date and the end.
  await dialog.getByLabel("Starts").fill("09:30");
  await dialog.getByLabel("Notes").click();
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.startAt).toBe(`${inDays(1)}T09:30`);
  expect((await read("scheduleEvents", "sc-tasting"))?.endAt).toBe(`${inDays(1)}T11:00`);

  // A new date keeps the times; All day drops them.
  await dialog.getByLabel("Date").fill(inDays(4));
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.startAt).toBe(`${inDays(4)}T09:30`);
  await dialog.getByLabel("All day").check();
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.startAt).toBe(inDays(4));
  expect((await read("scheduleEvents", "sc-tasting"))?.allDay).toBe(true);
  expect((await read("scheduleEvents", "sc-tasting"))?.endAt).toBeNull();
  await expect(dialog.getByLabel("Starts")).toHaveCount(0);

  // A morning that has gone is greyed, with the reason, once the date is near.
  await dialog.getByLabel("Date").fill(inDays(1));
  await expect(dialog.getByRole("option", { name: "The morning before (that morning has gone)" })).toBeDisabled();

  // The reminder is a pick, and a change clears what was already sent.
  await dialog.getByLabel("Date").fill(inDays(12));
  await dialog.getByLabel("Remind us").selectOption("");
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.reminderMinutes).toEqual([]);

  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row(page, "Tasting at Sendok Emas, Sanur")).toContainText("Key date");
});

test("a change that would leave the event without a title is held, and Done goes to the field (N9)", async ({ browser }) => {
  const page = await openSchedule(browser);
  await openEvent(page, "Tasting at Sendok Emas");
  const dialog = sheet(page);

  await dialog.getByLabel("Title").fill("");
  await dialog.getByLabel("Notes").click();
  await expect(dialog.getByRole("alert").filter({ hasText: "It needs a title." })).toHaveText(
    "It needs a title. The schedule keeps “Tasting at Sendok Emas” until you give it one.",
  );
  await expect(dialog.getByLabel("Title")).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByText("1 change not saved yet: the title")).toBeVisible();
  expect((await read("scheduleEvents", "sc-tasting"))?.title).toBe("Tasting at Sendok Emas");

  // The other fields keep saving.
  await dialog.getByLabel("Notes").fill("Bring the budget");
  await dialog.getByLabel("Where, or a call link").click();
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.notes).toBe("Bring the budget");
  await expect(dialog.getByText("1 change not saved yet: the title")).toBeVisible();

  // Done doesn't close: it moves to the field.
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Title")).toBeFocused();

  // Fixing it saves it and the line goes.
  await dialog.getByLabel("Title").fill("Tasting at Sendok Emas, Sanur");
  await dialog.getByLabel("Notes").click();
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.title).toBe("Tasting at Sendok Emas, Sanur");
  await expect(dialog.getByText("1 change not saved yet: the title")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toHaveCount(0);
});

test("an end before the start is held, and the date can't be left empty (N9)", async ({ browser }) => {
  const page = await openSchedule(browser);
  await openEvent(page, "Tasting at Sendok Emas");
  const dialog = sheet(page);

  // The start moves past the saved end: the start saves, the end can't, and what was typed stays.
  await dialog.getByLabel("Starts").fill("12:00");
  await dialog.getByLabel("Notes").click();
  await expect(dialog.getByRole("alert").filter({ hasText: "It ends before it starts." })).toHaveText(
    "It ends before it starts. Change the end time, or leave it empty.",
  );
  await expect(dialog.getByLabel("Ends, optional")).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByLabel("Starts")).not.toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByText("1 change not saved yet: the end time")).toBeVisible();
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.startAt).toBe(`${inDays(1)}T12:00`);
  // A stored event never ends before it starts.
  expect((await read("scheduleEvents", "sc-tasting"))?.endAt).toBeNull();
  await expect(dialog.getByLabel("Ends, optional")).toHaveValue("11:00");

  // Moving the start back makes the typed end good again, and it saves.
  await dialog.getByLabel("Starts").fill("10:30");
  await dialog.getByLabel("Notes").click();
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.endAt).toBe(`${inDays(1)}T11:00`);
  await expect(dialog.getByText(/not saved yet/)).toHaveCount(0);

  // A date that is cleared isn't saved either.
  await dialog.getByLabel("Date").fill("");
  await dialog.getByLabel("Notes").click();
  await expect(dialog.getByRole("alert").filter({ hasText: "It needs a date." })).toContainText("The schedule keeps it on");
  await expect(dialog.getByText("1 change not saved yet: the date")).toBeVisible();
  expect((await read("scheduleEvents", "sc-tasting"))?.startAt).toBe(`${inDays(1)}T10:30`);
});

test("Mark completed, Cancel it and Back to scheduled act at once, close the sheet and can be undone", async ({ browser }) => {
  const page = await openSchedule(browser);

  await openEvent(page, "Tasting at Sendok Emas");
  await sheet(page).getByRole("button", { name: "Mark completed" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("status").getByText("Marked completed")).toBeVisible();
  expect((await read("scheduleEvents", "sc-tasting"))?.status).toBe("completed");
  await expect(row(page, "Tasting at Sendok Emas")).toHaveCount(0);

  // Undo puts it back.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.status).toBe("scheduled");
  await expect(row(page, "Tasting at Sendok Emas")).toBeVisible();

  // Cancel it, then find it again among the cancelled and bring it back.
  await openEvent(page, "Tasting at Sendok Emas");
  await sheet(page).getByRole("button", { name: "Cancel it" }).click();
  await expect(page.getByRole("status").getByText("Cancelled", { exact: true })).toBeVisible();
  expect((await read("scheduleEvents", "sc-tasting"))?.status).toBe("cancelled");
  await page.getByLabel("Show completed and cancelled").check();
  await expect(row(page, "Tasting at Sendok Emas")).toContainText("Appointment, cancelled");
  await openEvent(page, "Tasting at Sendok Emas");
  await expect(sheet(page).getByText("Cancelled", { exact: true }).first()).toBeVisible();
  await sheet(page).getByRole("button", { name: "Back to scheduled" }).click();
  await expect(page.getByRole("status").getByText("Back to scheduled")).toBeVisible();
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.status).toBe("scheduled");
});

test("a status button doesn't close the sheet over a change that didn't save (P4-S18, N18)", async ({ browser }) => {
  const page = await openSchedule(browser);
  await openEvent(page, "Tasting at Sendok Emas");
  const dialog = sheet(page);

  await page.context().setOffline(true);
  await dialog.getByLabel("Where, or a call link").fill("Jl. Danau Tamblingan 5");
  await dialog.getByLabel("Notes").click();
  await expect(dialog.getByRole("button", { name: "Try again" }).first()).toBeVisible({ timeout: 30_000 });
  await page.context().setOffline(false);

  // The status saves, but the sheet stays open and says the change isn't saved, with what was typed kept.
  await dialog.getByRole("button", { name: "Mark completed" }).click();
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.status, { timeout: 30_000 }).toBe("completed");
  await expect(dialog.getByText("Your last change isn’t saved yet.")).toBeVisible();
  await expect(dialog.getByLabel("Where, or a call link")).toHaveValue("Jl. Danau Tamblingan 5");
});

test("a new time on the same day keeps the sent reminder; a new day clears it (P4-S17)", async ({ browser }) => {
  await patch("scheduleEvents", "sc-tasting", { remindersSent: [1440] });
  const page = await openSchedule(browser);
  await openEvent(page, "Tasting at Sendok Emas");
  const dialog = sheet(page);

  await dialog.getByLabel("Ends, optional").fill("12:00");
  await dialog.getByLabel("Notes").click();
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.endAt).toBe(`${inDays(1)}T12:00`);
  expect((await read("scheduleEvents", "sc-tasting"))?.remindersSent).toEqual([1440]);

  await dialog.getByLabel("Date").fill(inDays(5));
  await expect.poll(async () => (await read("scheduleEvents", "sc-tasting"))?.startAt).toBe(`${inDays(5)}T10:00`);
  expect((await read("scheduleEvents", "sc-tasting"))?.remindersSent).toEqual([]);
});

test("Delete asks first, then removes the event with an undo that brings it back exactly", async ({ browser }) => {
  const page = await openSchedule(browser);
  const before = await read("scheduleEvents", "sc-tasting");
  await openEvent(page, "Tasting at Sendok Emas");
  await sheet(page).getByRole("button", { name: "Delete" }).click();

  const confirm = page.getByRole("dialog").filter({ hasText: "Delete Tasting at Sendok Emas?" });
  await expect(confirm.getByText("It comes off the schedule for both of you. You can undo for a few seconds.")).toBeVisible();
  await confirm.getByRole("button", { name: "Keep it" }).click();
  expect(await read("scheduleEvents", "sc-tasting")).not.toBeNull();

  await sheet(page).getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").filter({ hasText: "Delete Tasting at Sendok Emas?" }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("status").getByText("Deleted Tasting at Sendok Emas")).toBeVisible();
  await expect(row(page, "Tasting at Sendok Emas")).toHaveCount(0);
  expect(await read("scheduleEvents", "sc-tasting")).toBeNull();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => read("scheduleEvents", "sc-tasting")).not.toBeNull();
  const after = await read("scheduleEvents", "sc-tasting");
  for (const key of ["title", "type", "startAt", "endAt", "notes", "location", "reminderMinutes", "status"]) {
    expect(after?.[key]).toEqual(before?.[key]);
  }
  await expect(row(page, "Tasting at Sendok Emas")).toBeVisible();
});

test("Add to the schedule asks for what is missing, keeps what was typed, then adds with an undo", async ({ browser }) => {
  const page = await openSchedule(browser);
  await page.getByRole("button", { name: "Add to the schedule" }).click();
  const dialog = sheet(page);
  await expect(dialog.getByRole("heading", { name: "Add to the schedule", level: 2 })).toBeVisible();
  await expect(dialog.getByLabel("Title")).toBeFocused();
  await expect(dialog.getByPlaceholder("For example, Tasting at Sendok Emas")).toBeVisible();
  // It starts today at 10:00, an appointment, with the morning before... which has gone for today.
  await expect(dialog.getByRole("radio", { name: "Appointment" })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByLabel("Date")).toHaveValue(inDays(0));
  await expect(dialog.getByLabel("Starts")).toHaveValue("10:00");
  await expect(dialog.getByLabel("Remind us")).toHaveValue("");

  // Nothing typed and no day: each field says what to do, and focus goes to the first.
  await dialog.getByLabel("Starts").fill("16:00");
  await dialog.getByLabel("Date").fill("");
  await dialog.getByRole("button", { name: "Add to the schedule" }).click();
  await expect(dialog.getByText("Give it a title so you can find it in the schedule.")).toBeVisible();
  await expect(dialog.getByText("Choose the day it happens.")).toBeVisible();
  await expect(dialog.getByLabel("Title")).toBeFocused();
  await expect(dialog.getByLabel("Title")).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByLabel("Date")).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByLabel("Starts")).toHaveValue("16:00");
  expect(await findByTitle("Makeup trial with Kirana")).toBeNull();

  // An end before the start says so too.
  await dialog.getByLabel("Ends, optional").fill("15:00");
  await expect(dialog.getByText("It ends before it starts. Change the end time, or leave it empty.")).toBeVisible();
  await dialog.getByLabel("Ends, optional").fill("17:00");
  await expect(dialog.getByText("It ends before it starts.")).toHaveCount(0);

  // Typing and choosing clears each line; the morning before is the default for a day far enough ahead.
  await dialog.getByLabel("Title").fill("Makeup trial with Kirana");
  await expect(dialog.getByText("Give it a title")).toHaveCount(0);
  await dialog.getByLabel("Date").fill(inDays(9));
  await expect(dialog.getByText("Choose the day it happens.")).toHaveCount(0);
  await expect(dialog.getByLabel("Remind us")).toHaveValue("");
  await dialog.getByLabel("Remind us").selectOption("1d");
  await dialog.getByLabel("Where, or a call link").fill("Kirana Makeup, Sanur");
  await dialog.getByLabel("With").selectOption("vendor:sc-vendor");
  await dialog.getByRole("radio", { name: "Vendor call" }).click();
  await dialog.getByRole("button", { name: "Add to the schedule" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status").getByText("Added Makeup trial with Kirana")).toBeVisible();
  const added = row(page, "Makeup trial with Kirana");
  await expect(added).toContainText("16:00");
  await expect(added).toContainText("Kirana Makeup, Sanur");
  await expect(added).toContainText("Vendor call");
  await expect(added.getByRole("link", { name: "Dapur Lestari Catering" })).toBeVisible();

  const doc = await findByTitle("Makeup trial with Kirana");
  expect(doc).toMatchObject({
    type: "vendor_call",
    startAt: `${inDays(9)}T16:00`,
    endAt: `${inDays(9)}T17:00`,
    allDay: false,
    status: "scheduled",
    location: "Kirana Makeup, Sanur",
    relatedVendorId: "sc-vendor",
    relatedVenueId: null,
    reminderMinutes: [1440],
  });

  // Undo takes it off again.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => findByTitle("Makeup trial with Kirana")).toBeNull();
  await expect(row(page, "Makeup trial with Kirana")).toHaveCount(0);
});

test("Cancel closes the add sheet without adding anything", async ({ browser }) => {
  const page = await openSchedule(browser);
  await page.getByRole("button", { name: "Add to the schedule" }).click();
  await sheet(page).getByLabel("Title").fill("Dress shop");
  await sheet(page).getByRole("button", { name: "Cancel" }).click();
  await expect(sheet(page)).toHaveCount(0);
  expect(await findByTitle("Dress shop")).toBeNull();
});

test("an address with ?event= opens that event, and ?new=1 the add sheet, and the address is cleared", async ({ browser }) => {
  const page = await openSchedule(browser, TEST_ACCOUNTS[0], undefined, "/schedule?event=sc-tasting");
  await expect(sheet(page).getByRole("heading", { name: "Tasting at Sendok Emas", level: 2 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page).toHaveURL(/\/schedule$/);
  await sheet(page).getByRole("button", { name: "Done" }).click();

  await page.goto(`/schedule?new=1&date=${inDays(6)}`);
  await expect(sheet(page).getByRole("heading", { name: "Add to the schedule", level: 2 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(sheet(page).getByLabel("Date")).toHaveValue(inDays(6));
  await expect(page).toHaveURL(/\/schedule$/);
});

test("Bella adds an appointment: Greg sees a toast, and the row flashes", async ({ browser }) => {
  const greg = await openSchedule(browser, TEST_ACCOUNTS[0]);
  const bella = await openSchedule(browser, TEST_ACCOUNTS[1]);

  await bella.getByRole("button", { name: "Add to the schedule" }).click();
  await sheet(bella).getByLabel("Title").fill("Added by Bella");
  await sheet(bella).getByLabel("Date").fill(inDays(1));
  await sheet(bella).getByLabel("Starts").fill("10:00");
  await sheet(bella).getByRole("button", { name: "Add to the schedule" }).click();

  await expect(greg.getByRole("status").getByText("Bella added “Added by Bella” tomorrow at 10:00")).toBeVisible({ timeout: 15_000 });
  await expect(row(greg, "Added by Bella")).toBeVisible();
  await expect(row(bella, "Added by Bella")).toBeVisible();
  // Her own add isn't news to her.
  await expect(bella.getByRole("status").getByText(/Bella added/)).toHaveCount(0);
});

test("a change from Bella arrives in an open event sheet", async ({ browser }) => {
  const greg = await openSchedule(browser, TEST_ACCOUNTS[0]);
  await openEvent(greg, "Tasting at Sendok Emas");
  await expect(sheet(greg).getByLabel("Where, or a call link")).toHaveValue("Jl. Sunset 12");

  await put("scheduleEvents", "sc-tasting", {
    title: "Tasting at Sendok Emas",
    type: "appointment",
    startAt: `${inDays(1)}T10:00`,
    endAt: `${inDays(1)}T11:00`,
    allDay: false,
    status: "scheduled",
    notes: "Bring the guest list",
    location: "Jl. Raya Sanur 5",
    relatedVendorId: null,
    relatedVenueId: null,
    reminderMinutes: [1440],
  });
  await expect(sheet(greg).getByLabel("Where, or a call link")).toHaveValue("Jl. Raya Sanur 5");
});

test("a phone shows the agenda in one column with no sideways scroll", async ({ browser }) => {
  const page = await openSchedule(browser, TEST_ACCOUNTS[0], { width: 390, height: 844 });
  await expect(row(page, "Organiser check-in")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // The flag and the button move under the text.
  const payment = row(page, "Dapur Lestari Catering").filter({ hasText: "Payment" });
  const text = await payment.getByRole("link", { name: "Dapur Lestari Catering" }).first().boundingBox();
  const button = await payment.getByRole("button", { name: "Record payment" }).boundingBox();
  expect(button && text && button.y > text.y).toBe(true);

  await page.getByRole("button", { name: "Add to the schedule" }).click();
  const dialog = sheet(page);
  const box = await dialog.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(390);
});

test.describe("a long agenda", () => {
  const MANY = Array.from({ length: 85 }, (_, i) => `sc-many-${i}`);
  test.beforeEach(async () => {
    // Together, so a slow machine doesn't spend the test's time on 85 writes one after another.
    await Promise.all(
      MANY.map((id, i) =>
        put("scheduleEvents", id, {
          title: `Fitting ${String(i).padStart(2, "0")}`,
          type: "appointment",
          startAt: `${inDays(20 + (i % 30))}T09:00`,
          endAt: null,
          allDay: false,
          status: "scheduled",
          notes: "",
          location: "",
          relatedVendorId: null,
          relatedVenueId: null,
          reminderMinutes: [],
        }),
      ),
    );
  });
  test.afterEach(async () => {
    await Promise.all(MANY.map((id) => del("scheduleEvents", id)));
  });

  test("shows 80 things at a time", async ({ browser }) => {
    const page = await openSchedule(browser);
    await expect(page.locator("li[data-agenda-key]")).toHaveCount(80);
    await page.getByRole("button", { name: /^Show \d+ more$/ }).click();
    // Four fixtures and the three others are still on the agenda; 80 more come in a page.
    await expect(page.locator("li[data-agenda-key]").nth(80)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Show \d+ more$/ })).toHaveCount(0);
  });
});

// ---------- the month (Task 4.21) ----------

// The month's own events sit in a fixed March, so their marks don't depend on the day this runs; the
// relative events above fall outside it. Each test shows the month it needs with `?day=`.
const DRESS = "2031-03-10";
const CAKE = "2031-03-11";
const MENU = "2031-03-12";
const EMPTY = "2031-03-14";
const WEDDING = "2031-03-20";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAME = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A day's cell, found by the start of its label: its long date, as the model writes it. */
function dayCell(page: Page, day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const weekday = WEEKDAY[new Date(year, month - 1, date).getDay()];
  return page.getByRole("button", { name: new RegExp(`^${weekday} ${date} ${MONTH_NAME[month - 1]}`) });
}

const fixture = (title: string, type: string, startAt: string, status: string) => ({
  title,
  type,
  startAt,
  endAt: null,
  allDay: false,
  status,
  notes: "",
  location: "",
  relatedVendorId: null,
  relatedVenueId: null,
  reminderMinutes: [],
});

test.describe("the month", () => {
  test.beforeEach(async () => {
    await put("scheduleEvents", "sc-month-dress", fixture("Dress fitting", "appointment", `${DRESS}T10:00`, "scheduled"));
    await put("scheduleEvents", "sc-month-florist", fixture("Florist call", "vendor_call", `${DRESS}T15:00`, "scheduled"));
    await put("scheduleEvents", "sc-month-cake", fixture("Cake tasting", "appointment", `${CAKE}T11:00`, "scheduled"));
    await put("scheduleEvents", "sc-month-menu", fixture("Menu tasting", "appointment", `${MENU}T11:00`, "completed"));
  });

  test("opens on today, chosen, with its marks and its list, and Month marked in the sub-navigation", async ({ browser }) => {
    const page = await openSchedule(browser, TEST_ACCOUNTS[0], undefined, "/schedule/month");
    const nav = page.getByRole("navigation", { name: "Agenda, month and tasks" });
    await expect(nav.getByRole("link", { name: "Month" })).toHaveAttribute("aria-current", "page");
    // Today has the call with Laras and nothing else.
    await expect(dayCell(page, inDays(0))).toHaveAttribute("aria-pressed", "true");
    await expect(dayCell(page, inDays(0))).toHaveAttribute("aria-label", /, today, selected, 1 event$/);
    await expect(page.getByRole("heading", { name: /^Today, / })).toBeVisible();
    // The month's heading is the day's title alone (the prototype has no "Today" on its right).
    await expect(page.getByRole("heading", { name: /^Today, / }).locator("small")).toHaveCount(0);
    await expect(row(page, "Call with Laras about the arch")).toBeVisible();
  });

  test("choosing a day lists it, moves the address to it, and each label says what its marks show", async ({ browser }) => {
    const page = await openSchedule(browser, TEST_ACCOUNTS[0], undefined, `/schedule/month?day=${DRESS}`);
    await expect(dayCell(page, DRESS)).toHaveAttribute("aria-pressed", "true");
    await expect(dayCell(page, DRESS)).toHaveAttribute("aria-label", /, selected, 2 events$/);
    await expect(row(page, "Dress fitting")).toBeVisible();
    await expect(row(page, "Florist call")).toBeVisible();

    await dayCell(page, CAKE).click();
    await expect(dayCell(page, CAKE)).toHaveAttribute("aria-pressed", "true");
    await expect(dayCell(page, DRESS)).toHaveAttribute("aria-pressed", "false");
    await expect(row(page, "Cake tasting")).toBeVisible();
    await expect(row(page, "Dress fitting")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`day=${CAKE}$`));
  });

  test("Earlier and Later move the month and keep the chosen day; Back to today chooses today and clears the address", async ({ browser }) => {
    const page = await openSchedule(browser, TEST_ACCOUNTS[0], undefined, `/schedule/month?day=${DRESS}`);
    // Exact, because a day's heading ("Monday 10 March 2031") contains the month's name too.
    await expect(page.getByRole("heading", { name: "March 2031", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Later:/ }).click();
    await expect(page.getByRole("heading", { name: "April 2031", exact: true })).toBeVisible();
    // The chosen day stays, so its list is still there.
    await expect(row(page, "Dress fitting")).toBeVisible();
    await page.getByRole("button", { name: /^Earlier:/ }).click();
    await expect(page.getByRole("heading", { name: "March 2031", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Back to today" }).click();
    await expect(page.getByRole("heading", { name: new RegExp(`^${MONTH_NAME[new Date().getMonth()]}`) })).toBeVisible();
    await expect(dayCell(page, inDays(0))).toHaveAttribute("aria-pressed", "true");
    await expect(page).not.toHaveURL(/day=/);
  });

  test("kind chips and search narrow the marks, completed things count only when asked for, and Everything brings them back", async ({ browser }) => {
    const page = await openSchedule(browser, TEST_ACCOUNTS[0], undefined, `/schedule/month?day=${DRESS}`);
    await expect(dayCell(page, DRESS)).toHaveAttribute("aria-label", /, 2 events$/);

    const chips = page.getByRole("group", { name: "Show" });
    await chips.getByRole("button", { name: "Calls" }).click();
    await expect(dayCell(page, DRESS)).toHaveAttribute("aria-label", /, 1 event$/);
    await expect(row(page, "Dress fitting")).toHaveCount(0);
    await chips.getByRole("button", { name: "Everything" }).click();
    await expect(dayCell(page, DRESS)).toHaveAttribute("aria-label", /, 2 events$/);

    const search = page.getByRole("searchbox", { name: "Search the schedule" });
    await search.fill("zither");
    await expect(dayCell(page, DRESS)).toHaveAttribute("aria-label", /, nothing$/);
    await search.fill("");

    await dayCell(page, MENU).click();
    await expect(dayCell(page, MENU)).toHaveAttribute("aria-label", /, nothing$/);
    await page.getByLabel("Show completed and cancelled").check();
    await expect(dayCell(page, MENU)).toHaveAttribute("aria-label", /, 1 event$/);
    await expect(row(page, "Menu tasting")).toContainText("Appointment, completed");
  });

  test("an empty day says so, and Add something and the floating button both add to that day", async ({ browser }) => {
    const page = await openSchedule(browser, TEST_ACCOUNTS[0], undefined, `/schedule/month?day=${EMPTY}`);
    await expect(page.getByText("Nothing on this day.")).toBeVisible();

    await page.getByRole("button", { name: "Add something" }).click();
    const dialog = sheet(page);
    await expect(dialog.getByLabel("Date")).toHaveValue(EMPTY);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Add to the schedule" }).click();
    await expect(dialog.getByLabel("Date")).toHaveValue(EMPTY);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("the wedding day is marked and says so in its label", async ({ browser }) => {
    await put("settings", "wedding", {
      yourName: "Greg",
      partnerName: "Bella",
      partnerEmail: TEST_ACCOUNTS[1].email,
      weddingDate: WEDDING,
    });
    const page = await openSchedule(browser, TEST_ACCOUNTS[0], undefined, `/schedule/month?day=${DRESS}`);
    await expect(dayCell(page, WEDDING)).toHaveAttribute("aria-label", /, the wedding day, nothing$/);
  });

  test("an event added elsewhere arrives on the calendar and in the chosen day's list, without a reload", async ({ browser }) => {
    const page = await openSchedule(browser, TEST_ACCOUNTS[0], undefined, `/schedule/month?day=${EMPTY}`);
    await expect(page.getByText("Nothing on this day.")).toBeVisible();
    await put("scheduleEvents", "sc-month-live", fixture("Dress shop", "appointment", `${EMPTY}T11:00`, "scheduled"));
    await expect(row(page, "Dress shop")).toBeVisible();
    await expect(dayCell(page, EMPTY)).toHaveAttribute("aria-label", /, 1 event$/);
    await expect(page.getByText("Nothing on this day.")).toHaveCount(0);
  });

  test("a phone shows the month in one column with no sideways scroll, and each day is a tap target", async ({ browser }) => {
    const page = await openSchedule(browser, TEST_ACCOUNTS[0], { width: 390, height: 844 }, `/schedule/month?day=${DRESS}`);
    await expect(dayCell(page, DRESS)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await dayCell(page, DRESS).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  });
});
