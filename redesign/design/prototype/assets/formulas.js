/* Veil prototype: SUM formulas and sorting for tables inside documents (R3, R4).
   Cells are addressed like a spreadsheet: columns A, B, C…, rows 1, 2, 3… counting the title row.
   =SUM(B2:B6) adds a range, =SUM(B2, C4) adds cells, =SUM(B2:B) grows as rows are added:
   it runs down to the last row, stopping above the total itself. */
(function () {
  const col = (k) => { let s = ""; k++; while (k > 0) { const m = (k - 1) % 26; s = String.fromCharCode(65 + m) + s; k = Math.floor((k - 1) / 26); } return s; };
  const colIx = (s) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const pos = (c) => { const tr = c.parentNode, t = c.closest("table"); return [[...t.rows].indexOf(tr), [...tr.cells].indexOf(c)]; };

  /* Rupiah-style numbers: "Rp 12.500.000", "12.500.000", "12500000", "2,5" */
  function num(text) {
    let t = String(text || "").replace(/ /g, " ").trim();
    const rp = /^rp\.?\s*/i.test(t);
    t = t.replace(/^rp\.?\s*/i, "").replace(/\s/g, "");
    if (!t) return { v: 0, blank: true, rp };
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return { v: parseFloat(t.replace(/\./g, "").replace(",", ".")), rp };
    if (/^-?\d+(,\d+)?$/.test(t)) return { v: parseFloat(t.replace(",", ".")), rp };
    if (/^-?\d+(\.\d+)?$/.test(t)) return { v: parseFloat(t), rp };
    return { v: 0, text: true, rp };
  }
  const fmt = (v, rp) => { const neg = v < 0, a = Math.abs(v), whole = Math.trunc(a), dec = Math.round((a - whole) * 100);
    return (neg ? "−" : "") + (rp ? "Rp " : "") + String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (dec ? "," + String(dec).padStart(2, "0") : ""); };

  class FErr extends Error { constructor(short, long) { super(long); this.short = short; } }

  function evalTable(t) {
    const rows = [...t.rows], grid = rows.map((tr) => [...tr.cells]);
    const nrows = grid.length, ncols = Math.max(...grid.map((r) => r.length));
    const memo = new Map();
    const valueAt = (r, k, stack) => {
      const c = grid[r] && grid[r][k];
      if (!c) throw new FErr("Bad reference", `${col(k)}${r + 1} is outside this table, which has ${ncols} columns and ${nrows} rows.`);
      if (c.dataset.f) return evalCell(c, r, k, stack);
      return num(c.classList.contains("editing-f") ? "" : c.textContent);
    };
    function evalCell(c, r, k, stack) {
      if (stack.includes(c)) throw new FErr("Includes itself", `This total includes its own cell, ${col(k)}${r + 1}. Change the range so it stops above it.`);
      if (memo.has(c)) { const m = memo.get(c); if (m instanceof Error) throw m; return m; }
      const f = c.dataset.f.trim();
      const m = /^=\s*sum\s*\((.*)\)\s*$/i.exec(f);
      if (!m) throw new FErr("Not a total", `Only SUM works here, like =SUM(B2:B6).`);
      const st = stack.concat([c]);
      let total = 0, rp = false;
      const add = (x) => { total += x.v; rp = rp || !!x.rp; };
      for (let arg of m[1].split(/[,;]/)) {
        arg = arg.trim().toUpperCase(); if (!arg) continue;
        let a;
        if ((a = /^([A-Z]+)(\d+)$/.exec(arg))) add(valueAt(+a[2] - 1, colIx(a[1]), st));
        else if ((a = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(arg))) {
          const r1 = Math.min(+a[2], +a[4]) - 1, r2 = Math.max(+a[2], +a[4]) - 1, k1 = Math.min(colIx(a[1]), colIx(a[3])), k2 = Math.max(colIx(a[1]), colIx(a[3]));
          for (let rr = r1; rr <= r2; rr++) for (let kk = k1; kk <= k2; kk++) add(valueAt(rr, kk, st));
        } else if ((a = /^([A-Z]+)(\d+):([A-Z]+)$/.exec(arg))) {
          /* growing range: down to the last row, stopping above this cell when it sits in that column */
          const k1 = Math.min(colIx(a[1]), colIx(a[3])), k2 = Math.max(colIx(a[1]), colIx(a[3]));
          const last = k >= k1 && k <= k2 && r >= +a[2] - 1 ? r - 1 : nrows - 1;
          if (k2 >= ncols) throw new FErr("Bad reference", `Column ${col(k2)} isn't in this table, which has ${ncols} columns.`);
          for (let rr = +a[2] - 1; rr <= last; rr++) for (let kk = k1; kk <= k2; kk++) add(valueAt(rr, kk, st));
        } else throw new FErr("Bad reference", `“${arg}” isn't a cell or range. Use cells like B2 or ranges like B2:B6.`);
      }
      const out = { v: total, rp };
      memo.set(c, out);
      return out;
    }
    grid.forEach((cells, r) => cells.forEach((c, k) => {
      if (c.dataset.f) {
        if (c.classList.contains("editing-f")) return;
        try { const v = evalCell(c, r, k, []); c.textContent = fmt(v.v, v.rp); c.classList.add("f"); c.classList.remove("f-err"); delete c.dataset.err; c.title = `${col(k)}${r + 1} ${c.dataset.f}`; }
        catch (e) { if (!(e instanceof FErr)) throw e; memo.set(c, e); c.textContent = e.short; c.classList.add("f", "f-err"); c.dataset.err = e.message; c.title = e.message; }
      } else {
        c.classList.remove("f", "f-err"); delete c.dataset.err; c.removeAttribute("title");
        const n = num(c.textContent); c.classList.toggle("n", !n.blank && !n.text && r > 0);
      }
    }));
  }
  const computeAll = (root) => root.querySelectorAll("table.dt").forEach(evalTable);

  /* R3: sort by one column; numbers numerically, blanks last; the title row and rows holding totals stay put */
  function sort(t, k, asc) {
    const rows = [...t.rows], head = t.dataset.head === "1" ? rows[0] : null;
    const body = rows.filter((r) => r !== head && !r.querySelector("[data-f]"));
    const pinned = rows.filter((r) => r !== head && r.querySelector("[data-f]"));
    const vals = body.map((r) => { const c = r.cells[k]; const tx = c ? c.textContent.trim() : ""; return { r, tx, n: num(tx) }; });
    const numeric = vals.filter((x) => !x.n.blank).every((x) => !x.n.text);
    vals.sort((a, z) => {
      if (a.n.blank !== z.n.blank) return a.n.blank ? 1 : -1;
      const c = numeric ? a.n.v - z.n.v : a.tx.localeCompare(z.tx, undefined, { numeric: true, sensitivity: "base" });
      return asc ? c : -c;
    });
    const parent = (head || rows[0]).parentNode;
    vals.forEach((x) => parent.appendChild(x.r));
    pinned.forEach((r) => parent.appendChild(r));
  }

  window.VeilFormulas = { col, pos, num, fmt, computeAll, sort };
})();
