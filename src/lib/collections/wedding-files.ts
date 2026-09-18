"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { timestampToMillis } from "@/lib/use-collection";
import type { WeddingFile, WeddingFolder } from "@/lib/types";

const FOLDERS_COLLECTION = "fileFolders";
const FILES_COLLECTION = "weddingFiles";

function fromFolderDoc(id: string, data: DocumentData): WeddingFolder {
  return {
    id,
    name: typeof data.name === "string" && data.name.trim() ? data.name : "Untitled folder",
    parentId: typeof data.parentId === "string" ? data.parentId : null,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

function fromFileDoc(id: string, data: DocumentData): WeddingFile {
  return {
    id,
    name: typeof data.name === "string" && data.name.trim() ? data.name : "Uploaded file",
    description: typeof data.description === "string" ? data.description : "",
    folderId: typeof data.folderId === "string" ? data.folderId : null,
    url: typeof data.url === "string" ? data.url : "",
    publicId: typeof data.publicId === "string" ? data.publicId : "",
    resourceType: typeof data.resourceType === "string" ? data.resourceType : "auto",
    originalFilename: typeof data.originalFilename === "string" ? data.originalFilename : "",
    fileType: typeof data.fileType === "string" ? data.fileType : "",
    fileSize: typeof data.fileSize === "number" ? data.fileSize : 0,
    uploadedBy: typeof data.uploadedBy === "string" ? data.uploadedBy : null,
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function useWeddingFolders(parentId: string | null) {
  const [data, setData] = useState<WeddingFolder[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    const foldersQuery = query(
      collection(db, FOLDERS_COLLECTION),
      where("parentId", "==", parentId),
    );
    return onSnapshot(
      foldersQuery,
      (snapshot) => {
        setData(sortByName(snapshot.docs.map((item) => fromFolderDoc(item.id, item.data()))));
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error subscribing to file folders:", snapshotError);
        setError(snapshotError.message);
        setLoading(false);
      },
    );
  }, [parentId]);

  return { data, loading, error };
}

export function useAllWeddingFolders() {
  const [data, setData] = useState<WeddingFolder[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    return onSnapshot(
      collection(db, FOLDERS_COLLECTION),
      (snapshot) => {
        setData(sortByName(snapshot.docs.map((item) => fromFolderDoc(item.id, item.data()))));
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error subscribing to all file folders:", snapshotError);
        setError(snapshotError.message);
        setLoading(false);
      },
    );
  }, []);

  return { data, loading, error };
}

export function useWeddingFiles(folderId: string | null) {
  const [data, setData] = useState<WeddingFile[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    const filesQuery = query(
      collection(db, FILES_COLLECTION),
      where("folderId", "==", folderId),
    );
    return onSnapshot(
      filesQuery,
      (snapshot) => {
        setData(sortByName(snapshot.docs.map((item) => fromFileDoc(item.id, item.data()))));
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error subscribing to wedding files:", snapshotError);
        setError(snapshotError.message);
        setLoading(false);
      },
    );
  }, [folderId]);

  return { data, loading, error };
}

function requireDb() {
  if (!isFirebaseConfigured || !db) throw new Error("Firebase is not configured.");
  return db;
}

export async function createWeddingFolder(name: string, parentId: string | null, createdBy: string | null) {
  const database = requireDb();
  return addDoc(collection(database, FOLDERS_COLLECTION), {
    name: name.trim(),
    parentId,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateWeddingFolder(id: string, name: string) {
  const database = requireDb();
  return updateDoc(doc(database, FOLDERS_COLLECTION, id), {
    name: name.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteWeddingFolder(id: string) {
  const database = requireDb();
  const [childFolders, childFiles] = await Promise.all([
    getDocs(query(collection(database, FOLDERS_COLLECTION), where("parentId", "==", id))),
    getDocs(query(collection(database, FILES_COLLECTION), where("folderId", "==", id))),
  ]);
  if (!childFolders.empty || !childFiles.empty) {
    throw new Error("This folder is not empty. Move or delete its contents first.");
  }
  return deleteDoc(doc(database, FOLDERS_COLLECTION, id));
}

export async function createWeddingFile(data: {
  name: string;
  description?: string;
  folderId: string | null;
  url: string;
  publicId?: string;
  resourceType?: string;
  originalFilename?: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy: string | null;
}) {
  const database = requireDb();
  return addDoc(collection(database, FILES_COLLECTION), {
    ...data,
    name: data.name.trim(),
    description: data.description?.trim() ?? "",
    publicId: data.publicId ?? "",
    resourceType: data.resourceType ?? "auto",
    originalFilename: data.originalFilename ?? data.name,
    fileType: data.fileType ?? "",
    fileSize: data.fileSize ?? 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateWeddingFile(
  id: string,
  data: Partial<Pick<WeddingFile, "name" | "description" | "folderId">>,
) {
  const database = requireDb();
  return updateDoc(doc(database, FILES_COLLECTION, id), {
    ...data,
    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    ...(data.description !== undefined ? { description: data.description.trim() } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteWeddingFile(id: string) {
  const database = requireDb();
  return deleteDoc(doc(database, FILES_COLLECTION, id));
}
