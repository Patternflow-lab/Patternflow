// ===== Patternflow pattern =====
// Title:   Pancake Ice
// Family:  seaice
// Idea:    Seen from straight above at polar dawn, round plates of young sea ice jostle on a heaving swell, bumping and grinding raised rims onto each other, while slush between them thickens and new plates freeze out of it.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 206
// Round:   206
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Swell=0.4..4, Plate=-3..3, Cover=-24..24
//
// Knob 1: Hue.
// Knob 2: Swell.
// Knob 3: Plate.
// Knob 4: Cover.

const W = 64;
const H = 128;
const NB = 32;
const { floor, sin, cos, exp, sqrt, abs, log, PI, min, max, atan2, round, random } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const gauss = () => sqrt(-2 * log(1 - random())) * cos(TAU * random());
const wx = (d) => d - W * round(d / W);
const wy = (d) => d - H * round(d / H);

// Three plane swells on the torus of the panel: wavelengths 128, 57 and 64 LEDs,
// periods that share no factor, each with an envelope of its own.
const WV = [
  { mx: 0, my: 1, T: 13.7, sh: 0.62, nu: 0.0171, ev: 0.0213 },
  { mx: 1, my: 1, T: 9.3, sh: 0.8, nu: 0.0113, ev: 0.0157 },
  { mx: 1, my: 0, T: 11.1, sh: 0.66, nu: 0.0137, ev: 0.0091 },
];
for (const w of WV) {
  w.kx = (TAU * w.mx) / W;
  w.ky = (TAU * w.my) / H;
  w.om = TAU / w.T;
  const kk = sqrt(w.kx * w.kx + w.ky * w.ky);
  w.nx = w.kx / kk;
  w.ny = w.ky / kk;
}
// Slow shear currents, divergence free, so plates grind past each other even in a dead calm.
const GY = [
  { mx: 1, my: 1, s: 0.5, om: 0.061 },
  { mx: 0, my: 1, s: 0.42, om: 0.043 },
  { mx: 1, my: 0, s: 0.38, om: 0.079 },
];
for (const g of GY) {
  g.kx = (TAU * g.mx) / W;
  g.ky = (TAU * g.my) / H;
  const kk = sqrt(g.kx * g.kx + g.ky * g.ky);
  g.px = -g.ky / kk;
  g.py = g.kx / kk;
}
// The low sun: direction toward it in the picture, and how high it stands.
const SX = -0.6;
const SY = -0.8;
const SZ = 0.5;

export function setup(params) {
  const S = {
    t: 0, first: true, k: [0, 2, 0, 0.06],
    sw: 2, rt: 7.3, cover: 0.68, sl: 0.5, nuc: 3,
    plates: [], bonds: [], nid: 0,
    ph: [0, 1, 2].map(() => random() * TAU),
    ph2: [0, 1, 2].map(() => random() * TAU),
    ph3: [0, 1, 2].map(() => random() * TAU),
    gph: [0, 1, 2].map(() => random() * TAU),
    arg: [0, 0, 0], ai: [0, 0, 0], gc: [0, 0, 0],
    buf: new Float32Array(W * H * 3),
    sd: new Float32Array(W * H),
    tl: new Float32Array(W * H),
    tSX: new Float32Array(3 * W), tCX: new Float32Array(3 * W),
    tSY: new Float32Array(3 * H), tCY: new Float32Array(3 * H),
    M: new Float32Array(9),
    pal: {},
    ev: [0, 0, 0],
    stat: { bump: 0, brk: 0, bond: 0, nuc: 0, melt: 0 },
  };
  params.s = S;
}

// ---------------------------------------------------------------------------
// plates

// Share of the surface committed to ice for the Cover knob: 40% at -24, 68% at 0, 79% at 24.
const coverOf = (v) => {
  const c = cl(v, -24, 24);
  return 0.68 + (c < 0 ? 0.0115 : 0.0045) * c;
};

function newPlate(S, x, y, R, f) {
  const p = {
    id: S.nid++, x, y, vx: 0, vy: 0, th: random() * TAU, om: (random() - 0.5) * 0.2,
    R, f, Rt: S.rt * f,
    a2: 0.025 + 0.04 * random(), q2: random() * TAU, a3: 0.012 + 0.025 * random(), q3: random() * TAU,
    rim: new Float32Array(NB), rimE: new Float32Array(NB), fl: new Float32Array(NB),
    touch: {}, partners: [], age: 60, life: 300 + 600 * random(), alpha: 1, melt: false, crowd: false,
    v: 0.92 + 0.14 * random(), tint: random() * 2 - 1,
    ax: 0, ay: 0, al: 0, C2: 0, S2: 0, C3: 0, S3: 0,
  };
  for (let b = 0; b < NB; b++) p.rim[b] = 0.05 * random();
  return p;
}

function sizeFactor() {
  let f = exp(0.27 * gauss());
  if (random() < 0.1) f *= 1.35;
  return cl(f, 0.58, 1.55);
}

function radiusAtAngle(p, ang) {
  return p.R * (1 + p.a2 * cos(2 * (ang - p.th - p.q2)) + p.a3 * cos(3 * (ang - p.th - p.q3)));
}

function raiseRim(p, ang, amount, arr) {
  const rim = arr || p.rim;
  let a = (ang - p.th) % TAU;
  if (a < 0) a += TAU;
  const fb = (a / TAU) * NB;
  const b0 = floor(fb);
  for (let d = -3; d <= 3; d++) {
    const w = exp(-((d + (b0 - fb) + 0.5) ** 2) / 2.2);
    const b = (((b0 + d) % NB) + NB) % NB;
    rim[b] += amount * w;
  }
}

function bondedWith(a, b) {
  return a.partners.indexOf(b) >= 0;
}

function clusterSize(p, seen) {
  seen.add(p);
  for (const q of p.partners) if (!seen.has(q)) clusterSize(q, seen);
  return seen.size;
}

function makeBond(S, a, b, dx, dy) {
  const ca = cos(a.th);
  const sa = sin(a.th);
  const bd = {
    a, b, rx: ca * dx + sa * dy, ry: -sa * dx + ca * dy, dth0: b.th - a.th,
    sc: 1, s: 0, age: 0, fl: 0, crit: 6 + 8 * random(),
  };
  // frozen together: one velocity and one spin from the first moment
  const ma = a.R * a.R;
  const mb = b.R * b.R;
  const vx = (a.vx * ma + b.vx * mb) / (ma + mb);
  const vy = (a.vy * ma + b.vy * mb) / (ma + mb);
  const om = (a.om * ma + b.om * mb) / (ma + mb);
  a.vx = b.vx = vx;
  a.vy = b.vy = vy;
  a.om = b.om = om;
  S.bonds.push(bd);
  a.partners.push(b);
  b.partners.push(a);
  S.stat.bond++;
}

function breakBond(S, bd) {
  const { a, b } = bd;
  const i = S.bonds.indexOf(bd);
  if (i >= 0) S.bonds.splice(i, 1);
  a.partners.splice(a.partners.indexOf(b), 1);
  b.partners.splice(b.partners.indexOf(a), 1);
  const dx = wx(b.x - a.x);
  const dy = wy(b.y - a.y);
  const ang = atan2(dy, dx);
  raiseRim(a, ang, 0.55);
  raiseRim(b, ang + PI, 0.55);
  a.touch[b.id] = -14;
  b.touch[a.id] = -14;
  S.stat.brk++;
}

function flow(S, p) {
  let u = 0;
  let v = 0;
  for (let i = 0; i < 3; i++) {
    const w = WV[i];
    const c = cos(w.kx * p.x + w.ky * p.y + S.arg[i]);
    const q = S.ai[i] * w.om * c;
    u += q * w.nx;
    v += q * w.ny;
  }
  for (let j = 0; j < 3; j++) {
    const g = GY[j];
    const c = cos(g.kx * p.x + g.ky * p.y + S.gph[j]) * S.gc[j];
    u += c * g.px;
    v += c * g.py;
  }
  p.ax = (u - p.vx) / 0.8;
  p.ay = (v - p.vy) / 0.8;
}

const OMN = 14;
const ZETA = 0.35;
const KT = 6;
const MU = 0.55;

function substep(S, dt) {
  const ps = S.plates;
  const n = ps.length;
  S.t += dt;
  const t = S.t;
  for (let i = 0; i < 3; i++) {
    const w = WV[i];
    S.arg[i] = -w.om * t + S.ph[i] + 0.9 * sin(w.nu * t + S.ph2[i]);
    S.ev[i] = 0.62 + 0.38 * sin(w.ev * t + S.ph3[i]);
    S.ai[i] = 1.7 * S.sw * w.sh * S.ev[i];
    S.gph[i] = GY[i].om * t + S.gph[i] * 0 + S.ph3[i];
  }
  const gs = 0.5 + 0.1 * S.sw;
  for (let j = 0; j < 3; j++) S.gc[j] = GY[j].s * gs * (0.7 + 0.3 * sin(0.0173 * (j + 1.3) * t + S.ph[j]));
  for (let i = 0; i < n; i++) {
    const p = ps[i];
    flow(S, p);
    p.al = -0.3 * p.om;
    p.crowd = false;
  }
  for (let i = 0; i < n; i++) {
    const a = ps[i];
    for (let j = i + 1; j < n; j++) {
      const b = ps[j];
      const reach = (a.R + b.R) * 1.12 + 0.6;
      const dx = wx(b.x - a.x);
      if (dx > reach || dx < -reach) continue;
      const dy = wy(b.y - a.y);
      if (dy > reach || dy < -reach) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach * reach) continue;
      const dist = sqrt(d2) + 1e-6;
      const nx = dx / dist;
      const ny = dy / dist;
      const phi = atan2(dy, dx);
      const gap = dist - (radiusAtAngle(a, phi) + radiusAtAngle(b, phi + PI));
      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const vn = rvx * nx + rvy * ny;
      const tx = -ny;
      const ty = nx;
      const vt0 = rvx * tx + rvy * ty;
      const bonded = bondedWith(a, b);
      if (!bonded && gap < 0.4) {
        const rv = sqrt(rvx * rvx + rvy * rvy);
        const k = b.id;
        const prev = a.touch[k] || 0;
        a.touch[k] = rv < 1.6 ? prev + dt : max(prev - dt * 2, -20);
        if (a.touch[k] > 9 + (k % 7) * 1.4 && S.sw < 3.4) {
          a.touch[k] = random() < 0.3 && S.bonds.length < 0.2 * n ? a.touch[k] : -25;
          const seen = new Set();
          const sa = clusterSize(a, seen);
          const sb = clusterSize(b, new Set(seen));
          if (a.touch[k] > 0 && a.partners.length < 2 && b.partners.length < 2 && a.R > 3 && b.R > 3 && a.alpha > 0.95 && b.alpha > 0.95 && sa + sb <= 4 && !seen.has(b)) {
            makeBond(S, a, b, dx, dy);
            a.touch[k] = -30;
          }
        }
      }
      if (gap >= 0 || bonded) continue;
      const delta = -gap;
      if (delta > 0.4) {
        a.crowd = true;
        b.crowd = true;
      }
      const ma = a.R * a.R;
      const mb = b.R * b.R;
      const M = ma + mb;
      let an = OMN * OMN * delta - 2 * ZETA * OMN * vn;
      if (an < 0) an = 0;
      // tangential: contact velocity of b relative to a, spin included
      const vt = vt0 - b.om * b.R - a.om * a.R;
      let at = -KT * vt;
      const lim = MU * an;
      if (at > lim) at = lim;
      else if (at < -lim) at = -lim;
      a.ax -= (an * nx * mb) / M;
      a.ay -= (an * ny * mb) / M;
      b.ax += (an * nx * ma) / M;
      b.ay += (an * ny * ma) / M;
      a.ax -= (at * tx * mb) / M;
      a.ay -= (at * ty * mb) / M;
      b.ax += (at * tx * ma) / M;
      b.ay += (at * ty * ma) / M;
      a.al += (2 * (-at * mb) / M) / a.R;
      b.al += (-2 * ((at * ma) / M)) / b.R;
      if (vn < -0.3) {
        raiseRim(a, phi, 0.1 * an * dt, a.fl);
        raiseRim(b, phi + PI, 0.1 * an * dt, b.fl);
      }
      // dissipated work raises the rims where they meet
      const diss = 2 * ZETA * OMN * vn * vn + abs(at * vt);
      if (diss > 0.02) {
        const amt = 0.3 * diss * dt;
        raiseRim(a, phi, amt);
        raiseRim(b, phi + PI, amt);
        S.stat.bump += amt;
      }
    }
  }
  for (let i = S.bonds.length - 1; i >= 0; i--) {
    const bd = S.bonds[i];
    const { a, b } = bd;
    bd.age += dt;
    bd.s = min(1, bd.s + dt / 35);
    bd.sc = max(0.93, bd.sc - dt * 0.007);
    const ca = cos(a.th);
    const sa = sin(a.th);
    const rx = bd.rx * bd.sc;
    const ry = bd.ry * bd.sc;
    const ex = wx(b.x - (a.x + ca * rx - sa * ry));
    const ey = wy(b.y - (a.y + sa * rx + ca * ry));
    // the bond's anchor point moves with a's spin as well as a's drift
    const avx = a.vx - a.om * (sa * rx + ca * ry);
    const avy = a.vy + a.om * (ca * rx - sa * ry);
    const ramp = min(1, bd.age / 3);
    const fx = ramp * (-110 * ex - 11 * (b.vx - avx));
    const fy = ramp * (-110 * ey - 11 * (b.vy - avy));
    const ma = a.R * a.R;
    const mb = b.R * b.R;
    const M = ma + mb;
    b.ax += (fx * ma) / M;
    b.ay += (fy * ma) / M;
    a.ax -= (fx * mb) / M;
    a.ay -= (fy * mb) / M;
    let dth = b.th - a.th - bd.dth0;
    dth -= TAU * round(dth / TAU);
    const tq = -60 * dth - 8 * (b.om - a.om);
    b.al += (tq * ma) / M;
    a.al -= (tq * mb) / M;
    // short knocks pass through; it is the strain held for half a second that cracks it
    bd.fl += (sqrt(fx * fx + fy * fy) - bd.fl) * (dt / 0.6);
    if (bd.fl > bd.crit * (0.7 + 0.3 * bd.s) || random() < dt * (0.004 + 0.003 * S.sw)) breakBond(S, bd);
  }
  const e = exp(-dt / 6);
  for (let i = 0; i < n; i++) {
    const p = ps[i];
    p.vx += p.ax * dt;
    p.vy += p.ay * dt;
    const sp = sqrt(p.vx * p.vx + p.vy * p.vy);
    if (sp > 10) {
      p.vx *= 10 / sp;
      p.vy *= 10 / sp;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < 0) p.x += W;
    else if (p.x >= W) p.x -= W;
    if (p.y < 0) p.y += H;
    else if (p.y >= H) p.y -= H;
    p.om += p.al * dt;
    p.th += p.om * dt;
    // growth toward the plate's own size; melting runs it down
    if (p.melt) p.R = max(0, p.R - 0.45 * dt);
    else if (!p.crowd) p.R += cl((p.Rt - p.R) * (1 - e), -0.6 * dt, 0.17 * dt);
    else if (p.R > p.Rt) p.R -= 0.3 * dt;
    p.age += dt;
    if (p.alpha < 1) p.alpha = min(1, p.alpha + dt / 2.5);
  }
}

function startMelt(S, p) {
  p.melt = true;
  p.Rt = 0;
  for (const q of p.partners.slice()) {
    const bd = S.bonds.find((x) => (x.a === p && x.b === q) || (x.b === p && x.a === q));
    if (bd) breakBond(S, bd);
  }
  S.stat.melt++;
}

function clearance(S, x, y) {
  let c = 1e9;
  for (const p of S.plates) {
    const dx = wx(p.x - x);
    const dy = wy(p.y - y);
    c = min(c, sqrt(dx * dx + dy * dy) - p.R * 1.06);
  }
  return c;
}

function nucleate(S) {
  let bx = 0;
  let by = 0;
  let best = -1e9;
  for (let i = 0; i < 30; i++) {
    const x = random() * W;
    const y = random() * H;
    const c = clearance(S, x, y) + 2 * random();
    if (c > best) {
      best = c;
      bx = x;
      by = y;
    }
  }
  if (clearance(S, bx, by) < 3.6) return false;
  const p = newPlate(S, bx, by, 1.9, sizeFactor());
  p.alpha = 0;
  p.age = 0;
  S.plates.push(p);
  S.sl = max(0.15, S.sl - 0.07);
  S.stat.nuc++;
  return true;
}

function advance(S, dt) {
  const k = S.k;
  const e = 1 - exp(-dt / 0.7);
  S.sw += (cl(k[1], 0.4, 4) - S.sw) * e;
  S.rt += (7.3 + cl(k[2], -3, 3) - S.rt) * e;
  S.cover += (coverOf(k[3]) - S.cover) * (1 - exp(-dt / 2));
  const ps = S.plates;
  for (const p of ps) if (!p.melt) p.Rt = S.rt * p.f;
  // How much ice the surface is meant to carry, against what is committed to it.
  let committed = 0;
  for (const p of ps) if (!p.melt) committed += PI * p.Rt * p.Rt;
  const want = S.cover * W * H;
  const mean = PI * S.rt * S.rt * 1.15;
  const q = (want - committed) / want;
  S.sl += (cl(0.45 + 0.9 * q, 0.2, 0.85) - S.sl) * (dt / 45);
  S.nuc -= dt * (0.4 + S.sl) * (q < -0.2 ? 2.5 : 1);
  if (S.nuc <= 0) {
    S.nuc = 2.5 + 5 * random();
    let melting = 0;
    let oldest = null;
    for (const p of ps) {
      if (p.melt) melting++;
      else if (p.age > p.life && (!oldest || p.age - p.life > oldest.age - oldest.life)) oldest = p;
    }
    if (committed < want - 0.5 * mean && ps.length < 80) nucleate(S);
    else if (committed > want + 0.55 * mean) {
      let pick = null;
      for (const p of ps) if (!p.melt && (!pick || p.Rt < pick.Rt)) pick = p;
      if (pick) startMelt(S, pick);
    } else if (oldest && melting < 2) startMelt(S, oldest);
  }
  const n = Math.ceil(dt / 0.012);
  for (let i = 0; i < n; i++) substep(S, dt / n);
  // rims relax and spread; melted plates go
  const relax = 1 - exp(-dt / 55);
  const fd = exp(-dt / 0.45);
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    for (let b = 0; b < NB; b++) {
      const l = p.rim[(b + NB - 1) % NB];
      const r = p.rim[(b + 1) % NB];
      p.rimE[b] = p.rim[b] + 0.1 * dt * (l + r - 2 * p.rim[b]) - p.rim[b] * relax;
    }
    for (let b = 0; b < NB; b++) p.rim[b] = cl(p.rimE[b], 0, 2.5);
    for (let b = 0; b < NB; b++) p.fl[b] *= fd;
    if (p.melt && p.R < 1.6) {
      ps.splice(i, 1);
    }
  }
}

function prime(S) {
  S.first = false;
  S.sw = cl(S.k[1], 0.4, 4);
  S.rt = 7.3 + cl(S.k[2], -3, 3);
  S.cover = coverOf(S.k[3]);
  const want = S.cover * W * H;
  let committed = 0;
  for (let tries = 0; tries < 600 && committed < want; tries++) {
    const f = sizeFactor();
    const R = S.rt * f;
    const x = random() * W;
    const y = random() * H;
    if (clearance(S, x, y) < R * 0.85 + 0.5) continue;
    const pl = newPlate(S, x, y, R, f);
    pl.age = random() * pl.life;
    pl.R = max(2.4, R * (1 - exp(-pl.age / 45)));
    S.plates.push(pl);
    committed += PI * R * R;
  }
  S.t = random() * 100;
  for (let t = 0; t < 70; t += 1 / 30) advance(S, 1 / 30);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) prime(S);
  advance(S, dt);
}

// ---------------------------------------------------------------------------
// drawing

function setMatrix(M, a) {
  const c = cos(a);
  const s = sin(a);
  const k = (1 - c) / 3;
  const q = s * 0.57735027;
  M[0] = c + k; M[1] = k - q; M[2] = k + q;
  M[3] = k + q; M[4] = c + k; M[5] = k - q;
  M[6] = k - q; M[7] = k + q; M[8] = c + k;
}
function rot(M, r, g, b) {
  return [
    cl(M[0] * r + M[1] * g + M[2] * b, 0, 1.4),
    cl(M[3] * r + M[4] * g + M[5] * b, 0, 1.4),
    cl(M[6] * r + M[7] * g + M[8] * b, 0, 1.4),
  ];
}

function palette(S) {
  setMatrix(S.M, TAU * S.k[0]);
  const M = S.M;
  const P = S.pal;
  P.deep = rot(M, 0.14, 0.06, 0.3);
  P.teal = rot(M, 0.02, 0.26, 0.34);
  P.glint = rot(M, 0.25, 0.55, 0.65);
  P.slush = rot(M, 0.56, 0.63, 0.67);
  P.ice = rot(M, 0.66, 0.92, 0.86);
  P.warm = rot(M, 0.9, 0.95, 0.8);
  P.cool = rot(M, 0.6, 0.85, 0.96);
  P.young = rot(M, 0.42, 0.58, 0.58);
  P.rose = rot(M, 1.0, 0.76, 0.84);
  P.crest = rot(M, 0.97, 1.0, 0.98);
  P.shade = rot(M, 0.18, 0.4, 0.5);
}

function platePrep(p) {
  p.C2 = cos(2 * (p.th + p.q2));
  p.S2 = sin(2 * (p.th + p.q2));
  p.C3 = cos(3 * (p.th + p.q3));
  p.S3 = sin(3 * (p.th + p.q3));
}

function wobbleR(p, cx, sy) {
  const c2 = cx * cx - sy * sy;
  const s2 = 2 * cx * sy;
  const c3 = cx * (cx * cx - 3 * sy * sy);
  const s3 = sy * (3 * cx * cx - sy * sy);
  return p.R * (1 + p.a2 * (c2 * p.C2 + s2 * p.S2) + p.a3 * (c3 * p.C3 + s3 * p.S3));
}

function sdPass(S) {
  const sd = S.sd;
  sd.fill(1e3);
  for (const p of S.plates) {
    if (p.R < 0.8) continue;
    platePrep(p);
    const reach = p.R * 1.12 + 12;
    const hold = (1 - p.alpha) * 6;
    for (let y = floor(p.y - reach); y <= floor(p.y + reach); y++) {
      const row = (((y % H) + H) % H) * W;
      const dy = y + 0.5 - p.y;
      for (let x = floor(p.x - reach); x <= floor(p.x + reach); x++) {
        const dx = x + 0.5 - p.x;
        const dist = sqrt(dx * dx + dy * dy) + 1e-6;
        const v = dist - wobbleR(p, dx / dist, dy / dist) + hold;
        const idx = row + ((x % W) + W) % W;
        if (v < sd[idx]) sd[idx] = v;
      }
    }
  }
}

function waterPass(S) {
  const { buf, sd, tl, tSX, tCX, tSY, tCY, pal } = S;
  const t = S.t;
  const gs = 0.3 + 0.7 * (S.sw / 4);
  const e = [0, 0, 0];
  const gk = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const w = WV[i];
    e[i] = w.sh * S.ev[i] * gs;
    gk[i] = 9 * (w.kx * SX + w.ky * SY);
    for (let x = 0; x < W; x++) {
      const a = w.kx * (x + 0.5) + S.arg[i];
      tSX[i * W + x] = sin(a);
      tCX[i * W + x] = cos(a);
    }
    for (let y = 0; y < H; y++) {
      const b = w.ky * (y + 0.5);
      tSY[i * H + y] = sin(b);
      tCY[i * H + y] = cos(b);
    }
  }
  const sl = S.sl * (1.5 - 0.8 * S.cover);
  const ox = 1;
  const oy = 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      let eta = 0;
      let slope = 0;
      for (let i = 0; i < 3; i++) {
        const sa = tSX[i * W + x] * tCY[i * H + y] + tCX[i * W + x] * tSY[i * H + y];
        const ca = tCX[i * W + x] * tCY[i * H + y] - tSX[i * W + x] * tSY[i * H + y];
        eta += e[i] * sa;
        slope += e[i] * gk[i] * ca;
      }
      tl[idx] = slope;
      const wv = cl(0.38 + 0.3 * eta, 0, 1);
      let r = lerp(pal.deep[0], pal.teal[0], wv);
      let g = lerp(pal.deep[1], pal.teal[1], wv);
      let b = lerp(pal.deep[2], pal.teal[2], wv);
      const gl = cl(slope, 0, 1.5);
      r += pal.glint[0] * gl * 0.3;
      g += pal.glint[1] * gl * 0.3;
      b += pal.glint[2] * gl * 0.3;
      // slush: thickest against the plates, clotted by a slow cloud
      const d = sd[idx];
      const halo = d < 40 ? exp(-max(d, 0) / 6.5) : 0;
      const u = x + 4 * sin(0.07 * y + 0.09 * t + 1);
      const v = y + 4 * sin(0.09 * x - 0.07 * t);
      const nz = 0.5 + 0.17 * sin(0.21 * u + 0.17 * v + 0.031 * t) + 0.17 * sin(0.13 * u - 0.24 * v - 0.043 * t + 2) + 0.16 * sin(0.07 * u + 0.05 * v + 0.017 * t + 4);
      const sa = cl(sl * (0.2 + 0.8 * halo) * (0.3 + 0.9 * nz), 0, 0.8);
      r = lerp(r, pal.slush[0], sa);
      g = lerp(g, pal.slush[1], sa);
      b = lerp(b, pal.slush[2], sa);
      // shadow of the plates, thrown away from the sun
      const sx = (((x - ox) % W) + W) % W;
      const sy2 = (((y - oy) % H) + H) % H;
      const ds = sd[sy2 * W + sx];
      const sh = ds < 3 ? sm(cl(0.5 - ds / 2.4, 0, 1)) * 0.5 : 0;
      const o = idx * 3;
      buf[o] = r * (1 - sh);
      buf[o + 1] = g * (1 - sh);
      buf[o + 2] = b * (1 - sh);
    }
  }
}

function drawPlate(S, p) {
  const { buf, tl, pal } = S;
  if (p.R < 0.9) return;
  platePrep(p);
  const R = p.R;
  const reach = R * 1.12 + 2.5;
  const ice = pal.ice;
  const rose = pal.rose;
  const crestC = pal.crest;
  const shade = pal.shade;
  const warm = pal.warm;
  const cool = pal.cool;
  const young = pal.young;
  // lip: the rim seen through the seam mask of its bonds
  const rimE = p.rimE;
  for (let b = 0; b < NB; b++) rimE[b] = p.rim[b];
  for (const q of p.partners) {
    const bd = S.bonds.find((z) => (z.a === p && z.b === q) || (z.b === p && z.a === q));
    if (!bd) continue;
    const ang = atan2(wy(q.y - p.y), wx(q.x - p.x)) - p.th;
    for (let b = 0; b < NB; b++) {
      let da = ((b + 0.5) / NB) * TAU - ang;
      da -= TAU * round(da / TAU);
      const w = cl(1.4 - abs(da) / 0.7, 0, 1);
      rimE[b] *= 1 - 0.92 * bd.s * w;
    }
  }
  const x0 = floor(p.x - reach);
  const x1 = floor(p.x + reach);
  const y0 = floor(p.y - reach);
  const y1 = floor(p.y + reach);
  const cth = cos(p.th);
  const sth = sin(p.th);
  for (let y = y0; y <= y1; y++) {
    const gy = ((y % H) + H) % H;
    const dy = y + 0.5 - p.y;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - p.x;
      const dist = sqrt(dx * dx + dy * dy) + 1e-6;
      const cx = dx / dist;
      const sy = dy / dist;
      const rr = wobbleR(p, cx, sy);
      const sdd = dist - rr;
      if (sdd > 0.9) continue;
      const cov = sm(cl(0.5 - sdd / 1.25, 0, 1)) * p.alpha;
      if (cov <= 0.002) continue;
      const depth = -sdd;
      const gx = ((x % W) + W) % W;
      const idx = gy * W + gx;
      const tilt = tl[idx];
      // plate body: pale ice, tipped by the swell, with a faint frost in its own frame
      const lu = dx * cth + dy * sth;
      const lv = -dx * sth + dy * cth;
      const frost = 0.045 * (sin(0.55 * lu + 1.3 * sin(0.4 * lv + p.id)) + sin(0.47 * lv - 0.31 * lu + p.id * 2.3));
      const body = (0.8 + 0.2 * tilt + frost) * p.v;
      const tw = abs(p.tint) * 0.4;
      const tc = p.tint > 0 ? warm : cool;
      const yg = exp(-p.age / 30) * 0.7;
      let cr = (ice[0] + (tc[0] - ice[0]) * tw + (young[0] - ice[0]) * yg) * body;
      let cg = (ice[1] + (tc[1] - ice[1]) * tw + (young[1] - ice[1]) * yg) * body;
      let cb = (ice[2] + (tc[2] - ice[2]) * tw + (young[2] - ice[2]) * yg) * body;
      if (depth < 5) {
        let a = atan2(dy, dx) - p.th;
        a -= TAU * floor(a / TAU);
        const fb = (a / TAU) * NB;
        const b0 = floor(fb) % NB;
        const rv = lerp(rimE[b0], rimE[(b0 + 1) % NB], fb - floor(fb));
        const fv = min(1, lerp(p.fl[b0], p.fl[(b0 + 1) % NB], fb - floor(fb)));
        const hv = (0.42 + 0.58 * (1 - exp(-0.9 * rv))) * (1 - 0.5 * yg) * (1 + 0.35 * fv);
        const dc = 1.15 + 0.8 * hv;
        const wl = 0.8 + 0.6 * hv;
        const z = (depth - dc) / wl;
        const hl = hv * exp(-z * z);
        const dh = (hl * (-2 * z)) / wl;
        const term = dh * (cx * SX + sy * SY) * 1.4;
        const lit = max(0, term);
        const dark = max(0, -term);
        const cf = cl(hl * 0.95 + 0.4 * fv * exp(-z * z), 0, 0.95);
        cr += (crestC[0] - cr) * cf;
        cg += (crestC[1] - cg) * cf;
        cb += (crestC[2] - cb) * cf;
        const lw = cl(lit * 1.2, 0, 0.9);
        cr += (rose[0] - cr) * lw;
        cg += (rose[1] - cg) * lw;
        cb += (rose[2] - cb) * lw;
        const dw = cl(dark * 1.0, 0, 0.5);
        cr += (shade[0] - cr) * dw;
        cg += (shade[1] - cg) * dw;
        cb += (shade[2] - cb) * dw;
      }
      const o = idx * 3;
      buf[o] += (cr - buf[o]) * cov;
      buf[o + 1] += (cg - buf[o + 1]) * cov;
      buf[o + 2] += (cb - buf[o + 2]) * cov;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  palette(S);
  sdPass(S);
  waterPass(S);
  for (const p of S.plates) drawPlate(S, p);
  const buf = S.buf;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, 255 * min(1, buf[i]), 255 * min(1, buf[i + 1]), 255 * min(1, buf[i + 2]));
    }
}
