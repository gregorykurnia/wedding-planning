"use client";

import { leaveQuestion } from "@/lib/model/documents";
import { Btn } from "@/veil/parts/actions/btn";
import { Sheet, SheetActions, useSheet } from "@/veil/shell/sheet";

/**
 * Leaving after a change didn't save (guide §6.1, N18): **Leave without them**
 * (quiet) or **Stay and try again**, which is where focus starts, so nothing
 * is lost by pressing Enter.
 */
export function LeaveSheet({ offline, onLeave, onStay }: { offline: boolean; onLeave: () => void; onStay: () => void }) {
  const sheet = useSheet();
  const words = leaveQuestion(offline);
  return (
    <Sheet title={words.title} sub={words.body}>
      <SheetActions>
        <Btn
          variant="quiet"
          onClick={() => {
            sheet.close();
            onLeave();
          }}
        >
          {words.leave}
        </Btn>
        <Btn
          autoFocus
          onClick={() => {
            sheet.close();
            onStay();
          }}
        >
          {words.stay}
        </Btn>
      </SheetActions>
    </Sheet>
  );
}
