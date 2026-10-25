/**
 * One-time rename of the categories to the wedding items' words (2026-10-25).
 * A dry run is the default: it prints every change and writes nothing.
 *
 *   set -a; . ./.env.local; set +a
 *   npx tsx scripts/categories-2026-10.mts            dry run
 *   npx tsx scripts/categories-2026-10.mts --apply    backs up, then writes
 *
 * It signs in as the app does (anonymously, under the open-access rules), so it
 * needs no service account. It stores the common categories (DEFAULT_CATEGORIES)
 * in place of the old stored ones, moves every vendor, finalist, package and
 * what-if item from an old name to its new one (RENAMED), and files each
 * wedding item that has no category yet. The backup of the five collections
 * goes to backups/ (git-ignored) before anything is written.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { collection, doc, getDocs, getFirestore, serverTimestamp, writeBatch, type DocumentData } from "firebase/firestore";
import { DEFAULT_CATEGORIES, DEFAULT_STORED, OTHER_CATEGORY } from "../src/lib/model/categories";
import { COMMON_ITEM_CATEGORIES } from "../src/lib/model/items";

/** Old name → new. Names not here (Decoration, Groom Suit, Transportation, Wedding Cake, Wedding Organizer, Venue, Other) stay. */
const RENAMED: Record<string, string> = {
  Food: "Catering",
  "Music/DJ": "Entertainment",
  "Photos and Videos": "Photo and Video",
  "Bride Dress": "Bridal Gown",
  "Makeup Artist": "Make Up Artist",
  Invites: "Invitation",
  "Venue Sangjit": "Venue",
  "Sangjit MC": "MC",
};

/** Wedding items added since the common list, by name. */
const ITEM_BY_NAME: Record<string, string> = {
  "Bride Heels": "Shoes and Accessories",
  "Bridal Gown": "Bridal Gown",
};

const COLLECTIONS = ["vendorCategories", "vendors", "shortlist", "hypotheticalItems", "masterListItems"] as const;
const PER_BATCH = 400;

const apply = process.argv.includes("--apply");
const env = process.env;
if (!env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) throw new Error("Load .env.local first: set -a; . ./.env.local; set +a");

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const { user } = await signInAnonymously(getAuth(app));
const db = getFirestore(app);

const data: Record<string, { id: string; data: DocumentData }[]> = {};
for (const name of COLLECTIONS) {
  data[name] = (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, data: d.data() }));
}

const renamed = (name: unknown) => (typeof name === "string" && name in RENAMED ? RENAMED[name] : null);
const known = new Set<string>([...DEFAULT_CATEGORIES, OTHER_CATEGORY]);
const unknown = new Map<string, number>();
const note = (name: unknown) => {
  if (typeof name === "string" && name && !known.has(renamed(name) ?? name)) unknown.set(name, (unknown.get(name) ?? 0) + 1);
};

type Write = { kind: "set" | "update" | "delete"; collection: string; id: string; patch?: DocumentData; says: string };
const writes: Write[] = [];

// The categories themselves: the common ones in place of the old stored ones.
const defaultIds = new Set(DEFAULT_STORED.map((c) => c.id));
for (const c of data.vendorCategories) {
  if (defaultIds.has(c.id)) continue;
  const to = renamed(c.data.name);
  if (to || known.has(c.data.name)) writes.push({ kind: "delete", collection: "vendorCategories", id: c.id, says: `remove stored "${c.data.name}" (now ${to ?? c.data.name})` });
  else unknown.set(String(c.data.name), (unknown.get(String(c.data.name)) ?? 0) + 1);
}
for (const c of DEFAULT_STORED) {
  if (data.vendorCategories.some((s) => s.id === c.id)) continue;
  writes.push({ kind: "set", collection: "vendorCategories", id: c.id, patch: { name: c.name, createdAt: serverTimestamp(), createdBy: user.uid }, says: `store "${c.name}"` });
}

for (const v of data.vendors) {
  const patch: DocumentData = {};
  for (const key of ["category", "confirmedType"]) {
    note(v.data[key]);
    const to = renamed(v.data[key]);
    if (to) patch[key] = to;
  }
  if (Object.keys(patch).length) writes.push({ kind: "update", collection: "vendors", id: v.id, patch, says: `vendor "${v.data.name}": ${v.data.category} → ${patch.category ?? v.data.category}` });
}

for (const f of data.shortlist) {
  const patch: DocumentData = {};
  note(f.data.type);
  const to = renamed(f.data.type);
  if (to) patch.type = to;
  if (Array.isArray(f.data.subEntries) && f.data.subEntries.some((p: DocumentData) => renamed(p?.type))) {
    patch.subEntries = f.data.subEntries.map((p: DocumentData) => (renamed(p?.type) ? { ...p, type: renamed(p.type) } : p));
  }
  if (Object.keys(patch).length) writes.push({ kind: "update", collection: "shortlist", id: f.id, patch, says: `finalist "${f.data.name}": ${f.data.type} → ${patch.type ?? f.data.type}` });
}

for (const w of data.hypotheticalItems) {
  note(w.data.type);
  const to = renamed(w.data.type);
  if (to) writes.push({ kind: "update", collection: "hypotheticalItems", id: w.id, patch: { type: to }, says: `what-if "${w.data.name}": ${w.data.type} → ${to}` });
}

const unfiled: string[] = [];
for (const i of data.masterListItems) {
  if (typeof i.data.category === "string" && i.data.category) continue;
  const to = COMMON_ITEM_CATEGORIES[i.id] ?? ITEM_BY_NAME[String(i.data.item).trim()];
  if (!to) unfiled.push(String(i.data.item));
  writes.push({ kind: "update", collection: "masterListItems", id: i.id, patch: { category: to ?? OTHER_CATEGORY }, says: `item "${i.data.item}" → ${to ?? OTHER_CATEGORY}` });
}

for (const w of writes) console.log(`${w.kind.padEnd(6)} ${w.collection}/${w.id}: ${w.says}`);
const tally = (c: string) => writes.filter((w) => w.collection === c).length;
console.log(`\n${writes.length} writes: ${COLLECTIONS.map((c) => `${c} ${tally(c)}`).join(", ")}`);
if (unknown.size) console.log(`Names that aren't a category and stay as they are: ${[...unknown].map(([n, k]) => `${n} (${k})`).join(", ")}`);
if (unfiled.length) console.log(`Items with no category found, filed under Other: ${unfiled.join(", ")}`);

if (!apply) {
  console.log("\nDry run: nothing written. Add --apply to back up and write.");
  process.exit(0);
}

mkdirSync("backups", { recursive: true });
const backup = join("backups", `categories-${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(backup, JSON.stringify(data, null, 1));
console.log(`\nBackup: ${backup}`);

const stamp = { updatedAt: serverTimestamp(), updatedBy: user.uid };
for (let from = 0; from < writes.length; from += PER_BATCH) {
  const batch = writeBatch(db);
  for (const w of writes.slice(from, from + PER_BATCH)) {
    const ref = doc(db, w.collection, w.id);
    if (w.kind === "delete") batch.delete(ref);
    else if (w.kind === "set") batch.set(ref, { ...w.patch, ...stamp });
    else batch.update(ref, { ...w.patch, ...stamp });
  }
  await batch.commit();
}
console.log(`Wrote ${writes.length} changes.`);
process.exit(0);
