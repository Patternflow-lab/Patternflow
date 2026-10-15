/**
 * The OSC sender check:osc-vectors gives _vectors.ts. A vector writes a message as its address and then its
 * arguments (docs/osc-vectors/README.md): a whole number goes as an int32, any other number as a float32, a
 * string as a string, and ["#bundle", message, …] wraps the messages in a bundle. One UDP socket a vector sends to
 * the panel's osc port, and the panel, started with oscReply 0, answers to the port it was sent from.
 */
import dgram from "node:dgram";

import type { Sender } from "./_vectors";

// A string ends in a zero and is padded to four bytes.
function pad(s: string) {
  const b = Buffer.from(`${s}\0`);
  return Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
}
function word(n: number, float = false) {
  const b = Buffer.alloc(4);
  if (float) b.writeFloatBE(n);
  else b.writeInt32BE(n);
  return b;
}

function pack(m: unknown): Buffer {
  if (!Array.isArray(m) || typeof m[0] !== "string") throw new Error(`osc sends ["/address", ...arguments], not ${JSON.stringify(m)}`);
  const [address, ...args] = m as [string, ...unknown[]];
  // A time tag of 1 is "immediately". Each element is its size and then the message.
  if (address === "#bundle") return Buffer.concat([pad(address), word(0), word(1), ...args.map(pack).flatMap((b) => [word(b.length), b])]);
  const tags = args.map((a) => (typeof a === "string" ? "s" : Number.isInteger(a) ? "i" : typeof a === "number" ? "f" : "?"));
  if (tags.includes("?")) throw new Error(`an OSC argument is a number or a string, not in ${JSON.stringify(m)}`);
  const values = args.map((a, i) => (tags[i] === "s" ? pad(a as string) : word(a as number, tags[i] === "f")));
  return Buffer.concat([pad(address), pad(`,${tags.join("")}`), ...values]);
}

/** A message as a vector writes it, or the bytes in hex when they are not one. */
function read(b: Buffer): unknown {
  const string = (at: number): [string, number] => {
    const end = b.indexOf(0, at);
    if (end < 0) throw new Error("no terminating zero");
    return [b.toString("utf8", at, end), (end + 4) & ~3];
  };
  try {
    const [address, at] = string(0);
    const [tags, start] = string(at);
    const m: unknown[] = [address];
    let i = start;
    for (const t of tags.slice(1)) {
      if (t === "s") {
        const [s, next] = string(i);
        m.push(s);
        i = next;
      } else if (t === "i" || t === "f") {
        m.push(t === "i" ? b.readInt32BE(i) : b.readFloatBE(i));
        i += 4;
      } else throw new Error(`type tag ${t}`);
    }
    return m;
  } catch {
    return `not OSC: ${b.toString("hex")}`;
  }
}

const MARK = Buffer.from("settle");

export const osc: Sender = async () => {
  const socket = dgram.createSocket("udp4");
  await new Promise<void>((done, fail) => void socket.once("error", fail).bind(0, "127.0.0.1", () => done()));
  const me = socket.address().port;
  const send = (b: Buffer, port: number) => new Promise<void>((done, fail) => socket.send(b, port, "127.0.0.1", (e) => (e ? fail(e) : done())));
  const [heard, marks] = [[] as unknown[], [] as (() => void)[]];
  socket.on("message", (b, from) => {
    if (from.port === me) marks.shift()?.();
    else heard.push(read(b));
  });
  let panel = 0;
  return {
    open: async ({ ports }) => {
      panel = ports.osc;
    },
    send: async (what) => {
      await send(pack(what), panel);
    },
    heard,
    // A datagram to itself. The socket reads in order, so once it is back, all the panel sent before it is in heard.
    settle: () =>
      new Promise<void>((done, fail) => {
        marks.push(done);
        send(MARK, me).catch(fail);
      }),
    close: () => new Promise<void>((done) => socket.close(() => done())),
  };
};
