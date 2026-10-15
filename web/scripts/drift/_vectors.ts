/**
 * The replay the contract-vector suites share (docs/contract-vectors.md). replay() starts a fresh
 * virtual panel (tools/virtual-panel/) for each .json in a vector folder, on a manual clock and free
 * ports, runs its steps and gives compare() what the vector expects beside what the panel did. It
 * reaches the panel only through its ports: http, hand and wait go over HTTP, and a suite passes in
 * a Sender for each other kind, kept in a _ file of its own. A vector whose `says` is gone from its
 * spec fails, so a spec edit brings its vectors along.
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

const SENT = ["osc", "midi", "mqtt", "ws"]; // the kinds a suite brings, and the ones the panel sends on
const KINDS = ["http", "hand", "wait", ...SENT];
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

/**
 * Each place a shape names, as "where shape", and the value there: the same text where it fits, the
 * value where not. True when every place fits.
 */
function match(where: string, shape: unknown, value: unknown, want: string[] = [], got: string[] = []): boolean {
  if (Array.isArray(shape) && Array.isArray(value) && shape.length === value.length) {
    return shape.map((s, i) => match(`${where}[${i}]`, s, value[i], want, got)).every(Boolean);
  }
  if (isObject(shape) && isObject(value)) return Object.entries(shape).map(([k, s]) => match(`${where}.${k}`, s, value[k], want, got)).every(Boolean);
  const fits = isType(shape) ? TYPES[shape](value) : shape === value;
  want.push(`${where} ${show(shape)}`);
  got.push(`${where} ${show(fits ? shape : value)}`);
  return fits;
}

// GitHub's heading ids, slugged the way scripts/doc-map.ts slugs them.
function anchors(md: string) {
  const seen = new Map<string, number>();
  return new Set(
    [...md.replace(/```[\s\S]*?```/g, "").matchAll(/^ {0,3}#{1,6}[ \t]+(.*?)[ \t]*#*[ \t]*$/gm)].map(([, h]) => {
      const text = h.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, "").replace(/[*`~]/g, "");
      const base = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "").replace(/ /g, "-");
      seen.set(base, (seen.get(base) ?? -1) + 1);
      return seen.get(base) ? `${base}-${seen.get(base)}` : base;
    }),
  );
}
/** Markdown and line breaks taken out, so a sentence is found however the spec wraps or marks it. */
const plain = (md: string) => md.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`|\\]/g, "").replace(/\s+/g, " ").trim();

/** Throws on a vector that checks less than it seems to: a misspelled key would pass, checking nothing. */
function check(v: unknown): asserts v is Vector {
  const only = (o: unknown, keys: string[]) => isObject(o) && Object.keys(o).every((k) => keys.includes(k));
  const ms = (x: unknown) => x === undefined || (typeof x === "number" && x >= 0);
  const one = (o: Record<string, unknown>, kinds: string[]) => Object.keys(o).filter((k) => kinds.includes(k)).length === 1;
  const step = (s: Step) =>
    only(s, ["send", "expect"]) && only(s.send, KINDS) && one(s.send, KINDS) && only(s.expect ?? {}, EXPECTS) && ms(s.send.wait) &&
    [s.expect?.out ?? []].every(Array.isArray) && (s.expect?.out ?? []).every((o) => only(o, ["after", "within", ...SENT]) && one(o, SENT) && ms(o.after) && ms(o.within));
  const { contract, says, features, steps } = (isObject(v) ? v : {}) as Partial<Vector>;
  const why = [
    !only(v, ["contract", "says", "features", "steps"]) && "a vector has contract, says, features and steps",
    !/^docs\/[^#]+\.md#.+$/.test(String(contract)) && "contract is a spec in docs/ and one of its headings, as docs/x.md#anchor",
    !(typeof says === "string" && says.trim()) && "says is a sentence from that spec",
    !Array.isArray(features) && "features lists what the panel is built with, [] for the default build",
    !(Array.isArray(steps) && steps.length) && "steps lists one step or more",
    ...(Array.isArray(steps) ? steps : []).map((s, i) => !step(s) && `step ${i + 1} is not a send of one kind and an expect of ${EXPECTS.join(", ")}`),
  ].filter(Boolean);
  if (why.length) throw new Error(why.join("; "));
}

/** One request, on a connection of its own. A JSON body comes back parsed. */
async function request(port: number, line: string, form?: string, headers: Record<string, string> = {}): Promise<Reply> {
  const [method, target] = String(line).split(" ");
  if (!target?.startsWith("/")) throw new Error(`http sends "METHOD /path?query", not ${JSON.stringify(line)}`);
  if (form !== undefined) headers = { "Content-Type": "application/x-www-form-urlencoded", ...headers };
  const res = await new Promise<http.IncomingMessage>((done, fail) => {
    http.request({ host: "127.0.0.1", port, method, path: target, headers, agent: false }, done).once("error", fail).end(form);
  });
  let text = "";
  for await (const part of res) text += part;
  const flat = Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v)]);
  const json = res.headers["content-type"]?.startsWith("application/json");
  return { status: res.statusCode ?? 0, headers: Object.fromEntries(flat), body: json ? JSON.parse(text) : text };
}

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

    // A message is timed by the panel's clock when replay() first sees it, after a send or a move of the clock.
    let now = 0;
    const times = new Map([...channels.keys()].map((k) => [k, [] as number[]]));
    const drain = async () => {
      for (let i = 0; i < 3; i++) await new Promise<void>((done) => setImmediate(done));
      for (const c of channels.values()) await c.settle?.();
      for (const [k, c] of channels) while (times.get(k)!.length < c.heard.length) times.get(k)!.push(now);
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
        const r = await request(port, "turn" in h ? `GET /vp/turn?knob=${h.knob}&detents=${h.turn}` : `GET /vp/button?knob=${h.knob}&down=${Number(h.down)}`);
        if (r.status !== 200) throw new Error(`${at} hand: ${r.body}`);
      } else if (kind !== "wait") reply = await channels.get(kind)!.send(what);
      await drain();

      // The clock runs to the end of a wait and on to the last edge an out names, stopping at each
      // edge, so a message falls wholly inside or outside each window.
      const out = s.expect?.out ?? [];
      const span = kind === "wait" ? (what as number) : 0;
      for (const ms of [span, ...out.flatMap((o) => [o.after ?? 0, o.within ?? span])].sort((a, b) => a - b)) {
        if (t0 + ms <= now) continue;
        const r = await request(port, `GET /vp/advance?ms=${t0 + ms - now}`);
        if (r.status !== 200) throw new Error(`the clock: ${r.body}`);
        now = (r.body as { now: number }).now;
        await drain();
      }

      const e = s.expect ?? {};
      if ("reply" in e) match(`${at} reply`, e.reply, reply, want, got);
      if ("status" in e) match(`${at} status`, e.status, (await request(port, "GET /api/status")).body, want, got);
      if ("input" in e) match(`${at} input`, e.input, (await request(port, "GET /vp/state")).body, want, got);
      // In order: each out is a message later than the one matched before it on its kind.
      for (const o of out) {
        const [k, after, within] = [kindOf(o), o.after ?? -1, o.within ?? span];
        const [heard, time, from] = [channels.get(k)!.heard, times.get(k)!, next.get(k)!];
        const window = heard.map((_, j) => j).filter((j) => j >= from && time[j] - t0 > after && time[j] - t0 <= within);
        const hit = o[k] === "<absent>" ? (window.length ? undefined : from - 1) : window.find((j) => match("", o[k], heard[j]));
        const say = (message: string) => `${at} out ${k} ${message} ${o.after === undefined ? "" : `after ${after} ms, `}by ${within} ms`;
        want.push(say(show(o[k])));
        got.push(say(hit !== undefined ? show(o[k]) : window.map((j) => `${show(heard[j])} at ${time[j] - t0} ms`).join(", ") || "nothing"));
        if (hit !== undefined) next.set(k, hit + 1);
      }
    }
  } finally {
    const closed = await Promise.allSettled([panel?.close(), ...[...channels.values()].map((c) => c.close())]);
    for (const c of closed) if (c.status === "rejected") got.push(`close threw ${c.reason}`);
  }
}

/** Replays each vector in a folder, named from the repository root, with a suite's senders: one compare() a vector. */
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
