# Phase 2 review

**Date:** 2026-10-15 · **Model:** Opus 5.5 Medium (the §7.0 pick) · **Diff:** `be149b37..bf1f11d` plus the merge of `redesign` at `f641ca5` (Tasks 2.1–2.7; Phase 6 tasks 6.1, 6.3 and 6.7, built in the same weeks, wait for the Phase 6 review).
**Result: passed after fixes.** The first pass found two blockers: a busy confirm closed by a route change loses its undo (Task 2.6), and `/new` has no placeholder hero (Phase 2 Done-when). Both were fixed in this session along with seven of the should-fix and minor items (see "Fixes"). The rest are tracked below.

Four parallel reviewers each read one area against `ui-implementation-plan.md`, the design guide and the prototype: 2.3 (session and gate), 2.6 (sheets, confirm, toasts), 2.7 (partner news and presence), and 2.1, 2.2, 2.4 and 2.5 (styles, icons, navigation, states). The blockers and the open-redirect finding were then checked by hand. Where reviewers disagreed (`safeNext` after Task 7.1), the code was read again: the open-redirect reviewer was right.

## Verification run

| Check | Before fixes | After fixes |
|---|---|---|
| `npx tsc --noEmit` | clean | clean |
| `npm run lint` | 8 errors, the same 8 as Phase 1 (bundled `public/pdf.worker.min.mjs`, old `(legacy)/settings/page.tsx:27`) | no new errors in the changed files |
| Style check, old-names check | pass | pass (99 files, 53 terms) |
| `npm test` (model) | 21 files, 410 pass | 413 pass |
| `npm run test:emulator` | 172 pass, 1 skipped (the real-Cloudinary test, which needs keys) | not affected |
| `npm run build` | passes | passes |
| `npm run test:e2e` | 55 of 55 pass | 57 of 57 pass (2 new) |

## Blockers

**B1. A route change closes a busy confirm, and its write lands with no undo** (Task 2.6). `sheet.tsx` closed every sheet when the path changed, skipping the busy check that Escape and the scrim use. `useConfirm` then resolved `false`, and when `run()` succeeded a moment later the caller had already moved on. Scenario: Remove booking, then Back (or a partner toast's Open) while it says Removing. The booking is gone and no Undo toast appears, which breaks guide §6.2. The same effect also closed a sheet that the new screen opened as it mounted (child effects run before the host's).

**B2. `/new` has no placeholder hero** (Phase 2 Done-when: "the top bar, the menu and a placeholder hero ... styled only by tokens, at both widths"). The page was a bare `<p>` with no `h1` and no column.

## Should fix (open)

Session and gate (Task 2.3):
- **S1.** An account let in on trust (the probe couldn't reach the database) is probed again only when `navigator.onLine` changes (`session.ts`, re-probe effect). On a captive portal or a timeout with the browser still "online", a third account or an unverified address gets the shell and failing reads instead of Account not allowed. No data is exposed (the rules deny). Fix: re-probe on a timer while unconfirmed and on `visibilitychange`, or treat the first `permission-denied` from any data hook as a probe result.

Partner news and presence (Task 2.7), before the data hooks of Phase 4 use them:
- **S2.** "Also here" compares a server `at` with the device clock (`model/partner.ts` `partnerIsHere`, `data/presence.ts`). A fast clock makes the banner flicker or never show; a slow one keeps a stale entry fresh. Compare with this account's own latest server `at` in the same snapshot.
- **S3.** The session start is `Date.now()` compared with server timestamps (`data/partner.ts`, `collections/activity.ts`). A slow device clock replays the partner's last minutes as a burst of toasts on every load; a fast one drops changes. `useRemovedByPartner` has the same problem. Mark everything in the first server snapshot as seen, then toast only `docChanges()` of type `added`. This also fixes the unbounded re-mapping of a tab left open for days.
- **S4.** A removal the partner undoes stays "removed" until reload (`useRemovedByPartner`): there is no restored entry and the hook never checks that the record exists again. Apply the hit only while the record's own snapshot says it is missing, or log `*.restored` from `removeWithUndo`'s undo.

Layout (for Tasks 3.0/3.1, before any screen):
- **S5.** The top bar renders inside `<main>`, because the page renders it and the gate wraps every page in `main`. It isn't a banner landmark, and `aria-busy` covers the menu while a screen loads. The prototype puts `.top` and the demo banner before `main`. Render the top bar (and the demo banner) outside `main`, through a layout slot.
- **S6.** No shared page column. Only the placeholder page and the session skeleton have one now (`--measure`, `--space-page-*`). Add a column part with `--measure` / `--measure-wide` for screens.

## Minor

- Session: an allowed but unverified account (Bella with a password) is told the account "isn't one of the two"; `user.emailVerified` can tell the two apart (Task 4.1, ties to Phase 1 owner check 1). `members/{uid}` write failures only reach the console.
- Gate tests: the not-allowed reload step would pass even if sign-out never happened; no test of the `?next=` round trip, `aria-busy` during the check, the offline probe, or the `members` write.
- Sheets: a failed `run()` swallows the `WriteError`, which Task 3.8 needs for its wording. Toasts don't pause on hover or focus, so a keyboard user can hardly reach Undo in 6 s (WCAG 2.2.1). Toasts outside an `aria-modal` sheet may not be announced by VoiceOver. A sheet built without `Sheet` points `aria-labelledby` at a missing id. `body { overflow: hidden }` doesn't stop iOS from scrolling behind a bottom sheet. Escape order between the menu and a sheet depends on listener order (can't happen today).
- Presence: rules don't tie a presence doc id to its uid or check `resource.data.uid` on update, and `at` can be any time (same as Phase 1's S22, still open). With no document the listener still runs and re-renders every 5 s, with no error handler. Offline, a heartbeat queues a write every 20 s. Until N3, if `partnerEmail` isn't set both accounts name the same partner: check production settings before screens go live. Two e2e checks that Bella gets no toast run before any snapshot could arrive.
- Styles: raw sizes with no token yet (menu button lines, the account's 44/22px, the 72px mark, the inline message title's 28px, button padding `11px 22px`). The style check only looks at colours. Log the missing ones as a gap if the guide doesn't cover them.
- `veilHref("/?x=1")` gives `/new/?x=1`, and `veilHref("/new/budget")` doubles the prefix; three assertions only.
- The demo banner isn't on `/new` (only `ScreenState` renders it); Task 4.2 uses `ScreenState`.
- No scroll lock while the menu is open (the prototype has none either).

## Done-when per task

| Task | Done-when met? |
|---|---|
| 2.1 | Yes |
| 2.2 | Yes (gallery view waits for 3.0, as noted) |
| 2.3 | Yes; S1 open |
| 2.4 | Yes |
| 2.5 | Yes |
| 2.6 | **No** before the fix (B1); yes after |
| 2.7 | Yes; S2–S4 open |
| Phase | **No** before the fix (B2); yes after |

## Escalation (§7.0)

The review rejects Task 2.6 (B1). It was Sonnet 5.5 High, so its fix moves one row up to **Opus 5.5 Medium**, and it was done in this session on that model. B2 is the phase's Done-when, not one task's.

Suggested follow-up sessions:
1. S2–S4 (partner news and presence, plus the presence rule) · Sonnet 5.5 High, or Opus 5.5 Medium if it touches the deployed rules. Before Phase 4's data hooks.
2. S5, S6 with Task 3.0 or 3.1 (layout slot and page column).
3. S1 with Task 4.1 (sign-in), along with the unverified-account notice.

## Fixes (2026-10-15, same session)

- **B1 fixed.** Each sheet remembers the screen it was opened on (`path`, read from a layout effect so it is current before any page effect runs). A route change closes only sheets opened on another screen and never a busy one: its write finishes and the confirm resolves `true`, so the caller still shows Undo. A sheet the new screen opens as it mounts stays open. Two new e2e tests in `tests/e2e/demo/veil-shell.spec.ts` leave the screen while Removing (fails on the old code, passes now) and with an idle sheet open. The shell demo gained "Make the next write slow" and a link out.
- **B2 fixed.** `/new` shows the top bar and a placeholder hero (an `h1` "Overview" and the kicker) in the page column, all from tokens (`src/app/(veil)/new/page.module.css`). The session skeleton sits in the same column (`Shimmer column`).
- **Open redirect fixed.** `safeNext` moved to `src/veil/href.ts`. It follows only addresses under the new UI's prefix and refuses `//`, backslashes and spaces, so `/\evil.com` can't send a signed-in user off-site once Task 7.1 empties the prefix. Tests in `tests/model/href.test.ts` cover both prefixes.
- **Focus after a remove.** When a sheet's opener is gone and no sheet is left, focus goes to `main` (now `tabIndex={-1}`, with no ring) instead of falling to the top of the page.
- **Sign-out.** A failed sign-out of a not-allowed account no longer leaves the skeleton up forever; a failed sign-out from the menu takes back "You've signed out."
- **Menu.** Picking a section, or Wedding settings, closes the menu, which matters when the link is the screen you're on. The menu's `nav` is labelled.
- **Tokens.** `Message` uses `--measure-message` and gets side padding on a phone; the banner `--measure-banner` and spacing tokens; the skeleton `--fill-skeleton` and `--motion-shimmer`; the sub-navigation `--space-page-top`.

## Re-check after Task 3.0 (2026-10-15)

Run on `redesign` at `133e59f` (Task 3.0 is `198a3e6`). Code changed since the review: the gallery route and its gate, and the four Phase 2 demo pages lost their own copy of the gate (see the 3.0 entry in `AGENTS.md`).

- **Full e2e (`npm run test:e2e`):** 61 of 61 pass on the second run (7.6 min, demo and emulator projects together). The count rose from 57 by the four gallery tests.
- **First run:** 60 passed, 1 failed: `tests/e2e/emulator/files.spec.ts`, "create a folder and upload a file (Cloudinary stubbed)". Sign-in stayed on `/login` and showed `Error (auth/network-request-failed)`, so the browser couldn't reach the Auth emulator. The test passed alone (16.5 s) and in the second run, so this was a transient connection failure, not a code change. The test has no retry. If it recurs, retry the sign-in once in `tests/e2e/helpers.ts`.
- **Firestore log lines:** `already-exists` commit failures during the run come from the master-list initialization transaction losing a race. Its guard (`src/lib/collections/master-list.ts:148`) checks the marker again inside the transaction. The SDK logs the lost commit and the tests pass. I haven't traced which test starts the race.
- **S5 and S6** were planned for Task 3.0 or 3.1. Task 3.0 didn't take them, so they move to Task 3.1, the first component that sits in a screen column.
- **S5 and S6 done** (2026-10-16, lane t1, before Tasks 4.1 and 4.2; Task 3.1 hadn't taken them either): the gate in `src/veil/shell/providers.tsx` draws `TopBar` and `DemoBanner` before `main`, on every screen but sign-in and the gallery, and works out the menu's section from the address (`sectionOf` in `src/veil/href.ts`). Screens sit in `PageColumn` (`src/veil/shell/page-column.tsx`: `default`, `wide`, `doc`, `table`).
- The Phase 2 result stands (passed after fixes). S1–S4 stay open as listed above.
