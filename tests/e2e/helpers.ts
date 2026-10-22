import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import {
  EMULATOR_PROJECT_ID,
  FIRESTORE_EMULATOR,
  TEST_ACCOUNTS,
} from "./emulator-config";

/** First visits compile pages in dev mode, which can be slow. */
export const COMPILE_TIMEOUT = 100_000;

/**
 * For `test.afterEach`: closes the browser contexts a test opened itself (the partner's page, a page at
 * another size). Playwright closes only its own `context`, so one left open stays signed in for the rest
 * of the run and gets every write; a full run left dozens, and the stress fixture's thousands of writes
 * then flooded the Firestore emulator until every later test timed out (review item P5-S29).
 */
export async function closeOtherContexts({ browser, context }: { browser: Browser; context: BrowserContext }) {
  await Promise.all(browser.contexts().filter((other) => other !== context).map((other) => other.close()));
}

let counter = 0;

/** A name that is unique across runs and across calls in one run. */
export function uniqueName(label: string) {
  counter += 1;
  return `${label}-${Date.now().toString(36)}${counter}`;
}

/** Signs in to the old UI (the frozen fallback under /old) with the first allowlisted test account. */
export async function signIn(page: Page) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/old/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/old", { timeout: COMPILE_TIMEOUT });
  await expect(page.getByText("Our Wedding").first()).toBeVisible();
}

/** Signs in, then opens a page and waits for it to leave the loading state. */
export async function signInAndGoto(page: Page, path: string) {
  await signIn(page);
  await page.goto(path);
  await expect(page.getByText("Loading…")).toHaveCount(0, {
    timeout: COMPILE_TIMEOUT,
  });
}

/**
 * Replaces the text of a click-to-edit cell. `cell` is the button showing the
 * current value; the editor opens on mousedown and saves on Enter.
 *
 * A row can be redrawn right after it is created (when the server timestamp
 * arrives), which throws away the open editor. The click-type-Enter sequence is
 * therefore retried until the new text shows up. For number cells, whose shown
 * text differs from what is typed, pass `saved` to say what to wait for.
 */
export async function editCell(
  page: Page,
  cell: Locator,
  value: string,
  saved: Locator = page.getByRole("button", { name: value, exact: true }),
) {
  await expect(async () => {
    if (await saved.first().isVisible()) return;
    await cell.click({ timeout: 3_000 });
    const editor = page.locator("textarea:focus, input:focus");
    await editor.fill(value, { timeout: 3_000 });
    await editor.press("Enter", { timeout: 3_000 });
    await expect(saved.first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

/**
 * Picks an option from a Select (base-ui combobox) by its visible text. A click
 * made before the page has hydrated is lost, so the whole open-and-pick step is
 * retried until the option has been chosen.
 */
export async function chooseOption(
  page: Page,
  trigger: Locator,
  option: string,
) {
  await expect(async () => {
    if (
      !(await page
        .getByRole("option", { name: option, exact: true })
        .isVisible())
    ) {
      await trigger.click({ timeout: 2_000 });
    }
    await page
      .getByRole("option", { name: option, exact: true })
      .click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

const STATUS_NAMES = /^(List|Inquiring|Consideration|Chosen|Done|Rejected)/;

/** The contract-status pill in a Vendors table row. */
export function vendorStatusPill(row: Locator) {
  return row.getByRole("combobox").filter({ hasText: STATUS_NAMES });
}

/** Position of a table column, found by its header text. */
export async function columnIndex(page: Page, header: string) {
  const headers = await page.getByRole("columnheader").allInnerTexts();
  const index = headers.findIndex((h) => h.trim() === header);
  expect(index, `column "${header}" exists`).toBeGreaterThanOrEqual(0);
  return index;
}

type FirestoreValue = Record<string, unknown>;

function decodeValue(value: FirestoreValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    const values =
      (value.arrayValue as { values?: FirestoreValue[] }).values ?? [];
    return values.map(decodeValue);
  }
  if ("mapValue" in value) {
    const fields =
      (value.mapValue as { fields?: Record<string, FirestoreValue> }).fields ??
      {};
    return Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]),
    );
  }
  return undefined;
}

/**
 * Reads a collection straight from the Firestore emulator. The app shows a
 * change at once from its local cache, before the write has reached the
 * server, and a page reload in between would lose it. Poll this before reloading
 * a page to check that something was really saved.
 */
export async function storedDocs(
  collection: string,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/${collection}?pageSize=1000`,
    { headers: { Authorization: "Bearer owner" } },
  );
  if (!res.ok) throw new Error(`Reading ${collection} failed: ${res.status}`);
  const body = (await res.json()) as {
    documents?: { name: string; fields?: Record<string, FirestoreValue> }[];
  };
  return (body.documents ?? []).map((doc) => ({
    id: doc.name.split("/").at(-1),
    ...(decodeValue({ mapValue: { fields: doc.fields ?? {} } }) as Record<
      string,
      unknown
    >),
  }));
}

/** Waits until the emulator holds a document in `collection` that matches `predicate`. */
export async function expectStored(
  collection: string,
  predicate: (doc: Record<string, unknown>) => boolean,
) {
  await expect
    .poll(async () => (await storedDocs(collection)).some(predicate), {
      timeout: 15_000,
    })
    .toBe(true);
}

/**
 * For a spec that counts every vendor and venue (Bookings, Budget): stops at once, naming them, if an
 * earlier spec left any behind, rather than failing later on a total that is off by one (P5-S27: the
 * old-UI smoke test once left a booking that way, and these specs failed in a full run but not alone).
 * `ownPrefix` is this spec's own ids, which a run stopped half-way may have left.
 */
export async function expectNoLeftoverBookings(ownPrefix: string) {
  const left: string[] = [];
  for (const collection of ["vendors", "venues"]) {
    for (const doc of await storedDocs(collection)) {
      const id = String(doc.id);
      if (!id.startsWith(ownPrefix)) left.push(`${collection}/${id} (${String(doc.name ?? "no name")})`);
    }
  }
  if (left.length > 0) {
    throw new Error(
      `Another spec left ${left.length === 1 ? "this" : "these"} behind, so the totals here would be wrong: ` +
        `${left.join(", ")}. Find the spec that writes it and make it remove what it adds.`,
    );
  }
}
