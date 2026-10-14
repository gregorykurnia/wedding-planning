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
