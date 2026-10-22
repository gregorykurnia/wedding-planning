# Phase 6 review

**Date:** 2026-10-22 · **Model:** Opus 5.5 Medium (the §7.0 pick), unattended `autorun` · **Diff:** `c9e8031..333e349` on `redesign` (fix tasks 5.F1–5.F3 and the e2e harness changes), plus Tasks 6.1, 6.3 and 6.7, which no earlier review read, and a second look at 6.2, 6.4 and 6.5 (read in the Phase 4 review). Reviewed in the main folder.
**Result: passed.** No blockers. Seven should-fix items were fixed in this session (P6-S1–S7), one is folded into Task 7.1, and the rest go to fix tasks 6.F1 and 6.F2 before Phase 7 (`triage.md`, Phase 6).

Five parallel reviewers each read one area against `ui-implementation-plan.md`, the design guide and the prototype:
- the service worker, manifest and install, not found and error (6.1, 6.4, 6.5)
- push reminders and delete for good, with the rules (6.2, 6.3)
- 5.F1 (money, items and guests writes)
- 5.F2 (documents, files and rules) and the old-names check (6.7)
- 5.F3 (states, wording and the harness) and `scripts/test-e2e.mjs`

Each fix below has a test that fails without it (checked by running the new emulator tests against the old code).

## Verification run

| Check | Before fixes | After fixes |
|---|---|---|
| `npx tsc --noEmit` | clean | clean |
| `npm run lint` | the 8 old errors only (legacy settings page) | same; changed files clean |
| Style check, old-names check | pass (418 files, 53 terms) | pass |
| `npm test` (model) | 86 files, 1294 pass | 1294 pass (`sw.test.ts` updated) |
| `npm run test:emulator` | 364 pass, 1 skipped | the three changed files: 61 pass (3 new) |
| `npm run build` | — | passes |
| `npm run test:e2e` (full, after fixes) | — | 584 of 588 pass in 7 passes (demo 249, emulator 77 + 78 + 80 + 77 + 17, stress 6; about 64 min); the 4 failures passed alone after their fix (see "Full e2e run") |

## Full e2e run

- One full run after the fixes, with no other lane running. The 4 failures were all specs that still expected "Couldn’t save…" while the browser was offline, but 5.F3 (P5-S16) changed that line to "Not saved: you’re offline. Keep this page open." The 4 specs:
  - `veil-guests.spec.ts` "two replies that didn't save…"
  - `veil-items.spec.ts` "two changes that didn't save…"
  - `veil-tasks.spec.ts` "a step that can't be saved…" and "a failed step title stays failed…"
- 5.F3 ran only its own specs. The four now expect the offline line while offline and the named line once back online. All four passed when rerun alone.
- No servers were left on this copy's ports.

## Fixed in this review

- **P6-S1. The install card stayed up after installing from Chrome's menu** (6.4, `use-can-install.ts`): the browser's offer was never taken back. Now `appinstalled` clears it. E2e: "the install card goes once the planner is installed from the browser's own menu" (`veil-overview.spec.ts`).
- **P6-S2. The service worker held each new static file back until it was stored** (6.1, `public/sw.js`): `cache.put` reads the whole body, and the cache trim ran before the response was returned. This slowed the first open after a deploy. Now the response is returned at once, and storing it runs in `event.waitUntil`. `sw.test.ts` waits for that.
- **P6-S3. A reminder stayed marked as sent when no device took it** (6.2, `src/lib/server/reminders.ts`): when every device answered "gone", the claim was kept and the subscriptions removed, so a device saved again that day never got it. Now the claim is given back unless some device took it. Once every device has turned out forgotten, the run stops claiming. Emulator test: "gives a reminder back when every device turned out forgotten…".
- **P6-S4. A folder delete put back after a landing could say the wrong thing** (5.F2, `deleteFolder`): if the put-back failed, the confirm said nothing was deleted while the folder was gone. Now the delete is reported, with its Undo. Emulator test in `file-races.test.ts`.
- **P6-S5. Add a booking could still file its folder under a deleted parent** (5.F2, P5-S10's pattern; `addDirectBooking`): the parent is now read inside the transaction, and the folder goes at the top if the parent is gone. Emulator test in `operations.test.ts`.
- **P6-S6. One old-names term could never match** (6.7): "Firebase isn't connected" had a straight apostrophe, but the old UI writes `isn&apos;t`. The term is now "Firebase isn".
- **P6-S7. The e2e runner could leave servers running** (`scripts/test-e2e.mjs`): Playwright starts each web server in a process group of its own, which the runner's group kill didn't reach. After each pass, the runner now stops whatever still listens on this copy's own test ports, and nothing else.

## Should fix (open)

Write races (6.F1):
- **S8.** An add and a pending move take the same gap (`items.ts:107-113`, `items-screen.tsx:308-313`). Rows X, A, B: Alt+↓ on X writes X between A and B; "add below A" before that lands also goes between A and B. Nothing is lost, but the order is wrong. In `addBelow`, wait for `moves.current.chain` and use the placed order.
- **S9.** An older try's Try again overwrites newer text (`items-screen.tsx:252-267`): name A fails, the user types B, and A's Try again lands after B, so A is stored while B shows as saved. Clear a key's failure when a new try starts, or ignore a retry that isn't the newest.
- **S10.** A late first guest add undoes Try again's changes (`guest-meta.ts:27-31`, same class as P5-S1): try 1 commits after try 2 and writes its whole form back. Store the try's start time and skip older ones, as for payments.
- **S11.** A delete during a renumber above 490 items scrambles the order (`master-list.ts:225-237`): a batch update on a deleted row rejects the batch after the first batch has moved its rows. Write the batches from the end backwards, then catch the failure and re-list.
- **S13.** A Deposit reads negative after an overpaid split followed by Try again at a lower amount (`bookings.ts:243-247` with `splitPlan`). The total stays right. Put the difference on the Balance, or keep each part's paid at 0 or more.

Offline states and wiring tests (6.F2):
- **S14.** A sheet freed by a failed add closes with no word (`sheet.tsx:243-250`, `add-task-sheet.tsx:60`; the P3-S6 behaviour that `veil-wiring.spec.ts` now asserts). Offline, add a task and press Back: after 10 s the add times out and the sheet closes on the other screen. Keep the sheet open on a failure, or raise a toast with Try again. If that needs a design decision, it's a gap.
- **S15.** Offline, secondary lists that never loaded read as empty (`vendors.ts:199`, `shortlist.ts:47`, with `readOf`'s `main=1` from P5-S7). A vendor shows no files and offers "Copy to the shortlist" when it's already on it. Guide §6.5: it never looks empty.
- **S16.** Offline, a vendor booking whose vendors read is held says "This booking isn't here" (`use-booking.ts:117` returns `page` whatever `readOf` gives). Return `readOf`'s data, so the offline message shows.
- **S17.** The rest of P5-S16's offline wording: the keen line (vendor, finalist, vendors), the folder sheet, the upload sheet, the add-funder row, Copy to the shortlist and the booking's action failures still say "Couldn't…" while offline.
- **S18.** Wiring tests that fail when the wiring is removed:
  - P2-S1: `veil-wiring.spec.ts:80` waits 45 s, longer than the 30 s re-probe timer, so removing the `visibilitychange` wiring stays green.
  - P5-S26: `usePartnerNews` calling `mergeNewsBurst`.
  - P5-S19: the `Tries` calls in `items-screen.tsx`.
  - P5-S2: `who-pays.tsx` passing the what-if read's state.
  - P5-S12: the nouns on Bookings, Payments due and Add a booking.

Folded into 7.1:
- **S12.** After 7.1 moves `(veil)/new/*` to the root, the catch-all `[...address]` would answer the gallery-off rewrite's `/gallery-off` with the not-found page and a 200 (10d0d7d's body). Task 7.1's text now says so.

Dropped (reasons in `triage.md`): **S19** (the old UI keeps `remindersSent` on a date change), the install mini-infobar, and the cron `maxDuration`.

## Checked and fine (summary)

- **Service worker** (6.1): handles only same-origin `/_next/static/` GETs. It caches only 200, `basic`, not redirected, `immutable` responses. Update is versioned with `skipWaiting` and `clients.claim`. `/sw.js` is sent `no-store`. Notification URLs must be paths on this site.
- **Manifest and errors** (6.4, 6.5): the manifest matches the prototype's. Not found and error match guide §5.25. `error.tsx` uses this Next version's `unstable_retry`.
- **Cron and routes** (6.2): with no `CRON_SECRET` the route answers 503. The secret is compared in constant time. Every other route verifies the token, a verified email and the allowlist. Duplicate runs send nothing twice. The day is Jakarta's. Subscriptions are removed only on 404 or 410.
- **Delete for good** (6.3): only the id comes from the client. The asset is worked out from the stored address on our own cloud and cross-checked. Cloudinary goes first, then one transaction. It is idempotent, and an asset another file shares is kept. No server code reaches the client bundle.
- **Fix tasks:**
  - 5.F1: P5-S1, S2, S4 and S20 fixed; S18, S19 and S21 partly (see S8, S9, S11, S18).
  - 5.F2: every item fixed (S5 and S6 above were left over).
  - 5.F3: S3, S12, S15, S17, S22, S23, S27 and S28 fixed. S7, S16 and S24 partly (S15–S18). S25 raised as G40/N40. S26 is fixed but has no wiring test.
- **Fault switch** (P5-S22): `.next/static` holds no fault code.

## Coverage

§5.2 ticked: S10 reminders, R13 really removed and A3 install. Each is built and tested; the real-key and installed-phone checks are the owner's, in `before-merge.md`. §6 ticked: not found and error, CSV columns, manifest, and reminders. The offline indicator row stays open for S15–S17. §5.1 boxes stay for Task 8.2's screenshots.

## Owner steps added to `before-merge.md`
- `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` must not be set in Vercel production.
- Already listed: the 5.F2 rules deploy, the push keys, real-key reminders, and the installed-phone checks for 6.1 and 6.4.
