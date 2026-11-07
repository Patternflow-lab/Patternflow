// ===== Patternflow pattern =====
// Title:   Schroeder Diffuser
// Family:  wave
// Idea:    The same pulse of waves, coming down the standing panel at 30 degrees, hits a flat wall on top and a quadratic-residue diffuser below it, a wall of 3-LED wells cut to the depths (n squared mod N) times a step of 6/N LEDs, and the flat wall sends back one mirror pulse while the diffuser sends back a spreading dome, with a ring of beads on an arc about each wall marking the diffraction orders at their true angles and levels.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: number-theoretic sound diffusers (Manfred Schroeder, 1975), the quadratic-residue wall of his Number Theory in Science and Communication, whose equal orders rest on the Gauss sum of size square root of N (Carl Friedrich Gauss); pattern round 104
// Round:   104
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Prime=7..23, Pitch=0..1
//
// Knob 1: Hue. Turns the pressure colours round the wheel. At 0 the crests are cyan and the troughs pink, with white where the pressure is highest; at 0.25 they are yellow and violet, at 0.5 red and green.
// Knob 2: Speed. The wave runs 12 LEDs a second for each unit of Speed, so 24 at the opening 2 and 2.4 at 0.2 or 36 at 3. A pulse train comes round every 8.3 wavelengths, 100 LEDs at the opening pitch, which is 4.2 s at 2, 42 s at 0.2 and 2.8 s at 3.
// Knob 3: Prime. The number of wells N in one period, the odd prime nearest the knob among 7, 11, 13, 17, 19 and 23: 7 up to 9, 11 up to 12, 13 up to 15, 17 up to 18, 19 up to 21, 23 above. A period is 3N LEDs wide, so the wall is 21 LEDs per period at 7 and 69 at 23, and at the opening pitch the diffuser sends the pulse into 3 orders at N = 7, 6 at 11 and 13, 9 at 17, 10 at 19 and 11 at 23, where the flat wall always sends one.
// Knob 4: Pitch. How short the wave is, in octaves above the design pitch: 0.06 at the opening is wavelength 12 LEDs, the one the wells are cut for, and 1 is one octave up, wavelength 6. Down to 0 it falls to 0.75 of the design pitch, wavelength 16, where the mirror order is the strongest of N = 11's five at 0.46. The orders stand level at 0.06 and at 1, apart from the outer ones, which the 3-LED wells thin out, and uneven between: at 0.5, wavelength 8.7, N = 11 has levels from 0.01 to 0.22.

// A flat wall sends a wave back as one beam at the mirror angle. A Schroeder
// diffuser is a wall cut into wells of one width, and the depths follow a
// number sequence so that the wall sends the wave back in every direction
// that is open to it, at the same level. The quadratic-residue wall has N
// wells to a period, N an odd prime, and well n is d_n = (n^2 mod N) l0 / (2N)
// deep. A wave of length l0 goes down a well and back, so well n returns it
// with the phase 2 k d_n = 2 pi (n^2 mod N) / N, and the sum of N such phases
// over one period, taken at any order m, is a Gauss sum of size sqrt(N). That
// is the whole reason for the sequence: each order has the same pressure level
// |R_m|^2, 1/N times a roll-off sinc^2(pi m / N) from the width of a well.
// The same sum has the same size at l0 / 2, where every phase is doubled, so
// the diffuser works at one octave and falls off between.
//
// A well here is 3 LEDs wide, l0 is 12 LEDs, and the deepest well, 5.65 LEDs
// at N = 17, fits the wall's 6 rows. A period is W = 3N wide and the
// orders leave a wave of length l at sin t_m = sin t_i + m l / W, t_i = 30
// degrees, as many of them as have |sin t_m| < 1. orders() sums them from the
// wells. The model, a phase at each well mouth, puts about 60 percent of the
// power at the opening pitch into orders that do not propagate, which a rigid
// wall cannot keep, so the levels are scaled until the power leaving, the sum
// of |R_m|^2 cos t_m / cos t_i, is 1.
//
// The picture is a pulse, not a steady wave. A steady wave over one period
// has all its orders on top of each other everywhere in 64 LEDs, and the
// fan is not to be seen. A pulse of nine frequencies, 0.12 of the middle
// one apart, weighted exp(-(d / 0.3)^2), leaves every order at the same
// moment in its own direction, and the packets spread apart as they go. Each
// frequency is solved alone. A beam of width 15 LEDs, exp(-(x / 15)^2), comes
// at 30 degrees from the wall's normal, and its field on the plane times the
// reflection exp(2 i k d(x)) of the wells is the reflected field there, the
// Kirchhoff boundary field. Above the plane every plane wave of its spectrum
// is carried up by exp(+-i kz z), kz = sqrt(k^2 - kx^2), with the waves that
// do not propagate dying as exp(-|kz| z): a 256-point transform per row,
// nine times 116 rows. The nine fields add with their phases wound at 12 LEDs
// a second for a unit of Speed, so they all agree at the wall at tau = 0 and
// the train repeats every 8.3 wavelengths. Inside a well the wave goes
// straight down and back, p = 2 A cos(k (z + d)) e^(i k d), with A the beam
// at the mouth.
//
// Checks done while writing: the flat wall's far field peaks at 30 degrees,
// the angle the beam came in at; and at N = 11, l = 12 the far field of the windowed
// boundary field, transformed on its own, has lobes at the six orders of
// -73, -36, -13, 8, 30 and 60 degrees whose heights are within 0.03 of the
// levels orders() gives, 0.14 to 0.22.
//
// The beads sit on an arc of radius 27 LEDs about the middle of the wall at
// the angle of each order, a bead 0.8 LED plus 1.5 times the square root of
// the level in radius, the flat wall's one bead at level 1. The arc itself is as bright as the far field at
// that angle, from the same transform. A ring marks the way in. Both brighten
// while the pulse crosses the arc.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const NX = 256, MASK = NX - 1;
const PRIMES = [7, 11, 13, 17, 19, 23];
// A well is WELL LEDs wide; l0 is LAM0; the beam comes in at TH, W0 across, about column 32.
const WELL = 3, LAM0 = 12, TH = (30 * PI) / 180, W0 = 15, XC = 0.5;
// Nine frequencies DD apart, weighted with width BW; CSP LEDs a second at Speed 1;
// the arc at RA; TOFF, the time before the pulse reaches the wall at the opening.
const NF = 9, DD = 0.12, BW = 0.3, CSP = 12, RA = 27, TOFF = 2.1;
// Row of the wall plane in the flat zone (rows 0-63) and the diffuser zone (64-127).
const YW = [58, 122];

// ---- FFT, radix 2, in place; sign -1 forward, +1 inverse (no 1/N).
const REV = new Uint16Array(NX);
for (let i = 0; i < NX; i++) {
  let r = 0;
  for (let b = 0; b < 8; b++) r |= ((i >> b) & 1) << (7 - b);
  REV[i] = r;
}
const TC = new Float64Array(NX / 2), TS = new Float64Array(NX / 2);
for (let i = 0; i < NX / 2; i++) {
  TC[i] = cos((2 * PI * i) / NX);
  TS[i] = sin((2 * PI * i) / NX);
}
function fft(re, im, sg) {
  for (let i = 0; i < NX; i++) {
    const j = REV[i];
    if (j > i) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= NX; len <<= 1) {
    const half = len >> 1, step = NX / len;
    for (let i = 0; i < NX; i += len)
      for (let k = 0; k < half; k++) {
        const c = TC[k * step], s = sg * TS[k * step], a = i + k, b = a + half;
        const xr = re[b] * c - im[b] * s, xi = re[b] * s + im[b] * c;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
  }
}

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The well under column x for N wells to a period: its number n, residue and
// depth d in LEDs. Well 0, 3 columns wide, is columns 31 to 33, and the
// sequence is the same either side of it, and past the panel's edges.
function wellOf(x, N) {
  const g = floor((x - 30.5) / WELL), n = ((g % N) + N) % N, s = (n * n) % N;
  return { n, s, d: (s * LAM0) / (2 * N) };
}

// The orders of the infinite wall at wavelength lam: m, angle t and pressure
// level |R_m|^2. tot is what the power leaving added up to before the levels
// were scaled to make it 1.
function orders(N, lam) {
  const k = (2 * PI) / lam, out = [], Wp = WELL * N, sk = sin(TH);
  let tot = 0;
  for (let m = -12; m <= 12; m++) {
    const s = sk + (m * lam) / Wp;
    if (abs(s) >= 1) continue;
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const ph = (2 * k * (((n * n) % N) * LAM0)) / (2 * N) - (2 * PI * m * n) / N;
      re += cos(ph);
      im += sin(ph);
    }
    const sc = m === 0 ? 1 : sin((PI * m) / N) / ((PI * m) / N), th = Math.asin(s);
    const p = (sc * sc * (re * re + im * im)) / (N * N);
    tot += (p * cos(th)) / cos(TH);
    out.push({ m, th, p });
  }
  for (const o of out) o.p /= tot;
  out.tot = tot;
  return out;
}

export function setup(params) {
  const NP = W * H;
  params.s = {
    t: 0, hue: 0, speed: 2, pi: -1, lamq: -1, N: 7, lam: LAM0, hueBuilt: -1, ord: [],
    // The nine fields (real and imaginary), where a field is drawn, the wall's colours,
    // the overlay's white and dark, the colour table, and the far field of both walls.
    AR: new Float32Array(NF * NP), AI: new Float32Array(NF * NP), FA: new Float32Array(NP), BASE: new Float32Array(NP * 3),
    OA: new Float32Array(NP), OD: new Float32Array(NP), lut: new Float32Array(513 * 3), tab: [new Float64Array(181), new Float64Array(181)],
    om: new Float64Array(NF), wt: new Float64Array(NF), cc: new Float64Array(NF), ss: new Float64Array(NF),
    br: new Float64Array(NX), bi: new Float64Array(NX), cr: new Float64Array(NX), ci: new Float64Array(NX),
    ir: new Float64Array(NX), ii: new Float64Array(NX), rr: new Float64Array(NX), ri: new Float64Array(NX),
    tr: new Float64Array(NX), ti: new Float64Array(NX),
  };
}

// The prime nearest the knob.
function primeIndex(v) {
  let best = 0;
  for (let i = 1; i < PRIMES.length; i++) if (abs(PRIMES[i] - v) < abs(PRIMES[best] - v) - 1e-9) best = i;
  return best;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 7, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const pi = primeIndex(cl(k[2] == null ? 7 : k[2], 7, 23));
  const kk = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  // Pitch above the design pitch, as the ratio q = l0 / l: 0.75 at 0, 1 at the opening 0.06, 2 at 1.
  const q = kk < 0.06 ? 1 - ((0.06 - kk) / 0.06) * 0.25 : Math.pow(2, (kk - 0.06) / 0.94);
  const lamq = Math.round((LAM0 / q) * 20);
  S.t += d * S.speed;
  if (pi !== S.pi || lamq !== S.lamq) {
    S.pi = pi;
    S.lamq = lamq;
    S.N = PRIMES[pi];
    S.lam = lamq / 20;
    build(S);
  }
}

// Everything that depends on the prime and the wavelength: the nine fields
// above both walls, the walls, the arcs and the beads. About 15 ms.
function build(S) {
  const N = S.N, lam = S.lam, k0 = (2 * PI) / lam, NP = W * H;
  const { br, bi, cr, ci, ir, ii, rr, ri, tr, ti, AR, AI, FA, BASE, wt, om } = S;
  FA.fill(0);
  let wsum = 0;
  for (let f = 0; f < NF; f++) {
    const dl = (f - (NF - 1) / 2) * DD, k = k0 * (1 + dl), kx0 = k * sin(TH);
    om[f] = CSP * k;
    wt[f] = exp(-(dl / BW) * (dl / BW));
    wsum += wt[f];
    // The beam's field on the wall plane, and the diffuser's reflection of it,
    // on the grid, X = i - 127.5 so that column x is i = x + 96.
    const amp = 1 / sqrt(orders(N, (2 * PI) / k).tot);
    for (let i = 0; i < NX; i++) {
      const X = i - 127.5, gx = (X - XC) / W0, g = exp(-gx * gx), ph = kx0 * X;
      br[i] = g * cos(ph);
      bi[i] = g * sin(ph);
      const dd = wellOf(i - 96, N).d, c = cos(2 * k * dd), s = sin(2 * k * dd);
      cr[i] = (br[i] * c - bi[i] * s) * amp;
      ci[i] = (br[i] * s + bi[i] * c) * amp;
    }
    ir.set(br);
    ii.set(bi);
    fft(ir, ii, -1);
    rr.set(cr);
    ri.set(ci);
    fft(rr, ri, -1);
    if (f === (NF - 1) / 2) farField(S, k);
    const base = f * NP;
    for (let zone = 0; zone < 2; zone++) {
      const yw = YW[zone], top = zone === 0 ? 0 : 64;
      for (let y = top; y < yw; y++) {
        const z = yw - y - 0.5;
        for (let m = 0; m < NX; m++) {
          const kxm = (2 * PI * (m < NX / 2 ? m : m - NX)) / NX, kz2 = k * k - kxm * kxm;
          const sr = zone === 0 ? ir[m] : rr[m], si = zone === 0 ? ii[m] : ri[m];
          if (kz2 >= 0) {
            // The beam travels down, exp(-i kz z); what the wall sends back travels up, exp(+i kz z).
            const kz = sqrt(kz2), c = cos(kz * z), s = sin(kz * z);
            tr[m] = ir[m] * c + ii[m] * s + sr * c - si * s;
            ti[m] = ii[m] * c - ir[m] * s + si * c + sr * s;
          } else {
            const e = exp(-sqrt(-kz2) * z);
            tr[m] = sr * e;
            ti[m] = si * e;
          }
        }
        fft(tr, ti, 1);
        for (let x = 0; x < W; x++) {
          const j = (x + 96) & MASK, p = y * W + x;
          AR[base + p] = tr[j] / NX;
          AI[base + p] = ti[j] / NX;
          FA[p] = 1;
        }
      }
      if (zone === 1) {
        // Inside a well: down and back, with the beam at the mouth for the amplitude.
        for (let x = 0; x < W; x++) {
          const d = wellOf(x, N).d, X = x - 31.5, gx = (X - XC) / W0, g = exp(-gx * gx), ph = kx0 * X;
          const ar = g * cos(ph), ai = g * sin(ph), cd = cos(k * d), sd = sin(k * d);
          for (let y = yw; y < H; y++) {
            const cov = cl(d - (y - yw), 0, 1);
            if (cov <= 0) continue;
            const p = y * W + x, cc = 2 * cos(k * (d - (y - yw + 0.5)));
            AR[base + p] = (ar * cd - ai * sd) * cc;
            AI[base + p] = (ar * sd + ai * cd) * cc;
            FA[p] = cov;
          }
        }
      }
    }
  }
  for (let f = 0; f < NF; f++) wt[f] /= wsum;
  // The walls: body colour from the plane down, a bright line on the plane
  // and on each well floor, warm on the floor of the well n = 0.
  for (let zone = 0; zone < 2; zone++) {
    const yw = YW[zone], top = zone === 0 ? 0 : 64;
    for (let x = 0; x < W; x++) {
      const wl = zone === 1 ? wellOf(x, N) : null, d = wl ? wl.d : 0;
      for (let y = yw; y < top + 64; y++) {
        const o = (y * W + x) * 3, dep = y - yw;
        let r = 40, g = 46, b = 72;
        if (y === yw && zone === 0) (r = 130), (g = 140), (b = 175);
        if (zone === 1 && dep + 1 > d && dep < d + 1) {
          const fl = min(1, dep + 1 - d), warm = wl.n === 0;
          r = 40 + (warm ? 215 : 100) * fl;
          g = 46 + (warm ? 170 : 100) * fl;
          b = 72 + (warm ? 70 : 110) * fl;
        }
        BASE[o] = r;
        BASE[o + 1] = g;
        BASE[o + 2] = b;
      }
    }
  }
  S.ord = orders(N, lam);
  overlay(S);
}

// The far field of the beam on each wall at the middle frequency: the pressure
// level per unit angle, |B(k sin t)|^2, from the boundary field's transform,
// for t from -90 to 90 degrees, 1 at the flat wall's peak. Table 0 is the flat
// wall, table 1 the diffuser.
function farField(S, k) {
  const { br, bi, cr, ci, tab } = S;
  let top = 0;
  for (let a = 0; a <= 180; a++) {
    const t = ((a - 90) * PI) / 180, kx = k * sin(t);
    let r0 = 0, i0 = 0, r1 = 0, i1 = 0;
    for (let i = 0; i < NX; i++) {
      const ph = -kx * (i - 127.5), c = cos(ph), s = sin(ph);
      r0 += br[i] * c - bi[i] * s;
      i0 += br[i] * s + bi[i] * c;
      r1 += cr[i] * c - ci[i] * s;
      i1 += cr[i] * s + ci[i] * c;
    }
    tab[0][a] = r0 * r0 + i0 * i0;
    tab[1][a] = r1 * r1 + i1 * i1;
    top = max(top, tab[0][a]);
  }
  for (let a = 0; a <= 180; a++) {
    tab[0][a] /= top;
    tab[1][a] /= top;
  }
}

// The overlay: a dark rim and a white arc at radius RA from the middle of the
// wall, as bright as the far field is at that angle, a ring where the beam
// comes in, and a bead at each order, as large as the order's level.
function overlay(S) {
  const { OA, OD, tab, ord } = S;
  OA.fill(0);
  OD.fill(0);
  const spot = (zone, cx, cy, rad, dark, white, ring) => {
    const yw = YW[zone], top = zone === 0 ? 0 : 64;
    for (let y = max(top, floor(cy - rad - 4)); y < min(yw, cy + rad + 4); y++)
      for (let x = max(0, floor(cx - rad - 4)); x < min(W, cx + rad + 4); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), q = y * W + x;
        OD[q] = max(OD[q], dark * cl(rad + 1.8 - d, 0, 1));
        OA[q] = max(OA[q], white * cl(ring ? 1.1 - abs(d - rad) : rad + 0.5 - d, 0, 1));
      }
  };
  for (let zone = 0; zone < 2; zone++) {
    const yw = YW[zone], top = zone === 0 ? 0 : 64;
    for (let y = top; y < yw; y++)
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - 32, dy = yw - y - 0.5, e = abs(Math.hypot(dx, dy) - RA);
        if (e > 2.2) continue;
        const a = cl((Math.atan2(dx, dy) * 180) / PI + 90, 0, 180), a0 = floor(a), a1 = min(180, a0 + 1);
        const v = sqrt(tab[zone][a0] + (a - a0) * (tab[zone][a1] - tab[zone][a0])), q = y * W + x;
        OD[q] = max(OD[q], 0.45 * cl(1.8 - e, 0, 1));
        OA[q] = max(OA[q], 0.9 * v * cl(1.15 - e, 0, 1));
      }
    spot(zone, 32 - RA * sin(TH), yw - RA * cos(TH), 2.1, 0.5, 0.7, true);
    for (const b of zone === 0 ? [{ th: TH, p: 1 }] : ord)
      spot(zone, 32 + RA * sin(b.th), yw - RA * cos(b.th), 0.8 + 1.5 * sqrt(b.p), 0.7, 1, false);
  }
}

// Pressure to colour, 513 steps from -1 to 1: crest and trough hues, the
// brightness rising fast from dark, white at the top.
function mkLut(S) {
  const { lut } = S;
  const hc = 0.52 + S.hue, ht = hc + 0.4, c = [0, 0, 0];
  for (let i = 0; i <= 512; i++) {
    const u = (i - 256) / 256, a = abs(u), v = (1 - exp(-2.2 * a)) / (1 - exp(-2.2));
    hsv(u >= 0 ? hc : ht, 0.95 - 0.55 * cl((a - 0.7) / 0.3, 0, 1), v, c, 0);
    lut[i * 3] = c[0] * 255;
    lut[i * 3 + 1] = c[1] * 255;
    lut[i * 3 + 2] = c[2] * 255;
  }
  S.hueBuilt = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.pi < 0) return;
  if (S.hue !== S.hueBuilt) mkLut(S);
  const { AR, AI, FA, BASE, OA, OD, lut, om, wt, cc, ss } = S;
  const NP = W * H, PREF = 1.25, tau = S.t - TOFF;
  // The nine frequencies agree at tau = 0, when the pulse is at the wall.
  for (let f = 0; f < NF; f++) {
    cc[f] = wt[f] * cos(om[f] * tau);
    ss[f] = wt[f] * sin(om[f] * tau);
  }
  // The arc and its beads brighten while the pulse crosses them, RA after the wall.
  const T = S.lam / (CSP * DD);
  let u = (tau - RA / CSP) / T;
  u = (u - Math.round(u)) * T;
  const gain = 0.55 + 0.45 * exp(-(u * u) / 1.21);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = p * 3, fa = FA[p];
      let r = BASE[o], g = BASE[o + 1], b = BASE[o + 2];
      if (fa > 0) {
        let sum = 0;
        for (let f = 0, q = p; f < NF; f++, q += NP) sum += AR[q] * cc[f] + AI[q] * ss[f];
        const li = floor((cl(sum / PREF, -1, 1) + 1) * 256 + 0.5) * 3;
        r = r * (1 - fa) + lut[li] * fa;
        g = g * (1 - fa) + lut[li + 1] * fa;
        b = b * (1 - fa) + lut[li + 2] * fa;
      }
      const od = OD[p], oa = OA[p] * gain;
      if (od > 0 || oa > 0) {
        const keep = (1 - od) * (1 - oa);
        r = r * keep + 255 * oa;
        g = g * keep + 255 * oa;
        b = b * keep + 255 * oa;
      }
      display.setPixel(x, y, (r + 0.5) | 0, (g + 0.5) | 0, (b + 0.5) | 0);
    }
}
