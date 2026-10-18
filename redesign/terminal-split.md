# Terminal split: building the rebuild in parallel

How the Step 7 rebuild (`redesign/ui-implementation-plan.md` §7) runs in more than one terminal. Every rule in §7.0 still applies: one task per session, the model check for each task, and the checks in "How every task session runs".

**Two terminals from 2026-10-18.** Phases 2 and 3 and the first half of Phase 4 ran in three or four. On this Mac (8 GB) that filled 13.6 GB of swap and kept the load near 28, so every test, build and session slowed down; one e2e run took five hours. Two lanes finish more per hour than four here. Don't go back above two without more memory.

- **Each terminal goes down its own list** at its own pace, one task per session.
- **🛑 rows stop both.** At each phase review, both terminals wait until it passes. Don't start a later phase's tasks before then.
- **Set the model and effort shown** before each task (`/model`, `/effort`). They come from the §7.0 table; if §7.0 changes a pick, change it here too.
- **Tick the box here too** when a task is done: `[ ]` becomes `[x]`, in the same commit as its §7.0 Done tick. §7.0 holds the date and commit; this file is each lane's own checklist. If a merge conflicts here, keep both sides' ticks.
- **One e2e run at a time.** `npm run test:e2e` waits while another copy of the repo runs it. Run e2e only through that script, never `npx playwright test` directly.
- **Keep the machine free while lanes run:** one browser, no other AI tools or extensions running against this repo, and no dev server left running once a check is done.
- **The studio is separate.** It runs in its own window with `./start` in `../wedding-planning-studio`.

## Setup

1. **A separate copy of the repo per terminal:** git worktrees inside `../wedding-planning-lanes/` (the studio's settings block that folder; a copy anywhere else would be readable from the studio), each with its own `node_modules` and `.env.local`. The main folder stays on `redesign` and is only for merging.

   | Terminal | Folder | Branch | Test port offset | Opens with |
   |---|---|---|---|---|
   | 1 | `../wedding-planning-lanes/t1` | `lane/t1` | 10 | `t1` |
   | 2 | `../wedding-planning-lanes/t2` | `lane/t2` | 20 | `t2` |

   `t3` and `t4` are retired once their last tasks are delivered (see "Switching to two lanes"). To remove one afterwards: `git worktree remove ../wedding-planning-lanes/t3` and `git branch -d lane/t3`.
2. **Different test ports per copy.** Each lane's git-ignored `.test-port-offset` moves every test port by that much (e2e servers 3100/3101, Auth 9099, Firestore 8080 and its websocket 9150, emulator hub 4400 and logging 4500). A dev server for looking at a screen: `npm run dev -- -p 3010` in t1, `3020` in t2.
3. **e2e starts only what it needs.** `npm run test:e2e` (`scripts/test-e2e.mjs`) holds a lock in the shared `.git` folder so only one copy runs e2e at a time. Given spec paths all under `tests/e2e/demo/`, it starts only the demo dev server; all under `tests/e2e/emulator/`, only the emulators and their dev server. With no arguments it runs everything (phase reviews).

## Every lane, every task: the same commands

Replace `N` with the terminal's number.

1. **Open the terminal:** `tN` in a new window. `tN --continue` resumes the last chat there.
2. **Bring the lane up to date:** `git merge --ff-only redesign` (or `git merge redesign` if the lane has local commits).
3. **Set the model and effort** from the task's line below.
4. **Start the task:** "Do Task 4.13 from `redesign/ui-implementation-plan.md`".
5. **Commit locally** in the lane, with the §7.0 tick, the box here and the `CHANGELOG.md` entry in the same commit. Don't push lane branches.
6. **Deliver it to `redesign`:** `git merge redesign`, fix any bookkeeping conflicts (the change log: keep both entries, newest first; the §7.0 table and the boxes here: keep both sides' ticks), run the after-merge checks (step 5 of the task routine: `tsc` and `npm test` unless code conflicted), then `git -C ../../wedding-planning merge --ff-only lane/tN` and `git -C ../../wedding-planning push origin redesign`. If the fast-forward fails, another lane merged first: merge `redesign` again and retry. One merge at a time.

## Switching to two lanes (2026-10-18)

The four lanes each had a task in hand. Finish those, then close down to two:

1. [x] **t3:** 4.21 Month is built (`2ab2926`). Deliver it (step 6), tick 4.21 in §7.0, then close t3 for good.
2. [x] **t1:** 4.5 Bookings is built (`7ccf468`). Deliver it, then close t1 until t4 is done, so only two lanes run.
3. [x] **t4:** finish 4.18 Tables and formulas and deliver it, then close t4 for good and reopen t1.
4. **t2:** carries on down its list.

## The order of work

`(L)` means a large task, about two sessions. Lane 1 keeps the budget and takes over documents and files, which share the upload parts with the booking screen. Lane 2 keeps vendors, venues and settings and takes over the schedule and people.

| Terminal 1 | Terminal 2 |
|---|---|
| **Phase 4: screens (rest)** | |
| [x] 4.6 A booking (L) · Sonnet 5.5 High | [x] 4.13 Shortlist · Sonnet 5.5 High |
| [x] 4.7 Add a booking · Haiku 5.5 Max | [x] 4.14 A finalist · Sonnet 5.5 High |
| [x] 4.8 Payments due · Sonnet 5.5 High | [ ] 4.15 Venues · Sonnet 5.5 High |
| [ ] 4.10 What-if · Sonnet 5.5 High | [ ] 4.25 Settings · Sonnet 5.5 High |
| [ ] 4.16 Documents · Sonnet 5.5 High | [ ] 4.22 Tasks · Sonnet 5.5 High |
| [ ] 4.19 Files (L) · Sonnet 5.5 High | [ ] 4.23 Wedding items (L) · Sonnet 5.5 High |
| [ ] 6.4 Manifest, icons, install · Haiku 5.5 Max | [ ] 4.24 Guests · Sonnet 5.5 High |
| [ ] 6.5 Not found and error screens · Haiku 5.5 Max | [ ] 6.2 Push reminders (after 4.25) · Opus 5.5 High |
| 🛑 [ ] Phase 4 review · Opus 5.5 Medium | wait |
| **Phase 5: states** | |
| [ ] 5.1 State harness · Sonnet 5.5 High | wait for 5.1 |
| [ ] 5.2 Budget states (L) · Haiku 5.5 Max | [ ] 5.3 Vendors states · Haiku 5.5 Max |
| [ ] 5.4 Documents and files states · Sonnet 5.5 High | [ ] 5.5 Schedule states · Haiku 5.5 Max |
| — | [ ] 5.6 Items and guests states · Haiku 5.5 Max |
| — | [ ] 5.7 Overview, sign-in, settings states · Haiku 5.5 Max |
| 🛑 [ ] Phase 5 review · Opus 5.5 Medium | wait |
| 🛑 [ ] Phase 6 review · Opus 5.5 Medium | wait |
| **Phase 7: switch-over (one terminal only)** | |
| [ ] 7.1 Switch-over commit · Opus 5.5 High | off |
| [ ] 7.2 Rollback rehearsal · Sonnet 5.5 High | off |
| [ ] 7.3 Delete old code · Sonnet 5.5 High | off |
| 🛑 [ ] Phase 7 review · Opus 5.5 High | off |
| **Phase 8: QA** | |
| [ ] 8.1 Behaviour tests (L) · Sonnet 5.5 High | [ ] 8.2 Screenshots · Sonnet 5.5 High |
| [ ] 8.3 Fixes: budget and vendors (after 8.2) · Haiku 5.5 Max | [ ] 8.4 Accessibility · Sonnet 5.5 High |
| [ ] 8.3 Fixes: documents and files · Haiku 5.5 Max | [ ] 8.3 Fixes: schedule, items and guests · Haiku 5.5 Max |
| [ ] 8.5 Device checklist · Haiku 5.5 xHigh | [ ] 8.3 Fixes: shell, overview, sign-in, settings · Haiku 5.5 Max |
| — | [ ] 8.6 Merge preparation · Haiku 5.5 Max |
| 🛑 [ ] Phase 8 review · Opus 5.5 Medium | wait |
| **Phase 9: after launch (one terminal only)** | |
| [ ] 9.1 After-launch check · Sonnet 5.5 High | off |
| [ ] 9.2 Remove the old UI · Sonnet 5.5 High | off |
| 🛑 [ ] Phase 9 review · Opus 5.5 Medium | off |

The earlier four-lane split, the 4.9 calibration trial steps and the N1–N18 studio round are in this file's git history (before 2026-10-18). Their results are in §7.0.
