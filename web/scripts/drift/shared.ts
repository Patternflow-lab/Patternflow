/**
 * check:shared: the two files gen:shared writes from shared/constants.json,
 * against what it writes now. A hand edit to core_shared.h or constants.ts
 * fails here, and so does a change to the JSON nobody regenerated.
 *
 * Two copies cannot be generated, so this reads them. abi/pf_params.h clamps
 * the bus to a literal 1000 and is frozen: installed modules read it without
 * recompiling. build_module.py names the panel's 128 and 64 itself, and the
 * module cache hashes it. The copies written for other readers, the REST
 * contract's 24 and the Ableton bridge's 48, stay by hand and are not read.
 */
import fs from "node:fs";
import path from "node:path";

import { render, SOURCE } from "../gen-shared";
import { compare, done, read, ROOT } from "./_lib";

let stale = 0;
for (const [file, want] of Object.entries(render())) {
  const have = fs.existsSync(path.join(ROOT, file)) ? read(file) : "";
  if (have === want) {
    console.log(`${file}: same as gen:shared writes`);
    continue;
  }
  stale++;
  console.log(`${file}: stale, run npm run gen:shared in web/`);
  const [a, b] = [want.split("\n"), have.split("\n")];
  const lines = [...Array(Math.max(a.length, b.length)).keys()].filter((i) => a[i] !== b[i]);
  for (const i of lines.slice(0, 10)) {
    console.log(`  line ${i + 1}, gen:shared writes: ${a[i] ?? "(no line)"}`);
    console.log(`  line ${i + 1}, the file has:      ${b[i] ?? "(no line)"}`);
  }
  if (lines.length > 10) console.log(`  and ${lines.length - 10} more lines`);
}

const data = JSON.parse(read(SOURCE));

const ABI = "firmware/patternflow/abi/pf_params.h";
const body = read(ABI)
  .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")
  .match(/\bunit1000\s*\([^)]*\)\s*\{([^}]*)\}/)?.[1];
if (body === undefined) console.log(`no unit1000() in ${ABI}`);
compare(
  "the bus maximum",
  { label: `${SOURCE} BUS_MAX`, items: [String(data.bus.BUS_MAX)] },
  { label: `the literals in unit1000(), ${ABI}`, items: new Set(body?.match(/\b\d+(\.\d+)?f?\b/g)?.map((n) => String(parseFloat(n)))) },
);

const BUILD = "firmware/toolchain/build_module.py";
const panel = data.panel.PANEL_GEOMETRIES[data.panel.PANEL_GEOM_DEFAULT];
compare(
  "the default panel's canvas",
  { label: `${SOURCE} ${data.panel.PANEL_GEOM_DEFAULT}`, items: [`PANEL_W ${panel.physW * panel.chain}`, `PANEL_H ${panel.physH}`] },
  { label: BUILD, items: [...read(BUILD).matchAll(/^(PANEL_[WH]) = (\d+)/gm)].map((m) => `${m[1]} ${m[2]}`) },
);

done();
if (stale) process.exitCode = 1;
