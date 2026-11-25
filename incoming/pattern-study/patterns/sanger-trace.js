// ===== Patternflow pattern =====
// Title:   Sanger Trace
// Family:  chromatogram
// Idea:    The four-colour trace of a capillary DNA sequencer runs through the panel as one long tape wrapped into four rows: every base is a smooth filled peak in one of four dye colours, and each read opens with tall crisp peaks and ends in low wide humps that run into each other before a bare gap and the next read.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the electropherogram of dye-terminator Sanger sequencing on a capillary instrument (chain termination: Frederick Sanger and colleagues, 1977; four-dye fluorescent detection: Lloyd Smith, Leroy Hood and colleagues, 1986; both from memory); the tape wrapped into rows and the hashed reads that blur toward their ends are original, pattern round 252
// Round:   252
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Zoom=-1..1, Mix=0..1
//
// Knob 1: Hue. Turns the four dye colours round the wheel together; it opens on the textbook green, blue, amber and red, and half way round they are magenta, orange, blue and green.
// Knob 2: Speed. 0.2 to 3, opening at 2. How fast the tape slides from right to left and up through the rows, from about 2 LEDs a second to about 11.
// Knob 3: Zoom. -1 to 1, opening at 0. How many bases a row holds: five or six fat hills at -1, nine at 0, fifteen narrow peaks at 1.
// Knob 4: Mix. 0 to 1, opening at 0.06. How clean the template is: near 0 one sequence, and rising, a second copy shifted by one base grows under the first until at 1 every position carries two peaks and the baseline is noisy.

const W = 64, H = 128;
const { floor, min, max, sqrt, exp, sin, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const R = 4, RH = 32;         // rows of tape, and the height of one
const YB = 29;                // the baseline's place inside a row
const HMAX = 25;              // the tallest a trace stands, in LEDs
const NCOL = R * W;           // LEDs of tape on the panel
const NS = NCOL * 2 + 1;      // the traces are sampled every half LED
const MARG = 3.6;             // tape drawn beyond both ends, the reach of the widest peak (in bases)
const WARP = 0.38;            // how far the spacing has tightened by the end of a read
const HUES = [0.36, 0.615, 0.14, 0.985];   // A green, C blue, G amber, T red
const HSPREAD = [0, 0, 0.04, -0.14];        // amber and red stand close on the wheel, so turned into the greens or the violets they move apart

// a peak is drawn from its index alone, so it is the same peak in whichever row it stands
function hsh(a, b, s) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ s;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
// the base at place n of read j: a base repeats the one before it now and then, which gives runs of one colour
function baseOf(j, n, s) {
  let d = 0;
  while (d < 6 && hsh(j, n - d, s ^ 0x1b3) < 0.14) d++;
  return floor(hsh(j, n - d, s ^ 0x2c5) * 4);
}
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- a read -----------------------------------------------------------------------
// counted in bases: a few dye blobs, N peaks that tighten, a short tail and a bare gap
const RD = { n: 0, nb: 0, b0: 0, len: 0 };
function readOf(j, s) {
  RD.n = 60 + floor(70 * hsh(j, 1, s ^ 0x77));
  RD.nb = 3 + floor(2 * hsh(j, 2, s ^ 0x77));
  RD.b0 = 0.7 * RD.nb + 1.0;
  RD.len = RD.b0 + RD.n * (1 - WARP / 3) + 1.2 + 2.5 + 2.5 * hsh(j, 3, s ^ 0x77);
  return RD;
}
const zoomOf = (k3) => 7 * exp(-0.5 * cl(k3, -1, 1));    // LEDs per base

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    t: 0, seed: floor(Math.random() * 1e9) | 0,
    ri: 0, pos: 22 + 8 * Math.random(),      // the read under the left end of the tape, and the middle of the panel counted from that read's start
    z: 7,
    hh: new Float32Array(4 * NS),
    fb: new Float32Array(W * H * 3),
    col: new Float64Array(12), fil: new Float64Array(4),
  });
  return st;
}

function step(st, dt) {
  const k = st.k, ks = st.ks;
  const a = 1 - exp(-dt / 0.25);
  for (let i = 0; i < 4; i++) ks[i] += (k[i] - ks[i]) * a;
  st.t += dt;
  const z = (st.z = zoomOf(ks[2]));
  const v = 1.2 + 3.4 * cl(ks[1], 0.2, 3);       // LEDs a second
  st.pos += v * dt / z;
  // keep count from the read that holds the left end of what is drawn
  const half = NCOL / 2 / z + MARG;
  let guard = 0;
  while (guard++ < 40 && st.pos - half > readOf(st.ri, st.seed).len) { st.pos -= RD.len; st.ri++; }
  while (guard++ < 40 && st.pos - half < 0) { st.ri--; st.pos += readOf(st.ri, st.seed).len; }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    step(st, 0);
  }
  if (dt > 0) step(st, dt);
}

// ---- the traces -------------------------------------------------------------------
// one Gaussian into the trace of dye c: centre and width in LEDs along the tape
function add(hh, c, x, sg, amp) {
  const j0 = max(0, Math.ceil((x - 3.6 * sg) * 2)), j1 = min(NS - 1, floor((x + 3.6 * sg) * 2));
  const o = c * NS, q = -0.5 / (sg * sg);
  for (let j = j0; j <= j1; j++) {
    const d = j * 0.5 - x;
    hh[o + j] += amp * exp(q * d * d);
  }
}
// signal strength drifts along the tape, each dye on its own beat
const gain = (c, u, t, rp) => 1 + 0.15 * sin(0.31 * u + 0.23 * t + rp + 1.7 * c) + 0.1 * sin(0.127 * u - 0.151 * t + 1.3 * rp + 2.9 * c) + 0.09 * sin(0.53 * u + 0.83 * t + 0.7 * rp + 4.1 * c);

function build(st) {
  const hh = st.hh, z = st.z, t = st.t, s = st.seed;
  hh.fill(0);
  const m = cl(st.ks[3], 0, 1);
  const half = NCOL / 2 / z + MARG, mid = NCOL / 2;
  const amp = 1 / (1 + 0.25 * m);
  let j = st.ri, o = -st.pos;
  for (let g = 0; g < 8 && o < half; g++, j++) {
    const rd = readOf(j, s), N = rd.n, NB = rd.nb, b0 = rd.b0, len = rd.len;
    const lo = -half - o, hi = half - o;        // the part of this read that is on the panel
    const rp = TP * hsh(j, 4, s ^ 0x77);
    // dye blobs at the start of the read
    for (let n = 0; n < NB; n++) {
      const u = 0.6 + 0.7 * n + 0.3 * (hsh(j, n, s ^ 0x51) - 0.5);
      if (u < lo || u > hi) continue;
      const c = floor(hsh(j, n, s ^ 0x52) * 4);
      add(hh, c, (o + u) * z + mid, (0.4 + 0.3 * hsh(j, n, s ^ 0x53)) * z, amp * (0.3 + 0.45 * hsh(j, n, s ^ 0x54)) * gain(c, u, t, rp));
    }
    // the bases: wider and lower as the read goes on, and closer together
    for (let n = 0; n < N; n++) {
      const q = n / N;
      const u0 = b0 + n - WARP * N * q * q * q / 3;
      if (u0 < lo - 0.2 || u0 > hi + 0.2) continue;
      const u = u0 + 0.2 * (1 - WARP * q * q) * (hsh(j, n, s ^ 0x61) - 0.5);
      const sg = max(1.25, 0.25 * (1 + 1.7 * pow(q, 2.2)) * (0.9 + 0.2 * hsh(j, n, s ^ 0x62)) * z);
      const a = amp * (1 - 0.52 * pow(q, 1.8)) * min(1, (N - n) / 4);
      const lw = 0.5 - 0.35 * q * q, pw = 1 + q * q;       // heights grow more uneven as the read goes on
      const x = (o + u) * z + mid;
      const c = baseOf(j, n, s);
      add(hh, c, x, sg, a * (lw + (1 - lw) * pow(hsh(j, n, s ^ 0x63), pw)) * gain(c, u, t, rp));
      if (m > 0.004) {
        // the second template: the same sequence one base on, under the first
        const c2 = baseOf(j, n + 1, s);
        add(hh, c2, x + 0.14 * z * (hsh(j, n, s ^ 0x64) - 0.5), sg, a * m * (lw + (1 - lw) * pow(hsh(j, n + 1, s ^ 0x63), pw)) * gain(c2, u + 40, t, rp));
      }
    }
    // baseline noise, small bumps two to a base
    if (m > 0.004) {
      const k0 = max(0, floor(lo * 2)), k1 = min(floor(len * 2) - 1, floor(hi * 2));
      for (let k = k0; k <= k1; k++) {
        const u = (k + hsh(j, k, s ^ 0x71)) * 0.5, e = hsh(j, k, s ^ 0x72);
        add(hh, floor(hsh(j, k, s ^ 0x73) * 4), (o + u) * z + mid, (0.25 + 0.2 * hsh(j, k, s ^ 0x74)) * z, 0.1 * m * e * e);
      }
    }
    o += len;
  }
  // heights in LEDs, with a soft ceiling
  for (let i = 0; i < 4 * NS; i++) {
    const v = hh[i];
    hh[i] = HMAX * (v <= 0.75 ? v : 0.75 + 0.25 * (1 - exp(-(v - 0.75) / 0.25)));
  }
}

// ---- drawing ----------------------------------------------------------------------
const tmp = [0, 0, 0];
const ch = [0, 0, 0, 0], ci = [0, 0, 0, 0], cf = [0, 0, 0, 0];

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  build(st);
  const hh = st.hh, fb = st.fb, col = st.col, fil = st.fil;
  const turn = sin(PI * st.ks[0]);
  for (let c = 0; c < 4; c++) {
    const hue = st.ks[0] + HUES[c] + HSPREAD[c] * turn * turn;
    hsv(hue, 0.96, 1, tmp);
    // blue and violet are dark on an LED, so they lift a little
    const Y = 0.299 * tmp[0] + 0.587 * tmp[1] + 0.114 * tmp[2];
    const lift = max(0, 0.45 - Y) * 0.6;
    col[c * 3] = min(1, tmp[0] + lift); col[c * 3 + 1] = min(1, tmp[1] + lift); col[c * 3 + 2] = min(1, tmp[2] + lift);
    // a dim amber reads as brown on the panel, so the fill under an amber or orange trace is kept brighter
    const wa = 0.5 + 0.5 * Math.cos(TP * (hue - 0.11));
    fil[c] = 0.4 + 0.2 * wa * wa * wa;
  }
  fb.fill(0);
  for (let r = 0; r < R; r++) {
    const yb = r * RH + YB;
    for (let x = 0; x < W; x++) {
      const i = r * W + x;
      let top = 0, pres = 0, hm = 0;
      let br = 1, bg = 1, bb = 1;
      for (let c = 0; c < 4; c++) {
        const o = c * NS + 2 * i;
        const h = hh[o + 1], sl = hh[o + 2] - hh[o];
        const inv = 1 / sqrt(1 + sl * sl);
        ch[c] = h; ci[c] = inv;
        const reach = h + 0.5 / inv;
        if (reach > top) top = reach;
        if (h > hm) hm = h;
      }
      for (let c = 0; c < 4; c++) {
        // the tallest trace in a column fills at full strength and a lower one under it more faintly,
        // so a peak keeps its own colour and only feet of like height mix
        const d = ch[c] / (hm + 1e-6);
        cf[c] = fil[c] * (0.25 + 0.75 * d * d);
        const p = sstep(0.15, 1.4, ch[c]), w = 0.8 * cf[c] * p;
        if (p > pres) pres = p;
        br *= 1 - col[c * 3] * w; bg *= 1 - col[c * 3 + 1] * w; bb *= 1 - col[c * 3 + 2] * w;
      }
      // the baseline: dim where the tape is bare, the dye colour under a peak
      let f = (yb * W + x) * 3;
      fb[f] = 1 - br + 0.2 * (1 - pres); fb[f + 1] = 1 - bg + 0.23 * (1 - pres); fb[f + 2] = 1 - bb + 0.32 * (1 - pres);
      const ny = min(YB, Math.ceil(top + 0.5));
      for (let k = 1; k <= ny; k++) {
        const yy = k - 0.5;
        let pr = 1, pg = 1, pb = 1;
        for (let c = 0; c < 4; c++) {
          const dp = (ch[c] - yy) * ci[c];           // depth under the curve, measured square to it
          if (dp <= -0.5) continue;
          const cov = dp >= 0.5 ? 1 : dp + 0.5;
          const edge = 1 - sstep(0.5, 1.9, dp);
          const lv = cov * (cf[c] + (1 - cf[c]) * edge) * (0.5 + 0.5 * sstep(0.4, 4, ch[c]));
          // light adds, and where four fills lie on each other it saturates softly
          pr *= 1 - col[c * 3] * lv; pg *= 1 - col[c * 3 + 1] * lv; pb *= 1 - col[c * 3 + 2] * lv;
        }
        f = ((yb - k) * W + x) * 3;
        fb[f] = 1 - pr; fb[f + 1] = 1 - pg; fb[f + 2] = 1 - pb;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const f = (y * W + x) * 3;
      display.setPixel(x, y, (fb[f] * 255 + 0.5) | 0, (fb[f + 1] * 255 + 0.5) | 0, (fb[f + 2] * 255 + 0.5) | 0);
    }
  }
}
