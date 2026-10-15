/**
 * docs/midi-spec.md's device → host table (lines 57 to 60) on midi.ts's session, with GET and POST /api/midi (115 to
 * 120) and the midi block in /api/status (68 to 93). Once a frame, as observeFrame() in features/midi/core_midi.h runs:
 * a hand's clicks become steps by each knob's outDiv and outMul, the remainder carried, and leave as CC 24 to 27 at
 * most once a knob every 50 ms, the last value always; a hand's button is a note, and a new pattern a Program Change.
 * knobs counts a hand's clicks and nothing else's, so a CC or note a host sent never comes back (line 62), and neither
 * does a lane. The spec where it speaks, core_midi.h and core_midi_http.h where it is silent: the order the arguments
 * are read in and the error texts, outDiv and outMul resetting each other even to 1, tx counting what goes out with
 * nobody joined, and the pattern under SELECT's cursor as the one that changed. runtime stays true and on= is not
 * read, since midi.ts applies what comes in whatever a switch says. host is kept and reported, and nobody is invited,
 * since midi.ts never invites. you, the asker's address, is left out: a route is not told who asked.
 */
import { isIPv4 } from "node:net";

import { SIM_IP } from "@/lib/guide/deviceSim";
import { KNOB_COUNT } from "@/lib/shared/constants";

import type { Reply } from "../http";
import type { Transport } from "../panel";
import { midi } from "./midi";

// The feature's numbers, by the names core_midi.h gives them.
const [CHANNEL, REL, NOTE] = [1, 24, 60]; // PF_MIDI_CHANNEL, PF_MIDI_CC_REL_BASE, PF_MIDI_NOTE_BASE
const [DIV_MAX, MUL_MAX, PACE_MS] = [16, 8, 50]; // OUT_DIVISOR_MAX, OUT_MULTIPLIER_MAX, PF_MIDI_OUT_MIN_INTERVAL_MS
const STEPS_MAX = 63; // the most one relative CC carries either way
const FRAME_MS = 1000 / 60; // the frame panel.ts ticks DeviceSim at; observeFrame() runs once a frame
const CH = (CHANNEL || 1) - 1; // channel 0 sends on 1 (line 31), and the status nibble counts from 0
const [CC, NOTE_ON, NOTE_OFF, PROGRAM] = [0xb0 | CH, 0x90 | CH, 0x80 | CH, 0xc0 | CH];

const toInt = (v: string) => parseInt(v, 10) || 0; // String::toInt(): leading digits, else 0
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fail = (error: string): Reply => ({ status: 400, body: { ok: false, error } });
const each = <T>(v: T) => Array<T>(KNOB_COUNT).fill(v);

export default {
  feature: "midi",
  caps: [], // midi.ts gives "midi"
  attach({ sim, clock, routes, status, bound, on }) {
    // midi.ts sorts after this file and attaches after it, so the session is looked up once a frame or a request comes.
    const session = () => midi(sim)!;
    // PF_MIDI_OUT_DIVISOR, PF_MIDI_OUT_MULTIPLIER and PF_MIDI_OUT_ABSOLUTE, and no host to invite.
    const [outDiv, outMul] = [each(1), each(1)];
    let [absolute, host, tx] = [true, "", 0];
    // Per knob: the clicks outDiv has not made a step of, the position abs keeps and the one the host last heard, the
    // steps rel has not sent, and when the knob last went out. The first message goes out at once.
    const [accum, pos, sentPos, pending, lastSent] = [each(0), each(64), each(64), each(0), each(-Infinity)];
    const emit = (...message: number[]) => {
      tx++; // emit() counts it, a participant joined or not
      session().send(message);
    };

    // A hand's buttons as the frame reads them: a press is the edge down, held the state, sounding a note-on sent.
    const [held, pressed, sounding] = [each(false), each(false), each(false)];
    on("button", ({ knob, down }) => {
      if (down && !held[knob - 1]) pressed[knob - 1] = true;
      held[knob - 1] = down;
    });
    let [clicks, index] = [[...sim.knobState().knobs], sim.snapshot().patternIndex];

    clock.every(FRAME_MS, () => {
      const now = Math.floor(clock.now() + 1e-6); // millis(): one clock for all four knobs, in whole ms
      const knobs = sim.knobState().knobs;
      for (let i = 0; i < KNOB_COUNT; i++) {
        if (knobs[i] !== clicks[i]) {
          // Whole steps go out and the rest waits. Truncation keeps the sign, so turning back cancels it.
          accum[i] += knobs[i] - clicks[i];
          const whole = Math.trunc(accum[i] / outDiv[i]);
          accum[i] -= whole * outDiv[i];
          const steps = clamp(whole * outMul[i], -STEPS_MAX, STEPS_MAX);
          if (absolute) pos[i] = clamp(pos[i] + steps, 0, 127);
          else pending[i] += steps;
        }
        // The pacer runs on every frame, motion or not: a still frame is the one that sends the last value.
        const due = now - lastSent[i] >= PACE_MS;
        if (absolute && due && pos[i] !== sentPos[i]) {
          [sentPos[i], lastSent[i]] = [pos[i], now];
          emit(CC, REL + i, pos[i]);
        } else if (!absolute && pending[i] && (due || Math.abs(pending[i]) > STEPS_MAX)) {
          // A sum past ±63 cannot wait, and what one message cannot carry stays for the next.
          const send = clamp(pending[i], -STEPS_MAX, STEPS_MAX);
          [pending[i], lastSent[i]] = [pending[i] - send, now];
          emit(CC, REL + i, 64 + send);
        }
        if (pressed[i]) {
          emit(NOTE_ON, NOTE + i, 127);
          sounding[i] = true;
        }
        // Every note-on gets its note-off, a button down and up inside one frame too.
        if (sounding[i] && !held[i]) {
          emit(NOTE_OFF, NOTE + i, 0);
          sounding[i] = false;
        }
      }
      clicks = [...knobs];
      pressed.fill(false);
      // Whoever changed it, MIDI included (line 60). On SELECT it is the one under the cursor, as currentPatternIdx is.
      const shown = sim.snapshot().patternIndex;
      if (shown !== index) {
        index = shown;
        if (shown <= 127) emit(PROGRAM, shown);
      }
    });

    // appendStatus()'s block. rxDetail's counters past what midi.ts keeps stay at 0: no worker task, no queue out.
    const block = () => {
      const r = session().read();
      const rxDetail = {
        ...{ worker: true, abs: r.abs, rel: r.rel, queueDropped: r.queueDropped, txQueueDropped: 0, packetGaps: 0 },
        ...{ parseErrors: 0, bufferOverflows: 0, pollMaxGapUs: 0, pollMaxUs: 0, queueMaxAgeUs: 0, stackMin: 0 },
      };
      const outMode = absolute ? "abs" : "rel";
      const peer = r.peers[r.peers.length - 1] ?? ""; // the one that joined last
      return { runtime: true, channel: CHANNEL, outDiv: [...outDiv], outMul: [...outMul], outMode, host, rtpPeers: r.peers.length, rtpPeer: peer, rx: r.rx, tx, rxDetail };
    };
    // sendState(): the same, with where to find the session and each knob's position.
    const state = (): Reply => ({ body: { ok: true, ...block(), ip: SIM_IP, port: bound.midi, outPos: [...pos] } });

    routes("GET", "/api/midi", state);
    // knob first, then outDiv, outMul, outMode and host, each applied before the next is read.
    routes("POST", "/api/midi", ({ args }) => {
      const knob = args.has("knob") ? toInt(args.get("knob")!) - 1 : -1;
      if (args.has("knob") && (knob < 0 || knob >= KNOB_COUNT)) return fail("knob must be 1..4");
      // A gain is one number, ×N, 1:1 or 1/N, so setting either side resets the other (line 117), and the carry goes.
      const gain = (div: number, mul: number) => {
        for (let i = 0; i < KNOB_COUNT; i++) if (knob < 0 || i === knob) [outDiv[i], outMul[i], accum[i]] = [div, mul, 0];
      };
      const [div, mul] = [toInt(args.get("outDiv") ?? ""), toInt(args.get("outMul") ?? "")];
      if (args.has("outDiv") && (div < 1 || div > DIV_MAX)) return fail("outDiv must be 1..16");
      if (args.has("outDiv")) gain(div, 1);
      if (args.has("outMul") && (mul < 1 || mul > MUL_MAX)) return fail("outMul must be 1..8");
      if (args.has("outMul")) gain(1, mul);
      const mode = args.get("outMode");
      if (mode !== null && mode !== "abs" && mode !== "rel") return fail("outMode must be abs or rel");
      if (mode !== null) {
        absolute = mode === "abs";
        // Steps summed for one encoding mean nothing in the other.
        [accum, pending].forEach((a) => a.fill(0));
      }
      const to = args.get("host");
      if (to !== null && to !== "" && !isIPv4(to)) return fail("host must be an IPv4 address or empty");
      if (to !== null) host = to;
      return state();
    });
    status.push(() => ({ midi: block() }));
  },
} satisfies Transport;
