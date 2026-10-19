import type { JSONContent } from "@tiptap/core";

/**
 * The prototype stores a document as HTML; the planner stores Tiptap JSON. This
 * reads only the tags the prototype's documents use (paragraphs, headings,
 * quotes, code, lists, tables, bold, italic, strike, links, highlight and line
 * breaks), which is all the fixtures need. A table cell with `data-f` holds
 * that formula as its text, which is how totals are stored.
 */

interface El {
  tag: string;
  attrs: Record<string, string>;
  children: (El | string)[];
}

const VOID = new Set(["br", "col", "hr"]);
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

const decode = (text: string) =>
  text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

function parse(html: string): El {
  const root: El = { tag: "root", attrs: {}, children: [] };
  const stack = [root];
  for (const match of html.matchAll(/<(\/?)([a-z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/gi)) {
    const [, closing, name, rest, text] = match;
    const top = stack[stack.length - 1];
    if (text !== undefined) {
      top.children.push(decode(text));
    } else if (closing) {
      const at = stack.map((e) => e.tag).lastIndexOf(name.toLowerCase());
      if (at > 0) stack.length = at;
    } else {
      const el: El = { tag: name.toLowerCase(), attrs: {}, children: [] };
      for (const a of rest.matchAll(/([a-z-]+)(?:="([^"]*)"|='([^']*)')?/gi)) el.attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? "");
      top.children.push(el);
      if (!VOID.has(el.tag) && !rest.trimEnd().endsWith("/")) stack.push(el);
    }
  }
  return root;
}

type Mark = NonNullable<JSONContent["marks"]>[number];

const MARKS: Record<string, string> = { b: "bold", strong: "bold", i: "italic", em: "italic", s: "strike" };

function inlineOf(nodes: readonly (El | string)[], marks: Mark[] = []): JSONContent[] {
  const out: JSONContent[] = [];
  for (const node of nodes) {
    if (typeof node === "string") {
      const text = node.replace(/\s+/g, " ");
      if (text.trim() !== "" || (text === " " && out.length > 0)) out.push({ type: "text", text, ...(marks.length ? { marks } : {}) });
    } else if (node.tag === "br") {
      out.push({ type: "hardBreak" });
    } else if (node.tag === "a") {
      out.push(...inlineOf(node.children, [...marks, { type: "link", attrs: { href: node.attrs.href ?? "" } }]));
    } else if (node.tag === "span") {
      const background = /background-color:\s*([^;]+)/.exec(node.attrs.style ?? "")?.[1];
      const next = background ? [...marks, { type: "textStyle", attrs: { backgroundColor: background.trim() } }] : marks;
      out.push(...inlineOf(node.children, next));
    } else if (MARKS[node.tag]) {
      out.push(...inlineOf(node.children, [...marks, { type: MARKS[node.tag] }]));
    } else {
      out.push(...inlineOf(node.children, marks));
    }
  }
  return out;
}

const BLOCKS = new Set(["p", "h1", "h2", "h3", "blockquote", "pre", "ul", "ol", "li", "table", "tr", "td", "th", "colgroup"]);

const paragraph = (inline: JSONContent[]): JSONContent => {
  // A paragraph holding only a line break is how the prototype writes an empty one.
  const only = inline.length === 1 && inline[0].type === "hardBreak";
  return inline.length === 0 || only ? { type: "paragraph" } : { type: "paragraph", content: inline };
};

function blocksOf(nodes: readonly (El | string)[]): JSONContent[] {
  const out: JSONContent[] = [];
  let run: (El | string)[] = [];
  const flush = () => {
    const inline = inlineOf(run);
    if (inline.length) out.push(paragraph(inline));
    run = [];
  };
  for (const node of nodes) {
    if (typeof node === "string" || !BLOCKS.has(node.tag)) {
      run.push(node);
      continue;
    }
    flush();
    const block = blockOf(node);
    if (block) out.push(block);
  }
  flush();
  return out;
}

function blockOf(el: El): JSONContent | null {
  switch (el.tag) {
    case "p":
      return paragraph(inlineOf(el.children));
    case "h1":
    case "h2":
    case "h3":
      return { type: "heading", attrs: { level: Number(el.tag[1]) }, content: inlineOf(el.children) };
    case "blockquote":
      return { type: "blockquote", content: blocksOf(el.children) };
    case "pre":
      return { type: "codeBlock", content: [{ type: "text", text: el.children.map((c) => (typeof c === "string" ? c : "")).join("") }] };
    case "ul":
    case "ol":
      return { type: el.tag === "ul" ? "bulletList" : "orderedList", content: el.children.flatMap((c) => (typeof c !== "string" && c.tag === "li" ? [blockOf(c)!] : [])) };
    case "li": {
      const content = blocksOf(el.children);
      return { type: "listItem", content: content.length ? content : [{ type: "paragraph" }] };
    }
    case "table":
      return { type: "table", content: el.children.flatMap((c) => (typeof c !== "string" && c.tag === "tr" ? [blockOf(c)!] : [])) };
    case "tr":
      return { type: "tableRow", content: el.children.flatMap((c) => (typeof c !== "string" && (c.tag === "td" || c.tag === "th") ? [blockOf(c)!] : [])) };
    case "td":
    case "th": {
      const formula = el.attrs["data-f"];
      const content = formula ? [paragraph([{ type: "text", text: formula }])] : blocksOf(el.children);
      return { type: el.tag === "th" ? "tableHeader" : "tableCell", content: content.length ? content : [{ type: "paragraph" }] };
    }
    default:
      return null;
  }
}

/** A stored document body for the prototype's HTML. */
export function htmlToDoc(html: string): JSONContent {
  const content = blocksOf(parse(html).children);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}
