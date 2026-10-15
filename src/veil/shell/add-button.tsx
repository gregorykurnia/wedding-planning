"use client";

import type { ReactNode } from "react";
import { Btn } from "@/veil/parts/actions/btn";
import { veilHref } from "../href";
import styles from "./add-button.module.css";

type AddButtonProps = { children: ReactNode } & (
  | { path: string; onPress?: never }
  | { onPress: () => void; path?: never }
);

/**
 * The main add action of a list screen, floating bottom right as an ink pill
 * (guide §3). It is a link to a new-item screen, or a button that opens a sheet.
 * The pill is Btn's floating variant; this file only places it.
 */
export function AddButton({ children, path, onPress }: AddButtonProps) {
  if (path !== undefined) {
    return (
      <Btn href={veilHref(path)} floating className={styles.add}>
        {children}
      </Btn>
    );
  }
  return (
    <Btn floating className={styles.add} onClick={onPress}>
      {children}
    </Btn>
  );
}
