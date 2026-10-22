import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { requireDb } from "./db";
import { guarded, type WriteOptions } from "./write";

/** The parts of a Firebase `User` this needs. */
export interface MemberUser {
  uid: string;
  email: string | null;
  isAnonymous?: boolean;
  providerData: { providerId: string }[];
}

/**
 * `members/{uid}`, written at every sign-in: lets one partner's screen name
 * the other ("by Bella") and shows each account's sign-in method in settings.
 * Resolves false instead of throwing, so signing in never fails because of it.
 */
export async function recordMember(user: MemberUser, opts: WriteOptions = {}): Promise<boolean> {
  try {
    const database = requireDb(opts.db);
    const member = {
      email: user.email ?? "",
      // An anonymous account (open access) has no sign-in method to show.
      provider: user.isAnonymous ? "" : (user.providerData[0]?.providerId ?? "password"),
      lastSeenAt: serverTimestamp(),
    };
    await guarded(() => setDoc(doc(database, "members", user.uid), member, { merge: true }));
    return true;
  } catch (err) {
    console.warn("Couldn't record the signed-in account:", err);
    return false;
  }
}
