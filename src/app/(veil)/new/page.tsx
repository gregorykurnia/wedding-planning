"use client";

import { useSession } from "@/lib/data/session";
import { PageColumn } from "@/veil/shell/page-column";
import styles from "./page.module.css";

// Placeholder until the overview (Task 4.2): a hero in the page column, styled
// only by tokens. The shell draws the top bar above main.
export default function NewUiPlaceholder() {
  const { user, signOut } = useSession();
  return (
    <PageColumn>
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
    </PageColumn>
  );
}
