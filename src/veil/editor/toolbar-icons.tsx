import type { ReactNode } from "react";
import styles from "./toolbar.module.css";

/** The toolbar's line drawings, from the prototype's `doc.html`. Hidden: each button carries its label. */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      className={styles.glyph}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const UndoGlyph = () => (
  <Glyph>
    <path d="M7 5L3.5 8.5 7 12" />
    <path d="M4 8.5h8a4.5 4.5 0 0 1 0 9H9" />
  </Glyph>
);

export const RedoGlyph = () => (
  <Glyph>
    <path d="M13 5l3.5 3.5L13 12" />
    <path d="M16 8.5H8a4.5 4.5 0 0 0 0 9h3" />
  </Glyph>
);

export const BulletsGlyph = () => (
  <Glyph>
    <circle cx="4.5" cy="6" r=".9" fill="currentColor" />
    <circle cx="4.5" cy="10" r=".9" fill="currentColor" />
    <circle cx="4.5" cy="14" r=".9" fill="currentColor" />
    <path d="M8 6h8M8 10h8M8 14h8" />
  </Glyph>
);

export const NumbersGlyph = () => (
  <Glyph>
    <path d="M3.5 4.5h1.2v3.2M3.4 12h2.2l-2.2 3h2.3M8 6h8M8 10h8M8 14h8" />
  </Glyph>
);

export const LinkGlyph = () => (
  <Glyph>
    <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-1 1" />
    <path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l1-1" />
  </Glyph>
);

export const TableGlyph = () => (
  <Glyph>
    <rect x="3" y="4" width="14" height="12" rx="1.5" />
    <path d="M3 8h14M3 12h14M8 4v12" />
  </Glyph>
);

export const ClearGlyph = () => (
  <Glyph>
    <path d="M5 5h9M9.5 5l-2.5 10" />
    <path d="M12 12l4 4M16 12l-4 4" />
  </Glyph>
);

export const ColourGlyph = () => (
  <Glyph>
    <path d="M6.5 13L10 4l3.5 9M7.7 10h4.6" />
    <path className={styles.swatchLine} d="M4 16.5h12" strokeWidth="2.2" />
  </Glyph>
);

export const HighlightGlyph = () => (
  <Glyph>
    <path d="M12.5 3.5l4 4-6.5 6.5H6v-4z" />
    <path className={styles.swatchLine} d="M4 16.5h12" strokeWidth="2.2" />
  </Glyph>
);
