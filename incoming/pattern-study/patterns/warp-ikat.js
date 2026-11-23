// ===== Patternflow pattern =====
// Title:   Warp Ikat
// Family:  ikat
// Idea:    A length of warp-ikat cloth coming off the loom down a vertical warp of 64 threads, with diamonds, slanted bars, zigzags and blocks dyed in the bundle before weaving, so that every thread carries its own small error in where its dye stopped and every edge of every motif is a feathered comb, while now and then a tied bundle slips a few LEDs along the warp and one thread across.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: warp ikat, where the warp is tied, resist-dyed in the bundle and woven afterwards, so that the misregistration of the threads is the look of the cloth (Indonesian, Central Asian and Japanese kasuri cloths, from memory), original, pattern round 226
// Round:   226
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Weave=0.2..3, Size=-1..1, Slip=-1..1
//
// Knob 1: Hue. Turns the four dyes together round the wheel and comes back at 1. At 0 they are ivory, ochre, madder red and indigo; at 0.25 pale green, green, olive and plum; at 0.5 pale blue, blue, teal and dark gold; at 0.75 pale pink, magenta, violet and forest green.
// Knob 2: Weave. How fast the cloth is taken up, 1.1 LEDs a second per unit with a pace that wanders 25 percent either way: 0.22 LEDs a second at 0.2, a panel height in about 10 minutes; 2.2 at 2 where it opens, a panel height in 58 s; 3.3 at 3, in 39 s.
// Knob 3: Size. The width of one cell of the lattice, 14 LEDs times 1.6 to the power K: 8.8 LEDs at -1, 14 at 0 where it opens, 22 at 1, with each stretch of cloth 10 percent narrower to 15 percent wider than that and its cells 0.85 to 1.45 times as tall. The border stripes and the dots grow with it.
// Knob 4: Slip. How far each thread's dye lands from where it should, A = 2.8 times ((K + 1) / 2) to the 0.9 LEDs: 0 at -1, where every edge is a knife and no bundle slips; 1.6 at 0.06 where it opens, the edge of a motif spread over 2 LEDs for nine threads in ten and 3.4 at the extremes; 2.8 at 1, 4 LEDs and 6 at the extremes. The slipped bundles move with it.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, sin, abs, min, max, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm3 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const fr = (t) => t - floor(t);
const SEED = 226226;

// The cloth is a function of one cloth coordinate q along the warp (q = y + 0.5 - S, where S is how far the
// weaving has gone) and of the thread x. Nothing is stored along the cloth, so it never runs out and never comes round.
const ZL = 72;     // zones of cloth run 0.45 to 1.55 of this many LEDs, each with its own motif and dyes
const EL = 110;    // one chance of a slipped bundle in each block of this many LEDs
const WLEN = 31;   // wavelength of the slow walk of a thread's own misregistration, LEDs

// Ivory, ochre, madder, indigo.
const BASE = [[212, 200, 174], [208, 150, 50], [164, 42, 48], [30, 46, 122]];
// Ground, then the three dyes laid over it: big figure, inner figure, centre.
const SCH = [
  [0, 3, 2, 1], [0, 2, 3, 0], [3, 0, 2, 1], [3, 0, 1, 2], [0, 3, 1, 2],
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(a, b, s) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth noise along t for lane a, -1 to 1.
function vn(a, t, s) {
  const i = floor(t), f = sm3(t - i);
  const v0 = hash(a, i, s), v1 = hash(a, i + 1, s);
  return 2 * (v0 + (v1 - v0) * f) - 1;
}

// Turn a colour round the wheel by `turn` of a full circle.
function spin(r, g, b, turn, out, o) {
  r /= 255; g /= 255; b /= 255;
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  const s = mx > 0 ? d / mx : 0;
  h = (h + turn) % 1;
  if (h < 0) h += 1;
  const i = floor(h * 6), f = h * 6 - i;
  const p = mx * (1 - s), q = mx * (1 - f * s), t = mx * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? mx : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? mx : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? mx : k === 2 ? t : k === 5 ? q : p) * 255;
}

function palette(P, turn) {
  P.hc = turn;
  for (let i = 0; i < 4; i++) spin(BASE[i][0], BASE[i][1], BASE[i][2], turn, P.pal, i * 3);
}

// One zone of cloth: a motif, a set of dyes, a size factor, a border of stripes.
function makeZone(P, k) {
  const h = (j) => hash(k, j, P.salt);
  const z = { zs: k * ZL + 0.55 * ZL * h(1) };
  const tr = h(2);
  z.type = tr < 0.34 ? 0 : tr < 0.58 ? 1 : tr < 0.84 ? 2 : 3;
  const sr = h(3);
  z.sch = SCH[sr < 0.32 ? 0 : sr < 0.46 ? 1 : sr < 0.6 ? 4 : sr < 0.82 ? 2 : 3];
  z.asp = 0.85 + 0.6 * h(4);
  z.amp = 0.3 + 0.35 * h(5);
  z.n = h(6) < 0.5 ? 2 : 3;
  z.border = h(7) < 0.7;
  z.px = h(8) < 0.5 ? 0 : 0.5;
  z.cwm = 0.9 + 0.25 * h(9);
  return z;
}

function zoneAt(P, s) {
  const k = floor(s / ZL);
  let z = P.zones.get(k);
  if (!z) {
    if (P.zones.size > 48) P.zones.clear();
    z = makeZone(P, k);
    P.zones.set(k, z);
  }
  if (s >= z.zs) return z;
  const k1 = k - 1;
  let z1 = P.zones.get(k1);
  if (!z1) {
    z1 = makeZone(P, k1);
    P.zones.set(k1, z1);
  }
  return z1;
}

// Border stripes, in units u of a LED: start, end for each dye.
const BS = [[1.6, 5.4], [7.4, 10.4], [12.4, 15.6]];
const stripe = (y, a, b, w) => sm3((y - a) / w + 0.5) * sm3((b - y) / w + 0.5);

// Soft edge: 1 where t > D, 0 where t < D, over a width 2w in D.
const edge = (t, D, w) => sm3((t - D) / (2 * w) + 0.5);

export function setup(P) {
  P.rand = rng(SEED);
  P.salt = floor(P.rand() * 1e9);
  P.t = 0;
  P.hc = -9;
  P.pal = new Float32Array(12);
  P.zones = new Map();
  P.A = 1.7;
  P.cw = 14;
  P.sp = 2;
  // Per thread: its own misregistration (smoothed a little across neighbours), a offset for each dye, a grain.
  const r = new Float32Array(W + 2);
  for (let i = 0; i < W + 2; i++) r[i] = 2 * P.rand() - 1;
  P.b0 = new Float32Array(W);
  for (let x = 0; x < W; x++) P.b0[x] = cl(0.62 * r[x + 1] + 0.19 * (r[x] + r[x + 2]), -1, 1) * 1.15;
  P.bl = new Float32Array(W * 3);
  for (let i = 0; i < W * 3; i++) P.bl[i] = 2 * P.rand() - 1;
  P.tb = new Float32Array(W);
  for (let x = 0; x < W; x++) P.tb[x] = 1 + 0.035 * (2 * P.rand() - 1);
  // Open on a stretch of ivory cloth with diamonds on it, a join just above the top of the panel.
  P.S = 0;
  for (let k = 0; k < 200; k++) {
    const z = makeZone(P, k), z1 = makeZone(P, k + 1);
    if (z.type === 0 && z.sch[0] === 0 && z.border && z1.zs - z.zs >= 76) {
      P.S = 3 - z.zs;
      break;
    }
  }
  P.evy = new Float32Array(NPX);
  P.evx = new Int8Array(NPX);
  P.row = new Float32Array(H * 4);
  P.col = new Float32Array(3);
  P.col2 = new Float32Array(3);
}

export function update(dt, input, P) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  if (abs(k[0] - P.hc) > 1e-4) palette(P, k[0]);
  P.t += d;
  const t = P.t;
  // The loom's pace wanders a little on clocks that do not divide one another.
  const pace = 1 + 0.12 * sin(t * 0.37 + 1.1) + 0.08 * sin(t * 0.173 + 4.0) + 0.05 * sin(t * 0.0911 + 2.3);
  P.S += d * 1.1 * k[1] * pace;
  P.cw = 14 * pow(1.6, k[2]);
  const u = cl((k[3] + 1) / 2, 0, 1);
  P.A = 2.8 * pow(u, 0.9);

  // Per row: the weft, and how the lattice breathes along the cloth.
  const row = P.row;
  for (let y = 0; y < H; y++) {
    const q = y + 0.5 - P.S;
    row[y * 4] = 1 + 0.04 * sin(q * 2.03 + 0.7) + 0.03 * sin(q * 1.19 + 2.1) + 0.04 * vn(0, q / 8.9, P.salt);
    row[y * 4 + 1] = 1 + 0.1 * sin(q * 2 * PI / 97 + 0.4) + 0.07 * sin(q * 2 * PI / 163 + 2.6) + 0.05 * sin(q * 2 * PI / 241 + 1.3);
    row[y * 4 + 2] = 0.1 * sin(q * 2 * PI / 131 + 1.9) + 0.07 * sin(q * 2 * PI / 211 + 0.3) + 0.05 * sin(q * 2 * PI / 317 + 4.4);
  }

  // Bundles that slip: a run of neighbouring threads whose dye lands a few LEDs off along the cloth and one thread
  // over across it, for a stretch of cloth.
  P.evy.fill(0);
  P.evx.fill(0);
  const A = P.A;
  const qTop = 0.5 - P.S, qBot = H + 0.5 - P.S;
  for (let kb = floor(qTop / EL) - 2; kb <= floor(qBot / EL); kb++) {
    const h = (j) => hash(kb, j, P.salt + 77);
    if (h(0) > 0.8) continue;
    const st = kb * EL + EL * 0.9 * h(1), len = 28 + 50 * h(2);
    const i0 = floor(h(3) * W), wid = 5 + floor(10 * h(4));
    const dy = (h(5) < 0.5 ? -1 : 1) * (3 + 3 * h(6)) * cl(A / 2, 0, 1.2);
    const dx = (h(7) < 0.5 ? -1 : 1) * (h(8) < 0.65 ? 1 : 2);
    for (let y = 0; y < H; y++) {
      const q = y + 0.5 - P.S;
      if (q < st || q > st + len) continue;
      const env = sm3((q - st) / 8) * sm3((st + len - q) / 8);
      for (let x = i0; x < min(W, i0 + wid); x++) {
        P.evy[y * W + x] += dy * env;
        if (env > 0.5 && A > 0.3) P.evx[y * W + x] = dx;
      }
    }
  }
}

// The colour of one zone at depth ys into it, thread offset xl LEDs from the middle. d1..d3 are the extra
// offsets of the three dyes. Writes into out.
function zoneColor(P, z, xl, ys, d1, d2, d3, mxs, yw, rel, out) {
  const pal = P.pal, sch = z.sch;
  const cwz = P.cw * z.cwm * mxs, chz = cwz * z.asp;
  const u = cwz / 16;
  const bw = z.border ? 17.5 * u : 0;
  const X = xl / cwz + z.px;
  let r = pal[sch[0] * 3], g = pal[sch[0] * 3 + 1], b = pal[sch[0] * 3 + 2];
  const type = z.type;
  const tx = abs(fr(X + 0.5) - 0.5) * 2;
  const wd = 0.65 * sqrt(1 / (cwz * cwz) + 1 / (chz * chz));
  const ci = floor(X + 0.5);
  const fx = abs(X - ci);
  for (let m = 1; m <= 3; m++) {
    const ym = ys + (m === 1 ? d1 : m === 2 ? d2 : d3);
    let mask = 0;
    const lb = ym - bw;
    // border stripes
    if (ym - rel < bw) mask = stripe(ym - rel, BS[m - 1][0] * u, BS[m - 1][1] * u, 0.8);
    const gate = sm3(lb / 1.5 + 0.5);
    if (gate > 0) {
      const Y = lb / chz + 0.5 + yw;
      const ty = abs(fr(Y + 0.5) - 0.5) * 2;
      let lm = 0;
      if (type === 0) {
        const D = (tx + ty) * 0.5;
        lm = m === 1 ? edge(0.46, D, wd) : m === 2 ? edge(0.27, D, wd) : max(edge(0.11, D, wd), edge(D, 0.8, wd));
      } else if (type === 1) {
        // slanted bars: stripes that lean one way across a cell of cloth, cut off square at each end, each row a step over
        const f = fr(Y), sl = z.amp + 0.5;
        const dd = abs(fr(X + sl * (f - 0.5) + 0.25 * floor(Y)) - 0.5);
        const wz = 0.65 * sqrt(1 / (cwz * cwz) + (sl / chz) * (sl / chz));
        const gy = sm3((f - 0.1) * chz / 1.4 + 0.5) * sm3((0.9 - f) * chz / 1.4 + 0.5);
        lm = gy * (m === 1 ? edge(0.27, dd, wz) : m === 2 ? edge(0.1, dd, wz) : 0);
      } else if (type === 2) {
        const tz = abs(fr(Y) - 0.5) * 2;
        const uu = X + z.amp * (tz - 0.5);
        const dd = abs(fr(uu) - 0.5);
        const wz = 0.65 * sqrt(1 / (cwz * cwz) + (2 * z.amp / chz) * (2 * z.amp / chz));
        lm = m === 1 ? edge(0.27, dd, wz) : m === 2 ? edge(0.1, dd, wz) : 0;
      } else {
        const fy = abs(fr(Y + 0.5 * (ci & 1)) - 0.5);
        const Dr = max(fx, fy) * 2;
        const wr = 0.65 * 2 * max(1 / cwz, 1 / chz);
        lm = m === 1 ? edge(0.62, Dr, wr) : m === 2 ? edge(0.3, Dr, wr) : 0;
      }
      mask = max(mask, lm * gate);
    }
    if (mask > 0) {
      const c = sch[m];
      r += (pal[c * 3] - r) * mask;
      g += (pal[c * 3 + 1] - g) * mask;
      b += (pal[c * 3 + 2] - b) * mask;
    }
  }
  out[0] = r; out[1] = g; out[2] = b;
}

export function draw(display, P) {
  const { b0, bl, tb, row, evy, evx, col } = P;
  const A = P.A, S = P.S;
  const fe = A / 4; // how far the dyes of one thread drift from each other, as the slip rises
  for (let y = 0; y < H; y++) {
    const q = y + 0.5 - S;
    const wf = row[y * 4], mxs = row[y * 4 + 1], yw = row[y * 4 + 2];
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const wk = vn(x + 100, q / WLEN, P.salt);
      const dth = A * (b0[x] + 0.3 * wk), rel = 0.55 * dth;
      const d0 = dth + evy[p];
      const s0 = q + d0;
      const z = zoneAt(P, s0);
      const xl = x + 0.5 - 32 + evx[p];
      const ys = s0 - z.zs;
      const d1 = bl[x * 3] * fe, d2 = bl[x * 3 + 1] * fe, d3 = bl[x * 3 + 2] * fe;
      // Across a join between zones the two colours trade over about 2 LEDs, so the join is soft on every thread.
      const zn = zoneAt(P, s0 + 0.9);
      let zA = z, zB = z, w = 1;
      if (zn.zs !== z.zs) { zB = zn; w = sm3((s0 - zn.zs) / 1.8 + 0.5); }
      else if (ys < 0.9) { zA = zoneAt(P, z.zs - 0.01); w = sm3(ys / 1.8 + 0.5); }
      zoneColor(P, zB, xl, s0 - zB.zs, d1, d2, d3, mxs, yw, rel, col);
      let r = col[0], g = col[1], b = col[2];
      if (zA.zs !== zB.zs) {
        const c2 = P.col2;
        zoneColor(P, zA, xl, s0 - zA.zs, d1, d2, d3, mxs, yw, rel, c2);
        r = c2[0] + (r - c2[0]) * w; g = c2[1] + (g - c2[1]) * w; b = c2[2] + (b - c2[2]) * w;
      }
      const f = wf * tb[x] * (1 + 0.03 * wk);
      r *= f; g *= f; b *= f;
      display.setPixel(x, y, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
    }
  }
}
