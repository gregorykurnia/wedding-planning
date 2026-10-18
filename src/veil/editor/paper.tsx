"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import styles from "./paper.module.css";

type PaperProps = {
  title: string;
  onTitle: (title: string) => void;
  /** Enter in the title moves into the body (guide §4.24). */
  onTitleEnter: () => void;
  readOnly: boolean;
  /** Focus starts in the title with the cursor at its end: a new document. */
  focusTitle: boolean;
  /** "Edited 2 hours ago by Bella" or "New document". */
  meta: string;
  children: ReactNode;
};

/**
 * The page (guide §4.24, `.paper`): white with a blush edge and a soft shadow,
 * full-bleed on a phone. The title is serif with "Untitled" in its place when
 * empty, and grows to fit as it wraps.
 */
export function Paper({ title, onTitle, onTitleEnter, readOnly, focusTitle, meta, children }: PaperProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!focusTitle || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    // Only when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <article className={styles.paper} data-doc-paper="">
      <label className="sr" htmlFor="doc-title">
        Title
      </label>
      <textarea
        ref={ref}
        id="doc-title"
        className={styles.title}
        rows={1}
        placeholder="Untitled"
        dir="auto"
        value={title}
        readOnly={readOnly}
        onChange={(e) => onTitle(e.target.value.replace(/\r?\n/g, " "))}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          onTitleEnter();
        }}
      />
      <p className={styles.meta}>{meta}</p>
      {children}
    </article>
  );
}
