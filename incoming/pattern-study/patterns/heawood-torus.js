// ===== Patternflow pattern =====
// Title:   Heawood Torus
// Family:  topology
// Idea:    A tall torus turns and leans in front of you painted with Heawood's map of seven hexagonal countries, each of which touches all six others, so this map needs seven colours where a map on the sphere never needs more than four.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Heawood's seven-colour map on the torus (Percy Heawood, 1890), pattern round 36
// Round:   36
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Hole=0..1, Tilt=0..1
//
// Knob 1: Hue. Turns the seven colours round the wheel together, a seventh apart. At 0 they are orange, lime, green, cyan, blue, violet and pink; every seventh of the way round the same seven come back, each moved on to another country, and halfway between, at 0.07, 0.21 and so on, one of them is pure red.
// Knob 2: Speed. How fast the torus turns about its long axis. At 2 a turn takes 16 s, so it goes from face-on to edge-on in 4 s, and its lean nods 3 degrees each way every 29 s; at 0.2 everything is ten times slower, at 3 a turn takes 10 s.
// Knob 3: Hole. The tube's radius against the radius of the curve it runs round, the torus keeping its width, 59 LEDs at the opening tilt. At 0 it is 0.85: the tube is 27 LEDs thick and the hole a slot 5 LEDs wide and 65 tall; at 0.5 the tube is 23 thick and the hole 14 wide; at 1 it is 0.4, a 17 LED tube round a hole 25 wide and 86 tall.
// Knob 4: Tilt. How far the top of the torus leans toward you: 8 degrees at 0.06, so you look almost straight at its side, 23 at 0.5 and 40 at 1, where you look down into the hole and see the top bend from above.
// Buttons: K1 tap draws, for six seconds, the capital of each country and the 21 roads between them in white: the complete graph on seven points, drawn on the torus with no two roads crossing, each road crossing one border. Tapping again while they show keeps them up.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sin, cos, abs, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The plane tiled by hexagons, the hexagon at axial (a, b) coloured
// (a + 3b) mod 7. Its six neighbours sit at (+-1, 0), (0, +-1) and
// +-(1, -1), so their colours differ from its own by +-1, +-3 and +-2: all
// six other colours, once each. The colouring repeats on the lattice L of
// (a, b) with a + 3b = 0 mod 7, which has index 7, so the torus plane / L
// holds exactly one hexagon of each colour, and each touches the other six.
// L is spanned by E1 = (2, -3) and E2 = (1, 2) (determinant 7); of all the
// bases of L these two shear the hexagons least on the long, thin parameter
// square of this torus.
const E1A = 2, E1B = -3, E2A = 1, E2B = 2;

// Samples round the core curve and round the tube; samples along each road.
const NU = 600, NV = 120, NS = NU * NV, NR = 200;
// The outer half width of the torus in LEDs, and its half height before it leans.
const RO = 31, HALF = 63;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The country at fractional axial coordinates (qa, qb): round to the nearest
// hexagon centre in cube coordinates, then colour it.
function country(qa, qb) {
  const x = qa, z = qb, y = -x - z;
  let rx = round(x), ry = round(y), rz = round(z);
  const dx = abs(rx - x), dy = abs(ry - y), dz = abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy <= dz) rz = -rx - ry;
  return (((rx + 3 * rz) % 7) + 7) % 7;
}

// The surface: a tube of radius r round a stadium, two half circles of
// radius rc joined by straights 2 ly long, standing up in the x-y plane.
// (U, V) in the unit square is the fraction of the way round the stadium and
// round the tube. core() writes the point of the stadium at U and its
// outward normal in the plane, (cx, cy, ox, oy), at out[o..o+3]; the surface
// point is (cx + r cos v ox, cy + r cos v oy, r sin v) with v = 2 pi V, and
// its normal (cos v ox, cos v oy, sin v).
function core(S, U, out, o) {
  const rc = S.rc, ly = S.ly;
  let s = (U - floor(U)) * S.per, cx, cy, ox, oy;
  if (s < 2 * ly) (cx = rc), (cy = -ly + s), (ox = 1), (oy = 0);
  else if ((s -= 2 * ly) < PI * rc) {
    const a = s / rc;
    (ox = cos(a)), (oy = sin(a)), (cx = rc * ox), (cy = ly + rc * oy);
  } else if ((s -= PI * rc) < 2 * ly) (cx = -rc), (cy = ly - s), (ox = -1), (oy = 0);
  else {
    const a = PI + (s - 2 * ly) / rc;
    (ox = cos(a)), (oy = sin(a)), (cx = rc * ox), (cy = -ly + rc * oy);
  }
  out[o] = cx;
  out[o + 1] = cy;
  out[o + 2] = ox;
  out[o + 3] = oy;
}

// The plane point U E1 + V E2 is the one painted at (U, V), so the square's
// sides go to E1 and E2 and the map closes up on the torus. Back the other
// way, (qa, qb) lands at U = (2 qa - qb) / 7, V = (3 qa + 2 qb) / 7.
function build(S) {
  S.rc = RO / (1 + S.ratio);
  S.r = S.rc * S.ratio;
  S.ly = HALF - RO;
  S.per = 4 * S.ly + TAU * S.rc;
  const { cc, tc, ts, cid, road } = S;
  for (let j = 0; j < NV; j++) {
    tc[j] = cos((TAU * (j + 0.5)) / NV);
    ts[j] = sin((TAU * (j + 0.5)) / NV);
  }
  for (let i = 0; i < NU; i++) {
    const U = (i + 0.5) / NU;
    core(S, U, cc, 4 * i);
    for (let j = 0; j < NV; j++) cid[i * NV + j] = country(U * E1A + (j + 0.5) / NV * E2A, U * E1B + (j + 0.5) / NV * E2B);
  }
  // The dual graph: the capital of country a sits at the hexagon (a, 0), and
  // three roads leave it toward (a + 1, 0), (a, 1) and (a + 1, -1). Seven
  // capitals times three is all 21 roads of K7, each crossing one border.
  const q4 = [0, 0, 0, 0];
  let n = 0;
  for (let a = 0; a < 7; a++)
    for (const [da, db] of [[1, 0], [0, 1], [1, -1]])
      for (let t = 0; t < NR; t++, n++) {
        const qa = a + (da * t) / (NR - 1), qb = (db * t) / (NR - 1), v = (TAU * (3 * qa + 2 * qb)) / 7, o = 3 * n;
        core(S, (2 * qa - qb) / 7, q4, 0);
        road[o] = q4[0] + S.r * cos(v) * q4[2];
        road[o + 1] = q4[1] + S.r * cos(v) * q4[3];
        road[o + 2] = S.r * sin(v);
      }
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, ratio: -1, tilt: 0.06, spin: 0, nod: 0, roads: -1, rc: 0, r: 0, ly: 0, per: 0,
    cc: new Float32Array(4 * NU), tc: new Float32Array(NV), ts: new Float32Array(NV), cid: new Uint8Array(NS), road: new Float32Array(3 * 21 * NR),
    zb: new Float32Array(N), ib: new Int32Array(N), ib2: new Int32Array(N), cb: new Uint8Array(N), rb: new Uint8Array(N), pal: new Float32Array(21),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.tilt = cl(k[3], 0, 1);
  const ratio = 0.85 - 0.45 * cl(k[2], 0, 1);
  if (abs(ratio - S.ratio) > 1e-4) {
    S.ratio = ratio;
    build(S);
  }
  S.spin += d * S.speed * 0.2;
  S.nod += d * S.speed * 0.11;
  if (S.roads >= 0) {
    S.roads += d;
    if (S.roads > 7) S.roads = -1;
  }
  if (input.btnPressed && input.btnPressed[0]) S.roads = S.roads < 0 ? 0 : min(S.roads, 0.5);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { cc, tc, ts, cid, zb, ib, ib2, cb, rb, road, pal } = S, r = S.r;
  // Spin about the torus's long axis, then lean the top of that axis toward
  // the viewer, who looks along +z.
  const ph = S.spin, cp = cos(ph), sp = sin(ph);
  const la = -(0.1 + 0.6 * S.tilt + 0.05 * sin(S.nod)), cla = cos(la), sla = sin(la);
  const m0 = cp, m2 = sp;
  const m3 = sla * sp, m4 = cla, m5 = -sla * cp;
  const m6 = -cla * sp, m7 = sla, m8 = cla * cp;
  // Fit the leaning torus to the panel height.
  const sc = min(1, 63.5 / (HALF * cla - RO * sla));
  zb.fill(1e9);
  ib.fill(-1);
  // Each sample's screen x, y and depth are a column part plus cos v and
  // sin v times a part, so the loop over the tube is a few multiplies.
  const Xb = sc * m2 * r, Yb = -sc * m5 * r, Zb = m8 * r;
  for (let i = 0; i < NU; i++) {
    const cx = cc[4 * i], cy = cc[4 * i + 1], ox = cc[4 * i + 2], oy = cc[4 * i + 3], A = m6 * ox + m7 * oy;
    const X0 = 32 + sc * m0 * cx, Xa = sc * m0 * r * ox, Y0 = 64 - sc * (m3 * cx + m4 * cy), Ya = -sc * r * (m3 * ox + m4 * oy);
    const Z0 = m6 * cx + m7 * cy, Za = r * A;
    for (let j = 0, k = i * NV; j < NV; j++, k++) {
      const cv = tc[j], sv = ts[j];
      // Facing away from the eye.
      if (cv * A + sv * m8 > 0.05) continue;
      const px = floor(X0 + cv * Xa + sv * Xb), py = floor(Y0 + cv * Ya + sv * Yb);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const p = py * W + px, Z = Z0 + cv * Za + sv * Zb;
      if (Z < zb[p]) (zb[p] = Z), (ib[p] = k);
    }
  }
  // Fill LEDs that no front sample reached, or where the back of the tube
  // shows through between two front samples.
  ib2.set(ib);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x, z = zb[p];
      for (let q = 1; q <= W; q += W - 1) {
        const a = zb[p - q], b = zb[p + q];
        if (a < 1e8 && b < 1e8 && abs(a - b) < 4 && z > max(a, b) + 3) {
          ib2[p] = a < b ? ib[p - q] : ib[p + q];
          break;
        }
      }
    }
  for (let p = 0; p < N; p++) {
    const k = ib2[p];
    cb[p] = k < 0 ? 255 : cid[k];
    if (k >= 0 && k !== ib[p]) {
      const i = (k / NV) | 0, j = k - i * NV, o = 4 * i;
      zb[p] = m6 * (cc[o] + r * tc[j] * cc[o + 2]) + m7 * (cc[o + 1] + r * tc[j] * cc[o + 3]) + m8 * r * ts[j];
    }
  }

  // The roads, where they lie on the visible surface, and the capitals at
  // their ends as 2 x 2 dots.
  const e = S.roads < 0 ? 0 : sm(S.roads / 0.5) * (1 - sm(S.roads - 6));
  if (e > 0) {
    rb.fill(0);
    for (let i = 0, o = 0; i < 21 * NR; i++, o += 3) {
      const x = road[o], y = road[o + 1], z = road[o + 2];
      const px = floor(32 + sc * (m0 * x + m2 * z)), py = floor(64 - sc * (m3 * x + m4 * y + m5 * z));
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const p = py * W + px;
      if (m6 * x + m7 * y + m8 * z > zb[p] + 1.5) continue;
      rb[p] = 1;
      if (i % NR === 0 && px < W - 1 && py < H - 1) rb[p + 1] = rb[p + W] = rb[p + W + 1] = 1;
    }
  }

  // The seven colours, a seventh apart, opening off red.
  const h0 = S.hue + 1 / 14;
  for (let c = 0; c < 7; c++) hsv(h0 + c / 7, 1, 1, pal, 3 * c);
  // Light from the upper left, in front.
  const lx = -0.45, ly = 0.6, lz = -0.66;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, c = cb[p];
      if (c === 255) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const k = ib2[p], i = (k / NV) | 0, j = k - i * NV, nx = tc[j] * cc[4 * i + 2], ny = tc[j] * cc[4 * i + 3], nz = ts[j];
      const vx = m0 * nx + m2 * nz, vy = m3 * nx + m4 * ny + m5 * nz, vz = m6 * nx + m7 * ny + m8 * nz;
      const dif = max(0, vx * lx + vy * ly + vz * lz);
      // Half vector of the light and the eye at -z, for a small shine.
      let hv = max(0, (vx * lx + vy * ly + vz * (lz - 1)) / 1.82);
      (hv *= hv), (hv *= hv), (hv *= hv), (hv *= hv), (hv *= hv);
      const spec = hv * 0.5;
      const lit = (0.6 + 0.55 * dif) * (1 - 0.2 * e);
      let R = pal[3 * c] * lit + spec, G = pal[3 * c + 1] * lit + spec, B = pal[3 * c + 2] * lit + spec;
      // A dark LED where the country changes to the right or below, and
      // where the surface folds behind a nearer part of the tube.
      const r = x < W - 1 ? cb[p + 1] : 255, b = y < H - 1 ? cb[p + W] : 255, zf = zb[p] - 6;
      if ((r !== 255 && r !== c) || (b !== 255 && b !== c) ||
        (x > 0 && cb[p - 1] !== 255 && zb[p - 1] < zf) || (r !== 255 && zb[p + 1] < zf) ||
        (y > 0 && cb[p - W] !== 255 && zb[p - W] < zf) || (b !== 255 && zb[p + W] < zf)) (R *= 0.08), (G *= 0.08), (B *= 0.08);
      if (e > 0 && rb[p]) {
        R += (1 - R) * e;
        G += (1 - G) * e;
        B += (1 - B) * e;
      }
      display.setPixel(x, y, cl(R * 255, 0, 255), cl(G * 255, 0, 255), cl(B * 255, 0, 255));
    }
}
