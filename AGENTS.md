<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git workflow

- After completing every requested code, configuration, or documentation change, run the relevant verification, commit the completed change with a descriptive message, and push it to the current branch's configured upstream remote.
- Add a concise dated entry to the change log below describing the files or behavior changed.

## Change log

- 2026-09-13: Added Tiptap table support to Notes, including table insertion, row/column actions, draggable column resizing, responsive styling, and the required `@tiptap/extension-table` dependency.
- 2026-09-13: Added an “Add multiple rows…” table action that inserts 1–50 rows in one operation.
- 2026-09-13: Made the Notes editor toolbar sticky below the app header while scrolling long documents.
- 2026-09-13: Fixed sticky Notes toolbar layout so the document title remains above it and editable.
