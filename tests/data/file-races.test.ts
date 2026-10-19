import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { deleteFolder, moveFile } from "@/lib/data/files";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

// Phase 4 review P4-S15: a folder's delete and a file's move racing each other.
// `getDocs` is wrapped so a test can make the partner's write land at an exact
// moment: just after the delete has checked that the folder is empty.

const hook: { afterQuery: (() => Promise<unknown>) | null } = { afterQuery: null };

vi.mock("firebase/firestore", async (importOriginal) => {
  const real = await importOriginal<typeof import("firebase/firestore")>();
  return {
    ...real,
    getDocs: async (...args: Parameters<typeof real.getDocs>) => {
      const result = await real.getDocs(...args);
      const run = hook.afterQuery;
      hook.afterQuery = null;
      if (run) await run();
      return result;
    },
  };
});

let gregory: Partner;
let bella: Partner;

beforeAll(async () => {
  [gregory, bella] = await twoPartners();
});

afterAll(async () => {
  await Promise.all([closeClient(gregory), closeClient(bella)]);
});

beforeEach(async () => {
  hook.afterQuery = null;
  await clearFirestore();
  await setDoc(doc(gregory.db, "fileFolders", "a"), { name: "Vendors", parentId: null });
  await setDoc(doc(gregory.db, "fileFolders", "e"), { name: "Empty", parentId: "a" });
  await setDoc(doc(gregory.db, "weddingFiles", "f1"), { name: "Quote.pdf", folderId: "a" });
});

const g = () => ({ db: gregory.db });
const b = () => ({ db: bella.db });
const read = async (col: string, id: string) => (await getDoc(doc(gregory.db, col, id))).data();

describe("a folder deleted while a file moves into it", () => {
  it("keeps the folder when the file lands after the empty check", async () => {
    hook.afterQuery = () => moveFile("f1", "e", b());
    await expect(deleteFolder("e", g())).rejects.toMatchObject({ code: "failed" });
    expect(await read("fileFolders", "e")).toMatchObject({ name: "Empty", parentId: "a" });
    expect((await read("weddingFiles", "f1"))?.folderId).toBe("e");
  });

  it("refuses to move a file into a folder that's gone, and the file stays where it was", async () => {
    await deleteFolder("e", g());
    await expect(moveFile("f1", "e", b())).rejects.toMatchObject({ code: "missing" });
    expect((await read("weddingFiles", "f1"))?.folderId).toBe("a");
  });

  it("won't undo a move back into a folder deleted since", async () => {
    const moved = await moveFile("f1", "e", g());
    // "Vendors" is empty of files now; the partner empties it of folders and deletes it.
    await setDoc(doc(gregory.db, "fileFolders", "e"), { name: "Empty", parentId: null });
    await deleteFolder("a", b());
    await expect(moved.undo()).rejects.toMatchObject({ code: "missing" });
    expect((await read("weddingFiles", "f1"))?.folderId).toBe("e");
  });
});
