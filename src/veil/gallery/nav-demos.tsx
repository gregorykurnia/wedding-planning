"use client";

import { useState } from "react";
import { AddButton } from "@/veil/shell/add-button";
import { BackLink } from "@/veil/shell/back-link";
import { SubNav } from "@/veil/shell/sub-nav";
import { TopBar } from "@/veil/shell/top-bar";

/**
 * Dev-only demos of the shell pieces (Task 2.4): the top bar and its menu, the
 * sub-navigation, the back link and the add button. Task 3.0's gallery lists
 * this page; the e2e test drives it.
 */
export function NavDemos() {
  const [asLink, setAsLink] = useState(true);
  const [pressed, setPressed] = useState(0);
  return (
    <>
      <TopBar section="vendors" />
      <h1>Shell pieces</h1>
      <h2>Sub-navigation</h2>
      <SubNav set="vendors" current="/vendors/shortlist" />
      <h2>Back link</h2>
      <BackLink path="/budget" label="Budget" />
      <h2>Add button</h2>
      <p>
        <button type="button" onClick={() => setAsLink((on) => !on)}>
          Show it as {asLink ? "a button" : "a link"}
        </button>
      </p>
      {asLink ? (
        <AddButton path="/vendors/shortlist/new">Add a finalist</AddButton>
      ) : (
        <AddButton onPress={() => setPressed((count) => count + 1)}>Add a finalist</AddButton>
      )}
      <p>Pressed {pressed} times</p>
    </>
  );
}
