// ===== Patternflow pattern =====
// Title:   Amphidromic Points
// Family:  tides
// Idea:    The tide in a long narrow sea drawn as a chart of water height, where a Kelvin wave runs down one coast and its reflection comes back up the other, so the two cancel at points along the middle and the high water turns round each point like the hand of a clock, neighbouring points turning opposite ways.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: G. I. Taylor's 1922 solution for the tide in a rotating channel closed at one end, the Kelvin wave (William Thomson, 1879) trapped against a coast over a Rossby radius, William Whewell's cotidal lines and no-tide points of the 1830s, and a mixed tide of two semidiurnal constituents and one diurnal one; pattern round 207
// Round:   207
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tide=1..4, Spin=-1..1, Friction=0..1
//
// Knob 1: Hue. Turns the whole chart round the colour wheel once, keeping the pale cream of mean water and the light and dark of the water height. It opens on teal for low water and amber for high, and comes back to that at 1.
// Knob 2: Tide. How fast the sea rises and falls, from a 16 second tide at 1 through 8 seconds at the opening 2 to 4 seconds at 4. A faster tide is a shorter wave, so the half wavelength between neighbouring points goes from about 100 LEDs to about 25 and the points crowd in from the ends.
// Knob 3: Spin. The turning of the Earth, as the Rossby radius that traps the wave against its coast. At -1 there is no spin and the sea is a plain standing wave, bands across the channel with no points. The opening 0 traps the tide to about 24 LEDs off each coast, and at 1 to about 11, with pale water down the middle and crisp pinwheels.
// Knob 4: Friction. How much of the wave comes back from the closed end. At 0 nearly all of it does and the points sit on the centreline with no tide at all. At 1 about a tenth returns, the points slide some 25 LEDs toward the right coast into its foam and the tide there fades, while the wave runs down the left coast almost alone.

const W = 64;
const H = 128;
const { floor, exp, sin, cos, abs, min, max, pow, sqrt, atan2, round, PI, log } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const XL = 2.5; // the left coast, where the wave runs down at full height
const XRC = 61.5; // the right coast, where its reflection runs back up
const SPEED = 12.5; // wave speed, LEDs a second
const W0 = 0.39; // tide frequency in rad/s for each unit of K2
const NT = 256;

// Water height to colour, as OKLCH stops (e, lightness, chroma, hue in degrees):
// indigo and blue and teal for low water, pale aqua then cream at mean level,
// pale amber and amber and rose for high water.
const STOPS = [
  [-1.0, 0.34, 0.14, 281],
  [-0.72, 0.47, 0.14, 258],
  [-0.42, 0.64, 0.115, 207],
  [-0.13, 0.87, 0.065, 197],
  [0.0, 0.955, 0.028, 95],
  [0.13, 0.915, 0.085, 82],
  [0.42, 0.83, 0.15, 70],
  [0.72, 0.72, 0.15, 26],
  [1.0, 0.63, 0.16, 352],
];
const lch = (L, C, h) => [L, C * cos((h * PI) / 180), C * sin((h * PI) / 180)];
const SP = STOPS.map((s) => [s[0], ...lch(s[1], s[2], s[3])]);
// the stops as a smooth curve in OKLab (cubic Hermite, finite-difference slopes)
const TL = new Float32Array(NT);
const TA = new Float32Array(NT);
const TB = new Float32Array(NT);
(function curve() {
  const n = SP.length;
  const tan = SP.map((p, i) => {
    const a = SP[max(0, i - 1)];
    const b = SP[min(n - 1, i + 1)];
    const d = b[0] - a[0];
    return [(b[1] - a[1]) / d, (b[2] - a[2]) / d, (b[3] - a[3]) / d];
  });
  for (let i = 0; i < NT; i++) {
    const e = -1 + (2 * i) / (NT - 1);
    let j = 0;
    while (j < n - 2 && SP[j + 1][0] <= e) j++;
    const p0 = SP[j];
    const p1 = SP[j + 1];
    const h = p1[0] - p0[0];
    const t = (e - p0[0]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const v = [0, 0, 0];
    for (let c = 0; c < 3; c++) v[c] = h00 * p0[c + 1] + h10 * h * tan[j][c] + h01 * p1[c + 1] + h11 * h * tan[j + 1][c];
    TL[i] = v[0];
    TA[i] = v[1];
    TB[i] = v[2];
  }
})();

const gam = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
const LIN = [0, 0, 0];
function oklabLin(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  LIN[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  LIN[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  LIN[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const inGamut = () => LIN[0] >= -0.001 && LIN[0] <= 1.001 && LIN[1] >= -0.001 && LIN[1] <= 1.001 && LIN[2] >= -0.001 && LIN[2] <= 1.001;
// Colour from OKLab, turned round the hue circle by rot and brought into the
// sRGB cube by shrinking its chroma (never its lightness).
function toRgb(L, a, b, rot, out, lift) {
  const cr = cos(rot);
  const sr = sin(rot);
  let a0 = a * cr - b * sr;
  let b0 = a * sr + b * cr;
  // yellow-greens turn garish at the chroma the other hues carry, so they get less
  const hh = atan2(b0, a0) * (180 / PI);
  const dg = (hh - 128 + 540) % 360 - 180;
  const tame = 1 - 0.5 * exp(-(dg * dg) / (2 * 38 * 38));
  a0 *= tame;
  b0 *= tame;
  // and a dark orange or yellow turns brown on the panel, so the water's is lifted
  if (lift) {
    const dy = (hh - 80 + 540) % 360 - 180;
    L += (1 - L) * 0.7 * cl((0.72 - L) / 0.2, 0, 1) * exp(-(dy * dy) / (2 * 42 * 42));
  }
  let f = 1;
  oklabLin(L, a0, b0);
  if (!inGamut()) {
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 9; k++) {
      const mid = (lo + hi) / 2;
      oklabLin(L, a0 * mid, b0 * mid);
      if (inGamut()) lo = mid;
      else hi = mid;
    }
    f = lo;
    oklabLin(L, a0 * f, b0 * f);
  }
  out[0] = 255 * gam(cl(LIN[0], 0, 1));
  out[1] = 255 * gam(cl(LIN[1], 0, 1));
  out[2] = 255 * gam(cl(LIN[2], 0, 1));
}

export function setup(params) {
  const S = {
    t: 0,
    first: true,
    k: [0, 2, 0, 0.06],
    sk: [0, 2, 0, 0.06],
    ph: 0.9, // semidiurnal tide phase, accumulated
    pd: 2.3, // diurnal tide phase, accumulated
    p3: 4.1, // second semidiurnal tide phase, accumulated
    om3: 0.9,
    w3: 0.4,
    dl3: 0,
    om: 0.8,
    omd: 0.4,
    wd: 0.4,
    dl: 0,
    dld: 0,
    tab: new Float32Array(NT * 3),
    tabRot: 99,
    pal: Array.from({ length: 4 }, () => [0, 0, 0]),
    a1: new Float32Array(W),
    a2: new Float32Array(W),
    shx: new Float32Array(W),
    eL: new Float32Array(H),
    eR: new Float32Array(H),
    landv: new Float32Array(H),
    cq: new Float32Array(W * 6),
    gR: new Float32Array(H),
    GR: new Float32Array(H),
  };
  for (let y = 0; y < H; y++) {
    S.eL[y] = 3.2 + 0.8 * sin((TAU * y) / 43 + 1.1) + 0.55 * sin((TAU * y) / 19 + 2.3);
    S.eR[y] = 60.8 + 0.8 * sin((TAU * y) / 37 + 0.2) + 0.55 * sin((TAU * y) / 17 + 4.0);
    S.landv[y] = 0.9 + 0.1 * sin((TAU * y) / 11 + 0.7) + 0.06 * sin((TAU * y) / 5.3);
  }
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    S.sk = S.k.slice();
    S.first = false;
  }
  const e = 1 - exp(-dt / 0.4);
  for (let i = 0; i < 4; i++) S.sk[i] += (S.k[i] - S.sk[i]) * e;
  S.t += dt;
  const t = S.t;
  const tide = cl(S.sk[1], 1, 4);
  // The semidiurnal frequency wanders, so the wavelength breathes and the points slide.
  const f1 = 1 + 0.18 * sin((TAU * t) / 71) + 0.07 * sin((TAU * t) / 43 + 1.3) + 0.045 * sin((TAU * t) / 29.3 + PI) + 0.06 * sin((TAU * t) / 263 + 0.5) + 0.05 * sin((TAU * t) / 419 + 2);
  S.om = W0 * tide * f1;
  // The diurnal constituent runs at half the frequency with a wander of its own.
  const f2 = 1 + 0.12 * sin((TAU * t) / 59 + 0.7) + 0.06 * sin((TAU * t) / 37 + 2.9) + 0.03 * sin((TAU * t) / 23.1);
  S.omd = 0.5 * W0 * tide * f2;
  S.ph = (S.ph + S.om * dt) % TAU;
  S.pd = (S.pd + S.omd * dt) % TAU;
  // a second semidiurnal constituent 9% faster: it beats against the first about every 90 seconds
  S.om3 = S.om * 1.09;
  S.p3 = (S.p3 + S.om3 * dt) % TAU;
  S.w3 = 0.3 + 0.1 * sin((TAU * t) / 157 + 0.3);
  S.dl3 = 0.024 * t + 0.5 * sin((TAU * t) / 109 + 3.1) + 0.3 * sin((TAU * t) / 47 + 1.2);
  // the weight of the diurnal part, and how late the wave comes back from the closed end
  S.wd = 0.32 + 0.12 * sin((TAU * t) / 113 + 1) + 0.07 * sin((TAU * t) / 67 + 4);
  // the closed end returns the wave a little later each minute, so the points creep up the channel
  S.dl = 0.02 * t + 0.55 * sin((TAU * t) / 97 + 0.4) + 0.35 * sin((TAU * t) / 61 + 2.2);
  S.dld = 0.013 * t + 0.5 * sin((TAU * t) / 83 + 1.9) + 0.3 * sin((TAU * t) / 53 + 0.3);
}

function palette(S, rot) {
  if (abs(S.tabRot - rot) > 1e-4) {
    const o = [0, 0, 0];
    const tab = S.tab;
    for (let i = 0; i < NT; i++) {
      toRgb(TL[i], TA[i], TB[i], rot, o, true);
      tab[i * 3] = o[0];
      tab[i * 3 + 1] = o[1];
      tab[i * 3 + 2] = o[2];
    }
    S.tabRot = rot;
  }
  const [land, land2, foam, line] = S.pal;
  const [l, a, b] = lch(0.27, 0.04, 305);
  toRgb(l, a, b, rot, land);
  const [l2, a2, b2] = lch(0.19, 0.035, 300);
  toRgb(l2, a2, b2, rot, land2);
  const [l3, a3, b3] = lch(0.985, 0.022, 95);
  toRgb(l3, a3, b3, rot, foam);
  const [l4, a4, b4] = lch(0.975, 0.045, 88);
  toRgb(l4, a4, b4, rot, line);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const t = S.t;
  const tide = cl(S.sk[1], 1, 4);
  const sp = cl(S.sk[2], -1, 1);
  const fr = cl(S.sk[3], 0, 1);
  palette(S, TAU * S.sk[0]);
  const { tab, a1, a2, shx, eL, eR, landv, gR, GR, cq } = S;
  const [LAND, LAND2, FOAM, LINE] = S.pal;

  // the Rossby radius: huge with no spin, about 24 LEDs at the opening, about 11 at full spin
  const R = 24 * exp(-0.75 * sp + (sp < 0 ? 1.6 * sp * sp : 0) + 0.2 * sin((TAU * t) / 331 + 1.1) + 0.12 * sin((TAU * t) / 197 + 2.5));
  // share of the wave that comes back, a little more or less as the sea warms and cools
  const r = min(0.99, 0.98 * exp(-2.1 * fr) * (0.92 + 0.07 * sin((TAU * t) / 277 + 0.7) + 0.05 * sin((TAU * t) / 149 + 3)));
  const k = S.om / SPEED;
  const kd = S.omd / SPEED;
  const k3 = S.om3 / SPEED;
  const w3 = S.w3;
  const dl3 = S.dl3;
  const cp3 = cos(S.p3);
  const sp3 = sin(S.p3);
  const wd = S.wd;
  const dl = S.dl;
  const dld = S.dld;
  const cph = cos(S.ph);
  const sph = sin(S.ph);
  const cpd = cos(S.pd);
  const spd = sin(S.pd);
  const norm = 1 / (1 + 0.4 * wd + 0.35 * w3);
  // size of the pale core of a no-tide point: the centreline amplitude, within limits
  const a0 = cl(0.6 * exp(-(XRC - XL) / (2 * R)), 0.05, 0.4);
  const iR = 1 / R;
  const kap = 0.16 * sin((TAU * t) / 89) + 0.1 * sin((TAU * t) / 151 + 2);
  for (let x = 0; x < W; x++) {
    a1[x] = exp(-(x + 0.5 - XL) * iR);
    a2[x] = r * exp(-(XRC - (x + 0.5)) * iR);
    shx[x] = sin((TAU * (x + 0.5)) / 37 + t / 9);
    // the line of points leans a little to one side, then to the other
    const lean = kap * (x + 0.5 - 32);
    cq[x * 6] = cos(k * lean);
    cq[x * 6 + 1] = sin(k * lean);
    cq[x * 6 + 2] = cos(kd * lean);
    cq[x * 6 + 3] = sin(kd * lean);
    cq[x * 6 + 4] = cos(k3 * lean);
    cq[x * 6 + 5] = sin(k3 * lean);
  }
  // The sea floor shoals and deepens along the channel, and its swells drift, so the
  // wave runs faster over deep water: gR is the local wavelength against the mean,
  // GR the distance in wave units from the closed end.
  const tz = TAU * t;
  let gPrev = 1;
  let sPrev = 0;
  let Gacc = 0;
  for (let y = H - 1; y >= 0; y--) {
    const sy = H - y - 0.5;
    const g = 1 / (1 + 0.25 * sin((TAU * sy) / 257 - tz / 67 + 0.4) + 0.18 * sin((TAU * sy) / 173 + tz / 41 + 2.6) + 0.12 * sin((TAU * sy) / 113 - tz / 27 + 4.4));
    Gacc += 0.5 * (gPrev + g) * (sy - sPrev);
    gPrev = g;
    sPrev = sy;
    gR[y] = g;
    GR[y] = Gacc;
  }
  const GQ = PI / 6; // twelve cotidal lines to the tide
  const gain = 1.15;
  const gnorm = 1 / Math.tanh(gain);

  for (let y = 0; y < H; y++) {
    const s = H - y - 0.5; // distance from the closed end at the bottom
    const ks = k * GR[y];
    const kl = k * gR[y];
    const c1 = cos(ks);
    const s1 = sin(ks);
    const c2 = cos(ks + dl);
    const s2 = sin(ks + dl);
    const kds = kd * GR[y];
    const d1c = cos(kds);
    const d1s = sin(kds);
    const d2c = cos(kds + dld);
    const d2s = sin(kds + dld);
    const k3s = k3 * GR[y];
    const t1c = cos(k3s);
    const t1s = sin(k3s);
    const t2c = cos(k3s + dl3);
    const t2s = sin(k3s + dl3);
    const xL = eL[y];
    const xR = eR[y];
    const lv = landv[y];
    const surfL = 0.8 + 0.2 * sin((TAU * y) / 10.3 - (TAU * t) / 3.3 + 1.4 * sin((TAU * y) / 31 + t / 7));
    const surfR = 0.8 + 0.2 * sin((TAU * y) / 8.7 - (TAU * t) / 2.9 + 1.6 * sin((TAU * y) / 27 - t / 6) + 2);
    const shy = (TAU * y) / 12.7 - (TAU * t) / 3.1;
    const shy2 = (TAU * y) / 23 + t / 5.3;
    for (let x = 0; x < W; x++) {
      const xc = x + 0.5;
      const A = a1[x];
      const B = a2[x];
      // the semidiurnal wave: the one running down the left coast and its reflection
      const o6 = x * 6;
      const q1c = cq[o6];
      const q1s = cq[o6 + 1];
      const c1p = c1 * q1c - s1 * q1s;
      const s1p = s1 * q1c + c1 * q1s;
      const c2p = c2 * q1c - s2 * q1s;
      const s2p = s2 * q1c + c2 * q1s;
      const zr = A * c1p + B * c2p;
      const zi = -A * s1p + B * s2p;
      const m2 = zr * zr + zi * zi + 1e-9;
      const amp = sqrt(m2);
      const e1 = zr * cph + zi * sph;
      // Each constituent is drawn as its phase times a range that grows with the
      // distance from its no-tide points, so the points stay pale at every spin.
      const ac1 = (1 - exp(-pow(amp / a0, 1.6))) / amp;
      const qdc = cq[o6 + 2];
      const qds = cq[o6 + 3];
      const zdr = A * (d1c * qdc - d1s * qds) + B * (d2c * qdc - d2s * qds);
      const zdi = -A * (d1s * qdc + d1c * qds) + B * (d2s * qdc + d2c * qds);
      const ampd = sqrt(zdr * zdr + zdi * zdi) + 1e-6;
      const e2 = (zdr * cpd + zdi * spd) * (1 - exp(-pow(ampd / a0, 1.6))) / ampd;
      const q3c = cq[o6 + 4];
      const q3s = cq[o6 + 5];
      const z3r = A * (t1c * q3c - t1s * q3s) + B * (t2c * q3c - t2s * q3s);
      const z3i = -A * (t1s * q3c + t1c * q3s) + B * (t2s * q3c + t2c * q3s);
      const amp3 = sqrt(z3r * z3r + z3i * z3i) + 1e-6;
      const e3 = (z3r * cp3 + z3i * sp3) * (1 - exp(-pow(amp3 / a0, 1.6))) / amp3;
      const sh = sin(shy + 2.2 * shx[x]) * sin(shy2 + (TAU * xc) / 31);
      const E = (e1 * ac1 + wd * e2 + w3 * e3) * norm + 0.035 * sh;
      const ee = Math.tanh(gain * E) * gnorm;
      let u = (cl(ee, -1, 1) + 1) * 0.5 * (NT - 1);
      const iu = min(NT - 2, floor(u));
      u -= iu;
      const o = iu * 3;
      let cr = lerp(tab[o], tab[o + 3], u);
      let cg = lerp(tab[o + 1], tab[o + 4], u);
      let cb = lerp(tab[o + 2], tab[o + 5], u);

      // cotidal lines: twelve to the tide, the line of high water drawn strongest
      const zsr = -kl * (A * s1p + B * s2p);
      const zsi = -kl * (A * c1p - B * c2p);
      const zxr = iR * (-A * c1p + B * c2p) + (kap / gR[y]) * zsr;
      const zxi = iR * (A * s1p + B * s2p) + (kap / gR[y]) * zsi;
      const ths = (zr * zsi - zi * zsr) / m2;
      const thx = (zr * zxi - zi * zxr) / m2;
      const grad = sqrt(ths * ths + thx * thx) + 1e-6;
      const q = (atan2(zi, zr) - S.ph) / GQ;
      const nq = round(q);
      const dd = ((q - nq) * GQ) / grad;
      const spacing = GQ / grad;
      const fade = sm(2.6, 5.2, spacing) * (1 - sm(16, 40, spacing)) * sm(0.03, 0.1, amp / a0);
      if (fade > 0.001) {
        const hand = (((nq % 12) + 12) % 12) === 0;
        const d2 = dd * dd;
        const ln = fade * (hand ? 0.9 * exp(-d2 / 1.9) + 0.22 * exp(-d2 / 10) : 0.5 * exp(-d2 / 1.7));
        cr = lerp(cr, LINE[0], ln);
        cg = lerp(cg, LINE[1], ln);
        cb = lerp(cb, LINE[2], ln);
      }
      // a pale hub where the tide is nil
      const hub = 0.42 * exp(-pow(amp / (0.45 * a0), 2));
      cr = lerp(cr, FOAM[0], hub);
      cg = lerp(cg, FOAM[1], hub);
      cb = lerp(cb, FOAM[2], hub);

      // coasts: a dark strip of land and a foam rim on the water side
      const dwL = xc - xL;
      const dwR = xR - xc;
      if (dwL < 4.5) {
        const wdth = 3.5 + 0.7 * ee;
        const f = (1 - sm(0, wdth, dwL)) * surfL * (0.86 + 0.2 * ee);
        const fa = 0.92 * pow(cl(f, 0, 1), 1.15);
        cr = lerp(cr, FOAM[0], fa);
        cg = lerp(cg, FOAM[1], fa);
        cb = lerp(cb, FOAM[2], fa);
        const cov = cl(0.5 - dwL, 0, 1);
        if (cov > 0) {
          const g = sm(0, 3.5, xc);
          const lr = lerp(LAND2[0], LAND[0], g) * lv;
          const lg = lerp(LAND2[1], LAND[1], g) * lv;
          const lb = lerp(LAND2[2], LAND[2], g) * lv;
          cr = lerp(cr, lr, cov);
          cg = lerp(cg, lg, cov);
          cb = lerp(cb, lb, cov);
        }
      }
      if (dwR < 4.5) {
        const wdth = 3.5 + 0.7 * ee;
        const f = (1 - sm(0, wdth, dwR)) * surfR * (0.86 + 0.2 * ee);
        const fa = 0.92 * pow(cl(f, 0, 1), 1.15);
        cr = lerp(cr, FOAM[0], fa);
        cg = lerp(cg, FOAM[1], fa);
        cb = lerp(cb, FOAM[2], fa);
        const cov = cl(0.5 - dwR, 0, 1);
        if (cov > 0) {
          const g = sm(0, 3.5, W - xc);
          const lr = lerp(LAND2[0], LAND[0], g) * lv;
          const lg = lerp(LAND2[1], LAND[1], g) * lv;
          const lb = lerp(LAND2[2], LAND[2], g) * lv;
          cr = lerp(cr, lr, cov);
          cg = lerp(cg, lg, cov);
          cb = lerp(cb, lb, cov);
        }
      }
      display.setPixel(x, y, min(255, cr), min(255, cg), min(255, cb));
    }
  }
}
