/**
 * Why a write didn't land, in the words screens need (guide §6.1, §6.4, §6.5):
 * - `timeout`: no answer in 10 seconds. The write may still land later; the
 *   retry writes the same id and values, so trying again is safe.
 * - `offline`: Firestore said the network is unavailable.
 * - `denied`: the rules refused it (signed out, or not an allowed account).
 * - `missing`: the record or the element was removed, usually by the partner.
 * - `changed`: an undo found the record changed since (by you or the partner),
 *   so putting the old values back would erase that change. Nothing is written.
 * - `demo`: no Firebase project is configured (demonstration mode).
 * - `failed`: anything else.
 */
export type WriteFailure = "timeout" | "offline" | "denied" | "missing" | "changed" | "demo" | "failed";

export class WriteError extends Error {
  readonly code: WriteFailure;
  /** Runs the same write again with the same id and values. */
  retry?: () => Promise<unknown>;

  constructor(code: WriteFailure, message?: string, options?: { cause?: unknown }) {
    super(message ?? code, options);
    this.name = "WriteError";
    this.code = code;
  }
}

const FIRESTORE_CODES: Record<string, WriteFailure> = {
  "permission-denied": "denied",
  unauthenticated: "denied",
  unavailable: "offline",
  "not-found": "missing",
  "deadline-exceeded": "timeout",
};

export function toWriteError(err: unknown): WriteError {
  if (err instanceof WriteError) return err;
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? FIRESTORE_CODES[String((err as { code: unknown }).code)]
      : undefined;
  const message = err instanceof Error ? err.message : String(err);
  return new WriteError(code ?? "failed", message, { cause: err });
}
