/**
 * check:presets: how a web preset reaches a panel. Each pattern is a file in
 * web/src/lib/presets/ that index.ts imports, so a file it does not import
 * never shows on the site, and an import with no file is a preset that is
 * gone. A preset with a firmware twin then gets onto a board one of two ways:
 * pattern_registry.h compiles it in (Origin, the failsafe), or it ships in the
 * Basics pack, whose basics.json keys each module on its twin's pattern
 * number, the num make_pack.py reads out of the web file. A twin in neither,
 * or a pack entry whose number no web preset has, is drift. A twin compiled
 * in and packed too is on the panel twice, and shows as one extra.
 *
 * Which presets have no twin on purpose is check_presets.py's to say, in
 * WEB_ONLY and FIRMWARE_ONLY, with a reason for each. The two sets are read
 * out of that file, not copied here. Whether the twins are in step with each
 * other stays its job; firmware-checks.yml runs it.
 */
import ts from "typescript";

import { compare, done, read, tracked } from "./_lib";

const WEB = "web/src/lib/presets/";
const INDEX = `${WEB}index.ts`;
const TWINS = "firmware/toolchain/check_presets.py";
const REGISTRY = "firmware/patternflow/pattern_registry.h";
const PACK = "web/public/packs/basics.json";

// The web spells a slug with dashes and firmware with underscores. Both are
// compared in the firmware spelling, the one check_presets.py lists.
const slug = (s: string) => s.replace(/-/g, "_");

/** One of check_presets.py's set literals, NAME = {"0516", ...}. */
function pySet(name: string): Set<string> {
  const m = read(TWINS).match(new RegExp(`^${name}\\s*=\\s*\\{([^}]*)\\}`, "m"));
  if (!m) throw new Error(`${TWINS} has no ${name} = {...}`);
  return new Set([...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
}
const webOnly = pySet("WEB_ONLY");
const firmwareOnly = pySet("FIRMWARE_ONLY");
console.log(`web-only, by ${TWINS}: ${[...webOnly].sort().join(", ")}`);
console.log(`firmware-only, by ${TWINS}: ${[...firmwareOnly].sort().join(", ")}`);

const files = tracked(WEB)
  .map((f) => f.slice(WEB.length).match(/^pattern-([^/]+)\.ts$/)?.[1])
  .filter((x): x is string => x !== undefined);
const index = ts.createSourceFile(INDEX, read(INDEX), ts.ScriptTarget.Latest);
const imports = index.statements
  .filter(ts.isImportDeclaration)
  .map((s) => (ts.isStringLiteral(s.moduleSpecifier) ? s.moduleSpecifier.text.match(/^\.\/pattern-(.+)$/)?.[1] : undefined))
  .filter((x): x is string => x !== undefined);
compare("files against index.ts", { label: `${WEB}pattern-*.ts`, items: files.map(slug) }, { label: `${INDEX} imports`, items: imports.map(slug) });

// The pack's link back to a web preset, read the way make_pack.py reads it.
const byNum = new Map<number, string>();
for (const f of files) {
  const num = read(`${WEB}pattern-${f}.ts`).match(/^\s*num:\s*([0-9.]+)/m)?.[1];
  if (num) byNum.set(Number(num), slug(f));
}
const compiled = [...read(REGISTRY).matchAll(/^\s*#include\s+"presets\/preset_([^"]+)\.h"/gm)].map((m) => m[1]);
const { presets } = JSON.parse(read(PACK)) as { presets?: Record<string, number> };
if (!presets) throw new Error(`${PACK} has no "presets"`);
const packed = Object.entries(presets).map(([module, num]) => byNum.get(num) ?? `${module} (num ${num}, no web preset)`);
console.log(`compiled in by ${REGISTRY}: ${compiled.join(", ")}`);
console.log(`in ${PACK} by number: ${packed.length}`);
compare(
  "twins against what reaches a panel",
  { label: "web presets with a firmware twin", items: files.map(slug).filter((x) => !webOnly.has(x)) },
  { label: `${REGISTRY} and ${PACK}`, items: [...compiled.filter((x) => !firmwareOnly.has(x)), ...packed] },
);
done();
