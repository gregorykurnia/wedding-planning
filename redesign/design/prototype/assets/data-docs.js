/* Veil prototype: documents. Loads after data.js. Document bodies are stored as HTML. */
(function () {
  const { NORMAL, STRESS, EMPTY } = window.VEIL_DATA;

  const flowers = `<h2>Prices they quoted</h2>
<table class="dt" data-head="1"><colgroup><col style="width:46%"><col><col></colgroup>
<tr><th>Item</th><th>Qty</th><th>Price</th></tr>
<tr><td>Ceremony arch, white and blush</td><td>1</td><td>Rp 18.500.000</td></tr>
<tr><td>Aisle arrangements</td><td>12</td><td>Rp 9.600.000</td></tr>
<tr><td>Reception centrepieces</td><td>40</td><td>Rp 32.000.000</td></tr>
<tr><td>Bridal bouquet</td><td>1</td><td>Rp 3.500.000</td></tr>
<tr><td>Total</td><td></td><td data-f="=SUM(C2:C5)"></td></tr></table>
<h2>Next steps</h2><ol><li>Send them our moodboard by Friday</li><li>Ask whether the arch can move indoors if it rains</li><li>Bella to check the colours with <a href="https://www.pantone.com/color-finder/13-1520-TCX">Pantone Rose Quartz</a></li></ol>`;

  const docs = [
    { id: "kebun-meeting", title: "Meeting: Kebun Bunga Atelier", updated: "2026-10-14T10:42", by: "Greg",
      html: `<p><b>Tuesday 14 October</b>, at their studio in Canggu. Laras and her assistant Putu; Greg and Bella.</p>
<p>They loved the garden idea. Full styling covers the arch, the aisle, 40 tables and the stage. They can hold our date until <span style="background-color:#fce6ec">31 October</span> without a deposit.</p>${flowers}` },
    { id: "scratch", title: "Budget scratchpad", updated: "2026-10-13T21:15", by: "Bella",
      html: `<p>Rough sums before we commit. The total grows as we add rows.</p>
<table class="dt" data-head="1"><colgroup><col style="width:52%"><col></colgroup>
<tr><th>Idea</th><th>Cost</th></tr>
<tr><td>Fireworks</td><td>25000000</td></tr>
<tr><td>Live band</td><td>30000000</td></tr>
<tr><td>Welcome dinner</td><td>42000000</td></tr>
<tr><td>Everything above</td><td data-f="=SUM(B2:B4)"></td></tr>
<tr><td>Typo check</td><td data-f="=SUM(B2:B4, D9)"></td></tr>
<tr><td>Loop check</td><td data-f="=SUM(B2:B5, B7)"></td></tr></table>
<p><i>The last two rows show what happens with a bad reference and a total that includes itself.</i></p>` },
    { id: "sangjit", title: "Sangjit checklist", updated: "2026-10-12T09:03", by: "Bella",
      html: `<h2>Trays (12)</h2><ul><li>Fruit: oranges, apples, pomelo</li><li>Wedding cakes and pastries</li><li>Red packets for both families</li><li><s>Liquor</s> (Mama says no)</li></ul><h2>On the day</h2><ol><li>Groom's family arrives at 10:00</li><li>Tea ceremony</li><li>Lunch at the house</li></ol>` },
    { id: "honeymoon", title: "Honeymoon research", updated: "2026-10-08T22:40", by: "Greg",
      html: `<h1>Japan or Lombok?</h1><p>Japan in April means cherry blossom but higher prices. Lombok is closer and quieter.</p><blockquote>“Book Kyoto ryokans at least five months ahead in spring.”</blockquote><p>Useful: <a href="https://www.japan-guide.com/sakura/">japan-guide.com/sakura</a> and <a href="https://www.lonelyplanet.com/indonesia/nusa-tenggara/lombok">Lonely Planet: Lombok</a>.</p><pre>Flights CGK–KIX: about Rp 9.000.000 each, return</pre>` },
    { id: "questions", title: "Questions to ask every vendor", updated: "2026-09-29T19:20", by: "Greg",
      html: `<ol><li>Is our date free, and how long can you hold it?</li><li>What's the payment schedule?</li><li>What happens if it rains?</li><li>Who exactly will be there on the day?</li><li>Can we see a full wedding you've done, not just highlights?</li></ol>` },
    { id: "seating", title: "Seating ideas", updated: "2026-09-21T16:05", by: "Bella",
      html: `<p>Keep the two grandmothers at the same table, near the front but away from the speakers.</p>` },
  ];

  /* Meeting notes start (the quick way to take notes in a meeting) */
  const meetingTemplate = (date) => `<p><b>${date}</b>. Who was there: </p><h2>What they said</h2><p><br></p>
<h2>Prices</h2><table class="dt" data-head="1"><colgroup><col style="width:56%"><col></colgroup><tr><th>Item</th><th>Price</th></tr><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr><tr><td>Total</td><td data-f="=SUM(B2:B)"></td></tr></table>
<h2>Next steps</h2><ul><li><br></li></ul>`;

  Object.assign(NORMAL, { docs, meetingTemplate, dsync: { by: "Bella", doc: { id: "playlist", title: "First dance shortlist", updated: "2026-10-14T11:02", by: "Bella", html: "<ol><li>Can't Help Falling in Love</li><li>Lucky</li></ol>" } } });
  Object.assign(EMPTY, { docs: [], meetingTemplate, dsync: NORMAL.dsync });

  /* ---------- STRESS ---------- */
  const words = "rendang arch blush garden tasting deposit sangjit tray ribbon candle aisle bouquet invitation lantern tea ceremony villa pavilion chair linen".split(" ");
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const para = (n) => Array.from({ length: n }, () => words[Math.floor(rnd() * words.length)]).join(" ");
  const bigTable = `<table class="dt" data-head="1"><tr>${"ABCDEFGH".split("").map((c) => `<th>Column ${c}</th>`).join("")}</tr>${Array.from({ length: 50 }, (_, r) => `<tr>${Array.from({ length: 8 }, (_, c) => `<td>${c === 0 ? "Row " + (r + 1) : c === 7 ? "" : Math.floor(rnd() * 900000) * 100}</td>`).join("")}</tr>`).join("")}<tr><td>Totals</td>${"BCDEFG".split("").map((c) => `<td data-f="=SUM(${c}2:${c})"></td>`).join("")}<td></td></tr></table>`;
  const sdocs = [
    { id: "s-long", title: "RencanaLengkapPernikahanDanResepsiKeluargaBesarWijayakusumaningratDanSetyaningsih2027", updated: "2026-10-14T11:00", by: "Isabella",
      html: `<h1>${para(14)}</h1>${Array.from({ length: 40 }, () => `<p>${para(60)}</p>`).join("")}<p>PemberkatanNikahDanResepsiDiGerejaKatedralSantaPerawanMariaDiangkatKeSurgaJakartaPusatTanpaSpasiSamaSekali</p>${bigTable}<ul>${Array.from({ length: 30 }, () => `<li>${para(8)}<ul><li>${para(6)}<ul><li>${para(5)}<ul><li>${para(4)}</li></ul></li></ul></li></ul></li>`).join("")}</ul>` },
    { id: "s-zh", title: "婚礼当天流程与座位安排", updated: "2026-10-13T08:00", by: "Gregorius", html: "<p>上午十点，新郎家人到达。茶道仪式之后是午餐。</p>" },
    { id: "s-ar", title: "قائمة الضيوف من عائلة العروس", updated: "2026-10-12T08:00", by: "Isabella", html: "<p dir=\"rtl\">قائمة أولية بأسماء الضيوف.</p>" },
    { id: "s-empty", title: "", updated: "2026-10-11T08:00", by: "Gregorius", html: "" },
  ];
  for (let i = 0; i < 1500; i++) {
    const day = new Date(2026, 9, 10); day.setDate(day.getDate() - Math.floor(i / 6));
    sdocs.push({ id: "gd" + i, title: `${["Notes", "Ideas", "Meeting", "Checklist", "Draft"][i % 5]} ${i + 1}: ${para(3)}`, updated: day.toISOString().slice(0, 10) + "T" + String(8 + (i % 12)).padStart(2, "0") + ":00", by: i % 2 ? "Isabella" : "Gregorius", html: `<p>${para(30)}</p>` });
  }
  Object.assign(STRESS, { docs: sdocs, meetingTemplate, dsync: { by: "Isabella", doc: Object.assign({}, NORMAL.dsync.doc, { title: "ร้านดอกไม้ที่เชียงใหม่ ตัวเลือกทั้งหมด" }) } });
})();
