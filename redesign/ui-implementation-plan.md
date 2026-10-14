# UI implementation plan: wedding-planning → Veil

Step 6 of `redesign/redesign-plan.md`, written by Agent C on 2026-10-14. This plan maps the approved design to code. It makes no design decisions: every gap goes to §9.1 and then through the design-gap loop, and every question for the owner is in §9.2.

**Status:** draft, waiting for the owner's approval. No app code has changed. Step 7 (the rebuild) starts only after "Plan approved" is ticked in `redesign/redesign-plan.md`.

**How to use it during the rebuild:** one task per session. Read only that task's section in §7, the design-guide sections it names, and the prototype file it names. Don't open old UI files unless the task says so, and then only for the data calls they make.

---

## 1. Inputs and freeze

| Input | Version | Where |
|---|---|---|
| Design guide | **v1.0 (2026-10-14)**, frozen | `redesign/design/design-guide.md` |
| Tokens | v1.0 (2026-10-14), frozen with the guide | `redesign/design/tokens.css` |
| Prototype | as imported in commit `4f2e474` | `redesign/design/prototype/` (start at `index.html`) |
| Coverage audit | Stage 4, 2026-10-14 | `redesign/design/coverage.md` |
| Design decisions | up to the Stage 5 freeze | `redesign/design/decisions.md` |
| Inventory | **v1.4 (2026-10-14)** | `redesign/handoff/inventory.md` |
| Priorities | `FILLED` | `redesign/handoff/priorities.md` |
| Owner-only notes | Step 2 decisions in §9 | `redesign/inventory-notes.md` |
| Open needs | none before this plan; N1–N11 added by it | `redesign/handoff/needs.md` |
| Codebase | `main` at commit `cadd75c` (2026-10-14) | Next.js 16.2.12, React 19.2.4, firebase 12.17, Tiptap 3.31 |

If the design guide's version changes during the rebuild, the task that needs the change waits for this plan's §3–§5 to be updated to the new version first.

---

## Who builds what

The full table, one row per task with its reason, is §7.0. Picks use only rows from the model table in `~/.claude/CLAUDE.md`, by the minimum viable model rule. Opus 5.5 Low and Sonnet 5.5 Medium are never used.

**Tier list**

| Kind of work in this project | Row | Cost / task |
|---|---|---|
| Can lose data or break production: the write layer, Firestore rules, live migrations, money write operations, the document editor core, the service worker, push reminders, permanent file deletion, the switch-over | **Opus 5.5 High** (each row names its risk) | $1.82 |
| Hard work with no reference: the money model, auth gate and providers, document tables and formulas; reviews of Phases 2–6, 8 and 9 | **Opus 5.5 Medium** | $1.34 |
| UI from a prototype screen that needs judgment (real data, sheets, interaction), tests, tooling, model functions with written rules | **Sonnet 5.5 High** | $0.88 |
| Straight porting of prototype markup and styles, tokens, screens that only display model data, states, scripts | **Haiku 5.5 Max** | $0.21 |
| The simplest ports: icon set, gallery route, CSV columns, device checklist | **Haiku 5.5 xHigh** | $0.12 |

**Tasks per model and estimated cost** (the table's cost per task; tasks marked L in §7.0 count twice)

| Model · effort | Tasks | Reviews and other | Est. cost |
|---|---|---|---|
| Opus 5.5 High | 9 | 2 reviews (Phases 1 and 7) | $21.84 |
| Opus 5.5 Medium | 3 | 7 reviews (Phases 2–6, 8, 9) | $14.74 |
| Sonnet 5.5 High | 37 | 1 design-gap round in the studio | $36.96 |
| Haiku 5.5 Max | 28 | the calibration trial's second build | $7.14 |
| Haiku 5.5 xHigh | 4 | | $0.48 |
| Haiku 5.5 High | 0 | the design-gap scan and import | $0.16 |
| **Total** | **81 tasks** | **9 reviews, 1 trial, 1 gap round** | **≈ $81** |

Allow about 20% on top (≈ $98) for escalations, retries and further design-gap rounds. Reviews and the rebuild run at the picked effort; check `/cost` after each session and log real costs in §7.0.

---

## 2. Technical architecture

### 2.1 Project constraints (from Step 0)
- **Framework:** Next.js 16.2 App Router, React 19.2, TypeScript. Before any Next.js structure, read the matching guide in `node_modules/next/dist/docs/01-app/`. The ones this plan relies on: `03-api-reference/03-file-conventions/route-groups.md` (several root layouts), `layout.md`, `page.md` (`params` is a Promise), `not-found.md`, `error.md`, `route.md`, `01-metadata/manifest.md` and `app-icons.md`, `01-getting-started/13-fonts.md`, `02-guides/progressive-web-apps.md` (web push), `02-guides/environment-variables.md`. Since Next.js 16, Middleware is called Proxy (`01-getting-started/16-proxy.md`); this plan doesn't need one.
- **Build and lint:** `npm run build`, `npm run lint`. Phase 1 adds `npm test` and `npm run test:e2e`.
- **Data backend:** Firebase Firestore through the client SDK with realtime listeners, Firebase Auth, files on Cloudinary (unsigned preset). Collections and field names stay, so live data survives the switch-over (`inventory-notes.md` §6).
- **Hosting:** Vercel project `wedding-planning`, Node 24. Every push to `main` deploys to production, so the rebuild lives on the `redesign` branch and is reviewed on preview deploys until Phase 7 merges.
- **Repo rule:** commit and push after every change, with an `AGENTS.md` change-log entry. During the rebuild, push to `redesign`, not `main`.

### 2.2 Running next to the old app
The two UIs live in one Next.js app as two route groups, each with its own root layout. Navigating between them is a full page load, which is what we want: no CSS or providers leak across.

| | Phases 1–6 (building) | Phase 7 (switch-over) until Phase 9 |
|---|---|---|
| Old UI | `src/app/(legacy)/…`, at today's URLs (`/`, `/vendors`, …) | `src/app/(legacy)/old/…`, at `/old/…`, frozen |
| New UI | `src/app/(veil)/new/…`, at `/new/…` | `src/app/(veil)/…`, at `/`, `/budget`, … |
| Shared | `src/app/manifest.ts`, `src/app/api/…`, `public/sw.js`, `src/lib/**` | same |

- **Phase 1** moves every old page and the old root layout into `(legacy)` (no URL changes), and routes every old internal link and redirect through one helper, `legacyHref(path)`, which returns the path unchanged for now. That's the only edit to old rendering code before Phase 7.
- **Phase 7** is one commit: move `(veil)/new/*` up to `(veil)/*`, move `(legacy)/*` into `(legacy)/old/*`, set the `legacyHref` base to `/old`, and add redirects for old addresses that have no new page (§7, Task 7.1). Reverting that one commit puts the old UI back at `/` and the new one at `/new` (§9.3).
- New paths never collide with old ones during the build because they all start with `/new`.

### 2.3 File layout at the end
```
src/
  app/
    (veil)/                      the new UI (root layout: fonts, tokens, providers)
      layout.tsx  page.tsx       overview at /
      sign-in/  settings/
      budget/  budget/bookings/  budget/bookings/new/  budget/bookings/[bookingId]/
      budget/payments/  budget/who-pays/  budget/what-if/
      vendors/  vendors/[vendorId]/  vendors/shortlist/  vendors/shortlist/[finalistId]/  vendors/venues/
      items/  guests/
      schedule/  schedule/month/  schedule/tasks/
      documents/  documents/[documentId]/  documents/files/
      not-found.tsx  error.tsx    after need N2 is designed
    (legacy)/old/…               frozen fallback, deleted in Phase 9
    api/files/[fileId]/route.ts  delete for good (Cloudinary destroy)
    api/push/…/route.ts          subscribe, unsubscribe, test reminder
    api/cron/reminders/route.ts  sends due reminders (Vercel cron)
    manifest.ts  icon and apple-icon files (after need N1)
  veil/                          UI layer: everything that renders
    styles/tokens.css            verbatim copy of redesign/design/tokens.css
    styles/fonts.ts              next/font setup
    styles/base.css              page glow, type, focus, .num, .sr, reduced motion
    icons/                       inline SVG components
    shell/                       top bar, menu index, sub-navigation, back link, add button, banners, toasts, sheets, confirm
    parts/                       design-guide §4 components, one folder each, with a *.module.css
    editor/                      Tiptap wiring: toolbar, table bar, formula bar, popovers, content styles
    screens/                     one folder per screen: the client component and its module CSS
    gallery/                     dev-only component gallery (Phase 3)
  lib/
    model/                       pure functions, no React, no Firebase (Phase 1)
    data/                        hooks and writes: Firestore + model, the only place screens get data from
    collections/  use-collection.ts  firebase.ts  auth-context.tsx   kept plumbing
    server/                      firebase-admin, token check, Cloudinary, web push (server only)
scripts/
  migrate/                       one-time, idempotent migrations (Task 1.11)
  check-old-names.mjs  old-names.txt
tests/
  model/*.test.ts                Vitest
  e2e/*.spec.ts                  Playwright, against the Firebase emulator
```

### 2.4 Naming convention
Nothing in the new UI reuses an old name.
- **Folders:** the new UI is `src/veil/` and `src/app/(veil)/`. Old code stays in `src/components/` and `src/app/(legacy)/` until it's deleted.
- **Components:** PascalCase, named after the design guide's own terms (`TopBar`, `MenuIndex`, `SubNav`, `Hero`, `Figure`, `Thread`, `NextCard`, `Doors`, `BookingEntry`, `DueRow`, `MenuCardList`, `Tally`, `FieldRow`, `SaveLine`, `FocusChips`, `CountLine`, `SortedNote`, `Sheet`, `ConfirmSheet`, `ToastHost`, `Banner`, `Message`, `Shimmer`, `FileTiles`, `UploadSheet`, `StageThread`, `KeenHeart`, `WhatsAppLink`, `AgendaRow`, `MonthCalendar`, `TaskRow`, `ItemRow`, `GuestRow`, `RsvpSwitch`, `InstallCard`, `NotificationState`). Where a guide term would repeat an old primitive's name, use these instead: `Btn` (not Button), `Frosted` (not Card), `Shimmer` (not Skeleton), `Sheet` (not Dialog), `Problem` (not Alert), `FieldInput`, `FieldSelect`, `FieldText`, `Check`, `Pop` (not Popover), `RowMenu` (not DropdownMenu), `DocTable` (not Table).
- **Files:** kebab-case (`next-card.tsx`, `next-card.module.css`).
- **CSS:** CSS Modules. Local class names follow the prototype's selectors (`.entry`, `.thread`, `.over`), so ports stay close to the reference; they're hashed at build, so they never reach the DOM as plain names. The only global classes are the few in `base.css` (`.num`, `.sr`, `.flash`) and Tiptap's own `.ProseMirror`.
- **Custom properties:** only the names in `tokens.css`. The prototype uses older variable names (for example `--ink`, `--rose-ink`); `tokens.css` lists each one in brackets beside its new name. Ports translate them, never copy them.
- **Data attributes and ids:** `data-state`, `data-kind` and so on, named from the guide. No `data-slot` (an old primitive attribute).

### 2.5 Theming through tokens
- `src/veil/styles/tokens.css` is a byte-for-byte copy of the frozen `redesign/design/tokens.css`. It changes only when the guide's version changes.
- Every colour, size, radius, shadow, duration and z-index in `src/veil/**` comes from a token. `scripts/check-veil-styles.mjs` (Task 2.1) fails on raw colours (`#…`, `rgb(`, `hsl(`, `oklch(`) outside `tokens.css`.
- Light only: `color-scheme: light` on the new root, no dark tokens. The old `.dark` block in `globals.css` stays with the old UI.
- Breakpoints are `@media (max-width: 760px)`, `860px` (items) and `900px` (document cards), as in the guide §2. CSS can't read custom properties in media queries, so each module writes the number and a comment naming the token (`/* --bp-phone */`).
- Layers use the `--z-*` tokens, in the guide's order (add button 5 up to toasts 50).

### 2.6 Fonts and icons
- **Fonts:** `next/font/google` in `src/veil/styles/fonts.ts`. Cormorant Garamond (variable, weights 300–700, normal and italic) and Jost (variable, 300–600, which covers the guide's 340 and 450), `display: 'swap'`, Latin subset. Each exposes a CSS variable (`--font-cormorant`, `--font-jost`). Because next/font renames the families, `base.css` sets `--font-display` and `--font-text` to those variables plus the same fallbacks as `tokens.css`; that's wiring, not a token change. Other scripts fall back to system fonts (guide §9). The old layout keeps loading Inter for itself only.
- **Icons:** no icon library in the new UI. `src/veil/icons/` holds the prototype's line drawings as small components: chevron, back, search, ribbon knot, struck cloud, WhatsApp, heart, envelope folder, six-dot handle, star, tick, Google mark, file-type tag. Each is `aria-hidden`; the control around it carries the label (guide §8). `lucide-react` goes with the old UI in Phase 9.

### 2.7 Data separated from rendering
Three layers, and screens only touch the top one.
1. **`src/lib/model/`: pure functions.** Every rule in the guide §6.8–§6.11 and the decided bugs (`inventory-notes.md` §9) lives here, with unit tests: money (still to pay = price − paid, parts, overpaid, dues, funder roll-up, what-if totals, splitting), bookings derived from vendor and venue records, guest headcounts and sides, item ordering, agenda merging, urgency, month cells, dates and relative times, number formats, stage and value labels, WhatsApp numbers, search and ordering, the SUM engine, reminders due.
2. **`src/lib/data/`: hooks and writes.** Hooks combine the existing collection listeners with the model (`useBudget()`, `useBookings()`, `useBooking(id)`, `useDues()`, `useFunders()`, `useVendors()`, `useAgenda(range)`, `useGuests()` …) and return `{ status, data }`, where `status` is `loading | ready | error | offline | demo`. Writes go through one write layer (Task 1.8): client-made ids so a retry never duplicates, a 10-second timeout that turns a hung offline write into a failure the screen can show (guide §6.1), `updatedBy` and `createdBy` on every write, an activity entry for partner news, transactions for every change to an embedded array (parts, price options, packages, steps), and remove-with-undo that restores the same id and fields.
3. **`src/veil/screens/`: rendering only.** No Firebase imports, no money maths. A lint rule (`no-restricted-imports` for `firebase/*` and `@/lib/collections/*` inside `src/veil/**`) enforces it.

**Stored values stay; labels change in the model.** The new UI shows the guide's words but writes the stored values, so the old UI keeps working on the same data:

| Field | Stored value → label in the new UI |
|---|---|
| Vendor stage `status` | List → Noted · Inquiring → Inquiring · Consideration → Considering · Chosen → Chosen · Done → Done · Rejected → Ruled out |
| Venue stage `status` | Shortlist → Noted · Contacted → Contacted · Toured → Visited · Booked → Booked · Rejected → Ruled out |
| Guest `eventType` | Both → Both events · Matrimony → Ceremony only · Reception → Reception only · Reception Shortlist → Reception if space allows · Unsure (Abroad) → Unsure, living abroad |
| Guest `rsvpStatus` | pending → Waiting · yes → Attending · no → Not attending |
| Item `types[]` | Reception · Matrimony → Holy matrimony · Sangjit · Pre-Wedding → Pre-wedding |
| Item `persons[]` | General · Groom · Bride · Groom Dad → Groom's father · Groom Mom → Groom's mother · Groom Brother → Groom's brother · Groom Sister → Groom's sister · Bride Dad → Bride's father · Bride Mom → Bride's mother · Bride Brothers → Bride's brothers (one per item in the design; see §9.2 Q4) |
| Schedule `type` | vendor_call → Vendor call · organiser_call (new value) → Organiser call · appointment · payment · deadline · other |
| Schedule `reminderMinutes` | `[]` No reminder · `[0]` When it starts · `[15]` · `[60]` · `[1440]` · `[10080]` (0 and 10080 are new) |
| `funder` on records | the id of a `funders` document. The four existing funders get the stored strings as their ids (`CK`, `Gregory`, `Bella`, `Bella Fam`), so no record changes and the old UI still reads them; new funders get generated ids. `null` → Not assigned |
| Vendor fields | `starred` → keen · `bridestoryRating` → rating · `bridestoryReviewCount` → reviewers · `priceOptions[].selected` → the one we're leaning towards |

**New fields and collections (all additive).** Old documents without them still read correctly through the model's adapters.
- `vendors`, `venues`: `booking: { on: 'YYYY-MM-DD' | null, from: 'vendor' | 'venue' | 'finalist' | 'direct', removed: boolean }`, `estimate` (vendors; venues keep `budgetEstimate` as their estimate), `agreedPrice` (venues). A booking is a vendor or venue with `booking` set and not removed. Direct bookings (guide §5.7) are vendor documents with `booking.from = 'direct'`, left out of the Vendors list. Booking ids in URLs are `vendor-<id>` and `venue-<id>`.
- `shortlist`: `sourceVendorId`, `preferredPackageId` (the top-level price is package `main`), `movedTo: { kind: 'booking' | 'vendor', id }`.
- `hypotheticalItems`: `funder`.
- Bookings and their parts (on `vendors`, `venues` and `subEntries[]`): `payments[]` (`id`, `amount`, `paidOn`, `funder`, `receiptFileId`), a history kept beside `budgetSpent`, which stays the total (§9.2 Q5).
- `guests`: `number`, issued from `guestMeta/counter` in a transaction and never reused.
- `todos`: `doneOn`.
- `scheduleEvents`: `remindersSent[]`.
- `settings/wedding`: `startedOn` (the start of "time gone", guide §6.11).
- `weddingFiles`, `fileFolders`: `recordRef: { kind: 'vendor' | 'venue' | 'booking' | 'finalist', id, partId? }` for files and the folders named after records (guide §4.20).
- Every document: `createdBy`, `updatedBy` (uid).
- New collections: `funders` (name, order), `members` (email, provider, lastSeenAt; one per account), `activity` (by, at, kind, params, target), `presence` (documentId, uid, at), `pushSubscriptions` (uid, endpoint, keys, device label), `guestMeta`, `appMeta/migrations`.

**Files on records.** A file has one home: a `weddingFiles` document in a folder. Records show the files whose `recordRef` points at them, plus, for a finalist copied from a vendor, the vendor's files (F20), and, for a booking, the files of the vendor, venue or finalist it came from. Nothing is copied, so "Delete for good" removes a file everywhere at once. Legacy `files[]` arrays on records are imported once (Task 1.11), and new uploads are also appended to the legacy array so the frozen fallback still sees them until Phase 9.

### 2.8 Special surfaces
- **Document editor:** Tiptap stays, because existing documents are Tiptap JSON (`inventory-notes.md` §6). The content styles in `src/veil/editor/content.module.css` target `.ProseMirror` under the paper element with `:global`. The editor reads old documents unchanged and only normalises fonts, sizes and colours as decided in §9.2 Q10. Formula results are drawn, never stored, as today.
- **Exports:** the vendor CSV is plain text; its columns follow need N5.
- **PDF shrinking:** `src/lib/compress-pdf.ts` and `public/pdf.worker.min.mjs` stay as plumbing. Its output is the user's own file, so it has no styling.
- **Guest or shared-link views, print and email:** none exist, and the design has none.
- **Manifest, app icons, favicon, theme colour:** wait for need N1.
- **Service worker:** rewritten in Task 6.1. Navigations go to the network only, so a stale UI is never served. Static assets are cached by hashed URL, the old `wedding-planner-v2` cache is deleted, and the worker handles `push` and `notificationclick`.

### 2.9 Server pieces (new)
The app has no server code today. Three features need some, all as route handlers on Vercel's Node runtime:
- **Delete for good (R13):** `DELETE /api/files/[fileId]` checks the Firebase ID token and the two-account allowlist, destroys the Cloudinary asset with the API secret, then deletes the `weddingFiles` document.
- **Reminders (S10):** `POST /api/push/subscribe`, `POST /api/push/unsubscribe` and `POST /api/push/test` save or use a device's push subscription. `GET /api/cron/reminders` runs **once a day** (Vercel Hobby limits cron to daily, within the hour; §9.2 Q8): it sends every reminder whose day has come ("1 day before" and "1 week before") and isn't in `remindersSent`, with web push and VAPID keys, and records what it sent. The schedule is `0 0 * * *` UTC (07:00–08:00 in Jakarta, 08:00–09:00 in Bali); the reminder choices follow need N11.
- **Shared server helpers** in `src/lib/server/`: `firebase-admin` (service account), `verifyRequest()` (ID token plus allowlist), Cloudinary signing, `web-push`.
- **New environment variables** (the owner adds them in Vercel, §9.2 Q9): `FIREBASE_SERVICE_ACCOUNT`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`.
- **Firestore rules** (`firestore.rules`) gain the new collections under the same allowlist. Rules deploy separately with the Firebase CLI and apply to production at once, so rule changes are additive only and are deployed in Task 1.9, before any code that needs them.

---

## 3. Component map

One row per component in the design guide §4. **Selectors** are the prototype's, used as local class names in the module CSS. **States** say how code switches each variant on: a module class (`.x`), an attribute or an ARIA state. Every component lives in `src/veil/parts/<folder>/` (or `shell/`, `editor/`) as `<name>.tsx` plus `<name>.module.css`, and appears in the dev gallery (Task 3.0) in every state. "Built in" is the §7 task.

| Guide | Component · file | Selectors | Variants and states → how code triggers them | Responsive and accessibility | Built in |
|---|---|---|---|---|---|
| 4.1 Top bar | `TopBar` · `shell/top-bar.tsx` | `.top`, `.couple`, `.menu-btn` | names from settings, or "Our wedding planner" when `status === 'demo'`; inside the menu the button reads Close (`open` prop) | 20px padding under 760px; long names wrap; Menu has `aria-expanded`, `aria-controls` | 2.4 |
| 4.2 Menu index | `MenuIndex` · `shell/menu-index.tsx` | `.index`, `nav ol`, `.account` | current section `aria-current="page"`; demo account line; `hidden` when closed | `role="dialog"`, `aria-modal`; opening focuses Close; Escape and Close return focus to Menu; the email wraps | 2.4 |
| 4.3 Sub-navigation | `SubNav` · `shell/sub-nav.tsx` | `.subnav` | sets `vendors`, `records`, `schedule`; current `aria-current="page"` | wraps on narrow widths; `nav` with an `aria-label`; not rendered in a folder or on detail screens | 2.4 |
| 3 Back link, add button | `BackLink`, `AddButton` · `shell/` | `.back`, `.add-fab` | add button hidden while editing a document on a phone (`data-editing` on body) | 20px from the edges on a phone; the page keeps 120px (phone 140px) at the bottom | 2.4 |
| 4.4 Hero, figure, thread | `Hero`, `Kicker`, `Figure`, `Context`, `Thread` · `parts/hero/` | `.hero`, `.kicker`, `.figure`, `.figure.md`, `.days-fig`, `.rp`, `.context`, `.thread`, `.thread.small`, `.over`, `.maybe` | figure `tone`: `late` → `.late`, `over` (kicker "Overpaid by", rose), `settled` (gold); `long` when more than 13 digits (`longFigure()` in the model); thread `small`, `over`, `maybe` (dashed what-if part) | figures never wrap; phone sizes from tokens; every thread `role="img"` with an `aria-label` in words | 3.1 |
| 4.5 Next card | `NextCard`, `AfterLine` · `parts/next-card/` | `.card.next`, `.flag`, `.flag.gold`, `.flag.calm`, `.after` | flag from `urgency()`: late → rose, soon (≤14 days) → `.gold`, later → `.calm`; empty variant; label "Next to pay, 1 of 3 late" | stacked under 760px, flag first; Record payment is the one primary | 3.2 |
| 4.6 Doors | `Doors`, `Door` · `parts/doors/` | `.doors` | summary may hold one rose fragment (`attention` part) | summary moves under the name on a phone; each door is a link with its summary in its name | 3.2 |
| 4.7 Ledger rows | `BookingEntry`, `WhatIfEntry`, `VendorRow`, `DueRow`, `DocumentRow`, `FileRow`, `GuestRow` (shell), `AgendaRow`, `TaskRow`, `ItemRow` · `parts/rows/` | `.ledger`, `.entry`, `.vrow`, `.due`, `.drow`, `.frow`, `.grow`, `.ag`, `.tk`, `.irow` | shared row states: `.flash` (just changed; added for 2.4s by `useFlash(id)`), `.ruled`, `.completed`/`.cancelled`, `.done`, `.next`, `.failed` (+ `.row-err` line) | empty meta keeps height with a non-breaking space; names `dir="auto"` and `overflow-wrap:anywhere`; amounts `nowrap` | 3.5 (rows), 3.11, 3.12 |
| 4.8 Parts, menu cards, tally | `PartLines`, `PartDisclosure`, `MenuCardList`, `Tally` · `parts/menu-card/` | `.parts`, `.part`, `.part[open]`, `.menu-card`, `.tally`, `.carry`, `.pkgs` | leader `dashed` for hypothetical; part line tone: due, late (rose), paid (sage), overpaid (rose), no date; collapse to 4 owing + "and N more parts" (model `collapseParts()`); preferred option gold italic | parts are native `<details>`; leaders are decoration (`aria-hidden`) | 3.6 |
| 4.9 Fields | `Fields`, `FieldRow`, `FieldInput`, `MoneyInput`, `DateInput`, `FieldSelect`, `FieldText`, `Check`, `Stepper`, `StaticValue`, `Hint`, `SaveLine`, `BigInput`, `InlineRename`, `NotesView` · `parts/fields/` | `.fields`, `.field`, `.field.failed`, `.field[aria-disabled]`, `.hint`, `.save-state`, `.save-state.failed`, `.big-input`, `.notes-view` | every field is driven by `useAutosaveField()` (Task 3.4): `idle → saving → saved`, `failed` keeps the typed value and adds `.failed` plus the Try again line; `aria-disabled` when demo; a cleared name restores the old one | label column 180px (130px in sheets), stacked under 760px; 56px minimum height; money uses `inputmode="numeric"` and reformats on blur; the save line is `role="status"` | 3.4 |
| 4.10 Chips | `Chip`, `ChipGroup` · `parts/chips/` | `.chip`, `.chips`, `.chip.dashed`, `.ev`, `.focus` | pressed `aria-pressed="true"`; single choice `role="radiogroup"` + `role="radio"` + `aria-checked`; `dashed` for management; `.ev` small event chips | at least 24px high (event chips 26px) | 3.3 |
| 4.11 Buttons and links | `Btn`, `TextLink`, `DirectionWord` · `parts/actions/` | `.btn`, `.btn.quiet`, `.btn.small`, `.btn.danger`, `.btn.busy`, `.link`, `.link.rose`, `.dir` | `variant`; `busy` prop shows the spinner and the gerund label; `disabled` and `aria-disabled` in demo; Google variant on sign-in only | at least 34px for pills | 3.3 |
| 4.12 Search and ordering | `SearchField`, `OrderBy`, `FilterSelect`, `RangeField`, `FilterCheck`, `ShowEverything`, `CountLine`, `SortedNote`, `ShowMore` · `parts/tools/` | `.tools`, `.search`, `.order`, `.filters`, `.range`, `.toggles`, `.count`, `.sorted-note` | order direction defaults from the model (numbers descending, text ascending, blanks last); Show everything appears when any filter is on; Show N more always carries the number | search has a hidden label and keeps focus while results update | 3.7 |
| 4.13 Focus chips | `FocusChips` · `parts/chips/` | `.focus .chip` | one pressed; choosing one resets paging; "Edit categories" dashed | one sideways-scrolling line on a phone; names cut with an ellipsis at 280px | 3.3 |
| 4.14 Sheets | `Sheet`, `SheetHost`, `CreateSheetActions`, `EditSheetActions` · `shell/sheet.tsx` | `.scrim`, `.sheet` | `mode='create'` (Cancel · primary; demo line and disabled primary in demo) or `mode='edit'` (save line + Done); failed save line; optional rose link | bottom sheet under 760px (92% height max); `role="dialog"`, `aria-modal`, focus to `autoFocus` or first control, Escape and scrim close, focus returns to the opener | 2.6, 3.8 |
| 4.15 Confirm | `ConfirmSheet`, `InlineConfirm`, `BlockedNotice` · `shell/confirm.tsx` | `.sheet` with `.btn.danger` | `confirm({ title, body, action })` returns a promise; the action turns busy ("Removing", "Deleting") until the write resolves; inline variant inside the categories sheet; blocked variant with OK | Keep it is the first focus | 2.6, 3.8 |
| 4.16 Toasts | `ToastHost`, `useToast()` · `shell/toasts.tsx` | `.toasts`, `.toast`, `.ava` | kinds: confirmation, undo, next step, partner (9s, initial), demo; Undo turns into disabled "Restoring" until the restore resolves; the undo window equals the toast's life | 90px up on a phone, 120px in the editor on a phone; `role="status"`, `aria-live="polite"`; sits above sheets | 2.6 |
| 4.17 Banners | `Banner`, `Problem` · `shell/banner.tsx` | `.banner`, `.banner.rose`, `.banner-wrap`, `.problem`, `.problem.calm` | gold (demo, partner in document, first items), rose inline box (couldn't add); sign-in problem rose or calm | sign-in errors `role="alert"` | 2.5, 3.8 |
| 4.18 Messages | `Message` · `parts/message/` | `.message`, `.message.inline`, `.mark` | `kind`: nothing-yet (knot), no-results (no mark, quoted search), failure (knot), offline (cloud), gone; `inline` keeps title and sub-navigation | max 460px, centred | 2.5 |
| 4.19 Skeletons | `Shimmer` · `parts/shimmer/` | `.sk`, `.sk.line`, `.sk.fig`, `.sk.card`, `.sk.row` | one shape for every screen | `aria-hidden`; `main` gets `aria-busy="true"` plus a hidden "Loading …" line | 2.5 |
| 4.20 File tiles and uploads | `FileTiles`, `UploadSheet`, `UploadQueue`, `EnvelopeIcon`, `PathTrail`, `FileDetailsSheet`, `MoveSheet` · `parts/files/` | `.files`, `.file`, `.file.bad`, `.file.drop`, `.bar`, `.drop-zone`, `.drop-zone.over`, `.queue`, `.qs.ok`, `.qs.bad`, `.frow.folder`, `.crumbs`, `.preview`, `.tree` | per-file status from the upload pipeline: uploading %, shrinking, uploaded, uploaded and shrunk, too large, failed (Try again), demo; drag-over adds `.over`; path folds past four levels; move targets disabled with notes | tiles 150px+, two across on a phone; images `object-fit: cover` in tiles and `contain` in the preview; move tree is a radiogroup, indent stops at 12 levels | 3.10, 4.19 |
| 4.21 Stage thread | `StageThread`, `StageChips` · `parts/stage/` | `.stage`, `.stage.out`, `.steps` | filled up to the current stage; ruled out drawn apart; chips set the stage, and Chosen or Booked creates a booking through the write layer | stage name always present as text | 3.9 |
| 4.22 Keen heart | `KeenHeart` · `parts/keen/` | `.keen`, `.keen[aria-pressed="true"]` | toggles `starred`; toast on change | `aria-pressed`, label "Keen on …"; about 30px with padding | 3.9 |
| 4.23 WhatsApp | `WhatsAppLink` · `parts/whatsapp/` | `.wa` | label "WhatsApp" in rows, "Message on WhatsApp" on detail screens; nothing when there's no number (`waHref()` in the model) | opens `wa.me` in a new tab with `rel="noopener"` | 3.9 |
| 4.24 Editor | `EditorToolbar`, `TableBar`, `FormulaBar`, `ColourPop`, `HighlightPop`, `TableSizePop`, `LinkBubble`, `LinkSheet`, `DocSaveState`, `Paper` · `editor/` | `.toolbar`, `.tb`, `.tg`, `.tsel`, `.table-bar`, `.fx`, `.fx-err`, `.fx-hint`, `.pop`, `.pop-h`, `.swatches`, `.sw`, `.bubble`, `.paper`, `.doc-title`, `.doc-meta`, `.save-state.unsaved` | pressed formatting `aria-pressed`; table bar shown only while the cursor is in a table; save state `saved | unsaved | saving | failed | offline | demo`; link sheet keeps Save (decision 22) | toolbar sticks on desktop, docks above the keyboard on a phone (`visualViewport`), save state floats at the top on a phone; `role="toolbar"`; Tab moves between cells; Cmd/Ctrl+K adds a link | 4.17, 4.18 |
| 4.25 Agenda | `AgendaGroup`, `AgendaRow` · `parts/agenda/` | `.agenda`, `.group-h`, `.group-h.late`, `.ag`, `.ag.payment`, `.ag.task`, `.ag.is-late`, `.ag.completed`, `.ag.cancelled` | kind label colour by kind; payment and task rows link to their record; Record payment primary when late | time column 58px on a phone, flags move under the text | 3.11 |
| 4.26 Month | `MonthCalendar` · `parts/month/` | `.cal`, `.month-head`, `.grid`, `.mc`, `.mc.today`, `.mc.sel`, `.mc.wed`, `.mc.empty`, `.dots`, `.legend` | dots by kind (max 3, then "+N"); today, selected, wedding day | one button per day in reading order, Monday first, `aria-pressed` on the chosen day, full labels from the model (`monthCellLabel()`); phone hides "+N" and ♡ | 3.11 |
| 4.27 Task rows | `TaskRow`, `StepRow`, `FinishedTasks` · `parts/tasks/` | `.task-list`, `.tk`, `.tk[open]`, `.tk.done`, `.steps-list` | open/closed via `<details>`; tick `role="checkbox"` "Finish …"/"Reopen …"; failed step line | 24px tick box and step checks, 32px × | 3.12 |
| 4.28 Item rows | `ItemRow`, `ItemHandle`, `ItemRowMenu`, `WorkOnNextCard` · `parts/items/` | `.ihead`, `.ilist`, `.irow`, `.irow.next`, `.irow.failed`, `.irow.dragging`, `.irow.drag-over-top`, `.handle`, `.evs`, `.ev`, `.tog.star`, `.tog.conf`, `.rowmenu`, `.nextcard`, `.dd` | star and tick `aria-pressed`; handles hidden while any sort or filter is on; drag shows a rose line; Alt+↑/↓ moves and keeps focus | stacked under 860px with no column heads; 34px star and tick | 3.12 |
| 4.29 Guest rows and RSVP | `GuestRow`, `RsvpSwitch`, `HeadcountsCard`, `SidesCard` · `parts/guests/` | `.grow`, `.seg`, `.counts`, `.sides`, `.tally`, `.stepper`, `.unclear` | switch pressed colour per value; failed reply line | segments grow on a phone; guest number read as "Guest number 12" | 3.12 |
| 4.30 Install, notifications, settings bits | `InstallCard`, `NotificationState`, `AccountsList` · `parts/device/` | `.install`, `.who`, `.steps-how` | notification `granted | default | denied` (+ unsupported, need N6); install card shown once per device (stored in `localStorage`) | copy says "phone" or "computer" by width | 3.9, 6.4 |
| 4.31 Excluded | none | `.proto`, `index.html` | not built | | |

---

## 4. Screen map

Routes are final; during Phases 2–6 each sits under `/new`. Every screen is a server `page.tsx` that renders one client component from `src/veil/screens/`. **Replaces** names the old code whose job it takes over (for Phase 7 deletion only, never as a reference).

| Screen · prototype · guide | Route | Components | Reads (hooks in `lib/data`) | Replaces | States (every one is a row in §5) | Task |
|---|---|---|---|---|---|---|
| Sign in · `signin.html` · §5.1 | `/sign-in` | gate, `Btn` (Google), fields, `Problem` | auth state, `members` | `(legacy)/login/page.tsx` | normal, signing in, wrong email or password, account not allowed, just signed out, offline, not connected (demo); Google window closed or blocked (N4) | 4.1 |
| Overview · `overview.html` · §5.2 | `/` | `TopBar`, `Hero` (days), `Thread`, agenda rows, `Doors`, `InstallCard`, date field | `useSettings`, `useComingUp(5)`, `useBudget`, `useTasks`, `useGuests`, `useItems` | `(legacy)/page.tsx` | normal, no wedding date, just started, install suggestion, loading, couldn't load, offline, demo, Bella's change, stress; wedding day and after (N7) | 4.2 |
| Wedding settings · `settings.html` · §5.3 | `/settings` | `Fields`, `SaveLine`, `AccountsList`, `NotificationState`, install steps, `Doors` | `useSettings`, `useMembers`, push permission | `(legacy)/settings/page.tsx` | normal, change didn't save, notifications not yet allowed, turned off, installed, loading, offline, demo; can't receive reminders (N6) | 4.25 |
| Budget · `budget.html` · §5.4 | `/budget` | `Hero`, `NextCard`, `AfterLine`, `Doors`, `AddButton`, record-payment sheet | `useBudget`, `useDues`, `useFunders`, `useWhatIf` | `(legacy)/confirmed/page.tsx` (totals, reminders) | normal, nothing booked, loading, couldn't load, offline, demo, Bella's change, overpaid, stress, record a payment, menu | 4.3, 4.4 |
| Bookings · `bookings.html` · §5.5 | `/budget/bookings` | `BackLink`, tools, `BookingEntry`, `PartLines`, `ShowMore` | `useBookings` | Confirmed table | normal, nothing booked, no results, loading, couldn't load, offline, demo, Bella's change, stress, just added | 4.5 |
| A booking · `booking.html` · §5.6 | `/budget/bookings/[bookingId]` | `Hero`, `NextCard`, `Fields`, `PartDisclosure`, `FileTiles`, `ConfirmSheet` | `useBooking(id)`, `useFunders`, `useRecordFiles` | Confirmed rows and sub-entries | in parts, single, overpaid, late, paid in full, change didn't save, uploading, removed by Bella, loading, couldn't load, offline, demo, Bella's change, stress, split / remove part / remove booking; unknown booking date (N8) | 4.6 |
| Add a booking · `booking-new.html` · §5.7 | `/budget/bookings/new` | `Fields`, funder chips, `UploadSheet`, `Problem` | `useFunders`, categories | Confirmed "Add vendor" | normal, adding, couldn't add, missing name, demo, offline | 4.7 |
| Payments due · `payments.html` · §5.8 | `/budget/payments` | `Hero`, `DueRow` (date card), groups, `ShowMore` | `useDues` | Confirmed payment reminders | normal, nothing due, loading, couldn't load, offline, demo, Bella's change, stress | 4.8 |
| Who pays · `funders.html` · §5.9 | `/budget/who-pays` | funder rows, `Thread small`, `InlineRename`, `ConfirmSheet` | `useFunderTotals` | Confirmed funder recap, hard-coded funder list | normal, nothing booked, demo, renaming, adding, overpaid funder, remove, loading, couldn't load, offline, Bella's change, stress | 4.9 |
| What-if items · `whatif.html` · §5.10 | `/budget/what-if` | `Hero` (dashed thread), carry lines, `WhatIfEntry`, what-if sheet | `useWhatIf`, `useBudget`, `useFunders` | Confirmed "Hypothetical" table | normal, no items, loading, couldn't load, offline, demo, stress, change didn't save, Bella adds an idea, add, edit, split into parts | 4.10 |
| Vendors · `vendors.html` · §5.11 | `/vendors` | `SubNav`, `FocusChips`, tools, `VendorRow`, category headings, add-vendor sheet, categories sheet | `useVendors`, `useCategories` | `components/vendors/*` | normal, no vendors, no results (search / category / keen), adding a vendor, editing categories, category name taken, loading, couldn't load, offline, demo, Bella adds a vendor, stress, export | 4.11 |
| A vendor · `vendor.html` · §5.12 | `/vendors/[vendorId]` | `Hero`, `KeenHeart`, `StageChips`, `Fields`, `MenuCardList`, price-option sheet, `NotesView`, `FileTiles`, shortlist card | `useVendor(id)`, `useFinalistFor(vendorId)`, `useBookingFor` | vendor table rows, price options cell, notes cell | normal, no prices, ruled out, change didn't save, uploading, loading, couldn't load, offline, demo, stress, chosen, copying, price option add/edit; remove (N10) | 4.12 |
| Shortlist · `shortlist.html` · §5.13 | `/vendors/shortlist` | `SubNav`, `FocusChips`, `OrderBy`, finalist cards, add-finalist sheet | `useFinalists` | `components/shortlist/*` | normal, Bella adds a finalist, nothing on the shortlist, adding a finalist, loading, couldn't load, offline, demo, stress | 4.13 |
| A finalist · `finalist.html` · §5.14 | `/vendors/shortlist/[finalistId]` | `Hero`, `MenuCardList`, package sheet, `Fields`, `FileTiles`, book-it and move sheets | `useFinalist(id)`, `useRecordFiles` | shortlist rows and packages | copied, from scratch, booking it, uploading, loading, couldn't load, offline, demo, stress, booked, change didn't save, package add/edit; remove (N10) | 4.14 |
| Venues · `venues.html` · §5.15 | `/vendors/venues` (venue sheet at `?venue=<id>`) | `SubNav`, tools, filters, venue rows, `StageThread`, venue sheet | `useVenues` | `components/venues/*` | normal, no venues, no results, change didn't save, Bella adds a venue, loading, couldn't load, offline, demo, stress, venue sheet (add, edit, booked); remove (N10) | 4.15 |
| Documents · `documents.html` · §5.16 | `/documents` | `SubNav`, starts, search, recent cards, `DocumentRow` | `useDocuments` (title, extract, edited) | `(legacy)/notes/page.tsx` list part | normal, nothing written, no results, loading, couldn't load, offline, demo, Bella starts a document, stress | 4.16 |
| A document · `doc.html` · §5.17 | `/documents/[documentId]` (`/documents/new?start=meeting|blank` creates one and replaces the URL) | `Paper`, `EditorToolbar`, `TableBar`, pops, `LinkSheet`, `DocSaveState`, `Banner`, `ConfirmSheet` | `useDocument(id)`, `usePresence(id)` | `components/notes/rich-text-editor.tsx` | meeting notes, blank, saved, not saved yet, saving, couldn't save, offline while writing, cursor in a table, editing a total, total with a mistake, Bella is in it, deleted by Bella, delete, loading, couldn't load, offline, demo, stress | 4.17, 4.18 |
| Files · `files.html` · §5.18 | `/documents/files` (`?folder=<id>`, `?file=<id>`) | `SubNav`, `PathTrail`, folder and file rows, `UploadSheet`, `FileDetailsSheet`, `MoveSheet`, folder sheet | `useFolder(id)`, `useFileSearch(q)` | `(legacy)/files/page.tsx`, `cloudinary-upload-button.tsx` | normal, no files, empty folder, no results, searching many, uploading, a file's details, moving a folder, three levels down, folder with things in it, delete a file, loading, couldn't load, offline, demo, Bella uploads, stress | 4.19 |
| Schedule, agenda · `schedule.html` · §5.19 | `/schedule` (`?event=<id>`, `?new=1`) | `SubNav`, `Hero`, kind chips, search, agenda groups, event sheet, `NotificationState` | `useAgenda`, `useVendors`, `useVenues` | `(legacy)/schedule/page.tsx` agenda, `lib/schedule.ts` | normal, nothing scheduled, no results, completed and cancelled, an event's details, adding, notifications not yet allowed / off, loading, couldn't load, offline, demo, change didn't save, Bella adds, stress, payments filter; reminder choices (N11) | 4.20 |
| Schedule, month · `schedule.html?view=month` · §5.20 | `/schedule/month` (`?day=YYYY-MM-DD`) | `MonthCalendar`, agenda rows | `useAgenda(month)` | schedule month mode | normal, stress, a chosen day, empty day | 4.21 |
| Tasks · `tasks.html` · §5.21 | `/schedule/tasks` (`?open=<id>`) | `SubNav`, `TaskRow`, `FinishedTasks`, add-task sheet | `useTasks` | `(legacy)/todo/page.tsx` | normal, a task opened, no tasks, step didn't save, Bella finishes a step, everything done, loading, couldn't load, offline, demo, stress; finished with no recorded day (N8) | 4.22 |
| Wedding items · `items.html` · §5.22 | `/items` | `Hero`, `WorkOnNextCard`, tools, filters, `ItemRow`, row menu, add-items sheet | `useItems` | `(legacy)/master-list/page.tsx` | normal, first use, nothing tracked, no results, sorted for now, change didn't save, loading, couldn't load, offline, demo, Bella confirms, stress, row menu / remove / add several | 4.23 |
| Guests · `guests.html` · §5.23 | `/guests` (`?guest=<id>`) | `Hero`, `HeadcountsCard`, `SidesCard`, tools, `GuestRow`, `RsvpSwitch`, guest sheet | `useGuests` (with headcounts) | `(legacy)/guests/page.tsx` | normal, no guests, no results, reply didn't save, who hasn't replied, a guest's details, removing with plus-ones, adding, loading, couldn't load, offline, demo, Bella records an RSVP, stress | 4.24 |
| Not found, unexpected error | `not-found.tsx`, `error.tsx` | per need N2 | none | none today | per N2 | 6.5 |

---

## 5. Coverage matrix

### 5.1 Screen × state × device × theme

Theme is **light only** (guide §1, no dark tokens), so each state has one light column per device. Tick a box when the build matches the prototype in that state at that width (Phase 8 screenshots). Phone = 390px wide, desktop = 1440px wide. Rows marked "after design" wait for their need.

**Sign in** · `signin.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| Signing in (`?state=busy`) | [ ] | [ ] |
| Wrong email or password | [ ] | [ ] |
| Account not allowed | [ ] | [ ] |
| Just signed out | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Not connected (demo) | [ ] | [ ] |
| Google window closed or blocked (N4, after design) | [ ] | [ ] |

**Overview** · `overview.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| No wedding date yet | [ ] | [ ] |
| Just started | [ ] | [ ] |
| Install suggestion | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Bella's change arrives | [ ] | [ ] |
| Stress | [ ] | [ ] |
| Wedding day and after (N7, after design) | [ ] | [ ] |

**Wedding settings** · `settings.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal (allowed) | [ ] | [ ] |
| A change didn't save | [ ] | [ ] |
| Notifications not yet allowed | [ ] | [ ] |
| Notifications turned off | [ ] | [ ] |
| Installed on this phone | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Device can't receive reminders (N6, after design) | [ ] | [ ] |

**Budget** · `budget.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| Nothing booked yet | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Bella's change arrives | [ ] | [ ] |
| Overpaid | [ ] | [ ] |
| Stress | [ ] | [ ] |
| Record a payment (sheet) | [ ] | [ ] |
| Menu open | [ ] | [ ] |

**Bookings** · `bookings.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| Nothing booked yet | [ ] | [ ] |
| No results | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Bella's change arrives | [ ] | [ ] |
| Stress | [ ] | [ ] |
| Just added | [ ] | [ ] |

**A booking** · `booking.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| In parts | [ ] | [ ] |
| Single | [ ] | [ ] |
| Overpaid | [ ] | [ ] |
| Late | [ ] | [ ] |
| Paid in full | [ ] | [ ] |
| A change didn't save | [ ] | [ ] |
| Uploading files | [ ] | [ ] |
| Removed by Bella | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Bella's change arrives | [ ] | [ ] |
| Stress | [ ] | [ ] |
| Split, remove part, remove booking (with undo) | [ ] | [ ] |
| Booking date not known (N8, after design) | [ ] | [ ] |

**Add a booking** · `booking-new.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| Adding | [ ] | [ ] |
| Couldn't add | [ ] | [ ] |
| Missing name | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Offline | [ ] | [ ] |

**Payments due** · `payments.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| Nothing due | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Bella's change arrives | [ ] | [ ] |
| Stress | [ ] | [ ] |

**Who pays** · `funders.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| Nothing booked yet | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Renaming | [ ] | [ ] |
| Adding | [ ] | [ ] |
| Overpaid funder | [ ] | [ ] |
| Remove (confirm and undo) | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Bella's change arrives | [ ] | [ ] |
| Stress | [ ] | [ ] |

**What-if items** · `whatif.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| No what-if items | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Stress | [ ] | [ ] |
| A change didn't save | [ ] | [ ] |
| Bella adds an idea | [ ] | [ ] |
| Add (sheet) | [ ] | [ ] |
| Edit (sheet) | [ ] | [ ] |
| Split into parts | [ ] | [ ] |

**Vendors** · `vendors.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| No vendors yet | [ ] | [ ] |
| No results (search, category, keen) | [ ] | [ ] |
| Adding a vendor | [ ] | [ ] |
| Editing categories | [ ] | [ ] |
| Category name taken | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Bella adds a vendor | [ ] | [ ] |
| Stress | [ ] | [ ] |
| Export | [ ] | [ ] |

**A vendor** · `vendor.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| No prices | [ ] | [ ] |
| Ruled out | [ ] | [ ] |
| A change didn't save | [ ] | [ ] |
| Uploading files | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Stress | [ ] | [ ] |
| Chosen (creates a booking) | [ ] | [ ] |
| Copying to the shortlist | [ ] | [ ] |
| Price option add and edit | [ ] | [ ] |
| Remove the vendor (N10, after design) | [ ] | [ ] |

**Shortlist** · `shortlist.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| Bella adds a finalist | [ ] | [ ] |
| Nothing on the shortlist | [ ] | [ ] |
| Adding a finalist | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Stress | [ ] | [ ] |

**A finalist** · `finalist.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Copied from a vendor | [ ] | [ ] |
| From scratch | [ ] | [ ] |
| Booking it | [ ] | [ ] |
| Uploading files | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Stress | [ ] | [ ] |
| Booked | [ ] | [ ] |
| A change didn't save | [ ] | [ ] |
| Package add and edit | [ ] | [ ] |
| Remove the finalist (N10, after design) | [ ] | [ ] |

**Venues** · `venues.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| No venues yet | [ ] | [ ] |
| No results | [ ] | [ ] |
| A change didn't save | [ ] | [ ] |
| Bella adds a venue | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Stress | [ ] | [ ] |
| Venue sheet: add, edit, booked | [ ] | [ ] |
| Remove a venue (N10, after design) | [ ] | [ ] |

**Documents** · `documents.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| Nothing written yet | [ ] | [ ] |
| No results | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Bella starts a document | [ ] | [ ] |
| Stress | [ ] | [ ] |

**A document** · `doc.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Meeting notes, just started | [ ] | [ ] |
| Blank | [ ] | [ ] |
| Saved | [ ] | [ ] |
| Not saved yet | [ ] | [ ] |
| Saving | [ ] | [ ] |
| Couldn't save | [ ] | [ ] |
| Went offline while writing | [ ] | [ ] |
| Cursor in a table | [ ] | [ ] |
| Editing a total | [ ] | [ ] |
| A total with a mistake | [ ] | [ ] |
| Bella is in it too | [ ] | [ ] |
| Deleted by Bella | [ ] | [ ] |
| Delete | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Stress (and table) | [ ] | [ ] |

**Files** · `files.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| No files yet | [ ] | [ ] |
| An empty folder | [ ] | [ ] |
| No results | [ ] | [ ] |
| Searching many | [ ] | [ ] |
| Uploading | [ ] | [ ] |
| A file's details | [ ] | [ ] |
| Moving a folder | [ ] | [ ] |
| Three levels down | [ ] | [ ] |
| Delete a folder with things in it | [ ] | [ ] |
| Delete a file | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Bella uploads a file | [ ] | [ ] |
| Stress (big folder, deep folders) | [ ] | [ ] |

**Schedule, agenda** · `schedule.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| Nothing scheduled | [ ] | [ ] |
| No results | [ ] | [ ] |
| With completed and cancelled | [ ] | [ ] |
| An event's details | [ ] | [ ] |
| Adding an event | [ ] | [ ] |
| Notifications not yet allowed | [ ] | [ ] |
| Notifications turned off | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| A change didn't save | [ ] | [ ] |
| Bella adds an appointment | [ ] | [ ] |
| Stress | [ ] | [ ] |
| Payments filter | [ ] | [ ] |
| Remind us choices (N11, after design) | [ ] | [ ] |

**Schedule, month** · `schedule.html?view=month`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| A chosen day | [ ] | [ ] |
| Empty day, Add something | [ ] | [ ] |
| Stress | [ ] | [ ] |

**Tasks** · `tasks.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| A task opened | [ ] | [ ] |
| No tasks yet | [ ] | [ ] |
| A step didn't save | [ ] | [ ] |
| Bella finishes a step | [ ] | [ ] |
| Everything done | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Stress | [ ] | [ ] |
| Finished with no recorded day (N8, after design) | [ ] | [ ] |

**Wedding items** · `items.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| First use, pre-filled | [ ] | [ ] |
| Nothing tracked yet | [ ] | [ ] |
| No results | [ ] | [ ] |
| Sorted for now | [ ] | [ ] |
| A change didn't save | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Bella confirms an item | [ ] | [ ] |
| Stress | [ ] | [ ] |
| Row menu, remove, add several | [ ] | [ ] |

**Guests** · `guests.html`

| State | Phone, light | Desktop, light |
|---|---|---|
| Normal | [ ] | [ ] |
| No guests yet | [ ] | [ ] |
| No results | [ ] | [ ] |
| A reply didn't save | [ ] | [ ] |
| Who hasn't replied | [ ] | [ ] |
| A guest's details | [ ] | [ ] |
| Removing a guest with plus-ones | [ ] | [ ] |
| Adding | [ ] | [ ] |
| Loading | [ ] | [ ] |
| Couldn't load | [ ] | [ ] |
| Offline | [ ] | [ ] |
| Demo | [ ] | [ ] |
| Bella records an RSVP | [ ] | [ ] |
| Stress | [ ] | [ ] |

**Not found and unexpected error** · `(N2)`

| State | Phone, light | Desktop, light |
|---|---|---|
| Address that leads nowhere (N2) | [ ] | [ ] |
| Unexpected error (N2) | [ ] | [ ] |

**Shared shell** · `every screen`

| State | Phone, light | Desktop, light |
|---|---|---|
| Menu open and closed | [ ] | [ ] |
| Toasts stacked over a sheet | [ ] | [ ] |
| Sheet as a bottom sheet (phone) and centred (desktop) | [ ] | [ ] |
| Reduced motion | [ ] | [ ] |

Total: 274 screen states, 548 checkboxes.

### 5.2 Job stories → screen, component, code

Every story in inventory v1.4 (F2 is dropped). "Model" and "data" are files in `src/lib/model/` and `src/lib/data/`. Tick a story when its behaviour test passes (Task 8.1).

| Story | Screen | Components | Code | Tasks | Done |
|---|---|---|---|---|---|
| O1 days and time gone | Overview | `Hero` (days), `Thread` | model `dates.ts` (`daysUntil`, `timeGone(startedOn, wedding)`); `settings.startedOn` | 1.6, 1.11, 4.2 | [ ] |
| O2 coming up | Overview, Budget, Payments due | agenda rows, `NextCard`, `DueRow` | model `agenda.ts` (`comingUp(5)`), `money.ts` (`dues`) | 1.4, 1.6, 4.2, 4.3, 4.8 | [ ] |
| O3 pulse check | Overview | `Doors` | data `useBudget`, `useTasks`, `useGuests`, `useItems` | 4.2 | [ ] |
| O4 one step to detail | Overview, Budget, Settings | `Doors` | routes | 4.2 | [ ] |
| O5 wedding date once | Overview (no date), Settings | date field, `FieldRow` | `settings.weddingDate`; every countdown reads `useSettings` | 4.2, 4.25 | [ ] |
| O6 our two names | Settings, top bar, overview | `FieldRow`, `TopBar` | `settings.yourName`, `settings.partnerName` | 2.4, 4.25 | [ ] |
| F1 capture a venue | Venues | venue sheet | `collections/venues.ts`; data `useVenues` | 4.15 | [ ] |
| F3 venue stage | Venues | `StageChips`, `StageThread` | model `labels.ts` (venue stages); write `markBooked` | 1.5, 1.10, 4.15 | [ ] |
| F4 narrow venues | Venues | `SearchField`, `FilterSelect`, `RangeField`, `FilterCheck` | model `search.ts` | 1.5, 4.15 | [ ] |
| F5 order venues | Venues | `OrderBy` | model `order.ts` | 1.5, 4.15 | [ ] |
| F22 files on a venue | Venue sheet | `FileTiles`, `UploadSheet` | data `useRecordFiles({kind:'venue'})`, upload pipeline | 3.10, 4.15 | [ ] |
| F6 capture a vendor | Vendors, A vendor | add-vendor sheet, `Fields` | `collections/vendors.ts` via the write layer | 4.11, 4.12 | [ ] |
| F7 WhatsApp | Vendors, A vendor, A finalist | `WhatsAppLink` | model `whatsapp.ts` (`waHref`, leading 0 → 62) | 1.5, 3.9 | [ ] |
| F8 price options, preferred | A vendor | `MenuCardList`, price-option sheet, `Figure` | `priceOptions[]` through transactions (Task 1.8) | 1.8, 4.12 | [ ] |
| F9 rating and reviewers | A vendor, Vendors | `Fields`, `VendorRow` | `bridestoryRating`, `bridestoryReviewCount`; model `format.ts` (decimal comma) | 1.5, 4.11, 4.12 | [ ] |
| F10 vendor stage | A vendor, Vendors | `StageChips`, `StageThread`, `.ruled` | model `labels.ts`; Chosen creates a booking (`markBooked`) | 1.10, 4.12 | [ ] |
| F11 keen | Vendors, A vendor | `KeenHeart`, `FilterCheck` | `starred` | 3.9, 4.11 | [ ] |
| F12 browse vendors | Vendors | `FocusChips`, `SearchField`, `OrderBy`, category headings | model `search.ts`, `order.ts`, `categories.ts` | 1.5, 4.11 | [ ] |
| F13 files on a vendor | A vendor | `FileTiles` | `useRecordFiles({kind:'vendor'})` | 3.10, 4.12 | [ ] |
| F14 our own categories | Vendors (categories sheet) | `MenuCardList`, `InlineConfirm`, field with characters left | `collections/vendor-categories.ts` (validation), model `categories.ts` | 4.11 | [ ] |
| F15 export to a spreadsheet | Vendors | `CountLine` export link | model `csv.ts` (columns per N5) | 6.6 | [ ] |
| F23 rename or remove categories | Vendors (categories sheet) | `InlineRename`, `InlineConfirm` | write `renameCategory`, `removeCategory` (moves records to Other, undo) | 1.8, 4.11 | [ ] |
| F16 copy to the shortlist | A vendor | shortlist card, busy "Copying" | write `copyToShortlist` (sets `sourceVendorId`) | 1.10, 4.12 | [ ] |
| F17 packages | A finalist, Shortlist | `MenuCardList`, package sheet, `FileTiles` | shortlist adapter (`main` + `subEntries`, `preferredPackageId`) | 1.9, 4.14 | [ ] |
| F18 reviews and followers | A finalist, Shortlist | `Fields`, card meta | model `format.ts` (`compact`: 12,3k, 98,8M) | 1.5, 4.13, 4.14 | [ ] |
| F19 finalists by category | Shortlist | `FocusChips`, `OrderBy` | model `order.ts` | 4.13 | [ ] |
| F20 vendor files appear | A finalist | `FileTiles` ("from the vendor") | `useRecordFiles` includes the source vendor's files | 1.11, 3.10, 4.14 | [ ] |
| F21 finalist from scratch | Shortlist | add-finalist sheet | `collections/shortlist.ts` | 4.13 | [ ] |
| F24 move into vendors or book | A finalist | book-it sheet, move sheet | write `bookFinalist`, `moveFinalistToVendors` | 1.10, 4.14 | [ ] |
| B1 booking created automatically | A vendor, Venues, A finalist, A booking | toast with Open, origin line | write `markBooked` (sets `booking`, `estimate`) | 1.10, 4.12, 4.14, 4.15 | [ ] |
| B2 add a booking directly | Add a booking | `Fields`, `UploadSheet`, `Problem` | write `addDirectBooking` (client id, retry-safe) | 1.10, 4.7 | [ ] |
| B3 a booking's details | A booking | `Fields`, `SaveLine`, `FileTiles` | data `useBooking`, write layer | 4.6 | [ ] |
| B4 parts | A booking | `PartDisclosure`, split | model `money.ts` (`totals`, `splitBooking`), write `splitBooking`, `addPart`, `removePart`, `mergeLastPart` | 1.4, 1.10, 4.6 | [ ] |
| B5 committed, paid, to pay | Budget, Bookings | `Hero`, `Thread`, `.over` | model `money.ts` (`budget`, overpaid) | 1.4, 4.3 | [ ] |
| B6 payments due | Payments due | `DueRow`, groups | model `money.ts` (`dues`, `urgency`, `SOON = 14`) | 1.4, 4.8 | [ ] |
| B7 per funder | Who pays | funder rows | model `money.ts` (`byFunder`, Not assigned) | 1.4, 4.9 | [ ] |
| B8 what-if items | What-if | `WhatIfEntry`, sheet with parts | model `money.ts` (`whatIfTotals`, `projected`) | 1.4, 4.10 | [ ] |
| B9 order bookings and what-ifs | Bookings, What-if | `OrderBy` | model `order.ts` (parts stay with their booking) | 1.4, 4.5, 4.10 | [ ] |
| B10 who would pay | What-if | sheet funder select, carry lines | `hypotheticalItems.funder`, `subEntries[].funder` | 1.9, 4.10 | [ ] |
| B11 manage funders | Who pays | `InlineRename`, `ConfirmSheet` | `funders` collection; write `removeFunder` (records → null, undo) | 1.8, 1.9, 4.9 | [ ] |
| B12 estimate apart from price | A booking, Bookings | estimate field and sentence, Order by difference | `vendors.estimate`, `venues.agreedPrice`; model `estimateDifference` | 1.4, 1.11, 4.6 | [ ] |
| G1 guest details | Guests (guest sheet) | `Fields`, chips, `RsvpSwitch`, `Stepper` | `collections/guests.ts` | 4.24 | [ ] |
| G2 event options | Guest sheet | chips (radiogroup) | model `labels.ts` (`eventType`) | 1.5, 4.24 | [ ] |
| G3 headcounts | Guests | `HeadcountsCard`, `Hero` | model `guests.ts` (`headcounts`, decided §5 #7, #9) | 1.5, 4.24 | [ ] |
| G4 both sides | Guests | `SidesCard` | model `guests.ts` (`sides`: first side named wins, friends are family) | 1.5, 4.24 | [ ] |
| G5 find guests | Guests | tools, filters | model `search.ts`, `order.ts` | 4.24 | [ ] |
| G6 stable number | Guests | gold number | `guests.number`, `guestMeta/counter` | 1.9, 1.11, 4.24 | [ ] |
| G7 remove with undo | Guests | `ConfirmSheet`, undo toast | write `removeWithUndo` | 1.8, 4.24 | [ ] |
| G8 on the phone | Guests | `RsvpSwitch` (phone size), stacked rows | CSS under 760px | 3.12, 4.24 | [ ] |
| T1 item and vendor | Wedding items | `ItemRow` | `collections/master-list.ts` | 4.23 | [ ] |
| T2 confirmed, events, person | Wedding items | event chips, person select, tick | `types[]`, `persons[]` (§9.2 Q4), `confirmed` | 4.23 | [ ] |
| T3 work on next | Wedding items | star, `.irow.next`, `WorkOnNextCard` | `next` | 4.23 | [ ] |
| T4 counts | Wedding items | `Hero`, `Thread` | model `items.ts` (`itemCounts`) | 1.5, 4.23 | [ ] |
| T5 narrow items | Wedding items | search, filters, `ShowEverything` | model `items.ts` (`filterItems`, any-of events and people) | 1.5, 4.23 | [ ] |
| T6 temporary order | Wedding items | `OrderBy`, `SortedNote` | model `order.ts`; handles hidden while sorted | 4.23 | [ ] |
| T7 own order, insert | Wedding items | handle, drag, Alt+arrows, row menu, add-items sheet | `addMasterListItems`, `moveMasterListItem` (renumber when gaps run out) | 1.8, 4.23 | [ ] |
| T8 remove with undo | Wedding items | `ConfirmSheet`, undo | `restoreMasterListItem` (same `sortOrder`) | 1.8, 4.23 | [ ] |
| T9 failed save keeps input | Wedding items | `.irow.failed`, Try again | write layer timeout and retry | 1.8, 3.12 | [ ] |
| T10 starts filled in | Wedding items | first-use `Banner`, Start with common items | `ensureMasterListInitialized` (guard kept; list per §9.2 Q12) | 4.23 | [ ] |
| S1 record an event | Schedule (event sheet) | kind chips, `Fields`, related select | `collections/schedule-events.ts` (`organiser_call` added) | 4.20 | [ ] |
| S2 complete, cancel, delete | Event sheet | status actions, `ConfirmSheet`, undo | write layer | 4.20 | [ ] |
| S3 one agenda | Schedule | `AgendaGroup`, `AgendaRow` | model `agenda.ts` (events + dues + dated tasks; real today, §5 #11) | 1.6, 4.20 | [ ] |
| S4 month | Month | `MonthCalendar` | model `agenda.ts` (`monthCells`, Monday first) | 1.6, 4.21 | [ ] |
| S5 search and kind | Schedule | kind chips, search | model `agenda.ts` (payments filter includes Payment events) | 1.6, 4.20 | [ ] |
| S6 urgency at a glance | Schedule, Payments due | `Hero` figure, context sentence | model `agenda.ts` (`lateOrToday`) | 1.6, 4.20 | [ ] |
| S7 jump to the source | Schedule | row links | routes to booking (`vendor-…`) and `/schedule/tasks?open=` | 4.20 | [ ] |
| S8 tasks with steps | Tasks | `TaskRow`, `StepRow`, `Thread small` | `collections/todos.ts` (steps by transaction) | 1.8, 4.22 | [ ] |
| S9 order, finished, delete | Tasks | `FinishedTasks`, `ConfirmSheet` | model `tasks.ts` (due order, undated last); `doneOn` | 1.6, 4.22 | [ ] |
| S10 reminders | Event sheet, Settings | reminder select, `NotificationState` | push subscription, `/api/cron/reminders`, service worker | 6.1, 6.2 | [ ] |
| R1 rich documents | A document | `EditorToolbar`, pops | Tiptap StarterKit, TextStyleKit; `editor/marks.ts` | 4.17 | [ ] |
| R2 tables | A document | `TableSizePop`, `TableBar` | TableKit commands | 4.18 | [ ] |
| R3 sort a table | A document | `TableBar` sort | model `formulas.ts` (`sortTableRows`, totals stay put) | 1.7, 4.18 | [ ] |
| R4 SUM totals | A document | `FormulaBar`, total cells | model `formulas.ts` | 1.7, 4.18 | [ ] |
| R5 autosave state | A document | `DocSaveState` | `editor/use-doc-autosave.ts` (0.9s, failure kept, flush on leave) | 4.17 | [ ] |
| R6 find documents | Documents | starts, search, recent cards, rows | data `useDocuments` (extract from JSON, search inside tables) | 4.16 | [ ] |
| R7 delete for good | A document | `ConfirmSheet` (Delete for good), message | `deleteNote` (no undo) | 4.17 | [ ] |
| R8 folders | Files | `PathTrail`, folder rows, folder sheet, `BlockedNotice` | `collections/wedding-files.ts` | 4.19 | [ ] |
| R9 upload | Files, every record | `UploadSheet`, `UploadQueue` | upload pipeline + `compress-pdf.ts` | 3.10 | [ ] |
| R10 name, category, description | Upload sheet | queue fields | `createWeddingFile` | 3.10 | [ ] |
| R11 open, download, move, edit, delete | Files | `FileDetailsSheet`, `MoveSheet` | `updateWeddingFile`, move | 4.19 | [ ] |
| R12 move a folder | Files | `MoveSheet` | write `moveFolder` (no cycles) | 1.8, 4.19 | [ ] |
| R13 really removed | Files | `ConfirmSheet` (Delete for good) | `DELETE /api/files/[fileId]` | 6.3 | [ ] |
| R14 find a file anywhere | Files | `SearchField`, `ShowMore` | data `useFileSearch` | 4.19 | [ ] |
| A1 sign in | Sign in | gate | `auth-context.tsx`; not-allowed probe | 2.3, 4.1 | [ ] |
| A2 live partner changes | every screen | `.flash`, partner toast, `Banner` (document) | `activity` listener, `presence` | 1.8, 2.7 | [ ] |
| A3 install | Settings, Overview | `InstallCard`, install steps | `beforeinstallprompt`, display-mode check | 6.4 | [ ] |
| A4 phone and computer | every screen | breakpoints | module CSS | all | [ ] |
| A5 account, settings, sign out | Menu, Settings | `MenuIndex` account line, `AccountsList` | `members` | 2.4, 4.25 | [ ] |
| A6 save without a save step | every editing screen | `useAutosaveField`, `SaveLine` | write layer | 1.8, 3.4 | [ ] |

---

## 6. Reverse coverage (code → design)

Every place in the current code that produces something visible, from a full sweep of `src/`, `public/`, `next.config.ts` and `firestore.rules` on 2026-10-14. Each maps to its new counterpart, to a decided drop, or to a gap in §9.1. Nothing here is restyled from the old version: the right-hand column is the only source for the build. Paths are today's (before Phase 1 moves them into `(legacy)`). In this section and in §2, "§4 #n" and "§5 #n" mean the decided placeholders and bugs in `inventory-notes.md`, and "guide §n" or a bare "§5.x" in the right-hand column means the design guide.

| Old surface (file:line) | New counterpart | Status |
|---|---|---|
| **Routes and pages** | | |
| `app/page.tsx` dashboard (countdown, spend, to-dos, next items, guests, shortcuts, "Welcome back") | Overview §5.2; greeting and seating shortcut dropped (§4 #15, #16) | [ ] |
| `app/venues`, `vendors`, `shortlist` pages | Venues §5.15, Vendors §5.11, Shortlist §5.13, plus vendor and finalist detail screens | [ ] |
| `app/confirmed/page.tsx` (rows, totals, reminders, funder recap, hypothetical table) | Budget, Bookings, A booking, Payments due, Who pays, What-if (§5.4–§5.10) | [ ] |
| `app/master-list/page.tsx` | Wedding items §5.22 | [ ] |
| `app/guests/page.tsx` (table, mobile cards, headcounts, floating add) | Guests §5.23 | [ ] |
| `app/schedule/page.tsx` (agenda, month, form) | Agenda §5.19, Month §5.20, event sheet | [ ] |
| `app/todo/page.tsx` | Tasks §5.21 | [ ] |
| `app/notes/page.tsx` + `components/notes/rich-text-editor.tsx` | Documents §5.16, A document §5.17 | [ ] |
| `app/files/page.tsx` | Files §5.18 | [ ] |
| `app/settings/page.tsx` | Wedding settings §5.3 (partnerEmail and venue dropped, §4 #3) | [ ] |
| `app/budget/page.tsx`, `app/checklist/page.tsx` (orphaned) | dropped (§4 #1, #2); data stays in Firestore | [ ] |
| no `not-found.tsx`, `error.tsx`, `global-error.tsx`, `loading.tsx` | not found and unexpected error: **gap N2** (§9.1 G2); loading: `Shimmer` (guide §4.19) | [ ] |
| **Auth** | | |
| `login/page.tsx:76-157` Google, email and password, Sign in | Sign in §5.1 | [ ] |
| `login/page.tsx` Register button (`auth-context.tsx` `createUserWithEmailAndPassword`) | dropped (§9.2 Q2: both sign in with Google) | n/a |
| password reset | doesn't exist today; not in the inventory; nothing to build | n/a |
| `login/page.tsx:34-43` raw Firebase error text | wrong email or password, account not allowed, offline (§5.1); Google window closed or blocked: **gap N4** (§9.1 G4) | [ ] |
| `login/page.tsx:84-91` not-configured alert | Not connected, Look around (§5.1, §6.4) | [ ] |
| `app-shell.tsx:62-84` auth gate, full-screen "Loading…" | new root layout gate (Task 2.3) with `Shimmer` | [ ] |
| account not allowed: not handled (non-allowed users see empty data) | Account not allowed state; permission probe in Task 2.3 | [ ] |
| permission-denied ignored on most pages (`use-collection.ts:45-49`) | hook `status: 'error'` → Couldn't load on every screen | [ ] |
| `app-shell.tsx:184-231` account dropdown, Sign out | menu account line, Settings "Who can open the planner" (§4.2, §4.30) | [ ] |
| **Native dialogs** | | |
| `schedule/page.tsx:763` `window.confirm` delete event | `ConfirmSheet` + undo (§6.2) | [ ] |
| `files/page.tsx:283` `confirm` delete folder | `ConfirmSheet`, or `BlockedNotice` when not empty (§4.15) | [ ] |
| `files/page.tsx:369` `confirm` delete file | `ConfirmSheet` "Delete for good", no undo (§6.2) | [ ] |
| `notes/page.tsx:97` `confirm` delete note | `ConfirmSheet` "Delete for good" + "Document deleted" message (§5.17) | [ ] |
| `rich-text-editor.tsx:386` `window.prompt` rows to add | table bar "Add [5] rows" field (§4.24) | [ ] |
| **Deletes with no confirmation today** | | |
| vendors `vendors-table.tsx:449`, venues `venues-table.tsx:242`, shortlist entries `shortlist-table.tsx:148` | removal with confirm and undo: **gap N10** (§9.1 G10, owner decision §9.2 Q1) | [ ] |
| shortlist packages `:259`, price options `vendor-price-options-cell.tsx:69` | Remove with confirm and undo (§4.8) | [ ] |
| confirmed sub-entries `confirmed/page.tsx:883-884`, `:1136`, `:1224` | Remove this part / Remove booking / Remove what-if item, confirm and undo (§5.6, §5.10) | [ ] |
| tasks and subtasks `todo/page.tsx:71`, `:121` | Delete task, remove step, confirm and undo (§4.27) | [ ] |
| attached file X `files-cell.tsx:36` | file details sheet, Delete for good (§4.20) | [ ] |
| budget and checklist deletes | dropped with their pages | n/a |
| **Toasts and errors** | | |
| `guests/page.tsx:332-374`, `:814-835` undo toast (10 s) | `ToastHost` undo (6 s, guide §2 Motion) | [ ] |
| `master-list/page.tsx:556-598`, `:1002-1023` undo toast | same | [ ] |
| inline load and save errors: notes `:140`, files `:425`, schedule `:872-882`, master list `:682-695`, guests `:790`, settings `:141`, master-list cell `:111-124` | Couldn't load message; failed field or row line with Try again; sheet save line (§6.1) | [ ] |
| schedule form validation `schedule/page.tsx:250-270` (title, date, invalid date, end before start) | validation uses the failed-field look (§4.9), but the design words only two messages (a booking's missing name, a taken category name). A missing title or date and an end before the start: **gap N9** (§9.1 G9) | [ ] |
| category validation `vendor-categories.ts:49-60` | "There's already a category called …", characters left (§5.11) | [ ] |
| upload errors `cloudinary-upload-button.tsx:77`, `:86`, `:112-117` | Too large, Upload failed, Try again (§4.20) | [ ] |
| **Dialogs, popovers, tooltips, dropdowns** | | |
| schedule form dialog `:293` | event sheet (§4.14, §5.19) | [ ] |
| files: folder dialog `:592`, file details `:617` (with "Skip for now"), move `:664` | folder sheet, `FileDetailsSheet`, `UploadSheet` per-file fields, `MoveSheet` (§4.20) | [ ] |
| guests delete dialog `:783` | `ConfirmSheet` naming plus-ones (§5.23) | [ ] |
| master list "Add multiple rows" `:915`, delete `:971` | add-items sheet (one per line), `ConfirmSheet` | [ ] |
| `add-vendor-category-dialog.tsx` | categories sheet (§5.11) | [ ] |
| `venue-notes-cell.tsx:59-117` long-notes dialog | `NotesView` with Edit / Done on detail screens and the venue sheet (§4.9) | [ ] |
| `venues-toolbar.tsx:87` filters popover | venue filters inline (§5.15) | [ ] |
| tooltips (`cloudinary-upload-button.tsx:178`, add to budget, copy to shortlist) | none; add to budget dropped; Copy to the shortlist is a labelled action (§5.12); missing upload config is a deployment error, logged, shown as Upload failed | [ ] |
| dropdown menus: nav `app-shell.tsx:111`, `:164`; file and folder menus `files/page.tsx:136`, `:168`; guest row `:157`; multi-select `master-list-multi-select.tsx` | menu index; folder actions (Rename · Move · Delete folder) and file details sheet; guest sheet Remove; event and people filters (`.dd`) | [ ] |
| base-ui selects (guests, master list, schedule, funder, category, status, type pills) | `FieldSelect`, chips, `StageChips` | [ ] |
| **Lightboxes, galleries, previews** | | |
| `venue-gallery-dialog.tsx` photo gallery, cover thumbnail | dropped (F2, §4 #7); photo data stays | n/a |
| files open in a new tab (`files/page.tsx:557`, `:573`, `files-cell.tsx:23`) | Open and Download in the file details sheet; preview in the sheet (§4.20) | [ ] |
| file-type icons `files/page.tsx:111-123` | file type in gold italic, envelope folders (§4.7, §4.20) | [ ] |
| **Editor** | | |
| toolbar `rich-text-editor.tsx:288-447`; style, font, size, colour inputs | `EditorToolbar`, pops (§4.24) | [ ] |
| table presets 2×2–6×5 | 8 × 8 size picker | [ ] |
| header-click sort `:212-246` | table bar Sort (§4.24); totals stay put (§6.10) | [ ] |
| formula overlay via `data-formula*` attributes, errors `#REF!`, `#CIRCULAR!`, `#NAME?` | total cells in gold, errors "Bad reference", "Includes itself", "Not a total", formula bar (§6.10) | [ ] |
| save status "Saving…/Unsaved changes/Saved/Retry save" `:276-285` | `DocSaveState` (§4.24) | [ ] |
| content CSS `globals.css:147-339` (placeholder "Start writing…", headings, lists, tables, resize handle, mobile tables) | `editor/content.module.css` from `editor.css` and guide §4.24; placeholder from the prototype | [ ] |
| stored marks: fonts `""`, Inter, Georgia, Arial, Courier New; sizes 14/16/20/28px; any hex colour and highlight | read unchanged; normalised per §9.2 Q10 | [ ] |
| legacy plain-text notes (`notes.ts:21-45`) | same conversion, kept in the data layer | [ ] |
| **Exports and output** | | |
| CSV `vendors-table.tsx:84-120` (`vendors-YYYY-MM-DD.csv`, 9 columns incl. email) | filename `vendors-<names>.csv` (§5.11); columns: **gap N5** (§9.1 G5); email dropped (§4 #6) | [ ] |
| PDF shrinking `compress-pdf.ts` | kept; status lines in the upload queue (§4.20) | [ ] |
| print styles, emails | none today, none designed | n/a |
| WhatsApp links `contact-cell.tsx:24`, `vendors-table.tsx:220` | `WhatsAppLink` with the 0 → 62 rule (§4.23) | [ ] |
| **Guest or shared-link views** | none today, none designed | n/a |
| **PWA** | | |
| `manifest.ts` name, short name, description, colours `#2b2f4a`, icons (maskable reuses 512) | **gap N1** (§9.1 G1) | [ ] |
| `layout.tsx:15-30` title, description, apple web app title, icons; `viewport.themeColor` | **gap N1** | [ ] |
| `src/app/favicon.ico`, `public/icon-192.png`, `icon-512.png`, `apple-icon.png` | **gap N1**; old files deleted in Phase 9 | [ ] |
| leftover template SVGs in `public/` (`file`, `globe`, `next`, `vercel`, `window`) | delete in Phase 9 | [ ] |
| `public/sw.js` network-first cache of every response | Task 6.1 (navigations network-only, push handlers) | [ ] |
| `sw-register.tsx` | kept as plumbing, moved to the new root layout | [ ] |
| no install prompt | `InstallCard`, settings steps, installed state (§4.30) | [ ] |
| **Sync, offline, loading, empty, demo** | | |
| no sync or offline indicator | Offline message, flash and partner toasts, document offline note (§6.3, §6.5) | [ ] |
| skeletons on 19 screens (list in the sweep) | `Shimmer` (§4.19) | [ ] |
| spinners: login `:104`, settings `:135`, upload `:157` | `Btn busy` and save line "Saving" | [ ] |
| empty states on 19 screens | nothing yet / no results / nothing in this slice (§6.7) | [ ] |
| demo banner `app-shell.tsx:240-248` | gold demonstration banner and the one action rule (§6.4) | [ ] |
| **Uploads** | | |
| `cloudinary-upload-button.tsx` progress label, sequential uploads, first failure stops the batch | `UploadSheet` and `UploadQueue`, per-file status, no batch stop (§4.20) | [ ] |
| files page progress card `files/page.tsx:429-443` | upload queue bars | [ ] |
| record uploaders `files-cell.tsx:43`, `vendor-files-cell.tsx`, venue photo button `venues-table.tsx:229` | `FileTiles` + shared `UploadSheet`, filing into a folder named after the record; venue photos dropped | [ ] |
| **Hard-coded names** | | |
| "Gregory & Partner's Wedding Planner", "Our Wedding", "Wedding Planner", "A cozy place to plan our big day." | names from settings (§4.1), "Our wedding planner" before sign-in; installed name: **gap N1** | [ ] |
| settings placeholder "Gregory Kurnia" | settings fields per §5.3 | [ ] |
| funders `CK`, `Gregory`, `Bella`, `Bella Fam` (`types.ts:37`) | `funders` collection seeded with those values (§2.7) | [ ] |
| default wedding date 2027-06-12, 365-day window (`page.tsx:30-33`) | no wedding date state; time gone from `startedOn` (§5.2, §6.11) | [ ] |
| Wedding Organizer import button (`vendors-table.tsx:57-82`) | dropped (§4 #5) | n/a |
| file category suggestions (`files/page.tsx:61-78`) | the prototype's suggestion list (`app.js` `FILE_CATS`) | [ ] |
| "Groom Big Family / Bride Big Family / Groom Business Connections" (`guests/page.tsx:644`) | Both sides card wording (§5.23) | [ ] |
| **Role-gated UI** | none today; two identical accounts | n/a |
| **Who did what** | | |
| nothing records who changed what (only `uploadedBy`, `createdBy` on files) | `updatedBy`, `activity`; which account is whose name: **gap N3** (§9.1 G3) | [ ] |
| **Dates** | | |
| mixed date formats (§5 #37) | model `dates.ts` per guide §6.11 | [ ] |
| a booking with no booking date, a finished task with no finish date (data from before this rebuild) | **gap N8** (§9.1 G8) | [ ] |
| **Reminders** | | |
| `reminderMinutes` stored, never sent | real reminders, sent once a day (Tasks 6.1, 6.2); device that can't receive them: **gap N6** (§9.1 G6); reminder choices: **gap N11** (§9.1 G11) | [ ] |
| **After the wedding** | | |
| countdown floors at 0 (`page.tsx`) | the day itself and after: **gap N7** (§9.1 G7) | [ ] |

---

## 7. Phases

Every phase is built on the `redesign` branch, ships to a Vercel preview, keeps `npm run lint`, `npm run build`, `npm test` and `npm run test:e2e` green, and ends with a fresh-session review (§7.0) before it counts as done. Each task is one session and one commit (or a few), pushed to `redesign`, with an `AGENTS.md` change-log entry.

### 7.0 Who builds it: model and effort per task

**Rules**
- **Minimum viable model.** Each pick below is the cheapest row in `~/.claude/CLAUDE.md` that should do the task well. Opus 5.5 High is used only where a mistake could lose data or break production, and each such row names the risk. Never Opus 5.5 Low or Sonnet 5.5 Medium.
- **Model check.** At the start of each session, compare the current model and effort with the task's pick. If the current one is lower, say so and suggest `/model` plus the effort setting before starting. If it's much higher for a Haiku task, suggest the cheaper one.
- **One task per session,** reading only: the task's section below, the design-guide sections it names, and the prototype file it names. Old UI files are opened only where a task says so, and only for the data calls they make. This keeps a cheaper model from copying old patterns.
- **Calibration trial (once, in Phase 4).** Build Task 4.9 (Who pays, a Sonnet 5.5 High task) twice from the same starting commit: once with Sonnet 5.5 High, once with Haiku 5.5 Max on a throwaway branch. Run `/cost` after each, compare both against `funders.html` in every state at both widths, and keep the cheaper one if it's as good. If Haiku passes, move the other single-screen Sonnet tasks that only display model data (4.13-like work) down to Haiku 5.5 Max and log it below. Extra cost: about $0.21.
- **Escalation.** The first time a model gets a task wrong twice, redo it one row stronger and log the change in the table. When an end-of-phase review rejects a task's work, the fix is done one row stronger too, and that task's pick is updated (redesign plan, "Move up after a failed check").
- **De-escalation.** When a row passes three similar tasks in a row (for example three Haiku 5.5 Max screen ports with no review findings), try the next cheaper row on the next similar task, and log it.
- **End-of-phase review.** A fresh session reviews the phase's diff against this plan and the prototype before the phase counts as done: Opus 5.5 Medium, or Opus 5.5 High for Phase 1 (data separation and live migrations) and Phase 7 (switch-over).
- **If the global table changes** mid-rebuild, update this table to match before the next task.
- **Parallel terminals (optional).** `redesign/terminal-split.md` sets out which tasks can run at the same time in up to three terminals, and the setup that needs first.

**Size:** L means about two sessions' worth of work and is costed twice. Costs are the table's per-task averages; log real `/cost` figures in the "Real cost / changes" column and tick **Done** when the task is finished.

| Phase | Task | Model · effort | Est. cost | Why | Real cost / changes | Done |
|---|---|---|---|---|---|---|
| 1 | 1.1 Test harness | Sonnet 5.5 High | $0.88 | Tooling with good docs; a mistake shows at once and loses nothing | 46a2f8f; real cost to log from `/cost` | [x] |
| 1 | 1.2 Behaviour smoke tests (old UI) | Sonnet 5.5 High | $0.88 | Written flows to cover; failures are visible | see Task 1.2 heading; real cost to log from `/cost` | [x] |
| 1 | 1.3 Route groups and `legacyHref` | Sonnet 5.5 High | $0.88 | Mechanical moves, but every link must keep working; the smoke tests from 1.2 catch slips | real cost to log from `/cost` | [x] |
| 1 | 1.4 Money model | Opus 5.5 Medium | $1.34 | No prototype code to copy for the decided rules (all booked venues, parts, overpaid, funders); needs careful reading of the guide §6.9 and the decisions | real cost to log from `/cost` | [x] |
| 1 | 1.5 Guests, items, labels, formats, search and order | Sonnet 5.5 High | $0.88 | Every rule is written in the guide §6 and the prototype's `app.js` | real cost to log from `/cost` | [x] |
| 1 | 1.6 Dates, agenda, month, tasks, reminders due | Sonnet 5.5 High | $0.88 | Rules written in the guide §6.11 and `schedule.js` | real cost to log from `/cost` | [x] |
| 1 | 1.7 SUM engine and table sort | Sonnet 5.5 High → **Opus 5.5 Medium** for the fix | $0.88 | Exact reference: `formulas.js` and guide §6.10 | real cost to log from `/cost`; the Phase 1 review rejected it (B2, B3), so the fix moved one row up; fixed 2026-10-14 in the review session on Opus 5.5 High | [x] |
| 1 | 1.8 Write layer | **Opus 5.5 High** | $1.82 | **Risk: data loss.** Transactions on embedded arrays, undo restores and retry ids decide whether concurrent edits or removed records survive | 635d1ca, 809f507; built in one session with 1.9–1.11, real cost to log from `/cost` | [x] |
| 1 | 1.9 New collections, adapters and Firestore rules | **Opus 5.5 High** | $1.82 | **Risk: production lock-out or exposure.** Rules deploy straight to production and gate both UIs | 4777274; rules deployed 2026-10-14, owner confirmed the old UI loads and saves; real cost to log from `/cost` | [x] |
| 1 | 1.10 Booking and money write operations | **Opus 5.5 High** | $1.82 | **Risk: data loss in money records.** Split, merge, remove booking, record payment and mark booked rewrite prices and payments | 4b33422; real cost to log from `/cost` | [x] |
| 1 | 1.11 One-time migrations | **Opus 5.5 High** | $1.82 | **Risk: data loss.** Writes to live production data | 24b1d15; ran on production 2026-10-14 after a backup and the owner's review of the dry run (492 writes, second run plans nothing, 615 existing records unchanged); report raised G12/N12; real cost to log from `/cost` | [x] |
| 1 | Review | **Opus 5.5 High** | $1.82 | Phase 1 rule: a missed bug can lose data | 2026-10-14: first pass found 3 blockers (B1 in 1.10, B2 and B3 in 1.7) and 22 should-fix items. The blockers were fixed in the same session (Opus 5.5 High) and the re-review passed; see `redesign/reviews/phase-1-review.md`. The should-fix items are still open there. the owner compared the preview with production on 2026-10-14 (unchanged), so Phase 1 is done; Bella's sign-in check is still open; real cost to log from `/cost` | [x] |
| 2 | 2.1 Tokens, base styles, fonts, style check | Haiku 5.5 Max | $0.21 | Verbatim copy plus a port of `veil.css` globals | | [ ] |
| 2 | 2.2 Icon set | Haiku 5.5 xHigh | $0.12 | Copy SVG paths from `app.js` and the screens | | [ ] |
| 2 | 2.3 Root layout, providers, auth gate, demo, not-allowed probe | Opus 5.5 Medium | $1.34 | No prototype for the wiring; auth edge cases need judgment (data stays protected by the rules) | | [ ] |
| 2 | 2.4 Top bar, menu, sub-navigation, back link, add button | Haiku 5.5 Max | $0.21 | Exact markup in `app.js` `header()`, `indexPage()`, `subnav()` | | [ ] |
| 2 | 2.5 Whole-screen states, message, banner | Haiku 5.5 Max | $0.21 | Exact markup in `app.js` `stateView()` | | [ ] |
| 2 | 2.6 Sheets, confirm, toasts hosts | Sonnet 5.5 High | $0.88 | Focus handling, timers and stacking need judgment; reference in `app.js` | | [ ] |
| 2 | 2.7 Partner changes and presence | Sonnet 5.5 High | $0.88 | Listener logic with written copy (guide §6.3) | | [ ] |
| 2 | Review | Opus 5.5 Medium | $1.34 | | | [ ] |
| 3 | 3.0 Component gallery route | Haiku 5.5 xHigh | $0.12 | A page that lists components | | [ ] |
| 3 | 3.1 Hero, figure, thread | Haiku 5.5 Max | $0.21 | Port from `veil.css` and guide §4.4 | | [ ] |
| 3 | 3.2 Next card, after line, doors | Haiku 5.5 Max | $0.21 | Port | | [ ] |
| 3 | 3.3 Buttons, links, chips, focus chips | Haiku 5.5 Max | $0.21 | Port | | [ ] |
| 3 | 3.4 Fields and save-as-you-go | Sonnet 5.5 High | $0.88 | Failure and retry behaviour on top of the port | | [ ] |
| 3 | 3.5 Ledger rows and row states (L) | Haiku 5.5 Max | $0.42 | Port, many variants | | [ ] |
| 3 | 3.6 Parts, menu cards, tally | Haiku 5.5 Max | $0.21 | Port | | [ ] |
| 3 | 3.7 Search, ordering, filters, count line, paging | Haiku 5.5 Max | $0.21 | Port; logic comes from the model | | [ ] |
| 3 | 3.8 Sheet patterns, confirm variants, banners, problem boxes | Haiku 5.5 Max | $0.21 | Port | | [ ] |
| 3 | 3.9 Stage thread, keen heart, WhatsApp, install card, notification state | Haiku 5.5 Max | $0.21 | Port | | [ ] |
| 3 | 3.10 File tiles, upload sheet and pipeline | Sonnet 5.5 High | $0.88 | Upload, shrink and failure states with real Cloudinary calls; reference `uploadSheet()` | | [ ] |
| 3 | 3.11 Agenda rows and month calendar | Sonnet 5.5 High | $0.88 | Calendar grid and labels need care; reference `schedule.js` | | [ ] |
| 3 | 3.12 Task, item and guest rows | Sonnet 5.5 High | $0.88 | Drag, keyboard moves and one-tap saves | | [ ] |
| 3 | Review | Opus 5.5 Medium | $1.34 | | | [ ] |
| 4 | 4.1 Sign in | Sonnet 5.5 High | $0.88 | Real auth errors mapped to the designed states | | [ ] |
| 4 | 4.2 Overview | Sonnet 5.5 High | $0.88 | Several data sources on one screen | | [ ] |
| 4 | 4.3 Budget | Haiku 5.5 Max | $0.21 | Displays model data; exact reference `budget.html` | | [ ] |
| 4 | 4.4 Record a payment sheet | Sonnet 5.5 High | $0.88 | Writes money through 1.10's operation, with undo | | [ ] |
| 4 | 4.5 Bookings | Haiku 5.5 Max | $0.21 | Displays model data; reference `bookings.html` | | [ ] |
| 4 | 4.6 A booking (L) | Sonnet 5.5 High | $1.76 | Many fields, parts and actions, with writes already made safe in 1.10 | | [ ] |
| 4 | 4.7 Add a booking | Haiku 5.5 Max | $0.21 | Form port; the write is 1.10's | | [ ] |
| 4 | 4.8 Payments due | Haiku 5.5 Max | $0.21 | Displays model data | | [ ] |
| 4 | 4.9 Who pays (calibration trial) | Sonnet 5.5 High | $0.88 | Inline rename and remove with undo | | [ ] |
| 4 | 4.10 What-if items | Sonnet 5.5 High | $0.88 | Sheet with split parts | | [ ] |
| 4 | 4.11 Vendors | Sonnet 5.5 High | $0.88 | Two sheets, categories, export | | [ ] |
| 4 | 4.12 A vendor | Sonnet 5.5 High | $0.88 | Stage creates a booking, price options, copy to shortlist | | [ ] |
| 4 | 4.13 Shortlist | Haiku 5.5 Max | $0.21 | Displays model data; reference `shortlist.html` | | [ ] |
| 4 | 4.14 A finalist | Sonnet 5.5 High | $0.88 | Packages, book it, move into vendors | | [ ] |
| 4 | 4.15 Venues | Sonnet 5.5 High | $0.88 | Venue sheet with stage and files | | [ ] |
| 4 | 4.16 Documents | Haiku 5.5 Max | $0.21 | Displays data; reference `documents.html` | | [ ] |
| 4 | 4.17 Document editor core (L) | **Opus 5.5 High** | $3.64 | **Risk: lost writing or corrupted documents.** Autosave, flush on leave, failure handling and normalising stored Tiptap JSON | | [ ] |
| 4 | 4.18 Document tables and formulas (L) | Opus 5.5 Medium | $2.68 | Tiptap table commands with no exact reference; sorting moves content, but editor undo catches mistakes | | [ ] |
| 4 | 4.19 Files (L) | Sonnet 5.5 High | $1.76 | Folders, search, details, move | | [ ] |
| 4 | 4.20 Schedule agenda and event sheet | Sonnet 5.5 High | $0.88 | Sheet with kinds, times and reminders | | [ ] |
| 4 | 4.21 Month | Haiku 5.5 Max | $0.21 | The calendar from 3.11 on a screen | | [ ] |
| 4 | 4.22 Tasks | Sonnet 5.5 High | $0.88 | Steps, finish and reopen, delete with undo | | [ ] |
| 4 | 4.23 Wedding items (L) | Sonnet 5.5 High | $1.76 | The densest screen: drag, filters, temporary sort, add several | | [ ] |
| 4 | 4.24 Guests | Sonnet 5.5 High | $0.88 | Guest sheet, RSVP switch, headcounts | | [ ] |
| 4 | 4.25 Wedding settings | Sonnet 5.5 High | $0.88 | Settings fields, accounts, notifications | | [ ] |
| 4 | Review | Opus 5.5 Medium | $1.34 | | | [ ] |
| 5 | 5.1 State harness and emulator data sets | Sonnet 5.5 High | $0.88 | Fault injection in the write layer for screenshots | | [ ] |
| 5 | 5.2 Budget group states (L) | Haiku 5.5 Max | $0.42 | States are shared components; reference each screen's `?state=` | | [ ] |
| 5 | 5.3 Vendors group states | Haiku 5.5 Max | $0.21 | Same | | [ ] |
| 5 | 5.4 Documents and files states | Sonnet 5.5 High | $0.88 | Editor offline, failed save, presence and deleted-by-partner | | [ ] |
| 5 | 5.5 Schedule and tasks states | Haiku 5.5 Max | $0.21 | Same as 5.3 | | [ ] |
| 5 | 5.6 Items and guests states | Haiku 5.5 Max | $0.21 | Same | | [ ] |
| 5 | 5.7 Overview, sign-in and settings states | Haiku 5.5 Max | $0.21 | Same | | [ ] |
| 5 | Review | Opus 5.5 Medium | $1.34 | | | [ ] |
| 6 | 6.1 Service worker | **Opus 5.5 High** | $1.82 | **Risk: breaks production.** A bad worker keeps serving a broken app to installed phones | | [ ] |
| 6 | 6.2 Push reminders | **Opus 5.5 High** | $1.82 | **Risk: production secrets and server routes.** Missed or repeated reminders, a leaked key. Smaller since the daily-only decision (§9.2 Q8) | was L ($3.64) before Q8 | [ ] |
| 6 | 6.3 Delete for good | **Opus 5.5 High** | $1.82 | **Risk: permanent data loss.** A wrong id destroys the wrong file forever | | [ ] |
| 6 | 6.4 Manifest, icons, install | Haiku 5.5 Max | $0.21 | Port of need N1's design | | [ ] |
| 6 | 6.5 Not found and error screens | Haiku 5.5 Max | $0.21 | Port of need N2's design | | [ ] |
| 6 | 6.6 Vendor CSV columns | Haiku 5.5 xHigh | $0.12 | A list of columns from need N5 | | [ ] |
| 6 | 6.7 Old-names check | Haiku 5.5 Max | $0.21 | A scan script with a word list | | [ ] |
| 6 | Review | Opus 5.5 Medium | $1.34 | | | [ ] |
| 7 | 7.1 Switch-over commit | **Opus 5.5 High** | $1.82 | **Risk: breaks production** for both of you at once | | [ ] |
| 7 | 7.2 Rollback rehearsal on a preview | Sonnet 5.5 High | $0.88 | A written procedure to run and record | | [ ] |
| 7 | 7.3 Delete old rendering code the fallback doesn't need | Sonnet 5.5 High | $0.88 | Deletions checked by the build and the old-names check | | [ ] |
| 7 | Review | **Opus 5.5 High** | $1.82 | Phase 7 rule: a missed bug breaks production | | [ ] |
| 8 | 8.1 Behaviour tests on the new UI (L) | Sonnet 5.5 High | $1.76 | One test per story group, against the emulator | | [ ] |
| 8 | 8.2 Screenshot comparison | Sonnet 5.5 High | $0.88 | Playwright against the prototype and the build | | [ ] |
| 8 | 8.3 Fix passes from the screenshots (4 sessions) | Haiku 5.5 Max | $0.84 | Each diff points at an exact prototype rule | | [ ] |
| 8 | 8.4 Accessibility check | Sonnet 5.5 High | $0.88 | axe plus the guide §8 checklist | | [ ] |
| 8 | 8.5 Real-device checklist | Haiku 5.5 xHigh | $0.12 | A checklist for the owner to run | | [ ] |
| 8 | 8.6 Merge preparation and `CLAUDE.md` | Haiku 5.5 Max | $0.21 | Text update from this plan | | [ ] |
| 8 | Review | Opus 5.5 Medium | $1.34 | | | [ ] |
| 9 | 9.1 After-launch check | Sonnet 5.5 High | $0.88 | Read logs and turn findings into needs | | [ ] |
| 9 | 9.2 Remove the fallback, final old-names check | Sonnet 5.5 High | $0.88 | Deletions checked by the build and the check | | [ ] |
| 9 | Review | Opus 5.5 Medium | $1.34 | | | [ ] |
| any | Calibration trial, second build of 4.9 | Haiku 5.5 Max | $0.21 | See the rules above | | [ ] |
| any | Design-gap loop, one round (studio session; scan; import) | Sonnet 5.5 High · Haiku 5.5 High | $1.04 | Redesign plan picks; Opus 5.5 High only if a need adds a new screen or a new pattern | | [ ] |

### How every task session runs
1. Model check (above). Check out `redesign` and pull.
2. Read the task, the named guide sections and the named prototype file. Open the prototype in a browser at 390px and 1440px.
3. Build only what the task lists. Use only token names, the components already built and the hooks in `src/lib/data/`.
4. Hit a design gap? Stop that part, add it to §9.1, write the need in `needs.md`, and carry on with the rest.
5. Before committing: `npm run lint`, `npm run build`, `npm test`, `npm run test:e2e` for the touched area, and from Task 6.7 on, `node scripts/check-old-names.mjs`.
6. Tick the task's **Done** box in the §7.0 table and under its heading below (date, commit, real `/cost`), tick its box in `redesign/terminal-split.md`, tick its rows in §5, §6 and §10, add the `AGENTS.md` entry, commit and push to `redesign`. When a phase's review passes, tick its Done row in §7.0 and the phase in `redesign/redesign-plan.md`'s checklist.

### Phase 1: Separate data from rendering, with no visual change

The old UI must look and behave exactly as today at the end of this phase; only its plumbing changes. The project has no tests, so the phase starts with a behaviour smoke test. The new model functions carry the *new* rules (decided bugs fixed); the old UI keeps its own inline logic until it's deleted, because switching it to the new rules would change what it shows.

**Done when:** smoke tests pass before and after, the old UI on the preview matches production screen for screen, the model has unit tests for every rule in guide §6.8–§6.11, the rules are deployed, the migrations have run with a backup taken, and the Phase 1 review (Opus 5.5 High) passes.

#### Task 1.1: Test harness · Sonnet 5.5 High
- [x] **Done** (2026-10-14 · 46a2f8f · real cost to log from `/cost`)
- **Read:** this task; `node_modules/next/dist/docs/01-app/02-guides/testing/` (Vitest and Playwright pages).
- **Do:** add Vitest (`npm test`) for `tests/model/**`, Playwright (`npm run test:e2e`) for `tests/e2e/**`, and the Firebase Local Emulator Suite (Auth + Firestore) through `firebase-tools` as a dev dependency, with `firebase.json` emulator ports and a seed script (`tests/e2e/seed.ts`) that signs in two emulator accounts with the allowlisted emails. Playwright starts the emulators and `next dev` with emulator env vars (`NEXT_PUBLIC_USE_EMULATORS=1`, read in `src/lib/firebase.ts` to call `connectFirestoreEmulator` and `connectAuthEmulator`). A second Playwright project runs with no Firebase env (demo mode).
- **Done when:** `npm test` and `npm run test:e2e` run green with one trivial test each. Needs Java for the emulator (§9.2 Q11).

#### Task 1.2: Behaviour smoke tests for the old UI · Sonnet 5.5 High
- [x] **Done** (2026-10-14 · 3e44c6d · real cost to log from `/cost`; test writing was delegated to a Sonnet subagent)
- **Read:** this task; `redesign/inventory-notes.md` §2.
- **Do:** Playwright tests, by behaviour not markup, against the emulator: sign in; add a venue and mark it Booked; add a vendor, set Chosen and see it among confirmed bookings; split into sub-entries and change a payment; add a guest, delete it, undo; add a master-list row, reorder, delete, undo; add a schedule item; add a to-do with a subtask; write a note with a `=SUM` table and see the total; create a folder and upload a small file (Cloudinary calls stubbed with `page.route`). Plus one demo-mode test.
- **Done when:** all pass on today's code. These tests are the "no visual change" guard for the rest of the phase.

#### Task 1.3: Route groups and `legacyHref` · Sonnet 5.5 High
- [x] **Done** (2026-10-14 · 32b2c74 · real cost to log from `/cost`)
- **Read:** §2.2; `route-groups.md`, `layout.md` in the Next docs.
- **Files:** move `src/app/layout.tsx`, `page.tsx`, `globals.css` and every page folder into `src/app/(legacy)/`; keep `manifest.ts` and `favicon.ico` at `src/app/`. Add `src/lib/legacy-href.ts` (`LEGACY_BASE = ''`) and route every `href`, `router.push/replace` and redirect in old code through it (sweep list in the reverse-coverage sweep: `app-shell.tsx`, `login/page.tsx`, dashboard cards, Confirmed links, `lib/schedule.ts:87`). Add `src/app/(veil)/new/layout.tsx` and `page.tsx` as a bare placeholder (no styles, "New UI placeholder" text) so the group builds.
- **Done when:** every URL works as before, smoke tests pass, `/new` renders the placeholder.

#### Task 1.4: Money model · Opus 5.5 Medium
- [x] **Done** (2026-10-14 · f714247 · real cost to log from `/cost`)
- **Read:** §2.7; guide §6.9, §4.4, §4.5, §4.8, §5.4–§5.10; prototype `assets/app.js` (money model block, `recordPayment`); `inventory-notes.md` §3 (data model) and §9 (§5 decisions #1–#5).
- **Files:** `src/lib/model/money.ts`, `bookings.ts`, `tests/model/money.test.ts`.
- **Do:** pure functions over plain objects: `bookingsFrom(vendors, venues)` (every booked venue counts; membership by the `booking` field, with the legacy status rule as a fallback until migration 1.11 has run; direct bookings), `partsOf`, `totals` (price, paid, still to pay, next due, funders, overpaid), `budget`, `dues` (undated never included, `SOON = 14`, `urgency`), `byFunder` (Not assigned row), `whatIfTotals`, `projected`, `collapseParts` (first 4 still owing + "and N more"), `splitPlan` (Deposit/Balance/First payment, guide §6.9), `estimateDifference`, `recordPaymentPreview` (pays in full / still to pay after / more than what's left). Money is integer rupiah.
- **Done when:** tests cover each rule in guide §6.9 and decisions #1–#5, overpaid at booking, part and funder level, and the stress numbers (13-digit prices).

#### Task 1.5: Guests, items, labels, formats, search and order · Sonnet 5.5 High
- [x] **Done** (2026-10-14 · 56573ee · real cost to log from `/cost`)
- **Read:** §2.7 value table; guide §6.7, §6.8, §6.11 (counts), §5.22, §5.23, §4.23; prototype `assets/app.js` (`n0`, `dec`, `compact`, `waHref`, `linkify`), `guests.html`, `items.html` scripts; `inventory-notes.md` §9 decisions #7–#9.
- **Files:** `src/lib/model/{guests,items,labels,format,search,order,whatsapp,categories,csv}.ts` and tests.
- **Do:** headcounts and sides (decided rules: reception includes "if space allows", unsure apart, attending counts people, friends are family, the first side named wins, no side → counted apart); item counts, filters (any-of), own order; every stored-value ↔ label map; `rp`, `figure` parts, counts with dots, decimal comma, `compact`; search across the fields each screen names; ordering (numbers descending first, text ascending, blanks last, ties by name or guest number); category list (built-ins, ours, Other last); CSV escaping (columns wait for N5).
- **Done when:** tests pass for each rule, including the stress cases (non-Latin text, 40-character categories).

#### Task 1.6: Dates, agenda, month, tasks, reminders due · Sonnet 5.5 High
- [x] **Done** (2026-10-14 · d4994a1 · real cost to log from `/cost`)
- **Read:** guide §6.11, §4.25–§4.27, §5.19–§5.21, §6.12; prototype `assets/schedule.js`, `tasks.html` script.
- **Files:** `src/lib/model/{dates,agenda,tasks,reminders}.ts` and tests.
- **Do:** long and short dates, due text, agenda day names, edited times ("12 min ago", "by Bella"); `daysUntil`, `timeGone`; `agendaItems(events, dues, tasks, today)` with Late first, real today (§5 #11), completed and cancelled on demand, the Payments filter including Payment events; `lateOrToday` figure and context sentence; `monthCells` (Monday first, dots, today, selected, wedding day, labels); task order (due, undated last), finished order, steps done; `remindersDue(events, now)`.
- **Done when:** tests pass, including month edges, all-day events and time zones in the local zone.

#### Task 1.7: SUM engine and table sort · Sonnet 5.5 High
- [x] **Done** (2026-10-14 · d11bf16 · real cost to log from `/cost`)
- **Read:** guide §6.10; prototype `assets/formulas.js`, `doc.html` script.
- **Files:** `src/lib/model/formulas.ts` and tests (the old `components/notes/formulas.ts` stays with the old UI).
- **Do:** parse and evaluate `=SUM` over a table matrix (ranges, lists, growing ranges stopping above the total, case and spaces ignored), number reading ("Rp 12.500.000", "2,5"), Rp carried into totals, the three named errors with their reasons, and `sortTableRows` (one column, numeric when every non-blank is a number, natural text order ignoring accents, blanks last, title row and total rows fixed). Must accept every formula the old engine accepted (§5 #17 edge cases decided as in the guide).
- **Done when:** tests pass, including the stress 50 × 8 table and the `doc.html?id=scratch` cases.

#### Task 1.8: Write layer · Opus 5.5 High
- [x] **Done** (2026-10-14 · 635d1ca, 809f507 · real cost to log from `/cost`; built in the same session as 1.9–1.11)
- **Risk:** data loss under concurrent edits, undo or offline retries.
- **Read:** §2.7; guide §6.1–§6.3; `src/lib/use-collection.ts`, `src/lib/confirmed-sub-entries.ts`, `src/lib/collections/{vendors,shortlist,todos,guests,master-list,vendor-categories,wedding-files}.ts`; `inventory-notes.md` §5 #19, #20, #27, #32.
- **Files:** `src/lib/data/write.ts`, `activity.ts`, `members.ts`, `undo.ts`, `array-ops.ts`; small changes inside `src/lib/collections/*.ts` so old callers use the transactional helpers (no visible change).
- **Do:**
  - `create(collection, data)` with a client-made id, `update`, `set`, `remove`: each adds `updatedBy`/`createdBy` and server timestamps, and races a 10-second timeout that rejects with `'timeout'` (the write may still land; a retry writes the same id and values, so it's safe).
  - Array operations in transactions by element id (`addElement`, `updateElement`, `removeElement`, `moveElement`, `insertAt`) for `subEntries`, `priceOptions`, packages and `subtasks`; give id-less legacy elements a stable id once (§5 #20).
  - `removeWithUndo(ref)` returns `undo()` that restores the same id and every field, including `createdAt` and order fields; several undos can be open at once (§5 #32).
  - `logActivity(kind, params, target)` after each user-level change, and `members/{uid}` written at sign-in.
  - Master-list moves renumber `sortOrder` when gaps get too small (§5 #27) and fail loudly when a row is missing.
- **Done when:** unit tests with the emulator cover two writers editing the same array at once, undo after a partner's edit, a timed-out write retried, and smoke tests still pass.

#### Task 1.9: New collections, adapters and Firestore rules · Opus 5.5 High
- [x] **Done** (2026-10-14 · 4777274 · real cost to log from `/cost`; rules deployed to production the same day after the owner's go-ahead, and the owner confirmed the old UI still loads and saves)
- **Risk:** a rules mistake locks both of you out of production data, or opens it.
- **Read:** §2.7 (new fields), §2.9; `firestore.rules`; `inventory-notes.md` §3.
- **Files:** `firestore.rules`, `tests/rules/*.test.ts` (with `@firebase/rules-unit-testing`), `src/lib/collections/{funders,members,activity,presence,push-subscriptions,guest-meta}.ts`, adapters in `src/lib/data/adapters/*.ts`.
- **Do:** add the new collections under the same `isAllowed()` allowlist; adapters that read legacy and new shapes (funders by id, `booking` field or legacy status, shortlist `main` package and `preferredPackageId`, guest `number` or creation order, file `recordRef` or legacy arrays). Also require `request.auth.token.email_verified == true` (§9.2 Q3). Deploy with `firebase deploy --only firestore:rules` only after the rules tests pass, and tell the owner first, since it applies to production at once.
- **Done when:** rules tests prove both accounts can read and write every collection and a third account can't; the old UI still works on production after the deploy.

#### Task 1.10: Booking and money write operations · Opus 5.5 High
- [x] **Done** (2026-10-14 · 4b33422 · real cost to log from `/cost`)
- **Risk:** data loss in prices and payments.
- **Read:** §2.7; guide §6.9, §5.6, §5.10, §5.12, §5.14, §5.15; prototype `booking.html`, `vendor.html`, `finalist.html`, `venues.html` scripts (what each action does).
- **Files:** `src/lib/data/bookings.ts`, `funders.ts`, `shortlist.ts`, `categories.ts`, and tests against the emulator.
- **Do:** `markBooked(vendor|venue, on)` (sets `booking`, `estimate` from the preferred option or `budgetEstimate`, never twice), `addDirectBooking`, `splitBooking` (per guide §6.9, undoable), `addPart`, `removePart` (merge back when one is left, for what-if items), `recordPayment(target, amount, paidOn, paidBy, receiptFileId)` (adds to `budgetSpent` and appends to `payments[]`, §9.2 Q5), `removeBooking` (sets `booking.removed`; files stay in Files, §9.2 Q6; undo clears it), `removeVendor`, `removeFinalist`, `removeVenue` with undo (behaviour for a vendor or venue that is also a booking follows need N10), `bookFinalist(package)`, `moveFinalistToVendors`, `copyToShortlist` (sets `sourceVendorId`, packages from price options), `removeFunder` (records → `null`, undo restores each), `renameCategory` and `removeCategory` (move vendors and finalists to Other, undo).
- **Done when:** emulator tests cover every operation and its undo, including a split booking that is then removed and restored.

#### Task 1.11: One-time migrations · Opus 5.5 High
- [x] **Done** (2026-10-14 · 24b1d15 · real cost to log from `/cost`). On production: JSON backup in the git-ignored `backups/`, dry run reviewed by the owner, real run logged in `appMeta/migrations` (4 funders, 421 guest numbers and the counter, 11 bookings, 7 finalist links plus Cheese n Click linked by hand to vendor `AJAwXH45EmMGmodFQx0C` at the owner's choice, 23 files in 24 folders, `startedOn` 2026-08-02). A second dry run plans nothing, and all 615 existing records keep every field unchanged. The item report found 4 items with several people: G12 in §9.1 and N12 in `needs.md`, before Task 4.23.
- **Risk:** writes to live production data.
- **Read:** §2.7; `inventory-notes.md` §3, §6.
- **Files:** `scripts/migrate/*.ts` run with the Firebase Admin SDK from the owner's machine, `appMeta/migrations` to record each run.
- **Do:** first an export backup (`gcloud firestore export`, or a JSON dump if the project has no bucket), then each migration with `--dry-run` printing what it would change, then for real. Each is idempotent:
  1. seed `funders` with ids `CK`, `Gregory`, `Bella`, `Bella Fam` and those names (renamed later in Who pays);
  2. guest `number` from creation order, and `guestMeta/counter`;
  3. `booking` on every vendor with Chosen or Done and every venue with Booked (`on: null`, see N8), venue `agreedPrice` from `budgetEstimate`, vendor `estimate` from the selected price option;
  4. `sourceVendorId` on finalists by exact normalised name, with a report of anything ambiguous for the owner;
  5. legacy `files[]` on vendors, venues, finalists, packages and parts → `weddingFiles` documents with `recordRef` in folders named after the record (legacy arrays stay);
  6. `settings.startedOn` from the earliest `createdAt` in the database;
  7. a report (no writes) of master-list items with more than one person (§9.2 Q4); if there are any, add a gap to §9.1 and a need to `needs.md` before Task 4.23.
- **Done when:** the dry runs are reviewed by the owner, the real runs are logged in `appMeta/migrations`, and the old UI on production still shows the same data.

### Phase 2: Tokens, base styles and the app shell

**Done when:** `/new` shows the top bar, the menu and a placeholder hero on the preview, styled only by tokens, at both widths; signing in, demo mode and an account that isn't allowed all route correctly; the review passes.

#### Task 2.1: Tokens, base styles, fonts and style check · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Read:** §2.5, §2.6; guide §2, §8 (focus, reduced motion); `redesign/design/tokens.css`; prototype `assets/veil.css` (only `:root`, `html`, `body`, `a`, `button`, `input`, `.num`, `.sr`, `[tabindex]`, focus and reduced-motion rules).
- **Files:** `src/veil/styles/{tokens.css,base.css,fonts.ts}`, `scripts/check-veil-styles.mjs`, `src/app/(veil)/new/layout.tsx` imports.
- **Done when:** `tokens.css` is byte-identical to the frozen one (`cmp` in the check script), the page glow and fonts show on `/new`, and the style check passes.

#### Task 2.2: Icon set · Haiku 5.5 xHigh
- [ ] **Done** (date · commit · real cost)
- **Read:** §2.6; prototype `assets/app.js` (`ICON`, `WA_ICON`, `HEART`), `files.html` (envelope), `items.html` (handle, star, tick), `signin.html` (Google mark).
- **Files:** `src/veil/icons/*.tsx`.
- **Done when:** each icon renders in the gallery (3.0), `aria-hidden`, with `currentColor`.

#### Task 2.3: Root layout, providers, auth gate, demo and not-allowed probe · Opus 5.5 Medium
- [ ] **Done** (date · commit · real cost)
- **Read:** §2.2, §2.7; guide §5.1 (states), §6.4, §6.5; `src/lib/auth-context.tsx`, `src/lib/firebase.ts` (calls only).
- **Files:** `src/app/(veil)/new/layout.tsx`, `src/veil/shell/providers.tsx`, `src/lib/data/session.ts`.
- **Do:** providers for auth, data status (`online`, `demo`), toasts and sheets; the gate sends signed-out visitors to `/new/sign-in` and keeps `main` `aria-busy` while auth resolves; after sign-in, a probe read of `settings/wedding` that fails with permission-denied signs the account out and shows Account not allowed with its email; demo mode when `isFirebaseConfigured` is false; `members` write on sign-in; the service worker registration moves here (same `sw.js` until 6.1); metadata `title` and `lang="en"`.
- **Done when:** e2e tests cover signed out → sign-in, allowed account → `/new`, third account → not allowed, no env → demo.

#### Task 2.4: Top bar, menu, sub-navigation, back link, add button · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §3, §4.1–§4.3; prototype `assets/app.js` (`header`, `indexPage`, `mount`, `subnav`), `veil.css` (`.top`, `.index`, `.subnav`, `.back`, `.add-fab`).
- **Files:** `src/veil/shell/{top-bar,menu-index,sub-nav,back-link,add-button}.tsx` + module CSS, `src/veil/href.ts`.
- **Do:** every link in the new UI goes through `veilHref(path)`, which adds the `/new` prefix until Task 7.1 sets it to empty.
- **Done when:** matches the prototype at both widths; focus moves to Close and back; Escape closes; the current section is marked.

#### Task 2.5: Whole-screen states, message, banner · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.17–§4.19, §5 (shared states copy), §6.5–§6.7; prototype `assets/app.js` (`stateView`, demo banner).
- **Files:** `src/veil/parts/{message,shimmer}/`, `src/veil/shell/banner.tsx`, `src/veil/shell/screen-state.tsx` (renders loading, error, offline and demo from a hook's `status`).
- **Done when:** each state renders from a fake status in the gallery.

#### Task 2.6: Sheets, confirm and toasts · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.14–§4.16, §6.2; prototype `assets/app.js` (`openSheet`, `closeSheet`, `confirm`, `toast`, `sheetSaver`, `demoLine`).
- **Files:** `src/veil/shell/{sheet,confirm,toasts}.tsx` + module CSS.
- **Do:** one sheet host, centred on desktop and a bottom sheet on a phone; focus in and back; Escape and scrim close; `confirm()` promise with the busy confirming button held until the write resolves; toasts stack, 6 s (9 s partner), Undo becomes "Restoring" until the restore resolves; layers per tokens.
- **Done when:** gallery demos plus an e2e test of confirm → remove → undo on a fake record.

#### Task 2.7: Partner changes and presence · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §6.3; §2.7 (`activity`, `presence`).
- **Files:** `src/lib/data/partner.ts`, `src/veil/shell/partner-news.tsx`, `src/lib/data/presence.ts`.
- **Do:** (documents follow §9.2 Q7.) Listen to `activity` newer than the session start and by the other account; turn each kind into the guide's partner toast text (the partner's name comes from need N3, until then the second name in settings) and flash the target (`useFlash`); presence heartbeat every 20 s for an open document, "also here" when the other account's heartbeat is under 45 s old; when a viewed record is removed by the partner, hooks return `status: 'gone'` with who removed it.
- **Done when:** e2e test with two browser contexts shows a partner toast and a flash.

### Phase 3: Components, all variants and states

Built in a dev-only gallery so every variant can be seen and screenshotted before any screen exists. **Done when:** every component in §3 renders in every listed state at both widths in the gallery and matches the prototype; the review passes.

#### Task 3.0: Component gallery · Haiku 5.5 xHigh
- [ ] **Done** (date · commit · real cost)
- **Files:** `src/app/(veil)/new/gallery/page.tsx` (returns `notFound()` unless `NEXT_PUBLIC_VEIL_GALLERY=1`), `src/veil/gallery/`.
- **Done when:** the route lists sections for each later task and is absent in production builds.

#### Task 3.1: Hero, kicker, figure, context, thread · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §3 (hero order), §4.4, §6.9 (figures); prototype `budget.html`, `booking.html?id=kirana`, `whatif.html`, `veil.css` (`.hero`, `.kicker`, `.figure*`, `.rp`, `.context`, `.thread*`).
- **Done when:** late, overpaid, settled, long and what-if variants match the prototype; threads carry `role="img"` labels.

#### Task 3.2: Next card, after line, doors · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.5, §4.6; prototype `budget.html`, `overview.html`, `veil.css` (`.card.next`, `.flag*`, `.after`, `.doors`).

#### Task 3.3: Buttons, links, chips and focus chips · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.10, §4.11, §4.13; prototype `veil.css` (`.btn*`, `.link*`, `.chip*`, `.focus`, `.dir`), `vendors.html`.
- **Done when:** busy, disabled, danger, quiet, small, pressed, radiogroup and dashed variants all render.

#### Task 3.4: Fields and save-as-you-go · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.9, §6.1; prototype `booking.html` (fields and save line), `settings.html?state=savefail`, `veil.css` (`.fields`, `.field*`, `.hint`, `.save-state*`, `.big-input`, `.notes-view`).
- **Files:** `src/veil/parts/fields/*`, `src/lib/data/use-autosave-field.ts`.
- **Do:** every field type; `useAutosaveField(save)` saves on blur or change, shows Saving → Saved on the screen's `SaveLine`, keeps the typed value on failure with Try again, restores the old name if a name is cleared, and is disabled in demo with the demo save line; money reformat on blur; inline rename (Enter, Escape).
- **Done when:** a gallery form saves to the emulator, and a forced failure (5.1's harness, or a stubbed save in the gallery) keeps the input.

#### Task 3.5: Ledger rows and row states (L) · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.7; prototype `bookings.html`, `whatif.html`, `vendors.html`, `payments.html`, `documents.html`, `files.html`, `guests.html` (row markup only), `veil.css` (`.ledger`, `.entry`, `.vrow`, `.due`, `.date-card`, `.flash`, `.ruled`), the screens' `<style>` blocks (`.drow`, `.frow`, `.grow`).
- **Done when:** each row type and each row state (flash, ruled, completed, cancelled, done, next, failed, empty meta) renders with stress names.

#### Task 3.6: Parts, menu cards, tally · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.8; prototype `booking.html`, `vendor.html`, `finalist.html`, `guests.html` (tally), `whatif.html` (`.carry`), `veil.css` (`.parts`, `.part*`, `.menu-card`).

#### Task 3.7: Search, ordering, filters, count line and paging · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.12, §6.8; prototype `vendors.html`, `venues.html`, `items.html` (`.sorted-note`, `.filters`), `veil.css` (`.tools`, `.search`, `.order`, `.count`, `.range`).
- **Done when:** components take the model's ordering and filter functions as props; focus stays in search while results change.

#### Task 3.8: Sheet patterns, confirm variants, banners and problem boxes · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.14 (create vs edit), §4.15 (inline confirm, blocked), §4.17; prototype `vendors.html?state=categories`, `files.html` (blocked folder), `booking-new.html?state=failed`, `signin.html` (`.problem`).
- **Done when:** create and edit sheet frames, inline confirm, blocked notice, gold, rose and calm boxes render.

#### Task 3.9: Stage thread, keen heart, WhatsApp, install card, notification state · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.21–§4.23, §4.30; prototype `assets/app.js` (`stageThread`, `waLink`, `HEART`), `overview.html?state=install`, `settings.html` (all notification states).

#### Task 3.10: File tiles, upload sheet and upload pipeline · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.20, §6.2 (files); prototype `assets/app.js` (`filesGrid`, `uploadSheet`, `mbText`, `FILE_CATS`), `files.html?state=uploading`, `booking.html?state=uploading`; `src/lib/compress-pdf.ts` and the Cloudinary call in `src/components/cloudinary-upload-button.tsx` (the request only).
- **Files:** `src/veil/parts/files/*`, `src/lib/data/uploads.ts`.
- **Do:** queue several files in parallel with progress per file; PDFs over 10 MB go through `compress-pdf` with the "Shrinking from … to fit under 10 MB" status; other big files are refused with the designed wording; failures offer Try again per file; a finished upload creates the `weddingFiles` document (name, category, description, `recordRef`, folder named after the record, created on first use) and appends to the legacy `files[]` array on the record (§2.7); demo shows "Not uploaded".
- **Done when:** e2e with Cloudinary stubbed covers success, shrinking, too large and failure-then-retry.

#### Task 3.11: Agenda rows and month calendar · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.25, §4.26; prototype `assets/schedule.js`, `assets/schedule.css`, `schedule.html?view=month`.
- **Done when:** groups, late flags, kind labels, completed and cancelled rows, and the month grid with dots, today, selected, wedding day and full cell labels render from model data.

#### Task 3.12: Task, item and guest rows · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Read:** guide §4.27–§4.29; prototype `tasks.html`, `items.html`, `guests.html` (scripts and `<style>` blocks).
- **Do:** task disclosure with steps and the failed-step line; item row with drag and drop (rose line, 40% fade), Alt+↑/↓ with focus kept, row menu, star and tick, failed vendor field; guest row with the RSVP switch and failed-reply line.
- **Done when:** keyboard and pointer moves work in the gallery; one-tap saves show the failed state when forced.

### Phase 4: Screens, one at a time

Each screen is built in its **normal** state with real data from the emulator and from production on the preview (read-only checks by the owner). Other states come in Phase 5. Order follows `priorities.md`: bookings and the budget first, guests last. **Done when:** every screen in §4 works on the preview with real data at both widths, every story in §5.2 can be done end to end, and the review passes.

Every Phase 4 task reads: §4 (its row), its guide §5 section, the guide sections of the components it uses, and its prototype file. Each task also adds the screen's `page.tsx` under `src/app/(veil)/new/…` and the screen component in `src/veil/screens/<screen>/`.

#### Task 4.1: Sign in · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.1, §6.4, §6.5. **Prototype:** `signin.html`.
- **Do:** Google sign-in (popup, as today), email and password, and no registration (§9.2 Q2); Firebase error codes mapped to the designed states (wrong email or password, offline); not allowed from 2.3; just signed out after Sign out; demo "Look around". The Google-window-closed state waits for N4.

#### Task 4.2: Overview · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.2. **Prototype:** `overview.html`.
- **Do:** names, days figure, time-gone thread, coming up (5), doors, no-date form (saves `weddingDate`), install card (6.4 completes the install logic). The day itself and after wait for N7.

#### Task 4.3: Budget · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.4. **Prototype:** `budget.html`. Uses `useBudget`, `useDues`; the record-payment sheet comes from 4.4.

#### Task 4.4: Record a payment sheet · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.4 (Record a payment row), §6.9. **Prototype:** `assets/app.js` `recordPayment`.
- **Do:** opened from the budget, a booking, a part, payments due and the agenda; amount pre-filled with what's left, live preview line, Paid on, Paid by chips, Attach a receipt (the shared upload sheet, filing into the booking's folder); `recordPayment` from 1.10; busy "Recording"; undo toast.

#### Task 4.5: Bookings · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.5. **Prototype:** `bookings.html`. Search, nine orders, 100 at a time, parts collapsed.

#### Task 4.6: A booking (L) · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.6, §6.9. **Prototype:** `booking.html` (`?id=samaya`, `ayu`, `kirana`, `rana`).
- **Do:** hero with save line, next card, origin line, details (price static from parts, or agreed price; estimate with its sentence; single-booking money fields), parts with their own fields, files and actions, Split into parts, Add a part, files, Remove this booking with the in-place removed message and undo. Booking date unknown waits for N8.

#### Task 4.7: Add a booking · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.7. **Prototype:** `booking-new.html`. Uses `addDirectBooking` (one id per form, so Try again never duplicates); attached files are uploaded first and linked when the booking is added.

#### Task 4.8: Payments due · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.8. **Prototype:** `payments.html`. Groups Late, next 14 days, then months; 60 at a time.

#### Task 4.9: Who pays · Sonnet 5.5 High (calibration trial)
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.9, §6.9. **Prototype:** `funders.html`. Add, rename (Enter, Escape, undo), remove (confirm naming costs, undo), Not assigned row linking to Bookings searched for "Not assigned". Build twice per §7.0.

#### Task 4.10: What-if items · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.10. **Prototype:** `whatif.html`. Projected total, who would pay (8 + more), ordering, add and edit sheet with split into parts and merge back.

#### Task 4.11: Vendors · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.11. **Prototype:** `vendors.html`. Focus chips with counts, search, keen filter, six orders, category headings, 100 at a time, add-vendor sheet (Add and start another), categories sheet (add, rename, remove with inline confirm and undo, 40 characters), export link (columns wait for N5; build with a placeholder set marked TODO N5).

#### Task 4.12: A vendor · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.12. **Prototype:** `vendor.html` (`?id=kebun`, `ara`, `nusantara`, `sv-long`).
- **Do:** keen heart, stage chips (Chosen → `markBooked`, toast with Open), "now a booking" line, figure from the preferred option, contact and reputation fields, price options menu card and sheet (add with Cancel/Add option, edit saves as you go), notes view, files, shortlist card (Copy to the shortlist, busy, undo; or Open on the shortlist). Removing the vendor waits for N10.

#### Task 4.13: Shortlist · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.13. **Prototype:** `shortlist.html`. Cards grouped by category, up to 4 packages, booked cards faded with the flag, four orders with direction, add-finalist sheet.

#### Task 4.14: A finalist · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.14. **Prototype:** `finalist.html` (`?id=f-kebun`, `f-arka`, `sf-deep`).
- **Do:** origin line, figure, packages menu card and package sheet (with its own files), contact and popularity, notes, files including the vendor's, Book it sheet with package choice, Move into Vendors (from scratch only), booked state. Removing the finalist waits for N10.

#### Task 4.15: Venues · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.15. **Prototype:** `venues.html`. Booked venue line, search, stage filter, cost and capacity limits, Hide ruled out on by default, three orders, rows with stage thread and notes cut at 140, venue sheet (add with undo, edit saves as you go, Booked → `markBooked`, files). Removing a venue waits for N10.

#### Task 4.16: Documents · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.16. **Prototype:** `documents.html`. Meeting notes and New document starts, three newest as cards, the rest as rows, search through titles and text (tables included) with highlights, 60 at a time.

#### Task 4.17: Document editor core (L) · Opus 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Risk:** lost writing or corrupted stored documents.
- **Guide:** §4.24, §5.17, §6.1 (documents), §6.13 (meeting notes). **Prototype:** `doc.html`, `assets/editor.css`. **Also read:** `src/components/notes/rich-text-editor.tsx` and `src/lib/collections/notes.ts` for the stored JSON shape and save calls only.
- **Files:** `src/veil/editor/*`, `src/lib/data/documents.ts`.
- **Do:** Tiptap with StarterKit, TextStyleKit and TableKit (same stored schema); toolbar groups, style, font, size, marks, colour and highlight pops (the document palette tokens), lists, link bubble, Cmd/Ctrl+K and the link sheet with Save; title with Enter into the body; autosave after 0.9 s with Not saved yet → Saving → Saved, failure keeps the text with Try again, offline note, flush on leave and on `pagehide` with the failure reported (§5 #25); meeting-notes start; delete for good; phone docking above the keyboard; legacy content normalised on load (fonts and sizes mapped, colours kept as typed, §9.2 Q10); a partner's saved changes applied when you have no unsaved changes, later save wins otherwise (§9.2 Q7); the editor never remounts on its own snapshot (the old scroll-jump bugs).
- **Done when:** existing production documents open on the preview and look complete (owner spot-check of five documents), a document typed offline is never lost, and e2e covers save, fail, retry and leave.

#### Task 4.18: Document tables and formulas (L) · Opus 5.5 Medium
- [ ] **Done** (date · commit · real cost)
- **Guide:** §4.24 (table bar, formula bar, cells), §6.10. **Prototype:** `doc.html?state=table`, `?state=formula`, `doc.html?id=scratch&state=formula-error`.
- **Do:** 8 × 8 size picker, table bar shown only in a table, rows and columns either side, add 1–50, remove, title row, narrower and wider (stored `colwidth`), sort (`sortTableRows` from 1.7, totals and title row fixed), remove table with undo; total cells drawn in gold with errors named; the formula bar with the cell address; Tab between cells; tables scroll sideways (720px minimum).

#### Task 4.19: Files (L) · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.18, §4.20. **Prototype:** `files.html` (`?folder=old`, `?state=file`, `?state=moving`).
- **Do:** top level and inside a folder, path folding, folders then files, search everywhere (200 at a time), new and rename folder (Enter, undo), move file or folder (no cycles, disabled targets, undo), blocked folder delete, file details sheet (preview, fields saving as you go, Open, Download, Move), Delete for good wired to 6.3 (until then the button calls a stub that throws, so it can't silently half-delete).

#### Task 4.20: Schedule agenda and event sheet · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.19, §6.12. **Prototype:** `schedule.html` (`?state=event`, `?state=new`).
- **Do:** figure and context, kind chips, search, completed and cancelled toggle, groups, 80 at a time, Record payment on payment rows, links to bookings and tasks; event sheet (kind, title, date, all day or times, with, where or call link shown as Join the call, notes, Remind us, Mark completed, Cancel it, Back to scheduled, Delete) saving as you go. Event validation waits for N9, and the Remind us choices wait for N11.

#### Task 4.21: Month · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.20. **Prototype:** `schedule.html?view=month`. Earlier, Later, Back to today, the chosen day's list, Add something for an empty day.

#### Task 4.22: Tasks · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.21. **Prototype:** `tasks.html`. Open tasks by due date, steps (add, tick, date, remove), due date, notes, finish and reopen (records `doneOn`), finished disclosure, Delete task with undo, 100 at a time, `?open=` from the agenda.

#### Task 4.23: Wedding items (L) · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.22, §6.8. **Prototype:** `items.html`.
- **Do:** figure, work-on-next card (jump, flash, focus), search, filters (confirmed, events any-of, people any-of, work on next), seven orders with the sorted note and Back to our order, own order by drag and Alt+arrows, row menu (add below, add several below, move up, move down, remove), add-items sheet (one per line, copying the events and person of the row above), first use and Start with common items (the existing 44-item seed list, §9.2 Q12), 150 at a time. Waits for the Q4 report from Task 1.11: if any item lists several people, this task waits for that need.

#### Task 4.24: Guests · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.23. **Prototype:** `guests.html`. Figure, headcounts and both-sides cards, search, nine orders, RSVP and invited-to filters, guest rows with the RSVP switch (one tap, undo toast), guest sheet (Will be guest number N, Add and start another), remove with plus-ones named.

#### Task 4.25: Wedding settings · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Guide:** §5.3. **Prototype:** `settings.html`. Names and date saving as you go (no whole-document overwrite, §5 #26), who can open the planner from `members`, sign out, the notification block (wired in 6.2), install steps and installed state, doors to Who pays and Vendor categories.

### Phase 5: Every state on every screen

Uses the shared state components from Phases 2–3; most work is wiring each screen's hook status and data cases. **Done when:** every row in §5.1 that doesn't wait for a need can be reached on the preview with the state harness and matches the prototype; the review passes.

#### Task 5.1: State harness and emulator data sets · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Files:** `src/lib/data/dev-faults.ts` (only when `NEXT_PUBLIC_VEIL_DEV=1`: `?fault=save|load|offline|upload` makes the write layer or hooks fail), `tests/fixtures/{normal,empty,stress}.ts` built from the prototype's `assets/data*.js` sets and loaded into the emulator by `npm run seed:emulator -- <set>`.
- **Done when:** each fixture loads; each fault produces the designed state on one screen.

#### Task 5.2: Budget group states (L) · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Screens:** Budget, Bookings, A booking, Add a booking, Payments due, Who pays, What-if. **Prototype:** each file's `?state=` list. Includes overpaid, paid in full, late, removed by Bella (`status: 'gone'`), just added, stress.

#### Task 5.3: Vendors group states · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Screens:** Vendors, A vendor, Shortlist, A finalist, Venues.

#### Task 5.4: Documents and files states · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Screens:** Documents, A document, Files. Includes the editor's not saved yet, saving, couldn't save, offline while writing, partner in the document, deleted by the partner, demo (not editable), stress tables.

#### Task 5.5: Schedule and tasks states · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Screens:** Agenda, Month, Tasks.

#### Task 5.6: Items and guests states · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Screens:** Wedding items, Guests.

#### Task 5.7: Overview, sign-in and settings states · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Screens:** Overview, Sign in, Wedding settings.

### Phase 6: Edge surfaces

**Done when:** the service worker, reminders, delete for good, manifest and icons, not-found and error screens, and the CSV export work on the preview; the old-names check exists and passes on `src/veil/**` and `src/app/(veil)/**`; the review passes.

#### Task 6.1: Service worker · Opus 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Risk:** a broken worker keeps serving a broken app to installed phones.
- **Read:** §2.8; `progressive-web-apps.md`; `public/sw.js`; `inventory-notes.md` §5 #35.
- **Do:** new `public/sw.js`: navigations network-only (offline shows the app's own offline state, never a cached page), cache only hashed `/_next/static/**` and the font files, delete `wedding-planner-v2` and older caches, `skipWaiting` with a versioned cache name, `push` (show the reminder) and `notificationclick` (focus or open the event's day). Same worker serves both UIs.
- **Done when:** on a preview, an installed phone picks up a new deploy on the next open, and errors or redirects are never cached.

#### Task 6.2: Push reminders · Opus 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Risk:** production secrets and server routes; reminders missed, repeated or sent to the wrong device.
- **Read:** §2.9; guide §6.12, §4.30, §5.3, §5.19; `progressive-web-apps.md` (web push); §9.2 Q8 and Q9; need N11's design.
- **Files:** `src/app/api/push/{subscribe,unsubscribe,test}/route.ts`, `src/app/api/cron/reminders/route.ts`, `src/lib/server/*`, cron schedule in `vercel.ts` or `vercel.json`, `src/lib/data/push.ts`.
- **Do:** permission states (granted, default, denied, unsupported per N6); subscribe on Allow notifications and store per device; Send a test reminder; a daily Vercel Cron (`0 0 * * *` UTC, the only frequency Hobby allows) calls the cron route, which checks `CRON_SECRET`, finds reminders whose day has come with `remindersDue()` (including any missed in the last 24 hours), sends with `web-push`, records `remindersSent`, and removes subscriptions that return 404 or 410; reminder choices per N11 (existing `[0]`, `[15]` and `[60]` values are read as the nearest deliverable choice that N11's design sets); every route verifies the Firebase ID token and the allowlist.
- **Done when:** on a preview with real keys, triggering the cron route by hand (`vercel crons` or a signed request) delivers a "1 day before" reminder once on a Mac and on an installed iPhone, and a second run sends nothing.

#### Task 6.3: Delete for good · Opus 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Risk:** permanent data loss; a wrong id destroys the wrong file forever.
- **Read:** §2.9; guide §6.2 (permanent); `src/lib/collections/wedding-files.ts`.
- **Do:** `DELETE /api/files/[fileId]`: verify token and allowlist, read the `weddingFiles` doc server-side (never trust a client-sent public id), destroy that asset (legacy files: public id parsed from the URL, refuse if it can't be parsed), then delete the doc and remove the URL from any legacy `files[]` arrays; idempotent when the asset is already gone.
- **Done when:** emulator plus a test Cloudinary folder show the asset and doc removed, and a second call is harmless.

#### Task 6.4: Manifest, icons and install · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Waits for:** need N1 designed and imported.
- **Do:** `src/app/manifest.ts` (name, short name, colours, icons including a real maskable icon, `start_url` `/`), `src/app/icon.*`, `apple-icon.*`, favicon per the design; `viewport.themeColor`; install card logic (`beforeinstallprompt` on Android, steps on iPhone, hidden when `display-mode: standalone`, dismissed once per device).

#### Task 6.5: Not found and error screens · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Waits for:** need N2. **Files:** `src/app/(veil)/new/not-found.tsx`, `error.tsx` (and `global-error.tsx` if the design covers it); read `not-found.md`, `error.md` in the Next docs.

#### Task 6.6: Vendor CSV columns · Haiku 5.5 xHigh
- [ ] **Done** (date · commit · real cost)
- **Waits for:** need N5. **Files:** `src/lib/model/csv.ts` columns; filename `vendors-<first>-<second>.csv` from settings (guide §5.11).

#### Task 6.7: Old-names check · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- **Files:** `scripts/check-old-names.mjs`, `scripts/old-names.txt`.
- **Do:** the list holds distinctive old identifiers and wording only: old component and file names (`AppShell`, `VendorsTable`, `VenuesTable`, `ShortlistTable`, `EditableText`, `EditableNumber`, `EditableDate`, `FunderSelect`, `ConfirmedTypePill`, `VendorCategoryPill`, `VendorCategoryTabs`, `VendorContractPill`, `VenueStatusPill`, `VenueGalleryDialog`, `VenueNotesCell`, `FilesCell`, `ContactCell`, `MasterListEditableCell`, `MasterListMultiSelect`, `CloudinaryUploadButton`, `RichTextEditor`, the `components/ui/*` names), old style names (`bg-background`, `text-foreground`, `data-slot`, `--terracotta`, `--cream`, `tw-animate`), and old wording from `inventory-notes.md` §2 ("Words used by the current UI") and the reverse-coverage sweep ("Welcome back", "Our Wedding", "Track RSVPs", "Next up", "Real budget spent", "Pending spending", "to track", "Starred only", "Hide rejected", "Add to budget", "Sub-entry", "Start writing", "Skip for now", "Clear filters", "Firebase isn't connected"). Words the new design also uses (Vendors, Shortlist, Guests, Schedule, Budget, Files) aren't listed. Stored field names are data, not UI, and aren't listed. `--exclude <glob>` for the frozen fallback.
- **Done when:** it passes on `src/veil/**`, `src/app/(veil)/**`, `src/lib/model/**` and `src/lib/data/**`, and fails when an old word is planted.

### Phase 7: Switch-over with a way back

**Done when:** on the `redesign` preview, the new UI is the default; the old UI answers at `/old/…`, frozen; the one-commit rollback (§9.3) was tested once on a preview; old rendering code the fallback doesn't need is deleted; the old-names check passes with only the fallback excluded; the review (Opus 5.5 High) passes. The switch reaches production only when the owner merges `redesign` into `main` after Phase 8, and the two-week launch window starts then.

#### Task 7.1: Switch-over commit · Opus 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Risk:** breaks production for both of you at once.
- **Do, in one commit titled "Switch to the new UI":** move `src/app/(veil)/new/*` to `src/app/(veil)/*`; move `src/app/(legacy)/*` (except the root layout) into `src/app/(legacy)/old/*`; set `LEGACY_BASE = '/old'`; replace every `/new` prefix in the new UI's links (they all go through one `veilHref()` helper from Task 2.4, so this is one constant); add permanent redirects in `next.config.ts` for old addresses with no new page (`/login` → `/sign-in`, `/confirmed` → `/budget/bookings`, `/master-list` → `/items`, `/todo` → `/schedule/tasks`, `/notes` → `/documents`, `/checklist` → `/schedule/tasks`); `/new/:path*` redirects to `/:path*`; bump the service-worker cache version.
- **Done when:** the preview passes every e2e test at the new paths, and the old UI works at `/old`.

#### Task 7.2: Rollback rehearsal · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Do:** on a throwaway branch from the switched commit, `git revert` the switch commit, push, open the preview: the old UI is at `/`, the new at `/new`, installed apps load the old UI on next open. Record the steps, time taken and the switch commit's hash in §9.3. Delete the throwaway branch.

#### Task 7.3: Delete old rendering code the fallback doesn't need · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- **Do:** delete `(legacy)/old/budget`, `(legacy)/old/checklist`, the Wedding Organizer import, `components/ui/calendar.tsx`, `lib/collections/{budget-items,checklist-items}.ts` (data stays in Firestore), the template SVGs in `public/`. Run the old-names check with `--exclude 'src/app/(legacy)/**' --exclude 'src/components/**'`.

### Phase 8: QA and polish

**Done when:** behaviour tests cover every story and pass, screenshots match the prototype for every §5.1 row (including stress data), the accessibility check passes, the owner has run the real-device checklist, and the review passes. Then the owner decides when to merge (Task 7.1's commit lands on `main` with the merge).

#### Task 8.1: Behaviour tests on the new UI (L) · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- Rewrite the Task 1.2 smoke tests and add one Playwright spec per story group (O, F, B, G, T, S, R, A) using roles and labels from the guide §8, never old selectors. Two-context tests for A2.

#### Task 8.2: Screenshot comparison · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- Playwright serves `redesign/design/prototype/` statically and the build with the matching emulator fixture, captures each §5.1 row at 390px and 1440px (light), with fonts loaded and motion reduced, and writes side-by-side images plus a pixel-difference score to `tests/screenshots/report/`. The prototype's fixed "today" (14 October 2026, 11:30) is set in the browser clock for both.

#### Task 8.3: Fix passes from the screenshots · Haiku 5.5 Max (four sessions: budget and vendors; documents and files; schedule, items and guests; shell, overview, sign-in, settings)
- [ ] **Done** (date · commit · real cost)
- Each session fixes the differences in its group, using only tokens and the prototype's CSS. Differences that come from real data rather than the design are noted, not "fixed".

#### Task 8.4: Accessibility check · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- `@axe-core/playwright` on every screen and state; plus the guide §8 checklist: focus order and return, Escape, Alt+arrows, Tab in tables, labels on icon controls, live regions, `aria-busy`, `dir="auto"`, 24px and 34px targets, reduced motion, contrast pairs from `tokens.css`.

#### Task 8.5: Real-device checklist · Haiku 5.5 xHigh
- [ ] **Done** (date · commit · real cost)
- Write `redesign/device-checklist.md` for the owner: iPhone (installed and in Safari), Android Chrome, Mac Safari and Chrome; sign in, add and edit with the keyboard open, editor docking, uploads from the camera roll, reminders, offline, the partner's change arriving on the other device.

#### Task 8.6: Merge preparation and `CLAUDE.md` · Haiku 5.5 Max
- [ ] **Done** (date · commit · real cost)
- Update `CLAUDE.md` and `AGENTS.md` to describe the new UI's structure (folders, naming, tokens, the data layers) and the launch window, ready to land with the merge.

### Phase 9: After launch (on `main`)

#### Task 9.1: After-launch check · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- About a week after launch: Vercel runtime logs and errors, failed cron runs, Firestore usage, Cloudinary usage; ask the owner what anyone stumbled on. Anything new goes through the design-gap loop as a need.

#### Task 9.2: Remove the fallback · Sonnet 5.5 High
- [ ] **Done** (date · commit · real cost)
- At the end of the launch window: delete `src/app/(legacy)/`, `src/components/`, `src/app/(legacy)` CSS and `globals.css`, `legacyHref`, the `/old` redirects stay as redirects to `/`; remove dependencies only the old UI used (`@base-ui/react`, `shadcn`, `lucide-react`, `@tanstack/react-table`, `react-day-picker`, `class-variance-authority`, `tailwind-merge`, `tw-animate-css`, Tailwind if nothing else uses it); delete the dual write to legacy `files[]` arrays; run the old-names check over `src` with **no exclusions**.

---

## 8. Testing and QA

- **Behaviour, not markup.** Tests are a checklist of behaviours. The Task 1.2 smoke tests guard Phase 1; Task 8.1 rewrites them for the new UI with roles and labels from the guide §8, and adds one spec per story group. No test ever keeps an old selector, and no design is bent to fit an old test.
- **Unit tests** (`npm test`, Vitest) for every model function (Tasks 1.4–1.7), the write layer against the emulator (1.8, 1.10), and the Firestore rules (1.9).
- **End-to-end** (`npm run test:e2e`, Playwright) against the Firebase emulator with the `normal`, `empty` and `stress` fixtures, plus one demo-mode project with no Firebase env. Two browser contexts for partner changes.
- **Screenshots:** every screen × state × device in §5.1, light only, prototype vs build at 390px and 1440px, with the clock fixed to the prototype's "today" (Task 8.2). Stress fixtures included. A row is ticked when the owner accepts the pair.
- **Accessibility:** axe on every screen and state, and the guide §8 checklist by hand (Task 8.4).
- **Real devices:** the owner runs `redesign/device-checklist.md` on an installed iPhone, Android Chrome and a Mac (Task 8.5).
- **Before every commit:** lint, type check through `npm run build` (or `tsc --noEmit` for speed), the tests for the touched area, the style check (from 2.1) and the old-names check (from 6.7).
- **Production data:** never written by tests. Migrations run only through Task 1.11's dry run, then for real, after a backup.

---

## 9. Risks and open questions

### 9.1 Needs for the designer

Each gap below has no answer in design-guide v1.0. Each is written as a need in `redesign/handoff/needs.md` (status `open`, raised in Step 6), and the build task that needs it waits; other tasks carry on. Close a row when `needs.md` says `designed` and the build is done.

| # | Need | Gap and code context (owner-only) | Waits | Status |
|---|---|---|---|---|
| G1 | **N1** | The installed app and browser tab need a name, a mark, a theme colour and a background colour. Today: `src/app/manifest.ts` and `layout.tsx` metadata, `favicon.ico`, `public/icon-192.png`, `icon-512.png` (also reused as the maskable icon, §5 #36), `apple-icon.png`, theme colour `#2b2f4a`. The brief left branding open and the guide has no mark. The owner decided an app name in Step 2 (`inventory-notes.md` §9, §4 #16), which never reached the brief; the designer may want it (§9.2 Q14). | 6.4 | open |
| G2 | **N2** | No design for an address that matches no screen, or for an unexpected crash. Today there is no `not-found.tsx` or `error.tsx` at all. A record that's gone is designed (§5.6, §5.17), but only as "removed by Bella". | 6.5 | open |
| G3 | **N3** | The design names the partner in toasts, banners and "removed by Bella", and settings lists "Greg, you" and "Bella". The code knows only the signed-in account's email; nothing links an account to one of the two names in settings (`yourName`, `partnerName`). Also undesigned: a change made by *me* on my other device arrives like a partner's change (same `activity` feed). | 2.7 (uses the second name until then) | open |
| G4 | **N4** | Google sign-in uses a popup (`signInWithPopup`). The popup can be closed, blocked by the browser, or fail (`auth/popup-closed-by-user`, `auth/popup-blocked`, `auth/cancelled-popup-request`, network). The design covers wrong password, not allowed and offline only. | 4.1 (that state only) | open |
| G5 | **N5** | Export writes a CSV. The design gives its file name but not its columns or their headings. Today's columns are old wording and include the dropped email. | 6.6 | open |
| G6 | **N6** | The design has allowed, not yet allowed and turned off. Web push also has "not supported here": an iPhone only receives web push once the app is installed to the home screen (iOS 16.4+), and some browsers have no push at all (`'PushManager' in window` is false). | 6.2 (that state only) | open |
| G7 | **N7** | The overview's one figure is days to go, and the thread runs to the wedding. Nothing covers the wedding day itself or the weeks after, when payments may still be due (`daysUntil` becomes 0, then negative). | 4.2 (that state only) | open |
| G8 | **N8** | The origin line says "Booked from Vendors on Sunday 1 March", and finished tasks say "Done 14 Oct". Existing bookings and finished tasks have no stored booking or finish date (`booking.on: null` after migration 1.11; `todos` has no `doneOn`). The prototype falls back to the due date, which would show a wrong date. | 4.6, 4.22 (that line only) | open |
| G9 | **N9** | The event sheet saves as you go, but an event needs a title and a date, and an end can't come before its start (today's checks in `schedule/page.tsx:250-270`; `scheduleEvents` without `startAt` vanish from the query). The design words only two validation messages (a booking's name, a taken category). | 4.20 (validation only) | open |
| G10 | **N10** | Owner decision §9.2 Q1. Vendors, finalists and venues can be removed today with no confirm (`vendors-table.tsx:449`, `venues-table.tsx:242`, `shortlist-table.tsx:148`); the design has no removal for them (decisions.md, session 2). Removing a vendor or venue that has become a booking needs an answer too (today a booking *is* the vendor or venue record, §2.7). | 4.12, 4.14, 4.15 (removal only) | open |
| G11 | **N11** | Owner decision §9.2 Q8. On Vercel Hobby the reminder job runs once a day, in the morning, within the hour. The event sheet offers "When it starts", "15 minutes", "1 hour", "1 day" and "1 week before" (guide §6.12); only the day-before and week-before ones can be delivered. Existing events may already store 60 minutes (the old default). | 4.20 (Remind us only), 6.2 | open |
| G12 | **N12** | Owner decision §9.2 Q4. The report from migration 1.11 (run on production 2026-10-14) found 4 wedding items with more than one person in `persons[]`: "Make Up Artist Groom and Bride Moms" (Groom Mom, Bride Mom), "Groom Dad & Brothers Suit" (Groom Dad, Groom Brother), "Groom Mom & Sister Dress" (Groom Mom, Groom Sister) and "Bride Dad & Brothers Suit" (Bride Dad, Bride Brothers). The design gives each item one person, so these can't be shown or filtered as they are. | 4.23 | open |
| G13 | **N13** | Raised by the Phase 1 review (B1, S1). Undo refuses with `WriteError` code `changed`, writing nothing, when the fields it would put back were changed since, by you or the partner (`patchWithUndo` and `removeAddedElement` in `src/lib/data/undo.ts`). Example: Split a booking, Bella records a payment on the Balance, then Undo. Guide §6.2 says what undo does when it works but not what the toast says when it can't. | 2.6 (toast host), 3.8 | open |

### 9.2 Questions for the owner: decided

The owner took every recommendation on 2026-10-14. For Q8 the project turned out to be on Vercel's Hobby plan, where cron jobs run at most once a day (Vercel docs, updated 2026-07-15), so the owner chose daily reminders only. Each decision is applied in the tasks named.

| # | Question | Decision (2026-10-14) | Applied in |
|---|---|---|---|
| Q1 | **Removing vendors, finalists and venues.** The design has no way to remove them ("ruling out does the job"); today all three can be deleted. | **Removal is wanted**, with confirm and undo like everything else. Sent to the designer as need **N10**. | §9.1 G10; Tasks 1.10, 4.12, 4.14, 4.15 |
| Q2 | **Creating an account.** The new sign-in has no "create account"; both allowed addresses are Gmail. | **Drop registration.** Both of you sign in with Google (email and password stays as a way in, as designed). | §6; Task 4.1 |
| Q3 | **The rules fix (`inventory-notes.md` §5 #33).** | **Yes:** the rules also require `email_verified`. | Task 1.9 |
| Q4 | **Wedding items for more than one person.** The design gives each item one "who it's for"; today an item can list several. | **Count first.** Migration 1.11 reports items with more than one person. If there are any, a need goes to the designer before Task 4.23; if none, one person per item stands. | Tasks 1.11, 4.23 |
| Q5 | **Payment details.** Record a payment asks "Paid on" and "Paid by", but nothing shows them later. | **Store a payment history** (date, amount, payer, receipt file) on the booking or part. "Paid so far" stays the total, and funder totals keep using the part's funder. Nothing new is shown. | §2.7; Tasks 1.10, 4.4 |
| Q6 | **A removed booking's files.** | **Files stay** in Files › Bookings › name. Only "Delete for good" removes a file. | Task 1.10 |
| Q7 | **Editing the same document together.** | **The simpler way:** the partner's saved changes appear about a second after they pause; if you both type in the same document at once, the later save wins. The "Bella is also in this document" banner is the warning. Revisit if it bites. | Tasks 2.7, 4.17 |
| Q8 | **Reminder timing.** The project is on Vercel **Hobby**: cron at most once a day, within the hour. | **Daily reminders only:** one Vercel Cron run each morning sends that day's reminders. Only "1 day before" and "1 week before" can be delivered, so the choices in "Remind us" go to the designer as need **N11**. | §2.9; §9.1 G11; Tasks 4.20, 6.2 |
| Q9 | **Server keys** (Firebase service account, Cloudinary API key and secret, VAPID keys) in Vercel. | **Yes**, created when Phase 6 starts, with step-by-step instructions at Task 6.2. | Tasks 6.2, 6.3 |
| Q10 | **Old documents' fonts, sizes and colours.** | **Map fonts and sizes** to the new four on opening (Inter, Arial and no font → Jost; Georgia → Georgia; Courier New → Mono; 14/16/20/28px → Small/Normal/Large/Huge). **Keep colours exactly as typed.** | Task 4.17 |
| Q11 | **Test tools** (Vitest, Playwright, the Firebase emulator, which needs Java). | **Yes.** | Task 1.1 |
| Q12 | **Common items** for an empty tracker. | **Your own 44** (the current seed list); the first-use note counts whatever the list holds. | Task 4.23 |
| Q13 | **Built-in vendor categories.** | **Keep** the stored names. | Task 1.5 |
| Q14 | **The app's name for need N1.** | **Added to the brief:** "Gregory & Bella's Wedding" under Branding in `redesign/handoff/brief.md` (banned-word scan clean). | §9.1 G1 |
| Q15 | **Launch window.** | **Two weeks.** | §9.3; Task 9.2 |

**Defaults I'll follow unless you object** (no answer needed):
- Bookings stay on the vendor and venue records with an added `booking` field, rather than a new collection, so the frozen fallback keeps working on the same data and the rollback loses nothing (§2.7).
- The four existing funders keep their stored values as ids; you rename them in Who pays after launch.
- Every booked venue counts in totals and reminders, the decided bug fixes in `inventory-notes.md` §9 are built into the model, and the old UI keeps its old behaviour until it's removed.
- Needs that affect only one part of a screen (N4, N6, N7, N8, N9, N10, N11) don't hold up the rest of that screen.

### 9.3 Rollback

- **Launch window:** two weeks from the merge (§9.2 Q15). During it the old UI is frozen at **`/old/…`** (for example `/old/confirmed`): no changes except security fixes.
- **One-commit way back:** revert the commit titled **"Switch to the new UI"** (Task 7.1; its hash is recorded here at 7.2: `________`): `git revert <hash>` on `main` and push. Vercel deploys the old UI at `/` and the new one at `/new`. Fastest in an emergency: promote the last pre-merge production deployment in Vercel (no commit), then do the revert calmly.
- **Rehearsed:** once on a preview in Task 7.2 (date and time taken recorded here: `________`).
- **Data is safe both ways:** every schema change is additive (§2.7). The old UI reads data written by the new one, with known limits: funders added in the new UI show as unknown values in the old selects; a booking removed in the new UI still shows in the old Confirmed if its vendor is Chosen; files uploaded in the new UI appear in the old record arrays (dual write until Phase 9) but not the other way round until re-imported.
- **Service worker:** the same `sw.js` serves both UIs, and navigations are never cached, so a rollback shows on the next open of an installed app.
- **After the window:** Task 9.2 deletes the fallback and everything old, and the old-names check runs with no exclusions.

---

## 10. Definition of done

- [ ] Every row in §5.1 (screen × state × device, light) and §5.2 (every job story) is ticked.
- [ ] Every row in §6 (reverse coverage) is ticked or marked n/a with its decision.
- [ ] Every row in `redesign/handoff/needs.md` is `designed`, and built; every §9.1 row is closed.
- [ ] Every §9.2 question is answered and its answer applied.
- [ ] `node scripts/check-old-names.mjs` passes with **no exclusions** after Phase 9.
- [ ] `npm run lint`, `npm run build`, `npm test` and `npm run test:e2e` pass.
- [ ] Screenshots match the prototype for every §5.1 row, including stress data, and the owner has accepted them.
- [ ] The accessibility check (axe and the guide §8 checklist) passes.
- [ ] The real-device checklist is done on an installed iPhone, Android and a Mac.
- [ ] The rollback was rehearsed (§9.3), and the fallback was removed at the end of the launch window.
- [ ] `CLAUDE.md` and `AGENTS.md` describe the new UI.
