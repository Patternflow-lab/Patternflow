// ===== Patternflow pattern =====
// Title:   Clapping Music
// Family:  rhythm
// Idea:    Two rings of twelve cells hold the same clapping figure and a needle sweeps both a beat at a time, the outer ring A standing still while the inner ring B turns one notch ahead after each section until it comes round to unison, with a digit in the middle counting the claps that land together and a bar chart below giving each of the thirteen sections its total.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Clapping Music (Steve Reich, 1972, year from memory), whose figure of eight claps and four rests in twelve beats is X X X . X X . X . X X .; the coincidences are the circular autocorrelation of that figure; the 3 by 5 digits of Kasiski Examination (pattern round 108), copied from edit-distance.js; pattern round 112
// Round:   112
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bars=1..12, Shift=0..11
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a clap that only A plays is azure, one that only B plays is magenta, and a clap both play at once is pale gold, drawn in both rings at the same angle so the pairs read as spokes; at 0.5 A is orange, B is green and the pairs are pale blue.
// Knob 2: Speed. The tempo is 3 x Speed beats a second: 6 at the opening 2, so a bar of twelve beats lasts 2 s and one turn of the needle takes 2 s. 0.2 is ten times slower (0.6 beats a second) and 3 is 9 beats a second. B turns its notch in about 0.2 s at any tempo. When the thirteenth section ends the unison plays on for 2.4 s at Speed 2, the chart drains in 0.9 s and the piece starts again.
// Knob 3: Bars. How many times the figure is played before B turns one more notch, 1 to 12, opening at 1. The thirteen sections last 13 x Bars bars: 26 s at 1 bar and Speed 2, 52 s at 2, and 312 s at 12, Reich's own count of twelve bars to a section (from memory). A row of segments under the chart shows which bar of the section is playing, one segment to a bar.
// Knob 4: Shift. A hand on B, 0 to 11, rounded to whole beats and opening at 0. It is added to B's lead, so B starts that many beats ahead and the chart shows the thirteen sections from there: at 0 the sections count 8 4 5 6 5 6 4 6 5 6 5 4 8 clapped together, at 3 they run 6 5 6 4 6 5 6 5 4 8 4 5 6, and only at 0 does the piece end in unison. In this figure no offset gives fewer than 4 together, and the 12 offsets sum to 64.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, exp, sin, atan2, hypot, PI, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (a, n) => ((a % n) + n) % n;
const mix = (a, b, f) => a + (b - a) * f;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The figure: a clap on beats 0 1 2 4 5 7 9 10 and a rest on 3 6 8 11.
const PAT = [1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0];
// How many beats of the twelve both players clap when B is s beats ahead:
// the circular autocorrelation of the figure, r(s) = sum of PAT[i] * PAT[i + s].
const R = [];
for (let s = 0; s < 12; s++) {
  let c = 0;
  for (let i = 0; i < 12; i++) c += PAT[i] * PAT[(i + s) % 12];
  R.push(c);
}

// The face: digits 3 wide and 5 tall from kasiski-examination.js by way of edit-distance.js, and three signs.
const FACE = {
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
  "+": "...|.#.|###|.#.|...", "=": "...|###|...|###|...",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// Geometry of the top square: the rings are centred at (32, 32).
const CX = 32, CY = 32;
const RA0 = 22.6, RA1 = 31.4; // ring A, the outer one
const RB0 = 12.9, RB1 = 21.2; // ring B, the inner one
const CENT = 11.2; // the disc in the middle
// Rows below: the chart's baseline, the bar clock and the tape of claps.
const BASE = 113, UNIT = 6, CLOCK = 116, TAPE = 121, NOW = 22, PITCH = 3;
const FIN = 2.4, FADE = 0.9;

export function setup(params) {
  const S = {
    rgb: new Float32Array(N * 3),
    tmp: new Float32Array(3),
    t: 0, nb: 0, sec: 0, bar: 0, phase: 0, fin: 0, fade: 0,
    E: 0, sv: 0, cnt: 1, coin: 1,
    fill: new Float32Array(13),
    hue: 0, speed: 2, bars: 1, shift: 0,
    cellA: new Float32Array(36), cellB: new Float32Array(36),
    cA: [0, 0, 0], cB: [0, 0, 0], cK: [0, 0, 0], ink: [0, 0, 0],
  };
  const M = 64 * 64;
  S.rr = new Float32Array(M);
  S.ph = new Float32Array(M);
  S.dA = new Float32Array(M);
  for (let y = 0, p = 0; y < 64; y++)
    for (let x = 0; x < 64; x++, p++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, r = hypot(dx, dy);
      // Angle in cells, clockwise from the top, 12 to the circle.
      const phi = mod((atan2(dx, -dy) / (2 * PI)) * 12, 12), f = phi - floor(phi);
      S.rr[p] = r;
      S.ph[p] = phi;
      S.dA[p] = r * sin(min(f, 1 - f) * (PI / 6));
    }
  params.s = S;
}

// A beat is struck: when both players clap on it, the count of pairs in the bar goes up.
function strike(S) {
  S.coin = PAT[S.nb] && PAT[mod(S.nb + S.E, 12)] ? 1 : 0;
  S.cnt += S.coin;
}

function endBar(S, bars) {
  S.cnt = 0;
  if (S.phase !== 0) return;
  S.bar++;
  if (S.bar >= bars) {
    if (S.sec < 12) (S.sec++, (S.bar = 0));
    else (S.phase = 1), (S.fin = 0);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.bars = cl(floor(kv[2] + 0.5), 1, 12);
  S.shift = cl(floor(kv[3] + 0.5), 0, 11);
  const g = (d * S.speed) / 2;
  S.t += 3 * S.speed * d;
  if (S.t >= 12) {
    S.t -= 12;
    endBar(S, S.bars);
  }
  S.E = S.sec + S.shift;
  const nb = floor(S.t);
  while (S.nb !== nb) {
    S.nb = (S.nb + 1) % 12;
    strike(S);
  }
  // After the last section the unison plays on for a while, the chart drains, and the piece begins again.
  if (S.phase === 1) {
    S.fin += g;
    if (S.fin >= FIN) (S.phase = 2), (S.fade = 0);
  } else if (S.phase === 2) {
    S.fade += g;
    if (S.fade >= FADE) {
      // The piece begins again from the top of a bar.
      (S.phase = 0), (S.sec = 0), (S.bar = 0), (S.E = S.shift), (S.t = 0), (S.nb = 0), (S.cnt = 0);
      strike(S);
    }
  }
  // B turns by the shortest way to where it should stand.
  const diff = S.E - S.sv, way = diff - 12 * round(diff / 12);
  S.sv = mod(abs(way) < 0.003 ? S.E : S.sv + way * (1 - exp(-d * 14)), 12);
  for (let k = 0; k < 13; k++) {
    const goal = S.phase === 2 || k > S.sec ? 0 : 1;
    S.fill[k] += (goal - S.fill[k]) * (1 - exp(-d * (goal ? 9 : 6)));
  }
}

// How a clap stands: full for the beat it plays on, then glowing back to its idle level.
const glow = (age) => (age < 1 ? 1 : 0.8 + 0.2 * exp(-(age - 1) * 1.1));

// A cell's colour for a state (0 rest, 1 one player, 2 both) at an age in beats since the needle reached it.
function cellColour(S, out, o, state, age, own) {
  if (state === 0) {
    out[o] = 0.1;
    out[o + 1] = 0.1;
    out[o + 2] = 0.15;
    return;
  }
  const c = state === 2 ? S.cK : own, l = glow(age), w = exp(-age * 4.5) * 0.7;
  for (let e = 0; e < 3; e++) out[o + e] = mix(c[e] * l * 0.96, 1, w);
}

function put(rgb, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = (y * W + x) * 3;
  for (let k = 0; k < 3; k++) rgb[p + k] += (c[k] - rgb[p + k]) * min(1, a);
}

function glyph(rgb, ch, x, y, s, c, a) {
  const G = GLYPH[ch];
  if (!G) return;
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 3; i++)
      if (G[j * 3 + i])
        for (let v = 0; v < s; v++) for (let u = 0; u < s; u++) put(rgb, x + i * s + u, y + j * s + v, c, a);
}

// A number in digits 3 wide with a gap of 1, from x, and how wide it came out.
function number(rgb, str, x, y, c, a) {
  for (let i = 0; i < str.length; i++) glyph(rgb, str[i], x + i * 4, y, 1, c, a);
  return str.length * 4 - 1;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.rr) return;
  const rgb = S.rgb, { rr, ph, dA, cellA, cellB, cA, cB, cK, ink } = S;
  rgb.fill(0);
  hsv(0.56 + S.hue, 0.78, 1, cA);
  hsv(0.9 + S.hue, 0.75, 1, cB);
  hsv(0.13 + S.hue, 0.25, 1, cK);
  hsv(0.58 + S.hue, 0.22, 1, ink);
  const t = S.t, sv = S.sv, tmp = [0, 0, 0, 0, 0, 0];
  const cut = S.phase === 2 ? 1 - S.fade / FADE : 1;

  // Cell colours. A cell is at its own place; B's cell m stands at m - sv, and as B turns
  // the pairings change colour at the halfway point of the notch, not through a muddy blend.
  const Ew = round(sv);
  for (let i = 0; i < 12; i++) {
    const age = mod(t - i, 12), o = i * 3;
    cellColour(S, cellA, o, PAT[i] ? (PAT[mod(i + Ew, 12)] ? 2 : 1) : 0, age, cA);
    cellColour(S, cellB, o, PAT[i] ? (PAT[mod(i - Ew, 12)] ? 2 : 1) : 0, mod(t - (i - sv), 12), cB);
  }

  // The coincidence of this beat: the disc in the middle flares when both clap.
  const pulse = S.coin ? exp(-(t - S.nb) * 4) : 0;
  for (let y = 0, p = 0; y < 64; y++)
    for (let x = 0; x < 64; x++, p++) {
      const r = rr[p], o = (y * W + x) * 3;
      if (r > RA1 + 1) continue;
      let cr = 0, cg = 0, cb = 0;
      const ca = cl(r - RA0 + 0.5, 0, 1) * cl(RA1 - r + 0.5, 0, 1);
      const cbb = cl(r - RB0 + 0.5, 0, 1) * cl(RB1 - r + 0.5, 0, 1);
      if (ca > 0) {
        const a = ca * cl((dA[p] - 0.25) / 0.8, 0, 1), i = floor(ph[p]) * 3;
        (cr = cellA[i] * a), (cg = cellA[i + 1] * a), (cb = cellA[i + 2] * a);
      } else if (cbb > 0) {
        const q = mod(ph[p] + sv, 12), m = floor(q), fr = q - m;
        const a = cbb * cl((r * sin(min(fr, 1 - fr) * (PI / 6)) - 0.25) / 0.8, 0, 1), i = m * 3;
        (cr = cellB[i] * a), (cg = cellB[i + 1] * a), (cb = cellB[i + 2] * a);
      } else if (r < CENT + 1) {
        const inside = cl(CENT + 0.5 - r, 0, 1), edge = inside * cl(r - (CENT - 1.2) + 0.5, 0, 1);
        const fill = inside * (0.05 + 0.3 * pulse), line = edge * (0.3 + 0.7 * pulse);
        cr = cK[0] * (fill + line);
        cg = cK[1] * (fill + line);
        cb = cK[2] * (fill + line);
      }
      // The needle, a thin line across both rings.
      if (r > CENT && r < RA1 + 0.6) {
        const dd = mod(ph[p] - t + 6, 12) - 6;
        if (abs(dd) < 2) {
          const w = cl(1.3 - r * sin(abs(dd) * (PI / 6)), 0, 1) * 0.85;
          (cr += (1 - cr) * w), (cg += (1 - cg) * w), (cb += (1 - cb) * w);
        }
      }
      rgb[o] = cr;
      rgb[o + 1] = cg;
      rgb[o + 2] = cb;
    }
  // The count of pairs so far in this bar, big in the middle.
  const big = String(S.cnt);
  for (let i = 0; i < big.length; i++) glyph(rgb, big[i], 29 - (big.length - 1) * 4 + i * 8, 27, 2, [1, 1, 1], 0.95);
  // B's lead and this section's pairs, in the two top corners.
  const E = mod(S.E, 12), r12 = R[E];
  glyph(rgb, "+", 1, 1, 1, cB, 0.95);
  number(rgb, String(E), 5, 1, cB, 0.95);
  const rl = String(r12).length;
  glyph(rgb, "=", 60 - 4 * rl, 1, 1, cK, 0.95);
  number(rgb, String(r12), 64 - 4 * rl, 1, cK, 0.95);

  // The chart: the thirteen sections, a bar to each, as tall as the pairs that section claps together.
  for (let k = 0; k < 13; k++) {
    const rv = R[mod(k + S.shift, 12)], h = rv * UNIT, x0 = k * 5;
    const tint = (rv - 4) / 4, cur = k === S.sec && S.phase !== 2;
    const lit = h * (S.fill[k] * (3 - 2 * S.fill[k]));
    for (let e = 0; e < 3; e++) tmp[e] = mix(cB[e], cK[e], tint);
    const gh = [mix(ink[0], tmp[0], 0.3), mix(ink[1], tmp[1], 0.3), mix(ink[2], tmp[2], 0.3)];
    for (let y = BASE - ceil2(h); y < BASE; y++) {
      const g0 = cl(y + 1 - (BASE - h), 0, 1), l0 = cl(y + 1 - (BASE - lit), 0, 1);
      for (let x = x0; x < x0 + 4; x++) {
        put(rgb, x, y, gh, 0.2 * g0 * cut);
        if (l0 > 0) {
          const bright = cur ? 1 : 0.78;
          const c2 = cur ? [mix(tmp[0], 1, 0.35), mix(tmp[1], 1, 0.35), mix(tmp[2], 1, 0.35)] : tmp;
          put(rgb, x, y, c2, l0 * bright);
        }
      }
    }
    if (cur) for (let x = x0; x < x0 + 4; x++) put(rgb, x, floor(BASE - h), [1, 1, 1], 0.9 * S.fill[k]);
  }
  for (let x = 0; x < 64; x++) put(rgb, x, BASE, ink, 0.3);

  // The bar clock: a segment to each bar of the section, filled as the bars are played.
  for (let i = 0; i < S.bars; i++) {
    const xa = floor((i * 64) / S.bars), xb = floor(((i + 1) * 64) / S.bars) - 1;
    const full = S.phase !== 0 || i < S.bar ? 1 : i === S.bar ? t / 12 : 0;
    for (let x = xa; x < xb; x++) {
      const a = cl((full * (xb - xa) - (x - xa)), 0, 1);
      for (let y = CLOCK; y < CLOCK + 2; y++) put(rgb, x, y, ink, (0.14 + 0.8 * a) * cut);
    }
  }

  // The tape: each beat a block 2 LEDs wide, A on top, B below and a bridge between where both clap. The needle's moment is the line near the left.
  const Eb = S.E, prev = S.bar === 0 && S.sec > 0 && S.phase === 0 ? Eb - 1 : Eb;
  const next = S.phase === 0 && S.bar + 1 >= S.bars && S.sec < 12 ? Eb + 1 : Eb;
  for (let u = -9; u <= 14; u++) {
    const x0 = NOW + (u - t) * PITCH;
    if (x0 < -3 || x0 > 64) continue;
    const idx = mod(u, 12), Eu = u < 0 ? prev : u >= 12 ? next : Eb;
    const a = PAT[idx], b = PAT[mod(idx + Eu, 12)];
    const bright = u < S.nb ? 0.5 : u === S.nb ? 1 : 0.85;
    // A whole bar line, and a stronger one where B turns.
    if (idx === 0) {
      const turn = (u === 0 && prev !== Eb) || (u === 12 && next !== Eb);
      for (let y = TAPE - 1; y < TAPE + 7; y++) bar(rgb, x0 - 1, y, ink, turn ? 0.75 : 0.22);
    }
    if (a) for (let y = TAPE; y < TAPE + 3; y++) block(rgb, x0, y, b ? cK : cA, bright);
    if (b) for (let y = TAPE + 4; y < TAPE + 7; y++) block(rgb, x0, y, a ? cK : cB, bright);
    if (a && b) block(rgb, x0, TAPE + 3, cK, bright);
  }
  for (let y = TAPE - 3; y < TAPE; y++) put(rgb, NOW - 1, y, [1, 1, 1], 0.9);

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}

const ceil2 = (v) => floor(v + 0.999);

// A block 2 LEDs wide whose left edge falls anywhere, laid over the LEDs by how much of each it covers.
function block(rgb, x0, y, c, a) {
  const xa = floor(x0), xb = floor(x0 + 2);
  for (let x = xa; x <= xb; x++) put(rgb, x, y, c, a * cl(min(x + 1, x0 + 2) - max(x, x0), 0, 1));
}

// A line 1 LED wide at a fractional x.
function bar(rgb, x0, y, c, a) {
  const xa = floor(x0);
  for (let x = xa; x <= xa + 1; x++) put(rgb, x, y, c, a * cl(min(x + 1, x0 + 1) - max(x, x0), 0, 1));
}
