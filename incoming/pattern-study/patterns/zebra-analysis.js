// ===== Patternflow pattern =====
// Title:   Zebra Analysis
// Family:  zebra
// Idea:    A smooth, tall lump of mirror stands in the middle of the panel, swelling and turning slowly, and an endless field of two-tone stripes lies in its surface, so the stripes bend with each swell, slide and twist round the lump, split where a coarser field cuts across them and kink along the seams where the curvature of the surface jumps, the way a car body is checked for smoothness.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: zebra analysis, the continuity check of car-body and CAD surfaces, in which the stripes of a far-off lamp field are reflected in the surface and a break in the surface shows as a break or a kink in the stripes (from memory), sphere tracing of an implicit surface (John C. Hart, 1996, from memory), original, pattern round 226
// Round:   226
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Stripe=1.2..3, Warp=1.2..2.4, Spin=-1..1
//
// Knob 1: Hue. Turns both tones once round the wheel: at 0 the stripes are deep blue (hue 216 degrees) and ice white, at 0.25 plum and pale pink, at 0.5 amber and pale peach, at 0.75 green and pale lime, and 1 is the same as 0; the ground behind the lump takes the deep tone's hue.
// Knob 2: Stripe. How fine the stripes are: the middle stripe of the lump is about 4 LEDs wide at 1.2, 3 LEDs at the opening 2 and 3 LEDs at 3, but the finer the field the more of the sides crowd below 3 LEDs and melt into a dark rim tone, a third of the stripes at 2 and half of them at 3.
// Knob 3: Warp. How far the surface is pushed out of its egg: the outline leaves its ellipse by 1.6 LEDs rms at 1.2 and by 2.1 at 2.4 (up to 4 LEDs), and the three curvature seams grow from a 0.5 to a 1.0 share of the radius, so that at 1.2 the stripes only bend and at 2.4 rings of stripes close round the seams.
// Knob 4: Spin. Which way and how fast the stripe field turns about the line of sight and slides along itself: 0.108 radians a second and 0.13 stripes a second at the opening 0.06 (a turn in 58 s), 0.39 and 0.6 at 1 (a turn in 16 s), and the other way at -1 with 0.21 and 0.4, while at -0.3 the turn stops and the stripes all but stand still and only the lump moves.

const W = 64, H = 128, NPIX = W * H;
const { floor, sqrt, exp, sin, cos, abs, PI, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const NS = 192; // directions sampled to fit the lump to the panel
const MAXS = 46; // most sphere-tracing steps
const STEP = 0.62; // share of the distance estimate taken at each step
const NM = 7; // zonal modes
const NSEAM = 3; // curvature seams
const OFF = NM * 4 + 2; // two more modes, about the vertical axis, sit between the zonal modes and the seams

// Order and size of each zonal mode, and the periods, in seconds, of the random sequences that steer its axis and its amplitude.
const ORD = [2, 2, 3, 3, 4, 4, 5];
// Size of each mode as a share of the radius at Warp 1. The low orders carry the swell of the outline; a mode's curvature at its pole is its size times l (l + 1) / 2, so the high orders stay small and the surface stays a smooth, mostly convex lump.
const BASE = [0.13, 0.12, 0.07, 0.06, 0.025, 0.02, 0.01];
const TAX = [23, 17, 20, 14, 22, 13, 16];
const TAM = [18, 25, 16, 21, 14, 19, 11];

// Smooth random numbers: a new random value at every whole step of t, joined by a
// Catmull-Rom curve, in about -1..1. Each channel has its own sequence.
const hash = (n) => {
  const x = sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - floor(x);
};
function wander(P, t, ch) {
  const i = floor(t), f = t - i, o = ch * 101.7 + P.so;
  const a = hash(i - 1 + o) * 2 - 1, b = hash(i + o) * 2 - 1, c = hash(i + 1 + o) * 2 - 1, d = hash(i + 2 + o) * 2 - 1;
  return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
}

function hsv(h, s, v, out, o) {
  h -= floor(h);
  const i = floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(P) {
  P.t = 0;
  P.so = Math.random() * 500;
  P.rot = Math.random() * 6.28;
  P.ph = Math.random() * 2;
  P.sx = 27;
  P.sy = 51;
  P.ox = 0;
  P.oy = 0;
  P.init = false;
  P.M = new Float64Array(OFF + NSEAM * 5);
  P.dirs = new Float64Array(NS * 3);
  for (let i = 0; i < NS; i++) {
    const y = 1 - (2 * i + 1) / NS, r = sqrt(1 - y * y), a = i * 2.399963229728653;
    P.dirs[i * 3] = r * cos(a);
    P.dirs[i * 3 + 1] = y;
    P.dirs[i * 3 + 2] = r * sin(a);
  }
  P.phi1 = new Float32Array(NPIX);
  P.phi2 = new Float32Array(NPIX);
  P.phi3 = new Float32Array(NPIX);
  P.nzA = new Float32Array(NPIX);
  P.dmin = new Float32Array(NPIX);
  P.st = new Uint8Array(NPIX); // 0 far, 1 near miss (has data), 2 hit
  P.cov = new Float32Array(NPIX);
  P.rgb = new Float32Array(NPIX * 3);
  P.col = new Float32Array(9);
}

// Radius of the lump in direction u, in the unit-sphere space: a sum of zonal
// harmonics about wandering axes, plus a few seams, each a quadratic ramp that
// starts at a plane through the lump (the surface goes on without a corner, but
// its curvature jumps there).
function radius(M, ux, uy, uz) {
  let c, c2, L = 0, o = 0;
  c = M[0] * ux + M[1] * uy + M[2] * uz; L += M[3] * (1.5 * c * c - 0.5);
  c = M[4] * ux + M[5] * uy + M[6] * uz; L += M[7] * (1.5 * c * c - 0.5);
  c = M[8] * ux + M[9] * uy + M[10] * uz; L += M[11] * c * (2.5 * c * c - 1.5);
  c = M[12] * ux + M[13] * uy + M[14] * uz; L += M[15] * c * (2.5 * c * c - 1.5);
  c = M[16] * ux + M[17] * uy + M[18] * uz; c2 = c * c; L += M[19] * (4.375 * c2 * c2 - 3.75 * c2 + 0.375);
  c = M[20] * ux + M[21] * uy + M[22] * uz; c2 = c * c; L += M[23] * (4.375 * c2 * c2 - 3.75 * c2 + 0.375);
  c = M[24] * ux + M[25] * uy + M[26] * uz; c2 = c * c; L += M[27] * c * (7.875 * c2 * c2 - 8.75 * c2 + 1.875);
  // Two modes about the vertical axis: they turn the outline between a lemon and a capsule.
  c2 = uy * uy;
  L += M[NM * 4] * (1.5 * c2 - 0.5) + M[NM * 4 + 1] * (4.375 * c2 * c2 - 3.75 * c2 + 0.375);
  for (o = OFF; o < OFF + NSEAM * 5; o += 5) {
    const s = M[o] * ux + M[o + 1] * uy + M[o + 2] * uz - M[o + 3];
    if (s > 0) L += M[o + 4] * s * s;
  }
  const r = 1 + L;
  return r < 0.45 ? 0.45 : r;
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  P.t += d;
  const t = P.t, M = P.M;
  const warp = cl(kv[2], 1.2, 2.4);
  const spin = cl(kv[3], -1, 1);
  const w = (ch, T) => wander(P, t / T + ch * 7.3, ch);

  // The lump: modes with axes that wander on their own sequences and turn about the
  // vertical, slowly.
  const turn = 0.12 * t;
  for (let k = 0; k < NM; k++) {
    const th = PI / 2 + 1.25 * w(10 * k + 1, TAX[k]), ps = turn * (0.7 + 0.12 * k) + 2.6 * w(10 * k + 2, TAX[k] * 1.3);
    const s = sin(th);
    M[k * 4] = s * cos(ps);
    M[k * 4 + 1] = cos(th);
    M[k * 4 + 2] = s * sin(ps);
    M[k * 4 + 3] = warp * BASE[k] * w(10 * k + 3, TAM[k]);
  }
  M[NM * 4] = 0.17 * warp * w(70, 21);
  M[NM * 4 + 1] = 0.07 * warp * w(71, 27);
  for (let q = 0; q < NSEAM; q++) {
    const o = OFF + q * 5, ch = 100 + q * 10;
    const th = PI / 2 + 1.2 * w(ch + 1, 33 + 5 * q), ps = turn * 0.8 + 2.4 * w(ch + 2, 41 + 6 * q), s = sin(th);
    M[o] = s * cos(ps);
    M[o + 1] = cos(th);
    M[o + 2] = s * sin(ps);
    M[o + 3] = cl(0.3 + 0.3 * w(ch + 3, 29 + 4 * q), 0.04, 0.6);
    M[o + 4] = 0.42 * warp * w(ch + 4, 23 + 3 * q);
  }

  // Fit: the width and the height the lump is to fill, and where it stands, from
  // a sample of its directions.
  let xmx = -9, xmn = 9, ymx = -9, ymn = 9, rmx = 0;
  const dirs = P.dirs;
  for (let i = 0; i < NS; i++) {
    const ux = dirs[i * 3], uy = dirs[i * 3 + 1], uz = dirs[i * 3 + 2], r = radius(M, ux, uy, uz);
    const X = r * ux, Y = r * uy;
    if (X > xmx) xmx = X;
    if (X < xmn) xmn = X;
    if (Y > ymx) ymx = Y;
    if (Y < ymn) ymn = Y;
    if (r > rmx) rmx = r;
  }
  const Wt = 54 + 4 * w(200, 37), Ht = 100 + 8 * w(201, 53);
  const sxT = Wt / (xmx - xmn), syT = Ht / (ymx - ymn);
  const oxT = -0.5 * (xmx + xmn) * sxT, oyT = -0.5 * (ymx + ymn) * syT;
  const lp = P.init ? 1 - exp(-d / 0.6) : 1;
  P.init = true;
  P.sx += (sxT - P.sx) * lp;
  P.sy += (syT - P.sy) * lp;
  P.ox += (oxT - P.ox) * lp;
  P.oy += (oyT - P.oy) * lp;
  const sx = P.sx, sy = P.sy, sz = 1.6 * sx, ox = P.ox, oy = P.oy;
  const msc = min(sx, min(sy, sz));
  const Rb = rmx * 1.07 + 0.05, Rb2 = Rb * Rb;

  // The environment: three fields of stripes at infinity. The first turns about the
  // line of sight and slides along itself, and is the one the eye follows. The other
  // two are coarse, each in a direction of its own that wanders, and each flips the
  // tone where it crosses the first, which splits the stripes along a few faults.
  P.rot += d * (0.09 + 0.3 * spin);
  P.ph += d * (0.1 + 0.5 * spin);
  // The lump is about 3.6 times flatter along its height than across it, so stripes
  // that run across the panel would come out as wide as the panel is tall. The
  // frequency is raised, up to 2.6 times, as the stripes turn from upright to level.
  const rr = (P.sy * P.sy) / (P.sx * P.sx);
  const freq0 = 1.15 * cl(kv[1], 1.2, 3.0) * (1 + 0.06 * w(210, 31));
  const th1 = 1.35 + 0.2 * w(211, 23), ps1 = P.rot + 0.5 * w(212, 41);
  const th2 = 1.2 + 0.3 * w(213, 29), ps2 = ps1 + 1.45 + 0.5 * w(214, 37);
  const aniso = sqrt(cos(ps1) * cos(ps1) + (sin(ps1) * sin(ps1)) / rr);
  const freq = freq0 / max(aniso, 1 / 2.6);
  const e1x = sin(th1) * cos(ps1), e1y = sin(th1) * sin(ps1), e1z = cos(th1);
  const e2x = sin(th2) * cos(ps2), e2y = sin(th2) * sin(ps2), e2z = cos(th2);
  const th3 = 1.3 + 0.3 * w(218, 31), ps3 = 0.45 * P.rot + 2.8 * w(219, 26);
  const e3x = sin(th3) * cos(ps3), e3y = sin(th3) * sin(ps3), e3z = cos(th3);
  const ph3 = 0.4 * P.ph + 1.9 * w(220, 39), f3 = freq0 * 0.37;
  const ph1 = P.ph + 0.9 * w(215, 27), ph2 = 0.6 * P.ph + 1.7 * w(216, 43);
  const f2 = freq0 * 0.25;

  // Colour: a deep tone, a pale tone and a dark ground, from the hue knob.
  const hb = 0.6 + kv[0];
  const warm = max(0, cos((hb - 0.1) * 2 * PI));
  const col = P.col;
  hsv(hb, 0.9 - 0.15 * warm, 0.5 + 0.14 * warm, col, 0); // deep
  hsv(hb - 0.07, 0.2, 1.0, col, 3); // pale
  hsv(hb - 0.01, 0.85, 0.13, col, 6); // ground

  // ---- trace ----
  const { phi1, phi2, phi3, nzA, dmin: dm, st, cov } = P;
  const eps = 0.5;
  const F = (X, Y, Z) => {
    const qx = (X - ox) / sx, qy = (Y - oy) / sy, qz = Z / sz;
    const len = sqrt(qx * qx + qy * qy + qz * qz) + 1e-9, inv = 1 / len;
    return len - radius(M, qx * inv, qy * inv, qz * inv);
  };
  for (let y = 0; y < H; y++) {
    const Y = y - 63.5, qy = (Y - oy) / sy;
    for (let x = 0; x < W; x++) {
      const X = x - 31.5, qx = (X - ox) / sx, i = y * W + x;
      const rho2 = qx * qx + qy * qy;
      if (rho2 > Rb2) {
        st[i] = 0;
        dm[i] = 9;
        continue;
      }
      const zmax = sqrt(Rb2 - rho2);
      let qz = -zmax, best = 9, zb = qz, hit = false;
      for (let n = 0; n < MAXS; n++) {
        const len = sqrt(rho2 + qz * qz) + 1e-9, inv = 1 / len;
        const f = (len - radius(M, qx * inv, qy * inv, qz * inv)) * msc;
        if (f < best) {
          best = f;
          zb = qz;
        }
        if (f < 0.015) {
          hit = true;
          break;
        }
        qz += (f * STEP) / sz;
        if (qz > zmax) break;
      }
      if (hit) best = 0;
      dm[i] = best;
      if (!hit && best > 0.5) {
        st[i] = 0;
        continue;
      }
      st[i] = hit ? 2 : 1;
      // Normal from the gradient of the field, then the reflected ray and its stripe phases.
      const Z = zb * sz;
      let gx = F(X + eps, Y, Z) - F(X - eps, Y, Z);
      let gy = F(X, Y + eps, Z) - F(X, Y - eps, Z);
      let gz = F(X, Y, Z + eps) - F(X, Y, Z - eps);
      gx /= sx; gy /= sy; gz /= sz;
      const gl = 1 / (sqrt(gx * gx + gy * gy + gz * gz) + 1e-12);
      const nx = gx * gl, ny = gy * gl, nz = gz * gl;
      const rx = -2 * nz * nx, ry = -2 * nz * ny, rz = 1 - 2 * nz * nz;
      // The stripes lie on a wall behind the viewer, so a ray's place on it is its
      // component along the stripes' normal over its depth: near parallel and evenly
      // spaced where the ray comes straight back, crowding where it runs away to the side.
      const dn = 1 / (1.1 - rz);
      phi1[i] = (rx * e1x + ry * e1y + rz * e1z) * dn * freq + ph1;
      phi2[i] = (rx * e2x + ry * e2y + rz * e2z) * dn * f2 + ph2;
      phi3[i] = (rx * e3x + ry * e3y + rz * e3z) * dn * f3 + ph3;
      nzA[i] = abs(nz);
    }
  }

  // Coverage of the silhouette: a miss is covered by what its closest pass left of
  // half a LED, a hit by how far its nearest miss lies.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, s = st[i];
      if (s === 0) {
        cov[i] = 0;
      } else if (s === 1) {
        cov[i] = cl(0.5 - dm[i], 0, 1);
      } else {
        let c = 1;
        for (let k = 0; k < 4; k++) {
          const xx = x + (k === 0 ? -1 : k === 1 ? 1 : 0), yy = y + (k === 2 ? -1 : k === 3 ? 1 : 0);
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          const j = yy * W + xx;
          if (st[j] === 2) continue;
          const m = st[j] === 0 ? 9 : dm[j];
          if (m < 1) c = min(c, cl(0.5 + 1 - m, 0, 1));
        }
        cov[i] = c;
      }
    }

  // ---- shade ----
  const rgb = P.rgb;
  const edge = 1.25; // width of a stripe's soft edge, in LEDs
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 3;
      // Ground, a little lighter at the middle.
      const gxn = (x - 31.5) / 32, gyn = (y - 63.5) / 64, vg = 1 - 0.35 * (gxn * gxn + gyn * gyn);
      let r = col[6] * vg, g = col[7] * vg, b = col[8] * vg;
      const c = cov[i];
      if (c > 0) {
        const p = phi1[i], q = phi2[i];
        const vl = x > 0 && cov[i - 1] > 0, vr = x < W - 1 && cov[i + 1] > 0, vu = y > 0 && cov[i - W] > 0, vd = y < H - 1 && cov[i + W] > 0;
        const dx = vl && vr ? (phi1[i + 1] - phi1[i - 1]) * 0.5 : vr ? phi1[i + 1] - p : vl ? p - phi1[i - 1] : 0;
        const dy = vu && vd ? (phi1[i + W] - phi1[i - W]) * 0.5 : vd ? phi1[i + W] - p : vu ? p - phi1[i - W] : 0;
        const g1 = sqrt(dx * dx + dy * dy);
        const ex = vl && vr ? (phi2[i + 1] - phi2[i - 1]) * 0.5 : vr ? phi2[i + 1] - q : vl ? q - phi2[i - 1] : 0;
        const ey = vu && vd ? (phi2[i + W] - phi2[i - W]) * 0.5 : vd ? phi2[i + W] - q : vu ? q - phi2[i - W] : 0;
        const g2 = sqrt(ex * ex + ey * ey);
        const p3 = phi3[i];
        const hx = vl && vr ? (phi3[i + 1] - phi3[i - 1]) * 0.5 : vr ? phi3[i + 1] - p3 : vl ? p3 - phi3[i - 1] : 0;
        const hy = vu && vd ? (phi3[i + W] - phi3[i - W]) * 0.5 : vd ? phi3[i + W] - p3 : vu ? p3 - phi3[i - W] : 0;
        const g3 = sqrt(hx * hx + hy * hy);
        // Square wave of the phase, its edge about 1.25 LEDs wide.
        const t1 = abs(p - 2 * floor(p * 0.5) - 1), t2 = abs(q - 2 * floor(q * 0.5) - 1);
        const s1 = cl(0.5 + (t1 - 0.5) / max(edge * g1, 0.02), 0, 1);
        const s2 = cl(0.5 + (t2 - 0.5) / max(edge * g2, 0.02), 0, 1);
        const t3 = abs(phi3[i] - 2 * floor(phi3[i] * 0.5) - 1);
        const s3 = cl(0.5 + (t3 - 0.5) / max(edge * g3, 0.02), 0, 1);
        const sa = s1 + s2 - 2 * s1 * s2;
        const s = sa + s3 - 2 * sa * s3;
        let tr = col[0] + (col[3] - col[0]) * s, tg = col[1] + (col[4] - col[1]) * s, tb = col[2] + (col[5] - col[2]) * s;
        // Where the stripes crowd below about 3 LEDs they melt into the rim tone.
        const fd = sm(0.33, 0.58, g1);
        tr += (col[0] * 0.7 - tr) * fd;
        tg += (col[1] * 0.7 - tg) * fd;
        tb += (col[2] * 0.7 - tb) * fd;
        // The surface turns edge-on toward the outline: darker there.
        const sh = 0.78 + 0.22 * sm(0, 0.25, nzA[i]);
        tr *= sh; tg *= sh; tb *= sh;
        r += (tr - r) * c;
        g += (tg - g) * c;
        b += (tb - b) * c;
      }
      rgb[o] = r;
      rgb[o + 1] = g;
      rgb[o + 2] = b;
    }
}

export function draw(display, P) {
  const rgb = P.rgb;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, rgb[o], rgb[o + 1], rgb[o + 2]);
    }
}
