/**
 * CSV export (F15, inventory-notes §5 #30). The vendor columns are in `vendors.ts` (N5).
 *
 * Fields follow RFC 4180: quoted when they hold a comma, a quote or a line
 * break (or start or end with a space), with quotes doubled, and rows joined
 * with CRLF. A byte-order mark leads the file so Excel reads Chinese, Thai and
 * Arabic text as UTF-8.
 */

const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

export function csvCell(value: unknown, quoteAll = false): string {
  const text = value == null ? "" : String(value);
  return quoteAll || NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/** `quoteAll` puts every cell in quotes, as the vendor export does (guide §5.11, N5). */
export function toCsv<T>(
  columns: readonly CsvColumn<T>[],
  rows: readonly T[],
  { bom = true, quoteAll = false } = {},
): string {
  const lines = [
    columns.map((c) => csvCell(c.header, quoteAll)).join(","),
    ...rows.map((row) => columns.map((c) => csvCell(c.value(row), quoteAll)).join(",")),
  ];
  return (bom ? "﻿" : "") + lines.join("\r\n");
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** `vendors-greg-bella.csv`: the kind and the two names, in letters and digits only. */
export const exportFileName = (kind: string, names: readonly string[]) =>
  [slug(kind), ...names.map(slug)].filter(Boolean).join("-") + ".csv";
