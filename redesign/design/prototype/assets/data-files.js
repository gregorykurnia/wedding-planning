/* Veil prototype: folders and files (R8–R14). Loads after data.js. */
(function () {
  const { NORMAL, STRESS, EMPTY } = window.VEIL_DATA;
  const img = (w, h, a, b) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);

  const CATEGORIES = ["Contract", "Quote", "Receipt", "Invoice", "Brochure", "Moodboard", "Photo", "ID and legal", "Guest list", "Seating plan"];
  const folders = [
    { id: "vendors", name: "Vendors", parent: null },
    { id: "catering", name: "Catering", parent: "vendors" },
    { id: "photo", name: "Photo and video", parent: "vendors" },
    { id: "decor", name: "Decoration", parent: "vendors" },
    { id: "venue", name: "Venue", parent: null },
    { id: "legal", name: "Legal and church", parent: null },
    { id: "inspo", name: "Inspiration", parent: null },
    { id: "old", name: "Old quotes", parent: "catering" },
  ];
  const f = (id, name, folder, size, date, category, desc, type, src) => ({ id, name, folder, size, date, category, desc, type, src });
  const files = [
    f("f1", "Villa Samaya contract.pdf", "venue", 2.4, "2026-07-02", "Contract", "Signed by both of us. Final payment due 15 January.", "pdf"),
    f("f2", "Deposit receipt.jpg", "venue", 0.6, "2026-07-03", "Receipt", "", "image", img(300, 200, "#f4ead7", "#fce6ec")),
    f("f3", "Site visit, garden.jpg", "venue", 3.1, "2026-06-12", "Photo", "Where the arch will stand", "image", img(300, 200, "#e3f0e6", "#fce6ec")),
    f("f4", "Catering quote, 400 guests.pdf", "catering", 1.1, "2026-08-11", "Quote", "Gold package, with the dessert table", "pdf"),
    f("f5", "Tasting menu.pdf", "catering", 0.4, "2026-09-03", "Brochure", "", "pdf"),
    f("f6", "Rasa Nusantara quote.pdf", "old", 0.9, "2026-05-04", "Quote", "Ruled out: fully booked", "pdf"),
    f("f7", "Studio Rana package B.pdf", "photo", 3.8, "2026-06-20", "Quote", "", "pdf"),
    f("f8", "Moodboard.png", "decor", 4.2, "2026-09-02", "Moodboard", "Blush, champagne and lots of white", "image", img(300, 200, "#fce6ec", "#ffffff")),
    f("f9", "Kebun Bunga lookbook.pdf", "decor", 6.1, "2026-10-03", "Brochure", "", "pdf"),
    f("f10", "Baptism certificates.pdf", "legal", 1.6, "2026-08-20", "ID and legal", "Both of ours, scanned for the parish", "pdf"),
    f("f11", "Marriage course schedule.docx", "legal", 0.1, "2026-09-10", "", "Saturdays in November", "doc"),
    f("f12", "Pinterest saves.zip", "inspo", 8.7, "2026-04-01", "Moodboard", "", "zip"),
    f("f13", "Guest list draft.xlsx", null, 0.05, "2026-10-01", "Guest list", "First pass, before trimming", "sheet"),
    f("f14", "Wedding budget.csv", null, 0.01, "2026-10-12", "", "", "sheet"),
  ];

  Object.assign(NORMAL, { FILE_CATEGORIES: CATEGORIES, folders, files });
  Object.assign(EMPTY, { FILE_CATEGORIES: CATEGORIES, folders: [], files: [] });

  /* STRESS: a 30-deep chain of folders, 3,000 files in one folder, long names, tiny and huge images */
  const sf = [{ id: "deep0", name: "Arsip", parent: null }];
  for (let i = 1; i < 30; i++) sf.push({ id: "deep" + i, name: i === 5 ? "Folder_Dengan_Nama_Yang_Sangat_Panjang_Sekali_Tanpa_Spasi_Untuk_Dokumen_Resmi" : i === 9 ? "合同与收据" : "Level " + (i + 1), parent: "deep" + (i - 1) });
  sf.push({ id: "big", name: "Everything from the photographer", parent: null }, { id: "ar", name: "مستندات الكنيسة", parent: null });
  for (let i = 0; i < 40; i++) sf.push({ id: "many" + i, name: "Folder " + (i + 1), parent: "big" });
  const sfiles = [
    f("s1", "tiny.png", "deep29", 0.001, "2026-10-14", "Photo", "", "image", img(2, 2, "#d9466f", "#c6a466")),
    f("s2", "panorama-of-the-whole-cathedral-nave-from-the-choir-loft-very-wide.jpg", "deep29", 9.9, "2026-10-13", "Photo", "", "image", img(6000, 400, "#f4ead7", "#d9466f")),
    f("s3", "tall.jpg", "deep29", 8.7, "2026-10-12", "Photo", "", "image", img(300, 5000, "#fce6ec", "#33262c")),
    f("s4", "Kontrak_Final_Revisi_Ketiga_DITANDATANGANI_kedua_belah_pihak_2026_dengan_lampiran.pdf", "deep29", 10, "2026-10-11", "Kategori dokumen resmi dari gereja dan catatan sipil", "Scanned at the church office on Saturday. ".repeat(12), "pdf"),
    f("s5", "婚礼合同.docx", "deep9", 0.09, "2026-10-10", "Contract", "合同", "doc"),
    f("s6", "عقد.pdf", "ar", 0.2, "2026-10-09", "", "", "pdf"),
  ];
  for (let i = 0; i < 3000; i++) sfiles.push(f("b" + i, `DSC_${String(10000 + i)}.jpg`, "big", Math.round((1 + (i % 9)) * 10) / 10, "2026-09-" + String(1 + (i % 28)).padStart(2, "0"), "Photo", "", "image", img(30, 20, i % 2 ? "#fce6ec" : "#f4ead7", "#ffffff")));
  Object.assign(STRESS, { FILE_CATEGORIES: CATEGORIES, folders: sf, files: sfiles });
})();
