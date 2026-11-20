// ===== Patternflow pattern =====
// Title:   Prismatic Spring
// Family:  hotspring
// Idea:    A huge hot spring seen straight down, a deep blue boiling pool ringed by microbial mats that run from green and yellow through orange to rust as the water cools, with orange rills braiding out across pale sinter under a drifting veil of steam.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Grand Prismatic Spring in the Midway Geyser Basin, Yellowstone; Thermus aquaticus, the heat-loving bacterium Thomas Brock and Hudson Freeze described from Yellowstone in 1969; Brock's book Thermophilic Microorganisms and Life at High Temperatures (1978), where the colour of a mat follows the temperature of its water; pattern round 204
// Round:   204
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Heat=1..3, Steam=-1..1, Flow=-1..1
//
// Knob 1: Hue. Turns the whole spring round the colour wheel, a full turn from 0 to 1 (both ends the same): it opens on cobalt water, green, yellow and orange mats and cream sinter, at 0.5 the water is amber and the mats run blue and green, and the steam stays white.
// Knob 2: Heat. How far the hot zone reaches: at 1 the pool is 36 LEDs across with 9 LEDs of mat round it, at 2 it is 42 across with 16 LEDs of mat, at 3 it is 48 across with 24 and the broad yellow and orange bands fill most of the panel, the cool rust running off the edges.
// Knob 3: Steam. How thick the veil is: at -1 only a few faint wisps (under 10 per cent white) cross the pool, at 0 a translucent haze that thickens over the hot centre and clears toward the corners, at 1 a dense fog that veils the pool to about 70 per cent at its thickest while the mats still show through.
// Knob 4: Flow. How far the runoff rills reach and how fast they wander: at -1 they are stubs of 25 to 40 LEDs that sway at a third of the speed they have at 1, at 0 they braid about 80 LEDs down the panel, at 1 they run 100 LEDs and more to the bottom edge and the mats put out fingers a third farther.

const W = 64, H = 128, N = W * H;
const { floor, sin, cos, sqrt, exp, abs, min, max, PI, atan2 } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The pool sits above the middle of the panel; the rest is terrace and runoff.
const CX = 32, CY = 45;
const NB = 256; // angular bins for the outline tables

// ---------------------------------------------------------------- noise
// A 256 x 256 table of random values, read with smooth interpolation and
// wrapped. The wrap is 256 cells, far longer than anything the wind carries a
// veil in 900 s, so the field does not come round.
const NT = 256;
const TAB = new Float32Array(NT * NT);
(function () {
  let a = 0x2545f491;
  for (let i = 0; i < TAB.length; i++) {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    TAB[i] = (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  }
})();
function vn(x, y) {
  const ix = floor(x), iy = floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const i0 = ix & 255, i1 = (ix + 1) & 255, j0 = (iy & 255) << 8, j1 = ((iy + 1) & 255) << 8;
  const a = TAB[j0 + i0], b = TAB[j0 + i1], c = TAB[j1 + i0], d = TAB[j1 + i1];
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
}

// ---------------------------------------------------------------- colour
// Mat colour by t, the water's coolness: 0 at the pool's rim, 1 on the sinter.
// Each colour holds a plateau and melts into the next, so the bands are soft.
const MAT = [
  [0.0, 0.74, 0.96, 0.86], // pale green-blue, the thin band at the rim
  [0.04, 0.74, 0.96, 0.86],
  [0.09, 0.7, 0.86, 0.26], // yellow-green
  [0.15, 0.7, 0.86, 0.26],
  [0.21, 1.0, 0.88, 0.16], // yellow
  [0.29, 1.0, 0.88, 0.16],
  [0.36, 1.0, 0.52, 0.05], // orange, the carotenoid band
  [0.47, 1.0, 0.52, 0.05],
  [0.54, 0.86, 0.23, 0.06], // rust-red
  [0.62, 0.86, 0.23, 0.06],
  [0.7, 0.6, 0.27, 0.12], // brown at the cool edge
  [0.75, 0.6, 0.27, 0.12],
  [0.92, 0.78, 0.76, 0.7], // cream sinter
  [1.0, 0.78, 0.76, 0.7],
];
// Pool colour by depth, 0 at the rim and 1 at the centre.
const POOL = [
  [0.0, 0.5, 0.92, 0.86],
  [0.12, 0.12, 0.76, 0.9],
  [0.4, 0.04, 0.44, 0.96],
  [0.75, 0.02, 0.22, 0.86],
  [1.0, 0.01, 0.12, 0.7],
];
const NL = 256;
function lutFrom(stops, soft, out, hue) {
  const c = cos(hue * TAU), s = sin(hue * TAU);
  // Hue rotation about the grey axis, the usual 3 x 3 matrix.
  const m = [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
  let k = 0;
  for (let i = 0; i < NL; i++) {
    const t = i / (NL - 1);
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const a = stops[k], b = stops[k + 1];
    const f = sstep(0.5 - soft / 2, 0.5 + soft / 2, (t - a[0]) / (b[0] - a[0]));
    const r = mix(a[1], b[1], f), g = mix(a[2], b[2], f), bl = mix(a[3], b[3], f);
    out[i * 3] = cl(m[0] * r + m[1] * g + m[2] * bl, 0, 1);
    out[i * 3 + 1] = cl(m[3] * r + m[4] * g + m[5] * bl, 0, 1);
    out[i * 3 + 2] = cl(m[6] * r + m[7] * g + m[8] * bl, 0, 1);
  }
}

// ---------------------------------------------------------------- state
const NR = 11; // runoff rills
const MAXP = 260; // points on a rill's path
const NBUB = 10;

export function setup(params) {
  const R0 = new Float32Array(N), TA = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY;
      R0[y * W + x] = sqrt(dx * dx + dy * dy);
      TA[y * W + x] = ((atan2(dy, dx) + PI) / TAU) * NB;
    }
  const rills = [];
  for (let i = 0; i < NR; i++) rills.push({ i, age: 0, life: 60, seed: i * 7.31, th: 0, len: 1, br: [] });
  params.s = {
    t: 30, fc: 0, fl: 0, wx: 0, wy: 0, first: true, hue: -1, k: [0, 2, 0, 0.06],
    R0, TA,
    mat: new Float32Array(NL * 3), pool: new Float32Array(NL * 3),
    pin: new Float32Array(NB + 2), pout: new Float32Array(NB + 2), fin: new Float32Array(NB + 2),
    br: new Float32Array(160),
    ra: new Float32Array(N), rt: new Float32Array(N), bb: new Float32Array(N),
    sa: new Float32Array(32 * 64),
    px: new Float32Array(MAXP), py: new Float32Array(MAXP), ph: new Float32Array(MAXP),
    rills, bubs: [], thc: 1.7,
  };
  for (let i = 0; i < NR; i++) rebirth(params.s, rills[i], true);
}

// A rill is born at a heading inside its own slot of the 164 degrees below
// and beside the pool (heading 0 is right, 90 is down). It keeps that slot,
// so the rills stay spread, but each new life picks fresh jitter, fresh
// branches and a fresh length: the runoff re-routes and never repeats.
function rebirth(S, r, first) {
  const slot = 164 / NR, c0 = 8 + slot * (r.i + 0.5);
  r.base = ((c0 + (Math.random() - 0.5) * slot * 0.8) * PI) / 180;
  r.life = 50 + Math.random() * 90;
  r.age = first ? Math.random() * r.life : 0;
  r.len = 0.75 + Math.random() * 0.4;
  r.seed = Math.random() * 90;
  r.sway = 0.7 + Math.random() * 0.6;
  r.br.length = 0;
  const nb = 2;
  for (let b = 0; b < nb; b++) {
    r.br.push({
      s0: b === 0 ? 14 + Math.random() * 20 : 42 + Math.random() * 28,
      len: 20 + Math.random() * 26,
      amp: (Math.random() < 0.5 ? -1 : 1) * (3.5 + Math.random() * 4.5),
      fork: Math.random() < 0.4,
      seed: Math.random() * 50,
    });
  }
}

function advance(S, dt, k) {
  S.t += dt;
  const t = S.t, f = cl((k[3] + 1) / 2, 0, 1);
  S.fl += dt * (0.55 + 1.1 * f);
  // The wind keeps changing direction on frequencies that share no factor, and
  // never settles: the veil follows its integral.
  const wa = -0.5 + 1.9 * sin(0.0213 * t + 1) + 1.1 * sin(0.0087 * t + 4) + 0.6 * sin(0.047 * t);
  const ws = 1.5 + 0.6 * sin(0.037 * t + 2) + 0.3 * sin(0.0113 * t);
  S.wx += cos(wa) * ws * dt;
  S.wy += (sin(wa) * ws - 0.35) * dt;
  // The main channel's heading is the notch in the outline; it drifts slowly.
  const main = S.rills[6];
  main.age = 0.5 * main.life;
  // Rills age, fade out and are reborn somewhere else in their slot.
  for (const r of S.rills) {
    r.age += dt;
    if (r.age > r.life && r !== main) rebirth(S, r, false);
  }
  main.th = main.base + 0.22 * vn(t * 0.011 + 3.3, 5.1);
  for (const r of S.rills) if (r !== main) r.th = r.base + 0.22 * vn(t * 0.011 + r.seed, 5.1 + r.i);
  S.thc = main.th;
  // Bubbles burst in the pool at random and send out a ripple.
  const rate = 0.7 * exp(0.6 * (0.6 * sin(0.37 * t + 1) + 0.4 * sin(0.153 * t + 2.5)));
  let n = 0;
  for (let p = Math.random(); p < 1 - exp(-rate * dt) && n < 2; p = Math.random()) n++;
  if (S.bubs.length + n > NBUB) n = max(0, NBUB - S.bubs.length);
  for (let i = 0; i < n; i++) {
    S.bubs.push({
      a: Math.random() * TAU,
      rr: sqrt(Math.random()) * 0.74,
      age: 0,
      amp: 0.7 + Math.random() * 0.5,
    });
  }
  for (let i = S.bubs.length - 1; i >= 0; i--) {
    S.bubs[i].age += dt;
    if (S.bubs[i].age > 5) S.bubs.splice(i, 1);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.k = k;
  if (S.first) {
    for (let t = 0; t < 14; t += 0.1) advance(S, 0.1, k);
    S.first = false;
  }
  advance(S, dt, k);
}

// ---------------------------------------------------------------- rills
function splat(S, x, y, tc, sg, al) {
  const rad = Math.ceil(2.5 * sg), ix = floor(x), iy = floor(y), k = 1 / (2 * sg * sg);
  const { ra, rt } = S;
  for (let j = iy - rad; j <= iy + rad; j++) {
    if (j < 0 || j >= H) continue;
    for (let i = ix - rad; i <= ix + rad; i++) {
      if (i < 0 || i >= W) continue;
      const dx = i + 0.5 - x, dy = j + 0.5 - y;
      const w = al * exp(-(dx * dx + dy * dy) * k);
      const p = j * W + i;
      if (w > ra[p]) {
        ra[p] = w;
        rt[p] = tc;
      }
    }
  }
}

// Rills as paths from the pool's rim: a heading that bends downhill (down the
// panel) and sways with noise that moves in time. Each rill splits twice: a
// branch either leaves the main thread and rejoins it (a braid) or goes its
// own way (a fork). The farther along a rill, the cooler its colour and the
// thinner its line, never under 1.7 LEDs wide at half height.
function buildRills(S, f, Rp) {
  S.ra.fill(0);
  const reach = 16 + 60 * f, Lmax = 34 + 92 * f;
  const { px, py, ph } = S;
  const STEP = 0.7, kg = 0.012, t = S.t, tf = S.fl;
  for (const r of S.rills) {
    const life = r.age / r.life;
    const st = sstep(0, 0.06, life) * sstep(1, 0.94, life);
    if (st < 0.02) continue;
    const L = min(MAXP - 1, floor((Lmax * r.len) / STEP));
    let th = r.th;
    let x = CX + cos(th) * (Rp - 1), y = CY + sin(th) * (Rp - 1);
    for (let n = 0; n < L; n++) {
      const s = n * STEP;
      const sw = r.sway * 0.85 * min(1, s / 16) * vn(s / 15 + r.seed, tf * 0.06 + r.seed * 0.37);
      const hh = th + sw;
      px[n] = x;
      py[n] = y;
      ph[n] = hh;
      x += cos(hh) * STEP;
      y += sin(hh) * STEP;
      th += kg * sin(PI / 2 - th) * STEP;
    }
    for (let n = 0; n < L; n++) {
      const s = n * STEP;
      const tc = 0.36 + 0.4 * (1 - exp(-((s / reach) ** 1.25)));
      const sg = 1.05 - 0.2 * (1 - exp(-s / (reach * 0.9)));
      const al = st * sstep(L * STEP, L * STEP * 0.5, s);
      splat(S, px[n], py[n], tc, sg, al);
    }
    for (const b of r.br) {
      const wob = 0.8 + 0.2 * vn(t * 0.03 + b.seed, 2.2);
      const s1 = b.fork ? L * STEP : b.s0 + b.len;
      for (let n = floor(b.s0 / STEP); n < L && n * STEP <= s1; n++) {
        const s = n * STEP, u = (s - b.s0) / b.len;
        const bump = b.fork ? sstep(0, 1, u) + 0.25 * max(0, u - 1) : sin(PI * cl(u, 0, 1));
        const off = b.amp * bump * wob;
        const tc = 0.36 + 0.4 * (1 - exp(-((s / reach) ** 1.25)));
        const sg = 0.95 - 0.1 * (1 - exp(-s / (reach * 0.9)));
        const al = 0.92 * st * sstep(L * STEP, L * STEP * 0.5, s) * sstep(0, 0.12, u + 0.04) * (b.fork ? 1 : sstep(1.04, 0.92, u));
        splat(S, px[n] - sin(ph[n]) * off, py[n] + cos(ph[n]) * off, tc, sg, al);
      }
    }
  }
}

// ---------------------------------------------------------------- draw
export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const k = S.k, t = S.t;
  if (S.hue !== k[0]) {
    S.hue = k[0];
    lutFrom(MAT, 1, S.mat, k[0]);
    lutFrom(POOL, 1, S.pool, k[0]);
  }
  const hn = cl((k[1] - 1) / 2, 0, 1);
  const Rp = 18 + 6 * hn, Dm = 9 + 15 * hn;
  const amt = cl((k[2] + 1) / 2, 0, 1), f = cl((k[3] + 1) / 2, 0, 1);
  const { R0, TA, mat, pool, pin, pout, fin, br, ra, rt, bb, sa } = S;

  // The outline of the mat bands: low-frequency lobes round the pool. The
  // pool's own rim is nearly round, the outer bands stretch and lean toward
  // the channel, and the channel's mouth cuts a notch into the pool.
  const thc = S.thc;
  for (let b = 0; b <= NB + 1; b++) {
    const th = -PI + (b * TAU) / NB;
    let dth = th - thc;
    dth -= TAU * Math.round(dth / TAU);
    pin[b] =
      0.8 * cos(2 * th + 0.4 + 0.021 * t) + 0.6 * cos(3 * th + 1.9 - 0.017 * t) + 0.4 * cos(4 * th + 3.1 + 0.013 * t) + 0.25 * cos(5 * th - 2 - 0.029 * t) -
      2.2 * exp(-((dth / 0.2) ** 2));
    pout[b] =
      1.9 * cos(th - thc + 0.2 * sin(0.019 * t)) + 2.6 * cos(2 * th + 2.2 - 0.023 * t) + 2.0 * cos(3 * th + 0.5 + 0.019 * t) + 1.5 * cos(4 * th - 1.1 - 0.011 * t) +
      1.1 * cos(5 * th + 2.6 + 0.031 * t) + 0.8 * cos(6 * th - 0.3 - 0.017 * t) + 2.6 * exp(-((dth / 0.3) ** 2));
  }
  // Fingers: narrow streaks where the warm colours run out radially, from
  // noise read round a circle so it joins up at the seam and drifts slowly.
  for (let b = 0; b <= NB + 1; b++) {
    const th = -PI + (b * TAU) / NB, cs = cos(th), sn = sin(th);
    const f1 = vn(3.4 * cs + 20 + 0.011 * t, 3.4 * sn + 5 + 0.007 * t);
    const f2 = vn(6.1 * cs + 50 - 0.009 * t, 6.1 * sn + 31 + 0.013 * t);
    fin[b] = 5.5 * max(0, f1 - 0.05) ** 1.3 + 2.6 * max(0, f2 - 0.2) ** 1.2;
  }
  // The heat field breathes: upwelling pulses travel out through the bands
  // and move every colour boundary a couple of LEDs, in and out.
  for (let i = 0; i < br.length; i++) {
    const d = -6 + i * 0.5;
    br[i] = 1.1 * sin(0.31 * t - 0.16 * d + 0.7) + 0.9 * sin(0.173 * t - 0.11 * d + 2.1) + 0.7 * sin(0.083 * t - 0.07 * d + 4);
  }
  const fscale = 0.55 + 0.9 * f;
  // The rills move a fraction of an LED a second, so they are redrawn at 15 Hz.
  if ((S.fc++ & 1) === 0) buildRills(S, f, Rp);

  // Bubbles into one signed buffer: a flash at birth, then a ring two LEDs
  // wide that widens, fades and leaves a faint trough behind it.
  bb.fill(0);
  for (const b of S.bubs) {
    const bx = CX + cos(b.a) * b.rr * Rp, by = CY + sin(b.a) * b.rr * Rp;
    const rr = 1.8 + 8.5 * (1 - exp(-b.age / 1.7));
    const am = b.amp * 1.25 * exp(-b.age / 1.5) / (1 + 0.08 * rr);
    const fl = exp(-b.age / 0.14);
    const ext = Math.ceil(rr + 4);
    for (let y = max(0, floor(by) - ext); y <= min(H - 1, floor(by) + ext); y++)
      for (let x = max(0, floor(bx) - ext); x <= min(W - 1, floor(bx) + ext); x++) {
        const dx = x + 0.5 - bx, dy = y + 0.5 - by, d = sqrt(dx * dx + dy * dy);
        const ring = exp(-(((d - rr) / 1.1) ** 2)), trough = exp(-(((d - rr + 2.6) / 1.3) ** 2));
        bb[y * W + x] += am * (ring - 0.5 * trough) + 1.4 * fl * exp(-((d / 1.7) ** 2));
      }
  }

  // Steam on a half-resolution grid. Three octaves slide with the wind at
  // different speeds, and the largest turns into a second layer of itself so
  // the veil forms and thins instead of only drifting.
  const wx = S.wx, wy = S.wy, ph1 = 0.043 * t, c1 = cos(ph1), s1 = sin(ph1);
  const lo = 0.04 - 0.6 * amt, cap = 0.1 + 0.62 * amt ** 1.5;
  for (let j = 0; j < 64; j++)
    for (let i = 0; i < 32; i++) {
      const x = i * 2 + 1, y = j * 2 + 1;
      const ax = (x - wx) / 17, ay = (y - wy) / 13;
      const n1 = c1 * vn(ax, ay) + s1 * vn(ax + 41.3, ay + 17.7);
      const n2 = vn((x - 1.4 * wx) / 8.5 + 9.2, (y - 1.4 * wy) / 7 + 3.1);
      const n3 = vn((x - 1.9 * wx) / 4.6 + 23.1, (y - 1.9 * wy) / 4 + 11.7);
      const v = 0.55 * n1 + 0.3 * n2 + 0.15 * n3;
      const dx = x - CX, dy = y - CY, r = sqrt(dx * dx + dy * dy);
      const cw = 0.4 + 0.6 * exp(-((r / 34) ** 2));
      sa[j * 32 + i] = sstep(lo, lo + 0.55, v) * cap * cw;
    }

  // Per pixel.
  const mx = t * 0.03, my = t * 0.021, cc = cos(0.071 * t), cs = sin(0.071 * t);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, r = R0[p];
      const af = TA[p], ai = floor(af), fa = af - ai;
      const pi_ = pin[ai] + (pin[ai + 1] - pin[ai]) * fa, po = pout[ai] + (pout[ai + 1] - pout[ai]) * fa;
      const warp = vn(x * 0.11 + mx, y * 0.11 + my + 7.7);
      const ro = sstep(Rp - 2, Rp + 1.5 * Dm + 4, r);
      const pert = pi_ + (po - pi_) * ro + (0.6 + 1.1 * ro) * warp;
      const d = r - pert - Rp;
      let cr, cg, cb;
      // The pool.
      const wp = sstep(0.7, -0.7, d);
      if (wp > 0) {
        const z0 = 1 - exp(-(-d) / 6.5);
        // Convection: slow cells of lighter and darker water.
        const sx = x * 0.14, sy = y * 0.14;
        const cell = cc * vn(sx + 0.05 * t, sy + 0.03 * t) + cs * vn(sx + 17.3 - 0.04 * t, sy + 5.1 + 0.05 * t);
        const cell2 = vn(x * 0.27 - 0.07 * t + 31, y * 0.27 + 0.05 * t);
        const z = cl(z0 + 0.12 * cell + 0.05 * cell2, 0, 1);
        const zi = floor(z * (NL - 1)) * 3;
        cr = pool[zi];
        cg = pool[zi + 1];
        cb = pool[zi + 2];
        const lb = bb[p];
        if (lb > 0) {
          const a = min(1, lb) * 0.62;
          cr += (mix(pool[0], 1, 0.55) - cr) * a;
          cg += (mix(pool[1], 1, 0.55) - cg) * a;
          cb += (mix(pool[2], 1, 0.55) - cb) * a;
        } else if (lb < 0) {
          const a = min(1, -lb) * 0.3;
          cr *= 1 - a;
          cg *= 1 - a;
          cb *= 1 - a;
        }
      }
      if (wp < 1) {
        // The mats and the sinter.
        const di = (d + 6) * 2, bi = cl(floor(di), 0, br.length - 2);
        const bw = (br[bi] + (br[bi + 1] - br[bi]) * cl(di - bi, 0, 1)) * (0.2 + 0.8 * sstep(0, Dm * 0.5, d));
        const tex = vn(x * 0.2 + mx * 2 + 3.3, y * 0.2 + my * 2), tex2 = vn(x * 0.085 - mx + 13.3, y * 0.085 - my + 4.4);
        const fg = (fin[ai] + (fin[ai + 1] - fin[ai]) * fa) * fscale * sstep(1, 0.75 * Dm, d);
        const dd = d + bw - fg + 0.8 * tex + 1.1 * tex2;
        const tt = cl(dd / Dm, 0, 1);
        const li = floor(tt * (NL - 1)) * 3;
        let mr = mat[li], mg = mat[li + 1], mb = mat[li + 2];
        const tf = sstep(0.74, 0.97, tt);
        // The sinter: cream beside the mats, cool grey farther out, patchy, and
        // darker toward the corners so the pool stays the brightest thing.
        const tn = vn(x * 0.05 + 11.5, y * 0.05 + 2.9), tn2 = vn(x * 0.17 + 3, y * 0.17 + 9);
        const ed = max(0, dd - Dm), near = exp(-ed / 16), gy = sstep(-0.3, 0.5, tn) * (1 - 0.6 * near);
        const bt = (0.34 + 0.5 * exp(-ed / 11)) * (1 + 0.1 * tn2 + 0.08 * tn);
        const tr = mix(0.82, 0.6, gy) * bt, tg = mix(0.78, 0.65, gy) * bt, tb = mix(0.7, 0.72, gy) * bt;
        mr = mix(mr, tr, tf);
        mg = mix(mg, tg, tf);
        mb = mix(mb, tb, tf);
        mr *= 1 + 0.05 * tex;
        mg *= 1 + 0.05 * tex;
        mb *= 1 + 0.05 * tex;
        // The rills, over everything but the pool.
        const al = ra[p];
        if (al > 0) {
          const tc = rt[p], lj = floor(tc * (NL - 1)) * 3;
          const g = al * sstep(tc - 0.02, tc + 0.1, tt);
          mr = mix(mr, mat[lj], g);
          mg = mix(mg, mat[lj + 1], g);
          mb = mix(mb, mat[lj + 2], g);
        }
        if (wp > 0) {
          cr = mix(mr, cr, wp);
          cg = mix(mg, cg, wp);
          cb = mix(mb, cb, wp);
        } else {
          cr = mr;
          cg = mg;
          cb = mb;
        }
      }
      // The steam over all of it, bilinear from the half-resolution grid.
      const gx = cl((x - 0.5) / 2, 0, 30.999), gy2 = cl((y - 0.5) / 2, 0, 62.999);
      const gi = floor(gx), gj = floor(gy2), fx = gx - gi, fy = gy2 - gj;
      const o = gj * 32 + gi;
      const a = (sa[o] * (1 - fx) + sa[o + 1] * fx) * (1 - fy) + (sa[o + 32] * (1 - fx) + sa[o + 33] * fx) * fy;
      cr = cr * (1 - a) + 0.94 * a;
      cg = cg * (1 - a) + 0.97 * a;
      cb = cb * (1 - a) + 1.0 * a;
      display.setPixel(x, y, cl(cr, 0, 1) * 255, cl(cg, 0, 1) * 255, cl(cb, 0, 1) * 255);
    }
}
