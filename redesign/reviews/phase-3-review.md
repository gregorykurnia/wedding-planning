# Phase 3 review

**Date:** 2026-10-16 · **Model:** Opus 5.5 High (the §7.0 pick is Opus 5.5 Medium; this session ran one row higher) · **Diff:** `4d4e692..49eb0e2` on `redesign` (Tasks 3.0–3.12), reviewed in lane t1.
**Result: passed after fixes.** The first pass found four blockers: text typed after Enter was lost when the save came back (Task 3.4), the "Edit categories" chip collapsed in a focus row that overflows (Task 3.3), item rows had no failed state for a one-tap change that guide §6.1 names (Task 3.12), and `HeadcountsCard` and `SidesCard`, which §3 gives to Task 3.12, weren't built (the Phase 3 Done-when). All four were fixed in this session, with six should-fix items (see "Fixes"). The rest are tracked below.

Five parallel reviewers each read one area against `ui-implementation-plan.md`, the design guide and the prototype: 3.10 (uploads), 3.4 and 3.8 (fields, save-as-you-go, sheets), 3.11 and 3.12 (agenda, month, task, item and guest rows), the visual ports 3.1, 3.2, 3.3, 3.5 and 3.6, and 3.0, 3.7 and 3.9 with the §3 component map against the gallery. Each blocker was then checked by reading the code (and, for the chip, in headless Chromium at 390px).

## Verification run

| Check | Before fixes | After fixes |
|---|---|---|
| `npx tsc --noEmit` | clean | clean |
| `npm run lint` | 8 errors, the same 8 as Phases 1 and 2; the new UI's files have none | no new errors |
| Style check, old-names check | pass (215 files, 53 terms) | pass (217 files) |
| `npm test` (model) | 44 files, 740 pass | 745 pass (5 new) |
| `npm run test:emulator` | 181 pass, 1 skipped (the real-Cloudinary test) | 183 pass, 1 skipped (2 new) |
| `npm run build` | passes | passes |
| `npm run test:e2e` | 193 pass, 2 fail (below) | full run 195 pass, 1 fail: `veil-parts.spec.ts` counted "The one we’re leaning towards" loosely, so it also matched the preferred package’s new screen-reader text; the count is now exact. Then the touched specs (parts, actions, rows, emulator fields, master list) pass 48 of 48 |

The two e2e failures before the fixes:
- `tests/e2e/emulator/veil-fields.spec.ts`, the forced-failure test: "Make saves fail" matched two switches once another gallery section had one (a strict-mode error, not an app fault). The demo spec was scoped to `#section-3-4` in `19e3036`; the emulator spec wasn't. Now it is.
- `tests/e2e/emulator/master-list.spec.ts` (the old UI): the editor wasn't focused after adding a row. No Phase 3 change touches the old UI. It passed in the full rerun and again on its own, so it was a flake. If it recurs, wait for the editor before focusing it.

## Blockers (all fixed)

**B1. Text typed after Enter is lost when that save comes back** (Task 3.4, `src/lib/model/save-state.ts`). `FieldInput` saves on Enter and keeps focus. If the user typed on while the save ran, the `saved` case dropped what was in the field and showed the saved value: type "abc", Enter, type "def", and the field went back to "abc" with nothing to say "def" was gone.

**B2. "Edit categories" collapses in a focus row that overflows** (Task 3.3, `src/veil/parts/chips/focus-chips.tsx`). The dashed chip had no `.chip` class, so it was the one chip allowed to shrink: at 390px with six categories it drew 39px wide and 206px tall. Vendors, the shortlist and the schedule would all have inherited it. The e2e check only compared the chips' tops.

**B3. Item rows had no failed state for a one-tap change** (Task 3.12). Guide §6.1: "A row that saves on one tap (an RSVP, a task step, an item's star or tick) keeps the choice, rings the row in rose and puts a line under it". `ItemRow` could show a failure only for the name or the vendor, and the gallery's "Make saves fail" skipped the star, the tick, the event chips and the person. Done-when "one-tap saves show the failed state when forced" was met only for the RSVP switch.

**B4. `HeadcountsCard` and `SidesCard` weren't built** (§3 row 4.29, "Built in 3.12"; Phase 3 Done-when "every component in §3 renders"). Neither Task 3.12's note nor the change log deferred them.

## Should fix (open)

Fields and sheets (Tasks 3.4, 3.8), before the Phase 4 edit sheets:
- **S1.** Done in an edit sheet drops the press and can lose focus (`sheet.tsx`, `EditSheetActions`). After typing, pressing Done blurs the field, which starts a save and disables Done before the click lands; tabbing to Done disables it while focused, and Chrome moves focus to `body`, outside the sheet's Tab trap. Use `aria-disabled` (as `Btn` does when busy), or have Done commit, wait and close.
- **S2.** A sheet's busy flag is one on/off value shared by every holder (`sheet.tsx`, `confirm.tsx`). A field save and an inline removal in the same sheet clear each other's hold, so Escape can close the sheet mid-save, or unmount an inline confirm whose removal then fails unseen. Count holders per sheet.
- **S3.** A failed notes save looks saved after Done (`notes.tsx`): the editor closes at once and the view shows the typed text with no ring or Try again. Keep the editor open while the field has failed, or show the failure line under the view.
- **S4.** `readAmount` refuses "Rp 1.000.000,-" (the usual way to write a price), and rounds decimals: "1.5" is Rp 2, "12,5" is Rp 13; "-0" gives `-0`. Accept a trailing `,-` or `,00`, refuse a non-zero decimal part, normalise `-0`. Ties to G16/N16.
- **S5.** Confirms still throw away the `WriteError` (`confirm.tsx`), so a demonstration-mode or offline write reads "Couldn't do that. Nothing was changed." `InlineRename` has no demonstration-mode guard. Ties to N14.
- **S6.** A sheet kept open across a route change because it was busy stays open over the new screen once it stops being busy (`sheet.tsx`). Re-check the path when busy clears.
- **S7.** An edit sheet's failed change is still lost on Escape, the scrim or a route change, with no sign (G18/N18, provisional). Build the N18 answer before the Phase 4 edit sheets.

Search, ordering and paging (Task 3.7):
- **S8.** "Show everything", "Back to our order" and the last "Show more" remove the button just pressed, so keyboard focus falls to the page. Move it to the search field, or to the first new row.

Uploads (Task 3.10):
- **S9.** Edits made in the upload sheet after an upload can be lost: they save on blur or Enter only, and closing the sheet (Escape, scrim) may not blur; reopening clears a `done` entry even when its rename failed. Commit changed fields on close, and keep entries with `fieldErrors` in `clearFinished`. Ties to G17/N17.

Rows (Tasks 3.11, 3.12):
- **S10.** The agenda's Record payment, the month's Earlier and Later, and Back to today are still local copies of `Btn` and `TextLink` (the 3.11 note said "until 3.3"). Swap them in.
- **S11.** Only one failed field can show at a time (`ItemList`'s `failed`, `TaskRow`'s `failedStepId`): a second failure clears the first row's ring while its typed text stays, so it looks saved. Take a set of failed ids.
- **S12.** Move up or down from the ⋯ menu loses focus when the row moves down and announces nothing. Route it through `ItemList` with the same refocus and live-region line as Alt+↑/↓.

Gallery (Task 3.0):
- **S13.** Nothing tests that the gallery is absent when `NEXT_PUBLIC_VEIL_GALLERY` is off (it was checked by hand in 3.0). Add a model test of `next.config.ts`'s rewrite, and confirm the variable isn't set in Vercel's production environment.

Carried from the Phase 2 review, still open:
- **Phase 2 S5 and S6** (the top bar inside `main`, no shared page column) were moved to Task 3.1, which didn't take them. **Do them before Tasks 4.1 and 4.2**, the first screens. *Done 2026-10-16 (lane t1): the gate draws the top bar and the demonstration banner before `main`, and screens sit in `PageColumn` (`src/veil/shell/page-column.tsx`).*
- Phase 2 S1–S4 (session re-probe, partner and presence clocks, a removal the partner undoes) are unchanged.

## Minor

- Fields: Tab from a changed, failed field to its Try again commits and removes the button as focus lands; a sheet's failed input has no `aria-describedby` to the save line; `Check` never sets `aria-invalid`; `draftOf` sticks on typed text if the saved value was `undefined` when the save came back; the rose `Banner` has no `role` for a failed create; the inline confirm drops focus after Keep it or a finished removal.
- Rows: Enter and then leaving a row field saves twice; `onReorder` gets only the rows on screen, which breaks with paging (Task 4.23); a failed move can steal focus later; `useDraft` can't tell a rolled-back write from a partner's edit (Phase 4 should pass the typed value, as `useAutosaveField` does); a half-typed step date clears the date; each arrow press on the RSVP switch is a save with its own toast; a "work on next" pill does nothing when its row isn't drawn; the task tick is a control inside `<summary>` (as the prototype has it).
- Uploads: Try again after only the filing failed shows "Uploading, 0%"; a create that times out but lands later shows the file twice until Try again; a finalist's main package (`partId: "main"`) would be filed under "… › Main" and miss the old list (map it to the finalist, Task 4.13); file blobs stay in memory for the screen's life; progress is announced only while the sheet is open; the drop zone flickers over its children; raw `12px` and `2px` in `files.module.css` where tokens exist; the gallery against the emulators sends to real Cloudinary.
- Search and device parts: the venues demo doesn't reset paging on a filter; the guest-count range field reads with the money reader; `CountLine` is a live region, so every keystroke is read; the WhatsApp link lacks `noreferrer`; the notification state switches its phone or computer word at 759px (tokens use 760px), as `screen-state.module.css` does; the device demo's demonstration switch also disables the gallery's own picker.
- Visual ports: what-if Edit · Remove uses `--space-5` where `--gap-actions` exists; the next card's name and after line lack `dir="auto"` and `overflow-wrap`; focus chips lack `dir="auto"`; the booking entry keeps its 24px column gap on a phone (prototype 14px); the preferred menu-card line shrinks to 15px on a phone; `PackageLines` has no "and N more packages" (Task 4.13); `ChipGroup`'s `disabled` takes the group out of the Tab order in demonstration mode.
- Styles: several raw px sizes where a token exists (agenda, month, tasks, items, confirm, sheet, next card, focus chips). The style check only looks at colours. Task 3.6 mapped such values to the nearest token; the other parts should do the same in Phase 8.

## Done-when per task

| Task | Done-when met? |
|---|---|
| 3.0 | Yes; S13 open |
| 3.1 | Yes (Phase 2 S5 and S6 weren't taken; see above) |
| 3.2 | Yes (judged against the guide and prototype; no line of its own) |
| 3.3 | **No** before the fix (B2); yes after |
| 3.4 | **No** before the fix (B1 loses typed text); yes after |
| 3.5 | Yes |
| 3.6 | Yes, with the preferred package now named for screen readers |
| 3.7 | Yes; S8 open |
| 3.8 | Yes; S1–S3, S5–S7 open |
| 3.9 | Yes |
| 3.10 | Yes; three should-fix items fixed here, S9 open |
| 3.11 | Yes; S10 open |
| 3.12 | **No** before the fix (B3, B4); yes after |
| Phase | **No** before the fix (B4); yes after |

## Escalation (§7.0)

The review rejects Tasks 3.3 (B2), 3.4 (B1) and 3.12 (B3, B4). Their fixes move one row up: 3.3 from Haiku 5.5 Max to **Sonnet 5.5 High**, 3.4 and 3.12 from Sonnet 5.5 High to **Opus 5.5 Medium**. All three were fixed in this session on Opus 5.5 High.

Suggested follow-up sessions, before the Phase 4 tasks that use them:
1. ~~Phase 2 S5 and S6 (layout slot for the top bar, a page column part) · Sonnet 5.5 High. Before 4.1 and 4.2.~~ Done 2026-10-16.
2. S1–S3, S5–S7 (sheets, notes and confirms) · Opus 5.5 Medium, since it's save and focus timing. Before 4.6, 4.9 and the other edit-sheet screens; S7 after N18 is designed.
3. S4 with the N16 follow-up (money input); S9 with the N17 follow-up (uploads).
4. S8, S10–S12 (focus and local copies) · Sonnet 5.5 High, or inside the screen tasks that first use them (4.11, 4.20, 4.23).

## Fixes (2026-10-16, same session)

- **B1 fixed.** `fieldReducer`'s `saved` case keeps text typed after the save began, so the field shows it and saves it when it's left or Enter is pressed again. New reducer test "keeps text typed after Enter while that save ran".
- **B2 fixed.** The dashed chip gets the focus row's chip class. The phone e2e test now also checks that every chip in the row has the same height.
- **B3 fixed.** `ItemRow`'s `failedField` also takes `events`, `person`, `next` and `confirmed`: that control gets a rose ring (as the RSVP switch does) and the row's line reads "Couldn't save the change to Wedding cake. Your choice is kept. Try again", following the guest row's sentence in guide §6.1. The gallery's "Make saves fail" now fails these too, keeping the choice. One markup test and one e2e test (the star).
- **B4 fixed.** `CountCards`, `HeadcountsCard` and `SidesCard` in `src/veil/parts/guests/counts.tsx`, with `headcountRows` and `notCountedLine` in `guest-text.ts`, drawn from the model's `headcounts()` and `sides()`; the headcounts use 3.6's `Tally`. Tokens only: the prototype's 18px card gap, 19px side titles and 6px figure gap take the nearest token. Gallery section 3.12 shows both above the guest rows; two markup tests. §3 now lists them, notes that `ItemRow` holds its handle and menu, and says which file parts wait for 4.19.
- **Uploads.** Each file keeps the place it was added to, so a screen that moves to another folder mid-upload doesn't move it (`upload-queue.ts`; model test). A record's folder, a part's folder and each root are made once when first uploads start together, and a root is only looked for when the record's folder is new (`uploads.ts`; emulator test with a booking, its part and another booking at once). A finished upload logs `file.uploaded`, so the partner sees "Bella uploaded …" (emulator test).
- **`Btn`.** A busy button's click is held with `preventDefault`, so a busy submit can't send its form twice.
- **`PackageLines`.** The preferred package says ", the one we're leaning towards" to screen readers, as the prototype does.
- **Partner demo.** `/new/gallery/partner` writes activity and presence only against the emulators; elsewhere its buttons are off with a note, so a dev run with the real `.env.local` can't send the partner a made-up toast.
- **Test.** The emulator fields spec looks for its switches inside `#section-3-4`.
