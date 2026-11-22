// ===== Patternflow pattern =====
// Title:   Light Echo
// Family:  lightecho
// Idea:    A star flares once and the flash, spreading at the speed of light, lights the dust around it one thin paraboloid at a time, so the panel shows rings and arcs of blue-white light with amber wakes that race outward faster than light across a dark field, gapped and knotted where the dust is, until a new flare fires after a random quiet and the old echo fades under the new rings.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Light echoes of an outburst (Paul Couderc, 1939, for Nova Persei 1901), the echo of V838 Monocerotis seen by Hubble from 2002 (Howard Bond and colleagues, 2003), single scattering with the Henyey-Greenstein phase function (L. G. Henyey and J. L. Greenstein, 1941), pattern round 222
// Round:   222
// ===============================
// @matrix 64x128
// @knobs Hue=-0.5..0.5, Speed=0..3, Dust=-1..1, Flash=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel by the knob, in turns. At 0 the leading edge of an echo is blue (36, 102, 255) to pale blue (115, 184, 255) and what lies behind it runs through pale gold (255, 219, 140) and gold (255, 168, 41) to rust (173, 36, 10); the colour also warms with the distance from the star, so at the opening the knotted core near the star is blue and the outer rings are gold. At -0.5 and 0.5 the two are swapped, gold at the core and blue outside. At -0.25 the rings are magenta and the core green, and at 0.25 the other way round.
// Knob 2: Speed. The light travel time T, the radius in LEDs of the flash's sphere, grows 0.45 LEDs a second for each unit of Speed: 0.9 at the opening 2, 1.35 at 3. At 0 it stands still, and with it the flare clock and the whole picture. Dust level with the star lights up in a ring of radius T, which at Speed 2 starts at 6, reaches the sides of the panel (32) after 29 s, the top and bottom (64) after 64 s and the corners (71.6) after 73 s. Dust in front of the star lights up at sqrt(T^2 + 2 T z), so its rings spread faster than T does. At 0.5 everything takes four times as long.
// Knob 3: Dust. How much dust there is. The sheets are half 0.11 times 2.2 to the knob thick, in lattice cells that are one shell apart: 0.05 at -1, 0.11 at 0 and 0.24 at 1. The cut-off of the gap noise moves from 0.53 at -1 through 0.37 at 0 to 0.21 at 1. At -1 the echo is a few thin knotted filaments with large gaps between them, and at 1 the sheets are curtains wide enough to run together, with hardly a gap. The knob follows with a lag of 0.25 s.
// Knob 4: Flash. How long the flash lasts, as the thickness of the lit shell in LEDs of light travel: 1.1 at -1, 5.9 at the opening 0.06 and 26 at 1. The picture is three samples taken 0.12, 0.7 and 1.7 times that thickness behind the leading edge, blue-white first and amber after, weighted 1, 0.75 and 0.45. At -1 only a crisp blue-white edge is left, and at 1 each ring is three wide copies of itself, mostly amber, that blur into bands. The knob follows with a lag of 0.25 s.

// The panel looks along +z at dust that surrounds a star at the middle of the panel (32, 64). The star
// flared at T = 0. A dust point at distance rho from the line of sight and depth z toward the viewer is
// lit now when z = (rho^2 - T^2) / (2 T), the paraboloid of Couderc's echo, and its distance from the star
// is r = rho^2/(2T) + T/2 on it. So each LED asks one question, what dust lies at (x - 32, y - 64, z) for
// the z that T gives, and the sweep of T through the dust is the whole motion. A real flash lasts, and
// fades, so the light that reaches an LED is the dust on three paraboloids, 0.12, 0.7 and 1.7 flash
// lengths behind the leading edge (depths z = (rho^2 - D^2) / (2 D) with D = T - age), weighted 1, 0.75 and
// 0.45 and coloured by age, so the leading edge is blue and the wake goes gold, orange and rust.
// The dust is made of shells whose spacing grows with the distance from the star: the density is a
// ridged value noise, thin sheets where the noise is near one half, read at the coordinates (4.6 ln r,
// 1.5 x/r, 1.5 y/r) in lattice cells, with a little warp and a second family of shells at 0.35 weight that
// fades as the echo ages. Because the structure scales with r, the picture is a family of rings at every
// T and has no outer edge: as T grows the rings only get coarser and the new ones are born at the middle,
// where r = T/2 crosses a shell. A low-frequency noise of the same coordinates, cut off at 0.37, leaves
// the gaps. Rings thinner than an LED fade to nothing instead of aliasing.
// Brightness is density times the Henyey-Greenstein phase (g = 0.4) times 1 / sqrt(1 - cos) for the thick
// forward shell times 1 / (r^2 + 600), the last three raised to the fourth root after dividing by their
// largest value over the panel, so the outer rings stay visible. The colour of an LED is that of its
// brightest sample (samples count by the square of their light). A [1 2 1] blur makes lines two LEDs wide,
// and an exposure that follows the last few seconds aims at a mean compressed brightness of 0.17, within
// 0.3 to 4 times, so sparse and crowded stretches show alike.
// A flare is an echo that starts at T = 1 to 2.5 with a soft white-blue glow at the star (sigma 4.5 LEDs,
// fading with a time constant of 3.6 s at Speed 2). The next one fires when the echo has travelled 34 + 64 u^1.5 LEDs, u
// uniform, so after 36 to 107 s at Speed 2 (66 s on average), mostly the shorter. It takes its dust from the best of ten
// random places (the one with the fewest gaps in the directions around the star) and its own shell
// density (0.8 to 1.25 times) and breakage (0.8 to 1.3 times), so no two look alike. The echo before it
// fades by a factor e every 14 LEDs of travel (about 16 s) and is dropped after 48.
// The first frame is T = 6, so at 2 s the rings already cover the panel.
// Approximations: noise stands for dust; the scattering is single and the dust optically thin, with no
// extinction, so the warm colour comes from the age of the light and the distance from the star and is
// not computed from reddening; g = 0.4 where interstellar dust is nearer 0.6; the shell is three samples
// and the forward thickening is 1 / sqrt(1 - cos), not 1 / (1 - cos); the shells that scale with r are a
// choice for a picture that never runs out, not Couderc's dust; a new flare sits in a different part of
// the dust rather than at the same place in the same cloud.

const W = 64, H = 128, N = W * H;
const CX = 32, CY = 64;
const { floor, sqrt, exp, abs, min, max, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sst = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- value noise on a hashed lattice (256 cells a side, 3D) ----
const PT = new Uint8Array(512), VT = new Float32Array(256);
(() => {
  let s = 0x2f6e2b1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const p = [];
  for (let i = 0; i < 256; i++) { p.push(i); VT[i] = rnd(); }
  for (let i = 255; i > 0; i--) { const j = floor(rnd() * (i + 1)), t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) PT[i] = p[i & 255];
})();
function vn(x, y, z) {
  const xf = floor(x), yf = floor(y), zf = floor(z);
  let fx = x - xf, fy = y - yf, fz = z - zf;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  fz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const xi = xf & 255, yi = yf & 255, zi = zf & 255;
  const a = PT[xi] + yi, b = PT[xi + 1] + yi;
  const aa = PT[a] + zi, ab = PT[a + 1] + zi, ba = PT[b] + zi, bb = PT[b + 1] + zi;
  const c000 = VT[PT[aa]], c001 = VT[PT[aa + 1]], c010 = VT[PT[ab]], c011 = VT[PT[ab + 1]];
  const c100 = VT[PT[ba]], c101 = VT[PT[ba + 1]], c110 = VT[PT[bb]], c111 = VT[PT[bb + 1]];
  const x00 = c000 + (c100 - c000) * fx, x01 = c001 + (c101 - c001) * fx;
  const x10 = c010 + (c110 - c010) * fx, x11 = c011 + (c111 - c011) * fx;
  const y0 = x00 + (x10 - x00) * fy, y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}

// ---- tunables ----
const A_SHELL = 4.6; // dust shells per e-fold of the distance from the star
const B_DIR = 1.5; // dust lattice cells across the whole range of directions
const RATE = 0.45; // observer time (LEDs of light travel) per second at Speed 1
const T0 = 6; // light travel time at the first frame, in LEDs
const G_HG = 0.4; // Henyey-Greenstein asymmetry
const R0SQ = 600; // softening of the 1/r^2 fall-off
const FLARE_LO = 34, FLARE_SPAN = 64; // the next flare fires when the echo has travelled this far, most often soon, now and then late
const OUT0 = 0.17; // the mean of the compressed brightness that the exposure aims for
const GAIN_LO = 0.3, GAIN_HI = 4;
const RC = 0.8253, RS = 0.5646; // 34 degrees, so the noise lattice is not square to the panel
const FADE = 14; // an echo is a third as bright this many LEDs of light travel after the next flare
const NS = 3;
const QS = [0.12, 0.7, 1.7]; // sample ages as fractions of the flash length
const QW = [1, 0.75, 0.45];

// dust palette: stops by warmth
const STOPS = [
  [0.0, 0.14, 0.4, 1.0],
  [0.16, 0.45, 0.72, 1.0],
  [0.27, 1.0, 0.86, 0.55],
  [0.42, 1.0, 0.66, 0.16],
  [0.62, 0.95, 0.38, 0.06],
  [0.82, 0.68, 0.14, 0.04],
  [1.0, 0.4, 0.06, 0.04],
];
function rgb2hsv(r, g, b) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, mx > 0 ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return i === 0 ? [v, t, p] : i === 1 ? [q, v, p] : i === 2 ? [p, v, t] : i === 3 ? [p, q, v] : i === 4 ? [t, p, v] : [v, p, q];
}
const PN = 64;
function buildPalette(S, hue) {
  for (let i = 0; i < PN; i++) {
    const a = i / (PN - 1);
    let k = 0;
    while (k < STOPS.length - 2 && a > STOPS[k + 1][0]) k++;
    const A = STOPS[k], B = STOPS[k + 1], t = cl((a - A[0]) / (B[0] - A[0]), 0, 1);
    const r = A[1] + (B[1] - A[1]) * t, g = A[2] + (B[2] - A[2]) * t, b = A[3] + (B[3] - A[3]) * t;
    const hs = rgb2hsv(r, g, b), o = hsv2rgb(hs[0] + hue, hs[1], hs[2]);
    S.pal[i * 3] = o[0]; S.pal[i * 3 + 1] = o[1]; S.pal[i * 3 + 2] = o[2];
  }
}

// A cheap sine for the warp: a parabola on the period, good to about 6 percent.
function ws(x) {
  let t = x * 0.15915494;
  t -= floor(t + 0.5);
  return 8 * t * (1 - 2 * (t < 0 ? -t : t));
}

function rng(S) {
  S.seed = (Math.imul(S.seed, 1664525) + 1013904223) >>> 0;
  return S.seed / 4294967296;
}

// Where in the dust this flare sits: of ten random places, the one whose gaps leave the most
// directions lit, so no flare opens with half the panel bare.
function newEcho(S, ts) {
  const o = () => rng(S) * 200;
  const sa = 0.8 + rng(S) * 0.45, sb = 0.8 + rng(S) * 0.5; // finer or coarser shells, smoother or more broken
  let best = null, bs = -1e9;
  for (let k = 0; k < 10; k++) {
    const e = { ts, tb: S.tobs, o1: o(), o2: o(), o3: o(), o4: o(), o5: o(), o6: o(), sa, sb, flash: ts < 4, sup: -1 };
    let sc = 0;
    for (let j = 0; j < 24; j++) {
      const a = j * 0.5236, rad = j % 2 ? 0.95 : 0.55, rr = j < 12 ? 22 : 48;
      const v0 = rad * Math.cos(a) * sb * B_DIR, w0 = rad * Math.sin(a) * sb * B_DIR;
      const c = vn(sa * A_SHELL * log(rr) * 0.28 + e.o1, (v0 * 0.54 - w0 * 0.84) * 1.5 + e.o2, (v0 * 0.84 + w0 * 0.54) * 1.5 + e.o3);
      sc += c > 0.45 ? 1 : c > 0.38 ? 0 : -2;
    }
    if (sc > bs) { bs = sc; best = e; }
  }
  return best;
}

export function setup(params) {
  const S = (params.s = {
    seed: 0x51ed270b, tobs: 0, t: 0,
    hue: 0, spd: 2, dust: 0, fl: 0.06,
    pal: new Float32Array(PN * 3), palHue: 1e9,
    rho2: new Float32Array(N), rho: new Float32Array(N),
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N), A: new Float32Array(N), Wt: new Float32Array(N), tmp: new Float32Array(N),
    echoes: [], next: 0, out: OUT0, gain: 1,
  });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - CX, dy = y - CY, i = y * W + x;
    S.rho2[i] = dx * dx + dy * dy; S.rho[i] = sqrt(dx * dx + dy * dy);
  }
  S.echoes.push(newEcho(S, T0));
  S.next = FLARE_LO + Math.pow(rng(S), 1.5) * FLARE_SPAN - T0;
  // One frame drawn to nowhere, so the exposure is right from the first frame shown.
  buildPalette(S, 0); S.palHue = 0;
  for (let k = 0; k < 8; k++) {
    render(S, null);
    S.gain = cl(S.gain * Math.pow(OUT0 / (S.out + 0.002), 0.7), GAIN_LO, GAIN_HI);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const a = 1 - exp(-d / 0.25);
  S.hue = cl(kn[0], -0.5, 0.5);
  S.spd = cl(kn[1], 0, 3);
  S.dust += (cl(kn[2], -1, 1) - S.dust) * a;
  S.fl += (cl(kn[3], -1, 1) - S.fl) * a;
  S.t += d;
  S.tobs += d * RATE * S.spd;
  if (S.hue !== S.palHue) { buildPalette(S, S.hue); S.palHue = S.hue; }
  if (S.tobs >= S.next) {
    for (const e of S.echoes) if (e.sup < 0) e.sup = S.tobs;
    const ts = 1 + rng(S) * 1.5;
    S.echoes.push(newEcho(S, ts));
    S.next = S.tobs + FLARE_LO + Math.pow(rng(S), 1.5) * FLARE_SPAN - ts;
  }
  for (let i = S.echoes.length - 1; i >= 0; i--) {
    if (S.echoes[i].sup >= 0 && S.tobs - S.echoes[i].sup > 3.4 * FADE) S.echoes.splice(i, 1);
  }
  // Exposure follows what was shown over the last few seconds, so a sparse stretch of dust is
  // brightened and a crowded one dimmed.
  S.gain = cl(S.gain * Math.pow(OUT0 / (S.out + 0.002), 1 - exp(-d / 4)), GAIN_LO, GAIN_HI);
}

// [1 2 1] / 4 across and down, so a one-LED line becomes a soft two-LED one.
function blur(S, a) {
  const t = S.tmp;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    t[o] = 0.75 * a[o] + 0.25 * a[o + 1];
    for (let x = 1; x < W - 1; x++) t[o + x] = 0.5 * a[o + x] + 0.25 * (a[o + x - 1] + a[o + x + 1]);
    t[o + W - 1] = 0.75 * a[o + W - 1] + 0.25 * a[o + W - 2];
  }
  for (let y = 0; y < H; y++) {
    const o = y * W, u = y > 0 ? o - W : o, d = y < H - 1 ? o + W : o;
    for (let x = 0; x < W; x++) a[o + x] = 0.5 * t[o + x] + 0.25 * (t[u + x] + t[d + x]);
  }
}

function render(S, display) {
  const R = S.R, G = S.G, B = S.B, A = S.A, Wt = S.Wt, rho2 = S.rho2, rho = S.rho, pal = S.pal;
  // A holds the light at each LED. R, G and B hold its colour, each sample counting by the
  // square of its light, so where a blue edge and an amber wake overlap the stronger one wins
  // instead of the two adding up to grey.
  R.fill(0); G.fill(0); B.fill(0); A.fill(0); Wt.fill(0);
  const TH0 = 0.11 * Math.pow(2.2, S.dust); // ridge half thickness
  const C0 = 0.37 - 0.16 * S.dust;
  const HAZE = 0.012 * (S.dust + 1);
  const tau = 1.1 * exp((S.fl + 1) * 0.5 * Math.log(24));
  const g2 = 1 + G_HG * G_HG, g2a = 1 - G_HG * G_HG;
  for (let ei = 0; ei < S.echoes.length; ei++) {
    const e = S.echoes[ei];
    const T = e.ts + (S.tobs - e.tb), age = T - e.ts;
    const amp = (e.flash ? 1 - exp(-age / 0.8) : 1) / (1 + age / 90) * (e.sup < 0 ? 1 : exp(-(S.tobs - e.sup) / FADE));
    if (amp < 0.03) continue;
    // exposure: the mean brightness of the brightest part of the panel
    let bref = 0;
    for (let q = 0; q <= 72; q += 6) {
      const rr = (q * q + T * T) / (2 * T), cs = (q * q - T * T) / (q * q + T * T);
      const h = g2 - 2 * G_HG * cs, v = (g2a / (h * sqrt(h))) / sqrt(1 - cs < 0.25 ? 0.25 : 1 - cs) / (rr * rr + R0SQ);
      bref = max(bref, v);
    }
    const ibref = 1 / bref;
    for (let q = 0; q < NS; q++) {
      const u = tau * QS[q], D = T - u;
      if (D < 1) continue;
      const wk = QW[q] * amp * 1.9 * sst(1, 10, D), inv2D = 1 / (2 * D), D2 = D * D;
      const ag = 0.45 * u / (u + 6) + 0.55 * QS[q] / (QS[q] + 0.9);
      // As an echo ages its sheets thin and the second family of shells fades.
      const w2 = 0.35 * cl(1.3 - T / 70, 0.2, 1), TH = TH0 * (1 - 0.4 * sst(40, 110, T));
      for (let y = 0, i = 0; y < H; y++) {
        const dy = y - CY;
        for (let x = 0; x < W; x++, i++) {
          const dx = x - CX, r2 = rho2[i];
          const z = (r2 - D2) * inv2D;
          const rs2 = r2 + z * z, rs = sqrt(rs2), cs = z / rs;
          const h = g2 - 2 * G_HG * cs;
          const hg = g2a / (h * sqrt(h));
          const col = 1 / sqrt(1 - cs < 0.25 ? 0.25 : 1 - cs);
          // dust: shells whose spacing grows with the distance from the star, bent by direction
          const ir = 1 / rs, rr = rho[i];
          const fa = e.sa * A_SHELL * rr / (D * rs), fb = e.sb * B_DIR * ir;
          const ca = 1 / (1 + 8 * fa * fa + 14 * fb * fb);
          const lr = e.sa * A_SHELL * log(rs);
          const v0 = dx * ir * e.sb * B_DIR, w0 = dy * ir * e.sb * B_DIR;
          const cv = sst(C0, C0 + 0.22, vn(lr * 0.28 + e.o1, (v0 * 0.54 - w0 * 0.84) * 1.5 + e.o2, (v0 * 0.84 + w0 * 0.54) * 1.5 + e.o3));
          let dens;
          if (cv <= 0 || ca < 0.05) {
            dens = ca * cv * (0.25 + HAZE);
          } else {
            const lq = lr + 0.3 * ws(1.9 * v0 + 1.1 * w0 + 0.6) + 0.14 * ws(4.1 * v0 - 2.3 * w0 + 2.0);
            const vq = v0 + 0.2 * ws(0.9 * lr + 2.0 * w0 + 1.7), wq = w0 + 0.2 * ws(1.2 * lr - 1.6 * v0 + 4.1);
            const n = vn(lq + e.o4, vq * RC - wq * RS + e.o5, vq * RS + wq * RC + e.o6);
            const r1 = 1 - abs(2 * n - 1), sheet = sst(1 - TH, 1 - TH * 0.25, r1) + 0.22 * sst(1 - 3.5 * TH, 1, r1);
            const m = vn(lq * 0.8 + 2.2, vq * 1.7 + 9.4, wq * 1.7 + 4.4);
            const r2 = 1 - abs(2 * m - 1), sh2 = sst(1 - TH, 1 - TH * 0.25, r2);
            dens = ca * cv * (sheet * (0.6 + 0.6 * sst(0.25, 0.75, m)) + w2 * sh2 + HAZE);
          }
          const gq = sqrt(hg * col * ibref / (rs2 + R0SQ)), I = dens * sqrt(gq) * wk;
          if (I < 1e-7) continue;
          let wm = ag + 0.32 * rs / (rs + 220) + 0.06 * dens;
          wm = wm > 1 ? 1 : wm;
          const pi = ((wm * (PN - 1) + 0.5) | 0) * 3;
          const I2 = I * I;
          A[i] += I; Wt[i] += I2;
          R[i] += I2 * pal[pi]; G[i] += I2 * pal[pi + 1]; B[i] += I2 * pal[pi + 2];
        }
      }
    }
  }
  // The flare itself: a soft glow at the star that dies away in a few seconds.
  for (let ei = 0; ei < S.echoes.length; ei++) {
    const e = S.echoes[ei];
    if (!e.flash) continue;
    const age = S.tobs - e.tb;
    const gl = 1.4 * exp(-age / 3.2) * (e.sup < 0 ? 1 : exp(-(S.tobs - e.sup) / FADE));
    if (gl < 0.01) continue;
    for (let y = CY - 15; y <= CY + 15; y++) {
      for (let x = CX - 15; x <= CX + 15; x++) {
        const i = y * W + x, v = gl * exp(-rho2[i] / 40);
        const v2 = v * v;
        A[i] += v; Wt[i] += v2;
        R[i] += v2 * pal[18]; G[i] += v2 * pal[19]; B[i] += v2 * pal[20];
      }
    }
  }
  for (let i = 0; i < N; i++) {
    const w = Wt[i];
    if (w > 0) { const f = A[i] / w; R[i] *= f; G[i] *= f; B[i] *= f; }
  }
  blur(S, R); blur(S, G); blur(S, B);
  let sum = 0;
  const k = 1.5 * S.gain;
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      const r = R[i], g = G[i], b = B[i], mx = r > g ? (r > b ? r : b) : g > b ? g : b;
      if (mx < 1e-5) { if (display) display.setPixel(x, y, 0, 0, 0); continue; }
      // Brightness is compressed on the strongest channel so that the colour ratio holds,
      // and only the brightest light drifts toward white.
      const t0 = 1 - exp(-mx * k);
      sum += t0;
      if (!display) continue;
      const t = t0 * Math.pow(t0, 0.35), sc = t / mx, wh = 0.5 * t * t * t;
      display.setPixel(x, y, 255 * (r * sc + (1 - r * sc) * wh), 255 * (g * sc + (1 - g * sc) * wh), 255 * (b * sc + (1 - b * sc) * wh));
    }
  }
  S.out = sum / N;
}

export function draw(display, params) {
  if (params.s) render(params.s, display);
}
