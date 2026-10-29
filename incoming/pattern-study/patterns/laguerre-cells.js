// ===== Patternflow pattern =====
// Title:   Laguerre Cells
// Family:  cells
// Idea:    Points scattered over the panel each own a Laguerre cell, the LEDs where |x - p|^2 - w is least, and Newton steps on the Kantorovich dual move the weights w until every cell holds the same share of a density that glows in three soft bumps, so the cells shrink to a fine mesh where it is dense and swell where it is thin while their edges stay straight; each cell is tinted by its mass error, violet while it holds too much and green while it holds too little, and every few seconds the bumps move and the cells chase them again.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: power diagrams (Franz Aurenhammer, 1987), the Laguerre-Voronoi diagram of the power distance; cells of prescribed mass found by minimising a convex function of the weights (Aurenhammer, Hoffmann and Aronov, 1998); the damped Newton method for semi-discrete optimal transport (Jun Kitagawa, Quentin Mérigot and Boris Thibert, 2019); pattern round 70
// Round:   70
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Cells=24..64, Contrast=-1..1
//
// Knob 1: Hue. Turns three colours round the wheel together, a settled cell in the middle and a cell holding too much and too little 0.24 either side: at 0 teal, violet and green, at 0.25 violet, red and cyan, at 0.5 red, chartreuse and violet.
// Knob 2: Speed. Each frame the weights take a share of the full Newton step, 1.5 times Speed a second, so at 2 a cell's error falls by a factor e every 0.33 s: the opening Voronoi diagram, whose fullest cell holds four times its share, is within 5% at 1.5 s and 2% at 2 s. A density holds 6 s and turns into the next in 1.6 s, the first at 4.4 s, while its bumps drift 2 LEDs round. At 0.2 all of it is ten times slower, at 3 half as fast again.
// Knob 3: Cells. 24 to 64 sites, scattered as the best of 24 random tries each; each whole step scatters a new set, starting from weights of 0. At 24 the largest settled cell is about 1,000 LEDs and the smallest under 100; at 64, 400 and 31.
// Knob 4: Contrast. The densest LED against the thinnest: 3 to 1 at -1, 12 to 1 at the opening 0.06, 40 to 1 at 1. At -1 the 24 settled cells run from 173 to 510 LEDs, at 1 from 58 to 1,350, and the cells away from the bumps grow spikes that reach between them.

// A power diagram gives each site p_i a weight w_i and each point x to the
// site with the least power |x - p_i|^2 - w_i. Two cells meet on a straight
// line, where the powers are equal, and raising w_i pushes that line away
// from p_i by (dw)/(2|p_i - p_j|). With all weights equal it is the Voronoi
// diagram. Aurenhammer, Hoffmann and Aronov showed that for any sites and
// any masses there are weights that give every cell its mass, the minimum
// of a convex function of the weights; that is the semi-discrete optimal
// transport of the density onto the sites with the cost |x - p|^2.
//
// The gradient of the dual is each cell's missing mass, m - mass_i, and its
// Hessian the matrix of edges: for cells i and j, the density along their
// common edge over 2|p_i - p_j|. An LED within half an LED of an edge
// splits its mass between the two cells by how far it lies across, which
// makes the mass move smoothly with the weights and gives those edge sums.
// Each frame conjugate gradients solve the Newton step and the weights take
// a share of it, so the errors fall smoothly enough to watch.
//
// A cell need not hold its own site. On this panel with 24 sites, 11 lie
// outside their settled cells at the opening density and 17 after the
// first change; with 64 sites it is 48 to 53.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, exp, cos, sin, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const MAXC = 64;
// Blocks of 8 by 8 LEDs, each with the sites that can own or border one of
// its LEDs.
const B = 8, BX = W / B, BY = H / B;
// Seconds at Speed 2: a density holds, then turns into the next.
const T_HOLD = 6, T_MORPH = 1.6, T_FIRST = 4.4;

function newSites(s, n) {
  s.n = n;
  const X = s.px, Y = s.py;
  // Best candidate: each new site the farthest of 24 tries from the others.
  for (let i = 0; i < n; i++) {
    let bx = 0, by = 0, bd = -1;
    for (let t = 0; t < 24; t++) {
      const x = 2 + Math.random() * (W - 4), y = 2 + Math.random() * (H - 4);
      let d = 1e9;
      for (let j = 0; j < i; j++) d = min(d, (x - X[j]) ** 2 + (y - Y[j]) ** 2);
      if (d > bd) (bd = d), (bx = x), (by = y);
    }
    X[i] = bx;
    Y[i] = by;
  }
  s.w.fill(0);
}

// A density: three soft bumps, a log-density f from 0 to 1 that the
// Contrast knob raises to a ratio of densest to thinnest.
function newBumps() {
  const b = [];
  for (let k = 0; k < 3; k++)
    b.push({ x: 8 + Math.random() * (W - 16), y: 10 + Math.random() * (H - 20), r: 9 + Math.random() * 9, a: k ? 0.55 + 0.45 * Math.random() : 1, ph: Math.random() * 2 * PI });
  return b;
}

export function setup(params) {
  const s = (params.s = {});
  s.px = new Float64Array(MAXC);
  s.py = new Float64Array(MAXC);
  s.w = new Float64Array(MAXC);
  s.mass = new Float64Array(MAXC);
  s.err = new Float64Array(MAXC);
  s.Hm = new Float64Array(MAXC * MAXC);
  s.rho = new Float32Array(N);
  s.f = new Float32Array(N);
  s.own = new Uint8Array(N);
  s.line = new Float32Array(N);
  s.cand = new Uint8Array(BX * BY * MAXC);
  s.cnt = new Uint8Array(BX * BY);
  s.cg = [new Float64Array(MAXC), new Float64Array(MAXC), new Float64Array(MAXC), new Float64Array(MAXC), new Float64Array(MAXC)];
  s.n = 0;
  s.A = newBumps();
  s.Bm = newBumps();
  s.clock = 0;
  s.next = T_FIRST;
  s.morph = -1;
  s.t = 0;
}

function density(s, lnR) {
  const { rho, f } = s, A = s.A, Bm = s.Bm;
  const m = s.morph < 0 ? 0 : s.morph * s.morph * (3 - 2 * s.morph);
  const bs = A.map((a, k) => {
    const b = Bm[k], dr = 2;
    return {
      x: a.x + (b.x - a.x) * m + dr * cos(s.t * 0.3 + a.ph),
      y: a.y + (b.y - a.y) * m + dr * sin(s.t * 0.22 + a.ph),
      r: a.r + (b.r - a.r) * m,
      a: a.a + (b.a - a.a) * m,
    };
  });
  // Each bump is a product of a row and a column Gaussian, and exp(lnR f)
  // is read from a table of 1025 steps.
  const gx = s.gx || (s.gx = new Float32Array(3 * W)), gy = s.gy || (s.gy = new Float32Array(3 * H));
  bs.forEach((b, k) => {
    const q = 1 / (2 * b.r * b.r);
    for (let x = 0; x < W; x++) gx[k * W + x] = b.a * exp(-((x + 0.5 - b.x) ** 2) * q);
    for (let y = 0; y < H; y++) gy[k * H + y] = exp(-((y + 0.5 - b.y) ** 2) * q);
  });
  const lut = s.lut || (s.lut = new Float32Array(1025));
  for (let j = 0; j <= 1024; j++) lut[j] = exp((lnR * j) / 1024);
  let tot = 0;
  for (let y = 0; y < H; y++) {
    const a0 = gy[y], a1 = gy[H + y], a2 = gy[2 * H + y];
    for (let x = 0; x < W; x++) {
      const v = min(1, a0 * gx[x] + a1 * gx[W + x] + a2 * gx[2 * W + x]), i = y * W + x;
      f[i] = v;
      tot += rho[i] = lut[round(v * 1024)];
    }
  }
  return tot;
}

// Power distance |x - p|^2 - w for every LED: the owner, the runner-up and
// how far the LED is from their common edge, in LEDs. An LED within half an
// LED of the edge splits its mass between the two, so a cell's mass moves
// smoothly with the weights, and the same LEDs give the derivatives.
function assign(s) {
  const { px, py, w, n, cand, cnt, rho, own, line, mass, Hm } = s;
  let wmax = -1e9;
  for (let i = 0; i < n; i++) wmax = max(wmax, w[i]);
  const r = B * 0.7072;
  for (let by = 0; by < BY; by++)
    for (let bx = 0; bx < BX; bx++) {
      const cx = bx * B + B / 2, cy = by * B + B / 2, blk = by * BX + bx;
      let U = 1e18;
      const dc = s.cg[4];
      for (let i = 0; i < n; i++) {
        const d = sqrt((px[i] - cx) ** 2 + (py[i] - cy) ** 2);
        dc[i] = d;
        U = min(U, (d + r) ** 2 - w[i]);
      }
      const reach = sqrt(max(0, U + wmax));
      let c = 0;
      for (let i = 0; i < n; i++) {
        const lb = max(0, dc[i] - r) ** 2 - w[i];
        if (lb - U < 2 * (reach + dc[i] + r) + 1) cand[blk * MAXC + c++] = i;
      }
      cnt[blk] = c;
    }
  mass.fill(0, 0, n);
  Hm.fill(0, 0, MAXC * MAXC);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const blk = (y >> 3) * BX + (x >> 3), c = cnt[blk], o = blk * MAXC;
      const X = x + 0.5, Y = y + 0.5;
      let b1 = 0, b2 = 0, d1 = 1e18, d2 = 1e18;
      for (let k = 0; k < c; k++) {
        const i = cand[o + k], d = (X - px[i]) ** 2 + (Y - py[i]) ** 2 - w[i];
        if (d < d1) (d2 = d1), (b2 = b1), (d1 = d), (b1 = i);
        else if (d < d2) (d2 = d), (b2 = i);
      }
      const p = y * W + x, q = rho[p];
      own[p] = b1;
      let gap = 99;
      if (c > 1) {
        const sep = 2 * sqrt((px[b1] - px[b2]) ** 2 + (py[b1] - py[b2]) ** 2);
        gap = (d2 - d1) / sep;
        if (gap < 0.5) {
          const sh = 0.5 + gap, h = q / sep;
          mass[b1] += q * sh;
          mass[b2] += q * (1 - sh);
          Hm[b1 * MAXC + b1] += h;
          Hm[b2 * MAXC + b2] += h;
          Hm[b1 * MAXC + b2] -= h;
          Hm[b2 * MAXC + b1] -= h;
        } else mass[b1] += q;
      } else mass[b1] += q;
      line[p] = gap;
    }
}

// Newton on the Kantorovich dual: the gradient is each cell's missing mass,
// the Hessian the matrix of edge densities just gathered. Conjugate
// gradients solve H d = (m - mass); the weights move a damped share of d.
function newton(s, m, step) {
  const { n, Hm, w, mass, err } = s;
  const [r, z, p, Ap] = s.cg;
  let typ = 0, cntH = 0;
  for (let i = 0; i < n; i++) if (Hm[i * MAXC + i] > 0) (typ += Hm[i * MAXC + i]), cntH++;
  typ = cntH ? typ / cntH : 1;
  const eps = 1e-4 * typ;
  for (let i = 0; i < n; i++) {
    err[i] = mass[i] / m - 1;
    r[i] = m - mass[i];
    // A cell with no edge in use yet gets a diagonal, so it grows back.
    if (Hm[i * MAXC + i] <= 0) Hm[i * MAXC + i] = 0.3 * typ;
  }
  const dw = s.dw || (s.dw = new Float64Array(MAXC));
  dw.fill(0, 0, n);
  const pre = (i) => 1 / (Hm[i * MAXC + i] + eps);
  // The matrix as lists of each cell's neighbours, about six apiece.
  const nb = s.nb || (s.nb = new Uint8Array(MAXC * MAXC)), nc = s.nc || (s.nc = new Uint8Array(MAXC));
  for (let i = 0; i < n; i++) {
    let c = 0;
    for (let j = 0; j < n; j++) if (Hm[i * MAXC + j] !== 0) nb[i * MAXC + c++] = j;
    nc[i] = c;
  }
  let rz = 0;
  for (let i = 0; i < n; i++) (z[i] = r[i] * pre(i)), (p[i] = z[i]), (rz += r[i] * z[i]);
  const r0 = rz;
  for (let it = 0; it < 60 && rz > 1e-10 * r0; it++) {
    let pAp = 0;
    for (let i = 0; i < n; i++) {
      let v = eps * p[i];
      const row = i * MAXC;
      for (let k = 0; k < nc[i]; k++) {
        const j = nb[row + k];
        v += Hm[row + j] * p[j];
      }
      Ap[i] = v;
      pAp += p[i] * v;
    }
    if (pAp <= 0) break;
    const al = rz / pAp;
    let rz2 = 0;
    for (let i = 0; i < n; i++) {
      dw[i] += al * p[i];
      r[i] -= al * Ap[i];
      z[i] = r[i] * pre(i);
      rz2 += r[i] * z[i];
    }
    const be = rz2 / rz;
    rz = rz2;
    for (let i = 0; i < n; i++) p[i] = z[i] + be * p[i];
  }
  // No weight moves more than a third of a cell's mean area in one frame.
  const lim = N / n / 3;
  let mean = 0;
  for (let i = 0; i < n; i++) {
    w[i] += cl(step * dw[i], -lim, lim);
    mean += w[i];
  }
  mean /= n;
  for (let i = 0; i < n; i++) w[i] -= mean;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 24, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  s.hue = k[0] || 0;
  const sp = cl(k[1], 0.2, 3), rate = sp / 2;
  const n = round(cl(k[2], 24, 64));
  const lnR = 2.4 + 1.3 * cl(k[3] || 0, -1, 1);
  if (n !== s.n) newSites(s, n);
  s.t += dt * rate;
  // The density holds, then turns into the next one.
  s.clock += dt * rate;
  if (s.morph < 0 && s.clock >= s.next) s.morph = 0;
  if (s.morph >= 0) {
    s.morph += (dt * rate) / T_MORPH;
    if (s.morph >= 1) {
      s.A = s.Bm;
      s.Bm = newBumps();
      s.morph = -1;
      s.next = s.clock + T_HOLD;
    }
  }
  const tot = density(s, lnR);
  assign(s);
  newton(s, tot / n, min(1, 1.5 * sp * dt));
}

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.n) return;
  const { n, own, line, f, err, px, py } = s;
  const col = s.col || (s.col = new Float64Array(MAXC * 3));
  const h0 = 0.5 + s.hue;
  for (let i = 0; i < n; i++) {
    const e = cl(err[i] * 3, -1, 1);
    hsv(h0 + 0.24 * e, 0.55 + 0.3 * abs(e), 1, col, i * 3);
  }
  const F = s.F || (s.F = new Float32Array(N * 3));
  for (let p = 0; p < N; p++) {
    const i = own[p], v = 55 + 150 * f[p], g = line[p], L = g < 1 ? 1 - g : 0;
    const o = p * 3, c = i * 3;
    F[o] = col[c] * v * (1 - L) + 215 * L;
    F[o + 1] = col[c + 1] * v * (1 - L) + 215 * L;
    F[o + 2] = col[c + 2] * v * (1 - L) + 215 * L;
  }
  // The sites, dim: most of them end up outside their own cells.
  for (let i = 0; i < n; i++) {
    const o = (floor(py[i]) * W + floor(px[i])) * 3;
    F[o] = F[o + 1] = F[o + 2] = 150;
  }
  for (let p = 0; p < N; p++) display.setPixel(p % W, (p / W) | 0, min(255, round(F[p * 3])), min(255, round(F[p * 3 + 1])), min(255, round(F[p * 3 + 2])));
}
