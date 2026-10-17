import { describe, expect, it } from "vitest";
import { PROBLEM_LINES, emailProblem, googleProblem } from "@/lib/model/sign-in";

// Task 4.1: Firebase's error codes mapped to the sign-in screen's states (guide §5.1).

const code = (value: string) => ({ code: value });

describe("emailProblem", () => {
  it("says the email and password don't match for every credential failure", () => {
    for (const c of [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
      "auth/invalid-email",
      "auth/missing-password",
    ]) {
      expect(emailProblem(code(c))).toBe("wrong");
    }
  });

  it("calls a failed request offline", () => {
    expect(emailProblem(code("auth/network-request-failed"))).toBe("offline");
  });

  it("keeps anything else apart from a wrong password", () => {
    expect(emailProblem(code("auth/too-many-requests"))).toBe("other");
    expect(emailProblem(code("auth/user-disabled"))).toBe("other");
    expect(emailProblem(new Error("boom"))).toBe("other");
    expect(emailProblem(undefined)).toBe("other");
  });
});

describe("googleProblem", () => {
  it("tells a closed window from a blocked one", () => {
    expect(googleProblem(code("auth/popup-closed-by-user"))).toBe("google-closed");
    expect(googleProblem(code("auth/cancelled-popup-request"))).toBe("google-closed");
    expect(googleProblem(code("auth/popup-blocked"))).toBe("google-blocked");
  });

  it("calls a failed request offline and everything else a failed sign-in", () => {
    expect(googleProblem(code("auth/network-request-failed"))).toBe("offline");
    expect(googleProblem(code("auth/internal-error"))).toBe("google-failed");
    expect(googleProblem(new Error("boom"))).toBe("google-failed");
  });
});

describe("the words", () => {
  it("is rose for what needs the visitor and calm for the rest", () => {
    expect(PROBLEM_LINES.wrong.tone).toBe("rose");
    expect(PROBLEM_LINES["google-blocked"].tone).toBe("rose");
    expect(PROBLEM_LINES["google-failed"].tone).toBe("rose");
    expect(PROBLEM_LINES.offline.tone).toBe("calm");
    expect(PROBLEM_LINES["google-closed"].tone).toBe("calm");
  });

  it("follows the guide's wording", () => {
    expect(PROBLEM_LINES.wrong.text).toBe(
      "That email and password don’t match. Check them and try again, or continue with Google.",
    );
    expect(PROBLEM_LINES["google-failed"].text).toContain("Nothing was changed.");
  });
});
