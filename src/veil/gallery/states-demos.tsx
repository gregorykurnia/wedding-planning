"use client";

import { useState } from "react";
import type { Loaded } from "@/lib/data/settings";
import { Message, MessageAction } from "@/veil/parts/message/message";
import { Shimmer } from "@/veil/parts/shimmer/shimmer";
import { Banner, Problem } from "@/veil/shell/banner";
import { ScreenState } from "@/veil/shell/screen-state";

const SAMPLE = "Sample data from a read that has arrived.";

/** Every status a read can have, each with a fake read (the offline one keeps its data). */
const READS: { label: string; read: Loaded<string> }[] = [
  { label: "Ready", read: { status: "ready", data: SAMPLE } },
  { label: "Loading", read: { status: "loading", data: null } },
  { label: "Couldn’t load", read: { status: "error", data: null } },
  { label: "Offline", read: { status: "offline", data: null } },
  { label: "Offline, with data", read: { status: "offline", data: SAMPLE } },
  { label: "Demonstration mode", read: { status: "demo", data: null } },
];

/**
 * Dev-only demos of Task 2.5: the whole-screen states driven by a fake read, the
 * message kinds, the banners and problem boxes, and the skeleton. Task 3.0's
 * gallery lists this page; the e2e test drives it.
 */
export function StatesDemos() {
  const [choice, setChoice] = useState(0);
  const [retries, setRetries] = useState(0);
  const { read } = READS[choice];

  return (
    <>
      <h1>Screen states, messages and banners</h1>

      <h2>Whole screen</h2>
      <div role="group" aria-label="Fake status">
        {READS.map((item, index) => (
          <button
            key={item.label}
            type="button"
            aria-pressed={index === choice}
            onClick={() => setChoice(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ScreenState read={read} what="the budget" onRetry={() => setRetries((count) => count + 1)}>
        {(data) => <p>{data ?? "The empty data set."}</p>}
      </ScreenState>
      <p>Retries requested: {retries}</p>

      <h2>Messages</h2>
      <Message inline kind="nothing-yet" title="Nothing booked yet">
        Choosing a vendor or booking a venue adds it here.
      </Message>
      <Message
        inline
        kind="no-results"
        title="No bookings match “fireworks”"
        actions={
          <>
            <MessageAction quiet>Clear the search</MessageAction>
            <MessageAction quiet>Show everything</MessageAction>
          </>
        }
      >
        Search looks through names, categories, parts, next steps and funders.
      </Message>
      <Message kind="gone" title="This booking was removed">
        Bella removed it on another device a moment ago.
      </Message>

      <h2>Banners and problem boxes</h2>
      <Banner>
        Demonstration mode. The planner isn’t connected to its database yet, so there’s
        nothing to show and changes aren’t saved.
      </Banner>
      <Banner>Bella is also in this document. Their changes appear as they type.</Banner>
      <Banner tone="rose" inline>
        The booking wasn’t added: the planner lost its connection. Everything you entered is still
        here.
      </Banner>
      <Problem role="alert">
        That email and password don’t match. Check them and try again.
      </Problem>
      <Problem tone="calm">You’re signed out. Sign in to see the wedding.</Problem>

      <h2>Skeleton</h2>
      <Shimmer />
    </>
  );
}
