// ===== Patternflow pattern =====
// Title:   Brachistochrone
// Family:  physics
// Idea:    Beads let go together from a point at the top left slide without friction down five tracks to a point on the right, a straight line, Galileo's circle, a parabola, a deep drop to the bottom of the panel and the cycloid, while the curve of all the points a bead could have reached by now spreads from the start down the whole panel and leaves rings behind; the cycloid's bead rides that front all the way and arrives first on a track longer than the line, the tracks light up in the order their beads come in, and every second race six beads let go from different heights on the cycloid all reach its bottom at once.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the brachistochrone problem (Johann Bernoulli, 1696), solved by the cycloid, and the tautochrone (Christiaan Huygens, 1673), pattern round 39
// Round:   39
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Gravity=0.2..3, End=0..1, Tracks=5..13
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the cycloid gold, Galileo's circle violet, the parabola green, the line cyan, the deep drop rose, and the front and its rings pale blue. From 0.33 to 0.68, where the front would turn red, orange, yellow or lime, it is paled and lifted so it reads cream, never brown.
// Knob 2: Gravity. At 2 g is 31 LEDs a second squared: the cycloid's bead takes 2.4 s, the line's 2.84 s and the deep drop's 4.27 s, then the finish holds 1.3 s and fades in 0.6 s. Every time goes as one over the square root of g, so at 0.2 the race takes 3.2 times as long and at 3 it is 1.22 times as fast.
// Knob 3: End. Where the end point sits on the right edge. At 0 at row 39, the bottom of the cycloid's arch, where the cycloid wins by 1.2% over the circle, 4.3% over the parabola and 18.5% over the line. Turned up the end point rises to row 13 and the cycloid dips 10 rows below it and climbs back, now 37.6% ahead of the circle and 74% ahead of the line; the beads of the second race pass the bottom of the arch together and those let go below the end swing back and meet there again.
// Knob 4: Tracks. How many tracks race. At 5 the cycloid and its four classic rivals; each step adds another smooth track from the start to the end, eight more at 13, some starting shallow and some dipping below the end. None of them beats the cycloid.

const W = 64, H = 128, N = W * H;
// The start point A, and the column the end point B sits in.
const AX = 3, AY = 3, BX = 60, DX = BX - AX;
// B's depth below A: at End 0 the bottom of the arch, 2/pi of the width; at
// End 1 ten rows. The deep drop always falls to row 124.
const BY0 = (2 * DX) / Math.PI, BY1 = 10, YDEEP = 121;
// g at Gravity 2, in LEDs a second squared: the cycloid's race at End 0 then
// takes 2.4 s.
const G2 = 31.1;
// Points in each track's table, and the seconds of the hold, the fade, the
// wait at the start and the light trail behind a bead.
const M = 640, HOLD = 1.3, FADE = 0.6, WAIT = 0.5, TRAIL = 0.28;
// Rings of the front left behind every sixth of the cycloid's time.
const RINGS = 6;
// Track colours, hue and saturation: the cycloid, Galileo's circle, the
// parabola, the line, the deep drop, then the extra tracks.
const COL = [[0.13, 0.62], [0.79, 0.55], [0.35, 0.6], [0.5, 0.6], [0.96, 0.55]];
// Extra tracks: the angle they leave A at, degrees from straight down; the
// angle they come into B at, degrees below level (negative: coming up); and
// the lengths of their two handles as shares of the chord.
const EXTRA = [[62, 12, 0.45, 0.3], [14, -35, 0.55, 0.45], [38, 38, 0.4, 0.4], [4, 2, 0.85, 0.3], [74, 55, 0.5, 0.35], [24, -55, 0.8, 0.5], [50, -12, 0.5, 0.35], [9, 22, 0.6, 0.3]];
const EXH = [0.06, 0.24, 0.43, 0.56, 0.68, 0.88, 0.17, 0.74];
const { floor, min, max, abs, sqrt, exp, sin, cos, acos, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, q, p, p, t, v][i], [t, v, v, q, p, p][i], [p, p, t, v, v, q][i]];
}

// The cycloid from A through a point bx across and by down: the angle the
// rolling circle has turned at that point, and its radius a.
function cycloidTo(bx, by) {
  const r = bx / by;
  let lo = 1e-9, hi = 2 * PI - 1e-9;
  for (let i = 0; i < 56; i++) {
    const m = (lo + hi) / 2, s = sin(m / 2);
    if ((m - sin(m)) / (2 * s * s) < r) lo = m;
    else hi = m;
  }
  const th = (lo + hi) / 2, s = sin(th / 2);
  return [th, by / (2 * s * s)];
}

// A track from a curve f(u), u from 0 at A to 1 at B, sampled densely at both
// ends. Times are in units where g = 1: each chord is taken at constant
// slope, so the bead's time on it is exactly its length over the mean of the
// speeds sqrt(2y) at its two ends, and the sum is the time of the polyline.
function track(f, hue, sat) {
  const x = new Float32Array(M), y = new Float32Array(M), t = new Float64Array(M);
  let px = 0, py = 0;
  for (let i = 0; i < M; i++) {
    const u = 0.5 - 0.5 * cos((PI * i) / (M - 1)), p = f(u);
    x[i] = p[0];
    y[i] = max(0, p[1]);
    if (i) t[i] = t[i - 1] + (Math.hypot(x[i] - px, y[i] - py) * Math.SQRT2) / (sqrt(py) + sqrt(y[i]) || 1);
    px = x[i];
    py = y[i];
  }
  return { x, y, t, T: t[M - 1], hue, sat, pix: null, wt: null, at: -1 };
}

function bezier(P) {
  return (u) => {
    const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    return [a * P[0] + b * P[2] + c * P[4] + d * P[6], a * P[1] + b * P[3] + c * P[5] + d * P[7]];
  };
}

// Lay a track into the panel as a thin core and a soft halo, kept as a list
// of the pixels it touches.
function rasterize(S, k) {
  const R = S.tmp;
  R.fill(0);
  const { x, y } = k;
  for (let i = 1; i < M; i++) {
    const x0 = x[i - 1] + AX, y0 = y[i - 1] + AY, len = Math.hypot(x[i] + AX - x0, y[i] + AY - y0), n = Math.ceil(len / 0.4);
    for (let j = 0; j < n; j++) {
      const f = (j + 0.5) / n, px = x0 + (x[i] + AX - x0) * f, py = y0 + (y[i] + AY - y0) * f, w = len / n;
      const ix = round(px), iy = round(py);
      for (let b = -2; b <= 2; b++) {
        const yy = iy + b;
        if (yy < 0 || yy >= H) continue;
        for (let a = -2; a <= 2; a++) {
          const xx = ix + a;
          if (xx < 0 || xx >= W) continue;
          const d2 = (xx - px) ** 2 + (yy - py) ** 2;
          R[yy * W + xx] += w * (0.75 * exp(-d2 / 0.5) + 0.07 * exp(-d2 / 5));
        }
      }
    }
  }
  const pix = [], wt = [];
  for (let p = 0; p < N; p++)
    if (R[p] > 0.01) {
      pix.push(p);
      wt.push(min(1.2, R[p]));
    }
  k.pix = Int32Array.from(pix);
  k.wt = Float32Array.from(wt);
}

// Every track for the end point's place, and the cycloid's numbers.
function build(S) {
  const bx = DX, by = BY0 * (BY1 / BY0) ** S.end;
  const [th, a] = cycloidTo(bx, by);
  S.by = by;
  S.th = th;
  S.a = a;
  const tr = [];
  // The cycloid, the curve a point on a rolling circle draws.
  tr.push(track((u) => [a * (th * u - sin(th * u)), 2 * a * sin((th * u) / 2) ** 2], ...COL[0]));
  // Galileo's circle: the arc down to B whose lowest point is B.
  const R = (bx * bx + by * by) / (2 * by), cy = by - R, a0 = Math.atan2(-cy, -bx);
  tr.push(track((u) => [bx + R * cos(a0 + (PI / 2 - a0) * u), cy + R * sin(a0 + (PI / 2 - a0) * u)], ...COL[1]));
  // The parabola whose lowest point is B.
  tr.push(track((u) => [bx * u, by * (1 - (1 - u) ** 2)], ...COL[2]));
  // The straight line, the shortest way.
  tr.push(track((u) => [bx * u, by * u], ...COL[3]));
  // The deep drop: straight down the left side to row 124, along the bottom
  // and up into B. D is found so that its lowest point is there.
  let lo = by, hi = 4 * YDEEP;
  for (let i = 0; i < 30; i++) {
    const D = (lo + hi) / 2;
    let m = 0;
    for (let j = 1; j < 64; j++) {
      const u = j / 64;
      m = max(m, 3 * u * (1 - u) * D + u * u * u * by);
    }
    if (m < YDEEP) lo = D;
    else hi = D;
  }
  tr.push(track(bezier([0, 0, 0, lo, bx, lo, bx, by]), ...COL[4]));
  const C = Math.hypot(bx, by);
  for (let j = 0; j < S.ntr - 5; j++) {
    const [p, q, h1, h2] = EXTRA[j], pa = (p * PI) / 180, qa = (q * PI) / 180;
    tr.push(track(bezier([0, 0, h1 * C * sin(pa), h1 * C * cos(pa), bx - h2 * C * cos(qa), by - h2 * C * sin(qa), bx, by]), EXH[j], 0.5));
  }
  for (const k of tr) rasterize(S, k);
  // Keep the arrivals already seen in this race.
  if (S.tracks) for (let i = 0; i < tr.length && i < S.tracks.length; i++) if (S.tracks[i].at >= 0 && S.tau >= tr[i].T) tr[i].at = S.tracks[i].at;
  S.tracks = tr;
  S.tauB = th * sqrt(a);
}

// Where the field of least times is: the time of the cycloid from A through
// each pixel, the fastest way there, and the bead's speed there. The front at
// time t is the curve these times equal t on, and all of it moves at the speed
// a bead would have there, so its distance in LEDs is the time to go times
// that speed.
function field(S) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, dy = y - AY, dx = abs(x - AX);
      if (dy < 0 || (dy === 0 && dx === 0)) {
        S.tau0[p] = dy < 0 ? 1e9 : 0;
        S.q[p] = 0;
        continue;
      }
      if (dy === 0) S.tau0[p] = 2 * PI * sqrt(dx / (2 * PI));
      else {
        const [th, a] = cycloidTo(dx, dy);
        S.tau0[p] = th * sqrt(a);
      }
      S.q[p] = sqrt(2 * dy);
    }
}

export function setup(params) {
  params.s = {
    hue: 0, g: G2, end: -1, ntr: 0, tracks: null, mode: 0, phase: 0, clock: 0, tau: 0, fade: 1, t: 0, meet: [],
    tau0: new Float32Array(N), q: new Float32Array(N), tmp: new Float32Array(N),
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N),
  };
  field(params.s);
}

// The tautochrone: from rest at arc length s0 above the bottom of the arch, a
// bead's arc length is s0 cos(t sqrt(g / 4a)), whatever s0 is.
function tautoBeads(S) {
  const a = S.a, out = [];
  for (let j = 0; j < 6; j++) out.push(4 * a * (1 - j / 6));
  return out;
}
function onCycloid(S, s) {
  const th = 2 * acos(cl(s / (4 * S.a), -1, 1));
  return [S.a * (th - sin(th)), S.a * (1 - cos(th)), th];
}

// The race's last moment, in g = 1 time.
function raceEnd(S) {
  if (S.mode === 0) {
    let m = 0;
    for (const k of S.tracks) m = max(m, k.T);
    return m;
  }
  const bot = PI * sqrt(S.a);
  return S.th <= PI + 1e-6 ? S.tauB : 3 * bot;
}

function at(k, tau) {
  const t = k.t;
  if (tau >= k.T) return [k.x[M - 1], k.y[M - 1]];
  if (tau <= 0) return [0, 0];
  let lo = 0, hi = M - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (t[m] <= tau) lo = m;
    else hi = m;
  }
  const f = (tau - t[lo]) / (t[hi] - t[lo] || 1);
  return [k.x[lo] + (k.x[hi] - k.x[lo]) * f, k.y[lo] + (k.y[hi] - k.y[lo]) * f];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 5], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.g = G2 * (cl(k[1], 0.2, 3) / 2);
  const end = cl(k[2], 0, 1), ntr = round(cl(k[3], 5, 13));
  if (abs(end - S.end) > 0.002 || ntr !== S.ntr) {
    S.end = end;
    S.ntr = ntr;
    build(S);
  }
  const sg = sqrt(S.g);
  S.t += d;
  S.clock += d;
  if (S.phase === 0 && S.clock >= WAIT) {
    S.phase = 1;
    S.tau = 0;
  } else if (S.phase >= 1) {
    const before = S.tau;
    S.tau += d * sg;
    if (S.mode === 0)
      for (const tk of S.tracks)
        // The arrival, placed inside the frame where it fell.
        if (tk.at < 0 && S.tau >= tk.T) tk.at = S.t - (S.tau - tk.T) / sg;
    if (S.mode === 1 && S.th >= PI - 1e-6) {
      const bot = PI * sqrt(S.a);
      for (const m of [bot, 3 * bot]) if (before < m && S.tau >= m) S.meet.push(S.t - (S.tau - m) / sg);
    }
    if (S.phase === 1 && S.tau >= raceEnd(S)) {
      S.phase = 2;
      S.clock = 0;
    } else if (S.phase === 2 && S.clock >= HOLD) {
      S.phase = 3;
      S.clock = 0;
    } else if (S.phase === 3) {
      S.fade = 1 - S.clock / FADE;
      if (S.clock >= FADE) {
        S.phase = 0;
        S.clock = 0;
        S.fade = 1;
        S.tau = 0;
        S.mode ^= 1;
        S.meet = [];
        for (const tk of S.tracks) tk.at = -1;
      }
    }
  }
}

// A soft dot of light into the colour buffers.
function dot(S, x, y, r, w, c) {
  const xi = round(x + AX), yi = round(y + AY), k = -1 / (r * r);
  for (let j = yi - 2; j <= yi + 2; j++) {
    if (j < 0 || j >= H) continue;
    for (let i = xi - 2; i <= xi + 2; i++) {
      if (i < 0 || i >= W) continue;
      const e = w * exp(((i - x - AX) ** 2 + (j - y - AY) ** 2) * k), p = j * W + i;
      S.R[p] += e * c[0];
      S.G[p] += e * c[1];
      S.B[p] += e * c[2];
    }
  }
}

function ring(S, x, y, age, c) {
  const r = 1.5 + 16 * age, w = 0.8 * exp(-age / 0.22), n = round(6 * r + 8);
  if (w < 0.03) return;
  for (let j = 0; j < n; j++) {
    const a = (2 * PI * j) / n;
    dot(S, x + r * cos(a), y + r * sin(a), 0.7, w, c);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.tracks) return;
  const { R, G, B, tau0, q } = S;
  const fade = S.phase === 3 ? S.fade : 1, live = S.phase >= 1, tau = live ? S.tau : 0, sg = sqrt(S.g);
  // The front, the light it leaves behind and its rings, pale blue.
  const fh = 0.6 + S.hue, dh = abs(fh - floor(fh) - 0.11), warm = cl(1.9 - min(dh, 1 - dh) / 0.09, 0, 1);
  // Orange and yellow go brown this faint: there the front is paled and lifted.
  const fc = hsv(fh, 0.5 - 0.3 * warm, 1 + 0.4 * warm), rk = S.tauB / RINGS;
  const nring = live ? floor(tau / rk) : 0;
  for (let p = 0; p < N; p++) {
    let v = 0;
    if (live && q[p] > 0) {
      const dd = (tau0[p] - tau) * q[p];
      if (dd < 2.5) {
        if (dd > -2.5) v += 0.55 * exp(-dd * dd);
        if (dd < 0) v += 0.09 + 0.16 * exp(dd / 7);
        for (let r = 1; r <= nring; r++) {
          const e = (tau0[p] - r * rk) * q[p];
          if (e > -2 && e < 2) v += 0.24 * exp(-e * e * 2);
        }
      }
    }
    v *= fade;
    R[p] = v * fc[0];
    G[p] = v * fc[1];
    B[p] = v * fc[2];
  }
  // The tracks, faint, each lit up when its bead arrives and staying lit.
  const tc = [];
  for (const k of S.tracks) {
    const c = hsv(k.hue + S.hue, k.sat, 1);
    tc.push(c);
    let f = 0.3;
    if (S.mode === 1 && k !== S.tracks[0]) f = 0.16;
    if (k.at >= 0) {
      const age = S.t - k.at;
      f += fade * (0.22 + 0.5 * exp(-age / 0.3));
    }
    for (let i = 0; i < k.pix.length; i++) {
      const p = k.pix[i], w = k.wt[i] * f;
      R[p] += w * c[0];
      G[p] += w * c[1];
      B[p] += w * c[2];
    }
  }
  const white = [1, 1, 1], bx = DX, by = S.by;
  if (live) {
    const dtr = (TRAIL * sg) / 12;
    if (S.mode === 0)
      S.tracks.forEach((k, i) => {
        const c = tc[i];
        if (k.at >= 0) {
          ring(S, bx, by, S.t - k.at, c);
          if (S.t - k.at > 0.15) return;
        }
        for (let j = 12; j >= 1; j--) {
          const p = at(k, tau - j * dtr);
          dot(S, p[0], p[1], 0.9, fade * 0.55 * (1 - j / 13), c);
        }
        const p = at(k, tau);
        dot(S, p[0], p[1], 0.8, fade * 1.1, c);
        dot(S, p[0], p[1], 0.55, fade * 0.9, white);
      });
    else {
      // The second race: beads from six heights on the cycloid, the one at A
      // the same bead as in the race.
      const c = tc[0], w = 1 / (2 * sqrt(S.a)), sB = 4 * S.a * cos(S.th / 2);
      for (const s0 of tautoBeads(S)) {
        // A bead let go above the end point's height leaves the track there.
        const tEnd = s0 >= abs(sB) - 1e-6 ? acos(cl(sB / s0, -1, 1)) / w : 1e9;
        if (tau > tEnd + 0.15 * sg) continue;
        for (let j = 12; j >= 0; j--) {
          const tt = min(max(0, tau - j * dtr), tEnd), p = onCycloid(S, s0 * cos(tt * w));
          if (j) dot(S, p[0], p[1], 0.9, fade * 0.55 * (1 - j / 13), c);
          else {
            dot(S, p[0], p[1], 0.8, fade * 1.1, c);
            dot(S, p[0], p[1], 0.55, fade * 0.9, white);
          }
        }
      }
      for (const m of S.meet) ring(S, PI * S.a, 2 * S.a, S.t - m, c);
    }
  }
  // A and B.
  dot(S, 0, 0, 0.9, 0.7, white);
  dot(S, bx, by, 0.9, 0.7, white);
  for (let p = 0; p < N; p++)
    display.setPixel(p % W, (p / W) | 0, round(255 * min(1, R[p])), round(255 * min(1, G[p])), round(255 * min(1, B[p])));
}
