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
  const uids: string[] = [];
  for (const { email, password } of TEST_ACCOUNTS) uids.push(await createAccount(email, password));
  // The two accounts already know which of the two names is theirs (N3), so no
  // screen asks "Which of you is this?" unless a test wants it to.
  await pairAccounts(uids);
}

/** Writes who holds which name, as the owner (which skips the rules): the first account is the first name. */
export async function pairAccounts(uids: string[]) {
  const slots = Object.fromEntries(uids.map((uid, i) => [uid, { stringValue: i === 0 ? "first" : "second" }]));
  await expectOk(
    await fetch(
      `http://${FIRESTORE_EMULATOR}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/settings/accounts`,
      {
        method: "PATCH",
        headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { slots: { mapValue: { fields: slots } } } }),
      },
    ),
    "Pairing the accounts",
  );
}

/**
 * Creates an email-and-password account in the Auth emulator, verified unless
 * `verified` is false. The rules require a verified address (as Google
 * sign-in gives).
 */
export async function createAccount(email: string, password: string, verified = true): Promise<string> {
  const created = await fetch(
    `http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  await expectOk(created, `Creating ${email}`);
  const { localId } = (await created.json()) as { localId: string };
  if (!verified) return localId;
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
  return localId;
}

export default seed;
