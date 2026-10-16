"use client";

import { useState } from "react";
import { VENDOR_RULED_OUT, VENDOR_STAGES, VENUE_RULED_OUT, VENUE_STAGES } from "@/lib/model/labels";
import { Chip } from "@/veil/parts/chips/chip";
import { KeenHeart } from "@/veil/parts/keen/keen-heart";
import { keenToast } from "@/veil/parts/keen/keen-text";
import { StageChips } from "@/veil/parts/stage/stage-chips";
import { StageThread } from "@/veil/parts/stage/stage-thread";
import { WhatsAppLink } from "@/veil/parts/whatsapp/whatsapp-link";
import { useToast } from "@/veil/shell/toasts";

const VENDOR = "Kebun Bunga Atelier";

/**
 * Task 3.9's section of the component gallery, part one: the stage thread and
 * its chips, the keen heart and the WhatsApp link, with fixed fake data. The
 * gallery's e2e test drives them.
 */
export function StageDemos() {
  const toast = useToast();
  const [demo, setDemo] = useState(false);
  const [stage, setStage] = useState("Consideration");
  const [keen, setKeen] = useState(true);
  const [picks, setPicks] = useState(0);

  // Choosing a stage only records it here. On the vendor screen, Chosen makes a booking.
  function choose(next: string) {
    setStage(next);
    setPicks((count) => count + 1);
  }

  function toggleKeen(next: boolean) {
    setKeen(next);
    toast.confirmation(keenToast(VENDOR, next));
  }

  return (
    <>
      <p>
        <Chip pressed={demo} onClick={() => setDemo((on) => !on)}>
          Demonstration mode
        </Chip>
      </p>

      <h3>Vendor stage threads</h3>
      <ul aria-label="Vendor stages" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {VENDOR_STAGES.map((item) => (
          <li key={item.value}>
            <StageThread kind="vendor" stage={item.value} />
          </li>
        ))}
        <li>
          <StageThread kind="vendor" stage={VENDOR_RULED_OUT} />
        </li>
      </ul>

      <h3>Venue stage threads</h3>
      <ul aria-label="Venue stages" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {VENUE_STAGES.map((item) => (
          <li key={item.value}>
            <StageThread kind="venue" stage={item.value} />
          </li>
        ))}
        <li>
          <StageThread kind="venue" stage={VENUE_RULED_OUT} />
        </li>
      </ul>

      <h3>Stage chips</h3>
      <StageChips kind="vendor" label={`Stage of ${VENDOR}`} stage={stage} disabled={demo} onChange={choose} />
      <p>
        Stage now: <StageThread kind="vendor" stage={stage} />. Choices so far: {picks}
      </p>
      <p>Choosing Chosen makes a booking on the vendor screen (Task 4.12). This gallery only records the choice.</p>

      <h3>Keen heart</h3>
      <p>
        <KeenHeart name={VENDOR} keen={keen} disabled={demo} onToggle={toggleKeen} /> {VENDOR}
      </p>

      <h3>WhatsApp link</h3>
      <p>
        In a row: <WhatsAppLink phone="0812-3456-7890" />. On a detail screen:{" "}
        <WhatsAppLink phone="+62 812 3456 7890" variant="detail" />.
      </p>
      <p>With no usable number there is no link: <WhatsAppLink phone="Ibu Rina" /></p>
    </>
  );
}
