import { ALLOWED_EMAILS } from "./allowlist";
import { adminAuth } from "./firebase-admin";
import { RequestError } from "./request-error";

export interface Caller {
  uid: string;
  email: string;
}

/**
 * Checks `Authorization: Bearer <Firebase ID token>`: a valid, unrevoked
 * token for a verified address on the allowlist, the same test as
 * `isAllowed()` in `firestore.rules`. Throws a 401 or 403 RequestError.
 */
export async function verifyRequest(request: Request): Promise<Caller> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new RequestError(401, "signed-out", "No sign-in token");
  let token;
  try {
    token = await adminAuth().verifyIdToken(match[1], true);
  } catch (err) {
    if (err instanceof RequestError) throw err;
    throw new RequestError(401, "signed-out", "The sign-in token isn't valid");
  }
  if (!token.email || token.email_verified !== true || !ALLOWED_EMAILS.includes(token.email)) {
    throw new RequestError(403, "not-allowed", "This account can't use the app");
  }
  return { uid: token.uid, email: token.email };
}
