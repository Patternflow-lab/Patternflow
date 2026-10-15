/**
 * The BOM as the drift checks read it. hardware/bom/bom_v3.9.csv is the
 * source of truth (hard rule 2 in AGENTS.md): check:bom holds it against the
 * build guide's parts tables, check:bom-schematic against the schematic PDF.
 */
import { read } from "./_lib";

export const BOM = "hardware/bom/bom_v3.9.csv";

export type Row = Record<string, string>;

// RFC 4180: a quoted cell may hold commas, line breaks and "" for a quote.
function parse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') cell += text[++i];
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === "\n") {
      row.push(cell);
      cell = "";
      if (c === "\n") {
        rows.push(row);
        row = [];
      }
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

/** The BOM's rows, each keyed by the CSV's header line. */
export function bom(): Row[] {
  const [head, ...rows] = parse(read(BOM));
  return rows.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

/**
 * The designators a ref cell names. "J1" is one, and "SW1-SW4" is four, with
 * a hyphen or an en dash. Any other cell names none: "-" off the board, the
 * guide's "—", and "U1 (sockets)", whose notes say it is not a refdes.
 */
export function designators(ref: string): string[] {
  const m = ref.trim().match(/^([A-Z]+)(\d+)(?:\s*[-–]\s*([A-Z]+)(\d+))?$/);
  if (!m) return [];
  const [, prefix, from, prefixTo, to] = m;
  if (!to) return [prefix + from];
  if (prefixTo !== prefix || +to <= +from) throw new Error(`${ref}: a range keeps one prefix and counts up`);
  return Array.from({ length: +to - +from + 1 }, (_, i) => `${prefix}${+from + i}`);
}
