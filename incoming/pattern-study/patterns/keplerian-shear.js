// ===== Patternflow pattern =====
// Title:   Keplerian Shear
// Family:  rings
// Idea:    A close-up strip of Saturn's A ring seen face on, radius across the panel and orbit along it, where every column circles at its own Kepler rate, so the picture slides down at a different speed in each column, the gravity wakes and the spiral density wave are sheared into long slanted streaks, and tiny moonlets cut propellers that stretch the same way.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kepler's third law (1619), Julian and Toomre's 1966 shearing-sheet picture of gravity wakes in a differentially rotating disk, Goldreich and Tremaine's density-wave theory of Saturn's rings (late 1970s), Pan found in the Encke gap in Voyager images (about 1990), and the propeller moonlets Cassini saw in the A ring (2006); pattern round 207
// Round:   207
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Shear=0.3..4, Wakes=-1..1, Moonlets=-1..1
//
// Knob 1: Hue. Turns the ring through six palettes and back to the first: Saturn tan and cream at 0 and 1, rose at 0.17, violet at 0.33, icy blue-white at 0.5, teal at 0.67, citrine gold at 0.83. The gaps keep a faint blue-grey or matching tint.
// Knob 2: Shear. The orbital rate of the whole strip. The columns slide down at 10 LEDs a second at the inner (left) edge and 4.5 at the outer edge when it opens at 2, at 1.5 and 0.7 at 0.3, and at twice the opening speeds at 4; the 2.2 to 1 ratio between the edges stays Keplerian. Wakes are renewed every 22 s at 2, 46 s at 0.3 and 14 s at 4.
// Knob 3: Wakes. The self-gravity wakes in the ringlets. At -1 the ring is nearly smooth, with a 5% swing in brightness and streaks only about 4 LEDs long; at 0, where it opens, the streaks are 3 LEDs wide and 11 long before the shear stretches them, with a swing of about a quarter; at +1 they are 19 long with a swing of 0.6, and bright clumps shear into arcs.
// Knob 4: Moonlets. The size of the propellers cut by the moonlets: lobes 7 LEDs long and 2.6 wide at -1, 19 long and 2.9 wide at the opening 0.06, 44 long and 3.4 wide at +1. It also sets the strength of the spiral density wave, from 15% to full, and the edge waves Pan raises in the Encke gap, 1.3 LEDs deep at -1 and 2.2 at +1. Six moonlets circle on orbits of 516 to 946 rows, so at least one is on the panel at any time.

const W = 64;
const H = 128;
const { floor, exp, sin, cos, abs, min, max, pow, sqrt, PI, imul } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

function hh(i, j) {
  let h = (imul(i, 374761393) + imul(j, 668265263)) | 0;
  h = imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(u, v) {
  const i = floor(u);
  const j = floor(v);
  let a = u - i;
  let b = v - j;
  a = a * a * (3 - 2 * a);
  b = b * b * (3 - 2 * b);
  const p = hh(i, j);
  const q = hh(i + 1, j);
  const r = hh(i, j + 1);
  const s = hh(i + 1, j + 1);
  return p + (q - p) * a + (r - p) * b + (p - q - r + s) * a * b;
}
const nz = (v) => cl((v - 0.5) * 3.6, -1.25, 1.25);
function vn1(u, seed) {
  const i = floor(u);
  let a = u - i;
  a = a * a * (3 - 2 * a);
  const p = hh(i, seed);
  return p + (hh(i + 1, seed) - p) * a;
}

// ---- the orbit -------------------------------------------------------------
// Radius runs from 1 at the left edge to 1.7 at the right. A column at radius
// r slides at U r^-1.5 LEDs per unit of orbital phase, so the left edge runs
// 2.2 times faster than the right one.
const RSPAN = 0.7;
const U = 5;
const radius = (xc) => 1 + (RSPAN * xc) / W;
const rate = (xc) => U * pow(radius(xc), -1.5);

// Wakes are born at a pitch of about 20 degrees off the orbit direction and
// are sheared for one window, then replaced by a fresh set from another seed.
const WIN = 22; // seconds of window clock
const FADE = 7; // the cross-fade between two windows
const LEAN = 2.75; // rows per column of a fresh wake, tan(70 degrees)
const LN = sqrt(1 + LEAN * LEAN);

// ---- the ringlets -----------------------------------------------------------
const GAPS = [
  // centre, half width: the narrow ones; the Encke gap is drawn on its own
  [8.7, 0.8],
  [45.6, 1.2],
  [62.6, 0.9],
];
const ENCKE_HW = 2.3;
const WAVE_X0 = 17;

// ---- the moonlets -----------------------------------------------------------
// Six moonlets, each at the radius whose Kepler rate is a whole number n of
// the slowest one's twelfths, so they all come round together after one
// period and the arcs of the panel they cover can be laid end to end: there
// is always one on the panel. Pan (n = 8) sits in the Encke gap.
const ELL = 86; // orbital phase of one period, in units of n rows
const MARGIN = 2;
const NSEQ = [6, 11, 8, 9, 7, 10];
const OVL = [1.5, 4, 0.5, 3.6, 2.5, 3];
const SIZES = [1.15, 0.85, 1, 1.1, 0.9, 1.2];
const PAN = 2; // index of the moonlet in the Encke gap

function makeMoons() {
  const moons = [];
  let s = 0;
  let total = 0;
  for (let j = 0; j < NSEQ.length; j++) total += (128 + 2 * MARGIN) / NSEQ[j];
  const slack = total - ELL;
  let ow = 0;
  for (let j = 0; j < NSEQ.length; j++) ow += OVL[j];
  for (let j = 0; j < NSEQ.length; j++) {
    const n = NSEQ[j];
    const r = pow(12 / n, 2 / 3);
    const xc = ((r - 1) / RSPAN) * W;
    moons.push({ n, xc, L: n * ELL, c: -s - MARGIN / n, size: SIZES[j] });
    s += (128 + 2 * MARGIN) / n - (OVL[j] * slack) / ow;
  }
  return moons;
}
const MOONS = makeMoons();
const UORB = U / 12; // orbital phase per unit of shear phase, in rows per n

// ---- colour -------------------------------------------------------------------
// Six stops per palette, from the gap to the brightest ring: gap, deep, mid,
// light, cream, ivory.
const STOP_AT = [0, 0.12, 0.36, 0.64, 0.86, 1.1];
const PAL = [
  [[20, 26, 46], [58, 40, 30], [132, 104, 76], [204, 174, 132], [238, 218, 182], [253, 246, 224]], // Saturn tan
  [[30, 12, 26], [84, 20, 50], [172, 56, 94], [238, 130, 148], [251, 196, 194], [255, 238, 228]], // rose
  [[18, 8, 40], [44, 24, 100], [100, 66, 186], [178, 142, 234], [224, 204, 250], [250, 240, 255]], // violet
  [[8, 14, 34], [18, 40, 92], [60, 116, 190], [154, 204, 238], [216, 238, 252], [246, 252, 255]], // icy blue
  [[6, 26, 28], [8, 56, 58], [30, 128, 110], [116, 204, 170], [192, 238, 210], [240, 252, 236]], // teal
  [[24, 24, 10], [54, 44, 8], [144, 118, 24], [220, 196, 90], [246, 238, 164], [255, 252, 216]], // citrine
];
function toHsv(c, o) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  o[0] = h;
  o[1] = mx > 0 ? d / mx : 0;
  o[2] = mx;
}
function fromHsv(h, s, v, o) {
  const k = (n) => (n + h) % 6;
  const f = (n) => 255 * v * (1 - s * max(0, min(k(n), 4 - k(n), 1)));
  o[0] = f(5);
  o[1] = f(3);
  o[2] = f(1);
}
const HA = [0, 0, 0];
const HB = [0, 0, 0];
const STOPS = Array.from({ length: 6 }, () => [0, 0, 0]);
// Stops are mixed round the hue circle, not through grey.
function palette(k) {
  const n = PAL.length;
  const pos = cl(k, 0, 1) * n;
  const a = min(floor(pos), n - 1);
  const f = pos - a;
  const A = PAL[a];
  const B = PAL[(a + 1) % n];
  for (let c = 0; c < 6; c++) {
    toHsv(A[c], HA);
    toHsv(B[c], HB);
    let dh = HB[0] - HA[0];
    if (dh > 3) dh -= 6;
    else if (dh < -3) dh += 6;
    let h = HA[0] + dh * f;
    if (HA[1] < 0.06) h = HB[0];
    else if (HB[1] < 0.06) h = HA[0];
    fromHsv((h + 6) % 6, lerp(HA[1], HB[1], f), lerp(HA[2], HB[2], f), STOPS[c]);
  }
}

const LUTN = 256;
const LUTK = (LUTN - 1) / STOP_AT[5];

function buildLut(S) {
  palette(S.hue);
  const lut = S.lut;
  for (let x = 0; x < W; x++) {
    const t = S.tint[x];
    const o = x * LUTN * 3;
    let seg = 0;
    for (let i = 0; i < LUTN; i++) {
      const b = i / LUTK;
      while (seg < 4 && b > STOP_AT[seg + 1]) seg++;
      const f = cl((b - STOP_AT[seg]) / (STOP_AT[seg + 1] - STOP_AT[seg]), 0, 1);
      const A = STOPS[seg];
      const B = STOPS[seg + 1];
      // a warmer or cooler ringlet: the body tint, less in the gap and the highlights
      const body = sm(0.02, 0.3, b) * (1 - sm(0.9, 1.1, b) * 0.7);
      const wr = 1 + 0.08 * t * body;
      const wb = 1 - 0.12 * t * body;
      lut[o + i * 3] = cl((A[0] + (B[0] - A[0]) * f) * wr, 0, 255);
      lut[o + i * 3 + 1] = cl(A[1] + (B[1] - A[1]) * f, 0, 255);
      lut[o + i * 3 + 2] = cl((A[2] + (B[2] - A[2]) * f) * wb, 0, 255);
    }
  }
}

// ---- the ringlet profile -----------------------------------------------------------
// Density along the radius: multi-scale noise cut into plateaus with soft
// steps, then the narrow gaps. The Encke gap is left out, it is drawn per pixel.
function buildRing(S) {
  for (let x = 0; x < W; x++) {
    const xc = x + 0.5;
    const n = 0.42 * vn1(xc / 6.0 + 3.1, 3) + 0.36 * vn1(xc / 3.0 + 9.7, 7) + 0.22 * vn1(xc / 2.0 + 4.2, 11);
    let v = 0.5 + (n - 0.5) * 2.8;
    v = cl(v, 0.001, 0.999);
    const lv = 9;
    const q = (floor(v * lv) + sm(0.25, 0.75, v * lv - floor(v * lv))) / lv;
    let B = 0.3 + 0.62 * q;
    // the outer rim of the strip thins a little
    B *= 1 - 0.3 * sm(60.5, 64, xc);
    for (const g of GAPS) B *= 1 - 0.95 * (1 - sm(g[1] - 0.6, g[1] + 0.7, abs(xc - g[0])));
    S.base[x] = B;
    S.tint[x] = (vn1(xc / 5.2 + 21.7, 21) - 0.5) * 2;
    S.hz[x] = vn1(xc / 4.1 + 2.3, 33);
  }
}

export function setup(params) {
  const S = {
    t: 0,
    first: true,
    k: [0, 2, 0, 0.06],
    sk: [0, 2, 0, 0.06],
    phi: 0, // orbital phase, the integral of the shear
    clock: 7, // window clock: the picture opens 14 s into a window, once the cross-fade is over
    win: 0,
    phi0: [0, 0], // orbital phase when the current and the previous window began
    lutHue: -1,
    hue: 0,
    base: new Float32Array(W),
    tint: new Float32Array(W),
    hz: new Float32Array(W),
    sx: new Float32Array(W),
    bcol: new Float32Array(W),
    lut: new Uint8ClampedArray(W * LUTN * 3),
    pd: new Float32Array(W * H),
    core: new Float32Array(W * H),
  };
  buildRing(S);
  for (let x = 0; x < W; x++) S.sx[x] = rate(x + 0.5);
  S.win = floor((S.clock + FADE) / WIN);
  S.phi0 = [-28, -70];
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
  const e = 1 - exp(-dt / 0.3);
  for (let i = 0; i < 4; i++) S.sk[i] += (S.k[i] - S.sk[i]) * e;
  S.t += dt;
  const shear = cl(S.sk[1], 0.3, 4);
  S.phi += shear * dt;
  S.clock += (0.4 + 0.3 * shear) * dt;
  const w = floor((S.clock + FADE) / WIN);
  while (S.win < w) {
    S.win++;
    S.phi0[1] = S.phi0[0];
    S.phi0[0] = S.phi;
  }
  S.hue = cl(S.sk[0], 0, 1);
}

// a moonlet's propeller is drawn while its core is up to this many rows off either edge
const MARGIN_VIS = 64;

function propellers(S, f) {
  const { pd, core } = S;
  pd.fill(0);
  core.fill(0);
  const phi = S.phi;
  for (let j = 0; j < MOONS.length; j++) {
    const m = MOONS[j];
    const q = m.n * (m.c + UORB * phi);
    const p = ((((q + MARGIN_VIS) % m.L) + m.L) % m.L) - MARGIN_VIS;
    m.p = p;
    if (p > H + MARGIN_VIS) continue;
    const sz = m.size * f;
    // the moonlet core: a soft blob 2 LEDs across
    const cr = 1.0 + 0.35 * sqrt(f);
    for (let x = max(0, floor(m.xc - 4)); x <= min(W - 1, floor(m.xc + 4)); x++) {
      for (let y = max(0, floor(p - 4)); y <= min(H - 1, floor(p + 4)); y++) {
        const dx = x + 0.5 - m.xc;
        const dy = y + 0.5 - p;
        core[y * W + x] += (j === PAN ? 1.4 : 1) * exp(-(dx * dx + dy * dy) / (2 * cr * cr * 0.6));
      }
    }
    if (j === PAN) continue;
    // the propeller: two lobes, the outer one streaming back, the inner one ahead
    const Lm = 18 * pow(sz, 1.5);
    const sig0 = 0.75 + 0.5 * sqrt(sz);
    const w0 = 1.0 + 0.9 * sqrt(sz);
    const reach = w0 + 0.07 * Lm + 3 * sig0 * 1.8 + 1;
    for (let y = max(0, floor(p - Lm - 4)); y <= min(H - 1, floor(p + Lm + 4)); y++) {
      const dy = y + 0.5 - p;
      for (let x = max(0, floor(m.xc - reach)); x <= min(W - 1, floor(m.xc + reach)); x++) {
        const dx = x + 0.5 - m.xc;
        const s = dx >= 0 ? 1 : -1;
        // distance downstream along this lobe: the outer lobe (dx > 0) runs towards -y
        const tt = -s * dy;
        if (tt < -2.5 || tt > Lm + 4) continue;
        const c = s * (w0 + 0.07 * max(tt, 0));
        const sg = sig0 * (1 + 0.025 * max(tt, 0));
        const env = sm(-2.5, 2.2, tt) * (1 - sm(0.45 * Lm, Lm, tt));
        const u = (dx - c) / sg;
        const d = env * exp(-0.5 * u * u);
        // the lobe is mirrored through the moonlet: keep the larger of the two
        const idx = y * W + x;
        if (d > pd[idx]) pd[idx] = d;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const t = S.t;
  const { base, bcol, sx, tint, lut, pd, core } = S;
  if (S.lutHue < 0 || abs(S.hue - S.lutHue) > 0.0004) {
    buildLut(S);
    S.lutHue = S.hue;
  }
  const k3 = cl((S.sk[2] + 1) / 2, 0, 1);
  const f = exp(0.6 * cl(S.sk[3], -1, 1));
  propellers(S, f);

  // wake windows
  const age = (S.clock + FADE) - S.win * WIN;
  const wNew = sm(0, FADE, age);
  const useOld = wNew < 0.999;
  const aNew = S.phi - S.phi0[0];
  const aOld = S.phi - S.phi0[1];
  const kNew = S.win;
  const kOld = S.win - 1;
  const seed = (k, a) => hh(k * 7 + a, 91) * 300;
  const oxN = seed(kNew, 1), oyN = seed(kNew, 2), oxN2 = seed(kNew, 3), oyN2 = seed(kNew, 4), oxN3 = seed(kNew, 5), oyN3 = seed(kNew, 6);
  const oxO = seed(kOld, 1), oyO = seed(kOld, 2), oxO2 = seed(kOld, 3), oyO2 = seed(kOld, 4), oxO3 = seed(kOld, 5), oyO3 = seed(kOld, 6);
  const wAmp = 0.05 + 0.58 * pow(k3, 1.7);
  const kl = 0.5 + 2.0 * k3;
  const WA = 2.7; // across the streak, LEDs
  const WL = 7.5 * kl; // along the streak
  const WFine = 2.1;
  const wFineL = 1.7 * WL;
  const fineN = 1 - 0.7 * sm(0.45, 1, age / WIN);
  const fineO = 0.3;
  const fAmp = 0.15 + 0.2 * k3;
  const clumpGain = sm(0.55, 1, k3) * 0.9;
  const haze = 0.45 + 0.6 * k3;
  // blend weights keep the wake contrast level through a cross-fade
  const norm = 1 / sqrt(wNew * wNew + (1 - wNew) * (1 - wNew));
  const wN = wNew * norm;
  const wO = (1 - wNew) * norm;

  // density wave: its own pattern speed, packet starting at the resonance
  const yPat = S.phi * 1.6;
  const LAMY = 19;
  const KY = TAU / LAMY;
  const KAPPA = 0.0125;
  const waveAmp = 0.15 + 0.85 * ((cl(S.sk[3], -1, 1) + 1) / 2);

  // slow breathing of the ringlets
  for (let x = 0; x < W; x++) bcol[x] = base[x] * (1 + 0.1 * (vn(x / 7 + 40, t / 80 + 5) - 0.5) * 2);

  // Pan, in the Encke gap, and the wavy edges it raises
  const pan = MOONS[PAN];
  const xg = pan.xc;
  const panDy0 = pan.p;
  const panL = pan.L;
  const edgeA = 0.9 + 0.7 * f;
  const gx0 = floor(xg - ENCKE_HW - 4);
  const gx1 = floor(xg + ENCKE_HW + 4);

  for (let x = 0; x < W; x++) {
    const xc = x + 0.5;
    const s = sx[x];
    const dNew = s * aNew;
    const dOld = s * aOld;
    const Bx = bcol[x];
    const o = x * LUTN * 3;
    const wid = 1 / (1 + 0.9 * exp(-xc / 14));
    const hzx = 0.5 + 0.95 * S.hz[x];
    const nearGap = x >= gx0 && x <= gx1;
    const waveOn = xc > WAVE_X0 - 1;
    const wAx = waveOn ? sm(WAVE_X0, WAVE_X0 + 7, xc) * exp(-(xc - WAVE_X0) / 40) : 0;
    const wPh = 0.5 * KAPPA * (xc - WAVE_X0) * (xc - WAVE_X0);
    for (let y = 0; y < H; y++) {
      const yc = y + 0.5;
      const idx = y * W + x;
      // the new window
      let y0 = yc - dNew;
      let ac = (LEAN * xc + y0) / LN;
      let al = (xc - LEAN * y0) / LN;
      let m = nz(vn((ac * wid) / WA + oxN, al / WL + oyN));
      let mf = fineN * nz(vn((ac * wid) / WFine + oxN2, al / wFineL + oyN2));
      let cn = vn(ac / 9 + oxN3, al / (3.2 * WL) + oyN3);
      m *= wN;
      mf *= wN;
      cn *= wNew;
      if (useOld) {
        y0 = yc - dOld;
        ac = (LEAN * xc + y0) / LN;
        al = (xc - LEAN * y0) / LN;
        m += wO * nz(vn((ac * wid) / WA + oxO, al / WL + oyO));
        mf += wO * fineO * nz(vn((ac * wid) / WFine + oxO2, al / wFineL + oyO2));
        cn += (1 - wNew) * vn(ac / 9 + oxO3, al / (3.2 * WL) + oyO3);
      }
      let b = 1 + hzx * (wAmp * m + fAmp * mf);
      // sparse bright clumps, sheared with their window
      const cl2 = sm(0.6, 0.86, cn) * clumpGain;
      b += 0.5 * cl2 + haze * (cn - 0.5);
      // spiral density wave
      if (waveOn) b += waveAmp * wAx * sin(KY * (yc - yPat) + wPh);
      // streaks dim the ring to a deep amber, never to the gap's black
      if (b < 0.6) b = 0.6 - (0.6 - b) * 0.45;
      let B = Bx;
      if (nearGap) {
        const ex = xc - xg;
        let dy = yc - panDy0;
        dy -= panL * Math.round(dy / panL);
        let gm;
        if (ex < 0) {
          const ah = dy > 0 ? exp(-dy / 20) * sin((TAU * dy) / 13) : 0;
          gm = sm(-0.8, 0.8, -ENCKE_HW + edgeA * ah - ex);
        } else {
          const bh = dy < 0 ? exp(dy / 20) * sin((TAU * dy) / 13) : 0;
          gm = sm(-0.8, 0.8, ex - ENCKE_HW - edgeA * bh);
        }
        B *= 0.04 + 0.96 * gm;
      }
      let v = B * b;
      if (v > 0.8) v = 0.8 + (v - 0.8) * 0.5;
      v *= 1 - 0.86 * pd[idx];
      v += 0.95 * core[idx] * (0.55 + 0.45 * sm(0, 0.5, B));
      let li = (v * LUTK + 0.5) | 0;
      li = li < 0 ? 0 : li > LUTN - 1 ? LUTN - 1 : li;
      const q = o + li * 3;
      display.setPixel(x, y, lut[q], lut[q + 1], lut[q + 2]);
    }
  }
}
