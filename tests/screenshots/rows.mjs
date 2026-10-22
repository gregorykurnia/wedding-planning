// Task 8.2: the rows of plan §5.1 and how to reach each on the prototype and on the build.
// The row list is read from the plan's §5.1 tables (so it can't drift from them); the recipes
// below say, per group and row label, which prototype address to open and what the build needs:
//   proto: { file, query, run? }       the prototype page (`run` for a click the state needs)
//   build: { path, fixture, fault, app, patch, run?, before?, signedOut?, dirty? }
//     fixture  normal | empty | stress (tests/fixtures; the prototype's own sets)
//     fault    ?fault= values of the state harness (src/lib/data/dev-faults.ts)
//     app      "emulator" (default) or "demo" (the build with no Firebase variables)
//     patch    a named change to the fixture before the page opens (tests/screenshots/patches.ts)
//     dirty    the row writes data (a click that saves, a live partner change): the fixture reloads after it
// A row with no recipe, or `skip: "why"`, is listed in the report as not captured.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PLAN = join(process.cwd(), "redesign/ui-implementation-plan.md");

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[`'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The groups and rows of §5.1, in the plan's order. */
function parsePlan() {
  const text = readFileSync(PLAN, "utf8");
  const start = text.indexOf("### 5.1 ");
  const end = text.indexOf("### 5.2 ");
  const groups = [];
  let group = null;
  for (const line of text.slice(start, end).split("\n")) {
    const head = line.match(/^\*\*(.+?)\*\* · (.+)$/);
    if (head) {
      group = { title: head[1], slug: slug(head[1]), where: head[2].replace(/`/g, ""), rows: [] };
      groups.push(group);
      continue;
    }
    const row = line.match(/^\| (?!State \||---)(.+?) \| \[.\] \| \[.\] \|$/);
    if (row && group) group.rows.push({ label: row[1], slug: slug(row[1]) });
  }
  return groups;
}

// ---- recipes ----
const LATER = "no recipe yet";

/** Labels every screen shares: what the prototype's switcher calls them and which harness fault matches. */
const SHARED = {
  Loading: { proto: "state=loading", build: { fault: "loading" } },
  "Couldn't load": { proto: "state=error", build: { fault: "load" } },
  Offline: { proto: "state=offline", build: { fault: "offline:cold" } },
  Demo: { proto: "state=demo", build: { app: "demo" } },
  Stress: { proto: "stress", build: { fixture: "stress" } },
};

const SYNC_WAIT = 2600;
/** The prototype shows the partner's change 1.6 seconds after it opens; look just after. */
const syncProto = (query = "state=sync") => ({ proto: query, protoRun: (page, h) => h.wait(SYNC_WAIT) });
/** The partner's change arrives while the page is open: the named patch writes it, then look. */
const sync = (patch, extra = {}) => ({
  ...syncProto(),
  build: {
    dirty: true,
    run: async (page, h) => {
      await h.wait(1500);
      await h.patch(patch);
      await h.wait(1600);
    },
    ...extra,
  },
});
const search = (name, text) => async (page, h) => {
  await page.getByRole("searchbox", { name }).fill(text);
  await h.wait(400);
};
const grantNotifications = (permission) => async (page) => {
  await page.addInitScript((value) => Object.defineProperty(Notification, "permission", { get: () => value, configurable: true }), permission);
};

/**
 * Per group: the prototype file, the build's address, and the rows that differ from SHARED or need a
 * recipe of their own. A row value is { proto, build } or { skip }.
 */
const RECIPES = {
  "sign-in": {
    file: "signin.html",
    path: "/sign-in",
    signedOut: true,
    rows: {
      Normal: { proto: "", build: {} },
      Offline: { proto: "state=offline", build: { fault: "offline" } },
      "Not connected (demo)": { proto: "state=demo", build: { app: "demo" } },
    },
  },
  overview: {
    file: "overview.html",
    path: "/",
    rows: {
      Normal: { proto: "", build: {} },
      "No wedding date yet": { proto: "state=nodate", build: { patch: "nodate" } },
      "Just started": { proto: "state=empty", build: { fixture: "empty" } },
      "Install suggestion": {
        proto: "state=install",
        build: { run: (page) => page.evaluate(() => window.dispatchEvent(new Event("beforeinstallprompt"))) },
      },
      "Bella's change arrives": sync("sync-payment"),
    },
  },
  "wedding-settings": {
    file: "settings.html",
    path: "/settings",
    rows: {
      "Normal (allowed)": { proto: "", build: {} },
      "A change didn't save": {
        proto: "state=savefail",
        build: {
          fault: "save",
          run: async (page, h) => {
            const second = page.getByLabel("Second name");
            await second.fill("Isabella");
            await second.blur();
            await h.see("1 change not saved");
          },
        },
      },
      "Notifications not yet allowed": { proto: "state=notif-default", build: { before: grantNotifications("default") } },
      "Notifications turned off": { proto: "state=notif-denied", build: { before: grantNotifications("denied") } },
      "Installed on this phone": {
        proto: "state=installed",
        build: { before: (page) => page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true })) },
      },
    },
  },
  budget: {
    file: "budget.html",
    path: "/budget",
    rows: {
      Normal: { proto: "", build: {} },
      "Nothing booked yet": { proto: "state=empty", build: { fixture: "empty" } },
      "Bella's change arrives": sync("sync-payment"),
      Overpaid: { skip: "no state of its own: the normal data already holds the overpaid Kirana booking, so the Normal pair shows it" },
    },
  },
  bookings: {
    file: "bookings.html",
    path: "/budget/bookings",
    rows: {
      Normal: { proto: "", build: {} },
      "Nothing booked yet": { proto: "state=empty", build: { fixture: "empty" } },
      "No results": { proto: "state=noresults", build: { run: search("Search bookings", "Surabaya") } },
      "Bella's change arrives": sync("sync-payment"),
    },
  },
  "a-booking": {
    file: "booking.html?id=samaya",
    path: "/budget/bookings/venue-samaya",
    rows: {
      "In parts": { proto: "", build: {} },
      Single: { file: "booking.html?id=ayu", proto: "", build: { path: "/budget/bookings/vendor-ayu" } },
      Overpaid: { file: "booking.html?id=kirana", proto: "", build: { path: "/budget/bookings/vendor-kirana" } },
      Late: { file: "booking.html?id=rana", proto: "", build: { path: "/budget/bookings/vendor-rana" } },
      "Paid in full": { file: "booking.html?id=cincin", proto: "", build: { path: "/budget/bookings/vendor-cincin" } },
      "Bella's change arrives": { ...sync("sync-payment", { path: "/budget/bookings/vendor-lestari" }), file: "booking.html?id=lestari" },
      Stress: { file: "booking.html?id=s-deep", proto: "stress", build: { fixture: "stress", path: "/budget/bookings/venue-s-deep" } },
    },
  },
  "add-a-booking": {
    file: "booking-new.html",
    path: "/budget/bookings/new",
    rows: {
      Normal: { proto: "", build: {} },
      Demo: { proto: "state=demo", build: { app: "demo" } },
      Offline: { proto: "state=offline", build: { fault: "offline" } },
    },
  },
  "payments-due": {
    file: "payments.html",
    path: "/budget/payments",
    rows: {
      Normal: { proto: "", build: {} },
      "Nothing due": { proto: "state=empty", build: { fixture: "empty" } },
      "Bella's change arrives": sync("sync-payment"),
    },
  },
  "who-pays": {
    file: "funders.html",
    path: "/budget/who-pays",
    rows: {
      Normal: { proto: "", build: {} },
      "Nothing booked yet": { proto: "state=empty", build: { fixture: "empty" } },
      "Bella's change arrives": sync("sync-payment"),
    },
  },
  "what-if-items": {
    file: "whatif.html",
    path: "/budget/what-if",
    rows: {
      Normal: { proto: "", build: {} },
      "No what-if items": { proto: "state=empty", build: { fixture: "empty" } },
      "Bella adds an idea": sync("sync-whatif"),
    },
  },
  vendors: {
    file: "vendors.html",
    path: "/vendors",
    rows: {
      Normal: { proto: "", build: {} },
      "No vendors yet": { proto: "state=empty", build: { fixture: "empty" } },
      "Bella adds a vendor": sync("sync-vendor"),
    },
  },
  "a-vendor": {
    file: "vendor.html?id=kebun",
    path: "/vendors/kebun",
    rows: {
      Normal: { proto: "", build: {} },
      "No prices": { file: "vendor.html?id=ara", proto: "", build: { path: "/vendors/ara" } },
      "Ruled out": { file: "vendor.html?id=nusantara", proto: "", build: { path: "/vendors/nusantara" } },
      Stress: { file: "vendor.html?id=sv-long", proto: "stress", build: { fixture: "stress", path: "/vendors/sv-long" } },
    },
  },
  shortlist: {
    file: "shortlist.html",
    path: "/vendors/shortlist",
    rows: {
      Normal: { proto: "", build: {} },
      "Nothing on the shortlist": { proto: "state=empty", build: { fixture: "empty" } },
      "Bella adds a finalist": sync("sync-finalist"),
    },
  },
  "a-finalist": {
    file: "finalist.html?id=f-kebun",
    path: "/vendors/shortlist/f-kebun",
    rows: {
      "Copied from a vendor": { proto: "", build: {} },
      "From scratch": { file: "finalist.html?id=f-arka", proto: "", build: { path: "/vendors/shortlist/f-arka" } },
      Stress: { file: "finalist.html?id=sf-deep", proto: "stress", build: { fixture: "stress", path: "/vendors/shortlist/sf-deep" } },
    },
  },
  venues: {
    file: "venues.html",
    path: "/vendors/venues",
    rows: {
      Normal: { proto: "", build: {} },
      "No venues yet": { proto: "state=empty", build: { fixture: "empty" } },
      "No results": { proto: "state=noresults", build: { run: search("Search venues", "zzzz") } },
      "Bella adds a venue": sync("sync-venue"),
    },
  },
  documents: {
    file: "documents.html",
    path: "/documents",
    rows: {
      Normal: { proto: "", build: {} },
      "Nothing written yet": { proto: "state=empty", build: { fixture: "empty" } },
      "No results": { proto: "state=noresults", build: { run: search("Search documents", "zzzz") } },
      "Bella starts a document": sync("sync-document"),
    },
  },
  "a-document": {
    file: "doc.html?id=kebun-meeting",
    path: "/documents/kebun-meeting",
    rows: {
      Saved: { proto: "", build: {} },
      Stress: { file: "doc.html?id=s-long", proto: "stress", build: { fixture: "stress", path: "/documents/s-long" } },
    },
  },
  files: {
    file: "files.html",
    path: "/documents/files",
    rows: {
      Normal: { proto: "", build: {} },
      "No files yet": { proto: "state=empty", build: { fixture: "empty" } },
      "Three levels down": { file: "files.html?folder=old", proto: "", build: { path: "/documents/files?folder=old" } },
      "Bella uploads a file": sync("sync-file"),
    },
  },
  "schedule-agenda": {
    file: "schedule.html",
    path: "/schedule",
    rows: {
      Normal: { proto: "", build: {} },
      "Nothing scheduled": { proto: "state=empty", build: { fixture: "empty" } },
      "No results": { proto: "state=noresults", build: { run: search("Search the schedule", "zzzz") } },
      "Notifications not yet allowed": { proto: "state=notif-default", build: { before: grantNotifications("default"), path: "/schedule?event=e2" } },
      "Notifications turned off": { proto: "state=notif-denied", build: { before: grantNotifications("denied"), path: "/schedule?event=e2" } },
      "An event's details": { proto: "state=event", build: { path: "/schedule?event=e2" } },
      "Adding an event": { proto: "state=new", build: { path: "/schedule?new=1" } },
      "Bella adds an appointment": sync("sync-event"),
    },
  },
  "schedule-month": {
    file: "schedule.html?view=month",
    path: "/schedule/month",
    rows: {
      Normal: { proto: "", build: {} },
      Stress: { proto: "stress", build: { fixture: "stress" } },
    },
  },
  tasks: {
    file: "tasks.html",
    path: "/schedule/tasks",
    rows: {
      Normal: { proto: "", build: {} },
      "A task opened": { proto: "state=open", build: { path: "/schedule/tasks?open=t1" } },
      "No tasks yet": { proto: "state=empty", build: { fixture: "empty" } },
      "Bella finishes a step": sync("sync-task"),
    },
  },
  "wedding-items": {
    file: "items.html",
    path: "/items",
    rows: {
      Normal: { proto: "", build: {} },
      "First use, pre-filled": { proto: "state=first", build: { fixture: "empty" } },
      "Nothing tracked yet": { proto: "state=empty", build: { fixture: "empty", patch: "items-started" } },
      "Bella confirms an item": sync("sync-item"),
    },
  },
  guests: {
    file: "guests.html",
    path: "/guests",
    rows: {
      Normal: { proto: "", build: {} },
      "No guests yet": { proto: "state=empty", build: { fixture: "empty" } },
      "No results": { proto: "state=noresults", build: { run: search("Search guests", "Surabaya") } },
      "A guest's details": { proto: "state=guest", build: { path: "/guests?guest=guest-3" } },
      "Bella records an RSVP": sync("sync-guest"),
    },
  },
};

// ---- rows that need a click or typing on one or both sides ----
const press = (role, name) => async (page, h) => {
  await page.getByRole(role, typeof name === "string" ? { name, exact: false } : { name }).first().click({ timeout: 10_000 });
  await h.wait(500);
};
const protoClick = (role, name) => ({ protoRun: press(role, name) });
const buildOnly = (reason) => ({ skip: reason });
const ACCOUNT_THREE = { email: "guest.not.allowed@example.com", password: "test-password-3" };
const authUrl = `http://127.0.0.1:${9099 + Number(process.env.TEST_PORT_OFFSET ?? 30)}`;

const EXTRA = {
  "sign-in": {
    "Signing in (`?state=busy`)": {
      proto: "state=busy",
      build: {
        before: (page) => page.route("**/accounts:signInWithPassword*", () => {}),
        run: async (page, h) => {
          await page.getByLabel("Email").fill("gregory.kurnia@gmail.com");
          await page.getByLabel("Password").fill("test-password-1");
          await page.getByRole("button", { name: "Sign in" }).click();
          await h.wait(600);
        },
      },
    },
    "Wrong email or password": {
      proto: "state=wrong",
      build: {
        run: async (page, h) => {
          await page.getByLabel("Email").fill("gregory.kurnia@gmail.com");
          await page.getByLabel("Password").fill("not-the-password");
          await page.getByRole("button", { name: "Sign in" }).click();
          await h.wait(1500);
        },
      },
    },
    "Account not allowed": {
      proto: "state=notallowed",
      build: {
        run: async (page, h) => {
          const base = process.env.SHOTS_AUTH ?? authUrl;
          await fetch(`${base}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...ACCOUNT_THREE, returnSecureToken: true }),
          }).catch(() => {});
          await page.getByLabel("Email").fill(ACCOUNT_THREE.email);
          await page.getByLabel("Password").fill(ACCOUNT_THREE.password);
          await page.getByRole("button", { name: "Sign in" }).click();
          await h.wait(2500);
        },
      },
    },
    "Just signed out": {
      proto: "state=signedout",
      build: {
        run: async (page, h) => {
          await page.getByLabel("Email").fill("gregory.kurnia@gmail.com");
          await page.getByLabel("Password").fill("test-password-1");
          await page.getByRole("button", { name: "Sign in" }).click();
          await page.waitForURL(`${h.base}/`, { timeout: 30_000 });
          await page.goto(`${h.base}/settings`);
          await page.getByRole("button", { name: /sign out/i }).first().click();
          await page.waitForURL(/sign-in/, { timeout: 30_000 });
          await h.wait(1000);
        },
      },
    },
  },
  budget: {
    "Record a payment (sheet)": { ...protoClick("button", "Record payment"), build: { run: press("button", "Record payment") } },
    "Menu open": { ...protoClick("button", "Menu"), build: { run: press("button", "Menu") } },
  },
  "a-booking": {
    "Removed by Bella": {
      file: "booking.html?id=lestari",
      proto: "state=gone",
      build: {
        path: "/budget/bookings/vendor-lestari",
        dirty: true,
        run: async (page, h) => {
          await h.wait(1000);
          await h.patch("gone-booking");
          await h.wait(2500);
        },
      },
    },
    "Uploading files": buildOnly("needs a held upload: the harness has an upload that fails part-way, not one that stays at a percentage"),
    "Split, remove part, remove booking (with undo)": buildOnly("a sequence of writes with Undo toasts between them; it needs its own scripted flow (the behaviour tests cover it)"),
    "A change didn't save": {
      proto: "state=savefail",
      build: {
        fault: "save",
        run: async (page, h) => {
          await page.locator("summary").last().click();
          const paid = page.getByLabel("Paid so far").last();
          await paid.fill("5000000");
          await paid.blur();
          await h.see("1 change not saved");
        },
      },
    },
  },
  "add-a-booking": {
    Adding: buildOnly("a write that never answers can't be held from outside the app (the harness has fail and offline, not stall)"),
    "Couldn't add": {
      proto: "state=failed",
      build: {
        fault: "save",
        run: async (page, h) => {
          await page.getByLabel("What it is").fill("Harp for the ceremony");
          await page.getByRole("button", { name: "Add booking" }).click();
          await h.see("The booking wasn’t added");
        },
      },
    },
    "Missing name": {
      proto: "",
      protoRun: async (page, h) => {
        await page.getByRole("button", { name: /add booking/i }).first().click();
        await h.wait(500);
      },
      build: {
        run: async (page, h) => {
          await page.getByRole("button", { name: "Add booking" }).click();
          await h.wait(500);
        },
      },
    },
  },
  "who-pays": {
    Renaming: {
      proto: "state=rename",
      build: {
        run: async (page, h) => {
          await page.getByRole("button", { name: "Rename" }).first().click();
          await h.wait(400);
        },
      },
    },
    Adding: { proto: "state=adding", build: { run: press("button", "Add a funder") } },
  },
  "what-if-items": {
    "A change didn't save": { skip: "needs a per-screen edit recipe for the what-if sheet" },
    "Add (sheet)": { ...protoClick("button", /add/i), build: { run: press("button", /^add/i) } },
  },
  vendors: {
    "No results (search, category, keen)": { proto: "state=noresults", build: { run: search("Search vendors", "harpist") } },
    "Adding a vendor": {
      proto: "state=capture",
      build: {
        run: async (page, h) => {
          await page.getByRole("button", { name: "Add a vendor" }).first().click();
          await page.getByRole("dialog").getByLabel("Name").fill("Bunga Melati Florist");
          await h.wait(300);
        },
      },
    },
    "Editing categories": { proto: "state=categories", build: { run: press("button", "Edit categories") } },
  },
  "a-vendor": {
    "A change didn't save": {
      proto: "state=savefail",
      build: {
        fault: "save",
        run: async (page, h) => {
          const rating = page.getByLabel("Review rating");
          await rating.fill("4,9");
          await rating.blur();
          await h.see("1 change not saved");
        },
      },
    },
  },
  shortlist: {
    "Adding a finalist": { proto: "state=adding", build: { run: press("button", "Add a finalist") } },
  },
  venues: {
    "A change didn't save": buildOnly("needs a per-screen edit recipe for the venue sheet"),
  },
  "a-document": {
    Delete: { ...protoClick("button", /delete/i), build: { run: press("button", /delete/i) } },
    "Deleted by Bella": buildOnly("the prototype has no state for it (it only designs the document, not its removal by Bella)"),
    "Meeting notes, just started": { file: "doc.html?new=meeting", proto: "", build: { path: "/documents/new?start=meeting", dirty: true } },
    Blank: { file: "doc.html?new=blank", proto: "", build: { path: "/documents/new?start=blank", dirty: true } },
    "Couldn't save": {
      file: "doc.html?id=kebun-meeting",
      proto: "state=savefail",
      build: {
        fault: "save",
        run: async (page, h) => {
          const title = page.getByLabel("Title");
          await title.fill("Kebun Bunga meeting, again");
          await h.wait(2500);
        },
      },
    },
    "Went offline while writing": {
      file: "doc.html?id=kebun-meeting",
      proto: "state=offline-edit",
      build: {
        fault: "offline",
        run: async (page, h) => {
          await page.getByLabel("Title").fill("Kebun Bunga meeting, again");
          await h.wait(2500);
        },
      },
    },
  },
  files: {
    "No results": { proto: "state=noresults", build: { run: search("Find a file", "invoice zzz") } },
    Uploading: buildOnly("the upload sheet's progress, shrinking and too-large lines come from the prototype's frozen list; the build shows real progress only"),
  },
  "schedule-agenda": {
    "Payments filter": { ...protoClick("button", "Payments"), build: { run: press("button", "Payments") } },
  },
  tasks: {
    "Everything done": buildOnly("needs every open task finished through the screen (hundreds of clicks on the normal set)"),
  },
  "wedding-items": {
    "First use, pre-filled": { proto: "state=first", build: { fixture: "empty", dirty: true } }, // the screen fills itself on first use
    "No results": { proto: "state=noresults", build: { run: search("Search items, vendors and people", "photo booth") } },
  },
  guests: {
    "Who hasn't replied": {
      proto: "state=waiting",
      build: {
        run: async (page, h) => {
          await page.getByLabel("RSVP").first().selectOption({ label: "Waiting" });
          await h.wait(500);
        },
      },
    },
  },
  "not-found-and-unexpected-error": {
    "Unexpected error (N2)": buildOnly("the harness has no switch that raises the error screen"),
    "Address that leads nowhere (N2)": { file: "notfound.html", proto: "", build: { path: "/this-address-leads-nowhere" } },
  },
  "shared-shell": {
    "Menu open and closed": { file: "overview.html", ...protoClick("button", "Menu"), build: { path: "/", run: press("button", "Menu") } },
    "Sheet as a bottom sheet (phone) and centred (desktop)": {
      file: "vendors.html",
      proto: "state=capture",
      build: { path: "/vendors", run: press("button", "Add a vendor") },
    },
    "Toasts stacked over a sheet": buildOnly("needs several partner changes arriving while a sheet is open; recipe pending"),
    "Reduced motion": buildOnly("every capture already runs with motion reduced, so there's no separate pair to compare"),
  },
};

// A second batch, merged into EXTRA below.
const EXTRA2 = {
  bookings: {
    "Just added": {
      file: "booking-new.html",
      proto: "",
      protoRun: async (page, h) => {
        await page.getByLabel("What it is").fill("Harp for the ceremony");
        await page.getByRole("button", { name: /add booking/i }).first().click();
        await page.waitForURL(/bookings\.html/, { timeout: 8000 });
        await h.wait(700);
      },
      build: {
        path: "/budget/bookings/new",
        dirty: true,
        run: async (page, h) => {
          await page.getByLabel("What it is").fill("Harp for the ceremony");
          await page.getByRole("button", { name: "Add booking" }).click();
          await page.waitForURL(/\/budget\/bookings(\?|$)/, { timeout: 15_000 });
          await h.wait(700);
        },
      },
    },
  },
  "who-pays": {
    "Remove (confirm and undo)": { ...protoClick("button", /^remove/i), build: { run: press("button", /^remove/i) } },
    "Overpaid funder": buildOnly("no state of its own: the normal data already holds an overpaid funder, so the Normal pair shows it"),
  },
  "what-if-items": {
    "Edit (sheet)": {
      protoRun: press("button", "Edit"),
      build: {
        run: async (page, h) => {
          await page.getByText("Fireworks at the reception").first().click({ timeout: 10_000 });
          await h.wait(500);
        },
      },
    },
    "Split into parts": buildOnly("a step inside the edit sheet; needs the edit recipe working first"),
  },
  vendors: {
    "Category name taken": {
      proto: "state=taken",
      build: {
        run: async (page, h) => {
          await page.getByRole("button", { name: "Edit categories" }).first().click();
          await page.getByLabel("New category").fill("Catering");
          await page.getByLabel("New category").press("Enter");
          await h.wait(500);
        },
      },
    },
    Export: buildOnly("a download: it leaves no screen state of its own"),
  },
  "a-vendor": {
    "Price option add and edit": { ...protoClick("button", "Add a price option"), build: { run: press("button", "Add a price option") } },
    "Uploading files": buildOnly("needs a held upload: the harness has an upload that fails part-way, not one that stays at a percentage"),
    "Chosen (creates a booking)": buildOnly("a stage change that writes a booking; the pair would compare the result screen, not a state"),
    "Copying to the shortlist": buildOnly("a step that writes a finalist; needs its own recipe"),
  },
  "a-finalist": {
    "Package add and edit": { ...protoClick("button", "Add a package"), build: { run: press("button", "Add a package") } },
    "Booking it": buildOnly("needs the book-it sheet's button name; recipe pending"),
    "Uploading files": buildOnly("needs a held upload: the harness has an upload that fails part-way, not one that stays at a percentage"),
    Booked: buildOnly("needs a finalist already moved to a booking in the normal set; recipe pending"),
    "A change didn't save": buildOnly("needs a per-screen edit recipe for the package sheet"),
  },
  venues: {
    "Venue sheet: add, edit, booked": { ...protoClick("button", "Add a venue"), build: { run: press("button", "Add a venue") } },
  },
  files: {
    "An empty folder": {
      proto: "state=emptyfolder",
      build: { patch: "empty-folder", path: "/documents/files?folder=newf" },
    },
    "A file's details": { proto: "state=file", build: { path: "/documents/files?file=f1" } },
    "Moving a folder": buildOnly("needs the folder menu's button names; recipe pending"),
    "Searching many": buildOnly("a stress search; needs the stress fixture's file names, recipe pending"),
    "Delete a folder with things in it": buildOnly("needs the folder menu's button names; recipe pending"),
    "Delete a file": buildOnly("needs the file sheet's delete button name; recipe pending"),
  },
  "schedule-agenda": {
    "With completed and cancelled": {
      proto: "state=done",
      build: {
        run: async (page, h) => {
          await page.getByText("Show completed and cancelled").first().click({ timeout: 10_000 });
          await h.wait(500);
        },
      },
    },
    "A change didn't save": {
      proto: "state=savefail",
      build: {
        path: "/schedule?event=e2",
        fault: "save",
        run: async (page, h) => {
          await page.getByRole("dialog").getByLabel("Title").fill("Tasting at Sendok Emas, moved");
          await page.getByRole("dialog").getByLabel("Title").blur();
          await h.wait(2500);
        },
      },
    },
  },
  "schedule-month": {
    "A chosen day": buildOnly("needs the day cell's name in the prototype's month grid; recipe pending"),
    "Empty day, Add something": buildOnly("needs the day cell's name in the prototype's month grid; recipe pending"),
  },
  tasks: {
    "A step didn't save": {
      proto: "state=savefail",
      build: {
        path: "/schedule/tasks?open=t1",
        fault: "save",
        run: async (page, h) => {
          await page.getByRole("checkbox").nth(1).click();
          await h.wait(2500);
        },
      },
    },
  },
  "wedding-items": {
    "Sorted for now": {
      proto: "state=sorted",
      build: {
        run: async (page, h) => {
          await page.getByLabel("Order by").selectOption({ label: "Vendor" });
          await h.wait(500);
        },
      },
    },
    "A change didn't save": {
      proto: "state=savefail",
      build: {
        fault: "save",
        run: async (page, h) => {
          await page.getByRole("button", { name: /^Confirmed:/ }).nth(2).click();
          await h.wait(2500);
        },
      },
    },
    "Row menu, remove, add several": { ...protoClick("button", "More for Wedding cake"), build: { run: press("button", "More for Wedding cake") } },
  },
  guests: {
    "Removing a guest with plus-ones": {
      proto: "state=remove",
      build: {
        path: "/guests?guest=guest-3",
        run: async (page, h) => {
          await page.getByRole("dialog").getByRole("button", { name: "Remove guest" }).click();
          await h.wait(500);
        },
      },
    },
    Adding: { ...protoClick("button", "Add a guest"), build: { run: press("button", "Add a guest") } },
    "A reply didn't save": buildOnly("needs the reply switch's button names; recipe pending"),
  },
};
EXTRA2["a-document"] = {
  "Not saved yet": {
    file: "doc.html?id=kebun-meeting",
    proto: "state=unsaved",
    build: { path: "/documents/kebun-meeting", dirty: true, run: (page) => page.getByLabel("Title").fill("Kebun Bunga meeting, again") },
  },
  Saving: buildOnly("a held save can't be made from outside the app (the harness fails or goes offline, it doesn't stall)"),
  "Cursor in a table": {
    file: "doc.html?id=kebun-meeting",
    proto: "state=table",
    build: { path: "/documents/kebun-meeting", run: (page) => page.locator("td").first().click() },
  },
  "Editing a total": buildOnly("needs the total cell's position in the document; recipe pending"),
  "A total with a mistake": buildOnly("needs the mistaken total's position in the Totals document; recipe pending"),
  "Bella is in it too": buildOnly("needs the partner in the same document: a second signed-in browser"),
};
for (const [group, rows] of Object.entries(EXTRA2)) EXTRA[group] = { ...(EXTRA[group] ?? {}), ...rows };

// ---- assembling ----
export const GROUPS = parsePlan().map((g) => {
  const recipe = { ...(RECIPES[g.slug] ?? {}), rows: { ...(RECIPES[g.slug]?.rows ?? {}), ...(EXTRA[g.slug] ?? {}) } };
  const rows = g.rows.map((r) => {
    const id = `${g.slug}--${r.slug}`;
    const found = recipe.rows?.[r.label] ?? SHARED[r.label.replace(/\s*\(.*$/, "")] ?? null;
    const base = { id, label: r.label, group: g };
    if (/after design/.test(r.label) && !recipe.rows?.[r.label]) return { ...base, skip: "waits for its need (after design)" };
    if (!found || found.skip) return { ...base, skip: found?.skip ?? LATER };
    if (!recipe.file && !found.file) return { ...base, skip: LATER };
    const q = found.proto ?? "";
    return {
      ...base,
      proto: { file: found.file ?? recipe.file, query: q, run: found.protoRun },
      build: {
        app: "emulator",
        fixture: "normal",
        signedOut: recipe.signedOut ?? false,
        ...found.build,
        path: found.build?.path ?? recipe.path ?? "/",
      },
    };
  });
  return { ...g, rows };
});

export function rowsOf(groups) {
  return groups.flatMap((g) => g.rows.map((r) => ({ ...r, group: g })));
}
