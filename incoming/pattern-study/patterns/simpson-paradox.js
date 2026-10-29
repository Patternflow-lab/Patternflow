// ===== Patternflow pattern =====
// Title:   Simpson's Paradox
// Family:  data
// Idea:    Three to five coloured clouds of points each rise to the right along their own least-squares line while the groups slide up and down like a seesaw, so the white least-squares line through all the points together swings through level and falls, and a slope gauge at the foot keeps every group's bar on the plus side while the pooled bar crosses to minus.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Simpson's paradox (Edward H. Simpson, 1951; named by Colin R. Blyth, 1972), after associations that vanish on pooling (Karl Pearson, 1899; G. Udny Yule, 1903), ordinary least squares (Adrien-Marie Legendre, 1805), pattern round 63
// Round:   63
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Groups=3..5, Spread=0..1
//
// Knob 1: Hue. Turns the groups' colours round the wheel together. At 0 three groups are amber, sea green and violet, four amber, green, blue and pink, five amber, green, cyan, violet and pink; the pooled line, its bar and the zero mark stay white whatever the knob.
// Knob 2: Speed. At 2 one seesaw takes 12 s: the groups hold in the reversed order for 2 s, slide for 4 s, hold in agreement for 2 s and slide back for 4 s, and the pooled slope crosses zero near 3.6 s and 9.5 s of the first round. The points wander inside their groups on the same clock. At 0.2 one seesaw takes 120 s, at 3 it takes 8 s.
// Knob 3: Groups. 3, 4 or 5 groups of 48, 38 or 30 points. Every group's own slope is 1.5 by construction, while the line through the group means tilts from -1.5 to +1.2; the fitted pooled slope ran from -1.33 to +1.30 with three groups and from -1.44 to +1.24 with five, and crosses zero where that tilt is -1.5 W / B, W the variance of x inside a group and B the variance of the group means: -0.14 for three groups, -0.09 for four, -0.06 for five.
// Knob 4: Spread. The scatter of each point about its group's line, 5 LEDs at 0 and 11.5 at 1 with three groups, less with more groups as they get narrower. The groups' fitted slopes shiver more on the gauge: at the opening 0.06 they stayed between 0.97 and 2.08 over ten minutes, at 1 between 0.12 and 3.00 over an hour, never below zero. The pooled slope hardly moves, as scatter inside the groups adds nothing to the tilt between them.

const W = 64, H = 128;
// The plot fills rows 0..107; the slope gauge sits in rows 110..127.
const PH = 108, GY = 110;
const { floor, round, min, max, abs, sqrt, exp, cos, log, PI, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
function gauss() {
  let u = random();
  while (u < 1e-12) u = random();
  return sqrt(-2 * log(u)) * cos(2 * PI * random());
}

// Inside a group a point sits at x = cx + HX u and y = cy + SLOPE HX u + sigma e,
// so the group's own trend is SLOPE (rows per column, y counted upward).
const SLOPE = 1.5;
// The group centres stand at fixed columns, SX either side of the middle,
// and their heights follow a tilt MB that the seesaw sweeps.
const SX = 21, YC = PH / 2;
const MB_LO = -1.5, MB_HI = 1.2;
// The seesaw, in seconds at Speed 2.
const HOLD_LO = 2, GLIDE = 4, HOLD_HI = 2, CYCLE = HOLD_LO + GLIDE + HOLD_HI + GLIDE;
const NPTS = [0, 0, 0, 48, 38, 30];

export function setup(params) {
  params.s = {
    G: 0, n: 0, gi: [], home: [], w: [], e: [], x: [], y: [],
    t: 0.4, mb: MB_LO, hue: 0, spread: 0,
    fit: [], pooled: { b: 0, a: 0 }, sign: -1, flash: 0,
    buf: new Float32Array(W * H * 3), c: [0, 0, 0],
  };
}

function populate(S, G) {
  S.G = G;
  const per = NPTS[G];
  S.n = G * per;
  S.gi = []; S.home = []; S.w = []; S.e = []; S.x = new Float64Array(S.n); S.y = new Float64Array(S.n);
  for (let g = 0; g < G; g++)
    for (let i = 0; i < per; i++) {
      S.gi.push(g);
      // Stratified along the group so every cloud covers its width.
      S.home.push(-1 + (2 * (i + random())) / per);
      S.w.push(0.12 * gauss());
      S.e.push(gauss());
    }
  S.fit = [];
  for (let g = 0; g < G; g++) S.fit.push({ b: SLOPE, a: 0, x0: 0, x1: 0, mx: 0, my: 0 });
}

function tilt(t) {
  t = t % CYCLE;
  if (t < HOLD_LO) return MB_LO;
  t -= HOLD_LO;
  if (t < GLIDE) return MB_LO + (MB_HI - MB_LO) * ease(t / GLIDE);
  t -= GLIDE;
  if (t < HOLD_HI) return MB_HI;
  t -= HOLD_HI;
  return MB_HI + (MB_LO - MB_HI) * ease(t / GLIDE);
}

// Ordinary least squares of y on x over the points whose group passes keep.
function ols(S, keep, out) {
  let n = 0, sx = 0, sy = 0;
  for (let i = 0; i < S.n; i++) if (keep(S.gi[i])) { n++; sx += S.x[i]; sy += S.y[i]; }
  const mx = sx / n, my = sy / n;
  let sxx = 0, sxy = 0, lo = 1e9, hi = -1e9;
  for (let i = 0; i < S.n; i++)
    if (keep(S.gi[i])) {
      const dx = S.x[i] - mx;
      sxx += dx * dx;
      sxy += dx * (S.y[i] - my);
      lo = min(lo, S.x[i]);
      hi = max(hi, S.x[i]);
    }
  out.b = sxy / sxx;
  out.a = my - out.b * mx;
  out.mx = mx; out.my = my; out.x0 = lo; out.x1 = hi;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const speed = cl(k[1], 0.2, 3), tau = (d * speed) / 2;
  const G = round(cl(k[2], 3, 5));
  S.spread = cl(k[3], 0, 1);
  if (G !== S.G) populate(S, G);
  S.t += tau;
  S.mb = tilt(S.t);
  // The points wander inside their groups on Ornstein-Uhlenbeck walks: the
  // scatter e keeps variance 1, and the offset w from a point's home along
  // the group keeps a deviation of 0.12 of the half-width.
  const th = 0.5, de = sqrt(2 * th * tau);
  for (let i = 0; i < S.n; i++) {
    S.w[i] += -th * S.w[i] * tau + 0.12 * de * gauss();
    S.e[i] += -th * S.e[i] * tau + de * gauss();
  }
  const half = (G - 1) / 2, HX = min(9, (0.47 * 2 * SX) / (G - 1));
  // The scatter shrinks faster than the groups' width, so that over an hour
  // at the widest spread no group's fitted slope fell below 0.12.
  const sigma = (5 + 6.5 * S.spread) * (HX / 9) ** 1.5;
  for (let i = 0; i < S.n; i++) {
    const kg = (S.gi[i] - half) / half, cx = W / 2 + SX * kg, cy = YC + S.mb * SX * kg;
    const u = cl(S.home[i] + S.w[i], -1, 1);
    S.x[i] = cx + HX * u;
    S.y[i] = cy + SLOPE * HX * u + sigma * S.e[i];
  }
  for (let g = 0; g < G; g++) ols(S, (j) => j === g, S.fit[g]);
  ols(S, () => true, S.pooled);
  const sign = S.pooled.b >= 0 ? 1 : -1;
  if (sign !== S.sign) S.flash = 1;
  S.sign = sign;
  S.flash = max(0, S.flash - d / 0.6);
}

function groupHue(S, g) {
  return S.hue + 0.12 + (S.G === 3 ? g * 0.3 : (g * 0.8) / (S.G - 1));
}

// Add a line y = a + b x (y upward in plot rows) between columns x0 and x1,
// anti-aliased, width w, colour c times v, into the buffer with max blending.
function line(buf, a, b, x0, x1, w, c, v) {
  const nrm = sqrt(1 + b * b), r = w / 2 + 0.5;
  for (let py = 0; py < PH; py++) {
    const yu = PH - 1 - py;
    // Columns where the line passes within r of this row.
    const xa = b === 0 ? -1 : (yu - a) / b, span = (r * nrm) / max(abs(b), 1e-6);
    let lo = b === 0 ? 0 : floor(xa - span), hi = b === 0 ? W - 1 : Math.ceil(xa + span);
    lo = max(lo, 0, floor(x0));
    hi = min(hi, W - 1, Math.ceil(x1));
    for (let x = lo; x <= hi; x++) {
      const dd = abs(b * x - yu + a) / nrm;
      let f = cl(r - dd, 0, 1);
      // Soft ends.
      f *= cl(x - x0 + 1, 0, 1) * cl(x1 - x + 1, 0, 1);
      if (f <= 0) continue;
      const p = (py * W + x) * 3;
      for (let j = 0; j < 3; j++) buf[p + j] = max(buf[p + j], c[j] * v * f);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.G) return;
  const buf = S.buf, c = S.c, white = [1, 1, 1];
  buf.fill(0);
  // A faint wash round each point in its group's colour.
  for (let i = 0; i < S.n; i++) {
    hsv(groupHue(S, S.gi[i]), 0.85, 1, c);
    const X = S.x[i], Y = PH - 1 - S.y[i];
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = round(X) + dx, y = round(Y) + dy;
        if (x < 0 || x >= W || y < 0 || y >= PH) continue;
        const r2 = (x - X) * (x - X) + (y - Y) * (y - Y), f = 0.12 * exp(-r2 / 3);
        const p = (y * W + x) * 3;
        for (let j = 0; j < 3; j++) buf[p + j] = min(0.3, buf[p + j] + c[j] * f);
      }
  }
  // Each group's own line, pale, across its points and faintly beyond.
  for (let g = 0; g < S.G; g++) {
    const f = S.fit[g];
    hsv(groupHue(S, g), 0.45, 1, c);
    line(buf, f.a, f.b, 0, W - 1, 0.9, c, 0.13);
    line(buf, f.a, f.b, f.x0 - 1, f.x1 + 1, 1.0, c, 0.75);
  }
  // The pooled line, white, thicker for a moment when its sign turns.
  line(buf, S.pooled.a, S.pooled.b, 0, W - 1, 1.5 + 1.5 * S.flash, white, 1);
  // Each group's mean as a small pale cross on its line.
  for (let g = 0; g < S.G; g++) {
    const f = S.fit[g], X = round(f.mx), Y = round(PH - 1 - f.my);
    hsv(groupHue(S, g), 0.3, 1, c);
    for (let a = -2; a <= 2; a++)
      for (const [x, y] of [[X + a, Y], [X, Y + a]]) {
        if (x < 0 || x >= W || y < 0 || y >= PH) continue;
        const p = (y * W + x) * 3;
        for (let j = 0; j < 3; j++) buf[p + j] = c[j];
      }
  }
  // The points on top, one LED each in full colour.
  for (let i = 0; i < S.n; i++) {
    const x = round(S.x[i]), y = round(PH - 1 - S.y[i]);
    if (x < 0 || x >= W || y < 0 || y >= PH) continue;
    hsv(groupHue(S, S.gi[i]), 0.9, 1, c);
    const p = (y * W + x) * 3;
    buf[p] = c[0]; buf[p + 1] = c[1]; buf[p + 2] = c[2];
  }
  // The gauge: one bar per group and the pooled bar in white, from the zero
  // mark in column 31, 16 LEDs per unit of slope, plus to the right.
  const bars = S.G + 1, th = bars <= 4 ? 3 : 2, gap = 1;
  const top = GY + floor((H - GY - (bars * th + (bars - 1) * gap)) / 2);
  for (let r = 0; r < bars; r++) {
    const pooled = r === S.G, b = pooled ? S.pooled.b : S.fit[r].b;
    if (pooled) c[0] = c[1] = c[2] = 1;
    else hsv(groupHue(S, r), 0.8, 1, c);
    const len = cl(b * 16, -31, 31), y0 = top + r * (th + gap);
    const xa = 32 + min(0, len), xb = 32 + max(0, len);
    for (let y = y0; y < y0 + th; y++)
      for (let x = floor(xa); x < Math.ceil(xb); x++) {
        if (x < 0 || x >= W) continue;
        const f = cl(min(x + 1 - xa, xb - x), 0, 1) * (pooled ? 1 : 0.85);
        const p = (y * W + x) * 3;
        for (let j = 0; j < 3; j++) buf[p + j] = c[j] * f;
      }
  }
  for (let y = GY - 1; y < H; y++) {
    const p = (y * W + 31) * 3;
    for (let j = 0; j < 3; j++) buf[p + j] = max(buf[p + j], 0.35);
  }
  for (let p = 0, i = 0; p < W * H; p++, i += 3)
    display.setPixel(p & 63, p >> 6, round(cl(buf[i], 0, 1) * 255), round(cl(buf[i + 1], 0, 1) * 255), round(cl(buf[i + 2], 0, 1) * 255));
}
