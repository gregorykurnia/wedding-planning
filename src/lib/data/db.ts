import { getAuth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { WriteError } from "./write-error";

/**
 * Every write function takes an optional Firestore instance as its last
 * argument. Screens leave it out and get the app's database; the emulator
 * tests pass their own, one per signed-in account, to act as two partners.
 */
export function requireDb(database?: Firestore): Firestore {
  if (database) return database;
  if (!isFirebaseConfigured || !db) throw new WriteError("demo");
  return db;
}

/** The signed-in account on the app that owns this database, or null. */
export function uidOf(database: Firestore): string | null {
  try {
    return getAuth(database.app).currentUser?.uid ?? null;
  } catch {
    return null;
  }
}
