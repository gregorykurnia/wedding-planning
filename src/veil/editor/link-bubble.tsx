"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { linkLabel } from "@/lib/model/documents";
import styles from "./pops.module.css";

const GAP = 6;

/**
 * The pill under a clicked link (guide §4.24, `.bubble`): its address, which
 * opens in a new tab, and Edit. It goes on a press elsewhere, on Escape, and
 * when the page scrolls.
 */
export function LinkBubble({
  link,
  onEdit,
  onClose,
}: {
  link: HTMLAnchorElement;
  /** Null when the document can't be changed (demonstration mode). */
  onEdit: (() => void) | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const href = link.getAttribute("href") ?? "";

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = link.getBoundingClientRect();
    setPlace({ left: Math.max(GAP, Math.min(window.innerWidth - el.offsetWidth - GAP, r.left)), top: r.bottom + GAP });
  }, [link]);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || link.contains(target)) return;
      onClose();
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", onClose, { passive: true });
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", onClose);
    };
  }, [link, onClose]);

  return createPortal(
    <div
      ref={ref}
      className={styles.bubble}
      style={place ? { left: place.left, top: place.top } : { visibility: "hidden" }}
    >
      <a className={styles.address} href={href} target="_blank" rel="noopener noreferrer">
        {linkLabel(href)}
      </a>
      {onEdit && (
        <button type="button" className={styles.edit} onClick={onEdit}>
          Edit
        </button>
      )}
    </div>,
    document.body,
  );
}
