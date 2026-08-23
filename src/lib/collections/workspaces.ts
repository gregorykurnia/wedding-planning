"use client";

import {
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  collection,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { timestampToMillis } from "@/lib/use-collection";
import type { UserProfile, Workspace } from "@/lib/types";

const WORKSPACES = "workspaces";
const USERS = "users";

function fromWorkspaceDoc(id: string, data: DocumentData): Workspace {
  return {
    id,
    name: data.name ?? "",
    ownerId: data.ownerId ?? "",
    memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],
    memberEmails: Array.isArray(data.memberEmails) ? data.memberEmails : [],
    inviteCode: data.inviteCode ?? "",
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

function generateInviteCode(): string {
  // Short, easy to read aloud/type — avoids ambiguous chars like 0/O, 1/I.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/** Listens to the caller's user profile, which points at their workspace (if any). */
export function watchUserProfile(
  uid: string,
  cb: (profile: UserProfile | null) => void,
) {
  if (!db) return () => {};
  return onSnapshot(doc(db, USERS, uid), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const data = snap.data();
    cb({
      uid,
      email: data.email ?? "",
      workspaceId: data.workspaceId ?? null,
      createdAt: timestampToMillis(data.createdAt),
    });
  });
}

/** Listens to a single workspace document by id. */
export function watchWorkspace(
  workspaceId: string,
  cb: (workspace: Workspace | null) => void,
) {
  if (!db) return () => {};
  return onSnapshot(doc(db, WORKSPACES, workspaceId), (snap) => {
    cb(snap.exists() ? fromWorkspaceDoc(snap.id, snap.data()) : null);
  });
}

/** Creates a brand-new, empty workspace and attaches the creator to it. */
export async function createWorkspace(
  uid: string,
  email: string,
  name: string,
): Promise<string> {
  if (!db) throw new Error("Firebase is not configured.");
  const workspaceRef = doc(collection(db, WORKSPACES));
  await setDoc(workspaceRef, {
    name,
    ownerId: uid,
    memberIds: [uid],
    memberEmails: [email.toLowerCase()],
    inviteCode: generateInviteCode(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, USERS, uid), {
    email: email.toLowerCase(),
    workspaceId: workspaceRef.id,
    createdAt: serverTimestamp(),
  });
  return workspaceRef.id;
}

/** Joins an existing workspace by its invite code, e.g. your fiancée joining yours. */
export async function joinWorkspaceByInviteCode(
  uid: string,
  email: string,
  inviteCode: string,
): Promise<string> {
  if (!db) throw new Error("Firebase is not configured.");
  const normalized = inviteCode.trim().toUpperCase();
  const snap = await getDocs(
    query(collection(db, WORKSPACES), where("inviteCode", "==", normalized)),
  );
  if (snap.empty) {
    throw new Error("No workspace found for that invite code.");
  }
  const workspaceDoc = snap.docs[0];
  const workspace = fromWorkspaceDoc(workspaceDoc.id, workspaceDoc.data());

  if (!workspace.memberIds.includes(uid)) {
    await updateDoc(doc(db, WORKSPACES, workspace.id), {
      memberIds: [...workspace.memberIds, uid],
      memberEmails: [...workspace.memberEmails, email.toLowerCase()],
      updatedAt: serverTimestamp(),
    });
  }
  await setDoc(doc(db, USERS, uid), {
    email: email.toLowerCase(),
    workspaceId: workspace.id,
    createdAt: serverTimestamp(),
  });
  return workspace.id;
}

export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, WORKSPACES, workspaceId));
  return snap.exists() ? fromWorkspaceDoc(snap.id, snap.data()) : null;
}
