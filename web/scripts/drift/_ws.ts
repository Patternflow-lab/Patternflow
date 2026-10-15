/**
 * The WebSocket sender check:audio-vectors gives _vectors.ts. Node 20, which CI runs, has no WebSocket client, so
 * this is RFC 6455 on node:http's upgrade, as much as a client that only sends needs. One socket a vector, opened on
 * the panel's ws port before the first step. A step's ws is the text of one frame, or { "close": 1000 } for a close
 * frame with that code (docs/audio-ws-vectors/README.md). heard is each text frame the panel sent, and
 * docs/audio-ws-spec.md says it sends none.
 */
import { createHash, randomBytes } from "node:crypto";
import http from "node:http";
import type { Socket } from "node:net";

import type { Sender } from "./_vectors";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"; // RFC 6455's, for Sec-WebSocket-Accept
const [TEXT, CLOSE, PING, PONG] = [0x1, 0x8, 0x9, 0xa];
const SETTLE_MS = 2000; // the longest the panel may take to answer a ping or a close

/** One piece, masked as a client masks every frame, its length in the seven bits that hold up to 125 bytes. */
function frame(op: number, payload: Buffer) {
  if (payload.length > 125) throw new Error(`a ws message is 125 bytes at most, not ${payload.length}`);
  const mask = randomBytes(4);
  return Buffer.concat([Buffer.from([0x80 | op, 0x80 | payload.length]), mask, payload.map((x, i) => x ^ mask[i % 4])]);
}

export const ws: Sender = async () => {
  const [heard, waits] = [[] as string[], [] as (() => void)[]];
  let [socket, closed, buf] = [undefined as Socket | undefined, false, Buffer.alloc(0)];
  const gone = () => {
    closed = true;
    waits.splice(0).forEach((done) => done());
  };
  // The panel's frames are unmasked and short. A pong ends the oldest wait, and a close ends them all.
  function read(more: Buffer) {
    buf = Buffer.concat([buf, more]);
    while (buf.length >= 2 && buf.length >= 2 + (buf[1] & 0x7f)) {
      const [op, payload] = [buf[0] & 0x0f, buf.subarray(2, 2 + (buf[1] & 0x7f))];
      buf = buf.subarray(2 + payload.length);
      if (op === TEXT) heard.push(payload.toString("utf8"));
      else if (op === PONG) waits.shift()?.();
      else if (op === CLOSE) return void (gone(), socket?.end());
    }
  }
  // Writes a frame and resolves on the panel's answer, or once the socket closes.
  const answered = (b: Buffer) =>
    new Promise<void>((done, fail) => {
      if (closed) return done();
      const timer = setTimeout(() => fail(new Error(`the panel did not answer in ${SETTLE_MS} ms`)), SETTLE_MS);
      waits.push(() => (clearTimeout(timer), done()));
      socket!.write(b);
    });

  return {
    open: async ({ ports }) => {
      const key = randomBytes(16).toString("base64");
      const headers = { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Key": key, "Sec-WebSocket-Version": "13" };
      socket = await new Promise<Socket>((done, fail) => {
        const req = http.request({ host: "127.0.0.1", port: ports.ws, path: "/", headers, agent: false });
        req.once("response", (res) => fail(new Error(`the panel answered the handshake with ${res.statusCode}, not 101`)));
        req.once("upgrade", (res, s: Socket, head: Buffer) => {
          if (res.headers["sec-websocket-accept"] !== createHash("sha1").update(key + GUID).digest("base64")) return fail(new Error("Sec-WebSocket-Accept does not match the key"));
          s.setNoDelay(true); // a ping behind a message not yet acknowledged would wait out a 40 ms delayed ACK
          s.on("data", read).on("close", gone).on("error", () => s.destroy());
          done(s);
          read(head);
        });
        req.once("error", fail).end();
      });
    },
    send: async (what) => {
      if (closed) throw new Error("the socket is closed");
      if (typeof what === "string") return void socket!.write(frame(TEXT, Buffer.from(what)));
      const code = (what as { close?: unknown } | null)?.close;
      if (!Number.isInteger(code) || Object.keys(what as object).length !== 1) throw new Error(`ws sends a frame's text or { "close": code }, not ${JSON.stringify(what)}`);
      const b = Buffer.alloc(2);
      b.writeUInt16BE(code as number);
      await answered(frame(CLOSE, b)); // the panel's close frame back says it has read this one
    },
    heard,
    // A ping. The panel reads frames in order, so once its pong is back it holds every message sent before it.
    settle: () => answered(frame(PING, Buffer.alloc(0))),
    close: () => new Promise<void>((done) => (socket && !socket.destroyed ? socket.once("close", () => done()).destroy() : done())),
  };
};
