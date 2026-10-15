/**
 * docs/mqtt-spec.md's client: MQTT 3.1.1 at QoS 0 on node:net, with retain, a keepalive and no wildcards (line 12),
 * the roles and channels (13, 14), the topics (22 to 28) and the eight-second snapshot. The spec where it speaks,
 * features/mqtt/core_mqtt.h where it is silent: when a Publisher sends, how a payload is read, how long a banner
 * stays. As on the device nothing dials out until a role and a broker are set; /api/mqtt sets them through mqtt(sim).
 */
import net from "node:net";

import type { DeviceSim, SimPattern } from "@/lib/guide/deviceSim";
import { KNOB_COUNT } from "@/lib/shared/constants";

import type { Seam, Transport } from "../panel";

// The feature's numbers, by the names mqtt_config.h and core_mqtt.h give them.
const [PORT, PREFIX, BANNER_MS] = [1883, "patternflow", 10_000]; // PF_MQTT_PORT, PF_MQTT_PREFIX, PF_MQTT_MESSAGE_DURATION_MS
const BANNER_BYTES = 79; // MESSAGE_BYTES, less the terminator
const [HEARTBEAT_MS, PARAM_MS, PARAM_DELTA] = [8000, 1000, 20]; // SNAPSHOT_HEARTBEAT_MS, PARAM_PUB_MIN_MS, PARAM_PUB_MIN_DELTA
// RECONNECT_MIN_MS after a clean try, _MID_ after fewer than RERESOLVE_AFTER failed ones, then _MAX_.
const [REDIAL_MS, REDIAL_AFTER] = [[5000, 15_000, 60_000], 4];
const [DIAL_MS, KEEPALIVE_S] = [1500, 15]; // CONNECT_TIMEOUT_MS, and client.setKeepAlive(15) in applyClientSettings
const FRAME_MS = 1000 / 60; // the frame panel.ts ticks DeviceSim at; handle() runs once a frame

export type Role = "off" | "publisher" | "subscriber";
export type Channel = "off" | "broadcast" | "ch1" | "ch2" | "ch3" | "ch4" | "live" | "custom";
const PRESETS: Partial<Record<Channel, string>> = { broadcast: "patternflow", live: "patternflow5" };
for (const n of [1, 2, 3, 4]) PRESETS[`ch${n}` as Channel] = `patternflow${n}`;
const channelOf = (prefix: string) => (Object.keys(PRESETS) as Channel[]).find((c) => PRESETS[c] === prefix) ?? "custom";
const forcesSub = (c: Channel) => /^ch[1-4]$/.test(c);
const showPrefix = (prefix: string) => /^patternflow[1-5]$/.test(prefix); // channels 1 to 4 and Live, which keep a snapshot
// PubSubClient's state() as stateText() words it; NaN is a dial still in flight.
const STATES: Record<number, string> = { [-4]: "timeout", [-3]: "lost", [-2]: "connect failed", [-1]: "disconnected", 1: "bad protocol",
  2: "bad client id", 3: "broker unavailable", 4: "bad credentials", 5: "unauthorized" };

// The framing: a type byte, the length in groups of seven bits, the body. A string is two length bytes and UTF-8.
const u16 = (n: number) => Buffer.from([n >> 8, n & 255]);
const str = (s: string) => Buffer.concat([u16(Buffer.byteLength(s)), Buffer.from(s)]);
function packet(type: number, ...parts: Buffer[]) {
  const [body, head] = [Buffer.concat(parts), [type]];
  let n = body.length;
  do head.push((n % 128) | (n >= 128 ? 128 : 0));
  while ((n = Math.floor(n / 128)));
  return Buffer.concat([Buffer.from(head), body]);
}
const [CONNACK, PUBLISH, PINGRESP] = [2, 3, 13];

const toInt = (v: string) => parseInt(v.trim(), 10) || 0; // atol(): leading digits, else 0
const trimEnd = (v: string) => v.replace(/[\r\n ]+$/, ""); // what onMessage() strips from a payload
const SLEEP = new Map(Object.entries({ 1: true, on: true, true: true, sleep: true, 0: false, off: false, false: false, wake: false }));
// An object or nothing: a snapshot that does not parse applies nothing.
function json(text: string): Record<string, unknown> {
  try { return Object(JSON.parse(text)); } catch { return {}; }
}
// DeviceSim keeps the pattern list private, since the guide picks by slug.
type Inside = { patterns: SimPattern[] };

const clients = new WeakMap<DeviceSim, ReturnType<typeof client>>();
/** The client on a panel with the mqtt feature, for /api/mqtt. mqtt-http.ts sorts first, so it asks inside a handler. */
export const mqtt = (sim: DeviceSim) => clients.get(sim);

function client({ sim, clock, routes, bound, on, onClose }: Seam) {
  // Off until a role is picked, as setup() leaves a device that was never told otherwise.
  let [role, channel, prefix, host, port, user, pass] = ["off" as Role, "off" as Channel, PREFIX, "", PORT, "", ""];
  let [sock, up, state, failures, triedAt, error, id] = [null as net.Socket | null, false, -1, 0, -Infinity, "", 0];
  let redial: (() => void) | undefined;
  // A device's id comes from its MAC; here from the HTTP port, so two panels on one broker do not throw each other off.
  const clientId = `pf${bound.http.toString(16).toUpperCase().padStart(6, "0")}`;
  const lanes = <T>(v: T) => Array<T>(KNOB_COUNT).fill(v);
  let heard = lanes<number | null>(null); // the last count on knob/N; the hand's clicks stand in before the first
  let pending = lanes<string | null>(null); // the frame's last param/N, applied once at the frame's end
  let sent = lanes<number | null>(null); // a Publisher's last param/N
  let [paramAt, snapAt, bannerUntil, banner] = [-Infinity, -Infinity, -Infinity, ""];

  const send = (b: Buffer) => void (up && sock?.write(b));
  const publish = (leaf: string, payload: string, retain = false) =>
    send(packet(0x30 | Number(retain), str(`${prefix}/${leaf}`), Buffer.from(payload)));
  const live = () => role !== "off" && channel !== "off" && host !== "";
  const showBanner = (text: string) => {
    banner = trimEnd(Buffer.from(text).subarray(0, BANNER_BYTES).toString());
    bannerUntil = banner ? clock.now() + BANNER_MS : -Infinity;
  };

  function later() {
    redial?.();
    const wait = REDIAL_MS[failures === 0 ? 0 : failures < REDIAL_AFTER ? 1 : 2];
    redial = live() && !sock ? clock.after(Math.max(0, triedAt + wait - clock.now()), dial) : undefined;
  }
  function hangUp() {
    const [s, was] = [sock, up];
    [sock, up, state] = [null, false, -1];
    if (s && was) s.end(packet(0xe0), () => s.destroy());
    else s?.destroy();
  }
  // A role, a channel or a broker changed: start over, at once.
  function restart() {
    hangUp();
    [failures, triedAt, bannerUntil, heard, pending] = [0, -Infinity, -Infinity, lanes(null), lanes(null)];
    later();
  }

  // The socket and its timers keep real time, the broker's; what the panel does keeps the panel's clock.
  function dial() {
    redial = undefined;
    if (sock || !live()) return;
    triedAt = clock.now();
    const s = (sock = net.connect(port, host));
    [state, up] = [NaN, false];
    let [why, unresolved, waiting] = [-2, false, false]; // CONNECT_FAILED until the socket opens
    let inbox: Buffer = Buffer.alloc(0);
    let ping: NodeJS.Timeout | undefined;
    const timeout = setTimeout(() => s.destroy(), DIAL_MS);
    s.on("connect", () => {
      why = -4; // no CONNACK in time
      const login = user ? [str(user), str(pass)] : [];
      s.write(packet(0x10, str("MQTT"), Buffer.from([4, 0x02 | (user ? 0xc0 : 0), 0, KEEPALIVE_S]), str(clientId), ...login));
    });
    s.on("error", (e: NodeJS.ErrnoException) => void (unresolved = e.code === "ENOTFOUND" || e.code === "EAI_AGAIN"));
    s.on("close", () => {
      clearTimeout(timeout);
      clearInterval(ping);
      if (sock !== s) return;
      if (!up) [failures, error] = [failures + 1, unresolved ? "cannot resolve broker" : `connect state ${why}`];
      [sock, up, state] = [null, false, why];
      later();
    });
    s.on("data", (chunk: Buffer) => {
      inbox = Buffer.concat([inbox, chunk]);
      for (;;) {
        let [length, i, scale] = [0, 1, 1];
        for (; i < inbox.length && i < 5; i++, scale *= 128) {
          length += (inbox[i] & 127) * scale;
          if (inbox[i] < 128) break;
        }
        if (i === 5) return void s.destroy(); // a length past four bytes is not MQTT
        if (i >= inbox.length || inbox.length < i + 1 + length) return;
        const [type, flags, body] = [inbox[0] >> 4, inbox[0] & 15, inbox.subarray(i + 1, i + 1 + length)];
        inbox = inbox.subarray(i + 1 + length);
        try {
          if (type === CONNACK && !up && body[1]) return void ((why = body[1]), s.destroy()); // its return code is the state
          if (type === CONNACK && !up) {
            clearTimeout(timeout);
            why = -3; // from here a close is a lost connection
            // A PINGREQ each keepalive, and a broker that has not answered the last one is gone.
            ping = setInterval(() => (waiting ? ((why = -4), s.destroy()) : ((waiting = true), s.write(packet(0xc0)))), KEEPALIVE_S * 1000);
            connected();
          } else if (type === PUBLISH && up) {
            const at = 2 + body.readUInt16BE(0);
            received(body.subarray(2, at).toString(), body.subarray(at + (flags & 6 ? 2 : 0)));
          } else if (type === PINGRESP) waiting = false;
        } catch {
          s.destroy();
        }
      }
    });
  }

  // subscribeAll() or subscribePublisherExtras(), then what every connection says.
  function connected() {
    [up, state, failures, error, heard] = [true, 0, 0, "", lanes(null)];
    const knobs = Array.from({ length: KNOB_COUNT }, (_, i) => [`knob/${i + 1}`, `param/${i + 1}`]).flat();
    const topics = ["message", "sleep", ...(role === "subscriber" ? [...knobs, "pattern"] : []), ...(showPrefix(prefix) ? ["snapshot"] : [])];
    for (const t of topics) send(packet(0x82, u16((id = (id % 0xffff) + 1)), str(`${prefix}/${t}`), Buffer.from([0])));
    publish("sleep/state", sim.consoleState().sleeping ? "1" : "0"); // once per connection (line 27)
    if (role !== "publisher") return;
    // The live burst, for a peer already listening.
    const { knobs: clicks, params, paramActive } = sim.knobState();
    clicks.forEach((k, i) => publish(`knob/${i + 1}`, String(k)));
    publish("pattern", sim.consoleState().patternName);
    sent = params.map((v, i) => (paramActive[i] ? (publish(`param/${i + 1}`, String(v)), v) : null));
    paramAt = clock.now();
    snapshot(true);
  }

  function received(topic: string, payload: Buffer) {
    if (!topic.startsWith(`${prefix}/`)) return;
    const [leaf, body] = [topic.slice(prefix.length + 1), trimEnd(payload.toString())];
    // message, sleep and an empty snapshot are obeyed in either role (line 32).
    if (leaf === "message") return showBanner(payload.toString());
    if (leaf === "sleep") {
      // toggle flips what sleep/state last said, which is the panel now; the change waits a frame, as requestSleep does.
      const word = body.trim().toLowerCase();
      const want = word === "toggle" ? !sim.consoleState().sleeping : SLEEP.get(word);
      return void (want !== undefined && clock.after(0, () => sim.setSleeping(want)));
    }
    if (leaf === "snapshot" && !payload.length) {
      for (let i = 0; i < KNOB_COUNT; i++) sim.releaseRemoteParam(i);
      return showBanner("");
    }
    if (role !== "subscriber") return;
    if (leaf === "snapshot") return snapshotIn(body);
    if (leaf === "pattern") return pick(body);
    const [, kind, n] = /^(knob|param)\/(\d)$/.exec(leaf) ?? [];
    const i = Number(n) - 1;
    if (!(i >= 0 && i < KNOB_COUNT)) return;
    if (kind === "param") return void (pending[i] = body); // empty lets the channel go now (line 23)
    // The difference from the last count heard, as clicks no hand made (line 39); the first is against the hand's.
    const [count, from] = [toInt(body), heard[i] ?? sim.knobState().knobs[i]];
    heard[i] = count;
    sim.nudge(i, count - from);
  }
  // findPatternByName(): the name, then the name in any case, then the slug.
  function pick(name: string) {
    const [list, lower] = [(sim as unknown as Inside).patterns, name.toLowerCase()];
    const found =
      list.find((p) => p.name === name) ?? list.find((p) => p.name.toLowerCase() === lower) ?? list.find((p) => p.slug.toLowerCase() === lower);
    if (name && found) sim.selectPattern(found.slug);
  }
  function snapshotIn(body: string) {
    const snap = json(body);
    if (typeof snap.pattern === "string") pick(snap.pattern);
    // Straight onto the bus, as if each value had arrived on param/N (line 45).
    for (const [i, v] of (Array.isArray(snap.param) ? snap.param : []).slice(0, KNOB_COUNT).entries()) {
      if (typeof v !== "number") break;
      sim.applyRemoteParam(i, v);
    }
    if (typeof snap.message === "string") showBanner(snap.message);
  }

  // noteParams(): a Publisher mirrors each held channel, at most once a second and only past 20 units.
  function noteParams() {
    const { params, paramActive } = sim.knobState();
    const due = params.map((v, i) => paramActive[i] && (sent[i] === null || Math.abs(v - sent[i]!) >= PARAM_DELTA));
    sent = sent.map((v, i) => (paramActive[i] ? v : null));
    if (!due.includes(true) || clock.now() - paramAt < PARAM_MS) return;
    due.forEach((d, i) => d && (publish(`param/${i + 1}`, String(params[i])), (sent[i] = params[i])));
    paramAt = clock.now();
    snapshot(false);
  }
  // Retained, every eight seconds unless forced. Its message is always empty, so a Subscriber's banner goes with it.
  function snapshot(force: boolean) {
    if (role !== "publisher" || !up || !showPrefix(prefix) || (!force && clock.now() - snapAt < HEARTBEAT_MS)) return;
    snapAt = clock.now();
    publish("snapshot", JSON.stringify({ pattern: sim.consoleState().patternName, param: sim.knobState().params, message: "" }), true);
  }

  clock.every(FRAME_MS, () => {
    pending.forEach((v, i) => v !== null && (v ? sim.applyRemoteParam(i, toInt(v)) : sim.releaseRemoteParam(i)));
    pending = lanes(null);
    if (role !== "publisher" || !up) return;
    noteParams();
    snapshot(false);
  });
  // A hand's turn goes out as the knob's new count, unless the bus still holds that channel (update()).
  on("turn", ({ knob }) => {
    const { knobs, paramActive } = sim.knobState();
    if (role === "publisher" && !paramActive[knob - 1]) publish(`knob/${knob}`, String(knobs[knob - 1]));
  });
  on("pattern", ({ name }) => {
    if (role !== "publisher" || !up) return;
    publish("pattern", name);
    [sent, paramAt] = [lanes(null), -Infinity]; // a cue that only changed the name still sends its params
    snapshot(true);
  });
  on("sleep", ({ on: asleep }) => publish("sleep/state", asleep ? "1" : "0"));
  // The panel's own: the banner a message put up, which /frame.png does not draw.
  routes("*", "/vp/mqtt", () => ({ body: { banner: clock.now() < bannerUntil ? banner : null, ms: Math.max(0, bannerUntil - clock.now()) } }));
  onClose(() => {
    const s = sock;
    redial?.();
    hangUp();
    if (s) return new Promise<void>((done) => void s.once("close", () => done()));
  });

  return {
    /** What GET /api/mqtt reads, by its field names. knobs is the last count heard on knob/N, else the hand's. */
    read: () => ({
      role, channel, state: !host ? "no broker configured" : !live() ? "off" : up ? "connected" : (STATES[state] ?? "connecting"),
      host, port, user, prefix, pattern: sim.consoleState().patternName, error, connected: up, configured: host !== "",
      hasPassword: pass !== "", forcesSub: forcesSub(channel), knobs: sim.knobState().knobs.map((k, i) => heard[i] ?? k),
    }),
    /** saveConfig(): a null password keeps the one set, and a preset prefix picks its channel. */
    saveConfig(nextHost: string, nextPort: number, nextUser: string, nextPass: string | null, nextPrefix: string) {
      [host, port, user, prefix, pass, error] = [nextHost, nextPort || PORT, nextUser, nextPrefix, nextPass ?? pass, ""];
      const found = channelOf(prefix);
      if (found !== "custom" || channel !== "off") channel = found;
      if (forcesSub(channel) && role === "publisher") role = "subscriber";
      restart();
    },
    /** applyChannel(): off turns the role off, a preset sets the prefix, and channels 1 to 4 or an off role give Subscriber. */
    applyChannel(next: Channel, preferred: Role) {
      [channel, role] = next === "off" ? ["off", "off"] : [next, forcesSub(next) || preferred === "off" ? "subscriber" : preferred];
      prefix = PRESETS[next] ?? prefix;
      restart();
    },
  };
}

export default {
  feature: "mqtt",
  caps: ["mqtt"],
  attach: (seam) => void clients.set(seam.sim, client(seam)),
} satisfies Transport;
