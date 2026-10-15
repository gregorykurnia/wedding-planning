import { expect, test, type Locator, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.4: fields and save-as-you-go, on the gallery's field demo. Saves go to
// a stand-in held in the page (no Firebase here), slowed so "Saving" shows, and
// the demo can be told to make every save fail.

async function openDemo(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery");
  await expect(page.getByRole("group", { name: "Detail screen form" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
}

const form = (page: Page) => page.getByRole("group", { name: "Detail screen form" });
const line = (scope: Locator) => scope.getByRole("status").first();
const row = (scope: Locator, label: string) => scope.getByLabel(label, { exact: true });

// The gallery shows every section's demo on one page, and the upload demo (3.10) has
// a "Demonstration mode" switch too, so the switches are found inside this section.
async function switches(page: Page, name: string, on: boolean) {
  await page
    .locator("#section-3-4")
    .getByRole("group", { name: "Demo switches" })
    .getByLabel(name)
    .setChecked(on);
}

test("a changed field saves on blur: Saving, then Saved, and the value stays", async ({ page }) => {
  await openDemo(page);
  const screen = form(page);
  await expect(line(screen)).toHaveText("Every change saves as you go");

  const second = row(screen, "Second name");
  await second.fill("Isabella");
  // Typing saves nothing yet.
  await expect(line(screen)).toHaveText("Every change saves as you go");
  await second.blur();
  await expect(line(screen)).toHaveText("Saving");
  await expect(line(screen)).toHaveText("Saved");
  await expect(second).toHaveValue("Isabella");
});

test("Enter saves a text field, and leaving it after Enter doesn't save twice", async ({ page }) => {
  await openDemo(page);
  const screen = form(page);
  const first = row(screen, "First name");
  await first.fill("Gregory");
  await first.press("Enter");
  await expect(line(screen)).toHaveText("Saving");
  await first.blur();
  await expect(line(screen)).toHaveText("Saved");
  await expect(first).toHaveValue("Gregory");
});

test("a cleared name comes back instead of saving nothing", async ({ page }) => {
  await openDemo(page);
  const screen = form(page);
  const first = row(screen, "First name");
  await first.fill("");
  await first.blur();
  await expect(first).toHaveValue("Greg");
  await expect(line(screen)).toHaveText("Every change saves as you go");
});

test("a failed save keeps what was typed, rings the field, and Try again saves it", async ({ page }) => {
  await openDemo(page);
  const screen = form(page);
  await switches(page, "Make saves fail", true);

  const second = row(screen, "Second name");
  await second.fill("Isabella");
  await second.blur();
  await expect(line(screen)).toHaveText("1 change not saved");
  await expect(second).toHaveValue("Isabella");
  await expect(second).toHaveAttribute("aria-invalid", "true");
  await expect(screen.getByText("Couldn’t save this change. What you typed is kept.")).toBeVisible();

  // Leaving the field again doesn't try again on its own.
  await second.focus();
  await second.blur();
  await expect(line(screen)).toHaveText("1 change not saved");

  // Fix the cause; Try again clears the ring and runs Saving, then Saved.
  await switches(page, "Make saves fail", false);
  await screen.getByRole("button", { name: "Try again" }).click();
  await expect(line(screen)).toHaveText("Saving");
  await expect(second).not.toHaveAttribute("aria-invalid", "true");
  await expect(line(screen)).toHaveText("Saved");
  await expect(second).toHaveValue("Isabella");
  await expect(screen.getByRole("button", { name: "Try again" })).toHaveCount(0);
});

test("a failed save that fails again keeps the input, and the count follows each field", async ({ page }) => {
  await openDemo(page);
  const screen = form(page);
  await switches(page, "Make saves fail", true);

  await row(screen, "Second name").fill("Isabella");
  await row(screen, "Second name").blur();
  await row(screen, "Kind").selectOption("engagement");
  await expect(line(screen)).toHaveText("2 changes not saved");

  await screen.getByRole("button", { name: "Try again" }).first().click();
  // Still failing: nothing is lost.
  await expect(line(screen)).toHaveText("2 changes not saved");
  await expect(row(screen, "Second name")).toHaveValue("Isabella");
  await expect(row(screen, "Kind")).toHaveValue("engagement");
});

test("money tidies to Rp with dots when left, and words put the old amount back", async ({ page }) => {
  await openDemo(page);
  const screen = form(page);
  const price = row(screen, "Agreed price");
  await expect(price).toHaveValue("Rp 150.000.000");

  await price.fill("12500000");
  await price.blur();
  await expect(price).toHaveValue("Rp 12.500.000");
  await expect(line(screen)).toHaveText("Saved");

  await price.fill("a lot");
  await price.blur();
  await expect(price).toHaveValue("Rp 12.500.000");

  await price.fill("");
  await price.blur();
  await expect(price).toHaveValue("");
  await expect(price).toHaveAttribute("placeholder", "Rp 0");
});

test("a pick, a tick and a step each save at once", async ({ page }) => {
  await openDemo(page);
  const screen = form(page);

  await row(screen, "Kind").selectOption("tea-pai");
  await expect(line(screen)).toHaveText("Saving");
  await expect(line(screen)).toHaveText("Saved");

  await screen.getByRole("checkbox", { name: "Sent" }).check();
  await expect(line(screen)).toHaveText("Saving");
  await expect(line(screen)).toHaveText("Saved");

  const plus = screen.getByRole("group", { name: "Plus-ones" });
  await plus.getByRole("button", { name: "One more" }).click();
  await expect(plus.locator("b")).toHaveText("3");
  await expect(line(screen)).toHaveText("Saving");
  await expect(line(screen)).toHaveText("Saved");
  await expect(screen.getByText("tea-pai, sent, 3 plus-ones.")).toBeVisible();

  // The stepper stops at nothing.
  for (let i = 0; i < 3; i += 1) await plus.getByRole("button", { name: "One fewer" }).click();
  await expect(plus.locator("b")).toHaveText("0");
  await expect(plus.getByRole("button", { name: "One fewer" })).toBeDisabled();
});

test("in demonstration mode every field is disabled and the line says nothing is saved", async ({ page }) => {
  await openDemo(page);
  const screen = form(page);
  await switches(page, "Demonstration mode", true);
  await expect(line(screen)).toHaveText("Demonstration mode: changes aren’t saved");
  await expect(row(screen, "First name")).toBeDisabled();
  await expect(row(screen, "Agreed price")).toBeDisabled();
  await expect(row(screen, "Kind")).toBeDisabled();
  await expect(screen.getByRole("checkbox", { name: "Sent" })).toBeDisabled();
  await expect(screen.getByRole("button", { name: "One more" })).toBeDisabled();
  await expect(screen.getByRole("button", { name: "Add notes" })).toHaveCount(0);
  await expect(screen.getByRole("button", { name: "Edit" })).toHaveCount(0);
});

test("a sheet's line says what failed and carries Try again", async ({ page }) => {
  await openDemo(page);
  const sheet = page.getByRole("group", { name: "Sheet form" });
  await switches(page, "Make saves fail", true);

  const name = row(sheet, "Name");
  await name.fill("Dapur Lestari Kitchen");
  await name.blur();
  await expect(line(sheet)).toContainText("Couldn’t save. What you typed is kept.");
  await expect(name).toHaveValue("Dapur Lestari Kitchen");

  await switches(page, "Make saves fail", false);
  await sheet.getByRole("button", { name: "Try again" }).click();
  await expect(line(sheet)).toHaveText("Saved");
  await expect(name).toHaveValue("Dapur Lestari Kitchen");
});

test("inline rename: Enter saves, Escape cancels, an empty name is a cancel, and a failure keeps the input", async ({
  page,
}) => {
  await openDemo(page);
  const demo = page.getByRole("group", { name: "Inline rename demo" });
  const name = demo.getByTestId("funder-name");

  await demo.getByRole("button", { name: "Rename" }).click();
  const input = demo.getByLabel("Funder’s name");
  await expect(input).toBeFocused();
  await input.fill("Gregory");
  await input.press("Escape");
  await expect(name).toHaveText("Greg");

  await demo.getByRole("button", { name: "Rename" }).click();
  await demo.getByLabel("Funder’s name").fill("   ");
  await demo.getByLabel("Funder’s name").press("Enter");
  await expect(name).toHaveText("Greg");

  await switches(page, "Make saves fail", true);
  await demo.getByRole("button", { name: "Rename" }).click();
  await demo.getByLabel("Funder’s name").fill("Gregory");
  await demo.getByLabel("Funder’s name").press("Enter");
  await expect(demo.getByRole("button", { name: "Saving" })).toBeDisabled();
  await expect(demo.getByRole("alert")).toContainText("What you typed is kept.");
  await expect(demo.getByLabel("Funder’s name")).toHaveValue("Gregory");

  await switches(page, "Make saves fail", false);
  await demo.getByRole("button", { name: "Try again" }).click();
  await expect(name).toHaveText("Gregory");
});

test("the big input follows what is typed and tidies on blur", async ({ page }) => {
  await openDemo(page);
  const demo = page.getByRole("group", { name: "Big input demo" });
  const amount = demo.getByLabel("Amount paid");
  await expect(amount).toHaveValue("Rp 48.000.000");

  await amount.fill("75000000");
  await expect(demo.getByText("Read as Rp 75.000.000; Rp 0 would be left.")).toBeVisible();
  await amount.blur();
  await expect(amount).toHaveValue("Rp 75.000.000");
});

test("notes read as text with links that open, and Edit turns them into a textarea with Done", async ({
  page,
}) => {
  await openDemo(page);
  const screen = form(page);
  const link = screen.getByRole("link", { name: "example.com/menu" });
  await expect(link).toHaveAttribute("href", "https://example.com/menu");
  await expect(link).toHaveAttribute("target", "_blank");

  await screen.getByRole("button", { name: "Edit" }).click();
  const box = screen.getByRole("textbox", { name: "Notes" });
  await expect(box).toBeFocused();
  await box.fill("Changed my mind.");
  await screen.getByRole("button", { name: "Done" }).click();
  await expect(screen.getByText("Changed my mind.")).toBeVisible();
  await expect(line(screen)).toHaveText("Saved");

  // Empty notes say so and offer Add notes.
  await screen.getByRole("button", { name: "Edit" }).click();
  await screen.getByRole("textbox", { name: "Notes" }).fill("");
  await screen.getByRole("button", { name: "Done" }).click();
  await expect(screen.getByText("Nothing written yet.")).toBeVisible();
  await expect(screen.getByRole("button", { name: "Add notes" })).toBeVisible();
});

test("on a phone the label sits above the value", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page);
  const screen = form(page);
  const label = screen.getByText("First name", { exact: true });
  const input = row(screen, "First name");
  const [l, i] = await Promise.all([label.boundingBox(), input.boundingBox()]);
  expect(l && i && l.y + l.height <= i.y + 1).toBe(true);
});
