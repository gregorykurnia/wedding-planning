import { seed } from "../e2e/seed";

/** Empties the emulators and creates the two allowlisted accounts. */
export default async function globalSetup() {
  await seed();
}
