// ===== Patternflow pattern =====
// Title:   Veselago Slab
// Family:  negindex
// Idea:    A point of light near the top throws a fan of rays at a flat slab of negative refractive index, each ray bends the wrong way at the top face, crosses its neighbours inside the slab, bends again at the bottom face and crosses them a second time below it, and as the index wanders past minus one the two crisp foci open into bright cusps.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   273
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Index=0..4, Slab=-1..1, Fan=52..76
//
// Knob 1: Hue. draft
// Knob 2: Index. draft
// Knob 3: Slab. draft
// Knob 4: Fan. draft

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, sin, cos, min, max, abs, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

const DTH = 2 * PI / 180;   // angle between launched rays
const NM = 35;              // rays each side of the axis at most
const RATE_B = 0.00713;     // turns of the hue wheel a second: the bold rays
const RATE_V = 0.00991;     // the veil of faint rays
const RATE_C = 0.01199;     // the caustic
const WS = 1.5;             // how fast the wandering runs
const VEIL = 0.01;         // light of a ray of the veil
const LAMBDA = 7.5;         // LEDs to a wavelength
const NU = 0.75;            // cycles a second
let YT = 36;                // top face, which drifts a little
const AREF = 21;            // source to top face
const SIG2 = 2 * 0.8 * 0.8; // ray profile: sigma 0.8 LED, 1.9 LED wide at half
const HW = 2.5;             // ray half width in LEDs, where the profile is cut

const COS = new Float32Array(1024);
for (let i = 0; i < 1024; i++) COS[i] = cos((i / 1024) * TAU);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// a colour lifted so blues and violets carry about the light of greens
function tint(h, s, o) {
  hsv(h, s, 1, o);
  const l = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2], g = cl(Math.pow(0.6 / (l + 0.05), 0.7), 0.7, 1.9);
  o[0] *= g;
  o[1] *= g;
  o[2] *= g;
}

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 40; i++) ph.push(TAU * Math.random());
  params.s = { t: 0, k: null, ph };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 52];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.18);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.t += d;
}

// ------------------------------------------------------------------ drawing
const F = new Float32Array(W * H * 3);
const C = [0, 0, 0];

// one straight piece of a ray: a soft line two LEDs wide, brightness ripples with the phase
function seg(ax, ay, bx, by, S0, nn, s0, col, wgt, clk, md) {
  const dx = bx - ax, dy = by - ay, L = hypot(dx, dy);
  if (L < 1e-6) return;
  const ux = dx / L, uy = dy / L, cr = col[0] * wgt, cg = col[1] * wgt, cb = col[2] * wgt;
  const ph0 = S0 / LAMBDA - NU * clk, dph = nn / LAMBDA;
  if (abs(uy) >= abs(ux)) {
    const y0 = max(0, ceil(min(ay, by) - 0.5)), y1 = min(H - 1, floor(max(ay, by) - 0.5)), hw = HW / abs(uy);
    for (let iy = y0; iy <= y1; iy++) {
      const yc = iy + 0.5, tc = (yc - ay) / uy, xc = ax + tc * ux;
      const j0 = max(0, ceil(xc - hw - 0.5)), j1 = min(W - 1, floor(xc + hw - 0.5));
      for (let j = j0; j <= j1; j++) {
        const o = j + 0.5 - xc, dd = o * uy, t = cl(tc + o * ux, 0, L);
        const fin = sm(2, 10, s0 + t);
        const mo = 1 - md * (0.5 - 0.5 * COS[(((ph0 + dph * t) * 1024) | 0) & 1023]);
        const v = exp(-(dd * dd) / SIG2) * fin * mo, p = (iy * W + j) * 3;
        F[p] += cr * v;
        F[p + 1] += cg * v;
        F[p + 2] += cb * v;
      }
    }
  } else {
    const x0 = max(0, ceil(min(ax, bx) - 0.5)), x1 = min(W - 1, floor(max(ax, bx) - 0.5)), hw = HW / abs(ux);
    for (let ix = x0; ix <= x1; ix++) {
      const xc = ix + 0.5, tc = (xc - ax) / ux, yc = ay + tc * uy;
      const i0 = max(0, ceil(yc - hw - 0.5)), i1 = min(H - 1, floor(yc + hw - 0.5));
      for (let i = i0; i <= i1; i++) {
        const o = i + 0.5 - yc, dd = o * ux, t = cl(tc + o * uy, 0, L);
        const fin = sm(2, 10, s0 + t);
        const mo = 1 - md * (0.5 - 0.5 * COS[(((ph0 + dph * t) * 1024) | 0) & 1023]);
        const v = exp(-(dd * dd) / SIG2) * fin * mo, p = (i * W + ix) * 3;
        F[p] += cr * v;
        F[p + 1] += cg * v;
        F[p + 2] += cb * v;
      }
    }
  }
}

function wander(S, t, i0, a, b, c, d, e) {
  const p = S.ph;
  return (a * sin(0.0713 * t + p[i0]) + b * sin(0.1137 * t + p[i0 + 1]) + c * sin(0.1711 * t + p[i0 + 2]) + d * sin(0.2593 * t + p[i0 + 3]) + e * sin(0.0371 * t + p[i0 + 4]));
}

// a soft line of dots 0.7 LED apart: short pieces that seg would skip
function dline(x0, y0, x1, y1, col, w) {
  const L = hypot(x1 - x0, y1 - y0), m = max(1, ceil(L / 0.7));
  const wd = (w * 0.31 * (L / m)) / 0.7;
  for (let q = 0; q < m; q++) {
    const f = (q + 0.5) / m, cx = x0 + (x1 - x0) * f, cy = y0 + (y1 - y0) * f;
    const ya = max(0, floor(cy - 2.5)), yb = min(H - 1, floor(cy + 2.5)), xa = max(0, floor(cx - 2.5)), xb = min(W - 1, floor(cx + 2.5));
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        const r2 = (x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy), v = exp(-r2 / SIG2) * wd, p = (y * W + x) * 3;
        F[p] += col[0] * v;
        F[p + 1] += col[1] * v;
        F[p + 2] += col[2] * v;
      }
  }
}

// the envelope of two neighbouring rays: where they cross, in the slab and below it
const KP = [0, 0, 0, 0, 0, 0, 0, 0];
let HO = 0, HV = 0, HC = 0;
let HB = 0.5, HS = 0.42, HQ = 0;
// the hue of a ray by its launch angle: a spread across the fan, turned round the wheel by an offset that is the clock of its own layer
const rh = (th, off) => HB + HS * th + HQ * abs(th) + off;
function caustic(p, q, d, yB, cc) {
  const th = (p.th + q.th) / 2;
  const w = min(p.w, q.w) * 1.0;
  for (let z = 0; z < 2; z++) {
    tint(rh(th, z ? HC : HV), 0.45, cc);
    let Px, Py, Dx, Dy, Qx, Qy, Ex, Ey, ymax;
    if (z === 0) {
      Px = p.x1; Py = YT; Dx = p.s2; Dy = p.c2; Qx = q.x1; Qy = YT; Ex = q.s2; Ey = q.c2; ymax = yB;
    } else {
      Px = p.x2; Py = yB; Dx = p.sT; Dy = p.cT; Qx = q.x2; Qy = yB; Ex = q.sT; Ey = q.cT; ymax = H + 6;
    }
    const den = Dx * Ey - Dy * Ex;
    let ok = 0, X = 0, Y = 0;
    if (abs(den) > 1e-6) {
      const rx = Qx - Px, ry = Qy - Py, t = (rx * Ey - ry * Ex) / den, u = (rx * Dy - ry * Dx) / den;
      X = Px + t * Dx;
      Y = Py + t * Dy;
      if (t >= 0 && u >= 0 && Y <= ymax && X > -6 && X < W + 6) ok = 1;
    }
    const o = z * 3;
    if (ok && KP[o + 2] === 1 && KP[6 + z] === p.th) dline(KP[o], KP[o + 1], X, Y, cc, w);
    KP[o] = X;
    KP[o + 1] = Y;
    KP[o + 2] = ok;
    KP[6 + z] = q.th;
  }
}

export function draw(display, params) {
  const S = params.s, t = S.t, tw = t * WS;
  const K = S.k || [0, 2, 0, 52], k1 = K[0], k2 = cl(K[1], 0, 4), k3 = cl(K[2], -1, 1), k4 = cl(K[3], 52, 76);
  const h0 = 0.5 + k1 + 0.04 * sin(0.031 * t + S.ph[10]);
  const nbar = -(0.4 + 0.4 * k2);
  const amp = 0.34 * Math.pow(-nbar / 1.2, 0.7);
  const n = min(-0.3, nbar + amp * wander(S, tw, 0, 0.45, 0.3, 0.2, 0.12, 0.35) / 1.0);
  const a = AREF + 2.4 * sin(0.093 * tw + S.ph[5]) + 1.2 * sin(0.151 * tw + S.ph[6]);
  const sx = 32 + 14 * sin(0.067 * tw + S.ph[7]) + 6 * sin(0.139 * tw + S.ph[8]);
  const d = 38 * exp(0.25 * k3) * (1 + 0.07 * sin(0.083 * tw + S.ph[9]) + 0.04 * sin(0.191 * tw + S.ph[11]));
  YT = 36 + 4 * (0.6 * sin(0.057 * t + S.ph[34]) + 0.4 * sin(0.131 * t + S.ph[35]));
  const sy = YT - a, yB = YT + d;
  const fan = (k4 * PI) / 180;
  // slow independent drifts of the palette and the light, each a pair of sines that do not divide
  const P = S.ph, dr = (i, f1, f2) => 0.6 * sin(f1 * t + P[i]) + 0.4 * sin(f2 * t + P[i + 1]);
  // the spread of hue across the fan breathes between 0.16 and 0.44 of a turn
  const hs = 0.3 + 0.14 * (0.7 * cos(0.049 * t) + 0.3 * cos(0.087 * t));
  const gh = 0.62 + 0.2 * sin(TAU * (h0 - 0.5)) + 0.1 * dr(12, 0.113, 0.171), slh = 0.49 + 0.1 * dr(14, 0.097, 0.203);
  const hzg = 0.1 * (1 + 0.45 * dr(16, 0.127, 0.239)), hx = sx + 10 * dr(18, 0.083, 0.151), hy = sy + 8 * dr(20, 0.109, 0.197);
  const rg = 1 + 0.22 * dr(22, 0.101, 0.223), hq = 0.1 * dr(24, 0.089, 0.181), srh = h0 + 0.2 * dr(26, 0.139, 0.211);
  const slg = 1 + 0.4 * dr(28, 0.117, 0.257), vg = VEIL * (1 + 0.4 * dr(30, 0.131, 0.173)), bg = 0.72 * (1 + 0.2 * dr(32, 0.093, 0.241));

  HB = h0;
  HS = hs;
  HQ = hq;
  HO = RATE_B * t;
  HV = RATE_V * t;
  HC = RATE_C * t;

  // ground, slab
  tint(gh, 0.9, C);
  const gr = C[0], gg = C[1], gb = C[2];
  tint(slh, 0.6, C);
  const sr = C[0], sg = C[1], sb = C[2];
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5;
    const gy = 0.036 + 0.016 * exp(-((yc - 70) * (yc - 70)) / 2400), dy2 = (yc - hy) * (yc - hy), dys = (yc - sy) * (yc - sy), rw = 0.45 * sm(YT + 3, YT - 8, yc);
    let sl = 0;
    if (yc > YT && yc < yB) sl = 0.06 + 0.05 * exp(-(yc - YT) * (yc - YT) / 30) + 0.05 * exp(-(yB - yc) * (yB - yc) / 30);
    const e1 = exp(-(yc - YT) * (yc - YT) / SIG2) * 0.3, e2 = exp(-(yc - yB) * (yc - yB) / SIG2) * 0.3;
    for (let x = 0; x < W; x++) {
      const r2 = (x + 0.5 - hx) * (x + 0.5 - hx) + dy2, p = (y * W + x) * 3, gl = gy + hzg * exp(-r2 / 1500) * (1 + rw * COS[((sqrt((x + 0.5 - sx) * (x + 0.5 - sx) + dys) / LAMBDA - NU * t) * 1024 | 0) & 1023]);
      const sv = (sl + e1 + e2) * slg;
      F[p] = gr * gl + sr * sv;
      F[p + 1] = gg * gl + sg * sv;
      F[p + 2] = gb * gl + sb * sv;
    }
  }

  // rays
  KP.fill(0);
  const c1 = [0, 0, 0], c2 = [0, 0, 0], c3 = [0, 0, 0], cc = [0, 0, 0];
  let pe = null; // the previous ray that went in: its start and direction in the slab and below
  for (let i = -NM; i < NM; i++) {
    const th = (i + 0.5) * DTH, ath = abs(th);
    const sT = sin(th), cT = cos(th), inFan = ath <= fan;
    // light takes a colour of its own in each of the three places, above the slab, in it and below it
    tint(rh(th, HO), 0.85, c1);
    tint(rh(th, HV), 0.85, c2);
    tint(rh(th, HC), 0.85, c3);
    // the bold rays every 10 degrees, within the fan; the veil of all the rest, the whole half plane
    const wb = (i % 5 + 5) % 5 === 2 ? sm(fan, fan - 0.08, ath) * bg * rg : 0;
    const x1 = sx + (a * sT) / cT, S1 = a / cT, s2 = sT / n;
    if (abs(s2) >= 1) {
      // cannot enter: reflected at the top face
      for (let q = 0; q < 2; q++) {
        const w = q ? wb * 0.55 : vg * rg * 0.55, md = q ? 0.12 : 0.6;
        if (w > 0) seg(x1, YT, x1 + 300 * sT, YT - 300 * cT, S1, 1, S1, c1, w, t, md);
      }
      pe = null;
    } else {
      const cs = sqrt(1 - s2 * s2), L2 = d / cs, x2 = x1 + (d * s2) / cs;
      for (let q = 0; q < 2; q++) {
        const w = q ? wb : vg * rg, md = q ? 0.12 : 0.6;
        if (w <= 0) continue;
        seg(x1, YT, x2, yB, S1, n, S1, c2, w, t, md);
        seg(x2, yB, x2 + 300 * sT, yB + 300 * cT, S1 + n * L2, 1, S1 + L2, c3, w, t, md);
      }
      if (inFan) {
        const cu = { x1, s2, c2: cs, x2, sT, cT, th, w: sm(fan, fan - 0.08, ath), L2 };
        if (pe) caustic(pe, cu, d, yB, cc);
        pe = cu;
      } else pe = null;
    }
    for (let q = 0; q < 2; q++) {
      const w = q ? wb : vg * rg, md = q ? 0.12 : 0.6;
      if (w > 0) seg(sx, sy, x1, YT, 0, 1, 0, c1, w, t, md);
    }
  }

  // source
  hsv(srh, 0.35, 1, C);
  for (let y = max(0, floor(sy - 9)); y <= min(H - 1, floor(sy + 9)); y++)
    for (let x = max(0, floor(sx - 9)); x <= min(W - 1, floor(sx + 9)); x++) {
      const r2 = (x + 0.5 - sx) * (x + 0.5 - sx) + (y + 0.5 - sy) * (y + 0.5 - sy);
      const v = 0.45 * exp(-r2 / 14) + 1.4 * exp(-r2 / 3.2), p = (y * W + x) * 3;
      F[p] += C[0] * v;
      F[p + 1] += C[1] * v;
      F[p + 2] += C[2] * v;
    }

  // tone map
  const G = 1.4;
  for (let p = 0; p < W * H; p++) {
    const r = F[p * 3], g = F[p * 3 + 1], b = F[p * 3 + 2];
    const m = max(r, g, b);
    const x = p % W, y = (p / W) | 0;
    if (m < 0.004) {
      display.setPixel(x, y, 0, 0, 0);
      continue;
    }
    const o = 1 - exp(-G * m), f = o / m, wh = 0.3 * o * o * o;
    display.setPixel(x, y, cl(((r * f + wh) * 255) | 0, 0, 255), cl(((g * f + wh) * 255) | 0, 0, 255), cl(((b * f + wh) * 255) | 0, 0, 255));
  }
}
