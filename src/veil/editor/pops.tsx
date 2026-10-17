"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { DOC_COLOURS, DOC_HIGHLIGHTS, type DocSwatch } from "@/lib/model/documents";
import styles from "./pops.module.css";

const GAP = 8;

/** A token's value, read from the page, so a stored colour is a real colour the old UI can draw too. */
export function tokenValue(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

/**
 * A small popover under its button (guide §4.24, `.pop`), or above it when
 * there's no room below (the phone toolbar sits at the bottom). It closes on a
 * press outside it and on Escape, which hands focus back to the button.
 */
export function Pop({
  anchor,
  label,
  onClose,
  children,
}: {
  anchor: HTMLElement;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(GAP, Math.min(window.innerWidth - w - GAP, r.left));
    const below = r.bottom + GAP + h < window.innerHeight;
    setPlace({ left, top: below ? r.bottom + GAP : r.top - h - GAP });
  }, [anchor]);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
      anchor.focus();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      className={styles.pop}
      role="dialog"
      aria-label={label}
      style={place ? { left: place.left, top: place.top } : { visibility: "hidden" }}
    >
      <p className={styles.head}>{label}</p>
      {children}
    </div>,
    document.body,
  );
}

type SwatchPopProps = {
  editor: Editor;
  anchor: HTMLElement;
  /** The colour at the cursor, to show which swatch is pressed. */
  current: string | null;
  onClose: () => void;
};

const same = (a: string | null, b: string | null) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

function Swatches({
  items,
  current,
  pick,
  noneLabel,
}: {
  items: readonly DocSwatch[];
  current: string | null;
  pick: (value: string | null) => void;
  noneLabel: string;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div className={styles.swatches}>
      {items.map((item, i) => {
        const value = item.clears || !item.token ? null : tokenValue(item.token);
        const label = item.token ? item.label : noneLabel;
        return (
          <button
            key={item.label}
            ref={i === 0 ? first : undefined}
            type="button"
            className={item.token ? styles.sw : `${styles.sw} ${styles.none}`}
            style={item.token ? { background: `var(${item.token})` } : undefined}
            aria-label={label}
            title={label}
            aria-pressed={same(value, current)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(value)}
          />
        );
      })}
    </div>
  );
}

/** Text colour (guide §4.24): Ink, Rose, Gold, Sage, Cornflower, Plum. Ink takes the colour off. */
export function ColourPop({ editor, anchor, current, onClose }: SwatchPopProps) {
  return (
    <Pop anchor={anchor} label="Text colour" onClose={onClose}>
      <Swatches
        items={DOC_COLOURS}
        current={current}
        noneLabel="No colour"
        pick={(value) => {
          const chain = editor.chain().focus();
          (value ? chain.setColor(value) : chain.unsetColor()).run();
          onClose();
        }}
      />
    </Pop>
  );
}

/** Highlight (guide §4.24): Blush, Champagne, Mint, Sky, Lilac, None. */
export function HighlightPop({ editor, anchor, current, onClose }: SwatchPopProps) {
  return (
    <Pop anchor={anchor} label="Highlight" onClose={onClose}>
      <Swatches
        items={DOC_HIGHLIGHTS}
        current={current}
        noneLabel="No highlight"
        pick={(value) => {
          const chain = editor.chain().focus();
          (value ? chain.setBackgroundColor(value) : chain.unsetBackgroundColor()).run();
          onClose();
        }}
      />
    </Pop>
  );
}
