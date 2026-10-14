/* Veil prototype: the wedding items tracker (T1–T10). Loads after data.js. */
(function () {
  const { NORMAL, STRESS, EMPTY } = window.VEIL_DATA;
  const EVENTS = [["reception", "Reception"], ["matrimony", "Holy matrimony"], ["sangjit", "Sangjit"], ["prewed", "Pre-wedding"]];
  const PEOPLE = [["general", "General"], ["groom", "Groom"], ["bride", "Bride"], ["g-father", "Groom's father"], ["g-mother", "Groom's mother"], ["g-brother", "Groom's brother"], ["g-sister", "Groom's sister"], ["b-father", "Bride's father"], ["b-mother", "Bride's mother"], ["b-brothers", "Bride's brothers"]];
  let n = 0;
  const it = (name, vendor, events, person, confirmed, next) => ({ id: "i" + (++n), name, vendor, events, person, confirmed: !!confirmed, next: !!next });
  const items = [
    it("Reception venue", "Villa Samaya Ubud", ["reception"], "general", 1),
    it("Church", "Paroki St. Fransiskus Xaverius", ["matrimony"], "general", 1),
    it("Catering", "Dapur Lestari Catering", ["reception"], "general", 1),
    it("Photo and video", "Studio Rana", ["reception", "matrimony", "prewed"], "general", 1),
    it("Decoration", "Lumière Décor", ["reception", "matrimony"], "general", 1),
    it("Flowers for the arch", null, ["matrimony"], "general", 0, 1),
    it("Wedding cake", "Manis Cake Studio", ["reception"], "general", 0, 1),
    it("Bride's gown", "Maison Ayu Bridal", ["matrimony", "reception"], "bride", 1),
    it("Bride's sangjit kebaya", null, ["sangjit"], "bride", 0, 1),
    it("Groom's suit", "Batik Larasati", ["matrimony", "reception"], "groom", 0),
    it("Bride's makeup", "Kirana Makeup", ["matrimony", "reception"], "bride", 1),
    it("Bride's mother's makeup", "Kirana Makeup", ["reception"], "b-mother", 1),
    it("Groom's mother's makeup", null, ["reception"], "g-mother", 0, 1),
    it("Groom's mother's kebaya", null, ["sangjit", "reception"], "g-mother", 0),
    it("Bride's father's suit", null, ["reception"], "b-father", 0),
    it("String quartet", "Harmoni String Quartet", ["matrimony"], "general", 1),
    it("After-party band", "Svara Band", ["reception"], "general", 0),
    it("Invitations", "Paper & Peony", ["reception", "matrimony"], "general", 1, 1),
    it("Sangjit trays", "Seserahan Cantik", ["sangjit"], "general", 0, 1),
    it("Rings", "Rumah Cincin", ["matrimony"], "general", 1),
    it("Wedding cars", "Sakura Transport", ["matrimony", "reception"], "general", 1),
    it("Pre-wedding outfits", null, ["prewed"], "general", 0),
    it("Groom's brother's shirt", null, ["reception"], "g-brother", 0),
    it("Bride's brothers' shirts", null, ["reception"], "b-brothers", 0),
    it("Souvenirs", null, ["reception"], "general", 0),
  ];
  /* T10: what a first-time tracker starts with */
  const starter = ["Reception venue", "Church", "Catering", "Photo and video", "Decoration", "Wedding cake", "Bride's gown", "Groom's suit", "Bride's makeup", "Invitations", "Sangjit trays", "Rings", "Wedding cars", "Souvenirs"]
    .map((name, i) => ({ id: "st" + i, name, vendor: null, events: [], person: name.startsWith("Bride") ? "bride" : name.startsWith("Groom") ? "groom" : "general", confirmed: false, next: false }));

  Object.assign(NORMAL, { EVENTS, PEOPLE, items, starter });
  Object.assign(EMPTY, { EVENTS, PEOPLE, items: [], starter });

  const sitems = [
    { id: "x1", name: "BungaUntukLengkunganPemberkatanDanMejaPenerimaTamuDiPintuMasukUtamaGereja", vendor: "PTDekorasiDanPerlengkapanPernikahanMewahNusantaraJayaAbadiSentosaIndonesia", events: EVENTS.map((e) => e[0]), person: "b-brothers", confirmed: true, next: true },
    { id: "x2", name: "新娘的头纱", vendor: "婚礼摄影工作室", events: ["sangjit"], person: "bride", confirmed: false, next: false },
    { id: "x3", name: "كعكة الزفاف", vendor: null, events: [], person: "general", confirmed: false, next: false },
    { id: "x4", name: "X", vendor: null, events: [], person: "general", confirmed: false, next: false },
  ];
  for (let i = 0; i < 2000; i++) sitems.push({ id: "g" + i, name: `Item ${i + 1}`, vendor: i % 3 ? `Vendor ${i % 97}` : null, events: EVENTS.filter((_, k) => (i >> k) & 1).map((e) => e[0]), person: PEOPLE[i % PEOPLE.length][0], confirmed: i % 4 === 0, next: i % 23 === 0 });
  Object.assign(STRESS, { EVENTS, PEOPLE, items: sitems, starter });
})();
