// ===== Patternflow pattern =====
// Title:   Dust Gaps
// Family:  protodisk
// Idea:    A young star's dust disk seen tilted, as ALMA sees it, where young planets cut dark gaps into the gas, grains drifting toward each gap's pressure maximum pile up into thin bright rings, and a crescent vortex, a faint spiral wake and short arcs of dust go round at the Keplerian rate of their own radius.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: dust trapped in gas pressure maxima (Sijme-Jan Paardekooper and Gijs Mellema, 2004; Paola Pinilla and colleagues, 2012, from memory), grains of Stokes number St drifting at 2 St eta v_K / (1 + St^2) (Stuart Weidenschilling, 1977), a planet opening a gap in a disk (Douglas Lin and John Papaloizou, 1986) with the depth law 1 / (1 + 0.04 K) (Yasuhiro Kanagawa and colleagues, 2015, from memory), the rings of HL Tau (ALMA Partnership, 2015), vortices from the Rossby wave instability at a gap edge (Richard Lovelace and colleagues, 1999, from memory), the spiral wake of a planet (Gordon Ogilvie and Stephen Lubow, 2002, from memory), pattern round 225
// Round:   225
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Mass=0..4, Grain=-1..1, Tilt=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel and comes back at 1. At 0 the dust runs from plum through rose and amber to a white-yellow core on indigo-black, with a cool blue haze of scattered light; at 0.5 it is teal to ice on a rust ground.
// Knob 2: Mass. How heavy the planets are, 0.16 Jupiter masses times 2^(0.95 K) for the lightest of them: 0.16 at 0, 0.6 at 2 where it opens, 2.3 at 4. At 0 the gaps are shallow and the rings low and faint and there is no vortex; at 2 there are four clear gaps; at 4 the gaps are deep and 8 to 9 LEDs wide, the rings crowd together and the vortex and the spiral wake are strong.
// Knob 3: Grain. The Stokes number of the dust, 0.045 times 6^K: 0.0075 at -1, 0.045 at 0, 0.27 at 1. At -1 the grains hold to the gas and the disk is smooth with ghost gaps; at 0 the rings are about 5 LEDs wide on the long axis; at 1 the dust is trapped hard and the rings are thin, about 3 LEDs, with dark gaps between.
// Knob 4: Tilt. The inclination of the disk, 20 degrees at -1, a round disk 70 LEDs across, 60 at 0.06 where it opens, 75 at 1, a thin lens 124 LEDs tall and 32 wide. The near side, to the right, is up to 30 percent brighter than the far side.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, sqrt, exp, log, sin, cos, atan2, pow, abs, min, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// The disk is laid out in radius r, 0 at the star and 1 at the edge, on NC cells.
// It is a mix of two clocks: the dust moves and gaps drift by the clock of this file,
// and anything that orbits turns at Omega(r) = OM1 r^(-3/2), so it goes round once in 180 s at r = 1,
// 64 s at 0.5 and 16 s at 0.2.
const NC = 128, DRC = 1 / NC;
const OM1 = TAU / 180;
const PRE = 90; // seconds of dust evolution run in the first update, from a smooth disk
const U = 0.4; // drift speed: v = U s(St) r d(ln P)/dr, disk radii a second
const DIFF = 7e-4; // dust diffusion, disk radii squared a second
const TRELAX = 130; // s, the time in which grinding of bigger bodies fills the disk back up toward the smooth profile
const TS = 0.52; // optical depth of the smooth disk at r = 0.5 on the way through
const VCAP = 0.07;

// Planets. Five slots, each with a home radius, two slow wanders that do not share a period, a mass factor
// and a breathing of mass. Slots 2 and 4 swap: slot 4 grows into a planet at 0.55 while slot 2 at 0.645 fades
// (the swap clock has a period of 421 s), so a gap closes, a new one opens a little in, and the rings move.
const SL = [
  { r0: 0.30, a1: 0.020, t1: 641, p1: 0.3, a2: 0.010, t2: 233, p2: 3.1, mult: 0.9, te: 389, pe: 1.0 },
  { r0: 0.48, a1: 0.030, t1: 797, p1: 3.1, a2: 0.012, t2: 311, p2: 0.2, mult: 1.3, te: 457, pe: 2.2 },
  { r0: 0.66, a1: 0.032, t1: 953, p1: 6.0, a2: 0.010, t2: 277, p2: 3.0, mult: 1.1, te: 0, pe: 0 },
  { r0: 0.84, a1: 0.018, t1: 877, p1: 0.0, a2: 0.008, t2: 347, p2: 0.0, mult: 1.5, te: 521, pe: 4.1 },
  { r0: 0.57, a1: 0.026, t1: 701, p1: 0.4, a2: 0.009, t2: 293, p2: 3.1, mult: 1.2, te: 0, pe: 0 },
];
const NS = SL.length;

// Palette: plum, rose, amber, peach, white-yellow, on indigo-black.
const STOPS = [
  [0.0, 4, 2, 16], [0.08, 30, 8, 56], [0.2, 120, 20, 95], [0.38, 214, 48, 90], [0.56, 255, 112, 60],
  [0.72, 255, 160, 62], [0.85, 255, 200, 125], [0.94, 255, 228, 170], [1.0, 255, 246, 215],
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Turn a colour round the wheel by `turn` of a full circle.
function spin(r, g, b, turn, out, o) {
  r /= 255; g /= 255; b /= 255;
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  const s = mx > 0 ? d / mx : 0;
  h = (h + turn) % 1;
  if (h < 0) h += 1;
  const i = floor(h * 6), f = h * 6 - i;
  const p = mx * (1 - s), q = mx * (1 - f * s), t = mx * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? mx : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? mx : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? mx : k === 2 ? t : k === 5 ? q : p) * 255;
}

function palette(P, turn) {
  P.hc = turn;
  const pal = P.pal;
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let j = 0;
    while (j < STOPS.length - 2 && v > STOPS[j + 1][0]) j++;
    const a = STOPS[j], b = STOPS[j + 1];
    const u = cl((v - a[0]) / (b[0] - a[0]), 0, 1);
    spin(a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u, turn, pal, i * 3);
  }
  spin(80, 100, 255, turn, P.cool, 0);
}

export function setup(P) {
  P.rand = rng(225225);
  P.ready = false;
  P.t = 0;
  P.T = 0;
  P.hc = -9;
  P.inc = -1;
  P.pal = new Float32Array(256 * 3);
  P.cool = new Float32Array(3);
  // Radial state, cells at r = (c + 0.5) / NC.
  P.sd = new Float64Array(NC);       // dust surface density, 1 at r = 0.5 in the smooth disk
  P.sg = new Float64Array(NC);       // gas surface density
  P.lp = new Float64Array(NC);       // ln of gas pressure
  P.s0 = new Float64Array(NC);       // the smooth profile
  P.sp = new Float64Array(NC);       // the smooth gas profile
  P.vf = new Float64Array(NC + 1);   // drift velocity on the faces
  P.fl = new Float64Array(NC + 1);   // flux on the faces
  P.sl = new Float64Array(NC);       // slopes
  P.tf = new Float64Array(NC);       // optical depth per unit of dust, with temperature
  P.tau = new Float32Array(NC + 2);  // optical depth shown, two zero cells on the end
  P.cs = new Float32Array(NC + 2);   // scattered light by cell
  for (let c = 0; c < NC; c++) {
    const r = (c + 0.5) * DRC;
    const cav = smooth((r - 0.1) / 0.08);
    const edge = 1 - smooth((r - 0.9) / 0.1);
    P.sp[c] = (0.5 / r) * cav * edge;
    P.s0[c] = P.sp[c];
    P.tf[c] = TS * (0.4 + 1.9 * r * r);
  }
  P.pr = new Float64Array(NS);
  P.pm = new Float64Array(NS);
  P.pf = new Float64Array(NS);
  P.ps = new Float64Array(NS);
  P.ph = new Float64Array(NS);
  for (let k = 0; k < NS; k++) P.ph[k] = 6.28 * P.rand();
  P.rings = [];
  // Per pixel, by the tilt.
  P.mc = new Float32Array(NPX);
  P.ms = new Float32Array(NPX);
  P.ia = new Int16Array(NPX);
  P.ib = new Int16Array(NPX);
  P.fa = new Float32Array(NPX);
  P.fb = new Float32Array(NPX);
  P.lf = new Float32Array(NPX);
  P.ho = new Float32Array(NPX);
  P.bs = new Int32Array(NC + 1);
  P.bi = new Int32Array(NPX);
  P.mul = new Float32Array(NPX);
  P.add = new Float32Array(NPX);
  P.sca = new Float32Array(NPX);
  P.glow = new Float32Array(NPX);
  P.S = 62;
  P.bw = new Float64Array(7);
  {
    let z = 0;
    for (let j = -3; j <= 3; j++) z += P.bw[j + 3] = exp(-(j * j) / (2 * 1.8 * 1.8));
    for (let j = 0; j < 7; j++) P.bw[j] /= z;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - 32, dy = y + 0.5 - 64;
      const d = sqrt(dx * dx + dy * dy);
      P.glow[y * W + x] = 5 * exp(-(d * d) / (2 * 1.25 * 1.25)) + 0.9 * exp(-(d * d) / (2 * 2.8 * 2.8)) + 0.14 * exp(-d / 5);
    }
  // Dust arcs and vortices.
  P.arcs = [];
  for (let i = 0; i < 7; i++) P.arcs.push({ c: 40, phi: 0, L: 6, amp: 0, age: 0, life: 1 });
  P.vort = [
    { age: 95, life: 380, host: 2, phi: 1.3, mf: 0, c: 60 },
    { age: -230, life: 330, host: 1, phi: 4.4, mf: 0, c: 40 },
  ];
  P.nextHost = 3;
}

// The planets at clock T: radius, mass in Jupiter masses, depth of the gas gap and its width.
function planets(P, T, M) {
  const alpha = 8e-4 * (1 + 0.3 * sin((TAU * T) / 691 + 0.4));
  const w = smooth((sin((TAU * T) / 421 - 2.243) - 0.45) / 0.35);
  for (let k = 0; k < NS; k++) {
    const s = SL[k];
    const Tw = T - PRE;
    const r = s.r0 + s.a1 * sin((TAU * Tw) / s.t1 + s.p1) + s.a2 * sin((TAU * Tw) / s.t2 + s.p2);
    const e = k === 2 ? 1 - 0.92 * w : k === 4 ? w : 0.88 + 0.12 * sin((TAU * T) / s.te + s.pe);
    const m = M * s.mult * e;
    const q = m * 9.5e-4;
    const h = 0.062 * pow(r / 0.5, 0.25);
    const K = (q * q) / (pow(h, 5) * alpha);
    P.pr[k] = r;
    P.pm[k] = m;
    P.pf[k] = 1 / (1 + 0.04 * K);
    P.ps[k] = cl(0.72 * r * h * (0.5 + 0.08 * pow(K, 0.25)), 0.022, 0.05);
  }
}

// Gas: the smooth profile with a Gaussian gap at every planet, and its pressure.
function gas(P) {
  const { sg, sp, lp, pr, pf, ps } = P;
  for (let c = 0; c < NC; c++) {
    const r = (c + 0.5) * DRC;
    let g = sp[c];
    for (let k = 0; k < NS; k++) {
      const d = (r - pr[k]) / ps[k];
      if (d < 4 && d > -4) g *= 1 - (1 - pf[k]) * exp(-0.5 * d * d);
    }
    sg[c] = g;
    lp[c] = log(g * pow(r, -0.5) + 1e-5);
  }
}

const minmod = (a, b) => (a * b <= 0 ? 0 : abs(a) < abs(b) ? a : b);

// Dust: drift up the pressure gradient, diffusion against the gas, and the slow fill back toward the smooth disk.
function dust(P, dt, st) {
  const { sd, sg, vf, fl, sl, s0 } = P;
  const sfac = st / (1 + st * st);
  let vmax = 0;
  for (let f = 1; f < NC; f++) {
    const v = cl(U * sfac * (f * DRC) * ((P.lp[f] - P.lp[f - 1]) / DRC), -VCAP, VCAP);
    vf[f] = v;
    if (abs(v) > vmax) vmax = abs(v);
  }
  vf[0] = vf[NC] = 0;
  const n = max(1, ceil((vmax * dt) / (0.25 * DRC)), ceil((3.2 * DIFF * dt) / (DRC * DRC)));
  const h = dt / n;
  for (let s = 0; s < n; s++) {
    for (let c = 1; c < NC - 1; c++) sl[c] = minmod(sd[c] - sd[c - 1], sd[c + 1] - sd[c]);
    sl[0] = sl[NC - 1] = 0;
    for (let f = 1; f < NC; f++) {
      const v = vf[f];
      const up = v > 0 ? sd[f - 1] + 0.5 * sl[f - 1] : sd[f] - 0.5 * sl[f];
      const r = f * DRC;
      const a = sg[f - 1], b = sg[f];
      const gf = (2 * a * b) / (a + b + 1e-9);
      const dif = ((r * DIFF * gf) / DRC) * (sd[f] / (b + 1e-4) - sd[f - 1] / (a + 1e-4));
      fl[f] = r * v * up - dif;
    }
    fl[0] = fl[NC] = 0;
    for (let c = 0; c < NC; c++) {
      const r = (c + 0.5) * DRC;
      let x = sd[c] - (h * (fl[c + 1] - fl[c])) / (DRC * r) + (h * (s0[c] - sd[c])) / TRELAX;
      sd[c] = x > 0 ? x : 0;
    }
  }
}

// The disk as seen at inclination inc: where each LED looks in (r, theta), the cell lists by radius.
function buildMap(P, inc) {
  P.inc = inc;
  const ci = cos(inc), si = sin(inc);
  const S = min(62, 35 / ci);
  P.S = S;
  const ax = 1 / (S * ci), ay = 1 / S;
  const cnt = new Int32Array(NC + 1);
  const cell = new Int16Array(NPX).fill(-1);
  const look = (r) => {
    const u = cl(r / DRC - 0.5, 0, NC + 0.999);
    return u;
  };
  for (let y = 0; y < H; y++) {
    const dy = (y + 0.5 - 64) * ay;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const dx = (x + 0.5 - 32) * ax;
      const r = sqrt(dx * dx + dy * dy);
      const th = atan2(dy, dx);
      P.mc[p] = cos(th);
      P.ms[p] = sin(th);
      const ra = sqrt(((x + 0.25 - 32) * ax) ** 2 + dy * dy);
      const rb = sqrt(((x + 0.75 - 32) * ax) ** 2 + dy * dy);
      const ua = look(ra), ub = look(rb);
      P.ia[p] = floor(ua);
      P.fa[p] = ua - floor(ua);
      P.ib[p] = floor(ub);
      P.fb[p] = ub - floor(ub);
      // Near side to the right, brighter.
      P.lf[p] = 1 + 0.3 * si * cos(th) * smooth(r / 0.3);
      P.ho[p] = r > 1 ? 0.3 * exp(-(r - 1) / 0.09) : 0;
      if (r < 1) {
        const c = floor(r * NC);
        cell[p] = c;
        cnt[c + 1]++;
      }
    }
  }
  for (let c = 0; c < NC; c++) cnt[c + 1] += cnt[c];
  P.bs.set(cnt);
  const fill = cnt.slice(0, NC);
  for (let p = 0; p < NPX; p++) if (cell[p] >= 0) P.bi[fill[cell[p]]++] = p;
}

// Local maxima of the optical depth: where the rings are.
function findRings(P) {
  const t = P.tau, rings = [];
  for (let c = 6; c < NC - 2; c++)
    if (t[c] > t[c - 1] && t[c] >= t[c + 1] && t[c] > 0.35 && t[c] > 1.25 * min(t[c - 5], t[c + 4], t[c - 3] + 0.3 * 0)) rings.push(c);
  P.rings = rings;
}

// Walk uphill in optical depth from cell c to the ring top.
function climb(t, c) {
  c = cl(round(c), 1, NC - 2);
  for (let i = 0; i < 9; i++) {
    if (t[c + 1] > t[c]) c++;
    else if (t[c - 1] > t[c]) c--;
    else break;
  }
  return c;
}
const round = Math.round;

function rebirth(P, a, first) {
  const rand = P.rand;
  const rg = P.rings;
  const c = rg.length ? rg[floor(rand() * rg.length)] : 30 + floor(rand() * 80);
  a.c = c + (rand() - 0.5) * 2;
  a.phi = TAU * rand();
  a.L = 3.5 + 5.5 * rand();
  a.amp = 0.5 + 0.8 * rand();
  a.life = 45 + 100 * rand();
  a.age = first ? -a.life * 0 + (rand() - 0.3) * a.life : 0;
}

// Dust ring and arc features, then the cell lists they are painted through.
function features(P, dt, M, grain) {
  const { tau, mul, add, sca, mc, ms, bs, bi, rand } = P;
  const S = P.S;
  mul.set(P.lf);
  add.fill(0);
  sca.fill(0);
  findRings(P);

  // Arcs of dust on the rings, each turning at the rate of its own radius.
  for (const a of P.arcs) {
    a.age += dt;
    if (a.age >= a.life) rebirth(P, a, false);
    a.c += (climb(tau, a.c) - a.c) * min(1, 3 * dt);
    a.phi += OM1 * pow((a.c + 0.5) * DRC, -1.5) * dt;
    const env = smooth(a.age / 14) * (1 - smooth((a.age - (a.life - 22)) / 22));
    if (env < 0.01) continue;
    const cp = cos(a.phi), sp = sin(a.phi), am = a.amp * env * (0.45 + 0.55 * grain);
    const ca = floor(a.c);
    for (let c = max(0, ca - 7); c <= min(NC - 1, ca + 7); c++) {
      const dc = (c - a.c) / 2.6;
      const wr = exp(-0.5 * dc * dc);
      if (wr < 0.03) continue;
      const r = (c + 0.5) * DRC;
      const K = cl((S * r) / a.L, 1, 30) ** 2;
      for (let j = bs[c]; j < bs[c + 1]; j++) {
        const p = bi[j];
        const u = (1 - (mc[p] * cp + ms[p] * sp)) * K;
        if (u < 6) mul[p] += am * wr * exp(-u);
      }
    }
  }

  // Vortices at the outer edge of a gap.
  for (const v of P.vort) {
    v.age += dt;
    if (v.age >= v.life) {
      v.age = 0;
      v.life = 300 + 120 * rand();
      do v.host = P.nextHost = (P.nextHost + 1 + floor(rand() * 2)) % 4;
      while (P.pm[v.host] < 0.5 * M || (P.vort[0] !== v && P.vort[0].host === v.host) || (P.vort[1] !== v && P.vort[1].host === v.host));
      v.phi = TAU * rand();
    }
    if (v.age < 0) continue;
    const k = v.host;
    const rk = P.pr[k], sk = P.ps[k];
    let c0 = max(2, floor((rk + 0.6 * sk) / DRC)), c1 = min(NC - 3, ceil((rk + 4.5 * sk) / DRC));
    let best = c0;
    for (let c = c0; c <= c1; c++) if (P.sd[c] > P.sd[best]) best = c;
    v.c += (best - v.c) * min(1, 3 * dt);
    v.phi += OM1 * pow((v.c + 0.5) * DRC, -1.5) * dt;
    const env = smooth(v.age / 40) * (1 - smooth((v.age - (v.life - 60)) / 60));
    const mt = smooth((P.pm[k] - 0.1) / 0.7);
    const amp = env * mt * (0.55 + 0.45 * smooth(grain * 1.5 + 0.7));
    v.mf = amp;
    if (amp < 0.01) continue;
    const cp = cos(v.phi), sp = sin(v.phi);
    const sth = 0.3 + 0.12 * mt, K = 1 / (sth * sth);
    const tpk = tau[best];
    const ci = floor(v.c);
    for (let c = max(0, ci - 9); c <= min(NC - 1, ci + 9); c++) {
      const dc = c - v.c;
      const wdep = exp(-0.5 * (dc / 4) * (dc / 4));
      for (let j = bs[c]; j < bs[c + 1]; j++) {
        const p = bi[j];
        const u = (1 - (mc[p] * cp + ms[p] * sp)) * K;
        const g = u < 6 ? exp(-u) : 0;
        const sr = 3.1 * (0.4 + 0.6 * g);
        add[p] += amp * g * exp(-0.5 * ((dc - 1.2) / sr) * ((dc - 1.2) / sr)) * (1.9 + 0.8 * tpk);
        mul[p] -= 0.5 * amp * (1 - g) * wdep;
      }
    }
  }

  // The faint two-armed wake of a planet, drawn in the planet's own frame: the arm
  // beyond the planet trails it and the arm inside runs ahead.
  for (const k of [1, 3]) {
    const rp = P.pr[k];
    const aw = 0.08 + 0.4 * smooth((P.pm[k] - 0.15) / 1.0);
    const cLo = max(0, floor((0.55 * rp) / DRC)), cHi = min(NC - 1, ceil((1.62 * rp) / DRC));
    const pp = P.ph[k];
    for (let c = cLo; c <= cHi; c++) {
      const r = (c + 0.5) * DRC, x = r / rp;
      const f = ((2 / 3) * (pow(x, 1.5) - 1) - log(x)) / 0.06;
      if (f > 3.2) continue;
      const th = x > 1 ? pp - f : pp + f;
      const ct = cos(th), st = sin(th);
      const fall = aw * exp(-abs(r - rp) / (0.5 * rp)) * (1 - smooth((f - 2.2) / 1.0)) * smooth(f / 0.5 + 0.05);
      const K = cl((S * r) / 2.3, 1, 40) ** 2;
      for (let j = bs[c]; j < bs[c + 1]; j++) {
        const p = bi[j];
        const u = (1 - (mc[p] * ct + ms[p] * st)) * K;
        if (u < 5) {
          const g = fall * exp(-u);
          sca[p] += g;
          mul[p] += 0.4 * g;
        }
      }
    }
  }
}

function advance(P, d, k) {
  const M = 0.2 * pow(2, cl(k[1], 0, 4));
  const grain = cl(k[2], -1, 1);
  const st = 0.045 * (grain < 0 ? pow(0.07, -grain) : pow(3.1, grain));
  P.T += d;
  planets(P, P.T, M);
  gas(P);
  dust(P, d, st);
  for (let q = 0; q < NS; q++) P.ph[q] += OM1 * pow(P.pr[q], -1.5) * d;
  return [M, grain];
}

function shape(P, k) {
  const i = k[3];
  const deg = cl(60 + (i - 0.06) * (i < 0.06 ? 37.7 : 16), 20, 75);
  const inc = (deg * PI) / 180;
  if (abs(inc - P.inc) > 0.0008) buildMap(P, inc);
  const tilt = pow(0.5 / cos(inc), 0.4);
  const { tau, sd, tf, cs, sg, sp } = P;
  // The telescope's beam: the dust is seen through a Gaussian 2.0 LEDs wide (sigma 1 LED) along the radius.
  const bw = P.bw;
  for (let c = 0; c < NC; c++) {
    let a = 0;
    for (let j = -3; j <= 3; j++) a += bw[j + 3] * sd[cl(c + j, 0, NC - 1)] * tf[cl(c + j, 0, NC - 1)];
    tau[c] = a * tilt;
    const r = (c + 0.5) * DRC;
    cs[c] = 0.5 * (0.55 + 0.45 * (sg[c] / (sp[c] + 1e-6))) * exp(-r / 0.8);
  }
  tau[NC] = tau[NC + 1] = 0;
  cs[NC] = cs[NC + 1] = 0;
}

export function update(dt, input, P) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  if (abs(k[0] - P.hc) > 1e-4) palette(P, k[0]);
  if (!P.ready) {
    // From a smooth disk, with the planets in place, run the dust forward until the rings stand.
    P.sd.set(P.s0);
    P.T = 0;
    for (let t = 0; t < PRE; t += 0.1) advance(P, 0.1, k);
    P.ready = true;
    shape(P, k);
    for (const a of P.arcs) rebirth(P, a, true);
    findRings(P);
    for (const a of P.arcs) rebirth(P, a, true);
  }
  P.t += d;
  advance(P, d, k);
  shape(P, k);
  features(P, d, 0.2 * pow(2, cl(k[1], 0, 4)), cl(k[2], -1, 1) * 0.5 + 0.5);
}

const ETAB = new Float32Array(1024);
for (let i = 0; i < 1024; i++) ETAB[i] = 1 - exp(-i / 128);

export function draw(display, P) {
  if (!P.ready) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
    return;
  }
  const { tau, cs, ia, ib, fa, fb, mul, add, sca, glow, pal, cool, ho } = P;
  const t = P.t;
  const flick = 1 + 0.05 * sin(t * 1.7) + 0.04 * sin(t * 2.9 + 1) + 0.03 * sin(t * 0.61 + 2);
  for (let p = 0; p < NPX; p++) {
    const a = ia[p], b = ib[p];
    const ta = tau[a] + (tau[a + 1] - tau[a]) * fa[p];
    const tb = tau[b] + (tau[b + 1] - tau[b]) * fb[p];
    let x = 0.5 * (ta + tb) * mul[p] + add[p] + glow[p] * flick;
    if (x < 0) x = 0;
    const v = ETAB[x >= 7.99 ? 1023 : (x * 128) | 0];
    const i3 = ((v * 255) | 0) * 3;
    const h = (ho[p] + (a < NC ? cs[a] + (cs[a + 1] - cs[a]) * fa[p] : 0) + sca[p]) * (1 - 0.6 * v);
    let r = pal[i3] + cool[0] * h, g = pal[i3 + 1] + cool[1] * h, bl = pal[i3 + 2] + cool[2] * h;
    display.setPixel(p % W, (p / W) | 0, r > 255 ? 255 : r, g > 255 ? 255 : g, bl > 255 ? 255 : bl);
  }
}
