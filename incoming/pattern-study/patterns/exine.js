// ===== Patternflow pattern =====
// Title:   Exine
// Family:  palynology
// Idea:    A false-colour scanning electron micrograph of pollen grains on a dark stage, six to nine round bodies 10 to 30 LEDs across at three depths, each shaded as a real sphere and each a different wall: a ball bristling with spines, a tricolpate grain whose wall is a net of ridges cut by three meridian furrows, a grain pitted with round pores, and one with a ring furrow, all tumbling slowly while the stage pans through an endless field so that grains enter, turn and leave and the picture never repeats.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: The exine, the sculptured outer wall of a pollen grain that palynologists name species by (Gunnar Erdtman, pollen morphology, 1943 and 1952), seen the way the scanning electron microscope draws it (Max Knoll 1935, Manfred von Ardenne 1938, the Everhart-Thornley secondary-electron detector 1960, whose signal rises as 1 over the cosine of the tilt so that edges and steep slopes glow), the cellular noise whose second nearest minus nearest distance draws a net (Steven Worley, 1996) and the Fibonacci lattice of points on a sphere (Alvaro Gonzalez, 2010); each grain is an analytic orthographic ray-sphere, the spines are tapered strokes depth-sorted against the body, the colpi, the pores and the net are functions of the rotated normal; the tumbling on wandering axes, the endless hashed stage with depth parallax, the focus rack and the duotone false colour are original, pattern round 257
// Round:   257
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spin=0..3, Relief=-1..1, Focus=-1..1
//
// Knob 1: Hue. 0 to 1, opening at 0. Turns the colours of all the grains round the wheel together. At 0 the six colours of the stage are gold, violet, cyan, rose, orange and azure, and every grain keeps its own; at 0.33 gold has gone to green and violet to rose, and at 1 it is back.
// Knob 2: Spin. 0 to 3, opening at 2. How fast the grains tumble and the stage pans, together. At 2 a front grain turns at 0.07 to 0.17 radians a second, so its sculpture crosses the disc at 1 to 2 LEDs a second, and the stage slides 2.4 LEDs a second up the panel, the far grains at 0.46 of that; at 3 it is half as fast again; at 0 the stage stands still and only the scan lines and the charging of the spines go on.
// Knob 3: Relief. -1 to 1, opening at 0. How deep the sculpture is, from smooth almost-spherical grains at -1 (spines 0.05 of the radius long, ridges, rims and furrows nearly flat) to bristling at 1 (spines 0.45 of the radius, sharp ridges, deep pits and furrows).
// Knob 4: Focus. -1 to 1, opening at 0.06. Which depth is sharp. At -1 the far grains are in focus and the near ones go soft and dim, at 0.06 the middle ones are sharp, at 1 the near ones are and the far ones fade into a blur; the knob racks the focus through the field.

const W = 64, H = 128;
const { floor, ceil, min, max, sin, cos, exp, sqrt, abs, acos, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const F = (n) => new Float32Array(n);

// ---- tunables
const HUE0 = [0.115, 0.775, 0.525, 0.945, 0.07, 0.6]; // gold, violet, cyan, rose, orange, azure
const NL = 96; // entries of a colour ramp
const MAXSZ = 76; // largest local buffer, LEDs a side
const PADB = 4; // how far past the panel a grain is still worked, for the blur
// the detector sits up, left and in front of the specimen
const DX = -0.5, DY = -0.62, DZ = 0.6;
const GLOW = 0.14; // the halo round a grain
// depth layers: how fast each pans, how big its cells and grains are, how dim
const LAYERS = [
  { rate: 0.46, cw: 42, ch: 46, occ: 0.9, r0: 6.2, r1: 8.8, z0: 0.0, z1: 0.3, dim: 0.86 },
  { rate: 0.74, cw: 58, ch: 64, occ: 0.95, r0: 9.0, r1: 12.2, z0: 0.36, z1: 0.64, dim: 0.94 },
  { rate: 1.0, cw: 74, ch: 82, occ: 0.98, r0: 12.0, r1: 15.4, z0: 0.72, z1: 1.0, dim: 1.0 },
];

// ---- small maths
function ihash(a, b, c, s) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1) ^ Math.imul(s | 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}
function rot(o, x, y, z, ang) {
  const c = cos(ang), s = sin(ang), t = 1 - c;
  o[0] = t * x * x + c; o[1] = t * x * y - s * z; o[2] = t * x * z + s * y;
  o[3] = t * x * y + s * z; o[4] = t * y * y + c; o[5] = t * y * z - s * x;
  o[6] = t * x * z - s * y; o[7] = t * y * z + s * x; o[8] = t * z * z + c;
}
function mul3(o, a, b) {
  o[0] = a[0] * b[0] + a[1] * b[3] + a[2] * b[6]; o[1] = a[0] * b[1] + a[1] * b[4] + a[2] * b[7]; o[2] = a[0] * b[2] + a[1] * b[5] + a[2] * b[8];
  o[3] = a[3] * b[0] + a[4] * b[3] + a[5] * b[6]; o[4] = a[3] * b[1] + a[4] * b[4] + a[5] * b[7]; o[5] = a[3] * b[2] + a[4] * b[5] + a[5] * b[8];
  o[6] = a[6] * b[0] + a[7] * b[3] + a[8] * b[6]; o[7] = a[6] * b[1] + a[7] * b[4] + a[8] * b[7]; o[8] = a[6] * b[2] + a[7] * b[5] + a[8] * b[8];
}
function hsv(h, s, v, out) {
  h -= floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[0] = f(5); out[1] = f(3); out[2] = f(1);
}

// n points on the unit sphere on a Fibonacci lattice, each nudged by jit of the mean spacing
function fib(n, jit, r) {
  const o = F(3 * n);
  const sp = sqrt(4 * PI / n);
  for (let k = 0; k < n; k++) {
    const z = 1 - (2 * k + 1) / n, rho = sqrt(max(0, 1 - z * z)), ph = k * 2.399963229728653;
    let x = rho * cos(ph) + (r() - 0.5) * 2 * jit * sp;
    let y = rho * sin(ph) + (r() - 0.5) * 2 * jit * sp;
    let zz = z + (r() - 0.5) * 2 * jit * sp;
    const il = 1 / sqrt(x * x + y * y + zz * zz);
    o[3 * k] = x * il; o[3 * k + 1] = y * il; o[3 * k + 2] = zz * il;
  }
  return o;
}

// ---- one grain of the stage, made from its cell and nothing else
function makeGrain(st, li, gi, gj) {
  let a = ihash(li, gi, gj, st.seed);
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const L = LAYERS[li];
  const g = { occ: r() < L.occ, li, last: 0 };
  if (!g.occ) return g;
  g.x0 = (gi + 0.5 + (r() - 0.5) * 0.46) * L.cw;
  g.y0 = (gj + 0.5 + (r() - 0.5) * 0.46) * L.ch;
  const R = (g.R = L.r0 + (L.r1 - L.r0) * r());
  g.z = L.z0 + (L.z1 - L.z0) * r();
  const tr = r();
  // neighbouring cells tend to differ in kind: a lattice of the four, loosened by chance
  g.type = r() < 0.35 ? (tr < 0.28 ? 0 : tr < 0.54 ? 1 : tr < 0.78 ? 2 : 3) : ((((gi * 3 + gj + li * 2 + st.slot0) % 4) + 4) % 4);
  const slot = (((gi * 5 + gj * 3 + li * 2 + st.slot0 + (r() < 0.5 ? 0 : 1)) % 6) + 6) % 6;
  g.hue = HUE0[slot] + (r() - 0.5) * 0.04;
  g.gain = 0.9 + 0.12 * r();
  // orientation: a start, a precessing axis, a fixed second axis, each on its own clocks
  const ax = r() * 2 - 1, ay = r() * 2 - 1, az = r() * 2 - 1;
  const al = 1 / sqrt(ax * ax + ay * ay + az * az + 1e-9);
  g.M = F(9); g.M0 = F(9); g.T = F(9); g.R1 = F(9); g.R2 = F(9);
  rot(g.M0, ax * al, ay * al, az * al, r() * TP);
  g.a1 = 0.4 + r() * 2.3; g.b1 = r() * TP;
  g.pa = 0.011 + 0.018 * r(); g.pb = 0.013 + 0.024 * r(); g.wb = (0.004 + 0.016 * r()) * (r() < 0.5 ? -1 : 1);
  g.q1 = r() * TP; g.q2 = r() * TP; g.q3 = r() * TP; g.q4 = r() * TP;
  g.w1 = (0.07 + 0.1 * r()) * (r() < 0.5 ? -1 : 1);
  g.sp1 = 0.021 + 0.036 * r();
  const bx = r() * 2 - 1, by = r() * 2 - 1, bz = r() * 2 - 1;
  const bl = 1 / sqrt(bx * bx + by * by + bz * bz + 1e-9);
  g.ax2 = bx * bl; g.ay2 = by * bl; g.az2 = bz * bl;
  g.w2 = (0.03 + 0.06 * r()) * (r() < 0.5 ? -1 : 1);
  g.sp2 = 0.017 + 0.033 * r();
  g.ph0 = r() * TP; // where the first furrow runs
  // the sculpture
  if (g.type === 0) {
    g.ns = cl(Math.round(R * R * 0.32), 30, 90);
    g.dir = fib(g.ns, 0.28, r);
    g.sp = F(5 * g.ns);
    for (let k = 0; k < g.ns; k++) {
      g.sp[5 * k] = 0.7 + 0.6 * r(); g.sp[5 * k + 1] = r() * TP; g.sp[5 * k + 2] = 0.5 + r();
      g.sp[5 * k + 3] = r() * TP; g.sp[5 * k + 4] = 0.05 + 0.16 * r();
    }
  } else if (g.type === 1) {
    g.np = cl(Math.round(4 * PI * R * R / 34), 22, 120);
    g.pts = fib(g.np, 0.32, r);
    g.sc = sqrt(4 * PI / g.np);
  } else if (g.type === 2) {
    g.np = cl(Math.round(R * 1.7), 12, 28);
    g.pts = fib(g.np, 0.14, r);
    g.rho = 0.37 * sqrt(4 * PI / g.np);
  } else {
    g.np = cl(Math.round(4 * PI * R * R / 30), 20, 110);
    g.pts = fib(g.np, 0.3, r);
    g.sc = sqrt(4 * PI / g.np);
    g.c0 = (r() - 0.5) * 0.2; // the ring runs a little off the equator
  }
  return g;
}

function orient(g, tau) {
  const a1 = g.a1 + 0.8 * sin(g.pa * tau + g.q1);
  const b1 = g.b1 + g.wb * tau + 0.6 * sin(g.pb * tau + g.q4);
  const sa = sin(a1);
  rot(g.R1, sa * cos(b1), sa * sin(b1), cos(a1), g.w1 * (tau + 5 * sin(g.sp1 * tau + g.q2)));
  rot(g.R2, g.ax2, g.ay2, g.az2, g.w2 * (tau + 4 * sin(g.sp2 * tau + g.q3)));
  mul3(g.T, g.R1, g.R2);
  mul3(g.M, g.T, g.M0);
}

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, t: 0, tau: 0,
    seed: floor(Math.random() * 1e9), slot0: floor(Math.random() * 6),
    panX: Math.random() * 500, panY: Math.random() * 500,
    cache: new Map(), vis: [], FR: F(W * H * 3),
    rel: 0.5, foc: 0.53, hue: 0, rowMod: F(H),
    cx1: F(W), cx2: F(W), ry1: F(H), ry2: F(H),
    lut: F(3 * NL), lut2: F(3),
    BUF: F(4 * MAXSZ * MAXSZ), TMP: F(4 * MAXSZ * MAXSZ),
    FX: F(160), FY: F(160), FZ: F(160),
    SX: F(100), SY: F(100), SZ: F(100),
    MK: F(9), UK: F(9),
    nVis: 0,
  });
  return st;
}

function getGrain(st, li, gi, gj) {
  const key = (li * 8192 + (gi + 4096)) * 8192 + (gj + 4096);
  let g = st.cache.get(key);
  if (!g) {
    g = makeGrain(st, li, gi, gj);
    st.cache.set(key, g);
  }
  g.last = st.t;
  return g;
}

function step(st, dt, ks) {
  st.t += dt;
  const spin = cl(ks[1], 0, 3) * 0.5;
  const ds = dt * spin;
  const tau = (st.tau += ds);
  // the stage pans mostly one way, slowly, with a sideways wander that has no period
  const vy = 2.4 * (1 + 0.32 * sin(0.037 * tau + 0.6) + 0.14 * sin(0.0913 * tau + 2.1));
  const vx = 0.7 * (sin(0.0211 * tau + 1.3) + 0.6 * sin(0.0517 * tau + 0.2) + 0.3 * sin(0.1379 * tau));
  st.panY += vy * ds;
  st.panX += vx * ds;
  st.rel = cl((ks[2] + 1) * 0.5, 0, 1);
  st.foc = cl(0.5 + 0.5 * ks[3], 0, 1);
  st.hue = ks[0];
  // who is on the panel
  const vis = st.vis;
  vis.length = 0;
  for (let li = 0; li < 3; li++) {
    const L = LAYERS[li];
    const ox = st.panX * L.rate, oy = st.panY * L.rate;
    const i0 = floor((ox - 30) / L.cw - 0.3), i1 = ceil((ox + W + 30) / L.cw + 0.3);
    const j0 = floor((oy - 30) / L.ch - 0.3), j1 = ceil((oy + H + 30) / L.ch + 0.3);
    for (let gj = j0; gj <= j1; gj++) {
      for (let gi = i0; gi <= i1; gi++) {
        const g = getGrain(st, li, gi, gj);
        if (!g.occ) continue;
        const sx = g.x0 - ox, sy = g.y0 - oy;
        const ext = g.R * (g.type === 0 ? 1.6 : 1) + 6;
        if (sx < -ext || sx > W + ext || sy < -ext || sy > H + ext) continue;
        g.sx = sx; g.sy = sy;
        orient(g, tau);
        vis.push(g);
      }
    }
  }
  st.nVis = vis.length;
  if (st.cache.size > 140) {
    for (const [key, g] of st.cache) if (g.last < st.t - 3) st.cache.delete(key);
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    step(st, 1 / 30, st.ks);
  } else {
    const a = 1 - exp(-dt / 0.15);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  if (dt > 0) step(st, dt, st.ks);
}

// ---- drawing

// the duotone ramp of a grain: near-black, a saturated hue, a pale highlight
function buildLUT(lut, hue, dim) {
  const c = [0, 0, 0];
  hsv(hue, 1, 1, c);
  const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const gn = min(1.25, Math.pow(0.55 / max(lum, 0.08), 0.35)) * dim;
  const pr = c[0] + (1 - c[0]) * 0.74, pg = c[1] + (1 - c[1]) * 0.74, pb = c[2] + (1 - c[2]) * 0.74;
  for (let i = 0; i < NL; i++) {
    const s = i / (NL - 1);
    let r, g, b;
    if (s <= 0.56) {
      const u = s / 0.56, k = Math.pow(u, 1.15);
      r = c[0] * k; g = c[1] * k; b = c[2] * k;
    } else {
      let v = (s - 0.56) / 0.44;
      v = v * v * (3 - 2 * v);
      r = c[0] + (pr - c[0]) * v; g = c[1] + (pg - c[1]) * v; b = c[2] + (pb - c[2]) * v;
    }
    lut[3 * i] = r * gn; lut[3 * i + 1] = g * gn; lut[3 * i + 2] = b * gn;
  }
}

// a tapered stroke into the local buffer, over what is there
function seg(st, sz, lx0, lx1, ly0, ly1, ax, ay, bx, by, w0, w1, s0, s1, mul, al) {
  const BUF = st.BUF, lut = st.lut, AP = 3 * sz * sz, GP = sz * sz, BP = 2 * sz * sz;
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const il2 = l2 > 1e-6 ? 1 / l2 : 0;
  const wm = max(w0, w1) * 0.5 + 0.6;
  const x0 = max(lx0, floor(min(ax, bx) - wm)), x1 = min(lx1, ceil(max(ax, bx) + wm));
  const y0 = max(ly0, floor(min(ay, by) - wm)), y1 = min(ly1, ceil(max(ay, by) + wm));
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      let t = ((px - ax) * dx + (py - ay) * dy) * il2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - ax - t * dx, ey = py - ay - t * dy;
      let c = (w0 + (w1 - w0) * t) * 0.5 + 0.5 - sqrt(ex * ex + ey * ey);
      if (c <= 0) continue;
      if (c > 1) c = 1;
      c *= al;
      let s = (s0 + (s1 - s0) * t) * mul;
      s = s < 0 ? 0 : s > 1 ? 1 : s;
      const fi = s * (NL - 1), i0 = fi | 0, f = fi - i0, i1 = i0 + 1 < NL ? i0 + 1 : i0;
      const cr = lut[3 * i0] + (lut[3 * i1] - lut[3 * i0]) * f;
      const cg = lut[3 * i0 + 1] + (lut[3 * i1 + 1] - lut[3 * i0 + 1]) * f;
      const cb = lut[3 * i0 + 2] + (lut[3 * i1 + 2] - lut[3 * i0 + 2]) * f;
      const i = y * sz + x, ia = 1 - c;
      BUF[i] = BUF[i] * ia + cr * c;
      BUF[GP + i] = BUF[GP + i] * ia + cg * c;
      BUF[BP + i] = BUF[BP + i] * ia + cb * c;
      BUF[AP + i] = BUF[AP + i] * ia + c;
    }
  }
}

function spines(st, g, back, sz, lx0, lx1, ly0, ly1, cxl, cyl, Ls, rel) {
  const M = g.M, R = g.R, dir = g.dir, sp = g.sp, t = st.t;
  const w0 = cl(0.12 * R, 1.3, 2.0) * (0.65 + 0.35 * rel), w1 = 0.5 + 0.3 * rel;
  const am = 0.3 + 0.7 * sm(0, 0.35, rel);
  for (let k = 0; k < g.ns; k++) {
    const x = dir[3 * k], y = dir[3 * k + 1], z = dir[3 * k + 2];
    const vz = M[6] * x + M[7] * y + M[8] * z;
    if ((vz < 0) !== back) continue;
    const vx = M[0] * x + M[1] * y + M[2] * z, vy = M[3] * x + M[4] * y + M[5] * z;
    const o = 5 * k;
    const lit = max(0, vx * DX + vy * DY + vz * DZ);
    // charging: a slow shimmer on every spine and now and then one that flares
    const fl = 1 + 0.15 * sin(TP * (0.35 + 0.5 * sp[o + 2]) * t + sp[o + 1]) +
      4.0 * max(0, sin(TP * sp[o + 4] * t * 0.4 + sp[o + 3]) - 0.88);
    const L = Ls * sp[o];
    const ax = cxl + (R - 0.6) * vx, ay = cyl + (R - 0.6) * vy;
    const bx = cxl + (R + L) * vx, by = cyl + (R + L) * vy;
    // a front spine stands on the surface: a dark patch beside its foot, away from the detector
    if (!back && vz > 0.2) seg(st, sz, lx0, lx1, ly0, ly1, ax + 0.8, ay + 1.0, ax + 0.8 + 0.6 * (bx - ax), ay + 1.0 + 0.6 * (by - ay), w0 * 1.7, w0 * 1.0, 0.03, 0.03, 1, 0.5 * am);
    seg(st, sz, lx0, lx1, ly0, ly1, ax, ay, bx, by, w0, w1, 0.6 + 0.2 * lit, 0.88 + 0.2 * lit, fl * am * (back ? 0.6 : 1), 1);
  }
}

function renderGrain(st, g) {
  const R = g.R, rel = st.rel, M = g.M, BUF = st.BUF, lut = st.lut;
  const Ls = R * (0.03 + 0.53 * rel);
  const E = min(floor((MAXSZ - 1) / 2), ceil(R + (g.type === 0 ? Ls * 1.35 + 1 : 0) + 7));
  const sz = 2 * E + 1, GP = sz * sz, BP = 2 * GP, AP = 3 * GP;
  const bx0 = floor(g.sx) - E, by0 = floor(g.sy) - E;
  const lx0 = max(0, -PADB - bx0), lx1 = min(sz - 1, W - 1 + PADB - bx0);
  const ly0 = max(0, -PADB - by0), ly1 = min(sz - 1, H - 1 + PADB - by0);
  if (lx0 > lx1 || ly0 > ly1) return;
  BUF.fill(0, 0, 4 * GP);
  const cxl = g.sx - bx0, cyl = g.sy - by0;

  // focus: how far the grain is from the sharp plane
  const b = cl(6 * (abs(g.z - st.foc) - 0.26), 0, 4.2);
  const dim = LAYERS[g.li].dim * (1 - 0.7 * b / 4.2) * g.gain * (0.84 + 0.26 * rel);
  buildLUT(lut, g.hue + st.hue, dim);

  const amp = 0.08 + 0.92 * rel; // how deep the sculpture reads
  const invR = 1 / R;
  const type = g.type;

  // lattice points turned into the view
  let nf = 0;
  const FX = st.FX, FY = st.FY, FZ = st.FZ;
  if (type !== 0) {
    const pts = g.pts, zthr = type === 2 ? -0.8 : -0.4;
    for (let k = 0; k < g.np; k++) {
      const x = pts[3 * k], y = pts[3 * k + 1], z = pts[3 * k + 2];
      const vz = M[6] * x + M[7] * y + M[8] * z;
      if (vz > zthr) {
        FX[nf] = M[0] * x + M[1] * y + M[2] * z; FY[nf] = M[3] * x + M[4] * y + M[5] * z; FZ[nf] = vz;
        nf++;
      }
    }
  }
  // the pole of the grain and its three meridians
  const Zx = M[2], Zy = M[5], Zz = M[8];
  const MK = st.MK, UK = st.UK;
  if (type === 1) {
    for (let k = 0; k < 3; k++) {
      const ph = g.ph0 + k * 2.0943951, cs = cos(ph), sn = sin(ph);
      MK[3 * k] = cs * M[0] + sn * M[1]; MK[3 * k + 1] = cs * M[3] + sn * M[4]; MK[3 * k + 2] = cs * M[6] + sn * M[7];
      UK[3 * k] = -sn * M[0] + cs * M[1]; UK[3 * k + 1] = -sn * M[3] + cs * M[4]; UK[3 * k + 2] = -sn * M[6] + cs * M[7];
    }
  }

  if (type === 0) spines(st, g, true, sz, lx0, lx1, ly0, ly1, cxl, cyl, Ls, rel);

  // ---- the body
  const reach = R + 8;
  const gr0 = lut[3 * 40], gg0 = lut[3 * 40 + 1], gb0 = lut[3 * 40 + 2];
  const Hr = 0.008 + 0.03 * rel, Hf = 0.02 + 0.07 * rel, Hp = 0.02 + 0.06 * rel, Hd = 0.01 + 0.04 * rel;
  const wr = 0.42;
  for (let ly = ly0; ly <= ly1; ly++) {
    const dy = ly + 0.5 - cyl;
    for (let lx = lx0; lx <= lx1; lx++) {
      const dx = lx + 0.5 - cxl;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach * reach) continue;
      const i = ly * sz + lx;
      const d = sqrt(d2);
      if (d > R + 0.5) {
        const gl = GLOW * exp(-(d - R) * 0.4);
        BUF[i] += gr0 * gl; BUF[GP + i] += gg0 * gl; BUF[BP + i] += gb0 * gl;
        continue;
      }
      const cov = d > R - 0.5 ? R + 0.5 - d : 1;
      let rr = d * invR;
      if (rr > 0.985) rr = 0.985;
      const q = d > 1e-6 ? rr / d : 0;
      const nx = dx * q, ny = dy * q, nz = sqrt(1 - rr * rr);
      let tx = 0, ty = 0, tz = 0, ao = type === 0 ? 0.62 : 1, boost = 0;
      const face = sm(0.04, 0.38, nz); // sculpture folds away at the limb, where one LED holds many cells

      if (type === 1) {
        // three meridian furrows, then the net of ridges on what is left
        let gcol = 0;
        const sinl = nx * Zx + ny * Zy + nz * Zz;
        const al = abs(sinl);
        if (al < 0.93) {
          const taper = sqrt(1 - (al / 0.93) * (al / 0.93));
          for (let k = 0; k < 3; k++) {
            const c = nx * MK[3 * k] + ny * MK[3 * k + 1] + nz * MK[3 * k + 2];
            if (c <= 0) continue;
            const ux = UK[3 * k], uy = UK[3 * k + 1], uz = UK[3 * k + 2];
            const s = nx * ux + ny * uy + nz * uz;
            const hw = 0.2 * Math.pow(taper, 0.6);
            const t = abs(s) / hw;
            if (t < 1) {
              const u = cl((t - 0.4) / 0.6, 0, 1);
              gcol = 1 - u * u * (3 - 2 * u);
              const dg = (-6 * u * (1 - u)) / 0.6 / hw * (s < 0 ? -1 : 1);
              // the groove is sunk: the surface leans away from its axis
              const k2 = -Hf * amp * dg * face;
              tx += k2 * (ux - s * nx); ty += k2 * (uy - s * ny); tz += k2 * (uz - s * nz);
            }
          }
        }
        if (gcol < 1) {
          let m1 = -2, m2 = -2, i1 = 0, i2 = 0;
          for (let k = 0; k < nf; k++) {
            const dd = nx * FX[k] + ny * FY[k] + nz * FZ[k];
            if (dd > m1) { m2 = m1; i2 = i1; m1 = dd; i1 = k; } else if (dd > m2) { m2 = dd; i2 = k; }
          }
          const d1 = sqrt(max(2 - 2 * m1, 1e-6)), d2c = sqrt(max(2 - 2 * m2, 1e-6));
          const u = (d2c - d1) / g.sc, t = u / wr;
          const wgt = (1 - gcol) * face;
          if (t < 1) {
            const h = 1 - t * t * (3 - 2 * t);
            const dh = (-6 * t * (1 - t)) / wr / g.sc;
            const gx = (nx - FX[i2]) / d2c - (nx - FX[i1]) / d1;
            const gy = (ny - FY[i2]) / d2c - (ny - FY[i1]) / d1;
            const gz = (nz - FZ[i2]) / d2c - (nz - FZ[i1]) / d1;
            const gn = gx * nx + gy * ny + gz * nz;
            const kk = -Hr * amp * dh * wgt;
            tx += kk * (gx - gn * nx); ty += kk * (gy - gn * ny); tz += kk * (gz - gn * nz);
            boost += 0.5 * h * amp * wgt;
            ao *= 1 - 0.4 * (1 - h) * amp * wgt;
          } else {
            ao *= 1 - 0.4 * amp * wgt;
          }
        }
        ao *= 1 - 0.78 * gcol * (0.35 + 0.65 * amp);
      } else if (type === 2) {
        // pores: the nearest pore decides, a dark pit with a bright rim
        let m1 = -2, i1 = 0;
        for (let k = 0; k < nf; k++) {
          const dd = nx * FX[k] + ny * FY[k] + nz * FZ[k];
          if (dd > m1) { m1 = dd; i1 = k; }
        }
        const a = acos(m1 > 1 ? 1 : m1), rho = g.rho;
        if (a < rho * 1.9) {
          const sa = sqrt(max(1 - m1 * m1, 1e-6));
          // the way from the pore centre outward along the surface
          const ex = (m1 * nx - FX[i1]) / sa, ey = (m1 * ny - FY[i1]) / sa, ez = (m1 * nz - FZ[i1]) / sa;
          const t = cl((a - 0.5 * rho) / (0.55 * rho), 0, 1);
          const p = 1 - t * t * (3 - 2 * t);
          const dp = -6 * t * (1 - t) / (0.55 * rho);
          const rw = 0.3 * rho, rq = (a - 1.15 * rho) / rw;
          const qv = exp(-rq * rq), dq = qv * (-2 * rq / rw);
          const dh = Hp * amp * (0.9 * dq - 1.0 * dp) * face;
          tx -= dh * ex; ty -= dh * ey; tz -= dh * ez;
          boost += 0.34 * qv * (0.4 + 0.6 * amp);
          ao *= 1 - 0.88 * p * (0.25 + 0.75 * amp);
        }
      } else if (type === 3) {
        // a ring furrow round the grain and a soft cobble of low domes
        const sinl = nx * Zx + ny * Zy + nz * Zz - g.c0;
        const hw = 0.2, t = abs(sinl) / hw;
        let gcol = 0;
        if (t < 1) {
          const u = cl((t - 0.4) / 0.6, 0, 1);
          gcol = 1 - u * u * (3 - 2 * u);
          const dg = (-6 * u * (1 - u)) / 0.6 / hw * (sinl < 0 ? -1 : 1);
          const k2 = -Hf * amp * dg * face;
          tx += k2 * (Zx - sinl * nx); ty += k2 * (Zy - sinl * ny); tz += k2 * (Zz - sinl * nz);
        }
        if (gcol < 1) {
          let m1 = -2, i1 = 0;
          for (let k = 0; k < nf; k++) {
            const dd = nx * FX[k] + ny * FY[k] + nz * FZ[k];
            if (dd > m1) { m1 = dd; i1 = k; }
          }
          const d1 = sqrt(max(2 - 2 * m1, 1e-6)), rd = 0.62 * g.sc;
          const w = (1 - gcol) * face;
          if (d1 < rd) {
            const hb = 1 - (d1 / rd) * (d1 / rd);
            const kk = (2 / (rd * rd)) * Hd * (0.5 + amp) * w;
            tx += kk * (nx - FX[i1]); ty += kk * (ny - FY[i1]); tz += kk * (nz - FZ[i1]);
            ao *= 1 - 0.38 * (1 - hb) * amp * w;
          } else {
            ao *= 1 - 0.38 * amp * w;
          }
        }
        ao *= 1 - 0.8 * gcol * (0.35 + 0.65 * amp);
      }

      // what the secondary-electron detector sees
      let px = nx - tx, py = ny - ty, pz = nz - tz;
      const il = 1 / sqrt(px * px + py * py + pz * pz);
      px *= il; py *= il; pz *= il;
      const e = 1 - (pz > 0 ? pz : 0);
      const edge = e * sqrt(e);
      const det = px * DX + py * DY + pz * DZ;
      const lit = det > 0 ? det * (0.6 + 0.4 * det) : 0;
      const shade = 0.46 + 0.54 * sm(-0.4, 0.55, det);
      const e0 = 1 - nz;
      let s = (0.22 + (0.2 + 0.64 * amp) * edge + 0.34 * lit + boost) * shade * ao + (0.12 + 0.18 * amp) * e0 * e0 * e0 * e0;
      s = s < 0 ? 0 : s > 1 ? 1 : s;
      const fi = s * (NL - 1), i0 = fi | 0, f = fi - i0, i1 = i0 + 1 < NL ? i0 + 1 : i0;
      const cr = lut[3 * i0] + (lut[3 * i1] - lut[3 * i0]) * f;
      const cg = lut[3 * i0 + 1] + (lut[3 * i1 + 1] - lut[3 * i0 + 1]) * f;
      const cb = lut[3 * i0 + 2] + (lut[3 * i1 + 2] - lut[3 * i0 + 2]) * f;
      const ia = 1 - cov;
      BUF[i] = BUF[i] * ia + cr * cov;
      BUF[GP + i] = BUF[GP + i] * ia + cg * cov;
      BUF[BP + i] = BUF[BP + i] * ia + cb * cov;
      BUF[AP + i] = BUF[AP + i] * ia + cov;
    }
  }

  if (type === 0) spines(st, g, false, sz, lx0, lx1, ly0, ly1, cxl, cyl, Ls, rel);

  // ---- out of focus: a box blur whose width follows the distance from the sharp plane
  if (b > 0.2) {
    const TMP = st.TMP;
    const r = floor(b), fr = b - r, inv = 1 / (2 * r + 1 + 2 * fr);
    for (let pl = 0; pl < 4; pl++) {
      const o = pl * GP;
      for (let y = ly0; y <= ly1; y++) {
        const row = o + y * sz;
        let sum = 0;
        for (let x = lx0; x <= min(lx1, lx0 + r - 1); x++) sum += BUF[row + x];
        for (let x = lx0; x <= lx1; x++) {
          const xa = x + r, xb = x - r - 1;
          if (xa <= lx1) sum += BUF[row + xa];
          if (xb >= lx0) sum -= BUF[row + xb];
          const ex = (x + r + 1 <= lx1 ? BUF[row + x + r + 1] : 0) + (x - r - 1 >= lx0 ? BUF[row + x - r - 1] : 0);
          TMP[row + x] = (sum + fr * ex) * inv;
        }
      }
      for (let x = lx0; x <= lx1; x++) {
        let sum = 0;
        for (let y = ly0; y <= min(ly1, ly0 + r - 1); y++) sum += TMP[o + y * sz + x];
        for (let y = ly0; y <= ly1; y++) {
          const ya = y + r, yb = y - r - 1;
          if (ya <= ly1) sum += TMP[o + ya * sz + x];
          if (yb >= ly0) sum -= TMP[o + yb * sz + x];
          const ex = (y + r + 1 <= ly1 ? TMP[o + (y + r + 1) * sz + x] : 0) + (y - r - 1 >= ly0 ? TMP[o + (y - r - 1) * sz + x] : 0);
          BUF[o + y * sz + x] = (sum + fr * ex) * inv;
        }
      }
    }
  }

  // ---- onto the stage
  const FR = st.FR;
  for (let ly = ly0; ly <= ly1; ly++) {
    const sy = by0 + ly;
    if (sy < 0 || sy >= H) continue;
    for (let lx = lx0; lx <= lx1; lx++) {
      const sx = bx0 + lx;
      if (sx < 0 || sx >= W) continue;
      const i = ly * sz + lx, a = BUF[AP + i], o = (sy * W + sx) * 3;
      FR[o] = FR[o] * (1 - a) + BUF[i];
      FR[o + 1] = FR[o + 1] * (1 - a) + BUF[GP + i];
      FR[o + 2] = FR[o + 2] * (1 - a) + BUF[BP + i];
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  const FR = st.FR, t = st.t;
  // the stage itself: a faint mottled carbon, riding the pan at a rate of its own
  const ox = st.panX * 0.28, oy = st.panY * 0.28;
  for (let x = 0; x < W; x++) {
    st.cx1[x] = sin(0.17 * (x + ox) + 0.8);
    st.cx2[x] = sin(0.093 * (x + ox) + 2.1);
  }
  for (let y = 0; y < H; y++) {
    st.ry1[y] = sin(0.12 * (y + oy) + 0.3 + 0.6 * sin(0.05 * (y + oy)));
    st.ry2[y] = sin(0.071 * (y + oy) + 1.4);
  }
  const tc = [0, 0, 0];
  hsv(0.68, 0.8, 1, tc);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = 0.04 * (0.55 + 0.3 * st.cx1[x] * st.ry1[y] + 0.15 * st.cx2[x] * st.ry2[y]);
      const o = (y * W + x) * 3;
      FR[o] = tc[0] * m; FR[o + 1] = tc[1] * m; FR[o + 2] = tc[2] * m;
    }
  }
  for (let k = 0; k < st.vis.length; k++) renderGrain(st, st.vis[k]);

  // the scan: faint lines that drift, a broad band that rolls and rows that shimmer a little, a few percent
  const rm = st.rowMod;
  const tq = t * 5.3, tk = floor(tq), tf = tq - tk, tw = tf * tf * (3 - 2 * tf);
  for (let y = 0; y < H; y++) {
    const gq = floor(y / 2.5);
    const a = (ihash(gq, tk, 7, 11) / 4294967296) * 2 - 1, b = (ihash(gq, tk + 1, 7, 11) / 4294967296) * 2 - 1;
    rm[y] = 1 + 0.016 * sin(TP * (y / 4.3 - 0.8 * t)) + 0.024 * sin(TP * (y / 47 + 0.071 * t)) + 0.018 * (a + (b - a) * tw);
  }
  for (let y = 0; y < H; y++) {
    const m = rm[y];
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const r = FR[o] * m, g = FR[o + 1] * m, b = FR[o + 2] * m;
      display.setPixel(
        x, y,
        (r >= 1 ? 255 : r <= 0 ? 0 : (r * 255 + 0.5) | 0),
        (g >= 1 ? 255 : g <= 0 ? 0 : (g * 255 + 0.5) | 0),
        (b >= 1 ? 255 : b <= 0 ? 0 : (b * 255 + 0.5) | 0),
      );
    }
  }
}
