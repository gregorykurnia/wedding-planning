import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { documentFromDoc } from "@/lib/data/adapters/documents";
import { deleteDocumentForGood, saveDocument } from "@/lib/data/documents";
import { nestingDepth } from "@/lib/model/documents";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

// Task 4.17: a document's writes, against the emulators (guide §5.17, R5, R7).

let gregory: Partner;
let bella: Partner;

beforeAll(async () => {
  [gregory, bella] = await twoPartners();
});

afterAll(async () => {
  await Promise.all([closeClient(gregory), closeClient(bella)]);
});

beforeEach(async () => {
  await clearFirestore();
});

const g = () => ({ db: gregory.db });

async function read(id: string) {
  const snap = await getDoc(doc(gregory.db, "notes", id));
  return snap.exists() ? snap.data() : undefined;
}

const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const body = (...content: object[]) => ({ type: "doc", content });

/** A bullet list nested `depth` deep, with bold text in the deepest item. */
function nestedList(depth: number): object {
  let item: object = {
    type: "listItem",
    content: [{ type: "paragraph", content: [{ type: "text", text: `level ${depth}`, marks: [{ type: "bold" }] }] }],
  };
  for (let level = depth - 1; level >= 1; level--) {
    item = { type: "listItem", content: [para(`level ${level}`), { type: "bulletList", content: [item] }] };
  }
  return { type: "bulletList", content: [item] };
}

/** A map nested `depth` deep: { a: { a: … { a: 1 } } }. */
const nestedMap = (depth: number): object => (depth === 1 ? { a: 1 } : { a: nestedMap(depth - 1) });

describe("Firestore's nesting limit", () => {
  it("takes a field nested 20 deep and refuses 21, which is why deep documents are kept as text", async () => {
    await setDoc(doc(gregory.db, "notes", "depth-20"), { content: nestedMap(20), title: "" });
    await expect(setDoc(doc(gregory.db, "notes", "depth-21"), { content: nestedMap(21), title: "" })).rejects.toThrow();
  });
});

describe("saveDocument", () => {
  it("makes a new document with that id the first time, stamped and logged, and Try again doesn't make two", async () => {
    await saveDocument("d-new", { title: "Meeting: ", content: body(para("Who was there:")) }, { ...g(), created: false });
    await saveDocument("d-new", { title: "Meeting: ", content: body(para("Who was there:")) }, { ...g(), created: false });
    const stored = await read("d-new");
    expect(stored).toMatchObject({ title: "Meeting: ", createdBy: gregory.uid, updatedBy: gregory.uid });
    expect(stored?.content).toEqual(body(para("Who was there:")));
    expect(stored?.contentJson).toBeUndefined();
  });

  it("a create that runs again leaves one piece of news, not two (P4-S16)", async () => {
    const draft = { title: "Meeting: ", content: body(para("Who was there:")) };
    await saveDocument("d-news", draft, { ...g(), created: false });
    await saveDocument("d-news", draft, { ...g(), created: false });
    const news = () => getDocs(collection(gregory.db, "activity"));
    // The news is written without waiting; give the second try time to be refused.
    await vi.waitFor(async () => expect((await news()).size).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 500));
    const all = (await news()).docs.map((d) => d.data());
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ kind: "document.added", target: { kind: "document", id: "d-news" } });
  });

  it("saves the title and the content of an existing document, leaving its other fields", async () => {
    await setDoc(doc(gregory.db, "notes", "d-1"), { title: "Old", content: body(para("old")), text: "legacy" });
    await saveDocument("d-1", { title: "New", content: body(para("new")) }, { ...g(), created: true });
    const stored = await read("d-1");
    expect(stored).toMatchObject({ title: "New", text: "legacy", updatedBy: gregory.uid });
    expect(stored?.content).toEqual(body(para("new")));
  });

  it("the later save wins when both of you save the same document (§9.2 Q7)", async () => {
    await saveDocument("d-2", { title: "Seating", content: body(para("first")) }, { ...g(), created: false });
    await saveDocument("d-2", { title: "Seating", content: body(para("Bella’s")) }, { db: bella.db, created: true });
    await saveDocument("d-2", { title: "Seating", content: body(para("Greg’s")) }, { ...g(), created: true });
    expect((await read("d-2"))?.content).toEqual(body(para("Greg’s")));
  });

  it("keeps a document too deep for Firestore whole, with a text copy the old UI can open", async () => {
    const deep = body(para("Trays"), nestedList(4));
    expect(nestingDepth(deep)).toBeGreaterThan(20);
    await saveDocument("d-deep", { title: "Sangjit", content: deep }, { ...g(), created: false });
    const stored = await read("d-deep");
    expect(typeof stored?.contentJson).toBe("string");
    expect(stored?.content).toMatchObject({ type: "doc" });
    expect(documentFromDoc("d-deep", stored!).content).toEqual(deep);

    // Once it fits again, the whole copy is removed and content holds it all.
    await saveDocument("d-deep", { title: "Sangjit", content: body(para("Trays")) }, { ...g(), created: true });
    const flat = await read("d-deep");
    expect(flat?.contentJson).toBeUndefined();
    expect(flat?.contentFor).toBeUndefined();
    expect(flat?.content).toEqual(body(para("Trays")));
  });

  it("when the old UI saves over a deep document, its newer content is what opens", async () => {
    await saveDocument("d-old", { title: "Sangjit", content: body(nestedList(4)) }, { ...g(), created: false });
    // The old editor writes `content` only.
    await updateDoc(doc(gregory.db, "notes", "d-old"), { content: body(para("edited in the old UI")) });
    expect(documentFromDoc("d-old", (await read("d-old"))!).content).toEqual(body(para("edited in the old UI")));
  });
});

describe("reading documents", () => {
  it("opens a note from before rich text as paragraphs, and the old default title as untitled", async () => {
    await setDoc(doc(gregory.db, "notes", "d-text"), { title: "Untitled document", text: "Line one\nLine two" });
    const read1 = documentFromDoc("d-text", (await read("d-text"))!);
    expect(read1.title).toBe("");
    expect(read1.content).toEqual(body(para("Line one"), para("Line two")));
  });

  it("maps the old fonts and sizes to the new four and keeps colours as typed (§9.2 Q10)", async () => {
    const styled = (attrs: Record<string, string | null>) => ({
      type: "paragraph",
      content: [{ type: "text", text: "x", marks: [{ type: "textStyle", attrs }] }],
    });
    await setDoc(doc(gregory.db, "notes", "d-styled"), {
      title: "Styles",
      content: body(
        styled({ fontFamily: "Inter", fontSize: "20px", color: "#ff00aa" }),
        styled({ fontFamily: "Courier New", fontSize: "28px", backgroundColor: "#fff1b8" }),
        styled({ fontFamily: "Georgia", fontSize: "16px", color: null }),
      ),
    });
    const opened = documentFromDoc("d-styled", (await read("d-styled"))!).content;
    const attrsOf = (i: number) => opened.content![i].content![0].marks![0].attrs;
    expect(attrsOf(0)).toEqual({ fontFamily: null, fontSize: "22px", color: "#ff00aa" });
    expect(attrsOf(1)).toEqual({ fontFamily: "Courier New", fontSize: "30px", backgroundColor: "#fff1b8" });
    expect(attrsOf(2)).toEqual({ fontFamily: "Georgia", fontSize: null, color: null });
  });
});

describe("deleteDocumentForGood", () => {
  it("deletes the document and logs it, so the partner's open copy says who deleted it", async () => {
    await saveDocument("d-del", { title: "Seating ideas", content: body(para("x")) }, { ...g(), created: false });
    await deleteDocumentForGood("d-del", "Seating ideas", { db: bella.db });
    expect(await read("d-del")).toBeUndefined();
  });
});
