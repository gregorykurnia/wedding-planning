# Before the merge: the owner's steps

Everything left for the owner, because it touches production or needs them in person, collected from the tasks and reviews of `redesign/ui-implementation-plan.md`. Work through it with a Claude session before merging `redesign` into `main` (the release). A task or review that leaves an owner step adds it here; Task 8.6 puts the list in order. Tick a step here when it's done and record production changes in §7.0, as for 4.F3's rules.

## Production data and settings (before the merge)
- [ ] **Firestore rules from 5.F2** (P5-S13, P5-S14): `npx firebase deploy --only firestore:rules`.
- [ ] **Old-UI drift** (P1-S11, P1-S12 second half, P1-S13): with production credentials (`scripts/migrate/admin.ts`), dry-run `npm run migrate 2-guest-numbers 6-started-on 8-old-ui-sync` and read what it would write. If anything: `npm run migrate:backup`, then the same names with `--apply` (and `--force` for 2 and 6, already recorded). Migration 8 gives booked venues the price the old UI edited and removes bookings whose vendor or venue the old UI moved off its booked stage; run it before the merge only, while only the old UI has written.
- [ ] **Doubled package files** (P1-S15): `npm run migrate:check files` (read-only). A cleanup migration only if it lists any.
- [ ] **Documents the content check refuses** (P5-S8 second half): `npm run migrate:check documents` (read-only). Any it lists open empty and read-only in the new UI; fix them in the old UI before the merge, or raise a task.
- [ ] **Vercel production variables** (P3-S13, P5-S22 second half): `NEXT_PUBLIC_VEIL_GALLERY` and `NEXT_PUBLIC_VEIL_DEV` are not set.
- [ ] **No emulator variables in Vercel production** (Phase 6 review): `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` are not set. With either set, the server starts without credentials, and with the second `verifyIdToken` accepts unsigned tokens.
- [ ] **Push reminder keys** in Vercel production: Task 6.2's "Owner setup" (VAPID keys, `CRON_SECRET`, `FIREBASE_SERVICE_ACCOUNT` if missing).

## In person (before the merge)
- [ ] **Screenshot pairs** from Task 8.2's report accepted.
- [ ] **Device checklist** (`redesign/device-checklist.md`, Task 8.5) run on an installed iPhone, Android Chrome and a Mac.

## After the merge
- [ ] **Reminders with real keys** (Task 6.2's Done when): trigger the cron route by hand; a "1 day before" reminder arrives once on a Mac and an installed iPhone, and a second run sends nothing.
- [ ] **Installed-phone checks** for the service worker and install card (Tasks 6.1, 6.4) on the first HTTPS deploy.
- [ ] **Phase 9:** change its "waits for launch" Done cells in §7.0 to `[ ]`, so `autorun` picks it up after the launch window.
