// ===== Patternflow pattern =====
// Title:   Laue Pattern
// Family:  crystallography
// Idea:    A single crystal turning slowly in a white X-ray beam, and on the film behind it the spots of every lattice plane that finds a wavelength to reflect: each a soft disc coloured by its own wavelength, sliding along the ellipses of its zone, blooming out of the dark beam stop and winking out where the beam's band ends.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Laue diffraction, Max von Laue, Walter Friedrich and Paul Knipping (1912)
// Round:   202
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spin=0..4, Zone=-1..1, Reach=-1..1
//
// Knob 1: Hue. Which part of the colour wheel the beam's wavelengths are laid on: the long ones red and the short ones blue where the knob opens, the whole band turning round the wheel as it goes up.
// Knob 2: Spin. How fast the crystal turns: stopped at 0, where the spots hold still, one slow turn in about 90 seconds where the knob opens and twice as quick at the top.
// Knob 3: Zone. Which way the crystal faces the beam: along a cube edge at the bottom, where the spots fall in a four-fold rosette, along a face diagonal in the middle where the knob opens, and along the body diagonal at the top, where the rosette turns three-fold.
// Knob 4: Reach. How far the beam's short wavelengths reach: a handful of warm, widely spaced spots at the bottom, a crowd of fainter blue high-order spots round the beam stop at the top.

const W = 64;
const H = 128;
const CX = 32;
const CY = 64;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

// Rotation matrices are nine numbers, row by row.
function rotX(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
function rotY(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
function rotZ(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
function mul(a, b) {
  const o = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
  }
  return o;
}
// Rotation by an angle about a unit axis (Rodrigues).
function axisAngle(x, y, z, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

// The lattice: face-centred cubic, cell edge 1, so a plane (h k l) has reciprocal vector (h, k, l) in units of 1 / cell edge.
const NMAX = 13;
const GMAX = 13.2;
// Beam, in units of 1 / wavelength (the cell edge is 1): the band's long edge, and the spectrum's peak.
const KMIN = 1.6;
const KPEAK = 5.5;
// Distance from crystal to film, in LEDs.
const DIST = 30;
// Debye-Waller factor.
const BDW = 0.004;

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function setup(params) {
  const gx = [];
  const gy = [];
  const gz = [];
  for (let h = -NMAX; h <= NMAX; h++) {
    for (let k = -NMAX; k <= NMAX; k++) {
      for (let l = -NMAX; l <= NMAX; l++) {
        if (h === 0 && k === 0 && l === 0) continue;
        // Face-centred: the indices all even or all odd.
        if (((h & 1) !== (k & 1)) || ((k & 1) !== (l & 1))) continue;
        if (h * h + k * k + l * l > GMAX * GMAX) continue;
        gx.push(h);
        gy.push(k);
        gz.push(l);
      }
    }
  }
  // Each plane's reflectivity wanders on a beat of its own, as the blocks of a not quite perfect crystal do.
  const gw = [];
  const gp = [];
  for (let i = 0; i < gx.length; i++) {
    gw.push(0.11 + 0.3 * hash(gx[i] + 31, gy[i] * 57 + gz[i] * 3 + 5));
    gp.push(6.2832 * hash(gz[i] + 77, gx[i] * 91 + gy[i] * 13 + 9));
  }
  params.gw = Float32Array.from(gw);
  params.gp = Float32Array.from(gp);
  params.tt = 0;
  params.n = gx.length;
  params.gx = Float32Array.from(gx);
  params.gy = Float32Array.from(gy);
  params.gz = Float32Array.from(gz);
  params.ph = [0.7, 0.15, 3.04, 0, 3.14, 0, 3.14, 0.8, 2.5, 0.1, 0.05, 0.5];
  params.alpha = 0.55;
  params.hue = 0;
  params.kmax = 3;
  params.kpeak = KPEAK;
  params.sx = new Float32Array(600);
  params.sy = new Float32Array(600);
  params.si = new Float32Array(600);
  params.sk = new Float32Array(600);
  params.ns = 0;
  params.buf = new Float32Array(W * H * 3);
  // The film's own light, which does not move: scatter falling off from the beam, a faint ring round the stop, and the stop itself.
  params.glow = new Float32Array(W * H);
  params.stop = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      const dy = y + 0.5 - CY;
      const r = Math.sqrt(dx * dx + dy * dy);
      params.glow[y * W + x] = 0.3 * Math.exp(-r / 12) + 0.1 * Math.exp(-r / 34) + 0.1 * Math.exp(-((r - 7.4) * (r - 7.4)) / 1.6);
      params.stop[y * W + x] = smooth(2.8, 4.6, r);
    }
  }
}

// The crystal's turn that puts a cube edge [001], then a face diagonal [011], then the body diagonal [111] on the beam; u runs 0 to 2 across the three.
function zoneMatrix(u) {
  const quarter = Math.PI / 4;
  if (u <= 1) return rotX(quarter * u);
  // With [011] on the beam the body diagonal stands at an angle acos(sqrt(2/3)) from it, in the x-z plane.
  return mul(axisAngle(0, -1, 0, Math.acos(Math.sqrt(2 / 3)) * (u - 1)), rotX(quarter));
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const spin = clamp(k[1], 0, 4) / 2;
  const ph = params.ph;
  // Twelve slow beats, none a multiple of another: the turn about the beam, two tilts on three beats each and one slower, the band edge and the spectrum.
  const RATE = [0.07, 0.0813, 0.0971, 0.0719, 0.0627, 0.0489, 0.0731, 0.0231, 0.0417, 0.0273, 0.0311, 0.0137];
  for (let i = 0; i < ph.length; i++) ph[i] += dt * spin * RATE[i];
  params.tt += dt * spin;
  const zone = clamp(k[2], -1, 1) + 1;
  params.hue = k[0];
  const reach = clamp(k[3], -1, 1);
  // The beam's short end breathes a little as the source drifts.
  params.kmax = 6.0 * Math.pow(3.2, (reach + 1) / 2) * (1 + 0.09 * Math.sin(ph[8]));

  const alpha = params.alpha + ph[0] + 0.7 * Math.sin(ph[7]);
  const tx = 0.3 * Math.sin(ph[1]) + 0.17 * Math.sin(ph[3]) + 0.1 * Math.sin(ph[5]) + 0.3 * Math.sin(ph[9]);
  const ty = 0.3 * Math.sin(ph[2]) + 0.17 * Math.sin(ph[4]) + 0.1 * Math.sin(ph[6]) + 0.3 * Math.sin(ph[10]);
  const R = mul(mul(mul(rotZ(alpha), rotX(tx)), rotY(ty)), zoneMatrix(zone));

  const kmax = params.kmax;
  params.kpeak = KPEAK * (1 + 0.25 * Math.sin(ph[11]));
  const gx = params.gx;
  const gy = params.gy;
  const gz = params.gz;
  const n = params.n;
  let ns = 0;
  for (let i = 0; i < n; i++) {
    const x0 = gx[i];
    const y0 = gy[i];
    const z0 = gz[i];
    const g3 = R[6] * x0 + R[7] * y0 + R[8] * z0;
    if (g3 > -0.02) continue;
    const g1 = R[0] * x0 + R[1] * y0 + R[2] * z0;
    const g2 = R[3] * x0 + R[4] * y0 + R[5] * z0;
    const gg = x0 * x0 + y0 * y0 + z0 * z0;
    const a = -g3;
    const kk = gg / (2 * a);
    if (kk < KMIN || kk > kmax) continue;
    const kz = (g1 * g1 + g2 * g2 - g3 * g3) / (2 * a);
    if (kz < 0.3) continue;
    const X = (DIST * g1) / kz;
    const Y = (DIST * g2) / kz;
    if (X < -42 || X > 42 || Y < -76 || Y > 76) continue;
    // Spectrum: a smooth hump, lopsided so the short wavelengths fall away slowly.
    const lr = Math.log(kk / params.kpeak);
    const sp = Math.exp((-lr * lr) / (2 * (lr > 0 ? 0.8 : 0.9) * (lr > 0 ? 0.8 : 0.9)));
    const edge = smooth(KMIN, KMIN + 1.2, kk) * (1 - smooth(kmax * 0.82, kmax, kk));
    // Structure factor weight is 1 for every allowed plane; Debye-Waller, the beam at this wavelength, the band edge and the plane's own wander follow.
    const wander = 0.5 + 0.5 * Math.sin(params.tt * params.gw[i] + params.gp[i]);
    const inten = (Math.exp(-BDW * gg) * sp * edge * wander) / (1 + 0.03 * gg);
    if (inten < 0.06) continue;
    if (ns >= 600) break;
    params.sx[ns] = X;
    params.sy[ns] = Y;
    params.si[ns] = inten;
    params.sk[ns] = kk;
    ns++;
  }
  params.ns = ns;
}

export function draw(display, params) {
  const buf = params.buf;
  buf.fill(0);
  const rgb = [0, 0, 0];
  const hue0 = 0.02 + params.hue;
  // Diffuse glow: air and sample scatter, a tint opposite the band's long end.
  const bg = [0, 0, 0];
  hsv(hue0 + 0.5, 0.42, 1, bg);
  for (let i = 0; i < W * H; i++) {
    const gl = params.glow[i];
    buf[i * 3] = gl * bg[0];
    buf[i * 3 + 1] = gl * bg[1];
    buf[i * 3 + 2] = gl * bg[2];
  }
  const ns = params.ns;
  for (let s = 0; s < ns; s++) {
    const X = params.sx[s];
    const Y = params.sy[s];
    const I = params.si[s];
    const kk = params.sk[s];
    const r = Math.sqrt(X * X + Y * Y);
    const cx = CX + X;
    const cy = CY + Y;
    const t = clamp(Math.log(kk / 4) / Math.log(9.5 / 4), 0, 1);
    const sat = 0.25 + 0.65 * smooth(5, 18, r);
    hsv(hue0 + 0.62 * t, sat, 1, rgb);
    const sg = 1 + 0.45 * Math.sqrt(I);
    const el = Math.min(1.7, 1 + 0.25 * (r / DIST) * (r / DIST));
    const ux = r > 0.01 ? X / r : 1;
    const uy = r > 0.01 ? Y / r : 0;
    const srad = sg * el;
    const rr = Math.ceil(3.2 * srad);
    const x0 = Math.max(0, Math.floor(cx - rr));
    const x1 = Math.min(W - 1, Math.ceil(cx + rr));
    const y0 = Math.max(0, Math.floor(cy - rr));
    const y1 = Math.min(H - 1, Math.ceil(cy + rr));
    const amp = 5 * Math.pow(I, 0.85) * smooth(0.06, 0.15, I);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const pr = dx * ux + dy * uy;
        const pt = -dx * uy + dy * ux;
        const q = (pr * pr) / (srad * srad) + (pt * pt) / (sg * sg);
        if (q > 10) continue;
        // A soft aura round the core, so a strong spot glows.
        const au = 1 - q / 10;
        const w = amp * (Math.exp(-0.5 * q) + 0.07 * Math.exp(-0.09 * q) * au * au);
        const o = (y * W + x) * 3;
        buf[o] += w * rgb[0];
        buf[o + 1] += w * rgb[1];
        buf[o + 2] += w * rgb[2];
      }
    }
  }
  // Light adds up on the film and soaks towards white; the beam stop takes whatever lands behind it.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const m = 255 * params.stop[y * W + x];
      display.setPixel(x, y, (1 - Math.exp(-buf[o])) * m, (1 - Math.exp(-buf[o + 1])) * m, (1 - Math.exp(-buf[o + 2])) * m);
    }
  }
}
