// ===== Patternflow pattern =====
// Title:   Crow Instability
// Family:  contrail
// Idea:    Contrails laid across a twilight sky start as one crisp white line, then bow toward each other in a growing wave, pinch and link into a chain of ovals that thin to wisps, while the trails above the sunlit layer glow rose and gold and the ones below it turn blue-grey.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: S. C. Crow, Stability theory for a pair of trailing vortices, AIAA Journal 8 (1970), for the instability; the contrail linking pictures that followed from it
// Round:   216
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0.4..4, Traffic=-1..1, Sun=-1..1
//
// Knob 1: Hue. Walks the sky through three palettes and back, so one turn comes back to where it began. At 0 it is a sunset: deep indigo at the top row, then violet, magenta, coral, and orange at the bottom row. At 1/3 it is a blue dusk that ends in a pale blue horizon, at 2/3 a green-gold dawn (teal, sage, gold), and at 1 the sunset again. Between two palettes the colours cross-fade, so the middle of a move is a dusky grey. The trails keep their own colours.
// Knob 2: Growth. How fast the Crow wave grows, in e-folds a second: 1/14 at the opening 2, times 2 to the power of 0.95 per knob step away from it. At the opening the two lines of a trail touch after 35 s and the rings are gone after 83 s. At 0.4 the rate is 0.025: they touch after 100 s, so a trail stays almost straight until it is cut off at 200 s. At 4 the rate is 0.27: they touch after 9 s and the trail is gone after 22 s.
// Knob 3: Traffic. How many trails are on the sky and how fast each is laid. At -1 one trail is wanted and the head runs at 20 LEDs a second; at the opening (0) 2.5 and 25; at 1 four and 30. A trail's own speed is within 12 percent of that. The count is a target: births come at random whenever fewer than that many trails are still strong.
// Knob 4: Sun. The height of the sunlit layer. A trail above it has a near-white core and a gold edge that turns rose higher up; below it the core is blue-grey and the edge slate blue; the change takes about 26 LEDs. At -1 the layer is above the panel and every trail is in shadow, at the opening (0.06) its lower edge is near row 79, and at 1 it is below the panel and every trail is lit. The edge swings up to 23 rows either way on two slow periods (295 s and 459 s) and leans by up to 6 rows across the width. The whole sky is 17 percent darker than at the opening at -1 and 15 percent brighter at 1.

// What is drawn is the wake of aircraft, and no aircraft. Each trail is a straight line across the panel, from one
// edge to another, that starts and ends 40 LEDs outside it. Its head runs along it at 20 to 30 LEDs a second and
// lays two vortex lines 2.6 LEDs apart (2.3 to 2.9 from trail to trail) that open from one crisp line over the
// first 14 s. Every point of the line remembers how long ago it was laid and how many e-folds of growth it has had
// since (phi, summed with the knob as it was each second), so a trail laid at one setting of Growth and carried to
// another grows at the new rate from then on.
// Crow's instability is a wave of 8.6 vortex separations (22 LEDs, 19 to 26) in which the two lines bow toward each
// other at the troughs. Where the amplitude A is under half the separation b the lines are at the centre line
// plus or minus (b/2 - A cos(k s)), with A = (b/2) exp(phi - 2.5) and a swell in s, so the first ripple is 0.1 LED
// and the lines touch when phi has risen by 2.5. After they touch, the lines have linked, and the picture is a chain
// of rings: plus or minus b (1 + 0.75 l) sin(k s / 2) to the power q, l being the e-folds since the link. q goes
// from 2 (a pointed lens, what the touch looked like) to 0.5 (round ends) in 0.9 e-folds, and the rings widen as
// l grows. The middle line wanders by 0.6 A before the link (0.3 b at the link) and 0.3 b exp(-l) after.
// Every ring is thinned by the air: the width of a line grows 0.7 percent a second and 22 percent an e-fold after
// the link, its density drops with that, and from 1.6 e-folds after the link to 3.6 the rings thin to wisps and go.
// The drawing is the sum of gaussians: a stamp every 0.6 LED along each of the two lines, at a sigma of 0.8 LED when
// the line is laid (2 LEDs wide at half height), and a wide soft stamp every 1.4 LEDs at 2.4 times that sigma, up to
// 4.5 LEDs, at 0.16 of the strength. The density goes over the sky as an opacity, 1 - exp(-density), so two lines on
// top of each other brighten and never clip to a flat white. The core is nearly white and the soft part takes the
// colour of the layer it is in.
// Wind carries every trail: each point has drifted by a speed of 0.2 to 0.7 LEDs a second times the time since it was
// laid (saturating at 60 s, so a trail never leaves for good), in a direction that swings 0.6 rad either way over
// 370 s. The oldest end drifts most, so a trail pivots on its head. Births come at random at a rate of (target -
// strong + 0.4) / 12 per second, so the sky never repeats. The first update puts down trails of
// mixed ages for the opening knobs: one just laid and the others from forming to rings.
// The sky is three palettes of five colour stops, indigo to orange for the sunset, and the stops breathe on swings
// of 33 to 200 s that have no common period. A faint haze (4.5 and 3.5 percent of the brightness, two drifting
// waves) and a static dither of under one level keep the gradient from stepping into bands on the panel.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sin, cos, exp, log, sqrt, pow, abs, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => {
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return u * u * (3 - 2 * u);
};

// ---- the trails
const SEP = 2.6; // LEDs between the two vortex lines when the trail is laid (b)
const WAVE = 8.6; // the most unstable Crow wavelength, in separations
const LINK = 2.5; // e-folds of growth from the first ripple to the two lines touching
const MARGIN = 40; // a trail starts and ends this far outside the panel, LEDs
const TUBE = 0.8; // sigma of one vortex line when it is laid, LEDs (2 LEDs wide at half height)
const SPREAD = 0.007; // the line widens by this fraction of its width each second as the air mixes it
const ALPHA = 1.3; // density at the middle of one fresh line; two lines on top of each other give twice that
const FADE_FROM = 1.6; // e-folds after linking that the rings start to thin
const FADE_TO = 3.6; // and are gone
const LIFE_CAP = 200; // a trail that has not linked yet is gone after this many seconds
const SDS = 0.6; // spacing of the points the curve is built from, LEDs
const MAXS = 560;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  if (i === 0) (out[0] = v), (out[1] = t), (out[2] = p);
  else if (i === 1) (out[0] = q), (out[1] = v), (out[2] = p);
  else if (i === 2) (out[0] = p), (out[1] = v), (out[2] = t);
  else if (i === 3) (out[0] = p), (out[1] = q), (out[2] = v);
  else if (i === 4) (out[0] = t), (out[1] = p), (out[2] = v);
  else (out[0] = v), (out[1] = p), (out[2] = q);
}

export function setup(params) {
  const rng = mulberry32(floor(Math.random() * 4294967296));
  const noise = new Float32Array(N);
  // Interleaved gradient noise, one value per LED, added before rounding so a slow gradient does not step.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = 52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1);
      noise[y * W + x] = v - floor(v);
    }
  params.s = {
    rng,
    t: 0,
    Phi: 0, // growth, in e-folds, summed over every second so far
    sigma: 1 / 14, // e-folds a second
    speed: 25,
    nt: 2.5,
    sun: 0.53,
    hue: 0,
    trails: [],
    ready: false,
    dc: new Float32Array(N),
    dh: new Float32Array(N),
    noise,
    sky: new Float32Array(256 * 3),
    sky2: new Float32Array(256 * 3),
    gx: new Float32Array(128),
    gy: new Float32Array(128),
    px1: new Float32Array(MAXS), py1: new Float32Array(MAXS),
    px2: new Float32Array(MAXS), py2: new Float32Array(MAXS),
    psg: new Float32Array(MAXS), pal: new Float32Array(MAXS),
    col: new Float32Array(24),
    yl: 70, tiltSun: 0.2,
  };
}

// A line across the panel: where it comes in, which way it goes, how long it is inside and outside.
function pickLine(rng, trails) {
  for (let tries = 0; tries < 60; tries++) {
    const r = rng();
    const e = r < 0.3 ? 0 : r < 0.6 ? 1 : r < 0.8 ? 2 : 3; // left, right, top, bottom
    let o;
    const q = rng();
    if (q < 0.68) o = e ^ 1; // the opposite side
    else o = (e < 2 ? 2 : 0) + (rng() < 0.5 ? 0 : 1); // one of the two sides next to it
    const at = (edge, u) => (edge === 0 ? [0, 6 + 116 * u] : edge === 1 ? [W, 6 + 116 * u] : edge === 2 ? [6 + 52 * u, 0] : [6 + 52 * u, H]);
    const a = at(e, rng()), b = at(o, rng());
    const dx = b[0] - a[0], dy = b[1] - a[1], len = sqrt(dx * dx + dy * dy);
    if (len < 58 || len > 175) continue;
    const ang = (Math.atan2(abs(dy), abs(dx)) * 180) / PI;
    const dev = min(ang, 90 - ang);
    if (dev < 12) continue;
    if (dev < 24 && rng() > 0.35) continue;
    // Not nearly parallel to a trail already there, most of the time.
    let near = false;
    for (const tr of trails) {
      const c = abs(tr.dx * (dx / len) + tr.dy * (dy / len));
      if (c > 0.96) near = true;
    }
    if (near && rng() < 0.8) continue;
    return { sx: a[0], sy: a[1], dx: dx / len, dy: dy / len, chord: len };
  }
  return { sx: 0, sy: 40, dx: 0.9, dy: 0.44, chord: 70 };
}

// One trail, laid `age` seconds ago. The growth already summed is what it would have had at the knob it opened with.
function spawn(S, age) {
  const rng = S.rng;
  const L = pickLine(rng, S.trails);
  const speed = S.speed * (0.88 + 0.24 * rng());
  const len = L.chord + 2 * MARGIN;
  const b = SEP * (0.88 + 0.24 * rng());
  const lay = len / speed;
  const phi0 = S.Phi - S.sigma * age;
  S.trails.push({
    t0: S.t - age,
    x0: L.sx - L.dx * MARGIN, y0: L.sy - L.dy * MARGIN,
    dx: L.dx, dy: L.dy, nx: -L.dy, ny: L.dx,
    len, v: speed, b,
    k: (2 * PI) / (WAVE * b * (0.96 + 0.08 * rng())),
    th0: rng() * 2 * PI,
    e1: rng() * 2 * PI, e2: rng() * 2 * PI, e3: rng() * 2 * PI, e4: rng() * 2 * PI,
    wsp: 0.2 + 0.5 * rng(), wb: rng() * 2 * PI, wp: rng() * 2 * PI,
    phi0, phi1: age > lay ? phi0 + S.sigma * lay : null,
  });
}

function life(S) {
  return min(LIFE_CAP * 0.95, (LINK + FADE_TO - 0.4) / S.sigma);
}

// Trails of mixed ages are on the sky at second 0: one just laid, the rest from forming to rings.
function populate(S) {
  const n = cl(floor(S.nt + S.rng()), 1, 4);
  const Lf = life(S), r = S.rng;
  const ages = [];
  if (n === 1) ages.push(0.42 + 0.18 * r());
  else if (n === 2) ages.push(0.04 + 0.12 * r(), 0.5 + 0.1 * r());
  else if (n === 3) ages.push(0.04 + 0.1 * r(), 0.27 + 0.11 * r(), 0.5 + 0.1 * r());
  else ages.push(0.04 + 0.1 * r(), 0.22 + 0.08 * r(), 0.4 + 0.1 * r(), 0.64 + 0.2 * r());
  for (const a of ages) spawn(S, max(1.5, a * Lf));
  S.ready = true;
}

function advance(S, h) {
  S.t += h;
  S.Phi += S.sigma * h;
  const T = [];
  for (const tr of S.trails) {
    if (tr.phi1 === null && S.t - tr.t0 >= tr.len / tr.v) tr.phi1 = S.Phi;
    const age = S.t - tr.t0;
    const dead = S.Phi - tr.phi0 > LINK + FADE_TO - 0.2 || age > LIFE_CAP;
    if (!dead) T.push(tr);
  }
  S.trails = T;
  // Births come at random: the fewer trails there are against the knob, the sooner the next one.
  let strong = 0;
  for (const tr of S.trails) if (S.Phi - tr.phi0 < LINK + FADE_FROM + 0.6 && S.t - tr.t0 < LIFE_CAP * 0.6) strong++;
  const rate = max(0, S.nt - strong + 0.4) / 12;
  if (S.trails.length < 6 && S.rng() < 1 - exp(-rate * h)) spawn(S, 0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.sigma = (1 / 14) * pow(2, (cl(k[1], 0.4, 4) - 2) * 0.95);
  S.nt = 2.5 + 1.5 * cl(k[2], -1, 1);
  S.speed = 25 + 5 * cl(k[2], -1, 1);
  S.sun = (cl(k[3], -1, 1) + 1) / 2;
  if (!S.ready) populate(S);
  let span = cl(dt || 0, 0, 0.5);
  while (span > 1e-9) {
    const h = min(span, 0.25);
    advance(S, h);
    span -= h;
  }
  S.yl = -45 + 225 * S.sun + 14 * sin(0.0213 * S.t + 1.1) + 9 * sin(0.0137 * S.t + 4.3);
  S.tiltSun = 0.2 * sin(0.0091 * S.t + 2.0);
}

// A gaussian of sigma sg centred on cx, cy, scaled by w, added into D. Pixel x covers x to x + 1.
function stamp(S, D, cx, cy, sg, w) {
  const R = min(60, ceil(3 * sg));
  const xa = max(0, floor(cx - R)), xb = min(W - 1, floor(cx + R));
  const ya = max(0, floor(cy - R)), yb = min(H - 1, floor(cy + R));
  if (xa > xb || ya > yb) return;
  const inv = -0.5 / (sg * sg), gx = S.gx, gy = S.gy;
  for (let x = xa; x <= xb; x++) {
    const d = x + 0.5 - cx;
    gx[x - xa] = exp(inv * d * d);
  }
  for (let y = ya; y <= yb; y++) {
    const d = y + 0.5 - cy;
    gy[y - ya] = w * exp(inv * d * d);
  }
  const nx = xb - xa + 1;
  for (let y = ya; y <= yb; y++) {
    const g = gy[y - ya], row = y * W + xa;
    for (let i = 0; i < nx; i++) D[row + i] += g * gx[i];
  }
}

// A line of stamps along the points x, y (n of them): sigma and density per point are sg and al, scaled by ks and ka, with sigma held to cap.
function stroke(S, D, x, y, sg, al, n, step, ks, ka, cap) {
  const k2 = 1 / sqrt(2 * PI);
  for (let j = 0; j < n - 1; j++) {
    const dx = x[j + 1] - x[j], dy = y[j + 1] - y[j], len = sqrt(dx * dx + dy * dy);
    const R = 3 * min(cap, max(sg[j], sg[j + 1]) * ks);
    if ((x[j] < -R && x[j + 1] < -R) || (x[j] > W + R && x[j + 1] > W + R) || (y[j] < -R && y[j + 1] < -R) || (y[j] > H + R && y[j + 1] > H + R)) continue;
    const m = max(1, ceil(len / step));
    for (let q = 0; q < m; q++) {
      const f = (q + 0.5) / m;
      const s = min(cap, (sg[j] + (sg[j + 1] - sg[j]) * f) * ks);
      const a = (al[j] + (al[j + 1] - al[j]) * f) * ka;
      if (a < 0.003) continue;
      stamp(S, D, x[j] + dx * f, y[j] + dy * f, s, (a * (len / m) * k2) / s);
    }
  }
}

function drawTrail(S, tr) {
  const T = S.t, age = T - tr.t0;
  const sHead = min(tr.len, tr.v * age);
  if (sHead < 1) return;
  const phiEnd = tr.phi1 !== null ? tr.phi1 : S.Phi;
  const sLaid = tr.phi1 !== null ? tr.len : sHead;
  const wa = tr.wb + 0.6 * sin(0.017 * T + tr.wp);
  const wx = tr.wsp * cos(wa), wy = tr.wsp * sin(wa);
  const n = min(MAXS, floor(sHead / SDS) + 1);
  const b = tr.b;
  let np = 0;
  for (let i = 0; i < n; i++) {
    const s = i * SDS;
    const ag = max(0, age - s / tr.v); // seconds since this point was laid
    const phi = S.Phi - (tr.phi0 + (phiEnd - tr.phi0) * (s / sLaid));
    const ex = 0.28 * sin(0.11 * s + tr.e1) + 0.15 * sin(0.23 * s + tr.e2);
    const lf = phi - LINK + ex; // above zero: the two lines have touched here
    const th = tr.k * s + tr.th0, c = cos(th), u = 0.5 * (1 - c);
    // A fresh trail is one line: the two vortices open to their separation over the first 14 seconds.
    const sepf = 0.35 + 0.65 * smooth(ag / 14);
    let hw, mid;
    if (lf <= 0) {
      const A = 0.5 * b * exp(lf);
      hw = 0.5 * b * sepf - A * c;
      mid = 0.6 * A * sin(th + 1.1);
    } else {
      const q = 2 - 1.5 * smooth(lf / 0.9);
      hw = b * (1 + 0.75 * lf) * pow(u, q * 0.5);
      mid = 0.3 * b * exp(-lf) * sin(th + 1.1);
    }
    const sg = TUBE * (1 + SPREAD * ag) * (1 + 0.22 * max(0, lf));
    const fd = 1 - smooth((lf - FADE_FROM) / (FADE_TO - FADE_FROM));
    const tf = 1 - smooth((ag - (LIFE_CAP - 80)) / 80);
    const wisp = 1 - 0.4 * smooth(lf / 2) * (0.5 + 0.5 * sin(0.31 * s + tr.e3) * sin(0.17 * s + tr.e4));
    const head = smooth((sHead - s) / 7);
    const al = ALPHA * pow(TUBE / sg, 0.6) * fd * tf * wisp * head;
    const ae = 60 * (1 - exp(-ag / 60));
    const bx = tr.x0 + tr.dx * s + wx * ae, by = tr.y0 + tr.dy * s + wy * ae;
    S.px1[np] = bx + tr.nx * (mid + hw);
    S.py1[np] = by + tr.ny * (mid + hw);
    S.px2[np] = bx + tr.nx * (mid - hw);
    S.py2[np] = by + tr.ny * (mid - hw);
    S.psg[np] = sg;
    S.pal[np] = al;
    np++;
  }
  if (np < 2) return;
  stroke(S, S.dc, S.px1, S.py1, S.psg, S.pal, np, 0.6, 1, 1, 9);
  stroke(S, S.dc, S.px2, S.py2, S.psg, S.pal, np, 0.6, 1, 1, 9);
  stroke(S, S.dh, S.px1, S.py1, S.psg, S.pal, np, 1.4, 2.4, 0.16, 4.5);
  stroke(S, S.dh, S.px2, S.py2, S.psg, S.pal, np, 1.4, 2.4, 0.16, 4.5);
}

// Three skies, each five stops from the top row to the bottom row as [hue, saturation, value]: the sunset the
// pattern opens in, a blue dusk and a green-gold dawn. The Hue knob walks round them and back to the sunset, and
// between two skies the colours cross-fade, so the middle of a change is a soft dusky grey and never a rainbow.
const SKIES = [
  [[0.665, 0.92, 0.32], [0.78, 0.88, 0.5], [0.88, 0.72, 0.62], [1.03, 0.62, 0.8], [1.075, 0.8, 0.9]],
  [[0.65, 0.9, 0.2], [0.62, 0.85, 0.4], [0.56, 0.75, 0.58], [0.55, 0.55, 0.78], [0.58, 0.3, 0.95]],
  [[0.52, 0.85, 0.2], [0.46, 0.6, 0.38], [0.3, 0.42, 0.6], [0.14, 0.65, 0.85], [0.1, 0.75, 0.95]],
];

// One sky as 256 rows of colour. The stops breathe on swings with no common period, and the colour between two
// stops goes round the wheel with a smooth step.
function skyTable(S, k, out, pos) {
  const t = S.t, P = SKIES[k], mul = 0.8 + 0.3 * S.sun, rgb = [0, 0, 0];
  const hb = [0.016 * sin(0.043 * t + 0.7), 0.02 * sin(0.0613 * t), 0.018 * sin(0.0467 * t + 3.3), 0.018 * sin(0.0521 * t + 1.9), 0.012 * sin(0.0331 * t + 2.6)];
  const vb = [0.05 * sin(0.057 * t + 2.1), 0.06 * sin(0.0731 * t + 0.4), 0.08 * sin(0.0889 * t + 5.0), 0.05 * sin(0.0397 * t + 3.9), 0.03 * sin(0.0293 * t + 1.2)];
  let seg = 0;
  for (let i = 0; i < 256; i++) {
    const u = i / 255;
    while (seg < 3 && u > pos[seg + 1]) seg++;
    const a = P[seg], b = P[seg + 1];
    const f = smooth((u - pos[seg]) / (pos[seg + 1] - pos[seg]));
    const h = a[0] + hb[seg] + (b[0] + hb[seg + 1] - a[0] - hb[seg]) * f;
    const v = (a[2] * (1 + vb[seg]) + (b[2] * (1 + vb[seg + 1]) - a[2] * (1 + vb[seg])) * f) * mul;
    hsv(h, a[1] + (b[1] - a[1]) * f, v, rgb);
    out[i * 3] = rgb[0];
    out[i * 3 + 1] = rgb[1];
    out[i * 3 + 2] = rgb[2];
  }
}

function buildSky(S) {
  const t = S.t;
  const pos = [
    0,
    0.34 + 0.07 * sin(0.094 * t + 1.3) + 0.04 * sin(0.0371 * t + 4.1),
    0.6 + 0.06 * sin(0.0613 * t + 2.2) + 0.03 * sin(0.1217 * t + 0.4),
    0.82 + 0.04 * sin(0.0709 * t + 0.8),
    1,
  ];
  const u = (S.hue - floor(S.hue)) * 3, i = floor(u), f = smooth(u - i);
  skyTable(S, i % 3, S.sky, pos);
  if (f > 0.001) {
    skyTable(S, (i + 1) % 3, S.sky2, pos);
    for (let q = 0; q < 768; q++) S.sky[q] += (S.sky2[q] - S.sky[q]) * f;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  buildSky(S);
  S.dc.fill(0);
  S.dh.fill(0);
  for (const tr of S.trails) drawTrail(S, tr);

  // Trail colours: a core that is nearly white, an edge that is gold and rose in the sun and slate blue in shade.
  const C = S.col, tmp = [0, 0, 0];
  hsv(0.1, 0.5, 1, tmp); // lit gold
  C[0] = tmp[0]; C[1] = tmp[1]; C[2] = tmp[2];
  hsv(0.96, 0.5, 1, tmp); // lit rose
  C[3] = tmp[0]; C[4] = tmp[1]; C[5] = tmp[2];
  hsv(0.62, 0.5, 0.78, tmp); // shade edge
  C[6] = tmp[0]; C[7] = tmp[1]; C[8] = tmp[2];
  const litCore = [1, 0.95, 0.88], shCore = [0.78, 0.83, 0.94];
  const sky = S.sky, noise = S.noise, dc = S.dc, dh = S.dh;
  const tilt = 0.12 * sin(0.0253 * S.t + 0.9);
  const hz1 = 0.083 * S.t + 0.6, hz2 = -0.061 * S.t + 2.4; // the haze drifts on two slow swings
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const tt = cl((y + 0.5 + tilt * (x - 31.5)) / H, 0, 1) * 255;
      const i0 = min(254, floor(tt)), fr = tt - i0;
      const hz = 1 + 0.045 * sin(0.075 * x - 0.052 * y + hz1) + 0.035 * sin(0.041 * x + 0.097 * y + hz2);
      let r = (sky[i0 * 3] + (sky[i0 * 3 + 3] - sky[i0 * 3]) * fr) * hz;
      let g = (sky[i0 * 3 + 1] + (sky[i0 * 3 + 4] - sky[i0 * 3 + 1]) * fr) * hz;
      let bl = (sky[i0 * 3 + 2] + (sky[i0 * 3 + 5] - sky[i0 * 3 + 2]) * fr) * hz;
      const a = dc[p], h = dh[p];
      if (a + h > 0.004) {
        const sf = smooth((S.yl + S.tiltSun * (x - 31.5) - y) / 26 + 0.5);
        const ge = min(1, sf * 2), pk = max(0, sf * 2 - 1);
        const er = (C[6] + (C[0] - C[6]) * ge) * (1 - pk) + C[3] * pk;
        const eg = (C[7] + (C[1] - C[7]) * ge) * (1 - pk) + C[4] * pk;
        const eb = (C[8] + (C[2] - C[8]) * ge) * (1 - pk) + C[5] * pk;
        const ah = (1 - exp(-h)) * (0.55 + 0.45 * sf);
        r += (er - r) * ah;
        g += (eg - g) * ah;
        bl += (eb - bl) * ah;
        const m = min(1, pow(a / 0.9, 1.3));
        const cr = er + ((litCore[0] * sf + shCore[0] * (1 - sf)) - er) * m;
        const cg = eg + ((litCore[1] * sf + shCore[1] * (1 - sf)) - eg) * m;
        const cb = eb + ((litCore[2] * sf + shCore[2] * (1 - sf)) - eb) * m;
        const ac = (1 - exp(-a)) * (0.82 + 0.18 * sf);
        r += (cr - r) * ac;
        g += (cg - g) * ac;
        bl += (cb - bl) * ac;
      }
      const d = noise[p] - 0.5;
      display.setPixel(x, y, cl(round(r * 255 + d), 0, 255), cl(round(g * 255 + d), 0, 255), cl(round(bl * 255 + d), 0, 255));
    }
  }
}
