import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionContext, type Session, type SessionNotice } from "@/lib/data/session";
import { SignInScreen } from "@/veil/screens/sign-in/sign-in";

// Task 4.1: the sign-in screen's states that come from the session, as markup.
// The e2e tests in tests/e2e/*/veil-sign-in.spec.ts drive the attempts.

const noop = async () => {};

function session(over: Partial<Session> = {}): Session {
  return {
    status: "signed-out",
    user: null,
    notice: null,
    connection: "online",
    lookingAround: false,
    signInWithGoogle: noop,
    signInWithEmail: noop,
    signOut: noop,
    lookAround: () => {},
    leaveDemo: () => {},
    ...over,
  };
}

function screen(over: Partial<Session> = {}) {
  return renderToStaticMarkup(
    <SessionContext.Provider value={session(over)}>
      <SignInScreen />
    </SessionContext.Provider>,
  );
}

const notAllowed: SessionNotice = { kind: "not-allowed", email: "someone.else@gmail.com" };

describe("the sign-in screen", () => {
  it("has the gate's title and sentence, Google first and then the email form", () => {
    const html = screen();
    expect(html).toMatch(/<h1[^>]*>Our wedding planner<\/h1>/);
    expect(html).toContain("For the two of us only. Sign in to see everything.");
    expect(html.indexOf("Continue with Google")).toBeLessThan(html.indexOf("or with email"));
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).not.toContain("Use a different Google account");
  });

  it("gives the email and the password each a label that points at its input", () => {
    const html = screen();
    for (const label of ["Email", "Password"]) {
      const target = html.match(new RegExp(`<label[^>]*for="([^"]+)"[^>]*>${label}</label>`))?.[1];
      expect(target, `${label} label`).toBeTruthy();
      expect(html).toMatch(new RegExp(`<input[^>]*id="${target!.replace(/:/g, "\\:")}"`));
    }
  });

  it("says you've signed out, calmly", () => {
    const html = screen({ notice: { kind: "signed-out" } });
    expect(html).toContain("You’ve signed out. Nothing is shown on this device until one of you signs in again.");
    expect(html).toMatch(/role="status"/);
  });

  it("names the account that isn't allowed, in rose, and offers another Google account", () => {
    const html = screen({ notice: notAllowed });
    expect(html).toContain("<b>someone.else@gmail.com</b>");
    expect(html).toContain("isn’t one of the two accounts that can open this planner.");
    expect(html).toMatch(/role="alert"/);
    expect(html).toContain("Use a different Google account");
  });

  it("disables both ways in while offline, and says so", () => {
    const html = screen({ connection: "offline" });
    expect(html).toContain("You’re offline. Signing in needs a connection");
    const disabled = html.match(/<button[^>]*disabled=""[^>]*>/g) ?? [];
    expect(disabled).toHaveLength(2);
  });

  it("shows the offline note instead of the signed-out one", () => {
    const html = screen({ connection: "offline", notice: { kind: "signed-out" } });
    expect(html).toContain("You’re offline.");
    expect(html).not.toContain("You’ve signed out.");
  });

  it("in demonstration mode has no form, only Look around", () => {
    const html = screen({ status: "demo", connection: "demo" });
    expect(html).toContain("isn’t connected to its database yet");
    expect(html).toContain("Look around");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Continue with Google");
  });
});
