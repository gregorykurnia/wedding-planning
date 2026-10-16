# Decisions

## Stage 1
- Mock data uses Indonesian thousands separators (Rp 948.800.000) and funders named "Greg", "Bella", "Greg's family", "Bella's family" and "Not assigned" (see P2). The separators are still a placeholder until the owner confirms them.
- "Still to pay" is worked out the same way everywhere: price minus paid. An overpaid booking makes it negative and is flagged on its own (B5, B7).

### Round 1: all three rejected (2026-10-14)
The owner's reasons: "too childish, not beautiful and aesthetic enough, very generic, fonts look kinda weird". They also said the directions don't feel like a wedding, the colours felt wrong, and there were too many numbers.
My reading: all three were finance dashboards in different colours. Saturated primary colours read as childish, the quirky fonts (Archivo Expanded, Kalnia, Geologica) read as odd, and every screen showed everything at once.
For round 2: "bright" now means light and luminous (lots of white, with wedding colours such as blush, champagne, garden green and cornflower blue), the typefaces are classic and well made, there are cues from wedding stationery, and the three directions spread from minimal to full, as the owner asked.

### Round 2: chosen direction is D, Veil (2026-10-14)
The owner picked **Veil** with no mix. Their reasons: it's calm with one thing at a time; they like the colours and the glow (white lit by blush and champagne, with rose and gold accents); and it feels like a wedding (invitation-like, centred, stationery).
They didn't single out the fonts (Cormorant Garamond + Jost). Keep them for now, but treat them as the part most open to change.
What this means for the prototype: keep every screen to one main figure or job with details one tap away; keep the colour and glow; keep the stationery feel even on dense screens (vendors, documents, guests).

## Stage 2

### Session 1, budget group (2026-10-14)
- **Light only.** The studio process asks for light and dark, but the brief says "Dark mode isn't needed" and the app should not look dark. I followed the brief. Say if you want dark mode anyway.
- **States that don't exist for this app:** read-only, shared-link visitor and role restrictions (the brief: two people, identical full access, no shared links). "Restricted" only means "account not allowed" at sign-in, which comes with the sign-in group. Bulk selection: no budget story acts on several bookings at once, so there's none here.
- **One figure per screen** carries over from Veil: the budget shows what's still to pay, payments due shows what's late (or, if nothing is, what's due soon), a booking shows its own "still to pay", and what-if shows the projected total. Details sit one tap away.
- **Stationery cues on the dense screens:** booking parts are listed like a printed menu, with dotted leaders. Payments due use small date cards like place cards. What-if amounts are in italic with dashed leaders and a dashed thread, because they aren't real money yet.
- **B1** shows on each booking as "Booked from Vendors / Venues on …". The automatic creation itself happens in the vendor and venue screens (a later session).
- **B12:** a booking keeps its estimate as a separate field, and a sentence under the details compares it with the agreed price. Bookings can also be ordered by "Difference from estimate".
- **Search on bookings.** No B story asks for it, but with hundreds of bookings it's the quickest way in, and it gives "no results" a home. It's an addition, not a change of concept.
- **Splitting a booking:** what's already paid becomes a "Deposit" part, and the rest becomes "Balance" with the old due date and next step. Undo is available.
- **Removing a funder** moves their costs to "Not assigned". Payments already recorded stay as they are, with undo.

### Proposals for the owner
- **P1: book a what-if item.** *Declined by the owner (2026-10-14): "no need".* What-if items stay apart from bookings, with no "Book it" action.
- **P2: the "us" funder.** *Adopted by the owner (2026-10-14).* "Us" becomes two funders, Greg and Bella, alongside Greg's family and Bella's family. The mock data now uses all four.

### Session 2, vendors group (2026-10-14)
- **Vendors, Shortlist and Venues sit together** under the menu's "Vendors", with one quiet sub-navigation. Venues are done and rarely visited, so they don't get their own menu entry. The venues screen leads with the booked venue.
- **Stage** is drawn as a short gold thread of steps, the same device as the budget's thread. Ruled-out vendors and venues are struck through in grey, so they're easy to tell apart without being hidden (F10). Venues hide ruled-out ones by default, with a switch (F4).
- **Keen** is a small heart, the only rose element in a vendor row (F11).
- **Price options and packages** are written like a printed menu, with dotted leaders. The one you're leaning towards is marked in gold italic, and its price becomes the screen's one figure (F8, F17).
- **WhatsApp** opens a chat in one tap. Numbers starting with 0 are read as Indonesian (+62) (F7).
- **Export** downloads exactly the vendors in view as a CSV that opens in Excel (F15).
- **Categories:** standard categories can't be renamed. Your own can be renamed or removed, and removing one moves its vendors to "Other" (F14, F23).
- **Choosing a vendor** (stage "Chosen"), booking a finalist or marking a venue "Booked" creates the booking straight away and offers to open it. The noted price becomes the booking's estimate, which keeps it apart from the agreed price (B1, B12).
- **The shortlist keeps its own copy** of a vendor. A line says so, and that files added to the vendor appear there too (F16, F20).
- **No "remove vendor" or "remove finalist"**: no story asks for it. Ruling out does the job. Say if you want removal.

### Session 3, documents group (2026-10-14)
- **The owner asked to continue in the same session** rather than start a fresh `./start` session for this group.
- **"Meeting notes" start.** Notes during a vendor meeting have to be fast, so the documents screen offers "Meeting notes" next to "New document". It opens with the cursor after "Meeting: " in the title, today's date, a prices table with a growing total, and a next-steps list. It's a starting layout, not a new kind of record. Say if you'd rather not have it.
- **Save state is always in view:** at the end of the toolbar on a computer, and at the top of the screen on a phone (the toolbar sits above the keyboard). "Not saved yet" is gold, "Saving" spins, "Saved" has a sage tick, and "Couldn't save" turns rose, says the text is still there, and offers to try again (R5).
- **Delete really deletes** (R7). The warning says it can't be undone and that it's gone for both of you, so there's no undo toast here, unlike everywhere else.
- **Totals:** columns are A, B, C… and rows count from the title row, as in a spreadsheet. A growing range like `B2:B` runs to the last row and stops above the total itself, so a total at the bottom never counts itself. Totals show in gold so they read as worked out, not typed. Rupiah formatting carries over when the cells added up are in rupiah.
- **Sorting** leaves the title row and any row holding a total where they are, so "Total" stays at the bottom.
- **Fonts in documents:** Jost (default), Cormorant, Georgia and a monospace. They match the app's own type, plus a plain serif and a code face.

### Session 4, files group (2026-10-14)
- **Files live beside Documents** under the menu's "Documents", with a Documents/Files sub-navigation, the same pattern as Vendors/Shortlist/Venues.
- **Folders look like envelopes**, a small stationery cue. The path above the title always says where you are; past four levels the middle folds into "…", which you can tap to open.
- **Delete folder only when empty** (R8). A folder with things in it says what's inside and asks you to move or delete them first.
- **Deleting a file is for good** (R13). The warning says how much storage it frees and that it can't be brought back, so there's no undo. Moves, renames and folder deletes do have undo.
- **Uploads ask for name, category and description per file while they upload** (R10). Nothing waits on them, so a quick upload is still quick.
- **No storage meter.** The inventory mentions free storage limits but not their size, so the screen only shows how much is used ("14 files, 33.1 MB in all"). Tell me the limit if you want a meter.

### Session 5, schedule group (2026-10-14)
- **One figure for urgency** (S6): the number of things late or due today, in rose when anything is late, with a sentence naming tomorrow and the next 14 days.
- **"Late" heads the agenda** as its own group, so nothing overdue hides inside a past day. Late payments keep the dark "Record payment" button; the others are quiet.
- **Payments and tasks in the agenda are read-only reflections.** Tapping one opens its booking or task (S7), so it's only ever edited in one place.
- **Event kinds** are colour-quiet: payments in gold and tasks in sage, as small labels; everything else in ink. The month dots use the same colours plus rose for late.
- **Notification state lives where you set a reminder** (S10). It also belongs in settings, which comes with the sign-in group.
- **Tasks sit with the schedule** (Agenda, Month, Tasks), because tasks with dates already appear in the agenda.

### Session 6, wedding items group (2026-10-14)
- **A denser screen, still Veil.** This is the one screen that works like a table, because people edit many rows quickly. It keeps the Veil frame anyway: one confirmed figure with the thread, a "To work on next" card, and rows that read as text until touched.
- **Work on next is a gold star; confirmed is a sage tick.** A marked row also gets a champagne wash and a gold edge, so it stands out in a long list (T3).
- **Sorting is temporary** (T6). While a sort or filter is on, drag handles are hidden so nobody reorders a sorted view by mistake, and a gold note offers "Back to our order".
- **Adding several items** takes one per line in a sheet. New items copy the events and person of the row they're added under, since related items sit together.

### Session 7, guests group (2026-10-14)
- **Headcounts leave out anyone not attending** and include plus-ones. "Reception" includes "reception if space allows", shown as a smaller line inside it. "Unsure, living abroad" is counted apart (G3).
- **Both sides** read "groom" or "bride" in the connection text (G4). Friends count as family; colleagues, clients, business and partners count as business. Anyone whose connection names neither side (a neighbour, the parish priest) is counted apart, with a note, so every guest is counted on one side at most. The guest form hints to mention groom's or bride's.
- **Guest numbers are shown in gold italic** and never reused after a removal (G6).
- **RSVP is a three-way switch on every row**, big enough for a thumb, because RSVPs come in while you're out (G8).

### Session 8, overview, sign-in and settings (2026-10-14)
- **The overview is home**, and your names at the top lead there. Its one figure is the days to go, the largest number in the app, under your names in gold italic, like the top of an invitation.
- **"Time gone" needs a start date.** O1 asks how much of the preparation time has passed, so the planner needs to know when you started. The prototype uses the day the planner was set up (1 March 2026 in the mock data). Tell me if you'd rather enter a date yourselves, such as the engagement.
- **Sign-in shows nothing about the wedding** until you're in, because the brief requires signing in before anything is shown. It's called "Our wedding planner" for now, since the name is still open.
- **Not connected**: the sign-in screen offers demonstration mode instead of a sign-in form, and every screen in demonstration mode carries the same gold banner.
- **Installing** is a short how-to in settings, plus a one-time, dismissible suggestion on the overview on a phone. There's no pop-up asking straight away.

### Owner feedback (2026-10-14)
- **No repeated page name in the top bar.** The owner pointed out that the small page name at the top repeats the big title ("Documents" above "Documents"). The top bar now shows only your names and Menu. The small label stays on the budget screen alone, because that screen has no big title: its one figure is what's still to pay.
- **The budget screen gets a title too** (owner's choice, 2026-10-14). The lone "Budget" label in the top bar is gone, so the top bar is the same on every screen: your names and Menu. The budget screen now opens with a "Budget" title above "Still to pay", like every other screen.

## Stage 3

### Design guide and tokens (2026-10-14)
- **The guide describes the prototype as it is.** Where screens disagree, nothing was changed; each disagreement is listed below and in `design-guide.md` §10, for the owner to decide.
- **Light only**, as in stage 2. The guide and `tokens.css` have no dark tokens.
- **Tokens are named by role** (`--color-text`, `--accent-attention`, `--text-row`…), with the prototype's names in brackets. Two values are marked PROPOSED and apply only if the owner agrees: `--accent-gold-text-on-tint` (question 6) and `--color-control-outline` (question 14).
- **Not frozen.** No version or date yet; that's stage 5.

### Open questions for the owner (stage 3)
1. **Preferred package mark:** gold italic on vendor and finalist screens, a rose ♡ on shortlist cards. Suggest gold italic everywhere.
2. **Save button in sheets:** screens save as you go, but the event, guest, what-if, venue, price-option and package sheets need Save, and Cancel/Close discards. Suggest those sheets save as you go and end with Done, as the file sheet does.
3. **Demonstration mode:** some screens disable "add" up front, others disable only inside the sheet, and items' "Start with common items" still fills the list. Suggest one rule: open the sheet, disable only the final button.
4. **"Show 100 more" vs "Show more":** suggest always giving the number.
5. **"Not attending" colour** `#8d7b83` is off-palette and 3.97:1 with white. Suggest muted ink (5.68:1).
6. **Gold text on champagne tints** (gold flags 4.21:1, demonstration banner 4.40:1) is below AA. Suggest `#7d5f27` on tints only.
7. **Item column heads** say "Next" and "Done" for "Work on next" and "Confirmed". Suggest "Confirmed".
8. **Who pays sub line** says "each family", but Greg and Bella are funders too (P2). Suggest "each of you and your families".
9. **Overpaid:** a booking shows "Overpaid by" with a positive figure; the budget shows "Paid beyond what's committed" with a negative one, and puts the minus after "Rp". Suggest the booking's way, with the minus always first.
10. **Very long figures:** the budget shrinks them, the other screens wrap them. Suggest shrinking everywhere.
11. **Width jump:** Agenda and Month are wide, Tasks is narrow, though they share a sub-navigation. Suggest one width.
12. **Number grouping:** money uses dots (Rp 1.206.000), counts use commas (1,206 bookings). Suggest dots for both, or confirm commas are fine.
13. **Demonstration mode still shows "Greg & Bella" and the real countdown.** Suggest neutral placeholders.
14. **Small or faint controls:** task tick (22px), step checkboxes (18px) and item event chips (~23px) are under 24px. Idle heart, handle and tick ring are 2.77:1, and payment dots 2.36:1. Month cells don't announce today, the selected day or the wedding day. Suggest the fixes listed in the guide.
15. **Silent caps:** tasks stop at 200, file search at 200, with no "Show more". A long email in the menu doesn't wrap.
16. **Files on a record** don't ask for name, category or description, unlike Files (R10), and word "too large" differently. Suggest the same upload sheet, filing into a folder named after the record.
17. **Category rename and add have no undo,** unlike funder and folder renames. Suggest undo on all renames.
18. **Schedule "Payments" filter** leaves out your own events of the kind "Payment". Suggest including them.
19. **Shortlist ordering has no direction word,** unlike every other list. Add it, or confirm that's deliberate.

### Owner's answers to the stage 3 questions (2026-10-14)
All 19 were answered in one message. Each one is carried into the prototype, `design-guide.md` and `tokens.css`.
1. Preferred package: **gold italic everywhere**, so the rose ♡ on shortlist cards goes.
2. Sheets that edit an existing record **save as you go and end with Done** (event, guest, what-if item, venue, price option, package). Sheets that create something keep their Add button.
3. Demonstration mode: **actions stay enabled and open their sheet; only the final button is disabled**, with the line "Demonstration mode: adding is turned off." One-tap actions with no sheet ("Start with common items", "Copy to the shortlist", "Save the date") count as final buttons.
4. Paging always gives the number: **"Show 60 more"**.
5. "Not attending" uses **muted ink**.
6. Gold text on champagne tints uses **`#7d5f27`**.
7. The items column is headed **"Confirmed"**.
8. Who pays sub line: **"What each of you and your families have paid, and what's still to pay."**
9. Overpaid budget follows the booking: **"Overpaid by" with a positive rose figure**, and the minus always comes first ("−Rp").
10. Very long figures **shrink** on every screen.
11. **Tasks uses the wide column** like Agenda and Month.
12. **Dots** group thousands in counts too ("1.206 bookings").
13. Owner: "whatever", so the suggestion stands: demonstration mode shows **"Our wedding planner"**, no names, no countdown and nobody signed in.
14. The accessibility suggestions stand: targets at least 24px, idle outlines in `#9a888f`, payment dots in gold ink, fuller month-cell labels.
15. Tasks and file search page with **"Show N more"** and a count; the menu's email wraps.
16. "Add files" on a booking, vendor, finalist or venue **opens the same upload sheet as Files**, with name, category and description per file. It files into a folder named after the record, and the "too large" wording is the same everywhere.
17. **Undo on all renames** (vendor categories and file names gain it).
18. The schedule's "Payments" filter **includes your own events of the kind Payment**.
19. The shortlist's Order by gets the **Ascending / Descending** word.
- **Applied (2026-10-14):** all 19 answers are now in the prototype, `design-guide.md` and `tokens.css`. The shared upload sheet moved into `assets/app.js` so Files and every record use the same one.

### New open questions (stage 3, after the answers)
20. **Decimals:** thousands now use dots, but decimals still use a point ("4.8" ratings, "33.1 MB", "98.8M followers"). Suggest commas for decimals ("4,8"), so a dot always means thousands. Document tables already accept "2,5".
21. **Faint placeholders:** meaningful placeholders ("Vendor not known yet") are 3.70:1 and the document's "Untitled" is 2.77:1, below AA. Suggest full muted ink, keeping the italic.
22. **The link sheet still has Save:** in a document, "Edit link" applies only on Save, unlike every other editing sheet now. Suggest keeping Save there, so a half-typed address doesn't break a working link; or make it save as you go.

## Stage 4

### Coverage audit (2026-10-14)
- **The audit read the prototype's code, not the guide.** `coverage.md` is the result. It maps all stories and states, and lists what was fixed.
- **What-if parts (B8, B10).** The inventory says what-if items are splittable, with who would pay per part. The prototype only displayed parts. Now a what-if item splits into two parts, parts can be added and removed, and removing down to one part merges it back into a single item. The Add sheet gained Category.
- **One failure pattern for sheets.** A change that didn't save keeps what was typed and shows "Couldn't save. What you typed is kept. Try again" in the sheet's save line. Rows that save on one tap (an RSVP, a task step) do the same under the row.
- **Busy has removing and restoring.** The confirm button reads "Removing" or "Deleting" for a moment, and Undo reads "Restoring".
- **Files on parts and packages use the shared upload sheet**, filing into a folder named after the record and the part or package, like every other record (question 16).
- **Not changed:** the studio process asks for dark mode, read-only, shared-link and bulk-selection states. None applies (brief and inventory); they are listed as not applicable in `coverage.md`.

### Open point for the owner (stage 4), decided at the freeze
23. **F16 and "next step".** The inventory says copying a vendor to the shortlist brings across its next step, but a vendor (F6) has no next-step field, so the finalist starts with none and has its own. Suggest keeping it that way and dropping "next step" from F16's list. Or give vendors a next step too; say which.

## Stage 5

### Freeze (2026-10-14)
- **The owner approved the design guide** and took the designer's suggestion on questions 20–23.
- **20 Decimals take a comma.** Built into the prototype (`dec()` in `assets/app.js`): ratings "4,8", sizes "9,9 MB", "98,8M", "12,3k". Data strings changed too.
- **21 Placeholders use full muted ink**, keeping the italic (field, item vendor and document title placeholders now at full strength; 5,68:1).
- **22 The link sheet keeps Save**, so a half-typed address never replaces a working link. No change.
- **23 A finalist keeps its own next step.** No change; the owner can drop "next step" from F16 in the inventory on their side.
- **`design-guide.md` and `tokens.css` are v1.0 (2026-10-14).** Any later change bumps the version and is logged here. The open needs process (`needs.md`) is the way new stories arrive.


## Open needs

### v1.1 (2026-10-16): N1–N14
Designed in one session at the owner's request ("Design the open needs N1 to N14"). N15–N18 are still open. `design-guide.md` and `tokens.css` are now **v1.1 (2026-10-16)**. Nothing was seen rendered (the browser is blocked here), so the owner should click through `prototype/index.html`, starting with `identity.html`.

### N1: its own name, mark and colours on every device
- **Mark:** the ribbon knot (the planner's quiet-moment mark) drawn heavier, in gold ink on a tile lit like the page (blush top right, champagne bottom left). Four files in `prototype/assets/identity/`: any-purpose icon, maskable, monochrome (Android themed icons, badges) and favicon. PNG sizes for the build are listed in the guide (4.31).
- **Name:** "Gregory & Bella's Wedding" (the brief) where there's room; **"Greg & Bella"** under the icon and in the Dock (question 24). Tabs read "screen · what the top bar says", so they never show names before signing in or in demonstration mode.
- **Colours:** blush `theme-color` for the browser and window bar, white opening screen. Never rose on the mark.
- New: `prototype/identity.html` (where it shows: home screens light and dark, Android themed, opening screen, lock-screen reminder, tab, installed window, Dock), `prototype/manifest.webmanifest`, the icon links on every screen (`assets/app.js`), tokens section 15.

### N2: an address that leads nowhere, or something unexpected
- `prototype/notfound.html`: signed in, the shell stays, with **Open the menu** · **Go to the overview** and three doors; signed out, nothing about the wedding shows and the way back is **Sign in**.
- A detail screen opened from an old link now says "This booking isn't here" (vendor, finalist, document likewise). Before, a booking or document from an unknown link said the partner had just removed it, which was made up. "Removed by Bella" now shows only when that just happened.
- `?state=crash` on every screen: "Something went wrong… Everything you've saved is safe; only this screen didn't open." with **Go to the overview** and **Try again**.

### N3: which name belongs to whom
- Each name is tied to an account the first time it signs in: "Welcome… Which of you is this?" with the two names (`signin.html?state=whoami`), or the two name fields if none are set yet (`whoami-new`). Asked once; the second account gets the other name.
- Settings explains the pairing under the two accounts and offers **Swap them** (with undo) for a mix-up.
- A change from your own other device arrives in your name with your initial in champagne ("You recorded … on your other phone", `budget.html?state=sync-self`); the partner's stays blush. It's never reported as the partner's.

### N4: the Google window closed, blocked or failed
- `signin.html?state=google-waiting`: the button says "Waiting for Google", a note says to finish in the Google window (it may be behind this one), with **Cancel**; email stays usable, so nobody waits on nothing.
- `google-closed` (calm), `google-blocked` (rose, how to allow pop-ups, or use email), `google-failed` (rose, nothing changed, try again or use email). The button reads **Continue with Google again**.

### N5: the spreadsheet holds what we keep, named as the planner names it
- 18 columns in the order of the vendor screen: Name, Category, Stage, Keen on, Contact person, Phone, WhatsApp, Rating (out of 5), Number of reviewers, Leaning towards, Its price (Rp), Price options, All price options, On the shortlist, Booked, Files, Notes, Date added.
- Numbers stay numbers (whole rupiah, rating with a point, question 25), dates are year-month-day, empty fields are empty cells. UTF-8 with a byte-order mark for non-Latin names. Built into `vendors.html`.

### N6: a device that can't receive reminders
- Two new device states beside allowed, not yet allowed and turned off: **not until installed** (an iPhone in the browser: add it to the home screen first, with **Show me how**) and **never in this browser** (rose; which browsers can).
- Every note, in settings and under Remind us, says whether reminders still reach your other devices. `settings.html` and `schedule.html` with `?state=notif-install` / `notif-unsupported`.

### N7: the wedding day and the weeks after
- Overview: the day before reads "1 day to go: tomorrow"; on the day, **Today** replaces the number and Coming up becomes "Today and next"; after it, the figure is what's **still to settle** (with "Married 12 days ago…" and how many payments are left or late) until everything is paid, then **Married for** N days (question 26). No negative countdown anywhere.
- The budget's closing line: "Tomorrow is the wedding", "Today is the wedding day", "12 days since the wedding on …". Settings' date message: "That's today" / "That was 12 days ago". States `eve`, `day`, `after`, `settled` on the overview and the budget.

### N8: dates the planner doesn't know
- It says what it knows and leaves the date out: "Added directly", "Booked from Venues", "Done". Never today, never another date in its place. Blanks go last in orders and are empty cells in the spreadsheet; with no start day, the overview drops the time thread.
- Fixed in the prototype: a finished task without a finishing day used to show its due date as the day it was done. Mock data: Rumah Cincin has no booked date; "Book the church" was finished on an unknown day.

### N9: a dated thing missing what it needs
- Events need a title and a date, and can't end before they start; tasks need a title. Adding with something missing rings each field with one line on what to do, keeps everything typed, and focuses the first problem.
- Editing (save as you go): the bad change isn't saved, the field keeps what was typed and says what the schedule still holds, the save line says "1 change not saved yet: the end time", and **Done** goes to the field instead of closing. `schedule.html?state=invalid`, `new-invalid`; `tasks.html?state=add-invalid`.

### N10: removing a vendor, finalist or venue added by mistake or twice
- A rose **Remove this vendor** at the foot of a vendor, **Remove from the shortlist** at the foot of a finalist, **Remove venue** in the venue sheet. Each confirms, then gives a few seconds of undo, like every other remove.
- The confirm names what stays: a booking made from it, a shortlist copy (or the vendor behind a finalist) and its files in Files. Nothing else is touched.

### N11: only reminders that will really arrive
- Remind us offers **No reminder**, **The morning before**, **A week before, in the morning**, with "Reminders come once a day, in the morning." A morning that has gone is greyed with the reason.
- Reminders set before: a day or a week ahead carry over to the morning versions; a time of day ("1 hour before") is flagged, not silently changed: "Choose again" in the sheet with the old choice named, a line on the agenda row, a rose box above the agenda listing them, and a count in settings.

### N12: one item for several people
- "Who it's for" on a wedding item is now a people picker: tick everyone it's for; none means General. It reads as text ("Bride's mother, Groom's mother"; past two, "… and 2 more").
- Narrowing to any of them finds it, and search now covers people too ("Search items, vendors and people"). Mock data: "Makeup for both mothers", "Suits for the groom's father and brother"; `items.html?state=people`.

### N13: undo after the partner changed the same thing
- Undo shows "Restoring", then if the partner has changed it since, nothing is taken back and a 9-second toast with their initial says what they did and that it's kept: the split after a payment on it, a file move after they moved it again, a payment after they changed the booking. `booking.html?id=ayu&state=undo-conflict`, `files.html?state=undo-conflict`.

### N14: a remove or delete that couldn't finish
- The confirm stays open after "Removing"/"Deleting": a rose box "Nothing was removed." (or deleted) with the reason, and the button becomes **Try again**, focused. **Keep it** leaves everything as it was. No toast, no undo. Built once in `Veil.confirm`, so every confirm does it; `?state=removefail` is listed on booking, vendor, finalist, venues, files, schedule, tasks, items and guests.

### New open questions (v1.1)
24. **Short name** under the icon: "Greg & Bella" (suggested) or "G & B Wedding".
25. **Ratings in the spreadsheet:** a decimal point so spreadsheets read a number (suggested), or a comma to match the screen.
26. **After the wedding:** lead with what's still to settle, then days married (suggested), or days married from the first day after.

### v1.2 (2026-10-16): N15–N18 and the owner's answers to 24–26
Same day, at the owner's request ("go do the N15-N18 too"). `design-guide.md` and `tokens.css` are now **v1.2 (2026-10-16)**. All 18 open needs are designed; nothing is open.

**Answers:**
- **24:** the short name is "Greg & Bella".
- **25:** ratings in the spreadsheet use a decimal point.
- **26:** "After wedding the count ends, basically the website is unused." So **N7 changes**: after the day, the overview shows the names, "Married" and the day, with no figure and no thread (the one state without a figure). The "still to settle" and "married for" versions are gone, and `?state=settled` with them. The budget's line reads "Married on Friday 2 October"; settings says "That day has passed". The day before and the day itself are unchanged.

### N15: the couple's names as large on a phone as on a computer
- The overview names are **44px at every width** (`--text-names`; before, 30px on a phone). Line height 1.1; long names wrap instead of shrinking. The top bar's names were already 24px everywhere, now named `--text-names-top` so a size is given for both.

### N16: something typed into an amount that isn't an amount
- Every money field: words, a minus, decimals or more than 15 digits are refused. The field puts back the amount it had, rings rose and says why, quoting what was typed: "“12 juta” isn't an amount. Use digits, like 12500000. It stays Rp 12.500.000." Before, words quietly became Rp 0. Built once in `assets/app.js`, so every amount (bookings, parts, payments, prices, packages, venue costs, what-if) behaves the same. Record a payment refuses too. `booking.html?state=badamount`, `booking-new.html?state=badamount`.

### N17: a PDF that is still too big after shrinking
- Its own message, so it can't be confused with the first one: "Shrunk from 41 MB to 23,6 MB, still over 10 MB. Shrinking wasn't enough, so it wasn't uploaded. Choose a smaller PDF, or split it into parts." In the upload sheet and on a record's tiles. In the prototype a PDF over about 18 MB ends this way.

### N18: Done, Escape or a tap outside before a change has saved
- **Saving:** it waits ("Saving, then this closes") and closes once saved.
- **Didn't save, or can't yet** (N9): it stays open with "Your last change isn't saved yet. Try again or close without it"; closing without it says the change wasn't saved.
- **An add sheet with typed text,** dismissed: it stays, says it isn't added, and offers "Close without adding it". Cancel still closes at once.
- **Documents:** leaving while "Not saved yet" or "Saving" saves first, then goes; after a failed save it asks (Leave without them · Stay and try again); closing the tab gets the browser's question.
- `schedule.html?state=done-unsaved`, `doc.html?id=kebun-meeting&state=leave-failed`, and `?state=savefail` on any screen with editing sheets.
