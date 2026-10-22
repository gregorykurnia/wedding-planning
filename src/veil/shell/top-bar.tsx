"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useSettings } from "@/lib/data/settings";
import { APP_NAME } from "@/lib/model/app-identity";
import { veilHref } from "../href";
import { MenuIndex, type Section } from "./menu-index";
import { useTabTitle } from "./tab-title";
import styles from "./top-bar.module.css";

/** The event a screen dispatches to ask the top bar to open the menu (see openMenu). */
const OPEN_MENU = "veil:open-menu";

/**
 * Opens the menu from outside the top bar, such as a screen's Open the menu
 * button. The top bar listens for the request, as its own Menu button does.
 */
export function openMenu() {
  window.dispatchEvent(new Event(OPEN_MENU));
}

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
  useTabTitle(names.text);

  // Closing puts focus back on the Menu button that opened the menu.
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButton.current?.focus();
  }, []);

  useEffect(() => {
    const open = () => setMenuOpen(true);
    window.addEventListener(OPEN_MENU, open);
    return () => window.removeEventListener(OPEN_MENU, open);
  }, []);

  return (
    <>
      <header className={styles.top}>
        <Link className={styles.couple} href={veilHref("/")}>
          {names.node}
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
            <span className={styles.couple}>{names.node}</span>
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
function useCoupleNames(): { node: ReactNode; text: string | null } {
  const { status, data } = useSettings();
  const yourName = data?.yourName.trim() ?? "";
  const partnerName = data?.partnerName.trim() ?? "";
  if (status === "demo" || !yourName || !partnerName) return { node: APP_NAME, text: null };
  return {
    node: (
      <>
        {yourName} <span className={styles.amp}>&amp;</span> {partnerName}
      </>
    ),
    text: `${yourName} & ${partnerName}`,
  };
}
