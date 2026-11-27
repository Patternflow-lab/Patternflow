// ===== Patternflow pattern =====
// Title:   Sky Polarization
// Family:  skypol
// Idea:    Two all-sky discs stacked on the panel show one sky as the sun walks across it: the top disc colours every point by the angle of its polarization and lights it by the degree, with a dark halo and two neutral points on either side of the sun, and the bottom disc is the same sky through a polarizer that turns, a dark spoke sweeping round the sun while thin cloud, which is unpolarized, drifts through both.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the polarization of skylight and the neutral point named for him (François Arago, 1809), the scattering law of molecules much smaller than the wavelength (Lord Rayleigh, 1871), the two other neutral points (Jacques Babinet, 1840; David Brewster, 1842), multiple scattering in a planetary atmosphere (Subrahmanyan Chandrasekhar, Radiative Transfer, 1950), the sky compass of bees and desert ants (Karl von Frisch, 1949; Rüdiger Wehner, 1970s onward), neutral points as polarization singularities (Michael Berry, Mark Dennis and Ruth Lee, 2004); all names and dates recalled from memory, pattern round 271
// Round:   271
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Turn=0.3..3, Haze=0..1, Sun=-1..1
//
// Knob 1: Hue. Turns the wheel that colours the polarization angle in the top disc one turn round the hue circle over the range, and the sky and cloud of the bottom disc with it. At 0 the sky is a clear blue; at 0.25 a violet one, at 0.44 a rose one, and the warm hues are skipped fast between 0.44 and 0.5 since a dim orange reads brown; at 0.5 the sky is green, at 0.75 a blue-green, and at 1 it is blue again. The wheel always holds every hue, so the knob moves where each sits on the dome, not what is on it.
// Knob 2: Turn. How fast the polarizer turns, 20 degrees a second per unit of the knob: 6 at 0.3, 40 at the opening 2, 60 at 3. The filter repeats every 180 degrees, so the dark spoke comes round every 30 s at 0.3, every 4.5 s at 2 and every 3 s at 3. A swell of up to 40 percent rides on top, so the turn never locks to the sun.
// Knob 3: Haze. How much haze the air holds. The largest degree of polarization falls from 0.85 on clean air at 0 to 0.25 at 1, so the top disc dims and the polarizer's dark spoke fades to a grey wash, the bottom sky whitens, and the neutral points move out from the sun and the anti-sun, 20 degrees at 0 and 36 at 1. On its own the haze also breathes up to 0.16 of the range that is left, over about a minute.
// Knob 4: Sun. How high the sun climbs at noon, 24 degrees at -1, 53 at the opening 0.06, 78 at 1, each with a drift of up to 9.5 degrees either way. At -1 the sun stays low and the band of greatest polarization, 90 degrees from it, runs near the zenith; at 1 the sun comes close to the zenith and the band shrinks to a ring along the horizon. The lowest point of each day is a few degrees under the horizon whatever the knob says.
//
// What the picture is. Two fisheye maps of the sky, equidistant (2.9 degrees an LED), zenith at the centre and the horizon on a ring 62 LEDs across, one above the other, each filling a 64 x 64 half. North is up and east is to the left, as on a star chart held overhead. The sun walks across the dome on a path of its own: azimuth and elevation come from a day of 39 to 73 s (56 on average) whose length, noon height and lowest point all drift on rates that do not divide, so no two days are the same and nothing restarts. Over 900 s at the opening knobs it ranged from 8 degrees under the horizon to 62 above. For a few seconds of each day it is under the horizon and the dome dims by about a quarter instead of going black.
// The top disc. A sky point's polarization is a direction and a degree. The direction is the hue, and since a polarization has no arrow it repeats every 180 degrees, so the wheel runs twice round the sun. The degree is the brightness, raised to 1.3 above a floor of 0.15 so that the unpolarized places keep a faint hue. The sun is a small warm disc, and the sky round it is a dark halo, since the light next to the sun is unpolarized. Outside the horizon ring the corners carry the same map carried on past the horizon, dimmed to 0.45, as if the ground were glass. The ground is not glass and a real sky has nothing there; this is a drawing choice that fills the corners and shows the anti-solar point and its neutral point when the sun is low.
// The bottom disc. The same sky through a linear polarizer at angle theta in the plane of the picture. Malus's law gives (1 + d cos 2 (theta - psi)) / 2 for light of degree d and angle psi, multiplied by the sky's radiance: a darker zenith, a brighter horizon, the (1 + cos^2) Rayleigh lobe and a glow round the sun. The transmission is raised to 1.3 and a soft knee holds the bright end, so the dark spoke goes deeper than the LEDs' own curve would take it; that is a drawing choice, and the bluer shade of the dark spoke is too. The spoke runs through the sun and rotates about it, strongest 90 degrees away, as it does through a real filter.
// The law. For a view direction v and the sun direction s, with cos gamma = v . s, single Rayleigh scattering gives a degree d = dmax sin^2 gamma / (1 + cos^2 gamma) and a polarization perpendicular to the plane through the sun, the viewer and the sky point. That makes concentric arcs round the sun, the band 90 degrees from it the most polarized, and the sun and anti-sun unpolarized. The direction is turned into the picture's axes: the component along the local meridian goes to the radial direction on the screen and the component across it to the azimuthal one, which is what a polarization camera behind a fisheye lens records, so the zenith is smooth. The law is exact for the model. dmax is 0.85 clear and falls to 0.25 in haze; real skies reach 0.5 to 0.8.
// Neutral points. Single scattering has an unpolarized point of index 1 at the sun and another at the anti-sun, where the direction winds twice round. Real skies split each into two neutral points on the solar vertical, Babinet above the sun and Brewster below it, Arago above the anti-sun and a fourth below it (the 2004 picture of Berry, Dennis and Lee). The model adds a uniform polarization of degree 0.05, along the solar vertical on the screen, to the single-scattering field. It stands in for the second-order light and the ground, and it makes exactly those four zeros, where d = 0.05 on the solar vertical, 20 degrees from the sun and anti-sun at dmax 0.85 and 36 at 0.25. It is a drawing choice, not a solution of multiple scattering: the real points sit unevenly (Arago and Babinet 15 to 25 degrees out, Brewster nearer) and the model's two are the same distance either side. They show as small dim knots where the hue winds once, about 7 LEDs from the sun, and are easy to miss. Arago is on the dome only while the sun is under about 20 degrees (36 in thick haze); the fourth always falls below the horizon, and Brewster does once the sun is that low.
// Cloud. A drifting deck of thin cloud covers about a quarter of the sky (a mean density of 0.28 at the opening knobs), two layers of smooth noise on winds that turn slowly, laid on a plane above so that it crowds toward the horizon, and faded out below about 20 degrees of elevation so that no thin arcs pile up on the rim. Cloud is nearly unpolarized, so it removes 80 percent of the degree where it lies, which is a dark hole in the top disc, and in the bottom disc it keeps its own brightness while the sky round it darkens and brightens with the filter. The deck, the noise and the 80 percent are drawing choices. They are in because the sun and the filter alone came back to near-identical frames 20 s apart (recur 0.02 against 0.25 with the cloud).

const W = 64, H = 128;
const R = 31;
const CX = 32;
const { floor, min, max, abs, sqrt, exp, sin, cos, atan2, PI } = Math;
const TAU = 2 * PI;
const RAD = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

const N = 64 * 64;
// per pixel of one 64 x 64 half: the view direction, and the two screen axes
// written in the east, north, up frame
const VX = new Float32Array(N), VY = new Float32Array(N), VZ = new Float32Array(N);
const BXX = new Float32Array(N), BXY = new Float32Array(N), BXZ = new Float32Array(N);
const BYX = new Float32Array(N), BYY = new Float32Array(N), BYZ = new Float32Array(N);
const RHO = new Float32Array(N), ZEN = new Float32Array(N);
for (let y = 0; y < 64; y++) {
  for (let x = 0; x < 64; x++) {
    const i = y * 64 + x, sx = x + 0.5 - CX, sy = y + 0.5 - CX;
    const rho = sqrt(sx * sx + sy * sy) || 1e-6;
    const z = (rho / R) * (PI / 2);
    const sp = rho > 1e-3 ? -sx / rho : 0, cp = rho > 1e-3 ? -sy / rho : 1;
    const sz = sin(z), cz = cos(z);
    VX[i] = sz * sp; VY[i] = sz * cp; VZ[i] = cz;
    // meridian axis (away from the zenith) and azimuth axis, east, north, up
    const mx = cz * sp, my = cz * cp, mz = -sz, ax = cp, ay = -sp;
    BXX[i] = -sp * mx - cp * ax; BXY[i] = -sp * my - cp * ay; BXZ[i] = -sp * mz;
    BYX[i] = -cp * mx + sp * ax; BYY[i] = -cp * my + sp * ay; BYZ[i] = -cp * mz;
    RHO[i] = rho;
    ZEN[i] = z;
  }
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// value noise on an integer lattice, smooth between the corners
function hash(ix, iy, sd) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(sd, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, sd) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, sd), b = hash(ix + 1, iy, sd), c = hash(ix, iy + 1, sd), e = hash(ix + 1, iy + 1, sd);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + e) * ux * uy;
}

export function setup(params) {
  params.s = {
    T: 0, Hh: -0.95, th: 0.3, k: null,
    az: 0, el: 0.5, tw: 1, haze: 0, dmax: 0.85,
    Q: new Float32Array(N), U: new Float32Array(N), L: new Float32Array(N), C: new Float32Array(N),
    w1x: 0, w1y: 0, w2x: 0, w2y: 0, cover: 0.5,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) S.k = [kv[0], kv[1], kv[2], kv[3]];
  const al = 1 - exp(-d / 0.12);
  for (let i = 0; i < 4; i++) S.k[i] += (kv[i] - S.k[i]) * al;
  const k = S.k;
  S.T += d;
  const T = S.T;
  // the day: its length, noon height and lowest point all drift
  const day = 56 * (1 + 0.2 * sin(0.0417 * T + 0.8) + 0.1 * sin(0.0931 * T + 2.1));
  S.Hh += (TAU * d) / day;
  const kh = cl(k[3], -1, 1);
  const hm = (51 + 27 * kh) * RAD;
  const hTop = hm + (6 * sin(0.0213 * T + 0.4) + 3.5 * sin(0.0371 * T + 1.9)) * RAD;
  const hLow = (-4.5 + 2.2 * sin(0.0311 * T + 1.7) + 1.1 * sin(0.0577 * T)) * RAD;
  const hHi = cl(hTop, 8 * RAD, 82 * RAD);
  // the effective latitude and declination that give that noon height and lowest point
  const lat = PI / 2 - (hHi - hLow) / 2, dec = (hHi + hLow) / 2;
  const sl = sin(lat), cL = cos(lat), sd = sin(dec), cd = cos(dec), cH = cos(S.Hh), sH = sin(S.Hh);
  const sx = -cd * sH, sy = cL * sd - sl * cd * cH, sz = sl * sd + cL * cd * cH;
  S.az = atan2(sx, sy);
  S.el = Math.asin(cl(sz, -1, 1));
  // the dome dims to about half while the sun is under the horizon
  S.tw = 0.58 + 0.42 * sm((S.el / RAD + 5.5) / 14);
  // the polarizer turns on a swelling rate
  const rate = 20 * cl(k[1], 0.3, 3) * (1 + 0.3 * sin(0.173 * T + 0.5) + 0.1 * sin(0.311 * T));
  S.th += (rate * RAD * d);
  // haze, with a slow breath on top
  const br = 0.5 + 0.35 * sin(0.087 * T + 1.3) + 0.15 * sin(0.151 * T + 4.0);
  S.haze = cl(k[2], 0, 1) + (1 - cl(k[2], 0, 1)) * 0.16 * br;
  S.dmax = 0.85 - 0.6 * S.haze;
  // the sky: polarization (Q, U) and radiance at every point of one half
  const dmax = S.dmax, eps = 0.05;
  const A = S.az, ex = -sin(A), ey = -cos(A); // the solar vertical in the picture
  const e2x = ex * ex - ey * ey, e2y = 2 * ex * ey;
  const { Q, U, L, C } = S;
  // thin cloud on a deck above, two layers on winds that turn slowly
  const wa = 0.7 + 0.5 * sin(0.0123 * T) + 0.3 * sin(0.0291 * T + 1), wb = 2.6 + 0.6 * sin(0.0173 * T + 2) + 0.4 * sin(0.0367 * T);
  S.w1x += 0.08 * cos(wa) * d; S.w1y += 0.08 * sin(wa) * d;
  S.w2x += 0.16 * cos(wb) * d; S.w2y += 0.16 * sin(wb) * d;
  const thr = 0.6 + 0.07 * sin(0.0617 * T + 0.3) + 0.04 * sin(0.1093 * T + 1.1);
  const { w1x, w1y, w2x, w2y } = S;
  for (let i = 0; i < N; i++) {
    const vx = VX[i], vy = VY[i], vz = VZ[i];
    const dz = 1 / (max(vz, 0) + 0.3), px = vx * dz, py = vy * dz;
    const f = 0.62 * vnoise(px * 1.5 + w1x, py * 1.5 + w1y, 1) + 0.38 * vnoise(px * 3.1 + w2x, py * 3.1 + w2y, 2);
    C[i] = sm((f - thr) / 0.34 + 0.5) * sm((vz - 0.04) / 0.32);

    const cx = vy * sz - vz * sy, cy = vz * sx - vx * sz, cz = vx * sy - vy * sx;
    const cg = vx * sx + vy * sy + vz * sz;
    let s2 = 1 - cg * cg;
    if (s2 < 1e-6) s2 = 1e-6;
    const sg = sqrt(s2), ph = 1 + cg * cg;
    const d0 = (dmax * s2) / ph;
    const fx = (cx * BXX[i] + cy * BXY[i] + cz * BXZ[i]) / sg, fy = (cx * BYX[i] + cy * BYY[i] + cz * BYZ[i]) / sg;
    const dep = 1 - 0.8 * C[i];
    Q[i] = (d0 * (fx * fx - fy * fy) + eps * e2x) * dep;
    U[i] = (d0 * 2 * fx * fy + eps * e2y) * dep;
    // radiance: darker zenith, brighter horizon, the Rayleigh lobe, a glow round the sun
    const g = Math.acos(cl(cg, -1, 1));
    const zz = ZEN[i] / (PI / 2);
    L[i] = (0.5 + 0.3 * min(zz, 1.25) * min(zz, 1.25)) * (0.55 + 0.45 * (ph / 2)) + 0.5 * exp(-g / 0.2) * (1 - 0.5 * S.haze) + 0.25 * exp(-g / 0.6);
  }
}

// The sky's own hue follows the knob from blue through violet and rose, skips
// the warm middle fast (a dim orange reads brown) and comes back through
// green and cyan to blue.
function skyHue(u) {
  if (u < 0.44) return 0.585 + 0.385 * (u / 0.44);
  if (u < 0.5) return 0.97 + 0.33 * sm((u - 0.44) / 0.06);
  return 1.3 + 0.285 * ((u - 0.5) / 0.5);
}

const rgb = [0, 0, 0];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { Q, U, L, C } = S, th = S.th, c2 = cos(2 * th), s2 = sin(2 * th);
  const k = S.k, hue0 = 0.66 + cl(k[0], 0, 1), skyH = skyHue(cl(k[0], 0, 1));
  const haze = S.haze, tw = S.tw, dmax = S.dmax;
  // the sun on the screen, in LEDs from the disc centre
  const zs = PI / 2 - S.el, rs = (zs / (PI / 2)) * R, sxs = -rs * sin(S.az), sys = -rs * cos(S.az);
  const sunA = S.el > -9 * RAD ? 1 : 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = y * 64 + x, rho = RHO[i];
      // outside the horizon: the same map, dimmed
      const out = 1 - 0.55 * sm((rho - R + 0.5) / 1.4);
      // the horizon ring
      const rim = cl(1.15 - abs(rho - R) / 1.0, 0, 1);
      const q = Q[i], u = U[i];
      const dd = sqrt(q * q + u * u);
      // top disc: hue is the polarization angle, brightness the degree
      const psi = 0.5 * atan2(u, q);
      const hue = hue0 + psi / PI;
      const dn = cl(dd / (0.25 + 0.75 * dmax), 0, 1);
      const vTop = (0.15 + 0.85 * Math.pow(dn, 1.3)) * (0.55 + 0.45 * tw) * out;
      hsv(hue, 0.92, vTop, rgb);
      let r = rgb[0], g = rgb[1], b = rgb[2];
      // bottom disc: the sky through a polarizer at theta, Malus's law
      const T = 0.5 + 0.5 * (q * c2 + u * s2);
      const zz = ZEN[i] / (PI / 2);
      const rad = cl((L[i] + 0.1 * haze) * Math.pow(T, 1.3) * 1.55 * (0.4 + 0.6 * tw), 0, 1.4);
      const rb = rad / (1 + 0.25 * rad);
      const white = cl(0.12 + 0.5 * haze + 0.3 * cl(zz - 0.6, 0, 1) + 0.45 * rb * rb, 0, 0.82);
      const vb = (0.1 + 0.9 * rb) * out;
      hsv(skyH + 0.04 * (1 - T) - 0.01 * zz, 1 - white, vb, rgb);
      let r2 = rgb[0], g2 = rgb[1], b2 = rgb[2];
      const cc = C[i];
      if (cc > 0) {
        // cloud is unpolarized, so the filter leaves it alone: it keeps its
        // own brightness while the sky round it darkens and brightens
        const cb = (0.5 + 0.35 * L[i]) * (0.35 + 0.65 * tw), ca = cc * 0.88;
        hsv(skyH, 0.16, cb, rgb);
        r2 += (rgb[0] - r2) * ca; g2 += (rgb[1] - g2) * ca; b2 += (rgb[2] - b2) * ca;
      }
      // sun, in both discs
      const dx = x + 0.5 - CX - sxs, dy = y + 0.5 - CX - sys;
      const dr = sqrt(dx * dx + dy * dy);
      const sa = sm((3.0 - dr) / 1.6) * sunA * out;
      if (sa > 0) {
        r += (1 - r) * sa; g += (0.95 - g) * sa; b += (0.78 - b) * sa;
        r2 += (1 - r2) * sa; g2 += (0.96 - g2) * sa; b2 += (0.82 - b2) * sa;
      }
      if (rim > 0) {
        const ra = 0.26 * rim;
        r += (0.78 - r) * ra; g += (0.84 - g) * ra; b += (0.95 - b) * ra;
        r2 += (0.78 - r2) * ra; g2 += (0.84 - g2) * ra; b2 += (0.95 - b2) * ra;
      }
      display.setPixel(x, y, cl(r * 255, 0, 255) | 0, cl(g * 255, 0, 255) | 0, cl(b * 255, 0, 255) | 0);
      display.setPixel(x, y + 64, cl(r2 * 255, 0, 255) | 0, cl(g2 * 255, 0, 255) | 0, cl(b2 * 255, 0, 255) | 0);
    }
  }
}
