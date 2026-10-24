// ===== Patternflow pattern =====
// Title:   Foam Lather
// Family:  cosmetic
// Idea:    Fresh lather fills the panel with hundreds of small tinted bubbles, each a soft dome with a thin bright wall and a point of light, and it coarsens as it rises: bubbles with few neighbours shrink away, walls burst with a flash and merge two bubbles into one, the top turns to a dry honeycomb while the bottom stays wet and round, until new lather is whipped in from below.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 31, after cleansing foam whipped into lather
// Round:   31
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=0..1, Wetness=0..1
//
// Knob 1: Hue. The tint of the foam, all the way round the colour wheel from sky blue at 0; the walls and the points of light stay nearly white.
// Knob 2: Speed. How fast the foam lives: at 2 it rises about a row a second, a small bubble with four neighbours is gone in about four seconds and a fresh batch is whipped in every fifteen; at 0.2 it all runs ten times slower.
// Knob 3: Size. The bubbles of fresh lather, from fine ones four LEDs across at 0 to coarse ones ten across at 1; they about double on the way up.
// Knob 4: Wetness. How much liquid the foam holds: near 0 only the bottom sixth is wet and round and the rest dries to a honeycomb of thin walls; at 1 every bubble is a round dome sitting in milky liquid.
// Buttons: K1 tap whips a fresh batch of fine lather in from the bottom.

const W = 64, H = 128;
const { min, max, floor, sqrt, exp, abs, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The opening tint: sky blue.
const H0 = 0.57;
// The foam is worked out over a margin M past every edge of the panel, so
// bubbles at the edge have all their neighbours and the edge is no wall.
const M = 6, EW = W + 2 * M, EH = H + 2 * M, EN = EW * EH;
// At most NB bubbles, each with up to NN neighbours on record.
const NB = 1100, NN = 16;
// Gas through the walls: a bubble's area changes by K*(n - 6) LED^2 a second
// at Speed 2, n its number of neighbours (von Neumann's law for 2D foam). The
// 6 is the mean count of the bubbles on the panel, which comes out at 5.9 to
// 6.1, and the dry foam at the top runs 1.2 times as fast.
const K = 1.6;
// The foam rises RISE rows a second; a batch of lather comes every BATCH
// seconds and pushes it up BOOST rows a second faster for two seconds.
const RISE = 1.2, BATCH = 15, BOOST = 14;
// Packing grid for the bubbles, CS LEDs a cell.
const CS = 6, GX = Math.ceil(EW / CS) + 1, GY = Math.ceil(EH / CS) + 1;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  if (i === 0) (r = v), (g = t), (b = p);
  else if (i === 1) (r = q), (g = v), (b = p);
  else if (i === 2) (r = p), (g = v), (b = t);
  else if (i === 3) (r = p), (g = q), (b = v);
  else if (i === 4) (r = t), (g = p), (b = v);
  else (r = v), (g = p), (b = q);
  out[o] = r * 255;
  out[o + 1] = g * 255;
  out[o + 2] = b * 255;
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    x: F(NB), y: F(NB), r: F(NB), a: F(NB), tone: F(NB), n: 0, dead: new Uint8Array(NB),
    nb: new Int16Array(NB * NN), nc: new Uint8Array(NB), edge: new Uint8Array(NB), fresh: true,
    l1: new Int16Array(EN), l2: new Int16Array(EN), p1: F(EN), p2: F(EN),
    head: new Int16Array(GX * GY), next: new Int16Array(NB),
    fl: F(32 * 8), nfl: 0, dr: F(96 * 5), ndr: 0,
    T: 0, since: 0, boost: 0, acc: 0, rate: 1, size: 0, wet: 0.06, hue: 0, started: false,
    col: F(18), buf: F(W * H * 3),
  };
}

// The radius of fresh lather.
const fresh = (S) => 2.1 + 3.2 * S.size;

function add(S, x, y, r) {
  if (S.n >= NB) return;
  const i = S.n++;
  S.x[i] = x;
  S.y[i] = y;
  S.r[i] = r;
  S.a[i] = PI * r * r;
  S.tone[i] = rnd();
  S.dead[i] = 0;
  S.nc[i] = 0;
  S.edge[i] = 1;
}

// Liquid fraction at height y: it drains, so the foam is wettest at the
// bottom; Wetness raises it everywhere.
function liquid(S, y) {
  const b = cl(y / H, 0, 1), dr = b ** 4;
  return cl(0.02 + 0.3 * S.wet + (0.2 + 0.1 * S.wet) * dr, 0, 0.4);
}

// The panel filled with lather that has already risen and coarsened: fine
// bubbles at the bottom, two and a half times as big at the top.
function fill(S) {
  S.n = 0;
  const f = fresh(S);
  let y = EH - M - f;
  while (y > -M - 2) {
    const rr = f * (1 + 1.5 * cl((H - y) / H, 0, 1) ** 1.2);
    for (let x = -M + rnd() * rr; x < W + M; ) {
      const r = rr * (0.65 + 0.7 * rnd());
      add(S, x, y + (rnd() - 0.5) * rr * 0.6, r);
      x += r * 1.75 + rr * 0.15;
    }
    y -= rr * 1.6;
  }
  for (let k = 0; k < 60; k++) pack(S, 0.6);
}

// Bubbles push apart wherever their discs overlap, the small ones giving
// way more, so the foam stays packed and its cells polygonal.
function pack(S, k) {
  const { x, y, r, a, head, next } = S;
  head.fill(-1);
  let rmax = 0;
  for (let i = 0; i < S.n; i++) {
    const gx = cl(floor((x[i] + M) / CS), 0, GX - 1), gy = cl(floor((y[i] + M) / CS), 0, GY - 1), c = gy * GX + gx;
    next[i] = head[c];
    head[c] = i;
    if (r[i] > rmax) rmax = r[i];
  }
  for (let i = 0; i < S.n; i++) {
    const xi = x[i], yi = y[i], ri = r[i], reach = Math.ceil((ri + rmax) / CS);
    const gx = cl(floor((xi + M) / CS), 0, GX - 1), gy = cl(floor((yi + M) / CS), 0, GY - 1);
    for (let cy = max(0, gy - reach); cy <= min(GY - 1, gy + reach); cy++)
      for (let cx = max(0, gx - reach); cx <= min(GX - 1, gx + reach); cx++)
        for (let j = head[cy * GX + cx]; j >= 0; j = next[j]) {
          if (j <= i) continue;
          const dx = x[j] - xi, dy = y[j] - yi, want = (ri + r[j]) * 0.96, d2 = dx * dx + dy * dy;
          if (d2 >= want * want) continue;
          const d = sqrt(d2) + 1e-4, push = ((want - d) / d) * k, wi = a[j] / (a[i] + a[j]);
          x[i] -= dx * push * wi;
          y[i] -= dy * push * wi;
          x[j] += dx * push * (1 - wi);
          y[j] += dy * push * (1 - wi);
        }
  }
  // Soft walls just past the margin at the sides and the bottom.
  for (let i = 0; i < S.n; i++) {
    const lo = -M + r[i] * 0.4, hi = W + M - r[i] * 0.4, bot = H + M - r[i] * 0.6;
    if (x[i] < lo) x[i] += (lo - x[i]) * 0.5;
    if (x[i] > hi) x[i] += (hi - x[i]) * 0.5;
    if (y[i] > bot) y[i] += (bot - y[i]) * 0.5;
  }
}

// Every LED of the margined grid takes the bubble whose power distance
// d^2 - r^2 is least (a Laguerre cell, which is how a 2D foam of mixed
// sizes divides the plane), and remembers the runner-up for the wall.
function label(S) {
  const { x, y, r, l1, l2, p1, p2 } = S;
  l1.fill(-1);
  l2.fill(-1);
  p1.fill(1e9);
  p2.fill(1e9);
  for (let i = 0; i < S.n; i++) {
    const R = max(r[i] * 1.4 + 1.3, r[i] * 1.8), w = r[i] * r[i], cx = x[i] + M, cy = y[i] + M;
    const x0 = max(0, floor(cx - R)), x1 = min(EW - 1, floor(cx + R)), y0 = max(0, floor(cy - R)), y1 = min(EH - 1, floor(cy + R));
    for (let Y = y0; Y <= y1; Y++) {
      const dy = Y + 0.5 - cy, dy2 = dy * dy - w;
      for (let X = x0, p = Y * EW + x0; X <= x1; X++, p++) {
        const dx = X + 0.5 - cx, pd = dx * dx + dy2;
        if (pd < p1[p]) {
          p2[p] = p1[p];
          l2[p] = l1[p];
          p1[p] = pd;
          l1[p] = i;
        } else if (pd < p2[p]) {
          p2[p] = pd;
          l2[p] = i;
        }
      }
    }
  }
  // Who touches whom: two cells are neighbours where their LEDs meet.
  const { nb, nc, edge } = S;
  nc.fill(0, 0, S.n);
  for (let i = 0; i < S.n; i++) edge[i] = x[i] - r[i] * 1.6 < -M + 1 || x[i] + r[i] * 1.6 > W + M - 1 || y[i] - r[i] * 1.6 < -M + 1 || y[i] + r[i] * 1.6 > H + M - 1 ? 1 : 0;
  for (let Y = 0; Y < EH - 1; Y++)
    for (let X = 0, p = Y * EW; X < EW - 1; X++, p++) {
      const a = l1[p];
      if (a < 0) continue;
      const b = l1[p + 1], c = l1[p + EW];
      if (b >= 0 && b !== a) link(nb, nc, a, b);
      if (c >= 0 && c !== a && c !== b) link(nb, nc, a, c);
    }
  S.fresh = true;
}

function link(nb, nc, a, b) {
  const oa = a * NN;
  for (let k = 0; k < nc[a]; k++) if (nb[oa + k] === b) return;
  if (nc[a] < NN) nb[oa + nc[a]++] = b;
  const ob = b * NN;
  for (let k = 0; k < nc[b]; k++) if (nb[ob + k] === a) return;
  if (nc[b] < NN) nb[ob + nc[b]++] = a;
}

// A wall bursts: a flash along it and a few droplets thrown off, and the
// two bubbles become one with both their areas.
function burst(S, i, j) {
  const { x, y, r, a } = S;
  const dx = x[j] - x[i], dy = y[j] - y[i], d = sqrt(dx * dx + dy * dy) + 1e-4;
  const t = (d * d + r[i] * r[i] - r[j] * r[j]) / (2 * d * d), mx = x[i] + dx * t, my = y[i] + dy * t;
  const half = min(r[i], r[j]) * 0.75, ux = -dy / d, uy = dx / d;
  for (let k = 0; k < 3 && S.ndr < 96; k++) {
    const o = S.ndr++ * 5, s = (rnd() - 0.5) * 2, sp = 10 + 14 * rnd(), side = rnd() < 0.5 ? -1 : 1;
    S.dr[o] = mx + ux * half * s;
    S.dr[o + 1] = my + uy * half * s;
    S.dr[o + 2] = (dx / d) * sp * side + ux * 4 * s;
    S.dr[o + 3] = (dy / d) * sp * side + uy * 4 * s - 6;
    S.dr[o + 4] = 1;
  }
  const A = a[i] + a[j];
  x[i] = (x[i] * a[i] + x[j] * a[j]) / A;
  y[i] = (y[i] * a[i] + y[j] * a[j]) / A;
  a[i] = A;
  r[i] = sqrt(A / PI);
  S.dead[j] = 1;
  if (S.nfl < 32) {
    const o = S.nfl++ * 8, f = S.fl;
    f[o] = mx - ux * half;
    f[o + 1] = my - uy * half;
    f[o + 2] = mx + ux * half;
    f[o + 3] = my + uy * half;
    f[o + 4] = 1;
    f[o + 5] = r[i];
    f[o + 6] = x[i];
    f[o + 7] = y[i];
  }
}

function step(S, st) {
  S.T += st;
  S.since += st;
  if (S.since >= BATCH) (S.since = 0), (S.boost = 2);
  const { x, y, r, a, nb, nc, edge, dead } = S;
  const n = S.n;
  if (S.fresh) {
    S.fresh = false;
    // Gas runs from bubbles with fewer than six sides to those with more.
    // The mean is taken over the bubbles away from the margin's edge, and
    // those at the edge keep their size.
    let sum = 0, cnt = 0;
    for (let i = 0; i < n; i++) if (!edge[i]) (sum += nc[i]), cnt++;
    const mean = cnt ? sum / cnt : 6;
    for (let i = 0; i < n; i++) {
      if (edge[i] || dead[i]) continue;
      // A dry foam coarsens faster: its walls are thinner.
      const dry = 1.3 - 2.5 * liquid(S, y[i]);
      a[i] += K * (nc[i] - mean) * dry * st;
      if (a[i] < 2.5) {
        dead[i] = 1;
        continue;
      }
      r[i] = sqrt(a[i] / PI);
    }
    // Walls burst more often the drier and bigger the bubbles.
    for (let i = 0; i < n; i++) {
      if (dead[i] || edge[i] || !nc[i]) continue;
      const dry = cl(1 - liquid(S, y[i]) / 0.2, 0, 1);
      if (rnd() > st * 0.014 * dry * (r[i] / 3) ** 2) continue;
      const j = nb[i * NN + floor(rnd() * nc[i])];
      if (j >= 0 && j < n && !dead[j] && !edge[j]) burst(S, i, j);
    }
  }
  // The foam rises; whatever leaves the top is gone.
  const up = (RISE + (S.boost > 0 ? BOOST * sm(0, 0.4, S.boost) : 0)) * st;
  S.boost = max(0, S.boost - st);
  for (let i = 0; i < n; i++) {
    y[i] -= up;
    if (y[i] + r[i] < -M) dead[i] = 1;
  }
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (dead[i]) continue;
    if (k !== i) {
      x[k] = x[i];
      y[k] = y[i];
      r[k] = r[i];
      a[k] = a[i];
      S.tone[k] = S.tone[i];
    }
    dead[k] = 0;
    k++;
  }
  S.n = k;
  // New lather comes in under the bottom edge as fast as the foam rises, a
  // fresh batch finer still.
  const f = fresh(S) * (S.boost > 0 ? 0.85 : 1);
  S.acc += up * EW;
  while (S.acc > 0 && S.n < NB) {
    const rr = f * (0.7 + 0.6 * rnd());
    S.acc -= PI * rr * rr * 0.95;
    add(S, -M + rnd() * EW, H + M - rr * (0.6 + rnd()), rr);
  }
  pack(S, 0.7);
  // Flashes fade in a third of a second; droplets fly and fall.
  for (let i = S.nfl - 1; i >= 0; i--) {
    const o = i * 8;
    S.fl[o + 4] -= st * 3;
    if (S.fl[o + 4] <= 0) {
      const l = --S.nfl * 8;
      for (let c = 0; c < 8; c++) S.fl[o + c] = S.fl[l + c];
    }
  }
  for (let i = S.ndr - 1; i >= 0; i--) {
    const o = i * 5;
    S.dr[o] += S.dr[o + 2] * st;
    S.dr[o + 1] += S.dr[o + 3] * st;
    S.dr[o + 3] += 60 * st;
    S.dr[o + 4] -= st * 3;
    if (S.dr[o + 4] <= 0) {
      const l = --S.ndr * 5;
      for (let c = 0; c < 5; c++) S.dr[o + c] = S.dr[l + c];
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.rate = cl(k[1], 0.2, 3) / 2;
  S.size = cl(k[2], 0, 1);
  S.wet = cl(k[3], 0, 1);
  if (!S.started) {
    S.started = true;
    fill(S);
    for (let i = 0; i < 30; i++) {
      label(S);
      step(S, 1 / 30);
    }
    S.since = 6;
  }
  if (input.btnPressed && input.btnPressed[0]) (S.boost = 2), (S.since = 0);
  step(S, d * S.rate);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  label(S);
  const { x, y, r, l1, l2, p1, p2, col, buf, tone } = S;
  const hue = H0 + S.hue;
  // Inside a bubble, its rim, the wall, the liquid between bubbles. Orange
  // and yellow kept dim read brown and olive on LEDs, so near those hues
  // the inside of a bubble is lit brighter.
  const hw = (hue - floor(hue) + 1) % 1, am = max(0, 1 - abs(hw - 0.17) / 0.17);
  hsv(hue, 0.5 - 0.12 * am, 0.52 + 0.34 * am, col, 0);
  hsv(hue - 0.02, 0.4 - 0.05 * am, 0.85 + 0.13 * am, col, 3);
  hsv(hue + 0.03, 0.12, 0.98, col, 6);
  hsv(hue, 0.3, 0.72 + 0.16 * am, col, 9);
  for (let Y = 0; Y < H; Y++) {
    const phi = liquid(S, Y), sd = 0.88 + 0.9 * (1 - min(1, phi / 0.36)) ** 2;
    for (let X = 0; X < W; X++) {
      const p = (Y + M) * EW + X + M, i = l1[p], q = (Y * W + X) * 3;
      if (i < 0) {
        buf[q] = col[9];
        buf[q + 1] = col[10];
        buf[q + 2] = col[11];
        continue;
      }
      const px = X + 0.5, py = Y + 0.5, dx = px - x[i], dy = py - y[i], d = sqrt(dx * dx + dy * dy);
      const j = l2[p];
      let dw = 9;
      if (j >= 0) {
        const ex = x[j] - x[i], ey = y[j] - y[i];
        dw = (p2[p] - p1[p]) / (2 * sqrt(ex * ex + ey * ey) + 1e-4);
      }
      // A bubble is its cell clipped to a disc: in a dry foam the disc
      // covers the cell and the bubble is a polygon; in a wet one it is
      // round, sitting in liquid that fills the corners between bubbles.
      const ed = r[i] * sd - d, e = min(dw, ed);
      let R, G, B;
      if (e < 0) {
        // Liquid: milky, brightest against the bubbles it wets.
        const k = exp(e * 0.9) * 0.35;
        R = col[9] + (col[6] - col[9]) * k;
        G = col[10] + (col[7] - col[10]) * k;
        B = col[11] + (col[8] - col[11]) * k;
      } else {
        // The dome: dim through its middle, brighter round its rim as the
        // film turns edge on and low on the right where the light that came
        // in through it gathers, a thin bright wall, and a point of light up
        // and to the left.
        const u = d / (d + e + 1e-4), rr = r[i], gx = dx - rr * 0.3, gy = dy - rr * 0.34;
        const g2 = 1 - (gx * gx + gy * gy) / (1.6 * rr * rr), lens = g2 > 0 ? g2 * g2 * 0.45 : 0, rim = max(u * u * u, lens);
        const v = 0.85 + 0.3 * tone[i];
        R = (col[0] * (1 - rim) + col[3] * rim) * v;
        G = (col[1] * (1 - rim) + col[4] * rim) * v;
        B = (col[2] * (1 - rim) + col[5] * rim) * v;
        const s = 0.32 + 0.1 * rr, hx = dx + rr * 0.36, hy = dy + rr * 0.4, h2 = (hx * hx + hy * hy) / (2 * s * s);
        const h5 = 1 - h2 * 0.2, hl = h5 > 0 ? h5 * h5 * h5 * h5 * h5 * 255 : 0;
        // The wall, about 1.3 LEDs across: (1 - (e/1.3)^2)^2.
        const w2 = 1 - e * e * 0.6, wl = w2 > 0 ? w2 * w2 * (ed < dw ? 0.75 : 1) : 0;
        R += (col[6] - R) * wl + hl;
        G += (col[7] - G) * wl + hl;
        B += (col[8] - B) * wl + hl;
      }
      buf[q] = R;
      buf[q + 1] = G;
      buf[q + 2] = B;
    }
  }
  // A burst wall flashes white along its length, and for a moment the new
  // bubble it leaves is lit through.
  for (let f = 0; f < S.nfl; f++) {
    const o = f * 8, fl = S.fl, life = fl[o + 4], len = Math.hypot(fl[o + 2] - fl[o], fl[o + 3] - fl[o + 1]);
    const steps = max(2, Math.ceil(len * 2)), lf = life * life;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      spot(buf, fl[o] + (fl[o + 2] - fl[o]) * t, fl[o + 1] + (fl[o + 3] - fl[o + 1]) * t, lf * 200 * (1 - 0.6 * abs(t - 0.5)));
    }
    const rm = fl[o + 5] * 0.85, cx = fl[o + 6], cy = fl[o + 7];
    for (let Y = max(0, floor(cy - rm)); Y <= min(H - 1, floor(cy + rm)); Y++)
      for (let X = max(0, floor(cx - rm)); X <= min(W - 1, floor(cx + rm)); X++) {
        const d2 = ((X + 0.5 - cx) ** 2 + (Y + 0.5 - cy) ** 2) / (rm * rm);
        if (d2 >= 1) continue;
        const w = (1 - d2) * lf * 0.7, q = (Y * W + X) * 3;
        buf[q] += (col[6] - buf[q] * 0.5) * w;
        buf[q + 1] += (col[7] - buf[q + 1] * 0.5) * w;
        buf[q + 2] += (col[8] - buf[q + 2] * 0.5) * w;
      }
  }
  for (let k = 0; k < S.ndr; k++) {
    const o = k * 5;
    spot(buf, S.dr[o], S.dr[o + 1], S.dr[o + 4] * 200);
  }
  for (let p = 0, Y = 0; Y < H; Y++) for (let X = 0; X < W; X++, p += 3) display.setPixel(X, Y, knee(buf[p]), knee(buf[p + 1]), knee(buf[p + 2]));
}

// White light v shared over the four LEDs round x, y.
function spot(buf, x, y, v) {
  const X = floor(x - 0.5), Y = floor(y - 0.5), fx = x - 0.5 - X, fy = y - 0.5 - Y;
  for (let k = 0; k < 4; k++) {
    const xx = X + (k & 1), yy = Y + (k >> 1);
    if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
    const w = (k & 1 ? fx : 1 - fx) * (k >> 1 ? fy : 1 - fy) * v, q = (yy * W + xx) * 3;
    buf[q] += w;
    buf[q + 1] += w;
    buf[q + 2] += w;
  }
}

function knee(v) {
  return v < 200 ? v : 255 - 55 * exp(-(v - 200) / 55);
}
