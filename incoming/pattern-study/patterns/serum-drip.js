// ===== Patternflow pattern =====
// Title:   Serum Drip
// Family:  cosmetic
// Idea:    A thread of clear tinted serum falls from the top edge the height of the panel, necks and swells into beads on a string, the filaments between them thin and snap, and round drops with now and then a small satellite fall into a shallow pool at the bottom, while the stream keeps coming and the lit wall shows through every bead, magnified.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 39, after a serum stretched from a dropper into a thread that beads up and breaks (the Plateau-Rayleigh instability, Joseph Plateau, 1873, and Lord Rayleigh, 1878)
// Round:   39
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Viscosity=-1..1, Flow=-1..1
//
// Knob 1: Hue. Turns the serum round the whole wheel, and the wall behind it takes a faint tint of the same hue. At 0 gold on a grey wall; at 0.04 yellow, 0.1 lime, 0.2 green, 0.36 aqua, 0.46 azure, 0.53 blue, 0.6 violet, 0.7 magenta, 0.78 rose, 0.86 red, 0.92 vermilion and 0.96 orange. From red-orange through gold to lime the wall is greyed and lifted a little and the pool lit from within, so the serum and its pool read amber, gold or lemon, never brown or olive.
// Knob 2: Speed. At 2 the serum leaves the top edge at 28 LEDs a second, falls the height of the panel in about 3 seconds, and a drop breaks off about every 1.4 seconds; at 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Viscosity. At 0 the ripples grow down the thread into beads on a string, the filaments between them thin and snap about row 80, and drops 15 LEDs across fall into a pool 14 rows deep, now and then with a satellite. At -1 the serum is nine times thinner and snaps into clean drops about row 45. Turned up, the beads stay joined longer: from about 0.35 the thread reaches the pool unbroken as a string of beads, and at 1, nine times thicker than at 0, the ripples barely grow and the pool, draining slower, stands 21 rows deep.
// Knob 4: Flow. How fast the serum leaves the top edge, 2.2 times slower at -1 and 2.2 times faster at 1. At -1 it cannot keep a thread going and drips: a drop swells below the top edge to 21 LEDs across and lets go about every 10 seconds; at -0.5 the thread breaks about row 60 into drops 19 across; from 0.5 it runs into the pool before it can break, and the pool rises to 19 rows.

const W = 64, H = 128, NMAX = 800, PMAX = 64;
const { floor, min, max, abs, sqrt, exp, sin, cos, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The thread, in LEDs and seconds at Speed 2, is a slender-thread model: a
// chain of slices of fixed volume between nodes on the vertical axis, each
// slice a short cylinder. The area of the surface pulls on the nodes
// (surface tension over density SIG), gravity GR pulls them down, and
// viscosity resists stretching. A still thread in this model grows ripples
// at the rates of Rayleigh's theory, fastest at nine radii. The serum leaves
// an opening of radius A0, ZN above the top edge and never drawn.
// TS slows the whole film down without changing a shape, Q scales the
// thread: every rate below is set so the same shapes come at any Q.
const TS = 0.7, Q = 1.18;
const ZN = -5, A0 = 3.4 * Q, GR = 12 * Q * TS * TS, SIG = 2200 * Q ** 3 * TS * TS, DZ = 0.9, HCUT = 0.13;
// A tremor in the flow ripples the thread's radius by about a sixth as it
// leaves, at 8.8 radii, the wavelength that grows fastest on a thread at
// rest, wandering a little either side of it. The fall stretches the
// ripples as they go.
const LAM = 30 * Q;
// Viscosity at Viscosity 0, in LEDs squared a second.
const NU0 = 55 * Q * Q * TS;
// The pool's rest surface, its depth into the wall, and the ripple speed.
const POOL = 117, DEPTH = 18, CW = 40;
// Opening hue: gold.
const H0 = 0.14;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

export function setup(params) {
  const F = () => new Float64Array(NMAX);
  params.s = {
    hue: 0, rate: 1, nu: 30, v0: 16, begun: false, t: 0,
    n: 0, z: F(), u: F(), x: F(), V: F(), L: F(), h: F(), G: F(), f: F(), m: F(), lk: new Uint8Array(NMAX),
    ca: F(), cb: F(), cc: F(), cd: F(),
    drops: [], noise: 0, sway: random() * 6.28, pour: 0, ph: 0, jit: 0,
    lvl: POOL, eta: new Float64Array(W), etv: new Float64Array(W),
    PH: new Float64Array(2 * H), PX: new Float64Array(2 * H), PD: new Float64Array(2 * H), PT: new Float64Array(2 * H),
    ser: [0, 0, 0], wall: [0, 0, 0],
  };
  const S = params.s;
  // The node at the opening.
  S.n = 1;
  S.z[0] = ZN;
  S.u[0] = S.v0;
  S.x[0] = 32;
}

// Where the serum leaves the top edge: the hand above drifts slowly from
// side to side, and the thread below keeps the curve of where it has been.
const openX = (S) => 32 + 5 * sin(S.sway + S.t * 0.6 * TS) + 1.5 * sin(S.sway * 2.3 + S.t * 1.4 * TS);

function insert(S, i) {
  const { z, u, x, V, lk } = S;
  z.copyWithin(i + 1, i, S.n);
  u.copyWithin(i + 1, i, S.n);
  x.copyWithin(i + 1, i, S.n);
  V.copyWithin(i + 1, i, S.n);
  lk.copyWithin(i + 1, i, S.n);
  S.n++;
}

function remove(S, i) {
  const { z, u, x, V, lk } = S;
  z.copyWithin(i, i + 1, S.n);
  u.copyWithin(i, i + 1, S.n);
  x.copyWithin(i, i + 1, S.n);
  V.copyWithin(i, i + 1, S.n);
  lk.copyWithin(i, i + 1, S.n);
  S.n--;
}

// Node i is kinematic: the opening, or a node already in the pool.
const kin = (S, i) => i === 0 || S.z[i] > S.lvl;

function step(S, dt) {
  const { z, u, V, L, h, G, f, m, lk, ca, cb, cc, cd } = S, n = S.n;
  // The node at the opening moves at the speed the serum leaves it.
  u[0] = S.v0;
  // Slices: length and radius.
  for (let i = 0; i < n - 1; i++) {
    G[i] = 0;
    if (!lk[i]) continue;
    L[i] = max(1e-4, z[i + 1] - z[i]);
    h[i] = sqrt(V[i] / (PI * L[i]));
  }
  // dArea / dLength of each slice: half a cylinder at each end (with a flat
  // cap at a free end), a frustum between the middles of every two slices.
  for (let i = 0; i < n - 1; i++) {
    if (!lk[i]) continue;
    const hi = h[i], Li = L[i], dhi = -hi / (2 * Li);
    const top = i === 0 || !lk[i - 1], bot = i + 1 === n - 1 || !lk[i + 1];
    if (top) G[i] += PI * (hi / 2 - (kin(S, i) ? 0 : (hi * hi) / Li));
    if (bot) G[i] += PI * (hi / 2 - (kin(S, i + 1) ? 0 : (hi * hi) / Li));
    else {
      const j = i + 1, hj = h[j], Lj = L[j], dhj = -hj / (2 * Lj), d = (Li + Lj) / 2, dl = hi - hj, Q = sqrt(d * d + dl * dl), hs = hi + hj;
      G[i] += PI * (dhi * Q + (hs * (d / 2 + dl * dhi)) / Q);
      G[j] += PI * (dhj * Q + (hs * (d / 2 - dl * dhj)) / Q);
    }
  }
  for (let i = 0; i < n; i++) {
    f[i] = 0;
    m[i] = 0;
  }
  for (let i = 0; i < n - 1; i++) {
    if (!lk[i]) continue;
    f[i] += SIG * G[i];
    f[i + 1] -= SIG * G[i];
    m[i] += V[i] / 2;
    m[i + 1] += V[i] / 2;
  }
  for (let i = 0; i < n; i++) if (!kin(S, i) && m[i] > 0) u[i] += dt * (f[i] / m[i] + GR);
  // Viscosity, implicit: each slice resists stretching with 3 nu V / L^2,
  // solved along each chain as a tridiagonal system.
  const nu = S.nu;
  let a = 0;
  while (a < n) {
    let b = a;
    while (b < n - 1 && lk[b]) b++;
    if (b > a) {
      for (let i = a; i <= b; i++) {
        const cl0 = i > a ? (3 * nu * V[i - 1]) / (L[i - 1] * L[i - 1]) : 0, cr = i < b ? (3 * nu * V[i]) / (L[i] * L[i]) : 0;
        if (kin(S, i)) {
          ca[i] = 0;
          cb[i] = 1;
          cc[i] = 0;
          cd[i] = u[i];
        } else {
          ca[i] = -dt * cl0;
          cb[i] = m[i] + dt * (cl0 + cr);
          cc[i] = -dt * cr;
          cd[i] = m[i] * u[i];
        }
      }
      for (let i = a + 1; i <= b; i++) {
        const w = ca[i] / cb[i - 1];
        cb[i] -= w * cc[i - 1];
        cd[i] -= w * cd[i - 1];
      }
      u[b] = cd[b] / cb[b];
      for (let i = b - 1; i >= a; i--) u[i] = (cd[i] - cc[i] * u[i + 1]) / cb[i];
    }
    a = b + 1;
  }
  for (let i = 0; i < n; i++) z[i] += dt * u[i];
  S.t += dt;
}

// After a step: feed the opening, split long slices, merge short ones, cut
// the thread where it has thinned to nothing, roll free pieces up into drops,
// and pour what reaches the pool into it.
function tidy(S) {
  const { z, u, x, V, lk } = S;
  // The opening: a new slice each time the last one has left it.
  if (z[0] >= ZN + DZ && S.n < NMAX - 2) {
    insert(S, 0);
    z[0] = z[1] - DZ;
    u[0] = S.v0;
    x[0] = openX(S);
    S.noise += 0.35 * (random() - 0.5) - 0.12 * S.noise;
    S.jit += 0.2 * (random() - 0.5) - 0.05 * S.jit;
    S.ph += ((2 * PI * DZ) / LAM) * (1 + 0.25 * S.jit);
    V[0] = PI * A0 * A0 * DZ * (1 + 0.35 * sin(S.ph) + 0.04 * S.noise);
    lk[0] = 1;
  }
  z[0] = max(z[0], ZN);
  for (let i = 0; i < S.n - 1; i++) {
    if (!lk[i]) continue;
    const L = z[i + 1] - z[i], hh = sqrt(V[i] / (PI * max(L, 1e-4))), lo = 0.22 + 0.2 * hh;
    if (L > max(1, 2.6 * lo) && S.n < NMAX - 2) {
      insert(S, i + 1);
      z[i + 1] = (z[i] + z[i + 2]) / 2;
      u[i + 1] = (u[i] + u[i + 2]) / 2;
      x[i + 1] = (x[i] + x[i + 2]) / 2;
      V[i] /= 2;
      V[i + 1] = V[i];
      lk[i + 1] = 1;
    } else if (hh < HCUT) {
      // Pinch-off.
      lk[i] = 0;
      if (i > 0 && lk[i - 1]) V[i - 1] += V[i] / 2;
      if (i + 1 < S.n - 1 && lk[i + 1]) V[i + 1] += V[i] / 2;
    } else if (L < lo) {
      // Merge with a neighbour by dropping the shared node.
      const left = i > 0 && lk[i - 1] && (!(i + 1 < S.n - 1 && lk[i + 1]) || z[i] - z[i - 1] < z[i + 2] - z[i + 1]);
      const right = !left && i + 1 < S.n - 1 && lk[i + 1];
      if (left) {
        // The dropped node's momentum goes half to each neighbour.
        const mr = (V[i - 1] + V[i]) / 2, ma = V[i - 1] / 2, mb = V[i] / 2;
        u[i - 1] = (u[i - 1] * ma + (u[i] * mr) / 2) / (ma + mr / 2);
        u[i + 1] = (u[i + 1] * mb + (u[i] * mr) / 2) / (mb + mr / 2);
        V[i - 1] += V[i];
        remove(S, i);
        i--;
      } else if (right) {
        const j = i + 1, mr = (V[i] + V[j]) / 2;
        u[i] = (u[i] * V[i] / 2 + (u[j] * mr) / 2) / (V[i] / 2 + mr / 2);
        u[j + 1] = (u[j + 1] * V[j] / 2 + (u[j] * mr) / 2) / (V[j] / 2 + mr / 2);
        V[i] += V[j];
        lk[i] = 1;
        remove(S, j);
      }
    }
  }
  // Nodes left with no slice on either side go, but not the one at the opening.
  for (let i = S.n - 1; i > 0; i--) if (!lk[i - 1] && !(i < S.n - 1 && lk[i])) remove(S, i);
  // Chains: roll a short free piece into a drop; pour what is in the pool.
  let a = 0;
  while (a < S.n) {
    let b = a;
    while (b < S.n - 1 && lk[b]) b++;
    if (b > a) {
      let vol = 0, mom = 0, zc = 0, xc = 0;
      for (let i = a; i < b; i++) {
        vol += V[i];
        mom += (V[i] * (u[i] + u[i + 1])) / 2;
        zc += (V[i] * (z[i] + z[i + 1])) / 2;
        xc += (V[i] * (x[i] + x[i + 1])) / 2;
      }
      const R = (0.75 * vol / PI) ** (1 / 3), len = z[b] - z[a];
      if (a > 0 && (b - a <= 2 || len < 2.3 * R) && z[b] <= S.lvl && S.drops.length < PMAX) {
        S.drops.push({ y: zc / vol, x: xc / vol, v: mom / vol, R, vol, e: cl(len / (2 * R) - 1, -0.4, 0.6), ph: 0 });
        for (let i = b; i >= a; i--) remove(S, i);
        continue;
      }
      // Slices wholly under the surface go into the pool.
      while (b > a && z[b - 1] > S.lvl + 1) {
        S.pour += V[b - 1];
        remove(S, b);
        lk[b - 1] = 0;
        b--;
      }
    }
    a = b + 1;
  }
}

function drops(S, d) {
  const { eta, etv } = S;
  for (const p of S.drops) {
    p.v += GR * d;
    p.y += p.v * d;
    // A drop rings at its lowest mode, sqrt(8 SIG / R^3), damped by viscosity.
    p.ph += sqrt((8 * SIG) / (p.R * p.R * p.R)) * d;
    p.e *= exp((-d * (5 * S.nu + 4)) / (p.R * p.R));
  }
  S.drops = S.drops.filter((p) => {
    if (p.y - 0.3 * p.R < S.lvl + eta[cl(round(p.x), 0, W - 1)]) return true;
    S.pour += p.vol;
    const k = p.vol * p.v * 0.0004;
    for (let i = -6; i <= 6; i++) {
      const c = cl(round(p.x) + i, 0, W - 1);
      etv[c] -= k * exp(-(i * i) / (p.R * p.R + 2));
    }
    return false;
  });
  // The pool fills with what comes in and drains back toward its rest level.
  // A thicker serum drains away more slowly, so its pool stands higher.
  S.lvl += -S.pour / (W * DEPTH) + (POOL - S.lvl) * min(1, d / (3 * (S.nu / NU0) ** 0.45));
  S.pour = 0;
  for (let i = 0; i < W; i++) {
    const l = eta[i > 0 ? i - 1 : i], r = eta[i < W - 1 ? i + 1 : i];
    etv[i] += d * (CW * CW * (l + r - 2 * eta[i]) - 4 * etv[i]);
  }
  for (let i = 0; i < W; i++) eta[i] = cl(eta[i] + d * etv[i], -5, 5);
}

function advance(S, d) {
  // Substeps short enough for the stiffest slice: a capillary wave as short
  // as the slice rings at sqrt(SIG h / 2) (pi / L)^2.
  let left = d;
  while (left > 1e-6) {
    let w = 0;
    for (let i = 0; i < S.n - 1; i++) {
      if (!S.lk[i]) continue;
      const L = max(0.05, S.z[i + 1] - S.z[i]), hh = sqrt(S.V[i] / (PI * L));
      w = max(w, (sqrt((SIG * hh) / 2) * PI * PI) / (L * L));
    }
    const dt = min(left, 0.6 / max(w, 1), 1 / 120);
    step(S, dt);
    tidy(S);
    drops(S, dt);
    left -= dt;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.rate = cl(k[1], 0.2, 3) / 2;
  S.nu = NU0 * 9 ** cl(k[2], -1, 1);
  S.v0 = 34 * Q * TS * 2.2 ** cl(k[3], -1, 1);
  if (!S.begun) {
    S.begun = true;
    for (let i = 0; i < 90; i++) advance(S, 1 / 30);
    // The pool opens at the level where it drains as fast as it fills.
    S.lvl = POOL - (PI * A0 * A0 * S.v0 * 3 * (S.nu / NU0) ** 0.45) / (W * DEPTH);
  }
  advance(S, d * S.rate);
}

// The radius and centre of the liquid at half-row samples.
function profile(S) {
  const { PH, PX, PD, z, x, V, lk } = S, n = S.n;
  PH.fill(0);
  PD.fill(0);
  const put = (za, ha, xa, zb, hb, xb) => {
    const k0 = max(0, Math.ceil(2 * za - 0.5)), k1 = min(2 * H - 1, floor(2 * zb - 0.5));
    for (let k = k0; k <= k1; k++) {
      const zz = (k + 0.5) / 2, t = zb > za ? (zz - za) / (zb - za) : 0, hh = ha + (hb - ha) * t;
      if (hh > PH[k]) {
        PH[k] = hh;
        PX[k] = xa + (xb - xa) * t;
        PD[k] = zb > za ? (hb - ha) / (zb - za) : 0;
      }
    }
  };
  let a = 0;
  while (a < n) {
    let b = a;
    while (b < n - 1 && lk[b]) b++;
    if (b > a) {
      let pz = 0, ph = 0, px = 0;
      for (let i = a; i < b; i++) {
        const L = max(1e-3, z[i + 1] - z[i]), hh = sqrt(V[i] / (PI * L)), zm = (z[i] + z[i + 1]) / 2, xm = (x[i] + x[i + 1]) / 2;
        if (i === a) {
          // The upper end: the thread runs off the top edge, a free end is capped.
          if (a === 0) put(z[a] - 2, hh, xm, zm, hh, xm);
          else
            for (let c = 0; c < 4; c++) {
              const t0 = c / 4, t1 = (c + 1) / 4, cap = max(L / 2, 0.8 * hh);
              put(zm - cap * sqrt(1 - t0 * t0), hh * t0, xm, zm - cap * sqrt(1 - t1 * t1), hh * t1, xm);
            }
        } else put(pz, ph, px, zm, hh, xm);
        if (i === b - 1) {
          if (z[b] > S.lvl) put(zm, hh, xm, S.lvl + 2, hh, xm);
          else
            for (let c = 0; c < 4; c++) {
              const t0 = c / 4, t1 = (c + 1) / 4, cap = max(L / 2, 0.8 * hh);
              put(zm + cap * sqrt(1 - t1 * t1), hh * t1, xm, zm + cap * sqrt(1 - t0 * t0), hh * t0, xm);
            }
        }
        pz = zm;
        ph = hh;
        px = xm;
      }
    }
    a = b + 1;
  }
  for (const p of S.drops) {
    const dd = p.e * cos(p.ph), ry = p.R * (1 + dd), rx = p.R / sqrt(1 + dd);
    const k0 = max(0, Math.ceil(2 * (p.y - ry) - 0.5)), k1 = min(2 * H - 1, floor(2 * (p.y + ry) - 0.5));
    for (let k = k0; k <= k1; k++) {
      const w = ((k + 0.5) / 2 - p.y) / ry, hh = rx * sqrt(max(0, 1 - w * w));
      if (hh > PH[k]) {
        PH[k] = hh;
        PX[k] = p.x;
        PD[k] = (-rx * w) / ry / max(0.15, sqrt(max(0, 1 - w * w)));
      }
    }
  }
  // Smooth the radius along the thread so the light runs over it without
  // steps, and take the slope from the smoothed radius.
  const { PT } = S;
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < 2 * H; k++) {
      const a = PH[max(0, k - 1)], b = PH[min(2 * H - 1, k + 1)];
      PT[k] = PH[k] > 0 && a > 0 && b > 0 ? 0.25 * a + 0.5 * PH[k] + 0.25 * b : PH[k];
    }
    PH.set(PT);
  }
  for (let k = 0; k < 2 * H; k++) {
    const a = PH[max(0, k - 1)], b = PH[min(2 * H - 1, k + 1)];
    if (PH[k] > 0 && a > 0 && b > 0) PD[k] = cl(b - a, -4, 4);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.begun) return;
  profile(S);
  const { PH, PX, PD, ser, wall, eta } = S;
  const hue = S.hue + H0;
  hsv(hue, 0.85, 1, ser);
  // Orange and yellow go brown and olive on a dim wall: there the wall is
  // greyed and lifted and the pool glows with the serum's own colour.
  const wu = (hue - floor(hue) - 0.13) / 0.19, wm = wu * wu < 1 ? (1 - wu * wu) ** 2 : 0;
  hsv(hue, 0.14 - 0.1 * wm, 1 + 0.18 * wm, wall);
  const [sr, sg, sb] = ser, [wr, wg, wb] = wall;
  // Absorption per LED of path through the serum, per channel.
  const ar = 0.3 * (1 - sr), ag = 0.3 * (1 - sg), ab = 0.3 * (1 - sb);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let R = 0, G = 0, B = 0;
      const px = x + 0.5, e0 = eta[max(0, x - 1)], e1 = eta[x], e2 = eta[min(W - 1, x + 1)];
      const surf = S.lvl + 0.25 * e0 + 0.5 * e1 + 0.25 * e2, slope = (e2 - e0) / 2, pf = cl(y + 1 - surf, 0, 1);
      if (pf < 1)
        for (let sub = 0; sub < 2; sub++) {
          const k = 2 * y + sub, zz = (k + 0.5) / 2, wv = lit(px, zz);
          let r = wv * wr, g = wv * wg, b = wv * wb;
          const hh = PH[k], dx = px - PX[k], cov = cl(hh - abs(dx) + 0.5, 0, 1);
          if (cov > 0 && hh > 0.2) {
            // Clear serum: the wall behind seen magnified through it and
            // tinted by the path the light takes, a darker rim, an inner
            // glow on the far side, a highlight down the near side.
            const uu = cl(dx / hh, -0.97, 0.97), c = sqrt(1 - uu * uu), hz = PD[k], nn = 1 / sqrt(1 + hz * hz);
            const nx = uu * nn, ny = c * nn, nz = -hz * nn;
            const lv = 1.35 * lit(PX[k] + dx * 0.55, zz + 0.45 * hh * hz), path = 2 * hh * c + 0.5;
            const rim = 1 - 0.5 * exp(-c * 4), glow = 0.7 * max(0, 0.55 * nx + 0.25 * ny + 0.55 * nz) ** 2;
            const sp = max(0, -0.4 * nx + 0.82 * ny - 0.42 * nz), spec = 0.95 * sp ** 40 + 0.12 * sp ** 6;
            r += (lv * wr * exp(-ar * path) * rim + sr * glow + spec - r) * cov;
            g += (lv * wg * exp(-ag * path) * rim + sg * glow + spec - g) * cov;
            b += (lv * wb * exp(-ab * path) * rim + sb * glow + spec - b) * cov;
          }
          R += r / 2;
          G += g / 2;
          B += b / 2;
        }
      if (pf > 0) {
        // The pool: the wall seen through it, a little lower and deeper in
        // colour further down, lit from within, a dark band under the surface.
        const top = max(0, y + 0.5 - surf), wv = lit(px, surf + top * 0.75) * 1.15, path = 3 + 0.3 * top;
        const dk = 1 - 0.35 * exp(-((top - 1.4) ** 2)), gl = 0.2 + 0.06 * wm;
        R += ((wv * wr * exp(-0.4 * ar * path) + gl * sr) * dk - R) * pf;
        G += ((wv * wg * exp(-0.4 * ag * path) + gl * sg) * dk - G) * pf;
        B += ((wv * wb * exp(-0.4 * ab * path) + gl * sb) * dk - B) * pf;
      }
      // The bright line of the surface, brighter where a ripple tilts it to the light.
      const ln = exp(-(((y + 0.5 - surf) / 0.55) ** 2)) * (0.5 + cl(-slope * 0.8, -0.35, 0.5));
      R += ln;
      G += ln;
      B += ln;
      display.setPixel(x, y, round(255 * min(1, R)), round(255 * min(1, G)), round(255 * min(1, B)));
    }
}

// The lit wall, as a level: pale, light from the upper left, soft vertical
// flutes 8 LEDs apart for the beads to magnify.
const lit = (x, z) => (0.4 + 0.24 * (1 - x / 90 - z / 300)) * (1 + 0.07 * cos((2 * PI * x) / 8));
