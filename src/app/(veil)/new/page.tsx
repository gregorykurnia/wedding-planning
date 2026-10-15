"use client";

import { useSession } from "@/lib/data/session";
import { TopBar } from "@/veil/shell/top-bar";

// Placeholder until the overview (Task 4.2).
export default function NewUiPlaceholder() {
  const { user, signOut } = useSession();
  return (
    <>
      <TopBar section="overview" />
      <p>New UI placeholder</p>
      {user && (
        <>
          <p>Signed in as {user.email}</p>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </>
      )}
    </>
  );
}
