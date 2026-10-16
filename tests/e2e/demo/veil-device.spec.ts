import { expect, test, type Locator, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.9: the stage thread, its chips, the keen heart, the WhatsApp link, the
// install card and the notification state in the component gallery. Everything
// is held in the page, so a test changes nothing anywhere.

async function openSection(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery");
  await expect(page.locator("#section-3-9")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page.locator("#section-3-9");
}

// The gold and the track colour of a dash, as the browser computes them.
const GOLD = "rgb(198, 164, 102)";
const TRACK = "rgb(244, 234, 215)";
const ROSE = "rgb(217, 70, 111)";
const ROSE_INK = "rgb(184, 53, 91)";

const dashColours = (line: Locator) => line.locator("i").evaluateAll((dashes) => dashes.map((dash) => getComputedStyle(dash).backgroundColor));

test.describe("stage thread and chips", () => {
  test("the dashes fill up to the stage, and ruled out has none", async ({ page }) => {
    const section = await openSection(page);
    const now = section.locator("p", { hasText: "Stage now:" });
    await expect(now).toContainText("Considering");
    expect(await dashColours(now)).toEqual([GOLD, GOLD, GOLD, TRACK, TRACK]);

    const ruledOut = section.getByRole("list", { name: "Vendor stages" }).locator("li").last();
    await expect(ruledOut).toHaveText("Ruled out");
    await expect(ruledOut.locator("span").first()).toHaveCSS("font-style", "italic");
    await expect(ruledOut.locator("i")).toHaveCount(0);
  });

  test("a venue's threads run four steps, and every step is filled once it's booked", async ({ page }) => {
    const section = await openSection(page);
    const booked = section.getByRole("list", { name: "Venue stages" }).locator("li").nth(3);
    await expect(booked).toHaveText("Booked");
    expect(await dashColours(booked)).toEqual([GOLD, GOLD, GOLD, GOLD]);
  });

  test("choosing a stage sets the thread and counts the choice; the arrow keys move and choose", async ({ page }) => {
    const section = await openSection(page);
    const group = section.getByRole("radiogroup", { name: "Stage of Kebun Bunga Atelier" });
    await group.getByRole("radio", { name: "Done" }).click();
    await expect(group.getByRole("radio", { name: "Done" })).toHaveAttribute("aria-checked", "true");
    await expect(section.locator("p", { hasText: "Stage now:" })).toContainText("Done");
    await expect(section.getByText("Choices so far: 1")).toBeVisible();

    await group.getByRole("radio", { name: "Done" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Ruled out" })).toHaveAttribute("aria-checked", "true");
    await expect(section.getByText("Choices so far: 2")).toBeVisible();
  });
});

test.describe("keen heart", () => {
  test("toggles between keen and not, labelled by the vendor, and toasts the change", async ({ page }) => {
    const section = await openSection(page);
    const heart = section.getByRole("button", { name: "Keen on Kebun Bunga Atelier" });
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await expect(heart).toHaveCSS("color", ROSE);

    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("Unmarked Kebun Bunga Atelier", { exact: true })).toBeVisible();

    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Marked Kebun Bunga Atelier as one you’re keen on")).toBeVisible();
  });
});

test.describe("WhatsApp link", () => {
  test("opens the number on wa.me in a new tab, and a missing number draws no link", async ({ page }) => {
    const section = await openSection(page);
    const row = section.getByRole("link", { name: "WhatsApp", exact: true });
    await expect(row).toHaveAttribute("href", "https://wa.me/6281234567890");
    await expect(row).toHaveAttribute("target", "_blank");
    await expect(row).toHaveAttribute("rel", "noopener");

    const detail = section.getByRole("link", { name: "Message on WhatsApp" });
    await expect(detail).toHaveAttribute("href", "https://wa.me/6281234567890");
    await expect(section.getByRole("link", { name: /WhatsApp/ })).toHaveCount(2);
  });
});

test.describe("install card", () => {
  test("Show me how links to the install steps, and Not now hides the card until it's shown again", async ({ page }) => {
    const section = await openSection(page);
    const suggestion = section.getByText("Add the planner to your home screen to open it like an app.");
    await expect(section.getByRole("link", { name: "Show me how" })).toHaveAttribute("href", "#install");

    await section.getByRole("button", { name: "Not now" }).click();
    await expect(suggestion).toHaveCount(0);

    await section.getByRole("button", { name: "Show the install card again" }).click();
    await expect(suggestion).toBeVisible();
  });
});

test.describe("notification state", () => {
  test("allowing shows reminders arriving and a test button in settings; the sheet has no test", async ({ page }) => {
    const section = await openSection(page);
    await expect(section.getByText("Not allowed yet on this")).toHaveCount(2);

    // Settings comes first on the page, the event sheet's link second.
    await section.getByRole("button", { name: "Allow notifications" }).first().click();
    await expect(section.getByText("and your other devices, even when the planner is closed.")).toHaveCount(2);
    await expect(section.getByRole("button", { name: "Send a test reminder" })).toHaveCount(1);

    await section.getByRole("button", { name: "Send a test reminder" }).click();
    await expect(section.getByText("Test reminders sent: 1")).toBeVisible();
  });

  test("turned off is rose and says where to turn notifications on", async ({ page }) => {
    const section = await openSection(page);
    await section.getByRole("radio", { name: "Turned off" }).click();
    const off = section.locator("p", { hasText: "Turned off for the planner on this" }).first();
    await expect(off).toBeVisible();
    await expect(off).toHaveCSS("color", ROSE_INK);
    await expect(off).toContainText("the browser’s site settings for the planner");
  });

  test("the word phone or computer follows the width, as the offline copy does", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const section = await openSection(page);
    await expect(section.getByText("phone", { exact: true }).first()).toBeVisible();
    await expect(section.getByText("computer", { exact: true }).first()).toBeHidden();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(section.getByText("computer", { exact: true }).first()).toBeVisible();
    await expect(section.getByText("phone", { exact: true }).first()).toBeHidden();
  });
});

test("demonstration mode makes every control in the section inert", async ({ page }) => {
  const section = await openSection(page);
  // Each half of the section has its own switch: the stage part first, the device part second.
  const switches = section.getByRole("button", { name: "Demonstration mode" });
  await switches.first().click();
  await switches.last().click();
  await expect(section.getByRole("radio", { name: "Done" })).toBeDisabled();
  await expect(section.getByRole("button", { name: "Keen on Kebun Bunga Atelier" })).toBeDisabled();
  // "Allowed" is also a substring of "Not yet allowed", so the name must be exact.
  await expect(section.getByRole("radio", { name: "Allowed", exact: true })).toBeDisabled();
  await expect(section.getByRole("button", { name: "Allow notifications" }).first()).toBeDisabled();
});
