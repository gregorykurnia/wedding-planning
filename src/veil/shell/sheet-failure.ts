"use client";

import { createContext, useContext, useEffect, useLayoutEffect } from "react";

/**
 * Tells the sheet a failure is showing in it, so a sheet freed by its write on
 * a screen it no longer belongs to stays open to say so (P6-S14). Returns the
 * call that takes it back. Null outside a sheet. Its own module, so the parts
 * that show failures don't import the sheet host.
 */
export const SheetFailureContext = createContext<(() => () => void) | null>(null);

/** Holds the sheet around it (`SheetControl.hold`). Null outside a sheet. */
export const SheetHoldContext = createContext<(() => () => void) | null>(null);

/**
 * Marks the sheet around it as showing a failure while `shown`. A layout
 * effect, so it is in place before the write's hold is released in the same
 * render (that release is a passive effect's cleanup).
 */
export function useSheetFailure(shown: boolean) {
  const register = useContext(SheetFailureContext);
  useLayoutEffect(() => (register && shown ? register() : undefined), [register, shown]);
}

/**
 * Holds the sheet around it while `busy` (guide §6.2). A passive effect, so
 * when a write fails the render that shows the failure registers it (a layout
 * effect) before this hold is let go (P7-S12). Does nothing outside a sheet.
 */
export function useSheetHold(busy: boolean) {
  const hold = useContext(SheetHoldContext);
  useEffect(() => (hold && busy ? hold() : undefined), [hold, busy]);
}
