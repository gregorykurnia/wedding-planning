# Phase 4 review

**Date:** 2026-10-19 · **Model:** Opus 5.5 Medium (the §7.0 pick) · **Diff:** `10b82f2..ab14db8` on `redesign` (Tasks 4.1–4.25, plus 6.2, 6.4 and 6.5, which were built before this review), reviewed in lane t1.
**Result: passed after fixes.** The first pass found four blockers:
- removing a booking's last part brought back the money from before the split (Task 4.6)
- booking a finalist added straight to the shortlist left the new vendor unlinked, so "Copy to the shortlist" made a second finalist (Task 4.14)
- "Copy to the shortlist" dropped what each price option includes (Task 4.12)
- Phase 3's S11 now loses typing on real screens: a second failure, or a later success on the same step, cleared a failed change's ring while its text stayed on screen (Tasks 4.22, 4.23, 4.24)

All four were fixed in this session. The rest are tracked below.

Six parallel reviewers each read one area against `ui-implementation-plan.md`, the design guide and the prototype:
- the budget displays (4.3, 4.4, 4.5, 4.8)
- the booking writes (4.6, 4.7, 4.9, 4.10)
- vendors (4.11–4.15)
- documents and files (4.16–4.19)
- the schedule and tasks (4.20–4.22)
- sign-in, overview, items, guests and settings (4.1, 4.2, 4.23–4.25)

Each blocker was then checked by reading the code and, for B1, against `booking.html`'s split.

## Verification run

| Check | Before fixes | After fixes |
|---|---|---|
| `npx tsc --noEmit` | failed: `web-push` (added by 6.2) wasn't installed in this worktree; clean after `npm install` | clean |
| `npm run lint` | 11 errors: the 8 old ones, plus 3 new in new-UI files (`venues.ts` memo, `payment-demos.tsx` ref read during render) | the 8 old ones only |
| Style check, old-names check | pass | pass |
| `npm test` (model) | 81 files, 1235 pass | 1237 pass (2 new) |
| `npm run test:emulator` | pass | 305 pass, 1 skipped (the real-Cloudinary test; 3 new) |
| `npm run build` | failed on `web-push` (as `tsc`) | passes |
| `npm run test:e2e` (full) | 472 pass, 36 fail (1.7 h) | see below |

The 36 e2e failures:
- **Rerun on a quieter machine:** 18 passed. They were timeouts while other sessions held memory.
- **17 emulator failures were one test bug.** `veil-finalist` and `veil-vendor` write `settings/accounts` with empty slots, and six other specs empty Firestore. None of them paired the accounts again. Every spec after them (names, overview, payments, settings) was asked "Which of you is this?" (N3). `tests/e2e/seed.ts` now has `restorePairing()`, and those eight specs call it in `afterAll`.
- **The demo booking test** matched both the demonstration banner and the message, so it now matches the message whole.
- **After the fixes:** the failed specs pass: the demo booking spec (2 of 2), and `veil-finalist`'s removal test followed by the names, overview, payments and settings specs (17 of 17). The fixer's specs for B4 pass too: `veil-tasks`, `veil-items` and `veil-guests` (40), and the demo `veil-rows`, `veil-gallery` and `veil-ledger` (36). The whole suite wasn't run again; the next phase review runs it.

## Blockers (all fixed)

**B1. Removing a booking's last part brings back the money from before the split** (Task 4.6, `src/lib/data/bookings.ts`).
- **Cause:** `splitBooking` wrote only `subEntries`, so the booking's own `totalPrice`, `budgetSpent`, `nextTargetDate` and `nextAction` stayed. `partsOf` falls back to them once there are no parts.
- **Scenario:** a Rp 20M booking with 5M paid is split, and both parts are removed. The confirm said their money "comes off this booking's totals", but the booking showed Rp 20M again, 5M paid and the old due date, and went back into Payments due and the budget.
- **Prototype:** `booking.html`'s split deletes those fields.
- **Fix:** the split now empties them (a venue gets `agreedPrice: 0`, so it doesn't fall back to its estimate), and undo puts them back. Removing the last part empties them too, for bookings the old app split. Neither UI reads them while a booking has parts.
- **Tests:** two emulator tests.

**B2. Booking a finalist added straight to the shortlist leaves no link back to it** (Task 4.14, `src/lib/data/shortlist.ts` `bookFinalist`).
- **Cause:** the new vendor was listed in Vendors at Chosen, but the finalist never got `sourceVendorId`.
- **Effect:** the vendor said "Copy to the shortlist", and copying made a second finalist. The vendor row and the CSV said it wasn't on the shortlist.
- **Fix:** the finalist now takes the new vendor as its source in the same transaction, as Move into Vendors does, and undo clears it.
- **Tests:** an emulator test.

**B3. Copy to the shortlist drops what's included** (Task 4.12, `copyToShortlist`).
- **Cause:** no package got `includes`, so comparing what each package includes (F16, F17) was empty for every copied vendor.
- **Fix:** the main package and each other package carry `includes`.
- **Tests:** an emulator test.

**B4. A failed change looks saved after another change** (Phase 3 S11, Tasks 4.22–4.24).
- **Tasks:** one failure key per step was shared by its title, tick, date and remove. A failed title followed by a tick that saved cleared the ring, while the typed title stayed on screen unsaved.
- **Items and guests:** each kept one failure, so a second row's failure cleared the first's.
- **Fix:**
  - Failures are kept per write: in tasks by step and action, in items by item and field, in guests by guest.
  - A success clears only its own failure.
  - `TaskRow` takes `failedStepIds` and `failedFields`, and `ItemRow` takes `failedFields`.
  - One Try again under a row retries all of its failures.
- **Wording:** for several failures on one item, the row shows the line of its first failed field. That wording isn't designed, so it's gap **G34/N34**.
- **Also fixed:** the added step no longer takes focus back after Undo.
- **Tests:** two markup tests, plus e2e in `veil-tasks`, `veil-items` and `veil-guests`.

## Other fixes in this session
- Enter in the Record a payment amount could record while a receipt was still uploading, or after it had failed, leaving the receipt unlinked (`record-payment-sheet.tsx` `submit`).
- The three new lint errors: dead code in `useVenues`, and the payment gallery's switches moved to a module object, as the upload gallery does.

## Haiku drift (4.3, 4.5, 4.21) and 4.5's shared spacing
- **4.3 Budget and 4.5 Bookings:** no drift. The order, wording, orders and empty layout match `budget.html` and `bookings.html`. "Difference from estimate" starts descending, which follows guide §6.8 over the prototype.
- **4.5's shared spacing:** all four values (part lines, toolbar margin, search row and selects, entry padding and phone gap) now equal the prototype's base rules exactly. What-if rows match, and vendors, schedule, guests, items and venues moved closer.
- **Vendor rows** (`.vrow`, not touched by 4.5) are still about 5px shorter than the prototype: padding 16 against 18, gap 2 against 3. The schedule's tight toolbar is 20px against 12. → S1.
- **4.21 Month:** small drift only. "Nothing on this day" sits 16px below where the prototype has 14, and the month name drops the year in the current year (guide §6.11's rule). The rest matches.

## Screenshot comparisons left to this review
Seeded in the emulator and taken with a temporary spec (not kept) at 1440px and 390px, beside the prototype:
- **Documents (4.16):** matches: hero, starts, search, three cards and Earlier with its count, all at the same positions.
- **Files (4.19):** at 1440px it matches within 2px (the search line, the name column). At 390px the prototype puts a folder's count to the right on the chevron line, and a file's description to the right of its name. The build stacks both below, so each folder row is about 20px taller. The prototype's own phone file row squeezes the name to a few letters a line, so the build's stacking reads better. → S24, for the designer to settle.
- **Tables and formulas (4.18):** the table bar, title row, the total in gold and the formula-error cell match `doc.html`. The error words in italic lose the tip of the last letter at the cell's right edge. → S24.
- **Payments due (4.8):** the structure matches. Each group sits 5–8px taller than in `payments.html`, which confirms S1.

## Should fix (open)

Budget and bookings:
- **S1.** Spacing:
  - Vendor rows: padding 16 against the prototype's 18, row gap 2 against 3.
  - Schedule's tight toolbar: 20px against 12.
  - Payments due (4.8, `payments.module.css`):
    - group headings are 48px above where the prototype has `--space-group` (44)
    - headings have no 23px phone size
    - the `Ledger` adds 8px above the list
    - the phone column gap is 12 against 14
    - Show more sits 28px below the count line against 12
- **S2.** Record a payment, Try again after an unclear failure (the write landed, the reply didn't) with a changed amount: the same `paymentId` makes the write a no-op, but the toast says the new amount and Undo takes back the old one. Lock the amount after a failure, or start a new id when it changes.
- **S3.** The partner splits a booking while its Record a payment sheet is open: every Record fails with the generic line. Re-pick the part, or say the booking changed.
- **S4.** Venue estimate:
  - Clearing it writes 0, so the sentence says "You estimated Rp 0".
  - On a venue with no `agreedPrice` (before migration 1.11), editing the estimate changes the price.
- **S5.** Typing in a top-level field and then pressing Split races the blur's save against the split transaction, so the typed value can land on a field the parts ignore. The same race exists with what-if Price then split.
- **S6.** Add a booking: if an attached file is deleted before the add lands, Try again fails every time. Also, uploads from that form go to the top of Files, not Files › Bookings › name; that was noted only in a commit body.
- **S7.** Wrong person or count in two messages:
  - The split-undo refusal names the partner when you changed the part yourself.
  - Remove funder's confirm counts bookings only, but what-if items lose the funder too.
- **S8.** The undo-conflict sentence for a payment (G13, 4.4) isn't built. Undo silently does nothing when the payment is already gone, so close it in G13 or build it.

Vendors:
- **S9.** The CSV's "All price options" leaves out what each includes (guide §5.11, N5).
- **S10.** Finalists and their bookings:
  - A finalist whose booking was removed stays "Now a booking" and can't be booked again (`movedTo` is never cleared).
  - A vendor booked from its own screen doesn't flag its finalist, which still offers Book it, a no-op that says it worked.
- **S11.** Booking a copied finalist leaves its own files behind (§2.7). A shortlist card with no packages shows nothing where the prototype says "No packages yet".
- **S12.** Categories sheet: no 40-character cap while typing (`InlineRename` allows 60).
- **S13.** Chosen with options but none marked sets the estimate to null; the prototype uses the first option.

Documents and files:
- **S14.** A stored document Tiptap can't read opens empty, and the first keystroke saves over it. Set `enableContentCheck` / `onContentError` and open it read-only with a line.
- **S15.** Files:
  - Folder delete checks for children and then removes in a separate step, so a file moved in meanwhile lands at the top level.
  - `moveFile` doesn't check that the target folder still exists.
- **S16.** Smaller documents items:
  - Remove table's Undo does nothing after you leave the document, but still looks live.
  - The move sheet says "It's empty, so nothing else moves with it", which isn't in the guide.
  - Clear the search doesn't put focus back in the field.
  - A match found only by accent folding can fall outside the extract.
  - A create retried after a timeout logs `document.added` twice.

Schedule and tasks:
- **S17.** A push reminder can be sent twice. `saveEvent` clears `remindersSent` on any time edit, because `writeWhen` always writes `startAt`, so editing only the end time after the morning-before reminder sends it again (Task 6.2). Reset only when the date or the reminder changes.
- **S18.** Mark completed, Cancel it and Back to scheduled close the event sheet without the N18 guard, so a failed field's change is dropped.
- **S19.** Focus after one-tap actions in Tasks: ticking a task moves it into a closed disclosure, and removing a step unmounts the focused ×.
- **S20.** Agenda search doesn't look at a payment's amount or payer.

Items and guests:
- **S21.** Ordering items:
  - Fast Alt+↑/↓ presses each work from the old order until the server answers, so three presses move the row one place.
  - Dragging below the 150th shown row takes neighbours from the shown page only, so the row can tie with a hidden one.
  - Above 490 items the first move after renumbering is refused as changed (Try again works).
- **S22.** A double tap on one guest's reply flickers, and Undo on the first toast blames the partner. A guest added on a try that landed but reported failure drops edits made before Try again.
- **S23.** An item's unsaved name is lost when its row unmounts (filter, sort, paging). Note it in G31.

Screenshots:
- **S24.** Files at 390px: decide whether folder counts and file details go to the right (the prototype) or below (the build), and record it in the guide. A formula error's italic words are clipped at the cell's right edge; give the cell a little end padding.

Carried from the Phase 3 review:
- **Done since Phase 3:**
  - S1 and S7 (Done and dismissal in edit sheets) are covered by the N18 follow-up, except S18 above and a route change.
  - S11 is B4 here.
- **Still open:**
  - S2: the busy flag is a set of sheet ids, not a count of holders. It bites the categories sheet.
  - S9: upload-sheet fields save on blur only, and `clearFinished` drops entries whose rename failed.
  - S10: Record payment on the agenda, Earlier, Later and Back to today are still local copies of `Btn` and `TextLink`. Task 4.20 didn't take it.
  - S12: Move up and down from the item menu skip `ItemList`'s refocus and the live-region line.
  - The status of S3–S6, S8 and S13 wasn't re-checked in this review.

## Coverage
§5.2 stories each reviewer followed end to end in code:
- **Overview, sign-in, settings:** O1–O6, A1, A3 (settings half), A5
- **Budget:** B1–B12, except B4's last-part case before B1's fix
- **Vendors, shortlist, venues:** F1, F3–F24, except the inclusions (B3, S9)
- **Documents and files:** R1–R8, R11–R14
- **Schedule:** S1–S9, plus S10's sheet half (6.2 has the rest)
- **Items:** T1–T10
- **Guests:** G1–G8

§5.2 says stories are ticked when their behaviour test passes (Task 8.1), so this review leaves those boxes alone.

§6 rows ticked here: the route rows for venues, vendors and the shortlist, `confirmed`, `master-list`, `guests`, `schedule`, `todo`, `notes`, `files` and `settings`, since each screen is built and was checked against its prototype. Rows for states, dialogs and wording that Phase 5 and 6 tasks finish stay open.

Still open from Phase 4, recorded earlier: the owner's spot-check of five production documents (4.17), and Bella's sign-in check (Phase 1).
