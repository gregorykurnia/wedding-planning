# Phase 5 review

**Date:** 2026-10-19 · **Model:** Opus 5.5 Medium (the §7.0 pick) · **Diff:** `feed090..650a7d1` on `redesign` (fix tasks 4.F1–4.F5 and Tasks 5.1–5.7), reviewed in lane t1.
**Result: passed after fixes.** The first pass found four blockers, all fixed in this session (`1465111`):
- with the database out of reach on a page load, the app asked for the couple's names and could later write wrong ones over the real ones (5.7; older, from the N3 follow-up)
- Try again on a remove whose first try timed out but landed lost the Undo; P1-S2 was fixed only on a path the screens never take (4.F1)
- a payment could be counted twice when the partner split the booking before Try again (4.F1, from P4-S3's fix)
- a read that failed before its first answer showed an empty list instead of "didn't load" (5.5, 5.6)

Five parallel reviewers each read one area against `ui-implementation-plan.md`, the design guide and the prototype's `?state=` lists:
- money and bookings (4.F1, 5.2)
- documents, files and uploads (4.F2, 5.4)
- vendors, rules and scripts (4.F3, 5.3)
- schedule, items and guests (4.F4, 5.5, 5.6)
- shared parts, the state harness, overview, sign-in and settings (4.F5, 5.1, 5.7)

Each blocker was checked by reading the code path, then by a test that fails without its fix.

## Verification run

| Check | Before fixes | After fixes |
|---|---|---|
| `npx tsc --noEmit` | clean | clean |
| `npm run lint` | the 8 old errors only (`public/pdf.worker.min.mjs`, legacy settings page) | same |
| Style check, old-names check | pass | pass |
| `npm test` (model) | 85 files, 1279 pass | 1280 pass (1 new) |
| `npm run test:emulator` | 346 pass, 1 skipped | 352 pass, 1 skipped (6 new; all 4 new blocker tests fail without the fixes) |
| `npm run build` | passes | not rebuilt (no config or route change) |
| `npm run test:e2e` (full, after fixes) | — | 2026-10-22: 576 of 577 pass in 7 passes (64 min); the one failure (`veil-settings` push test) passed alone after its fix. See "Full e2e run" |

## Full e2e run (2026-10-22)

- **First try, stopped after 46 minutes:** the Firestore emulator ran out of its 1 GB heap after about 180 emulator tests (`OutOfMemoryError` in `firestore-debug.log`), and every later test hung until its timeout (181 passed, 9 failed, 381 didn't run). The heap fills with what the emulator keeps queued for closed pages' live-update connections, the same cause as S29 and the stress flood. **Fixed:** `scripts/test-e2e.mjs` now runs a full run as a demo pass, then the emulator specs in parts of about 80 tests (`E2E_CHUNK_TESTS`), each on fresh servers with its own `--output`, then the stress pass. A pass whose log reports `OutOfMemoryError` is stopped instead of hanging.
- **Second run, 7 passes:** demo 249, emulator 74 + 78 of 79 + 77 + 78 + 14, stress 6. So 576 of 577 pass, with no flood (log 18 KB) and no servers left running.
- **Two tests that depend on where and when they run** (not load, and not app bugs):
  - `veil-documents.spec.ts` "three newest as cards" failed before 05:00, because "2 hours ago" is yesterday then and the card says "Edited yesterday". It now takes the label it expects from `editedText`. It passed in the second run at about 02:30.
  - `veil-settings.spec.ts` push test expected the device to be saved as "Mac", but Chromium on the Linux server is named "Browser". It now runs with a Mac user agent and passed alone.

## Blockers (all fixed)

**B1. Database out of reach on a page load: the names question, and wrong names later** (Task 5.7 found it; `src/lib/collections/settings.ts`, `accounts.ts`, `src/lib/data/who.ts`).
- **Cause:** the client keeps no cache between loads, so offline the first answer for `settings/wedding` and `settings/accounts` is a cached "no document". Both hooks took it as real: `useWho` was ready with no names and no pairing, and `AskWho` replaced every screen with the first sign-in's names question.
- **Scenario:** Bella opens the planner on a weak connection and types "Bella" / "Greg". `startNames` queues the write, times out ("That wasn't saved"), and the write lands when the connection returns: the names are swapped while the pairing still says Greg holds the first name. The overview's "When is the wedding?" and empty settings fields came from the same answer.
- **Fix:** both listeners ignore a cached missing document and keep loading (metadata changes on, so a missing document the server confirms still arrives). `startNames` is one transaction that reads the names first: it fails offline instead of queueing, refuses (`changed`) to write over names already set, and writes the names and the pairing together.
- **Tests:** three emulator tests in `settings.test.ts`; Task 5.7's four `fixme` specs (loading and offline before data, overview and settings) now run and pass.

**B2. Try again on a timed-out remove loses the Undo** (Task 4.F1, P1-S2; `src/lib/data/write.ts`).
- **Cause:** 4.F1 made `WriteError.retry()` wait for the late first try, but no screen calls `retry()`: every confirm's Try again runs the whole operation again.
- **Scenario:** a booking's removal times out but lands; Try again finds it gone and says "It isn't there any more… perhaps on another device", with no Undo. A part's removal "succeeded" with no Undo (`removeElement` returned null).
- **Fix:** `guarded()` takes an optional key. A timed-out attempt stays under it for two minutes, and the next write with the same key takes its result (or runs again if it failed). `removeWithUndo` and `removeElement` pass one.
- **Tests:** two emulator tests in `write.test.ts`.

**B3. A payment counted twice after the partner's split** (Task 4.F1, P4-S3; `recordPayment` in `src/lib/data/bookings.ts`).
- **Scenario:** a payment's try lands but reports a failure; Bella splits the booking, which moves it into the Deposit; Try again re-picks the Balance (P4-S3's fix) and appended the same payment id there.
- **Fix:** a payment id already stored anywhere on the booking is updated where it is.
- **Tests:** an emulator test in `money-fixes.test.ts`.

**B4. A read that failed before its first answer looks empty** (Tasks 5.5, 5.6; `src/lib/data/read.ts`, `use-collection.ts`).
- **Cause:** `readOf` kept `useCollection`'s initial `[]` on an error, so `ScreenState` showed "No guests yet", "No tasks yet" and so on (guide §6.5: never looks empty), and Items offered to start with the common items. `?fault=load` hid it, since it fails before `readOf` looks at the sources.
- **Fix:** `useCollection` reports `arrived`; `readOf` gives no data on an error before it.
- **Tests:** a model test in `read.test.ts`.

## Should fix (open)

Money and bookings:
- **S1.** A late first try can overwrite the corrected amount (side effect of P4-S2's same-id replace): if try A is still retrying when try B commits, A commits later with its own amount. The toast said B. Replace only when the incoming try is newer.
- **S2.** Remove funder's confirm counts what-if items from `useWhatIf()`, which is 0 while that read loads or has failed (`who-pays.tsx:72`).
- **S3.** The split's undo-conflict sentence is generic ("…has changed a part since"); the prototype's says what changed ("Bella recorded Rp 5.000.000 on the balance since. Both parts stay as they are now.").
- **S4.** Splitting an overpaid booking puts everything on the Deposit, which then reads overpaid; the prototype caps the Deposit at the price and puts the extra on a Rp 0 Balance (`money.ts:275`, older code).
- **S5.** §5.1 is missing states the prototype has: Budget `sync-self`, `eve`, `day`, `after`; A booking `removefail`, `badamount`, `undo-conflict`, `sync-self`; Add a booking `badamount`; A document `leave-failed`; Files `undo-conflict`, `removefail`; every screen `crash`. They are built (shared parts); the rows are missing, so the screenshots would skip them.

Documents and files:
- **S6.** `deleteFolder` (`files.ts:275-279`): if the second "holds anything" check fails after the delete committed, the confirm says nothing was deleted and offers no Undo; when the race path restores the folder, the confirm gives the database-unreachable reason.
- **S7.** `useCollection`'s offline hold makes `readOf` return no data for screens with several sources (Vendors, Files, Venues, Shortlist, A booking) when one secondary list is held, even if the main list is cached. Mid-session only.
- **S8.** `canonical()` (`doc-editor.tsx:45-50`) skips `.check()`, so a partner's update that breaks a content rule reaches `setContent` with the content check on and the screen crashes. Also, the content check now refuses some documents that used to open (see 7.1 below).
- **S9.** Undo of a file moved back into a deleted folder refuses with `missing`, but the toast treats it as a generic failure: no words, and Undo looks live.
- **S10.** `createFolder` and the upload save don't check the folder still exists; things land at the top (nothing lost).
- **S11.** Add a booking, failed then given up: the `Bookings › <name>` folder stays, pointing at no booking; a name edited before Try again keeps the old folder name.

Vendors and rules:
- **S12.** Whole-screen nouns: "The vendors / the shortlist / the venues / the bookings / the payments due didn't load", where the prototype says "Your vendors…" (and "Payments due"). `veil-vendor-states.spec.ts` asserts the wrong words.
- **S13.** `pushSubscriptions` update rule: on a shared browser whose old subscription belongs to the other account (an old-UI sign-out never forgets the device), Send a test reminder is denied. Allow the update when the endpoint is unchanged.
- **S14.** `presence` create isn't tied to the document id: one account can create the other's `presence/<doc>_<uid>` and lock them out of it. Require the id to be `documentId + '_' + auth.uid`.
- **S15.** P4-S12 is tested only on `InlineRename`'s prop; nothing fails if the categories sheet stops passing 40.

Schedule, items and guests:
- **S16.** A save that fails offline says "Couldn't save…" everywhere but documents; guide §6.5 has "Not saved: you're offline. Keep this page open." (items, guests, tasks, events, the overview's date, the names screen).
- **S17.** Tasks "Everything done" opens the finished tasks only after a reload (`FinishedTasks` reads `defaultOpen` once); the spec reloads, so it can't catch it.
- **S18.** Adding below a row while a move is pending can tie two positions (`items-screen.tsx` passes the shown order, not the stored one, to `addItems`).
- **S19.** An item's text edited twice: the first landing lets go of the held name while the second is still saving; if that one fails and the row unmounts, P4-S23's loss is back. Guests already count taps per key.
- **S20.** A retried guest add writes the whole form over the stored guest, dropping a partner's edit made between the landed first try and Try again (`guest-meta.ts:24`).
- **S21.** Ordering, order only: the renumber above 490 items has no version check before its last write; the old UI's delete and restore don't bump the list version. P4-S21 has no screen-level test of three quick Alt+arrow presses.

Shared parts, harness, overview, sign-in, settings:
- **S22.** The fault switch ships in production, off: `NEXT_PUBLIC_VEIL_DEV` unset at build is left as a runtime read of the `process` polyfill. Set it to "0" in `next.config.ts` so the code is dropped.
- **S23.** The harness can't reach two §5.1 rows on most screens: cold offline (`?fault=offline` leaves `navigator.onLine` true, so data loads) and a held loading. The seed script's `loadFixture` follows `FIREBASE_PROJECT_ID` from the shell while `seed()` clears `demo-wedding-planning`.
- **S24.** 4.F5's P3-S6, P3-S5 and P2-S1 are tested only in the model; removing the wiring keeps every test green. The `google-failed` sign-in state has no spec.
- **S25.** Settings "A change didn't save" says "Couldn't save this change…", the settings row of the guide and `settings.html` say "Couldn't save. What you typed is kept.", and the guide contradicts itself elsewhere. A design question.
- **S26.** After a long offline spell the partner news can raise up to 50 toasts at once; merge them.
- **S27.** Specs that count every vendor (`veil-bookings`, `veil-budget`) give a confusing total mismatch when an earlier spec leaves a vendor behind, as `confirmed.spec.ts` did (fixed in `fe278df`). Check at their start that no other spec's vendors are left, and stop with a message naming them.
- **S28.** Recheck whether Phase 4's 18 full-run failures that passed alone (put down to timeouts in `phase-4-review.md`) were the same leftover booking, and correct that review if so.
- **S29.** A test leaves a live-update connection unread: from about five minutes into the 2026-10-20 full run, the Firestore emulator logged 7.3 million "too many pending messagings" warnings (3.7 GB in `firestore-debug.log`) and grew in memory. `scripts/test-e2e.mjs` now stops a run once the log passes 200 MB. **Fixed (2026-10-21):** 17 emulator specs opened the partner's page (or a page at another size) with `browser.newContext()` and never closed it, so every one stayed signed in and listening for the rest of the run; the flood began during `veil-document-stress`'s setup, which writes about 4,600 records one by one. Each of those specs now runs `test.afterEach(closeOtherContexts)` (`tests/e2e/helpers.ts`).

Small, dropped: `readAmount("-0")` is 0 while `amountProblem("-0")` says minus (the field refuses it; nothing is lost).

## Notes
- The 4.F3 commit body says the rules weren't deployed; the §7.0 row says the owner deployed them on 2026-10-19. The §7.0 row is the later record.
- Tasks 5.2–5.7 took no screenshots at 390px and 1440px; that is Task 8.2's job, and S5 and S23 must be done first so it can reach every row.
- The stress set was taken out of the 5.6 spec after a timeout; 5.4's stress spec covers documents and files only.

## Coverage
Each reviewer compared every screen's §5.1 rows with its prototype's `?state=` list and followed each state to the hook status, data case or fault that reaches it. Apart from the items above, all states are built with the prototype's wording. §5.1 boxes are ticked by Task 8.2's screenshots, so this review leaves them.

§6 rows ticked here, each a state, confirm or wording that Phase 5 finished and a reviewer checked: permission-denied → Couldn't load (with B4), delete file, remove part / booking / what-if item, delete task and step, the two undo toasts, inline load and save errors, category validation, guest removal naming plus-ones, the categories sheet, skeletons, empty states, the demo banner, the settings placeholder and the no-wedding-date state. Delete folder stays open for S6, and the offline indicator row for S16 and S23.
