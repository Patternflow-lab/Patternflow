// ===== Patternflow pattern =====
// Title:   Cyanotype
// Family:  print
// Idea:    A sun print is made over and over: pressed ferns, feathers, seed heads and lace are laid on a sheet brushed with pale yellow-green iron salts, the sun turns the bare paper blue-grey round them, and when they are lifted a wash runs down the sheet, clearing their shadows to white and the ground to Prussian blue, which deepens as it dries before the print is slid away for the next sheet.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 19, after John Herschel's cyanotype process (1842) and Anna Atkins's photograms of algae and ferns
// Round:   19
// ===============================
// @matrix 64x128
// @knobs Tone=0..1, Speed=0.2..3, Specimen=0..4, Exposure=-1..1
//
// Knob 1: Tone. The washed print, from the plain Prussian blue on white at 0 through a violet to a tea-toned print at 1, brown-black on cream.
// Knob 2: Speed. How fast the printer works: at 2 one sheet takes 15 seconds from laying the specimens to sliding the dry print away, five of them in the sun; at 0.2 it takes two and a half minutes.
// Knob 3: Specimen. What is laid on the sheet: a fern frond and a feather, two feathers over a strip of lace, dandelion clocks and grasses, two ferns, or a lace doily with a sprig; turning it washes up a print of that one, and after it the sheets follow in that order.
// Knob 4: Exposure. How long the sheet lies in the sun: at -1 the ground stays a pale blue and every barb and lace thread prints; at 0 the blue is full; at 1 it goes nearly navy and the thin parts burn through.

const W = 64;
const H = 128;
const N = W * H;

// The steps of one sheet, in seconds at Speed 2: the last print slides away,
// the specimens are laid one by one, the glass goes down, the sun, the glass
// and specimens come off, the wash runs down the sheet, and it dries.
const SLIDE = 0;
const LAY = 1.2;
const GLASS = 2.6;
const SUN = 3;
const LIFT = 8;
const WASH = 8.8;
const DRY = 11.8;
const CYCLE = 15;
// The panel opens with the wash 60% of the way down the first print.
const OPEN = WASH + 0.6 * (DRY - WASH);
const ARRANGEMENTS = 5;

const PAPER = [212, 208, 196];
const CREAM = [214, 188, 136];
// The iron salts as brushed on, and the grey-blue they turn in the sun
// before they are washed.
const COAT = [198, 202, 92];
const SUNNED = [88, 102, 112];
// Prussian blue wet from the wash and dry; tea turns it brown-black.
const WET = [44, 96, 182];
const BLUE = [12, 44, 122];
const TEA_WET = [104, 74, 76];
const TEA = [62, 40, 46];

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function smooth(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function noise1(x, s) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, s) * (1 - u) + hash(i + 1, s) * u;
}

// A sheet: how thick the salts were brushed at each LED, how much light the
// specimens on it stop there, and what the specimens look like lying on it.
function newSheet(arr, n) {
  const S = {
    arr,
    coat: new Float32Array(N),
    mask: new Float32Array(N),
    obj: new Float32Array(N * 3),
    order: new Float32Array(N),
    // Where one specimen lies over another, the one under it.
    under: new Float32Array(N * 3),
    uorder: new Float32Array(N),
    parts: 0,
  };
  // Brushed side to side, so the edges are ragged and a few bristles run
  // past them, and the strokes leave streaks along the rows.
  for (let y = 0; y < H; y++) {
    const left = 3 + 2.5 * noise1(y * 0.35, n * 13 + 1) + (hash(y, n * 13 + 2) > 0.88 ? -3 * hash(y, n * 13 + 3) : 0);
    const right = 60 - 2.5 * noise1(y * 0.35, n * 13 + 4) + (hash(y, n * 13 + 5) > 0.88 ? 3 * hash(y, n * 13 + 6) : 0);
    const streak = 0.9 + 0.07 * noise1(y * 0.22, n * 13 + 7) + 0.03 * noise1(y * 1.1, n * 13 + 11);
    for (let x = 0; x < W; x++) {
      const top = 4 + 2 * noise1(x * 0.3, n * 13 + 8);
      const bottom = 123 - 2 * noise1(x * 0.3, n * 13 + 9);
      const inside = smooth(left - 1, left + 1.5, x) * smooth(right + 1, right - 1.5, x) * smooth(top - 1, top + 1, y) * smooth(bottom + 1, bottom - 1, y);
      S.coat[y * W + x] = inside * streak * (0.94 + 0.06 * noise1(x * 0.2 + y * 3.7, n * 13 + 10));
    }
  }
  ARRANGE[arr](S);
  return S;
}

// Lays one stroke of a specimen: a segment `w` LEDs wide that stops `op` of
// the light, in colour `col`.
function stroke(S, x0, y0, x1, y1, w, op, col) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  const r = w / 2 + 0.5;
  const xa = Math.max(0, Math.floor(Math.min(x0, x1) - r));
  const xb = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + r));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1) - r));
  const yb = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + r));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const u = clamp(((x - x0) * dx + (y - y0) * dy) / len2, 0, 1);
      const d = Math.hypot(x - x0 - u * dx, y - y0 - u * dy);
      // Pressed flat under the glass, a specimen's edge prints sharp.
      if (d < r - 0.5) paint(S, y * W + x, op, col);
    }
}

// One LED of a specimen. The light it lets through is the least any layer
// there lets through; the specimen laid last is the one seen on top.
function paint(S, p, op, col) {
  S.mask[p] = Math.max(S.mask[p], op);
  if (S.order[p] && S.order[p] !== S.parts) {
    S.uorder[p] = S.order[p];
    for (let c = 0; c < 3; c++) S.under[p * 3 + c] = S.obj[p * 3 + c];
  }
  for (let c = 0; c < 3; c++) S.obj[p * 3 + c] = col[c];
  S.order[p] = S.parts;
}

const FROND = [70, 112, 48];
const QUILL = [196, 186, 166];
const SHAFT = [150, 128, 100];
const STRAW = [196, 166, 104];
const DOWN = [226, 224, 216];
const LACE = [232, 226, 210];

// A fern frond from its foot (x, y) along angle `a` for `len` LEDs, bending
// by `bend`, with pinnae up to `wide` LEDs long, alternate, the lowest few
// pairs short and the frond tapering to its tip; each pinna is lobed.
function fern(S, x, y, a, len, wide, bend) {
  S.parts++;
  const at = (s) => {
    const c = Math.cos(a + bend * s);
    const d = Math.sin(a + bend * s);
    return [x + c * s * len, y + d * s * len, c, d];
  };
  for (let s = 0; s < 1; s += 0.02) {
    const [x0, y0] = at(s);
    const [x1, y1] = at(s + 0.02);
    stroke(S, x0, y0, x1, y1, 1.4 - 0.7 * s, 0.95, FROND);
  }
  const step = 2.9 / len;
  let side = 1;
  for (let s = 0.16; s < 0.97; s += step) {
    const [px, py, c, d] = at(s);
    const k = (s - 0.16) / 0.81;
    const l = wide * Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.25 + 0.06)), 0.8) * (1 - 0.35 * k) + 1;
    // Pinnae lean toward the tip and curve up at their ends.
    const pa = a + bend * s + side * (1.15 - 0.25 * k);
    let qx = px;
    let qy = py;
    const n = Math.max(2, Math.round(l));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const ang = pa - side * 0.45 * t;
      const nx = qx + Math.cos(ang);
      const ny = qy + Math.sin(ang);
      const lobe = 0.75 + 0.25 * Math.cos(j * 2.4);
      stroke(S, qx, qy, nx, ny, (2.4 - 1.5 * t) * lobe, 0.9, FROND);
      qx = nx;
      qy = ny;
    }
    side = -side;
  }
}

// A feather from the end of its quill along angle `a`: the vanes are barbs
// side by side that let some light through, split apart here and there, with
// soft down at the foot, and the shaft drawn over them.
function feather(S, x, y, a, len, wl, wr, seed) {
  S.parts++;
  const c = Math.cos(a);
  const d = Math.sin(a);
  const bend = 0.12 * len;
  const at = (s) => [x + c * s * len - d * bend * s * s, y + d * s * len + c * bend * s * s];
  const [mx, my] = at(0.5);
  const reach = len / 2 + Math.max(wl, wr) + 4;
  for (let py = Math.max(0, Math.floor(my - reach)); py <= Math.min(H - 1, my + reach); py++)
    for (let px = Math.max(0, Math.floor(mx - reach)); px <= Math.min(W - 1, mx + reach); px++) {
      const s = ((px - x) * c + (py - y) * d) / len;
      if (s < 0.08 || s > 1) continue;
      const t = -(px - x) * d + (py - y) * c - bend * s * s;
      const side = t < 0 ? -1 : 1;
      const at2 = Math.abs(t);
      const down = s < 0.3;
      const wide = (side < 0 ? wl : wr) * (down ? 0.7 + 0.5 * hash(px * 7 + py, seed) : Math.sqrt(Math.max(0, 1 - ((s - 0.55) / 0.46) ** 2)));
      if (at2 > wide) continue;
      // Each barb runs out from the shaft and forward toward the tip.
      const b = (s * len - at2 * 0.55) / 2.4;
      const k = Math.floor(b);
      let op = b - k < 0.5 ? 0.9 : 0.5;
      if (down) op = 0.25 + 0.25 * hash(px, py + seed);
      else if (hash(k, seed + side) > 0.88 && at2 > 0.35 * wide) op = 0.15;
      paint(S, py * W + px, op, op > 0.6 ? QUILL : DOWN);
    }
  for (let s = 0; s < 1; s += 0.025) {
    const [x0, y0] = at(s);
    const [x1, y1] = at(s + 0.025);
    stroke(S, x0, y0, x1, y1, 1.5 - 1 * s, 0.97, SHAFT);
  }
}

// A grass in seed: a thin stem nodding over, its seed heads hung on short
// stalks either side.
function grass(S, x, y, a, len, bend) {
  S.parts++;
  let px = x;
  let py = y;
  for (let i = 0; i < len; i++) {
    const g = a + (bend * i) / len;
    const nx = px + Math.cos(g);
    const ny = py + Math.sin(g);
    stroke(S, px, py, nx, ny, 0.9, 0.9, STRAW);
    if (i > len * 0.45 && i % 3 === 0) {
      const side = (i / 3) % 2 ? 1 : -1;
      const h = g + side * 0.9 + 0.5 * bend;
      const sx = nx + 2 * Math.cos(h);
      const sy = ny + 2 * Math.sin(h);
      stroke(S, nx, ny, sx, sy, 0.6, 0.8, STRAW);
      const e = h + 0.4 * side;
      stroke(S, sx, sy, sx + 2.6 * Math.cos(e), sy + 2.6 * Math.sin(e), 1.7, 0.95, STRAW);
    }
    px = nx;
    py = ny;
  }
}

// A dandelion clock: its stem up from (x, y), a ball of seeds on fine
// stalks, each with its little parachute.
function clock(S, x, y, cx, cy, r, seed) {
  S.parts++;
  stroke(S, x, y, (x + cx) / 2 + 2, (y + cy) / 2, 1, 0.9, STRAW);
  stroke(S, (x + cx) / 2 + 2, (y + cy) / 2, cx, cy, 1, 0.9, STRAW);
  const n = 26;
  for (let i = 0; i < n; i++) {
    const g = (i / n) * 6.283 + 0.2 * hash(i, seed);
    const l = r * (0.8 + 0.2 * hash(i, seed + 1));
    const ex = cx + Math.cos(g) * l;
    const ey = cy + Math.sin(g) * l;
    stroke(S, cx, cy, ex, ey, 0.5, 0.7, DOWN);
    stroke(S, ex - 1.2 * Math.sin(g), ey + 1.2 * Math.cos(g), ex + 1.2 * Math.sin(g), ey - 1.2 * Math.cos(g), 0.8, 0.85, DOWN);
  }
  stroke(S, cx - 0.5, cy, cx + 0.5, cy, 2.4, 0.95, STRAW);
}

// Lace: a band from (x0, y0) to (x1, y1), `wide` LEDs deep, with a solid
// heading, a net of diagonal threads, rings at each repeat and a scalloped
// edge. `round` bends the band into a doily of that radius instead.
function lace(S, x0, y0, x1, y1, wide, round) {
  S.parts++;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let u;
      let v;
      if (round) {
        const r = Math.hypot(x - x0, y - y0);
        v = round - r;
        u = (Math.atan2(y - y0, x - x0) + Math.PI) * round * 0.75;
        if (r < 3) {
          paint(S, y * W + x, 0.85, LACE);
          continue;
        }
      } else {
        u = ((x - x0) * dx + (y - y0) * dy) / len;
        v = (-(x - x0) * dy + (y - y0) * dx) / len;
        if (u < 0 || u > len) continue;
      }
      const rep = 10;
      const m = ((u % rep) + rep) % rep;
      const scallop = 2.6 * Math.sqrt(Math.max(0, 1 - ((m - rep / 2) / (rep / 2)) ** 2));
      if (v < 0 || v > wide + scallop) continue;
      let op = 0;
      if (v < 1.6) op = 0.85;
      else if (v > wide + scallop - 1.2) op = 0.8;
      else {
        const ring = Math.hypot(m - rep / 2, v - wide * 0.55);
        if (Math.abs(ring - 3) < 0.8) op = 0.85;
        else if (ring < 1.2) op = 0.75;
        else if (ring > 4 && (Math.abs(((u + v) % 3.4) - 1.7) < 0.5 || Math.abs(((((u - v) % 3.4) + 3.4) % 3.4) - 1.7) < 0.5)) op = 0.7;
      }
      if (op > 0) paint(S, y * W + x, op, LACE);
    }
}

const ARRANGE = [
  (S) => {
    fern(S, 11, 126, -1.5, 100, 11, 0.2);
    feather(S, 58, 126, -1.82, 82, 5, 8, 1);
  },
  (S) => {
    feather(S, 8, 98, -1.15, 92, 7, 5, 2);
    feather(S, 56, 96, -2.05, 80, 4, 6, 3);
    lace(S, -2, 104, 66, 104, 11, 0);
  },
  (S) => {
    clock(S, 20, 127, 18, 24, 12, 4);
    clock(S, 34, 127, 46, 54, 10, 5);
    clock(S, 26, 127, 16, 88, 8, 6);
    grass(S, 56, 126, -1.65, 64, -1.2);
  },
  (S) => {
    fern(S, 34, 126, -1.62, 112, 13, -0.15);
    fern(S, 6, 4, 1.25, 52, 7, 0.25);
  },
  (S) => {
    lace(S, 32, 38, 0, 0, 18, 25);
    grass(S, 20, 126, -1.35, 60, -0.5);
    fern(S, 48, 126, -1.75, 56, 8, -0.3);
  },
];

export function setup(params) {
  const P = params;
  P.grain = new Float32Array(N);
  for (let p = 0; p < N; p++) P.grain[p] = hash(p, 99) - 0.5;
  P.drops = [];
  Object.assign(P, { ct: OPEN, count: 0, arr: 0, sheet: null, last: null, started: false, tone: 0, k: 2.6 });
  lay(P, 0);
}

function lay(P, arr) {
  P.last = P.sheet;
  P.sheet = newSheet(arr, P.count++);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  P.tone = clamp(k[0], 0, 1);
  P.k = 2.6 * Math.pow(2, 1.3 * clamp(k[3], -1, 1));
  const arr = clamp(Math.round(k[2]), 0, ARRANGEMENTS - 1);
  if (arr !== P.arr) {
    // A new specimen: its print comes up under the wash.
    P.arr = arr;
    lay(P, arr);
    P.ct = P.started ? WASH : OPEN;
    P.last = null;
  }
  P.started = true;
  const speed = clamp(k[1], 0.1, 4) / 2;
  P.ct += dt * speed;
  if (P.ct >= CYCLE) {
    P.ct -= CYCLE;
    P.arr = arr;
    lay(P, (P.sheet.arr + 1) % ARRANGEMENTS);
  }
  // Drops of the wash run down the wet sheet.
  const ct = P.ct;
  if (ct > WASH && ct < DRY + 2 && Math.random() < dt * speed * 3) P.drops.push({ x: 4 + Math.random() * 56, y: Math.min(H, washLine(ct)) * Math.random(), v: 6 + 10 * Math.random() });
  for (const d of P.drops) d.y += d.v * dt * speed;
  P.drops = P.drops.filter((d) => d.y < H + 4);
}

// How far down the sheet the wash has run.
function washLine(ct) {
  return -10 + (H + 18) * smooth(WASH, DRY, ct);
}

// The colour of a sheet at one LED: the salts as they are at time `ct` of the
// sheet's life, with the specimens on top while they lie there.
function colour(P, S, p, x, y, ct, out) {
  const c = S.coat[p];
  const m = S.mask[p];
  const tone = P.tone;
  const g = 3 * P.grain[p];
  let r = PAPER[0];
  let gg = PAPER[1];
  let b = PAPER[2];
  // The wash front, ragged along the row.
  const front = ct < WASH ? -99 : ct < DRY ? washLine(ct) + 2.2 * Math.sin(x * 0.37 + ct * 2.1) + 1.6 * Math.sin(x * 0.93 - ct * 3.3) + 3 * noise1(x * 0.45 + ct, 33) : 999;
  if (y < front) {
    // Washed: the salts that never saw the sun are gone, and what did is blue.
    const blue = c * (1 - Math.exp(-P.k * (1 - m)));
    const wet = smooth(DRY + 3.2, DRY - 0.5, ct + (H - y) * 0.012);
    const dark0 = WET[0] * wet + BLUE[0] * (1 - wet);
    const dark1 = WET[1] * wet + BLUE[1] * (1 - wet);
    const dark2 = WET[2] * wet + BLUE[2] * (1 - wet);
    const t0 = TEA_WET[0] * wet + TEA[0] * (1 - wet);
    const t1 = TEA_WET[1] * wet + TEA[1] * (1 - wet);
    const t2 = TEA_WET[2] * wet + TEA[2] * (1 - wet);
    const d0 = dark0 + (t0 - dark0) * tone;
    const d1 = dark1 + (t1 - dark1) * tone;
    const d2 = dark2 + (t2 - dark2) * tone;
    const l0 = PAPER[0] + (CREAM[0] - PAPER[0]) * tone;
    const l1 = PAPER[1] + (CREAM[1] - PAPER[1]) * tone;
    const l2 = PAPER[2] + (CREAM[2] - PAPER[2]) * tone;
    r = l0 + (d0 - l0) * blue;
    gg = l1 + (d1 - l1) * blue;
    b = l2 + (d2 - l2) * blue;
    // Water on the sheet shines; the shine draws back down as it dries.
    const film = front - y < 6 ? 1 - (front - y) / 6 : wet * 0.35;
    if (film > 0) {
      const shine = film * (18 + 14 * Math.sin(x * 0.7 + y * 0.35 - ct * 9));
      r += shine;
      gg += shine;
      b += shine;
    }
  } else {
    // In the sun the salts go from yellow-green to grey-blue where light
    // reaches them.
    const dose = ct < SUN ? 0 : smooth(SUN, LIFT, ct) * (1 - m);
    const e = 1 - Math.exp(-P.k * 1.2 * dose);
    const s0 = COAT[0] + (SUNNED[0] - COAT[0]) * e;
    const s1 = COAT[1] + (SUNNED[1] - COAT[1]) * e;
    const s2 = COAT[2] + (SUNNED[2] - COAT[2]) * e;
    r += (s0 - r) * c;
    gg += (s1 - gg) * c;
    b += (s2 - b) * c;
    // Just under the wash front the salts run yellow down the sheet.
    if (front > -99 && y - front < 10) {
      const run = (1 - (y - front) / 10) * c;
      r += (220 - r) * run * 0.3;
      gg += (214 - gg) * run * 0.3;
      b += (120 - b) * run * 0.3;
    }
    // The specimens, laid one after another and lifted together.
    if (S.order[p] && ct > LAY && ct < LIFT + 0.6) {
      const off = smooth(LIFT + 0.6, LIFT, ct);
      for (let layer = 0; layer < 2; layer++) {
        const o = layer ? S.order[p] : S.uorder[p];
        if (!o) continue;
        const src = layer ? S.obj : S.under;
        const on = smooth(LAY + 0.35 * (o - 1), LAY + 0.35 * o, ct) * off;
        r += (src[p * 3] - r) * on;
        gg += (src[p * 3 + 1] - gg) * on;
        b += (src[p * 3 + 2] - b) * on;
      }
    }
    // The glass over it all catches the sun in a broad band.
    if (ct > GLASS && ct < LIFT + 0.4) {
      const lit = smooth(GLASS, GLASS + 0.4, ct) * smooth(LIFT + 0.4, LIFT, ct);
      const band = x * 0.8 + y * 0.45 - 20 - 9 * (ct - GLASS);
      const glare = lit * (8 + 30 * Math.exp(-(band * band) / 60));
      r += glare;
      gg += glare;
      b += glare;
    }
  }
  out[0] = r + g;
  out[1] = gg + g;
  out[2] = b + g;
}

function byte(v) {
  return v > 255 ? 255 : v < 0 ? 0 : v | 0;
}

export function draw(display, params) {
  const P = params;
  if (!P.sheet) return;
  const ct = P.ct;
  const S = P.sheet;
  const out = [0, 0, 0];
  // While the last print slides off to the left, the new sheet lies under it.
  const off = P.last && ct < LAY ? Math.round(W * smooth(SLIDE, LAY, ct)) : W;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (x + off < W) {
        colour(P, P.last, p + off, x + off, y, CYCLE - 0.01, out);
      } else {
        colour(P, S, p, x, y, ct, out);
        // The print's edge throws a shadow on the sheet beneath.
        const e = x + off - W;
        if (off < W && e < 3) {
          const sh = 0.55 + 0.15 * e;
          out[0] *= sh;
          out[1] *= sh;
          out[2] *= sh;
        }
      }
      display.setPixel(x, y, byte(out[0]), byte(out[1]), byte(out[2]));
    }
  // Drops running down the wet print.
  if (ct > WASH && ct < CYCLE)
    for (const d of P.drops) {
      const x = Math.round(d.x);
      for (let j = 0; j < 3; j++) {
        const y = Math.round(d.y) - j;
        if (y < 0 || y >= H || y > (ct < DRY ? washLine(ct) - 3 : H)) continue;
        colour(P, S, y * W + x, x, y, ct, out);
        const v = 40 - 12 * j;
        display.setPixel(x, y, byte(out[0] + v), byte(out[1] + v), byte(out[2] + v));
      }
    }
}
