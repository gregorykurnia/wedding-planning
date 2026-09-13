<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git workflow

- After completing every requested code, configuration, or documentation change, run the relevant verification, commit the completed change with a descriptive message, and push it to the current branch's configured upstream remote.
- Add a concise dated entry to the change log below describing the files or behavior changed.

## Change log

- 2026-09-13: Prevented Notes editor scroll jumps after autosave by memoizing the editor against same-document realtime snapshot updates.
- 2026-09-13: Fixed Notes documents rendering blank after the scroll-preservation change by passing the stable initial content value correctly to Tiptap.
- 2026-09-13: Fixed Notes editor scrolling to the top while editing cells deep in a document by stabilizing Tiptap extensions and avoiding redundant content re-renders.
- 2026-09-13: Added Notes table formulas with safe `SUM` evaluation, computed cell display, open-ended ranges that include newly inserted rows, formula errors, and numeric sorting.
- 2026-09-13: Added Tiptap table support to Notes, including table insertion, row/column actions, draggable column resizing, responsive styling, and the required `@tiptap/extension-table` dependency.
- 2026-09-13: Added an “Add multiple rows…” table action that inserts 1–50 rows in one operation.
- 2026-09-13: Made the Notes editor toolbar sticky below the app header while scrolling long documents.
- 2026-09-13: Fixed sticky Notes toolbar layout so the document title remains above it and editable.
- 2026-09-13: Added click-to-sort behavior for Notes table header columns with automatic text or numeric comparison.
- 2026-09-13: Limited Notes table sorting to the header sort-icon area so header labels remain editable.
