// ===== Patternflow pattern =====
// Title:   Etalon Rings
// Family:  etalon
// Idea:    A lamp in a magnet seen through two parallel mirrors: each of its three spectral lines draws its own set of thin concentric rings on black, the rings are born at the centre and swell outwards as the gap between the mirrors creeps, and the field splits every ring into three, four or six.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the multiple-beam interferometer of Fabry and Perot (1899, from memory) and its Airy transmission 1 / (1 + F sin^2(pi p)) with F = 4R / (1 - R)^2, order p falling as the square of the angle off the axis so that ring radii go as the square root of the ring number; the splitting of a spectral line in a magnetic field (Zeeman 1896, from memory) as the teaching laboratories show it through an etalon, the normal triplet and the four and six component patterns of the sodium D1 and D2 lines with the sextet's 1:3:4:4:3:1 intensities (from memory), the middle components polarized along the field and the outer ones across it; the lamp, its colours, the lens blur of 2 LED and the slow drifts are original, pattern round 246
// Round:   246
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Finesse=0..4, Field=-1..1, Polarizer=-1..1
//
// Knob 1: Hue. Turns the lamp's three colours round the wheel together. At 0 the strong line is green-cyan, the second violet-blue and the weak one amber.
// Knob 2: Finesse. 0 to 4, opening at 2: how well the mirrors reflect. At 0 the fringes are broad and soft, close to a cosine, with light and dark about equal. At 4 each ring is a razor line 2 LED across with wide black between.
// Knob 3: Field. -1 to 1, opening at 0: the magnet. At -1 there is no field and every ring is single. At 0 the strong line is a clear triplet a third of a ring spacing wide. At 1 the outer components have crossed those of the neighbouring rings.
// Knob 4: Polarizer. -1 to 1, opening at 0.06: an analyser in front of the lens. At -1 only the outer components pass and each ring of the strong line is a pair. In the middle everything passes. At 1 only the middle components pass, one ring for the strong line and a close pair for the others.

const W = 64, H = 128;
const { floor, min, max, abs, exp, sqrt, sin, cos, tan, atan, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();

const A0 = 0.00058;                    // orders per LED squared for the strong line: three orders from the centre to a far corner
const HB = 1.0;                        // half width of the lens blur, LED
const DR = 0.25, NR = 420;             // the radial profile: a sample every quarter LED out to 105 LED
const GAM = 3.6;                       // the exposure curve of one line
// a line: wave number against the strong line, hue, lightness, chroma, strength, components [shift in Lorentz units, intensity, 1 if sigma]
const LINES = [
  { k: 1.0, hue: 168, L: 0.86, C: 0.2, amp: 1.0, dep: 0.12, comps: [[-1, 0.9, 1], [0, 1, 0], [1, 0.9, 1]] },
  { k: 1.2527, hue: 286, L: 0.6, C: 0.3, amp: 0.55, dep: 0.3, comps: [[-4 / 3, 0.9, 1], [-2 / 3, 1, 0], [2 / 3, 1, 0], [4 / 3, 0.9, 1]] },
  { k: 0.9431, hue: 80, L: 0.84, C: 0.19, amp: 0.8, dep: 0.25, comps: [[0, 0.8, 1], [0, 0.8, 0]] },
];
const U1 = new Float64Array(NR), U2 = new Float64Array(NR);
for (let i = 0; i < NR; i++) {
  const r = i * DR, a = max(0, r - HB), b = r + HB;
  U1[i] = a * a;
  U2[i] = b * b;
}
const ENC = new Float32Array(1025);
for (let i = 0; i <= 1024; i++) {
  const x = i / 1024;
  ENC[i] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// ---- colour -----------------------------------------------------------------
function oklab(L, C, hdeg, out) {
  const h = (hdeg * PI) / 180, a = C * cos(h), b = C * sin(h);
  const l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const inGamut = (c) => c[0] >= -0.001 && c[1] >= -0.001 && c[2] >= -0.001 && c[0] <= 1.001 && c[1] <= 1.001 && c[2] <= 1.001;
// linear RGB of a lightness, chroma and hue, the chroma pulled in until the panel can show it
function linOf(L, C, h, out, o) {
  const c = [0, 0, 0];
  oklab(L, C, h, c);
  if (!inGamut(c)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      oklab(L, mid, h, c);
      if (inGamut(c)) lo = mid;
      else hi = mid;
    }
    oklab(L, lo, h, c);
  }
  out[o] = cl(c[0], 0, 1);
  out[o + 1] = cl(c[1], 0, 1);
  out[o + 2] = cl(c[2], 0, 1);
}

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, hue: -9,
    fin: 2, fld: 0, pol: 0.06,
    ph: new Float64Array(40),
    col: new Float32Array(9),
    prof: new Float32Array(NR * 3), line: new Float32Array(NR),
    vx: new Float32Array(W), vy: new Float32Array(H),
  });
  return st;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  const fin = cl(st.k[1], 0, 4), fld = cl(st.k[2], -1, 1), pol = cl(st.k[3], -1, 1);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < st.ph.length; i++) st.ph[i] = rnd() * TAU;
    st.fin = fin; st.fld = fld; st.pol = pol;
    st.t = 0;
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  st.t += dt;
  const ks = 1 - exp(-dt / 0.12);
  st.fin += (fin - st.fin) * ks;
  st.fld += (fld - st.fld) * ks;
  st.pol += (pol - st.pol) * ks;
}

// a slow sine on its own period and phase
const sw = (st, i, period) => sin((TAU * st.t) / period + st.ph[i]);

// ---- the radial profile -------------------------------------------------------
// Everything in the picture is a function of the distance from the ring centre. One line's transmission at order p is
// 1 / (1 + F sin^2(pi p)), and its integral over p is (n + atan(q tan(pi u)) / pi) / q with q = sqrt(1 + F), n the nearest
// whole order and u the rest. The lens blurs by 2 LED, so a sample is the mean of the transmission over the orders that
// 2 LED covers at that radius, and a ring that the mirrors make thinner than that comes out 2 LED wide and never aliases.
function profile(st) {
  const t = st.t, prof = st.prof, line = st.line, col = st.col;
  // the finesse, how many ring widths fit in one spacing: 2 to 38, and F = (2 finesse / pi)^2
  const finesse = 2 + 9 * st.fin, F = pow((2 * finesse) / PI, 2), q = sqrt(1 + F);
  const floorT = 0.85 / (1 + F), span = 1 / (1 - floorT);
  // the field: the Lorentz shift in orders, with a little ripple from the supply
  const k3 = st.fld;
  const e = (0.19 + 0.31 * k3 + 0.12 * k3 * k3) * (1 + 0.09 * sw(st, 0, 13.7) + 0.05 * sw(st, 1, 31.3));
  // the analyser: Malus on each side of the middle
  const k4 = st.pol;
  const wPi = k4 < 0 ? pow(cos((PI * k4) / 2), 2) : 1, wSg = k4 > 0 ? pow(cos((PI * k4) / 2), 2) : 1;
  // the gap: its speed wanders and reverses, so its change is the integral of three sines and a small steady creep
  const gap = 0.03 * t - (0.064 * 67 / TAU) * cos((TAU * t) / 67 + st.ph[2]) - (0.04 * 29.3 / TAU) * cos((TAU * t) / 29.3 + st.ph[3]);
  const a = A0 * (1 + 0.05 * sw(st, 4, 37.7) + 0.03 * sw(st, 5, 83.1));
  prof.fill(0);
  for (let li = 0; li < 3; li++) {
    const ln = LINES[li], ai = a * ln.k;
    // each line's own order at the centre: the gap over its wavelength, and the air between the mirrors disperses a little
    const p0 = 7.3 * li + gap * ln.k + 0.12 * sw(st, 6 + li, 71 + 26 * li);
    // the lamp warms: each line's strength breathes on its own period
    const br = ln.amp * (1 - ln.dep + ln.dep * sw(st, 10 + li, 43 + 16 * li));
    line.fill(0);
    for (let c = 0; c < ln.comps.length; c++) {
      const cp = ln.comps[c], wgt = cp[1] * (cp[2] ? wSg : wPi);
      if (wgt < 0.004) continue;
      const pc = p0 + cp[0] * e;
      for (let i = 0; i < NR; i++) {
        const pa = pc - ai * U2[i], pb = pc - ai * U1[i];
        const na = floor(pa + 0.5), nb = floor(pb + 0.5);
        const ia = na + atan(q * tan(PI * (pa - na))) / PI, ib = nb + atan(q * tan(PI * (pb - nb))) / PI;
        const avg = (ib - ia) / (q * (pb - pa));
        line[i] += wgt * (avg - floorT) * span;
      }
    }
    const cr = col[li * 3], cg = col[li * 3 + 1], cb = col[li * 3 + 2];
    for (let i = 0; i < NR; i++) {
      // a ring thinner than the blur loses its peak; give part of it back
      const hw = 0.5 / finesse / (2 * ai * max(i * DR, 4)), pk = (hw / HB) * atan(HB / hw);
      // components that fall on each other stay the line's own colour and do not burn out
      const s = max(0, line[i]) / max(pk, 0.3), s6 = pow(s / 1.1, 6);
      const v = br * pow(s / pow(1 + s6, 1 / 6), GAM);
      prof[i * 3] += v * cr;
      prof[i * 3 + 1] += v * cg;
      prof[i * 3 + 2] += v * cb;
    }
  }
  // exposure: straight up to 0.6, then a shoulder
  for (let i = 0; i < NR * 3; i++) {
    const v = prof[i];
    prof[i] = v < 0.6 ? v : 0.6 + 0.4 * (1 - exp(-(v - 0.6) / 0.4));
  }
}

export function draw(display, params) {
  if (!params.st) setup(params);
  const st = params.st;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = cl(st.k[0], 0, 1);
  if (abs(hue - st.hue) > 1e-4) {
    st.hue = hue;
    for (let li = 0; li < 3; li++) linOf(LINES[li].L, LINES[li].C, LINES[li].hue + 360 * hue, st.col, li * 3);
  }
  profile(st);
  // the ring centre: the mirrors tilt, on two periods each way
  const cx = 32 + 6 * sw(st, 14, 41.3) + 3 * sw(st, 15, 17.9);
  const cy = 64 + 8.5 * sw(st, 16, 53.7) + 3.5 * sw(st, 17, 23.1);
  // the lit patch: the lamp's image wanders on the mirrors and the lens dims the corners
  const lx = 32 + 7 * sw(st, 18, 47.3) + 3 * sw(st, 19, 19.7);
  const ly = 64 + 16 * sw(st, 20, 79.1) + 7 * sw(st, 21, 33.7);
  const { vx, vy, prof } = st;
  for (let x = 0; x < W; x++) vx[x] = exp(-pow((x + 0.5 - lx) / 62, 2));
  for (let y = 0; y < H; y++) vy[y] = exp(-pow((y + 0.5 - ly) / 70, 2));
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy, dy2 = dy * dy, vyy = vy[y] * 1024;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, f = sqrt(dx * dx + dy2) / DR, i0 = f | 0, fr = f - i0, j = i0 * 3;
      const vg = vx[x] * vyy, d = BAYER[((y & 3) << 2) | (x & 3)];
      const r = ENC[((prof[j] + fr * (prof[j + 3] - prof[j])) * vg) | 0];
      const g = ENC[((prof[j + 1] + fr * (prof[j + 4] - prof[j + 1])) * vg) | 0];
      const b = ENC[((prof[j + 2] + fr * (prof[j + 5] - prof[j + 2])) * vg) | 0];
      display.setPixel(x, y, min(255, floor(r + d)), min(255, floor(g + d)), min(255, floor(b + d)));
    }
  }
}
