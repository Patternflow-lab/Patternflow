// ===== Patternflow pattern =====
// Title:   Knight's Tour
// Family:  algo
// Idea:    A knight tours an 8 by 16 chessboard of 8-LED squares filling the panel by Warnsdorff's rule, always jumping to the unvisited square with the fewest onward moves, each jump leaving a 1-LED line from centre to centre over the dotted lines of the tour before, until the 127 lines of a whole tour show whether it closed and fade, and the next tour starts from another square.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: knight's tour by Warnsdorff's rule (H. C. von Warnsdorff, 1823), pattern round 42
// Round:   42
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.25..12, Board=0..1, Stray=0..1
//
// Knob 1: Hue. Turns the tour's colours round the wheel. At 0 the first jumps are cyan and the last violet, the newest jumps near white, and a closed tour's jump home gold; at 0.5 the tour runs from red through orange and yellow to green and the jump home is blue.
// Knob 2: Speed. Jumps a second. At 2 a jump takes half a second, the knight gliding the 18 LEDs from centre to centre in 0.36 s and resting on its square for the rest, so a tour of 127 jumps takes about a minute; at 0.25 a jump takes 4 s, at 12 a whole tour takes 11 s.
// Knob 3: Board. Columns of squares: 8 at 0, 7 at 0.25, 6 at 0.5, 5 at 0.75 and 4 at 1, always with twice as many rows, so the board fills the panel with squares from 8 to 16 LEDs. A new board starts with a tour run up to four fifths at 40 jumps a second. No board 4 squares wide has a closed tour (Schwenk, 1991), so at 1 every tour ends open.
// Knob 4: Stray. The chance that the knight ignores the rule and takes any legal jump. Up to 0.1 it never strays, and a tour that would dead-end on an unlucky tie (2.2% of them on 8 by 16, 81% on 4 by 8) is drawn again with other ties, so every tour completes. Past 0.1 the chance climbs to 1 at 1: at 0.2 four tours in ten complete, at 0.3 one in ten, and at 1 the knight wanders at random and is stuck after about 60 of the 128 squares. A stuck square flashes red three times and a red cross marks each square left unvisited.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => {
  const t = cl(v, 0, 1);
  return t * t * (3 - 2 * t);
};
const MOVES = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
// Stray at or under DEAD never strays; a tour that dead-ends is re-rolled up to TRIES times.
const DEAD = 0.1, TRIES = 400;
// The opening shows a tour this far in, so the first frames already hold a web.
const HEAD = 0.8;
// Share of each jump spent gliding; the rest the knight rests on its square.
const GLIDE = 0.72;
// Seconds for the end: the sweep along the tour, the hold, the fade.
const SWEEP = 3, HOLD = 1.6, FADE = 2, STUCK = 2.2;
// Hue at knob 0, and how far round the wheel the tour's colours run.
const HUE0 = 0.52, SPAN = 0.3;
// Line colour: saturation and value a line settles to, the ghost's value,
// and the tint of a visited light and dark square.
const SAT = 0.75, VAL = 1, GHOST = 0.85, TINT = [0.09, 0];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    begun: false, ghost: null, hue: 0, speed: 2, stray: 0.06, planStray: 0.06, boardWait: 0,
    C: 0, R: 0, N: 0, path: null, vis: null, cx: null, cy: null, xs: null, ys: null,
    len: 0, at: 0, phase: 0, ff: 0, lastStart: -1,
    mode: "run", mt: 0, closed: false,
    rgb: new Float32Array(W * H * 3), c3: new Float32Array(3), gold: new Float32Array(3),
  };
}

const colsOf = (k) => 8 - round(cl(k, 0, 1) * 4);
const strayP = (k) => (k <= DEAD ? 0 : (k - DEAD) / (1 - DEAD));

function newBoard(P, C) {
  const R = 2 * C, N = C * R, sx = W / C;
  Object.assign(P, { C, R, N, path: new Int16Array(N), vis: new Uint8Array(N), cx: new Int16Array(N), cy: new Int16Array(N) });
  // Square (c, r) covers LEDs xs[c]..xs[c+1]-1 and ys[r]..ys[r+1]-1; its
  // centre LED is the one just up and left of the middle when the side is even.
  P.xs = Array.from({ length: C + 1 }, (_, c) => round(c * sx));
  P.ys = Array.from({ length: R + 1 }, (_, r) => round(r * sx));
  for (let q = 0; q < N; q++) {
    const c = q % C, r = floor(q / C);
    P.cx[q] = floor((P.xs[c] + P.xs[c + 1] - 1) / 2);
    P.cy[q] = floor((P.ys[r] + P.ys[r + 1] - 1) / 2);
  }
  P.lastStart = -1;
}

// Unvisited squares one knight's move from q.
function onward(P, q, list) {
  const { C, R, vis } = P, x = q % C, y = floor(q / C);
  let n = 0;
  for (const [dx, dy] of MOVES) {
    const a = x + dx, b = y + dy;
    if (a < 0 || a >= C || b < 0 || b >= R) continue;
    const t = b * C + a;
    if (vis[t]) continue;
    if (list) list[n] = t;
    n++;
  }
  return n;
}

// Plan the rest of the tour after path[0..from]. Warnsdorff's rule: the next
// square is the unvisited neighbour with the fewest unvisited neighbours of
// its own, ties broken at random; with probability p any unvisited neighbour.
function plan(P, from) {
  const { N, path, vis } = P, p = strayP(P.stray), tries = p === 0 ? TRIES : 1;
  const cand = new Int16Array(8), best = new Int16Array(8);
  P.planStray = P.stray;
  for (let t = 0; t < tries; t++) {
    vis.fill(0);
    for (let i = 0; i <= from; i++) vis[path[i]] = 1;
    let n = from + 1, q = path[from];
    while (n < N) {
      const k = onward(P, q, cand);
      if (!k) break;
      let next;
      if (p > 0 && Math.random() < p) next = cand[floor(Math.random() * k)];
      else {
        let lo = 99, m = 0;
        for (let j = 0; j < k; j++) {
          const d = onward(P, cand[j], null);
          if (d < lo) (lo = d), (m = 0);
          if (d === lo) best[m++] = cand[j];
        }
        next = best[floor(Math.random() * m)];
      }
      path[n++] = next;
      vis[next] = 1;
      q = next;
    }
    P.len = n;
    if (n === N) break;
  }
}

const isMove = (P, a, b) => {
  const dx = abs((a % P.C) - (b % P.C)), dy = abs(floor(a / P.C) - floor(b / P.C));
  return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
};

// A new tour from a square other than the last one's start, shown `head` of
// the way in at once (the opening), or run up to there at 40 jumps a second
// (`ff`, after the board changes), or from its first square.
function startTour(P, head, ff, fresh) {
  if (fresh) {
    // A new board has no tour before it, so one is run for the ghost.
    P.path[0] = floor(Math.random() * P.N);
    plan(P, 0);
    P.lastStart = P.path[0];
  }
  P.ghost = P.path.slice(0, P.len);
  let s = floor(Math.random() * P.N);
  if (s === P.lastStart) s = (s + 1 + floor(Math.random() * (P.N - 1))) % P.N;
  P.lastStart = s;
  P.path[0] = s;
  plan(P, 0);
  const target = min(round(head * P.N), max(0, P.len - 7));
  P.at = ff ? 0 : target;
  P.ff = ff ? target : 0;
  P.phase = 0;
  P.mode = "run";
  P.mt = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.25, 12);
  P.stray = cl(k[3], 0, 1);
  const cols = colsOf(k[2]);
  if (!P.begun) {
    P.begun = true;
    newBoard(P, cols);
    startTour(P, HEAD, false, true);
    return;
  }
  // The board changes once the knob has rested 0.4 s on a new size.
  if (cols !== P.C) {
    P.boardWait += d;
    if (P.boardWait >= 0.4) {
      newBoard(P, cols);
      startTour(P, HEAD, true, true);
      P.boardWait = 0;
    }
  } else P.boardWait = 0;
  // Stray moved: plan again from the square the knight is jumping to.
  if (P.mode === "run" && abs(P.stray - P.planStray) > 0.02 && P.at + 1 < P.len) plan(P, P.at + 1);

  P.mt += d;
  if (P.mode === "run") {
    const rate = P.at < P.ff ? 40 : P.speed;
    P.phase += d * rate;
    while (P.phase >= 1 && P.mode === "run") {
      P.phase -= 1;
      P.at++;
      if (P.at >= P.len - 1) {
        P.phase = 0;
        P.mt = 0;
        if (P.len === P.N) (P.mode = "end"), (P.closed = isMove(P, P.path[P.N - 1], P.path[0]));
        else P.mode = "stuck";
      }
    }
  } else if (P.mode === "end") {
    // A closed tour first jumps home along the closing line, one jump long.
    const home = P.closed ? 1 / P.speed : 0;
    if (P.mt > home + SWEEP + HOLD) (P.mode = "fade"), (P.mt = 0);
  } else if (P.mode === "stuck") {
    if (P.mt > STUCK) (P.mode = "fade"), (P.mt = 0);
  } else if (P.mode === "fade") {
    if (P.mt >= FADE) startTour(P, 0, false, false);
  }
}

// Paint the line between the centres of squares a and b up to share f of
// the way from a. The LEDs are worked out from the lower-numbered end, so a
// jump and its reverse light the same LEDs.
function seg(P, a, b, f, r, g, bl, odd = 1) {
  const { rgb } = P;
  const flip = a > b, p = flip ? b : a, q = flip ? a : b;
  const x0 = P.cx[p], y0 = P.cy[p], dx = P.cx[q] - x0, dy = P.cy[q] - y0, n = max(abs(dx), abs(dy));
  const lim = f * n + 1e-6;
  for (let i = 0; i <= n; i++) {
    if ((flip ? n - i : i) > lim) continue;
    const x = x0 + round((dx * i) / n), y = y0 + round((dy * i) / n);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const o = (y * W + x) * 3, m = i & 1 ? odd : 1;
    if (m <= 0) continue;
    (rgb[o] = r * m), (rgb[o + 1] = g * m), (rgb[o + 2] = bl * m);
  }
}

function box(P, q, r, g, b, inset) {
  const { rgb } = P, c = q % P.C, w = floor(q / P.C);
  const x0 = P.xs[c] + inset, x1 = P.xs[c + 1] - 1 - inset, y0 = P.ys[w] + inset, y1 = P.ys[w + 1] - 1 - inset;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
      const o = (y * W + x) * 3;
      (rgb[o] = r), (rgb[o + 1] = g), (rgb[o + 2] = b);
    }
}

function fill(P, q, r, g, b) {
  const { rgb } = P, c = q % P.C, w = floor(q / P.C);
  for (let y = P.ys[w]; y < P.ys[w + 1]; y++)
    for (let x = P.xs[c]; x < P.xs[c + 1]; x++) {
      const o = (y * W + x) * 3;
      (rgb[o] = r), (rgb[o + 1] = g), (rgb[o + 2] = b);
    }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.begun) return;
  const { rgb, c3, path, N, C, ghost } = P;
  rgb.fill(0);
  const base = HUE0 + P.hue, gold = P.gold;
  const hueOf = (i) => base + (SPAN * i) / (N - 1);
  // The knight's place: e is how far along jump `at` it has glided.
  const run = P.mode === "run";
  const e = run ? sm(P.phase / GLIDE) : 0;
  const done = P.at + e; // jumps made, counting the glide
  const last = run ? P.at : P.len - 1; // squares path[0..last] are visited
  // u runs 0 to 1 over the fade, while this tour turns into the next one's ghost.
  const u = P.mode === "fade" ? sm(P.mt / FADE) : 0, keep = 1 - u;

  // Visited squares: a faint tint in the colour of the jump that reached
  // them, lighter on the light squares of the chessboard.
  for (let i = 0; i <= min(last + (run ? 1 : 0), P.len - 1); i++) {
    const q = path[i], w = cl((done - i + 0.5) * 2, 0, 1) * keep;
    if (w <= 0) continue;
    const light = ((q % C) + floor(q / C)) % 2 === 0;
    hsv(hueOf(i), 0.75, (light ? TINT[0] : TINT[1]) * w, c3, 0);
    fill(P, q, c3[0], c3[1], c3[2]);
  }
  // The tour before this one, dotted: every other LED of each of its lines.
  if (ghost && keep > 0)
    for (let i = 0; i + 1 < ghost.length; i++) {
      hsv(hueOf(i), 0.85, GHOST * keep, c3, 0);
      seg(P, ghost[i], ghost[i + 1], 1, c3[0], c3[1], c3[2], 0);
    }

  // The lines, oldest first so the newest lie on top. A line fresh from the
  // knight is near white; over the next jumps it settles into its colour.
  // In the fade they dim to the ghost's level and lose every other LED.
  // The end's sweep: a gold light runs the tour in order, from the first
  // jump to the last. On a closed tour it carries on over the jump home and
  // keeps going round, since the tour is a loop.
  const end = P.mode === "end", home = P.closed ? 1 / P.speed : 0;
  const sweepAt = end ? ((P.mt - home) / SWEEP) * (N - 1 + (P.closed ? 1 : 0)) : -1e9;
  hsv(base + 0.62, 0.62, 1, gold, 0);
  const sweep = (c, lag) => {
    if (sweepAt < 0) return;
    if (P.closed) lag = ((lag % N) + N) % N;
    if (lag < 0 || lag >= 14) return;
    const w = exp(-lag / 3.5);
    for (let j = 0; j < 3; j++) c[j] += (gold[j] - c[j]) * w;
  };
  for (let i = 0; i < last + (run ? 1 : 0) && i < P.len - 1; i++) {
    const age = max(0, done - i - 1), f = i < P.at ? 1 : e;
    if (f <= 0) continue;
    const s = SAT - (SAT - 0.1) * exp(-age / 2.5), v = VAL + (1 - VAL) * exp(-age / 3);
    hsv(hueOf(i), s, v * keep + GHOST * u, c3, 0);
    sweep(c3, sweepAt - i);
    seg(P, path[i], path[i + 1], f, c3[0], c3[1], c3[2], keep);
  }
  let mx = -1, my = -1;
  if (end || (P.mode === "fade" && P.len === N)) {
    const a = path[N - 1], b = path[0];
    if (P.closed) {
      // The jump home, gold, drawn at the knight's pace.
      const f = end ? sm((P.mt * P.speed) / GLIDE) : 1;
      hsv(base + 0.62, 0.7, keep, c3, 0);
      sweep(c3, sweepAt - (N - 1));
      seg(P, a, b, f, c3[0], c3[1], c3[2]);
      if (f < 1) (mx = P.cx[a] + (P.cx[b] - P.cx[a]) * f), (my = P.cy[a] + (P.cy[b] - P.cy[a]) * f);
    } else {
      // An open tour: once the sweep reaches the end, its two ends are boxed.
      const w = (end ? cl(sweepAt - (N - 1) + 1, 0, 1) : 1) * keep;
      hsv(base + 0.62, 0.7, w, c3, 0);
      box(P, a, c3[0], c3[1], c3[2], 1);
      box(P, b, c3[0], c3[1], c3[2], 1);
    }
  }
  if (P.mode === "stuck" || (P.mode === "fade" && P.len < N)) {
    // Stuck: a small red cross on each square the walk can no longer reach.
    const seen = new Uint8Array(N);
    for (let i = 0; i < P.len; i++) seen[path[i]] = 1;
    for (let q = 0; q < N; q++) {
      if (seen[q]) continue;
      const x = P.cx[q], y = P.cy[q], w = 0.7 * keep;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const o = ((y + dy) * W + x + dx) * 3;
        (rgb[o] = w), (rgb[o + 1] = 0.1 * w), (rgb[o + 2] = 0.15 * w);
      }
    }
  }
  if (P.mode === "stuck") {
    // The square the knight is stuck on flashes three times.
    const w = sin((PI * 3 * P.mt) / STUCK) ** 2;
    fill(P, path[P.len - 1], 0.95 * w, 0.12 * w, 0.1 * w);
  }
  if (run) {
    const a = path[P.at], b = path[min(P.at + 1, P.len - 1)];
    (mx = P.cx[a] + (P.cx[b] - P.cx[a]) * e), (my = P.cy[a] + (P.cy[b] - P.cy[a]) * e);
  }
  if (mx >= 0) {
    // The knight: a white point with a small soft cross.
    const x = round(mx), y = round(my);
    for (const [dx, dy, l] of [[0, 0, 1], [1, 0, 0.55], [-1, 0, 0.55], [0, 1, 0.55], [0, -1, 0.55]]) {
      const px = x + dx, py = y + dy;
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const o = (py * W + px) * 3;
      (rgb[o] = max(rgb[o], l)), (rgb[o + 1] = max(rgb[o + 1], l)), (rgb[o + 2] = max(rgb[o + 2], l));
    }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, min(255, rgb[o] * 255), min(255, rgb[o + 1] * 255), min(255, rgb[o + 2] * 255));
}
