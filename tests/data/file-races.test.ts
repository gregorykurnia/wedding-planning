import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { deleteFolder, moveFile } from "@/lib/data/files";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

// Phase 4 review P4-S15: a folder's delete and a file's move racing each other.
// `getDocs` is wrapped so a test can make the partner's write land at an exact
// moment: just after the delete has checked that the folder is empty.

const hook: { afterQuery: (() => Promise<unknown>) | null; failQueries: number } = {
  afterQuery: null,
  failQueries: 0,
};

vi.mock("firebase/firestore", async (importOriginal) => {
  const real = await importOriginal<typeof import("firebase/firestore")>();
  return {
    ...real,
    getDocs: async (...args: Parameters<typeof real.getDocs>) => {
      if (hook.failQueries > 0) {
        hook.failQueries--;
        throw Object.assign(new Error("Could not reach Cloud Firestore backend"), { code: "unavailable" });
      }
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
  hook.failQueries = 0;
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
    // `changed`, so the confirm says something landed in it, not that the database is out of reach (P5-S6).
    await expect(deleteFolder("e", g())).rejects.toMatchObject({ code: "changed" });
    expect(await read("fileFolders", "e")).toMatchObject({ name: "Empty", parentId: "a" });
    expect((await read("weddingFiles", "f1"))?.folderId).toBe("e");
  });

  it("keeps the delete and its Undo when the second check can't run (P5-S6)", async () => {
    // The first check's two queries have both started; the second check's fail.
    hook.afterQuery = async () => {
      hook.failQueries = 2;
    };
    const removed = await deleteFolder("e", g());
    expect(await read("fileFolders", "e")).toBeUndefined();
    await removed.undo();
    expect(await read("fileFolders", "e")).toMatchObject({ name: "Empty", parentId: "a" });
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
