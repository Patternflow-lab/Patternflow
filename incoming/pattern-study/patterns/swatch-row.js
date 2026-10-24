// ===== Patternflow pattern =====
// Title:   Swatch Row
// Family:  cosmetic
// Idea:    A shade range swatched down an ivory card: an unseen finger drags one stroke of cream pigment at a time, thick and opaque where it lands and breaking into feathered streaks where the pigment runs out, and the stack of eight glides up a row for every new one.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 30, after the makeup artist's swatch
// Round:   30
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Range=-1..1, Finish=-1..1
//
// Knob 1: Hue. Turns the whole range round the colour wheel. At 0 it is rose, pale pink at the light end and berry at the deep end; at 0.12 it is a foundation range from nude to bronze, at 0.3 olive, at 0.5 mint to jade, at 0.75 periwinkle to indigo, at 0.85 lilac to plum.
// Knob 2: Speed. At 2 a finger drags one swatch across in 1.05 seconds, it rests 0.45 seconds, and the stack glides up 16 LEDs in 0.55 seconds, a new swatch every 2.05 seconds; at 0.2 one every 20 seconds, at 3 one every 1.4.
// Knob 3: Range. How far apart the shades are. At -1 all eight swatches are nearly one shade, at 0 they span the middle half of the range, at 1 they go from a pale tint at 98% brightness to a deep shade at 42%, the light ones leaning warm and the deep ones cool. The range runs light to deep and back over 14 swatches, so the stack shows a stretch of it.
// Knob 4: Finish. At -1 matte, flat pigment with only its drag streaks; at 0 satin, a soft highlight along the upper third of every stroke that brightens as a band of light crosses the card every 18 seconds; at 1 metallic, a narrow champagne highlight, a darker lower half with a second thin light along its edge, and one LED in seven of the pigment a fixed sparkle that twinkles.
// Buttons: K1 tap wipes the card clean from the top down and swatches all eight shades again at once, each with a new stroke.

const W = 64, H = 128, SL = 16, ROWS = H / SL, NT = W * SL;
const { min, floor, sqrt, sin, exp, abs, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const hash = (a, b, c) => {
  let h = (a * 374761393 + b * 668265263 + c * 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Rose sits at 0.955 of the wheel; K1 adds to it.
const ROSE = 0.955;

// The card: warm ivory, 198/186/164 in the middle, 10% dimmer at the side
// edges and 7% at the ends, with a fixed paper grain of about 1%.
const GR = new Float32Array(W * H * 3);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - 32) / 32, dy = (y + 0.5 - 64) / 64;
    const v = 1 - 0.1 * dx * dx - 0.07 * dy * dy + 0.024 * (hash(x, y, 7) - 0.5), i = (y * W + x) * 3;
    (GR[i] = 198 * v), (GR[i + 1] = 186 * v), (GR[i + 2] = 164 * v);
  }

// Smooth value noise over a table of random numbers.
const n1 = (T, f) => {
  const i = cl(floor(f), 0, T.length - 2), t = cl(f - i, 0, 1);
  return T[i] + (T[i + 1] - T[i]) * t * t * (3 - 2 * t);
};
const n2 = (T, n, fx, fy) => {
  const i = cl(floor(fx), 0, T.length / n - 2), t = cl(fx - i, 0, 1), s = t * t * (3 - 2 * t);
  return mix(n1(T.subarray(i * n, i * n + n), fy), n1(T.subarray(i * n + n, i * n + 2 * n), fy), s);
};
const table = (n) => Float32Array.from({ length: n }, () => random());

// One swatch, baked once into fields over its 64x16 slot: how opaque the
// pigment is (A), how light against its own shade (V), where across the
// stroke the LED sits (Q, -1 at the top edge, 1 at the bottom), how much the
// highlight catches there (G), how far the finger must have come before it
// lays this LED (R), and a fixed number for the sparkle (K).
//
// The stroke lands with a round cap of radius r, runs straight with a little
// waver, and from a fraction ut of its length on the pigment runs out: the
// stroke narrows, goes sheer, and the drag streaks, which follow the stroke,
// drop out one by one, the weakest first, until the last one ends at xe.
function swatch(n) {
  const s = {
    n, jit: (random() - 0.5) * 0.05, seed: floor(random() * 1e6),
    A: new Float32Array(NT), V: new Float32Array(NT), Q: new Float32Array(NT), G: new Float32Array(NT), R: new Float32Array(NT), K: new Float32Array(NT),
    p: 0, go: false, wait: 0, xa: 0, xb: 0, prev: null, wipe: 1, wwait: 0,
  };
  const r = 5.3 + random() * 0.6, x0 = 2 + random() * 3.5, xe = 58 + random() * 6, ut = 0.4 + random() * 0.16;
  const slope = (random() - 0.5) * 0.04, amp = 0.2 + random() * 0.35, fr = 0.05 + random() * 0.06, ph = random() * 2 * PI, xm = (x0 + xe) / 2;
  const T1 = table(24), T2 = table(24 * 10), T3 = table(24 * 24), TE = table(20);
  for (let j = 0; j < SL; j++)
    for (let x = 0; x < W; x++) {
      const i = j * W + x, xc = x + 0.5;
      const yc = 7.5 + slope * (xc - xm) + amp * sin(xc * fr + ph), q = j + 0.5 - yc, u = (xc - x0) / (xe - x0);
      let hw;
      if (xc < x0 + r) {
        const d = (x0 + r - xc) / r;
        hw = d >= 1 ? -1 : r * sqrt(1 - d * d);
      } else hw = r * (1 - 0.06 * u - 0.24 * sm(ut, 1.1, u));
      hw += 0.5 * (n1(TE, xc / 4 + 2) - 0.5);
      const cov = cl(hw - abs(q) + 0.5, 0, 1);
      const st = 0.62 * n1(T1, q * 1.15 + 11) + 0.38 * n2(T2, 24, xc / 8, q + 11);
      // In the tail the streaks also break along their length, where the
      // last of the pigment skips over the card.
      const thin = sm(ut, 1, u), brk = n2(T3, 24, xc / 2.6, q * 1.3 + 11);
      const keep = sm(-0.2, 0.2, st * 1.1 + 0.3 - thin * (1.05 + 0.7 * brk));
      s.A[i] = cov * (0.93 + 0.07 * st) * keep * (1 - 0.5 * thin) * (1 - sm(0.94, 1.04, u));
      // Where the finger landed the pigment piles up a shade deeper, and the
      // drag pushes a little more of it to the two long edges.
      const ce = xc - (x0 + r - sqrt(Math.max(0, r * r - q * q)));
      let v = (1 + 0.24 * (st - 0.5)) * (1 - 0.1 * sm(0.55, 1, abs(q) / Math.max(hw, 0.5)));
      if (ce < 2.5) v *= 0.8 + 0.2 * cl(ce / 2.5, 0, 1);
      s.V[i] = v;
      s.Q[i] = q / Math.max(hw, 1);
      s.G[i] = (0.45 + st) * (1 - 0.7 * thin);
      s.R[i] = xc + 0.85 * (r - sqrt(Math.max(0, r * r - q * q)));
      s.K[i] = hash(x, j, s.seed);
    }
  (s.xa = x0 - 1.5), (s.xb = xe + r + 2);
  return s;
}

// The finger sets off quickly and slows as the pigment runs out.
const travel = (p) => 0.4 * p * p * (3 - 2 * p) + 0.6 * (1 - (1 - p) * (1 - p));
const fingerAt = (s) => s.xa + (s.xb - s.xa) * travel(s.p);

export function setup(params) {
  const L = [];
  for (let k = 0; k <= ROWS; k++) {
    const s = swatch(k);
    if (k < ROWS - 1) s.p = 1;
    L.push(s);
  }
  // The card opens with seven swatches down and the eighth being dragged.
  (L[ROWS - 1].go = true), (L[ROWS - 1].p = 0.12);
  params.s = {
    L, n: ROWS + 1, off: 0, phase: 0, pt: 0, t: 0, sweep: 30, hue: 0, speed: 2, width: 0.52, fin: 0.06,
    col: new Float32Array((ROWS + 1) * 6), SH: new Float32Array(64), SW: new Float32Array(180),
  };
}

// The stack glides up a row: the top swatch leaves, an empty slot comes in
// at the bottom and the finger starts on the slot above it.
function shift(P) {
  P.L.shift();
  P.L.push(swatch(P.n++));
  (P.off = 0), (P.phase = 0), (P.pt = 0);
  const B = P.L[ROWS - 1];
  (B.go = true), (B.p = 0);
}

// K1: a pad wipes each swatch off left to right, row after row, and a
// finger follows each wipe with a fresh stroke of the same shade.
function reswatch(P) {
  if (P.phase === 2) shift(P);
  P.phase = 0;
  for (let k = 0; k < ROWS; k++) {
    const old = P.L[k], s = swatch(old.n);
    old.prev = null;
    if (old.p > 0) (s.prev = old), (s.wipe = 0), (s.wwait = 0.07 * k);
    (s.go = true), (s.p = 0), (s.wait = 0.07 * k + 0.3);
    P.L[k] = s;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.width = 0.04 + 0.48 * (cl(k[2], -1, 1) + 1);
  P.fin = cl(k[3], -1, 1);
  const sp = P.speed, drag = 2.1 / sp, hold = 0.9 / sp, glide = 1.1 / sp;
  P.t += d;
  // A band of light crosses the card corner to corner every 18 s at Speed 2.
  P.sweep += d * 7 * sp;
  if (P.sweep > 200) P.sweep -= 250;
  if (input.btnPressed && input.btnPressed[0]) reswatch(P);
  for (const s of P.L) {
    if (s.prev) {
      if (s.wwait > 0) s.wwait -= d;
      else if ((s.wipe += d / 0.45) >= 1) s.prev = null;
    }
    if (s.go && s.p < 1) {
      if (s.wait > 0) s.wait -= d;
      else s.p = min(1, s.p + d / drag);
    }
  }
  const B = P.L[ROWS - 1];
  if (P.phase === 0) {
    if (B.p >= 1) (P.phase = 1), (P.pt = 0);
  } else if (P.phase === 1) {
    if ((P.pt += d) >= hold) (P.phase = 2), (P.pt = 0);
  } else {
    P.pt += d;
    const u = min(1, P.pt / glide);
    P.off = SL * u * u * (3 - 2 * u);
    if (u >= 1) shift(P);
  }
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = 255 * rgb[c];
}

// The shade of swatch n: the range runs light to deep and back over 14
// swatches, so the eight on the card always show a stretch of it.
function tone(P, s, m, out, o) {
  const a = s.n % 14, tri = (a <= 7 ? a : 14 - a) / 7, w = P.width;
  const d = cl(0.5 + w * (tri - 0.5) + s.jit, 0, 1);
  const h = P.hue + ROSE + 0.05 * w * (0.5 - d);
  hsv(h, 0.3 + 0.58 * d, (0.98 - 0.56 * d) * (1 + 0.12 * m), out, o);
  // The highlight: a pale tint of the same hue, and towards metallic a
  // champagne one.
  hsv(h + 0.02 * m, (0.3 + 0.58 * d) * 0.35, 1, out, o + 3);
  for (let c = 0; c < 3; c++) out[o + 3 + c] = mix(mix(out[o + 3 + c], 255, 0.35), [255, 226, 186][c], 0.55 * m);
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const f = P.fin, m = sm(0.15, 1, f), col = P.col, SH = P.SH, SW = P.SW, L = P.L;
  // Matte keeps 3% of a sheen, satin 50%, metallic 95%, narrower as it
  // goes; metallic also throws a weaker second light off the lower edge.
  const kS = 0.03 + 0.47 * sm(-1, 0, f) + 0.45 * sm(0, 1, f), wS = f < 0 ? mix(0.4, 0.75, -f) : mix(0.4, 0.26, f);
  for (let b = 0; b < 64; b++) {
    const q = -1.6 + (3.2 * b) / 63, e = (q + 0.3) / wS, e2 = (q - 0.72) / 0.16;
    SH[b] = kS * exp(-e * e) + 0.35 * m * exp(-e2 * e2);
  }
  const base = mix(0.85, 0.5, m), amp = mix(0.45, 1.4, m);
  for (let g = 0; g < 180; g++) {
    const e = (g - P.sweep) / 15;
    SW[g] = exp(-e * e);
  }
  for (let k = 0; k <= ROWS; k++) tone(P, L[k], m, col, k * 6);
  const dens = 1 - 0.15 * m, t = P.t, off = round(P.off);
  const XF = L.map((s) => (s.p < 1 ? fingerAt(s) : 1e3)), PF = L.map((s) => (s.prev ? fingerAt(s.prev) : 0));
  const WX = L.map((s) => -6 + 78 * s.wipe);
  for (let y = 0; y < H; y++) {
    const ty = y + off, k = floor(ty / SL), j = ty - k * SL, s = L[k], o = k * 6, xf = XF[k];
    for (let x = 0; x < W; x++) {
      const gi = (y * W + x) * 3;
      let r = GR[gi], g = GR[gi + 1], b = GR[gi + 2];
      const i = j * W + x;
      // The swatch being wiped off, still there right of the round edge of
      // the pad.
      if (s.prev) {
        const S = s.prev, e = WX[k] - 2.5 * S.Q[i] * S.Q[i], a = S.A[i] * cl((PF[k] - S.R[i]) * 0.8 + 0.5, 0, 1) * sm(e - 2.5, e + 2.5, x);
        if (a > 0.004) {
          const v = S.V[i];
          (r = mix(r, col[o] * v, a)), (g = mix(g, col[o + 1] * v, a)), (b = mix(b, col[o + 2] * v, a));
        }
      }
      let a = s.A[i];
      if (a > 0.004) {
        let wet = 0;
        if (xf < 1e3) {
          const dx = xf - s.R[i];
          a *= cl(dx * 0.8 + 0.5, 0, 1);
          if (dx > 0 && dx < 4) wet = 0.5 * (1 - dx / 4);
        }
        if (a > 0.004) {
          const Q = s.Q[i], v = s.V[i] * (1 - 0.42 * m * sm(-0.1, 0.6, Q));
          let pr = col[o] * v, pg = col[o + 1] * v, pb = col[o + 2] * v;
          const lt = SW[cl(round(y + 0.55 * x), 0, 179)];
          const h = min(1, SH[cl(round(((Q + 1.6) * 63) / 3.2), 0, 63)] * s.G[i] * (base + amp * lt) + wet);
          (pr = mix(pr, col[o + 3], h)), (pg = mix(pg, col[o + 4], h)), (pb = mix(pb, col[o + 5], h));
          const K = s.K[i];
          if (m > 0 && K > dens && a > 0.4) {
            const tw = sin(K * 6283 + t * 2.6);
            if (tw > 0.3) {
              const z = (tw - 0.3) / 0.7, spk = z * z * m * (0.45 + 0.9 * lt);
              (pr = mix(pr, 255, spk)), (pg = mix(pg, 248, spk)), (pb = mix(pb, 232, spk));
            }
          }
          (r = mix(r, pr, a)), (g = mix(g, pg, a)), (b = mix(b, pb, a));
        }
      }
      display.setPixel(x, y, min(255, r), min(255, g), min(255, b));
    }
  }
}
