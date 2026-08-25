"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { Heart, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
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

export default function LoginPage() {
  const router = useRouter();
  const { isFirebaseConfigured, signInWithGoogle, signInWithEmail, registerWithEmail, user } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    router.replace("/");
  }

  const handleError = (err: unknown) => {
    if (err instanceof FirebaseError) {
      setError(err.message.replace("Firebase: ", ""));
    } else {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (mode: "signin" | "register") => {
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
      router.replace("/");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-gradient-to-b from-cream to-background px-4 py-12">
      <Card className="w-full max-w-sm border-border/70 shadow-lg">
        <CardHeader className="items-center text-center">
          <Heart className="mb-2 size-8 text-primary" />
          <CardTitle className="font-heading text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to plan your big day</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!isFirebaseConfigured && (
            <Alert>
              <AlertDescription>
                Firebase isn&apos;t configured yet. Add your Firebase env vars to{" "}
                <code>.env.local</code> to enable sign-in.
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            variant="outline"
            className="w-full"
            disabled={!isFirebaseConfigured || loading}
            onClick={handleGoogle}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled={!isFirebaseConfigured || loading}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                disabled={!isFirebaseConfigured || loading}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!isFirebaseConfigured || loading || !email || !password}
                onClick={() => handleEmailSignIn("signin")}
              >
                Sign in
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={!isFirebaseConfigured || loading || !email || !password}
                onClick={() => handleEmailSignIn("register")}
              >
                Register
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
