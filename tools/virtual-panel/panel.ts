/**
 * The virtual panel: DeviceSim (web/src/lib/guide/deviceSim.ts) behind the
 * ports a Patternflow answers on, so the contract vectors have a device to
 * replay against (docs/rfc-cleanup.md §2.6). A test fixture: no Wi-Fi, no
 * flashing, no hotspot.
 *
 * A transport is a file in transports/ whose default export is a Transport.
 * start() attaches the core's (REST) always and a feature's when the caller
 * names the feature. A transport gets what attach() is handed and nothing
 * else, so a new one is a new file and this one stays as it is.
 */
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { DeviceSim, type SimPack } from "@/lib/guide/deviceSim";
import { PANEL_H, PANEL_W, type PanelOverlay } from "@/lib/guide/panelScreens";
import type { PatternRuntime } from "@/lib/pattern/harness";
import { KNOB_COUNT } from "@/lib/shared/constants";

import { serve, type Reply, type Routes } from "./http";
import { png } from "./png";

/** The frame's size, set here and nowhere else in the panel. */
const [WIDTH, HEIGHT] = [PANEL_W, PANEL_H];
/** One frame of panel time, the 60 fps the guide ticks DeviceSim at. */
const FRAME_MS = 1000 / 60;
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "transports");

export type Clock = {
  /** Milliseconds of panel time since start(). */
  now(): number;
  /** Runs fn once, ms of panel time from now. Returns what cancels it. */
  after(ms: number, fn: () => void): () => void;
  /** Runs fn every ms of panel time, the first time ms from now. Returns what stops it. */
  every(ms: number, fn: () => void): () => void;
};

/** What the panel tells its transports. Knobs count from 1, as every contract does. */
export type Events = {
  /** A hand turned a knob (/vp/turn). Nothing else is a hand. */
  turn: { knob: number; detents: number };
  button: { knob: number; down: boolean };
  /** The running pattern changed, whoever changed it. */
  pattern: { index: number; slug: string; name: string };
  sleep: { on: boolean };
};

export type Seam = {
  sim: DeviceSim;
  clock: Clock;
  routes: Routes;
  /** This build's caps: every attached transport's, in the order they attached. */
  caps: readonly string[];
  /** Adds fields to /api/status; status() is every field added. */
  addStatus(fields: () => Record<string, unknown>): void;
  status(): Record<string, unknown>;
  /** A port by name: the caller's number for it, or the firmware's. */
  port(name: string, firmware: number): number;
  /** The port a socket bound, for start() to answer with when 0 asked for any. */
  bound(name: string, port: number): void;
  on<E extends keyof Events>(event: E, fn: (e: Events[E]) => void): void;
  /** Runs at close(), the last added first. */
  onClose(fn: () => void | Promise<void>): void;
};

export type Transport = {
  /** The directory in firmware/patternflow/features/ that composes it in, or null for the core. */
  feature: string | null;
  caps: string[];
  attach(seam: Seam): void | Promise<void>;
};

export type Options = {
  /** Features by directory name; none is the default build. */
  features?: string[];
  /** Basics unless asked: Origin, then the pack's modules. */
  pack?: SimPack;
  /** Ports by name. "*" sets every port not named, and 0 binds any free one. */
  ports?: Record<string, number>;
  /** "real" runs with the wall clock; "manual" moves only on advance(). */
  clock?: "real" | "manual";
};

// DeviceSim keeps its runtime and its screens private, since the guide reads
// neither. The panel reads them through this cast, not by widening the class.
type Inside = { runtime: PatternRuntime; overlay(): PanelOverlay | null };

async function transports(features: string[]): Promise<Transport[]> {
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".ts")).sort() : [];
  const all: Transport[] = await Promise.all(files.map(async (f) => (await import(pathToFileURL(path.join(DIR, f)).href)).default));
  const missing = features.filter((f) => !all.some((t) => t.feature === f));
  if (missing.length) throw new Error(`no file in tools/virtual-panel/transports/ speaks for ${missing.join(", ")}`);
  return all.filter((t) => t.feature === null || features.includes(t.feature));
}

export async function start(options: Options = {}) {
  const attached = await transports(options.features ?? []);
  const sim = new DeviceSim();
  sim.setPack(options.pack ?? "basics");
  const events = new EventEmitter();
  const port = (name: string, firmware: number) => options.ports?.[name] ?? options.ports?.["*"] ?? firmware;
  const http = await serve(port("http", 80));
  const ports: Record<string, number> = { http: http.port };

  // What the pattern was given and the first thing it threw, read where DeviceSim hands them over.
  const given = { deltas: [0, 0, 0, 0], presses: [0, 0, 0, 0], values: [] as number[], held: [] as boolean[] };
  let error: string | null = null;
  const inside = sim as unknown as Inside;
  const { runtime } = inside;
  const [load, render] = [runtime.loadCode.bind(runtime), runtime.renderFrame.bind(runtime)];
  runtime.loadCode = (code) => {
    const result = load(code);
    error = result.error ?? null;
    return result;
  };
  runtime.renderFrame = (dt, time, input) => {
    const result = render(dt, time, input);
    input.knobDeltas.forEach((d, i) => (given.deltas[i] += d));
    input.btnPressed.forEach((p, i) => (given.presses[i] += Number(p)));
    [given.values, given.held] = [[...(input.knobValues ?? [])], [...input.btnHeld]];
    error ??= result.error ?? null;
    return result;
  };

  let now = 0;
  const timers = new Set<{ at: number; every: number; fn: () => void }>();
  const timer = (ms: number, every: number, fn: () => void) => {
    const t = { at: now + ms, every, fn };
    timers.add(t);
    return () => void timers.delete(t);
  };
  const clock: Clock = { now: () => now, after: (ms, fn) => timer(ms, 0, fn), every: (ms, fn) => timer(ms, Math.max(1, ms), fn) };
  const due = () => [...timers].filter((t) => t.at <= now).sort((a, b) => a.at - b.at)[0];

  let last = sim.consoleState();
  /** One frame, from now to `to`, and every timer it passes. */
  function step(to: number) {
    sim.tick((to - now) / 1000);
    now = to;
    for (let t = due(); t; t = due()) {
      if (t.every) t.at += t.every;
      else timers.delete(t);
      t.fn();
    }
    const s = sim.consoleState();
    if (s.patternSlug !== last.patternSlug) events.emit("pattern", { index: s.patternIndex, slug: s.patternSlug, name: s.patternName });
    if (s.sleeping !== last.sleeping) events.emit("sleep", { on: s.sleeping });
    last = s;
  }

  async function advance(ms: number) {
    if (options.clock !== "manual") throw new Error("advance() needs clock: manual");
    // Whatever the sockets already hold arrives before time moves.
    for (let i = 0; i < 3; i++) await new Promise<void>((done) => setImmediate(done));
    // A frame ends early where a timer is due, so the timer sees its own time.
    const end = now + ms;
    while (now < end) step(Math.min(end, now + FRAME_MS, ...[...timers].map((t) => Math.max(t.at, now))));
  }

  const state = () => {
    const [s, shown] = [sim.consoleState(), inside.overlay()];
    const { mode, patternCount } = sim.snapshot();
    const pattern = { index: s.patternIndex, slug: s.patternSlug, name: s.patternName, count: patternCount };
    return { now, mode, pattern, level: s.level, given, banner: shown?.kind === "content" ? shown.name : null, error };
  };
  const bad = (why: string): Reply => ({ status: 400, headers: { "Content-Type": "text/plain" }, body: why });
  const knobIn = (args: URLSearchParams) => {
    const k = Number(args.get("knob"));
    return Number.isInteger(k) && k >= 1 && k <= KNOB_COUNT ? k : 0;
  };
  http.routes("GET", "/frame.png", () => ({ headers: { "Content-Type": "image/png", "Cache-Control": "no-store" }, body: png(sim.frame, WIDTH, HEIGHT) }));
  http.routes("*", "/vp/state", () => ({ body: state() }));
  http.routes("*", "/vp/turn", ({ args }) => {
    const [knob, detents] = [knobIn(args), Number(args.get("detents"))];
    if (!knob || !Number.isInteger(detents) || !detents) return bad("knob is 1 to 4, detents a whole number other than 0");
    sim.turn(knob - 1, detents);
    events.emit("turn", { knob, detents });
    return { body: state() };
  });
  for (const down of [true, false]) {
    http.routes("*", down ? "/vp/press" : "/vp/release", ({ args }) => {
      const knob = knobIn(args);
      if (!knob) return bad("knob is 1 to 4");
      if (down) sim.press(knob - 1);
      else sim.release(knob - 1);
      events.emit("button", { knob, down });
      return { body: state() };
    });
  }
  http.routes("*", "/vp/advance", async ({ args }) => {
    const ms = Number(args.get("ms"));
    if (options.clock !== "manual") return { status: 409, headers: { "Content-Type": "text/plain" }, body: "the clock is real" };
    if (!(ms >= 0)) return bad("ms is 0 or more");
    await advance(ms);
    return { body: state() };
  });

  const [fields, closers] = [[] as (() => Record<string, unknown>)[], [] as (() => void | Promise<void>)[]];
  const seam: Seam = {
    sim,
    clock,
    routes: http.routes,
    caps: attached.flatMap((t) => t.caps),
    addStatus: (f) => void fields.push(f),
    status: () => Object.assign({}, ...fields.map((f) => f())),
    port,
    bound: (name, n) => void (ports[name] = n),
    on: (event, fn) => void events.on(event, fn),
    onClose: (fn) => void closers.unshift(fn),
  };
  try {
    for (const t of attached) await t.attach(seam);
  } catch (e) {
    for (const fn of closers) await fn();
    await http.close();
    throw e;
  }

  let wall = performance.now();
  const ticker =
    options.clock === "manual"
      ? undefined
      : setInterval(() => {
          const t = performance.now();
          step(now + Math.min(t - wall, 100));
          wall = t;
        }, FRAME_MS);

  return {
    /** Each port as bound, "http" and whatever the transports bound. */
    ports,
    advance,
    async close() {
      clearInterval(ticker);
      for (const fn of closers) await fn();
      await http.close();
    },
  };
}
