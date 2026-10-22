import { expect, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "./emulator-config";
import { COMPILE_TIMEOUT, storedDocs } from "./helpers";
import { restorePairing } from "./seed";

// Shared by the story specs (Task 8.1a, `stories-*.spec.ts`): each story's behaviour test seeds a few
// documents as the emulator's owner (which skips the rules), drives the screen by roles and labels, and
// reads back what was stored. A spec that uses `resetData` calls `restorePairing` in `afterAll`.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

export type Value = string | number | boolean | null | Date | Value[] | { [key: string]: Value };

function encode(value: Value): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
}

/** Writes (or replaces the fields of) one document. */
export async function put(collection: string, id: string, fields: Record<string, Value>) {
  const res = await fetch(`${DOCS}/${collection}/${id}`, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, encode(v)])) }),
  });
  expect(res.ok, `writing ${collection}/${id}`).toBe(true);
}

/** Deletes one document, as the server's delete route does (specs that stub that route). */
export async function drop(collection: string, id: string) {
  const res = await fetch(`${DOCS}/${collection}/${id}`, { method: "DELETE", headers: ADMIN });
  expect(res.ok, `deleting ${collection}/${id}`).toBe(true);
}

/** Every stored document of a collection, with its id. */
export const stored = storedDocs;

/** One stored document, or null. */
export async function storedDoc(collection: string, id: string) {
  return (await storedDocs(collection)).find((doc) => doc.id === id) ?? null;
}

/** Empties Firestore, pairs the two accounts again and writes the couple's names (and what else `settings` needs). */
export async function resetData(settings: Record<string, Value> = {}) {
  const res = await fetch(DOCS.replace("/v1/", "/emulator/v1/"), { method: "DELETE" });
  expect(res.ok).toBe(true);
  await restorePairing();
  await put("settings", "wedding", { yourName: "Greg", partnerName: "Bella", partnerEmail: TEST_ACCOUNTS[1].email, ...settings });
}

export { restorePairing };

const pad = (n: number) => String(n).padStart(2, "0");
/** A date `n` days from today, in this machine's calendar, as `YYYY-MM-DD`. */
export function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Signs in as the first test account on a computer-size page, and opens `path`. */
export async function openAt(page: Page, path: string, account: (typeof TEST_ACCOUNTS)[number] = TEST_ACCOUNTS[0]) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: COMPILE_TIMEOUT });
  if (path !== "/") await page.goto(path);
}
