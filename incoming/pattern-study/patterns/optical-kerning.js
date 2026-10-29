// ===== Patternflow pattern =====
// Title:   Optical Kerning
// Family:  type
// Idea:    Five words whose letters have open and slanted sides, AVOW, LYNX, TOY, WAVE and FLY among them, stand in capitals 19 LEDs tall down the panel, the white between each pair of neighbours glows in a colour that says how much of it there is, and after each word is set with the same 2 LED space between every pair of letter boxes, so that A and V gape while H and I sit tight, its letters slide sideways until every gap holds the same area and the glows of the word turn one colour, a wave of new words running down the panel every few seconds.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 72, after spacing letters by a formula rather than by eye as in David Kindersley's Optical Letter Spacing for New Printing Systems (1976 edition) and the spacing method in Walter Tracy's Letters of Credit (1986)
// Round:   72
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tracking=-1..1, Depth=-1..1
//
// Knob 1: Hue. Turns the glow palette round the wheel. At 0 a gap 1.5 LEDs or less across on average glows violet-blue, 3.6 cyan, 6 yellow-green and 7.5 or more amber; the letters stay warm white.
// Knob 2: Speed. At 2 a word is set, shown for 1.15 s at box spacing, slides into its spacing in 1.5 s, holds 3 s and goes, 6.35 s in all, and each line starts 0.45 s after the one above; at 0.2 a word takes 64 s, at 3 it takes 4.2 s.
// Knob 3: Tracking. The area every gap is spaced to, given as its width averaged over the 19 rows: 3.6 LEDs at 0, where every gap of all ten words meets it, H and I stand 3.6 apart and A tucks 0.3 under V; 2.4 at -1, where seven pairs, Y N, F L and T O among them, reach the 1 LED that letters may come to and stay a little wider than the rest; 5.4 at 1, AVOW then 57 LEDs wide. The settled glows are blue at -1, cyan at 0 and green at 1.
// Knob 4: Depth. How far into an open side the white is counted, measured in from the letter's outermost point: 3.2 LEDs at the opening 0.06. At -1 only 1 LED counts, every pair is spaced almost by its boxes and A V stays 1.9 apart, as wide as N X. At 1 the 8 LEDs counted reach right into the throats of A, V, L and T: A goes 0.6 under V and the L's foot 3.4 under the Y's arm, and still L Y, L T and F L cannot shed enough white without touching, so their glows stay yellow-green while the rest settle cyan.

// The white between two letters is counted row by row through the cap
// height: the horizontal distance between their facing contours, except
// that on each side the distance is counted only Depth LEDs in from that
// letter's outermost point. Without that limit the open sides of A, L, T, V
// and Y would count all their white and pull their neighbours in until they
// touched. Every pair is then moved until its area meets the Tracking
// target, never closer than 1 LED in any row.
//
// Pairs whose slants run parallel, V Y or A X, cannot meet any target this
// way: the tips touch before the throats close. The words leave them out.

const W = 64, H = 128, CAP = 19, HW = 1.25, LINES = 5, PITCH = 25, TOP0 = 4, BOX = 2, CLEAR = 1;
const { floor, round, min, max, abs, sqrt, exp, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The capitals, drawn for this pattern in a box 19 LEDs tall: "r" is a
// filled rectangle x0, y0, x1, y1; "s" a stroke 2.5 LEDs wide along a
// segment, cut flat at the top and bottom of the box; "o" an elliptical
// ring 2.5 LEDs wide with its centre and the radii of its middle line.
const GLYPHS = {
  A: [["s", 6, -1, 1.2, 19.6], ["s", 6, -1, 10.8, 19.6], ["r", 2.4, 12, 9.6, 14.5]],
  V: [["s", 1.2, -0.6, 6, 20], ["s", 10.8, -0.6, 6, 20]],
  O: [["o", 6, 9.5, 4.75, 8.25]],
  W: [["s", 1.1, -0.5, 4.3, 19.6], ["s", 4.3, 19.6, 7.5, 3], ["s", 7.5, 3, 10.7, 19.6], ["s", 10.7, 19.6, 13.9, -0.5]],
  L: [["r", 0, 0, 2.5, 19], ["r", 0, 16.5, 10, 19]],
  Y: [["s", 1.2, -0.6, 6, 10], ["s", 10.8, -0.6, 6, 10], ["r", 4.75, 9, 7.25, 19]],
  N: [["r", 0, 0, 2.5, 19], ["r", 9.5, 0, 12, 19], ["s", 1.4, 0.4, 10.6, 18.6]],
  X: [["s", 1.2, -0.6, 10.8, 19.6], ["s", 10.8, -0.6, 1.2, 19.6]],
  T: [["r", 0, 0, 12, 2.5], ["r", 4.75, 0, 7.25, 19]],
  E: [["r", 0, 0, 2.5, 19], ["r", 0, 0, 10, 2.5], ["r", 0, 8.25, 9, 10.75], ["r", 0, 16.5, 10, 19]],
  F: [["r", 0, 0, 2.5, 19], ["r", 0, 0, 10, 2.5], ["r", 0, 8.25, 9, 10.75]],
  I: [["r", 0, 0, 2.5, 19]],
  H: [["r", 0, 0, 2.5, 19], ["r", 8.5, 0, 11, 19], ["r", 0, 8.25, 11, 10.75]],
};
// Line k takes words k and k + 5 in turn.
const WORDS = ["AVOW", "LYNX", "TOY", "WAVE", "FLY", "YAWL", "HILT", "VOLT", "AWAY", "OVAL"];

// Signed distance from a point in the box to the letter's ink (negative inside).
function dist(parts, x, y) {
  let d = 1e9;
  for (const p of parts) {
    let e;
    if (p[0] === "r") {
      const dx = max(p[1] - x, x - p[3]), dy = max(p[2] - y, y - p[4]);
      e = dx > 0 && dy > 0 ? hypot(dx, dy) : max(dx, dy);
    } else if (p[0] === "s") {
      const ax = p[1], ay = p[2], bx = p[3] - ax, by = p[4] - ay;
      const t = cl(((x - ax) * bx + (y - ay) * by) / (bx * bx + by * by), 0, 1);
      e = max(hypot(x - ax - t * bx, y - ay - t * by) - HW, -y, y - CAP);
    } else {
      const qx = (x - p[1]) / p[3], qy = (y - p[2]) / p[4], k0 = hypot(qx, qy), k1 = hypot(qx / p[3], qy / p[4]);
      e = abs((k0 * (k0 - 1)) / max(k1, 1e-6)) - HW;
    }
    if (e < d) d = e;
  }
  return d;
}

// Each letter's contour, row by row, measured once: where the ink starts
// and ends in the row's middle, and from those its outermost points.
function measure(ch) {
  const parts = GLYPHS[ch], lf = new Float32Array(CAP), rt = new Float32Array(CAP);
  for (let r = 0; r < CAP; r++) {
    let a = 99, b = -99;
    for (let x = -3; x <= 17; x += 0.02) if (dist(parts, x, r + 0.5) <= 0) { if (a === 99) a = x; b = x; }
    lf[r] = a;
    rt[r] = b;
  }
  let L = 99, R = -99;
  for (let r = 0; r < CAP; r++) (L = min(L, lf[r])), (R = max(R, rt[r]));
  const ld = new Float32Array(CAP), rd = new Float32Array(CAP);
  for (let r = 0; r < CAP; r++) (ld[r] = lf[r] - L), (rd[r] = R - rt[r]);
  return { parts, L, w: R - L, ld, rd };
}

// The white counted between a left letter and a right letter whose
// outermost points stand g apart, and the g that gives a wanted area.
function area(A, B, g, D) {
  let s = 0;
  for (let r = 0; r < CAP; r++) s += max(0, g + min(A.rd[r], D) + min(B.ld[r], D));
  return s;
}
function solve(A, B, want, D) {
  let lo = -12;
  for (let r = 0; r < CAP; r++) lo = max(lo, CLEAR - A.rd[r] - B.ld[r]);
  if (area(A, B, lo, D) >= want) return lo;
  let hi = 30;
  for (let i = 0; i < 28; i++) {
    const m = (lo + hi) / 2;
    if (area(A, B, m, D) < want) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

function setWord(s, k, word) {
  const ln = s.lines[k];
  ln.word = word;
  ln.g = [];
  ln.letters = [...word].map((ch) => s.m[ch]);
  for (let i = 0; i + 1 < ln.letters.length; i++) ln.g.push(BOX);
}

export function setup(params) {
  const s = (params.s = {});
  s.m = {};
  for (const ch in GLYPHS) s.m[ch] = measure(ch);
  s.lines = [];
  for (let k = 0; k < LINES; k++) {
    s.lines.push({ tau: 0.35 - 0.45 * k, n: 0 });
    setWord(s, k, WORDS[k]);
  }
  s.glow = new Float32Array(W * H * 3);
  s.tmp = new Float32Array(W * H * 3);
  s.ink = new Float32Array(W * H);
  s.D = 3.18;
  s.want = 3.6 * CAP;
  s.hue = 0;
}

// Phases of a line, in seconds at Speed 2.
const T_IN = 0.35, T_SLIDE = 1.5, T_HOLD = 3.0, T_OUT = 6.0, T_END = 6.35;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  s.hue = k[0] || 0;
  const rate = cl(k[1] == null ? 2 : k[1], 0.2, 3) / 2;
  const tr = cl(k[2] || 0, -1, 1), dp = cl(k[3] == null ? 0.06 : k[3], -1, 1);
  s.want = (3.6 + (tr < 0 ? 1.2 : 1.8) * tr) * CAP;
  s.D = 3 * exp(dp * (dp < 0 ? 1.0986 : 0.9808));
  const follow = 1 - exp(-8 * dt);
  for (let li = 0; li < LINES; li++) {
    const ln = s.lines[li];
    ln.tau += dt * rate;
    if (ln.tau >= T_END) {
      ln.tau -= T_END;
      ln.n++;
      setWord(s, li, WORDS[(li + LINES * ln.n) % WORDS.length]);
    }
    const e = ease((ln.tau - T_SLIDE) / (T_HOLD - T_SLIDE));
    for (let i = 0; i < ln.g.length; i++) {
      const target = BOX + (solve(ln.letters[i], ln.letters[i + 1], s.want, s.D) - BOX) * e;
      ln.g[i] += (target - ln.g[i]) * (ln.tau < T_HOLD ? 1 : follow);
    }
  }
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const glow = s.glow, ink = s.ink, D = s.D;
  glow.fill(0);
  ink.fill(0);
  const marks = [];
  for (let li = 0; li < LINES; li++) {
    const ln = s.lines[li], top = TOP0 + li * PITCH, L = ln.letters;
    const fade = ln.tau < 0 ? 1 : ln.tau < T_IN ? ln.tau / T_IN : ln.tau > T_OUT ? 1 - (ln.tau - T_OUT) / (T_END - T_OUT) : 1;
    let total = 0;
    for (let i = 0; i < L.length; i++) total += L[i].w + (i < ln.g.length ? ln.g[i] : 0);
    let x = 32 - total / 2;
    const xs = [];
    for (let i = 0; i < L.length; i++) {
      xs.push(x);
      x += L[i].w + (i < ln.g.length ? ln.g[i] : 0);
    }
    // Letters.
    for (let i = 0; i < L.length; i++) {
      const g = L[i], ox = xs[i] - g.L;
      const x0 = max(0, floor(xs[i] - 1)), x1 = min(W - 1, floor(xs[i] + g.w + 1));
      for (let y = 0; y < CAP; y++)
        for (let px = x0; px <= x1; px++) {
          const c = cl(0.5 - dist(g.parts, px + 0.5 - ox, y + 0.5), 0, 1) * fade;
          const j = (top + y) * W + px;
          if (c > ink[j]) ink[j] = c;
        }
    }
    // The counted white between each pair, and its colour.
    for (let i = 0; i < ln.g.length; i++) {
      const A = L[i], B = L[i + 1], a = xs[i] + A.w, b = xs[i + 1];
      const ar = area(A, B, b - a, D), mean = ar / CAP;
      const sv = cl((mean - 1.5) / 6, 0, 1);
      const col = hsv(0.7 + s.hue - 0.58 * sv, 0.9, 0.62 + 0.3 * sv);
      const lv = fade;
      for (let r = 0; r < CAP; r++) {
        const u0 = a - min(A.rd[r], D), u1 = b + min(B.ld[r], D);
        if (u1 <= u0) continue;
        for (let px = max(0, floor(u0)); px <= min(W - 1, floor(u1)); px++) {
          const c = (min(px + 1, u1) - max(px, u0)) * lv;
          if (c <= 0) continue;
          const j = ((top + r) * W + px) * 3;
          glow[j] += col[0] * c;
          glow[j + 1] += col[1] * c;
          glow[j + 2] += col[2] * c;
        }
      }
      // Under each gap a bar as long as the gap's mean width: its area
      // laid out along one row.
      let cx = 0, n = 0;
      for (let r = 0; r < CAP; r++) {
        const u0 = a - min(A.rd[r], D), u1 = b + min(B.ld[r], D);
        if (u1 > u0) (cx += (u0 + u1) / 2), n++;
      }
      marks.push([n ? cx / n : (a + b) / 2, top + CAP + 1, mean, col, fade]);
    }
  }
  // Soften the glow: a 1-2-1 blur across and down.
  const t = s.tmp;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        const j = (y * W + x) * 3 + c;
        t[j] = (2 * glow[j] + (x > 0 ? glow[j - 3] : 0) + (x < W - 1 ? glow[j + 3] : 0)) / 4;
      }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        const j = (y * W + x) * 3 + c;
        glow[j] = (2 * t[j] + (y > 0 ? t[j - W * 3] : 0) + (y < H - 1 ? t[j + W * 3] : 0)) / 4;
      }
  for (const [cx, y, len, col, f] of marks) {
    const u0 = cx - len / 2, u1 = cx + len / 2;
    for (let px = max(0, floor(u0)); px <= min(W - 1, floor(u1)); px++) {
      const c = cl(min(px + 1, u1) - max(px, u0), 0, 1) * 0.9 * f;
      const j = (y * W + px) * 3;
      for (let q = 0; q < 3; q++) glow[j + q] = max(glow[j + q], col[q] * c);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, j = i * 3, a = ink[i];
      const r = glow[j] * 255 * (1 - a) + 242 * a, g = glow[j + 1] * 255 * (1 - a) + 234 * a, b = glow[j + 2] * 255 * (1 - a) + 218 * a;
      display.setPixel(x, y, round(cl(r + 3, 0, 255)), round(cl(g + 3, 0, 255)), round(cl(b + 6, 0, 255)));
    }
}
