"use client";

import { useState } from "react";
import { Btn } from "@/veil/parts/actions/btn";
import { DirectionWord } from "@/veil/parts/actions/direction-word";
import { TextLink } from "@/veil/parts/actions/text-link";
import { Chip, ChipGroup } from "@/veil/parts/chips/chip";
import { FocusChips } from "@/veil/parts/chips/focus-chips";

const EVENTS = [
  { value: "akad", label: "Akad" },
  { value: "reception", label: "Reception" },
  { value: "both", label: "Both" },
] as const;

const FOCUS = [
  { id: "", label: "All", count: "2.004" },
  { id: "venue", label: "Venue", count: "3" },
  { id: "catering", label: "Catering", count: "5" },
  { id: "long", label: "Bespoke tailoring and alterations for the whole wedding party", count: "12" },
];

/**
 * Task 3.3's section of the component gallery: the buttons, links, chips and
 * focus chips, with fixed fake data. The gallery's e2e test drives it.
 */
export function ActionDemos() {
  const [presses, setPresses] = useState(0);
  const [copying, setCopying] = useState(false);
  const [ascending, setAscending] = useState(true);
  const [decorating, setDecorating] = useState(true);
  const [event, setEvent] = useState<(typeof EVENTS)[number]["value"]>("akad");
  const [focus, setFocus] = useState("");
  const [editing, setEditing] = useState(false);

  // The press is counted once; a second press while busy does nothing.
  function copy() {
    setPresses((count) => count + 1);
    setCopying(true);
    window.setTimeout(() => setCopying(false), 1500);
  }

  return (
    <>
      <h3>Buttons</h3>
      <p>
        <Btn>Add vendor</Btn> <Btn variant="quiet">Cancel</Btn> <Btn small>Add item</Btn>{" "}
        <Btn variant="danger">Remove booking</Btn> <Btn disabled>Move here</Btn>
      </p>
      <p>
        <Btn busy={copying} busyLabel="Copying" onClick={copy}>
          Copy to the shortlist
        </Btn>{" "}
        <Btn variant="google">Continue with Google</Btn> <Btn floating>Add items</Btn>
      </p>
      <p>Presses: {presses}</p>

      <h3>Links</h3>
      <p>
        <TextLink>Rename</TextLink> <TextLink tone="rose">Remove this booking</TextLink>{" "}
        <TextLink href="/gallery/states">On the shortlist</TextLink>
      </p>
      <p>
        Order by{" "}
        <DirectionWord ascending={ascending} onToggle={() => setAscending((on) => !on)} />
      </p>

      <h3>Chips</h3>
      <p>
        <Chip pressed={decorating} onClick={() => setDecorating((on) => !on)}>
          Decoration
        </Chip>{" "}
        <Chip pressed={false}>Lighting</Chip> <Chip count="12">Florist</Chip>{" "}
        <Chip dashed>Add a category</Chip>
      </p>
      <h3>Choice group</h3>
      <ChipGroup label="Event" options={EVENTS} value={event} onChange={setEvent} />

      <h3>Focus chips</h3>
      <FocusChips
        label="Focus on a category"
        chips={FOCUS}
        value={focus}
        onChoose={setFocus}
        onEdit={() => setEditing(true)}
      />
      {editing ? <p>Edit categories opened.</p> : null}
    </>
  );
}
