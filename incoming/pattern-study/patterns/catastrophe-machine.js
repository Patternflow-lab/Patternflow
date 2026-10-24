// ===== Patternflow pattern =====
// Title:   Catastrophe Machine
// Family:  physics
// Idea:    Zeeman's machine stands on the panel, a disc on a pivot with two elastic bands tied to one point of its rim, one to a fixed anchor above and one to a control point that sweeps back and forth below; the disc follows its energy minimum smoothly until the control point leaves the cusped diamond where two minima exist, and then it snaps across, so the control point's trail takes one colour going right and the other coming back.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Zeeman's catastrophe machine (Christopher Zeeman, 1972), pattern round 36
// Round:   36
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tension=0..1, Depth=0..1
//
// Knob 1: Hue. Turns the three colours together. At 0 the diamond is violet, B's trail amber while P is on the left of the disc and cyan while it is on the right; the disc's face is steel blue. At 0.25 the three are crimson, green and blue on a purple disc; at 0.5 green, blue and red on a pale amber one; at 0.75 cyan, pink and lime on a green one. Round orange and yellow the diamond's shading and the disc are laid paler and brighter, so they do not go olive or brown.
// Knob 2: Speed. At 2 B crosses the panel in 4 seconds and comes back in 4, and a snap carries the disc over in under half a second; at 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Tension. The rest length of both bands, from one disc radius at 0 to nothing at 1, the anchor 2.5 radii from the pivot. At 0 the diamond is 30 LEDs wide and 34 tall, its top cusp 8 LEDs under the disc; at 0.25 it is 21 by 25, at 0.5 13 by 17, at 0.75 6 by 8, at 0.9 a speck. At 1 the bands are springs of zero length, the energy has one minimum wherever B is, the diamond is gone and the disc turns smoothly to face the sum of A and B.
// Knob 4: Depth. The height of B's sweep, as a share of the way from the side cusps down to the bottom cusp. At 0 it crosses 30% of the way down, give or take a quarter, where the diamond is wide, and each snap throws the disc about 120 degrees; at 0.3 about 85, at 0.5 about 70 and only on some passes; at 0.7 about 45, near the bottom cusp, where the two minima are close; from 0.8 the sweep passes under the cusp, never enters the diamond, and the disc swings across with no snap at all.
// Buttons: K1 tap throws B to the mirror point across the axis. From outside the diamond the disc snaps at once; from inside it, B lands inside again and the disc stays where it was, since inside either side is stable.

const W = 64, H = 128, N = W * H;
// The machine in disc radii: pivot O at the origin, anchor A at (0, AD),
// bands of rest length L. On the panel one radius is SC LEDs, O sits at row
// OY, and the anchor 5 rows from the top.
const AD = 2.5, L0 = 1, SC = 18.6, OX = 32, OY = 5 + SC * AD, NF = 360, NT = 180, TRAIL = 180, SNAPS = 24;
const { floor, min, max, abs, sqrt, sin, cos, atan2, round, PI, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const toX = (x) => OX + SC * x, toY = (y) => OY - SC * y;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The energy V(t) = (|P-A| - L)+^2 / 2 + (|P-B| - L)+^2 / 2, P = (cos t, sin t),
// a band pulling only while it is stretched, and its derivative in t: each
// band adds its tension times the component of its direction along the rim.
function energy(t, L, bx, by) {
  const px = cos(t), py = sin(t);
  const ea = max(0, sqrt(px * px + (py - AD) * (py - AD)) - L), eb = max(0, sqrt((px - bx) ** 2 + (py - by) ** 2) - L);
  return 0.5 * (ea * ea + eb * eb);
}
function torque(t, L, bx, by) {
  const px = cos(t), py = sin(t), tx = -py, ty = px;
  const ax = px, ay = py - AD, da = sqrt(ax * ax + ay * ay), ux = px - bx, uy = py - by, db = sqrt(ux * ux + uy * uy);
  return (max(0, da - L) * (ax * tx + ay * ty)) / da + (max(0, db - L) * (ux * tx + uy * ty)) / (db || 1e-9);
}

// The bifurcation set. At a fold the disc angle t is an equilibrium (V' = 0)
// that is about to stop being a minimum (V'' = 0). For each t the band to B
// leaves P along some direction u; V' = 0 fixes how far B must be, and the
// direction is found where V'' changes sign. One point per t, so the 360
// points run round the diamond in order, through its four cusps.
function foldAt(t, L, be) {
  const px = cos(t), py = sin(t), tx = -py, ty = px;
  const ax = px, ay = py - AD, da = sqrt(ax * ax + ay * ay), uax = ax / da, uay = ay / da;
  const ca = uax * tx + uay * ty, sa = uax * px + uay * py, ea = max(0, da - L);
  const M = ea * ca, K = (da > L ? ca * ca : 0) + ea * ((1 - ca * ca) / da - sa);
  const ux = cos(be), uy = sin(be), c = ux * tx + uy * ty, s = ux * px + uy * py;
  if (abs(c) < 1e-9) return null;
  const e = -M / c;
  if (e <= 0) return null;
  const d = L + e;
  return [K + c * c + e * ((1 - c * c) / d - s), px - d * ux, py - d * uy, d];
}
function fold(S, L) {
  S.L = L;
  S.nf = 0;
  if (L < 0.02) return;
  let guess = -1;
  for (let i = 0; i < NF; i++) {
    const t = (2 * PI * i) / NF;
    let found = null;
    // Look near the last direction first, then all the way round.
    const tries = guess < 0 ? [[0, 2 * PI, 1440]] : [[guess - 0.25, guess + 0.25, 50], [0, 2 * PI, 1440]];
    for (const [b0, b1, k] of tries) {
      let prev = foldAt(t, L, b0), pb = b0;
      for (let j = 1; j <= k && !found; j++) {
        const be = b0 + ((b1 - b0) * j) / k, cur = foldAt(t, L, be);
        if (prev && cur && prev[0] * cur[0] <= 0 && abs(cur[3] - prev[3]) < 0.3 && cur[3] < 8) {
          let lo = pb, hi = be, flo = prev[0];
          for (let q = 0; q < 40; q++) {
            const mid = (lo + hi) / 2, m = foldAt(t, L, mid);
            if (!m) break;
            if (m[0] * flo > 0) (lo = mid), (flo = m[0]);
            else hi = mid;
          }
          found = foldAt(t, L, (lo + hi) / 2);
          guess = (lo + hi) / 2;
        }
        prev = cur;
        pb = be;
      }
      if (found) break;
    }
    if (found) {
      S.FX[S.nf] = found[1];
      S.FY[S.nf] = found[2];
      S.nf++;
    }
  }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < S.nf; i++) {
    x0 = min(x0, S.FX[i]);
    x1 = max(x1, S.FX[i]);
    y0 = min(y0, S.FY[i]);
    y1 = max(y1, S.FY[i]);
  }
  S.fx0 = x0;
  S.fx1 = x1;
  S.fy0 = y0;
  S.fy1 = y1;
  // The side cusps are the leftmost and rightmost points.
  let iL = 0;
  for (let i = 0; i < S.nf; i++) if (S.FX[i] < S.FX[iL]) iL = i;
  S.ySide = S.nf ? S.FY[iL] : -2.5;
}

// Local minima of V over the rim, from 180 samples, each polished by a few
// steps of descent. Returns how many; their angles land in S.mins.
function minima(S, bx, by) {
  const L = S.L, E = S.E;
  for (let i = 0; i < NT; i++) E[i] = energy((2 * PI * i) / NT, L, bx, by);
  let n = 0;
  for (let i = 0; i < NT && n < 4; i++) {
    const a = E[(i + NT - 1) % NT], b = E[(i + 1) % NT];
    if (E[i] < a && E[i] <= b) {
      let t = (2 * PI * i) / NT;
      for (let k = 0; k < 30; k++) t -= 0.5 * torque(t, L, bx, by);
      S.mins[n++] = t;
    }
  }
  return n;
}

// Follow the local minimum the disc sits in: the nearest place within half a
// radian where V' turns from negative to positive, refined by bisection.
// When there is none, that minimum has gone, which is the snap.
function track(S, t) {
  const L = S.L, bx = S.bx, by = S.by;
  let best = NaN, bd = 1e9, prev = torque(t - 0.5, L, bx, by);
  for (let i = 1; i <= 96; i++) {
    const a = t - 0.5 + i / 96, cur = torque(a, L, bx, by);
    if (prev < 0 && cur >= 0) {
      let lo = a - 1 / 96, hi = a;
      for (let q = 0; q < 30; q++) {
        const m = (lo + hi) / 2;
        if (torque(m, L, bx, by) < 0) lo = m;
        else hi = m;
      }
      const r = (lo + hi) / 2;
      if (abs(r - t) < bd) (bd = abs(r - t)), (best = r);
    }
    prev = cur;
  }
  return best;
}

function setup(params) {
  params.s = {
    t: 0, w: 0, L: -1, nf: 0, FX: new Float64Array(NF), FY: new Float64Array(NF), fx0: 0, fx1: 0, fy0: 0, fy1: 0, ySide: -2.4,
    E: new Float64Array(NT), mins: new Float64Array(4), nm: 1, ghost: 0, ghostA: 0,
    ph: -PI / 2, wph: 0, bx: -1.35, by: -2.4, depth: 0.06, hue: 0, speed: 2,
    TX: new Float32Array(TRAIL), TY: new Float32Array(TRAIL), TB: new Float32Array(TRAIL), tn: 0, th: 0, tacc: 0,
    SX: new Float32Array(SNAPS), SY: new Float32Array(SNAPS), SA: new Float32Array(SNAPS).fill(99), sh: 0,
    tm: 0, flash: 0, fbx: 0, fby: 0, warm: false,
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N), cov: new Float32Array(N),
    xs: new Float32Array(4 * H * 16), xn: new Int32Array(4 * H), col: new Float32Array(24),
  };
}

// B's path: across the panel and back, 1.35 radii either side of the axis,
// at the height Depth picks between the side cusps and the bottom cusp,
// wandering up and down a quarter of that height. From Depth 0.8 on it
// never enters the diamond.
function place(S) {
  const ys = S.nf ? S.ySide : -2.5, yb = S.nf ? S.fy0 : -2.6;
  S.bx = 1.35 * sin(S.ph);
  S.by = ys + (0.3 + 1.2 * S.depth + 0.25 * sin(S.wph)) * (yb - ys);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.depth = cl(k[3], 0, 1);
  const L = L0 * (1 - cl(k[2], 0, 1));
  if (abs(L - S.L) > 0.002) fold(S, L);
  const beat = (d * S.speed) / 2;
  const jump = !!(input.btnPressed && input.btnPressed[0]);
  if (jump) S.ph = -S.ph;
  // A crossing of the panel every 4 beats; the wander is slower.
  S.ph += (beat * PI) / 4;
  S.wph += beat * 0.53;
  place(S);
  S.nm = minima(S, S.bx, S.by);
  if (!S.warm) {
    // Start in the deepest minimum.
    let best = 0;
    for (let i = 1; i < S.nm; i++) if (energy(S.mins[i], S.L, S.bx, S.by) < energy(S.mins[best], S.L, S.bx, S.by)) best = i;
    S.t = S.tm = S.mins[best];
    S.warm = true;
  }
  // The snap: the minimum the disc was in is gone. B is then at most one
  // frame's travel past the edge of the diamond, and the mark goes there,
  // unless K1 threw B across.
  const tm = track(S, S.tm);
  if (tm === tm) S.tm = tm;
  else {
    let far = 0, fd = -1;
    for (let i = 0; i < S.nm; i++) {
      const dd = abs(atan2(sin(S.mins[i] - S.tm), cos(S.mins[i] - S.tm)));
      if (dd > fd) (fd = dd), (far = i);
    }
    S.tm = S.mins[far];
    S.flash = 1;
    S.fbx = S.bx;
    S.fby = S.by;
    if (!jump) {
      S.SX[S.sh] = S.bx;
      S.SY[S.sh] = S.by;
      S.SA[S.sh] = 0;
      S.sh = (S.sh + 1) % SNAPS;
    }
  }
  // Overdamped: the disc turns at 30 times the torque per beat, in eight
  // small steps a frame.
  const h = beat / 8, t0 = S.t;
  for (let i = 0; i < 8; i++) S.t -= 30 * h * torque(S.t, S.L, S.bx, S.by);
  S.w = beat > 0 ? abs(S.t - t0) / beat : S.w;
  S.flash = max(0, S.flash - beat / 0.5);
  for (let i = 0; i < SNAPS; i++) S.SA[i] += beat;
  // The other minimum, when there is one, shows as a ghost on the rim.
  let gi = -1, gd = 0;
  for (let i = 0; i < S.nm; i++) {
    const dd = abs(atan2(sin(S.mins[i] - S.t), cos(S.mins[i] - S.t)));
    if (dd > 0.3 && dd > gd) (gd = dd), (gi = i);
  }
  if (gi >= 0) S.ghost = S.mins[gi];
  S.ghostA += ((gi >= 0 ? 1 : 0) - S.ghostA) * min(1, beat * 8);
  // The trail: 15 samples a beat, 12 beats long, each with the side of the
  // disc P was on.
  S.tacc += beat * 15;
  while (S.tacc >= 1) {
    S.tacc -= 1;
    S.TX[S.th] = S.bx;
    S.TY[S.th] = S.by;
    S.TB[S.th] = cos(S.t);
    S.th = (S.th + 1) % TRAIL;
    S.tn = min(TRAIL, S.tn + 1);
  }
}

// ---- Drawing ----

function plot(S, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = y * W + x;
  S.R[p] = max(S.R[p], r);
  S.G[p] = max(S.G[p], g);
  S.B[p] = max(S.B[p], b);
}

// A line in panel coordinates, about 1.4 LEDs wide, kept at the brighter.
function line(S, ax, ay, bx, by, cr, cg, cb, wide) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
  const x0 = max(0, floor(min(ax, bx) - 1.5)), x1 = min(W - 1, floor(max(ax, bx) + 1.5));
  const y0 = max(0, floor(min(ay, by) - 1.5)), y1 = min(H - 1, floor(max(ay, by) + 1.5));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, t = cl((px * dx + py * dy) / l2, 0, 1);
      const qx = px - t * dx, qy = py - t * dy, v = cl((wide - sqrt(qx * qx + qy * qy)) / 0.55, 0, 1);
      if (v > 0) plot(S, x, y, cr * v, cg * v, cb * v);
    }
}

function disc(S, cx, cy, r, cr, cg, cb, add) {
  for (let y = max(0, floor(cy - r - 1)); y <= min(H - 1, floor(cy + r + 1)); y++)
    for (let x = max(0, floor(cx - r - 1)); x <= min(W - 1, floor(cx + r + 1)); x++) {
      const v = cl(r + 0.5 - sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2), 0, 1);
      if (v <= 0) continue;
      const p = y * W + x;
      if (add) (S.R[p] += cr * v), (S.G[p] += cg * v), (S.B[p] += cb * v);
      else (S.R[p] = S.R[p] * (1 - v) + cr * v), (S.G[p] = S.G[p] * (1 - v) + cg * v), (S.B[p] = S.B[p] * (1 - v) + cb * v);
    }
}

// Coverage of the inside of the diamond: four scanlines a row.
function fill(S) {
  const { xs, xn, cov, FX, FY } = S, n = S.nf, SUB = 4, CAP = 16;
  cov.fill(0);
  xn.fill(0);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let x0 = toX(FX[i]), y0 = toY(FY[i]), x1 = toX(FX[j]), y1 = toY(FY[j]);
    if (y0 === y1) continue;
    if (y0 > y1) [x0, y0, x1, y1] = [x1, y1, x0, y0];
    const s0 = max(0, ceil(y0 * SUB - 0.5)), s1 = min(H * SUB - 1, ceil(y1 * SUB - 0.5) - 1);
    for (let s = s0; s <= s1; s++) {
      const c = xn[s];
      if (c < CAP) (xs[s * CAP + c] = x0 + (((s + 0.5) / SUB - y0) * (x1 - x0)) / (y1 - y0)), (xn[s] = c + 1);
    }
  }
  for (let s = 0; s < H * SUB; s++) {
    const c = xn[s], o = s * CAP, row = floor(s / SUB) * W;
    if (c < 2) continue;
    for (let a = 1; a < c; a++) {
      const v = xs[o + a];
      let b = a - 1;
      while (b >= 0 && xs[o + b] > v) (xs[o + b + 1] = xs[o + b]), b--;
      xs[o + b + 1] = v;
    }
    for (let a = 0; a + 1 < c; a += 2) {
      const xa = cl(xs[o + a], 0, W), xb = cl(xs[o + a + 1], 0, W);
      if (xb <= xa) continue;
      const ia = floor(xa), ib = min(W - 1, floor(xb));
      if (ia === ib) cov[row + ia] += (xb - xa) / SUB;
      else {
        cov[row + ia] += (ia + 1 - xa) / SUB;
        for (let x = ia + 1; x < ib; x++) cov[row + x] += 1 / SUB;
        if (ib < W) cov[row + ib] += (xb - ib) / SUB;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { R, G, B, cov, col } = S;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  const h = S.hue + 0.78, fl = S.flash;
  // Round yellow the diamond's shading would go olive, so there it is paler
  // and brighter.
  const hh = h - floor(h), warm = sm(1 - abs(hh - 0.16) / 0.12);
  hsv(h, 0.75 - 0.5 * warm, 1, col, 0); // accent: the diamond and the anchor
  hsv(h + 0.35, 0.85, 1, col, 3); // the trail while P is on the left
  hsv(h + 0.72, 0.8, 1, col, 6); // the trail while P is on the right
  const hd = h + 0.8 - floor(h + 0.8), warmD = sm(1 - abs(hd - 0.12) / 0.13);
  hsv(h + 0.8, 0.6 - 0.3 * warmD, 1 + 0.6 * warmD, col, 9); // the disc, never brown
  const shade = 66 + 74 * warm;
  // The bistable region, softly lit, and its cusped edge.
  if (S.nf > 2) {
    fill(S);
    for (let p = 0; p < N; p++) {
      const c = min(1, cov[p]) * shade;
      if (c > 0) (R[p] += col[0] * c), (G[p] += col[1] * c), (B[p] += col[2] * c);
    }
  }
  // The trail, oldest first, in the colour of P's side.
  for (let k = S.tn - 1; k >= 2; k--) {
    const i = (S.th - k + TRAIL) % TRAIL, j = (i + 1) % TRAIL, age = k / TRAIL;
    const u = (1 + cl(S.TB[i] * 2, -1, 1)) / 2, v = 230 * (1 - age) * (1 - age) + 25;
    line(S, toX(S.TX[i]), toY(S.TY[i]), toX(S.TX[j]), toY(S.TY[j]), v * (col[3] * (1 - u) + col[6] * u), v * (col[4] * (1 - u) + col[7] * u), v * (col[5] * (1 - u) + col[8] * u), 0.75);
  }
  if (S.nf > 2) {
    const e = 200 + 55 * fl;
    for (let i = 0; i < S.nf; i++) {
      const j = (i + 1) % S.nf;
      line(S, toX(S.FX[i]), toY(S.FY[i]), toX(S.FX[j]), toY(S.FY[j]), col[0] * e, col[1] * e, col[2] * e, 0.7);
    }
  }
  // Where the snaps happened: white marks that fade over 25 beats.
  for (let i = 0; i < SNAPS; i++) {
    if (S.SA[i] > 25) continue;
    const v = 255 * (1 - S.SA[i] / 25);
    disc(S, toX(S.SX[i]), toY(S.SY[i]), 0.9, v, v, v, false);
  }
  // The disc: a face of six soft sectors that turns with it, so a snap shows
  // as the whole wheel whirling round; a rim that flashes white; the pivot.
  const ox = toX(0), oy = toY(0), px = cos(S.t), py = sin(S.t), spin = 1 + 1.6 * cl(S.w / 8, 0, 1);
  for (let y = max(0, floor(oy - SC - 1)); y <= min(H - 1, floor(oy + SC + 1)); y++)
    for (let x = max(0, floor(ox - SC - 1)); x <= min(W - 1, floor(ox + SC + 1)); x++) {
      const dx = x + 0.5 - ox, dy = oy - y - 0.5, r = sqrt(dx * dx + dy * dy), e = cl(SC + 0.5 - r, 0, 1);
      if (e <= 0) continue;
      const a = atan2(dy, dx) - S.t, v = e * spin * (48 + 30 * cos(6 * a) * cl(r / 4, 0, 1)), p = y * W + x;
      R[p] = col[9] * v;
      G[p] = col[10] * v;
      B[p] = col[11] * v;
    }
  for (let i = 0; i < 96; i++) {
    const a0 = (2 * PI * i) / 96, a1 = (2 * PI * (i + 1)) / 96, e = 120 + 135 * fl;
    line(S, ox + SC * cos(a0), oy - SC * sin(a0), ox + SC * cos(a1), oy - SC * sin(a1), col[9] * e + 255 * fl * 0.5, col[10] * e + 255 * fl * 0.5, col[11] * e + 255 * fl * 0.5, 0.7);
  }
  line(S, ox, oy, toX(px), toY(py), col[9] * 110, col[10] * 110, col[11] * 110, 0.6);
  disc(S, ox, oy, 1.3, 200, 200, 200, false);
  // The other stable angle, while B is inside the diamond.
  if (S.ghostA > 0.02) {
    const g = 150 * S.ghostA, u = cos(S.ghost) > 0 ? 1 : 0;
    disc(S, toX(cos(S.ghost)), toY(sin(S.ghost)), 1.4, g * (col[3] * (1 - u) + col[6] * u), g * (col[4] * (1 - u) + col[7] * u), g * (col[5] * (1 - u) + col[8] * u), false);
  }
  // The bands, brighter the harder they pull.
  const ta = max(0, sqrt(px * px + (py - AD) ** 2) - S.L), tb = max(0, sqrt((px - S.bx) ** 2 + (py - S.by) ** 2) - S.L);
  const va = 70 + 185 * cl(ta / 2.6, 0, 1), vb = 70 + 185 * cl(tb / 2.6, 0, 1) + 60 * fl;
  line(S, toX(0), toY(AD), toX(px), toY(py), va, va * 0.93, va * 0.82, 0.75);
  line(S, toX(px), toY(py), toX(S.bx), toY(S.by), vb, vb * 0.93, vb * 0.82, 0.75);
  // The anchor, P on the rim, and B.
  disc(S, toX(0), toY(AD), 1.6, col[0] * 255, col[1] * 255, col[2] * 255, false);
  const u = (1 + cl(px * 2, -1, 1)) / 2;
  disc(S, toX(px), toY(py), 2.3, 255 * (col[3] * (1 - u) + col[6] * u), 255 * (col[4] * (1 - u) + col[7] * u), 255 * (col[5] * (1 - u) + col[8] * u), false);
  disc(S, toX(px), toY(py), 1, 255, 255, 255, false);
  disc(S, toX(S.bx), toY(S.by), 1.5, 255, 255, 255, false);
  // A ring opening round B at each snap.
  if (fl > 0) {
    const r = 2 + 9 * (1 - fl * fl), v = 255 * sm(fl * 1.6);
    for (let i = 0; i < 40; i++) {
      const a0 = (2 * PI * i) / 40, a1 = (2 * PI * (i + 1)) / 40;
      line(S, toX(S.fbx) + r * cos(a0), toY(S.fby) + r * sin(a0), toX(S.fbx) + r * cos(a1), toY(S.fby) + r * sin(a1), v, v, v, 0.95);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      display.setPixel(x, y, round(min(255, R[p])), round(min(255, G[p])), round(min(255, B[p])));
    }
}
