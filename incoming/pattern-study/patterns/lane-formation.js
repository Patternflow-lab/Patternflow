// ===== Patternflow pattern =====
// Title:   Lane Formation
// Family:  particle
// Idea:    Six hundred soft repulsive particles, half pushed up the standing panel and half pushed down by the same field, jostle in overdamped Brownian motion on a periodic 64 by 128 box, and from a mixed start the two kinds jam head-on, slip past one another sideways and sort themselves into vertical lanes that run the whole height, each particle glowing brighter as the column around it fills with its own kind, until a heat pulse melts the lanes back into a mixture and they form again somewhere else.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: lane formation in a binary mixture of Brownian particles driven in opposite directions by an external field (Jürgen Dzubiella, Gerhard Hoffmann and Hartmut Löwen, Lane formation in colloidal mixtures driven by an external field, Phys. Rev. E 65, 021402, 2002), with their lane order parameter; the same lanes in pedestrian counterflow (Dirk Helbing and Péter Molnár, social force model, 1995); the screened Coulomb pair potential (Hideki Yukawa, 1935; Peter Debye and Erich Hückel, 1923); pattern round 103
// Round:   103
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Drive=-1..1, Mix=0.5..0.9
//
// Knob 1: Hue. Turns both kinds round the wheel together, 0.45 of a turn apart. At 0 the particles driven up are azure and the ones driven down are gold; at 0.25 magenta and green, at 0.5 orange and blue, at 0.75 green and pink.
// Knob 2: Speed. At 2 one second on the panel is one second of the dynamics: a free particle drifts 20 LEDs a second at the opening drive, the lanes run the full 128 rows 8 s after a mixed start, and the cycle of forming, holding, melting and cooling takes 22 s. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Drive. The field's push as a free drift speed, 20 times 3 to the knob LEDs a second. At -1 (6.7, Peclet number 89) the two kinds stay jammed in a mixture of short tilted strands, moving at 57 percent of their free drift, and the order parameter stalls near 0.5; at 0 (20, Peclet 267) it climbs from 0.28 to 0.89 in 8 s and to 0.96 by 14 s while the flow rises from 84 to 98 percent of free drift; at 1 (60, Peclet 800) it reaches 0.98 within 2 s and the lanes pack into solid columns with dark gaps between them.
// Knob 4: Mix. The share of particles driven up. At 0.5 the two kinds are 300 and 300 and settle into broad lanes of each; at 0.7 the 180 driven down run in three thin lanes through the stream of the other kind, and toward 0.9 the 60 left gather into one short strand and stray dots. Turning it relabels particles one at a time at random places, and the new ones sort themselves again.

// The dynamics are overdamped Langevin, one equation per particle with the
// mobility set to 1, so a force is a velocity in LEDs a second:
//
//   dr_i = (sum over j of F(r_ij) + q_i E y) dt + sqrt(2 D dt) xi_i,
//
// q_i = +1 for the kind driven up the panel and -1 for the other, E the
// field, D the diffusion constant and xi a unit random kick. The pair force
// comes from a Yukawa potential V(r) = A exp(-kappa r) / r with kappa = 1
// per LED, cut off and shifted to zero at 4 LEDs, its strength set so the
// force at the diameter sigma = 2 LEDs is three times the opening drive. The
// box is periodic both ways, so a particle leaving the top comes in at the
// bottom and a lane has no ends.
//
// The two kinds never attract each other or their own. A particle driven up
// that meets one driven down is held head-on until the noise or a third
// particle tips it sideways, and once it has slipped into a column of its
// own kind it meets nobody coming the other way. That is the whole sorting:
// collisions push the kinds apart sideways and nothing pushes them back,
// so lanes grow and merge until each runs the whole height. Dzubiella,
// Hoffmann and Löwen saw it in Brownian dynamics in 2002, and Teun Vissers
// and others (2011) filmed it in oppositely charged colloids in an electric
// field.
//
// The order parameter, after Dzubiella, Hoffmann and Löwen: for particle j
// count the particles of its own kind n_s and of the other kind n_o in the
// column around it, here within 2 LEDs to either side and 8 up or down,
// and take phi_j = ((n_s - n_o) / (n_s + n_o))^2; Phi is its mean. A
// particle in a pure lane has phi_j = 1. At 600 particles a column holds
// about 4.7 others, and a uniform random mixture gives Phi = 0.28. The
// square counts a lone particle among the other kind as ordered too, so the
// light uses the share instead: each particle shines by 2 n_s / (n_s + n_o)
// - 1, eased over a fifth of a second, dim at an even share or less and
// full in a pure lane, so a lane brightens as it forms.
//
// The cycle: 18 s with the noise at D = 0.15 LED^2 a second, then a heat
// pulse that raises D to 12 for about 3 s, enough for a particle to wander
// 8 LEDs, the width of a lane, and the lanes melt back to Phi = 0.4; then it
// cools and they form again in new places. Every particle drags a short
// tail of the light it left, a tenth of a second of its own path.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, sqrt, exp, pow, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Particles, diameter, screening and cut-off in LEDs; the opening drive in
// LEDs a second, the cool and hot noise in LED^2 a second, the step.
const NPART = 600, SIG = 2, KAP = 1, RC = 4, E0 = 20, D0 = 0.15, DHOT = 12, HS = 1 / 240, MAXD = 0.4;
// The neighbour grid, cells one cut-off wide.
const GX = W / RC, GY = H / RC, NC = GX * GY;
// The cycle in seconds of the dynamics: forming and holding, then the heat
// pulse (rising, held, cooling), and the head start before the first frame.
const COOL = 18, H_UP = 0.6, H_HOLD = 2.4, H_DOWN = 1, CYCLE = COOL + H_UP + H_HOLD + H_DOWN, PRE = 0.6;
// The order parameter's column, half width and half height; the trail.
const OWX = 2, OWY = 8, TAU = 0.1;

const yuk = (r) => (exp(-KAP * r) * (1 + KAP * r)) / (r * r);
const AMP = (3 * E0) / yuk(SIG), FCUT = yuk(RC);
// Force over distance, so dx * fr(r2) is the x part of the push on j from i.
function fr(r2) {
  const r = sqrt(r2);
  return (AMP * (yuk(r) - FCUT)) / r;
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

export function setup(params) {
  const S = {
    hue: 0, speed: 2, E: E0, share: -1, t: 0, tc: 0, acc: 0, ran: 0, pre: false, phiMean: 0,
    x: new Float64Array(NPART), y: new Float64Array(NPART), u: new Float64Array(NPART), q: new Int8Array(NPART),
    fx: new Float64Array(NPART), fy: new Float64Array(NPART), shine: new Float32Array(NPART), glow: new Float32Array(NPART),
    head: new Int32Array(NC), next: new Int32Array(NPART), buf: new Float32Array(NP * 3),
  };
  // A uniform mixture, and a fixed rank for each particle that decides its
  // kind: the lowest share of ranks go up.
  const order = Array.from({ length: NPART }, (_, i) => i);
  for (let i = NPART - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 0; i < NPART; i++) {
    S.x[i] = Math.random() * W;
    S.y[i] = Math.random() * H;
    S.u[order[i]] = (i + 0.5) / NPART;
  }
  params.s = S;
}

const near = (d, L) => (d > L / 2 ? d - L : d < -L / 2 ? d + L : d);

function grid(S) {
  const { x, y, head, next } = S;
  head.fill(-1);
  for (let i = 0; i < NPART; i++) {
    const c = floor(x[i] / RC) + GX * floor(y[i] / RC);
    next[i] = head[c];
    head[c] = i;
  }
}

// The noise of the cycle at clock tc.
function noise(tc) {
  if (tc < COOL) return D0;
  const u = tc - COOL;
  const k = u < H_UP ? u / H_UP : u < H_UP + H_HOLD ? 1 : 1 - (u - H_UP - H_HOLD) / H_DOWN;
  return D0 + (DHOT - D0) * cl(k, 0, 1);
}

// One step of HS seconds: pair forces through the grid, half the stencil
// per cell so each pair is visited once, then drive and noise.
function step(S) {
  const { x, y, q, fx, fy, head, next } = S;
  grid(S);
  fx.fill(0);
  fy.fill(0);
  const RC2 = RC * RC;
  for (let cy = 0; cy < GY; cy++)
    for (let cx = 0; cx < GX; cx++) {
      const c0 = cx + GX * cy;
      for (let i = head[c0]; i >= 0; i = next[i])
        for (let k = 0; k < 5; k++) {
          const ox = k === 0 ? 0 : k === 1 ? 1 : k - 3, oy = k < 2 ? 0 : 1;
          const c = ((cx + ox + GX) % GX) + GX * ((cy + oy) % GY);
          for (let j = k === 0 ? next[i] : head[c]; j >= 0; j = next[j]) {
            const dx = near(x[j] - x[i], W), dy = near(y[j] - y[i], H), r2 = dx * dx + dy * dy;
            if (r2 >= RC2 || r2 < 1e-6) continue;
            const f = fr(r2);
            fx[i] -= f * dx;
            fy[i] -= f * dy;
            fx[j] += f * dx;
            fy[j] += f * dy;
          }
        }
    }
  // Uniform kicks of the same variance as Gaussian ones, 2 D HS.
  const a = sqrt(6 * noise(S.tc) * HS), E = S.E;
  for (let i = 0; i < NPART; i++) {
    let dx = fx[i] * HS, dy = (fy[i] - q[i] * E) * HS;
    const m = dx * dx + dy * dy;
    if (m > MAXD * MAXD) {
      const s = MAXD / sqrt(m);
      dx *= s;
      dy *= s;
    }
    dx += a * (2 * Math.random() - 1);
    dy += a * (2 * Math.random() - 1);
    let xi = x[i] + dx, yi = y[i] + dy;
    xi = xi < 0 ? xi + W : xi >= W ? xi - W : xi;
    yi = yi < 0 ? yi + H : yi >= H ? yi - H : yi;
    x[i] = xi;
    y[i] = yi;
  }
}

// phi_j from the column around every particle, their mean Phi, and the
// share each one shines by.
function order(S) {
  const { x, y, q, head, next, shine } = S;
  grid(S);
  let sum = 0;
  for (let i = 0; i < NPART; i++) {
    const cx = floor(x[i] / RC), cy = floor(y[i] / RC);
    let ns = 0, no = 0;
    for (let oy = -2; oy <= 2; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const c = ((cx + ox + GX) % GX) + GX * ((cy + oy + GY) % GY);
        for (let j = head[c]; j >= 0; j = next[j]) {
          if (j === i) continue;
          if (abs(near(x[j] - x[i], W)) >= OWX || abs(near(y[j] - y[i], H)) >= OWY) continue;
          if (q[j] === q[i]) ns++;
          else no++;
        }
      }
    const n = ns + no, p = n ? ((ns - no) / n) ** 2 : 0;
    shine[i] = n ? cl((2 * ns) / n - 1, 0, 1) : 0;
    sum += p;
  }
  S.phiMean = sum / NPART;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.E = E0 * pow(3, cl(k[2] || 0, -1, 1));
  const share = cl(k[3] == null ? 0.5 : k[3], 0.5, 0.9);
  if (share !== S.share) {
    S.share = share;
    for (let i = 0; i < NPART; i++) S.q[i] = S.u[i] < share ? 1 : -1;
  }
  let run = (d * S.speed) / 2;
  if (!S.pre) {
    S.pre = true;
    run += PRE;
  }
  S.acc += run;
  S.ran = 0;
  while (S.acc >= HS) {
    step(S);
    S.acc -= HS;
    S.t += HS;
    S.ran += HS;
    S.tc += HS;
    if (S.tc >= CYCLE) S.tc -= CYCLE;
  }
  order(S);
  const e = 1 - exp(-S.ran / 0.2);
  for (let i = 0; i < NPART; i++) S.glow[i] += (S.shine[i] - S.glow[i]) * e;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { x, y, q, glow, buf } = S;
  // The trail: what was drawn fades by e every TAU seconds of the dynamics.
  const fade = exp(-S.ran / TAU);
  for (let p = 0; p < NP * 3; p++) buf[p] *= fade;
  const up = hsv(S.hue + 0.58, 0.85, 1), dn = hsv(S.hue + 0.13, 0.9, 1);
  for (let i = 0; i < NPART; i++) {
    const c = q[i] > 0 ? up : dn, lum = 0.55 + 0.45 * glow[i];
    const px = x[i], py = y[i], ix = floor(px), iy = floor(py);
    for (let yy = iy - 1; yy <= iy + 1; yy++)
      for (let xx = ix - 1; xx <= ix + 1; xx++) {
        const dx = xx + 0.5 - px, dy = yy + 0.5 - py, w = 1 - (dx * dx + dy * dy) / 2.2;
        if (w <= 0) continue;
        const o = (((yy + H) % H) * W + ((xx + W) % W)) * 3, v = w * lum;
        if (c[0] * v > buf[o]) buf[o] = c[0] * v;
        if (c[1] * v > buf[o + 1]) buf[o + 1] = c[1] * v;
        if (c[2] * v > buf[o + 2]) buf[o + 2] = c[2] * v;
      }
  }
  for (let p = 0, yy = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++, p += 3) display.setPixel(xx, yy, round(min(1, buf[p]) * 255), round(min(1, buf[p + 1]) * 255), round(min(1, buf[p + 2]) * 255));
}
