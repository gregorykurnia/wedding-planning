import { describe, expect, it } from "vitest";
import { keenLabel, keenToast } from "@/veil/parts/keen/keen-text";
import { ruledOutStage, stageLabel, stageSteps, threadShape } from "@/veil/parts/stage/stage-text";

// Task 3.9: the stage thread's steps and the keen heart's words (guide §4.21,
// §4.22). The model's stage labels are the source; these tests pin the order
// and the words the design shows.

describe("stage steps", () => {
  it("runs a vendor from Noted to Done", () => {
    expect(stageSteps("vendor").map((step) => step.label)).toEqual([
      "Noted",
      "Inquiring",
      "Considering",
      "Chosen",
      "Done",
    ]);
  });

  it("runs a venue from Noted to Booked", () => {
    expect(stageSteps("venue").map((step) => step.label)).toEqual(["Noted", "Contacted", "Visited", "Booked"]);
  });

  it("stores ruled out as Rejected, for vendors and venues alike", () => {
    expect(ruledOutStage("vendor")).toBe("Rejected");
    expect(ruledOutStage("venue")).toBe("Rejected");
    expect(stageLabel("vendor", "Rejected")).toBe("Ruled out");
    expect(stageLabel("venue", "Rejected")).toBe("Ruled out");
  });
});

describe("threadShape", () => {
  it("fills the steps up to the current stage and names it", () => {
    expect(threadShape("vendor", "Consideration")).toEqual({
      ruledOut: false,
      steps: 5,
      reached: 2,
      name: "Considering",
    });
    expect(threadShape("venue", "Booked")).toEqual({ ruledOut: false, steps: 4, reached: 3, name: "Booked" });
  });

  it("starts at the first step for Noted", () => {
    expect(threadShape("venue", "Shortlist")).toEqual({ ruledOut: false, steps: 4, reached: 0, name: "Noted" });
  });

  it("draws ruled out apart, with no steps", () => {
    expect(threadShape("vendor", "Rejected")).toEqual({ ruledOut: true, name: "Ruled out" });
  });

  it("fills no step for a stored value the list doesn't know, and shows that value", () => {
    expect(threadShape("vendor", "Mystery")).toEqual({ ruledOut: false, steps: 5, reached: -1, name: "Mystery" });
  });
});

describe("keen heart words", () => {
  it("names the heart by the vendor, and the name stays when pressed", () => {
    expect(keenLabel("Kebun Bunga Atelier")).toBe("Keen on Kebun Bunga Atelier");
  });

  it("says what a change did, in the design's words", () => {
    expect(keenToast("Kebun Bunga Atelier", true)).toBe("Marked Kebun Bunga Atelier as one you’re keen on");
    expect(keenToast("Kebun Bunga Atelier", false)).toBe("Unmarked Kebun Bunga Atelier");
  });
});
