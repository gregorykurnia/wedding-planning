import { describe, expect, it } from "vitest";
import {
  accountDetail,
  myAccountName,
  namesHint,
  partnerAccountName,
  reminderCantArriveLine,
  signedInWith,
} from "@/lib/model/settings";

// Task 4.25: the lines on Wedding settings (guide §5.3; N3, N11).

describe("namesHint", () => {
  it("names the couple as the top bar shows them once both names are set", () => {
    expect(namesHint("Greg", "Bella")).toBe("Used wherever the planner addresses you, like Greg & Bella at the top.");
  });

  it("leaves the example out until both names are there, and trims them", () => {
    expect(namesHint("Greg", "")).toBe("Used wherever the planner addresses you.");
    expect(namesHint("", " ")).toBe("Used wherever the planner addresses you.");
    expect(namesHint("  Greg ", " Bella  ")).toContain("like Greg & Bella at the top");
  });
});

describe("the two accounts", () => {
  it("calls the signed-in account you, or only You before it has a name", () => {
    expect(myAccountName("Greg")).toBe("Greg, you");
    expect(myAccountName("")).toBe("You");
  });

  it("calls the partner by name, or Your partner until there is one", () => {
    expect(partnerAccountName("Bella")).toBe("Bella");
    expect(partnerAccountName("")).toBe("Your partner");
  });

  it("says how an account signed in only when it is known", () => {
    expect(signedInWith("google.com")).toBe("signed in with Google");
    expect(signedInWith("password")).toBe("signed in with a password");
    expect(signedInWith("")).toBe("");
    expect(accountDetail("greg@example.com", "google.com")).toBe("greg@example.com, signed in with Google");
    expect(accountDetail("greg@example.com", "")).toBe("greg@example.com");
  });
});

describe("reminderCantArriveLine (N11)", () => {
  it("counts one appointment or call, or several", () => {
    expect(reminderCantArriveLine(1)).toBe(
      "1 appointment or call has a reminder you set before for a time of day, which can’t arrive.",
    );
    expect(reminderCantArriveLine(2)).toBe(
      "2 appointments and calls have a reminder you set before for a time of day, which can’t arrive.",
    );
  });
});
