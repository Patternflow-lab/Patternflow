// ===== Patternflow pattern =====
// Title:   Spider Drop
// Family:  halloween
// Idea:    A spider sits at the hub of an orb web strung across the moon, lets go and falls on its silk to the foot of the panel between two corner cobwebs, bounces and twists on the line, then climbs back up it, and the web jolts each time the line snaps tight or the spider lets go.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 41; after the drop-down spiders hung over doorways at Halloween
// Round:   41
// ===============================
// @matrix 64x128
// @knobs Colour=0..1, Speed=0.2..3, Spiders=1..3, Wind=0..1
//
// Knob 1: Colour. Three palettes round the knob: at 0 an orange moon, a violet web and a toxic green spider with orange spots; at 0.33 a toxic green moon, an orange web and a purple spider; at 0.67 a lilac moon, a green web and an orange spider. Each holds for 0.1 either side of its point and blends into the next in between, and 1 is 0 again.
// Knob 2: Speed. At 2 one round takes 8.4 seconds: 1.1 at the hub, a 1.3-second fall to 62 rows below it, 3.2 bouncing and twisting on the line and 2.7 climbing back. At 0.2 a round takes 84 seconds, at 3 it takes 5.6.
// Knob 3: Spiders, 1 to 3. The second and third are 0.72 the size of the first and hang from the left and right of the web's rim, dropping 44 and 52 rows. With all three on their lines the hub sags 9 LEDs when they land, against 6 for one.
// Knob 4: Wind. Sways the web sideways, up to 3 LEDs at the hub, and swings the spiders on their lines. At 0.06 the main spider swings about 10 LEDs either side, most of it from the landing; at 1 the gusts swing it 20.
// Buttons: K1 tap drops every spider that is sitting at the hub or climbing, at once.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, abs, round, sin, cos, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The orb web: hub, spokes, frame radius per spoke, capture spiral.
const HX = 31, HY = 30, SPOKES = 10, TURNS = 3.2, R_IN = 6;
// The moon behind it.
const MX = 37, MY = 27, MR = 19;
// Palettes, cycled by K1: moon, moon's rim, web, spider, spider's mark.
const PAL = [
  [[1, 0.62, 0.16], [1, 0.84, 0.5], [0.72, 0.5, 1], [0.42, 1, 0.16], [1, 0.45, 0.05]],
  [[0.55, 1, 0.22], [0.85, 1, 0.6], [1, 0.58, 0.12], [0.72, 0.3, 1], [0.45, 1, 0.2]],
  [[0.74, 0.5, 1], [0.9, 0.8, 1], [0.45, 1, 0.25], [1, 0.55, 0.08], [0.75, 0.3, 1]],
];
// Spiders: where each hangs from (the hub, or a point on spoke n at 0.8 of
// its length), how far it drops in rows, and its size.
const SPIDERS = [
  { from: -1, drop: 62, size: 1 },
  { from: 8, drop: 44, size: 0.72 },
  { from: 3, drop: 52, size: 0.72 },
];

function webGeometry() {
  const spokes = [];
  for (let i = 0; i < SPOKES; i++) {
    const a = (TAU * (i + 0.3 * (hash(i * 7 + 1) - 0.5))) / SPOKES - PI / 2;
    const R = 24 + 4 * hash(i * 7 + 2);
    spokes.push({ a, R });
  }
  return spokes;
}

// Corner cobwebs at the foot of the panel, drawn once: radial threads from
// each bottom corner and three sagging arcs across them.
function cornerWebs() {
  const cov = new Float32Array(N);
  for (const side of [-1, 1]) {
    const cx = side < 0 ? 0 : W, cy = H, angs = [0.05, 0.55, 1.05, 1.52];
    const pt = (r, a) => [cx - side * r * cos(a), cy - r * sin(a)];
    for (const a of angs) line(cov, ...pt(0, a), ...pt(31, a), 1.6, 0.8);
    for (const r of [10, 19, 28])
      for (let n = 0; n < angs.length - 1; n++)
        for (let m = 1; m <= 6; m++) {
          const at = (k) => pt(r - 1.6 * sin((PI * k) / 6) * (r / 20), mix(angs[n], angs[n + 1], k / 6));
          line(cov, ...at(m - 1), ...at(m), 1.5, 0.75);
        }
  }
  return cov;
}

export function setup(params) {
  params.s = {
    spokes: webGeometry(), t: 0, hue: 0, speed: 2, count: 1, wind: 0.06,
    // The web's sag (rows) and its rate: a damped spring the spiders kick.
    sag: 0, sagV: 0, gust: 0,
    sp: SPIDERS.map((d, i) => ({ ...d, i, phase: "rest", timer: 0, y: 0, vy: 0, spin: 0, spinV: 0, sw: 0, swV: 0, gait: 0, on: i === 0 })),
    base: cornerWebs(), cov: new Float32Array(N), legs: new Float32Array(N), rgb: new Float32Array(N * 3), moon: new Float32Array(N * 3), pal: -1,
  };
}

const REST = 1.1, HANG = 3.2, CLIMB = 30;

function kickWeb(S, v) {
  S.sagV += v;
}

function stepSpider(S, p, d, tap) {
  p.timer += d;
  if (!p.on) {
    p.phase = "rest";
    p.y = 0;
    return;
  }
  if (tap && p.phase !== "drop" && p.phase !== "hang") {
    p.phase = "drop";
    p.timer = 0;
    p.vy = max(p.vy, 0);
    kickWeb(S, -6 * p.size);
  }
  if (p.phase === "rest") {
    p.y = 0;
    p.vy = 0;
    p.spin *= exp(-d * 3);
    if (p.timer > REST) {
      p.phase = "drop";
      p.timer = 0;
      kickWeb(S, -6 * p.size);
    }
  } else if (p.phase === "drop" || p.phase === "hang") {
    // A fall with drag, at most 79 rows a second, until the line runs out;
    // then the line stretches like a spring, about 7 rows past its length.
    const L = p.drop;
    let acc = 150 - 1.9 * p.vy;
    if (p.y > L) acc -= 110 * (p.y - L) + 1.6 * p.vy;
    if (p.phase === "drop" && p.y > L) {
      p.phase = "hang";
      p.timer = 0;
      p.spinV += (p.i & 1 ? -1 : 1) * 7;
      p.swV += (p.i & 1 ? 1 : -1) * 0.2;
      kickWeb(S, 0.17 * p.vy * p.size);
    }
    p.vy += acc * d;
    p.y += p.vy * d;
    if (p.phase === "hang") {
      // Twisting on the line: a torsion pendulum.
      p.spinV += (-5 * p.spin - 0.45 * p.spinV) * d;
      p.spin += p.spinV * d;
      if (p.timer > HANG) {
        p.phase = "climb";
        p.timer = 0;
      }
    }
  } else if (p.phase === "climb") {
    p.gait += d * 9;
    const v = CLIMB * (0.55 + 0.45 * sin(p.gait) ** 2);
    p.y = max(0, p.y - v * d);
    p.vy = 0;
    p.spin *= exp(-d * 2);
    if (p.y <= 0) {
      p.phase = "rest";
      p.timer = 0;
      kickWeb(S, 3 * p.size);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.count = cl(round(k[2]), 1, 3);
  S.wind = cl(k[3], 0, 1);
  const pd = d * S.speed * 0.5;
  S.t += pd;
  const tap = !!(input.btnPressed && input.btnPressed[0]);
  for (const p of S.sp) {
    const on = p.i < S.count;
    if (on && !p.on) p.timer = REST - 0.3 - p.i * 0.4;
    p.on = on;
    stepSpider(S, p, pd, tap);
  }
  // The web: a spring pulled down by the weight on its lines, and harder
  // while a line is stretched past its length.
  let load = 0;
  for (const p of S.sp) if (p.on && p.y > 0) load += p.size * (p.phase === "hang" ? 1 + 0.03 * max(0, p.y - p.drop) * 10 : 1);
  S.sagV += (-30 * (S.sag - 1.7 * load) - 2.4 * S.sagV) * pd;
  S.sag += S.sagV * pd;
  // Wind: a slow swell with gusts.
  S.gust = S.wind * (0.6 * sin(S.t * 0.9) + 0.4 * sin(S.t * 2.3 + 1)) + 0.15 * sin(S.t * 1.7);
  for (const p of S.sp) {
    if (!p.on) continue;
    const L = max(4, p.y);
    p.swV += ((-90 / L) * sin(p.sw) - 0.5 * p.swV + (S.gust * 18) / L) * pd;
    p.sw += p.swV * pd;
    p.sw = cl(p.sw, -0.6, 0.6);
  }
}

// --- drawing ---

// Anti-aliased line of width w into the coverage buffer, keeping the most
// coverage at each LED.
function line(cov, x0, y0, x1, y1, w, a) {
  const r = w / 2;
  const xa = max(0, floor(min(x0, x1) - r - 1)), xb = min(W - 1, floor(max(x0, x1) + r + 1));
  const ya = max(0, floor(min(y0, y1) - r - 1)), yb = min(H - 1, floor(max(y0, y1) + r + 1));
  const dx = x1 - x0, dy = y1 - y0, ll = dx * dx + dy * dy || 1e-9;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, u = cl((px * dx + py * dy) / ll, 0, 1);
      const ex = px - u * dx, ey = py - u * dy, c = cl(r - sqrt(ex * ex + ey * ey) + 0.5, 0, 1) * a;
      const o = y * W + x;
      if (c > cov[o]) cov[o] = c;
    }
}

function palette(S) {
  const h = (S.hue - floor(S.hue)) * 3, i = floor(h) % 3, f = h - floor(h), j = (i + 1) % 3;
  // Each palette holds for 0.1 either side of 0, 1/3 and 2/3 of the knob.
  const g = cl((f - 0.3) / 0.4, 0, 1), s = g * g * (3 - 2 * g);
  return PAL[0].map((_, n) => [0, 1, 2].map((c) => mix(PAL[i][n][c], PAL[j][n][c], s)));
}

// Where the web's point at radius r, angle a sits now: pulled down by the
// sag, cone-shaped about the hub, and pushed sideways by the wind.
function webPoint(S, r, a, R, out) {
  const f = max(0, 1 - r / (R + 4));
  out[0] = HX + r * cos(a) + S.gust * 3 * f;
  out[1] = HY + r * sin(a) + S.sag * f + 0.6 * S.sag * f * sin(3 * a);
}

function drawSpider(S, rgb, p, x, y, pal) {
  const sz = p.size, c = cos(p.spin), sx = (abs(c) < 0.18 ? 0.18 * Math.sign(c || 1) : c) * sz;
  const body = pal[3], mark = pal[4];
  const legs = S.legs;
  const bx0 = max(0, floor(x - 19 * sz)), bx1 = min(W - 1, floor(x + 19 * sz)), by0 = max(0, floor(y - 11 * sz)), by1 = min(H - 1, floor(y + 22 * sz));
  for (let yy = by0; yy <= by1; yy++) legs.fill(0, yy * W + bx0, yy * W + bx1 + 1);
  // Head down: abdomen at (x, y), head below it. Legs from the head.
  const hx = x, hy = y + 7.5 * sz;
  const idle = p.phase === "climb" ? 0.35 : p.phase === "drop" ? 0.08 : 0.12;
  const base = [0.45, 1.0, 1.85, 2.45];
  for (let side = -1; side <= 1; side += 2)
    for (let j = 0; j < 4; j++) {
      const wig = idle * sin(p.gait + S.t * (p.phase === "climb" ? 0 : 2.2) + j * 1.6 + (side > 0 ? PI : 0));
      const a = base[j] + wig + (p.phase === "drop" ? (j < 2 ? -0.25 : 0.25) : 0);
      const rx = hx + side * 1.2 * sx, ry = hy - 1 + j * 0.9 * sz;
      const kx = rx + side * sin(a - 0.5) * 7 * sx, ky = ry + cos(a - 0.5) * 7 * sz - 3 * sz;
      const fx = kx + side * sin(a + 0.35) * 8 * sx, fy = ky + cos(a + 0.35) * 8 * sz;
      line(legs, rx, ry, kx, ky, 1.9, 1);
      line(legs, kx, ky, fx, fy, 1.6, 1);
    }
  for (let yy = by0; yy <= by1; yy++)
    for (let xx = bx0; xx <= bx1; xx++) {
      const o = yy * W + xx, a = legs[o];
      if (a <= 0) continue;
      for (let ch = 0; ch < 3; ch++) rgb[o * 3 + ch] = mix(rgb[o * 3 + ch], body[ch] * 0.8, a);
    }
  // Abdomen and head: filled ellipses with a soft edge.
  const blob = (cx, cy, rx, ry, col, lit) => {
    for (let yy = max(0, floor(cy - ry - 1)); yy <= min(H - 1, floor(cy + ry + 1)); yy++)
      for (let xx = max(0, floor(cx - rx - 1)); xx <= min(W - 1, floor(cx + rx + 1)); xx++) {
        const u = (xx + 0.5 - cx) / rx, v = (yy + 0.5 - cy) / ry, q = sqrt(u * u + v * v);
        const a = cl((1 - q) * min(rx, ry) + 0.5, 0, 1);
        if (a <= 0) continue;
        const o = (yy * W + xx) * 3, sh = lit * (1 - 0.35 * cl(q, 0, 1));
        for (let ch = 0; ch < 3; ch++) rgb[o + ch] = mix(rgb[o + ch], col[ch] * sh, a);
      }
  };
  const ax = 5.2 * sz * (0.75 + 0.25 * abs(c));
  blob(x, y, ax, 6.2 * sz, body, 1);
  blob(hx, hy, 3.2 * sz * (0.8 + 0.2 * abs(c)), 3 * sz, body, 0.85);
  // The mark on the abdomen's back, seen when the back faces out.
  const face = cl(c * 1.4, 0, 1);
  if (face > 0) {
    blob(x, y - 1.6 * sz, 1.6 * sz * abs(c) + 0.3, 1.6 * sz, mark, face);
    blob(x, y + 2 * sz, 1.3 * sz * abs(c) + 0.3, 1.3 * sz, mark, face);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { cov, rgb, spokes } = S;
  const pal = palette(S);
  const [moon, rim, web] = pal;
  cov.set(S.base);
  // Moon: a disc lit brighter toward its rim colour at the upper left, with
  // a few darker seas, and a faint halo. It only changes with the colour.
  if (S.pal !== S.hue) {
    S.moon.fill(0);
    for (let y = 0; y < 60; y++)
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - MX, dy = y + 0.5 - MY, r = sqrt(dx * dx + dy * dy), o = (y * W + x) * 3;
        const a = cl(MR - r + 0.5, 0, 1);
        const halo = 0.09 * cl(1 - (r - MR) / 7, 0, 1) * (r > MR ? 1 : 0);
        let sea = 0;
        for (const [sx, sy, sr] of [[-5, -3, 5], [4, 5, 4], [-2, 8, 3], [6, -6, 3]]) sea = max(sea, cl(1 - sqrt((dx - sx) ** 2 + (dy - sy) ** 2) / sr, 0, 1));
        const lift = cl(0.5 - (dx + dy) / (2.4 * MR), 0, 1);
        for (let ch = 0; ch < 3; ch++) S.moon[o + ch] = a * mix(moon[ch], rim[ch], lift) * (1 - 0.28 * sea) + halo * moon[ch];
      }
    S.pal = S.hue;
  }
  rgb.set(S.moon);
  // The orb web.
  const P = [0, 0], Q = [0, 0];
  for (const s of spokes) {
    webPoint(S, 1.5, s.a, s.R, P);
    webPoint(S, s.R, s.a, s.R, Q);
    line(cov, P[0], P[1], Q[0], Q[1], 1.8, 1);
  }
  for (let i = 0; i < SPOKES; i++) {
    const a = spokes[i], b = spokes[(i + 1) % SPOKES];
    webPoint(S, a.R, a.a, a.R, P);
    webPoint(S, b.R, b.a, b.R, Q);
    line(cov, P[0], P[1], Q[0], Q[1], 1.9, 1);
  }
  const steps = floor(TURNS * SPOKES);
  for (let k = 0; k < steps; k++) {
    const i = k % SPOKES, j = (k + 1) % SPOKES, f0 = k / steps, f1 = (k + 1) / steps;
    const a = spokes[i], b = spokes[j];
    const r0 = R_IN + (a.R - 3 - R_IN) * f0, r1 = R_IN + (b.R - 3 - R_IN) * f1;
    webPoint(S, r0, a.a, a.R, P);
    webPoint(S, r1, b.a, b.R, Q);
    line(cov, P[0], P[1], Q[0], Q[1], 1.7, 0.95);
  }
  // Moorings from the frame to the panel's edges.
  for (const [i, ex, ey] of [[0, 30, 0], [2, 63, 2], [4, 63, 52], [7, 0, 56], [9, 0, 3]]) {
    const s = spokes[i];
    webPoint(S, s.R, s.a, s.R, P);
    line(cov, P[0], P[1], ex, ey, 1.3, 0.85);
  }
  // Silk lines and the spiders' places.
  const places = [];
  for (const p of S.sp) {
    if (!p.on) continue;
    let ax, ay;
    if (p.from < 0) webPoint(S, 0, 0, 30, P);
    else {
      const s = spokes[p.from];
      webPoint(S, s.R * 0.8, s.a, s.R, P);
    }
    ax = P[0];
    ay = P[1];
    const L = p.y, x = ax + sin(p.sw) * L, y = ay + cos(p.sw) * L;
    if (L > 1) line(cov, ax, ay, x, y - 5 * p.size, 1, 0.9);
    places.push([p, x, y + 2 * p.size]);
  }
  for (let o = 0; o < N; o++) {
    // Threads are drawn whole or not at all: a lit LED is a lit LED.
    const c = cov[o] > 0.42 ? 1 : 0;
    if (c <= 0) continue;
    const q = o * 3, lum = max(rgb[q], rgb[q + 1], rgb[q + 2]);
    // Over the moon a thread is a dark line; over the sky a pale one.
    if (lum > 0.3) for (let ch = 0; ch < 3; ch++) rgb[q + ch] *= 1 - 0.85 * c;
    else for (let ch = 0; ch < 3; ch++) rgb[q + ch] = max(rgb[q + ch], web[ch] * c * 0.9);
  }
  for (const [p, x, y] of places) drawSpider(S, rgb, p, x, y, pal);
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) display.setPixel(x, y, round(255 * min(1, rgb[o * 3])), round(255 * min(1, rgb[o * 3 + 1])), round(255 * min(1, rgb[o * 3 + 2])));
}
