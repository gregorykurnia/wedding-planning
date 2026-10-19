import { describe, expect, it } from "vitest";
import {
  FILES_PAGE,
  HITS_PAGE,
  addedOn,
  crumbs,
  deleteFolderConfirm,
  downloadUrl,
  emptyFirst,
  folderSub,
  folderTree,
  folderView,
  hitsCount,
  holdings,
  moveFolderSub,
  moveOptions,
  movedAgainText,
  nameTaken,
  paging,
  pathName,
  placeName,
  previewOf,
  searchFiles,
  thumbOf,
  topSub,
  type FileItem,
  type FolderItem,
} from "@/lib/model/files";

// Task 4.19: Files' pure parts (guide §5.18; R8–R14): the folder tree, what a folder
// shows, the search across folders, the path above a folder, the move sheet's choices
// and the words.

const folder = (id: string, name: string, parentId: string | null = null): FolderItem => ({ id, name, parentId });
const file = (id: string, folderId: string | null, over: Partial<FileItem> = {}): FileItem => ({
  id,
  name: `${id}.pdf`,
  category: "",
  description: "",
  folderId,
  url: "https://example.com/x.pdf",
  size: 1_048_576,
  mime: "application/pdf",
  addedAt: 1_000,
  ...over,
});

// Vendors › Catering › Old quotes, Vendors › Photo, Venue
const FOLDERS = [
  folder("vendors", "Vendors"),
  folder("catering", "Catering", "vendors"),
  folder("photo", "Photo and video", "vendors"),
  folder("old", "Old quotes", "catering"),
  folder("venue", "Venue"),
];
const tree = folderTree(FOLDERS);

describe("the folder tree", () => {
  it("lists the folders in a folder by name, and the top level with null", () => {
    expect(tree.kids(null).map((f) => f.id)).toEqual(["vendors", "venue"]);
    expect(tree.kids("vendors").map((f) => f.id)).toEqual(["catering", "photo"]);
    expect(tree.kids("old")).toEqual([]);
  });

  it("gives the path from the top down, and nothing for the top level or an unknown folder", () => {
    expect(tree.path("old").map((f) => f.name)).toEqual(["Vendors", "Catering", "Old quotes"]);
    expect(tree.path(null)).toEqual([]);
    expect(tree.path("nope")).toEqual([]);
  });

  it("shows a folder whose parent is gone at the top, and survives a loop", () => {
    const odd = folderTree([folder("a", "A", "gone"), folder("x", "X", "y"), folder("y", "Y", "x")]);
    expect(odd.kids(null).map((f) => f.id)).toEqual(["a"]);
    expect(odd.path("x").length).toBeLessThanOrEqual(2);
    expect(odd.within("x").sort()).toEqual(["x", "y"]);
  });

  it("finds a folder and everything inside it", () => {
    expect(tree.within("vendors").sort()).toEqual(["catering", "old", "photo", "vendors"]);
  });

  it("names a place the way the toasts and sheets do", () => {
    expect(pathName([])).toBe("Files");
    expect(placeName(tree, "old")).toBe("Files › Vendors › Catering › Old quotes");
    expect(placeName(tree, null)).toBe("Files");
  });
});

describe("what a folder shows", () => {
  const files = [
    file("f1", "venue", { addedAt: 3_000 }),
    file("f2", "venue", { addedAt: 5_000 }),
    file("f3", "catering"),
    file("f4", null, { addedAt: null }),
    file("f5", "deleted-folder", { addedAt: 2_000 }),
  ];

  it("counts what is directly inside each folder, and lists files newest first", () => {
    const top = folderView(tree, files, null);
    expect(top.folders).toEqual([
      { id: "vendors", name: "Vendors", folders: 2, files: 0 },
      { id: "venue", name: "Venue", folders: 0, files: 2 },
    ]);
    // A file with no stamp yet leads; one whose folder is gone shows at the top rather than vanishing.
    expect(top.files.map((f) => f.id)).toEqual(["f4", "f5"]);
    expect(folderView(tree, files, "venue").files.map((f) => f.id)).toEqual(["f2", "f1"]);
  });

  it("words the counts", () => {
    expect(folderSub(2, 5)).toBe("2 folders, 5 files");
    expect(folderSub(0, 1)).toBe("1 file");
    expect(folderSub(0, 0)).toBe("Empty");
    expect(topSub(0, 0)).toBe("Contracts, quotes, receipts and photos");
    expect(topSub(14, 34_700_000)).toBe("14 files, 33,1 MB in all");
  });

  it("pages a long list and says how many more", () => {
    expect(paging(250, FILES_PAGE, FILES_PAGE)).toEqual({ shown: 100, more: 100 });
    expect(paging(250, 200, FILES_PAGE)).toEqual({ shown: 200, more: 50 });
    expect(paging(30, FILES_PAGE, FILES_PAGE)).toEqual({ shown: 30, more: 0 });
  });
});

describe("the search across every folder", () => {
  const files = [
    file("a", "venue", { name: "Villa Samaya contract.pdf", description: "Signed by both of us", addedAt: 1 }),
    file("b", "catering", { name: "Tasting menu.pdf", description: "Villa kitchen needs 3 days", addedAt: 2 }),
    file("c", null, { name: "Café receipt.jpg", addedAt: 3 }),
  ];

  it("looks at names and descriptions, ignoring case and accents, newest first", () => {
    expect(searchFiles(files, "villa").hits.map((f) => f.id)).toEqual(["b", "a"]);
    expect(searchFiles(files, "CAFE").hits.map((f) => f.id)).toEqual(["c"]);
    expect(searchFiles(files, "passport").hits).toEqual([]);
  });

  it("shows 200 at a time", () => {
    const lots = Array.from({ length: 450 }, (_, i) => file(`d${i}`, null, { name: `DSC_${i}.jpg`, addedAt: i }));
    const view = searchFiles(lots, "DSC");
    expect(view).toMatchObject({ shown: HITS_PAGE, more: HITS_PAGE });
    expect(view.hits).toHaveLength(450);
    expect(searchFiles(lots, "DSC", 400).more).toBe(50);
    expect(hitsCount(450, 200)).toBe("450 files in all folders, showing 200");
    expect(hitsCount(3, 3)).toBe("3 files in all folders");
  });
});

describe("the path above a folder", () => {
  it("is empty at the top, and leaves out the folder itself", () => {
    expect(crumbs(tree, null)).toEqual([]);
    expect(crumbs(tree, "vendors")).toEqual([{ id: null, name: "Files" }]);
    expect(crumbs(tree, "old")).toEqual([
      { id: null, name: "Files" },
      { id: "vendors", name: "Vendors" },
      { id: "catering", name: "Catering" },
    ]);
  });

  it("folds the middle past four levels, and unfolds on request", () => {
    const deep = folderTree(Array.from({ length: 12 }, (_, i) => folder(`l${i}`, `Level ${i}`, i ? `l${i - 1}` : null)));
    const folded = crumbs(deep, "l11");
    expect(folded).toHaveLength(4);
    expect(folded[0]).toEqual({ id: null, name: "Files" });
    expect(folded[1]).toBeNull();
    expect(folded.slice(2)).toEqual([
      { id: "l9", name: "Level 9" },
      { id: "l10", name: "Level 10" },
    ]);
    expect(crumbs(deep, "l11", true)).toHaveLength(12);
  });
});

describe("the move sheet's choices", () => {
  it("turns off where a file is, with its note", () => {
    const options = moveOptions(tree, { kind: "file", folderId: "catering" });
    expect(options[0]).toMatchObject({ id: null, name: "Files, the top level", disabled: false });
    const here = options.find((o) => o.id === "catering");
    expect(here).toMatchObject({ disabled: true, note: "(it's here now)" });
    expect(options.find((o) => o.id === "old")?.disabled).toBe(false);
  });

  it("turns off a folder, everything inside it and where it is now", () => {
    const options = moveOptions(tree, { kind: "folder", id: "catering", parentId: "vendors" });
    const by = (id: string) => options.find((o) => o.id === id);
    expect(by("catering")).toMatchObject({ disabled: true, note: "(this folder)" });
    expect(by("old")).toMatchObject({ disabled: true, note: "(inside it)" });
    expect(by("vendors")).toMatchObject({ disabled: true, note: "(it's here now)" });
    expect(by("photo")?.disabled).toBe(false);
    expect(by("venue")?.disabled).toBe(false);
    expect(options[0].disabled).toBe(false);
  });

  it("turns off the top level for a thing already there", () => {
    expect(moveOptions(tree, { kind: "folder", id: "venue", parentId: null })[0]).toMatchObject({
      disabled: true,
      note: "(it's here now)",
    });
  });

  it("lists in tree order and stops indenting at 12 levels", () => {
    expect(moveOptions(tree, { kind: "file", folderId: null }).map((o) => o.id)).toEqual([null, "vendors", "catering", "old", "photo", "venue"]);
    const deep = folderTree(Array.from({ length: 30 }, (_, i) => folder(`l${i}`, `Level ${i}`, i ? `l${i - 1}` : null)));
    const depths = moveOptions(deep, { kind: "file", folderId: null }).map((o) => o.depth);
    expect(Math.max(...depths)).toBe(12);
    expect(depths[1]).toBe(1);
  });

  it("says what travels with a moved folder", () => {
    const files = [file("f1", "old"), file("f2", "catering"), file("f3", "photo"), file("f4", null)];
    expect(holdings(tree, files, "catering")).toEqual({ files: 2, folders: 1 });
    expect(moveFolderSub({ files: 4, folders: 1 })).toBe("With everything inside it: 4 files and 1 folder.");
    expect(moveFolderSub({ files: 0, folders: 2 })).toBe("With everything inside it: 2 folders.");
    expect(moveFolderSub({ files: 0, folders: 0 })).toBe("With everything inside it.");
  });

  it("words Undo after the partner moved it again", () => {
    expect(movedAgainText("Bella", "Quote.pdf", "Files › Contracts")).toBe(
      "Can’t move it back: Bella has since moved Quote.pdf to Files › Contracts. It stays there.",
    );
    expect(movedAgainText("Bella", "Quote.pdf", null)).toContain("It stays where it is now");
  });
});

describe("folders: names and deleting", () => {
  it("refuses a name a sibling has, ignoring case, but not the folder's own", () => {
    expect(nameTaken(tree, "vendors", "catering")).toBe(true);
    expect(nameTaken(tree, "vendors", "  Catering ")).toBe(true);
    expect(nameTaken(tree, "vendors", "Catering", "catering")).toBe(false);
    expect(nameTaken(tree, "venue", "Catering")).toBe(false);
    expect(nameTaken(tree, null, "Vendors")).toBe(true);
  });

  it("explains what stops a delete, and asks about an empty one", () => {
    expect(emptyFirst("Catering", { files: 3, folders: 1 })).toEqual({
      title: "Empty Catering first",
      body: "It still holds 3 files and 1 folder. Move or delete them, then delete the folder.",
    });
    expect(deleteFolderConfirm("Rings")).toMatchObject({ title: "Delete Rings?", action: "Delete folder" });
  });
});

describe("a file's addresses", () => {
  const cloud = "https://res.cloudinary.com/demo/image/upload/v1/pics/a.jpg";

  it("asks Cloudinary for a thumbnail, a preview and a saved copy; other addresses stay as they are", () => {
    const image = { name: "a.jpg", mime: "image/jpeg", url: cloud };
    expect(thumbOf(image)).toContain("/image/upload/c_fill,w_320,h_192");
    expect(previewOf(image)).toContain("/image/upload/c_limit,w_800,h_360");
    expect(downloadUrl(cloud)).toBe("https://res.cloudinary.com/demo/image/upload/fl_attachment/v1/pics/a.jpg");
    expect(downloadUrl("https://res.cloudinary.com/demo/raw/upload/v1/q.pdf")).toContain("/raw/upload/fl_attachment/");
    expect(downloadUrl("https://example.com/q.pdf")).toBe("https://example.com/q.pdf");
    const pdf = { name: "q.pdf", mime: "application/pdf", url: "https://example.com/q.pdf" };
    expect(thumbOf(pdf)).toBeNull();
    expect(previewOf(pdf)).toBeNull();
    expect(previewOf({ name: "a.png", mime: "", url: "https://example.com/a.png" })).toBe("https://example.com/a.png");
  });

  it("dates a file by when it was added, or today when it has no stamp yet", () => {
    expect(addedOn({ addedAt: null }, "2026-10-19")).toBe("2026-10-19");
    expect(addedOn({ addedAt: new Date(2026, 6, 2, 12).getTime() }, "2026-10-19")).toBe("2026-07-02");
  });
});
