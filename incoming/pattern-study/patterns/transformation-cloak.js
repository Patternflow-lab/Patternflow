// ===== Patternflow pattern =====
// Title:   Transformation Cloak
// Family:  transopt
// Idea:    Two plane waves a few degrees apart run down the panel past two cloaks drawn by the map that squeezes a whole virtual disc onto a ring, so their fronts and the grid they ride on bend round a dark hole and come out flat behind it, and the Defect knob turns each cloak back into a bare disc that casts a shadow.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: transformation optics and the cylindrical invisibility cloak (John Pendry, David Schurig and David Smith, Science 2006; Ulf Leonhardt, Science 2006, who found it independently with a conformal map), the first cloak built, for microwaves (David Schurig et al., Science 2006), Fresnel diffraction (Augustin-Jean Fresnel, 1818), pattern round 270
// Round:   270
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=1..3, Hole=-1..1, Defect=0..1
//
// Knob 1: Hue. Adds the knob to the hue of every colour, one turn over the range. At 0 the ground is deep blue, the fronts pale cyan, the squeezed grid gold and the hole violet-black; at 0.12 an indigo ground with lime lines, at 0.4 crimson with cyan. The ground and the hole skip the warm middle of the wheel, where a dim colour reads brown.
// Knob 2: Speed. How fast the fronts run, 8 LEDs a second per unit of the knob: 8 at 1, 16 at the opening 2 where a front passes every 1.1 s, 24 at 3. The wavelength drifts between 14.1 and 20.9 LEDs, the second wave's a little longer, and the direction turns, whatever the knob says.
// Knob 3: Hole. The mean size of the hole as a share of the cloak, a/b = 0.16 at -1, 0.44 at 0 and 0.72 at 1, so the big cloak's hole is 3.4, 9.2 or 15 LEDs in radius, and each hole breathes 0.17 either way at most. A small hole leaves the ring wide and the grid a net with the cells hardly bent; a large one squeezes the ring thin, where the grid thins out and the fronts fade, since the panel cannot draw fronts closer than 4 LEDs.
// Knob 4: Defect. How far each cloak is from perfect, as (K4 to the 1.4) of the way to a bare opaque disc of radius b: the exact map up to 0.1, a ring at 0.39 of its brightness and a wake of Fresnel fringes at 0.5, a dark disc with a shadow 42 LEDs wide that opens out behind it at 1.

// What the picture is. Two plane waves of nearly one wavelength cross the 64 x 128 panel, 7 to 25 degrees apart, drawn as pale fronts on a deep blue ground; the fronts run at the mean of the two phases and dim to 0.4 of their brightness where the waves beat. Two cloaks sit in it, a big one of radius b = 21 LEDs in the upper half of the panel and a small one of 12.5 LEDs in the lower half, each wandering on rates that do not divide, and the waves turn too, starting straight down and going round 0.6 degrees a second, a half turn in five minutes, with a wobble of 9 degrees at most on top. Over the whole panel runs the grid the waves ride on, rays along the mean direction and lines across it, dim blue outside the cloaks and gold where the cloak has squeezed it into the ring. Each hole is dark with a violet rim and a faint glow that drifts about in it.
// The map. The cylindrical cloak of Pendry, Schurig and Smith squeezes the virtual disc of radius b onto the ring a < r < b with r = a + rho (b - a) / b and leaves everything outside r = b where it was. Light that would have crossed the virtual disc is steered round the hole and leaves the ring as it would have left the disc. For a plane wave that makes the field at a point of the ring the plane wave at its pre-image, at the same angle round the centre and at rho = (r - a) b / (b - a). Nothing is simulated: each LED asks which virtual point it is, and the front, the grid and their local spacing all come from that point. Where the front crosses the virtual centre every point of the hole's rim is the same virtual point, so the whole rim lights at once.
// The squeeze. The map stretches by b / (b - a) across the ring and by rho / r along it, so a virtual coordinate s = V . u changes by k (u . e_r) e_r + (rho / r) (u . e_theta) e_theta per LED, k = b / (b - a), with its length exact. It is what makes the fronts crowd to a period of lambda (b - a) / b where they run into the ring and what spreads them to nothing along its sides; fronts fade out as that period falls from 8 LEDs to 4, and lines as their spacing falls from 5.7 to 3.3.
// The defect. The wave behind an opaque strip of half-width b is U = 1 - B, B the Fresnel integral over the strip; the Defect knob takes d of it, so at d = 0 the wake is the waves as they came and at d = 1 it is the strip's shadow with its fringes, and the front's phase shifts with arg U. The ring's intensity falls as (1 - d) squared to meet the shadow at the cloak's downstream edge. This is a picture of an imperfect cloak, not a solution for one: no field is solved, and a reduced cloak like the first microwave one scatters differently.
// What is exact and what is not. The map, the pre-image and its Jacobian are Pendry's, and the fronts have the right phase everywhere and no amplitude but the beat's. The real fields in the ring also change in amplitude with the map and the polarisation turns with it, which the picture leaves out. The Fresnel integrals are a rational fit checked against numeric integration to 0.002, the strip stands in for the cylinder, and the Defect knob's mix with the exact map is a drawing choice, not physics.

const W = 64, H = 128;
const { min, max, floor, sqrt, sin, cos, atan2, abs, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
function toHsv(r, g, b, o) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  o[0] = h / 6;
  o[1] = mx > 0 ? d / mx : 0;
  o[2] = mx / 255;
}
const tmp = [0, 0, 0];
// A palette colour with the knob added to its hue, 0..255 per channel.
function tint(c, off, o) {
  toHsv(c[0], c[1], c[2], tmp);
  hsv(tmp[0] + off, tmp[1], tmp[2], o);
  o[0] *= 255;
  o[1] *= 255;
  o[2] *= 255;
}

// The same for the dim colours, which would go brown at orange: their hue
// jumps from rose to green over a short stretch of the knob and skips the
// warm middle.
function tintDim(c, off, o) {
  toHsv(c[0], c[1], c[2], tmp);
  let h = tmp[0] + off;
  h -= floor(h + 0.04);
  if (h < 0.26) h = -0.04 + 0.3 * sm((h - 0.03) / 0.1);
  hsv(h, tmp[1], tmp[2], o);
  o[0] *= 255;
  o[1] *= 255;
  o[2] *= 255;
}

// Fresnel integrals C and S by a rational fit, within 0.002 of the integral
// (checked against numeric integration at x from 0 to 8).
const cs = [0, 0];
function fres(x) {
  const ax = abs(x), a = (PI * ax * ax) / 2, sa = sin(a), ca = cos(a);
  const f = (1 + 0.926 * ax) / (2 + 1.792 * ax + 3.104 * ax * ax);
  const g = 1 / (2 + 4.142 * ax + 3.492 * ax * ax + 6.67 * ax * ax * ax);
  const sg = x < 0 ? -1 : 1;
  cs[0] = sg * (0.5 + f * sa - g * ca);
  cs[1] = sg * (0.5 - f * ca - g * sa);
}
// The wave behind an opaque strip of half-width b, z behind it, as seen from
// t across: U = 1 - d B with B the Fresnel integral over the strip. Writes
// the intensity and the phase shift in cycles.
function shadow(z, t, lam, b, d, o) {
  const F = sqrt(2 / (lam * z));
  fres((-b - t) * F);
  const c1 = cs[0], s1 = cs[1];
  fres((b - t) * F);
  const dc = cs[0] - c1, ds = cs[1] - s1;
  const ur = 1 - d * 0.5 * (dc + ds), ui = -d * 0.5 * (ds - dc);
  o[0] = ur * ur + ui * ui;
  o[1] = atan2(ui, ur) / TAU;
}

const T0 = 0;
const OX = 32, OY = 64;

export function setup(params) {
  params.s = {
    T: T0, ph: 0, ph2: 0, lam2: 19, dl: 0.28, k: null, pal: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    lam: 19, ux: 0, uy: 1, dd: 0, cl: [{ cx: 0, cy: 0, b: 21, a: 8, k: 1.6 }, { cx: 0, cy: 0, b: 12.5, a: 5, k: 1.6 }],
    gx: 0, gy: 0, gr: 10,
    sh: [0, 0],
  };
}

const DIM = [1, 1, 0, 0, 0, 1, 0, 1, 0];
const BASE = [
  [3, 14, 64],    // 0 ground, lit
  [2, 6, 28],     // 1 ground, in shadow
  [196, 240, 255], // 2 wave front
  [26, 104, 232], // 3 grid outside the cloak
  [255, 186, 52], // 4 grid squeezed in the ring
  [12, 3, 26],    // 5 the hole
  [150, 64, 236], // 6 its rim
  [40, 12, 80],   // 7 what glows in it
  [44, 150, 255], // 8 cross lines outside
];

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) S.k = [kv[0], kv[1], kv[2], kv[3]];
  const al = 1 - exp(-d / 0.1);
  for (let i = 0; i < 4; i++) S.k[i] += (kv[i] - S.k[i]) * al;
  const k = S.k;
  S.T += d;
  const T = S.T;
  // Wave: wavelength drifts, direction wanders, the phase accumulates so a
  // change of Speed never makes a jump.
  S.lam = 17.5 + 2.2 * sin(0.093 * T + 0.7) + 1.2 * sin(0.0587 * T + 2.2);
  S.lam2 = S.lam * (1.07 + 0.05 * sin(0.071 * T + 1));
  S.dl = 0.28 + 0.1 * sin(0.083 * T + 0.5) + 0.05 * sin(0.047 * T + 2);
  S.ph += (8 * cl(k[1], 1, 3) * d) / S.lam;
  S.ph2 += (8 * cl(k[1], 1, 3) * d) / S.lam2;
  const phi = PI / 2 + 0.0105 * T + 0.08 * sin(0.0551 * T + 0.3) + 0.05 * sin(0.0337 * T - 0.4) + 0.02 * sin(0.1163 * T + 0.1);
  S.ux = cos(phi);
  S.uy = sin(phi);
  S.dd = cl(k[3], 0, 1) ** 1.4;
  // Two cloaks that wander over the panel on rates that do not divide, one
  // in the upper part and one in the lower, so they do not meet.
  const qm = 0.44 + 0.28 * cl(k[2], -1, 1);
  // the grid spacing opens out as the ring thins, so the ring keeps lines
  S.gr = 9 + 15 * max(0, qm - 0.35);
  const c1 = S.cl[0], c2 = S.cl[1];
  c1.cx = 32 + 11 * sin(0.173 * T - 0.2) + 6 * sin(0.0937 * T);
  c1.cy = 38 + 10 * sin(0.127 * T + 0.3) + 5 * sin(0.0713 * T - 0.2);
  c2.cx = 32 + 16 * sin(0.143 * T + 0.3) + 6 * sin(0.0811 * T + 0.2);
  c2.cy = 100 + 9 * sin(0.109 * T + 0.2) + 4 * sin(0.0617 * T + 0.4);
  const ex = c2.cx - c1.cx, ey = c2.cy - c1.cy, dist = sqrt(ex * ex + ey * ey), gap = c1.b + c2.b + 3;
  if (dist < gap) {
    c2.cx = c1.cx + (ex / dist) * gap;
    c2.cy = c1.cy + (ey / dist) * gap;
  }
  const q1 = cl(qm + 0.11 * sin(0.31 * T + 0.8) + 0.06 * sin(0.197 * T + 2.5), 0.05, 0.76);
  const q2 = cl(qm + 0.02 + 0.11 * sin(0.27 * T + 3.9) + 0.06 * sin(0.173 * T + 0.9), 0.05, 0.76);
  c1.a = q1 * c1.b;
  c1.k = 1 / (1 - q1);
  c2.a = q2 * c2.b;
  c2.k = 1 / (1 - q2);
  for (let i = 0; i < BASE.length; i++) (DIM[i] ? tintDim : tint)(BASE[i], k[0], S.pal[i]);
  // what glows in each hole drifts about in it
  S.gx = 0.45 * cos(0.61 * T + 1) + 0.2 * cos(0.37 * T);
  S.gy = 0.45 * sin(0.53 * T + 2) + 0.2 * sin(0.29 * T + 1);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { pal, cl: CL, ux, uy, lam, lam2, dd, ph: ph0, ph2: ph1 } = S, GR = S.gr, GC = 2 * S.gr;
  const a1 = atan2(uy, ux) - S.dl / 2, a2 = a1 + S.dl, u1x = cos(a1), u1y = sin(a1), u2x = cos(a2), u2y = sin(a2);
  const nx = -uy, ny = ux;
  const gLit = pal[0], gSh = pal[1], wave = pal[2], rayO = pal[3], gold = pal[4], holeC = pal[5], rimC = pal[6], glowC = pal[7], crossO = pal[8];
  const sh = S.sh;
  const defect = dd > 0.004;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      let vx = px, vy = py, gs = 1, gt = 1, ci = -1, r = 0, dx = 0, dy = 0, kap = 0;
      for (let i = 0; i < 2; i++) {
        const c = CL[i];
        dx = px - c.cx;
        dy = py - c.cy;
        const r2 = dx * dx + dy * dy;
        if (r2 < c.b * c.b) {
          ci = i;
          break;
        }
      }
      let I = 1, dph = 0;
      if (ci >= 0) {
        const c = CL[ci];
        r = sqrt(dx * dx + dy * dy);
        if (r < 0.001) r = 0.001;
        const rho = max(r - c.a, 0) * c.k, m = rho / r;
        vx = c.cx + dx * m;
        vy = c.cy + dy * m;
        const erx = dx / r, ery = dy / r;
        const ur = ux * erx + uy * ery, ut = -ux * ery + uy * erx;
        gs = sqrt(c.k * c.k * ur * ur + m * m * ut * ut);
        gt = sqrt(c.k * c.k * ut * ut + m * m * ur * ur);
        kap = sm(c.b + 0.5 - r);
        I = (1 - dd) * (1 - dd);
      }
      if (defect) {
        for (let i = 0; i < 2; i++) {
          if (i === ci) continue;
          const c = CL[i], ex = px - c.cx, ey = py - c.cy, ss = ex * ux + ey * uy;
          if (ss > 0.3) {
            shadow(ss, ex * nx + ey * ny, lam, c.b, dd, sh);
            I *= sh[0];
            dph += sh[1];
          }
        }
      }
      const qx = vx - OX, qy = vy - OY, s = qx * ux + qy * uy, t = qx * nx + qy * ny;
      // the wave front: two plane waves a few degrees apart, whose fronts
      // run at the mean phase and brighten and dim where they beat; a soft
      // pale band, faded where it gets finer than the panel
      const th1 = (qx * u1x + qy * u1y) / lam - ph0 + dph, th2 = (qx * u2x + qy * u2y) / lam2 - ph1 + dph;
      const b1 = 0.5 + 0.5 * cos(PI * (th1 + th2)), env = 0.7 + 0.3 * cos(TAU * (th1 - th2));
      const fade = sm((lam / max(gs, 0.02) - 4.2) / 3.6);
      const w = b1 * b1 * b1 * b1 * env * fade * I * 0.95;
      let R = gSh[0] + (gLit[0] - gSh[0]) * I, G = gSh[1] + (gLit[1] - gSh[1]) * I, B = gSh[2] + (gLit[2] - gSh[2]) * I;
      R += (wave[0] - R) * w;
      G += (wave[1] - G) * w;
      B += (wave[2] - B) * w;
      // the grid: virtual lines 2 LEDs wide, lines of constant t along the
      // rays and, dimmer, lines of constant s across them
      const tn = t / GR + 0.31, fr = tn - floor(tn + 0.5);
      const dr = (abs(fr) * GR) / max(gt, 0.05);
      const ar = cl((1.4 - dr) * 1.8, 0, 1) * sm((GR / max(gt, 0.05) - 3.3) / 2.4) * (0.22 + 0.73 * kap) * (0.3 + 0.7 * I);
      const sn = s / GC + 0.13, fc = sn - floor(sn + 0.5);
      const dc = (abs(fc) * GC) / max(gs, 0.05);
      const ac = cl((1.4 - dc) * 1.8, 0, 1) * sm((GC / max(gs, 0.05) - 3.3) / 2.4) * (0.02 + 0.68 * kap) * (0.3 + 0.7 * I);
      let lr = rayO[0] + (gold[0] - rayO[0]) * kap, lg = rayO[1] + (gold[1] - rayO[1]) * kap, lb = rayO[2] + (gold[2] - rayO[2]) * kap;
      R += (lr - R) * ar;
      G += (lg - G) * ar;
      B += (lb - B) * ar;
      lr = crossO[0] + (gold[0] - crossO[0]) * kap;
      lg = crossO[1] + (gold[1] - crossO[1]) * kap;
      lb = crossO[2] + (gold[2] - crossO[2]) * kap;
      R += (lr - R) * ac;
      G += (lg - G) * ac;
      B += (lb - B) * ac;
      if (ci >= 0) {
        const c = CL[ci];
        // the hole: nearly black with a violet rim and a faint glow that
        // drifts about in it, which the outside never sees
        const depth = c.a - r;
        const rim = cl(1 - (r - c.a) / 2.2, 0, 1);
        const hm = sm(depth + 0.5);
        if (rim > 0) {
          const ra = rim * rim * 0.6;
          R += (rimC[0] - R) * ra;
          G += (rimC[1] - G) * ra;
          B += (rimC[2] - B) * ra;
        }
        if (hm > 0) {
          const gx = c.cx + S.gx * c.a, gy = c.cy + S.gy * c.a, gd2 = (px - gx) * (px - gx) + (py - gy) * (py - gy), sg = 0.3 * c.a + 1.2;
          const gl = exp(-gd2 / (2 * sg * sg)) * 0.55 + 0.4 * exp(-depth / 2.4);
          const hr = holeC[0] + glowC[0] * gl, hg = holeC[1] + glowC[1] * gl, hb = holeC[2] + glowC[2] * gl;
          R += (hr - R) * hm;
          G += (hg - G) * hm;
          B += (hb - B) * hm;
        }
      }
      display.setPixel(x, y, cl(R, 0, 255) | 0, cl(G, 0, 255) | 0, cl(B, 0, 255) | 0);
    }
  }
}
