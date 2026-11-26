// ===== Patternflow pattern =====
// Title:   Wake Rows
// Family:  windfarm
// Idea:    A staggered grid of turbines stands in sunrise fog over a navy sea, each one trailing a fan of pale peach wake that widens and fades downwind and snakes from side to side, while the wind veers slowly and every fan swings round together across the turbines behind it.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the wake behind a wind turbine, a slow stretch of air that grows wider and weaker with the distance (Niels Otto Jensen, 1983, from memory), as a Gaussian profile whose width grows in proportion to the distance downwind (Majid Bastankhah and Fernando Porté-Agel, 2014, from memory), wakes that meet adding as the root of the sum of their squares (Ioannis Katic, Jakob Højstrup and Jensen, 1986, from memory), the whole wake swung from side to side by the large eddies of the wind (Gunner Larsen and co-workers, 2008, from memory), and the fog that condensed in the wakes of the Horns Rev offshore farm on a cold morning of 2008 and drew a white fan behind every row (Charlotte Hasager and co-workers, 2013, from memory). Original code, pattern round 263: every wake is a closed formula evaluated per LED, with no state to step.
// Round:   263
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Calm=0..4, Heading=-1..1, Meander=-1..1
//
// Knob 1: Hue. Four looks one after the other, at 0, 0.25, 0.5 and 0.75, and the last runs back into the first, so 0 and 1 are the same. At 0 it is the sunrise: fog from mauve (64, 54, 122) through rose (214, 120, 138) and peach (250, 162, 146) to milk white (255, 242, 230), over a sea of navy (10, 22, 78) to blue (30, 56, 118) with a rose glint at the upper left. At 0.25 the fog is pink and lilac over a teal sea, at 0.5 amber and gold over indigo, at 0.75 pale mint over a deep green-blue. Every look keeps the wake the lightest thing on the panel, so it reads over the fog banks.
// Knob 2: Calm. How steady the air is, 0 to 4, opening at 2. It sets how fast a wake widens (0.13 LED of half width for each LED downwind at 0, 0.081 at the opening, 0.045 at 4), how far it carries (55, 80 and 105 LED) and how strongly it condenses (1.0, 1.2 and 1.4 times). Forty LED behind a turbine the sigma of the wake is 6.6, 4.6 and 3.2 LED. At 0 the wakes are short, broad and faint; at 4 they are thin, long and bright, and a wake that meets the next turbine in its row carries on past it. The air's own stability also wanders by up to 0.3 of the range over periods of 97 and 38 s, so the wakes lengthen and shorten by themselves.
// Knob 3: Heading. Which way the wind blows, -1 to 1, opening at 0. The knob turns the whole wind by up to 0.95 radian (54 degrees) either way, on top of the veer the wind makes by itself. At 0 the mean wind is down the panel, at -1 toward the lower left and at 1 toward the lower right, where the wakes come level with the rows and run across the panel. The veer itself is four sines of 113, 52, 23 and 257 s that never line up again, at most 54 degrees off down the panel, about 22 degrees rms, 1.6 degrees a second on average and 4.9 at the fastest. It opens 33 degrees off.
// Knob 4: Meander. How far the wakes snake from side to side, -1 to 1, opening at 0.06. The centre line of each wake is moved by two waves that run downwind, 46 and 27 LED long at 3.4 and 4.6 LED a second, and grow in with the distance, half way at 14 LED. The swing is 0.3 LED at -1, 1.8 at the opening and 5.5 at 1, where the wakes wriggle like ribbons and cross each other. The waves share their phase across the farm (it changes by 0.045 and 0.03 radian for each LED across and down), so neighbours sway together.

// What the picture is. The panel is the sea seen from straight above at sunrise, with a bank of fog on it. The turbines stand on a lattice of rows 23 LED apart across and 29 apart down, every other row
// half a step over, each moved by up to 1.2 LED, and the lattice goes on for 110 LED outside the panel so that a wake can come in from off the edge. 12 are in view and 144 on the lattice. A turbine is a soft dot 3 LED across. Each has a thrust of its own, 0.78 to 1.12, that swells and shrinks by 0.58 to 1.1 over 26 to 80 s, and a quarter of them
// stop for about 40 percent of the time on cycles of 45 to 135 s, the dot dims and their wake goes out.
// Each turbine lays a wake along the wind: s is the distance downwind from it, n the distance across, and the deficit is A0 (sigma0 / sigma) exp(-(n - m)^2 / (2 sigma^2)) with sigma = 1.35 + k s, so the wake is
// a Gaussian across whose width grows in proportion to s and whose height falls as one over that width. m(s, t) is the meander, and the end of the wake (55 to 105 LED) is faded over its last 40 percent.
// Where wakes meet the deficits are added as the root of the sum of squares, which is the one number q a pixel needs however many wakes cross it. Turbines are drawn and their wakes summed
// into one array of 8192 numbers every frame, a box of pixels round each wake, so a farm of any size costs a few thousand pixels per turbine. The wind is rotated, not the lattice, so every fan swings together.
// The wake is fog, not a dark lane: the condensation is 1 - exp(-(q / 0.5)^2.2), which is near nothing where one weak wake thins out and full where two or three cross, and it is mottled by a noise of 6 LED
// that the wind carries, by 0.45 of itself in a single wake and by 0.8 in the deep overlaps, so a place where many wakes pile up looks churned and not smooth. Over the sea there is also a drifting bank of
// ambient fog, two octaves of noise at 33 and 14 LED that move with the wind at 3 LED a second and slide slowly on top of that, thicker toward the upper left where the sun is. It is a mauve veil and the wakes
// are lighter, so a wake over a bank is still a lane. Fog density D (the bank and the wake combined as 1 - (1 - bank)(1 - wake)) sets how much of the sea is hidden, and the tone of the fog is read from a
// ramp by the wake part, the bank part and the slope of D toward the sun, which lights the lanes from one side.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, exp, sin, cos, min, max, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function hash(i, j, s) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const ix = floor(x), iy = floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// ---- the farm
const SX = 23, SY = 29;      // LEDs between turbines in a row, and between rows
const MARG = 110;            // turbines this far outside the panel still lay wakes on it
const SIG0 = 1.35;           // half width of a wake at the turbine, LED

// ---- looks
const LOOKS = [
  { // sunrise: peach and apricot fog over a navy sea
    sea: [[10, 22, 78], [30, 56, 118]],
    fog: [[64, 54, 122], [136, 80, 130], [214, 120, 138], [250, 162, 146], [255, 208, 178], [255, 242, 230]],
    dot: [255, 252, 244], glow: [120, 56, 70],
  },
  { // pink and lilac fog over a teal sea
    sea: [[6, 46, 74], [22, 86, 112]],
    fog: [[40, 70, 120], [110, 84, 150], [196, 116, 168], [244, 160, 190], [255, 208, 220], [255, 244, 246]],
    dot: [255, 250, 250], glow: [90, 60, 110],
  },
  { // amber and gold fog over an indigo sea
    sea: [[26, 22, 92], [56, 42, 128]],
    fog: [[60, 40, 110], [130, 64, 100], [210, 106, 76], [244, 160, 84], [255, 212, 124], [255, 246, 204]],
    dot: [255, 252, 236], glow: [120, 60, 50],
  },
  { // pale mint fog over a deep green-blue sea
    sea: [[6, 40, 62], [18, 78, 96]],
    fog: [[24, 70, 100], [60, 116, 134], [116, 170, 168], [176, 214, 196], [220, 242, 220], [246, 255, 240]],
    dot: [250, 255, 248], glow: [40, 90, 80],
  },
];

const FOG_T = [0, 0.2, 0.4, 0.6, 0.8, 1];

function ramp6(C, v, out) {
  let k = 0;
  while (k < 4 && v > FOG_T[k + 1]) k++;
  const t = cl((v - FOG_T[k]) / (FOG_T[k + 1] - FOG_T[k]), 0, 1), s = t * t * (3 - 2 * t);
  for (let c = 0; c < 3; c++) out[c] = mix(C[k][c], C[k + 1][c], s);
}

function buildPalette(S, u1) {
  const p = u1 * LOOKS.length, i0 = floor(p) % LOOKS.length, i1 = (i0 + 1) % LOOKS.length;
  const f0 = p - floor(p), f = f0 * f0 * (3 - 2 * f0);
  const A = LOOKS[i0], B = LOOKS[i1];
  const mc = (a, b) => [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];
  const fog = A.fog.map((c, i) => mc(c, B.fog[i]));
  S.seaA = mc(A.sea[0], B.sea[0]);
  S.seaB = mc(A.sea[1], B.sea[1]);
  S.dot = mc(A.dot, B.dot);
  S.glow = mc(A.glow, B.glow);
  const tmp = [0, 0, 0];
  for (let i = 0; i < 256; i++) {
    ramp6(fog, i / 255, tmp);
    S.lut[i * 3] = tmp[0]; S.lut[i * 3 + 1] = tmp[1]; S.lut[i * 3 + 2] = tmp[2];
  }
}

function makeState() {
  const S = {
    t: 0, ready: false, adv: 0, ax: 0, ay: 0, theta: 0, pal: -1,
    calm: 0.5, head: 0, mea: 0.53,
    Q: new Float32Array(NPX), D: new Float32Array(NPX), TB: new Float32Array(NPX), GW: new Float32Array(NPX), AA: new Float32Array(NPX),
    lut: new Float32Array(3 * 256), seaA: [10, 22, 78], seaB: [30, 56, 118], dot: [255, 252, 240], glow: [120, 56, 70],
    tur: [],
  };
  for (let j = -7; j <= 14; j++) {
    for (let i = -8; i <= 12; i++) {
      const x = (i + 0.5 * (j & 1)) * SX + 4 + (hash(i, j, 1) - 0.5) * 2.4;
      const y = (j + 0.5) * SY + (hash(i, j, 2) - 0.5) * 2.4;
      if (x < -MARG || x > W + MARG || y < -MARG || y > H + MARG) continue;
      S.tur.push({
        x, y, ph: hash(i, j, 3) * TAU, ph2: hash(i, j, 4) * TAU,
        om: TAU / (45 + 90 * hash(i, j, 5)), idle: hash(i, j, 6) < 0.25, st: hash(i, j, 7) * TAU,
        amp: 0.78 + 0.34 * hash(i, j, 8),
      });
    }
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

function readKnobs(S, kn) {
  const u1 = cl(kn[0], 0, 1);
  S.calm = cl(kn[1], 0, 4) / 4;
  S.head = cl(kn[2], -1, 1) * 0.95;
  S.mea = (cl(kn[3], -1, 1) + 1) / 2;
  if (abs(u1 - S.pal) > 0.0005) { S.pal = u1; buildPalette(S, u1); }
}

// the wind's heading, radians off straight down the panel: a few slow swings that do not share a period
function windAt(t) {
  return 0.85 * (0.5 * sin(TAU * t / 113 + 0.7) + 0.3 * sin(TAU * t / 51.7 + 2.1) + 0.12 * sin(TAU * t / 23.3 + 4.0) + 0.2 * sin(TAU * t / 257 + 1.3));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  readKnobs(S, input.knobValues || [0, 2, 0, 0.06]);
  S.t += d;
  S.theta = windAt(S.t) + S.head;
  const U = 3.4;
  S.adv += U * d;
  S.ax += sin(S.theta) * 3 * d;
  S.ay += cos(S.theta) * 3 * d;
}

export function draw(display, params) {
  if (!params.s) setup(params);
  const S = params.s;
  if (!S.ready) { S.ready = true; update(0, { knobValues: [0, 2, 0, 0.06] }, params); }
  const t = S.t, th = S.theta;
  const wx = sin(th), wy = cos(th), px = wy, py = -wx; // downwind, and across it
  // the air's stability drifts over minutes too, so the wakes lengthen and shorten
  const calm = cl(S.calm + 0.18 * sin(TAU * t / 97 + 1.1) + 0.12 * sin(TAU * t / 37.9 + 0.4), 0, 1), mea = S.mea;
  const kg = mix(0.13, 0.045, Math.pow(calm, 0.8)); // how fast a wake widens
  const A0 = 1.0 + 0.4 * calm;
  const LW = mix(55, 105, calm);
  const M = 0.3 + 5.2 * Math.pow(mea, 2.0);
  const Q = S.Q, Dd = S.D, TB = S.TB, Gw = S.GW, Aa = S.AA;
  Q.fill(0);
  TB.fill(0);
  const tur = S.tur;
  for (let ti = 0; ti < tur.length; ti++) {
    const T = tur[ti];
    // thrust: most turbines run, some idle for a while
    let thr = T.amp * (0.84 + 0.26 * sin(T.om * 1.7 * t + T.ph));
    if (T.idle) thr *= 1 - sm(-0.1, 0.3, sin(T.om * t + T.st));
    // the turbine itself, a soft dot 3 LED across
    if (T.x > -3 && T.x < W + 3 && T.y > -3 && T.y < H + 3) {
      const bx = floor(T.x), by = floor(T.y);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = bx + dx, y = by + dy;
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const ddx = x + 0.5 - T.x, ddy = y + 0.5 - T.y;
          const v = exp(-(ddx * ddx + ddy * ddy) / 1.9) * (0.55 + 0.45 * min(1, thr));
          if (v > TB[y * W + x]) TB[y * W + x] = v;
        }
      }
    }
    if (thr < 0.02) continue;
    const sigL = SIG0 + kg * LW, hw = 3 * sigL + M + 2;
    const ex = T.x + wx * LW, ey = T.y + wy * LW;
    const x0 = max(0, floor(min(T.x - hw, ex - hw))), x1 = min(W - 1, floor(max(T.x + hw, ex + hw)));
    const y0 = max(0, floor(min(T.y - hw, ey - hw))), y1 = min(H - 1, floor(max(T.y + hw, ey + hw)));
    if (x0 > x1 || y0 > y1) continue;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - T.y;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - T.x;
        const s = dx * wx + dy * wy;
        if (s < -1 || s > LW) continue;
        const n = dx * px + dy * py;
        const sig = SIG0 + kg * s;
        const lim = 3 * sig + M;
        if (n > lim || n < -lim) continue;
        const g = s / (s + 14);
        const arg = (s - S.adv) * (TAU / 46) + T.ph + 0.045 * T.x + 0.03 * T.y;
        const arg2 = (s - 1.35 * S.adv) * (TAU / 27) + T.ph2;
        const m = M * g * (0.62 * sin(arg) + 0.38 * sin(arg2));
        const dn = (n - m) / sig;
        const amp = A0 * (SIG0 / sig) * sm(-1, 4, s) * thr * (1 - sm(0.6, 1, s / LW));
        const dl = amp * exp(-0.5 * dn * dn);
        Q[y * W + x] += dl * dl;
      }
    }
  }
  // fog and sea
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const X = x + 0.5 - S.ax, Y = y + 0.5 - S.ay;
      const fa = 0.6 * vnoise(X * 0.03 + t * 0.03, Y * 0.03, 11) + 0.4 * vnoise(X * 0.07, Y * 0.07 - t * 0.04, 12);
      const a = (0.2 + 0.4 * sm(0.3, 0.85, 1 - (x / 64) * 0.5 - (y / 128) * 0.5)) * sm(0.26, 0.76, fa);
      const q = sqrt(Q[p]);
      let gw = 1 - exp(-Math.pow(q / 0.5, 2.2));
      const bil = vnoise((x + 0.5 - S.ax * 1.6) * 0.16, (y + 0.5 - S.ay * 1.6) * 0.16, 21) - 0.5;
      gw *= 1 + (0.9 * sm(0.05, 0.5, q) + 0.7 * sm(0.55, 1.3, q)) * bil;
      gw = cl(gw, 0, 1);
      Gw[p] = gw; Aa[p] = a;
      Dd[p] = 1 - (1 - a) * (1 - gw);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const D = Dd[p];
      const xa = min(W - 1, x + 2), xb = max(0, x - 2), ya = min(H - 1, y + 2), yb = max(0, y - 2);
      const sh = (Dd[y * W + xb] - Dd[y * W + xa]) * 0.6 + (Dd[yb * W + x] - Dd[ya * W + x]) * 0.3;
      const al = sm(0.12, 0.6, D);
      const tone = cl(0.05 + 0.9 * Gw[p] + 0.75 * Aa[p] + 0.5 * sh, 0, 1);
      const li = floor(tone * 255) * 3;
      const sw = vnoise(x * 0.05 + 3, y * 0.04 + t * 0.003, 31);
      const gl = exp(-((x - 10) * (x - 10) * 0.5 + (y - 20) * (y - 20) * 0.12) / 900) * 0.5 * sw;
      const sr = mix(S.seaA[0], S.seaB[0], sw) + S.glow[0] * gl, sg = mix(S.seaA[1], S.seaB[1], sw) + S.glow[1] * gl, sb = mix(S.seaA[2], S.seaB[2], sw) + S.glow[2] * gl;
      let r = sr * (1 - al) + S.lut[li] * al;
      let g = sg * (1 - al) + S.lut[li + 1] * al;
      let b = sb * (1 - al) + S.lut[li + 2] * al;
      const v = TB[p];
      if (v > 0) {
        r += (S.dot[0] - r) * v; g += (S.dot[1] - g) * v; b += (S.dot[2] - b) * v;
      }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(g, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
}
