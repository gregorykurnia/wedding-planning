<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Git workflow

- After completing every requested code, configuration, or documentation change, run the relevant verification, commit the completed change with a descriptive message, and push it to the current branch's configured upstream remote.
- Add a concise dated entry to the change log below describing the files or behavior changed.

## Change log

- 2026-09-21: Improved Schedule with agenda day navigation, a responsive month view, search and source filters, linked booking navigation, archived-item visibility, stronger loading/error/empty states, accessible controls, and strict local date/time validation.
- 2026-09-21: Added `schedule-improvement-prompt.md` with a focused prompt for improving the Schedule experience while preserving existing data ownership and integrations.
- 2026-09-21: Added a Schedule agenda with manual events, linked vendors and venues, derived payment reminders, due To Do items, dashboard Next up summaries, and the implementation plan in `schedule-implementation-plan.md`.
- 2026-09-21: Added optional per-file categories to Wedding Files, with suggested wedding categories, custom values, Firestore persistence, and category badges in the file list.
- 2026-09-18: Added Confirmed payment reminders grouped by overdue, due today, due within 7 days, and upcoming, using Next target date and remaining budget for bookings and installments.
- 2026-09-18: Added a muted Pending spending amount to each funder recap card based on committed total price minus real budget spent.
- 2026-09-18: Vertically centered Confirmed and Hypothetical table cell contents so controls and remaining-budget values align within taller rows.
- 2026-09-18: Added independent funder dropdowns for Confirmed sub-entries and updated the recap to attribute installment spending to each sub-entry funder.
- 2026-09-18: Added funder assignment to confirmed venues and vendors with CK, Gregory, and Bella options plus a real-budget-spent recap by funder.
- 2026-09-18: Added the Wedding Files MVP with nested Firestore folders, Cloudinary uploads with progress, file descriptions, move/edit/delete actions, breadcrumbs, mobile-friendly layouts, and access rules.
- 2026-09-18: Added `wedding-files-implementation-prompt.md` with a focused, cost-conscious MVP prompt for implementing nested wedding file storage with Cloudinary.
- 2026-09-14: Restored the Notes toolbar's page-level sticky behavior by removing the editor card overflow constraint while keeping table overflow scoped to its touch-scroll wrapper.
- 2026-09-14: Optimized the Notes editor for mobile with a compact horizontally scrollable toolbar and tables that retain readable column widths inside touch-scroll containers.
- 2026-09-13: Fixed persistent Notes autosave scroll jumps by locking the active note ID before Firestore's pending timestamp can reorder the document list and remount the editor.
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
