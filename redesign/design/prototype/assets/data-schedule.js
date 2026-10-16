/* Veil prototype: events and tasks (S1–S10). Payments due come from bookings (data.js). */
(function () {
  const { NORMAL, STRESS, EMPTY } = window.VEIL_DATA;
  const KINDS = [["vendor-call", "Vendor call"], ["organiser-call", "Organiser call"], ["appointment", "Appointment"], ["payment", "Payment"], ["deadline", "Deadline"], ["other", "Other"]];
  /* N11: reminders come once a day, in the morning. Events set up before keep their old value; "1440" and
     "10080" carry over as the morning before and a week before, and a time of day ("15", "60") can't arrive. */
  const REMIND = [["", "No reminder"], ["1d", "The morning before"], ["7d", "A week before, in the morning"]];
  const ev = (id, title, kind, date, start, end, extra) => Object.assign({ id, title, kind, date, start, end, allDay: !start, related: null, where: "", notes: "", remind: "", status: "scheduled" }, extra || {});
  const events = [
    ev("e1", "Call with Laras about the arch", "vendor-call", "2026-10-14", "15:00", "15:30", { related: "kebun", where: "https://meet.google.com/kbn-arch-call", remind: "15" }),
    ev("e2", "Tasting at Sendok Emas", "appointment", "2026-10-16", "11:00", "12:30", { related: "sendok", where: "Jl. Raya Kerobokan 88, Kerobokan", remind: "1440", notes: "Bring both mums. Ask about the vegetarian table." }),
    ev("e3", "Organiser check-in", "organiser-call", "2026-10-20", "19:00", null, { where: "WhatsApp video", remind: "60" }),
    ev("e4", "Hold on our date ends: Kebun Bunga", "deadline", "2026-10-31", null, null, { related: "kebun", remind: "10080" }),
    ev("e5", "Second fitting", "appointment", "2026-10-30", "14:00", "15:30", { related: "ayu", where: "Maison Ayu Bridal, Seminyak", remind: "1440" }),
    ev("e6", "Marriage course, first session", "other", "2026-11-07", "09:00", "12:00", { where: "Paroki St. Fransiskus Xaverius, Kuta" }),
    ev("e7", "Pre-wedding shoot", "appointment", "2026-11-28", null, null, { related: "rana", where: "Bedugul" }),
    ev("e8", "Venue walkthrough", "appointment", "2026-10-10", "10:00", "11:00", { status: "completed", related: "samaya" }),
    ev("e9", "Call Rasa Nusantara back", "vendor-call", "2026-10-08", "16:00", null, { status: "cancelled", related: "nusantara" }),
    ev("e10", "Send the invitation proof back", "deadline", "2026-10-13", null, null, { related: "peony" }),
    ev("e11", "Cake tasting", "appointment", "2026-10-15", "16:30", null, { related: "manis", where: "Manis Cake Studio, Denpasar" }),
  ];
  const step = (id, title, due, done) => ({ id, title, due, done: !!done });
  const tasks = [
    { id: "t1", title: "Finalise the guest list", due: "2026-10-25", notes: "Venue holds 450; aim for 400.", done: false,
      steps: [step("s1", "Greg's side", "2026-10-15", true), step("s2", "Bella's side", "2026-10-20"), step("s3", "Trim to 400", "2026-10-24"), step("s4", "Send to the caterer", null)] },
    { id: "t2", title: "Choose the caterer", due: "2026-10-18", notes: "", done: false,
      steps: [step("s1", "Tasting at Sendok Emas", "2026-10-16"), step("s2", "Compare the two menus", "2026-10-17"), step("s3", "Tell both families", null)] },
    { id: "t3", title: "Book the honeymoon flights", due: "2026-11-15", notes: "Japan or Lombok; see the research document.", done: false, steps: [step("s1", "Pick dates", null, true), step("s2", "Compare airlines", null)] },
    { id: "t4", title: "Order the sangjit trays", due: "2026-10-12", notes: "", done: false, steps: [] },
    { id: "t5", title: "Write our vows", due: null, notes: "", done: false, steps: [] },
    { id: "t6", title: "Send save-the-dates", due: "2026-09-30", notes: "", done: true, doneOn: "2026-09-29", steps: [step("s1", "Design", null, true), step("s2", "Print", null, true), step("s3", "Post", null, true)] },
    /* N8: finished before the planner kept the day it was done */
    { id: "t7", title: "Book the church", due: null, notes: "Paroki St. Fransiskus Xaverius, Kuta.", done: true, doneOn: null, steps: [] },
  ];
  /* S10: notification permission on this device: "default" (not asked), "granted", "denied" */
  Object.assign(NORMAL, { KINDS, REMIND, events, tasks, notif: "granted" });
  Object.assign(EMPTY, { KINDS, REMIND, events: [], tasks: [], notif: "default" });

  const longT = "Confirm with the parish office, the civil registry and both families the final order of the holy matrimony, the sangjit and the reception, including who reads, who carries the rings and where the elders sit";
  const sev = [ev("x1", longT, "appointment", "2026-10-14", "08:00", "17:00", { where: "https://meet.google.com/" + "x".repeat(120), notes: longT.repeat(3) }),
    ev("x2", "婚礼彩排", "appointment", "2026-10-14", "10:00", null), ev("x3", "مكالمة مع المصور", "vendor-call", "2026-10-14", "11:00", null), ev("x4", "X", "other", "2026-10-14", null, null)];
  for (let i = 0; i < 1200; i++) { const dd = new Date(2026, 7, 1 + Math.floor(i / 5)); sev.push(ev("g" + i, `Event ${i + 1}`, KINDS[i % 6][0], dd.toISOString().slice(0, 10), i % 3 ? String(8 + (i % 10)).padStart(2, "0") + ":00" : null, null, { status: i % 17 === 0 ? "cancelled" : i % 11 === 0 ? "completed" : "scheduled" })); }
  const stasks = [{ id: "xt", title: longT, due: "2026-10-01", notes: longT, done: false, steps: Array.from({ length: 60 }, (_, i) => step("s" + i, i === 3 ? "LangkahDenganNamaYangSangatPanjangTanpaSpasiSamaSekali" : "Step " + (i + 1), i % 4 ? null : "2026-10-" + String(1 + (i % 28)).padStart(2, "0"), i < 23)) }];
  for (let i = 0; i < 400; i++) stasks.push({ id: "gt" + i, title: `Task ${i + 1}`, due: i % 5 ? new Date(2026, 9, 1 + (i % 120)).toISOString().slice(0, 10) : null, notes: "", done: i % 7 === 0, steps: [] });
  Object.assign(STRESS, { KINDS, REMIND, events: sev, tasks: stasks, notif: "denied" });
})();
