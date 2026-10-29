// ===== Patternflow pattern =====
// Title:   Catoptric Anamorphosis
// Family:  type
// Idea:    A word is drawn on the floor round a mirror cylinder, warped into rings that wrap the cylinder's foot, and only in the cylinder's reflection, seen from the one eye the drawing was traced for, does it stand up straight; the camera sways round that eye, so the word reads and smears while the rings on the floor stay strange.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: catoptric (cylinder mirror) anamorphosis (Jean-François Niceron, La Perspective curieuse, 1638), pattern round 71
// Round:   71
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..3, Away=0..1
//
// Knob 1: Hue. Turns the ink round the wheel, each letter a sixth of the wheel from the next: at 0 EYE is azure, violet and pink on grey paper.
// Knob 2: Speed. The camera's sway and the turn of the words: at 2 the sway takes 14 s and a new word is drawn every 7 s; ten times slower at 0.2, half as fast again at 3.
// Knob 3: Word. The first word, then the others in turn: EYE, 눈 (eye), SEE, YOU.
// Knob 4: Away. How far the camera wanders from the eye the floor was drawn for, on a figure of eight round the cylinder up to 60 degrees each way and up and down by 14 degrees. At the opening 0.06 it stays within 3.6 degrees and the word stands straight; at 0.3 it swings 18 degrees and the word slides round the mirror and leans; from 0.5 the word runs off the mirror's edge, while the rings on the floor only turn.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, atan2, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- The scene, in units of the cylinder's radius: the mirror stands on
// the floor y = 0 round the axis x = z = 0, 3 high. The design eye E looks
// at a point on the floor 1.6 in front of the axis, with a focal length of
// 160 LEDs, so the cylinder fills rows 5 to 56, 36 LEDs across at its top
// and 30 at its foot. The first frame traces the paper's grid (about 25 ms
// in Node) and each word's first frame its ink (25 to 30 ms); after that a
// frame is one ray per LED, off the mirror at most once, about 1.5 ms.
const RC = 1, HC = 3;
const E = [0, 6.2, 7.6], AIM = [0, 0, 1.6];
const F = 160;

// ---- Letters as strokes in a unit box, y down: L a line, A an elliptic
// arc (centre, radii, start and end angle in degrees, clockwise on screen).
const GLYPHS = {
  E: [["L", 0, 0, 0, 1], ["L", 0, 0, 1, 0], ["L", 0, 0.5, 0.82, 0.5], ["L", 0, 1, 1, 1]],
  Y: [["L", 0, 0, 0.5, 0.5], ["L", 1, 0, 0.5, 0.5], ["L", 0.5, 0.5, 0.5, 1]],
  S: [["A", 0.5, 0.26, 0.5, 0.26, -25, -270], ["A", 0.5, 0.74, 0.5, 0.26, -90, 155]],
  O: [["A", 0.5, 0.5, 0.5, 0.5, 0, 360]],
  U: [["L", 0, 0, 0, 0.5], ["A", 0.5, 0.5, 0.5, 0.5, 180, 0], ["L", 1, 0.5, 1, 0]],
  // 눈: ㄴ over ㅜ over ㄴ
  "눈": [["L", 0.1, 0, 0.1, 0.3], ["L", 0.1, 0.3, 0.9, 0.3], ["L", 0, 0.52, 1, 0.52], ["L", 0.5, 0.52, 0.5, 0.68], ["L", 0.1, 0.72, 0.1, 1], ["L", 0.1, 1, 0.9, 1]],
};
const WORDS = [["E", "Y", "E"], ["눈"], ["S", "E", "E"], ["Y", "O", "U"]];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// A camera: position, forward, right and up, from its place and its aim.
function camera(pos, aim, out) {
  out.o = pos;
  let fx = aim[0] - pos[0], fy = aim[1] - pos[1], fz = aim[2] - pos[2];
  const l = sqrt(fx * fx + fy * fy + fz * fz);
  fx /= l; fy /= l; fz /= l;
  const rl = sqrt(fx * fx + fz * fz);
  const rx = -fz / rl, rz = fx / rl;
  out.fw = [fx, fy, fz];
  out.rt = [rx, 0, rz];
  out.up = [-rz * fy, rz * fx - rx * fz, rx * fy];
  return out;
}
// The ray through LED (sx, sy) (fractional, from the top left) into D.
const D = [0, 0, 0];
function ray(cam, sx, sy) {
  const u = sx - W / 2, v = H / 2 - sy, fw = cam.fw, rt = cam.rt, up = cam.up;
  const x = fw[0] * F + rt[0] * u + up[0] * v, y = fw[1] * F + rt[1] * u + up[1] * v, z = fw[2] * F + rt[2] * u + up[2] * v;
  const l = 1 / sqrt(x * x + y * y + z * z);
  D[0] = x * l; D[1] = y * l; D[2] = z * l;
}
// Where o + t D meets the cylinder's side (front), or -1.
function hitCyl(ox, oy, oz, dx, dy, dz) {
  const a = dx * dx + dz * dz, b = ox * dx + oz * dz, c = ox * ox + oz * oz - RC * RC, disc = b * b - a * c;
  if (disc < 0 || a < 1e-12) return -1;
  const t = (-b - sqrt(disc)) / a, y = oy + t * dy;
  return t > 1e-6 && y >= 0 && y <= HC ? t : -1;
}
// From E through LED (sx, sy): off the mirror and down to the floor. Writes
// the floor point's angle round the axis (0 towards E) and radius to FP;
// false if the ray misses the mirror or the reflection rises.
const FP = [0, 0];
function design(cam, sx, sy) {
  ray(cam, sx, sy);
  const o = cam.o, t = hitCyl(o[0], o[1], o[2], D[0], D[1], D[2]);
  if (t < 0) return false;
  const px = o[0] + t * D[0], py = o[1] + t * D[1], pz = o[2] + t * D[2];
  const dn = D[0] * px + D[2] * pz; // normal (px, 0, pz) / RC
  const rx = D[0] - 2 * dn * px, ry = D[1], rz = D[2] - 2 * dn * pz;
  if (ry >= -1e-6) return false;
  const s = -py / ry, qx = px + s * rx, qz = pz + s * rz;
  FP[0] = atan2(qx, qz);
  FP[1] = sqrt(qx * qx + qz * qz);
  return true;
}

// ---- The floor drawing, kept in polar texels round the axis: angle
// -126..126 degrees in 600 steps, radius 1..6.5 in 220.
const TH = 2.2, RA = 1, RB = 6.5, NT = 600, NR = 220;
const PAPER = 6.2; // the sheet under the drawing, out to radius 6.2
// The word's place in E's picture: the rows whose reflection lands between
// radius 1.32 and 6.0 straight in front, and 86% of the mirror's width,
// which comes to rows 12.75 to 52.5 and columns 16.7 to 47.3.
function region(cam) {
  let v0 = 0, v1 = H;
  for (let y = 0; y < H; y += 0.25) {
    if (!design(cam, W / 2, y)) continue;
    if (FP[1] > 6.0) v0 = y + 0.25;
    else if (FP[1] >= 1.32) v1 = y;
  }
  let half = 0;
  const vm = (v0 + v1) / 2;
  for (let x = W / 2; x < W; x += 0.25) if (design(cam, x, vm)) half = x - W / 2;
  return { u0: W / 2 - 0.86 * half, u1: W / 2 + 0.86 * half, v0, v1 };
}

function segDist(px, py, s) {
  const dx = s[2] - s[0], dy = s[3] - s[1], l = dx * dx + dy * dy;
  const t = l > 0 ? cl(((px - s[0]) * dx + (py - s[1]) * dy) / l, 0, 1) : 0;
  const ex = s[0] + t * dx - px, ey = s[1] + t * dy - py;
  return sqrt(ex * ex + ey * ey);
}

// The word as E should see it: ink coverage on a grid four to an LED over
// the region, letters stacked from the top, and which letter each texel is.
const MS = 4;
function wordMask(wi, reg) {
  const word = WORDS[wi], n = word.length;
  const MU = Math.ceil((reg.u1 - reg.u0) * MS) + 2, MV = Math.ceil((reg.v1 - reg.v0) * MS) + 2;
  const mask = new Float32Array(MU * MV), id = new Uint8Array(MU * MV);
  const gap = 2.5, cw = reg.u1 - reg.u0, ch = (reg.v1 - reg.v0 - (n - 1) * gap) / n;
  const pen = n === 1 ? 3.4 : 2.6, hw = pen / 2;
  for (let k = 0; k < n; k++) {
    const x0 = reg.u0, y0 = reg.v0 + k * (ch + gap), sx = cw - pen, sy = ch - pen;
    const segs = [];
    const P = (u, v) => [x0 + hw + u * sx, y0 + hw + v * sy];
    for (const st of GLYPHS[word[k]]) {
      if (st[0] === "L") segs.push([...P(st[1], st[2]), ...P(st[3], st[4])]);
      else {
        const [, cx, cy, rx, ry, a0, a1] = st, m = max(6, Math.ceil(abs(a1 - a0) / 8));
        for (let i = 0; i < m; i++) {
          const b0 = ((a0 + ((a1 - a0) * i) / m) * PI) / 180, b1 = ((a0 + ((a1 - a0) * (i + 1)) / m) * PI) / 180;
          segs.push([...P(cx + rx * cos(b0), cy + ry * sin(b0)), ...P(cx + rx * cos(b1), cy + ry * sin(b1))]);
        }
      }
    }
    // each stroke marks the texels within half a pen of it
    for (const sg of segs) {
      const xa = max(0, floor((min(sg[0], sg[2]) - hw - reg.u0) * MS) - 1), xb = min(MU - 1, Math.ceil((max(sg[0], sg[2]) + hw - reg.u0) * MS) + 1);
      const ya = max(0, floor((min(sg[1], sg[3]) - hw - reg.v0) * MS) - 1), yb = min(MV - 1, Math.ceil((max(sg[1], sg[3]) + hw - reg.v0) * MS) + 1);
      for (let my = ya; my <= yb; my++)
        for (let mx = xa; mx <= xb; mx++) {
          const o = my * MU + mx;
          if (mask[o] >= 1) continue;
          const cov = cl((hw - segDist(reg.u0 + (mx + 0.5) / MS, reg.v0 + (my + 0.5) / MS, sg)) * MS + 0.5, 0, 1);
          if (cov > mask[o]) { mask[o] = cov; id[o] = k; }
        }
    }
  }
  return { mask, id, MU, MV, n };
}

// Trace a picture onto the floor: E's picture is cut into cells st LEDs
// wide, each corner is sent off the mirror to the floor, and each cell's
// two triangles are filled into the polar texels, every texel reading the
// picture where its barycentric place falls in E's picture. look(u, v)
// returns the picture there; skip(u, v) lets a cell with nothing in it go.
function trace(cam, reg, st, look, put, skip) {
  const nu = Math.ceil((reg.u1 - reg.u0) / st) + 1, nv = Math.ceil((reg.v1 - reg.v0) / st) + 1;
  const A = new Float32Array(nu * nv), B = new Float32Array(nu * nv), ok = new Uint8Array(nu * nv);
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++)
      if (design(cam, reg.u0 + i * st, reg.v0 + j * st)) {
        const n = j * nu + i;
        ok[n] = 1;
        A[n] = ((FP[0] + TH) / (2 * TH)) * (NT - 1);
        B[n] = ((FP[1] - RA) / (RB - RA)) * (NR - 1);
      }
  const tri = (a0, b0, u0, v0, a1, b1, u1, v1, a2, b2, u2, v2) => {
    const det = (b1 - b2) * (a0 - a2) + (a2 - a1) * (b0 - b2);
    if (abs(det) < 1e-9) return;
    const xa = max(0, Math.ceil(min(a0, a1, a2))), xb = min(NT - 1, floor(max(a0, a1, a2)));
    const ya = max(0, Math.ceil(min(b0, b1, b2))), yb = min(NR - 1, floor(max(b0, b1, b2)));
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        const w0 = ((b1 - b2) * (x - a2) + (a2 - a1) * (y - b2)) / det, w1 = ((b2 - b0) * (x - a2) + (a0 - a2) * (y - b2)) / det, w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const u = w0 * u0 + w1 * u1 + w2 * u2, v = w0 * v0 + w1 * v1 + w2 * v2;
        put(y * NT + x, u, v, look(u, v));
      }
  };
  for (let j = 0; j + 1 < nv; j++)
    for (let i = 0; i + 1 < nu; i++) {
      const n = j * nu + i;
      if (!ok[n] || !ok[n + 1] || !ok[n + nu] || !ok[n + nu + 1]) continue;
      const u = reg.u0 + i * st, v = reg.v0 + j * st;
      if (skip && skip(u, v, st)) continue;
      tri(A[n], B[n], u, v, A[n + 1], B[n + 1], u + st, v, A[n + nu], B[n + nu], u, v + st);
      tri(A[n + 1], B[n + 1], u + st, v, A[n + nu + 1], B[n + nu + 1], u + st, v + st, A[n + nu], B[n + nu], u, v + st);
    }
}

function floorInk(wi, cam, reg) {
  const wm = wordMask(wi, reg), ink = new Float32Array(NT * NR), lid = new Uint8Array(NT * NR);
  const sample = (u, v) => {
    const mx = (u - reg.u0) * MS - 0.5, my = (v - reg.v0) * MS - 0.5;
    const ix = floor(mx), iy = floor(my);
    if (ix < 0 || iy < 0 || ix >= wm.MU - 1 || iy >= wm.MV - 1) return 0;
    const fx = mx - ix, fy = my - iy, o = iy * wm.MU + ix, m = wm.mask;
    return (m[o] * (1 - fx) + m[o + 1] * fx) * (1 - fy) + (m[o + wm.MU] * (1 - fx) + m[o + wm.MU + 1] * fx) * fy;
  };
  trace(cam, reg, 0.25, sample, (o, u, v, c) => {
    if (c <= ink[o]) return;
    ink[o] = c;
    const mx = cl(round((u - reg.u0) * MS - 0.5), 0, wm.MU - 1), my = cl(round((v - reg.v0) * MS - 0.5), 0, wm.MV - 1);
    lid[o] = wm.id[my * wm.MU + mx];
  }, (u, v, st) => sample(u + st / 2, v + st / 2) === 0 && sample(u, v) === 0 && sample(u + st, v + st) === 0 && sample(u + st, v) === 0 && sample(u, v + st) === 0);
  return { ink, lid };
}

// Niceron's craticule: a square grid laid over the word in E's picture, 6
// cells across and 9 down, traced onto the paper with it, so the paper
// carries the bent grid the drawing was made on.
function craticule(cam, reg) {
  const g = new Float32Array(NT * NR), cw = (reg.u1 - reg.u0) / 6, ch = (reg.v1 - reg.v0) / 9;
  trace(cam, reg, 0.5, (u, v) => {
    const a = abs((u - reg.u0) / cw - round((u - reg.u0) / cw)) * cw, b = abs((v - reg.v0) / ch - round((v - reg.v0) / ch)) * ch;
    return cl(0.45 - min(a, b), 0, 0.25) * 4;
  }, (o, u, v, c) => { if (c > g[o]) g[o] = c; });
  return g;
}

export function setup(params) {
  const cam = camera(E, AIM, {}), reg = region(cam);
  params.s = {
    ph: 0, hue: 0, design: cam, reg, grid: craticule(cam, reg), cache: {}, k3: -1, word: 0, prev: -1, wipe: 1, next: 0,
    cam: camera(E, AIM, {}), col: new Float32Array(9), away: 0.06,
  };
}

function inkOf(S, wi) {
  return S.cache[wi] || (S.cache[wi] = floorInk(wi, S.design, S.reg));
}

const SWAY = 14, HOLD = 7, WIPE = 1.3; // seconds at Speed 2

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  const speed = cl(kv[1], 0.2, 3), k = (d * speed) / 2;
  const k3 = cl(round(kv[2]), 0, WORDS.length - 1);
  if (k3 !== S.k3) {
    S.k3 = k3; S.word = k3; S.prev = -1; S.wipe = 1; S.next = HOLD;
  }
  S.next -= k;
  if (S.next <= 0) {
    S.prev = S.word; S.word = (S.word + 1) % WORDS.length; S.wipe = 0; S.next = HOLD;
  }
  S.wipe = min(1, S.wipe + k / WIPE);
  inkOf(S, S.word);
  // The camera: round the axis by up to 60 degrees and up or down by up to
  // 14, both scaled by Away, on a slow figure of eight through E.
  S.away = cl(kv[3], 0, 1);
  S.ph += (k * 2 * PI) / SWAY;
  const az = S.away * (PI / 3) * sin(S.ph), el = S.away * 0.245 * sin(2 * S.ph + 0.6);
  const r0 = sqrt(E[0] * E[0] + E[2] * E[2]), e0 = atan2(E[1], r0), L = sqrt(r0 * r0 + E[1] * E[1]);
  const e1 = e0 + el, rr = L * cos(e1);
  const pos = [rr * sin(az), L * sin(e1), rr * cos(az)];
  const aim = [AIM[2] * sin(az), AIM[1], AIM[2] * cos(az)];
  camera(pos, aim, S.cam);
  for (let i = 0; i < 3; i++) hsv(S.hue + 0.55 + i / 6, 0.85, 1, S.col, i * 3);
}

// ---- Shading. Ink on paper at a floor point: returns light in C.
const C = [0, 0, 0];
function floorAt(S, x, z) {
  const r = sqrt(x * x + z * z), th = atan2(x, z);
  // bare floor: dark tiles a unit square, their joints a little lighter
  const jx = abs(x - round(x)), jz = abs(z - round(z));
  let br = 0.03, bg = 0.034, bb = 0.045;
  if (min(jx, jz) < 0.035) { br = 0.075; bg = 0.08; bb = 0.095; }
  // the paper: a sheet out to PAPER, darker near the mirror's foot
  if (r < PAPER && abs(th) < TH - 0.05) {
    const edge = cl((PAPER - r) * 8, 0, 1) * cl((TH - 0.05 - abs(th)) * 20, 0, 1);
    const occl = 1 - 0.55 * exp(-(r - RC) * 6);
    br += (0.13 * occl - br) * edge; bg += (0.135 * occl - bg) * edge; bb += (0.15 * occl - bb) * edge;
    const a = ((th + TH) / (2 * TH)) * (NT - 1), b = ((r - RA) / (RB - RA)) * (NR - 1);
    const ia = floor(a), ib = floor(b);
    if (ia >= 0 && ib >= 0 && ia < NT - 1 && ib < NR - 1) {
      const fa = a - ia, fb = b - ib, o = ib * NT + ia;
      const G = S.grid, gr = ((G[o] * (1 - fa) + G[o + 1] * fa) * (1 - fb) + (G[o + NT] * (1 - fa) + G[o + NT + 1] * fa) * fb) * edge;
      br += 0.13 * gr; bg += 0.14 * gr; bb += 0.16 * gr;
      // the new word wipes outwards from the mirror's foot over the old
      const front = RC + S.wipe * (PAPER - RC + 0.4);
      const mixNew = cl((front - r) * 3, 0, 1);
      let ink = 0, id = 0;
      for (let pass = 0; pass < 2; pass++) {
        const wi = pass ? S.prev : S.word, wgt = pass ? 1 - mixNew : mixNew;
        if (wi < 0 || wgt <= 0) continue;
        const T = S.cache[wi];
        if (!T) continue;
        const I = T.ink, c = (I[o] * (1 - fa) + I[o + 1] * fa) * (1 - fb) + (I[o + NT] * (1 - fa) + I[o + NT + 1] * fa) * fb;
        if (c * wgt > ink) {
          ink = c * wgt;
          id = T.lid[I[o] > 0 ? o : I[o + 1] > 0 ? o + 1 : I[o + NT] > 0 ? o + NT : o + NT + 1];
        }
      }
      if (ink > 0) {
        const col = S.col, q = id * 3;
        br += (col[q] * 0.95 - br) * ink; bg += (col[q + 1] * 0.95 - bg) * ink; bb += (col[q + 2] * 0.95 - bb) * ink;
      }
    }
  }
  C[0] = br; C[1] = bg; C[2] = bb;
}
// The room above, near black. From this eye no ray reaches it: the mirror
// keeps a ray's fall, and the eye stands above the mirror's top.
function skyAt() {
  C[0] = 0.02; C[1] = 0.02; C[2] = 0.03;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const cam = S.cam, o = cam.o, ox = o[0], oy = o[1], oz = o[2];
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      ray(cam, px + 0.5, py + 0.5);
      const dx = D[0], dy = D[1], dz = D[2];
      let r = 0, g = 0, b = 0;
      const tc = hitCyl(ox, oy, oz, dx, dy, dz);
      // the top of the cylinder
      const tt = dy < 0 ? (HC - oy) / dy : -1;
      const cx = ox + tt * dx, cz = oz + tt * dz;
      if (tt > 0 && cx * cx + cz * cz <= RC * RC && (tc < 0 || tt < tc)) {
        const rr = sqrt(cx * cx + cz * cz);
        const rim = cl((rr - 0.88) * 9, 0, 1);
        r = 0.07 + 0.3 * rim; g = 0.075 + 0.3 * rim; b = 0.09 + 0.32 * rim;
      } else if (tc > 0) {
        // the mirror: reflect and look again, a little blue and dimmer,
        // brighter where the ray grazes
        const hx = ox + tc * dx, hy = oy + tc * dy, hz = oz + tc * dz;
        const dn = dx * hx + dz * hz, rx = dx - 2 * dn * hx, ry = dy, rz = dz - 2 * dn * hz;
        if (ry < 0) floorAt(S, hx - (hy / ry) * rx, hz - (hy / ry) * rz);
        else skyAt();
        const k = 0.8 + 0.2 * Math.pow(1 - abs(dn), 4);
        r = C[0] * k * 0.88; g = C[1] * k * 0.93; b = C[2] * k;
      } else if (dy < 0) {
        const t = -oy / dy;
        floorAt(S, ox + t * dx, oz + t * dz);
        r = C[0]; g = C[1]; b = C[2];
      } else {
        skyAt();
        r = C[0]; g = C[1]; b = C[2];
      }
      display.setPixel(px, py, (255 * cl(r, 0, 1)) | 0, (255 * cl(g, 0, 1)) | 0, (255 * cl(b, 0, 1)) | 0);
    }
}
