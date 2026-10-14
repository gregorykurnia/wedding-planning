import {
  AUTH_EMULATOR,
  EMULATOR_PROJECT_ID,
  FIRESTORE_EMULATOR,
  TEST_ACCOUNTS,
} from "./emulator-config";

async function expectOk(res: Response, what: string) {
  if (!res.ok) throw new Error(`${what} failed: ${res.status} ${await res.text()}`);
}

// Playwright waits for Firestore only, so Auth can still be starting.
async function waitFor(url: string) {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Emulator did not start: ${url}`);
}

/** Empties both emulators and creates the two allowlisted accounts, verified. */
export async function seed() {
  await waitFor(`http://${AUTH_EMULATOR}`);
  await waitFor(`http://${FIRESTORE_EMULATOR}`);
  await expectOk(
    await fetch(
      `http://${AUTH_EMULATOR}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/accounts`,
      { method: "DELETE" },
    ),
    "Clearing Auth emulator",
  );
  await expectOk(
    await fetch(
      `http://${FIRESTORE_EMULATOR}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`,
      { method: "DELETE" },
    ),
    "Clearing Firestore emulator",
  );
  for (const { email, password } of TEST_ACCOUNTS) await createAccount(email, password);
}

/**
 * Creates an email-and-password account in the Auth emulator, verified unless
 * `verified` is false. The rules require a verified address (as Google
 * sign-in gives).
 */
export async function createAccount(email: string, password: string, verified = true) {
  const created = await fetch(
    `http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  await expectOk(created, `Creating ${email}`);
  if (!verified) return;
  const { localId } = (await created.json()) as { localId: string };
  await expectOk(
    await fetch(
      `http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${EMULATOR_PROJECT_ID}/accounts:update`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
        body: JSON.stringify({ localId, emailVerified: true }),
      },
    ),
    `Verifying ${email}`,
  );
}

export default seed;
