import { expect, test } from "@playwright/test";
import { COMPILE_TIMEOUT } from "../helpers";

// Task 7.1, the switch-over: the new UI serves the root, the old one is the
// frozen fallback under /old, and old addresses reach their new pages.
const OLD_PATHS = [
  "/",
  "/login",
  "/venues",
  "/vendors",
  "/shortlist",
  "/confirmed",
  "/master-list",
  "/guests",
  "/schedule",
  "/todo",
  "/notes",
  "/files",
  "/settings",
  "/budget",
  "/checklist",
];

for (const path of OLD_PATHS) {
  const old = path === "/" ? "/old" : `/old${path}`;
  test(`the old UI still renders at ${old}`, async ({ page }) => {
    const response = await page.goto(old);
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Our Wedding").or(page.getByText("Welcome back")).first()).toBeVisible();
  });
}

test("the new UI renders at / (the demo gate sends it to sign-in)", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("button", { name: "Look around" })).toBeVisible({
    timeout: COMPILE_TIMEOUT,
  });
});

// Old addresses with no new page of the same name, and the new UI's /new
// addresses from while it was built. The rest (/vendors, /guests, …) are new
// pages already. Temporary redirects, so a rollback isn't remembered (§9.3).
const MOVED: [string, string][] = [
  ["/login", "/sign-in"],
  ["/confirmed", "/budget/bookings"],
  ["/master-list", "/items"],
  ["/todo", "/schedule/tasks"],
  ["/checklist", "/schedule/tasks"],
  ["/notes", "/documents"],
  ["/venues", "/vendors/venues"],
  ["/shortlist", "/vendors/shortlist"],
  ["/files", "/documents/files"],
  ["/new", "/"],
  ["/new/budget/payments", "/budget/payments"],
  ["/new/schedule?event=e1", "/schedule?event=e1"],
];

for (const [from, to] of MOVED) {
  test(`${from} redirects to ${to}`, async ({ request }) => {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(to);
  });
}
