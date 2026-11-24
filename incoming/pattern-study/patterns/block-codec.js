// ===== Patternflow pattern =====
// Title:   Block Codec
// Family:  blockcodec
// Idea:    A dusk of four glowing discs, a white bar and a patch of fine stripes is cut into 8 by 8 LED blocks, sent through the JPEG discrete cosine transform and its quantisation table at a quality that rises and falls, and the panel shows what the decoder makes of it: flat tiles and ramps at low quality, ringing round the bar, colour bleeding in 16 LED blocks, and a nearly clean picture at the top.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the discrete cosine transform (Nasir Ahmed, T. Natarajan and K. R. Rao, 1974, from memory), JPEG baseline coding with the quantisation tables of its Annex K (Gregory Wallace, "The JPEG still picture compression standard", 1991; ITU-T T.81, 1992, from memory), 4:2:0 chroma on the BT.601 colour matrix, and the generation loss of coding a picture again on a shifted grid; pattern round 233
// Round:   233
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Quality=0..6, Offset=0..7, Passes=1..4
//
// Knob 1: Hue. Turns the colour of the whole scene once round the wheel before it is coded and keeps its brightness: indigo to coral sky over a teal ground at 0, a green sky over a plum ground at 0.33, a lilac and blue sky over a green ground at 0.67, and back where it began at 1.
// Knob 2: Quality. The JPEG quality the swing moves around: 2.6 at 0, 8.5 at 2 where it opens (flat tiles with ramps), 28 at 4 (ringing round the bar, colour bleeding in 16 LED blocks) and 91 at 6 (nearly clean); the swing multiplies it by about a third to about seven, and no quality goes below 3.4.
// Knob 3: Offset. Slides the block grid across the picture, 0 to 7 LED in x and 0 to 4 in y, rounded to whole LED: the seams move, and a tile changes colour as its edges pass over a disc.
// Knob 4: Passes. How many times the picture is decoded and coded again, each time on a grid moved 3 LED across and 5 down and at 1.25 times the quality of the pass before: 1 is one pass, 4 is four, and between whole numbers the next pass fades in.

const W = 64;
const H = 128;
const N = W * H;
const CW = 32; // the chroma planes are half as wide and half as tall
const CH = 64;
const CN = CW * CH;
const { floor, ceil, sqrt, sin, cos, exp, abs, min, max, round, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

// ---- JPEG Annex K tables, row by row
const QL = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104,
  113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];
const QC = [
  17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
];

// ---- the 8 point DCT-II as a table: COS[u * 8 + x] is basis u at sample x, scaled so the transform is orthonormal
const COS = new Float32Array(64);
for (let u = 0; u < 8; u++) for (let x = 0; x < 8; x++) COS[u * 8 + x] = (u === 0 ? sqrt(1 / 8) : 0.5) * cos(((2 * x + 1) * u * PI) / 16);

// ---- the quality swing: three sines whose periods (37, 23 and 61 s) share no factor, 2 ^ (1.1 * sum) times the knob's quality
const SW = [
  [1 / 37, 0.95, 0],
  [1 / 23, 0.8, 2.1],
  [1 / 61, 0.85, 4.0],
];

function swing(t) {
  let s = 0;
  for (let i = 0; i < 3; i++) s += SW[i][1] * sin(TAU * SW[i][0] * t + SW[i][2]);
  return s;
}

// ---- the hidden dusk, in RGB
const SKY = [
  [0, 24, 18, 82],
  [0.2, 80, 36, 132],
  [0.4, 168, 54, 138],
  [0.58, 238, 100, 112],
  [0.78, 246, 136, 98],
  [1, 250, 158, 86],
];
const GROUND = [
  [0, 8, 92, 104],
  [1, 0, 44, 62],
];
const DISCS = [
  // radius, colour, then x and y: base, two sines each as [amplitude, cycles a second, phase]
  { r: 10, c: [255, 214, 112], x: [22, 14, 1 / 47, 0.3, 5, 1 / 17.3, 1.1], y: [42, 13, 1 / 59, 1.9, 5, 1 / 21.7, 0.2] },
  { r: 9.5, c: [60, 228, 238], x: [24, 14, 1 / 53, 2.4, 4, 1 / 19.1, 3.0], y: [62, 16, 1 / 71, 0.6, 5, 1 / 27.9, 1.6] },
  { r: 11, c: [255, 120, 178], x: [44, 14, 1 / 61, 4.1, 5, 1 / 23.3, 0.7], y: [24, 13, 1 / 83, 3.3, 6, 1 / 31.7, 2.5] },
  { r: 8.5, c: [176, 242, 76], x: [30, 16, 1 / 67, 5.2, 4, 1 / 14.9, 2.2], y: [104, 11, 1 / 97, 1.3, 4, 1 / 37.1, 4.4] },
];
const CHROMA = 0.78; // the panel raises saturation by 1.62, so the source is held back a little
const LATER = 1.25; // how much finer each further pass is than the one before
const BAR = { hl: 14, hw: 4.2, c: [255, 240, 226] };
const STRIPE_A = [218, 200, 255];
const STRIPE_B = [92, 58, 168];

function ramp(stops, u, out) {
  let i = 0;
  while (i < stops.length - 2 && u > stops[i + 1][0]) i++;
  const a = stops[i];
  const b = stops[i + 1];
  const t = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * t;
  out[1] = a[2] + (b[2] - a[2]) * t;
  out[2] = a[3] + (b[3] - a[3]) * t;
}

export function setup(P) {
  Object.assign(P, {
    t: 0, // the swing is near zero here and level, so the picture opens at the knob's quality
    k: [0, 2, 0, 0.06],
    // the planes of the picture being coded, full size
    Y: new Float32Array(N),
    Cb: new Float32Array(N),
    Cr: new Float32Array(N),
    // the same chroma at half size, and the decoded planes
    hb: new Float32Array(CN),
    hr: new Float32Array(CN),
    dY: new Float32Array(N),
    dhb: new Float32Array(CN),
    dhr: new Float32Array(CN),
    // what each pass gave back, as 8 bit RGB, and what is shown
    res: [0, 1, 2, 3].map(() => new Uint8ClampedArray(N * 3)),
    out: new Uint8ClampedArray(N * 3),
    skyRow: new Float32Array(H * 3),
    skyLut: new Float32Array(256 * 3),
    stepsY: new Float32Array(64),
    stepsC: new Float32Array(64),
    blk: new Float32Array(64),
    tmp: new Float32Array(64),
  });
}

export function update(dt, input, P) {
  if (!P.out) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) P.k[i] = k[i];
  P.t += cl(dt || 0, 0, 0.1);
}

// ---- the source, drawn straight into Y, Cb and Cr
function rgbToYcc(r, g, b, o) {
  o[0] = 0.299 * r + 0.587 * g + 0.114 * b;
  o[1] = -0.168736 * r - 0.331264 * g + 0.5 * b;
  o[2] = 0.5 * r - 0.418688 * g - 0.081312 * b;
}

function renderSource(P, t, hue) {
  const { Y, Cb, Cr, skyRow } = P;
  const ch = cos(hue);
  const sh = sin(hue);
  const tmp = [0, 0, 0];
  const yc = [0, 0, 0];

  // the sky as a 256 step table in u, the colour of the whole sky leaning one way and the other
  const hz = 90 + 2.4 * sin(TAU * t / 53 + 0.7) + 1.2 * sin(TAU * t / 19.7);
  const lean = 0.3 * sin(TAU * t / 97 + 1.0) + 0.14 * sin(TAU * t / 41.3 + 2.0);
  const lc = cos(lean);
  const ls = sin(lean);
  const slide = 0.06 * sin(TAU * t / 57.3 + 0.4);
  const lut = P.skyLut;
  for (let i = 0; i < 256; i++) {
    ramp(SKY, i / 255, tmp);
    rgbToYcc(tmp[0], tmp[1], tmp[2], yc);
    const cb = yc[1] * lc - yc[2] * ls;
    const cr = yc[1] * ls + yc[2] * lc;
    lut[i * 3] = yc[0] + 1.402 * cr;
    lut[i * 3 + 1] = yc[0] - 0.344136 * cb - 0.714136 * cr;
    lut[i * 3 + 2] = yc[0] + 1.772 * cb;
  }
  // a broad glow on the horizon pulls the warm colours up the sky, and the bands tilt a little
  const gx = 32 + 22 * sin(TAU * t / 79 + 1.3) + 6 * sin(TAU * t / 31.9);
  const tilt = 0.1 * sin(TAU * t / 131 + 1.0);
  for (let y = 0; y < H; y++) {
    if (y + 0.5 >= hz) {
      ramp(GROUND, cl((y + 0.5 - hz) / (H - hz), 0, 1), tmp);
      skyRow[y * 3] = tmp[0];
      skyRow[y * 3 + 1] = tmp[1];
      skyRow[y * 3 + 2] = tmp[2];
    }
  }
  // positions
  const dp = DISCS.map((d) => {
    const g = (a) => a[0] + a[1] * sin(TAU * a[2] * t + a[3]) + a[4] * sin(TAU * a[5] * t + a[6]);
    return [g(d.x), g(d.y)];
  });
  const bcx = 32 + 17 * sin(TAU * t / 67 + 0.5) + 5 * sin(TAU * t / 23.1);
  const bcy = 56 + 22 * sin(TAU * t / 89 + 1.2) + 6 * sin(TAU * t / 29.3 + 3.0);
  const bang = 0.9 + TAU * t / 131 + 0.35 * sin(TAU * t / 43.7);
  const bc = cos(bang);
  const bs = sin(bang);
  const scx = 32 + 18 * sin(TAU * t / 73 + 2.2) + 4 * sin(TAU * t / 27.1);
  const scy = 84 + 20 * sin(TAU * t / 101 + 0.4) + 5 * sin(TAU * t / 33.7 + 1.0);
  const sph = 0.7 * t;

  for (let y = 0; y < H; y++) {
    const yy = y + 0.5;
    for (let x = 0; x < W; x++) {
      const xx = x + 0.5;
      let r;
      let g;
      let b;
      if (yy < hz) {
        const v = yy / hz;
        const dg = (xx - gx) / 24;
        const u = cl(v + slide + (0.2 * exp(-0.5 * dg * dg) + tilt * (xx - 32) / 32) * v * v, 0, 1);
        const li = floor(u * 255 + 0.5) * 3;
        r = lut[li];
        g = lut[li + 1];
        b = lut[li + 2];
        if (hz - yy < 1) {
          // the horizon is one soft row
          const gr = 1 - (hz - yy);
          r = mix(r, GROUND[0][1], gr);
          g = mix(g, GROUND[0][2], gr);
          b = mix(b, GROUND[0][3], gr);
        }
      } else {
        // the ground heaves slowly: soft bands of lighter teal run down it
        const sw = 1 + 0.3 * sin(TAU * (yy / 12 + 0.12 * sin(TAU * xx / 70 + t * 0.1)) - t * 0.42);
        r = skyRow[y * 3] * sw;
        g = skyRow[y * 3 + 1] * sw;
        b = skyRow[y * 3 + 2] * sw;
      }
      // discs: a soft glow outside, a soft edge, a hot core
      for (let i = 0; i < 4; i++) {
        const d = DISCS[i];
        const dx = xx - dp[i][0];
        const dy = yy - dp[i][1];
        const rr = d.r * 2.4;
        const d2 = dx * dx + dy * dy;
        if (d2 > rr * rr) continue;
        const dd = sqrt(d2);
        const halo = 0.22 * exp(-(dd * dd) / (d.r * d.r * 1.5));
        const body = sm(d.r * 1.35, d.r * 0.65, dd);
        const core = exp(-(dd * dd) / (d.r * d.r * 0.45));
        const a = max(halo, body);
        const w = 0.32 * core * body;
        r = mix(r, mix(d.c[0], 255, w), a);
        g = mix(g, mix(d.c[1], 255, w), a);
        b = mix(b, mix(d.c[2], 255, w), a);
      }
      // the bar: a hard edge, one LED of anti-aliasing
      {
        const dx = xx - bcx;
        const dy = yy - bcy;
        const u = dx * bc + dy * bs;
        const v = -dx * bs + dy * bc;
        const a = cl(0.5 + BAR.hl - abs(u), 0, 1) * cl(0.5 + BAR.hw - abs(v), 0, 1);
        if (a > 0) {
          r = mix(r, BAR.c[0], a);
          g = mix(g, BAR.c[1], a);
          b = mix(b, BAR.c[2], a);
        }
      }
      // the stripes: period 5.5 LED along x and y, so across the stripes it is 3.9 LED
      {
        const dx = (xx - scx) / 13;
        const dy = (yy - scy) / 16;
        const e = dx * dx + dy * dy;
        if (e < 1) {
          const a = 0.94 * sm(1, 0.55, e);
          const s = 0.5 + 0.5 * sin(TAU * (xx + yy) / 5.5 + sph);
          r = mix(r, mix(STRIPE_B[0], STRIPE_A[0], s), a);
          g = mix(g, mix(STRIPE_B[1], STRIPE_A[1], s), a);
          b = mix(b, mix(STRIPE_B[2], STRIPE_A[2], s), a);
        }
      }
      const p = y * W + x;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb0 = -0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr0 = 0.5 * r - 0.418688 * g - 0.081312 * b;
      Y[p] = lum;
      Cb[p] = (cb0 * ch - cr0 * sh) * CHROMA + 128;
      Cr[p] = (cb0 * sh + cr0 * ch) * CHROMA + 128;
    }
  }
}

// ---- the codec
function stepsFor(table, q, out) {
  const sc = q < 50 ? 5000 / q : 200 - 2 * q;
  for (let i = 0; i < 64; i++) out[i] = max(1, (table[i] * sc) / 100);
}

// Codes one plane in 8 by 8 blocks whose grid starts sx columns and sy rows before the plane,
// and writes the decoded plane. The edge is held at its last value where a block runs off the plane.
function codePlane(src, pw, ph, sx, sy, steps, dst, blk, tmp) {
  const nbx = ceil((pw + sx) / 8);
  const nby = ceil((ph + sy) / 8);
  for (let by = 0; by < nby; by++) {
    const y0 = by * 8 - sy;
    for (let bx = 0; bx < nbx; bx++) {
      const x0 = bx * 8 - sx;
      for (let j = 0; j < 8; j++) {
        const yy = cl(y0 + j, 0, ph - 1) * pw;
        for (let i = 0; i < 8; i++) blk[j * 8 + i] = src[yy + cl(x0 + i, 0, pw - 1)] - 128;
      }
      // along rows: tmp[j][u]
      for (let j = 0; j < 8; j++)
        for (let u = 0; u < 8; u++) {
          let s = 0;
          for (let i = 0; i < 8; i++) s += blk[j * 8 + i] * COS[u * 8 + i];
          tmp[j * 8 + u] = s;
        }
      // down columns, then quantise: blk[v][u]
      for (let v = 0; v < 8; v++)
        for (let u = 0; u < 8; u++) {
          let s = 0;
          for (let j = 0; j < 8; j++) s += tmp[j * 8 + u] * COS[v * 8 + j];
          const st = steps[v * 8 + u];
          blk[v * 8 + u] = round(s / st) * st;
        }
      // back: rows then columns
      for (let v = 0; v < 8; v++)
        for (let i = 0; i < 8; i++) {
          let s = 0;
          for (let u = 0; u < 8; u++) s += blk[v * 8 + u] * COS[u * 8 + i];
          tmp[v * 8 + i] = s;
        }
      for (let j = 0; j < 8; j++) {
        const yy = y0 + j;
        if (yy < 0 || yy >= ph) continue;
        for (let i = 0; i < 8; i++) {
          const xx = x0 + i;
          if (xx < 0 || xx >= pw) continue;
          let s = 0;
          for (let v = 0; v < 8; v++) s += tmp[v * 8 + i] * COS[v * 8 + j];
          dst[yy * pw + xx] = s + 128;
        }
      }
    }
  }
}

// one pass: 4:2:0, code, decode, back to 8 bit RGB
function onePass(P, sx, sy, cx, cy, rgb) {
  const { Y, Cb, Cr, hb, hr, dY, dhb, dhr } = P;
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const p = y * 2 * W + x * 2;
      hb[y * CW + x] = 0.25 * (Cb[p] + Cb[p + 1] + Cb[p + W] + Cb[p + W + 1]);
      hr[y * CW + x] = 0.25 * (Cr[p] + Cr[p + 1] + Cr[p + W] + Cr[p + W + 1]);
    }
  codePlane(Y, W, H, sx, sy, P.stepsY, dY, P.blk, P.tmp);
  codePlane(hb, CW, CH, cx, cy, P.stepsC, dhb, P.blk, P.tmp);
  codePlane(hr, CW, CH, cx, cy, P.stepsC, dhr, P.blk, P.tmp);
  for (let y = 0; y < H; y++) {
    const cyo = (y >> 1) * CW;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const l = dY[p];
      const cb = dhb[cyo + (x >> 1)] - 128;
      const cr = dhr[cyo + (x >> 1)] - 128;
      rgb[p * 3] = l + 1.402 * cr;
      rgb[p * 3 + 1] = l - 0.344136 * cb - 0.714136 * cr;
      rgb[p * 3 + 2] = l + 1.772 * cb;
    }
  }
}

function compute(P) {
  const [k1, k2, k3, k4] = P.k;
  const t = P.t;
  const hue = TAU * cl(k1, 0, 1);
  const qBase = 2.6 * pow(35, cl(k2, 0, 6) / 6);
  const q = cl(qBase * pow(2, 1.1 * swing(t)), 3.4, 98);
  const ox = round(cl(k3, 0, 7));
  const oy = round(0.6 * cl(k3, 0, 7));
  const passes = cl(k4, 1, 4);
  const whole = floor(passes + 1e-9);
  const frac = passes - whole;
  const need = frac > 1e-6 ? whole + 1 : whole;

  renderSource(P, t, hue);
  const { Y, Cb, Cr } = P;
  for (let p = 0; p < need; p++) {
    const gx = ox + 3 * p;
    const gy = oy + 5 * p;
    // each coding after the first is a little finer, so the layers of seams build up without every colour washing out
    const qp = min(98, q * pow(LATER, p));
    stepsFor(QL, qp, P.stepsY);
    stepsFor(QC, qp, P.stepsC);
    onePass(P, gx % 8, gy % 8, round((gx % 16) / 2) % 8, round((gy % 16) / 2) % 8, P.res[p]);
    if (p < need - 1) {
      const rgb = P.res[p];
      for (let i = 0; i < N; i++) {
        const r = rgb[i * 3];
        const g = rgb[i * 3 + 1];
        const b = rgb[i * 3 + 2];
        Y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        Cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
        Cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;
      }
    }
  }
  const a = P.res[whole - 1];
  const out = P.out;
  if (frac > 1e-6) {
    const b = P.res[whole];
    for (let i = 0; i < N * 3; i++) out[i] = a[i] + (b[i] - a[i]) * frac;
  } else {
    out.set(a);
  }
  P.q = q;
}

export function draw(display, P) {
  if (!P.out) return;
  compute(P);
  const out = P.out;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, out[o], out[o + 1], out[o + 2]);
    }
}
