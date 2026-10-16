import { expect, test, type Locator, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.8: the sheet frames, the inline and blocked confirms, and the banners and
// problem boxes, in their section of the component gallery. The model test in
// tests/model/sheet-patterns.test.tsx checks the markup.

// Opens the gallery and returns Task 3.8's section. The sheets it opens are
// dialogs on the page, so every locator here starts from the section.
async function openSection(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery");
  const section = page.locator("#section-3-8");
  await expect(section.getByRole("heading", { name: "Create sheet", exact: true })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
  // Hydration runs in document order and dev mode re-renders once more when its
  // chunks arrive, so wait for the section's last button to get its handlers and
  // for the requests to settle. A press made before that does nothing, as for a
  // real visitor.
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (el) =>
        el.textContent?.trim() === "Delete the Catering folder" &&
        Object.keys(el).some((key) => key.startsWith("__reactProps")),
    ),
  );
  await page.waitForLoadState("networkidle");
  return section;
}

// The gallery's switches sit under an open sheet's scrim, where a normal click
// can't reach them, so a switch is set with a click event on the box itself.
async function setSwitch(section: Locator, label: string, on: boolean) {
  const box = section.getByLabel(label);
  if ((await box.isChecked()) !== on) await box.dispatchEvent("click");
}

// Colours worked out by hand from tokens.css: --accent-attention-text #b8355b and
// --accent-gold-text-on-tint #7d5f27.
const ROSE = "rgb(184, 53, 91)";
const GOLD_INK = "rgb(125, 95, 39)";

test("a create sheet in demonstration mode says adding is off, and its primary is disabled", async ({
  page,
}) => {
  const section = await openSection(page);
  await section.getByRole("button", { name: "Add a booking in demonstration mode" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a booking" });
  await expect(dialog).toContainText("Demonstration mode: adding is turned off.");
  await expect(dialog.getByRole("button", { name: "Add a booking", exact: true })).toBeDisabled();
});

test("Cancel closes a create sheet, and focus goes back to the button that opened it", async ({
  page,
}) => {
  const section = await openSection(page);
  const opener = section.getByRole("button", { name: "Add a booking", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Add a booking" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("a create that fails keeps what was typed, shows the rose box and offers Try again", async ({
  page,
}) => {
  const section = await openSection(page);
  await setSwitch(section, "Make saves fail", true);
  await section.getByRole("button", { name: "Add a booking", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a booking" });
  const name = dialog.getByRole("textbox", { name: "Name" });
  await name.fill("Kebun Bunga Atelier");
  await dialog.getByRole("button", { name: "Add a booking", exact: true }).click();
  await expect(dialog).toContainText("The booking wasn’t added: the planner lost its connection.");
  await expect(name).toHaveValue("Kebun Bunga Atelier");
  await setSwitch(section, "Make saves fail", false);
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog).toBeHidden({ timeout: COMPILE_TIMEOUT });
});

test("an edit sheet holds Escape while a save runs, and Done waits for a change that didn't save", async ({
  page,
}) => {
  const section = await openSection(page);
  await setSwitch(section, "Slow saves", true);
  await section.getByRole("button", { name: "Edit a vendor" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit the vendor" });
  const name = dialog.getByRole("textbox", { name: "Name" });
  const done = dialog.getByRole("button", { name: "Done", exact: true });

  await name.fill("Bunga Melati Florist 2");
  await name.press("Enter");
  await expect(dialog).toContainText("Saving");
  await expect(done).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Saved", { timeout: COMPILE_TIMEOUT });
  await expect(done).toBeEnabled();

  await setSwitch(section, "Make saves fail", true);
  await name.fill("Bunga");
  await name.press("Enter");
  await expect(dialog).toContainText("Couldn’t save. What you typed is kept.", {
    timeout: COMPILE_TIMEOUT,
  });
  await expect(done).toBeDisabled();
  await expect(name).toHaveValue("Bunga");

  await setSwitch(section, "Make saves fail", false);
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog).toContainText("Saved", { timeout: COMPILE_TIMEOUT });
  await done.click();
  await expect(dialog).toBeHidden();
});

test("the categories sheet turns a row into its inline confirm, and keeps the row when a removal fails", async ({
  page,
}) => {
  const section = await openSection(page);
  await section.getByRole("button", { name: "Edit categories" }).click();
  const dialog = page.getByRole("dialog", { name: "Vendor categories" });
  const florist = dialog.getByRole("listitem").first();

  await florist.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(florist).toContainText("Remove Florist? Its 4 vendors move to Other.");
  await florist.getByRole("button", { name: "Keep it" }).click();
  await expect(florist).toContainText("Florist, 4 vendors");

  await setSwitch(section, "Make saves fail", true);
  await florist.getByRole("button", { name: "Remove", exact: true }).click();
  await florist.getByRole("button", { name: "Remove category" }).click();
  await expect(florist.getByRole("alert")).toHaveText(
    "Couldn’t do that. Nothing was changed. Try again.",
  );
  await expect(florist).toContainText("Remove Florist?");

  await setSwitch(section, "Make saves fail", false);
  await setSwitch(section, "Slow saves", true);
  await florist.getByRole("button", { name: "Remove category" }).click();
  await expect(florist.getByRole("button", { name: "Removing" })).toBeVisible();
  await expect(dialog.getByRole("listitem").first()).toContainText("Catering, 2 vendors", {
    timeout: COMPILE_TIMEOUT,
  });
});

test("a blocked notice names what is in the way, and OK closes it and returns focus", async ({
  page,
}) => {
  const section = await openSection(page);
  const opener = section.getByRole("button", { name: "Delete the Catering folder" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Empty Catering first" });
  await expect(dialog).toContainText("It still holds 4 files and 1 folder.");
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("the banners and problem boxes keep their tones: rose for errors, gold for the calm notes", async ({
  page,
}) => {
  const section = await openSection(page);
  const error = section.getByRole("alert");
  await expect(error).toContainText("That email and password don’t match");
  expect(await error.evaluate((el) => getComputedStyle(el).color)).toBe(ROSE);

  const calm = section.getByText("You’re offline.");
  await expect(calm).toBeVisible();
  expect(await calm.evaluate((el) => getComputedStyle(el).color)).toBe(GOLD_INK);

  const gold = section.getByText("Demonstration mode. The planner");
  expect(await gold.evaluate((el) => getComputedStyle(el).color)).toBe(GOLD_INK);

  const rose = section.getByText("The booking wasn’t added");
  expect(await rose.evaluate((el) => getComputedStyle(el).color)).toBe(ROSE);
});
