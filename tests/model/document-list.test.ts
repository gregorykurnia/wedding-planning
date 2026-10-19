import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import {
  DOCS_PAGE,
  RECENT_CARDS,
  documentText,
  documentView,
  documentsSub,
  matchCount,
  newestFirst,
  noResultsTitle,
  type DocumentListItem,
} from "@/lib/model/document-list";

// Task 4.16: the Documents list's pure parts (guide §5.16, R6): a document's
// words as one line, the list in view (cards, rows, search, a page of 60) and
// the words of the count and the empty states.

const item = (over: Partial<DocumentListItem> = {}): DocumentListItem => ({
  id: "d1",
  title: "Meeting: Kebun Bunga Atelier",
  text: "Prices and next steps",
  editedAt: 1_000,
  editedBy: null,
  ...over,
});

const many = (count: number): DocumentListItem[] =>
  Array.from({ length: count }, (_, i) => item({ id: `d${String(i).padStart(4, "0")}`, title: `Doc ${i}`, text: "", editedAt: i }));

describe("documentText", () => {
  it("joins blocks and table cells with a space, as one line", () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Prices" }] },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Photographer" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "12.000.000" }] }] },
              ],
            },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "  two   spaces " }] },
      ],
    };
    expect(documentText(content)).toBe("Prices Photographer 12.000.000 two spaces");
  });

  it("is empty for an empty document", () => {
    expect(documentText({ type: "doc", content: [{ type: "paragraph" }] })).toBe("");
  });
});

describe("newestFirst", () => {
  it("puts the newest first and the one with no stamp yet (just saved) at the top", () => {
    const sorted = newestFirst([
      item({ id: "a", editedAt: 5 }),
      item({ id: "b", editedAt: null }),
      item({ id: "c", editedAt: 9 }),
    ]);
    expect(sorted.map((d) => d.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps a steady order for equal stamps, by id, and doesn't change its input", () => {
    const input = [item({ id: "b", editedAt: 1 }), item({ id: "a", editedAt: 1 })];
    expect(newestFirst(input).map((d) => d.id)).toEqual(["a", "b"]);
    expect(input.map((d) => d.id)).toEqual(["b", "a"]);
  });
});

describe("documentView", () => {
  it("shows the three newest as cards and the rest as rows", () => {
    const view = documentView(many(10), "", DOCS_PAGE);
    expect(view.recent.map((d) => d.title)).toEqual(["Doc 9", "Doc 8", "Doc 7"]);
    expect(view.recent).toHaveLength(RECENT_CARDS);
    expect(view.rest.map((d) => d.title)).toEqual(["Doc 6", "Doc 5", "Doc 4", "Doc 3", "Doc 2", "Doc 1", "Doc 0"]);
    expect(view.matched).toBe(10);
  });

  it("has no rows when there are three documents or fewer", () => {
    const view = documentView(many(2), "", DOCS_PAGE);
    expect(view.recent).toHaveLength(2);
    expect(view.rest).toHaveLength(0);
    expect(view.more).toBe(0);
  });

  it("searches titles and the words inside, folds case and accents, and shows rows only", () => {
    const docs = [
      item({ id: "a", title: "Seating", text: "Photographer contract is signed", editedAt: 3 }),
      item({ id: "b", title: "PHOTOGRAPHER notes", text: "", editedAt: 2 }),
      item({ id: "c", title: "Menu", text: "Crème brûlée", editedAt: 1 }),
    ];
    const view = documentView(docs, "photographer", DOCS_PAGE);
    expect(view.recent).toEqual([]);
    expect(view.rest.map((d) => d.id)).toEqual(["a", "b"]);
    expect(view.matched).toBe(2);
    expect(documentView(docs, "creme brulee", DOCS_PAGE).rest.map((d) => d.id)).toEqual(["c"]);
  });

  it("treats a blank search as no search", () => {
    const view = documentView(many(5), "   ", DOCS_PAGE);
    expect(view.recent).toHaveLength(3);
    expect(view.rest).toHaveLength(2);
  });

  it("matches nothing for a search that finds nothing", () => {
    const view = documentView(many(5), "zzz", DOCS_PAGE);
    expect(view.matched).toBe(0);
    expect(view.rest).toEqual([]);
  });

  it("draws 60 rows at a time and says how many the next step shows", () => {
    const docs = many(RECENT_CARDS + 130);
    const first = documentView(docs, "", DOCS_PAGE);
    expect(first.shown).toBe(60);
    expect(first.more).toBe(60);
    const second = documentView(docs, "", 120);
    expect(second.shown).toBe(120);
    expect(second.more).toBe(10);
    const all = documentView(docs, "", 180);
    expect(all.shown).toBe(130);
    expect(all.more).toBe(0);
  });
});

describe("the words", () => {
  it("counts the documents under the title, or says what documents are for", () => {
    expect(documentsSub(1)).toBe("1 document, newest first");
    expect(documentsSub(6)).toBe("6 documents, newest first");
    expect(documentsSub(0)).toBe("Plans, research and meeting notes");
  });

  it("quotes the search in the no-results title, trimmed", () => {
    expect(noResultsTitle("  photographer contract ")).toBe("No documents match “photographer contract”");
  });

  it("counts the matches", () => {
    expect(matchCount(1)).toBe("1 document match");
    expect(matchCount(3)).toBe("3 documents match");
  });
});
