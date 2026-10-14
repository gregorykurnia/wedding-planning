/* Veil prototype: shell, money and date helpers, sheets, toasts and states.
   Query switches: ?stress (stress data) and ?state=<name> (see each page's switcher). */
(function () {
  const D = window.VEIL_DATA;
  const q = new URLSearchParams(location.search);
  const STATE = q.get("state") || "normal";
  const STRESS = q.has("stress");
  const DEMO = STATE === "demo";
  const TODAY = new Date(D.TODAY + "T00:00:00");

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const data = clone(STRESS ? D.STRESS : (STATE === "empty" || DEMO) ? D.EMPTY : D.NORMAL);
  /* A booking added on the "Add a booking" screen stays for this browser session. */
  let added = null;
  try { added = JSON.parse(sessionStorage.getItem("veil-added") || "null"); } catch (e) {}
  if (added && !DEMO && STATE !== "empty") data.bookings.push(added);

  /* ---------- formatting ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const group = (n) => Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const rp = (n) => (n < 0 ? "−" : "") + "Rp " + group(n);
  const fig = (n) => `<span class="rp">Rp</span>${n < 0 ? "−" : ""}${group(n)}`;
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const d8 = (iso) => new Date(iso + "T00:00:00");
  const dateLong = (iso) => { const d = d8(iso); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== TODAY.getFullYear() ? " " + d.getFullYear() : ""}`; };
  const dateShort = (iso) => { const d = d8(iso); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}${d.getFullYear() !== TODAY.getFullYear() ? " " + d.getFullYear() : ""}`; };
  const monthOf = (iso) => { const d = d8(iso); return MONTHS[d.getMonth()] + (d.getFullYear() !== TODAY.getFullYear() ? " " + d.getFullYear() : ""); };
  const daysFrom = (iso) => Math.round((d8(iso) - TODAY) / 86400000);
  const plural = (n, one, many) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : (many || one + "s")}`;
  const SOON = 14;
  const urgency = (iso) => { if (!iso) return "none"; const n = daysFrom(iso); return n < 0 ? "late" : n <= SOON ? "soon" : "later"; };
  const relDue = (iso) => {
    const n = daysFrom(iso);
    if (n < 0) return plural(-n, "day") + " late";
    if (n === 0) return "due today";
    if (n === 1) return "due tomorrow";
    if (n <= SOON) return `due in ${n} days`;
    return "due " + dateLong(iso);
  };

  /* ---------- money model ---------- */
  const funderName = (id) => id == null ? "Not assigned" : ((data.funders.find((f) => f.id === id) || {}).name || "Not assigned");
  const paidBy = (id) => id == null ? "no funder yet" : "paid by " + funderName(id);
  const andList = (a) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  const partsOf = (b) => b.parts ? b.parts : [{ id: null, name: b.name, price: b.price, paid: b.paid || 0, funder: b.funder, due: b.due, step: b.step }];
  const totals = (b) => {
    const ps = partsOf(b);
    const price = ps.reduce((s, p) => s + (p.price || 0), 0);
    const paid = ps.reduce((s, p) => s + (p.paid || 0), 0);
    const open = ps.filter((p) => p.due && p.price - (p.paid || 0) > 0).sort((a, z) => a.due.localeCompare(z.due));
    const funders = [...new Set(ps.map((p) => p.funder ?? null))];
    return { price, paid, left: price - paid, next: open[0] || null, funders, over: paid > price, overParts: ps.filter((p) => (p.paid || 0) > p.price).length };
  };
  const budget = () => {
    let price = 0, paid = 0, over = 0;
    data.bookings.forEach((b) => { const t = totals(b); price += t.price; paid += t.paid; if (t.over) over++; });
    return { price, paid, left: price - paid, over, count: data.bookings.length };
  };
  const dues = () => {
    const out = [];
    data.bookings.forEach((b) => partsOf(b).forEach((p) => {
      const left = p.price - (p.paid || 0);
      if (p.due && left > 0) out.push({ b, p, left, due: p.due, funder: p.funder ?? null, urgency: urgency(p.due) });
    }));
    return out.sort((a, z) => a.due.localeCompare(z.due) || z.left - a.left);
  };
  const byFunder = () => {
    const rows = data.funders.map((f) => ({ id: f.id, name: f.name, price: 0, paid: 0, count: 0 }));
    rows.push({ id: null, name: "Not assigned", price: 0, paid: 0, count: 0 });
    data.bookings.forEach((b) => partsOf(b).forEach((p) => {
      const r = rows.find((x) => x.id === (p.funder ?? null)) || rows[rows.length - 1];
      r.price += p.price; r.paid += p.paid || 0; r.count++;
    }));
    rows.forEach((r) => (r.left = r.price - r.paid));
    return rows;
  };
  const wiParts = (w) => w.parts ? w.parts : [{ id: null, name: w.name, price: w.price, funder: w.funder }];
  const wiTotal = (w) => wiParts(w).reduce((s, p) => s + (p.price || 0), 0);
  const whatif = () => data.whatifs.reduce((s, w) => s + wiTotal(w), 0);
  const daysLeft = () => daysFrom(data.wedding);

  /* ---------- links keep the data set and demo mode ---------- */
  const href = (path, extra) => {
    const [base, qs] = path.split("?");
    const p = new URLSearchParams(qs || "");
    Object.entries(extra || {}).forEach(([k, v]) => p.set(k, v));
    if (STRESS) p.set("stress", "");
    if (DEMO) p.set("state", "demo");
    const s = p.toString().replace(/=(&|$)/g, "$1");
    return base + (s ? "?" + s : "");
  };

  /* ---------- icons ---------- */
  const ICON = {
    chev: '<svg class="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>',
    back: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>',
    search: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
    /* a single knot of ribbon, the Veil mark for empty and quiet moments */
    knot: '<svg class="mark" viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M36 36c-8-10-22-14-24-6s14 10 24 6zM36 36c8-10 22-14 24-6s-14 10-24 6z"/><path d="M36 36c-4 8-10 18-14 24M36 36c4 8 10 18 14 24"/><circle cx="36" cy="36" r="3"/></svg>',
    cloud: '<svg class="mark" viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M22 50h30a10 10 0 0 0 0-20 14 14 0 0 0-27-3 11 11 0 0 0-3 23z"/><path d="M14 14l44 44"/></svg>',
  };

  /* ---------- shell ---------- */
  const SECTIONS = [
    ["Overview", "Days to go and what's next", "overview.html"],
    ["Budget", "Bookings, payments and who pays", "budget.html"],
    ["Vendors", "Everyone we're considering, the shortlist and venues", "vendors.html"],
    ["Wedding items", "Every piece and who provides it", "items.html"],
    ["Schedule", "Appointments, tasks and deadlines", "schedule.html"],
    ["Documents", "Notes, plans and files", "documents.html"],
    ["Guests", "Who's coming to what", "guests.html"],
  ];
  let cfg = {};
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];

  function header() {
    const [a, b] = data.couple;
    return `<header class="top">
      <a class="couple" href="${href("overview.html")}">${esc(a)} <span>&amp;</span> ${esc(b)}</a>
      <div class="where">${esc(cfg.where || "Budget")}</div>
      <button class="menu-btn" aria-expanded="false" aria-controls="index"><i></i>Menu</button>
    </header>`;
  }
  function indexPage() {
    return `<div class="index" id="index" hidden role="dialog" aria-modal="true" aria-label="Menu">
      <header class="top"><span class="couple">${esc(data.couple[0])} <span>&amp;</span> ${esc(data.couple[1])}</span><span></span><button class="menu-btn close-index"><i style="border-bottom:0;height:0"></i>Close</button></header>
      <nav><ol>${SECTIONS.map(([t, s, h]) => `<li><a href="${h === "#" ? "#" : href(h)}" ${h === (cfg.section || "budget.html") ? 'aria-current="page"' : ""} ${h === "#" ? 'data-later="1"' : ""}>${t}<small>${s}</small></a></li>`).join("")}</ol>
      <div class="account"><span>Signed in as ${esc(data.me.email)}</span><span><a class="link" href="${href("settings.html")}">Wedding settings</a>&emsp;<a class="link" href="signin.html?state=signedout">Sign out</a></span></div></nav>
    </div>`;
  }
  function switcher() {
    const states = [["normal", "Normal"]].concat(cfg.states || []);
    const here = location.pathname.split("/").pop();
    const qs = (p) => { const s = p.toString().replace(/=(&|$)/g, "$1"); return here + (s ? "?" + s : ""); };
    const sw = (s) => { const p = new URLSearchParams(location.search); s === "normal" ? p.delete("state") : p.set("state", s); return qs(p); };
    const tog = () => { const p = new URLSearchParams(location.search); STRESS ? p.delete("stress") : p.set("stress", ""); return qs(p); };
    return `<details class="proto"><summary>Prototype</summary><div class="box">
      <b>States on this screen</b>${states.map(([k, l]) => `<a href="${sw(k)}" aria-current="${k === STATE}">${l}</a>`).join("")}
      <b>Data</b><a href="${tog()}">${STRESS ? "Use normal data" : "Use stress data"}</a>
      <b>Screens</b><a href="index.html">All screens and states</a></div></details>`;
  }

  function mount() {
    document.body.insertAdjacentHTML("afterbegin", header());
    document.body.insertAdjacentHTML("beforeend", indexPage() + `<div class="scrim" hidden></div><div class="toasts" role="status" aria-live="polite"></div>` + switcher());
    const idx = $("#index"), btn = $(".top .menu-btn");
    btn.addEventListener("click", () => { idx.hidden = false; btn.setAttribute("aria-expanded", "true"); $(".close-index").focus(); });
    $(".close-index").addEventListener("click", () => { idx.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.focus(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!idx.hidden) $(".close-index").click(); else closeSheet(); } });
    document.addEventListener("click", (e) => { const a = e.target.closest("[data-later]"); if (a) { e.preventDefault(); toast("The prototype stops here. In the app, this opens the file or the file picker."); } });
    if (DEMO) $(".top").insertAdjacentHTML("afterend", `<div class="banner-wrap"><p class="banner">Demonstration mode. The planner isn't connected to its database yet, so there's nothing to show and changes aren't saved.</p></div>`);
  }

  /* ---------- whole-screen states ---------- */
  function stateView(main) {
    const what = cfg.noun || "the budget";
    if (STATE === "loading") {
      main.setAttribute("aria-busy", "true");
      main.innerHTML = `<p class="sr">Loading ${esc(what)}</p><div aria-hidden="true"><div class="sk line" style="max-width:120px"></div><div class="sk fig"></div><div class="sk line"></div><div class="sk card"></div><div class="sk row"></div><div class="sk row"></div><div class="sk row"></div></div>`;
      return true;
    }
    if (STATE === "error") {
      main.innerHTML = `<div class="message">${ICON.knot}<h1>${esc(cap(what))} didn't load</h1><p>The planner couldn't reach its database. Your data is safe; it just isn't here yet.</p><div class="acts"><button class="btn" onclick="location.reload()">Try again</button></div></div>`;
      return true;
    }
    if (STATE === "offline") {
      main.innerHTML = `<div class="message">${ICON.cloud}<h1>You're offline</h1><p>The planner needs a connection to show ${esc(what)}. It will load again as soon as this ${innerWidth < 760 ? "phone" : "computer"} is back online.</p><div class="acts"><button class="btn quiet" onclick="location.reload()">Try again</button></div></div>`;
      return true;
    }
    return false;
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------- sheets and dialogs ---------- */
  let lastFocus = null;
  function openSheet(html, onMount) {
    const s = $(".scrim");
    lastFocus = document.activeElement;
    s.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    s.hidden = false;
    s.onclick = (e) => { if (e.target === s) closeSheet(); };
    if (onMount) onMount($(".sheet", s));
    const f = $(".sheet [autofocus]", s) || $(".sheet button, .sheet input", s); if (f) f.focus();
  }
  function closeSheet() { const s = $(".scrim"); if (!s || s.hidden) return; s.hidden = true; s.innerHTML = ""; if (lastFocus) lastFocus.focus(); }

  function confirm({ title, body, action, danger }) {
    return new Promise((res) => {
      openSheet(`<h2>${esc(title)}</h2><p class="sub">${body}</p><div class="acts"><button class="btn quiet" data-no>Keep it</button><button class="btn ${danger ? "danger" : ""}" data-yes>${esc(action)}</button></div>`, (el) => {
        $("[data-no]", el).onclick = () => { closeSheet(); res(false); };
        $("[data-yes]", el).onclick = () => { closeSheet(); res(true); };
      });
    });
  }

  function toast(msg, opts = {}) {
    const box = $(".toasts");
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `${opts.from ? `<span class="ava" aria-hidden="true">${esc(opts.from[0])}</span>` : ""}<span>${msg}</span>${opts.action ? `<button>${esc(opts.action)}</button>` : ""}`;
    box.appendChild(t);
    if (opts.action) $("button", t).onclick = () => { opts.onAction && opts.onAction(); t.remove(); };
    setTimeout(() => t.remove(), opts.ms || 6000);
  }

  /* Saving is immediate (A6). In demo mode nothing saves. */
  function saved(msg, undo) {
    if (DEMO) { toast("Not saved: demonstration mode"); return false; }
    toast(msg, undo ? { action: "Undo", onAction: undo } : {});
    return true;
  }

  /* ---------- record a payment (from any screen) ---------- */
  function recordPayment(bookingId, partId) {
    const b = data.bookings.find((x) => x.id === bookingId); if (!b) return;
    const ps = partsOf(b);
    const p = partId ? b.parts.find((x) => x.id === partId) : ps[0];
    const left = p.price - (p.paid || 0);
    const title = b.parts ? `${b.name}, ${p.name.toLowerCase()}` : b.name;
    openSheet(`<h2>Record a payment</h2><p class="sub">${esc(title)}</p>
      <label class="sr" for="pay-amt">Amount paid</label>
      <input class="big-input num" id="pay-amt" inputmode="numeric" value="${rp(left)}" autofocus>
      <p class="sub" id="pay-after">Pays this in full</p>
      <div class="fields">
        <div class="field"><label for="pay-on">Paid on</label><input id="pay-on" type="date" value="${D.TODAY}"></div>
        <div class="field"><span class="lab">Paid by</span><div class="chips" role="group" aria-label="Paid by">${data.funders.concat([{ id: null, name: "Not assigned" }]).map((f) => `<button type="button" class="chip" aria-pressed="${(p.funder ?? null) === f.id}" data-f="${f.id ?? ""}">${esc(f.name)}</button>`).join("")}</div></div>
        <div class="field"><span class="lab">Receipt</span><div><button type="button" class="link" data-later="1">Attach a receipt</button></div></div>
      </div>
      ${DEMO ? `<p class="sub">Demonstration mode: recording is turned off.</p>` : ""}
      <div class="acts"><button class="btn quiet" data-cancel>Cancel</button><button class="btn" data-ok ${DEMO ? "disabled" : ""}>Record payment</button></div>`, (el) => {
      const amt = $("#pay-amt", el), after = $("#pay-after", el);
      const val = () => parseInt(amt.value.replace(/\D/g, "") || "0", 10);
      amt.addEventListener("input", () => {
        const v = val(), rest = left - v;
        after.textContent = v === 0 ? "Enter the amount you paid" : rest === 0 ? "Pays this in full" : rest > 0 ? `${rp(rest)} still to pay after this` : `This is ${rp(-rest)} more than what's left. It will show as overpaid.`;
        after.style.color = rest < 0 ? "var(--rose-ink)" : "";
      });
      amt.addEventListener("blur", () => { amt.value = rp(val()); });
      $$(".chip", el).forEach((c) => c.onclick = () => $$(".chip", el).forEach((x) => x.setAttribute("aria-pressed", String(x === c))));
      $("[data-cancel]", el).onclick = closeSheet;
      $("[data-ok]", el).onclick = (e) => {
        const v = val(); if (!v) { amt.focus(); return; }
        const btn = e.currentTarget; btn.classList.add("busy"); btn.textContent = "Recording";
        setTimeout(() => {
          const before = p.paid || 0;
          p.paid = before + v; if (!b.parts) b.paid = p.paid;
          closeSheet(); rerender();
          saved(`Recorded ${rp(v)} for ${esc(b.name)}`, () => { p.paid = before; if (!b.parts) b.paid = before; rerender(); });
        }, 650);
      };
    });
  }

  /* ---------- live sync: the partner's change arrives ---------- */
  function liveSync() {
    const s = data.sync; if (!s) return;
    setTimeout(() => {
      const b = data.bookings.find((x) => x.id === s.booking); if (!b) return;
      const p = s.part ? b.parts.find((x) => x.id === s.part) : null;
      if (p) p.paid = (p.paid || 0) + s.amount; else b.paid = (b.paid || 0) + s.amount;
      rerender();
      $$(`[data-id="${s.booking}"]`).forEach((el) => { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); });
      toast(`${esc(s.by)} recorded ${rp(s.amount)} for ${esc(b.name)}`, { from: s.by, ms: 9000 });
    }, 1600);
  }

  function rerender() { const main = $("main"); if (cfg.render) cfg.render(main); }

  function init(c) {
    cfg = c;
    mount();
    const main = $("main");
    if (cfg.wide) main.classList.add("wide");
    if (stateView(main)) return;
    cfg.render(main);
    if (STATE === "sync") (cfg.sync || liveSync)();
    if (added && sessionStorage.getItem("veil-added-new")) { sessionStorage.removeItem("veil-added-new"); toast(`Added ${esc(added.name)}`); $$(`[data-id="${added.id}"]`).forEach((el) => el.classList.add("flash")); }
  }


  /* ---------- shared pieces for records with files, stages and phone numbers ---------- */
  const FILE_EXT = { pdf: "pdf", doc: "doc", sheet: "xls" };
  function filesGrid(files, uploading) {
    const fl = files.map((f) => `<li><a class="file" href="#" data-later="1"><div class="thumb">${f.type === "image" ? `<img src="${f.src}" alt="">` : `<span class="ext">${FILE_EXT[f.type] || "file"}</span>`}</div><div class="fn" dir="auto">${esc(f.name)}</div><div class="fs">${f.size}${f.fromVendor ? ", from the vendor" : ""}</div></a></li>`).join("");
    const up = uploading ? `<li><div class="file"><div class="thumb"><span class="ext">pdf</span></div><div class="fn">Signed contract scan.pdf</div><div class="fs">Shrinking from 14.2 MB to fit under 10 MB</div><div class="bar"><span style="width:35%"></span></div></div></li>
      <li><div class="file"><div class="thumb"><span class="ext">jpg</span></div><div class="fn">Transfer receipt.jpg</div><div class="fs">Uploading, 1.3 of 2.1 MB</div><div class="bar"><span style="width:62%"></span></div></div></li>
      <li><div class="file bad"><div class="thumb"><span class="ext">zip</span></div><div class="fn">All photos.zip</div><div class="fs">Too large: 48 MB. Files can be up to 10 MB.</div></div></li>
      <li><div class="file bad"><div class="thumb"><span class="ext">pdf</span></div><div class="fn">Invoice.pdf</div><div class="fs">Upload failed. <button class="link rose">Try again</button></div></div></li>` : "";
    return `<ul class="files">${fl}${up}<li><button class="file drop" data-later="1"><span><b>Add files</b>Quotes, contracts, photos. Up to 10 MB each; big PDFs are shrunk for you.</span></button></li></ul>`;
  }
  /* The stage as a short gold thread of steps; ruled out is drawn apart. */
  function stageThread(stage, stages, label) {
    if (stage === "out") return `<span class="stage out">Ruled out</span>`;
    const i = stages.findIndex(([k]) => k === stage);
    return `<span class="stage" title="${esc(stages[i][1])}"><span class="steps" aria-hidden="true">${stages.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</span>${label === false ? `<span class="sr">${esc(stages[i][1])}</span>` : esc(stages[i][1])}</span>`;
  }
  /* F7: WhatsApp in one step. Indonesian numbers starting with 0 become +62. */
  function waHref(phone) {
    let d = String(phone || "").replace(/[^\d+]/g, "");
    if (!d) return null;
    if (d.startsWith("+")) d = d.slice(1); else if (d.startsWith("0")) d = "62" + d.slice(1);
    return "https://wa.me/" + d;
  }
  function linkify(text) {
    return esc(text).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a class="link" href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\/(www\.)?/, "")}</a>`).replace(/\n/g, "<br>");
  }
  const compact = (n) => n == null ? "" : n >= 1e6 ? Math.round(n / 1e5) / 10 + "M" : n >= 1e4 ? Math.round(n / 100) / 10 + "k" : n.toLocaleString("en-GB");
  const SUBNAVS = {
    vendors: ["Vendors, shortlist and venues", [["vendors.html", "Vendors"], ["shortlist.html", "Shortlist"], ["venues.html", "Venues"]]],
    records: ["Documents and files", [["documents.html", "Documents"], ["files.html", "Files"]]],
    schedule: ["Agenda, month and tasks", [["schedule.html", "Agenda"], ["schedule.html?view=month", "Month"], ["tasks.html", "Tasks"]]],
  };
  const subnav = (here, set) => { const [label, items] = SUBNAVS[set || "vendors"]; return `<nav class="subnav" aria-label="${label}">${items.map(([h, t]) => `<a href="${href(h)}" ${h === here ? 'aria-current="page"' : ""}>${t}</a>`).join("")}</nav>`; };
  /* "Now" for relative times: 11:30 on the fixed today */
  const NOW = new Date(D.TODAY + "T11:30:00");
  const ago = (iso) => {
    const t = new Date(iso), m = Math.round((NOW - t) / 60000);
    if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
    if (t.toDateString() === NOW.toDateString()) return `${Math.round(m / 60)} ${Math.round(m / 60) === 1 ? "hour" : "hours"} ago`;
    const y = new Date(NOW); y.setDate(y.getDate() - 1);
    if (t.toDateString() === y.toDateString()) return "yesterday";
    return dateShort(iso.slice(0, 10));
  };
  const WA_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M2.5 13.5l.9-2.8A5.6 5.6 0 1 1 5.6 13z"/><path d="M6 5.5c0 2.5 2 4.5 4.5 4.5l.7-1.2-1.4-.7-.6.6c-.8-.3-1.5-1-1.8-1.8l.6-.6-.7-1.4z" fill="currentColor" stroke="none"/></svg>';
  const waLink = (phone, label) => { const h = waHref(phone); return h ? `<a class="wa" href="${h}" target="_blank" rel="noopener">${WA_ICON}${esc(label || "WhatsApp")}</a>` : ""; };
  const HEART = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17s-6.5-3.9-6.5-8.6A3.6 3.6 0 0 1 10 6a3.6 3.6 0 0 1 6.5 2.4C16.5 13.1 10 17 10 17z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  const count = (n) => n == null ? "" : n.toLocaleString("en-GB");

  window.Veil = { data, STATE, STRESS, DEMO, TODAY, esc, rp, fig, group, dateLong, dateShort, monthOf, daysFrom, relDue, urgency, plural, SOON,
    funderName, paidBy, andList, partsOf, totals, budget, dues, byFunder, wiParts, wiTotal, whatif, daysLeft, href, ICON, $, $$,
    filesGrid, stageThread, waHref, waLink, HEART, subnav, ago, linkify, compact, count, init, rerender, openSheet, closeSheet, confirm, toast, saved, recordPayment };
})();
