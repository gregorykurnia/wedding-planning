"use client";

import { useSession } from "@/lib/data/session";
import { TopBar } from "@/veil/shell/top-bar";
import styles from "./page.module.css";

// Placeholder until the overview (Task 4.2): the top bar and a hero in the
// page column, styled only by tokens. Task 3.1 builds the real Hero.
export default function NewUiPlaceholder() {
  const { user, signOut } = useSession();
  return (
    <>
      <TopBar section="overview" />
      <div className={styles.column}>
        <header className={styles.hero}>
          <h1 className={styles.title}>Overview</h1>
          <p className={styles.kicker}>New UI placeholder</p>
        </header>
        {user && (
          <p className={styles.account}>
            Signed in as {user.email}{" "}
            <button type="button" className={styles.action} onClick={() => void signOut().catch(() => {})}>
              Sign out
            </button>
          </p>
        )}
      </div>
    </>
  );
}
