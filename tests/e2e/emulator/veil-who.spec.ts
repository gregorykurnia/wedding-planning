import { expect, test, type Browser, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";

test.afterEach(closeOtherContexts);

// N3: who's who. The first sign-in of an account that holds neither name asks
// "Which of you is this?" (or for the two names), once; the other account then
// gets the other name without asking; and a change from your own other device
// arrives as yours, never as your partner's.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

type Doc = { fields?: Record<string, unknown> };

async function read(path: string): Promise<Doc | null> {
  const res = await fetch(`${DOCS}/${path}`, { headers: ADMIN });
  return res.ok ? ((await res.json()) as Doc) : null;
}

async function write(path: string, doc: Doc | null) {
  const res = doc
    ? await fetch(`${DOCS}/${path}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(doc) })
    : await fetch(`${DOCS}/${path}`, { method: "DELETE", headers: ADMIN });
  expect(res.ok).toBe(true);
}

const names = (first: string, second: string): Doc => ({
  fields: { yourName: { stringValue: first }, partnerName: { stringValue: second } },
});

/** The stored pairing as { uid: place }. */
async function slots(): Promise<Record<string, string>> {
  const doc = await read("settings/accounts");
  const map = (doc?.fields?.slots as { mapValue?: { fields?: Record<string, { stringValue: string }> } } | undefined)
    ?.mapValue?.fields;
  return Object.fromEntries(Object.entries(map ?? {}).map(([uid, v]) => [uid, v.stringValue]));
}

let seededAccounts: Doc | null = null;
let seededWedding: Doc | null = null;

test.beforeAll(async () => {
  seededAccounts = await read("settings/accounts");
  seededWedding = await read("settings/wedding");
});

// The seed pairs both accounts; each test here starts with nobody paired.
test.beforeEach(async () => {
  await write("settings/accounts", null);
});

test.afterAll(async () => {
  await write("settings/accounts", seededAccounts);
  await write("settings/wedding", seededWedding);
});

async function signInAs(page: Page, account: (typeof TEST_ACCOUNTS)[number], landing = "/new") {
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(landing, { timeout: COMPILE_TIMEOUT });
}

const fresh = async (browser: Browser) => (await browser.newContext()).newPage();

test("with no names yet, the first sign-in asks for both, once, and the names become the couple's", async ({ page }) => {
  await write("settings/wedding", names("", ""));
  await signInAs(page, TEST_ACCOUNTS[0]);

  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByText(`You’re signed in as ${TEST_ACCOUNTS[0].email}.`)).toBeVisible();
  // Nothing else on the page: no top bar until it is answered.
  await expect(page.getByRole("button", { name: "Menu" })).toHaveCount(0);

  const cont = page.getByRole("button", { name: "Continue", exact: true });
  await expect(cont).toBeDisabled();
  await page.getByLabel("Your first name").fill("Gregory");
  await expect(cont).toBeDisabled();
  await page.getByLabel("Your partner’s first name").fill("Isabella");
  await expect(cont).toBeEnabled();
  await cont.click();

  await expect(page.getByRole("link", { name: "Gregory & Isabella" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("heading", { name: "Welcome" })).toHaveCount(0);
  const stored = await slots();
  expect(Object.values(stored)).toEqual(["first"]);
  const wedding = (await read("settings/wedding"))?.fields as Record<string, { stringValue: string }>;
  expect([wedding.yourName.stringValue, wedding.partnerName.stringValue]).toEqual(["Gregory", "Isabella"]);

  // Asked once: a reload goes straight through.
  await page.reload();
  await expect(page.getByRole("link", { name: "Gregory & Isabella" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
});

test("with both names set, it asks which is this account's, and the other account is given the other without asking", async ({
  browser,
  page,
}) => {
  await write("settings/wedding", names("Greg", "Bella"));
  await signInAs(page, TEST_ACCOUNTS[1]);

  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  const group = page.getByRole("radiogroup", { name: "Which of you is this?" });
  const cont = page.getByRole("button", { name: "Continue", exact: true });
  await expect(cont).toBeDisabled();
  await group.getByRole("radio", { name: "Bella" }).click();
  await expect(page.getByRole("button", { name: "Continue as Bella" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue as Bella" }).click();

  await expect(page.getByRole("link", { name: "Greg & Bella" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  expect(Object.values(await slots())).toEqual(["second"]);

  // Greg signs in on another browser: nothing is asked, and he is the other name.
  const greg = await fresh(browser);
  await signInAs(greg, TEST_ACCOUNTS[0]);
  await expect(greg.getByRole("link", { name: "Greg & Bella" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(greg.getByRole("heading", { name: "Welcome" })).toHaveCount(0);
  expect(Object.values(await slots()).sort()).toEqual(["second"]);
});

test("a change from your own other computer arrives in your name, and is never the partner's", async ({ browser }) => {
  await write("settings/wedding", names("Greg", "Bella"));
  const open = async () => {
    const page = await fresh(browser);
    await signInAs(page, TEST_ACCOUNTS[0]);
    // The first of the two to sign in is asked once; pick Greg.
    const ask = page.getByRole("radiogroup", { name: "Which of you is this?" });
    if (await ask.isVisible().catch(() => false)) {
      await ask.getByRole("radio", { name: "Greg" }).click();
      await page.getByRole("button", { name: "Continue as Greg" }).click();
    }
    await expect(page.getByRole("link", { name: "Greg & Bella" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    await page.goto("/new/gallery/partner");
    await expect(page.getByRole("heading", { name: "Live partner changes" })).toBeVisible({ timeout: COMPILE_TIMEOUT });
    return page;
  };
  const here = await open();
  const other = await open();

  await here.getByRole("button", { name: "Record a payment as me" }).click();
  await expect(
    other.getByRole("status").getByText("You recorded Rp 55.500.000 for Dapur Lestari Catering on your other computer"),
  ).toBeVisible({ timeout: 15_000 });
  await expect(other.getByTestId("booking-row")).toHaveClass(/\bflash\b/);
  // Not the partner's change: no name but yours, and the browser that made it hears nothing.
  await expect(other.getByRole("status").getByText(/Bella recorded/)).toHaveCount(0);
  await expect(here.getByRole("status").getByText(/recorded/)).toHaveCount(0);
});
