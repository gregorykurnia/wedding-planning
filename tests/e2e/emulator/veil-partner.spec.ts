import { expect, test, type Browser, type Page } from "@playwright/test";
import { TEST_ACCOUNTS } from "../emulator-config";
import { COMPILE_TIMEOUT, closeOtherContexts } from "../helpers";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR } from "../emulator-config";

test.afterEach(closeOtherContexts);

// Task 2.7: two browsers, one account each, see each other's changes.

const SETTINGS = `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/settings/wedding`;
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };

// The partner's name is the name the other account holds (N3). The seed pairs the
// two accounts, and `partnerEmail` is the old way of saying the same thing.
test.beforeAll(async () => {
  const res = await fetch(SETTINGS, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({
      fields: {
        yourName: { stringValue: "Greg" },
        partnerName: { stringValue: "Bella" },
        partnerEmail: { stringValue: TEST_ACCOUNTS[1].email },
      },
    }),
  });
  expect(res.ok).toBe(true);
});

test.afterAll(async () => {
  await fetch(SETTINGS, { method: "DELETE", headers: ADMIN });
});

async function openAs(browser: Browser, account: (typeof TEST_ACCOUNTS)[number]): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/new/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/new", { timeout: COMPILE_TIMEOUT });
  await page.goto("/new/gallery/partner");
  await expect(page.getByRole("heading", { name: "Live partner changes" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
  return page;
}

test("a partner's change shows a toast and flashes the row; a removal says so; both are 'also here'", async ({
  browser,
}) => {
  const greg = await openAs(browser, TEST_ACCOUNTS[0]);
  const bella = await openAs(browser, TEST_ACCOUNTS[1]);

  // Presence: each sees the other, by the name settings give them.
  await expect(greg.getByRole("note")).toHaveText(/^Bella is also in this document\./, { timeout: 15_000 });
  await expect(bella.getByRole("note")).toHaveText(/^Greg is also in this document\./, { timeout: 15_000 });

  // Bella records a payment: Greg gets a partner toast and the row flashes.
  // Bella herself gets neither: her own changes aren't news.
  await bella.getByRole("button", { name: "Record a payment as me" }).click();
  await expect(
    greg.getByRole("status").getByText("Bella recorded Rp 55.500.000 for Dapur Lestari Catering"),
  ).toBeVisible({ timeout: 15_000 });
  await expect(greg.getByTestId("booking-row")).toHaveClass(/\bflash\b/);
  await expect(bella.getByRole("status").getByText(/recorded/)).toHaveCount(0);
  await expect(bella.getByTestId("booking-row")).not.toHaveClass(/\bflash\b/);

  // The flash fades on its own.
  await expect(greg.getByTestId("booking-row")).not.toHaveClass(/\bflash\b/, { timeout: 5_000 });

  // Greg removes the booking while Bella is looking at it.
  await greg.getByRole("button", { name: "Remove the booking as me" }).click();
  await expect(bella.getByRole("heading", { name: "This booking was removed" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(bella.getByText("Greg removed it on another device a moment ago.")).toBeVisible();
  // He sees his own list, not the message.
  await expect(greg.getByRole("heading", { name: "This booking was removed" })).toHaveCount(0);
});
