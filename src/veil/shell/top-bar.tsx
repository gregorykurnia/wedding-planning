"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { useSettings } from "@/lib/data/settings";
import { veilHref } from "../href";
import { MenuIndex, type Section } from "./menu-index";
import styles from "./top-bar.module.css";

/** What the app is called when there are no names to show (guide §4.1). */
const APP_NAME = "Our wedding planner";

/**
 * The top bar of every screen (guide §4.1): the couple's names on the left,
 * linking to the overview, and Menu on the right. Menu opens the full-page
 * menu, whose own top row has Close where Menu was.
 */
export function TopBar({ section }: { section?: Section }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const names = useCoupleNames();

  // Closing puts focus back on the Menu button that opened the menu.
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButton.current?.focus();
  }, []);

  return (
    <>
      <header className={styles.top}>
        <Link className={styles.couple} href={veilHref("/")}>
          {names}
        </Link>
        <button
          ref={menuButton}
          type="button"
          className={styles.menuBtn}
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onClick={() => setMenuOpen(true)}
        >
          <span className={styles.lines} aria-hidden="true" />
          Menu
        </button>
      </header>
      {menuOpen && (
        <MenuIndex id={menuId} section={section} onClose={closeMenu}>
          <div className={styles.top}>
            <span className={styles.couple}>{names}</span>
            <button type="button" className={styles.menuBtn} onClick={closeMenu}>
              <span className={`${styles.lines} ${styles.single}`} aria-hidden="true" />
              Close
            </button>
          </div>
        </MenuIndex>
      )}
    </>
  );
}

/**
 * The names from settings, "Greg & Bella". Demonstration mode, and a couple
 * who hasn't filled in both names yet, get the app's name instead.
 */
function useCoupleNames(): ReactNode {
  const { status, data } = useSettings();
  const yourName = data?.yourName.trim() ?? "";
  const partnerName = data?.partnerName.trim() ?? "";
  if (status === "demo" || !yourName || !partnerName) return APP_NAME;
  return (
    <>
      {yourName} <span className={styles.amp}>&amp;</span> {partnerName}
    </>
  );
}
