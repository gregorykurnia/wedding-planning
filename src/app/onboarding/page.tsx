"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createWorkspace, joinWorkspaceByInviteCode } from "@/lib/collections/workspaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      await createWorkspace(
        user.uid,
        user.email ?? "",
        workspaceName.trim() || "Our Wedding",
      );
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      await joinWorkspaceByInviteCode(user.uid, user.email ?? "", inviteCode);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-gradient-to-b from-cream to-background px-4 py-12">
      <Card className="w-full max-w-sm border-border/70 shadow-lg">
        <CardHeader className="items-center text-center">
          <Heart className="mb-2 size-8 text-primary" />
          <CardTitle className="font-heading text-2xl">Set up your wedding</CardTitle>
          <CardDescription>
            Start a new planner, or join your partner&apos;s
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="workspaceName">Wedding name</Label>
              <Input
                id="workspaceName"
                value={workspaceName}
                disabled={loading}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Gregory & Partner's Wedding"
              />
            </div>
            <Button disabled={loading} onClick={handleCreate}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Create a new wedding
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="inviteCode">Invite code</Label>
              <Input
                id="inviteCode"
                value={inviteCode}
                disabled={loading}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="e.g. 7F3KQP"
                className="uppercase"
              />
            </div>
            <Button
              variant="secondary"
              disabled={loading || !inviteCode.trim()}
              onClick={handleJoin}
            >
              Join with invite code
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
