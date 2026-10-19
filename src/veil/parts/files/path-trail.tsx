import Link from "next/link";
import { Fragment } from "react";
import type { Crumb } from "@/lib/model/files";
import { veilHref } from "@/veil/href";
import styles from "./files.module.css";

/** Files' own address; a folder is `?folder=<id>` and an open file `?file=<id>`. */
export const FILES_PATH = "/documents/files";

/** The address of a folder, or of the top level with `null`. */
export const folderHref = (id: string | null) =>
  veilHref(id ? `${FILES_PATH}?folder=${encodeURIComponent(id)}` : FILES_PATH);

/**
 * The path above a folder's title (guide §4.20): "Files › Vendors › Catering".
 * `null` in the list is the "…" that stands for the folded middle of a deep
 * path; it opens the full path through `onUnfold`.
 */
export function PathTrail({ crumbs, onUnfold }: { crumbs: readonly (Crumb | null)[]; onUnfold: () => void }) {
  if (crumbs.length === 0) return null;
  return (
    <nav className={styles.crumbs} aria-label="Where you are">
      {crumbs.map((crumb, index) => (
        <Fragment key={crumb ? (crumb.id ?? "top") : "fold"}>
          {index > 0 && (
            <span className={styles.sep} aria-hidden="true">
              ›
            </span>
          )}
          {crumb ? (
            <Link href={folderHref(crumb.id)} dir="auto">
              {crumb.name}
            </Link>
          ) : (
            <button type="button" aria-label="Show the full path" onClick={onUnfold}>
              …
            </button>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
