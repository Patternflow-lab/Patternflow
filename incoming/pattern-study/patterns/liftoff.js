// ===== Patternflow pattern =====
// Title:   Liftoff
// Family:  flight
// Idea:    A rocket vents on its pad across the water, lights up in rolling steam and climbs while the camera tilts after it from blue sky into black and stars, through Max-Q and staging, until it is a bright dot and the next rocket stands on the pad.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 22, after long-lens tracking shots of launches filmed across the water from the press site
// Round:   22
// ===============================
// @matrix 64x128
// @knobs Rocket=0..3, Speed=0.2..3, Stages=1..3, Time=0..1
//
// Knob 1: Rocket. A white moon rocket by its tower at 0, a chequered V-2 at 1, a grey-green cluster whose boosters fall away in a cross at 2, a sounding rocket on a rail at 3.
// Knob 2: Speed. At 2 the countdown, the flight and the next rocket take 35 s; at 0.2 ten times longer.
// Knob 3: Stages. 1 to 3 stages. A taller stack gets a taller tower and more steam, and each extra stage drops away on the climb.
// Knob 4: Time. Dawn at 0, then day, dusk and a floodlit night with searchlights. At dawn and dusk the high plume catches the sun.
// Buttons: K1 tap skips the countdown to ignition, or after liftoff rolls out the next rocket.

const W = 64;
const H = 128;
const N = W * H;
// Shoreline row with the camera level, pad column, deck height.
const GY = 112;
const X0 = 36;
const DECK = 4;
const MAXP = 900;
// A puff: x, height, vx, vz, radius, growth, age, life, opacity, heat,
// whiteness, drag, sprite.
const PF = 13;
const SP = 24;
const { min, max, abs, sin, cos, exp, sqrt, floor, round, ceil, atan2, hypot } = Math;
const rnd = () => Math.random();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Dawn, day, dusk, night: four sky colours, ambient, sun colour; sun on the
// rocket, on the high plume, floodlights, stars, sun column, height, radius.
const PAL = [
  [255, 150, 90, 200, 135, 150, 80, 105, 190, 22, 36, 110, 80, 88, 125, 255, 175, 120, 0.3, 1, 0.75, 0.15, 56, 0, 3.5],
  [200, 222, 245, 140, 190, 240, 55, 135, 230, 15, 55, 165, 175, 185, 200, 255, 250, 235, 1, 0, 0, 0, 12, 190, 3.5],
  [255, 115, 55, 185, 85, 115, 70, 55, 140, 18, 18, 70, 95, 72, 100, 255, 135, 75, 0.35, 1, 0.6, 0.3, 8, 3, 4],
  [22, 34, 62, 14, 22, 50, 7, 12, 34, 3, 5, 16, 30, 34, 55, 0, 0, 0, 0, 0.1, 1, 1, 30, -40, 0],
];
// Kerosene, hydrogen, solid: flame core, middle, edge, glow; trail
// whiteness and thickness.
const FUEL = [
  [[255, 246, 215], [255, 196, 80], [235, 105, 30], [255, 140, 55], 0.62, 0.75],
  [[235, 240, 255], [170, 180, 255], [120, 110, 230], [130, 150, 255], 0.95, 0.22],
  [[255, 252, 240], [255, 225, 150], [250, 160, 70], [255, 190, 120], 0.95, 0.95],
];
const ACC = [1, 1.15, 1.05, 1.7];
const LEAN = [0, 0, 0, 0.12];
const STEAM = [1, 0.55, 0.9, 0.35];
const IGN = [-2, -1.6, -2.2, -0.12];
// White, black, engine bells, bare metal, grey-green, orange.
const PAINT = [[0.9, 0.9, 0.88], [0.08, 0.08, 0.08], [0.24, 0.21, 0.2], [0.66, 0.69, 0.74], [0.62, 0.67, 0.58], [0.95, 0.42, 0.12]];
// 3x5 letters: 0-9, T, minus, plus.
const FONT = [31599, 11415, 29671, 29647, 23497, 31183, 31215, 29330, 31727, 31695, 29842, 448, 1488];
const BEAMS = [[3, 0.32], [62, -0.3], [22, 0.06]].map(([b, a]) => [b, sin(a), cos(a)]);
const BOOST = [[-1.4, 0, 1.9, 1.4, 2, 0], [0, 1, 2.1, 2.05, 1, 0], [1, 13, 2.05, 1.1, 10, 0], [13, 18, 1.1, 0, 10, 0]];

// Stages from the bottom: length, segments [u0, u1, half widths, paint],
// bell [length, half widths], nozzle, fuel, fins [u0, u1, span, paint].
function build(sty, n) {
  const S = (len, segs, bell, wn, fuel, fins = []) => ({ len, segs, bell, wn, fuel, fins });
  const a = 20 + (3 - n) * 2.5, b = n > 1 ? 26 : 29;
  const st = [
    [S(a, [[0, a, 4.5, 4.5, 6]], [2.5, 4.4, 3.4], 4.3, 0, [[0, 5, 2.4, 1]]), S(13, [[0, 1, 4.5, 4.5, 1], [1, 13, 4.5, 4.5, 0]], [1.5, 3, 2.2], 3, 1), S(10, [[0, 3, 4.5, 3.3, 0], [3, 10, 3.3, 3.3, 7]], [1.2, 1.8, 1.2], 1.6, 1)],
    [S(b, [[0, 20, 3.2, 3.4, 8], [20, b, 3.4, n > 1 ? 1.4 : 0, 8]], [1.5, 2.4, 1.8], 2.2, 0, [[0, 7, 3.4, 8]]), S(12, [[0, 12, 1.4, 1.4, 0]], [0.8, 1.1, 0.8], 1, 2, [[0, 3, 1.7, 1]]), S(8, [[0, 8, 1.1, 1.1, 9]], [0.7, 0.9, 0.6], 0.8, 2, [[0, 2.5, 1.2, 5]])],
    [S(28, [[0, 26, 2.2, 2.8, 10], [26, 28, 2.8, 2.5, 10]], [1.5, 2.2, 1.6], 2.2, 0), S(10, [[0, 2, 2.4, 2.4, 11], [2, 10, 2.6, 2.6, 10]], [1.2, 1.8, 1.2], 1.6, 0), S(4, [[0, 4, 2.6, 2.6, 3]], [0.8, 1.2, 0.8], 1, 1)],
    [S(15, [[0, 15, 1.7, 1.7, 9]], [1, 1.4, 1.1], 1.4, 2, [[0, 4.5, 2.6, 5]]), S(12, [[0, 1.5, 1.7, 1.3, 1], [1.5, 12, 1.3, 1.3, 9]], [0.8, 1.1, 0.8], 1.1, 2, [[1.5, 4, 1.7, 5]]), S(9, [[0, 9, 1.1, 1.1, 9]], [0.6, 0.9, 0.6], 0.8, 2, [[0, 2.5, 1.2, 5]])],
  ][sty].slice(0, n);
  const last = st[n - 1], top = last.segs.at(-1)[3];
  last.nose = sty === 0 ? [[0, 4, top, 2.6, 3], [4, 7, 2.6, 0.7, 0], [7, 11, 0.45, 0.45, 5], [11, 13, 0.9, 0.9, 5], [13, 14, 0.9, 0.1, 5]] : sty === 2 ? [[0, 5, 3.2, 3.2, 0], [5, 9, 3.2, 1.4, 0], [9, 10, 1.4, 0.5, 0], [10, 14, 0.4, 0.4, 5], [14, 16, 0.8, 0.8, 5], [16, 17, 0.8, 0, 5]] : top > 0 ? [[0, sty === 3 ? 6 : 4, top, 0, 0]] : [];
  let u = 0;
  for (const s of st) [s.u, u] = [u, u + s.len];
  return { st, n, L: u + (last.nose.length && last.nose.at(-1)[1]), sep: st.slice(1).map((_, i) => (sty === 2 ? 11.5 + i * 4.5 : 9.5 + i * 5)), boost: sty === 2 };
}

// Stages a..b-1 end to end from 0, with stage a's bell below.
function stack(V, a, b) {
  const segs = [], fins = [], u0 = V.st[a].u, bl = V.st[a].bell;
  segs.push([-bl[0], 0, bl[1], bl[2], 2, 0]);
  for (let i = a; i < b; i++) {
    const s = V.st[i], o = s.u - u0, t = o + s.len;
    for (const g of s.segs) segs.push([g[0] + o, g[1] + o, g[2], g[3], g[4], o]);
    for (const f of s.fins) fins.push([f[0] + o, f[1] + o, f[2], f[3], o]);
    if (s.nose) for (const g of s.nose) segs.push([g[0] + t, g[1] + t, g[2], g[3], g[4], t]);
  }
  return { segs, fins };
}

const vehicle = (P) => P.vc[P.style * 4 + P.n] || (P.vc[P.style * 4 + P.n] = build(P.style, P.n));

// The stack's foot at flight time T, and its engines.
function fly(P, V, T) {
  const sty = P.style, t = max(0, T), g = ACC[sty], E = g * 512 * (1 - exp((-t * t) / 128));
  let ai = 0, f = ss(IGN[sty], IGN[sty] + 0.6, T);
  for (const ts of V.sep) {
    if (T >= ts) ai++;
    f *= 1 - ss(ts - 0.3, ts, T) + ss(ts + 0.7, ts + 1.1, T);
  }
  const bo = V.boost && T < 7.5, S = V.st[ai], wn = bo ? 6.2 : S.wn;
  return { E, ai, f, wn, s: 1 / (1 + 0.001 * g * t * t * t), a: LEAN[sty] + 0.2 * ss(3, 16, t), x: X0 + 6 * ss(3, 20, t) + (sty === 3 ? 0.12 * min(E, 70) : 0), e: DECK + V.st[0].bell[0] + E, Lf: wn * (S.fuel === 2 ? 4.2 : 3.2) * (1 + E / 260) * f, k: 0.12 + min(0.9, E / 500) * (S.fuel === 1 ? 1.4 : 1), fuel: bo ? 0 : S.fuel };
}

// The camera's tilt in rows keeps the nose near the top, then lets the
// shrinking rocket climb.
function camera(V, T, F) {
  const d = F.E - (GY - DECK - V.st[0].bell[0] - V.L * F.s - 15 + 9 * ss(12, 23, T)), h = max(14 - abs(d), 0) / 14;
  return max(0, d) + h * h * 3.5;
}

export function setup(params) {
  const P = params, F = (n) => new Float32Array(n);
  Object.assign(P, { buf: F(N * 3), G: F(N), D: F(N * 5), pa: F(MAXP * PF), spD: F(4 * SP * SP), spS: F(4 * SP * SP), vc: {}, started: false, T: -4.3, np: 0, clk: 0, pt: null });
  // Lumpy puffs lit from above.
  for (let q = 0; q < 4 * SP * SP; q++) {
    const k = floor(q / (SP * SP)), dx = (((q % SP) + 0.5) / SP) * 2 - 1, dy = (((floor(q / SP) % SP) + 0.5) / SP) * 2 - 1;
    const d = hypot(dx, dy), an = atan2(dy, dx), edge = 0.8 + 0.1 * sin(5 * an + k * 1.7) + 0.07 * sin(9 * an + k * 2.9) + 0.04 * sin(13 * an + k);
    P.spD[q] = ss(edge, edge - 0.45, d) * (0.78 + 0.22 * sin(dx * 7 + k) * sin(dy * 6 + k * 2));
    P.spS[q] = clamp(0.55 - 0.55 * dy + 0.12 * dx + (d > edge - 0.2 && dy < 0 ? 0.25 : 0), 0, 1);
  }
  P.stars = Array.from({ length: 240 }, () => [floor(rnd() * W), 30 + rnd() * 620, 0.25 + 0.75 * rnd() ** 3]);
  P.shore = Array.from({ length: W }, (_, x) => 3 + 1.2 * sin(x * 0.7) * sin(x * 0.23 + 1) + (x % 11 < 3 ? 1.8 : 0) + (x > 52 ? 1.2 : 0));
}

function newRocket(P, T) {
  [P.T, P.np, P.pt] = [T, 0, null];
}

function emit(P, ...v) {
  if (P.np < MAXP) P.pa.set([...v.slice(0, 6), 0, ...v.slice(6), floor(rnd() * 4)], P.np++ * PF);
}

function times(n, fn) {
  for (let c = n; c > 0 && (c >= 1 || rnd() < c); c--) fn();
}

function step(P, h) {
  P.T += h;
  if (P.T > 25) return newRocket(P, -10);
  const T = P.T, V = vehicle(P), sty = P.style, F = fly(P, V, T), C = camera(V, T, F), s = F.s, sa = sin(F.a), ca = cos(F.a);
  // Before ignition liquid oxygen boils off and falls down the tanks.
  if (T < IGN[sty] + 0.4 && sty !== 3)
    for (const S of V.st)
      times(S.fuel === 2 ? 0 : h * 34, () => {
        const sd = rnd() < 0.6 ? 1 : -1;
        emit(P, F.x + sd * (S.segs.at(-1)[3] - 0.3), F.e + S.u + S.len * (0.35 + 0.6 * rnd()), sd * (0.8 + 2.5 * rnd()), -3 - 5 * rnd(), 0.6, 1.5, 1.4 + rnd(), 0.2, 0, 0.95, 0.4);
      });
  if (F.f > 0.02) {
    const uN = V.st[F.ai].u - V.st[F.ai].bell[0], tl = F.Lf * s * 0.85, tx = F.x + sa * (uN * s - tl), tz = F.e + ca * (uN * s - tl), fu = FUEL[F.fuel];
    // Steam rolls out of the trench both ways and up round the rocket.
    if (tz < 24 && F.E < 40)
      times(55 * STEAM[sty] * (0.25 + 0.35 * P.n) * F.f * (1 - F.E / 40) * h, () => {
        const sd = rnd() < 0.5 ? -1 : 1;
        if (rnd() < 0.72) emit(P, X0 + sd * (8 + 2 * rnd()), 1 + rnd() * 2, sd * (18 + 34 * rnd()) * (0.6 + 0.4 * F.f), 3 + 9 * rnd(), 2.2, 3.6 + 2 * rnd(), 16, 0.5, 0.7, 0.95, 0.55);
        else emit(P, X0 + sd * rnd() * 7, DECK + rnd() * 3, sd * 4 * rnd(), 10 + 16 * rnd(), 2, 2.8, 12, 0.45, 0.9, 0.95, 0.9);
      });
    // The trail, laid along the path since the last step.
    if (T > 0 && tz > DECK + 6) {
      const [px, pz] = P.pt || [tx, tz], r0 = max(0.6, F.wn * s * 1.05), hi = P.tw * ss(140, 300, tz);
      const cnt = min(14, ceil(max(hypot(tx - px, tz - pz) / max(0.6, r0 * 0.6), h * 24)));
      for (let j = 1; j <= cnt; j++) emit(P, px + ((tx - px) * j) / cnt + (rnd() - 0.5) * r0, pz + ((tz - pz) * j) / cnt, (rnd() - 0.5) * 2 * s, -1.5 * s, r0, (1.1 + 1.8 * hi) * sqrt(s + 0.08) * 2, 30, fu[5] * (0.75 + 0.25 * rnd()) * (1 - 0.4 * hi), 1, fu[4], 0.05);
      P.pt = [tx, tz];
    }
  } else P.pt = null;
  // Puffs spread, rise and thin, and go once below the panel.
  const pa = P.pa;
  for (let i = 0; i < P.np; i++) {
    const o = i * PF, dr = exp(-pa[o + 11] * h);
    pa[o + 6] += h;
    pa[o + 2] *= dr;
    pa[o + 3] = pa[o + 3] * dr + (pa[o + 11] > 0.3 ? 2 * h : 0);
    pa[o] += (pa[o + 2] + 1.2 + pa[o + 1] * 0.012) * h;
    pa[o + 1] += pa[o + 3] * h;
    if (pa[o + 6] > pa[o + 7] || GY + C - pa[o + 1] - pa[o + 4] - pa[o + 5] * sqrt(pa[o + 6]) > 130 || abs(pa[o] - 32) > 62) {
      pa.copyWithin(o, --P.np * PF, P.np * PF + PF);
      i--;
    }
  }
}

export function update(dt, input, params) {
  const P = params, k = input.knobValues || [0, 2, 1, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.style = clamp(round(k[0]), 0, 3);
  P.n = clamp(round(k[2]), 1, 3);
  P.tod = clamp(k[3], 0, 1);
  // The hour's colours; the sun lingers low at dawn and dusk.
  const f = P.tod * 3, i = min(2, floor(f)), q = f - i, A = PAL[i], B = PAL[i + 1];
  P.pal = A.map((v, j) => v + (B[j] - v) * q);
  P.se = A[23] + (B[23] - A[23]) * (i === 0 ? q * q : i === 1 ? 1 - (1 - q) ** 2 : q);
  [P.sunI, P.tw, P.lights, P.night] = [P.pal[18], P.pal[19], P.pal[20], ss(0.67, 1, P.tod)];
  if (!P.started) {
    P.started = true;
    // Open 2.3 s before liftoff, with the tanks already venting.
    for (let j = 0; j < 20; j++) step(P, 0.1);
  }
  if (input.btnPressed && input.btnPressed[0]) {
    if (P.T < IGN[P.style] - 0.3) P.T = IGN[P.style] - 0.3;
    else if (P.T > 2) newRocket(P, -3);
  }
  P.clk += dt;
  step(P, (dt * clamp(k[1], 0.2, 3)) / 2);
}

// Lights a surface facing vn across a cylinder, laid over the LED.
function shade(P, p, vn, fl, r, g, b, a) {
  const c = P.pal, o = p * 3, buf = P.buf, sn = P.sunK * max(0, 0.25 + 0.75 * vn * P.side), am = 1 - 0.28 * vn * vn, fr = 235 * fl * (1 - 0.35 * vn * vn);
  [r, g, b].forEach((k, j) => (buf[o + j] += (k * (c[12 + j] * am + c[15 + j] * sn + fr + P.G[p] * P.gc[j]) - buf[o + j]) * a));
}

// Patterned paints: moon rocket stages 1 and 3, V-2 quarters, bands,
// grey-green, truss.
function albedo(c, u, vn) {
  if (c === 6) c = (u > 0.5 && u < 7 && vn > -0.1 && vn < 0.5) || (u > 15.5 && u < 17) ? 1 : 0;
  else if (c === 7) c = u > 5 && u < 8.5 && vn > 0.05 ? 1 : 0;
  else if (c === 8) c = (floor(u / 6.5) + (vn > 0)) & 1;
  else if (c === 9) c = u % 7 < 1.4 ? 5 : 0;
  else if (c > 9) c = c === 10 ? 4 : (floor(u * 1.5) + floor((vn + 1) * 2.5)) & 1 ? 1 : 3;
  return PAINT[c];
}

// One body from its foot at (b.x, b.y), leaning b.ang, at scale b.sc.
function body(P, b) {
  const sa = sin(b.ang), ca = cos(b.ang), sc = b.sc, fl = b.flame, buf = P.buf;
  let u0 = 0, u1 = 0, hm = 0;
  for (const g of b.segs) [u0, u1, hm] = [min(u0, g[0]), max(u1, g[1]), max(hm, g[2], g[3])];
  hm += b.fins.length ? 3.5 : 0;
  const fu = u0;
  if (fl) [u0, hm] = [u0 - fl.Lf * 3.2, max(hm + 5, fl.wn + (fl.k + 0.12) * fl.Lf * 3.2 + 1)];
  const m = (u0 + u1) / 2, cx = b.x + m * sa * sc, cy = b.y - m * ca * sc, R = hypot((u1 - u0) / 2, hm) * sc + 2;
  const fc = fl && FUEL[fl.fuel], flood = P.lights * 0.9 * exp(-b.E / 45);
  for (let y = max(0, floor(cy - R)); y <= min(H - 1, ceil(cy + R)); y++)
    for (let x = max(0, floor(cx - R)); x <= min(W - 1, ceil(cx + R)); x++) {
      const dx = x + 0.5 - b.x, dy = b.y - (y + 0.5), p = y * W + x;
      const u = (dx * sa + dy * ca) / sc, v = (dx * ca - dy * sa) / sc, av = abs(v);
      let seg = null;
      for (const g of b.segs) if (u >= g[0] && u < g[1]) seg = g;
      if (seg) {
        const hw = seg[2] + ((seg[3] - seg[2]) * (u - seg[0])) / (seg[1] - seg[0]);
        let cov = clamp((hw - av) * sc + 0.5, 0, 1), vn = clamp(v / max(0.3, hw), -1, 1), c = seg[4], uu = u - seg[5];
        if (cov <= 0)
          for (const f of b.fins)
            if (u >= f[0] && u < f[1]) {
              const cf = clamp((hw + f[2] * (1 - (u - f[0]) / (f[1] - f[0])) - av) * sc + 0.5, 0, 1);
              if (cf > cov) [cov, vn, c, uu] = [cf, v > 0 ? 0.6 : -0.6, f[3], u - f[4]];
            }
        const A = albedo(c, uu, vn), hc = hw + 0.6 + (b.uq + 0.5 - u) * 0.6;
        if (cov > 0) shade(P, p, vn, flood, A[0], A[1], A[2], cov * b.al);
        // Max-Q: a collar of condensation round the body.
        else if (b.q > 0 && u > b.uq - 7 && u < b.uq + 0.5 && av < hc) shade(P, p, v / hc, 0.4, 1, 1, 1, b.q * 0.95 * ss(0, 1.2, b.uq + 0.5 - u) * (1 - (av / hc) ** 3) * (0.75 + 0.25 * sin(u * 3 + P.clk * 40)));
        continue;
      }
      // The flame, clipped where it meets the deck.
      if (!fl || u >= fu || GY + P.Ci - y - 0.5 < DECK + 0.5) continue;
      const ue = fu - u, q = av / (fl.wn * 0.85 + (fl.k + 0.12) * ue);
      if (q >= 1.2) continue;
      const I = (exp(-ue / fl.Lf) * max(0, 1 - q * q) * (fl.fuel === 0 && b.E < 140 ? 0.8 + 0.3 * cos((ue * 2.4) / fl.wn) : 1) * fl.f) / (1 + fl.k * 1.2);
      const core = exp(-ue / (fl.Lf * 0.35)) * max(0, 1 - q * 1.7) * fl.f;
      const tt = min(1, I * 0.9 + core) * 2, br = min(1.2, I * 1.7 + core), A = fc[tt < 1 ? 2 : 1], B = fc[tt < 1 ? 1 : 0], w = tt < 1 ? tt : tt - 1;
      for (let j = 0; j < 3; j++) buf[p * 3 + j] += (A[j] + (B[j] - A[j]) * w) * br;
    }
}

// The cluster's boosters; at 7.5 s the side ones pivot out and fall.
function boosters(P, V, T, F, sides) {
  const dt = T - 7.5, sep = dt > 0, S0 = sep ? fly(P, V, 7.5) : F;
  if (dt > 5) return;
  const drop = sep ? ((fly(P, V, 7.55).E - S0.E) / 0.05) * 1.1 * (1 - exp(-dt / 1.1)) : 0;
  for (const sd of sides) {
    const off = sd * 3.7 * S0.s;
    body(P, { segs: BOOST, fins: [], x: S0.x + cos(S0.a) * off + (sep ? sd * 2 * dt : 0), y: GY + P.Ci - S0.e - drop + sin(S0.a) * off, ang: S0.a + sd * (sep ? 0.35 + 0.9 * dt : -0.05), sc: S0.s / (1 + (sep ? 0.06 * dt : 0)), al: 1 - ss(3, 5, max(0, dt)), E: sep ? 300 : F.E });
  }
}

function sky(P) {
  const c = P.pal, buf = P.buf, Ci = P.Ci, sx = c[22], se = P.se, sr = c[24], sunA = 1 - P.night, sk = [0, 0, 0], bi = P.lights * (0.25 + 0.75 * P.night) * 55;
  for (let y = 0; y < H; y++) {
    const a = GY + Ci - y - 6, e = a + 6, gl = sunA * 0.55 * exp(-abs(e - se) / 26);
    const [A, B, q] = a < 22 ? [0, 3, max(0, a) / 22] : a < 100 ? [3, 6, (a - 22) / 78] : a < 240 ? [6, 9, (a - 100) / 140] : [9, -1, min(1, (a - 240) / 180)];
    for (let j = 0; j < 3; j++) sk[j] = c[A + j] + ((B < 0 ? 0 : c[B + j]) - c[A + j]) * q;
    // The sun's glow and disc, and searchlights from the pad.
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, dx = x + 0.5 - sx, g = gl * exp(-(dx * dx) / 420), disc = sr > 0 ? sunA * clamp(sr - hypot(dx, e - se) + 0.5, 0, 1) : 0;
      let v = 0;
      if (bi > 1 && e > 0)
        for (const [bx, sn, cs] of BEAMS) {
          const d = x + 0.5 - bx, al = d * sn + e * cs, pp = d * cs - e * sn, w = 1.2 + al * 0.035;
          v += (bi * exp(-(pp * pp) / (w * w))) / (1 + al / 160);
        }
      for (let j = 0; j < 3; j++) buf[o + j] = sk[j] + c[15 + j] * g + (c[15 + j] * 0.8 + 50) * disc + v * [0.75, 0.82, 1][j];
    }
  }
  // Stars come out as the sky darkens.
  P.stars.forEach(([x, e, m], i) => {
    const y = GY + Ci - floor(e), v = m * (c[21] + (1 - c[21]) * ss(250, 420, e)) * (0.8 + 0.2 * sin(P.clk * 3 + i)) * 235, o = (y * W + x) * 3;
    if (y >= 0 && y < H) for (let j = 0; j < 3; j++) buf[o + j] += v * (j > 1 ? 1 : 0.9);
  });
}

// A lit beam between two points, in rows above the shoreline.
function line(P, x0, e0, x1, e1, w, r, g, b, fl) {
  const Ci = P.Ci, dx = x1 - x0, de = e1 - e0, l2 = dx * dx + de * de || 1;
  for (let y = max(0, floor(GY + Ci - max(e0, e1) - w)); y <= min(H - 1, ceil(GY + Ci - min(e0, e1) + w)); y++)
    for (let x = max(0, floor(min(x0, x1) - w)); x <= min(W - 1, ceil(max(x0, x1) + w)); x++) {
      const px = x + 0.5 - x0, pe = GY + Ci - y - 0.5 - e0, t = clamp((px * dx + pe * de) / l2, 0, 1), a = clamp(w * 0.5 - hypot(px - dx * t, pe - de * t) + 0.5, 0, 1);
      if (a > 0) shade(P, y * W + x, 0, fl, r, g, b, a);
    }
}

// Shore, pad, the moon rocket's tower and arms, the sounding rocket's rail.
function pad(P, V, T) {
  const Ci = P.Ci, sty = P.style, tl = P.lights * 0.5, th = DECK + V.L + 6, tx0 = X0 - 19, tx1 = X0 - 10, buf = P.buf;
  for (let y = max(0, GY + Ci - 90); y <= min(H - 1, GY + Ci); y++) {
    const e = GY + Ci - y;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, k = e === 4 ? 0.62 : 0.45, q = 0.2 + ((x * 7 + e * 3) % 5) * 0.012, i = x - tx0, j = e % 9;
      if (e <= 4 && abs(x + 0.5 - X0) < 11 - e * 1.2) shade(P, p, (x + 0.5 - X0) / 14, tl, k, k, k, 1);
      else if (e <= P.shore[x]) shade(P, p, 0, 0, q * 0.9, q, q * 0.8, 1);
      else if (e <= 6) for (let j = 0; j < 3; j++) buf[p * 3 + j] = P.pal[j] * 0.55 + buf[p * 3 + j] * 0.2;
      // The tower: an X-braced lattice with a hammerhead crane on top.
      if (sty || e <= 0) continue;
      if ((i >= 0 && x <= tx1 && e <= th && (i === 0 || i === 9 || j === 0 || i === j || i === 9 - j)) || (e >= th && e <= th + 1 && i >= -2 && x <= X0 + 2) || (e > th + 1 && e <= th + 3 && i >= 2 && i <= 5)) shade(P, p, i / 9 - 0.5, tl, 0.52, 0.54, 0.6, 1);
      if (e === th + 4 && (i === 3 || x === X0 + 2) && sin(P.clk * 5) > 0) buf.set([255, 40, 30], p * 3);
    }
  }
  // Swing arms to the stage joints and the capsule; the crew arm leaves first.
  if (sty === 0)
    V.st.map((s) => s.u + s.len - 1.5).concat([V.L - 11]).forEach((u, i, lv) => {
      const t0 = i === lv.length - 1 ? -6 : 0.1 + i * 0.25, reach = (X0 - 4.3 - tx1) * (1 - ss(t0, t0 + 1.4, T));
      if (reach > 0.3) line(P, tx1 + 0.5, DECK + 2.5 + u, tx1 + 0.5 + reach, DECK + 2.5 + u, 1.8, 0.5, 0.52, 0.58, tl);
    });
  if (sty === 3) line(P, X0 - 2.2, DECK, X0 - 2.2 + sin(LEAN[3]) * V.L * 0.8, DECK + cos(LEAN[3]) * V.L * 0.8, 1.8, 0.55, 0.55, 0.6, tl);
}

// Puffs add density, shading, heat, sunlight and whiteness; then the smoke
// is lit.
function smoke(P) {
  const { D, spD, spS, buf, G, gc, pa, Ci, pal: c } = P;
  D.fill(0);
  for (let i = 0; i < P.np; i++) {
    const o = i * PF, ag = pa[o + 6], r = max(0.9, min(16, pa[o + 4] + pa[o + 5] * sqrt(ag))), cx = pa[o], cy = GY + Ci - pa[o + 1], life = pa[o + 7];
    const a = (pa[o + 8] * min(1, ag * 12) * (1 - ss(life * 0.4, life, ag)) * 2) / (1 + r * 0.08);
    const L = [0, pa[o + 9] * exp(-ag / 0.3), min(1, P.sunI + P.tw * ss(140, 300, pa[o + 1])), pa[o + 10]], k = pa[o + 12] * SP * SP;
    for (let y = max(0, ceil(cy - r - 0.5)); y <= min(H - 1, floor(cy + r - 0.5)); y++)
      for (let x = max(0, ceil(cx - r - 0.5)); x <= min(W - 1, floor(cx + r - 0.5)); x++) {
        const sx = floor(((x + 0.5 - cx) / r) * 0.5 * SP + SP / 2), sy = floor(((y + 0.5 - cy) / r) * 0.5 * SP + SP / 2), q = k + sy * SP + sx, d = spD[q] * a;
        if (sx < 0 || sx >= SP || sy < 0 || sy >= SP || d <= 0.001) continue;
        const p = (y * W + x) * 5;
        D[p] += d;
        D[p + 1] += d * spS[q];
        for (let j = 1; j < 4; j++) D[p + j + 1] += d * L[j];
      }
  }
  for (let p = 0; p < N; p++) {
    const d = D[p * 5];
    if (d < 0.004) continue;
    const sh = D[p * 5 + 1] / d, he = min(1.4, D[p * 5 + 2] / d), sn = (D[p * 5 + 3] / d) * (0.3 + 0.8 * sh) * (0.6 + 0.4 * P.sunI), ab = D[p * 5 + 4] / d;
    const al = 1 - exp(-1.7 * d), am = 0.5 + 0.55 * sh, fl = P.lights * 75 * exp(-max(0, GY + Ci - ((p / W) | 0)) / 60), g = G[p] * 1.25;
    for (let j = 0; j < 3; j++) buf[p * 3 + j] += (ab * (c[12 + j] * am + c[15 + j] * sn + fl + g * gc[j]) + he * gc[j] * 0.9 - buf[p * 3 + j]) * al;
  }
}

export function draw(display, params) {
  const P = params, V = vehicle(P), T = P.T, buf = P.buf, c = P.pal, G = P.G;
  const F = fly(P, V, T), Ci = (P.Ci = round(camera(V, T, F))), s = F.s, sa = sin(F.a), ca = cos(F.a), fu = FUEL[F.fuel];
  P.side = clamp((c[22] - X0) / 25, -1, 1);
  P.sunK = P.sunI + P.tw * 0.7 * ss(60, 260, F.E);
  // The engines' glow.
  const uo = V.st[F.ai].u, uN = uo - V.st[F.ai].bell[0], nx = F.x + sa * uN * s, ny = GY + Ci - F.e - ca * uN * s, gx = nx - sa * F.Lf * s * 0.4, gy = ny + ca * F.Lf * s * 0.4;
  const flick = 0.85 + 0.15 * sin(P.clk * 31) * sin(P.clk * 17.3 + 1), near = 1 - ss(10, 60, F.E);
  const gr = ((6 + 8 * F.wn * s) * (1 + 1.6 * near)) ** 2, gi = F.f * flick * (F.fuel === 1 ? 0.35 : 1) * (0.55 + 0.6 * near) * (F.ai ? 1 : 0.5 + 0.25 * P.n) * (0.7 + 0.5 * P.night);
  P.gc = fu[3];
  for (let p = 0; p < N; p++) G[p] = gi > 0.01 ? (gi * gr) / (gr + ((p % W) + 0.5 - gx) ** 2 + (((p / W) | 0) + 0.5 - gy) ** 2) : 0;
  sky(P);
  pad(P, V, T);
  // Spent stages fall behind and tumble.
  V.sep.forEach((ts, i) => {
    const dt = T - ts, S0 = fly(P, V, ts), u = V.st[i].u * S0.s;
    if (dt > 0 && dt < 5) body(P, { ...stack(V, i, i + 1), x: S0.x + sin(S0.a) * u + 2 * dt, y: GY + Ci - S0.e - cos(S0.a) * u - ((fly(P, V, ts + 0.05).E - S0.E) / 0.05) * 1.1 * (1 - exp(-dt / 1.1)), ang: S0.a + 0.45 * dt, sc: S0.s / (1 + 0.06 * dt), al: 1 - ss(3, 5, dt), E: 300 });
  });
  if (V.boost) boosters(P, V, T, F, [-1, 1]);
  // The rocket from its lowest burning stage up.
  body(P, { ...stack(V, F.ai, V.n), x: F.x + sa * uo * s, y: GY + Ci - F.e - ca * uo * s, ang: F.a, sc: s, al: 1, E: F.E, q: ss(6.2, 6.7, T) * (1 - ss(7.6, 8.3, T)), uq: (V.L - uo) * 0.5, flame: { wn: F.wn, Lf: max(0.01, F.Lf * flick), k: F.k, f: F.f, fuel: F.fuel } });
  if (V.boost) boosters(P, V, T, F, [0]);
  // Far off, the flame is a bright point.
  if (s * F.wn < 1.4 && F.f > 0.05)
    for (let p = 0; p < N; p++) {
      const a = 1.1 * F.f * exp(-(((p % W) + 0.5 - nx) ** 2 + (((p / W) | 0) + 0.5 - ny) ** 2) / (0.9 + 0.5 * s * F.wn) ** 2);
      for (let j = 0; j < 3; j++) buf[p * 3 + j] += fu[1][j] * a;
    }
  smoke(P);
  // The water in front mirrors everything above the shoreline.
  for (let y = max(0, GY + Ci); y < H; y++) {
    const sy = clamp(2 * (GY + Ci) - 1 - y, 0, H - 1);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, so = (sy * W + x) * 3, rp = 0.5 + 0.1 * sin(y * 2.1 + x * 0.3 - P.clk * 3);
      for (let k = 0; k < 3; k++) buf[o + k] = buf[so + k] * rp + c[k] * 0.12 + G[y * W + x] * P.gc[k] * 0.25;
    }
  }
  // The clock.
  const tc = T < 0 ? ceil(-T) : floor(T);
  [10, T < 0 ? 11 : 12, floor(tc / 10) % 10, tc % 10].forEach((ch, i) => {
    for (let r = 0; r < 15; r++) if ((FONT[ch] >> (14 - r)) & 1) buf.set([255, 196, 70], ((2 + floor(r / 3)) * W + 2 + i * 4 + (r % 3)) * 3);
  });
  const fade = ss(-10, -9.3, T) * (1 - ss(23.8, 25, T));
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, buf[o] * fade), min(255, buf[o + 1] * fade), min(255, buf[o + 2] * fade));
}
