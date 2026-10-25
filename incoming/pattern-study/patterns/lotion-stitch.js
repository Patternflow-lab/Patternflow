// ===== Patternflow pattern =====
// Title:   Lotion Stitch
// Family:  cosmetic
// Idea:    Seen from above, a glossy rope of lotion falls onto a belt that carries it down the panel, and the belt's speed decides what it stitches: translated coils, alternating loops, W-shaped cusps, meanders or a straight line, each repeating at a pitch of belt speed over the frequency at which the landing point turns.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: fluid mechanical sewing machine (Sunny Chiu-Webster and John Lister, 2006), pattern round 40
// Round:   40
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Belt=0.2..1.2, Thick=0..1
//
// Knob 1: Hue. The lotion's colour, once round the wheel, on a near black belt. At 0 lilac, 0.1 pink, 0.2 coral, 0.3 peach, 0.35 butter, 0.4 lemon, 0.45 pale lime, 0.5 light green, 0.6 mint, 0.7 aqua, 0.8 sky blue, 0.9 periwinkle. From orange to lime the side of the rope away from the light is lifted to 0.72 and paled, and orange's leans to rose, so nothing reads brown or olive.
// Knob 2: Speed. The clock. At 2 the thread lands at V = 36 LEDs a second; at Belt 0.2 the belt runs 7.2 LEDs a second, the landing point turns 0.51 times a second and a stitch takes 15 s to ride from the landing to the bottom edge. At 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Belt. Belt speed U over the speed U_c = V at which the thread lands, which is the steady coil's radius times its coiling frequency. Below 0.42 translated coils, pitch 14.2 LEDs at 0.2 and 29.3 at 0.4; from 0.42 to 0.79 alternating loops, large at first and shrinking as the belt speeds up; near 0.8 the turns sharpen into cusps, the W shapes; from 0.82 to 1 meanders, their swing growing from nothing as the belt slows below U_c; at 1 and over the belt drags a straight line, thinner by the square root of U / V.
// Knob 4: Thick. A thicker lotion coils wider and slower: the coil radius goes from 11 to 14 LEDs and the coiling frequency from 0.51 to 0.41 turns a second, the fresh rope from 4 to 7 LEDs wide. U_c does not change, so neither do the boundaries on Belt. Laid lotion slumps, widening by a third and flattening over about 4 s.

const W = 64, H = 128, N = W * H;
// The thread falls on the axis at (XL, YL) and lands at speed V, in LEDs a
// second at Speed 2.
const XL = 31.5, YL = 17, V = 36;
// Samples laid per second of the model's time, and the ring that holds them.
const LAY = 120, CAP = 4096;
const { floor, ceil, min, max, sqrt, exp, sin, cos, round, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// The kinematic model. The contact point hangs rho from the axis at angle a
// from straight downstream: (x, y) = rho (sin a, cos a). The thread lands
// without slipping, so the curve laid on the belt grows by V a second; that
// fixes how far the contact must swing, or how fast it must turn, for a
// belt speed U = e V below U_c = V.
//   e >= 1      the belt drags the thread straight, laying at U, not V
//   e < 1       the contact swings like a pendulum, a = A sin p, p turning at
//               w = Om (0.6 + 0.4 sm(0.4, 0.9, e)), from the coiling frequency
//               Om = V / R at onset down to 0.6 Om; rho = R (0.65 + 0.35
//               sm(0.55, ECOIL, e)). A grows from 0 as e falls below 1:
//               meanders down to e = 0.815, then the turns sharpen to cusps
//               (W shapes) until the trace first runs back along the belt at
//               e = 0.79, and below that the swing, 104 degrees and wider,
//               lays alternating loops that grow as the belt slows
//   e < ECOIL   it goes over the top: translated coiling at radius R, a
//               turning at the rate the laid length sets, within 5 percent of Om
// Every pattern repeats on the belt once a turn, so its pitch is U 2 pi / w,
// belt speed over the turning frequency; measured on the laid samples it
// matched to 0.01 LED at every belt speed from 0.2 to 0.95.
const ECOIL = 0.42;

// Mean laid speed on the belt over one turn, swinging (amp, w) at hang rho,
// or with amp < 0 turning steadily at w.
function laid(rho, amp, w, U) {
  let s = 0;
  for (let k = 0; k < 96; k++) {
    const p = ((k + 0.5) / 96) * 2 * PI;
    const a = amp < 0 ? p : amp * sin(p), ad = amp < 0 ? w : amp * w * cos(p);
    const vx = rho * ad * cos(a), vy = -rho * ad * sin(a) - U;
    s += sqrt(vx * vx + vy * vy);
  }
  return s / 96;
}

// The regime for belt speed e and coil radius R: swing amplitude A (0 for
// the straight line, -1 for coiling), rate w and hang rho.
function regime(e, R) {
  const Om = V / R, U = e * V;
  if (e >= 1) return { A: 0, w: Om, rho: R };
  if (e < ECOIL) {
    let lo = 0.2 * Om, hi = 3 * Om;
    for (let it = 0; it < 40; it++) {
      const m = 0.5 * (lo + hi);
      if (laid(R, -1, m, U) < V) lo = m;
      else hi = m;
    }
    return { A: -1, w: 0.5 * (lo + hi), rho: R };
  }
  const w = Om * (0.6 + 0.4 * sm(0.4, 0.9, e)), rho = R * (0.65 + 0.35 * sm(0.55, ECOIL, e));
  let lo = 0, hi = 2 * PI;
  for (let it = 0; it < 40; it++) {
    const m = 0.5 * (lo + hi);
    if (laid(rho, m, w, U) < V) lo = m;
    else hi = m;
  }
  return { A: 0.5 * (lo + hi), w, rho };
}

// Coil radius R and thread half-width from Thick.
const radius = (k) => 11 + 3 * k;
const half = (k) => 2 + 1.5 * k;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, e: 0.2, thick: 0.06, begun: false,
    p: 0, a: 0, ad: 0, B: 0, acc: 0, n: 0, key: "", reg: null, rot: false, amp: 0, w: 1, rho: 10, cx: XL, cy: YL,
    sx: new Float32Array(CAP), sy: new Float32Array(CAP), sw: new Float32Array(CAP),
    own: new Int32Array(N), z: new Float32Array(N), nx: new Float32Array(N), ny: new Float32Array(N), occ: new Float32Array(N),
    c: [0, 0, 0], lot: new Float32Array(64 * 3), lotHue: -1,
  };
}

// The model advances in steps of 1 / LAY of a second, and lays a sample of
// thread at the contact after each.
function step(S, dt) {
  S.acc += dt * LAY;
  while (S.acc >= 1) {
    S.acc -= 1;
    advance(S, 1 / LAY);
  }
}

function advance(S, dt) {
  const R = radius(S.thick), U = S.e * V;
  const key = S.e.toFixed(3) + "," + S.thick.toFixed(3);
  if (key !== S.key) {
    S.key = key;
    S.reg = regime(S.e, R);
  }
  const G = S.reg, g = 1 - exp(-dt / 0.5);
  S.w += (G.w - S.w) * g;
  S.rho += (G.rho - S.rho) * g;
  if (G.A < 0) {
    // Over the top: the angle runs on from wherever the swing left it.
    S.rot = true;
    S.ad = S.w;
    S.a += S.w * dt;
  } else {
    if (S.rot) {
      // Back from coiling: the swing starts again from straight downstream.
      S.rot = false;
      S.amp = 0;
      S.p = 0;
      S.a -= 2 * PI * round(S.a / (2 * PI));
    }
    S.amp += (G.A - S.amp) * g;
    S.p += S.w * dt;
    // Ease from wherever the angle was, so a change of regime does not jump.
    const prev = S.a;
    S.a += (S.amp * sin(S.p) - S.a) * min(1, dt / 0.15);
    S.ad = (S.a - prev) / dt;
  }
  S.B += U * dt;
  S.cx = XL + S.rho * sin(S.a);
  S.cy = YL + S.rho * cos(S.a);
  // The same flux spread over more length lies thinner: in the straight
  // line the belt stretches it by sqrt(U / V).
  const vx = S.rho * S.ad * cos(S.a), vy = -S.rho * S.ad * sin(S.a) - U;
  const vl = max(0.6 * V, sqrt(vx * vx + vy * vy)), i = S.n % CAP;
  S.sx[i] = S.cx;
  S.sy[i] = S.cy - S.B;
  S.sw[i] = sqrt(V / vl);
  S.n++;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.e = cl(k[2], 0.2, 1.2);
  S.thick = cl(k[3], 0, 1);
  if (!S.begun) {
    // Run the belt until the whole panel holds laid thread.
    S.reg = regime(S.e, radius(S.thick));
    S.key = S.e.toFixed(3) + "," + S.thick.toFixed(3);
    S.amp = max(0, S.reg.A);
    S.w = S.reg.w;
    S.rho = S.reg.rho;
    const T = (H - YL + 16) / (S.e * V);
    step(S, T);
    S.begun = true;
  }
  step(S, (d * S.speed) / 2);
}

// Light from the upper left and a little in front; the viewer straight above.
const LX = -0.45, LY = -0.55, LZ = 0.7;
const LN = sqrt(LX * LX + LY * LY + LZ * LZ), Lx = LX / LN, Ly = LY / LN, Lz = LZ / LN;
const HN = sqrt(Lx * Lx + Ly * Ly + (Lz + 1) ** 2), Hx = Lx / HN, Hy = Ly / HN, Hz = (Lz + 1) / HN;
// Opening hue: lilac.
const H0 = 0.78;

// The lotion's colour by how much light a point of the rope faces, a LUT
// rebuilt when Hue turns. Lotion scatters light inside, so even the side
// away from the light keeps half its brightness. Orange and yellow still go
// brown or olive there: across that part of the wheel the shaded side is
// lifted to 0.72 and paled, and orange's leans to rose.
function lotion(S) {
  const c = S.c;
  let h = S.hue + H0;
  h -= floor(h);
  const warm = cl(h / 0.04, 0, 1) * cl((0.3 - h) / 0.06, 0, 1), red = cl((0.12 - h) / 0.06, 0, 1);
  for (let k = 0; k < 64; k++) {
    const q = k / 63, lo = 1 - q;
    const v = 0.5 + 0.22 * warm + (0.5 - 0.22 * warm) * q;
    hsv(h - 0.06 * warm * red * lo, (0.5 - 0.15 * q) * (1 - 0.3 * warm * lo), v, c);
    S.lot[k * 3] = c[0];
    S.lot[k * 3 + 1] = c[1];
    S.lot[k * 3 + 2] = c[2];
  }
  S.lotHue = S.hue;
}

// One capsule of thread, a to b with half-width r, into the layer buffers.
// A strand laid more than K samples later lies on top and shades the edge
// of what it crosses; within K it is the same strand and the ridge wins.
// fl < 1 flattens the rope's cross-section, so its sides tilt less.
function capsule(S, n, K, ax, ay, bx, by, r, fl) {
  const { own, z, nx, ny, occ } = S;
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1e-9, rr = r + 1.3, R2 = rr * rr, r2 = r * r;
  const x0 = max(0, floor(min(ax, bx) - rr)), x1 = min(W - 1, ceil(max(ax, bx) + rr));
  const y0 = max(0, floor(min(ay, by) - rr)), y1 = min(H - 1, ceil(max(ay, by) + rr));
  for (let py = y0; py <= y1; py++)
    for (let px = x0; px <= x1; px++) {
      let u = ((px - ax) * ex + (py - ay) * ey) / l2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const dx = px - ax - u * ex, dy = py - ay - u * ey, d2 = dx * dx + dy * dy;
      if (d2 >= R2) continue;
      const p = py * W + px, o = own[p];
      if (d2 < r2) {
        const zz = sqrt(1 - d2 / r2);
        if (o < n - K || zz > z[p]) {
          if (o < n - K) occ[p] = 0;
          own[p] = n;
          z[p] = zz;
          nx[p] = (fl * dx) / r;
          ny[p] = (fl * dy) / r;
        }
      } else if (o < n - K) {
        const a = 1 - (sqrt(d2) - r) / 1.3;
        if (a > occ[p]) occ[p] = a;
      }
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.lotHue !== S.hue) lotion(S);
  const { own, z, nx, ny, occ, sx, sy, sw } = S;
  own.fill(-1);
  occ.fill(0);
  const r0 = half(S.thick), K = ceil((5 * r0 * LAY) / V) + 2;
  const first = max(1, S.n - CAP + 1);
  for (let n = first; n < S.n; n++) {
    const i = n % CAP, j = (n - 1) % CAP, y = sy[i] + S.B;
    if (y < -8 || y > H + 8) continue;
    // Laid lotion slumps: over about four seconds the rope widens by a third
    // and flattens, so older stitching is softer and less glossy.
    const sl = 1 - exp(-(S.n - n) / (4 * LAY));
    capsule(S, n, K, sx[j], sy[j] + S.B, sx[i], y, r0 * sw[i] * (1 + 0.33 * sl), 1 - 0.45 * sl);
  }

  const lot = S.lot;
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const p = py * W + px;
      let r, g, b;
      if (own[p] >= 0) {
        const zz = z[p], nn = 1 / sqrt(nx[p] * nx[p] + ny[p] * ny[p] + zz * zz), ax = nx[p] * nn, ay = ny[p] * nn, az = zz * nn;
        const dif = max(0, ax * Lx + ay * Ly + az * Lz), sp = max(0, ax * Hx + ay * Hy + az * Hz) ** 28;
        const q = round(cl(0.15 + 0.85 * dif, 0, 1) * 63) * 3, sh = 1 - 0.5 * occ[p];
        r = (lot[q] * sh + 0.85 * sp) * 255;
        g = (lot[q + 1] * sh + 0.85 * sp) * 255;
        b = (lot[q + 2] * sh + 0.85 * sp) * 255;
      } else {
        // The belt: a dark cloth with faint ribs that ride down with it.
        const rib = 0.5 + 0.5 * sin(((py - S.B) * 2 * PI) / 5);
        const v = (12 + 8 * rib * rib) * (1 - 0.6 * occ[p]);
        r = v;
        g = v;
        b = v * 1.25;
      }
      // Where the thread lands it is fresh and wet: a glint just to the
      // light side of the contact.
      const gx = px - S.cx + 0.5, gy = py - S.cy + 0.6, gl = 0.95 * exp(-(gx * gx + gy * gy) / (0.55 * r0 * r0));
      r += (255 - r) * gl;
      g += (255 - g) * gl;
      b += (255 - b) * gl;
      display.setPixel(px, py, round(min(255, r)), round(min(255, g)), round(min(255, b)));
    }
}
