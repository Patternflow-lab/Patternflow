// ===== Patternflow pattern =====
// Title:   Riemann Problem
// Family:  physics
// Idea:    Sod's shock tube drawn as its x-t diagram down the tall panel, the closed tube across the 64 columns and time running down the rows as new rows enter at the bottom: the diaphragm stands as a white stub, bursts, and the shock in cream, the contact discontinuity in magenta and the rarefaction fan in cyan leave the burst point as rays, bounce off both closed ends and cross into a lattice over tiles shaded by density, until a new diaphragm bursts with new states every 7 to 9 seconds.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Riemann problem of gas dynamics (Bernhard Riemann, 1860) in Sod's shock tube (Gary A. Sod, 1978), solved by Godunov's finite-volume method (Sergei Godunov, 1959) with MUSCL slopes (Bram van Leer, 1979), the Hancock half-step predictor and the HLLC flux (Eleuterio Toro, Michael Spruce and William Speares, 1994), which restores the contact wave to the HLL flux (Amiram Harten, Peter Lax and Bram van Leer, 1983), with Einfeldt's wave speeds (Bernd Einfeldt, 1988); pattern round 84
// Round:   84
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ratio=10..100, Diaphragm=-0.4..0.4
//
// Knob 1: Hue. Turns the four colours round the wheel together. At 0 the shock is cream, the rarefaction cyan, the contact magenta and the gas a navy whose brightness is its density; at 0.5 the shock is pale blue, the fan red, the contact green and the gas brown.
// Knob 2: Speed. Rows a second, eight times the knob: at 2 sixteen rows enter a second, each 1/60 of the tube's time unit, so the panel holds the last 8 s and a burst comes every 7 to 9 s; 1.6 rows a second at 0.2 and 24 at 3.
// Knob 3: Ratio. The pressure on the high side over the low side, 10 to 100, with density 1 against 0.125 for the first burst. At 10 it is Sod's tube and the shock runs at Mach 1.66; past 13.7 the fan's tail leans the other way because the gas behind it goes supersonic; past 22 the shocked gas is denser than the expanded gas, so the tiles either side of the contact swap their shading; at 100 the shock is Mach 4.36. Turning it bursts a new diaphragm once the knob rests 0.3 s.
// Knob 4: Diaphragm. Where the next diaphragm stands, as its distance from the middle of the tube. At the opening 0.06 it stands at 0.56 of the tube, column 36, so Sod's shock reaches the right wall 15 rows after the burst and the head of the fan the left wall after 28; at -0.4 and 0.4 it stands 6 columns from an end. It too bursts a new diaphragm once it rests 0.3 s.
// Buttons: Any tap bursts a new diaphragm at once.

// The tube has length 1 and 128 cells, two to an LED column, closed at both
// ends by mirror cells: the wall reflects the velocity and keeps the
// density and the pressure. The gas is ideal with gamma = 1.4, and every
// row of the diagram is 1/60 of a time unit, in which sound in Sod's left
// gas (density 1, pressure 1) crosses sqrt(1.4) = 1.18 tube lengths.
//
// Godunov's method keeps cell averages of density, momentum and energy and
// changes them by the fluxes through the cell faces, each flux taken from
// the Riemann problem between the two states that meet at the face. Here
// the states are second order: van Leer's slopes in density (monotonised
// central), velocity and pressure (his harmonic limiter) put a value on
// each face, and Hancock's predictor moves both faces half a step forward
// with the primitive equations,
//
//   rho_t + u rho_x + rho u_x = 0,  u_t + u u_x + p_x / rho = 0,
//   p_t + u p_x + gamma p u_x = 0.
//
// A cell whose predicted faces would carry a density or pressure of zero
// or less falls back to its own average, and the update keeps density and
// pressure above small floors, so the scheme stays positive for any ratio
// on the knob. The flux at each face is HLLC: HLL's two outer waves, from
// Einfeldt's estimate with Roe averages, and a middle wave that carries
// the contact, so the contact stays a few cells wide instead of smearing.
//
// The diagram colours the jumps, not the values. Between neighbouring
// cells the jump splits along the three characteristic families of the
// Euler equations (Riemann's own variables, linearised):
//
//   w1 = (dln p / gamma - du / c) / 2   the wave running left, at u - c,
//   w3 = (dln p / gamma + du / c) / 2   the wave running right, at u + c,
//   w2 = dln rho - dln p / gamma        the entropy jump, carried at u.
//
// An acoustic wave squeezes the gas when the velocity falls across it
// (w1 > 0 or w3 < 0): that is a shock, drawn cream. When the velocity
// rises it is a rarefaction, drawn cyan. The entropy jump is the contact,
// drawn magenta; across a shock it is small (third order in its strength),
// so Sod's shock stays cream. The jumps are averaged over the solver's
// substeps inside a row, so a shock that moves two columns a row draws a
// continuous line. Under them the gas is navy, brighter where it is denser
// on a log scale fitted to the states of the burst.

const W = 64, H = 128;
const { floor, ceil, min, max, round, sqrt, exp, log, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const N = 128, NG = 2, NT = N + 2 * NG, DX = 1 / N;
const GAM = 1.4, G1 = GAM - 1;
const RMIN = 1e-5, PMIN = 1e-6;
const DT_ROW = 1 / 60, CFL = 0.5;
// Rows a second per unit of Speed; rows the diaphragm stands before it
// bursts; rows of flow after Sod's first burst, so the panel opens full.
const ROWS_PER_S = 8, REST = 8, FIRST = H - REST;
// Brightness scales of the three families, per column.
const K_SHOCK = 0.12, K_FAN = 0.04, K_CONTACT = 0.07;

const vl = (a, b) => (a * b <= 0 ? 0 : (2 * a * b) / (a + b));
const mc = (a, b) => (a * b <= 0 ? 0 : a > 0 ? min(2 * a, 2 * b, 0.5 * (a + b)) : max(2 * a, 2 * b, 0.5 * (a + b)));

function tube() {
  const f = () => new Float64Array(NT);
  return {
    D: f(), M: f(), E: f(), R: f(), U: f(), P: f(),
    Lr: f(), Lu: f(), Lp: f(), Qr: f(), Qu: f(), Qp: f(),
    F0: f(), F1: f(), F2: f(),
    // Per column, over the substeps of a row: compression, expansion, entropy.
    AC: new Float64Array(W), AE: new Float64Array(W), AK: new Float64Array(W),
  };
}

// Density, velocity and pressure from the conserved values, and the walls.
function prims(T) {
  const { D, M, E, R, U, P } = T;
  for (let i = NG; i < NG + N; i++) {
    let r = D[i];
    if (r < RMIN) D[i] = r = RMIN;
    const u = M[i] / r;
    let p = G1 * (E[i] - 0.5 * M[i] * u);
    if (p < PMIN) {
      p = PMIN;
      E[i] = p / G1 + 0.5 * M[i] * u;
    }
    R[i] = r;
    U[i] = u;
    P[i] = p;
  }
  for (let g = 0; g < NG; g++) {
    const a = NG - 1 - g, b = NG + g, c = NG + N + g, d = NG + N - 1 - g;
    R[a] = R[b];
    U[a] = -U[b];
    P[a] = P[b];
    R[c] = R[d];
    U[c] = -U[d];
    P[c] = P[d];
  }
}

// The HLLC flux between a left and a right state, into face i.
function hllc(T, rL, uL, pL, rR, uR, pR, i) {
  const cL = sqrt((GAM * pL) / rL), cR = sqrt((GAM * pR) / rR);
  const sl = sqrt(rL), sr = sqrt(rR);
  const EL = pL / G1 + 0.5 * rL * uL * uL, ER = pR / G1 + 0.5 * rR * uR * uR;
  const ut = (sl * uL + sr * uR) / (sl + sr);
  const Ht = ((sl * (EL + pL)) / rL + (sr * (ER + pR)) / rR) / (sl + sr);
  const ct = sqrt(max(1e-12, G1 * (Ht - 0.5 * ut * ut)));
  const SL = min(uL - cL, ut - ct), SR = max(uR + cR, ut + ct);
  const { F0, F1, F2 } = T;
  if (SL >= 0) {
    F0[i] = rL * uL;
    F1[i] = rL * uL * uL + pL;
    F2[i] = uL * (EL + pL);
  } else if (SR <= 0) {
    F0[i] = rR * uR;
    F1[i] = rR * uR * uR + pR;
    F2[i] = uR * (ER + pR);
  } else {
    // S* from the two jump conditions; the star state on the side the face
    // sits on is rho_K (S_K - u_K) / (S_K - S*) times (1, S*, E_K / rho_K +
    // (S* - u_K)(S* + p_K / (rho_K (S_K - u_K)))).
    const mL = rL * (SL - uL), mR = rR * (SR - uR);
    const Ss = (pR - pL + mL * uL - mR * uR) / (mL - mR);
    if (Ss >= 0) {
      const f = mL / (SL - Ss);
      F0[i] = rL * uL + SL * (f - rL);
      F1[i] = rL * uL * uL + pL + SL * (f * Ss - rL * uL);
      F2[i] = uL * (EL + pL) + SL * (f * (EL / rL + (Ss - uL) * (Ss + pL / mL)) - EL);
    } else {
      const f = mR / (SR - Ss);
      F0[i] = rR * uR + SR * (f - rR);
      F1[i] = rR * uR * uR + pR + SR * (f * Ss - rR * uR);
      F2[i] = uR * (ER + pR) + SR * (f * (ER / rR + (Ss - uR) * (Ss + pR / mR)) - ER);
    }
  }
}

// One MUSCL-Hancock step of the whole tube.
function step(T, dt) {
  prims(T);
  const { R, U, P, Lr, Lu, Lp, Qr, Qu, Qp, D, M, E, F0, F1, F2 } = T;
  const h = dt / (2 * DX);
  for (let i = 1; i < NT - 1; i++) {
    const r = R[i], u = U[i], p = P[i];
    const sr = mc(r - R[i - 1], R[i + 1] - r), su = vl(u - U[i - 1], U[i + 1] - u), sp = vl(p - P[i - 1], P[i + 1] - p);
    const cr = -h * (u * sr + r * su), cu = -h * (u * su + sp / r), cp = -h * (GAM * p * su + u * sp);
    const lr = r - sr / 2 + cr, qr = r + sr / 2 + cr, lp = p - sp / 2 + cp, qp = p + sp / 2 + cp;
    if (lr > 0 && qr > 0 && lp > 0 && qp > 0) {
      Lr[i] = lr;
      Qr[i] = qr;
      Lp[i] = lp;
      Qp[i] = qp;
      Lu[i] = u - su / 2 + cu;
      Qu[i] = u + su / 2 + cu;
    } else {
      Lr[i] = Qr[i] = r;
      Lu[i] = Qu[i] = u;
      Lp[i] = Qp[i] = p;
    }
  }
  for (let i = NG - 1; i < NG + N; i++) hllc(T, Qr[i], Qu[i], Qp[i], Lr[i + 1], Lu[i + 1], Lp[i + 1], i);
  const k = dt / DX;
  for (let i = NG; i < NG + N; i++) {
    D[i] -= k * (F0[i] - F0[i - 1]);
    M[i] -= k * (F1[i] - F1[i - 1]);
    E[i] -= k * (F2[i] - F2[i - 1]);
  }
}

// Splits each jump between neighbouring cells into the three families and
// adds them, weighted by wt, into the columns that hold the interface.
function schlieren(T, wt) {
  prims(T);
  const { R, U, P, AC, AE, AK } = T;
  for (let j = NG; j < NG + N - 1; j++) {
    const rb = 0.5 * (R[j] + R[j + 1]), pb = 0.5 * (P[j] + P[j + 1]);
    const cb = sqrt((GAM * pb) / rb);
    const dp = log(P[j + 1] / P[j]) / GAM, du = (U[j + 1] - U[j]) / cb, dr = log(R[j + 1] / R[j]);
    const w1 = 0.5 * (dp - du), w3 = 0.5 * (dp + du), w2 = dr - dp;
    const c = ((w1 > 0 ? w1 : 0) + (w3 < 0 ? -w3 : 0)) * wt;
    const e = ((w1 < 0 ? -w1 : 0) + (w3 > 0 ? w3 : 0)) * wt;
    const s = abs(w2) * wt;
    // Between real cells a and a + 1: inside column a / 2 when a is even,
    // on the line between two columns when it is odd.
    const a = j - NG;
    if (!(a & 1)) {
      AC[a >> 1] += c;
      AE[a >> 1] += e;
      AK[a >> 1] += s;
    } else {
      const c0 = a >> 1;
      AC[c0] += 0.5 * c;
      AE[c0] += 0.5 * e;
      AK[c0] += 0.5 * s;
      AC[c0 + 1] += 0.5 * c;
      AE[c0 + 1] += 0.5 * e;
      AK[c0 + 1] += 0.5 * s;
    }
  }
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
}

export function setup(params) {
  params.s = {
    T: tube(),
    ring: new Uint8Array(W * H * 3),
    head: 0,
    acc: 0,
    filled: false,
    // 0 while the diaphragm stands, 1 while the gas flows; rows left of it.
    phase: 0,
    left: 0,
    n: 0,
    lo: 0,
    hi: 1,
    x0: 0.5,
    hue: 0,
    speed: 2,
    ratio: 10,
    off: 0.06,
    key: "",
    pend: "",
    still: 0,
  };
}

// A new diaphragm with the given states on its two sides, both at rest.
function load(S, rl, pl, rr, pr) {
  const T = S.T, x0 = cl(0.5 + S.off, 0.05, 0.95);
  S.x0 = x0;
  for (let i = 0; i < N; i++) {
    const left = (i + 0.5) * DX < x0;
    T.D[NG + i] = left ? rl : rr;
    T.M[NG + i] = 0;
    T.E[NG + i] = (left ? pl : pr) / G1;
  }
  S.lo = log(min(rl, rr)) - 0.4;
  S.hi = log(max(rl, rr)) + 0.4;
  S.phase = 0;
  S.left = REST;
  S.key = S.ratio.toFixed(2) + "/" + S.off.toFixed(3);
}

// The first burst is Sod's (at the knob's ratio). Later ones put pressure 1
// and density 1 on a random side, and on the other side the knob's lower
// pressure with a density drawn log-uniformly from 0.1 to 1.6.
function burst(S) {
  if (S.n === 0) load(S, 1, 1, 0.125, 1 / S.ratio);
  else {
    const rho = exp(log(0.1) + Math.random() * log(16));
    if (Math.random() < 0.5) load(S, 1, 1, rho, 1 / S.ratio);
    else load(S, rho, 1 / S.ratio, 1, 1);
  }
  S.n++;
}

// Runs the tube for one row of time and writes the row into the ring.
function row(S) {
  const T = S.T, { R, U, P, AC, AE, AK } = T;
  AC.fill(0);
  AE.fill(0);
  AK.fill(0);
  prims(T);
  const standing = S.phase === 0;
  if (standing) {
    if (--S.left <= 0) {
      S.phase = 1;
      S.left = S.n === 1 ? FIRST : 104 + floor(Math.random() * 33);
    }
  } else {
    let smax = 0;
    for (let i = NG; i < NG + N; i++) smax = max(smax, abs(U[i]) + sqrt((GAM * P[i]) / R[i]));
    const n = max(1, ceil((DT_ROW * smax) / (CFL * DX)));
    for (let k = 0; k < n; k++) {
      step(T, DT_ROW / n);
      schlieren(T, 1 / n);
    }
    prims(T);
  }
  const h = S.hue, out = S.ring, base = S.head * W * 3;
  const bg = hsv(h + 0.62, 0.75, 1), cs = hsv(h + 0.13, 0.42, 1), ce = hsv(h + 0.5, 0.85, 1), ck = hsv(h + 0.85, 0.7, 1);
  const span = S.hi - S.lo, dcol = standing ? floor(S.x0 * W) : -1;
  for (let c = 0; c < W; c++) {
    const rho = 0.5 * (R[NG + 2 * c] + R[NG + 2 * c + 1]);
    const vb = 10 + 46 * cl((log(rho) - S.lo) / span, 0, 1);
    const bs = 1 - exp(-AC[c] / K_SHOCK), be = 0.8 * (1 - exp(-AE[c] / K_FAN)), bk = 1 - exp(-AK[c] / K_CONTACT);
    let r = vb * bg[0] + 255 * (bs * cs[0] + be * ce[0] + bk * ck[0]);
    let g = vb * bg[1] + 255 * (bs * cs[1] + be * ce[1] + bk * ck[1]);
    let b = vb * bg[2] + 255 * (bs * cs[2] + be * ce[2] + bk * ck[2]);
    if (c === dcol) r = g = b = 235;
    out[base + c * 3] = min(255, round(r));
    out[base + c * 3 + 1] = min(255, round(g));
    out[base + c * 3 + 2] = min(255, round(b));
  }
  if (!standing && --S.left <= 0) burst(S);
  S.head = (S.head + 1) % H;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 10, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.ratio = cl(k[2] == null ? 10 : k[2], 10, 100);
  S.off = cl(k[3] == null ? 0.06 : k[3], -0.4, 0.4);
  if (!S.filled) {
    // The panel opens on Sod's tube: the diaphragm at the top and 120 rows
    // of flow below it.
    S.filled = true;
    burst(S);
    for (let i = 0; i < H; i++) row(S);
    return;
  }
  const b = input.btnPressed;
  let now = !!(b && (b[0] || b[1] || b[2] || b[3]));
  const key = S.ratio.toFixed(2) + "/" + S.off.toFixed(3);
  if (key !== S.key) {
    if (key !== S.pend) {
      S.pend = key;
      S.still = 0;
    } else if ((S.still += d) > 0.3) now = true;
  }
  if (now) burst(S);
  S.acc += d * S.speed * ROWS_PER_S;
  for (let made = 0; S.acc >= 1 && made < 4; made++) {
    S.acc -= 1;
    row(S);
  }
  if (S.acc > 1) S.acc = 1;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.filled) return;
  const ring = S.ring;
  // The oldest row at the top, the newest at the bottom.
  for (let y = 0; y < H; y++) {
    const o = ((S.head + y) % H) * W * 3;
    for (let x = 0; x < W; x++) display.setPixel(x, y, ring[o + x * 3], ring[o + x * 3 + 1], ring[o + x * 3 + 2]);
  }
}
