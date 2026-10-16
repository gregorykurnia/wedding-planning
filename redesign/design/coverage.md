# Coverage

Stage 4 audit of the Veil prototype against the inventory (version 1.4) and its list of states. Done in a fresh session (2026-10-14), by reading the prototype's code screen by screen, not by trusting the design guide.

URLs are inside `prototype/`. "Guide §" points to `design-guide.md`. A state URL opens that state directly; "interaction" means you reach it by tapping.

## How this was checked, and its limit
- Every screen's script was read in full and compared with the story text. The design guide was used only to find things, never as proof.
- Every inline and shared script passes a syntax check (`node --check`). The normal, empty and stress data sets load and their counts match what the guide claims (one slip, below).
- **Nothing was seen rendered.** The sandbox blocks the browser, so layout, colour and phone-width behaviour were read from the CSS, not looked at. Please click through `prototype/index.html`, which now lists every state of every screen.

## 1. Stories

All 6 + 23 + 12 + 8 + 10 + 10 + 14 + 6 stories are covered. F2 is dropped in the inventory (no story, nothing designed).

### O. Stay on course
| ID | Where | Notes |
|---|---|---|
| O1 | `overview.html`: the days figure, "days until Saturday 20 March 2027", and a thread "Started 1 Mar · 59% of the time gone". Guide §5.2 | The time gone runs from a start date the planner needs (decision, session 8). |
| O2 | `overview.html` "Coming up" (next five dated things of any kind); `budget.html` next card; `payments.html`. Guide §5.2, §5.4, §5.8 | |
| O3 | `overview.html` doors: paid of committed, tasks done of all, guests attending of invited | |
| O4 | The same doors; each is one tap into `budget.html`, `tasks.html`, `guests.html`, `items.html` | |
| O5 | `overview.html?state=nodate` (Save the date); `settings.html` (Wedding date). Guide §5.2, §5.3 | |
| O6 | `settings.html` (the two names); names appear in the top bar and the overview. Guide §5.3 | Demonstration mode shows "Our wedding planner" instead. |

### F. Find and compare suppliers
| ID | Where | Notes |
|---|---|---|
| F1 | `venues.html`: venue sheet (name, location, estimated cost, most guests, notes). Guide §5.15 | |
| F3 | The venue sheet's stage chips: Noted, Contacted, Visited, Booked, Ruled out; stage thread on each row | |
| F4 | `venues.html`: search (name, place, notes), Stage, Costs at most, Holds at least, Hide ruled out; `?state=noresults` | |
| F5 | `venues.html` Order by Cost, Capacity, Name, with Ascending/Descending | |
| F22 | Venue sheet, Files: tiles and the shared upload sheet | |
| F6 | `vendors.html?state=capture` (Add a vendor: name, category, contact person, phone, notes); `vendor.html?id=kebun` for the rest. Guide §5.11, §5.12 | |
| F7 | WhatsApp link on vendor rows, `vendor.html`, `finalist.html`; Indonesian numbers starting with 0 become +62 | |
| F8 | `vendor.html?id=kebun` (menu card of price options, "The one we're leaning towards"); `?id=ara` (no prices); `?id=sv-long&stress` (30 options); the sheet saves as you go | |
| F9 | `vendor.html` rating (out of 5) and number of reviewers; shown on `vendors.html` rows; sort by both | |
| F10 | `vendor.html` stage chips (Noted, Inquiring, Considering, Chosen, Done, Ruled out); `?id=nusantara` shows ruled out struck through | |
| F11 | The heart on `vendors.html` rows and `vendor.html`; "Only ones we're keen on" | |
| F12 | `vendors.html`: category focus chips, search (name, notes, contact person), Order by Category, Name, Stage, Rating, Number of reviewers, Date added | |
| F13 | `vendor.html` Files; `?state=uploading` | |
| F14 | `vendors.html?state=categories` and `?state=taken`: new category, 40-character limit, "Other" stays | |
| F15 | `vendors.html` "Export … to a spreadsheet": a real CSV of the vendors in view, with a toast | |
| F23 | The categories sheet: Rename, Remove (vendors move to Other), both with undo | |
| F16 | `vendor.html` **Copy to the shortlist** (prices, contact, reviews, notes, files); the card flips to "On the shortlist" | Decision 23: vendors have no next-step field, so the finalist starts with none. |
| F17 | `finalist.html?id=f-kebun`: packages with price, what's included, reviews, next step, notes and files (files are now real, see §4) | |
| F18 | `finalist.html` Contact and popularity (reviews, Instagram followers); shown on the cards | |
| F19 | `shortlist.html` focus chips and Order by Category, with Ascending/Descending | |
| F20 | `finalist.html` Files: "Files added to … in Vendors appear here by themselves", and copied files are tagged "from the vendor" | Described and tagged, not simulated: a file added to the vendor afterwards doesn't show up on the finalist in the prototype. |
| F21 | `shortlist.html?state=adding` (name, category, first package, its price); `finalist.html?id=f-arka` | |
| F24 | `finalist.html?state=booking` (Book it, choosing a package) and **Move into Vendors** (from scratch only) | |

### B. Book and pay
| ID | Where | Notes |
|---|---|---|
| B1 | Vendor stage "Chosen", venue stage "Booked", or **Book it** creates the booking and toasts "… is now a booking · Open"; `booking.html` says "Booked from Vendors on …". Guide §5.6, §5.12 | |
| B2 | `booking-new.html` (what it is, category, agreed price, paid so far, funder, next due date, next step, files) | Files can now be attached while adding (§4). |
| B3 | `booking.html?id=ayu`: name, category, agreed price, estimate, paid so far, funder, due date, next step, files | |
| B4 | `booking.html?id=samaya` (3 instalments), `?id=rana` (an add-on); Split into parts, Add a part, Remove this part; each part has name, price, paid, funder, due date, next step and files; totals, funders and dates come from the parts | Per-part files were a dead link before this audit (§4). |
| B5 | `budget.html` (Still to pay, committed, paid, thread); `bookings.html` header; overpaid: `booking.html?id=kirana`, budget "Overpaid by" in rose | |
| B6 | `payments.html`: Late, next 14 days, then by month, each with amount, who pays, Record payment | |
| B7 | `funders.html`: paid, still to pay, per funder and for Not assigned; same maths everywhere (price − paid) | |
| B8 | `whatif.html`: projected total, committed apart from what-if, thread; items can be split into parts (§4) | Splitting had no design before this audit. |
| B9 | `bookings.html` Order by 9 fields (parts stay with their booking); `whatif.html` Order by 5 fields | |
| B10 | `whatif.html` "Who would pay the extra"; a funder per item and per part | Per part had no design before this audit. |
| B11 | `funders.html`: Add a funder, Rename, Remove (costs move to Not assigned, with undo); `?state=adding`, `?state=rename` | |
| B12 | `booking.html` Estimate field and the sentence "You estimated … The agreed price is … lower"; `bookings.html` Order by Difference from estimate | |

### G. Guests
| ID | Where | Notes |
|---|---|---|
| G1 | `guests.html?state=guest`: name, country, how connected, invited to, invitation sent, RSVP, plus-ones, food notes | |
| G2 | The guest sheet's "Invited to" chips: Both events, Ceremony only, Reception only, Reception if space allows, Unsure, living abroad | |
| G3 | The Headcounts card: both events, reception (with "of which, if space allows"), ceremony, unsure apart; attending figure; total with plus-ones in the title | |
| G4 | The Both sides card (groom's and bride's, family and business), with the uncounted people named | |
| G5 | `guests.html`: search (name, connection, country, food), RSVP and Invited to filters, Order by 9 fields; `?state=waiting`, `?state=noresults` | |
| G6 | Gold italic guest numbers; "Will be guest number 21"; never reused | |
| G7 | `guests.html?state=remove`: confirm naming the plus-ones and the headcount drop, then undo | |
| G8 | A three-way RSVP switch on every row, large on the phone; `?state=savefail` shows a failed tap (§4) | |

### T. Track every piece (`items.html`)
| ID | Where | Notes |
|---|---|---|
| T1 | Rows edit in place; "Vendor not known yet"; Add items | |
| T2 | Event chips (Reception, Holy matrimony, Sangjit, Pre-wedding), a Who it's for select (10 people), the sage Confirmed tick | |
| T3 | The gold star, the champagne row, and the "To work on next" card that jumps to the row | |
| T4 | The hero: confirmed of all, marked to work on next, the thread | |
| T5 | Search items and vendors; Confirmed or not; several events; several people; Work on next only; Show everything; `?state=noresults` | |
| T6 | Order by 7 fields; `?state=sorted` shows the note and "Back to our order" | |
| T7 | Drag, Alt + arrow keys, Move up/down; Add an item below; Add several below (one per line) | |
| T8 | Remove: confirm, undo, back to the exact place | |
| T9 | `?state=savefail`: the vendor input keeps its text, rose, with Try again | |
| T10 | `?state=first`: 14 common items with a note; "Start with common items" | |

### S. Stay on schedule
| ID | Where | Notes |
|---|---|---|
| S1 | `schedule.html?state=new`: title, kind (vendor call, organiser call, appointment, payment, deadline, other), date, all day or start and optional end, With (vendor or venue), where or call link, notes | |
| S2 | `schedule.html?state=event`: Mark completed, Cancel it, Back to scheduled, edit (saves as you go), Delete with confirm and undo | |
| S3 | `schedule.html`: your events, payments due from bookings and tasks with dates, in time order, Late first; `?state=done` adds completed and cancelled | |
| S4 | `schedule.html?view=month`: month grid with dots, Earlier, Later, Back to today, the chosen day's list | |
| S5 | Kind chips (Everything, Payments, Tasks, Calls, Appointments, Deadlines, Our events, Other) and a search; `?state=noresults` | |
| S6 | The figure "late or due today" with the sentence naming tomorrow and the next 14 days; `payments.html` figure | |
| S7 | Payment rows open their booking, task rows open the task, event rows link to their vendor or venue | |
| S8 | `tasks.html`: title, due date, notes, steps with their own date and done box, "2 of 4 steps done" with a thread | |
| S9 | Open tasks by due date (undated last); finished tasks in a disclosure, reopenable; Delete task with undo | |
| S10 | The "Remind us" select (no reminder … 1 week before) and the device note; `?state=notif-default`, `?state=notif-denied`; `settings.html` | Actual delivery of a reminder is the app's job; the prototype shows the choice and the three permission states. |

### R. Keep records
| ID | Where | Notes |
|---|---|---|
| R1 | `doc.html`: title levels, 4 fonts, 4 sizes, bold, italic, underline, strikethrough, text and highlight colours, bullets, numbered steps, quote, code, links (Cmd/Ctrl+K and a bubble), undo, redo, clear formatting | |
| R2 | The table picker up to 8 × 8; rows and columns added either side; 1–50 at once; remove; title row on/off; narrower/wider; remove table (undo). `?state=table` | |
| R3 | Sort Ascending/Descending by the cell's column; numbers numerically, blanks last, title row and totals stay put | |
| R4 | `=SUM(B2:B6)`, `=SUM(B2, C4)`, `=SUM(B2:B)` growing; the formula bar; "Bad reference", "Includes itself", "Not a total" with the reason; `?state=formula`, `doc.html?id=scratch&state=formula-error` | |
| R5 | Not saved yet, Saving, Saved, Couldn't save (Try again), offline while writing: `?state=unsaved`, `saving`, `savefail`, `offline-edit` | |
| R6 | `documents.html`: three newest as cards with extracts, the rest as rows, search inside titles and text, **Meeting notes** and **New document** | |
| R7 | "Delete this document": the warning says it can't be undone, no undo toast; then "Document deleted" | |
| R8 | `files.html`: nested folders, the path above the title (the middle folds past four levels), New folder, Rename, Delete folder only when empty ("Empty … first") | |
| R9 | The upload sheet: several files, 10 MB each, PDFs shrunk, progress per file; `?state=uploading` | |
| R10 | Per file: a name, an optional category (suggestions or your own), a description | |
| R11 | `files.html?state=file`: size, date, name, category, description, Move, Delete for good; **Open** and **Download** are buttons only | Opening a file is the device's job; the prototype says "The prototype stops here". |
| R12 | `files.html?state=moving`: "With everything inside it: 4 files and 1 folder" | |
| R13 | Delete for good: "freeing 2,4 MB. It can't be brought back." No undo | |
| R14 | `files.html` search by name or description in every folder; `?state=noresults` | |

### A. Access and work anywhere
| ID | Where | Notes |
|---|---|---|
| A1 | `signin.html`: Google or email and password; the account-not-allowed state | |
| A2 | The "… change arrives" states, §3 | |
| A3 | `settings.html` (iPhone and Android steps; `?state=installed`); `overview.html?state=install` | |
| A4 | Every screen has a phone layout (breakpoints 760, 860 and 900px) and a desktop one; per-screen differences are listed in Guide §5 | Read from the CSS, not seen. |
| A5 | The menu shows "Signed in as …", Wedding settings, Sign out; `settings.html` "Who can open the planner" | |
| A6 | Every edit saves as you go (Guide §6.1); creating forms and sheets keep an Add button | |

## 2. Roles and hard constraints
| Item | Where |
|---|---|
| Two people, identical full access | No role anywhere. Funders "Greg", "Bella" and their families are names of payers, not accounts |
| Anyone else can't read or change anything | `signin.html?state=notallowed`; `settings.html` "Who can open the planner" |
| No read-only role, guest access or shared links | Nothing designed, by design |
| Phones and desktops, installable | A3, A4 |
| Live sync | §3 |
| 10 MB per file, bigger PDFs compressed | R9, `?state=uploading` |
| Rich text with tables and SUM | R1–R4 |
| CSV export of vendors | F15 |
| Rupiah, one language | Money is Rp with dots, English only |
| Long free-text notes with working links | Vendor, finalist and venue notes: `vendor.html?id=sv-long&stress` (600 characters with links) |

## 3. States

### The inventory's states
| State | Where |
|---|---|
| Nothing yet | Every kind of record. Bookings (`bookings.html?state=empty`), payments due (`payments.html?state=empty`), what-if (`whatif.html?state=empty`), vendors, finalists, venues, guests, items, events, tasks, documents, folders and files (`?state=empty`, `?state=emptyfolder`), price options (`vendor.html?id=ara`), packages ("No packages yet" on a new finalist), funders (`funders.html?state=empty`), the budget (`budget.html?state=empty`) and the overview (`overview.html?state=empty`) |
| No results | `?state=noresults` on bookings, vendors, venues, documents, files, guests, items and schedule. Tasks and the shortlist have no search, so no results state |
| Loading | `?state=loading` on every screen except sign-in: the skeleton |
| Failure | Couldn't load: `?state=error` on every screen. A change didn't save: `?state=savefail` (booking, vendor, finalist, settings, items, document, schedule, venues, what-if, guests, tasks) |
| Failure, upload | `?state=uploading` on files, booking, vendor and finalist: too large, failed with Try again |
| Signing in | `signin.html?state=busy`, `?state=wrong`, `?state=notallowed` |
| Not connected | `signin.html?state=demo`, then `?state=demo` on every screen: the banner, empty data, one rule for actions |
| Offline | `?state=offline` on every screen, `signin.html?state=offline`, `doc.html?state=offline-edit` |
| Live-synced | `?state=sync`, see below |
| Saving | The document autosave states (R5); the save line on detail screens and sheets |
| Uploading | Progress per file, "Shrinking from 14,2 MB to fit under 10 MB" |
| Confirming | Every remove asks first; undo toast for 6 seconds. Permanent: documents and files |
| Overdue / due soon | Payments (late in rose, due soon in gold), events, tasks (`schedule.html`, `payments.html`, `tasks.html`, `booking.html?id=rana`) |
| Overspent | `booking.html?id=kirana`, the budget and funders ("Overpaid by", rose) |
| Busy | Adding (`booking-new.html?state=busy`), Recording, Copying, Booking, Moving, Signing in, Saving; and now Removing, Deleting and Restoring (§4) |
| Notifications | `schedule.html?state=notif-default`, `?state=notif-denied`; `settings.html` all three, plus installed |

### Live-synced (A2) by screen
| Screen | URL |
|---|---|
| Budget, bookings, a booking, payments, who pays | `?state=sync` ("Bella recorded Rp … for …") |
| Vendors, documents, files, schedule, items, guests | `?state=sync` |
| A document open by both | `doc.html?state=sync-edit` |
| Tasks, what-if, shortlist, venues | `?state=sync` (added in this audit, §4) |
| A booking or document removed by the partner | `booking.html?state=gone`, `doc.html?id=gone` |
| A vendor or finalist detail, settings | Follow the pattern (Guide §6.3) but have no state of their own |

### Studio states that don't apply to this app
| State | Why |
|---|---|
| Dark mode | The brief: "Dark mode isn't needed", and it should not look dark (decisions.md, session 1) |
| Read-only, shared-link visitor | The inventory: "No read-only role, no guest access and no shared links today" |
| Restricted | Only as the account-not-allowed state at sign-in |
| Bulk selection | No story acts on several records at once. "Add several items" is one list typed into a sheet |

## 4. Gaps found in this audit, and fixed
Each was found in the code and fixed in the prototype, then added to the design guide.
1. **What-if items could not be split into parts (B8, B10).** The sheet said "Splitting into parts comes after adding" but nothing split them, and parts shown in the list could not be edited. Now: **Split into parts** makes two parts, each part has a name, a price and a who-would-pay select, **Add a part** and Remove work, and removing down to one part merges it back. The sheet also gained **Category**, which the Order by already offered. Guide §4.14, §5.10.
2. **Files on a part (B4) and on a package (F17) were a dead link.** Both now show the same tiles and Add files tile as everywhere else, filing into a folder named after the booking and part, or the finalist and package. A new package asks you to add it first. Guide §4.8, §5.14.
3. **A booking being added couldn't take a contract (B3).** "Attach a contract or receipt" now opens the shared upload sheet, lists what was attached, and the files go with the booking. Guide §5.7.
4. **A failed save was shown on 4 screens only.** Sheets that save as you go (event, guest, what-if, venue, price option, package) had no failure; one-tap rows (RSVP, task step) had none either. Now every editing sheet shows "Couldn't save. What you typed is kept. Try again", the RSVP row and a task step have their own failed state, and `?state=savefail` opens each: `schedule.html`, `venues.html`, `finalist.html`, `whatif.html`, `guests.html`, `tasks.html`. Guide §4.14, §6.1.
5. **A partner's change was shown on 12 of 22 screens, though the notes said every screen.** Added: `tasks.html`, `whatif.html`, `shortlist.html` and `venues.html` `?state=sync`. Guide §6.3.
6. **"Removing" and "Restoring" busy states were missing** (the inventory lists Busy as adding, removing and restoring). The confirm button now reads "Removing" or "Deleting" for a moment, and Undo reads "Restoring". Guide §4.11, §4.15, §4.16, §6.2, copy.
7. **`index.html` listed fewer states than the screens offer** (about 40 were missing: Couldn't load, Offline, Loading, Demonstration mode and the new ones). It now lists every state of every screen.
8. **Two stress details were off.** The stress data has 15 funders, not 14, so the guide (three places), the progress README and the index now say 15. Two stress category names were 41 and 43 characters, over the 40-character limit of F14, so they were shortened.

## 5. Still stubs (not gaps)
- **Open** and **Download** on a file, and tapping a file tile, show "The prototype stops here". Opening is the device's job.
- **Attach a receipt** inside the Record a payment sheet is the same kind of stub. A receipt can be attached on the booking itself.
- The CSV export and the file picker are real; the reminder itself is not sent.

## 6. For the owner
Questions 20–23 were decided at the freeze (2026-10-14): decimals take a comma, placeholders use full muted ink, the link sheet keeps Save, and a finalist keeps its own next step. Nothing is open.
1. **Screens I could not look at.** This audit read code and did not see pixels. Click through `prototype/index.html` at a phone width and a desktop width.
2. **Change F16 on your side.** The inventory's F16 still lists "next step" among the things copied from a vendor; a vendor has none (decision 23).
3. **A vendor or finalist detail and settings have no "change arrives" state.** They follow the pattern. Say if you want one.

## 7. Stress data, by screen
Every screen takes `?stress` except sign-in and the add-a-booking form (nothing to stress). Counts checked against the data files.
| Screen | Stress |
|---|---|
| Overview, settings | Two long names (about 33 characters each), a very long email, thousands in the doors |
| Budget, bookings, booking, payments | 1.206 bookings, 1.507 payments due, a 40-part booking, a 13-digit price, 1 KB and 9,9 MB images, an 85-character unbroken name, CJK and Arabic names |
| Who pays | 15 funders: a 90-character family name, an unbroken name, Chinese, Arabic, Thai and Japanese names |
| What-if | 301 items, a 25-part item |
| Vendors, a vendor | 2.004 vendors, 37 categories (some near the 40-character limit, some in other scripts), 30 price options, a 600-character note with links |
| Shortlist, a finalist | 83 finalists, 30 packages, 98,8M followers |
| Venues | 302 venues, a 125.000-guest venue with a 13-digit cost |
| Documents, a document | 1.504 documents, untitled and non-Latin titles, 40 long paragraphs, a 50 × 8 table with growing totals, lists four levels deep |
| Files | 3.000 files and 40 folders in one folder, 30 folders deep, long and non-Latin names, 1 KB and 10 MB files |
| Schedule, tasks | 1.204 events, 401 tasks, one with 60 steps |
| Items | 2.004 items, one with an unbroken 73-character name and a 74-character vendor |
| Guests | 1.500 guests, a guest with 12 plus-ones and a 73-character name |

## Open needs (v1.1, 2026-10-16)

| Need | Where the prototype covers it |
|---|---|
| N1 name, mark, colours | `identity.html`; `manifest.webmanifest`; `assets/identity/*.svg`; icon links and tab titles on every screen (`assets/app.js`, `signin.html`) |
| N2 nowhere, unexpected | `notfound.html` (and `?state=signedout`); `?state=crash` on every screen; `booking.html?id=old-link`, `vendor.html?id=old-link`, `finalist.html?id=old-link`, `doc.html?id=old-link` |
| N3 who's who | `signin.html?state=whoami`, `?state=whoami-new`; `settings.html` (Swap them); `budget.html?state=sync-self`, `booking.html?state=sync-self` |
| N4 Google window | `signin.html?state=google-waiting`, `google-closed`, `google-blocked`, `google-failed` |
| N5 export columns | `vendors.html`, Export (interaction); columns in guide 5.11 |
| N6 can't receive reminders | `settings.html?state=notif-install`, `notif-unsupported`; `schedule.html` with the same states (event sheet) |
| N7 the day and after | `overview.html?state=eve`, `day`, `after`; `budget.html` with the same |
| N8 unknown dates | `booking.html?id=cincin`; `tasks.html` ("Book the church" under finished) |
| N9 missing title or date, end before start | `schedule.html?state=invalid`, `new-invalid`; `tasks.html?state=add-invalid` |
| N10 remove vendor, finalist, venue | `vendor.html?id=kebun`, `finalist.html?id=f-kebun` (rose link at the foot); `venues.html` (Remove venue in a venue's sheet) |
| N11 reminders that arrive | `schedule.html` (rose box, row lines, the event sheet's Remind us; open "Call with Laras about the arch"); `settings.html` (count) |
| N12 several people | `items.html` (Who it's for picker), `items.html?state=people` |
| N13 undo refused | `booking.html?id=ayu&state=undo-conflict` (split, then Undo); `files.html?state=undo-conflict` (move, then Undo) |
| N14 remove couldn't finish | `?state=removefail` on booking, vendor, finalist, venues, files, schedule, tasks, items, guests |
| N15 names on a phone | `overview.html` at phone width (44px, like a computer) |
| N16 not an amount | `booking.html?state=badamount`, `booking-new.html?state=badamount`; any money field (interaction); Record a payment |
| N17 PDF still too big | `files.html?state=uploading`, `booking.html?state=uploading` |
| N18 Done or dismiss before saving | `schedule.html?state=done-unsaved`; `?state=savefail` then Done or Escape on any editing sheet; an add sheet with typed text, then Escape; `doc.html?id=kebun-meeting&state=leave-failed`, and `?state=unsaved` then Back |
