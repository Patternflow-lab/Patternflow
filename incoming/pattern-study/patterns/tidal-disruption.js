// ===== Patternflow pattern =====
// Title:   Tidal Disruption
// Family:  tidaldisruption
// Idea:    A star swings past a small black disc on a parabola and is pulled into a long ribbon of light; the bound half comes back in a growing loop, whips round the hole blue-white and winds into a gold spiral ring that drains inward, while the other half leaves the panel and the next star is already falling in from another side.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: tidal disruption of a star by a massive black hole (Jack Hills 1975; Martin Rees 1988; the t^(-5/3) fallback rate from Sterl Phinney 1989), the frozen-in energy spread (Lacy, Townes and Hollenbach 1982), Kepler's problem in universal variables with Stumpff functions and Barker's equation for the first guess (as in Bate, Mueller and White 1971), all from memory; drawing each star as three continuous threads sampled where the panel needs them, the closed-form spiral ring they wind into, the slow sway of the orbits and the temperature ramp are original, pattern round 252
// Round:   252
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.4..3, Reach=-1..1, Spread=0..1
//
// Knob 1: Hue. Turns the temperature ramp round the wheel; it opens on blue-white gas at the hole cooling through gold and amber to red far out.
// Knob 2: Speed. 0.4 to 3, opening at 2. The rate of time: at 0.4 the stream creeps and the swing round the hole can be followed, at 3 a star is torn and back in a few seconds; the slow sway of the orbits and the drift of the view keep their own pace.
// Knob 3: Reach. -1 to 1, opening at 0. The scale of the view: at -1 close in on the whip round the hole and the spiral ring, at 1 far out with whole loops and the escaping tail inside the panel.
// Knob 4: Spread. 0 to 1, opening at 0.06. The energy spread of the debris and how far its three strands fan apart: at 0 every star stays a short bright arc on one closed orbit and comes back nearly together, and stars come more often; at 0.06 about half of it loops back and half escapes; at 1 it opens at once into tight loops close to the hole and a wide fan of long fast tails.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, pow, cbrt, sinh, cosh, asinh, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = () => Math.random();

const MU = 1200, SMU = sqrt(MU);   // the hole's pull, in LED^3 per model second^2 at Reach 0
const LEAD = 24, LIFE = 60;        // a star is made this long before its pass and kept this long after, model seconds
const STEP = 1.3, RSTEP = 1.8;     // LED between two splats along a thread, and along the ring
const B0 = 3.4, LMAX = 0.35, LMIN = 0.00015;   // thread brightness is B0 times the cube root of its mass per length, held between two ends
const NS = 3;                      // strands a star is drawn as: they differ in how far their orbit turns at the hole
const TGLOW = 0.11;                // afterglow, seconds
const M0 = 24;                     // first cut of a thread; it is cut finer wherever two points land far apart

// ---- Kepler in universal variables ------------------------------------------------
let gC = 0.5, gS = 1 / 6;
function stumpff(z) {
  if (z > 1e-3) { const q = sqrt(z); gC = (1 - cos(q)) / z; gS = (q - sin(q)) / (q * z); }
  else if (z < -1e-3) { const q = sqrt(-z); gC = (cosh(q) - 1) / -z; gS = (sinh(q) - q) / (q * -z); }
  else { gC = 0.5 - z / 24 + z * z / 720; gS = 1 / 6 - z / 120 + z * z / 5040; }
}

// what a step shares with the helpers below
let gNow = 0, gZ = 1, gHx = 32, gHy = 64, gDep = 1, gRh = 2.5, gMs = 1;
let bI = null, bT = null;
let oX = 0, oY = 0, oR = 0, oC = 0, oT = 0;

// The piece of star `ev` with energy fraction f (-1 most bound, 1 fastest away). Every piece shares the
// pericentre; before its own pass it rides the star's parabola, after it its own conic. Writes the
// panel position, the distance from the hole, the universal anomaly and the time since the pass.
function orbitPt(ev, f, guess) {
  const dtf = gNow - ev.t0 + f * ev.tsz;
  const post = dtf > 0;
  const al = post ? ev.ac - f * ev.aw : 0;      // 1 / semi-major axis
  const rp = ev.rp, k = 1 - al * rp;
  let adt = post ? dtf : -dtf;
  let hi;
  if (al > 0) {
    const per = TP / (SMU * al * sqrt(al));
    if (adt > per) adt = per;
    hi = min(SMU * adt / rp, TP / sqrt(al));
  } else hi = min(SMU * adt / rp, cbrt(6 * SMU * adt / k));
  const sdt = SMU * adt;
  let lo = 0;
  // Barker's equation gives the parabola exactly, and that is close for every piece
  let x = guess > 0 ? guess : 2 * sqrt(2 * rp) * sinh(asinh(1.5 * sdt / (rp * sqrt(2 * rp))) / 3);
  if (x > hi) x = hi;
  for (let it = 0; it < 14; it++) {
    stumpff(al * x * x);
    const F = rp * x + k * x * x * x * gS - sdt;
    if (F > 0) hi = x; else lo = x;
    let xn = x - F / (rp + k * x * x * gC);
    if (!(xn >= lo && xn <= hi)) xn = 0.5 * (lo + hi);
    const d = xn - x;
    x = xn;
    if (d < 1e-5 && d > -1e-5) break;
  }
  stumpff(al * x * x);
  const x2 = x * x;
  const xp = rp - x2 * gC;
  let yp = sqrt(MU * (2 / rp - al)) * (adt - x2 * x * gS / SMU);
  if (!post) yp = -yp;
  // the orbit turns a little as the piece swings round the hole, and the strands part slowly after it
  const an = ev.phi + ev.sw + ev.sn * (ev.prec0 * sstep(-ev.tw, ev.tw, dtf) + ev.dpr * ev.gi * sstep(0.5, 16, dtf));
  const ca = cos(an), sa = sin(an);
  oX = gHx + gZ * (xp * ca - ev.sn * yp * sa);
  oY = gHy + gZ * (xp * sa + ev.sn * yp * ca);
  oR = rp + k * x2 * gC; oC = x; oT = dtf;
}

function splat(x, y, R, a, T) {
  if (a < 2e-4) return;
  const x0 = max(0, ceil(x - R - 0.5)), x1 = min(W - 1, floor(x + R - 0.5));
  const y0 = max(0, ceil(y - R - 0.5)), y1 = min(H - 1, floor(y + R - 0.5));
  const iR2 = 1 / (R * R), aT = a * T;
  for (let yy = y0; yy <= y1; yy++) {
    const dy = yy + 0.5 - y, o = yy * W;
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + 0.5 - x;
      let w = 1 - (dx * dx + dy * dy) * iR2;
      if (w <= 0) continue;
      w *= w;
      bI[o + xx] += a * w; bT[o + xx] += aT * w;
    }
  }
}

const tempOf = (r) => { const x = r / 44; return 1 / (1 + x * sqrt(x)); };
// mass along the thread: thin at both ends, with slow swells that are seen to flow
const taper = (f) => sstep(1, 0.6, abs(f));
const lump = (ev, f) => 1 + 0.45 * sin(ev.k1 * f + ev.p1) + 0.25 * sin(ev.k2 * f + ev.p2);

// one stretch of the thread between two pieces: cut in half while its ends are far apart on the panel
function seg(ev, wE, fA, xA, yA, rA, cA, tA, fB, xB, yB, rB, cB, tB, depth) {
  const m = 5;
  if ((xA < -m && xB < -m) || (xA > W + m && xB > W + m) || (yA < -m && yB < -m) || (yA > H + m && yB > H + m)) return;
  const dx = xB - xA, dy = yB - yA, D = sqrt(dx * dx + dy * dy);
  const fm = 0.5 * (fA + fB);
  if (D > STEP * (1 + min(1, rA / 40)) && depth < 7) {
    orbitPt(ev, fm, 0.5 * (cA + cB));
    const xm = oX, ym = oY, rm = oR, cm = oC, tm = oT;
    seg(ev, wE, fA, xA, yA, rA, cA, tA, fm, xm, ym, rm, cm, tm, depth + 1);
    seg(ev, wE, fm, xm, ym, rm, cm, tm, fB, xB, yB, rB, cB, tB, depth + 1);
    return;
  }
  const r = 0.5 * (rA + rB), tm = 0.5 * (tA + tB);
  // a thread pulled very long would fade out of sight; it is kept at a floor so every living star stays a line
  const lam = cl(0.5 * (fB - fA) * gZ / max(D, 1e-4), LMIN, LMAX) * lump(ev, fm) * gMs * taper(fm);
  let T = cl(tempOf(r) + ev.tOff, 0, 1);
  // the gas keeps the star's own colour for a few seconds after the pass
  if (ev.tStar > T) T += (ev.tStar - T) * (tm < 0 ? 1 : exp(-tm / 3));
  // far out the strands lie apart, so each is drawn wide enough to meet the next: a ribbon, not a comb
  const R = cl(0.8 * r * gZ * ev.dpr * sstep(0.5, 16, tm), 1.6 + 1.2 * (1 - T), 4.6);
  const n = max(1, ceil(D / (0.6 * R)));
  const a = B0 * cbrt(lam) * (D / n) * (0.7 + 0.9 * T * T) * wE * gDep * (2 / R);
  for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; splat(xA + dx * u, yA + dy * u, R, a, T); }
}

// The part of the thread that has come back. A piece that returned s seconds ago swung out from the
// pericentre onto a near circle at the radius its angular momentum gives, and has spiralled in since;
// the angle it has turned through has a closed form, so the ring is drawn from s alone.
function ring(ev, dtE, wE) {
  const aMax = ev.ac + ev.aw, aMin = ev.ac - ev.aw;
  const tMin = TP / (SMU * aMax * sqrt(aMax));
  const sEnd = dtE - ev.tsz - tMin;
  if (sEnd <= 0) return;
  let s = aMin > 1e-6 ? max(0, dtE + ev.tsz - TP / (SMU * aMin * sqrt(aMin))) : 0;
  const rp = ev.rp, tin = ev.tin, tr = ev.tr, a0 = ev.phi + ev.sw + ev.sn * (ev.prec0 + ev.dpr * ev.gi);
  for (let guard = 0; s < sEnd && guard < 1400; guard++) {
    const T = dtE - s;
    const al = pow(TP / (SMU * T), 2 / 3);
    const f = (ev.ac - al) / ev.aw;
    const e = 1 - rp * al;
    const rc = rp * (1 + e) * ev.rcf * (1 + 0.05 * sin(ev.n1 * T + ev.p3));
    const wc = sqrt(MU / (rc * rc * rc)), wp = sqrt(MU * (1 + e) / (rp * rp * rp));
    const ein = exp(-s / tin), er = exp(-s / tr), spin = 1 / (ein * sqrt(ein));
    const r = rc * ein - (rc - rp) * er;
    const v = (wc * spin + (wp - wc) * er) * r;
    const ds = RSTEP / (gZ * v);
    if (r < gRh * 0.9) break;
    if (f >= -1 && f <= 1) {
      const th = a0 + ev.sn * (wc * (tin / 1.5) * (spin - 1) + (wp - wc) * tr * (1 - er));
      const lam = cl(al / (3 * ev.aw * T) / v, LMIN, LMAX) * lump(ev, f) * gMs * taper(f);
      // blue-white off the stream, then white-gold inside the ring and orange at its rim
      const Tm = cl(tempOf(r) * er + (0.74 - 0.36 * sstep(3, 15, r)) * (1 - er) + 0.6 * ev.tOff, 0, 1);
      const R = 1.4 + 0.6 * (1 - Tm);
      const a = B0 * cbrt(lam) * RSTEP * (0.7 + 0.9 * Tm * Tm) * (0.2 + 0.8 * er) * sstep(gRh * 0.9, gRh * 1.4, r) * wE * gDep * (2 / R);
      splat(gHx + gZ * r * cos(th), gHy + gZ * r * sin(th), R, a, Tm);
    }
    s += ds;
  }
}

function drawStar(ev) {
  const dtE = gNow - ev.t0;
  const wE = sstep(0, 10, ev.life - dtE);
  if (wE <= 0) return 0;
  // until the swing begins the strands lie on one another: the first is drawn for all of them
  const whole = dtE + ev.tsz < -ev.tw;
  if (whole && ev.g0 > 0) return 0;
  gMs = (whole ? 1 : 1 / NS) * ev.mass;
  // the piece that is at the pericentre for the second time right now: all below it are in the ring
  let fh = -1;
  const aMax = ev.ac + ev.aw;
  const tMin = TP / (SMU * aMax * sqrt(aMax));
  if (dtE - ev.tsz > tMin) {
    let f = -1;
    for (let i = 0; i < 4; i++) f = min(1, (ev.ac - pow(TP / (SMU * (dtE + f * ev.tsz)), 2 / 3)) / ev.aw);
    fh = max(f, -1);
  }
  if (fh < 0.999) {
    orbitPt(ev, fh, 0);
    let fA = fh, xA = oX, yA = oY, rA = oR, cA = oC, tA = oT;
    for (let j = 1; j <= M0; j++) {
      const fB = fh + (1 - fh) * j / M0;
      orbitPt(ev, fB, cA);
      const xB = oX, yB = oY, rB = oR, cB = oC, tB = oT;
      seg(ev, wE, fA, xA, yA, rA, cA, tA, fB, xB, yB, rB, cB, tB, 0);
      fA = fB; xA = xB; yA = yB; rA = rB; cA = cB; tA = tB;
    }
  }
  ring(ev, dtE, wE);
  // the whole star, while it still is one
  if (dtE < 1.5 && ev.g0 === 0) {
    orbitPt(ev, 0, 0);
    if (oX > -6 && oX < W + 6 && oY > -6 && oY < H + 6) splat(oX, oY, 3.4 * ev.size, 0.8 * (1 - sstep(-0.6, 1.5, dtE)) * gDep, max(ev.tStar, tempOf(oR)));
  }
  // how fast gas is coming back just now, as a share of the star per second: the flare follows it
  if (dtE > tMin) {
    const al = pow(TP / (SMU * dtE), 2 / 3);
    const f = (ev.ac - al) / ev.aw;
    if (f < 1) return gMs * wE * al / (3 * ev.aw * dtE) * taper(f);
  }
  return 0;
}

function newStar(st, t0) {
  const rp = 3.2 + 3.8 * pow(rnd(), 1.4);
  const sn = rnd() < 0.5 ? -1 : 1;
  const prec = 0.5 * pow(3.2 / rp, 1.5), fan = 0.25 + 0.4 * rnd();
  // where the loops will point, as an angle from straight up: each star about a golden angle on from the
  // last, so a few stars in a row cover every side, then pulled toward the tall axis where there is room
  let up = st.dir + (rnd() - 0.5) * 0.8;
  st.dir += 2.39996;
  up -= 0.35 * sin(2 * up);
  const size = 0.75 + 0.6 * rnd();
  const wc = sqrt(MU / pow(1.9 * rp, 3));
  const base = {
    t0, rp, size,
    sn,
    // the pericentre lies opposite the loops, less the turn the orbit makes at the hole
    phi: up + PI / 2 - sn * prec,
    cq: 0.85 + 0.4 * rnd(),
    tsz: 0.16 * size,                                // the star's length along its path, in seconds
    tw: 1.6 * sqrt(rp * rp * rp / MU) + 0.15,
    tStar: 0.5 + 0.35 * rnd(), tOff: 0.35 * rnd() - 0.2, mass: size * sqrt(size),
    tin: 10 + 6 * rnd(), tr: 0.9 / wc,
    life: LIFE * (0.85 + 0.3 * rnd()),
    // every orbit sways a little about the hole on its own slow beat, in panel time
    w1: 0.05 + 0.04 * rnd(), w2: 0.02 + 0.02 * rnd(), q1: rnd() * TP, q2: rnd() * TP, sw: 0,
    ac: 0, aw: 0.04,
  };
  const q = cl(pow(4.5 / rp, 1.2) * size, 0.75, 1.6);  // a deep pass and a large star spread wider
  for (let j = 0; j < NS; j++) {
    const g = (2 * j + 1) / NS - 1;
    st.stars.push(Object.assign({}, base, {
      g0: j, gi: j - (NS - 1) / 2, q: q * (1 + 0.14 * g), prec0: prec, fan, dpr: 0, rcf: 1 + 0.12 * g,
      k1: 31 + 16 * rnd(), k2: 83 + 30 * rnd(), p1: rnd() * TP, p2: rnd() * TP, p3: rnd() * TP, n1: 0.4 + 0.4 * rnd(),
    }));
  }
}

export function setup(params) {
  const ph = new Float64Array(8);
  for (let i = 0; i < 8; i++) ph[i] = rnd() * TP;
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    t: 0, now: 0, stars: [], nextT0: -(LIFE + 6), dir: rnd() * TP, ph,
    hx: 32, hy: 64, z: 1, rh: 2.5, flare: 0,
    bI: new Float32Array(NPX), bT: new Float32Array(NPX), lut: new Float32Array(256 * 3),
  });
  return st;
}

function step(st, dt, fill) {
  const k = st.k, ks = st.ks, p = st.ph;
  const a = fill ? 1 : 1 - exp(-dt / 0.2);
  for (let i = 0; i < 4; i++) ks[i] += (k[i] - ks[i]) * a;
  st.t += dt;
  st.now += dt * cl(ks[1], 0.4, 3);
  const t = st.t;
  // the view drifts over the scene, well under one LED a second, so the hole wanders off centre
  st.z = exp(-0.56 * cl(ks[2], -1, 1));
  st.hx = 32 + st.z * (3.2 * sin(0.047 * t + p[0]) + 2.2 * sin(0.019 * t + p[1]));
  st.hy = 64 + st.z * (7 * sin(0.037 * t + p[2]) + 5 * sin(0.013 * t + p[3]));
  st.rh = 2.1 + 0.9 * (st.z - 0.57) / 1.18;           // the disc, in LED
  const u = cl(ks[3], 0, 1);
  // a star with little spread makes a smaller show, so they come more often then
  const gap = 0.65 + 0.35 * sstep(0, 0.05, u);
  while (st.nextT0 - LEAD <= st.now) {
    newStar(st, st.nextT0);
    st.nextT0 += (7 + 3 * rnd()) * gap;
  }
  // the spread knob sets every living piece's energy from its stored fraction, so it acts at once
  const awK = 0.01 + 0.138 * sqrt(u), acK = 0.045 * exp(-u / 0.035), fanK = 0.35 + 1.5 * pow(u, 0.7);
  gNow = st.now; gZ = st.z; gHx = st.hx; gHy = st.hy; gRh = st.rh / st.z;
  bI = st.bI; bT = st.bT;
  const d = fill ? 0 : exp(-dt / TGLOW);
  gDep = 1 - d;
  for (let i = 0; i < NPX; i++) { bI[i] *= d; bT[i] *= d; }
  let rate = 0, n = 0;
  for (let i = 0; i < st.stars.length; i++) {
    const ev = st.stars[i];
    if (st.now - ev.t0 > ev.life) continue;
    ev.ac = acK * ev.cq;
    ev.aw = max(0.002, min(awK * ev.q, 0.68 / ev.rp - ev.ac));
    ev.sw = 0.25 * sin(ev.w1 * t + ev.q1) + 0.15 * sin(ev.w2 * t + ev.q2);
    ev.dpr = ev.prec0 * ev.fan * fanK * 2 / NS;      // the angle between two strands once they have parted
    rate += drawStar(ev);
    st.stars[n++] = ev;
  }
  st.stars.length = n;
  st.flare = 1 - exp(-22 * rate);
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    // the first frame opens on stars that passed up to a minute ago: a stream, loops and a ring
    // and the model clock starts forty seconds in at the speed knob's rate
    st.init = true;
    st.now = 40 * cl(st.k[1], 0.4, 3);
    step(st, 0, true);
  }
  if (dt > 0) step(st, dt, false);
}

// ---- drawing -------------------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// temperature, hue, saturation, value: deep red, red-orange, amber, gold, white-gold, pale gold, pale blue, blue-white
const KEYS = [0, 0.985, 1, 0.62, 0.2, 0.005, 1, 0.95, 0.4, 0.06, 0.97, 1, 0.56, 0.105, 0.82, 1, 0.7, 0.125, 0.55, 1, 0.8, 0.13, 0.3, 1, 0.88, 0.6, 0.25, 1, 1, 0.615, 0.48, 1];
const NK = KEYS.length / 4;
const kc = new Float32Array(NK * 3);

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const lut = st.lut, hue = st.ks[0];
  for (let i = 0; i < NK; i++) hsv(KEYS[i * 4 + 1] + hue, KEYS[i * 4 + 2], KEYS[i * 4 + 3], kc, i * 3);
  for (let q = 0, i = 0; q < 256; q++) {
    const T = q / 255;
    while (i < NK - 2 && T > KEYS[(i + 1) * 4]) i++;
    const u = cl((T - KEYS[i * 4]) / (KEYS[(i + 1) * 4] - KEYS[i * 4]), 0, 1);
    for (let c = 0; c < 3; c++) lut[q * 3 + c] = kc[i * 3 + c] + (kc[i * 3 + 3 + c] - kc[i * 3 + c]) * u;
  }
  const I0 = st.bI, T0 = st.bT, hx = st.hx, hy = st.hy, rh = st.rh, fl = st.flare;
  const gA = 0.06 + 0.5 * fl, gl = (3 + 2.5 * fl) * (0.6 + 0.4 * st.z), rimA = 0.3 + 0.6 * fl;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - hy;
    for (let x = 0; x < W; x++) {
      const o = y * W + x, dx = x + 0.5 - hx;
      const d = sqrt(dx * dx + dy * dy);
      let I = I0[o], IT = T0[o];
      // the flare: a soft glow round the hole, and a thin bright rim on the disc
      const dg = d - rh;
      if (dg < gl * 5) {
        const g = gA * exp(-max(0, dg) / gl);
        I += g; IT += g * 0.66;
        const e = (dg - 0.35) / 0.8;
        if (e * e < 8) { const rr = rimA * exp(-e * e); I += rr; IT += rr * 0.88; }
        const m = sstep(-0.7, 0.5, dg);
        I *= m; IT *= m;
      }
      if (I < 0.004) { display.setPixel(x, y, 0, 0, 0); continue; }
      let T = IT / I;
      const v = 1 - exp(-I);
      // a dim orange reads as brown on the panel, so warm gas goes to red as it dims
      if (T > 0.2 && T < 0.92) T -= (T - 0.2) * (1 - sstep(0.08, 0.55, v)) * (1 - sstep(0.78, 0.92, T));
      const q = (cl(T, 0, 1) * 255 | 0) * 3;
      const wh = 0.7 * sstep(2, 6, I);
      const r = (lut[q] + (1 - lut[q]) * wh) * v, g = (lut[q + 1] + (1 - lut[q + 1]) * wh) * v, b = (lut[q + 2] + (1 - lut[q + 2]) * wh) * v;
      display.setPixel(x, y, cl(r * 255 + 0.5, 0, 255) | 0, cl(g * 255 + 0.5, 0, 255) | 0, cl(b * 255 + 0.5, 0, 255) | 0);
    }
  }
}
