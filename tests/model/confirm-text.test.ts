import { describe, expect, it } from "vitest";
import { confirmFailure, TRY_AGAIN, undoConflict } from "@/lib/model/confirm-text";

// Guide §4.15 (N14) and §4.16 (N13): the words of a removal that couldn't finish
// and of an undo that couldn't take anything back.

describe("confirmFailure", () => {
  it("says nothing was removed for a removal, with the reason from the guide", () => {
    const failure = confirmFailure("Remove booking");
    expect(failure.lead).toBe("Nothing was removed.");
    expect(failure.reason).toBe(
      "The planner couldn’t reach its database, so everything is just as it was. Try again, or keep it for now.",
    );
  });

  it("says nothing was deleted for a deletion, a document or a file", () => {
    expect(confirmFailure("Delete task").lead).toBe("Nothing was deleted.");
    expect(confirmFailure("Delete for good").lead).toBe("Nothing was deleted.");
    expect(confirmFailure("Empty folder").lead).toBe("Nothing was deleted.");
  });

  it("reads the first word only, so a removal that mentions a deletion stays a removal", () => {
    expect(confirmFailure("Remove deleted vendor").lead).toBe("Nothing was removed.");
    expect(confirmFailure("Removed").lead).toBe("Nothing was removed.");
  });

  it("gives the button the guide's label", () => {
    expect(TRY_AGAIN).toBe("Try again");
  });
});

describe("undoConflict", () => {
  it("names who changed it and says the change is kept", () => {
    expect(undoConflict("Bella")).toBe("Can’t undo: Bella has changed this since. It’s kept as it is now.");
  });
});
