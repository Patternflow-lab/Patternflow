// ===== Patternflow pattern =====
// Title:   Three-Disk Scattering
// Family:  fractal
// Idea:    Three hard discs stand in the top half with a few points bouncing between them and leaving through the three gaps, and the bottom half maps every start from the top disc, one LED each, coloured by the gap it leaves through and lit by its bounces, zooming slowly towards a start on an orbit that bounces for ever, so the bands between colours split into thinner bands again and again while the points launched from that LED run round the orbit longer the deeper the zoom goes.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: chaotic scattering off three discs (Bruno Eckhardt, Fractal properties of scattering singularities, 1987; Pierre Gaspard and Stuart Rice, Scattering from a classically chaotic repellor, 1989), pattern round 78
// Round:   78
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Gap=0.4..4, Bounces=3..12
//
// Knob 1: Hue. Turns the three exit colours round the wheel together, a third apart. At 0 the gap at the bottom is gold, the one to the upper right teal and the one to the upper left violet; at 1/3 each colour moves on one gap. Starts still bouncing after 40 bounces are white.
// Knob 2: Speed. At 2 the zoom takes 20.4 s to go 4 decades deep and holds there, then fades back to the whole map and the next trapped start, 24 s in all, and the points fly 40 LEDs a second. At 0.2 it all runs ten times slower, at 3 one and a half times faster.
// Knob 3: Gap. The gap between neighbouring discs in disc radii, 0.4 to 4 in steps of 0.05, so the centres stand R = 2.4a to 6a apart. At 0.4 the discs nearly touch, most starts bounce several times and the map is mostly thin bands; at 4 most starts leave at once or after one bounce and the bands narrow to a few strips across broad fields.
// Knob 4: Bounces. How many bounces beyond the fewest on the map a start needs to reach full brightness, 3 at the opening up to 12. At 3 a start that bounced three times more than the quickest is at full brightness and one that bounced once more at two thirds; at 12 only the bands next to the trapped curves are bright, and the fields that leave at once stay at 42%.

// A point moves in straight lines and bounces off three hard discs of
// radius a whose centres stand R apart at the corners of a triangle. For
// R > 2a almost every start leaves through one of the three gaps, but a
// Cantor set of starts bounces for ever: the repeller of this open
// billiard. Eckhardt coded it by the order in which the discs are hit
// and found its dimension (1987); Gaspard and Rice took it as a model of
// a molecule breaking apart and computed its escape rate, dimension,
// entropy and Lyapunov exponent (1989).
//
// The bottom half maps the starts on disc 0, the top disc, in Birkhoff's
// coordinates, in which the billiard keeps area: s across, the angle
// round the disc from the point nearest the middle, -108 to 108 degrees,
// and p down, the sine of the angle between the ray and the disc's
// normal, -1 to 1. Each LED traces its ray up to 40 bounces and takes
// the colour of the gap its last direction faces and a brightness from
// its bounces. The starts that never leave lie on curves; beside each
// curve lie bands that leave after more and more bounces, and inside
// each band the same again. The zoom heads 4 decades deep towards a
// start on a periodic orbit: the triangle orbit through the three points
// nearest the middle (s = 0, p = 1/2 or -1/2), or the to and fro between
// disc 0 and one of the others (s = 30 or -30 degrees, p = 0). Near the
// to and fro the bands repeat each time the zoom gains the orbit's
// stretch per bounce, (g + 1) + sqrt((g + 1)^2 - 1) for a gap of g
// radii: 2.38 at the opening gap of 0.4, 9.9 at R = 6a, the ratio most
// papers on the three discs use.
//
// The map is rebuilt at the current zoom a few rows a frame, as many as
// 6000 bounces of work allow, and shown resampled from the last finished
// one meanwhile. The points in the top half start from the LED the zoom
// heads to, at a random spot inside it, so the deeper the zoom the longer
// they run round the orbit before they leave.

const W = 64, H = 128, MY = 64, MS = 64, MAXB = 40, BUDGET = 6000, DEPTH = 4, ZOOM = 20.4, REST = 3.6, SM = 0.6 * Math.PI;
// Trapped starts on disc 0: the orbit round the triangle both ways, and
// the orbit to and fro between disc 0 and each of the others.
const TG = [[0, 0.5], [Math.PI / 6, 0], [0, -0.5], [-Math.PI / 6, 0]];
const { floor, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const HUE0 = 0.14;

function hsv(h, s, v, o, i0) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[i0] = round((i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255);
  o[i0 + 1] = round((i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255);
  o[i0 + 2] = round((i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255);
}

// Disc k sits at angle 90 + 120 k degrees, d = R / sqrt 3 from the middle;
// exit k is the gap opposite disc k, which faces the direction U_k.
function geometry(S, gap) {
  const R = gap + 2, d = R / sqrt(3);
  S.gap = gap;
  S.d = d;
  S.C = [];
  S.U = [];
  for (let k = 0; k < 3; k++) {
    const a = PI / 2 + (k * TAU) / 3;
    S.C.push(d * cos(a), d * sin(a));
    S.U.push(-cos(a), -sin(a));
  }
  // The billiard half frames the three discs: 62 LEDs across them.
  S.scale = 62 / (sqrt(3) * d + 2);
  S.oy = 32 + (d / 4) * S.scale;
}

// Where a ray leaving disc 0 goes: exit * 64 + bounces, or 3 * 64 + MAXB
// if it is still bouncing after MAXB. A ray that hits no disc has left,
// through the gap whose direction is nearest its own.
function trace(S, px, py, vx, vy) {
  const C = S.C, U = S.U;
  let last = 0;
  for (let n = 0; n < MAXB; n++) {
    let tb = 1e9, kb = -1;
    for (let k = 0; k < 3; k++) {
      if (k === last) continue;
      const ox = px - C[2 * k], oy = py - C[2 * k + 1], b = ox * vx + oy * vy;
      if (b >= 0) continue;
      const disc = b * b - (ox * ox + oy * oy - 1);
      if (disc <= 0) continue;
      const t = -b - sqrt(disc);
      if (t < tb) {
        tb = t;
        kb = k;
      }
    }
    if (kb < 0) {
      const e0 = U[0] * vx + U[1] * vy, e1 = U[2] * vx + U[3] * vy, e2 = U[4] * vx + U[5] * vy;
      return (e0 >= e1 && e0 >= e2 ? 0 : e1 >= e2 ? 1 : 2) * 64 + n;
    }
    px += vx * tb;
    py += vy * tb;
    const nx = px - C[2 * kb], ny = py - C[2 * kb + 1], dn = 2 * (vx * nx + vy * ny);
    vx -= dn * nx;
    vy -= dn * ny;
    last = kb;
  }
  return 3 * 64 + MAXB;
}

// A start (s, p) on disc 0: s the angle round the disc from the point
// nearest the middle, counterclockwise, p the sine of the angle between
// the ray and the disc's outward normal there.
function ray(S, s, p, o) {
  const a = -PI / 2 + s, nx = cos(a), ny = sin(a), c = sqrt(max(0, 1 - p * p));
  o[0] = S.C[0] + nx;
  o[1] = S.C[1] + ny;
  o[2] = nx * c - ny * p;
  o[3] = nx * p + ny * c;
  return o;
}
const RAY = [0, 0, 0, 0];
const start = (S, s, p) => {
  const r = ray(S, s, p, RAY);
  return trace(S, r[0], r[1], r[2], r[3]);
};

function newMap() {
  return { v: new Uint8Array(MS * MS), view: [0, 0, 1, 1], row: 0, nmin: 0 };
}

function computeRow(S, M, j) {
  const [cb, cp, hb, hp] = M.view, ph = cp + hp * ((j + 0.5) / (MS / 2) - 1);
  let cost = 0;
  for (let i = 0; i < MS; i++) {
    const r = start(S, cb + hb * ((i + 0.5) / (MS / 2) - 1), ph);
    M.v[j * MS + i] = r;
    cost += (r & 63) + 1;
  }
  return cost;
}

function finish(M) {
  let n = MAXB;
  for (let i = 0; i < M.v.length; i++) n = min(n, M.v[i] & 63);
  M.nmin = n;
}

function view(S) {
  const z = Math.pow(10, -S.z), [tb, tp] = TG[S.ti % TG.length];
  return [tb * (1 - z), tp * (1 - z), SM * z, z];
}

export function setup(params) {
  params.s = {
    hue: 0, rate: 1, gap: -1, bref: 3, z: 0, zt: 0, ti: 0, fade: 0,
    full: newMap(), shown: newMap(), build: newMap(), parts: [],
    trail: new Float32Array(W * MY * 3), bg: new Float32Array(W * MY), gm: new Uint8Array(W * MY),
    pal: new Uint8Array(4 * 64 * 3), gc: new Uint8Array(9),
  };
  for (let i = 0; i < 4; i++) params.s.parts.push({ on: false, wait: 0.3 + i * 0.6 });
  return params.s;
}

// The discs, with the arc of disc 0 the map starts from drawn brighter, a
// dashed line across each gap and a mark where each exit leaves the frame,
// drawn once per geometry. gm holds which exit a LED marks.
function backdrop(S) {
  const { bg, gm, C, scale, oy } = S;
  bg.fill(0);
  gm.fill(0);
  for (let y = 0; y < MY; y++)
    for (let x = 0; x < W; x++) {
      const wx = (x + 0.5 - 32) / scale, wy = (oy - y - 0.5) / scale, p = y * W + x;
      for (let k = 0; k < 3; k++) {
        const dx = wx - C[2 * k], dy = wy - C[2 * k + 1], r = Math.hypot(dx, dy) * scale, e = 1 - abs(r - scale);
        if (r < scale) bg[p] = max(bg[p], 0.16);
        // The arc |s| < SM of disc 0, s measured from straight down.
        const lit = k === 0 && abs(Math.atan2(dx, -dy)) < SM ? 1 : 0.55;
        if (e > 0) bg[p] = max(bg[p], lit * e);
      }
    }
  for (let k = 0; k < 3; k++) {
    const i = (k + 1) % 3, j = (k + 2) % 3, ax = C[2 * i], ay = C[2 * i + 1], bx = C[2 * j], by = C[2 * j + 1];
    const L = Math.hypot(bx - ax, by - ay), steps = floor(L * scale * 2);
    for (let s = 0; s <= steps; s++) {
      const u = s / steps, along = u * L;
      if (along < 1.25 || along > L - 1.25) continue;
      const x = floor(32 + (ax + (bx - ax) * u) * scale), y = floor(oy - (ay + (by - ay) * u) * scale);
      if (x >= 0 && x < W && y >= 0 && y < MY && floor((along * scale) / 2) % 2 === 0) gm[y * W + x] = k + 1;
    }
    // Out from the middle of the gap in its direction to the frame.
    let x = 32 + ((ax + bx) / 2) * scale, y = oy - ((ay + by) / 2) * scale;
    while (x >= 0 && x < W && y >= 0 && y < MY) {
      x += S.U[2 * k] * 0.5;
      y -= S.U[2 * k + 1] * 0.5;
    }
    // A bar 2 LEDs deep and 7 long along the edge it reaches.
    const side = x < 0 || x >= W;
    x = cl(floor(x), 0, W - 1);
    y = cl(floor(y), 0, MY - 1);
    for (let a = -3; a <= 3; a++)
      for (let b = 0; b < 2; b++) {
        const tx = side ? (x === 0 ? b : W - 1 - b) : x + a, ty = side ? y + a : MY - 1 - b;
        if (tx >= 0 && tx < W && ty >= 0 && ty < MY) gm[ty * W + tx] = 4 + k;
      }
  }
}

function launch(S, P) {
  // From the LED of the map the zoom is heading to: a random start
  // inside it.
  const [cb, cp, hb, hp] = view(S), [tb, tp] = TG[S.ti % TG.length];
  const fx = floor(((tb - cb) / hb + 1) * (MS / 2)), fy = floor(((tp - cp) / hp + 1) * (MS / 2));
  const s = cb + hb * ((fx + Math.random()) / (MS / 2) - 1), p = cp + hp * ((fy + Math.random()) / (MS / 2) - 1);
  const r = ray(S, s, p, RAY);
  P.x = r[0];
  P.y = r[1];
  P.vx = r[2];
  P.vy = r[3];
  P.last = 0;
  P.g = (start(S, s, p) >> 6) % 3;
  P.on = true;
}

// Moves a point dist along its path, splatting each piece into the trail.
function fly(S, P, dist) {
  const C = S.C;
  while (dist > 1e-9) {
    let tb = dist, kb = -1;
    for (let k = 0; k < 3; k++) {
      if (k === P.last) continue;
      const ox = P.x - C[2 * k], oy = P.y - C[2 * k + 1], b = ox * P.vx + oy * P.vy;
      if (b >= 0) continue;
      const disc = b * b - (ox * ox + oy * oy - 1);
      if (disc <= 0) continue;
      const t = -b - sqrt(disc);
      if (t < tb) {
        tb = t;
        kb = k;
      }
    }
    const nx0 = P.x + P.vx * tb, ny0 = P.y + P.vy * tb;
    line(S, P.x, P.y, nx0, ny0, P.g);
    P.x = nx0;
    P.y = ny0;
    dist -= tb;
    if (kb >= 0) {
      const nx = P.x - C[2 * kb], ny = P.y - C[2 * kb + 1], dn = 2 * (P.vx * nx + P.vy * ny);
      P.vx -= dn * nx;
      P.vy -= dn * ny;
      P.last = kb;
    }
  }
}

function line(S, ax, ay, bx, by, g) {
  const sc = S.scale, oy = S.oy, x0 = 32 + ax * sc, y0 = oy - ay * sc, x1 = 32 + bx * sc, y1 = oy - by * sc;
  const n = max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let s = 1; s <= n; s++) {
    const x = x0 + ((x1 - x0) * s) / n - 0.5, y = y0 + ((y1 - y0) * s) / n - 0.5, ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
      const px = ix + dx, py = iy + dy;
      if (px < 0 || px >= W || py < 0 || py >= MY) continue;
      const p = (py * W + px) * 3 + g;
      if (w > S.trail[p]) S.trail[p] = w;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.rate = cl(k[1] == null ? 2 : k[1], 0.2, 3) / 2;
  S.bref = cl(k[3] == null ? 3 : k[3], 3, 12);
  const gap = round(cl(k[2] == null ? 0.4 : k[2], 0.4, 4) * 20) / 20;
  if (gap !== S.gap) {
    geometry(S, gap);
    backdrop(S);
    const F = S.full;
    F.view = [0, 0, SM, 1];
    for (let j = 0; j < MS; j++) computeRow(S, F, j);
    finish(F);
    S.shown.v.set(F.v);
    S.shown.view = F.view.slice();
    S.shown.nmin = F.nmin;
    S.build.row = 0;
    S.build.view = view(S);
    for (const P of S.parts) P.on = false;
  }
  // The zoom: DEPTH decades in towards a trapped start over ZOOM seconds,
  // a hold, then a fade back to the whole map and the next trapped start.
  S.zt += d * S.rate;
  if (S.zt >= ZOOM + REST) {
    S.zt -= ZOOM + REST;
    S.ti++;
  }
  const u = cl(S.zt / ZOOM, 0, 1);
  S.z = DEPTH * u * u * (3 - 2 * u);
  S.fade = min(1, S.zt / 0.4, (ZOOM + REST - S.zt) / 0.6);
  // Build the map at the current view a few rows a frame.
  const B = S.build;
  if (B.row === 0) B.view = view(S);
  let cost = 0;
  while (B.row < MS && cost < BUDGET) cost += computeRow(S, B, B.row++);
  if (B.row >= MS) {
    finish(B);
    const t = S.shown;
    S.shown = B;
    S.build = t;
    S.build.row = 0;
  }
  // The points.
  const tr = S.trail, decay = exp(-d * S.rate * 1.6);
  for (let i = 0; i < tr.length; i++) tr[i] *= decay;
  for (const P of S.parts) {
    if (!P.on) {
      P.wait -= d * S.rate;
      if (P.wait <= 0) launch(S, P);
      continue;
    }
    fly(S, P, (d * S.rate * 40) / S.scale);
    const qx = 32 + P.x * S.scale, qy = S.oy - P.y * S.scale;
    if (qx < -2 || qx > W + 2 || qy < -2 || qy > MY + 2) {
      P.on = false;
      P.wait = 0.3 + Math.random() * 0.5;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.gap < 0) return;
  const { pal, gc, trail, bg, gm } = S;
  for (let g = 0; g < 3; g++) {
    hsv(HUE0 + S.hue + g / 3, 1, 1, gc, g * 3);
    for (let n = 0; n <= MAXB; n++) {
      const u = min(1, n / S.bref);
      hsv(HUE0 + S.hue + g / 3, 0.92 - 0.3 * (n / MAXB), 0.42 + 0.58 * Math.pow(u, 0.8), pal, (g * 64 + n) * 3);
    }
  }
  for (let n = 0; n <= MAXB; n++) {
    const q = (3 * 64 + n) * 3;
    pal[q] = pal[q + 1] = pal[q + 2] = 255;
  }
  // The billiard.
  for (let y = 0; y < MY; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, b = bg[p] * 200;
      let r = b, g = b, bl = b;
      if (gm[p]) {
        const c = ((gm[p] - 1) % 3) * 3, f = gm[p] > 3 ? 0.9 : 0.45;
        r = max(r, gc[c] * f);
        g = max(g, gc[c + 1] * f);
        bl = max(bl, gc[c + 2] * f);
      }
      for (let k = 0; k < 3; k++) {
        const t = trail[p * 3 + k];
        if (t > 0.02) {
          r = max(r, gc[k * 3] * t);
          g = max(g, gc[k * 3 + 1] * t);
          bl = max(bl, gc[k * 3 + 2] * t);
        }
      }
      display.setPixel(x, y, round(r), round(g), round(bl));
    }
  // The heads, white.
  for (const P of S.parts) {
    if (!P.on) continue;
    const x = floor(32 + P.x * S.scale), y = floor(S.oy - P.y * S.scale);
    if (x >= 0 && x < W && y >= 0 && y < MY) display.setPixel(x, y, 255, 255, 255);
  }
  // The map, sampled from the last finished build at the current view.
  const V = view(S), M = S.shown, F = S.full, [cb, cp, hb, hp] = M.view;
  for (let j = 0; j < MS; j++) {
    const ph = V[1] + V[3] * ((j + 0.5) / (MS / 2) - 1);
    for (let i = 0; i < MS; i++) {
      const b = V[0] + V[2] * ((i + 0.5) / (MS / 2) - 1);
      const si = floor(((b - cb) / hb + 1) * (MS / 2)), sj = floor(((ph - cp) / hp + 1) * (MS / 2));
      let v;
      if (si >= 0 && si < MS && sj >= 0 && sj < MS) v = M.v[sj * MS + si];
      else {
        const fi = cl(floor((b / SM + 1) * (MS / 2)), 0, MS - 1), fj = cl(floor((ph + 1) * (MS / 2)), 0, MS - 1);
        v = F.v[fj * MS + fi];
      }
      const g = v >> 6, n = g === 3 ? MAXB : max(0, (v & 63) - M.nmin), q = (g * 64 + n) * 3, f = S.fade;
      display.setPixel(i, MY + j, round(pal[q] * f), round(pal[q + 1] * f), round(pal[q + 2] * f));
    }
  }
  // Ticks round the LED the zoom is heading to.
  const [tb, tp] = TG[S.ti % TG.length], tx = floor(((tb - V[0]) / V[2] + 1) * (MS / 2)), ty = MY + floor(((tp - V[1]) / V[3] + 1) * (MS / 2));
  for (const [dx, dy] of [[-3, 0], [-4, 0], [3, 0], [4, 0], [0, -3], [0, -4], [0, 3], [0, 4]]) {
    const x = tx + dx, y = ty + dy;
    if (x >= 0 && x < W && y >= MY && y < H) display.setPixel(x, y, 255, 255, 255);
  }
}
