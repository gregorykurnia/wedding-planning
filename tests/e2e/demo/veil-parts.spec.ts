import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.6: parts, menu cards, packages, the tally and the carry lines, in the
// component gallery. "Today" in the demo is Wednesday 14 October 2026.

async function openSection(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery");
  await expect(page.locator("#section-3-6")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page.locator("#section-3-6");
}

const itemWith = (section: ReturnType<Page["locator"]>, text: string) =>
  section.getByRole("listitem").filter({ hasText: text });

test("a ledger row says where each part stands: rose when late or overpaid, sage when paid", async ({ page }) => {
  const section = await openSection(page);
  await expect(section.getByText("Rp 25.000.000, was due 10 Oct", { exact: true })).toHaveCSS("color", "rgb(184, 53, 91)");
  await expect(section.getByText("paid Rp 25.000.000", { exact: true })).toHaveCSS("color", "rgb(79, 107, 85)");
  await expect(section.getByText("overpaid by Rp 1.000.000", { exact: true }).first()).toHaveCSS("color", "rgb(184, 53, 91)");
});

test("over five parts, the first four still owing are shown and the rest are counted", async ({ page }) => {
  const section = await openSection(page);
  await expect(section.getByText("Catering, first instalment")).toBeVisible();
  await expect(section.getByText("Photographer")).toBeVisible();
  await expect(section.getByText("Venue deposit")).toHaveCount(0);
  await expect(section.getByText("Lighting", { exact: true })).toHaveCount(0);
  await expect(section.getByText("and 3 more parts")).toBeVisible();
});

test("a part opens from its summary, from the keyboard too, and shows what's inside", async ({ page }) => {
  const section = await openSection(page);
  const parts = section.getByRole("list", { name: "Parts on the booking" });
  const deposit = parts.locator("details").nth(0);
  await expect(deposit).not.toHaveAttribute("open", "");
  await deposit.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(deposit).toHaveAttribute("open", "");
  await expect(deposit.getByText("The part’s fields, files and actions go here.")).toBeVisible();
  // The balance is open from the start: it was given defaultOpen.
  await expect(parts.locator("details").nth(1)).toHaveAttribute("open", "");
});

test("the preferred option says so in gold; leaning towards another moves it", async ({ page }) => {
  const section = await openSection(page);
  const silver = itemWith(section, "Silver package");
  const gold = itemWith(section, "Gold package");
  await expect(gold.getByText("The one we’re leaning towards")).toBeVisible();
  await silver.getByRole("button", { name: "Lean towards this one" }).click();
  await expect(silver.getByText("The one we’re leaning towards")).toBeVisible();
  await expect(gold.getByRole("button", { name: "Lean towards this one" })).toBeVisible();
  // Exact: the preferred package's hidden ", the one we’re leaning towards" isn't this line.
  await expect(section.getByText("The one we’re leaning towards", { exact: true })).toHaveCount(1);
});

test("remove takes a price option away, and edit says which one", async ({ page }) => {
  const section = await openSection(page);
  await itemWith(section, "Build your own").getByRole("button", { name: "Edit" }).click();
  await expect(section.getByRole("status")).toHaveText("Editing Build your own");
  await itemWith(section, "Build your own").getByRole("button", { name: "Remove" }).click();
  // The status line still names it ("Editing Build your own"), so match the name exactly.
  await expect(section.getByText("Build your own", { exact: true })).toHaveCount(0);
});

test("the headcounts and the carry lines show their numbers and what's left out", async ({ page }) => {
  const section = await openSection(page);
  await expect(section.getByText("142", { exact: true })).toBeVisible();
  await expect(section.getByText("of which, if space allows")).toBeVisible();
  await expect(section.getByText("+ Rp 12.000.000")).toBeVisible();
  await expect(section.getByText("and 1 more funder")).toBeVisible();
});
