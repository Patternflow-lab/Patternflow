// ===== Patternflow pattern =====
// Title:   Ligature Collapse
// Family:  type
// Idea:    Four words stand down the panel in a lowercase face drawn for it, and as the space between their letters closes, the f of office, waffle, final and flow reaches into the dot of the i or the stem of the l, collides there in hot pink and then joins it as one amber glyph, while sofa, shoe and wash only come closer and pile up.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ligatures in metal type, as in Johannes Gutenberg's 42-line Bible (1450s), with letter shapes drawn for this pattern, pattern round 107
// Round:   107
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tracking=0..4, Sheet=0..3, Weight=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the letters are pale cyan, a joined pair is amber and an LED that two letters both reach is hot pink. A letter flashes white while it is half way into a join.
// Knob 2: Tracking. The space between letters, added to 2 LEDs of side bearing: 1.8 LEDs at 0, -0.7 at the opening 2 and -3.2 at 4. The knob sets the middle of a sweep that swings 2.5 LEDs either way every 6.4 s and stops at 1.8 and -3.2, so at 2 the words go from loose to piled up and back each time. While the knob is moving, and for 3.5 s after, the sweep waits and the knob sets the space itself. At the opening weight the f of office, final and fish first touches the dot of its i at 1.05 and the f of waffle, flow and flesh the stem of its l at 1.15. A join is half made at -0.4 for fl, -0.6 for fi and -1.0 for ff, and all are rigid by -1.7. The f of sofa meets its a at -1.95.
// Knob 3: Sheet. 0 turns through three sheets of four words, one a sweep, and 1, 2 and 3 hold one: office, sofa, waffle, clean; final, shoe, flow, wash; fish, snow, flesh, lens. A line that changes waits 0.1 s for each line above it, fades out over 0.25 s, swaps its word and fades in over 0.25 s.
// Knob 4: Weight. The stroke width, 1.45 LEDs at -1, 2.3 at 0 and 3.15 at 1, 2.35 at the opening 0.06. The outline stays 14 LEDs to the x-height, so a heavier stroke brings every collision sooner: the first touch in office is at 0.1 at -1, at 1.05 at the opening and at the loose end, 1.8, at 1.

// How it is made. A letter is a list of strokes, each a centre line with a half width, and an LED takes its brightness from its distance
// to the nearest centre line, falling from full to dark over 0.7 LED. The outline is fixed (14 LEDs to the x-height, 22 to the top of an
// f, 23.5 to the top of an l), so Weight only moves the centre lines inwards. A pair is an f followed by an f, an i or an l. Its join m
// runs from 0 to 1 as the tracking falls through a window 1.4 LEDs wide, and every part of the pair follows m. The bar of the f runs on
// to the next stem and the letters slide to the spacing of the joined glyph. Before an f or an l the hook runs on to that stem and loses
// its flick. Before an i the flick moves over the i and shortens until its tip stands where the dot was, and the dot shrinks to nothing.
// Each letter is drawn on its own, and an LED that two letters reach glows pink by the share of the pair that is not yet joined.

const W = 64, H = 128;
const { floor, round, min, max, abs, sin, cos, pow, sqrt, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => ((u = cl(u, 0, 1)), u * u * (3 - 2 * u));
const sgn = (v) => (v < 0 ? -1 : 1);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// Letters are 14 LEDs to the x-height and 22 to the top of an f, an l or the dot
// of an i. Four lines stand 32 LEDs apart, baselines at rows 27, 59, 91, 123.
const XH = 14, ASC = 22, ASCL = 23.5, BASE0 = 27, PITCH = 32, LINES = 4, LSB = 1;
const SWEEP = 6.4, START = 0.3;

const WORDS = [
  ["office", "sofa", "waffle", "clean"],
  ["final", "shoe", "flow", "wash"],
  ["fish", "snow", "flesh", "lens"],
];

// A link is an f followed by an f, an i or an l. gc is the tracking at which it
// is half joined; below it the pair is rigid. c is the counter between the two
// stems once joined.
const LINKS = { ff: { gc: -1.0, c: 4.2 }, fl: { gc: -0.4, c: 3.8 }, fi: { gc: -0.6, c: 4.2 } };
const WIN = 0.7;
const NEXT = { f: "ff", i: "fi", l: "fl" };

// Width of each letter's ink.
const INK = { o: 8.8, c: 8.2, e: 8.8, a: 8.4, n: 8.0, h: 8.0, s: 7.8, w: 11.0 };

function metric(ch, sw) {
  if (ch === "f") return { adv: 7.8, sc: 2.3 + sw / 2 };
  if (ch === "i" || ch === "l") return { adv: sw + 2 * LSB, sc: LSB + sw / 2 };
  return { adv: INK[ch] + 2 * LSB, sc: 0 };
}

// ---- strokes: flat lists of x0, y0, x1, y1, half width, y up from the baseline
function line(s, x0, y0, x1, y1, hw) {
  s.push(x0, y0, x1, y1, hw);
}
function poly(s, P, hw) {
  for (let i = 2; i < P.length; i += 2) s.push(P[i - 2], P[i - 1], P[i], P[i + 1], hw);
}
// Points of a superellipse arc, a0 to a1 in turns, 0 at the right, 0.25 at the top.
function arc(P, cx, cy, rx, ry, a0, a1, n, e) {
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * 2 * PI, c = cos(a), s = sin(a);
    P.push(cx + rx * sgn(c) * pow(abs(c), 2 / e), cy + ry * sgn(s) * pow(abs(s), 2 / e));
  }
}

function glyph(ch, sw) {
  const h = sw / 2, s = [], P = [];
  const w = INK[ch], cx = LSB + w / 2, cy = XH / 2, rx = w / 2 - h, ry = XH / 2 - h;
  if (ch === "o") {
    arc(P, cx, cy, rx, ry, 0, 1, 36, 2.5);
    poly(s, P, h);
  } else if (ch === "c") {
    arc(P, cx, cy, rx, ry, 0.09, 0.91, 30, 2.5);
    poly(s, P, h);
  } else if (ch === "e") {
    arc(P, cx, cy, rx, ry, 0, 0.87, 32, 2.5);
    poly(s, P, h);
    line(s, cx - rx, cy, cx + rx, cy, h);
  } else if (ch === "a") {
    arc(P, cx, cy, rx, ry, 0, 1, 36, 2.5);
    poly(s, P, h);
    line(s, cx + rx, XH - h, cx + rx, h, h);
  } else if (ch === "n" || ch === "h") {
    const xl = LSB + h, xr = LSB + w - h, top = ch === "h" ? ASCL - h : XH - h, r = 5.2;
    line(s, xl, h, xl, top, h);
    arc(P, (xl + xr) / 2, XH - h - r, (xr - xl) / 2, r, 0.5, 0, 16, 2);
    P.push(xr, h);
    poly(s, P, h);
  } else if (ch === "s") {
    const ym = XH / 2, rr = w / 2 - h;
    arc(P, cx, (XH - h + ym) / 2, rr, (XH - h - ym) / 2, 0.08, 0.75, 16, 2);
    arc(P, cx, (ym + h) / 2, rr, (ym - h) / 2, 0.25, -0.42, 18, 2);
    poly(s, P, h);
  } else if (ch === "w") {
    const xl = LSB + h * 0.8, xr = LSB + w - h * 0.8, d = (xr - xl) / 4;
    P.push(xl, XH - h, xl + d, h, xl + 2 * d, XH * 0.66, xl + 3 * d, h, xr, XH - h);
    poly(s, P, h * 0.9);
  }
  return s;
}

// The f, with the links it takes part in. mIn is how far it is joined to an f
// before it, mOut how far to the letter after it, nx the x of that letter's
// stem relative to this stem's letter origin.
function glyphF(sw, mIn, type, mOut, nx) {
  const h = sw / 2, s = [], P = [], sc = 2.3 + h, yt = ASC - h;
  const R = 3.6, R2 = 1.8, D0 = 2.6, Rin = R * (1 - mIn);
  line(s, sc, h, sc, yt - Rin, h);
  P.push(sc, yt - Rin);
  if (Rin > 0.05) arc(P, sc + Rin, yt - Rin, Rin, Rin, 0.5, 0.25, 8, 2);
  let xr = sc + R, flick = 1, drop = D0;
  // Before an i the flick travels to the i and shortens until its tip stands where the dot was.
  if (type === "fi") (xr = lerp(sc + R, nx - R2, mOut)), (drop = lerp(D0, 0.9, mOut));
  else if (type) (xr = lerp(sc + R, nx, mOut)), (flick = 1 - mOut), (drop = D0 * flick);
  P.push(xr, yt);
  if (flick > 0.03) {
    const r2 = R2 * flick;
    arc(P, xr, yt - r2, r2, r2, 0.25, 0, 5, 2);
    P.push(xr + r2, yt - r2 - drop);
  }
  poly(s, P, h);
  line(s, h + 0.3, XH - h, type ? lerp(sc + 3.3, nx, mOut) : sc + 3.3, XH - h, h);
  return s;
}

function glyphIL(ch, sw, m) {
  const h = sw / 2, s = [], sc = LSB + h;
  line(s, sc, h, sc, (ch === "l" ? ASCL : XH) - h, h);
  if (ch === "i" && m < 0.97) line(s, sc, XH + 4.4, sc, XH + 4.4, (h + 0.55) * (1 - m));
  return s;
}

function bounds(s) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < s.length; i += 5) {
    const hw = s[i + 4] + 0.5;
    x0 = min(x0, s[i] - hw, s[i + 2] - hw);
    x1 = max(x1, s[i] + hw, s[i + 2] + hw);
    y0 = min(y0, s[i + 1] - hw, s[i + 3] - hw);
    y1 = max(y1, s[i + 1] + hw, s[i + 3] + hw);
  }
  return [x0, x1, y0, y1];
}

// One word at tracking g: the letters, where each stands and how far each link
// has closed. The word is centred on its ink.
function setWord(S, ln, g) {
  const word = ln.word, n = word.length, sw = S.sw, xs = [], mk = new Array(n).fill(0), ty = new Array(n).fill(null);
  let x = 0;
  for (let k = 0; k < n; k++) {
    xs.push(x);
    const a = metric(word[k], sw);
    let step = a.adv + g;
    if (word[k] === "f" && k + 1 < n && NEXT[word[k + 1]]) {
      const t = NEXT[word[k + 1]], b = metric(word[k + 1], sw);
      ty[k] = t;
      mk[k] = ease((LINKS[t].gc + WIN - g) / (2 * WIN));
      step = lerp(step, sw + LINKS[t].c - b.sc + a.sc, mk[k]);
    }
    x += step;
  }
  const letters = [];
  let lo = 1e9, hi = -1e9;
  for (let k = 0; k < n; k++) {
    const ch = word[k], mIn = k > 0 && ty[k - 1] ? mk[k - 1] : 0, mOut = ty[k] ? mk[k] : 0;
    let seg;
    if (ch === "f") seg = glyphF(sw, mIn, ty[k], mOut, ty[k] ? xs[k + 1] + metric(word[k + 1], sw).sc - xs[k] : 0);
    else if (ch === "i" || ch === "l") seg = glyphIL(ch, sw, mIn);
    else seg = S.glyphs[ch] || (S.glyphs[ch] = glyph(ch, sw));
    const b = bounds(seg);
    lo = min(lo, xs[k] + b[0]);
    hi = max(hi, xs[k] + b[1]);
    letters.push({ ch, seg, x: xs[k], b, join: max(mIn, mOut), mIn, mOut });
  }
  const off = W / 2 - (lo + hi) / 2;
  for (const L of letters) L.x += off;
  ln.letters = letters;
  ln.mk = mk;
  ln.ty = ty;
}

export function setup(params) {
  const S = (params.s = {
    t: START, k2: null, idle: 99, env: 1, g: 0, sw: 0, glyphs: {}, hue: -1, pal: new Float32Array(12),
    lines: [], out: new Float32Array(W * H * 3), cov: new Float32Array(W * H * 2), ids: new Int16Array(W * H * 2), hot: new Float32Array(W * H),
  });
  for (let i = 0; i < LINES; i++) S.lines.push({ word: WORDS[0][i], target: WORDS[0][i], a: 1, wait: 0, letters: [], mk: [], ty: [] });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  const hue = cl(k[0], 0, 1);
  if (hue !== S.hue) {
    S.hue = hue;
    hsv(hue + 0.52, 0.5, 1, S.pal, 0);
    hsv(hue + 0.12, 0.82, 1, S.pal, 3);
    hsv(hue + 0.93, 0.9, 1, S.pal, 6);
    hsv(hue + 0.6, 0.7, 0.3, S.pal, 9);
  }
  const sw = 2.3 + 0.85 * cl(k[3], -1, 1);
  if (sw !== S.sw) ((S.sw = sw), (S.glyphs = {}));

  // Tracking: the knob sets the space the sweep swings round, and while the knob is moving the sweep waits.
  const k2 = cl(k[1], 0, 4);
  if (S.k2 !== null && abs(k2 - S.k2) > 1e-6) S.idle = 0;
  else S.idle += d;
  S.k2 = k2;
  S.env += ((S.idle > 3.5 ? 1 : 0) - S.env) * cl(d / 1, 0, 1);
  const gk = 1.8 - 1.25 * k2;
  S.g = cl(gk + S.env * 2.5 * cos((2 * PI * S.t) / SWEEP), -3.2, 1.8);

  // Sheet: 0 goes through the three in turn, one a sweep.
  const kp = round(cl(k[2], 0, 3));
  const sheet = kp === 0 ? floor(S.t / SWEEP) % 3 : kp - 1;
  for (let i = 0; i < LINES; i++) {
    const ln = S.lines[i];
    if (WORDS[sheet][i] !== ln.target) (ln.target = WORDS[sheet][i]), (ln.wait = 0.1 * i);
    if (ln.word !== ln.target) {
      if (ln.wait > 0) ln.wait -= d;
      else if ((ln.a -= d / 0.25) <= 0) (ln.a = 0), (ln.word = ln.target);
    } else ln.a = min(1, ln.a + d / 0.25);
    setWord(S, ln, S.g);
  }
}

function dist(s, i, px, py) {
  const x0 = s[i], y0 = s[i + 1], dx = s[i + 2] - x0, dy = s[i + 3] - y0;
  const l2 = dx * dx + dy * dy;
  let u = l2 > 1e-9 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const ex = px - x0 - dx * u, ey = py - y0 - dy * u;
  return sqrt(ex * ex + ey * ey);
}

export function draw(display, params) {
  const S = params.s, { cov, ids, hot } = S, pal = S.pal;
  cov.fill(0);
  ids.fill(-1);
  hot.fill(0);
  const out = S.out;
  out.fill(0);
  // Guides: the baseline and the x-height of each line, a dotted rule.
  for (let i = 0; i < LINES; i++) {
    const base = BASE0 + PITCH * i;
    for (const row of [base, base - XH - 1]) for (let x = 0; x < W; x += 2) for (let c = 0; c < 3; c++) out[(row * W + x) * 3 + c] = pal[9 + c] * 0.5;
  }
  for (let li = 0; li < LINES; li++) {
    const ln = S.lines[li], base = BASE0 + PITCH * li;
    ln.letters.forEach((L, k) => {
      const id = li * 16 + k;
      const x0 = max(0, floor(L.x + L.b[0])), x1 = min(W - 1, floor(L.x + L.b[1]));
      const y0 = max(0, floor(base - L.b[3])), y1 = min(H - 1, floor(base - L.b[2]));
      for (let Y = y0; Y <= y1; Y++)
        for (let X = x0; X <= x1; X++) {
          const px = X + 0.5 - L.x, py = base - (Y + 0.5);
          let c = 0;
          for (let i = 0; i < L.seg.length; i += 5) {
            const v = (L.seg[i + 4] - dist(L.seg, i, px, py)) * 1.5 + 0.5;
            if (v > c) c = v;
          }
          if (c <= 0.02) continue;
          c = min(1, c) * ln.a;
          const q0 = (Y * W + X) * 2, q1 = q0 + 1;
          if (ids[q0] >= 0) {
            // Two letters on one LED collide, unless they are a joined pair.
            const o = ids[q0], ol = o & 15;
            const link = o >> 4 === li && abs(ol - k) === 1 ? ln.mk[min(ol, k)] : 0;
            hot[Y * W + X] += min(c, cov[q0]) * (1 - ease(link * 1.4));
          }
          if (c > cov[q0]) {
            cov[q1] = cov[q0];
            ids[q1] = ids[q0];
            cov[q0] = c;
            ids[q0] = id;
          } else if (c > cov[q1]) {
            cov[q1] = c;
            ids[q1] = id;
          }
        }
    });
  }
  for (let p = 0; p < W * H; p++) {
    const id = ids[p * 2];
    if (id < 0) continue;
    const L = S.lines[id >> 4].letters[id & 15], c = cov[p * 2], q = min(1, hot[p] * 2.2);
    for (let ch = 0; ch < 3; ch++) {
      // a letter half way into a joined pair flashes white
      const flash = sin(PI * L.join) * 0.5;
      const own = min(255, lerp(lerp(pal[ch], pal[3 + ch], L.join), 255, flash)) * c;
      out[p * 3 + ch] = lerp(own, pal[6 + ch] * max(c, hot[p]), q);
    }
  }
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, out[p * 3] + 0.5) | 0, min(255, out[p * 3 + 1] + 0.5) | 0, min(255, out[p * 3 + 2] + 0.5) | 0);
}
