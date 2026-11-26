// ===== Patternflow pattern =====
// Title:   Tumbler Petals
// Family:  tumbler
// Idea:    Two thin drums seen end-on, each holding a bed of small teal and large amber grains that a soft-sphere simulation tumbles down the free surface in a thin avalanche, while a wandering field of petals decides where the flowing layer lays down fines and where it lays down large grains, so a core of fines pushes irregular petals out to the wall, lobes that drift, merge and split as the drums turn.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the thin rotating drum with two grain sizes and its radial segregation, a core of fines with streaks reaching the wall (Hill, Caprihan and Kakalios, 1997; Khakhar, McCarthy and Ottino, 1997; Zuriguel, Peixinho and Mullin, 2009, from memory); kinetic sieving in a dense flowing layer, small grains falling through the gaps and large ones riding to the toe (Savage and Lun, 1988; Gray and Thornton, 2005, from memory); the soft-sphere discrete element method, spring and dashpot normal force and a Coulomb-capped tangential spring (Cundall and Strack, 1979, from memory). Original here: the grains and the avalanche are a real simulation of two stacked drums, but the sorting is not computed, it is imposed, each grain in the flowing layer taking the size and colour that a wandering field of petals gives the place it is in, pattern round 262
// Round:   262
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3, Petals=-1..1, Grit=-1..1
//
// Knob 1: Hue. The two grains' colours, turning together round the wheel: teal fines and amber large grains at 0 and 1, purple fines in green at 0.25, red fines in blue at 0.5, lime fines in magenta at 0.75, each pair far enough apart in hue that the two kinds read at any setting.
// Knob 2: Speed. How fast the drums turn, which is also how thick and fast the avalanche runs: the upper drum takes 108 s a turn at 0.3, 16 s at 2 where it opens, 11 s at 3; the lower one is 20 percent slower; both speed up and slow down by a fifth over a minute or two.
// Knob 3: Petals. How many lobes the petal field has in each drum: 3 and 2 at -1, 5 and 3 at 0, 8 and 5 at 1 (upper and lower), so one drum shows a few fat petals and the other many thin ones, and a new lobe takes about half a minute to appear or fade after the knob moves.
// Knob 4: Grit. How rough the grains are on one another, the friction coefficient of a contact: 0.2 at -1, where the avalanche slides in a long thin sheet, 0.55 where it opens, 0.85 at 1, where the surface steepens and the grains tumble in clumps.

// What the picture is. Two drums 58 LED across, centred on rows 32 and 96, each a circle seen end-on, a dim ring for its wall that turns with it, and a bed of grains in the lower half. The upper bed
// has 150 grains, the lower 160, in two sizes: small grains 2.1 LED across (upper) and 2 LED (lower), large ones 4.4 LED and 6 LED, so the size ratios are 1 to 2.1 and 1 to 3. The grains are shaded
// discs with a soft highlight and a few percent of brightness and size scatter, so the fines do not fall into a perfect lattice.
// Simulation. A soft-sphere discrete element simulation of the Cundall and Strack kind, 3 ms to a step and about 12 steps to a frame. Each contact is a normal spring (12000 per LED, damping ratio 0.3)
// and a tangential spring that is remembered while the contact lasts and capped at Grit times the normal force; grains spin; gravity is 40 LED per second squared and tilts by up to 6 degrees on slow
// periods that do not divide one another. The wall is a ring of 89 pins that turn with the drum, so the bed cannot slip on it, and a smooth ring behind them. Neighbours come from a grid, a clamp
// holds speeds under 60 LED a second and overlaps under 0.7 LED, and a grain that ever gets out is put back at the rim. The drum turns at a Froude number (omega squared R over g) of 0.09 at Speed 2,
// in the rolling regime, with its speed wandering by up to a fifth. The bed turns with the drum and a layer a few grains deep avalanches continuously down its tilted surface.
// What is real and what is not. The packing, the avalanche, the grains riding up the wall and tumbling down the surface are the simulation. The sorting is not. I ran the simulation without it:
// at this size (150 grains to a drum) it sorts quickly into a core of fines in a complete shell of large grains, and the streaks that appear are one grain wide. A real thin drum
// needs the third dimension and many more grains to grow the petals, so I put the petals in as a model. Each drum has a field of lobes in its own frame, an angle, a width that grows toward the
// wall, a twist, a reach and a kind. The core of fines has radius 0.4 of the wall plus a shift that holds the bed's fill near its aim (58 percent upper, 64 lower; a bed that is too full gets more
// fines). A petal of fines is a lobe that pushes the edge of the core out to the wall in its angle, so fines reach the shell; a spur is a lobe, one in four, that pulls the edge in toward the
// centre, so large grains reach the core. A grain moving relative to the drum (the flowing layer, and a grain that is airborne) takes the radius the field gives the place it is in, 1.05 or 2.2
// for the upper drum, 1 or 3 for the lower, changing 1.6 LED a second, and its colour follows its radius. A grain at rest in the bed keeps what it has, so the layer paints the field into
// the bed as the bed passes through it, and the petals turn with the drum like streaks written on it. The lobes themselves drift (about 0.02 radian a second, a random walk), fade in and out
// over 14 s and live 70 to 220 s, a new one starting in the widest gap; two lobes of one kind that drift together merge, and one that grows too wide splits in two. So the flower wanders, merges
// and splits, and the part of the bed the layer has not yet reached shows the last flower. The centre of the core is a dead zone: grains deeper than the layer never flow, so they keep
// what they were seeded with.
// Start. Before the first frame each drum places its grains, large ones first and where the field wants them, settles them for 2.7 s of simulation with every grain following the field, then
// turns for half a revolution. That takes under a second for both drums, and the opening picture already has its core and its petals.
// Drawing. The wall ring is bright where a value noise of the angle is, turning with the drum. Each grain is a disc 5 percent smaller than its radius, its edge anti-aliased, with a sphere's
// shading from a lamp up and to the left and a small specular spot, so the gaps between grains stay dark and a 2 LED grain still reads as a bead.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, atan2, min, max, abs, pow, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
const wrap = (d) => d - TAU * round(d / TAU);

// ---- the drum and the contacts, in LED and in simulation seconds
const RW = 28; // LED from the drum's centre where a grain's edge stops
const RP = RW + 0.4, RPIN = 0.9; // pins on the wall, so the bed cannot slip on it
const NPIN = round((TAU * RP) / 2.0), DPIN = TAU / NPIN;
const G = 40; // gravity, LED per simulation second squared
const KN = 12000, KT = 6000; // normal and tangential springs
const ZETA = 0.3; // damping ratio of a contact
const DT = 0.003; // one step, simulation seconds
const SL = 8; // contacts remembered for each grain
const FR0 = 0.09; // Froude number of the drum at Speed 2: omega^2 R / g
const PRE = 0.5; // revolutions turned before the first frame
const GROW = 1.6; // LED a simulation second that a grain in the flowing layer changes its radius to follow the field

const DRUMS = [
  { cy: 32, nS: 100, nL: 50, rS: 1.05, rL: 2.2, speed: 1.0, ph: 0, petals: 5, rb: 0.4, fill: 0.58 },
  { cy: 96, nS: 130, nL: 30, rS: 1.0, rL: 3.0, speed: 0.83, ph: 2.1, petals: 3, rb: 0.4, fill: 0.64 },
];

function makeDrum(c) {
  const n = c.nS + c.nL;
  const D = {
    c, n, x: new Float64Array(n), y: new Float64Array(n), vx: new Float64Array(n), vy: new Float64Array(n),
    w: new Float64Array(n), fx: new Float64Array(n), fy: new Float64Array(n), tq: new Float64Array(n),
    r: new Float64Array(n), m: new Float64Array(n), I: new Float64Array(n), tr: new Float64Array(n), nxt: new Int32Array(n),
    jit: new Float32Array(n), pd: new Float32Array(n), gx: 0, gy: G, all: 0,
    sid: new Int32Array(n * SL).fill(-1), sxi: new Float64Array(n * SL), sst: new Int32Array(n * SL),
    stamp: 0, phi: 0, om: 0, cs: 0, gw: 0, head: null, lobes: [], nT: c.petals, rb: c.rb * RW, rbo: 0,
  };
  for (let i = 0; i < n; i++) {
    D.pd[i] = 0.9 + 0.2 * rnd(); // no two grains alike, so the fines do not crystallize
    D.r[i] = D.tr[i] = (i < c.nL ? c.rL : c.rS) * D.pd[i];
    D.jit[i] = 0.92 + 0.14 * rnd();
  }
  D.cs = 2 * c.rL + 0.05;
  D.gw = Math.ceil((2 * RW + 2) / D.cs) + 1;
  D.head = new Int32Array(D.gw * D.gw);
  for (let i = 0; i < n; i++) mass(D, i);
  return D;
}
function mass(D, i) {
  D.m[i] = D.r[i] * D.r[i];
  D.I[i] = 0.5 * D.m[i] * D.r[i] * D.r[i];
}
const isLarge = (D, i) => D.r[i] > 0.5 * (D.c.rS + D.c.rL) * 0.97;

// ---- the petals: lobes in the drum's own frame that say, at each place, whether the flowing layer lays down fines or large grains
const RMIN = 0.3 * RW, REACH = RW + 3;
function newLobe(D, th, a, age) {
  const s = rnd() < 0.25 ? -1 : 1;
  const w = ((0.85 + 0.5 * rnd()) * 1.45) / max(2.5, D.nT) * (s > 0 ? 1 : 0.6);
  return { th, vth: 0.02 * gauss(), w, tw: 0.9 * gauss(), a, am: s > 0 ? 0.82 + 0.18 * rnd() : 0.6 + 0.4 * rnd(), s, age, life: 70 + 150 * rnd() };
}
function bound(D, th, r) {
  const f = r / RW, bs = D.lobes, rb = D.rb + D.rbo;
  let B = rb;
  for (let k = 0; k < bs.length; k++) {
    const b = bs[k];
    if (b.a < 0.01) continue;
    const d = wrap(th - b.th - b.tw * (f - 0.5)), w = b.w * (0.45 + 0.55 * f);
    const v = b.a * b.am * exp(-0.5 * (d * d) / (w * w));
    if (b.s > 0) { const t = rb + (REACH - rb) * v; if (t > B) B = t; }
    else { const t = rb - (rb - RMIN) * v; if (t < B) B = t; }
  }
  return B;
}
function stepLobes(D, dt) {
  const bs = D.lobes;
  let living = 0;
  for (let k = bs.length - 1; k >= 0; k--) {
    const b = bs[k];
    b.age += dt;
    b.th += b.vth * dt;
    b.vth += (-b.vth / 30) * dt + 0.028 * sqrt(dt / 15) * gauss();
    const over = b.age - b.life;
    b.a = ss(0, 14, b.age) * (1 - ss(0, 14, over));
    if (over > 14) { bs.splice(k, 1); continue; }
    if (over < 0) living++;
  }
  const want = max(2, round(D.nT));
  if (living < want) {
    // a new lobe in the widest gap
    const th = bs.filter((b) => b.age < b.life).map((b) => wrap(b.th)).sort((a, b) => a - b);
    let best = rnd() * TAU - PI, gap = 0;
    for (let k = 0; k < th.length; k++) {
      const a = th[k], b = k + 1 < th.length ? th[k + 1] : th[0] + TAU;
      if (b - a > gap) { gap = b - a; best = a + (b - a) * (0.5 + 0.22 * gauss()); }
    }
    bs.push(newLobe(D, best, 0, 0));
  } else if (living > want) {
    let oldest = null;
    for (const b of bs) if (b.age < b.life && (!oldest || b.age > oldest.age)) oldest = b;
    if (oldest) oldest.life = oldest.age;
  }
  // lobes of one kind that drift into one another merge; a petal that grows too wide splits in two
  for (let i = 0; i < bs.length; i++) {
    const a = bs[i];
    if (a.age < 10 || a.age >= a.life) continue;
    for (let j = i + 1; j < bs.length; j++) {
      const b = bs[j];
      if (b.age < 10 || b.age >= b.life || b.s !== a.s) continue;
      const d = wrap(a.th - b.th);
      if (abs(d) < 0.7 * (a.w + b.w)) {
        a.th -= (d * b.w) / (a.w + b.w);
        a.w = min(0.7, a.w + 0.5 * b.w);
        a.vth = 0.5 * (a.vth + b.vth);
        b.life = b.age;
        break;
      }
    }
    if (a.w > (a.s > 0 ? 0.45 : 0.3) && a.age > 20) {
      const w0 = a.w, c = newLobe(D, a.th + 0.55 * w0, a.a, 14);
      c.s = a.s;
      c.w = 0.6 * w0;
      a.w = 0.6 * w0;
      a.th -= 0.55 * w0;
      bs.push(c);
    }
  }
}

// random sequential placement, large grains first, in the lower part of the drum, the large ones where the field gives large grains
function scatter(D) {
  const n = D.n, order = [];
  for (let i = 0; i < n; i++) order.push(i);
  order.sort((a, b) => D.r[b] - D.r[a]);
  let top = -RW * 0.2;
  for (let tries = 0; tries < 80; tries++) {
    const placed = [];
    let ok = true;
    for (const i of order) {
      let done = false;
      for (let a = 0; a < 300 && !done; a++) {
        const px = (rnd() * 2 - 1) * RW, py = top + rnd() * (RW - top), rho = sqrt(px * px + py * py);
        if (rho > RW - D.r[i] - 0.1) continue;
        if (D.r[i] > D.c.rS * 1.45 && rho < bound(D, atan2(py, px), rho) - 1 && rnd() < 0.9) continue;
        let free = true;
        for (let q = 0; q < placed.length; q++) {
          const j = placed[q], dx = D.x[j] - px, dy = D.y[j] - py, rr = D.r[i] + D.r[j] + 0.05;
          if (dx * dx + dy * dy < rr * rr) { free = false; break; }
        }
        if (free) { D.x[i] = px; D.y[i] = py; placed.push(i); done = true; }
      }
      if (!done) { ok = false; break; }
    }
    if (ok) return;
    top -= 1.0;
  }
  for (let i = 0; i < n; i++) { D.x[i] = (rnd() - 0.5) * RW; D.y[i] = rnd() * RW * 0.5; }
}

// ---- the integrator: module-level views of the drum being stepped
let X, Y, VX, VY, WW, FX, FY, TQ, R, M, SID, SXI, SST, STAMP, MU = 0.5;
function contact(i, j) {
  const dx = X[j] - X[i], dy = Y[j] - Y[i], rr = R[i] + R[j];
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return;
  const d = sqrt(d2) + 1e-9, nx = dx / d, ny = dy / d;
  let dl = rr - d;
  if (dl > 0.7) dl = 0.7;
  const rvx = VX[i] - WW[i] * R[i] * ny - (VX[j] + WW[j] * R[j] * ny);
  const rvy = VY[i] + WW[i] * R[i] * nx - (VY[j] - WW[j] * R[j] * nx);
  const vn = rvx * nx + rvy * ny, vt = -rvx * ny + rvy * nx;
  const gn = 2 * ZETA * sqrt((KN * M[i] * M[j]) / (M[i] + M[j]));
  let Fn = KN * dl + gn * vn;
  if (Fn < 0) Fn = 0;
  const o = i < j ? i : j, pj = i < j ? j : i;
  let k = -1, free = -1;
  for (let s = 0; s < SL; s++) {
    const q = SID[o * SL + s];
    if (q === pj) { k = s; break; }
    if (q < 0 && free < 0) free = s;
  }
  let xi = 0;
  if (k >= 0) xi = SXI[o * SL + k];
  else if (free >= 0) { k = free; SID[o * SL + k] = pj; }
  xi += vt * DT;
  let Ft = -KT * xi - 0.5 * gn * vt;
  const lim = MU * Fn;
  if (Ft > lim) { Ft = lim; xi = -(Ft + 0.5 * gn * vt) / KT; }
  else if (Ft < -lim) { Ft = -lim; xi = -(Ft + 0.5 * gn * vt) / KT; }
  if (k >= 0) { SXI[o * SL + k] = xi; SST[o * SL + k] = STAMP; }
  const ax = -Fn * nx - Ft * ny, ay = -Fn * ny + Ft * nx;
  FX[i] += ax; FY[i] += ay; FX[j] -= ax; FY[j] -= ay;
  TQ[i] += R[i] * Ft; TQ[j] += R[j] * Ft;
}

function step(D) {
  const n = D.n, gw = D.gw, cs = D.cs, head = D.head, nxt = D.nxt;
  X = D.x; Y = D.y; VX = D.vx; VY = D.vy; WW = D.w; FX = D.fx; FY = D.fy; TQ = D.tq; R = D.r; M = D.m;
  SID = D.sid; SXI = D.sxi; SST = D.sst;
  STAMP = ++D.stamp;
  const om0 = D.om, tr = D.tr, c = D.c, dr = GROW * DT;
  // a grain that is flowing along the free surface takes the size the field gives the place it is in
  if (STAMP % 6 === 0)
    for (let i = 0; i < n; i++) {
      const rho = sqrt(X[i] * X[i] + Y[i] * Y[i]);
      tr[i] = (c.rS + (c.rL - c.rS) * ss(-1.5, 1.5, rho - bound(D, atan2(Y[i], X[i]) - D.phi, rho))) * D.pd[i];
    }
  for (let i = 0; i < n; i++) {
    FX[i] = D.gx * M[i]; FY[i] = D.gy * M[i]; TQ[i] = 0;
    let l = D.all;
    if (l < 1) {
      const dvx = VX[i] + om0 * Y[i], dvy = VY[i] - om0 * X[i], vr2 = dvx * dvx + dvy * dvy;
      if (vr2 > 1) { const vr = sqrt(vr2); l = vr > 3 ? 1 : (vr - 1) * 0.5; }
      else l = 0;
    }
    if (l > 0 && abs(tr[i] - R[i]) > 1e-4) {
      R[i] += cl(tr[i] - R[i], -dr * l, dr * l);
      M[i] = R[i] * R[i];
      D.I[i] = 0.5 * M[i] * R[i] * R[i];
    }
  }
  head.fill(-1);
  const off = RW + 1;
  for (let i = 0; i < n; i++) {
    const cx = ((X[i] + off) / cs) | 0, cy = ((Y[i] + off) / cs) | 0;
    const cc = (cy < 0 ? 0 : cy >= gw ? gw - 1 : cy) * gw + (cx < 0 ? 0 : cx >= gw ? gw - 1 : cx);
    nxt[i] = head[cc];
    head[cc] = i;
  }
  for (let cy = 0; cy < gw; cy++)
    for (let cx = 0; cx < gw; cx++) {
      const c0 = cy * gw + cx;
      for (let i = head[c0]; i >= 0; i = nxt[i]) {
        for (let j = nxt[i]; j >= 0; j = nxt[j]) contact(i, j);
        if (cx + 1 < gw) for (let j = head[c0 + 1]; j >= 0; j = nxt[j]) contact(i, j);
        if (cy + 1 < gw) {
          for (let j = head[c0 + gw]; j >= 0; j = nxt[j]) contact(i, j);
          if (cx > 0) for (let j = head[c0 + gw - 1]; j >= 0; j = nxt[j]) contact(i, j);
          if (cx + 1 < gw) for (let j = head[c0 + gw + 1]; j >= 0; j = nxt[j]) contact(i, j);
        }
      }
    }
  for (let q = 0; q < n * SL; q++) if (SST[q] !== STAMP) SID[q] = -1;
  // the wall: pins that turn with the drum, and a smooth ring behind them
  const om = D.om, phi = D.phi;
  for (let i = 0; i < n; i++) {
    const rho = sqrt(X[i] * X[i] + Y[i] * Y[i]);
    if (rho + R[i] > RP - RPIN - 0.01) {
      const k0 = round((atan2(Y[i], X[i]) - phi) / DPIN);
      for (let k = k0 - 1; k <= k0 + 1; k++) {
        const pa = phi + k * DPIN, px = RP * cos(pa), py = RP * sin(pa), pvx = -om * py, pvy = om * px;
        const dx = px - X[i], dy = py - Y[i], rr = R[i] + RPIN, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = sqrt(d2) + 1e-9, nx = dx / d, ny = dy / d;
        let dl = rr - d;
        if (dl > 0.7) dl = 0.7;
        const rvx = VX[i] - WW[i] * R[i] * ny - pvx, rvy = VY[i] + WW[i] * R[i] * nx - pvy;
        const vn = rvx * nx + rvy * ny, vt = -rvx * ny + rvy * nx;
        const gn = 2 * ZETA * sqrt(KN * M[i]);
        let Fn = KN * dl + gn * vn;
        if (Fn < 0) Fn = 0;
        let Ft = -gn * 0.7 * vt;
        const lim = 0.8 * Fn;
        if (Ft > lim) Ft = lim; else if (Ft < -lim) Ft = -lim;
        FX[i] += -Fn * nx - Ft * ny; FY[i] += -Fn * ny + Ft * nx; TQ[i] += R[i] * Ft;
      }
    }
    if (rho + R[i] > RW) {
      const nx = X[i] / rho, ny = Y[i] / rho;
      let dl = rho + R[i] - RW;
      if (dl > 0.7) dl = 0.7;
      const vn = VX[i] * nx + VY[i] * ny;
      const gn = 2 * ZETA * sqrt(KN * M[i]);
      let Fn = KN * dl + gn * vn;
      if (Fn < 0) Fn = 0;
      const tx = -ny, ty = nx;
      const vrel = VX[i] * tx + VY[i] * ty + WW[i] * R[i] - om * RW;
      let Ft = -gn * 0.7 * vrel;
      const lim = 0.8 * Fn;
      if (Ft > lim) Ft = lim; else if (Ft < -lim) Ft = -lim;
      FX[i] += -Fn * nx + Ft * tx; FY[i] += -Fn * ny + Ft * ty; TQ[i] += R[i] * Ft;
    }
  }
  const air = 0.4;
  for (let i = 0; i < n; i++) {
    VX[i] += (FX[i] / M[i]) * DT - air * VX[i] * DT;
    VY[i] += (FY[i] / M[i]) * DT - air * VY[i] * DT;
    WW[i] += (TQ[i] / D.I[i]) * DT - air * WW[i] * DT;
    const v2 = VX[i] * VX[i] + VY[i] * VY[i];
    if (v2 > 3600) { const f = 60 / sqrt(v2); VX[i] *= f; VY[i] *= f; }
    if (WW[i] > 60) WW[i] = 60; else if (WW[i] < -60) WW[i] = -60;
    X[i] += VX[i] * DT; Y[i] += VY[i] * DT;
    // a grain that got out of the drum is put back at the rim
    const rho = sqrt(X[i] * X[i] + Y[i] * Y[i]);
    if (rho > RW - R[i] + 0.8) {
      const f = (RW - R[i] - 0.2) / rho;
      X[i] *= f; Y[i] *= f; VX[i] = 0; VY[i] = 0;
    }
    if (!(rho >= 0)) { X[i] = 0; Y[i] = RW * 0.5; VX[i] = VY[i] = 0; }
  }
  D.phi += om * DT;
}

const OM0 = sqrt((FR0 * G) / RW); // rad per simulation second at Speed 2
const SIMRATE = 1.08; // simulation seconds per panel second

function knobs(k) {
  const grit = cl(k[3], -1, 1);
  return { hue: k[0], spd: cl(k[1], 0.3, 3), pet: cl(k[2], -1, 1), mu: 0.2 + 0.65 * 0.5 * (grit + 1) };
}

// the drum's speed wanders and gravity tilts a little, on periods that do not divide one another
function drive(S, D, P) {
  const t = S.t, ph = D.c.ph;
  const w = 1 + 0.22 * (0.55 * sin(0.153 * t + ph) + 0.45 * sin(0.0557 * t + 2 * ph + 1));
  D.om = OM0 * (P.spd / 2) * D.c.speed * w;
  const b = 0.11 * (0.6 * sin(0.119 * t + ph + 2) + 0.4 * sin(0.0431 * t + 3 * ph));
  D.gx = G * sin(b);
  D.gy = G * cos(b);
  D.nT = D.c.petals * pow(2, 0.7 * P.pet);
}

// the bed fills as much as its grain count and the mix of sizes allow: nudge the shell's inner edge to keep the fill near its aim
function fillNow(D) {
  let a = 0;
  for (let i = 0; i < D.n; i++) a += D.r[i] * D.r[i];
  return (PI * a) / (0.82 * PI * RW * RW);
}

function keepFill(D, dt) {
  D.rbo = cl(D.rbo + (fillNow(D) - D.c.fill) * 40 * dt, -0.3 * RW, 0.42 * RW);
}

export function setup(params) {
  params.s = { ready: false, t: 0, acc: 0, drums: [], ks: [0, 2, 0, 0.06], buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    const P = knobs(S.ks);
    for (const c of DRUMS) {
      const D = makeDrum(c);
      D.nT = c.petals * pow(2, 0.7 * P.pet);
      for (let k = 0; k < round(D.nT) + 1; k++) D.lobes.push(newLobe(D, rnd() * TAU, 1, 20 + 40 * rnd()));
      scatter(D);
      MU = P.mu;
      D.all = 1; // while it settles every grain takes the size the field gives its place
      for (let k = 0; k < 900; k++) {
        step(D);
        if (k % 30 === 29) keepFill(D, 0.1);
      }
      D.all = 0;
      drive(S, D, P);
      const steps = round(PRE * TAU / D.om / DT);
      for (let k = 0; k < steps; k++) {
        step(D);
        if (k % 100 === 99) {
          stepLobes(D, (100 * DT) / SIMRATE);
          keepFill(D, (100 * DT) / SIMRATE);
        }
      }
      S.drums.push(D);
    }
    S.t = 0;
  }
  const e = 1 - exp(-d / 0.3);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  const P = knobs(S.ks);
  S.acc += d * SIMRATE;
  let steps = 0;
  while (S.acc >= DT && steps < 60) { S.acc -= DT; steps++; }
  if (S.acc > DT * 4) S.acc = 0;
  MU = P.mu;
  for (const D of S.drums) {
    drive(S, D, P);
    for (let k = 0; k < steps; k++) step(D);
    stepLobes(D, d);
    keepFill(D, d);
  }
  S.t += d;
}

// ---- drawing
function hsv(h, s, v, out) {
  h = (((h % 1) + 1) % 1) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const r = [v, q, p, p, t, v][i % 6], g = [t, v, v, q, p, p][i % 6], b = [p, p, t, v, v, q][i % 6];
  out[0] = r * 255; out[1] = g * 255; out[2] = b * 255;
}

const cS = [0, 0, 0], cL = [0, 0, 0];
const LX = -0.45, LY = -0.6, LZ = 0.66;
const LN = sqrt(LX * LX + LY * LY + LZ * LZ);
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const buf = S.buf;
  buf.fill(0);
  hsv(0.49 + S.ks[0], 0.78, 1.0, cS);
  hsv(0.49 + S.ks[0] - 0.39, 0.9, 0.92, cL);
  for (let q = 0; q < S.drums.length; q++) {
    const D = S.drums[q], cy0 = D.c.cy, cx0 = 32;
    // wall and floor of the drum
    const y0 = max(0, floor(cy0 - 31)), y1 = min(H - 1, floor(cy0 + 31));
    for (let py = y0; py <= y1; py++)
      for (let px = 0; px < W; px++) {
        const dx = px + 0.5 - cx0, dy = py + 0.5 - cy0, rho = sqrt(dx * dx + dy * dy);
        let r = 0, g = 0, b = 0;
        if (rho < 29.8) {
          const inside = 1 - ss(28.2, 28.8, rho);
          r += 4 * inside; g += 6 * inside; b += 8 * inside;
          const ring = ss(28.3, 28.9, rho) * (1 - ss(29.3, 29.9, rho));
          const a = atan2(dy, dx) - D.phi;
          const m = 0.62 + 0.38 * (0.5 * sin(3 * a + 1.3) + 0.3 * sin(5 * a + 0.4) + 0.2 * sin(8 * a));
          r += 66 * ring * m; g += 78 * ring * m; b += 90 * ring * m;
        }
        const o = (py * W + px) * 3;
        buf[o] = r; buf[o + 1] = g; buf[o + 2] = b;
      }
    for (let i = 0; i < D.n; i++) {
      const gx = cx0 + D.x[i], gy = cy0 + D.y[i], rr = D.r[i] * 0.95, c = (isLarge(D, i)) ? cL : cS, jt = D.jit[i];
      const xa = max(0, floor(gx - rr - 1)), xb = min(W - 1, floor(gx + rr + 1)), ya = max(0, floor(gy - rr - 1)), yb = min(H - 1, floor(gy + rr + 1));
      for (let py = ya; py <= yb; py++)
        for (let px = xa; px <= xb; px++) {
          const dx = px + 0.5 - gx, dy = py + 0.5 - gy, dd = sqrt(dx * dx + dy * dy);
          const cv = cl(rr + 0.5 - dd, 0, 1);
          if (cv <= 0) continue;
          const u = min(1, dd / rr), z = sqrt(1 - u * u);
          const nx = dx / rr, ny = dy / rr;
          const lam = max(0, (nx * LX + ny * LY + z * LZ) / LN);
          const diff = 0.42 + 0.72 * lam;
          const hx = LX / LN, hy = LY / LN, hz = LZ / LN + 1, hn = sqrt(hx * hx + hy * hy + hz * hz);
          const nh = max(0, (nx * hx + ny * hy + z * hz) / hn);
          const spec = pow(nh, 18) * 0.4;
          const o = (py * W + px) * 3;
          for (let ch = 0; ch < 3; ch++) {
            const v = c[ch] * diff * jt + 255 * spec;
            buf[o + ch] += (v - buf[o + ch]) * cv;
          }
        }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, cl(buf[o], 0, 255) | 0, cl(buf[o + 1], 0, 255) | 0, cl(buf[o + 2], 0, 255) | 0);
    }
}
