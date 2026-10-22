/**
 * Read-only checks of the data before the switch-over reaches production
 * (Task 7.1; the owner runs them on production from `redesign/before-merge.md`).
 * They write nothing, so they need no backup and no --apply.
 *
 *   npx tsx scripts/migrate/checks.ts            every check
 *   npx tsx scripts/migrate/checks.ts files      one: files | documents
 *
 * - files (review P1-S15): `weddingFiles` holding the same address more than
 *   once, as package files copied from a vendor's parts may have been filed
 *   twice. A cleanup migration is written only if this finds any.
 * - documents (review P5-S8): `notes` the new editor refuses to open because
 *   they break a content rule (`nodeFromJSON(normaliseDoc(c)).check()`, as the
 *   editor checks), so they open empty and read-only.
 *
 * The old-UI drift (P1-S11, P1-S12, P1-S13) is checked by the migrations' own
 * dry runs: `npm run migrate 2-guest-numbers 6-started-on 8-old-ui-sync`.
 */
import { getSchema } from "@tiptap/core";
import type { Firestore } from "firebase-admin/firestore";
import { documentFromDoc } from "../../src/lib/data/adapters/documents";
import { docExtensions } from "../../src/veil/editor/marks";
import { connect } from "./admin";

export interface CheckResult {
  name: string;
  /** How many problems it found; 0 is a pass. */
  found: number;
  report: string[];
}

const describeRef = (raw: unknown): string => {
  if (typeof raw !== "object" || raw === null) return "no record";
  const r = raw as { kind?: unknown; id?: unknown; partId?: unknown };
  return `${String(r.kind)} ${String(r.id)}${r.partId ? ` › ${String(r.partId)}` : ""}`;
};

export async function doubledFiles(db: Firestore): Promise<CheckResult> {
  const docs = (await db.collection("weddingFiles").get()).docs;
  const byUrl = new Map<string, typeof docs>();
  for (const d of docs) {
    const url = d.get("url");
    if (typeof url !== "string" || !url) continue;
    byUrl.set(url, [...(byUrl.get(url) ?? []), d]);
  }
  const doubled = [...byUrl.entries()].filter(([, group]) => group.length > 1);
  const report = doubled.length
    ? doubled.flatMap(([url, group]) => [
        `${group.length}× ${url}`,
        ...group.map((d) => `    ${d.id}  "${d.get("name") ?? ""}"  ${describeRef(d.get("recordRef"))}`),
      ])
    : [`No address is filed twice (${docs.length} files).`];
  return { name: "files", found: doubled.length, report };
}

export async function refusedDocuments(db: Firestore): Promise<CheckResult> {
  const schema = getSchema(docExtensions());
  const docs = (await db.collection("notes").get()).docs;
  const report: string[] = [];
  for (const d of docs) {
    const doc = documentFromDoc(d.id, d.data());
    try {
      schema.nodeFromJSON(doc.content).check();
    } catch (err) {
      report.push(`${d.id}  "${doc.title}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const found = report.length;
  if (!found) report.push(`Every document opens (${docs.length} documents).`);
  return { name: "documents", found, report };
}

const CHECKS: Record<string, (db: Firestore) => Promise<CheckResult>> = {
  files: doubledFiles,
  documents: refusedDocuments,
};

export async function check(names: string[], log: (line: string) => void = console.log): Promise<CheckResult[]> {
  const chosen = names.length ? names : Object.keys(CHECKS);
  const unknown = chosen.filter((n) => !(n in CHECKS));
  if (unknown.length) throw new Error(`Unknown check: ${unknown.join(", ")}. Choose from ${Object.keys(CHECKS).join(", ")}.`);
  const { db, projectId, emulator } = connect("checks");
  log(`Read-only checks on ${projectId}${emulator ? " (emulator)" : ""}`);
  const results: CheckResult[] = [];
  for (const name of chosen) {
    const result = await CHECKS[name](db);
    log(`\n== ${name}: ${result.found ? `${result.found} found` : "fine"}`);
    for (const line of result.report) log(`  ${line}`);
    results.push(result);
  }
  return results;
}

if (process.argv[1]?.endsWith("checks.ts")) {
  check(process.argv.slice(2)).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
