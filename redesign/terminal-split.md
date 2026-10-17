# Terminal split: building the rebuild in parallel

An optional way to run the Step 7 rebuild (`redesign/ui-implementation-plan.md` §7) in several terminals at once: three for Phases 2, 3 and 8, four for Phases 4 and 5 (added 2026-10-16, because Phase 4 is the longest phase). Each terminal works through its own queue of tasks: it finishes a task, merges it into `redesign`, then starts its next task. Every other rule in §7.0 still applies: one task per session, the model check for each task, and the Done ticks.

- **Each terminal goes down its own column** at its own pace, one task per session.
- **🛑 rows stop everything.** At each phase review, all terminals wait until it passes. Don't start a later phase's tasks before then. A "wait" cell means that terminal waits for the task named in it.
- **Set the model and effort shown in the cell** before each task (`/model`, `/effort`). They come from the §7.0 table. If §7.0 changes a pick (escalation, de-escalation, the 4.9 calibration result), update the cell here too.
- **Tick the box here as well** when a task is done: `[ ]` becomes `[x]`, in the same commit as the §7.0 and task-heading ticks in the implementation plan.
- **One e2e run at a time.** `npm run test:e2e` waits while another copy of the repo runs it (see Setup, step 3). Run e2e only through that script, never `npx playwright test` directly.
- **The studio is separate.** It runs in its own window with `./start` in `../wedding-planning-studio`, as always.
- **Fewer terminals also work:** with three, put Terminal 4's column after Terminal 2's; with two, spread Terminal 3's column across the other two as well.

## Setup (t1–t3 done 2026-10-14, t4 done 2026-10-16)

1. **A separate copy of the repo per terminal.** Four git worktrees, each with its own `node_modules` and a copy of `.env.local`. The main folder stays on `redesign` and is only for merging. To add a lane later: `git worktree add ../wedding-planning-lanes/t5 -b lane/t5 redesign`, then `npm ci`, copy `.env.local`, write an unused offset into `.test-port-offset`, and add a `t5` line to `~/.zshrc`. Keep lanes inside `../wedding-planning-lanes/`: the studio's settings block that folder, and a copy anywhere else would be readable from the studio.

   | Terminal | Folder | Branch | Test port offset | Opens with |
   |---|---|---|---|---|
   | 1 | `../wedding-planning-lanes/t1` | `lane/t1` | 10 | `t1` |
   | 2 | `../wedding-planning-lanes/t2` | `lane/t2` | 20 | `t2` |
   | 3 | `../wedding-planning-lanes/t3` | `lane/t3` | 30 | `t3` |
   | 4 | `../wedding-planning-lanes/t4` | `lane/t4` | 40 | `t4` |

2. **Different test ports per copy.** Each lane's git-ignored `.test-port-offset` moves every test port by that much (e2e servers 3100/3101, Auth 9099, Firestore 8080 and its websocket 9150, emulator hub 4400 and logging 4500). The main folder has no file and uses 0. `TEST_PORT_OFFSET=n` overrides it for one run. A dev server for looking at a screen takes the same idea: `npm run dev -- -p 30N0` (3010, 3020, 3030, 3040), so two lanes' servers don't fight over 3000.
3. **One e2e run at a time.** An e2e run starts two Next dev servers, the Firebase emulators and a browser; on this Mac (8 cores, 8 GB) more than one at once makes tests time out at random. `npm run test:e2e` (`scripts/test-e2e.mjs`) holds a lock in the shared `.git` folder: a second copy prints "waiting for t2's e2e run" and starts when the first ends, and a lock left by a run that died is taken over. `E2E_LOCK=0` skips it. `npm test` and `npm run test:emulator` don't take the lock and can run in every lane at once. Arguments pass through to Playwright, so a task can run just its own spec files: `npm run test:e2e -- tests/e2e/demo/<spec>.spec.ts`.
4. **The `CLAUDE.md` rule** for lane branches is in, with the merge steps below. Lane branches stay local, so they don't make Vercel previews.
5. **Merge one task at a time.** Expect small conflicts in the shared bookkeeping: the `AGENTS.md` change log, the ticks in `ui-implementation-plan.md` (§5, §6, §7.0, §10), the ticks in this file and the gallery index.

## Every lane, every task: the same commands

Replace `N` with the terminal's number (1 to 4).

1. **Open the terminal:** `tN` in a new window (for example `t4`). It goes to `../wedding-planning-lanes/tN`, names the window "Lane tN", prints the branch and last commit, and starts Claude Code. `tN --continue` resumes the last chat there.
2. **Bring the lane up to date** before the task: `git merge --ff-only redesign` (or `git merge redesign` if the lane has local commits).
3. **Set the model and effort** from the task's cell below: `/model`, `/effort`.
4. **Start the task:** "Do Task 4.17 from `redesign/ui-implementation-plan.md`" (the session reads only that task's plan section, design-guide section and prototype file, as §7.0 says).
5. **Commit locally** in the lane. Don't push lane branches.
6. **Deliver it to `redesign`:** `git merge redesign`, fix any bookkeeping conflicts, rerun the checks, then `git -C ../../wedding-planning merge --ff-only lane/tN` and `git -C ../../wedding-planning push origin redesign`. If the fast-forward fails, another lane merged first: merge `redesign` again and retry.
7. **Tick it:** §7.0 and the task heading in the implementation plan, its box here, and its §5, §6 and §10 rows, in the lane before step 6 so the ticks arrive with the work. Logging the real `/cost` is optional: add it when you have it, and never hold a tick or a merge for it.

## Terminal 4's first job: the calibration trial

§7.0 says to build Task 4.9 twice from the same starting commit. Terminal 1 builds it with Sonnet 5.5 High from `19befeb`; Terminal 4 builds the second one at the same time with Haiku 5.5 Max, from `3f47f9f`, which has the same app code as `19befeb` plus this file's four-lane split and the e2e lock:

1. `t4`, then `git switch -c trial/4.9-haiku 3f47f9f`. This branch is thrown away: never merge it into `redesign` and never push it.
2. `/model` Haiku 5.5 Max. "Do Task 4.9 from `redesign/ui-implementation-plan.md` as the calibration trial's second build. Don't tick anything, don't merge, and don't push." Commit on the trial branch. Noting the real `/cost` is optional.
3. `git switch lane/t4`. The trial is done; the comparison waits for Terminal 1's 4.9 to be in `redesign`.
4. **Calibration result** (its own session in t4, Sonnet 5.5 High, once Terminal 1's 4.9 is in `redesign`): `git merge --ff-only redesign`, then compare both builds against `redesign/design/prototype/funders.html` in every state at 1440px and 390px (`git switch trial/4.9-haiku` and `npm run dev -- -p 3040` for one, `git switch lane/t4` for the other). Terminal 1's build stays in `redesign` either way, since later tasks build on it; the trial only decides the model. If Haiku's build is as good, move the single-screen Sonnet tasks that only display model data down to Haiku 5.5 Max and log it under §7.0, as the plan says. Decide on quality: if Haiku's build is as good, Haiku wins, since its row costs less. Either way, write the result in the §7.0 "Calibration trial" row (with the real costs only if both are known), tick it, and set the model in every ★ cell here. Deliver the ticks like any task (step 6 above), then `git branch -D trial/4.9-haiku`.

The ★ tasks wait for step 4.

## The split

`(L)` means a large task, about two sessions. Tasks marked ★ only display data: hold them until the 4.9 calibration result is in, and use the model it decides.

Phase 4 keeps each terminal on one part of the app, so two lanes rarely touch the same files: Terminal 1 budget, Terminal 2 vendors, venues and settings, Terminal 3 schedule, items and guests, Terminal 4 documents and files. The follow-up for needs N13–N18 is early in Terminal 2 because it changes shared parts (sheets, confirms, fields, the top bar) that later screens use.

| Terminal 1 | Terminal 2 | Terminal 3 | Terminal 4 |
|---|---|---|---|
| **Phase 2: shell** | | | |
| [x] 2.3 Auth and providers · Opus 5.5 Medium | [x] 2.1 Tokens · Haiku 5.5 Max | [x] 6.3 Delete for good · Opus 5.5 High | — |
| [x] 2.6 Sheets and toasts · Sonnet 5.5 High | [x] 2.2 Icons · Haiku 5.5 xHigh | [x] 6.1 Service worker (after 2.3) · Opus 5.5 High | — |
| [x] 2.7 Partner changes · Sonnet 5.5 High | [x] 2.4 Top bar · Haiku 5.5 Max | [x] 6.7 Old-names check · Haiku 5.5 Max | — |
| — | [x] 2.5 Screen states · Haiku 5.5 Max | — | — |
| 🛑 [x] Phase 2 review · Opus 5.5 Medium | wait | wait | — |
| **Phase 3: components** | | | |
| [x] 3.0 Gallery · Haiku 5.5 xHigh | wait for 3.0 | wait for 3.0 | — |
| [x] 3.4 Fields · Sonnet 5.5 High | [x] 3.3 Buttons · Haiku 5.5 Max | [x] 3.11 Agenda and month · Sonnet 5.5 High | — |
| [x] 3.10 Uploads (after 3.3) · Sonnet 5.5 High | [x] 3.1 Hero · Haiku 5.5 Max | [x] 3.6 Parts · Haiku 5.5 Max | — |
| [x] 3.12 Task, item and guest rows (after 3.3) · Sonnet 5.5 High | [x] 3.2 Next card · Haiku 5.5 Max | [x] 3.7 Search and filters · Haiku 5.5 Max | — |
| — | [x] 3.5 Ledger rows (L) · Haiku 5.5 Max | [x] 3.8 Sheet patterns (after 3.3) · Haiku 5.5 Max | — |
| — | — | [x] 3.9 Stage thread, heart, WhatsApp · Haiku 5.5 Max | — |
| 🛑 [x] Phase 3 review · Opus 5.5 Medium | wait | wait | — |
| **Phase 4: screens** | | | |
| [x] Before 4.1 and 4.2: Phase 2 review S5 and S6, the top bar outside `main` and a page column (see `redesign/reviews/phase-3-review.md`) · Sonnet 5.5 High (done 2026-10-16, lane t1, on Opus 5.5) | | | |
| [x] 4.9 Who pays · Sonnet 5.5 High | [x] 4.11 Vendors · Sonnet 5.5 High | [x] 4.1 Sign in · Sonnet 5.5 High | [x] 4.9 second build, calibration trial, on `trial/4.9-haiku` from `3f47f9f` (see above) · Haiku 5.5 Max |
| [x] 4.4 Record a payment · Sonnet 5.5 High | [x] Follow-up: N13 and N14 in 2.6 and 3.8 (2026-10-17, lane t2) · Sonnet 5.5 High<br>[x] Follow-up: N3 in 2.7, N15 in 2.4, N16 in 3.4, N17 in 3.10, N18 in 3.8 (2026-10-17, lane t2) · Sonnet 5.5 High | [x] 4.2 Overview · Sonnet 5.5 High | [x] 4.17 Editor core (L) · Opus 5.5 High |
| [x] 4.3 Budget ★ · Haiku 5.5 Max | [ ] 4.12 A vendor · Sonnet 5.5 High | [x] 4.20 Schedule · Sonnet 5.5 High | [ ] 4.9 calibration result (after Terminal 1's 4.9 is in `redesign`; see above) · Sonnet 5.5 High |
| [ ] 4.5 Bookings ★ · Haiku 5.5 Max | [ ] 4.13 Shortlist ★ · Haiku 5.5 Max | [ ] 4.21 Month ★ · Haiku 5.5 Max | [ ] 4.18 Tables and formulas (L, after 4.17) · Opus 5.5 Medium |
| [ ] 4.6 A booking (L) · Sonnet 5.5 High | [ ] 4.14 A finalist · Sonnet 5.5 High | [ ] 4.22 Tasks · Sonnet 5.5 High | [ ] 4.16 Documents ★ · Haiku 5.5 Max |
| [ ] 4.7 Add a booking · Haiku 5.5 Max | [ ] 4.15 Venues · Sonnet 5.5 High | [ ] 4.23 Wedding items (L) · Sonnet 5.5 High | [ ] 4.19 Files (L) · Sonnet 5.5 High |
| [ ] 4.8 Payments due ★ · Haiku 5.5 Max | [x] 6.6 Vendor CSV columns (N5) · Haiku 5.5 xHigh (done inside 4.11) | [ ] 4.24 Guests · Sonnet 5.5 High | — |
| [ ] 4.10 What-if · Sonnet 5.5 High | [ ] 4.25 Settings · Sonnet 5.5 High | — | — |
| 🛑 [ ] Phase 4 review · Opus 5.5 Medium | wait | wait | wait |
| **Phase 5: states** | | | |
| [ ] 5.1 State harness · Sonnet 5.5 High | wait for 5.1 | wait for 5.1 | wait for 5.1 |
| [ ] 5.2 Budget states (L) · Haiku 5.5 Max | [ ] 5.3 Vendors states · Haiku 5.5 Max | [ ] 5.5 Schedule states · Haiku 5.5 Max | [ ] 5.4 Documents and files states · Sonnet 5.5 High |
| — | [ ] 5.7 Overview, sign-in, settings states · Haiku 5.5 Max | [ ] 5.6 Items and guests states · Haiku 5.5 Max | — |
| 🛑 [ ] Phase 5 review · Opus 5.5 Medium | wait | wait | wait |
| 🛑 [ ] Phase 6 review · Opus 5.5 Medium | wait | wait | wait |
| **Phase 7: switch-over (one terminal only)** | | | |
| [ ] 7.1 Switch-over commit · Opus 5.5 High | off | off | off |
| [ ] 7.2 Rollback rehearsal · Sonnet 5.5 High | off | off | off |
| [ ] 7.3 Delete old code · Sonnet 5.5 High | off | off | off |
| 🛑 [ ] Phase 7 review · Opus 5.5 High | off | off | off |
| **Phase 8: QA** | | | |
| [ ] 8.1 Behaviour tests (L) · Sonnet 5.5 High | [ ] 8.2 Screenshots · Sonnet 5.5 High | [ ] 8.4 Accessibility · Sonnet 5.5 High | off |
| — | [ ] 8.3 Fixes: budget and vendors (after 8.2) · Haiku 5.5 Max | [ ] 8.3 Fixes: schedule, items and guests (after 8.2) · Haiku 5.5 Max | off |
| — | [ ] 8.3 Fixes: documents and files · Haiku 5.5 Max | [ ] 8.3 Fixes: shell, overview, sign-in, settings · Haiku 5.5 Max | off |
| — | — | [ ] 8.5 Device checklist · Haiku 5.5 xHigh | off |
| — | — | [ ] 8.6 Merge preparation · Haiku 5.5 Max | off |
| 🛑 [ ] Phase 8 review · Opus 5.5 Medium | wait | wait | off |
| **Phase 9: after launch (one terminal only)** | | | |
| [ ] 9.1 After-launch check · Sonnet 5.5 High | off | off | off |
| [ ] 9.2 Remove the old UI · Sonnet 5.5 High | off | off | off |
| 🛑 [ ] Phase 9 review · Opus 5.5 Medium | off | off | off |

## Design gaps N1–N18: designed 2026-10-16

Done on 2026-10-16: one studio round designed N1–N18 (design-guide v1.1 and v1.2), and the import brought them into `redesign/design/`. The studio round for needs N1–N14 (see `redesign/handoff/needs.md`) was put off until then. It runs in the studio window, not in a terminal lane, so it doesn't hold up any column. Do it **before Phase 4 starts** at the latest: 4.23 waits for N12 entirely, and Phase 4 screens use N4 and N7–N11.

Until it's done, tasks that touch a need build everything else and leave that part out (the §9.1 rule). Phases 2 and 3 have these parts, which get a follow-up after the import:
- ~~2.6 and 3.8 leave out what Undo says when it can't undo (N13), and 2.6 leaves out what a confirm says when its write fails (N14);~~ done 2026-10-17 in lane t2;
- ~~2.7 names the partner with the second name in settings (N3);~~ done 2026-10-17 in lane t2;
- ~~3.4's money field puts the old amount back for text that isn't an amount, without a message (N16);~~ done 2026-10-17;
- ~~3.10 words a PDF that is still too big after shrinking with a provisional line (N17);~~ done 2026-10-17;
- ~~2.4 sets the couple's names in the top bar at 21px on a phone, not 24px (N15);~~ done 2026-10-17;
- ~~3.8's Done, Escape and scrim rules while a change is unsaved are provisional (N18).~~ done 2026-10-17.

| Task | Waits for | Model |
|---|---|---|
| [x] Studio window: design N1–N14 (done 2026-10-16, with N15–N18 in the same round; guide v1.2) (the owner runs it: `BASE_BRANCH=redesign redesign/studio.sh enter` after the banned-word scan, then `./start` and "Design the open needs in needs.md", then "I approve the design guide. Freeze it.") | nothing; before Phase 4 | Opus 5.5 High, since N1 and N2 add new screens |
| [x] Import the needs' design (done 2026-10-16, commit 4682a5c) (main folder, "Import the approved design", with `BASE_BRANCH=redesign`) | the studio freezing the designs | Haiku 5.5 High |
| Follow-up: ~~N13 and N14 in 2.6 and 3.8 (done 2026-10-17)~~, ~~N3 in 2.7, N15 in 2.4, N16 in 3.4, N17 in 3.10, N18 in 3.8 (done 2026-10-17)~~ (skip if those were built after the import). Now in Terminal 2's Phase 4 column; tick it there | the import | Sonnet 5.5 High |

## Any free terminal, once the needs are designed

These wait for the import above. Whichever terminal is free first takes the next one, during Phase 4 or 5, before the Phase 6 review. 6.6 is now in Terminal 2's column, beside the vendors screens.

| Task | Waits for | Model |
|---|---|---|
| [ ] 6.2 Push reminders | N11 | Opus 5.5 High |
| [ ] 6.4 Manifest, icons, install | N1 | Haiku 5.5 Max |
| [ ] 6.5 Not found and error screens | N2 | Haiku 5.5 Max |
