import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.3: the buttons, links and chips, on the dev-only gallery page. The
// model test in tests/model/actions.test.tsx checks the markup.

async function openGallery(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery/actions");
  await expect(page.getByRole("heading", { name: "Buttons, links and chips" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
  // The server renders the page before React attaches its handlers, and React
  // hydrates in document order; the last control on the page is the last to
  // get its handlers. Dev mode then re-renders the page once more (Fast
  // Refresh) when its chunks arrive, so wait for the requests to settle too.
  // A press made before that does nothing, as for a real visitor.
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (el) =>
        el.textContent?.trim() === "Edit categories" &&
        Object.keys(el).some((key) => key.startsWith("__reactProps")),
    ),
  );
  await page.waitForLoadState("networkidle");
}

// Colours worked out by hand from tokens.css: --color-text #33262c,
// --accent-attention-text #b8355b, --accent-thread #c6a466.
const INK = "rgb(51, 38, 44)";
const ROSE = "rgb(184, 53, 91)";
const CHAMPAGNE = "rgb(198, 164, 102)";

test("the primary button is an ink pill at least 34px high", async ({ page }) => {
  await openGallery(page);
  const add = page.getByRole("button", { name: "Add vendor", exact: true });
  await expect(add).toHaveCSS("background-color", INK);
  expect((await add.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(34);
});

test("the quiet button is outlined and takes a blush wash on hover", async ({ page }) => {
  await openGallery(page);
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  await expect(cancel).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await cancel.hover();
  await expect(cancel).toHaveCSS("background-color", "rgba(253, 232, 238, 0.5)");
});

test("the danger button is rose, and stays rose when hovered", async ({ page }) => {
  await openGallery(page);
  const remove = page.getByRole("button", { name: "Remove booking", exact: true });
  await expect(remove).toHaveCSS("background-color", ROSE);
  await remove.hover();
  await expect(remove).toHaveCSS("background-color", ROSE);
});

test("the small button sets its text at 13.5px", async ({ page }) => {
  await openGallery(page);
  await expect(page.getByRole("button", { name: "Add item", exact: true })).toHaveCSS(
    "font-size",
    "13.5px",
  );
});

test("a disabled button is faded and can't be pressed", async ({ page }) => {
  await openGallery(page);
  const move = page.getByRole("button", { name: "Move here", exact: true });
  await expect(move).toBeDisabled();
  await expect(move).toHaveCSS("opacity", "0.45");
});

test("a busy button shows the spinner and the gerund, and ignores a second press", async ({
  page,
}) => {
  await openGallery(page);
  const copy = page.getByRole("button", { name: "Copy to the shortlist", exact: true });
  const copying = page.getByRole("button", { name: "Copying", exact: true });
  // In dev mode a first press can land before the page settles, so press until
  // the count shows it was taken.
  await expect(async () => {
    await copy.click();
    await expect(page.getByText("Presses: 1", { exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await expect(copying).toHaveAttribute("aria-busy", "true");
  // aria-disabled, not disabled: the press is taken but must do nothing.
  await copying.click({ force: true });
  await page.waitForTimeout(300);
  await expect(page.getByText("Presses: 1", { exact: true })).toBeVisible();
  const spinner = await copying.evaluate((el) => getComputedStyle(el, "::before").animationName);
  expect(spinner).not.toBe("none");
  await expect(copy).toHaveText("Copy to the shortlist", { timeout: 5000 });
  await expect(copy).not.toHaveAttribute("aria-busy", "true");
});

test("the Google button keeps Google's brand colours on a white face", async ({ page }) => {
  await openGallery(page);
  const google = page.getByRole("button", { name: "Continue with Google", exact: true });
  await expect(google).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(google.locator("svg path").first()).toHaveAttribute("fill", "#4285F4");
});

test("the floating button has the add shadow", async ({ page }) => {
  await openGallery(page);
  await expect(page.getByRole("button", { name: "Add items", exact: true })).not.toHaveCSS(
    "box-shadow",
    "none",
  );
});

test("a text link is ink with a champagne underline, and rose when it removes", async ({
  page,
}) => {
  await openGallery(page);
  const rename = page.getByRole("button", { name: "Rename", exact: true });
  await expect(rename).toHaveCSS("color", INK);
  await expect(rename).toHaveCSS("text-decoration-color", CHAMPAGNE);
  await expect(page.getByRole("button", { name: "Remove this booking", exact: true })).toHaveCSS(
    "color",
    ROSE,
  );
});

test("a text link with a path goes there", async ({ page }) => {
  await openGallery(page);
  await page.getByRole("link", { name: "On the shortlist", exact: true }).click();
  await expect(page).toHaveURL(/\/new\/gallery\/states$/, { timeout: COMPILE_TIMEOUT });
});

test("the direction word flips between Ascending and Descending", async ({ page }) => {
  await openGallery(page);
  await page.getByRole("button", { name: "Ascending", exact: true }).click();
  await expect(page.getByRole("button", { name: "Descending", exact: true })).toBeVisible();
});

test("a choice group moves and chooses with the arrow keys, with one tab stop", async ({
  page,
}) => {
  await openGallery(page);
  const event = page.getByRole("radiogroup", { name: "Event" });
  const akad = event.getByRole("radio", { name: "Akad", exact: true });
  const reception = event.getByRole("radio", { name: "Reception", exact: true });
  const both = event.getByRole("radio", { name: "Both", exact: true });
  await akad.click();
  await expect(akad).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowRight");
  await expect(reception).toBeFocused();
  await expect(reception).toHaveAttribute("aria-checked", "true");
  await expect(reception).toHaveAttribute("tabindex", "0");
  await expect(akad).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("End");
  await expect(both).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowRight");
  await expect(akad).toHaveAttribute("aria-checked", "true");
});

test("a focus row keeps one chip pressed and cuts a long name with an ellipsis", async ({
  page,
}) => {
  await openGallery(page);
  const focus = page.getByRole("group", { name: "Focus on a category" });
  const all = focus.getByRole("button", { name: /^All/ });
  const venue = focus.getByRole("button", { name: /^Venue/ });
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await venue.click();
  await expect(venue).toHaveAttribute("aria-pressed", "true");
  await expect(all).toHaveAttribute("aria-pressed", "false");
  const long = focus.getByRole("button", { name: /^Bespoke tailoring/ });
  await expect(long).toHaveCSS("text-overflow", "ellipsis");
  expect((await long.boundingBox())?.width ?? 0).toBeLessThanOrEqual(280);
});

test("Edit categories is a dashed chip", async ({ page }) => {
  await openGallery(page);
  await expect(
    page.getByRole("group", { name: "Focus on a category" }).getByRole("button", {
      name: "Edit categories",
      exact: true,
    }),
  ).toHaveCSS("border-top-style", "dashed");
});

test("on a phone the focus row scrolls sideways instead of wrapping", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGallery(page);
  const focus = page.getByRole("group", { name: "Focus on a category" });
  await expect(focus).toHaveCSS("overflow-x", "auto");
  expect(await focus.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const rows = await focus
    .getByRole("button")
    .evaluateAll((els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().top))).size);
  expect(rows).toBe(1);
});
