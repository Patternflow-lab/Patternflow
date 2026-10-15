/**
 * check:bom: the BOM against the two parts tables in section 1 of
 * BUILD_GUIDE.md. Hard rule 2 derives the guide's tables from the BOM, so a
 * designator, a part or a quantity on one side only is drift.
 *
 * On the board a row is its designators, its quantity and its MPN. The names
 * are worded apart ("Rotary encoder w/ switch" for "Rotary encoder with push
 * switch") and are not compared. The sockets row has no designator: the BOM
 * writes "U1 (sockets)" and the guide "—". Off the board there is neither, so
 * the rows pair in order, and the guide's part keeps every word of the BOM's:
 * "Sacrificial USB cable (it gets cut)" for "USB cable (sacrificial)". A
 * hyphen and an en dash are the same in a quantity, so 6-12 is 6–12.
 */
import { BOM, bom, designators, type Row } from "./_bom";
import { compare, done, read } from "./_lib";

const GUIDE = "BUILD_GUIDE.md";

// Bold, code, emphasis and link targets out; a link keeps its text.
const plain = (s: string) =>
  s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*`]/g, "")
    .trim();
const dashes = (s: string) => s.replace(/[–—]/g, "-");

/** The first table under a heading of the guide, each row keyed by the table's header line. */
function table(heading: string, columns: string[]): Row[] {
  const lines = read(GUIDE).split("\n");
  const at = lines.findIndex((l) => l.trim() === heading);
  if (at < 0) throw new Error(`${GUIDE} has no "${heading}"`);
  const rows: string[][] = [];
  for (const line of lines.slice(at + 1)) {
    if (line.startsWith("|")) rows.push(line.trim().replace(/^\||\|$/g, "").split("|").map(plain));
    else if (rows.length || line.startsWith("#")) break;
  }
  const [head, ...body] = rows.filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
  for (const c of columns) if (!head?.includes(c)) throw new Error(`${GUIDE}, ${heading}: no "${c}" column`);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const rows = bom();

// On the board: designators, quantity, MPN. The guide's MPN cell ends in the maker, "(Bourns)".
const ref = (cell: string) => {
  const d = designators(dashes(cell));
  return d.length > 1 ? `${d[0]}-${d[d.length - 1]}` : (d[0] ?? "—");
};
const part = (r: string, qty: string, mpn: string) => `${ref(r)}: ${dashes(qty)} × ${mpn}`;
compare(
  "on the board",
  { label: BOM, items: rows.filter((r) => r.category === "pcb").map((r) => part(r.ref, r.qty, r.mpn)) },
  {
    label: GUIDE,
    items: table("### On the board", ["Ref", "Qty", "MPN (Manufacturer)"]).map((g) =>
      part(g.Ref, g.Qty, g["MPN (Manufacturer)"].replace(/\s*\([^)]*\)$/, "")),
    ),
  },
);

// Off the board: quantity and part, in order. A guide row is named as the BOM's
// row in its place when it holds every word of that row's part.
const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const off = rows.filter((r) => r.category === "off-board");
console.log("off the board, rows pair in order, and a guide row with every word of its BOM row's part takes that name");
compare(
  "off the board",
  { label: BOM, items: off.map((r) => `${dashes(r.qty)} × ${r.part}`) },
  {
    label: GUIDE,
    items: table("### Off the board", ["Qty", "Part"]).map((g, i) => {
      const has = new Set(words(g.Part));
      const same = off[i] && words(off[i].part).every((w) => has.has(w));
      return `${dashes(g.Qty)} × ${same ? off[i].part : g.Part}`;
    }),
  },
);
done();
