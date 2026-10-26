// ===== Patternflow pattern =====
// Title:   Galperin Billiard
// Family:  physics
// Idea:    A heavy block slides down a rail onto a light one above a wall at the bottom, and every collision, block on block or light block on wall, lights one dot of a tally that groups itself in tens, hundreds and thousands, so with masses 100^k apart it reads 3, 31, 314 or 3141; above it the two velocities, scaled by the square roots of the masses, are a point on the energy circle that zigzags from the circle's left end to its right, one chord per collision, sweeping the disc until it lands in the wedge of angle arctan(sqrt(m/M)) where no collision is left.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gregory Galperin, Playing pool with π (2003), pattern round 57
// Round:   57
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Digits=0..3, Warp=0..8
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the heavy block is violet and the light one cyan, the swept disc runs violet through blue to green from left to right, and the tally is cyan, its thousands at k = 3 cyan, violet, green and rose; at 0.5 the heavy block is green, the light one pink and the disc runs green through rose to violet. The wheel skips orange to lime, and the unswept disc stays slate blue.
// Knob 2: Speed. 2 is real time away from the burst, the heavy block coming down at 60 rows a second; 0.2 is ten times slower and 3 half as fast again. At 2, with Warp at its opening 0.06, the blocks meet 1.4 to 1.7 seconds into a run, the heavy block is off the top about 4 seconds in, and the tally holds 1.8 seconds before the next run.
// Knob 3: Digits. k from 0 to 3: M = 100^k m, so 1, 100, 10,000 or 1,000,000 times the light block, and the collisions number 3, 31, 314 and 3141, the count of steps of theta = arctan(sqrt(m/M)), 45, 5.71, 0.573 or 0.0573 degrees, that fit below pi. The heavy block is 4 + 6k rows tall. The tally's dots are 15, 4, 1 and 1 LEDs wide at a pitch of 16, 5, 2 and 1. At k = 3 the middle 90% of the collisions fall within 3.4 ms and the closest two are 0.27 microseconds apart.
// Knob 4: Warp. Seconds of slow motion added to the burst at Speed 2, from 0 to 8, shared evenly so each collision gets Warp / n of them: at the opening 0.06 the burst runs at nearly real time and the middle 90% of k = 3's collisions pass within two frames; at 8 they come 393 a second, and k = 1's 31 come four a second.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, exp, atan, atan2, cos, sin, round, PI, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The rail: the wall's top edge is row 125's top; z counts rows up from it.
// The light block starts Z1 rows up: at 16 the last collision of k = 2,
// the latest of the four, still happens on the panel, the heavy block 98
// rows up.
const FLOOR = 125, V0 = 60, HL = 4, Z1 = 16;
const HOLD = 1.8, FADE = 0.6;
// The energy circle and the tally beside the rail.
const CX = 37.5, CY = 25.5, R = 24, TX = 13, TB = 124;
// The tally's thousands at k = 3, as hues at knob 0 (they go through the
// wheel below): cyan, violet, green, rose.
const BAND = [0.5, 0.75, 0.36, 0.92];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}
// The knob turns hues on a wheel that skips orange through yellow to lime,
// which read brown and olive when dim. Hues here are given as they look at
// knob 0, from 0.28 round to 1.02.
const tone = (h, k) => 0.28 + 0.74 * (((h - 0.28) / 0.74 + k) % 1);

// The collisions, event by event and in closed form: the blocks move at
// constant speed between events, so each next event time is a gap divided
// by a closing speed. Velocities are positive up, away from the wall. The
// light block (mass m) sits at z1, HL rows tall; the heavy one (mass M =
// 100^k m) has its lower face at z2. Block on block, momentum and energy
// give v' = ((m - M) v + 2 M V) / (m + M) and V' = ((M - m) V + 2 m v) /
// (m + M), here with r = m / M; at the wall v' = -v. It stops when the
// light block moves up no faster than the heavy one: 0 <= v <= V.
function collide(k, hh) {
  const r = 1 / 100 ** k;
  let v = 0, V = -V0, z1 = Z1, z2 = FLOOR - hh, t = 0;
  const T = [0], A = [z1], B = [z2], VL = [v], VH = [V], kind = [0];
  for (let guard = 0; guard < 400000; guard++) {
    const tb = V < v ? max(0, z2 - z1 - HL) / (v - V) : Infinity;
    const tw = v < 0 ? max(0, z1) / -v : Infinity;
    if (tb === Infinity && tw === Infinity) break;
    if (tb <= tw) {
      t += tb;
      z1 += v * tb;
      z2 = z1 + HL;
      const nv = ((r - 1) * v + 2 * V) / (1 + r), nV = ((1 - r) * V + 2 * r * v) / (1 + r);
      v = nv;
      V = nV;
      kind.push(1);
    } else {
      t += tw;
      z1 = 0;
      z2 += V * tw;
      v = -v;
      kind.push(2);
    }
    T.push(t), A.push(z1), B.push(z2), VL.push(v), VH.push(V);
  }
  return { T, A, B, VL, VH, kind, n: T.length - 1, r };
}

// The slow motion. Display time s = tau + b N(tau), where N climbs by one
// across each collision, linearly between the midpoints of the gaps around
// it, and b = Warp / n. Far from the burst s runs with tau; inside it each
// collision gets b seconds however close the next one is. Both directions
// are exact on the piecewise linear knots.
function warp(E, b) {
  const T = E.T, n = E.n, m = new Float64Array(n + 1), sk = new Float64Array(n + 1);
  m[0] = T[1] - (T[2] - T[1]) / 2;
  for (let j = 1; j < n; j++) m[j] = (T[j] + T[j + 1]) / 2;
  m[n] = T[n] + (T[n] - T[n - 1]) / 2;
  for (let j = 0; j <= n; j++) sk[j] = m[j] + b * j;
  E.m = m;
  E.sk = sk;
  E.b = b;
}
function tauOf(E, s) {
  const { m, sk, n } = E;
  if (s <= sk[0]) return s;
  if (s >= sk[n]) return s - E.b * n;
  let lo = 0, hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sk[mid] <= s) lo = mid;
    else hi = mid;
  }
  const span = sk[lo + 1] - sk[lo];
  return span > 0 ? m[lo] + ((s - sk[lo]) * (m[lo + 1] - m[lo])) / span : m[lo];
}
function sOf(E, tau) {
  const { m, n } = E;
  if (tau <= m[0]) return tau;
  if (tau >= m[n]) return tau + E.b * n;
  let lo = 0, hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (m[mid] <= tau) lo = mid;
    else hi = mid;
  }
  const span = m[lo + 1] - m[lo];
  return tau + E.b * (lo + (span > 0 ? (tau - m[lo]) / span : 0));
}
// Collisions done by time tau.
function doneBy(E, tau) {
  let lo = 0, hi = E.n + 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (E.T[mid] <= tau) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Where collision i's dot sits in the tally: hundreds are squares of ten
// rows of ten, filled from the bottom; squares run five to a row at pitch 1
// and two at pitch 2 (k = 0 and 1 never fill one), and at pitch 1 each two
// rows of squares, a thousand, stand apart from the next by a row.
function tallyAt(k, i) {
  const p = [16, 5, 2, 1][k], side = 10 * p + (p > 1 ? p : 0), per = max(1, floor((W - TX + (p > 1 ? p : 0)) / side));
  const q = floor(i / 100), rr = i % 100, sr = floor(q / per), sc = q % per;
  const x = TX + sc * side + (rr % 10) * p;
  const y = TB - sr * 10 * p - (p === 1 ? floor(sr / 2) : sr * p) - floor(rr / 10) * p;
  return [x, y, p > 1 ? p - 1 : 1];
}

export function setup(params) {
  params.s = { k: -1, warpS: -1, s: 0, phase: 0, pt: 0, hue: 0, rgb: new Float32Array(W * H * 3), E: null, c: [0, 0, 0], c2: [0, 0, 0] };
}

// The run ends once the heavy block is off the top and the last collision
// half a second gone.
const endOf = (E) => max(sOf(E, E.T[E.n] + (H + 4 - E.B[E.n]) / max(1, E.VH[E.n])), E.sAt[E.n] + 0.5);

function start(S, k, wsec) {
  S.k = k;
  S.hh = HL + 6 * k;
  S.E = collide(k, S.hh);
  S.warpS = wsec;
  warp(S.E, wsec / S.E.n);
  const E = S.E;
  // Points on the energy circle: (sqrt(M) V, sqrt(m) v) / (sqrt(M) V0).
  const q = sqrt(E.r);
  E.px = E.VH.map((V) => V / V0);
  E.py = E.VL.map((v) => (q * v) / V0);
  E.theta = atan(q);
  E.sAt = E.T.map((t) => sOf(E, t));
  E.sEnd = endOf(E);
  S.s = 0;
  S.phase = 0;
  S.pt = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3), k = round(cl(kv[2], 0, 3)), wsec = cl(kv[3], 0, 8);
  if (k !== S.k) start(S, k, wsec);
  else if (abs(wsec - S.warpS) > 1e-3) {
    // A new warp keeps the moment on screen where it is.
    const E = S.E, tau = tauOf(E, S.s);
    S.warpS = wsec;
    warp(E, wsec / E.n);
    E.sAt = E.T.map((t) => sOf(E, t));
    E.sEnd = endOf(E);
    S.s = sOf(E, tau);
  }
  const g = (d * speed) / 2;
  if (S.phase === 0) {
    S.s += g;
    if (S.s >= S.E.sEnd + HOLD) (S.phase = 1), (S.pt = 0);
  } else {
    S.pt += g;
    if (S.pt >= FADE) start(S, k, wsec);
  }
}

// A point laid over its four nearest LEDs by how close it falls.
function splat(rgb, x, y, c, a) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy;
  for (let dy = 0; dy < 2; dy++) {
    const yy = iy + dy;
    if (yy < 0 || yy >= H) continue;
    const wy = dy ? ty : 1 - ty;
    for (let dx = 0; dx < 2; dx++) {
      const xx = ix + dx;
      if (xx < 0 || xx >= W) continue;
      const w = (dx ? tx : 1 - tx) * wy * a, o = (yy * W + xx) * 3;
      rgb[o] = max(rgb[o], c[0] * w);
      rgb[o + 1] = max(rgb[o + 1], c[1] * w);
      rgb[o + 2] = max(rgb[o + 2], c[2] * w);
    }
  }
}
function line(rgb, x0, y0, x1, y1, c, a) {
  const len = hypot(x1 - x0, y1 - y0), m = max(1, ceil(len * 2));
  for (let e = 0; e <= m; e++) splat(rgb, x0 + ((x1 - x0) * e) / m, y0 + ((y1 - y0) * e) / m, c, a * 1.6);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.E) return;
  const E = S.E, rgb = S.rgb, th = E.theta, hue = S.hue, c = S.c, c2 = S.c2;
  const s = min(S.s, E.sEnd + HOLD), tau = tauOf(E, s), done = doneBy(E, tau);
  const fade = S.phase === 1 ? 1 - S.pt / FADE : min(1, s / 0.3);
  rgb.fill(0);
  const add = (x, y, col, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    rgb[o] += col[0] * a;
    rgb[o + 1] += col[1] * a;
    rgb[o + 2] += col[2] * a;
  };
  const since = (j) => s - E.sAt[j];

  // The energy circle. Inside it, the part the chords have swept: the
  // polygon of every point so far, which is the disc on the start's side
  // of the latest chord, less the thin caps outside each chord joining two
  // points on the same side.
  const cx = E.px, cy = E.py, T2 = floor(done / 2), B2 = ceil(done / 2);
  const ti = 2 * T2, bi = done > 0 ? 2 * B2 - 1 : 0;
  const ex = cx[bi] - cx[ti], ey = cy[bi] - cy[ti];
  const ref = ex * (cy[0] - cy[ti]) - ey * (cx[0] - cx[ti]);
  const cth = cos(th);
  // The unswept disc and the rim stay slate blue whatever the hue: dim
  // and turned to red they read brown.
  const disc = [0.45, 0.6, 1];
  const swept = c2;
  for (let y = floor(CY - R - 1); y <= ceil(CY + R + 1); y++)
    for (let x = floor(CX - R - 1); x <= ceil(CX + R + 1); x++) {
      const ux = (x + 0.5 - CX) / R, uy = (CY - y - 0.5) / R, rr = hypot(ux, uy);
      if (rr > 1 + 1.5 / R) continue;
      // The rim, a pixel and a half wide.
      const rim = cl(1 - abs(rr - 1) * R / 0.9, 0, 1);
      if (rim > 0) add(x, y, disc, 0.4 * rim);
      if (rr >= 1) continue;
      let a = 0.09;
      if (done >= 2 && (ex * (uy - cy[ti]) - ey * (ux - cx[ti])) * ref > 0) {
        const phi = atan2(uy, ux);
        let ok = true;
        if (phi >= 0) {
          const j = floor((PI - phi) / (2 * th));
          if (j < T2) ok = ux * cos(PI - th * (2 * j + 1)) + uy * sin(PI - th * (2 * j + 1)) <= cth;
        } else {
          const j = floor((phi + PI) / (2 * th));
          if (j < B2) ok = ux * cos(-PI + th * (2 * j + 1)) + uy * sin(-PI + th * (2 * j + 1)) <= cth;
        }
        if (ok) a = 0.55;
      }
      if (a > 0.1) hsv(tone(0.76 - 0.2 * (ux + 1), hue), 0.7, 1, swept);
      add(x, y, a > 0.1 ? swept : disc, a);
    }
  // The wedge 0 <= angle <= theta, where v <= V and no collision is left.
  const goal = [1, 0.95, 0.8];
  line(rgb, CX, CY, CX + R, CY, goal, 0.35);
  line(rgb, CX, CY, CX + R * cos(th), CY - R * sin(th), goal, 0.35);
  // The chords: every one so far, faint (the last 400 at k = 3, the older
  // ones lie under the swept disc), and the newest bright.
  const chord = [0.85, 0.95, 1], keep = [0.6, 0.45, 0.16, 0.12][S.k];
  for (let j = max(1, done - 400); j <= done; j++) {
    const age = since(j), a = keep + 0.7 * exp(-age / 0.25);
    line(rgb, CX + R * cx[j - 1], CY - R * cy[j - 1], CX + R * cx[j], CY - R * cy[j], chord, min(1, a));
  }
  // The state point.
  const sx = CX + R * cx[done], sy = CY - R * cy[done];
  for (const [dx, dy] of [[0, 0], [-0.7, 0], [0.7, 0], [0, -0.7], [0, 0.7]]) splat(rgb, sx + dx, sy + dy, [1, 1, 1], 1);

  // The tally, one dot per collision; the newest flash white.
  for (let i = 0; i < done; i++) {
    const [x, y, w] = tallyAt(S.k, i), q = floor(i / 100);
    const band = S.k === 3 ? BAND[floor(i / 1000)] : BAND[0];
    hsv(tone(band, hue), 0.75, q % 2 ? 0.62 : 0.9, c);
    const f = 0.9 * exp(-since(i + 1) / 0.3);
    for (let e = 0; e < 3; e++) c2[e] = c[e] + (1 - c[e]) * f;
    for (let yy = 0; yy < w; yy++) for (let xx = 0; xx < w; xx++) add(x + xx, y - yy, c2, 1);
  }

  // The rail, the wall and the blocks.
  const rail = hsv(tone(0.62, hue), 0.35, 1, [0, 0, 0]);
  for (let y = 0; y < FLOOR; y++) add(5, y, rail, 0.16);
  // The last wall hit and the last block hit, for a flash.
  let lastW = -1, lastB = -1;
  for (let j = done; j >= 1 && (lastW < 0 || lastB < 0) && j > done - 3; j--) {
    if (E.kind[j] === 2 && lastW < 0) lastW = j;
    if (E.kind[j] === 1 && lastB < 0) lastB = j;
  }
  const wf = lastW > 0 ? exp(-since(lastW) / 0.15) : 0;
  const wall = hsv(tone(0.3, hue), 0.25, 1, [0, 0, 0]);
  for (let y = FLOOR; y < H; y++) for (let x = 0; x < 11; x++) add(x, y, wall, 0.55 + 0.45 * wf);
  const at = (j0, z0, v0) => z0 + v0 * (tau - E.T[j0]);
  const z1 = at(done, E.A[done], E.VL[done]), z2 = at(done, E.B[done], E.VH[done]);
  const light = hsv(tone(0.5, hue), 0.7, 1, [0, 0, 0]);
  const heavy = hsv(tone(0.78, hue), 0.7, 1, [0, 0, 0]);
  const block = (za, zb, x0, x1, col, a) => {
    const ya = FLOOR - zb, yb = FLOOR - za;
    for (let y = max(0, floor(ya)); y <= min(H - 1, floor(yb)); y++) {
      const cov = min(y + 1, yb) - max(y, ya);
      if (cov > 0) for (let x = x0; x <= x1; x++) add(x, y, col, a * cov);
    }
  };
  const bf = lastB > 0 ? exp(-since(lastB) / 0.15) : 0;
  block(z1, z1 + HL, 2, 8, light, 0.9);
  block(z2, z2 + S.hh, S.k ? 0 : 2, S.k ? 10 : 8, heavy, 0.85);
  // The face where they meet glows on each hit.
  if (bf > 0.02) block(z2 - 0.5, z2 + 0.5, S.k ? 0 : 2, S.k ? 10 : 8, [1, 1, 1], 0.8 * bf);

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3)
      display.setPixel(x, y, (255 * cl(rgb[o] * fade, 0, 1)) | 0, (255 * cl(rgb[o + 1] * fade, 0, 1)) | 0, (255 * cl(rgb[o + 2] * fade, 0, 1)) | 0);
}
