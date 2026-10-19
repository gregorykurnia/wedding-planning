// Fills the Firebase emulators with a fixture set: `npm run seed:emulator -- normal|empty|stress`.
// Empties both emulators first, creates the two test accounts and pairs them.
// Ports follow this copy's test port offset (tests/e2e/emulator-config.ts).
import { writeEmulatorConfig } from "../tests/e2e/emulator-config";
import { FIXTURE_NAMES, type FixtureName } from "../tests/fixtures/index";
import { loadFixture } from "../tests/fixtures/load";

const name = process.argv[2] as FixtureName | undefined;
if (!name || !FIXTURE_NAMES.includes(name)) {
  console.error(`Usage: npm run seed:emulator -- <${FIXTURE_NAMES.join("|")}>`);
  process.exit(1);
}

try {
  const counts = await loadFixture(name);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  console.log(`Loaded "${name}": ${total} documents`);
  for (const [collection, n] of Object.entries(counts).sort()) console.log(`  ${collection}: ${n}`);
} catch (err) {
  console.error(String(err instanceof Error ? err.message : err));
  console.error(
    `\nAre the emulators running? Start them with:\n  npx firebase emulators:start --config ${writeEmulatorConfig()} --only auth,firestore --project demo-wedding-planning`,
  );
  process.exit(1);
}
