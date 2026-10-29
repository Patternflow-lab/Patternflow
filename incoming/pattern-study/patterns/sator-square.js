// ===== Patternflow pattern =====
// Title:   Sator Square
// Family:  type
// Idea:    The 25 letters of the word square found at Pompeii, cut in a stone tablet, are read by four lights at once (across, down, backwards and up, always standing on the same letter), then fly by the shortest matching to their places in Felix Grosser's Paternoster cross, which stands the full height of the panel with A and O at the four ends, hold while two lights read PATERNOSTER down and across to meet at the N, and fly home.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Sator square (Pompeii, before AD 79; Dura-Europos), Paternoster cross (Felix Grosser, 1926), the assignment problem (Harold Kuhn, 1955), pattern round 71
// Round:   71
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Assign=0..2, Weather=0..1
//
// Knob 1: Hue. Turns the light round the wheel: at 0 the letters glow gold and the four letters of the cross's ends, A and O, glow pale azure on grey stone.
// Knob 2: Speed. One round of reading, flight, cross and flight home takes 14 s at 2, 9.3 s at 3 and 140 s at 0.2.
// Knob 3: Assign. Which letter flies to which place of its kind. 0 is the matching with the least total travel, 537.6 LEDs for the 25 flights; 1 sends the k-th A of the square, read across, to the k-th A of the cross, read down and then across, 864.9 LEDs; 2 is the matching with the most travel, 1083.3 LEDs, so the flights cross over each other.
// Knob 4: Weather. How long the tablet has stood out: at 0.06 the cuts are fresh; towards 1 the groove edges crumble and the stone pits and greys with lichen, and every letter keeps its own worn patches all through its flight.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, round, min, max, exp, sqrt, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Letters. Only eight are needed: S A T O R E P N. Three cuts of each:
// 9 by 9 with 2 LED strokes for the tablet, 5 by 7 for the cross's upright,
// 3 by 5 for its arm. The upright and the arm both need the same N, which
// sits at the crossing in the 5 by 7 cut, so the 3 by 5 set has no N.
const BIG = {
  S: [".#######.", "##.....##", "##.......", "##.......", ".#######.", ".......##", ".......##", "##.....##", ".#######."],
  A: ["...###...", "..##.##..", "..##.##..", ".##...##.", ".##...##.", ".#######.", "##.....##", "##.....##", "##.....##"],
  T: ["#########", "#########", "...###...", "...###...", "...###...", "...###...", "...###...", "...###...", "...###..."],
  O: ["..#####..", ".##...##.", "##.....##", "##.....##", "##.....##", "##.....##", "##.....##", ".##...##.", "..#####.."],
  R: ["#######..", "##....##.", "##.....##", "##....##.", "#######..", "##..##...", "##...##..", "##....##.", "##.....##"],
  E: ["#########", "##.......", "##.......", "##.......", "#######..", "##.......", "##.......", "##.......", "#########"],
  P: ["#######..", "##....##.", "##.....##", "##....##.", "#######..", "##.......", "##.......", "##.......", "##......."],
  N: ["##.....##", "###....##", "####...##", "##.##..##", "##..##.##", "##...####", "##....###", "##.....##", "##.....##"],
};
const MID = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
};
const SMALL = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  E: ["###", "#..", "##.", "#..", "###"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  S: [".##", "#..", ".#.", "..#", "##."],
};
const bits = (set) => {
  const o = {};
  for (const k in set) o[k] = Uint8Array.from(set[k].join(""), (c) => (c === "#" ? 1 : 0));
  return o;
};
const BIGB = bits(BIG), MIDB = bits(MID), SMALLB = bits(SMALL);

// ---- The tablet. Rows SATOR AREPO TENET OPERA ROTAS read the same across
// and down, and the same backwards: the square is left as it is by the half
// turn and by reflection in either diagonal. Letters 9 by 9 on a 12 LED
// pitch round (32.5, 64.5), on a slab 61 by 63 from (2, 33).
const SQUARE = ["SATOR", "AREPO", "TENET", "OPERA", "ROTAS"];
const SQ = [];
for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) SQ.push({ ch: SQUARE[r][c], x: 32.5 + (c - 2) * 12, y: 64.5 + (r - 2) * 12 });
const SX0 = 2, SX1 = 63, SY0 = 33, SY1 = 96;

// The four readings as paths over the 25 cells: across (rows left to
// right), down (columns top to bottom), backwards (from the last letter) and
// up (columns from the bottom right). Whatever step k the four lights are
// on, they stand on the same letter; at k = 12 they meet on the N. A cell is
// first lit at the least of its four indices, so every cell is lit by k = 12.
const PATHS = [(k) => k, (k) => (k % 5) * 5 + floor(k / 5), (k) => 24 - k, (k) => 24 - ((k % 5) * 5 + floor(k / 5))];
const FIRST = new Float32Array(25).fill(99);
for (const f of PATHS) for (let k = 0; k < 25; k++) FIRST[f(k)] = min(FIRST[f(k)], k);

// ---- Grosser's cross. A-PATERNOSTER-O down the middle, 13 letters 5 by 7
// on rows 128/13 apart, so it stands the whole height; the same 13 across
// row 64 in the 3 by 5 cut on a 5 LED pitch, sharing the N. 21 letters make
// PATERNOSTER twice; the A and O left over (alpha and omega) end the arms.
const CROSS = "APATERNOSTERO";
const SLOT = [];
for (let j = 0; j < 13; j++) SLOT.push({ ch: CROSS[j], x: 32.5, y: floor(((j + 0.5) * H) / 13) + 0.5, w: 5, h: 7, bm: MIDB, k: j, ao: j === 0 || j === 12 });
for (let i = 0; i < 13; i++)
  if (i !== 6) SLOT.push({ ch: CROSS[i], x: i < 6 ? 27.5 - 5 * (5 - i) : 37.5 + 5 * (i - 7), y: 64.5, w: 3, h: 5, bm: SMALLB, k: i, ao: i === 0 || i === 12 });

// The count, checked here so the cross can never be built from letters the
// square does not have: square S2 A4 T4 O4 R4 E4 P2 N1; PATERNOSTER twice
// with one N is P2 A2 T4 E4 R4 N1 O2 S2, 21 letters, and A2 O2 are left.
{
  const n = {};
  for (const q of SQ) n[q.ch] = (n[q.ch] || 0) + 1;
  for (const s of SLOT) n[s.ch]--;
  for (const k in n) if (n[k] !== 0) throw new Error("Sator count is off at " + k);
}

// ---- Which letter goes to which place of its kind. Up to four of a kind,
// so every permutation is tried (24 at most). Totals of the 25 straight
// distances, centre to centre: least 537.6 LEDs, reading order 864.9, most
// 1083.3.
function perms(n) {
  if (n === 1) return [[0]];
  const out = [];
  for (const p of perms(n - 1)) for (let i = 0; i < n; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return out;
}
const dist = (q, s) => sqrt((SQ[q].x - SLOT[s].x) ** 2 + (SQ[q].y - SLOT[s].y) ** 2);
const ASSIGN = [0, 1, 2].map((mode) => {
  const a = new Int8Array(25);
  for (const ch of "SATORENP") {
    const from = [], to = [];
    SQ.forEach((q, i) => q.ch === ch && from.push(i));
    SLOT.forEach((s, i) => s.ch === ch && to.push(i));
    if (mode === 1) {
      from.forEach((q, i) => (a[q] = to[i]));
      continue;
    }
    let best = null, bv = mode === 0 ? 1e9 : -1;
    for (const p of perms(from.length)) {
      let v = 0;
      p.forEach((j, i) => (v += dist(from[i], to[j])));
      if (mode === 0 ? v < bv : v > bv) (bv = v), (best = p);
    }
    best.forEach((j, i) => (a[from[i]] = to[j]));
  }
  return a;
});

// ---- Time, in seconds at Speed 2. The tablet 5 s (lights read from 0.6 s,
// 6.25 letters a second), out 2 s, the cross 5 s (read from 0.5 s, 5.2
// letters a second), home 2 s. Each flight takes 1 s and starts 0.04 s after
// the one before it in reading order. A fresh start comes in 3.4 s into the
// tablet, at reading step 17.5, so the cross is up within 2.2 s.
const T_SQ = 5, T_OUT = 2, T_CR = 5, T_BACK = 2, CYCLE = T_SQ + T_OUT + T_CR + T_BACK;
const READ0 = 0.6, READ_RATE = 6.25, CREAD0 = 0.5, CREAD_RATE = 5.2, FLY = 1, STAG = 0.04, START = 3.4;

// ---- Stone: grain, pits and lichen, fixed for the tablet.
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, sc, s) {
  const fx = x / sc, fy = y / sc, ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy;
  const sx = ax * ax * (3 - 2 * ax), sy = ay * ay * (3 - 2 * ay);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
const GRAIN = new Float32Array(NP), PIT = new Float32Array(NP), LICH = new Float32Array(NP), CHIP = new Float32Array(NP);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const p = y * W + x;
    GRAIN[p] = 0.55 * hash(x, y, 1) + 0.45 * vnoise(x, y, 5, 2) - 0.5;
    PIT[p] = hash(x, y, 3);
    LICH[p] = 0.65 * vnoise(x, y, 7, 4) + 0.35 * vnoise(x, y, 2.5, 5);
    CHIP[p] = hash(x, y, 6);
  }
// Carved grooves of the 25 cells, lit from the upper left: the wall under
// an upper or left edge faces away from the light, the wall above a lower
// or right edge faces it. 0 stone, 1 shadow wall, 2 lit wall, 3 floor.
const CUT = new Uint8Array(NP), NEAR = new Uint8Array(NP);
for (const q of SQ) {
  const bm = BIGB[q.ch], x0 = round(q.x - 4.5), y0 = round(q.y - 4.5);
  const m = (i, j) => (i < 0 || j < 0 || i > 8 || j > 8 ? 0 : bm[j * 9 + i]);
  for (let j = 0; j < 9; j++)
    for (let i = 0; i < 9; i++) {
      const p = (y0 + j) * W + x0 + i;
      if (!m(i, j)) {
        if (m(i - 1, j) || m(i, j - 1) || m(i + 1, j) || m(i, j + 1)) NEAR[p] = 1;
        continue;
      }
      const ul = !m(i - 1, j) || !m(i, j - 1) || !m(i - 1, j - 1), lr = !m(i + 1, j) || !m(i, j + 1) || !m(i + 1, j + 1);
      CUT[p] = ul && !lr ? 1 : lr && !ul ? 2 : 3;
    }
}

export function setup(params) {
  params.s = {
    tau: START, hue: 0, speed: 2, mode: 0, wx: 0.06, dt: 0,
    lr: new Float32Array(NP), lg: new Float32Array(NP), lb: new Float32Array(NP),
    tr: new Float32Array(NP), tg: new Float32Array(NP), tb: new Float32Array(NP), tmp: new Float32Array(NP),
    rgb: new Float32Array(NP * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.mode = cl(round(k[2]), 0, 2);
  S.wx = cl(k[3], 0, 1);
  S.tau += (d * S.speed) / 2;
  S.dt = d;
}

// Bilinear sample of a bitmap at bitmap coordinates.
function samp(bm, bw, bh, fx, fy) {
  const ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy;
  let v = 0;
  if (iy >= 0 && iy < bh) {
    if (ix >= 0 && ix < bw) v += bm[iy * bw + ix] * (1 - ax) * (1 - ay);
    if (ix + 1 >= 0 && ix + 1 < bw) v += bm[iy * bw + ix + 1] * ax * (1 - ay);
  }
  if (iy + 1 >= 0 && iy + 1 < bh) {
    if (ix >= 0 && ix < bw) v += bm[(iy + 1) * bw + ix] * (1 - ax) * ay;
    if (ix + 1 >= 0 && ix + 1 < bw) v += bm[(iy + 1) * bw + ix + 1] * ax * ay;
  }
  return v;
}

// One letter of light into the light buffer: the tablet cut, scaled to w by
// h, fading into the cross cut by mix, worn by letter q's own patches.
function letter(S, q, a, b, bw, bh, mix, cx, cy, w, h, col, inten, home) {
  const x0 = max(0, floor(cx - w / 2)), x1 = min(W - 1, ceil(cx + w / 2) - 1);
  const y0 = max(0, floor(cy - h / 2)), y1 = min(H - 1, ceil(cy + h / 2) - 1);
  const wx = S.wx, sub = w < 8.5 ? 2 : 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let va = 0, vb = 0;
      for (let sy = 0; sy < sub; sy++)
        for (let sx = 0; sx < sub; sx++) {
          const u = (x + (sx + 0.5) / sub - (cx - w / 2)) / w, v = (y + (sy + 0.5) / sub - (cy - h / 2)) / h;
          if (mix < 1) va += samp(a, 9, 9, u * 9 - 0.5, v * 9 - 0.5);
          if (mix > 0) vb += samp(b, bw, bh, u * bw - 0.5, v * bh - 0.5);
        }
      let val = (va * (1 - mix) + vb * mix) / (sub * sub);
      if (val < 0.02) continue;
      const u = (x + 0.5 - (cx - w / 2)) / w, v = (y + 0.5 - (cy - h / 2)) / h;
      const n = vnoise(u * 4 + q * 7.3, v * 4, 1, 40 + q);
      val *= 1 - 0.8 * wx * ss(0.3, 0.6, n);
      val *= inten;
      const p = y * W + x;
      // At home the light lies in the groove: least on the wall in shadow.
      if (home) val *= CUT[p] === 1 ? 0.5 : CUT[p] === 2 ? 1 : 0.78;
      if (col[0] * val > S.lr[p]) S.lr[p] = col[0] * val;
      if (col[1] * val > S.lg[p]) S.lg[p] = col[1] * val;
      if (col[2] * val > S.lb[p]) S.lb[p] = col[2] * val;
    }
}

function blur(src, tmp, out) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      tmp[p] = (6 * src[p] + 4 * ((x > 0 ? src[p - 1] : 0) + (x < W - 1 ? src[p + 1] : 0)) + (x > 1 ? src[p - 2] : 0) + (x < W - 2 ? src[p + 2] : 0)) / 16;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      out[p] = (6 * tmp[p] + 4 * ((y > 0 ? tmp[p - W] : 0) + (y < H - 1 ? tmp[p + W] : 0)) + (y > 1 ? tmp[p - 2 * W] : 0) + (y < H - 2 ? tmp[p + 2 * W] : 0)) / 16;
    }
}

function spot(rgb, x, y, rad, a, col) {
  const r = ceil(rad * 2.2);
  for (let j = max(0, floor(y - r)); j <= min(H - 1, ceil(y + r)); j++)
    for (let i = max(0, floor(x - r)); i <= min(W - 1, ceil(x + r)); i++) {
      const dx = i + 0.5 - x, dy = j + 0.5 - y, v = a * exp(-(dx * dx + dy * dy) / (rad * rad));
      const p = (j * W + i) * 3;
      rgb[p] += col[0] * v, rgb[p + 1] += col[1] * v, rgb[p + 2] += col[2] * v;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, lr, lg, lb } = S, wx = S.wx, assign = ASSIGN[S.mode];
  const tc = ((S.tau % CYCLE) + CYCLE) % CYCLE;
  const gold = hsv(0.115 + S.hue, 0.6, 1), azure = hsv(0.55 + S.hue, 0.42, 1), warm = hsv(0.1 + S.hue, 0.25, 1);

  // Where each letter is: p is its flight, 0 at home in the tablet, 1 in
  // the cross.
  const fly = new Float32Array(25);
  let gone = 0;
  for (let q = 0; q < 25; q++) {
    let p = 0;
    if (tc >= T_SQ && tc < T_SQ + T_OUT) p = ss(0, 1, (tc - T_SQ - STAG * q) / FLY);
    else if (tc >= T_SQ + T_OUT && tc < T_SQ + T_OUT + T_CR) p = 1;
    else if (tc >= T_SQ + T_OUT + T_CR) p = 1 - ss(0, 1, (tc - T_SQ - T_OUT - T_CR - STAG * q) / FLY);
    fly[q] = p;
    gone += p / 25;
  }

  // ---- Stone, dimmed to 38% while the letters' light is away.
  const dim = 1 - 0.62 * gone;
  rgb.fill(0);
  const stone = [0.82, 0.86, 0.93], moss = [0.72, 0.8, 0.55];
  for (let y = SY0; y < SY1; y++)
    for (let x = SX0; x < SX1; x++) {
      const p = y * W + x;
      let v = 62 * (1 + 0.32 * GRAIN[p]);
      if (y === SY0 || x === SX0) v *= 1.45;
      else if (y === SY1 - 1 || x === SX1 - 1) v *= 0.55;
      const c = CUT[p];
      if (c) {
        const chip = CHIP[p] < 0.45 * wx;
        v *= chip ? 0.6 : c === 1 ? 0.3 : c === 2 ? 1.9 : 0.55;
      } else if (NEAR[p] && CHIP[p] < 0.4 * wx) v *= 0.45;
      if (PIT[p] < 0.1 * wx) v *= 0.35;
      const l = ss(1 - 0.55 * wx, 1.05 - 0.55 * wx, LICH[p]) * min(1, wx * 2);
      v *= dim;
      const o = p * 3;
      rgb[o] = v * (stone[0] + (moss[0] - stone[0]) * l);
      rgb[o + 1] = v * (stone[1] + (moss[1] - stone[1]) * l);
      rgb[o + 2] = v * (stone[2] + (moss[2] - stone[2]) * l);
    }

  // ---- The cross's own faint body of light, there as far as its letters
  // have arrived: a band 8 LEDs wide down the middle and one across row 64.
  const body = gone * gone * 34;
  if (body > 0.5)
    for (let y = 0; y < H; y++) {
      const by = exp(-(((y + 0.5 - 64.5) / 2.6) ** 2)), sh = 0.86 + 0.14 * sin(y * 0.35 - tc * 5);
      for (let x = 0; x < W; x++) {
        const v = body * max(exp(-(((x + 0.5 - 32.5) / 4) ** 2)) * sh, by);
        if (v < 0.5) continue;
        const o = (y * W + x) * 3;
        rgb[o] += gold[0] * v, rgb[o + 1] += gold[1] * v, rgb[o + 2] += gold[2] * v;
      }
    }

  // ---- Light. Trails fade in about 0.07 s.
  const decay = exp(-S.dt / 0.07);
  for (let p = 0; p < NP; p++) (lr[p] *= decay), (lg[p] *= decay), (lb[p] *= decay);

  const inSq = tc < T_SQ, inCr = tc >= T_SQ + T_OUT && tc < T_SQ + T_OUT + T_CR;
  const step = (tc - READ0) * READ_RATE;
  const cstep = (tc - T_SQ - T_OUT - CREAD0) * CREAD_RATE;
  for (let q = 0; q < 25; q++) {
    const from = SQ[q], to = SLOT[assign[q]], p = fly[q];
    let glow = 1;
    if (inSq) glow = max(1 - ss(0, 0.6, tc), ss(FIRST[q], FIRST[q] + 1.2, step));
    if (p <= 0) {
      letter(S, q, BIGB[from.ch], null, 9, 9, 0, from.x, from.y, 9, 9, gold, 0.1 + 0.72 * glow, true);
      continue;
    }
    // A quadratic arc, bowed a fifth of its length to the left of the way
    // out, so the 25 flights turn together.
    const dx = to.x - from.x, dy = to.y - from.y, cx = (from.x + to.x) / 2 - 0.2 * dy, cy = (from.y + to.y) / 2 + 0.2 * dx;
    const e = p, f = 1 - e;
    const px = f * f * from.x + 2 * e * f * cx + e * e * to.x, py = f * f * from.y + 2 * e * f * cy + e * e * to.y;
    const w = 9 + (to.w - 9) * e, h = 9 + (to.h - 9) * e;
    const mix = ss(0.35, 0.8, e);
    const ao = to.ao ? e : 0;
    const col = [gold[0] + (azure[0] - gold[0]) * ao, gold[1] + (azure[1] - gold[1]) * ao, gold[2] + (azure[2] - gold[2]) * ao];
    let inten = 0.95;
    if (inCr) {
      const fl = exp(-((cstep - to.k) ** 2) / 0.6);
      inten = 0.78 + 0.4 * fl + (to.ao ? 0.14 * sin(tc * 3.1) : 0);
    }
    letter(S, q, BIGB[from.ch], to.bm[to.ch], to.w, to.h, mix, px, py, w, h, col, inten);
  }

  blur(lr, S.tmp, S.tr), blur(lg, S.tmp, S.tg), blur(lb, S.tmp, S.tb);
  for (let p = 0; p < NP; p++) {
    const o = p * 3;
    rgb[o] += 235 * lr[p] + 150 * S.tr[p];
    rgb[o + 1] += 235 * lg[p] + 150 * S.tg[p];
    rgb[o + 2] += 235 * lb[p] + 150 * S.tb[p];
  }

  // ---- The reading lights: four on the tablet, two on the cross.
  if (inSq && step > -0.5 && step < 25) {
    const k = floor(step), fr = step - k;
    for (const f of PATHS) {
      const a = SQ[f(cl(k, 0, 24))], b = SQ[f(cl(k + 1, 0, 24))];
      const sameLine = k >= 0 && k < 24 && (k % 5 !== 4);
      const m = sameLine ? ss(0.25, 0.75, fr) : 0;
      const fade = (k < 0 ? ss(-0.5, 0, step) : 1) * (sameLine || k >= 24 ? 1 : 1 - ss(0.55, 0.95, fr)) * (k > 0 && k % 5 === 0 ? ss(0, 0.2, fr) : 1);
      spot(rgb, a.x + (b.x - a.x) * m, a.y + (b.y - a.y) * m, 4.2, 150 * fade, warm);
    }
  }
  if (inCr && cstep > -0.5 && cstep < 13) {
    const k = floor(cstep), fr = cstep - k, m = ss(0.2, 0.8, fr);
    const up = (j) => SLOT[cl(j, 0, 12)], arm = (i) => SLOT[i === 6 ? 6 : i < 6 ? 13 + i : 12 + i];
    const fade = ss(-0.5, 0, cstep) * (1 - ss(12.4, 13, cstep));
    const a = up(k), b = up(k + 1);
    spot(rgb, 32.5, a.y + (b.y - a.y) * m, 3.2, 110 * fade, warm);
    const c = arm(cl(k, 0, 12)), d = arm(cl(k + 1, 0, 12));
    spot(rgb, c.x + (d.x - c.x) * m, 64.5, 2.4, 110 * fade, warm);
  }

  for (let p = 0; p < NP; p++)
    display.setPixel(p % W, floor(p / W), min(255, rgb[p * 3]) | 0, min(255, rgb[p * 3 + 1]) | 0, min(255, rgb[p * 3 + 2]) | 0);
}
