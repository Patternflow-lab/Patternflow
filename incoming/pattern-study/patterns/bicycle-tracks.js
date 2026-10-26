// ===== Patternflow pattern =====
// Title:   Bicycle Tracks
// Family:  line
// Idea:    A front point weaves up the tall panel with a rear point a fixed wheelbase behind it that always rolls straight at it, so the rear track cuts inside every turn of the front track, and a comb of segments from the rear track forward to the front one, each one wheelbase long and tangent to the rear track, fills the lunes between them and shows which way the bicycle went; every 34 seconds or so the rider rides two laps of a circle, the rear spirals onto the smaller circle the bicycle's monodromy holds, and it leaves straight up along a tractrix.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the tractrix (Claude Perrault's question, 1670; Christiaan Huygens, 1692) as the track of a bicycle's rear wheel, the tangent rule of "Which Way Did the Bicycle Go?" (Joseph Konhauser, Dan Velleman and Stan Wagon, 1996), and bicycle monodromy as a Möbius map (Robert Foote, 1998; Mark Levi and Serge Tabachnikov, 2009), pattern round 57
// Round:   57
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wheelbase=16..24, Bar=50..70
//
// Knob 1: Hue. Turns both tracks round the wheel together. At 0 the front track is rose and the rear track cyan, with each tangent segment fading from cyan at its rear end to rose at its front end; at 0.25 the front is green and the rear blue, at 0.5 azure and magenta, at 0.75 violet and green. The wheel skips orange and yellow, which read brown and olive on the dim segments.
// Knob 2: Speed. The front point rides 13 LEDs a second times the knob: 26 at 2, where a weave of 37 to 50 rows passes in 2.2 to 3.7 seconds; 2.6 at 0.2 and 39 at 3. After 560 LEDs of weaving, 21.5 seconds at 2, the rider straightens up near one side and rides its loop, 10 to 15 seconds at 2.
// Knob 3: Wheelbase. The fixed distance L between the two points, 16 to 24 LEDs, and the length of every tangent segment. The loop's radius is 1.3 L + 1 up to 28: at 16 the front circles on 21.8 and the rear settles on 14.8, at 24 the front on 28 and the rear on 14.4. A lune is widest where the bar is held, at L tan(bar / 2): 7.5 LEDs at 16 and 11.2 at 24, with the bar at 50 degrees.
// Knob 4: Bar. The angle from the frame the rider holds the bar at through each turn, 50 to 70 degrees. While it is held the front runs on a circle of radius L / sin(bar) and the rear inside it on L / tan(bar), 1.31 L and 0.84 L at 50 degrees, 1.06 L and 0.36 L at 70. A weave (two turns) takes 45 rows at 50 degrees and 23 at 70, with L at 16 (medians over 400 seconds). The rear never rolls slower than cos 70 = 0.34 of the front's speed, so it never stops or backs up.

// The bicycle: F is the front point, R the rear, L = |F - R|. The rear
// wheel cannot slide sideways, so R always moves along the frame, towards F,
// at the speed of F's motion along the frame:
//   dR/ds = ((F - R) . T) (F - R) / L^2,
// with T the front's unit velocity and s its arc. That keeps |F - R| = L
// (the derivative of |D|^2 is 2 (D . T)(1 - |D|^2 / L^2)), so the segment
// from R to F is the tangent to the rear track and meets the front track
// exactly L ahead. Perrault asked in 1670 what curve a watch traces when
// its chain is pulled along a straight line; that curve, the tractrix, is
// this rear track when the front rides a straight line, and Huygens named it
// in 1692. Konhauser, Velleman and Wagon turned the tangent rule round: of
// two tracks, the one whose forward tangents always meet the other at the
// same distance is the rear one, so the tracks say which way the bicycle
// went. When the front rides a closed loop, where the rear ends up after a
// lap is a Möbius map of where it started (Foote, 1998). For a circle of
// radius r > L it has two fixed points; riding forward one attracts, the
// rear circling on radius sqrt(r^2 - L^2) with the frame tangent to it, and
// the rear comes in by a factor exp(-2 pi sqrt(r^2 - L^2) / L) each lap.
// Levi and Tabachnikov (2009) proved Menzin's conjecture of 1906, that the
// same happens on any convex loop holding more area than pi L^2.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, atan, atan2, ceil, hypot, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => a - TAU * round(a / TAU);
// Integration step and record spacing, in LEDs of the front's arc, and a
// tangent segment every COMB records.
const STEP = 0.2, SPACE = 0.5, COMB = 8, RING = 3000;
// While riding the rear sits L + TOP rows from the top, so the front is
// never above row TOP.
const TOP = 8;
// Arc before the opening, before the first loop, and between loops.
const PRE = 320, FIRST = 330, RIDE = 560;
// Loops: two laps and a bit of a circle of radius 1.3 L + 1, at least
// L + 4 and at most RMAX, kept MARGIN inside the panel's sides.
const LAPS = 2, RMAX = 28, MARGIN = 3;
// The rider weaves along a guide line that wanders across the panel, 140
// rows a wave and 15 LEDs either side: the bar is held at the knob's angle
// to one side until the frame has swung SWING radians past the line to the
// guide, then thrown to the other side over RELAX LEDs. SWING itself
// swells and fades by 35% once every 390 LEDs.
const G_AMP = 15, G_K = TAU / 140, SWING = 0.72, MOD_K = TAU / 390, RELAX = 3;
// Hues at knob 0 before the wheel below bends them: rose and cyan.
const HUE_F = 0.865, HUE_R = 0.297, GLOW = 1;
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const R = Math.random;
  params.s = {
    ready: false, hue: 0, v: 26, L: 16, Lk: 16, bar: 0.87, side: 1, run: 0,
    // Guide phases, and the phase of the swing's swell.
    g0: R() * TAU, g1: R() * TAU, mph: R() * TAU,
    // y: front x, front Y (up), the bar's angle from the frame, rear x, rear Y.
    y: new Float64Array(5), t: new Float64Array(5), k: [0, 1, 2, 3].map(() => new Float64Array(5)),
    arc: 0, next: 0, sig: 0,
    mode: 0, turn: 1, r: 0, cx: 0, cy: 0, b0: 0, len: 0, due: 1e9, wait: 0, fade: 0, edge: 32, blend: 0,
    hx: new Float64Array(RING), hy: new Float64Array(RING), gx: new Float64Array(RING), gy: new Float64Array(RING), n: 0,
    buf: new Float32Array(W * H * 3), glow: new Float32Array(W * H * 3), tmp2: new Float32Array(W * H * 3),
    cf: new Float32Array(3), cr: new Float32Array(3),
  };
}

const guide = (s, Y) => 32 + G_AMP * (0.7 * sin(G_K * Y + s.g0) + 0.3 * sin(1.73 * G_K * Y + s.g1));

// Derivatives along the front's arc. On a loop the front is a given circle
// and only the rear moves by the equation; riding, the front goes where the
// bar points, the bar follows the rider, and the rear by the same equation.
function deriv(s, y, ds, out) {
  const L = s.L;
  let tx, ty;
  if (s.mode === 1) {
    const b = s.b0 - (s.turn * (s.sig + ds)) / s.r;
    y[0] = s.cx + s.r * cos(b);
    y[1] = s.cy + s.r * sin(b);
    tx = s.turn * sin(b);
    ty = -s.turn * cos(b);
    out[0] = out[1] = out[2] = 0;
  } else if (s.mode === 2) {
    // Off a loop the front rides straight up while the rear swings in
    // behind it on a tractrix.
    tx = out[2] = out[0] = 0;
    ty = out[1] = 1;
  } else {
    const phi = atan2(y[0] - y[3], y[1] - y[4]), th = phi + y[2];
    tx = sin(th);
    ty = cos(th);
    // While a loop is due the rider stops weaving and steers by pure
    // pursuit for a line near the panel's edge, where the loop starts.
    const f = s.fade, ay = y[4] + 1.5 * L + 10, ax = (1 - f) * guide(s, ay) + f * s.edge;
    const a = wrap(atan2(ax - y[3], ay - y[4]) - phi);
    const nav = cl(atan((2 * L * sin(a)) / hypot(ax - y[3], ay - y[4])), -0.6, 0.6);
    const want = (1 - f) * s.side * s.bar + f * nav;
    out[0] = tx;
    out[1] = ty;
    out[2] = (want - y[2]) / RELAX;
  }
  const dx = y[0] - y[3], dy = y[1] - y[4], p = (dx * tx + dy * ty) / (L * L);
  out[3] = p * dx;
  out[4] = p * dy;
}

// One classical Runge-Kutta step of length h along the front's arc.
function rk4(s, h) {
  const y = s.y, t = s.t, [a, b, c, d] = s.k;
  deriv(s, y, 0, a);
  for (let i = 0; i < 5; i++) t[i] = y[i] + 0.5 * h * a[i];
  deriv(s, t, h / 2, b);
  for (let i = 0; i < 5; i++) t[i] = y[i] + 0.5 * h * b[i];
  deriv(s, t, h / 2, c);
  for (let i = 0; i < 5; i++) t[i] = y[i] + h * c[i];
  deriv(s, t, h, d);
  for (let i = 0; i < 5; i++) y[i] += (h / 6) * (a[i] + 2 * b[i] + 2 * c[i] + d[i]);
  // On a loop the front is placed on its circle exactly.
  if (s.mode === 1) (s.sig += h), deriv(s, y, 0, a);
  s.mph = wrap(s.mph + MOD_K * h);
  s.arc += h;
}

const loopR = (L) => min(RMAX, max(L + 4, 1.3 * L + 1));

// A loop starts on a circle through the front, tangent to it, that fits
// across the panel; it waits for one of radius loopR, easing by a LED for
// every 40 it waits, but never under L + 3.
function tryLoop(s) {
  const y = s.y, th = atan2(y[0] - y[3], y[1] - y[4]) + y[2], c = cos(th), x = y[0], lo = MARGIN, hi = W - MARGIN;
  // Turning right the centre is r to the right of the heading, at x + r c.
  const right = min((x - lo) / (1 - c + 1e-9), 1 + c > 1e-9 ? (hi - x) / (1 + c) : 1e9);
  const left = min(1 + c > 1e-9 ? (x - lo) / (1 + c) : 1e9, (hi - x) / (1 - c + 1e-9));
  const want = loopR(s.L), turn = right >= left ? 1 : -1, r = min(want, max(right, left));
  if (r < max(s.L + 3, want - s.wait / 40)) return;
  s.cx = x + turn * r * c;
  s.cy = y[1] - turn * r * sin(th);
  s.b0 = atan2(y[1] - s.cy, x - s.cx);
  s.turn = turn;
  s.r = r;
  s.sig = 0;
  // Whole laps and then on to where the front heads straight up, at the
  // circle's side.
  const extra = turn > 0 ? -th : th;
  s.len = r * (LAPS * TAU + extra - TAU * floor(extra / TAU));
  s.mode = 1;
}

// Ride arc more LEDs of the front's track, recording both points every
// SPACE LEDs.
function advance(s, arc) {
  const end = s.arc + arc, y = s.y;
  while (s.arc < end - 1e-9) {
    let h = min(STEP, end - s.arc, s.next - s.arc);
    if (s.mode === 1) h = min(h, s.len - s.sig);
    if (h > 1e-12) rk4(s, h);
    if (s.mode === 1) {
      if (s.sig >= s.len - 1e-9) (s.mode = 2), (s.run = 0);
    } else if (s.mode === 2) {
      // Straight on until the frame points within 0.2 radians of up; then
      // the bar takes over from there, so the track has no corner.
      const phi = atan2(y[0] - y[3], y[1] - y[4]);
      s.run += h;
      if (abs(phi) < 0.2 || s.run > 4 * s.L) (y[2] = -phi), (s.mode = 0), (s.due = RIDE), (s.wait = 0), (s.side = phi < 0 ? 1 : -1);
    } else {
      // The weave: throw the bar over once the frame has swung far enough
      // past the line to the guide, or the front comes within 6 LEDs of a
      // side of the panel.
      const phi = atan2(y[0] - y[3], y[1] - y[4]), ay = y[4] + 1.5 * s.L + 10;
      const a = wrap(atan2(guide(s, ay) - y[3], ay - y[4]) - phi), sw = SWING * (1 + 0.35 * sin(s.mph));
      if (s.side > 0 && (a < -sw || y[0] > W - 6)) s.side = -1;
      else if (s.side < 0 && (a > sw || y[0] < 6)) s.side = 1;
      if (s.due <= 0) {
        if (s.wait === 0) s.edge = y[0] < 32 ? 32 - loopR(s.L) + 1 : 32 + loopR(s.L) - 1;
        s.wait += h;
        s.fade = min(1, s.fade + h / 40);
        tryLoop(s);
      } else (s.due -= h), (s.fade = max(0, s.fade - h / 40));
    }
    if (s.arc >= s.next - 1e-9) {
      const i = s.n % RING;
      s.hx[i] = y[0];
      s.hy[i] = y[1];
      s.gx[i] = y[3];
      s.gy[i] = y[4];
      s.n++;
      s.next += SPACE;
    }
  }
}

function start(s) {
  const y = s.y;
  y[0] = y[3] = guide(s, 0);
  y[1] = s.L;
  y[2] = 0;
  y[4] = 0;
  s.arc = s.next = 0;
  s.due = 1e9;
  advance(s, PRE);
  s.due = FIRST;
  s.ready = true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kv = input.knobValues || [0, 2, 16, 50], d = cl(dt || 0, 0, 0.1), y = s.y;
  s.hue = cl(kv[0], 0, 1);
  s.v = 13 * cl(kv[1], 0.2, 3);
  s.bar = (cl(kv[3], 50, 70) * PI) / 180;
  // On a loop the wheelbase stays under the loop's radius until it ends.
  s.Lk = cl(kv[2], 16, 24);
  const L = s.mode === 1 ? min(s.Lk, s.r - 1) : s.Lk;
  if (L !== s.L) {
    // A new wheelbase: the rear slides along the frame to the new distance.
    const dx = y[3] - y[0], dy = y[4] - y[1], m = hypot(dx, dy) || 1;
    y[3] = y[0] + (dx * L) / m;
    y[4] = y[1] + (dy * L) / m;
    s.L = L;
  }
  if (!s.ready) start(s);
  advance(s, s.v * d);
  // The view eases onto a loop and back off it over 0.8 seconds.
  s.blend = cl(s.blend + (s.mode === 1 ? d : -d) / 0.8, 0, 1);
  // Keep the numbers small on a long run.
  if (y[4] > 1e5) {
    const k = 1e5, m = min(s.n, RING);
    y[1] -= k;
    y[4] -= k;
    s.cy -= k;
    s.g0 = wrap(s.g0 + G_K * k);
    s.g1 = wrap(s.g1 + 1.73 * G_K * k);
    for (let i = 0; i < m; i++) (s.hy[i] -= k), (s.gy[i] -= k);
  }
}

// A box blur of radius 2 along rows (step 1, n of them, len long, stride
// W) or columns (step W, n = W, len = H, stride 1), three channels.
function box(src, dst, step, len, n, stride) {
  for (let r = 0; r < n; r++)
    for (let e = 0; e < 3; e++) {
      const base = r * stride * 3 + e, st = step * 3;
      let acc = 0;
      for (let j = 0; j < 2 && j < len; j++) acc += src[base + j * st];
      for (let j = 0; j < len; j++) {
        if (j + 2 < len) acc += src[base + (j + 2) * st];
        if (j - 3 >= 0) acc -= src[base + (j - 3) * st];
        dst[base + j * st] = acc / 5;
      }
    }
}

// A round dot 2.8 LEDs across with a soft edge, kept by the brighter of
// what is there and what lands.
function dot(B, x, y, c, k) {
  const x0 = floor(x - 1.4), y0 = floor(y - 1.4);
  for (let yy = y0; yy <= y0 + 3; yy++) {
    if (yy < 0 || yy >= H) continue;
    for (let xx = x0; xx <= x0 + 3; xx++) {
      if (xx < 0 || xx >= W) continue;
      const u = xx + 0.5 - x, v = yy + 0.5 - y, w = k * cl(1.4 - sqrt(u * u + v * v), 0, 1);
      if (w <= 0) continue;
      const o = (yy * W + xx) * 3;
      for (let e = 0; e < 3; e++) if (c[e] * w > B[o + e]) B[o + e] = c[e] * w;
    }
  }
}

// A thin line from a to b, its colour fading from ca to cb, each sample
// laid over its four nearest LEDs.
function line(B, ax, ay, bx, by, ca, cb, k) {
  const m = ceil(hypot(bx - ax, by - ay) * 2) || 1;
  for (let j = 0; j <= m; j++) {
    const u = j / m, x = ax + (bx - ax) * u - 0.5, y = ay + (by - ay) * u - 0.5;
    const ix = floor(x), iy = floor(y), tx = x - ix, ty = y - iy;
    for (let dy = 0; dy < 2; dy++) {
      const yy = iy + dy;
      if (yy < 0 || yy >= H) continue;
      const wy = dy ? ty : 1 - ty;
      for (let dx = 0; dx < 2; dx++) {
        const xx = ix + dx;
        if (xx < 0 || xx >= W) continue;
        const w = min(1, (dx ? tx : 1 - tx) * wy * 2.6) * k, o = (yy * W + xx) * 3;
        for (let e = 0; e < 3; e++) {
          const v = (ca[e] + (cb[e] - ca[e]) * u) * w;
          if (v > B[o + e]) B[o + e] = v;
        }
      }
    }
  }
}

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.ready) return;
  const B = s.buf, G = s.glow, T = s.tmp2, cf = s.cf, cr = s.cr, y = s.y;
  B.fill(0);
  hsv(wheel(HUE_F + s.hue), 0.9, 1, cf, 0);
  hsv(wheel(HUE_R + s.hue), 0.94, 1, cr, 0);
  const e = s.blend * s.blend * (3 - 2 * s.blend);
  const cam = (1 - e) * (y[4] + s.L + TOP) + e * (s.cy + s.r + 6);
  const m = min(s.n, RING), first = s.n - m;
  // The two tracks, then a glow round them: the tracks blurred by two
  // passes of a 5-LED box each way and added at GLOW.
  for (let j = first; j < s.n; j++) {
    const i = j % RING, rb = cam - s.gy[i], rf = cam - s.hy[i];
    if (rb > -3 && rb < H + 3) dot(B, s.gx[i], rb, cr, 1);
    if (rf > -3 && rf < H + 3) dot(B, s.hx[i], rf, cf, 1);
  }
  box(B, T, 1, W, H, W);
  box(T, G, 1, W, H, W);
  box(G, T, W, H, W, 1);
  box(T, G, W, H, W, 1);
  for (let o = 0; o < W * H * 3; o++) B[o] += GLOW * G[o];
  // The comb over it: the frame every 4 LEDs of the ride, from the rear
  // point to the front point, one wheelbase long and tangent to the rear
  // track, fading from 0.7 near the top to 0.45 at the bottom.
  for (let j = first; j < s.n; j++) {
    if (j % COMB) continue;
    const i = j % RING, ra = cam - s.gy[i], fa = cam - s.hy[i];
    if ((ra < -2 && fa < -2) || (ra > H + 2 && fa > H + 2)) continue;
    line(B, s.gx[i], ra, s.hx[i], fa, cr, cf, 0.7 - 0.25 * cl((ra + fa) / (2 * H), 0, 1));
  }
  // On a loop, a dotted ring where the rear settles.
  if (e > 0.01 && s.r > s.L) {
    const rho = sqrt(s.r * s.r - s.L * s.L), n = floor((TAU * rho) / 3), wh = [0.8, 0.8, 0.85];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU;
      dot(B, s.cx + rho * cos(a), cam - (s.cy + rho * sin(a)), wh, 0.3 * e);
    }
  }
  // The frame now, white-cored, and the two points.
  const wf = [cf[0] * 0.5 + 0.5, cf[1] * 0.5 + 0.5, cf[2] * 0.5 + 0.5], wr = [cr[0] * 0.5 + 0.5, cr[1] * 0.5 + 0.5, cr[2] * 0.5 + 0.5];
  line(B, y[3], cam - y[4], y[0], cam - y[1], wr, wf, 0.9);
  dot(B, y[3], cam - y[4], wr, 1.2);
  dot(B, y[0], cam - y[1], wf, 1.2);
  for (let p = 0, o = 0; p < W * H; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, (B[o] * 255) | 0), min(255, (B[o + 1] * 255) | 0), min(255, (B[o + 2] * 255) | 0));
}
