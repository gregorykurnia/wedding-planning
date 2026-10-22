import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InstallCard } from "@/veil/parts/device/install-card";
import { NotificationState } from "@/veil/parts/device/notification-state";

// Task 3.9: the install card and the notification state as markup (guide §4.30,
// §6.12). The e2e test in tests/e2e/demo/veil-device.spec.ts checks the phone and
// computer words by width and what the buttons do in a browser.

const markup = (node: ReactElement) => renderToStaticMarkup(node);
const noop = () => {};

describe("InstallCard", () => {
  it("suggests the install in one sentence, with Show me how and Not now", () => {
    const html = markup(<InstallCard howHref="/settings#install" onNotNow={noop} />);
    expect(html).toContain("Add the planner to your home screen to open it like an app.");
    expect(html).toMatch(/<a [^>]*href="\/settings#install"[^>]*>Show me how<\/a>/);
    expect(html).toMatch(/<button [^>]*>Not now<\/button>/);
  });
});

describe("NotificationState", () => {
  it("says reminders arrive when allowed, and offers a test in settings", () => {
    const html = markup(<NotificationState permission="granted" />);
    expect(html).toContain("Arrives on this ");
    expect(html).toContain(" and your other devices, even when the planner is closed.");
    expect(html).toMatch(/<button [^>]*>Send a test reminder<\/button>/);
    expect(html).not.toContain("Allow notifications");
  });

  it("has no test button in the event sheet, where it is only shown in settings", () => {
    const html = markup(<NotificationState permission="granted" where="sheet" />);
    expect(html).toContain("Arrives on this ");
    expect(html).not.toContain("Send a test reminder");
  });

  it("offers to allow when not yet allowed: a button in settings, a link-style button in the sheet", () => {
    const settings = markup(<NotificationState permission="default" />);
    expect(settings).toContain("Not allowed yet on this ");
    expect(settings).toMatch(/<button [^>]*>Allow notifications<\/button>/);
    expect(markup(<NotificationState permission="default" where="sheet" />)).toMatch(
      /<button [^>]*class="[^"]*link[^"]*"[^>]*>Allow notifications<\/button>/,
    );
  });

  it("says it is turned off, in rose, and where to turn it on for each device", () => {
    const html = markup(<NotificationState permission="denied" />);
    expect(html).toMatch(/<p class="[^"]*off[^"]*">/);
    expect(html).toContain("Turned off for the planner on this ");
    expect(html).toContain("your phone’s Settings, under Notifications");
    expect(html).toContain("the browser’s site settings for the planner");
  });

  it("names the device as phone or computer, and the width decides which one shows", () => {
    const html = markup(<NotificationState permission="default" />);
    expect(html).toMatch(/<span class="[^"]*phone[^"]*">phone<\/span><span class="[^"]*computer[^"]*">computer<\/span>/);
  });

  it("on an iPhone in the browser, says to add it to the home screen first, with Show me how (N6)", () => {
    const settings = markup(<NotificationState permission="install" />);
    expect(settings).toContain("On an iPhone, reminders can only arrive once the planner is on your home screen.");
    expect(settings).toMatch(/<a [^>]*href="#install"[^>]*>Show me how<\/a>/);
    expect(settings).not.toContain("Until then");
    const sheet = markup(<NotificationState permission="install" where="sheet" installHref="/settings#install" />);
    expect(sheet).toContain("Until then, they arrive only on your other devices.");
    expect(sheet).toMatch(/<a [^>]*href="\/settings#install"[^>]*>Show me how<\/a>/);
  });

  it("in a browser that can't, says so in rose, that other devices still get them, and which browsers can (N6)", () => {
    const html = markup(<NotificationState permission="unsupported" />);
    expect(html).toMatch(/<p class="[^"]*off[^"]*">This browser can’t show reminders from the planner/);
    expect(html).toContain("They still arrive on your other devices where they’re allowed.");
    expect(html).toContain("open the planner in a recent Safari, Chrome, Edge or Firefox.");
  });

  it("shows nothing until the browser has been asked", () => {
    expect(markup(<NotificationState permission="checking" />)).toBe("");
  });

  it("says when an allowed device couldn't be set up, with Try again, and when a test couldn't be sent", () => {
    const setup = markup(<NotificationState permission="granted" setupFailed />);
    expect(setup).toContain("couldn’t be set up for reminders, so they won’t arrive here yet.");
    expect(setup).toMatch(/<button [^>]*>Try again<\/button>/);
    expect(setup).not.toContain("Send a test reminder");
    expect(markup(<NotificationState permission="granted" testFailed />)).toContain("Couldn’t send a test reminder. Try again.");
    expect(markup(<NotificationState permission="granted" testing />)).toContain("Sending");
  });

  it("is inert in demonstration mode", () => {
    expect(markup(<NotificationState permission="default" disabled />)).toMatch(/disabled=""/);
    expect(markup(<NotificationState permission="granted" disabled />)).toMatch(/disabled=""/);
  });
});
