/**
 * docs/osc-spec.md's device side on node:dgram: plain OSC 1.0 in on 9001, out on 9000 to the host it learned
 * (lines 13 to 20), what it tells that host (24 to 39) and the four addresses a host sends (43 to 50). The spec where
 * it speaks, features/osc/core_osc.h where it is silent: only the first argument is read, a float rounds half away
 * from zero, and what arrives is taken at the end of a frame, eight datagrams at most, so a delta reaches the pattern
 * on the frame after. Replies go to the learned address on --port oscReply, 9000 unless moved; 0 (what '*=0' gives)
 * sends them back to the port the host sent from, so a suite needs one socket.
 */
import dgram from "node:dgram";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SIM_IP, type SimPattern } from "@/lib/guide/deviceSim";
import { KNOB_COUNT } from "@/lib/shared/constants";

import type { Transport } from "../panel";

// The feature's numbers, by the names osc_config.h and core_osc.h give them.
const [LOCAL_PORT, REMOTE_PORT] = [9001, 9000]; // PF_OSC_LOCAL_PORT, PF_OSC_REMOTE_PORT
const [PACKET_BYTES, RX_BUDGET, HEARTBEAT_MS] = [256, 8, 1000]; // sizeof(packet) and rxBuf, PF_OSC_RX_BUDGET, update()
const FRAME_MS = 1000 / 60; // the frame panel.ts ticks DeviceSim at; update() runs once a frame
const NET_CONFIG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../firmware/patternflow/net_config.h");
const P = "/patternflow";

// DeviceSim keeps the pattern list private, since the guide picks by slug.
type Inside = { patterns: SimPattern[] };

// A string ends in a zero and is padded to four bytes. Every message the panel sends has one argument.
function pad(s: string) {
  const b = Buffer.from(`${s}\0`);
  return Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
}
function message(address: string, arg: number | string) {
  if (typeof arg === "string") return Buffer.concat([pad(address), pad(",s"), pad(arg)]);
  const value = Buffer.alloc(4);
  value.writeInt32BE(arg | 0); // the (int32_t) cast sendInt() is handed
  return Buffer.concat([pad(address), pad(",i"), value]);
}

const lround = (v: number) => Math.sign(v) * Math.round(Math.abs(v)); // lroundf(): 2.5 is 3 and -2.5 is -3
/** handleDatagram(): an address that starts with a slash, then type tags, else null. arg is NaN unless the first tag is i or f. */
function parse(b: Buffer) {
  const string = (at: number): [string, number] | null => {
    const end = b.indexOf(0, at);
    return end < 0 ? null : [b.toString("utf8", at, end), (end + 4) & ~3];
  };
  const address = string(0);
  const tags = address && string(address[1]);
  if (!address?.[0].startsWith("/") || !tags?.[0].startsWith(",")) return null; // a #bundle stops here (line 15)
  const [type, at] = [tags[0][1], tags[1]];
  const arg = b.length < at + 4 ? NaN : type === "i" ? b.readInt32BE(at) : type === "f" ? lround(b.readFloatBE(at)) : NaN;
  return { address: address[0], arg };
}

export default {
  feature: "osc",
  caps: ["osc"],
  async attach({ sim, clock, port, bound, on, onClose }) {
    const version = /#define\s+PF_IMPROV_FW_VERSION\s+"([^"]*)"/.exec(fs.readFileSync(NET_CONFIG, "utf8"))?.[1] ?? "";
    const socket = dgram.createSocket("udp4");
    await new Promise<void>((done, fail) => void socket.once("error", fail).bind(port("osc", LOCAL_PORT), () => done()));
    bound.osc = socket.address().port;
    onClose(() => new Promise<void>((done) => socket.close(() => done())));
    const replyPort = port("oscReply", REMOTE_PORT);
    const inbox: { b: Buffer; from: dgram.RemoteInfo }[] = [];
    socket.on("message", (b, from) => void inbox.push({ b, from }));

    // Nothing goes out until a host has sent something the panel reads (line 18). A send that fails is dropped.
    let host: { address: string; port: number } | null = null;
    const send = (address: string, arg: number | string) => {
      const b = message(address, arg);
      if (host && b.length <= PACKET_BYTES) socket.send(b, host.port, host.address, () => {});
    };

    let [announce, pick] = [false, -1]; // a ping or a new host, and the frame's last pattern/index
    function receive({ b, from }: (typeof inbox)[number]) {
      const m = b.length <= PACKET_BYTES ? parse(b) : null;
      const knob = Number(/^\/patternflow\/knob\/(\d)\/delta$/.exec(m?.address ?? "")?.[1]) - 1;
      if (!m) return;
      if (knob >= 0 && knob < KNOB_COUNT) {
        // Clicks no hand made, one for one (line 46). They take no lane and free no channel, and asleep they wake nothing.
        if (Number.isFinite(m.arg)) sim.nudge(knob, m.arg);
      } else if (m.address === `${P}/pattern/index`) {
        if (Number.isFinite(m.arg)) pick = m.arg;
      } else if (m.address === `${P}/ping`) announce = true;
      else if (m.address !== `${P}/content/toggle`) return; // ignored silently (line 50), so the sender is not learned
      // Any of the four teaches the panel its host, and a new host gets the announce (line 39).
      const to = { address: from.address, port: replyPort || from.port };
      if (host?.address !== to.address || host.port !== to.port) [host, announce] = [to, true];
    }

    // A hand's buttons, as the frame reads them: a press is the edge down, held is the state.
    const [held, pressed] = [Array<boolean>(KNOB_COUNT).fill(false), Array<boolean>(KNOB_COUNT).fill(false)];
    on("button", ({ knob, down }) => {
      if (down && !held[knob - 1]) pressed[knob - 1] = true;
      held[knob - 1] = down;
    });
    const appMode = (mode: string) => (mode === "select" ? 1 : 0); // MODE_SELECTING; every other screen draws over MODE_RUNNING
    let [clicks, sentHeld] = [[...sim.knobState().knobs], [...held]];
    let [index, mode] = [sim.snapshot().patternIndex, appMode(sim.snapshot().mode)];

    clock.every(FRAME_MS, () => {
      for (const d of inbox.splice(0, RX_BUDGET)) receive(d);
      // On SELECT the pattern is the one under the cursor, as currentPatternIdx is.
      const shown = sim.snapshot();
      if (announce) {
        announce = false;
        send(`${P}/hello`, "Patternflow");
        send(`${P}/version`, version);
        send(`${P}/ip`, SIM_IP);
        send(`${P}/pattern/index`, shown.patternIndex);
        send(`${P}/pattern/name`, shown.patternName);
        send(`${P}/content/mode`, 0);
        send(`${P}/app/mode`, appMode(shown.mode));
        [index, mode] = [shown.patternIndex, appMode(shown.mode)];
      }
      // knobs counts a hand's clicks and nothing else's, so a lane or a nudge never shows here (line 26).
      const now = sim.knobState().knobs;
      for (let i = 0; i < KNOB_COUNT; i++) {
        if (now[i] !== clicks[i]) {
          send(`${P}/knob/${i + 1}/delta`, now[i] - clicks[i]);
          send(`${P}/knob/${i + 1}/clicks`, now[i]);
        }
        if (pressed[i]) send(`${P}/button/${i + 1}/press`, 1);
        if (held[i] !== sentHeld[i]) send(`${P}/button/${i + 1}/held`, Number(held[i]));
      }
      [clicks, sentHeld] = [[...now], [...held]];
      pressed.fill(false);
      // Each when its own column says: a pattern change sends the pattern, a mode change the mode, and neither content/mode.
      if (shown.patternIndex !== index) {
        send(`${P}/pattern/index`, shown.patternIndex);
        send(`${P}/pattern/name`, shown.patternName);
      }
      if (appMode(shown.mode) !== mode) send(`${P}/app/mode`, appMode(shown.mode));
      [index, mode] = [shown.patternIndex, appMode(shown.mode)];
      // takePattern() comes after observeFrame(), so the host hears of the switch on the next frame.
      const list = (sim as unknown as Inside).patterns;
      if (pick >= 0 && pick < list.length) sim.selectPattern(list[pick].slug);
      pick = -1;
    });
    // While a host is known, asleep or not (line 34).
    clock.every(HEARTBEAT_MS, () => send(`${P}/heartbeat`, Math.floor(clock.now() / 1000)));
  },
} satisfies Transport;
