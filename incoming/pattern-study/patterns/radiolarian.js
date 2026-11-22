// ===== Patternflow pattern =====
// Title:   Radiolarian
// Family:  radiolaria
// Idea:    Three glass radiolarian skeletons drift and tumble in dark blue water, a big one 54 LEDs across, a smaller one 34 and a dim far one 18, each a geodesic lattice sphere of round pores with a teal inner shell glowing through it, radial beams and needles standing out from the nodes, lit by one warm lamp from the upper left.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: The silica skeletons of radiolarians, single-celled sea plankton, drawn in Ernst Haeckel's Die Radiolarien (1862) and his Challenger report on the Radiolaria (1887), among them a species whose skeleton is an icosahedron; the geodesic sphere of frequency n on an icosahedron is the one of Buckminster Fuller's domes (1954)
// Round:   218
// ===============================
// @matrix 64x128
// @knobs Hue=0..0.85, Spin=0..3, Mesh=-1..1, Spines=-1..1
//
// Knob 1: Hue. Turns the glass round a wheel that skips red and orange, 0.115 + 0.8 of a turn at the full knob. At the opening 0 the outer shell is amber-gold (255, 190, 46), the inner shell teal and the cell body violet; at 0.2 the outer glass is green and the inner one violet; at 0.4 the outer is cyan-green and the inner one violet-blue; at 0.85 the outer is violet and the inner one lime green. The water stays deep blue.
// Knob 2: Spin. How fast the specimens tumble. At the opening 2 the big one turns at 0.071 and 0.046 rad/s about two tilted axes and the small one at 0.103 and 0.061 rad/s the other way, each rate swelling and easing by about 40 percent over 3 to 4 minutes, so the surface moves about 2 LEDs a second at the centre of the disc; at 3 it is half as fast again; at 0 the turning is a thirtieth of that, nearly still, while the drift across the panel goes on at the same pace.
// Knob 3: Mesh. The pore count of the big shell, from 42 pores at -1 (about 18 LEDs across, a coarse cage) through 252 at the opening 0 (5 to 7 LEDs across) to 492 at 1 (about 5 LEDs across at the face centres, thinning into a soft gold glow near the rim). The lattice is a geodesic sphere, so the knob steps its frequency 2 to 7, and the small shell follows at 2 to 4. A step cross-fades the old and the new lattice over 0.7 s.
// Knob 4: Spines. The needles and the beams. At -1 the shells are bald and smooth, with no beams. At the opening 0.06 the 12 main needles are 5.4 LEDs long on the big shell and 4.2 on the small one, with 14 shorter ones, and about 28 radial beams join outer and inner shell. At 1 the main needles are 14 LEDs long on the big shell (11 on the small one), 2.3 LEDs wide at the root, and run off the panel edge.

// The panel is a dark field under a microscope, 64 LEDs wide and 128 tall. Each specimen is a ray-traced
// sphere: a pixel inside its disc is a ray along z, and the lattice is looked up where the ray meets the
// outer shell (radius R), the inner shell (0.52 R), the far side of the inner shell and the far side of
// the outer shell, front to back, each layer letting some of the light behind it through. The big shell is
// 27 LEDs in radius, the small one 17 and the far one 9 at 50 percent brightness, so they read as three
// distances. The big one sits in the upper half, the small one lower and to the left, the far one lower right.
// The lattice is a frequency-n geodesic sphere on an icosahedron (V = 10 n^2 + 2 nodes: 42, 92, 162, 252,
// 362, 492). Each of the 20 faces is a flat triangular lattice seen by gnomonic projection, so a pixel finds
// its face (the face of the last pixel is tried first, and only a miss searches the 20), its nearest node by
// rounding in cube coordinates, and its distance to the cell wall by a hexagon metric mixed 60/40 with a
// round one. The wall is the glass: a strut 1.5 to 3 LEDs wide that swells at the nodes. The cell is a
// pore, hexagonal with rounded corners (pentagonal at the 12 icosahedron nodes). The strut is a half
// cylinder, so its normal tilts across it, and the lamp's highlight runs along the side of each strut that
// faces it. The side turned from the lamp is lit by a cool fill instead of a dim amber, since dim amber on
// an LED is brown. Once a pore is under about 3 LEDs across the lattice fades to a faint veil, and near
// the limb, where cells are squeezed, the struts close up into the bright rim.
// The inner shell has frequency 2, or 3 on a fine mesh, and the cell body is a soft violet glow at the middle.
// The needles stand on the 12 icosahedron nodes plus 14 chosen nodes of the lattice, so they stay on the
// same nodes while the specimen turns. Each is drawn from its node outward along the radius, 2.3 LEDs wide
// at the root for the main ones and 2 for the short ones, tapering to under 1 LED at the tip, with a soft
// glow. Needles on the far side show through the glass at under half brightness. A beam runs from a node
// of the outer shell straight in to the inner shell, and on the panel it is a line through the middle.
// Each specimen turns by two rotations about two tilted axes at rates with no common period, each rate
// swelling and easing with its own slow sine, and the first axis itself precesses, so the view does not
// repeat. The specimens drift across the panel on sums of three slow sines each, 5 to 12 LEDs in all, and
// breathe up to 5 percent in size, as if moving a little toward and away from the lens.
// Around each specimen a faint glow falls off over about 5.5 LEDs, heavier on the side away from the lamp.
// The water is a gradient from navy at the top to near black at the bottom, a warm wash in the lamp's
// corner, a slow cool swell, and 16 out of focus motes 3 to 6 LEDs across at 6 to 13 percent brightness.
// Nothing here is state that can grow: the picture at second 0 is the one the specimens would have anyway.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sin, cos, exp, sqrt, abs, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const fr = (v) => v - floor(v);
const F = (n) => new Float32Array(n);

// ---- tunables
const RHO = 0.52; // radius of the inner shell against the outer
const REACH = 16; // how far past the outer shell the glow is worked
const NMOTE = 16;
const SPEC_BIG = { R: 27, spin1: 0.071, spin2: -0.046, needle: 14, ws: 1.0, amp: 1.0 };
const SPEC_SMALL = { R: 17, spin1: -0.103, spin2: 0.061, needle: 11, ws: 0.92, amp: 0.88 };
const SPEC_FAR = { R: 9, spin1: 0.131, spin2: -0.083, needle: 6, ws: 0.9, amp: 0.5 };
const FADE_S = 0.7; // seconds a lattice step takes to cross-fade
const SQ3H = 0.8660254; // sqrt(3) / 2
const COOL = [0.62, 0.8, 1.0]; // the fill light on the glass, from the water

// the lamp: warm, up and to the left of the viewer, in front. Screen x runs right, y down, z away from
// the viewer, so the viewer is at -z and a surface facing the viewer has its normal at -z.
// The lamp wanders a few degrees on two slow sines, so the glints crawl over the struts.
let LDX = 0, LDY = 0, LDZ = 0, HX = 0, HY = 0, HZ = 0;
function aimLamp(t) {
  const x = -0.45 + 0.17 * sin(0.0493 * t + 0.4), y = -0.55 + 0.13 * sin(0.0371 * t + 1.3), z = -0.7 + 0.08 * sin(0.0287 * t + 2.6);
  const l = sqrt(x * x + y * y + z * z);
  LDX = x / l;
  LDY = y / l;
  LDZ = z / l;
  const hx = LDX, hy = LDY, hz = LDZ - 1, hl = sqrt(hx * hx + hy * hy + hz * hz);
  HX = hx / hl;
  HY = hy / hl;
  HZ = hz / hl;
}
aimLamp(0);

const TONE = F(1024); // soft shoulder: linear to 0.62, then rolls toward 1
for (let i = 0; i < 1024; i++) {
  const v = i / 256;
  TONE[i] = v < 0.62 ? v : 0.62 + 0.38 * (1 - exp(-(v - 0.62) / 0.38));
}

function hsv(h, s, v, out) {
  h -= floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[0] = f(5);
  out[1] = f(3);
  out[2] = f(1);
}

// ---- the icosahedron, once. Faces carry an orthonormal frame in the face plane, e1 along the edge v0 v1
// and e2 toward v2, so a lattice with its axes along e1 puts v0, v1 and v2 on lattice nodes.
const PHI = (1 + sqrt(5)) / 2;
const IVERT = [];
for (const a of [-1, 1])
  for (const b of [-1, 1]) {
    for (const p of [[0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]]) {
      const l = sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
      IVERT.push([p[0] / l, p[1] / l, p[2] / l]);
    }
  }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const l = sqrt(dot(a, a));
  return [a[0] / l, a[1] / l, a[2] / l];
};
const FACEV = [];
{
  const e2 = 4 / (1 + PHI * PHI);
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++) {
        const d = (a, b) => dot(sub(IVERT[a], IVERT[b]), sub(IVERT[a], IVERT[b]));
        if (abs(d(i, j) - e2) < 1e-6 && abs(d(j, k) - e2) < 1e-6 && abs(d(i, k) - e2) < 1e-6) FACEV.push([i, j, k]);
      }
}
const FD = new Float64Array(20), FC1 = new Float64Array(20), FC2 = new Float64Array(20);
const FO = new Float64Array(20 * 24); // object space: n, e1, e2, three edge plane normals
let LSIDE = 0;
FACEV.forEach(([ia, ib, ic], f) => {
  const a = IVERT[ia], b = IVERT[ib], c = IVERT[ic];
  const e1 = unit(sub(b, a));
  const ac = sub(c, a), pr = dot(ac, e1);
  const e2 = unit([ac[0] - pr * e1[0], ac[1] - pr * e1[1], ac[2] - pr * e1[2]]);
  const n = unit([a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]]);
  const edge = (p, q, r) => {
    let m = unit(cross(p, q));
    if (dot(m, r) < 0) m = [-m[0], -m[1], -m[2]];
    return m;
  };
  const m0 = edge(a, b, c), m1 = edge(b, c, a), m2 = edge(c, a, b);
  const o = f * 24;
  [n, e1, e2, m0, m1, m2].forEach((v, i) => {
    FO[o + i * 3] = v[0];
    FO[o + i * 3 + 1] = v[1];
    FO[o + i * 3 + 2] = v[2];
  });
  FD[f] = dot(a, n);
  FC1[f] = dot(a, e1);
  FC2[f] = dot(a, e2);
  LSIDE = sqrt(dot(sub(b, a), sub(b, a)));
});
const D0 = FD[0];
const INV_D = 1 / D0;
const INV_L = 1 / LSIDE;

// The nodes of the frequency-n geodesic, and which of them carry a needle or a beam.
const MESHES = [];
function mesh(n) {
  if (MESHES[n]) return MESHES[n];
  const seen = new Map(), pts = [];
  FACEV.forEach(([ia, ib, ic]) => {
    const a = IVERT[ia], b = IVERT[ib], c = IVERT[ic];
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n - i; j++) {
        const p = unit([
          a[0] + (i / n) * (b[0] - a[0]) + (j / n) * (c[0] - a[0]),
          a[1] + (i / n) * (b[1] - a[1]) + (j / n) * (c[1] - a[1]),
          a[2] + (i / n) * (b[2] - a[2]) + (j / n) * (c[2] - a[2]),
        ]);
        const key = round(p[0] * 2000) + "_" + round(p[1] * 2000) + "_" + round(p[2] * 2000);
        if (!seen.has(key)) {
          seen.set(key, true);
          pts.push(p);
        }
      }
  });
  const V = pts.length, rest = max(1, V - 12);
  const spines = [], beams = [];
  for (const p of pts) {
    const h1 = fr(sin(p[0] * 127.1 + p[1] * 311.7 + p[2] * 74.7) * 43758.5453);
    const h2 = fr(sin(p[0] * 269.5 + p[1] * 183.3 + p[2] * 246.1) * 43758.5453);
    let primary = false;
    for (const q of IVERT) if (dot(p, q) > 0.99999) primary = true;
    if (primary) spines.push({ p, len: 0.85 + 0.3 * h2, w: 1.15 });
    else if (h1 < 14 / rest) spines.push({ p, len: 0.3 + 0.35 * h2, w: 1.0 });
    if (primary || h2 < 16 / rest) beams.push(p);
  }
  return (MESHES[n] = { V, spines, beams });
}
for (let n = 2; n <= 9; n++) mesh(n);

// ---- rotations
function rodrigues(ax, ay, az, th, m) {
  const l = sqrt(ax * ax + ay * ay + az * az);
  const x = ax / l, y = ay / l, z = az / l, c = cos(th), s = sin(th), t = 1 - c;
  m[0] = t * x * x + c; m[1] = t * x * y - s * z; m[2] = t * x * z + s * y;
  m[3] = t * x * y + s * z; m[4] = t * y * y + c; m[5] = t * y * z - s * x;
  m[6] = t * x * z - s * y; m[7] = t * y * z + s * x; m[8] = t * z * z + c;
}
const TA = new Float64Array(9), TB = new Float64Array(9);
function mul3(a, b, o) {
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
}

// The face frames, the 20 normals and so on, rotated into view space, and the lamp and half vector in each
// face frame, so the pixel loop never rotates anything.
function viewFaces(M, fv) {
  for (let f = 0; f < 20; f++) {
    const o = f * 24;
    for (let v = 0; v < 6; v++) {
      const x = FO[o + v * 3], y = FO[o + v * 3 + 1], z = FO[o + v * 3 + 2];
      fv[o + v * 3] = M[0] * x + M[1] * y + M[2] * z;
      fv[o + v * 3 + 1] = M[3] * x + M[4] * y + M[5] * z;
      fv[o + v * 3 + 2] = M[6] * x + M[7] * y + M[8] * z;
    }
    fv[o + 18] = fv[o + 3] * HX + fv[o + 4] * HY + fv[o + 5] * HZ;
    fv[o + 19] = fv[o + 6] * HX + fv[o + 7] * HY + fv[o + 8] * HZ;
    fv[o + 20] = fv[o + 3] * LDX + fv[o + 4] * LDY + fv[o + 5] * LDZ;
    fv[o + 21] = fv[o + 6] * LDX + fv[o + 7] * LDY + fv[o + 8] * LDZ;
  }
}

// ---- the lattice lookup. Results go to module scalars so the hot loop allocates nothing.
let LE = 0, LQN = 1, LQ1 = 0, LQ2 = 0, LA0 = 0, LA1 = 0, LA2 = 0, LDU = 0, LDV = 0, LPE = 0;
function lk(qx, qy, qz, fv, f, nn) {
  let o = f * 24;
  if (
    qx * fv[o + 9] + qy * fv[o + 10] + qz * fv[o + 11] < -1e-7 ||
    qx * fv[o + 12] + qy * fv[o + 13] + qz * fv[o + 14] < -1e-7 ||
    qx * fv[o + 15] + qy * fv[o + 16] + qz * fv[o + 17] < -1e-7
  ) {
    let best = -2;
    for (let g = 0; g < 20; g++) {
      const b = g * 24, d = qx * fv[b] + qy * fv[b + 1] + qz * fv[b + 2];
      if (d > best) {
        best = d;
        f = g;
      }
    }
    o = f * 24;
  }
  const qn = qx * fv[o] + qy * fv[o + 1] + qz * fv[o + 2];
  const q1 = qx * fv[o + 3] + qy * fv[o + 4] + qz * fv[o + 5];
  const q2 = qx * fv[o + 6] + qy * fv[o + 7] + qz * fv[o + 8];
  const w = D0 / qn, k = nn * INV_L;
  const U = (w * q1 - FC1[f]) * k, V = (w * q2 - FC2[f]) * k;
  const j = V * 1.1547005, i = U - 0.5 * j, kk = -i - j;
  let ri = round(i), rj = round(j);
  const rk = round(kk);
  const di = abs(ri - i), dj = abs(rj - j), dk = abs(rk - kk);
  if (di > dj && di > dk) ri = -rj - rk;
  else if (dj > dk) rj = -ri - rk;
  const oi = i - ri, oj = j - rj;
  const a0 = oi + 0.5 * oj, a1 = 0.5 * oi + oj, a2 = 0.5 * (oj - oi);
  const du = a0, dv = oj * SQ3H;
  const pe = sqrt(oi * oi + oi * oj + oj * oj);
  const m = max(abs(a0), abs(a1), abs(a2));
  LE = 0.5 - (0.6 * m + 0.4 * pe);
  LQN = qn;
  LQ1 = q1;
  LQ2 = q2;
  LA0 = a0;
  LA1 = a1;
  LA2 = a2;
  LDU = du;
  LDV = dv;
  LPE = pe;
  return f;
}

// Strut coverage at a lookup, with the lattice faded to its mean once the pores fall under about 4 LEDs.
let LC = 0, LSN = 0, LFA = 1;
function strut(qx, qy, qz, fv, f, nn, Rp, ws0) {
  f = lk(qx, qy, qz, fv, f, nn);
  const cv = abs(qz);
  const S = Rp * (LSIDE / nn) * LQN * sqrt(LQN) * INV_D * (0.5 + 0.5 * cv); // LEDs per lattice unit
  const e = (LE > 0 ? LE : 0) * S;
  const ws = cl(0.085 * S + 0.12, 0.62, 1.6) * ws0;
  let c = cl((ws + 0.55 - e) / 1.1, 0, 1);
  c = c * c * (3 - 2 * c);
  const fa = sm(2.0, 3.4, S * (0.65 + 0.35 * cv));
  const half = 0.5 * S, po = half > ws ? (half - ws) / half : 0;
  const cm = (1 - po * po) * 0.42;
  LC = cm + (c - cm) * fa;
  LSN = min(1, e / ws) * fa;
  LFA = fa;
  return f;
}

// The tilt of a strut's surface across it, toward the inside of the cell, in the face's frame; then the
// normal's dot with the lamp and with the half vector. Results in LDIF and LSPC.
let LDIF = 0, LSPC = 0;
function lamp(px, py, pz, fv, f) {
  const o = f * 24;
  let gx, gy;
  const A0 = abs(LA0), A1 = abs(LA1), A2 = abs(LA2);
  if (A0 >= A1 && A0 >= A2) {
    gx = LA0 > 0 ? 1 : -1;
    gy = 0;
  } else if (A1 >= A2) {
    gx = LA1 > 0 ? 0.5 : -0.5;
    gy = LA1 > 0 ? SQ3H : -SQ3H;
  } else {
    gx = LA2 > 0 ? -0.5 : 0.5;
    gy = LA2 > 0 ? SQ3H : -SQ3H;
  }
  const ip = 0.4 / (LPE + 1e-4);
  let tx = -(0.6 * gx + ip * LDU), ty = -(0.6 * gy + ip * LDV);
  const tl = sqrt(tx * tx + ty * ty) + 1e-6;
  tx /= tl;
  ty /= tl;
  const gp = tx * LQ1 + ty * LQ2;
  const inv = 1 / sqrt(max(0.04, 1 - gp * gp));
  const pH = px * HX + py * HY + pz * HZ, pL = px * LDX + py * LDY + pz * LDZ;
  const sn = LSN, cs = sqrt(max(0, 1 - sn * sn));
  const nH = pH * cs + (tx * fv[o + 18] + ty * fv[o + 19] - gp * pH) * inv * sn;
  const nL = pL * cs + (tx * fv[o + 20] + ty * fv[o + 21] - gp * pL) * inv * sn;
  LDIF = nL > 0 ? nL : 0;
  if (nH > 0) {
    const s2 = nH * nH, s4 = s2 * s2, s8 = s4 * s4;
    LSPC = s8 * s8 * 0.8 + s4 * 0.22;
  } else LSPC = 0;
}

// ---- state and knobs
export function setup(params) {
  const S = {
    t: 37, first: true, u: 0, spin: 1, nf: 5.3, u4: 0.53,
    R: F(N), G: F(N), B: F(N),
    ox: [0, 0, 0], ix: [0, 0, 0], sh: [0, 0, 0], cx: [0, 0, 0], bx: [0, 0, 0], lamp: [1, 0.93, 0.8], wat: [0, 0, 0], wat2: [0, 0, 0],
    sp: [mkSpec(SPEC_BIG, 0.7, 1.9, [0.38, 0.9, 0.2], [-0.7, 0.3, 0.6], 0.9, 2.3), mkSpec(SPEC_SMALL, 2.6, 0.5, [-0.5, 0.6, 0.62], [0.4, -0.8, 0.45], 4.1, 0.8), mkSpec(SPEC_FAR, 5.1, 3.3, [0.2, -0.7, 0.6], [0.8, 0.3, -0.5], 2.2, 1.1)],
    mx: F(NMOTE), my: F(NMOTE), mvx: F(NMOTE), mvy: F(NMOTE), ms: F(NMOTE), ma: F(NMOTE), mph: F(NMOTE), mh: F(NMOTE),
  };
  for (let i = 0; i < NMOTE; i++) {
    S.mx[i] = ((i * 37.7 + 11) % 76) - 6;
    S.my[i] = ((i * 53.3 + 23) % 140) - 6;
    const a = i * 2.399;
    const v = 0.4 + 0.9 * fr(i * 0.618);
    S.mvx[i] = cos(a) * v;
    S.mvy[i] = sin(a) * v * 0.8 - 0.15;
    S.ms[i] = 1.5 + 1.6 * fr(i * 0.381);
    S.ma[i] = 0.06 + 0.07 * fr(i * 0.717);
    S.mph[i] = i * 1.7;
    S.mh[i] = i % 5 === 0 ? 0.13 : 0.56 + 0.05 * fr(i * 0.31);
  }
  params.s = S;
}

function mkSpec(base, ph1, ph2, ax1, ax2, ph, dx) {
  return {
    ...base, ph1, ph2, ax1, ax2, ph, dx,
    th1: ph1, th2: ph2, cx: 32, cy: 64, Rr: base.R,
    n: 5, nPrev: 5, fade: 1, nI: 3,
    M: new Float64Array(9), fv: new Float64Array(480),
  };
}

const meshN = (nf, sp) => (sp.R > 20 ? cl(round(nf), 2, 7) : sp.R > 12 ? cl(round(nf * 0.55), 2, 4) : 2);
const innerN = (n, sp) => (sp.R > 12 && n >= (sp.R > 20 ? 6 : 4) ? 3 : 2);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const u = cl(k[0], 0, 0.85), spin = 0.03 + 0.97 * cl(k[1], 0, 3) / 2, nf = 2 + 5.4 * (cl(k[2], -1, 1) + 1) / 2, u4 = (cl(k[3], -1, 1) + 1) / 2;
  S.u = u;
  if (S.first) {
    S.first = false;
    S.spin = spin;
    S.nf = nf;
    S.u4 = u4;
    for (const sp of S.sp) {
      sp.n = meshN(nf, sp);
      sp.nPrev = sp.n;
      sp.fade = 1;
    }
  } else {
    const e = 1 - exp(-d / 0.3);
    S.spin += (spin - S.spin) * e;
    S.u4 += (u4 - S.u4) * e;
    S.nf = nf;
    for (const sp of S.sp) {
      const want = meshN(nf, sp), sc = sp.R > 20 ? nf : nf * 0.55;
      if (want !== sp.n && abs(sc - sp.n) > 0.62) {
        sp.nPrev = sp.n;
        sp.n = want;
        sp.fade = 0;
      }
      if (sp.fade < 1) sp.fade = min(1, sp.fade + d / FADE_S);
    }
  }
  S.t += d;
  const t = S.t;
  // drift: three slow sines each way, no common period
  const b = S.sp[0], s = S.sp[1], f = S.sp[2];
  b.cx = 33 + 3.4 * sin(0.0431 * t + 0.7) + 2.2 * sin(0.0197 * t + 2.1) + 1.2 * sin(0.0701 * t);
  b.cy = 37 + 5.0 * sin(0.0367 * t + 1.9) + 3.2 * sin(0.0153 * t + 0.4) + 1.2 * sin(0.0613 * t + 1.1);
  b.Rr = b.R * (1 + 0.03 * sin(0.0521 * t + 0.3) + 0.02 * sin(0.0237 * t + 1.7));
  s.cx = 25 + 6.5 * sin(0.0319 * t + 3.0) + 3.5 * sin(0.0127 * t + 1.0) + 1.5 * sin(0.0617 * t + 2.2);
  s.cy = 98 + 5.0 * sin(0.0293 * t + 0.2) + 3.5 * sin(0.0113 * t + 4.0) + 1.2 * sin(0.0577 * t + 0.6);
  s.Rr = s.R * (1 + 0.026 * sin(0.0467 * t + 2.0) + 0.018 * sin(0.0211 * t + 0.4));
  f.cx = 50 + 6.0 * sin(0.0253 * t + 1.4) + 3.0 * sin(0.0139 * t) + 1.2 * sin(0.0561 * t + 0.8);
  f.cy = 108 + 6.0 * sin(0.0271 * t + 2.6) + 3.0 * sin(0.0097 * t + 1.2) + 1.0 * sin(0.0587 * t + 0.3);
  f.Rr = f.R * (1 + 0.03 * sin(0.041 * t + 0.9) + 0.02 * sin(0.0173 * t + 2.3));
  for (const sp of S.sp) {
    sp.th1 += d * sp.spin1 * S.spin * (1 + 0.45 * sin(0.037 * t + sp.ph));
    sp.th2 += d * sp.spin2 * S.spin * (1 + 0.4 * sin(0.029 * t + 2 * sp.ph));
  }
  // motes
  for (let i = 0; i < NMOTE; i++) {
    S.mx[i] += (S.mvx[i] + 0.25 * sin(0.113 * t + S.mph[i])) * d;
    S.my[i] += (S.mvy[i] + 0.2 * sin(0.087 * t + 2 * S.mph[i])) * d;
    if (S.mx[i] < -7) S.mx[i] += 78;
    else if (S.mx[i] > 71) S.mx[i] -= 78;
    if (S.my[i] < -7) S.my[i] += 142;
    else if (S.my[i] > 135) S.my[i] -= 142;
  }
}

function palette(S) {
  const u = S.u;
  hsv(0.115 + 0.8 * u, 0.82, 1.0, S.ox);
  hsv(0.115 + 0.8 * fr(u + 0.47), 0.82, 0.9, S.ix);
  hsv(0.115 + 0.8 * fr(u + 0.8), 0.7, 0.9, S.cx);
  hsv(0.115 + 0.8 * u + 0.012, 0.6, 1.0, S.bx);
  for (let i = 0; i < 3; i++) S.sh[i] = S.ox[i] * 0.22 + 0.78 * COOL[i];
  hsv(0.62 + 0.03 * u, 0.9, 0.3, S.wat);
  hsv(0.6 + 0.03 * u, 0.9, 0.18, S.wat2);
}

// ---- drawing
// One specimen at lattice frequency nO, its light scaled by wgt (so a cross-fade is two calls).
function drawSpec(S, sp, nO, wgt) {
  const nI = innerN(nO, sp), mo = mesh(nO);
  const R = sp.Rr, Ri = R * RHO, cx = sp.cx, cy = sp.cy, fv = sp.fv;
  const { R: RR, G: GG, B: BB, ox, ix, cx: cc, bx, sh, lamp: lc } = S;
  const br = 1 + 0.13 * sin(0.083 * S.t + sp.ph * 1.7) + 0.07 * sin(0.0467 * S.t + sp.ph * 3.1);
  const amp = sp.amp * wgt * br;
  const u4 = S.u4;
  const reach = R + (R < 12 ? 9 : REACH);
  let fOF = 0, fOB = 0, fIF = 0, fIB = 0;
  const y0 = max(0, floor(cy - reach)), y1 = min(H - 1, ceil(cy + reach));
  const R2 = R * R, Ri2 = Ri * Ri;
  const gl = 0.2;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy, hw2 = reach * reach - dy * dy;
    if (hw2 <= 0) continue;
    const hw = sqrt(hw2);
    const xa = max(0, floor(cx - hw)), xb = min(W - 1, ceil(cx + hw));
    for (let x = xa; x <= xb; x++) {
      const dx = x + 0.5 - cx, r2 = dx * dx + dy * dy, p = y * W + x, r = sqrt(r2);
      let ar = 0, ag = 0, ab = 0;
      const alpha = cl(R + 0.5 - r, 0, 1);
      // the glow round the shell, heavier on the side away from the lamp
      {
        const out = r > R ? r - R : 0;
        const bias = 0.78 + 0.22 * (r > 0.5 ? (-dx * LDX - dy * LDY) / (r * 0.68) : 0);
        const g = gl * exp(-out / 5.5) * bias * (1 - 0.65 * alpha) * (0.6 + 0.4 * (0.4 + u4));
        ar += ox[0] * g * 0.8 + ix[0] * g * 0.25;
        ag += ox[1] * g * 0.8 + ix[1] * g * 0.25;
        ab += ox[2] * g * 0.8 + ix[2] * g * 0.25;
      }
      if (alpha > 0) {
        let ir = 0, ig = 0, ib = 0;
        const zf = sqrt(max(0, R2 - r2)), il = 1 / R;
        const px = dx * il, py = dy * il, pz = -zf * il;
        const cv = zf * il;
        const Fr = (1 - cv) * (1 - cv) * (1 - cv);
        let T = 1;
        // body haze, brighter toward the limb
        {
          const h = 0.012 + 0.07 * Fr;
          ir += ox[0] * h;
          ig += ox[1] * h;
          ib += ox[2] * h;
        }
        // outer shell, near side
        fOF = strut(px, py, pz, fv, fOF, nO, R, sp.ws);
        let c = LC;
        if (c > 0.004) {
          lamp(px, py, pz, fv, fOF);
          const lt = 0.3 + 0.48 * LDIF + 0.3 * Fr, sp1 = LSPC * 0.5, tt = max(sm(0, 0.45, LDIF + 0.3 * Fr), 0.7 * (1 - LFA));
          ir += ((sh[0] + (ox[0] - sh[0]) * tt) * lt + lc[0] * sp1) * c;
          ig += ((sh[1] + (ox[1] - sh[1]) * tt) * lt + lc[1] * sp1) * c;
          ib += ((sh[2] + (ox[2] - sh[2]) * tt) * lt + lc[2] * sp1) * c;
          T = 1 - 0.88 * c;
        }
        // inner shell and the cell body
        if (r2 < Ri2) {
          const zi = sqrt(Ri2 - r2), ii = 1 / Ri;
          const qx = dx * ii, qy = dy * ii, qz = -zi * ii;
          fIF = strut(qx, qy, qz, fv, fIF, nI, Ri, 1.1);
          c = LC;
          if (c > 0.004) {
            lamp(qx, qy, qz, fv, fIF);
            const lt = 0.16 + 0.36 * LDIF + 0.26 * (1 - zi * ii), sp2 = LSPC * 0.3;
            const k = T * c;
            ir += (ix[0] * lt + lc[0] * sp2) * k;
            ig += (ix[1] * lt + lc[1] * sp2) * k;
            ib += (ix[2] * lt + lc[2] * sp2) * k;
            T *= 1 - 0.8 * c;
          }
          // far side of the inner shell
          fIB = strut(qx, qy, -qz, fv, fIB, nI, Ri, 1.1);
          c = LC;
          if (c > 0.004) {
            const lt = 0.12 + 0.18 * max(0, -(qx * LDX + qy * LDY - qz * LDZ));
            const k = T * c * 0.5;
            ir += ix[0] * lt * k;
            ig += ix[1] * lt * k;
            ib += ix[2] * lt * k;
          }
          // the cell body at the centre
          const cb = exp(-r2 / (2 * Ri2 * 0.3)) * 0.26 * T;
          ir += cc[0] * cb;
          ig += cc[1] * cb;
          ib += cc[2] * cb;
        }
        // outer shell, far side, seen through everything
        fOB = strut(px, py, -pz, fv, fOB, nO, R, sp.ws);
        c = LC;
        if (c > 0.004) {
          const lt = 0.13 + 0.26 * max(0, -(px * LDX + py * LDY - pz * LDZ)) + 0.2 * Fr;
          const k = T * c * 0.2;
          ir += bx[0] * lt * k;
          ig += bx[1] * lt * k;
          ib += bx[2] * lt * k;
        }
        ar += ir * alpha;
        ag += ig * alpha;
        ab += ib * alpha;
      }
      RR[p] += ar * amp;
      GG[p] += ag * amp;
      BB[p] += ab * amp;
    }
  }
  // needles and beams
  const lenK = sp.needle * pow01(u4);
  const beamK = sm(0, 0.45, u4) * (0.6 + 0.4 * u4);
  const M = sp.M;
  if (lenK > 0.3) {
    for (const s of mo.spines) {
      const vx = M[0] * s.p[0] + M[1] * s.p[1] + M[2] * s.p[2];
      const vy = M[3] * s.p[0] + M[4] * s.p[1] + M[5] * s.p[2];
      const vz = M[6] * s.p[0] + M[7] * s.p[1] + M[8] * s.p[2];
      const L = lenK * s.len;
      const x0 = cx + R * vx, y0 = cy + R * vy, x1 = cx + (R + L) * vx, y1 = cy + (R + L) * vy;
      const pl = sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
      const endOn = 0.35 + 0.65 * sm(0, 3.5, pl);
      const w0 = s.w * (0.8 + 0.2 * min(1, lenK / 7));
      capsule(S, x0, y0, x1, y1, w0, 0.4, 0.8 * endOn, 0.3 * endOn, cx, cy, R, vz > 0, wgt * sp.amp * br, 0);
    }
  }
  if (beamK > 0.02) {
    for (const b of mo.beams) {
      const vx = M[0] * b[0] + M[1] * b[1] + M[2] * b[2];
      const vy = M[3] * b[0] + M[4] * b[1] + M[5] * b[2];
      const vz = M[6] * b[0] + M[7] * b[1] + M[8] * b[2];
      const x0 = cx + R * vx, y0 = cy + R * vy, x1 = cx + Ri * vx, y1 = cy + Ri * vy;
      const pl = sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
      const a = beamK * (vz > 0 ? 0.18 : 0.4) * (0.3 + 0.7 * sm(0.5, 4, pl));
      capsule(S, x0, y0, x1, y1, 0.75, 0.75, a, a, cx, cy, R, false, wgt * sp.amp * br, 1);
    }
  }
}

const pow01 = (u) => u * sqrt(u);

// A soft line with its own half width and brightness at each end. kind 0 is a needle (gold-white), 1 a beam.
function capsule(S, x0, y0, x1, y1, hw0, hw1, i0, i1, cx, cy, R, back, wgt, kind) {
  const { R: RR, G: GG, B: BB, ox, ix } = S;
  const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy, il2 = l2 > 1e-4 ? 1 / l2 : 0;
  const pad = max(hw0, hw1) + 3.4;
  const xa = max(0, floor(min(x0, x1) - pad)), xb = min(W - 1, ceil(max(x0, x1) + pad));
  const ya = max(0, floor(min(y0, y1) - pad)), yb = min(H - 1, ceil(max(y0, y1) + pad));
  const R2 = R * R;
  let cr, cg, cb;
  if (kind === 0) {
    cr = ox[0] * 0.8 + 0.2;
    cg = ox[1] * 0.8 + 0.16;
    cb = ox[2] * 0.8 + 0.1;
  } else {
    cr = ox[0] * 0.85 + ix[0] * 0.15;
    cg = ox[1] * 0.85 + ix[1] * 0.15;
    cb = ox[2] * 0.85 + ix[2] * 0.15;
  }
  for (let y = ya; y <= yb; y++) {
    const py = y + 0.5;
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5;
      let t = ((px - x0) * vx + (py - y0) * vy) * il2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px - x0 - t * vx, dy = py - y0 - t * vy, d = sqrt(dx * dx + dy * dy);
      const hw = hw0 + (hw1 - hw0) * t;
      if (d > hw + 3.4) continue;
      const core = 1 - sm(hw * 0.45, hw + 0.75, d);
      const g = d < hw + 3.4 ? (1 - d / (hw + 3.4)) : 0;
      let v = (core + 0.22 * g * g) * (i0 + (i1 - i0) * t) * wgt;
      if (back) {
        const rx = px - cx, ry = py - cy;
        v *= rx * rx + ry * ry < R2 ? 0.42 : 0.8;
      }
      const p = y * W + x;
      RR[p] += cr * v;
      GG[p] += cg * v;
      BB[p] += cb * v;
    }
  }
}

// Two faint sets of light shafts slide across the water, 22 and 33 LEDs apart, a little over 1 LED a second.
// Each is a plane wave, and sin(a + b) is split so a row costs two trig calls and a pixel none.
const K1X = 0.29 * 0.8, K1Y = 0.29 * 0.6, W1 = 0.43, K2X = 0.19 * 0.5, K2Y = 0.19 * 0.85, W2 = -0.21;
const S1S = F(W), S1C = F(W), S2S = F(W), S2C = F(W), WASH = F(N);
for (let x = 0; x < W; x++) {
  S1S[x] = sin(K1X * (x + 0.5));
  S1C[x] = cos(K1X * (x + 0.5));
  S2S[x] = sin(K2X * (x + 0.5) + 1);
  S2C[x] = cos(K2X * (x + 0.5) + 1);
}
for (let y = 0, p = 0; y < H; y++)
  for (let x = 0; x < W; x++, p++) {
    const dx = x - 4, dy = y - 2;
    WASH[p] = exp(-sqrt(dx * dx + dy * dy) / 34) * 0.06;
  }

function backdrop(S) {
  const { R: RR, G: GG, B: BB, wat, wat2 } = S, t = S.t;
  for (let y = 0, p = 0; y < H; y++) {
    const q = y / (H - 1), s = sm(0, 1, q);
    const r0 = mix(wat[0], wat2[0], s), g0 = mix(wat[1], wat2[1], s), b0 = mix(wat[2], wat2[2], s);
    const a1 = K1Y * (y + 0.5) - W1 * t, a2 = K2Y * (y + 0.5) - W2 * t;
    const s1 = sin(a1), c1 = cos(a1), s2 = sin(a2), c2 = cos(a2);
    const env = 0.5 + 0.5 * exp(-y / 70);
    for (let x = 0; x < W; x++, p++) {
      const lg = WASH[p];
      const v = S1S[x] * c1 + S1C[x] * s1, w = S2S[x] * c2 + S2C[x] * s2;
      const sh = (0.5 + 0.5 * (0.6 * v + 0.4 * w)) * 0.034 * env;
      RR[p] = r0 + lg * 0.9 + sh * 0.2;
      GG[p] = g0 + lg * 0.55 + sh * 0.55;
      BB[p] = b0 + lg * 0.2 + sh;
    }
  }
  // out of focus motes
  for (let i = 0; i < NMOTE; i++) {
    const sg = S.ms[i], a = S.ma[i] * (0.65 + 0.35 * sin(0.21 * t + S.mph[i] * 1.3)), is = 1 / (2 * sg * sg);
    const x0 = S.mx[i], y0 = S.my[i], r = ceil(sg * 3);
    const h = S.mh[i];
    let cr, cg, cb;
    {
      const k = (n) => {
        const kk = (n + h * 6) % 6;
        return 1 - 0.55 * max(0, min(kk, 4 - kk, 1));
      };
      cr = k(5);
      cg = k(3);
      cb = k(1);
    }
    for (let y = max(0, floor(y0 - r)); y <= min(H - 1, ceil(y0 + r)); y++)
      for (let x = max(0, floor(x0 - r)); x <= min(W - 1, ceil(x0 + r)); x++) {
        const dx = x + 0.5 - x0, dy = y + 0.5 - y0, v = a * exp(-(dx * dx + dy * dy) * is), p = y * W + x;
        RR[p] += cr * v;
        GG[p] += cg * v;
        BB[p] += cb * v;
      }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  aimLamp(S.t);
  backdrop(S);
  for (const sp of S.sp) {
    rodrigues(sp.ax1[0] + 0.35 * sin(0.0213 * S.t + sp.ph), sp.ax1[1] + 0.3 * cos(0.0171 * S.t + sp.ph), sp.ax1[2] + 0.2 * sin(0.0113 * S.t), sp.th1, TA);
    rodrigues(sp.ax2[0], sp.ax2[1], sp.ax2[2], sp.th2, TB);
    mul3(TA, TB, sp.M);
    viewFaces(sp.M, sp.fv);
  }
  // the far specimen first
  for (let i = 2; i >= 0; i--) {
    const sp = S.sp[i];
    if (sp.fade >= 1) drawSpec(S, sp, sp.n, 1);
    else {
      const w = sm(0, 1, sp.fade);
      drawSpec(S, sp, sp.n, w);
      drawSpec(S, sp, sp.nPrev, 1 - w);
    }
  }
  const { R: RR, G: GG, B: BB } = S;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const r = TONE[(cl(RR[p], 0, 3.99) * 256) | 0], g = TONE[(cl(GG[p], 0, 3.99) * 256) | 0], b = TONE[(cl(BB[p], 0, 3.99) * 256) | 0];
      display.setPixel(x, y, r * 255, g * 255, b * 255);
    }
}
