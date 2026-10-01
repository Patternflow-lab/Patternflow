// The Build guide's parts list is the BOM itself: hardware/bom/bom_v3.9.csv,
// the source of truth the build guide's tables are kept in step with
// (AGENTS.md, hard rule 2). The page reads the file when it is built
// (bom.server.ts) and hands its rows to the cards (BomContext); nothing here
// keeps a copy of a part, a reference or a quantity. If the file can't be
// read, the card links to it instead.
//
// What a card shows of a line is little — quantity, part, reference — with
// the spec and the part number behind it; the file's long notes are not put
// on the page at all. The card links the file, and BUILD_GUIDE §1.

export const BOM_FILE = "hardware/bom/bom_v3.9.csv";
export const BOM_URL = `https://github.com/engmung/Patternflow/blob/main/${BOM_FILE}`;

/** One line of the CSV, by its own column names. */
export type BomRow = {
  category: "pcb" | "off-board";
  /** The board's reference ("SW1-SW4", "U1 (sockets)"), or "-" for a part with none. */
  ref: string;
  /** Per unit: "1", "4", "6-12". */
  qty: string;
  part: string;
  spec: string;
  mounting: string;
  mpn: string;
  manufacturer: string;
  source: string;
  optional: string;
  notes: string;
};

const COLUMNS = ["category", "ref", "qty", "part", "spec", "mounting", "mpn", "manufacturer", "source", "optional", "notes"] as const;

/** RFC 4180 records: quoted fields may hold commas, newlines and "" for a quote. */
function records(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) out.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) out.push(row);
  return out;
}

/**
 * The CSV's rows, keyed by its header. Throws on a file whose header is not
 * the one this page was written for: a renamed column should break the
 * build, not quietly blank a card.
 */
export function parseBom(text: string): BomRow[] {
  const [head, ...rows] = records(text.replace(/^﻿/, ""));
  const missing = COLUMNS.filter((c) => !head?.includes(c));
  if (missing.length) throw new Error(`${BOM_FILE}: no column ${missing.join(", ")}`);
  return rows.map((r) => {
    const row = Object.fromEntries(COLUMNS.map((c) => [c, (r[head.indexOf(c)] ?? "").trim()])) as Record<(typeof COLUMNS)[number], string>;
    if (row.category !== "pcb" && row.category !== "off-board") throw new Error(`${BOM_FILE}: unknown category "${row.category}"`);
    return row as BomRow;
  });
}

/**
 * The key a card's words for a row go by: the reference on the board, or —
 * for a part with none ("-") — its name.
 */
export function bomKey(row: Pick<BomRow, "ref" | "part">): string {
  return row.ref === "-" ? row.part : row.ref;
}

/** "SW1-SW4" → "SW1–SW4", "6-12" → "6–12": ranges set with an en dash. */
export function dashed(s: string): string {
  return s.replace(/(\w)-(\w)/g, "$1–$2");
}

/** "128x64 px" → "128×64 px", "D10xL13" → "D10×L13": sizes set with a multiplication sign. */
export function times(s: string): string {
  return s.replace(/(\d)x(?=[\dA-Z])/g, "$1×");
}

/**
 * The one line whose card says more than a few words: the LED panel, bought
 * by its listing rather than a part number (BuildCards.tsx; build.test.ts
 * checks the file has exactly one such line).
 */
export const PANEL_PART = "LED matrix panel";
