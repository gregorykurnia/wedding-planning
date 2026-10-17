import { expect, test, type Page } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.17: a document against the emulators (guide §4.24, §5.17, §6.1, N18).
// Documents are seeded and read back as the emulator's owner (which skips the
// rules); everything else goes through the screen.

const DOCS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

/** Firestore's REST shape for any JSON value. */
type Value = Record<string, unknown>;
function toValue(v: unknown): Value {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, toValue(x)])) } };
}
function fromValue(v: Value): unknown {
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return ((v.arrayValue as { values?: Value[] }).values ?? []).map(fromValue);
  if ("mapValue" in v) {
    const fields = (v.mapValue as { fields?: Record<string, Value> }).fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([k, x]) => [k, fromValue(x)]));
  }
  return undefined;
}

async function put(id: string, data: Record<string, unknown>) {
  const body = { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) };
  const res = await fetch(`${DOCS}/notes/${id}`, { method: "PATCH", headers: ADMIN, body: JSON.stringify(body) });
  expect(res.ok).toBe(true);
}

async function read(id: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${DOCS}/notes/${id}`, { headers: ADMIN });
  if (res.status === 404) return null;
  const json = (await res.json()) as { fields: Record<string, Value> };
  return fromValue({ mapValue: { fields: json.fields } }) as Record<string, unknown>;
}

const IDS: string[] = [];
const docId = (label: string) => {
  const id = `e2e-${label}-${Date.now().toString(36)}`;
  IDS.push(id);
  return id;
};

test.afterAll(async () => {
  for (const id of IDS) await fetch(`${DOCS}/notes/${id}`, { method: "DELETE", headers: ADMIN });
});

const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const body = (...content: object[]) => ({ type: "doc", content });
const textOf = (content: unknown) => JSON.stringify(content);

async function signIn(page: Page) {
  const { email, password } = TEST_ACCOUNTS[0];
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
}

async function open(page: Page, path: string) {
  await signIn(page);
  await page.goto(path);
  await expect(page.getByLabel("Title")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  await expect(page.getByRole("toolbar", { name: "Formatting" })).toBeVisible();
}

const bodyOf = (page: Page) => page.getByRole("textbox", { name: "Document" });
const saveState = (page: Page) => page.getByRole("toolbar", { name: "Formatting" }).getByRole("status");

/**
 * Selects `text` in the body, or with `caret` puts the cursor just after it.
 * Set through the DOM, because Home and End keys differ between Mac and Linux.
 */
async function select(page: Page, text: string, caret = false) {
  await bodyOf(page).click();
  await bodyOf(page).evaluate(
    (root, [wanted, collapse]) => {
      // The cursor goes after the last match; a selection takes the first.
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let hit: { node: Node; at: number } | null = null;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.textContent!.lastIndexOf(wanted as string);
        if (at < 0) continue;
        hit = { node, at };
        if (!collapse) break;
      }
      if (!hit) throw new Error(`No text "${wanted}"`);
      const end = hit.at + (wanted as string).length;
      const range = document.createRange();
      range.setStart(hit.node, collapse ? end : hit.at);
      range.setEnd(hit.node, end);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
    },
    [text, caret] as const,
  );
}

/** Puts the cursor at the end of the body's text and types. */
async function typeAtEnd(page: Page, text: string) {
  const lines = (await bodyOf(page).innerText()).trimEnd().split("\n");
  await select(page, lines[lines.length - 1].slice(-3), true);
  await page.keyboard.type(text);
}

test("meeting notes start with the layout, save after a pause, and the address becomes the document's", async ({ page }) => {
  await open(page, "/new/documents/new?start=meeting");
  const title = page.getByLabel("Title");
  await expect(title).toHaveValue("Meeting: ");
  await expect(title).toBeFocused();
  await expect(page.getByText("New document")).toBeVisible();
  await expect(bodyOf(page)).toContainText("Who was there:");
  await expect(bodyOf(page).getByRole("heading", { name: "What they said" })).toBeVisible();
  await expect(bodyOf(page).locator("table")).toContainText("=SUM(B2:B)");
  // Nothing is made until something is typed.
  await expect(page.getByRole("button", { name: "Delete this document" })).toHaveCount(0);

  await page.keyboard.type("Kebun Bunga Atelier");
  await expect(saveState(page)).toHaveText("Not saved yet");
  await expect(saveState(page)).toHaveText("Saved just now", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/new\/documents\/(?!new)[A-Za-z0-9]+$/);
  const id = page.url().split("/").pop()!;
  IDS.push(id);
  const stored = await read(id);
  expect(stored).toMatchObject({ title: "Meeting: Kebun Bunga Atelier" });
  expect(textOf(stored?.content)).toContain("=SUM(B2:B)");
  await expect(page).toHaveTitle("Meeting: Kebun Bunga Atelier · Our wedding planner");
});

test("an old document opens complete, with its fonts and sizes mapped and colours as typed", async ({ page }) => {
  const id = docId("legacy");
  const styled = (text: string, attrs: Record<string, string | null>) => ({
    type: "text",
    text,
    marks: [{ type: "textStyle", attrs }],
  });
  await put(id, {
    title: "Honeymoon research",
    content: body(
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Japan or Lombok?" }] },
      {
        type: "paragraph",
        content: [
          styled("Serif words", { fontFamily: "Georgia", fontSize: "20px", color: "#ff00aa" }),
          styled(" plain words", { fontFamily: "Inter", fontSize: "16px", color: null }),
        ],
      },
      { type: "bulletList", content: [{ type: "listItem", content: [para("Kyoto ryokans")] }] },
    ),
  });
  await open(page, `/new/documents/${id}`);
  await expect(page.getByLabel("Title")).toHaveValue("Honeymoon research");
  await expect(bodyOf(page).getByRole("heading", { name: "Japan or Lombok?" })).toBeVisible();
  const serif = bodyOf(page).getByText("Serif words");
  await expect(serif).toHaveAttribute("data-font", "georgia");
  await expect(serif).toHaveAttribute("data-size", "large");
  await expect(serif).toHaveCSS("color", "rgb(255, 0, 170)");
  await expect(bodyOf(page).getByText("plain words")).not.toHaveAttribute("data-font", /.+/);
  await expect(bodyOf(page).getByRole("listitem")).toHaveText("Kyoto ryokans");
  // Seeded without an edit time, so it says "Saved" with no time.
  await expect(saveState(page)).toHaveText(/^Saved/);
  // Opening writes nothing.
  await page.waitForTimeout(1500);
  expect(textOf((await read(id))?.content)).toContain('"fontFamily":"Inter"');
});

test("a change that can't save keeps the text and says so; Try again and coming back online save it", async ({
  page,
  context,
}) => {
  const id = docId("offline");
  await put(id, { title: "Seating ideas", content: body(para("Grandmothers together.")) });
  await open(page, `/new/documents/${id}`);

  await context.setOffline(true);
  await typeAtEnd(page, " Near the front.");
  await expect(saveState(page)).toContainText("Not saved: you’re offline. Keep this page open.", { timeout: 30_000 });
  await expect(bodyOf(page)).toContainText("Grandmothers together. Near the front.");

  await context.setOffline(false);
  await expect(saveState(page)).toHaveText("Saved just now", { timeout: 30_000 });
  await expect.poll(async () => textOf((await read(id))?.content), { timeout: 15_000 }).toContain("Near the front.");

  // Online but the write doesn't get through: Couldn't save, then Try again.
  await page.route("**/google.firestore.v1.Firestore/Write/**", (route) => route.abort());
  await typeAtEnd(page, " Away from the speakers.");
  await expect(saveState(page)).toContainText("Couldn’t save your last changes. They’re still here.", { timeout: 30_000 });
  await page.unroute("**/google.firestore.v1.Firestore/Write/**");
  // Wakes Firestore's connection at once instead of after its back-off.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await saveState(page).getByRole("button", { name: "Try again" }).click();
  await expect(saveState(page)).toHaveText("Saved just now", { timeout: 30_000 });
  await expect.poll(async () => textOf((await read(id))?.content), { timeout: 15_000 }).toContain("Away from the speakers.");
});

test("leaving before it's saved saves first, then goes (N18)", async ({ page }) => {
  const id = docId("leave");
  await put(id, { title: "Questions", content: body(para("Is our date free?")) });
  await open(page, `/new/documents/${id}`);
  await typeAtEnd(page, " How long can you hold it?");
  await expect(saveState(page)).toHaveText("Not saved yet");
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await expect(page).toHaveURL("/new/documents", { timeout: 30_000 });
  expect(textOf((await read(id))?.content)).toContain("How long can you hold it?");
});

test("leaving after a change didn't save asks first: Stay keeps it, Leave without them goes (N18)", async ({
  page,
  context,
}) => {
  const id = docId("leave-failed");
  await put(id, { title: "Trays", content: body(para("Fruit.")) });
  await open(page, `/new/documents/${id}`);

  // Offline: the question says so, and Stay keeps the page and the text.
  await context.setOffline(true);
  await typeAtEnd(page, " Cakes.");
  await expect(saveState(page)).toContainText("you’re offline", { timeout: 30_000 });
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Your last changes aren’t saved" });
  await expect(sheet).toContainText("You’re offline, so the planner couldn’t save them.");
  await expect(sheet.getByRole("button", { name: "Stay and try again" })).toBeFocused();
  await sheet.getByRole("button", { name: "Stay and try again" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(`/new/documents/${id}`);
  await expect(bodyOf(page)).toContainText("Fruit. Cakes.");
  // Back online, it saves by itself.
  await context.setOffline(false);
  await expect(saveState(page)).toHaveText("Saved just now", { timeout: 30_000 });

  // Online, but the write doesn't get through: Leave without them goes.
  await page.route("**/google.firestore.v1.Firestore/Write/**", (route) => route.abort());
  await typeAtEnd(page, " Tea.");
  await expect(saveState(page)).toContainText("Couldn’t save your last changes.", { timeout: 30_000 });
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  const again = page.getByRole("dialog", { name: "Your last changes aren’t saved" });
  await expect(again).toContainText("The planner couldn’t save them.");
  await again.getByRole("button", { name: "Leave without them" }).click();
  await expect(page).toHaveURL("/new/documents");
  await page.unroute("**/google.firestore.v1.Firestore/Write/**");
});

test("a partner's saved change appears when nothing is unsaved here; with unsaved changes, the later save wins", async ({
  page,
}) => {
  const id = docId("partner");
  await put(id, { title: "Playlist", content: body(para("Lucky")) });
  await open(page, `/new/documents/${id}`);

  await put(id, { title: "Playlist", content: body(para("Lucky"), para("Can’t Help Falling in Love")), updatedBy: "partner" });
  await expect(bodyOf(page)).toContainText("Can’t Help Falling in Love", { timeout: 15_000 });
  await expect(page.getByText(/^Edited just now by /)).toBeVisible();

  // Typing here, then the partner saves before this does: this page's save comes later and wins.
  await typeAtEnd(page, " (ours)");
  await put(id, { title: "Playlist", content: body(para("Theirs only")), updatedBy: "partner" });
  await expect(saveState(page)).toHaveText("Saved just now", { timeout: 15_000 });
  await expect(bodyOf(page)).toContainText("(ours)");
  await expect(bodyOf(page)).not.toContainText("Theirs only");
  expect(textOf((await read(id))?.content)).toContain("(ours)");
});

test("Delete for good asks, says it can't be undone, and the document is gone", async ({ page }) => {
  const id = docId("delete");
  await put(id, { title: "Seating ideas", content: body(para("x")) });
  await open(page, `/new/documents/${id}`);
  await page.getByRole("button", { name: "Delete this document" }).click();
  const sheet = page.getByRole("dialog", { name: "Delete “Seating ideas”?" });
  await expect(sheet).toContainText("This can’t be undone.");
  await sheet.getByRole("button", { name: "Delete for good" }).click();
  await expect(page.getByRole("heading", { name: "Document deleted", level: 1 })).toBeVisible();
  await expect(page.getByText("It’s gone for both of you.")).toBeVisible();
  expect(await read(id)).toBeNull();
});

test("an old link says the document isn't here; one deleted while open says so", async ({ page }) => {
  await signIn(page);
  await page.goto("/new/documents/no-such-document");
  await expect(page.getByRole("heading", { name: "This document isn’t here", level: 1 })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
  await expect(page.getByRole("link", { name: "See all documents" })).toBeVisible();

  const id = docId("gone");
  await put(id, { title: "Old plan", content: body(para("x")) });
  await page.goto(`/new/documents/${id}`);
  await expect(page.getByLabel("Title")).toHaveValue("Old plan", { timeout: COMPILE_TIMEOUT });
  await fetch(`${DOCS}/notes/${id}`, { method: "DELETE", headers: ADMIN });
  await expect(page.getByRole("heading", { name: "This document was deleted", level: 1 })).toBeVisible();
  await expect(page.getByText("It can’t be brought back.")).toBeVisible();
});

test("Cmd/Ctrl+K adds a link, a click shows its bubble, and colours store the palette's own values", async ({ page }) => {
  const id = docId("links");
  await put(id, { title: "Florists", content: body(para("Call ")) });
  await open(page, `/new/documents/${id}`);
  await select(page, "Call ", true);
  await page.keyboard.press("ControlOrMeta+k");
  const sheet = page.getByRole("dialog", { name: "Add a link" });
  await sheet.getByLabel("Web address").fill("kebunbunga.id");
  await sheet.getByLabel("Text").fill("Kebun Bunga");
  await sheet.getByRole("button", { name: "Add link" }).click();
  const link = bodyOf(page).getByRole("link", { name: "Kebun Bunga" });
  await expect(link).toHaveAttribute("href", "https://kebunbunga.id");

  await link.click();
  await expect(page.getByRole("link", { name: "kebunbunga.id" })).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit link" }).getByLabel("Web address")).toHaveValue(
    "https://kebunbunga.id",
  );
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();

  // Select the word "Call" and make it rose and bold.
  await select(page, "Call");
  await page.getByRole("button", { name: "Bold" }).click();
  await expect(page.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Text colour" }).click();
  await page.getByRole("dialog", { name: "Text colour" }).getByRole("button", { name: "Rose" }).click();
  await expect(saveState(page)).toHaveText("Saved just now", { timeout: 15_000 });
  const stored = textOf((await read(id))?.content);
  expect(stored).toContain('"color":"#b8355b"');
  expect(stored).toContain('"href":"https://kebunbunga.id"');
  expect(stored).toContain('"type":"bold"');
});

test("on a phone the toolbar docks at the bottom and the save state floats at the top", async ({ page }) => {
  const id = docId("phone");
  await put(id, { title: "Phone", content: body(para("x")) });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, `/new/documents/${id}`);
  const toolbar = page.getByRole("toolbar", { name: "Formatting" });
  await expect(toolbar).toHaveCSS("position", "fixed");
  const box = await toolbar.boundingBox();
  expect(box!.y + box!.height).toBeGreaterThan(800);
  const status = await saveState(page).boundingBox();
  expect(status!.y).toBeLessThan(60);
});
