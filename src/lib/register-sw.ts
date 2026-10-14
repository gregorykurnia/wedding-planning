/**
 * Registers `public/sw.js` for the whole site. Both UIs call this. The browser
 * fetches the worker script past its HTTP cache (`updateViaCache: "none"`),
 * so a new deploy's worker is found on the next page load.
 */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
}
