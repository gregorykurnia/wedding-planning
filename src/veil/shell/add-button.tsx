"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { veilHref } from "../href";
import styles from "./add-button.module.css";

type AddButtonProps = { children: ReactNode } & (
  | { path: string; onPress?: never }
  | { onPress: () => void; path?: never }
);

/**
 * The main add action of a list screen, floating bottom right as an ink pill
 * (guide §3). It is a link to a new-item screen, or a button that opens a sheet.
 */
export function AddButton({ children, path, onPress }: AddButtonProps) {
  if (path !== undefined) {
    return (
      <Link href={veilHref(path)} className={styles.add}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={styles.add} onClick={onPress}>
      {children}
    </button>
  );
}
