"use client";

import { logActivity } from "@/lib/data/activity";
import { useDocumentPresence } from "@/lib/data/presence";
import { useRemovedByPartner } from "@/lib/data/partner";
import { useFlash } from "@/veil/shell/flash";

/**
 * Dev-only demos of live partner changes (Task 2.7). Open it as both accounts:
 * each button writes an `activity` entry as the signed-in account, so the
 * other account sees the toast and the flash. The "booking" is fake.
 *
 * It writes only against the Firebase emulators (NEXT_PUBLIC_USE_EMULATORS=1):
 * against the real database the partner would get a made-up toast.
 */

const USE_EMULATOR = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

const BOOKING = { kind: "booking", id: "catering" };
const NAME = "Dapur Lestari Catering";

export function PartnerDemos() {
  const flash = useFlash(BOOKING);
  const removed = useRemovedByPartner(BOOKING);
  const { partnerHere, partner } = useDocumentPresence(USE_EMULATOR ? "demo-document" : null);

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

      {!USE_EMULATOR && <p role="note">This demo writes only when the page runs against the emulators.</p>}
      <p>
        <button
          type="button"
          disabled={!USE_EMULATOR}
          onClick={() =>
            void logActivity("payment.recorded", { amount: 55500000, name: NAME }, BOOKING)
          }
        >
          Record a payment as me
        </button>{" "}
        <button
          type="button"
          disabled={!USE_EMULATOR}
          onClick={() => void logActivity("booking.removed", { name: NAME }, BOOKING)}>
          Remove the booking as me
        </button>
      </p>
    </div>
  );
}
