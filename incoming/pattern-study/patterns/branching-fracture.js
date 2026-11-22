// ===== Patternflow pattern =====
// Title:   Branching Fracture
// Family:  fracture
// Idea:    A sheet of 2368 masses joined by 6903 springs is pulled apart until it fails: a crack starts from a flaw at an edge or inside, runs the height of the panel in one to three seconds with elastic waves ringing out from its tip, forks when the load is high, and the sheet then rests, mends along its scars after a random delay and is loaded again, the strain energy glowing from deep teal through indigo, violet and magenta to gold and white at the crack tips.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Michael Marder and Steven Gross, "Origin of crack tip instabilities", J. Mech. Phys. Solids 43 (1995), who followed a crack through a triangular lattice of springs that break at a critical stretch; Jay Fineberg, Steven Gross, Michael Marder and Harry Swinney, "Instability in dynamic fracture", Phys. Rev. Lett. 67 (1991); A. A. Griffith's energy balance for a growing crack (1921); the lattice crack models of Leonid Slepyan (1981) and Marder (1993); pattern round 217
// Round:   219
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Load=0..3, Tough=0..1, Heal=-1..1
//
// Knob 1: Hue. Slides the colours along three ramps: at 0, where it opens, deep teal glass whose strain runs indigo, violet, magenta, rose, gold and white; at 0.5 ice blue to azure to cream; at 1 jade to green to a lime gold. The ramp also leans up to 0.4 of the way towards the next one, a new lean after every crack, and glides there in about 12 s.
// Knob 2: Load. How far the sheet is pulled when the flaw lets go, as a multiple of Griffith's load: 1.85 at 0, 2.85 at 2, where it opens, 3.1 at 2.5 and 3.65 at 3, times a drift of 0.75 to 1.25 (three sines of 61.7, 37.3 and 23.9 s) and 0.85 to 1.15 for each crack. Near 1.85 a single crack creeps through in three to six seconds or stops half way; at 3 it forks again and again and the sheet breaks into islands.
// Knob 3: Tough. The stretch a spring takes before it breaks, 0.07 of its length at 0, where it opens, 0.10 at 0.25, 0.145 at 0.5 and 0.30 at 1. A brittle sheet cracks with a thin gap and little stored light; a tough one is stretched four times as far, glows magenta and rose before it goes, and every crack gapes.
// Knob 4: Heal. How long a scar lasts after the sheet has come to rest: a random 4 to 15 s times 0.91 at the opening (0.06), times 3 at -1 (12 to 45 s), times 0.37 at 0.5 and times 0.015 at 1, where the scars mend at once. The sheet then unloads over 2.2 s and mends along the scar from the oldest bond in 3.2 s, both quicker above 0.

// What the picture is. The sheet is 37 columns of 64 masses, every other column dropped half a spacing, so each mass has six springs of one
// rest length (2 LEDs) and the columns run up the panel. The left and right columns are held at the strain e and slide freely up and down.
// A spring pulls with k (r - r0) and goes for good when it is stretched past eps times its own disorder (0.86 to 1.14), and the energy it held
// is left to ring out as waves. The masses move by velocity Verlet (the two half kicks of a step merged), 10 steps of 0.25 a frame where the
// stability limit is 0.82, with a damping of 0.004 while a crack runs, so its waves cross the sheet and come back off the edges, and 0.05
// after. Velocities are clamped, and a sheet that goes non-finite is rebuilt without a sound. Griffith's balance for a long crack in a strip
// 31 spacings wide puts the strain at which it just runs at 1 / 4.24 of the breaking stretch, and the Load knob is a multiple of that
// (checked with notches of every length at 1.2 to 4 times it): a crack runs from about 1.6 with the longest flaw and 2.8 with the
// shortest, forks from about 2, and from about 3.5 the sheet breaks in many places by itself (checked on a sheet with no flaw).
// Each crack is its own. The load is spread up the sheet by a profile that changes every cycle, 1 at one or two places and 0.5 to 0.9
// elsewhere. A flaw is cut on a column gap where the strain is strongest, one time in four inside and otherwise from the top or bottom
// edge, and grows a bond or two at a time to the length that is unstable at the load asked for. The stiffness varies by about 30 percent
// over patches 25 to 70 LEDs across and is drawn again every cycle, and the grips knock the sheet now and then so that it rings.
// When the crack has been quiet for 1.3 s the scar waits out its delay with the grips still pulling, so the gap stays open. Then the grips
// ease back over 2.2 s, the broken bonds are re-made oldest first, each with the rest length it has so that no impulse follows, the rest
// lengths settle to 1, every mass is put on its lattice place, and the sheet is loaded again from nothing over 10 to 40 s.
// How it is drawn. Each mass is spread onto the four LEDs round it and blurred once. The colour is the mean and the largest stretch of the
// springs at the mass, smoothed once along the bonds, plus the heat of bonds that have just broken (white, 0.2 s) or mended (a bead that
// runs along the scar) and of an old scar. Broken bonds are dark marks at their midpoints, blurred into a band with a thin lit edge; where
// the masses have drawn apart there is nothing. Five slow waves of light pass through the glass, and a faint fringe, as in loaded glass seen
// through polarisers, runs along lines of equal strain.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, pow, abs, min, max, PI, round } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the lattice: columns of masses, 64 to a column, every other column dropped half a spacing, so each mass has six
// neighbours at one rest length. Columns run up the panel, and the loaded cracks run along them.
const NC = 37, NR = 64, N = NC * NR;
const COLW = 0.8660254; // column spacing, in rest lengths
const W0 = (NC - 1) * COLW; // width between the grips
const XOFF = 0.41, YOFF = 0.25; // a rest length is 2 LEDs; these put the sheet in the middle of the panel
const XC = XOFF + W0 / 2, YC = YOFF + (NR - 0.5) / 2;

const BI = [], BJ = [];
for (let c = 0; c < NC; c++)
  for (let r = 0; r < NR; r++) {
    const i = c * NR + r;
    if (r + 1 < NR) (BI.push(i), BJ.push(i + 1));
    if (c + 1 < NC) {
      const n = (c + 1) * NR;
      if ((c & 1) === 0) {
        BI.push(i), BJ.push(n + r);
        if (r > 0) (BI.push(i), BJ.push(n + r - 1));
      } else {
        BI.push(i), BJ.push(n + r);
        if (r + 1 < NR) (BI.push(i), BJ.push(n + r + 1));
      }
    }
  }
const NB = BI.length;
const bi = Int32Array.from(BI), bj = Int32Array.from(BJ);
const X0 = new Float64Array(N), Y0 = new Float64Array(N);
const GRIP = new Int8Array(N); // -1 on the left column, +1 on the right: held in x, free to slide in y
const GRIPS = [];
for (let c = 0; c < NC; c++)
  for (let r = 0; r < NR; r++) {
    const i = c * NR + r;
    X0[i] = XOFF + c * COLW;
    Y0[i] = YOFF + r + ((c & 1) ? 0.5 : 0);
    if (c === 0 || c === NC - 1) (GRIP[i] = c === 0 ? -1 : 1), GRIPS.push(i);
  }

// ---- time. 10 steps of 0.25 of the spring's own time a frame: the panel's second is 75 of them. Stable far past this.
const SUB = 10, DT = 0.25;
const VMAX = 1.4; // no mass moves faster than the sheet's own sound
const NU = 1 / 3; // Poisson's ratio of a triangular lattice of springs
const EG = 1 / 4.24; // the strain at which a long crack in this strip just runs, per unit of breaking stretch

const LOAD = 0, CRACK = 1, SCAR = 2, UNLOAD = 3, HEAL = 4, SETTLE = 5;

function makeSheet() {
  return {
    x: new Float64Array(N), y: new Float64Array(N), vx: new Float64Array(N), vy: new Float64Array(N),
    fx: new Float64Array(N), fy: new Float64Array(N),
    h1: new Float32Array(N), h2: new Float32Array(N),
    alive: new Uint8Array(NB), kb: new Float32Array(NB).fill(1), hr: new Float64Array(NB), dis: new Float32Array(NB), tb: new Float64Array(NB), dk: new Float32Array(NB),
    fN: new Float32Array(N), fM: new Float32Array(N), fA: new Float32Array(N), fC: new Float32Array(N), nd: new Float32Array(N),
    E: new Float32Array(W * H), Wt: new Float32Array(W * H), DM: new Float32Array(W * H), D2: new Float32Array(W * H), T: new Float32Array(W * H),
    lut: new Float32Array(9 * 256 * 3), cS: new Float32Array(5 * W), cC: new Float32Array(5 * W), rS: new Float32Array(5 * H), rC: new Float32Array(5 * H),
    t: 0, tau: 0, acc: 0, ph: LOAD, lt: 0, LT: 14, scT: 0, ct: 0, hp: 0, hlist: null, hn: 0,
    nbk: 0, nbk0: 0, tLast: -9, eps: 0.07, epsT: 0.07, e: 0, eHold: 0, wA: 0, cyc: 1, D0: 8,
    mmin: 1.85, prof: new Float64Array(NR).fill(1), hw: 0, hwT: 0, tap: 0, tapT: 3, tapV: 0, tapK: 1, tapP: 0, gam: 0.01, fade: 0.9, relax: false, ph0: [], resets: 0, safe: false, anch: 0,
  };
}

// Each cycle the sheet is a different piece of material: the breaking stretch of every bond varies by 14 percent, and
// the stiffness varies by about 30 percent over patches 25 to 70 LEDs across, so the softer patches stretch more.
function scramble(S) {
  const { dis, kb } = S;
  const R = Math.random;
  for (let b = 0; b < NB; b++) dis[b] = 0.86 + 0.28 * R();
  const kx = [], ky = [], ph = [];
  for (let k = 0; k < 4; k++) {
    const lam = 12 + 23 * R(), a = TAU * R();
    kx.push((TAU / lam) * cos(a)), ky.push((TAU / lam) * sin(a)), ph.push(TAU * R());
  }
  for (let b = 0; b < NB; b++) {
    const xm = (X0[bi[b]] + X0[bj[b]]) / 2, ym = (Y0[bi[b]] + Y0[bj[b]]) / 2;
    let v = 0;
    for (let k = 0; k < 4; k++) v += cos(kx[k] * xm + ky[k] * ym + ph[k]);
    kb[b] = 1 + 0.11 * v + 0.1 * (R() - 0.5);
  }
}

function resetSheet(S, e) {
  const { x, y, vx, vy, fx, fy, h1, h2, alive, hr, tb, dk } = S;
  const ge = e || 0;
  makeProfile(S);
  for (let i = 0; i < N; i++) {
    const g = ge * S.prof[i % NR];
    x[i] = X0[i] + (X0[i] - XC) * g;
    y[i] = YC + (Y0[i] - YC) * (1 - NU * g);
    vx[i] = vy[i] = fx[i] = fy[i] = h1[i] = h2[i] = 0;
  }
  for (let b = 0; b < NB; b++) (alive[b] = 1), (hr[b] = 1), (tb[b] = 0), (dk[b] = 0);
  scramble(S);
  S.ph = LOAD;
  S.lt = 0;
  S.nbk0 = S.nbk;
  S.relax = false;
}

function breakBond(S, b) {
  S.alive[b] = 0;
  S.tb[b] = S.t;
  S.dk[b] = 1;
  const i = bi[b], j = bj[b];
  S.h1[i] = min(S.h1[i] + 1, 2);
  S.h1[j] = min(S.h1[j] + 1, 2);
  S.h2[i] = min(S.h2[i] + 0.6, 1.2);
  S.h2[j] = min(S.h2[j] + 0.6, 1.2);
  S.nbk++;
  S.tLast = S.t;
}

// One force pass: every live bond pulls with the stretch past its rest length, and a bond stretched past its
// breaking stretch (with its own disorder) goes there and then.
function forces(S) {
  const { x, y, fx, fy, alive, hr, dis, kb } = S;
  const eps = S.safe ? 1e9 : S.eps;
  fx.fill(0);
  fy.fill(0);
  for (let b = 0; b < NB; b++) {
    if (alive[b] === 0) continue;
    const i = bi[b], j = bj[b];
    const dx = x[j] - x[i], dy = y[j] - y[i];
    let r = sqrt(dx * dx + dy * dy);
    if (r < 0.03) r = 0.03;
    const h = hr[b];
    const s = r - h;
    if (s > eps * dis[b] * h) {
      breakBond(S, b);
      continue;
    }
    const f = (kb[b] * (s < -1.5 ? -1.5 : s > 1.5 ? 1.5 : s)) / r;
    const ax = f * dx, ay = f * dy;
    fx[i] += ax;
    fy[i] += ay;
    fx[j] -= ax;
    fy[j] -= ay;
  }
}

function integrate(S, n) {
  const { x, y, vx, vy, fx, fy } = S;
  const damp = 1 - S.gam * DT;
  const ka = S.anch, ge = S.e;
  for (let k = 0; k < n; k++) {
    forces(S);
    // while the sheet unloads and mends, a weak spring draws every mass to its place, so no island is left behind
    if (ka > 0)
      for (let i = 0; i < N; i++) {
        const g = ge * S.prof[i % NR];
        fx[i] -= ka * (x[i] - (X0[i] + (X0[i] - XC) * g));
        fy[i] -= ka * (y[i] - (YC + (Y0[i] - YC) * (1 - NU * g)));
      }
    for (let i = 0; i < N; i++) {
      let vxi = (vx[i] + fx[i] * DT) * damp, vyi = (vy[i] + fy[i] * DT) * damp;
      if (vyi > VMAX) vyi = VMAX;
      else if (vyi < -VMAX) vyi = -VMAX;
      vy[i] = vyi;
      y[i] += vyi * DT;
      if (GRIP[i] !== 0) {
        vx[i] = 0;
        continue;
      }
      if (vxi > VMAX) vxi = VMAX;
      else if (vxi < -VMAX) vxi = -VMAX;
      vx[i] = vxi;
      x[i] += vxi * DT;
    }
  }
}

// How the load is spread up the sheet. Each cycle the grips pull harder at one or two places and less elsewhere, 1 at
// the strongest, so the strain is never the same picture twice and the crack starts where it is strongest.
function makeProfile(S) {
  const R = Math.random, prof = S.prof;
  const nb = 2 + floor(R() * 2);
  const c = [], w = [], a = [];
  for (let k = 0; k < nb; k++) (c.push(-1.3 + 2.6 * R()), w.push(0.3 + 0.6 * R()), a.push(0.4 + 0.6 * R()));
  const A = S.mild ? 0.05 + 0.2 * R() : 0.1 + 0.4 * R();
  let mx = 1e-9;
  for (let r = 0; r < NR; r++) {
    const eta = (r - (NR - 1) / 2) / (NR / 2);
    let v = 0;
    for (let k = 0; k < nb; k++) v += a[k] * exp(-(((eta - c[k]) / w[k]) ** 2));
    prof[r] = v;
    if (v > mx) mx = v;
  }
  for (let r = 0; r < NR; r++) prof[r] = 1 - A * (1 - prof[r] / mx);
}

// The grips: the left and right columns are held at the strain e, spread by the profile, and they tremble a little.
function setGrips(S, e, wA) {
  const tau = S.tau;
  const wob = wA * 0.06 * (0.55 * sin(0.107 * tau) + 0.35 * sin(0.173 * tau + 1.3) + 0.25 * sin(0.0617 * tau + 2.1));
  const tap = wA * S.tap, tk = S.tapK, tp = S.tapP;
  const { x, prof } = S;
  for (let k = 0; k < GRIPS.length; k++) {
    const i = GRIPS[k];
    const eta = (Y0[i] - YC) / (NR / 2);
    x[i] = X0[i] + GRIP[i] * 0.5 * W0 * e * (prof[i % NR] + wob + (tap !== 0 ? tap * cos(tk * eta + tp) : 0));
  }
}

// the load multiple the Load knob asks for: 1.85 at 0, 2.85 at 2, 3.1 at 2.5 and 3.65 at 3
const loadMult = (k) => 1.85 + 0.5 * k + 0.3 * max(0, k - 2) * max(0, k - 2);

// Griffith's load for the springs as they are now: the strain a long crack just runs at, times the load multiple.
const strainFor = (S, mult) => mult * S.eps * EG;

// The flaw, chosen when the load starts: bonds on one column gap, from the top or bottom edge or in the middle, in the
// order they will go. The sheet breaks them a few at a time while the load rises, and the length it ends on is the
// length that Griffith's balance makes unstable at the load the knob asks for, so the crack runs when the load gets there.
function planFlaw(S, mult) {
  const R = Math.random, prof = S.prof;
  // where the strain is strongest: draw a row weighted by the sixth power of the profile
  const pick = (lo, hi) => {
    let tot = 0;
    for (let r = lo; r <= hi; r++) tot += pow(prof[r], 6);
    let u = R() * tot, r = lo;
    for (; r < hi; r++) {
      u -= pow(prof[r], 6);
      if (u <= 0) break;
    }
    return r;
  };
  const pt = pow(prof[0], 6), pb = pow(prof[NR - 1], 6);
  let mode = 0, yc = 0, loc = 1;
  if (R() < 0.25 || max(pt, pb) < 0.35) {
    yc = pick(9, NR - 10) + R() - 0.5;
    mode = 1;
    loc = prof[floor(yc)];
  } else if (R() * (pt + pb) < pb) (mode = 2), (loc = prof[NR - 1]);
  else (mode = 0), (loc = prof[0]);
  const rows = cl(round(1 + (2.9 - mult * loc) * 3.8), 1, 6);
  const hgt = max(rows, 1.6), tail = 3;
  const cg = 3 + floor(R() * (NC - 7));
  let ya, yb, lim;
  if (mode === 1) {
    ya = yc - (hgt + tail) / 2;
    yb = yc + (hgt + tail) / 2;
    lim = hgt / 2;
  } else if (mode === 0) (ya = -1), (yb = hgt + tail - 0.4), (lim = hgt - 0.4);
  else (ya = NR - hgt - tail - 0.6), (yb = NR + 1), (lim = hgt - 0.4);
  const key = (ym) => (mode === 0 ? ym : mode === 2 ? NR - ym : abs(ym - yc));
  const found = [];
  for (let b = 0; b < NB; b++) {
    const i = bi[b], j = bj[b];
    if (floor(i / NR) !== cg || floor(j / NR) !== cg + 1) continue;
    const ym = (Y0[i] + Y0[j]) / 2;
    if (ym >= ya && ym <= yb) found.push([key(ym), b]);
  }
  found.sort((p, q) => p[0] - q[0]);
  S.mmin = min(1.8 / max(loc, 0.01), 2.9); // the load at the flaw is the knob's times the profile there, and it must be able to run
  S.fl = found.map((p) => p[1]);
  S.flPlan = found.filter((p) => p[0] <= lim).length;
  S.flN = 0;
}

function breakFlaw(S, n) {
  const m = min(n, S.fl.length);
  while (S.flN < m) {
    const b = S.fl[S.flN++];
    if (S.alive[b]) (breakBond(S, b), S.nbk0++);
  }
}

function drawD0() {
  return 4 + 11 * Math.random();
}

function startLoad(S) {
  S.ph = LOAD;
  S.lt = 0;
  S.nbk0 = S.nbk;
  S.LT = cl(S.LT + (Math.random() - 0.5) * 20, 10, 40);
  S.cyc = 0.85 + 0.3 * Math.random();
  // the sheet is at rest and unstrained: put every mass on its lattice place (a mass at the edge can be left pushed in between its neighbours, and is shifted here)
  const { x, y, vx, vy } = S;
  for (let i = 0; i < N; i++) (x[i] = X0[i]), (y[i] = Y0[i]), (vx[i] = vy[i] = 0);
  for (let b = 0; b < NB; b++) S.hr[b] = 1;
  S.relax = false;
  scramble(S);
  makeProfile(S);
  planFlaw(S, max(1.85, loadMult(S.K2) * S.cyc));
  breakFlaw(S, 2);
}

function startHeal(S) {
  const dead = [];
  for (let b = 0; b < NB; b++) if (!S.alive[b]) dead.push(b);
  const tb = S.tb;
  dead.sort((a, b) => tb[a] - tb[b]);
  S.hlist = dead;
  S.hn = 0;
  S.hp = 0;
  S.ph = HEAL;
}

function healBonds(S, upTo) {
  const { x, y, alive, hr, dis, hlist } = S;
  while (S.hn < upTo && S.hn < hlist.length) {
    const b = hlist[S.hn++];
    const i = bi[b], j = bj[b];
    const dx = x[j] - x[i], dy = y[j] - y[i];
    alive[b] = 1;
    hr[b] = max(0.2, sqrt(dx * dx + dy * dy)); // rest length is the length it has: no impulse
    dis[b] = 0.86 + 0.28 * Math.random();
    // the front of the mending glows: a bright bead that runs along the scar
    S.h1[i] = min(S.h1[i] + 0.45, 1);
    S.h1[j] = min(S.h1[j] + 0.45, 1);
    S.relax = true;
  }
}

function advance(S, d, kn) {
  const K2 = cl(kn[1], 0, 3), K3 = cl(kn[2], 0, 1), K4 = cl(kn[3], -1, 1);
  S.K2 = K2;
  S.t += d;
  S.hw += (S.hwT - S.hw) * (1 - exp(-d / 12));
  const t = S.t;
  S.epsT = 0.07 * pow(4.3, K3);
  S.eps += (S.epsT - S.eps) * (S.ready ? 1 - exp(-d / 0.6) : 1);
  S.ready = true;
  const slow = K4 < 0 ? pow(3, -K4) : pow(1 - K4, 1.5) + 0.015;
  const quick = K4 < 0 ? 1 : max(0.12, 1 - K4);
  const drift = 1 + 0.12 * sin((TAU * t) / 61.7 + S.ph0[0]) + 0.08 * sin((TAU * t) / 37.3 + S.ph0[1]) + 0.05 * sin((TAU * t) / 23.9 + S.ph0[2]);
  const mult = max(S.mmin, 1.85, loadMult(K2) * drift * S.cyc);
  let e = S.e, wTarget = 0, gam = 0.007;
  S.safe = S.ph >= UNLOAD;
  S.anch = S.ph >= UNLOAD ? 0.03 : 0;
  if (S.ph === LOAD) {
    S.lt += d;
    const fr = cl(S.lt / S.LT, 0, 1);
    e = strainFor(S, 0.03 + (mult - 0.03) * pow(fr, 0.5));
    wTarget = 1;
    breakFlaw(S, round(2 + (S.flPlan - 2) * sm(0.1, 0.75, fr)));
    if (S.nbk - S.nbk0 > 8 || fr >= 1) {
      if (fr >= 1) breakFlaw(S, S.fl.length);
      S.ph = CRACK;
      S.ct = 0;
      S.eHold = e;
    }
  } else if (S.ph === CRACK) {
    S.ct += d;
    e = S.eHold;
    gam = 0.004;
    if (S.ct > 0.8 && t - S.tLast > 1.3) (S.ph = SCAR), (S.scT = 0), (S.sc = 0), (S.D0 = drawD0()), (S.hwT = 0.4 * Math.random());
  } else if (S.ph === SCAR) {
    S.scT = S.tLast > S.t - 0.1 ? 0 : S.scT + d;
    e = S.eHold;
    gam = 0.004 + 0.05 * sm(0, 1.2, S.scT);
    S.sc += d / (S.D0 * slow);
    if (S.sc >= 1 && S.scT > 0.3 + 1.2 * quick) (S.ph = UNLOAD), (S.ul = 0);
  } else if (S.ph === UNLOAD) {
    S.ul += d / (2.2 * quick);
    e = S.eHold * (1 - sm(0, 1, S.ul));
    gam = 0.05;
    if (S.ul >= 1) (e = 0), startHeal(S);
  } else if (S.ph === HEAL) {
    e = 0;
    gam = 0.05;
    S.hp += d / (3.2 * quick);
    healBonds(S, floor(S.hlist.length * sm(0, 1, S.hp) + 0.5));
    if (S.hp >= 1) (healBonds(S, S.hlist.length), (S.ph = SETTLE), (S.stT = 0));
  } else {
    e = 0;
    gam = 0.05;
    S.stT += d;
    if (!S.relax || S.stT > 6) (startLoad(S), (e = 0));
  }
  S.e = e;
  S.wA += (wTarget - S.wA) * (1 - exp(-d / 0.8));
  S.gam = gam;
  if (S.relax && S.ph !== CRACK) {
    const a = 1 - exp(-d / 1.3);
    let off = 0;
    const { hr, alive } = S;
    for (let b = 0; b < NB; b++) {
      const h = hr[b];
      if (h === 1) continue;
      const nh = h + (1 - h) * a;
      hr[b] = abs(nh - 1) < 0.002 ? 1 : nh;
      if (hr[b] !== 1) off++;
    }
    if (off === 0) S.relax = false;
  }
  // now and then the grips give the sheet a small knock, and it rings
  if (S.ph === LOAD) {
    S.tapT -= d;
    if (S.tapT <= 0) (S.tapT = 1.2 + 3.6 * Math.random()), (S.tapV = (Math.random() < 0.5 ? -1 : 1) * (0.025 + 0.045 * Math.random())), (S.tapK = 0.8 + 2.4 * Math.random()), (S.tapP = TAU * Math.random());
  }
  S.tap = S.tapV;
  S.tapV *= exp(-d / 0.09);
  if (abs(S.tapV) < 1e-4) S.tapV = 0;
  setGrips(S, e, S.wA);
  S.tau += d * 30 * SUB * DT;
  S.acc += d * 30 * SUB;
  const n = min(floor(S.acc), 3 * SUB);
  S.acc -= floor(S.acc);
  integrate(S, n);
  // heat cools, scars fade
  const a1 = exp(-d / 0.2), a2 = exp(-d / (1.5 + 0.25 * S.D0 * slow));
  const { h1, h2 } = S;
  for (let i = 0; i < N; i++) (h1[i] *= a1), (h2[i] *= a2);
  S.fade = exp(-d / 0.3);
  // a sheet that has gone non-finite starts again, quietly
  let xs = 0;
  const { x, y } = S;
  for (let i = 0; i < N; i++) xs += x[i] + y[i];
  if (!(xs === xs) || abs(xs) > 1e6) {
    S.resets++;
    resetSheet(S, 0);
    S.e = 0;
    S.LT = 12;
    planFlaw(S, loadMult(S.K2));
    breakFlaw(S, 2);
  }
}

function preroll(S, kn) {
  S.ph0 = [];
  for (let k = 0; k < 6; k++) S.ph0.push(Math.random() * TAU);
  const K2 = cl(kn[1], 0, 3);
  const mult = loadMult(K2);
  S.K2 = K2;
  S.eps = S.epsT = 0.07 * pow(4.3, cl(kn[2], 0, 1));
  const e0 = strainFor(S, mult);
  S.mild = true; // the first crack, the one the panel opens on, always has the load to run a long way
  resetSheet(S, e0);
  S.mild = false;
  S.t = 0;
  S.tau = 0;
  S.ready = true;
  planFlaw(S, mult);
  breakFlaw(S, 999);
  S.ph = CRACK;
  S.ct = 0;
  S.eHold = e0;
  S.e = e0;
  S.LT = 14 + 12 * Math.random();
  // run the first crack unseen and open on its last moments, the waves still ringing
  let n = 0;
  while (n++ < 900 && !(S.ph === CRACK && S.ct > 0.8 && S.t - S.tLast > 0.5)) advance(S, 1 / 30, kn);
  S.t = 0;
  S.tLast = -0.5;
}

export function setup(params) {
  params.s = null;
}

export function update(dt, input, params) {
  const kn = input.knobValues || [0, 2, 0, 0.06];
  if (!params.s) {
    params.s = makeSheet();
    preroll(params.s, kn);
  }
  params.s.hueNow = cl(kn[0], 0, 1);
  advance(params.s, cl(dt || 0, 0, 0.1), kn);
}

// ---- palette: the strain index (stretch over a reference stretch, plus the heat of a fresh break) to colour.
// The Hue knob slides along three ramps, each dark glass at the bottom and a pale tip at the top: violet through magenta
// to gold, ice-blue through azure to cream, and jade through green to a lime gold.
const IDX = [0, 0.1, 0.22, 0.38, 0.55, 0.72, 0.88, 1.05, 1.25];
const PAL = [
  [[6, 22, 30], [10, 42, 74], [36, 42, 132], [96, 52, 200], [190, 58, 194], [255, 98, 124], [255, 178, 56], [255, 232, 150], [255, 250, 236]],
  [[6, 24, 34], [8, 46, 84], [20, 84, 150], [46, 134, 200], [96, 186, 225], [170, 224, 238], [236, 246, 236], [255, 246, 214], [255, 252, 240]],
  [[6, 26, 24], [8, 50, 46], [18, 96, 80], [44, 146, 106], [112, 196, 116], [196, 226, 120], [250, 230, 140], [255, 244, 196], [255, 252, 236]],
];
const NQ = 9; // nine neighbouring ramps, for the faint iridescence

function buildLut(S, hue) {
  const lut = S.lut;
  for (let q = 0; q < NQ; q++) {
    const u = cl(2 * hue + S.hw + (q - 4) * 0.04, 0, 2);
    const a = u >= 1 ? 1 : 0, w = u - a;
    const A = PAL[a], B = PAL[a + 1];
    for (let k = 0; k < 256; k++) {
      const v = (k / 255) * 1.25;
      let j = 0;
      while (j < 7 && v > IDX[j + 1]) j++;
      const f = cl((v - IDX[j]) / (IDX[j + 1] - IDX[j]), 0, 1);
      for (let c = 0; c < 3; c++) {
        const ca = A[j][c] + (A[j + 1][c] - A[j][c]) * f, cb = B[j][c] + (B[j + 1][c] - B[j][c]) * f;
        lut[(q * 256 + k) * 3 + c] = ca + (cb - ca) * w;
      }
    }
  }
}

// kx, ky (per LED), om (per second), phase, weight: periods of 40 to 100 LEDs and 8 to 21 seconds that do not divide one another
const SHIM = [
  [0.094, 0.037, 0.52, 0.4, 0.34],
  [-0.061, 0.083, -0.37, 1.9, 0.26],
  [0.043, -0.071, 0.71, 3.3, 0.2],
  [0.118, 0.052, -0.29, 5.1, 0.12],
  [-0.032, 0.059, 0.43, 2.7, 0.08],
];

function blur3(a, tmp) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      const l = x > 0 ? a[o + x - 1] : a[o + x], r = x < W - 1 ? a[o + x + 1] : a[o + x];
      tmp[o + x] = 0.25 * l + 0.5 * a[o + x] + 0.25 * r;
    }
  }
  for (let y = 0; y < H; y++) {
    const o = y * W, u = (y > 0 ? y - 1 : y) * W, dn = (y < H - 1 ? y + 1 : y) * W;
    for (let x = 0; x < W; x++) a[o + x] = 0.25 * tmp[u + x] + 0.5 * tmp[o + x] + 0.25 * tmp[dn + x];
  }
}

function splat(buf, gx, gy, w) {
  const ix = floor(gx), iy = floor(gy);
  const ax = gx - ix, ay = gy - iy;
  if (ix >= -1 && ix < W && iy >= -1 && iy < H) {
    const w00 = (1 - ax) * (1 - ay) * w, w10 = ax * (1 - ay) * w, w01 = (1 - ax) * ay * w, w11 = ax * ay * w;
    if (ix >= 0 && iy >= 0) buf[iy * W + ix] += w00;
    if (ix + 1 < W && iy >= 0) buf[iy * W + ix + 1] += w10;
    if (ix >= 0 && iy + 1 < H) buf[(iy + 1) * W + ix] += w01;
    if (ix + 1 < W && iy + 1 < H) buf[(iy + 1) * W + ix + 1] += w11;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  buildLut(S, S.hueNow || 0);
  const { x, y, h1, h2, alive, hr, dk, fN, fM, fA, fC, nd, E, Wt, DM, D2, T, lut } = S;
  E.fill(0);
  Wt.fill(0);
  DM.fill(0);
  fN.fill(0);
  fM.fill(0);
  fA.fill(0);
  fC.fill(0);
  nd.fill(0);
  const fade = S.fade;
  // bonds: stretch per mass (mean and largest of its live bonds), and the dark mark of every broken or just mended bond
  for (let b = 0; b < NB; b++) {
    const i = bi[b], j = bj[b];
    if (alive[b]) {
      const dx = x[j] - x[i], dy = y[j] - y[i];
      const s = abs(sqrt(dx * dx + dy * dy) - hr[b]);
      fA[i] += s;
      fA[j] += s;
      fC[i]++;
      fC[j]++;
      if (s > fM[i]) fM[i] = s;
      if (s > fM[j]) fM[j] = s;
      const k = dk[b];
      if (k > 0.02) {
        splat(DM, x[i] + x[j] - 0.5, y[i] + y[j] - 0.5, k);
        dk[b] = k * fade;
      } else if (k > 0) dk[b] = 0;
    } else {
      const k = dk[b];
      splat(DM, x[i] + x[j] - 0.5, y[i] + y[j] - 0.5, k);
      nd[i] += k;
      nd[j] += k;
    }
  }
  for (let i = 0; i < N; i++) fN[i] = fC[i] > 0 ? 0.5 * fM[i] + (0.5 * fA[i]) / fC[i] : 0;
  // one pass of smoothing along the bonds takes the lattice-scale speckle out of the waves
  fA.fill(0);
  fC.fill(0);
  for (let b = 0; b < NB; b++) {
    if (!alive[b]) continue;
    const i = bi[b], j = bj[b];
    fA[i] += fN[j];
    fA[j] += fN[i];
    fC[i]++;
    fC[j]++;
  }
  const sref = 0.062 * pow(S.eps / 0.07, 0.85);
  for (let i = 0; i < N; i++) {
    const f = fC[i] > 0 ? 0.5 * fN[i] + (0.5 * fA[i]) / fC[i] : fN[i];
    const n = nd[i] > 1 ? 1 : nd[i];
    const idx = f / sref + 0.4 * h2[i] + 1.2 * h1[i] + 0.1 * n;
    // a mass hanging on by one bond is debris and does not show, and one on two or three shows dimly
    const w = fC[i] < 1 ? 0 : fC[i] > 3.9 ? 1 : (fC[i] - 1) / 3;
    const gx = 2 * x[i] - 0.5, gy = 2 * y[i] - 0.5;
    splat(E, gx, gy, idx * w);
    splat(Wt, gx, gy, w);
  }
  blur3(E, T);
  blur3(Wt, T);
  blur3(DM, T);
  blur3(DM, T);
  D2.set(DM);
  blur3(D2, T);
  blur3(D2, T);
  const t = S.t;
  // shimmer: five slow travelling waves of light that pass through the glass and the glow, each with a period of its own
  const cS = S.cS, cC = S.cC, rS = S.rS, rC = S.rC;
  for (let k = 0; k < 5; k++) {
    const [kx, ky, om, ph] = SHIM[k];
    for (let px = 0; px < W; px++) (cS[k * W + px] = sin(kx * px + om * t + ph)), (cC[k * W + px] = cos(kx * px + om * t + ph));
    for (let py = 0; py < H; py++) (rS[k * H + py] = sin(ky * py)), (rC[k * H + py] = cos(ky * py));
  }
  for (let p = 0; p < W * H; p++) {
    const px = p % W, py = (p / W) | 0;
    const wn = Wt[p] * 3.46;
    const cov = sm(0.2, 0.7, wn);
    let sh = 0;
    for (let k = 0; k < 5; k++) sh += SHIM[k][4] * (cS[k * W + px] * rC[k * H + py] + cC[k * W + px] * rS[k * H + py]);
    const hs = 0.55 * (cS[3 * W + px] * rC[3 * H + py] + cC[3 * W + px] * rS[3 * H + py]) + 0.45 * (cS[4 * W + px] * rC[4 * H + py] + cC[4 * W + px] * rS[4 * H + py]);
    const idx0 = Wt[p] > 1e-4 ? E[p] / Wt[p] : 0;
    let idx = idx0 * (1 + 0.14 * sh) + 0.11 + 0.05 * sh;
    const dark = sm(0.12, 0.5, DM[p] * 3.46);
    const rim = sm(0.03, 0.2, D2[p] * 3.46) * (1 - dark);
    idx += 0.3 * rim;
    if (idx > 0.9) idx = 0.9 + 0.35 * (1 - exp(-(idx - 0.9) / 0.45)); // the bright end rolls off, so white is left to the tips
    // isochromatic fringes, as in loaded glass between polarisers: bands of colour at equal strain, so a load that
    // rises sweeps them across the sheet and each flaw sits in its own rosette of them
    idx += 0.045 * sin(idx * 48) * sm(0.1, 0.4, idx) * (1 - dark);
    let k = idx * (255 / 1.25);
    k = k < 0 ? 0 : k > 255 ? 255 : k | 0;
    const m = cov * (1 - 0.94 * dark);
    // the glass is faintly iridescent: the ramp leans a little one way or the other from place to place, as the light passes
    const q = ((hs * 3.9 + 4.5) | 0) * 256 + k;
    display.setPixel(px, py, (lut[q * 3] * m) | 0, (lut[q * 3 + 1] * m) | 0, (lut[q * 3 + 2] * m) | 0);
  }
}
