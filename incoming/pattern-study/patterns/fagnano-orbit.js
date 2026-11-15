// ===== Patternflow pattern =====
// Title:   Fagnano Orbit
// Family:  geometry
// Idea:    Join the feet of the three altitudes of an acute triangle and a ray of light fired along that triangle closes on itself after three bounces, and a ray fired from a little to either side closes after six, on a hexagon of exactly the same total length.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Fagnano's problem, that the orthic triangle is the shortest triangle inscribed in an acute one (Giovanni Fagnano, 1775), which Hermann Schwarz later proved by folding the triangle's reflections into a strip (1880s), original, pattern round 138
// Round:   138
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Lean=0..3, Height=-1..1, Offset=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. The six stretches of the ray's path take colours a little round it from the first to the last.
// Knob 2: Lean. Where the top corner of the triangle stands over its base, from near the left corner to near the right one, always short of them so that the triangle stays acute; the knob's 2 is a place right of the middle.
// Knob 3: Height. How high the top corner stands over the base, from the flattest acute triangle at the left to a tall one at the right, with the knob's start a little under twice as high as the base is wide. The triangle always stays acute.
// Knob 4: Offset. Where on the base the ray is fired from, in steps from the foot of the altitude out to the farthest start that still closes on six bounces, and past the foot to the other side at the left. At the foot, which is near the left end, the path is the orthic triangle drawn twice; the knob's start is a path out to one side of it.

const W = 64;
const H = 128;

function hsv(h, s, v, out, at) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[at] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[at + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[at + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(params) {
  params.t = 0;
  // Triangle corners A, B, C, then the feet D, E, F of the altitudes from A, B, C, then the orthocentre, as screen points.
  params.vx = new Float32Array(7);
  params.vy = new Float32Array(7);
  // The ray's path: seven points, the last the same as the first.
  params.qx = new Float32Array(7);
  params.qy = new Float32Array(7);
  // The triangle and the orthic triangle as edge lines, three each.
  params.ex = new Float32Array(6);
  params.ey = new Float32Array(6);
  params.ec = new Float32Array(6);
  params.col = new Float32Array(30);
  params.wide = new Float32Array(10);
  params.ft = new Float32Array(6);
}

// Fire a ray from the base at distance d from the foot of the altitude, along the orthic triangle's first side,
// and fill the path. Returns how far the path misses its start, or a large number if it leaves the pattern.
function trace(d, w, ox, oy) {
  const ax = w[0];
  const ay = w[1];
  const bx = w[2];
  const by = w[3];
  const cx = w[4];
  const cy = w[5];
  const dx = w[6];
  const dy = w[7];
  const ex = w[8];
  const ey = w[9];
  // Corners of the three sides, in the order the ray meets them: C A, A B, B C, then again.
  const sx = [cx, ax, bx];
  const sy = [cy, ay, by];
  const tx = [ax, bx, cx];
  const ty = [ay, by, cy];
  const L = Math.sqrt((cx - bx) * (cx - bx) + (cy - by) * (cy - by));
  let ux = ex - dx;
  let uy = ey - dy;
  const ul = Math.sqrt(ux * ux + uy * uy);
  ux /= ul;
  uy /= ul;
  let px = dx + (d * (cx - bx)) / L;
  let py = dy + (d * (cy - by)) / L;
  ox[0] = px;
  oy[0] = py;
  for (let j = 0; j < 6; j++) {
    const s = j % 3;
    const hx = tx[s] - sx[s];
    const hy = ty[s] - sy[s];
    const den = ux * hy - uy * hx;
    if (Math.abs(den) < 1e-9) return 1e9;
    const lam = ((sx[s] - px) * hy - (sy[s] - py) * hx) / den;
    const mu = ((sx[s] - px) * uy - (sy[s] - py) * ux) / den;
    if (lam < 1e-7 || mu < 0 || mu > 1) return 1e9;
    px += ux * lam;
    py += uy * lam;
    ox[j + 1] = px;
    oy[j + 1] = py;
    const hl = Math.sqrt(hx * hx + hy * hy);
    const nx = -hy / hl;
    const ny = hx / hl;
    const dot = ux * nx + uy * ny;
    ux -= 2 * dot * nx;
    uy -= 2 * dot * ny;
  }
  return Math.sqrt((ox[6] - ox[0]) * (ox[6] - ox[0]) + (oy[6] - oy[0]) * (oy[6] - oy[0]));
}

function foot(px, py, qx, qy, rx, ry, out, at) {
  const dx = rx - qx;
  const dy = ry - qy;
  const u = ((px - qx) * dx + (py - qy) * dy) / (dx * dx + dy * dy);
  out[at] = qx + dx * u;
  out[at + 1] = qy + dy * u;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath moves the top corner and slides the start along the base.
  let c = -0.8 + (1.6 * k[1]) / 3 + 0.08 * Math.sin(t * 0.43 + 1);
  if (c > 0.88) c = 0.88;
  if (c < -0.88) c = -0.88;
  const hmin = 1.1 * Math.sqrt(1 - c * c);
  let u = (k[2] + 1) * 0.5 + 0.05 * Math.sin(t * 0.37 + 2);
  if (u < 0) u = 0;
  if (u > 1) u = 1;
  const h = hmin + u * u * (4.2 - hmin);
  // The triangle's corners and the feet of its altitudes, in a frame where the base is two across.
  const wide = params.wide;
  const f = params.vx;
  const g = params.vy;
  f[0] = -1;
  g[0] = 0;
  f[1] = 1;
  g[1] = 0;
  f[2] = c;
  g[2] = -h;
  const tmp = params.ft;
  foot(f[0], g[0], f[1], g[1], f[2], g[2], tmp, 0);
  foot(f[1], g[1], f[2], g[2], f[0], g[0], tmp, 2);
  foot(f[2], g[2], f[0], g[0], f[1], g[1], tmp, 4);
  f[3] = tmp[0];
  g[3] = tmp[1];
  f[4] = tmp[2];
  g[4] = tmp[3];
  f[5] = tmp[4];
  g[5] = tmp[5];
  f[6] = c;
  g[6] = (c * c - 1) / h;
  const qx = params.qx;
  const qy = params.qy;
  // The ray starts at the foot D of the altitude from A and runs to E, the foot of the altitude from B.
  for (let i = 0; i < 5; i++) {
    wide[i * 2] = f[i];
    wide[i * 2 + 1] = g[i];
  }
  // How far from the foot D the start can be before the path leaves its three sides.
  const L = Math.sqrt((f[2] - f[1]) * (f[2] - f[1]) + (g[2] - g[1]) * (g[2] - g[1]));
  let hi = 0;
  let lo = 0;
  for (let side = 0; side < 2; side++) {
    const sg = side === 0 ? 1 : -1;
    let a = 0;
    let b = 0.95 * L;
    if (trace(sg * b, wide, qx, qy) < 1e-4) a = b;
    else {
      for (let i = 0; i < 18; i++) {
        const m = (a + b) * 0.5;
        if (trace(sg * m, wide, qx, qy) < 1e-4) a = m;
        else b = m;
      }
    }
    if (side === 0) hi = a;
    else lo = a;
  }
  // The offset knob, from the other side of the foot at the left to the farthest start at the right.
  const kk = k[3];
  let off = kk < 0.06 ? 0.38 + (kk - 0.06) * 1.2075 : 0.38 + (kk - 0.06) * 0.606;
  off += 0.07 * Math.sin(t * 0.31 + 0.5);
  if (off > 0.95) off = 0.95;
  if (off < -0.95) off = -0.95;
  const d = off * (off > 0 ? hi : lo) * 0.97;
  let err = trace(d, wide, qx, qy);
  if (err > 1e-3) {
    err = trace(0, wide, qx, qy);
  }
  // Everything is moved and scaled so that the triangle just fits the panel.
  const x0 = Math.min(f[0], f[2]);
  const x1 = Math.max(f[1], f[2]);
  const y0 = -h;
  const y1 = 0;
  const mx = (x0 + x1) * 0.5;
  const my = (y0 + y1) * 0.5;
  const s = Math.min(28 / Math.max(0.001, (x1 - x0) * 0.5), 58 / Math.max(0.001, (y1 - y0) * 0.5));
  for (let i = 0; i < 7; i++) {
    f[i] = W / 2 + (f[i] - mx) * s;
    g[i] = H / 2 + (g[i] - my) * s;
    qx[i] = W / 2 + (qx[i] - mx) * s;
    qy[i] = H / 2 + (qy[i] - my) * s;
  }
  // The triangle and the orthic triangle D E F as edge lines.
  const tri = [0, 1, 2, 3, 4, 5];
  for (let q = 0; q < 2; q++) {
    const idx = [tri[q * 3], tri[q * 3 + 1], tri[q * 3 + 2]];
    let area = 0;
    for (let i = 0; i < 3; i++) {
      const a = idx[i];
      const b = idx[(i + 1) % 3];
      area += f[a] * g[b] - f[b] * g[a];
    }
    const sgn = area > 0 ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const a = idx[i];
      const b = idx[(i + 1) % 3];
      const bx = f[b] - f[a];
      const by = g[b] - g[a];
      const len = Math.max(0.0001, Math.sqrt(bx * bx + by * by));
      params.ex[q * 3 + i] = (-sgn * by) / len;
      params.ey[q * 3 + i] = (sgn * bx) / len;
      params.ec[q * 3 + i] = (sgn * (-bx * g[a] + by * f[a])) / len;
    }
  }
  hsv(k[0] + 0.62, 0.5, 0.27, params.col, 0);
  hsv(k[0] + 0.6, 0.22, 0.6, params.col, 3);
  hsv(k[0] + 0.58, 0.45, 0.62, params.col, 6);
  for (let j = 0; j < 6; j++) hsv(k[0] + 0.1 + 0.07 * j, 0.82, 1, params.col, 9 + j * 3);
}

function seg(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  let u = ((x - ax) * dx + (y - ay) * dy) / Math.max(0.0001, dx * dx + dy * dy);
  if (u < 0) u = 0;
  else if (u > 1) u = 1;
  const ex = x - (ax + dx * u);
  const ey = y - (ay + dy * u);
  return Math.sqrt(ex * ex + ey * ey);
}

export function draw(display, params, time) {
  const ex = params.ex;
  const ey = params.ey;
  const ec = params.ec;
  const col = params.col;
  const f = params.vx;
  const g = params.vy;
  const qx = params.qx;
  const qy = params.qy;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      let r = 3;
      let gg = 3;
      let b = 8;
      // The triangle, then the orthic triangle inside it.
      for (let q = 0; q < 2; q++) {
        const o = q * 3;
        let d = ex[o] * px + ey[o] * py + ec[o];
        const e1 = ex[o + 1] * px + ey[o + 1] * py + ec[o + 1];
        const e2 = ex[o + 2] * px + ey[o + 2] * py + ec[o + 2];
        if (e1 < d) d = e1;
        if (e2 < d) d = e2;
        let cv = d + 0.5;
        if (cv <= 0) continue;
        if (cv > 1) cv = 1;
        r += (col[q * 3] - r) * cv;
        gg += (col[q * 3 + 1] - gg) * cv;
        b += (col[q * 3 + 2] - b) * cv;
      }
      // The three altitudes, thin, from each corner to its foot; they meet at the orthocentre.
      let da = seg(px, py, f[0], g[0], f[3], g[3]);
      const db = seg(px, py, f[1], g[1], f[4], g[4]);
      const dc = seg(px, py, f[2], g[2], f[5], g[5]);
      if (db < da) da = db;
      if (dc < da) da = dc;
      let ca = 1.0 - da;
      if (ca > 0) {
        if (ca > 1) ca = 1;
        ca *= 0.5;
        r += (col[6] - r) * ca;
        gg += (col[7] - gg) * ca;
        b += (col[8] - b) * ca;
      }
      // The ray's path, six stretches, each its own colour.
      for (let j = 0; j < 6; j++) {
        const dj = seg(px, py, qx[j], qy[j], qx[j + 1], qy[j + 1]);
        let cp = 1.4 - dj;
        if (cp > 0) {
          if (cp > 1) cp = 1;
          r += (col[9 + j * 3] - r) * cp;
          gg += (col[10 + j * 3] - gg) * cp;
          b += (col[11 + j * 3] - b) * cp;
        }
      }
      // A dot at each bounce and at the orthocentre.
      for (let j = 0; j < 7; j++) {
        const dx = px - (j < 6 ? qx[j] : f[6]);
        const dy = py - (j < 6 ? qy[j] : g[6]);
        const q = dx * dx + dy * dy;
        if (q < 8) {
          let cd = 2.3 - Math.sqrt(q);
          if (cd > 1) cd = 1;
          if (cd > 0) {
            r += (255 - r) * cd;
            gg += (250 - gg) * cd;
            b += (240 - b) * cd;
          }
        }
      }
      display.setPixel(x, y, r, gg, b);
    }
  }
}
