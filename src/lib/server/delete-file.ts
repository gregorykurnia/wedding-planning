import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { isObject, str } from "@/lib/data/adapters/common";
import { cloudinaryAsset, legacyPlace, recordRef } from "@/lib/data/adapters/files";
import type { Asset } from "./cloudinary";
import { RequestError } from "./request-error";

/**
 * Delete for good (R13, guide §6.2 "Permanent"; plan Task 6.3). Everything is
 * read here on the server: the client sends only the file's id, never a
 * Cloudinary public id, so a wrong or forged request can't point at another
 * asset. Order:
 *
 * 1. Read the `weddingFiles` document. Gone already: nothing to do.
 * 2. Work out its asset from the stored address, cross-checked against the
 *    stored public id and type. Anything that doesn't add up is refused and
 *    nothing changes.
 * 3. Destroy the asset, unless another file in Files uses the same one.
 * 4. In one transaction, delete the document and take the address out of the
 *    old `files[]` arrays on vendors, venues, finalists, what-if items and
 *    their parts, so the old UI and `filesForRecord` don't show a dead file.
 *
 * Every step can run twice: a retry after a failure part-way finds the asset
 * already gone (Cloudinary answers "not found") and carries on.
 */
const FILES = "weddingFiles";
const LEGACY_COLLECTIONS = ["vendors", "venues", "shortlist", "hypotheticalItems"] as const;
const RESOURCE_TYPES = new Set(["image", "video", "raw"]);

export interface DeleteResult {
  result: "deleted" | "already-gone";
  /** What happened to the Cloudinary asset. `kept` when another file uses it. */
  asset?: "destroyed" | "already-gone" | "kept";
  /** Copies of the address taken out of old `files[]` arrays. */
  legacyCopiesRemoved?: number;
}

export interface DeleteDeps {
  /** The app's Cloudinary cloud; an address on any other cloud is refused. */
  cloudName: string;
  destroy: (asset: Asset) => Promise<"destroyed" | "already-gone">;
}

/** A Firestore document id as the client could have made it, nothing more. */
export function isDocumentId(id: string): boolean {
  return id.length > 0 && id.length <= 1500 && !id.includes("/") && id !== "." && id !== ".." && !/^__.*__$/.test(id);
}

/**
 * The asset a file document points at. The address must be a plain upload on
 * our cloud, and a stored public id or type must agree with it; otherwise the
 * request is refused (422), because guessing could destroy the wrong file.
 */
export function assetOf(data: Record<string, unknown>, cloudName: string): Asset {
  const parsed = cloudinaryAsset(str(data.url));
  if (!parsed || !parsed.publicId) {
    throw new RequestError(422, "unknown-asset", "The file's address isn't a Cloudinary upload, so its asset can't be found");
  }
  if (parsed.cloudName !== cloudName) {
    throw new RequestError(422, "unknown-asset", "The file is stored in another Cloudinary account");
  }
  const storedId = str(data.publicId);
  const storedType = str(data.resourceType);
  if ((storedId && storedId !== parsed.publicId) || (RESOURCE_TYPES.has(storedType) && storedType !== parsed.resourceType)) {
    throw new RequestError(422, "unknown-asset", "The file's stored id doesn't match its address");
  }
  return { resourceType: parsed.resourceType as Asset["resourceType"], publicId: parsed.publicId };
}

/** Whether an address points at this asset (any version or transformation of it). */
function pointsAt(url: unknown, asset: Asset, cloudName: string): boolean {
  const parsed = cloudinaryAsset(str(url));
  return (
    parsed !== null &&
    parsed.cloudName === cloudName &&
    parsed.resourceType === asset.resourceType &&
    parsed.publicId === asset.publicId
  );
}

function withoutMatches(raw: unknown, matches: (url: unknown) => boolean): { files: unknown[]; removed: number } | null {
  if (!Array.isArray(raw)) return null;
  const files = raw.filter((f) => !(isObject(f) && matches(f.url)));
  return files.length === raw.length ? null : { files, removed: raw.length - files.length };
}

/**
 * The fields to write so a record's old `files[]` no longer hold the address:
 * the record's own list and every part's (`partId` undefined), only the
 * record's own (`null`), or only one part's. Parts saved without an id are
 * `legacy-<index>`, as in the write layer.
 */
export function stripLegacyFiles(
  data: Record<string, unknown>,
  matches: (url: unknown) => boolean,
  partId?: string | null,
): { update: Record<string, unknown>; removed: number } {
  const update: Record<string, unknown> = {};
  let removed = 0;
  if (partId === undefined || partId === null) {
    const own = withoutMatches(data.files, matches);
    if (own) {
      update.files = own.files;
      removed += own.removed;
    }
  }
  if (partId !== null && Array.isArray(data.subEntries)) {
    let changed = false;
    const parts = data.subEntries.map((part, index) => {
      if (!isObject(part)) return part;
      const id = typeof part.id === "string" && part.id ? part.id : `legacy-${index}`;
      if (partId !== undefined && id !== partId) return part;
      const files = withoutMatches(part.files, matches);
      if (!files) return part;
      changed = true;
      removed += files.removed;
      return { ...part, files: files.files };
    });
    if (changed) update.subEntries = parts;
  }
  return { update, removed };
}

export async function deleteFileForGood(
  db: Firestore,
  fileId: string,
  caller: { uid: string },
  deps: DeleteDeps,
): Promise<DeleteResult> {
  if (!isDocumentId(fileId)) throw new RequestError(400, "bad-id", "That isn't a file id");
  const fileRef = db.collection(FILES).doc(fileId);
  const snap = await fileRef.get();
  if (!snap.exists) return { result: "already-gone" };
  const data = snap.data() ?? {};
  const url = str(data.url);
  const asset = assetOf(data, deps.cloudName);
  const matches = (u: unknown) => u === url || pointsAt(u, asset, deps.cloudName);

  // Another file in Files on the same asset keeps it alive. Any doubt counts
  // as shared: a kept asset costs storage, a destroyed one can't come back.
  const [byUrl, byId] = await Promise.all([
    db.collection(FILES).where("url", "==", url).get(),
    db.collection(FILES).where("publicId", "==", asset.publicId).get(),
  ]);
  const shared = [...byUrl.docs, ...byId.docs].some((d) => {
    if (d.id === fileId) return false;
    const type = str(d.get("resourceType"));
    return (
      matches(d.get("url")) ||
      (str(d.get("publicId")) === asset.publicId && (!RESOURCE_TYPES.has(type) || type === asset.resourceType))
    );
  });

  const assetResult = shared ? "kept" : await deps.destroy(asset);

  // With the asset gone, every old copy of its address is dead, wherever it
  // is. With it kept, only this file's own record loses it.
  let candidates: DocumentReference[];
  let partId: string | null | undefined;
  if (shared) {
    const place = (() => {
      const ref = recordRef(data.recordRef);
      return ref ? legacyPlace(ref) : null;
    })();
    candidates = place ? [db.collection(place.collection).doc(place.docId)] : [];
    partId = place?.partId;
  } else {
    const scans = await Promise.all(LEGACY_COLLECTIONS.map((c) => db.collection(c).get()));
    candidates = scans.flatMap((s) => s.docs.filter((d) => stripLegacyFiles(d.data(), matches).removed > 0).map((d) => d.ref));
    partId = undefined;
  }

  const legacyCopiesRemoved = await db.runTransaction(async (tx) => {
    const current = await tx.get(fileRef);
    const records = candidates.length ? await tx.getAll(...candidates) : [];
    let removed = 0;
    for (const record of records) {
      if (!record.exists) continue;
      const strip = stripLegacyFiles(record.data() ?? {}, matches, partId);
      if (!strip.removed) continue;
      removed += strip.removed;
      tx.update(record.ref, { ...strip.update, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid });
    }
    if (current.exists) tx.delete(fileRef);
    return removed;
  });

  return { result: "deleted", asset: assetResult, legacyCopiesRemoved };
}
