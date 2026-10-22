import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.11: agenda groups and rows, and the month grid, in the component
// gallery. "Today" in the demo is Wednesday 14 October 2026.

async function openSection(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/gallery");
  await expect(page.locator("#section-3-11")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page.locator("#section-3-11");
}

const rowOf = (section: ReturnType<Page["locator"]>, title: string) =>
  section.getByRole("listitem").filter({ has: section.page().getByText(title, { exact: true }) });

test("groups run Late first, then today, then each day, with their counts and flags", async ({ page }) => {
  const section = await openSection(page);
  const groups = section.getByLabel("Agenda groups");

  const headings = await groups.getByRole("heading", { level: 2 }).allTextContents();
  expect(headings[0]).toBe("Late3 things");
  expect(headings.some((text) => text === "Today, Wednesday 14 OctoberToday")).toBe(true);
  // Days with something on them only: the 15th has nothing.
  expect(headings.join("|")).not.toContain("Tomorrow");
  expect(headings.join("|")).toContain("Friday 16 October");

  const late = rowOf(groups, "Sign the photographer’s contract");
  await expect(late).toContainText("3 days late");
  await expect(late.getByText("11 Oct")).toBeVisible();
  await expect(late).toContainText("Deadline");
});

test("kind labels, times, call links and related links read as designed", async ({ page }) => {
  const section = await openSection(page);
  const groups = section.getByLabel("Agenda groups");

  const call = rowOf(groups, "Call with Laras about the arch");
  await expect(call).toContainText("Vendor call");
  await expect(call).toContainText("15:00");
  await expect(call).toContainText("15:30");
  await expect(call.getByRole("link", { name: "Join the call" })).toHaveAttribute(
    "href",
    "https://meet.google.com/kbn-arch-call",
  );
  await expect(call.getByRole("link", { name: "Kebun Dekor" })).toHaveAttribute("href", "/vendors/kebun");

  const tasting = rowOf(groups, "Tasting at Sendok Emas");
  await expect(tasting).toContainText("Jl. Raya Kerobokan 88, Kerobokan");

  const task = rowOf(groups, "Book the honeymoon flights");
  await expect(task).toContainText("2 of 3 steps done");
  await expect(task.getByRole("link", { name: "Book the honeymoon flights" })).toHaveAttribute(
    "href",
    "/schedule/tasks?open=t1",
  );

  const allDay = rowOf(groups, "Transfer the band’s deposit");
  await expect(allDay).toContainText("All day");
  await expect(allDay).toContainText("Payment");
});

test("a payment links to its booking and offers Record payment, primary once late", async ({ page }) => {
  const section = await openSection(page);
  const groups = section.getByLabel("Agenda groups");

  const late = rowOf(groups, "Kirana Photography");
  await expect(late).toContainText("Rp 20.000.000, paid by Bella");
  await expect(late).toContainText("4 days late");
  await expect(late.getByRole("link", { name: "Kirana Photography" })).toHaveAttribute(
    "href",
    "/budget/bookings/vendor-photo",
  );

  const soon = rowOf(groups, "Dapur Lestari Catering");
  await expect(soon).toContainText("Rp 60.000.000, paid by CK");
  await expect(soon).not.toContainText("late");

  // Primary (filled) when late, quiet (outlined) otherwise.
  const fill = (row: typeof late) =>
    row.getByRole("button", { name: "Record payment" }).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await fill(late)).toBe("rgb(51, 38, 44)");
  expect(await fill(soon)).toBe("rgba(0, 0, 0, 0)");

  await late.getByRole("button", { name: "Record payment" }).click();
  await expect(section.getByRole("status")).toHaveText("Record payment for Kirana Photography");

  // A part keeps its booking's name and its own part name, and no funder says so.
  const part = rowOf(groups, "Kebun Dekor, deposit");
  await expect(part).toContainText("Rp 20.000.000, paid by Gregory");
});

test("an event's title opens it, and completed and cancelled rows are struck through", async ({ page }) => {
  const section = await openSection(page);
  const groups = section.getByLabel("Agenda groups");

  await groups.getByRole("button", { name: "Tasting at Sendok Emas" }).click();
  await expect(section.getByRole("status")).toHaveText("Opened the event Tasting at Sendok Emas");

  for (const [title, word] of [
    ["Walk through the venue", "completed"],
    ["Cake tasting", "cancelled"],
  ]) {
    const row = rowOf(groups, title);
    await expect(row).toContainText(`Appointment, ${word}`);
    await expect(row).not.toContainText("late");
    const line = await row.getByRole("button", { name: title }).evaluate((el) => getComputedStyle(el).textDecorationLine);
    expect(line).toBe("line-through");
  }
});

test("a very long title wraps inside its column", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const section = await openSection(page);
  const row = section.getByRole("listitem").filter({ hasText: "Bring both mums to the fitting" });
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  const title = await row.getByRole("button").boundingBox();
  expect(box && title && title.x + title.width <= box.x + box.width + 1).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the month has a button per day, labelled with everything its marks show", async ({ page }) => {
  const section = await openSection(page);
  const month = section.getByRole("group", { name: "October" });

  await expect(month.getByRole("button")).toHaveCount(31);
  await expect(section.getByRole("heading", { name: "October", exact: true })).toBeVisible();

  await expect(month.getByRole("button", { name: "Wednesday 14 October, today, selected, 2 events" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(month.getByRole("button", { name: "Saturday 31 October, the wedding day, 1 event" })).toBeVisible();
  await expect(month.getByRole("button", { name: "Friday 30 October, nothing" })).toBeVisible();
  // Five things on the 16th: three dots and +2.
  await expect(month.getByRole("button", { name: /^Friday 16 October, 1 payment, 4 events$/ })).toBeVisible();
  await expect(month.getByRole("button", { name: /^Friday 16 October/ }).locator("em")).toHaveText("+2");
});

test("choosing a day presses it and lists its rows, and the keyboard works", async ({ page }) => {
  const section = await openSection(page);
  const month = section.getByRole("group", { name: "October" });
  const chosen = section.getByRole("list", { name: "The chosen day" });

  await month.getByRole("button", { name: /^Friday 16 October/ }).click();
  await expect(month.getByRole("button", { name: /^Friday 16 October.*selected/ })).toHaveAttribute("aria-pressed", "true");
  await expect(month.getByRole("button", { pressed: true })).toHaveCount(1);
  await expect(chosen.getByRole("listitem")).toHaveCount(5);

  await month.getByRole("button", { name: /^Saturday 17 October/ }).focus();
  await page.keyboard.press("Enter");
  await expect(month.getByRole("button", { pressed: true })).toHaveAccessibleName(/^Saturday 17 October.*selected/);
  await expect(chosen.getByRole("listitem")).toHaveCount(1);

  await month.getByRole("button", { name: /^Friday 23 October/ }).click();
  await expect(section.getByText("Nothing on this day.")).toBeVisible();
});

test("Earlier, Later and Back to today move the month and the chosen day", async ({ page }) => {
  const section = await openSection(page);

  await section.getByRole("button", { name: "Later: November" }).click();
  const november = section.getByRole("group", { name: "November" });
  await expect(november.getByRole("button")).toHaveCount(30);
  // 1 November 2026 is a Sunday: six blanks, so the first day is the seventh cell.
  await expect(november.getByRole("button", { name: /^Sunday 1 November/ })).toBeVisible();
  await expect(november.getByRole("button", { pressed: true })).toHaveCount(0);

  await section.getByRole("button", { name: "Later: December" }).click();
  await section.getByRole("button", { name: "Later: January 2027" }).click();
  await expect(section.getByRole("heading", { name: "January 2027" })).toBeVisible();

  await section.getByRole("button", { name: "Back to today" }).click();
  const october = section.getByRole("group", { name: "October" });
  await expect(october.getByRole("button", { name: /^Wednesday 14 October, today, selected/ })).toHaveAttribute("aria-pressed", "true");

  await section.getByRole("button", { name: "Earlier: September" }).click();
  await expect(section.getByRole("group", { name: "September" }).getByRole("button")).toHaveCount(30);
});

test("on a phone the +N and the heart go and the time column narrows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const section = await openSection(page);
  const month = section.getByRole("group", { name: "October" });

  await expect(month.getByRole("button", { name: /^Friday 16 October/ }).locator("em")).toBeHidden();
  const heart = await month
    .getByRole("button", { name: /^Saturday 31 October/ })
    .locator("b")
    .evaluate((el) => getComputedStyle(el, "::after").content);
  expect(heart).toMatch(/^(""|none|normal)$/);

  const row = section.getByLabel("Agenda groups").getByRole("listitem").first();
  const columns = await row.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ")[0]);
  expect(columns).toBe("58px");
});

test("on a desktop the heart shows and the time column is 76px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const section = await openSection(page);
  const month = section.getByRole("group", { name: "October" });
  const heart = await month
    .getByRole("button", { name: /^Saturday 31 October/ })
    .locator("b")
    .evaluate((el) => getComputedStyle(el, "::after").content);
  expect(heart).toContain("♡");
  const row = section.getByLabel("Agenda groups").getByRole("listitem").first();
  expect(await row.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ")[0])).toBe("76px");
});
