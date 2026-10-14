/* Veil prototype: mock data. Two sets: NORMAL (realistic) and STRESS (?stress).
   "Today" is fixed so dates and urgency stay stable in screenshots. */
(function () {
  const M = 1000000;

  /* Small images for file thumbnails, inline so nothing is fetched. */
  const img = (w, h, a, b) =>
    "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
      `<rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);

  const NORMAL = {
    couple: ["Greg", "Bella"],
    me: { name: "Greg", email: "greg@example.com" },
    partner: "Bella",
    wedding: "2027-03-20",
    funders: [
      { id: "greg", name: "Greg" },
      { id: "bella", name: "Bella" },
      { id: "gfam", name: "Greg's family" },
      { id: "bfam", name: "Bella's family" },
    ],
    categories: ["Venue", "Catering", "Photo and video", "Bride's attire", "Groom's attire", "Decoration", "Music", "Makeup", "Invitations", "Rings", "Transport", "Other"],
    bookings: [
      { id: "samaya", name: "Villa Samaya Ubud", category: "Venue", origin: { from: "venue", on: "2026-07-02" }, estimate: 380 * M,
        files: [
          { name: "Villa Samaya contract.pdf", size: "2.4 MB", type: "pdf" },
          { name: "Deposit receipt.jpg", size: "640 KB", type: "image", src: img(300, 200, "#f4ead7", "#fce6ec") },
          { name: "Second instalment receipt.jpg", size: "702 KB", type: "image", src: img(300, 200, "#fde8ee", "#efe2c9") },
        ],
        parts: [
          { id: "p1", name: "Deposit", price: 120 * M, paid: 120 * M, funder: "bfam", due: null, step: "" },
          { id: "p2", name: "Second instalment", price: 120 * M, paid: 120 * M, funder: "bfam", due: null, step: "" },
          { id: "p3", name: "Final payment", price: 110 * M, paid: 0, funder: "bfam", due: "2027-01-15", step: "Final payment" },
        ] },
      { id: "lestari", name: "Dapur Lestari Catering", category: "Catering", origin: { from: "vendor", on: "2026-08-11" }, estimate: 150 * M,
        files: [{ name: "Catering quote, 400 guests.pdf", size: "1.1 MB", type: "pdf" }],
        parts: [
          { id: "p1", name: "Deposit", price: 50 * M, paid: 50 * M, funder: "gfam", due: null, step: "" },
          { id: "p2", name: "Second instalment", price: 55.5 * M, paid: 0, funder: "gfam", due: "2026-10-18", step: "Second instalment" },
          { id: "p3", name: "Final payment", price: 55.5 * M, paid: 0, funder: "gfam", due: "2027-02-20", step: "Final payment and confirm the headcount" },
        ] },
      { id: "rana", name: "Studio Rana", category: "Photo and video", origin: { from: "vendor", on: "2026-06-20" }, estimate: 90 * M,
        files: [{ name: "Studio Rana package B.pdf", size: "3.8 MB", type: "pdf" }],
        parts: [
          { id: "p1", name: "Booking fee", price: 34 * M, paid: 34 * M, funder: "greg", due: null, step: "" },
          { id: "p2", name: "Final payment", price: 34 * M, paid: 0, funder: "greg", due: "2026-10-09", step: "Final payment" },
          { id: "p3", name: "Pre-wedding shoot", price: 15 * M, paid: 0, funder: "greg", due: "2026-11-20", step: "Pay the add-on and pick a shoot date" },
        ] },
      { id: "ayu", name: "Maison Ayu Bridal", category: "Bride's attire", origin: { from: "vendor", on: "2026-07-28" }, estimate: 65 * M,
        price: 72 * M, paid: 36 * M, funder: "bella", due: "2026-10-30", step: "Pay the balance at the second fitting", files: [] },
      { id: "lumiere", name: "Lumière Décor", category: "Decoration", origin: { from: "vendor", on: "2026-09-02" }, estimate: 110 * M,
        files: [{ name: "Moodboard.png", size: "4.2 MB", type: "image", src: img(300, 200, "#fce6ec", "#ffffff") }],
        parts: [
          { id: "p1", name: "Deposit", price: 30 * M, paid: 30 * M, funder: "bfam", due: null, step: "" },
          { id: "p2", name: "Balance", price: 68 * M, paid: 0, funder: "bfam", due: "2027-03-01", step: "Pay the balance and confirm the flower list" },
        ] },
      { id: "harmoni", name: "Harmoni String Quartet", category: "Music", origin: { from: "direct", on: "2026-09-15" }, estimate: null,
        price: 28 * M, paid: 10 * M, funder: "gfam", due: "2026-12-10", step: "Send the song list and pay the balance", files: [] },
      { id: "kirana", name: "Kirana Makeup", category: "Makeup", origin: { from: "vendor", on: "2026-08-30" }, estimate: 16 * M,
        price: 18.5 * M, paid: 20 * M, funder: "bella", due: null, step: "", files: [] },
      { id: "peony", name: "Paper & Peony", category: "Invitations", origin: { from: "direct", on: "2026-09-21" }, estimate: null,
        price: 14.3 * M, paid: 7.15 * M, funder: null, due: "2026-10-21", step: "Approve the proof and pay the balance", files: [] },
      { id: "cincin", name: "Rumah Cincin", category: "Rings", origin: { from: "direct", on: "2026-05-10" }, estimate: null,
        price: 46 * M, paid: 46 * M, funder: "greg", due: null, step: "", files: [{ name: "Ring receipt.pdf", size: "220 KB", type: "pdf" }] },
      { id: "sakura", name: "Sakura Transport", category: "Transport", origin: { from: "vendor", on: "2026-10-01" }, estimate: 10 * M,
        price: 12 * M, paid: 0, funder: null, due: "2027-03-10", step: "Confirm the cars and pay", files: [] },
    ],
    whatifs: [
      { id: "fireworks", name: "Fireworks at the reception", category: "Decoration", price: 25 * M, funder: "gfam" },
      { id: "band", name: "Live band for the after-party", category: "Music",
        parts: [
          { id: "p1", name: "Band", price: 22 * M, funder: "greg" },
          { id: "p2", name: "Sound and lighting", price: 8 * M, funder: null },
        ] },
    ],
    /* A change from the partner that arrives during ?state=sync */
    sync: { by: "Bella", booking: "lestari", part: "p2", amount: 55.5 * M },
  };

  /* ---------- STRESS ---------- */
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const day = (base, add) => { const d = new Date(base); d.setDate(d.getDate() + add); return d.toISOString().slice(0, 10); };

  const sFunders = [
    { id: "greg", name: "Gregorius" },
    { id: "bella", name: "Isabella" },
    { id: "gfam", name: "Greg's family" },
    { id: "bfam", name: "Bella's family" },
    { id: "wk", name: "Keluarga Besar Bapak Hendrikus Wijayakusumaningrat dan Ibu Maria Goretti Setyaningsih" },
    { id: "gm", name: "Bella'sGrandparentsOnHerMother'sSideWhoInsistedOnPayingForTheFlowers" },
    { id: "chen", name: "陈家 (Chen family)" },
    { id: "ar", name: "عائلة العروس" },
    { id: "th", name: "ครอบครัวเพื่อนสนิท" },
    { id: "lily", name: "Tante Lily" },
    { id: "budi", name: "Om Budi" },
    { id: "church", name: "Church committee" },
    { id: "office", name: "Papa's office" },
    { id: "friends", name: "Friends" },
    { id: "jp", name: "山田さん" },
  ];
  const ids = sFunders.map((f) => f.id).concat([null]);
  const cats = NORMAL.categories.concat(["Kategori_Dekorasi_Tambahan_Untuk_Tenda_Dan_Panggung_Utama"]);
  const vendorNames = ["Bunga Melati", "Sinar Abadi", "Kencana", "Gending Jawa", "Teras Kopi", "Mawar Putih", "Puri Ayu", "Langit Senja", "Rumah Kue", "Batik Larasati", "Cahaya", "Studio Kirana", "Garuda Sound", "Tirta", "Sekar Wangi"];

  const longest = "Transfer the second instalment to the account ending 4471 (BCA, PT Lumière Dekorasi Indonesia), send the receipt to Mbak Sari on WhatsApp, and confirm the final flower list, the arch size and the load-in time with the venue coordinator before Friday.";

  const stressBookings = [
    { id: "s-deep", name: "PemberkatanNikahDanResepsiDiGerejaKatedralSantaPerawanMariaDiangkatKeSurgaJakartaPusat", category: "Venue", origin: { from: "venue", on: "2026-03-01" }, estimate: 480 * M,
      files: [
        { name: "tiny.png", size: "1 KB", type: "image", src: img(2, 2, "#d9466f", "#c6a466") },
        { name: "panorama-of-the-whole-cathedral-nave-from-the-choir-loft.jpg", size: "9.9 MB", type: "image", src: img(6000, 400, "#f4ead7", "#d9466f") },
        { name: "tall-portrait.jpg", size: "8.7 MB", type: "image", src: img(300, 5000, "#fce6ec", "#33262c") },
        { name: "Kontrak_Final_Revisi_Ketiga_DITANDATANGANI_kedua_belah_pihak_2026.pdf", size: "10.0 MB", type: "pdf" },
        { name: "婚礼合同.docx", size: "88 KB", type: "doc" },
        { name: "budget.xlsx", size: "52 KB", type: "sheet" },
      ],
      parts: Array.from({ length: 40 }, (_, i) => ({ id: "p" + (i + 1), name: "Instalment " + (i + 1), price: 12.5 * M, paid: i < 18 ? 12.5 * M : i === 18 ? 4 * M : 0,
        funder: ids[i % ids.length], due: i < 18 ? null : day("2026-09-01", (i - 18) * 7), step: i === 19 ? longest : "Instalment " + (i + 1) })) },
    { id: "s-zh", name: "婚礼摄影工作室・东京与巴厘岛联合团队", category: "Photo and video", origin: { from: "vendor", on: "2026-04-11" }, estimate: 120 * M,
      price: 135 * M, paid: 40 * M, funder: "chen", due: "2026-10-12", step: "第二期付款", files: [] },
    { id: "s-ar", name: "استوديو التصوير الفوتوغرافي للأعراس", category: "Photo and video", origin: { from: "direct", on: "2026-05-02" }, estimate: null,
      price: 22 * M, paid: 0, funder: "ar", due: "2026-10-15", step: "الدفعة الأولى", files: [] },
    { id: "s-empty", name: "Tent", category: "", origin: { from: "direct", on: "2026-10-01" }, estimate: null,
      price: 0, paid: 0, funder: null, due: null, step: "", files: [] },
    { id: "s-huge", name: "Everything, everywhere", category: "Other", origin: { from: "direct", on: "2026-10-02" }, estimate: 9000000 * M,
      price: 9876543.21 * M, paid: 1234567.89 * M, funder: "wk", due: "2027-03-19", step: longest, files: [] },
    { id: "s-over", name: "Overpaid by a lot", category: "Makeup", origin: { from: "vendor", on: "2026-06-06" }, estimate: 10 * M,
      price: 12 * M, paid: 96 * M, funder: "gm", due: null, step: "", files: [] },
  ];
  for (let i = 0; i < 1200; i++) {
    const price = Math.round(rnd() * 90 + 2) * 500000;
    const paid = rnd() < 0.3 ? price : rnd() < 0.5 ? 0 : Math.round(price * rnd() / 500000) * 500000;
    const b = { id: "g" + i, name: pick(vendorNames) + " " + (i + 1), category: pick(cats), origin: { from: pick(["vendor", "venue", "direct"]), on: day("2026-01-01", Math.floor(rnd() * 280)) },
      estimate: rnd() < 0.5 ? null : price + Math.round((rnd() - 0.5) * 20) * 500000, files: [] };
    if (rnd() < 0.25) {
      const n = 2 + Math.floor(rnd() * 4);
      b.parts = Array.from({ length: n }, (_, k) => {
        const pp = Math.round(price / n);
        const pd = k === 0 ? pp : 0;
        return { id: "p" + (k + 1), name: k === 0 ? "Deposit" : k === n - 1 ? "Final payment" : "Instalment " + (k + 1), price: pp, paid: pd, funder: pick(ids), due: pd >= pp ? null : day("2026-08-15", Math.floor(rnd() * 220)), step: pd >= pp ? "" : "Instalment " + (k + 1) };
      });
    } else {
      Object.assign(b, { price, paid, funder: pick(ids), due: paid >= price ? null : day("2026-08-15", Math.floor(rnd() * 220)), step: paid >= price ? "" : pick(["Pay the balance", "Second instalment", "Final payment", "Confirm and pay"]) });
    }
    stressBookings.push(b);
  }
  const stressWhatifs = [
    { id: "w-deep", name: "SecondReceptionInSingaporeForTheRelativesWhoCannotTravelToBali", category: "Venue",
      parts: Array.from({ length: 25 }, (_, i) => ({ id: "p" + i, name: "Part " + (i + 1), price: 7 * M, funder: ids[i % ids.length] })) },
  ];
  for (let i = 0; i < 300; i++) stressWhatifs.push({ id: "w" + i, name: pick(["Photo booth", "Extra flowers", "Drone video", "Welcome dinner", "Late-night snacks", "Sparklers"]) + " " + (i + 1), category: pick(cats), price: Math.round(rnd() * 30 + 1) * 500000, funder: pick(ids) });

  const STRESS = Object.assign({}, NORMAL, {
    couple: ["Gregorius Alexander Wijayakusuma", "Isabella Margaretha Setyaningsih"],
    me: { name: "Gregorius", email: "gregorius.alexander.wijayakusuma.personal@example-very-long-domain.co.id" },
    partner: "Isabella",
    funders: sFunders, categories: cats, bookings: stressBookings, whatifs: stressWhatifs,
    sync: { by: "Isabella", booking: "s-zh", part: null, amount: 95 * M },
  });

  const EMPTY = Object.assign({}, NORMAL, { bookings: [], whatifs: [] });

  window.VEIL_DATA = { NORMAL, STRESS, EMPTY, TODAY: "2026-10-14" };
})();
