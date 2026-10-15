import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { recordFolder, saveUploadedFile } from "@/lib/data/uploads";
import type { SaveRequest } from "@/lib/data/upload-queue";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

// Task 3.10: where an upload is filed. Folders are made on first use and found
// by what they belong to; the document and the record's old list agree.

let gregory: Partner;

beforeAll(async () => {
  [gregory] = await twoPartners();
});

afterAll(async () => {
  await closeClient(gregory);
});

beforeEach(async () => {
  await clearFirestore();
});

const opts = () => ({ db: gregory.db });
const all = async (name: string): Promise<Record<string, any>[]> => // eslint-disable-line @typescript-eslint/no-explicit-any
  (await getDocs(collection(gregory.db, name))).docs.map((d) => ({ id: d.id, ...d.data() }));

const asset = { publicId: "p1", url: "https://res.cloudinary.com/x/raw/upload/v1/p1.pdf", resourceType: "raw", format: "pdf", bytes: 2_500_000 };

const request = (over: Partial<SaveRequest> = {}): SaveRequest => ({
  docId: "file-1",
  target: { kind: "record", ref: { kind: "vendor", id: "v1" }, recordName: "Kebun Bunga Atelier" },
  asset,
  originalName: "Quote.pdf",
  mime: "application/pdf",
  fields: { name: "Florist quote", category: "Quote", description: "First round" },
  ...over,
});

describe("recordFolder", () => {
  it("makes Files › Vendors › the record's name on first use, and finds it after", async () => {
    const first = await recordFolder({ kind: "vendor", id: "v1" }, ["Vendors", "Kebun Bunga Atelier"], opts());
    const again = await recordFolder({ kind: "vendor", id: "v1" }, ["Vendors", "Kebun Bunga Atelier"], opts());
    expect(again).toBe(first);
    const folders = await all("fileFolders");
    expect(folders).toHaveLength(2);
    const root = folders.find((f) => f.name === "Vendors");
    const own = folders.find((f) => f.name === "Kebun Bunga Atelier");
    expect(root).toMatchObject({ parentId: null });
    expect(own).toMatchObject({ parentId: root!.id, recordRef: { kind: "vendor", id: "v1" } });
  });

  it("gives two uploads started together one folder", async () => {
    const ref = { kind: "venue" as const, id: "ve1" };
    const [a, b] = await Promise.all([
      recordFolder(ref, ["Venues", "Bukit Jimbaran Lawn"], opts()),
      recordFolder(ref, ["Venues", "Bukit Jimbaran Lawn"], opts()),
    ]);
    expect(a).toBe(b);
    expect(await all("fileFolders")).toHaveLength(2);
  });

  it("uses the Vendors folder that's already there, and a record's folder that was renamed or moved", async () => {
    await setDoc(doc(gregory.db, "fileFolders", "root"), { name: "Vendors", parentId: null });
    await setDoc(doc(gregory.db, "fileFolders", "mine"), {
      name: "Old name for the florist",
      parentId: "elsewhere",
      recordRef: { kind: "vendor", id: "v1" },
    });
    const id = await recordFolder({ kind: "vendor", id: "v1" }, ["Vendors", "Kebun Bunga Atelier"], opts());
    expect(id).toBe("mine");
    expect(await all("fileFolders")).toHaveLength(2);
    // A different vendor gets its own folder under the same Vendors folder.
    await recordFolder({ kind: "vendor", id: "v2" }, ["Vendors", "Dapur Lestari"], opts());
    const folders = await all("fileFolders");
    expect(folders.filter((f) => f.name === "Vendors")).toHaveLength(1);
    expect(folders.find((f) => f.name === "Dapur Lestari")).toMatchObject({ parentId: "root" });
  });

  it("puts a part's files in a folder under the record's, named after the part", async () => {
    const id = await recordFolder({ kind: "booking", id: "vendor-v1", partId: "p1" }, ["Bookings", "Catering", "Deposit"], opts());
    const folders = await all("fileFolders");
    const record = folders.find((f) => f.name === "Catering");
    expect(folders.find((f) => f.id === id)).toMatchObject({
      name: "Deposit",
      parentId: record!.id,
      recordRef: { kind: "booking", id: "vendor-v1", partId: "p1" },
    });
    expect(record).toMatchObject({ recordRef: { kind: "booking", id: "vendor-v1" } });
  });
});

describe("saveUploadedFile", () => {
  it("creates the weddingFiles document in the record's folder, with its recordRef and the typed fields", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), { name: "Kebun Bunga Atelier", files: [] });
    const id = await saveUploadedFile(request(), opts());
    expect(id).toBe("file-1");
    const [file] = await all("weddingFiles");
    const folders = await all("fileFolders");
    expect(file).toMatchObject({
      id: "file-1",
      name: "Florist quote.pdf",
      category: "Quote",
      description: "First round",
      url: asset.url,
      publicId: "p1",
      resourceType: "raw",
      originalFilename: "Quote.pdf",
      fileType: "application/pdf",
      fileSize: 2_500_000,
      recordRef: { kind: "vendor", id: "v1" },
      folderId: folders.find((f) => f.name === "Kebun Bunga Atelier")!.id,
    });
    expect(file.uploadedBy).toBe(gregory.auth.currentUser?.email);
  });

  it("also puts the file on the record's old list, once, even when the same upload is filed again", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), { name: "Kebun Bunga Atelier", files: [{ name: "Earlier.pdf", url: "https://x/earlier.pdf" }] });
    await saveUploadedFile(request(), opts());
    await saveUploadedFile(request(), opts());
    expect(await all("weddingFiles")).toHaveLength(1);
    const files = (await getDoc(doc(gregory.db, "vendors", "v1"))).get("files");
    expect(files).toEqual([
      { id: "legacy-0", name: "Earlier.pdf", url: "https://x/earlier.pdf" }, // an old element gets the id it was already read under
      { id: "file-1", name: "Florist quote.pdf", url: asset.url },
    ]);
  });

  it("puts a part's file on that part's list, for a booking of a vendor", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), {
      name: "Dapur Lestari",
      subEntries: [{ id: "p1", name: "Deposit", files: [] }, { id: "p2", name: "Balance" }],
    });
    await saveUploadedFile(
      request({ target: { kind: "record", ref: { kind: "booking", id: "vendor-v1", partId: "p2" }, recordName: "Dapur Lestari", partName: "Balance" } }),
      opts(),
    );
    const parts = (await getDoc(doc(gregory.db, "vendors", "v1"))).get("subEntries");
    expect(parts[0].files).toEqual([]);
    expect(parts[1].files).toEqual([{ id: "file-1", name: "Florist quote.pdf", url: asset.url }]);
  });

  it("still files the upload when the record's old list can't be written", async () => {
    // No vendor document: the old list has nowhere to go.
    await saveUploadedFile(request(), opts());
    expect(await all("weddingFiles")).toHaveLength(1);
  });

  it("files into a chosen folder without a recordRef, for the Files screen", async () => {
    await saveUploadedFile(request({ target: { kind: "folder", folderId: "f9", path: ["Venues"] } }), opts());
    const [file] = await all("weddingFiles");
    expect(file.folderId).toBe("f9");
    expect(file).not.toHaveProperty("recordRef");
  });
});
