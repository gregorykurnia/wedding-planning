# Design progress

## Stage 1: directions (done)

### Round 1 (rejected), now in `archive/round-1/`
- 2026-10-14: A Ribbon, B Stubs and C Runway. The owner rejected all three (see decisions.md).

### Round 2
- 2026-10-14: three new directions for the budget screen, spread from minimal to full:
  - `directions/d-veil/`: minimal and invitation-like, one figure and one next payment
  - `directions/e-garden/`: medium, sage and greenery, centred names with a section row
  - `directions/f-atelier/`: fuller, with an arch that fills as you pay, a side menu and the full table
- Same mock budget as round 1.
- 2026-10-14: the owner chose **D, Veil** (reasons in decisions.md).

## Stage 2: full prototype (in progress)
Open `prototype/index.html` in a browser: it lists every screen and state. The dashed "Prototype" tab on each screen switches states and the stress data (`?state=…`, `?stress`).

- 2026-10-14, session 1: **budget group** (B1–B12, plus B6, S6 and the payment side of O2).
  - Screens: `budget.html` (overview), `bookings.html`, `booking.html` (in parts, single, overpaid, late), `booking-new.html`, `payments.html`, `funders.html`, `whatif.html`, plus the full-page menu, the record-payment sheet, confirm dialogs and undo toasts, all in shared `assets/`.
  - States covered: nothing yet, no results, loading, couldn't load, offline, demonstration mode, partner's change arrives, booking removed by the partner, a change didn't save (input kept, retry), adding (busy), couldn't add, uploading (progress, PDF shrinking, too large, failed), confirm and undo, late and due soon, overpaid.
  - Stress data: 1,206 bookings, 1,507 payments due, a 40-part booking, 14 funders with long and non-Latin names, RTL and CJK names, empty optional fields, a 13-digit price, 1 KB and 9.9 MB images, and the longest realistic next step.
  - Not yet: the rest of O2 (appointments and tasks coming up) belongs to the Overview group.
- 2026-10-14: the owner declined P1 and adopted P2 (Greg and Bella pay as separate funders).
- 2026-10-14, session 2: **vendors group** (F1–F24, plus B1 from vendors and venues).
  - Screens: `vendors.html` (with the add-a-vendor and categories sheets, and CSV export), `vendor.html`, `shortlist.html` (with add a finalist), `finalist.html` (packages, book it, move into Vendors), `venues.html` (with the venue sheet). Vendors, Shortlist and Venues share one sub-navigation; the menu's "Vendors" leads there.
  - States: nothing yet, no results, adding, category name taken, a change didn't save, uploading, busy (copying, booking, moving), loading, couldn't load, offline, demonstration mode, Bella adds a vendor.
  - Stress data: 2,004 vendors, 37 categories (some 40 characters long, some in other scripts), a vendor with 30 price options and a 600-character note with links, a finalist with 30 packages and 98.8M followers, and 302 venues.
- Next groups, one per session: documents (R1–R7), files (R8–R14), schedule (S), wedding items (T), guests (G), overview, sign-in and settings (O, A).
