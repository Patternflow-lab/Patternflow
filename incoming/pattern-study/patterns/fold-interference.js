// ===== Patternflow pattern =====
// Title:   Fold Interference
// Family:  foldmap
// Idea:    A geological map of a region whose rock layers were folded twice, seen from above: a stack of ochre, terracotta, olive, slate and cream beds, already folded once into isoclinal folds, is folded again across another axis, and the nearly flat erosion surface that cuts it draws the beds as nested ovals, crescents, hooks and chevrons that grow, merge and open as the surface slowly sinks and rises through the stack.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: fold interference patterns, the dome-and-basin, crescent and mushroom outcrops of two superposed folds (John Ramsay, Folding and Fracturing of Rocks, 1967, from memory), the colouring of a geological map by the stratigraphic coordinate of the stack under a surface, original code, pattern round 274
// Round:   274
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Depth=0..4, Squeeze=-1..1, Angle=-1..1
//
// Knob 1: Hue. Turns all seven beds round the colour wheel together. 0 is the pigments as drawn: cream, ochre, terracotta, a plum marker, olive, slate teal and a dark teal marker. At 0.5 every bed has gone half way round; at 1 it is back.
// Knob 2: Depth. How far the erosion surface has cut down into the folded pile, 8.5 bed LEDs for each unit of the knob: the top of the pile at 0, 17 LEDs down where it opens at 2, 34 down at 4. The folds are tighter lower in the pile, so the amplitude of both sets is x0.53 at 0, x1.0 at 2 and x1.47 at 4: shallow it is a few wide ovals of the top beds, deep it is the tight rings of the core. It also slides the whole stack past the surface, so turning it runs rings through the picture.
// Knob 3: Squeeze. How hard the second folding has pressed the pile. The F2 amplitude is 0 at -1, where only the first folds are left (sheared zig-zag stripes), 4.1 bed LEDs at 0 where it opens and 8.5 at 1, times the depth factor above and a drift of 18 percent. Its wavelength falls from 64 LEDs to 50 as it grows.
// Knob 4: Angle. The angle between the F1 and F2 axes, 90 degrees x (K4 + 1) / 2. At -1 it is 0, both sets share an axis and the picture is stripes; it opens at 47.7 degrees, all hooks and wedges; at 1 the axes cross at 90 degrees and the picture is domes and basins. A wander of 15 degrees (49 s) and 5 degrees (61 s) sits on top in the middle of the range, a third of that at the ends.
//
// What the picture is. A plan view, one LED to a patch of ground, of a pile of beds under a nearly flat erosion surface. Each LED shows the bed the surface meets there, and nothing else is drawn. The colour steps are the contacts. No separate contact line is drawn, since one 1.5 LED wide turns to mud where the beds crowd; the two dark marker beds in every cycle do that work, 1.6 LEDs wide at the median. The surface is a level that sinks and rises through the pile, plus a tilt of up to 0.12 bed LED per LED.
// The pile. One cycle is seven beds, 12.9 bed LEDs: cream 3.4, ochre 1.8, terracotta 1.5, plum marker 1.0, olive 2.1, slate teal 2.2, dark teal marker 0.9. The table holds 48 cycles, about 620 LEDs of pile, and wraps beyond that. Each bed's thickness is jittered by up to 20 percent and its brightness by up to 8, once at setup, so no two cycles are the same.
// The folds. The stratigraphic coordinate sigma of a point in the folded pile is the height that point had before folding, and each LED is coloured by which bed sigma falls in. It is found by undoing the two foldings in turn, each an explicit inverse, so nothing is iterated. With zs the height of the surface at the LED, F2 is an upright fold, vertical axial planes, that lifts and lowers the pile by A2 f(k2 u + p2), u being the distance across the F2 trend: z1 = zs - A2 f. F1 is an upright fold of the beds that was then tipped over by a simple shear, x to x + g z, so its axial planes lean over by atan g, 6 to 63 degrees: sigma = z1 - B1 f(k1 (q - g z1) + p1), q being the distance across the F1 trend. The F2 trend is turned from the F1 axis by the angle of knob 4. f is asin(0.9 sin p) / asin(0.9) for F1 and with 0.7 for F2: a sine with the hinges kept round and the limbs straight. The amplitudes follow the height of the surface and not z1, which is the choice that keeps the inversion explicit.
// What comes out. Where an F2 hinge crosses an F1 hinge sigma has a maximum or a minimum and the beds close round it as ovals; at 90 degrees and no shear that is the dome and basin of Ramsay's first type. The shear slides the F1 pattern across the F2 folds by g A2 f, 8 LEDs at the opening squeeze and 17 at the top of the shear's range against an F1 wavelength of 40, and the ovals open into hooks and boomerangs. With the squeeze off the sections are the zig-zag stripes of F1 alone, and the tilt makes their noses chevrons. With the angle at 0 sigma depends on one coordinate and nothing closes.
// How a bed is coloured. At each corner of the LED grid sigma is computed, and the LED takes the mean of the bed colours over sigma plus and minus 0.75 of its gradient, 1.5 LED across, from a running integral of colour over the table, so a bed narrower than that fades into the mean and does not alias. At the opening knobs the median gradient of sigma is 0.59 bed LED per LED, an average bed (1.84) is 3.1 LEDs wide, 87 percent of the picture has beds wider than 2 LEDs and 5 percent narrower than 1.5.
// The drift. All time runs at 1.8 times the Lab's. The surface level is 5.5, 3.5 and 2.2 bed LEDs of sine at 47, 79 and 31 s (model seconds, 26, 44 and 17 s in the Lab), so rings grow, merge and open. The tilt, the direction of F1, the wavelengths of both sets (40 and 64 LEDs, each 12 to 15 percent), the F2 amplitude, the shear g (1.05, 0.1 to 2) and the angle each wander on a sine or two of their own, and both folds slide across their trends at about 1 LED a second. The 21 periods are between 31 and 131 model seconds and none is a multiple of another, so it does not come round again, and nothing accumulates: the picture is a function of time and the knobs, easing over 0.2 s.
// What is exact and what is drawn. Colouring a map by sigma of a doubly folded pile under a surface, with the folds as displacement maps and the map found by inverting them, is Ramsay's way of modelling interference. The shapes f, the amplitudes, the rule that folds tighten with depth (it makes Depth change the picture and not only its colours), the pile, the colours and the 1.5 LED filter are drawing choices.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, min, max, abs, pow, asin, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---------------------------------------------------------------- the stack
// One cycle of the pile, bottom to top, thickness in the stratigraphic unit (call it a bed LED):
// [thickness, hue (turns), saturation, value]
const BEDS = [
  [3.4, 0.12, 0.19, 0.98],  // cream sandstone, the thick pale bed
  [1.8, 0.105, 0.88, 0.92],  // ochre sandstone
  [1.5, 0.035, 0.80, 0.84],  // terracotta shale
  [1.0, 0.86, 0.70, 0.50],   // plum marker bed
  [2.1, 0.19, 0.74, 0.66],   // olive siltstone
  [2.2, 0.50, 0.66, 0.62],   // slate teal limestone
  [0.9, 0.56, 0.85, 0.34],   // dark teal marker bed
];
let CYC = 0;
for (let i = 0; i < BEDS.length; i++) CYC += BEDS[i][0];

const NCY = 48;                       // cycles in the table, wrapped beyond
const RES = 32;                       // table cells per bed LED
const TLEN = Math.ceil(NCY * CYC * 1.25 * RES) + 4;
const CUM = new Float64Array(TLEN * 3 + 3); // running integral of colour over the stratigraphic coordinate

// per-cycle jitter of every bed's thickness and brightness, fixed in setup
const JT = new Float32Array(NCY * BEDS.length);
const JV = new Float32Array(NCY * BEDS.length);
let NTAB = 0, CYCLEN = 1, RESX = RES;
const BND = new Float32Array(NCY * BEDS.length + 1);

function buildTable(hueShift) {
  // lay the beds out
  let pos = 0, nb = 0;
  for (let c = 0; c < NCY; c++)
    for (let i = 0; i < BEDS.length; i++) {
      BND[nb++] = pos;
      pos += BEDS[i][0] * JT[c * BEDS.length + i];
    }
  BND[nb] = pos;
  CYCLEN = pos;
  const n = Math.ceil(pos * RES);
  NTAB = n;
  RESX = n / pos;
  const o = [0, 0, 0];
  let b = 0, r = 0, g = 0, bl = 0;
  // colours of each bed
  const col = new Float32Array(nb * 3);
  for (let k = 0; k < nb; k++) {
    const i = k % BEDS.length;
    const B = BEDS[i];
    hsv(B[1] + hueShift, B[2], cl(B[3] * JV[k], 0, 1), o);
    col[k * 3] = o[0] * 255;
    col[k * 3 + 1] = o[1] * 255;
    col[k * 3 + 2] = o[2] * 255;
  }
  CUM[0] = CUM[1] = CUM[2] = 0;
  for (let j = 0; j < n; j++) {
    const s = (j + 0.5) / RESX;
    while (b < nb - 1 && s >= BND[b + 1]) b++;
    r += col[b * 3] / RESX;
    g += col[b * 3 + 1] / RESX;
    bl += col[b * 3 + 2] / RESX;
    CUM[(j + 1) * 3] = r;
    CUM[(j + 1) * 3 + 1] = g;
    CUM[(j + 1) * 3 + 2] = bl;
  }
}

// the integral of colour from 0 to s, s taken modulo the whole table
const IC = [0, 0, 0];
function cumAt(s) {
  const L = CYCLEN;
  const w = floor(s / L);
  s -= w * L;
  const x = s * RESX, j = x | 0, f = x - j;
  const a = j * 3, bb = a + 3;
  IC[0] = CUM[a] + (CUM[bb] - CUM[a]) * f + w * CUM[NTAB * 3];
  IC[1] = CUM[a + 1] + (CUM[bb + 1] - CUM[a + 1]) * f + w * CUM[NTAB * 3 + 1];
  IC[2] = CUM[a + 2] + (CUM[bb + 2] - CUM[a + 2]) * f + w * CUM[NTAB * 3 + 2];
}

// ---------------------------------------------------------------- the fold shapes
// a fold profile with rounded hinges and straight limbs: asin(k sin p) / asin(k)
const LUTN = 4096;
function lutFold(kap) {
  const a = new Float32Array(LUTN + 2), den = asin(kap);
  for (let i = 0; i < LUTN + 2; i++) a[i] = asin(kap * sin((i * TAU) / LUTN)) / den;
  return a;
}
const FOLD1 = lutFold(0.9);
const FOLD2 = lutFold(0.7);
function look(T, ph) {
  let x = ph * (LUTN / TAU);
  x -= floor(x / LUTN) * LUTN;
  const j = x | 0, f = x - j;
  return T[j] + (T[j + 1] - T[j]) * f;
}

// ---------------------------------------------------------------- state
const SG = new Float32Array((W + 1) * (H + 1));
export function setup(params) {
  const ph = [];
  for (let i = 0; i < 40; i++) ph.push(TAU * Math.random());
  for (let i = 0; i < JT.length; i++) {
    JT[i] = 1 + 0.2 * (Math.random() - 0.5) * 2;
    JV[i] = 1 - 0.08 * Math.random();
  }
  params.s = { t: 0, k: null, ph, hue: -9 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.t += d * 1.8;
}

// ---------------------------------------------------------------- draw
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.t, k = S.k, p = S.ph;
  const sn = (per, i) => sin((TAU * T) / per + p[i]);

  if (abs(S.hue - k[0]) > 0.0005) {
    buildTable(k[0]);
    S.hue = k[0];
  }

  const dep = cl(k[1] / 4, 0, 1);
  const f3 = cl((k[2] + 1) / 2, 0, 1);
  const ang = (90 * cl((k[3] + 1) / 2, 0, 1)) * (PI / 180);

  // the erosion surface: level, tilt
  const zs0 = -34 * dep + 5.5 * sn(47, 0) + 3.5 * sn(79, 1) + 2.2 * sn(31, 2);
  const gx = 0.05 * sn(73, 3) + 0.03 * sn(41, 4);
  const gy = 0.06 * sn(97, 5) + 0.03 * sn(57, 6);

  // F1: isoclinal, sheared; F2: upright, rotated
  const phi1 = 0.25 * sn(131, 7) + 0.1 * sn(53, 8) + 0.3;
  const th = ang + (0.26 * sn(89, 9) + 0.09 * sn(109, 22)) * (0.3 + 0.7 * sin(2 * ang));
  const c1 = cos(phi1), s1 = sin(phi1), c2 = cos(phi1 + th), s2 = sin(phi1 + th);
  const lam1 = 40 * (1 + 0.12 * sn(61, 10) + 0.06 * sn(37, 11));
  const lam2 = 64 * (1 - 0.22 * f3) * (1 + 0.15 * sn(101, 12) + 0.07 * sn(43, 13));
  const k1 = TAU / lam1, k2 = TAU / lam2;
  const A2m = 8.5 * pow(f3, 1.05) * (1 + 0.18 * sn(67, 14));
  const B1m = 5 * (1 + 0.15 * sn(83, 15));
  const gam = 1.05 + 0.7 * sn(127, 16) + 0.25 * sn(49, 17);
  const psi1 = 0.09 * T + 1.2 * sn(71, 18) + p[19];
  const psi2 = 0.07 * T + 1.0 * sn(59, 20) + p[21];
  // a very open third warp of the F1 trend, 85 LEDs from crest to crest and 3.5 LEDs deep, in a direction of its own
  const a3 = 1.1 + 0.5 * sn(113, 23), c3 = cos(a3), s3 = sin(a3), k3w = TAU / 85, psi3 = 0.05 * T + p[24];

  for (let j = 0; j <= H; j++) {
    const yy = j - 63.5;
    for (let i = 0; i <= W; i++) {
      const xx = i - 31.5;
      const zs = zs0 + gx * xx + gy * yy;
      const gd = 1 - 0.72 * tanh((zs + 17) / 22);
      const gd1 = 0.7 + 0.3 * gd;
      const u = xx * c2 + yy * s2;
      const q = xx * c1 + yy * s1 + 3.5 * sin(k3w * (xx * c3 + yy * s3) + psi3);
      const z1 = zs - A2m * gd * look(FOLD2, k2 * u + psi2);
      const sg = z1 - B1m * gd1 * look(FOLD1, k1 * (q - gam * z1) + psi1);
      SG[j * (W + 1) + i] = sg;
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = y * (W + 1) + x;
      const s00 = SG[a], s10 = SG[a + 1], s01 = SG[a + W + 1], s11 = SG[a + W + 2];
      const sg = 0.25 * (s00 + s10 + s01 + s11);
      const gxs = 0.5 * (s10 + s11 - s00 - s01), gys = 0.5 * (s01 + s11 - s00 - s10);
      const gm = sqrt(gxs * gxs + gys * gys);
      const h = max(0.02, 0.75 * gm);
      cumAt(sg + h);
      const r1 = IC[0], g1 = IC[1], b1 = IC[2];
      cumAt(sg - h);
      const inv = 1 / (2 * h);
      display.setPixel(
        x, y,
        cl(((r1 - IC[0]) * inv + 0.5) | 0, 0, 255),
        cl(((g1 - IC[1]) * inv + 0.5) | 0, 0, 255),
        cl(((b1 - IC[2]) * inv + 0.5) | 0, 0, 255)
      );
    }
  }
}
