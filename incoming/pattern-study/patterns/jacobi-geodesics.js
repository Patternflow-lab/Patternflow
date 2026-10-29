// ===== Patternflow pattern =====
// Title:   Jacobi Geodesics
// Family:  space
// Idea:    A three-axis ellipsoid stands the height of the panel and turns, and 36 geodesics leave one of its four umbilics in every direction at once: their front wraps the body and closes again to a single point at the opposite umbilic, then comes home; past the middle of K4 one long geodesic winds instead, filling the band between its two caustic lines of curvature.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: geodesics on the triaxial ellipsoid (Carl Gustav Jacob Jacobi, 1839), their caustics (Michel Chasles, 1846), pattern round 65
// Round:   65
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Axes=0..1, Launch=0..1
//
// Knob 1: Hue. Turns the colours round the wheel: at 0 the fan runs from cyan at its two ends through blue to violet in the middle of its directions, the body is a dim blue with rose lines of curvature, the long geodesic is violet and its caustics warm white. The body keeps to the hues from green to violet, which stay colours this dim.
// Knob 2: Speed. At 2 the front runs 27 LEDs a second, so the fan from the umbilic closes at the opposite one after 4.7 s and is home at 9.3 s, and a new fan leaves after a 0.6 s fade. The body turns half round in the time of one pass, so the closing point faces you. At 0.2 ten times slower.
// Knob 3: Axes. The half axes are 1 (60 LEDs, up the panel), 0.5 and c, with c from 0.2 at 0 to 0.45 at 1. The umbilics sit in the plane of the longest and shortest axes, at 0.884 of the half length at 0 and 0.970 at 1, nearer the tips as the body grows rounder, and the way from one to the opposite one is half the perimeter of that principal ellipse, 2.101 at 0 and 2.360 at 1.
// Knob 4: Launch. Up to 0.08 the fan starts exactly on the umbilic. To 0.5 its start slides along the same principal ellipse toward the waist and the front no longer closes but folds into cusps. From 0.5 one geodesic leaves the end of the middle axis at 10 degrees from the long axis, turning to 60 at 1: at Axes 0 it circles the short axis over both tips up to 0.68, passes through the umbilics there, and then circles the long axis in a belt round the waist that narrows until, at 1, its caustics run between 0.50 and 0.57 of the half length above and below it.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, asin, atan2, PI, exp, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const SC = 60; // LEDs per unit: the long half axis a = 1 is 60 LEDs
const NB = 36; // rays in the fan
const DS = 0.02; // arc length between trail points
const STEP = 0.005; // largest RK4 step

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The body x^2 + y^2/b^2 + z^2/c^2 = 1, x up the panel.
function setAxes(S, k) {
  S.b = 0.5;
  S.c = 0.5 * (0.4 + 0.5 * k);
  S.A = 1; S.B = 1 / (S.b * S.b); S.C = 1 / (S.c * S.c);
  const b2 = S.b * S.b, c2 = S.c * S.c;
  // The four umbilics, in the plane of the long and short axes.
  S.ux = sqrt((1 - b2) / (1 - c2));
  S.uz = S.c * sqrt((b2 - c2) / (1 - c2));
  // Half the perimeter of that principal ellipse: every geodesic from an
  // umbilic reaches the opposite one after exactly this length.
  let per = 0, px = 1, pz = 0;
  for (let i = 1; i <= 2000; i++) {
    const t = (PI * i) / 2000, x = cos(t), z = S.c * sin(t);
    per += hypot(x - px, z - pz);
    px = x; pz = z;
  }
  S.hp = per;
}

// Geodesic acceleration on F = 0: x'' = -(v.Hv / |grad F|^2) grad F.
function acc(S, p, v, o) {
  const gx = p[0] * S.A, gy = p[1] * S.B, gz = p[2] * S.C;
  const k = -(v[0] * v[0] * S.A + v[1] * v[1] * S.B + v[2] * v[2] * S.C) / (gx * gx + gy * gy + gz * gz);
  o[0] = k * gx; o[1] = k * gy; o[2] = k * gz;
}

// Back onto the surface and the tangent plane, at unit speed.
function settle(S, p, v) {
  const s = 1 / sqrt(p[0] * p[0] * S.A + p[1] * p[1] * S.B + p[2] * p[2] * S.C);
  p[0] *= s; p[1] *= s; p[2] *= s;
  const gx = p[0] * S.A, gy = p[1] * S.B, gz = p[2] * S.C;
  const d = (v[0] * gx + v[1] * gy + v[2] * gz) / (gx * gx + gy * gy + gz * gz);
  v[0] -= d * gx; v[1] -= d * gy; v[2] -= d * gz;
  const n = hypot(v[0], v[1], v[2]);
  v[0] /= n; v[1] /= n; v[2] /= n;
}

const K1 = [0, 0, 0], K2 = [0, 0, 0], K3 = [0, 0, 0], K4 = [0, 0, 0], P2 = [0, 0, 0], V2 = [0, 0, 0], VA = [0, 0, 0], VB = [0, 0, 0];
function rk4(S, p, v, h) {
  acc(S, p, v, K1);
  for (let i = 0; i < 3; i++) { P2[i] = p[i] + 0.5 * h * v[i]; V2[i] = v[i] + 0.5 * h * K1[i]; }
  acc(S, P2, V2, K2);
  for (let i = 0; i < 3; i++) { VA[i] = V2[i]; P2[i] = p[i] + 0.5 * h * VA[i]; V2[i] = v[i] + 0.5 * h * K2[i]; }
  acc(S, P2, V2, K3);
  for (let i = 0; i < 3; i++) { VB[i] = V2[i]; P2[i] = p[i] + h * VB[i]; V2[i] = v[i] + h * K3[i]; }
  acc(S, P2, V2, K4);
  for (let i = 0; i < 3; i++) {
    p[i] += (h / 6) * (v[i] + 2 * VA[i] + 2 * VB[i] + V2[i]);
    v[i] += (h / 6) * (K1[i] + 2 * K2[i] + 2 * K3[i] + K4[i]);
  }
  settle(S, p, v);
}

// The two ellipsoidal coordinates c^2 < mu < b^2 < nu < 1 of a point on the
// body: the roots besides 0 of sum x_i^2 / (a_i^2 - s) = 1.
function ellc(S, x, y, z, out) {
  const A2 = 1, B2 = S.b * S.b, C2 = S.c * S.c, x2 = x * x, y2 = y * y, z2 = z * z;
  const bb = x2 + y2 + z2 - A2 - B2 - C2, cc = A2 * B2 + A2 * C2 + B2 * C2 - x2 * (B2 + C2) - y2 * (A2 + C2) - z2 * (A2 + B2);
  const dq = sqrt(max(0, bb * bb - 4 * cc));
  out[0] = (-bb - dq) / 2;
  out[1] = (-bb + dq) / 2;
  return out;
}

// A point on the principal ellipse of the long and short axes, at parameter t.
const onEllipse = (S, t) => [cos(t), 0, S.c * sin(t)];

export function setup(params) {
  params.s = {
    b: 0.5, c: 0.2, A: 1, B: 4, C: 25, ux: 0, uz: 0, hp: 2,
    axes: -1, launch: -1, mode: 0, hue: 0, speed: 2,
    s: 0, rho: 0, fade: 1, rays: [], lam: 0, caustic: [],
    buf: new Float32Array(W * H * 3), G1: new Float32Array(W * H), G2: new Float32Array(W * H), SH: new Float32Array(W * H),
    col: [0, 0, 0], e: [0, 0],
  };
}

// The fan: NB rays from the start, one per direction. Launch below 0.08
// starts on the umbilic.
function launchFan(S) {
  const L = S.launch, tu = atan2(S.uz / S.c, S.ux);
  const off = cl((L - 0.08) / 0.42, 0, 1);
  const t = tu + off * 0.55 * (PI / 2 - tu);
  const p0 = onEllipse(S, t), e1 = [-sin(t), 0, S.c * cos(t)], l = hypot(e1[0], e1[2]);
  e1[0] /= l; e1[2] /= l;
  S.rays = [];
  for (let k = 0; k < NB; k++) {
    const al = (2 * PI * (k + 0.5)) / NB;
    const p = p0.slice(), v = [cos(al) * e1[0], sin(al), cos(al) * e1[2]];
    settle(S, p, v);
    S.rays.push({ p, v, tr: [p[0], p[1], p[2]], acc: 0, al });
  }
  S.s = 0;
  S.fade = 1;
}

// One long geodesic from the end of the middle axis, (0, b, 0), aimed at
// beta from the long axis, run 24 units ahead so its band is already half
// filled. Its constant is lambda = mu (t.e_nu)^2 + nu (t.e_mu)^2 with e_mu
// and e_nu the principal directions; here mu = c^2, nu = 1 and those are z
// and x, so lambda = c^2 cos^2 beta + sin^2 beta. The geodesic keeps to
// mu <= lambda, a ring round the short axis over both tips, when lambda <
// b^2, and to nu >= lambda, a belt round the long axis, when lambda > b^2.
function launchOne(S) {
  const u = (S.launch - 0.5) / 0.5, be = ((10 + 50 * u) * PI) / 180;
  const p = [0, S.b, 0], v = [cos(be), 0, sin(be)];
  settle(S, p, v);
  S.lam = S.c * S.c * cos(be) * cos(be) + sin(be) * sin(be);
  S.caustic = causticLines(S, S.lam);
  const r = { p, v, tr: [p[0], p[1], p[2]], acc: 0, al: be };
  S.rays = [r];
  advance(S, r, 24, 3000);
  S.s = 0;
  S.fade = 1;
}

// The lines of curvature at lambda, as point lists: two closed curves.
function causticLines(S, lam) {
  const a2 = 1, b2 = S.b * S.b, c2 = S.c * S.c, out = [];
  for (const sg of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const ph = (2 * PI * i) / 160;
      let x, y, z;
      if (lam > b2) {
        const mu = c2 + (b2 - c2) * sin(ph) * sin(ph), nu = lam;
        x = sg * sqrt(max(0, ((a2 - mu) * (a2 - nu)) / ((a2 - b2) * (a2 - c2))));
        y = (cos(ph) < 0 ? -1 : 1) * S.b * sqrt(max(0, ((b2 - mu) * (nu - b2)) / ((a2 - b2) * (b2 - c2))));
        z = (sin(ph) < 0 ? -1 : 1) * S.c * sqrt(max(0, ((mu - c2) * (nu - c2)) / ((a2 - c2) * (b2 - c2))));
      } else {
        const mu = lam, nu = b2 + (a2 - b2) * sin(ph) * sin(ph);
        x = (cos(ph) < 0 ? -1 : 1) * sqrt(max(0, ((a2 - mu) * (a2 - nu)) / ((a2 - b2) * (a2 - c2))));
        y = (sin(ph) < 0 ? -1 : 1) * S.b * sqrt(max(0, ((b2 - mu) * (nu - b2)) / ((a2 - b2) * (b2 - c2))));
        z = sg * S.c * sqrt(max(0, ((mu - c2) * (nu - c2)) / ((a2 - c2) * (b2 - c2))));
      }
      pts.push(x, y, z);
    }
    out.push(pts);
  }
  return out;
}

// Moves a ray on by length L, dropping a trail point every DS, keeping at most cap.
function advance(S, r, L, cap) {
  let left = L;
  while (left > 1e-9) {
    const h = min(STEP, left, DS - r.acc + 1e-12);
    rk4(S, r.p, r.v, h);
    left -= h;
    r.acc += h;
    if (r.acc >= DS - 1e-9) {
      r.acc = 0;
      r.tr.push(r.p[0], r.p[1], r.p[2]);
      if (r.tr.length > cap * 3) r.tr.splice(0, r.tr.length - cap * 3);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  const ax = cl(kv[2], 0, 1), L = cl(kv[3], 0, 1);
  let fresh = false;
  if (abs(ax - S.axes) > 1e-4) { S.axes = ax; setAxes(S, ax); fresh = true; }
  if (abs(L - S.launch) > 1e-4) { S.launch = L; fresh = true; }
  S.mode = S.launch < 0.5 ? 0 : 1;
  if (fresh) (S.mode ? launchOne : launchFan)(S);
  const ds = (0.45 * S.speed * d) / 2;
  if (S.mode === 0) {
    // Out to the opposite umbilic and home again, then a short fade and a new fan.
    if (S.s < 2 * S.hp) {
      const step = min(ds, 2 * S.hp - S.s);
      for (const r of S.rays) advance(S, r, step, 45);
      S.s += step;
    } else {
      S.fade -= d * 1.6;
      if (S.fade <= 0) launchFan(S);
    }
  } else {
    advance(S, S.rays[0], ds, 3000);
    S.s += ds;
  }
  // Half a turn for every pass from umbilic to umbilic.
  S.rho += (PI * ds) / S.hp;
}

// How close a LED is to a level line of G, n lines over 0..1, in LEDs, from
// the step to its neighbours: 1 on the line, 0 a LED away.
function gridLine(G, SH, p, px, py, n) {
  const g = G[p], gx = px + 1 < W && SH[p + 1] >= 0 ? abs(G[p + 1] - g) : 0, gy = py + 1 < H && SH[p + W] >= 0 ? abs(G[p + W] - g) : 0;
  const gr = max(gx, gy, 1e-4), f = abs(g * n - round(g * n)) / n;
  return cl(1 - f / gr / 0.9, 0, 1);
}

function plot(buf, x, y, r, g, b) {
  const x0 = floor(x - 0.5), y0 = floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const X = x0 + i, Y = y0 + j;
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy) * 1.5, o = (Y * W + X) * 3;
      buf[o] = max(buf[o], r * w); buf[o + 1] = max(buf[o + 1], g * w); buf[o + 2] = max(buf[o + 2], b * w);
    }
}

function line(buf, x0, y0, x1, y1, r, g, b) {
  const n = max(1, Math.ceil(hypot(x1 - x0, y1 - y0) / 0.6));
  for (let i = 0; i <= n; i++) plot(buf, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, g, b);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.axes < 0) return;
  const { buf, G1, G2, SH, col } = S;
  const cr = cos(S.rho), sr = sin(S.rho), b = S.b, c = S.c, b2 = b * b, c2 = c * c;
  const hb = 0.5 + S.hue, e = S.e;
  buf.fill(0);
  // The body: orthographic, seen along z after turning by rho about x.
  for (let py = 0; py < H; py++) {
    const x = (64 - py - 0.5) / SC;
    for (let px = 0; px < W; px++) {
      const p = py * W + px, yp = (px + 0.5 - 32) / SC;
      // y = yp cr + zp sr, z = -yp sr + zp cr; solve for the front zp.
      const qa = (sr * sr) / b2 + (cr * cr) / c2, qb = 2 * yp * cr * sr * (1 / b2 - 1 / c2);
      const qc = x * x + yp * yp * ((cr * cr) / b2 + (sr * sr) / c2) - 1;
      const disc = qb * qb - 4 * qa * qc;
      if (disc <= 0) { SH[p] = -1; continue; }
      const zp = (-qb + sqrt(disc)) / (2 * qa), y = yp * cr + zp * sr, z = -yp * sr + zp * cr;
      const nx = x, ny = y / b2, nz = z / c2, nl = sqrt(nx * nx + ny * ny + nz * nz);
      const vz = (ny * sr + nz * cr) / nl, vy = (ny * cr - nz * sr) / nl;
      SH[p] = cl(0.35 + 0.65 * (0.55 * vz + 0.35 * (nx / nl) - 0.25 * vy), 0, 1) * cl(disc * 40, 0, 1);
      ellc(S, x, y, z, e);
      G1[p] = (2 / PI) * asin(sqrt(cl((e[0] - c2) / (b2 - c2), 0, 1)));
      G2[p] = (2 / PI) * asin(sqrt(cl((e[1] - b2) / (1 - b2), 0, 1)));
    }
  }
  hsv(hb + 0.42, 0.55, 1, col);
  const lr = col[0], lg = col[1], lb = col[2];
  // The body's own dim colour keeps to the hues from green to violet, since
  // red, orange and yellow read brown this dim.
  hsv(0.3 + 0.55 * ((((hb + 0.12) % 1) + 1) % 1), 0.75, 1, col);
  const br = col[0], bg = col[1], bb = col[2];
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const p = py * W + px;
      if (SH[p] < 0) continue;
      const sh = SH[p], o = p * 3;
      // Lines of curvature: six of mu, eight of nu, about a LED wide.
      const ln = max(gridLine(G1, SH, p, px, py, 6), gridLine(G2, SH, p, px, py, 8));
      // The band a long geodesic keeps to, lit faintly.
      let band = 0;
      if (S.mode === 1) {
        const m = (G1[p] * PI) / 2, nn = (G2[p] * PI) / 2;
        const mu = c2 + (b2 - c2) * sin(m) * sin(m), nu = b2 + (1 - b2) * sin(nn) * sin(nn);
        band = S.lam > b2 ? (nu >= S.lam ? 1 : 0) : mu <= S.lam ? 1 : 0;
      }
      const v = (0.09 + 0.16 * sh) * (1 + 0.9 * band);
      buf[o] = v * br + ln * lr * 0.17 * (0.4 + 0.6 * sh);
      buf[o + 1] = v * bg + ln * lg * 0.17 * (0.4 + 0.6 * sh);
      buf[o + 2] = v * bb + ln * lb * 0.17 * (0.4 + 0.6 * sh);
    }
  // Body point to screen, and whether it faces us.
  const proj = (x, y, z, out) => {
    out[0] = 32 + SC * (y * cr - z * sr);
    out[1] = 64 - SC * x;
    out[2] = (y / b2) * sr + (z / c2) * cr > 0 ? 1 : 0.3;
    return out;
  };
  const q0 = [0, 0, 0], q1 = [0, 0, 0];
  // Caustics of the long geodesic.
  if (S.mode === 1) {
    hsv(hb + 0.62, 0.25, 1, col);
    for (const pts of S.caustic)
      for (let i = 3; i < pts.length; i += 3) {
        proj(pts[i - 3], pts[i - 2], pts[i - 1], q0);
        proj(pts[i], pts[i + 1], pts[i + 2], q1);
        const w = 0.6 * min(q0[2], q1[2]);
        line(buf, q0[0], q0[1], q1[0], q1[1], col[0] * w, col[1] * w, col[2] * w);
      }
  }
  // Trails and the front.
  const f = S.fade, nr = S.rays.length;
  for (let k = 0; k < nr; k++) {
    const r = S.rays[k], tr = r.tr, n = tr.length / 3;
    hsv(S.mode ? hb + 0.3 : hb + 0.17 * (1 - cos(r.al)), 0.85, 1, col);
    for (let i = 1; i < n; i++) {
      proj(tr[i * 3 - 3], tr[i * 3 - 2], tr[i * 3 - 1], q0);
      proj(tr[i * 3], tr[i * 3 + 1], tr[i * 3 + 2], q1);
      const age = (n - i) / n, w = f * min(q0[2], q1[2]) * (S.mode ? 0.5 + 0.5 * exp(-age * 4) : 0.15 + 0.6 * (1 - age));
      line(buf, q0[0], q0[1], q1[0], q1[1], col[0] * w, col[1] * w, col[2] * w);
    }
  }
  if (S.mode === 0 && S.s > 0) {
    for (let k = 0; k < nr; k++) {
      const r = S.rays[k], r2 = S.rays[(k + 1) % nr];
      proj(r.p[0], r.p[1], r.p[2], q0);
      proj(r2.p[0], r2.p[1], r2.p[2], q1);
      hsv(hb + 0.17 * (1 - cos(r.al)), 0.5, 1, col);
      const w = f * min(q0[2], q1[2]);
      line(buf, q0[0], q0[1], q1[0], q1[1], col[0] * w, col[1] * w, col[2] * w);
    }
  } else if (S.mode === 1) {
    const r = S.rays[0];
    proj(r.p[0], r.p[1], r.p[2], q0);
    plot(buf, q0[0], q0[1], q0[2], q0[2], q0[2]);
  }
  // The four umbilics.
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    proj(sx * S.ux, 0, sz * S.uz, q0);
    const w = q0[2] > 0.5 ? 1 : 0.35;
    plot(buf, q0[0], q0[1], w, w, w);
  }
  for (let p = 0; p < W * H; p++) {
    const o = p * 3;
    display.setPixel(p & 63, p >> 6, floor(cl(buf[o], 0, 1) * 255), floor(cl(buf[o + 1], 0, 1) * 255), floor(cl(buf[o + 2], 0, 1) * 255));
  }
}
