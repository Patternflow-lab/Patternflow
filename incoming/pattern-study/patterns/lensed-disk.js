// ===== Patternflow pattern =====
// Title:   Lensed Disk
// Family:  blackhole
// Idea:    A thin accretion disk round a Schwarzschild black hole, ray traced for every LED, so the far side of the disk is bent up and over the dark shadow, a thin second image hugs the shadow's edge, and the side turning towards you is far brighter and whiter than the side turning away.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Karl Schwarzschild's solution (1916); the picture of a black hole with a thin accretion disk first computed by Jean-Pierre Luminet (1979); the thin-disk emission profile and its inner edge at the innermost stable orbit (Nikolai Shakura and Rashid Sunyaev, 1973; Igor Novikov and Kip Thorne, 1973), the constants and the Doppler factor written from memory; pattern round 201
// Round:   203
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spin=0.2..3, Tilt=-55..9, Beaming=0.5..1.5
//
// Knob 1: Hue. Turns the colour of the glowing gas round the wheel: at 0 it is black-body orange, deepest red at the cool edge and yellow-white where the gas is hot, then green at 0.25, blue at 0.5, magenta at 0.75 and orange again at 1.
// Knob 2: Spin. How fast the gas orbits: at 2 the gas at 6 radii goes round in 8 s, at 8 radii in 12 s and at 12 radii in 22 s, so the inner gas shears past the outer, and 0.2 is a tenth of that.
// Knob 3: Tilt. How far the disk is laid open to you: at 0 you see it 15 degrees off edge-on, drifting some 9 degrees either way, with its far side bent over the hole; at -55 you look almost straight down on a full ring round the shadow, and at 9 the disk is a thin band across it.
// Knob 4: Beaming. How strongly the Doppler shift and the pull of the hole favour the side turning towards you: at 0.5 the bright end is about four times the dim end, at 1 the full physical eighteen times, and at 1.5 about eighty, so the far end goes out.

const W = 64, H = 128;
const { floor, sqrt, sin, cos, exp, log, atan2, asinh, sinh, PI } = Math;
const SS = 2; // samples across one LED
const NSS = SS * SS;
const SCALE = 3.0; // LEDs per gravitational radius GM/c^2
const BC = 3 * sqrt(3); // critical impact parameter, 5.196
const RIN = 6, ROUT = 22;
const OMEGA = 12; // visual speed of a Kepler orbit, rad/s at r = 1, times r^-1.5

// The photon orbit table. A ray that reaches the observer at impact parameter b
// follows u(phi), u = 1/r, with u'' = -u + 3u^2 from u = 0 and u' = 1/b at
// phi = 0 (the observer's side). Rows are b on a grid that is fine near the
// critical value, where the orbits wind, columns are phi in steps of DP.
const B0 = 0.6, B1 = 26, S0 = 0.15, NB = 520, DP = 0.012;
const NP = Math.ceil((2.1 * PI) / DP) + 2;
const W0 = asinh((B0 - BC) / S0), W1 = asinh((B1 - BC) / S0), DW = (W1 - W0) / (NB - 1);

function buildTable() {
  const tab = new Float32Array(NB * NP);
  for (let j = 0; j < NB; j++) {
    const b = BC + S0 * sinh(W0 + j * DW), row = j * NP;
    let u = 0, v = 1 / b, state = 0;
    for (let k = 0; k < NP; k++) {
      if (state === 1) tab[row + k] = 0.5;
      else if (state === 2) tab[row + k] = -0.05;
      else {
        tab[row + k] = u;
        // One RK4 step of (u, v)' = (v, -u + 3 u^2).
        const k1u = v, k1v = -u + 3 * u * u;
        const u2 = u + 0.5 * DP * k1u, v2 = v + 0.5 * DP * k1v;
        const k2u = v2, k2v = -u2 + 3 * u2 * u2;
        const u3 = u + 0.5 * DP * k2u, v3 = v + 0.5 * DP * k2v;
        const k3u = v3, k3v = -u3 + 3 * u3 * u3;
        const u4 = u + DP * k3u, v4 = v + DP * k3v;
        const k4u = v4, k4v = -u4 + 3 * u4 * u4;
        u += (DP / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
        v += (DP / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
        if (u >= 0.5) state = 1; // fell through the horizon
        else if (u < 0) state = 2; // got away
      }
    }
  }
  return tab;
}

// A black body, hue-turned by the Hue knob, as a table over the observed
// temperature: chroma only, the brightness comes from the flux.
const STOPS = [
  [0.0, 0.3, 0.02, 0.0], [0.3, 0.85, 0.1, 0.0], [0.5, 1.0, 0.26, 0.02], [0.7, 1.0, 0.48, 0.07],
  [0.9, 1.0, 0.7, 0.22], [1.1, 1.0, 0.87, 0.55], [1.3, 0.97, 0.95, 0.88], [1.8, 0.86, 0.9, 1.0],
];
const NR = 256, XMAX = 1.8;
function rampColor(x, o) {
  let k = 0;
  while (k < STOPS.length - 2 && x > STOPS[k + 1][0]) k++;
  const a = STOPS[k], b = STOPS[k + 1], f = Math.min(1, Math.max(0, (x - a[0]) / (b[0] - a[0])));
  o[0] = a[1] + (b[1] - a[1]) * f;
  o[1] = a[2] + (b[2] - a[2]) * f;
  o[2] = a[3] + (b[3] - a[3]) * f;
}
function turnHue(c, shift) {
  // Rotate the hue of an RGB triple, white and grey staying as they are.
  const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]), d = mx - mn;
  if (d < 1e-6 || shift === 0) return;
  let h = mx === c[0] ? ((c[1] - c[2]) / d + 6) % 6 : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4;
  h = (h + shift * 6) % 6;
  const s = d / mx, i = floor(h), f = h - i, p = mx * (1 - s), q = mx * (1 - f * s), t = mx * (1 - (1 - f) * s);
  const m = i % 6;
  c[0] = m === 0 || m === 5 ? mx : m === 1 ? q : m === 4 ? t : p;
  c[1] = m === 1 || m === 2 ? mx : m === 0 ? t : m === 3 ? q : p;
  c[2] = m === 3 || m === 4 ? mx : m === 2 ? t : m === 5 ? q : p;
}

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const frac = (x) => x - floor(x);
const hash = (a, b, c) => frac(sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453);

// The turbulence in the gas: three families of arms and knots, each with its
// own number of arms m, wind-up kr and generation length P (seconds of disk
// time). Each family lives in two overlapping generations, fading in and out
// with sin^2 half a generation apart, and a generation draws its pattern fresh
// from the hash, so the shear never winds an arm into a fine coil and nothing
// comes round to the same picture.
const FAM = [
  { m: 2, kr: 3.2, P: 15.3, amp: 0.95 },
  { m: 3, kr: -2.6, P: 21.7, amp: 0.8 },
  { m: 5, kr: 1.4, P: 11.9, amp: 0.6 },
  { m: 1, kr: 1.8, P: 26.3, amp: 0.6 },
  { m: 4, kr: -3.5, P: 18.7, amp: 0.55 },
];
// Hot spots: knots of gas that live on one orbit for a while, each a sin^2 pulse in
// time, born at a radius and azimuth the hash picks.
const NSPOT = 6, SPOTP = [19.3, 27.1, 14.7, 23.3, 17.9, 31.3];

export function setup(params) {
  // Per-sample polar angle and impact parameter of the ray through each of SS x SS points of every LED,
  // the panel turned so the disk's long axis runs down it and the spin axis points across.
  const N = W * H * NSS;
  const sb = new Float32Array(N), sc = new Float32Array(N), ss = new Float32Array(N), sj = new Int16Array(N), sf = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let a = 0; a < SS; a++)
        for (let c = 0; c < SS; c++) {
          const i = (y * W + x) * NSS + a * SS + c;
          const iu = (x + (c + 0.5) / SS - W / 2) / SCALE; // along the projected spin axis
          const ir = (y + (a + 0.5) / SS - H / 2) / SCALE; // along the line of nodes
          const b = sqrt(iu * iu + ir * ir), al = atan2(ir, iu);
          sb[i] = b;
          sc[i] = cos(al);
          ss[i] = sin(al);
          let fw = (asinh((b - BC) / S0) - W0) / DW;
          fw = fw < 0 ? 0 : fw > NB - 1.001 ? NB - 1.001 : fw;
          sj[i] = floor(fw);
          sf[i] = fw - floor(fw);
        }
  const lut = new Float32Array(NR * 3);
  params.s = {
    t: 0, tau: 0, hue: 0, spin: 2, tilt: 0, beta: 0.5, lutHue: -1,
    tab: buildTable(), sb, sc, ss, sj, sf, lut,
    rgb: new Float32Array(W * H * 3), tmp: new Float32Array(W * H * 3), blur: new Float32Array(W * H * 3),
    gen: new Float32Array(FAM.length * 2 * 3), // weight, seconds into the generation, phase
    spot: new Float32Array(NSPOT * 3), // weight, radius, azimuth
    c: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.5];
  dt = dt > 0.1 ? 0.1 : dt < 0 ? 0 : dt || 0;
  S.t += dt;
  S.hue = k[0];
  S.spin = k[1];
  S.tilt = k[2];
  S.beta = k[3];
  S.tau += (dt * S.spin) / 2;
  // Generations of the turbulence: two per family, half a generation apart.
  for (let f = 0; f < FAM.length; f++)
    for (let j = 0; j < 2; j++) {
      const tt = S.tau / FAM[f].P + j * 0.5, n = floor(tt), q = tt - n, o = (f * 2 + j) * 3;
      const sn = sin(PI * q);
      S.gen[o] = sn * sn;
      S.gen[o + 1] = q * FAM[f].P;
      S.gen[o + 2] = hash(n, f, j) * 2 * PI;
    }
  for (let k = 0; k < NSPOT; k++) {
    const tt = S.tau / SPOTP[k], n = floor(tt), q = tt - n, sn = sin(PI * q), o = k * 3;
    const r0 = 6.8 + 9 * hash(n, k, 7);
    S.spot[o] = sn * sn;
    S.spot[o + 1] = r0;
    S.spot[o + 2] = hash(n, k, 8) * 2 * PI + OMEGA * q * SPOTP[k] / (r0 * sqrt(r0));
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const t = S.t, beta = S.beta;
  // The tilt knob sets the angle from the spin axis: 75 degrees at 0, 15 above edge-on, and a slow drift
  // of up to 9 degrees either way, a roll of some 7 degrees and a breathing of the flux, none of it with a period.
  const drift = 0.45 * sin(0.31 * t + 0.7) + 0.35 * sin(0.19 * t + 1.3) + 0.2 * sin(0.113 * t + 4.1);
  let inc = ((75 + S.tilt) * PI) / 180 + drift * 0.085;
  inc = inc < 0.17 ? 0.17 : inc > 1.46 ? 1.46 : inc;
  const roll = 0.05 * (sin(0.141 * t + 0.4) + 0.6 * sin(0.083 * t + 2.0) + 0.4 * sin(0.047 * t + 5.0));
  const flux = 1 + 0.25 * sin(0.27 * t + 1.0) + 0.15 * sin(0.163 * t + 3.0);
  const si = sin(inc), ci = cos(inc), cR = cos(roll), sR = sin(roll);

  if (S.lutHue !== S.hue) {
    S.lutHue = S.hue;
    const c = S.c;
    for (let i = 0; i < NR; i++) {
      rampColor((i / (NR - 1)) * XMAX, c);
      turnHue(c, S.hue);
      const mx = Math.max(c[0], c[1], c[2]) || 1;
      S.lut[i * 3] = c[0] / mx;
      S.lut[i * 3 + 1] = c[1] / mx;
      S.lut[i * 3 + 2] = c[2] / mx;
    }
  }

  const { tab, sb, sc, ss, sj, sf, lut, gen, spot, rgb } = S;
  const nf = FAM.length;
  const b4 = 4 * beta;
  const lutScale = (NR - 1) / XMAX;
  rgb.fill(0);

  // The gas at radius r seen at disk azimuth th: flux, observed temperature.
  let outF = 0, outT = 0;
  function gas(r, cp, sp, cA, sA, b) {
    const rx = cp * si - sp * cA * ci, ry = sp * sA;
    const th = atan2(ry, rx);
    const rr = 1 / (r * sqrt(r)), om = OMEGA * rr;
    const g = sqrt(1 - 3 / r) / (1 + rr * b * si * sA);
    // Novikov-Thorne-like profile, 1 at its peak near r = 8.2.
    const prof = ((1 - sqrt(RIN / r)) / (r * r * r)) * 3850;
    const lr = log(r / 8);
    let tex = 1;
    for (let f = 0; f < nf; f++) {
      const F = FAM[f];
      let cs = 0;
      for (let j = 0; j < 2; j++) {
        const o = (f * 2 + j) * 3;
        cs += gen[o] * cos(F.m * (th - om * gen[o + 1]) + F.kr * lr + gen[o + 2]);
      }
      tex += F.amp * cs;
    }
    for (let k = 0; k < NSPOT; k++) {
      const o = k * 3, dr = (r - spot[o + 1]) / 1.7;
      if (dr > -3 && dr < 3 && spot[o] > 0.01) tex += 2.4 * spot[o] * exp(-dr * dr + 3 * (cos(th - spot[o + 2]) - 1));
    }
    tex = tex < 0.25 ? 0.25 : tex;
    outF = prof * tex * flux * Math.pow(g, b4);
    outT = sqrt(sqrt(prof)) * Math.pow(g, beta) * (0.9 + 0.1 * tex);
  }

  for (let p = 0; p < W * H; p++) {
    let ar = 0, ag = 0, ab = 0;
    for (let q = 0; q < NSS; q++) {
      const i = p * NSS + q, b = sb[i];
      const ca0 = sc[i], sa0 = ss[i];
      const cA = ca0 * cR - sa0 * sR, sA = sa0 * cR + ca0 * sR;
      const A = cA * si, nrm = sqrt(A * A + ci * ci);
      const c1 = -A / nrm, s1 = ci / nrm, phi1 = atan2(s1, c1);
      const row = sj[i] * NP, wf = sf[i];
      let cr = 0, cg = 0, cb = 0, w1 = 0;
      // The first crossing of the disk plane: the image of the near side below the shadow and
      // the far side bent over it.
      {
        const fp = phi1 / DP, k = fp | 0, fr = fp - k;
        const u0 = tab[row + k] + (tab[row + k + 1] - tab[row + k]) * fr;
        const u1 = tab[row + NP + k] + (tab[row + NP + k + 1] - tab[row + NP + k]) * fr;
        const u = u0 + (u1 - u0) * wf;
        if (u > 1 / ROUT) {
          const r = 1 / u;
          w1 = smooth((r - (RIN - 0.3)) / 0.6) * (1 - smooth((r - (ROUT - 6)) / 6));
          if (w1 > 0.001) {
            gas(r, c1, s1, cA, sA, b);
            let v = 1 - exp(-0.95 * outF);
            const x = outT * 0.95 * lutScale, xi = x < 0 ? 0 : x > NR - 1.001 ? NR - 1.001 : x, xk = xi | 0;
            v *= w1;
            cr += v * lut[xk * 3]; cg += v * lut[xk * 3 + 1]; cb += v * lut[xk * 3 + 2];
          }
        }
      }
      // The second crossing, after half a turn round the hole: the thin bright image of the
      // underside of the disk close to the shadow.
      if (b < 8.5) {
        const fp = (phi1 + PI) / DP, k = fp | 0, fr = fp - k;
        const u0 = tab[row + k] + (tab[row + k + 1] - tab[row + k]) * fr;
        const u1 = tab[row + NP + k] + (tab[row + NP + k + 1] - tab[row + NP + k]) * fr;
        const u = u0 + (u1 - u0) * wf;
        if (u > 1 / ROUT) {
          const r = 1 / u;
          const w2 = smooth((r - (RIN - 0.3)) / 0.6) * (1 - smooth((r - (ROUT - 6)) / 6)) * (1 - w1);
          if (w2 > 0.001) {
            gas(r, -c1, -s1, cA, sA, b);
            let v = 1 - exp(-0.95 * outF);
            const x = outT * 0.95 * lutScale, xi = x < 0 ? 0 : x > NR - 1.001 ? NR - 1.001 : x, xk = xi | 0;
            v *= w2;
            cr += v * lut[xk * 3]; cg += v * lut[xk * 3 + 1]; cb += v * lut[xk * 3 + 2];
          }
        }
      }
      // The thin ring where the light has gone round the hole several times, too narrow for the
      // table to resolve: a Gaussian in b, favouring the side turning towards you.
      if (b > 4.6 && b < 6) {
        const e = (b - 5.3) / 0.3, wr = exp(-e * e) * (1 - w1);
        if (wr > 0.01) {
          const g = 0.707 / (1 + 0.068 * b * si * sA), gb = Math.pow(g, b4);
          const v = (1 - exp(-0.9 * gb)) * wr * 0.7;
          const x = 1.0 * Math.pow(g, beta) * lutScale, xk = (x < 0 ? 0 : x > NR - 1.001 ? NR - 1.001 : x) | 0;
          cr += v * lut[xk * 3]; cg += v * lut[xk * 3 + 1]; cb += v * lut[xk * 3 + 2];
        }
      }
      ar += cr; ag += cg; ab += cb;
    }
    rgb[p * 3] = ar / NSS;
    rgb[p * 3 + 1] = ag / NSS;
    rgb[p * 3 + 2] = ab / NSS;
  }

  // A glow: the picture blurred over five LEDs, added back.
  const tmp = S.tmp, bl = S.blur, K0 = 6 / 16, K1 = 4 / 16, K2 = 1 / 16;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let ch = 0; ch < 3; ch++) {
        let s = 0;
        for (let d = -2; d <= 2; d++) {
          const xx = x + d;
          if (xx < 0 || xx >= W) continue;
          s += rgb[(y * W + xx) * 3 + ch] * (d === 0 ? K0 : d === 1 || d === -1 ? K1 : K2);
        }
        tmp[(y * W + x) * 3 + ch] = s;
      }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let ch = 0; ch < 3; ch++) {
        let s = 0;
        for (let d = -2; d <= 2; d++) {
          const yy = y + d;
          if (yy < 0 || yy >= H) continue;
          s += tmp[(yy * W + x) * 3 + ch] * (d === 0 ? K0 : d === 1 || d === -1 ? K1 : K2);
        }
        bl[(y * W + x) * 3 + ch] = s;
      }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let r = rgb[o] + 0.55 * bl[o], g = rgb[o + 1] + 0.55 * bl[o + 1], b = rgb[o + 2] + 0.55 * bl[o + 2];
      const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
      // Past 1 the colour is scaled down to keep its hue, then only the very hottest goes white.
      if (mx > 1) {
        const k = 1 / mx, wh = (mx - 1) * 0.5 > 1 ? 1 : (mx - 1) * 0.5;
        r = r * k + (1 - r * k) * wh * 0.6; g = g * k + (1 - g * k) * wh * 0.6; b = b * k + (1 - b * k) * wh * 0.6;
      }
      display.setPixel(x, y, 255 * r, 255 * g, 255 * b);
    }
}
