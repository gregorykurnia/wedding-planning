import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

/**
 * Runs `public/sw.js` in a fake worker scope (caches, fetch, clients,
 * registration) and fires the events a browser would.
 */
const SOURCE = readFileSync(join(__dirname, "../../public/sw.js"), "utf8");
const ORIGIN = "https://planner.example";
const CACHE = "planner-static-v4";

type Listener = (event: unknown) => void;

function fakeCaches(initial: Record<string, Record<string, Response>> = {}) {
  const store = new Map<string, Map<string, Response>>();
  for (const [name, entries] of Object.entries(initial)) store.set(name, new Map(Object.entries(entries)));
  const open = async (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const entries = store.get(name)!;
    const key = (r: Request | string) => (typeof r === "string" ? r : r.url);
    return {
      match: async (r: Request | string) => entries.get(key(r))?.clone(),
      put: async (r: Request | string, response: Response) => void entries.set(key(r), response),
      keys: async () => [...entries.keys()].map((url) => new Request(url)),
      delete: async (r: Request | string) => entries.delete(key(r)),
    };
  };
  return {
    store,
    api: {
      open,
      keys: async () => [...store.keys()],
      delete: async (name: string) => store.delete(name),
    },
  };
}

type FakeClient = { url: string; focus: ReturnType<typeof vi.fn>; navigate: ReturnType<typeof vi.fn> };

function worker(options: { caches?: Record<string, Record<string, Response>>; clients?: FakeClient[] } = {}) {
  const listeners = new Map<string, Listener>();
  const caches = fakeCaches(options.caches);
  const fetch = vi.fn<(request: Request) => Promise<Response>>();
  const clients = {
    claim: vi.fn(async () => {}),
    matchAll: vi.fn(async () => options.clients ?? []),
    openWindow: vi.fn(async () => null),
  };
  const registration = { showNotification: vi.fn(async () => {}) };
  const self = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn(),
    clients,
    registration,
    location: new URL(`${ORIGIN}/sw.js`),
  };
  vm.runInNewContext(SOURCE, { self, caches: caches.api, fetch, URL, Response, Request, Promise, console });

  /** Fires an event and waits for everything it handed to waitUntil or respondWith. */
  async function fire(type: string, event: Record<string, unknown>) {
    const pending: Promise<unknown>[] = [];
    let responded: Promise<Response> | undefined;
    listeners.get(type)!({
      ...event,
      waitUntil: (p: Promise<unknown>) => pending.push(p),
      respondWith: (p: Promise<Response>) => {
        responded = p;
      },
    });
    // A fetch hands its caching to waitUntil only once the response is back.
    await responded;
    await Promise.all(pending);
    return responded;
  }

  const get = (path: string, { mode, ...init }: RequestInit = {}) => {
    const request = new Request(new URL(path, ORIGIN), init);
    // Node's Request refuses mode "navigate"; a browser page load has it.
    if (mode) Object.defineProperty(request, "mode", { value: mode });
    return fire("fetch", { request });
  };

  return { fire, get, fetch, caches: caches.store, clients, registration, self };
}

const immutable = (body = "js", init: ResponseInit = {}) =>
  new Response(body, {
    status: 200,
    ...init,
    headers: { "Cache-Control": "public, max-age=31536000, immutable", ...(init.headers ?? {}) },
  });

/** Node's Response is type "default"; a same-origin browser fetch is "basic". */
function basic(response: Response, extra: Partial<Pick<Response, "redirected">> = {}) {
  Object.defineProperty(response, "type", { value: "basic" });
  if (extra.redirected) Object.defineProperty(response, "redirected", { value: true });
  return response;
}

describe("install and activate", () => {
  it("takes over at once", async () => {
    const sw = worker();
    await sw.fire("install", {});
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it("deletes the old wedding-planner-v2 cache and any other, keeps its own and claims open pages", async () => {
    const sw = worker({
      caches: {
        "wedding-planner-v2": { [`${ORIGIN}/`]: new Response("old page") },
        "wedding-planner-v1": {},
        [CACHE]: { [`${ORIGIN}/_next/static/chunks/a.js`]: immutable() },
      },
    });
    await sw.fire("activate", {});
    expect([...sw.caches.keys()]).toEqual([CACHE]);
    expect(sw.clients.claim).toHaveBeenCalled();
  });
});

describe("fetch", () => {
  it("leaves page loads to the network, even when an old cache holds the page", async () => {
    const sw = worker({ caches: { "wedding-planner-v2": { [`${ORIGIN}/`]: new Response("old page") } } });
    expect(await sw.get("/", { mode: "navigate" })).toBeUndefined();
    expect(await sw.get("/schedule?day=2026-11-02", { mode: "navigate" })).toBeUndefined();
  });

  it("leaves everything outside /_next/static/ alone", async () => {
    const sw = worker();
    for (const path of ["/api/files/abc", "/manifest.webmanifest", "/icon-192.png", "/sw.js", "/_next/image?url=x"]) {
      expect(await sw.get(path)).toBeUndefined();
    }
    expect(await sw.fire("fetch", { request: new Request("https://firestore.googleapis.com/x") })).toBeUndefined();
    expect(await sw.fire("fetch", { request: new Request(`${ORIGIN}/_next/static/a.js`, { method: "POST" }) })).toBeUndefined();
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it("caches a hashed script or font once and serves it from the cache after", async () => {
    const sw = worker();
    sw.fetch.mockResolvedValueOnce(basic(immutable("font")));
    const first = await sw.get("/_next/static/media/jost.abc123.woff2");
    expect(await first!.text()).toBe("font");
    const second = await sw.get("/_next/static/media/jost.abc123.woff2");
    expect(await second!.text()).toBe("font");
    expect(sw.fetch).toHaveBeenCalledTimes(1);
    expect(sw.caches.get(CACHE)!.size).toBe(1);
  });

  it("never caches errors, redirects, opaque answers or files the server doesn't mark immutable", async () => {
    const sw = worker();
    const answers = [
      basic(immutable("missing", { status: 404 })),
      basic(immutable("broken", { status: 500 })),
      basic(immutable("moved"), { redirected: true }),
      immutable("opaque"),
      basic(new Response("dev build", { headers: { "Cache-Control": "no-store, must-revalidate" } })),
    ];
    for (const answer of answers) {
      sw.fetch.mockResolvedValueOnce(answer);
      const response = await sw.get("/_next/static/chunks/page.js");
      expect(response).toBe(answer);
    }
    expect(sw.caches.get(CACHE)?.size ?? 0).toBe(0);
  });

  it("fails like the network when offline and nothing is cached", async () => {
    const sw = worker();
    sw.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(sw.get("/_next/static/chunks/new.js")).rejects.toThrow("Failed to fetch");
  });

  it("keeps at most 300 files, dropping the oldest", async () => {
    const entries: Record<string, Response> = {};
    for (let i = 0; i < 300; i++) entries[`${ORIGIN}/_next/static/chunks/${i}.js`] = immutable();
    const sw = worker({ caches: { [CACHE]: entries } });
    sw.fetch.mockResolvedValueOnce(basic(immutable()));
    await sw.get("/_next/static/chunks/new.js");
    const kept = sw.caches.get(CACHE)!;
    expect(kept.size).toBe(300);
    expect(kept.has(`${ORIGIN}/_next/static/chunks/0.js`)).toBe(false);
    expect(kept.has(`${ORIGIN}/_next/static/chunks/new.js`)).toBe(true);
  });
});

describe("push", () => {
  const push = (payload: unknown) => ({
    data: { json: () => (typeof payload === "string" ? JSON.parse(payload) : payload) },
  });

  it("shows the reminder with the day to open", async () => {
    const sw = worker();
    await sw.fire(
      "push",
      push({ title: "Florist tasting tomorrow", body: "10:00 at Bloom", url: "/schedule/month?day=2026-11-02", tag: "event-1" }),
    );
    expect(sw.registration.showNotification).toHaveBeenCalledWith("Florist tasting tomorrow", {
      body: "10:00 at Bloom",
      tag: "event-1",
      icon: "/icon-192.png",
      data: { url: "/schedule/month?day=2026-11-02" },
    });
  });

  it("still shows a notification when the push can't be read", async () => {
    const sw = worker();
    await sw.fire("push", push("{not json"));
    await sw.fire("push", { data: null });
    expect(sw.registration.showNotification).toHaveBeenCalledTimes(2);
    expect(sw.registration.showNotification).toHaveBeenLastCalledWith(
      "Our wedding planner",
      expect.objectContaining({ data: { url: "/" } }),
    );
  });

  it("never keeps an address on another site", async () => {
    const sw = worker();
    for (const url of ["https://evil.example/", "//evil.example/", "/\\evil.example/", "javascript:alert(1)"]) {
      await sw.fire("push", push({ title: "x", url }));
      expect(sw.registration.showNotification).toHaveBeenLastCalledWith("x", expect.objectContaining({ data: { url: "/" } }));
    }
  });
});

describe("notificationclick", () => {
  const click = (url: string | undefined) => ({ notification: { close: vi.fn(), data: { url } } });
  const client = (url: string): FakeClient => ({ url, focus: vi.fn(async () => {}), navigate: vi.fn(async () => {}) });

  it("focuses an open planner and takes it to the day", async () => {
    const open = client(`${ORIGIN}`);
    const sw = worker({ clients: [open] });
    const event = click("/schedule/month?day=2026-11-02");
    await sw.fire("notificationclick", event);
    expect(event.notification.close).toHaveBeenCalled();
    expect(open.focus).toHaveBeenCalled();
    expect(open.navigate).toHaveBeenCalledWith(`${ORIGIN}/schedule/month?day=2026-11-02`);
    expect(sw.clients.openWindow).not.toHaveBeenCalled();
  });

  it("opens the day when no planner is open", async () => {
    const sw = worker({ clients: [] });
    await sw.fire("notificationclick", click("/schedule/month?day=2026-11-02"));
    expect(sw.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/schedule/month?day=2026-11-02`);
  });

  it("stays on the page when the open window can't be moved", async () => {
    const open = client(`${ORIGIN}/`);
    open.navigate.mockRejectedValueOnce(new TypeError("not controlled"));
    const sw = worker({ clients: [open] });
    await sw.fire("notificationclick", click("/schedule"));
    expect(open.focus).toHaveBeenCalled();
    expect(sw.clients.openWindow).not.toHaveBeenCalled();
  });

  it("opens the home page for a missing or outside address", async () => {
    const sw = worker({ clients: [] });
    await sw.fire("notificationclick", click(undefined));
    await sw.fire("notificationclick", click("https://evil.example/"));
    expect(sw.clients.openWindow).toHaveBeenNthCalledWith(1, `${ORIGIN}/`);
    expect(sw.clients.openWindow).toHaveBeenNthCalledWith(2, `${ORIGIN}/`);
  });
});
