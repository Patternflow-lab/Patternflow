// ===== Patternflow pattern =====
// Title:   Soddy Hexlet
// Family:  space
// Idea:    Six glossy coloured spheres ring two glass spheres inside a glass globe, each touching its two neighbours and all three glass ones, and roll round the ring swelling and shrinking as they pass the wide side of the gap while the ring leans up from a belt into a tall hoop, the whole scene reflected in a mirror floor below.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Soddy's hexlet (Frederick Soddy, 1937), a Steiner chain of six spheres closing for every starting sphere, pattern round 105
// Round:   105
// ===============================
// @matrix 64x128
// @knobs Tilt=0..1, Roll=-3..3, Inversion=1.8..3.4, Hue=0..1
//
// Knob 1: Tilt. The height of the eye over the mirror floor, from 34 degrees at 0, where the reflection hangs below the ring, to 70 degrees at 1, looking down into it.
// Knob 2: Roll. How fast the six go round their ring and which way: at 2 each takes its neighbour's place every 3.3 s, 3 is half as fast again, 0 holds the ring still and negative values turn it back.
// Knob 3: Inversion. How far the centre of the inversion sits off the axis of the globe. At 1.8 the widest of the six is on average 2.8 times the width of the narrowest and the ring leans over; at 3.4 it is 3.4 times and the ring stands up as a hoop with the big spheres at its foot.
// Knob 4: Hue. Turns the six colours, and with them the tint of the glass and the floor, round the wheel together; at 0 the six run from rose red through orange, yellow and green to cyan.

const W = 64, H = 128;
const { min, max, floor, sqrt, sin, cos, exp, pow, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The construction. In a flat picture the sphere C of radius 1 sits between
// two parallel planes z = 1 and z = -1 (A and B) that it touches, and six
// spheres of radius 1 stand on the middle plane, centres 2 from C, each
// touching C, both planes and its two neighbours. Turn that ring about C by
// any angle th and every touch holds, so the ring closes whatever sphere you
// start from. An inversion in a point P above both planes sends planes to
// spheres through P and spheres to spheres, and keeps every touch. P is the
// origin of the picture it makes: A' is the big sphere that holds the rest
// and B' hangs inside it from P, C' and the six hexlet spheres lie in the
// gap between them. The power of the inversion is chosen so that A' has
// radius 1 whatever P does.
const NS = 15, ZF = -1.85, RF = 4;
// Spheres 0 to 2 are the glass ones, A', B' and C'; 3 to 8 are the six, and
// 9 to 14 are small points of light at the six places where neighbours touch.
function build(o, px, py, pz, th) {
  const K = 2 * (pz - 1);
  // Planes n.x = h with n = (0, 0, 1): the plane through P-relative height hp
  // goes to the sphere of diameter K / |hp| standing on P.
  const hA = 1 - pz, hB = -1 - pz;
  o[0] = 0, o[1] = 0, o[2] = K / (2 * hA), o[3] = K / (2 * abs(hA));
  o[4] = 0, o[5] = 0, o[6] = K / (2 * hB), o[7] = K / (2 * abs(hB));
  for (let i = 2; i < 9; i++) {
    let cx = 0, cy = 0;
    if (i > 2) {
      const f = th + ((i - 3) * PI) / 3;
      cx = 2 * cos(f), cy = 2 * sin(f);
    }
    const ux = cx - px, uy = cy - py, uz = -pz, s = K / (ux * ux + uy * uy + uz * uz - 1), j = i * 4;
    o[j] = s * ux, o[j + 1] = s * uy, o[j + 2] = s * uz, o[j + 3] = abs(s);
  }
  // The kiss of two neighbours: on the line between their centres, a radius
  // of the first from its centre.
  for (let k = 0; k < 6; k++) {
    const a = (3 + k) * 4, b = (3 + ((k + 1) % 6)) * 4, w = o[a + 3] / (o[a + 3] + o[b + 3]), j = (9 + k) * 4;
    o[j] = o[a] + (o[b] - o[a]) * w, o[j + 1] = o[a + 1] + (o[b + 1] - o[a + 1]) * w, o[j + 2] = o[a + 2] + (o[b + 2] - o[a + 2]) * w;
    o[j + 3] = 0.04 + 0.12 * min(o[a + 3], o[b + 3]);
  }
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const S = {
    sph: new Float64Array(NS * 4), tmp: new Float64Array(NS * 4),
    pal: new Float32Array(6 * 6 + 12), palHue: -9,
    t: 0, th: 0.3, m: 1.8, tilt: 0, hue: 0, roll: 2,
    el: (34 * PI) / 180, az: PI, px: 1.8, py: 0, pz: 3,
    // The eye's frame and the light, made in update.
    r: [0, 1, 0], u: [0, 0, 1], f: [-1, 0, 0], L: [0, 0, 1],
    c3: [0, 0, 0], sc: 28, ca: 0, cb: 0, fit: false,
  };
  params.s = S;
  build(S.sph, S.px, S.py, S.pz, S.th);
  frame(S, 0);
}

// The eye, the light, and the zoom that holds the six spheres and their
// reflection in the panel. The picture is measured on the screen axes r
// (right) and u (up) about the middle of the globe, (0, 0, -1).
function frame(S, d) {
  const ce = cos(S.el), se = sin(S.el), ca = cos(S.az), sa = sin(S.az);
  S.f = [-ce * ca, -ce * sa, -se];
  S.r = [-sa, ca, 0];
  S.u = [-se * ca, -se * sa, ce];
  const r = S.r, u = S.u, f = S.f;
  const lx = -0.5 * r[0] + 0.7 * u[0] - 0.55 * f[0], ly = -0.5 * r[1] + 0.7 * u[1] - 0.55 * f[1], lz = -0.5 * r[2] + 0.7 * u[2] - 0.55 * f[2], ll = 1 / sqrt(lx * lx + ly * ly + lz * lz);
  S.L = [lx * ll, ly * ll, lz * ll];
  // The six, over a sixth of a turn of the ring, so the zoom does not pump as
  // the big sphere changes hands.
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const sp = S.tmp;
  for (let q = 0; q < 4; q++) {
    build(sp, S.px, S.py, S.pz, S.th + (q * PI) / 12);
    for (let i = 3; i < 9; i++) {
      const j = i * 4, R = sp[j + 3], dx = sp[j], dy = sp[j + 1], dz = sp[j + 2] + 1;
      const a = dx * r[0] + dy * r[1] + dz * r[2], b = dx * u[0] + dy * u[1] + dz * u[2];
      x0 = min(x0, a - R), x1 = max(x1, a + R), y0 = min(y0, b - R), y1 = max(y1, b + R);
    }
  }
  // The six fill the panel's width or the upper three quarters of its height,
  // and the reflection takes what is left below.
  const sc = cl(min(58 / (x1 - x0), 78 / (y1 - y0)), 18, 64), ca2 = (x0 + x1) / 2, cb2 = (y0 + y1) / 2 - (64 - 46 - 16 * S.tilt) / sc;
  if (!S.fit || d <= 0) (S.sc = sc), (S.ca = ca2), (S.cb = cb2), (S.fit = true);
  else {
    const a = 1 - exp(-d * 0.8);
    S.sc += (sc - S.sc) * a;
    S.ca += (ca2 - S.ca) * a;
    S.cb += (cb2 - S.cb) * a;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  const a = 1 - exp(-d * 2.5);
  S.tilt += (cl(k[0], 0, 1) - S.tilt) * a;
  S.roll += (cl(k[1], -3, 3) - S.roll) * a;
  S.m += (cl(k[2], 1.8, 3.4) - S.m) * a;
  S.hue = cl(k[3], 0, 1);
  S.th += d * 0.16 * S.roll;
  // The centre of the inversion drifts to and from the axis a little, so the
  // ring breathes between a flatter and a taller shape.
  const m = S.m * (1 + 0.22 * sin(S.t * 0.37));
  S.px = m;
  S.py = 0.5 * m * sin(S.t * 0.21 + 1);
  S.pz = 3 + 0.35 * sin(S.t * 0.29);
  build(S.sph, S.px, S.py, S.pz, S.th);
  S.el = (34 + 36 * S.tilt) * (PI / 180);
  S.az = PI + 0.5 * sin(S.t * 0.16);
  frame(S, d);
}

function palette(S) {
  const p = S.pal, base = S.hue + 0.93;
  for (let b = 0; b < 6; b++) {
    const h = base + 0.115 * b;
    hsv(h, 0.78, 1, p, b * 6);
    // In shade a hue goes toward violet, so red does not turn brown.
    hsv(h - 0.07, 0.92, 0.4, p, b * 6 + 3);
  }
  hsv(base + 0.45, 0.32, 1, p, 36);
  hsv(base + 0.62, 0.55, 1, p, 39);
  hsv(base + 0.2, 0.5, 1, p, 42);
  S.palHue = S.hue;
}

// One glossy sphere's colour at a hit.
function bead(S, i, px, py, pz, dx, dy, dz, out) {
  const sp = S.sph, j = i * 4, R = sp[j + 3], pal = S.pal, L = S.L;
  const nx = (px - sp[j]) / R, ny = (py - sp[j + 1]) / R, nz = (pz - sp[j + 2]) / R;
  const nl = nx * L[0] + ny * L[1] + nz * L[2], diff = nl > 0 ? nl : 0;
  const nv = max(0, -(nx * dx + ny * dy + nz * dz));
  let hx = L[0] - dx, hy = L[1] - dy, hz = L[2] - dz;
  const hl = 1 / sqrt(hx * hx + hy * hy + hz * hz), nh = max(0, (nx * hx + ny * hy + nz * hz) * hl);
  // Occlusion from the five others, strongest at the touches.
  let occ = 0;
  for (let q = 3; q < 9; q++) {
    if (q === i) continue;
    const qj = q * 4, vx = sp[qj] - px, vy = sp[qj + 1] - py, vz = sp[qj + 2] - pz, d2 = vx * vx + vy * vy + vz * vz, dd = sqrt(d2), c = (nx * vx + ny * vy + nz * vz) / dd;
    if (c > 0) occ += (sp[qj + 3] * sp[qj + 3] / d2) * c;
  }
  const ao = 1 - min(0.8, occ * 0.75), b = (i - 3) * 6;
  const fr = (1 - nv) * (1 - nv) * (1 - nv);
  const rz = dz - 2 * (dx * nx + dy * ny + dz * nz) * nz;
  // Sky above, the lit floor's glow below.
  const sky = rz > 0 ? 0.3 + 0.5 * rz : 0.28 * exp(rz * 1.5);
  const m = (0.1 + 0.9 * diff) * (0.4 + 0.6 * ao);
  const sp1 = pow(nh, 80) * 0.95 * ao + pow(nh, 14) * 0.1 * ao, env = (0.06 + 0.55 * fr) * sky;
  for (let c = 0; c < 3; c++) out[c] = (pal[b + 3 + c] + (pal[b + c] - pal[b + 3 + c]) * m) * (0.55 + 0.45 * ao) + sp1 + env * pal[36 + c] + fr * 0.28 * pal[b + c];
}

// What the glass spheres add on a ray up to t = tm: a rim where the ray
// meets the near wall and a fainter one where it leaves by the far wall, and
// a bright point of window light on the near wall.
function glass(S, ox, oy, oz, dx, dy, dz, tm, out) {
  const sp = S.sph, pal = S.pal, L = S.L;
  for (let i = 0; i < 3; i++) {
    const j = i * 4, cx = ox - sp[j], cy = oy - sp[j + 1], cz = oz - sp[j + 2], R = sp[j + 3];
    const b = cx * dx + cy * dy + cz * dz, c = cx * cx + cy * cy + cz * cz - R * R, dd = b * b - c;
    if (dd <= 0) continue;
    const sq = sqrt(dd), t0 = -b - sq, t1 = -b + sq, w = i === 0 ? 0.5 : 0.7, cb = i === 0 ? 36 : i === 1 ? 39 : 42;
    if (t0 > 1e-4 && t0 < tm) {
      const nx = (cx + dx * t0) / R, ny = (cy + dy * t0) / R, nz = (cz + dz * t0) / R, nv = max(0, -(nx * dx + ny * dy + nz * dz));
      const rim = pow(1 - nv, 3.2) * w;
      let hx = L[0] - dx, hy = L[1] - dy, hz = L[2] - dz;
      const hl = 1 / sqrt(hx * hx + hy * hy + hz * hz), nh = max(0, (nx * hx + ny * hy + nz * hz) * hl), s = pow(nh, 110) * 0.9 * (i === 0 ? 0.8 : 1);
      for (let q = 0; q < 3; q++) out[q] += rim * pal[cb + q] + s;
    }
    if (t1 > 1e-4 && t1 < tm) {
      const nx = (cx + dx * t1) / R, ny = (cy + dy * t1) / R, nz = (cz + dz * t1) / R, nv = max(0, nx * dx + ny * dy + nz * dz);
      const rim = pow(1 - nv, 3.2) * w * 0.4;
      for (let q = 0; q < 3; q++) out[q] += rim * pal[cb + q];
    }
  }
}

// A ray into the scene. The floor is a mirror that fades into the dark away
// from the globe; a ray from it up into the scene has no floor to meet.
function trace(S, ox, oy, oz, dx, dy, dz, refl, out) {
  const sp = S.sph;
  let tb = 1e9, bi = -1;
  for (let i = 3; i < NS; i++) {
    const j = i * 4, cx = ox - sp[j], cy = oy - sp[j + 1], cz = oz - sp[j + 2], R = sp[j + 3];
    const b = cx * dx + cy * dy + cz * dz, dd = b * b - (cx * cx + cy * cy + cz * cz - R * R);
    if (dd > 0) {
      const t = -b - sqrt(dd);
      if (t > 1e-4 && t < tb) (tb = t), (bi = i);
    }
  }
  out[0] = out[1] = out[2] = 0;
  let te = tb;
  if (!refl && dz < -1e-6) {
    const tf = (ZF - oz) / dz;
    if (tf < tb) {
      const qx = ox + dx * tf, qy = oy + dy * tf, g = exp(-(qx * qx + qy * qy) / (RF * RF)), c3 = S.c3;
      te = tf;
      // A dim floor with three faint rings round the foot of the globe.
      const rho = sqrt(qx * qx + qy * qy), e = (rho - 1.15) / 0.05, e2 = (rho - 2) / 0.05, e3 = (rho - 2.85) / 0.05;
      const base = (0.045 + 0.09 * g) + 0.1 * g * (exp(-e * e) + 0.7 * exp(-e2 * e2) + 0.5 * exp(-e3 * e3));
      out[0] = S.pal[39] * base, out[1] = S.pal[40] * base, out[2] = S.pal[41] * base;
      trace(S, qx, qy, ZF, dx, dy, -dz, true, c3);
      const w = 0.55 * g;
      out[0] += c3[0] * w, out[1] += c3[1] * w, out[2] += c3[2] * w;
      glass(S, ox, oy, oz, dx, dy, dz, tf, out);
      return;
    }
  }
  if (bi >= 9) {
    // A kiss: pale light with the tint of the two spheres it joins.
    const p = S.pal, a = (bi - 9) * 6, b = ((bi - 8) % 6) * 6;
    for (let c = 0; c < 3; c++) out[c] = 0.7 + 0.15 * (p[a + c] + p[b + c]);
  } else if (bi >= 0) bead(S, bi, ox + dx * tb, oy + dy * tb, oz + dz * tb, dx, dy, dz, out);
  glass(S, ox, oy, oz, dx, dy, dz, te, out);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.palHue !== S.hue) palette(S);
  const r = S.r, u = S.u, f = S.f, sc = S.sc, o = [0, 0, 0], acc = [0, 0, 0];
  // The eye looks at the middle of the globe, A' at (0, 0, -1); rays are
  // parallel, a long way back.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      acc[0] = acc[1] = acc[2] = 0;
      for (let sy = 0; sy < 2; sy++)
        for (let sx = 0; sx < 2; sx++) {
          const a = (x + 0.25 + 0.5 * sx - 32) / sc + S.ca, b = (64 - (y + 0.25 + 0.5 * sy)) / sc + S.cb;
          const ox = a * r[0] + b * u[0] - 20 * f[0], oy = a * r[1] + b * u[1] - 20 * f[1], oz = -1 + a * r[2] + b * u[2] - 20 * f[2];
          trace(S, ox, oy, oz, f[0], f[1], f[2], false, o);
          acc[0] += o[0], acc[1] += o[1], acc[2] += o[2];
        }
      display.setPixel(x, y, cl(acc[0] * 0.25, 0, 1) * 255, cl(acc[1] * 0.25, 0, 1) * 255, cl(acc[2] * 0.25, 0, 1) * 255);
    }
}
