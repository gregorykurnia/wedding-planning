"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { recordMember } from "./members";
import { watchReprobe } from "./reprobe";

/**
 * Who is using the new UI, and whether they may.
 *
 * - `loading`: the saved sign-in hasn't been read yet.
 * - `checking`: signed in, and the probe read is finding out whether the rules
 *   let this account in.
 * - `signed-in`: one of the two accounts (or the probe couldn't tell yet,
 *   because the device is offline; the rules still guard every read).
 * - `signed-out`: nobody, or an account the rules turned away.
 * - `demo`: no Firebase configuration, so there is nothing to sign in to.
 */
export type SessionStatus = "loading" | "checking" | "signed-in" | "signed-out" | "demo";

/** What the sign-in screen says when it opens after a sign-out. */
export type SessionNotice =
  | { kind: "not-allowed"; email: string }
  | { kind: "signed-out" }
  | null;

/** `demo` wins over the browser's own online flag: there is no database to reach. */
export type Connection = "online" | "offline" | "demo";

export interface SessionUser {
  uid: string;
  email: string;
}

export interface Session {
  status: SessionStatus;
  user: SessionUser | null;
  notice: SessionNotice;
  connection: Connection;
  /** Demo only: the visitor chose Look around on the sign-in screen. */
  lookingAround: boolean;
  /** `chooseAccount` makes Google ask which account, instead of reusing the last one. */
  signInWithGoogle: (options?: { chooseAccount?: boolean }) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  lookAround: () => void;
  /** Demo only: leave Look around and go back to the sign-in screen. */
  leaveDemo: () => void;
}

interface AuthState {
  status: SessionStatus;
  user: SessionUser | null;
  notice: SessionNotice;
}

const LOOK_AROUND_KEY = "veil.lookAround";

function readLookAround(): boolean {
  try {
    return sessionStorage.getItem(LOOK_AROUND_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

function errorCode(err: unknown): string | undefined {
  return typeof err === "object" && err && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

function toSessionUser(user: User): SessionUser {
  return { uid: user.uid, email: user.email ?? "" };
}

/**
 * Runs the auth listener and the not-allowed probe. Mount once, in the new
 * UI's providers; everything else reads the result through `useSession()`.
 */
export function useSessionSource(): Session {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    notice: null,
  });
  const [lookingAround, setLookingAround] = useState(false);
  const online = useOnline();
  // Each sign-in gets a new number, so a probe that finishes after the account
  // changed (or signed out) is ignored.
  const generation = useRef(0);
  // True while the account is let in on trust because the probe couldn't
  // reach the database; it is probed again (`watchReprobe`) until it answers.
  const unconfirmed = useRef<User | null>(null);

  const probe = useCallback(async (user: User, gen: number) => {
    try {
      // Any read the rules guard will do; settings/wedding is one small document.
      await getDoc(doc(db!, "settings", "wedding"));
      if (gen !== generation.current) return;
      unconfirmed.current = null;
      setState({ status: "signed-in", user: toSessionUser(user), notice: null });
      // members/{uid}: lets the partner's screen name who changed what.
      void recordMember(user);
    } catch (err) {
      if (gen !== generation.current) return;
      if (errorCode(err) === "permission-denied") {
        // Not one of the two accounts (or an unverified address). Sign out at
        // once so nothing is attempted under it, and say why on sign-in.
        unconfirmed.current = null;
        setState({
          status: "checking",
          user: toSessionUser(user),
          notice: { kind: "not-allowed", email: user.email ?? "" },
        });
        // If the sign-out itself fails, the screen still mustn't wait forever
        // on the skeleton: show sign-in with the notice.
        if (auth)
          await firebaseSignOut(auth).catch(() => {
            if (gen === generation.current)
              setState({ status: "signed-out", user: null, notice: { kind: "not-allowed", email: user.email ?? "" } });
          });
        return;
      }
      // Offline or the database didn't answer: can't tell, so let the account
      // in; screens show their own offline or couldn't-load states.
      unconfirmed.current = user;
      // A repeat probe that still can't tell changes nothing on screen.
      setState((prev) =>
        prev.status === "signed-in" && prev.user?.uid === user.uid && !prev.notice
          ? prev
          : { status: "signed-in", user: toSessionUser(user), notice: null },
      );
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      // Read once after mount: sessionStorage doesn't exist on the server.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLookingAround(readLookAround());
      setState({ status: "demo", user: null, notice: null });
      return;
    }
    return onAuthStateChanged(auth, (user) => {
      generation.current += 1;
      unconfirmed.current = null;
      if (!user) {
        // Keep the notice: it explains this sign-out on the sign-in screen.
        setState((prev) => ({ status: "signed-out", user: null, notice: prev.notice }));
        return;
      }
      setState((prev) => ({
        status: "checking",
        user: toSessionUser(user),
        notice: prev.notice?.kind === "not-allowed" ? prev.notice : null,
      }));
      void probe(user, generation.current);
    });
  }, [probe]);

  // An account let in on trust is asked again until the database answers.
  const signedIn = state.status === "signed-in";
  useEffect(() => {
    if (!signedIn) return;
    return watchReprobe(() => {
      if (unconfirmed.current) void probe(unconfirmed.current, generation.current);
    });
  }, [signedIn, probe]);

  const signInWithGoogle = useCallback(async (options?: { chooseAccount?: boolean }) => {
    if (!auth) throw new Error("Firebase is not configured.");
    const provider = new GoogleAuthProvider();
    if (options?.chooseAccount) provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase is not configured.");
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    // The notice is set first so the listener's signed-out state keeps it; a
    // failed sign-out takes it back.
    setState((prev) => ({ ...prev, notice: { kind: "signed-out" } }));
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      setState((prev) => (prev.notice?.kind === "signed-out" ? { ...prev, notice: null } : prev));
      throw err;
    }
  }, []);

  const lookAround = useCallback(() => {
    try {
      sessionStorage.setItem(LOOK_AROUND_KEY, "1");
    } catch {
      // Private mode without storage: Look around lasts until the next reload.
    }
    setLookingAround(true);
  }, []);

  const leaveDemo = useCallback(() => {
    try {
      sessionStorage.removeItem(LOOK_AROUND_KEY);
    } catch {
      // Nothing stored to clear.
    }
    setLookingAround(false);
  }, []);

  const connection: Connection =
    state.status === "demo" || !isFirebaseConfigured ? "demo" : online ? "online" : "offline";

  return useMemo(
    () => ({
      ...state,
      connection,
      lookingAround,
      signInWithGoogle,
      signInWithEmail,
      signOut,
      lookAround,
      leaveDemo,
    }),
    [
      state,
      connection,
      lookingAround,
      signInWithGoogle,
      signInWithEmail,
      signOut,
      lookAround,
      leaveDemo,
    ],
  );
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside the new UI's providers");
  return session;
}
