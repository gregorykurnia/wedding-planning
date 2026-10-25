import { expect, test, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 3.12: task, item and guest rows in the component gallery. Everything is
// held in the page, so a test changes nothing anywhere. "Today" in the demo is
// Wednesday 14 October 2026.

async function openSection(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/gallery");
  await expect(page.locator("#section-3-12")).toBeVisible({ timeout: COMPILE_TIMEOUT });
  return page.locator("#section-3-12");
}

const log = (section: ReturnType<Page["locator"]>) => section.getByRole("status").first();
const itemRows = (section: ReturnType<Page["locator"]>) => section.locator("[data-item-id]");
const names = async (section: ReturnType<Page["locator"]>) =>
  itemRows(section).evaluateAll((rows) => rows.map((row) => (row.querySelector("[data-item-name]") as HTMLInputElement).value));

test.describe("task rows", () => {
  test("a task is a disclosure; the tick finishes it without opening or closing it", async ({ page }) => {
    const section = await openSection(page);
    const row = section.locator('[data-task-id="t2"]');
    await expect(row).not.toHaveAttribute("open", "");
    await expect(row).toContainText("2 days late");
    await expect(row).toContainText("Ask Bella for the final list first.");

    await row.getByRole("checkbox", { name: "Finish Send the save-the-dates" }).click();
    await expect(log(section)).toHaveText("Finished Send the save-the-dates");
    // It moved to the finished tasks, still closed.
    await expect(section.getByLabel("Open tasks").getByText("Send the save-the-dates")).toHaveCount(0);
    await section.getByText("Show 2 finished tasks").click();
    const finished = section.locator('[data-task-id="t2"]');
    await expect(finished).not.toHaveAttribute("open", "");
    await expect(finished.getByRole("checkbox", { name: "Reopen Send the save-the-dates" })).toHaveAttribute("aria-checked", "true");
    await expect(finished).toContainText("Done 14 Oct");
  });

  test("an open task shows its steps, the thread and the steps line, which follow a tick", async ({ page }) => {
    const section = await openSection(page);
    const row = section.locator('[data-task-id="t1"]');
    await expect(row).toHaveAttribute("open", "");
    await expect(row).toContainText("2 of 3 steps done");
    await expect(row.getByRole("img", { name: "67% of steps done" })).toBeVisible();
    await expect(row.getByLabel("Step", { exact: true })).toHaveCount(3);

    await row.getByRole("checkbox", { name: "Step done: Buy the tickets" }).check();
    await expect(row).toContainText("3 of 3 steps done");
    await expect(row.getByRole("img", { name: "100% of steps done" })).toBeVisible();
  });

  test("Add a step puts the cursor in the new step; Remove step takes one away", async ({ page }) => {
    const section = await openSection(page);
    const row = section.locator('[data-task-id="t1"]');
    await row.getByRole("button", { name: "Add a step" }).click();
    const steps = row.getByLabel("Step", { exact: true });
    await expect(steps).toHaveCount(4);
    await expect(steps.last()).toBeFocused();

    await row.getByRole("button", { name: "Remove step" }).first().click();
    await expect(steps).toHaveCount(3);
  });

  test("a step that doesn't save keeps what was typed, shows the failed line and saves on Try again", async ({ page }) => {
    const section = await openSection(page);
    const row = section.locator('[data-task-id="t1"]');
    await section.getByLabel("Make saves fail").check();

    const title = row.getByLabel("Step", { exact: true }).nth(2);
    await title.fill("Buy the tickets with miles");
    await title.press("Enter");
    const line = row.getByRole("alert");
    await expect(line).toContainText("Couldn’t save this step. What you typed is kept.");
    await expect(title).toHaveValue("Buy the tickets with miles");
    await expect(title).toHaveAttribute("aria-invalid", "true");

    await section.getByLabel("Make saves fail").uncheck();
    await line.getByRole("button", { name: "Try again" }).click();
    await expect(row.getByRole("alert")).toHaveCount(0);
    await expect(log(section)).toHaveText("Saved the step “Buy the tickets with miles”");
  });

  test("demonstration mode makes the controls inert", async ({ page }) => {
    const section = await openSection(page);
    await section.getByLabel("Demonstration mode").check();
    const row = section.locator('[data-task-id="t1"]');
    await expect(row.getByLabel("Step", { exact: true }).first()).toBeDisabled();
    await expect(row.getByRole("checkbox", { name: "Finish Book the honeymoon flights" })).toHaveAttribute("aria-disabled", "true");
  });
});

test.describe("item rows", () => {
  test("Alt+↓ and Alt+↑ on the handle move the row and keep focus on the handle", async ({ page }) => {
    const section = await openSection(page);
    const first = await names(section);
    const handle = itemRows(section).first().getByRole("button", { name: /^Move Wedding cake/ });
    await handle.focus();
    await page.keyboard.press("Alt+ArrowDown");
    expect((await names(section)).slice(0, 2)).toEqual([first[1], first[0]]);
    await expect(section.locator('[data-item-id="i1"] [data-handle]')).toBeFocused();
    await expect(section.getByText("Wedding cake moved to 2 of 6")).toBeAttached();

    await page.keyboard.press("Alt+ArrowUp");
    expect(await names(section)).toEqual(first);
    await expect(section.locator('[data-item-id="i1"] [data-handle]')).toBeFocused();

    // Not past the top.
    await page.keyboard.press("Alt+ArrowUp");
    expect(await names(section)).toEqual(first);
  });

  test("dragging a row by its handle moves it, with a rose line while it is over another row", async ({ page }) => {
    // Tall enough for both rows: Playwright scrolls to the target mid-drag, and the drag then starts from the wrong row.
    await page.setViewportSize({ width: 1280, height: 1000 });
    const section = await openSection(page);
    const before = await names(section);
    const from = section.locator('[data-item-id="i6"]');
    const target = section.locator('[data-item-id="i2"]');
    await from.scrollIntoViewIfNeeded();

    await from.getByRole("button", { name: /^Move Ring bearer/ }).dragTo(target, { targetPosition: { x: 200, y: 4 } });
    const after = await names(section);
    expect(after).toEqual([before[0], before[5], before[1], before[2], before[3], before[4]]);
    await expect(section.locator("[data-item-id].dragging, [data-item-id][class*='dragging']")).toHaveCount(0);
  });

  test("the drop line shows above or below the row the pointer is over, and the dragged row fades", async ({ page }) => {
    const section = await openSection(page);
    // Two neighbours, so both are on screen at once.
    const from = section.locator('[data-item-id="i3"]');
    const target = section.locator('[data-item-id="i2"]');
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    const handleBox = (await from.getByRole("button", { name: /^Move Groom’s father’s suit/ }).boundingBox())!;

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    // The browser reports "over" on the next move after it reports "enter", so each stop ends with a nudge.
    await page.mouse.move(box.x + 300, box.y + box.height - 4, { steps: 8 });
    await page.mouse.move(box.x + 302, box.y + box.height - 4);
    await expect(target).toHaveClass(/dropBelow/);
    await expect(from).toHaveClass(/dragging/);
    await page.mouse.move(box.x + 300, box.y + 4, { steps: 4 });
    await page.mouse.move(box.x + 302, box.y + 4);
    await expect(target).toHaveClass(/dropAbove/);
    await page.mouse.up();
    await expect(section.locator("[class*='dropAbove'], [class*='dropBelow']")).toHaveCount(0);
  });

  test("a sort takes the handles away and nothing can be dragged", async ({ page }) => {
    const section = await openSection(page);
    await expect(section.getByRole("button", { name: /^Move Wedding cake/ })).toBeVisible();
    await section.getByLabel("A sort is on").check();
    await expect(section.getByRole("button", { name: /^Move / })).toHaveCount(0);
    await expect(itemRows(section).first()).not.toHaveAttribute("draggable", "true");
    // The menu has no Move up or Move down either.
    await itemRows(section).first().getByRole("button", { name: /^More for/ }).click();
    await expect(section.getByRole("menuitem", { name: "Move up" })).toHaveCount(0);
    await expect(section.getByRole("menuitem", { name: "Remove" })).toBeVisible();
  });

  test("the ⋯ menu opens on its first entry, moves with the arrow keys and closes on Escape with focus back", async ({ page }) => {
    const section = await openSection(page);
    const row = section.locator('[data-item-id="i2"]');
    const more = row.getByRole("button", { name: "More for Bride’s gown" });
    await more.click();
    const menu = row.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText(["Add an item below", "Add several below", "Move up", "Move down", "Remove"]);
    await expect(menu.getByRole("menuitem", { name: "Add an item below" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Add several below" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitem", { name: "Remove" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(more).toBeFocused();

    // Move down from the menu keeps focus on the menu button.
    await more.click();
    await menu.getByRole("menuitem", { name: "Move down" }).click();
    expect((await names(section)).slice(0, 3)).toEqual(["Wedding cake", "Groom’s father’s suit", "Bride’s gown"]);
  });

  test("star and tick press with aria-pressed; the star adds the item to the work-on-next card", async ({ page }) => {
    const section = await openSection(page);
    const card = section.getByRole("region", { name: "To work on next" });
    await expect(card.getByRole("button")).toHaveText(["Wedding cake", "Photo booth"]);

    const row = section.locator('[data-item-id="i3"]');
    const star = row.getByRole("button", { name: "Work on next: Groom’s father’s suit" });
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByRole("button", { name: "Groom’s father’s suit" })).toBeVisible();

    const tick = row.getByRole("button", { name: "Confirmed: Groom’s father’s suit" });
    await tick.click();
    await expect(tick).toHaveAttribute("aria-pressed", "true");
    // The row marked to work on next has the champagne edge.
    await expect(row).toHaveClass(/next/);
  });

  test("a pill in the card scrolls to its row and puts the cursor in the item's name", async ({ page }) => {
    const section = await openSection(page);
    await section.getByRole("region", { name: "To work on next" }).getByRole("button", { name: "Photo booth" }).click();
    await expect(section.locator('[data-item-id="i5"] [data-item-name]')).toBeFocused();
    await expect(section.locator('[data-item-id="i5"]')).toHaveClass(/flash/);
  });

  test("event chips toggle with aria-pressed and the people menu ticks several people", async ({ page }) => {
    const section = await openSection(page);
    const row = section.locator('[data-item-id="i1"]');
    const sangjit = row.getByRole("group", { name: "Events for Wedding cake" }).getByRole("button", { name: "Sangjit" });
    await expect(sangjit).toHaveAttribute("aria-pressed", "false");
    await sangjit.click();
    await expect(sangjit).toHaveAttribute("aria-pressed", "true");

    // N12: a menu of checks. Ticking people clears General, and each tick saves at once.
    await row.getByText("General", { exact: true }).click();
    await row.getByRole("checkbox", { name: "Bride's mother" }).check();
    await expect(log(section)).toHaveText("Wedding cake is for Bride's mother");
    await row.getByRole("checkbox", { name: "Groom's father" }).check();
    await expect(log(section)).toHaveText("Wedding cake is for Bride's mother, Groom's father");
    await expect(row.getByText("Bride's mother, Groom's father", { exact: true })).toBeVisible();
    // Clearing everyone means General.
    await row.getByRole("checkbox", { name: "Bride's mother" }).uncheck();
    await row.getByRole("checkbox", { name: "Groom's father" }).uncheck();
    await expect(log(section)).toHaveText("Wedding cake is for General");
  });

  test("a vendor that doesn't save keeps what was typed, rings the field and saves on Try again", async ({ page }) => {
    const section = await openSection(page);
    const row = section.locator('[data-item-id="i5"]');
    await section.getByLabel("Make saves fail").check();
    const vendor = row.getByLabel("Vendor for Photo booth");
    await vendor.fill("Bespoke Tailor Bali Ltd");
    await vendor.press("Enter");
    await expect(row.getByRole("alert")).toContainText("Couldn’t save “Bespoke Tailor Bali Ltd”. What you typed is kept.");
    await expect(vendor).toHaveAttribute("aria-invalid", "true");
    await expect(vendor).toHaveValue("Bespoke Tailor Bali Ltd");

    await section.getByLabel("Make saves fail").uncheck();
    await row.getByRole("button", { name: "Try again" }).click();
    await expect(row.getByRole("alert")).toHaveCount(0);
    await expect(log(section)).toHaveText("Vendor for Photo booth: Bespoke Tailor Bali Ltd");
  });

  test("a star that doesn't save keeps the choice, rings it and saves on Try again", async ({ page }) => {
    const section = await openSection(page);
    const row = section.locator('[data-item-id="i6"]');
    await section.getByLabel("Make saves fail").check();
    const star = row.getByRole("button", { name: "Work on next: Ring bearer’s pillow" });
    await star.click();
    await expect(row.getByRole("alert")).toContainText("Couldn’t save the change to Ring bearer’s pillow. Your choice is kept.");
    await expect(star).toHaveAttribute("aria-pressed", "true");
    await expect(star).toHaveCSS("box-shadow", /1px/);

    await section.getByLabel("Make saves fail").uncheck();
    await row.getByRole("button", { name: "Try again" }).click();
    await expect(row.getByRole("alert")).toHaveCount(0);
    await expect(star).toHaveAttribute("aria-pressed", "true");
    await expect(log(section)).toHaveText("Ring bearer’s pillow: work on next on");
  });

  test("an emptied name comes back instead of saving nothing", async ({ page }) => {
    const section = await openSection(page);
    const name = section.locator('[data-item-id="i6"] [data-item-name]');
    await name.fill("");
    await name.press("Enter");
    await name.blur();
    await expect(name).toHaveValue("Ring bearer’s pillow");
  });

  test("the row stacks on a phone: the name, star, tick and menu share the first line", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    const section = await openSection(page);
    const row = section.locator('[data-item-id="i2"]');
    await row.scrollIntoViewIfNeeded();
    const y = async (locator: ReturnType<Page["locator"]>) => Math.round((await locator.boundingBox())!.y);
    const nameY = await y(row.locator("[data-item-name]"));
    expect(Math.abs((await y(row.getByRole("button", { name: /^Work on next/ }))) - nameY)).toBeLessThan(20);
    expect(Math.abs((await y(row.getByRole("button", { name: /^More for/ }))) - nameY)).toBeLessThan(20);
    // The vendor is on the next line.
    expect(await y(row.getByLabel(/^Vendor for/))).toBeGreaterThan(nameY + 20);
  });
});

test.describe("guest rows", () => {
  test("the number is read as a guest number, and a name with plus-ones shows them", async ({ page }) => {
    const section = await openSection(page);
    const row = section.locator('[data-guest-id="g4"]');
    await expect(row).toContainText("Guest number 12");
    await expect(row).toContainText("Reception if space allows, invitation not sent");
    await expect(section.locator('[data-guest-id="g1"]').getByRole("button", { name: /Hendra Santoso/ })).toContainText("+1");
  });

  test("one tap saves and the toast words are in the log", async ({ page }) => {
    const section = await openSection(page);
    const row = section.locator('[data-guest-id="g2"]');
    await row.getByRole("radio", { name: "Attending", exact: true }).click();
    await expect(row.getByRole("radio", { name: "Attending", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(log(section)).toHaveText("Tante Lily: attending");
    await row.getByRole("radio", { name: "Not attending" }).click();
    await expect(log(section)).toHaveText("Tante Lily: not attending");
  });

  test("the switch is one tab stop; the arrow keys move and choose", async ({ page }) => {
    const section = await openSection(page);
    const group = section.locator('[data-guest-id="g2"]').getByRole("radiogroup", { name: "RSVP for Tante Lily" });
    await group.getByRole("radio", { name: "Waiting" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Attending", exact: true })).toBeFocused();
    await expect(group.getByRole("radio", { name: "Attending", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(group.getByRole("radio", { name: "Waiting" })).toHaveAttribute("tabindex", "-1");
    await page.keyboard.press("End");
    await expect(group.getByRole("radio", { name: "Not attending" })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Waiting" })).toBeFocused();
  });

  test("a reply that doesn't save keeps the choice, shows the failed line and saves on Try again", async ({ page }) => {
    const section = await openSection(page);
    const row = section.locator('[data-guest-id="g2"]');
    await section.getByLabel("Make saves fail").check();
    await row.getByRole("radio", { name: "Attending", exact: true }).click();
    await expect(row.getByRole("alert")).toContainText("Couldn’t save the reply for Tante Lily. Your choice is kept.");
    await expect(row.getByRole("radio", { name: "Attending", exact: true })).toHaveAttribute("aria-checked", "true");

    await section.getByLabel("Make saves fail").uncheck();
    await row.getByRole("button", { name: "Try again" }).click();
    await expect(row.getByRole("alert")).toHaveCount(0);
    await expect(log(section)).toHaveText("Tante Lily: attending");
  });

  test("the name opens the guest, and demonstration mode makes the switch inert", async ({ page }) => {
    const section = await openSection(page);
    await section.locator('[data-guest-id="g3"]').getByRole("button", { name: /Pak Joko Susilo/ }).click();
    await expect(log(section)).toHaveText("Opened Pak Joko Susilo");

    await section.getByLabel("Demonstration mode").check();
    const row = section.locator('[data-guest-id="g2"]');
    await row.getByRole("radio", { name: "Attending", exact: true }).click({ force: true });
    await expect(row.getByRole("radio", { name: "Attending", exact: true })).toHaveAttribute("aria-checked", "false");
  });

  test("the segments grow on a phone", async ({ page }) => {
    const section = await openSection(page);
    const segment = section.locator('[data-guest-id="g2"]').getByRole("radio", { name: "Waiting" });
    const desktop = (await segment.boundingBox())!.height;
    await page.setViewportSize({ width: 390, height: 800 });
    await expect.poll(async () => (await segment.boundingBox())!.height).toBeGreaterThan(desktop + 4);
  });
});
