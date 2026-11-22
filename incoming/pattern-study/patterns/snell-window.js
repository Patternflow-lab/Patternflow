// ===== Patternflow pattern =====
// Title:   Snell's Window
// Family:  snellwindow
// Idea:    Seen from just under a rippling water surface, the whole sky is squeezed into one bright circle about 48 LEDs wide whose rim bends and whose clouds and sun swim with the waves, and outside the rim the surface turns to a dim mirror of the sunlit water below.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Snell's window, the cone of about 97 degrees through which a swimmer sees the whole sky, set by Snell's law (Willebrord Snellius, 1621, published by Descartes in 1637) and the critical angle for water of index 1.33, with total internal reflection outside it and the Fresnel reflectance (Augustin-Jean Fresnel, 1820s) that makes the rim glow
// Round:   218
// ===============================
// @matrix 64x128
// @knobs Hue=-0.08..0.2, Chop=0..4, Lens=-1..1, Sun=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of the water, the sky and the light. At the opening 0 the sky is blue to pale aqua and the water is aqua to near-black blue; the range stops short of red, so at -0.09 everything is teal-green and at 0.26 violet.
// Knob 2: Chop. How steep the ripples are, as the root-mean-square tilt of the surface: 0.012 radians at 0 (glassy, the rim a clean circle and the sky still), 0.09 at the opening 2 (the rim wobbles about 2 LEDs, the clouds slide and the sun breaks into soft moving pieces) and 0.65 at 4 (choppy, the rim tears into bays and the sky is cut into shreds).
// Knob 3: Lens. The field of view of the fisheye, as the radius of the window: 14 LEDs at -1, 24 at the opening 0 and 42 at 1, where the circle is wider than the 64 LEDs of the panel and only a strip of mirror is left above and below it. Ripples keep their size on the panel as the lens turns.
// Knob 4: Sun. Where the sun stands in the sky. At the opening 0.06 it is 57 degrees up, in the upper right of the window, about 14 LEDs from the middle. Toward -1 it sinks to 26 degrees and swings to the upper left, toward 1 it sinks and swings to the lower right, so at either end it sits near the rim, which glows brightest on that side, and the light shafts in the water follow it.

// The panel looks straight up from just under the surface through a fisheye: a pixel at distance r from the
// window's centre looks at an angle r / f from the zenith, f = radius of the window / 0.85 rad (the critical angle,
// asin(1/1.33) = 48.6 degrees). Past 69 degrees the angle is bent smoothly toward the nadir so that a small lens
// still fills the panel with water. The window sits at (32, 44) at the opening, the lens moves it a few rows.
// The surface is a sum of 18 travelling ripples, no two with the same wavelength (17 to 82 LEDs, and two swells
// of 120 to 210), direction (a wind lobe about 1 radian wide) or speed, on the gravity-capillary dispersion
// omega^2 = 1.1 k + 5 k^3 in LEDs and seconds, so a 17 LED ripple runs 2.4 LEDs a second and a 70 LED one 3.2. Each wave's
// slope swells and fades between 0.5 and 1.5 times its mean with a period of its own (80 to 800 s). Each wave
// is evaluated for the slope only, on a grid of every second LED, then interpolated; waves are damped where the
// fisheye squeezes them below about 8 LEDs on the panel, so the far mirror stays calm and nothing aliases.
// Each pixel takes the surface normal from the slope and bends its ray by Snell's law with n = 1.33. Where
// sin(angle in water) times 1.33 is below 1 the ray leaves into the sky, and the sky is a blue gradient (deep blue
// at the zenith, pale at the horizon, which is the rim) with a sun disc (Gaussian, 0.07 rad), a halo and a few cloud
// bands drawn on a plane overhead, so a ripple that tilts the surface shows another piece of sky there. Where
// it is above 1 the ray is totally reflected. The Fresnel reflectance of the exact formula, averaged over both
// polarisations, mixes the dim mirror into the sky near the rim (0.02 straight up, 0.5 at 46 degrees, 1 at
// 48.6) and a ring of light, 2 LEDs wide inside the rim and 1 outside, glows where the horizon is squeezed
// against it, brightest on the sun's side. The ripples move the rim because the rim is wherever the tilted
// normal makes the critical angle.
// The mirror shows what is below by reflecting the ray and looking down: a haze, pale toward the horizon and
// near black at the nadir; light shafts, which fan out from the window since they are vertical in the water and
// the window is the vanishing point, three bands of integer harmonics (7, 11 and 17 around the circle) turning at
// their own slow rates and carried sideways by the ripples; and soft pale sandy patches on a floor 2.4 times as deep as the
// eye, found by following the reflected ray down to it, so the ripples swim them. Patches fade out toward the horizon where
// they would be finer than a LED.
// There is no state beyond the clock: the waves, the sun's wander (about 6 degrees over minutes), the clouds' drift
// and the shafts all run on frequencies that share no period, and the clock starts at a random time.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sin, cos, exp, sqrt, atan2, asin, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const F = (n) => new Float32Array(n);

const NI = 1.33; // refractive index of water
const THC = asin(1 / NI); // critical angle, 0.8498 rad
const NW = 22; // surface ripples
const TK = 8192 / (2 * PI), SIN = new Float32Array(8192);
for (let i = 0; i < 8192; i++) SIN[i] = sin((i + 0.5) / TK);
const ts = (x) => SIN[(x * TK) & 8191]; // a sine from a table, for the per-pixel work
const GRAV = 1.1, CAPIL = 5; // omega^2 = GRAV k + CAPIL k^3
const FLOOR = 2.4; // depth of the floor below the surface in eye depths
const OPEN = [0, 2, 0, 0.06];
const SKYGAIN = 2.4; // the sky is displaced this many times as far as Snell's law says, so a slope of 0.05 still shows

function hsv(h, s, v, out) {
  h -= floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[0] = f(5);
  out[1] = f(3);
  out[2] = f(1);
}

export function setup(params) {
  const S = {
    t: 400 + Math.random() * 1500,
    ready: false,
    kh: 0, kc: 2, kl: 0, ks: 0.06,
    f: 28, cx: 32, cy: 44, gf: -1, gcy: -1,
    slope: 0.1, hueKey: "", az: 0, el: 1, sux: 1, suy: 0, sun: [0, 0, 1],
    a1: 0, a2: 0, a3: 0, v1: 0, v2: 0, v3: 0, v4: 0, d1: 0, d2: 0, b1: 0, b2: 0, b3: 0, b4: 0, c1: 0, c2: 0, c3: 0, c4: 0,
    // waves
    DX: F(NW), DY: F(NW), KX: F(NW), KY: F(NW), KK: F(NW), WA: F(NW), OM: F(NW), PH0: F(NW), NU: F(NW), PSI: F(NW), P0: F(NW), AM: F(NW),
    // pixel geometry
    VX: F(N), VY: F(N), VZ: F(N), UX: F(N), UY: F(N), TH: F(N), PHI: F(N), SX: F(N), SY: F(N),
    T0X: F(N), T0Y: F(N), T0Z: F(N), SXu: F(N), SYu: F(N), FAC: F(N * NW), GX: F(N), GY: F(N),
    P: { deep: [0, 0, 0], haze: [0, 0, 0], shaft: [0, 0, 0], sand: [0, 0, 0], zen: [0, 0, 0], mid: [0, 0, 0], hor: [0, 0, 0], rim: [0, 0, 0], warm: [0, 0, 0], cloud: [0, 0, 0] },
  };
  const wind = Math.random() * 2 * PI;
  let sw = 0;
  for (let i = 0; i < NW; i++) {
    const swell = i < 2;
    const lam = swell ? 70 + Math.random() * 80 : exp(mix(log(8), log(40), Math.random()));
    const k = (2 * PI) / lam;
    const ang = wind + (Math.random() + Math.random() + Math.random() - 1.5) * 1.9;
    S.DX[i] = cos(ang);
    S.DY[i] = sin(ang);
    S.KK[i] = k;
    S.KX[i] = k * cos(ang);
    S.KY[i] = k * sin(ang);
    S.OM[i] = sqrt(GRAV * k + CAPIL * k * k * k);
    S.PH0[i] = Math.random() * 2 * PI;
    S.NU[i] = 0.008 + 0.04 * Math.random();
    S.PSI[i] = Math.random() * 2 * PI;
    const w = Math.pow(lam / 20, -0.25) * (swell ? 0.2 : 1) * (0.6 + 0.8 * Math.random());
    S.WA[i] = w;
    sw += w * w;
  }
  for (let i = 0; i < NW; i++) S.WA[i] *= sqrt(2 / sw); // so the rms of the slope is the knob
  params.s = S;
}

// The angle from the zenith at distance r (in LEDs) from the centre: equidistant up to 69 degrees, then bent toward
// the nadir so that no lens turns the panel round.
const THK = 1.2, THM = 3.0;
function thetaOf(r, f) {
  const t = r / f;
  if (t <= THK) return t;
  return THK + (THM - THK) * (1 - exp(-(t - THK) / (THM - THK)));
}
function dthetaOf(r, f) {
  const t = r / f;
  return t <= THK ? 1 : exp(-(t - THK) / (THM - THK));
}

// Everything that depends on where the window is and how large: the view direction of each pixel, where it meets
// the surface, and how much each ripple is damped there.
function geometry(S) {
  const { f, cx, cy } = S;
  const { VX, VY, VZ, UX, UY, TH, PHI, SX, SY, SXu, SYu, FAC, KK, T0X, T0Y, T0Z } = S;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = sqrt(dx * dx + dy * dy) + 1e-4;
      const ux = dx / r, uy = dy / r, th = thetaOf(r, f), st = sin(th), ct = cos(th);
      VX[p] = st * ux;
      VY[p] = st * uy;
      VZ[p] = ct;
      UX[p] = ux;
      UY[p] = uy;
      TH[p] = th;
      PHI[p] = atan2(dy, dx);
      const c2 = ct > 0.12 ? ct : 0.12, tn = st / c2;
      // the ray through a flat surface, which the ripples' bending of the sky is measured from
      const fs2 = NI * NI * (1 - ct * ct);
      if (ct > 0 && fs2 < 1) {
        T0X[p] = NI * st * ux;
        T0Y[p] = NI * st * uy;
        T0Z[p] = sqrt(1 - fs2);
      } else {
        T0X[p] = ux;
        T0Y[p] = uy;
        T0Z[p] = 0;
      }
      SX[p] = tn * ux; // where the ray meets the surface, in eye depths
      SY[p] = tn * uy;
      SXu[p] = f * tn * ux; // and in LEDs
      SYu[p] = f * tn * uy;
      const q = min(40, (1 / (c2 * c2)) * dthetaOf(r, f)); // LEDs of surface per LED of panel
      for (let i = 0; i < NW; i++) {
        const u = (KK[i] * q) / 1.2, u2 = u * u;
        FAC[p * NW + i] = 1 / (1 + u2 * u2);
      }
    }
}

function palette(S, hue) {
  const key = hue.toFixed(3);
  if (key === S.hueKey) return;
  S.hueKey = key;
  const h0 = 0.535 + hue, P = S.P;
  hsv(h0 + 0.02, 1, 0.15, P.deep);
  hsv(h0 - 0.01, 0.72, 0.55, P.haze);
  hsv(h0 - 0.03, 0.4, 0.95, P.shaft);
  hsv(h0 - 0.1, 0.42, 0.95, P.sand);
  hsv(h0 + 0.055, 0.92, 0.74, P.zen);
  hsv(h0 + 0.015, 0.62, 0.95, P.mid);
  hsv(h0 - 0.02, 0.36, 1, P.hor);
  hsv(h0 - 0.03, 0.26, 1, P.rim);
  hsv(0.12 + 0.35 * hue, 0.22, 1, P.warm);
  hsv(h0 + 0.02, 0.02, 1, P.cloud);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || OPEN, d = cl(dt || 0, 0, 0.1);
  S.t += d;
  const t = S.t;
  if (!S.ready) {
    S.kh = k[0];
    S.kc = k[1];
    S.kl = k[2];
    S.ks = k[3];
  } else {
    const a = 1 - exp(-d / 0.3);
    S.kh += (k[0] - S.kh) * a;
    S.kc += (k[1] - S.kc) * a;
    S.kl += (k[2] - S.kl) * a;
    S.ks += (k[3] - S.ks) * a;
  }
  const kl = cl(S.kl, -1, 1);
  S.f = (24 * exp(0.55 * kl)) / THC;
  S.cy = 44 + 4 * kl;
  S.cx = 32;
  if (abs2(S.f - S.gf) > 0.02 || abs2(S.cy - S.gcy) > 0.02) {
    S.gf = S.f;
    S.gcy = S.cy;
    geometry(S);
  }
  palette(S, S.kh);
  // chop: the rms tilt of the surface, 0.012 at 0, 0.13 at 2, 0.45 at 4
  const kc = cl(S.kc, 0, 4);
  S.slope = kc <= 2 ? 0.008 * exp(log(0.05 / 0.008) * kc * 0.5) : 0.05 * exp(log(0.12 / 0.05) * (kc - 2) * 0.5);
  // sun: a path across the sky
  const su = cl(S.ks, -1, 1);
  const wob = 0.07 * sin(t * 0.0213 + 1.3) + 0.045 * sin(t * 0.0137 + 4.1) + 0.03 * sin(t * 0.0379);
  const wob2 = 0.045 * sin(t * 0.0171 + 2.2) + 0.03 * sin(t * 0.0311 + 0.7);
  S.az = -0.9 + 1.9 * su + wob;
  S.el = 1.0 - 0.55 * Math.pow(Math.abs(su), 1.3) + wob2;
  const ce = cos(S.el);
  S.sun[0] = ce * cos(S.az);
  S.sun[1] = ce * sin(S.az);
  S.sun[2] = sin(S.el);
  S.sux = cos(S.az);
  S.suy = sin(S.az);
  S.a1 = 0.0173 * t + 1.1;
  S.a2 = -0.0231 * t + 0.4;
  S.a3 = 0.0113 * t + 2.6;
  S.v1 = 0.049 * t;
  S.v2 = -0.063 * t;
  S.v3 = 0.037 * t + 2;
  S.v4 = 0.0431 * t;
  S.d1 = 0.0067 * t + 0.8;
  S.d2 = -0.0043 * t;
  S.b1 = 0.0071 * t;
  S.b2 = 0.0053 * t + 1.3;
  S.b3 = 0.0089 * t;
  S.b4 = 0.0047 * t + 0.5;
  S.c1 = 0.026 * t; // cloud drift
  S.c2 = 0.0173 * t;
  S.c3 = 0.0097 * t;
  S.c4 = 0.0211 * t;
  // ripples: the slope of the surface under every pixel's ray
  const { DX, DY, KX, KY, WA, OM, PH0, NU, PSI, P0, AM, FAC, GX, GY, SXu, SYu } = S;
  const sl = S.slope * (1 + 0.3 * sin(t * 0.0231 + 1) + 0.15 * sin(t * 0.0517 + 4));
  for (let i = 0; i < NW; i++) {
    P0[i] = PH0[i] - OM[i] * t;
    AM[i] = WA[i] * sl * (1 + 0.5 * sin(NU[i] * t + PSI[i]));
  }
  for (let p = 0; p < N; p++) {
    const X = SXu[p], Y = SYu[p], fo = p * NW;
    let gx = 0, gy = 0;
    for (let i = 0; i < NW; i++) {
      const fa = FAC[fo + i];
      if (fa < 0.004) continue;
      const v = SIN[((KX[i] * X + KY[i] * Y + P0[i]) * TK) & 8191] * AM[i] * fa;
      gx -= DX[i] * v;
      gy -= DY[i] * v;
    }
    GX[p] = gx;
    GY[p] = gy;
  }
  S.ready = true;
}

function abs2(v) {
  return v < 0 ? -v : v;
}

let OR = 0, OG = 0, OB = 0;

// The underwater scene along a ray that points down: D, with the surface point (sx, sy) in eye depths where it left
// the surface (0, 0 when the pixel looks down with no surface in between).
function under(S, p, Dx, Dy, Dz, sx, sy, gt) {
  const P = S.P, deep = P.deep, haze = P.haze, shaftC = P.shaft, sand = P.sand;
  let e = -Dz;
  e = e < 0 ? 0 : e > 1 ? 1 : e;
  const w = 1 - e;
  const ht = w * w * (0.5 + 0.5 * w);
  const ux = S.UX[p], uy = S.UY[p], th = S.TH[p], phi = S.PHI[p];
  const sb = 0.5 + 0.5 * (ux * S.sux + uy * S.suy);
  // where the reflected ray meets the floor, in eye depths
  const ef = sm(0.3, 0.7, e);
  const eg = e < 0.12 ? 0.12 : e;
  const gu = sx + (Dx * FLOOR) / eg, gv = sy + (Dy * FLOOR) / eg;
  // haze, with slow patches of turbidity that belong to the floor, so the haze is not a set of rings
  const tb = ef > 0 ? 0.5 + 0.25 * ts(0.9 * gu + 0.7 * ts(0.7 * gv + S.d1) + S.d2) + 0.25 * ts(0.6 * gv - 0.9 * gu * 0.5 + S.d1 * 1.3) : 0.5;
  const pool = th > 0.8 ? 0.3 * exp(-(th - 0.8) * 1.9) * sm(0.87, 1.0, th) : 0;
  // veils of suspended light drifting through the deep water, in panel coordinates so the whole mirror moves
  const vx = p & 63, vy = p >> 6;
  const va = ts(vx * 0.083 + vy * 0.027 + S.v1), vb = ts(vx * 0.039 - vy * 0.061 + S.v2 + 1.7), vc = ts((vx + 5 * ts(vy * 0.06 + S.v3)) * 0.121 + S.v4);
  let vl = 0.45 + 0.4 * va * vb + 0.25 * vc * va;
  vl = vl < 0 ? 0 : vl * vl;
  const hz = (ht * (0.15 + 0.5 * sb) + pool * (0.5 + 0.5 * sb)) * (1 + (tb - 0.5) * 1.1 * ef) + 0.45 * vl * (0.45 + 0.55 * vy * 0.0078);
  // light shafts, fanning out from the window, with packets of light along them
  const pp = phi + gt;
  const band = 0.5 + 0.5 * (0.5 * ts(6 * pp + S.a1) + 0.3 * ts(10 * pp + S.a2) + 0.2 * ts(15 * pp + S.a3));
  const sh = sm(0.4, 0.9, band);
  const fd = th < 0.85 ? 1 : exp(-(th - 0.85) * (1.2 - 0.6 * (uy > 0 ? uy : 0)));
  const along = 0.9 + 0.1 * ts(5 * th - 2.3 * pp + S.a2 * 2);
  const shaft = 1.1 * sh * fd * along * (0.3 + 0.7 * sb) * (1 - 0.5 * e);
  // a halo of the window's light just outside the rim
  const hd = (th - THC) * 7;
  const halo = 0;
  let r = deep[0] + (haze[0] - deep[0]) * hz + shaftC[0] * (shaft + halo);
  let g = deep[1] + (haze[1] - deep[1]) * hz + shaftC[1] * (shaft + halo);
  let b = deep[2] + (haze[2] - deep[2]) * hz + shaftC[2] * (shaft + halo);
  // sunlit sand on the floor
  if (ef > 0) {
    const a = ts(gu * 2.7 + 0.8 * ts(gv * 1.9 + S.b1) + S.b2);
    const bb = ts(gv * 2.4 - 0.7 * ts(gu * 1.6 - S.b3) + 1.7);
    const c = ts((gu + gv) * 1.1 + 0.9 * ts(gu * 0.9 - gv * 1.3 + S.b4));
    const dd = 0.45 * a * bb + 0.35 * c + 0.2 * a;
    const pat = sm(0.0, 0.7, dd) * ef * (1 - 0.97 * sm(1.9, 2.3, th));
    const amt = 0.75 * pat * (0.4 + 0.6 * sh);
    r += sand[0] * amt;
    g += sand[1] * amt;
    b += sand[2] * amt;
  }
  OR = r;
  OG = g;
  OB = b;
}

function sky(S, tx, ty, tz) {
  const P = S.P, zen = P.zen, mid = P.mid, hor = P.hor, cloudC = P.cloud, warm = P.warm;
  const s = tz > 1 ? 0 : 1 - tz;
  let s1 = s / 0.7;
  s1 = s1 > 1 ? 1 : s1;
  const t1 = s1 * s1 * (3 - 2 * s1);
  let s2 = (s - 0.72) / 0.28;
  s2 = s2 < 0 ? 0 : s2 > 1 ? 1 : s2;
  const t2 = s2 * s2 * (3 - 2 * s2);
  let r = zen[0] + (mid[0] - zen[0]) * t1 + (hor[0] - mid[0]) * t2;
  let g = zen[1] + (mid[1] - zen[1]) * t1 + (hor[1] - mid[1]) * t2;
  let b = zen[2] + (mid[2] - zen[2]) * t1 + (hor[2] - mid[2]) * t2;
  // clouds on a plane overhead, stretched into bands, thinning toward the horizon
  const iz = 1 / (tz + 0.28), cu = tx * iz, cv = ty * iz;
  const wu = cu + S.c1 + 0.2 * ts(5.3 * cv + S.c2) + 0.07 * ts(12 * cu - S.c4);
  const wv = cv + 0.12 * ts(4.1 * cu + S.c3 + 1) + 0.05 * ts(11 * cv + S.c2);
  const d = 0.5 + 0.5 * ts(8.5 * wv + 0.9 * ts(3.3 * wu + 0.6));
  const m = 0.5 + 0.5 * ts(5.2 * wu + 1.3 * ts(2.4 * wv + S.c1 * 1.7) + 2);
  const f2 = 0.5 + 0.5 * ts(17 * wu + 9 * wv + 2 * ts(6 * wv));
  let cld = 0.68 * sm(0.36, 0.95, d * (0.46 + 0.9 * m) + 0.16 * (f2 - 0.5));
  cld *= 1 - sm(0.78, 0.97, s);
  // the sun
  const sn = S.sun, dot = tx * sn[0] + ty * sn[1] + tz * sn[2], q = 1 - dot;
  const core = exp(-q / 0.0049), halo = 0.5 / (1 + q / 0.03), wide = 0.22 / (1 + q / 0.3);
  const lit = 0.9 + 0.1 * min(1, halo * 2 + wide);
  const shade = 1 - 0.16 * (1 - d) * (1 - m);
  r += (cloudC[0] * lit * shade - r) * cld;
  g += (cloudC[1] * lit * shade - g) * cld;
  b += (cloudC[2] * lit * shade - b) * cld;
  const sun = 1.5 * core + halo * 0.5 + wide * 0.4;
  r += warm[0] * sun;
  g += warm[1] * sun;
  b += warm[2] * sun * 0.9;
  OR = r;
  OG = g;
  OB = b;
}

const fin = (v) => (v < 0.82 ? (v < 0 ? 0 : v) : 0.82 + 0.18 * (1 - exp(-(v - 0.82) / 0.18)));

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const { VX, VY, VZ, UX, UY, SX, SY, GX, GY, P, T0X, T0Y, T0Z } = S;
  const rim = P.rim, warm = P.warm;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const vz = VZ[p];
      let r, g, b;
      if (vz <= 0) {
        under(S, p, VX[p], VY[p], vz, 0, 0, 0);
        r = OR;
        g = OG;
        b = OB;
      } else {
        const gx = GX[p], gy = GY[p];
        const nz = 1 / sqrt(1 + gx * gx + gy * gy), nx = -gx * nz, ny = -gy * nz;
        const vx = VX[p], vy = VY[p];
        let ci = vx * nx + vy * ny + vz * nz;
        if (ci < 0) ci = 0;
        const s2 = NI * NI * (ci >= 1 ? 0 : 1 - ci * ci);
        const gt = 3 * (-UY[p] * gx + UX[p] * gy);
        if (s2 < 1) {
          const ct = sqrt(1 - s2), k2 = NI * ci - ct;
          // the sky shifts SKYGAIN times as far as the tilt alone would move it
          let tx = NI * vx - k2 * nx, ty = NI * vy - k2 * ny, tz = NI * vz - k2 * nz;
          const t0x = T0X[p], t0y = T0Y[p], t0z = T0Z[p];
          tx = t0x + SKYGAIN * (tx - t0x);
          ty = t0y + SKYGAIN * (ty - t0y);
          tz = t0z + SKYGAIN * (tz - t0z);
          const tn = 1 / sqrt(tx * tx + ty * ty + tz * tz + 1e-9);
          sky(S, tx * tn, ty * tn, tz * tn < 0.002 ? 0.002 : tz * tn);
          const a = NI * ci, rs = (a - ct) / (a + ct), c2 = NI * ct, rp = (c2 - ci) / (c2 + ci);
          const R = 0.5 * (rs * rs + rp * rp);
          r = OR * (1 - R);
          g = OG * (1 - R);
          b = OB * (1 - R);
          if (R > 0.012) {
            const rx = vx - 2 * ci * nx, ry = vy - 2 * ci * ny, rz = vz - 2 * ci * nz;
            under(S, p, rx, ry, rz, SX[p], SY[p], gt);
            r += OR * R;
            g += OG * R;
            b += OB * R;
          }
        } else {
          const rx = vx - 2 * ci * nx, ry = vy - 2 * ci * ny, rz = vz - 2 * ci * nz;
          under(S, p, rx, ry, rz, SX[p], SY[p], gt);
          r = OR;
          g = OG;
          b = OB;
        }
        // the ring where the horizon is squeezed against the rim
        const xr = NI * sqrt(ci >= 1 ? 0 : 1 - ci * ci) - 1;
        if (xr > -0.3 && xr < 0.12) {
          const gw = xr < 0 ? xr / 0.055 : xr / 0.022;
          const sb = 0.5 + 0.5 * (UX[p] * S.sux + UY[p] * S.suy);
          const gl = exp(-gw * gw) * (0.42 + 0.6 * sb * sb);
          const wm = sb * sb * 0.5;
          r += (rim[0] + (warm[0] - rim[0]) * wm) * gl;
          g += (rim[1] + (warm[1] - rim[1]) * wm) * gl;
          b += (rim[2] + (warm[2] - rim[2]) * wm) * gl;
        }
      }
      display.setPixel(x, y, fin(r) * 255, fin(g) * 255, fin(b) * 255);
    }
}
