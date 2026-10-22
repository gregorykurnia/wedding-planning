import { expect, test } from "@playwright/test";
import {
  chooseOption,
  editCell,
  expectStored,
  signInAndGoto,
  uniqueName,
} from "../helpers";

test("add a venue and mark it Booked", async ({ page }) => {
  await signInAndGoto(page, "/old/venues");
  await expect(page.getByRole("heading", { name: "Venues" })).toBeVisible();

  await page.getByRole("button", { name: "Add venue" }).click();

  // A new venue is called "New Venue" and starts at Shortlist.
  const newRow = page.getByRole("row").filter({ hasText: "New Venue" });
  await expect(newRow).toHaveCount(1);
  await expect(newRow.getByRole("combobox")).toContainText("Shortlist");

  const name = uniqueName("Venue");
  await editCell(
    page,
    newRow.getByRole("button", { name: "New Venue", exact: true }),
    name,
  );

  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toHaveCount(1);

  // "Add to budget" only exists once the venue is Booked.
  const addToBudget = row
    .getByRole("button")
    .filter({ has: page.locator("svg.lucide-piggy-bank") });
  await expect(addToBudget).toHaveCount(0);

  await chooseOption(page, row.getByRole("combobox"), "Booked");
  await expect(row.getByRole("combobox")).toContainText("Booked");
  await expect(addToBudget).toHaveCount(1);

  // The change is saved, not just shown: it survives a reload.
  await expectStored("venues", (d) => d.name === name && d.status === "Booked");
  await page.reload();
  const reloaded = page.getByRole("row").filter({ hasText: name });
  await expect(reloaded.getByRole("combobox")).toContainText("Booked");
});
