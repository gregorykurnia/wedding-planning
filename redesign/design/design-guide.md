# Veil design guide

**v1.0 (2026-10-14).** Frozen: approved by the owner on 2026-10-14. Later changes bump the version and are logged in `decisions.md`. This guide describes the prototype as it is. All 23 open questions are decided (see [Decided](#decided-2026-10-14) and [Decided at the freeze](#decided-2026-10-14-at-the-freeze)).

- Tokens: `tokens.css`, beside this file.
- Prototype: `prototype/`. Every URL below is relative to that folder. Open `index.html` for the list of screens. The dashed "Prototype" tab on each screen switches states (`?state=…`) and swaps in the stress data (`?stress`). The tab itself is not part of the design.
- Mock data: today is fixed at **Wednesday 14 October 2026, 11:30**. The wedding is **20 March 2027** (157 days to go), and the planner was set up on 1 March 2026. The couple are Greg and Bella, with Greg signed in.
- **Light only.** The brief says dark mode isn't needed and the app must not look dark (decisions.md, stage 2 session 1). There are no dark tokens.
- **States that don't exist for this product:** read-only, shared-link visitor and role restrictions (two people with identical full access, no shared links), and bulk selection (no story acts on many records at once). "Restricted" only appears as "account not allowed" at sign-in.

## Contents
1. [Principles](#1-principles)
2. [Tokens: how and when](#2-tokens-how-and-when)
3. [Layout and the shell](#3-layout-and-the-shell)
4. [Components](#4-components)
5. [Screens](#5-screens)
6. [Patterns](#6-patterns)
7. [Copy and tone](#7-copy-and-tone)
8. [Accessibility](#8-accessibility)
9. [Stress data](#9-stress-data)
10. [Open questions](#10-open-questions)

---

## 1. Principles

What makes Veil Veil. Every new screen should pass all seven.

1. **One figure per screen.** Each screen leads with a single large serif number: the budget's *still to pay*, a booking's own *still to pay*, payments due's *late* amount, what-if's *projected total*, the overview's *days to go*, the schedule's *late or due today*, items *confirmed of all*, guests *attending so far*, and a vendor's or finalist's preferred price. Everything else is quieter and one tap away. A screen that wants two big numbers is two screens.
2. **The gold thread.** Progress is a hairline of champagne gold, never a chunky bar or a chart: how much is paid, how much preparation time has gone, how many items are confirmed, how many steps are done. The same thread, cut into short steps, shows a vendor's or venue's stage. When the thread is dashed, the money isn't real yet (what-if).
3. **Stationery cues.** Dense screens borrow from wedding paper, so they still feel like a wedding:
   - *menu-card leaders*: dotted lines from a name to its amount (booking parts, price options, packages, headcounts, who would pay)
   - *place-card dates*: payments due sit beside a small date card
   - *envelope folders*: folders in Files are drawn as envelopes
   - *invitation headings*: centred serif titles, the couple's names in gold italic on the overview, a ribbon knot on quiet screens
4. **Rose only for what needs you.** Rose means late, overpaid, failed, offline-blocked or destructive, and nothing else. There are two deliberate exceptions: the *keen* heart on a vendor, and the focus ring. Progress is gold, settled is sage, everything else is ink.
5. **Calm and spacious.** Lots of white, centred heroes, hairline rules instead of boxes, and rows that read as text until you touch them. Fields have no visible box until hover or focus. One primary (ink) button per moment; the rest are quiet outlines or underlined text links.
6. **Light only, lit from the corners.** The page is white, lit by a blush glow at the top right and a champagne glow at the bottom left. Cards are frosted white over that glow. Shadows are tinted with plum-grey ink, never grey.
7. **Saved as you go, and safe to slip.** There's no save step anywhere you edit something that already exists: screens and sheets alike (A6). Sheets that edit end with **Done**. Removing something offers a few seconds of undo. Only the two truly permanent actions, deleting a document and deleting a file, warn that they can't be undone. A failed save keeps what you typed.

---

## 2. Tokens: how and when

All values are in `tokens.css`, with the prototype's old names in brackets.

### Colour
| Role | Token | Use it for | Never for |
|---|---|---|---|
| Ink | `--color-text` | All main text, serif titles and amounts, the primary button, toasts, pressed chips and switches | Large fills behind content |
| Muted ink | `--color-text-muted` | Meta lines, labels, hints, kickers, idle sub-navigation, the "Rp" before a figure | Anything you must act on |
| Decor | `--color-decor` | Chevrons, dotted leaders, path separators | Words (2.77:1), or the outline of a control you can press |
| Control outline | `--color-control-outline` | Idle keen heart, drag handle, idle star and tick, the task tick-box ring (3.34:1) | Words |
| Rules | `--color-rule`, `--color-edge` | Hairlines between rows (`rule`); edges of chips, quiet buttons, date cards and inputs (`edge`) | |
| Rose | `--accent-attention`, `-text`, `-wash` | Late, overpaid, couldn't save, upload failed or too large, destructive links and buttons, the keen heart, the focus ring, drop indicators. Use `-text` for words, the base for marks and dots, and `-wash` behind rose text | Decoration, progress, "nice" highlights |
| Gold | `--accent-thread`, `-track`, `--accent-gold-text`, `--accent-gold-text-on-tint` | The thread, stage steps, upload bars, worked-out totals in tables, guest numbers, "not saved yet", the couple's names on the overview, the current page in the menu, the package you're leaning towards, payment dots in the month. On champagne tints (gold flags, banners, the sorted note, calm sign-in notes) use `-on-tint` | Warnings (that's rose) |
| Sage | `--accent-settled-text`, `-wash` | "Paid in full", task labels and ticks, "Saved", "Uploaded", WhatsApp links, the confirmed tick, RSVP "Attending" | Large areas; keep it sparing |
| Glow | `--glow-blush`, `--glow-champagne` | The page and sheet glows; blush also for the wedding day and pressed event chips; champagne for envelope folders, "work on next" chips and search highlights | |
| Surfaces | `--surface-*` | Cards (`card`, frosted with `--blur-card`), sheets, tinted areas (`petal`, `mist`, `warm`), banners, the scrim | |
| Hover | `--hover-*` | A blush wash. Rows get the lightest; small tools the strongest | |
| Document palette | `--doc-ink-*`, `--doc-mark-*` | Only inside the document editor's text-colour and highlight choices | App chrome |

Rules of thumb:
- **One rose thing per row**, at most. A late booking shows rose in its "late" amount only, not in its name.
- **Gold is for what the planner works out** (totals, progress, numbers it assigns). Typed text is ink.
- A **flag** pairs a word with its wash: rose flag = late, gold flag = due soon, calm flag = a date that needs nothing yet.

### Type
- **Cormorant Garamond** (`--font-display`) for anything you'd see on an invitation: figures, page titles, names of things in rows, amounts, section headings, the menu. Mostly weight 500; the big figure is 300; the menu, the sign-in title and the overview names are 400.
- **Jost** (`--font-text`) for everything small and functional: meta lines, labels, buttons, chips, toasts, hints. Body weight is 340, slightly lighter than regular; emphasis is 450, never bold 700.
- **Italic Cormorant** has a meaning: *the chosen one* (current menu page, current sub-navigation tab, "The one we're leaning towards", guest numbers, quotes), or *not real yet* (what-if amounts), or *empty* ("Untitled").
- **Monospace** only for formulas, code blocks and the "Mono" document font.
- Numbers use lining figures everywhere and tabular figures for amounts (`.num`). Amounts never wrap (`white-space: nowrap`).
- The decision log notes the fonts are "the part most open to change". If they change, swap `--font-display` and `--font-text` only; the scale was set for these two faces' x-heights.

Sizes, from largest: days to go (`--text-days`), the budget figure (`--text-figure`), every other figure (`--text-figure-md`), page titles (`--text-page-title`), sheet titles, card titles, section headings (`--text-section`), row names (`--text-row-*`), then the Jost sizes from `--text-lead` (16.5) down to `--text-micro` (12.5). Use the role, not a nearby number: a new list row is `--text-row` (21px) unless it's a primary ledger (`--text-row-lg`).

### Spacing
- A loose 2px grid. The rhythm that matters: **30px** from a title to its figure, **48px** from the figure to the next card, **36–40px** to doors and tools, **44px** before a group heading, **52px** before a section heading on a detail screen, **56px** to the closing "days until" line, **64px** to a destructive link at the foot.
- Rows have tiny side padding (4px) so the hover wash reaches the column edge.
- The page keeps 120px (phone 140px) at the bottom so the floating add button never covers the last row.

### Radii
Pills for anything you press (buttons, chips, flags, switches, toasts, banners). 24px cards, 28px sheets and the document page, 14px small "paper" pieces (date cards, month cells, menus), 16px file tiles and popovers, 10px fields. Hairline 2px for threads and bars.

### Shadows, glow and blur
Only floating things cast shadows: the add button, sheets, toasts, popovers and the document page. Everything in the page flow is flat, separated by hairlines. Cards use frosted white (`--surface-card` plus `--blur-card`), not shadow. The page glow is fixed to the viewport, so it stays put while content scrolls.

### Motion
Minimal and functional:
- a spinner (`--motion-spin`) on busy buttons and "Saving"
- a shimmer on skeletons
- a **flash** (`--motion-flash`): a 2.4s rose-wash fade on a row that just changed, yours or your partner's
- the chevron turning as a part or task opens (`--motion-disclose`)
- upload bars growing

Toasts stay 6 seconds (9 for a partner's change), and that is the undo window. Under `prefers-reduced-motion`, every animation and transition drops to near zero.

### Breakpoints
- **760px** is the phone switch for nearly everything. Below it: the top bar tightens, figures shrink, fields stack their label above the input, sheets become bottom sheets, toasts move up, and the editor toolbar docks above the keyboard.
- **860px**: the wedding items table becomes stacked rows.
- **900px**: the three recent document cards become one column.

### Layers
From low to high: add button (5), editor table bar (9) and toolbar (10, its phone save state 11), row menu (15), dropdown (20), full-page menu (30), scrim and sheets (40), editor popovers (45), toasts (50). Toasts sit above sheets so an undo stays reachable.

---

## 3. Layout and the shell

- **Columns.** Centred, single column:
  - `--measure` (680px): the budget, detail screens, settings
  - `--measure-wide` (920px): long lists (bookings, vendors, documents, files, schedule and tasks, guests, venues, shortlist)
  - `--measure-doc` (860px): the editor
  - `--measure-table` (1120px): wedding items
- **Hero.** Every screen opens with a centred hero. In order: an optional back link above it, an optional category line (`.sub`), the page title, an optional sub line, an optional sub-navigation, then the kicker and the one figure, a context sentence, and the thread.
- **Back link.** "‹ Budget", "‹ Bookings", "‹ Vendors": small muted text above the hero, naming the parent screen. Lists reached from the menu have none.
- **Floating add button.** On list screens, the main "add" action floats bottom right as an ink pill (`.add-fab`): "Add booking", "Add a vendor", "Add a finalist", "Add a venue", "Add to the schedule", "Add a task", "Add items", "Add a guest", "Add a what-if item". On a phone it moves in to 20px from the edges. It's hidden while editing a document on a phone.
- **No menu bar, no tab bar, no sidebar.** Getting around goes: top bar → full-page menu → a section → (sub-navigation) → a list → a detail.

---

## 4. Components

Each entry gives its purpose, its anatomy, its variants and states, and its rules. Class names refer to the prototype's CSS.

### 4.1 Top bar (`.top`)
- **Anatomy:** the couple's names on the left ("Greg *&* Bella", serif 24px, the "&" in champagne italic), a link to the overview, and **Menu** on the right (two short lines and the word).
- **Same on every screen.** No page name in the middle (owner feedback, 2026-10-14: the label repeated the big title). The `.where` style is left over and no longer used.
- **States:** normal. In demonstration mode the names give way to "Our wedding planner" and a gold banner follows directly beneath. On the menu itself, the right-hand button reads **Close**.
- **Phone:** 20px padding.
- **Stress:** long names (Gregorius Alexander Wijayakusuma & Isabella Margaretha Setyaningsih) wrap onto several lines. Menu stays on the right.

### 4.2 Menu index (`.index`)
- A full-page dialog over its own glow, centred like the contents page of an order of service.
- **Entries** (serif, 30–44px, each with a one-line Jost subtitle):
  - Overview: "Days to go and what's next"
  - Budget: "Bookings, payments and who pays"
  - Vendors: "Everyone we're considering, the shortlist and venues"
  - Wedding items: "Every piece and who provides it"
  - Schedule: "Appointments, tasks and deadlines"
  - Documents: "Notes, plans and files"
  - Guests: "Who's coming to what"
- **Current section:** gold italic (`aria-current="page"`). Hover: italic.
- **Account line** at the foot: "Signed in as greg@…", then the links "Wedding settings" and "Sign out". In demonstration mode: "Demonstration mode: nobody is signed in", with "Wedding settings" and "Back to sign-in". A long email wraps.
- **Behaviour:** opening it focuses Close; Escape or Close returns focus to Menu.

### 4.3 Sub-navigation (`.subnav`)
- Quiet serif words under a section's title, for sections with siblings:
  - **Vendors · Shortlist · Venues**
  - **Documents · Files**
  - **Agenda · Month · Tasks**
- **States:** idle (muted ink); hover (ink); current (ink, italic, a champagne underline).
- It wraps on narrow screens, and it's not shown inside a folder (Files) or on detail screens.

### 4.4 Hero, figure and thread
- **Kicker** (`.kicker`): 15px muted, letter-spaced. It names the figure: "Still to pay", "Late, across 1 payment", "If you went ahead with everything here", "Attending so far", "Confirmed", "Late or due today", "Leaning towards Package B" (the option's name), "Overpaid by", "Paid in full".
- **Figure** (`.figure`, `.figure.md`, `.days-fig`): serif light, very large, never wraps. Money gets a small muted "Rp" before it (`.rp`). Items show "12 *of 25*", the "of" part at the unit size.
  - **Late:** `.figure.late`, in rose (payments due when something is late; the schedule when something is late).
  - **Overpaid:** the kicker says "Overpaid by" and the figure shows the amount over as a positive number, in rose, with a rose thread. The budget and a booking work the same way.
  - **Settled:** "Paid in full" shows the price in gold.
  - **Long:** over 13 digits, the figure shrinks (`.figure.long`, down to 30px) so it stays on one line. Figures never wrap.
- **Context** (`.context`): one sentence under the figure, with amounts in ink 450. Example: "of **Rp 882.800.000** committed, with **Rp 473.150.000** already paid".
- **Thread** (`.thread`): up to 460px, a 1px champagne-soft track, a 3px champagne fill and a hollow dot at the end of the fill. Its two ends are labelled ("54% paid · 46% to go"; "Started 1 Mar · 59% of the time gone"; "Committed · What-if").
  - `.small` has no dot or labels and fills its row (funders, tasks).
  - `.over` turns the fill rose.
  - `.maybe` adds a dashed champagne segment for what-if amounts.
  - Every thread has `role="img"` and an `aria-label` that says the same in words.

### 4.5 Next card (`.card.next`)
- The single next thing to act on, under the figure. Used on the budget ("Next to pay") and on a booking ("Next step").
- **Anatomy:**
  - a label: "Next to pay", or "Next to pay, 1 of 3 late"
  - a flag, top right
  - the name (serif 28), which links to the booking
  - the amount (serif 28, right)
  - a meta line: category, who pays, and when ("was due Friday 9 October")
  - **Record payment**, the primary button
- **Flag:** rose "5 days late", gold "due in 4 days" (within 14 days), or calm "2 Dec".
- **Empty:** "Nothing due right now", with "Every booking with a due date is paid up. Give a booking a due date to see it here."
- **After line** (`.after`), under the card: "After that, **Rp 55.500.000** to Dapur Lestari Catering on Sunday 18 October."
- **Phone:** stacked. The flag comes first, then the label, title, amount and a left-aligned button.

### 4.6 Doors (`.doors`)
- Quiet rows that lead one step deeper: a serif name, a muted summary on the right and a chevron. On the budget: Bookings, Payments due, Who pays, What-if items. On the overview: Budget, Tasks, Guests, Wedding items. In settings: Who pays, Vendor categories.
- The summary can carry one rose fragment ("**1 late**, 10 payments until March").
- Hover: a blush wash. Phone: the summary moves under the name.

### 4.7 Ledger rows (`.ledger`, `.entry`, `.vrow`, `.due`, `.drow`, `.frow`, `.grow`, `.ag`, `.tk`, `.irow`)
All lists share one form: hairline-separated rows, the name in serif, meta in muted Jost, and amounts or status right-aligned.

| Row | Where | Left | Right | Below |
|---|---|---|---|---|
| Booking entry `.entry` | Bookings | Name; "Category, paid by Greg and Bella's family, Rp 2.000.000 over the estimate" | Price; status: "Rp X to pay" / "Rp X late" (rose) / "Paid in full" (sage) / "Overpaid by Rp X" (rose) / "No price yet" | Parts with leaders |
| What-if entry | What-if | Name; "Category, would be paid by …" | Price in *italic* | Parts with *dashed* leaders; Edit · Remove |
| Vendor row `.vrow` | Vendors, Venues | Keen heart + name; category and contact | Preferred price, or "No price yet"; "**4,8** from 120 reviews" or "No rating yet" | Stage thread · WhatsApp · "On the shortlist" · "3 price options" |
| Due row `.due` | Payments due | Date card | Amount; Record payment | Meta: "3 days late, paid by Greg. Pay the balance" |
| Document row `.drow` | Documents | Title, one-line extract | "2 hours ago by Bella" | |
| File row `.frow` | Files | 48px icon (thumbnail, file type in gold italic, or envelope) and name; category in gold, then description or path | Size and date, or a chevron for a folder | |
| Guest row `.grow` | Guests | Gold italic number; name "+2"; connection, country, food notes in gold | "Both events, invitation not sent"; the RSVP switch | |
| Agenda row `.ag` | Schedule, Overview | Time ("10:00 / 12:00", "All day", "Due", or the date when late) | A late flag or Record payment | Kind label; title; place or "Join the call"; the related vendor |
| Task row `.tk` | Tasks | Tick box; title; "2 of 5 steps done" with a small thread | "Due 3 Nov" / "3 days late" (rose) / "No date" / "Done 14 Oct" | Opens into steps |
| Item row `.irow` | Wedding items | Handle; item; vendor | Events; person; star; tick; ⋯ | |

- **States for all rows:**
  - hover: a blush wash
  - **flash**: just changed, by you or your partner
  - **ruled out** (`.ruled`): the name greyed and struck through, and the stage reads "*Ruled out*"
  - **completed or cancelled**: struck through and muted, with ", completed" or ", cancelled" on the kind label
  - **done** (tasks): struck through, sage tick
  - **work on next** (items): a warm wash and a 3px gold left edge
  - **failed** (items): the vendor field gets a rose ring and a rose line under the row
- **Empty meta** keeps the row height with a non-breaking space, so rows never collapse.

### 4.8 Parts and menu cards (`.parts`, `.part`, `.menu-card`, `.tally`, `.carry`, `.pkgs`)
- **Leader lines:** the name, a dotted leader (`--color-decor`, 1px dotted) that fills the space, then the value. Dashed means hypothetical (what-if, who would pay).
- **Parts in a list** (ledger): up to 5 shown; with more, the first 4 still owing are shown, then "and 36 more parts". Each line reads one of:
  - "Rp 25.000.000, 30 Oct"
  - "Rp 25.000.000, was due 12 Oct" (rose)
  - "paid Rp 50.000.000" (sage)
  - "overpaid by Rp 1.000.000" (rose)
  - "Rp 5.000.000, no date"
- **Parts on a booking** (`.part`, a disclosure):
  - **Summary:** name, price, chevron, funder, and the status ("Rp X due 30 Oct", "Rp X 3 days late", "paid in full", "Rp X to pay, no date", "overpaid by …").
  - **Open:** the part's fields, indented behind a champagne hairline. Below them: **Files**, the same tiles and **Add files** tile as on the booking (the shared upload sheet, filing into a folder named after the booking and the part), then "Record a payment" and "Remove this part" (rose).
- **Menu card** (price options, packages, categories): serif name … leader … serif price. "What's included" sits under it. Then the actions: "*The one we're leaning towards*" (gold italic, for the preferred option) or "Lean towards this one", plus Edit and Remove (rose).
- **Tally** (guest headcounts): label … leader … serif number. "Of which, if space allows" is an indented muted sub-line, and "Unsure, living abroad" is muted.

### 4.9 Fields and inline editing (`.fields`, `.field`)
- **Order-of-service layout:** a 180px muted label column (130px in sheets) and the value, with a hairline under each row and a 56px minimum height. On a phone, the label sits above the value.
- **Inputs look like text** until touched:
  - **idle:** no border
  - **hover:** a blush wash
  - **focus:** white with an edge and a soft rose halo
  - **placeholder:** full muted ink, italic where it carries meaning ("What has to happen next", "No estimate", "Rp 0")
- **Types:**
  - text
  - money (`.num`, numeric keyboard, reformatted to "Rp 12.500.000" on blur)
  - date (native)
  - select (no arrow, reads as text)
  - textarea
  - chips for single choice (funder, kind, stage, invited to)
  - a check (`.check`, rose accent)
  - a static value ("Rp 150.000.000 from 3 parts")
  - a stepper for plus-ones (− 2 +)
- **Hint** (`.hint`) under the value, muted 13.5px: "What you noted while comparing. It never changes the agreed price."
- **Failed** (`.field.failed`): a rose ring, plus "Couldn't save this change. What you typed is kept. **Try again**". Validation uses the same look: "Give the booking a name so you can find it later.", "There's already a category called Catering."
- **Disabled** (`aria-disabled`): muted text, can't be clicked.
- **Save-state line** (`.save-state`), centred under a detail screen's title. It reads "Every change saves as you go", then "Saving", then "Saved". When a change fails, it reads "1 change not saved" in rose. In demonstration mode: "Demonstration mode: changes aren't saved". Sheets that edit an existing record carry the same line above their **Done** button.
- **Big input** (`.big-input`): serif 40px, centred, with an underline that turns rose on focus. Used for the amount in Record a payment.
- **Inline rename** (funders): the name becomes an input with a rose underline. Enter saves; Escape cancels. "Save name · Cancel".
- **Notes:** these show as reading text (`.notes-view`) with links that open. "Edit" turns them into a textarea, with a "Done" button below.

### 4.10 Chips (`.chip`)
- **Pill:** white, an edge, 14px. **Pressed** (`aria-pressed="true"`): ink fill, white text.
- **Variants:**
  - **focus chips** (`.focus .chip`): one sideways-scrolling row, the count small after the name ("Decoration 12"), truncated with an ellipsis at 280px
  - **dashed** (`.chip.dashed`) for a management action: "Edit categories"
  - **event chips on an item row** (`.ev`): small, 12.5px text, at least 26px high; pressed = blush with an alert edge
  - **filter chips** (items: events), 13.5px
- **Single choice** groups use `role="radiogroup"` with `role="radio"` chips; toggles use `aria-pressed`.

### 4.11 Buttons (`.btn`) and links (`.link`)
- **Primary** (`.btn`): an ink pill with white Jost 450. Hover: `--color-text-strong-hover`. One per moment.
- **Quiet** (`.btn.quiet`): transparent, with a hairline edge. Hover: a blush wash. Used for Cancel, secondary starts, "Show 100 more" (always with the number), "Earlier / Later".
- **Small** (`.btn.small`): tighter padding, 13.5px. Used in rows and cards.
- **Danger** (`.btn.danger`): a rose-ink fill. Only as the confirming button inside a confirm dialog.
- **Disabled:** 45% opacity, a not-allowed cursor. Used in demonstration mode and before a choice is made ("Move here").
- **Busy** (`.btn.busy`): a spinner before the label, which changes to the gerund ("Adding", "Recording", "Copying", "Booking", "Moving", "Signing in"). The confirming button of a confirm is busy too for a moment ("Removing", "Deleting"), and the **Undo** in a toast reads "Restoring" until the item is back.
- **Floating** (`.add-fab`): primary with `--shadow-fab`.
- **Google** (sign-in only): white with an edge and the Google mark.
- **Text link** (`.link`): ink, with a champagne underline offset 3px. **Rose link** (`.link.rose`) for destructive or failed actions: "Remove this booking", "Delete for good", "Try again".
- **Direction toggle** (`.dir`): a plain word, "Ascending" / "Descending", after an Order by select.

### 4.12 Search and ordering tools (`.tools`, `.search`, `.order`, `.filters`, `.range`, `.toggles`)
- **Search:** an underline field with a magnifier. The underline turns rose on focus. The placeholder says what's searched: "Search names, contacts and notes", "Search titles and what's written inside", "Find a file in any folder, by name or description", "Search everything with a date".
- **Order by:** "Order by" plus an underlined select plus Ascending/Descending. Numeric fields (price, paid, rating, reviewers, date added, capacity) start descending; text fields start ascending. Blanks always go last.
- **Filters:** small underlined selects ("RSVP Any", "Invited to Any event", "Show Confirmed or not"), checks ("Only ones we're keen on", "Hide ruled out", "Work on next only", "Show completed and cancelled"), range inputs ("Costs at most [Any]", "Holds at least [Any] guests"), a people dropdown ("Anyone"), and **Show everything** / **Show everyone** whenever any filter is on.
- **Count line** (`.count`), above results: "1.206 bookings, showing 100", "12 vendors here", "3 bookings match", "Showing 60 of 1.507". The vendors' count line carries "Export all to a spreadsheet" / "Export these to a spreadsheet".
- **Sorted note** (`.sorted-note`, items only): a gold pill reading "Sorted by vendor for now. Your own order is kept. **Back to our order**".

### 4.13 Focus chips (category focus)
- A row of chips under the title: **All 2.004 · Venue 3 · Catering 5 · … · Edit categories**. On a phone it scrolls sideways.
- Used on Vendors, the Shortlist and the Schedule ("Everything · Payments · Tasks · Calls · Appointments · Deadlines · Our events · Other").
- One is pressed at a time. Choosing one resets paging.

### 4.14 Sheets and dialogs (`.scrim`, `.sheet`)
- **Desktop:** a centred white dialog, 560px wide, 28px radius, with a blush glow in the top right and `--shadow-sheet`.
- **Phone:** a bottom sheet, full width, top corners rounded, at most 92% of the height.
- **Anatomy:**
  - a centred serif title
  - an optional sub line ("Just the name is enough for now.", "Kept apart from your bookings until you decide.")
  - fields or chips
  - for a sheet that edits something that already exists: the save line ("Every change saves as you go" → "Saving" → "Saved") and one **Done** button. Every field saves the moment it changes.
  - for a sheet that creates something: centred actions, quiet then primary ("Cancel" · "Add vendor"). In demonstration mode the primary is disabled and the line "Demonstration mode: adding is turned off." sits above it.
  - an optional rose link below ("Delete", "Remove guest", "Delete for good")
- **Behaviour:**
  - `role="dialog"` and `aria-modal`
  - focus goes to the `autofocus` field, or else the first button or input
  - Escape or a click on the scrim closes it
  - focus returns to what opened it
- **Sheets in the prototype:**
  - Record a payment
  - Add a vendor (with "Add and start another")
  - Vendor categories (rename and remove inline)
  - Add or edit a price option
  - Add a finalist
  - Add or edit a package
  - Book it / Move into Vendors
  - Venue (add or edit, with stage chips and files)
  - Add or edit a what-if item (name, category, price, who would pay; **Split into parts**, then each part's name, price and who would pay, with **Add a part** and Remove; removing down to one part merges it back into a single item)
  - Upload files
  - A file's details
  - New or rename a folder
  - Move (a file, or a folder with its contents)
  - Add a link
  - The event sheet (add or edit)
  - Add a task
  - Add items (one per line)
  - The guest sheet (add or edit)
- **Editing sheets** (save as you go, end with Done): an event, a guest, a what-if item, a venue, a price option, a package, a file's details. Status actions in the event sheet (Mark completed, Cancel it, Back to scheduled) still act at once and close the sheet with an undo toast.
- **A change that didn't save** (`?state=savefail` on a screen with editing sheets): the save line turns rose and reads "Couldn't save. What you typed is kept. **Try again**". Everything typed stays in the fields; Try again applies it and runs "Saving → Saved".
- **Still different:** the document's link sheet ("Edit link") keeps **Save** (decision 22).

### 4.15 Confirm (`Veil.confirm`)
- A sheet with:
  - a question title: "Remove Villa Samaya Ubud?"
  - a body that says exactly what goes and whether it can be undone
  - **Keep it** (quiet)
  - the action (danger), which turns busy ("Removing", "Deleting") for a moment before the change lands: "Remove booking", "Remove part", "Remove funder", "Remove option", "Remove package", "Remove item", "Remove guest", "Delete task", "Delete", "Delete folder", "Delete for good"
- The body always names the consequence:
  - "It leaves the budget, with its 3 parts, Rp 50.000.000 of recorded payments and 2 files. You can undo for a few seconds."
  - "Bella was bringing 2 plus-ones, so the headcount drops by 3. You can undo for a few seconds."
  - "It's removed from storage for good, freeing 2,4 MB. It can't be brought back."
- **Inline confirm** (inside the categories sheet): the row turns into "Remove **Florist**? Its 4 vendors move to Other." with "Keep it" and a rose "Remove category".
- **Blocked** (a folder with contents): "Empty Catering first", "It still holds 4 files and 1 folder. Move or delete them, then delete the folder.", and **OK**.

### 4.16 Toasts (`.toast`)
- An ink pill at the bottom centre (on a phone, 90px up; in the editor on a phone, 120px), 14.5px white text, with an optional action in pale gold.
- **Variants:**
  - **confirmation**: "Saved", "Added Bunga Melati Florist", "Moved to Files › Contracts"
  - **with undo**: "Removed Villa Samaya Ubud · **Undo**", "Recorded Rp 25.000.000 for Villa Samaya Ubud · **Undo**"
  - **with a next step**: "Kebun Bunga Atelier is now a booking · **Open**"
  - **partner**: a blush circle with the partner's initial, then "Bella recorded Rp 55.500.000 for Dapur Lestari Catering"; stays 9 seconds
  - **demonstration**: "Not saved: demonstration mode"
- **Timing:** 6 seconds by default, and the undo lasts as long as the toast. Tapping **Undo** turns it into "Restoring" (disabled) for a moment, then the item is back in its place. Toasts stack upward; the box is `role="status"`, `aria-live="polite"`.

### 4.17 Banners (`.banner`)
- A centred pill under the top bar or the toolbar.
- **Gold:** demonstration mode ("Demonstration mode. The planner isn't connected to its database yet, so there's nothing to show and changes aren't saved."); a partner in the document ("● Bella is also in this document. Their changes appear as they type."); first use of items ("The tracker starts with 14 common items. Rename, fill in or remove any of them.").
- **Rose** (`.banner.rose`), with a 16px radius as an inline box: "The booking wasn't added: the planner lost its connection. Everything you entered is still here."
- **Sign-in problem boxes** (`.problem`): rose for errors; gold calm (`.problem.calm`) for signed-out, offline and not-connected notes.

### 4.18 Messages: nothing yet, no results, failure, offline (`.message`)
- One centred block, at most 460px. An optional line-art mark in champagne (the **ribbon knot** for nothing yet and failures; a **struck-through cloud** for offline), a serif title, one or two sentences, and centred actions.
- **Full screen** (`.message`, 10vh from the top, 36px title): couldn't load, offline, a record that's gone.
- **Inline** (`.message.inline`, 28px title): nothing yet and no results, under the hero, so the screen's title and sub-navigation stay.
- **Nothing yet** has the knot, explains what will appear here and how it gets here, and offers the add action. **No results** has no mark, repeats the search in the title ("No bookings match “fireworks”"), says what search looks through, and offers **Clear the search** or **Show everything**.

### 4.19 Skeletons (`.sk`)
Loading reproduces the hero's shape:
- a short line (the kicker)
- a 96px rounded block (the figure)
- a line (the context)
- a card
- three rows

All shimmer on a 1.6s loop, are `aria-hidden`, and sit beside a screen-reader line, "Loading the budget". `main` gets `aria-busy="true"`.

### 4.20 File grid and upload queue
- **File grid on a record** (`.files`, booking, vendor, finalist, venue): tiles 150px or wider. Each tile has a 96px thumbnail (an image cropped to fill, or the file type in gold italic), the name, and the size ("2,4 MB, from the vendor"). The last tile is a dashed drop tile: "**Add files** Quotes, contracts, photos. Up to 10 MB each; big PDFs are shrunk for you." It opens the same **upload sheet** as Files, filing into a folder named after the record: "Into Files › Vendors › Kebun Bunga Atelier" (or Bookings, Venues, Shortlist).
  - **Uploading tiles:** a thin champagne bar, and "Uploading, 1.3 of 2,1 MB" or "Shrinking from 14,2 MB to fit under 10 MB".
  - **Bad tiles** (`.file.bad`, rose): "Too large: 48 MB. Files can be up to 10 MB; only PDFs are shrunk." or "Upload failed. **Try again**". The wording is the same here and in the upload sheet.
- **Upload sheet** (Files and every record; shared in `assets/app.js`):
  - a dashed **drop zone** that turns rose-washed while dragging over it: "**Drop files here** or choose files"
  - a **queue** with one entry per file, holding the name, the size or status, a progress bar, and fields for Name, Category (with suggestions or your own) and Description
  - **Status per file:**
    - "Uploading, 62%"
    - "Shrinking from 14,2 MB to fit under 10 MB"
    - "Uploaded" (sage) or "Uploaded, shrunk to 7,8 MB"
    - "Too large: 48 MB. Files can be up to 10 MB; only PDFs are shrunk." (rose)
    - "Upload failed. Try again" (rose)
    - "Not uploaded: demonstration mode"
- **Envelope folder** (`.frow.folder`): the icon is an envelope with a V flap on champagne-soft. The meta reads "2 folders, 14 files" or "Empty".
- **Path** (`.crumbs`): small muted links above the folder's title, "Files › Vendors › Catering". With more than four levels the middle folds into "…", which opens the full path.
- **File details sheet:** a preview (contain-fit, 180px), Name, Category and Description (each saves as you go; a new name toasts "Renamed to … · Undo"), then Open, Download, Move and **Done**, and a rose link "Delete for good".
- **Move sheet:** an indented tree of radio buttons, at most 12 indent levels. The current folder and the moved folder's own descendants are disabled, with notes: "(it's here now)", "(inside it)", "(this folder)". The **Move here** button is disabled until you choose.

### 4.21 Stage thread (`.stage`)
- Short gold dashes, one per step, filled up to the current stage, then the stage name.
- **Vendors:** Noted → Inquiring → Considering → Chosen → Done.
- **Venues:** Noted → Contacted → Visited → Booked.
- **Ruled out:** italic muted words, no dashes, and the row's name struck through.
- **On a detail screen** the stage is set with a chip row: every stage plus "Ruled out". Choosing "Chosen" (vendors) or "Booked" (venues) creates a booking.

### 4.22 Keen heart (`.keen`)
- An 18px line heart, in `--color-control-outline` when off. When pressed it's filled rose: the one rose element allowed in a vendor row.
- `aria-pressed`, with the label "Keen on Kebun Bunga Atelier". It sits before the name in rows and after the name in the vendor's title.
- Toggling it toasts "Marked Kebun Bunga Atelier as one you're keen on" / "Unmarked Kebun Bunga Atelier".

### 4.23 WhatsApp link (`.wa`)
- A sage chat icon and "WhatsApp" (in rows) or "Message on WhatsApp" (on detail screens), opening `wa.me` in a new tab.
- **Number rules:** non-digits are removed except a leading +; a leading 0 becomes 62 (Indonesia). With no number, there's no link.

### 4.24 Editor: toolbar, table bar, formula bar, popovers
- **Toolbar** (`.toolbar`, `role="toolbar"`, "Formatting"):
  - groups split by hairlines: Undo/Redo · Text style (Body text, Title, Heading, Subheading, Quote, Code) · Font (Jost, Cormorant, Georgia, Mono) · Size (Small, Normal, Large, Huge) · **B** *I* U ~~S~~ · Text colour, Highlight · Bullet points, Numbered steps · Link, Table, Clear formatting
  - the save state at the far end
  - buttons are 34px; pressed = ink fill
  - **Desktop:** it sticks to the top, frosted.
  - **Phone:** docked at the bottom above the keyboard, scrolling sideways. The save state floats as a small pill at the top centre, and a failed save becomes a full-width rose note under the top bar.
- **Save state:**
  - **Saved:** a sage tick. "Saved just now" / "Saved 2 hours ago".
  - **Not saved yet:** a gold dot, gold text.
  - **Saving:** a spinner.
  - **Couldn't save:** a rose-washed note, "Couldn't save your last changes. They're still here. **Try again**".
  - **Offline:** "Not saved: you're offline. Keep this page open. Try again".
  - **Demonstration:** "Demonstration mode: not saved".
- **Popovers** (`.pop`): **Text colour** (Ink, Rose, Gold, Sage, Cornflower, Plum); **Highlight** (Blush, Champagne, Mint, Sky, Lilac, None); **Table size** (an 8 × 8 grid that previews "3 rows, 4 columns").
- **Link bubble** (`.bubble`): a pill under a clicked link, showing the address and "Edit". **Cmd/Ctrl+K** opens "Add a link" (Web address, Text).
- **Table bar** (`.table-bar`): shown only while the cursor is in a table. It sits under the toolbar, or on a phone above it. It holds:
  - the **formula bar**: the cell address in a little tag ("B7"), then the formula in monospace, or a hint, "Type =SUM(B2:B6) for a total. B2:B keeps growing as rows are added.", or the error in rose
  - Row: Above · Below · Remove
  - Column: Left · Right · Remove
  - Add [5] [rows/columns] Add (1 to 50)
  - Sort: Ascending · Descending
  - Width: Narrower · Wider
  - Title row (toggle)
  - Remove table (rose; comes with undo)
- **Table cells:** hairline grid. The title row is petal-tinted, 14px, weight 500. Numbers are right-aligned and tabular. **Totals** are gold on warm white. **Errors** are rose italic on the rose wash: "Bad reference", "Includes itself", "Not a total". The focused cell gets a 2px rose inset ring. While you're editing a total, the cell shows its formula in monospace.
- **The page** (`.paper`): white, a 28px radius, a blush edge and a soft shadow, with generous padding (54/64/72). On a phone it runs full-bleed with no radius.
- **Title:** serif 42px, a placeholder "*Untitled*", and Enter moves into the body. **Meta line:** "Edited 2 hours ago by Bella" / "New document".
- **Body styles:**
  - list markers in gold
  - quotes in serif italic 22px with a champagne left rule
  - code in a mist block
  - links underlined in rose

### 4.25 Agenda rows and groups
- **Groups** (`.group-h`): "Late" (rose, with "2 things"), then "Today, Wednesday 14 October" (with "Today" on the right), "Tomorrow, Thursday 15 October", and then each day.
- **Kind labels:** muted for events ("Vendor call", "Appointment"); gold for "Payment"; sage for "Task".
- **Actions:** event titles open the event sheet. Payment and task titles link to their booking or task (they're read-only reflections). A payment has "Record payment" (primary when late, quiet otherwise). An event can show its related vendor or venue as a link. A call link shows as "Join the call".
- **Late:** the date replaces the time in rose, with a rose flag, "3 days late".

### 4.26 Month calendar (`.cal`, `.mc`)
- **Head:** "Earlier" (quiet) · the month name · "Later" (quiet), then the link "Back to today".
- **Grid:** seven columns, Monday first. Cells are white with a hairline, the day number in serif, and up to three dots.
- **Dots:**
  - ink: our events
  - gold ink: payments
  - sage: tasks
  - rose: late
  - "+2" after three (hidden on phones)
- **Cell variants:**
  - **today**: a champagne edge, warm fill, gold number
  - **selected**: a 2px ink inset ring
  - **wedding day**: a blush fill, alert edge and a rose "♡" after the number (♡ hidden on phones)
  - **empty** lead-in cells: invisible
- **Legend** under the grid: Our events · Payments · Tasks · Late.
- **Each cell's label** says everything the marks show: "Friday 30 October, 1 payment, 1 event", "Wednesday 14 October, today, selected, 2 events", "Saturday 20 March 2027, the wedding day, nothing". The chosen day is also `aria-pressed`.
- **Under it,** the chosen day's agenda, or "Nothing on this day. **Add something**".

### 4.27 Task rows
- **Summary:** a 24px round tick box (ringed in `--color-control-outline`, sage when done, with `role="checkbox"`), the title, the due text and a chevron. Beneath: "2 of 5 steps done" with a small thread, or the start of the notes.
- **Open:**
  - **steps**, each with a 24px check, a title input, a date and a 32px ×
  - "Add a step"
  - **Due date**
  - **Notes**
  - "Delete task" (rose)
- **Finished tasks** sit below in a disclosure: "Show 4 finished tasks" / "Hide …".
- **Paging:** open and finished tasks show 100 at a time, with "Showing 100 of 401" and "Show 100 more".

### 4.28 Item rows (wedding items)
- **Desktop columns:** handle · Item (serif input) · Vendor (input, placeholder "*Vendor not known yet*") · Events (four small chips) · Who it's for (select) · Next (star) · Confirmed (tick) · ⋯
- **Phone (under 860px):** stacked. The handle, name, star, tick and ⋯ are on top; the vendor, events and person below.
- **Star** (work on next): gold outline; filled champagne when on. **Tick** (confirmed): a sage circle with a mint fill when on. Both are 34px round buttons with `aria-pressed`.
- **Handle:** six dots in `--color-control-outline`, grab cursor. Drag and drop shows a rose line above or below the target; the dragged row fades to 40%. **Alt+↑/↓** moves the row. Handles hide while any sort or filter is on.
- **Row menu (⋯):** Add an item below · Add several below · Move up · Move down (in your own order only) · Remove (rose).
- **"To work on next" card:** champagne pill links to the marked items. Tapping one scrolls to the row, flashes it and focuses its name. Up to 12 are shown, then "and 4 more".

### 4.29 Guest rows and the RSVP switch (`.seg`)
- **Three-way switch:** Waiting · Attending · Not attending. In the guest sheet it saves as you go too. It's a pill track; the pressed segment is ink for Waiting, sage for Attending, and muted ink (`--color-text-muted`) for Not attending.
- One tap saves, with a toast ("王小明: attending · Undo").
- **On a phone** the segments grow to 14px text with more padding, for thumbs (G8).
- **Guest number** in gold italic before the name, never reused.

### 4.30 Install card, notifications and settings bits
- **Install suggestion** (overview, phone, once): a card, "Add the planner to your home screen to open it like an app." with **Show me how** and **Not now**.
- **Notification states** (settings and the event sheet's "Remind us"):
  - **allowed:** "Arrives on this phone and your other devices, even when the planner is closed.", and in settings a "Send a test reminder" button
  - **not yet allowed:** "Allow notifications" (a primary small button in settings, a link in the sheet)
  - **turned off:** rose text saying where to turn them on ("your phone's Settings, under Notifications" / "the browser's site settings for the planner")
- **Who can open the planner:** a list of the two accounts, "Greg, you · greg@…, signed in with Google" and "Bella", plus "Only these two accounts can see or change anything. Anyone else who signs in sees nothing."

### 4.31 Excluded
The **prototype switcher** (`.proto`, the dashed "Prototype" tab) and the screens index (`index.html`) are tools for review, not part of the design.

---

## 5. Screens

Every screen works at both widths from the same URL (narrow the browser below 760px, or open it on a phone, to see the phone layout). Light only. Every state listed opens from the URL given. "Interaction" means the state is reached by tapping, not by URL. Any screen also accepts `&stress`.

The whole-screen states **Loading**, **Couldn't load** and **Offline** look the same everywhere:
- **Loading** shows the skeleton.
- **Couldn't load** shows the knot and "*Thing* didn't load. The planner couldn't reach its database. Your data is safe; it just isn't here yet." with **Try again**.
- **Offline** shows the cloud and "You're offline. The planner needs a connection to show *thing*. It will load again as soon as this phone is back online." with a quiet **Try again**.

They're listed per screen without repeating that copy.

### 5.1 Sign in: `signin.html` (A1)
No top bar, no data: a centred gate, 440px wide, with the knot, "Our wedding planner", and "For the two of us only. Sign in to see everything."

| State | URL | What changes |
|---|---|---|
| Normal | `signin.html` | Continue with Google · "or with email" · Email, Password · Sign in |
| Signing in | `?state=busy` | Fields read-only, button busy "Signing in", Google disabled |
| Wrong email or password | `?state=wrong` | Email kept, password field ringed rose, rose box "That email and password don't match. Check them and try again, or continue with Google." |
| Account not allowed | `?state=notallowed` | Rose box naming the account, "…isn't one of the two accounts that can open this planner. Sign in with Greg's or Bella's account instead." plus "Use a different Google account" |
| Just signed out | `?state=signedout` | Gold box "You've signed out. Nothing is shown on this device until one of you signs in again." |
| Offline | `?state=offline` | Gold box; both sign-in buttons disabled |
| Not connected | `?state=demo` | No form: gold box explaining demonstration mode, then **Look around** |

**Phone:** the same gate at full width with 24px padding; the fields are always stacked.

### 5.2 Overview: `overview.html` (O1–O6)
The home screen; the names in the top bar lead here.
- **Hero:** names in gold italic, **157** (the days figure), "days until Saturday 20 March 2027", and the thread "Started 1 Mar · 59% of the time gone".
- **Coming up:** the next five dated things of any kind, as agenda rows, then "See the whole schedule".
- **Doors:**
  - Budget: "Rp 473.150.000 paid of Rp 882.800.000"
  - Tasks: "1 of 6 tasks done"
  - Guests: "17 attending of 20 guests invited"
  - Wedding items: "12 of 25 confirmed"

| State | URL | What changes |
|---|---|---|
| Normal | `overview.html` | as above |
| No wedding date yet | `?state=nodate` | Names, "When is the wedding?", "Set the date once and every countdown and due date works from it.", a date field, **Save the date** |
| Just started | `?state=empty` | "Nothing dated yet…" under Coming up; doors read "Nothing booked yet", "No tasks yet", "No guests yet", "Nothing tracked yet" |
| Install suggestion | `?state=install` | Install card under the hero |
| Loading / Couldn't load / Offline | `?state=loading` / `error` / `offline` | shared states |
| Demonstration mode | `?state=demo` | Gold banner; no names, no countdown: "When is the wedding?" with **Save the date** disabled and "Demonstration mode: saving is turned off."; empty doors |
| Bella's change arrives | `?state=sync` | Partner toast after 1.6s |
| Stress | `?stress` | Long names wrap; thousands in the doors, grouped with dots |

**Phone:** the days figure scales down (clamped at 96px); door summaries move under their names.

### 5.3 Wedding settings: `settings.html` (O5, O6, A3, A5, S10)
Sections:
- **The two of you:** first name, second name, wedding date. Hints: "Used wherever the planner addresses you…", "Every countdown and date works from this."
- **Who can open the planner:** the two accounts, then **Sign out of this computer/phone**.
- **Reminders on this computer/phone:** the notification state.
- **On your phone:** the iPhone and Android steps.
- **Also:** doors to Who pays and Vendor categories.

The save line sits under the title.

| State | URL | What changes |
|---|---|---|
| Normal | `settings.html` | Notifications allowed, with "Send a test reminder" |
| A change didn't save | `?state=savefail` | Second name ringed rose, "Couldn't save. What you typed is kept. Try again"; save line "1 change not saved" |
| Notifications not yet allowed | `?state=notif-default` | "Not allowed yet on this computer…" + **Allow notifications** |
| Notifications turned off | `?state=notif-denied` | Rose note naming where to turn them on |
| Installed on this phone | `?state=installed` | "Installed on this phone. Open it from your home screen like any app." |
| Loading / Offline | `?state=loading` / `offline` | shared states |
| Demonstration mode | `?state=demo` | Banner; save line "Demonstration mode: changes aren't saved"; empty name fields; "Demonstration mode: nobody is signed in…" instead of the two accounts and Sign out |

**Phone:** the copy switches between "computer" and "phone" by width; fields stack.

### 5.4 Budget: `budget.html` (B5–B8, O2, S6)
- **Hero:** "Budget", then "Still to pay" and the figure, the context sentence, and the thread "54% paid · 46% to go".
- **Below:** the next card (Next to pay), the after line, the four doors (Bookings, Payments due, Who pays, What-if items), "**157** days until Saturday 20 March 2027", and the floating **Add booking** button.

| State | URL | What changes |
|---|---|---|
| Normal | `budget.html` | as above |
| Nothing booked yet | `?state=empty` | Title, then the knot, "Nothing booked yet", "When you choose a vendor or book a venue, it lands here…", **Add booking** + quiet **Try a what-if item**, days line |
| Loading / Couldn't load / Offline | `loading` / `error` / `offline` | shared |
| Demonstration mode | `?state=demo` | Banner + the empty layout, without the days line |
| Bella's change arrives | `?state=sync` | Figure and next card update; the card flashes; partner toast |
| Overpaid | (data: paid more than committed) | kicker "Overpaid by", the amount over in rose, context "Rp X paid against Rp Y committed. Check the overpaid bookings.", a rose thread ending "overpaid" |
| Stress | `?stress` | 1.206 bookings; the figure shrinks when it passes 13 digits; "15 funders" in the Who pays door |
| Record a payment | interaction (**Record payment**) | Sheet: big amount pre-filled with what's left, "Pays this in full" / "Rp X still to pay after this" / rose "This is Rp X more than what's left. It will show as overpaid.", Paid on, Paid by chips, Attach a receipt; **Record payment** busy "Recording"; undo toast |
| Menu | interaction (**Menu**) | the full-page menu |

**Phone:** the figure is 56px; the next card stacks; doors stack; the add button sits 20px from the edges.

### 5.5 Bookings: `bookings.html` (B1, B3, B5, B9, B12)
- Back to Budget; "Bookings", with "10 bookings, Rp 882.800.000 committed".
- **Tools:** search ("Search bookings") and Order by: Next due date, Name, Category, Price, Paid, Still to pay, Funder, Difference from estimate, Date booked.
- The ledger shows 100 at a time, with **Show 100 more**.

| State | URL | What changes |
|---|---|---|
| Normal | `bookings.html` | ledger with parts |
| Nothing booked yet | `?state=empty` | inline message + **Add booking** |
| No results | `?state=noresults` | "No bookings match “fireworks”", "Search looks through names, categories, parts, next steps and funders.", **Clear the search** |
| Loading / Couldn't load / Offline | shared | |
| Demonstration mode | `?state=demo` | banner + empty |
| Bella's change arrives | `?state=sync` | the row flashes |
| Stress | `?stress` | 1.206 rows paged by 100; a 40-part booking collapses to 4 parts + "and 36 more parts"; CJK and Arabic names right-aligned per script |
| Just added | interaction (after Add a booking) | toast "Added Harmoni String Quartet", the new row flashes |

**Phone:** names 21px, prices 19px; status stays on the right.

### 5.6 A booking: `booking.html?id=…` (B1, B3, B4, B12)
- Back to Bookings. The hero holds the category line, the name, the save line, then the figure, context and thread, the next card ("Next step"), and the origin ("Booked from Venues on Sunday 1 March").
- **Details:** Name, Category, Price (static "from 3 parts") or Agreed price, Estimate (with its hint), and for a single booking also Paid so far, Funder, Due date and Next step. Then the estimate sentence: "You estimated **Rp X** while comparing. The agreed price is **Rp Y** lower."
- **Parts**, with "Add a part", or for a single booking the note and **Split into parts**.
- **Files**, then the rose "Remove this booking".

| State | URL | What changes |
|---|---|---|
| In parts | `booking.html?id=samaya` | three instalments |
| Single | `booking.html?id=ayu` | Split into parts offered |
| Overpaid | `booking.html?id=kirana` | kicker "Overpaid by", rose figure, context "…Check whether the price or a payment is wrong.", rose thread "overpaid" |
| Late | `booking.html?id=rana` | rose flag on the next card; one add-on part |
| Paid in full | (any booking with nothing left) | kicker "Paid in full", the price in gold, no next card |
| A change didn't save | `?id=samaya&state=savefail` (and `?id=ayu&state=savefail`) | the last part opens, "Paid so far" ringed rose with "Couldn't save this change. What you typed is kept. Try again"; save line "1 change not saved" |
| Uploading files | `?state=uploading` | tiles shrinking, uploading, too large, failed |
| Removed by Bella | `?state=gone` | full message "This booking was removed", "Bella removed it on another device a moment ago…", **See all bookings** |
| Loading / Couldn't load / Offline | shared | |
| Demonstration mode | `?state=demo` | "No bookings in demonstration mode" |
| Bella's change arrives | `?state=sync` | figure updates, toast |
| Stress | `booking.html?id=s-deep&stress` (and `&state=uploading`) | 85-character unbroken name wraps; 40 parts; 1 KB, 9,9 MB panorama and very tall images |
| Split, remove part, remove booking | interaction | undo toasts; removing the booking shows "Villa Samaya Ubud was removed" in place, with undo |

**Phone:** fields stack; parts open in place; file tiles go two across.

### 5.7 Add a booking: `booking-new.html` (B2)
- Back to Budget; "Add a booking", with "For something you've booked that didn't go through Vendors or Venues. Those become bookings by themselves."
- **Fields:** What it is, Category, Agreed price, Paid so far, Funder chips, Next due date, Next step, **Attach a contract or receipt** (the shared upload sheet; each file attached is listed under the link and goes with the booking when it is added).
- Then the note "Paying in instalments? Add the booking first, then split it into parts.", and **Cancel** · **Add booking**.

| State | URL | What changes |
|---|---|---|
| Normal | `booking-new.html` | empty form |
| Adding | `?state=busy` | filled, button busy "Adding" |
| Couldn't add | `?state=failed` | filled, rose box "The booking wasn't added: the planner lost its connection. Everything you entered is still here.", button **Try again** |
| Missing name | interaction | "Give the booking a name so you can find it later." |
| Demonstration mode | `?state=demo` | Add disabled, "Demonstration mode: adding is turned off." |
| Offline | `?state=offline` | full offline message |

### 5.8 Payments due: `payments.html` (B6, S6, O2)
- Back to Budget. The figure shows what's late, or if nothing is, what's due in the next 14 days, or else everything still to pay on dated bookings. Kicker: "Late, across 1 payment". Context: "and **Rp 62.650.000** more due in the next 14 days. In all, **Rp Y** across 10 payments."
- **Groups:** **Late** (rose), **In the next 14 days**, then each month, each with its total on the right.
- **Rows:** a place-card date, the name (links to the booking), the amount, the meta, and **Record payment** (primary when late).

| State | URL | What changes |
|---|---|---|
| Normal | `payments.html` | |
| Nothing due | `?state=empty` | "Nothing to pay right now", with a sentence that depends on whether bookings exist; **See bookings** |
| Loading / Couldn't load / Offline / Demonstration / Bella's change arrives | shared | |
| Stress | `?stress` | 1.507 payments, 60 at a time, "Showing 60 of 1.507", **Show 60 more** |

**Phone:** the date card is 56px; amount and button move under the text.

### 5.9 Who pays: `funders.html` (B7, B11)
- Back to Budget; "Who pays", with "What each of you and your families have paid, and what's still to pay".
- **One row per funder:** name, still to pay (serif, right), "Paid Rp X of Rp Y" / "still to pay", a small thread, and Rename · Remove.
- **Not assigned** comes last, in italic, with "See what has no funder", which opens Bookings searched for "Not assigned".
- **Add a funder**, then the note "Together that's … the same totals as the budget. Still to pay is always the price minus what's been paid."

| State | URL | What changes |
|---|---|---|
| Normal | `funders.html` | Greg, Bella, Greg's family, Bella's family, Not assigned |
| Nothing booked yet | `?state=empty` | note "Nothing is booked yet, so nobody owes anything…"; rows read "Nothing assigned yet" / "Every cost has a funder" |
| Demonstration mode | `?state=demo` | no funders, only Not assigned; "Add a funder" opens its row, but **Add funder** is disabled, with "Demonstration mode: adding is turned off." |
| Renaming | `?state=rename` | Greg's name is an input; Save name · Cancel |
| Adding | `?state=adding` | a new row with an input, "For example, Tante Lily"; Add funder · Cancel |
| Overpaid funder | (data) | "Rp X overpaid" in rose, rose thread |
| Remove | interaction | "Remove Greg? N costs (Rp X) will move to Not assigned. Payments already recorded stay as they are. You can undo for a few seconds." |
| Loading / Couldn't load / Offline / Bella's change arrives | shared | |
| Stress | `?stress` | 15 funders: very long, unbroken, Chinese, Arabic, Thai and Japanese names |

### 5.10 What-if items: `whatif.html` (B8–B10)
- Back to Budget. Kicker "If you went ahead with everything here", the projected total, then "**Rp X** already committed, plus **Rp Y** in what-if items", and a thread solid to "Committed", then dashed to "What-if".
- **Who would pay the extra:** dashed leaders, "+ Rp X" in italic, up to 8 funders + "and N more funders".
- **Items:** Order by Order added, Name, Category, Price, Who would pay. Rows have italic prices, dashed part leaders, and Edit · Remove.

| State | URL | What changes |
|---|---|---|
| Normal | `whatif.html` | |
| No what-if items | `?state=empty` | "Try an idea before you commit", "…It stays apart from your real bookings.", **Add a what-if item** |
| Loading / Couldn't load / Offline / Demonstration | shared | (in demonstration mode, Add opens the sheet; its **Add item** is disabled) |
| Stress | `?stress` | 301 items in pages of 50; a 25-part item |
| A change didn't save | `?state=savefail` | the first item's sheet opens with the rose save line "Couldn't save. What you typed is kept. Try again" |
| Bella adds an idea | `?state=sync` | "Bella added “Live band for the reception”"; the row flashes and the projected total updates |
| Add | interaction | sheet "Add a what-if item" with What it is, Category, Price, Who would pay; "Paying in stages? Add the item first, then split it into parts."; Cancel · **Add item** |
| Edit | interaction | the same sheet titled "Edit …"; every change saves as you go; **Done** |
| Split into parts | interaction | **Split into parts** makes "Part 1" (the item's price and funder) and "Part 2" (Rp 0); each part has a name, a price and a who-would-pay select; **Add a part**, Remove; the total updates as you type; removing down to one part merges it back into a single item |

### 5.11 Vendors: `vendors.html` (F6, F7, F9–F15, F23)
- "Vendors", with "16 vendors, 7 you're keen on", and the sub-navigation.
- **Focus chips:** All · each category with its count · Edit categories.
- **Tools:** search; Only ones we're keen on; Order by Category, Name, Stage, Rating, Number of reviewers, Date added.
- **List:** a count line with the export link. Ordered by category, the list is grouped under category headings, each with its count.

| State | URL | What changes |
|---|---|---|
| Normal | `vendors.html` | |
| No vendors yet | `?state=empty` | "No vendors yet", "Add a vendor the moment you hear about one: a name is enough…", **Add a vendor** |
| No results | `?state=noresults` | "No vendors match “harpist”" + **Clear the search**; with a category or keen filter: "No vendors in this category yet" / "No vendors you're keen on here" + **Show every vendor** |
| Adding a vendor | `?state=capture` | sheet: Name (pre-filled), Category, Contact person, Phone, Notes; **Add and start another** · **Add vendor** |
| Editing categories | `?state=categories` | sheet: menu-card of categories, "Ours, 3 vendors" / "Catch-all, 2 vendors"; Rename · Remove on ours (both with undo); New category with "40 characters left" |
| Category name taken | `?state=taken` | "There's already a category called Catering." |
| Loading / Couldn't load / Offline / Demonstration | shared | |
| Bella adds a vendor | `?state=sync` | the new row flashes; "Bella added Bunga Melati Florist" |
| Stress | `?stress` | 2.004 vendors, 37 categories (some near the 40-character limit, CJK), paged by 100 |
| Export | interaction | downloads `vendors-greg-bella.csv`; toast "Exported 16 vendors to vendors-greg-bella.csv" |

**Phone:** focus chips scroll sideways; rows keep price and rating on the right.

### 5.12 A vendor: `vendor.html?id=…` (F7–F11, F13, F16, B1)
- Back to Vendors. The hero holds the category, the name with the keen heart, the save line, the stage chips, an optional "Chosen, and now a booking. Open the booking", and the figure: "Leaning towards Package B" with its price, or "No price yet" with a hint.
- **Sections:**
  - Contact and reputation: contact, phone + WhatsApp, category, rating ("Out of 5, from their public reviews"), reviewers
  - Prices: menu card, Add a price option
  - Notes: reading view with links, Edit
  - Files
  - a card: "Narrowing down Decoration?" with **Copy to the shortlist**, or "On the shortlist" with **Open on the shortlist**

| State | URL | What changes |
|---|---|---|
| Normal | `vendor.html?id=kebun` | |
| No prices | `vendor.html?id=ara` | "No price yet"; "No prices yet. When they send a price list, add each option here." |
| Ruled out | `vendor.html?id=nusantara` | name struck through in the hero; "Ruled out" chip pressed |
| A change didn't save | `?state=savefail` | rating "4,9" kept, ringed rose |
| Uploading files | `?state=uploading` | |
| Loading / Couldn't load / Offline | shared | |
| Demonstration mode | `?state=demo` | "No vendors in demonstration mode" |
| Stress | `vendor.html?id=sv-long&stress` | 30 price options, a 600-character note with links, a long unbroken name |
| Chosen | interaction (Chosen chip) | creates a booking; toast "Kebun Bunga Atelier is now a booking · Open" |
| Copying | interaction | button busy "Copying", then the card flips to "On the shortlist", with undo |
| Price option | interaction | Add: Cancel · **Add option**. Edit: saves as you go, **Done** |

### 5.13 Shortlist: `shortlist.html` (F17–F19, F21)
- "Shortlist", with "6 finalists in 4 categories", and the sub-navigation. Focus chips by category; Order by Category, Preferred price, Reviews, Instagram followers, with Ascending / Descending (price starts low to high, reviews and followers high to low).
- **Finalist cards** in a grid, 280px or wider, grouped by category:
  - name, then "120 reviews, 12,3k followers"
  - up to 4 packages with leaders, the one you're leaning towards in gold italic serif, as on the detail screens
  - "Next: …" at the foot
  - booked cards fade to 70% and carry a gold flag, "Now a booking"

| State | URL | What changes |
|---|---|---|
| Normal | `shortlist.html` | |
| Bella adds a finalist | `?state=sync` | "Bella added Lumina Wedding Photography to the shortlist"; the card flashes |
| Nothing on the shortlist | `?state=empty` | "Nothing on the shortlist yet", quiet **Go to Vendors** + **Add a finalist** |
| Adding a finalist | `?state=adding` | sheet: Name, Category, First package, Its price |
| Loading / Couldn't load / Offline / Demonstration | shared | |
| Stress | `?stress` | 83 finalists; 30 packages ("and 26 more packages"); 98,8M followers |

**Phone:** one card per row.

### 5.14 A finalist: `finalist.html?id=…` (F17, F18, F20, F24)
- Back to Shortlist. The hero holds the category, the name, the save line, the origin ("Copied from Kebun Bunga Atelier in Vendors. Changes here don't touch it." / "Added straight to the shortlist"), and the figure "Leaning towards …".
- **Sections:** Packages (menu card with reviews, next step, files and notes), Contact and popularity, Notes, Files ("Files added to Kebun Bunga Atelier in Vendors appear here by themselves."), and the card "Chosen this one?" with **Move into Vendors** (from scratch only) · **Book it**.

| State | URL | What changes |
|---|---|---|
| Normal | `finalist.html?id=f-kebun` | copied from a vendor |
| From scratch | `finalist.html?id=f-arka` | Move into Vendors offered |
| Booking it | `?state=booking` | sheet "Book Kebun Bunga Atelier" with package chips; **Book it** busy "Booking" |
| Uploading files | `?state=uploading` | |
| Loading / Couldn't load / Offline / Demonstration | shared | |
| Stress | `finalist.html?id=sf-deep&stress` | 30 packages, huge counts |
| Booked | interaction | gold flag "Now a booking" + "Open the booking"; the card disappears |
| A change didn't save | `?state=savefail` | the first package's sheet opens with the rose save line |
| Package | interaction | Add: Cancel · **Add package** ("Add the package first, then attach its files."). Edit: saves as you go, with the package's own **Files** (tiles and **Add files**), **Done** |

### 5.15 Venues: `venues.html` (F1, F3–F5, F22, B1)
- "Venues", led by "Booked: Villa Samaya Ubud" (a link to its booking), and the sub-navigation.
- **Tools:** search; Order by Cost, Capacity, Name. **Filters:** Stage; Costs at most; Holds at least … guests; Hide ruled out (on by default).
- **Rows:** venue name, estimated cost, location, "Up to 300 guests", stage thread, file count, and the note cut at 140 characters. Tapping a name opens the venue sheet.

| State | URL | What changes |
|---|---|---|
| Normal | `venues.html` | "4 venues, 2 ruled out hidden" |
| No venues yet | `?state=empty` | "No venues yet" + **Add a venue** |
| No results | `?state=noresults` | "No venues match", "Nothing fits “beach”, at most Rp 200.000.000.", **Show every venue** |
| A change didn't save | `?state=savefail` | the second venue's sheet opens with the rose save line |
| Bella adds a venue | `?state=sync` | "Bella added Bukit Jimbaran Lawn"; the row flashes |
| Loading / Couldn't load / Offline / Demonstration | shared | |
| Stress | `?stress` | 302 venues; a 125.000-guest, 13-digit venue with a long address |
| Venue sheet | interaction | stage chips, Name, Location, Estimated cost, Most guests, Notes, Files. Add: Cancel · **Add venue** (with undo). Edit: saves as you go, **Done**. Marking Booked creates a booking ("… is now a booking · Open") |

### 5.16 Documents: `documents.html` (R6)
- "Documents", with "6 documents, newest first", and the sub-navigation. Then **Meeting notes** (primary) and **New document** (quiet).
- **Search:** "Search titles and what's written inside".
- **Recent:** the three newest as cards, each with the title, a 4-line extract and "Edited 2 hours ago by Bella". Below them, **Earlier** as rows.
- **Searching:** the results are rows only, with the match highlighted in champagne in the title and the extract.

| State | URL | What changes |
|---|---|---|
| Normal | `documents.html` | |
| Nothing written yet | `?state=empty` | "Nothing written yet", "Start with meeting notes when you sit down with a vendor…" (the starts stay above) |
| No results | `?state=noresults` | "No documents match “photographer contract”", "Search looks through titles and everything written inside, tables included." |
| Loading / Couldn't load / Offline / Demonstration | shared | |
| Bella starts a document | `?state=sync` | "Bella started “First dance shortlist”" |
| Stress | `?stress` | 1.504 documents; CJK, Arabic, Thai, untitled ("*Untitled*") and an 85-character unbroken title |

**Under 900px:** the recent cards stack into one column.

### 5.17 A document: `doc.html` (R1–R5, R7)
- Back to Documents, the toolbar, the paper (title, meta, body), and the rose "Delete this document" (not shown on a new one).

| State | URL | What changes |
|---|---|---|
| Meeting notes, just started | `doc.html?new=meeting` | Title "Meeting: " with the cursor after it; today's date, "Who was there:", "What they said", a prices table with a growing total, a next-steps list |
| Blank | `doc.html?new=blank` | empty title "Untitled", empty body |
| Saved | `doc.html?id=kebun-meeting` | "Saved 2 hours ago" with a sage tick |
| Not saved yet | `?state=unsaved` | gold dot, "Not saved yet" |
| Saving | `?state=saving` | spinner |
| Couldn't save | `?state=savefail` | rose note, "…They're still here. Try again" |
| Went offline while writing | `?state=offline-edit` | "Not saved: you're offline. Keep this page open. Try again" |
| Cursor in a table | `?state=table` | table bar showing |
| Editing a total | `?state=formula` | the total cell shows `=SUM(C2:C5)` in monospace; the formula bar shows its address and formula |
| A total with a mistake | `doc.html?id=scratch&state=formula-error` | "Bad reference" in the cell holding `=SUM(B2:B4, D9)`; the formula bar explains "D9 is outside this table, which has … columns and … rows." The same document has a total that includes itself, `=SUM(B2:B5, B7)` |
| Bella is in it too | `?state=sync-edit` | gold banner with a gold dot |
| Deleted by Bella | `doc.html?id=gone` | "This document was deleted", "Bella deleted it on another device. It can't be brought back." |
| Delete | interaction | "Delete “Meeting: Kebun Bunga Atelier”?", "This can't be undone. The document and everything in it, tables included, will be gone for you and Bella.", **Delete for good**, then in place "Document deleted / It's gone for both of you." No undo |
| Loading / Couldn't load / Offline | shared | |
| Demonstration mode | `?state=demo` | body not editable; "Demonstration mode: not saved" |
| Stress | `doc.html?id=s-long&stress` (and `&state=table`) | 40 long paragraphs, a 50 × 8 table with growing totals (scrolls sideways, at least 720px), four-deep lists, an unbroken title |

**Phone:** the toolbar is docked at the bottom; the table bar sits above it; the save state floats at the top; the page runs full-bleed; the add button is hidden.

### 5.18 Files: `files.html` (R8–R14)
- **At the top level:** "Files", with "14 files, 33,1 MB in all", the sub-navigation, then **Upload files** and **New folder**.
- **Inside a folder:** the path, the folder's name, "2 folders, 5 files", and Rename · Move · Delete folder (rose).
- **Search:** "Find a file in any folder, by name or description". Then Folders, then Files (newest first).

| State | URL | What changes |
|---|---|---|
| Normal | `files.html` | |
| No files yet | `?state=empty` | "No files yet", "Upload quotes, contracts and photos from vendors…" |
| An empty folder | `?state=emptyfolder` | "This folder is empty", "Upload files into it, or make folders inside it." |
| No results | `?state=noresults` | "No files match “passport”", "The search looks at every folder, by file name and description." |
| Searching many | (stress, search "DSC") | "3.000 files in all folders, showing 200" and **Show 200 more** |
| Uploading | `?state=uploading` | upload sheet with done, uploading, shrinking, too large, failed |
| A file's details | `?state=file` | file sheet |
| Moving a folder | `?state=moving` | move sheet, "With everything inside it: 4 files and 1 folder." |
| Three levels down | `files.html?folder=old` (and `&state=file`) | path "Files › … › …" |
| Delete a folder with things in it | interaction | "Empty Catering first…" |
| Delete a file | interaction | "…freeing 2,4 MB. It can't be brought back." **Delete for good**; toast without undo |
| Loading / Couldn't load / Offline / Demonstration | shared | |
| Bella uploads a file | `?state=sync` | "Bella uploaded Bella's dress fitting.jpg" |
| Stress | `files.html?folder=big&stress`; `files.html?stress&state=deep` | 3.000 photos and 40 folders in one folder; 30 levels deep with the middle folded; long and non-Latin names; 1 KB, 10 MB, very wide and very tall images |

**Phone:** a file's size and date move under its name; the upload fields stack.

### 5.19 Schedule, agenda: `schedule.html` (S1–S3, S5–S7, S10, O2)
- "Schedule", with "Appointments, calls, payments and tasks, in one line of time", and the sub-navigation (Agenda · Month · Tasks).
- **Figure:** the number late or due today (rose when anything is late). Kicker: "Late or due today" / "Nothing late or due today. Tomorrow:". Context, in the form: "**N late** and **N today**, then N tomorrow. N more things in the next 14 days."
- **Tools:** kind chips; search; Show completed and cancelled. Then the groups, and the floating **Add to the schedule**.

| State | URL | What changes |
|---|---|---|
| Normal | `schedule.html` | |
| Nothing scheduled | `?state=empty` | "Nothing scheduled yet", "…Payments due on bookings and tasks with dates appear here by themselves.", **Add to the schedule** |
| No results | `?state=noresults` | "Nothing matches “florist”" + **Show everything** |
| With completed and cancelled | `?state=done` | struck-through rows appear |
| An event's details | `?state=event` | event sheet: kind chips, Title, Date, All day / Starts–Ends, With, Where or a call link, Notes, Remind us; every change saves as you go; Mark completed · Cancel it · **Done**; rose Delete |
| Adding an event | `?state=new` | "Add to the schedule", "For example, Tasting at Sendok Emas" |
| Notifications not yet allowed / turned off | `?state=notif-default` / `notif-denied` | the note under Remind us |
| Loading / Couldn't load / Offline / Demonstration | shared | |
| A change didn't save | `?state=savefail` | the event sheet opens with the rose save line |
| Bella adds an appointment | `?state=sync` | "Bella added “Makeup trial with Kirana” tomorrow at 10:00" |
| Stress | `?stress` | 1.204 events, 80 at a time, **Show 80 more** |
| Payments filter | interaction | shows payments due on bookings and your own events of the kind Payment |

**Phone:** the time column is 58px; flags and buttons move under the text.

### 5.20 Schedule, month: `schedule.html?view=month` (S4)
The month head, the calendar, the legend, then the chosen day's list. **Normal:** `schedule.html?view=month`. **Stress:** `&stress`. Choosing a day is an interaction. "Add something" on an empty day opens the event sheet for that date.

**Phone:** cells shrink to 5px padding with 16px numbers; the dots are 5px with no "+N"; the wedding day shows only its blush fill.

### 5.21 Tasks: `tasks.html` (S8, S9)
- "Tasks", with "5 open, 1 done", and the sub-navigation.
- **Open** ("by due date, undated last"), then the disclosure of finished tasks, and **Add a task**.

| State | URL | What changes |
|---|---|---|
| Normal | `tasks.html` | |
| A task opened | `?state=open` (or `?open=<id>` from the agenda) | steps, due date, notes, Delete task |
| No tasks yet | `?state=empty` | "No tasks yet", "Add the big jobs, like choosing the caterer…" |
| A step didn't save | `?state=savefail` | the first task opens; its second step is ringed rose with "Couldn't save this step. What you typed is kept. Try again" |
| Bella finishes a step | `?state=sync` | "Bella finished “Tasting at Sendok Emas”"; the task flashes and its thread moves |
| Everything done | `?state=alldone` | "Everything's done", "Finished tasks are kept below in case you need one back.", disclosure open |
| Loading / Couldn't load / Offline / Demonstration | shared | |
| Stress | `?stress` | 401 tasks, one with 60 steps, 100 at a time with "Showing 100 of 400" and **Show 100 more** |

Tasks uses the wide column, like Agenda and Month, so switching tabs doesn't change the width.

**Phone:** the due text moves under the title; the inner content loses its indent.

### 5.22 Wedding items: `items.html` (T1–T10)
- "Wedding items", with "Every piece of the day, and who provides it".
- **Figure:** "12 *of 25*" confirmed, with "**6** marked to work on next" and the thread "48% confirmed · 13 to go".
- Then the "To work on next" card, the tools, the filters, the column heads and the rows, with the floating **Add items**.

| State | URL | What changes |
|---|---|---|
| Normal | `items.html` | |
| First use, pre-filled | `?state=first` | banner, then 14 common items |
| Nothing tracked yet | `?state=empty` | "Nothing tracked yet", quiet **Start with common items** + **Add items**. In demonstration mode **Start with common items** is disabled, with the demo line; Add items opens its sheet, whose **Add** is disabled |
| No results | `?state=noresults` | "Nothing matches “photo booth”", **Show everything** |
| Sorted for now | `?state=sorted` | sorted note, handles hidden |
| A change didn't save | `?state=savefail` | the vendor input ringed rose, "Couldn't save “Bespoke Tailor Bali”. What you typed is kept. Try again" |
| Loading / Couldn't load / Offline / Demonstration | shared | |
| Bella confirms an item | `?state=sync` | "Bella confirmed Wedding cake" |
| Stress | `?stress` | 2.004 items, 150 at a time |
| Row menu, remove, add several | interaction | "Remove Wedding cake?", "You can undo for a few seconds, and it goes back exactly where it was." |

**Under 860px:** stacked rows, no column heads.

### 5.23 Guests: `guests.html` (G1–G8)
- "Guests", with "20 guests invited, 34 people with plus-ones".
- **Figure:** attending so far, with "people, plus-ones included. **14** still to reply."
- **Two cards:** **Headcounts** ("Plus-ones included; anyone not attending left out": Both events, Reception, "of which, if space allows", Ceremony, Unsure, living abroad) and **Both sides** ("Guests invited to both events; friends count as family": Groom's side family / business · Bride's side family / business, plus "3 people not counted: their connection doesn't say groom's or bride's.").
- **Tools:** search; Order by Number, Name, Connection, Country, Invited to, Invitation sent, RSVP, Plus-ones, Food notes; RSVP and Invited to filters; Show everyone.

| State | URL | What changes |
|---|---|---|
| Normal | `guests.html` | |
| No guests yet | `?state=empty` | "No guests yet", "…Headcounts for each event work themselves out.", **Add a guest** |
| No results | `?state=noresults` | "No guests match “Surabaya”", **Show everyone** |
| A reply didn't save | `?state=savefail` | the first attending guest's row is ringed rose: "Couldn't save the reply for …. Your choice is kept. Try again" |
| Who hasn't replied | `?state=waiting` | RSVP filter set to Waiting |
| A guest's details | `?state=guest` | guest sheet: "Guest number 3", Name, How they're connected (hint "Mention groom's or bride's so the two sides add up."), Country, Invited to chips, Invitation Sent, RSVP switch, Plus-ones stepper, Food notes; every change saves as you go; **Done**; Remove guest |
| Removing a guest with plus-ones | `?state=remove` | confirm naming the plus-ones and the headcount drop |
| Adding | interaction | "Will be guest number 21", **Add and start another** · **Add guest**; toast "Added … as guest 21" |
| Loading / Couldn't load / Offline / Demonstration | shared | |
| Bella records an RSVP | `?state=sync` | "Bella marked 王小明 as attending" (the first guest still waiting) |
| Stress | `?stress` | 1.500 guests, 100 at a time |

**Phone:** the cards stack; the invitation and RSVP switch move under the name; the switch grows for thumbs.

---

## 6. Patterns

### 6.1 Saving as you go
- **On screens**, every field saves when it changes (blur or select) (A6). Detail screens show the save line: "Every change saves as you go" → "Saving" → "Saved". List rows (items, tasks, guests' RSVP) save on the spot, sometimes with a toast.
- **Failure keeps the input.** The field stays as typed, gets a rose ring and the line "Couldn't save this change. What you typed is kept. **Try again**", and the save line says "1 change not saved". Try again clears the ring and runs "Saving → Saved" (T9, and the stated rule for every screen).
  - **A row that saves on one tap** (an RSVP, a task step, an item's star or tick) keeps the choice, rings the row in rose and puts a line under it: "Couldn't save the reply for Maria Goretti. Your choice is kept. **Try again**" (`guests.html?state=savefail`), "Couldn't save this step. What you typed is kept. **Try again**" (`tasks.html?state=savefail`).
  - **A sheet** shows the same words in its save line (see 4.14).
- **Documents** autosave after a 0.9-second pause in typing: Not saved yet (gold) → Saving → Saved just now (sage). On failure the text stays and the note offers Try again. Offline says to keep the page open (R5).
- **Forms that create** (Add a booking) save on a button press, because there's nothing to save into until the record exists. On failure they keep every field and turn the button into **Try again**.
- **Sheets that edit** an existing record save as you go too, with the same save line, and close with **Done**. If a name is cleared, the old one comes back rather than saving an empty name.

### 6.2 Undo windows and permanent deletes
- **Anything removed or changed in bulk** gets a toast with **Undo**, for as long as the toast shows (6 seconds), and undo puts it back in the same place:
  - removing a booking, part, funder, price option, package, what-if item, item, guest, task, event, folder, category or table
  - splitting a booking
  - recording a payment
  - marking an event completed or cancelled
  - finishing a task
  - moving a file or folder
  - renaming anything: a funder, folder, file or vendor category
  - changing an RSVP
  - copying to the shortlist
  - adding a vendor, funder, what-if item, items, or the starter items
- **Busy:** the confirming button reads "Removing" or "Deleting" for a moment, and **Undo** reads "Restoring", so an action never lands without a sign that it is happening.
- **Confirm first** before anything that removes. The body names what goes with it and ends "You can undo for a few seconds."
- **Permanent:** deleting a **document** (R7) and deleting a **file** (R13). The confirm says it can't be undone (and for files, how much storage it frees); the action reads **Delete for good**; there's no undo toast.
- **Blocked:** a folder with anything in it can't be deleted until it's emptied (R8).

### 6.3 Live partner changes (A2)
- A change from the partner arrives without refreshing. The changed row or card **flashes** (2.4s rose-wash fade), the numbers update in place, and a **partner toast** with the partner's initial says what happened, for 9 seconds: "Bella recorded Rp 55.500.000 for Dapur Lestari Catering", "Bella added Bunga Melati Florist", "Bella started “First dance shortlist”", "Bella uploaded …", "Bella added “Makeup trial with Kirana” tomorrow at 10:00", "Bella confirmed Wedding cake", "Bella marked 王小明 as attending", "Bella finished “Tasting at Sendok Emas”", "Bella added “Live band for the reception”" (what-if), "Bella added Lumina Wedding Photography to the shortlist", "Bella added Bukit Jimbaran Lawn" (venue).
- **If the partner removes what you're looking at:** a full message ("This booking was removed", "Bella removed it on another device a moment ago.", or "This document was deleted… It can't be brought back.") with a way back to the list.
- **If you're both in the same document:** a gold banner, "Bella is also in this document. Their changes appear as they type."

### 6.4 Demonstration mode (not connected)
- Sign-in offers **Look around** instead of a form. Every screen then carries the gold banner, shows the empty data set, and disables saving. Nothing about the wedding shows: the top bar reads "Our wedding planner", there's no countdown, no funders, and the menu says "nobody is signed in".
  - **one rule for actions:** anything that opens a sheet stays enabled and opens it; only the final button is disabled, with the line "Demonstration mode: adding is turned off." (or "copying", "booking", "moving", "renaming", "uploading", "saving"). A one-tap action with no sheet ("Start with common items", "Copy to the shortlist", "Save the date") is itself the final button.
  - inline changes say "Not saved: demonstration mode" (in the save line or a toast)
  - uploads say "Not uploaded: demonstration mode"
- Detail screens say "No bookings in demonstration mode" (or vendors, documents, the shortlist).

### 6.5 Offline
- **Before data has loaded:** the full offline message with the struck-through cloud. It never looks empty.
- **Signing in while offline:** a calm note, and the sign-in buttons are disabled.
- **Adding while the connection drops:** the rose box, and all input kept.
- **Writing while the connection drops:** "Not saved: you're offline. Keep this page open."

### 6.6 Loading
A skeleton in the shape of the hero, never a spinner on a blank page. `aria-busy` is set, and a hidden line says what's loading. Buttons show their own busy state (spinner plus gerund) while an action runs: Adding, Recording, Copying, Booking, Moving, Signing in.

### 6.7 Nothing yet vs no results
- **Nothing yet:** the ribbon knot, a title that says so ("No vendors yet", "Nothing booked yet", "Nothing written yet"), one sentence on what goes here *and how it gets here*, and the action that starts it. The screen title and sub-navigation stay.
- **No results:** no knot, the search quoted in the title ("No vendors match “harpist”"), what search looks through, and **Clear the search** / **Show everything** / **Show everyone** / **Show every venue**.
- **Nothing in this slice:** "No vendors in this category yet", "Nothing on this day. Add something", "This folder is empty".

### 6.8 Ordering and filtering
- **"Order by"** plus a select plus a direction word. Numeric orders start descending, text orders ascending. Blanks always last. Ties fall back to name (vendors) or guest number (guests).
- **A booking's parts always stay with their booking** (B9). Orders apply to bookings, never to parts.
- **Sorting is temporary where you keep your own order** (items, T6). A sort shows the gold "Sorted by … for now" note, hides the handles, and offers "Back to our order".
- **Filters combine:**
  - several chosen events or people match *any* of them (items, T5)
  - every active filter offers a way back to everything
  - counts say how many match: "12 of 2.004"
- **Long lists page,** and the button always says how many more: "Show 100 more", with the count line "Showing 100 of 1.206". Nothing stops silently.
- **Searching keeps focus** in the search field while results update.

### 6.9 Money rules
- **Rupiah, no decimals:** "Rp 12.500.000", grouped with dots. Negative uses a true minus, always first: "−Rp 12.500.000", in sentences and figures alike. An overpaid figure shows the amount over as a positive number under "Overpaid by".
- **Big figures:** "Rp" set small and muted before the number.
- **Still to pay = price − paid, everywhere** (budget, a booking, parts, funders, payments due, the agenda). Overpaid means paid > price: it's shown in rose as "Overpaid by Rp X", never hidden, and the thread turns rose.
- **A booking in parts takes everything from its parts** (B4): its price is the sum of the part prices, its paid is the sum of the part paids, its funders are the set of part funders ("paid by 3 funders" past two), and its next due is the earliest unpaid part with a date.
- **Splitting a single booking:** what's paid becomes "Deposit" (paid in full); the rest becomes "Balance" with the old due date and next step. If nothing is paid, it becomes one "First payment".
- **Payments due** include every unpaid part or booking that has a due date. Undated ones never appear there.
- **Late** means the due date is before today. **Due soon** means within 14 days (`SOON = 14`).
- **Not assigned** is a funder row of its own. Removing a funder moves its costs to Not assigned, and recorded payments stay.
- **The estimate is kept apart from the agreed price** (B12) and compared in a sentence; Bookings can be ordered by "Difference from estimate".
- **What-if totals never mix into the budget.** The only combined number is the projected total on what-if.
- **Money inputs** accept any digits and reformat to "Rp 12.500.000" on blur.

### 6.10 Formula rules (documents, R4)
- **Cells** are addressed like a spreadsheet: columns A, B, C…; rows counted from 1, including the title row.
- **Only SUM:**
  - `=SUM(B2:B6)`: a range
  - `=SUM(B2, C4)`: cells, separated by commas or semicolons
  - `=SUM(B2:B)`: a **growing** range down to the last row, stopping above the total itself when the total sits in that column
  - Case and spaces don't matter.
- **Numbers read:** "Rp 12.500.000", "12.500.000", "12500000", "2,5". Text and blanks count as 0. If any added cell carries "Rp", the total does too. Decimals show as ",25" only when they aren't zero.
- **Errors**, named in the cell in plain words with the reason in the formula bar and the cell's title:
  - **Bad reference**: "B9 is outside this table, which has 3 columns and 7 rows." / "“X” isn't a cell or range. Use cells like B2 or ranges like B2:B6."
  - **Includes itself**: "This total includes its own cell, B7. Change the range so it stops above it."
  - **Not a total**: "Only SUM works here, like =SUM(B2:B6)."
- **Totals are gold** so they read as worked out, not typed.
- **Sorting a table** (R3) uses one column. It's numeric when every non-blank value is a number, and text otherwise (natural order, accents ignored). Blanks go last. The title row and any row holding a total stay where they are.

### 6.11 Dates and relative time
- **Long date:** "Wednesday 14 October", with the year only when it isn't this year ("Saturday 20 March 2027"). **Short date:** "14 Oct" (plus the year when needed). **Month heading:** "October", or "March 2027".
- **Due text:** "3 days late" · "due today" · "due tomorrow" · "due in 4 days" (up to 14) · "due Friday 30 October". In past sentences: "was due Monday 12 October".
- **Agenda days:** "Today, Wednesday 14 October" · "Tomorrow, Thursday 15 October" · then the long date. Times are 24-hour ("10:00"). All-day events say "All day".
- **Edited times:** "just now" · "12 min ago" · "2 hours ago" · "yesterday" · then the short date, plus "by Bella" when it was the partner.
- **Counts** group thousands with dots, like money: "1.206 bookings", "Showing 60 of 1.507". Decimals take a comma, so a dot always means thousands: "4,8" ratings, "33,1 MB", "98,8M followers" (decision 20).
- **The wedding date** drives every countdown (O5). "Time gone" runs from the day the planner was set up (decision, stage 2 session 8).

### 6.12 Notifications (S10)
A reminder is chosen per event (No reminder, When it starts, 15 minutes, 1 hour, 1 day or 1 week before). The device's permission state is explained right where you set it, and in settings: allowed, not yet allowed (with a way to allow), or turned off (where to turn it on).

### 6.13 Starting points
- **"Meeting notes"** opens a ready layout: the date, "Who was there:", "What they said", a prices table with a growing total, and next steps. The cursor sits after "Meeting: ".
- **"Start with common items"** fills the tracker with 14 typical items.
- **"Add and start another"** in the vendor and guest sheets keeps capture fast.

---

## 7. Copy and tone

### Voice
- **Warm, plain, a little personal.** The planner talks to the two of you as "you", and in labels it speaks as "we": "Only ones we're keen on", "The one we're leaning towards", "Back to our order", "Our events", "Who can open the planner".
- **British spelling** ("colour", "organiser"), en-GB numbers for counts, and the Indonesian dot grouping for rupiah.
- **Sentence case** everywhere, including buttons and headings. No exclamation marks, and no "Oops".
- **Short sentences. Explain the consequence, not the mechanism.** "It leaves the budget, with its 3 parts…" rather than "This action will delete record #12".
- **No jargon.** "Couldn't load", not "Error 500"; "the planner couldn't reach its database"; "Not connected" becomes "demonstration mode". Commas instead of semicolons and dashes in body copy.

### Button and link verbs
| Do | Say | Not |
|---|---|---|
| Create | **Add** booking / Add a vendor / Add a part / Add items / Add to the schedule | Create, New (except "New document", "New folder") |
| Pay | **Record payment** | Pay, Mark as paid |
| Take out of a list (with undo) | **Remove** booking / part / funder / guest / item | Delete |
| Erase what you wrote, scheduled or stored | **Delete** task / event / folder; **Delete for good** for documents and files | Remove |
| Back out | **Cancel** in forms and sheets that create; **Keep it** in confirms; **Not now** for suggestions | No, Dismiss, Close |
| Finish a sheet that edits (it saved as you went) | **Done** | Save, OK (except the blocked-folder notice) |
| Retry | **Try again** | Retry |
| Move on from comparing | **Book it**, **Copy to the shortlist**, **Move into Vendors**, **Lean towards this one** | Convert, Promote |
| Reset filters | **Clear the search**, **Show everything**, **Show everyone**, **Show every venue** | Reset |
| Page | **Show 100 more**, always with the number | Show more, Load more |

Busy labels are the gerund of the verb: Adding, Recording, Copying, Booking, Moving, Signing in, Saving, Removing, Deleting, Restoring.

### Error wording
Say what happened, that nothing is lost, and what to do:
- "Couldn't save this change. What you typed is kept. Try again"
- "Couldn't save your last changes. They're still here. Try again"
- "The booking wasn't added: the planner lost its connection. Everything you entered is still here."
- "That email and password don't match. Check them and try again, or continue with Google."
- "Too large: 48 MB. Files can be up to 10 MB; only PDFs are shrunk."
- "There's already a category called Catering."
- "Give the booking a name so you can find it later."
- "This is Rp 2.000.000 more than what's left. It will show as overpaid."
- "Includes itself: This total includes its own cell, B7. Change the range so it stops above it."

### Empty-state wording
Name the absence, then say how things arrive:
- "Nothing booked yet. When you choose a vendor or book a venue, it lands here as a booking with its price and payments. You can also add one yourself."
- "No vendors yet. Add a vendor the moment you hear about one: a name is enough. Prices, reviews and files can follow."
- "Try an idea before you commit. Add something you're weighing up, like fireworks or a second photographer, and see what the total would become."
- "Nothing written yet. Start with meeting notes when you sit down with a vendor…"
- "Everything's done. Finished tasks are kept below in case you need one back."

### Confirm wording
Title as a question naming the thing: "Remove Villa Samaya Ubud?" Body: what goes with it, then the undo promise or the permanence. Cancel is always **Keep it**.

### Helpful hints
Where a rule isn't obvious, a hint says it once, quietly:
- "What you noted while comparing. It never changes the agreed price."
- "Paid parts don't need a due date."
- "Mention groom's or bride's so the two sides add up."
- "Just the name is enough for now."
- "Still to pay is always the price minus what's been paid."

---

## 8. Accessibility

### Contrast
Every pair is listed with its ratio at the foot of `tokens.css`. Ink and muted ink pass AA everywhere, including the strongest point of the glow (4.76:1). Rose text uses `--accent-attention-text` (5.68:1 on white, 4.85:1 on its wash). Gold text uses `--accent-gold-text` on white (5.02:1) and `--accent-gold-text-on-tint` on champagne tints (4.97:1 or more). "Not attending" is white on muted ink (5.68:1). Idle controls use `--color-control-outline` (3.34:1) and payment dots gold ink (5.02:1).

**Placeholders** use full muted ink (5,68:1), including the document's "*Untitled*" (decision 21).

Threads and stage steps are below 3:1 too, but they always repeat their meaning in words.

### Focus
- Every focusable thing gets a 2px rose outline with a 3px offset (`:focus-visible`).
- Inline fields add a white fill with a soft rose halo; table cells get a 2px rose inset ring; search fields turn their underline rose.
- Sheets move focus in and return it to what opened them; the menu focuses Close and returns to Menu.
- Focus stays in a search field as results update.

### Keyboard
- **Escape** closes the menu, then any sheet. **Enter** saves an inline rename or a new folder name; **Escape** cancels it. Enter in a document title moves into the body.
- **Alt+↑ / Alt+↓** on a wedding item's handle moves the row; focus stays on the handle (T7). The row menu's "Move up / Move down" do the same without a keyboard.
- **Tab / Shift+Tab** in a document table move between cells instead of leaving the table. **Cmd/Ctrl+K** adds a link.
- Disclosures (parts, tasks, finished tasks, the people filter) are native `<details>`, so Space and Enter work.
- The month grid is built of buttons, one per day, in reading order.

### Screen-reader labels
- Icon buttons carry labels: "Keen on Kebun Bunga Atelier", "Move Wedding cake. Use Alt with the up and down arrows.", "Work on next", "Confirmed", "More for Wedding cake", "Remove step", "Previous month", "Show the full path", "Undo", "Bold"…
- Every thread is `role="img"` with its meaning in words ("54% paid", "59% of the preparation time has passed", "2 of 5 steps done").
- Stage threads include the stage name as text.
- Choice groups use `role="radiogroup"` / `radio` (kind, invited to, RSVP, package, move-to) or `aria-pressed` (toggles, chips).
- The tick box on a task is `role="checkbox"` with "Finish …" / "Reopen …".
- Toasts and save states are live regions (`role="status"`, polite). Sign-in errors are `role="alert"`.
- Loading sets `aria-busy` with a hidden "Loading …" line; skeletons are hidden.
- Search inputs have hidden labels; the date card in a due row is hidden because the meta line says the date in words.
- Guest numbers read "Guest number 12".
- Month cells read everything their marks show: "Wednesday 14 October, today, selected, 2 events", "Saturday 20 March 2027, the wedding day, nothing".

### Reduced motion
Under `prefers-reduced-motion: reduce`, every animation and transition runs in 0.001ms: spinners, shimmer, flash, chevrons and the upload bar.

### Touch targets
- **Pills, toolbar buttons, stars, ticks and steppers:** 34px or more.
- **The RSVP switch** grows on phones to about 34px.
- **Fields:** a 56px minimum row height.
- **Small targets, now at least 24px:** the task tick box (24px), step checkboxes (24px), the step × (32px), event chips on an item row (26px high). The keen heart is about 30px with its padding.

### Language and direction
`lang="en"`. Every piece of user-entered text carries `dir="auto"`, so Arabic and Hebrew names run right-to-left in place while the layout stays left-to-right.

---

## 9. Stress data

How the prototype handles extremes (`?stress` on any screen).

- **Long unbroken names:** names, titles, headings and funder names use `overflow-wrap: anywhere`, so an 85-character name with no spaces wraps and never widens the layout. Amounts never wrap.
  - **Truncated with "…" where the full text is one tap away:** a finalist's next step (120 characters), venue notes in a row (140), guest food notes (90), document extracts (4 lines on a card, 1 line in a row), focus chips (280px), path segments (260px), file meta (1 line).
- **Other scripts and right-to-left:** Chinese, Japanese, Thai and Arabic appear in names, categories, folders, files and documents. `dir="auto"` keeps each in its own direction. Cormorant and Jost fall back to the system's fonts for scripts they don't cover.
- **Thousands of items:** lists page instead of rendering everything:
  - 100: bookings, vendors, guests, files in a folder, open tasks, finished tasks
  - 60: payments, finalists, venues, documents
  - 80: agenda
  - 150: items
  - 50: what-if
  - 200: file search hits
  - the count line says "showing N of M", and the button says how many more. Nothing stops silently.
- **Deep nesting:**
  - **A 40-part booking:** listed in full on the booking; collapsed in the ledger to the first 4 still owing plus "and 36 more parts".
  - **Other collapses:** a 25-part what-if shows 5 + "and 20 more parts"; 30 packages show 4 on a card + "and 26 more packages"; the work-on-next card shows 12 + "and N more"; who would pay shows 8 + "and N more funders".
  - **Folders 30 deep:** the path folds its middle into "…" past four levels; the move tree's indent stops growing after 12 levels.
  - **Documents:** lists four levels deep indent normally.
- **Empty optional fields:** each has a quiet stand-in, not a blank: "No category", "No price yet", "No rating yet", "No estimate", "No location", "Capacity unknown", "Vendor not known yet", "No next step", "No date", "No reviews or followers yet", "Empty" (folder), "*Untitled*". Rows keep their height with a non-breaking space.
- **The longest realistic text:**
  - a 240-character next step wraps in the next card and under a due row
  - a 600-character vendor note with links reads as a paragraph
  - a 40-paragraph document scrolls normally
  - a 50 × 8 table scrolls sideways inside the page, with a 720px minimum
- **Many people or roles:** 15 funders, among them a 90-character family name and four non-Latin ones, wrap in the funder list, the chips and the selects. "paid by 3 funders" replaces lists longer than two.
- **Huge numbers:**
  - a 13-digit price
  - "Rp 9.876.543.210.000.000" figures, which shrink on every screen and never wrap
  - 98.765.432 followers shown as "98,8M"; 12.345 as "12,3k"
  - "Up to 125.000 guests"
- **Tiny and huge images:** a 2 × 2 px image, a 6000 × 400 panorama and a 300 × 5000 portrait. Tiles crop to fill (`object-fit: cover`); the file preview fits whole (`contain`). File sizes from 1 KB to 10,0 MB.
- **Long account email** wraps in the menu and in settings.

---

## 10. Open questions

None. Questions 1–23 are all decided; see below. New questions go here and in `decisions.md`, and a change to anything decided bumps the version.

### Decided (2026-10-14)
The owner's answers to the first 19 questions. All are built into the prototype and described above.

1. A preferred package is in **gold italic everywhere**; the rose ♡ on shortlist cards is gone.
2. Sheets that edit an existing record **save as you go and end with Done**.
3. Demonstration mode: **actions open their sheet; only the final button is disabled**, with "Demonstration mode: adding is turned off."
4. Paging always gives the number: **"Show 60 more"**.
5. "Not attending" uses **muted ink**.
6. Gold text on champagne tints uses **`--accent-gold-text-on-tint`** (`#7d5f27`).
7. The items column is headed **"Confirmed"**.
8. Who pays: **"What each of you and your families have paid, and what's still to pay"**.
9. An overpaid budget says **"Overpaid by"** with a positive figure; the minus always comes first.
10. Very long figures **shrink** on every screen.
11. **Tasks uses the wide column.**
12. **Dots** group thousands in counts too.
13. Demonstration mode shows **no names, no countdown, nobody signed in**.
14. **Targets of at least 24px, `--color-control-outline` for idle outlines, gold-ink payment dots, full month-cell labels.**
15. Tasks and file search **page with a count**; the menu's email **wraps**.
16. "Add files" on a record **opens the shared upload sheet**, filing into a folder named after the record.
17. **Undo on every rename.**
18. The schedule's "Payments" filter **includes your own Payment events**.
19. The shortlist's Order by has **Ascending / Descending**.

### Decided (2026-10-14, at the freeze)
The owner took the designer's suggestion on each of the last four.

20. **Decimals take a comma** and a dot always means thousands: ratings "4,8", file sizes "33,1 MB" and "9,9 MB", big counts "98,8M followers" and "12,3k". Document tables already accepted "2,5".
21. **Placeholders use full muted ink** (5,68:1), keeping the italic: "Vendor not known yet", "No estimate", the document's "*Untitled*" and the faint field placeholders.
22. **The link sheet keeps Save.** "Edit link" changes the link only when you press Save, so a half-typed address never replaces a working link. It is the one editing sheet that does.
23. **F16 and "next step".** A finalist has its own next step; a vendor has none, so copying to the shortlist starts the finalist's blank. The inventory's F16 wording ("next step") is the owner's to change on their side.

