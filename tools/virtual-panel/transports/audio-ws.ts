/**
 * docs/audio-ws-spec.md's device side: a plain WebSocket on 81 on node:http (lines 17 to 21), the five messages and
 * the rule for anything else (27 to 34), the 500 ms release (71), and the switch (120 to 126) with GET and POST
 * /api/audio (rest-api.md lines 488 and 489). The lanes are DeviceSim's, so the bus outranks them and a hand takes
 * one for five seconds (38 to 49). The spec where it speaks, features/audio/ where it is silent: a value past its
 * range is clamped, a d= of 1 is a full range of clicks, and what arrives is taken at the end of a frame, six messages
 * a client at most. Where the firmware does something else the spec wins: a slot is skipped only when it is a lone -,
 * off=x is ignored, a d= holds no lane, and any socket that closes lets the lanes go, not only the last one.
 */
import { createHash } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Duplex } from "node:stream";

import { DETENTS_PER_TURN, KNOB_COUNT, TURNS_PER_FULL_RANGE } from "@/lib/shared/constants";

import type { Transport } from "../panel";

// The feature's numbers, by the names audio_config.h, core_audio_ws.h and net_config.h give them.
const PORT = 81; // PF_AUDIO_WS_PORT
const PASSES = 6; // handle() runs wsServer.loop() six times a frame, and each pass hands over one message a client
const SCALE = DETENTS_PER_TURN * TURNS_PER_FULL_RANGE; // PF_LANE_MOTION_SCALE: the clicks a d= of 1 makes
const FRAME_MS = 1000 / 60; // the frame panel.ts ticks DeviceSim at; handle() and fillInput() run once a frame
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"; // RFC 6455's, for Sec-WebSocket-Accept

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const KNOB = /^\d+$/;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lround = (v: number) => Math.sign(v) * Math.round(Math.abs(v)); // roundf(): 0.5 is 1 and -0.5 is -1

type Message = { kind: "a"; values: (number | null)[] } | { kind: "k" | "d"; knob: number; value: number } | { kind: "off"; knob: number | null };
/** One of the five, or null for anything else. N is a knob from 0 to 3 and F a decimal number. */
function parse(text: string): Message | null {
  const knob = (n: string) => (KNOB.test(n) && Number(n) < KNOB_COUNT ? Number(n) : null);
  if (text === "off") return { kind: "off", knob: null };
  if (text.startsWith("off=")) {
    const n = knob(text.slice(4));
    return n === null ? null : { kind: "off", knob: n };
  }
  if (text.startsWith("a=")) {
    const slots = text.slice(2).split(",");
    if (slots.length !== KNOB_COUNT || !slots.every((s) => s === "-" || NUMBER.test(s))) return null;
    return { kind: "a", values: slots.map((s) => (s === "-" ? null : clamp(Number(s), 0, 1))) };
  }
  const m = /^([kd])=([^,]*),v=(.*)$/.exec(text);
  const n = m && knob(m[2]);
  if (!m || n === null || !NUMBER.test(m[3])) return null;
  return m[1] === "k" ? { kind: "k", knob: n, value: clamp(Number(m[3]), 0, 1) } : { kind: "d", knob: n, value: clamp(Number(m[3]), -1, 1) };
}

// A frame from the panel: unmasked, one piece, a payload under 126 bytes. Only close and pong are sent.
const frame = (op: number, payload: Buffer) => Buffer.concat([Buffer.from([0x80 | op, payload.length]), payload]);
const [TEXT, CLOSE, PING, PONG] = [0x1, 0x8, 0x9, 0xa];

// DeviceSim keeps the edition's switches private: on the board a hand flips them on the NETWORK screen.
type Inside = { rowOn: boolean[] };
type Client = { socket: Duplex; inbox: string[]; closed: boolean };

export default {
  feature: "audio",
  caps: ["audio"],
  async attach({ sim, clock, routes, status, port, bound, onClose }) {
    // The AUD row, on as a board with nothing in NVS boots, and the WebSocket as the one source of the lanes.
    sim.setEdition("audio");
    sim.setLaneSource("ws");
    const [row, inside] = [sim.snapshot().rows.findIndex((r) => r.name === "AUD"), sim as unknown as Inside];
    if (row < 0) throw new Error("DeviceSim has no AUD row on the Audio edition");
    const on = () => inside.rowOn[row];

    // d= adds up between frames and reaches the pattern as whole clicks, the remainder carried (consumeKnobDelta()).
    const [pending, residual] = [Array<number>(KNOB_COUNT).fill(0), Array<number>(KNOB_COUNT).fill(0)];
    const release = (knob: number) => {
      sim.releaseLane("ws", knob);
      pending[knob] = residual[knob] = 0;
    };
    const releaseAll = () => [...Array(KNOB_COUNT).keys()].forEach(release);
    function receive(text: string) {
      const m = parse(text);
      if (!m || !on()) return; // switched off, a message is read and drives nothing (line 123)
      if (m.kind === "a") m.values.forEach((v, i) => v !== null && sim.setLane("ws", i, v));
      else if (m.kind === "k") sim.setLane("ws", m.knob, m.value);
      else if (m.kind === "d") pending[m.knob] += m.value;
      else if (m.knob === null) releaseAll();
      else release(m.knob);
    }

    const clients = new Set<Client>();
    const open = () => [...clients].filter((c) => !c.closed).length;
    let was = on();
    clock.every(FRAME_MS, () => {
      // A hand that turns AUD off on the NETWORK screen lets the lanes go, as POST /api/audio on=0 does.
      if (was && !on()) releaseAll();
      was = on();
      for (const c of clients) {
        for (const text of c.inbox.splice(0, PASSES)) receive(text);
        if (c.closed && !c.inbox.length) {
          clients.delete(c);
          releaseAll(); // the socket closed (line 51)
        }
      }
      for (let i = 0; i < KNOB_COUNT; i++) {
        if (!pending[i]) continue;
        const move = pending[i] * SCALE + residual[i];
        const clicks = lround(move);
        [pending[i], residual[i]] = [0, Math.abs(move - clicks) < 0.001 ? 0 : move - clicks];
        if (clicks) sim.nudge(i, clicks); // no hand made them, so they take no lane and free no channel
      }
    });

    // RFC 6455 as far as a client that only sends needs it. A request that is no handshake gets a 400.
    function accept(req: http.IncomingMessage, socket: Duplex, head: Buffer) {
      const key = req.headers["sec-websocket-key"];
      if (req.method !== "GET" || req.headers.upgrade?.toLowerCase() !== "websocket" || !key || req.headers["sec-websocket-version"] !== "13") {
        socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
        return;
      }
      const accepted = createHash("sha1").update(key + GUID).digest("base64");
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accepted}\r\n\r\n`);
      const c: Client = { socket, inbox: [], closed: false };
      clients.add(c);
      socket.on("close", () => void (c.closed = true)).on("error", () => socket.destroy());
      const shut = (code: number) => {
        c.closed = true;
        const b = Buffer.alloc(2);
        b.writeUInt16BE(code);
        socket.end(frame(CLOSE, b));
      };
      let buf = head;
      const read = (more: Buffer) => {
        buf = Buffer.concat([buf, more]);
        while (buf.length >= 2 && !c.closed) {
          if (!(buf[1] & 0x80)) return shut(1002); // a client masks every frame
          const [fin, op] = [buf[0] & 0x80, buf[0] & 0x0f];
          let [size, at] = [buf[1] & 0x7f, 2];
          if (size === 126) [size, at] = [buf.length < 4 ? NaN : buf.readUInt16BE(2), 4];
          else if (size === 127) [size, at] = [buf.length < 10 ? NaN : Number(buf.readBigUInt64BE(2)), 10];
          const end = at + 4 + size;
          if (Number.isNaN(end) || buf.length < end) return;
          const payload = Buffer.from(buf.subarray(at + 4, end).map((x, i) => x ^ buf[at + (i % 4)]));
          buf = buf.subarray(end);
          // A text frame is a message. A piece of a longer one, or a binary frame, is dropped as handle() drops it.
          if (op === TEXT && fin) c.inbox.push(payload.toString("latin1"));
          else if (op === PING) socket.write(frame(PONG, payload.subarray(0, 125)));
          else if (op === CLOSE) return shut(payload.length >= 2 ? payload.readUInt16BE(0) : 1000);
          else if (op > 2 && op !== PONG) return shut(1002);
        }
      };
      socket.on("data", read);
      read(Buffer.alloc(0));
    }
    const server = http.createServer((_, res) => void res.writeHead(400, { Connection: "close" }).end());
    server.on("upgrade", accept);
    await new Promise<void>((done, fail) => void server.once("error", fail).listen(port("ws", PORT), () => done()));
    bound.ws = (server.address() as AddressInfo).port;
    onClose(() => {
      for (const c of clients) c.socket.destroy();
      return new Promise<void>((done) => (server.closeAllConnections(), server.close(() => done())));
    });

    // feature_audio.h's two routes. on is 1 or true to switch on, and any other value switches off.
    const set = (to: boolean) => {
      if (!to) releaseAll();
      inside.rowOn[row] = to;
    };
    routes("GET", "/api/audio", () => ({ body: { audioRuntime: on(), audioClients: open() } }));
    routes("POST", "/api/audio", ({ args }) => {
      if (args.has("on")) set(args.get("on") === "1" || args.get("on") === "true");
      return { body: { ok: true, audioRuntime: on() } };
    });
    status.push(() => ({ audioRuntime: on(), audioClients: open() }));
  },
} satisfies Transport;
