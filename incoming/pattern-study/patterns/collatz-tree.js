// ===== Patternflow pattern =====
// Title:   Collatz Tree
// Family:  number
// Idea:    The numbers that fall to 1 under the 3n+1 map grow backwards from 1 as a plant, every n hanging from the number it falls to by a segment that turns the heading one way when that is n/2 and the other way when it is 3n+1, layer by layer to the 34th step with the newest layer white-hot, until the hailstones of 7, 27, 15, 39 and 871 each run down their branch to the root with their values popping up in the corner.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the 3n+1 map and its conjecture (Lothar Collatz, 1937), the tree of its inverse and the curling picture of it with one turn for each even step and the opposite turn for each odd one (Edmund Harriss, 2010s), pattern round 106
// Round:   106
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0.4..4, Even=2..14, Odd=20..42
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the trunk is gold, the first layers cyan, the middle ones blue and the crown violet to magenta; at 0.35 the trunk is cyan, the branches magenta and the crown orange; at 0.5 blue, red and green; at 0.85 red, green and blue. The faint layers hurry through orange and yellow, so the crown does not turn brown.
// Knob 2: Growth. How fast the tree grows, in layers a second. At 2 it grows from the 8th layer to the 34th in 13 s, the hailstones of 7, 27, 15, 39 and 871 then run one after another for 21.7 s (the head runs 5 nodes a second for each unit of Growth, 10 at 2), and the tree folds back to the 8th layer at one and a half times the growth speed, 8.7 s, and starts again: 43 s a round. At 0.4 a round takes 184 s and at 4 it takes 26 s.
// Knob 3: Even. How far the heading turns to the right at each even step, from n to 2n, between 2 and 14 degrees. The trunk is the powers of two, even steps all the way, so by the top it has turned 34 times that: 68 degrees at 2, a gentle lean; at 14 it has gone 476 degrees round, a hook that curls over and takes the branches inside.
// Knob 4: Odd. How far the heading turns to the left at each odd step, from n to (n - 1) / 3, between 20 and 42 degrees. Every branch leaves the trunk by one. At 20 they leave in a tall fan; at 42 each odd step swings the heading so far that the branches roll up into spirals.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, min, max, abs, sin, cos, sqrt, exp, log2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const DEG = PI / 180;

// The tree is built to D steps back from 1. Its values are doubles: the
// largest at depth d is 2^d, which stays far inside 2^53 at 34.
const D = 34;
// Each layer's segments are RATIO times the one before, so the first layers
// are long strokes and the thousands in the last ones are fine twigs.
const RATIO = 0.93;
const G0 = 8;
// The hailstones the corner runs through, in this order.
const NUMS = [7, 27, 15, 39, 871];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Every n has the predecessor 2n. It has a second one, (n - 1) / 3, when n is
// 4 mod 6 (then n - 1 is an odd multiple of 3) and that is not 1, where the
// 1, 4, 2 loop closes. Nodes are stored a layer at a time and a node's
// children sit next to each other, so the arrays are in breadth order.
function buildTree() {
  const val = [1], par = [-1], dep = [0], odd = [0], LS = [0], fc = [-1];
  let lo = 0, hi = 1;
  for (let d = 1; d <= D; d++) {
    const start = val.length;
    LS.push(start);
    for (let i = lo; i < hi; i++) {
      const n = val[i];
      fc[i] = val.length;
      val.push(2 * n); par.push(i); dep.push(d); odd.push(0); fc.push(-1);
      if (n % 6 === 4 && (n - 1) / 3 > 1) {
        val.push((n - 1) / 3); par.push(i); dep.push(d); odd.push(1); fc.push(-1);
      }
    }
    lo = start;
    hi = val.length;
  }
  LS.push(val.length);
  return { n: val.length, val: Float64Array.from(val), par: Int32Array.from(par), dep: Uint8Array.from(dep), odd: Uint8Array.from(odd), LS, fc: Int32Array.from(fc) };
}

// A number's flight: its values down to 1, and the tree nodes they sit on,
// root first. A number that takes more than D steps enters the tree at depth
// D, where its flight is at the value o[steps - D].
function flight(T, n) {
  const o = [n];
  for (let x = n; x !== 1;) {
    x = x % 2 ? 3 * x + 1 : x / 2;
    o.push(x);
  }
  const steps = o.length - 1, m = min(steps, D), path = [0], vals = [1];
  for (let k = 1; k <= m; k++) {
    const want = o[steps - k], c = T.fc[path[k - 1]];
    path.push(T.val[c] === want ? c : c + 1);
    vals.push(want);
  }
  return { n, steps, m, path, vals };
}

// 3 x 5 digits.
const DIGITS = [
  "### #.# #.# #.# ###", ".#. ##. .#. .#. ###", "### ..# ### #.. ###", "### ..# ### ..# ###", "#.# #.# ### ..# ..#",
  "### #.. ### ..# ###", "### #.. ### #.# ###", "### ..# ..# .#. .#.", "### #.# ### #.# ###", "### #.# ### ..# ###",
].map((s) => {
  const rows = s.split(" "), m = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (rows[y][x] === "#") m.push(x, y);
  return m;
});

export function setup(params) {
  const T = buildTree();
  const N = T.n, LEN = new Float32Array(D + 2);
  for (let d = 1; d <= D + 1; d++) LEN[d] = RATIO ** (d - 1);
  // The trunk is the powers of two: the nodes reached from 1 by even steps only.
  const trunk = new Uint8Array(N);
  trunk[0] = 1;
  for (let i = 1; i < N; i++) trunk[i] = trunk[T.par[i]] && !T.odd[i] ? 1 : 0;
  params.s = {
    T, LEN, trunk, ev: NUMS.map((n) => flight(T, n)),
    X: new Float32Array(N), Y: new Float32Array(N), CH: new Float32Array(N), SH: new Float32Array(N),
    bx0: new Float32Array(D + 1), bx1: new Float32Array(D + 1), by0: new Float32Array(D + 1), by1: new Float32Array(D + 1),
    R: new Float32Array(NP), G: new Float32Array(NP), B: new Float32Array(NP),
    col: new Float32Array((D + 2) * 9), hz: new Float32Array(D + 2), sub: new Float32Array(N),
    hue: 0, al: -1, be: -1, alT: 0, beT: 0, v: 2,
    g: G0, act: 1, phase: 0, evI: 0, evP: 0, evW: 0, evH: 0, evA: 0, pop: 0, lastK: -1,
    sc: 3, cx: 0, cy: 0, init: false,
  };
}

function layout(S, al, be) {
  const { T, X, Y, CH, SH, LEN, bx0, bx1, by0, by1 } = S;
  const { n, par, dep, odd, LS } = T;
  const ca = cos(al), sa = sin(al), cb = cos(be), sb = sin(be);
  CH[0] = 1; SH[0] = 0; X[0] = 0; Y[0] = 0;
  let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
  bx0[0] = bx1[0] = by0[0] = by1[0] = 0;
  for (let i = 1; i < n; i++) {
    const p = par[i], c = CH[p], s = SH[p];
    let nc, ns;
    if (odd[i]) { nc = c * cb + s * sb; ns = s * cb - c * sb; }
    else { nc = c * ca - s * sa; ns = s * ca + c * sa; }
    CH[i] = nc; SH[i] = ns;
    const l = LEN[dep[i]], x = X[p] + ns * l, y = Y[p] - nc * l;
    X[i] = x; Y[i] = y;
    if (x < x0) x0 = x; else if (x > x1) x1 = x;
    if (y < y0) y0 = y; else if (y > y1) y1 = y;
    if (i + 1 === LS[dep[i] + 1]) {
      const d = dep[i];
      bx0[d] = x0; bx1[d] = x1; by0[d] = y0; by1[d] = y1;
    }
  }
  S.al = al;
  S.be = be;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.v = cl(k[1], 0.4, 4);
  S.alT = cl(k[2], 2, 14) * DEG;
  S.beT = cl(k[3], 20, 42) * DEG;
  const e = 1 - exp(-d / 0.12);
  if (S.al < 0) layout(S, S.alT, S.beT);
  else if (abs(S.alT - S.al) > 1e-4 || abs(S.beT - S.be) > 1e-4) layout(S, S.al + (S.alT - S.al) * e, S.be + (S.beT - S.be) * e);
  // Grow to D, run the hailstones, then fold back to G0 and grow again. A
  // hailstone's head runs rate nodes a second down its branch, waits 0.6 s
  // before the first one and 0.3 s before the rest, and the line stays lit
  // for 1.3 s once it has reached the root.
  const rate = 5 * S.v;
  if (S.phase === 0) {
    S.g += S.v * d;
    if (S.g >= D) { S.g = D; S.phase = 1; S.evI = 0; S.evP = 0; S.evW = -0.3; S.evH = 0; }
  } else if (S.phase === 1) {
    const m = S.ev[S.evI].m;
    S.evW += d;
    if (S.evW > 0.3) S.evP = min(m, S.evP + rate * d);
    if (S.evP >= m) S.evH += d;
    if (S.evH > 1.3) {
      S.evI++; S.evP = 0; S.evW = 0; S.evH = 0;
      if (S.evI >= S.ev.length) { S.phase = 2; S.evI = 0; }
    }
  } else {
    S.g -= 1.5 * S.v * d;
    if (S.g <= G0) { S.g = G0; S.phase = 0; }
  }
  // The hailstone's own clock: it fades in, and each time the bright head lands on a node the value pops.
  if (S.phase === 1 && S.evW > 0.3) {
    const ev = S.ev[S.evI], t = cl((S.evW - 0.3) / 0.4, 0, 1);
    S.evA = t * t * (3 - 2 * t) * cl((1.3 - S.evH) / 0.5, 0, 1);
    const kk = ceil(ev.m - S.evP - 1e-6);
    if (kk !== S.lastK) { S.lastK = kk; S.pop = 1; }
  } else {
    S.evA = max(0, S.evA - d / 0.4);
    S.lastK = -1;
  }
  S.pop *= exp(-d / 0.22);
  S.act += ((S.phase === 1 ? 0.15 : 1) - S.act) * (1 - exp(-d / 0.6));
  // The camera follows the bounding box of what has grown.
  const gi = min(D, floor(S.g)), gj = min(D, gi + 1), f = S.g - gi;
  const x0 = S.bx0[gi] + (S.bx0[gj] - S.bx0[gi]) * f, x1 = S.bx1[gi] + (S.bx1[gj] - S.bx1[gi]) * f;
  const y0 = S.by0[gi] + (S.by0[gj] - S.by0[gi]) * f, y1 = S.by1[gi] + (S.by1[gj] - S.by1[gi]) * f;
  // The width is fitted to the layers up to the 30th: the faint twigs after them may run off the sides.
  const wi = min(gi, 30), wj = min(gj, 30), wx0 = S.bx0[wi] + (S.bx0[wj] - S.bx0[wi]) * f, wx1 = S.bx1[wi] + (S.bx1[wj] - S.bx1[wi]) * f;
  const sFit = min((W - 1.5) / max(2, wx1 - wx0), (H - 5) / max(2, y1 - y0));
  const ce = S.init ? 1 - exp(-d / 0.2) : 1;
  S.init = true;
  S.sc += (sFit - S.sc) * ce;
  S.cx += ((wx0 + wx1) / 2 - S.cx) * ce;
  // The plant stands on the bottom edge; the top of the panel is for what is yet to grow.
  S.cy += (y1 - (H - 1 - 64) / S.sc - S.cy) * ce;
}

// A soft round dot of radius 1.25 LEDs, blended over what is there.
function dot(S, x, y, r, g, b, a) {
  const { R, G, B } = S;
  const x0 = floor(x - 1.2), y0 = floor(y - 1.2);
  for (let j = 0; j < 3; j++) {
    const py = y0 + j;
    if (py < 0 || py >= H) continue;
    for (let i = 0; i < 3; i++) {
      const px = x0 + i;
      if (px < 0 || px >= W) continue;
      const dx = px + 0.5 - x, dy = py + 0.5 - y, w = (1 - sqrt(dx * dx + dy * dy) / 1.25) * a;
      if (w <= 0) continue;
      const q = py * W + px, u = w > 1 ? 1 : w;
      R[q] += (r - R[q]) * u; G[q] += (g - G[q]) * u; B[q] += (b - B[q]) * u;
    }
  }
}

// A number in 3 x 5 digits on a dark ground, its left edge at x, or its right edge when right is set.
function number(S, v, x, y, r, g, b, right) {
  const s = String(v), w = s.length * 4 - 1, x0 = right ? x - w + 1 : x;
  const { R, G, B } = S;
  for (let yy = y - 1; yy <= y + 5; yy++)
    for (let xx = x0 - 1; xx <= x0 + w; xx++) if (xx >= 0 && xx < W && yy >= 0 && yy < H) R[yy * W + xx] = G[yy * W + xx] = B[yy * W + xx] = 0;
  for (let c = 0; c < s.length; c++) {
    const m = DIGITS[s.charCodeAt(c) - 48];
    for (let i = 0; i < m.length; i += 2) {
      const q = (y + m[i + 1]) * W + x0 + c * 4 + m[i];
      R[q] = r; G[q] = g; B[q] = b;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { T, X, Y, R, G, B, col, trunk, hz, sub } = S;
  const { par, dep, odd, LS } = T;
  const gi = min(D, floor(S.g)), f = S.g - gi, ea = S.evA;
  R.fill(0); G.fill(0); B.fill(0);
  // Colour per depth and step kind. The hue runs round with the depth; the
  // deep layers are dimmer, so the first twenty read through the haze of the
  // rest; the layers the growth has just reached are white-hot. Slot 0 is
  // an even step, 1 an odd step, 2 the trunk.
  const tmp = [0, 0, 0], dim = 1 - 0.5 * ea;
  for (let d = 0; d <= D; d++) {
    const br = 1 - 0.55 * ease((d - 8) / 26);
    const age = S.g - d, gl = age < 0 ? 1 : cl(1 - age / 1.8, 0, 1), gg = gl * gl * S.act;
    hz[d] = min(1, 0.05 + 0.95 * (1 - ease((d - 9) / 14)) + 0.12 * gg);
    for (let o = 0; o < 3; o++) {
      let h = o === 2 ? S.hue + 0.12 : S.hue + 0.38 + (d / D) * 0.45 + o * 0.12;
      h -= floor(h);
      // The faint layers hurry through orange and yellow: a dim orange reads as brown.
      if (o < 2 && d > 11) h = h < 0.02 ? h : h < 0.2 ? 0.02 + (h - 0.02) * 0.222 : h < 0.33 ? 0.06 + (h - 0.2) * 2.08 : h;
      hsv(h, (o === 2 ? 0.7 : 0.85) * (1 - 0.7 * gg), (0.3 + 0.7 * br) * (o === 2 ? 1 - 0.3 * ea : dim) * (1 - gg) + gg, tmp, 0);
      const q = (d * 3 + o) * 3;
      col[q] = tmp[0] * 255; col[q + 1] = tmp[1] * 255; col[q + 2] = tmp[2] * 255;
    }
  }
  const sc = S.sc, ox = 32 - S.cx * sc, oy = 64 - S.cy * sc;
  const nvis = LS[min(D + 1, gi + 2)];
  // A branch is as thick as the pipe model says: 1 + 0.35 log2 of the nodes
  // hanging from it, so the trunk thickens as the plant grows.
  for (let i = 0; i < nvis; i++) sub[i] = dep[i] > gi ? f : 1;
  for (let i = nvis - 1; i >= 1; i--) sub[par[i]] += sub[i];
  for (let i = nvis - 1; i >= 1; i--) {
    const p = par[i], d = dep[i];
    const x0 = ox + sc * X[p], y0 = oy + sc * Y[p];
    let x1 = ox + sc * X[i], y1 = oy + sc * Y[i];
    if (d > gi) { x1 = x0 + (x1 - x0) * f; y1 = y0 + (y1 - y0) * f; }
    const len = sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
    const hw = trunk[i] ? 1 : hz[d];
    const q0 = (d * 3 + (trunk[i] ? 2 : odd[i])) * 3, cr = col[q0], cg = col[q0 + 1], cb = col[q0 + 2];
    const wd = hw < 0.5 ? 1 : min(5.2, 1 + (trunk[i] ? 0.3 : 0.1) * log2(sub[i]));
    if (wd > 1.7) {
      // A thick branch: round discs a half LED apart.
      const rad = wd / 2, ns = ceil(len * 2) + 1;
      for (let s = 1; s <= ns; s++) {
        const u = s / ns, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
        const ya = max(0, floor(y - rad - 0.5)), yb = min(H - 1, ceil(y + rad + 0.5));
        const xa = max(0, floor(x - rad - 0.5)), xb = min(W - 1, ceil(x + rad + 0.5));
        for (let py = ya; py <= yb; py++)
          for (let px = xa; px <= xb; px++) {
            const dx = px + 0.5 - x, dy = py + 0.5 - y, w = rad + 0.5 - sqrt(dx * dx + dy * dy);
            if (w <= 0) continue;
            const q = py * W + px, a = w > 1 ? 1 : w;
            R[q] += (cr - R[q]) * a; G[q] += (cg - G[q]) * a; B[q] += (cb - B[q]) * a;
          }
      }
      continue;
    }
    const ns = ceil(len * 1.5) + 1;
    for (let s = 1; s <= ns; s++) {
      const u = s / ns, x = x0 + (x1 - x0) * u - 0.5, y = y0 + (y1 - y0) * u - 0.5;
      const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
      for (let b = 0; b < 4; b++) {
        const px = ix + (b & 1), py = iy + (b >> 1);
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const w = ((b & 1) ? fx : 1 - fx) * ((b >> 1) ? fy : 1 - fy) * 1.3;
        const q = py * W + px, a = (w > 1 ? 1 : w) * hw;
        R[q] += (cr - R[q]) * a; G[q] += (cg - G[q]) * a; B[q] += (cb - B[q]) * a;
      }
    }
  }
  // The hailstone: a bright line from the top of its branch to where the head has got.
  if (S.evA > 0.01) {
    const ev = S.ev[S.evI], head = ev.m - S.evP;
    const path = ev.path;
    for (let k = ev.m; k >= 1; k--) {
      // Segment k runs from node k down to node k - 1 and is lit from the moment the head is past node k.
      const u1 = min(1, k - head);
      if (u1 <= 0) break;
      const a = path[k], b = path[k - 1];
      const ax = ox + sc * X[a], ay = oy + sc * Y[a], bx = ox + sc * X[b], by = oy + sc * Y[b];
      const ex = ax + (bx - ax) * u1, ey = ay + (by - ay) * u1;
      const ns = ceil(sqrt((ex - ax) * (ex - ax) + (ey - ay) * (ey - ay)) * 1.5) + 1;
      const hot = exp(-(k - head) / 2.5);
      for (let s = 0; s <= ns; s++) {
        const u = s / ns;
        dot(S, ax + (ex - ax) * u, ay + (ey - ay) * u, 255, 215 + 40 * hot, 150 + 105 * hot, ea * (0.75 + 0.25 * hot));
      }
    }
    // The head itself, between node hk and the one under it.
    const hk = ceil(head), a = path[hk], b = path[max(0, hk - 1)], uu = hk - head;
    dot(S, ox + sc * (X[a] + (X[b] - X[a]) * uu), oy + sc * (Y[a] + (Y[b] - Y[a]) * uu), 255, 255, 255, ea);
    // In the corners: the number chosen top left, the value the head has reached bottom right.
    number(S, ev.n, 2, 2, 255 * ea, 210 * ea, 120 * ea, false);
    number(S, ev.vals[hk], W - 2, H - 8, 255, 230 + 25 * S.pop, 160 + 95 * S.pop, true);
  }
  for (let q = 0; q < NP; q++) display.setPixel(q % W, (q / W) | 0, R[q], G[q], B[q]);
}
