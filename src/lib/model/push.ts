/**
 * A device's web push subscription (S10), shared by the browser, which saves
 * it, and the server, which sends to it.
 */
export const PUSH_SUBSCRIPTIONS = "pushSubscriptions";

/** A stable document id for an endpoint (endpoints are long URLs with slashes). */
export function subscriptionId(endpoint: string): string {
  // FNV-1a, twice with different seeds, for a short id with no slashes.
  const hash = (seed: number) => {
    let h = seed;
    for (let i = 0; i < endpoint.length; i++) {
      h ^= endpoint.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36);
  };
  return `${hash(2166136261)}${hash(374761393)}`;
}
