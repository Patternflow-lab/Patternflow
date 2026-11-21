// ===== Patternflow pattern =====
// Title:   Toomre Encounter
// Family:  galaxy
// Idea:    Two disk galaxies fall toward each other along the panel's long axis, each a swarm of massless test stars that feel only the two cores, and after the first pass tidal bridges and long tails peel off while dynamical friction pulls the cores into one. The remnant settles into a glowing blob with faint shells, then a new pair with other tilts and masses fades in from the edges of the panel.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Alar and Juri Toomre's restricted three body study "Galactic Bridges and Tails" (1972), which follows massless test particles in the field of two point masses; Erik Holmberg's light bulb galaxies (1941), the first encounter run by hand; Chandrasekhar's dynamical friction (1943) for the merger; Plummer softening (1911) for the cores; leapfrog time stepping; pattern round 207
// Round:   207
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.6..6, Mass=-1..1, View=-1..1
//
// Knob 1: Hue. Turns the pair of tints round the wheel together and comes back at 1: blue-white and gold at 0 and 1, violet and lime at 0.17, rose and green at 0.33, orange and blue at 0.5, lime and purple at 0.67, green and pink at 0.83. The two tints stay about 170 degrees apart, so the bridge between the galaxies always shows both, and each new pair moves both tints by up to 29 degrees either way.
// Knob 2: Pace. How fast the encounter runs: the model clock runs at Pace divided by 2, so 0.3 times at 0.6, 1 time at the opening 2 and 3 times at 6. At 1 time a model unit is 3.4 s: the first pass comes about 4 s after the opening, the cores merge between 60 and 105 s, and a new pair fades in 15 s after that, so an encounter lasts 90 to 120 s. The leapfrog step never exceeds 0.02 units, so every pace is stable.
// Knob 3: Mass. The mass of the second galaxy relative to the first, 0.2 at -1, 0.75 at the opening 0 and 1.3 at 1. Its disk starts about half as wide as the first one at -1, as wide at 0 and a quarter wider at 1; the first is about 48 LEDs across at the opening. The pull on the other disk and on the orbit follows the knob within 1 to 2 s, so the bridge and the tails bend while the second core's glow swells or shrinks; a new pair takes this mass times a random 0.85 to 1.2.
// Knob 4: View. The yaw of the camera round the panel's long axis: 33 degrees at the opening, minus 12 at -1 (looking down on the orbit, the tails read in plan) and 72 at 1 (nearly edge on, the disks flatten to thin lenses and the tails stack in depth). A slow turn of about 12 degrees every 47 s and a tilt of 15 degrees come on top.

const W = 64;
const H = 128;
const NPX = W * H;
const HW = 32;
const HH = 64;
const { floor, exp, sin, cos, sqrt, abs, min, max, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const TU = 3.4; // seconds of display per model unit at Pace 1
const HMAX = 0.02; // longest leapfrog step, in model units
const EPS2 = 0.28 * 0.28; // Plummer softening of every core, squared
const NG = 3000; // test stars per disk
const NB = 12; // colour bins from the centre of a disk to its rim
const FADE = 6; // seconds of cross fade between encounters
const KILL2 = 12 * 12; // a star this far from the cores is dropped

const gauss = () => {
  let s = 0;
  for (let i = 0; i < 6; i++) s += Math.random();
  return (s - 3) * 1.4142;
};

function newEnc(qk, first) {
  const rf = 0.85 + 0.35 * Math.random();
  const m2 = qk * rf;
  const e = {
    t: 0, tm: -1, alpha: 1, front: 0,
    m1: 1, m2, bind2: m2, rf,
    x1: 0, y1: 0, x2: 0, y2: 0, u1: 0, w1: 0, u2: 0, w2: 0,
    n: 0, cx: 0, cy: 0, cz: 0, sc: 24, st: 24, rho: 0, R: new Float32Array(9),
    // what makes one encounter look unlike the last: the angle of the pair on the panel, a slight
    // shift of both tints, a zoom, and where the remnant comes to rest
    roll0: first ? 0 : (Math.random() - 0.5) * 1.0,
    hoff: first ? 0 : (Math.random() - 0.5) * 0.16,
    zoom: first ? 1 : 0.88 + 0.24 * Math.random(),
    ox: 0, oy: 0,
    oxT: (Math.random() - 0.5) * 12, oyT: (Math.random() - 0.5) * 24, pp: TAU * Math.random(),
    tint: [new Float32Array(NB * 3), new Float32Array(NB * 3)],
    px: new Float32Array(2 * NG), py: new Float32Array(2 * NG), pz: new Float32Array(2 * NG),
    vx: new Float32Array(2 * NG), vy: new Float32Array(2 * NG), vz: new Float32Array(2 * NG),
    gal: new Uint8Array(2 * NG), bin: new Uint8Array(2 * NG), bri: new Float32Array(2 * NG),
  };
  // the relative orbit: the second core falls toward the first from 3 units, at 96 to 99% of escape speed
  const rp = 1.0 + 0.45 * Math.random();
  const ys = Math.random() < 0.5 ? -1 : 1;
  const sg = Math.random() < 0.5 ? -1 : 1;
  const M = 1 + m2;
  const r0 = 3.0;
  const s0 = sqrt(r0 * r0 + EPS2);
  const v0f = 0.96 + 0.03 * Math.random();
  const E0 = (v0f * v0f - 1) * M / s0;
  const L = rp * sqrt(2 * (E0 + M / sqrt(rp * rp + EPS2)));
  const vt = L / r0;
  const v0s = 2 * v0f * v0f * M / s0;
  const vr = sqrt(max(0.01, v0s - vt * vt));
  const rx = 0;
  const ry = -ys * r0;
  const rvx = sg * vt;
  const rvy = ys * vr;
  e.x1 = (-m2 / M) * rx; e.y1 = (-m2 / M) * ry; e.x2 = (1 / M) * rx; e.y2 = (1 / M) * ry;
  e.u1 = (-m2 / M) * rvx; e.w1 = (-m2 / M) * rvy; e.u2 = (1 / M) * rvx; e.w2 = (1 / M) * rvy;
  const sgnL = ys * sg;
  // the two disks: random tilt from the orbital plane, mostly in the sense of the orbit
  for (let g = 0; g < 2; g++) {
    const bind = g ? m2 : 1;
    const R = g ? 0.85 * (0.9 * sqrt(m2 / 0.75) + 0.08) : 0.85;
    const th = 0.12 + 0.8 * Math.random();
    const ph = TAU * Math.random();
    const pro = Math.random() < 0.85 ? 1 : -1;
    const nx = sin(th) * cos(ph);
    const ny = sin(th) * sin(ph);
    const nz = sgnL * pro * cos(th);
    // in-plane basis
    let ax = ny, ay = -nx, az = 0;
    let al = sqrt(ax * ax + ay * ay);
    if (al < 1e-3) { ax = 1; ay = 0; al = 1; }
    ax /= al; ay /= al;
    const bx = ny * az - nz * ay, by = nz * ax - nx * az, bz = nx * ay - ny * ax;
    const hx = g ? e.x2 : e.x1, hy = g ? e.y2 : e.y1, hu = g ? e.u2 : e.u1, hw = g ? e.w2 : e.w1;
    const phi0 = TAU * Math.random();
    const cotp = 1.7 + 0.5 * Math.random();
    const rin = 0.015;
    for (let i = 0; i < NG; i++) {
      let r, phi;
      const inArm = Math.random() < 0.8;
      for (let k = 0; k < 80; k++) {
        r = (inArm ? 0.55 : 0.4) * R * -log(Math.random() * Math.random() + 1e-9);
        phi = TAU * Math.random();
        if (r < rin || r > R) continue;
        if (!inArm) break;
        const arm = phi0 - cotp * log(r / (0.25 * R));
        const A = sm(0.06 * R, 0.35 * R, r);
        // narrow arms: density falls to a few percent between them
        if (Math.random() < exp(4.2 * A * (cos(2 * (phi - arm)) - 1))) break;
      }
      r = cl(r, rin, R);
      const c = cos(phi), s = sin(phi);
      const zt = 0.02 * gauss() * (0.4 + r / R);
      const j = g * NG + i;
      e.px[j] = hx + r * (c * ax + s * bx) + zt * nx;
      e.py[j] = hy + r * (c * ay + s * by) + zt * ny;
      e.pz[j] = r * s * bz + zt * nz;
      const vc = sqrt((bind * r * r) / ((r * r + EPS2) * sqrt(r * r + EPS2))) * (1 + 0.03 * gauss());
      // tangent n x rhat = c (n x a) + s (n x b)
      const tax = ny * 0 - nz * ay, tay = nz * ax - nx * 0, taz = nx * ay - ny * ax;
      const tbx = ny * bz - nz * by, tby = nz * bx - nx * bz, tbz = nx * by - ny * bx;
      e.vx[j] = hu + vc * (c * tax + s * tbx) + 0.02 * gauss();
      e.vy[j] = hw + vc * (c * tay + s * tby) + 0.02 * gauss();
      e.vz[j] = vc * (c * taz + s * tbz) + 0.02 * gauss();
      e.gal[j] = g;
      e.bin[j] = min(NB - 1, floor((NB * r) / R));
      e.bri[j] = (inArm ? 1.25 : 0.55) * (0.75 + 0.5 * Math.random());
    }
  }
  e.n = 2 * NG;
  // run up to the approach, so a pair opens with its disks nearly touching and arms still fresh
  for (let i = 0; i < 150; i++) {
    advance(e, 0.02);
    if ((e.x2 - e.x1) * (e.x2 - e.x1) + (e.y2 - e.y1) * (e.y2 - e.y1) < 2.2 * 2.2) break;
  }
  return e;
}

// One leapfrog step of h model units: both cores, then every star.
function step(e, h) {
  const dx = e.x2 - e.x1;
  const dy = e.y2 - e.y1;
  const d2 = dx * dx + dy * dy;
  const r2 = d2 + EPS2;
  const f = 1 / (r2 * sqrt(r2));
  e.u1 += e.m2 * f * dx * h;
  e.w1 += e.m2 * f * dy * h;
  e.u2 -= e.m1 * f * dx * h;
  e.w2 -= e.m1 * f * dy * h;
  // dynamical friction: the relative velocity decays while the disks overlap, hard once the cores do
  const d = sqrt(d2);
  const cs = sm(0.55, 0.25, d);
  const g = 0.12 * exp(-(d2 / 1.69)) + 0.01 + 11 * cs;
  const dec = exp(-g * h) - 1;
  const rvx = e.u2 - e.u1;
  const rvy = e.w2 - e.w1;
  const M = e.m1 + e.m2;
  e.u2 += rvx * dec * (e.m1 / M);
  e.w2 += rvy * dec * (e.m1 / M);
  e.u1 -= rvx * dec * (e.m2 / M);
  e.w1 -= rvy * dec * (e.m2 / M);
  const x1 = (e.x1 += e.u1 * h);
  const y1 = (e.y1 += e.w1 * h);
  const x2 = (e.x2 += e.u2 * h);
  const y2 = (e.y2 += e.w2 * h);
  const { px, py, pz, vx, vy, vz, gal } = e;
  const m1 = e.m1;
  const m2 = e.m2;
  const b2 = e.bind2;
  for (let i = 0; i < e.n; i++) {
    const x = px[i], y = py[i], z = pz[i];
    const ax = x - x1, ay = y - y1;
    const bx = x - x2, by = y - y2;
    const zz = z * z + EPS2;
    const s1 = ax * ax + ay * ay + zz;
    const s2 = bx * bx + by * by + zz;
    const k1 = m1 / (s1 * sqrt(s1));
    const k2 = (gal[i] ? b2 : m2) / (s2 * sqrt(s2));
    let u = vx[i] - (k1 * ax + k2 * bx) * h;
    let v = vy[i] - (k1 * ay + k2 * by) * h;
    let w = vz[i] - (k1 + k2) * z * h;
    const sp = u * u + v * v + w * w;
    if (sp > 36) {
      const c = 6 / sqrt(sp);
      u *= c; v *= c; w *= c;
    }
    vx[i] = u; vy[i] = v; vz[i] = w;
    px[i] = x + u * h;
    py[i] = y + v * h;
    pz[i] = z + w * h;
  }
}

function advance(e, units) {
  const n = max(1, Math.ceil(units / HMAX));
  const h = units / n;
  for (let k = 0; k < n; k++) step(e, h);
  e.t += units;
  if (e.tm < 0 && (e.x2 - e.x1) * (e.x2 - e.x1) + (e.y2 - e.y1) * (e.y2 - e.y1) < 0.02) e.tm = e.t;
  // drop what has been flung far away, and anything that stopped being a number
  const cx = (e.m1 * e.x1 + e.m2 * e.x2) / (e.m1 + e.m2);
  const cy = (e.m1 * e.y1 + e.m2 * e.y2) / (e.m1 + e.m2);
  const { px, py, pz, vx, vy, vz, gal, bin, bri } = e;
  for (let i = e.n - 1; i >= 0; i--) {
    const x = px[i] - cx, y = py[i] - cy, z = pz[i];
    const q = x * x + y * y + z * z;
    if (q < KILL2) continue;
    const l = --e.n;
    px[i] = px[l]; py[i] = py[l]; pz[i] = pz[l];
    vx[i] = vx[l]; vy[i] = vy[l]; vz[i] = vz[l];
    gal[i] = gal[l]; bin[i] = bin[l]; bri[i] = bri[l];
  }
}

// The camera looks at the middle of the two cores and zooms so the stars fill the panel.
function camera(e, S, dt, snap) {
  const M = e.m1 + e.m2;
  const tx = (e.m1 * e.x1 + e.m2 * e.x2) / M;
  const ty = (e.m1 * e.y1 + e.m2 * e.y2) / M;
  const a = snap ? 1 : 1 - exp(-dt / 1.2);
  e.cx += (tx - e.cx) * a;
  e.cy += (ty - e.cy) * a;
  const R = e.R;
  let sx = 0, sy = 0;
  const { px, py, pz } = e;
  for (let i = 0; i < e.n; i += 2) {
    const x = px[i] - e.cx, y = py[i] - e.cy, z = pz[i] - e.cz;
    const u = R[0] * x + R[1] * y + R[2] * z;
    const v = R[3] * x + R[4] * y + R[5] * z;
    sx += min(u * u, 9);
    sy += min(v * v, 9);
  }
  const c = max(1, floor(e.n / 2));
  const ey = 1.5 * sqrt(sy / c) + 0.35;
  const ex = 1.5 * sqrt(sx / c) + 0.35;
  e.st = cl(min(54 / ey, 31 / ex), e.tm >= 0 ? 12 : 18, 32) * (e.tm >= 0 ? e.zoom * (1 + 0.1 * sin((TAU * S.t) / 61 + e.pp)) : 1);
  e.sc += (e.st - e.sc) * (snap ? 1 : 1 - exp(-dt / 3.5));
  // once the cores have merged the remnant drifts off the middle of the panel
  const pa = snap ? 1 : 1 - exp(-dt / 4);
  const t = S.t;
  e.ox += ((e.tm >= 0 ? e.oxT + 11 * sin((TAU * t) / 37 + e.pp) : 0) - e.ox) * pa;
  e.oy += ((e.tm >= 0 ? e.oyT + 26 * sin((TAU * t) / 53 + e.pp * 1.7) : 0) - e.oy) * pa;
}

export function setup(params) {
  const S = {
    t: 0,
    first: true,
    k: [0, 2, 0, 0.06],
    sk: [0, 2, 0, 0.06],
    cur: null,
    old: null,
    fade: 0,
    ph: Array.from({ length: 12 }, () => Math.random() * TAU),
    F: new Float32Array(NPX * 3),
    T: new Float32Array(NPX * 3),
    HB: new Float32Array(HW * HH * 3),
    HT: new Float32Array(HW * HH * 3),
    D: new Float32Array(NPX * 3),
    lut: new Float32Array(4097),
    stars: [],
  };
  for (let i = 0; i <= 4096; i++) S.lut[i] = Math.pow(1 - exp(-i / 512), 0.74);
  // a faint fixed field of distant stars
  const used = new Set();
  while (S.stars.length < 34) {
    const x = floor(Math.random() * W);
    const y = floor(Math.random() * H);
    if (used.has(y * W + x)) continue;
    used.add(y * W + x);
    const warm = Math.random();
    const b = 34 + 56 * Math.random() * Math.random();
    S.stars.push({ p: y * W + x, r: b * (0.8 + 0.2 * warm), g: b * 0.9, b: b * (1.0 - 0.15 * warm), ph: Math.random() * TAU, f: 0.05 + 0.1 * Math.random() });
  }
  params.s = S;
}

// Roll about the view axis keeps the two cores on the panel's long axis (slowly, so a
// pericentre pass still swings them sideways), then yaw about that axis and a small tilt.
function rotation(S, e, dt, snap) {
  const t = S.t;
  const ph = S.ph;
  const dx = e.x2 - e.x1;
  const dy = e.y2 - e.y1;
  const sep = sqrt(dx * dx + dy * dy);
  const psi = Math.atan2(dy, dx);
  let best = 0;
  let bd = 9;
  for (let k = 0; k < 2; k++) {
    const target = (k ? -PI / 2 : PI / 2) - psi + e.roll0;
    let d = target - e.rho;
    d -= TAU * Math.round(d / TAU);
    if (abs(d) < bd) {
      bd = abs(d);
      best = d;
    }
  }
  e.rho += best * (snap ? 1 : (1 - exp(-dt / 2.2)) * sm(0.15, 0.7, sep));
  const yaw = ((30 + 42 * cl(S.sk[3], -1, 1)) * PI) / 180 + 0.21 * sin((TAU * t) / 47 + ph[0]) + 0.12 * sin((TAU * t) / 83 + ph[1]);
  const tilt = 0.26 + 0.1 * sin((TAU * t) / 61 + ph[2]) + 0.05 * sin((TAU * t) / 29 + ph[3]);
  const cb = cos(yaw), sb = sin(yaw), ca = cos(tilt), sa = sin(tilt);
  const c = cos(e.rho), sr = sin(e.rho);
  const R = e.R;
  const r0x = cb * c, r0y = -cb * sr, r0z = sb;
  const r1x = sr, r1y = c, r1z = 0;
  const r2x = -sb * c, r2y = sb * sr, r2z = cb;
  R[0] = r0x; R[1] = r0y; R[2] = r0z;
  R[3] = ca * r1x - sa * r2x; R[4] = ca * r1y - sa * r2y; R[5] = ca * r1z - sa * r2z;
  R[6] = sa * r1x + ca * r2x; R[7] = sa * r1y + ca * r2y; R[8] = sa * r1z + ca * r2z;
}

const qOf = (k) => (k < 0 ? 0.75 * Math.pow(0.267, -k) : 0.75 + 0.55 * k);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    S.sk = S.k.slice();
    S.first = false;
    S.cur = newEnc(qOf(cl(S.sk[2], -1, 1)), true);
    S.cur.front = 9;
    rotation(S, S.cur, 0, true);
    camera(S.cur, S, 0, true);
  }
  const sk = S.sk;
  const k = S.k;
  const rate = [0.3, 0.5, 1.0, 0.6];
  for (let i = 0; i < 4; i++) sk[i] += (k[i] - sk[i]) * (1 - exp(-dt / rate[i]));
  S.t += dt;
  const pace = cl(sk[1], 0.6, 6) / 2;
  const du = (dt * pace) / TU;
  const q = qOf(cl(sk[2], -1, 1));
  const list = S.old ? [S.cur, S.old] : [S.cur];
  for (const e of list) {
    e.m2 = q * e.rf;
    if (du > 0) advance(e, du);
    rotation(S, e, dt, false);
    camera(e, S, dt, false);
  }
  if (S.old) {
    S.fade += dt;
    S.old.alpha = 1 - sm(0, 1, S.fade / FADE);
    S.cur.front = (S.fade / FADE) * 1.3;
    if (S.fade >= FADE) {
      S.old = null;
      S.cur.front = 9;
    }
  } else {
    const e = S.cur;
    const sep = sqrt((e.x2 - e.x1) * (e.x2 - e.x1) + (e.y2 - e.y1) * (e.y2 - e.y1));
    if ((e.tm >= 0 && e.t - e.tm > 4.5) || e.t > 42 || sep > 12) {
      S.old = e;
      S.fade = 0;
      S.cur = newEnc(q, false);
      S.cur.front = 0;
      rotation(S, S.cur, 0, true);
      camera(S.cur, S, 0, true);
    }
  }
}

// ---- colour -------------------------------------------------------------

function hueRGB(h, o) {
  h = h - floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return 1 - max(0, min(k, 4 - k, 1));
  };
  o[0] = f(5);
  o[1] = f(3);
  o[2] = f(1);
}
const HC = [0, 0, 0];
function tints(e, hue) {
  for (let g = 0; g < 2; g++) {
    hueRGB(hue - g * 0.47, HC);
    const T = e.tint[g];
    for (let b = 0; b < NB; b++) {
      const x = b / (NB - 1);
      const sat = lerp(0.14, 0.78, sm(0, 0.8, x));
      const lu = lerp(0.8, 1.5, sm(0, 0.6, x));
      const r = 1 - sat + sat * HC[0];
      const gg = 1 - sat + sat * HC[1];
      const bb = 1 - sat + sat * HC[2];
      const l = 0.299 * r + 0.587 * gg + 0.114 * bb;
      T[b * 3] = (r * lu) / l;
      T[b * 3 + 1] = (gg * lu) / l;
      T[b * 3 + 2] = (bb * lu) / l;
    }
  }
}

// ---- drawing ------------------------------------------------------------

function splat(e, S, wgal0, wgal1) {
  const R = e.R;
  const { F, HB } = S;
  const { px, py, pz, gal, bin, bri } = e;
  const sc = e.sc;
  const zf = cl(24 / sc, 0.7, 1.6);
  const T0 = e.tint[0];
  const T1 = e.tint[1];
  const front = e.front;
  // once the cores have merged the far debris is dimmed, so the remnant reads as a ball and not a cloud
  const mf = e.tm >= 0 ? sm(0, 2.5, e.t - e.tm) : 0;
  for (let i = 0; i < e.n; i++) {
    const x = px[i] - e.cx, y = py[i] - e.cy, z = pz[i] - e.cz;
    const u = R[0] * x + R[1] * y + R[2] * z;
    const v = R[3] * x + R[4] * y + R[5] * z;
    const dz = R[6] * x + R[7] * y + R[8] * z;
    const sx = 32 + e.ox + sc * u;
    const sy = 64 + e.oy - sc * v;
    if (sx < -3 || sx > W + 3 || sy < -3 || sy > H + 3) continue;
    let a = e.alpha;
    if (front < 2) {
      const en = min(sx, W - sx, sy * 0.5, (H - sy) * 0.5) / 32;
      a *= sm(0, 0.25, front - (1 - cl(en, 0, 1)));
      if (a <= 0.001) continue;
    }
    const g = gal[i];
    const T = g ? T1 : T0;
    const bi = bin[i] * 3;
    // far from the cores the stars are sparse: they shine brighter and most of their light goes to the soft layer
    const ax = px[i] - e.x1, ay = py[i] - e.y1, bx = px[i] - e.x2, by = py[i] - e.y2;
    const far = sm(0.8, 2.4, sqrt(min(ax * ax + ay * ay, bx * bx + by * by) + z * z));
    const w = bri[i] * (g ? wgal1 : wgal0) * zf * a * (1 + 0.3 * far - 0.6 * far * mf) * (0.8 + 0.2 * cl(dz / 1.1, -1, 1));
    const hf = 0.2 + 0.65 * far;
    const wr = w * T[bi], wg = w * T[bi + 1], wb = w * T[bi + 2];
    const fr = wr * (1 - hf), fg = wg * (1 - hf), fb = wb * (1 - hf);
    const hr = wr * hf, hg = wg * hf, hb = wb * hf;
    // fine layer: cubic B-spline over 4 by 4 LEDs
    const fu = sx - 0.5, fv = sy - 0.5;
    const ix = floor(fu), iy = floor(fv);
    const tx = fu - ix, ty = fv - iy;
    const ux = 1 - tx, uy = 1 - ty;
    const x0 = (ux * ux * ux) / 6, x1 = (3 * tx * tx * tx - 6 * tx * tx + 4) / 6, x2 = (-3 * tx * tx * tx + 3 * tx * tx + 3 * tx + 1) / 6, x3 = (tx * tx * tx) / 6;
    const y0 = (uy * uy * uy) / 6, y1 = (3 * ty * ty * ty - 6 * ty * ty + 4) / 6, y2 = (-3 * ty * ty * ty + 3 * ty * ty + 3 * ty + 1) / 6, y3 = (ty * ty * ty) / 6;
    const wx = [x0, x1, x2, x3];
    const wy = [y0, y1, y2, y3];
    for (let j = 0; j < 4; j++) {
      const yy = iy - 1 + j;
      if (yy < 0 || yy >= H) continue;
      const wyj = wy[j];
      for (let l = 0; l < 4; l++) {
        const xx = ix - 1 + l;
        if (xx < 0 || xx >= W) continue;
        const c = wyj * wx[l];
        const o = (yy * W + xx) * 3;
        F[o] += fr * c;
        F[o + 1] += fg * c;
        F[o + 2] += fb * c;
      }
    }
    // halo layer: bilinear on a half resolution grid
    const hu = sx * 0.5 - 0.5, hv = sy * 0.5 - 0.5;
    const hx = floor(hu), hy = floor(hv);
    const fx = hu - hx, fy = hv - hy;
    for (let j = 0; j < 2; j++) {
      const yy = hy + j;
      if (yy < 0 || yy >= HH) continue;
      const cy = j ? fy : 1 - fy;
      for (let l = 0; l < 2; l++) {
        const xx = hx + l;
        if (xx < 0 || xx >= HW) continue;
        const c = cy * (l ? fx : 1 - fx);
        const o = (yy * HW + xx) * 3;
        HB[o] += hr * c;
        HB[o + 1] += hg * c;
        HB[o + 2] += hb * c;
      }
    }
  }
}

// [1 2 1] / 4 along x, then along y, on an interleaved three channel grid
function blur(src, tmp, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      const l = x > 0 ? o - 3 : o;
      const r = x < w - 1 ? o + 3 : o;
      tmp[o] = 0.25 * src[l] + 0.5 * src[o] + 0.25 * src[r];
      tmp[o + 1] = 0.25 * src[l + 1] + 0.5 * src[o + 1] + 0.25 * src[r + 1];
      tmp[o + 2] = 0.25 * src[l + 2] + 0.5 * src[o + 2] + 0.25 * src[r + 2];
    }
  }
  const s = w * 3;
  for (let y = 0; y < h; y++) {
    const up = y > 0 ? -s : 0;
    const dn = y < h - 1 ? s : 0;
    for (let x = 0; x < s; x++) {
      const o = y * s + x;
      src[o] = 0.25 * tmp[o + up] + 0.5 * tmp[o] + 0.25 * tmp[o + dn];
    }
  }
}

function glow(e, S, D, x, y, m, a) {
  const R = e.R;
  const dx = x - e.cx, dy = y - e.cy, dz = -e.cz;
  const u = R[0] * dx + R[1] * dy + R[2] * dz;
  const v = R[3] * dx + R[4] * dy + R[5] * dz;
  const sx = 32 + e.ox + e.sc * u;
  const sy = 64 + e.oy - e.sc * v;
  const k = e.sc / 24;
  const T = e.tint[m.g];
  for (let layer = 0; layer < 2; layer++) {
    const sg = (layer ? 5 : 2.0) * k * (0.6 + 0.4 * sqrt(m.w));
    const amp = (layer ? 0.06 : 0.8) * m.w * a;
    const i2 = 1 / (2 * sg * sg);
    const rad = floor(sg * 4.04) + 1;
    const x0 = max(0, floor(sx - rad)), x1 = min(W - 1, floor(sx + rad));
    const y0 = max(0, floor(sy - rad)), y1 = min(H - 1, floor(sy + rad));
    for (let yy = y0; yy <= y1; yy++) {
      const ddy = yy + 0.5 - sy;
      for (let xx = x0; xx <= x1; xx++) {
        const ddx = xx + 0.5 - sx;
        const gv = amp * max(0, exp(-(ddx * ddx + ddy * ddy) * i2) - 0.0003);
        const o = (yy * W + xx) * 3;
        D[o] += gv * T[0];
        D[o + 1] += gv * T[1];
        D[o + 2] += gv * T[2];
      }
    }
  }
}

const MA = { g: 0, w: 1 };
const MB = { g: 1, w: 1 };

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first || !S.cur) return;
  const { F, T, HB, HT, D, lut } = S;
  F.fill(0);
  HB.fill(0);
  const list = S.old ? [S.old, S.cur] : [S.cur];
  for (const e of list) {
    tints(e, 0.585 + cl(S.sk[0], 0, 1) + e.hoff);
    const lm = sqrt(e.m2 / e.bind2);
    // the merged cores pack the stars into one dense bulge, so the exposure comes down by half
    const ex = e.tm >= 0 ? 1 - 0.5 * sm(0, 2.5, e.t - e.tm) : 1;
    splat(e, S, 0.15 * ex, 0.15 * ex * Math.pow(e.bind2 / 0.75, 0.5) * lm);
  }
  blur(F, T, W, H);
  blur(HB, HT, HW, HH);
  blur(HB, HT, HW, HH);
  blur(HB, HT, HW, HH);
  // join the fine layer and the soft layer; a star's light is split between them
  for (let y = 0; y < H; y++) {
    const hy = y * 0.5 - 0.25;
    const y0 = max(0, min(HH - 1, floor(hy)));
    const y1 = min(HH - 1, y0 + 1);
    const fy = cl(hy - y0, 0, 1);
    for (let x = 0; x < W; x++) {
      const hx = x * 0.5 - 0.25;
      const x0 = max(0, min(HW - 1, floor(hx)));
      const x1 = min(HW - 1, x0 + 1);
      const fx = cl(hx - x0, 0, 1);
      const o = (y * W + x) * 3;
      const a = (y0 * HW + x0) * 3, b = (y0 * HW + x1) * 3, c = (y1 * HW + x0) * 3, d = (y1 * HW + x1) * 3;
      for (let ch = 0; ch < 3; ch++) {
        const hv = (HB[a + ch] * (1 - fx) + HB[b + ch] * fx) * (1 - fy) + (HB[c + ch] * (1 - fx) + HB[d + ch] * fx) * fy;
        D[o + ch] = F[o + ch] + 0.25 * hv;
      }
    }
  }
  for (const e of list) {
    const a = e.alpha * (e.front < 2 ? sm(0.2, 0.9, e.front) : 1);
    MA.w = 1;
    MB.w = e.m2 * 1.3;
    glow(e, S, D, e.x1, e.y1, MA, a);
    glow(e, S, D, e.x2, e.y2, MB, a);
  }
  const t = S.t;
  const st = S.stars;
  for (let i = 0; i < NPX; i++) {
    const o = i * 3;
    let r = D[o] * 512, g = D[o + 1] * 512, b = D[o + 2] * 512;
    r = r > 4095 ? 4095 : r;
    g = g > 4095 ? 4095 : g;
    b = b > 4095 ? 4095 : b;
    const ri = floor(r), gi = floor(g), bi = floor(b);
    D[o] = 255 * (lut[ri] + (r - ri) * (lut[ri + 1] - lut[ri]));
    D[o + 1] = 255 * (lut[gi] + (g - gi) * (lut[gi + 1] - lut[gi]));
    D[o + 2] = 255 * (lut[bi] + (b - bi) * (lut[bi + 1] - lut[bi]));
  }
  for (let i = 0; i < st.length; i++) {
    const s = st[i];
    const tw = 0.82 + 0.18 * sin(t * s.f * TAU + s.ph);
    const o = s.p * 3;
    D[o] += s.r * tw * (1 - D[o] / 255);
    D[o + 1] += s.g * tw * (1 - D[o + 1] / 255);
    D[o + 2] += s.b * tw * (1 - D[o + 2] / 255);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, min(255, D[o]), min(255, D[o + 1]), min(255, D[o + 2]));
    }
  }
}
