// ===== Patternflow pattern =====
// Title:   Brazil Nut
// Family:  particle
// Idea:    A bed of 540 small discs in seven coloured strata fills the panel nearly to the top with one large pale disc on its floor, and a Monte Carlo shakes it six times a second, lifting the whole packing and letting every disc settle by random steps that may never go up, so the small discs that slip into the gap opening under the large one ratchet it up through the strata, stirring them in its wake, until it reaches the top after about 52 seconds and the column tips over end to end and starts again.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Brazil nut effect, size segregation by shaking in the Monte Carlo of Anthony Rosato, Katherine Strandburg, Friedrich Prinz and Robert Swendsen (1987), pattern round 77
// Round:   77
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Amplitude=-1..1, Size=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the strata run from sea green on the floor through cyan and azure to violet at the top, every other one pale, and the large disc is pale gold; at 0.5 they run from rose through orange and yellow to lime and the large disc is pale blue.
// Knob 2: Speed. Shakes a second, 3 for each unit: 6 at the opening 2, 0.6 at 0.2 and 9 at 3. Each shake is the same Monte Carlo whatever the speed, so the climb takes about 315 shakes: 52 seconds at 2, 35 seconds at 3, nearly 9 minutes at 0.2.
// Knob 3: Amplitude. How far each shake lifts the packing, 6 x 1.6^Amplitude LEDs: 3.75 at -1, 6 at the opening 0 (1.7 small diameters), 9.6 at 1. A bigger lift opens a deeper gap under the large disc and it climbs faster: about 100 seconds at -1, 52 at 0, 31 at 1.
// Knob 4: Size. The large disc's radius, 7 x 1.45^Size rounded to half an LED: 5 at -1, 7 at the opening, 10 at 1, against small radii of 1.6 to 1.95. The climb takes about 58, 52 and 49 seconds. A new size fills a new column once the knob has rested 0.3 seconds.
// Buttons: K1 tap tips the column over now. A large disc on the floor then lands on top and the column tips back after 2.5 seconds.

// Anthony Rosato, Katherine Strandburg, Friedrich Prinz and Robert Swendsen,
// "Why the Brazil nuts are on top: size segregation of particulate matter
// by shaking", Physical Review Letters 58 (1987), found the effect in a
// Monte Carlo of hard discs under gravity, with no other force. A shake
// lifts the whole packing by the amplitude, and then the discs settle by
// random trial moves that are kept only if they overlap nothing and do not
// go up. As the packing falls back, a gap opens under a large disc, and
// small discs slip into its edges before the large disc can fall the whole
// way. It cannot go back down past them, so each shake leaves it a little
// higher: a ratchet, with no convection and no air.
//
// The moves here are this pattern's own. A shake lifts every disc by A and
// then runs ceil(20 + 5 A) sweeps, 50 at the opening, enough for the packing
// to settle. In a sweep each disc is tried once, in order of height from
// the floor up, so a whole column can drop a step in one sweep: a step
// sideways by up to 0.6 LEDs and down by 0.3 to 0.6, else straight down by
// 0.6, else down by 0.15, each kept only if the disc then overlaps nothing.
// No disc ever moves up except in the lift. The sides wrap round, so the
// large disc never stalls against a wall, and overlaps are found through a
// grid of 12 by 32 cells. The 540 small discs have radii 1.6 to 1.95 LEDs,
// spread so the packing does not freeze into a crystal.
//
// The picture glides from one settled packing to the next while the Monte
// Carlo works out the one after, and rises 0.15 A and falls back in each
// shake, so the shaking shows without the packing jumping 6 LEDs six times
// a second. The small discs are coloured by the seventh of the packing's
// height they started in. Once no small disc lies above the large one it
// holds 2.5 seconds, the column turns end over end about the middle row in
// 1.4 seconds, the strata are recoloured from the new floor while it is
// edge-on, and the packing falls 90 sweeps onto the floor in 1.2 seconds.
// After 900 shakes without the large disc reaching the top it tips anyway.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, round, cos, sin, PI, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The sides wrap round: x is taken modulo the width, and a difference in x
// is the shorter way round.
const wrap = (x) => x - W * floor(x / W);
const near = (d) => d - W * round(d / W);

const P = {
  RMIN: 1.6, RMAX: 1.95, TOP: 137, DELTA: 0.6, CS: 5, GX: 12, GY: 32,
  BANDS: 7, HOLD: 2.5, TIP: 1.4, FALL: 1.2, LIMIT: 900,
};
const CX = W / P.GX;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

function build(S) {
  const R = S.R, nb = S.nb;
  const xs = [], ys = [], rs = [];
  // Big discs side by side on the floor.
  for (let b = 0; b < nb; b++) {
    xs.push(((b + 0.5) * W) / nb);
    ys.push(R + 0.2);
    rs.push(R);
  }
  const per = floor(W / (2 * P.RMAX + 0.15)), dx = W / per, dy = dx * 0.87;
  for (let row = 0; ; row++) {
    const y = P.RMAX + 0.1 + row * dy;
    if (y > P.TOP) break;
    for (let q = 0; q < per; q++) {
      const x = (q + (row & 1 ? 0.5 : 0)) * dx;
      let ok = true;
      for (let b = 0; b < nb; b++) {
        const ex = near(x - xs[b]), ey = y - ys[b];
        if (ex * ex + ey * ey < (R + P.RMAX + 0.2) ** 2) ok = false;
      }
      if (!ok) continue;
      xs.push(wrap(x + (random() - 0.5) * 0.1));
      ys.push(y);
      rs.push(P.RMIN + random() * (P.RMAX - P.RMIN));
    }
  }
  const n = xs.length;
  S.n = n;
  S.x = Float64Array.from(xs);
  S.y = Float64Array.from(ys);
  S.r = Float64Array.from(rs);
  S.band = new Float32Array(n);
  S.cell = new Int32Array(P.GX * P.GY + 1);
  S.item = new Int32Array(n);
  S.ci = new Int32Array(n);
  for (let k = 0; k < 120; k++) sweep(S);
  S.ay = null;
  colour(S, false);
}

// Strata by starting height: seven bands of the packing's height, bottom
// to top. After a tip the bands are the mirror of the old ones.
function colour(S, flip) {
  let top = 0;
  for (let i = S.nb; i < S.n; i++) top = max(top, S.ay ? S.ay[i] : S.y[i]);
  for (let i = S.nb; i < S.n; i++) {
    const b = min(P.BANDS - 1, floor(((S.ay ? S.ay[i] : S.y[i]) / (top + 0.01)) * P.BANDS));
    S.band[i] = flip ? P.BANDS - 1 - b : b;
  }
}

function grid(S) {
  const { cell, item, ci, n, nb } = S;
  cell.fill(0);
  for (let i = nb; i < n; i++) {
    const cx = cl(floor(S.x[i] / CX), 0, P.GX - 1), cy = cl(floor(S.y[i] / P.CS), 0, P.GY - 1);
    ci[i] = cy * P.GX + cx;
    cell[ci[i] + 1]++;
  }
  for (let c = 0; c < P.GX * P.GY; c++) cell[c + 1] += cell[c];
  const fill = S.fill || (S.fill = new Int32Array(P.GX * P.GY));
  fill.fill(0);
  for (let i = nb; i < n; i++) item[cell[ci[i]] + fill[ci[i]]++] = i;
}

// Would disc i overlap anything at (px, py)?
function hits(S, i, px, py) {
  const ri = S.r[i];
  if (py < ri) return true;
  const { x, y, r, nb, cell, item } = S;
  for (let b = 0; b < nb; b++) {
    if (b === i) continue;
    const ex = near(px - x[b]), ey = py - y[b], s = ri + r[b];
    if (ex * ex + ey * ey < s * s) return true;
  }
  const reach = ceil((ri + P.RMAX + 1.5 * P.DELTA) / P.CS);
  const cx = floor(wrap(px) / CX), cy = floor(py / P.CS);
  for (let gy = max(0, cy - reach); gy <= min(P.GY - 1, cy + reach); gy++)
    for (let g = cx - reach; g <= cx + reach; g++) {
      const c = gy * P.GX + (g + P.GX) % P.GX;
      for (let k = cell[c]; k < cell[c + 1]; k++) {
        const j = item[k];
        if (j === i) continue;
        const ex = near(px - x[j]), ey = py - y[j], s = ri + r[j];
        if (ex * ex + ey * ey < s * s) return true;
      }
    }
  return false;
}

function sweep(S) {
  grid(S);
  const { x, y, n } = S, d = P.DELTA;
  // Each disc once a sweep, from the lowest up, so a whole column can drop
  // a step in one sweep. Insertion sort: the order barely changes.
  const ord = S.ord && S.ord.length === n ? S.ord : (S.ord = new Int32Array(n).map((_, i) => i));
  for (let k = 1; k < n; k++) {
    const t = ord[k], ty = y[t];
    let j = k - 1;
    while (j >= 0 && y[ord[j]] > ty) {
      ord[j + 1] = ord[j];
      j--;
    }
    ord[j + 1] = t;
  }
  for (let k = 0; k < n; k++) {
    const i = ord[k];
    // A step down and to the side; if that is blocked, straight down.
    const dx = d * (2 * random() - 1), dy = -d * (0.5 + 0.5 * random());
    if (!hits(S, i, x[i] + dx, y[i] + dy)) {
      x[i] = wrap(x[i] + dx);
      y[i] += dy;
    } else if (!hits(S, i, x[i], y[i] - d)) y[i] -= d;
    else if (!hits(S, i, x[i], y[i] - d * 0.25)) y[i] -= d * 0.25;
  }
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, A: 6, R: 7, want: 7, rest: 0, fresh: true, nb: 1, mode: 0, shakes: 0, hold: -1, done: 0, owed: 0, K: 50, tip: 0, btn: false,
    img: new Float32Array(W * H * 3), c: [0, 0, 0],
  };
  build(params.s);
  settled(params.s, true);
}

// Keep the last two settled packings: the picture glides from one to the
// next while the Monte Carlo works out the one after.
function settled(S, both) {
  if (!S.ax || S.ax.length !== S.n) {
    S.ax = new Float64Array(S.n);
    S.ay = new Float64Array(S.n);
    S.bx = new Float64Array(S.n);
    S.by = new Float64Array(S.n);
    both = true;
  }
  if (both) {
    S.bx.set(S.x);
    S.by.set(S.y);
  } else {
    S.bx.set(S.ax);
    S.by.set(S.ay);
  }
  S.ax.set(S.x);
  S.ay.set(S.y);
}

// A big disc is on top once no small disc sits above it within its width.
function surfaced(S) {
  for (let b = 0; b < S.nb; b++)
    for (let i = S.nb; i < S.n; i++) if (S.y[i] > S.y[b] && abs(near(S.x[i] - S.x[b])) < S.r[b]) return false;
  return true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.A = 6 * 1.6 ** cl(k[2] || 0, -1, 1);
  const R = round(7 * 1.45 ** cl(k[3] == null ? 0.06 : k[3], -1, 1) * 2) / 2;
  if (R !== S.want) {
    S.want = R;
    S.rest = 0;
  } else S.rest += d;
  // A new size fills a new column, once the knob has rested 0.3 seconds.
  if (R !== S.R && (S.rest > 0.3 || S.fresh)) {
    S.R = R;
    build(S);
    settled(S, true);
    S.mode = 0;
    S.shakes = 0;
    S.hold = -1;
    S.done = 0;
  }
  S.fresh = false;
  const b = !!(input.btnPressed && input.btnPressed[0]);
  if (b && !S.btn && S.mode === 0) {
    S.mode = 1;
    S.tip = 0;
  }
  S.btn = b;
  if (S.mode === 0) {
    // Shaking: each shake lifts the whole packing by A and lets it settle
    // through K sweeps, K growing with A.
    S.K = ceil(20 + 5 * S.A);
    S.owed += d * 3 * S.speed * S.K;
    while (S.owed >= 1) {
      if (S.done === 0) for (let i = 0; i < S.n; i++) S.y[i] += S.A;
      sweep(S);
      S.owed -= 1;
      if (++S.done >= S.K) {
        S.done = 0;
        settled(S, false);
        if (S.hold < 0 && (surfaced(S) || ++S.shakes > P.LIMIT)) S.hold = 0;
      }
    }
    if (S.hold >= 0 && (S.hold += d) > P.HOLD) {
      S.mode = 1;
      S.tip = 0;
    }
  } else if (S.mode === 1) {
    // Tipping: the column turns over end to end about its middle row.
    // Edge-on at the halfway point, the column changes its colours unseen.
    if (S.tip < 0.5 && S.tip + d / P.TIP >= 0.5) colour(S, true);
    S.tip += d / P.TIP;
    if (S.tip >= 1) {
      for (let i = 0; i < S.n; i++) S.y[i] = H - S.ay[i];
      S.x.set(S.ax);
      S.mode = 2;
      S.owed = 0;
      S.done = 0;
    }
  } else {
    // Falling back onto the floor, no lift, then shaking again.
    S.owed += (d * 90) / P.FALL;
    while (S.owed >= 1 && S.mode === 2) {
      sweep(S);
      S.owed -= 1;
      if (++S.done >= 90) {
        settled(S, true);
        S.mode = 0;
        S.done = 0;
        S.owed = 0;
        S.shakes = 0;
        S.hold = -1;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const img = S.img, c = S.c;
  img.fill(0);
  const disc = (cx, cy, rad, sq, R, G, B) => {
    if (cx - rad < 0) one(cx + W, cy, rad, sq, R, G, B);
    if (cx + rad > W) one(cx - W, cy, rad, sq, R, G, B);
    one(cx, cy, rad, sq, R, G, B);
  };
  const one = (cx, cy, rad, sq, R, G, B) => {
    const x0 = max(0, floor(cx - rad - 1)), x1 = min(W - 1, ceil(cx + rad));
    const ry = max(0.3, rad * sq), r2 = (rad + 0.2) * (rad + 0.2), s2 = (ry + 0.2) * (ry + 0.2);
    for (let px = x0; px <= x1; px++) {
      const ex = px + 0.5 - cx;
      for (let row = max(0, floor(H - cy - ry - 1)); row <= min(H - 1, ceil(H - cy + ry)); row++) {
        const ey = H - (row + 0.5) - cy, q = (ex * ex) / r2 + (ey * ey) / s2;
        if (q >= 1) continue;
        const w = 1 - 0.6 * q, p = (row * W + px) * 3;
        img[p] = max(img[p], R * w);
        img[p + 1] = max(img[p + 1], G * w);
        img[p + 2] = max(img[p + 2], B * w);
      }
    }
  };
  // Where each disc is drawn: gliding between settled packings with the
  // shake's bump while shaking, squashed about row 64 while tipping, as
  // it is while falling.
  let u = 0, bump = 0, sq = 1;
  if (S.mode === 0) {
    const ph = cl((S.done + S.owed) / S.K, 0, 1);
    u = ph * ph * (3 - 2 * ph);
    bump = 0.15 * S.A * sin(PI * ph);
  } else if (S.mode === 1) {
    u = 1;
    sq = cos(PI * S.tip);
  }
  const X = (i) => (S.mode === 2 ? S.x[i] : wrap(S.bx[i] + near(S.ax[i] - S.bx[i]) * u));
  const Y = (i) => {
    if (S.mode === 2) return S.y[i];
    if (S.mode === 1) return H / 2 + (S.ay[i] - H / 2) * sq;
    return S.by[i] + (S.ay[i] - S.by[i]) * u + bump;
  };
  for (let i = S.nb; i < S.n; i++) {
    // Even bands full, odd bands pale, so a stratum that has been stirred
    // shows as speckle in the next one's tint.
    const b = S.band[i];
    hsv(S.hue + 0.45 + 0.055 * b, b & 1 ? 0.4 : 0.82, 1, c);
    disc(X(i), Y(i), S.r[i], abs(sq), c[0], c[1], c[2]);
  }
  hsv(S.hue + 0.12, 0.5, 1, c);
  for (let b = 0; b < S.nb; b++) disc(X(b), Y(b), S.r[b], abs(sq), c[0], c[1], c[2]);
  for (let row = 0; row < H; row++)
    for (let x = 0; x < W; x++) {
      const p = (row * W + x) * 3;
      display.setPixel(x, row, round(img[p] * 255), round(img[p + 1] * 255), round(img[p + 2] * 255));
    }
}
