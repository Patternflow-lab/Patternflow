/**
 * The RTP-MIDI sender check:midi-vectors gives _vectors.ts, an initiator shaped like
 * tools/rtpmidi-probe/rtpmidi_probe.py. It invites the panel on its midi port from a control socket and
 * on the next port from a data socket, then syncs clocks once. Each step's message goes in an RTP-MIDI
 * packet of its own. A vector writes a message as its bytes (docs/midi-vectors/README.md), [176, 24, 65]
 * for CC 24 at 65 on channel 1, and heard is each message the panel sent, read back into the same form.
 */
import { randomBytes } from "node:crypto";
import dgram from "node:dgram";

import type { Sender } from "./_vectors";

const NAME = "check:midi-vectors";
const ANSWER_MS = 2000; // the longest an invitation or a clock sync waits for the panel's answer
// Data octets after a channel status, by its high nibble.
const DATA: Record<number, number> = { 0x8: 2, 0x9: 2, 0xa: 2, 0xb: 2, 0xc: 1, 0xd: 1, 0xe: 2 };

// A session packet is two 0xFF octets and a two-letter command (AppleMIDI). Its clock counts 100 µs.
const isSession = (b: Buffer) => b.length >= 4 && b.readUInt16BE(0) === 0xffff;
const ticks = () => Math.round(performance.now() * 10);
function session(command: string, ...words: number[]) {
  const b = Buffer.alloc(4 + 4 * words.length);
  b.writeUInt16BE(0xffff, 0);
  b.write(command, 2, "latin1");
  words.forEach((w, i) => b.writeUInt32BE(w, 4 + 4 * i));
  return b;
}
// A clock sync: the initiator's SSRC, the count, three pad octets and three times.
function sync(ssrc: number, count: number, times: (number | bigint)[]) {
  const b = Buffer.concat([session("CK", ssrc, count << 24), Buffer.alloc(24)]);
  times.forEach((t, i) => b.writeBigUInt64BE(BigInt(t), 12 + 8 * i));
  return b;
}

const isMessage = (m: unknown): m is number[] =>
  Array.isArray(m) && m.every((b, i) => Number.isInteger(b) && b >= (i ? 0 : 0x80) && b < (i ? 0x80 : 0xf0)) && m.length === 1 + DATA[m[0] >> 4];

/** Each channel message in an RTP-MIDI packet (RFC 6295), running status filled in. Anything else comes back in hex. */
function read(b: Buffer): unknown[] {
  const long = (b[12] & 0x80) !== 0; // B: a 12-bit length
  let at = long ? 14 : 13;
  const end = at + (long ? ((b[12] & 0x0f) << 8) | b[13] : b[12] & 0x0f);
  if (b.length < at || b[0] >> 6 !== 2 || (b[1] & 0x7f) !== 0x61 || end > b.length) return [`not RTP-MIDI: ${b.toString("hex")}`];
  let [delta, running] = [(b[12] & 0x20) !== 0, 0]; // Z: the first message has a delta time too
  const out: unknown[] = [];
  while (at < end) {
    if (delta) while (at < end && b[at++] & 0x80); // one to four octets, the last under 128
    delta = true;
    const status = b[at] & 0x80 ? b[at++] : running;
    const m = [status, ...b.subarray(at, (at += DATA[status >> 4] ?? end))];
    if (!isMessage(m)) return [...out, `not a channel message: ${b.toString("hex", 12, end)}`];
    out.push(m);
    running = status;
  }
  return out;
}

/** Sends a session packet and resolves with the answer of that command on the same socket. */
function ask(socket: dgram.Socket, port: number, b: Buffer, command: string) {
  const what = `${b.toString("latin1", 2, 4)} to port ${port}`;
  return new Promise<Buffer>((done, fail) => {
    const timer = setTimeout(() => (socket.off("message", hear), fail(new Error(`${what}: no answer in ${ANSWER_MS} ms`))), ANSWER_MS);
    function hear(r: Buffer) {
      if (!isSession(r) || ![command, "NO"].includes(r.toString("latin1", 2, 4))) return;
      clearTimeout(timer);
      socket.off("message", hear);
      if (r.toString("latin1", 2, 4) === "NO") fail(new Error(`${what}: the panel said NO`));
      else done(r);
    }
    socket.on("message", hear);
    socket.send(b, port, "127.0.0.1", (e) => e && fail(e));
  });
}

const MARK = Buffer.from("settle");

async function socket() {
  const s = dgram.createSocket("udp4");
  await new Promise<void>((done, fail) => void s.once("error", fail).bind(0, "127.0.0.1", () => done()));
  return s;
}

export const midi: Sender = async () => {
  const [control, data] = [await socket(), await socket()];
  const me = data.address().port;
  const [ssrc, token] = [randomBytes(4).readUInt32BE(0), randomBytes(4).readUInt32BE(0)];
  const [heard, marks] = [[] as unknown[], [] as (() => void)[]];
  data.on("message", (b, from) => {
    if (from.port === me) marks.shift()?.();
    else if (!isSession(b)) heard.push(...read(b)); // session packets are open()'s
  });
  const send = (b: Buffer, port: number) => new Promise<void>((done, fail) => data.send(b, port, "127.0.0.1", (e) => (e ? fail(e) : done())));

  let [panel, seq] = [0, randomBytes(2).readUInt16BE(0)];
  return {
    // An invitation on control and then on data, which the panel keeps on the port after it, and one clock sync.
    open: async ({ ports }) => {
      const invite = Buffer.concat([session("IN", 2, token, ssrc), Buffer.from(`${NAME}\0`)]);
      await ask(control, ports.midi, invite, "OK");
      await ask(data, ports.midi + 1, invite, "OK");
      const answer = await ask(data, ports.midi + 1, sync(ssrc, 0, [ticks(), 0, 0]), "CK");
      await send(sync(ssrc, 2, [answer.readBigUInt64BE(12), answer.readBigUInt64BE(20), ticks()]), ports.midi + 1);
      panel = ports.midi;
    },
    send: async (what) => {
      if (!isMessage(what)) throw new Error(`midi sends one channel message, [status, ...data], not ${JSON.stringify(what)}`);
      const b = Buffer.alloc(13);
      b[0] = 0x80; // version 2
      b[1] = 0x61; // payload type 97
      b.writeUInt16BE(seq, 2);
      b.writeUInt32BE(ticks() % 2 ** 32, 4);
      b.writeUInt32BE(ssrc, 8);
      b[12] = what.length; // a list under 16 octets has the short header
      seq = (seq + 1) & 0xffff;
      await send(Buffer.concat([b, Buffer.from(what)]), panel + 1);
    },
    heard,
    // A datagram to itself. The socket reads in order, so once it is back, all the panel sent before it is in heard.
    settle: () =>
      new Promise<void>((done, fail) => {
        marks.push(done);
        send(MARK, me).catch(fail);
      }),
    // BY, as the probe ends, since a device keeps two participants at most.
    close: async () => {
      if (panel) await new Promise<void>((done) => control.send(session("BY", 2, token, ssrc), panel, "127.0.0.1", () => done()));
      await Promise.all([control, data].map((s) => new Promise<void>((done) => s.close(() => done()))));
    },
  };
};
