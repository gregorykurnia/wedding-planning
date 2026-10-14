"use client";

import { useState, type FormEvent } from "react";
import { useSession } from "@/lib/data/session";

// Bare stand-in so the gate has somewhere to send people. Task 4.1 replaces it
// with the designed screen (guide §5.1) and maps Firebase's error codes.
export default function SignInPlaceholder() {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  const offline = session.connection === "offline";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(false);
    try {
      await session.signInWithEmail(email, password);
    } catch {
      setFailed(true);
    }
  }

  if (session.status === "demo") {
    return (
      <>
        <h1>Our wedding planner</h1>
        <p role="status">Not connected: this is demonstration mode.</p>
        <button type="button" onClick={session.lookAround}>
          Look around
        </button>
      </>
    );
  }

  const { notice } = session;
  return (
    <>
      <h1>Our wedding planner</h1>
      {notice?.kind === "not-allowed" && (
        <p role="alert">
          {notice.email} isn’t one of the two accounts that can open this planner.
        </p>
      )}
      {notice?.kind === "signed-out" && <p role="status">You’ve signed out.</p>}
      {offline && <p role="status">You’re offline.</p>}
      <button type="button" disabled={offline} onClick={() => void session.signInWithGoogle().catch(() => {})}>
        Continue with Google
      </button>
      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {failed && <p role="alert">That email and password don’t match.</p>}
        <button type="submit" disabled={offline}>
          Sign in
        </button>
      </form>
    </>
  );
}
