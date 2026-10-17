"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSession } from "@/lib/data/session";
import {
  DEMO_LINE,
  GATE_SUB,
  GATE_TITLE,
  NOT_ALLOWED_AFTER,
  NOT_ALLOWED_BEFORE,
  PROBLEM_LINES,
  SIGNED_OUT_LINE,
  WAITING_NOTE,
  emailProblem,
  googleProblem,
  type ProblemLine,
  type SignInProblemKind,
} from "@/lib/model/sign-in";
import { RibbonKnot } from "@/veil/icons/ribbon-knot";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { FieldInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { Problem } from "@/veil/shell/banner";
import styles from "./sign-in.module.css";

/** What is in flight: the email form, or the Google window. */
type Attempt = "idle" | "email" | "google";

/**
 * The sign-in gate (guide §5.1): Google, then email and password, with every
 * way in that can fail told apart. Not allowed and just signed out come from
 * the session; the rest is this attempt.
 */
export function SignInScreen() {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [attempt, setAttempt] = useState<Attempt>("idle");
  const [problem, setProblem] = useState<SignInProblemKind | null>(null);
  // Each Google try gets a number, so a window that was cancelled, or
  // replaced by an email sign-in, can't report back later.
  const googleRun = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const offline = session.connection === "offline";

  // A wrong password goes back to the password, which is cleared.
  useEffect(() => {
    if (problem === "wrong") formRef.current?.querySelector<HTMLInputElement>('input[type="password"]')?.focus();
  }, [problem]);

  if (session.status === "demo") {
    return (
      <div className={styles.screen}>
        <div className={styles.gate}>
          <Header />
          <div className={styles.note}>
            <Problem tone="calm" role="status">
              {DEMO_LINE}
            </Problem>
          </div>
          <div className={styles.look}>
            <Btn className={`${styles.wide} ${styles.go}`} onClick={session.lookAround}>
              Look around
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (attempt === "email") return;
    googleRun.current += 1;
    setProblem(null);
    if (!email.trim() || !password) {
      setProblem("wrong");
      setAttempt("idle");
      return;
    }
    setAttempt("email");
    try {
      await session.signInWithEmail(email.trim(), password);
      // Signed in: the gate takes over, so the form stays as it is until then.
    } catch (err) {
      setProblem(emailProblem(err));
      setPassword("");
      setAttempt("idle");
    }
  }

  async function google(chooseAccount = false) {
    if (attempt === "email") return;
    googleRun.current += 1;
    const run = googleRun.current;
    setProblem(null);
    setAttempt("google");
    try {
      await session.signInWithGoogle({ chooseAccount });
    } catch (err) {
      if (run !== googleRun.current) return;
      setProblem(googleProblem(err));
      setAttempt("idle");
    }
  }

  function stopWaiting() {
    googleRun.current += 1;
    setAttempt("idle");
  }

  const { notice } = session;
  const line = problemLine(problem, offline, notice?.kind === "signed-out");
  const notAllowed = notice?.kind === "not-allowed" ? notice.email : null;
  const emailBusy = attempt === "email";
  const waiting = attempt === "google";
  const googleAgain = problem !== null && problem.startsWith("google-");

  return (
    <div className={styles.screen}>
      <div className={styles.gate}>
        <Header />
        <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
          <Btn
            variant="google"
            className={styles.wide}
            busy={waiting}
            busyLabel="Waiting for Google"
            disabled={emailBusy || offline}
            onClick={() => void google()}
          >
            {googleAgain ? "Continue with Google again" : "Continue with Google"}
          </Btn>
          {waiting && (
            <div className={styles.wait} role="status">
              <span>{WAITING_NOTE}</span>
              <TextLink onClick={stopWaiting}>Cancel</TextLink>
            </div>
          )}
          <p className={styles.or}>or with email</p>
          <Fields className={styles.bare}>
            <FieldRow label="Email" stacked>
              <FieldInput
                type="email"
                autoComplete="username"
                value={email}
                readOnly={emailBusy}
                onChange={setEmail}
              />
            </FieldRow>
            <FieldRow label="Password" stacked invalid={problem === "wrong"}>
              <FieldInput
                type="password"
                autoComplete="current-password"
                value={password}
                readOnly={emailBusy}
                onChange={setPassword}
              />
            </FieldRow>
          </Fields>
          {line && (
            <Problem tone={line.tone} role={line.tone === "rose" ? "alert" : "status"}>
              {line.text}
            </Problem>
          )}
          {notAllowed !== null && !problem && !offline && (
            <Problem role="alert">
              {NOT_ALLOWED_BEFORE}
              <b>{notAllowed}</b>
              {NOT_ALLOWED_AFTER}
            </Problem>
          )}
          <Btn
            type="submit"
            className={`${styles.wide} ${styles.go}`}
            busy={emailBusy}
            busyLabel="Signing in"
            disabled={offline}
          >
            Sign in
          </Btn>
          {notAllowed !== null && (
            <p className={styles.foot}>
              <TextLink disabled={offline || emailBusy} onClick={() => void google(true)}>
                Use a different Google account
              </TextLink>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function Header() {
  return (
    <>
      <RibbonKnot className={styles.mark} />
      <h1 className={styles.title}>{GATE_TITLE}</h1>
      <p className={styles.sub}>{GATE_SUB}</p>
    </>
  );
}

/** One note at a time: this attempt's problem, then being offline, then why the visitor is here. */
function problemLine(
  problem: SignInProblemKind | null,
  offline: boolean,
  signedOut: boolean,
): ProblemLine | null {
  if (problem) return PROBLEM_LINES[problem];
  if (offline) return PROBLEM_LINES.offline;
  if (signedOut) return SIGNED_OUT_LINE;
  return null;
}
