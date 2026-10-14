# Design progress

## Stage 1: directions (done)

### Round 1 (rejected), now in `archive/round-1/`
- 2026-10-14: A Ribbon, B Stubs and C Runway. The owner rejected all three (see decisions.md).

### Round 2
- 2026-10-14: three new directions for the budget screen, spread from minimal to full:
  - `directions/d-veil/`: minimal and invitation-like, one figure and one next payment
  - `directions/e-garden/`: medium, sage and greenery, centred names with a section row
  - `directions/f-atelier/`: fuller, with an arch that fills as you pay, a side menu and the full table
- Same mock budget as round 1.
- 2026-10-14: the owner chose **D, Veil** (reasons in decisions.md).

## Stage 2: full prototype (done)
Open `prototype/index.html` in a browser: it lists every screen and state. The dashed "Prototype" tab on each screen switches states and the stress data (`?state=…`, `?stress`).

- 2026-10-14, session 1: **budget group** (B1–B12, plus B6, S6 and the payment side of O2).
  - Screens: `budget.html` (overview), `bookings.html`, `booking.html` (in parts, single, overpaid, late), `booking-new.html`, `payments.html`, `funders.html`, `whatif.html`, plus the full-page menu, the record-payment sheet, confirm dialogs and undo toasts, all in shared `assets/`.
  - States covered: nothing yet, no results, loading, couldn't load, offline, demonstration mode, partner's change arrives, booking removed by the partner, a change didn't save (input kept, retry), adding (busy), couldn't add, uploading (progress, PDF shrinking, too large, failed), confirm and undo, late and due soon, overpaid.
  - Stress data: 1,206 bookings, 1,507 payments due, a 40-part booking, 15 funders with long and non-Latin names, RTL and CJK names, empty optional fields, a 13-digit price, 1 KB and 9.9 MB images, and the longest realistic next step.
  - Not yet: the rest of O2 (appointments and tasks coming up) belongs to the Overview group.
- 2026-10-14: the owner declined P1 and adopted P2 (Greg and Bella pay as separate funders).
- 2026-10-14, session 2: **vendors group** (F1–F24, plus B1 from vendors and venues).
  - Screens: `vendors.html` (with the add-a-vendor and categories sheets, and CSV export), `vendor.html`, `shortlist.html` (with add a finalist), `finalist.html` (packages, book it, move into Vendors), `venues.html` (with the venue sheet). Vendors, Shortlist and Venues share one sub-navigation; the menu's "Vendors" leads there.
  - States: nothing yet, no results, adding, category name taken, a change didn't save, uploading, busy (copying, booking, moving), loading, couldn't load, offline, demonstration mode, Bella adds a vendor.
  - Stress data: 2,004 vendors, 37 categories (some near the 40-character limit, some in other scripts), a vendor with 30 price options and a 600-character note with links, a finalist with 30 packages and 98.8M followers, and 302 venues.
- 2026-10-14, session 3 (same conversation, at the owner's request): **documents group** (R1–R7).
  - Screens: `documents.html` (recent three as cards, the rest as a list, search inside documents, "Meeting notes" and "New document" starts) and `doc.html` (the editor). Shared code is in `assets/editor.css` and `assets/formulas.js`.
  - Editor: text styles (body, title, heading, subheading, quote, code), four fonts, four sizes, bold, italic, underline, strikethrough, colours and highlights, bullet points and numbered steps, links (Cmd/Ctrl+K, plus a bubble to open or edit), undo and redo, clear formatting.
  - Tables: pick a size up to 8 × 8, add rows and columns either side, add 1–50 at once, remove, title row on or off, narrower and wider columns, sort ascending or descending, remove the table with undo. Tab moves between cells.
  - Totals: `=SUM(B2:B6)`, `=SUM(B2, C4)` and growing `=SUM(B2:B)`. A formula bar shows the cell's address and formula, and mistakes are named in plain words ("Bad reference", "Includes itself", "Not a total") with the reason.
  - States: saved, not saved yet, saving, couldn't save (with retry, text kept), went offline while writing, the partner is in the same document, deleted by the partner, delete warning, nothing yet, no results, loading, couldn't load, offline, demonstration mode, partner starts a document.
  - Stress data: 1,504 documents, one with 40 long paragraphs, a 50 × 8 table with growing totals, lists four levels deep and an 85-character unbroken title; CJK, Arabic and untitled documents.
- 2026-10-14, session 4 (same conversation): **files group** (R8–R14) in `files.html`, under Documents with a Documents/Files sub-navigation.
  - Folders: a path above the title (the middle folds away when deep), new folder, rename, move with everything inside, delete only when empty.
  - Uploading: drop or choose several files. Each gets a name, an optional category (suggestions or your own) and a description, and shows its progress. PDFs over 10 MB are shrunk; other big files are refused, with the reason.
  - A file's details: preview, name, category, description, size and date, open, download, move, and delete for good (freeing storage). Search finds files in any folder by name or description.
  - States: nothing yet, an empty folder, no results, uploading (done, in progress, shrinking, too large, failed), a file's details, moving a folder, loading, couldn't load, offline, demonstration mode, Bella uploads a file.
  - Stress data: 30 nested folders, 3,000 files and 40 folders in one folder, long and non-Latin names, 1 KB and 10 MB files, very wide and very tall images.
- 2026-10-14, session 5 (same conversation): **schedule group** (S1–S10) in `schedule.html` (agenda and month) and `tasks.html`, sharing `assets/schedule.js` and `assets/schedule.css`.
  - Agenda: your events, payments due from bookings and tasks with dates, in time order. Late items come first in rose, then each day; "Today" and "Tomorrow" are named. Done and cancelled items appear on demand. You can narrow by kind and search.
  - The one figure says how many things are late or due today (S6). Payments can be recorded straight from the agenda, and each item links to its booking, task or vendor (S7).
  - Month: a calendar with coloured dots (events, payments, tasks, late), earlier and later months, back to today, and the chosen day's list underneath. The wedding day is marked.
  - Event sheet: title, kind, date, all day or times, who it's with, place or call link, notes, reminder, mark completed, cancel, back to scheduled, and delete with undo. Reminders explain the device's notification state: allowed, not yet allowed (with a button), or turned off.
  - Tasks: open tasks by due date with undated ones last, steps with their own dates, a little thread showing steps done, finished tasks kept apart but recoverable, and delete with undo.
- 2026-10-14, session 6 (same conversation): **wedding items group** (T1–T10) in `items.html`.
  - One figure: how many items are confirmed out of all of them, with the gold thread. A "To work on next" card lists the marked items, and tapping one jumps to its row (T3, T4).
  - Each row edits in place: item, vendor ("Vendor not known yet" when empty), events (several), who it's for, work on next (a gold star) and confirmed (a sage tick).
  - Narrowing: search items and vendors; confirmed or not; any of several events; any of several people (T5).
  - Order by any field, with a note and "Back to our order" (T6). Your own order: drag the handle, use Alt and the arrow keys, or "Move up/down" in the row menu. "Add an item below" and "Add several below" (one per line) put new items exactly where they belong (T7).
  - Remove with confirm and undo, back to the exact place (T8). A failed save keeps the typed text with "Try again" (T9). First use starts with 14 common items, with a note to change or remove them (T10).
- 2026-10-14, session 7 (same conversation): **guests group** (G1–G8) in `guests.html`.
  - One figure: people attending so far, plus-ones included, and how many are still to reply.
  - Two cards: headcounts (both events, reception with "if space allows" shown inside it, ceremony, and unsure guests apart) and both sides (groom's and bride's family and business, among guests invited to both events, worked out from the connection text). Guests whose connection names neither side are counted apart, with a note saying why.
  - Rows show the stable guest number, name with plus-ones, connection, country and food notes, plus a three-way RSVP switch you can use in one tap on the phone (G8).
  - Search, narrow by RSVP and by event, and order by any field. The guest sheet edits everything. Removing a guest reminds you of their plus-ones and how much the headcount drops, with undo.
- 2026-10-14, session 8 (same conversation): **overview, sign-in and settings** (O1–O6, A1–A6).
  - `overview.html` is the home: tapping your names opens it. It shows your names in gold italic, the days to go as the biggest figure in the app, and a thread for how much of the preparation time has passed since you started (O1). "Coming up" lists the next five dated things of any kind (O2). Four rows each lead straight into the detail: budget, tasks, guests and wedding items (O3, O4). With no wedding date yet, the date is asked for here (O5).
  - `signin.html`: Google or email and password, with signing in, wrong email or password (the email is kept), an account that isn't allowed, just signed out, offline, and not connected (enter demonstration mode) (A1).
  - `settings.html`: your two names (O6) and the wedding date (O5), who can open the planner and signing out (A5), reminders on this device in all three permission states (S10), and how to install on iPhone and Android (A3).
  - Live updates (A2) are shown with a "…'s change arrives" state on every list screen and on the budget, bookings and documents screens (corrected in stage 4: tasks, what-if, shortlist and venues were added). A vendor or finalist detail and settings follow the same pattern without a state of their own. Phone and computer layouts (A4) and saving as you go (A6) run through every screen.
- **Stage 2 now covers every group in the inventory.** Next, after the owner's review: stage 3, the design guide and tokens. The coverage audit (stage 4) should then check this in a fresh session.

## Stage 3: design guide (draft written, awaiting the owner's review)
- 2026-10-14: `tokens.css` and `design-guide.md` written from the prototype as it stands.
  - `tokens.css`: colour, type families, scale and weights, spacing, layout widths, radii, shadows and rings, glows, motion, breakpoints and layers, named by role, with the prototype's names in brackets and a contrast table for every text/background pair used.
  - `design-guide.md`: principles, how to use the tokens, the shell, 30 components with variants and states, every screen × state with its URL and phone/desktop differences, patterns (saving, undo, partner changes, demonstration mode, offline, loading, empty vs no results, ordering, money, formulas, dates), copy and tone, accessibility and stress data.
  - 19 open questions where screens disagree or fall short (also in decisions.md, stage 3). Nothing in the prototype was changed.
- Light only. Not frozen or versioned; that's stage 5, after the owner's approval.
- 2026-10-14: the owner answered all 19 questions; the answers are in decisions.md and now built into the prototype, the guide and the tokens. Prototype changes:
  - editing sheets (event, guest, what-if, venue, price option, package) save as you go and end with Done
  - one demonstration-mode rule: sheets open, only the final button is disabled, with a line saying so; no names, no countdown, no funders, nobody signed in
  - "Show N more" everywhere; tasks and file search page too
  - counts grouped with dots; overpaid budget says "Overpaid by"; long figures shrink everywhere; the minus comes first
  - gold text on tints `#7d5f27`; "Not attending" in muted ink; idle outlines `#9a888f`; payment dots in gold ink; 24px targets; full month-cell labels
  - shortlist: preferred package in gold italic, Ascending/Descending; items column "Confirmed"; Who pays sub line; Tasks wide
  - "Add files" on records opens the shared upload sheet (now in `assets/app.js`); renames of categories and files get undo; the "Payments" filter includes your own Payment events
- 3 new open questions (20–22: decimals, faint placeholders, the link sheet's Save).
- Next: the owner answers 20–22 and reviews in the browser. Then stage 4, the coverage audit, in a fresh `./start` session (Sonnet 5.5 High).

## Stage 4: coverage (done, awaiting the owner's review)
- 2026-10-14, fresh session (Sonnet 5.5 High): `coverage.md` maps every story (O, F, B, G, T, S, R, A) and every inventory state to the screen and URL that covers it, plus the states that don't apply (dark, read-only, shared link, bulk selection) and the stress data per screen.
- The audit read each screen's code against the inventory. Gaps found and fixed in the prototype and the guide:
  - what-if items can now be split into parts (B8, B10), with a category
  - files on a booking part and on a package now work (B4, F17), and a new booking can take a contract (B3)
  - a failed save is now shown on every editing sheet, on an RSVP tap and on a task step (`?state=savefail`)
  - a partner's change now arrives on tasks, what-if, shortlist and venues too (A2)
  - busy "Removing", "Deleting" and "Restoring" (the inventory's Busy state)
  - `index.html` lists every state of every screen; two stress details corrected
- Nothing was seen rendered (the browser is blocked here), so the owner should click through `prototype/index.html`.
- Next: the owner reviews `coverage.md`, answers questions 20–22 in decisions.md and the open point on F16, then stage 5 (freeze: version and date at the top of the guide).
