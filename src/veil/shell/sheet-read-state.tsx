"use client";

import type { Loaded } from "@/lib/data/settings";
import { Btn } from "@/veil/parts/actions/btn";
import { Sheet, SheetActions, useSheet } from "./sheet";

/**
 * What a sheet that reads its own record shows before the record is here
 * (P7-S14): offline or a failed read says so in the screen messages' words
 * (guide §6.4, §6.6), with Done to close; loading keeps the bare title.
 * Provisional, from the sheet's own pieces: the guide words these states for
 * screens, not sheets (§9.1 G42).
 */
export function SheetReadState({ read, title, what }: { read: Loaded<unknown>; title: string; what: string }) {
  const sheet = useSheet();
  if (read.status !== "offline" && read.status !== "error") {
    return (
      <Sheet title={title}>
        <p className="sr">Loading {what}</p>
      </Sheet>
    );
  }
  const offline = read.status === "offline";
  return (
    <Sheet
      title={offline ? "You’re offline" : `${title} didn’t load`}
      sub={
        offline
          ? `The planner needs a connection to show ${what}. It will load again as soon as this device is back online.`
          : "The planner couldn’t reach its database. Your data is safe; it just isn’t here yet."
      }
    >
      <SheetActions>
        <Btn variant="quiet" autoFocus onClick={sheet.close}>
          Done
        </Btn>
      </SheetActions>
    </Sheet>
  );
}
