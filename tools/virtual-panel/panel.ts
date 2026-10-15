/**
 * DeviceSim (web/src/lib/guide/deviceSim.ts) behind the ports a Patternflow answers on. Each file in
 * transports/ default-exports a Transport, so a new one never edits this file (README.md).
 */
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { DeviceSim, type SimPack } from "@/lib/guide/deviceSim";
import { PANEL_H, PANEL_W, type PanelOverlay } from "@/lib/guide/panelScreens";
import { KNOB_COUNT } from "@/lib/shared/constants";

import { serve, type Reply, type Routes } from "./http";
import { png } from "./png";

const [WIDTH, HEIGHT] = [PANEL_W, PANEL_H]; // the frame's size, here and nowhere else
const FRAME_MS = 1000 / 60; // the 60 fps the guide ticks DeviceSim at
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "transports");

/** Panel time in ms since start(). after() and every() return what stops them. */
export type Clock = { now(): number; after(ms: number, fn: () => void): () => void; every(ms: number, fn: () => void): () => void };
/** Knobs count from 1, as in the contracts. A turn or a button is a hand on /vp/; a pattern change is anyone's. */
export type Events = {
  turn: { knob: number; detents: number };
  button: { knob: number; down: boolean };
  pattern: { index: number; slug: string; name: string };
  sleep: { on: boolean };
};
/** What attach() is handed. caps is every attached transport's, in order. */
export type Seam = {
  sim: DeviceSim;
  clock: Clock;
  routes: Routes;
  caps: readonly string[];
  /** Fields each transport adds to /api/status. */
  status: (() => Record<string, unknown>)[];
  /** The caller's number for a port, or else the firmware's; bound is each port as bound, for start() to answer with. */
  port(name: string, firmware: number): number;
  bound: Record<string, number>;
  on<E extends keyof Events>(event: E, fn: (e: Events[E]) => void): void;
  onClose(fn: () => void | Promise<void>): void;
};
/** feature is its directory in firmware/patternflow/features/, or null for the core. */
export type Transport = { feature: string | null; caps: string[]; attach(seam: Seam): void | Promise<void> };
/** No features is the default build. Ports go by name, "*" for the rest, 0 for any free one. */
export type Options = { features?: string[]; pack?: SimPack; ports?: Record<string, number>; clock?: "real" | "manual" };
// DeviceSim keeps the screen it draws over a pattern private, since the guide never reads it.
type Inside = { overlay(): PanelOverlay | null };

export async function start(options: Options = {}) {
  const features = options.features ?? [];
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".ts")).sort() : [];
  const all: Transport[] = await Promise.all(files.map(async (f) => (await import(pathToFileURL(path.join(DIR, f)).href)).default));
  const missing = features.filter((f) => !all.some((t) => t.feature === f));
  if (missing.length) throw new Error(`no file in tools/virtual-panel/transports/ speaks for ${missing.join(", ")}`);
  const attached = all.filter((t) => t.feature === null || features.includes(t.feature));
  const [sim, events, manual] = [new DeviceSim(), new EventEmitter(), options.clock === "manual"];
  sim.setPack(options.pack ?? "basics");
  const port = (name: string, firmware: number) => options.ports?.[name] ?? options.ports?.["*"] ?? firmware;
  const http = await serve(port("http", 80));
  const ports: Record<string, number> = { http: http.port };

  // What the pattern has been given since start, and the first error the running one threw.
  const zeros = () => Array<number>(KNOB_COUNT).fill(0);
  const given = { deltas: zeros(), presses: zeros(), values: [] as number[], held: [] as boolean[] };
  let error: string | null = null;
  const inside = sim as unknown as Inside;

  let [now, last] = [0, sim.consoleState()];
  const timers = new Set<{ at: number; every: number; fn: () => void }>();
  const timer = (ms: number, every: number, fn: () => void) => {
    const t = { at: now + ms, every, fn };
    timers.add(t);
    return () => void timers.delete(t);
  };
  const clock: Clock = { now: () => now, after: (ms, fn) => timer(ms, 0, fn), every: (ms, fn) => timer(ms, Math.max(1, ms), fn) };
  const due = () => [...timers].filter((t) => t.at <= now).sort((a, b) => a.at - b.at)[0];
  const step = (to: number) => {
    sim.tick((to - now) / 1000);
    now = to;
    const frame = sim.given(); // null while the panel is dark
    if (sim.consoleState().patternSlug !== last.patternSlug) error = null;
    if (frame) {
      frame.input.knobDeltas.forEach((d, i) => (given.deltas[i] += d));
      frame.input.btnPressed.forEach((p, i) => (given.presses[i] += Number(p)));
      [given.values, given.held] = [[...(frame.input.knobValues ?? [])], [...frame.input.btnHeld]];
      error ??= frame.error;
    }
    for (let t = due(); t; t = due()) {
      if (t.every) t.at += t.every;
      else timers.delete(t);
      t.fn();
    }
    const s = sim.consoleState();
    if (s.patternSlug !== last.patternSlug) events.emit("pattern", { index: s.patternIndex, slug: s.patternSlug, name: s.patternName });
    if (s.sleeping !== last.sleeping) events.emit("sleep", { on: s.sleeping });
    last = s;
  };
  async function advance(ms: number) {
    if (!manual) throw new Error("advance() needs clock: manual");
    for (let i = 0; i < 3; i++) await new Promise<void>((done) => setImmediate(done)); // what the sockets hold arrives first
    // A frame ends early where a timer is due, so each timer runs at its own time.
    const end = now + ms;
    while (now < end) step(Math.min(end, now + FRAME_MS, ...[...timers].map((t) => Math.max(t.at, now))));
  }

  const state = () => {
    const [s, { mode, patternCount: count }, shown] = [sim.consoleState(), sim.snapshot(), inside.overlay()];
    const pattern = { index: s.patternIndex, slug: s.patternSlug, name: s.patternName, count };
    return { now, mode, pattern, level: s.level, given, banner: shown?.kind === "content" ? shown.name : null, error };
  };
  const text = (status: number, body: string): Reply => ({ status, headers: { "Content-Type": "text/plain" }, body });
  const knobIn = (args: URLSearchParams) => [Number(args.get("knob"))].find((k) => Number.isInteger(k) && k >= 1 && k <= KNOB_COUNT);
  http.routes("GET", "/frame.png", () => ({ headers: { "Content-Type": "image/png", "Cache-Control": "no-store" }, body: png(sim.frame, WIDTH, HEIGHT) }));
  http.routes("*", "/vp/state", () => ({ body: state() }));
  http.routes("*", "/vp/turn", ({ args }) => {
    const [knob, detents] = [knobIn(args), Number(args.get("detents"))];
    if (!knob || !Number.isInteger(detents) || !detents) return text(400, "knob is 1 to 4, detents a whole number other than 0");
    sim.turn(knob - 1, detents);
    events.emit("turn", { knob, detents });
    return { body: state() };
  });
  http.routes("*", "/vp/button", ({ args }) => {
    const [knob, down] = [knobIn(args), args.get("down")];
    if (!knob || (down !== "1" && down !== "0")) return text(400, "knob is 1 to 4, down 1 or 0");
    if (down === "1") sim.press(knob - 1);
    else sim.release(knob - 1);
    events.emit("button", { knob, down: down === "1" });
    return { body: state() };
  });
  http.routes("*", "/vp/advance", async ({ args }) => {
    const ms = Number(args.get("ms"));
    if (!manual) return text(409, "the clock is real");
    if (!(ms >= 0)) return text(400, "ms is 0 or more");
    await advance(ms);
    return { body: state() };
  });

  const closers: (() => void | Promise<void>)[] = [];
  let ticker: NodeJS.Timeout | undefined;
  const close = async () => {
    clearInterval(ticker);
    for (const fn of closers) await fn();
    await http.close();
  };
  const seam: Seam = {
    ...{ sim, clock, routes: http.routes, port, bound: ports, status: [] },
    caps: attached.flatMap((t) => t.caps),
    on: (event, fn) => void events.on(event, fn),
    onClose: (fn) => void closers.unshift(fn),
  };
  try {
    for (const t of attached) await t.attach(seam);
  } catch (e) {
    await close();
    throw e;
  }
  // The real clock follows the wall, at most 100 ms a frame, the most DeviceSim.tick() takes at once.
  const t0 = performance.now();
  if (!manual) ticker = setInterval(() => step(Math.min(performance.now() - t0, now + 100)), FRAME_MS);
  return { ports, advance, close };
}
