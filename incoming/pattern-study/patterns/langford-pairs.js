// ===== Patternflow pattern =====
// Title:   Langford Pairs
// Family:  number
// Idea:    A backtracking search stacks two blocks of each of n colours into a tower the height of the panel, placing the pairs from the largest down so that the two blocks of colour k have k blocks between them, with an arc beside the tower joining each pair, and every arrangement it finds slides aside onto a shelf of finished towers while the search goes on.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Langford's problem (C. Dudley Langford, Mathematical Gazette, 1958), solutions only for n ≡ 0 or 3 mod 4 (Roy O. Davies, 1959), Skolem sequences (Thoralf Skolem, 1957), pattern round 69
// Round:   69
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pairs=7..12, Rule=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 pairs 1, 2 and 3 are red, blue and yellow, the blocks Langford watched his son stack, and each larger pair is 0.58 of a turn on from the one before.
// Knob 2: Speed. 40 steps a second at 2, where a step places a pair or takes one back; 4 at 0.2 and 60 at 3. While nothing turns up the search doubles its pace every 1.5 s, up to 30,000 steps a second, and falls back at each arrangement it finds.
// Knob 3: Pairs. n from 7 to 12, so the tower is 14 to 24 blocks of 128 / 2n rows. Counted once with its reversal, 7 has 26 arrangements, 8 has 150, 11 has 17,792 and 12 has 108,144; 9 and 10 have none, and their searches run out and fail. When a search has tried everything, n goes up by one, and 12 goes back to 7.
// Knob 4: Rule. Below 0.5 Langford's rule, k blocks between the two of colour k. From 0.5 Skolem's, the two of colour k stand k places apart, so the two 1s touch; that works for n = 8 (252), 9 (1,328) and 12 (227,968), and fails for 7, 10 and 11.
// Buttons: any knob's button gives up on this n and moves on to the next.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Layout. The search tower stands at the right, 10 LEDs wide, with the
// arcs to its left and a progress line in the last column. Finished towers
// are 5 LEDs wide, 7 apart, the newest at x 29 and the oldest falling off
// the left edge.
const TX = 52, TW = 10, PBX = 63, SW = 5, SS = 7, S0 = 29, NMIN = 7, NMAX = 12;
const top = (n, i) => round((i * H) / (2 * n));

// ---- The search. Pairs go in from n down to 1; pair k tries each place i
// whose partner i + gap is free, left to right. Langford's gap is k + 1 (k
// blocks between), Skolem's is k. A reversed arrangement is the same one, so
// pair n only tries the top half of its places; when it sits exactly in the
// middle an arrangement and its reversal both turn up, and only the one that
// reads smaller from the top is kept.
// Enumerated this way: Langford 3:1, 4:1, 7:26, 8:150, 11:17792, 12:108144,
// and none for 5, 6, 9, 10; Skolem 4:3, 5:5, 8:252, 9:1328, 12:227968.
const gap = (S, k) => k + 1 - S.rule;
const hiOf = (S, k) => {
  const last = 2 * S.n - 1 - gap(S, k);
  return k === S.n ? floor(last / 2) : last;
};

function fresh(S, n, rule) {
  S.n = n;
  S.rule = rule;
  S.slot = new Int8Array(2 * n);
  S.pos = new Int16Array(n + 2).fill(-1);
  S.cur = new Int16Array(n + 2);
  S.glow = new Float32Array(n + 2);
  S.ghost = new Float32Array(n + 2);
  S.gpos = new Int16Array(n + 2);
  S.k = n;
  S.found = 0;
  S.stuck = 0;
  S.acc = 0;
  S.hold = 0;
  S.end = -1;
}

function place(S, k, i) {
  S.slot[i] = S.slot[i + gap(S, k)] = k;
  S.pos[k] = i;
  S.glow[k] = 1;
}
function unplace(S, k) {
  const i = S.pos[k];
  S.slot[i] = S.slot[i + gap(S, k)] = 0;
  S.pos[k] = -1;
  S.ghost[k] = 1;
  S.gpos[k] = i;
}
function reversedFirst(S) {
  const n = S.n, L = 2 * n, i = S.pos[n];
  if (i !== L - 1 - gap(S, n) - i) return false;
  for (let a = 0; a < L; a++) if (S.slot[a] !== S.slot[L - 1 - a]) return S.slot[a] > S.slot[L - 1 - a];
  return false;
}

// One step: place the next pair, or take one back. Returns 0 placed,
// 1 taken back, 2 found, 3 found the reversal of one already kept, 4 done.
function step(S) {
  if (S.k === 0) {
    unplace(S, 1);
    S.k = 1;
    return 1;
  }
  const k = S.k, g = gap(S, k), hi = hiOf(S, k), sl = S.slot;
  for (let i = S.cur[k]; i <= hi; i++) {
    if (sl[i] || sl[i + g]) continue;
    place(S, k, i);
    S.cur[k] = i + 1;
    if (k > 1) {
      S.k = k - 1;
      S.cur[k - 1] = 0;
      return 0;
    }
    S.k = 0;
    return reversedFirst(S) ? 3 : 2;
  }
  if (k === S.n) return 4;
  unplace(S, k + 1);
  S.k = k + 1;
  return 1;
}

// How far through the tree the search is: pair n's place out of its range,
// then pair n - 1's inside that, and so on four levels down.
function progress(S) {
  if (S.end >= 0) return 1;
  let p = 0, w = 1;
  for (let k = S.n; k > S.n - 4 && k >= 1; k--) {
    const span = hiOf(S, k) + 1, at = S.pos[k] >= 0 ? S.pos[k] : min(span, S.cur[k]);
    p += (w * at) / span;
    w /= span;
    if (S.pos[k] < 0) break;
  }
  return cl(p, 0, 1);
}

export function setup(params) {
  params.s = { t: 0, hue: 0, speed: 2, kn: -1, krule: -1, shelf: [], flash: 0, rgb: new Float32Array(W * H * 3) };
}

function advance(S) {
  fresh(S, S.n >= NMAX ? NMIN : S.n + 1, S.rule);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 7, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  const n = cl(round(kv[2]), NMIN, NMAX), rule = kv[3] >= 0.5 ? 1 : 0;
  if (n !== S.kn || rule !== S.krule) {
    S.kn = n;
    S.krule = rule;
    fresh(S, n, rule);
  }
  // Time in the seconds of Speed 2.
  const nom = (d * S.speed) / 2;
  S.t += d;
  const fade = exp(-d / 0.25), gfade = exp(-d / 0.12);
  for (let k = 1; k <= S.n; k++) (S.glow[k] *= fade), (S.ghost[k] *= gfade);
  S.flash *= exp(-d / 0.3);
  // The shelf eases toward its places; a tower that has left the panel goes.
  S.shelf.forEach((tw, j) => (tw.x += (S0 - SS * j - tw.x) * (1 - exp(-d * 6))));
  while (S.shelf.length && S.shelf[S.shelf.length - 1].x < -SW - 1) S.shelf.pop();

  if (input.btnPressed && input.btnPressed.some(Boolean)) return advance(S);
  if (S.end >= 0) {
    // The search has run out: 1.4 s to show it, then the next n.
    S.end += nom;
    if (S.end > 1.4) advance(S);
    return;
  }
  if (S.hold > 0) {
    S.hold -= nom;
    return;
  }
  S.stuck += nom;
  const rate = min(30000, 20 * S.speed * 2 ** (max(0, S.stuck - 2) / 1.5));
  S.acc += d * rate;
  let steps = floor(S.acc);
  if (steps > 1000) (steps = 1000), (S.acc = 0);
  else S.acc -= steps;
  while (steps-- > 0) {
    const r = step(S);
    if (r === 2) {
      S.found++;
      S.shelf.unshift({ seq: Int8Array.from(S.slot), n: S.n, x: TX });
      if (S.shelf.length > 8) S.shelf.length = 8;
      S.hold = 0.35;
      S.stuck = 0;
      S.flash = 1;
      S.acc = 0;
      break;
    }
    if (r === 4) {
      S.end = 0;
      S.acc = 0;
      break;
    }
  }
}

// A block from row y0 to y1 - 1 between columns x0 and x1 - 1, its last row
// left dark as the seam to the next; the top row catches the light.
function block(rgb, x0, x1, y0, y1, c, v) {
  const last = y1 - 1 - (y1 - y0 > 3 ? 1 : 0);
  for (let y = y0; y < last; y++) {
    const sh = v * (y === y0 ? 1 : y === last - 1 ? 0.58 : 0.8);
    for (let x = max(0, x0); x < min(W, x1); x++) {
      const o = (y * W + x) * 3;
      rgb[o] += c[0] * sh;
      rgb[o + 1] += c[1] * sh;
      rgb[o + 2] += c[2] * sh;
    }
  }
}

function dot(rgb, x, y, c, a) {
  const x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const px = x0 + i, py = y0 + j;
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const w = a * (i ? fx : 1 - fx) * (j ? fy : 1 - fy), o = (py * W + px) * 3;
      rgb[o] += c[0] * w;
      rgb[o + 1] += c[1] * w;
      rgb[o + 2] += c[2] * w;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.slot) return;
  const rgb = S.rgb;
  rgb.fill(0);
  // Pair k's colour steps 0.58 of a turn, so 1, 2 and 3 open red, blue and
  // yellow and neighbours never share a hue.
  const pal = [];
  for (let k = 0; k <= NMAX; k++) pal.push(hsv(S.hue + 0.58 * (k - 1), 0.78, 1));

  // The shelf. A tower leaving the search narrows from 10 LEDs to 5 as it goes.
  for (const tw of S.shelf) {
    const u = cl((tw.x - S0) / (TX - S0), 0, 1), x0 = round(tw.x), w = round(SW + (TW - SW) * u);
    for (let i = 0; i < 2 * tw.n; i++) block(rgb, x0, x0 + w, top(tw.n, i), top(tw.n, i + 1), pal[tw.seq[i]], 0.72 + 0.23 * u);
  }

  // The search tower: placed blocks, the empty places as faint frames, and a
  // pair just taken back fading where it stood.
  const n = S.n, L = 2 * n, fl = S.flash;
  const failing = S.end >= 0 && S.found === 0, blink = failing && (S.end * 3) % 1 < 0.5;
  const frame = failing ? [blink ? 0.75 : 0.25, 0.12, 0.08] : S.end >= 0 ? [0.4, 0.45, 0.5] : [0.11, 0.13, 0.17];
  for (let i = 0; i < L; i++) {
    const y0 = top(n, i), y1 = top(n, i + 1), k = S.slot[i];
    if (k) {
      const g = S.glow[k] * 0.45 + fl * 0.3, c = pal[k];
      block(rgb, TX, TX + TW, y0, y1, [c[0] + (1 - c[0]) * g, c[1] + (1 - c[1]) * g, c[2] + (1 - c[2]) * g], 1);
      continue;
    }
    for (let y = y0; y < y1 - 1; y++)
      for (let x = TX; x < TX + TW; x++) {
        if (y !== y0 && y !== y1 - 2 && x !== TX && x !== TX + TW - 1) continue;
        const o = (y * W + x) * 3;
        rgb[o] += frame[0], rgb[o + 1] += frame[1], rgb[o + 2] += frame[2];
      }
  }
  for (let k = 1; k <= n; k++) {
    const a = S.ghost[k];
    if (a < 0.03 || S.pos[k] >= 0) continue;
    for (const i of [S.gpos[k], S.gpos[k] + gap(S, k)]) if (!S.slot[i]) block(rgb, TX + 2, TX + TW - 2, top(n, i), top(n, i + 1), pal[k], 0.45 * a);
  }

  // Arcs: each placed pair joined by half an ellipse bulging left from the
  // centres of its two blocks, wider for larger k.
  for (let k = 1; k <= n; k++) {
    const i = S.pos[k];
    if (i < 0) continue;
    const j = i + gap(S, k), ya = (top(n, i) + top(n, i + 1) - 1) / 2, yb = (top(n, j) + top(n, j + 1) - 1) / 2;
    const yc = (ya + yb) / 2, ry = (yb - ya) / 2, rx = 2.5 + (11 * (k - 1)) / (n - 1);
    const len = PI * sqrt((rx * rx + ry * ry) / 2), m = Math.ceil(len * 2.5), c = pal[k];
    const a = 0.5 * (0.75 + S.glow[k] * 0.5 + fl * 0.4);
    for (let s = 0; s <= m; s++) {
      const th = -PI / 2 + (PI * s) / m;
      dot(rgb, TX - 1.5 - rx * cos(th), yc + ry * sin(th), c, a);
    }
  }

  // The progress line: how much of the tree lies behind the search.
  const py = progress(S) * H;
  for (let y = 0; y < H; y++) {
    const v = y < py ? (failing ? 0.5 : 0.32) : 0.06, o = (y * W + PBX) * 3;
    rgb[o] += v * (failing ? 1 : 0.8);
    rgb[o + 1] += v * (failing ? 0.25 : 0.85);
    rgb[o + 2] += v * (failing ? 0.15 : 1);
  }

  for (let p = 0; p < W * H; p++)
    display.setPixel(p % W, floor(p / W), (255 * min(1, rgb[p * 3])) | 0, (255 * min(1, rgb[p * 3 + 1])) | 0, (255 * min(1, rgb[p * 3 + 2])) | 0);
}
