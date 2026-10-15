"use client";

import { logActivity } from "@/lib/data/activity";
import { useDocumentPresence } from "@/lib/data/presence";
import { useRemovedByPartner } from "@/lib/data/partner";
import { useFlash } from "@/veil/shell/flash";

/**
 * Dev-only demos of live partner changes (Task 2.7). Open it as both accounts:
 * each button writes an `activity` entry as the signed-in account, so the
 * other account sees the toast and the flash. The "booking" is fake.
 */

const BOOKING = { kind: "booking", id: "catering" };
const NAME = "Dapur Lestari Catering";

export function PartnerDemos() {
  const flash = useFlash(BOOKING);
  const removed = useRemovedByPartner(BOOKING);
  const { partnerHere, partner } = useDocumentPresence("demo-document");

  return (
    <div style={{ padding: "var(--space-page, 24px)" }}>
      <h1>Live partner changes</h1>

      {partnerHere && <p role="note">{partner} is also in this document. Their changes appear as they type.</p>}

      {removed ? (
        <section aria-label="Removed booking">
          <h2>This booking was removed</h2>
          <p>{removed.by} removed it on another device a moment ago.</p>
        </section>
      ) : (
        <ul aria-label="Fake bookings">
          <li className={flash} data-testid="booking-row">
            {NAME}
          </li>
        </ul>
      )}

      <p>
        <button
          type="button"
          onClick={() =>
            void logActivity("payment.recorded", { amount: 55500000, name: NAME }, BOOKING)
          }
        >
          Record a payment as me
        </button>{" "}
        <button type="button" onClick={() => void logActivity("booking.removed", { name: NAME }, BOOKING)}>
          Remove the booking as me
        </button>
      </p>
    </div>
  );
}
