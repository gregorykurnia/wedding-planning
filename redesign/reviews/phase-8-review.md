# Phase 8 review

**Date:** 2026-10-22 · **Model:** Opus 5.5 (the §7.0 pick is Opus 5.5 Medium), unattended `autorun` · **Diff:** `20d7cae..f8adc16` on `redesign`: fix tasks 7.F1 (`876b2df`) and 7.F2 (`a0e60a6`), and Tasks 8.1a–8.6. Reviewed in the main folder.
**Result: passed** once the two blockers below were fixed in this session. Seven should-fix items were fixed with them, along with P4-S1 and P4-S24 (routed here). The rest go to fix tasks 8.F1 and 8.F2 before the merge (`triage.md`, Phase 8). The owner's checks (the screenshot pairs, the device checklist) are under "Waiting for the owner"; they don't hold the review (§7.0).

Four parallel reviewers each read one area against `ui-implementation-plan.md` and the Phase 7 review:
- 7.F1 (P7-S6–S11)
- 7.F2 (P7-S12–S18)
- 8.1a and 8.1b: story coverage against §5.2, and test quality
- 8.2–8.6: the screenshot script's safety, the 8.3 and 8.4 fixes, and the device checklist, `CLAUDE.md` and `before-merge.md` against the code

A fifth checked the 40 open §6 rows against the code.

## Verification run

| Check | Result |
|---|---|
| `npx tsc --noEmit`, lint on changed files | clean |
| Style check, old-names check | pass (422 files, 53 terms) |
| `npm test` (model) | 1346 pass |
| `npm run test:emulator` | 387 pass, 1 skipped (one new: B1's test, which fails on the old code) |
| `npm run build` | passes (inside the e2e run's production builds) |
| Full e2e on production builds (`E2E_BUILD=1 npm run test:e2e`) | 671 of 675 pass in 8 passes (demo 263, emulator 76 + 80 + 71 + 75 + 80 + 24, stress 6; about 45 min of tests plus the builds); the 4 failures fixed and passing on rerun (see "Full e2e run") |

## Full e2e run

- One full run after the fixes above, on production builds, with nothing else running. The new wiring tests (B2, S8), the changed payment, a11y and reduced-motion tests all passed. The 4 failures:
  - **Three specs 8.3a and 8.4 left behind** (neither ran them): `veil-agenda.spec.ts:124` read the month's "+2" as text, which 8.4 now draws from `data-more`; `veil-shortlist.spec.ts:200` expected the whole booked card at 70%, which 8.4 moved to the name (G44); `veil-ledger.spec.ts:119` caught a real regression from 8.3a: on a phone a file's name was squeezed to 64px by its description (P4-S24 below, G46).
  - **`veil-who.spec.ts:124`** waited 100 s for the top bar after signing in; it passed on rerun in 6 s, with nothing changed (a slow first load).
- Rerun on production builds: the four tests, all passed. No servers were left on this copy's ports.

## Blockers (fixed in this review)

- **B1. A lower Try again could move paid between parts** (`recordPayment`, `src/lib/data/bookings.ts`, from 7.F1's P7-S7 fix). The cut on a lower Try again came off any other part's "unbacked" paid, not only what an overpaid split moved there. Paid typed in the old UI has no payments behind it, so it counted too. Example: Deposit has 5M paid from the old UI, record 4M on the Balance, it times out but lands, and Try again with 3M. The Deposit dropped to 4M while the Balance stayed at 4M with a 3M payment; Undo then left 1M paid on the Balance with no payment. Fix: only the holder's payments over its own paid (what the split moved off it) come from the other parts. Emulator test "a lower Try again leaves another part's old-UI paid alone, and its Undo still works" fails on the old code; the two P7-S7 tests still pass.
- **B2. Done while a change saved, then a move, lost the failure silently** (`EditSheetActions`, `src/veil/shell/sheet.tsx`, a gap in 7.F2's P7-S16 fix). Only `SaveLine` registered the sheet's failure, and Done swaps it for "Saving, then this closes". Offline, edit a guest's country, Done, Back: when the save timed out, the save scope's hold let go with no failure registered, so the sheet closed, as if saved. Now `EditSheetActions` registers it whichever line shows. Emulator wiring test in `veil-wiring.spec.ts`.

## Should fix (fixed in this review)

- **S8. Escape and a scrim tap did nothing while a field saved** (`requestClose`, `sheet.tsx`; 7.F2's save-scope hold made every autosave "busy" before the guard was asked). The guard is asked first again, so they say "Saving, then this closes". Wiring test.
- **S9. The payment sheet's failure said "wasn't recorded" offline** (`record-payment-sheet.tsx`; P7-S17 missed it). It now uses `OfflineOr`, and the emulator test expects the offline line.
- **S10. The item menu's Move up and Move down stopped at the edge of the rows shown** (8.4 sent them through the keyboard move, which only sees the shown page): Move down on row 150 of 151 did nothing. At the edge it now falls back to the whole-list move, as before 8.4.
- **S11. Show everything and Back to our order focused the search after a tap too** (`focusSearchAfter`, 8.4), which opens a phone's keyboard. Now only for a keyboard press; the P3-S8 test presses Enter.
- **S12. The reduced-motion test passed without the rule** (it read `main`, which has no transition). It now probes an element with a 1s transition and animation.
- **S13. `settings.module.css`'s account names used a raw 21px** where `--text-row` is 21px, under a comment that named the wrong token.
- **S14. Docs:** `device-checklist.md` never said to deploy the rules to the test Firebase project (every read refused otherwise; the command carries `--project`, so they can't go to production), and pointed at a missing "In person" section. `before-merge.md`'s layering item named one of the gallery's two imports; the item itself moved to 8.F1, since it's code work, not the owner's.
- **P4-S1 (routed here). Spacing**, each to the prototype's rule: vendor rows' padding 18 (`.vrow`); the schedule's toolbar 12 under its focus chips (`Toolbar close`); Payments due's headings at `--space-group` with the 23px phone size, the list right under its heading (`.dues`), and Show more 12 under a count line (`ShowMore afterCount`, also Tasks). The phone column gap was already 14. The row gap stays 2 (the nearest token to 3).
- **P4-S24 (routed here).** A formula error's italic keeps room for its last letter (`content.module.css`). Files at 390px: a folder follows `files.html` as 8.3a built it (its count stays at the right, the chevron's line), but a file's description goes back under its name: following the prototype left the name 64px wide, a few letters a line (the full run's `veil-ledger` failure). Recorded as gap G46 / N46 for the designer to settle.

## Should fix (open)

Moves, offline reads, layering and tabs (8.F1):
- **S1.** P7-S6's positions can go stale (`items-screen.tsx:186-189`, `:310-313`). `m.placed` is cleared only by the `[stored]` effect, which returns early while a move runs. If the snapshot of this device's write arrives before the move settles and the partner moved a row meanwhile, `placed` keeps the old position; the next move beside it is refused `changed`, and a `changed` refusal keeps `placed`, so every retry is refused until another snapshot. Mark the positions stale when the effect skips and clear them when the queue goes idle; clear them on `changed` too.
- **S2.** P7-S14, offline cold start (G42): `synced` (`src/lib/collection-answers.ts:61`) lives in memory, so an app opened offline holds the empty cached `weddingFiles` read, and a couple with no files gets "You're offline" in the venue sheet for a venue the list shows, and a booking never says "None yet". Keep `synced` in `sessionStorage`, or don't make the files a main source of the venue sheet.
- **S3.** Layering (found in 8.6): `settings-screen.tsx:4-5` imports `src/lib/collections/` (`members`, `schedule-events`), and `src/veil/gallery/upload-demos.tsx:4-5` imports `firebase/firestore` and `@/lib/firebase`. §2.7 promises a lint rule; `eslint.config.mjs` has none. Move the two reads into `src/lib/data/`, add a `no-restricted-imports` rule for `src/veil/**`, and either move the gallery's import or give the dev-only gallery a written exception in the rule.
- **S4.** Two §6 rows stay open: tab titles are always "… · Our wedding planner", while guide §4.31 has them follow the names in settings (G1; also no `appleWebApp` or description in the new layout); and a record's file tiles (`FileTiles` without `onOpen`) open the file in a new tab, so a record's file can be deleted for good only from Files (§4.20 has the details sheet). If either needs a design decision, it's a gap.

Tests and raw sizes (8.F2):
- **S5.** `stories-files.spec.ts:92-125` (R11) says "delete" but presses Keep it, and checks the stored file at once; no spec confirms a Delete for good. Add one with the delete route stubbed (`page.route`), polling until the record is gone. P7-S15's `filesHeld` wiring (`booking-screen.tsx:272`, `:427`) has no test. `betweenBatches` (`master-list.ts:213`) is never used by a test: add the move-between-parts race P7-S8 named.
- **S6.** Weak assertions in the story specs: `stories-guests.spec.ts:103-111` (`toContainText("7")` matches 17; a bare `p` reading "2"), `stories-partner.spec.ts:136` (`main ul`), `stories-bookings.spec.ts:281` (a bare `ul`), `stories-items.spec.ts:114-121` (markup-bound "2of 5"). Use anchored text and roles. `stories-partner.spec.ts:105` (A4) checks sideways scroll before the content loads.
- **S7.** 8.3b added about 20 raw pixel sizes (`counts.module.css`, `items.module.css`, `sign-in.module.css`, `settings.module.css:32`, `not-here.module.css:8-21`, `schedule-screen.module.css:10`). The style check only catches colours. Compose each from tokens (as `rows.module.css` does) or take the nearest; any that need a new token become a gap.

Dropped (reasons in `triage.md`): the old-UI demo spec and helpers (kept until 9.2), the offline "You're offline" for a venue the partner removed, e2e guards for 8.4's visual fixes (the axe mode covers them).

## Checked and fine (summary)

- **7.F1:** P7-S8 (renumber races; version bumps on moves), S9, S10 and S11 fixed with tests that fail on the old code; S6 and S7 fixed for the named cases (S1 and B1 above). A renumber that stops after raising `nextSortOrder` leaves the order consistent.
- **7.F2:** P7-S12 and S13 fixed (holds let go in a passive effect after the failure's layout effect); S14's sheet has a body now and the reconnect window is fixed; S16 for Back (B2 for Done); S17 except the payment sheet (S9); S18 done. The new holds release on success.
- **8.1a and 8.1b:** all 87 §5.2 stories have a behaviour test on the new UI, the 53 named in the commits plus earlier specs for the other 34; no fixed waits; roles and labels throughout; A2 uses two browser contexts. R13 is covered by unit tests and the file sheet, not an end-to-end delete (S5). O4 and S7 are covered lightly (links, not clicks).
- **8.2's script** can't reach production: the emulator build has a `demo-` project and fake keys, the demo build empties the Firebase variables (which `.env.local` can't override), and it stops only its own process groups by PID.
- **8.3:** P3-S10 done (the agenda uses the shared `Btn` and `TextLink`); no new media queries; no behaviour hidden in the visual fixes.
- **8.4:** P3-S8, P3-S12 and P4-S19 fixed with tests of the new behaviour; the finalist fade, chip targets, field link padding and `dir="auto"` are right.
- **8.5 and 8.6:** `CLAUDE.md`'s paths, scripts, routes and claims match the code; every owner step from the earlier reviews and the device checklist is in `before-merge.md`, in a safe order.

## Coverage

- **§5.2:** every story was already ticked and has its test (above).
- **§6:** 37 rows ticked after checking them against the code, one marked n/a (the old budget and checklist pages are gone); two stay open for 8.F1 (S4). §9.1 G8 and G10 said "build open" but are built (now recorded); G1 is built except S4's tab titles.
- **§5.1:** not ticked. A pixel score can't say a pair looks right, and many differences are data. The owner accepts the pairs (`before-merge.md`, section 1), then a redesign session ticks the rows.
- **§10:** nothing new can be ticked: each line still waits on the owner's acceptance, the device checklist, the gaps, or Phase 9.

## Waiting for the owner

Already in `before-merge.md`, section 1: accept the screenshot pairs (`tests/screenshots/report/report.md`), and run the device checklist on an installed iPhone, Android Chrome and a Mac. Phase 8's "Done when" closes with those two.
