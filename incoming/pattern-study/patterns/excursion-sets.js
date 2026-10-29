// ===== Patternflow pattern =====
// Title:   Excursion Sets
// Family:  noise
// Idea:    A smooth Gaussian random field on a 64 by 96 torus is cut at a level that sweeps up and down, each island of the set above the level filled in a cool tint and each lake inside land in pink, while the strip below plots islands minus lakes, the Euler characteristic, against the level, the dots gathering round the curve u e^(-u^2/2) that Adler's formula predicts.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Euler characteristic of Gaussian excursion sets (Robert Adler and Abraham Hasofer, 1976; Robert Adler, 1981), its use on brain images (Keith Worsley, 1992), bit-quad counting (Stephen Gray, 1971), pattern round 63
// Round:   63
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Scale=3..8, Level=-1.5..1.5
//
// Knob 1: Hue. Turns the islands and lakes round the wheel together. At 0 the islands are cyan, going azure the higher their peak stands above the level, and the lakes pink, going violet the deeper they are; at 0.5 the islands go red to orange and the lakes green. The land that winds round the torus stays a dim teal and the sea black, whatever the knob.
// Knob 2: Speed. At 2 the level climbs from -2.40 to 2.52 in 12 s and comes back in 12 s, and every wave of the field turns at its own rate of up to 0.35 rad/s, so the field forgets itself in about 9 s (pi / 0.35). At 0.2 ten times slower; at 3 one and a half times faster.
// Knob 3: Scale. The width sigma in LEDs of the Gaussian that blurs white noise into the field. At 3 the expected count at u = 1 is 13.1 islands more than lakes, and 240 independent fields gave 13.3 (and -13.0 at u = -1); at 5 it is 4.7 and they gave 4.6; at 8 it is 1.8. The plot is scaled so the curve always peaks 11 rows from its axis.
// Knob 4: Level. The middle of the sweep, its span shrinking as it moves off centre. At the opening 0.06 the level swings from -2.40 to 2.52 and the dots draw the whole curve; at 1.5 it swings from 0 to 3 and the panel stays among islands, at -1.5 from -3 to 0 among lakes.
//
// On a torus the Euler characteristic and the boundary length of the domain
// are 0, so of Adler's three terms only the area's is left:
// E chi{f >= u} = A sqrt(lx ly) (2 pi)^(-3/2) u e^(-u^2/2), with A = 64 x 96
// and lx = ly = 1 / (2 sigma^2) the variance of the field's slope.

const W = 64, FH = 96, A = W * FH, H = 128;
const { floor, round, min, max, abs, exp, sqrt, cos, sin, PI, random, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

function gauss() {
  let u = 0;
  while (u === 0) u = random();
  return sqrt(-2 * log(u)) * cos(2 * PI * random());
}

// 3 x 5 digits for the two counts.
const DIG = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];

// The strip: its axis row, and the rows above and below the axis the curve
// may use at its peak.
const AXIS = 112, PEAK_ROWS = 11, U_MAX = 3;
const OMEGA = 0.35, SWEEP = 12;

export function setup(params) {
  params.s = {
    sigma: 0, modes: 0, mm: null, nn: null, c0r: null, c0i: null, om: null, th: null,
    M: 0, cx: null, sx: null, cy: null, sy: null, gr: null, gi: null,
    f: new Float32Array(A), lab: new Int32Array(A), ux: new Int16Array(A), uy: new Int16Array(A),
    stack: new Int32Array(A), cWrap: new Uint8Array(A), cExt: new Float32Array(A), cSet: new Uint8Array(A), cArea: new Int32Array(A),
    hits: new Float32Array(W * 32), hitSign: new Int8Array(W * 32),
    phase: -0.21, u: 0, chi: 0, blobs: 0, holes: 0, peak: 1, hue: 0, c: [0, 0, 0],
  };
}

// The field is the real part of a sum of plane waves e^(ik.x) over the
// torus's own wave vectors, each with a complex Gaussian amplitude of
// variance exp(-sigma^2 k^2): white noise blurred by a Gaussian of width
// sigma, whose covariance is exp(-r^2 / 4 sigma^2). Waves past |k| = 3.4 /
// sigma carry less than 1e-5 of the variance and are left out.
function build(S, sigma) {
  S.sigma = sigma;
  const kc = 3.4 / sigma, M = Math.ceil((kc * W) / (2 * PI)), N = Math.ceil((kc * FH) / (2 * PI));
  const mm = [], nn = [], amp = [];
  let sum = 0, lx = 0, ly = 0;
  for (let m = -M; m <= M; m++)
    for (let n = -N; n <= N; n++) {
      const kx = (2 * PI * m) / W, ky = (2 * PI * n) / FH, k2 = kx * kx + ky * ky;
      if (k2 > kc * kc) continue;
      const sp = exp(-sigma * sigma * k2);
      mm.push(m);
      nn.push(n);
      amp.push(sqrt(sp / 2));
      sum += sp;
      lx += sp * kx * kx;
      ly += sp * ky * ky;
    }
  const K = mm.length, norm = 1 / sqrt(sum / 2);
  S.modes = K;
  S.M = M;
  S.mm = Int8Array.from(mm);
  S.nn = Int8Array.from(nn);
  S.c0r = new Float32Array(K);
  S.c0i = new Float32Array(K);
  S.om = new Float32Array(K);
  S.th = new Float32Array(K);
  for (let i = 0; i < K; i++) {
    S.c0r[i] = amp[i] * gauss() * norm;
    S.c0i[i] = amp[i] * gauss() * norm;
    S.om[i] = OMEGA * (2 * random() - 1);
    S.th[i] = 2 * PI * random();
  }
  // Second spectral moments of the unit-variance field, and from them the
  // expected Euler characteristic at its peak u = 1: A sqrt(lx ly) (2 pi)^-3/2 e^-1/2.
  S.lam = sqrt(lx * ly) / sum;
  S.peak = A * S.lam * Math.pow(2 * PI, -1.5) * exp(-0.5);
  const MW = 2 * M + 1, NW = 2 * N + 1;
  S.cx = new Float32Array(MW * W);
  S.sx = new Float32Array(MW * W);
  for (let m = -M; m <= M; m++)
    for (let x = 0; x < W; x++) {
      const a = (2 * PI * m * x) / W;
      S.cx[(m + M) * W + x] = cos(a);
      S.sx[(m + M) * W + x] = sin(a);
    }
  S.N = N;
  S.cy = new Float32Array(NW * FH);
  S.sy = new Float32Array(NW * FH);
  for (let n = -N; n <= N; n++)
    for (let y = 0; y < FH; y++) {
      const a = (2 * PI * n * y) / FH;
      S.cy[(n + N) * FH + y] = cos(a);
      S.sy[(n + N) * FH + y] = sin(a);
    }
  S.gr = new Float32Array(MW * FH);
  S.gi = new Float32Array(MW * FH);
  S.hits.fill(0);
}

// The expected Euler characteristic of {f >= u} on the torus: its Euler
// characteristic and boundary length are 0, so of the three terms of the
// kinematic formula only the area's is left.
// The fill of an island or a lake fades as it grows, from v at 60 LEDs to
// half of v at 1000, so the big ones near the median do not swamp the panel.
const fillOf = (area, v) => v * (1 - 0.5 * cl(Math.log(area / 60) / Math.log(1000 / 60), 0, 1));

const expected = (S, u) => S.peak * exp(0.5) * u * exp(-u * u / 2);

function synth(S) {
  const { M, N, gr, gi, cy, sy, cx, sx, f, mm, nn, c0r, c0i, th } = S;
  gr.fill(0);
  gi.fill(0);
  for (let i = 0; i < S.modes; i++) {
    const c = cos(th[i]), s = sin(th[i]);
    const ar = c0r[i] * c - c0i[i] * s, ai = c0r[i] * s + c0i[i] * c;
    const go = (mm[i] + M) * FH, yo = (nn[i] + N) * FH;
    for (let y = 0; y < FH; y++) {
      const ey = cy[yo + y], fy = sy[yo + y];
      gr[go + y] += ar * ey - ai * fy;
      gi[go + y] += ar * fy + ai * ey;
    }
  }
  const MW = 2 * M + 1;
  for (let y = 0; y < FH; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) f[row + x] = 0;
    for (let j = 0; j < MW; j++) {
      const a = gr[j * FH + y], b = gi[j * FH + y], o = j * W;
      for (let x = 0; x < W; x++) f[row + x] += a * cx[o + x] - b * sx[o + x];
    }
  }
}

const N8X = [1, -1, 0, 0, 1, 1, -1, -1], N8Y = [0, 0, 1, -1, 1, -1, 1, -1];

// Components of the lit set, eight-connected, and of the dark set,
// four-connected, so the two count each other's holes. Each pixel keeps its
// unwrapped position from the fill; reaching a pixel of the same component at
// another position means the component winds round the torus. Islands minus
// lakes, counting only the components that do not wind, is the Euler
// characteristic Gray's bit quads give; the two agreed on all 640 fields
// tried, each cut at 11 levels.
function label(S, u) {
  const { f, lab, ux, uy, stack, cWrap, cExt, cSet, cArea } = S;
  lab.fill(-1);
  let id = 0, blobs = 0, holes = 0;
  for (let p = 0; p < A; p++) {
    if (lab[p] >= 0) continue;
    const lit = f[p] >= u, nb = lit ? 8 : 4;
    let sp = 0, wraps = 0, ext = f[p], area = 1;
    lab[p] = id;
    ux[p] = p & 63;
    uy[p] = p >> 6;
    stack[sp++] = p;
    while (sp) {
      const q = stack[--sp], qx = ux[q], qy = uy[q];
      for (let k = 0; k < nb; k++) {
        const x = qx + N8X[k], y = qy + N8Y[k];
        const r = (((y % FH) + FH) % FH) * W + (x & 63);
        if ((f[r] >= u) !== lit) continue;
        if (lab[r] === id) {
          if (ux[r] !== x || uy[r] !== y) wraps = 1;
          continue;
        }
        lab[r] = id;
        ux[r] = x;
        uy[r] = y;
        stack[sp++] = r;
        area++;
        const v = f[r];
        if (lit ? v > ext : v < ext) ext = v;
      }
    }
    cWrap[id] = wraps;
    cExt[id] = ext;
    cSet[id] = lit ? 1 : 0;
    cArea[id] = area;
    if (!wraps) {
      if (lit) blobs++;
      else holes++;
    }
    id++;
  }
  S.blobs = blobs;
  S.holes = holes;
  S.chi = blobs - holes;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const speed = cl(k[1], 0.2, 3), sigma = cl(k[2], 3, 8), c = cl(k[3], -1.5, 1.5);
  if (abs(sigma - S.sigma) > 0.04) build(S, sigma);
  const r = (d * speed) / 2;
  for (let i = 0; i < S.modes; i++) S.th[i] += S.om[i] * r;
  // A triangle wave with rounded turns, so the level spends equal time at
  // every height between them.
  S.phase += r / (2 * SWEEP);
  const tri = (2 / PI) * Math.asin(0.985 * sin(2 * PI * S.phase)) / ((2 / PI) * Math.asin(0.985));
  const span = 2.5 - (2 / 3) * abs(c);
  S.u = c + span * tri;
  synth(S);
  label(S, S.u);
  // The count lands in the strip at the level's column and fades over 20 s.
  const fade = exp(-r / 10);
  for (let i = 0; i < S.hits.length; i++) S.hits[i] *= fade;
  const col = round(((S.u + U_MAX) / (2 * U_MAX)) * (W - 1));
  const row = round(AXIS - S.chi * (PEAK_ROWS / S.peak)) - 96;
  if (col >= 0 && col < W && row >= 1 && row < 32) {
    S.hits[row * W + col] = 1;
    S.hitSign[row * W + col] = S.chi > 0 ? 1 : S.chi < 0 ? -1 : 0;
  }
}

function digits(display, n, x0, y0, rgb, alignRight) {
  const s = String(n);
  let x = alignRight ? x0 - 4 * s.length + 1 : x0;
  for (let i = 0; i < s.length; i++, x += 4) {
    const g = DIG[s.charCodeAt(i) - 48];
    for (let r = 0; r < 5; r++)
      for (let q = 0; q < 3; q++) if (g[r * 3 + q] === "1") display.setPixel(x + q, y0 + r, rgb[0], rgb[1], rgb[2]);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cx) return;
  const { f, lab, cWrap, cExt, cSet, cArea, c } = S, u = S.u, h = S.hue;
  const hb = h + 0.5, hh = h + 0.87;
  for (let p = 0; p < A; p++) {
    const id = lab[p], x = p & 63, y = p >> 6;
    const lit = cSet[id] === 1;
    // An edge pixel has a four-neighbour on the other side of the level.
    const L = (x + 63) & 63, R = (x + 1) & 63, U = ((y + FH - 1) % FH) * W, D = ((y + 1) % FH) * W, row = y * W;
    const edge = (f[row + L] >= u) !== lit || (f[row + R] >= u) !== lit || (f[U + x] >= u) !== lit || (f[D + x] >= u) !== lit;
    if (lit) {
      if (cWrap[id]) hsv(0.54, 0.55, edge ? 0.5 : 0.2, c);
      else {
        // An island's tint follows how far its peak stands above the level.
        const t = cl((cExt[id] - u) / 1.6, 0, 1);
        hsv(hb + 0.11 * t, 0.85 - 0.25 * (1 - t), edge ? 1 : fillOf(cArea[id], 0.5), c);
      }
    } else if (cWrap[id]) {
      c[0] = c[1] = c[2] = 0;
    } else {
      const t = cl((u - cExt[id]) / 1.6, 0, 1);
      hsv(hh - 0.07 * t, 0.6, edge ? 1 : fillOf(cArea[id], 0.45), c);
    }
    display.setPixel(x, y, c[0], c[1], c[2]);
  }

  // The strip: the axis, the expected curve, the counts so far, the level.
  for (let y = 96; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
  const sc = PEAK_ROWS / S.peak, b = [0, 0, 0], o = [0, 0, 0];
  hsv(hb + 0.05, 0.85, 1, b);
  hsv(hh, 0.7, 1, o);
  for (let x = 0; x < W; x++) {
    display.setPixel(x, AXIS, 34, 34, 40);
    display.setPixel(x, 96, 30, 30, 36);
  }
  for (let i = 0; i < 32 * W; i++) {
    const v = S.hits[i];
    if (v < 0.04) continue;
    const s = S.hitSign[i], col = s > 0 ? b : s < 0 ? o : [200, 200, 200];
    const a = 0.25 + 0.75 * v;
    display.setPixel(i & 63, 96 + (i >> 6), col[0] * a, col[1] * a, col[2] * a);
  }
  let prev = null;
  for (let x = 0; x < W; x++) {
    const uu = -U_MAX + (2 * U_MAX * x) / (W - 1), yy = AXIS - expected(S, uu) * sc;
    const lo = prev === null ? yy : min(yy, prev), hi = prev === null ? yy : max(yy, prev);
    for (let y = floor(lo); y <= Math.ceil(hi); y++) {
      if (y < 97 || y > 127) continue;
      const w = y < lo ? 1 - (lo - y) : y > hi ? 1 - (y - hi) : 1;
      if (w <= 0) continue;
      const g = 150 * w + 40;
      display.setPixel(x, y, g, g, g + 10);
    }
    prev = yy;
  }
  const col = round(((u + U_MAX) / (2 * U_MAX)) * (W - 1));
  for (let y = 97; y < H; y++) display.setPixel(col, y, 60, 60, 70);
  const ry = round(AXIS - S.chi * sc);
  const now = S.chi > 0 ? b : S.chi < 0 ? o : [255, 255, 255];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const yy = ry + dy, xx = col + dx;
      if (yy >= 97 && yy < H && xx >= 0 && xx < W && (dx === 0 || dy === 0)) display.setPixel(xx, yy, now[0], now[1], now[2]);
    }
  // Islands at the top left, lakes at the bottom right, where the curve
  // never goes.
  digits(display, S.blobs, 1, 98, b, false);
  digits(display, S.holes, 62, 122, o, true);
}
