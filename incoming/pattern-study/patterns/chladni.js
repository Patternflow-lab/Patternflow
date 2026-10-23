// ===== Patternflow pattern =====
// Title:   Chladni
// Family:  wave
// Idea:    Sand on a tall metal plate jumps off the vibrating parts and settles on the still nodal lines, and every few seconds the plate is bowed into a new mode and the sand scatters to find the new figure.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ernst Chladni, Entdeckungen über die Theorie des Klanges (1787); the powder heaps from Michael Faraday, On a peculiar class of acoustical figures (1831)
// Round:   16
// ===============================
// @matrix 64x128
// @knobs Plate=0..1, Drive=0.8..3, Pitch=-1..1, Powder=0..1
//
// Knob 1: Plate. What the plate is made of: brass at 0, then copper, blued steel and black glass, each with the sand that shows best on it; between copper and steel it passes the purple of tempered steel.
// Knob 2: Drive. How hard the plate is bowed. Sand only jumps where the plate throws it harder than gravity, so at the bottom only the antinodes clear and the lines lie in broad soft bands; at 2 a figure gathers in about a second; at the top the lines come out thin and hard.
// Knob 3: Pitch. Which register the bow plays in, 1.4 octaves either way: low notes make two or three big curves, high notes a dense lace of small cells.
// Knob 4: Powder. How much of what is on the plate is lycopodium powder instead of sand: the air the plate pumps carries the powder the other way, into round yellow heaps on the antinodes, as Faraday found.
// Buttons: K1 tap draws the bow again now: the sand jumps up and finds the figure of another mode in the same register.

const W = 64;
const H = 128;
const N = W * H;
const GRAINS = 4000;
// One period of cosine in a table, so a grain's displacement is four lookups.
const TAB = 4096;
const MASK = TAB - 1;
const QUARTER = TAB / 4;
const COS = new Float32Array(TAB);
for (let i = 0; i < TAB; i++) COS[i] = Math.cos((2 * Math.PI * i) / TAB);
// 1 - exp(-c) for a grain count c in steps of 1/16: how much of an LED the sand hides.
const COVER = new Float32Array(257);
for (let i = 0; i <= 256; i++) COVER[i] = 1 - Math.exp(-0.55 * (i / 16));
// How long a figure stands before the next bow stroke, in seconds.
const HOLD = 5;

// Modes of a free plate twice as tall as it is wide. A free edge does not hold
// the plate still, so each standing wave is cos(p pi x / 64) cos(q pi y / 128).
// That is the usual approximation; the note of such a wave goes up with
// (p/64)^2 + (q/128)^2, so on this plate two waves sound the same note when
// 4p^2 + q^2 is the same number, and a plate bowed at that note rings with both
// at once, added or taken away. The sum is what draws a Chladni figure. On a
// square plate the pairs are (p, q) and (q, p); matched to the 1:2 plate
// instead, the cells of the figure come out as tall as they are wide.
// Each row: that number, then p and q of the first wave and of the second.
const MODES = [
  [25, 0, 5, 2, 3],
  [36, 0, 6, 3, 0],
  [40, 1, 6, 3, 2],
  [52, 2, 6, 3, 4],
  [64, 0, 8, 4, 0],
  [65, 2, 7, 4, 1],
  [68, 1, 8, 4, 2],
  [80, 2, 8, 4, 4],
  [85, 1, 9, 3, 7],
  [100, 3, 8, 4, 6],
  [100, 0, 10, 4, 6],
  [104, 1, 10, 5, 2],
  [116, 2, 10, 5, 4],
  [125, 1, 11, 5, 5],
  [136, 3, 10, 5, 6],
  [145, 4, 9, 6, 1],
  [148, 1, 12, 6, 2],
  [160, 2, 12, 6, 4],
  [164, 4, 10, 5, 8],
  [169, 0, 13, 6, 5],
  [180, 3, 12, 6, 6],
  [185, 2, 13, 4, 11],
  [200, 5, 10, 7, 2],
  [205, 3, 13, 7, 3],
  [208, 4, 12, 6, 8],
  [212, 2, 14, 7, 4],
  [221, 5, 11, 7, 5],
  [225, 0, 15, 6, 9],
  [232, 3, 14, 7, 6],
  [244, 5, 12, 6, 10],
];

// Plates, each with the sand that reads on it: the plate's colour at full light,
// the sand's colour, how much light the plate gives back, and how sharply it
// mirrors the window. Glass is darker than metal and the glossiest of the four.
const PLATES = [
  [[255, 196, 92], [238, 232, 212], 0.13, 1], // brass, quartz sand
  [[255, 128, 80], [242, 240, 232], 0.13, 1], // copper, white sand
  [[90, 135, 255], [246, 214, 150], 0.14, 0.9], // blued steel, golden sand
  [[140, 160, 185], [250, 250, 248], 0.09, 1.5], // black glass, chalk-white sand
];
// The grains are not all one colour: mostly clear quartz, some cream, a few amber and grey.
const TINTS = [
  [1, 1, 1],
  [1, 0.94, 0.8],
  [0.96, 0.8, 0.56],
  [0.78, 0.78, 0.76],
];
// Lycopodium spores, the club-moss powder Faraday used, sulphur yellow.
const POWDER = [236, 212, 92];

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix + seed, iy);
  const b = hash(ix + 1 + seed, iy);
  const c = hash(ix + seed, iy + 1);
  const d = hash(ix + 1 + seed, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function setup(params) {
  params.gx = new Float32Array(GRAINS);
  params.gy = new Float32Array(GRAINS);
  params.hop = new Float32Array(GRAINS);
  params.tint = new Uint8Array(GRAINS);
  // Each grain draws a number once: grains under the Powder knob are powder.
  params.kind = new Float32Array(GRAINS);
  for (let i = 0; i < GRAINS; i++) {
    params.gx[i] = Math.random() * W;
    params.gy[i] = Math.random() * H;
    const r = Math.random();
    params.tint[i] = r < 0.55 ? 0 : r < 0.82 ? 1 : r < 0.93 ? 2 : 3;
    params.kind[i] = Math.random();
  }
  params.cnt = new Float32Array(N);
  params.sr = new Float32Array(N);
  params.sg = new Float32Array(N);
  params.sb = new Float32Array(N);
  params.pw = new Float32Array(N);
  params.cov = new Float32Array(N);
  params.slope = new Float32Array(N);
  params.amp2 = new Float32Array(N);
  params.up = new Int32Array(N);
  params.peak = new Int32Array(N);
  params.lum = new Float32Array(N);
  params.sheen = new Float32Array(N);
  bakePlate(params);
  params.mode = -1;
  params.sign = 1;
  params.since = 0;
  // The plate has been sprinkled; the first stroke comes a moment after it shows.
  params.next = 0.15;
  params.amp = 2;
  params.plate = 0;
  params.powder = 0.06;
}

// The plate's own light, the same whatever it is made of: fine brushing along
// its width, a soft window reflection running down it, and the bevel of the edge.
function bakePlate(params) {
  const lum = params.lum;
  const sheen = params.sheen;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // Brushed: streaks 10 to 20 LEDs long across the plate, a row or two tall.
      const brush = vnoise(x / 14, y / 1.3, 11) * 0.6 + vnoise(x / 5, y / 0.8, 37) * 0.4;
      let l = 1 + 0.09 * (brush - 0.5) * 2;
      // The whole plate a little lighter at the top, where it faces the window.
      l *= 1.12 - 0.24 * (y / H);
      // The edge catches light along the top and the left and falls into shadow on the other two.
      if (y === 0 || x === 0) l *= 1.9;
      else if (y === H - 1 || x === W - 1) l *= 0.5;
      lum[i] = l;
      // The window: a broad band leaning down the length of the plate, split by
      // the dark bar of the sash.
      const d = (x - 30) * 0.9 + (y - 64) * 0.3;
      const bar = 1 - 0.55 * Math.exp(-((d - 2) * (d - 2)) / 4);
      sheen[i] = (0.17 * Math.exp(-(d * d) / 300) + 0.1 * Math.exp(-(d * d) / 40)) * bar;
    }
}

function pickMode(params, k3) {
  // Pitch moves the middle of the register an octave and a half each way;
  // the note of a plate mode goes with that number, so an octave doubles it.
  const centre = 85 * Math.pow(2, 1.4 * k3);
  const band = [];
  for (let m = 0; m < MODES.length; m++) {
    const o = Math.abs(Math.log2(MODES[m][0] / centre));
    if (o < 0.38 && m !== params.mode) band.push(m);
  }
  if (band.length === 0) {
    // At the ends of the range take the nearest modes.
    let best = 0;
    for (let m = 0; m < MODES.length; m++) if (Math.abs(Math.log2(MODES[m][0] / centre)) < Math.abs(Math.log2(MODES[best][0] / centre))) best = m;
    band.push(best);
  }
  const m = band[Math.floor(Math.random() * band.length)];
  params.mode = m;
  params.sign = Math.random() < 0.5 ? 1 : -1;
  const row = MODES[m];
  // Table steps per LED for each of the four cosines.
  params.ax = (row[1] * TAB) / (2 * W);
  params.ay = (row[2] * TAB) / (2 * H);
  params.bx = (row[3] * TAB) / (2 * W);
  params.by = (row[4] * TAB) / (2 * H);
  // The wavenumber in radians per LED, the same for both waves of a pair.
  params.k = (Math.PI / H) * Math.sqrt(row[0]);
  // How steep the plate is at each LED, for the reflection it smears, and how
  // hard it swings there, for the powder.
  const slope = params.slope;
  const amp = params.amp2;
  const s = params.sign;
  const inv = 1 / params.k;
  const kax = (row[1] * Math.PI) / W;
  const kay = (row[2] * Math.PI) / H;
  const kbx = (row[3] * Math.PI) / W;
  const kby = (row[4] * Math.PI) / H;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const X = x + 0.5;
      const Y = y + 0.5;
      const ca = COS[(params.ax * X) & MASK];
      const sa = COS[((params.ax * X) - QUARTER) & MASK];
      const cb = COS[(params.ay * Y) & MASK];
      const sb = COS[((params.ay * Y) - QUARTER) & MASK];
      const cc = COS[(params.bx * X) & MASK];
      const sc = COS[((params.bx * X) - QUARTER) & MASK];
      const cd = COS[(params.by * Y) & MASK];
      const sd = COS[((params.by * Y) - QUARTER) & MASK];
      const dx = -kax * sa * cb - s * kbx * sc * cd;
      const dy = -kay * ca * sb - s * kby * cc * sd;
      slope[y * W + x] = Math.sqrt(dx * dx + dy * dy) * inv * 0.5;
      amp[y * W + x] = Math.abs(ca * cb + s * cc * cd);
    }
  // Where the powder goes: from each LED, climb to the neighbour that swings
  // hardest until no neighbour swings harder. That LED is the antinode whose
  // heap this LED feeds. Climbing on the grid finds the true peaks; following
  // the slope by itself left powder strung out along the ridges between them.
  const up = params.up;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let best = i;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const xx = x + ox;
          const yy = y + oy;
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          const j = yy * W + xx;
          if (amp[j] > amp[best]) best = j;
        }
      up[i] = best;
    }
  const peak = params.peak;
  for (let i = 0; i < N; i++) {
    let j = i;
    while (up[j] !== j) j = up[j];
    peak[i] = j;
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(dt, 0.1);
  params.plate = Math.max(0, Math.min(1, k[0]));
  const amp = Math.max(0.05, k[1]);
  params.amp = amp;
  const k3 = Math.max(-1, Math.min(1, k[2]));
  params.powder = Math.max(0, Math.min(1, k[3]));

  params.since += dt;
  params.next -= dt;
  const pressed = input.btnPressed && input.btnPressed[0];
  // Turned to another register, the bow does not wait out the figure.
  if (params.mode >= 0 && Math.abs(Math.log2(MODES[params.mode][0] / (85 * Math.pow(2, 1.4 * k3)))) > 0.6 && params.next > 0.4) params.next = 0.4;
  if (pressed || params.next <= 0) {
    pickMode(params, k3);
    params.since = 0;
    params.next = HOLD;
  }
  if (params.mode < 0) return;

  // A stroke throws everything up for a moment; then the note settles in.
  const t = params.since;
  const burst = 2.2 * Math.exp(-t / 0.18);
  const env = 0.4 + 0.6 * Math.min(1, t / 0.5);
  const a = amp * env;
  const f = Math.sqrt(dt * 30);
  const inv = 1 / params.k;
  const ax = params.ax;
  const ay = params.ay;
  const bx = params.bx;
  const by = params.by;
  const s = params.sign;
  const row = MODES[params.mode];
  const kax = (row[1] * Math.PI) / W;
  const kay = (row[2] * Math.PI) / H;
  const kbx = (row[3] * Math.PI) / W;
  const kby = (row[4] * Math.PI) / H;
  const gx = params.gx;
  const gy = params.gy;
  const hop = params.hop;
  const kind = params.kind;
  const powder = params.powder;
  const peak = params.peak;
  const spread = 0.8 + 1.6 * Math.sqrt(powder);
  for (let i = 0; i < GRAINS; i++) {
    let x = gx[i];
    let y = gy[i];
    const ca = COS[(ax * x) & MASK];
    const cb = COS[(ay * y) & MASK];
    const cc = COS[(bx * x) & MASK];
    const cd = COS[(by * y) & MASK];
    const u = ca * cb + s * cc * cd;
    const sa = COS[((ax * x) - QUARTER) & MASK];
    const sb = COS[((ay * y) - QUARTER) & MASK];
    const sc = COS[((bx * x) - QUARTER) & MASK];
    const sd = COS[((by * y) - QUARTER) & MASK];
    const dx = -kax * sa * cb - s * kbx * sc * cd;
    const dy = -kay * ca * sb - s * kby * cc * sd;
    if (kind[i] < powder) {
      // Powder is light enough for the air the plate pumps: the currents grow
      // with the square of the swing and carry it to the antinode of its cell.
      // A heap holds what reaches it, so more powder makes wider heaps, and as
      // Faraday saw in 1831, each heap turns slowly on itself.
      const pk = peak[((y | 0) * W + (x | 0))];
      const tx = (pk % W) + 0.5;
      const ty = ((pk / W) | 0) + 0.5;
      const pull = Math.min(0.5, 0.035 * a * a) * f * f;
      const spin = (u > 0 ? 0.06 : -0.06) * f * f;
      const j = spread * Math.sqrt(2 * pull) * 1.7 + burst * f;
      const ox = x - tx;
      const oy = y - ty;
      x += -pull * ox - spin * oy + (Math.random() - 0.5) * j;
      y += -pull * oy + spin * ox + (Math.random() - 0.5) * j;
      hop[i] = 0;
    } else {
      // Sand only leaves the plate where the plate's acceleration beats gravity.
      // e is that acceleration in g: at the antinodes it is the Drive times 4.4,
      // and the band where it stays under 1 is where the sand lies still, so the
      // lines thin as the bow presses harder. Above 1 a grain jumps further the
      // harder the plate throws it, in any direction.
      const e = 2.2 * a * Math.abs(u);
      const e2 = e * e;
      const e8 = e2 * e2 * e2 * e2;
      const h = ((e > 1 ? e - 0.7 : 0.3 * e8) * 0.18 * inv + 0.015 + burst) * f;
      x += (Math.random() * 2 - 1) * h;
      y += (Math.random() * 2 - 1) * h;
      // Inside the band the plate still tilts under each grain, and the sand
      // creeps down to the line itself, so a figure sharpens while it stands.
      const g2 = dx * dx + dy * dy;
      if (e < 1 && g2 > 1e-6) {
        const c = (0.003 * a * u * f * f) / g2;
        x -= c * dx;
        y -= c * dy;
      }
      hop[i] = h;
    }
    if (x < 0) x = -x;
    else if (x >= W) x = 2 * W - x - 0.001;
    if (y < 0) y = -y;
    else if (y >= H) y = 2 * H - y - 0.001;
    gx[i] = Math.max(0, Math.min(W - 0.001, x));
    gy[i] = Math.max(0, Math.min(H - 0.001, y));
  }
}

export function draw(display, params, time) {
  const cnt = params.cnt;
  const sr = params.sr;
  const sg = params.sg;
  const sb = params.sb;
  const pw = params.pw;
  const cov = params.cov;
  cnt.fill(0);
  sr.fill(0);
  sg.fill(0);
  sb.fill(0);
  pw.fill(0);

  // Plate and sand for this setting of the knob, blended between neighbours.
  const pf = params.plate * (PLATES.length - 1);
  const p0 = Math.min(PLATES.length - 2, Math.floor(pf));
  const pt = pf - p0;
  const plate = [0, 0, 0];
  const sand = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    plate[c] = PLATES[p0][0][c] + (PLATES[p0 + 1][0][c] - PLATES[p0][0][c]) * pt;
    sand[c] = PLATES[p0][1][c] + (PLATES[p0 + 1][1][c] - PLATES[p0][1][c]) * pt;
  }
  const base = PLATES[p0][2] + (PLATES[p0 + 1][2] - PLATES[p0][2]) * pt;
  const gloss = PLATES[p0][3] + (PLATES[p0 + 1][3] - PLATES[p0][3]) * pt;

  const gx = params.gx;
  const gy = params.gy;
  const hop = params.hop;
  const kind = params.kind;
  const tint = params.tint;
  const powder = params.powder;
  for (let i = 0; i < GRAINS; i++) {
    const x = gx[i] | 0;
    const y = gy[i] | 0;
    const o = y * W + x;
    if (kind[i] < powder) {
      // Powder is fluff: a soft spot rather than a point.
      pw[o] += 1;
      if (x > 0) pw[o - 1] += 0.35;
      if (x < W - 1) pw[o + 1] += 0.35;
      if (y > 0) pw[o - W] += 0.35;
      if (y < H - 1) pw[o + W] += 0.35;
      continue;
    }
    // A grain in the air is a blur, so it shows less than one lying still.
    const w = 1 / (1 + 1.2 * hop[i]);
    const tt = TINTS[tint[i]];
    cnt[o] += w;
    sr[o] += w * tt[0];
    sg[o] += w * tt[1];
    sb[o] += w * tt[2];
  }
  for (let i = 0; i < N; i++) {
    const c = cnt[i] * 16;
    cov[i] = COVER[c < 256 ? c | 0 : 256];
  }

  const lum = params.lum;
  const sheen = params.sheen;
  const slope = params.slope;
  // Where the plate tilts back and forth, the window it reflects is smeared out.
  const smear = Math.min(0.85, params.amp * 0.3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let l = base * lum[i] + gloss * sheen[i] * (1 - smear * Math.min(1, slope[i]));
      let r = plate[0] * l;
      let g = plate[1] * l;
      let b = plate[2] * l;
      const cv = cov[i];
      if (cv > 0) {
        const n = cnt[i];
        const tr = (sand[0] * sr[i]) / n;
        const tg = (sand[1] * sg[i]) / n;
        const tb = (sand[2] * sb[i]) / n;
        r += (tr - r) * cv;
        g += (tg - g) * cv;
        b += (tb - b) * cv;
      }
      const pv = pw[i];
      if (pv > 0) {
        const a = Math.min(0.95, 1 - Math.exp(-0.5 * pv));
        r += (POWDER[0] - r) * a;
        g += (POWDER[1] - g) * a;
        b += (POWDER[2] - b) * a;
      }
      display.setPixel(x, y, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
    }
}
