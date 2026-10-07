# Master List implementation plan

Updated: 2026-10-07. Status: planning only; no application or live-data changes.

## Goal and source

Add a **Master List** page under the existing **Planning** menu, at `/master-list`, on desktop and mobile. Use the 44 rows supplied by the user below as the authoritative initial data, in their exact order. Access to the original Notes document is not required to seed this version. Leave the original “MASTER LIST” note intact as a backup; ongoing changes on this page will be independent of Notes.

## Columns and editing

Keep these six visible columns in this exact order:

| Header | Control and behavior |
| --- | --- |
| Item | Click or tap to edit text directly in the cell. |
| Vendor | Click or tap to edit text directly in the cell; allow empty values and preserve `???` placeholders. |
| Confirmed/Not | Editable Yes/No dropdown; store a boolean and display the exact labels Yes and No. |
| Type | Checkbox multi-select dropdown: Reception, Matrimony, Sangjit, Pre-Wedding. |
| Person | Checkbox multi-select dropdown: General, Groom, Bride, Groom Dad, Groom Mom, Groom Brother, Groom Sister, Bride Dad, Bride Mom, Bride Brothers. |
| Next? | Toggle an outlined/filled star. A selected star gives the entire row a soft highlight; clicking again clears both. |

Show Type and Person selections as compact labels in option order. Allow multiple selections and clearing all selections. General is a normal option, not an exclusive selection. Initial rows have no Type or Person selections and Next? is off; do not infer assignments.

For Item and Vendor, Enter or blur saves a changed value, Escape cancels, and the editor remains in the cell. Support keyboard navigation and accessible labels. Keep unsaved text available if saving fails and offer retry. Use readable wrapping for long values.

## Exact initial rows

The blank Photobooth vendor cell is intentional. Preserve spelling, capitalization, punctuation, placeholders, and Yes/No values exactly as shown. The row numbers below document order; they are not an additional data column.

| Order | Item | Vendor | Confirmed/Not |
| --- | --- | --- | --- |
| 1 | Reception Venue | The Langham Jakarta | Yes |
| 2 | Church Venue | GRII Karawaci | Yes |
| 3 | Sangjit Venue | Pullman Jakarta | Yes |
| 4 | Hotel H-1 Venue | ??? | No |
| 5 | Wedding Organizer | Orange Wedding Planner | Yes |
| 6 | Church Food Stalls | ??? | No |
| 7 | Ballroom Decoration | Givasae/Flawless | No |
| 8 | Church Decoration | Givasae | No |
| 9 | Reception Entertainment | Kana Entertainment | Yes |
| 10 | Photo and Video - Wedding Day | Cheese n Click | Yes |
| 11 | Reception and Wedding Bridal Gown | ??? | No |
| 12 | Groom Suit | Wong Hang Tailor | No |
| 13 | Wedding Cake | ??? | No |
| 14 | Lighting LED | CreativePro/Glowlight | No |
| 15 | Reception MC | ??? | No |
| 16 | Printed Invitation | ??? | No |
| 17 | Digital Invitation and Wedding Website | Viding | No |
| 18 | Make Up Artist Bride | Fannyzhu | Yes |
| 19 | Make Up Artist Groom and Bride Moms | Sherly Kartika Team | Yes |
| 20 | Make Up Artist Sister | Fannyzhu Team | Yes |
| 21 | Groom Dad & Brothers Suit | ??? | No |
| 22 | Groom Mom & Sister Dress | ??? | No |
| 23 | Bride Dad & Brothers Suit | ??? | No |
| 24 | Bride Mom Dress | ??? | No |
| 25 | Groom Shoes | ??? | No |
| 26 | Souvenir for Reception | ??? | No |
| 27 | Souvenir for Church | ??? | No |
| 28 | Sangjit MC | Andreas Lumampaw | Yes |
| 29 | Photobooth |  | No |
| 30 | Sangjit Outfit Groom | ??? | No |
| 31 | Sangjit Outfit Bride | ??? | No |
| 32 | Wedding Ring | Mabel's Jewels | No |
| 33 | Pre Wedding Photographer | ??? | No |
| 34 | Groom Parents Chinese Outfit Sangjit | ??? | No |
| 35 | Bride Parents Chinese Outfit Sangjit | ??? | No |
| 36 | Florist: bouquets, corsage, boutonniere, petal | ??? | No |
| 37 | Sangjit Photography | Jason Agustian | No |
| 38 | Sangjit Videography | Narta Agung | No |
| 39 | Transport Pickup | ??? | No |
| 40 | Wedding Car Decor | ??? | No |
| 41 | Civil Registration | Pak Eras GRII | No |
| 42 | Bride Wedding Day Jewelry | Mabel's Jewels | No |
| 43 | Bridal Accessories: veil, headpiece | ??? | No |
| 44 | Bride Nails | ??? | No |

## Row actions and layout

- Add row appends one blank row and focuses its Item cell.
- Add multiple rows opens a small dialog accepting an integer from 1–50, then appends that many blank rows in one operation and focuses the first new Item cell. This limit follows the existing Notes bulk-add behavior.
- New rows default to empty Item and Vendor, Confirmed/Not = No, empty Type and Person selections, and Next? off. Blank draft rows are allowed.
- Each row has a compact delete action, separate from the six data columns, with confirmation and a 10-second undo window matching the Guests experience. Undo restores the row's ID, contents, and position.
- Persist explicit row order. Saving, starring, or changing a dropdown must not move rows. New rows append after the existing list. No drag reordering or automatic starred-first sorting in this version.
- Include search across Item and Vendor, and filters for Confirmed/Not, Type, Person, and Next? only. Filters affect visibility, not saved order; within each multi-select filter, match any selected option, and combine different filters together.
- On mobile, use a horizontally scrollable table with readable cell widths and touch-friendly dropdowns. Keep the Item column sticky if it can be done without obstructing editing or horizontal scrolling.
- Include loading, empty-list, no-filter-results, save-error, and load-error states. Star state is communicated by the icon and accessible pressed state as well as row color.

## Storage and safe initialization

Use a new shared Firestore collection `masterListItems` with the existing allowed-account access policy. A row contains `id`, `item`, `vendor`, `confirmed`, `types`, `persons`, `next`, `sortOrder`, `createdAt`, and `updatedAt`. Keep the row's document ID stable. Use the existing collection helpers and UI components where appropriate.

Seed the supplied data once using stable IDs and an initialization marker in a transaction or equivalently atomic operation. Make initialization safe against concurrent clients, page reloads, and retries. Do not seed just because a query returns no rows: deleting every row must not recreate the initial list. Initialization must never overwrite later edits or restore intentionally deleted rows. Allocate appended row positions safely under concurrent additions and save bulk additions atomically.

Master List is an independent checklist. Vendor is plain editable text; a Yes value does not create a booking or update the existing Confirmed page. Do not link, modify, or deduplicate existing Venues, Vendors, Shortlist, or Confirmed records in this version.

## Implementation sequence

1. Read the relevant installed Next.js guides in `node_modules/next/dist/docs/` before writing application code, as required by AGENTS.md.
2. Add row types, option constants, Firestore access rules, collection operations, and guarded one-time initialization.
3. Build the page, cell editors, multi-select controls, star highlight, and row actions using existing app patterns.
4. Register Master List in Planning navigation for desktop and mobile; add search, filters, and responsive states.
5. Verify the exact initial dataset and all behaviors below, then update AGENTS.md, commit, and push to the current branch's upstream.

## Acceptance checks

- Exactly 44 initial rows, in the documented order, with 10 Yes and 34 No values; Photobooth Vendor is empty.
- The six headers and every initial Item/Vendor string match this plan exactly.
- Item and Vendor edit in place, survive reload, and do not change row order; cancellation and failed saves behave correctly.
- Yes/No, multi-select values, and star states save and appear across authenticated devices.
- All four Type options and all ten Person options are available, with multiple selections and clearing supported.
- Add one row and bulk-add 1 and 50 rows work; invalid counts are rejected; new defaults and ordering are correct.
- Delete confirmation and undo preserve data and position; deleting every row does not trigger reinitialization.
- Concurrent initialization does not duplicate or overwrite rows; concurrent additions do not lose rows.
- Search and filters preserve relative order and do not modify data.
- Desktop, mobile, keyboard controls, loading, and errors behave correctly. Run lint and production build and targeted verification of initialization and row operations.

## Remaining choices and optional additions

Nothing essential is missing for the first version. The defaults above make these choices explicit:

- Confirmed/Not is editable Yes/No.
- Type and Person begin blank; assignments are made manually.
- The original Notes document remains available, with no automatic synchronization.
- Add multiple rows creates blank rows; bulk pasting populated rows is outside this version.

Optional later additions: manual row reordering, CSV export/import, links to existing vendor/booking records, and extra tracking columns such as price, due date, or notes. These are not required for this implementation and should not delay it.
