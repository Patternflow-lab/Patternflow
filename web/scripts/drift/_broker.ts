/**
 * check:mqtt-vectors' broker, and the Sender it hands _vectors.ts (docs/contract-vectors.md). A Patternflow
 * is a broker's client, so each vector gets a broker of its own on a free port: MQTT 3.1.1 at QoS 0 on
 * node:net, enough to connect, subscribe, publish and retain. A topic matches only itself, since a panel
 * subscribes with no wildcards (docs/mqtt-spec.md line 12). open() points the panel at the broker with
 * POST /api/mqtt and leaves the role off for the vector to pick. A step's mqtt goes to each connection
 * subscribed to its topic, and heard is each PUBLISH the panel sent.
 */
import net, { type AddressInfo } from "node:net";

import type { Panel, Sender } from "./_vectors";

/** A step's mqtt, and what heard holds. A send keeps it on the broker with retain: true. */
type Message = { topic: string; payload: string; retain?: boolean };

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
const [CONNECT, PUBLISH, SUBSCRIBE, PINGREQ, DISCONNECT] = [1, 3, 8, 12, 14];
const SETTLE_MS = 2000; // the longest a dial may take before settle() gives up on it

const isMessage = (m: unknown): m is Message =>
  typeof m === "object" && m !== null && Object.keys(m).every((k) => ["topic", "payload", "retain"].includes(k)) &&
  typeof (m as Message).topic === "string" && typeof (m as Message).payload === "string" && [undefined, true, false].includes((m as Message).retain);

export const mqtt: Sender = async () => {
  // Every connection, and once it has sent CONNECT, the topics it subscribed to.
  const clients = new Map<net.Socket, Set<string> | null>();
  const retained = new Map<string, Buffer>();
  const heard: Message[] = [];
  let [moved, panel] = [0, undefined as Panel | undefined]; // bytes in and out, which settle() watches

  const write = (s: net.Socket, b: Buffer) => ((moved += b.length), s.write(b));
  // To each subscriber with the retain flag clear, and kept for later ones when it is set. An empty one clears what was kept.
  function publish(topic: string, payload: Buffer, retain: boolean) {
    if (retain && payload.length) retained.set(topic, payload);
    else if (retain) retained.delete(topic);
    for (const [s, topics] of clients) if (topics?.has(topic)) write(s, packet(0x30, str(topic), payload));
  }

  function received(s: net.Socket, type: number, flags: number, body: Buffer) {
    const topics = clients.get(s);
    if (type === CONNECT) return void (clients.set(s, new Set()), write(s, packet(0x20, Buffer.from([0, 0]))));
    if (!topics) return void s.destroy(); // anything before CONNECT
    if (type === PUBLISH) {
      const at = 2 + body.readUInt16BE(0);
      const [topic, payload, retain] = [body.toString("utf8", 2, at), body.subarray(at + (flags & 6 ? 2 : 0)), (flags & 1) === 1];
      heard.push({ topic, payload: payload.toString(), retain });
      publish(topic, payload, retain);
      // QoS 0 has no answer, and a PINGRESP is one a client takes for nothing. Bytes going back carry the TCP ACK
      // at once, where the kernel would hold it 40 ms and the panel's next write behind it, by Nagle's rule.
      return void write(s, packet(0xd0));
    }
    if (type === SUBSCRIBE) {
      // Each filter is granted QoS 0, then gets what was kept on its topic, with the retain flag set.
      const filters: string[] = [];
      for (let at = 2; at < body.length; at += 3 + body.readUInt16BE(at)) filters.push(body.toString("utf8", at + 2, at + 2 + body.readUInt16BE(at)));
      filters.forEach((f) => topics.add(f));
      write(s, packet(0x90, body.subarray(0, 2), Buffer.alloc(filters.length)));
      for (const f of filters) if (retained.has(f)) write(s, packet(0x31, str(f), retained.get(f)!));
    } else if (type === PINGREQ) write(s, packet(0xd0));
    else if (type === DISCONNECT) s.end();
  }

  const server = net.createServer((s) => {
    clients.set(s, null);
    s.setNoDelay(true); // with Nagle on, a write behind one not yet acknowledged waits out a 40 ms delayed ACK
    let inbox: Buffer = Buffer.alloc(0);
    s.on("error", () => s.destroy());
    s.on("close", () => clients.delete(s));
    s.on("data", (chunk: Buffer) => {
      moved += chunk.length;
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
        received(s, type, flags, body);
      }
    });
  });
  await new Promise<void>((done, fail) => server.once("error", fail).listen(0, "127.0.0.1", () => done()));
  const port = (server.address() as AddressInfo).port;

  return {
    heard,
    async open(p) {
      panel = p;
      const r = await p.http("POST /api/mqtt", `host=127.0.0.1&port=${port}`);
      if (r.status !== 200) throw new Error(`POST /api/mqtt answered ${r.status}, so the panel has no mqtt feature to point at the broker`);
    },
    async send(what) {
      if (!isMessage(what)) throw new Error(`mqtt sends { "topic", "payload" }, and "retain": true to keep it, not ${JSON.stringify(what)}`);
      publish(what.topic, Buffer.from(what.payload), what.retain === true);
      return undefined;
    },
    // A dial, its CONNECT and CONNACK and the SUBSCRIBEs after them take real time, the panel's clock or not. Settled
    // once the panel is not mid-dial and a round trip over HTTP moved nothing on the broker.
    async settle() {
      for (const from = Date.now(); ; ) {
        const before = moved;
        for (let i = 0; i < 3; i++) await new Promise<void>((done) => setImmediate(done));
        const { state } = (await panel!.http("GET /api/mqtt")).body as { state?: string };
        if (state !== "connecting" && moved === before) return;
        if (Date.now() - from > SETTLE_MS) throw new Error(`the panel's MQTT is still ${state} after ${SETTLE_MS} ms`);
      }
    },
    async close() {
      for (const s of clients.keys()) s.destroy();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
};
