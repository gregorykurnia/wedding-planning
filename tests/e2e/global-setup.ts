import { seed } from "./seed";

export default async function globalSetup() {
  // A demo-only run starts no emulators, so there is nothing to seed.
  if (process.env.E2E_SERVERS === "demo") return;
  await seed();
}
