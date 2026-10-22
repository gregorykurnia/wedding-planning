/**
 * Runs the Task 1.11 migrations. A dry run is the default: it prints every
 * write it would make and the report, and writes nothing.
 *
 *   npx tsx scripts/migrate/run.ts all            dry run of every migration
 *   npx tsx scripts/migrate/run.ts 3-bookings     dry run of one
 *   npx tsx scripts/migrate/run.ts all --apply    writes, then records the run
 *                                                 in appMeta/migrations
 *   ... --apply --force                           runs again one already recorded
 *
 * --apply refuses a migration already recorded in appMeta/migrations unless
 * --force is given: run again, migrations 1 and 5 would bring back a funder or
 * a file deleted since (review P1-S14). Re-runs before the switch-over use it.
 * --apply needs a backup taken in the last 24 hours (scripts/migrate/backup.ts)
 * unless it runs against the emulator. Migrations run in order, each planned
 * after the one before has been written.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { connect } from "./admin";
import { BACKUP_DIR } from "./backup";
import { MIGRATIONS } from "./migrations";
import { applyPlan, describe, recordRun } from "./plan";

const DAY = 24 * 60 * 60 * 1000;

function recentBackup(projectId: string): string | null {
  if (!existsSync(BACKUP_DIR)) return null;
  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(`firestore-${projectId}-`) && f.endsWith(".json"))
    .map((f) => join(BACKUP_DIR, f))
    .filter((f) => Date.now() - statSync(f).mtimeMs < DAY);
  return files.sort().at(-1) ?? null;
}

export async function run(
  names: string[],
  apply: boolean,
  log: (line: string) => void = console.log,
  force = false,
) {
  const { db, projectId, emulator } = connect();
  const unknown = names.filter((n) => n !== "all" && !MIGRATIONS.some((m) => m.name === n));
  if (unknown.length) throw new Error(`No migration called ${unknown.join(", ")}`);
  const chosen = names.includes("all") ? MIGRATIONS : MIGRATIONS.filter((m) => names.includes(m.name));
  if (chosen.length === 0) throw new Error(`Name a migration or "all": ${MIGRATIONS.map((m) => m.name).join(", ")}`);
  if (apply && !force) {
    const recorded = (await db.doc("appMeta/migrations").get()).data() ?? {};
    const ran = chosen.filter((m) => m.name in recorded).map((m) => m.name);
    if (ran.length) throw new Error(`Already run: ${ran.join(", ")}. Add --force to run again.`);
  }
  if (apply && !emulator) {
    const found = recentBackup(projectId);
    if (!found) throw new Error("No backup from the last 24 hours. Run scripts/migrate/backup.ts first.");
    log(`Backup: ${found}`);
  }
  log(`${apply ? "APPLYING to" : "Dry run on"} ${projectId}${emulator ? " (emulator)" : ""}`);
  const results: { name: string; planned: number; written: number; report: string[] }[] = [];
  for (const m of chosen) {
    const plan = await m.plan(db);
    log(`\n== ${m.name}: ${m.title}`);
    log(plan.writes.length ? `${plan.writes.length} write(s):` : "Nothing to change.");
    for (const w of plan.writes) log(`  ${describe(w)}`);
    for (const line of plan.report) log(`  · ${line}`);
    let written = 0;
    if (apply && plan.writes.length) {
      written = await applyPlan(db, plan);
      log(`  Wrote ${written}.`);
    }
    if (apply) await recordRun(db, m.name, written, plan.report);
    results.push({ name: m.name, planned: plan.writes.length, written, report: plan.report });
  }
  if (!apply) log("\nDry run: nothing was written. Add --apply to write (through npm: npm run migrate -- <names> --apply).");
  return results;
}

if (process.argv[1]?.endsWith("run.ts")) {
  const args = process.argv.slice(2);
  // `npm run migrate x --apply` keeps the flags for npm itself, so the run would
  // quietly be another dry run: they need `npm run migrate -- x --apply`. npm
  // passes on only the --force it took; the dry run's last line says the rest.
  if (process.env.npm_config_apply || process.env.npm_config_force) {
    console.error("Put -- before the names and flags: npm run migrate -- <names> --apply");
    process.exit(1);
  }
  run(args.filter((a) => !a.startsWith("--")), args.includes("--apply"), console.log, args.includes("--force")).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
