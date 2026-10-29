// ===== Patternflow pattern =====
// Title:   Counterforms
// Family:  type
// Idea:    Four tall bold letters stand dark on the dark panel and only their counters, the holes inside A, B, D, O, P, R and the digits, light up like windows lit from inside, so the word is read through its holes and the glow they spill on the strokes, and between words the windows drain and the next word's fill one by one.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 64, after the counter as the white shape that makes a letter (Gerrit Noordzij, De streek, 1985) and windows lit in a facade at night
// Round:   64
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Words=0..2, Body=0..1
//
// Knob 1: Hue. The lamplight in the windows: warm gold at 0, then green, sky blue, violet and rose round the wheel, each window a little off the next.
// Knob 2: Speed. How fast the windows fill and drain and the words change: at 2 a word every 8 seconds, at 0.2 one in 80.
// Knob 3: Words. Which words: 0 four-letter words made only of letters with counters (DOOR, ROAD, DROP, BOAR, BARD, ROAR), 1 four-digit numbers made only of 0, 4, 6, 8 and 9 (4096, 8086, 6809, 9600, 8008), 2 two Hangul syllables built from the closed jamo ㅁ, ㅂ and ㅇ (봄밤, 엄마, 아빠, 마음).
// Knob 4: Body. How much of the letter body shows besides the light the windows throw on it: none at 0, a faint stone just above what the panel shows at the opening 0.06, moonlit at 0.5, the whole letter standing out at 1.

const W = 64, H = 128, N = W * H;
const Q = 3; // supersampling of the glyph mask
const HW = W * Q, HH = H * Q;
const { floor, round, min, max, sin, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// Every word in a set has only glyphs with counters, so every glyph shows.
const SETS = [
  ["DOOR", "ROAD", "DROP", "BOAR", "BARD", "ROAR"],
  ["4096", "8086", "6809", "9600", "8008"],
  ["봄밤", "엄마", "아빠", "마음"],
];

// The face. A glyph is a list of shapes drawn in order into its cell, each
// one adding ink (1) or cutting it away (0): rounded rectangles with a radius
// per corner [x0, y0, x1, y1, tl, tr, br, bl] and thick lines. The cell is
// w by h LEDs and the stroke s LEDs thick.
function glyph(ch, w, h, s) {
  const P = [];
  const rr = (x0, y0, x1, y1, tl, tr, br, bl, add = 1) => P.push([0, add, x0, y0, x1, y1, tl, tr, br, bl]);
  const box = (x0, y0, x1, y1, add = 1) => rr(x0, y0, x1, y1, 0, 0, 0, 0, add);
  const ln = (x0, y0, x1, y1, wd, add = 1) => P.push([1, add, x0, y0, x1, y1, wd]);
  const inr = (r) => (r > 0 ? max(1.5, r - s) : 0);
  const ring = (x0, y0, x1, y1, tl, tr, br, bl) => {
    rr(x0, y0, x1, y1, tl, tr, br, bl);
    rr(x0 + s, y0 + s, x1 - s, y1 - s, inr(tl), inr(tr), inr(br), inr(bl), 0);
  };
  const R = 10, D = 13;
  let flip = false;
  switch (ch) {
    case "O": ring(0, 0, w, h, D, D, D, D); break;
    case "0": ring(0, 0, w, h, D, D, D, D); box(w / 2 - 1.5, h * 0.3, w / 2 + 1.5, h * 0.7); break;
    case "D": ring(0, 0, w, h, 0, D, D, 0); break;
    case "A": {
      const y = round(h * 0.5);
      rr(0, 0, w, h, R + 3, R + 3, 0, 0);
      rr(s, s, w - s, h + 2, inr(R + 3), inr(R + 3), 0, 0, 0);
      box(0, y, w, y + s);
      break;
    }
    case "B": {
      const m = round(s + (h - 3 * s) * 0.47);
      ring(0, 0, w - 2, m + s, 0, R, R, 0);
      ring(0, m, w, h, 0, R, R, 0);
      break;
    }
    case "P":
    case "R": {
      const m = round(h * 0.56);
      ring(0, 0, w, m, 0, R, R, 0);
      box(0, 0, s, h);
      if (ch === "R") ln(w * 0.4, m - s / 2, w - s / 2, h + 2, s * 1.1);
      break;
    }
    case "8": {
      const m = round(s + (h - 3 * s) * 0.46);
      ring(1, 0, w - 1, m + s, D - 1, D - 1, D - 1, D - 1);
      ring(0, m, w, h, D, D, D, D);
      break;
    }
    case "9": flip = true; // a 6 turned half round
    // falls through
    case "6": {
      const m = round(h * 0.42);
      rr(0, 0, w, h, D, D, D, D);
      rr(s, m + s, w - s, h - s, inr(D), inr(D), inr(D), inr(D), 0);
      box(s, s, w + 2, m, 0);
      box(w * 0.62, -1, w + 2, s + 1, 0);
      break;
    }
    case "4": {
      const x = w - s - 2, y = round(h * 0.64);
      box(x, 0, x + s, h);
      box(0, y, w, y + s);
      ln(x + s * 0.5, s * 0.5, s * 0.55, y + s * 0.5, s * 1.15);
      break;
    }
    // Hangul syllables, built from bars: initial, vowel and final in their
    // usual places in a square cell.
    default:
      hangul(ch, w, h, s, box, rr);
  }
  return { P, flip };
}

function hangul(ch, w, h, s, box, rr) {
  // ㅂ in a box; ㅃ as two of them; ㅁ a closed square; ㅇ a closed oval.
  const b = (x0, y0, x1, y1) => {
    const m = round(y0 + (y1 - y0) * 0.22);
    box(x0, y0, x0 + s, y1);
    box(x1 - s, y0, x1, y1);
    box(x0, m, x1, m + s);
    box(x0, y1 - s, x1, y1);
  };
  const m = (x0, y0, x1, y1) => {
    rr(x0, y0, x1, y1, 2, 2, 2, 2);
    box(x0 + s, y0 + s, x1 - s, y1 - s, 0);
  };
  const o = (x0, y0, x1, y1) => {
    // A circle when the box is wide, an upright oval when it is tall.
    if (x1 - x0 > y1 - y0) {
      const c = (x0 + x1) / 2, d = y1 - y0;
      (x0 = c - d / 2), (x1 = c + d / 2);
    }
    const r = min(x1 - x0, y1 - y0) / 2;
    rr(x0, y0, x1, y1, r, r, r, r);
    const q = max(1.5, r - s);
    rr(x0 + s, y0 + s, x1 - s, y1 - s, q, q, q, q, 0);
  };
  const i0 = { 봄: b, 밤: b, 엄: o, 마: m, 아: o, 빠: b, 음: o }[ch];
  const vertical = "밤엄마아빠".includes(ch);
  const final = "봄밤엄음".includes(ch);
  if (vertical) {
    // Initial on the left, the vowel's long stem on the right, final below.
    const yb = final ? round(h * 0.47) : h - 6;
    const yt = final ? 0 : 6;
    const sx = w - (ch === "빠" ? 13 : 16);
    if (ch === "빠") {
      const half = round((sx - 4) / 2);
      b(0, yt, half, yb);
      b(half + 2, yt, sx - 3, yb);
    } else if (ch === "엄") i0(4, yt, sx - 13, yb);
    else i0(0, yt, sx - 6, yb);
    box(sx, 0, sx + s, final ? yb + 1 : h);
    const my = round((final ? yb : h) * 0.5 - s / 2);
    if (ch === "엄") box(sx - 11, my, sx, my + s);
    else box(sx + s, my, w, my + s);
    if (final) m(4, yb + 6, w - 4, h);
  } else {
    // Initial on top, the vowel's long bar across the middle, final below.
    const yb = round(h * 0.38);
    i0(round(w * 0.17), 0, round(w * 0.83), yb);
    const by = yb + 8;
    if (ch === "봄") box(round(w / 2 - s / 2), yb + 2, round(w / 2 + s / 2), by);
    box(0, by, w, by + s);
    m(6, by + s + 5, w - 6, h);
  }
}

function inside(p, x, y) {
  if (p[0] === 0) {
    if (x < p[2] || x > p[4] || y < p[3] || y > p[5]) return false;
    const cx = (p[2] + p[4]) / 2, cy = (p[3] + p[5]) / 2;
    const left = x < cx, top = y < cy;
    const r = left ? (top ? p[6] : p[9]) : top ? p[7] : p[8];
    if (r <= 0) return true;
    const dx = left ? p[2] + r - x : x - (p[4] - r);
    const dy = top ? p[3] + r - y : y - (p[5] - r);
    if (dx <= 0 || dy <= 0) return true;
    return dx * dx + dy * dy <= r * r;
  }
  const ex = p[4] - p[2], ey = p[5] - p[3];
  const t = cl(((x - p[2]) * ex + (y - p[3]) * ey) / (ex * ex + ey * ey), 0, 1);
  const dx = x - p[2] - t * ex, dy = y - p[3] - t * ey;
  return dx * dx + dy * dy <= (p[6] * p[6]) / 4;
}

// Cells for a word: four glyphs two by two, or two Hangul syllables one
// above the other.
function cells(n) {
  if (n === 4) return [[2, 4, 28, 58], [34, 4, 28, 58], [2, 66, 28, 58], [34, 66, 28, 58]];
  return [[2, 2, 60, 61], [2, 65, 60, 61]];
}

// Ink the word into a mask at Q times the panel's resolution, flood the
// paper from the panel's edge, and whatever paper the flood cannot reach is a
// counter. Each counter is labelled, and the mask is brought back to LEDs as
// coverage.
function build(S, word) {
  const ink = S.hi;
  ink.fill(0);
  const chars = [...word];
  const cs = cells(chars.length);
  chars.forEach((ch, gi) => {
    const [cx, cy, w, h] = cs[gi];
    const s = chars.length === 4 ? 6 : 5;
    const { P, flip } = glyph(ch, w, h, s);
    // Each shape inks or cuts only the samples inside its own box, in order.
    for (const p of P) {
      let x0, y0, x1, y1;
      if (p[0] === 0) (x0 = p[2]), (y0 = p[3]), (x1 = p[4]), (y1 = p[5]);
      else {
        const r = p[6] / 2;
        (x0 = min(p[2], p[4]) - r), (x1 = max(p[2], p[4]) + r), (y0 = min(p[3], p[5]) - r), (y1 = max(p[3], p[5]) + r);
      }
      if (flip) [x0, x1, y0, y1] = [w - x1, w - x0, h - y1, h - y0];
      const sx0 = max(cx * Q, floor((cx + x0) * Q)), sx1 = min((cx + w) * Q, Math.ceil((cx + x1) * Q));
      const sy0 = max(cy * Q, floor((cy + y0) * Q)), sy1 = min((cy + h) * Q, Math.ceil((cy + y1) * Q));
      for (let sy = sy0; sy < sy1; sy++)
        for (let sx = sx0; sx < sx1; sx++) {
          let x = (sx + 0.5) / Q - cx, y = (sy + 0.5) / Q - cy;
          if (flip) (x = w - x), (y = h - y);
          if (inside(p, x, y)) ink[sy * HW + sx] = p[1];
        }
    }
  });
  // Flood the outside (label 2) from every paper sample on the edge.
  const lab = S.lab;
  for (let i = 0; i < HW * HH; i++) lab[i] = ink[i] ? 1 : 0;
  const st = S.stack;
  const flood = (seed, l) => {
    let n = 0, sp = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, gx = 0;
    st[sp++] = seed;
    lab[seed] = l;
    while (sp) {
      const i = st[--sp];
      const x = i % HW, y = (i / HW) | 0;
      n++;
      gx += x;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && !lab[i - 1]) (lab[i - 1] = l), (st[sp++] = i - 1);
      if (x < HW - 1 && !lab[i + 1]) (lab[i + 1] = l), (st[sp++] = i + 1);
      if (y > 0 && !lab[i - HW]) (lab[i - HW] = l), (st[sp++] = i - HW);
      if (y < HH - 1 && !lab[i + HW]) (lab[i + HW] = l), (st[sp++] = i + HW);
    }
    return { n, x0: x0 / Q, x1: (x1 + 1) / Q, y0: y0 / Q, y1: (y1 + 1) / Q, gx: gx / n / Q };
  };
  for (let x = 0; x < HW; x++) for (const y of [0, HH - 1]) if (!lab[y * HW + x]) flood(y * HW + x, 2);
  for (let y = 0; y < HH; y++) for (const x of [0, HW - 1]) if (!lab[y * HW + x]) flood(y * HW + x, 2);
  // Every sample still unlabelled is inside a counter.
  const counters = [];
  let next = 3;
  for (let i = 0; i < HW * HH; i++)
    if (!lab[i]) {
      const c = flood(i, next++);
      if (c.n < Q * Q * 3) continue; // a speck, not a window
      // Reading order: by glyph cell, then top to bottom.
      const cyc = (c.y0 + c.y1) / 2;
      c.cell = cs.findIndex(([x, y, w, h]) => c.gx >= x && c.gx < x + w && cyc >= y && cyc < y + h);
      c.label = next - 1;
      counters.push(c);
    }
  counters.sort((a, b) => a.cell - b.cell || a.y0 - b.y0 || a.x0 - b.x0);
  const byLabel = new Int16Array(next).fill(-1);
  counters.forEach((c, k) => (byLabel[c.label] = k));
  // Back to LEDs.
  S.body.fill(0);
  S.cov.fill(0);
  S.cid.fill(-1);
  const tally = new Int32Array(counters.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let b = 0, best = -1, bn = 0;
      tally.fill(0);
      for (let j = 0; j < Q; j++)
        for (let i = 0; i < Q; i++) {
          const l = lab[(y * Q + j) * HW + x * Q + i];
          if (l === 1) b++;
          else if (l >= 3) {
            const k = byLabel[l];
            if (k < 0) continue;
            if (++tally[k] > bn) (bn = tally[k]), (best = k);
          }
        }
      const p = y * W + x;
      S.body[p] = b / (Q * Q);
      if (best >= 0) {
        S.cid[p] = best;
        S.cov[p] = bn / (Q * Q);
        const c = counters[best];
        S.hf[p] = cl((y + 0.5 - c.y0) / (c.y1 - c.y0), 0, 1);
      }
    }
  S.counters = counters.map((c, k) => ({ y0: c.y0, y1: c.y1, area: c.n / (Q * Q), tint: TINTS[k % TINTS.length], beat: k * 1.7 }));
}

// Each window a little off the next, the way lamps in a row of rooms differ.
const TINTS = [0, 0.02, -0.025, 0.035, -0.012, 0.012, -0.035, 0.006];

export function setup(params) {
  params.s = {
    hi: new Uint8Array(HW * HH), lab: new Int32Array(HW * HH), stack: new Int32Array(HW * HH),
    body: new Float32Array(N), cov: new Float32Array(N), cid: new Int16Array(N),
    L: new Float32Array(N * 3), T: new Float32Array(N * 3), B: new Float32Array(N * 3), hf: new Float32Array(N), lut: new Float32Array(64 * 16 * 3),
    counters: [], set: -1, word: 0, t: 0, time: 0, hue: 0, bodyK: 0.06,
  };
}

// The word's life in seconds at Speed 2: the windows fill one after another,
// hold, drain from the last window back, and the dark letters wait a moment
// for the next word.
const STAGGER = 0.42, FILL = 1.0, HOLD = 3.4, DRAIN = 1.1, DARK = 0.55;
function life(S) {
  return S.counters.length * STAGGER + FILL + HOLD + DRAIN + DARK;
}

// How full window k is, 0..1, at word time t.
function level(S, k, t) {
  const n = S.counters.length;
  const a = k * STAGGER;
  const full = n * STAGGER + FILL;
  if (t < full + HOLD) {
    const u = cl((t - a) / FILL, 0, 1);
    return u * u * (3 - 2 * u);
  }
  const d = t - full - HOLD - (n - 1 - k) * 0.08;
  const u = 1 - cl(d / DRAIN, 0, 1);
  return u * u * (3 - 2 * u);
}

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt, 0, 0.1);
  S.hue = k[0];
  const sp = cl(k[1], 0.05, 3) / 2;
  const set = cl(round(k[2]), 0, SETS.length - 1);
  S.bodyK = cl(k[3], 0, 1);
  if (set !== S.set) {
    // A new set opens with its first word already lit.
    S.set = set;
    S.word = 0;
    build(S, SETS[set][0]);
    S.t = S.counters.length * STAGGER + FILL + 0.4;
  }
  S.time += dt;
  S.t += dt * sp;
  if (S.t >= life(S)) {
    S.t -= life(S);
    S.word = (S.word + 1) % SETS[S.set].length;
    build(S, SETS[S.set][S.word]);
  }
}

// How the stone answers the light thrown on it, by the light's level.
const SPILL = 0.8;
const TONE = new Float32Array(1024);

// Box blur of radius r along rows or columns, A into B, the three colour
// channels together.
function blur(A, B, r, horizontal) {
  const len = horizontal ? W : H, lines = horizontal ? H : W;
  const step = horizontal ? 3 : W * 3;
  const norm = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const base = horizontal ? l * W * 3 : l * 3;
    let ar = A[base] * r, ag = A[base + 1] * r, ab = A[base + 2] * r;
    for (let i = 0; i <= r; i++) {
      const q = base + i * step;
      ar += A[q];
      ag += A[q + 1];
      ab += A[q + 2];
    }
    const last = base + (len - 1) * step;
    for (let i = 0, q = base; i < len; i++, q += step) {
      B[q] = ar * norm;
      B[q + 1] = ag * norm;
      B[q + 2] = ab * norm;
      const ai = i + r + 1 < len ? q + (r + 1) * step : last;
      const ao = i - r > 0 ? q - r * step : base;
      ar += A[ai] - A[ao];
      ag += A[ai + 1] - A[ao + 1];
      ab += A[ai + 2] - A[ao + 2];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (S.set < 0) return;
  const { L, T, B, body, cov, cid, hf, counters, lut } = S;
  // Each window's lamp: its tint, a slow breath, how full it is, and its
  // colour from the paler top of the pane to the deeper bottom.
  const lamp = counters.map((c, k) => {
    const lv = level(S, k, S.t);
    const h = 0.115 + S.hue + c.tint;
    for (let j = 0; j < 16; j++) {
      const u = j / 15;
      const [r, g, b] = hsv(h - 0.02 * u, 0.4 + 0.42 * u, 1);
      lut[(k * 16 + j) * 3] = r;
      lut[(k * 16 + j) * 3 + 1] = g;
      lut[(k * 16 + j) * 3 + 2] = b;
    }
    return { lv, top: c.y1 - lv * (c.y1 - c.y0), glow: 0.86 + 0.14 * sin(S.time * 1.15 + c.beat) };
  });
  L.fill(0);
  for (let p = 0; p < N; p++) {
    const k = cid[p];
    if (k < 0) continue;
    const m = lamp[k];
    if (m.lv <= 0) continue;
    const y = (p / W) | 0;
    // The light stands in the window like a liquid: lit below its surface,
    // with a brighter rim while it is still moving.
    const f = cl(y + 1 - m.top, 0, 1);
    if (f <= 0) continue;
    const u = hf[p];
    const rim = m.lv < 0.999 ? 0.5 * exp(-((y + 0.5 - m.top) ** 2) / 2) : 0;
    const v = 236 * cov[p] * f * min(1.3, m.glow * (0.8 + 0.2 * (1 - u)) + rim);
    const q = (k * 16 + round(u * 15)) * 3;
    L[p * 3] = lut[q] * v;
    L[p * 3 + 1] = lut[q + 1] * v;
    L[p * 3 + 2] = lut[q + 2] * v;
  }
  // The light thrown out of the windows onto the strokes round them, strong
  // on the inner edge and fading across the stroke; the night air outside
  // the letters takes almost none of it.
  blur(L, T, 4, true);
  blur(T, B, 4, false);
  blur(B, T, 3, true);
  blur(T, B, 3, false);
  // A square root, so the knob's opening 0.06 already lifts the stone to
  // about 37/255, the faintest the panel shows.
  const moon = Math.sqrt(S.bodyK);
  if (!TONE[1]) for (let i = 1; i < 1024; i++) TONE[i] = (SPILL * 255 * (i / 1020) ** 0.42) / (i / 4);
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const bd = body[p];
      const o = p * 3;
      const s = max(B[o], B[o + 1], B[o + 2]);
      // The stone answers the light with a softer curve than linear, so the
      // far side of a stroke still shows.
      const lift = s > 0.5 ? bd * TONE[min(1023, (s * 4) | 0)] + 0.1 * (1 - bd) : 0;
      display.setPixel(
        x, y,
        cl(L[o] + B[o] * lift + bd * moon * 120, 0, 255),
        cl(L[o + 1] + B[o + 1] * lift + bd * moon * 128, 0, 255),
        cl(L[o + 2] + B[o + 2] * lift + bd * moon * 150, 0, 255),
      );
    }
}
