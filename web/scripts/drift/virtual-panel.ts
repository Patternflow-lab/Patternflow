/**
 * check:virtual-panel: the virtual panel runs every preset in
 * firmware/patternflow/presets/ without a thrown error, the half of step 4's
 * "done when" that no vector suite covers (docs/rfc-cleanup.md §2.6).
 *
 * The presets are the headers there, less the FIRMWARE_ONLY check_presets.py
 * names, and each has to be on the list GET /api/patterns gives on the
 * default build with the Basics pack. A preset compiled in is listed by the
 * NAME in its header. A module is listed by its slug, which basics.json keys
 * on its web twin's num, the link check:presets reads. Each listed preset then
 * gets a panel of its own: select it over REST, two seconds of panel time, a
 * 128×64 PNG from /frame.png and no error in /vp/state. Everything goes
 * through the panel's HTTP port.
 */
import zlib from "node:zlib";

import { PANEL_GEOM_DEFAULT, PANEL_GEOMETRIES } from "@/lib/shared/constants";

import { start } from "../../../tools/virtual-panel/panel";
import { compare, done, read, tracked } from "./_lib";

const HEADERS = "firmware/patternflow/presets/";
const WEB = "web/src/lib/presets/";
const TWINS = "firmware/toolchain/check_presets.py";
const PACK = "web/public/packs/basics.json";
const { resW: WIDTH, resH: HEIGHT } = PANEL_GEOMETRIES[PANEL_GEOM_DEFAULT];
const RUN_MS = 2000;

type Listed = { index: number; name: string; module: string | null };
type State = { mode: string; pattern: { index: number }; error: string | null };

const firmwareOnly = read(TWINS).match(/^FIRMWARE_ONLY\s*=\s*\{([^}]*)\}/m)?.[1];
if (firmwareOnly === undefined) throw new Error(`${TWINS} has no FIRMWARE_ONLY = {...}`);
const skipped = new Set([...firmwareOnly.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
console.log(`firmware-only, by ${TWINS}: ${[...skipped].sort().join(", ")}`);
const headers = tracked(HEADERS)
  .map((f) => f.slice(HEADERS.length).match(/^preset_([^/]+)\.h$/)?.[1])
  .filter((x): x is string => x !== undefined && !skipped.has(x));

// What the panel lists a header under: its NAME for a preset, its num for a module.
const byName = new Map<string, string>();
const byNum = new Map<number, string>();
for (const h of headers) {
  const name = read(`${HEADERS}preset_${h}.h`).match(/^\s*const char\* NAME = "([^"]*)";/m)?.[1];
  if (name !== undefined) byName.set(name, h);
  const twin = `${WEB}pattern-${h.replace(/_/g, "-")}.ts`;
  const num = tracked(twin).length ? read(twin).match(/^\s*num:\s*([0-9.]+)/m)?.[1] : undefined;
  if (num) byNum.set(Number(num), h);
}
const { presets: nums } = JSON.parse(read(PACK)) as { presets: Record<string, number> };
const header = (p: Listed) =>
  p.module === null ? (byName.get(p.name) ?? `${p.name} (no header has this NAME)`) : (byNum.get(nums[p.module]) ?? `${p.module} (no header by num)`);

async function panel<T>(use: (get: (path: string) => Promise<Response>) => Promise<T>): Promise<T> {
  const { ports, close } = await start({ clock: "manual", ports: { "*": 0 } });
  try {
    return await use((path) => fetch(`http://127.0.0.1:${ports.http}${path}`));
  } finally {
    await close();
  }
}
const json = async <T>(r: Response | Promise<Response>) => (await r).json() as Promise<T>;

/** Width, height and lit pixels of an 8-bit RGB PNG with unfiltered rows, the one tools/virtual-panel/png.ts writes. */
function readPng(file: Buffer) {
  if (file.toString("latin1", 1, 4) !== "PNG" || file.toString("latin1", 12, 16) !== "IHDR") throw new Error("not a PNG");
  const [width, height] = [file.readUInt32BE(16), file.readUInt32BE(20)];
  if (file[24] !== 8 || file[25] !== 2) throw new Error(`bit depth ${file[24]}, colour type ${file[25]}, not 8-bit RGB`);
  const idat: Buffer[] = [];
  for (let at = 8; at < file.length; at += 12 + file.readUInt32BE(at))
    if (file.toString("latin1", at + 4, at + 8) === "IDAT") idat.push(file.subarray(at + 8, at + 8 + file.readUInt32BE(at)));
  const rows = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 3 + 1;
  if (rows.length !== stride * height) throw new Error(`${rows.length} bytes of rows for ${width}×${height}`);
  let lit = 0;
  for (let y = 0; y < height; y++) {
    if (rows[y * stride]) throw new Error(`row ${y} is filtered`);
    for (let x = 0; x < width; x++) lit += Number(rows.subarray(y * stride + 1 + x * 3, y * stride + 4 + x * 3).some(Boolean));
  }
  return { width, height, lit };
}

async function main() {
  const listed = await panel(async (get) => (await json<{ patterns: Listed[] }>(get("/api/patterns"))).patterns);
  compare("headers against the panel's list", { label: HEADERS, items: headers }, { label: "GET /api/patterns", items: listed.map(header) });

  const ran: string[] = [];
  for (const p of listed) {
    const h = header(p);
    const why = await panel(async (get) => {
      const picked = await get(`/api/patterns/select?index=${p.index}`);
      if (!picked.ok) return `select answered ${picked.status}`;
      const state = await json<State>(get(`/vp/advance?ms=${RUN_MS}`));
      if (state.pattern.index !== p.index) return `running index ${state.pattern.index}, not ${p.index}`;
      if (state.mode !== "run") return `the panel is in ${state.mode}`;
      if (state.error !== null) return `threw: ${state.error.split("\n")[0]}`;
      const frame = await get("/frame.png");
      if (frame.headers.get("content-type") !== "image/png") return `/frame.png is ${frame.headers.get("content-type")}`;
      const png = readPng(Buffer.from(await frame.arrayBuffer()));
      if (png.width !== WIDTH || png.height !== HEIGHT) return `/frame.png is ${png.width}×${png.height}`;
      console.log(`  ${p.index} ${h}: ${RUN_MS} ms, ${png.width}×${png.height}, ${png.lit} lit`);
      return null;
    }).catch((e: Error) => e.message);
    if (why) console.log(`  ${p.index} ${h}: ${why}`);
    else ran.push(h);
  }
  compare(
    "presets that run",
    { label: "on the panel's list", items: listed.map(header) },
    { label: `${RUN_MS} ms, ${WIDTH}×${HEIGHT}, no error`, items: ran },
  );
  done();
}
void main();
