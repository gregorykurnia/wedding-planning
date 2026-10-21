# Before the merge: the owner's steps

Everything left for the owner, because it touches production or needs them in person, collected from the tasks and reviews of `redesign/ui-implementation-plan.md`. Work through it with a Claude session before merging `redesign` into `main` (the release). A task or review that leaves an owner step adds it here; Task 8.6 puts the list in order. Tick a step here when it's done and record production changes in §7.0, as for 4.F3's rules.

## Production data and settings (before the merge)
- [ ] **Firestore rules from 5.F2** (P5-S13, P5-S14): `npx firebase deploy --only firestore:rules`.
- [ ] **Old-UI drift** (P1-S11, P1-S12 second half, P1-S13): re-check production with Task 7.1's scripts, then re-run the affected migrations (4.F3's `--force` guard) and P1-S13's sync step: dry run first, backup before.
- [ ] **Doubled package files** (P1-S15): Task 7.1's read-only `weddingFiles` check on production; a cleanup migration only if it finds duplicates.
- [ ] **Documents the content check refuses** (P5-S8 second half): Task 7.1's read-only `notes` pass on production.
- [ ] **Vercel production variables** (P3-S13, P5-S22 second half): `NEXT_PUBLIC_VEIL_GALLERY` and `NEXT_PUBLIC_VEIL_DEV` are not set.
- [ ] **Push reminder keys** in Vercel production: Task 6.2's "Owner setup" (VAPID keys, `CRON_SECRET`, `FIREBASE_SERVICE_ACCOUNT` if missing).

## In person (before the merge)
- [ ] **Screenshot pairs** from Task 8.2's report accepted.
- [ ] **Device checklist** (`redesign/device-checklist.md`, Task 8.5) run on an installed iPhone, Android Chrome and a Mac.

## After the merge
- [ ] **Reminders with real keys** (Task 6.2's Done when): trigger the cron route by hand; a "1 day before" reminder arrives once on a Mac and an installed iPhone, and a second run sends nothing.
- [ ] **Installed-phone checks** for the service worker and install card (Tasks 6.1, 6.4) on the first HTTPS deploy.
- [ ] **Phase 9:** change its "waits for launch" Done cells in §7.0 to `[ ]`, so `autorun` picks it up after the launch window.
