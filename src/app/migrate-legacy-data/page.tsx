"use client";

/**
 * ONE-TIME MIGRATION: copies data from the pre-workspace flat Firestore
 * collections (venues, vendors, guests, ...) into a workspace tied to the
 * signed-in account, then deletes the originals. Delete this route once run.
 */

import { useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { createWorkspace } from "@/lib/collections/workspaces";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const LEGACY_COLLECTIONS = [
  "venues",
  "vendors",
  "guests",
  "budgetItems",
  "checklistItems",
  "todos",
  "notes",
  "hypotheticalItems",
];

type Status = "idle" | "running" | "done" | "error";

export default function MigrateLegacyDataPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const appendLog = (line: string) => setLog((prev) => [...prev, line]);

  const run = async () => {
    if (!user || !db) return;
    setStatus("running");
    setLog([]);
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      let targetWorkspaceId = userSnap.exists()
        ? (userSnap.data().workspaceId as string | undefined)
        : undefined;

      if (!targetWorkspaceId) {
        appendLog("No existing workspace — creating one...");
        targetWorkspaceId = await createWorkspace(
          user.uid,
          user.email ?? "",
          "Our Wedding",
        );
      }
      setWorkspaceId(targetWorkspaceId);
      appendLog(`Using workspace ${targetWorkspaceId}`);

      for (const collectionName of LEGACY_COLLECTIONS) {
        const snap = await getDocs(collection(db, collectionName));
        if (snap.empty) {
          appendLog(`${collectionName}: nothing to migrate`);
          continue;
        }
        for (const docSnap of snap.docs) {
          await setDoc(
            doc(db, `workspaces/${targetWorkspaceId}/${collectionName}`, docSnap.id),
            docSnap.data(),
          );
          await deleteDoc(docSnap.ref);
        }
        appendLog(`${collectionName}: migrated ${snap.size} document(s)`);
      }

      appendLog("Migration complete.");
      setStatus("done");
    } catch (err) {
      appendLog(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Migrate legacy data</CardTitle>
          <CardDescription>
            One-time copy of your old flat-collection data into a workspace
            tied to {user?.email ?? "your account"}. Delete this page once
            done.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!user && <p className="text-sm text-muted-foreground">Sign in first.</p>}
          <Button disabled={!user || status === "running"} onClick={run}>
            {status === "running" ? "Migrating..." : "Run migration"}
          </Button>
          {workspaceId && (
            <p className="text-sm text-muted-foreground">
              Workspace ID: <code>{workspaceId}</code>
            </p>
          )}
          <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
            {log.join("\n")}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
