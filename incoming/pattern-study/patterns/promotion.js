// ===== Patternflow pattern =====
// Title:   Promotion
// Family:  algo
// Idea:    A random standard Young tableau of 8 by 16 cells fills the panel, its 128 entries rising along every row and down every column, each cell coloured by its entry and the gutters lit where the entries pass a quarter, a half and three quarters of 128 so three nested staircases show, and Schützenberger's promotion runs on it again and again: the 1 in the top-left corner lifts out as a white hole, the hole slides by jeu de taquin to the bottom-right corner, each step pulling in the smaller of its right and lower neighbours behind a short bright tail, every entry drops by one so the bands creep outward while the hole's path pushes them back, 128 goes into the corner, and a bar along the foot counts the promotions until, after exactly 128 of them, every cell is back where it started and the tableau flashes home.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: promotion of standard Young tableaux (Marcel-Paul Schützenberger, 1972) by jeu de taquin (Schützenberger, 1977), whose order on an a by b rectangle is exactly ab (Mark Haiman, 1992), the start of Brendon Rhoades's cyclic sieving for promotion (2010); the tableau drawn uniformly by the hook walk of Curtis Greene, Albert Nijenhuis and Herbert Wilf (1979); 3 by 5 digits copied from hydra-game.js (round 72); pattern round 74
// Round:   74
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=-1..2, Levels=0..1
//
// Knob 1: Hue. Turns the ramp round the wheel: at 0 the small entries in the top-left corner are azure, the middle ones violet and magenta, the large ones at the bottom-right orange and yellow; at 0.5 the ramp runs from red-orange through yellow and green to blue.
// Knob 2: Speed. At 2 the 1 lifts out in 0.25 s, each slide of the hole takes 0.08 s on 8 LED cells (the glide is 100 LEDs a second at every size), 128 goes in over 0.25 s: a promotion of the 8 by 16 tableau takes 2.26 s and the way home 4.8 minutes. Every time scales as 2 / Speed: at 3 the way home takes 3.3 minutes, at 0.2 a promotion takes 23 s.
// Knob 3: Size. The cell size, 8 LEDs at the opening 0: 8 by 16 cells, N = 128, 22 slides a promotion. At -1 cells of 4 LEDs, 16 by 32, N = 512, 46 slides and 20 minutes home; at 1 cells of 16 LEDs, 4 by 8, N = 32, 10 slides, 67 s home, each entry written in the cell; at 2 cells of 32 LEDs, 2 by 4, N = 8, 4 slides, 14 s home, the digits twice the size, and some of its 14 tableaux come home after 2 or 4 promotions, as cyclic sieving counts. A new size draws a new tableau.
// Knob 4: Levels. How many bands the ramp is cut into: 4 at the opening 0.06, so three staircases, the edges of the Young diagrams of entries up to N/4, N/2 and 3N/4, stand in the lit gutters and the cells brighten and dim once a band; 8 at 0.5 (every 16 entries on 8 by 16); 16 at 1, where the 15 staircases nest close as contour lines of the tableau.
// Buttons: K1 tap draws a new random tableau and starts the count again.

// A standard Young tableau of a rectangular shape holds 1 to N once each,
// increasing along rows and down columns. Promotion: take out the 1 at
// the corner, and while the hole has a neighbour to its right or below,
// move the smaller of the two into it; the hole ends at the far corner.
// Take 1 from every entry and write N there. Haiman (1992) proved that on
// an a by b rectangle doing this N = ab times gives back the tableau you
// started from, for every tableau, though a single promotion moves only
// one staircase of cells. The bar along the foot counts to N; a white dot
// marks each cell that holds what it held at the start, and at N they all
// light at once. A tableau can come home sooner, after a divisor of N, and
// Rhoades (2010) counted how many do; on 8 by 16 a random one almost never.
//
// The cells holding 1 to m always form a Young diagram, a staircase from
// the top-right edge to the bottom-left; the gutters on its edge are lit
// for every m that is a multiple of N / Levels. A promotion turns the
// diagram of 1 to m + 1 into that of 1 to m by taking off the corner
// where the hole left it, so each staircase moves by at most a cell a
// promotion: the falling entries push it out and the path pulls it in.
//
// The start is uniform among all tableaux of the shape: the hook walk
// places N, N-1, ... 1 in turn, each by starting on a random free cell
// and jumping to a random cell of its hook, to the right or below, until
// it stands on a corner.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
function hsv(h, s, v, o, k) {
  h = frac(h) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// 3 by 5 digits, copied from hydra-game.js (round 72), rows top to bottom.
const DIG = ["111101101101111", "010110010010111", "111001111100111", "111001011001111", "101101111001001",
  "111100111001111", "111100111101111", "111001010010010", "111101111101111", "111101111001111"];

// The hook walk (Greene, Nijenhuis and Wilf, 1979) on a rows of a cells.
function randomTableau(a, b) {
  const N = a * b, T = new Int16Array(N), len = new Int16Array(b).fill(a);
  for (let n = N; n >= 1; n--) {
    // A uniformly random cell of the shape still free.
    let pick = floor(Math.random() * n), r = 0;
    while (pick >= len[r]) pick -= len[r++];
    let c = pick;
    for (;;) {
      const arm = len[r] - c - 1;
      let leg = 0;
      while (r + leg + 1 < b && len[r + leg + 1] > c) leg++;
      if (arm + leg === 0) break;
      const m = floor(Math.random() * (arm + leg));
      if (m < arm) c += 1 + m;
      else r += 1 + m - arm;
    }
    T[r * a + c] = n;
    len[r]--;
  }
  return T;
}

// One promotion of T in place; returns the hole's path as cell indices.
function promote(T, a, b) {
  const N = a * b, path = [0];
  let r = 0, c = 0;
  for (;;) {
    const right = c + 1 < a ? T[r * a + c + 1] : 1e9, down = r + 1 < b ? T[(r + 1) * a + c] : 1e9;
    if (right === 1e9 && down === 1e9) break;
    if (right < down) T[r * a + c] = right, c++;
    else T[r * a + c] = down, r++;
    path.push(r * a + c);
  }
  for (let i = 0; i < N; i++) T[i]--;
  T[r * a + c] = N;
  return path;
}

function newTableau(s) {
  const cell = 8 * 2 ** s.size, a = W / cell, b = H / cell;
  Object.assign(s, { cell, a, b, N: a * b, k: 0, phase: 0, pt: 0, j: 0, u: 0 });
  s.T = randomTableau(a, b);
  s.T0 = s.T.slice();
  s.home = new Uint8Array(s.N).fill(1);
  s.eh = new Float32Array((a - 1) * b);
  s.ev = new Float32Array(a * (b - 1));
  s.col = new Float32Array(s.N * 3);
  startPromotion(s);
}

// Work out the promotion ahead, then let the animation walk through it.
function startPromotion(s) {
  s.next = s.T.slice();
  s.path = promote(s.next, s.a, s.b);
  s.Wk = s.T.slice();
  s.phase = 0;
  s.pt = 0;
  s.j = 0;
}

export function setup(params) {
  const s = (params.s = { size: 0, hue: 0, speed: 2, levels: 4, flash: 0, btn: false });
  newTableau(s);
  return s;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  s.hue = k[0] || 0;
  s.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const size = round(cl(k[2] || 0, -1, 2)), btn = !!(input.btnPressed && input.btnPressed[0]);
  if (size !== s.size || (btn && !s.btn)) (s.size = size), newTableau(s);
  s.btn = btn;
  // Levels: 4 bands of N / 4 entries at the opening, 16 at 1.
  s.levels = round(4 * 2 ** (2 * cl(k[3] == null ? 0.06 : k[3], 0, 1)));
  const sc = 2 / s.speed, tRem = 0.25 * sc, tStep = 0.01 * s.cell * sc, tIns = 0.25 * sc;
  const L = s.path.length - 1, total = tRem + L * tStep + tIns;
  // The hole's staircase fades in 0.3 s at Speed 2, a comet's tail.
  const fade = exp(-dt / (0.3 * sc));
  for (let i = 0; i < s.eh.length; i++) s.eh[i] *= fade;
  for (let i = 0; i < s.ev.length; i++) s.ev[i] *= fade;
  s.flash = max(0, s.flash - dt / 1.4);
  s.pt += dt;
  // Phases: 0 the 1 lifts out, 1 the hole slides, 2 N goes in.
  for (let guard = 0; guard < 64; guard++) {
    if (s.phase === 0 && s.pt >= tRem) (s.phase = 1), (s.pt -= tRem), (s.Wk[0] = -1);
    else if (s.phase === 1 && s.pt >= tStep && s.j < L) {
      const from = s.path[s.j + 1], to = s.path[s.j];
      s.Wk[to] = s.Wk[from];
      s.Wk[from] = -1;
      // Light the edge the hole crossed.
      const a = s.a, lo = min(from, to);
      if (abs(from - to) === 1) s.eh[floor(lo / a) * (a - 1) + (lo % a)] = 1;
      else s.ev[lo] = 1;
      s.j++;
      s.pt -= tStep;
    } else if (s.phase === 1 && s.j >= L) s.phase = 2;
    else if (s.phase === 2 && s.pt >= tIns) {
      s.pt -= tIns;
      s.T = s.next;
      s.k = (s.k + 1) % s.N;
      let all = 1;
      for (let i = 0; i < s.N; i++) (s.home[i] = s.T[i] === s.T0[i] ? 1 : 0), (all &= s.home[i]);
      if (all) s.flash = 1;
      startPromotion(s);
    } else break;
  }
  const done = s.phase === 0 ? s.pt : s.phase === 1 ? tRem + s.j * tStep + min(s.pt, tStep) : tRem + L * tStep + s.pt;
  s.u = cl(done / total, 0, 1);
  s.f = s.phase === 0 ? s.pt / tRem : s.phase === 1 ? s.pt / tStep : s.pt / tIns;
}

// The ramp: the hue runs 0.62 of the wheel from entry 1 to N, and the
// brightness waves once over each band of N / Levels entries, at its
// middle where the bands meet.
function colourOf(s, x, out, k) {
  const N = s.N, t = (x - 1) / (N - 1);
  hsv(0.55 + s.hue + 0.62 * t, 0.8, 0.84 + 0.14 * sin((PI * (x - 1) * s.levels) / N), out, k);
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const { a, cell, N, Wk, col, path } = s, c1 = cell - 1, u = s.u;
  const hole = [1, 0.97, 0.9];
  // Every cell's colour; the entries fall by u on the way to the next
  // tableau, so the bands flow outward while a promotion runs.
  const band = s.band && s.band.length === N ? s.band : (s.band = new Int16Array(N)), bw = N / s.levels;
  for (let i = 0; i < N; i++) {
    if (Wk[i] < 0) (col[i * 3] = hole[0]), (col[i * 3 + 1] = hole[1]), (col[i * 3 + 2] = hole[2]), (band[i] = -1);
    else colourOf(s, Wk[i] - u, col, i * 3), (band[i] = floor((Wk[i] - u - 1 + 1e-6) / bw));
  }
  const f = ease(s.f);
  // The 1 lifting out turns white; N coming in comes out of white.
  if (s.phase === 0) for (let q = 0; q < 3; q++) col[q] += (hole[q] - col[q]) * f;
  const corner = N - 1, ins = [0, 0, 0];
  if (s.phase === 2) {
    colourOf(s, N + 1 - u, ins, 0);
    for (let q = 0; q < 3; q++) col[corner * 3 + q] = hole[q] + (ins[q] - hole[q]) * f;
  }
  // The gliding cell: during a slide it leaves path[j+1] (now drawn as the
  // hole) and moves over the hole at path[j].
  let gx = -99, gy = -99, gc = null, gv = 0;
  if (s.phase === 1 && s.j < path.length - 1) {
    const from = path[s.j + 1], to = path[s.j];
    gc = [0, 0, 0];
    colourOf(s, Wk[from] - u, gc, 0);
    gv = Wk[from];
    for (let q = 0; q < 3; q++) col[from * 3 + q] = hole[q];
    gx = ((from % a) + ((to % a) - (from % a)) * f) * cell;
    gy = (floor(from / a) + (floor(to / a) - floor(from / a)) * f) * cell;
  }
  const fl = s.flash * 0.55, px = s.px || (s.px = new Float32Array(W * H * 3));
  for (let y = 0; y < H; y++) {
    const row = floor(y / cell), iy = y - row * cell;
    for (let x = 0; x < W; x++) {
      const cc = floor(x / cell), ix = x - cc * cell, i = row * a + cc;
      let r = 0.025, g = 0.025, b = 0.05;
      if (ix < c1 && iy < c1) (r = col[i * 3]), (g = col[i * 3 + 1]), (b = col[i * 3 + 2]);
      else {
        // A gutter on a band's edge is lit: the cells with entries up to a
        // multiple of N / a form a Young diagram, and these are its edges.
        const me = band[i], rt = ix === c1 && cc + 1 < a ? band[i + 1] : me, dn = iy === c1 && row + 1 < s.b ? band[i + a] : me;
        const dg = ix === c1 && iy === c1 && cc + 1 < a && row + 1 < s.b ? band[i + a + 1] : me;
        if (me >= 0 && ((rt >= 0 && rt !== me) || (dn >= 0 && dn !== me) || (dg >= 0 && dg !== me))) (r = 0.62), (g = 0.6), (b = 0.66);
      }
      // The gliding block, with soft edges where it sits between LEDs.
      if (gc) {
        const ox = cl(min(x + 1 - gx, gx + c1 - x), 0, 1), oy = cl(min(y + 1 - gy, gy + c1 - y), 0, 1), w = ox * oy;
        if (w > 0) (r += (gc[0] - r) * w), (g += (gc[1] - g) * w), (b += (gc[2] - b) * w);
      }
      if (fl > 0) (r += (1 - r) * fl), (g += (1 - g) * fl), (b += (1 - b) * fl);
      const k = (y * W + x) * 3;
      px[k] = r;
      px[k + 1] = g;
      px[k + 2] = b;
    }
  }
  const put = (x, y, r, g, b, w) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const k = (y * W + x) * 3;
    px[k] += (r - px[k]) * w;
    px[k + 1] += (g - px[k + 1]) * w;
    px[k + 2] += (b - px[k + 2]) * w;
  };
  // The staircases the hole has left, through the cells' middles.
  const lw = cell <= 4 ? 1 : cell <= 8 ? 2 : 3, off = round((c1 - lw) / 2), tc = [1, 0.93, 0.78], ta = 0.9;
  for (let rr = 0; rr < s.b; rr++)
    for (let cc = 0; cc < a; cc++) {
      const x0 = cc * cell + off, y0 = rr * cell + off;
      const eh = cc < a - 1 ? s.eh[rr * (a - 1) + cc] : 0, ev = rr < s.b - 1 ? s.ev[rr * a + cc] : 0;
      if (eh > 0.01) for (let x = x0; x < x0 + cell + lw; x++) for (let d = 0; d < lw; d++) put(x, y0 + d, tc[0], tc[1], tc[2], ta * eh);
      if (ev > 0.01) for (let y = y0; y < y0 + cell + lw; y++) for (let d = 0; d < lw; d++) put(x0 + d, y, tc[0], tc[1], tc[2], ta * ev);
    }
  // Entries written in the cells when they are 16 LEDs or more.
  if (cell >= 16) {
    const sz = cell >= 32 ? 2 : 1;
    const write = (v, x0, y0) => {
      const str = String(v), wdt = str.length * 4 * sz - sz;
      let x = round(x0 + (c1 - wdt) / 2);
      const y = round(y0 + (c1 - 5 * sz) / 2);
      for (const ch of str) {
        const bits = DIG[ch.charCodeAt(0) - 48];
        for (let p = 0; p < 15; p++)
          if (bits[p] === "1")
            for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) put(x + (p % 3) * sz + dx, y + floor(p / 3) * sz + dy, 0.03, 0.02, 0.06, 0.88);
        x += 4 * sz;
      }
    };
    for (let i = 0; i < N; i++) if (Wk[i] > 0 && !(gc && i === path[s.j + 1])) write(Wk[i], (i % a) * cell, floor(i / a) * cell);
    if (gc) write(gv, gx, gy);
  }
  // A white dot in each cell that holds what it held at the start.
  const dsz = cell <= 4 ? 1 : 2;
  for (let i = 0; i < N; i++)
    if (s.home[i] && Wk[i] > 0) {
      const x0 = (i % a) * cell + c1 - dsz - (cell > 4 ? 1 : 0), y0 = floor(i / a) * cell + (cell > 4 ? 1 : 0);
      for (let dy = 0; dy < dsz; dy++) for (let dx = 0; dx < dsz; dx++) put(x0 + dx, y0 + dy, 1, 1, 1, 0.95);
    }
  // The count: a bar along the bottom gutter, k + u of N, with a tick at
  // each band.
  const bar = ((s.k + u) / N) * W;
  for (let x = 0; x < W; x++) {
    const w = cl(bar - x, 0, 1), tick = ((x + 1) % (W / a) === 0) ? 0.25 : 0;
    put(x, H - 1, 1, 0.85, 0.55, max(w * 0.9, tick));
  }
  for (let i = 0; i < W * H; i++)
    display.setPixel(i % W, floor(i / W), round(cl(px[i * 3], 0, 1) * 255), round(cl(px[i * 3 + 1], 0, 1) * 255), round(cl(px[i * 3 + 2], 0, 1) * 255));
}
