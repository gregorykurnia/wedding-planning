// The planner's service worker, shared by both UIs (scope `/`).
//
// Pages always come from the network, so an installed phone never shows an
// old version of the app: the worker doesn't touch navigations at all. The
// only thing it caches is Next's hashed build output under `/_next/static/`
// (scripts, styles and the font files), and only when the server marks the
// response `immutable`, which `next start` and Vercel do and `next dev` does
// not. Errors, redirects and anything else are never cached.
//
// It also shows reminders sent by web push and opens the right day when one
// is tapped.
//
// Bump the version when this file changes what it caches: activating a new
// version deletes every other cache, including the old `wedding-planner-v2`.

const CACHE = "planner-static-v3";
const MAX_ENTRIES = 300;
const FALLBACK_TITLE = "Our wedding planner";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Firestore, Auth and Cloudinary are cross-origin; caching their streams
  // would break the realtime listeners. Pages, API routes, the manifest and
  // icons go to the network as if there were no worker.
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/_next/static/")) return;
  event.respondWith(fromCacheOrNetwork(event, request));
});

// The response goes back as soon as it arrives; storing it (which reads the
// whole body) and trimming the cache finish in the background.
async function fromCacheOrNetwork(event, request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (isKeepable(response)) {
    event.waitUntil(cache.put(request, response.clone()).then(() => trim(cache)));
  }
  return response;
}

function isKeepable(response) {
  return (
    response.status === 200 &&
    response.type === "basic" &&
    !response.redirected &&
    /\bimmutable\b/.test(response.headers.get("Cache-Control") || "")
  );
}

/** Each deploy adds new hashed files; drop the oldest past the limit. */
async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.length - MAX_ENTRIES;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

// A push carries JSON: { title, body, url, tag }. `url` is the day to open,
// a path on this site. Every push must show a notification, so one that
// can't be read still shows the app's name.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = (event.data && event.data.json()) || {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : FALLBACK_TITLE;
  const options = {
    body: typeof data.body === "string" ? data.body : undefined,
    tag: typeof data.tag === "string" ? data.tag : undefined,
    icon: "/icon-192.png",
    data: { url: samePath(data.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(samePath(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of open) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        // Focus first: the browser allows it only right after the tap.
        try {
          await client.focus();
        } catch {
          break;
        }
        if (client.url === target) return;
        try {
          await client.navigate(target);
        } catch {
          // navigate() refuses a window this worker doesn't control; the app
          // is still in front, just not on that day.
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

/** Only paths on this site are opened; anything else opens the home page. */
function samePath(url) {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return "/";
  try {
    const parsed = new URL(url, self.location.origin);
    return parsed.origin === self.location.origin ? parsed.pathname + parsed.search + parsed.hash : "/";
  } catch {
    return "/";
  }
}
