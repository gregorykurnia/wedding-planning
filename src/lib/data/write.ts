import {
  collection,
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  waitForPendingWrites,
  type Firestore,
  type Transaction,
} from "firebase/firestore";
import { requireDb, uidOf } from "./db";
import { toWriteError, WriteError } from "./write-error";

export { WriteError, type WriteFailure } from "./write-error";

/**
 * The one write layer (plan §2.7, guide §6.1). Every write:
 * - stamps `updatedAt`/`updatedBy` (and `createdAt`/`createdBy` on create);
 * - gives up after 10 seconds with a `timeout` WriteError, because an offline
 *   write would otherwise wait forever. The write may still land later, so
 *   creates use an id made here and the error's `retry()` writes the same id
 *   and values again: retrying never makes a duplicate.
 */
export const WRITE_TIMEOUT_MS = 10_000;

let timeoutMs = WRITE_TIMEOUT_MS;

/** Tests only: shortens the timeout so a hung write fails quickly. */
export function setWriteTimeout(ms: number | null) {
  timeoutMs = ms ?? WRITE_TIMEOUT_MS;
}

export interface WriteOptions {
  /** Defaults to the app's database. Tests pass one per signed-in account. */
  db?: Firestore;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WriteError("timeout")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Runs a write with the timeout, turning any failure into a WriteError whose
 * `retry()` runs the same write again. After a timeout the first attempt may
 * still be on its way, so `retry()` waits for it first and runs the write again
 * only if it failed: a late first delete can't make the retry fail as missing,
 * and a late first append can't land twice.
 */
export function guarded<T>(run: () => Promise<T>): Promise<T> {
  let first: Promise<T>;
  try {
    first = run();
  } catch (err) {
    first = Promise.reject(err);
  }
  return attempt(run, first);
}

async function attempt<T>(run: () => Promise<T>, inFlight: Promise<T>): Promise<T> {
  try {
    return await withTimeout(inFlight);
  } catch (err) {
    const failure = toWriteError(err);
    failure.retry = () =>
      failure.code === "timeout" ? attempt(run, inFlight.catch(() => run())) : guarded(run);
    throw failure;
  }
}

/** `updatedAt`/`updatedBy`, plus `createdAt`/`createdBy` for a new record. */
export function stamp(database: Firestore, created = false): Record<string, unknown> {
  const uid = uidOf(database);
  return created
    ? { createdAt: serverTimestamp(), createdBy: uid, updatedAt: serverTimestamp(), updatedBy: uid }
    : { updatedAt: serverTimestamp(), updatedBy: uid };
}

/** A new document id, made on this device so a retried create reuses it. */
export function newId(collectionName: string, opts: WriteOptions = {}): string {
  return doc(collection(requireDb(opts.db), collectionName)).id;
}

export async function create(
  collectionName: string,
  data: Record<string, unknown>,
  opts: WriteOptions & { id?: string } = {},
): Promise<string> {
  const database = requireDb(opts.db);
  const id = opts.id ?? newId(collectionName, { db: database });
  const payload = { ...data, ...stamp(database, true) };
  await guarded(() => setDoc(doc(database, collectionName, id), payload));
  return id;
}

export async function update(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
  opts: WriteOptions = {},
): Promise<void> {
  const database = requireDb(opts.db);
  const payload = { ...data, ...stamp(database) };
  await guarded(() => updateDoc(doc(database, collectionName, id), payload));
}

export async function set(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
  opts: WriteOptions & { merge?: boolean } = {},
): Promise<void> {
  const database = requireDb(opts.db);
  const payload = { ...data, ...stamp(database) };
  const ref = doc(database, collectionName, id);
  await guarded(() => (opts.merge ? setDoc(ref, payload, { merge: true }) : setDoc(ref, payload)));
}

export async function remove(
  collectionName: string,
  id: string,
  opts: WriteOptions = {},
): Promise<void> {
  const database = requireDb(opts.db);
  await guarded(() => deleteDoc(doc(database, collectionName, id)));
}

/**
 * Runs a Firestore transaction under the same timeout and error mapping.
 * Firestore retries the function when another device changed what it read,
 * so it must not have side effects outside the transaction.
 */
export async function transact<T>(
  run: (tx: Transaction, database: Firestore) => Promise<T>,
  opts: WriteOptions = {},
): Promise<T> {
  const database = requireDb(opts.db);
  return guarded(() => runTransaction(database, (tx) => run(tx, database)));
}

/**
 * Waits until every write this device has started has reached the database.
 * A transaction reads from the server, so one that builds on a field saved a
 * moment ago (typed, then Split pressed, which saves it on blur) waits for that
 * save first; otherwise the save could land after it, on a field the result no
 * longer reads.
 */
export function afterOwnWrites(opts: WriteOptions = {}): Promise<void> {
  const database = requireDb(opts.db);
  return guarded(() => waitForPendingWrites(database));
}
