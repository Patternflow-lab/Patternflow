// ===== Patternflow pattern =====
// Title:   Möbius Type
// Family:  type
// Idea:    A paper band stands up the height of the panel and turns slowly in 3D with a line of capitals printed along its middle; with one or three half-twists the band has one side, so the sentence THE OTHER SIDE OF THIS LINE IS THIS LINE runs round twice before it meets its own start and every piece of the band carries ink on its back as well, while with two or four the band has two sides, THIS LINE HAS A BACK closes after one lap and the back is bare paper, and a bright reading mark runs along the line so the eye can follow it round.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the one-sided band (August Ferdinand Möbius and Johann Benedict Listing, 1858), capitals on a 5 by 7 grid drawn for this pattern, pattern round 79
// Round:   79
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Twists=1..4, Paper=0..1
//
// Knob 1: Hue. Turns the ink round the wheel. At 0 it is azure, 0.25 purple, 0.5 orange, 0.75 green; the paper stays grey and the reading mark white.
// Knob 2: Speed. At 2 the band turns once round the upright in 24 s, 15 degrees a second, and the reading mark moves on 2.5 letters a second, so it takes 16.4 s to read the 41 letters of the one-sided line twice round and 8.4 s for the 21 of the two-sided one. At 0.2 both go ten times slower, at 3 half as fast again.
// Knob 3: Twists. Half-twists in the band, to the nearest whole number: 1 at the opening, Möbius's band, one side and one edge; 2, a full twist, two sides and two edges linked once; 3, one side again, its one edge tied in a trefoil; 4, two sides.
// Knob 4: Paper. How thin the paper is. At 0 it is card and only the face toward you shows. At 1 the paper itself is 45% darker and the far face's letters show through it mirrored, at about two thirds the light of the ink facing you: on a two-sided band the bare back shows the line from behind, on a one-sided band the other lap's letters lie mirrored between the letters facing you.

// The band's middle line is a stadium standing in the plane of the panel:
// two uprights 60 LEDs long at x = +-19 joined by half circles of radius 19,
// 239.4 LEDs round. A point on the band is c(s) + v d(s), s the arc length
// along the middle and v from -12 to 12 across. The direction across, d,
// turns about the middle line: d = cos(a) N + sin(a) Z, N the outward
// normal in the plane, Z out of it, and a = pi/2 + k pi s / P for k
// half-twists in the length P, so at the start of the line, halfway up the
// right upright, the band stands straight out of the plane. After one lap d has turned by k pi, so with
// k odd it comes back as -d: the face you set out on has become the other
// one, and only a second lap brings you back to your start. That is the one
// side of Möbius's band, and the line printed along it is 2P long, ink on
// both faces of every piece of paper. With k even d comes back as itself,
// the line closes after one lap and the back is a second face of its own.
//
// Seen from the face whose normal is n = ds x dv, the letters stand up
// along +v. Seen from the other face of the same piece of paper the line
// is the next lap, s + P along with v turned over, so its letters stand up
// the right way to a reader on that side. Through thin paper the far face's
// ink shows from behind, as a mirror image.
//
// The picture is drawn by splatting: 640 by 56 points of the band are
// turned, put in perspective from a camera 260 LEDs away, and kept only
// where they are nearest the camera; an LED is the mean of the near points
// that land in it, so the letters are box-filtered where the paper is seen
// at a slant. Which face is toward the camera decides which lap's letters
// that point shows, and the light falls on that face.

const W = 64, H = 128, N = W * H;
const { floor, round, max, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const R = 19, D = 30, HW = 12, P = 4 * D + 2 * PI * R;
const NS = 640, NV = 56, DC = 260, TILT = 0.24, EPS = 1.6;
const CAP = 0.7 * 2 * HW, HUE0 = 0.57;
const LINES = ["THIS LINE HAS A BACK ", "THE OTHER SIDE OF THIS LINE IS THIS LINE "];
// The light, from the upper left and in front, in camera space.
const LX = -0.45, LY = 0.55, LZ = 0.7, LN = sqrt(LX * LX + LY * LY + LZ * LZ);

// Capitals on a 5 by 7 grid, rows from the top.
const GLYPHS = {
  A: ".###. #...# #...# ##### #...# #...# #...#",
  B: "####. #...# #...# ####. #...# #...# ####.",
  C: ".###. #...# #.... #.... #.... #...# .###.",
  D: "####. #...# #...# #...# #...# #...# ####.",
  E: "##### #.... #.... ####. #.... #.... #####",
  F: "##### #.... #.... ####. #.... #.... #....",
  H: "#...# #...# #...# ##### #...# #...# #...#",
  I: ".###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.",
  K: "#...# #..#. #.#.. ##... #.#.. #..#. #...#",
  L: "#.... #.... #.... #.... #.... #.... #####",
  N: "#...# ##..# ##..# #.#.# #..## #..## #...#",
  O: ".###. #...# #...# #...# #...# #...# .###.",
  R: "####. #...# #...# ####. #.#.. #..#. #...#",
  S: ".#### #.... #.... .###. ....# ....# ####.",
  T: "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..",
};
// Each line as 35 dots a letter, 0 for a space.
const BITS = LINES.map((line) => {
  const b = new Uint8Array(line.length * 35);
  for (let i = 0; i < line.length; i++) {
    const g = GLYPHS[line[i]];
    if (!g) continue;
    const rows = g.split(" ");
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) b[i * 35 + r * 5 + c] = rows[r][c] === "#" ? 1 : 0;
  }
  return b;
});

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The middle line at arc length s: position, unit tangent, curvature.
function stadium(s, o) {
  let x, y, tx, ty, k = 0;
  if (s < D) [x, y, tx, ty] = [R, s, 0, 1];
  else if (s < D + PI * R) {
    const a = (s - D) / R;
    [x, y, tx, ty, k] = [R * cos(a), D + R * sin(a), -sin(a), cos(a), 1 / R];
  } else if (s < 3 * D + PI * R) [x, y, tx, ty] = [-R, D - (s - D - PI * R), 0, -1];
  else if (s < 3 * D + 2 * PI * R) {
    const a = PI + (s - 3 * D - PI * R) / R;
    [x, y, tx, ty, k] = [R * cos(a), -D + R * sin(a), -sin(a), cos(a), 1 / R];
  } else [x, y, tx, ty] = [R, -D + (s - 3 * D - 2 * PI * R), 0, 1];
  o[0] = x; o[1] = y; o[2] = tx; o[3] = ty; o[4] = k;
}

// The row of the 5 by 7 grid at each of the NV steps across, read with the
// letters standing up along +v (ROWS[0]) or along -v (ROWS[1]); -1 off the
// letters.
const ROWS = [0, 1].map((flip) => {
  const r = new Int32Array(NV);
  for (let j = 0; j < NV; j++) {
    const v = (-HW + ((j + 0.5) * 2 * HW) / NV) * (flip ? -1 : 1), row = floor((CAP / 2 - v) / (CAP / 7));
    r[j] = row >= 0 && row < 7 ? row * 5 : -1;
  }
  return r;
});

// For each of the NS stations along the band: the middle point c, the
// direction across d and the normal n0 + v n1 (12 numbers), for k
// half-twists; and where the line's letters fall on each face there.
function build(k) {
  const g = new Float32Array(NS * 12), st = [0, 0, 0, 0, 0], da = (k * PI) / P;
  const odd = k % 2, len = LINES[odd].length, adv = (odd ? 2 * P : P) / len;
  const cell = [new Int32Array(NS), new Int32Array(NS)], letter = [new Int32Array(NS), new Int32Array(NS)];
  for (let i = 0; i < NS; i++) {
    const s = ((i + 0.5) * P) / NS;
    stadium(s, st);
    const [x, y, tx, ty, kap] = st, nx = ty, ny = -tx, a = PI / 2 + da * s, ca = cos(a), sa = sin(a);
    const dx = ca * nx, dy = ca * ny, dz = sa;
    // ds at v is T + v (kap cos a T + a' (-sin a N + cos a Z)), dv is d.
    const ax = kap * ca * tx - da * sa * nx, ay = kap * ca * ty - da * sa * ny, az = da * ca;
    const o = i * 12;
    g[o] = x; g[o + 1] = y; g[o + 2] = 0;
    g[o + 3] = dx; g[o + 4] = dy; g[o + 5] = dz;
    g[o + 6] = ty * dz; g[o + 7] = -tx * dz; g[o + 8] = tx * dy - ty * dx;
    g[o + 9] = ay * dz - az * dy; g[o + 10] = az * dx - ax * dz; g[o + 11] = ax * dy - ay * dx;
    // Lap 0 is the line at s on the face n points to; lap 1 is s + P,
    // on the other face, and only a one-sided band has it.
    for (let lap = 0; lap < 2; lap++) {
      const u = (s + lap * P) / adv, li = floor(u) % len, col = floor((u - floor(u)) * 6 - 0.5);
      letter[lap][i] = li;
      cell[lap][i] = col >= 0 && col < 5 && (odd || !lap) ? li * 35 + col : -1;
    }
  }
  return { g, cell, letter, odd, len };
}

export function setup(params) {
  params.s = {
    k: 1, geo: build(1), view: new Float32Array(NS * 12), lam: new Float32Array(NS * 2), turn: -0.65, read: 0, hue: 0, paper: 0.06,
    z: new Float32Array(N), pix: new Int32Array(NS * NV), zs: new Float32Array(NS * NV), acc: new Float32Array(N * 4), ink: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  const speed = cl(kv[1] == null ? 2 : kv[1], 0.2, 3);
  const k = round(cl(kv[2] == null ? 1 : kv[2], 1, 4));
  S.paper = cl(kv[3] == null ? 0.06 : kv[3], 0, 1);
  if (k !== S.k) {
    S.k = k;
    S.geo = build(k);
  }
  S.turn += (d * speed * 2 * PI) / 48;
  S.read += d * speed * 1.25;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { g, cell, letter, odd, len } = S.geo, bits = BITS[odd];
  const zb = S.z, acc = S.acc, vw = S.view, lam = S.lam, pix = S.pix, zs = S.zs, ink = hsv(S.hue + HUE0, 0.8, 1, S.ink);
  // Camera: turn about the upright, then tip the top toward the camera by
  // TILT, so the band is seen a little from above.
  const cp = cos(S.turn), sp = sin(S.turn), ct = cos(TILT), stl = sin(TILT);
  const m00 = cp, m02 = sp, m10 = sp * stl, m11 = ct, m12 = -cp * stl, m20 = -sp * ct, m21 = stl, m22 = cp * ct;
  for (let i = 0; i < NS * 12; i += 3) {
    const x = g[i], y = g[i + 1], z = g[i + 2];
    vw[i] = m00 * x + m02 * z;
    vw[i + 1] = m10 * x + m11 * y + m12 * z;
    vw[i + 2] = m20 * x + m21 * y + m22 * z;
  }
  // The light on each face at each station.
  for (let i = 0; i < NS; i++) {
    const o = i * 12, nx = vw[o + 6], ny = vw[o + 7], nz = vw[o + 8];
    const l = (nx * LX + ny * LY + nz * LZ) / (LN * sqrt(nx * nx + ny * ny + nz * nz) + 1e-9);
    lam[i * 2] = max(0, l);
    lam[i * 2 + 1] = max(0, -l);
  }
  zb.fill(-1e9);
  acc.fill(0);
  const dv = (2 * HW) / NV;
  for (let i = 0, q = 0; i < NS; i++) {
    const o = i * 12, cx = vw[o], cy = vw[o + 1], cz = vw[o + 2], dx = vw[o + 3], dy = vw[o + 4], dz = vw[o + 5];
    for (let j = 0; j < NV; j++, q++) {
      const v = -HW + (j + 0.5) * dv, Z = cz + v * dz, f = DC / (DC - Z);
      const px = floor(32 + (cx + v * dx) * f), py = floor(64 - (cy + v * dy) * f);
      if (px < 0 || px >= W || py < 0 || py >= H) {
        pix[q] = -1;
        continue;
      }
      const p = py * W + px;
      pix[q] = p;
      zs[q] = Z;
      if (Z > zb[p]) zb[p] = Z;
    }
  }
  const show = S.paper, thin = 1 - 0.45 * show, pr = 0.9 * thin, pg = 0.9 * thin, pb = 0.95 * thin;
  const rowP = ROWS[0], rowN = ROWS[1];
  for (let i = 0, q = 0; i < NS; i++) {
    const o = i * 12, cx = vw[o], cy = vw[o + 1], dx = vw[o + 3], dy = vw[o + 4];
    const c0 = cell[0][i], c1 = cell[1][i];
    for (let j = 0; j < NV; j++, q++) {
      const p = pix[q];
      if (p < 0) continue;
      const Z = zs[q];
      if (Z < zb[p] - EPS) continue;
      // Which face looks at the camera: the line's lap 0 is on the face
      // n points to, lap 1 (turned over) on the other.
      const v = -HW + (j + 0.5) * dv;
      const nx = vw[o + 6] + v * vw[o + 9], ny = vw[o + 7] + v * vw[o + 10], nz = vw[o + 8] + v * vw[o + 11];
      const front = nx * -(cx + v * dx) + ny * -(cy + v * dy) + nz * (DC - Z) >= 0;
      const l = lam[i * 2 + (front ? 0 : 1)];
      const nc = front ? c0 : c1, nr = front ? rowP[j] : rowN[j], fc = front ? c1 : c0, fr = front ? rowN[j] : rowP[j];
      const near = nc >= 0 && nr >= 0 ? bits[nc + nr] : 0;
      // The far face's ink seen through the paper, mirrored.
      const far = !near && fc >= 0 && fr >= 0 ? bits[fc + fr] : 0;
      const q4 = p * 4;
      acc[q4] += 1;
      if (near) {
        const il = 0.42 + 0.58 * l, h = glow(S.read, letter[front ? 0 : 1][i], len), a = il * (1 - h), w = il * h;
        acc[q4 + 1] += ink[0] * a + w;
        acc[q4 + 2] += ink[1] * a + w;
        acc[q4 + 3] += ink[2] * a + w;
      } else {
        const pl = 0.09 + 0.3 * l, sh = far * show, il = (0.26 + 0.4 * l) * sh, a = pl * (1 - sh);
        acc[q4 + 1] += pr * a + ink[0] * il;
        acc[q4 + 2] += pg * a + ink[1] * il;
        acc[q4 + 3] += pb * a + ink[2] * il;
      }
    }
  }
  for (let p = 0; p < N; p++) {
    const n = acc[p * 4], q4 = p * 4;
    if (n > 0) display.setPixel(p % W, floor(p / W), round(cl(acc[q4 + 1] / n, 0, 1) * 255), round(cl(acc[q4 + 2] / n, 0, 1) * 255), round(cl(acc[q4 + 3] / n, 0, 1) * 255));
    else display.setPixel(p % W, floor(p / W), 0, 0, 0);
  }
}

// The reading mark: white on the letter it has reached, fading over the
// three behind it.
function glow(read, li, len) {
  let u = (read - li) % len;
  if (u < 0) u += len;
  return u < 4 ? (1 - u / 4) ** 1.5 : 0;
}
