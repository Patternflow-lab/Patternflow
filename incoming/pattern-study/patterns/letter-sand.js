// ===== Patternflow pattern =====
// Title:   Letter Sand
// Family:  type
// Idea:    A word of four wide bold letters stacked down the panel is made of grains of sand: it stands, crumbles from the bottom letter up with each letter running out from its foot, and the grains fall and slide into a pile whose layers keep the letters' colours in order, until a stream of sand rises from a pit in the pile and builds the next word of the sediment cycle, ROCK, SAND, DUNE, DUST, SILT, LOAM, from each letter's foot up.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 64, after falling-sand games and bottles of layered craft sand
// Round:   64
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Grain=1..3, Wind=-1..1
//
// Knob 1: Hue. Turns the four sand colours round the wheel together. At 0 the letters from the top are gold, rose, turquoise and violet, like a bottle of craft sand; at 0.25 green, lime, indigo and red; at 0.5 blue, aqua, rose and lime.
// Knob 2: Speed. Everything at once. At 2 a grain in the air falls up to 75 LEDs a second and a word takes about 10.6 s, 2.4 s standing, 4.7 s crumbling and 2.9 to 3.8 s rising again, so the six words come round in 64 s; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Grain. The size of a grain: one LED at 1, where SAND is 1,262 grains, a 2 by 2 block at 2 (394 grains) and a 3 by 3 block at 3 (204). The letters stay about 36 LEDs wide and 20 tall; a new size rebuilds the sand around the word that stands.
// Knob 4: Wind. Blows across the falling grains and leans the rising stream. At 0.06 a breath: the stream barely leans and now and then a grain on the pile rolls one cell to the right. At 1 or -1 every other step of a falling grain is a step sideways, so the sand pours at 27 degrees, the pile creeps against one wall and the stream bows over.

const W = 64, H = 128;
const { floor, min, max, abs, round, sqrt } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The sediment cycle, one word a turn: rock weathers to sand, wind heaps it
// into a dune and lifts the finest as dust, water carries silt, and silt
// settles into loam.
const WORDS = ["ROCK", "SAND", "DUNE", "DUST", "SILT", "LOAM"];

// A wide bold face drawn as stroke centre lines on a 4 by 4 grid, y down.
// Straight strokes have square ends; the short diagonals cut the corners.
const C = 0.9, D = 4 - C;
const GLYPH = {
  A: [[0, 4, 0, C, C, 0, D, 0, 4, C, 4, 4], [0, 2.2, 4, 2.2]],
  C: [[4, 0, C, 0, 0, C, 0, D, C, 4, 4, 4]],
  D: [[0, 0, D, 0, 4, C, 4, D, D, 4, 0, 4, 0, 0]],
  E: [[4, 0, 0, 0, 0, 4, 4, 4], [0, 2, 3.2, 2]],
  I: [[1, 0, 3, 0], [2, 0, 2, 4], [1, 4, 3, 4]],
  K: [[0, 0, 0, 4], [0, 2, 1.6, 2, 4, 0], [1.6, 2, 4, 4]],
  L: [[0, 0, 0, 4, 4, 4]],
  M: [[0, 4, 0, 0, 2, 2.2, 4, 0, 4, 4]],
  N: [[0, 4, 0, 0, 4, 4, 4, 0]],
  O: [[C, 0, D, 0, 4, C, 4, D, D, 4, C, 4, 0, D, 0, C, C, 0]],
  R: [[0, 4, 0, 0, D, 0, 4, C, 4, 2 - C, D, 2, 0, 2], [2, 2, 4, 4]],
  S: [[4, 0, C, 0, 0, C, 0, 2 - C, C, 2, D, 2, 4, 2 + C, 4, D, D, 4, 0, 4]],
  T: [[0, 0, 4, 0], [2, 0, 2, 4]],
  U: [[0, 0, 0, D, C, 4, D, 4, 4, D, 4, 0]],
};
// For each grain size, in cells: letter width and height, stroke width of
// the uprights and of the bars, the gap between letters and the top margin.
const LAYOUT = [
  null,
  { lw: 36, lh: 19, sx: 5, sy: 3, gap: 3, top: 3 },
  { lw: 18, lh: 10, sx: 3, sy: 2, gap: 2, top: 2 },
  { lw: 12, lh: 7, sx: 3, sy: 1, gap: 1, top: 1 },
];
// Slot colours, top letter first: gold, rose, turquoise, violet, as in a
// bottle of layered craft sand.
const HUES = [0.12, 0.96, 0.48, 0.74];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// The cells of one letter, relative to its box.
function raster(ch, L) {
  const { lw, lh, sx, sy } = L, hx = sx / 2, hy = sy / 2;
  const mx = (x) => (sx - 1) / 2 + (x / 4) * (lw - sx), my = (y) => (sy - 1) / 2 + (y / 4) * (lh - sy);
  const segs = [];
  for (const pl of GLYPH[ch]) for (let i = 0; i + 3 < pl.length; i += 2) segs.push([mx(pl[i]), my(pl[i + 1]), mx(pl[i + 2]), my(pl[i + 3])]);
  const out = [];
  for (let Y = 0; Y < lh; Y++)
    for (let X = 0; X < lw; X++)
      for (const [ax, ay, bx, by] of segs) {
        let d;
        if (abs(ay - by) < 1e-6) d = max(max(0, min(ax, bx) - X, X - max(ax, bx)) / hx, abs(Y - ay) / hy);
        else if (abs(ax - bx) < 1e-6) d = max(max(0, min(ay, by) - Y, Y - max(ay, by)) / hy, abs(X - ax) / hx);
        else {
          const ux = (X - ax) / hx, uy = (Y - ay) / hy, vx = (bx - ax) / hx, vy = (by - ay) / hy;
          const t = cl((ux * vx + uy * vy) / (vx * vx + vy * vy), 0, 1);
          d = sqrt((ux - t * vx) ** 2 + (uy - t * vy) ** 2);
        }
        if (d < 1) {
          out.push(X, Y);
          break;
        }
      }
  return out;
}

export function setup(params) {
  params.s = { g: 0, trail: new Float32Array(W * H * 3), pal: new Float32Array(12), tmp: new Float32Array(3) };
  return params.s;
}

// Build the grid for grain size g, with word w standing and the rest of the
// sand lying on the floor in old layers.
function build(S, g, w) {
  const L = LAYOUT[g];
  const cw = floor(W / g), ch = floor(H / g);
  S.g = g;
  S.L = L;
  S.cw = cw;
  S.ch = ch;
  S.ox = floor((W - cw * g) / 2);
  S.oy = H - ch * g;
  // Target cells of every word, top letter first.
  S.targets = WORDS.map((word) => {
    const cells = [];
    const x0 = floor((cw - L.lw) / 2);
    for (let k = 0; k < 4; k++) {
      const r = raster(word[k], L), y0 = L.top + k * (L.lh + L.gap);
      for (let i = 0; i < r.length; i += 2) cells.push(x0 + r[i], y0 + r[i + 1], k);
    }
    return cells;
  });
  let most = 0;
  for (const t of S.targets) most = max(most, t.length / 3);
  const T = (S.T = most + (5 - g) * cw);
  S.grid = new Int32Array(cw * ch);
  S.x = new Float32Array(T);
  S.y = new Float32Array(T);
  S.st = new Uint8Array(T); // 0 loose sand, 1 held in a letter, 2 in flight
  S.col = new Uint8Array(T); // slot colour 0..3
  S.from = new Uint8Array(T);
  S.shade = new Float32Array(T);
  S.rel = new Float32Array(T);
  S.fx0 = new Float32Array(T);
  S.fy0 = new Float32Array(T);
  S.fcx = new Float32Array(T);
  S.fcy = new Float32Array(T);
  S.fdx = new Float32Array(T);
  S.fdy = new Float32Array(T);
  S.ft = new Float32Array(T);
  S.fdur = new Float32Array(T);
  S.slot = new Int32Array(T);
  S.stamp = new Int32Array(T);
  S.step = 0;
  for (let i = 0; i < T; i++) S.shade[i] = 0.72 + 0.28 * Math.random();
  // The word.
  const tg = S.targets[w];
  let i = 0;
  for (let j = 0; j < tg.length; j += 3, i++) put(S, i, tg[j], tg[j + 1], 1, tg[j + 2]);
  // The rest on the floor, in bands of the four colours, bottom up.
  for (let y = ch - 1; i < T; y--)
    for (let x = 0; x < cw && i < T; x++, i++) put(S, i, x, y, 0, (floor((ch - 1 - y) / 2) + 3) % 4);
  S.word = w;
  S.phase = 0;
  S.pt = 0;
  S.flying = 0;
}

function put(S, i, x, y, st, col) {
  S.x[i] = x;
  S.y[i] = y;
  S.st[i] = st;
  S.col[i] = col;
  S.grid[y * S.cw + x] = i + 1;
}

// One step of falling sand: each loose grain drops a cell if it can, else
// slides one cell diagonally down; returns how many fell or slid. Wind tips a falling grain sideways, and
// now and then rolls a grain on the surface one cell downwind, so a pile in
// the wind creeps and grows a steep lee side.
function fall(S, wind) {
  const cw = S.cw, ch = S.ch, grid = S.grid, stamp = S.stamp, step = ++S.step;
  const dir = wind > 0 ? 1 : -1, creep = abs(wind) * 0.06;
  let moved = 0;
  const flip = (S.flip = !S.flip);
  for (let y = ch - 1; y >= 0; y--)
    for (let k = 0; k < cw; k++) {
      const x = flip ? k : cw - 1 - k, o = y * cw + x, id = grid[o];
      if (!id || S.st[id - 1] !== 0 || stamp[id - 1] === step) continue;
      const i = id - 1, b = o + cw, floor_ = y === ch - 1;
      let to = -1;
      if (!floor_ && !grid[b]) {
        // Grains in the air fall at slightly different speeds, so a
        // crumbling letter smears into a curtain on the way down.
        if (Math.random() > S.shade[i]) continue;
        to = b;
        const xx = x + dir;
        if (Math.random() < abs(wind) * 0.5 && xx >= 0 && xx < cw && !grid[b + dir]) to = b + dir;
      } else if (!floor_) {
        const first = Math.random() < 0.5 + wind * 0.4 ? 1 : -1;
        for (const dx of [first, -first]) {
          const xx = x + dx;
          if (xx >= 0 && xx < cw && !grid[b + dx]) {
            to = b + dx;
            break;
          }
        }
      }
      if (to >= 0) moved++;
      else if ((y === 0 || !grid[o - cw]) && Math.random() < creep) {
        const xx = x + dir;
        if (xx >= 0 && xx < cw && !grid[o + dir]) to = o + dir;
      }
      if (to < 0) continue;
      grid[o] = 0;
      grid[to] = id;
      stamp[i] = step;
      S.x[i] = to % cw;
      S.y[i] = floor(to / cw);
    }
  return moved;
}

// The top grain of the pile in column x: the highest of the loose grains
// stacked without a gap from the floor. The two rows on the floor are
// bedrock and stay.
function topOf(S, x) {
  let y = S.ch - 1, top = -1;
  if (S.grid[y * S.cw + x] && S.grid[(y - 1) * S.cw + x]) y -= 2;
  else return -1;
  for (; y >= 0; y--) {
    const id = S.grid[y * S.cw + x];
    if (!id || S.st[id - 1] !== 0) break;
    top = id - 1;
  }
  return top;
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  const rate = cl(kv[1], 0.2, 3) / 2;
  const g = cl(round(kv[2]), 1, 3);
  S.wind = cl(kv[3], -1, 1);
  if (g !== S.g) {
    // A new grain size rebuilds the sand around the word standing now. The
    // first build opens 0.8 s into the hold.
    const first = !S.g;
    build(S, g, first ? 0 : S.word);
    S.pt = first ? 0.8 : 0;
  }
  const t = d * rate;
  S.pt += t;
  // Falling sand runs 75 LEDs a second at Speed 2.
  S.acc = (S.acc || 0) + (t * 75) / g;
  let moved = 0;
  while (S.acc >= 1) {
    S.acc -= 1;
    moved += fall(S, S.wind);
  }
  if (S.phase === 0) {
    // While the word holds, now and then a grain with nothing under it
    // runs out of a letter's foot.
    const L = S.L;
    for (let k = 0; k < S.T / 60; k++) {
      const i = floor(Math.random() * S.T);
      if (S.st[i] === 1 && S.y[i] === L.top + S.col[i] * (L.lh + L.gap) + L.lh - 1 && !S.grid[(S.y[i] + 1) * S.cw + S.x[i]] && Math.random() < t * 3) S.st[i] = 0;
    }
  }
  if (S.phase === 0 && S.pt > 2.4) {
    // Crumble: the bottom letter goes first, each letter from its foot up.
    S.phase = 1;
    S.pt = 0;
    const L = S.L;
    for (let i = 0; i < S.T; i++)
      if (S.st[i] === 1) {
        const k = S.col[i], y0 = L.top + k * (L.lh + L.gap), up = (y0 + L.lh - 1 - S.y[i]) / L.lh;
        S.rel[i] = (3 - k) * 0.6 + up * 0.95 + Math.random() * 0.12;
      }
  } else if (S.phase === 1) {
    let held = 0;
    for (let i = 0; i < S.T; i++)
      if (S.st[i] === 1) {
        if (S.rel[i] <= S.pt) S.st[i] = 0;
        else held++;
      }
    if (!held && ((!moved && S.pt > 2.5) || S.pt > 8)) {
      // Assemble the next word: queue its cells top letter first, each
      // letter from its foot up.
      S.phase = 2;
      S.pt = 0;
      S.word = (S.word + 1) % WORDS.length;
      const tg = S.targets[S.word], n = tg.length / 3, ord = [];
      for (let j = 0; j < n; j++) {
        const x = tg[3 * j], y = tg[3 * j + 1];
        ord.push([tg[3 * j + 2] * 100000 - y * 1000 + (y % 2 ? x : -x), j]);
      }
      ord.sort((a, b) => a[0] - b[0]);
      S.queue = ord.map((o) => o[1]);
      S.next = 0;
      S.launch = 0;
    }
  } else if (S.phase === 2) {
    const tg = S.targets[S.word], cw = S.cw;
    S.launch += (t * 440) / (g * g);
    while (S.launch >= 1 && S.next < S.queue.length) {
      S.launch -= 1;
      // Take the highest grain near the mouth, which wanders slowly over
      // the pile; the sand around slides into the pit it digs. Sand still
      // heaped up into the letter about to be built goes first.
      const j0 = S.queue[S.next], L = S.L;
      const foot = L.top + tg[3 * j0 + 2] * (L.lh + L.gap) + L.lh + 1;
      const mouth = round(cw / 2 + (cw / 5) * Math.sin(S.pt * 0.9));
      let best = -1, high = -1;
      for (let x = 0; x < cw; x++) {
        const id = topOf(S, x);
        if (id < 0) continue;
        if (high < 0 || S.y[id] < S.y[high]) high = id;
        if (abs(x - mouth) <= 3 && (best < 0 || S.y[id] < S.y[best])) best = id;
      }
      if (high >= 0 && (best < 0 || S.y[high] <= foot)) best = high;
      if (best < 0) break;
      const j = S.queue[S.next++], i = best;
      S.grid[S.y[i] * cw + S.x[i]] = 0;
      S.st[i] = 2;
      S.from[i] = S.col[i];
      S.col[i] = tg[3 * j + 2];
      S.slot[i] = j;
      // Every grain for one letter rides the same two control points, so
      // the grains in flight draw one rising stream from the top of the
      // pile to a point under the letter, where it fans out into the
      // letter's cells. The stream sways, and the wind leans it.
      const x0 = S.x[i], y0 = S.y[i], k = S.col[i];
      const yb = L.top + k * (L.lh + L.gap) + L.lh + 2, lx = cw / 2;
      const lean = (S.wind * 14 + 5 * Math.sin(S.pt * 1.3)) / g, jit = () => (Math.random() - 0.5) * 2;
      S.fx0[i] = x0;
      S.fy0[i] = y0;
      S.fcx[i] = x0 + lean + jit();
      S.fcy[i] = y0 - 0.55 * (y0 - yb) + jit();
      S.fdx[i] = lx + 0.6 * lean + 1.5 * jit();
      S.fdy[i] = yb + 0.1 * (y0 - yb) + jit();
      S.ft[i] = 0;
      S.fdur[i] = 0.9 + Math.random() * 0.1;
      S.flying++;
    }
    for (let i = 0; i < S.T; i++) {
      if (S.st[i] !== 2) continue;
      S.ft[i] += t;
      const j = S.slot[i], x1 = tg[3 * j], y1 = tg[3 * j + 1];
      let u = S.ft[i] / S.fdur[i];
      if (u >= 1) {
        S.flying--;
        const o = y1 * cw + x1, there = S.grid[o];
        if (there) {
          // A loose grain already sits in the cell: it joins the letter and
          // the newcomer drops in as loose sand beside it.
          const k = there - 1;
          S.st[k] = 1;
          S.col[k] = S.col[i];
          let yy = y1 - 1;
          while (yy > 0 && S.grid[yy * cw + x1]) yy--;
          put(S, i, x1, yy, 0, S.col[i]);
        } else put(S, i, x1, y1, 1, S.col[i]);
        continue;
      }
      u = u * u * (3 - 2 * u);
      const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, e = u * u * u;
      S.x[i] = a * S.fx0[i] + b * S.fcx[i] + c * S.fdx[i] + e * x1;
      S.y[i] = a * S.fy0[i] + b * S.fcy[i] + c * S.fdy[i] + e * y1;
    }
    if (S.next >= S.queue.length && !S.flying) {
      S.phase = 0;
      S.pt = 0;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.g) return;
  const g = S.g, pal = S.pal, tr = S.trail, c = S.tmp;
  for (let k = 0; k < 4; k++) hsv(HUES[k] + S.hue, 0.78, 1, pal, k * 3);
  for (let o = 0; o < tr.length; o++) tr[o] *= 0.75;
  const rgb = (S.rgb = S.rgb || new Float32Array(W * H * 3));
  rgb.set(tr);
  for (let i = 0; i < S.T; i++) {
    const sh = S.shade[i];
    let r = pal[S.col[i] * 3] * sh, gg = pal[S.col[i] * 3 + 1] * sh, b = pal[S.col[i] * 3 + 2] * sh;
    let X = S.ox + round(S.x[i] * g), Y = S.oy + round(S.y[i] * g);
    if (S.st[i] === 2) {
      // In flight: brighter, turning from the old colour to the new.
      const u = cl(S.ft[i] / S.fdur[i], 0, 1), f = S.from[i] * 3, k = S.col[i] * 3;
      r = min(255, (pal[f] + (pal[k] - pal[f]) * u) * 1.2);
      gg = min(255, (pal[f + 1] + (pal[k + 1] - pal[f + 1]) * u) * 1.2);
      b = min(255, (pal[f + 2] + (pal[k + 2] - pal[f + 2]) * u) * 1.2);
    }
    for (let yy = 0; yy < g; yy++)
      for (let xx = 0; xx < g; xx++) {
        const px = X + xx, py = Y + yy;
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const o = (py * W + px) * 3;
        rgb[o] = r;
        rgb[o + 1] = gg;
        rgb[o + 2] = b;
        if (S.st[i] === 2) {
          tr[o] = max(tr[o], r * 0.45);
          tr[o + 1] = max(tr[o + 1], gg * 0.45);
          tr[o + 2] = max(tr[o + 2], b * 0.45);
        }
      }
  }
  for (let Y = 0; Y < H; Y++)
    for (let X = 0; X < W; X++) {
      const o = (Y * W + X) * 3;
      display.setPixel(X, Y, rgb[o] | 0, rgb[o + 1] | 0, rgb[o + 2] | 0);
    }
}
