import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, TEST_ACCOUNTS, TEST_PORTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.4: the gallery's field demo saving to the Firebase emulator. Its first
// three fields (the two names and the wedding date) write to settings/wedding.

const SETTINGS_URL = `http://127.0.0.1:${TEST_PORTS.firestore}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/settings/wedding`;
const OWNER = { Authorization: "Bearer owner" };

async function writeSettings(fields: Record<string, string>) {
  const response = await fetch(SETTINGS_URL, {
    method: "PATCH",
    headers: { ...OWNER, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { stringValue: value }])),
    }),
  });
  expect(response.ok).toBe(true);
}

/** The document as the emulator holds it, as plain strings. */
async function readSettings(): Promise<Record<string, string | null>> {
  const response = await fetch(SETTINGS_URL, { headers: OWNER });
  expect(response.ok).toBe(true);
  const body = (await response.json()) as { fields?: Record<string, { stringValue?: string; nullValue?: null }> };
  return Object.fromEntries(
    Object.entries(body.fields ?? {}).map(([key, value]) => [key, value.stringValue ?? null]),
  );
}

test.afterAll(async () => {
  await fetch(SETTINGS_URL, { method: "DELETE", headers: OWNER });
});

async function openForm(page: Page) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery");
  const screen = page.getByRole("group", { name: "Detail screen form" });
  await expect(screen).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return screen;
}

test("the form saves to settings/wedding, and the values are there after a reload", async ({ page }) => {
  await writeSettings({ yourName: "Greg", partnerName: "Bella", weddingDate: "2027-06-12" });
  const screen = await openForm(page);
  const line = screen.getByRole("status").first();
  await expect(page.getByText("Saving to: the emulator (names and date)")).toBeVisible();

  // The fields show what the document holds.
  await expect(screen.getByLabel("First name", { exact: true })).toHaveValue("Greg");
  await expect(screen.getByLabel("Second name", { exact: true })).toHaveValue("Bella");
  await expect(screen.getByLabel("Wedding date", { exact: true })).toHaveValue("2027-06-12");

  await screen.getByLabel("Second name", { exact: true }).fill("Isabella");
  await screen.getByLabel("Second name", { exact: true }).blur();
  await expect(line).toHaveText("Saved");
  await screen.getByLabel("Wedding date", { exact: true }).fill("2027-07-03");
  await expect(line).toHaveText("Saved");

  await expect.poll(async () => (await readSettings()).partnerName).toBe("Isabella");
  await expect.poll(async () => (await readSettings()).weddingDate).toBe("2027-07-03");
  expect((await readSettings()).yourName).toBe("Greg");

  await page.reload();
  const again = page.getByRole("group", { name: "Detail screen form" });
  await expect(again.getByLabel("Second name", { exact: true })).toHaveValue("Isabella", { timeout: COMPILE_TIMEOUT });
  await expect(again.getByLabel("Wedding date", { exact: true })).toHaveValue("2027-07-03");
});

test("a cleared name comes back and the document keeps its name", async ({ page }) => {
  await writeSettings({ yourName: "Greg", partnerName: "Bella", weddingDate: "2027-06-12" });
  const screen = await openForm(page);
  const first = screen.getByLabel("First name", { exact: true });
  await expect(first).toHaveValue("Greg");
  await first.fill("");
  await first.blur();
  await expect(first).toHaveValue("Greg");
  expect((await readSettings()).yourName).toBe("Greg");
});

test("a forced failure keeps the input and writes nothing, and Try again writes it", async ({ page }) => {
  await writeSettings({ yourName: "Greg", partnerName: "Bella", weddingDate: "2027-06-12" });
  const screen = await openForm(page);
  const line = screen.getByRole("status").first();
  const second = screen.getByLabel("Second name", { exact: true });
  await expect(second).toHaveValue("Bella");

  await page.locator("#section-3-4").getByRole("group", { name: "Demo switches" }).getByLabel("Make saves fail").check();
  await second.fill("Izzy");
  await second.blur();
  await expect(line).toHaveText("1 change not saved");
  await expect(second).toHaveValue("Izzy");
  expect((await readSettings()).partnerName).toBe("Bella");

  await page.locator("#section-3-4").getByRole("group", { name: "Demo switches" }).getByLabel("Make saves fail").uncheck();
  await screen.getByRole("button", { name: "Try again" }).click();
  await expect(line).toHaveText("Saved");
  await expect.poll(async () => (await readSettings()).partnerName).toBe("Izzy");
});
