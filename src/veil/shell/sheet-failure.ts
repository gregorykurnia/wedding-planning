"use client";

import { createContext, useContext, useLayoutEffect } from "react";

/**
 * Tells the sheet a failure is showing in it, so a sheet freed by its write on
 * a screen it no longer belongs to stays open to say so (P6-S14). Returns the
 * call that takes it back. Null outside a sheet. Its own module, so the parts
 * that show failures don't import the sheet host.
 */
export const SheetFailureContext = createContext<(() => () => void) | null>(null);

/**
 * Marks the sheet around it as showing a failure while `shown`. A layout
 * effect, so it is in place before the write's hold is released in the same
 * render (that release is a passive effect's cleanup).
 */
export function useSheetFailure(shown: boolean) {
  const register = useContext(SheetFailureContext);
  useLayoutEffect(() => (register && shown ? register() : undefined), [register, shown]);
}
