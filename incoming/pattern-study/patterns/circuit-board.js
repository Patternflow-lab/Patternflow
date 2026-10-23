// ===== Patternflow pattern =====
// Title:   Circuit Board
// Family:  circuit
// Idea:    A circuit board fills the panel with copper a maze router lays in setup between a processor, two memory chips, a flash chip, a crystal and the gold fingers of an edge connector, and signals run along the traces as bright pulses while four status LEDs answer the traffic.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: C. Y. Lee's maze router ("An algorithm for path connections and its applications", 1961), here with 45-degree moves
// Round:   17
// ===============================
// @matrix 64x128
// @knobs Mask=0..1, Clock=0.5..4, Traffic=0..1, Glow=0..1
//
// Knob 1: Mask. The colour of the solder mask: green at 0, then blue, red, matte black and purple at 1.
// Knob 2: Clock. How fast the board runs: at 2 the crystal ticks six times a second and a pulse covers 32 LEDs a second, at 0.5 a quarter of that, at 4 twice.
// Knob 3: Traffic. At 0 the processor works through its program in spells of 2.4 s (loading from the flash, computing in memory, input and output, a rest, a copy out to the connector); turned up, the quiet buses fill until at 1 every bus carries trains back to back.
// Knob 4: Glow. How far the light of a pulse spreads through the mask, and how long a busy trace stays warm after it, from one second to three.
// Buttons: K1 tap resets the board: it goes dark, the power LED comes on, the crystal starts, the processor reads the flash, walks a one across both memory buses and brings the link up.

const W = 64;
const H = 128;
const N = W * H;
// What each LED of the bare board is: mask (0) over bare board, over a trace
// or over the pour, or a part coloured from FIX.
const TRACE = 1;
const POUR = 2;
const PAD = 3;
const CHIP = 4;
const SILK = 5;
const HOLE = 6;
const GOLD = 7;
const RES = 8;
const LENS = 9;
const CAN = 10;
const BASE = 11;
const VIA = 12;
const ETCH = 13;
const FIX = [[196, 196, 186], [30, 30, 34], [222, 222, 208], [0, 0, 0], [228, 172, 52], [24, 24, 24], [120, 122, 112], [212, 214, 220], [36, 36, 40], [170, 170, 152], [92, 92, 98]];
// Solder mask over bare board and over copper, for the five stops of K1.
const MASKS = [
  [[10, 70, 34], [44, 124, 52]],
  [[8, 32, 96], [38, 84, 170]],
  [[96, 12, 14], [164, 50, 40]],
  [[16, 17, 19], [46, 50, 52]],
  [[56, 16, 86], [112, 58, 154]],
];
// Signal light: data, clock, connector, flash, LED drive.
const SIG = [[255, 196, 80], [90, 225, 255], [255, 110, 215], [150, 255, 110], [255, 255, 240]];
// Status LEDs (power, heartbeat, connector, memory): lens top and colour lit.
const LENS_AT = [[39, 24], [31, 30], [33, 30], [35, 30]];
const LED_ON = [[60, 255, 90], [255, 50, 40], [255, 176, 30], [70, 130, 255]];
// The program, as spells of 2.4 s at Clock 2 (load, compute, input and output,
// rest, copy), each the load on buses A and B (memory), C (connector), L and
// R (memory to connector) and S (flash).
const WORK = [[1.5, 0.3, 0.2, 0.1, 0.1, 3], [2.6, 2.6, 0.2, 0.1, 0.1, 0.2], [0.3, 0.3, 2.6, 1.8, 1.8, 0.2], [0.15, 0.15, 0.2, 0.1, 0.1, 0.2], [2, 2, 2.4, 2.5, 2.5, 0.2]];
const COPY = 4;
// The router's moves: straight steps cost 5, diagonal ones 7, so a route is
// straight runs joined by 45-degree runs.
const DX = [1, 0, -1, 0, 1, -1, -1, 1];
const DY = [0, 1, 0, -1, 1, 1, -1, -1];
// Bits on a bus are 4 LEDs apart; a pulse's tail is 2 LEDs.
const GAP = 4;
const TAIL = 2;
// A 3x5 font for the markings on the chips.
const FONT = { U: 0x5b6f, 1: 0x2c97, 2: 0x73e7, 3: 0x73cf, 4: 0x5bc9 };

function inside(x, y) {
  return x >= 0 && y >= 0 && x < W && y < H;
}

function put(P, x, y, m, s) {
  if (!inside(x, y)) return;
  P.mat[y * W + x] = m;
  P.shade[y * W + x] = s || 1;
}

// Copper keeps every other net one LED away: blk holds the net that may pass
// each LED, 0 for any and -1 for none.
function claim(P, x, y, net) {
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      if (!inside(x + i, y + j)) continue;
      const k = (y + j) * W + x + i;
      if (!P.blk[k]) P.blk[k] = net;
      else if (P.blk[k] !== net) P.blk[k] = -1;
    }
}

function copper(P, x, y, net) {
  claim(P, x, y, net);
  P.blk[y * W + x] = net;
}

function block(P, x0, y0, x1, y1) {
  for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (inside(x, y)) P.blk[y * W + x] = -1;
}

function pad(P, x, y, net, s) {
  put(P, x, y, PAD, s);
  copper(P, x, y, net);
}

function reserve(P, x, y, net) {
  const v = P.blk[y * W + x];
  if (!v || v === net) copper(P, x, y, net);
}

// A gull-wing lead. The LED in front of its tip is kept for its own net and
// the others round the tip are shut, so the route leaves straight out.
function lead(P, x, y, dx, dy, net) {
  for (let i = 0; i < 3; i++) pad(P, x + dx * i, y + dy * i, net, i === 2 ? 0.7 : 1);
  reserve(P, x - dx, y - dy, net);
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const k = (y + j) * W + x + i;
      if ((i || j) && (i !== -dx || j !== -dy) && (i !== dx || j !== dy) && inside(x + i, y + j) && (!P.blk[k] || P.blk[k] === net)) P.blk[k] = -1;
    }
  return [x, y];
}

function chip(P, x0, y0, x1, y1) {
  block(P, x0, y0, x1, y1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(P, x, y, CHIP, y === y0 || x === x0 ? 1.45 : y === y1 || x === x1 ? 0.7 : 1);
}

function text(P, s, x, y) {
  for (const ch of s) {
    for (let b = 0; b < 15; b++) if (FONT[ch] & (1 << (14 - b))) put(P, x + (b % 3), y + Math.floor(b / 3), ETCH);
    x += 4;
  }
}

function via(P, x, y, net) {
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      put(P, x + i, y + j, i || j ? VIA : HOLE, i && j ? 0.8 : 1);
      copper(P, x + i, y + j, net);
    }
}

// A resistor and a LED in a line, from the resistor's far pad at y0 to the
// LED's, which is ground, eight rows on in direction dy.
function ledPair(P, x, y0, dy, net, inner) {
  pad(P, x, y0, net);
  for (let i = 3; i <= 5; i++) pad(P, x, y0 + dy * i, inner);
  put(P, x, y0 + dy * 4, TRACE);
  pad(P, x, y0 + dy * 8, 1);
  for (const [i, m] of [[1, RES], [2, RES], [6, LENS], [7, LENS]]) {
    put(P, x, y0 + dy * i, m);
    P.blk[(y0 + dy * i) * W + x] = -1;
  }
}

// Lee's wave: every LED the net may cross gets its distance from the start,
// cheapest first, until the wave reaches the end; the route is read back
// from the end, keeping its direction where it can. With `diag` its first
// turn is a diagonal, so a fan to the wider fingers jogs where there is room.
function route(P, net, a, b, diag) {
  const dist = P.dist;
  const blk = P.blk;
  const ring = P.ring;
  dist.fill(1e9);
  for (const q of ring) q.length = 0;
  const s = a[1] * W + a[0];
  const t = b[1] * W + b[0];
  dist[s] = 0;
  ring[0].push(s);
  let pending = 1;
  for (let d = 0; pending > 0 && d <= dist[t]; d++) {
    const q = ring[d & 7];
    while (q.length) {
      const u = q.pop();
      pending--;
      if (dist[u] !== d) continue;
      const x = u % W;
      const y = (u - x) / W;
      for (let k = 0; k < 8; k++) {
        const v = u + DY[k] * W + DX[k];
        if (!inside(x + DX[k], y + DY[k]) || (blk[v] && blk[v] !== net)) continue;
        const nd = d + (k < 4 ? 5 : 7);
        if (nd < dist[v]) {
          dist[v] = nd;
          ring[nd & 7].push(v);
          pending++;
        }
      }
    }
  }
  if (dist[t] >= 1e9) return null;
  const path = [t];
  let last = -1;
  for (let u = t; u !== s; ) {
    const x = u % W;
    const y = (u - x) / W;
    let best = -1;
    let bk = -1;
    let score = -1;
    for (let k = 0; k < 8; k++) {
      const p = u - DY[k] * W - DX[k];
      if (!inside(x - DX[k], y - DY[k]) || dist[p] + (k < 4 ? 5 : 7) !== dist[u]) continue;
      const sc = (k === last ? 4 : 0) + (k < 4 ? 1 : 0) + (diag && k >= 4 ? 6 : 0);
      if (sc > score) {
        score = sc;
        best = p;
        bk = k;
      }
    }
    path.push(best);
    u = best;
    last = bk;
    if (bk >= 4) diag = false;
  }
  for (const c of path) {
    copper(P, c % W, Math.floor(c / W), net);
    if (!P.mat[c]) P.mat[c] = TRACE;
  }
  return Int16Array.from(path.reverse());
}

function buildBoard(P) {
  const jobs = [];
  let id = 2;
  const net = (cls, grp, line) => ({ id: id++, cls, grp, line });
  // Short nets are routed first, then fans and buses, each line in the order
  // that lets the next pass outside it.
  const link = (n, a, b, o, diag) => jobs.push({ n, a, b, o: o || 9, diag });
  const gnd = (a, x, y) => {
    via(P, x, y, 1);
    link({ id: 1, cls: -1 }, a, [x, y], 1);
  };
  // Mounting holes, plated, in the two top corners.
  for (const cx of [4, 59]) {
    block(P, cx - 3, 1, cx + 3, 7);
    for (let y = 0; y <= 8; y++)
      for (let x = cx - 4; x <= cx + 4; x++) {
        const r = Math.hypot(x - cx, y - 4);
        if (r < 1.9) put(P, x, y, HOLE);
        else if (r < 3.4) put(P, x, y, PAD, 0.9 + 0.25 * Math.cos(Math.atan2(y - 4, x - cx) + 2.3));
      }
  }
  // The processor, a QFP with nine leads a side, and two memory chips under it.
  chip(P, 22, 44, 41, 63);
  put(P, 24, 46, ETCH);
  text(P, "U1", 28, 51);
  chip(P, 1, 84, 20, 93);
  chip(P, 43, 84, 62, 93);
  text(P, "U2", 7, 87);
  text(P, "U3", 49, 87);
  // Memory buses: nine lines from each side of the processor down to the top
  // leads of a memory chip, the innermost being that chip's clock.
  for (const side of [0, 1])
    for (let j = 8; j >= 0; j--) {
      const n = net(j === 8 ? 1 : 0, side ? "B" : "A", j);
      const a = side ? lead(P, 44, 45 + 2 * j, -1, 0, n.id) : lead(P, 19, 45 + 2 * j, 1, 0, n.id);
      link(n, a, lead(P, side ? 60 - 2 * j : 3 + 2 * j, 81, 0, 1, n.id));
    }
  // Nineteen gold fingers, two LEDs wide, the outer two ground.
  const finger = (i, nid) => {
    const x0 = 4 + 3 * i;
    for (let y = 116; y < H; y++)
      for (let x = x0; x <= x0 + 1; x++) {
        put(P, x, y, GOLD, y === 116 ? 0.75 : y === H - 1 ? 0.6 : x === x0 ? 1.1 : 0.9);
        copper(P, x, y, nid);
      }
    return x0;
  };
  finger(0, 1);
  finger(18, 1);
  // Nine lines from the bottom of the processor fan out to the middle fingers.
  for (let j = 0; j < 9; j++) {
    const n = net(2, "C", j);
    const f = finger(5 + j, n.id);
    reserve(P, f, 115, n.id);
    link(n, lead(P, 23 + 2 * j, 66, 0, -1, n.id), [f, 116], 9, true);
  }
  // Four lines from each memory chip's bottom leads to the outer fingers.
  for (const side of [0, 1])
    for (let j = 0; j < 9; j++) {
      const x = side ? 60 - 2 * j : 3 + 2 * j;
      if (j >= 1 && j <= 4) {
        const n = net(2, side ? "R" : "L", j - 1);
        const a = lead(P, x, 96, 0, -1, n.id);
        const f = finger(side ? 18 - j : j, n.id) + side;
        reserve(P, f, 115, n.id);
        link(n, a, [f, 116], 9, true);
      } else if (j === 0) gnd(lead(P, x, 96, 0, -1, 1), side ? 61 : 2, 100);
      else lead(P, x, 96, 0, -1, id++);
    }
  // The flash chip on its side at the top left; its four right leads take
  // the processor's first four top leads, the lowest to the nearest.
  chip(P, 4, 24, 11, 33);
  text(P, "U4", 5, 27);
  for (let j = 0; j < 4; j++) {
    const n = net(3, "S", j);
    link(n, lead(P, 23 + 2 * j, 41, 0, 1, n.id), lead(P, 14, 32 - 2 * j, -1, 0, n.id), 4);
    lead(P, 1, 32 - 2 * j, 1, 0, id++);
  }
  // Three status LEDs over the next three top leads; each top pad meets the pour.
  P.ledNet = [{ id: 0, cls: 4, grp: "D", line: 0 }];
  for (let k = 1; k < 4; k++) {
    const x = 29 + 2 * k;
    const n = net(4, "D", k);
    P.ledNet.push(n);
    ledPair(P, x, 37, -1, n.id, id++);
    link(n, lead(P, x, 41, 0, 1, n.id), [x, 37], 3);
  }
  // The crystal, a metal can on two pads, on the last two top leads.
  block(P, 45, 34, 54, 38);
  for (let y = 34; y <= 38; y++)
    for (let x = 45; x <= 54; x++) if ((y - 34) % 4 || (x - 45) % 9) put(P, x, y, CAN, y === 35 ? 1.2 : y === 38 ? 0.62 : 0.9);
  for (let j = 0; j < 2; j++) {
    const n = net(1, "X", j);
    for (let y = 35; y <= 37; y++) for (let x = 42 + 14 * j; x <= 43 + 14 * j; x++) pad(P, x, y, n.id);
    link(n, lead(P, 37 + 2 * j, 41, 0, 1, n.id), j ? [56, 37] : [42, 36], 2);
  }
  // The regulator, a SOT-223 under its tab, between two electrolytic capacitors.
  chip(P, 27, 8, 36, 12);
  for (let y = 3; y <= 6; y++) for (let x = 28; x <= 35; x++) pad(P, x, y, 1, y === 3 ? 0.8 : 1);
  const vin = id++;
  const vout = id++;
  for (let k = 0; k < 3; k++)
    for (let y = 14; y <= 16; y++) for (let i = 0; i < 2; i++) pad(P, 28 + 3 * k + i, y, [vin, 1, vout][k], y === 14 ? 0.7 : 1);
  for (const [cx, side] of [[14, 0], [49, 1]]) {
    block(P, cx - 5, 6, cx + 5, 16);
    for (let y = 6; y <= 16; y++)
      for (let x = cx - 5; x <= cx + 5; x++) {
        const r = Math.hypot(x - cx, y - 11);
        if (Math.abs(x - cx) + Math.abs(y - 11) > 8) continue;
        if (r < 4.3) put(P, x, y, CAN, 1.05 - 0.05 * r + 0.12 * Math.cos(Math.atan2(y - 11, x - cx) + 2.3) - (x === cx || y === 11 ? 0.28 : 0));
        else put(P, x, y, BASE);
      }
    // Its tabs: the plus side to the regulator, the other to ground.
    for (let y = 10; y <= 12; y++)
      for (let i = 0; i < 2; i++) {
        pad(P, cx - 7 + i, y, side ? vout : 1);
        pad(P, cx + 6 + i, y, side ? 1 : vin);
      }
  }
  // The power LED hangs under its resistor beside the regulator.
  P.ledNet[0].id = vout;
  ledPair(P, 39, 18, 1, vout, id++);
  link({ id: vin, cls: 4 }, [28, 16], [21, 12], 2);
  link({ id: vout, cls: 4 }, [35, 16], [42, 12], 2);
  link(P.ledNet[0], [35, 16], [39, 18], 3);
  // Route in that order; a net the router cannot reach is left off the board.
  jobs.sort((a, b) => a.o - b.o);
  P.routes = [];
  P.group = {};
  let off = 0;
  for (const { n, a, b, diag } of jobs) {
    const cells = route(P, n.id, a, b, diag);
    if (!cells || n.cls < 0) continue;
    const r = { cells, n: cells.length, o: off, cls: n.cls, grp: n.grp, line: n.line };
    off += r.n;
    P.routes.push(r);
    if (n.grp) (P.group[n.grp] = P.group[n.grp] || [])[n.line] = r;
  }
  P.heat = new Float32Array(off);
  // Ground pour fills the rest a LED clear of other copper, stitched by a via
  // wherever a 5x5 patch of it is free.
  for (let c = 0; c < N; c++) if (!P.mat[c] && (P.blk[c] === 0 || P.blk[c] === 1)) P.mat[c] = POUR;
  for (let y = 6; y < 112; y += 7)
    for (let x = 3 + (Math.floor(y / 7) % 2) * 3; x < W - 3; x += 7) {
      let ok = true;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (P.mat[(y + j) * W + x + i] !== POUR) ok = false;
      if (ok) via(P, x, y, 1);
    }
  // Silkscreen: corner marks round the processor and its pin-one dot.
  for (const [x, y, dx, dy] of [[17, 40, 1, 1], [46, 40, -1, 1], [17, 67, 1, -1], [46, 67, -1, -1]])
    for (let i = 0; i < 3; i++) {
      put(P, x + dx * i, y, SILK);
      put(P, x, y + dy * i, SILK);
    }
  put(P, 19, 42, SILK);
}

function paintBoard(P) {
  const k = Math.min(3.999, Math.max(0, P.mask) * 4);
  const i0 = Math.floor(k);
  const f = k - i0;
  const mix = (j) => MASKS[i0][j].map((v, c) => v + (MASKS[i0 + 1][j][c] - v) * f);
  const M = mix(0);
  const C = mix(1);
  const pour = M.map((v, i) => v + (C[i] - v) * 0.55);
  for (let p = 0; p < N; p++) {
    const m = P.mat[p];
    const s = m < PAD ? 1 : P.shade[p];
    const c = m === TRACE ? C : m === POUR ? pour : m ? FIX[m - PAD] : M;
    for (let i = 0; i < 3; i++) P.base[p * 3 + i] = c[i] * s;
  }
  P.maskAt = P.mask;
}

export function setup(params) {
  const P = params;
  P.mat = new Uint8Array(N);
  P.shade = new Float32Array(N).fill(1);
  P.blk = new Int16Array(N);
  P.dist = new Int32Array(N);
  P.ring = [[], [], [], [], [], [], [], []];
  buildBoard(P);
  for (const k of ["base", "buf", "E", "T", "G"]) P[k] = new Float32Array(N * 3);
  Object.assign(P, { maskAt: -1, mask: 0, glow: 0, pulses: [], t: 0, next: {}, busy: {}, clear: {}, rev: {}, act: 0, mem: 0, tick: 0, boot: -1, started: false });
  // The program starts near the end of a rest, a spell before the copy.
  P.spell = 1.8;
  P.led = new Float32Array(4);
  P.ledWas = new Uint8Array(4);
}

function bits(n, p) {
  const out = [1];
  for (let i = 1; i < n; i++) out.push(Math.random() < p ? 1 : 0);
  return out;
}

// Puts a train of bits on a route, from its first end or, reversed, its last;
// returns the seconds until the train has left the route.
function train(P, r, rev, b, at) {
  if (!r) return 0;
  for (let i = 0; i < b.length; i++) if (b[i]) P.pulses.push({ r, rev, s: -(at || 0) - i * GAP });
  return (r.n + (at || 0) + b.length * GAP + TAIL) / P.v;
}

// One transaction on group g once the last has gone onto the bus; a train the
// other way waits for the bus to clear.
function transact(P, g, kind) {
  const lines = P.group[g];
  if (!lines || P.busy[g] > P.t) return;
  let rev = P.clear[g] > P.t ? P.rev[g] : Math.random() < 0.5;
  const n = kind === 1 ? 8 + Math.floor(Math.random() * 7) : kind ? 16 : 4 + Math.floor(Math.random() * 5);
  let dur = 0;
  if (kind === 0) {
    // A memory cycle: eight data lines in step and the chip's clock with them.
    for (let j = 0; j < 8; j++) dur = Math.max(dur, train(P, lines[j], rev, bits(n, 0.5)));
    train(P, lines[8], false, bits(n, 1));
    P.mem = Math.max(P.mem, P.t + dur * 0.6);
  } else if (kind === 1) {
    // A packet on a pair of lines, or a burst on all, as a copy mostly sends.
    const all = Math.random() < (P.copy ? 0.8 : 0.25);
    const j0 = Math.floor(Math.random() * (lines.length - 1));
    const b = bits(all ? 4 : n, 0.6);
    for (let j = 0; j < lines.length; j++) if (all || j === j0 || j === j0 + 1) dur = Math.max(dur, train(P, lines[j], rev, b));
    P.act = Math.max(P.act, P.t + 0.25 + dur * 0.4);
  } else {
    // A flash read: chip select, sixteen clocks, a command out and a byte back.
    rev = false;
    train(P, lines[0], false, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    train(P, lines[1], false, bits(16, 1));
    train(P, lines[2], false, bits(8, 0.5));
    dur = train(P, lines[3], true, bits(8, 0.5), 8 * GAP);
  }
  P.busy[g] = P.t + (n * GAP + 2) / P.v;
  P.clear[g] = P.t + dur;
  P.rev[g] = rev;
}

// After a reset: power at 0.5 s, the crystal at 0.9, flash reads to 2.6, a one
// walked across both memory buses, the buses filled, then two link bursts.
function bootStep(P, dt) {
  const b0 = P.boot;
  const b1 = (P.boot += dt);
  const at = (x) => b0 < x && b1 >= x;
  const all = (g, rev, b) => {
    for (let j = 0; j < 9; j++) train(P, P.group[g] && P.group[g][j], rev, b);
  };
  if (b1 > 1 && b1 < 2.6) transact(P, "S", 2);
  for (let j = 0; j < 9; j++)
    if (at(2.7 + j * 0.14))
      for (const g of ["A", "B"]) train(P, P.group[g] && P.group[g][j], false, [1]);
  if (at(4.2)) for (const g of ["A", "B"]) all(g, true, [1, 1, 1, 1]);
  if (at(4.9) || at(5.3)) {
    all("C", false, [1, 0, 1]);
    P.act = P.t + 0.25;
  }
  if (b1 > 5.8) P.boot = -1;
}

function step(P, dt, traffic, clock) {
  P.t += dt;
  P.v = 16 * clock;
  const f = clock / 2;
  const booting = P.boot >= 0;
  if (booting) bootStep(P, dt);
  // The crystal ticks: out on one pad, back on the other.
  if (!booting || P.boot > 0.9) {
    P.tick += dt * 3 * clock;
    if (P.tick >= 1) {
      P.tick -= Math.floor(P.tick);
      train(P, P.group.X && P.group.X[0], false, [1]);
      train(P, P.group.X && P.group.X[1], true, [1]);
    }
  }
  if (!booting) {
    const rate = { A: [0, 0.9 + 3.5 * traffic], B: [0, 0.9 + 3.5 * traffic], C: [1, 0.6 + 2.6 * traffic], L: [1, 0.25 + 1.2 * traffic], R: [1, 0.25 + 1.2 * traffic], S: [2, 0.25 + 0.9 * traffic] };
    P.spell += (dt * f) / 2.4;
    const w = Math.floor(P.spell) % WORK.length;
    P.copy = w === COPY;
    for (const g in rate) {
      // Traffic turned up fills the quiet buses too.
      const rg = rate[g][1] * f * (WORK[w]["ABCLRS".indexOf(g)] * (1 + traffic) + 2 * traffic);
      if (P.next[g] === undefined) P.next[g] = P.t + Math.random() / rg;
      if (P.t >= P.next[g]) {
        transact(P, g, rate[g][0]);
        P.next[g] = P.t - Math.log(1 - Math.random() * 0.98) / rg;
      }
    }
  }
  // The LEDs: power, a heartbeat, the connector, the memory. Each one that
  // lights sends a pulse up its drive line.
  const hb = (P.t * f) % 1.6;
  const on = [!booting || P.boot > 0.5, !booting && (hb < 0.1 || (hb > 0.25 && hb < 0.35)), P.act > P.t, P.mem > P.t || (booting && P.boot > 2.6 && P.boot < 4.6 && (P.boot * 8) % 1 < 0.5)];
  for (let k = 0; k < 4; k++) {
    if (on[k] && !P.ledWas[k] && k) train(P, P.ledNet[k].r, false, [1]);
    P.ledWas[k] = on[k] ? 1 : 0;
    P.led[k] += ((on[k] ? 1 : 0) - P.led[k]) * Math.min(1, dt * 30);
  }
  // Pulses move on, warming every LED of copper their head crosses.
  const heat = P.heat;
  const ps = P.pulses;
  let kept = 0;
  for (const p of ps) {
    const s0 = p.s;
    p.s += P.v * dt;
    const r = p.r;
    for (let c = Math.max(0, Math.ceil(s0)); c <= p.s && c < r.n; c++) {
      const j = r.o + (p.rev ? r.n - 1 - c : c);
      heat[j] = Math.min(1, heat[j] + 0.3);
    }
    if (p.s - TAIL < r.n) ps[kept++] = p;
  }
  ps.length = kept;
  const keep = Math.exp(-dt / P.tau);
  for (let i = 0; i < heat.length; i++) heat[i] *= keep;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  P.mask = Math.min(1, Math.max(0, k[0]));
  const clock = Math.max(0.1, k[1]);
  const traffic = Math.min(1, Math.max(0, k[2]));
  P.glow = Math.min(1, Math.max(0, k[3]));
  P.tau = 1 + 2.2 * P.glow ** 1.3;
  if (!P.started) {
    P.started = true;
    for (const n of P.ledNet) n.r = P.routes.find((r) => r.grp === "D" && r.line === n.line);
    // The board has been running for three seconds when the panel opens.
    for (let i = 0; i < 90; i++) step(P, 1 / 30, traffic, clock);
  }
  if (input.btnPressed && input.btnPressed[0]) {
    Object.assign(P, { boot: 0, next: {}, busy: {}, clear: {} });
    P.pulses.length = 0;
    P.heat.fill(0);
  }
  step(P, dt, traffic, clock);
}

// A box blur of one channel, along rows and then along columns.
function blur(src, dst, tmp, r, c) {
  for (let pass = 0; pass < 2; pass++) {
    const from = pass ? tmp : src;
    const to = pass ? dst : tmp;
    const len = pass ? H : W;
    const st = pass ? W * 3 : 3;
    for (let line = 0; line < (pass ? W : H); line++) {
      const o = (pass ? line : line * W) * 3 + c;
      let acc = 0;
      for (let i = 0; i <= r; i++) acc += from[o + i * st];
      for (let i = 0; i < len; i++) {
        to[o + i * st] = acc / (2 * r + 1);
        if (i + r + 1 < len) acc += from[o + (i + r + 1) * st];
        if (i - r >= 0) acc -= from[o + (i - r) * st];
      }
    }
  }
}

export function draw(display, params) {
  const P = params;
  if (P.maskAt !== P.mask) paintBoard(P);
  const buf = P.buf;
  const E = P.E;
  buf.set(P.base);
  E.fill(0);
  // A busy trace stays warm in its signal's colour.
  const heat = P.heat;
  for (const r of P.routes) {
    const col = SIG[r.cls];
    for (let i = 0; i < r.n; i++) {
      const h = heat[r.o + i] * 0.7;
      if (h < 0.007) continue;
      for (let c = 0; c < 3; c++) E[r.cells[i] * 3 + c] += col[c] * h;
    }
  }
  for (const p of P.pulses) {
    const r = p.r;
    const col = SIG[r.cls];
    const hi = Math.floor(p.s);
    for (let i = hi + 1; i >= hi - TAIL - 1; i--) {
      if (i < 0 || i >= r.n) continue;
      const d = p.s - i;
      let b = d < 0 ? 1 + d : d < 1 ? 1 : 1 - (d - 1) / (TAIL + 1);
      if (b <= 0) continue;
      b *= b;
      // The head burns nearly white, the tail in the signal's colour.
      const wh = d < 1 ? 0.55 : 0;
      const o = r.cells[p.rev ? r.n - 1 - i : i] * 3;
      for (let c = 0; c < 3; c++) E[o + c] += (col[c] + (255 - col[c]) * wh) * b;
    }
  }
  for (let k = 0; k < 4; k++)
    for (let y = 0; y < 2; y++) {
      const o = ((LENS_AT[k][1] + y) * W + LENS_AT[k][0]) * 3;
      for (let c = 0; c < 3; c++) E[o + c] += LED_ON[k][c] * P.led[k] * 1.8;
    }
  // The glow: the pulses' light spread through the mask.
  const r = 1 + Math.round(P.glow * 3);
  const g = 0.5 + 2.8 * P.glow;
  const G = P.G;
  for (let c = 0; c < 3; c++) blur(E, G, P.T, r, c);
  for (let p = 0; p < N; p++) {
    const o = p * 3;
    // Where a pulse is, its light covers the copper under it.
    const m = 1 - 0.5 * Math.min(1, Math.max(E[o], E[o + 1], E[o + 2]) / 255);
    display.setPixel(p % W, (p - (p % W)) / W, knee(buf[o] * m + E[o] + G[o] * g), knee(buf[o + 1] * m + E[o + 1] + G[o + 1] * g), knee(buf[o + 2] * m + E[o + 2] + G[o + 2] * g));
  }
}

// Light past 180 rolls off towards 255, so a bright pulse keeps its colour.
function knee(v) {
  return v < 180 ? v : 255 - 75 * Math.exp(-(v - 180) / 75);
}
