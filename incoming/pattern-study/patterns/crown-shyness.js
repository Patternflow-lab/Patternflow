// ===== Patternflow pattern =====
// Title:   Crown Shyness
// Family:  canopy
// Idea:    A forest canopy seen from the floor straight up, lobed green crowns that stop short of each other and leave a net of narrow bright sky between them, a net that opens and closes as the wind sways the trees, until one tree drops its leaves, the neighbours reach slowly into the hole, and a sapling comes up in what is left.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: crown shyness, the channels of sky between the crowns of trees of one species (Marcel Ng and colleagues' survey of Dryobalanops aromatica, 1970s, and Francis Putz and colleagues' tests of the wind-abrasion explanation, 1984, from memory), a multiplicatively weighted Voronoi diagram whose cells are the crowns (Apollonius diagram, from memory), pattern round 226
// Round:   226
// ===============================
// @matrix 64x128
// @knobs Season=0..1, Wind=0..3, Density=-1..1, Gap=-1..1
//
// Knob 1: Season. The colour of the leaves, spring green at 0 (deep teal at the middle of a crown, lime at its rim), lime-yellow at 0.5, and gold at 1; it never goes red or brown, and the sky stays blue-white.
// Knob 2: Wind. How far the trees sway and how fast the leaves flutter. The crowns stand still at 0; at 2 where it opens each one wanders about 1.9 LEDs from its place on a clock of its own, and the sky net breathes between about 2 and 3.7 LEDs wide; at 3 the sway is 2.9 LEDs and the leaves boil twice as fast.
// Knob 3: Density. How many trees fill the panel, which is the forest seen from nearer or further. 25 trees with crowns about 19 LEDs across at -1, about 50 at 0 where it opens (crowns 14 across), about 90 at +1 (crowns 10 across).
// Knob 4: Gap. How wide the sky is between crowns, 2.0 LEDs at -1, 2.6 at 0.06 where it opens, and 6.0 at +1, where the crowns are islands in a bright sky.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, exp, sin, cos, pow, abs, min, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const mix = (a, b, t) => a + (b - a) * t;

// The forest is a pool of NT trees spread over a window bigger than the panel, so that the Density knob can
// zoom in and out of it and trees slide in over the edges. Positions are in pool LEDs, and the zoom (0.76 to
// 1.32) turns them into panel LEDs about the middle of the panel.
const NT = 128, MARGIN = 26;
const CX = (W - 1) / 2, CY = (H - 1) / 2;
const R0 = 7.3; // crown radius in LEDs at zoom 1: half the spacing of 50 trees on the panel
// A crown is not round: three harmonics of lobes, each with its own amplitude and a phase that turns at a rate of its own.
const LA = [0.12, 0.09, 0.05]; // harmonics 3, 6 and 10

const hash = (n) => {
  const x = sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - floor(x);
};
// Smooth random numbers: a new random value at every whole step of t, joined by a Catmull-Rom curve, about -1..1.
// Every channel has its own sequence.
function wander(t, ch) {
  const i = floor(t), f = t - i, o = ch * 101.7;
  const a = hash(i - 1 + o) * 2 - 1, b = hash(i + o) * 2 - 1, c = hash(i + 1 + o) * 2 - 1, d = hash(i + 2 + o) * 2 - 1;
  return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
}

// Leaf colour ramps, indexed by how lit a bit of leaf is (0 deep, 1 sunlit), at three seasons.
// Five stops each: deep, dark, mid, lit, sunlit.
const SEASONS = [
  [[6, 80, 78], [16, 118, 72], [58, 168, 60], [150, 222, 68], [226, 250, 114]],
  [[28, 112, 52], [96, 166, 40], [168, 204, 40], [216, 234, 72], [246, 253, 134]],
  [[162, 136, 8], [206, 162, 10], [240, 192, 24], [254, 224, 76], [255, 246, 156]],
];
const SKY0 = [198, 228, 252], SKY1 = [236, 249, 255], SKYSUN = [255, 250, 228];

function ramp(P, season) {
  P.sc = season;
  const sp = season * 2, k = sp >= 2 ? 1 : floor(sp), f = sp - k;
  const A = SEASONS[k], B = SEASONS[k + 1] || SEASONS[k];
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 4, j = x >= 4 ? 3 : floor(x), u = x - j;
    for (let c = 0; c < 3; c++) {
      const a = mix(A[j][c], A[j + 1][c], u), b = mix(B[j][c], B[j + 1][c], u);
      P.ramp[i * 3 + c] = mix(a, b, f);
    }
  }
}

export function setup(P) {
  P.ready = false;
  P.t = 0;
  P.cw = 0; // sway clock
  P.cf = 0; // flutter clock
  P.sc = -1;
  P.zoom = 1;
  P.ramp = new Float32Array(256 * 3);
  // Leaf and sky noise: two lattices each, blended with cos and sin of a slowly turning angle, so that a
  // field boils without repeating (a cos + b sin keeps the variance of a and b).
  const tab = () => {
    const a = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) a[i] = Math.random() * 2 - 1;
    return a;
  };
  P.tA = tab(); P.tB = tab(); P.tC = tab(); P.tD = tab();
  const f = (n) => new Float64Array(n);
  P.cx = f(NT); P.cy = f(NT); P.rb = f(NT); P.sd = f(NT);
  P.lw = [f(NT), f(NT), f(NT)]; P.lp = [f(NT), f(NT), f(NT)];
  P.nox = new Int32Array(NT); P.noy = new Int32Array(NT);
  P.st = new Int32Array(NT); P.tt = f(NT); P.td = f(NT);
  P.gr = f(NT).fill(1); P.al = f(NT).fill(1); P.rch = f(NT).fill(1); P.hs = f(NT);
  // per frame
  P.px = f(NT); P.py = f(NT); P.ox = f(NT); P.oy = f(NT); P.rr = f(NT); P.amp = f(NT);
  P.lcr = [f(NT), f(NT), f(NT)]; P.lci = [f(NT), f(NT), f(NT)];
  P.lo = f(NT); P.cand = new Int32Array(NT); P.tn = f(NT);
  P.i1a = new Int16Array(NPX); P.i2a = new Int16Array(NPX); P.sva = new Float32Array(NPX);
  P.q1a = new Float32Array(NPX); P.q2a = new Float32Array(NPX);
  P.alp = new Float32Array(NPX); P.alt = new Float32Array(NPX); P.lf = new Float32Array(NPX * 3);
  P.out = new Uint8Array(NPX * 3);
  P.evT = 40;
  // Trees by best candidate: each new one goes where it is furthest from the ones before it.
  for (let i = 0; i < NT; i++) {
    let bx = 0, by = 0, bd = -1;
    for (let k = 0; k < (i === 0 ? 1 : 24); k++) {
      const x = -MARGIN + Math.random() * (W + 2 * MARGIN), y = -MARGIN + Math.random() * (H + 2 * MARGIN);
      let dm = 1e9;
      for (let j = 0; j < i; j++) {
        const dx = x - P.cx[j], dy = y - P.cy[j], dd = dx * dx + dy * dy;
        if (dd < dm) dm = dd;
      }
      if (dm > bd) { bd = dm; bx = x; by = y; }
    }
    P.cx[i] = bx; P.cy[i] = by;
    P.rb[i] = 0.86 + 0.34 * Math.random();
    P.sd[i] = Math.random() * 200;
    for (let k = 0; k < 3; k++) {
      P.lw[k][i] = (Math.random() < 0.5 ? -1 : 1) * (0.05 + 0.11 * Math.random());
      P.lp[k][i] = Math.random() * TAU;
    }
    P.nox[i] = (Math.random() * 64) | 0; P.noy[i] = (Math.random() * 64) | 0;
  }
}

// Death, a hole, a sapling. Every tree is alive (0), dropping its leaves (1), a bare hole (2) or growing back as a
// sapling (3). Alive trees near a hole reach into it.
const T_DROP = 7;
function startDeath(P, i) {
  P.st[i] = 1; P.tt[i] = 0; P.td[i] = T_DROP;
}
function reseed(P, i, zoom) {
  // The sapling stands where the canopy is thinnest: the point furthest, in crown radii, from any live crown.
  let bx = P.cx[i], by = P.cy[i], be = -1;
  for (let k = 0; k < 40; k++) {
    const x = k === 0 ? bx : (k === 1 ? P.cx[i] + (Math.random() - 0.5) * 6 : CX + (Math.random() * 2 - 1) * (W / 2 + 4) / zoom);
    const y = k === 0 ? by : (k === 1 ? P.cy[i] + (Math.random() - 0.5) * 6 : CY + (Math.random() * 2 - 1) * (H / 2 + 4) / zoom);
    let e = 1e9;
    for (let j = 0; j < NT; j++) {
      if (j === i || P.st[j] === 2) continue;
      const dx = x - P.cx[j], dy = y - P.cy[j];
      const v = sqrt(dx * dx + dy * dy) / (R0 * P.rb[j] * P.gr[j] * P.rch[j] + 0.5);
      if (v < e) e = v;
    }
    if (k < 2) e *= 1.12;
    if (e > be) { be = e; bx = x; by = y; }
  }
  P.cx[i] = bx; P.cy[i] = by;
  P.st[i] = 3; P.tt[i] = 0; P.td[i] = 100 + 40 * Math.random();
  P.gr[i] = 0.34; P.al[i] = 0; P.rb[i] = 0.86 + 0.34 * Math.random();
  P.nox[i] = (Math.random() * 64) | 0; P.noy[i] = (Math.random() * 64) | 0;
  for (let k = 0; k < 3; k++) P.lp[k][i] = Math.random() * TAU;
}
function stepState(P, dt, zoom) {
  P.evT -= dt;
  if (P.evT <= 0) {
    P.evT = 38 + 36 * Math.random();
    // A victim: alive, on the panel, and away from the other holes.
    const ok = [];
    for (let i = 0; i < NT; i++) {
      if (P.st[i] !== 0) continue;
      const x = CX + (P.cx[i] - CX) * zoom, y = CY + (P.cy[i] - CY) * zoom;
      if (x < 3 || x > W - 3 || y < 3 || y > H - 3) continue;
      let far = true;
      for (let j = 0; j < NT; j++) {
        if (P.st[j] === 0) continue;
        const dx = P.cx[i] - P.cx[j], dy = P.cy[i] - P.cy[j];
        if (dx * dx + dy * dy < 30 * 30) { far = false; break; }
      }
      if (far) ok.push(i);
    }
    if (ok.length) startDeath(P, ok[(Math.random() * ok.length) | 0]);
  }
  for (let i = 0; i < NT; i++) {
    const s = P.st[i];
    if (s === 0) { P.al[i] = 1; P.gr[i] = 1; P.hs[i] = 0; continue; }
    P.tt[i] += dt;
    const u = P.tt[i] / P.td[i];
    if (s === 1) {
      P.al[i] = 1 - smooth(u);
      P.hs[i] = 0.3 * smooth(u);
      if (u >= 1) { P.st[i] = 2; P.tt[i] = 0; P.td[i] = 30 + 20 * Math.random(); }
    } else if (s === 2) {
      P.al[i] = 0;
      P.gr[i] = 1 - 0.62 * smooth(u * 1.1);
      P.hs[i] = 1;
      if (u >= 1) reseed(P, i, zoom);
    } else {
      P.al[i] = smooth(P.tt[i] / 12);
      P.gr[i] = 0.34 + 0.66 * (1 - pow(1 - smooth(u), 1.6));
      P.hs[i] = 1 - smooth(u);
      if (u >= 1) { P.st[i] = 0; P.gr[i] = 1; P.al[i] = 1; P.hs[i] = 0; }
    }
  }
  // Live trees near a hole grow toward it, slowly.
  const k = 1 - exp(-dt / 20);
  for (let i = 0; i < NT; i++) {
    let w = 0;
    if (P.st[i] === 0 || P.st[i] === 3) {
      for (let j = 0; j < NT; j++) {
        if (P.hs[j] <= 0.001 || j === i) continue;
        const dx = P.cx[i] - P.cx[j], dy = P.cy[i] - P.cy[j];
        const e = (dx * dx + dy * dy) / (22 * 22);
        if (e < 4) w += P.hs[j] * exp(-e);
      }
    }
    P.rch[i] += (1 + 0.34 * min(1, w) - P.rch[i]) * k;
  }
}

// Value noise from two lattices, 64 by 64, wrapped.
function nz(A, B, x, y, c, s) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const i0 = xi & 63, i1 = (xi + 1) & 63, j0 = (yi & 63) << 6, j1 = ((yi + 1) & 63) << 6;
  const a0 = A[j0 + i0] + (A[j0 + i1] - A[j0 + i0]) * ux, a1 = A[j1 + i0] + (A[j1 + i1] - A[j1 + i0]) * ux;
  const b0 = B[j0 + i0] + (B[j0 + i1] - B[j0 + i0]) * ux, b1 = B[j1 + i0] + (B[j1 + i1] - B[j1 + i0]) * ux;
  return (a0 + (a1 - a0) * uy) * c + (b0 + (b1 - b0) * uy) * s;
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const season = cl(kv[0], 0, 1), wind = cl(kv[1], 0, 3), dens = cl(kv[2], -1, 1), gapk = cl(kv[3], -1, 1);
  const zt = pow(2, -0.4 * dens);
  if (!P.ready) {
    P.ready = true;
    P.zoom = zt;
    for (let i = 0; i < 480; i++) stepState(P, 0.25, zt);
    for (let i = 0; i < 40; i++) stepState(P, 0.25, zt);
  }
  if (abs(season - P.sc) > 1e-4) ramp(P, season);
  P.t += d;
  P.zoom += (zt - P.zoom) * (1 - exp(-d / 0.45));
  const zoom = P.zoom;
  stepState(P, d, zoom);
  // Two clocks that never stop and only run faster with the wind: sway, and the flutter of the leaves.
  P.cw += d * (0.55 + 0.3 * wind);
  P.cf += d * (0.35 + 0.3 * wind);
  const cw = P.cw, t = P.t;
  // Gusts come and go: the sway is from 0.4 to 1.3 times its steady size.
  const gust = 0.85 + 0.45 * wander(cw / 11 + 5.5, 2);
  const A = wind * 0.95 * gust;
  const gvx = 0.45 * A * wander(cw / 15, 3), gvy = 0.45 * A * wander(cw / 17, 4);
  const { px, py, ox, oy, rr, amp, cx, cy, lcr, lci } = P;
  for (let i = 0; i < NT; i++) {
    const sd = P.sd[i], c = 10 + i * 6;
    ox[i] = gvx + A * (0.8 * wander(cw / (4.5 + 0.045 * sd) + sd, c) + 0.35 * wander(cw / (1.9 + 0.017 * sd) + sd * 1.7, c + 1));
    oy[i] = gvy + A * (0.8 * wander(cw / (5.2 + 0.038 * sd) + sd * 0.6, c + 2) + 0.35 * wander(cw / (2.3 + 0.015 * sd) + sd * 2.3, c + 3));
    px[i] = CX + (cx[i] - CX) * zoom + ox[i];
    py[i] = CY + (cy[i] - CY) * zoom + oy[i];
    // The crown's own slow growth and shrinking, on its own clock.
    const grow = 1 + 0.15 * wander(t / (52 + 0.2 * sd) + sd, c + 4);
    rr[i] = R0 * zoom * P.rb[i] * P.gr[i] * P.rch[i] * grow;
    let sa = 0;
    const young = 0.4 + 0.6 * min(1, P.gr[i]);
    P.tn[i] = 0.1 * wander(t / (45 + 0.15 * sd) + sd * 1.3, c + 8);
    for (let k = 0; k < 3; k++) {
      const a = young * LA[k] * (0.75 + 0.5 * (0.5 + 0.5 * wander(t / (37 + 9 * k) + sd + k * 31, c + 5 + k)));
      const ph = P.lp[k][i] + P.lw[k][i] * (0.4 + 0.3 * wind) * P.cf;
      lcr[k][i] = a * cos(ph);
      lci[k][i] = a * sin(ph);
      sa += a;
    }
    amp[i] = sa;
  }
  render(P, kv, season, wind, gapk);
}

function render(P, kv, season, wind, gapk) {
  const { px, py, ox, oy, rr, amp, lcr, lci, lo, cand, out, ramp: RAMP, tA, tB, tC, tD, i1a, i2a, sva, q1a, q2a, tn, lf } = P;
  const t = P.t;
  const l0r = lcr[0], l0i = lci[0], l1r = lcr[1], l1i = lci[1], l2r = lcr[2], l2i = lci[2];
  // How wide the sky is: half the width, in LEDs.
  const hwBase = gapk <= 0.06 ? 1.0 + 0.3 * ((gapk + 1) / 1.06) : 1.3 + 1.7 * ((gapk - 0.06) / 0.94);
  // Noise angles. Each octave turns at a rate of its own.
  const cf = P.cf;
  const ang = [0.31 * cf + 1.1 * wander(cf / 40, 71), 0.52 * cf + 1.3 * wander(cf / 31, 72), 0.83 * cf + 1.5 * wander(cf / 23, 73)];
  const cs = [cos(ang[0]), cos(ang[1]), cos(ang[2])], sn = [sin(ang[0]), sin(ang[1]), sin(ang[2])];
  // Slow fields: the width of the sky along the net, and the brightness of the sky itself.
  const ca = 0.19 * t + 0.8 * wander(t / 60, 74), cb = 0.13 * t + 0.8 * wander(t / 80, 75);
  const caC = cos(ca), caS = sin(ca), cbC = cos(cb), cbS = sin(cb);
  // The sun: two patches of light where it comes through a gap onto leaves high up. The first is always there, the
  // second comes and goes. Each wanders about on its own clock.
  const sunX0 = 32 + 24 * cl(wander(t / 83, 76), -1, 1), sunY0 = 64 + 52 * cl(wander(t / 97, 77), -1, 1);
  const sunX1 = 32 + 26 * cl(wander(t / 71, 78), -1, 1), sunY1 = 64 + 54 * cl(wander(t / 109, 79), -1, 1);
  const sunS0 = 0.55 + 0.45 * cl(wander(t / 61, 80), -1, 1), sunS1 = smooth(0.5 + 0.9 * wander(t / 67, 81));
  const sunR0 = 9 + 3 * wander(t / 55, 82), sunR1 = 8 + 3 * wander(t / 49, 83);
  const sa = 2.3 + 1.2 * wander(t / 90, 84), sdx = cos(sa), sdy = sin(sa);
  // Pass one, in blocks of 8 by 8: which crowns can win an LED in the block. A crown wins an LED if its distance
  // over its radius (at best, with lobes) is no more than the second best crown's (at worst). Then for each LED
  // the two best crowns, by distance over radius with the lobes.
  const BS = 8, rho = 5.7;
  for (let by = 0; by < H / BS; by++)
    for (let bx = 0; bx < W / BS; bx++) {
      const mx = bx * BS + BS / 2, my = by * BS + BS / 2;
      let h1 = 1e9, h2 = 1e9;
      for (let i = 0; i < NT; i++) {
        const dx = mx - px[i], dy = my - py[i], dd = sqrt(dx * dx + dy * dy);
        const r = rr[i];
        const hi = (dd + rho) / (r * (1 - amp[i]));
        lo[i] = max(0, dd - rho) / (r * (1 + amp[i]));
        if (hi < h1) { h2 = h1; h1 = hi; } else if (hi < h2) h2 = hi;
      }
      let nc = 0;
      for (let i = 0; i < NT; i++) if (lo[i] <= h2) cand[nc++] = i;
      for (let yy = 0; yy < BS; yy++)
        for (let xx = 0; xx < BS; xx++) {
          const x = bx * BS + xx + 0.5, y = by * BS + yy + 0.5;
          let f1 = 1e9, f2 = 1e9, i1 = -1, i2 = -1, q1 = 1, q2 = 1;
          for (let c = 0; c < nc; c++) {
            const i = cand[c];
            const dx = x - px[i], dy = y - py[i];
            const dd = sqrt(dx * dx + dy * dy) + 1e-6;
            const u = dx / dd, v = dy / dd;
            const z2r = u * u - v * v, z2i = 2 * u * v;
            const z3r = z2r * u - z2i * v, z3i = z2r * v + z2i * u;
            const z4r = z2r * z2r - z2i * z2i, z4i = 2 * z2r * z2i;
            const z6r = z3r * z3r - z3i * z3i, z6i = 2 * z3r * z3i;
            const z10r = z6r * z4r - z6i * z4i, z10i = z6r * z4i + z6i * z4r;
            const L = 1 + l0r[i] * z3r - l0i[i] * z3i + l1r[i] * z6r - l1i[i] * z6i + l2r[i] * z10r - l2i[i] * z10i;
            const q = rr[i] * L, f = dd / q;
            if (f < f1) { f2 = f1; i2 = i1; q2 = q1; f1 = f; i1 = i; q1 = q; }
            else if (f < f2) { f2 = f; i2 = i; q2 = q; }
          }
          const p = (by * BS + yy) * W + bx * BS + xx;
          i1a[p] = i1; i2a[p] = i2; q1a[p] = q1; q2a[p] = q2;
          sva[p] = i1 < i2 ? f1 - f2 : f2 - f1;
        }
    }
  // Pass two: the distance to the edge between the two crowns in LEDs, which is f2 - f1 over how fast that
  // grows, read off the neighbours when they have the same two crowns, and then the colour.
  let lastA = -1, lastB = -1, hwPair = hwBase;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const i1 = i1a[p], i2 = i2a[p], q1 = q1a[p], q2 = q2a[p];
      const s0 = sva[p];
      const key = i1 < i2 ? i1 * NT + i2 : i2 * NT + i1;
      const same = (k) => {
        const a = i1a[k], b = i2a[k];
        return (a < b ? a * NT + b : b * NT + a) === key;
      };
      let gx = 0, gy = 0, ok = true;
      const hasL = x > 0 && same(p - 1), hasR = x < W - 1 && same(p + 1);
      const hasU = y > 0 && same(p - W), hasD = y < H - 1 && same(p + W);
      if (hasL && hasR) gx = (sva[p + 1] - sva[p - 1]) * 0.5; else if (hasR) gx = sva[p + 1] - s0; else if (hasL) gx = s0 - sva[p - 1]; else ok = false;
      if (hasU && hasD) gy = (sva[p + W] - sva[p - W]) * 0.5; else if (hasD) gy = sva[p + W] - s0; else if (hasU) gy = s0 - sva[p - W]; else ok = false;
      const an = 1 / q1 + 1 / q2;
      let gm = sqrt(gx * gx + gy * gy);
      // A wrong gradient, from LEDs the lobes bend differently, is held within a factor of the usual one.
      gm = ok ? cl(gm, 0.55 * an, 1.8 * an) : an;
      const g = abs(s0) / gm;
      if (i1 !== lastA || i2 !== lastB) {
        lastA = i1; lastB = i2;
        const ex = px[i2] - px[i1], ey = py[i2] - py[i1], el = sqrt(ex * ex + ey * ey) + 1e-6;
        // How far the two trees have swayed apart along the line between them.
        const sep = cl(((ox[i2] - ox[i1]) * ex + (oy[i2] - oy[i1]) * ey) / el, -4, 4);
        hwPair = max(1.0, hwBase + 0.22 * sep);
      }
      const xp = x + 0.5, yp = y + 0.5;
      // Slow wander of the width along the net.
      const wn = nz(tC, tD, xp / 22 + 3.1, yp / 22 + 1.7, caC, caS);
      const hw = max(1.0, hwPair * (1 + 0.3 * wn));
      // Noise for the leaves of the crown this LED is in, in the crown's own frame so it sways with it.
      const a1 = P.al[i1];
      const lx = xp - px[i1] + P.nox[i1] * 11.3, ly = yp - py[i1] + P.noy[i1] * 11.3;
      const n1 = nz(tA, tB, lx / 11, ly / 11, cs[0], sn[0]);
      let edge = 0, cover = 1, n2 = 0;
      if (a1 < 0.999) {
        const mc = cl(0.5 + 1.1 * n1, 0.05, 0.95);
        cover = cl((a1 * 1.5 - 0.25 - mc) / 0.3, 0, 1);
      }
      if (cover > 0) {
        n2 = nz(tA, tB, lx / 6 + 17, ly / 6 + 9, cs[1], sn[1]);
        // The edge of the crown is ragged a little, in clumps.
        edge = smooth((g + 0.5 * n2 - hw) / 1.15 + 0.5);
      }
      const alpha = edge * cover;
      P.alp[p] = alpha;
      // The sky.
      const sk = cl(0.5 + 1.1 * nz(tC, tD, xp / 40 + 9, yp / 40 + 4, cbC, cbS), 0, 1);
      let sr = mix(SKY0[0], SKY1[0], sk), sg = mix(SKY0[1], SKY1[1], sk), sb = mix(SKY0[2], SKY1[2], sk);
      const ax = (xp - sunX0) / sunR0, ay = (yp - sunY0) / (sunR0 * 1.4);
      const bx2 = (xp - sunX1) / sunR1, by2 = (yp - sunY1) / (sunR1 * 1.4);
      const e = min(1, sunS0 * exp(-(ax * ax + ay * ay)) + sunS1 * exp(-(bx2 * bx2 + by2 * by2)));
      const sw = 0.5 * e;
      sr = mix(sr, SKYSUN[0], sw); sg = mix(sg, SKYSUN[1], sw); sb = mix(sb, SKYSUN[2], sw);
      const o = p * 3;
      out[o] = sr; out[o + 1] = sg; out[o + 2] = sb;
      if (cover > 0 && g + 0.5 * n2 - hw > -3) {
        const n3 = nz(tA, tB, lx / 3.8 + 5, ly / 3.8 + 23, cs[2], sn[2]);
        let m = cl(0.5 + 0.95 * (0.5 * n1 + 0.32 * n2 + 0.18 * n3), 0, 1);
        m = mix(m, smooth((m - 0.3) / 0.4), 0.55); // clumps with soft edges
        const gi = max(0, g - hw);
        const rim = 0.46 * exp(-gi * 0.55) * (1 + 1.1 * e);
        const dome = 0.45 - 0.2 * smooth(g / (0.8 * q1));
        const dir = cl(((xp - px[i1]) * sdx + (yp - py[i1]) * sdy) / q1, -1, 1) * 0.1;
        let tl = rim + dome + (m - 0.5) * 0.8 + tn[i1] + 0.45 * e * (0.4 + 0.9 * m) + dir;
        tl = tl < 0 ? 0 : tl > 1 ? 1 : tl;
        const ri = ((tl * 255) | 0) * 3;
        lf[o] = RAMP[ri]; lf[o + 1] = RAMP[ri + 1]; lf[o + 2] = RAMP[ri + 2];
      }
    }
  // Pass three rounds the crowns: the leaf mask is blurred a pixel each way and cut again at one half, which
  // takes the sharp corners off the polygons and leaves a straight edge where it was.
  const { alp, alt } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, l = x > 0 ? p - 1 : p, r = x < W - 1 ? p + 1 : p;
      alt[p] = 0.25 * alp[l] + 0.5 * alp[p] + 0.25 * alp[r];
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, u = y > 0 ? p - W : p, d = y < H - 1 ? p + W : p;
      const ab = 0.25 * alt[u] + 0.5 * alt[p] + 0.25 * alt[d];
      const a = cl((ab - 0.5) * 1.8 + 0.5, 0, 1), o = p * 3;
      if (a > 0.003) {
        const R = out[o] + (lf[o] - out[o]) * a, G = out[o + 1] + (lf[o + 1] - out[o + 1]) * a, B = out[o + 2] + (lf[o + 2] - out[o + 2]) * a;
        out[o] = R > 255 ? 255 : R; out[o + 1] = G > 255 ? 255 : G; out[o + 2] = B > 255 ? 255 : B;
      }
    }
}

export function draw(display, P) {
  const { out } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, out[o], out[o + 1], out[o + 2]);
    }
}
