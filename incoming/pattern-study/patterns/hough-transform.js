// ===== Patternflow pattern =====
// Title:   Hough Transform
// Family:  algo
// Idea:    Points land one by one on the top square, most of them on a few slowly turning line segments and the rest anywhere, and as each lands its sinusoid rho = x cos theta + y sin theta is swept column by column into the accumulator below while the line through the point at that theta turns round it above; the sinusoids of collinear points all cross at one bright peak, the strongest peaks are picked, and each one's line is drawn back across the square and its sinusoids tinted in one colour, while old points and their votes fade.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Hough transform (Paul Hough, 1962), its rho-theta form (Richard Duda and Peter Hart, 1972), pattern round 60
// Round:   60
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lines=2..6, Noise=0.3..0.9
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the accumulator glows deep blue through azure to white and the found lines are lime, magenta, gold, sky, violet and green; the accumulator keeps to a strip of the wheel without orange and yellow, which go brown when dim, so at 0.25 it is violet, at 0.5 rose and magenta, at 0.75 teal and green, while the lines go the whole way round. The points stay white.
// Knob 2: Speed. At 2 eight points land a second, the newest point's sinusoid sweeps the 64 columns in 0.11 s, a point and its votes fade by e every 6 s and are gone after 18 s, and each line turns 0.4 to 1 degree a second while its distance from the centre drifts 3 to 7 LEDs either way over 1.5 to 3.5 minutes; at 0.2 all of it ten times slower, a point every 1.25 s whose sweep takes 1.06 s, at 3 half as fast again.
// Knob 3: Lines. How many line segments the points come from and how many peaks are picked, 2 to 6, rounded. At 2, with the opening's noise, each line holds about 16 of the 46 points' worth of weight, and in three 2-minute runs the picked peaks found the lines 99% of the time, within 0.15 rad of theta and 4 LEDs of rho; with 4 lines 81%, with 6 lines 64%, and a third of the 6 peaks then stand on crossings of noise.
// Knob 4: Noise. The share of landing points that fall anywhere on the square instead of on a line: 0.3 at the opening, so the noise sinusoids lace the accumulator thinly in blue; at 0.6 the 2 lines are still found 87% of the time; at 0.9 one point in ten is on a line, the noise weaves a mesh whose crossings stand as high as the lines' peaks, and the 2 lines are found 20% of the time.

const W = 64, H = 128, SQ = 64, NT = 64, NR = 64;
const { floor, min, max, round, abs, sin, cos, exp, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The accumulator's colours come off a strip of the wheel that skips red,
// orange and yellow, which turn brown and olive when dim: u from 0 to 1
// runs green, cyan, blue, violet, magenta to rose.
const wheel = (u) => 0.34 + 0.63 * (u - floor(u));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Image space is the top 64 x 64, with its origin at the centre of the
// square, between LEDs 31 and 32, and y down. A line is the set of points
// with x cos theta + y sin theta = rho, theta in [0, pi) across the 64
// columns of the bottom square and rho in [-32, 32) down its 64 rows, one
// LED of rho a row. Only a point in a corner, more than 32 LEDs from the
// centre, has a sinusoid that leaves through the top or the bottom for a
// stretch of theta, and every line that passes within 32 LEDs of the
// centre has its bin. Crossing theta = pi turns (theta, rho) into (theta - pi, -rho):
// column 64 is column 0 with its rows upside down.
const R = 32, DT = PI / NT, C0 = 31.5;
const CE = new Float64Array(NT + 1), SE = new Float64Array(NT + 1);
for (let j = 0; j <= NT; j++) (CE[j] = cos(j * DT)), (SE[j] = sin(j * DT));
const rowOf = (rho) => ((rho + R) / (2 * R)) * NR;

// Points land at RATE a second and fade by e every TAU seconds, both in
// panel time, Speed 2 being 1; a point older than 3 TAU is gone. The
// accumulator is cast afresh every frame from the points there are, each
// with its weight e^(-age / TAU), so it is always the exact transform of
// the points on the square, and it fades as they do. FLASH is how long the
// newest point's sweep across the columns takes.
const RATE = 8, TAU = 6, FLASH = 0.85 / RATE, MAXP = 200, LMAX = 6;
// The colours the found lines and their peaks take, as hue offsets.
const LINE_HUES = [0.3, 0.86, 0.14, 0.55, 0.74, 0.4];
// Where the six lines start in theta, as fractions of pi.
const BASE = [0.3, 0.66, 0.48, 0.12, 0.84, 0.2];

export function setup(params) {
  const lines = [];
  for (let i = 0; i < LMAX; i++) {
    // Spread the lines out in theta, the first two a third of the way in
    // from either end of the accumulator, and give each a turn of its own,
    // so two peaks start apart and drift past each other only now and then.
    // A line's points come from the stretch a to b of its chord across the
    // square, which slides 0.12 of the chord either way.
    lines.push({
      th: PI * (BASE[i] + 0.06 * random()), w: (random() < 0.5 ? -1 : 1) * (0.007 + 0.01 * random()),
      r0: (random() * 2 - 1) * 14, ra: 3 + 4 * random(), rw: 0.03 + 0.04 * random(), rp: 6.3 * random(),
      a: 0.04 + 0.3 * random(), b: 0.65 + 0.3 * random(), sp: 0.2 + 0.2 * random(),
    });
  }
  params.s = {
    hue: 0, speed: 2, L: 2, q: 0.3, T: 0, acc: 0, warm: false, vref: 8,
    lines, n: 0, newest: -1,
    px: new Int8Array(MAXP), py: new Int8Array(MAXP), age: new Float32Array(MAXP), ln: new Int8Array(MAXP), own: new Int8Array(MAXP),
    A: new Float32Array(NT * NR),
    peaks: [],
    rgb: new Float32Array(W * H * 3), c: new Float32Array(3),
  };
}

// Where line i is now: its normal angle and its distance from the centre.
function lineNow(S, i) {
  const L = S.lines[i];
  return [L.th + L.w * S.T, L.r0 + L.ra * sin(L.rw * S.T + L.rp)];
}

// Take point i out, moving the last point into its place.
function drop(S, i) {
  const e = --S.n;
  S.px[i] = S.px[e], S.py[i] = S.py[e], S.age[i] = S.age[e], S.ln[i] = S.ln[e];
  if (S.newest === e) S.newest = i;
}

function spawn(S) {
  // Drop the oldest point when the store is full.
  if (S.n >= MAXP) {
    let o = 0;
    for (let i = 1; i < S.n; i++) if (S.age[i] > S.age[o]) o = i;
    drop(S, o);
  }
  let x, y, li = -1;
  if (random() < S.q) {
    x = floor(random() * SQ);
    y = floor(random() * SQ);
  } else {
    li = floor(random() * S.L);
    const [th, rho] = lineNow(S, li), L = S.lines[li];
    const c = cos(th), s = sin(th), fx = rho * c, fy = rho * s;
    // The chord of the line across the square, t along the direction
    // (-sin, cos) from the foot of the normal, and the segment the points
    // come from: a stretch of the chord that slides slowly along it.
    let t0 = -99, t1 = 99;
    for (const [p, d] of [[fx, -s], [fy, c]]) {
      if (abs(d) < 1e-6) continue;
      const ta = (-C0 - p) / d, tb = (C0 - p) / d;
      t0 = max(t0, min(ta, tb));
      t1 = min(t1, max(ta, tb));
    }
    if (t1 - t0 < 8) return;
    const slide = 0.12 * sin(L.sp * S.T + L.rp);
    const a = cl(L.a + slide, 0, 0.6), b = cl(L.b + slide, a + 0.3, 1);
    const t = t0 + (t1 - t0) * (a + (b - a) * random());
    x = round(fx - s * t + C0);
    y = round(fy + c * t + C0);
    if (x < 0 || x >= SQ || y < 0 || y >= SQ) return;
  }
  const k = S.n++;
  S.px[k] = x, S.py[k] = y, S.age[k] = 0, S.ln[k] = li;
  S.newest = k;
}

// One point's votes: in column j the sinusoid runs from rho(theta_j) to
// rho(theta_j+1), and the point's weight is spread evenly over the rows it
// passes, at least one row's width, so every column gets the same weight
// and a steep stretch of the curve is drawn as a dim run, not a dotted one.
function cast(A, x, y, w, nj) {
  const X = x - C0 + 0.5, Y = y - C0 + 0.5;
  let ra = rowOf(X * CE[0] + Y * SE[0]);
  for (let j = 0; j < nj; j++) {
    const rb = rowOf(X * CE[j + 1] + Y * SE[j + 1]);
    let lo = min(ra, rb), hi = max(ra, rb);
    ra = rb;
    if (hi - lo < 1) {
      const m = (lo + hi) / 2;
      lo = m - 0.5;
      hi = m + 0.5;
    }
    const k = w / (hi - lo);
    for (let r = max(0, floor(lo)), e = min(NR - 1, floor(hi)); r <= e; r++) {
      const o = min(hi, r + 1) - max(lo, r);
      if (o > 0) A[r * NT + j] += k * o;
    }
  }
}

// The accumulator at column j, row r, reading past the ends through the
// theta = pi seam.
function at(A, j, r) {
  if (j < 0) (j += NT), (r = NR - 1 - r);
  else if (j >= NT) (j -= NT), (r = NR - 1 - r);
  return r < 0 || r >= NR ? 0 : A[r * NT + j];
}

// The L strongest peaks: bins at least as high as every bin within 3, over
// a quarter of the highest and over 2.5 points' worth of votes, refined to
// a fraction of a bin by a parabola through each axis's three bins.
function findPeaks(S) {
  const A = S.A, cand = [];
  let top = 0;
  for (let i = 0; i < NT * NR; i++) top = max(top, A[i]);
  const floorV = max(2.5, 0.25 * top);
  for (let r = 0; r < NR; r++)
    for (let j = 0; j < NT; j++) {
      const v = A[r * NT + j];
      if (v < floorV) continue;
      let ok = true;
      for (let dr = -3; dr <= 3 && ok; dr++)
        for (let dj = -3; dj <= 3; dj++) {
          if (!dr && !dj) continue;
          const u = at(A, j + dj, r + dr);
          if (u > v || (u === v && (dr < 0 || (dr === 0 && dj < 0)))) {
            ok = false;
            break;
          }
        }
      if (ok) cand.push([v, j, r]);
    }
  cand.sort((a, b) => b[0] - a[0]);
  const out = [];
  for (const [v, j, r] of cand) {
    if (out.length >= S.L) break;
    const l = at(A, j - 1, r), rr = at(A, j + 1, r), u = at(A, j, r - 1), d = at(A, j, r + 1);
    const fj = j + cl((0.5 * (l - rr)) / (l - 2 * v + rr || -1), -0.5, 0.5);
    const fr = r + cl((0.5 * (u - d)) / (u - 2 * v + d || -1), -0.5, 0.5);
    out.push({ v, j, r, th: (fj + 0.5) * DT, rho: ((fr + 0.5) / NR) * 2 * R - R, slot: -1 });
  }
  // Each peak keeps the colour of the peak nearest it last frame, within 6
  // bins; a new one takes a free colour.
  const used = new Uint8Array(LMAX);
  for (const p of out) {
    let best = -1, bd = 36;
    S.peaks.forEach((q, i) => {
      if (q.slot < 0 || used[q.slot]) return;
      let dj = abs(q.j - p.j), dr = abs(q.r - p.r);
      if (dj > NT / 2) (dj = NT - dj), (dr = abs(NR - 1 - q.r - p.r));
      const dd = dj * dj + dr * dr;
      if (dd < bd) (bd = dd), (best = i);
    });
    if (best >= 0) p.slot = S.peaks[best].slot;
    else for (let k = 0; k < LMAX; k++) if (!used[k] && !out.some((o) => o.slot === k)) { p.slot = k; break; }
    if (p.slot >= 0) used[p.slot] = 1;
  }
  S.peaks = out;
}

// How many columns of a point's sinusoid are cast: all 64 once its sweep
// of FLASH seconds is over. Only the newest point sweeps, so when the next
// one lands a sweep still running is finished at once.
const sweepAge = (S, i) => (i === S.newest ? S.age[i] : 1e9);
const sweepOf = (age) => min(NT, floor((NT * age) / FLASH) + 1);

function step(S, d) {
  S.T += d;
  for (let i = 0; i < S.n; i++) S.age[i] += d;
  for (let i = 0; i < S.n; )
    if (S.age[i] > 3 * TAU) drop(S, i);
    else i++;
  S.acc += d * RATE;
  while (S.acc >= 1) {
    S.acc -= 1;
    spawn(S);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 2, 0.3], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.L = round(cl(k[2], 2, 6));
  S.q = cl(k[3], 0.3, 0.9);
  if (!S.warm) {
    // Open on a square that has been filling for 12 s.
    for (let i = 0; i < 360; i++) step(S, 1 / 30);
    S.warm = true;
  }
  step(S, (d * S.speed) / 2);
  S.A.fill(0);
  // The newest point casts its votes column by column as its sweep passes.
  for (let i = 0; i < S.n; i++) cast(S.A, S.px[i], S.py[i], exp(-S.age[i] / TAU), sweepOf(sweepAge(S, i)));
  findPeaks(S);
  // Each point within 1 LED of a found line belongs to it, the nearest if
  // two are that close: those are the votes that made the peak.
  for (let i = 0; i < S.n; i++) {
    const X = S.px[i] - C0 + 0.5, Y = S.py[i] - C0 + 0.5;
    let best = -1, bd = 1;
    for (const p of S.peaks) {
      const dd = abs(X * cos(p.th) + Y * sin(p.th) - p.rho);
      if (p.slot >= 0 && dd < bd) (bd = dd), (best = p.slot);
    }
    S.own[i] = best;
  }
  let top = 0;
  for (let i = 0; i < NT * NR; i++) top = max(top, S.A[i]);
  // The brightness scale follows the highest bin slowly, so a peak that
  // grows brightens instead of the whole accumulator dimming round it.
  S.vref += (max(4, top) - S.vref) * min(1, d * 1.5);
}

function add(S, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3, o = S.rgb;
  o[p] += r, o[p + 1] += g, o[p + 2] += b;
}
function lift(S, x, y, c) {
  const p = (y * W + x) * 3, o = S.rgb;
  o[p] = max(o[p], c[0] * 255), o[p + 1] = max(o[p + 1], c[1] * 255), o[p + 2] = max(o[p + 2], c[2] * 255);
}
function put(S, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3, o = S.rgb;
  o[p] = r, o[p + 1] = g, o[p + 2] = b;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const o = S.rgb, c = S.c, A = S.A, hu = S.hue;
  o.fill(0);
  // The accumulator: deep blue at a trace of a vote, azure, then white only
  // near the top, on brightness (v / vref)^0.85, so one fresh noise
  // sinusoid alone shows at about 45 of 255 and the peaks stand out of the
  // band of flat sinusoids that the points near the centre lay along rho = 0.
  for (let r = 0; r < NR; r++)
    for (let j = 0; j < NT; j++) {
      const v = A[r * NT + j] / S.vref;
      if (v <= 0.004) continue;
      const b = min(1, v) ** 0.85;
      hsv(wheel(hu + 0.476 - 0.15 * b), 1 - (0.8 * max(0, b - 0.7)) / 0.3, 0.06 + 0.94 * b, c, 0);
      put(S, j, SQ + r, c[0] * 255, c[1] * 255, c[2] * 255);
    }
  // The sinusoids of the points a found line owns, in that line's colour
  // at their weight, each LED kept at the brighter of it and the heat, so
  // the bundle runs into its peak and the peak stays white.
  for (let i = 0; i < S.n; i++) {
    if (S.own[i] < 0 || sweepAge(S, i) < FLASH) continue;
    hsv(hu + LINE_HUES[S.own[i]], 0.85, 0.55 * exp(-S.age[i] / TAU) ** 1.5, c, 0);
    const X = S.px[i] - C0 + 0.5, Y = S.py[i] - C0 + 0.5;
    let ra = rowOf(X * CE[0] + Y * SE[0]);
    for (let j = 0; j < NT; j++) {
      const rb = rowOf(X * CE[j + 1] + Y * SE[j + 1]);
      for (let r = floor(min(ra, rb)), e = floor(max(ra, rb)); r <= e; r++) if (r >= 0 && r < NR) lift(S, j, SQ + r, c);
      ra = rb;
    }
  }
  // The newest points' sinusoids in white over the columns cast so far, the
  // cursor column brightest; a finished one fades over the next 1.5 sweeps.
  // While a point sweeps, the line through it whose normal is at the
  // cursor's theta turns round it on the square: each bin of the sinusoid
  // is one of those lines.
  const HOLD = 1.5 / RATE;
  for (let i = 0; i < S.n; i++) {
    const age = S.age[i];
    if (age >= FLASH + HOLD) continue;
    const sa = sweepAge(S, i), nj = sweepOf(sa), a = sa < FLASH ? 1 : min(1, 1 - (age - FLASH) / HOLD);
    const X = S.px[i] - C0 + 0.5, Y = S.py[i] - C0 + 0.5;
    let ra = rowOf(X * CE[0] + Y * SE[0]);
    for (let j = 0; j < nj; j++) {
      const rb = rowOf(X * CE[j + 1] + Y * SE[j + 1]), g = (j === nj - 1 && sa < FLASH ? 255 : 200) * a;
      for (let r = floor(min(ra, rb)), e = floor(max(ra, rb)); r <= e; r++) if (r >= 0 && r < NR) add(S, j, SQ + r, g, g, g);
      ra = rb;
    }
    if (sa < FLASH) {
      const th = (nj - 0.5) * DT, cs = cos(th), sn = sin(th), rho = X * cs + Y * sn;
      for (let y = 0; y < SQ; y++)
        for (let x = 0; x < SQ; x++) {
          const dd = abs((x - C0 + 0.5) * cs + (y - C0 + 0.5) * sn - rho);
          if (dd < 1) add(S, x, y, 90 * (1 - dd), 90 * (1 - dd), 90 * (1 - dd));
        }
    }
  }
  // The found lines across the image square, each in its peak's colour,
  // 2.4 LEDs wide and fading out from the middle.
  for (const p of S.peaks) {
    if (p.slot < 0) continue;
    hsv(hu + LINE_HUES[p.slot], 0.85, 1, c, 0);
    const cs = cos(p.th), sn = sin(p.th), str = 0.35 + 0.4 * min(1, p.v / S.vref);
    for (let y = 0; y < SQ; y++)
      for (let x = 0; x < SQ; x++) {
        const dd = abs((x - C0) * cs + (y - C0) * sn - p.rho);
        if (dd < 1.2) {
          const a = (1 - dd / 1.2) * str * 255;
          add(S, x, y, c[0] * a, c[1] * a, c[2] * a);
        }
      }
    // Its peak: four LEDs in the same colour at the corners of the 5 x 5
    // round the bin, leaving the glow of the crossing inside them alone.
    for (let dr = -2; dr <= 2; dr += 4)
      for (let dj = -2; dj <= 2; dj += 4) {
        let j = p.j + dj, r = p.r + dr;
        if (j < 0) (j += NT), (r = NR - 1 - r);
        else if (j >= NT) (j -= NT), (r = NR - 1 - r);
        if (r >= 0 && r < NR) put(S, j, SQ + r, c[0] * 255, c[1] * 255, c[2] * 255);
      }
  }
  // The points, white, as bright as their weight, 255 new and 50 when they
  // go; the point sweeping has a ring.
  for (let i = 0; i < S.n; i++) {
    const w = exp(-S.age[i] / TAU), x = S.px[i], y = S.py[i], g = 40 + 215 * w;
    put(S, x, y, g, g, g);
    if (sweepAge(S, i) < FLASH) {
      const e = 200;
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]])
        if (y + dy >= 0 && y + dy < SQ) add(S, x + dx, y + dy, e, e, e);
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, min(255, round(o[p])), min(255, round(o[p + 1])), min(255, round(o[p + 2])));
}
