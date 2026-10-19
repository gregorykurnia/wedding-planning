/**
 * Whether to suggest adding the planner to the home screen (guide §4.30): on a
 * phone, not installed, and not turned away on this device. An iPhone gets the
 * suggestion and its steps, since iOS never offers to install. Android gets it
 * once the browser offers, which is also when Chrome's menu has "Install app".
 */
export function suggestInstall({
  phone,
  installed,
  dismissed,
  iphone,
  installable,
}: {
  /** A phone-width screen. */
  phone: boolean;
  /** Already open as an installed app. */
  installed: boolean;
  /** Turned away once on this device. */
  dismissed: boolean;
  /** An iPhone or iPod, whose browser never offers an install. */
  iphone: boolean;
  /** The browser has offered to install the planner (`beforeinstallprompt`). */
  installable: boolean;
}): boolean {
  return phone && !installed && !dismissed && (iphone || installable);
}

/** An iPhone or iPod, from the user agent. */
export function isIphone(userAgent: string): boolean {
  return /iPhone|iPod/.test(userAgent);
}
