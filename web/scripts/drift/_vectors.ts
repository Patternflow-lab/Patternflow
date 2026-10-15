/**
 * The replay the contract-vector suites share (docs/contract-vectors.md).
 *
 * replay() reads each .json in a vector folder and starts a fresh virtual
 * panel (tools/virtual-panel/) for it, on a manual clock and free ports. It
 * runs the vector's steps, then gives compare() what the vector expects
 * beside what the panel did. It reaches the panel only through its ports:
 * http, hand and wait go over HTTP, and a suite passes in a Sender for each
 * other kind it replays, kept in a _ file of its own. A vector whose `says`
 * is no longer in its spec fails, so a spec edit brings its vectors along.
 */
import fs from "node:fs";
import http from "node:http";

import { start } from "../../../tools/virtual-panel/panel";

import { compare, read, ROOT } from "./_lib";

/** What a suite's Sender opens for one vector. */
export type Channel = {
  /** Ports the panel starts with, over "*": 0, such as where its replies go. */
  ports?: Record<string, number>;
  /** Runs once the panel is up, before the first step. */
  open?(panel: Panel): Promise<void>;
  /** One step's send. What it returns is the step's reply. */
  send(what: unknown): Promise<unknown>;
  /** What the panel has sent on this kind, oldest first. The channel adds to it, and replay() times each. */
  heard: unknown[];
  /** Resolves once nothing is in flight. replay() waits on it after each send and each move of the clock. */
  settle?(): Promise<void>;
  close(): Promise<void>;
};
export type Sender = () => Promise<Channel>;
export type Panel = { ports: Record<string, number>; http(request: string, form?: string): Promise<Reply> };
export type Reply = { status: number; headers: Record<string, string>; body: unknown };

type Out = Record<string, unknown> & { after?: number; within?: number };
type Step = { send: Record<string, unknown>; expect?: { reply?: unknown; status?: unknown; input?: unknown; out?: Out[] } };
type Vector = { contract: string; says: string; features: string[]; steps: Step[] };

const OWN = ["http", "hand", "wait"];
const SENT = ["osc", "midi", "mqtt", "ws"]; // the kinds a suite brings, and the ones the panel can send on
const EXPECTS = ["reply", "status", "input", "out"];

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const TYPES: Record<string, (x: unknown) => boolean> = {
  "<absent>": (x) => x === undefined,
  "<any>": (x) => x !== undefined,
  "<number>": (x) => typeof x === "number",
  "<integer>": (x) => Number.isInteger(x),
  "<string>": (x) => typeof x === "string",
  "<boolean>": (x) => typeof x === "boolean",
  "<array>": (x) => Array.isArray(x),
  "<object>": isObject,
};
const isType = (x: unknown): x is string => typeof x === "string" && Object.hasOwn(TYPES, x);
const show = (x: unknown) => (x === undefined ? "<absent>" : isType(x) ? x : JSON.stringify(x));

/** Each place a shape names, as "where shape", and the value there: the same text where it fits, the value where not. */
function match(where: string, shape: unknown, value: unknown, want: string[], got: string[]) {
  if (Array.isArray(shape) && Array.isArray(value) && shape.length === value.length) {
    shape.forEach((s, i) => match(`${where}[${i}]`, s, value[i], want, got));
  } else if (isObject(shape) && isObject(value)) {
    for (const [key, s] of Object.entries(shape)) match(`${where}.${key}`, s, value[key], want, got);
  } else {
    want.push(`${where} ${show(shape)}`);
    got.push(`${where} ${show((isType(shape) ? TYPES[shape](value) : shape === value) ? shape : value)}`);
  }
}
function fits(shape: unknown, value: unknown) {
  const [want, got]: string[][] = [[], []];
  match("", shape, value, want, got);
  return want.every((w, i) => w === got[i]);
}

// GitHub's heading ids, slugged the way scripts/doc-map.ts slugs them.
function anchors(md: string) {
  const [out, seen] = [new Set<string>(), new Map<string, number>()];
  for (const line of md.replace(/```[\s\S]*?```/g, "").split("\n")) {
    const h = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!h) continue;
    const text = h[1].replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, "").replace(/[*`~]/g, "");
    const base = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "").replace(/ /g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n ? `${base}-${n}` : base);
  }
  return out;
}
/** Markdown and line breaks taken out, so a sentence is found however the spec wraps or marks it. */
const plain = (md: string) => md.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`|\\]/g, "").replace(/\s+/g, " ").trim();

/** Throws on a vector that checks less than it seems to: a misspelled key would pass, checking nothing. */
function check(v: unknown): asserts v is Vector {
  const only = (o: unknown, keys: string[]) => isObject(o) && Object.keys(o).every((k) => keys.includes(k));
  const ms = (x: unknown) => x === undefined || (typeof x === "number" && x >= 0);
  const { contract, says, features, steps } = (isObject(v) ? v : {}) as Partial<Vector>;
  const step = (s: Step) =>
    only(s, ["send", "expect"]) && only(s.send, [...OWN, ...SENT]) && Object.keys(s.send).length === 1 && only(s.expect ?? {}, EXPECTS) &&
    ("wait" in s.send ? typeof s.send.wait === "number" && ms(s.send.wait) : true) &&
    (s.expect?.out ?? []).every((o) => only(o, ["after", "within", ...SENT]) && Object.keys(o).filter((k) => SENT.includes(k)).length === 1 && ms(o.after) && ms(o.within));
  const why = [
    !only(v, ["contract", "says", "features", "steps"]) && "a vector has contract, says, features and steps",
    !/^docs\/[^#]+\.md#.+$/.test(String(contract)) && "contract is a spec in docs/ and one of its headings, as docs/x.md#anchor",
    !(typeof says === "string" && says.trim()) && "says is a sentence from that spec",
    !Array.isArray(features) && "features lists what the panel is built with, [] for the default build",
    !(Array.isArray(steps) && steps.length) && "steps lists one step or more",
    ...(Array.isArray(steps) ? steps : []).map((s, i) => !step(s) && `step ${i + 1} sends one kind, expects ${EXPECTS.join(", ")} and in out one kind a message`),
  ].filter(Boolean);
  if (why.length) throw new Error(why.join("; "));
}

/** One request, on a connection of its own. A JSON body comes back parsed. */
function request(port: number, line: string, form?: string, headers: Record<string, string> = {}): Promise<Reply> {
  const [method, target] = String(line).split(" ");
  if (!target?.startsWith("/")) throw new Error(`http sends "METHOD /path?query", not ${JSON.stringify(line)}`);
  if (form !== undefined) headers = { "Content-Type": "application/x-www-form-urlencoded", ...headers };
  return new Promise((done, fail) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: target, headers, agent: false }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (part: Buffer) => parts.push(part)).on("end", () => {
        const text = Buffer.concat(parts).toString();
        let body: unknown = text;
        if (res.headers["content-type"]?.startsWith("application/json")) body = attempt(() => JSON.parse(text), text);
        const flat = Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v)]);
        done({ status: res.statusCode ?? 0, headers: Object.fromEntries(flat), body });
      });
    });
    req.once("error", fail).end(form);
  });
}
const attempt = <T>(fn: () => T, otherwise: T) => {
  try {
    return fn();
  } catch {
    return otherwise;
  }
};

async function run(file: string, senders: Record<string, Sender>, want: string[], got: string[]) {
  const v: unknown = JSON.parse(read(file));
  check(v);
  const [spec, anchor] = v.contract.split("#");
  const text = read(spec);
  want.push(`contract ${v.contract}`, `says ${spec}`);
  got.push(anchors(text).has(anchor) ? `contract ${v.contract}` : `contract ${spec} has no #${anchor}`);
  got.push(plain(text).includes(plain(v.says)) ? `says ${spec}` : `says not in ${spec}`);

  const kindOf = (o: Out) => Object.keys(o).find((k) => SENT.includes(k)) as string;
  const kinds = new Set(v.steps.flatMap((s) => [...Object.keys(s.send), ...(s.expect?.out ?? []).map(kindOf)]).filter((k) => SENT.includes(k)));
  const channels = new Map<string, Channel>();
  let panel: Awaited<ReturnType<typeof start>> | undefined;
  try {
    for (const kind of kinds) {
      if (!senders[kind]) throw new Error(`this suite brings no sender for ${kind}`);
      channels.set(kind, await senders[kind]());
    }
    panel = await start({ features: v.features, clock: "manual", ports: Object.assign({ "*": 0 }, ...[...channels.values()].map((c) => c.ports)) });
    const port = panel.ports.http;
    for (const c of channels.values()) await c.open?.({ ports: panel.ports, http: (line, form) => request(port, line, form) });

    // Each message heard is timed at the panel's clock when replay() first sees it, after a send or a move of the clock.
    let now = 0;
    const times = new Map([...channels.keys()].map((k) => [k, [] as number[]]));
    const drain = async () => {
      for (let i = 0; i < 3; i++) await new Promise<void>((done) => setImmediate(done));
      for (const c of channels.values()) await c.settle?.();
      for (const [k, c] of channels) while (times.get(k)!.length < c.heard.length) times.get(k)!.push(now);
    };
    const advance = async (ms: number) => {
      const r = await request(port, `GET /vp/advance?ms=${ms}`);
      if (r.status !== 200) throw new Error(`the clock: ${r.body}`);
      now = (r.body as { now: number }).now;
      await drain();
    };
    await drain();

    for (const [i, s] of v.steps.entries()) {
      const at = `step ${String(i + 1).padStart(2, "0")}`;
      const [[kind, what]] = Object.entries(s.send);
      const [t0, next] = [now, new Map([...channels].map(([k, c]) => [k, c.heard.length]))];
      let reply: unknown;
      if (kind === "http") {
        const h = (typeof what === "string" ? { request: what } : what) as { request: string; form?: string; headers?: Record<string, string> };
        reply = await request(port, h.request, h.form, h.headers);
      } else if (kind === "hand") {
        const h = what as { knob: number; turn?: number; down?: boolean };
        const line = "turn" in h ? `/vp/turn?knob=${h.knob}&detents=${h.turn}` : `/vp/button?knob=${h.knob}&down=${"down" in h ? Number(h.down) : ""}`;
        const r = await request(port, `GET ${line}`);
        if (r.status !== 200) throw new Error(`${at} hand: ${r.body}`);
      } else if (kind !== "wait") reply = await channels.get(kind)!.send(what);
      await drain();

      // The clock runs to the end of a wait and on to the last edge an out names, stopping at each
      // edge, so every message falls wholly inside or outside each window.
      const out = s.expect?.out ?? [];
      const span = kind === "wait" ? (what as number) : 0;
      const edges = [span, ...out.flatMap((o) => [o.after ?? 0, o.within ?? span])].sort((a, b) => a - b);
      for (const ms of edges) if (t0 + ms > now) await advance(t0 + ms - now);

      const e = s.expect ?? {};
      if ("reply" in e) match(`${at} reply`, e.reply, reply, want, got);
      if ("status" in e) match(`${at} status`, e.status, (await request(port, "GET /api/status")).body, want, got);
      if ("input" in e) match(`${at} input`, e.input, (await request(port, "GET /vp/state")).body, want, got);
      // Out is matched in order: each one is a message after the last one matched on its kind.
      for (const o of out) {
        const [k, after, within] = [kindOf(o), o.after ?? -1, o.within ?? span];
        const [heard, time, from] = [channels.get(k)!.heard, times.get(k)!, next.get(k)!];
        const window = heard.map((_, j) => j).filter((j) => j >= from && time[j] - t0 > after && time[j] - t0 <= within);
        const hit = o[k] === "<absent>" ? (window.length ? undefined : from) : window.find((j) => fits(o[k], heard[j]));
        const say = (message: string) => `${at} out ${k} ${message} ${o.after === undefined ? "" : `after ${after} ms, `}by ${within} ms`;
        want.push(say(show(o[k])));
        if (hit !== undefined) next.set(k, o[k] === "<absent>" ? from : hit + 1);
        const heardThere = window.map((j) => `${show(heard[j])} at ${time[j] - t0} ms`).join(", ") || "nothing";
        got.push(hit !== undefined ? say(show(o[k])) : say(heardThere));
      }
    }
  } finally {
    await panel?.close();
    for (const c of channels.values()) await c.close();
  }
}

/** Replays each vector in a folder, given from the repository root, with a suite's senders: one compare() a vector. */
export async function replay(folder: string, senders: Record<string, Sender> = {}) {
  const files = fs.readdirSync(`${ROOT}/${folder}`).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) throw new Error(`${folder} has no vectors`);
  for (const f of files) {
    const [want, got]: string[][] = [[], []];
    try {
      await run(`${folder}/${f}`, senders, want, got);
    } catch (e) {
      got.push(`threw ${(e as Error).message}`);
    }
    compare(`${folder}/${f}`, { label: "the vector", items: want }, { label: "the panel", items: got });
  }
}
