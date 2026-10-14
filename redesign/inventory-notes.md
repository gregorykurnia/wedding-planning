# Inventory notes (owner-only, never leaves `main`)

Companion to `redesign/handoff/inventory.md`. This file refers to code, current labels and current behaviour, so it **must never** be copied into `redesign/handoff/` or the studio. Written 2026-10-14 (Step 1) from a full read of the source files listed in `redesign/redesign-plan.md`.

---

## §1 Code map (for Agent C)

Paths under `src/` unless noted.

**Shell, auth, PWA**
- `app/layout.tsx`: root HTML, metadata, icons, viewport; wraps AuthProvider, TooltipProvider, AppShell; mounts SW registration.
- `components/layout/app-shell.tsx`: nav, mobile nav, account area, client-side auth gate and redirect to `/login`, demo-mode notice, mounts `VendorCategoriesProvider`.
- `components/layout/sw-register.tsx`, `public/sw.js`: service worker (network-first, same-origin GET, cache `wedding-planner-v2`).
- `app/manifest.ts`: web manifest.
- `app/login/page.tsx`, `lib/auth-context.tsx`, `lib/firebase.ts`: Google popup, email/password sign-in and registration, sign-out; `isFirebaseConfigured`; auth persistence chain.
- `firestore.rules`: two-email allowlist on 16 collections.

**Overview, schedule, settings**
- `app/page.tsx`: dashboard (countdown, confirmed spend, to-do progress, next items, guest counts, shortcuts).
- `app/schedule/page.tsx`: agenda and month modes, search, kind filter, event form, CRUD.
- `lib/schedule.ts`: `buildConfirmedPaymentReminders` (copy of the Confirmed reminder logic), strict date parsing and validation, `formatScheduleDate`.
- `lib/collections/schedule-events.ts`: scheduleEvents hook and CRUD.
- `app/settings/page.tsx`, `lib/collections/settings.ts`: wedding settings doc.

**Suppliers**
- `app/{vendors,venues,shortlist}/page.tsx`: thin wrappers.
- `components/vendors/vendors-table.tsx`: vendors (category filter, search, favourites, sort, column resize, CSV, one-time WO import, row actions).
- `components/vendors/vendor-price-options-cell.tsx`, `vendor-files-cell.tsx`, `vendor-category-pill.tsx` (`categoryStyle`, hash colours for custom), `vendor-category-tabs.tsx`, `vendor-contract-pill.tsx`, `add-vendor-category-dialog.tsx`, `vendor-categories-provider.tsx`.
- `components/venues/venues-table.tsx`, `venues-toolbar.tsx`, `venue-status-pill.tsx`, `venue-gallery-dialog.tsx`, `venue-notes-cell.tsx` (generic long-notes editor used on all three supplier pages).
- `components/shortlist/shortlist-table.tsx`, `shortlist-price-cell.tsx`.
- `lib/collections/{vendors,venues,shortlist,vendor-categories}.ts`: mapping, CRUD, copy-to-shortlist, file sync, category building and validation.

**Bookings and money**
- `app/confirmed/page.tsx`: builds confirmed rows from venues and vendors, totals, payment reminders, funder recap, Confirmed and Hypothetical tables, sorting.
- `lib/confirmed-sub-entries.ts`: sub-entry normalisation (funder fallback) and add, update, remove (whole-array rewrite).
- `lib/collections/hypothetical-items.ts`, `budget-items.ts`.
- `app/budget/page.tsx`: orphaned budget-lines page (see §4).
- `components/shared/funder-select.tsx`, `confirmed-type-pill.tsx`, `editable-date.tsx`.

**Guests**
- `app/guests/page.tsx`: table plus mobile cards, search, filters, headcounts, connection-keyword grouping, delete confirm and undo.
- `lib/collections/guests.ts`: CRUD plus `restoreGuest`.

**Tracker, tasks, records**
- `app/master-list/page.tsx`, `components/master-list/master-list-editable-cell.tsx`, `master-list-multi-select.tsx`, `lib/collections/master-list.ts` (44 seed rows, guarded init, fractional `sortOrder` inserts, transactional swaps, delete and restore).
- `app/todo/page.tsx`, `lib/collections/todos.ts`.
- `app/checklist/page.tsx`, `lib/collections/checklist-items.ts` (orphaned, see §4).
- `app/notes/page.tsx`, `components/notes/rich-text-editor.tsx` (Tiptap, toolbar, table actions, header sort, 800 ms autosave), `components/notes/formulas.ts`, `lib/collections/notes.ts`.
- `app/files/page.tsx`, `lib/collections/wedding-files.ts`.
- `components/cloudinary-upload-button.tsx`, `lib/compress-pdf.ts`, `public/pdf.worker.min.mjs`.

**Shared plumbing (kept in the rebuild)**
- `lib/use-collection.ts`: realtime `onSnapshot` hook (createdAt asc by default), add, update, set, delete with server timestamps.
- `lib/types.ts`, `lib/format.ts` (`formatIDR`, id-ID, 0 decimals, falsy → Rp 0).
- `components/shared/editable-text.tsx`, `editable-number.tsx`, `contact-cell.tsx`, `files-cell.tsx`.
- UI primitives to replace: `components/ui/*`, `app/globals.css`.

---

## §2 Current behaviour details

Details the inventory deliberately leaves out (labels, exact rules, current arrangement). For Agent C to preserve behaviour, never to pass to the designer.

**Navigation.** Desktop: Dashboard, "Planning" dropdown (Venues, Vendors, Shortlist, Confirmed, Master List), Guests, Schedule, To Do, Notes, Files. Mobile: hamburger with all 10 flat. Settings and Sign out only in the account menu. Brand "Our Wedding". `/budget` and `/checklist` aren't linked anywhere.

**Dashboard.**
- Countdown target is `settings.weddingDate` at 09:00 local, falling back to 2027-06-12. daysLeft = ceil(diff / 86,400,000), floored at 0.
- Progress ring = clamp(100 − daysLeft/365·100).
- Confirmed spend uses the first Booked venue plus Chosen/Done vendors, with sub-entry sums when present.
- To-do card shows the first 5 open todos by dueDate (raw ISO date shown) and "X of Y done".
- "Next up" merges scheduled events, payment reminders and dated open todos, sorted by date string, and shows the first 5, including past items.
- Guest card: headcount = Σ(1 + plusOnes) for RSVP yes, plus yes, pending and no counts.
- Four shortcut cards; the Guests one says "Track RSVPs & seating" (no seating feature exists).

**Venues.**
- New venue: "New Venue", status Shortlist, budget 0, guests 0.
- Statuses: Shortlist, Contacted, Toured, Booked, Rejected.
- Photos are uploaded with resourceType auto. The first photo becomes coverImage, and a thumbnail opens the gallery. There's no way to choose the cover or delete photos.
- Filters: search name and notes, multi-select status chips, Hide rejected, max budget, min guest capacity. Sort only by budget and guest max.
- "Add to budget" appears only when Booked.

**Vendors.**
- New vendor: "New Vendor", Inquiring, one empty selected price option, the active tab's category (or Other).
- Statuses: List, Inquiring, Consideration, Chosen, Done, Rejected. Rejected rows are tinted pink, and starred rows get a yellow outline.
- Search covers name, notes and contactName.
- Sorts: Vendor, Type (Other last), Status, Rating, Reviewers (empty = −1). Sorting only toggles asc/desc.
- Columns can be resized (not persisted), and double-click resets.
- Phone → `wa.me/<digits>`.
- Rating is free number (no 0–5 check) and reviewers are rounded; blank saves null.
- CSV `vendors-YYYY-MM-DD.csv` of the filtered rows (not the sorted ones), with Vendor, Type, Status, Contact Name/Phone/Email, Rating, Reviewers and Notes.
- Row actions: Add to budget (Chosen/Done), Copy to shortlist, Delete (immediate).

**Categories.**
- 11 built-ins: Decoration, Food, Groom Suit, Bride Dress, Invites, Makeup Artist, Music/DJ, Photos and Videos, Transportation, Wedding Cake, Wedding Organizer. Custom categories follow (createdAt asc), then Other.
- Validation: required, ≤40 characters, "all" reserved, no case-insensitive duplicate. No rename or delete.

**Notes cell.** Up to 60 characters shows inline. 61–200 characters is truncated with expand. Over 200 characters shows a "View full text" dialog with read mode (linkified URLs) and Edit/Save/Cancel.

**Shortlist.**
- New entry: "New shortlist entry", type = active tab or Other.
- Packages are sub-entries named "Option" carrying their own type, price, description, reviewers, IG followers, next action, notes and files.
- Default order is createdAt desc; Type sort cycles asc, desc, off. No search or favourites. Expand state is local and expanded by default.
- Copy to shortlist:
  - The selected (else first) price option becomes the main price and description, and the other options become packages.
  - Confirmed sub-entries also become packages.
  - Contact, reviewers, nextAction, notes and files are copied.
- Vendor file sync matches by normalised name on every snapshot and arrayUnions missing vendor files (not for packages).

**Confirmed.**
- Rows = the first Booked venue plus every vendor with Chosen or Done; there's no confirmed collection.
- Venue total = `budgetEstimate`; vendor total = `totalPrice`.
- Funders: CK, Gregory, Bella, Bella Fam, Unassigned. Type = "Venue" + categories.
- "Add vendor" creates `createVendor("Other","Chosen")`.
- Sub-entries: "New sub-entry", price 0, parent's funder; the parent's totals become read-only sums.
- Sort cycles asc, desc, off; dates with no value sort last; sub-entries stay under their parent.
- Payment reminder rules:
  - one per sub-entry, or one per row;
  - amount = max(total − spent, 0);
  - dropped when there's no valid date or the amount is ≤ 0;
  - status from whole days since local midnight: Overdue <0, Due today 0, Due within 7 days 1–7, Upcoming >7;
  - sorted by date, with a "N to track" count.
- Funder recap: spent and pending (clamped) per funder, plus Unassigned spent when above 0.
- Hypothetical: `hypotheticalItems`, with no funder in the UI. Cards show hypothetical total, remaining and projected (confirmed + hypothetical).

**Guests.**
- New guest: "New Guest", pending, event Both.
- Events: Both, Matrimony, Reception, Reception Shortlist, Unsure (Abroad).
- Side is inferred from whole-word "groom" or "bride" in the connection text.
- Business keywords: friend(s), work, business, colleague(s), coworker(s), co-worker(s), client(s), customer(s), boss, manager, office, professional(s), network(ing), contact(s), partner(s), classmate(s).
- Header counts are over all guests:
  - listed = Σ headcount;
  - attending = count of yes records;
  - attending headcount = Σ for yes;
  - both = event Both;
  - reception = Reception + Both;
  - matrimony = Matrimony + Both + Reception Shortlist.
- Family and business breakdown shows only when Event filter = Both, and uses the filtered set.
- The # column is creation order. A floating Add button appears at every width.
- Delete: confirm dialog, then a 10 s undo toast (one at a time), restoring with the same id and createdAt.

**Master List.**
- Fields: Item, Vendor ("???" = unknown), Confirmed/Not (Yes/No), Type (multi: Reception, Matrimony, Sangjit, Pre-Wedding), Person (multi: General, Groom, Bride, Groom Dad, Groom Mom, Groom Brother, Groom Sister, Bride Dad, Bride Mom, Bride Brothers), Next? (star, row highlight).
- 44 seed rows, initialised once and guarded by `masterListMeta/initialization`.
- Sorting cycles asc, desc, list order. Reorder arrows work only when no search, filter or sort is active.
- Insert below clears filters and sort and focuses the new Item cell.
- Bulk add takes 1–50. There's a sticky add toolbar. Delete has a confirm and a 10 s undo.

**Schedule.**
- Event types: vendor_call, appointment, payment, deadline, other. Statuses: scheduled, completed, cancelled.
- Defaults: vendor_call, start now + 60 min, reminder [60].
- Reminder options are none/15 min/1 h/1 day; they're stored and unused.
- Agenda groups: Overdue, Today, Tomorrow, Next 7 days, Upcoming, Completed.
- Month grid is 6×7 starting Sunday, up to 4 items a day and then "+N more" (not clickable).
- Filters: Everything, Payments, To Do, Vendor calls, Appointments, Deadlines, Manual events, Other. Completed and cancelled are hidden by default.
- Summary counts follow the filters. Related links go to the list pages, not the specific record.
- Delete uses `window.confirm`.

**To Do.**
- Tasks: title, notes, dueDate, done, subtasks (subtask notes stored but never shown).
- Active tasks are sorted by due date with undated last. The Archived section is sorted latest-due first. Delete is immediate.

**Notes.**
- Toolbar: style (P/H1–H3), font (Default, Inter, Georgia, Arial, Courier New), size (14/16/20/28), B/I/U/S, lists, text colour, highlight, undo/redo, clear.
- Table presets: 2×2, 3×3, 4×3, 5×4, 6×5 (always with a header row). Multi-row add uses `window.prompt` with a default of 5.
- Sorting: click the right-most 28px of a `th`.
- Formulas:
  - `=SUM()` only, with A1 references and open-ended `B2:B` ranges ending above the formula;
  - number cleaning strips , $ € £ ¥ ₹ %, spaces and a leading Rp;
  - errors `#NAME?`, `#REF!`, `#CIRCULAR!`;
  - results show to at most 2 decimals and aren't stored.
- Autosave 800 ms after the last change, with "Unsaved changes", then "Saving…", then "Saved", or an error link to retry.
- Notes are ordered by updatedAt desc. Delete uses `window.confirm` "This cannot be undone."

**Files.**
- Folder names ≤120 characters. Delete only when the folder is empty.
- Accepts .pdf .doc .docx .xls .xlsx .csv .zip .txt and images, up to 10 MB.
- File details: name ≤160 (required), category ≤80 with 16 suggestions, description ≤500, "Skip for now".
- Sorted by name. Delete removes the list entry only.

**Uploads (shared).**
- Unsigned XHR to Cloudinary using `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`. Missing env vars disable the control with a tooltip.
- PDFs over 10 MB are rasterised to JPEG pages, trying (1.5, 0.7), then (1.2, 0.5), then (1.0, 0.35). Text is no longer selectable.
- The first failure stops a multi-file batch.

**Settings.** yourName, partnerName, weddingDate, partnerEmail, venue go in a single `settings/wedding` doc saved with a full setDoc. Only weddingDate is used.

**Login.** Google button, email and password, Sign in, plus a separate Register button. Errors drop the "Firebase: " prefix.

**Demo mode** (Firebase env missing): no auth gate, an "isn't connected yet" banner, empty data, and every write throws.

**Words used by the current UI (never put these in the handoff):** Dashboard, Planning, Shortlist (as a status), Confirmed/Not, Next?, Starred only, Hide rejected, Add to budget, Copy to shortlist, Sub-entry, Hypothetical (as a label), Real budget spent, Pending spending, N to track, Next up, Archived, "???".

---

## §3 Data model

All docs get server `createdAt` and `updatedAt`. All 16 collections are gated by the email allowlist.

- **venues:** name, budgetEstimate, guestMax, location, status, notes, images[], coverImage|null, files[{name,url}], confirmedType ("Venue"), funder|null, budgetSpent, nextTargetDate (YYYY-MM-DD)|null, nextAction, subEntries[]. createdAt asc. No totalPrice.
- **vendors:** name, category, contactName, contactPhone, contactEmail, contractStatus, priceOptions[{id,description,price,selected}], notes, starred, images[] (unused), files[], bridestoryRating|null, bridestoryReviewCount|null, confirmedType (set from category at creation only), funder, totalPrice, budgetSpent, nextTargetDate, nextAction, subEntries[]. createdAt desc.
- **ConfirmedSubEntry** (embedded array): id, name, funder, totalPrice, budgetSpent, nextTargetDate, nextAction, files[]. Legacy entries without funder inherit the parent's funder on read.
- **shortlist:** name, type, contactName, contactPhone, price, priceDescription, bridestoryReviewers|null, igFollowers|null, nextAction, notes, files[], subEntries[{id,name,type,price,priceDescription,bridestoryReviewers,igFollowers,nextAction,notes,files}]. createdAt desc.
- **vendorCategories:** name.
- **hypotheticalItems:** name, type, totalPrice, budgetSpent, nextTargetDate, nextAction, files[], subEntries[] (funder stored, always null).
- **budgetItems:** category, estimatedAmount, actualAmount, paymentStatus (unpaid|deposit|paid), notes, linkedVenueId, linkedVendorId.
- **guests:** name, connection, country, rsvpStatus (pending|yes|no), eventType, inviteSent, plusOnes, allergies.
- **masterListItems:** id, item, vendor, confirmed, types[], persons[], next, sortOrder (fractional).
- **masterListMeta/initialization:** initialized, nextSortOrder, initializedAt.
- **scheduleEvents:** title, type, startAt ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm"), endAt|null, allDay, notes, location, status, relatedVendorId|null, relatedVenueId|null, reminderMinutes[]. Queried with orderBy(startAt), so docs without startAt are hidden.
- **todos:** title, notes, dueDate|null, done, subtasks[{id,title,notes,dueDate,done}].
- **checklistItems:** title, phase (12 Months Out|6 Months Out|1 Month Out|Week Of), dueDate, done.
- **notes:** title, content (Tiptap JSON); legacy `text`.
- **fileFolders:** name, parentId|null, createdBy.
- **weddingFiles:** name, category, description, folderId|null, url, publicId, resourceType, originalFilename, fileType, fileSize, uploadedBy.
- **settings/wedding:** yourName, partnerName, weddingDate, partnerEmail, venue.
- **Derived, never stored:** confirmed rows, payment reminders, schedule To Do items, all totals and headcounts.

---

## §4 Placeholders and half-built features to decide on (Step 2)

Each needs a keep / drop / rework decision. Anything kept gets a job story added to the inventory.

1. **`/budget` page.** It's orphaned from the nav, and its estimate/actual/payment-status lines are unrelated to the Confirmed totals. The "Add to budget" actions on Venues and Vendors still feed it with one-time snapshots, and its "Confirmed" mark goes stale. It looks superseded by Confirmed. *Suggest: drop, along with the "Add to budget" actions.*
2. **`/checklist` page.** It's orphaned: four fixed phases (12 months, 6 months, 1 month, week of) with dated tasks, read by nothing else. It overlaps with To Do. *Decide: drop, or fold "planning phase" into tasks.*
3. **Settings fields** yourName, partnerName, partnerEmail and venue are stored but never shown. partnerEmail isn't wired to access. *Decide: drop, or use the names in the product (greeting, app name).*
4. **Event reminders** (`reminderMinutes`) are stored and unused, labelled "for future notification integrations". *Decide: drop, or make real notifications a need.*
5. **One-time Wedding Organizer import** (12 hard-coded vendors). It's still live and adds duplicates on every click. *Suggest: drop.*
6. **Vendor email** is exported to CSV but can't be edited. *Decide: add as an editable field, or drop.*
7. **Venue files** field exists but can only be used via Confirmed. **Venue photos:** you can't choose the cover, delete or reorder. *Decide whether these are needs.*
8. **Vendor.images** is never shown or written. *Drop.*
9. **Subtask notes** are stored and never shown. *Decide.*
10. **Hypothetical sub-entry funder** is stored and always null. *Decide whether what-if items need funders.*
11. **Custom categories** can't be renamed or deleted. *Decide whether that's a need.*
12. **Files:** folders can't be moved; deleting a file leaves it on Cloudinary; there's no file preview or search. *Decide.*
13. **Formula engine** is SUM only. *Decide whether more functions are needed.*
14. **Shortlist is a dead end.** Nothing moves a finalist to Vendors or Confirmed. *Decide whether "promote a finalist to a booking" is a need.*
15. **"Track RSVPs & seating"** shortcut, but no seating feature. *Decide whether seating is a need.*
16. **Hard-coded names:** manifest "Gregory & Partner's Wedding Planner", brand "Our Wedding", greeting "Welcome back". These belong to the branding decision in the brief.
17. **Funders are hard-coded** (CK, Gregory, Bella, Bella Fam). *Decide whether funders should be editable.*
18. **Stale `public/music/README.md`** for a removed music player. *Delete.*

---

## §5 Bugs and unclear intent to decide on (Step 2)

**Correctness**
1. **Only the first Booked venue counts** (`confirmed/page.tsx:257`, `app/page.tsx:69`, `lib/schedule.ts:24`). A second booked venue (for example a separate ceremony venue) is silently ignored in all totals and reminders. *Likely bug: should be all booked venues.*
2. **Hypothetical rows ignore sub-entry sums** in Remaining, the read-only totals and sort (`confirmed/page.tsx:929, 1049, 1078, 1094`), while the cards use sums.
3. **A parent's funder and date still look editable** once sub-entries exist, but they're ignored (`confirmed/page.tsx:179-187, 217-221`).
4. **Pending clamps at 0 per entry while Remaining can go negative**, so they disagree. Unassigned has no pending figure.
5. **Editing a venue's total on Confirmed overwrites `budgetEstimate`**, the comparison estimate on Venues (`confirmed/page.tsx:699`). Should committed price and estimate be separate?
6. **`confirmedType` is set from category only at creation**, so later category changes don't follow. Venue and vendor Type can be set to anything, and Confirmed and Schedule then label reminders differently. Reminder logic is duplicated in two places.
7. **Guest event math:** Reception Shortlist counts towards matrimony, not reception; Unsure (Abroad) counts towards neither (`guests/page.tsx:389-395`).
8. **Guest family grouping:**
   - "friend" and "partner" are business terms, so "bride friend" is excluded from Bride Big Family;
   - there's no Bride Business Connections;
   - a connection mentioning both groom and bride counts on both sides;
   - the breakdown follows search and RSVP filters while header totals don't, unlabelled.
9. **"attending" counts records, while the totals beside it include plus-ones** (`guests/page.tsx:378`).
10. **Negative or decimal numbers are accepted everywhere** (plus-ones, prices, ratings). Clearing a number saves 0.
11. **Schedule anchor:** after month navigation, agenda groups and counts are relative to the 1st of the month, not real today (`schedule/page.tsx:166-182, 783-785`).
12. **Dashboard "Next up" includes past items** and shows sub-entry titles without the parent name (`app/page.tsx:100-128`). The countdown never ticks and briefly shows the fallback date.
13. **Payment reminder "today" is fixed at render**, so an app left open overnight shows stale statuses.
14. **Schedule payment rows duplicate detail** (notes and related label) (`schedule/page.tsx:680-684`).
15. **Notes table sort moves the SUM total row**, breaking open-ended ranges. Column lookup is wrong with merged cells (`rich-text-editor.tsx:63-99`). Sort direction is keyed by doc position (`:229`).
16. **Notes blank title** is shown as "Untitled document" but saved as "" (`notes.ts:42`).
17. **Formula edge cases:** `B:B` starts at the header row; a reversed open-ended range is accepted (`formulas.ts:57`).
18. **To Do archive** is sorted by due date, not by completion; undated tasks come first.

**Data loss and sync**
19. **Whole-array rewrites** for sub-entries, price options, packages and subtasks can lose concurrent edits (`confirmed-sub-entries.ts:59-67`, `vendors.ts:155-181`, `shortlist.ts:226-239`, `todos.ts:66-82`).
20. **Sub-entries without an id** get a new UUID on every snapshot (`confirmed-sub-entries.ts:15`).
21. **Shortlist package multi-file upload keeps only the last file** (stale closure, `shortlist-table.tsx:136-139`).
22. **Venue multi-photo upload sets the cover to the last photo, not the first** (`venues.ts:84-88`). Non-image files can enter the gallery.
23. **Vendor-to-shortlist file sync re-adds removed files**, so they can't be removed. Name matching can attach the wrong vendor's files (`shortlist.ts:181`).
24. **Files: multi-upload only opens details for the last file** (`files/page.tsx:301-340`). The move picker filter compares folder ids to the file id (`:681`).
25. **Notes save on unmount ignores failures** (`rich-text-editor.tsx:248-252`).
26. **Settings form is overwritten by every snapshot** (`settings/page.tsx:25-32`).
27. **Master List:** fractional sortOrder is never renumbered; a missing row makes a move silently do nothing; multi-select save errors are swallowed.

**Missing feedback**
28. **Write failures are unhandled on most pages** (Vendors, Venues, Shortlist, Confirmed, Budget, To Do, Checklist, Dashboard, Settings). A permission error looks like empty data.
29. **No confirmation or undo** for deleting vendors, venues, finalists, packages, price options, bookings' parts, what-if items, tasks or attached files.
30. **Copy to shortlist** gives no feedback and has no duplicate check. CSV ignores the sort.
31. **WhatsApp links break for local "08…" numbers** without the 62 country code.
32. **A second guest delete within 10 s discards the first undo.**

**Security and platform**
33. **Rules check `token.email` but not `email_verified`**, and email registration is open. Anyone could register an allowlisted address that has no account yet and get full access (`firestore.rules:7-12`). *Fix independently of the redesign.*
34. **`router.replace` during render** on login (`login/page.tsx:30-32`).
35. **The service worker caches every same-origin response**, including errors and redirects, with unbounded growth. Firestore offline persistence is off, so offline shows no data.
36. **The maskable icon reuses the non-maskable 512 file.**
37. **Date formats are inconsistent** (en-US countdown, en-GB schedule, raw ISO on the dashboard).

---

## §6 Constraints

- Stack and deploy: see the plan's Project constraints. Keep Firestore collections, field names and the `use-collection` plumbing so live data survives the switch-over.
- Two allowlisted users; realtime sync is a must.
- Cloudinary unsigned preset with a 10 MB free-plan limit; client-side PDF compression.
- Tiptap document JSON stored in `notes.content`; the rebuild must read existing documents and formulas unchanged.
- The Master List seed must not re-run (meta doc guard).
- Existing data uses the current enum strings (statuses, event types, funders, categories). The new UI may relabel them, but must map to the stored values or migrate them.
- **Banned words added for this app** (on top of Rule 1): pill, chip, toast, skeleton, star, starred, dashboard, hamburger, thumbnail, tooltip, banner, spinner, sticky, "next up", "planning" (as an area name), "master list", "confirmed/not", "sub-entry", "piggy", "chevron".

---

## §7 Details removed during leak reviews

*(Filled in by the second leak review.)*

## §8 Guess-the-layout test results

*(Filled in at Step 1b.)*

## §9 Decisions made in Step 2

*(Filled in at Step 2.)*
