// ===== Patternflow pattern =====
// Title:   Aerial Shells
// Family:  fireworks
// Idea:    A near-black night sky over a faint warm haze where smoke hangs, and shells climb from the bottom edge on glittering comet tails and burst at their apogee into round shells of stars (peonies, tailed chrysanthemums, gold willows that hang for seconds, palms, tilted rings, crossettes that split in four, crackling gold brocade) whose stars burn for a fixed time, slow in the air, fall, change colour part way through the burn and leave fading tails, each burst flashing the sky and lighting the smoke, shells overlapping at different heights and sizes and now and then a short finale, in no fixed order.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the aerial shell of pyrotechnics (burst charge, stars and lift charge, as Takeo Shimizu set them out in Fireworks: The Art, Science and Technique, 1981), stars with a burn time under air drag and gravity, the strontium red and barium green colour-change star, and the shell types of the trade (peony, chrysanthemum, willow, palm, ring, crossette, brocade); pattern round 209
// Round:   209
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.3..3, Size=-1..1, Drift=-1..1
//
// Knob 1: Hue. Turns the palette of the shells once round the wheel. At 0 the willows and the brocade are gold and the colour shells are crimson, emerald, azure and violet; at 0.5 the gold has become a blue-white and the crimson a cyan. A colour-change star always changes between two palette colours.
// Knob 2: Pace. How often a shell goes up. At 0.3 about one in six seconds, so the sky is often down to one display and its haze; at the opening 2 about one a second, three or four displays alive at once; at 3 one in half a second, a rapid volley. The gaps are never even, and a short finale of four to eight shells fires now and then whatever the pace.
// Knob 3: Size. The size of a shell and its count of stars. At -1 a shell opens about 11 LEDs in radius with 45% of the usual stars; at the opening 0 about 20 LEDs, and bursts run from 11 to 30 by type and by chance; at 1 about 27 LEDs, a big shell that spans most of the panel's width, with 30% more stars.
// Knob 4: Drift. A wind blowing the air the stars fly in. At 0 the sky is nearly still; at 1 the wind is 7 LEDs a second to the right, willow tails bend into long diagonals, shells sail sideways as they burn and the smoke slides toward the right edge; at -1 it blows left.

const W = 64;
const H = 128;
const N = W * H;
const { sin, cos, sqrt, exp, floor, ceil, max, min, abs, PI, log } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const NS = 3600; // most stars alive at once
const WARM = 16; // seconds the sky has been firing when the Lab starts
const HUE0 = 0.22; // oklch turns: the gold the palette opens on
const TAILS = [0.075, 0.38, 0.8]; // seconds a trail takes to fade: crisp, tailed, hanging
const CELL = 4; // LEDs per node of the smoke and light grids
const GW = W / CELL + 1;
const GH = H / CELL + 1;
const GLOWK = 0.0007; // light a star lends the air in a frame, at full brightness
const TW = W / 2 + 2; // the smoke's lumps, on a grid of 2 LEDs
const TH = H / 2 + 2;
const UMAX = 7; // LEDs a second of wind at Drift 1

// ---- two private random streams, so a knob that changes nothing about the
// plan of the show changes nothing about which shell goes where ----
function stream(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- colour ----
// OKLCH to linear sRGB, lifted toward white where the hue is dark (blue), then scaled so
// the brightest channel is 1.
function tint(hueTurns, L, C, out, o) {
  const h = (hueTurns - floor(hueTurns)) * TAU;
  const a = C * cos(h);
  const b = C * sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  let r = max(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, 0);
  let g = max(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, 0);
  let bl = max(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s, 0);
  let k = 1 / max(r, g, bl, 1e-6);
  r *= k;
  g *= k;
  bl *= k;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  const w = 0.34 * Math.pow(cl((0.28 - y) / 0.28, 0, 1), 1.1);
  r = r * (1 - w) + w;
  g = g * (1 - w) + w;
  bl = bl * (1 - w) + w;
  k = 1 / max(r, g, bl, 1e-6);
  out[o] = r * k;
  out[o + 1] = g * k;
  out[o + 2] = bl * k;
}

// encode: linear light, a soft knee above 0.6, then 1/2.2
const NLUT = 8192;
const ENC = new Uint8Array(NLUT + 1);
for (let i = 0; i <= NLUT; i++) {
  const x = (i / NLUT) * 2.5;
  const y = x < 0.6 ? x : 0.6 + 0.4 * (1 - exp(-(x - 0.6) / 0.4));
  ENC[i] = Math.round(255 * Math.pow(y, 0.45));
}

// ---- stars ----
// Float fields of one star, then the small integer ones. All are swapped together when a
// star dies, so the live ones stay packed at the front.
const FN = 21;
const X = 0, Y = 1, VX = 2, VY = 3, PX = 4, PY = 5, AGE = 6, BURN = 7, K = 8, G = 9, PEAK = 10, RAD = 11, DZ = 12;
const CA = 13, CB = 16, TC = 19, ST = 20;
const UN = 5;
const CLS = 0, FLICK = 1, EMBER = 2, SPL = 3, PHI = 4; // PHI: a flicker phase, 0 to 255

function setupState() {
  const f = [];
  for (let i = 0; i < FN; i++) f.push(new Float32Array(NS));
  const u = [];
  for (let i = 0; i < UN; i++) u.push(new Uint8Array(NS));
  const seed = floor(Math.random() * 4294967296);
  return {
    f,
    u,
    n: 0,
    rise: [],
    flash: [],
    recent: [],
    pal: new Float32Array(15),
    gold: new Float32Array(3),
    k1: 0,
    hueDone: -1,
    // light: three decaying layers of coloured stars, max-blended inside a layer
    B: [new Float32Array(N * 3), new Float32Array(N * 3), new Float32Array(N * 3)],
    smoke: new Float32Array(GW * GH),
    smoke2: new Float32Array(GW * GH),
    glow: new Float32Array(GW * GH * 3), // the light stars lend the air, a second or two
    flare: new Float32Array(GW * GH * 3), // the flash of a burst, a fifth of a second
    col: new Float32Array(3),
    pace: 2,
    size: 0,
    drift: 0.06,
    wind: 0,
    gust: 0,
    t: 0,
    next: 0.4,
    cool: 20,
    queue: [],
    lastType: -1,
    lastCol: -1,
    boost: false,
    rd: stream(seed ^ 0x9e3779b9),
    rs: stream(seed ^ 0x85ebca6b),
    started: false,
    wx: 0,
    wy: 0,
    tex: new Float32Array(TW * TH),
    px: new Float32Array(W),
    out: new Float32Array(3),
  };
}

export function setup(params) {
  params.s = setupState();
}

function palette(S, k1) {
  const h0 = HUE0 + k1;
  const P = S.pal;
  const off = [0, -0.13, 0.2, 0.4, 0.68];
  const ch = [0.14, 0.19, 0.17, 0.15, 0.18];
  for (let i = 0; i < 5; i++) tint(h0 + off[i], 0.8, ch[i], P, i * 3);
  tint(h0, 0.86, 0.13, S.gold, 0);
}

// ---- drawing a soft dot into a layer, the brighter dot keeping the LED ----
function splat(buf, x, y, r, g, b, rad) {
  const x0 = floor(x - rad);
  const x1 = floor(x + rad);
  const y0 = floor(y - rad);
  const y1 = floor(y + rad);
  const ir = 1 / (rad * rad);
  const sum = r + g + b;
  for (let yy = y0; yy <= y1; yy++) {
    if (yy < 0 || yy >= H) continue;
    const dy = yy + 0.5 - y;
    const dy2 = dy * dy;
    for (let xx = x0; xx <= x1; xx++) {
      if (xx < 0 || xx >= W) continue;
      const dx = xx + 0.5 - x;
      const w = 1 - (dx * dx + dy2) * ir;
      if (w <= 0) continue;
      const i = (yy * W + xx) * 3;
      if (sum * w > buf[i] + buf[i + 1] + buf[i + 2]) {
        buf[i] = r * w;
        buf[i + 1] = g * w;
        buf[i + 2] = b * w;
      }
    }
  }
}

// a dot dragged from where it was to where it is, so a fast star leaves a line
function seg(buf, x0, y0, x1, y1, r, g, b, rad) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = sqrt(dx * dx + dy * dy);
  const m = len > 0.7 ? ceil(len / 0.7) : 1;
  for (let j = 1; j <= m; j++) splat(buf, x0 + (dx * j) / m, y0 + (dy * j) / m, r, g, b, rad);
}

// light lent to the air at an LED position, spread over the four nodes round it
function lend(arr, x, y, r, g, b) {
  const u = x / CELL;
  const v = y / CELL;
  const i0 = floor(u);
  const j0 = floor(v);
  if (i0 < 0 || j0 < 0 || i0 >= GW - 1 || j0 >= GH - 1) return;
  const fx = u - i0;
  const fy = v - j0;
  const w0 = (1 - fx) * (1 - fy);
  const w1 = fx * (1 - fy);
  const w2 = (1 - fx) * fy;
  const w3 = fx * fy;
  let o = (j0 * GW + i0) * 3;
  arr[o] += r * w0;
  arr[o + 1] += g * w0;
  arr[o + 2] += b * w0;
  o += 3;
  arr[o] += r * w1;
  arr[o + 1] += g * w1;
  arr[o + 2] += b * w1;
  o += GW * 3 - 3;
  arr[o] += r * w2;
  arr[o + 1] += g * w2;
  arr[o + 2] += b * w2;
  o += 3;
  arr[o] += r * w3;
  arr[o + 1] += g * w3;
  arr[o + 2] += b * w3;
}

// a Gaussian blob onto the grid of nodes
function blob(arr, ch, x, y, sig, amp, r, g, b) {
  const inv = 1 / (2 * sig * sig);
  const reach = 3 * sig;
  const i0 = max(0, floor((x - reach) / CELL));
  const i1 = min(GW - 1, ceil((x + reach) / CELL));
  const j0 = max(0, floor((y - reach) / CELL));
  const j1 = min(GH - 1, ceil((y + reach) / CELL));
  for (let j = j0; j <= j1; j++) {
    const dy = j * CELL - y;
    for (let i = i0; i <= i1; i++) {
      const dx = i * CELL - x;
      const w = amp * exp(-(dx * dx + dy * dy) * inv);
      const o = j * GW + i;
      if (ch === 1) arr[o] += w;
      else {
        arr[o * 3] += w * r;
        arr[o * 3 + 1] += w * g;
        arr[o * 3 + 2] += w * b;
      }
    }
  }
}

// ---- stars: birth and death ----
function addStar(S, x, y, vx, vy, burn, k, g, cls, rad, peak, ca, cb, tc, flick, ember, spl, st, dz) {
  if (S.n >= NS) return -1;
  const i = S.n++;
  const f = S.f;
  const u = S.u;
  f[X][i] = x;
  f[Y][i] = y;
  f[PX][i] = x;
  f[PY][i] = y;
  f[VX][i] = vx;
  f[VY][i] = vy;
  f[AGE][i] = 0;
  f[BURN][i] = burn;
  f[K][i] = k;
  f[G][i] = g;
  f[PEAK][i] = peak * (0.78 + 0.22 * S.rs());
  f[RAD][i] = rad;
  f[DZ][i] = dz;
  for (let c = 0; c < 3; c++) {
    f[CA + c][i] = ca[c];
    f[CB + c][i] = cb[c];
  }
  f[TC][i] = tc;
  f[ST][i] = st;
  u[CLS][i] = cls;
  u[FLICK][i] = flick;
  u[EMBER][i] = ember;
  u[SPL][i] = spl;
  u[PHI][i] = floor(S.rs() * 256);
  return i;
}

function kill(S, i) {
  const n = --S.n;
  const f = S.f;
  const u = S.u;
  for (let a = 0; a < FN; a++) f[a][i] = f[a][n];
  for (let a = 0; a < UN; a++) u[a][i] = u[a][n];
}

// ---- the shell types ----
const PEONY = 0, CHRYS = 1, WILLOW = 2, PALM = 3, RING = 4, CROSS = 5, BROCADE = 6;
const TYPE_W = [0.22, 0.2, 0.12, 0.11, 0.14, 0.12, 0.09];

// directions evenly spread over a sphere, turned at random so no two shells match
function sphere(S, n, out) {
  const rs = S.rs;
  const a1 = rs() * TAU;
  const a2 = rs() * TAU;
  const a3 = rs() * TAU;
  const c1 = cos(a1), s1 = sin(a1), c2 = cos(a2), s2 = sin(a2), c3 = cos(a3), s3 = sin(a3);
  const ph0 = rs() * TAU;
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * (i + 0.5)) / n;
    const r = sqrt(max(0, 1 - z * z));
    const ph = i * 2.39996323 + ph0;
    let x = r * cos(ph) + (rs() - 0.5) * 0.12;
    let y = r * sin(ph) + (rs() - 0.5) * 0.12;
    let zz = z + (rs() - 0.5) * 0.12;
    const l = 1 / sqrt(x * x + y * y + zz * zz);
    x *= l;
    y *= l;
    zz *= l;
    // about x, then y, then z
    let y1 = y * c1 - zz * s1;
    let z1 = y * s1 + zz * c1;
    const x2 = x * c2 + z1 * s2;
    const z2 = -x * s2 + z1 * c2;
    const x3 = x2 * c3 - y1 * s3;
    const y3 = x2 * s3 + y1 * c3;
    out[i * 3] = x3;
    out[i * 3 + 1] = y3;
    out[i * 3 + 2] = z2;
  }
}
const DIR = new Float32Array(3 * 400);

function flare(S, x, y, R, c, amp) {
  S.flash.push({ x, y, age: 0, life: 0.16, r: 1.5 + 0.1 * R, amp, c: [c[0], c[1], c[2]] });
  // the sky lights up round the burst, the haze more than the clear air
  blob(S.flare, 3, x, y, 0.7 * R + 9, amp * 0.1, c[0], c[1], c[2]);
}

function burst(S, type, x, y, R, nS, ci, cj, aux) {
  const rs = S.rs;
  const P = S.pal;
  const ca = [P[ci * 3], P[ci * 3 + 1], P[ci * 3 + 2]];
  const cb = [P[cj * 3], P[cj * 3 + 1], P[cj * 3 + 2]];
  const gold = S.gold;
  const white = [1, 0.93, 0.78];
  let n = 0;
  const flashc = type === WILLOW || type === BROCADE ? gold : ca;
  flare(S, x, y, R, [0.5 + 0.5 * flashc[0], 0.5 + 0.5 * flashc[1], 0.5 + 0.5 * flashc[2]], 0.3 + 0.004 * R);
  if (type === PEONY || type === CHRYS) {
    const chrys = type === CHRYS;
    n = floor((chrys ? 90 : 64) * nS * (0.9 + 0.2 * rs()));
    n = min(n, 399);
    const burn = chrys ? 2.5 + 0.5 * rs() : 1.9 + 0.5 * rs();
    const k = chrys ? 1.8 : 2.1;
    const v0 = (R * k) / (1 - exp(-k * burn));
    const change = aux < 0.38;
    const tc = change ? burn * (0.42 + 0.2 * rs()) : -1;
    sphere(S, n, DIR);
    for (let i = 0; i < n; i++) {
      const v = v0 * (0.93 + 0.14 * rs());
      const dz = 0.57 + 0.215 * (1 + DIR[i * 3 + 2]);
      addStar(S, x, y, DIR[i * 3] * v, DIR[i * 3 + 1] * v, burn * (0.9 + 0.2 * rs()), k, 7, chrys ? 1 : 0, chrys ? 1.3 : 1.2, chrys ? 0.9 : 1, ca, change ? cb : ca, tc, 0, 0, 0, 0, dz);
    }
  } else if (type === WILLOW) {
    n = min(399, floor(44 * nS * (0.9 + 0.2 * rs())));
    const burn = 4.2 + 1.0 * rs();
    const k = 1.4;
    const v0 = (R * 0.9 * k) / (1 - exp(-k * 2.6));
    sphere(S, n, DIR);
    for (let i = 0; i < n; i++) {
      const v = v0 * (0.8 + 0.4 * rs());
      const dz = 0.57 + 0.215 * (1 + DIR[i * 3 + 2]);
      addStar(S, x, y, DIR[i * 3] * v, DIR[i * 3 + 1] * v, burn * (0.85 + 0.3 * rs()), k, 19, 2, 1.15, 0.45 + 0.55 * rs(), gold, gold, -1, 0, 1, 0, 0, dz);
    }
  } else if (type === PALM) {
    const arms = 5 + floor(rs() * 3);
    const per = max(6, floor(11 * nS));
    const burn = 3.0 + 0.5 * rs();
    const k = 0.85;
    const a0 = rs() * TAU;
    const v0 = (R * 1.15 * k) / (1 - exp(-k * burn * 0.7));
    for (let a = 0; a < arms; a++) {
      const ang = a0 + (a / arms) * TAU + (rs() - 0.5) * 0.3;
      const ca2 = cos(ang);
      const sa2 = sin(ang) - 0.25;
      const l = 1 / sqrt(ca2 * ca2 + sa2 * sa2);
      for (let j = 0; j < per; j++) {
        const v = v0 * (0.8 + 0.2 * (j / (per - 1)));
        const spread = (rs() - 0.5) * 0.05;
        const dx = ca2 * l - sa2 * l * spread;
        const dy = sa2 * l + ca2 * l * spread;
        addStar(S, x, y, dx * v, dy * v, burn * (0.92 + 0.16 * rs()), k, 10, 2, 1.4, 1, ca, aux < 0.3 ? cb : ca, aux < 0.3 ? burn * 0.5 : -1, 0, 0, 0, 0, 1);
      }
    }
  } else if (type === RING) {
    n = min(120, floor(44 * nS * (0.9 + 0.2 * rs())));
    const burn = 2.5 + 0.4 * rs();
    const k = 2.0;
    const v0 = (R * k) / (1 - exp(-k * burn));
    const tilt = 0.3 + 0.95 * aux;
    const psi = rs() * TAU;
    const ct = cos(tilt);
    const st = sin(tilt);
    const cp = cos(psi);
    const sp = sin(psi);
    const ph0 = rs() * TAU;
    for (let i = 0; i < n; i++) {
      const ph = ph0 + (i / n) * TAU + (rs() - 0.5) * 0.08;
      const rx = cos(ph);
      const ry = sin(ph) * ct;
      const rz = sin(ph) * st;
      const dx = rx * cp - ry * sp;
      const dy = rx * sp + ry * cp;
      const v = v0 * (0.97 + 0.06 * rs());
      addStar(S, x, y, dx * v, dy * v, burn * (0.92 + 0.16 * rs()), k, 5, 0, 1.55, 1.15, ca, ca, -1, 0, 0, 0, 0, 0.8 + 0.2 * rz);
    }
    // Saturn: a ball of stars in the middle, in the second colour
    if (aux > 0.45) {
      const m = min(60, floor(26 * nS));
      sphere(S, m, DIR);
      const v1 = (R * 0.4 * k) / (1 - exp(-k * burn * 0.8));
      for (let i = 0; i < m; i++) {
        const v = v1 * (0.9 + 0.2 * rs());
        addStar(S, x, y, DIR[i * 3] * v, DIR[i * 3 + 1] * v, burn * 0.85 * (0.9 + 0.2 * rs()), k, 5, 0, 1.3, 0.9, cb, cb, -1, 0, 0, 0, 0, 0.57 + 0.215 * (1 + DIR[i * 3 + 2]));
      }
    }
  } else if (type === CROSS) {
    n = min(40, floor(13 * nS * (0.9 + 0.2 * rs())));
    n = max(n, 7);
    const k = 2.2;
    const ts = 0.55 + 0.2 * rs();
    const v0 = (0.62 * R * k) / (1 - exp(-k * ts));
    sphere(S, n, DIR);
    for (let i = 0; i < n; i++) {
      const v = v0 * (0.95 + 0.1 * rs());
      addStar(S, x, y, DIR[i * 3] * v, DIR[i * 3 + 1] * v, ts, k, 6, 1, 1.5, 1.1, ca, aux < 0.35 ? cb : ca, aux < 0.35 ? 0.3 : -1, 0, 0, 1, R, 0.57 + 0.215 * (1 + DIR[i * 3 + 2]));
    }
  } else {
    // brocade
    n = min(399, floor(58 * nS * (0.9 + 0.2 * rs())));
    const burn = 3.4 + 1.0 * rs();
    const k = 2.0;
    const v0 = (R * 0.95 * k) / (1 - exp(-k * 1.8));
    sphere(S, n, DIR);
    for (let i = 0; i < n; i++) {
      const v = v0 * (0.85 + 0.3 * rs());
      const crackle = rs() < 0.65;
      addStar(S, x, y, DIR[i * 3] * v, DIR[i * 3 + 1] * v, burn * (0.8 + 0.4 * rs()), k, 9, 0, 1.3, 1, gold, gold, -1, 1, 1, crackle ? 2 : 0, 1.0 + (burn - 1.4) * 0.6 * rs(), 0.57 + 0.215 * (1 + DIR[i * 3 + 2]));
    }
  }
  // smoke the shell leaves where it burst
  blob(S.smoke, 1, x, y, 0.55 * R + 4, 0.3 + 0.0025 * (n || 40) * 1.3, 0, 0, 0);
  S.recent.push({ x, y, t: S.t, R });
  if (S.recent.length > 5) S.recent.shift();
}

// ---- the director: what goes up, where and when ----
function launchOne(S, forced) {
  const rd = S.rd;
  // everything a launch could want, drawn at once so the plan does not hang on the knobs
  const rt = rd();
  const rc = rd();
  const rc2 = rd();
  const rsz = rd();
  const rx = [rd(), rd(), rd()];
  const ry = [rd(), rd(), rd()];
  const rx0 = rd();
  const raux = rd();
  const rlate = rd();
  // type
  let type = 0;
  let acc = 0;
  for (let i = 0; i < TYPE_W.length; i++) {
    acc += TYPE_W[i];
    if (rt * 1 <= acc + 1e-9) {
      type = i;
      break;
    }
  }
  if (type === S.lastType) type = (type + 1 + floor(rlate * 6)) % 7;
  S.lastType = type;
  // colour
  const wc = [0.14, 0.26, 0.22, 0.22, 0.16];
  let ci = 0;
  acc = 0;
  for (let i = 0; i < 5; i++) {
    acc += wc[i];
    if (rc <= acc) {
      ci = i;
      break;
    }
  }
  if (ci === S.lastCol) ci = (ci + 1 + floor(rc2 * 4)) % 5;
  S.lastCol = ci;
  const cj = (ci + 1 + floor(rc2 * 4)) % 5;
  // size
  const k3 = S.size;
  const R0 = k3 < 0 ? lerp(11, 20, k3 + 1) : lerp(20, 27, k3);
  const TF = [1, 1.04, 0.66, 1.1, 0.95, 1.25, 0.95];
  const R = R0 * TF[type] * (0.8 + 0.4 * rsz);
  const nS = k3 < 0 ? lerp(0.45, 1, k3 + 1) : lerp(1, 1.3, k3);
  // where: the best of three, far from the bursts still glowing
  const mx = 0.3 * R + 2;
  const ytop = 0.3 * R + 2;
  const ybot = 112 - 0.3 * R;
  let bx = 0;
  let by = 0;
  let bd = -1;
  for (let c = 0; c < 3; c++) {
    const cx = mx + rx[c] * (W - 2 * mx);
    const cy = lerp(ytop, ybot, Math.pow(ry[c], 1.25));
    let d = 1e9;
    for (const q of S.recent) {
      const age = S.t - q.t;
      const w = 1 + 0.18 * min(age, 5);
      const dd = sqrt((cx - q.x) * (cx - q.x) + (cy - q.y) * (cy - q.y)) * w;
      if (dd < d) d = dd;
    }
    if (d > bd) {
      bd = d;
      bx = cx;
      by = cy;
    }
  }
  const T = 0.8 + 0.85 * sqrt(max(0, H - by) / 118);
  S.rise.push({
    x0: bx + (rx0 - 0.5) * 10,
    xa: bx,
    ya: by,
    T,
    t: 0,
    px: bx,
    py: H + 2,
    type,
    R,
    nS,
    ci,
    cj,
    aux: raux,
  });
  // mortar smoke at the bottom edge
  blob(S.smoke, 1, bx, H, 8, 0.3, 0, 0, 0);
}

function meanGap(p) {
  // seconds between shells: 6 at 0.3, 0.85 at 2, 0.5 at 3
  const l = p < 2 ? lerp(log(6), log(0.85), (p - 0.3) / 1.7) : lerp(log(0.85), log(0.5), p - 2);
  return exp(l);
}

function direct(S, dt) {
  S.next -= dt;
  S.cool -= dt;
  const rd = S.rd;
  while (S.queue.length && S.queue[0] <= S.t) {
    S.queue.shift();
    launchOne(S);
  }
  // nothing in the air and nothing on its way: the next shell goes now
  if (S.n < 140 && S.rise.length === 0 && S.queue.length === 0 && S.next > 0.4) S.next = 0.4;
  if (S.next > 0) return;
  if (S.n > NS * 0.6) {
    S.next = 0.3;
    return;
  }
  let mg = meanGap(S.pace);
  if (S.boost) mg = min(mg, 1.4);
  const a = rd();
  const b = rd();
  const c = rd();
  launchOne(S);
  if (S.cool <= 0 && c < 0.09) {
    // a finale: four to eight shells close together, then a breath
    const m = 3 + floor(b * 5);
    let at = S.t;
    for (let i = 0; i < m; i++) {
      at += 0.12 + 0.3 * rd();
      S.queue.push(at);
    }
    S.cool = 40 + 50 * a;
    S.next = 0.3 + mg * 1.8 + at - S.t;
  } else {
    // uneven gaps, many short and a few long
    const f = (0.45 + 1.1 * Math.pow(a, 1.3)) / 0.927;
    S.next = mg * f;
    if (S.next > 1.8 * mg) S.next = 1.8 * mg;
  }
}

// ---- one step of the sky ----
function step(S, dt) {
  const f = S.f;
  const u = S.u;
  const B = S.B;
  S.t += dt;
  const t = S.t;
  if (S.k1 !== S.hueDone) {
    palette(S, S.k1);
    S.hueDone = S.k1;
  }
  // the wind: a set speed and a slow gust round it
  S.gust = 0.22 * sin(0.37 * t + 1.3) + 0.14 * sin(0.91 * t + 0.4) + 0.08 * sin(2.3 * t);
  const wind = UMAX * S.drift * (1 + 0.3 * S.gust) + 0.6 * S.gust;
  S.wind = wind;
  direct(S, dt);

  // decay the layers
  for (let c = 0; c < 3; c++) {
    const d = exp(-dt / TAILS[c]);
    const b = B[c];
    for (let i = 0; i < b.length; i++) b[i] *= d;
  }
  const dg = exp(-dt / 2.6);
  const df = exp(-dt / 0.22);
  const glow = S.glow;
  const fl = S.flare;
  for (let i = 0; i < glow.length; i++) {
    glow[i] *= dg;
    fl[i] *= df;
  }

  // shells on their way up
  const rise = S.rise;
  for (let q = rise.length - 1; q >= 0; q--) {
    const r = rise[q];
    r.t += dt;
    const uu = min(1, r.t / r.T);
    const e = 1 - (1 - uu) * (1 - uu);
    const x = r.x0 + (r.xa - r.x0) * uu;
    const y = H + 2 + (r.ya - H - 2) * e;
    // head, warm white, its comet dragged behind by the layer's own fade
    seg(B[0], r.px, r.py, x, y, 0.5 + 0.5 * S.gold[0], 0.55 + 0.45 * S.gold[1], 0.45 + 0.4 * S.gold[2], 1.45);
    lend(glow, x, y, 0.004, 0.0028, 0.0014);
    const sp = ca2(S);
    if (S.rs() < 0.8) addStar(S, x + (S.rs() - 0.5) * 1.2, y + 1, (S.rs() - 0.5) * 9, 6 + 14 * S.rs(), 0.25 + 0.3 * S.rs(), 3, 22, 0, 1.1, 0.35 + 0.6 * S.rs() * S.rs(), sp, sp, -1, 0, 1, 0, 0, 1);
    r.px = x;
    r.py = y;
    if (uu >= 1) {
      rise.splice(q, 1);
      burst(S, r.type, x, y, r.R, r.nS, r.ci, r.cj, r.aux);
    }
  }

  // burst flashes: a white core that fades in a quarter second
  const fls = S.flash;
  for (let q = fls.length - 1; q >= 0; q--) {
    const a = fls[q];
    a.age += dt;
    if (a.age >= a.life) {
      fls.splice(q, 1);
      continue;
    }
    const v = (1 - a.age / a.life) * (1 - a.age / a.life) * a.amp * 1.0;
    const rr = a.r;
    const reach = ceil(rr * 1.6);
    const x0 = max(0, floor(a.x - reach));
    const x1 = min(W - 1, floor(a.x + reach));
    const y0 = max(0, floor(a.y - reach));
    const y1 = min(H - 1, floor(a.y + reach));
    const b = B[0];
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy + 0.5 - a.y;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - a.x;
        const w = exp(-2.4 * (dx * dx + dy * dy) / (rr * rr)) * v;
        if (w < 0.02) continue;
        const i = (yy * W + xx) * 3;
        if (w * 3 > b[i] + b[i + 1] + b[i + 2]) {
          b[i] = w * a.c[0];
          b[i + 1] = w * a.c[1];
          b[i + 2] = w * a.c[2];
        }
      }
    }
  }

  // the smoke drifts with the wind, settles a little, thins
  smokeStep(S, dt);

  // the stars
  const air = wind;
  for (let i = 0; i < S.n; ) {
    const age = (f[AGE][i] += dt);
    const burn = f[BURN][i];
    const spl = u[SPL][i];
    if (spl === 2 && age >= f[ST][i]) {
      // a brocade star crackles: three bright sparks fly off it
      u[SPL][i] = 0;
      const x = f[X][i];
      const y = f[Y][i];
      const wc = S.gold;
      const c2 = [0.5 + 0.5 * wc[0], 0.5 + 0.5 * wc[1], 0.5 + 0.5 * wc[2]];
      for (let j = 0; j < 3; j++) {
        const a = S.rs() * TAU;
        const v = 14 + 14 * S.rs();
        addStar(S, x, y, cos(a) * v + f[VX][i] * 0.5, sin(a) * v + f[VY][i] * 0.5, 0.22 + 0.2 * S.rs(), 3, 10, 0, 1.3, 1, c2, c2, -1, 0, 0, 0, 0, 1);
      }
    }
    if (age >= burn) {
      if (spl === 1) {
        // a crossette star splits into four
        const x = f[X][i];
        const y = f[Y][i];
        const vx = f[VX][i] * 0.5;
        const vy = f[VY][i] * 0.5;
        const R = f[ST][i];
        const a0 = S.rs() * TAU;
        const kc = 2.6;
        const bc = 1.25 + 0.4 * S.rs();
        const vs = ((0.45 * R * kc) / (1 - exp(-kc * bc))) * (0.7 + 0.3 * f[DZ][i]);
        const ca = [f[CA][i], f[CA + 1][i], f[CA + 2][i]];
        const cb = [f[CB][i], f[CB + 1][i], f[CB + 2][i]];
        const cc = f[TC][i] >= 0 ? cb : ca;
        const dz = f[DZ][i];
        for (let j = 0; j < 4; j++) {
          const a = a0 + (j * PI) / 2 + (S.rs() - 0.5) * 0.12;
          const v = vs * (0.92 + 0.16 * S.rs());
          addStar(S, x, y, vx + cos(a) * v, vy + sin(a) * v, bc * (0.9 + 0.2 * S.rs()), kc, 6, 0, 1.4, 1.15, cc, cc, -1, 0, 0, 0, 0, dz);
        }
        lend(S.flare, x, y, 0.1, 0.08, 0.06);
      }
      kill(S, i);
      continue;
    }
    // air drag against the moving air, then gravity
    const k = f[K][i];
    const fk = exp(-k * dt);
    const ik = (1 - fk) / k;
    const vt = f[G][i] / k;
    const vx = f[VX][i];
    const vy = f[VY][i];
    const px = f[X][i];
    const py = f[Y][i];
    const x = px + air * dt + (vx - air) * ik;
    const y = py + vt * dt + (vy - vt) * ik;
    f[VX][i] = air + (vx - air) * fk;
    f[VY][i] = vt + (vy - vt) * fk;
    f[PX][i] = px;
    f[PY][i] = py;
    f[X][i] = x;
    f[Y][i] = y;
    if (y > H + 12 || y < -30 || x < -30 || x > W + 30) {
      kill(S, i);
      continue;
    }
    // colour and brightness at this age
    const ur = age / burn;
    let r = f[CA][i];
    let g = f[CA + 1][i];
    let b = f[CA + 2][i];
    const tc = f[TC][i];
    if (tc >= 0 && age > tc) {
      const m = sm(0, 0.2, age - tc);
      r = lerp(r, f[CB][i], m);
      g = lerp(g, f[CB + 1][i], m);
      b = lerp(b, f[CB + 2][i], m);
    }
    // a few stars burn whiter than their neighbours
    const wh = u[PHI][i] / 255;
    const wv = wh * wh * wh * 0.35;
    r += (1 - r) * wv;
    g += (0.96 - g) * wv;
    b += (0.9 - b) * wv;
    // the willow's heavy stars stay white-hot for the first half second
    const hot = 1 - sm(0, u[EMBER][i] && u[CLS][i] === 2 ? 0.5 : 0.16, age);
    if (hot > 0) {
      const h = hot * 0.75;
      r += (1 - r) * h;
      g += (0.96 - g) * h;
      b += (0.88 - b) * h;
    }
    if (u[EMBER][i]) {
      const m = sm(0.4, 0.9, ur) * 0.8;
      r += (1 - r) * m;
      g += (0.62 - g) * m;
      b += (0.22 - b) * m;
    }
    let br = f[PEAK][i] * f[DZ][i] * sm(0, 0.05, age);
    if (hot > 0) br *= 1 + 0.35 * hot;
    if (ur > 0.6) {
      const fa = 1 - (ur - 0.6) / 0.4;
      br *= fa * (0.4 + 0.6 * fa);
    }
    if (u[FLICK][i]) {
      const tick = floor(age * 13 + u[PHI][i]);
      const h = sin(tick * 12.9898 + u[PHI][i] * 7.13) * 43758.5453;
      br *= h - floor(h) < 0.34 ? 1.15 : 0.3;
    }
    if (br > 0.02) {
      seg(B[u[CLS][i]], px, py, x, y, r * br, g * br, b * br, f[RAD][i]);
      // the light a star lends the air leans a little toward the cool, so the haze stays a night haze
      const lm = (r + g + b) * 0.3333;
      lend(glow, x, y, (0.8 * r + 0.15 * lm) * br * GLOWK * 1.15, (0.8 * g + 0.17 * lm) * br * GLOWK * 1.15, (0.8 * b + 0.21 * lm) * br * GLOWK * 1.15);
    }
    i++;
  }
}
function ca2(S) {
  // the spark of a comet tail: the palette's gold, a little warmer
  const o = S.out;
  const g = S.gold;
  o[0] = g[0];
  o[1] = g[1] * 0.85;
  o[2] = g[2] * 0.6;
  return o;
}

function smokeStep(S, dt) {
  const s = S.smoke;
  const s2 = S.smoke2;
  const ux = (S.wind * 0.33 * dt) / CELL;
  const uy = (0.4 * dt) / CELL;
  const decay = exp(-dt / 10);
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      // look up where this air came from
      const sx = cl(i - ux, 0, GW - 1.001);
      const sy = cl(j - uy, 0, GH - 1.001);
      const i0 = floor(sx);
      const j0 = floor(sy);
      const fx = sx - i0;
      const fy = sy - j0;
      const o = j0 * GW + i0;
      s2[j * GW + i] =
        decay * ((1 - fy) * ((1 - fx) * s[o] + fx * s[o + 1]) + fy * ((1 - fx) * s[o + GW] + fx * s[o + GW + 1]));
    }
  }
  S.smoke = s2;
  S.smoke2 = s;
  // the lumps in the smoke ride the same wind
  S.wx += S.wind * 0.33 * dt;
  S.wy += 0.4 * dt;
}

// smooth value noise on an integer lattice
function lat(i, j) {
  const h = sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - floor(h);
}
function vnoise(x, y) {
  const i = floor(x);
  const j = floor(y);
  let fx = x - i;
  let fy = y - j;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = lat(i, j);
  const b = lat(i + 1, j);
  const c = lat(i, j + 1);
  const d = lat(i + 1, j + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const d = cl(dt || 0, 0, 0.1);
  const kn = input.knobValues || [0, 2, 0, 0.06];
  const k1 = cl(kn[0], 0, 1);
  S.pace = cl(kn[1], 0.3, 3);
  S.size = cl(kn[2], -1, 1);
  S.drift = cl(kn[3], -1, 1);
  S.k1 = k1;
  if (!S.started) {
    S.started = true;
    // the sky has been firing for a while already
    const n = floor(WARM * 30);
    S.t = 0;
    S.next = 0.2;
    for (let i = 0; i < n; i++) {
      S.boost = i > n - 6 * 30;
      step(S, 1 / 30);
    }
    S.boost = false;
    return;
  }
  step(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const B0 = S.B[0];
  const B1 = S.B[1];
  const B2 = S.B[2];
  const smoke = S.smoke;
  const glow = S.glow;
  const fl = S.flare;
  // the lumps of the smoke: two octaves of noise riding the wind
  const tex = S.tex;
  for (let j = 0; j < TH; j++) {
    for (let i = 0; i < TW; i++) {
      const px = i * 2 - S.wx;
      const py = j * 2 - S.wy;
      tex[j * TW + i] = 0.62 * vnoise(px / 11 + 3.1, py / 13 + 7.7) + 0.38 * vnoise(px / 5 + 17.3, py / 6 + 2.9);
    }
  }
  // the horizontal weights of the grids, once
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / CELL;
    S.px[x] = u;
  }
  let o = 0;
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / CELL;
    const j0 = min(GH - 2, floor(v));
    const fy = v - j0;
    // the faint warm haze that lies low, brightest at the bottom edge
    const lowv = exp(-(H - y) / 15);
    const tv = (y + 1) / 2;
    const tj = floor(tv);
    const tfy = tv - tj;
    for (let x = 0; x < W; x++) {
      const tu = (x + 1) / 2;
      const ti = floor(tu);
      const tfx = tu - ti;
      const t0 = tj * TW + ti;
      const nz = (1 - tfy) * ((1 - tfx) * tex[t0] + tfx * tex[t0 + 1]) + tfy * ((1 - tfx) * tex[t0 + TW] + tfx * tex[t0 + TW + 1]);
      const lump = 0.25 + 1.5 * nz;
      const u = S.px[x];
      const i0 = min(GW - 2, floor(u));
      const fx = u - i0;
      const a = j0 * GW + i0;
      const w0 = (1 - fx) * (1 - fy);
      const w1 = fx * (1 - fy);
      const w2 = (1 - fx) * fy;
      const w3 = fx * fy;
      const sk = w0 * smoke[a] + w1 * smoke[a + 1] + w2 * smoke[a + GW] + w3 * smoke[a + GW + 1];
      const dens = (1 - exp(-0.5 * sk)) * (0.4 + 1.2 * nz);
      const a3 = a * 3;
      const b3 = a3 + 3;
      const c3 = a3 + GW * 3;
      const d3 = c3 + 3;
      const gr = w0 * glow[a3] + w1 * glow[b3] + w2 * glow[c3] + w3 * glow[d3];
      const gg = w0 * glow[a3 + 1] + w1 * glow[b3 + 1] + w2 * glow[c3 + 1] + w3 * glow[d3 + 1];
      const gb = w0 * glow[a3 + 2] + w1 * glow[b3 + 2] + w2 * glow[c3 + 2] + w3 * glow[d3 + 2];
      const fr = w0 * fl[a3] + w1 * fl[b3] + w2 * fl[c3] + w3 * fl[d3];
      const fg = w0 * fl[a3 + 1] + w1 * fl[b3 + 1] + w2 * fl[c3 + 1] + w3 * fl[d3 + 1];
      const fb = w0 * fl[a3 + 2] + w1 * fl[b3 + 2] + w2 * fl[c3 + 2] + w3 * fl[d3 + 2];
      const lit = (0.45 + 1.5 * dens) * lump;
      const fli = (0.3 + 1.2 * dens) * (0.5 + 0.5 * lump);
      const haze = lowv * (0.006 + 0.02 * dens);
      const hg = S.gold;
      // the lit air is a little pale: a third of its colour goes to grey
      const gm = (gr + gg + gb) * 0.3333;
      const gq = (fr + fg + fb) * 0.3333;
      let r = B0[o] + B1[o] + B2[o] + (gr * 0.8 + gm * 0.2) * lit + (fr * 0.8 + gq * 0.2) * fli + haze * hg[0];
      let g = B0[o + 1] + B1[o + 1] + B2[o + 1] + (gg * 0.8 + gm * 0.2) * lit + (fg * 0.8 + gq * 0.2) * fli + haze * hg[1] * hg[1] * 0.7;
      let b = B0[o + 2] + B1[o + 2] + B2[o + 2] + (gb * 0.8 + gm * 0.2) * lit + (fb * 0.8 + gq * 0.2) * fli + haze * hg[2] * hg[2] * 0.4;
      // a bright core turns white
      const m = max(r, g, b);
      if (m > 0.55) {
        const wh = sm(0.55, 1.6, m) * 0.5;
        r += (m - r) * wh;
        g += (m - g) * wh;
        b += (m - b) * wh;
      }
      const s = NLUT / 2.5;
      display.setPixel(x, y, ENC[min(NLUT, (r * s) | 0)], ENC[min(NLUT, (g * s) | 0)], ENC[min(NLUT, (b * s) | 0)]);
      o += 3;
    }
  }
}
