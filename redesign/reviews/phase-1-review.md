# Phase 1 review

**Date:** 2026-10-14 · **Model:** Opus 5.5 High (the §7.0 pick) · **Diff:** `3fb86f3..43176da` on `redesign` (127 files, about 12,000 lines).
**Result: passed after fixes.** The first pass found three blockers (one in Task 1.10, two in Task 1.7). They were fixed the same day and a fresh re-review of the fixes confirmed all three (see "Fixes" at the end). The should-fix items below are still open and are tracked here. Phase 1 is ticked in `redesign-plan.md` once the owner checks below are done.

Seven parallel reviewers each read one area against `ui-implementation-plan.md`, the design guide and the prototype. The blockers were then checked again by hand in this session.

## Verification run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (model) | 14 files, 343 tests pass |
| `npm run test:emulator` (data + rules) | 6 files, 155 tests pass |
| `npm run build` | passes; `/new` and all 15 old routes build |
| `npm run lint` | 8 errors, **all from before Phase 1**: 7 in the bundled `public/pdf.worker.min.mjs` (commit 534d71f) and 1 in `(legacy)/settings/page.tsx:27`, which only moved and is otherwise identical to `main`. Fix: add `public/pdf.worker.min.mjs` to the ESLint ignores and leave the settings page alone (it's old UI). |
| `npm run test:e2e` | not run in the first pass (ports held by stray processes); after the fixes, **29 of 29 pass** (run with only the Auth emulator started beside the Firestore emulator already on 8080) |
| Preview deploy | the latest `redesign` preview is Ready. The owner still has to compare the old UI on the preview with production screen by screen, signed in (Phase 1 Done-when). |

## Blockers

**B1. Undo of Split, Add a part and the what-if part operations writes back an old copy of the whole parts list** (Task 1.10). `src/lib/data/undo.ts:75-82`: `patchWithUndo` stores `before.subEntries` and its undo writes that array back as it was. It's used by `splitBooking` (`bookings.ts:174`), `addPart` (`:196`), `splitWhatIf`, `addWhatIfPart` and `removeWhatIfPart`.
- Scenario: Add a part, then record Rp 20.000.000 on Deposit while the toast is still open, then tap the add-part Undo. The payment's `budgetSpent` and `payments[]` entry are gone, with no message. The same happens with Split, then a payment by either partner, then undoing the split.
- Fix: targeted undos. Add-part undo removes that part by id. Split undo refuses (with a `WriteError` the screen can show) when `subEntries` no longer equals what the split wrote. Also fix `patchWithUndo` in general (see S1). Add emulator tests where data changes between the operation and its undo.

**B2. `=SUM(B:B6)` (a range with no start row but an end row) now gives "Bad reference"** (Task 1.7). `src/lib/model/formulas.ts:168-183` has no branch for this form. The old engine (`components/notes/formulas.ts:52`) summed rows 1–6. Task 1.7 says the new engine "must accept every formula the old engine accepted". No stored note uses a formula today, but the requirement is explicit. Fix: accept `([A-Z]+):([A-Z]+)(\d+)`, starting below the title row as `B:B` does, and test it.

**B3. Comma-grouped amounts already in production notes read as text worth 0** (Task 1.7). `parseNumber` (`formulas.ts:64-68`):
- "1,000,000", "45,000,000" and "Rp 1,500,000" are treated as text. The old engine read 1000000.
- "1,234" reads as 1.234 and "45,000" as 45.

Production notes hold 10 such cells, so a `=SUM` over them shows a wrong total without any error. Fix: read `^-?\d{1,3}(,\d{3}){2,}$` (two or more comma groups) as thousands. **Owner call:** is a single group like "45,000" 45000 or 45?

## Should fix before the next phase builds on it

Write layer and old UI (Task 1.8):
- **S1.** `patchWithUndo` undo overwrites a partner's newer value in the same field (`undo.ts:75-82`). Example: Gregory moves a file, Bella moves it again, Gregory taps Undo, and Bella's move is lost. Restore only the keys that still hold what this change wrote; otherwise refuse with "changed by …".
- **S2.** A retry after a timeout starts a second attempt instead of waiting for the first (`write.ts:51-58`). A late first delete makes the `removeWithUndo` retry fail with `missing`. `addSubEntryFile` and `addVendorSubEntryFile` (`confirmed-sub-entries.ts:83-86`) append with no URL check, so a retry can add the file twice. Keep the in-flight promise and await it in `retry()`, and skip URLs that are already there.
- **S3.** Old-UI array edits (booking parts, price options, finalist packages, task steps) now go through `runTransaction`. **Offline, an edit is now lost without any message**, where before it was queued and synced later. No caller catches the error (`editable-text.tsx:43`, `todo/page.tsx:96,102,113`, `vendor-price-options-cell.tsx:40-80`, `confirmed/page.tsx:788-858`). The change log only says "shows after the server confirms". Either add a `catch` that alerts, or have the owner accept it and note it in the change log.
- **S4.** The To Do step date saves on every keystroke as a transaction. Racing transactions can commit out of order, leaving a year from partway through the typing (`(legacy)/todo/page.tsx:110-114`). Save on blur, or use a plain `update` for whole-field changes.
- **S5.** `renumberMasterList` lists rows outside the transaction and never reads `metaRef`, so a row the partner adds at the same moment can share a `sortOrder` (`collections/master-list.ts:194-240`). The comment at `:191` claims the opposite. Read the meta inside the transaction and bump a version on every add and delete.

Booking and money writes (Task 1.10):
- **S6.** Undoing a payment after a split takes it out of the top-level `payments[]`/`budgetSpent`, while the Deposit part still shows it paid. Split also leaves the payment history at the top level (`bookings.ts:43-54`, `:303-313`). Move the payments into Deposit on split, and refuse the payment undo once the record has parts.
- **S7.** Removing the last part brings back the pre-split price and paid (`removePart`, `bookings.ts:218`). Refuse it, or zero the top-level fields in the same transaction.
- **S8.** `removeFunder` writes `funder: null` on what-if parts, and `adapters/what-if.ts:26-28` reads null as "the item's funder", so the amount moves to another funder instead of Not assigned. Choosing "Not assigned" on a part has the same problem. A part needs a way to say "explicitly nobody".
- **S9.** `bookFinalist` undo writes `booking: null` where the field was missing (`shortlist.ts:171-176`), which hides an old-UI Chosen vendor from the new budget. It saves values even when nothing was written, and its "never twice" check ignores the old Chosen/Done status. Use `deleteField()` for missing fields and save only when the write ran.
- **S10.** `moveFinalistToVendors` after `bookFinalist` creates a second vendor, so the booking is counted twice (`shortlist.ts:202-206`, `:255`). Set `sourceVendorId` when booking creates a vendor, and refuse when `movedTo` is set.
- Test gaps: `splitWhatIf` undo is never called. `addDirectBooking` returns no undo. No test refuses removing a booked venue.

Old UI drifting from migrated data (Task 1.11; the old UI stays live until Phase 7):
- **S11.** Saving Settings in the old UI erases `startedOn`: `saveWeddingSettings` uses `setDoc` without `merge` (`collections/settings.ts:55`). Add `{ merge: true }`. If Settings has been saved since the migration ran, re-run `6-started-on`.
- **S12.** The old UI's guest delete-and-undo (`restoreGuest`, `collections/guests.ts:59-73`) rewrites the guest without its `number`. Guests the old UI creates (`createGuest`) don't take a number from `guestMeta/counter`, so their shown numbers shift when the next numbered guest is added. Carry `number` in `restoreGuest`, and use `createNumberedGuest` in the old UI.
- **S13.** Booked venue prices edited in the old UI go to `budgetEstimate`, but the model reads `agreedPrice` first (`model/bookings.ts:158`). A record moved off Chosen/Done/Booked in the old UI keeps `booking`. Re-running migration 3 doesn't fix either. Before Phase 7, add a sync step (or have the old UI write both fields). Track this as a Phase 7 prerequisite.
- **S14.** Migrations 1 and 5 bring back a funder or file deleted after the run if run again. Make `run.ts --apply` refuse a migration already recorded in `appMeta/migrations` unless `--force` is given.
- **S15.** Package files copied from a vendor's parts may have been filed twice (`migrations.ts:249-267` skips vendor copies only on the finalist's top-level `files`). First a read-only check of production `weddingFiles` grouped by `url`; a cleanup migration only if it finds duplicates. Must be done before Task 6.3 (Delete for good).

Model (Tasks 1.4–1.7):
- **S16.** No "No price yet" state: price 0 and paid 0 reads as paid in full (`money.ts:72`; guide §4.7). Add it and test it.
- **S17.** Missing model functions the plan puts in Phase 1, so later Haiku screen tasks would end up doing the maths: bookings ordering, with parts staying with their booking and Difference from estimate (§5.5, §6.8, §6.9); what-if ordering (§5.10); bookings search, including "Not assigned" (§5.5, §5.9); Payments due hero figure and group totals (§5.8, §4.5); "Paid by 3 funders"; a money-input parser (§6.9). Add them before Tasks 4.5, 4.8 and 4.10.
- **S18.** A stored `estimate: null` still falls back to the leaning option (`bookings.ts:134`), so "No estimate" can't show. Fall back only when the key is missing. A `budgetEstimate` of 0 counts as an estimate of 0 (`:163`).
- **S19.** `sortTableRows` sorts every non-fixed row as one pool, so rows move across a subtotal and change it (`formulas.ts:231-239`; the test at `formulas.test.ts:361` asserts this). Sort each run between fixed rows on its own.
- **S20.** `remindersDue` builds dates in the process's time zone (`reminders.ts:29-30`). The Task 6.2 cron runs in UTC, so a Jakarta reminder fires 7 hours late. Pass the zone in (Asia/Jakarta).
- **S21.** `taskDueText` shows a finished task with no finish date as "Done <due date>", which can be in the future (`tasks.ts:86`). Gap G8 already says not to. Show "Done" only.

Rules (Task 1.9):
- **S22.** On `presence` update, `firestore.rules:91` checks only the new `uid`, so one account can take over the other's presence entry. Require `resource.data.uid == request.auth.uid` (or the id pattern) on update, with a test.

## Minor

- Rules: `activity.at` can be set to any time. Require `== request.time`. `members/{uid}` email isn't tied to the token.
- `changeMany` restores missing fields as `null` (`many.ts:65`). A failed later chunk leaves the earlier chunks committed with no undo (one chunk at today's volume).
- `copyToShortlist`'s duplicate check is a query outside the transaction. `recordPayment` called again logs a second activity entry. `splitBooking` retried after it landed fails "Already in parts". `removeBooking` leaves the old status, so the old UI keeps counting it.
- `splitPlan` puts an overpayment on Deposit; the prototype puts it on Balance (same totals).
- Formats: `compact(1e9)` → "1000M"; `dec` of a raw float; `items.ts:39` rounds 199/200 to 100%; totals above 2^53 lose precision (stress data only). CSV has no formula-injection guard. Category counts and focus chips are case-sensitive (`categories.ts:83,90`).
- Formulas: "0.500" reads 500. A growing range in a total row includes another total (follows the guide's wording; owner call). The loop message names the wrong cell.
- "When it starts" can never fire for a timed event (N11 covers it). The five-time-zone test runs aren't in any npm script.
- Migrated files have `fileType: ""` and `fileSize: 0`, and every migrated record has `updatedBy: "migration"`, which later "edited by" lines must handle.
- Old UI: unknown URLs now get Next's bare 404 (no root layout). `components.json` still points at `src/app/globals.css`. The old Register button now creates accounts the rules deny.
- Smoke tests: no test for the signed-out redirect or nav `href`s; `confirmed.spec.ts` picks the delete button with `.last()`.

## Owner checks

1. **Bella's sign-in.** The rules now require a verified address. Google sign-in is verified; an email/password account is not, and nothing sends a verification email. Only the owner's account has been confirmed on production. Bella should load and save once on production; if she uses a password, she should sign in with Google once.
2. Compare the old UI on the `redesign` preview with production, screen by screen (Phase 1 Done-when).
3. B3: is "45,000" 45000 or 45?

## Done-when per task

| Task | Done-when met? |
|---|---|
| 1.1–1.3 | Yes (e2e green not re-run here; see above) |
| 1.4 | Yes as written; S16–S18 add rules the guide has that no test covers |
| 1.5, 1.6 | Yes; S20 and S21 to fix |
| 1.7 | **No**: B2 and B3 break "accepts every formula the old engine accepted" |
| 1.8 | Yes for the listed emulator tests; S1–S5 to fix |
| 1.9 | Yes; owner check 1 still open |
| 1.10 | **No**: B1 loses payments; `splitWhatIf` undo untested |
| 1.11 | Yes; S11–S15 keep production consistent until Phase 7 |

## Escalation (§7.0)

The review rejects Tasks 1.7 and 1.10:
- **1.7** was Sonnet 5.5 High; its fix moves one row up to **Opus 5.5 Medium**.
- **1.10** is already Opus 5.5 High, the strongest row, so it stays.

Suggested fix sessions:
1. B1, S1, S2, S6–S10 (write layer and bookings) · Opus 5.5 High.
2. B2, B3, S19 (formulas) · Opus 5.5 Medium.
3. S11, S12, S14, S22 (old-UI patches, migration guard, presence rule) · Opus 5.5 High, since the rules deploy to production.
4. S16–S18, S20, S21 (model gaps) · Opus 5.5 Medium.

Then a re-review of those diffs only (Opus 5.5 High). S3, S4 and S5 can go with session 1 or be accepted by the owner. S13 and S15 are tracked for Phase 7 and Task 6.3.

## Fixes (2026-10-14, same session)

- **B1 fixed.** `patchWithUndo` undo now refuses with the new `WriteError` code `changed`, writing nothing, unless every field it would put back still holds what the change wrote (`sameValue`, `stillAsWritten` in `src/lib/data/undo.ts`). This also fixes **S1** for every caller (file moves, funder renames, mark booked, remove booking). Add a part and the what-if add now use `removeAddedElement`: undo takes out only the added part by id, so payments on the other parts stay, and refuses if that part was itself changed. A second tap on Undo does nothing, and an undo with nothing left to remove writes nothing.
- **B2 fixed.** `=SUM(B:B6)` sums from below the title row down to row 6 (nothing when it ends at the title row).
- **B3 fixed.** Commas before groups of exactly three digits are thousands, as the old engine read them: "45,000,000" → 45000000, "45,000" → 45000, "Rp 1,500,000" → 1500000 with Rp kept. Other commas stay decimal ("2,5", "2,25"). A group never starts with 0, so "0,500" and "0.500" are 0.5. Owner question 3 is answered by this rule: "45,000" is 45000. Note that "2,500" is now 2500, not 2.5.
- **New design gap.** The guide doesn't say what the toast says when undo is refused: G13 in §9.1 and N13 in `needs.md` (banned-word scan clean), before Tasks 2.6 and 3.8.
- **Tests.** 7 new emulator tests: a split undo refused after a payment on a part; an add-part undo keeping a payment on another part; an add-part undo refused once that part was paid; a what-if split undo; a file move undo refused after the partner's move; an RSVP undo refused after the partner's change; and `sameValue`. The model tests gained the comma-thousands, `B:B6` and title-row cases. Results: model 346, emulator 162, e2e 29, all passing; typecheck clean.
- **Re-review** (fresh session) of the fix diff: all three blockers fixed, no new blocker or should-fix. Its three minor points (double undo, a stray write, the title-row edge) were fixed before the commit.
