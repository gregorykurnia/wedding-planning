/* Veil prototype: vendors, shortlist and venues data. Loads after data.js and adds to each set. */
(function () {
  const { NORMAL, STRESS, EMPTY } = window.VEIL_DATA;
  const M = 1000000;
  const img = (w, h, a, b) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);

  /* F10 stages, in order; "out" is ruled out. F3 venue stages likewise. */
  const STAGES = [["noted", "Noted"], ["asking", "Inquiring"], ["considering", "Considering"], ["chosen", "Chosen"], ["done", "Done"]];
  const VENUE_STAGES = [["noted", "Noted"], ["contacted", "Contacted"], ["visited", "Visited"], ["booked", "Booked"]];

  const vendorCats = [
    "Catering", "Photo and video", "Decoration", "Bride's attire", "Groom's attire", "Makeup", "Music", "Invitations",
    "Rings", "Transport", "Wedding cake", "Souvenirs",
  ].map((name) => ({ name, own: false })).concat([{ name: "Sangjit gifts", own: true }, { name: "Pre-wedding", own: true }, { name: "Other", own: false, catchall: true }]);

  const opt = (id, name, price, includes, preferred) => ({ id, name, price, includes, preferred: !!preferred });
  const vendors = [
    { id: "lestari", name: "Dapur Lestari Catering", category: "Catering", contact: "Ibu Ratna", phone: "0812 3456 7801", stage: "chosen", rating: 4.8, reviewers: 312, keen: true, added: "2026-05-02",
      prices: [opt("o1", "Silver, 400 guests", 140 * M, "Buffet, 5 dishes, iced tea"), opt("o2", "Gold, 400 guests", 161 * M, "Buffet, 7 dishes, dessert table, 2 live stations", true), opt("o3", "Platinum, 400 guests", 185 * M, "Gold plus a wedding cake and a tasting for 10")],
      notes: "Tasting on 3 September went well; the rendang was the favourite. Menu and photos: https://dapurlestari.co.id/menu-2027", files: [{ name: "Catering quote, 400 guests.pdf", size: "1,1 MB", type: "pdf" }] },
    { id: "nusantara", name: "Rasa Nusantara", category: "Catering", contact: "Pak Hendra", phone: "0813 2222 9090", stage: "out", rating: 4.3, reviewers: 88, keen: false, added: "2026-05-04",
      prices: [opt("o1", "Buffet, 400 guests", 128 * M, "Buffet, 6 dishes", true)], notes: "Fully booked on our date.", files: [] },
    { id: "sendok", name: "Sendok Emas Catering", category: "Catering", contact: "Mbak Dewi", phone: "0811 380 4455", stage: "considering", rating: 4.6, reviewers: 154, keen: true, added: "2026-05-20",
      prices: [opt("o1", "Package A", 150 * M, "400 guests, 6 dishes, dessert table", true), opt("o2", "Package B", 172 * M, "Package A plus 3 live stations")], notes: "", files: [] },
    { id: "rana", name: "Studio Rana", category: "Photo and video", contact: "Rana", phone: "0817 0099 1234", stage: "chosen", rating: 4.9, reviewers: 527, keen: true, added: "2026-04-11",
      prices: [opt("o1", "Package A", 58 * M, "Photo only, 10 hours"), opt("o2", "Package B", 68 * M, "Photo and video, 12 hours, 1 album", true)], notes: "Portfolio: https://instagram.com/studiorana", files: [{ name: "Studio Rana package B.pdf", size: "3,8 MB", type: "pdf" }] },
    { id: "lensa", name: "Lensa Kita", category: "Photo and video", contact: "Bayu", phone: "0812 7777 3131", stage: "considering", rating: 4.7, reviewers: 201, keen: false, added: "2026-04-15",
      prices: [opt("o1", "Full day", 72 * M, "2 photographers, 1 videographer", true)], notes: "", files: [] },
    { id: "ara", name: "Moments by Ara", category: "Photo and video", contact: "", phone: "0857 1200 3400", stage: "asking", rating: null, reviewers: null, keen: false, added: "2026-10-10",
      prices: [], notes: "Found on Instagram. Asked for their price list on 10 October.", files: [] },
    { id: "lumiere", name: "Lumière Décor", category: "Decoration", contact: "Mbak Sari", phone: "0812 9090 1122", stage: "chosen", rating: 4.8, reviewers: 143, keen: true, added: "2026-06-01",
      prices: [opt("o1", "Full styling", 98 * M, "Ceremony arch, aisle, reception tables, stage", true)], notes: "", files: [{ name: "Moodboard.png", size: "4,2 MB", type: "image", src: img(300, 200, "#fce6ec", "#ffffff") }] },
    { id: "kebun", name: "Kebun Bunga Atelier", category: "Decoration", contact: "Laras", phone: "0878 5566 7788", stage: "considering", rating: 4.8, reviewers: 96, keen: true, added: "2026-06-03",
      prices: [opt("o1", "Garden arch only", 85 * M, "Arch and aisle flowers"), opt("o2", "Full styling", 120 * M, "Arch, aisle, 40 tables, stage", true)], notes: "", files: [] },
    { id: "ayu", name: "Maison Ayu Bridal", category: "Bride's attire", contact: "Ayu", phone: "0812 4545 6767", stage: "chosen", rating: 4.9, reviewers: 410, keen: true, added: "2026-05-15",
      prices: [opt("o1", "Made to measure gown", 72 * M, "Gown, veil, 3 fittings", true)], notes: "", files: [] },
    { id: "kirana", name: "Kirana Makeup", category: "Makeup", contact: "Kirana", phone: "0813 1414 2525", stage: "done", rating: 4.7, reviewers: 230, keen: false, added: "2026-06-20",
      prices: [opt("o1", "Bride and 2 mothers", 18.5 * M, "Trial, wedding day, touch-ups", true)], notes: "", files: [] },
    { id: "sinta", name: "Glow by Sinta", category: "Makeup", contact: "Sinta", phone: "0819 3030 4040", stage: "out", rating: 4.4, reviewers: 67, keen: false, added: "2026-06-18",
      prices: [opt("o1", "Bride only", 9 * M, "Wedding day", true)], notes: "Not available for the trial.", files: [] },
    { id: "svara", name: "Svara Band", category: "Music", contact: "", phone: "", stage: "noted", rating: null, reviewers: null, keen: false, added: "2026-10-12", prices: [], notes: "Friend of Bella's cousin.", files: [] },
    { id: "sakura", name: "Sakura Transport", category: "Transport", contact: "Pak Joko", phone: "0811 6060 7070", stage: "chosen", rating: 4.5, reviewers: 58, keen: false, added: "2026-09-25",
      prices: [opt("o1", "3 cars, 10 hours", 12 * M, "Drivers and fuel", true)], notes: "", files: [] },
    { id: "manis", name: "Manis Cake Studio", category: "Wedding cake", contact: "Cici", phone: "0812 8181 9292", stage: "asking", rating: 4.5, reviewers: 64, keen: true, added: "2026-09-30",
      prices: [opt("o1", "Four tiers", 9.5 * M, "Tasting box included", true), opt("o2", "Five tiers", 12 * M, "Tasting box included")], notes: "", files: [] },
    { id: "seserahan", name: "Seserahan Cantik", category: "Sangjit gifts", contact: "Lina", phone: "0896 1111 2323", stage: "considering", rating: 4.6, reviewers: 39, keen: false, added: "2026-08-08",
      prices: [opt("o1", "12 trays", 7.5 * M, "Trays, wrapping and delivery", true)], notes: "", files: [] },
    { id: "larasati", name: "Batik Larasati", category: "Groom's attire", contact: "", phone: "0812 3030 5050", stage: "noted", rating: 4.2, reviewers: 18, keen: false, added: "2026-10-13", prices: [], notes: "", files: [] },
  ];

  const pk = (id, name, price, includes, reviews, extra) => Object.assign({ id, name, price, includes, reviews, step: "", notes: "", files: [] }, extra || {});
  const finalists = [
    { id: "f-sendok", vendor: "sendok", name: "Sendok Emas Catering", category: "Catering", contact: "Mbak Dewi", phone: "0811 380 4455", reviews: 154, followers: 12400, step: "Book a tasting", notes: "",
      packages: [pk("k1", "Package A", 150 * M, "400 guests, 6 dishes, dessert table", 154, { preferred: true }), pk("k2", "Package B", 172 * M, "Package A plus 3 live stations", 154)], files: [] },
    { id: "f-lestari", vendor: "lestari", name: "Dapur Lestari Catering", category: "Catering", contact: "Ibu Ratna", phone: "0812 3456 7801", reviews: 312, followers: 28700, step: "", notes: "", moved: "booking",
      packages: [pk("k1", "Gold, 400 guests", 161 * M, "Buffet, 7 dishes, dessert table, 2 live stations", 312, { preferred: true }), pk("k2", "Silver, 400 guests", 140 * M, "Buffet, 5 dishes", 312)], files: [] },
    { id: "f-lensa", vendor: "lensa", name: "Lensa Kita", category: "Photo and video", contact: "Bayu", phone: "0812 7777 3131", reviews: 201, followers: 45200, step: "Ask about a second shooter", notes: "",
      packages: [pk("k1", "Full day", 72 * M, "2 photographers, 1 videographer", 201, { preferred: true })], files: [] },
    { id: "f-arka", vendor: null, name: "Arka Visual", category: "Photo and video", contact: "", phone: "", reviews: 88, followers: 9100, step: "Wait for their quote", notes: "Recommended by Tia.",
      packages: [pk("k1", "Signature", 64 * M, "Photo and video, 10 hours", 88, { preferred: true }), pk("k2", "Signature plus drone", 71 * M, "Adds drone video", 88)], files: [] },
    { id: "f-kebun", vendor: "kebun", name: "Kebun Bunga Atelier", category: "Decoration", contact: "Laras", phone: "0878 5566 7788", reviews: 96, followers: 18800, step: "Send our moodboard", notes: "",
      packages: [pk("k1", "Full styling", 120 * M, "Arch, aisle, 40 tables, stage", 96, { preferred: true }), pk("k2", "Garden arch only", 85 * M, "Arch and aisle flowers", 96)],
      files: [{ name: "Kebun Bunga lookbook.pdf", size: "6,1 MB", type: "pdf", fromVendor: true }] },
    { id: "f-manis", vendor: "manis", name: "Manis Cake Studio", category: "Wedding cake", contact: "Cici", phone: "0812 8181 9292", reviews: 64, followers: 7300, step: "Choose flavours after the tasting", notes: "",
      packages: [pk("k1", "Four tiers", 9.5 * M, "Tasting box included", 64, { preferred: true }), pk("k2", "Five tiers", 12 * M, "Tasting box included", 64)], files: [] },
  ];

  const venues = [
    { id: "samaya", name: "Villa Samaya Ubud", location: "Ubud, Bali", cost: 380 * M, capacity: 450, stage: "booked", notes: "Booked for 20 March 2027. Garden ceremony, pavilion reception.", files: [{ name: "Villa Samaya contract.pdf", size: "2,4 MB", type: "pdf" }] },
    { id: "taman", name: "Puri Taman Sari", location: "Gianyar, Bali", cost: 340 * M, capacity: 500, stage: "visited", notes: "Lovely, but the road in is narrow for the buses.", files: [] },
    { id: "mulia", name: "Hotel Mulia Ballroom", location: "Nusa Dua, Bali", cost: 610 * M, capacity: 1200, stage: "contacted", notes: "", files: [{ name: "Mulia wedding brochure.pdf", size: "8,8 MB", type: "pdf" }] },
    { id: "amara", name: "Amara Cliff", location: "Uluwatu, Bali", cost: 450 * M, capacity: 250, stage: "noted", notes: "https://amaracliff.com/weddings", files: [] },
    { id: "glass", name: "The Glasshouse Seminyak", location: "Seminyak, Bali", cost: 520 * M, capacity: 300, stage: "out", notes: "Too small for both families.", files: [] },
    { id: "kebunc", name: "Rumah Kebun Canggu", location: "Canggu, Bali", cost: 260 * M, capacity: 180, stage: "out", notes: "", files: [] },
  ];

  Object.assign(NORMAL, { STAGES, VENUE_STAGES, vendorCats, vendors, finalists, venues,
    vsync: { by: "Bella", vendor: { id: "melati", name: "Bunga Melati Florist", category: "Decoration", contact: "Ibu Wati", phone: "0812 5050 6060", stage: "noted", rating: null, reviewers: null, keen: false, added: "2026-10-14", prices: [], notes: "", files: [] } } });
  Object.assign(EMPTY, { STAGES, VENUE_STAGES, vendorCats, vendors: [], finalists: [], venues: [], vsync: NORMAL.vsync });

  /* ---------- STRESS ---------- */
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const longNote = "We met them at the Bridestory fair. They can do both the sangjit and the reception, but the sangjit team is smaller (4 people instead of 8), and they asked us to confirm the colour palette by the end of the month. Their portfolio is at https://instagram.com/examplevendor.official and a past wedding we liked is at https://www.example-weddings.co.id/portfolio/2025/santoso-wijaya-garden-reception-ubud-bali. Price includes transport inside Bali only; Lombok would be extra. Payment: 30% to book, 40% two months before, 30% one week before. Ask about the rain plan and whether the arch can be moved indoors.";
  const sCats = vendorCats.slice(0, -1).concat(Array.from({ length: 22 }, (_, i) => ({ name: i === 0 ? "Kategori_Tenda_Dan_Panggung_Utama_Acara" : i === 1 ? "婚礼前拍摄与家庭聚会" : i === 2 ? "Seserahan dan hantaran keluarga besar" : "Our category " + (i + 1), own: true })), [vendorCats[vendorCats.length - 1]]);
  const sVendors = [
    { id: "sv-long", name: "PTDekorasiDanPerlengkapanPernikahanMewahNusantaraJayaAbadiSentosaIndonesia", category: "Kategori_Tenda_Dan_Panggung_Utama_Acara", contact: "Ibu Maria Goretti Setyaningsih Wijayakusumaningrat", phone: "+62 812 3456 7890 ext. 1234", stage: "considering", rating: 5, reviewers: 1284937, keen: true, added: "2026-01-01",
      prices: Array.from({ length: 30 }, (_, i) => opt("o" + i, i === 4 ? "Paket_Lengkap_Dengan_Tenda_Panggung_Dan_Pencahayaan_Untuk_Seribu_Tamu" : "Option " + (i + 1), (i + 1) * 7.5 * M, i % 3 ? "" : longNote.slice(0, 180), i === 4)), notes: longNote,
      files: [{ name: "tiny.png", size: "1 KB", type: "image", src: img(2, 2, "#d9466f", "#c6a466") }, { name: "panorama.jpg", size: "9,9 MB", type: "image", src: img(6000, 400, "#f4ead7", "#d9466f") }] },
    { id: "sv-zh", name: "婚礼摄影工作室・东京与巴厘岛联合团队", category: "Photo and video", contact: "陈先生", phone: "+81 90 1234 5678", stage: "asking", rating: 4.9, reviewers: 12, keen: false, added: "2026-02-02", prices: [opt("o1", "全天", 88 * M, "", true)], notes: "", files: [] },
    { id: "sv-ar", name: "استوديو التصوير الفوتوغرافي للأعراس", category: "Photo and video", contact: "أحمد", phone: "+971 50 123 4567", stage: "noted", rating: null, reviewers: null, keen: false, added: "2026-02-03", prices: [], notes: "", files: [] },
    { id: "sv-empty", name: "X", category: "Other", contact: "", phone: "", stage: "noted", rating: null, reviewers: null, keen: false, added: "2026-02-04", prices: [], notes: "", files: [] },
  ];
  const vn = ["Bunga Melati", "Sinar Abadi", "Kencana", "Gending Jawa", "Teras", "Mawar Putih", "Puri Ayu", "Langit Senja", "Rumah Kue", "Cahaya", "Garuda Sound", "Tirta", "Sekar Wangi"];
  const st = ["noted", "asking", "considering", "chosen", "done", "out"];
  for (let i = 0; i < 2000; i++) {
    const n = Math.floor(rnd() * 4);
    sVendors.push({ id: "gv" + i, name: `${pick(vn)} ${i + 1}`, category: pick(sCats).name, contact: rnd() < 0.3 ? "" : pick(["Ibu Ratna", "Pak Budi", "Mbak Dewi", "Kak Tia"]), phone: rnd() < 0.2 ? "" : "0812 " + String(1000 + i).padStart(4, "0") + " " + String(4000 + i).slice(-4),
      stage: pick(st), rating: rnd() < 0.2 ? null : Math.round((3 + rnd() * 2) * 10) / 10, reviewers: Math.floor(rnd() * 900), keen: rnd() < 0.1, added: "2026-0" + (1 + Math.floor(rnd() * 9)) + "-1" + Math.floor(rnd() * 9),
      prices: Array.from({ length: n }, (_, k) => opt("o" + k, "Option " + (k + 1), Math.round(rnd() * 80 + 2) * 500000, "", k === 0)), notes: "", files: [] });
  }
  const sFinalists = [
    { id: "sf-deep", vendor: "sv-long", name: sVendors[0].name, category: sVendors[0].category, contact: sVendors[0].contact, phone: sVendors[0].phone, reviews: 1284937, followers: 98765432, step: longNote.slice(0, 220), notes: longNote,
      packages: Array.from({ length: 30 }, (_, i) => pk("k" + i, i === 2 ? "Paket_Lengkap_Dengan_Tenda_Panggung_Dan_Pencahayaan_Untuk_Seribu_Tamu" : "Package " + (i + 1), (i + 1) * 9 * M, i % 2 ? "" : longNote.slice(0, 140), Math.floor(rnd() * 900), { preferred: i === 2 })),
      files: sVendors[0].files.map((f) => Object.assign({ fromVendor: true }, f)) },
    { id: "sf-zh", vendor: "sv-zh", name: sVendors[1].name, category: "Photo and video", contact: "陈先生", phone: "+81 90 1234 5678", reviews: 12, followers: 0, step: "", notes: "", packages: [pk("k1", "全天", 88 * M, "", 12, { preferred: true })], files: [] },
    { id: "sf-empty", vendor: null, name: "Y", category: "Other", contact: "", phone: "", reviews: null, followers: null, step: "", notes: "", packages: [], files: [] },
  ];
  for (let i = 0; i < 80; i++) sFinalists.push({ id: "gf" + i, vendor: null, name: `${pick(vn)} finalist ${i + 1}`, category: pick(sCats).name, contact: "", phone: "", reviews: Math.floor(rnd() * 600), followers: Math.floor(rnd() * 90000), step: "", notes: "",
    packages: Array.from({ length: 1 + Math.floor(rnd() * 3) }, (_, k) => pk("k" + k, "Package " + (k + 1), Math.round(rnd() * 80 + 2) * 500000, "", Math.floor(rnd() * 600), { preferred: k === 0 })), files: [] });
  const sVenues = [{ id: "sven", name: "GedungSerbagunaKatedralSantaPerawanMariaDiangkatKeSurga", location: "Jalan Katedral No. 7B, Pasar Baru, Sawah Besar, Kota Jakarta Pusat, DKI Jakarta 10710, Indonesia", cost: 9876543 * M, capacity: 125000, stage: "visited", notes: longNote, files: [] },
    { id: "sven0", name: "Z", location: "", cost: null, capacity: null, stage: "noted", notes: "", files: [] }];
  for (let i = 0; i < 300; i++) sVenues.push({ id: "gven" + i, name: `${pick(["Villa", "Hotel", "Puri", "Rumah", "Taman"])} ${pick(vn)} ${i + 1}`, location: pick(["Ubud", "Canggu", "Jakarta", "Bandung", "Surabaya"]), cost: Math.round(rnd() * 600 + 100) * M, capacity: Math.round(rnd() * 1000 + 50), stage: pick(["noted", "contacted", "visited", "out"]), notes: "", files: [] });

  Object.assign(STRESS, { STAGES, VENUE_STAGES, vendorCats: sCats, vendors: sVendors, finalists: sFinalists, venues: sVenues,
    vsync: { by: "Isabella", vendor: Object.assign({}, NORMAL.vsync.vendor, { name: "ร้านดอกไม้ของคุณแม่และเพื่อนๆ ที่เชียงใหม่", id: "melati-s" }) } });
})();
