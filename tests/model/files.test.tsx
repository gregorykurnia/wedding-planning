import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UploadQueue, type UploadDeps, type UploadTarget } from "@/lib/data/upload-queue";
import { FileTiles } from "@/veil/parts/files/file-tiles";
import { UploadSheet } from "@/veil/parts/files/upload-sheet";

// Task 3.10: file tiles and the upload sheet as markup (guide §4.20). The
// e2e tests in tests/e2e/demo/veil-files.spec.ts check what a press does.

vi.mock("@/veil/shell/sheet", () => ({
  useSheets: () => ({ open: () => 1, close: () => {} }),
  useSheet: () => ({ close: () => {}, setBusy: () => {}, titleId: "t" }),
  Sheet: ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      <p>{sub}</p>
      {children}
    </section>
  ),
  SheetActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const MB = 1_048_576;
const TARGET: UploadTarget = { kind: "record", ref: { kind: "vendor", id: "v1" }, recordName: "Kebun Bunga Atelier" };

function file(name: string, size: number, type = ""): File {
  const f = new File([], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

/** Deps that never finish, so the queue stays in whatever state the files start in. */
const idle: UploadDeps = {
  shrink: () => new Promise(() => {}),
  send: () => new Promise(() => {}),
  save: () => new Promise(() => {}),
  rename: async () => {},
  newDocId: () => "d",
};

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("FileTiles", () => {
  const files = [
    { id: "a", name: "Quote.pdf", url: "https://x/quote.pdf", size: 2.4 * MB, mime: "application/pdf" },
    { id: "b", name: "Menu.pdf", url: "https://x/menu.pdf", size: 1.1 * MB, fromVendor: true },
    { id: "c", name: "Photo.jpg", url: "https://res.cloudinary.com/x/image/upload/v1/photo.jpg", size: 300 * 1024, mime: "image/jpeg" },
    { id: null, name: "Old file.pdf", url: "https://x/old.pdf" },
  ];

  it("shows each file's name, size and where it came from, and ends with the Add files tile", () => {
    const markup = html(<FileTiles files={files} queue={new UploadQueue(TARGET, idle)} />);
    expect(markup).toContain("Quote.pdf");
    expect(markup).toContain("2,4 MB");
    expect(markup).toContain("1,1 MB, from the vendor");
    expect(markup).toContain("300 KB");
    expect(markup.lastIndexOf("Add files")).toBeGreaterThan(markup.lastIndexOf("Old file.pdf"));
    expect(markup).toContain("Quotes, contracts, photos. Up to 10 MB each; big PDFs are shrunk for you.");
  });

  it("opens a file in a new tab, and shows a picture at tile size cropped to fill", () => {
    const markup = html(<FileTiles files={files} queue={new UploadQueue(TARGET, idle)} />);
    expect(markup).toContain('href="https://x/quote.pdf" target="_blank" rel="noreferrer"');
    expect(markup).toContain("c_fill,w_320,h_192");
    // A file that isn't a picture shows its ending in place of one.
    expect(markup).toMatch(/<span class="[^"]*">pdf<\/span>/);
  });

  it("shows uploads under way and refused ones as tiles, in the queue's words", () => {
    const queue = new UploadQueue(TARGET, idle);
    queue.add([
      file("Signed contract scan.pdf", 14.2 * MB, "application/pdf"),
      file("Transfer receipt.jpg", 2.1 * MB, "image/jpeg"),
      file("All photos.zip", 48 * MB, "application/zip"),
    ]);
    const markup = html(<FileTiles files={[]} queue={queue} />);
    expect(markup).toContain("Shrinking from 14,2 MB to fit under 10 MB");
    expect(markup).toContain("Uploading, 0 of 2,1 MB");
    expect(markup).toContain("Too large: 48 MB. Files can be up to 10 MB; only PDFs are shrunk.");
    // A bar for each upload under way and none for the refused one.
    expect(markup.match(/role="progressbar"/g)).toHaveLength(2);
  });
});

describe("UploadSheet", () => {
  it("says where files go and what is allowed, and has the drop zone and Done", () => {
    const markup = html(<UploadSheet queue={new UploadQueue(TARGET, idle)} />);
    expect(markup).toContain("Upload files");
    expect(markup).toContain("Into Files › Vendors › Kebun Bunga Atelier. PDF, Word, Excel, CSV, ZIP, text and images, up to 10 MB each. Bigger PDFs are shrunk to fit.");
    expect(markup).toContain("Drop files here");
    expect(markup).toContain("choose files");
    expect(markup).toContain('accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.txt,image/*"');
    expect(markup).toContain(">Done<");
    expect(markup).not.toContain("Demonstration mode");
  });

  it("gives each file that is uploading a name, category and description, labelled with the file", () => {
    const queue = new UploadQueue(TARGET, idle);
    queue.add([file("Quote.pdf", 2 * MB, "application/pdf")]);
    const markup = html(<UploadSheet queue={queue} />);
    expect(markup).toContain('aria-label="Name for Quote.pdf"');
    expect(markup).toContain('value="Quote"');
    expect(markup).toContain('aria-label="Category for Quote.pdf"');
    expect(markup).toContain('placeholder="Category, optional"');
    expect(markup).toContain('aria-label="Description for Quote.pdf"');
    expect(markup).toContain('placeholder="Description, optional"');
    expect(markup).toContain("Uploading, 0%");
    // Suggestions for the category.
    expect(markup).toContain('<option value="Seating plan"');
  });

  it("gives a refused file no fields", () => {
    const queue = new UploadQueue(TARGET, idle);
    queue.add([file("All photos.zip", 48 * MB, "application/zip")]);
    const markup = html(<UploadSheet queue={queue} />);
    expect(markup).toContain("Too large: 48 MB");
    expect(markup).not.toContain("Name for All photos.zip");
  });

  it("says so in demonstration mode, and gives each file its own line", () => {
    const queue = new UploadQueue(TARGET, idle, true);
    queue.add([file("Quote.pdf", MB, "application/pdf")]);
    const markup = html(<UploadSheet queue={queue} />);
    expect(markup).toContain("Demonstration mode: uploading is turned off.");
    expect(markup).toContain("Not uploaded: demonstration mode");
  });
});
