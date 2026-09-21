# Schedule Improvement Prompt

```text
I want to improve the Schedule section of this wedding-planning app.

Please first inspect:
- AGENTS.md
- schedule-implementation-plan.md
- src/app/schedule/page.tsx
- src/lib/schedule.ts
- src/lib/collections/schedule-events.ts
- src/lib/types.ts
- the Dashboard “Next up” implementation
- the relevant Next.js guide inside node_modules/next/dist/docs/

The current Schedule already combines:
- Manual schedule events from scheduleEvents
- Confirmed payment reminders
- Open To Do items with due dates
- A Dashboard “Next up” summary

Improve the existing implementation instead of rewriting it or duplicating data ownership.

Goals:

1. Make the Schedule page more useful as the couple’s central planning view.
   - Keep the agenda view.
   - Add a calendar-style view if it fits the current architecture.
   - Include clear Today, previous, and next navigation.
   - Make the current day and overdue items visually obvious.
   - Keep the mobile experience simple and easy to scan.

2. Improve organization and discovery.
   - Add useful filters for payments, To Do items, vendor calls, appointments, deadlines, and manual events.
   - Add search by title, notes, vendor, venue, or location.
   - Keep completed and cancelled items hidden by default but easy to access.
   - Preserve the existing overdue, today, tomorrow, next 7 days, and upcoming grouping where useful.

3. Make schedule items more actionable.
   - Manual events should still support adding, editing, completing, cancelling, and deleting.
   - Payment reminders should link back to Confirmed.
   - To Do items should link back to the To Do page.
   - Linked vendors and venues should be clearly displayed and clickable where possible.
   - Show relevant information such as time, location, notes, remaining payment amount, and related booking.

4. Improve the add/edit experience.
   - Make the form easier to use on mobile.
   - Validate invalid dates and end times.
   - Preserve local date/time behavior.
   - Make reminder preferences clear.
   - Keep the existing vendor and venue linking behavior.
   - Avoid adding complex recurring events unless the current data model can support them cleanly.

5. Improve visual polish and resilience.
   - Follow the existing design system, colors, typography, spacing, and UI components.
   - Add polished loading, empty, and error states.
   - Make long notes, locations, and titles readable without breaking the layout.
   - Ensure keyboard accessibility and useful aria-labels.
   - Check responsive behavior at mobile, tablet, and desktop widths.

Important constraints:
- Confirmed remains the source of truth for payment dates and balances.
- To Do remains the source of truth for tasks and completion state.
- Do not copy derived payment or To Do records into scheduleEvents.
- Do not break the existing Dashboard “Next up” behavior.
- Reuse existing components and dependencies where possible.
- Do not introduce a new calendar library unless it is genuinely necessary.
- Do not make destructive schema changes or remove existing data.
- Keep Firestore rules and indexes correct if the implementation requires changes.

Workflow:
1. Audit the current implementation and briefly summarize the biggest UX and technical opportunities.
2. State the proposed implementation plan in the commentary.
3. Implement the improvements.
4. Run the relevant lint/build/type checks and fix any issues.
5. Update the change log in AGENTS.md with a concise dated entry.
6. Commit the completed changes with a descriptive commit message.
7. Push the commit to the configured upstream branch.
8. Finish with a concise summary of what changed and how it was verified.
```
