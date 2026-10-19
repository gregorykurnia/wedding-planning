import { describe, expect, it, vi } from "vitest";
import { UploadQueue, type SaveRequest, type UploadDeps, type UploadTarget } from "@/lib/data/upload-queue";
import { MAX_UPLOAD_BYTES } from "@/lib/model/uploads";

// Task 3.10: the queue's rules, with the network and the database replaced.

const MB = 1_048_576;
const TARGET: UploadTarget = { kind: "record", ref: { kind: "vendor", id: "v1" }, recordName: "Kebun Bunga Atelier" };

function file(name: string, size: number, type = ""): File {
  const f = new File([], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

const asset = (bytes: number) => ({ publicId: "p", url: "https://res.cloudinary.com/x/raw/upload/v1/p", resourceType: "raw", format: "", bytes });

/** Resolves when the queue has nothing left to do for `id`. */
async function settled(queue: UploadQueue, id?: string) {
  await vi.waitFor(() => {
    const items = queue.getSnapshot().items.filter((i) => !id || i.id === id);
    expect(items.every((i) => ["done", "failed", "too-large", "demo"].includes(i.status))).toBe(true);
  });
}

function makeDeps(over: Partial<UploadDeps> = {}): UploadDeps & { saved: SaveRequest[] } {
  const saved: SaveRequest[] = [];
  let n = 0;
  return {
    saved,
    shrink: async (f) => file(f.name, 7 * MB, f.type),
    send: async (f, onProgress) => {
      onProgress(f.size / 2, f.size);
      onProgress(f.size, f.size);
      return asset(f.size);
    },
    save: async (request) => {
      saved.push(request);
      return request.docId;
    },
    rename: async () => {},
    newDocId: () => `doc-${++n}`,
    ...over,
  };
}

describe("UploadQueue", () => {
  it("uploads several files at once, each with its own progress, and files each", async () => {
    const deps = makeDeps();
    const queue = new UploadQueue(TARGET, deps);
    queue.add([file("a.jpg", 2 * MB, "image/jpeg"), file("b.pdf", 3 * MB, "application/pdf")]);
    await settled(queue);
    const items = queue.getSnapshot().items;
    expect(items.map((i) => i.status)).toEqual(["done", "done"]);
    expect(deps.saved.map((s) => s.originalName).sort()).toEqual(["a.jpg", "b.pdf"]);
    expect(new Set(deps.saved.map((s) => s.docId)).size).toBe(2);
  });

  it("files each upload where it was added, even after the screen moves to another folder", async () => {
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const deps = makeDeps({
      send: async (f) => {
        await gate;
        return asset(f.size);
      },
    });
    const contracts: UploadTarget = { kind: "folder", folderId: "f-contracts", path: ["Contracts"] };
    const photos: UploadTarget = { kind: "folder", folderId: "f-photos", path: ["Photos"] };
    const queue = new UploadQueue(contracts, deps);
    queue.add([file("a.jpg", 2 * MB, "image/jpeg")]);
    queue.configure(photos, false);
    queue.add([file("b.jpg", 2 * MB, "image/jpeg")]);
    release();
    await settled(queue);
    const where = Object.fromEntries(deps.saved.map((s) => [s.originalName, s.target]));
    expect(where["a.jpg"]).toEqual(contracts);
    expect(where["b.jpg"]).toEqual(photos);
  });

  it("shrinks a PDF over the limit, then sends the shrunk file", async () => {
    const send = vi.fn(makeDeps().send);
    const queue = new UploadQueue(TARGET, makeDeps({ send }));
    queue.add([file("scan.pdf", 14 * MB, "application/pdf")]);
    expect(queue.getSnapshot().items[0].status).toBe("shrinking");
    await settled(queue);
    expect(send.mock.calls[0][0].size).toBe(7 * MB);
    expect(queue.getSnapshot().items[0]).toMatchObject({ status: "done", shrunkTo: 7 * MB });
  });

  it("shrinks PDFs one at a time", async () => {
    let running = 0;
    let most = 0;
    const shrink = vi.fn(async (f: File) => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return file(f.name, 5 * MB, f.type);
    });
    const queue = new UploadQueue(TARGET, makeDeps({ shrink }));
    queue.add([file("a.pdf", 14 * MB, "application/pdf"), file("b.pdf", 15 * MB, "application/pdf")]);
    await settled(queue);
    expect(shrink).toHaveBeenCalledTimes(2);
    expect(most).toBe(1);
  });

  it("refuses a PDF that is still over the limit after shrinking, with its own words and no Try again", async () => {
    const send = vi.fn(makeDeps().send);
    const queue = new UploadQueue(TARGET, makeDeps({ shrink: async (f) => file(f.name, MAX_UPLOAD_BYTES + 1, f.type), send }));
    queue.add([file("huge.pdf", 40 * MB, "application/pdf")]);
    await settled(queue);
    expect(queue.getSnapshot().items[0]).toMatchObject({ status: "too-large", stillOver: MAX_UPLOAD_BYTES + 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses any other big file at once, without sending or shrinking it", async () => {
    const deps = makeDeps({ shrink: vi.fn(), send: vi.fn() });
    const queue = new UploadQueue(TARGET, deps);
    queue.add([file("All photos.zip", 48 * MB, "application/zip")]);
    expect(queue.getSnapshot().items[0].status).toBe("too-large");
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.shrink).not.toHaveBeenCalled();
  });

  it("fails one file and not the others, and Try again sends it again", async () => {
    let attempts = 0;
    const base = makeDeps();
    const queue = new UploadQueue(TARGET, {
      ...base,
      send: async (f, p) => {
        if (f.name === "bad.pdf" && attempts++ === 0) throw new Error("network");
        return base.send(f, p);
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    queue.add([file("ok.jpg", MB, "image/jpeg"), file("bad.pdf", MB, "application/pdf")]);
    await settled(queue);
    const [ok, bad] = queue.getSnapshot().items;
    expect([ok.status, bad.status]).toEqual(["done", "failed"]);
    queue.retry(bad.id);
    expect(queue.getSnapshot().items[1].status).toBe("uploading");
    await settled(queue);
    expect(queue.getSnapshot().items[1].status).toBe("done");
    expect(base.saved).toHaveLength(2);
  });

  it("doesn't send a file twice when only filing it failed, and files it under the same id", async () => {
    let saves = 0;
    const send = vi.fn(makeDeps().send);
    const requests: SaveRequest[] = [];
    const queue = new UploadQueue(TARGET, {
      ...makeDeps({ send }),
      save: async (request) => {
        requests.push(request);
        if (saves++ === 0) throw new Error("offline");
        return request.docId;
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    queue.add([file("a.jpg", MB, "image/jpeg")]);
    await settled(queue);
    expect(queue.getSnapshot().items[0].status).toBe("failed");
    queue.retry(queue.getSnapshot().items[0].id);
    await settled(queue);
    expect(queue.getSnapshot().items[0].status).toBe("done");
    expect(send).toHaveBeenCalledTimes(1);
    expect(requests[0].docId).toBe(requests[1].docId);
  });

  it("does nothing in demonstration mode but says so", () => {
    const deps = makeDeps({ send: vi.fn(), save: vi.fn() });
    const queue = new UploadQueue(TARGET, deps, true);
    queue.add([file("a.jpg", MB, "image/jpeg")]);
    expect(queue.getSnapshot().items[0].status).toBe("demo");
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });

  it("files a file with the name, category and description typed so far", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const deps = makeDeps({ send: async (f) => (await gate, asset(f.size)) });
    const queue = new UploadQueue(TARGET, deps);
    queue.add([file("scan.pdf", MB, "application/pdf")]);
    const id = queue.getSnapshot().items[0].id;
    expect(queue.getSnapshot().fields[id].name).toBe("scan");
    queue.setField(id, "name", "Signed contract");
    queue.setField(id, "category", "Contract");
    queue.setField(id, "description", "Page 1 to 4");
    release();
    await settled(queue);
    expect(deps.saved[0].fields).toEqual({ name: "Signed contract", category: "Contract", description: "Page 1 to 4" });
  });

  it("saves a change made after the upload when the field is left, and keeps what was typed when it fails", async () => {
    const rename = vi.fn(async () => {});
    const queue = new UploadQueue(TARGET, makeDeps({ rename }));
    queue.add([file("scan.pdf", MB, "application/pdf")]);
    await settled(queue);
    const item = queue.getSnapshot().items[0];

    await queue.commitField(item.id);
    expect(rename).not.toHaveBeenCalled();

    queue.setField(item.id, "category", "Quote");
    await queue.commitField(item.id);
    expect(rename).toHaveBeenCalledWith(item.fileId, "scan.pdf", { name: "scan", category: "Quote", description: "" });

    vi.spyOn(console, "error").mockImplementation(() => {});
    rename.mockRejectedValueOnce(new Error("offline"));
    queue.setField(item.id, "description", "Page 1");
    await queue.commitField(item.id);
    expect(queue.getSnapshot().fieldErrors[item.id]).toBe(true);
    expect(queue.getSnapshot().fields[item.id].description).toBe("Page 1");
    await queue.commitField(item.id);
    expect(queue.getSnapshot().fieldErrors[item.id]).toBe(false);
  });

  it("puts the old name back when it is cleared after the upload", async () => {
    const rename = vi.fn(async () => {});
    const queue = new UploadQueue(TARGET, makeDeps({ rename }));
    queue.add([file("scan.pdf", MB, "application/pdf")]);
    await settled(queue);
    const id = queue.getSnapshot().items[0].id;
    queue.setField(id, "name", "");
    await queue.commitField(id);
    expect(queue.getSnapshot().fields[id].name).toBe("scan");
    expect(rename).not.toHaveBeenCalled();
  });

  it("saves every changed field when the sheet closes, even one never left (P3-S9)", async () => {
    const rename = vi.fn(async () => {});
    const queue = new UploadQueue(TARGET, makeDeps({ rename }));
    queue.add([file("a.pdf", MB, "application/pdf"), file("b.pdf", MB, "application/pdf")]);
    await settled(queue);
    const [a, b] = queue.getSnapshot().items;
    queue.setField(b.id, "description", "Signed copy");
    await queue.commitAll();
    expect(rename).toHaveBeenCalledTimes(1);
    expect(rename).toHaveBeenCalledWith(b.fileId, "b.pdf", { name: "b", category: "", description: "Signed copy" });
    expect(a.status).toBe("done");
  });

  it("keeps an entry whose details didn't save, or aren't saved yet, when the sheet reopens (P3-S9)", async () => {
    const rename = vi.fn(async () => {});
    const queue = new UploadQueue(TARGET, makeDeps({ rename }));
    queue.add([file("a.pdf", MB, "application/pdf"), file("b.pdf", MB, "application/pdf"), file("c.pdf", MB, "application/pdf")]);
    await settled(queue);
    const [a, b, c] = queue.getSnapshot().items;
    vi.spyOn(console, "error").mockImplementation(() => {});
    rename.mockRejectedValueOnce(new Error("offline"));
    queue.setField(a.id, "name", "Contract");
    await queue.commitField(a.id);
    queue.setField(b.id, "category", "Quote");
    queue.clearFinished();
    expect(queue.getSnapshot().items.map((i) => i.id)).toEqual([a.id, b.id]);
    expect(queue.getSnapshot().fields[a.id].name).toBe("Contract");
    expect(c.status).toBe("done");

    // Once they save, the next reopen clears them.
    await queue.commitAll();
    queue.clearFinished();
    expect(queue.getSnapshot().items).toEqual([]);
  });

  it("tells listeners when anything changes", async () => {
    const queue = new UploadQueue(TARGET, makeDeps());
    const seen = vi.fn();
    const stop = queue.subscribe(seen);
    queue.add([file("a.jpg", MB, "image/jpeg")]);
    await settled(queue);
    expect(seen).toHaveBeenCalled();
    const calls = seen.mock.calls.length;
    stop();
    queue.clearFinished();
    expect(seen.mock.calls.length).toBe(calls);
  });
});
