# Wedding Schedule / Agenda

## Goal

Give the couple one place to see important upcoming dates: payment deadlines, calls with potential vendors or the wedding organizer, appointments, deadlines, and To Do items with due dates.

## Recommended model

Use a unified Schedule page that aggregates existing date-bearing data without duplicating ownership:

- Confirmed remains the source of truth for payment target dates, remaining balances, and payment actions.
- To Do remains the source of truth for action items and subtasks.
- A new `scheduleEvents` Firestore collection stores manual, time-based events such as vendor calls and appointments.

Manual schedule events use:

```ts
{
  title: string,
  type: "vendor_call" | "appointment" | "payment" | "deadline" | "other",
  startAt: string,
  endAt: string | null,
  allDay: boolean,
  notes: string,
  location: string,
  status: "scheduled" | "completed" | "cancelled",
  relatedVendorId: string | null,
  relatedVenueId: string | null,
  reminderMinutes: number[],
}
```

## MVP experience

- Add a **Schedule** item to the main navigation.
- Show an agenda grouped into Overdue, Today, Tomorrow, Next 7 days, Upcoming, and Completed.
- Add manual events through a form supporting date/time, all-day dates, type, linked vendor/venue, location, notes, status, and a saved reminder preference.
- Automatically show unpaid Confirmed payment reminders using existing target dates and remaining balances.
- Automatically show open To Do items when they have a due date.
- Add a dashboard **Next up** card with the five earliest schedule items.
- Allow manual events to be completed, edited, or deleted from the agenda.

## Example

> **Call Bella Organizer** — Wednesday, 3:00–3:30 PM
>
> Related vendor: Bella Organizer  
> Reminder: 1 hour before  
> Notes: Ask about guest-count flexibility and payment schedule.

## Follow-up ideas

1. Add a month/week calendar view after the agenda has been used for a while.
2. Add `.ics` and Google Calendar export.
3. Add reliable email or push reminders through a server-side scheduler. Browser-only reminders are not reliable when the app is closed.
