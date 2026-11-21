// ===== Patternflow pattern =====
// Title:   Comb Jelly
// Family:  ctenophore
// Idea:    A glassy comb jelly seen from the side in black water, its eight meridian rows of comb plates carrying metachronal waves of beating that flash as ribbons of rainbow colour (a pale head, a saturated shoulder, a velvety tail) running along the rows from the top pole to the mouth, stalling and running back now and then, while the body rolls about its long axis and new rows come round the edge.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 210, after the comb rows of a ctenophore, the eight meridians of ciliary plates whose beats run out of step in a metachronal wave and scatter light into rainbow colours
// Round:   210
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Beat=0..4, Turn=-2..2, Reach=-1..1
//
// Knob 1: Hue. Turns the rainbow round the wheel. At 0 the ribbons run from a pale yellow-green head through cyan to a violet-blue tail at the top, and cyan through blue to violet lower down; at 0.5 the same ribbons are red-orange through magenta; at 1 it is back where it began. On top of the knob the whole palette wanders about 100 degrees on periods of one to five minutes.
// Knob 2: Beat. The beating rate of the plates. At 0 the waves run at 0.3 beats a second, about 4 LEDs a second down a row, a slow ripple; at the opening 2 at 0.95, about 12 LEDs a second; at 4 at 3 beats a second, about 40 LEDs a second, a fast shimmer. The rate itself wanders about 15 percent around the knob.
// Knob 3: Turn. How fast the animal rolls about its long axis, in octaves. At the opening 0 it takes about 28 seconds a turn and a row crosses the middle of the body at about 4 LEDs a second; at -2 a turn takes 114 seconds and the rows hardly move across the body; at 2 a turn takes 7 seconds and the rows sweep by at 15 LEDs a second. Five or so of the eight rows are in view at any moment, the far ones shining through dimly.
// Knob 4: Reach. The wavelength of the beat along a row, which is the length of a ribbon. At -1 it is 7.5 LEDs and the body carries about 13 short ribbons to a row; at the opening 0.06 it is 13 LEDs and about 7; at 1 it is 22 LEDs and 4 long ones.

const W = 64;
const H = 128;
const { sin, cos, sqrt, exp, floor, ceil, max, min, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const NR = 8; // comb rows
const RMAX = 17.5; // half width of the body, LEDs
const T0 = 123; // where the slow clock stands when the Lab starts
const BASE_HUE = 150; // OKLCH degrees of the ribbons at Hue 0, before the spatial and slow offsets
const TR = 9; // seconds a reversal takes: the wave slows, stalls, then runs back

// OKLCH to linear sRGB, not normalised: lightness sets how much light there is
function oklch(L, C, hDeg, out) {
  const h = hDeg * (PI / 180);
  const a = C * cos(h);
  const b = C * sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  out[0] = r > 0 ? r : 0;
  out[1] = g > 0 ? g : 0;
  out[2] = bl > 0 ? bl : 0;
}

// encode: linear light, soft knee above 0.6, then 1/2.2
const NLUT = 2048;
const ENC = new Uint8Array(NLUT + 1);
for (let i = 0; i <= NLUT; i++) {
  const x = (i / NLUT) * 2.5;
  const y = x < 0.6 ? x : 0.6 + 0.4 * (1 - exp(-(x - 0.6) / 0.4));
  ENC[i] = Math.round(255 * Math.pow(y, 0.45));
}

function hash(i) {
  const h = sin(i * 12.9898 + 4.1414) * 43758.5453;
  return h - floor(h);
}

const NSNOW = 12;

export function setup(params) {
  params.s = {
    t: T0,
    ph: 0, // beat phase, radians, accumulated so a change of rate never jumps the waves
    rot: 0.6, // roll about the long axis, radians
    om: -1, // smoothed roll rate (negative: not yet set)
    lam: 0,
    hue: 0,
    beat: 2,
    turn: 0,
    reach: 0.06,
    // reversal: dir is where the wave goes after the transition, kap eases between -1 and 1
    dir: 1,
    kap: 1,
    tr: -1,
    from: 1,
    nextAt: T0 + 70,
    nrev: 0,
    // the pose
    cx: 32,
    cy: 64,
    tilt: 0,
    bend: 0,
    half: 49,
    acc: new Float32Array(W * H * 3),
    tmp: [0, 0, 0],
    R: new Float32Array(H),
    nk: new Float32Array(H),
    xc: new Float32Array(H),
    sa: new Float32Array(NR),
    ca: new Float32Array(NR),
  };
  pose(params.s);
}

// the animal's place and shape at the slow clock
function pose(S) {
  const t = S.t;
  S.cx = 32 + 2.2 * sin(0.047 * t + 1.0) + 1.4 * sin(0.113 * t + 2.4);
  S.cy = 64.5 + 2.0 * sin(0.061 * t + 0.3) + 1.1 * sin(0.137 * t + 4.0);
  // a few degrees of tilt and a bow of a few LEDs
  S.tilt = 0.07 * sin(0.037 * t + 0.5) + 0.042 * sin(0.083 * t + 2.0);
  S.bend = 2.2 * sin(0.053 * t + 3.0) + 1.3 * sin(0.127 * t + 0.8);
  // the body swells and slims by a LED or two
  S.half = 49 + 1.2 * sin(0.071 * t + 1.9) + 0.8 * sin(0.163 * t + 5.0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const d = cl(dt || 0, 0, 0.1);
  const kn = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(kn[0], 0, 1);
  S.beat = cl(kn[1], 0, 4);
  S.turn = cl(kn[2], -2, 2);
  S.reach = cl(kn[3], -1, 1);
  S.t += d;
  const t = S.t;
  pose(S);

  // beat rate: 0.3 Hz at Beat 0 to 3 Hz at Beat 4, wandering a little round the knob
  const f = 0.3 * Math.pow(10, S.beat / 4) * (1 + 0.1 * sin(0.21 * t + 0.4) + 0.06 * sin(0.53 * t + 1.0));
  S.ph = (S.ph + TAU * f * d) % (TAU * 4096);

  // wavelength along a row in LEDs, eased so turning the knob slides the ribbons
  const lamT = 13 * exp(0.55 * S.reach) * (1 + 0.1 * sin(0.043 * t + 1.1) + 0.05 * sin(0.117 * t + 0.2));
  if (S.lam <= 0) S.lam = lamT;
  S.lam += (lamT - S.lam) * (1 - exp(-d / 0.25));

  // roll rate: 0.055 to 0.88 rad/s over the knob, swelling and easing on its own
  const omT = 0.22 * Math.pow(2, S.turn) * (1 + 0.3 * sin(0.073 * t + 0.6) + 0.15 * sin(0.19 * t + 2.0));
  if (S.om < 0) S.om = omT;
  S.om += (omT - S.om) * (1 - exp(-d / 0.4));
  S.rot = (S.rot + S.om * d) % TAU;

  // the wave goes top to mouth for one to three minutes, then back for a short while
  if (S.tr < 0 && t >= S.nextAt) {
    S.tr = t;
    S.from = S.dir;
    S.dir = -S.dir;
    S.nrev++;
    const stay = S.dir > 0 ? 55 + 110 * hash(S.nrev * 3 + 1) : 14 + 36 * hash(S.nrev * 3 + 2);
    S.nextAt = t + TR + stay;
  }
  if (S.tr >= 0) {
    const u = (t - S.tr) / TR;
    if (u >= 1) {
      S.tr = -1;
      S.kap = S.dir;
    } else if (u < 0.35) S.kap = S.from * (1 - sm(0, 1, u / 0.35));
    else if (u < 0.65) S.kap = 0;
    else S.kap = S.dir * sm(0, 1, (u - 0.65) / 0.35);
  } else S.kap = S.dir;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const acc = S.acc;
  acc.fill(0);
  const tmp = S.tmp;
  const t = S.t;
  const cy = S.cy;
  const half = S.half;
  const R = S.R;
  const nk = S.nk;
  const xc = S.xc;

  // the glass takes some of the Hue knob too, so the whole animal turns with it
  const hueK = S.hue * 360;
  const hueT = 80 * sin(0.0191 * t + 0.9) + 40 * sin(0.0467 * t + 3.2);
  oklch(0.82, 0.13, 195 + hueK + 0.25 * hueT, tmp);
  const shk = 1 / max(tmp[0], tmp[1], tmp[2], 1e-6);
  const shR = tmp[0] * shk;
  const shG = tmp[1] * shk;
  const shB = tmp[2] * shk;

  // ---- the body, scanline by scanline ----
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5;
    const v = (yc - cy) / half;
    let r = 0;
    if (v > -1 && v < 1) {
      const s = sqrt(1 - v * v);
      r = RMAX * Math.pow(s, 0.7) * (1 + 0.12 * v - 0.06 * v * v);
    }
    R[y] = r;
    const u = (yc - cy) / 50;
    xc[y] = S.cx + S.tilt * (yc - cy) + S.bend * u * u;
  }
  for (let y = 0; y < H; y++) {
    const a = R[y > 0 ? y - 1 : 0];
    const b = R[y < H - 1 ? y + 1 : H - 1];
    const dr = (b - a) * 0.5;
    nk[y] = 1 / sqrt(1 + dr * dr);
  }
  for (let y = 0; y < H; y++) {
    const r = R[y];
    if (r < 0.4) continue;
    const c = xc[y];
    const n = nk[y];
    const x0 = max(0, floor(c - r - 4));
    const x1 = min(W - 1, ceil(c + r + 4));
    let o = (y * W + x0) * 3;
    for (let x = x0; x <= x1; x++, o += 3) {
      const dx = x + 0.5 - c;
      const dn = (r - abs(dx)) * n;
      if (dn < -3) continue;
      const q = dx / r;
      const thick = q * q < 1 ? sqrt(1 - q * q) : 0;
      const cov = sm(-0.8, 0.8, dn);
      const rm = dn - 0.8;
      const rim = exp(-(rm * rm) / 2.2) * (0.82 - 0.22 * q);
      const lin = 0.0042 * cov * (0.55 + 0.45 * thick) + 0.06 * rim;
      acc[o] += lin * shR;
      acc[o + 1] += lin * shG;
      acc[o + 2] += lin * shB;
    }
  }

  // ---- the comb rows ----
  const lam = S.lam;
  const kap = S.kap;
  const ph = S.ph;
  // the beat is feeble while the wave stalls, and the whole animal is more or less excited over a minute or two
  const amp = (0.4 + 0.6 * sm(0, 0.4, abs(kap))) * (0.86 + 0.16 * sin(0.052 * t + 0.7) + 0.1 * sin(0.0173 * t + 2.6));
  const rowsY0 = max(0, floor(cy - half * 0.96));
  const rowsY1 = min(H - 1, ceil(cy + half * 0.9));
  // each row has its own place in the beat, smooth round the body so the ribbons slant
  const hel = 1;
  const p1 = 0.6 + 0.013 * t + 0.8 * sin(0.0213 * t + 0.4);
  const p2 = 1.3 - 0.011 * t + 0.9 * sin(0.0297 * t + 2.2);
  for (let k = 0; k < NR; k++) {
    const a = S.rot + k * (PI / 4);
    S.sa[k] = sin(a);
    S.ca[k] = cos(a);
  }
  for (let k = 0; k < NR; k++) {
    const sA = S.sa[k];
    const cA = S.ca[k];
    // how much of the row shows: the near side bright, the far side dim, and the
    // rows seen edge-on, which crowd at the rim, held back so they do not make a carpet
    const vis = (0.07 + 0.93 * sm(-0.2, 0.9, cA)) * (0.45 + 0.55 * sm(0, 0.55, abs(cA)));
    const wob = 0.8 + 0.2 * sin(0.091 * t + 1.7 * k) * sin(0.037 * t + k);
    const kk = k * (PI / 4);
    const off = hel * (k * 0.25) + 0.1 * sin(kk + p1) + 0.07 * sin(2 * kk + p2) + 0.02 * hash(k + 5);
    const hrow = 22 * sin(kk + 2.0);
    const sigA = 1.0 + 0.55 * abs(cA);
    for (let y = rowsY0; y <= rowsY1; y++) {
      const r = R[y];
      if (r < 2.5) continue;
      const yc = y + 0.5;
      const v = (yc - cy) / half;
      const ends = sm(-0.96, -0.74, v) * (1 - sm(0.64, 0.84, v)) * sm(0.14, 0.52, r / RMAX);
      if (ends < 0.004) continue;
      // the beat phase here in turns; its fraction says where in the stroke this plate is
      const ps = (ph - (TAU * kap * (yc - 64)) / lam) / TAU + off;
      const n = floor(ps);
      const p = ps - n;
      // every ribbon is a little its own: a touch brighter or dimmer, a touch warmer or cooler
      const hn = hash(n * 1.713 + k * 4.31 + 0.5);
      const hn2 = hash(n * 2.377 + k * 1.93 + 7.1);
      const rise = 1 - exp(-p / 0.08);
      const B = rise * exp(-p / 0.135) * 3.0;
      // the colour of a plate: pale and bright at the head of its stroke, saturated in the
      // shoulder, a desaturated velvet in the tail; the hue turns with the plate angle
      const Lp = 0.56 + 0.38 * (1 - sm(0.04, 0.3, p));
      const Cp = 0.04 + 0.16 * sm(0.07, 0.22, p) * (1 - 0.6 * sm(0.3, 0.6, p));
      const Hp = BASE_HUE + hueK + hueT + hrow + 55 * sin((yc - 64) * 0.045 + 0.31) + 90 * (hn2 - 0.5) + 260 * p;
      oklch(Lp, Cp, Hp, tmp);
      const g = B * 1.6 * (0.72 + 0.5 * hn) * amp * wob * vis * ends;
      // a faint pale line between the flashes keeps the row there
      const bs = 0.016 * vis * ends;
      const lr = tmp[0] * g;
      const lg = tmp[1] * g;
      const lb = tmp[2] * g;
      const rr = r / RMAX;
      const sig = sigA * (0.6 + 0.4 * rr);
      const xr = xc[y] + r * sA;
      const sh = sig * 2.4;
      const reach = ceil(sh * 1.9);
      const x0 = max(0, floor(xr - reach));
      const x1 = min(W - 1, ceil(xr + reach));
      const i2 = 1 / (2 * sig * sig);
      const ih = 1 / (2 * sh * sh);
      let o = (y * W + x0) * 3;
      for (let x = x0; x <= x1; x++, o += 3) {
        const dx = x + 0.5 - xr;
        const d2 = dx * dx;
        const e = exp(-d2 * i2);
        const w = e + 0.02 * exp(-d2 * ih);
        const wb = e * bs;
        acc[o] += lr * w + wb * shR;
        acc[o + 1] += lg * w + wb * shG;
        acc[o + 2] += lb * w + wb * shB;
      }
    }
  }

  // ---- the axis: the gut, the apical organ, the mouth ----
  {
    const top = cy - half * 0.93;
    const bot = cy + half * 0.97;
    const tx = S.cx + S.tilt * (top - cy) + S.bend * ((top - cy) / 50) * ((top - cy) / 50);
    const bx = S.cx + S.tilt * (bot - cy) + S.bend * ((bot - cy) / 50) * ((bot - cy) / 50);
    const pulse = 0.88 + 0.12 * sin(0.9 * t + 0.4) * sin(0.37 * t + 1.1);
    const aH = BASE_HUE + hueK + hueT + 40;
    oklch(0.93, 0.05, aH + 20, tmp);
    const sr = tmp[0];
    const sg = tmp[1];
    const sb = tmp[2];
    oklch(0.8, 0.12, aH + 150, tmp);
    const mr = tmp[0];
    const mg = tmp[1];
    const mb = tmp[2];
    const open = 0.85 + 0.15 * sin(0.31 * t + 2.0);
    for (let y = 0; y < H; y++) {
      const yc = y + 0.5;
      const dyT = yc - top;
      const dyB = yc - bot;
      const c = xc[y];
      const gutOn = sm(cy - half * 0.1, cy + half * 0.25, yc) * (1 - sm(cy + half * 0.78, cy + half * 0.93, yc));
      const x0 = max(0, floor(c - 12));
      const x1 = min(W - 1, ceil(c + 12));
      let o = (y * W + x0) * 3;
      for (let x = x0; x <= x1; x++, o += 3) {
        const xx = x + 0.5;
        const dxc = xx - c;
        let r = 0;
        let g = 0;
        let b = 0;
        // the gut, a faint tube down the middle
        if (gutOn > 0.01) {
          const e = exp(-(dxc * dxc) / (2 * 1.8 * 1.8)) * 0.016 * gutOn;
          r += e * 0.45;
          g += e * 0.9;
          b += e;
        }
        // the apical organ: a 3 LED glow
        {
          const dx = xx - tx;
          const d2 = dx * dx + dyT * dyT;
          if (d2 < 100) {
            const e = (0.95 * exp(-d2 / (2 * 1.05 * 1.05)) + 0.2 * exp(-d2 / (2 * 3.0 * 3.0))) * pulse;
            r += e * sr;
            g += e * sg;
            b += e * sb;
          }
        }
        // the mouth lobes: two soft dim lobes that open and close
        if (dyB > -9 && dyB < 9) {
          for (let l = -1; l <= 1; l += 2) {
            const dx = xx - (bx + l * 3.6 * open);
            const e = 0.085 * exp(-(dx * dx) / (2 * 3.0 * 3.0) - ((dyB + 1.0) * (dyB + 1.0)) / (2 * 3.0 * 3.0));
            r += e * mr;
            g += e * mg;
            b += e * mb;
          }
        }
        acc[o] += r;
        acc[o + 1] += g;
        acc[o + 2] += b;
      }
    }
  }

  // ---- two thin tentacles hanging from the sides, a slow wave down them ----
  {
    const yb = cy - half * 0.02;
    oklch(0.82, 0.07, BASE_HUE + hueK + hueT + 70, tmp);
    const tr = tmp[0];
    const tg = tmp[1];
    const tb = tmp[2];
    for (let side = -1; side <= 1; side += 2) {
      const ph0 = side > 0 ? 0.3 : 2.1;
      for (let y = max(0, floor(yb)); y < H; y++) {
        const yc = y + 0.5;
        const s = yc - yb;
        const fade = sm(0, 6, s) * exp(-s / 38) * (1 - sm(98, 120, yc));
        if (fade < 0.01) continue;
        const lead = 1 - exp(-s / 20);
        // out of the pouch, a little way outward, then back in toward the trail
        const e0 = 13.5 + 7.5 * (1 - exp(-s / 22)) - 6 * sm(38, 85, s);
        const wv = (3.0 * lead) * sin(s / 11 - 0.5 * t + ph0) + 2.0 * lead * sin(0.071 * t + ph0 * 2.0 + s / 40);
        const px = xc[y] + side * (e0 + 2.5 + wv * 0.8);
        const g = 0.09 * fade * (0.8 + 0.2 * sin(s / 5 - 0.9 * t + ph0));
        const x0 = max(0, floor(px - 4));
        const x1 = min(W - 1, ceil(px + 4));
        let o = (y * W + x0) * 3;
        for (let x = x0; x <= x1; x++, o += 3) {
          const dx = x + 0.5 - px;
          const w = exp(-(dx * dx) / (2 * 1.0 * 1.0)) * g;
          acc[o] += w * tr;
          acc[o + 1] += w * tg;
          acc[o + 2] += w * tb;
        }
      }
    }
  }

  // ---- marine snow: a few soft specks that sink past the animal's rise ----
  for (let n = 0; n < NSNOW; n++) {
    const sx = 4 + 56 * hash(n * 7 + 1) + 3 * sin(0.05 * t + n * 2.3);
    const sp = 0.8 + 1.6 * hash(n * 7 + 2);
    const sy = (((hash(n * 7 + 3) * H - t * sp) % H) + H) % H;
    const a = (0.012 + 0.014 * hash(n * 7 + 4)) * (0.7 + 0.3 * sin(0.4 * t + n * 1.7));
    const x0 = max(0, floor(sx - 3));
    const x1 = min(W - 1, ceil(sx + 3));
    const y0 = max(0, floor(sy - 3));
    const y1 = min(H - 1, ceil(sy + 3));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - sy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - sx;
        const w = a * exp(-(dx * dx + dy * dy) / (2 * 1.0 * 1.0));
        const o = (y * W + x) * 3;
        acc[o] += w * 0.5;
        acc[o + 1] += w * 0.85;
        acc[o + 2] += w;
      }
    }
  }

  // ---- out ----
  const sc = NLUT / 2.5;
  let i = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = ENC[min(NLUT, (acc[i] * sc) | 0)];
      const gg = ENC[min(NLUT, (acc[i + 1] * sc) | 0)];
      const b = ENC[min(NLUT, (acc[i + 2] * sc) | 0)];
      display.setPixel(x, y, r, gg, b);
      i += 3;
    }
  }
}
