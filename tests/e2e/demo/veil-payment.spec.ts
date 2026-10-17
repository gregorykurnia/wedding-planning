import { expect, test, type Locator, type Page } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 4.4: Record a payment, in its section of the component gallery, on fixed
// fake bookings and a stand-in write. The emulator spec runs the real write.

async function openSection(page: Page) {
  await page.goto("/new/sign-in");
  await page.getByRole("button", { name: "Look around" }).click({ timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery");
  const section = page.locator("#section-4-4");
  await expect(section.getByRole("button", { name: "Record payment for Dapur Lestari Catering" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
  // A press made before the button has its handler does nothing, as for a real visitor.
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (el) =>
        el.textContent?.trim() === "Record payment for Dapur Lestari Catering" &&
        Object.keys(el).some((key) => key.startsWith("__reactProps")),
    ),
  );
  await page.waitForLoadState("networkidle");
  return section;
}

// The switches sit under an open sheet's scrim, so one is set with a click event on the box.
async function setSwitch(section: Locator, label: RegExp | string, on: boolean) {
  const box = section.getByLabel(label);
  if ((await box.isChecked()) !== on) await box.dispatchEvent("click");
}

const ROSE = "rgb(184, 53, 91)"; // --accent-attention-text #b8355b

const localToday = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const open = async (page: Page, section: Locator, name = "Record payment for Dapur Lestari Catering") => {
  await section.getByRole("button", { name }).click();
  const dialog = page.getByRole("dialog", { name: "Record a payment" });
  await expect(dialog).toBeVisible();
  return dialog;
};

const amountOf = (dialog: Locator) => dialog.getByLabel("Amount paid");

test("opens on what's left, says it pays in full, and starts with the part's funder and today", async ({ page }) => {
  const section = await openSection(page);
  const dialog = await open(page, section);

  await expect(dialog).toContainText("Dapur Lestari Catering");
  await expect(amountOf(dialog)).toHaveValue("Rp 20.000.000");
  await expect(amountOf(dialog)).toBeFocused();
  await expect(dialog).toContainText("Pays this in full");
  await expect(dialog.getByLabel("Paid on")).toHaveValue(localToday());
  await expect(dialog.getByRole("radio", { name: "Greg" })).toHaveAttribute("aria-checked", "true");
  // Every funder, then Not assigned.
  await expect(dialog.getByRole("radio")).toHaveText(["Greg", "Bella", "Bella’s family", "Not assigned"]);
  await expect(dialog.getByRole("button", { name: "Attach a receipt" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Record payment", exact: true })).toBeEnabled();
});

test("the line under the amount follows what is typed", async ({ page }) => {
  const section = await openSection(page);
  const dialog = await open(page, section);
  const amount = amountOf(dialog);
  const line = dialog.locator("p[aria-live=polite]");

  await amount.fill("5000000");
  await expect(line).toHaveText("Rp 15.000.000 still to pay after this");
  await expect(line).not.toHaveCSS("color", ROSE);

  await amount.fill("22000000");
  await expect(line).toHaveText("This is Rp 2.000.000 more than what’s left. It will show as overpaid.");
  await expect(line).toHaveCSS("color", ROSE);

  await amount.fill("");
  await expect(line).toHaveText("Enter the amount you paid");

  await amount.fill("12 juta");
  await expect(line).toHaveText("That isn’t an amount yet");
  await expect(line).toHaveCSS("color", ROSE);
});

test("the amount tidies to Rp with dots when it is left", async ({ page }) => {
  const section = await openSection(page);
  const dialog = await open(page, section);
  await amountOf(dialog).fill("5000000");
  await amountOf(dialog).blur();
  await expect(amountOf(dialog)).toHaveValue("Rp 5.000.000");
});

test("text that isn't an amount is put back, with the reason, and a usable amount clears it", async ({ page }) => {
  const section = await openSection(page);
  const dialog = await open(page, section);
  const amount = amountOf(dialog);

  await amount.fill("12 juta");
  await amount.blur();
  await expect(amount).toHaveValue("Rp 20.000.000");
  await expect(dialog.getByRole("alert")).toHaveText("“12 juta” isn’t an amount. Use digits, like 12500000. It stays Rp 20.000.000.");
  await expect(amount).toHaveAttribute("aria-invalid", "true");

  await amount.fill("−5.000.000");
  await amount.blur();
  await expect(dialog.getByRole("alert")).toHaveText("An amount can’t be below zero, so “−5.000.000” can’t be used. It stays Rp 20.000.000.");

  await amount.fill("12,5");
  await amount.blur();
  await expect(dialog.getByRole("alert")).toContainText("Rupiah amounts have no decimals, so “12,5” can’t be used.");

  await amount.fill("1000000000000000");
  await amount.blur();
  await expect(dialog.getByRole("alert")).toContainText("up to Rp 999.999.999.999.999");

  await amount.fill("3000000");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(amount).not.toHaveAttribute("aria-invalid", "true");
});

test("pressing Record payment on text that isn't an amount refuses it and records nothing", async ({ page }) => {
  const section = await openSection(page);
  const dialog = await open(page, section);
  await amountOf(dialog).fill("12 juta");
  await dialog.getByRole("button", { name: "Record payment", exact: true }).click();

  await expect(dialog.getByRole("alert")).toContainText("“12 juta” isn’t an amount");
  await expect(amountOf(dialog)).toHaveValue("Rp 20.000.000");
  await expect(amountOf(dialog)).toBeFocused();
  await expect(dialog).toBeVisible();
  await expect(section.getByRole("listitem").filter({ hasText: "Dapur Lestari Catering" })).toContainText("Rp 10.000.000");
});

test("an empty amount is not recorded: focus goes to the amount", async ({ page }) => {
  const section = await openSection(page);
  const dialog = await open(page, section);
  await amountOf(dialog).fill("");
  await dialog.getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(amountOf(dialog)).toBeFocused();
  await expect(dialog).toContainText("Enter the amount you paid");
  await expect(dialog.locator("button", { hasText: /Recording/ })).toHaveCount(0);
});

test("records the payment: busy Recording, then an Undo toast, and Undo takes it back", async ({ page }) => {
  const section = await openSection(page);
  await setSwitch(section, "Slow writes", true);
  const dialog = await open(page, section);
  const row = section.getByRole("listitem").filter({ hasText: "Dapur Lestari Catering" });

  await amountOf(dialog).fill("5000000");
  await dialog.getByRole("button", { name: "Record payment", exact: true }).click();
  const busy = dialog.getByRole("button", { name: "Recording" });
  await expect(busy).toHaveAttribute("aria-busy", "true");

  // A busy sheet holds Escape.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  await expect(dialog).toHaveCount(0);
  const toast = page.getByRole("status").filter({ hasText: "Recorded Rp 5.000.000 for Dapur Lestari Catering" });
  await expect(toast).toBeVisible();
  await expect(row).toContainText("Rp 15.000.000");

  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(row).toContainText("Rp 10.000.000", { timeout: 10_000 });
});

test("a payment that didn't go through keeps the sheet and what was typed, with Try again", async ({ page }) => {
  const section = await openSection(page);
  const dialog = await open(page, section);
  await setSwitch(section, /Make the next write/, true);
  await amountOf(dialog).fill("5000000");
  await dialog.getByRole("button", { name: "Record payment", exact: true }).click();

  await expect(dialog.getByRole("alert").filter({ hasText: "The payment wasn’t recorded." })).toHaveText(
    "The payment wasn’t recorded. What you typed is still here.",
  );
  await expect(amountOf(dialog)).toHaveValue("Rp 5.000.000");
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(section.getByRole("listitem").filter({ hasText: "Dapur Lestari Catering" })).toContainText("Rp 15.000.000");
});

test("a booking in parts opens on the part it was pressed on, named under the title, with that part's funder", async ({ page }) => {
  const section = await openSection(page);
  const dialog = await open(page, section, "Record payment on Balance");
  await expect(dialog).toContainText("Villa Samaya Ubud, balance");
  await expect(amountOf(dialog)).toHaveValue("Rp 25.000.000");
  await expect(dialog.getByRole("radio", { name: "Bella’s family" })).toHaveAttribute("aria-checked", "true");

  await amountOf(dialog).fill("10000000");
  await dialog.getByRole("radio", { name: "Bella", exact: true }).click();
  await dialog.getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(section.getByRole("listitem").filter({ hasText: "Villa Samaya Ubud" })).toContainText("Rp 35.000.000");
});

test("a part paid in full starts with no amount", async ({ page }) => {
  const section = await openSection(page);
  const dialog = await open(page, section, "Record payment on Deposit");
  await expect(amountOf(dialog)).toHaveValue("");
  await expect(dialog).toContainText("Enter the amount you paid");
});

test("in demonstration mode the sheet says recording is off and Record payment is disabled", async ({ page }) => {
  const section = await openSection(page);
  await section.getByLabel("Demonstration mode").check();
  const dialog = await open(page, section);
  await expect(dialog).toContainText("Demonstration mode: recording is turned off.");
  await expect(dialog.getByRole("button", { name: "Record payment", exact: true })).toBeDisabled();
});

test("Cancel and Escape close the sheet and give focus back to the button that opened it", async ({ page }) => {
  const section = await openSection(page);
  const opener = section.getByRole("button", { name: "Record payment for Dapur Lestari Catering" });

  let dialog = await open(page, section);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  dialog = await open(page, section);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test.describe("receipts", () => {
  const file = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 receipt") });

  test("a receipt is attached through the upload sheet and listed under the link", async ({ page }) => {
    const section = await openSection(page);
    const dialog = await open(page, section);
    await dialog.getByRole("button", { name: "Attach a receipt" }).click();

    const upload = page.getByRole("dialog", { name: "Upload files" });
    await expect(upload).toContainText("Into Files › Bookings › Dapur Lestari Catering");
    await upload.locator("input[type=file]").setInputFiles(file("Transfer receipt.pdf"));
    await expect(upload.getByText("Uploaded", { exact: true })).toBeVisible();
    await upload.getByRole("button", { name: "Done" }).click();

    // Back on the payment sheet, with what was typed kept and the receipt listed.
    await expect(dialog).toBeVisible();
    await expect(amountOf(dialog)).toHaveValue("Rp 20.000.000");
    const receipts = dialog.getByRole("list", { name: "Receipts" });
    await expect(receipts).toContainText("Transfer receipt.pdf");
    await expect(receipts).toContainText("Uploaded");
    await expect(dialog.getByRole("button", { name: "Record payment", exact: true })).toBeEnabled();
  });

  test("a booking's part files the receipt in the part's folder", async ({ page }) => {
    const section = await openSection(page);
    const dialog = await open(page, section, "Record payment on Balance");
    await dialog.getByRole("button", { name: "Attach a receipt" }).click();
    await expect(page.getByRole("dialog", { name: "Upload files" })).toContainText(
      "Into Files › Bookings › Villa Samaya Ubud › Balance",
    );
  });

  test("Record payment waits while a receipt is still uploading", async ({ page }) => {
    const section = await openSection(page);
    const dialog = await open(page, section);
    await dialog.getByRole("button", { name: "Attach a receipt" }).click();
    const upload = page.getByRole("dialog", { name: "Upload files" });
    await upload.locator("input[type=file]").setInputFiles(file("Receipt hold.pdf"));
    await expect(upload.getByText(/Uploading/).first()).toBeVisible();
    await upload.getByRole("button", { name: "Done" }).click();

    await expect(dialog.getByText("Waiting for the receipt to finish uploading.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Record payment", exact: true })).toBeDisabled();
  });

  test("a receipt that fails blocks Record payment until Try again brings it in", async ({ page }) => {
    const section = await openSection(page);
    const dialog = await open(page, section);
    await dialog.getByRole("button", { name: "Attach a receipt" }).click();
    const upload = page.getByRole("dialog", { name: "Upload files" });
    await upload.locator("input[type=file]").setInputFiles(file("Receipt fail.pdf"));
    await expect(upload.getByText("Upload failed. Try again")).toBeVisible();
    await upload.getByRole("button", { name: "Done" }).click();

    await expect(dialog.getByText("A receipt didn’t upload. Try again to record the payment with it.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Record payment", exact: true })).toBeDisabled();
    // The stand-in fails a name with "fail" every time, so the entry stays failed.
    const receipts = dialog.getByRole("list", { name: "Receipts" });
    await expect(receipts).toContainText("Receipt fail.pdf");
    await receipts.getByRole("button", { name: "Try again" }).click();
    await expect(receipts.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Record payment", exact: true })).toBeDisabled();
  });
});

test("fits a phone, with the amount and the actions on screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  const section = await openSection(page);
  const dialog = await open(page, section);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(Math.round(box!.width)).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(780 + 1);
  // A long amount doesn't wrap or run off the sheet.
  await amountOf(dialog).fill("9999999999999");
  await amountOf(dialog).blur();
  const amount = await amountOf(dialog).boundingBox();
  expect(amount!.x + amount!.width).toBeLessThanOrEqual(390);
  await expect(dialog.getByRole("button", { name: "Record payment", exact: true })).toBeInViewport();
});
