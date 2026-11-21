// ===== Patternflow pattern =====
// Title:   Infinity Mirror
// Family:  mirrorroom
// Idea:    A ring of 96 coloured beads sits between a half-silvered front mirror and a full back mirror, and the panel shows the corridor of its images, each one a smaller, dimmer and greener copy of the one before, squeezing together along a harmonic ladder until they melt into a haze, with the same comets chasing round every copy at once; when the two mirrors are a little out of parallel the corridor leans, the copies slide sideways in a curve and turn toward edge-on, and the direction of the lean wanders.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the images of a light between two facing mirrors, which lie on a circle about the line where the mirrors meet when they are tilted (David Brewster, the kaleidoscope, 1816), as built in Yayoi Kusama's Infinity Mirror Rooms (1965), pattern round 212
// Round:   212
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Chase=-3..3, Tilt=0.4..1, Gap=-1..1
//
// Knob 1: Hue. Turns the ring's colours round the colour wheel. At 0 the ring is pink and violet, drifting toward blue and rose over a minute or two; at 0.25 it is orange and yellow, at 0.5 green, at 0.75 blue. The glass takes red out of the light faster than green, so the deep copies lean toward teal whatever the ring's colour.
// Knob 2: Chase. How fast the three comets run round the ring, 0.06 laps a second for each unit, and which way. At 2, where it opens, the first comet takes 8.3 seconds a lap on average; at 3 it takes 5.6, and at -3 it runs the other way at the same pace. The other two run at 0.61 and 1.37 times that, and all three speed up and slow down on beats of their own. At 0 the comets stand and only the corridor sways.
// Knob 3: Tilt. How far the mirrors are out of parallel, as a share of the largest angle, 0.045 rad. The direction of the tilt wanders all the time and its size swings between a tenth and the whole of the setting. At 0.4, where it opens, the tenth copy sits up to 12 LEDs off the middle and the corridor leans and snakes; at 1 it is up to 22 LEDs, the deep copies turn edge-on and fold, and the corridor bends in a deep curve that ends sooner.
// Knob 4: Gap. The gap between the mirrors as a share of the viewing distance, g/D, which is 0.3 times 2 to the power of the knob: 0.15 at -1, 0.31 at the opening and 0.6 at 1, and the eye's drift swells and shrinks it by a fifth. At -1 the first copy sits 3.7 LEDs inside the ring and the copies crowd into a long, glowing corridor; at 1 it sits 9.5 LEDs in, the rings stand apart and the corridor is a short, dark tunnel.

// Two mirrors face each other with the ring between them. The front one is
// half-silvered and is the glass the eye looks through, at depth 0; the back
// one is a full mirror at depth g; the ring sits at g / 2. The images of the
// ring then lie at depths z_j = (j + 0.5) g, j = 0, 1, 2 ..., and image j has
// been reflected j times. An eye at distance D in front sees image j at
// D / (D + z_j) of its real size, which is a harmonic ladder: the copies get
// closer together in the picture the deeper they are, and never reach a point.
// Every pair of reflections costs one trip off the half mirror, so the
// brightness falls by P in pairs (an odd image is the one before it, seen
// through one more reflection off the full mirror), and the tinted glass takes
// more red than green out of the light each time, so the deep copies go teal.
//
// A pair of mirrors tilted by a small angle eps gives images on a circle of
// radius R = g / eps about the line where the mirrors meet, and image j has
// turned by phi_j = eps (j + 0.5) about that line. Its centre lies at
// R (1 - cos phi) to the side and R sin phi deep, and its plane is turned by
// phi, so the side of the ring nearer the line is nearer the eye and looks
// bigger. The sideways slide is eps g (j + 0.5)^2 / 2 for small tilts. That is
// about a quarter of z_j tan(2 eps j), the estimate that turns the image by 2 eps
// for every reflection and puts it at the end of the tangent: the turn is eps a
// reflection (2 eps a pair), and the image sits on the arc, half way to the
// tangent's end. An elliptical soft limit keeps each copy's centre in the panel.
//
// The ring's chase is read off at one instant for every copy, since the light
// from all of them left the ring at the same time, and a mirror parallel to the
// ring plane does not turn left into right, so the comets run the same way in
// every copy.

const W = 64, H = 128, CX = 32, CY = 64;
const { floor, ceil, sin, cos, exp, abs, min, max, hypot, tanh, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const HW = 30, HH = 62, RAD = 10; // the real ring: 60 by 124 LEDs, two in from the edge, corners 10 LEDs round
const NB = 96; // beads on the ring
const D = 100; // the eye's distance from the front glass, in LEDs
const NC = 64; // copies drawn, at most
const SIG0 = 0.75; // the smallest blob radius, LEDs
const PAIR = 0.82; // brightness kept by a pair of reflections
const BACK = 0.94; // brightness kept by one reflection off the full mirror
const TINT = [0.76, 1.0, 0.95]; // what a round trip leaves of red, green and blue, relative to the best channel
const EPS_MAX = 0.045; // the biggest tilt, radians
const LIMX = 21, LIMY = 40; // how far a copy's centre may slide from the middle, LEDs
const BASE = 0.4; // how bright a bead is with no comet on it
const TEAL = [0.05, 0.85, 0.75]; // the colour the glass takes the light to
const TEAL_MIX = 0.5; // how much of it the deepest copies get
const HAZE = 0.22; // the brightness of the glow where the corridor ends
const GAIN = 1.6; // the steepness of the tone curve
const BLOOM = 0.2; // how much of the blurred light is added back
const TN = 1023, TS = 256; // the tone table: light up to 4, in steps of 1/256
// Light to LED value. The curve is the soft clip 1 - exp(-GAIN v), raised to
// 0.78 so that the faint end of the corridor still lights its LEDs.
const TONE = new Float32Array(TN + 1).map((_, i) => 255 * pow(1 - exp((-GAIN * i) / TS), 0.78));

// ---- the ring: beads at equal steps of arc length along a rounded rectangle
const BEAD = (() => {
  const sx = HW - RAD, sy = HH - RAD;
  const segs = [
    ["l", 0, -HH, sx, -HH],
    ["a", sx, -sy, -PI / 2],
    ["l", HW, -sy, HW, sy],
    ["a", sx, sy, 0],
    ["l", sx, HH, -sx, HH],
    ["a", -sx, sy, PI / 2],
    ["l", -HW, sy, -HW, -sy],
    ["a", -sx, -sy, PI],
    ["l", -sx, -HH, 0, -HH],
  ];
  const len = segs.map((s) => (s[0] === "l" ? hypot(s[3] - s[1], s[4] - s[2]) : (PI / 2) * RAD));
  const total = len.reduce((a, b) => a + b, 0);
  const xs = new Float32Array(NB), ys = new Float32Array(NB);
  for (let i = 0; i < NB; i++) {
    let d = ((i + 0.5) / NB) * total, k = 0;
    while (k < segs.length - 1 && d > len[k]) d -= len[k++];
    const s = segs[k], q = d / len[k];
    if (s[0] === "l") {
      xs[i] = s[1] + (s[3] - s[1]) * q;
      ys[i] = s[2] + (s[4] - s[2]) * q;
    } else {
      xs[i] = s[1] + RAD * cos(s[3] + q * (PI / 2));
      ys[i] = s[2] + RAD * sin(s[3] + q * (PI / 2));
    }
  }
  return { xs, ys, total };
})();

function hsv(h, s, v, out) {
  h -= floor(h);
  const x = h * 6, i = floor(x), f = x - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  if (i === 0) { out[0] = v; out[1] = t; out[2] = p; }
  else if (i === 1) { out[0] = q; out[1] = v; out[2] = p; }
  else if (i === 2) { out[0] = p; out[1] = v; out[2] = t; }
  else if (i === 3) { out[0] = p; out[1] = q; out[2] = v; }
  else if (i === 4) { out[0] = t; out[1] = p; out[2] = v; }
  else { out[0] = v; out[1] = p; out[2] = q; }
}

// Three comets. Speeds are in turns of the ring a second per unit of Chase and
// are not in whole ratios, so the three never settle into a pattern.
const COMET = [
  { m: 1.0, tail: 0.13, amp: 1.25, hue: 0.0, ph0: 0.0 },
  { m: 0.61, tail: 0.1, amp: 1.0, hue: 0.04, ph0: 0.37 },
  { m: 1.37, tail: 0.075, amp: 0.85, hue: -0.05, ph0: 0.71 },
];

export function setup(params) {
  params.s = {
    t: 0,
    ph: COMET.map((c) => c.ph0),
    rho: 0,
    init: false, k1: 0, k2: 2, k3: 0.4, k4: 0,
    br: new Float32Array(NB), bg: new Float32Array(NB), bb: new Float32Array(NB),
    // per copy: centre, scale, blob radius, colour
    cc: Object.fromEntries(["x", "y", "cx0", "cy0", "Lc", "zc", "cph", "sph", "sig", "f", "r", "g", "b", "tm"].map((k) => [k, new Float32Array(NC)])),
    haze: [0, 0, 0], nc: 0, half: 0, tx: 1, ty: 0, et: 0, ep: 0,
    acc: new Float32Array(W * H * 3), bloom: new Float32Array(W * H * 3), tmp: new Float32Array(W * H * 3),
    c: [0, 0, 0], c2: [0, 0, 0],
  };
}

function gapOf(k) {
  return 0.3 * pow(2, k);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  const h = cl(dt || 0, 0, 0.1);
  // The knobs ease in over about a third of a second.
  const e = 1 - exp(-h / 0.3);
  const T1 = cl(kn[0], 0, 1), T2 = cl(kn[1], -3, 3), T3 = cl(kn[2], 0.4, 1), T4 = cl(kn[3], -1, 1);
  if (!S.init) {
    S.init = true;
    S.k1 = T1; S.k2 = T2; S.k3 = T3; S.k4 = T4;
  } else {
    S.k1 += (T1 - S.k1) * e;
    S.k2 += (T2 - S.k2) * e;
    S.k3 += (T3 - S.k3) * e;
    S.k4 += (T4 - S.k4) * e;
  }
  S.t += h;
  const t = S.t;

  // ---- the chase
  const lap = 0.06 * S.k2;
  for (let k = 0; k < 3; k++) {
    // each comet's pace swells and slackens on two beats of its own
    const pace = 1 + 0.32 * sin((TAU * t) / (13.7 + 3.1 * k) + 1.9 * k) + 0.2 * sin((TAU * t) / (37.9 + 8.3 * k) + 0.7 + k);
    S.ph[k] += lap * COMET[k].m * pace * h;
    S.ph[k] -= floor(S.ph[k]);
  }
  S.rho += (0.011 + 0.25 * lap) * h;
  S.rho -= floor(S.rho);
  const dir = tanh(S.k2 * 1.2); // which way the tails trail, easing through zero
  // The ring's own colour: pink and violet at Hue 0, wandering a little, with
  // two slow waves of hue round the ring that run on.
  const hue0 = S.k1 + 0.77 + 0.07 * sin((TAU * t) / 97.3 + 0.8) + 0.04 * sin((TAU * t) / 41.7 + 2.3);
  const c = S.c;
  for (let i = 0; i < NB; i++) {
    const u = (i + 0.5) / NB;
    const hr = hue0 + 0.07 * sin(TAU * (u + S.rho)) + 0.03 * sin(TAU * (2 * u - 0.6 * S.rho) + 0.3);
    hsv(hr, 0.9, 1, c);
    // Violet and blue look dimmer on the LEDs than green and yellow, so
    // the ring's light is evened out a little by the hue's brightness.
    const lv = 0.7 / (0.35 + 0.65 * (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]));
    let R = BASE * lv * c[0], G = BASE * lv * c[1], B = BASE * lv * c[2];
    for (let k = 0; k < 3; k++) {
      const cm = COMET[k];
      let x = u - S.ph[k];
      x -= floor(x + 0.5);
      const ax = abs(x);
      const tl = cm.tail * (1 + 0.28 * sin((TAU * t) / (17.3 + 4.1 * k) + k * 1.7));
      const tailv = exp(-ax / tl), frontv = exp(-ax / 0.012);
      // The side a bead is on decides whether the comet's tail trails over it.
      const behind = x < 0 ? 0.5 + 0.5 * dir : 0.5 - 0.5 * dir;
      const w = cm.amp * (1 + 0.2 * sin((TAU * t) / (23.9 + 5.3 * k) + 2.0 * k)) * (behind * tailv + (1 - behind) * frontv);
      hsv(hr + cm.hue, 0.95 - 0.5 * exp(-ax / 0.02), 1, S.c2);
      R += w * lv * S.c2[0];
      G += w * lv * S.c2[1];
      B += w * lv * S.c2[2];
    }
    S.br[i] = R;
    S.bg[i] = G;
    S.bb[i] = B;
  }

  // ---- the tilt: a vector that wanders, never twice the same way
  const tmag = 0.55 + 0.3 * sin((TAU * t) / 31.9 + 1.2) + 0.15 * sin((TAU * t) / 13.3 + 0.4);
  const tang = (TAU * t) / 137.3 + 1.0 * sin((TAU * t) / 43.7 + 0.4) + 0.6 * sin((TAU * t) / 19.1 + 2.9) + 0.9;
  const tilt = S.k3 * EPS_MAX * tmag;
  const evx = tilt * cos(tang), evy = tilt * sin(tang);
  const eps = hypot(evx, evy) + 1e-9;
  const tx = evx / eps, ty = evy / eps;
  // The eye sways a little, so the corridor breathes even when it is straight.
  const eyx = 3.0 * sin((TAU * t) / 23.7 + 0.6) + 1.6 * sin((TAU * t) / 9.3 + 3.4);
  const eyy = 5.0 * sin((TAU * t) / 29.3 + 2.2) + 2.2 * sin((TAU * t) / 11.7 + 0.2);

  // ---- one record per copy
  // The eye drifts nearer and further, so g / D swells and shrinks by about a sixth.
  const ratio = gapOf(S.k4) * (1 + 0.16 * sin((TAU * t) / 47.3 + 1.0) + 0.06 * sin((TAU * t) / 19.7 + 4.0)), g = ratio * D, half = g / 2;
  const cc = S.cc;
  let nc = 0;
  const et = eyx * tx + eyy * ty, ep = -eyx * ty + eyy * tx;
  const pitch0 = BEAD.total / NB;
  for (let j = 0; j < NC; j++) {
    const k = j + 0.5, phi = eps * k;
    const sinc = phi < 1e-3 ? 1 - (phi * phi) / 6 : sin(phi) / phi;
    const omc = phi < 1e-3 ? phi / 2 : (1 - cos(phi)) / phi;
    const Lc = g * k * omc, zc = g * k * sinc;
    const f = (D + half) / (D + zc);
    // brightness: PAIR for a pair of reflections, BACK for the odd one
    const pairs = floor(j / 2);
    const bj = pow(PAIR, pairs) * (j & 1 ? BACK : 1);
    // tint: the best channel stays at one, the others fall behind it
    const tr = pow(TINT[0], pairs + (j & 1)), tg = pow(TINT[1], pairs + (j & 1)), tb = pow(TINT[2], pairs + (j & 1));
    // blobs of neighbouring beads overlap once the copy is small, so the
    // blobs give less each and the line stays as bright as it was
    const sig = max(SIG0, 0.9 * f);
    const fn = (D + half) / (D + g * (k + 1) * sinc);
    const merge = min(1, (pitch0 * f) / (2.2 * sig)) * Math.sqrt(min(1, (HW * abs(f - fn)) / 2.4));
    // a copy turned edge-on has nothing left to show
    const turn = cl((1.45 - phi) / 0.5, 0, 1);
    const a = bj * merge * turn * turn;
    if (a < 0.0004) break;
    // the copy's centre, before and after the soft limit
    const ct = (Lc - et) * f + et, cp = (0 - ep) * f + ep;
    const cx0 = ct * tx - cp * ty, cy0 = ct * ty + cp * tx;
    const nrm = hypot(cx0 / LIMX, cy0 / LIMY) + 1e-9;
    const sc = tanh(nrm) / nrm;
    cc.x[j] = CX + cx0 * sc;
    cc.y[j] = CY + cy0 * sc;
    cc.cx0[j] = cx0;
    cc.cy0[j] = cy0;
    cc.Lc[j] = Lc;
    cc.zc[j] = zc;
    cc.cph[j] = cos(phi);
    cc.sph[j] = sin(phi);
    cc.sig[j] = sig;
    cc.f[j] = f;
    // the glass's own teal glow, which gains on the ring's colour with depth
    cc.tm[j] = a * TEAL_MIX * (1 - pow(0.88, pairs));
    cc.r[j] = a * tr;
    cc.g[j] = a * tg;
    cc.b[j] = a * tb;
    nc = j + 1;
  }
  S.nc = nc;
  let mr = 0, mg = 0, mb = 0;
  for (let i = 0; i < NB; i++) { mr += S.br[i]; mg += S.bg[i]; mb += S.bb[i]; }
  const hp = floor(nc / 2);
  mr *= pow(TINT[0], hp); mg *= pow(TINT[1], hp); mb *= pow(TINT[2], hp);
  const hm = max(mr, mg, mb, 1e-6);
  S.haze[0] = mr / hm; S.haze[1] = mg / hm; S.haze[2] = mb / hm;
  S.half = half;
  S.tx = tx;
  S.ty = ty;
  S.et = et;
  S.ep = ep;
}

const WX = new Float32Array(96), WY = new Float32Array(96);

function splat(acc, x, y, sig, r, g, b, sigy = sig) {
  const R = min(40, ceil(2.4 * sig)), Ry = min(40, ceil(2.4 * sigy)), inv = 1 / (2 * sig * sig), invy = 1 / (2 * sigy * sigy);
  const ix = floor(x), iy = floor(y);
  const x0 = ix - R + 1, y0 = iy - Ry + 1, n = 2 * R, ny = 2 * Ry;
  for (let k = 0; k < n; k++) {
    const dx = x0 + k + 0.5 - x;
    WX[k] = exp(-dx * dx * inv);
  }
  for (let k = 0; k < ny; k++) {
    const dy = y0 + k + 0.5 - y;
    WY[k] = exp(-dy * dy * invy);
  }
  for (let yy = 0; yy < ny; yy++) {
    const py = y0 + yy;
    if (py < 0 || py >= H) continue;
    const wy = WY[yy];
    for (let xx = 0; xx < n; xx++) {
      const px = x0 + xx;
      if (px < 0 || px >= W) continue;
      const w = wy * WX[xx], i = (py * W + px) * 3;
      acc[i] += w * r;
      acc[i + 1] += w * g;
      acc[i + 2] += w * b;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.nc) return;
  const acc = S.acc, cc = S.cc;
  acc.fill(0);
  const tx = S.tx, ty = S.ty, et = S.et, ep = S.ep, half = S.half;
  const nrB = BEAD.xs, nyB = BEAD.ys;
  for (let j = 0; j < S.nc; j++) {
    const sig = cc.sig[j], cph = cc.cph[j], sph = cc.sph[j], Lc = cc.Lc[j], zc = cc.zc[j];
    const cr = cc.r[j], cg = cc.g[j], cbl = cc.b[j], tm = cc.tm[j];
    const ox = cc.x[j] - cc.cx0[j], oy = cc.y[j] - cc.cy0[j];
    for (let i = 0; i < NB; i++) {
      const px = nrB[i], py = nyB[i];
      const a = px * tx + py * ty, b = -px * ty + py * tx;
      // the ring turned by phi about the line the mirrors meet in: lengths
      // along the tilt shrink by cos phi, and the near side gets nearer
      const Xt = Lc + a * cph, Z = zc - a * sph;
      const fp = (D + half) / (D + Z);
      const st = (Xt - et) * fp + et, sp = (b - ep) * fp + ep;
      // the copy's centre moved by what the soft limit took off it
      const sx = st * tx - sp * ty + ox, sy = st * ty + sp * tx + oy;
      const lum = tm * (S.br[i] + S.bg[i] + S.bb[i]) * 0.333;
      const r = S.br[i] * cr + lum * TEAL[0], gg = S.bg[i] * cg + lum * TEAL[1], bl = S.bb[i] * cbl + lum * TEAL[2];
      if (r + gg + bl < 0.004) continue;
      if (sx < -4 || sx > W + 4 || sy < -4 || sy > H + 4) continue;
      splat(acc, sx, sy, sig, r, gg, bl);
    }
  }
  // Past the last copy the images are too many and too close to tell apart:
  // one soft glow where the corridor ends.
  const L = S.nc - 1, hz = S.haze;
  splat(acc, cc.x[L], cc.y[L], max(1.8, 0.8 * HW * cc.f[L]), HAZE * hz[0], HAZE * hz[1], HAZE * hz[2], max(3.5, 0.8 * HH * cc.f[L]));
  const out = S.bloom;
  // A little bloom: the glass scatters some of the light round each bead.
  blur(acc, out, S.tmp);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(
        x, y,
        TONE[min(TN, ((acc[i] + BLOOM * out[i]) * TS) | 0)],
        TONE[min(TN, ((acc[i + 1] + BLOOM * out[i + 1]) * TS) | 0)],
        TONE[min(TN, ((acc[i + 2] + BLOOM * out[i + 2]) * TS) | 0)],
      );
    }
}

// A 5-tap binomial blur each way, from a into b.
function blur(a, b, t) {
  const K = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) {
          const xx = x + k;
          if (xx >= 0 && xx < W) s += a[(y * W + xx) * 3 + c] * K[k + 2];
        }
        t[(y * W + x) * 3 + c] = s;
      }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) {
          const yy = y + k;
          if (yy >= 0 && yy < H) s += t[(yy * W + x) * 3 + c] * K[k + 2];
        }
        b[(y * W + x) * 3 + c] = s;
      }
}
