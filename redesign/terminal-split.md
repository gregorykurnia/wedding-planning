# Terminal split: building the rebuild in parallel

An optional way to run the Step 7 rebuild (`redesign/ui-implementation-plan.md` §7) in up to three terminals at once. Each terminal works through its own queue of tasks: it finishes a task, merges it into `redesign`, then starts its next task. Every other rule in §7.0 still applies: one task per session, the model check for each task, and the Done ticks.

- **Each terminal goes down its own column** at its own pace, one task per session.
- **🛑 rows stop everything.** At each phase review, all terminals wait until it passes. Don't start a later phase's tasks before then. A "wait" cell means that terminal waits for the task named in it.
- **Set the model and effort shown in the cell** before each task (`/model`, `/effort`). They come from the §7.0 table. If §7.0 changes a pick (escalation, de-escalation, the 4.9 calibration result), update the cell here too.
- **Tick the box here as well** when a task is done: `[ ]` becomes `[x]`, in the same commit as the §7.0 and task-heading ticks in the implementation plan.
- **The studio is separate.** It runs in its own window with `./start` in `../wedding-planning-studio`, as always.
- **Two terminals also work:** spread Terminal 3's column across the other two.

## Setup (done 2026-10-14)

1. **A separate copy of the repo per terminal.** Three git worktrees: `../wedding-planning-lanes/t1`, `t2` and `t3`, on branches `lane/t1`, `lane/t2` and `lane/t3`, each with its own `node_modules` and a copy of `.env.local`. Open each terminal in its folder. The main folder stays on `redesign` and is only for merging. To add a lane later: `git worktree add ../wedding-planning-lanes/t4 -b lane/t4 redesign`, then `npm ci`, copy `.env.local` and write an unused offset into `.test-port-offset`. Keep lanes inside `../wedding-planning-lanes/`: the studio's settings block that folder (refreshed on the next `redesign/studio.sh enter`), and a copy anywhere else would be readable from the studio.
2. **Different test ports per copy.** Each lane's git-ignored `.test-port-offset` (10, 20, 30) moves every test port by that much (e2e servers 3100/3101, Auth 9099, Firestore 8080 and its websocket 9150, emulator hub 4400 and logging 4500). The main folder has no file and uses 0. `TEST_PORT_OFFSET=n` overrides it for one run. All lanes can run `npm test`, `npm run test:emulator` and `npm run test:e2e` at once.
3. **The `CLAUDE.md` rule** for lane branches is in, with the merge steps: `git merge redesign` into the lane, fix conflicts, rerun the checks, then `git -C ../../wedding-planning merge --ff-only lane/tN` and push `redesign`. Lane branches stay local, so they don't make Vercel previews.
4. **Merge one task at a time.** Expect small conflicts in the shared bookkeeping: the `AGENTS.md` change log, the ticks in `ui-implementation-plan.md` (§5, §6, §7.0, §10), the ticks in this file and the gallery index.
5. **Before starting a lane's next task,** bring it up to date: `git merge --ff-only redesign` (or `git merge redesign`).

## The split

`(L)` means a large task, about two sessions. Tasks marked ★ only display data: hold them until the 4.9 calibration result is in, and use the model it decides.

| Terminal 1 | Terminal 2 | Terminal 3 |
|---|---|---|
| **Phase 2: shell** | | |
| [x] 2.3 Auth and providers · Opus 5.5 Medium | [ ] 2.1 Tokens · Haiku 5.5 Max | [ ] 6.3 Delete for good · Opus 5.5 High |
| [ ] 2.6 Sheets and toasts · Sonnet 5.5 High | [ ] 2.2 Icons · Haiku 5.5 xHigh | [ ] 6.1 Service worker (after 2.3) · Opus 5.5 High |
| [ ] 2.7 Partner changes · Sonnet 5.5 High | [ ] 2.4 Top bar · Haiku 5.5 Max | [ ] 6.7 Old-names check · Haiku 5.5 Max |
| — | [ ] 2.5 Screen states · Haiku 5.5 Max | — |
| 🛑 [ ] Phase 2 review · Opus 5.5 Medium | wait | wait |
| **Phase 3: components** | | |
| [ ] 3.0 Gallery · Haiku 5.5 xHigh | wait for 3.0 | wait for 3.0 |
| [ ] 3.4 Fields · Sonnet 5.5 High | [ ] 3.3 Buttons · Haiku 5.5 Max | [ ] 3.11 Agenda and month · Sonnet 5.5 High |
| [ ] 3.10 Uploads (after 3.3) · Sonnet 5.5 High | [ ] 3.1 Hero · Haiku 5.5 Max | [ ] 3.6 Parts · Haiku 5.5 Max |
| [ ] 3.12 Task, item and guest rows (after 3.3) · Sonnet 5.5 High | [ ] 3.2 Next card · Haiku 5.5 Max | [ ] 3.7 Search and filters · Haiku 5.5 Max |
| — | [ ] 3.5 Ledger rows (L) · Haiku 5.5 Max | [ ] 3.8 Sheet patterns (after 3.3) · Haiku 5.5 Max |
| — | — | [ ] 3.9 Stage thread, heart, WhatsApp · Haiku 5.5 Max |
| 🛑 [ ] Phase 3 review · Opus 5.5 Medium | wait | wait |
| **Phase 4: screens** | | |
| [ ] 4.9 Who pays · Sonnet 5.5 High | [ ] 4.11 Vendors · Sonnet 5.5 High | [ ] 4.1 Sign in · Sonnet 5.5 High |
| [ ] 4.9 second build, calibration trial · Haiku 5.5 Max | [ ] 4.12 A vendor · Sonnet 5.5 High | [ ] 4.2 Overview · Sonnet 5.5 High |
| [ ] 4.4 Record a payment · Sonnet 5.5 High | [ ] 4.13 Shortlist ★ · Haiku 5.5 Max | [ ] 4.19 Files (L) · Sonnet 5.5 High |
| [ ] 4.3 Budget ★ · Haiku 5.5 Max | [ ] 4.14 A finalist · Sonnet 5.5 High | [ ] 4.20 Schedule · Sonnet 5.5 High |
| [ ] 4.5 Bookings ★ · Haiku 5.5 Max | [ ] 4.15 Venues · Sonnet 5.5 High | [ ] 4.21 Month ★ · Haiku 5.5 Max |
| [ ] 4.6 A booking (L) · Sonnet 5.5 High | [ ] 4.16 Documents ★ · Haiku 5.5 Max | [ ] 4.22 Tasks · Sonnet 5.5 High |
| [ ] 4.7 Add a booking · Haiku 5.5 Max | [ ] 4.17 Editor core (L) · Opus 5.5 High | [ ] 4.23 Wedding items (L) · Sonnet 5.5 High |
| [ ] 4.8 Payments due ★ · Haiku 5.5 Max | [ ] 4.18 Tables and formulas (L) · Opus 5.5 Medium | [ ] 4.24 Guests · Sonnet 5.5 High |
| [ ] 4.10 What-if · Sonnet 5.5 High | — | [ ] 4.25 Settings · Sonnet 5.5 High |
| 🛑 [ ] Phase 4 review · Opus 5.5 Medium | wait | wait |
| **Phase 5: states** | | |
| [ ] 5.1 State harness · Sonnet 5.5 High | wait for 5.1 | wait for 5.1 |
| [ ] 5.2 Budget states (L) · Haiku 5.5 Max | [ ] 5.3 Vendors states · Haiku 5.5 Max | [ ] 5.5 Schedule states · Haiku 5.5 Max |
| — | [ ] 5.4 Documents and files states · Sonnet 5.5 High | [ ] 5.6 Items and guests states · Haiku 5.5 Max |
| — | — | [ ] 5.7 Overview, sign-in, settings states · Haiku 5.5 Max |
| 🛑 [ ] Phase 5 review · Opus 5.5 Medium | wait | wait |
| 🛑 [ ] Phase 6 review · Opus 5.5 Medium | wait | wait |
| **Phase 7: switch-over (one terminal only)** | | |
| [ ] 7.1 Switch-over commit · Opus 5.5 High | off | off |
| [ ] 7.2 Rollback rehearsal · Sonnet 5.5 High | off | off |
| [ ] 7.3 Delete old code · Sonnet 5.5 High | off | off |
| 🛑 [ ] Phase 7 review · Opus 5.5 High | off | off |
| **Phase 8: QA** | | |
| [ ] 8.1 Behaviour tests (L) · Sonnet 5.5 High | [ ] 8.2 Screenshots · Sonnet 5.5 High | [ ] 8.4 Accessibility · Sonnet 5.5 High |
| — | [ ] 8.3 Fixes: budget and vendors (after 8.2) · Haiku 5.5 Max | [ ] 8.3 Fixes: schedule, items and guests (after 8.2) · Haiku 5.5 Max |
| — | [ ] 8.3 Fixes: documents and files · Haiku 5.5 Max | [ ] 8.3 Fixes: shell, overview, sign-in, settings · Haiku 5.5 Max |
| — | — | [ ] 8.5 Device checklist · Haiku 5.5 xHigh |
| — | — | [ ] 8.6 Merge preparation · Haiku 5.5 Max |
| 🛑 [ ] Phase 8 review · Opus 5.5 Medium | wait | wait |
| **Phase 9: after launch (one terminal only)** | | |
| [ ] 9.1 After-launch check · Sonnet 5.5 High | off | off |
| [ ] 9.2 Remove the old UI · Sonnet 5.5 High | off | off |
| 🛑 [ ] Phase 9 review · Opus 5.5 Medium | off | off |

## Design gaps N1–N13: later, but before Phase 4

The studio round for needs N1–N13 (see `redesign/handoff/needs.md`) is put off until later. It runs in the studio window, not in a terminal lane, so it doesn't hold up any column. Do it **before Phase 4 starts** at the latest: 4.23 waits for N12 entirely, and Phase 4 screens use N4 and N7–N11.

Until it's done, tasks that touch a need build everything else and leave that part out (the §9.1 rule). Phases 2 and 3 have three such parts, which get a follow-up after the import:
- 2.6 and 3.8 leave out what Undo says when it can't undo (N13);
- 2.7 names the partner with the second name in settings (N3).

| Task | Waits for | Model |
|---|---|---|
| [ ] Studio window: design N1–N13 (the owner runs it: `BASE_BRANCH=redesign redesign/studio.sh enter` after the banned-word scan, then `./start` and "Design the open needs in needs.md", then "I approve the design guide. Freeze it.") | nothing; before Phase 4 | Opus 5.5 High, since N1 and N2 add new screens |
| [ ] Import the needs' design (main folder, "Import the approved design", with `BASE_BRANCH=redesign`) | the studio freezing the designs | Haiku 5.5 High |
| [ ] Follow-up: N13 in 2.6 and 3.8, N3 in 2.7 (skip if those were built after the import) | the import | Sonnet 5.5 High |

## Any free terminal, once the needs are designed

These wait for the import above. Whichever terminal is free first takes the next one, during Phase 4 or 5, before the Phase 6 review.

| Task | Waits for | Model |
|---|---|---|
| [ ] 6.2 Push reminders | N11 | Opus 5.5 High |
| [ ] 6.4 Manifest, icons, install | N1 | Haiku 5.5 Max |
| [ ] 6.5 Not found and error screens | N2 | Haiku 5.5 Max |
| [ ] 6.6 Vendor CSV columns | N5 | Haiku 5.5 xHigh |
