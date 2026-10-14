import { describe, expect, it } from "vitest";
import { andList, compact, cut, dec, figure, group, isLongFigure, linkParts, n0, plural, rp } from "@/lib/model/format";
import { waHref } from "@/lib/model/whatsapp";
import { csvCell, exportFileName, toCsv } from "@/lib/model/csv";

describe("money and counts", () => {
  it("groups thousands with dots", () => {
    expect(group(12_500_000)).toBe("12.500.000");
    expect(group(999)).toBe("999");
    expect(group(1000)).toBe("1.000");
    expect(group(0)).toBe("0");
  });

  it("puts a true minus first in rupiah", () => {
    expect(rp(12_500_000)).toBe("Rp 12.500.000");
    expect(rp(-12_000_000)).toBe("−Rp 12.000.000");
    expect(rp(0)).toBe("Rp 0");
  });

  it("splits a figure so the Rp can be set small", () => {
    expect(figure(-2_500_000)).toEqual({ sign: "−", unit: "Rp", digits: "2.500.000" });
    expect(figure(7)).toEqual({ sign: "", unit: "Rp", digits: "7" });
  });

  it("flags figures longer than 13 digits", () => {
    expect(isLongFigure(9_999_999_999_999)).toBe(false);
    expect(isLongFigure(10_000_000_000_000)).toBe(true);
    expect(isLongFigure(-9_876_543_000_000_000)).toBe(true);
  });

  it("writes counts with dots", () => {
    expect(n0(1206)).toBe("1.206");
    expect(n0(2004)).toBe("2.004");
    expect(n0(12)).toBe("12");
    expect(plural(1, "guest")).toBe("1 guest");
    expect(plural(1206, "booking")).toBe("1.206 bookings");
    expect(plural(20, "person", "people")).toBe("20 people");
    expect(plural(1, "person", "people")).toBe("1 person");
    expect(plural(0, "task")).toBe("0 tasks");
  });

  it("writes decimals with a comma", () => {
    expect(dec(4.8)).toBe("4,8");
    expect(dec("33.1")).toBe("33,1");
    expect(dec(5)).toBe("5");
  });

  it("shortens big counts", () => {
    expect(compact(null)).toBe("");
    expect(compact(undefined)).toBe("");
    expect(compact(98)).toBe("98");
    expect(compact(9999)).toBe("9.999");
    expect(compact(12_300)).toBe("12,3k");
    expect(compact(10_000)).toBe("10k");
    expect(compact(98_765_432)).toBe("98,8M");
    expect(compact(1_000_000)).toBe("1M");
    expect(compact(999_999)).toBe("1M");
    expect(compact(1_284_937)).toBe("1,3M");
  });

  it("joins names with commas and 'and'", () => {
    expect(andList([])).toBe("");
    expect(andList(["Ana"])).toBe("Ana");
    expect(andList(["Ana", "Budi"])).toBe("Ana and Budi");
    expect(andList(["Ana", "Budi", "Citra"])).toBe("Ana, Budi and Citra");
  });
});

describe("cut", () => {
  it("leaves short text alone and cuts long text with an ellipsis", () => {
    expect(cut("short", 10)).toBe("short");
    expect(cut("0123456789", 10)).toBe("0123456789");
    expect(cut("0123456789A", 10)).toBe("01234567…");
    expect(Array.from(cut("x".repeat(200), 90))).toHaveLength(89);
  });

  it("never splits a character", () => {
    const cut2 = cut("婚礼摄影工作室婚礼摄影工作室", 6);
    expect(cut2).toBe("婚礼摄影…");
    expect(cut("😀".repeat(10), 5)).toBe("😀😀😀…");
  });
});

describe("linkParts", () => {
  it("finds web addresses without taking the sentence's punctuation", () => {
    expect(linkParts("See https://dapurlestari.co.id/menu-2027.")).toEqual([
      { text: "See " },
      { text: "dapurlestari.co.id/menu-2027", href: "https://dapurlestari.co.id/menu-2027" },
      { text: "." },
    ]);
  });

  it("drops the www and keeps the full address as the link", () => {
    expect(linkParts("http://www.example.com/a?b=1")).toEqual([
      { text: "example.com/a?b=1", href: "http://www.example.com/a?b=1" },
    ]);
  });

  it("returns plain text as one piece, and nothing for nothing", () => {
    expect(linkParts("no links here")).toEqual([{ text: "no links here" }]);
    expect(linkParts("")).toEqual([]);
  });

  it("never turns text into markup", () => {
    expect(linkParts("<b>bold</b> https://a.co/x")).toEqual([
      { text: "<b>bold</b> " },
      { text: "a.co/x", href: "https://a.co/x" },
    ]);
  });
});

describe("waHref", () => {
  it("turns a leading 0 into 62", () => {
    expect(waHref("0812 3456 7801")).toBe("https://wa.me/6281234567801");
    expect(waHref("0812-3456-7801")).toBe("https://wa.me/6281234567801");
  });

  it("keeps a number that already has a country code", () => {
    expect(waHref("+62 812 3456 7801")).toBe("https://wa.me/6281234567801");
    expect(waHref("+81 90 1234 5678")).toBe("https://wa.me/819012345678");
    expect(waHref("6281234567801")).toBe("https://wa.me/6281234567801");
  });

  it("reads a 00 international prefix", () => {
    expect(waHref("0062 812 3456 7801")).toBe("https://wa.me/6281234567801");
  });

  it("leaves an extension out of the number", () => {
    expect(waHref("+62 812 3456 7890 ext. 1234")).toBe("https://wa.me/6281234567890");
    expect(waHref("0812 3456 7890 x12")).toBe("https://wa.me/6281234567890");
  });

  it("gives nothing when there is no usable number", () => {
    expect(waHref("")).toBeNull();
    expect(waHref(null)).toBeNull();
    expect(waHref(undefined)).toBeNull();
    expect(waHref("call Ibu Ratna")).toBeNull();
    expect(waHref("0")).toBeNull();
  });
});

describe("csv", () => {
  it("quotes what needs quoting and doubles quotes", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell("two\r\nlines")).toBe('"two\r\nlines"');
    expect(csvCell(" padded")).toBe('" padded"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(4.8)).toBe("4.8");
  });

  it("writes a header and rows joined with CRLF, led by a byte-order mark", () => {
    const rows = [
      { name: "Dapur Lestari, Catering", rating: 4.8 },
      { name: "婚礼摄影工作室", rating: null },
    ];
    const csv = toCsv(
      [
        { header: "Vendor", value: (r) => r.name },
        { header: "Rating", value: (r) => r.rating },
      ],
      rows,
    );
    expect(csv).toBe('﻿Vendor,Rating\r\n"Dapur Lestari, Catering",4.8\r\n婚礼摄影工作室,');
    expect(toCsv([{ header: "A", value: () => 1 }], [], { bom: false })).toBe("A");
  });

  it("names the file from the kind and the two names", () => {
    expect(exportFileName("vendors", ["Greg", "Bella"])).toBe("vendors-greg-bella.csv");
    expect(exportFileName("vendors", ["Gregorí O.", "Bélla"])).toBe("vendors-gregori-o-bella.csv");
    expect(exportFileName("vendors", ["王小明", ""])).toBe("vendors.csv");
  });
});
