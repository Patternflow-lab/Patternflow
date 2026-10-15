/**
 * check:bom-schematic: the BOM's designators against the schematic's.
 * hardware/pcb/schematic.pdf is KiCad output in stroke fonts, and pdftotext
 * (poppler) reads every designator out of its text layer all the same, so
 * this is strict from its first day.
 *
 * A token in the PDF is a designator when it has a designator's prefix: U,
 * SW, J and C are on the board, R, D, Q, L and F are what a part added later
 * would carry, and USB is what the v3.0 board's USB-C footprint was (hard
 * rule 6). Pin names (S1, IO4) and ESP32 carry none of them. Without
 * pdftotext this skips.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

import { BOM, bom, designators } from "./_bom";
import { ROOT, compare, done, skip } from "./_lib";

const PDF = "hardware/pcb/schematic.pdf";
const PREFIXES = ["U", "SW", "J", "C", "R", "D", "Q", "L", "F", "USB"];

let text: string | undefined;
try {
  text = execFileSync("pdftotext", ["-layout", path.join(ROOT, PDF), "-"], { encoding: "utf8" });
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  skip("designators", "pdftotext is not installed (poppler-utils)");
}
if (text !== undefined) {
  const token = new RegExp(`\\b(?:${PREFIXES.join("|")})\\d+\\b`, "g");
  compare(
    "designators",
    { label: BOM, items: bom().flatMap((r) => designators(r.ref)) },
    { label: PDF, items: new Set(text.match(token)) },
  );
}
done();
