import { expect, test } from "@playwright/test";
import { TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { inDays, openAt, resetData, restorePairing, stored } from "../stories";

test.afterEach(closeOtherContexts);
test.afterAll(restorePairing);

// Tasks 8.1a and 8.1b: the smoke tests, rewritten for the new UI (they replace the old-UI ones of Task 1.2: sign-in,
// venues, vendors, bookings and guests in 8.1a; wedding items, schedule, tasks, documents and files in 8.1b). Each is
// one short journey a planner makes, by roles and labels, against the emulators with nothing seeded but the
// couple's names.

test.beforeEach(async () => {
  await resetData();
});

test("sign in with an allowlisted account, and signing out leads back to the gate", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/sign-in", { timeout: COMPILE_TIMEOUT });
  const { email, password } = TEST_ACCOUNTS[0];
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("link", { name: "Greg & Bella" })).toBeVisible();

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/, { timeout: COMPILE_TIMEOUT });
});

test("add a venue and mark it Booked: it becomes a booking in the budget", async ({ page }) => {
  await openAt(page, "/vendors/venues");
  await page.getByRole("button", { name: "Add a venue" }).first().click({ timeout: COMPILE_TIMEOUT });
  const sheet = page.getByRole("dialog", { name: "Add a venue" });
  await sheet.getByLabel("Name").fill("Villa Samaya");
  await sheet.getByLabel("Estimated cost").fill("250000000");
  await sheet.getByRole("button", { name: "Add venue" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("link", { name: "Villa Samaya", exact: true }).click();
  await page.getByRole("dialog", { name: "Villa Samaya" }).getByRole("radio", { name: "Booked" }).click();
  await expect(page.getByRole("status").getByText("Villa Samaya is now a booking")).toBeVisible();

  await page.goto("/budget/bookings");
  await expect(page.locator("[data-booking-id]").filter({ hasText: "Villa Samaya" })).toContainText("Rp 250.000.000", { timeout: COMPILE_TIMEOUT });
});

test("add a vendor, mark it Chosen, split its booking into parts and record a payment", async ({ page }) => {
  await openAt(page, "/vendors");
  await page.getByRole("button", { name: "Add a vendor" }).click({ timeout: COMPILE_TIMEOUT });
  const sheet = page.getByRole("dialog", { name: "Add a vendor" });
  await sheet.getByLabel("Name").fill("Dapur Lestari Catering");
  await sheet.getByLabel("Category").selectOption("Catering");
  await sheet.getByRole("button", { name: "Add vendor" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("link", { name: "Dapur Lestari Catering", exact: true }).click();
  await page.getByRole("radio", { name: "Chosen" }).click({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("status").getByText("Dapur Lestari Catering is now a booking")).toBeVisible();
  await page.getByRole("link", { name: "Open the booking" }).click();

  await expect(page.getByRole("heading", { name: "Dapur Lestari Catering", level: 1 })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  const price = page.getByLabel("Agreed price");
  await price.fill("30000000");
  await price.blur();
  await expect(page.getByText("of Rp 30.000.000, with Rp 0 paid")).toBeVisible();
  await page.getByRole("button", { name: "Split into parts" }).click();
  await expect(page.getByText("from 1 part")).toBeVisible();
  await page.getByRole("button", { name: "Add a part" }).click();
  await expect(page.getByText("from 2 parts")).toBeVisible();

  await page.getByRole("button", { name: "Record a payment" }).first().click();
  const payment = page.getByRole("dialog", { name: "Record a payment" });
  await payment.getByLabel("Amount paid").fill("5000000");
  await payment.getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(payment).toHaveCount(0, { timeout: 15_000 });
  // The payment is on the part that was open (the booking's parts hold what's paid).
  await expect
    .poll(async () => {
      const doc = (await stored("vendors")).find((v) => v.name === "Dapur Lestari Catering");
      return (doc?.subEntries as { budgetSpent: number }[]).reduce((sum, p) => sum + p.budgetSpent, 0);
    })
    .toBe(5_000_000);
});

test("add a guest, remove them, and Undo brings them back", async ({ page }) => {
  await openAt(page, "/guests");
  await page.getByRole("button", { name: "Add a guest" }).first().click({ timeout: COMPILE_TIMEOUT });
  const sheet = page.getByRole("dialog", { name: "Add a guest" });
  await sheet.getByLabel("Name", { exact: true }).fill("Tante Lily");
  await sheet.getByRole("button", { name: "Add guest" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: /^Tante Lily/ }).click();
  await page.getByRole("dialog", { name: "Tante Lily" }).getByRole("button", { name: "Remove guest" }).click();
  await page.getByRole("dialog", { name: "Remove Tante Lily?" }).getByRole("button", { name: "Remove guest" }).click();
  await expect(page.getByRole("button", { name: /^Tante Lily/ })).toHaveCount(0);

  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: /^Tante Lily/ })).toBeVisible();
  await expect.poll(async () => (await stored("guests")).some((g) => g.name === "Tante Lily")).toBe(true);
});

test("add wedding items one per line, confirm one and mark one to work on next", async ({ page }) => {
  await openAt(page, "/items");
  // The first visit fills in the common items; a tracker emptied on purpose would not.
  await expect(page.getByText(/^The tracker starts with \d+ common items/)).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await page.getByRole("button", { name: "Add items" }).last().click();
  const sheet = page.getByRole("dialog", { name: "Add items" });
  await sheet.getByRole("textbox").fill("Photo album\nGuest book");
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("status").getByText("Added 2 items")).toBeVisible();
  await expect.poll(async () => (await stored("masterListItems")).some((i) => i.item === "Guest book")).toBe(true);

  const albumId = String((await stored("masterListItems")).find((i) => i.item === "Photo album")?.id);
  const album = page.locator(`[data-item-id="${albumId}"]`);
  await album.getByRole("button", { name: "Confirmed: Photo album" }).click();
  await album.getByRole("button", { name: "Work on next: Photo album" }).click();
  await expect
    .poll(async () => (await stored("masterListItems")).find((i) => i.item === "Photo album"))
    .toMatchObject({ confirmed: true, next: true });
});

test("add a schedule event, search for it and mark it completed", async ({ page }) => {
  await openAt(page, "/schedule");
  await page.getByRole("button", { name: "Add to the schedule" }).first().click({ timeout: COMPILE_TIMEOUT });
  const sheet = page.getByRole("dialog", { name: "Add to the schedule" });
  await sheet.getByLabel("Title").fill("Cake tasting");
  await sheet.getByLabel("Date").fill(inDays(2));
  await sheet.getByRole("button", { name: "Add to the schedule" }).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(async () => (await stored("scheduleEvents")).some((e) => e.title === "Cake tasting")).toBe(true);

  await page.getByRole("searchbox", { name: "Search the schedule" }).fill("cake");
  await expect(page.getByText("Cake tasting").first()).toBeVisible();
  await page.getByText("Cake tasting").first().click();
  await page.getByRole("dialog", { name: "Cake tasting" }).getByRole("button", { name: "Mark completed" }).click();
  await expect.poll(async () => (await stored("scheduleEvents")).find((e) => e.title === "Cake tasting")?.status).toBe("completed");
});

test("add a task with a step, and finish it", async ({ page }) => {
  await openAt(page, "/schedule/tasks");
  await page.getByRole("button", { name: "Add a task" }).first().click({ timeout: COMPILE_TIMEOUT });
  const sheet = page.getByRole("dialog", { name: "Add a task" });
  await sheet.getByLabel("What needs doing").fill("Order the cake");
  await sheet.getByRole("button", { name: "Add task" }).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(async () => (await stored("todos")).length).toBe(1);
  const [added] = await stored("todos");

  const task = page.locator(`[data-task-id="${String(added.id)}"]`);
  await task.getByRole("button", { name: "Add a step" }).click();
  await task.getByLabel("Step", { exact: true }).first().fill("Pick the flavour");
  await task.getByLabel("Step", { exact: true }).first().press("Enter");
  await expect.poll(async () => ((await stored("todos"))[0].subtasks as { title: string }[]).map((s) => s.title)).toEqual(["Pick the flavour"]);

  await page.getByRole("checkbox", { name: "Finish Order the cake" }).click();
  await expect.poll(async () => (await stored("todos"))[0].done).toBe(true);
});

test("write a document, and it is saved and listed under Documents", async ({ page }) => {
  await openAt(page, "/documents/new?start=blank");
  await page.getByLabel("Title").fill("Seating ideas", { timeout: COMPILE_TIMEOUT });
  await page.getByRole("textbox", { name: "Document" }).click();
  await page.keyboard.type("Family by the water.");
  await expect(page.getByRole("toolbar", { name: "Formatting" }).getByRole("status")).toHaveText("Saved just now", { timeout: 20_000 });
  await expect.poll(async () => (await stored("notes")).some((n) => n.title === "Seating ideas")).toBe(true);

  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await expect(page.getByRole("link", { name: /Seating ideas/ })).toBeVisible({ timeout: COMPILE_TIMEOUT });
});

test("make a folder and upload a file into it (Cloudinary stubbed)", async ({ page }) => {
  // Every Cloudinary call is answered here; nothing leaves the machine.
  await page.route("https://api.cloudinary.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        public_id: "test-upload/contract",
        secure_url: "https://res.cloudinary.com/test-cloud/raw/upload/v1/test-upload/contract.pdf",
        resource_type: "raw",
        format: "pdf",
        bytes: 24,
      }),
    }),
  );
  await openAt(page, "/documents/files");
  await page.getByRole("button", { name: "New folder" }).click({ timeout: COMPILE_TIMEOUT });
  await page.getByRole("dialog").getByLabel("Name").fill("Venue");
  await page.getByRole("dialog").getByLabel("Name").press("Enter");
  await page.getByRole("list", { name: "Folders" }).getByRole("link", { name: /Venue/ }).click();
  await expect(page.getByRole("heading", { name: "Venue", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Upload files" }).click();
  const upload = page.getByRole("dialog", { name: "Upload files" });
  await expect(upload.getByText(/^Into Files › Venue\./)).toBeVisible();
  await upload.locator('input[type="file"]').setInputFiles({ name: "Contract.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(100, "x") });
  await expect(upload.getByText("Uploaded", { exact: true })).toBeVisible();
  await upload.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Contract.pdf").first()).toBeVisible();
  await expect
    .poll(async () => (await stored("weddingFiles")).some((f) => f.name === "Contract.pdf" && f.url === "https://res.cloudinary.com/test-cloud/raw/upload/v1/test-upload/contract.pdf"))
    .toBe(true);
});
