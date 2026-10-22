# Before the merge: the owner's steps

Everything left for the owner, because it touches production, needs an account or needs you in person. Collected from the tasks and reviews of `redesign/ui-implementation-plan.md`, in the order to do them. Work through it with a Claude session before merging `redesign` into `main` (the release). A task or review that leaves an owner step adds it here. Tick a step when it's done, and record production changes in §7.0, as for 4.F3's rules.

Sections 1 and 2 change nothing in production, or only add to it. Section 3 is the old-UI drift, the last production step before the merge. Section 5 runs after the merge.

## 1. Checks that change nothing

- [ ] **Vercel production variables** (P3-S13, P5-S22, Phase 6 review): in Vercel › Project › Settings › Environment Variables, for Production, `NEXT_PUBLIC_VEIL_GALLERY` and `NEXT_PUBLIC_VEIL_DEV` are not set, and neither are `FIRESTORE_EMULATOR_HOST` or `FIREBASE_AUTH_EMULATOR_HOST`. With an emulator variable set, the server starts without credentials, and the second `verifyIdToken` accepts unsigned tokens.
- [ ] **Doubled package files** (P1-S15): `npm run migrate:check files` (read-only). If it lists any, a cleanup migration comes first: raise it in a redesign session before the merge.
- [ ] **Documents the editor refuses** (P5-S8, second half): `npm run migrate:check documents` (read-only). Each one it lists opens empty and read-only in the new UI. Fix it in the old UI before the merge, or raise a task.
- [ ] **Bella's sign-in** (Phase 1, owner check 1; still open at the Phase 4 review): Bella loads and saves once on production. If they use a password, they sign in with Google once. The rules require a verified address, a password account isn't verified, and nothing sends a verification email.
- [ ] **Five production documents** (4.17, still open at the Phase 4 review): on the local production build (`npm run build && npm start`), open five existing documents and check they look complete. Only look; don't save. This build reads production only with the live `.env.local`, so run the device checklist's clean-up first.
- [ ] **Screenshot pairs** (8.2): `tests/screenshots/report/report.md` lists the differences by group. It's git-ignored, so it's on the machine where `npm run screenshots` ran. Accept the pairs that look right, then ask a redesign session to tick those rows in §5.1 of the plan (the Phase 8 review left §5.1 for this: a pixel score can't say a pair looks right, and data differences need your eye).
- [ ] **Device checklist** (`redesign/device-checklist.md`, 8.5): run it on an installed iPhone, Android Chrome and a Mac. It uses test Firebase and Cloudinary values, so run it before the five-document check, which needs the live `.env.local`. Tick **Device checklist** here when every check passes. A failure becomes a fix task before the merge.

## 2. Production changes that only add (before the merge)

- [ ] **Open access** (owner's call, 2026-10-22): in the Firebase console, Authentication › Sign-in method › Anonymous › Enable. The rules deploy below then lets any visitor in, and the app opens without signing in. Without Anonymous enabled, the app falls back to the sign-in screen.
- [ ] **Firestore rules** (5.F2, P5-S13 and P5-S14: push subscriptions and presence): `npx firebase deploy --only firestore:rules`. The rules are additive, so the old UI isn't affected. The 4.F3 rules went live on 2026-10-19. Note the date in 5.F2's row of §7.0.
- [ ] **Server keys in Vercel production** (6.2's owner setup, 6.3): add any that are missing, for Production: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (from `npx web-push generate-vapid-keys`), `CRON_SECRET` (`openssl rand -hex 32`), `FIREBASE_SERVICE_ACCOUNT` (the service account key's JSON), and `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`. Delete for good fails without the Cloudinary pair, and the Cloudinary key needs the Master Admin role. The daily reminder run starts with the merge's deploy (section 5).

## 3. Old-UI drift (the last production step before the merge)

- [ ] **Old-UI drift** (P1-S11, P1-S12 second half, P1-S13). Do it last, just before the merge, with no old-UI edits after it. It needs production credentials: `FIREBASE_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS` in the shell, and `FIRESTORE_EMULATOR_HOST` unset.
  1. Dry run: `npm run migrate -- 2-guest-numbers 6-started-on 8-old-ui-sync`. The first line must name `wedding-planning-75c0c` and must not say "(emulator)". Save the printout: it holds each old value, the only way to undo by hand.
  2. If it plans anything: `npm run migrate:backup`, then `npm run migrate -- 2-guest-numbers 6-started-on --apply --force`, then `npm run migrate -- 8-old-ui-sync --apply`. The `--` matters: without it npm keeps the flags and the "apply" is another dry run (Phase 7 review). Never `all --force`: it re-runs 1 and 5.
  3. Migration 8 gives booked venues the price the old UI edited, and removes bookings whose vendor or venue the old UI moved off its booked stage. It puts them back if the old UI books them again. A record the new UI has written is only reported; check it by hand.

## 4. The way back, open decisions, and the merge

- [x] **Rollback check** (Phase 7 review; §9.3): on `redesign`, `node scripts/rollback.mjs` ends with "Check passed" and changes nothing. It passed on 2026-10-22. Run it again after any task that adds or moves a route. Also note the current production deployment in Vercel: promoting it is the fastest way back.
- [ ] **Design gaps** (§9.1 G19–G47; needs N19–N47 in `redesign/handoff/needs.md`, all `open`): the merge's Definition of Done (§10) needs every need designed and built, and every §9.1 row closed. For each one, decide in a redesign session: design it in the studio (the design-gap loop), or accept what's built and close the row with that decision in §9.2. Each §9.1 row says what the gap is, and some say what the build does for now.
- [x] **Phase 8 review** passed on 2026-10-22 (`redesign/reviews/phase-8-review.md`). Its owner items, the screenshot pairs and the device checklist, are in section 1. Its fix tasks 8.F1 and 8.F2 run (by `autorun` or a redesign session) before the merge.
- [x] **CLAUDE.md** (8.6): in a redesign session, remove the "The redesign process (until the merge)" section and the "During the redesign" sentence under Git workflow, in one commit on `redesign`. The merge then brings only the new UI's rules.
- [ ] **Old Register button, not blocking** (Phase 1 review; not routed to a task): the frozen old UI still has a Register button, and the accounts it makes are ones the rules deny (Q2 dropped registration). Accept it for the launch window, or ask a redesign session to hide it in the old UI before the merge.
- [ ] **Formula range, not blocking** (Phase 1 review, "owner call"): a total row whose range includes another total follows the guide's wording. Nothing waits on this; tell a redesign session if you want it changed.
- [ ] **Say "release"** when the steps above are ticked. Claude runs the full checks first (lint, build, unit tests, the full e2e suite on production builds, and the old-names check with the fallback excluded), then fast-forwards `main` to `redesign` and pushes. Vercel deploys `main`.

## 5. After the merge (in this order)

- [ ] **Drift check after the deploy** (Phase 7 review, S5): dry-run `npm run migrate -- 2-guest-numbers 6-started-on`. If it plans anything, `npm run migrate:backup` (if the last backup is over a day old), then `npm run migrate -- 2-guest-numbers 6-started-on --apply --force`. Not 8: it ran just before the merge and must not run after it. The old UI at `/old` stays reachable during the launch window, and its last saves can erase `startedOn` and leave a guest unnumbered.
- [ ] **Reminders with real keys** (6.2's Done when): the daily cron starts with this deploy, so its first run sends that day's real reminders. Check by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/reminders`, with a "1 day before" reminder due. It arrives once on a Mac and on an installed iPhone, and a second run sends nothing.
- [ ] **Installed-phone checks** (6.1, 6.4) on the first HTTPS deploy: an installed phone picks up a new deploy on its next open, and the install card hides once the app is installed.
- [ ] **Phase 9, in two steps** (§7.0; §9.3): change 9.1's "waits for launch" Done cell to `[ ]` about a week after the merge, for its check. Change 9.2's and the Phase 9 review's cells to `[ ]` only when the two-week launch window is over, because 9.2 deletes the old UI.
