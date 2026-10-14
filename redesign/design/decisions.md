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
