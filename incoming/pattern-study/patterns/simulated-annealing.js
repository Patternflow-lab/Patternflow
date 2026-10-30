// ===== Patternflow pattern =====
// Title:   Simulated Annealing
// Family:  sim
// Idea:    A closed tour through 80 random cities starts as a hot tangle of crossing lines that jumps every frame, and as the temperature falls under the Metropolis rule the crossings undo themselves, the inside of the loop (filled by the even-odd rule) closes into one region, and the tour settles into a ring that no longer crosses itself with its colours flowing round it, until the cities fly to new places and melt it again.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: simulated annealing (Scott Kirkpatrick, C. Daniel Gelatt and Mario Vecchi, 1983) with the Metropolis rule (Nicholas Metropolis, Arianna Rosenbluth, Marshall Rosenbluth, Augusta Teller and Edward Teller, 1953), on the travelling salesman problem, pattern round 77
// Round:   77
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Cities=80..150, Floor=0..1
//
// Knob 1: Hue. Turns the loop's colours round the wheel. At 0 the tour runs from cyan through blue and violet to pink and back again, so the ring has no seam; at 0.5 it runs from red through orange and yellow to green.
// Knob 2: Speed. Stretches the clock of the whole cycle. At 2 one cycle is 18 s: 0.8 s hot while the cities fly to their new places, 12 s of cooling and 5.2 s held at the floor, with 60,000 tries a second (2,000 a frame). At 0.2 everything is ten times slower, at 3 one and a half times faster, and a cycle always gets the same 1.08 million tries.
// Knob 3: Cities. 80 to 150 cities. A new count scatters new cities and starts from a random tour at once. The city spacing, the square root of the area per city, is 9.4 LEDs for 80 and 6.9 for 150, and the temperatures are counted in it.
// Knob 4: Floor. The temperature the cooling ends at and holds, 0.01 city spacings times 50 to the power of the knob: 0.013 at the opening 0.06, 0.07 at 0.5 and 0.5 at 1. Cooling always starts at 4 spacings. Up to about 0.5 the ring freezes with no crossings; at 1 it stays a warm liquid that keeps about 20 crossings of 80 cities and flickers as they come and go.

// The travelling salesman wants the shortest closed tour through all the
// cities. Kirkpatrick, Gelatt and Vecchi (Science, 1983) treated the tour's
// length L as the energy of a physical system and cooled it: propose a
// small change, and keep it by the rule of Metropolis and his coauthors
// (1953), always if it makes the tour shorter and with probability
// exp(-dL / T) if it makes it longer by dL. At a high temperature T almost
// every change is kept and the tour is a random tangle. Cooled slowly, the
// tour has time to find its way down, and cold it stops at a short tour
// that no single change can shorten. Cooled at once (a quench), it freezes
// in the first dent it meets: on the same 80 cities a 2-opt descent from a
// random order ends 2.6% to 9.5% longer than this anneal, 6.6% on average.
//
// The change here is the 2-opt move (Shen Lin, 1965): cut two edges of the
// tour, a-b and c-d, and join a-c and b-d, which reverses the path between
// them.
// If two edges cross, the move that uncrosses them always shortens the
// tour (the two diagonals of a quadrilateral are longer than either pair of
// its opposite sides), so a tour that no 2-opt move can shorten never
// crosses itself, and the cold ring on the panel is a simple polygon.
//
// The picture shows that through the inside of the loop: each row is
// filled between alternate crossings of the tour (the even-odd rule). A
// tangled tour fills as a patchwork that flickers; once the tour stops
// crossing itself the fill becomes one region with the loop as its edge,
// a meander that interlocks with the outside. The loop is coloured by place
// along the tour, so while it is tangled neighbouring colours are scattered
// over the whole panel, and as it orders they sort into one gradient.
// The line on row 125 is the temperature on a log scale from 0.01 to 4
// city spacings, warm white when hot and pale blue when cold.

const W = 64, H = 128, NP = W * H;
const X0 = 2.5, X1 = 61.5, Y0 = 2.5, Y1 = 121.5, GY = 125;
const { floor, round, min, max, sqrt, exp, log, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Seconds at Speed 2.
const HOT = 0.8, CYCLE = 18, COOL = 12, TRIES = 60000;
const T0 = 4, T1 = 0.01, SPAN = 0.45;

function hsv(h, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - i;
  const v = i === 0 ? [1, f, 0] : i === 1 ? [1 - f, 1, 0] : i === 2 ? [0, 1, f] : i === 3 ? [0, 1 - f, 1] : i === 4 ? [f, 0, 1] : [1, 0, 1 - f];
  o[k] = v[0];
  o[k + 1] = v[1];
  o[k + 2] = v[2];
}

function scatter(S, glide) {
  const n = S.n;
  for (let i = 0; i < n; i++) {
    S.ox[i] = glide ? S.x[i] : 0;
    S.oy[i] = glide ? S.y[i] : 0;
    S.tx[i] = X0 + Math.random() * (X1 - X0);
    S.ty[i] = Y0 + Math.random() * (Y1 - Y0);
    if (!glide) (S.x[i] = S.tx[i]), (S.y[i] = S.ty[i]);
  }
  S.glide = glide ? 0 : 1;
}

function start(S, n) {
  S.n = n;
  S.x = new Float32Array(n);
  S.y = new Float32Array(n);
  S.ox = new Float32Array(n);
  S.oy = new Float32Array(n);
  S.tx = new Float32Array(n);
  S.ty = new Float32Array(n);
  S.tour = new Int32Array(n);
  for (let i = 0; i < n; i++) S.tour[i] = i;
  // A random order: the first tour is a tangle.
  for (let i = n - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1)), t = S.tour[i];
    S.tour[i] = S.tour[j];
    S.tour[j] = t;
  }
  S.col = new Float32Array(n * 3);
  S.unit = sqrt(((X1 - X0) * (Y1 - Y0)) / n);
  scatter(S, false);
  S.tc = 0;
}

export function setup(params) {
  params.s = {
    n: 0, hue: 0, rate: 1, floor: T1, tc: 0, phi: 0, T: T0, acc: new Float32Array(NP * 3), cur: new Float32Array(NP * 3),
    bl: new Float32Array(NP * 3), tmp: new Float32Array(NP * 3), xs: new Float32Array(400), ca: [0, 0, 0], cb: [0, 0, 0],
  };
}

function dist(S, a, b) {
  const dx = S.x[a] - S.x[b], dy = S.y[a] - S.y[b];
  return sqrt(dx * dx + dy * dy);
}

// Tries 2-opt reversals at temperature T (in pixels) by the Metropolis rule.
function anneal(S, tries, T) {
  const n = S.n, tour = S.tour, half = n >> 1;
  for (let k = 0; k < tries; k++) {
    let i = floor(Math.random() * n), j = floor(Math.random() * n);
    if (i > j) {
      const t = i;
      i = j;
      j = t;
    }
    if (j - i < 2 || (i === 0 && j === n - 1)) continue;
    const a = tour[i], b = tour[i + 1], c = tour[j], d = tour[(j + 1) % n];
    const dL = dist(S, a, c) + dist(S, b, d) - dist(S, a, b) - dist(S, c, d);
    if (dL > 0 && Math.random() >= exp(-dL / T)) continue;
    // Reverse positions i+1..j, or the rest of the ring if that is shorter:
    // both give the same closed tour.
    let lo = i + 1, hi = j, len = j - i;
    if (len > half) (lo = j + 1), (hi = i + n), (len = n - len);
    for (let s = 0; s < len >> 1; s++) {
      const p = (lo + s) % n, q = (hi - s) % n, t = tour[p];
      tour[p] = tour[q];
      tour[q] = t;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.rate = cl(k[1] == null ? 2 : k[1], 0.2, 3) / 2;
  const n = round(cl(k[2] == null ? 80 : k[2], 80, 150));
  S.floor = T1 * Math.pow(50, cl(k[3] == null ? 0.06 : k[3], 0, 1));
  if (n !== S.n) start(S, n);
  const dc = d * S.rate;
  S.tc += dc;
  S.phi += dc / 12;
  if (S.tc >= CYCLE) {
    S.tc -= CYCLE;
    scatter(S, true);
  }
  // The cities fly to their new places while the tour is hot.
  if (S.glide < 1) {
    S.glide = min(1, S.glide + dc / HOT);
    const e = S.glide * S.glide * (3 - 2 * S.glide);
    for (let i = 0; i < S.n; i++) {
      S.x[i] = S.ox[i] + (S.tx[i] - S.ox[i]) * e;
      S.y[i] = S.oy[i] + (S.ty[i] - S.oy[i]) * e;
    }
  }
  const u = cl((S.tc - HOT) / COOL, 0, 1);
  S.T = T0 * Math.pow(S.floor / T0, u) * S.unit;
  anneal(S, round(TRIES * dc), S.T);
}

// Plots a line with two-pixel anti-aliasing, keeping the brighter colour.
function line(S, x0, y0, x1, y1, ca, cb, lv) {
  const cur = S.cur, dx = x1 - x0, dy = y1 - y0;
  const steep = Math.abs(dy) > Math.abs(dx);
  const len = steep ? Math.abs(dy) : Math.abs(dx);
  const steps = max(1, Math.ceil(len));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, x = x0 + dx * t - 0.5, y = y0 + dy * t - 0.5;
    const r = (ca[0] + (cb[0] - ca[0]) * t) * lv, g = (ca[1] + (cb[1] - ca[1]) * t) * lv, b = (ca[2] + (cb[2] - ca[2]) * t) * lv;
    let px, py, f, ox, oy;
    if (steep) (py = round(y)), (px = floor(x)), (f = x - px), (ox = 1), (oy = 0);
    else (px = round(x)), (py = floor(y)), (f = y - py), (ox = 0), (oy = 1);
    for (let h = 0; h < 2; h++) {
      const qx = px + ox * h, qy = py + oy * h, w = h ? f : 1 - f;
      if (qx < 0 || qx >= W || qy < 0 || qy >= H) continue;
      const o = (qy * W + qx) * 3;
      if (r * w > cur[o]) cur[o] = r * w;
      if (g * w > cur[o + 1]) cur[o + 1] = g * w;
      if (b * w > cur[o + 2]) cur[o + 2] = b * w;
    }
  }
}

// A box blur of radius R across and then down.
function blur(src, dst, tmp) {
  const R = 5, k = 1 / (2 * R + 1);
  for (let y = 0; y < H; y++)
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let x = -R; x <= R; x++) if (x >= 0 && x < W) sum += src[(y * W + x) * 3 + c];
      for (let x = 0; x < W; x++) {
        tmp[(y * W + x) * 3 + c] = sum * k;
        const xa = x - R, xb = x + R + 1;
        if (xa >= 0) sum -= src[(y * W + xa) * 3 + c];
        if (xb < W) sum += src[(y * W + xb) * 3 + c];
      }
    }
  for (let x = 0; x < W; x++)
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let y = -R; y <= R; y++) if (y >= 0 && y < H) sum += tmp[(y * W + x) * 3 + c];
      for (let y = 0; y < H; y++) {
        dst[(y * W + x) * 3 + c] = sum * k;
        const ya = y - R, yb = y + R + 1;
        if (ya >= 0) sum -= tmp[(ya * W + x) * 3 + c];
        if (yb < H) sum += tmp[(yb * W + x) * 3 + c];
      }
    }
}

const FILL = 0.2;

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  const n = S.n, tour = S.tour, col = S.col, cur = S.cur, acc = S.acc, xs = S.xs;
  const h0 = 0.47 + S.hue;
  // Colour by place along the tour, there and back so the ring has no seam.
  for (let p = 0; p < n; p++) hsv(h0 + SPAN * (0.5 - 0.5 * cos(2 * PI * (p / n + S.phi))), col, p * 3);
  cur.fill(0);
  // The tour.
  const ca = S.ca, cb = S.cb;
  for (let p = 0; p < n; p++) {
    const q = p + 1 === n ? 0 : p + 1, a = tour[p], b = tour[q];
    for (let c = 0; c < 3; c++) (ca[c] = col[p * 3 + c]), (cb[c] = col[q * 3 + c]);
    line(S, S.x[a], S.y[a], S.x[b], S.y[b], ca, cb, 0.85);
  }
  // The colour of the nearby loop, blurred, to fill the inside with.
  blur(cur, S.bl, S.tmp);
  const bl = S.bl;
  // The inside of the loop, by the even-odd rule, row by row.
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5;
    let m = 0;
    for (let p = 0; p < n; p++) {
      const a = tour[p], b = tour[p + 1 === n ? 0 : p + 1];
      const ya = S.y[a], yb = S.y[b];
      if ((ya <= yc && yc < yb) || (yb <= yc && yc < ya)) {
        const x = S.x[a] + ((yc - ya) * (S.x[b] - S.x[a])) / (yb - ya);
        let q = m++;
        while (q > 0 && xs[q - 1] > x) (xs[q] = xs[q - 1]), q--;
        xs[q] = x;
      }
    }
    for (let q = 0; q + 1 < m; q += 2) {
      const x0 = max(0, Math.ceil(xs[q] - 0.5)), x1 = min(W - 1, floor(xs[q + 1] - 0.5));
      for (let x = x0; x <= x1; x++) {
        const o = (y * W + x) * 3, r = bl[o], g = bl[o + 1], b = bl[o + 2], top = max(r, g, b);
        const f = top > 1e-4 ? FILL / top : 0;
        cur[o] = max(cur[o], top > 1e-4 ? r * f : FILL * col[0]);
        cur[o + 1] = max(cur[o + 1], top > 1e-4 ? g * f : FILL * col[1]);
        cur[o + 2] = max(cur[o + 2], top > 1e-4 ? b * f : FILL * col[2]);
      }
    }
  }
  // The cities, pale versions of their colour.
  for (let p = 0; p < n; p++) {
    const a = tour[p], x = floor(S.x[a]), y = floor(S.y[a]), o = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) cur[o + c] = 0.55 + 0.45 * col[p * 3 + c];
  }
  // The temperature, on a log scale from T1 to T0 city spacings.
  const hot = cl(log(S.T / S.unit / T1) / log(T0 / T1), 0, 1), g = hot * W;
  for (let x = 0; x < W; x++) {
    const o = (GY * W + x) * 3, w = 0.8 * (x < g ? 1 : x < g + 1 ? g - x : 0);
    cur[o] = max(cur[o], w * (0.45 + 0.55 * hot));
    cur[o + 1] = max(cur[o + 1], w * (0.7 + 0.1 * hot));
    cur[o + 2] = max(cur[o + 2], w * (1 - 0.45 * hot));
  }
  // A short afterglow while it is hot, so the tangle reads as a web.
  const keep = 0.55 * hot;
  for (let i = 0; i < NP * 3; i++) acc[i] = acc[i] * keep + cur[i] * (1 - keep);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, min(255, round(acc[o] * 255)), min(255, round(acc[o + 1] * 255)), min(255, round(acc[o + 2] * 255)));
    }
}
