import { connect } from "../../scripts/migrate/admin";
import { FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../e2e/emulator-config";
import { accountUids, seed } from "../e2e/seed";
import type { FixtureContext } from "./build";
import { FIXTURES, type FixtureName } from "./index";

/**
 * Empties both emulators, creates the two test accounts (paired, as `seed()`
 * leaves them) and fills Firestore with a fixture set. Goes through the Admin
 * SDK, which skips the rules, so a few thousand documents take seconds.
 * Resolves with how many documents each collection got.
 */
export async function loadFixture(name: FixtureName): Promise<Record<string, number>> {
  await seed();
  const [me, partner] = await accountUids();
  const ctx: FixtureContext = {
    me: { uid: me, email: TEST_ACCOUNTS[0].email },
    partner: { uid: partner, email: TEST_ACCOUNTS[1].email },
  };
  const docs = FIXTURES[name](ctx);

  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR;
  const { db } = connect("fixtures");
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Already in use in this process: it was set the first time.
  }
  const writer = db.bulkWriter();
  const failures: unknown[] = [];
  const counts: Record<string, number> = {};
  for (const [collection, byId] of Object.entries(docs)) {
    counts[collection] = Object.keys(byId).length;
    for (const [id, data] of Object.entries(byId)) {
      writer.set(db.collection(collection).doc(id), data).catch((err) => failures.push(err));
    }
  }
  await writer.close();
  if (failures.length) throw new Error(`${failures.length} fixture writes failed, the first: ${String(failures[0])}`);
  return counts;
}
