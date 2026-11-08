// ===== Patternflow pattern =====
// Title:   Winding Rule
// Family:  type
// Idea:    One big letter is drawn twice from the same hand-coded closed contours, the upper half filled by the nonzero rule and the lower half by the even-odd rule, so wherever two contours cover the same ink or a counter runs the same way as its outline the nonzero half stays solid and the even-odd half opens a hole, while a scanline sweeps down both halves colouring each run of ink by its winding number and a marker flows along every contour in the direction it runs.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the nonzero winding and even-odd fill rules of PostScript, PDF, TrueType and SVG outlines (PostScript, Adobe, 1984, year from memory), the winding number of a closed curve, scanline polygon fill; pattern round 111
// Round:   111
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Flip=0..1, Overlap=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a run of winding number 1 is azure, 2 is magenta, 3 is pale pink, -1 is lime and 0 is dark; the contours, their markers and the scanline's ticks are white. Orange and yellow are made paler so they do not dim to brown.
// Knob 2: Speed. How fast the scanline sweeps down the letter: 9 s over the knob, so 4.5 s at 2 (2.3 s at 4, 18 s at 0.5), then the finished letter rests 2.4 s over the knob (1.2 s at 2) before the next one. The markers flow at 9 LEDs a second for each unit, 18 at 2. The rows the scanline has passed are bright and the rows ahead are at 55 percent. The letters come as B, X and 8, 6 s each at 2.
// Knob 3: Flip. Turns the counters over. At 0 each counter of B and 8 runs against its outline, so its winding number is 0 and both halves leave a hole. Turning it squeezes each counter to a line at 0.5, where it has no width, and opens it again the other way round at 1, running the same way as its outline: winding 2, solid and magenta in the nonzero half, still a hole in the even-odd half. On X the first stroke is what flips, and where it crosses the second the winding goes from 2 to 0, a hole in both halves, while the stroke itself is -1, lime.
// Knob 4: Overlap. How far the strokes of a letter are drawn into each other without changing the ink. At 0 the contours only touch. At 1 the bowls of B run 8 LEDs into the stem and 4 rows past the waist each way, the rings of 8 run 5 rows past the waist, and the arms of X's second stroke reach the middle of its first. The overlapped ink has winding number 2 (3 where B's stem and both bowls meet): solid in the nonzero half, a hole in the even-odd half, except the triple crossing, which even-odd fills again. It opens at 0.06, which this knob reads as 0.57 of its travel, so the hole is already 4.6 LEDs wide in the stem of B.

const W = 64, H = 128, HW = 64;
const { floor, ceil, round, min, max, abs, sin, cos, sqrt, pow, hypot, PI } = Math;
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

// ---- contours ----
// A contour is a flat list x0, y0, x1, y1, ... closed back to its start. The
// panel's y runs down, so an outline that goes clockwise on the panel is
// the one with a positive shoelace sum, and it has winding number +1 inside.
// Outer contours run clockwise, as TrueType draws them (PostScript draws them
// the other way, and nothing below cares which way is which, only that a
// counter runs against its outline).
function area2(p) {
  let a = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    a += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return a;
}
function turn(p, cw) {
  if (area2(p) > 0 === cw) return p;
  const q = [];
  for (let i = p.length - 2; i >= 0; i -= 2) q.push(p[i], p[i + 1]);
  return q;
}
// A rectangle with its four corners rounded by r[0..3] (top left, top right,
// bottom right, bottom left).
function rrect(x0, y0, x1, y1, r, cw) {
  const p = [];
  const R = typeof r === "number" ? [r, r, r, r] : r;
  const corner = (cx, cy, rr, a0) => {
    if (rr <= 0) return p.push(cx, cy);
    for (let i = 0; i <= 5; i++) p.push(cx + rr * cos(a0 + (PI / 2) * (i / 5)), cy + rr * sin(a0 + (PI / 2) * (i / 5)));
  };
  corner(x0 + R[0], y0 + R[0], R[0], PI);
  corner(x1 - R[1], y0 + R[1], R[1], -PI / 2);
  corner(x1 - R[2], y1 - R[2], R[2], 0);
  corner(x0 + R[3], y1 - R[3], R[3], PI / 2);
  return turn(p, cw);
}
// Turn a contour over: its distance from the line through (cx, cy) with
// normal (nx, ny) is multiplied by c. At c = -1 it is the mirror image; for
// a shape that is symmetric about that line it is the same region run the
// other way round, and at c = 0 it is flat.
function flip(p, cx, cy, nx, ny, c) {
  const q = [];
  for (let i = 0; i < p.length; i += 2) {
    const t = (p[i] - cx) * nx + (p[i + 1] - cy) * ny;
    q.push(p[i] - (1 - c) * t * nx, p[i + 1] - (1 - c) * t * ny);
  }
  return q;
}
// Sutherland-Hodgman: the part of a convex polygon with n.p >= k (or <= k).
function clip(p, nx, ny, k, keepAbove) {
  const out = [], f = (i) => (p[i] * nx + p[i + 1] * ny - k) * (keepAbove ? 1 : -1);
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length, a = f(i), b = f(j);
    if (a >= 0) out.push(p[i], p[i + 1]);
    if (a >= 0 !== b >= 0) {
      const t = a / (a - b);
      out.push(p[i] + t * (p[j] - p[i]), p[i + 1] + t * (p[j + 1] - p[i + 1]));
    }
  }
  return out;
}
// A stroke from (ax, ay) to (bx, by), h either side, flat ends.
function stroke(ax, ay, bx, by, h) {
  const l = hypot(bx - ax, by - ay), nx = (by - ay) / l, ny = -(bx - ax) / l;
  return [ax + h * nx, ay + h * ny, bx + h * nx, by + h * ny, bx - h * nx, by - h * ny, ax - h * nx, ay - h * ny];
}

const NGLYPH = 3;
// The letters, in the 64 by 64 of one half: B, X, 8. ov is 0 to 1 of the
// overlap, c the flip. Every contour comes back as { p, rev } where rev
// says the Flip knob turns it over.
function glyph(g, ov, c) {
  const L = [];
  const ink = (p) => L.push({ p: turn(p, true), rev: false });
  if (g === 0) {
    // B: a stem and two bowls laid over it, and a counter in each bowl. Each
    // bowl ends at the waist, y = 32, and a tab runs on past it into the other
    // bowl, so the ink is the same whatever the overlap.
    const o = 8 * ov, ow = 4 * ov, up = rrect(18 - o, 4, 49, 32, [0, 12, 12, 0], true), lo = rrect(18 - o, 32, 51, 60, [0, 13, 13, 0], true);
    up.splice(up.length - 2, 2, 37, 32 + ow, 18 - o, 32 + ow);
    lo.splice(0, 2, 18 - o, 32 - ow, 38, 32 - ow);
    ink(rrect(10, 4, 18, 60, 0, true));
    ink(up);
    ink(lo);
    L.push({ p: flip(rrect(22, 11, 41, 28, 4, false), 31.5, 0, 1, 0, c), rev: true });
    L.push({ p: flip(rrect(22, 36, 43, 53, 4, false), 32.5, 0, 1, 0, c), rev: true });
  } else if (g === 1) {
    // X: one stroke whole and the other in two arms that run into it by
    // ov of its half width, so the ink is the same whatever ov is.
    const h = 5.5, a1 = [15, 5], b1 = [49, 59], l1 = hypot(b1[0] - a1[0], b1[1] - a1[1]);
    const nx = (b1[1] - a1[1]) / l1, ny = -(b1[0] - a1[0]) / l1;
    const bar2 = stroke(49, 5, 15, 59, h), k = nx * a1[0] + ny * a1[1], d = h * ov;
    L.push({ p: flip(turn(stroke(a1[0], a1[1], b1[0], b1[1], h), true), 32, 32, nx, ny, c), rev: true });
    ink(clip(bar2, nx, ny, k + h - d, true));
    ink(clip(bar2, nx, ny, k - h + d, false));
  } else {
    // 8: two rings that meet at the waist, y = 32, with a tab each way that
    // runs on into the other ring, and a counter in each.
    const ow = 5 * ov, up = rrect(14, 4, 50, 32, 10, true), lo = rrect(12, 32, 52, 60, 10, true);
    up.splice(36, 0, 40, 32 + ow, 24, 32 + ow);
    lo.splice(12, 0, 24, 32, 24, 32 - ow, 40, 32 - ow, 40, 32);
    ink(up);
    ink(lo);
    L.push({ p: flip(rrect(22, 12, 42, 25, 5, false), 32, 0, 1, 0, c), rev: true });
    L.push({ p: flip(rrect(20, 39, 44, 52, 5, false), 32, 0, 1, 0, c), rev: true });
  }
  return L;
}

// ---- the scan ----
// The winding number of every pixel centre of the 64 by 64, one scanline a
// row: each edge that crosses the line y + 0.5 gives its x and +1 if it runs
// down the panel, -1 if up. Going left to right the sum of the crossings so
// far is minus the winding number.
function windings(S) {
  const cont = S.cont, wind = S.wind, xs = S.xs, ds = S.ds;
  const edges = [];
  for (const { p } of cont)
    for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length;
      if (p[i + 1] !== p[j + 1]) edges.push(p[i], p[i + 1], p[j], p[j + 1]);
    }
  for (let y = 0; y < HW; y++) {
    const Y = y + 0.5;
    let n = 0;
    for (let e = 0; e < edges.length; e += 4) {
      const x0 = edges[e], y0 = edges[e + 1], x1 = edges[e + 2], y1 = edges[e + 3];
      if (y0 <= Y !== y1 <= Y) {
        const x = x0 + ((Y - y0) * (x1 - x0)) / (y1 - y0), d = y1 > y0 ? 1 : -1;
        let q = n++;
        while (q > 0 && xs[q - 1] > x) {
          xs[q] = xs[q - 1];
          ds[q] = ds[q - 1];
          q--;
        }
        xs[q] = x;
        ds[q] = d;
      }
    }
    let j = 0, cum = 0;
    for (let x = 0; x < HW; x++) {
      while (j < n && xs[j] <= x + 0.5) cum += ds[j++];
      wind[y * HW + x] = -cum;
    }
    // Kept for the scanline's ticks: where this row's crossings are.
    S.row[y] = n;
    for (let q = 0; q < n; q++) {
      S.cx[y * 16 + q] = xs[q];
      S.cd[y * 16 + q] = ds[q];
    }
  }
}

// ---- the smallest 3 by 5 face, for the two labels ----
const FACE = { "!": "..#|###|.#.|###|#..", "0": "###|#.#|#.#|#.#|###", E: "###|#..|##.|#..|###", O: ".#.|#.#|#.#|#.#|.#." };
const GLY = {};
for (const ch of Object.keys(FACE)) GLY[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

const FADEIO = 0.3; // seconds a letter takes to come in and to go out

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, flipk: 0, ovk: 0.06,
    g: 0, tm: 0, fl: 0, ys: -1, gain: 0,
    cont: [], wind: new Int8Array(HW * HW),
    xs: new Float64Array(64), ds: new Int8Array(64),
    row: new Uint8Array(HW), cx: new Float32Array(HW * 16), cd: new Int8Array(HW * 16),
    buf: new Float32Array(W * H * 3),
    ov: new Uint8Array(W * H),
    init: true,
  };
}

function pose(S) {
  const ov = pow(S.ovk, 0.2), c = cos(PI * S.flipk);
  S.cont = glyph(S.g, ov, c);
  windings(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  S.flipk = cl(k[2], 0, 1);
  S.ovk = cl(k[3], 0, 1);
  const sweep = 9 / S.speed, rest = 2.4 / S.speed;
  S.tm += d;
  S.fl += d * 9 * S.speed;
  if (S.tm >= FADEIO + sweep + rest) {
    S.tm = 0;
    S.g = (S.g + 1) % NGLYPH;
  }
  // The scanline starts above the glyph and goes down; once past the bottom it waits there while the letter rests.
  const ts = S.tm - FADEIO;
  S.ys = ts < 0 ? -1 : ts >= sweep ? HW : (ts / sweep) * HW;
  S.gain = min(sm(S.tm / FADEIO), 1 - sm((S.tm - (FADEIO + sweep + rest - FADEIO)) / FADEIO));
  pose(S);
}

const GHOST = 0.55; // the rows the scanline has not reached yet
const FILL = 0.8;

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, ovm = S.ov, wind = S.wind;
  buf.fill(0);
  ovm.fill(0);
  const put = (x, y, c, a, mark) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    const r = c[0] * a, g = c[1] * a, b = c[2] * a;
    if (r > buf[o]) buf[o] = r;
    if (g > buf[o + 1]) buf[o + 1] = g;
    if (b > buf[o + 2]) buf[o + 2] = b;
    if (mark) ovm[y * W + x] = 1;
  };

  // The colour of a run by its winding number, for the rows the scanline has
  // passed and for the rows ahead of it, which are made at GHOST of the value
  // so that an orange does not turn to brown on the way down.
  const hb = S.hue, WHITE = [1, 1, 1];
  const mkpal = (v) => {
    const pal = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    tint(0.56 + hb, 0.85, v, pal[0]);
    tint(0.87 + hb, 0.75, v, pal[1]);
    tint(0.87 + hb, 0.25, v, pal[2]);
    tint(0.3 + hb, 0.8, v, pal[3]);
    return pal;
  };
  const PB = mkpal(1), PG = mkpal(GHOST);
  const colour = (pal, w) => (w === 1 ? pal[0] : w === 2 ? pal[1] : w > 2 ? pal[2] : pal[3]);

  // The fill. The upper half is nonzero, the lower even-odd; both read the
  // same winding numbers.
  const ys = S.ys, row = floor(ys);
  for (let y = 0; y < HW; y++) {
    const ahead = y >= ys, a = FILL * (y === row ? 1.25 : 1);
    for (let x = 0; x < HW; x++) {
      const w = wind[y * HW + x];
      if (w === 0) continue;
      const c = colour(ahead && y !== row ? PG : PB, w);
      put(x, y, c, a);
      if (w & 1) put(x, y + HW, c, a);
    }
  }

  // The scanline across both halves, white where nothing is inked, and a tick
  // at every crossing that points the way the contour runs there.
  if (row >= 0 && row < HW) {
    for (let x = 0; x < HW; x++) {
      const w = wind[row * HW + x];
      if (w === 0) {
        put(x, row, WHITE, 0.3, true);
        put(x, row + HW, WHITE, 0.3, true);
      } else {
        ovm[row * W + x] = 1;
        ovm[(row + HW) * W + x] = 1;
        if (!(w & 1)) put(x, row + HW, WHITE, 0.3, true);
      }
    }
    for (let q = 0; q < S.row[row]; q++) {
      const x = floor(S.cx[row * 16 + q]), d = S.cd[row * 16 + q];
      for (let t = 1; t <= 2; t++) {
        put(x, row + d * t, WHITE, 0.95 - 0.25 * t, true);
        put(x, row + HW + d * t, WHITE, 0.95 - 0.25 * t, true);
      }
      put(x, row, WHITE, 1, true);
      put(x, row + HW, WHITE, 1, true);
    }
  }

  // The outlines, one LED inside the ink along every contour (the ink is on
  // the right of the way a contour runs), and a marker that flows along each.
  for (const { p } of S.cont) {
    const n = p.length / 2, len = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      len[i + 1] = len[i] + hypot(p[j * 2] - p[i * 2], p[j * 2 + 1] - p[i * 2 + 1]);
    }
    const P = len[n];
    if (P < 1) continue;
    const at = (s, out) => {
      s = ((s % P) + P) % P;
      let i = 0;
      while (i < n - 1 && len[i + 1] <= s) i++;
      const j = (i + 1) % n, e = len[i + 1] - len[i] || 1, t = (s - len[i]) / e;
      const dx = p[j * 2] - p[i * 2], dy = p[j * 2 + 1] - p[i * 2 + 1], l = hypot(dx, dy) || 1;
      out[0] = p[i * 2] + dx * t - (dy / l) * 0.5;
      out[1] = p[i * 2 + 1] + dy * t + (dx / l) * 0.5;
    };
    const q = [0, 0];
    for (let s = 0; s < P; s += 0.5) {
      at(s, q);
      put(floor(q[0]), floor(q[1]), WHITE, 0.32, true);
      put(floor(q[0]), floor(q[1]) + HW, WHITE, 0.32, true);
    }
    const m = max(1, round(P / 28));
    for (let i = 0; i < m; i++)
      for (let t = 0; t < 9; t++) {
        at((i * P) / m + S.fl - t * 0.9, q);
        const a = t === 0 ? 1 : 0.9 - 0.1 * t;
        put(floor(q[0]), floor(q[1]), WHITE, a, true);
        put(floor(q[0]), floor(q[1]) + HW, WHITE, a, true);
      }
  }

  // The two halves are named, 3 by 5 at the left: not-equal-zero and EO.
  const word = (str, x0, y0) => {
    for (let i = 0; i < str.length; i++) {
      const gl = GLY[str[i]];
      for (let k = 0; k < 15; k++) if (gl[k]) put(x0 + i * 4 + (k % 3), y0 + floor(k / 3), WHITE, 0.55, true);
    }
  };
  word("!0", 1, 1);
  word("EO", 1, HW + 1);
  // A dotted line where the halves meet.
  for (let x = 0; x < W; x += 2) put(x, HW - 1, WHITE, 0.22, true);

  const g = S.gain;
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255 * g), min(255, buf[p * 3 + 1] * 255 * g), min(255, buf[p * 3 + 2] * 255 * g));
}
