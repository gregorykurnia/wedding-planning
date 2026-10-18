import { describe, expect, it } from "vitest";
import {
  EMPTY_DOC,
  docLines,
  docSaveText,
  docTitleOf,
  fingerprint,
  fontKeyOf,
  leaveQuestion,
  linkHref,
  linkLabel,
  meetingNotesDoc,
  nestingDepth,
  normaliseDoc,
  plainTextDoc,
  sizeKeyOf,
  stableKey,
  deleteQuestion,
} from "@/lib/model/documents";

// Task 4.17: documents as the editor reads them (guide §4.24, §5.17, §6.13; plan §9.2 Q10).

const styled = (attrs: Record<string, unknown>) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "textStyle", attrs }] }] }],
});
const marksOf = (doc: ReturnType<typeof normaliseDoc>) => doc.content![0].content![0].marks;

describe("fonts and sizes (Q10)", () => {
  it("reads Inter, Arial, nothing and unknown families as Jost, Georgia as Georgia, Courier New as Mono", () => {
    expect(fontKeyOf("Inter")).toBe("jost");
    expect(fontKeyOf("Arial")).toBe("jost");
    expect(fontKeyOf("")).toBe("jost");
    expect(fontKeyOf(null)).toBe("jost");
    expect(fontKeyOf("Comic Sans MS")).toBe("jost");
    expect(fontKeyOf("Georgia")).toBe("georgia");
    expect(fontKeyOf('"Georgia", serif')).toBe("georgia");
    expect(fontKeyOf("Courier New")).toBe("mono");
    expect(fontKeyOf("ui-monospace, monospace")).toBe("mono");
    expect(fontKeyOf("Cormorant Garamond")).toBe("cormorant");
  });

  it("reads the old 14, 16, 20 and 28px as Small, Normal, Large and Huge, and others as the nearest", () => {
    expect(["14px", "16px", "20px", "28px"].map(sizeKeyOf)).toEqual(["small", "normal", "large", "huge"]);
    expect(["12px", "17px", "22px", "36px"].map(sizeKeyOf)).toEqual(["small", "normal", "large", "huge"]);
    expect(sizeKeyOf("1.2em")).toBe("normal");
    expect(sizeKeyOf(undefined)).toBe("normal");
  });
});

describe("normaliseDoc", () => {
  it("maps fonts and sizes and keeps colours exactly as typed", () => {
    const doc = normaliseDoc(styled({ fontFamily: "Arial", fontSize: "20px", color: "#FF00AA", backgroundColor: "#fff1b8" }));
    expect(marksOf(doc)).toEqual([
      { type: "textStyle", attrs: { fontFamily: null, fontSize: "22px", color: "#FF00AA", backgroundColor: "#fff1b8" } },
    ]);
  });

  it("drops a text style left with nothing in it, and keeps other marks", () => {
    const doc = normaliseDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "x", marks: [{ type: "bold" }, { type: "textStyle", attrs: { fontFamily: "Inter", fontSize: "16px" } }] },
          ],
        },
      ],
    });
    expect(marksOf(doc)).toEqual([{ type: "bold" }]);
  });

  it("changes nothing the second time, and leaves the stored value alone", () => {
    const stored = styled({ fontFamily: "Courier New", fontSize: "28px", color: null });
    const once = normaliseDoc(stored);
    expect(normaliseDoc(once)).toEqual(once);
    expect(stored.content[0].content[0].marks[0].attrs.fontSize).toBe("28px");
  });

  it("opens anything that isn't a document as an empty one, and an empty document with one paragraph", () => {
    expect(normaliseDoc(null)).toEqual(EMPTY_DOC);
    expect(normaliseDoc({ type: "paragraph" })).toEqual(EMPTY_DOC);
    expect(normaliseDoc({ type: "doc", content: [] })).toEqual(EMPTY_DOC);
  });

  it("keeps tables, links and their attributes as they are", () => {
    const table = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [{ type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: [180] }, content: [{ type: "paragraph" }] }],
            },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "site", marks: [{ type: "link", attrs: { href: "https://x.id", target: "_blank" } }] }],
        },
      ],
    };
    expect(normaliseDoc(table)).toEqual(table);
  });
});

describe("legacy notes and titles", () => {
  it("turns plain text into one paragraph per line", () => {
    expect(plainTextDoc("a\n\nb")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "a" }] },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "b" }] },
      ],
    });
  });

  it("reads the old default title as no title, so the page shows Untitled", () => {
    expect(docTitleOf("Untitled document")).toBe("");
    expect(docTitleOf("Seating ideas")).toBe("Seating ideas");
    expect(docTitleOf(undefined)).toBe("");
  });
});

describe("comparing and storing", () => {
  it("gives the same key whatever order the keys are in", () => {
    expect(stableKey({ b: 1, a: [{ y: 2, x: 1 }] })).toBe(stableKey({ a: [{ x: 1, y: 2 }], b: 1 }));
    expect(stableKey({ a: 1, b: undefined })).toBe(stableKey({ a: 1 }));
    expect(stableKey({ a: 1 })).not.toBe(stableKey({ a: 2 }));
  });

  it("fingerprints text the same way every time", () => {
    expect(fingerprint("abc")).toBe(fingerprint("abc"));
    expect(fingerprint("abc")).not.toBe(fingerprint("abd"));
    expect(fingerprint("")).toMatch(/^[0-9a-f]{8}$/);
  });

  it("counts nesting the way Firestore does: a map or array is a level", () => {
    expect(nestingDepth("x")).toBe(0);
    expect(nestingDepth({ a: 1 })).toBe(1);
    expect(nestingDepth({ a: [{ b: 1 }] })).toBe(3);
    expect(nestingDepth(EMPTY_DOC)).toBe(3);
  });

  it("reads every block's text in order, tables cell by cell", () => {
    const doc = meetingNotesDoc("Wednesday 14 October");
    expect(docLines(doc)).toEqual([
      "Wednesday 14 October. Who was there: ",
      "What they said",
      "",
      "Prices",
      "Item",
      "Price",
      "",
      "",
      "",
      "",
      "Total",
      "=SUM(B2:B)",
      "Next steps",
      "",
    ]);
  });
});

describe("meeting notes (guide §6.13)", () => {
  it("starts with the date in bold, who was there, what they said, a prices table with a growing total and next steps", () => {
    const doc = meetingNotesDoc("Wednesday 14 October");
    expect(doc.content![0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Wednesday 14 October", marks: [{ type: "bold" }] },
        { type: "text", text: ". Who was there: " },
      ],
    });
    expect(doc.content!.map((n) => n.type)).toEqual([
      "paragraph",
      "heading",
      "paragraph",
      "heading",
      "table",
      "heading",
      "bulletList",
    ]);
    const rows = doc.content![4].content!;
    expect(rows).toHaveLength(4);
    expect(rows[0].content!.map((c) => c.type)).toEqual(["tableHeader", "tableHeader"]);
    expect(docLines({ type: "doc", content: [rows[3]] })).toEqual(["Total", "=SUM(B2:B)"]);
  });
});

describe("links", () => {
  it("adds https:// to an address without a scheme and keeps web, mail and phone links", () => {
    expect(linkHref(" kebunbunga.id ")).toBe("https://kebunbunga.id");
    expect(linkHref("https://www.pantone.com/x")).toBe("https://www.pantone.com/x");
    expect(linkHref("mailto:laras@kebun.id")).toBe("mailto:laras@kebun.id");
    expect(linkHref("localhost:3000/new")).toBe("https://localhost:3000/new");
  });

  it("refuses an empty address, one with spaces, and other schemes", () => {
    expect(linkHref("")).toBeNull();
    expect(linkHref("two words")).toBeNull();
    expect(linkHref("javascript:alert(1)")).toBeNull();
    expect(linkHref("data:text/html,x")).toBeNull();
  });

  it("shows the address without the scheme or www., at most 40 characters", () => {
    expect(linkLabel("https://www.japan-guide.com/sakura/")).toBe("japan-guide.com/sakura/");
    expect(linkLabel(`https://${"a".repeat(60)}.id`)).toHaveLength(40);
  });
});

describe("words", () => {
  it("names each save state as the guide does (§4.24)", () => {
    expect(docSaveText("saved", "just now")).toBe("Saved just now");
    expect(docSaveText("saved", "2 hours ago")).toBe("Saved 2 hours ago");
    expect(docSaveText("saved", null)).toBe("Saved");
    expect(docSaveText("unsaved", null)).toBe("Not saved yet");
    expect(docSaveText("saving", null)).toBe("Saving");
    expect(docSaveText("failed", null)).toBe("Couldn’t save your last changes. They’re still here.");
    expect(docSaveText("offline", null)).toBe("Not saved: you’re offline. Keep this page open.");
    expect(docSaveText("demo", null)).toBe("Demonstration mode: not saved");
  });

  it("asks before leaving with changes that didn't save (N18)", () => {
    expect(leaveQuestion(false)).toEqual({
      title: "Your last changes aren’t saved",
      body: "The planner couldn’t save them. If you leave now, they’re lost. Stay and they’re still here to save.",
      leave: "Leave without them",
      stay: "Stay and try again",
    });
    expect(leaveQuestion(true).body).toMatch(/^You’re offline, so the planner couldn’t save them\./);
  });

  it("says a delete can't be undone, naming the document and the partner (R7)", () => {
    expect(deleteQuestion("Meeting: Kebun Bunga Atelier", "Bella")).toEqual({
      title: "Delete “Meeting: Kebun Bunga Atelier”?",
      body: "This can’t be undone. The document and everything in it, tables included, will be gone for you and Bella.",
      action: "Delete for good",
    });
    expect(deleteQuestion("  ", "Bella").title).toBe("Delete “Untitled”?");
  });
});
