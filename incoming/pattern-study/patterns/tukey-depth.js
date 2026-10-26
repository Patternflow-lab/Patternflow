// ===== Patternflow pattern =====
// Title:   Tukey Depth
// Family:  data
// Idea:    Thirty drifting points colour every LED by its Tukey depth, the fewest of them in any closed half-plane holding it, so the cloud stands as nested convex polygons each one point deeper than the last, and every eight seconds two of the points fly 160 LEDs off the panel, pulling the outer polygons after them as wedges and the orange mean out of the core, while the white ring of the Tukey median, the centroid of the deepest polygon, barely moves.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: halfspace depth and the Tukey median (John W. Tukey, 1975), centerpoint theorem (Richard Rado, 1946), breakdown point of the Tukey median (David L. Donoho and Miriam Gasko, 1992), pattern round 58
// Round:   58
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Points=30..90, Outliers=0..0.4
//
// Knob 1: Hue. Turns the regions' colours round the wheel together. At 0 they run from violet at the hull through blue to aqua at the deepest, and the mean is orange; at 0.25 from red through magenta and violet to a blue core, the mean green; at 0.5 from green through yellow and red to violet, the mean blue; at 0.75 from blue through teal and green to yellow, the mean pink. The points and the median's ring stay white.
// Knob 2: Speed. At 2 each coordinate of a point is a sum of three sines with periods between 15 and 63 s, and an outing takes 8 s: the outliers fly out in 1.5 s, stay out 4.5 s while their group swings round the middle a quarter of a radian a second, and come back in 1.5 s; each new set leaves 137 degrees further round than the last. 0.2 is ten times slower, 3 one and a half times faster.
// Knob 3: Points. 30 to 90 points. Each level is one point deeper, so the deepest region sits at depth 11 to 14 with 30 points, 25 to 28 with 60 and 38 to 42 with 90, never under the third of the points the centerpoint theorem promises (10, 20, 30), and the bands grow finer as the count rises.
// Knob 4: Outliers. The share of the points that fly out each outing, rounded: 2 of 30 at the opening 0.06. They go 160 LEDs from the middle, well off the panel; with 2 of 30 the mean moves 11 LEDs on average and the median 2.6, and measured in the clean data the median keeps 89% of the deepest depth while the mean keeps 40%. At 0.2 (6 of 30) the mean moves 32 LEDs and the median 7. Past a third, the breakdown point, the median gives way too: at 0.34 (10 of 30) it moves 49 LEDs and at 0.4 it leaves the panel with the outliers. A mean dragged off the panel waits on its rim.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, round, ceil, PI } = Math;
const random = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const NMAX = 90;
// One outing of the outliers, in T (seconds at Speed 2).
const OUT = 8;
// How far out the outliers go: two and a half half-heights of the panel.
const FAR = 160;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// Dim orange and yellow read brown and olive, so the wheel skips them.
const wheel = (h) => 0.18 + 0.85 * (h - 0.18 - floor(h - 0.18));

export function setup(params) {
  const pts = [];
  for (let i = 0; i < NMAX; i++) {
    // Each point's place in the cloud is three sines a coordinate at slow
    // frequencies of its own, scaled to unit variance.
    const f = [], ph = [];
    for (let m = 0; m < 6; m++) {
      f.push(0.1 + 0.32 * random());
      ph.push(2 * PI * random());
    }
    pts.push({ f, ph, w: 0, jx: 2 * PI * random(), jy: 2 * PI * random(), jf: 0.5 + 0.5 * random() });
  }
  params.s = {
    hue: 0, speed: 2, n: 30, out: 0.06, T: 0, pts,
    px: new Float64Array(NMAX), py: new Float64Array(NMAX),
    depth: new Uint8Array(W * H), polys: [], kmax: 0,
    mx: 32, my: 64, tx: 32, ty: 64, trail: new Float32Array(180).fill(-99), ti: 0, pal: new Float32Array(3 * 64), c: new Float32Array(3),
  };
}

// Keep nx x + ny y <= c of a convex polygon [x0, y0, x1, y1, ...].
function clip(P, nx, ny, c) {
  const out = [], m = P.length, eps = 1e-9 * (abs(nx) + abs(ny) + abs(c));
  for (let i = 0; i < m; i += 2) {
    const j = (i + 2) % m, ax = P[i], ay = P[i + 1], bx = P[j], by = P[j + 1];
    const da = nx * ax + ny * ay - c, db = nx * bx + ny * by - c;
    if (da <= eps) out.push(ax, ay);
    if ((da < -eps && db > eps) || (da > eps && db < -eps)) {
      const t = da / (da - db);
      out.push(ax + t * (bx - ax), ay + t * (by - ay));
    }
  }
  return out;
}

// A cheap hash of a point and an outing, 0..1, to choose who flies out.
const rank = (i, c) => {
  const v = sin(i * 12.9898 + c * 78.233) * 43758.5453;
  return v - floor(v);
};

function place(S) {
  const { pts, px, py, n, T } = S;
  // The cloud: an upright ellipse that sways a little.
  const th = 0.3 * sin(0.13 * T), ct = cos(th), st = sin(th);
  const cx = 32 + 2 * sin(0.21 * T + 1), cy = 64 + 4 * sin(0.17 * T);
  // The outliers go out together every OUT seconds of T, a new set each
  // time, FAR LEDs from the middle, well off the panel, drift round there
  // and come back for the last quarter of the outing.
  const c = floor(T / OUT), psi = 2.4 * c + 0.25 * (T - c * OUT);
  const gx = 32 + FAR * cos(psi), gy = 64 + FAR * sin(psi);
  const k = sqrt(2 / 3);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    let zx = 0, zy = 0;
    for (let q = 0; q < 3; q++) {
      zx += sin(p.f[q] * T + p.ph[q]);
      zy += sin(p.f[q + 3] * T + p.ph[q + 3]);
    }
    zx *= k * 10;
    zy *= k * 19;
    let x = cx + ct * zx - st * zy, y = cy + st * zx + ct * zy;
    const w = p.w;
    if (w > 0) {
      const ox = gx + 4 * sin(p.jf * T + p.jx), oy = gy + 4 * sin(p.jf * T + p.jy);
      const e = w * w * (3 - 2 * w);
      x += e * (ox - x);
      y += e * (oy - y);
    }
    px[i] = x;
    py[i] = y;
  }
}

// The regions {depth >= k}. A line through two data points with a points
// strictly on one side and b on the other puts every LED strictly on the
// a side at depth a or less, so {depth >= a + 1} lies in the closed other
// side; {depth >= k} is exactly the intersection of all those half-planes,
// one convex polygon for each k, each inside the one before.
function regions(S) {
  const { px, py, n } = S, half = n >> 1;
  const lev = Array.from({ length: half + 2 }, () => []);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const nx = py[i] - py[j], ny = px[j] - px[i], c0 = nx * px[i] + ny * py[i];
      let a = 0, b = 0;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        const s = nx * px[k] + ny * py[k] - c0;
        if (s > 0) a++;
        else if (s < 0) b++;
      }
      if (a <= b) lev[a + 1].push(nx, ny, c0);
      if (b <= a) lev[b + 1].push(-nx, -ny, -c0);
    }
  let P = [-500, -500, 600, -500, 600, 700, -500, 700];
  const polys = [];
  for (let k = 1; k <= half + 1; k++) {
    const L = lev[k];
    for (let q = 0; q < L.length && P.length; q += 3) P = clip(P, L[q], L[q + 1], L[q + 2]);
    if (!P.length) break;
    polys.push(P);
  }
  S.polys = polys;
  S.kmax = polys.length;
  // The Tukey median: the centroid of the deepest region.
  const D = polys[polys.length - 1] || [32, 64];
  let A = 0, gx = 0, gy = 0, vx = 0, vy = 0;
  for (let i = 0; i < D.length; i += 2) {
    const j = (i + 2) % D.length, cr = D[i] * D[j + 1] - D[j] * D[i + 1];
    A += cr;
    gx += (D[i] + D[j]) * cr;
    gy += (D[i + 1] + D[j + 1]) * cr;
    vx += D[i];
    vy += D[i + 1];
  }
  if (abs(A) > 1e-6) {
    S.tx = gx / (3 * A);
    S.ty = gy / (3 * A);
  } else {
    S.tx = vx / (D.length / 2);
    S.ty = vy / (D.length / 2);
  }
  // Every LED's depth, row by row from the polygons.
  const depth = S.depth;
  depth.fill(0);
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5, row = y * W;
    for (let k = 0; k < polys.length; k++) {
      const P = polys[k];
      let lo = 1e9, hi = -1e9;
      for (let i = 0; i < P.length; i += 2) {
        const j = (i + 2) % P.length, y1 = P[i + 1], y2 = P[j + 1];
        if ((y1 <= yc && yc < y2) || (y2 <= yc && yc < y1)) {
          const x = P[i] + ((yc - y1) * (P[j] - P[i])) / (y2 - y1);
          if (x < lo) lo = x;
          if (x > hi) hi = x;
        }
      }
      if (hi < lo) break;
      const x0 = max(0, ceil(lo - 0.5)), x1 = min(W - 1, floor(hi - 0.5));
      for (let x = x0; x <= x1; x++) depth[row + x] = k + 1;
    }
  }
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    sx += px[i];
    sy += py[i];
  }
  S.mx = sx / n;
  S.my = sy / n;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.n = round(cl(k[2], 30, 90));
  S.out = cl(k[3], 0, 0.4);
  S.T += d * S.speed * 0.5;
  const m = round(S.out * S.n), c = floor(S.T / OUT), out = S.T / OUT - c < 0.75;
  // This outing's outliers: the m points of lowest rank.
  const order = [];
  for (let i = 0; i < S.n; i++) order.push(i);
  order.sort((a, b) => rank(a, c) - rank(b, c));
  const want = new Uint8Array(NMAX);
  if (out) for (let q = 0; q < m; q++) want[order[q]] = 1;
  // A point flies out or comes back over 1.5 s.
  for (let i = 0; i < NMAX; i++) {
    const p = S.pts[i];
    p.w = want[i] ? min(1, p.w + d * S.speed / 3) : max(0, p.w - d * S.speed / 3);
  }
  place(S);
  regions(S);
  S.ti = (S.ti + 1) % 90;
  S.trail[2 * S.ti] = S.mx;
  S.trail[2 * S.ti + 1] = S.my;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { depth, pal, n } = S, half = n / 2, h = S.hue;
  // Level k: hue from violet at the hull to aqua at the deepest, brighter
  // inwards. Each region's rim is at full, its fill at 59% on odd levels
  // and 37% on even ones, so neighbouring levels always differ.
  const K = S.kmax;
  for (let k = 1; k <= K; k++) {
    const u = min(1, k / half);
    hsv(wheel(0.95 + h - 0.5 * u), 0.85 - 0.35 * u, 0.5 + 0.5 * u, pal, 3 * k);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, k = depth[p];
      if (!k) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      // An LED of {depth >= k} next to a shallower one is the polygon's rim.
      const rim = (x > 0 && depth[p - 1] < k) || (x < W - 1 && depth[p + 1] < k) || (y > 0 && depth[p - W] < k) || (y < H - 1 && depth[p + W] < k);
      const g = rim ? 255 : k & 1 ? 150 : 95;
      display.setPixel(x, y, round(pal[3 * k] * g), round(pal[3 * k + 1] * g), round(pal[3 * k + 2] * g));
    }
  const c = S.c;
  hsv(0.1 + h, 0.8, 1, c, 0);
  const put = (x, y, r, g, b) => {
    if (x >= 0 && x < W && y >= 0 && y < H) display.setPixel(x, y, r, g, b);
  };
  // Where the mean has been over the last three seconds, fading.
  const tr = S.trail, L = tr.length / 2;
  for (let q = 0; q < L; q++) {
    const a = ((S.ti - q + L) % L) * 2, f = 1 - 0.75 * q / L;
    if (tr[a] < -50) continue;
    put(floor(tr[a]), floor(tr[a + 1]), round(c[0] * 255 * f), round(c[1] * 255 * f), round(c[2] * 255 * f));
  }
  // The data: white dots.
  for (let i = 0; i < n; i++) put(floor(S.px[i]), floor(S.py[i]), 255, 255, 255);
  // The mean: an orange plus with a black rim, held on the panel when the
  // outliers drag it off.
  const mx = cl(floor(S.mx), 2, W - 3), my = cl(floor(S.my), 2, H - 3);
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [1, -2], [-1, 2], [1, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]])
    put(mx + dx, my + dy, 0, 0, 0);
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]])
    put(mx + dx, my + dy, round(c[0] * 255), round(c[1] * 255), round(c[2] * 255));
  // The Tukey median: a white ring with a black inside.
  const tx = floor(S.tx), ty = floor(S.ty);
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      const r = sqrt(dx * dx + dy * dy);
      if (r > 1.9 && r < 3.1) put(tx + dx, ty + dy, 255, 255, 255);
      else if (r <= 1.9) put(tx + dx, ty + dy, 0, 0, 0);
    }
}
