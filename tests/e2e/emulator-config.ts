// Shared by playwright.config.ts, seed.ts and the emulator specs.
export const EMULATOR_PROJECT_ID = "demo-wedding-planning";
export const AUTH_EMULATOR = "127.0.0.1:9099";
export const FIRESTORE_EMULATOR = "127.0.0.1:8080";

// Emails the Firestore rules allow (see firestore.rules).
export const TEST_ACCOUNTS = [
  { email: "gregory.kurnia@gmail.com", password: "test-password-1" },
  { email: "bellabarliana15@gmail.com", password: "test-password-2" },
] as const;
