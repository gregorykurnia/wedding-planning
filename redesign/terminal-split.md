# Terminal split: building the rebuild in parallel

An optional way to run the Step 7 rebuild (`redesign/ui-implementation-plan.md` §7) in up to three terminals at once. Each terminal works through its own queue of tasks: it finishes a task, merges it into `redesign`, then starts its next task. Every other rule in §7.0 still applies: one task per session, the model check for each task, and the Done ticks.

- **Phase reviews stop everything.** At each phase review, all terminals wait until it passes. Don't start a later phase's tasks before then.
- **Each terminal switches model per task** as the §7.0 table says.
- **The studio is separate.** It runs in its own window with `./start` in `../wedding-planning-studio`, as always.
- **Two terminals also work:** spread Terminal 3's column across the other two.

## Before the first wave (one-time setup, not done yet)

1. **A separate copy of the repo per terminal** (git worktrees), so the terminals don't overwrite each other's files, e.g. `git worktree add ../wp-t2 -b lane/t2 redesign`.
2. **Different test ports per copy.** `playwright.config.ts` hard-codes 3100 and 3101, and `firebase.json` hard-codes 8080 and 9099, so two test runs at once collide. Until the ports are configurable, run e2e in one terminal at a time.
3. **A line in `CLAUDE.md`** allowing short task branches that merge back into `redesign` (today it says to work only on `redesign`).
4. **Merge one task at a time.** Expect small conflicts in the shared bookkeeping: the `AGENTS.md` change log, the ticks in `ui-implementation-plan.md` (§5, §6, §7.0, §10) and the gallery index.

## Phase 2: shell

| | Terminal 1 | Terminal 2 | Terminal 3 |
|---|---|---|---|
| Wave 1 | 2.3 auth and providers | 2.1 tokens, then 2.2 icons | **Studio:** design-gap loop for N1–N13 (the owner runs it) |
| Wave 2 | 2.6 sheets and toasts, then 2.7 partner changes | 2.4 top bar, then 2.5 screen states | 6.1 service worker (after 2.3), then 6.3 delete for good, then 6.7 old-names check |
| | **Phase 2 review** (others wait) | | |

## Phase 3: components

Terminal 1 builds 3.0 (the gallery) first. It's small, and every other component adds itself to it. Terminal 2 builds 3.3 (buttons) early, because 3.8, 3.10 and 3.12 reuse it.

| Terminal 1 | Terminal 2 | Terminal 3 |
|---|---|---|
| 3.0 gallery | 3.3 buttons | 3.11 agenda and month |
| 3.4 fields | 3.1 hero | 3.6 parts |
| 3.10 uploads | 3.2 next card | 3.7 search and filters |
| 3.12 task, item and guest rows | 3.5 ledger rows | 3.8 sheet patterns, then 3.9 |
| **Phase 3 review** | | |

## Phase 4: screens, one area per terminal (about 10 sessions each)

| Terminal 1: Budget | Terminal 2: Vendors and documents | Terminal 3: Everything else |
|---|---|---|
| **4.9 Who pays, built twice (calibration, first)** | 4.11 Vendors | 4.1 Sign in |
| 4.4 Record a payment | 4.12 A vendor | 4.2 Overview |
| 4.3 Budget | 4.13 Shortlist | 4.19 Files |
| 4.5 Bookings | 4.14 A finalist | 4.20 Schedule |
| 4.6 A booking | 4.15 Venues | 4.21 Month |
| 4.7 Add a booking | 4.16 Documents | 4.22 Tasks |
| 4.8 Payments due | 4.17 Editor core | 4.23 Wedding items |
| 4.10 What-if | 4.18 Tables and formulas | 4.24 Guests, then 4.25 Settings |
| **Phase 4 review** | | |

- The 4.9 result decides whether the display-only screens (4.3, 4.5, 4.8, 4.13, 4.16, 4.21) stay on Haiku or move up. Don't start those until it's in.
- Once the studio has designed and imported N1, N2, N5 and N11, whichever terminal is free first picks up 6.2, 6.4, 6.5 and 6.6.

## Phase 5: states

| Terminal 1 | Terminal 2 | Terminal 3 |
|---|---|---|
| 5.1 state harness (others wait for it) | | |
| 5.2 Budget states | 5.3 Vendors, then 5.4 Documents | 5.5 Schedule, then 5.6 Items, then 5.7 Overview |
| **Phase 5 review**, then the **Phase 6 review** | | |

## Phase 7: switch-over, one terminal only

7.1 → 7.2 → 7.3 → review. It's the risky one, so nothing else runs during it.

## Phase 8: QA

| Terminal 1 | Terminal 2 | Terminal 3 |
|---|---|---|
| 8.1 behaviour tests | 8.2 screenshots | 8.4 accessibility |
| | 8.3 fixes: budget and vendors, then documents and files | 8.3 fixes: schedule, items and guests, then shell, overview, sign-in and settings |
| | | 8.5 device checklist, then 8.6 merge preparation |
| **Phase 8 review** | | |

## Phase 9: after launch, one terminal only

9.1 → 9.2 → review.
