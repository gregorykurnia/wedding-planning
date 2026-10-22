import { expect, test } from "@playwright/test";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR } from "../emulator-config";
import {
  columnIndex,
  editCell,
  expectStored,
  signInAndGoto,
  storedDocs,
  uniqueName,
} from "../helpers";

// The emulators are emptied once per run, and later specs (Bookings, Budget)
// count every vendor, so the booking this test adds is removed at the end,
// even when the test fails partway.
let vendorsBefore = new Set<unknown>();

test.beforeAll(async () => {
  vendorsBefore = new Set((await storedDocs("vendors")).map((d) => d.id));
});

test.afterAll(async () => {
  for (const { id } of await storedDocs("vendors")) {
    if (vendorsBefore.has(id)) continue;
    await fetch(
      `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/vendors/${id}`,
      { method: "DELETE", headers: { Authorization: "Bearer owner" } },
    );
  }
});

test("split a confirmed booking into sub-entries and change a payment", async ({
  page,
}) => {
  await signInAndGoto(page, "/old/confirmed");
  await expect(
    page.getByRole("heading", { name: "Confirmed", level: 1 }),
  ).toBeVisible();

  // "Add vendor" here creates a vendor that is already Chosen, so it is a booking.
  await page.getByRole("button", { name: "Add vendor" }).click();
  const newRow = page.getByRole("row").filter({ hasText: "New Vendor" });
  await expect(newRow).toHaveCount(1);
  const name = uniqueName("Booking");
  await editCell(
    page,
    newRow.getByRole("button", { name: "New Vendor", exact: true }),
    name,
  );

  const booking = page.getByRole("row").filter({ hasText: name });
  await expect(booking).toHaveCount(1);

  const totalCol = await columnIndex(page, "Total price");
  const spentCol = await columnIndex(page, "Budget spent");
  const remainingCol = await columnIndex(page, "Remaining budget");
  const cell = (row: typeof booking, col: number) =>
    row.getByRole("cell").nth(col);

  // Split it into two sub-entries; each starts as "New sub-entry" at price 0.
  await booking.getByRole("button", { name: "Add sub-entry" }).click();
  const first = uniqueName("Deposit");
  await editCell(
    page,
    page.getByRole("button", { name: "New sub-entry", exact: true }),
    first,
  );
  await booking.getByRole("button", { name: "Add sub-entry" }).click();
  const second = uniqueName("Final");
  await editCell(
    page,
    page.getByRole("button", { name: "New sub-entry", exact: true }),
    second,
  );

  const firstRow = page.getByRole("row").filter({ hasText: first });
  const secondRow = page.getByRole("row").filter({ hasText: second });
  await expect(firstRow).toHaveCount(1);
  await expect(secondRow).toHaveCount(1);
  await expect(firstRow.getByText("Sub-entry", { exact: true })).toBeVisible();

  // Amounts on the sub-entries.
  await editCell(
    page,
    cell(firstRow, totalCol).getByRole("button"),
    "1000000",
    cell(firstRow, totalCol).getByRole("button", { name: /Rp\s*1\.000\.000/ }),
  );
  await expect(cell(firstRow, totalCol)).toContainText(/Rp\s*1\.000\.000/);
  await editCell(
    page,
    cell(firstRow, spentCol).getByRole("button"),
    "250000",
    cell(firstRow, spentCol).getByRole("button", { name: /Rp\s*250\.000/ }),
  );
  await expect(cell(firstRow, remainingCol)).toContainText(/Rp\s*750\.000/);
  await editCell(
    page,
    cell(secondRow, totalCol).getByRole("button"),
    "500000",
    cell(secondRow, totalCol).getByRole("button", { name: /Rp\s*500\.000/ }),
  );

  // The booking's own totals become read-only sums of its sub-entries.
  await expect(cell(booking, totalCol)).toContainText(/Rp\s*1\.500\.000/);
  await expect(cell(booking, totalCol).getByRole("button")).toHaveCount(0);
  await expect(cell(booking, spentCol)).toContainText(/Rp\s*250\.000/);
  await expect(cell(booking, remainingCol)).toContainText(/Rp\s*1\.250\.000/);

  // Change a payment: more has been paid on the deposit.
  await editCell(
    page,
    cell(firstRow, spentCol).getByRole("button"),
    "400000",
    cell(firstRow, spentCol).getByRole("button", { name: /Rp\s*400\.000/ }),
  );
  await expect(cell(firstRow, remainingCol)).toContainText(/Rp\s*600\.000/);
  await expect(cell(booking, spentCol)).toContainText(/Rp\s*400\.000/);
  await expect(cell(booking, remainingCol)).toContainText(/Rp\s*1\.100\.000/);

  // It was saved, not only shown.
  await expectStored("vendors", (d) => {
    const entries =
      (d.subEntries as {
        name: string;
        totalPrice: number;
        budgetSpent: number;
      }[]) ?? [];
    return (
      d.name === name &&
      entries.some(
        (e) =>
          e.name === first &&
          e.totalPrice === 1_000_000 &&
          e.budgetSpent === 400_000,
      ) &&
      entries.some((e) => e.name === second && e.totalPrice === 500_000)
    );
  });
  await page.reload();
  const reloaded = page.getByRole("row").filter({ hasText: first });
  await expect(cell(reloaded, spentCol)).toContainText(/Rp\s*400\.000/, {
    timeout: 30_000,
  });

  // Removing a sub-entry takes it off the booking's sums.
  const reloadedSecond = page.getByRole("row").filter({ hasText: second });
  await reloadedSecond.getByRole("button").last().click();
  await expect(page.getByRole("row").filter({ hasText: second })).toHaveCount(
    0,
  );
  await expectStored(
    "vendors",
    (d) => d.name === name && (d.subEntries as unknown[]).length === 1,
  );
  await expect(
    cell(page.getByRole("row").filter({ hasText: name }), totalCol),
  ).toContainText(/Rp\s*1\.000\.000/);
});
