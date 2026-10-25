// ===== Patternflow pattern =====
// Title:   Lorentz Gas
// Family:  particle
// Idea:    A triangular array of round scatterers fills the panel and a burst of point particles leaves one spot between them in every direction at once, each bouncing specularly off the discs and changing colour with every bounce, so the bright bead breaks into a cloud that seeps from pocket to pocket through the narrow gaps while a thin ring at the measured root mean square distance grows like the square root of time, until the cloud fills the view and a new burst leaves another spot; with smaller discs straight corridors open between the rows and particles shoot along them in long streaks.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lorentz gas (Hendrik Lorentz, 1905), with the periodic Sinai billiard (Yakov Sinai, 1970), pattern round 46
// Round:   46
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Particles=800..3000, Radius=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a fresh burst is ice cyan and shades through blue and violet to magenta as its particles bounce, most of the way by 120 bounces, over discs with grey-blue rims and inside a pale gold ring; at 0.25 the cloud runs from violet to orange, at 0.5 from red through yellow to green and at 0.75 from lime to blue.
// Knob 2: Speed. Particles fly 15 LEDs a second for each unit: 30 at 2, where each bounces about 10 times a second at the opening radius and a burst fills the view in 8 to 9 s; 3 LEDs a second at 0.2, a burst lasting about 85 s, and 45 at 3, about 5.5 s.
// Knob 3: Particles. How many leave each burst: 800 at the start, 1350 at a quarter, 1900 at half, 2450 at three quarters and 3000 at the end, the pockets lit denser and brighter the more there are. Turned during a burst it copies particles already in flight or drops some, so the cloud keeps its shape.
// Knob 4: Radius. The discs' radius on a lattice of spacing 1, which is 12 LEDs: 0.47 at 0, 0.455 at the opening 0.06, 0.4075 at a quarter, 0.345 at half, 0.2825 at three quarters and 0.22 at 1. Above sqrt(3)/4 = 0.433, which is the knob at 0.148, every straight line meets a disc, the cloud seeps from pocket to pocket through gaps 0.7 to 1.6 LEDs wide and its mean square displacement grows in step with time; a burst lasts 10 to 12 s at 0, 8 to 9 s at 0.06 and about 6 s at the threshold. Past it corridors open between the rows of discs, up the panel and at 60 degrees to it, 2.1 LEDs wide at half and 5.1 at 1, particles shoot along them in streaks that stick out of the cloud, and the spread grows faster than time (as t log t): a burst lasts 2.4 s at half and 1.6 s at 1.
// Buttons: K1 tap starts a new burst from another spot between the discs while the old cloud fades out over 1.2 s. A burst also starts by itself once the ring passes 30 LEDs.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, sqrt, exp, cos, sin, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The lattice: spacing 1 in its own units, D LEDs on the panel. Its rows run
// up the panel, so the corridors that open below the threshold run the
// panel's long way and at 60 degrees to it. A lattice point sits at
// (i + j/2, j*SQ); the lattice X axis is the panel's y.
const D = 12, SQ = sqrt(3) / 2, CX = 32, CY = 64;
// Disc radius from knob 4: 0.47 at 0, 0.455 at the opening 0.06, 0.22 at
// 1. Discs touch at 0.5. The horizon is finite exactly when the discs block
// every row corridor: rows are SQ apart, so a corridor SQ - 2r wide is open
// below r = sqrt(3)/4, the knob at 0.148. Below r = 1/4 a second family
// opens, between rows of the lattice's 30-degree direction, half apart.
const rOf = (k) => 0.47 - 0.25 * k;
// Flight per second for each unit of Speed, in lattice units.
const RATE = 1.25;
// The longest straight piece looked at in one go. With r + STEP under SQ,
// only the four corners of the lattice cell a particle is in can be hit.
const STEP = 0.3;
// A burst ends when its ring passes this many lattice units (30 LEDs).
const RMAX = 2.5;
const NMAX = 3000, FADE = 1.2;
// Hue of a fresh particle at knob 0: ice cyan, shading to violet and
// magenta as the bounces add up.
const HUE0 = 0.5, SHIFT = 0.38, NB = 60;
// A particle's light fades as it moves on, over TRAIL LEDs of its path
// whatever the speed, so a flight down a corridor shows as a streak.
const TRAIL = 3, VLED = RATE * D;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function makeSet() {
  return {
    n: 0, live: false, fade: 1, ox: 0, oy: 0, s: 0, msd: 0,
    X: new Float64Array(NMAX), Y: new Float64Array(NMAX), VX: new Float64Array(NMAX), VY: new Float64Array(NMAX),
    PX: new Float64Array(NMAX), PY: new Float64Array(NMAX), B: new Uint16Array(NMAX),
  };
}

export function setup(params) {
  params.s = {
    begun: false, hue: -1, speed: 2, count: 800, r: -1, rmax: RMAX, keep: 0,
    sets: [makeSet(), makeSet()], cur: 0,
    bg: new Float32Array(N * 3), acc: new Float32Array(N * 3), lit: new Float32Array(N * 3), lut: new Float32Array(256 * 3), ring: new Float32Array(3),
    bgKey: "",
  };
}

// The centre of the disc nearest (x, y), into NC. A point in the lattice
// cell with corners (fa, fb)..(fa+1, fb+1) is never nearer another point.
const NC = [0, 0, 0];
function nearest(x, y) {
  const b = y / SQ, a = x - 0.5 * b, fa = floor(a), fb = floor(b);
  let best = 1e9;
  for (let j = fb; j <= fb + 1; j++)
    for (let i = fa; i <= fa + 1; i++) {
      const cx = i + 0.5 * j, cy = j * SQ, d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 < best) (best = d2), (NC[0] = cx), (NC[1] = cy);
    }
  NC[2] = best;
}

// Flies particle i of set P a distance L, bouncing off every disc it meets
// on the way: the exact first crossing of the ray with each of the four
// discs it can reach, the mirror reflection there, and on with what is left.
function fly(P, i, L, r) {
  let x = P.X[i], y = P.Y[i], vx = P.VX[i], vy = P.VY[i], rem = L, hits = 0;
  const r2 = r * r;
  for (let guard = 0; rem > 1e-12 && guard < 64; guard++) {
    const seg = min(rem, STEP);
    const b = y / SQ, a = x - 0.5 * b, fa = floor(a), fb = floor(b);
    let tb = seg, hx = 0, hy = 0, hit = false;
    for (let j = fb; j <= fb + 1; j++)
      for (let k = fa; k <= fa + 1; k++) {
        const cx = k + 0.5 * j, cy = j * SQ, dx = x - cx, dy = y - cy;
        const bd = dx * vx + dy * vy;
        // Moving away from this disc, or along its tangent: no hit.
        if (bd >= 0) continue;
        const q = bd * bd - (dx * dx + dy * dy - r2);
        if (q <= 0) continue;
        let t = -bd - sqrt(q);
        if (t < 0) t = 0;
        if (t < tb) (tb = t), (hx = cx), (hy = cy), (hit = true);
      }
    x += vx * tb;
    y += vy * tb;
    rem -= tb;
    if (hit) {
      // The normal at the hit point; the particle is set back onto the rim
      // a hair outside it, so rounding never leaves it in the disc.
      let nx = x - hx, ny = y - hy;
      const l = sqrt(nx * nx + ny * ny);
      nx /= l;
      ny /= l;
      const dn = vx * nx + vy * ny;
      vx -= 2 * dn * nx;
      vy -= 2 * dn * ny;
      x = hx + nx * (r + 1e-9);
      y = hy + ny * (r + 1e-9);
      hits++;
    }
  }
  P.X[i] = x;
  P.Y[i] = y;
  P.VX[i] = vx;
  P.VY[i] = vy;
  P.B[i] = min(65535, P.B[i] + hits);
}

// A spot in the gaps, in the middle of the view and away from the last one.
function spot(S, last) {
  let bx = 0, by = 0, bd = -1;
  for (let k = 0; k < 40; k++) {
    const x = (Math.random() * 2 - 1) * 3.2, y = (Math.random() * 2 - 1) * 1.6;
    nearest(x, y);
    if (sqrt(NC[2]) < S.r + 0.04) continue;
    const d = last ? (x - last.ox) ** 2 + (y - last.oy) ** 2 : 1;
    if (d > bd) (bd = d), (bx = x), (by = y);
  }
  if (bd < 0) {
    // Every try fell in a disc (only possible with the largest discs): the
    // middle of a pocket is always free.
    bx = 0.5;
    by = SQ / 3;
  }
  return [bx, by];
}

function burst(S) {
  const old = S.sets[S.cur];
  S.cur ^= 1;
  const P = S.sets[S.cur];
  const [ox, oy] = spot(S, old.live ? old : null);
  if (old.live) old.fade = 1 - 1e-6;
  P.live = true;
  P.fade = 1;
  P.ox = ox;
  P.oy = oy;
  P.s = 0;
  P.msd = 0;
  P.n = S.count;
  // Headings evenly round the circle, so the first ring is a true circle
  // until it meets the discs.
  const a0 = Math.random() * TAU;
  for (let i = 0; i < P.n; i++) {
    const a = a0 + (TAU * (i + Math.random() * 0.5)) / P.n;
    P.X[i] = P.PX[i] = ox;
    P.Y[i] = P.PY[i] = oy;
    P.VX[i] = cos(a);
    P.VY[i] = sin(a);
    P.B[i] = 0;
  }
}

// A new radius can swallow particles: those it does are put back on the
// rim, turned outward if they were heading in.
function pushOut(S) {
  const r = S.r;
  for (const P of S.sets) {
    if (!P.live) continue;
    for (let i = 0; i < P.n; i++) {
      nearest(P.X[i], P.Y[i]);
      if (NC[2] >= r * r) continue;
      let nx = P.X[i] - NC[0], ny = P.Y[i] - NC[1];
      const l = sqrt(nx * nx + ny * ny);
      if (l < 1e-9) (nx = 1), (ny = 0);
      else (nx /= l), (ny /= l);
      P.X[i] = P.PX[i] = NC[0] + nx * (r + 1e-9);
      P.Y[i] = P.PY[i] = NC[1] + ny * (r + 1e-9);
      const dn = P.VX[i] * nx + P.VY[i] * ny;
      if (dn < 0) (P.VX[i] -= 2 * dn * nx), (P.VY[i] -= 2 * dn * ny);
    }
  }
}

// More particles: copies of particles already in flight, in new
// directions, so the cloud keeps its shape. Fewer: the last ones go.
function resize(S, n) {
  const P = S.sets[S.cur];
  if (P.live && n > P.n) {
    for (let i = P.n; i < n; i++) {
      const j = floor(Math.random() * P.n), a = Math.random() * TAU;
      P.X[i] = P.PX[i] = P.X[j];
      P.Y[i] = P.PY[i] = P.Y[j];
      P.VX[i] = cos(a);
      P.VY[i] = sin(a);
      P.B[i] = P.B[j];
    }
  }
  if (P.live) P.n = n;
  S.count = n;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 800, 0.06];
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const n = round(cl(kv[2], 800, NMAX)), r = rOf(cl(kv[3], 0, 1));
  if (r !== S.r) {
    S.r = r;
    pushOut(S);
  }
  if (n !== S.count) resize(S, n);
  if (!S.begun) {
    S.begun = true;
    burst(S);
  }
  if (input.btnPressed && input.btnPressed[0]) burst(S);
  const d = cl(dt || 0, 0, 0.1), L = d * RATE * S.speed;
  S.keep = exp(-(d * VLED * S.speed) / TRAIL);
  for (const P of S.sets) {
    if (!P.live) continue;
    if (P.fade < 1) {
      P.fade -= d / FADE;
      if (P.fade <= 0) {
        P.live = false;
        continue;
      }
    }
    let m = 0;
    for (let i = 0; i < P.n; i++) {
      P.PX[i] = P.X[i];
      P.PY[i] = P.Y[i];
      fly(P, i, L, S.r);
      const dx = P.X[i] - P.ox, dy = P.Y[i] - P.oy;
      m += dx * dx + dy * dy;
    }
    P.s += L;
    P.msd = m / P.n;
  }
  // The measured spread of the cloud, from where it started.
  if (sqrt(S.sets[S.cur].msd) > S.rmax) burst(S);
}

// The discs: a faint fill and a soft rim, laid down once for each radius.
function background(S) {
  const key = S.r + ":" + S.hue;
  if (key === S.bgKey) return;
  S.bgKey = key;
  const bg = S.bg, c = [0, 0, 0], e = [0, 0, 0];
  hsv(HUE0 + S.hue + 0.12, 0.6, 1, c, 0);
  hsv(HUE0 + S.hue + 0.08, 0.35, 1, e, 0);
  const R = S.r * D;
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      // Lattice X is the panel's y, lattice Y its x.
      nearest((py + 0.5 - CY) / D, (px + 0.5 - CX) / D);
      const dd = sqrt(NC[2]) * D - R;
      const fill = dd < 0 ? 0.035 + 0.02 * min(1, -dd / R) : 0;
      const rim = 0.17 * exp(-(dd * dd) / 0.45);
      const o = (py * W + px) * 3;
      for (let k = 0; k < 3; k++) bg[o + k] = c[k] * fill + e[k] * rim;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.begun) return;
  background(S);
  const { bg, acc, lut } = S;
  for (let o = 0; o < N * 3; o++) acc[o] *= S.keep;
  // Colour by bounce count: a fresh particle a pale cyan, then deeper and
  // further round the wheel, most of the way by 2 * NB bounces.
  for (let b = 0; b < 256; b++) {
    const u = 1 - exp(-b / NB);
    hsv(HUE0 + S.hue + SHIFT * u, 0.6 + 0.3 * min(1, b / 12), 1, lut, b * 3);
  }
  for (const P of S.sets) {
    if (!P.live) continue;
    const w = (P.fade < 1 ? P.fade * P.fade : 1) * (1 - S.keep) * 1.6;
    for (let i = 0; i < P.n; i++) {
      const c = min(255, P.B[i]) * 3;
      // The stretch of path flown since the last frame, in steps of half
      // an LED.
      const x1 = CX + P.Y[i] * D, y1 = CY + P.X[i] * D, x0 = CX + P.PY[i] * D, y0 = CY + P.PX[i] * D;
      const m = max(1, Math.ceil(2 * max(abs(x1 - x0), abs(y1 - y0)))), wk = w / m;
      for (let k = 1; k <= m; k++) {
        const x = floor(x0 + ((x1 - x0) * k) / m), y = floor(y0 + ((y1 - y0) * k) / m);
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const o = (y * W + x) * 3;
        acc[o] += lut[c] * wk;
        acc[o + 1] += lut[c + 1] * wk;
        acc[o + 2] += lut[c + 2] * wk;
      }
    }
  }
  // The ring: the root mean square distance from the burst's start.
  const P = S.sets[S.cur], rr = sqrt(P.msd) * D, ox = CX + P.oy * D, oy = CY + P.ox * D;
  const ring = S.ring, lit = S.lit;
  lit.fill(0);
  hsv(HUE0 + S.hue + 0.62, 0.3, 0.6, ring, 0);
  if (rr > 1.5) {
    const y0 = max(0, floor(oy - rr - 2)), y1 = min(H - 1, floor(oy + rr + 2));
    const x0 = max(0, floor(ox - rr - 2)), x1 = min(W - 1, floor(ox + rr + 2));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dd = abs(sqrt((x + 0.5 - ox) ** 2 + (y + 0.5 - oy) ** 2) - rr);
        if (dd >= 1) continue;
        const o = (y * W + x) * 3, a = 1 - dd;
        for (let k = 0; k < 3; k++) lit[o + k] = ring[k] * a;
      }
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const r = bg[o] + lit[o] + 1 - exp(-acc[o]), g = bg[o + 1] + lit[o + 1] + 1 - exp(-acc[o + 1]), b = bg[o + 2] + lit[o + 2] + 1 - exp(-acc[o + 2]);
    if (r + g + b < 0.008) continue;
    // Each channel in steps of 4 of 255, too fine to see, and a frame packs
    // smaller for it.
    display.setPixel(p % W, (p / W) | 0, min(255, round(r * 63.75) * 4), min(255, round(g * 63.75) * 4), min(255, round(b * 63.75) * 4));
  }
}
