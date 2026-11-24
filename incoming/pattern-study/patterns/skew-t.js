// ===== Patternflow pattern =====
// Title:   Skew-T
// Family:  skewt
// Idea:    A radiosonde chart stands on the panel, log pressure down the 128 rows and temperature skewed 45 degrees to the right, an amber air temperature curve and a teal dew point curve wandering over a faint grid, a white parcel lifted from the ground along the dry adiabat to its condensation level and along the moist adiabat above it, the area where the parcel is warmer than the air filled rose (CAPE) and where it is colder filled blue-violet (CIN), and bright beads that climb the path faster the more CAPE there is and spread flat like an anvil where their energy runs out.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Skew-T log-P diagram (Norman Herlofson, 1947, from memory), parcel theory with CAPE and CIN, dry adiabats from Poisson's equation, a pseudo-adiabatic moist adiabat integrated from the saturation vapour pressure of Bolton (1980, from memory), pattern round 236
// Round:   236
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Heat=0..4, Dryness=-1..1, Cap=-1..1
//
// Knob 1: Hue. Turns the palette round the wheel. At 0 the air temperature is amber, the dew point teal, the parcel white, the CAPE area rose and the CIN area blue-violet. The grid and the haze behind it only sway about their cool hues, so they never turn brown.
// Knob 2: Heat. 0 to 4, opening at 2. Moves the surface temperature up to 5 K either way (the weather alone carries it between about 15 and 35 C) and the lapse rate of the lowest layer from about 7 K/km at 0 to 9 K/km at 4, near the 9.8 of a dry adiabat. At 4 the parcel leaves the ground beside the air curve and the CAPE area is large; at 0 it starts cold against a stable layer and the area often vanishes.
// Knob 3: Dryness. -1 to 1, opening at 0. The gap between surface temperature and dew point, under about 6 K at -1 and over 13 K at 1 (1 to 20 K in all, and never a dew point above 24 C). The condensation level climbs from a few hundred metres at -1 to 2 km at 1, the dew point curve moves about 18 LEDs away from the air curve, and the CAPE area shrinks with it.
// Knob 4: Cap. -1 to 1, opening near 0. The strength and height of the inversion above the ground: at -1 it is under 2 K at 1.2 km and the beads run straight up; at 1 it is a kink of 16 to 20 K at 3 km (about 700 hPa) with a blue-violet CIN area under it, a dry slot in the dew point curve above it, and the beads flatten against its underside.

const W = 64, H = 128, NPX = W * H, NR = 128;
const { floor, ceil, min, max, abs, round, exp, log, pow, sqrt, sin, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A dim colour on the red-orange-yellow stretch of the wheel reads brown, so it is lifted and paled there.
function dim(h, s, v, out, o) {
  const c = frac(h), b = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.12, 0.2, c);
  hsv(h, s * (1 - 0.3 * b), min(1, v * (1 + 0.6 * b)), out, o);
}

// ---- the chart ------------------------------------------------------------
// Row r counts up from the bottom row. Pressure falls from 1050 to 100 hPa over the 128 rows on a
// log scale, and the temperature axis is skewed 1 LED to the right for every row up, which is
// 45 degrees on the panel: the isotherms are those lines.
const SX = 1.3;        // LEDs per kelvin along a row
const XO = 42;         // the x of 20 C on the bottom row
const LNR = log(10.5); // ln(1050 / 100)
const DL = LNR / NR;   // ln p per row
const P = new Float64Array(NR);
for (let r = 0; r < NR; r++) P[r] = 100 * exp((LNR * (NR - r - 0.5)) / NR);
const xOf = (tc, r) => XO + SX * (tc - 20) + r;
const yc = (r) => 127.5 - r;

// ---- the thermodynamics ---------------------------------------------------
const RD = 287, CP = 1005, KAP = RD / CP, LV = 2.5e6, EPS = 0.622;
const CAPE_PER_K = RD * DL; // J/kg that one kelvin of buoyancy gives over one row
// Saturation vapour pressure over water in hPa (Bolton 1980), T in C, and its inverse.
const esat = (tc) => 6.112 * exp((17.67 * tc) / (tc + 243.5));
const tOfE = (e) => {
  const l = log(e / 6.112);
  return (243.5 * l) / (17.67 - l);
};
// The pseudo-adiabatic lapse in kelvin per unit of ln p at T (K) and p (hPa).
const dTdlnp = (tk, p) => {
  const e = esat(tk - 273.15), rs = (EPS * e) / (p - e);
  return (RD * tk + LV * rs) / (CP + (LV * LV * rs * EPS) / (RD * tk * tk));
};
// Climb a saturated parcel from p0 to p1 (< p0) in midpoint steps of about 0.012 in ln p.
function moistTo(tk, p0, p1) {
  const n = max(1, ceil(log(p0 / p1) / 0.012)), h = log(p1 / p0) / n;
  let p = p0, t = tk;
  for (let i = 0; i < n; i++) {
    const k1 = dTdlnp(t, p), k2 = dTdlnp(t + 0.5 * h * k1, p * exp(0.5 * h));
    t += h * k2;
    p *= exp(h);
  }
  return t;
}

// ---- the faint grid, built once ------------------------------------------
// Write the line through the row centres xs[r0..r1] into buf, each pixel keeping the largest
// coverage it gets: a line of width 2 rad with soft edges, fade[r] scaling it along the way.
function stroke(buf, xs, r0, r1, rad, fade) {
  for (let r = r0; r < r1; r++) {
    const xa = xs[r], xb = xs[r + 1];
    const ya = yc(r), yb = ya - 1;
    const lo = min(xa, xb) - rad - 0.5, hi = max(xa, xb) + rad + 0.5;
    if (hi < 0 || lo > W) continue;
    const fa = fade ? fade[r] : 1, fb = fade ? fade[r + 1] : 1;
    if (fa <= 0 && fb <= 0) continue;
    const px0 = max(0, floor(lo)), px1 = min(W - 1, floor(hi));
    const py0 = max(0, floor(yb - rad - 0.5)), py1 = min(H - 1, floor(ya + rad + 0.5));
    const dx = xb - xa, dy = yb - ya, l2 = dx * dx + dy * dy;
    for (let py = py0; py <= py1; py++) {
      const cy = py + 0.5 - ya;
      for (let px = px0; px <= px1; px++) {
        const cx = px + 0.5 - xa;
        const t = cl((cx * dx + cy * dy) / l2, 0, 1);
        const ex = cx - t * dx, ey = cy - t * dy;
        const c = cl(rad + 0.5 - sqrt(ex * ex + ey * ey), 0, 1) * (fa + (fb - fa) * t);
        const o = py * W + px;
        if (c > buf[o]) buf[o] = c;
      }
    }
  }
}

function buildGrid() {
  const g = { iso: new Float32Array(NPX), dry: new Float32Array(NPX), mix: new Float32Array(NPX), moi: new Float32Array(NPX) };
  const tmp = new Float32Array(NPX), xs = new Float64Array(NR);
  // dash = [period, on, offset] in rows: a dashed line is cut by the cell.
  const put = (layer, level, r0, r1, dash) => {
    tmp.fill(0);
    stroke(tmp, xs, r0, r1, 0.5, null);
    for (let y = 0; y < H; y++) {
      if (dash && (y + dash[2]) % dash[0] >= dash[1]) continue;
      for (let x = 0, o = y * W; x < W; x++, o++) if (tmp[o] * level > layer[o]) layer[o] = tmp[o] * level;
    }
  };
  // Isotherms every 10 C, the freezing one stronger.
  for (let t = -130; t <= 60; t += 10) {
    for (let r = 0; r < NR; r++) xs[r] = xOf(t, r);
    put(g.iso, t === 0 ? 1 : 0.7, 0, NR - 1, null);
  }
  // Dry adiabats every 10 K of potential temperature: T = theta (p / 1000)^0.2857.
  for (let th = 220; th <= 660; th += 10) {
    for (let r = 0; r < NR; r++) xs[r] = xOf(th * pow(P[r] / 1000, KAP) - 273.15, r);
    put(g.dry, 0.8, 0, NR - 1, null);
  }
  // Saturation mixing ratio lines in g/kg, dotted, up to 570 hPa.
  const rEnd = floor((NR * log(1041 / 570)) / LNR);
  [1, 2, 4, 7, 11, 16, 24].forEach((gk, i) => {
    const rr = gk / 1000;
    for (let r = 0; r <= rEnd; r++) xs[r] = xOf(tOfE((rr * P[r]) / (EPS + rr)), r);
    put(g.mix, 1, 0, rEnd, [5, 3, i]);
  });
  // Moist adiabats from 1000 hPa every 8 K of wet-bulb potential temperature.
  for (let tw = -8; tw <= 40; tw += 8) {
    let tk = tw + 273.15;
    xs[2] = xOf(tw, 2);
    for (let r = 3; r < NR; r++) {
      tk = moistTo(tk, P[r - 1], P[r]);
      xs[r] = xOf(tk - 273.15, r);
    }
    put(g.moi, 0.9, 2, NR - 1, [8, 5, 3 + (tw >> 3)]);
  }
  return g;
}

// ---- the wandering weather ------------------------------------------------
// Seven slow variables, each a sum of three sines whose periods share no factor plus a mean-reverting
// random walk, run through tanh. Their u runs from -1 to 1.
const OU_SD = 0.75;
const WV = [
  { p: [116, 207, 389], tau: 150 }, // 0 air mass: the surface temperature
  { p: [149, 266, 485], tau: 180 }, // 1 the gap between surface temperature and dew point
  { p: [97, 188, 356], tau: 130 },  // 2 the lapse rate of the lowest layer
  { p: [160, 308, 569], tau: 170 }, // 3 cap strength
  { p: [190, 356, 695], tau: 210 }, // 4 cap height
  { p: [217, 450, 866], tau: 250 }, // 5 tropopause height
  { p: [139, 245, 417], tau: 160 }, // 6 the instability of the middle troposphere
];
const SINE_A = [0.3, 0.25, 0.2];

// Layers that rise through the chart at their own speeds. A layer that passes the top is made
// again below the ground with a new strength, so no frame comes back.
const strong = () => 1.8 * tanh(gauss() / 1.8);
function layers(n, span, speed, width, make) {
  const z = Float64Array.from({ length: n }, (_, i) => -2 + (span / n) * i + Math.random() * 0.4);
  return { n, span, speed, width, make, z, a: Float64Array.from({ length: n }, make), v: Float64Array.from({ length: n }, () => 0.7 + 0.6 * Math.random()) };
}
function rise(L, d) {
  for (let i = 0; i < L.n; i++) {
    L.z[i] += L.speed * L.v[i] * d;
    if (L.z[i] > L.span - 2) (L.z[i] -= L.span), (L.a[i] = L.make());
  }
}
// The sum of the layers' bumps at height z (km).
function bumps(L, z) {
  let s = 0;
  for (let j = 0; j < L.n; j++) s += L.a[j] * exp(-0.5 * ((z - L.z[j]) / L.width) ** 2);
  return s;
}
const T_AMP = 5.6, D_AMP = 10; // kelvin of one layer of air temperature, and of dew point gap

function newWeather() {
  return {
    ph: WV.map(() => [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU]),
    ou: WV.map(() => gauss() * OU_SD),
    u: new Float64Array(WV.length),
    LT: layers(10, 18, 0.14, 1, strong),                  // layers of warm and cold air
    LD: layers(8, 12, 0.11, 0.8, strong),                 // layers of dry and moist air
    LP: layers(9, 16, 0.32, 0.9, Math.random),            // pulses of light in the filled areas
    LH: layers(10, 18, 0.12, 0.6, () => Math.random() ** 0.7), // bands of haze
    F: 0, Ft: 0, nextFront: 20 + Math.random() * 30,
  };
}

function weatherAt(wx, t) {
  for (let i = 0; i < WV.length; i++) {
    const p = WV[i].p, ph = wx.ph[i];
    let x = wx.ou[i];
    for (let k = 0; k < 3; k++) x += SINE_A[k] * sin((TAU * t) / p[k] + ph[k]);
    wx.u[i] = tanh(1.1 * x);
  }
}

function stepWeather(wx, t, d) {
  for (let i = 0; i < WV.length; i++) {
    const tau = WV[i].tau;
    wx.ou[i] += -wx.ou[i] * (d / tau) + OU_SD * sqrt(2 / tau) * sqrt(d) * gauss();
  }
  rise(wx.LT, d); rise(wx.LD, d); rise(wx.LP, d); rise(wx.LH, d);
  // A front: a jump of the low layer's temperature, up or down, that then fades away.
  if (t >= wx.nextFront) {
    wx.Ft += (Math.random() < 0.5 ? -1 : 1) * (3.5 + Math.random() * 5);
    wx.nextFront = t + 40 + Math.random() * Math.random() * 160;
  }
  wx.Ft *= exp(-d / 70);
  wx.F += (wx.Ft - wx.F) * (1 - exp(-d / 8));
  weatherAt(wx, t);
}

// Turn the weather and the knobs into the numbers that shape the sounding.
function shape(wx, k, out) {
  const u = wx.u;
  const h = cl((k[1] - 2) / 2, -1, 1), m = cl(k[2], -1, 1), q = cl(k[3], -1, 1);
  out.Ts0 = 25 + 8 * cl(0.85 * u[0] + 0.62 * h, -1.25, 1.25);
  out.F = wx.F;
  out.G1 = 8.1 + 1.5 * cl(0.55 * u[2] + 0.7 * h, -1, 1);
  // The dew point does not go over 24 C, so on a hot day the gap cannot be small.
  out.Dep = max(1 + 19 * pow(0.5 + 0.5 * cl(0.5 * u[1] + 0.8 * m, -1, 1), 1.15), out.Ts0 + 0.55 * out.F - 24);
  out.dcap = 20 * pow(0.5 + 0.5 * cl(0.35 * u[3] + q, -1, 1), 1.3);
  out.zc = 1 + 2.4 * (0.5 + 0.5 * cl(0.35 * u[4] + 0.85 * q, -1, 1));
  out.ztp = 15.2 + 1.5 * u[5];
  // The air at 8 km follows the ground's warmth, and u[6] adds or takes away instability.
  out.Ta = -27 + 0.6 * (out.Ts0 - 25) - (4.8 + 5.5 * u[6]);
}

// Air temperature, dew point and parcel temperature at every row, and what they say.
function sounding(st, s) {
  const { Te, Td, Tp, Zk, dd, wx } = st;
  const Ts = s.Ts0 + s.F, zc = s.zc, hc = 0.5 + 0.03 * s.dcap;
  // The low layer cools at G1 up to the top of the mixed layer, 1.3 km at most; above it the air
  // runs in a straight line to its temperature at 8 km, then cools at 6.4 K/km up to the tropopause.
  const zp = min(zc, 1.3), T1 = s.Ts0 - s.G1 * zp;
  const G2 = cl((T1 - s.Ta) / (8 - zp), 3, 8.4), G3 = 6.4, GS = -2;
  const lapse = (z) =>
    s.G1 + (G2 - s.G1) * sstep(zp - 0.2, zp + 0.5, z) + (G3 - G2) * sstep(7.4, 8.6, z) + (GS - G3) * sstep(s.ztp - 0.6, s.ztp + 0.8, z);
  // Above the cap the air is drier by a jump that grows with the cap.
  const depUp = s.Dep + 1.5 + 1.25 * s.dcap, depHi = depUp + 4 + 0.2 * s.Dep;
  let tb = s.Ts0, z = 0;
  for (let r = 0; r < NR; r++) {
    // The cap is an inversion that lifts the air temperature by dcap and gives it back over a few
    // km; the air above it runs cooler the stronger it is, as it does under a deep cap.
    const bump = s.dcap * sstep(zc, zc + hc, z) * (1 - sstep(zc + hc + 0.2, zc + hc + 3 + 0.22 * s.dcap, z));
    const eml = -0.55 * s.dcap * sstep(zc + 1, zc + 6, z) * (1 - sstep(8, 11, z));
    const fz = sstep(0, 1.8, z), wf = 1 - sstep(1.5, 7, z);
    Te[r] = tb + bump + eml + s.F * wf + T_AMP * bumps(wx.LT, z) * fz;
    Zk[r] = z;
    const dep = s.Dep + (depUp - s.Dep) * sstep(zc - 0.1, zc + 0.9, z) + (depHi - depUp) * sstep(zc + 1, 8.5, z) + D_AMP * bumps(wx.LD, z) * fz;
    Td[r] = Te[r] - max(1, dep);
    if (r < NR - 1) {
      const dz0 = 0.0005374 * (tb + 273.15);
      const t1 = tb - lapse(z + 0.5 * dz0) * dz0;
      const dz = 0.0005374 * (0.5 * (tb + t1) + 273.15);
      tb -= lapse(z + 0.5 * dz) * dz;
      z += dz;
    }
  }
  // The parcel: dry adiabat from the ground to the condensation level (Bolton 1980), then moist.
  const tk = Ts + 273.15, tdk = Td[0] + 273.15;
  const tl = 1 / (1 / (tdk - 56) + log(tk / tdk) / 800) + 56;
  const pl = P[0] * pow(tl / tk, 1 / KAP);
  let pm = pl, tm = tl, lcl = 0;
  for (let r = 0; r < NR; r++) {
    if (P[r] >= pl) {
      Tp[r] = tk * pow(P[r] / P[0], KAP) - 273.15;
      lcl = r;
    } else {
      tm = moistTo(tm, pm, P[r]);
      pm = P[r];
      Tp[r] = tm - 273.15;
    }
    dd[r] = Tp[r] - Te[r];
  }
  // Runs where the parcel is warmer than the air: the biggest is the convective layer, from its
  // level of free convection (lfc) to its equilibrium level (el). CAPE and CIN are in J/kg.
  let bestA = 0, lfc = -1, el = -1, a = 0, r0 = -1;
  for (let r = 1; r <= NR; r++) {
    if (r < NR && dd[r] > 0.08) {
      if (r0 < 0) (r0 = r), (a = 0);
      a += CAPE_PER_K * dd[r];
    } else if (r0 >= 0) {
      if (a > bestA) (bestA = a), (lfc = r0), (el = r - 1);
      r0 = -1;
    }
  }
  let cin = 0;
  for (let r = 1; r < (lfc < 0 ? NR : lfc); r++) if (dd[r] < 0) cin -= CAPE_PER_K * dd[r];
  s.lcl = lcl + (pl < P[0] ? log(P[lcl] / pl) / DL : 0);
  s.lfc = lfc; s.el = el; s.cape = bestA; s.cin = cin;
}

// ---- setup and update -----------------------------------------------------
export function setup(params) {
  const f = (n, T) => new T(n);
  params.st = {
    k: [0, 2, 0, 0.06], t: 0, init: false,
    wx: newWeather(), s: { lcl: 0, lfc: -1, el: -1, cape: 0, cin: 0 },
    Te: f(NR, Float64Array), Td: f(NR, Float64Array), Tp: f(NR, Float64Array), Zk: f(NR, Float64Array), dd: f(NR, Float64Array),
    xe: f(NR, Float64Array), xd: f(NR, Float64Array), xp: f(NR, Float64Array),
    fadeP: f(NR, Float32Array), fadeD: f(NR, Float32Array), fadeC: f(NR, Float32Array),
    grid: buildGrid(), gridKey: '', gR: f(NPX, Float32Array), gG: f(NPX, Float32Array), gB: f(NPX, Float32Array),
    R: f(NPX, Float32Array), G: f(NPX, Float32Array), B: f(NPX, Float32Array), cov: f(NPX, Float32Array),
    beads: [], spawnIn: 0.5, col: f(12, Float32Array),
  };
}

// How good an opening this weather makes: a convective layer of about 2000 J/kg with a cap to fight.
function score(s) {
  if (s.el < 0 || s.lfc < 0) return -9;
  const a = abs(log((s.cape + 150) / 2000));
  const b = s.cin < 15 ? (15 - s.cin) / 30 : s.cin > 120 ? (s.cin - 120) / 120 : 0;
  return -a - b - (s.lcl < 3 ? 0.3 : 0);
}

function prepare(st) {
  const s = st.s;
  shape(st.wx, st.k, s);
  sounding(st, s);
  // A hot moist ground alone can give 10000 J/kg. Warm the air aloft until the area is under 4600.
  const c = s.cape;
  if (c > 2400) {
    s.Ta += (c - (2400 + 2200 * tanh((c - 2400) / 2200))) / 230;
    sounding(st, s);
  }
  const { xe, xd, xp, Te, Td, Tp } = st;
  for (let r = 0; r < NR; r++) {
    xe[r] = xOf(Te[r], r);
    xd[r] = xOf(Td[r], r);
    xp[r] = xOf(Tp[r], r);
  }
  // The dew point line may not run flatter than 2.2 LEDs a row, or the edge of a dry layer draws a bar.
  for (let r = 1; r < NR; r++) xd[r] = cl(xd[r], xd[r - 1] - 2.2, xd[r - 1] + 2.2);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], cl(kv[1], 0, 4), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  if (!st.init) {
    st.init = true;
    // Try 52 weathers with the knobs at their opening places and open on the best. The knobs then
    // act on that weather, so each one shows what it does from the same start.
    const kept = st.k;
    st.k = [0, 2, 0, 0.06];
    let best = null, bs = -1e9;
    for (let n = 0; n < 52; n++) {
      st.wx = newWeather();
      weatherAt(st.wx, 0);
      prepare(st);
      const sc = score(st.s);
      if (sc > bs) (bs = sc), (best = st.wx);
    }
    st.wx = best;
    st.k = kept;
  }
  const d = cl(dt || 0, 0, 0.1);
  st.t += d;
  stepWeather(st.wx, st.t, d);
  prepare(st);
  stepBeads(st, d);
}

// ---- the beads ------------------------------------------------------------
// A bead is a parcel with some energy E (J/kg) from the heating of the ground. It gains 5.27 J/kg
// for each kelvin of buoyancy in each row, climbs 7 rows a second plus 0.45 for each metre a
// second of its speed sqrt(2 E), and stops where E runs out: under the cap, or just above the
// equilibrium level. Then it spreads flat for a few seconds and goes.
function stepBeads(st, d) {
  const dd = st.dd, beads = st.beads;
  st.spawnIn -= d;
  let rising = 0;
  for (const b of beads) if (b.state === 0) rising++;
  if (st.spawnIn <= 0 && rising < 2) {
    beads.push({ s: 0, E: 10 + 170 * pow(Math.random(), 1.6), Emax: 0, state: 0, age: 0 });
    st.spawnIn = 0.9 + Math.random() * 1.8;
  }
  for (let i = beads.length - 1; i >= 0; i--) {
    const b = beads[i];
    if (b.state === 0) {
      let left = d * (7 + 0.45 * min(70, sqrt(2 * b.E)));
      while (left > 1e-6 && b.state === 0) {
        const ds = min(left, 0.5);
        const r = min(NR - 2, floor(b.s)), f = b.s - r;
        b.E += CAPE_PER_K * (dd[r] + (dd[r + 1] - dd[r]) * f) * ds;
        b.s += ds;
        left -= ds;
        if (b.E > b.Emax) b.Emax = b.E;
        if (b.E <= 0 || b.s >= NR - 1.5) (b.state = 1), (b.age = 0), (b.E = 0);
      }
    } else {
      b.age += d;
      if (b.age > 6.5) beads.splice(i, 1);
    }
  }
}

// ---- drawing --------------------------------------------------------------
// The grid's colour for this hue, summed once into the three planes the frame starts from.
function buildBase(st, hue) {
  const key = hue.toFixed(3);
  if (key === st.gridKey) return;
  st.gridKey = key;
  const g = st.grid, col = st.col;
  // The grid and the haze only sway about their cool hues as Hue turns, so they never go brown.
  const hg = 0.12 * sin(TAU * hue);
  dim(0.6 + hg, 0.42, 0.27, col, 0);
  dim(0.78 + hg, 0.4, 0.23, col, 3);
  dim(0.47 + hg, 0.55, 0.27, col, 6);
  dim(0.37 + hg, 0.5, 0.23, col, 9);
  for (let o = 0; o < NPX; o++) {
    const a = g.iso[o], b = g.dry[o], c = g.mix[o], e = g.moi[o];
    st.gR[o] = min(0.4, a * col[0] + b * col[3] + c * col[6] + e * col[9]);
    st.gG[o] = min(0.4, a * col[1] + b * col[4] + c * col[7] + e * col[10]);
    st.gB[o] = min(0.4, a * col[2] + b * col[5] + c * col[8] + e * col[11]);
  }
}

// Lay the stroked line in cov over the picture in one colour.
function paint(st, cr, cg, cb) {
  const { R, G, B, cov } = st;
  for (let o = 0; o < NPX; o++) {
    const c = cov[o];
    if (c <= 0.002) continue;
    R[o] += (cr - R[o]) * c;
    G[o] += (cg - G[o]) * c;
    B[o] += (cb - B[o]) * c;
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = st.k[0], s = st.s, wx = st.wx;
  const { R, G, B, cov, xe, xd, xp, dd, Zk, fadeP, fadeD, fadeC } = st;
  buildBase(st, hue);
  R.set(st.gR); G.set(st.gG); B.set(st.gB);

  // How far up the parcel's path and its areas are drawn: above the equilibrium level they fade out.
  const top = s.el >= 0 ? s.el : min(NR - 1, ceil(s.lcl) + 50);
  for (let r = 0; r < NR; r++) {
    fadeP[r] = 1 - sstep(top + 4, top + 14, r);
    fadeD[r] = 1 - sstep(40, 66, r);
    fadeC[r] = 1 - sstep(top + 2, top + 12, r);
  }

  // Bands of haze the width of the panel that rise through the chart, each with a strength of its
  // own, a little stronger where the air is moist, held under a cap and thin above it.
  const hz = [0, 0, 0], moist = exp(-(s.Dep - 1) / 14), cp = s.dcap / 20;
  for (let r = 0; r < NR; r++) {
    const z = Zk[r];
    const lid = 1 + 1.1 * cp * (1 - sstep(s.zc - 0.4, s.zc + 0.4, z)) - 0.6 * cp * sstep(s.zc, s.zc + 1.5, z);
    const v = 0.36 * min(1, bumps(wx.LH, z)) * lid * (0.5 + 0.5 * moist) * (0.35 + 0.65 * fadeD[r]);
    if (v < 0.01) continue;
    dim(0.58 + 0.12 * sin(TAU * hue), 0.6, v, hz, 0);
    const y = 127 - r;
    for (let x = 0; x < W; x++) {
      const k = 0.55 + 0.45 * sin((PI * (x + 0.5)) / W), o = y * W + x;
      R[o] += hz[0] * k; G[o] += hz[1] * k; B[o] += hz[2] * k;
    }
  }

  // The areas, a row at a time between the air curve and the parcel's path: rose where the parcel is
  // warmer than the air, blue-violet where it is colder. Pulses of light rise through them.
  const rose = [0, 0, 0], viol = [0, 0, 0];
  for (let r = 0; r < NR; r++) {
    const d = dd[r];
    if (abs(d) < 0.06) continue;
    const xa = min(xe[r], xp[r]), xb = max(xe[r], xp[r]);
    if (xb < 0 || xa > W) continue;
    const mod = 0.85 + 0.6 * min(1, 1.1 * bumps(wx.LP, Zk[r]));
    let c, al;
    if (d > 0) {
      dim(0.965 + hue, 0.58, (0.38 + 0.08 * min(1, d / 5)) * mod, rose, 0);
      c = rose; al = 1;
    } else {
      dim(0.7 + hue, 0.72, (0.42 + 0.1 * min(1, -d / 6)) * (0.85 + 0.5 * (mod - 0.85)), viol, 0);
      c = viol; al = fadeC[r];
    }
    const y = 127 - r;
    for (let x = max(0, floor(xa)); x <= min(W - 1, floor(xb)); x++) {
      const w = cl(min(x + 1, xb) - max(x, xa), 0, 1) * al;
      if (w <= 0) continue;
      const o = y * W + x;
      R[o] += (c[0] - R[o]) * w;
      G[o] += (c[1] - G[o]) * w;
      B[o] += (c[2] - B[o]) * w;
    }
  }

  // The lines, 2 LEDs wide: the dew point, then the parcel's path, then the air temperature on top.
  const lc = [0, 0, 0];
  cov.fill(0);
  stroke(cov, xd, 0, 80, 1, fadeD);
  hsv(0.49 + hue, 0.8, 0.86, lc, 0);
  paint(st, lc[0], lc[1], lc[2]);
  cov.fill(0);
  stroke(cov, xp, 0, NR - 1, 1, fadeP);
  hsv(0.12 + hue, 0.07, 0.95, lc, 0);
  paint(st, lc[0], lc[1], lc[2]);
  cov.fill(0);
  stroke(cov, xe, 0, NR - 1, 1, null);
  hsv(0.095 + hue, 0.88, 0.96, lc, 0);
  paint(st, lc[0], lc[1], lc[2]);

  // Three short ticks on the right edge at the levels of the condensation level, the level of free
  // convection and the equilibrium level.
  tick(st, s.lcl, 0.5 + hue, 0.4);
  if (s.lfc >= 0) tick(st, s.lfc, 0.12 + hue, 0.15);
  if (s.el >= 0) tick(st, s.el + 0.5, 0.985 + hue, 0.45);

  // The beads, a bright head with a short tail while they climb, and the anvils they spread into.
  for (const b of st.beads) {
    if (b.state === 0) {
      const sp = 7 + 0.45 * min(70, sqrt(2 * b.E));
      for (let k = 0; k < 7; k++) {
        const back = b.s - k * sp * 0.025;
        if (back < 0) break;
        const rr = min(NR - 2, floor(back)), ff = back - rr;
        glow(st, xp[rr] + (xp[rr + 1] - xp[rr]) * ff, yc(back), 2.2 - 0.12 * k, 1 - k * 0.13, 0.12 + hue);
      }
    } else {
      const r = min(NR - 2, floor(b.s)), bx = xp[r] + (xp[r + 1] - xp[r]) * (b.s - r);
      const sc = (0.45 + 0.55 * cl(b.Emax / 500, 0, 1)) * (0.25 + 0.75 * sstep(2, 16, b.s));
      const grow = sstep(0, 2.4, b.age), fade = sstep(0, 0.3, b.age) * (1 - sstep(2.5, 6.5, b.age));
      const a = 4 + 21 * sc * grow;
      anvil(st, bx + 0.25 * a, yc(b.s), 0.55 * a + 2, 1.25 * a + 2, 1.7 + 0.7 * grow, fade, hue);
    }
  }

  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) display.setPixel(x, y, round(min(1, R[o]) * 255), round(min(1, G[o]) * 255), round(min(1, B[o]) * 255));
}

// Blend colour c into the pixel o by k.
function mix(st, o, c, k) {
  st.R[o] += (c[0] - st.R[o]) * k;
  st.G[o] += (c[1] - st.G[o]) * k;
  st.B[o] += (c[2] - st.B[o]) * k;
}

// A tick on the right edge, 7 LEDs long and 2 rows thick, at row r.
function tick(st, r, h, sat) {
  const c = [0, 0, 0];
  dim(h, sat, 0.7, c, 0);
  for (let y = 0; y < H; y++) {
    const w = cl(1.5 - abs(yc(r) - (y + 0.5)), 0, 1);
    if (w <= 0) continue;
    for (let x = W - 7; x < W; x++) mix(st, y * W + x, c, w * (x > W - 3 ? 1 : (x - (W - 8)) / 5));
  }
}

// A round glow of radius rad, whitish.
function glow(st, cx, cy, rad, amount, h) {
  const c = [0, 0, 0];
  hsv(h, 0.1, 1, c, 0);
  for (let y = max(0, floor(cy - rad - 1)); y <= min(H - 1, floor(cy + rad + 1)); y++)
    for (let x = max(0, floor(cx - rad - 1)); x <= min(W - 1, floor(cx + rad + 1)); x++) {
      const k = cl((rad + 0.5 - sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2)) / 1.2, 0, 1) * amount;
      if (k > 0) mix(st, y * W + x, c, k);
    }
}

// A flat soft ellipse, wl wide to the left of cx, wr to the right and ry tall: the anvil.
function anvil(st, cx, cy, wl, wr, ry, amount, hue) {
  const c = [0, 0, 0];
  hsv(0.99 + hue, 0.3, 0.92, c, 0);
  for (let y = max(0, floor(cy - ry - 2)); y <= min(H - 1, floor(cy + ry + 2)); y++)
    for (let x = max(0, floor(cx - wl - 1)); x <= min(W - 1, floor(cx + wr + 1)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const k = sstep(1, 0.25, (dx / (dx < 0 ? wl : wr)) ** 2 + (dy / ry) ** 2) * amount * 0.9;
      if (k > 0) mix(st, y * W + x, c, k);
    }
}
