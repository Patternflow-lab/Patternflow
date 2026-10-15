/**
 * docs/midi-spec.md's RTP-MIDI listener on node:dgram: a session named Patternflow on 5004 (control) and 5005 (data),
 * two participants at most (line 28), the channel rule (31) and the receive table (39 to 45). The spec where it
 * speaks, features/midi/core_midi.h and core_midi_rtp.h where it is silent: only a joined participant's packets are
 * read, and a participant that leaves lets go of every note. A message waits in the 128-entry receive queue and the
 * frame applies it (lines 95 to 97), so a CC reaches the pattern on the frame after. The panel never invites anyone.
 * What goes out and /api/midi are midi-out.ts, on what midi(sim) gives it.
 */
import { randomBytes } from "node:crypto";
import dgram from "node:dgram";

import type { DeviceSim, SimPattern } from "@/lib/guide/deviceSim";
import { BUS_MAX, KNOB_COUNT } from "@/lib/shared/constants";

import type { Transport } from "../panel";

// The feature's numbers, by the names core_midi.h and core_midi_rtp.h give them.
const [PORT, NAME, CHANNEL] = [5004, "Patternflow", 1]; // PF_MIDI_RTP_PORT, PF_MIDI_SESSION_NAME, PF_MIDI_CHANNEL
const [ABS, REL, NOTE] = [20, 24, 60]; // PF_MIDI_CC_ABS_BASE, PF_MIDI_CC_REL_BASE, PF_MIDI_NOTE_BASE
const [PEERS, QUEUE] = [2, 128]; // two participants (line 28), and the receive queue, which a frame empties (96)
const FRAME_MS = 1000 / 60; // the frame panel.ts ticks DeviceSim at; handle() runs once a frame

// DeviceSim keeps the pattern list private, since the guide picks by slug.
type Inside = { patterns: SimPattern[] };
type Peer = { name: string; data: { address: string; port: number } | null };
type Counts = { rx: number; abs: number[]; rel: number[]; queueDropped: number };

// A session packet is two 0xFF octets and a two-letter command (AppleMIDI). Its clock counts 100 µs.
const isSession = (b: Buffer) => b.length >= 4 && b.readUInt16BE(0) === 0xffff;
function session(command: string, size: number) {
  const b = Buffer.alloc(size);
  b.writeUInt16BE(0xffff, 0);
  b.write(command, 2, "latin1");
  return b;
}
// The answer to an invitation: protocol 2, the token it came with, the panel's SSRC and its name.
function answer(command: "OK" | "NO", token: number, ssrc: number) {
  const b = session(command, 16);
  [2, token, ssrc].forEach((v, i) => b.writeUInt32BE(v, 4 + 4 * i));
  return Buffer.concat([b, Buffer.from(`${NAME}\0`)]);
}

// Data octets after a status, by its high nibble; system common by its low one (F1 and F3 one, F2 two).
const DATA: Record<number, number> = { 0x8: 2, 0x9: 2, 0xa: 2, 0xb: 2, 0xc: 1, 0xd: 1, 0xe: 2 };
const COMMON = [0, 1, 2, 1];
/** RFC 6295's MIDI list, each command as [status, ...data] with running status filled in. The journal is not read. */
function commands(b: Buffer) {
  const long = (b[12] & 0x80) !== 0; // B: a 12-bit length
  let at = long ? 14 : 13;
  const end = Math.min(b.length, at + (long ? ((b[12] & 0x0f) << 8) | b[13] : b[12] & 0x0f));
  let [delta, running] = [(b[12] & 0x20) !== 0, 0]; // Z: the first command has a delta time too
  const out: number[][] = [];
  while (at < end) {
    if (delta) for (let n = 0; n < 4 && at < end && b[at++] & 0x80; n++); // one to four octets, the last under 128
    delta = true;
    if (at >= end) break;
    const status = b[at] & 0x80 ? b[at++] : running;
    if (status >= 0xf8) continue; // real time: no data, and running status stands
    if (status === 0xf0 || status === 0xf7) {
      while (at < end && ![0xf0, 0xf4, 0xf7].includes(b[at++])); // a system exclusive segment, to the octet that ends it
      running = 0;
    } else if (status >= 0xf0) [at, running] = [at + (COMMON[status & 0x0f] ?? 0), 0];
    else if (!status) break; // data with no status to run on
    else {
      const data = b.subarray(at, (at += DATA[status >> 4]));
      if (at > end || data.some((d) => d & 0x80)) break;
      out.push([(running = status), ...data]);
    }
  }
  return out;
}

// The data port is the control port's next, as every initiator assumes; 0 looks for a free pair.
async function pair(want: number): Promise<[dgram.Socket, dgram.Socket]> {
  const open = (p: number) =>
    new Promise<dgram.Socket>((done, fail) => {
      const s = dgram.createSocket("udp4").once("error", (e) => (s.close(), fail(e)));
      s.bind(p, () => done(s));
    });
  for (let tries = 1; ; tries++) {
    const control = await open(want);
    try {
      return [control, await open(control.address().port + 1)];
    } catch (e) {
      control.close();
      if (want || tries === 10) throw e;
    }
  }
}

const read = (peers: Map<number, Peer>, counts: Counts) => ({
  peers: [...peers.values()].filter((p) => p.data).map((p) => p.name),
  ...{ ...counts, abs: [...counts.abs], rel: [...counts.rel] },
});
const sessions = new WeakMap<DeviceSim, { read(): ReturnType<typeof read>; send(message: number[]): void }>();
/** The session on a panel with the midi feature. midi-out.ts sorts first, so it asks once a request or an event comes in. */
export const midi = (sim: DeviceSim) => sessions.get(sim);

export default {
  feature: "midi",
  caps: ["midi"],
  async attach({ sim, clock, port, bound, onClose }) {
    const [control, data] = await pair(port("midi", PORT));
    bound.midi = control.address().port;
    onClose(async () => void (await Promise.all([control, data].map((s) => new Promise<void>((done) => s.close(() => done()))))));
    const [ssrc, peers] = [randomBytes(4).readUInt32BE(0), new Map<number, Peer>()];
    const inbox: (number[] | null)[] = []; // null: a participant left
    const counts: Counts = { rx: 0, abs: Array(KNOB_COUNT).fill(0), rel: Array(KNOB_COUNT).fill(0), queueDropped: 0 };
    const ticks = () => Math.round(clock.now() * 10); // the panel's clock in 100 µs

    // Invitation (IN) on control and then on data, clock sync (CK) and the end (BY), on either port.
    function hear(socket: dgram.Socket, b: Buffer, from: dgram.RemoteInfo) {
      const [command, onData] = [b.toString("latin1", 2, 4), socket === data];
      const reply = (r: Buffer) => socket.send(r, from.port, from.address, () => {});
      if ((command === "IN" || command === "BY") && b.length >= 16) {
        const [token, them] = [b.readUInt32BE(8), b.readUInt32BE(12)];
        const peer = peers.get(them);
        if (command === "BY") {
          if (peers.delete(them) && peer?.data) inbox.push(null);
          return;
        }
        // The data port takes only a participant the control port took.
        if (onData ? !peer : !peer && peers.size >= PEERS) return reply(answer("NO", token, ssrc));
        const end = b.indexOf(0, 16);
        if (onData) peer!.data = { address: from.address, port: from.port };
        else if (!peer) peers.set(them, { name: b.toString("utf8", 16, end < 0 ? b.length : end), data: null });
        reply(answer("OK", token, ssrc));
      } else if (command === "CK" && b.length >= 36 && b[8] === 0 && peers.has(b.readUInt32BE(4))) {
        // The initiator's count 0, answered with count 1: its time back and the panel's beside it.
        const r = session("CK", 36);
        r.writeUInt32BE(ssrc, 4);
        r[8] = 1;
        r.writeBigUInt64BE(b.readBigUInt64BE(12), 12);
        r.writeBigUInt64BE(BigInt(ticks()), 20);
        reply(r);
      }
    }
    control.on("message", (b, from) => isSession(b) && hear(control, b, from));
    data.on("message", (b, from) => {
      if (isSession(b)) return hear(data, b, from);
      // RTP version 2, payload type 97, from a participant that has joined.
      if (b.length < 13 || b[0] >> 6 !== 2 || (b[1] & 0x7f) !== 0x61 || !peers.get(b.readUInt32BE(8))?.data) return;
      for (const m of commands(b)) {
        if (![0x80, 0x90, 0xb0, 0xc0].includes(m[0] & 0xf0)) continue; // the four the handlers take; the rest is ignored (44)
        if (inbox.length < QUEUE) inbox.push(m);
        else counts.queueDropped++;
      }
    });

    clock.every(FRAME_MS, () => {
      let pick = -1;
      for (const m of inbox.splice(0, QUEUE)) {
        if (!m) {
          for (let i = 0; i < KNOB_COUNT; i++) sim.remoteButton(i, false);
          continue;
        }
        if (CHANNEL && (m[0] & 0x0f) + 1 !== CHANNEL) continue; // 0 would take every channel (31)
        const [kind, d1, d2] = [m[0] & 0xf0, m[1], m[2]];
        counts.rx++;
        if (kind === 0xb0 && d1 >= ABS && d1 < ABS + KNOB_COUNT) {
          // 0..127 onto the bus, rounded, 127 on 1000, held until a hand turns that knob (39).
          counts.abs[d1 - ABS]++;
          sim.applyRemoteParam(d1 - ABS, Math.round((d2 * BUS_MAX) / 127));
        } else if (kind === 0xb0 && d1 >= REL && d1 < REL + KNOB_COUNT) {
          // 64 is still, 65 one detent on and 63 one back (40). Clicks no hand made: they free no channel.
          counts.rel[d1 - REL]++;
          sim.nudge(d1 - REL, d2 - 64);
        } else if ((kind === 0x90 || kind === 0x80) && d1 >= NOTE && d1 < NOTE + KNOB_COUNT) {
          sim.remoteButton(d1 - NOTE, kind === 0x90 && d2 > 0); // a note-on at velocity 0 lets go (41)
        } else if (kind === 0xc0) pick = d1;
      }
      // takePattern(): the frame's last Program Change, in the order /patterns lists (42). Past the end it is nothing.
      const list = (sim as unknown as Inside).patterns;
      if (pick >= 0 && pick < list.length) sim.selectPattern(list[pick].slug);
    });

    let seq = randomBytes(2).readUInt16BE(0);
    sessions.set(sim, {
      /** The joined participants by name, and what came in: rx, abs and rel as status counts them (72, 87), queueDropped (88). */
      read: () => read(peers, counts),
      /** One message, its status and data, in an RTP-MIDI packet of its own to every joined participant. No journal. */
      send(message) {
        const b = Buffer.alloc(13);
        b[0] = 0x80; // version 2
        b[1] = 0x61; // payload type 97
        b.writeUInt16BE(seq, 2);
        b.writeUInt32BE(ticks() % 2 ** 32, 4);
        b.writeUInt32BE(ssrc, 8);
        b[12] = message.length; // a list under 16 octets has the short header
        seq = (seq + 1) & 0xffff;
        for (const p of peers.values()) if (p.data) data.send(Buffer.concat([b, Buffer.from(message)]), p.data.port, p.data.address, () => {});
      },
    });
  },
} satisfies Transport;
