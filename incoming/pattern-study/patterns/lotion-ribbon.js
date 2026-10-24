// ===== Patternflow pattern =====
// Title:   Lotion Ribbon
// Family:  cosmetic
// Idea:    A thick glossy ribbon of lotion pours from above the top edge in a steady stream that thins as it falls, coils where it lands and lays loop on loop onto a heap that slumps and spreads across the counter, the shine running down the rope and over the folds, until the stream breaks off, its tail falls in, the heap sinks away and a fresh pour begins.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 36, after the slow pour of body lotion in skincare films; the coiling follows liquid rope coiling (Neil Ribe, 2004) and the heap spreads as a viscous gravity current (Herbert Huppert, 1982)
// Round:   36
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Thick=-1..1, Gloss=-1..1
//
// Knob 1: Hue. Turns the lotion and the deep wall behind it round the whole wheel together. At 0 pink lotion on plum; at 0.1 salmon on wine; at 0.2 cream and at 0.3 lemon, both on near black; at 0.45 pistachio on green; at 0.6 aqua on teal; at 0.7 powder blue on navy; at 0.8 periwinkle on indigo; at 0.9 orchid on plum. From 0.1 to 0.42 the lotion is paled and the wall taken down almost to black, so nothing reads brown or olive.
// Knob 2: Speed. At 2 the lotion leaves the top edge at 14 LEDs a second and lands at about 47, coiling about once a second; the spout runs 16 seconds, the broken tail takes 4 seconds to fall in and the next pour lands 5 seconds after that, about 21 seconds in all. At 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Thick. How heavy the lotion is. At 0 the rope is 11 LEDs wide at the top and 6 where it lands, coiling in loops 16 LEDs across that hold their folds about 3 seconds; at -1 a runny serum 9 wide, coiling 1.5 times a second in loops 10 across that melt in 2 seconds into a heap that spreads four times as fast; at 1 a rich body butter 14 wide, coiling 0.6 times a second in loops 25 across that hold 4 seconds and pile up.
// Knob 4: Gloss. At -1 a satin lotion with a broad soft sheen; at 0 a white highlight about 2 LEDs wide runs down the rope and catches the top of every fold; at 1 a wet serum, a little deeper in colour, with a thin hot highlight and a bright pearly rim.
// Buttons: K1 tap breaks the stream now: its tail falls in, the heap sinks away and a fresh pour starts from the top.

const W = 64, H = 128, N = W * H;
// The counter under the heap, one cell an LED: x 0..63, z from -28 at the
// back to 36 at the front, below the bottom edge.
const GX = 64, GZ = 64, ZC = 28, NG = GX * GZ;
// The heap's bulk flows on cells two LEDs square; the fresh folds lie on the
// LED cells above it.
const BX = GX / 2, BZ = GZ / 2, NB = BX * BZ;
const { floor, ceil, min, max, sqrt, sin, cos, exp, pow, round, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const r = [v, q, p, p, t, v][i], g = [t, v, v, q, p, p][i], b = [p, p, t, v, v, q][i];
  out[0] = r;
  out[1] = g;
  out[2] = b;
}

// The camera looks down at the counter from EL radians above level. A point
// x across, Y up and z toward the eye lands on screen row FY - Y*CE + z*SE,
// and lies Y*SE + z*CE toward the eye.
const EL = 0.5, CE = cos(EL), SE = sin(EL);
const FY = 113, AX = 32;
// The spout is just above the top edge.
const YN = (FY + 4) / CE;
// Gravity and the speed the lotion leaves the spout, in LEDs and seconds at
// Speed 2, and the spout's radius at Thick 0.
const G = 8, V0 = 14, A0 = 5.6;
// Coiling rate: the gravitational regime of liquid rope coiling,
// Omega = CW * (g Q^3 / (nu a1^8))^(1/4), Q the flux, nu the viscosity and a1
// the rope's radius where it lands.
const CW = 0.144;
// The coil bends out from the stream's axis over HC coil radii of height,
// winding a quarter turn ahead of the point where it lands.
const HC = 1.5;
// Slump: the heap flows as a thin viscous layer, dh/dt = div(K h^3 grad h),
// K = KS / nu. A fresh loop holds its fold TF * nu^(1/4) seconds before it
// melts into the heap.
const KS = 3e-2, TF = 3;
// The coil does not land on one circle: its centre wanders up to EC coil
// radii off the axis, round and back about every PW seconds, so the loops
// cross and fold over each other.
const EC = 0.7, PW = 5.3;
// One pour lasts POUR seconds; after the tail lands the heap settles SETTLE
// seconds, then sinks SINK LEDs a second while the next pour falls.
const POUR = 16, SETTLE = 0.8, SINK = 5;
// Little swellings ride down the stream FB times a second, BA of the radius.
const FB = 1.1, BA = 0.05;
// Opening hue: pink, not red.
const H0 = 0.9;

// Light from the upper left and a little in front, and the eye, in world
// axes and in the camera's (x right, y up the screen, z toward the eye).
const nrm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const LW = nrm([-0.5, 0.75, 0.45]);
const VW = [0, SE, CE];
const HW = nrm([LW[0] + VW[0], LW[1] + VW[1], LW[2] + VW[2]]);
const toCam = (v) => [v[0], v[1] * CE - v[2] * SE, v[1] * SE + v[2] * CE];
const LC = toCam(LW), HCm = toCam(HW);
// A tall strip light to the left of the eye: on the falling rope it draws a
// highlight down its whole length.
const HS = nrm([-0.3, 0, 1]);

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, thick: 0, gloss: 0, warm: false,
    t: 0, phi: 0, tPour: 0,
    // top: height of the rope's upper end (YN while the spout runs); tip: its
    // lower end while a fresh pour is still falling, or -1 once it has landed.
    top: YN, topV: 0, tip: -1, tipV: 0, cut: false, gone: false, wait: 0, sinking: false,
    h: new Float32Array(NG), b: new Float32Array(NB), f: new Float32Array(NG), dh: new Float32Array(NB),
    blur: new Float32Array(NG), tmp: new Float32Array(NG), hs: new Float32Array(NG), cc: new Float32Array(NG * 3), fl: new Float32Array(NG),
    hdep: new Float32Array(N), col: new Float32Array(N * 3),
    rdep: new Float32Array(N), rcov: new Float32Array(N), rcol: new Float32Array(N * 3),
    bg: new Float32Array(N),
    lit: [0, 0, 0], dark: [0, 0, 0], wall: [0, 0, 0], pearl: [0, 0, 0], c: [0, 0, 0], up: [0, 0, 0],
    spec: new Float32Array(SPN), specKey: null,
  };
  const S = params.s;
  // A soft glow on the wall behind the stream, falling off to near black in
  // the top corners.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - AX) / 26, dy = (y - 78) / 70;
      S.bg[y * W + x] = 0.12 + 0.88 * exp(-dx * dx - dy * dy);
    }
}

// The lotion's make-up at the current Thick.
function lotion(S) {
  const nu = pow(4, S.thick), a0 = A0 * pow(1.25, S.thick);
  return { nu, a0, Q: PI * a0 * a0 * V0, K: KS / nu, tf: TF * pow(nu, 0.25) };
}

// Free fall from the spout: speed at height Y, and the radius that keeps the
// mass flux pi a^2 v the same all the way down.
const speedAt = (Y) => sqrt(V0 * V0 + 2 * G * max(0, YN - Y));
const radiusAt = (a0, Y) => a0 * sqrt(V0 / speedAt(Y));

// The heap's height under a point, bilinear.
function heightAt(S, x, z) {
  const u = cl(x - 0.5, 0, GX - 1.001), v = cl(z + ZC - 0.5, 0, GZ - 1.001);
  const i = floor(u), j = floor(v), fu = u - i, fv = v - j, h = S.h, p = j * GX + i;
  return (h[p] * (1 - fu) + h[p + 1] * fu) * (1 - fv) + (h[p + GX] * (1 - fu) + h[p + GX + 1] * fu) * fv;
}

// Where the rope lands now: the coil's radius and rate and the surface under it.
function coil(S, L) {
  const R0 = 8;
  // The surface a little ahead of the contact, where the rope is about to lie.
  let Yc = heightAt(S, AX + R0 * cos(S.phi + 0.3), R0 * sin(S.phi + 0.3));
  const U1 = speedAt(Yc), a1 = radiusAt(L.a0, Yc);
  const om = CW * pow((G * L.Q * L.Q * L.Q) / (L.nu * pow(a1, 8)), 0.25);
  const R = U1 / om, ps = (2 * PI * S.t) / PW, e = EC * R * (0.6 + 0.4 * sin(ps * 0.37 + 1));
  const cx = AX + e * cos(ps), cz = e * sin(ps * 1.3);
  Yc = heightAt(S, cx + R * cos(S.phi + a1 / R), cz + R * sin(S.phi + a1 / R));
  return { Yc, U1, a1, om, R, cx, cz };
}

// Lay a short piece of rope at (x, z): its volume pi a^2 ds spread over the
// cells under it, heaped in the middle.
function deposit(S, x, z, a, ds) {
  const h = S.f, vol = PI * a * a * ds;
  const i0 = max(0, floor(x - a - 0.5)), i1 = min(GX - 1, ceil(x + a - 0.5));
  const j0 = max(0, floor(z + ZC - a - 0.5)), j1 = min(GZ - 1, ceil(z + ZC + a - 0.5));
  let sum = 0;
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const dx = i + 0.5 - x, dz = j + 0.5 - ZC - z, q = 1 - (dx * dx + dz * dz) / (a * a);
      if (q > 0) sum += q;
    }
  if (sum <= 0) return;
  const k = vol / sum;
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const dx = i + 0.5 - x, dz = j + 0.5 - ZC - z, q = 1 - (dx * dx + dz * dz) / (a * a);
      if (q > 0) h[j * GX + i] += k * q;
    }
}

// The heap flows: flux K h^3 times the slope across every face between two
// bulk cells, none out through the counter's edges, so no lotion is lost.
function slump(S, L, dt) {
  const h = S.b, d = S.dh, k = L.K / 4;
  let left = dt;
  while (left > 1e-6) {
    let hm = 0;
    for (let p = 0; p < NB; p++) if (h[p] > hm) hm = h[p];
    const st = min(left, 0.2 / (k * hm * hm * hm + 1e-6));
    d.fill(0);
    for (let j = 0; j < BZ; j++)
      for (let i = 0; i < BX; i++) {
        const p = j * BX + i, a = h[p];
        if (i < BX - 1) {
          const b = h[p + 1], m = (a + b) * 0.5, f = k * m * m * m * (a - b);
          d[p] -= f;
          d[p + 1] += f;
        }
        if (j < BZ - 1) {
          const b = h[p + BX], m = (a + b) * 0.5, f = k * m * m * m * (a - b);
          d[p] -= f;
          d[p + BX] += f;
        }
      }
    for (let p = 0; p < NB; p++) h[p] = max(0, h[p] + d[p] * st);
    left -= st;
  }
}

// The bulk under an LED cell, bilinear between bulk cell centres.
function bulkAt(b, i, j) {
  const u = cl(i * 0.5 - 0.25, 0, BX - 1.001), v = cl(j * 0.5 - 0.25, 0, BZ - 1.001);
  const I = floor(u), J = floor(v), fu = u - I, fv = v - J, p = J * BX + I;
  return (b[p] * (1 - fu) + b[p + 1] * fu) * (1 - fv) + (b[p + BX] * (1 - fu) + b[p + BX + 1] * fu) * fv;
}

function breakStream(S) {
  if (S.cut || S.gone || S.tip >= 0) return;
  S.cut = true;
  S.topV = V0;
}

function step(S, dt) {
  const L = lotion(S);
  S.t += dt;
  const C = coil(S, L);
  // A fresh pour falls until its front reaches the heap.
  if (S.tip >= 0) {
    S.tipV += G * dt;
    S.tip -= S.tipV * dt;
    if (S.tip <= C.Yc + C.a1) S.tip = -1;
  }
  if (!S.cut && !S.gone) {
    S.tPour += dt;
    if (S.tPour > POUR) breakStream(S);
  }
  // A broken stream's tail falls in.
  if (S.cut) {
    S.topV += G * dt;
    S.top -= S.topV * dt;
    if (S.top <= C.Yc + C.a1) {
      S.cut = false;
      S.gone = true;
      S.wait = SETTLE;
    }
  }
  if (S.gone) {
    S.wait -= dt;
    if (S.wait <= 0 && !S.sinking) {
      // The heap sinks away and the next pour starts from the spout.
      S.sinking = true;
      S.gone = false;
      S.top = YN;
      S.tip = YN;
      S.tipV = V0;
      S.tPour = 0;
    }
  }
  const { b, f } = S;
  const toBulk = (p) => ((p / GX) >> 1) * BX + ((p % GX) >> 1);
  if (S.sinking) {
    let any = false;
    for (let p = 0; p < NG; p++) {
      b[toBulk(p)] += f[p] / 4;
      f[p] = 0;
    }
    for (let p = 0; p < NB; p++) {
      b[p] = max(0, b[p] - SINK * dt);
      if (b[p] > 0) any = true;
    }
    if (!any) S.sinking = false;
  }
  // The rope lays itself down along the coil at the speed it arrives, so the
  // contact runs round at Omega = U1 / R.
  if (!S.gone && S.tip < 0) {
    const dphi = C.om * dt, n = max(1, ceil((C.R * dphi) / 0.5));
    for (let k = 0; k < n; k++) {
      const ph = S.phi + (dphi * (k + 0.5)) / n;
      deposit(S, C.cx + C.R * cos(ph), C.cz + C.R * sin(ph), C.a1, (C.R * dphi) / n);
    }
    S.phi += dphi;
  }
  // Loops melt into the heap, which flows.
  const m = 1 - exp(-dt / L.tf);
  for (let p = 0; p < NG; p++) {
    const v = f[p] * m;
    f[p] -= v;
    b[toBulk(p)] += v / 4;
  }
  slump(S, L, dt);
  for (let j = 0, p = 0; j < GZ; j++) for (let i = 0; i < GX; i++, p++) S.h[p] = bulkAt(b, i, j) + f[p];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.thick = cl(k[2], -1, 1);
  S.gloss = cl(k[3], -1, 1);
  if (!S.warm) {
    // Open six seconds into a pour.
    for (let i = 0; i < 180; i++) step(S, 1 / 30);
    S.warm = true;
  }
  if (input.btnPressed && input.btnPressed[0]) breakStream(S);
  step(S, (d * S.speed) / 2);
}

// Colours for the hue: the lit lotion, its shadow side and the wall.
function palette(S) {
  const h = S.hue + H0, hh = h - floor(h);
  // Orange, yellow and lime go brown or olive when deep: there the lotion is
  // paled to cream and the wall taken down almost to black.
  const warm = sm(0.0, 0.08, hh) * (1 - sm(0.22, 0.32, hh));
  // A wetter finish is a little deeper in colour.
  const wet = 0.5 + 0.5 * S.gloss;
  hsv(h, (0.38 + 0.14 * wet) * (1 - 0.4 * warm), 0.8 - 0.08 * wet + 0.06 * warm, S.lit);
  hsv(h + 0.015, (0.6 + 0.2 * wet) * (1 - 0.35 * warm), 0.4 - 0.1 * wet + 0.2 * warm, S.dark);
  hsv(h - 0.04, 0.85 - 0.5 * warm, 0.2 - 0.15 * warm, S.wall);
  // The pearl in the lotion glints a cooler shade at grazing angles.
  hsv(h - 0.12, 0.45 - 0.15 * warm, 1, S.pearl);
}

// The highlight against how squarely a surface faces the half vector,
// tabled once per Gloss. Satin at -1: a broad dim sheen; wet at 1: a narrow
// hot highlight.
const SPN = 1024;
function specTable(S) {
  if (S.specKey === S.gloss) return;
  S.specKey = S.gloss;
  const g = S.gloss, P = 28 * pow(5, g), KSp = 0.6 + 0.35 * g;
  for (let i = 0; i < SPN; i++) {
    const n = i / (SPN - 1), n2 = n * n;
    S.spec[i] = KSp * pow(n, P) + 0.16 * max(0, -g) * n2 * n2;
  }
}

function shade(S, nx, ny, nz, vx, vy, vz, lx, ly, lz, hx, hy, hz, strip, ao, out) {
  // A wet finish has a bright rim.
  const KR = 0.25 + 0.3 * max(0, S.gloss);
  const nl = nx * lx + ny * ly + nz * lz;
  const dif = cl((nl + 0.25) / 1.25, 0, 1);
  let nh = max(0, nx * hx + ny * hy + nz * hz);
  // The strip light, seen in the rope: only the turn of the rope across
  // matters, not along it.
  if (strip) {
    const l = sqrt(nx * nx + nz * nz) + 1e-6;
    nh = max(nh, ((nx * HS[0] + nz * HS[2]) / l) * (0.75 + 0.25 * l));
  }
  const sp = S.spec[round(cl(nh, 0, 1) * (SPN - 1))], e = 1 - cl(nx * vx + ny * vy + nz * vz, 0, 1);
  const rim = KR * e * e * e;
  const lit = S.lit, dk = S.dark, pe = S.pearl;
  for (let c = 0; c < 3; c++) out[c] = (dk[c] + (lit[c] - dk[c]) * dif) * ao + sp + rim * pe[c];
}

// Highlights roll off softly instead of clipping: a table over 0..2.
const TONE = new Uint8Array(1025);
for (let i = 0; i <= 1024; i++) TONE[i] = round(min(255, 319 * (1 - exp((-1.6 * 2 * i) / 1024))));
const tone = (v) => TONE[v <= 0 ? 0 : v >= 2 ? 1024 : (v * 512) | 0];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  specTable(S);
  const L = lotion(S), C = coil(S, L);
  const { h, hdep, col, rdep, rcov, rcol, bg, wall, c, blur, tmp } = S;
  // The heap's height blurred over 5 cells, for its shadow on the counter:
  // a running sum along x, then along z.
  for (let j = 0; j < GZ; j++) {
    const o = j * GX;
    let a = h[o] * 3 + h[o + 1] + h[o + 2];
    for (let i = 0; i < GX; i++) {
      tmp[o + i] = a * 0.2;
      a += h[o + min(GX - 1, i + 3)] - h[o + max(0, i - 2)];
    }
  }
  for (let i = 0; i < GX; i++) {
    let a = tmp[i] * 3 + tmp[GX + i] + tmp[2 * GX + i];
    for (let j = 0; j < GZ; j++) {
      blur[j * GX + i] = a * 0.2;
      a += tmp[min(GZ - 1, j + 3) * GX + i] - tmp[max(0, j - 2) * GX + i];
    }
  }
  // Heights smoothed 1-2-1 for the normals, so the steep rim of the heap
  // does not break into a comb along the grid.
  const hs = S.hs;
  for (let j = 0; j < GZ; j++)
    for (let i = 0; i < GX; i++) {
      const p = j * GX + i, l = i > 0 ? p - 1 : p, r = i < GX - 1 ? p + 1 : p;
      tmp[p] = (h[l] + 2 * h[p] + h[r]) * 0.25;
    }
  for (let j = 0; j < GZ; j++)
    for (let i = 0; i < GX; i++) {
      const p = j * GX + i, b0 = j > 0 ? p - GX : p, f0 = j < GZ - 1 ? p + GX : p;
      hs[p] = (tmp[b0] + 2 * tmp[p] + tmp[f0]) * 0.25;
    }
  // The wall.
  for (let p = 0; p < N; p++) {
    const v = bg[p];
    col[p * 3] = wall[0] * v;
    col[p * 3 + 1] = wall[1] * v;
    col[p * 3 + 2] = wall[2] * v;
    hdep[p] = -1e9;
    rdep[p] = -1e9;
    rcov[p] = 0;
  }
  // Each cell's colour: the lotion lit from its normal, valleys between
  // folds a little darker; and the bare counter, a satin shelf a little
  // lighter than the wall, in the shade of the heap beside it.
  const cc = S.cc, up = S.up;
  shade(S, 0, 1, 0, VW[0], VW[1], VW[2], LW[0], LW[1], LW[2], HW[0], HW[1], HW[2], false, 1, up);
  for (let j = 0; j < GZ; j++)
    for (let i = 0; i < GX; i++) {
      const p = j * GX + i, z = j + 0.5 - ZC;
      S.fl[p] = (0.55 + 0.25 * sm(-28, 28, z)) * (1 - 0.6 * sm(0, 4, blur[p]));
      if (hs[p] < 1e-3) {
        cc[p * 3] = up[0];
        cc[p * 3 + 1] = up[1];
        cc[p * 3 + 2] = up[2];
        continue;
      }
      const hl = hs[p - (i > 0 ? 1 : 0)], hr = hs[p + (i < GX - 1 ? 1 : 0)];
      const hb = hs[p - (j > 0 ? GX : 0)], hf = hs[p + (j < GZ - 1 ? GX : 0)];
      const gx = (hr - hl) * 0.5, gz = (hf - hb) * 0.5, inv = 1 / sqrt(gx * gx + 1 + gz * gz);
      const lap = hl + hr + hb + hf - 4 * hs[p];
      shade(S, -gx * inv, inv, -gz * inv, VW[0], VW[1], VW[2], LW[0], LW[1], LW[2], HW[0], HW[1], HW[2], false, 1 - 0.3 * cl(lap * 0.25, 0, 1), c);
      cc[p * 3] = c[0];
      cc[p * 3 + 1] = c[1];
      cc[p * 3 + 2] = c[2];
    }
  // The counter and the heap, column by column from the front back in half
  // cells, height and colour taken between cell centres, each sample filling
  // the rows its top rises above the samples in front of it.
  const FL = S.fl;
  for (let i = 0; i < GX; i++) {
    let yb = H;
    for (let v = GZ - 1; v >= 0; v -= 0.5) {
      const j = floor(v), fv = v - j, p = j * GX + i, p2 = j < GZ - 1 ? p + GX : p;
      const Yv = h[p] + (h[p2] - h[p]) * fv, z = v + 0.5 - ZC;
      const y0 = ceil(FY - Yv * CE + z * SE - 0.5);
      if (y0 >= yb) continue;
      // Thin lotion lets the counter show through.
      const film = sm(0.05, 0.9, Yv), fl = (FL[p] + (FL[p2] - FL[p]) * fv) * (1 - film);
      const r = (cc[p * 3] + (cc[p2 * 3] - cc[p * 3]) * fv) * film + wall[0] * fl;
      const g = (cc[p * 3 + 1] + (cc[p2 * 3 + 1] - cc[p * 3 + 1]) * fv) * film + wall[1] * fl;
      const b = (cc[p * 3 + 2] + (cc[p2 * 3 + 2] - cc[p * 3 + 2]) * fv) * film + wall[2] * fl;
      const dep = Yv * SE + z * CE;
      for (let y = max(0, y0); y < yb; y++) {
        const q = y * W + i;
        col[q * 3] = r;
        col[q * 3 + 1] = g;
        col[q * 3 + 2] = b;
        hdep[q] = dep;
      }
      yb = y0;
    }
  }
  // The rope: a chain of balls half an LED apart, each a sphere, the nearest
  // surface's normal kept at every LED.
  const ropeOn = !S.gone;
  if (ropeOn) {
    const t = S.t, top = min(S.top, YN + 3);
    const landed = S.tip < 0;
    const coilTop = C.Yc + C.a1 + HC * C.R;
    const low = landed ? coilTop : S.tip;
    const ball = (x, Y, z, a) => {
      if (a < 0.3) return;
      const sx = x, sy = FY - Y * CE + z * SE, dd = Y * SE + z * CE;
      const x0 = max(0, floor(sx - a - 1)), x1 = min(W - 1, ceil(sx + a)), y0 = max(0, floor(sy - a - 1)), y1 = min(H - 1, ceil(sy + a));
      for (let y = y0; y <= y1; y++)
        for (let xx = x0; xx <= x1; xx++) {
          const dx = xx + 0.5 - sx, dy = y + 0.5 - sy, r = sqrt(dx * dx + dy * dy);
          const cov = cl(a - r + 0.5, 0, 1);
          if (cov <= 0) continue;
          const q = y * W + xx, uz = sqrt(max(0, 1 - (r * r) / (a * a)));
          const depth = dd + a * uz;
          if (cov < rcov[q] - 0.02 || (cov <= rcov[q] + 0.02 && depth <= rdep[q])) continue;
          const m = 1 / max(a, r + 1e-6);
          rcov[q] = cov;
          rdep[q] = depth;
          rcol[q * 3] = dx * m;
          rcol[q * 3 + 1] = -dy * m;
          rcol[q * 3 + 2] = uz;
        }
    };
    // The falling stream, with swellings that left the spout at a steady
    // beat and stretch apart as the lotion speeds up.
    for (let Y = top; Y > low; Y -= 0.5) {
      const v = speedAt(Y), age = (v - V0) / G;
      let a = radiusAt(L.a0, Y) * (1 + BA * sin(2 * PI * FB * (t - age)));
      // A broken stream's upper end narrows to a rounded tail.
      if (S.cut) a *= 0.45 + 0.55 * sm(0, 12, top - Y);
      ball(AX, Y, 0, a);
    }
    if (!landed) ball(AX, S.tip, 0, radiusAt(L.a0, S.tip) * 1.15);
    else {
      // The coil: from the axis at its top it bends out to radius R, winding
      // a quarter turn as it comes down level onto the heap.
      const len = HC * C.R + 2 * C.R, n = ceil(len / 0.5);
      for (let k = n; k >= 0; k--) {
        const s = k / n, Y = C.Yc + C.a1 + HC * C.R * s * s;
        if (Y > top) continue;
        const r = C.R * (1 - s * s) * (1 - s * s), th = S.phi + s * PI * 0.5, e = (1 - s) * (1 - s);
        let a = radiusAt(L.a0, Y);
        if (S.cut) a *= 0.45 + 0.55 * sm(0, 12, top - Y);
        ball(AX + (C.cx - AX) * e + r * cos(th), Y, C.cz * e + r * sin(th), a);
      }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x;
      let r = col[q * 3], g = col[q * 3 + 1], b = col[q * 3 + 2];
      const cv = rcov[q];
      if (cv > 0 && rdep[q] > hdep[q]) {
        // The rope, lit from the normal its nearest ball left here.
        shade(S, rcol[q * 3], rcol[q * 3 + 1], rcol[q * 3 + 2], 0, 0, 1, LC[0], LC[1], LC[2], HCm[0], HCm[1], HCm[2], true, 1, c);
        r += (c[0] - r) * cv;
        g += (c[1] - g) * cv;
        b += (c[2] - b) * cv;
      }
      display.setPixel(x, y, tone(r), tone(g), tone(b));
    }
}
