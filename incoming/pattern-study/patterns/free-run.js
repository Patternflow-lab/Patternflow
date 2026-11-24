// ===== Patternflow pattern =====
// Title:   Free Run
// Family:  circadian
// Idea:    A double-plotted actogram, the record a chronobiologist keeps of an animal's days, where each row is two days side by side and each new day scrolls in at the bottom, so that a light-dark cycle stands as a column of bouts, constant darkness lets the animal's own clock lean the bouts into a diagonal stripe, a light pulse steps the stripe, a shifted schedule drags it sideways, and constant light splits the bout in two.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the double-plotted actogram and the free-running rhythm in constant darkness (Pittendrigh 1960, Aschoff 1965, from memory); the phase response curve of a light pulse, small delays in the early subjective night, larger advances in the late and a dead zone by day (DeCoursey 1960, Pittendrigh and Daan 1976, from memory); Aschoff's rule that constant light lengthens the period of a nocturnal animal; the splitting of the bout in constant light into an evening and a morning component, two coupled oscillators (Pittendrigh and Daan 1976, from memory); the skeleton photoperiod (Pittendrigh and Minis 1964, from memory); the numbers and the model are original, pattern round 240
// Round:   240
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tau=0..3.5, Bout=-1..1, Split=0..1
//
// Knob 1: Hue. Turns the colour of the bouts round the wheel and opens in amber, the bright bouts gold. The pale cyan veil of the lights and the indigo ground stay where they are, and the blues round the wheel are paled so the bouts stay brighter than the veil.
// Knob 2: Tau. 0 to 3.5, opening at 2: the period of the animal's own clock is 22.5 hours plus this number, so it opens at 24.5 h. In darkness the stripe leans by tau minus 24 hours a day, 2 LED to the left at the bottom of the range and 2.7 LED to the right at the top, and under a light-dark cycle the bout sits earlier in the night for a long tau and later for a short one, until past about 25.3 h the clock cannot keep up. The whole record leans again as it turns.
// Knob 3: Bout. -1 to 1, opening at 0: the width of the active window is 8 hours times 2 to the power of this number, 4 h (5 LED) at the bottom, 8 h (11 LED) at the opening and 16 h (21 LED) at the top. Every bout on the panel gets wider or thinner at once, in every regime.
// Knob 4: Split. 0 to 1, opening at 0.06: how loosely the evening oscillator that starts the bout and the morning one that ends it are held together. At 0 the bout is one bar; turned up a dark gap opens in it, about 3 h wide in light and dark and 7 h in darkness at the top, and under constant light the two bars part over three or four days, 2 h apart at the opening and 12 h or more at the top, each running at its own period.

const W = 64, H = 128;
const { floor, min, max, abs, sin, cos, sqrt, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

// ---- the record -------------------------------------------------------------
// One bin is 7.5 minutes; a column of the panel is 6 bins, 45 minutes, so 48 hours across 64 columns. The ring keeps
// 72 days, the panel shows 64.
const BIN = 0.125, BPD = 192, NDAY = 72, NB = NDAY * BPD, CB = 6;
const ROWS = 66;
const PRE_DAYS = 82;
const DAY_PER_S = 1;       // days of record a second
const TAU_NOM = 24.5;      // hours a cycle takes, for turning hours into phase
const PAN1 = 3.6, PAN1_T = 97, PAN2 = 2.2, PAN2_T = 151;  // the wander of the origin, hours and seconds
const X0 = 0.08;           // where in the cycle the window opens; the cycle boundary falls in the dead zone

// ---- the clock --------------------------------------------------------------
// Phase in cycles. The phase response curve is a function of the phase from the start of the window.
const GAIN = 0.025;        // cycles an hour at the top of the curve and light of 1
const PULSE_GAIN = 8;    // a bright pulse in darkness is this many lights
const SKEL_GAIN = 3.3;     // a skeleton pulse
const LAMBDA = 0.9;        // hours that constant light adds to the period
const DET_DD = 0.0004;     // evening runs faster than morning by this many cycles an hour in darkness
const DET_LL = 0.0046;     // and by this much more in constant light
const C_HI = 0.2, C_LO = 0.0017;  // the coupling when the knob is at 0 and at 1
function prc(p) {
  p -= floor(p);
  let z = 0, d = p - 0.37;
  if (abs(d) < 0.15) z += 0.5 * (1 + cos((PI * d) / 0.15));
  d = p - 0.12;
  if (abs(d) < 0.16) z -= 0.5 * 0.5 * (1 + cos((PI * d) / 0.16));
  d = p - 1.12;
  if (abs(d) < 0.16) z -= 0.5 * 0.5 * (1 + cos((PI * d) / 0.16));
  return z;
}
// In constant light the phase crawls through the delay lobe and runs through the advance lobe, so the period of the
// cycle is the integral of 1 / (w + gain * Z), not 1 / w. This finds the free-running rate w that gives a period T there.
const ZT = new Float64Array(400);
for (let i = 0; i < 400; i++) ZT[i] = GAIN * prc((i + 0.5) / 400);
function rateForLL(T) {
  let lo = 0.02, hi = 0.07;
  for (let n = 0; n < 32; n++) {
    const w = (lo + hi) / 2;
    let per = 0;
    for (let i = 0; i < 400; i++) per += 1 / (w + ZT[i]) / 400;
    if (per > T) lo = w;
    else hi = w;
  }
  return (lo + hi) / 2;
}

// ---- noise ------------------------------------------------------------------
function ih(a, b, s) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, k, s) {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return mix(ih(i, k, s), ih(i + 1, k, s), u);
}
const gauss = (a, b) => (a + b + ih((a * 4096) | 0, (b * 4096) | 0, 7) - 1.5) * 1.6;

// ---- colour -----------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}
const NL = 64;
// The bout colour for an intensity 0..1: amber at the dim end, gold at the bright, a little paler as it goes.
function buildLut(lut, hue) {
  const c = [0, 0, 0];
  for (let i = 0; i < NL; i++) {
    const u = i / (NL - 1);
    const h = 0.085 + hue + 0.055 * u;
    hsv(h, mix(0.74, 0.86, sstep(0, 0.5, u)) * (1 - 0.14 * sstep(0.75, 1, u)), mix(0.5, 1, u), c, 0);
    // A dim colour on the orange stretch of the wheel reads brown, so it is paled and lifted there.
    const hh = (h - floor(h));
    const b = (hh > 0.5 ? sstep(0.8, 0.95, hh) : 1 - sstep(0.13, 0.26, hh)) * (1 - u);
    hsv(h, mix(0.74, 0.86, sstep(0, 0.5, u)) * (1 - 0.14 * sstep(0.75, 1, u)) * (1 - 0.3 * b), min(1, mix(0.64, 1, u) * (1 + 0.1 * b)), c, 0);
    // Blue and indigo carry little light, so round that part of the wheel the colour is pale to stay brighter than the veil.
    const y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], want = 130 + 50 * u, t = y < want ? (want - y) / (255 - y) : 0;
    lut[i * 3] = c[0] + (255 - c[0]) * t;
    lut[i * 3 + 1] = c[1] + (255 - c[1]) * t;
    lut[i * 3 + 2] = c[2] + (255 - c[2]) * t;
  }
}
const GROUND = [20, 10, 66];
const VEIL = [90, 235, 255];
const PULSE = [215, 255, 255];
const VEIL_A = 0.25, PULSE_A = 0.85;

// ---- regimes ----------------------------------------------------------------
const PERIODIC = { ld: 1, shift: 1, skel: 1 };
function pick(w) {
  let tot = 0;
  for (const k in w) tot += w[k];
  let r = Math.random() * tot;
  for (const k in w) {
    r -= w[k];
    if (r <= 0 && w[k] > 0) return k;
  }
  return "dd";
}
function makeRegime(st, t0) {
  const prev = st.regs.length ? st.regs[st.regs.length - 1] : null;
  let w;
  if (!prev) w = { ld: 3, dd: 1.5, ll: 1, skel: 0.5 };
  else if (PERIODIC[prev.type]) w = { dd: 2.6, ll: 1.3, shift: 3, pulse: 1.6, skel: 0.7 };
  else if (prev.type === "dd") w = { ld: 3, ll: 1.5, skel: 0.9 };
  else if (prev.type === "ll") w = { ld: 3, dd: 1.6, pulse: 1.4, skel: 0.7 };
  else w = { ld: 3, ll: 1.2, skel: 0.8 };
  const type = pick(w);
  const r = { type, t0, t1: 0, p: 12, c: 12, on: 6, pulses: null };
  let len = 8 + floor(22.99 * Math.random() * Math.random() * 0.5 + 22.99 * Math.random() * 0.5);
  if (type === "ld" || type === "shift" || type === "skel") {
    const pp = prev && PERIODIC[prev.type] ? prev : null;
    r.p = type === "skel" ? 9 + Math.random() * 6 : 8 + Math.random() * 8;
    if (type === "shift" && pp) {
      r.c = (pp.c + (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 6) + 24) % 24;
      if (Math.random() < 0.7) r.p = pp.p;
    } else if (type === "skel" && pp) {
      r.c = pp.c;
      r.p = pp.p;
    } else r.c = 12 + (Math.random() - 0.5) * 6 + (prev ? (Math.random() - 0.5) * 8 : 0);
    r.on = (r.c - r.p / 2 + 48) % 24;
    if (type === "shift") len = max(len, 11);
  }
  if (type === "ll") len = max(len, 12);
  if (type === "pulse") {
    len = max(len, 12);
    const zone = () => {
      const q = Math.random();
      return q < 0.45 ? 0.28 + Math.random() * 0.17 : q < 0.88 ? 0.04 + Math.random() * 0.16 : 0.6 + Math.random() * 0.3;
    };
    const a = { d: 3 + floor(Math.random() * 3), phi: zone(), dur: 3.4 + Math.random() * 1.4, t: -1 };
    r.pulses = [a];
    if (len >= 22) {
      const adv = a.phi > 0.25 && a.phi < 0.5;
      r.pulses.push({ d: a.d + 9 + floor(Math.random() * 4), phi: adv ? 0.05 + Math.random() * 0.14 : 0.3 + Math.random() * 0.14, dur: 3.4 + Math.random() * 1.4, t: -1 });
    }
  }
  r.t1 = t0 + len * 24;
  return r;
}

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, seed: floor(Math.random() * 1e9), clock: 0, simTau: -1, simC: 0, lastSim: -9, ph: [Math.random() * 6.283, Math.random() * 6.283],
    nb: 0, acc: 0, thE: Math.random(), thM: 0, Lc: 0,
    tE: new Float64Array(NB), tM: new Float64Array(NB), lt: new Uint8Array(NB),
    cv: new Float32Array(NB), iv: new Float32Array(NB),
    regs: [],
    tau: 24.5, wll: 0.04, alpha: 8, split: 0.06, a: 10 / TAU_NOM, g0: 0, c: 0.05, win: [-1, -1, -1],
    rc: new Float32Array(ROWS * W), ri: new Float32Array(ROWS * W), rv: new Float32Array(ROWS * W), rp: new Float32Array(ROWS * W),
    pc: new Float32Array(W * H), pi: new Float32Array(W * H), pv: new Float32Array(W * H), pp: new Float32Array(W * H), ps: new Float32Array(W * H),
    gl: new Float32Array(W * H), gt: new Float32Array(W * H), tmp: new Float32Array(W * H),
    lut: new Float32Array(NL * 3), hue: -9,
    seam: new Float32Array(64),
  });
  st.thM = st.thE;
  for (let i = 0; i < 64; i++) {
    const u0 = i / 64;
    let s = 0;
    for (let j = 0; j < 8; j++) {
      const u = (u0 + (j + 0.5) / 16) % 1, c = cos(PI * u);
      s += 1 - 0.14 * pow(c * c, 12);
    }
    st.seam[i] = s / 8;
  }
}

function derive(st) {
  const kv = st.k;
  const tau = 22.5 + cl(kv[1], 0, 3.5);
  if (abs(tau - st.tau) > 1e-4 || st.wll === 0.04) (st.tau = tau), (st.wll = rateForLL(tau + LAMBDA));
  st.alpha = 8 * pow(2, cl(kv[2], -1, 1));
  st.split = cl(kv[3], 0, 1);
  st.a = st.alpha / TAU_NOM;
  // how far the morning bar sits behind: it eats into the overlap of the two bars, and a gap opens only past 0.4 of the knob
  const sp = sqrt(st.split);
  st.g0 = 0.36 * st.a * 0.9 * min(1, sp / 0.5) + (3.6 / TAU_NOM) * pow(max(0, (sp - 0.35) / 0.65), 1.1);
  st.c = C_HI * pow(C_LO / C_HI, pow(sp, 0.55));
}

// ---- the activity of one bin ------------------------------------------------
function evalBin(st, i) {
  const idx = i % NB, thE = st.tE[idx], thM = st.tM[idx], L = st.lt[idx], t = i * BIN;
  const a = st.a, rw = 0.42 / TAU_NOM, s = st.seed;
  const cE = floor(thE), xE = thE - cE, cM = floor(thM), xM = thM - cM;
  // Each cycle gets its own onset and offset jitter, its own bursts, and now and then a bout that is fragmented or missed.
  const jOn = cl(gauss(ih(cE, 1, s), ih(cE, 2, s)) * 0.45, -1, 1) / TAU_NOM;
  const jOff = cl(gauss(ih(cM, 3, s), ih(cM, 4, s)) * 0.45, -1, 1) / TAU_NOM;
  const g0 = st.g0 * (1 + 0.15 * sin(t / 61 + s));
  // Each oscillator drives a bar 0.68 of the window wide, the evening one from the start and the morning one up to the
  // end, so they overlap by over a third of the window and with no gap the bout is one bar. The morning bar sits g0 later.
  const fw = 0.68 * a, o0 = X0 + jOn, e1 = X0 + fw, m0 = X0 + a - fw + g0, m1 = X0 + a + jOff + g0;
  const cvE = sstep(o0 - rw / 2, o0 + rw / 2, xE) * (1 - sstep(e1 - rw / 2, e1 + rw / 2, xE));
  const cvM = sstep(m0 - rw / 2, m0 + rw / 2, xM) * (1 - sstep(m1 - rw / 2, m1 + rw / 2, xM));
  const cv = min(1, cvE + cvM);
  if (cv < 0.002) {
    st.cv[idx] = 0;
    st.iv[idx] = 0;
    return;
  }
  const mood = 0.8 + 0.2 * vn(t / 200 + 3.1, 5, s);
  let I, fm = 1;
  {
    const hE = max(0, (xE - o0) * TAU_NOM), hM = max(0, (xM - m0) * TAU_NOM);
    const wE = cvE / (cvE + cvM + 1e-6);
    const bE = sstep(0.15, 0.85, vn(hE / 2.4 + cE * 17.3, 11, s)), bM = sstep(0.15, 0.85, vn(hM / 2.4 + cM * 17.3 + 5.5, 12, s));
    const env = (h, tot) => 0.88 + 0.12 * cos(PI * cl(h / tot, 0, 1) * 0.9);
    const aE = (0.66 + 0.34 * bE) * env(hE, st.alpha), aM = (0.66 + 0.34 * bM) * env(hM + st.alpha * 0.5, st.alpha);
    I = aE * wE + aM * (1 - wE);
    // Now and then a bout is cut short, stopping at half or two thirds of its length, and now and then one is missed.
    const cutAt = (c) => (ih(c, 21, s) < 0.06 ? (0.5 + 0.3 * ih(c, 23, s)) * st.alpha : 99);
    const hT = wE > 0.5 ? (xE - X0) * TAU_NOM : (xM - X0) * TAU_NOM, cut = wE > 0.5 ? cutAt(cE) : cutAt(cM);
    fm = 1 - sstep(cut - 0.35, cut + 0.35, hT);
    if (ih(cE, 27, s) < 0.012) fm *= 0.12;
    I *= fm * mood;
  }
  // Light holds an animal back: the bout is dimmer where the lights are on.
  I *= L === 0 ? 1 : L === 1 ? 0.74 : 0.6;
  // A fragment or a missed bout is not a dim amber, which would read brown: it goes out.
  st.cv[idx] = cv * sstep(0.1, 0.45, fm);
  st.iv[idx] = cl(I, 0, 1);
}

function recompute(st) {
  const i0 = max(0, st.nb - NB + 1);
  for (let i = i0; i < st.nb; i++) evalBin(st, i);
  st.win[0] = st.a;
  st.win[1] = st.g0;
}

// ---- one bin of the clock ---------------------------------------------------
function stepBin(st) {
  const i = st.nb, t = i * BIN, idx = i % NB;
  let reg = st.regs[st.regs.length - 1];
  if (!reg || t >= reg.t1) {
    reg = makeRegime(st, reg ? reg.t1 : t);
    st.regs.push(reg);
    if (st.regs.length > 24) st.regs.shift();
  } else if (t < reg.t0) {
    // running the record again from an earlier day
    let k = st.regs.length - 1;
    while (k > 0 && st.regs[k].t0 > t) k--;
    reg = st.regs[k];
  }
  const hod = t - 24 * floor(t / 24);
  let L = 0, Lg = 0;
  const ty = reg.type;
  if (ty === "ld" || ty === "shift") {
    if ((hod - reg.on + 48) % 24 < reg.p) (L = 1), (Lg = 1);
  } else if (ty === "skel") {
    const d = (hod - reg.on + 48) % 24;
    if (d < 1.5 || (d >= reg.p - 1.5 && d < reg.p)) (L = 1), (Lg = SKEL_GAIN);
  } else if (ty === "ll") (L = 1), (Lg = 1);
  const thE = st.thE, thM = st.thM;
  const xE = thE - floor(thE) - X0, xM = thM - floor(thM) - X0;
  if (ty === "pulse") {
    for (const pu of reg.pulses) {
      if (pu.t < 0 && t >= reg.t0 + pu.d * 24) {
        const d = (((xE - pu.phi + 1.5) % 1) + 1) % 1 - 0.5;
        if (d >= 0 && d < 0.0055) pu.t = t;
      }
      if (pu.t >= 0 && t >= pu.t && t < pu.t + pu.dur) (L = 2), (Lg = PULSE_GAIN);
    }
  }
  st.lt[idx] = L;
  st.tE[idx] = thE;
  st.tM[idx] = thM;
  evalBin(st, i);

  st.Lc += ((L ? 1 : 0) - st.Lc) * (BIN / 36);
  const Lc = st.Lc;
  const wbar = mix(1 / (st.tau + LAMBDA * Lc), st.wll, sstep(0.85, 0.97, Lc)) + 0.00012 * (vn(t / 40, 9, st.seed) - 0.5) * 2;
  const rho = DET_DD + DET_LL * sstep(0.62, 0.95, Lc);
  const ge = cl(thE - thM, -0.3, 0.7);
  const spring = st.c * (ge + 25 * ge * ge * ge);
  // A bright light saturates the delays sooner than the advances.
  const sat = 1 / (1 + 0.18 * max(0, Lg - 1));
  let zE = prc(xE), zM = prc(xM);
  if (zE < 0) zE *= sat;
  if (zM < 0) zM *= sat;
  st.thE = thE + (wbar + rho / 2 - spring / 2 + GAIN * zE * Lg) * BIN;
  st.thM = thM + (wbar - rho / 2 + spring / 2 + GAIN * zM * Lg) * BIN;
  st.nb++;
}

function ensure(st, dt) {
  st.acc += dt;
  while (st.acc >= BIN) {
    st.acc -= BIN;
    stepBin(st);
  }
}

// A turn of Tau or Split changes how the clock ran, so the record is run again from its oldest day with the same
// regimes and the same noise, and it all leans or splits at once instead of a day a second from the bottom.
function resim(st) {
  const end = st.nb, keep = st.acc, i0 = max(0, end - (NB - 2 * BPD)), t0 = i0 * BIN;
  st.thE = st.tE[i0 % NB];
  st.thM = st.tM[i0 % NB];
  let lc = 0, n = 0;
  for (let i = max(0, i0 - 288); i < i0; i++, n++) if (st.lt[i % NB]) lc++;
  st.Lc = n ? lc / n : 0;
  for (const r of st.regs) if (r.pulses && r.t1 > t0) for (const pu of r.pulses) if (pu.t < 0 || pu.t >= t0) pu.t = -1;
  st.nb = i0;
  st.acc = 0;
  while (st.nb < end) stepBin(st);
  st.acc = keep;
  st.win[0] = st.a;
  st.win[1] = st.g0;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  derive(st);
  if (!st.init) {
    st.init = true;
    // The initial pair of oscillators sit where the coupling would hold them.
    st.thM = st.thE - st.c * 0 - DET_DD / st.c;
    for (let n = 0; n < PRE_DAYS * BPD; n++) stepBin(st);
    st.win[0] = -1;
  }
  if (st.simTau < 0) (st.simTau = st.tau), (st.simC = st.c);
  else if ((abs(st.tau - st.simTau) > 0.01 || abs(Math.log(st.c / st.simC)) > 0.04) && st.clock - st.lastSim > 0.15) {
    st.simTau = st.tau;
    st.simC = st.c;
    st.lastSim = st.clock;
    resim(st);
  }
  if (abs(st.win[0] - st.a) > 0.0008 || abs(st.win[1] - st.g0) > 0.0006) recompute(st);
  st.clock += cl(dt || 0, 0, 0.1);
  ensure(st, cl(dt || 0, 0, 0.1) * 24 * DAY_PER_S);
}

// ---- drawing ----------------------------------------------------------------
function blur(src, dst, tmp) {
  // two passes of a 5 wide box, horizontally then vertically
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += src[o + cl(x + k, 0, W - 1)];
      tmp[o + x] = s / 5;
    }
  }
  for (let x = 0; x < W; x++)
    for (let y = 0; y < H; y++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += tmp[cl(y + k, 0, H - 1) * W + x];
      dst[y * W + x] = s / 5;
    }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = st.k[0];
  if (abs(hue - st.hue) > 1e-4) (st.hue = hue), buildLut(st.lut, hue);
  const lut = st.lut;
  // The record is drawn from a clock hour that wanders a few hours back and forth over minutes, as if the plot's origin
  // were slid along; the data are the same and every row keeps its 24 hours.
  const t = st.clock, dl = PAN1 * sin((2 * PI * t) / PAN1_T + st.ph[0]) + PAN2 * sin((2 * PI * t) / PAN2_T + st.ph[1]), dlb = dl / BIN;
  const nb = st.nb, q = ((nb + st.acc / BIN) * BIN - dl) / 24, D = floor(q), f = q - D;
  const rc = st.rc, ri = st.ri, rv = st.rv, rp = st.rp;
  // the rows: day D-64 + k on the left, the day after it on the right
  for (let k = 0; k < ROWS; k++) {
    const r = D - 64 + k;
    for (let x = 0; x < W; x++) {
      // the window of 6 bins starts part way into a bin: the bins either side share it
      const s0 = r * BPD + dlb + x * CB, b0 = floor(s0), fr = s0 - b0;
      let sc = 0, si = 0, sv = 0, sp = 0;
      for (let j = 0; j <= CB; j++) {
        const b = b0 + j;
        if (b < 0 || b >= nb || b < nb - NB) continue;
        const wt = j === 0 ? 1 - fr : j === CB ? fr : 1;
        const idx = b % NB, c = st.cv[idx], l = st.lt[idx];
        sc += c * wt;
        si += c * st.iv[idx] * wt;
        if (l) sv += wt;
        if (l === 2) sp += wt;
      }
      const o = k * W + x;
      rc[o] = sc / CB;
      ri[o] = sc > 1e-4 ? si / sc : 0;
      rv[o] = sv / CB;
      rp[o] = sp / CB;
    }
  }
  const pc = st.pc, pi = st.pi, pv = st.pv, pp = st.pp, ps = st.ps;
  for (let y = 0; y < H; y++) {
    const pos = y * 0.5 + f, k0 = floor(pos), uu = pos - k0;
    let w0 = 1, k1 = k0;
    if (uu + 0.5 > 1) {
      w0 = (1 - uu) / 0.5;
      k1 = k0 + 1;
    }
    const w1 = 1 - w0, s = st.seam[floor(uu * 64) & 63], o0 = k0 * W, o1 = k1 * W;
    for (let x = 0; x < W; x++) {
      const c0 = rc[o0 + x], c1 = rc[o1 + x], c = w0 * c0 + w1 * c1, p = y * W + x;
      pc[p] = c;
      pi[p] = c > 1e-4 ? (w0 * c0 * ri[o0 + x] + w1 * c1 * ri[o1 + x]) / c : 0;
      pv[p] = w0 * rv[o0 + x] + w1 * rv[o1 + x];
      pp[p] = w0 * rp[o0 + x] + w1 * rp[o1 + x];
      ps[p] = s;
    }
  }
  const src = st.gt;
  for (let p = 0; p < W * H; p++) src[p] = pc[p] * (0.35 + 0.65 * pi[p]);
  blur(src, st.gl, st.tmp);
  const gl = st.gl;
  const gc = [0, 0, 0];
  hsv(0.02 + hue, 0.5, 1, gc, 0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      // the ground, the veil of the lights, and the brighter veil of a pulse
      const q = pp[p], v = max(0, pv[p] - q) * VEIL_A, u = q * PULSE_A, gw = gl[p] * 0.55 * (1 - pc[p]), g0 = 1 - v - u;
      let r = GROUND[0] * g0 + VEIL[0] * v + PULSE[0] * u + gc[0] * gw;
      let g = GROUND[1] * g0 + VEIL[1] * v + PULSE[1] * u + gc[1] * gw;
      let b = GROUND[2] * g0 + VEIL[2] * v + PULSE[2] * u + gc[2] * gw;
      const c = sstep(0.1, 0.9, pc[p]);
      if (c > 0.002) {
        const li = floor(cl(pi[p], 0, 1) * (NL - 1) + 0.5) * 3, sm = ps[p];
        r = r * (1 - c) + lut[li] * sm * c;
        g = g * (1 - c) + lut[li + 1] * sm * c;
        b = b * (1 - c) + lut[li + 2] * sm * c;
      }
      display.setPixel(x, y, cl(r + 0.5, 0, 255) | 0, cl(g + 0.5, 0, 255) | 0, cl(b + 0.5, 0, 255) | 0);
    }
}
