// ===== Patternflow pattern =====
// Title:   Etalon Rings
// Family:  etalon
// Idea:    A lamp in a magnet seen through two parallel mirrors: each of its three spectral lines draws its own set of thin concentric rings on black, the rings are born at the centre and swell outwards as the gap between the mirrors creeps, and the field splits every green-cyan ring into three and every violet ring into four while the gold rings stay single.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the multiple-beam interferometer of Fabry and Perot (1899, from memory) and its Airy transmission 1 / (1 + F sin^2(pi p)) with F = 4R / (1 - R)^2, the order p falling as the square of the angle off the axis so that ring radii go as the square root of the ring number; the splitting of a spectral line in a magnetic field (Zeeman 1896, from memory) as teaching laboratories show it through an etalon: the normal triplet, the four components of the sodium D1 pattern at 2/3 and 4/3 of the normal shift, and a line between levels with a Lande factor of zero, which the field leaves single (all from memory), the middle components polarized along the field and the outer ones across it; the lamp and its colours, the 2 LED lens blur, the exposure curve, the oval rings, the three bright patches and the slow drifts are original, pattern round 246
// Round:   246
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Finesse=0..4, Field=-1..1, Polarizer=-1..1
//
// Knob 1: Hue. Turns the lamp's three colours round the wheel together. At 0 the strong line is green-cyan, the second violet-blue and the third gold.
// Knob 2: Finesse. 0 to 4, opening at 2: how well the mirrors reflect, from a finesse of 2 to 38. At 0 the fringes are broad and soft, close to a cosine, and the colours run into each other. At 2 a ring is 2 to 3 LED across. At 4 every ring is a razor line 2 LED across with wide black between.
// Knob 3: Field. -1 to 1, opening at 0: the magnet. At -1 there is no field and every ring is single. At 0 each green-cyan ring is a triplet four tenths of a ring spacing wide and each violet ring a comb of four. At 1 the outer components have crossed those of the neighbouring rings. The gold rings never split.
// Knob 4: Polarizer. -1 to 1, opening at 0.06: an analyser in front of the lens. At -1 only the outer components pass, so a green-cyan ring is a pair and a violet ring its outer pair. In the middle everything passes. At 1 only the middle components pass: one green-cyan ring and the inner violet pair. The gold line loses half its light at either end.

const W = 64, H = 128;
const { floor, min, max, abs, exp, sqrt, sin, cos, tan, atan, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();

const A0 = 0.00058;                    // orders per LED squared for the strong line: three orders from the centre to a far corner
const HB = 1.0;                        // half width of the lens blur, LED
const DR = 0.25, NR = 420;             // the radial profile: a sample every quarter LED out to 105 LED
const EL = 0.14;                       // how far the rings go oval
const PX = 16, PY = 36;                // how far a line's bright patch wanders each way, LED
// a patch: the four periods of its wander in seconds, then its width and height in LED
const PP = [[113, 41, 173, 59, 46, 58], [89, 37, 139, 47, 30, 36], [101, 29, 157, 71, 30, 36]];
const GAM = 3.6;                       // the exposure curve of one line
// a line: wave number against the strong line, hue, lightness, chroma, strength, how deep it breathes,
// and its components [shift in units of the normal shift, intensity, 1 if sigma]
const LINES = [
  { k: 1.0, hue: 168, L: 0.86, C: 0.2, amp: 1.0, dep: 0.2, comps: [[-1, 0.9, 1], [0, 1, 0], [1, 0.9, 1]] },
  { k: 1.2527, hue: 286, L: 0.6, C: 0.3, amp: 0.62, dep: 0.42, comps: [[-4 / 3, 0.9, 1], [-2 / 3, 1, 0], [2 / 3, 1, 0], [4 / 3, 0.9, 1]] },
  { k: 0.9431, hue: 85, L: 0.86, C: 0.19, amp: 0.95, dep: 0.22, comps: [[0, 0.8, 1], [0, 0.8, 0]] },
];
const U1 = new Float64Array(NR), U2 = new Float64Array(NR);
for (let i = 0; i < NR; i++) {
  const r = i * DR, a = max(0, r - HB), b = r + HB;
  U1[i] = a * a;
  U2[i] = b * b;
}
// exposure and encoding in one table over 0 to 2: straight up to 0.6, then a shoulder, then the sRGB curve
const TON = new Float32Array(2050);
for (let i = 0; i < 2050; i++) {
  const v = i / 1024, x = v < 0.6 ? v : 0.6 + 0.4 * (1 - exp(-(v - 0.6) / 0.4));
  TON[i] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
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
    vx: new Float32Array(W * 3), vy: new Float32Array(H * 3),
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
  const t = st.t, prof = st.prof, line = st.line;
  // the finesse, how many ring widths fit in one spacing: 2 to 38, and F = (2 finesse / pi)^2
  const finesse = 2 + 9 * st.fin, F = pow((2 * finesse) / PI, 2), q = sqrt(1 + F);
  const floorT = 0.85 / (1 + F), span = 1 / (1 - floorT);
  // the field: the normal shift in orders, with a little ripple from the supply
  const k3 = st.fld;
  const e = (0.19 + 0.31 * k3 + 0.12 * k3 * k3) * (1 + 0.09 * sw(st, 0, 13.7) + 0.05 * sw(st, 1, 19.1));
  // the analyser: Malus on each side of the middle
  const k4 = st.pol;
  const wPi = k4 < 0 ? pow(cos((PI * k4) / 2), 2) : 1, wSg = k4 > 0 ? pow(cos((PI * k4) / 2), 2) : 1;
  // the gap: a steady creep and two sines in its speed, which now and then runs backwards; this is their integral
  const gap = 0.038 * t - (0.064 * 73 / TAU) * cos((TAU * t) / 73 + st.ph[2]) - (0.04 * 29.3 / TAU) * cos((TAU * t) / 29.3 + st.ph[3]);
  const a = A0 * (1 + 0.12 * sw(st, 4, 53) + 0.07 * sw(st, 5, 151));
  for (let li = 0; li < 3; li++) {
    const ln = LINES[li], ai = a * ln.k;
    // each line's own order at the centre: the gap over its wavelength, and the air between the mirrors disperses a little,
    // so the three sets slip against each other by an eighth of an order
    const p0 = 7.3 * li + gap * ln.k + 0.12 * sw(st, 6 + li, 127 + 39 * li);
    // the lamp warms: each line's strength breathes on its own period
    const br = ln.amp * (1 - ln.dep + ln.dep * sw(st, 10 + li, 61 + 21 * li));
    line.fill(0);
    // the brightest this line gets anywhere along one order, with the analyser and without: the exposure is set by it
    let mU = 0.75, mP = 0.75;
    for (let j = 0; j < 96; j++) {
      let sU = 0, sP = 0;
      for (let c = 0; c < ln.comps.length; c++) {
        const cp = ln.comps[c], sn = sin(PI * (j / 96 - cp[0] * e)), tt = (1 / (1 + F * sn * sn) - floorT) * span;
        sU += cp[1] * tt;
        sP += cp[1] * (cp[2] ? wSg : wPi) * tt;
      }
      if (sU > mU) mU = sU;
      if (sP > mP) mP = sP;
    }
    const nrm = span / pow(mU * mP, 0.42);
    for (let c = 0; c < ln.comps.length; c++) {
      const cp = ln.comps[c], wgt = cp[1] * (cp[2] ? wSg : wPi) * nrm;
      if (wgt < 0.004) continue;
      const pc = p0 + cp[0] * e;
      for (let i = 0; i < NR; i++) {
        const pa = pc - ai * U2[i], pb = pc - ai * U1[i];
        const na = floor(pa + 0.5), nb = floor(pb + 0.5);
        const ia = na + atan(q * tan(PI * (pa - na))) / PI, ib = nb + atan(q * tan(PI * (pb - nb))) / PI;
        line[i] += wgt * ((ib - ia) / (q * (pb - pa)) - floorT);
      }
    }
    for (let i = 0; i < NR; i++) {
      // a ring thinner than the blur loses its peak, and gets it back; components that fall on each other do not burn out
      const hw = 0.5 / finesse / (2 * ai * max(i * DR, 4)), pk = (hw / HB) * atan(HB / hw);
      const s = max(0, line[i]) / max(pk, 0.3), s6 = pow(s / 1.1, 6);
      prof[li * NR + i] = br * pow(s / pow(1 + s6, 1 / 6), GAM);
    }
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
  const cx = 32 + 7.5 * sw(st, 14, 67.3) + 3.5 * sw(st, 15, 23.9);
  const cy = 64 + 11 * sw(st, 16, 97.1) + 4.5 * sw(st, 17, 31.3);
  // the screen stands a little askew to the lens, so the rings are ovals whose long axis turns
  const ea = EL * sw(st, 18, 131), eb = EL * sw(st, 19, 83);
  const qa = (1 + ea) / (DR * DR), qb = (2 * eb) / (DR * DR), qc = (1 - ea) / (DR * DR);
  // the lamp: each line glows brightest in its own part of the tube, and the tube's image lies across the rings and drifts
  const { vx, vy, prof, col } = st;
  for (let li = 0; li < 3; li++) {
    const pp = PP[li];
    const lx = 32 + PX * sw(st, 20 + 4 * li, pp[0]) + 0.4 * PX * sw(st, 21 + 4 * li, pp[1]);
    const ly = 64 + PY * sw(st, 22 + 4 * li, pp[2]) + 0.4 * PY * sw(st, 23 + 4 * li, pp[3]);
    for (let x = 0; x < W; x++) vx[li * W + x] = exp(-pow((x + 0.5 - lx) / pp[4], 2) - pow((x - 31.5) / 72, 2));
    for (let y = 0; y < H; y++) vy[li * H + y] = 1024 * exp(-pow((y + 0.5 - ly) / pp[5], 2) - pow((y - 63.5) / 92, 2));
  }
  const c0 = col[0], c1 = col[1], c2 = col[2], c3 = col[3], c4 = col[4], c5 = col[5], c6 = col[6], c7 = col[7], c8 = col[8];
  const N2 = 2 * NR;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy, v0 = vy[y], v1 = vy[H + y], v2 = vy[2 * H + y];
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, f = sqrt(qa * dx * dx + qb * dx * dy + qc * dy * dy), i = f | 0, fr = f - i;
      const d = BAYER[((y & 3) << 2) | (x & 3)];
      const a = (prof[i] + fr * (prof[i + 1] - prof[i])) * vx[x] * v0;
      const b = (prof[NR + i] + fr * (prof[NR + i + 1] - prof[NR + i])) * vx[W + x] * v1;
      const c = (prof[N2 + i] + fr * (prof[N2 + i + 1] - prof[N2 + i])) * vx[2 * W + x] * v2;
      const r = TON[min(2048, (a * c0 + b * c3 + c * c6) | 0)];
      const g = TON[min(2048, (a * c1 + b * c4 + c * c7) | 0)];
      const bl = TON[min(2048, (a * c2 + b * c5 + c * c8) | 0)];
      display.setPixel(x, y, min(255, floor(r + d)), min(255, floor(g + d)), min(255, floor(bl + d)));
    }
  }
}
