# Before the merge: the owner's steps

Everything left for the owner, because it touches production or needs them in person, collected from the tasks and reviews of `redesign/ui-implementation-plan.md`. Work through it with a Claude session before merging `redesign` into `main` (the release). A task or review that leaves an owner step adds it here; Task 8.6 puts the list in order. Tick a step here when it's done and record production changes in §7.0, as for 4.F3's rules.

## Production data and settings (before the merge)
- [ ] **Firestore rules from 5.F2** (P5-S13, P5-S14): `npx firebase deploy --only firestore:rules`.
- [ ] **Old-UI drift** (P1-S11, P1-S12 second half, P1-S13): with production credentials (`scripts/migrate/admin.ts`), dry-run `npm run migrate -- 2-guest-numbers 6-started-on 8-old-ui-sync` and save what it prints (it holds each old value, the only way to undo by hand). If anything: `npm run migrate:backup`, then `npm run migrate -- 2-guest-numbers 6-started-on --apply --force` (both already recorded) and `npm run migrate -- 8-old-ui-sync --apply`. The `--` matters: without it npm keeps the flags and the "apply" is another dry run (Phase 7 review). Never `all --force`: it re-runs 1 and 5. Do this last, just before the merge, with no old-UI edits after it. Migration 8 gives booked venues the price the old UI edited and removes bookings whose vendor or venue the old UI moved off its booked stage (puts them back if the old UI books them again); a record the new UI has written, from a local preview against production, is only reported, to check by hand. After the deploy, dry-run 2 and 6 once more (the old UI's last saves can erase `startedOn` and leave a guest unnumbered); apply them with `--force` if they plan anything. Not 8 after the merge.
- [ ] **Doubled package files** (P1-S15): `npm run migrate:check files` (read-only). A cleanup migration only if it lists any.
- [ ] **Documents the content check refuses** (P5-S8 second half): `npm run migrate:check documents` (read-only). Any it lists open empty and read-only in the new UI; fix them in the old UI before the merge, or raise a task.
- [ ] **Vercel production variables** (P3-S13, P5-S22 second half): `NEXT_PUBLIC_VEIL_GALLERY` and `NEXT_PUBLIC_VEIL_DEV` are not set.
- [ ] **No emulator variables in Vercel production** (Phase 6 review): `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` are not set. With either set, the server starts without credentials, and with the second `verifyIdToken` accepts unsigned tokens.
- [ ] **Push reminder keys** in Vercel production: Task 6.2's "Owner setup" (VAPID keys, `CRON_SECRET`, `FIREBASE_SERVICE_ACCOUNT` if missing).

## The way back (just before the merge)
- [ ] **Rollback check** (Phase 7 review): on `redesign`, `node scripts/rollback.mjs` says "Check passed" (it changes nothing). If it lists a problem, a later task added or moved a route: fix that before merging, so the one-commit revert in plan §9.3 still works.

## In person (before the merge)
- [ ] **Screenshot pairs** from Task 8.2's report accepted.
- [ ] **Device checklist** (`redesign/device-checklist.md`, Task 8.5) run on an installed iPhone, Android Chrome and a Mac.

## After the merge
- [ ] **Reminders with real keys** (Task 6.2's Done when): trigger the cron route by hand; a "1 day before" reminder arrives once on a Mac and an installed iPhone, and a second run sends nothing.
- [ ] **Installed-phone checks** for the service worker and install card (Tasks 6.1, 6.4) on the first HTTPS deploy.
- [ ] **Phase 9:** change its "waits for launch" Done cells in §7.0 to `[ ]`, so `autorun` picks it up after the launch window.
