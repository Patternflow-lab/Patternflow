// ===== Patternflow pattern =====
// Title:   Banshee
// Family:  halloween
// Idea:    A pale, see-through woman drifts in the night wind above a cottage with one lit window, her long hair and tattered robe streaming and whipping, and every 7 seconds she throws back her head and wails: rings of toxic green sound burst from her mouth and bend the night as they pass, the sky flashes green, the window panes rattle in their frame and the candle flame lies flat, the crows on the ridge scatter and the ground fog is blown back.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 52
// Round:   52
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wind=0..1, Fury=0..1
//
// Knob 1: Hue. The colour of her light, of the rings and of the flash; the sky and the cottage with its window stay as they are. At 0 she is green-white and wails toxic green, at 0.25 blue-white with blue rings, at 0.5 lilac with magenta and at 0.75 peach with orange-red.
// Knob 2: Speed. At 2 she wails every 7 s, the first time at 1.2 s: her head goes back over 0.5 s and the wail lasts 1.8 s, a ring leaving her mouth every 0.2 s; 0.7 s later she is quiet again. The rings travel 60 LEDs a second and reach the window about 1.2 s after they leave her; the crows are back on the ridge 4.5 to 5.5 s after they flew. At 0.2 everything, her drift and the flutter of her hair too, is ten times slower, at 3 half as fast again.
// Knob 3: Wind. A wind from the left. At 0 a breeze of 4 LEDs a second, and her own drifting is what lifts her hair and hem; at 1 it blows 44 LEDs a second with gusts and her hair and robe stream out flat to the right. She hangs 8 LEDs further left against it, and the fog runs past four times as fast.
// Knob 4: Fury. How hard she wails. At 0.06 the rings are thin and the sky glows faintly green round her; at 1 the rings are nearly twice as bright and more than twice as wide, they bend the scene further, and the flash floods the whole sky. The crows fly off faster and the flame lies flatter; the fog is blown back harder too.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, sd) => {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash(i * 7919 + sd) * (1 - u) + hash((i + 1) * 7919 + sd) * u) * 2 - 1;
};
function hsv(h, s, v, out) {
  for (let i = 0; i < 3; i++) {
    const k = (5 - 2 * i + 6 * (h - floor(h))) % 6;
    out[i] = v - v * s * max(0, min(k, 4 - k, 1));
  }
  return out;
}
// Channels in steps of 4 of 255.
const q4 = (v) => (v <= 0 ? 0 : v >= 1 ? 252 : round(v * 63) * 4);

// The roof's ridge and eaves, the ground, and where the fog starts.
const RIDGE = 70, EAVE = 86, GROUND = 119, FOG = 98;
// The window: its left edge, top and pane size; the candle's wick sits in
// the lower left pane.
const WX = 30, WY = 93, PS = 7, FX = 34.5, FY = 106;
// Hair: strands, nodes and segment length in LEDs. Robe and sleeve tatters
// the same.
const NH = 16, HN = 20, HL = 2.3, NR = 9, RN = 14, RL = 3.1, NT = 3, TN = 7, TL = 2.4;
// The wail at Speed 2, in seconds: one every WP, the first at W0; the head
// goes back over WA, she wails until WB and is quiet again by WC.
const WP = 7, W0 = 1.2, WA = 0.5, WB = 2.3, WC = 3.0;
// Sound rings: speed in LEDs a second and the gap between them.
const RV = 60, RI = 0.2;
// The crows' perches along the ridge.
const PERCH = [24, 32, 41, 49];

// Every chain in one set of arrays: hair first, then robe, then tatters.
const CH = [];
{
  let o = 0;
  for (let i = 0; i < NH; i++) CH.push({ o, n: HN, L: HL * (0.85 + 0.3 * hash(i + 5)), g: 12, k: 0.07 + 0.1 * hash(i + 21), kind: 0, f: 0.7 + 0.6 * hash(i + 33) }), (o += HN);
  for (let i = 0; i < NR; i++) CH.push({ o, n: RN - (hash(i + 40) * 4) | 0, L: RL, g: 40, k: 0.04, kind: 1, f: 1 }), (o += RN);
  for (let i = 0; i < 2 * NT; i++) CH.push({ o, n: TN, L: TL * (0.8 + 0.4 * hash(i + 80)), g: 14, k: 0.1, kind: 2, f: 1 }), (o += TN);
}
const NN = NH * HN + NR * RN + 2 * NT * TN;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, wind: 0, fury: 0.06, gust: 0,
    hx: 32, hy: 30, tilt: 0, mouth: 0, arms: 0, blast: 0, flash: 0,
    X: new Float32Array(NN), Y: new Float32Array(NN), PX: new Float32Array(NN), PY: new Float32Array(NN),
    rx: new Float32Array(NN), ry: new Float32Array(NN), init: false,
    rings: [], wailN: -1, ringT: 0,
    rattle: 0, bend: 0, gutter: 0, fogX: 32, fogR: 0, fogP: 0,
    crows: PERCH.map((x, i) => ({ hx: x, hy: RIDGE, x, y: RIDGE, vx: 0, vy: 0, st: 0, t: 0, ph: i * 1.7, face: i & 1 ? 1 : -1 })),
    bg: new Float32Array(N * 3), sky: new Float32Array(N), buf: new Float32Array(N * 3),
    ga: new Float32Array(N), gh: new Float32Array(N), ri: new Float32Array(N), rs: new Float64Array(400),
    gc: [0, 0, 0], wc: [0, 0, 0],
  };
  scene(params.s);
}

// The still picture: sky, far hills, the cottage and the ground.
function scene(S) {
  const { bg, sky } = S;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let r, g, b, s = 0;
      // The roof: a hipped thatch from the left end to past the right edge.
      const roofL = 14 + ((EAVE - y) / (EAVE - RIDGE)) * 8;
      const hill = 84 + 3 * sin(x * 0.09 + 1) + 2 * sin(x * 0.23);
      if (y >= RIDGE && y < EAVE && x >= roofL) {
        const n = hash(x * 3 + y * 131) * 0.5 + 0.5 * (0.5 + 0.5 * sin(x * 1.3 + y * 0.6));
        r = 22 + 10 * n;
        g = 14 + 6 * n;
        b = 26 + 8 * n;
        if (y === RIDGE) (r += 14), (g += 10), (b += 18);
      } else if (y >= 60 && y < RIDGE && x >= 53 && x <= 58) {
        // The chimney.
        const n = hash(x + y * 17);
        r = 24 + 8 * n;
        g = 16 + 5 * n;
        b = 26 + 6 * n;
      } else if (y >= EAVE && y < GROUND && x >= 16) {
        // Stone wall: courses of rough stones with dark mortar.
        const row = floor((y - EAVE) / 4), off = row & 1 ? 3 : 0, col = floor((x + off) / 6);
        const mort = (y - EAVE) % 4 === 3 || (x + off) % 6 === 5;
        const n = hash(row * 97 + col * 13);
        r = mort ? 8 : 26 + 14 * n;
        g = mort ? 6 : 20 + 10 * n;
        b = mort ? 12 : 30 + 12 * n;
        if (x === 16) (r *= 0.6), (g *= 0.6), (b *= 0.6);
      } else if (y >= GROUND || (y >= hill && (x < 16 || y >= EAVE))) {
        // Moor: dark peat with tufts.
        const n = hash(x * 7 + y * 61);
        const d = y >= GROUND ? 1 : 0.7;
        r = (10 + 8 * n) * d;
        g = (12 + 9 * n) * d;
        b = (16 + 6 * n) * d;
      } else {
        // Sky, near black overhead and violet towards the horizon, with stars.
        const u = y / 84;
        s = 1;
        r = 4 + 54 * u * u;
        g = 2 + 26 * u * u;
        b = 12 + 80 * u * u;
        if (y < 56 && hash(p * 3 + 1) > 0.985) {
          const v = 50 + 70 * hash(p);
          (r += v), (g += v), (b += v * 1.1);
        }
      }
      bg[p * 3] = r / 255;
      bg[p * 3 + 1] = g / 255;
      bg[p * 3 + 2] = b / 255;
      sky[p] = s;
    }
  // The window's frame, dark wood round the four panes.
  for (let y = WY - 1; y <= WY + 2 * PS + 1; y++)
    for (let x = WX - 1; x <= WX + 2 * PS + 1; x++) {
      const p = (y * W + x) * 3;
      bg[p] = 0.07;
      bg[p + 1] = 0.04;
      bg[p + 2] = 0.05;
    }
}

// Where each chain hangs from this step, from the head and the arms.
function roots(S) {
  const { hx, hy, tilt, arms, rx, ry } = S;
  for (let c = 0; c < CH.length; c++) {
    const ch = CH[c];
    let x, y;
    if (ch.kind === 0) {
      // Hair across the crown, from one temple over to the other.
      const a = PI * (1.06 + (0.88 * c) / (NH - 1));
      x = hx + 4.3 * cos(a);
      y = hy - 0.6 - tilt + 5 * sin(a);
    } else if (ch.kind === 1) {
      // The robe across the shoulders.
      const u = ((c - NH) / (NR - 1)) * 2 - 1;
      x = hx + u * 5.6;
      y = hy + 6.4 + 1.4 * u * u;
    } else {
      // Tatters along the forearms.
      const j = c - NH - NR, side = j < NT ? -1 : 1, f = ((j % NT) + 1) / NT;
      const [ex, ey, wx, wy] = arm(S, side);
      x = ex + (wx - ex) * f;
      y = ey + (wy - ey) * f;
    }
    rx[c] = x;
    ry[c] = y;
  }
}

// An arm's elbow and wrist: hanging a little out at rest, flung up and out
// when she wails.
const ARM = [0, 0, 0, 0];
function arm(S, side) {
  const a = 0.32 + 0.1 * sin(S.t * 1.3 + side) + 2.1 * S.arms, b = a + 0.45 - 0.75 * S.arms;
  const sx = S.hx + side * 5, sy = S.hy + 7.5;
  ARM[0] = sx + side * 8 * sin(a);
  ARM[1] = sy + 8 * cos(a);
  ARM[2] = ARM[0] + side * 7 * sin(b);
  ARM[3] = ARM[1] + 7 * cos(b);
  return ARM;
}

// One step of h for every chain: each node keeps its motion, is pulled
// towards the wind's speed and by its own gravity, and the blast of the wail
// pushes it away from her head; then each segment is set back to its length,
// root first.
function chains(S, h) {
  const { X, Y, PX, PY, rx, ry, t, hx, hy } = S;
  const wx0 = 4 + 40 * S.wind + S.gust, amp = 7 + 18 * S.wind, bl = S.blast * 45;
  for (let c = 0; c < CH.length; c++) {
    const { o, n, L, g, k, f: fq } = CH[c];
    X[o] = PX[o] = rx[c];
    Y[o] = PY[o] = ry[c];
    for (let i = 1; i < n; i++) {
      const j = o + i, f = i / n, vx = X[j] - PX[j], vy = Y[j] - PY[j];
      let wx = wx0 + amp * f * sin(t * 2.9 * fq + i * 0.42 + c * 1.37), wy = amp * 0.8 * f * cos(t * 2.3 * fq + i * 0.5 + c * 0.9);
      if (bl > 0) {
        const dx = X[j] - hx, dy = Y[j] - hy, d = sqrt(dx * dx + dy * dy) + 2;
        wx += bl * (0.5 + (0.6 * dx) / d);
        wy += (bl * 0.3 * dy) / d;
      }
      PX[j] = X[j];
      PY[j] = Y[j];
      X[j] += vx * 0.98 + k * (wx * h - vx);
      Y[j] += vy * 0.98 + k * (wy * h - vy) + g * h * h;
    }
    for (let i = 1; i < n; i++) {
      const j = o + i, dx = X[j] - X[j - 1], dy = Y[j] - Y[j - 1], d = sqrt(dx * dx + dy * dy) || 1;
      X[j] = X[j - 1] + (dx * L) / d;
      Y[j] = Y[j - 1] + (dy * L) / d;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.wind = cl(k[2], 0, 1);
  S.fury = cl(k[3], 0, 1);
  const ds = (d * S.speed) / 2, F = 0.55 + 0.45 * S.fury;
  S.t += ds;
  const t = S.t;
  // Where she is in her wail.
  const nw = floor((t - W0) / WP), w = t >= W0 ? t - W0 - nw * WP : -1;
  const up = w < 0 ? 0 : w < WA ? sm(w / WA) : w < WB ? 1 : w < WC ? 1 - sm((w - WB) / (WC - WB)) : 0;
  S.tilt = up;
  S.arms = up;
  S.mouth = w < 0 ? 0.1 : w < WA ? 0.1 + 0.9 * sm((w - 0.15) / (WA - 0.15)) : w < WB ? 1 : w < WC ? 1 - 0.9 * sm((w - WB) / 0.4) : 0.1;
  S.blast = w >= WA && w < WB ? F * (0.6 + 0.4 * sm((w - WA) / 0.3)) : 0;
  // She drifts and bobs. When she wails she rises.
  S.hx = 27 - 8 * S.wind + 10 * sin(0.23 * t + 0.4) + 4 * sin(0.57 * t);
  S.hy = 30 + 4 * sin(0.31 * t) + 1.5 * sin(1.3 * t) - 4 * up;
  S.gust = vn(t * 0.7, 3) * (4 + 16 * S.wind);
  // A new wail: rings start leaving her mouth.
  if (w >= WA && w < WB) {
    if (S.wailN !== nw) (S.wailN = nw), (S.ringT = 0), (S.fogX = S.hx), (S.fogR = 0);
    S.ringT -= ds;
    if (S.ringT <= 0) {
      S.ringT += RI;
      S.rings.push({ x: S.hx, y: S.hy + 2.5 - S.tilt, t0: t, a: F });
    }
  }
  S.flash = max(S.flash * exp(-6 * ds), (S.blast > 0) * (0.45 + 1.2 * S.fury) * (S.ringT > RI * 0.5 ? 1 : 0.7));
  S.rattle *= exp(-3 * ds);
  S.fogP = max(0, S.fogP - 0.22 * ds);
  const mx = S.hx, my = S.hy + 2.5;
  for (let i = S.rings.length - 1; i >= 0; i--) {
    const R = S.rings[i], r = (t - R.t0) * RV, r0 = r - ds * RV;
    if (r > 140) {
      S.rings.splice(i, 1);
      continue;
    }
    // What the ring front crossed this step.
    const dw = sqrt((R.x - 38.5) ** 2 + (R.y - 101) ** 2);
    if (r0 < dw && r >= dw) S.rattle = max(S.rattle, R.a);
    const fy = FOG + 8 - R.y;
    if (r > fy) S.fogR = max(S.fogR, sqrt(r * r - fy * fy)), (S.fogP = max(S.fogP, R.a));
    for (const c of S.crows) {
      const dc = sqrt((R.x - c.x) ** 2 + (R.y - c.y) ** 2);
      if (c.st === 0 && r0 < dc && r >= dc) {
        c.st = 1;
        c.t = 0;
        c.vx = (c.x < R.x ? -1 : 1) * (16 + 14 * hash(c.hx + nw * 7)) * (0.6 + 0.6 * R.a);
        c.vy = -(24 + 12 * hash(c.hx * 3 + nw));
      }
    }
  }
  // The candle flame lies over, away from her, while the wail lasts.
  const flat = w >= WA && w < WB + 0.3 && S.rattle > 0.05 ? 1 : 0;
  const lean = (FX > mx ? 1 : -1) * 1.45 * F;
  S.bend += ((flat ? lean : 0.12 * vn(t * 3, 9)) - S.bend) * min(1, 9 * ds);
  S.gutter += ((flat ? 0.55 * F : 0) - S.gutter) * min(1, 5 * ds);
  // Crows: off the ridge, away and back.
  for (const c of S.crows) {
    c.ph += ds * (c.st ? 40 : 1.3);
    c.t += ds;
    if (c.st === 1) {
      c.vy += 8 * ds;
      c.vx *= 1 - 0.3 * ds;
      if (c.t > 2.2) c.st = 2;
    } else if (c.st === 2) {
      const dx = c.hx - c.x, dy = c.hy - c.y, dd = sqrt(dx * dx + dy * dy) || 1;
      const sp = min(28, 3 + dd * 2);
      c.vx += ((dx / dd) * sp - c.vx) * min(1, 2.5 * ds);
      c.vy += ((dy / dd) * sp - c.vy) * min(1, 2.5 * ds);
      if (dd < 1.2) (c.st = 0), (c.x = c.hx), (c.y = c.hy), (c.vx = c.vy = 0), (c.face = c.hx < mx ? 1 : -1);
    }
    if (c.st) (c.x += c.vx * ds), (c.y += c.vy * ds), (c.face = c.vx < 0 ? -1 : 1);
  }
  // Hair and cloth, two steps a frame; the first frame lets them stream out.
  if (!S.init) {
    S.init = true;
    roots(S);
    for (let c = 0; c < CH.length; c++)
      for (let i = 0; i < CH[c].n; i++) {
        const j = CH[c].o + i;
        S.X[j] = S.PX[j] = S.rx[c] + i * CH[c].L * 0.6;
        S.Y[j] = S.PY[j] = S.ry[c] + i * CH[c].L * 0.8;
      }
    for (let i = 0; i < 90; i++) chains(S, 1 / 60);
  }
  roots(S);
  chains(S, ds / 2);
  chains(S, ds / 2);
}

// Ghost light: an anti-aliased dot added into a buffer, a segment of them,
// and filled shapes kept at the higher of what is there and a.
function dot(g, x, y, a) {
  x -= 0.5;
  y -= 0.5;
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const X = ix + i, Y = iy + j;
      if (X >= 0 && X < W && Y >= 0 && Y < H) g[Y * W + X] += a * (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
    }
}
function seg(g, x0, y0, x1, y1, a0, a1) {
  const n = max(1, Math.ceil(sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) * 1.6));
  for (let i = 0; i < n; i++) {
    const f = i / n;
    dot(g, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, (a0 + (a1 - a0) * f) * 0.62);
  }
}
function tri(g, ax, ay, bx, by, cx, cy, a) {
  const x0 = max(0, floor(min(ax, bx, cx))), x1 = min(W - 1, floor(max(ax, bx, cx))), y0 = max(0, floor(min(ay, by, cy))), y1 = min(H - 1, floor(max(ay, by, cy)));
  const ar = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (abs(ar) < 1e-6) return;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const u = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / ar, v = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / ar;
      if (u >= 0 && v >= 0 && u + v <= 1) {
        const p = y * W + x;
        if (g[p] < a) g[p] = a;
      }
    }
}
function ell(g, cx, cy, rx, ry, a) {
  for (let y = max(0, floor(cy - ry)); y <= min(H - 1, floor(cy + ry)); y++)
    for (let x = max(0, floor(cx - rx)); x <= min(W - 1, floor(cx + rx)); x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, q = u * u + v * v;
      if (q < 1) {
        const p = y * W + x, b = a * min(1, (1 - q) * 3);
        if (g[p] < b) g[p] = b;
      }
    }
}

// Crow on a perch, facing left; flipped when it faces right.
const PERCHED = [".##....", "####...", ".#####.", "..#####", "...#.#."];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { bg, sky, buf, ga, gh, X, Y, gc, wc, t } = S;
  const hue = 0.33 + S.hue;
  hsv(hue, 0.85, 1, wc);
  hsv(hue, 0.2, 1, gc);
  const mx = S.hx, my = S.hy + 2.6 - 1.1 * S.tilt;
  // Rings now: centre, radius and strength.
  const rs = S.rs, ri = S.ri;
  let nr = 0;
  for (const R of S.rings) {
    const r = (t - R.t0) * RV;
    rs[nr * 4] = R.x;
    rs[nr * 4 + 1] = R.y;
    rs[nr * 4 + 2] = r;
    rs[nr++ * 4 + 3] = R.a * (1 - r / 140);
  }
  ri.fill(0);
  // The night, bent where a ring passes, and lit by the flash.
  const fr = 40 + 40 * S.fury, rw = 0.9 + 1.4 * S.fury;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      let sx = x, sy = y;
      for (let k = 0; k < nr * 4; k += 4) {
        const dx = x + 0.5 - rs[k], dy = y + 0.5 - rs[k + 1], d = sqrt(dx * dx + dy * dy) + 1e-3, e = d - rs[k + 2], a = rs[k + 3];
        if (e > -4 && e < 4) {
          const o = 2.4 * a * (1 - abs(e) / 4) * (e < 0 ? 1 : -0.5);
          sx += (dx / d) * o;
          sy += (dy / d) * o;
          if (e > -rw && e < rw) ri[p] += a * 0.75 * (1 - abs(e) / rw);
        }
      }
      const q = (cl(round(sy), 0, H - 1) * W + cl(round(sx), 0, W - 1)) * 3;
      const dm = sqrt((x - mx) ** 2 + (y - my) ** 2), fl = S.flash * (0.25 + 0.5 * sky[p]) * exp(-dm / fr);
      buf[p * 3] = bg[q] + wc[0] * fl * 0.5;
      buf[p * 3 + 1] = bg[q + 1] + wc[1] * fl * 0.5;
      buf[p * 3 + 2] = bg[q + 2] + wc[2] * fl * 0.5;
    }
  win(S);
  fog(S);
  crows(S);
  // The banshee.
  ga.fill(0);
  gh.fill(0);
  for (let c = NH; c < NH + NR - 1; c++) {
    const A = CH[c], B = CH[c + 1], n = min(A.n, B.n);
    for (let i = 0; i < n - 1; i++) {
      const a = 0.45 - (0.25 * i) / n, p = A.o + i, q = B.o + i;
      tri(ga, X[p], Y[p], X[p + 1], Y[p + 1], X[q + 1], Y[q + 1], a);
      tri(ga, X[p], Y[p], X[q + 1], Y[q + 1], X[q], Y[q], a);
    }
  }
  for (let c = NH; c < CH.length; c++) {
    const { o, n, kind } = CH[c];
    for (let i = 0; i < n - 1; i++) seg(gh, X[o + i], Y[o + i], X[o + i + 1], Y[o + i + 1], kind === 1 ? 0.25 : 0.5, kind === 1 ? 0.2 : 0.2);
  }
  for (const side of [-1, 1]) {
    const [ex, ey, wx, wy] = arm(S, side), sx = S.hx + side * 5, sy = S.hy + 7.5;
    seg(gh, sx, sy, ex, ey, 0.9, 0.8);
    seg(gh, ex, ey, wx, wy, 0.8, 0.7);
    ell(ga, wx, wy, 1.1, 1.1, 0.9);
  }
  seg(gh, S.hx, S.hy + 3, S.hx, S.hy + 7, 0.9, 0.9);
  ell(ga, S.hx, S.hy, 3.7, 4.7 * (1 - 0.12 * S.tilt), 0.95);
  for (let c = 0; c < NH; c++) {
    const { o, n } = CH[c];
    for (let i = 0; i < n - 1; i++) seg(gh, X[o + i], Y[o + i], X[o + i + 1], Y[o + i + 1], 0.55 - (0.4 * i) / n, 0.55 - (0.4 * (i + 1)) / n);
  }
  for (let p = 0; p < N; p++) {
    const a = min(1, ga[p] + gh[p]);
    if (a <= 0) continue;
    const k = 1 - 0.72 * a;
    buf[p * 3] = buf[p * 3] * k + gc[0] * a * 0.92;
    buf[p * 3 + 1] = buf[p * 3 + 1] * k + gc[1] * a * 0.92;
    buf[p * 3 + 2] = buf[p * 3 + 2] * k + gc[2] * a * 0.92;
  }
  face(S, mx, my);
  // The rings themselves, added on top.
  for (let p = 0; p < N; p++) {
    const v = ri[p];
    if (v > 0) (buf[p * 3] += wc[0] * v), (buf[p * 3 + 1] += wc[1] * v), (buf[p * 3 + 2] += wc[2] * v);
  }
  for (let p = 0; p < N; p++) display.setPixel(p % W, floor(p / W), q4(buf[3 * p]), q4(buf[3 * p + 1]), q4(buf[3 * p + 2]));
}

// Eyes and the mouth: dark hollows with a glint, and a mouth that opens to a
// long dark O glowing inside while she wails.
function face(S, mx, my) {
  const { buf, wc } = S;
  const set = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = (y * W + x) * 3;
    buf[p] = r;
    buf[p + 1] = g;
    buf[p + 2] = b;
  };
  const ey = floor(S.hy - 0.6 - 1.2 * S.tilt), gl = 0.3 + 0.7 * S.blast;
  for (const side of [-1, 1]) {
    const ex = floor(S.hx + side * 1.6);
    set(ex, ey, wc[0] * gl, wc[1] * gl, wc[2] * gl);
    set(ex, ey + 1, 0.04, 0.03, 0.08);
  }
  const rx = 0.5 + 1.1 * S.mouth, ry = 0.5 + 2.3 * S.mouth;
  for (let y = floor(my - ry); y <= floor(my + ry); y++)
    for (let x = floor(mx - rx); x <= floor(mx + rx); x++) {
      const u = (x + 0.5 - mx) / rx, v = (y + 0.5 - my) / ry, q = u * u + v * v;
      if (q < 1) {
        const g = S.blast * (1 - q) * 0.9;
        set(x, y, 0.03 + wc[0] * g, 0.02 + wc[1] * g, 0.06 + wc[2] * g);
      }
    }
}

// The window: four panes lit warm by a candle on the sill, shaken loose in
// their frame by a passing ring, the flame bending over.
function win(S) {
  const { buf, t } = S;
  const fb = 1 - S.gutter, fl = 0.92 + 0.08 * vn(t * 9, 4);
  const len = (4.2 + 0.6 * vn(t * 7, 2)) * (1 - 0.35 * S.gutter);
  for (let pj = 0; pj < 2; pj++)
    for (let pi = 0; pi < 2; pi++) {
      const id = pj * 2 + pi, r = S.rattle;
      const ox = r > 0.06 ? round(r * 1.4 * sin(t * 53 + id * 2.1)) : 0, oy = r > 0.06 ? round(r * 1.1 * cos(t * 47 + id * 1.3)) : 0;
      const x0 = WX + pi * (PS + 1), y0 = WY + pj * (PS + 1);
      for (let y = y0; y < y0 + PS; y++)
        for (let x = x0; x < x0 + PS; x++) {
          const p = (y * W + x) * 3, lx = x - ox, ly = y - oy;
          if (lx < x0 || lx >= x0 + PS || ly < y0 || ly >= y0 + PS) {
            buf[p] = 0.05;
            buf[p + 1] = 0.03;
            buf[p + 2] = 0.04;
            continue;
          }
          const d = sqrt((lx + 0.5 - FX) ** 2 + (ly + 0.5 - FY + 2) ** 2), gw = exp(-d / 5) * fb * fl;
          let R = 0.42 + 0.58 * gw, G = 0.2 + 0.52 * gw, B = 0.06 + 0.22 * gw;
          // The candle, cream wax on the sill.
          if (lx >= 34 && lx <= 35 && ly > FY && ly <= FY + 4) (R = 0.85), (G = 0.75), (B = 0.55);
          buf[p] = R * fl;
          buf[p + 1] = G * fl;
          buf[p + 2] = B * fl;
        }
    }
  // The flame: a tongue from the wick, bent by S.bend.
  const r = S.rattle, ox = r > 0.06 ? round(r * 1.4 * sin(t * 53 + 4.2)) : 0, oy = r > 0.06 ? round(r * 1.1 * cos(t * 47 + 1.3)) : 0;
  for (let i = 0; i <= 8; i++) {
    const f = i / 8, a = S.bend * f, px = FX + ox + sin(a) * len * f, py = FY + oy - cos(a) * len * f, wd = 1.3 * (1 - f) + 0.3;
    for (let y = floor(py - wd); y <= floor(py + wd); y++)
      for (let x = floor(px - wd); x <= floor(px + wd); x++) {
        if (x < WX + 0 || x >= WX + PS || y < WY + PS + 1 || y >= WY + 2 * PS + 1) continue;
        if ((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 > wd * wd) continue;
        const p = (y * W + x) * 3;
        buf[p] = 1 * fb + 0.4 * (1 - fb);
        buf[p + 1] = (0.95 - 0.45 * f) * fb + 0.2 * (1 - fb);
        buf[p + 2] = (0.7 - 0.6 * f) * fb + 0.05;
      }
  }
}

// Ground fog drifting with the wind, blown out in a ring under her by the
// wail and creeping back.
function fog(S) {
  const { buf, t } = S;
  const sp = 3 + 9 * S.wind;
  for (let y = FOG; y < H; y++) {
    const pr = sm((y - FOG) / 16);
    for (let x = 0; x < W; x++) {
      let d = pr * (0.62 + 0.24 * vn(x * 0.11 - t * sp * 0.1 + y * 0.37, 11) + 0.18 * vn(x * 0.23 - t * sp * 0.07 - y * 0.21, 12));
      if (S.fogP > 0) {
        const dd = abs(x + 0.5 - S.fogX), e = (dd - S.fogR) / 3;
        d *= dd < S.fogR ? 1 - S.fogP * 0.92 * sm((S.fogR - dd) / 5) : 1;
        d += pr * S.fogP * 0.6 * exp(-e * e);
      }
      const a = cl(d * 0.62, 0, 0.85), p = (y * W + x) * 3;
      buf[p] = buf[p] * (1 - a) + 0.5 * a;
      buf[p + 1] = buf[p + 1] * (1 - a) + 0.45 * a;
      buf[p + 2] = buf[p + 2] * (1 - a) + 0.62 * a;
    }
  }
}

function crows(S) {
  const { buf } = S;
  const set = (x, y) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = (y * W + x) * 3;
    buf[p] = 0.02;
    buf[p + 1] = 0.01;
    buf[p + 2] = 0.03;
  };
  for (const c of S.crows) {
    const x = round(c.x), y = round(c.y);
    if (c.st === 0) {
      for (let j = 0; j < 5; j++)
        for (let i = 0; i < 7; i++) if (PERCHED[j][c.face < 0 ? i : 6 - i] === "#") set(x - 3 + i, y - 5 + j);
    } else {
      // In flight: a body, a head and two wings beating.
      const f = sin(c.ph), tip = -3.2 * f, mid = -1.4 * f;
      for (let i = -1; i <= 1; i++) set(x + i, y);
      set(x + 2 * c.face, y - 1);
      set(x + c.face, y - 1);
      set(x - 2 * c.face, y + 1);
      for (const s of [-1, 1]) {
        set(x + s * 2, round(y + mid * 0.6));
        set(x + s * 3, round(y + mid));
        set(x + s * 4, round(y + (mid + tip) * 0.5));
        set(x + s * 5, round(y + tip));
      }
    }
  }
}
