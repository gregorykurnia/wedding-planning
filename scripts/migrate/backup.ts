/**
 * A JSON dump of every collection, taken before any migration writes
 * (Task 1.11). The project has no Cloud Storage bucket for a managed export,
 * so this is the backup: `backups/` is git-ignored and stays on this machine.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=… npx tsx scripts/migrate/backup.ts
 *
 * Timestamps are kept as { "__timestamp": "<ISO time>" } so a restore can
 * turn them back.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GeoPoint, Timestamp, DocumentReference, type Firestore } from "firebase-admin/firestore";
import { connect } from "./admin";

export const BACKUP_DIR = "backups";

function plain(value: unknown): unknown {
  if (value instanceof Timestamp) return { __timestamp: value.toDate().toISOString() };
  if (value instanceof GeoPoint) return { __geopoint: [value.latitude, value.longitude] };
  if (value instanceof DocumentReference) return { __ref: value.path };
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

export async function backup(db: Firestore, projectId: string): Promise<{ file: string; counts: Record<string, number> }> {
  const out: Record<string, Record<string, unknown>> = {};
  const counts: Record<string, number> = {};
  for (const col of await db.listCollections()) {
    const snap = await col.get();
    out[col.id] = Object.fromEntries(snap.docs.map((d) => [d.id, plain(d.data())]));
    counts[col.id] = snap.size;
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(BACKUP_DIR, `firestore-${projectId}-${stamp}.json`);
  writeFileSync(file, JSON.stringify({ projectId, takenAt: new Date().toISOString(), collections: out }, null, 2));
  return { file, counts };
}

if (process.argv[1]?.endsWith("backup.ts")) {
  const { db, projectId } = connect();
  backup(db, projectId).then(
    ({ file, counts }) => {
      console.log(`Backup of ${projectId} written to ${file}`);
      for (const [name, n] of Object.entries(counts)) console.log(`  ${name}: ${n}`);
    },
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
