// ===== Patternflow pattern =====
// Title:   Radiosity Plan
// Family:  radiosity
// Idea:    A plan of a tall room with thick coloured walls, partitions and doorways, where two lamps wander through the rooms and the light bounces between the diffuse walls, so the floor beside a red wall glows red and colour travels round corners and through doorways to the next room.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: radiosity by the diffuse-interreflection integral solved on wall patches (Cindy Goral, Kenneth Torrance, Donald Greenberg and Bennett Battaile, 1984; Michael Cohen and Greenberg, 1985), with the 2D flatland form factor and Gauss-Seidel sweeps, all from memory, pattern round 229
// Round:   229
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Lamp=0.4..2.5, Bounce=-1..1, Spread=-1..1
//
// Knob 1: Hue. Turns the palette of wall colours once round the wheel (the same at 0 and at 1). At 0 the middle of the palette is green-cyan, 140 degrees, with the walls spread yellow to violet round it; on top of that every wall drifts on its own by up to about 100 degrees and the whole palette turns 1.3 degrees a second, so no minute repeats.
// Knob 2: Lamp. How fast the two lamps travel and how fast their routes evolve, from 1.4 LEDs a second at 0.4 (a lamp takes 40 s to cross a room) to 9 LEDs a second at 2.5, 7 where it opens at 2. A lamp is steered through the doorways towards a point that wanders on three sines per axis.
// Knob 3: Bounce. How much light a wall gives back, an albedo of 0.29 at -1 where only the floor right beside a wall takes its colour and the walls glow dim, 0.62 at 0 where it opens, and 0.95 at +1 where colour floods whole rooms through several bounces.
// Knob 4: Spread. How far apart the wall hues are, 10 degrees either side of the middle at -1 (the walls differ only by their drift), 160 at 0.06 where it opens (nearly the whole wheel is in use) and 210 at +1 (the whole wheel, neighbouring walls near complements).

const W = 64, H = 128;
const { floor, sqrt, exp, log, sin, cos, abs, min, max, PI, atan2, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the plan ---------------------------------------------------------------
// Solid rectangles x0, y0, x1, y1 in LED units. The first four are the outer wall, 4 LEDs thick; the rest
// are partitions 3 LEDs thick whose ends reach into a wall they meet.
const OUTER = [[0, 0, 64, 4], [0, 124, 64, 128], [0, 4, 4, 124], [60, 4, 64, 124]];
const PARTS = [
  [2, 30, 26, 33],
  [38, 30, 62, 33],
  [29, 2, 32, 16],
  [44, 32, 47, 72],
  [2, 60, 30, 63],
  [18, 92, 62, 95],
  [36, 94, 39, 112],
  [20, 74, 23, 86],
];
const NO = OUTER.length, NPART = PARTS.length, NR = NO + NPART;
const RX0 = new Float64Array(NR), RY0 = new Float64Array(NR), RX1 = new Float64Array(NR), RY1 = new Float64Array(NR);
for (let r = 0; r < NR; r++) {
  const q = r < NO ? OUTER[r] : PARTS[r - NO];
  RX0[r] = q[0]; RY0[r] = q[1]; RX1[r] = q[2]; RY1[r] = q[3];
}
const HUE_D = [-0.7, 0.7, 0.1, -0.95, 0.9, -0.3, 0.3, -0.75, -0.1, 0.55, 0.85, -0.45, 0.15, -0.85, 0.6, -0.2, 1.0, 0.35, -0.65, 0.45];
const NE = NO + 2 * NPART; // entities with a colour of their own: the four outer faces, two faces a partition

const ihash = (n) => {
  let h = (n | 0) + 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

function inSolid(x, y, m) {
  for (let r = 0; r < NR; r++) if (x > RX0[r] - m && x < RX1[r] + m && y > RY0[r] - m && y < RY1[r] + m) return true;
  return false;
}

// Does the segment a-b cross the inside of any partition (each shrunk by e)? The outer wall never blocks:
// every point we ask about lies in the room, which is convex.
function blocked(ax, ay, bx, by, e) {
  const dx = bx - ax, dy = by - ay;
  for (let r = NO; r < NR; r++) {
    let t0 = 0, t1 = 1;
    const x0 = RX0[r] + e, x1 = RX1[r] - e, y0 = RY0[r] + e, y1 = RY1[r] - e;
    if (dx > 1e-12 || dx < -1e-12) {
      const inv = 1 / dx;
      let ta = (x0 - ax) * inv, tb = (x1 - ax) * inv;
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 >= t1) continue;
    } else if (ax <= x0 || ax >= x1) continue;
    if (dy > 1e-12 || dy < -1e-12) {
      const inv = 1 / dy;
      let ta = (y0 - ay) * inv, tb = (y1 - ay) * inv;
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 >= t1) continue;
    } else if (ay <= y0 || ay >= y1) continue;
    return true;
  }
  return false;
}

// First hit of the ray q + t u (u has L1 length 1) with a partition, or a big number.
function rayHit(qx, qy, ux, uy) {
  let best = 1e4;
  for (let r = NO; r < NR; r++) {
    let t0 = 0, t1 = 1e4;
    const x0 = RX0[r], x1 = RX1[r], y0 = RY0[r], y1 = RY1[r];
    if (ux > 1e-12 || ux < -1e-12) {
      const inv = 1 / ux;
      let ta = (x0 - qx) * inv, tb = (x1 - qx) * inv;
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 >= t1) continue;
    } else if (qx <= x0 || qx >= x1) continue;
    if (uy > 1e-12 || uy < -1e-12) {
      const inv = 1 / uy;
      let ta = (y0 - qy) * inv, tb = (y1 - qy) * inv;
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 >= t1) continue;
    } else if (qy <= y0 || qy >= y1) continue;
    if (t0 < best) best = t0;
  }
  return best;
}

// ---- wall patches -----------------------------------------------------------
const PATCH_LEN = 3;
const NSUB = 3; // sub-segments a patch is sampled in for visibility

function buildPatches(P) {
  const mx = [], my = [], nx = [], ny = [], tx = [], ty = [], len = [], ent = [], face = [], prev = [], next = [];
  let faceId = 0;
  for (let r = 0; r < NR; r++) {
    const x0 = RX0[r], y0 = RY0[r], x1 = RX1[r], y1 = RY1[r];
    const horiz = x1 - x0 > y1 - y0;
    // face: a x, a y, b x, b y, normal x, normal y
    const faces = [
      [x0, y0, x1, y0, 0, -1], [x0, y1, x1, y1, 0, 1],
      [x0, y0, x0, y1, -1, 0], [x1, y0, x1, y1, 1, 0],
    ];
    for (let f = 0; f < 4; f++) {
      const [ax, ay, bx, by, fnx, fny] = faces[f];
      let e;
      if (r < NO) e = f === [1, 0, 3, 2][r] ? r : -1;
      else {
        const p = r - NO;
        const sideA = horiz ? f === 0 : f === 2, sideB = horiz ? f === 1 : f === 3;
        e = NO + 2 * p + (sideB ? 1 : 0);
        if (!sideA && !sideB) e = NO + 2 * p;
      }
      if (e < 0) continue;
      const L = sqrt((bx - ax) ** 2 + (by - ay) ** 2);
      const n = max(1, Math.round(L / PATCH_LEN));
      const ttx = (bx - ax) / L, tty = (by - ay) / L;
      let last = -1;
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n;
        const px = ax + (bx - ax) * u, py = ay + (by - ay) * u;
        const ox = px + fnx * 0.6, oy = py + fny * 0.6;
        if (ox < 0.05 || ox > 63.95 || oy < 0.05 || oy > 127.95 || inSolid(ox, oy, 0)) { last = -1; continue; }
        const i = mx.length;
        mx.push(px); my.push(py); nx.push(fnx); ny.push(fny); tx.push(ttx); ty.push(tty);
        len.push(L / n); ent.push(e); face.push(faceId + f);
        prev.push(last); next.push(-1);
        if (last >= 0) next[last] = i;
        last = i;
      }
    }
    faceId += 4;
  }
  const np = mx.length;
  P.np = np;
  P.pmx = Float64Array.from(mx); P.pmy = Float64Array.from(my);
  P.pnx = Float64Array.from(nx); P.pny = Float64Array.from(ny);
  P.ptx = Float64Array.from(tx); P.pty = Float64Array.from(ty);
  P.plen = Float64Array.from(len);
  P.pent = Int16Array.from(ent); P.pface = Int16Array.from(face);
  P.pprev = Int16Array.from(prev); P.pnext = Int16Array.from(next);
}

// Patch to patch form factors, flatland: F = (sin b - sin a) / 2 from the angles of a sub-segment's ends
// to the normal of the receiving patch, kept where the two face each other and nothing stands between.
// Rows are scaled to add up to 1, which a closed room demands and the sampling only nearly gives.
function buildPatchMatrix(P) {
  const np = P.np, { pmx, pmy, pnx, pny, ptx, pty, plen } = P;
  const rp = new Int32Array(np + 1);
  let cap = np * 64, cj = new Int16Array(cap), fv = new Float32Array(cap), nn = 0;
  const jj = new Int16Array(np), ff = new Float64Array(np);
  for (let i = 0; i < np; i++) {
    const ax = pmx[i] + pnx[i] * 0.05, ay = pmy[i] + pny[i] * 0.05;
    let cnt = 0, sum = 0;
    for (let j = 0; j < np; j++) {
      if (j === i) continue;
      if ((pmx[j] - pmx[i]) * pnx[i] + (pmy[j] - pmy[i]) * pny[i] <= 0.02) continue;
      if ((pmx[i] - pmx[j]) * pnx[j] + (pmy[i] - pmy[j]) * pny[j] <= 0.02) continue;
      let f = 0;
      const h = plen[j] / NSUB;
      for (let s = 0; s < NSUB; s++) {
        const off = (s + 0.5) * h - plen[j] / 2;
        const cx = pmx[j] + ptx[j] * off, cy = pmy[j] + pty[j] * off;
        if ((cx - pmx[i]) * pnx[i] + (cy - pmy[i]) * pny[i] <= 0.01) continue;
        if (blocked(ax, ay, cx + pnx[j] * 0.05, cy + pny[j] * 0.05, 0.02)) continue;
        const d1x = cx - ptx[j] * h / 2 - pmx[i], d1y = cy - pty[j] * h / 2 - pmy[i];
        const d2x = cx + ptx[j] * h / 2 - pmx[i], d2y = cy + pty[j] * h / 2 - pmy[i];
        const s1 = (d1x * ptx[i] + d1y * pty[i]) / sqrt(d1x * d1x + d1y * d1y);
        const s2 = (d2x * ptx[i] + d2y * pty[i]) / sqrt(d2x * d2x + d2y * d2y);
        f += 0.5 * abs(s2 - s1);
      }
      if (f > 1e-5) { jj[cnt] = j; ff[cnt] = f; cnt++; sum += f; }
    }
    if (nn + cnt > cap) {
      cap *= 2;
      const a = new Int16Array(cap); a.set(cj); cj = a;
      const b = new Float32Array(cap); b.set(fv); fv = b;
    }
    const sc = sum > 0 ? 1 / sum : 0;
    for (let k = 0; k < cnt; k++) { cj[nn] = jj[k]; fv[nn] = ff[k] * sc; nn++; }
    rp[i + 1] = nn;
  }
  P.frp = rp; P.fcj = cj.slice(0, nn); P.ffv = fv.slice(0, nn);
}

// ---- floor samples ----------------------------------------------------------
// One sample for every 2 by 2 LEDs. Its light from the walls is the share of its horizon each visible
// patch fills, times the patch's radiosity; the weights are computed once.
const SW = 32, SH = 64;
const AO_MIN = 0.45;
const RW = 14; // how far a wall's colour carries over the floor: a wall's share is halved at this distance
function buildSamples(P) {
  const np = P.np, { pmx, pmy, pnx, pny, ptx, pty, plen } = P;
  const sidx = new Int16Array(SW * SH).fill(-1);
  const sx = [], sy = [];
  for (let j = 0; j < SH; j++)
    for (let i = 0; i < SW; i++) {
      const x = 2 * i + 1, y = 2 * j + 1;
      if (inSolid(x, y, 0.3)) continue;
      sidx[j * SW + i] = sx.length; sx.push(x); sy.push(y);
    }
  const ns = sx.length;
  P.ns = ns; P.sx = Float64Array.from(sx); P.sy = Float64Array.from(sy); P.sidx = sidx;
  const rp = new Int32Array(ns + 1);
  let cap = ns * 96, cj = new Int16Array(cap), fv = new Float32Array(cap), nn = 0;
  for (let s = 0; s < ns; s++) {
    const px = sx[s], py = sy[s];
    for (let j = 0; j < np; j++) {
      if ((px - pmx[j]) * pnx[j] + (py - pmy[j]) * pny[j] <= 0.02) continue;
      let f = 0;
      const h = plen[j] / NSUB;
      for (let q = 0; q < NSUB; q++) {
        const off = (q + 0.5) * h - plen[j] / 2;
        const cx = pmx[j] + ptx[j] * off, cy = pmy[j] + pty[j] * off;
        if ((px - cx) * pnx[j] + (py - cy) * pny[j] <= 0.02) continue;
        if (blocked(px, py, cx + pnx[j] * 0.05, cy + pny[j] * 0.05, 0.02)) continue;
        const d1x = cx - ptx[j] * h / 2 - px, d1y = cy - pty[j] * h / 2 - py;
        const d2x = cx + ptx[j] * h / 2 - px, d2y = cy + pty[j] * h / 2 - py;
        const rc2 = (cx - px) ** 2 + (cy - py) ** 2;
        f += abs(atan2(d1x * d2y - d1y * d2x, d1x * d2x + d1y * d2y)) / (1 + rc2 / (RW * RW));
      }
      if (f > 1e-4) {
        if (nn >= cap) {
          cap *= 2;
          const a = new Int16Array(cap); a.set(cj); cj = a;
          const b = new Float32Array(cap); b.set(fv); fv = b;
        }
        cj[nn] = j; fv[nn] = f / TAU; nn++;
      }
    }
    rp[s + 1] = nn;
  }
  P.srp = rp; P.scj = cj.slice(0, nn); P.sfv = fv.slice(0, nn);

  // each floor pixel reads the four nearest samples that exist
  const fi = new Int16Array(W * H * 4).fill(-1), fw = new Float32Array(W * H * 4);
  const kind = new Uint8Array(W * H); // 0 floor, 1 wall
  const ao = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      if (inSolid(x + 0.5, y + 0.5, 0)) { kind[o] = 1; continue; }
      const u = (x - 0.5) / 2, v = (y - 0.5) / 2;
      const i0 = floor(u), j0 = floor(v), fu = u - i0, fv2 = v - j0;
      let tot = 0, got = 0;
      for (let k = 0; k < 4; k++) {
        const ii = i0 + (k & 1), jj2 = j0 + (k >> 1);
        if (ii < 0 || ii >= SW || jj2 < 0 || jj2 >= SH) continue;
        const si = sidx[jj2 * SW + ii];
        if (si < 0) continue;
        const wgt = ((k & 1) ? fu : 1 - fu) * ((k >> 1) ? fv2 : 1 - fv2) + 1e-4;
        fi[o * 4 + got] = si; fw[o * 4 + got] = wgt; tot += wgt; got++;
      }
      if (got === 0) {
        // nearest existing sample in a small window
        let bd = 1e9, bs = -1;
        for (let jj2 = j0 - 2; jj2 <= j0 + 3; jj2++)
          for (let ii = i0 - 2; ii <= i0 + 3; ii++) {
            if (ii < 0 || ii >= SW || jj2 < 0 || jj2 >= SH) continue;
            const si = sidx[jj2 * SW + ii];
            if (si < 0) continue;
            const d = (2 * ii + 1 - x - 0.5) ** 2 + (2 * jj2 + 1 - y - 0.5) ** 2;
            if (d < bd) { bd = d; bs = si; }
          }
        if (bs >= 0) { fi[o * 4] = bs; fw[o * 4] = 1; tot = 1; }
      }
      if (tot > 0) for (let k = 0; k < 4; k++) fw[o * 4 + k] /= tot;
      // the floor is a little darker where it meets a wall
      let dm = 1e9;
      for (let r = 0; r < NR; r++) {
        const ex = max(RX0[r] - (x + 0.5), 0, x + 0.5 - RX1[r]), ey = max(RY0[r] - (y + 0.5), 0, y + 0.5 - RY1[r]);
        const dd = ex * ex + ey * ey;
        if (dd < dm) dm = dd;
      }
      const q = cl((sqrt(dm) - 0.5) / 2.5, 0, 1);
      ao[o] = AO_MIN + (1 - AO_MIN) * q * q * (3 - 2 * q);
    }
  P.fi = fi; P.fw = fw; P.kind = kind; P.ao = ao;
}

// Wall pixels: the nearest patch, blended along its face with the next patch; a pixel is shaded a little darker
// the deeper it lies in the wall.
function buildWallPixels(P) {
  const np = P.np, { pmx, pmy, ptx, pty, plen, pface, pprev, pnext } = P;
  const list = [];
  for (let o = 0; o < W * H; o++) if (P.kind[o] === 1) list.push(o);
  const nw = list.length;
  P.nw = nw; P.wpix = Int32Array.from(list);
  P.wa = new Int16Array(nw * 2); P.wt = new Float32Array(nw); P.wsh = new Float32Array(nw);
  for (let n = 0; n < nw; n++) {
    const o = list[n], cx = (o % W) + 0.5, cy = floor(o / W) + 0.5;
    let b1 = -1, d1 = 1e9, s1 = 0;
    for (let i = 0; i < np; i++) {
      const s = (cx - pmx[i]) * ptx[i] + (cy - pmy[i]) * pty[i];
      const sc = cl(s, -plen[i] / 2, plen[i] / 2);
      const qx = pmx[i] + ptx[i] * sc - cx, qy = pmy[i] + pty[i] * sc - cy;
      const d = sqrt(qx * qx + qy * qy);
      if (d < d1 - 0.01) { b1 = i; d1 = d; s1 = s; }
    }
    const u = cl(s1 / plen[b1], -0.5, 0.5), nb = u >= 0 ? pnext[b1] : pprev[b1];
    P.wa[n * 2] = b1;
    P.wa[n * 2 + 1] = nb >= 0 ? nb : b1;
    P.wt[n] = nb >= 0 ? abs(u) : 0;
    P.wsh[n] = 1 - 0.25 * cl((d1 - 0.5) / 3, 0, 1);
  }
}

// ---- the lamps' roadmap -----------------------------------------------------
// Nodes every 4 LEDs where a lamp keeps 3.6 LEDs clear of every wall; neighbours are joined when the segment
// between them keeps 3 clear. A lamp is steered to a point that wanders by three sines on each axis.
const GX0 = 8, GY0 = 8, GD = 4, GNX = 13, GNY = 29, NN = GNX * GNY;
function buildRoadmap(P) {
  const nx = new Float64Array(NN), ny = new Float64Array(NN), ok = new Uint8Array(NN);
  for (let n = 0; n < NN; n++) {
    nx[n] = GX0 + GD * (n % GNX); ny[n] = GY0 + GD * floor(n / GNX);
    ok[n] = inSolid(nx[n], ny[n], 3.6) ? 0 : 1;
  }
  const ap = new Int32Array(NN + 1), an = [], ac = [];
  for (let n = 0; n < NN; n++) {
    if (ok[n]) {
      const i = n % GNX, j = floor(n / GNX);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ii = i + di, jj = j + dj;
          if (ii < 0 || ii >= GNX || jj < 0 || jj >= GNY) continue;
          const m = jj * GNX + ii;
          if (!ok[m]) continue;
          if (blocked(nx[n], ny[n], nx[m], ny[m], -3.0)) continue;
          an.push(m); ac.push(di && dj ? 14 : 10);
        }
    }
    ap[n + 1] = an.length;
  }
  P.gx = nx; P.gy = ny; P.gok = ok; P.gap = ap; P.gan = Int16Array.from(an); P.gac = Int16Array.from(ac);
  P.gq = new Int16Array(NN * 4);
}

// Shortest cost from every node to the goal node, by a queue relaxing until nothing improves.
function roadDistances(P, d, goal) {
  const q = P.gq, { gap, gan, gac } = P;
  d.fill(1e9);
  d[goal] = 0;
  let head = 0, tail = 0, size = NN * 4;
  q[tail++] = goal;
  const inq = P.ginq || (P.ginq = new Uint8Array(NN));
  inq.fill(0); inq[goal] = 1;
  while (head !== tail) {
    const a = q[head]; head = (head + 1) % size; inq[a] = 0;
    for (let k = gap[a]; k < gap[a + 1]; k++) {
      const b = gan[k], nd = d[a] + gac[k];
      if (nd < d[b]) {
        d[b] = nd;
        if (!inq[b]) { inq[b] = 1; q[tail] = b; tail = (tail + 1) % size; }
      }
    }
  }
}

function nearestNode(P, x, y) {
  let best = -1, bd = 1e9;
  for (let n = 0; n < NN; n++) {
    if (!P.gok[n] || P.gap[n + 1] === P.gap[n]) continue;
    const d = (P.gx[n] - x) ** 2 + (P.gy[n] - y) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

// ---- lamps ------------------------------------------------------------------
const LAMP_SPEED = 3.6; // LEDs per lamp second, a lamp second being a second at Lamp = 1
const LAMP_TAU = 0.5;
const NL = 2;
const LF = [
  { fx: [0.0131, 0.0317, 0.0723], fy: [0.0097, 0.0259, 0.0613], ax: [0.55, 0.32, 0.13], ay: [0.55, 0.30, 0.15] },
  { fx: [0.0089, 0.0371, 0.0589], fy: [0.0149, 0.0233, 0.0797], ax: [0.5, 0.3, 0.2], ay: [0.5, 0.33, 0.17] },
];
function lampTarget(P, l) {
  const f = LF[l], t = P.lt, ph = P.lph[l];
  let x = 0, y = 0;
  for (let k = 0; k < 3; k++) {
    x += f.ax[k] * sin(TAU * f.fx[k] * t + ph[k]);
    y += f.ay[k] * sin(TAU * f.fy[k] * t + ph[3 + k]);
  }
  return [32 + 24 * x, 64 + 54 * y];
}

function chooseNext(P, c) {
  const a = c.a, d = c.dist;
  let best = 1e9;
  const { gap, gan, gac, gx, gy } = P;
  for (let k = gap[a]; k < gap[a + 1]; k++) { const v = gac[k] + d[gan[k]]; if (v < best) best = v; }
  if (best >= 1e8 || d[a] <= 0) {
    if (d[a] <= 0 || gap[a + 1] === gap[a]) return -1;
    // goal unreachable from here: wander
    const k = gap[a] + floor(Math.random() * (gap[a + 1] - gap[a]));
    return gan[k];
  }
  let pick = -1, ps = -1e9;
  for (let k = gap[a]; k < gap[a + 1]; k++) {
    const b = gan[k];
    if (gac[k] + d[b] > best + 0.5) continue;
    const ex = gx[b] - gx[a], ey = gy[b] - gy[a], el = sqrt(ex * ex + ey * ey);
    const sc = (ex * c.dx + ey * c.dy) / el + 0.3 * Math.random();
    if (sc > ps) { ps = sc; pick = b; }
  }
  return pick;
}

function lampStep(P, l, dtl) {
  const c = P.lamp[l];
  const [tx, ty] = lampTarget(P, l);
  const goal = nearestNode(P, tx, ty);
  if (goal !== c.goal) { c.goal = goal; roadDistances(P, c.dist, goal); }
  let move = LAMP_SPEED * dtl, guard = 0;
  while (move > 0 && guard++ < 8) {
    if (c.b < 0) {
      const b = chooseNext(P, c);
      if (b < 0) break;
      c.b = b; c.s = 0;
      const ex = P.gx[b] - P.gx[c.a], ey = P.gy[b] - P.gy[c.a], el = sqrt(ex * ex + ey * ey);
      c.len = el; c.dx = ex / el; c.dy = ey / el;
    }
    const rest = c.len - c.s;
    if (move >= rest) { move -= rest; c.a = c.b; c.b = -1; c.s = 0; }
    else { c.s += move; move = 0; }
  }
  const cx = c.b >= 0 ? P.gx[c.a] + c.dx * c.s : P.gx[c.a];
  const cy = c.b >= 0 ? P.gy[c.a] + c.dy * c.s : P.gy[c.a];
  const al = 1 - exp(-dtl / LAMP_TAU);
  c.x1 += (cx - c.x1) * al; c.y1 += (cy - c.y1) * al;
  c.x2 += (c.x1 - c.x2) * al; c.y2 += (c.y1 - c.y2) * al;
}

// ---- colour -----------------------------------------------------------------
function hueRgb(h, out) {
  h = (((h % 360) + 360) % 360) / 60;
  const i = floor(h), f = h - i, S = 0.95, p = 1 - S, q = 1 - S * f, t = 1 - S * (1 - f);
  let r, g, b;
  switch (i) {
    case 0: r = 1; g = t; b = p; break;
    case 1: r = q; g = 1; b = p; break;
    case 2: r = p; g = 1; b = t; break;
    case 3: r = p; g = q; b = 1; break;
    case 4: r = t; g = p; b = 1; break;
    default: r = 1; g = p; b = q;
  }
  out[0] = r; out[1] = g; out[2] = b;
}

const CORE = 0.7, CORE_S2 = 2 * 3.5 * 3.5;
const J_LAMP = 2.4, R1 = 10, AMB = 0.05, AMB_W = 0.22, AMB_F = 0.015, CHROMA = 2.4, FLOOR_G = 2.6, FLOOR_D = 0.55;
const HUE_RATE = 1.3; // degrees a second the whole palette turns, so no two minutes look alike
const NB = 256; // direction bins round a lamp point
const LAMP_COL = [[1.0, 0.93, 0.8], [0.84, 0.94, 1.0]];
const SUBR = 3.0;

function setEntityColours(P, kv) {
  const t = P.t;
  const alb = 0.62 + 0.33 * cl(kv[2], -1, 1);
  const sp = (cl(kv[3], -1, 1) + 1) / 2;
  const spread = 10 + 200 * pow(sp, 0.45);
  const centre = 140 + 360 * cl(kv[0], 0, 1) + HUE_RATE * t;
  const tmp = P.tmpc;
  for (let e = 0; e < NE; e++) {
    const D = HUE_D[e];
    const wob = 70 * sin(TAU * (t * P.hfa[e]) + P.hph[e * 2]) + 42 * sin(TAU * (t * P.hfb[e]) + P.hph[e * 2 + 1]);
    hueRgb(centre + D * spread + wob, tmp);
    P.rho[e * 3] = alb * (0.04 + 0.96 * tmp[0]);
    P.rho[e * 3 + 1] = alb * (0.04 + 0.96 * tmp[1]);
    P.rho[e * 3 + 2] = alb * (0.04 + 0.96 * tmp[2]);
  }
}

// ---- state ------------------------------------------------------------------
export function setup(P) {
  P.ready = false;
  P.t = 0; P.lt = 0;
  P.out = new Uint8Array(W * H * 3);
  P.tmpc = new Float64Array(3); P.tmp3 = new Float64Array(3);
  P.hfa = new Float64Array(NE); P.hfb = new Float64Array(NE); P.hph = new Float64Array(NE * 2);
  for (let e = 0; e < NE; e++) {
    P.hfa[e] = (1 / 110) * (0.6 + 0.8 * ((e * 0.7548776662 + 0.2) % 1));
    P.hfb[e] = (1 / 50) * (0.7 + 0.6 * ((e * 0.5698402909 + 0.45) % 1));
    P.hph[e * 2] = Math.random() * TAU; P.hph[e * 2 + 1] = Math.random() * TAU;
  }
  P.rho = new Float64Array(NE * 3);
  P.lph = [new Float64Array(6), new Float64Array(6)];
  for (let l = 0; l < NL; l++) for (let k = 0; k < 6; k++) P.lph[l][k] = Math.random() * TAU;
  P.lamp = [];
  P.sub = new Float64Array(NL * NSUBL * 2);
  P.bins = new Float32Array(NL * NSUBL * NB);
}

const NSUBL = 3; // points a lamp is sampled at, for soft shadows

function initWorld(P) {
  buildPatches(P);
  buildPatchMatrix(P);
  buildSamples(P);
  buildWallPixels(P);
  buildRoadmap(P);
  const np = P.np, ns = P.ns;
  P.Br = new Float32Array(np); P.Bg = new Float32Array(np); P.Bb = new Float32Array(np);
  P.Hr = new Float32Array(np); P.Hg = new Float32Array(np); P.Hb = new Float32Array(np);
  P.prho = new Float32Array(np * 3);
  P.dpr = new Float32Array(np); P.dpg = new Float32Array(np); P.dpb = new Float32Array(np);
  P.dsr = new Float32Array(ns); P.dsg = new Float32Array(ns); P.dsb = new Float32Array(ns);
  // lamps start at nodes far from each other
  for (let l = 0; l < NL; l++) {
    const [tx, ty] = lampTarget(P, l);
    const a = nearestNode(P, tx, ty);
    P.lamp.push({ dist: new Float32Array(NN), a, b: -1, s: 0, len: 1, dx: 0, dy: 1, goal: -1, x1: P.gx[a], y1: P.gy[a], x2: P.gx[a], y2: P.gy[a] });
  }
}

function lampPoints(P) {
  const S = P.sub;
  for (let l = 0; l < NL; l++) {
    const c = P.lamp[l];
    for (let k = 0; k < NSUBL; k++) {
      const a = PI / 2 + (TAU * k) / NSUBL;
      let x = c.x2 + SUBR * cos(a), y = c.y2 + SUBR * sin(a);
      if (inSolid(x, y, 0.3)) { x = c.x2; y = c.y2; }
      const o = (l * NSUBL + k) * 2;
      S[o] = x; S[o + 1] = y;
    }
  }
}

function castBins(P) {
  const S = P.sub, B = P.bins;
  for (let q = 0; q < NL * NSUBL; q++) {
    const qx = S[q * 2], qy = S[q * 2 + 1], base = q * NB;
    for (let i = 0; i < NB; i++) {
      const da = ((i + 0.5) / NB) * 4, qd = floor(da), f = da - qd;
      let ux, uy;
      switch (qd) {
        case 0: ux = 1 - f; uy = f; break;
        case 1: ux = -f; uy = 1 - f; break;
        case 2: ux = -(1 - f); uy = -f; break;
        default: ux = f; uy = -(1 - f);
      }
      B[base + i] = rayHit(qx, qy, ux, uy);
    }
  }
}

// Pseudo angle in 0..4 of a direction, and the L1 length, for the bin lookup.
function visFrac(B, base, dx, dy) {
  const ax = abs(dx), ay = abs(dy), L1 = ax + ay;
  if (L1 < 1e-6) return 1;
  let da;
  if (dy >= 0) da = dx >= 0 ? dy / L1 : 1 - dx / L1;
  else da = dx < 0 ? 2 - dy / L1 : 3 + dx / L1;
  const g = da * (NB / 4) - 0.5;
  const i0 = floor(g), w = g - i0;
  const a = B[base + ((i0 + NB) & (NB - 1))], b = B[base + ((i0 + 1 + NB) & (NB - 1))];
  const tt = a + (b - a) * w;
  const tol = 0.9 + 0.035 * L1;
  return tt > L1 + tol ? 1 : 0;
}

// ---- one frame ----------------------------------------------------------------
function frame(P, kv, dt, sweeps) {
  const np = P.np, ns = P.ns;
  const { pmx, pmy, pnx, pny, pent, prho, rho } = P;
  const { Br, Bg, Bb, Hr, Hg, Hb } = P;
  setEntityColours(P, kv);
  for (let i = 0; i < np; i++) {
    const e = pent[i] * 3;
    prho[i * 3] = rho[e]; prho[i * 3 + 1] = rho[e + 1]; prho[i * 3 + 2] = rho[e + 2];
  }
  lampPoints(P);
  castBins(P);
  const S = P.sub;
  // lamp strengths and colours, slowly breathing
  const lj = P.lj || (P.lj = new Float64Array(NL * 3));
  for (let l = 0; l < NL; l++) {
    const m = 0.82 + 0.18 * sin(TAU * (P.t * (0.021 + 0.013 * l)) + P.lph[l][0]);
    const warm = 0.5 + 0.5 * sin(TAU * (P.t * (0.0077 + 0.0031 * l)) + P.lph[l][1]);
    const c0 = LAMP_COL[l], c1 = LAMP_COL[1 - l];
    for (let k = 0; k < 3; k++) lj[l * 3 + k] = J_LAMP * m * (c0[k] * (1 - 0.35 * warm) + c1[k] * 0.35 * warm);
  }
  // direct light on the patches
  for (let i = 0; i < np; i++) {
    let r = AMB, g = AMB, b = AMB;
    const ox = pmx[i] + pnx[i] * 0.05, oy = pmy[i] + pny[i] * 0.05;
    for (let l = 0; l < NL; l++) {
      const c = P.lamp[l];
      const dx = c.x2 - ox, dy = c.y2 - oy, r2 = dx * dx + dy * dy, rr = sqrt(r2);
      const cs = (dx * pnx[i] + dy * pny[i]) / rr;
      if (cs <= 0) continue;
      let v = 0;
      for (let k = 0; k < NSUBL; k++) {
        const o = (l * NSUBL + k) * 2;
        if (!blocked(ox, oy, S[o], S[o + 1], 0.02)) v++;
      }
      if (!v) continue;
      const f = (cs * v) / (NSUBL * (1 + r2 / (R1 * R1)));
      r += lj[l * 3] * f; g += lj[l * 3 + 1] * f; b += lj[l * 3 + 2] * f;
    }
    Hr[i] = r; Hg[i] = g; Hb[i] = b;
  }
  // Gauss-Seidel sweeps from last frame's solution
  const { frp, fcj, ffv } = P;
  for (let sw = 0; sw < sweeps; sw++)
    for (let i = 0; i < np; i++) {
      let r = 0, g = 0, b = 0;
      for (let k = frp[i]; k < frp[i + 1]; k++) {
        const j = fcj[k], f = ffv[k];
        r += f * Br[j]; g += f * Bg[j]; b += f * Bb[j];
      }
      Br[i] = prho[i * 3] * (Hr[i] + r);
      Bg[i] = prho[i * 3 + 1] * (Hg[i] + g);
      Bb[i] = prho[i * 3 + 2] * (Hb[i] + b);
    }
  // light on the floor samples
  const { srp, scj, sfv, sx, sy, dsr, dsg, dsb } = P;
  for (let s = 0; s < ns; s++) {
    let r = 0, g = 0, b = 0;
    for (let k = srp[s]; k < srp[s + 1]; k++) {
      const j = scj[k], f = sfv[k];
      r += f * Br[j]; g += f * Bg[j]; b += f * Bb[j];
    }
    // the light the walls give back, with its colour pushed away from grey so a floor that sees many hues stays tinted
    r *= FLOOR_G; g *= FLOOR_G; b *= FLOOR_G;
    const ll = 0.3 * r + 0.59 * g + 0.11 * b;
    r = max(0, ll + (r - ll) * CHROMA); g = max(0, ll + (g - ll) * CHROMA); b = max(0, ll + (b - ll) * CHROMA);
    r += AMB_F; g += AMB_F; b += AMB_F;
    for (let l = 0; l < NL; l++) {
      const c = P.lamp[l];
      const dx = sx[s] - c.x2, dy = sy[s] - c.y2;
      let v = 0;
      for (let k = 0; k < NSUBL; k++) {
        const q = l * NSUBL + k, o = q * 2;
        v += visFrac(P.bins, q * NB, sx[s] - S[o], sy[s] - S[o + 1]);
      }
      if (!v) continue;
      const r2 = dx * dx + dy * dy;
      const f = (FLOOR_D * v) / (NSUBL * (1 + r2 / (R1 * R1))) + (CORE * v) / NSUBL * exp(-r2 / CORE_S2);
      r += lj[l * 3] * f; g += lj[l * 3 + 1] * f; b += lj[l * 3 + 2] * f;
    }
    dsr[s] = r; dsg[s] = g; dsb[s] = b;
  }
}

// Tone map 1 - exp(-k x) in linear light, then the display gamma.
const GAMMA = 1 / 2.2;
// The largest channel is compressed and the other two follow it, so a bright light never bleaches a colour to white.
function toneRgb(r, g, b, k, dst, o) {
  const m = r > g ? (r > b ? r : b) : g > b ? g : b;
  if (m < 1e-6) { dst[o] = 0; dst[o + 1] = 0; dst[o + 2] = 0; return; }
  const sc = (1 - exp(-k * m)) / m;
  dst[o] = 255 * pow(r * sc, GAMMA); dst[o + 1] = 255 * pow(g * sc, GAMMA); dst[o + 2] = 255 * pow(b * sc, GAMMA);
}

function render(P, kf, kw) {
  const { np, ns } = P;
  const { Br, Bg, Bb, dpr, dpg, dpb, dsr, dsg, dsb, prho } = P;
  const tmp = P.tmp3;
  for (let i = 0; i < np; i++) {
    toneRgb(Br[i] + prho[i * 3] * AMB_W, Bg[i] + prho[i * 3 + 1] * AMB_W, Bb[i] + prho[i * 3 + 2] * AMB_W, kw, tmp, 0);
    dpr[i] = tmp[0]; dpg[i] = tmp[1]; dpb[i] = tmp[2];
  }
  for (let s = 0; s < ns; s++) {
    toneRgb(dsr[s], dsg[s], dsb[s], kf, tmp, 0);
    dsr[s] = tmp[0]; dsg[s] = tmp[1]; dsb[s] = tmp[2];
  }
  const out = P.out, { fi, fw, kind } = P;
  for (let o = 0; o < W * H; o++) {
    if (kind[o]) continue;
    let r = 0, g = 0, b = 0;
    for (let k = 0; k < 4; k++) {
      const w = fw[o * 4 + k];
      if (w === 0) continue;
      const s = fi[o * 4 + k];
      r += w * dsr[s]; g += w * dsg[s]; b += w * dsb[s];
    }
    const a = P.ao[o];
    out[o * 3] = r * a; out[o * 3 + 1] = g * a; out[o * 3 + 2] = b * a;
  }
  const { nw, wpix, wa, wt } = P;
  for (let n = 0; n < nw; n++) {
    const o = wpix[n];
    const a0 = wa[n * 2], a1 = wa[n * 2 + 1];
    const t0 = wt[n], sh = P.wsh[n];
    out[o * 3] = (dpr[a0] + (dpr[a1] - dpr[a0]) * t0) * sh;
    out[o * 3 + 1] = (dpg[a0] + (dpg[a1] - dpg[a0]) * t0) * sh;
    out[o * 3 + 2] = (dpb[a0] + (dpb[a1] - dpb[a0]) * t0) * sh;
  }
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const speed = cl(kv[1], 0.4, 2.5);
  if (!P.ready) {
    P.ready = true;
    P.t = Math.random() * 400;
    initWorld(P);
    // the lamps have been wandering for a while
    for (let i = 0; i < 300; i++) {
      P.lt += 0.2;
      for (let l = 0; l < NL; l++) lampStep(P, l, 0.2);
    }
    for (let i = 0; i < 6; i++) frame(P, kv, 0, 8);
  }
  P.t += d;
  const dtl = d * speed;
  P.lt += dtl;
  for (let l = 0; l < NL; l++) lampStep(P, l, dtl);
  frame(P, kv, d, 3);
  render(P, 1.0, 3.4);
}

export function draw(display, P) {
  const out = P.out;
  if (!out) return;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, out[o], out[o + 1], out[o + 2]);
    }
}
