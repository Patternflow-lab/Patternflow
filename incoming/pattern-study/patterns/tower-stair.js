// ===== Patternflow pattern =====
// Title:   Tower Stair
// Family:  halloween
// Idea:    A hooded climber carries a candle up the spiral stair of a round stone tower cut open to show its inside, the flame lighting the curved wall and throwing his huge shadow round it as he winds up past slit windows full of purple night, until a draft at the top blows the candle out and two green eyes look in at the window in the dark; then the candle is lit again at the foot of the stair.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 51
// Round:   51
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Turns=3..8, Reach=-1..1
//
// Knob 1: Hue. The moonlight on the stone and the night in the windows, through the cold colours: purple at 0, indigo at 0.3, blue at 0.6, green at 1. The flame stays orange and the eyes green.
// Knob 2: Speed. At 2 the climb from the foot to the top takes 10 seconds with 3 turns and 16 with 8, then the draft and the dark take 2.8 seconds before a match is struck at the foot again; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Turns. How many times the stair winds round in the panel's height, from 3 to 8, and the whole tower is rebuilt at once. At 3 a turn has 15 steps and the climber stands 21 LEDs tall; at 8 the stair is a tight coil of 7 steps a turn and he is 7 LEDs tall.
// Knob 4: Reach. How far the candle light carries before it falls to half: 14 LEDs at -1, a small warm pool round the climber; 29 at the opening 0.06; 56 at 1, so the wall across the well lights up and the shadow stands out on it.
// Buttons: K1 tap blows the candle out where it is.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sqrt, sin, cos, atan2, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (t) => ((t = cl(t, 0, 1)), t * t * (3 - 2 * t));
const wrap = (a) => a - TAU * floor((a + PI) / TAU);
const ang = (x, z) => {
  const a = atan2(x, z);
  return a < 0 ? a + TAU : a;
};
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The tower in LEDs: its axis at x = 32, the wall's inside radius, the
// treads' inner edge and the line the climber walks. The view looks down a
// little, so a point nearer by z sits K lower: screen y = YB - Y + K z.
// Angles a run from the front (z toward us) round to the right.
const RW = 30, RIN = 16, WALK = 23, K = 0.4, YB = 115;
// Surfaces: wall, tread top, riser, tread end, inner edge, floor, the cut wall.
const WALL = 1, TOP = 2, RISE = 3, END = 4, EDGE = 5, FLOOR = 6, CUT = 7;

export function setup(params) {
  params.s = {
    t: 0, turns: 0, hue: -1, speed: 2, reach: 29, phase: 0, u: 0.05, tp: 0, flare: 0.5, flick: 1,
    kind: new Uint8Array(N), pos: new Float32Array(N * 3), nrm: new Float32Array(N * 3), alb: new Float32Array(N), amb: new Float32Array(N),
    eh: new Float32Array(N), win: new Float32Array(N), buf: new Float32Array(N * 3), fz: new Float32Array(N), fl: new Float32Array(N), wins: [],
  };
}

// The tower for this many turns. The stair is a solid helix of steps: step
// j rises rise * j and a slab th thick sits under each tread. Every LED's
// first surface along its view line is found once, stepping back from the
// front, with its place, its facing, its stone and its share of moonlight.
function build(S) {
  const T = S.turns, pitch = 118 / T, st = cl(round(pitch / 2.6), 7, 16), rise = pitch / st, ds = TAU / st, th = rise + 1.5;
  Object.assign(S, { pitch, rise, th, ds });
  const { kind, pos, nrm, alb, amb, eh, win } = S;
  // Two slit windows a turn at the back, half way up the corridor.
  const wins = [];
  for (let n = 0; n <= T; n++)
    for (const f of [0.38, 0.62]) {
      const a = f * TAU, y = pitch * (n + f) + th + 0.45 * (pitch - th), hh = cl(0.15 * pitch, 3, 6.5), sy = YB - y + K * RW * cos(a);
      if (sy > hh + 3 && sy < H - 20) wins.push({ a, y, hh, sx: 32 + RW * sin(a), sy, n: 0 });
    }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const wx = x + 0.5 - 32, c = YB - (y + 0.5);
      let k = 0, Y = c, z = 0, nx = 0, ny = 0, nz = 1, e = 0, j = 0, aa = 0;
      win[p] = 0;
      if (abs(wx) >= RW) k = CUT;
      else {
        const zw = sqrt(RW * RW - wx * wx);
        let pj = -1, well = false;
        for (z = zw; z > -zw; z -= 0.25) {
          Y = c + K * z;
          if (Y < 0) {
            (z = -c / K), (Y = 0), (k = FLOOR), (nz = 0), (ny = 1);
            break;
          }
          const r2 = wx * wx + z * z;
          if (r2 < RIN * RIN) {
            (well = true), (pj = -1);
            continue;
          }
          aa = ang(wx, z);
          j = floor(aa / ds);
          const m = floor((Y - rise * j) / pitch), base = rise * j + pitch * m;
          if (m >= 0 && Y - base < th) {
            const r = sqrt(r2);
            if (z === zw) (k = END), (nx = wx / r), (ny = 0), (nz = z / r);
            else if (well) (k = EDGE), (nx = -wx / r), (ny = 0), (nz = -z / r);
            else if (pj >= 0 && pj !== j) (k = RISE), (nx = -cos(aa)), (ny = 0), (nz = sin(aa));
            else (k = TOP), (ny = 1), (nz = 0);
            e = Y - base - th;
            j += st * m;
            break;
          }
          (pj = j), (well = false);
        }
        if (!k) {
          (z = -zw), (Y = c + K * z), (k = WALL), (nx = -wx / RW), (ny = 0), (nz = zw / RW);
          aa = ang(wx, z);
          e = (((Y - rise * floor(aa / ds) - th) % pitch) + pitch) % pitch;
          for (let i = 0; i < wins.length; i++) {
            const w = wins[i], da = RW * wrap(aa - w.a), dy = Y - w.y;
            if (abs(dy) < w.hh + 2 && abs(da) < 3.6 - (0.4 * abs(dy)) / w.hh) win[p] = -1;
            if (abs(dy) < w.hh - (abs(da) > 1 ? 0.8 : 0) && abs(da) < 1.6) {
              // Where a sliver of moon would be: a crescent opening left.
              const my = abs(dy - 0.3 * w.hh), moon = (da > 0.5 && my < 1.6) || (da > -0.5 && da <= 0.5 && abs(my - 2) < 0.6);
              win[p] = 0.5 + 0.5 * cl((dy + w.hh) / (2 * w.hh), 0, 1) + (moon ? 10 : 0);
              // A slit LED is never lit, so it keeps its window's number here.
              w.n++;
              e = i;
            }
          }
        }
      }
      kind[p] = k;
      pos.set([wx, Y, z], 3 * p);
      nrm.set([nx, ny, nz], 3 * p);
      eh[p] = e;
      // Stone: wall courses 4 LEDs high with blocks 7 long, mortar darker;
      // each step its own stone; flags on the floor.
      let al = 1;
      if (k === WALL || k === CUT) {
        const s = k === CUT ? (wx > 0 ? 16 : 2) : RW * aa, row = floor(Y / 4), off = s + (row & 1) * 3.5, blk = floor(off / 7);
        al = Y - 4 * row < 0.9 || off - 7 * blk < 0.9 ? 0.62 : 0.85 + 0.3 * hash(row * 131 + blk);
      } else if (k === FLOOR) al = abs(wx % 8) < 0.7 || abs(z % 6) < 0.6 ? 0.6 : 0.9 + 0.2 * hash(floor(wx / 8) * 7 + floor(z / 6));
      else al = 0.85 + 0.3 * hash(j * 17 + 3) - (k === TOP && aa - ds * floor(aa / ds) > ds - 0.06 ? 0.25 : 0);
      alb[p] = al;
      // Moonlight: tread tops brightest and the steps in front more than
      // those behind, risers and the wall darker, a window's splay in shadow.
      const front = 0.75 + 0.25 * (z / RW);
      amb[p] = win[p] < 0 ? 0.5 : k === TOP ? 1.9 * front : k === END ? 1.3 : k === EDGE ? 1.15 : k === RISE ? 0.9 * front : k === FLOOR ? 0.9 : k === CUT ? 1.2 : 0.8;
    }
  // The windows the stair leaves in sight, highest first: the eyes come to
  // the top one, the moon shows in the next.
  const seen = wins.filter((w) => w.n > 5).sort((u, v) => v.y - u.y), moon = wins.indexOf(seen[1]);
  for (let p = 0; p < N; p++) if (win[p] >= 10) win[p] = eh[p] === moon ? 3 : win[p] - 10;
  S.wins = seen;
}

// Is the way from the candle to this point clear of the stair? The stair
// is solid, so on the candle's side of the well a point is lit only inside
// the candle's own turn of the corridor; across the well the light must
// also clear the treads at both ends of its path. e is the point's height
// above the tread under it.
function clear(S, C, px, pY, pz, e) {
  const dx = px - C[0], dz = pz - C[2], L2 = dx * dx + dz * dz || 1e-6, D = sqrt(L2), room = S.pitch - S.th;
  const b = -(C[0] * dx + C[2] * dz) / L2, t = cl(b, 0, 1), mx = C[0] + t * dx, mz = C[2] + t * dz;
  if (mx * mx + mz * mz >= RIN * RIN) {
    const f = pY - C[4] - (S.pitch * wrap(ang(px, pz) - C[3])) / TAU;
    return f > -0.7 && f < room + 0.3;
  }
  const s = (pY - C[1]) / D, cc = C[0] * C[0] + C[2] * C[2] - RIN * RIN, disc = sqrt(max(0, b * b - cc / L2));
  const h1 = C[1] - C[4] + s * (b - disc) * D, h2 = e - s * (1 - b - disc) * D;
  return h1 > 0 && h1 < room && h2 > -0.7 && h2 < room + 0.3;
}

// Shortest distance between segments PQ and AB, squared; segT keeps where
// along AB it falls, for a tapered capsule's radius there.
let segT = 0;
function segDist2(px, py, pz, qx, qy, qz, ax, ay, az, bx, by, bz) {
  const d1x = qx - px, d1y = qy - py, d1z = qz - pz, d2x = bx - ax, d2y = by - ay, d2z = bz - az, rx = px - ax, ry = py - ay, rz = pz - az;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z || 1e-6, f = d2x * rx + d2y * ry + d2z * rz;
  const c = d1x * rx + d1y * ry + d1z * rz, bd = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - bd * bd;
  let s = den > 1e-9 ? cl((bd * f - c * e) / den, 0, 1) : 0, t = (bd * s + f) / e;
  if (t < 0) (t = 0), (s = cl(-c / a, 0, 1));
  else if (t > 1) (t = 1), (s = cl((bd - c) / a, 0, 1));
  const ux = px + d1x * s - ax - d2x * t, uy = py + d1y * s - ay - d2y * t, uz = pz + d1z * s - az - d2z * t;
  segT = t;
  return ux * ux + uy * uy + uz * uz;
}

// The climber at progress u along the stair: tapered capsules [ax, ay, az,
// bx, by, bz, ra, rb] in the tower's frame (x right, Y up, z toward us), and
// the flame C = [x, Y, z, angle, height of the tread under it].
function climber(S) {
  const pitch = S.pitch, hgt = 0.6 * (pitch - S.th);
  const a0 = 0.25, a1 = (TAU * (108 - 1.05 * hgt - S.th)) / pitch, a = a0 + (a1 - a0) * S.u;
  const walk = (a * WALK) / (0.2 * hgt), fy = (pitch * a) / TAU - 0.5 * S.rise + S.th + 0.04 * hgt * abs(sin(walk));
  const sa = sin(a), ca = cos(a);
  // Local axes: forward along the stair, out toward the wall, up.
  const at = (f, o, u) => [(WALK + o * hgt) * sa + f * hgt * ca, fy + u * hgt, (WALK + o * hgt) * ca - f * hgt * sa];
  const caps = [];
  const cap = (p, q, ra, rb) => caps.push([...p, ...q, ra * hgt, rb * hgt]);
  const sw = 0.03 * sin(walk);
  // A cloak that widens to the hem, square shoulders, a hood with a point.
  cap(at(-0.03, 0, 0.1), at(0.01, 0, 0.58), 0.21, 0.11);
  cap(at(0.02, 0.07, 0.68), at(0.02, -0.07, 0.68), 0.09, 0.09);
  cap(at(0.06, 0, 0.84), at(0.07, 0, 0.85), 0.1, 0.1);
  cap(at(0.03, 0, 0.88), at(-0.09, 0, 1.06), 0.08, 0.012);
  // The arm reaches forward and in, holding the candle over the well side.
  const hand = at(0.2 + sw, -0.22, 0.64);
  cap(at(0.03, -0.08, 0.7), hand, 0.045, 0.035);
  const C = [hand[0], hand[1] + 0.1 * hgt + 1.5, hand[2], 0, 0];
  C[3] = ang(C[0], C[2]);
  C[4] = fy + (pitch * wrap(C[3] - a)) / TAU;
  let mx = 0, my = 0, mz = 0;
  for (const c of caps) (mx += c[0] + c[3]), (my += c[1] + c[4]), (mz += c[2] + c[5]);
  S.P = { a, hgt, caps, hand, C, mid: [mx / 10, my / 10, mz / 10], rad: 0.78 * hgt };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.speed = cl(k[1], 0.2, 3);
  S.reach = 28 * 2 ** cl(k[3], -1, 1);
  const T = round(cl(k[2], 3, 8));
  if (T !== S.turns) {
    S.turns = T;
    build(S);
  }
  const ds = (d * S.speed) / 2, D = 10 * sqrt(T / 3);
  S.t += ds;
  S.tp += ds;
  S.flare = max(0, S.flare - ds);
  if (input.btnPressed && input.btnPressed[0] && S.phase === 0) (S.phase = 1), (S.tp = 0.25);
  // 0 climbing, 1 a draft bends the flame, 2 dark with eyes at the window.
  if (S.phase === 0) {
    S.u = min(1, S.u + ds / D);
    if (S.u >= 1) (S.phase = 1), (S.tp = 0);
  } else if (S.phase === 1 && S.tp > 0.6) (S.phase = 2), (S.tp = 0);
  else if (S.phase === 2 && S.tp > 2.2) (S.phase = 0), (S.tp = 0), (S.u = 0), (S.flare = 0.5);
  const fl = 0.9 + 0.06 * sin(S.t * 23) + 0.04 * sin(S.t * 37 + 1);
  S.flick = S.phase === 0 ? fl : S.phase === 1 ? fl * (1 - sm(S.tp / 0.6)) * (0.6 + 0.4 * sin(S.t * 61)) : 0;
  climber(S);
  const hue = cl(k[0], 0, 1);
  if (hue !== S.hue) {
    S.hue = hue;
    S.tint = hsv(0.76 - 0.36 * hue, 0.68, 1);
    S.sky = hsv(0.76 - 0.36 * hue, 0.75, 1);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.P) return;
  const { kind, pos, nrm, alb, amb, eh, win, buf, fz, fl, P, tint, sky } = S;
  const C = P.C, lit = S.flick, R = S.reach, cut = 3 * R, caps = P.caps, LC = [1, 0.55, 0.2];
  for (let p = 0; p < N; p++) {
    const q = 3 * p, w = win[p];
    if (w > 0) {
      // The night through a slit, deeper at the top, and a sliver of moon.
      const v = w > 2 ? 1 : 0.2 + 0.5 * w;
      buf[q] = w > 2 ? 0.95 : sky[0] * v;
      buf[q + 1] = w > 2 ? 0.9 : sky[1] * v;
      buf[q + 2] = w > 2 ? 0.7 : sky[2] * v;
      continue;
    }
    const k = kind[p], a = alb[p] * amb[p] * 0.2;
    let r = tint[0] * a, g = tint[1] * a, b = tint[2] * a;
    if (lit > 0.01) {
      const px = pos[q], py = pos[q + 1], pz = pos[q + 2], lx = C[0] - px, ly = C[1] - py, lz = C[2] - pz, dd = sqrt(lx * lx + ly * ly + lz * lz) || 1;
      if (dd < cut) {
        const ln = (nrm[q] * lx + nrm[q + 1] * ly + nrm[q + 2] * lz) / dd;
        let li = (sm((cut - dd) / R) * (0.2 + 0.8 * max(0, ln))) / (1 + (dd / R) ** 2);
        if (ln < -0.3) li = 0;
        if (li > 0.004 && k !== CUT && !clear(S, C, px, py, pz, eh[p])) li = 0;
        if (li > 0.004) {
          // The climber's shadow: does the way to the flame pass through him?
          const mx = P.mid[0] - px, my = P.mid[1] - py, mz = P.mid[2] - pz, tt = cl((mx * lx + my * ly + mz * lz) / (dd * dd), 0, 1);
          const ex = mx - lx * tt, ey = my - ly * tt, ez = mz - lz * tt;
          if (ex * ex + ey * ey + ez * ez < P.rad * P.rad)
            for (const c of caps) {
              const d2 = segDist2(px, py, pz, C[0], C[1], C[2], c[0], c[1], c[2], c[3], c[4], c[5]), rr = c[6] + (c[7] - c[6]) * segT;
              if (d2 < rr * rr) li = 0;
            }
        }
        li *= lit * 1.5 * alb[p];
        r += LC[0] * li;
        g += LC[1] * li;
        b += LC[2] * li;
      }
    }
    if (w < 0) (r *= 0.55), (g *= 0.55), (b *= 0.55);
    buf[q] = r;
    buf[q + 1] = g;
    buf[q + 2] = b;
  }
  // The climber: a dark cloak, the side toward the flame lit warm.
  fz.fill(-99);
  for (const c of caps) {
    const sx0 = 32 + c[0], sy0 = YB - c[1] + K * c[2], sx1 = 32 + c[3], sy1 = YB - c[4] + K * c[5], ra = c[6], rb = c[7], rr = max(ra, rb);
    const ex = sx1 - sx0, ey = sy1 - sy0, e2 = ex * ex + ey * ey || 1e-6;
    for (let y = max(0, floor(min(sy0, sy1) - rr)); y <= min(H - 1, ceil(max(sy0, sy1) + rr)); y++)
      for (let x = max(0, floor(min(sx0, sx1) - rr)); x <= min(W - 1, ceil(max(sx0, sx1) + rr)); x++) {
        const qx = x + 0.5 - sx0, qy = y + 0.5 - sy0, u = cl((qx * ex + qy * ey) / e2, 0, 1), hx = qx - u * ex, hy = qy - u * ey, h2 = hx * hx + hy * hy, ru = ra + (rb - ra) * u;
        if (h2 > ru * ru) continue;
        const p = y * W + x, hz = sqrt(ru * ru - h2), zz = c[2] + (c[5] - c[2]) * u + hz;
        if (zz < pos[3 * p + 2] - 1 || zz < fz[p]) continue;
        fz[p] = zz;
        const wxp = c[0] + (c[3] - c[0]) * u + hx, wyp = c[1] + (c[4] - c[1]) * u - hy;
        const lx = C[0] - wxp, ly = C[1] - wyp, lz = C[2] - zz, dd = sqrt(lx * lx + ly * ly + lz * lz) || 1;
        fl[p] = max(0, (hx * lx - hy * ly + hz * lz) / (ru * dd)) / (1 + (dd / R) ** 2);
      }
  }
  for (let p = 0; p < N; p++)
    if (fz[p] > -99) {
      const q = 3 * p, v = fl[p] * lit;
      buf[q] = 0.035 + 1.1 * v;
      buf[q + 1] = 0.02 + 0.55 * v;
      buf[q + 2] = 0.05 + 0.2 * v;
    }
  // The hand, the candle and its flame, hidden where the climber is in
  // front of them, and a halo round the flame either way.
  const sx = (v) => 32 + v[0], sy = (v) => YB - v[1] + K * v[2], hx = sx(P.hand), hy = sy(P.hand), fx = sx(C), fy = sy(C), front = C[2] + 1;
  const put = (x, y, r, g, b) => {
    (x = floor(x)), (y = floor(y));
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = y * W + x, q = 3 * p;
    if (fz[p] > front || pos[3 * p + 2] > front + 0.5) return;
    buf[q] = r;
    buf[q + 1] = g;
    buf[q + 2] = b;
  };
  const glow = (cx, cy, rad, amp, col) => {
    for (let y = max(0, floor(cy - rad)); y <= min(H - 1, ceil(cy + rad)); y++)
      for (let x = max(0, floor(cx - rad)); x <= min(W - 1, ceil(cx + rad)); x++) {
        const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (dd > rad) continue;
        const v = amp * (1 - dd / rad) ** 2, q = 3 * (y * W + x);
        buf[q] += col[0] * v;
        buf[q + 1] += col[1] * v;
        buf[q + 2] += col[2] * v;
      }
  };
  if (S.phase < 2) {
    const sk = 0.25 + 0.6 * lit;
    put(hx, hy, sk, 0.6 * sk, 0.42 * sk);
    put(hx + (fx > hx ? -1 : 1), hy, 0.8 * sk, 0.48 * sk, 0.33 * sk);
    for (let y = floor(hy) - 1; y > floor(fy); y--) put(fx, y, 0.75, 0.7, 0.6);
  }
  if (lit > 0.01) {
    glow(fx, fy - 0.5, 8, 0.5 * lit, LC);
    const sway = S.phase === 1 ? 1.4 * sin(S.t * 30) : 0.4 * sin(S.t * 11);
    put(fx, fy, 1, 0.95 * lit, 0.6 * lit);
    put(fx + sway * 0.5, fy - 1, 1, 0.75 * lit, 0.25 * lit);
    put(fx + sway, fy - 2, 0.9 * lit, 0.4 * lit, 0.05);
  } else if (S.phase === 2 && S.tp < 1)
    // A thread of smoke from the wick.
    for (let i = 0; i < 6; i++) put(fx + 1.2 * sin(S.tp * 6 + i), fy - 1 - i - 4 * S.tp, 0.3 * (1 - S.tp), 0.28 * (1 - S.tp), 0.3 * (1 - S.tp));
  // The match struck at the foot of the stair before each climb.
  if (S.flare > 0) glow(fx, fy - 1, 3 + 8 * (0.5 - S.flare), 2 * S.flare, [1, 0.85, 0.55]);
  // Two green eyes at the top window while it is dark.
  if (S.phase === 2 && S.tp > 0.3 && S.tp < 2 && S.wins.length) {
    const w = S.wins[0];
    const e = sm((S.tp - 0.3) / 0.3) * (1 - sm((S.tp - 1.7) / 0.3)) * (abs(S.tp - 1.15) < 0.07 ? 0.1 : 1);
    glow(w.sx, w.sy - 1, 6, 0.2 * e, [0.3, 1, 0.3]);
    // A pale face fills the slit behind them.
    for (let y = floor(w.sy - 3); y <= w.sy + 2; y++)
      for (let x = floor(w.sx - 1.5); x <= w.sx + 1; x++) {
        const q = 3 * (y * W + x);
        if (y >= 0 && x >= 0 && x < W) (buf[q] += 0.14 * e), (buf[q + 1] += 0.17 * e), (buf[q + 2] += 0.14 * e);
      }
    for (const dx of [-1, 1]) {
      const x = floor(w.sx + dx), y = floor(w.sy - 1), q = 3 * (y * W + x);
      if (x >= 0 && x < W && y >= 0) (buf[q] = 0.3 * e), (buf[q + 1] = e), (buf[q + 2] = 0.2 * e);
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const q = 3 * p;
      display.setPixel(x, y, round(cl(buf[q], 0, 1) * 255), round(cl(buf[q + 1], 0, 1) * 255), round(cl(buf[q + 2], 0, 1) * 255));
    }
}
