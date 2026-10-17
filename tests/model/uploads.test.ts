import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  baseName,
  extLabel,
  intoLine,
  mbText,
  newItem,
  planUpload,
  savedName,
  sizeLine,
  statusView,
  thumbUrl,
  transferText,
  uploadReducer,
  type UploadItem,
} from "@/lib/model/uploads";

// Task 3.10: the words and rules of uploading (guide §4.20, R9, R10).

const MB = 1_048_576;
const file = (name: string, size: number, type = "") => ({ name, size, type });

describe("sizes", () => {
  it("writes megabytes with a decimal comma, and whole numbers without a decimal", () => {
    expect(mbText(14.2 * MB)).toBe("14,2 MB");
    expect(mbText(48 * MB)).toBe("48 MB");
    expect(mbText(2.4 * MB)).toBe("2,4 MB");
  });

  it("switches to kilobytes under a megabyte and gigabytes over 1024", () => {
    expect(mbText(620 * 1024)).toBe("620 KB");
    expect(mbText(10)).toBe("1 KB");
    expect(mbText(1536 * MB)).toBe("1,5 GB");
  });

  it("adds where a tile's file came from", () => {
    expect(sizeLine(2.4 * MB, true)).toBe("2,4 MB, from the vendor");
    expect(sizeLine(2.4 * MB)).toBe("2,4 MB");
  });

  it("says how much of a file is sent, in the file's own unit", () => {
    expect(transferText(1.3 * MB, 2.1 * MB)).toBe("Uploading, 1,3 of 2,1 MB");
    expect(transferText(100 * 1024, 400 * 1024)).toBe("Uploading, 100 of 400 KB");
  });
});

describe("planning an upload", () => {
  it("uploads anything up to 10 MB, exactly 10 MB included", () => {
    expect(planUpload("a.zip", "application/zip", MAX_UPLOAD_BYTES)).toBe("upload");
    expect(planUpload("a.pdf", "application/pdf", 3 * MB)).toBe("upload");
  });

  it("shrinks a PDF over the limit, by its type or its ending", () => {
    expect(planUpload("scan.pdf", "application/pdf", 14 * MB)).toBe("shrink");
    expect(planUpload("scan.PDF", "", 14 * MB)).toBe("shrink");
  });

  it("refuses any other big file", () => {
    expect(planUpload("All photos.zip", "application/zip", 48 * MB)).toBe("too-large");
    expect(planUpload("photo.jpg", "image/jpeg", 11 * MB)).toBe("too-large");
  });
});

describe("names", () => {
  it("starts the name field as the file's name without its ending, and keeps the ending when saved", () => {
    expect(baseName("Invoice.pdf")).toBe("Invoice");
    expect(savedName("Invoice.pdf", "Florist invoice")).toBe("Florist invoice.pdf");
    expect(savedName("Invoice.pdf", "   ")).toBe("Invoice.pdf");
    expect(savedName("notes", "Notes")).toBe("Notes");
  });

  it("labels a thumbnail with the ending", () => {
    expect(extLabel("Quote.PDF")).toBe("pdf");
    expect(extLabel("no ending")).toBe("file");
  });

  it("says where a file goes", () => {
    expect(intoLine(["Vendors", "Kebun Bunga Atelier"])).toBe("Into Files › Vendors › Kebun Bunga Atelier");
  });

  it("asks Cloudinary for a tile-sized picture, and leaves other addresses alone", () => {
    expect(thumbUrl("https://res.cloudinary.com/demo/image/upload/v1/a/b.jpg")).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_fill,w_320,h_192,f_auto,q_auto/v1/a/b.jpg",
    );
    expect(thumbUrl("https://res.cloudinary.com/demo/raw/upload/v1/a.pdf")).toBe(
      "https://res.cloudinary.com/demo/raw/upload/v1/a.pdf",
    );
    expect(thumbUrl("#")).toBe("#");
  });
});

describe("the words of each status", () => {
  const start = (name: string, size: number, type: string, demo = false) =>
    newItem("a", file(name, size, type), demo);

  it("starts a normal file uploading, a big PDF shrinking and a big other file refused", () => {
    expect(start("a.jpg", 2 * MB, "image/jpeg").status).toBe("uploading");
    expect(start("a.pdf", 14.2 * MB, "application/pdf").status).toBe("shrinking");
    expect(start("a.zip", 48 * MB, "application/zip").status).toBe("too-large");
  });

  it("says Not uploaded in demonstration mode, but still refuses a too-large file with its own words", () => {
    expect(statusView(start("a.jpg", 2 * MB, "image/jpeg", true)).text).toBe("Not uploaded: demonstration mode");
    expect(statusView(start("a.zip", 48 * MB, "application/zip", true)).text).toBe(
      "Too large: 48 MB. Files can be up to 10 MB; only PDFs are shrunk.",
    );
  });

  it("words shrinking, progress, done and failed as the guide does", () => {
    const shrinking = start("a.pdf", 14.2 * MB, "application/pdf");
    expect(statusView(shrinking).text).toBe("Shrinking from 14,2 MB to fit under 10 MB");
    expect(statusView(shrinking).percent).toBeNull();

    const uploading: UploadItem = { ...start("a.jpg", 2 * MB, "image/jpeg"), loaded: 1.24 * MB, total: 2 * MB };
    expect(statusView(uploading).text).toBe("Uploading, 62%");
    expect(statusView(uploading, true).text).toBe("Uploading, 1,2 of 2 MB");

    const done: UploadItem = { ...uploading, status: "done" };
    expect(statusView(done).text).toBe("Uploaded");
    expect(statusView(done).tone).toBe("ok");
    expect(statusView({ ...done, shrunkTo: 7.8 * MB }).text).toBe("Uploaded, shrunk to 7,8 MB");

    const failed: UploadItem = { ...uploading, status: "failed" };
    expect(statusView(failed)).toMatchObject({ text: "Upload failed.", retry: true, bar: false, tone: "bad" });
  });

  it("words a PDF that is still too big after shrinking differently from a refused file", () => {
    const item: UploadItem = { ...start("a.pdf", 14 * MB, "application/pdf"), status: "too-large", stillOver: 10.5 * MB };
    expect(statusView(item).text).toBe(
      "Shrunk from 14 MB to 10,5 MB, still over 10 MB. Shrinking wasn’t enough, so it wasn’t uploaded. Choose a smaller PDF, or split it into parts.",
    );
  });
});

describe("the queue's state", () => {
  const item = (id: string, name = "a.jpg", size = 2 * MB, type = "image/jpeg") => newItem(id, file(name, size, type), false);

  it("adds files in order and changes only the one named", () => {
    let items = uploadReducer([], { type: "add", item: item("a") });
    items = uploadReducer(items, { type: "add", item: item("b") });
    items = uploadReducer(items, { type: "progress", id: "b", loaded: MB, total: 2 * MB });
    expect(items.map((i) => i.loaded)).toEqual([0, MB]);
  });

  it("goes shrinking, then uploading at the shrunk size", () => {
    let items = [item("a", "a.pdf", 14 * MB, "application/pdf")];
    expect(items[0].status).toBe("shrinking");
    items = uploadReducer(items, { type: "shrunk", id: "a", bytes: 7.8 * MB });
    expect(items[0]).toMatchObject({ status: "uploading", total: 7.8 * MB, shrunkTo: 7.8 * MB });
  });

  it("retries a failed PDF that never shrank at shrinking, and one that did at uploading", () => {
    const pdf = item("a", "a.pdf", 14 * MB, "application/pdf");
    const failedEarly = uploadReducer([pdf], { type: "failed", id: "a" });
    expect(uploadReducer(failedEarly, { type: "retry", id: "a" })[0].status).toBe("shrinking");
    const shrunk = uploadReducer([pdf], { type: "shrunk", id: "a", bytes: 7 * MB });
    const failedLate = uploadReducer(shrunk, { type: "failed", id: "a" });
    expect(uploadReducer(failedLate, { type: "retry", id: "a" })[0]).toMatchObject({ status: "uploading", loaded: 0 });
  });

  it("clears what has finished and keeps what is running or failed", () => {
    let items = [item("run"), item("ok"), item("bad"), item("big", "a.zip", 48 * MB, "application/zip")];
    items = uploadReducer(items, { type: "done", id: "ok", fileId: "f1" });
    items = uploadReducer(items, { type: "failed", id: "bad" });
    expect(uploadReducer(items, { type: "clear-finished" }).map((i) => i.id)).toEqual(["run", "bad"]);
  });
});
