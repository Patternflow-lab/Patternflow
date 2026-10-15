/**
 * docs/rest-api.md "Patterns": the list, select, and a module's files. The volume holds the Basics pack as
 * basics.zip carries it. Installing, deleting and formatting are not here (step 4 plan, D11).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

import type { SimPattern } from "@/lib/guide/deviceSim";
import type { PatternRuntime } from "@/lib/pattern/harness";
import { BASICS_PACK, packZipPath } from "@/lib/pattern/packs";

import type { Reply } from "../http";
import type { Transport } from "../panel";

const ZIP = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../web/public", packZipPath(BASICS_PACK));
const PRESETS = 1; // Origin, the one preset left (rest-api.md "Patterns")
const FS_TOTAL = 10_240_000; // FFat.totalBytes() of the ffat partition, off a real panel (console_demo.py)
const RIPE_MS = 2000; // how long a pattern runs before leaving it takes its picture (THUMB_MIN_RUN_MS, patternflow.ino)
const CORS = { "Access-Control-Allow-Origin": "*" };

// DeviceSim keeps its list, the canvas and load() private, since the guide reads none of them.
type Inside = { patterns: SimPattern[]; active: number; runtime: PatternRuntime; load(index: number): void };

/** Each file in a zip by name, inflated with Node's zlib. */
function unzip(zip: Buffer) {
  const files = new Map<string, Buffer>();
  const end = zip.lastIndexOf(Buffer.from("PK\x05\x06", "latin1"));
  for (let at = zip.readUInt32LE(end + 16), n = zip.readUInt16LE(end + 10); n > 0; n--) {
    const [method, size, nameLength, local] = [zip.readUInt16LE(at + 10), zip.readUInt32LE(at + 20), zip.readUInt16LE(at + 28), zip.readUInt32LE(at + 42)];
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + size);
    files.set(zip.toString("utf8", at + 46, at + 46 + nameLength), method === 8 ? zlib.inflateRawSync(data) : data);
    at += 46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
  }
  return files;
}
const PACK = unzip(fs.readFileSync(ZIP));

/** The canvas as a .thumb: "PFT1", width and height as little-endian u16, then RGB565 pixels, little-endian as the ESP32 writes them. */
function thumb({ width, height, data }: PatternRuntime) {
  const out = Buffer.alloc(8 + width * height * 2);
  out.write("PFT1", "latin1");
  out.writeUInt16LE(width, 4);
  out.writeUInt16LE(height, 6);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b] = [0, 1, 2].map((c) => (data[i * 4 + c] * data[i * 4 + 3]) / 255);
    out.writeUInt16LE(((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3), 8 + i * 2);
  }
  return out;
}

const transport: Transport = {
  feature: null,
  caps: ["patterns"],
  attach({ sim, clock, routes }) {
    const inside = sim as unknown as Inside;
    const list = () => inside.patterns.map((p, index) => ({ index, name: p.name, module: index < PRESETS ? null : p.slug }));
    const modules = () => inside.patterns.slice(PRESETS).map((p) => p.slug);

    // Whatever loads in a pattern's place, the canvas still holds the last frame it drew (snapshotActiveIfRipe, patternflow.ino).
    const thumbs = new Map<string, Buffer>();
    let since = clock.now();
    const load = inside.load.bind(sim);
    inside.load = (index) => {
      const left = inside.patterns[inside.active];
      if (left && clock.now() - since >= RIPE_MS) thumbs.set(left.slug, thumb(inside.runtime));
      since = clock.now();
      load(index);
    };

    const cluster = (bytes = 0) => Math.ceil(bytes / 4096) * 4096;
    const used = () => [...modules().flatMap((s) => [PACK.get(`${s}.pfm`), PACK.get(`${s}.json`)]), ...thumbs.values()].reduce((n, f) => n + cluster(f?.length), 0);
    routes("GET", "/api/patterns", () => ({
      body: { active: sim.consoleState().patternIndex, presets: PRESETS, mounted: true, free: FS_TOTAL - used(), patterns: list(), pendingRev: 0, pending: [] },
    }));

    // step, then index, then name, the order the firmware reads them in. No pattern here is hidden from step.
    const whole = (arg: string | null) => (arg !== null && /^\s*[+-]?\d+\s*$/.test(arg) ? Number(arg) : -1);
    routes("GET", "/api/patterns/select", ({ args }) => {
      const [all, at] = [list(), sim.consoleState().patternIndex];
      const step = parseInt(args.get("step") ?? "", 10) < 0 ? -1 : 1;
      const pick = args.has("step") ? (at + step + all.length) % all.length : args.has("index") ? whole(args.get("index")) : all.findIndex((p) => p.name === args.get("name"));
      if (!all[pick]) return { status: 404, headers: CORS, body: { ok: false, error: "no such pattern" } };
      // The panel takes the switch on its next frame, as loop() does.
      const slug = inside.patterns[pick].slug;
      clock.after(0, () => void sim.selectPattern(slug));
      return { headers: CORS, body: { ok: true, index: pick, name: all[pick].name } };
    });

    const fail = (status: number, error: string): Reply => ({ status, body: { ok: false, error } });
    routes("GET", "/api/patterns/file", ({ args }) => {
      // The slug is cut down the way an upload's file name is (slugFromFilename, core_patterns_http.h).
      const raw = args.get("slug");
      if (raw === null) return fail(400, "missing slug");
      const base = `${raw}.pfm`.split(/[/\\]/).pop() ?? "";
      const slug = base.slice(0, base.lastIndexOf(".") > 0 ? base.lastIndexOf(".") : undefined).replace(/[^\w-]/g, "").slice(0, 39);
      if (!slug) return fail(400, "invalid slug");
      const ext = (args.get("ext") ?? "pfm").toLowerCase();
      if (!["pfm", "json", "thumb"].includes(ext)) return fail(400, "ext must be pfm, json or thumb");
      const body = ext === "thumb" ? thumbs.get(slug) : modules().includes(slug) ? PACK.get(`${slug}.${ext}`) : undefined;
      if (!body) return fail(404, "not found");
      const type = ext === "json" ? "application/json" : "application/octet-stream";
      return { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${slug}.${ext}"`, "Cache-Control": "no-store" }, body };
    });
  },
};
export default transport;
