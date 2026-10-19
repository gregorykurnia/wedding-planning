import { describe, expect, it } from "vitest";
import { htmlToDoc } from "../fixtures/html";

// Task 5.1: the prototype's document HTML as the Tiptap JSON the planner stores.

describe("htmlToDoc", () => {
  it("reads paragraphs, marks, links and highlights", () => {
    const doc = htmlToDoc(
      `<p><b>Bold</b> and <i>italic</i>, <s>struck</s> &amp; <a href="https://x.test/a">a link</a> <span style="background-color:#fce6ec">marked</span></p>`,
    );
    const text = (doc.content![0].content ?? []).map((n) => [n.text, n.marks?.map((m) => m.type)]);
    expect(text).toEqual([
      ["Bold", ["bold"]],
      [" and ", undefined],
      ["italic", ["italic"]],
      [", ", undefined],
      ["struck", ["strike"]],
      [" & ", undefined],
      ["a link", ["link"]],
      [" ", undefined],
      ["marked", ["textStyle"]],
    ]);
    expect(doc.content![0].content![6].marks![0].attrs).toEqual({ href: "https://x.test/a" });
  });

  it("reads headings, quotes, code and nested lists", () => {
    const doc = htmlToDoc(
      `<h2>Next</h2><blockquote>“Quoted”</blockquote><pre>a  b</pre><ol><li>one<ul><li>deep</li></ul></li><li><br></li></ol>`,
    );
    const [heading, quote, code, list] = doc.content!;
    expect(heading).toMatchObject({ type: "heading", attrs: { level: 2 } });
    expect(quote).toMatchObject({ type: "blockquote", content: [{ type: "paragraph" }] });
    expect(code).toEqual({ type: "codeBlock", content: [{ type: "text", text: "a  b" }] });
    expect(list.type).toBe("orderedList");
    expect(list.content![0].content!.map((c) => c.type)).toEqual(["paragraph", "bulletList"]);
    expect(list.content![1].content).toEqual([{ type: "paragraph" }]);
  });

  it("reads a table, its header cells and a total's formula as the cell's text", () => {
    const doc = htmlToDoc(
      `<table class="dt" data-head="1"><colgroup><col style="width:50%"><col></colgroup><tr><th>Item</th><th>Price</th></tr><tr><td>Arch</td><td>10</td></tr><tr><td>Total</td><td data-f="=SUM(B2:B2)"></td></tr></table>`,
    );
    const table = doc.content![0];
    expect(table.type).toBe("table");
    expect(table.content!.map((r) => r.content!.map((c) => c.type))).toEqual([
      ["tableHeader", "tableHeader"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
    ]);
    expect(table.content![2].content![1].content).toEqual([{ type: "paragraph", content: [{ type: "text", text: "=SUM(B2:B2)" }] }]);
  });

  it("makes an empty body one empty paragraph", () => {
    expect(htmlToDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});
