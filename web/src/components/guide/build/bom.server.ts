import fs from "node:fs";
import path from "node:path";
import { BOM_FILE, parseBom, type BomRow } from "./bom";

// The BOM, read from the repository when the Build page is built (its routes
// are static). The site is web/; the CSV is beside it, at the repo root's
// hardware/bom/. A deployment that builds web/ without the rest of the
// repository gets null here, and the card links to the file on GitHub
// instead of showing the table. A file that is there but malformed throws:
// that should fail the build.

export function readBom(): BomRow[] | null {
  let text: string;
  try {
    text = fs.readFileSync(path.join(process.cwd(), "..", BOM_FILE), "utf8");
  } catch {
    return null;
  }
  return parseBom(text);
}
