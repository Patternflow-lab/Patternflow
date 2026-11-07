// ===== Patternflow pattern =====
// Title:   Rail Fence
// Family:  type
// Idea:    A message of 3 by 5 capitals sits in two lines at the top, then each letter flies down to its place on a zigzag across 2 to 6 vertical rails, the rails are read one after another from the top, and each letter read flies on into the line of ciphertext at the bottom, so the rail fence cipher is written, read off by rail and left as a message that has the same letters and no sense, each letter keeping the colour of its rail.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: rail fence (zigzag) transposition cipher, a pencil-and-paper cipher said to have been used in the American Civil War, 1860s; the 3 by 5 capitals of Saccades (pattern round 106), copied from recognition-point.js; pattern round 110
// Round:   110
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Rails=3..7, Text=0..2
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the rails go from cyan on the left edge through violet and magenta to a pale yellow on the right edge, and a letter wears the colour of its rail in the message, on the zigzag and in the ciphertext. A colour that would land in orange goes pale so it does not dim to brown.
// Knob 2: Speed. How fast the cipher is made. At 2, with 3 rails and the first message, a run takes 11.9 s: the message alone for 0.6 s, a letter leaving it every 0.1 s until all 25 are on the zigzag at 3.6 s, the rails read from 4.2 s at 0.11 s a letter and 0.3 s from one rail to the next until 7.9 s, then 3.2 s held and 0.8 s fading. 0.2 is ten times slower and 3 is half as fast again.
// Knob 3: Rails. How many rails the zigzag runs over, 3 to 7, and it catches at whole numbers. At 3 it opens, the zigzag every textbook draws, the rails 25.5 LEDs apart, a letter on the middle rail at every second place and the first message coming out as WECRLTEERDSOEEFEAOCAIVDEN. At 7 the rails are 8.5 LEDs apart, the zigzag takes 12 letters to come back and the same message reads WREEEECAVDNROFOECLTDSEAIE. Turning it starts the run again from the message.
// Knob 4: Text. Which message is enciphered, 0 to 2, caught at whole numbers: 0 is WE ARE DISCOVERED FLEE AT ONCE, 25 letters, 1 is MEET ME AFTER THE FIREWORKS, 23, and 2 is FOUR KNOBS ONE PANEL, 17. Turning it starts the run again from the message. The spaces are dropped, as the cipher does; the shorter the message the further apart its letters stand down the rails, 3.6 LEDs a letter for 25 and 5.4 for 17.

const W = 64, H = 128;
const { floor, round, min, max, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: orange and yellow come out lighter and paler.
function tint(h, s, v, out) {
  const hh = fr(h);
  if (hh > 0.02 && hh < 0.2) {
    v = 0.5 + 0.5 * v;
    s *= 0.55;
  }
  hsv(hh, s, v, out);
}

// The face: capitals 3 wide and 5 tall from saccades.js by way of
// recognition-point.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// The messages, spaces dropped. 25, 23 and 17 letters.
const MSG = ["WEAREDISCOVEREDFLEEATONCE", "MEETMEAFTERTHEFIREWORKS", "FOURKNOBSONEPANEL"];

// Where things stand. The message is in lines of 16 letters, 4 LEDs a letter,
// at the top; the rails run down the middle from ZY0 to ZY1 and the ciphertext
// is in lines of 16 at the bottom.
const PY = [1, 8], CYL = [113, 120], PER = 16, PITCH = 4;
const ZY0 = 18, ZY1 = 109; // the rows the zigzag letters span, top of the first to bottom of the last
const XL = 6, XR = 57; // the centres of the outer rails

// The clock of one run, in seconds at Speed 2.
const T0 = 0.6; // the message alone
const GAP = 0.1; // between letters leaving the message
const FLY = 0.55; // a letter's flight
const GAP2 = 0.11; // between letters read off a rail
const PAUSE = 0.3; // between one rail and the next
const BEAT = 0.6; // after the last letter lands, before the reading
const HOLD = 3.2, OUT = 0.8;

// The plan for R rails and message m: which rail each letter is on, the order
// they are read in, and when each moves.
function plan(R, m) {
  const text = MSG[m], N = text.length, per = 2 * (R - 1);
  const rail = [], ord = [];
  for (let i = 0; i < N; i++) {
    const p = i % per;
    rail.push(p < R ? p : per - p);
  }
  for (let j = 0; j < R; j++) for (let i = 0; i < N; i++) if (rail[i] === j) ord.push(i);
  const slot = new Array(N);
  ord.forEach((i, k) => (slot[i] = k));
  const dy = (ZY1 - ZY0 - 4) / (N - 1);
  const tL = [], tP = [], y = [], cx = [];
  for (let j = 0; j < R; j++) cx.push(XL + ((XR - XL) * j) / (R - 1));
  for (let i = 0; i < N; i++) {
    tL.push(T0 + i * GAP);
    y.push(round(ZY0 + i * dy));
  }
  const TW = T0 + (N - 1) * GAP + FLY;
  for (let i = 0; i < N; i++) tP.push(TW + BEAT + slot[i] * GAP2 + rail[i] * PAUSE);
  const TR = TW + BEAT + (N - 1) * GAP2 + (R - 1) * PAUSE + FLY;
  // The first and last time each rail is being read.
  const r0 = [], r1 = [];
  for (let j = 0; j < R; j++) {
    const mine = ord.filter((i) => rail[i] === j);
    r0.push(tP[mine[0]]);
    r1.push(tP[mine[mine.length - 1]] + FLY);
  }
  return { R, text, N, rail, ord, slot, dy, tL, tP, y, cx, TW, TR, r0, r1, L: TR + HOLD + OUT };
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, R: 0, m: -1, P: null, tc: 0, buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  const R = cl(round(k[2]), 3, 7), m = cl(round(k[3]), 0, 2);
  if (R !== S.R || m !== S.m) {
    // A new fence or message starts again from the message; the first time costs nothing.
    S.tc = S.P ? T0 - 0.35 : 0;
    S.R = R;
    S.m = m;
    S.P = plan(R, m);
  }
  S.tc += (d * S.speed) / 2;
  if (S.tc >= S.P.L) S.tc -= S.P.L;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.P) return;
  const P = S.P, R = P.R, N = P.N, tc = S.tc, buf = S.buf, h0 = S.hue + 0.5;
  buf.fill(0);
  const out = 1 - sm((tc - (P.L - OUT)) / OUT);
  const intro = sm(tc / 0.35);
  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0.003) return;
    const o = (y * W + x) * 3;
    buf[o] = max(buf[o], c[0] * a);
    buf[o + 1] = max(buf[o + 1], c[1] * a);
    buf[o + 2] = max(buf[o + 2], c[2] * a);
  };
  const glyph = (ch, x, y, c, a) => {
    const g = GLYPH[ch];
    for (let i = 0; i < 15; i++) if (g[i]) put(x + (i % 3), y + floor(i / 3), c, a);
  };
  const mix = (c, w, f, o) => {
    o[0] = c[0] + (w[0] - c[0]) * f;
    o[1] = c[1] + (w[1] - c[1]) * f;
    o[2] = c[2] + (w[2] - c[2]) * f;
    return o;
  };

  const RC = [], WHITE = [1, 1, 1], tmp = [0, 0, 0];
  for (let j = 0; j < R; j++) {
    RC.push([0, 0, 0]);
    tint(h0 + (0.62 * j) / (R - 1), 0.72, 1, RC[j]);
  }

  const ease = (u) => sm(u);
  // Where letter i is in its message line, in its place on the zigzag, and
  // where it ends up in the ciphertext.
  const plainAt = (i) => [(i % PER) * PITCH, PY[floor(i / PER)]];
  const cellAt = (i) => [round(P.cx[P.rail[i]]) - 1, P.y[i]];
  const cipherAt = (k) => [(k % PER) * PITCH, CYL[floor(k / PER)]];

  // The rails, dotted, with a gap where a letter sits, and brighter while they are being read.
  for (let j = 0; j < R; j++) {
    const act = sm((tc - (P.r0[j] - 0.1)) / 0.2) * (1 - sm((tc - (P.r1[j] - 0.1)) / 0.3));
    const x = round(P.cx[j]), gap = new Uint8Array(H);
    for (let i = 0; i < N; i++) if (P.rail[i] === j) for (let y = P.y[i] - 1; y <= P.y[i] + 5; y++) gap[y] = 1;
    for (let y = ZY0 - 3; y <= ZY1 + 3; y++) if (!gap[y]) put(x, y, RC[j], (((y - ZY0 + 3) & 3) < 2 ? 0.45 : 0.22) * (1 + 1.4 * act) * out * intro);
  }

  // The zigzag, drawn between the letters as each one lands, and fading as the reading begins.
  const linkFade = (1 - 0.65 * sm((tc - P.TW) / 0.6)) * out;
  for (let i = 1; i < N; i++) {
    const a = 0.7 * sm((tc - (P.tL[i] + FLY * 0.6)) / 0.25) * linkFade;
    if (a <= 0.003) continue;
    const ca = cellAt(i - 1), cb = cellAt(i), dir = cb[0] > ca[0] ? 1 : -1;
    const x0 = ca[0] + 1 + dir * 3, x1 = cb[0] + 1 - dir * 3, y0 = ca[1] + 2, y1 = cb[1] + 2;
    const n = abs(x1 - x0);
    for (let s = 0; s <= n; s++) {
      const u = n ? s / n : 0, x = round(x0 + (x1 - x0) * u), yy = y0 + (y1 - y0) * u, yb = floor(yy), f = yy - yb;
      mix(RC[P.rail[i - 1]], RC[P.rail[i]], u, tmp);
      put(x, yb, tmp, a * (1 - f));
      put(x, yb + 1, tmp, a * f);
    }
  }

  // The letters.
  for (let i = 0; i < N; i++) {
    const ch = P.text[i], j = P.rail[i], col = RC[j];
    const pl = plainAt(i), ce = cellAt(i), ci = cipherAt(P.slot[i]);
    const tl = P.tL[i], tp = P.tP[i];
    // In the message: full light, then a ghost once the copy has left.
    glyph(ch, pl[0], pl[1], col, (1 - 0.66 * sm((tc - tl) / 0.3)) * intro * out);
    if (tc >= tl) {
      // On the zigzag: flying in, landed, then a ghost once read.
      if (tc < tl + FLY) {
        const u = ease((tc - tl) / FLY);
        glyph(ch, round(pl[0] + (ce[0] - pl[0]) * u), round(pl[1] + (ce[1] - pl[1]) * u), mix(col, WHITE, 0.55 * (1 - u), tmp), out);
      } else {
        const flash = 0.55 * (1 - sm((tc - tl - FLY) / 0.3));
        glyph(ch, ce[0], ce[1], flash > 0.01 ? mix(col, WHITE, flash, tmp) : col, (tc >= tp ? 1 - 0.55 * sm((tc - tp) / 0.3) : 1) * out);
      }
    }
    if (tc >= tp) {
      // In the ciphertext: flying out of its place, then at rest.
      if (tc < tp + FLY) {
        const u = ease((tc - tp) / FLY);
        glyph(ch, round(ce[0] + (ci[0] - ce[0]) * u), round(ce[1] + (ci[1] - ce[1]) * u), mix(col, WHITE, 0.55 * (1 - u), tmp), out);
      } else {
        const flash = 0.55 * (1 - sm((tc - tp - FLY) / 0.3));
        glyph(ch, ci[0], ci[1], flash > 0.01 ? mix(col, WHITE, flash, tmp) : col, out);
      }
    }
  }

  for (let p = 0; p < W * H; p++) {
    const o = p * 3;
    display.setPixel(p & 63, p >> 6, min(255, buf[o] * 255), min(255, buf[o + 1] * 255), min(255, buf[o + 2] * 255));
  }
}
