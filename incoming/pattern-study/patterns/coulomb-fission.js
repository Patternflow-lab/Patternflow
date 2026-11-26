// ===== Patternflow pattern =====
// Title:   Coulomb Fission
// Family:  electrospray
// Idea:    A liquid held at high voltage pulls itself into a bright cone at the top centre and a thin jet that breaks into charged droplets, which repel each other into a widening fan, shrink as they dry until their charge is too much for them, and burst in flashes into spray of tiny violet progeny that dry and burst again until only cool ion sparks are left, falling to the bottom edge.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the electrospray plume, whose cone Geoffrey Ingram Taylor worked out as a balance of surface tension and electric pull (1964, from memory), the limit of charge a drop can hold before it bursts (Lord Rayleigh, 1882, from memory), the bursts themselves seen as a fine jet of progeny carrying a few percent of the mass and about 15 percent of the charge (Gomez and Tang, 1994, from memory), and the cascade that ends in free ions, the ion source of electrospray mass spectrometry (Malcolm Dole, 1968, and John Fenn, Nobel Prize 2002, both from memory), the ion evaporation that takes over from bursts in the smallest drops (Iribarne and Thomson, 1976, from memory); original code, pattern round 261
// Round:   261
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Voltage=1..3.4, Flow=-1..1, Drying=-1..1
//
// Knob 1: Hue. Added to the hue of every droplet, ring, spark and the cone, once round the wheel over the knob's travel; the haze behind only swings between teal-blue and magenta (0.14 of the wheel either way) so that it never goes brown. At 0 the young drops are pale ice-cyan, the middle ones electric blue, the small progeny violet, the flashes near white with a touch of magenta and the sparks pale cyan; at 0.25 the drops are pink and violet on magenta, at 0.5 gold and peach on indigo, at 0.75 green and teal.
// Knob 2: Voltage. 1 to 3.4 kV, opening at 2. It sets the pull along the axis (a drop at 0.7 of its charge limit drifts at 9 LEDs a second well below the cone at 2, at 0.73 of that at 1 and 1.27 times that at 3.4), the push the drops give each other (0.16 times its value at 2 when the knob is at 1, 2.2 times at 3.4) and the charge a drop leaves the jet with, 0.55 of its limit at 1, 0.7 at 2, 0.91 at 3.4. The plume's 90th-percentile half angle is 18 degrees at 1, 26 at 2 (the fan reaches both side edges by row 70) and 33 at 3.4. Under 1.9 the cone pulses at 3.1 and 4.7 Hz, its height swings 1.8 LEDs and the drops leave in bunches with gaps between; from 2.45 a second jet leaves the cone 26 to 29 degrees out and from 2.85 a third, each with its own breakup point. At any setting the cone now and then (every 7 to 21 s) throws a second jet for a second or so.
// Knob 3: Flow. How much liquid the cone is fed, signed: 2 to the 1.1 power of the knob, 0.47 at -1, 1 at 0 where it opens, 2.14 at +1. Drops leave 12 times a second at the opening, 7.7 at -1 and 20 at +1, and their radius goes with the flow to the 0.3: 1.5 LEDs at -1 (a drawn radius of 2 LEDs), 1.85 at 0 (2.2) and 2.3 at +1 (2.5). So there are about 180 drops on the panel at -1, 320 at 0 and 450 at +1, and at +1 the jet is a column of fat pale beads.
// Knob 4: Drying. How fast a drop shrinks, signed: 0.055 LED a second times 2 to the 1.3 power of the knob, 0.022 at -1, 0.055 at 0 and 0.14 at +1. A drop at its charge limit loses a tenth of its radius between one burst and the next, so the bursts come about every 7 s at -1, 3 s at 0 and 1.2 s at +1: roughly 11, 60 and 160 bursts a second counting the small ones, and 5, 37 and 120 ion sparks on the panel. At -1 the plume is whole pale drops with an odd ring; at +1 the pale drops are gone by mid panel, rings crowd the middle and the lower half is violet dust and falling sparks.

// What the picture is. A side view of an electrospray plume with its axis down the middle of the panel and the counter electrode off the bottom edge. Every droplet carries a charge q and a radius R; the charge a drop of radius R
// can hold is q_R = R^1.5 in the units used here (Rayleigh: q^2 = 64 pi^2 eps0 gamma R^3 is the real law), so f = q^2 / R^3 says how close to bursting a drop is, and f = 1 is the burst.
//   emission   the jet breaks at jittering intervals (0.4 to 1.5 of the mean) 9 LEDs under the cone at 2 and the drop leaves at 0.5 to 0.85 of its limit, with a satellite drop one time in three
//   drift      the air is thick, so a drop moves at the speed its force allows, v = (q / R) E (Stokes drag, mobility q / R), and relaxes to it with a time that grows with R squared, 0.15 s for the progeny and 0.7 s for a big drop
//   force      E is the applied field, strongest at the apex, plus every other droplet's Coulomb push, softened over 1.5 LEDs. Near droplets are summed exactly, far ones as one charge per 8 LED cell, in 3D:
//              the third coordinate is never drawn except as a dimming and a few percent of size with depth, but it is why the fan is a cone and not a flat spread
//   drying     R falls at a steady rate and the charge stays, so f rises as R^-3 until it reaches 1
//   burst      at f >= 1 a flash and a ring leave the drop and 2 to 6 progeny leave with 2 percent of its mass and 15 percent of its charge, flung out at 36 to 60 LEDs a second in random directions round the axis;
//              they are small and slow in the field and dry fast, and one that gets to f = 1 bursts again, except that a drop under R = 0.7 sheds 58 percent of its charge in that burst, as ion evaporation takes over (Iribarne and Thomson, 1976,
//              from memory), so it bursts once. Below R = 0.2 a drop is an ion, a short cool streak that falls at 55 to 95 LEDs a second along the ray from the apex and lands on the bottom edge in a small glow
//   loss       what leaves the panel at the bottom or the sides is gone, and the jet refills at a steady rate, so the plume holds the same few hundred drops for as long as it runs
// The cone and the jet are light only: a trumpet fading toward the top edge, a bright apex and a thin line to the breakup point that pulses at the breakup rhythm. The mist is the fine aerosol too small to see, a coarse 16 x 32 field fed by
// every droplet and every burst and carried outward and down, and the corona is a faint set of streamers that run out from the apex, with a glow along the bottom edge where the ions land; together they keep the corners from going black.
// The pulsation of the cone has beats of 3.1, 4.7 and 0.37 Hz, the jet length, the wobble of its axis, the haze and the surges have their own periods, and the drops are drawn with random size and charge, so the plume does not come back.
// The first update runs 8 s of the physics so the plume is there on the first frame.

const W = 64, H = 128, NP = W * H;
const { sin, cos, sqrt, exp, abs, floor, max, min, PI, pow, random, atan2 } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sst = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rr = (a, b) => a + (b - a) * random();

const NMAX = 860, NION = 360, NRING = 26, NLAND = 40;
const X0 = 32;                  // the axis
const R_ION = 0.2, R_MAX = 3.2; // drawn radius runs from 0.8 LED at R_ION to 3 LEDs at R_MAX
const GCS = 8, GNX = 10, GNY = 18, GNC = GNX * GNY; // force grid: 8 LED cells from x = -8, y = 0
const RING_T = 0.34;
const MX = 16, MY = 32, HX = 32, HY = 64;          // mist grid, 4 LED cells

// ---- colour -----------------------------------------------------------------
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}
// size 0 (progeny) .. 1 (young drop) -> hue offset from the knob and saturation
const SZ_S = [0, 0.3, 0.6, 0.85, 1];
const SZ_H = [0.77, 0.7, 0.615, 0.56, 0.525];
const SZ_SAT = [0.8, 0.82, 0.8, 0.7, 0.5];
// the haze is dim, and dim red-orange-yellow reads brown, so it swings only between teal-blue and magenta as K1 turns, while the drops go all the way round
function hazeColor(k1, out) {
  hsv(0.72 + 0.14 * sin(TAU * k1), 0.72, 1, out);
}
function sizeColor(s, out) {
  let k = 0;
  while (k < 3 && s > SZ_S[k + 1]) k++;
  const u = cl((s - SZ_S[k]) / (SZ_S[k + 1] - SZ_S[k]), 0, 1);
  out[0] = SZ_H[k] + (SZ_H[k + 1] - SZ_H[k]) * u;
  out[1] = SZ_SAT[k] + (SZ_SAT[k + 1] - SZ_SAT[k]) * u;
}

// ---- profile LUT: a hot core inside a soft skirt, in u = d^2 / sigma^2 --------
const PS = 32, UMAX = 7.5, PLEN = UMAX * PS;
const PROF = new Float32Array(PLEN + 2);
for (let i = 0; i <= PLEN + 1; i++) {
  const u = i / PS, w = u < UMAX ? (1 - u / UMAX) : 0;
  PROF[i] = (0.8 * exp(-u / 2) + 0.2 * exp(-u / 6)) * w * w;
}
const TONE = new Float32Array(1025);
for (let i = 0; i <= 1024; i++) TONE[i] = 255 * (1 - exp(-i / 256 * 1.25));

function radiusOf(R) {
  return 0.9 + 2.1 * pow(cl((R - R_ION) / (R_MAX - R_ION), 0, 1), 0.75);
}

function makeState() {
  return {
    ready: false, t: 0, ks: [0, 2, 0, 0.06],
    n: 0,
    x: new Float32Array(NMAX), y: new Float32Array(NMAX), z: new Float32Array(NMAX),
    vx: new Float32Array(NMAX), vy: new Float32Array(NMAX), vz: new Float32Array(NMAX),
    R: new Float32Array(NMAX), q: new Float32Array(NMAX), gen: new Uint8Array(NMAX), flare: new Float32Array(NMAX),
    ph: new Float32Array(NMAX),
    ex: new Float32Array(NMAX), ey: new Float32Array(NMAX), ez: new Float32Array(NMAX),
    next: new Int32Array(NMAX), head: new Int32Array(GNC), cq: new Float32Array(GNC),
    cx: new Float32Array(GNC), cy: new Float32Array(GNC), cz: new Float32Array(GNC), live: new Int32Array(GNC), nlive: 0,
    ni: 0, ix: new Float32Array(NION), iy: new Float32Array(NION), ivx: new Float32Array(NION), ivy: new Float32Array(NION),
    iage: new Float32Array(NION), ilife: new Float32Array(NION), ibr: new Float32Array(NION),
    nr: 0, rx: new Float32Array(NRING), ry: new Float32Array(NRING), r0: new Float32Array(NRING), rage: new Float32Array(NRING),
    nl: 0, lx: new Float32Array(NLAND), lage: new Float32Array(NLAND), lbr: new Float32Array(NLAND),
    jt: [0.1, 0.2, 0.3], jth: [1, 1, 1], sgT: rr(3, 10), sgA: -1, sgLen: 1, sgSide: 1, jdraw: [1, 0, 0], jphase: [rr(0, TAU), rr(0, TAU), rr(0, TAU)], jy: [14, 12, 12], jx: [X0, X0, X0],
    mist: new Float32Array(MX * MY), mist2: new Float32Array(MX * MY), hz: new Float32Array(HX * HY),
    nz: new Float32Array(9 * 18 * 2), nzt: 0,
    buf: new Float32Array(NP * 3), tmp: [0, 0, 0],
    V: 2, phi: 1, ev: 1, ang: 0.35,
    pulse: 0, coneH: 5.5, coneFl: 1, flashRate: 0,
    fis: 0, fisRate: 0,
  };
}
export function setup(params) {
  params.s = makeState();
  const S = params.s;
  for (let i = 0; i < S.nz.length; i++) S.nz[i] = random();
}

function control(S, d) {
  const k = S.ks;
  S.V = k[1];
  S.phi = pow(2, 1.1 * k[2]);
  S.ev = pow(2, 1.3 * k[3]);
}

// ---- emission --------------------------------------------------------------
function addDrop(S, x, y, z, vx, vy, vz, R, q, gen) {
  if (S.n >= NMAX) return -1;
  const i = S.n++;
  S.x[i] = x; S.y[i] = y; S.z[i] = z; S.vx[i] = vx; S.vy[i] = vy; S.vz[i] = vz;
  S.R[i] = R; S.q[i] = q; S.gen[i] = gen; S.flare[i] = 0; S.ph[i] = random();
  return i;
}
function addIon(S, x, y, vx) {
  if (S.ni >= NION) return;
  const i = S.ni++;
  S.ix[i] = x; S.iy[i] = y; S.ivx[i] = vx; S.ivy[i] = rr(55, 95);
  S.iage[i] = 0; S.ilife[i] = rr(0.9, 1.8); S.ibr[i] = rr(0.45, 0.85);
}
function addRing(S, x, y, r0) {
  let i = S.nr;
  if (i >= NRING) i = (random() * NRING) | 0; else S.nr++;
  S.rx[i] = x; S.ry[i] = y; S.r0[i] = r0; S.rage[i] = 0;
}
function emit(S, k) {
  const V = S.V, phi = S.phi;
  const R0 = 1.85 * pow(phi, 0.3) * rr(0.8, 1.25);
  const f0 = cl(0.4 + 0.15 * V + rr(-0.2, 0.15), 0.3, 0.95);
  const q = sqrt(f0) * pow(R0, 1.5);
  const ang = (k === 0 ? 0 : (k === 1 ? -1 : 1) * (0.3 + 0.06 * V)) + S.ang * 0.2 * rr(-1, 1);
  const sp = rr(44, 62) * (0.75 + 0.25 * V / 2);
  const bx = S.jx[k], by = S.jy[k];
  const a3 = rr(0, TAU);
  const tr = (0.05 + 0.04 * V) * sp;
  const vx = sp * sin(ang) + tr * cos(a3) * 0.8, vz = tr * sin(a3), vy = sp * cos(ang);
  addDrop(S, bx + rr(-0.3, 0.3), by, rr(-0.5, 0.5), vx, vy, vz, R0, q, 0);
  if (random() < 0.3) {
    const Rs = R0 * rr(0.3, 0.45), fs = rr(0.3, 0.6);
    addDrop(S, bx + sin(ang) * 1.5, by + cos(ang) * 1.5, 0, vx * 1.05, vy * 1.05, 0, Rs, sqrt(fs) * pow(Rs, 1.5), 1);
  }
}

// ---- one physics step ---------------------------------------------------------
function step(S, dt) {
  S.t += dt;
  const t = S.t, V = S.V, phi = S.phi;

  // cone and jet: pulsating at low voltage, steady cone-jet in the middle, extra jets at the top
  const lowV = 1 - sst(1.0, 1.9, V);
  const pw = sin(TAU * 3.1 * t + 1.3 * sin(TAU * 0.37 * t)) * 0.5 + sin(TAU * 4.7 * t + 0.6) * 0.5;
  S.pulse = pw * lowV;
  S.coneH = 5.5 + 1.2 * S.pulse * 1.5 + 0.35 * sin(TAU * 7.3 * t) * (0.4 + 0.6 * sst(1.5, 3, V)) - 0.5 * sst(2, 3.4, V);
  const jlen = (10.5 - 1.6 * (V - 1)) * (1 + 0.14 * sin(TAU * 1.9 * t + 0.4) + 0.08 * S.pulse);
  const wob = 0.035 * sin(TAU * 0.71 * t) + 0.02 * sin(TAU * 1.13 * t + 1);
  const w2 = sst(2.45, 3.0, V), w3 = sst(2.85, 3.35, V);
  // now and then the cone throws a second jet for a second or so and the flow surges
  S.sgT -= dt;
  let env = 0;
  if (S.sgA < 0 && S.sgT <= 0) { S.sgA = 0; S.sgLen = rr(0.8, 1.7); S.sgSide = random() < 0.5 ? 1 : 2; S.sgT = rr(7, 21); }
  if (S.sgA >= 0) {
    S.sgA += dt;
    if (S.sgA > S.sgLen) S.sgA = -1; else { const e = sin(PI * S.sgA / S.sgLen); env = e * e; }
  }
  const dw = [1, w2, w3];
  dw[S.sgSide] = max(dw[S.sgSide], env * 0.9);
  S.jdraw = dw;
  const jw = [1 - 0.33 * w2 - 0.12 * w3 - 0.2 * env, max(w2 * 0.62, S.sgSide === 1 ? env * 0.5 : 0), max(w3 * 0.58, S.sgSide === 2 ? env * 0.5 : 0)];
  const jang = [wob, -(0.3 + 0.06 * V) + wob * 0.6, 0.3 + 0.06 * V + wob * 0.6];
  const ap = S.coneH;
  for (let k = 0; k < 3; k++) {
    const L = jlen * (k === 0 ? 1 : 0.82);
    S.jx[k] = X0 + sin(jang[k]) * L; S.jy[k] = ap + cos(jang[k]) * L;
    if (jw[k] < 0.02) continue;
    // droplets leave at the breakup rhythm
    const burst = 1 + (1.15 * lowV) * S.pulse * 1.6;
    const rate = 12 * pow(phi, 0.7) * jw[k] * max(0.04, burst) * (0.5 + 0.5 * (V / 2));
    S.jt[k] += rate * dt;
    let guard = 0;
    while (S.jt[k] >= S.jth[k] && guard++ < 4) {
      if (S.n < NMAX - 24) emit(S, k);
      S.jt[k] -= S.jth[k];
      S.jth[k] = rr(0.4, 1.5);
    }
  }

  // forces: charge on a coarse grid
  const n = S.n, X = S.x, Y = S.y, Z = S.z, Q = S.q, R = S.R;
  S.head.fill(-1); S.cq.fill(0); S.cx.fill(0); S.cy.fill(0); S.cz.fill(0);
  for (let i = 0; i < n; i++) {
    const cxi = cl(floor((X[i] + 8) / GCS), 0, GNX - 1), cyi = cl(floor(Y[i] / GCS), 0, GNY - 1), c = cyi * GNX + cxi;
    S.next[i] = S.head[c]; S.head[c] = i;
    const qq = Q[i];
    S.cq[c] += qq; S.cx[c] += qq * X[i]; S.cy[c] += qq * Y[i]; S.cz[c] += qq * Z[i];
  }
  let nl = 0;
  for (let c = 0; c < GNC; c++) if (S.cq[c] > 0) { S.cx[c] /= S.cq[c]; S.cy[c] /= S.cq[c]; S.cz[c] /= S.cq[c]; S.live[nl++] = c; }
  S.nlive = nl;
  const KC = 62 * (0.16 + 0.84 * (V - 1)), EPS2 = 2.25;
  const E0 = 11 * pow(V / 2, 0.45);
  for (let i = 0; i < n; i++) {
    const xi = X[i], yi = Y[i], zi = Z[i];
    const cxi = cl(floor((xi + 8) / GCS), 0, GNX - 1), cyi = cl(floor(yi / GCS), 0, GNY - 1);
    let fx = 0, fy = 0, fz = 0;
    for (let a = 0; a < nl; a++) {
      const c = S.live[a], gx = c % GNX, gy = (c / GNX) | 0;
      if (abs(gx - cxi) <= 1 && abs(gy - cyi) <= 1) {
        for (let j = S.head[c]; j >= 0; j = S.next[j]) {
          if (j === i) continue;
          const dx = xi - X[j], dy = yi - Y[j], dz = zi - Z[j];
          const r2 = dx * dx + dy * dy + dz * dz + EPS2, ir = Q[j] / (r2 * sqrt(r2));
          fx += dx * ir; fy += dy * ir; fz += dz * ir;
        }
      } else {
        const dx = xi - S.cx[c], dy = yi - S.cy[c], dz = zi - S.cz[c];
        const r2 = dx * dx + dy * dy + dz * dz + EPS2 * 4, ir = S.cq[c] / (r2 * sqrt(r2));
        fx += dx * ir; fy += dy * ir; fz += dz * ir;
      }
    }
    S.ex[i] = fx * KC; S.ey[i] = fy * KC + E0 * (0.42 + 0.95 * exp(-yi / 30) + 0.15 * yi / H); S.ez[i] = fz * KC;
  }

  // move, dry, burst
  const evR = 0.055 * S.ev;
  let w = 0;
  for (let i = 0; i < n; i++) {
    const Ri = R[i], qi = Q[i];
    const mob = qi / Ri;
    const tau = cl(0.1 * (Ri / 0.5) * (Ri / 0.5), 0.15, 0.7);
    const a = exp(-dt / tau);
    const tx = mob * S.ex[i], ty = mob * S.ey[i], tz = mob * S.ez[i];
    S.vx[i] = tx + (S.vx[i] - tx) * a; S.vy[i] = ty + (S.vy[i] - ty) * a; S.vz[i] = tz + (S.vz[i] - tz) * a;
    const nx = X[i] + S.vx[i] * dt, ny = Y[i] + S.vy[i] * dt, nz = Z[i] + S.vz[i] * dt;
    let nR = Ri - evR * pow(Ri / 1.5, 0.25) * dt;
    S.flare[i] *= exp(-dt / 0.3);
    // leave the panel
    if (ny > H + 4 || nx < -7 || nx > W + 7 || ny < -2) {
      continue;
    }
    if (nR < R_ION) {
      // dried to nothing: an ion
      if (random() < 0.6) addIon(S, nx, ny, 0);
      continue;
    }
    // burst
    const f = qi * qi / (nR * nR * nR);
    if (f >= 1) {
      const nprog = 2 + ((random() * (1 + 4 * sst(0.6, 2.4, nR))) | 0);
      const mf = rr(0.017, 0.024), cf = rr(0.13, 0.17);
      let sw = 0, sc = 0;
      const wts = [], cws = [];
      for (let p = 0; p < nprog; p++) { const ww = rr(0.5, 1.5); wts.push(ww); sw += ww; cws.push(pow(ww, 0.7)); sc += cws[p]; }
      for (let p = 0; p < nprog; p++) {
        const Rp = nR * pow(mf * wts[p] / sw, 1 / 3);
        let qp = qi * cf * cws[p] / sc;
        const ang = rr(0, TAU), up = rr(-0.5, 0.5), spd = rr(36, 60);
        if (Rp < R_ION) { if (random() < 0.8) addIon(S, nx, ny, 0); continue; }
        if (qp * qp > 0.9 * Rp * Rp * Rp) qp = sqrt(0.9) * pow(Rp, 1.5);
        const j = addDrop(S, nx + cos(ang) * 0.8, ny + up, nz + sin(ang) * 0.8, S.vx[i] + cos(ang) * spd, S.vy[i] + up * spd * 0.6, S.vz[i] + sin(ang) * spd, Rp, qp, 1 + min(2, S.gen[i]));
        if (j >= 0) S.flare[j] = 1;
      }
      nR *= pow(1 - mf, 1 / 3);
      S.q[i] = qi * (nR < 0.7 ? 0.42 : 1 - cf);
      if (nR > 1.2) addRing(S, nx, ny, radiusOf(nR));
      S.mist[cl(floor(ny / 4), 0, MY - 1) * MX + cl(floor(nx / 4), 0, MX - 1)] += 0.5;
      S.flare[i] = 1;
      S.fis++;
    }
    X[w] = nx; Y[w] = ny; Z[w] = nz; S.vx[w] = S.vx[i]; S.vy[w] = S.vy[i]; S.vz[w] = S.vz[i];
    R[w] = nR; Q[w] = S.q[i]; S.gen[w] = S.gen[i]; S.flare[w] = S.flare[i]; S.ph[w] = S.ph[i];
    w++;
  }
  // the new progeny were appended past n: keep them
  for (let i = n; i < S.n; i++) {
    X[w] = X[i]; Y[w] = Y[i]; Z[w] = Z[i]; S.vx[w] = S.vx[i]; S.vy[w] = S.vy[i]; S.vz[w] = S.vz[i];
    R[w] = R[i]; Q[w] = Q[i]; S.gen[w] = S.gen[i]; S.flare[w] = S.flare[i]; S.ph[w] = S.ph[i];
    w++;
  }
  S.n = w;

  // ions
  let wi = 0;
  for (let i = 0; i < S.ni; i++) {
    S.iage[i] += dt;
    const ny = S.iy[i] + S.ivy[i] * dt, nx = S.ix[i] + S.ivx[i] * dt;
    if (ny >= H - 0.5) {
      if (S.nl < NLAND && random() < 0.8) { const l = S.nl++; S.lx[l] = cl(nx, 1, W - 1); S.lage[l] = 0; S.lbr[l] = S.ibr[i]; }
      continue;
    }
    if (S.iage[i] > S.ilife[i] || nx < -4 || nx > W + 4) continue;
    S.ix[wi] = nx; S.iy[wi] = ny; S.ivy[wi] = S.ivy[i] + 90 * dt; S.ivx[wi] = S.ivy[wi] * (nx - X0) / (ny + 14) * 0.9;
    S.iage[wi] = S.iage[i]; S.ilife[wi] = S.ilife[i]; S.ibr[wi] = S.ibr[i];
    wi++;
  }
  S.ni = wi;
  let wr = 0;
  for (let i = 0; i < S.nr; i++) {
    S.rage[i] += dt;
    if (S.rage[i] > RING_T) continue;
    S.rx[wr] = S.rx[i]; S.ry[wr] = S.ry[i]; S.r0[wr] = S.r0[i]; S.rage[wr] = S.rage[i]; wr++;
  }
  S.nr = wr;
  let wl = 0;
  for (let i = 0; i < S.nl; i++) {
    S.lage[i] += dt;
    if (S.lage[i] > 0.4) continue;
    S.lx[wl] = S.lx[i]; S.lage[wl] = S.lage[i]; S.lbr[wl] = S.lbr[i]; wl++;
  }
  S.nl = wl;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.05);
  if (!S.ready) {
    S.ready = true;
    S.ks = [kn[0], kn[1], kn[2], kn[3]];
    control(S, d);
    for (let i = 0; i < 200; i++) step(S, 1 / 25);
  } else {
    const a = 1 - exp(-d / 0.3);
    for (let i = 0; i < 4; i++) S.ks[i] += (kn[i] - S.ks[i]) * a;
    S.ks[0] = kn[0];
    control(S, d);
    step(S, d);
  }
  S.nzt += d;
  // mist: a coarse field fed by every droplet, bursts and ions, spread outward and down
  const m = S.mist, m2 = S.mist2;
  m2.fill(0);
  const dec = exp(-d / 0.9);
  for (let j = 0; j < MY; j++) {
    for (let i = 0; i < MX; i++) {
      const v = m[j * MX + i];
      if (v < 1e-4) continue;
      const cx = i - 7.5, sx = cx * 0.05 * d * 30;
      const tx = i + sx, ty = j + 0.9 * d * 4;
      const tx0 = floor(tx), ty0 = floor(ty), fx = tx - tx0, fy = ty - ty0;
      const put = (xx, yy, wgt) => { if (xx >= 0 && xx < MX && yy >= 0 && yy < MY) m2[yy * MX + xx] += v * wgt * dec; };
      put(tx0, ty0, (1 - fx) * (1 - fy)); put(tx0 + 1, ty0, fx * (1 - fy)); put(tx0, ty0 + 1, (1 - fx) * fy); put(tx0 + 1, ty0 + 1, fx * fy);
    }
  }
  S.mist = m2; S.mist2 = m;
  const mm = S.mist;
  for (let i = 0; i < S.n; i++) {
    const gx = cl(floor(S.x[i] / 4), 0, MX - 1), gy = cl(floor(S.y[i] / 4), 0, MY - 1);
    mm[gy * MX + gx] += S.q[i] * 0.006 * d * 30;
  }
}

// ---- drawing -----------------------------------------------------------------
function addBlob(buf, px, py, sig, r, g, b, kind) {
  const ext = 2.75 * sig;
  const x0 = max(0, floor(px - ext)), x1 = min(W - 1, floor(px + ext)), y0 = max(0, floor(py - ext)), y1 = min(H - 1, floor(py + ext));
  const is2 = 1 / (sig * sig) * PS;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - py, dy2 = dy * dy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - px, k = ((dx * dx + dy2) * is2) | 0;
      if (k >= PLEN) continue;
      const v = PROF[k], o = (y * W + x) * 3;
      buf[o] += r * v; buf[o + 1] += g * v; buf[o + 2] += b * v;
    }
  }
}
function nzAt(S, u, v, t) {
  // two slow value-noise layers on a small lattice, bilinear
  const NX = 9, NY = 18;
  const sample = (uu, vv, off) => {
    const x = ((uu % NX) + NX) % NX, y = ((vv % NY) + NY) % NY;
    const x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
    const x1 = (x0 + 1) % NX, y1 = (y0 + 1) % NY;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = S.nz[off + y0 * NX + x0], b = S.nz[off + y0 * NX + x1], c = S.nz[off + y1 * NX + x0], d2 = S.nz[off + y1 * NX + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d2) * sx * sy;
  };
  return 0.6 * sample(u, v - t * 0.9, 0) + 0.4 * sample(u * 1.7 + 3, v * 1.7 - t * 1.3, NX * NY);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const buf = S.buf, tmp = S.tmp;
  buf.fill(0);
  const H0 = S.ks[0] + 0.0;
  const hue = (h) => h + H0;
  const t = S.t, V = S.ks[1];

  // mist, corona, halo and the glow along the bottom edge: one scalar field on a 32 x 64 grid, 2 LEDs a cell, spread over the panel by bilinear lookup
  {
    const flick = 0.5 + 0.5 * sin(TAU * 0.23 * t + 2 * sin(TAU * 0.071 * t)) * sin(TAU * 0.37 * t + 1);
    hazeColor(H0, tmp);
    const mr = tmp[0], mg = tmp[1], mb = tmp[2];
    const m = S.mist, hz = S.hz;
    for (let j = 0; j < HY; j++) {
      const y = 2 * j + 1, gy = cl((y + 0.5) / 4 - 0.5, 0, MY - 1.001), j0 = floor(gy), fy = gy - j0;
      const dyy = y - 3.5, halo = 0.07 * sst(6, 36, y), bot = 0.2 * exp(-(H - 0.5 - y) / 15);
      for (let i = 0; i < HX; i++) {
        const x = 2 * i + 1, gx = cl((x + 0.5) / 4 - 0.5, 0, MX - 1.001), i0 = floor(gx), fx = gx - i0;
        const o = j0 * MX + i0;
        const mv = m[o] * (1 - fx) * (1 - fy) + m[o + 1] * fx * (1 - fy) + m[o + MX] * (1 - fx) * fy + m[o + MX + 1] * fx * fy;
        const dxx = x + 0.5 - X0, dist = sqrt(dxx * dxx + dyy * dyy);
        const cor = 0.58 / (1 + (dist / 20) * (dist / 20)) * (0.45 + 0.95 * nzAt(S, atan2(dxx, dyy + 3) * 2.3 + 4.5, dist * 0.085, t * 1.1)) * (0.88 + 0.12 * flick);
        const n2 = nzAt(S, x / 9 + 1, y / 11, t * 0.35);
        hz[j * HX + i] = mv + cor + (halo + bot * 0.8) * (0.45 + 1.0 * n2);
      }
    }
    for (let y = 0; y < H; y++) {
      const gy = cl((y + 0.5) / 2 - 0.5, 0, HY - 1.001), j0 = floor(gy), fy = gy - j0;
      for (let x = 0; x < W; x++) {
        const gx = cl((x + 0.5) / 2 - 0.5, 0, HX - 1.001), i0 = floor(gx), fx = gx - i0;
        const o = j0 * HX + i0;
        const v = hz[o] * (1 - fx) * (1 - fy) + hz[o + 1] * fx * (1 - fy) + hz[o + HX] * (1 - fx) * fy + hz[o + HX + 1] * fx * fy;
        const o3 = (y * W + x) * 3;
        buf[o3] = mr * v; buf[o3 + 1] = mg * v; buf[o3 + 2] = mb * v;
      }
    }
  }

  // droplets, small to large so the large ones lie on top in the glow
  const c0 = tmp;
  for (let i = 0; i < S.n; i++) {
    const R = S.R[i], q = S.q[i];
    const zq = cl(0.5 - S.z[i] / 60, 0.1, 1), rho = radiusOf(R) * (0.9 + 0.2 * zq), sigma = 0.48 * rho + 0.34;
    const s = cl((R - R_ION) / (2.1 - R_ION), 0, 1);
    sizeColor(s, c0);
    const f = q * q / (R * R * R);
    const hot = sst(0.84, 1, f);
    let h = hue(c0[0]) - 0.1 * hot, sat = c0[1] * (1 - 0.5 * hot);
    const fl = S.flare[i];
    sat *= 1 - 0.75 * fl;
    if (fl > 0.02) h += (0.86 - c0[0]) * fl * 0.5;
    const zf = cl(0.5 - S.z[i] / 60, 0.1, 1), depth = 0.55 + 0.5 * zf;
    const b = (0.52 + 0.8 * s + 0.5 * hot + 1.0 * fl) * depth * (0.72 + 0.56 * S.ph[i]);
    hsv(h, sat, b, tmp);
    const r = tmp[0], g = tmp[1], bb = tmp[2];
    addBlob(buf, S.x[i], S.y[i], sigma, r, g, bb);
    const spd = sqrt(S.vx[i] * S.vx[i] + S.vy[i] * S.vy[i]);
    const nt = min(4, (spd / 9) | 0);
    for (let k = 1; k <= nt; k++) {
      const a = 0.5 * pow(0.7, k - 1) * sst(0, 2, nt - k + 1), tk = 0.04 * k;
      addBlob(buf, S.x[i] - S.vx[i] * tk, S.y[i] - S.vy[i] * tk, sigma * (1 - 0.04 * k), r * a, g * a, bb * a);
    }
  }

  // bursts: a flash and a ring that runs out from the drop
  hsv(hue(0.87), 0.4, 1, tmp);
  const fr = tmp[0], fg = tmp[1], fb = tmp[2];
  hsv(hue(0.84), 0.14, 1, tmp);
  const wr = tmp[0], wg = tmp[1], wb = tmp[2];
  for (let i = 0; i < S.nr; i++) {
    const age = S.rage[i], u = age / RING_T, r0 = S.r0[i], rad = r0 + 0.4 + 5.5 * (1 - (1 - u) * (1 - u));
    const fade = pow(1 - u, 1.4) * 1.05;
    const px = S.rx[i], py = S.ry[i], ext = rad + 2.6;
    const x0 = max(0, floor(px - ext)), x1 = min(W - 1, floor(px + ext)), y0 = max(0, floor(py - ext)), y1 = min(H - 1, floor(py + ext));
    const fs2 = 1 / (0.3 * r0 * r0 + 1.2);
    const fl = u < 0.3 ? (1 - u / 0.3) * (1 - u / 0.3) * 1.3 : 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - px, dy = y + 0.5 - py, d2 = dx * dx + dy * dy, d = sqrt(d2) - rad;
        const v = exp(-d * d / 1.1) * fade, v2 = fl * exp(-d2 * fs2);
        const o = (y * W + x) * 3;
        buf[o] += fr * v + wr * v2; buf[o + 1] += fg * v + wg * v2; buf[o + 2] += fb * v + wb * v2;
      }
    }
  }

  // ions: short cool streaks
  hsv(hue(0.54), 0.5, 1, tmp);
  for (let i = 0; i < S.ni; i++) {
    const age = S.iage[i], fade = sst(0, 0.12, age) * (1 - sst(0.6, 1, age / S.ilife[i]));
    const len = 0.045 * S.ivy[i], px = S.ix[i], py = S.iy[i];
    const lx = S.ivx[i] / S.ivy[i];
    const x0 = max(0, floor(px - 3)), x1 = min(W - 1, floor(px + 3)), y0 = max(0, floor(py - len - 2)), y1 = min(H - 1, floor(py + 2));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - py;
      const tt = cl(-dy / len, 0, 1);
      const cxl = px - lx * len * tt;
      const along = dy > 0 ? dy : dy < -len ? -dy - len : 0;
      const wy = 1 - 0.8 * tt;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cxl;
        const v = exp(-(dx * dx) / 1.1 - along * along / 1.0) * wy * fade * S.ibr[i];
        const o = (y * W + x) * 3;
        buf[o] += tmp[0] * v; buf[o + 1] += tmp[1] * v; buf[o + 2] += tmp[2] * v;
      }
    }
  }
  // landings
  for (let i = 0; i < S.nl; i++) {
    const u = S.lage[i] / 0.4, fade = (1 - u) * (1 - u) * S.lbr[i];
    addBlob(buf, S.lx[i], H - 0.5, 1.2 + 1.2 * u, tmp[0] * fade * 0.8, tmp[1] * fade * 0.8, tmp[2] * fade * 0.8);
  }

  // the cone and the jet
  {
    const ap = S.coneH, flick = 0.85 + 0.15 * sin(TAU * 11 * t) * sin(TAU * 3.3 * t + 1);
    hsv(hue(0.5), 0.3, 1, tmp);
    const cr = tmp[0], cg = tmp[1], cb = tmp[2];
    for (let y = 0; y < ap + 3; y++) {
      const dd = max(0, ap - y - 0.5), hw = 0.55 + 1.16 * dd * (0.5 + 0.5 * dd / ap);
      const g = (0.16 + 0.84 * pow(cl((y + 0.5) / ap, 0, 1), 2.2)) * flick;
      for (let x = max(0, floor(X0 - hw - 3)); x < min(W, X0 + hw + 3); x++) {
        const dx = abs(x + 0.5 - X0);
        const e = 1 - sst(hw - 0.5, hw + 1.1, dx);
        const v = e * g * 0.85 * (y + 0.5 < ap + 1.5 ? 1 : exp(-(y + 0.5 - ap - 1.5) * 1.1));
        const o = (y * W + x) * 3;
        buf[o] += cr * v; buf[o + 1] += cg * v; buf[o + 2] += cb * v;
      }
    }
    addBlob(buf, X0, ap + 0.2, 1.7, cr * 1.0 * flick, cg * 1.0 * flick, cb * 1.0 * flick);
    // jets
    const wj = S.jdraw;
    for (let k = 0; k < 3; k++) {
      if (wj[k] < 0.03) continue;
      const bx = S.jx[k], by = S.jy[k];
      const L = sqrt((bx - X0) * (bx - X0) + (by - ap) * (by - ap));
      const nstep = max(2, (L * 1.5) | 0);
      for (let s = 0; s <= nstep; s++) {
        const u = s / nstep, px = X0 + (bx - X0) * u, py = ap + (by - ap) * u;
        const bead = 0.75 + 0.25 * sin(TAU * (u * 3.5 - t * 7 + k));
        const gg = (1 - 0.35 * u) * bead * wj[k] * 0.55;
        addBlob(buf, px, py, 0.8, cr * gg, cg * gg, cb * gg);
      }
      addBlob(buf, bx, by, 1.0, cr * 0.5 * wj[k], cg * 0.5 * wj[k], cb * 0.5 * wj[k]);
    }
  }

  for (let p = 0; p < NP; p++) {
    const o = p * 3, x = p % W, y = (p / W) | 0;
    display.setPixel(x, y,
      TONE[min(1024, (buf[o] * 256) | 0)] | 0, TONE[min(1024, (buf[o + 1] * 256) | 0)] | 0, TONE[min(1024, (buf[o + 2] * 256) | 0)] | 0);
  }
}
