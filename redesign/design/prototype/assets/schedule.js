/* Veil prototype: the combined agenda (S3), event sheet (S1, S2, S10) and links to where things live (S7). */
(function () {
  const V = window.Veil, d = V.data, TODAY = "2026-10-14";
  const kindName = (k) => (d.KINDS.find(([x]) => x === k) || [k, "Other"])[1];

  /* S7: where an item's vendor, venue or booking lives */
  function related(id) {
    if (!id) return null;
    const v = (d.vendors || []).find((x) => x.id === id); if (v) return { name: v.name, href: V.href("vendor.html", { id }) };
    const vn = (d.venues || []).find((x) => x.id === id); if (vn) return { name: vn.name, href: V.href("venues.html") };
    const b = d.bookings.find((x) => x.id === id); if (b) return { name: b.name, href: V.href("booking.html", { id }) };
    return null;
  }

  function items() {
    const out = [];
    d.events.forEach((e) => out.push({ type: "event", id: e.id, kind: e.kind, date: e.date, start: e.start, end: e.end, title: e.title, sub: e.where, notes: e.notes, rel: related(e.related), status: e.status, late: e.status === "scheduled" && e.date < TODAY, remBad: V.remindBad(e) }));
    V.dues().forEach((x) => out.push({ type: "payment", id: x.b.id + ":" + (x.p.id || ""), kind: "payment", date: x.due, title: x.b.parts ? `${x.b.name}, ${x.p.name.toLowerCase()}` : x.b.name, sub: `${V.rp(x.left)}, ${V.paidBy(x.funder)}`, rel: { name: "Open the booking", href: V.href("booking.html", { id: x.b.id }) }, status: "scheduled", late: x.due < TODAY, b: x.b.id, p: x.p.id }));
    (d.tasks || []).filter((t) => t.due && !t.done).forEach((t) => { const n = t.steps.length, k = t.steps.filter((s) => s.done).length;
      out.push({ type: "task", id: t.id, kind: "task", date: t.due, title: t.title, sub: n ? `${k} of ${V.plural(n, "step")} done` : "", rel: { name: "Open the task", href: V.href("tasks.html", { open: t.id }) }, status: "scheduled", late: t.due < TODAY }); });
    return out.sort((a, z) => a.date.localeCompare(z.date) || (a.start ? 1 : 0) - (z.start ? 1 : 0) || (a.start || "").localeCompare(z.start || ""));
  }

  const dayTitle = (iso) => { const n = V.daysFrom(iso); return n === 0 ? `Today, ${V.dateLong(iso)}` : n === 1 ? `Tomorrow, ${V.dateLong(iso)}` : V.dateLong(iso); };

  function row(it) {
    const when = it.late && it.status === "scheduled" ? `<b>${V.dateShort(it.date)}</b>` : it.type === "payment" ? "<b>Due</b>" : it.type === "task" ? "<b>Due</b>" : it.start ? `<b>${it.start}</b>${it.end ? `<small>${it.end}</small>` : ""}` : "<b>All day</b>";
    const label = it.type === "payment" ? "Payment" : it.type === "task" ? "Task" : kindName(it.kind);
    const isLink = /^https?:/.test(it.sub || "");
    return `<li class="ag ${it.type} ${it.status} ${it.late && it.status === "scheduled" ? "is-late" : ""}" data-ev="${it.id}">
      <span class="when">${when}</span>
      <div class="body"><span class="kind">${label}${it.status === "completed" ? ", completed" : it.status === "cancelled" ? ", cancelled" : ""}</span>
        ${it.type === "event" ? `<button class="what" data-open="${it.id}" dir="auto">${V.esc(it.title)}</button>` : `<a class="what" href="${it.rel.href}" dir="auto">${V.esc(it.title)}</a>`}
        ${it.sub ? `<span class="sub" dir="auto">${isLink ? `<a class="link" href="${V.esc(it.sub)}" target="_blank" rel="noopener">Join the call</a>` : V.esc(it.sub)}</span>` : ""}
        ${it.type === "event" && it.rel ? `<a class="rel" href="${it.rel.href}" dir="auto">${V.esc(it.rel.name)}</a>` : ""}
        ${it.remBad && !it.late ? `<span class="rem-bad">Its reminder can't arrive. Choose another</span>` : ""}</div>
      ${it.late && it.status === "scheduled" ? `<span class="flag">${V.plural(-V.daysFrom(it.date), "day")} late</span>` : it.type === "payment" ? `<button class="btn small ${it.late ? "" : "quiet"}" data-pay="${it.b}" data-part="${it.p || ""}">Record payment</button>` : ""}
    </li>`;
  }

  function wireRows(box) {
    V.$$("[data-open]", box).forEach((b) => b.onclick = () => eventSheet(d.events.find((e) => e.id === b.dataset.open)));
    V.$$("[data-pay]", box).forEach((b) => b.onclick = () => V.recordPayment(b.dataset.pay, b.dataset.part || null));
  }

  /* S10, N6: what this device allows, worded the same as in settings */
  const notifNote = () => V.notifNote("sheet");

  /* N11: only reminders that can arrive. A day or a week ahead, in the morning; a morning that has already
     gone is shown greyed with the reason. A reminder chosen before for a time of day is named, not hidden. */
  function remindField(ev) {
    const key = V.remindKey(ev.remind || ""), old = V.OLD_REMIND[ev.remind];
    const ok = [["1d", "the morning before"], ["7d", "a week before"]].filter(([k]) => !V.remindPast(k, ev.date)).map(([, l]) => l);
    const opts = V.REMINDERS.map(([k, l]) => { const past = V.remindPast(k, ev.date); return `<option value="${k}" ${!old && k === key && !past ? "selected" : ""} ${past ? "disabled" : ""}>${l}${past ? " (that morning has gone)" : ""}</option>`; }).join("");
    return `<div class="field ${old ? "failed" : ""}" id="rmf"><label for="rm">Remind us</label><select id="rm">${old ? `<option value="" selected disabled>Choose again</option>` : ""}${opts}</select>
      ${old ? `<p class="need" id="rm-old">You chose “${old.toLowerCase()}” when you set this up. That can't arrive: reminders come once a day, in the morning. ${ok.length ? `Choose ${ok.join(", ")} or no reminder.` : "Its mornings have gone, so choose no reminder."}</p>` : `<p class="hint">Reminders come once a day, in the morning.</p>`}${notifNote()}</div>`;
  }

  /* N9: a dated thing needs a title and a date, and can't end before it starts. Say what to fix, keep what was typed. */
  const NEED = {
    title: (old) => old ? `It needs a title. The schedule keeps “${V.esc(old)}” until you give it one.` : "Give it a title so you can find it in the schedule.",
    date: (old) => old ? `It needs a date. The schedule keeps it on ${V.dateLong(old)} until you choose one.` : "Choose the day it happens.",
    end: () => "It ends before it starts. Change the end time, or leave it empty.",
  };
  function problems(el) {
    const out = [];
    if (!V.$("#et", el).value.trim()) out.push(["title", "#et"]);
    if (!V.$("#ed", el).value) out.push(["date", "#ed"]);
    const es = V.$("#es", el).value, ee = V.$("#ee", el).value;
    if (!V.$("#ea", el).checked && es && ee && ee < es) out.push(["end", "#ee"]);
    return out;
  }
  function showProblems(el, list, e) {
    V.$$(".need[data-need]", el).forEach((x) => x.remove());
    V.$$(".field[data-v]", el).forEach((f) => { f.classList.remove("failed"); f.removeAttribute("data-v"); });
    V.$$("[aria-invalid]", el).forEach((x) => x.removeAttribute("aria-invalid"));
    list.forEach(([k, sel]) => {
      const inp = V.$(sel, el), f = inp.closest(".field"); f.classList.add("failed"); f.setAttribute("data-v", "1"); inp.setAttribute("aria-invalid", "true");
      f.insertAdjacentHTML("beforeend", `<p class="need" data-need="${k}" role="alert">${NEED[k](e && (k === "title" ? e.title : k === "date" ? e.date : null))}</p>`);
    });
  }

  function eventSheet(e, onDate, opts) {
    const isNew = !e;
    const ev = e || { title: "", kind: "appointment", date: onDate || TODAY, start: "10:00", end: "", allDay: false, related: "", where: "", notes: "", remind: "1d", status: "scheduled" };
    const pre = (opts && opts.typed) || {};
    const rels = [["", "Nothing"]].concat((d.vendors || []).filter((v) => v.stage !== "out").map((v) => [v.id, v.name]), (d.venues || []).filter((v) => v.stage !== "out").map((v) => [v.id, v.name + ", venue"]));
    const val = (k) => pre[k] != null ? pre[k] : ev[k];
    V.openSheet(`<h2 dir="auto">${isNew ? "Add to the schedule" : V.esc(ev.title)}</h2>
      ${isNew ? "" : `<p class="sub">${ev.status === "scheduled" ? (ev.date < TODAY ? `<span style="color:var(--rose-ink)">Was on ${V.dateLong(ev.date)}</span>` : V.dateLong(ev.date)) : ev.status === "completed" ? "Completed" : "Cancelled"}</p>`}
      <div class="chips" role="radiogroup" aria-label="Kind" style="justify-content:center;margin-top:16px">${d.KINDS.map(([k, l]) => `<button type="button" class="chip" role="radio" data-k="${k}" aria-checked="${ev.kind === k}" aria-pressed="${ev.kind === k}">${l}</button>`).join("")}</div>
      <div class="fields">
        <div class="field"><label for="et">Title</label><input id="et" dir="auto" ${isNew ? "autofocus" : ""} value="${V.esc(val("title"))}" placeholder="For example, Tasting at Sendok Emas"></div>
        <div class="field"><label for="ed">Date</label><input id="ed" type="date" value="${val("date") || ""}"></div>
        <div class="field"><span class="lab">Time</span><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label class="check"><input type="checkbox" id="ea" ${ev.allDay ? "checked" : ""}>All day</label>
          <span id="times" style="display:${ev.allDay ? "none" : "flex"};gap:8px;align-items:center"><label class="sr" for="es">Starts</label><input id="es" type="time" value="${val("start") || ""}" style="width:auto"><span>to</span><label class="sr" for="ee">Ends, optional</label><input id="ee" type="time" value="${val("end") || ""}" style="width:auto"></span></div></div>
        <div class="field"><label for="er">With</label><select id="er">${rels.map(([k, l]) => `<option value="${k}" ${k === (ev.related || "") ? "selected" : ""}>${V.esc(l)}</option>`).join("")}</select></div>
        <div class="field"><label for="ew">Where, or a call link</label><input id="ew" dir="auto" value="${V.esc(ev.where)}" placeholder="An address or https://…"></div>
        <div class="field"><label for="en">Notes</label><textarea id="en" dir="auto">${V.esc(ev.notes)}</textarea></div>
        ${remindField(ev)}
      </div>
      ${isNew ? V.demoLine() : V.sheetSaveLine()}
      <div class="acts">${isNew ? `<button class="btn quiet" data-x>Cancel</button><button class="btn" data-ok ${V.DEMO ? "disabled" : ""}>Add to the schedule</button>`
        : `${ev.status === "scheduled" ? `<button class="btn quiet" data-st="completed">Mark completed</button><button class="btn quiet" data-st="cancelled">Cancel it</button>` : `<button class="btn quiet" data-st="scheduled">Back to scheduled</button>`}<button class="btn" data-done>Done</button>`}</div>
      ${isNew ? "" : `<p style="text-align:center;margin-top:16px"><button class="link rose" data-del>Delete</button></p>`}`, (el) => {
      const save = isNew ? null : V.sheetSaver(el);
      const line = V.$(".sheet-save", el);
      /* S2 in a sheet: an existing event saves as you go (owner, stage 3). N9: a change that leaves it without a
         title or a date, or ending before it starts, isn't saved; the field says why and keeps what was typed. */
      const keep = () => {
        if (!save) return;
        const bad = problems(el); showProblems(el, bad, e);
        const v = collect();
        if (bad.some(([k]) => k === "title")) v.title = e.title;
        if (bad.some(([k]) => k === "date")) v.date = e.date;
        if (bad.some(([k]) => k === "end")) v.end = e.end;
        save(() => Object.assign(e, v));
        const say = () => { if (!line || V.DEMO) return; if (bad.length) { line.classList.add("failed"); line.textContent = `${bad.length === 1 ? "1 change" : bad.length + " changes"} not saved yet: ${bad.map(([k]) => k === "end" ? "the end time" : "the " + k).join(" and ")}`; } else line.classList.remove("failed"); };
        say(); if (bad.length) setTimeout(say, 480);
      };
      V.$$("[data-k]", el).forEach((c) => c.onclick = () => { V.$$("[data-k]", el).forEach((x) => { x.setAttribute("aria-pressed", String(x === c)); x.setAttribute("aria-checked", String(x === c)); }); keep(); });
      if (save) V.$$("input, select, textarea", el).forEach((x) => x.addEventListener("change", keep));
      /* N18 with N9: Escape or a tap outside, while a change can't be saved yet, keeps the sheet open and says so,
         with "close without it" (the schedule keeps what it had). */
      if (!isNew) el._extraHold = () => {
        const bad = problems(el); if (!bad.length) return true;
        showProblems(el, bad, e);
        if (line) { line.classList.add("failed"); line.innerHTML = `${bad.length === 1 ? "1 change" : bad.length + " changes"} not saved yet. Fix it, or <button type="button" class="link" data-lose>close without it</button>`; V.$("[data-lose]", line).onclick = () => { V.closeSheet({ force: true }); V.toast("Closed without that change. The schedule keeps what it had."); }; }
        V.$(bad[0][1], el).focus(); return false;
      };
      /* Done waits while something can't be saved: it points at the field instead of closing. */
      const dn = V.$("[data-done]", el); if (dn) dn.onclick = () => V.closeSheet();
      V.$("#ea", el).onchange = (x) => V.$("#times", el).style.display = x.target.checked ? "none" : "flex";
      V.$("#ed", el).addEventListener("change", () => { const f = V.$("#rmf", el), cur = V.$("#rm", el).value; ev.date = V.$("#ed", el).value || ev.date; const nf = document.createElement("div"); nf.innerHTML = remindField(Object.assign({}, ev, { remind: cur || ev.remind })); f.replaceWith(nf.firstElementChild); if (save) V.$("#rm", el).addEventListener("change", keep); V.$("#rm", el).addEventListener("change", clearOld); });
      const clearOld = () => { const o = V.$("#rm-old", el); if (o && V.$("#rm", el).value !== "" ) { o.outerHTML = `<p class="hint">Reminders come once a day, in the morning.</p>`; V.$("#rmf", el).classList.remove("failed"); } };
      V.$("#rm", el).addEventListener("change", clearOld);
      const al = V.$("#allow", el); if (al) al.onclick = () => { d.notif = "granted"; al.closest(".hint").outerHTML = notifNote(); V.toast("Notifications allowed on this device"); };
      const x = V.$("[data-x]", el); if (x) x.onclick = V.closeSheet;
      const collect = () => ({ title: V.$("#et", el).value.trim(), kind: V.$("[data-k][aria-pressed=true]", el).dataset.k, date: V.$("#ed", el).value, allDay: V.$("#ea", el).checked,
        start: V.$("#ea", el).checked ? null : V.$("#es", el).value || null, end: V.$("#ea", el).checked ? null : V.$("#ee", el).value || null, related: V.$("#er", el).value || null, where: V.$("#ew", el).value.trim(), notes: V.$("#en", el).value, remind: V.$("#rm", el).value || (V.OLD_REMIND[ev.remind] ? ev.remind : "") });
      const ok = V.$("[data-ok]", el);
      if (ok) ok.onclick = () => {
        const bad = problems(el); showProblems(el, bad, null);
        if (bad.length) { V.$(bad[0][1], el).focus(); return; }
        const v = collect();
        const n = Object.assign({ id: "e" + Date.now(), status: "scheduled" }, v); d.events.push(n); V.closeSheet(); V.rerender(); V.saved(`Added ${V.esc(n.title)}`, () => { d.events.splice(d.events.indexOf(n), 1); V.rerender(); });
      };
      if (opts && opts.check) { const bad = problems(el); showProblems(el, bad, e); if (!isNew && bad.length && line) { line.classList.add("failed"); line.textContent = `1 change not saved yet: the end time`; } }
      V.$$("[data-st]", el).forEach((b) => b.onclick = () => { const old = e.status; e.status = b.dataset.st; V.closeSheet({ force: true }); V.rerender(); V.saved(b.dataset.st === "completed" ? "Marked completed" : b.dataset.st === "cancelled" ? "Cancelled" : "Back to scheduled", () => { e.status = old; V.rerender(); }); });
      const del = V.$("[data-del]", el);
      if (del) del.onclick = async () => {
        if (!await V.confirm({ title: `Delete ${e.title}?`, body: "It comes off the schedule for both of you. You can undo for a few seconds.", action: "Delete", danger: true })) return;
        const i = d.events.indexOf(e); d.events.splice(i, 1); V.rerender(); V.saved(`Deleted ${V.esc(e.title)}`, () => { d.events.splice(i, 0, e); V.rerender(); });
      };
    });
  }

  window.Agenda = { items, dayTitle, row, wireRows, eventSheet, related };
})();
