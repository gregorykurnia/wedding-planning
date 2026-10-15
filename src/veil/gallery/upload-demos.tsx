"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UploadQueue, type UploadDeps, type UploadTarget } from "@/lib/data/upload-queue";
import { realUploadDeps } from "@/lib/data/uploads";
import { MAX_UPLOAD_BYTES, savedName } from "@/lib/model/uploads";
import { FileTiles, type FileTileData } from "@/veil/parts/files/file-tiles";
import styles from "./gallery.module.css";

// Task 3.10: file tiles, the upload sheet and the pipeline behind them. The
// page uploads to a stand-in everywhere except against the Firebase emulators
// (NEXT_PUBLIC_USE_EMULATORS=1), where it runs the real pipeline: a request to
// Cloudinary (the end-to-end test answers it with a stub), a folder, a
// `weddingFiles` document and the record's old list, all in the emulator. A
// gallery visit never writes to the real wedding data or the real Cloudinary.

const USE_EMULATOR = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

export const GALLERY_VENDOR_ID = "gallery-vendor";

const TARGET: UploadTarget = {
  kind: "record",
  ref: { kind: "vendor", id: GALLERY_VENDOR_ID },
  recordName: "Kebun Bunga Atelier",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const never = () => new Promise<never>(() => {});

/** A stand-in file of a size the page chooses, without allocating it. */
function fakeFile(name: string, size: number, type: string): File {
  const file = new File([], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

const SAMPLE = [
  fakeFile("Signed contract scan hold.pdf", 14.2 * 1_048_576, "application/pdf"),
  fakeFile("Transfer receipt hold.jpg", 2.1 * 1_048_576, "image/jpeg"),
  fakeFile("All photos.zip", 48 * 1_048_576, "application/zip"),
  fakeFile("Invoice fail.pdf", 380 * 1024, "application/pdf"),
];

type Switches = { slow: boolean; fail: boolean; stillOver: boolean };

// The stand-in pipeline reads these as it runs, so a switch changes uploads already under way.
const SWITCHES: Switches = { slow: true, fail: false, stillOver: false };

/**
 * The stand-in pipeline. A name with "hold" stops at 62% for good, a name with
 * "fail" (or the switch) fails once it is under way, and a PDF over the limit
 * shrinks to about half, or to 10,5 MB with the switch on.
 */
function standInDeps(
  switches: () => Switches,
  addFile: (file: FileTileData) => void,
  renameFile: (id: string, name: string) => void,
): UploadDeps {
  let count = 0;
  const failedOnce = new Set<string>();
  return {
    shrink: async (file) => {
      await sleep(switches().slow ? 1500 : 30);
      if (file.name.includes("hold")) await never();
      return fakeFile(file.name, switches().stillOver ? 10.5 * 1_048_576 : Math.round(file.size * 0.55), file.type);
    },
    send: async (file, onProgress) => {
      const total = file.size;
      for (const share of [0.2, 0.4, 0.62]) {
        await sleep(switches().slow ? 450 : 15);
        onProgress(Math.round(total * share), total);
        if (share === 0.4 && (switches().fail || (file.name.includes("fail") && !failedOnce.has(file.name)))) {
          failedOnce.add(file.name);
          throw new Error("Upload failed");
        }
      }
      if (file.name.includes("hold")) await never();
      await sleep(switches().slow ? 450 : 15);
      onProgress(total, total);
      return {
        publicId: `gallery/${file.name}`,
        url: file.size > 0 ? URL.createObjectURL(file) : `https://example.com/${encodeURIComponent(file.name)}`,
        resourceType: "auto",
        format: "",
        bytes: total,
      };
    },
    save: async ({ docId, asset, originalName, mime, fields }) => {
      await sleep(switches().slow ? 300 : 10);
      addFile({ id: docId, name: savedName(originalName, fields.name), url: asset.url, size: asset.bytes, mime });
      return docId;
    },
    rename: async (docId, originalName, fields) => {
      renameFile(docId, savedName(originalName, fields.name));
    },
    newDocId: () => `stand-in-${++count}`,
  };
}

/** The emulator's `weddingFiles` documents for the gallery's vendor, as tiles. */
function useEmulatorFiles(): FileTileData[] {
  const [files, setFiles] = useState<FileTileData[]>([]);
  useEffect(() => {
    if (!USE_EMULATOR || !db) return;
    return onSnapshot(
      query(collection(db, "weddingFiles"), where("recordRef.id", "==", GALLERY_VENDOR_ID)),
      (snapshot) =>
        setFiles(
          snapshot.docs.map((d) => ({
            id: d.id,
            name: String(d.get("name") ?? ""),
            url: String(d.get("url") ?? ""),
            size: Number(d.get("fileSize") ?? 0),
            mime: String(d.get("fileType") ?? ""),
          })),
        ),
    );
  }, []);
  return files;
}

export function UploadDemo() {
  const [demo, setDemo] = useState(false);
  const [on, setOn] = useState<Switches>({ ...SWITCHES });
  const [stood, setStood] = useState<FileTileData[]>([]);
  const emulated = useEmulatorFiles();

  const flip = (key: keyof Switches) => (checked: boolean) => {
    SWITCHES[key] = checked;
    setOn({ ...SWITCHES });
  };

  const [queue] = useState(
    () =>
      new UploadQueue(
        TARGET,
        USE_EMULATOR
          ? realUploadDeps()
          : standInDeps(
              () => SWITCHES,
              (file) => setStood((current) => [...current, file]),
              (id, name) => setStood((current) => current.map((f) => (f.id === id ? { ...f, name } : f))),
            ),
      ),
  );
  useEffect(() => {
    queue.configure(TARGET, demo);
  }, [queue, demo]);

  return (
    <div className={styles.demo}>
      <div className={styles.controls} role="group" aria-label="Demo switches">
        <label>
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Demonstration mode
        </label>
        {USE_EMULATOR ? null : (
          <>
            <label>
              <input type="checkbox" checked={on.slow} onChange={(e) => flip("slow")(e.target.checked)} /> Slow uploads
            </label>
            <label>
              <input type="checkbox" checked={on.fail} onChange={(e) => flip("fail")(e.target.checked)} /> Make uploads fail
            </label>
            <label>
              <input type="checkbox" checked={on.stillOver} onChange={(e) => flip("stillOver")(e.target.checked)} /> A shrunk PDF
              stays over the limit
            </label>
          </>
        )}
      </div>
      <p className={styles.note}>
        Uploading to: {USE_EMULATOR ? "the emulator, through Cloudinary (stubbed by the test)" : "a stand-in held in this page"}.
        Limit {Math.round(MAX_UPLOAD_BYTES / 1_048_576)} MB. A name with “hold” stops at 62%; one with “fail” fails once, so Try again works.
      </p>

      <h3 className={styles.subheading}>Files on a record</h3>
      <div role="group" aria-label="Files on a record">
        <FileTiles
          files={USE_EMULATOR ? emulated : [...SAMPLE_FILES, ...stood]}
          queue={queue}
        />
      </div>
      <p>
        <button type="button" onClick={() => queue.add(SAMPLE)}>
          Add one of every state
        </button>
      </p>
    </div>
  );
}

const SAMPLE_FILES: FileTileData[] = [
  { id: "sample-1", name: "Quote from the florist.pdf", url: "#", size: 2.4 * 1_048_576, mime: "application/pdf" },
  { id: "sample-2", name: "Mood board.xlsx", url: "#", size: 310 * 1024, mime: "" },
  { id: "sample-3", name: "Menu for the finalist.pdf", url: "#", size: 1.1 * 1_048_576, mime: "application/pdf", fromVendor: true },
  { id: "sample-4", name: "A name that goes on and on and on and on for the stress test of a tile.pdf", url: "#", size: 90 * 1024, mime: "application/pdf" },
];
