import { expect, test } from "@playwright/test";
import {
  chooseOption,
  editCell,
  expectStored,
  signInAndGoto,
  uniqueName,
  vendorStatusPill,
} from "../helpers";

test("add a vendor, mark it Chosen and see it among the confirmed bookings", async ({
  page,
}) => {
  await signInAndGoto(page, "/vendors");
  await expect(page.getByRole("heading", { name: "Vendors" })).toBeVisible();

  await page.getByRole("button", { name: "Add vendor" }).first().click();

  // A new vendor is called "New Vendor" and starts at Inquiring.
  const newRow = page.getByRole("row").filter({ hasText: "New Vendor" });
  await expect(newRow).toHaveCount(1);
  await expect(vendorStatusPill(newRow)).toContainText("Inquiring");

  const name = uniqueName("Vendor");
  await editCell(
    page,
    newRow.getByRole("button", { name: "New Vendor", exact: true }),
    name,
  );

  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toHaveCount(1);

  // "Add to budget" is for Chosen or Done vendors only.
  const addToBudget = row
    .getByRole("button")
    .filter({ has: page.locator("svg.lucide-piggy-bank") });
  await expect(addToBudget).toHaveCount(0);

  await chooseOption(page, vendorStatusPill(row), "Chosen");
  await expect(vendorStatusPill(row)).toContainText("Chosen");
  await expect(addToBudget).toHaveCount(1);

  // Chosen vendors are listed on Confirmed.
  await expectStored(
    "vendors",
    (d) => d.name === name && d.contractStatus === "Chosen",
  );
  await page.goto("/confirmed");
  await expect(
    page.getByRole("heading", { name: "Confirmed", level: 1 }),
  ).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("button", { name })).toBeVisible();

  // Moving it back to Inquiring takes it off Confirmed again.
  await page.goto("/vendors");
  const again = page.getByRole("row").filter({ hasText: name });
  await chooseOption(page, vendorStatusPill(again), "Inquiring");
  await expect(vendorStatusPill(again)).toContainText("Inquiring");
  await expectStored(
    "vendors",
    (d) => d.name === name && d.contractStatus === "Inquiring",
  );
  await page.goto("/confirmed");
  await expect(
    page.getByRole("heading", { name: "Confirmed", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name })).toHaveCount(0);
});
