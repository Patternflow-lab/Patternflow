// ===== Patternflow pattern =====
// Title:   Fiber Lamp
// Family:  fiberoptic
// Idea:    A fibre-optic novelty lamp: about a hundred strands of side-glow fibre spring from one hub low at the bottom centre and arch up and out in a loose fan, each a smooth curve that glows faintly along its body and brightens toward a soft bead at its far tip, while a colour wheel behind the hub turns and washes the whole bunch through its segments, two neighbouring colours blending as one passes; the strands sway on slow travelling waves, bunch, part and cross, and the tips twinkle on their own.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the fibre-optic lamp (Joseph Kane's fibre-optic lamp, 1970s, as the novelty lamp sold from then on) with its rotating colour wheel, total internal reflection in a fibre (Daniel Colladon and Jacques Babinet, 1840s), and the cubic Bezier curve (Pierre Bezier, 1960s, and Paul de Casteljau, 1959); pattern round 209
// Round:   209
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sway=0..3, Spread=-1..1, Wheel=-1..1
//
// Knob 1: Hue. Turns every colour of the wheel round the hue circle together. At 0 the wheel is deep blue, magenta, amber, green, a pale white and cyan; at 0.5 each has moved half way round the circle; at 1 they are back where they began. The white segment stays white at every setting.
// Knob 2: Sway. How hard the breeze moves the strands. At 0 they hang still and only the tips twinkle and the colour wheel goes on turning. At the opening 2 the fan breathes by about 12 LEDs at the outer tips and strands bunch and part and cross, and at 3 the swing grows by half again.
// Knob 3: Spread. How wide and how tall the bunch fans. At -1 a narrow spray about 24 LEDs across stands tall, its strands leaving the hub within 20 degrees of the vertical. At the opening 0 the fan is 46 LEDs across and tips fill the panel up to its top rows. At 1 it reaches both side edges, 58 LEDs across, and the outer strands bend down to the sides.
// Knob 4: Wheel. How fast the colour wheel turns, from a very slow turn at -1, one segment in 66 seconds, through 7 seconds a segment at the opening 0.06, to nearly a segment a second at 1. The speed breathes round the set value on periods that do not divide.

const W = 64;
const H = 128;
const { sin, cos, sqrt, exp, floor, ceil, max, min, abs, pow, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const NS = 96; // strands
const HERO = 6; // every HERO-th strand is a bright one, drawn clear to the hub; the rest make the haze behind
const HX = 32; // the hub, low at the bottom centre
const HY = 130;
const DS = 0.5; // distance between samples along a strand, in LEDs
const NSEG = 6; // segments on the colour wheel
const B0 = 0.035; // how much light a strand carries at the hub, against 1 at its tip
const B1 = 0.07; // the share that grows with the square of the way along
const TAIL = 10; // LEDs: how far back from its tip a strand's own bright end reaches
const LINE_GAIN = 2.06 * 0.5; // makes a strand's centre a given brightness after the two-LED blur
const T0 = 53; // the waves have been running this long when the Lab starts
const HAZE = 0.05; // how bright a haze strand is against a bright one
const R_IN = 0.72; // the radius, against the dome's, inside which no strand ends
const DOME_P = 2.4; // the dome of tips is a rounded bell, wider than an ellipse
const PHI_MAX = 1.25; // the widest tip angle round the hub, radians (77 degrees)
const LAG = 0.4; // the colour at a tip is this many wheel segments behind the colour at the hub
const WHEEL0 = 0.45; // where the wheel stands at 0 s, between blue and magenta
const WHEEL_UNIT = 0.14; // wheel speed in segments a second at the opening 0

// ---- colour ----
// the wheel's segments in OKLab (L, a, b), from OKLCH
const SEG_LCH = [
  [0.5, 0.24, 264], // deep blue
  [0.66, 0.26, 337], // magenta
  [0.82, 0.17, 72], // amber
  [0.8, 0.25, 145], // green
  [0.98, 0.012, 90], // pale white
  [0.8, 0.12, 205], // cyan
];
const SEG = SEG_LCH.map(([L, C, h]) => [L, C * cos((h * PI) / 180), C * sin((h * PI) / 180)]);

// OKLab to linear sRGB, then scaled so the brightest channel is 1
function lab2rgb(L, a, b, out) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  r = max(r, 0);
  g = max(g, 0);
  bl = max(bl, 0);
  const k = 1 / max(r, g, bl, 1e-6);
  out[0] = r * k;
  out[1] = g * k;
  out[2] = bl * k;
}

// the colour the wheel shows at p segments round, hue-turned by rot (radians)
function wheel(p, rot, out) {
  p = p - NSEG * floor(p / NSEG);
  const k = floor(p);
  const w = sm(0.2, 0.8, p - k);
  const A = SEG[k];
  const B = SEG[(k + 1) % NSEG];
  const L = A[0] + (B[0] - A[0]) * w;
  const a = A[1] + (B[1] - A[1]) * w;
  const b = A[2] + (B[2] - A[2]) * w;
  const c = cos(rot);
  const s = sin(rot);
  lab2rgb(L, a * c - b * s, a * s + b * c, out);
}

// encode: linear light, soft knee above 0.6, then 1/2.2
const NLUT = 2048;
const ENC = new Uint8Array(NLUT + 1);
for (let i = 0; i <= NLUT; i++) {
  const x = (i / NLUT) * 2.5;
  const y = x < 0.6 ? x : 0.6 + 0.4 * (1 - exp(-(x - 0.6) / 0.4));
  ENC[i] = Math.round(255 * pow(y, 0.45));
}

export function setup(params) {
  const f = new Float32Array(NS); // where the strand stands across the fan, -1 to 1
  const pa = new Float32Array(NS); // its tip's angle round the hub, in the dome's own scale
  const pr = new Float32Array(NS); // and its tip's radius, 0 to 1
  const ph = new Float32Array(NS * 6); // phases
  const wi = new Float32Array(NS * 4); // its own sway and twinkle rates
  const col = new Float32Array(NS); // its place on the wheel, against its neighbours
  const rim = new Float32Array(NS * 2); // where it leaves the hub
  const arch = new Float32Array(NS); // how much it arches
  const gain = new Float32Array(NS); // how bright it is: 1 for the clear strands, HAZE for the rest
  // the strands are spread across the fan by angle, one after another, so that the ones
  // that cross a row side by side are as few and as far apart as the fan allows; the bright
  // ones are every HERO-th, the rest are the haze between them
  const J = Math.random();
  for (let i = 0; i < NS; i++) {
    const hero = i % HERO === (HERO >> 1);
    const j = floor(i / HERO);
    pa[i] = cl(((i + 0.5 + (Math.random() - 0.5) * 0.5) / NS) * 2 - 1, -1, 1) * PHI_MAX;
    f[i] = pa[i] / PHI_MAX;
    // how far the tip reaches into the dome: the bright ones by a lattice, so that near
    // neighbours differ, the haze at random
    const q = hero ? (j * 0.6180339887 + J) % 1 : Math.random();
    pr[i] = sqrt(R_IN * R_IN + (1 - R_IN * R_IN) * q);
    for (let k = 0; k < 6; k++) ph[i * 6 + k] = Math.random() * TAU;
    wi[i * 4] = 0.25 + 0.3 * Math.random();
    wi[i * 4 + 1] = 0.5 + 1.9 * Math.random();
    wi[i * 4 + 2] = 0.37 + 1.4 * Math.random();
    wi[i * 4 + 3] = 0.15 + 0.2 * Math.random();
    col[i] = (Math.random() - 0.5) * 0.1;
    arch[i] = 0.75 + 0.5 * Math.random();
    gain[i] = hero ? 1 : HAZE;
    const a = Math.random() * TAU;
    const r = 1.4 * sqrt(Math.random());
    rim[i * 2] = r * cos(a);
    rim[i * 2 + 1] = r * sin(a) * 0.6;
  }
  params.s = {
    t: T0,
    wp: WHEEL0,
    k0: false,
    hue: 0,
    sway: 1,
    spread: 0,
    speed: 0,
    f,
    pa,
    pr,
    ph,
    wi,
    col,
    rim,
    arch,
    gain,
    tipX: new Float32Array(NS * 2),
    tipC: new Float32Array(NS * 4),
    acc: new Float32Array(W * H * 3),
    tmp: new Float32Array(W * H * 3),
    px: new Float32Array(1024),
    py: new Float32Array(1024),
    cu: new Float32Array(1024),
    c0: [0, 0, 0],
    c1: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const d = cl(dt || 0, 0, 0.1);
  const kn = input.knobValues || [0, 2, 0, 0.06];
  const hue = cl(kn[0], 0, 1);
  const sway = cl(kn[1], 0, 3) / 2;
  const spread = cl(kn[2], -1, 1);
  const speed = cl(kn[3], -1, 1);
  if (!S.k0) {
    S.hue = hue;
    S.sway = sway;
    S.spread = spread;
    S.speed = speed;
    S.k0 = true;
  } else {
    // a turned knob is followed over a fraction of a second, so nothing jumps
    const g = 1 - exp(-d / 0.3);
    S.hue += (hue - S.hue) * g;
    S.sway += (sway - S.sway) * g;
    S.spread += (spread - S.spread) * g;
    S.speed += (speed - S.speed) * g;
  }
  S.t += d;
  const t = S.t;
  // the wheel turns at the set speed, breathing on periods that do not divide
  const breath = 1 + 0.28 * sin(0.0713 * t + 0.9) + 0.15 * sin(0.1931 * t + 2.4) + 0.07 * sin(0.4337 * t);
  S.wp += d * WHEEL_UNIT * pow(8, S.speed) * breath;
  if (S.wp > 1e4) S.wp -= NSEG * floor(S.wp / NSEG);
}

// a slow wave across the fan: three sines that travel at rates sharing no divisor
function wave(f, t, k, a1, a2, a3) {
  return (
    a1 * sin(2.3 * f + 0.231 * t + k) +
    a2 * sin(4.1 * f - 0.173 * t + 2.2 + k * 1.7) +
    a3 * sin(6.7 * f + 0.389 * t + 0.3 + k * 0.6)
  );
}

function splat(acc, cx, cy, sigma, r, g, b) {
  const rad = ceil(sigma * 3);
  const x0 = max(0, floor(cx - rad));
  const x1 = min(W - 1, floor(cx + rad));
  const y0 = max(0, floor(cy - rad));
  const y1 = min(H - 1, floor(cy + rad));
  const inv = 1 / (2 * sigma * sigma);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const w = exp(-(dx * dx + dy * dy) * inv);
      const i = (y * W + x) * 3;
      acc[i] += r * w;
      acc[i + 1] += g * w;
      acc[i + 2] += b * w;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const acc = S.acc;
  const tmp = S.tmp;
  const t = S.t;
  const sw = S.sway;
  const sp = S.spread; // -1 to 1
  const rot = S.hue * TAU;
  const c0 = S.c0;
  const c1 = S.c1;
  const px = S.px;
  const py = S.py;
  const cu = S.cu;
  acc.fill(0);

  // the fan's shape from Spread: how wide and how tall the dome of tips is, and how far from
  // the vertical the strands leave the hub
  const k = 0.5 * (sp + 1); // 0 to 1
  const domeX = 15 + 15 * k; // half width of the dome of tips, in LEDs
  const domeY = 124 - 24 * k; // half height
  const launch = 0.88; // how much of its tip's angle a strand leaves the hub with

  for (let i = 0; i < NS; i++) {
    const f = S.f[i];
    const own = S.wi[i * 4];
    const o1 = S.ph[i * 6];
    const o2 = S.ph[i * 6 + 1];
    const o3 = S.ph[i * 6 + 2];
    // the tip: an angle and a radius round the hub, swung by waves across the fan
    const phi = S.pa[i] + wave(f, t, 0.4, 0.07, 0.05, 0.035) * sw + 0.03 * sw * sin(own * t + o1);
    const rn = S.pr[i] * (1 + 0.06 * sw * sin(S.wi[i * 4 + 3] * t + o2) + 0.04 * sw * sin(0.173 * t + 3 * f));
    const sph = sin(phi);
    const cph = cos(phi);
    const rb = pow(pow(abs(sph), DOME_P) + pow(abs(cph), DOME_P), -1 / DOME_P);
    const Tx = HX + domeX * rn * rb * sph;
    const Ty = HY - domeY * rn * rb * cph;
    const chord = atan2(Tx - HX, HY - Ty); // the angle of the straight line from the hub to the tip
    const rho = sqrt((Tx - HX) * (Tx - HX) + (Ty - HY) * (Ty - HY));
    // the launch direction at the hub, and the direction it arrives at its tip: an arch,
    // leaving steeper than the chord and arriving bent outward past it
    const th0 = chord * launch * S.arch[i] + wave(f, t, 1.9, 0.1, 0.07, 0.05) * sw + 0.02 * sw * sin(own * 1.3 * t + o3);
    const thT = chord * (1 + 0.35 * S.arch[i]) + wave(f, t, 3.1, 0.12, 0.08, 0.06) * sw * 0.8;
    const l1 = 0.5 * rho;
    const l2 = 0.4 * rho;
    const P0x = HX + S.rim[i * 2];
    const P0y = HY + S.rim[i * 2 + 1];
    // sideways swing of the two inner control points, on waves that run along the strand
    const sc = rho / 100;
    const n1 = wave(f, t, 0.8, 2.4, 1.6, 1.1) * sw * sc;
    const n2 = wave(f, t, 2.6, 5.5, 3.6, 2.4) * sw * sc;
    const P1x = P0x + l1 * sin(th0) + cos(th0) * n1;
    const P1y = P0y - l1 * cos(th0) + sin(th0) * n1;
    const P2x = Tx - l2 * sin(thT) + cos(thT) * n2;
    const P2y = Ty + l2 * cos(thT) + sin(thT) * n2;

    // sample the cubic densely
    const est = 0.5 * (abs(P1x - P0x) + abs(P1y - P0y) + abs(P2x - P1x) + abs(P2y - P1y) + abs(Tx - P2x) + abs(Ty - P2y)) + 0.5 * sqrt((Tx - P0x) * (Tx - P0x) + (Ty - P0y) * (Ty - P0y));
    const M = min(1000, max(8, ceil(est / DS)));
    let len = 0;
    for (let m = 0; m <= M; m++) {
      const u = m / M;
      const v = 1 - u;
      const b0 = v * v * v;
      const b1 = 3 * v * v * u;
      const b2 = 3 * v * u * u;
      const b3 = u * u * u;
      const x = b0 * P0x + b1 * P1x + b2 * P2x + b3 * Tx;
      const y = b0 * P0y + b1 * P1y + b2 * P2y + b3 * Ty;
      px[m] = x;
      py[m] = y;
      if (m > 0) len += sqrt((x - px[m - 1]) * (x - px[m - 1]) + (y - py[m - 1]) * (y - py[m - 1]));
      cu[m] = len;
    }
    // colour: this strand's place on the wheel, the hub end ahead of the tip end
    const wp = S.wp + S.col[i] + 0.45 * f;
    wheel(wp, rot, c0);
    wheel(wp - LAG, rot, c1);
    // how bright this strand is: the tips twinkle on their own
    const w1 = S.wi[i * 4 + 1];
    const w2 = S.wi[i * 4 + 2];
    const tw1 = 0.78 + 0.16 * sin(w1 * t + S.ph[i * 6 + 3]) + 0.1 * sin(w2 * t + S.ph[i * 6 + 4]);
    const tip = tw1;
    const gn = S.gain[i];
    // light along the strand
    const invLen = 1 / max(len, 1e-3);
    for (let m = 0; m < M; m++) {
      const u = (cu[m] + 0.5 * (cu[m + 1] - cu[m])) * invLen;
      const ds = cu[m + 1] - cu[m];
      const x = 0.5 * (px[m] + px[m + 1]);
      const y = 0.5 * (py[m] + py[m + 1]);
      if (x < -1 || x > W || y < -1 || y > H) continue;
      const u2 = u * u;
      const shape = (B0 + B1 * u2) * sm(0.04, 0.34, u) + exp(-((1 - u) * len) / TAIL);
      const val = LINE_GAIN * gn * shape * tip * ds;
      const cm = sm(0, 1, u);
      const r = (c0[0] + (c1[0] - c0[0]) * cm) * val;
      const g = (c0[1] + (c1[1] - c0[1]) * cm) * val;
      const b = (c0[2] + (c1[2] - c0[2]) * cm) * val;
      // bilinear splat on pixel centres
      const fx = x - 0.5;
      const fy = y - 0.5;
      const ix = floor(fx);
      const iy = floor(fy);
      const ax = fx - ix;
      const ay = fy - iy;
      for (let q = 0; q < 4; q++) {
        const xx = ix + (q & 1);
        const yy = iy + (q >> 1);
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const wgt = ((q & 1) ? ax : 1 - ax) * ((q >> 1) ? ay : 1 - ay);
        const o = (yy * W + xx) * 3;
        acc[o] += r * wgt;
        acc[o + 1] += g * wgt;
        acc[o + 2] += b * wgt;
      }
    }
        S.tipX[i * 2] = Tx;
    S.tipX[i * 2 + 1] = Ty;
        S.tipC[i * 4] = c1[0];
    S.tipC[i * 4 + 1] = c1[1];
    S.tipC[i * 4 + 2] = c1[2];
    S.tipC[i * 4 + 3] = tip * (0.25 + 0.75 * gn);
  }

  // blur the strands by [1 2 1] along each axis: a line of samples becomes two LEDs wide
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const l = x > 0 ? o - 3 : o;
      const r = x < W - 1 ? o + 3 : o;
      tmp[o] = 0.25 * acc[l] + 0.5 * acc[o] + 0.25 * acc[r];
      tmp[o + 1] = 0.25 * acc[l + 1] + 0.5 * acc[o + 1] + 0.25 * acc[r + 1];
      tmp[o + 2] = 0.25 * acc[l + 2] + 0.5 * acc[o + 2] + 0.25 * acc[r + 2];
    }
  }
  for (let y = 0; y < H; y++) {
    const ya = y > 0 ? -W * 3 : 0;
    const yb = y < H - 1 ? W * 3 : 0;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      acc[o] = 0.25 * tmp[o + ya] + 0.5 * tmp[o] + 0.25 * tmp[o + yb];
      acc[o + 1] = 0.25 * tmp[o + ya + 1] + 0.5 * tmp[o + 1] + 0.25 * tmp[o + yb + 1];
      acc[o + 2] = 0.25 * tmp[o + ya + 2] + 0.5 * tmp[o + 2] + 0.25 * tmp[o + yb + 2];
    }
  }

  // the tips: a soft bead each, paler at its core, with a thin halo
  for (let i = 0; i < NS; i++) {
    const tx = S.tipX[i * 2];
    const ty = S.tipX[i * 2 + 1];
    const tp = S.tipC[i * 4 + 3];
    const r = S.tipC[i * 4];
    const g = S.tipC[i * 4 + 1];
    const b = S.tipC[i * 4 + 2];
    splat(acc, tx, ty, 2.0, 0.1 * r * tp, 0.1 * g * tp, 0.1 * b * tp);
    const wc = 0.4;
    splat(acc, tx, ty, 0.95, (r + (1 - r) * wc) * tp * 0.9, (g + (1 - g) * wc) * tp * 0.9, (b + (1 - b) * wc) * tp * 0.9);
  }

  // the hub: a soft glow in the wheel's colour
  wheel(S.wp, rot, c0);
  splat(acc, HX, HY, 5, 0.14 * c0[0], 0.14 * c0[1], 0.14 * c0[2]);
  splat(acc, HX, HY, 2.2, 0.3 * c0[0], 0.3 * c0[1], 0.3 * c0[2]);

  // out
  const sc = NLUT / 2.5;
  let i = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = ENC[min(NLUT, (acc[i] * sc) | 0)];
      const g = ENC[min(NLUT, (acc[i + 1] * sc) | 0)];
      const b = ENC[min(NLUT, (acc[i + 2] * sc) | 0)];
      display.setPixel(x, y, r, g, b);
      i += 3;
    }
  }
}
