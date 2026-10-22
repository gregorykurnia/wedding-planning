# Phase 7 review

**Date:** 2026-10-22 · **Model:** Opus 5.5 High (the §7.0 pick), unattended `autorun` · **Diff:** `a6889c8..b499bc3` on `redesign`: fix tasks 6.F1 and 6.F2, the 7.1 prep (`ad54d25`), "Switch to the new UI" (`eb94a87`), the 7.1 follow-up (`3441974`), 7.2 (`0428fb9`) and 7.3 (`b499bc3`). Reviewed in the main folder.
**Result: passed** once the four blockers below were fixed in this session (`58cc9ab`, `fd8b8e8`). Six should-fix items (S1–S5, S19) were fixed with them; the rest go to fix tasks 7.F1 and 7.F2 before Phase 8 (`triage.md`, Phase 7).

Four parallel reviewers each read one area against `ui-implementation-plan.md` (Task 7.1–7.3, §9.3) and the Phase 6 review:
- the switch-over and the 7.1 and 7.3 follow-ups (routes, redirects, links, worker, catch-alls)
- the production scripts: `scripts/migrate/checks.ts` and migration `8-old-ui-sync`
- 6.F1 (write races)
- 6.F2 (offline states and wiring tests)

The review session itself checked the one-commit rollback, after 7.3, by simulating the revert (`git merge-tree`), applying it in a throwaway worktree and building the result.

## Verification run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | the 8 old errors only (7 in the vendored `public/pdf.worker.min.mjs`, 1 in the old settings page); changed files clean |
| Style check, old-names check (default, and with 7.3's excludes) | pass (419 files, 53 terms) |
| `npm test` (model) | 1307 → 1309 pass (`rollback.test.ts` and a `who.test.ts` case new) |
| `npm run test:emulator` | the three changed files: items, switch-checks, migrations, 47 pass; the new items and migration 8 tests fail on the old code |
| Rollback | revert of `eb94a87` simulated on `b499bc3`: two rename/delete conflicts (B1). With `scripts/rollback.mjs --apply` in a throwaway worktree: reverted, and `npm run build` passes with the old UI at `/` and the new at `/new` |
| `npm run build` | passes (inside the e2e run's production builds) |
| Full e2e on production builds (`E2E_BUILD=1 npm run test:e2e`) | 600 of 607 pass in 7 passes (demo 263, emulator 73 + 77 + 80 + 80 + 28, stress 6; about 36 min of tests plus three production builds); the 7 failures fixed and their 21 tests passing on rerun (see "Full e2e run") |

## Full e2e run

- One full run after the fixes above, on production builds (`E2E_BUILD=1`, as Vercel serves the app), with nothing else running. Copied `test-results/.last-run.json` right after. The 7 failures had three causes:
  - **7.3 left two old-UI specs behind:** `vendors.spec.ts` "add a vendor, mark it Chosen…" and `venues.spec.ts` "add a venue and mark it Booked" still checked for the Add to budget button 7.3 removed (7.3 ran no e2e). Those checks are gone.
  - **A leftover funder:** four `veil-who-pays.spec.ts` tests (66, 152, 160, 208) failed after `veil-what-if.spec.ts` in the same pass left a funder "Greg". This is the leftover 7.1 noted. Who pays now starts from an empty database, as What-if and Documents do, and restores the pairing after.
  - **A real swap bug (S19 below):** `veil-settings.spec.ts:127` "Swap them" read the stored slots with one account missing.
- Rerun on production builds: `veil-what-if` (to recreate the leftover), all of `veil-who-pays` (its setup changed), and the edited or failed tests `vendors:11`, `venues:10` and `veil-settings:127`. All 21 passed.
- No servers were left on this copy's ports.

## Blockers (fixed in this review)

- **B1. The one-commit way back no longer reverted cleanly** (7.2 rehearsed it before 7.3). `git revert eb94a87` on `redesign` stopped on two rename/delete conflicts: 7.3 deleted the old budget and checklist pages that the revert moves back to the root. Keeping them would fail the build, since they import the collections 7.3 deleted. In an emergency on `main` that's a stall with production down. Fix: `scripts/rollback.mjs`. With no arguments it checks the revert (`git merge-tree`, changing nothing). With `--apply` it makes the revert, keeps files deleted after the switch deleted, and refuses any other conflict or a new-UI page left at the root (which would clash with the old UI after the revert). `tests/model/rollback.test.ts` runs the check on every `npm test` until Phase 9 deletes both. It caught this review's own first try at the sign-in fix below, which edited lines the switch commit had changed. §9.3, `before-merge.md` ("The way back") and Task 9.2 updated.
- **B2. On production builds a query from the first load came back** (`3441974` named the wrong cause and fixed only the symptom). A prerendered page is stored in the client router's cache under its path, but with the address of the first full load, query included; a later link to the bare path reads that entry back. Checked on a production build: after opening `/documents/files?folder=X` and going to Documents, the Files link went back to `?folder=X`. So an upload meant for the top level could land in the folder, and a reminder's `/schedule?event=` sheet reopened when Schedule was picked from the menu within five minutes. Dev servers don't show it. Fix: the nine pages whose screens read a query (`documents/files`, `schedule`, `schedule/month`, `schedule/tasks`, `guests`, `vendors`, `vendors/venues`, `budget/bookings`, `sign-in`) render per request with `await connection()` (the docs' recommended way, `use-search-params.md`). Demo e2e: "a link to Files after opening a folder's address goes to the top level" (`veil-files-screen.spec.ts`), which fails on a production build without the fix.
- **B3. Migration 8 could undo the new UI's own edits in production.** It marked a booking removed whenever the stage wasn't booked, and copied `budgetEstimate` over `agreedPrice`. In the new UI both are deliberate: a stage can change while the booking stays, and the agreed price is kept apart from the estimate. `.env.local` points at production, so one tap in a local preview made such a record, and "before the merge only" was written down, not checked. Fix: a vendor or venue whose `updatedBy` is a person (only the new UI stamps one; the old UI never writes it) is reported, not written. Emulator test "only reports records the new UI has written".
- **B4. The owner's apply command didn't apply.** `npm run migrate 2-guest-numbers … --apply --force` keeps both flags for npm, so the run was another dry run. Fix: `before-merge.md` gives the exact commands with `--`, and runs 8 apart from 2 and 6 (only those two need `--force`). The runner refuses an npm-swallowed `--force` (npm 11 passes that one on) and unknown migration names. The dry run's last line shows the npm form.

## Should fix (fixed in this review)

- **S1. Try again after a timed-out add that landed wiped the row** (`addItems`, from before 6.F1). The blank row appeared, the user typed into it, then Try again on the "couldn't add" note set it again with `item: ""`. Now rows that already exist are kept, and a retry whose rows all landed succeeds even if the anchor moved since. Emulator test "keeps what was typed into a row whose add landed before its Try again" (fails on the old code).
- **S2. A crafted `/sign-in?next=/sign-in` sat on the loading screen.** The Gate now goes to the overview instead. It's in `providers.tsx`, not `safeNext`, whose lines the switch commit changed (B1's test). Demo e2e in `veil-sign-in.spec.ts`.
- **S3. A booking migration 8 removed never came back** if the old UI booked the vendor again before the merge. Its removals are now tagged `removedBy: "8-old-ui-sync"`, and a re-run puts back only those. Emulator test.
- **S4. Unknown migration names were dropped quietly**: a typo ran the rest and reported success. Now refused (part of B4).
- **S19. Swap them could erase the partner's place** (`swappedSlots`, `src/lib/model/who.ts`; found by the full run). The whole `slots` map is written. The partner's uid came only from the members list, so when that list hadn't read the partner yet, the swap wrote this account alone and dropped the partner's stored slot. Now a partner already in the stored slots is kept. Model test "keeps the other account's place when the members list hasn't caught up".
- **S5. No way to undo migration 8 but by hand.** `before-merge.md` now says to save the dry run's output (it holds each old value), to run it last and just before the merge, never `all --force`, and to dry-run 2 and 6 once more after the deploy.

## Should fix (open)

Write races, money and scripts (7.F1):
- **S6.** P6-S8 is only half fixed: an add *then* a move still share a gap (`items-screen.tsx:338-342`, `items.ts`). Rows X, A, B: "add below A", then Alt+↓ on X before the list re-reads; the move's neighbours come from `latest.current`, which lacks the new row, so both get the midpoint of A and B. Also `m.placed` is cleared when the queue goes idle, before the snapshot arrives, and on definite failures (`changed`, `missing`) that wrote nothing. Take the move's lower neighbour from the placed order, keep `placed` until the `[stored]` effect runs, clear it only on `timeout`; consider a random point inside the gap's middle for the two-device case.
- **S7.** P6-S13's fix puts the paid amount on the wrong parts (`bookings.ts:395-406`). Pay 12M on 10M, split, Try again with 1M: Deposit 0 paid while it lists the 1M payment, Balance 1M paid with no payment ("overpaid"). It borrows from the last part backwards, also before the holder, so with an Add-on paid 3M the Add-on drops to 2M and its Undo is then refused (`takeOut`, paid < 0). Take the reduction from other parts' unbacked paid first, forward from the holder, then lower the holder; expect [1M, 0].
- **S8.** Other races during a renumber above 490 items (`master-list.ts:236-241`, from before 6.F1): a concurrent move on a row in a batch not yet written is overwritten back and shown as saved; a concurrent add in a part not yet renumbered lands above its neighbours. Raise `nextSortOrder` before the batches and have moves and adds below a row bump the marker version (as remove does), or skip rows whose `sortOrder` changed since the listing. Also the docstring at `master-list.ts:200` (positions are `start + index` there).
- **S9.** A guest field changed back is lost (`guest-meta.ts:32`, P5-S20's design): country "" → "Indonesia" (times out but lands) → "" and Try again; the diff is against the first try, so nothing is written and "Indonesia" stays while the sheet says saved. Write the fields that differ from the first try or any earlier one.
- **S10.** P6-S9's stale Try again stays on screen and does nothing until the newer try settles (`tries.ts:44-46`). Drop the key's failure when a new try starts.
- **S11.** Script tests miss the risky shapes: `checks.ts` on documents stored as `contentJson` and with node types or marks outside the schema (`image`, `highlight`); migration 8 on `from: "finalist"` marks and booked venues with parts (where it should only report, the price comes from the parts).

Sheets and offline (7.F2):
- **S12.** P6-S14 isn't fixed for confirms (`confirm.tsx:97-102`, `:173-178`). `ConfirmSheet` and `InlineConfirm` set the failure and call `release()` in the same tick, before `<Failure>` has rendered and registered, so the sheet still closes with no word. Offline, remove a guest, press Back: after the timeout it closes on the other screen. Take the hold the way `useBusy` does (an effect on the busy state) and add a wiring test for the confirm path.
- **S13.** The categories sheet's failed add still closes with no word (`categories-sheet.tsx:76-87`): its failure is a `FieldRow` problem, not a rose Banner. Call `useSheetFailure(problem === CATEGORY_ADD_FAILED)`.
- **S14.** Offline, the venue sheet goes blank (a regression from 6.F2's main count of 2, `venues.ts:77`, `venue-sheet.tsx:158-175`): `EditVenueSheet` renders a title and nothing else when `read.data` is null. `useCollection` holds a read whose first answer is empty and from the cache, so a couple with no files at all sees it, and a vendor with an empty shortlist or no files can say "You're offline". Give the sheet an offline or error body; make `useCollection` remember collections already synced this session (or treat a snapshot with `fromCache === false` as arrival). That also fixes the reconnect window, where held reads are marked arrived with `[]` before the server answers.
- **S15.** A booking's files still read as empty offline (`booking-screen.tsx:427`): "None yet" while they're held, and the remove confirm leaves them out. Pass `files.loading` through and leave the heading out while held.
- **S16.** An edit sheet closes on Back during a failing autosave, taking its "Not saved" line and Try again with it (`save-scope.tsx:39`; no field save holds a sheet, though `SheetHolds`' comment says they do). Hold the sheet while a scope save is in flight or failed. If that needs a design decision, it's a gap.
- **S17.** The rest of the offline wording: the categories add, the Items list notes (`addBelowFailed`, `moveFailed`, `COMMON_FAILED`), the Tasks notes (finish, reopen, `STEP_ADD_FAILED`), the Files move sheet (`MOVE_FAILED`) and the add sheets' rose `ADD_FAILED` banners still say "Couldn't…" while offline.
- **S18.** Tests: the P5-S19 wiring test (`veil-items.spec.ts:312`) waits a fixed 500 ms and would pass without `Tries` if the write's acknowledgement came later; hold the assertion with `toPass` over a few seconds. The plain "hold released, no failure, sheet closes" path lost its e2e when S14's test replaced P3-S6's; add one.

Dropped (reasons in `triage.md`): the Shortlist's approximate offline "booked" label, unknown addresses answering the not-found screen with 200, `publicId` grouping in the files check.

## Checked and fine (summary)

- **Redirects** (`next.config.ts`): every old address with no same-named new page (`/login`, `/confirmed`, `/master-list`, `/todo`, `/checklist`, `/notes`, `/venues`, `/shortlist`, `/files`) and `/new`, `/new/:path*` land on their new pages with the query kept; no loops, none shadows a page; temporary (307) on purpose, so a rollback isn't fought by the browser's memory. Client-side navigations follow them.
- **No leftover `/new` addresses** in `src/`, `public/`, the reminders' notification links, the cron and push routes, `sw.js`, the manifest or `safeNext`.
- **The old UI under `/old`:** all 42 navigation sites go through `legacyHref`; the menu fix and its auth gate are right; nothing links to the deleted `/old/budget` and `/old/checklist`.
- **Catch-alls:** `api/[...rest]` doesn't shadow the real API routes; public files and metadata routes win over `[...address]`; the gallery rewrite lands on its own 404 route.
- **Worker and manifest:** scope and `start_url` `/`; it caches only `/_next/static`; notification clicks open same-origin paths.
- **`replaceAddress`:** Next's patched `replaceState` keeps `useSearchParams`, `usePathname` and Back consistent.
- **Production scripts:** dry runs and `checks.ts` only read; every update carries a `lastUpdateTime` precondition; batches of 400; applying needs a backup from the last 24 hours and `--force` for a recorded migration; the documents check uses the editor's own `normaliseDoc` and schema; stage strings match both UIs exactly; marking a booking removed keeps its payments, parts and files; a second run plans nothing.
- **Fix tasks:**
  - 6.F1: P6-S9, S10 and S11 fixed for the cases the review named; S8 half (S6 above); S13 to the letter but with misplaced parts (S7).
  - 6.F2: P6-S16, S17 and S18 fixed; S14 only for sheets with a rose Banner (S12, S13); S15 partly (S14, S15 above).
- **Phase 7's Done when:** the new UI is the default and the old UI answers at `/old`, frozen; the rollback was rehearsed locally (7.2) and now checked again after 7.3, with the reverted tree built; old rendering code the fallback doesn't need is gone; the old-names check passes with only the fallback (and 7.3's three data-layer files) excluded.

## Coverage

Phase 7 has no §5 or §6 rows of its own. §10's rollback line stays open: it also needs the fallback removed after the launch window (Phase 9).

## Owner steps added to `before-merge.md`
- **The way back:** `node scripts/rollback.mjs` says "Check passed" on `redesign` just before the merge.
- **Old-UI drift:** the exact migration commands with `--`, 8 on its own and last, its dry-run output saved, 2 and 6 dry-run again after the deploy.
