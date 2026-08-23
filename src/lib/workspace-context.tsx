"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { watchUserProfile, watchWorkspace } from "@/lib/collections/workspaces";
import type { Workspace } from "@/lib/types";

interface WorkspaceContextValue {
  workspace: Workspace | null;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setWorkspaceId(null);
      setWorkspace(null);
      setProfileLoaded(true);
      setWorkspaceLoaded(true);
      return;
    }
    setProfileLoaded(false);
    const unsubscribe = watchUserProfile(user.uid, (profile) => {
      setWorkspaceId(profile?.workspaceId ?? null);
      setProfileLoaded(true);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!workspaceId) {
      setWorkspace(null);
      setWorkspaceLoaded(true);
      return;
    }
    setWorkspaceLoaded(false);
    const unsubscribe = watchWorkspace(workspaceId, (ws) => {
      setWorkspace(ws);
      setWorkspaceLoaded(true);
    });
    return () => unsubscribe();
  }, [workspaceId]);

  return (
    <WorkspaceContext.Provider
      value={{ workspace, loading: !profileLoaded || !workspaceLoaded }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
