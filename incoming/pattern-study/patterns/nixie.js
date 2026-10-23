// ===== Patternflow pattern =====
// Title:   Nixie
// Family:  circuit
// Idea:    Nixie tubes stand in their sockets on a circuit board, and in each a stack of wire numerals waits behind a fine hexagonal mesh while one of them glows neon orange: spinning through the stack and settling, counting, keeping time or counting down.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after the cold-cathode numeral tubes of the 1950s to 1980s (the Burroughs Nixie, the Soviet IN-14 and IN-18)
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Gas=0..1, Speed=0.2..3, Rows=1..3, Mode=0..3
//
// Knob 1: Gas. What glows: neon orange at 0, a pink neon-argon mix, the blue-violet of argon and mercury, and a green-filtered tube at 1.
// Knob 2: Speed. How fast the display runs: at 2 a spinning tube runs through 16 numerals a second before it slows and stops.
// Knob 3: Rows. One big tube at 1, two rows of two at 2, three rows of two at 3, each row on its own board.
// Knob 4: Mode. Scramble at 0 (every tube spins and stops on a random number, one after another), a frequency counter at 1, a clock at 2, a countdown that ends in the anti-poisoning run through every cathode at 3.
// Buttons: K1 tap runs every cathode in turn now.

const W = 64;
const H = 128;
const N = W * H;
const { min, max, floor, ceil, round, sin, cos, abs, sqrt, exp, hypot, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Numerals as strokes in a box one wide and one tall, y down: lines and
// elliptical arcs in degrees, 90 pointing down. The 3 has a flat top and the
// 5 is the 2 turned over, as in the IN-14.
const FONT = [
  [["l", 0, 0.3, 0, 0.7], ["l", 1, 0.3, 1, 0.7], ["a", 0.5, 0.3, 0.5, 0.3, 180, 360], ["a", 0.5, 0.7, 0.5, 0.3, 0, 180]],
  [["l", 0.56, 0, 0.56, 1], ["l", 0.56, 0, 0.26, 0.16]],
  [["a", 0.5, 0.27, 0.5, 0.27, 195, 400], ["l", 0.883, 0.444, 0, 1], ["l", 0, 1, 1, 1]],
  [["l", 0.04, 0, 0.96, 0], ["l", 0.96, 0, 0.4, 0.39], ["a", 0.5, 0.68, 0.5, 0.3, 255, 510]],
  [["l", 0.76, 1, 0.76, 0], ["l", 0.76, 0, 0, 0.68], ["l", 0, 0.68, 1, 0.68]],
  [["l", 1, 0, 0, 0], ["l", 0, 0, 0.883, 0.556], ["a", 0.5, 0.73, 0.5, 0.27, -40, 165]],
  [["a", 0.5, 0.7, 0.5, 0.3, 0, 360], ["a", 0.95, 0.7, 0.95, 0.68, 180, 252]],
  [["l", 0, 0, 1, 0], ["l", 1, 0, 0.32, 1]],
  [["a", 0.5, 0.24, 0.42, 0.24, 0, 360], ["a", 0.5, 0.73, 0.5, 0.27, 0, 360]],
  [["a", 0.5, 0.3, 0.5, 0.3, 0, 360], ["a", 0.05, 0.3, 0.95, 0.68, 0, 72]],
];
// The cathodes front to back. A numeral further back sits a little smaller,
// and the wires in front of it cross its glow.
const STACK = [1, 6, 2, 7, 5, 0, 4, 9, 8, 3];
const DEPTH = [];
STACK.forEach((d, i) => (DEPTH[d] = i));
// Glass width, glass top and height, pins, socket, numeral box, where the
// numeral sits down the glass, mesh cell, and a scale for wires and glow.
const LAY = [
  { gw: 54, top: 4, gh: 109, pin: 4, sock: 4, dw: 36, dh: 72, dc: 0.52, hex: 2.4, s: 1 },
  { gw: 26, top: 3, gh: 50, pin: 3, sock: 2, dw: 17, dh: 34, dc: 0.5, hex: 1.6, s: 0.5 },
  { gw: 24, top: 2, gh: 32, pin: 2, sock: 2, dw: 14, dh: 23, dc: 0.5, hex: 1.4, s: 0.38 },
];
// Each gas: dim edge of the glow, the glow, the hot core.
const GAS = [
  [[120, 22, 2], [255, 96, 18], [255, 214, 150]],
  [[110, 8, 54], [255, 58, 140], [255, 204, 232]],
  [[40, 26, 150], [92, 120, 255], [204, 236, 255]],
  [[18, 92, 10], [104, 240, 40], [214, 255, 170]],
];

function strokes(dg, bx, by, w, h) {
  const out = [];
  for (const [k, a, b, c, d, e, f] of FONT[dg]) {
    if (k === "l") {
      out.push(bx + a * w, by + b * h, bx + c * w, by + d * h);
      continue;
    }
    const n = max(4, ceil((abs(f - e) / 180) * (c * w + d * h) * 0.9));
    for (let i = 0, px = 0, py = 0; i <= n; i++) {
      const th = ((e + ((f - e) * i) / n) * PI) / 180, x = bx + (a + c * cos(th)) * w, y = by + (b + d * sin(th)) * h;
      if (i) out.push(px, py, x, y);
      [px, py] = [x, y];
    }
  }
  return out;
}
function segDist(x, y, S) {
  let best = 1e9;
  for (let i = 0; i < S.length; i += 4) {
    const ax = S[i], ay = S[i + 1], dx = S[i + 2] - ax, dy = S[i + 3] - ay, l = dx * dx + dy * dy;
    const u = l ? cl(((x - ax) * dx + (y - ay) * dy) / l, 0, 1) : 0, ex = x - ax - u * dx, ey = y - ay - u * dy, d = ex * ex + ey * ey;
    if (d < best) best = d;
  }
  return sqrt(best);
}
// Distance to the nearest wire of a pointy-top hexagonal mesh of cell a.
function hexLine(x, y, a) {
  const q = (x * 0.57735 - y / 3) / a, r = (y * 2) / 3 / a;
  let rx = round(q), rz = round(r);
  const ry = round(-q - r), dx = abs(rx - q), dz = abs(rz - r), dy = abs(ry + q + r);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy <= dz) rz = -rx - ry;
  const ux = abs(x - a * 1.732 * (rx + rz / 2)), uy = abs(y - a * 1.5 * rz);
  return cl(1 - (a * 0.866 - max(ux, 0.5 * ux + 0.866 * uy)) / 0.6, 0, 1);
}

function build(P, R) {
  const L = LAY[R - 1], s = L.s, cols = R > 1 ? 2 : 1, cw = W / cols;
  const A = (P.amb = new Float32Array(N * 3)), RF = (P.refl = new Float32Array(N)), TR = (P.tr = new Float32Array(N).fill(1));
  const PL = (P.pool = new Float32Array(N)), TI = (P.tid = new Uint8Array(N)), PZ = (P.pz = new Uint8Array(N)), GL = (P.gl = new Uint8Array(N));
  const D = (P.D = Array.from({ length: 11 }, () => new Uint8Array(N).fill(255)));
  const OC = (P.OC = Array.from({ length: 10 }, () => new Uint8Array(N)));
  const put = (x, y, r, g, b, f) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = y * W + x;
    A.set([r, g, b], p * 3);
    RF[p] = f;
  };
  const line = (x0, y0, x1, y1, c, f) => {
    for (let i = 0, n = max(abs(x1 - x0), abs(y1 - y0), 1); i <= n; i++) put(round(mix(x0, x1, i / n)), round(mix(y0, y1, i / n)), ...c, f);
  };
  // Glow and the light it throws, by distance to the lit wire in eighths.
  const CO = (P.CO = new Float32Array(256)), SP = (P.SP = new Float32Array(256)), WR = new Float32Array(256);
  for (let q = 0; q < 256; q++) {
    const d = q / 8;
    CO[q] = 1.35 * exp(-((d / (0.55 + 0.35 * s)) ** 2)) + 0.5 * exp(-((d / (1.2 + 0.8 * s)) ** 2)) + 0.22 * exp(-d / (2.5 + 2.5 * s));
    SP[q] = 0.8 * exp(-d / (1.5 + 3 * s)) + 0.3 * exp(-d / (4 + 12 * s));
    WR[q] = cl(1.3 - d / (0.45 + 0.35 * s), 0, 1);
  }
  for (let p = 0; p < N; p++) {
    const g = 0.7 + 0.6 * hash(p & 63, p >> 6);
    put(p & 63, p >> 6, 5 * g, 5 * g, 7 * g, 0.12);
  }
  const n = (P.n = R * cols), T = (P.T = []);
  P.newT = n > 1 ? floor(rnd() * n) : -1;
  P.oldT = n > 1 ? (P.newT + 1 + floor(rnd() * (n - 1))) % n : 0;
  P.pois = [0, 9, 3, 8][floor(rnd() * 4)];
  P.lamps = [];
  for (let r = 0, i = 0; r < R; r++)
    for (let c = 0; c < cols; c++, i++) {
      const y0 = round((r * H) / R), y1 = round(((r + 1) * H) / R), x0 = c * cw, cx = x0 + cw / 2;
      const top = y0 + L.top, bot = top + L.gh, hw = L.gw / 2, dmh = round(L.gw * 0.3), rb = max(2, round(L.gw * 0.12));
      const dcy = top + L.gh * L.dc, bx = cx - L.dw / 2, by = dcy - L.dh / 2, m = 1 + 3 * s;
      const c0 = floor(bx - m), c1 = ceil(bx + L.dw + m + 2 * s), r0 = floor(by - m), r1 = ceil(by + L.dh + m);
      const nw = i === P.newT ? 1.35 : 1;
      const half = (y) => {
        const v = y + 0.5;
        if (v < top || v > bot) return -1;
        if (v < top + dmh) return hw * sqrt(max(0, 1 - ((top + dmh - v) / dmh) ** 2));
        if (v > bot - rb) return hw - rb + sqrt(max(0, rb * rb - (v - bot + rb) ** 2));
        return hw;
      };
      // Each numeral's wire, by distance, in this tube's cell.
      const S = [];
      for (let j = 0; j < 10; j++) {
        const sc = 1 - 0.008 * DEPTH[j];
        S.push(strokes(j, cx - (L.dw * sc) / 2, dcy - (L.dh * sc) / 2, L.dw * sc, L.dh * sc));
      }
      S.push([bx + L.dw * 1.17, by + L.dh * 0.98, bx + L.dw * 1.17, by + L.dh * 0.98]);
      const pzx = S[P.pois][0] * 0.5 + S[P.pois][2] * 0.5, pzy = S[P.pois][1] * 0.5 + S[P.pois][3] * 0.5;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x0 + cw; x++) {
          const p = y * W + x, X = x + 0.5, Y = y + 0.5;
          TI[p] = i;
          if (hypot(max(0, bx - X, X - bx - L.dw), max(0, by - Y, Y - by - L.dh)) > 33) continue;
          for (let j = 0; j < 11; j++) D[j][p] = min(255, round(max(0, segDist(X, Y, S[j]) - (j > 9 ? 0.4 + 0.5 * s : 0)) * 8));
          if (i === P.oldT) PZ[p] = round(255 * exp(-((hypot(X - pzx, Y - pzy) / (1.4 + 2 * s)) ** 2)));
        }
      // Glass, getter, mica, rods, the anode mesh and the cathodes behind it.
      for (let y = y0; y < y1; y++) {
        const hy = half(y), hu = half(y - 1), hd = half(y + 1);
        for (let x = x0; x < x0 + cw; x++) {
          const p = y * W + x, ax = abs(x + 0.5 - cx), e = hy - ax, g = hash(x, y + 300), left = x + 0.5 < cx;
          if (e <= 0) continue;
          let col = [4 + 2 * g, 5 + 2 * g, 7 + 2 * g], f = 0.09;
          if (e < 1.2 || hu - ax <= 0 || hd - ax <= 0) [col, f] = [[24 * nw, 28 * nw, 34 * nw], 0.5];
          else if (y < top + dmh * 0.8) {
            // The getter's mirror on the dome: bright and clean in a new tube,
            // dull brown in an old one.
            const a = cl(1.15 - (y - top) / (dmh * 0.72) + 0.3 * (g - 0.5), 0, 1), v = nw > 1 ? 40 + 56 * a : 24 + 26 * a;
            col = (nw > 1 ? [v, v, v * 1.06] : [v * 0.95, v * 0.86, v * 0.72]).map((c, ch) => mix(col[ch], c, a));
            f = mix(0.09, 0.5, a);
          } else if (x >= c0 && x <= c1 && y >= r0 && y <= r1) {
            // Inside the anode: the back plate, the unlit wires, the mesh in front.
            let w = 0;
            for (let j = 0; j < 10; j++) w = max(w, WR[D[j][p]] * (1 - 0.05 * DEPTH[j]));
            const mh = x === c0 || x === c1 ? 1 : hexLine(x + 0.5 - cx, y + 0.5 - dcy, L.hex);
            col = [mix(6, 25, w) + 6 * mh, mix(6, 25, w) + 6 * mh, mix(7, 29, w) + 7 * mh];
            f = mix(0.15, 0.34, w) + 0.25 * mh;
            TR[p] = 1 - 0.42 * mh;
            for (let k = 0, run = 0; k < 10; k++) {
              OC[STACK[k]][p] = run;
              run = max(run, round(WR[D[STACK[k]][p]] * 255));
            }
          } else if ((y === r0 - 1 || y === r0 - 2 + (s < 0.6) || y === r1 + 1 || y === r1 + 2 - (s < 0.6)) && e > 1.5) [col, f] = [[(34 + 18 * g) * nw, (34 + 18 * g) * nw, (32 + 16 * g) * nw], 0.62];
          else if ((x === c0 - 2 || x === c1 + 2) && y > r0 - 3 && y < r1 + 4 * s + 2) [col, f] = [[26, 26, 28], 0.55];
          // The window behind the camera, on the left of the glass.
          const u = (y - top) / L.gh, hl = left && e >= 1.2 && e < 3.2 ? (e < 2.2 ? 1 : 0.35) * max(cl(1 - abs(u - 0.5) / 0.3, 0, 1) ** 0.4, cl(1 - abs(u - 0.14) / 0.05, 0, 1)) : 0;
          if (hl > 0) col = col.map((v, ch) => v + hl * (104 + 12 * ch) * nw);
          GL[p] = 1;
          if (!left && e >= 2 && e < 3 && y > top + dmh && y < bot - rb * 2) col = col.map((v, ch) => v + (16 + 4 * ch) * nw);
          put(x, y, ...col, f);
        }
      }
      // A bright curve on the dome, and the exhaust tip.
      for (let a = 196; a < 252; a += 1.5) {
        const v = (60 + 80 * sin(((a - 196) * PI) / 56)) * nw;
        put(round(cx + (hw - 2.5) * cos((a * PI) / 180) - 0.5), round(top + dmh + (dmh - 2) * sin((a * PI) / 180) - 0.5), v, v * 1.05, v * 1.15, 0.3);
      }
      for (let y = top - 1 - round(2 * s); y < top; y++) put(floor(cx) - 1, y, 36, 40, 46, 0.2), put(floor(cx), y, 50, 54, 60, 0.2);
      // Leads from the bottom mica to the glass press, pins to the socket.
      const sh = round(3 + 6 * s), np = R === 1 ? 13 : 7, ph = hw * 0.55;
      for (let k = 0; k < np; k++) {
        const u = k / (np - 1), xa = round(mix(c0 + 2, c1 - 2, u)), xp = round(cx - ph + 2 * ph * u);
        line(xa, r1 + 3, xp, bot - sh, [18, 18, 21], 0.45);
        for (let y = bot; y < bot + L.pin; y++) put(xp, y, 62 + 20 * (y === bot), 64 + 20 * (y === bot), 68 + 20 * (y === bot), 0.5);
        put(xp, bot + L.pin, 120, 92, 40, 0.4);
      }
      for (let y = bot - sh; y < bot; y++) {
        const hwp = mix(hw * 0.32, hw * 0.48, (y - bot + sh) / sh);
        for (let x = ceil(cx - hwp); x < cx + hwp; x++) if (half(y) - abs(x + 0.5 - cx) > 1.2) put(x, y, 20 + 14 * (y === bot - sh), 22 + 14 * (y === bot - sh), 25 + 15 * (y === bot - sh), 0.35);
      }
      const sy = bot + L.pin, by0 = sy + L.sock;
      for (let y = sy; y < by0; y++) for (let x = ceil(cx - hw * 0.75); x < cx + hw * 0.75; x++) if (y > sy || !RF[y * W + x] || A[(y * W + x) * 3] < 100) put(x, y, y === sy ? 30 : 13, y === sy ? 30 : 13, y === sy ? 34 : 15, 0.25);
      for (let k = 0; k < np; k++) put(round(cx - ph + (2 * ph * k) / (np - 1)), sy, 120, 92, 40, 0.4);
      // The board: green mask, copper under it, gold pads.
      for (let y = by0; y < y1; y++)
        for (let x = x0; x < x0 + cw; x++) {
          const g = hash(x + 50, y), edge = y === by0;
          put(x, y, edge ? 38 : 10 + 4 * g, edge ? 46 : 26 + 6 * g, edge ? 42 : 16 + 4 * g, 0.4);
        }
      for (let k = 0; k < np; k++) {
        const xp = round(cx - ph + (2 * ph * k) / (np - 1)), dir = xp < cx ? -1 : 1;
        line(xp, by0 + 1, xp + dir * (y1 - by0), y1 + 1, [20, 52, 30], 0.4);
      }
      for (let y = top - 4; y < y1; y++)
        for (let x = x0; x < x0 + cw; x++) {
          const v = exp(-(((x + 0.5 - cx) / (hw * 0.8)) ** 2)) * exp(-max(0, y - bot + 6) / (3 + 8 * s));
          if (y >= bot - 8) PL[y * W + x] = 0.45 * v;
        }
      T.push({ cx, bot, by0, y1, hw });
      if (R === 1) P.lamps.push([60, 107, 4, 10]);
      else if (c === 1) P.lamps.push([30, bot - round(9 * s), 4, round(11 * s)]);
    }
  if (R === 1) {
    // An anode resistor and the high-voltage capacitor lie on the big board.
    for (let x = 1; x < 14; x++) put(x, 124, 70, 72, 76, 0.4);
    for (let x = 3; x < 12; x++) for (let y = 123; y < 126; y++) put(x, y, ...[[110, 96, 70], [90, 50, 22], [20, 18, 16], [150, 36, 24]][x === 5 ? 1 : x === 7 ? 2 : x === 9 ? 3 : 0].map((v) => v * (y === 123 ? 1.2 : y === 125 ? 0.7 : 1)), 0.4);
    for (let x = 50; x < 62; x++) for (let y = 122; y < 127; y++) put(x, y, ...(x > 59 ? [78, 80, 86] : x === 52 ? [90, 110, 150] : [26, 44, 110]).map((v) => v * (y === 122 ? 1.3 : y === 126 ? 0.6 : 1)), 0.4);
  }
  // The neon indicator lamps: a glass capsule with two electrodes.
  for (const [lx, ly, lw, lh] of P.lamps) {
    for (let y = ly; y < ly + lh; y++)
      for (let x = lx; x < lx + lw; x++) {
        const rim = x === lx || x === lx + lw - 1 || y === ly;
        put(x, y, rim ? 30 : 8, rim ? 34 : 9, rim ? 40 : 11, 0.3);
      }
    for (let y = ly + 2; y < ly + lh + 3; y++) put(lx + 1, y, 44, 44, 46, 0.4), put(lx + lw - 2, y, 44, 44, 46, 0.4);
  }
  P.amb0 = A.slice();
  for (const k of ["tg", "dsp", "pk", "fa", "fl", "dp", "s0", "s1", "b", "sp"]) P[k] = new Array(n).fill(k === "dsp" || k === "pk" ? -1 : 0);
}

// The gas: a glow colour for every brightness, and the light it throws.
function ramp(P, gas) {
  const f = gas * 3, i = min(2, floor(f)), t = f - i;
  const [h, b, c] = GAS[i].map((col, k) => col.map((v, ch) => mix(v, GAS[i + 1][k][ch], t)));
  const RA = (P.RA = new Float32Array(768)), st = [0, 0.12, 0.35, 0.8, 1.5, 2.55];
  const cs = [[0, 0, 0], h.map((v) => v * 0.35), h, b, b.map((v, ch) => mix(v, c[ch], 0.6)), c];
  for (let j = 0, k = 0; j < 256; j++) {
    const e = j / 100;
    while (k < 4 && e > st[k + 1]) k++;
    const u = (e - st[k]) / (st[k + 1] - st[k]);
    for (let ch = 0; ch < 3; ch++) RA[j * 3 + ch] = mix(cs[k][ch], cs[k + 1][ch], cl(u, 0, 1));
  }
  const lum = (b[0] + b[1] + b[2]) / 3;
  P.spill = b.map((v) => mix(v, lum, 0.35));
  // A green-filtered tube is green glass.
  const gf = cl(gas * 3 - 2, 0, 1), tint = [1 - 0.3 * gf, 1 + 0.5 * gf, 1 - 0.2 * gf];
  if (P.amb0) for (let p = 0; p < N * 3; p++) P.amb[p] = P.amb0[p] * (P.gl[(p / 3) | 0] ? tint[p % 3] : 1);
}

// A spin: the tube runs up through the numerals, slowing from 16 to 3 a
// second, and stops on its target.
function roll(P, i, wait, len) {
  P.s0[i] = P.t + wait;
  P.s1[i] = P.t + wait + len;
}
function spinDigit(P, i) {
  const T = P.s1[i] - P.s0[i], u = (P.t - P.s0[i]) / T, ph = T * (16 * u - 6.5 * u * u), all = T * 9.5;
  return (((P.tg[i] + floor(ph) - floor(all)) % 10) + 10) % 10;
}
function digits(P, v) {
  for (let i = P.n - 1; i >= 0; i--, v = floor(v / 10)) P.tg[i] = v % 10;
}

function start(P) {
  Object.assign(P, { next: P.t, gate: P.t, retune: P.t + 4, base: 140000 + rnd() * 800000, key: -1, v: 0, step: P.t, cyc: -9, blank: 0 });
  P.c0 = P.n === 6 ? 23 * 3600 + 59 * 60 + 53 : P.n === 4 ? 23 * 3600 + 57 * 60 : 9 * 3600 + 58 * 60;
  P.s1.fill(0);
}

const MODES = [
  // Scramble.
  (P) => {
    if (P.t < P.next) return;
    const n = P.n;
    for (let i = 0; i < n; i++) {
      P.tg[i] = floor(rnd() * 10);
      roll(P, i, 0.07 * i, n > 1 ? 0.8 + 0.3 * i : 1.5);
    }
    P.next = P.t + (n > 1 ? 0.9 + 0.37 * n : 1.5) + 2.6;
    P.lamp = 0;
  },
  // A frequency counter reading an oscillator that drifts as it warms up.
  (P) => {
    if (P.t < P.gate) return;
    P.gate += P.n > 1 ? 0.12 : 0.4;
    if (P.t > P.retune) [P.base, P.retune, P.blank] = [10000 + rnd() * 980000, P.t + 5 + rnd() * 3, 0.25];
    digits(P, floor(P.base + 37 * P.t + 4 * sin(P.t * 2.1) + rnd() * 3));
    P.dp.fill(0);
    if (P.n > 3) P.dp[P.n - 4] = 1;
    P.lamp = 1;
  },
  // A clock: a big tube spells the time a numeral at a time.
  (P) => {
    const n = P.n, C = P.c0 + P.t * (n === 6 ? 2 : n === 4 ? 60 : 10), s = floor(C) % 86400;
    const hh = floor(s / 3600), mm = floor(s / 60) % 60, ss = s % 60, all = [floor(hh / 10), hh % 10, floor(mm / 10), mm % 10, floor(ss / 10), ss % 10];
    if (n === 1) {
      const ph = P.t % 3.6, j = floor(ph / 0.7);
      P.tg[0] = j < 4 && ph % 0.7 < 0.56 ? all[j] : -1;
      P.dp[0] = j === 1 ? 1 : 0;
      P.lamp = j < 4 ? 1 : 0;
      return;
    }
    // A new minute (or hour) runs the slot machine, which also keeps the
    // cathodes from poisoning.
    const key = n === 6 ? floor(s / 60) : hh;
    if (P.key >= 0 && key !== P.key) for (let i = 0; i < n; i++) roll(P, i, 0.05 * i, 0.7 + 0.12 * i);
    P.key = key;
    for (let i = 0; i < n; i++) P.tg[i] = all[i];
    P.lamp = (n === 6 ? C : P.t) % 1 < 0.5 ? 1 : 0;
  },
  // A countdown; at zero every cathode runs in turn, then it starts again.
  (P) => {
    if (P.t < P.step) return;
    if (P.v > 0) {
      digits(P, --P.v);
      P.step += 0.4;
      P.lamp = 1;
    } else if (P.cyc < P.step - 3) {
      P.cyc = P.t + 0.6;
      P.step = P.t + 2.6;
    } else {
      P.v = P.n === 1 ? 10 : 17;
      P.step = P.t;
    }
  },
];

export function setup(params) {
  Object.assign(params, { t: 0, rt: 0, R: 0, gas: -1, mode: -1, lamp: 0, lv: 0, buf: new Float32Array(N * 3) });
}

export function update(dt, input, params) {
  const P = params, k = input.knobValues || [0, 2, 1, 0.06];
  dt = cl(dt, 0, 0.1);
  const rate = cl(k[1], 0.2, 3) / 2, R = cl(round(k[2]), 1, 3), mode = cl(round(k[3]), 0, 3), gas = cl(k[0], 0, 1);
  if (R !== P.R) [P.R, P.mode, P.gas] = [R, -1, -1, build(P, R)];
  if (abs(gas - P.gas) > 0.002) ramp(P, (P.gas = gas));
  if (mode !== P.mode) start(P, (P.mode = mode));
  P.t += dt * rate;
  P.rt += dt;
  if (input.btnPressed && input.btnPressed[0]) P.cyc = P.t;
  P.lamp *= P.mode === 1 ? 0.6 : 1;
  MODES[mode](P);
  P.blank = max(0, P.blank - dt);
  const cyc = P.t >= P.cyc && P.t < P.cyc + 1.9;
  for (let i = 0; i < P.n; i++) {
    let d = P.blank > 0 ? -1 : P.tg[i];
    if (cyc) d = STACK[9 - ((floor((P.t - P.cyc) * 12) + i) % 10)];
    else if (P.s1[i] && P.t >= P.s0[i] && P.t < P.s1[i]) d = spinDigit(P, i);
    else if (P.s1[i] && P.t >= P.s1[i]) [P.s1[i], P.fl[i]] = [0, 1];
    if (d !== P.dsp[i]) [P.pk[i], P.fa[i], P.dsp[i]] = [P.dsp[i], 1, d];
    P.fa[i] = max(0, P.fa[i] - dt * 14);
    P.fl[i] = max(0, P.fl[i] - dt * 2.8);
    // Neon flickers a little, and now and then an old tube sputters.
    if ((P.sp[i] -= dt) <= 0 && rnd() < dt * 0.15) P.sp[i] = 0.12 + rnd() * 0.15;
    const z = P.rt * 1.0 + i * 7.1;
    P.b[i] = (i === P.newT ? 1.25 : 0.92) * (1 + 0.3 * P.fl[i]) * (0.97 + 0.02 * sin(z * 53) + 0.02 * sin(z * 7.3)) * (P.sp[i] > 0 ? 0.6 + 0.4 * (rnd() < 0.5) : 1);
  }
  if (P.mode === 0 && P.s1.every((v) => !v)) P.lamp = 1;
  P.lv += (P.lamp - P.lv) * min(1, dt * 30);
}

export function draw(display, params) {
  const P = params, { amb, refl, tr, pool, tid, D, OC, CO, SP, RA, buf, pz, spill, oldT, pois } = P;
  const [sr, sg, sb] = spill, B = P.b, K = P.dsp, PK = P.pk, FA = P.fa, DP = P.dp;
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const i = tid[p], b = B[i], k = K[i], pk = PK[i], fa = FA[i];
    let Lt = 0, e = 0;
    if (k >= 0) {
      const q = D[k][p];
      Lt = (SP[q] + pool[p]) * b;
      e = CO[q] * b * (1 - OC[k][p] * 0.0022) * (i === oldT && k === pois ? 1 - pz[p] * 0.0035 : 1);
    }
    if (fa > 0 && pk >= 0) {
      const q = D[pk][p];
      Lt += (SP[q] + pool[p]) * b * fa;
      e += CO[q] * b * fa;
    }
    if (DP[i] && k >= 0) {
      const q = D[10][p];
      Lt += SP[q] * b * 0.4;
      e += CO[q] * b;
    }
    const j = min(255, (e * tr[p] * 100) | 0) * 3, f = refl[p] * Lt;
    buf[o] = amb[o] + f * sr + RA[j];
    buf[o + 1] = amb[o + 1] + f * sg + RA[j + 1];
    buf[o + 2] = amb[o + 2] + f * sb + RA[j + 2];
  }
  // The indicator lamps glow on their left electrode.
  const lv = P.lv;
  if (lv > 0.02)
    for (const [lx, ly, , lh] of P.lamps)
      for (let y = ly + 1; y < ly + lh + 2; y++)
        for (let x = lx - 1; x <= lx + 2; x++) {
          if (x < 0 || x >= W || y >= H) continue;
          const o = (y * W + x) * 3, c = x === lx + 1 && y > ly + 1 && y < ly + lh ? 1 : 0.3 * (y < ly + lh);
          buf[o] += 255 * c * lv;
          buf[o + 1] += 120 * c * lv;
          buf[o + 2] += 34 * c * lv;
        }
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const r = buf[o], g = buf[o + 1], b = buf[o + 2];
    display.setPixel(p & 63, p >> 6, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
  }
}
