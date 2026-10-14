import { FieldValue, Timestamp, type DocumentReference, type Firestore, type WriteBatch } from "firebase-admin/firestore";

/**
 * A migration first plans every write from the data as it is, so a dry run
 * prints exactly what a real run would do. Each update carries the document's
 * update time from the plan as a precondition: if either of you changes that
 * record between the plan and the write, the write fails instead of
 * overwriting the change, and running the migration again plans afresh.
 */
export type PlannedWrite =
  | { kind: "create"; ref: DocumentReference; data: Record<string, unknown>; note: string }
  | { kind: "update"; ref: DocumentReference; data: Record<string, unknown>; note: string; updateTime: Timestamp }
  | { kind: "merge"; ref: DocumentReference; data: Record<string, unknown>; note: string };

export interface Plan {
  writes: PlannedWrite[];
  /** Lines for the owner: anything skipped, ambiguous or worth a look. */
  report: string[];
}

export interface Migration {
  name: string;
  title: string;
  /** Plans the writes. Run twice, the second plan is empty (idempotent). */
  plan: (db: Firestore) => Promise<Plan>;
}

const PER_BATCH = 400;

export async function applyPlan(db: Firestore, plan: Plan): Promise<number> {
  let written = 0;
  for (let i = 0; i < plan.writes.length; i += PER_BATCH) {
    const batch: WriteBatch = db.batch();
    for (const w of plan.writes.slice(i, i + PER_BATCH)) {
      if (w.kind === "create") batch.create(w.ref, w.data);
      else if (w.kind === "update") batch.update(w.ref, w.data, { lastUpdateTime: w.updateTime });
      else batch.set(w.ref, w.data, { merge: true });
    }
    await batch.commit();
    written += Math.min(PER_BATCH, plan.writes.length - i);
  }
  return written;
}

/** Appends this run to `appMeta/migrations` (read by the app, written only here). */
export async function recordRun(db: Firestore, name: string, written: number, report: string[]) {
  await db.doc("appMeta/migrations").set(
    {
      [name]: { ranAt: FieldValue.serverTimestamp(), written, report },
      runs: FieldValue.arrayUnion({ name, at: Timestamp.now(), written }),
    },
    { merge: true },
  );
}

/** The fields every migrated write adds. */
export const migrated = () => ({ updatedAt: FieldValue.serverTimestamp(), updatedBy: "migration" });
export const created = () => ({
  createdAt: FieldValue.serverTimestamp(),
  createdBy: "migration",
  ...migrated(),
});

export function describe(w: PlannedWrite): string {
  const fields = Object.keys(w.data).filter((k) => !["updatedAt", "updatedBy", "createdAt", "createdBy"].includes(k));
  return `${w.kind.padEnd(6)} ${w.ref.path}  ${w.note}${fields.length ? `  [${fields.join(", ")}]` : ""}`;
}
