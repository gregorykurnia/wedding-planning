# Open review items: where each one gets fixed

Every review's open "should fix" items are routed here to exactly one task, so none is left only in a review file. The item itself (what's wrong, where, the suggested fix) stays in its review file; this file says only where it goes. A task that takes items reads each one in its review file first, fixes it with a test (an emulator test for any write), and names the IDs in its commit body. The next phase review checks them.

IDs: `P1-S2` is S2 in `phase-1-review.md`, and so on. Each phase review adds its own section below, in the same commit as the review.

## Phases 1–4 (sorted 2026-10-19, statuses checked against `redesign` at `97a8db3`)

Already fixed, nothing to do: P1-S1, P1-S7 and P1-S10 (`d467d18`), P1-S17, P1-S20 (`fe4d8e8`), P1-S21 (`d73011b`), P2-S4 (each screen applies the hit only while its record is missing), P2-S5, P2-S6, P3-S1, P3-S7, P3-S11.

### Before Phase 5: fix tasks 4.F1–4.F5

These lose, corrupt or duplicate data, or show a failed write as saved. Phase 5 builds every screen's states on top of them, so they go first.

| Task | Lane | Items |
|---|---|---|
| 4.F1 Money and bookings (L) | t1 | P1-S2 (a retry after a timeout runs the write twice; affects every `guarded()` write), P1-S6 (split leaves payments at the top level, so undoing one drives `budgetSpent` below zero), P1-S8 (removing a funder moves what-if parts to another funder), P1-S18 and P4-S4 and P4-S13 (estimate fallbacks), P4-S2 (Try again with a changed amount), P4-S3 (partner splits while Record payment is open), P4-S5 (blur save racing Split), P4-S7 (wrong person or count in two messages), P4-S8 (payment undo-conflict sentence, G13) |
| 4.F2 Documents, files and uploads | t1 | P4-S14 (unreadable document opens empty and the first keystroke overwrites it), P4-S15 (folder delete and move races), P1-S19 (table sort moves rows across subtotals), P3-S9 (upload-sheet edits lost on close), P4-S6 (Add a booking's attached file and upload folder) |
| 4.F3 Vendors, rules and scripts | t2 | P1-S9 (`bookFinalist` undo writes `booking: null`), P4-S10 (finalist stays "Now a booking"; Book it from a vendor says it worked), P4-S11 first half (copied finalist's files left behind), P4-S9 (CSV leaves out what each option includes), P4-S12 (categories 40-character cap), P3-S4 (`readAmount` rounding in the venue filter), P1-S22 (presence and `pushSubscriptions` rules check only the new `uid`; deploy the rules with the owner), P1-S14 (migrations refuse a second run without `--force`, needed before Phase 7 re-runs them) |
| 4.F4 Schedule, items and guests | t2 | P4-S17 (push reminder sent twice), P4-S18 (event status buttons skip the N18 guard), P1-S5 and P4-S21 (item ordering races; the new UI calls `renumberMasterList`), P4-S23 (an item's unsaved name lost on filter, sort or paging; also note it in G31), P4-S22 (guest double tap, undo blames the partner, edits dropped after Try again), P4-S20 (agenda search ignores a payment's amount and payer) |
| 4.F5 Shared sheets and partner news | t2 | P3-S2 (sheet busy flag isn't a count of holders), P3-S3 (failed notes save looks saved), P3-S5 (confirms throw away the `WriteError`), P3-S6 (busy sheet stays open over a new route), P2-S1 (trusted account re-probed only on `online`), P2-S2 and P2-S3 (presence and partner toasts compare server times with the device clock) |

### Folded into later tasks

| Item | Task | Why there |
|---|---|---|
| P1-S16 ("No price yet": a part at 0 of 0 reads as paid) | 5.2 Budget group states | It's a missing state |
| P4-S11 second half ("No packages yet" on a shortlist card) | 5.3 Vendors group states | Empty state |
| P4-S16 (Remove table's dead Undo, move-sheet sentence, search refocus, accent-folded extract, double `document.added`) | 5.4 Documents and files states | Small state and wording items on those screens |
| P3-S8 (focus lost after Show everything / Show more), P3-S12 (item menu Move skips refocus and announcement), P4-S19 (focus after finishing a task or removing a step) | 8.4 Accessibility check | Focus order and return is that task's checklist |
| P4-S1 (spacing), P4-S24 (Files at 390px: decide and record in the guide; formula error clipped) | Phase 8 review (8.3a and 8.3b left both open: 8.3a's Files and documents groups; 8.3b did not touch them) | Visual diffs against the prototype; P4-S1 needs a browser measure of the sheet's field rows |
| P3-S10 (local copies of `Btn` and `TextLink`) | Done in 8.3b: the agenda's Earlier, Later and Back to today use the shared `Btn` (with an `ariaLabel` prop) and `TextLink` | Visual diffs against the prototype |
| P1-S11, P1-S12 second half, P1-S13 (old UI drifting from migrated data: `startedOn` erased, unnumbered guests, venue prices in `budgetEstimate`) | 7.1 Switch-over (scripts, dry runs), then `redesign/before-merge.md` | Re-check production and re-run the affected migrations before the merge (needs P1-S14 from 4.F3) |
| P1-S15 (package files possibly filed twice) | 7.1 Switch-over (the script), then `redesign/before-merge.md` | A read-only check of production `weddingFiles` before the merge |
| P3-S13 (no test that the gallery is off; `NEXT_PUBLIC_VEIL_GALLERY` in Vercel production) | 7.1 Switch-over (the test), then `redesign/before-merge.md` | Add the test; the owner checks Vercel's production variables before the merge |

### Dropped

| Item | Reason |
|---|---|
| P1-S3, P1-S4 (old UI: offline array edits lost, step date saved on every keystroke) | Old UI only, deleted in 7.3; production runs `main`, so a fix here wouldn't reach it before then |

## Phase 5 (sorted 2026-10-19, in the review)

All of Phase 4's routed items were re-checked: 4.F1–4.F5 fixed them, except P1-S2 and the P4-S3 fix's side effect, which were blockers B2 and B3 in `phase-5-review.md`, fixed in the review.

### Before the Phase 6 review: fix tasks 5.F1–5.F3

| Task | Lane | Items |
|---|---|---|
| 5.F1 Money, items and guests writes | t1 | P5-S1 (a late try overwrites the corrected amount), P5-S2 (funder confirm undercounts while what-if loads), P5-S4 (split of an overpaid booking), P5-S18 (add below during a pending move ties positions), P5-S19 (item text edited twice loses typing), P5-S20 (retried guest add drops a partner's edit), P5-S21 (ordering above 490 items, old UI's version bump, a screen test for quick moves) |
| 5.F2 Documents, files and rules | t2 | P5-S6 (folder delete says nothing was deleted), P5-S8 (`canonical()` skips `.check()`, screen crashes), P5-S9 (move undo into a deleted folder has no words), P5-S10 (folder and upload into a just-deleted folder), P5-S11 (Add a booking's folder after giving up), P5-S13 and P5-S14 (`pushSubscriptions` and `presence` rules; the deploy is the owner's, in `redesign/before-merge.md`) |
| 5.F3 States, wording and the harness | t1 | P5-S3 (split undo-conflict sentence), P5-S7 (offline hold on screens with several sources), P5-S12 (whole-screen nouns), P5-S15 (categories cap test), P5-S16 (offline save line), P5-S17 (Everything done opens finished tasks), P5-S22 (fault switch as a build constant), P5-S23 (cold-offline and held-loading faults, seed project id), P5-S24 (wiring tests for P3-S6, P3-S5, P2-S1; `google-failed` spec), P5-S26 (merge a burst of partner toasts), P5-S27 (vendor-counting specs check for another spec's leftover vendors first), P5-S28 (recheck whether Phase 4's 18 "timeout" failures were the same leftover booking), P5-S25 (raise it as a gap: §9.1 and `needs.md`) |

### Folded into later tasks

| Item | Task | Why there |
|---|---|---|
| P5-S5 (states the prototype has that §5.1 doesn't list) | 8.2 Screenshot comparison | Add the rows first, so the screenshots cover them |
| P5-S8 second half (the content check refuses some documents that used to open) | 7.1 Switch-over (the script), then `redesign/before-merge.md` | A read-only pass over production `notes` (`nodeFromJSON(normaliseDoc(c)).check()`) before the merge |
| P5-S22 second half (`NEXT_PUBLIC_VEIL_DEV` must not be set in Vercel production) | `redesign/before-merge.md` | Checked with the production variables, beside P3-S13 |

### Dropped

| Item | Reason |
|---|---|
| `readAmount("-0")` against `amountProblem("-0")` (no ID) | The field refuses it, so nothing is read or lost |

## Phase 6 (sorted 2026-10-22, in the review)

Phase 5's routed items were re-checked: 5.F1–5.F3 fixed them, except the parts listed below as P6-S8, P6-S9 (P5-S18, P5-S19 follow-ups), P6-S15–S16 (P5-S7), P6-S17 (P5-S16) and P6-S18 (wiring tests for P2-S1, P5-S2, P5-S19, P5-S26). P6-S1–S7 were fixed in the review.

### Before Phase 7: fix tasks 6.F1–6.F2

| Task | Lane | Items |
|---|---|---|
| 6.F1 Write races | main folder | P6-S8 (an add and a pending move take the same gap), P6-S9 (an older try's Try again overwrites newer text), P6-S10 (a late first guest add undoes Try again's changes), P6-S11 (a delete during a renumber above 490 items scrambles the order), P6-S13 (a Deposit reads negative after an overpaid split and a lower Try again) |
| 6.F2 Offline states and wiring tests | main folder | P6-S14 (a sheet freed by a failed add closes with no word), P6-S15 (offline, secondary lists never loaded read as empty), P6-S16 (offline booking says "isn't here"), P6-S17 (the rest of the offline save wording), P6-S18 (wiring tests that fail when the wiring is removed) |

### Folded into later tasks

| Item | Task | Why there |
|---|---|---|
| P6-S12 (the gallery-off rewrite lands on the catch-all after the move) | 7.1 Switch-over | It only breaks once `(veil)/new/*` moves to the root; 7.1's text now says so |

### Dropped

| Item | Reason |
|---|---|
| P6-S19 (the old UI keeps `remindersSent` when an event's date changes) | Old UI only: it's the fallback for the launch window, deleted in 9.2; the new UI clears it |
| Chrome's own install offer beside the card (no `preventDefault`) | Keeps the browser's offer, which is what an installed-from-menu user sees anyway; P6-S1 hides the card after either |
| A `maxDuration` on the cron route | Only a few reminders are ever due; the default 300 s is far above a run |

## Phase 7 (sorted 2026-10-22, in the review)

Phase 6's routed items were re-checked: 6.F1 and 6.F2 fixed them, except the parts listed below as P7-S6, P7-S7 (P6-S8, P6-S13), P7-S12, P7-S13 (P6-S14) and P7-S14, P7-S15 (P6-S15). The review fixed B1–B4, P7-S1–S5 and P7-S19.

### Before Phase 8: fix tasks 7.F1–7.F2

| Task | Lane | Items |
|---|---|---|
| 7.F1 Write races, money and scripts | main folder | P7-S6 (an add then a move share a gap), P7-S7 (a lower Try again after an overpaid split puts paid on the wrong parts; Undo refused), P7-S8 (a move or add during a renumber above 490 items), P7-S9 (a guest field changed back is lost), P7-S10 (a stale Try again stays on screen), P7-S11 (script tests for `contentJson` documents, foreign nodes, finalist marks, venues with parts) |
| 7.F2 Sheets and offline | main folder | P7-S12 (confirms still close with no word), P7-S13 (the categories sheet too), P7-S14 (offline venue sheet blank; synced empty collections held), P7-S15 (a booking's files read "None yet" offline), P7-S16 (an edit sheet closes on Back during a failing autosave), P7-S17 (the rest of the offline wording), P7-S18 (a wiring test with a fixed wait; an e2e for the plain release-close) |

### Dropped

| Item | Reason |
|---|---|
| The Shortlist's "booked" label offline comes from `movedTo` only (6.F2 review, no ID) | Only the label can be wrong, while offline; Book it can't run offline, and the label corrects itself when the vendors arrive |
| Unknown addresses (and `/old/budget`, `/old/checklist`) answer the not-found screen with a 200 | The screen is right for a person; the only wrong one is the status code, which nothing reads. Redirects for the two old pages would change `next.config.ts` lines the switch commit owns, which would make the revert conflict. Task 7.3's "answer 404" wording is corrected |
| The files check groups by exact address, not also `publicId` | P1-S15 is about one address copied twice, which it finds; an asset under two addresses is safe, since Delete for good keeps an asset another file shares |
