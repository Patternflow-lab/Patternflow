// ===== Patternflow pattern =====
// Title:   Hexatic Phase
// Family:  particle
// Idea:    440 hard disks jostle in a periodic box by event-chain Monte Carlo, each coloured by which way its local hexagonal lattice points, so crystallites read as patches of one colour that swim, merge and turn in a dim slate liquid, and the disks with 5 and 7 neighbours that make the dislocations are lit as white dots and white rings along the grain boundaries.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hexatic phase of two-dimensional melting (Bertrand Halperin and David Nelson, 1978), hard disks (Berni Alder and Thomas Wainwright, 1962), event-chain Monte Carlo (Etienne Bernard, Werner Krauth and David Wilson, 2009), pattern round 37
// Round:   37
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Density=0.68..0.76, Cells=0..1
//
// Knob 1: Hue. Turns the orientation wheel, where the whole colour wheel is 60 degrees of lattice rotation. At 0 a crystal whose rows run straight across is cyan, one turned 10 degrees clockwise blue, 20 magenta, 30 red, 40 peach and 50 lime; the knob moves every crystal's colour along together.
// Knob 2: Speed. Event chains a second: 3,000 at 2, each 1.5 diameters long, which move every disk about 115 times a second; 300 at 0.2, where a crystallite at 0.68 lives a few seconds instead of under one, and 4,500 at 3. The growth of the disks and the melt of a tap run with it.
// Knob 3: Density. The packing fraction, by the disk diameter: 4.0 LEDs at 0.68 to 4.25 at 0.76, the disks growing 2% a second at Speed 2 and pushing apart as they go. At 0.68 a dense liquid where crystallites of 10 to 40 disks form and melt within a second; from 0.700 to 0.716 liquid and hexatic share the box and the patches grow to half the panel; above 0.72 it is solid, one or two crystals whose boundaries are lines of 5-7 pairs.
// Knob 4: Cells. From disks on black at 0 to the Voronoi cells of the same disks at 1, a mosaic in the same colours with dark seams, where a 5-neighbour disk is a white pentagon and a 7-neighbour one a dark heptagon in a white ring.
// Buttons: K1 tap melts the box: for 1.2 s at Speed 2 the disks shrink to a packing of 0.60 and every crystal dissolves into slate, then they grow back at 2% a second, about 3 s to 0.68, and new crystallites nucleate, grow and merge.

const W = 64, H = 128, N = 440, CX = 14, CY = 28, C = W / CX, NC = CX * CY, CAP = 12;
const { floor, min, max, sqrt, atan2, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const wx = (v) => (v < -32 ? v + W : v >= 32 ? v - W : v);
const wy = (v) => (v < -64 ? v + H : v >= 64 ? v - H : v);
// Disk diameter for a packing fraction: eta = N pi d^2 / 4 / (W H).
const diam = (eta) => sqrt((4 * eta * W * H) / (N * PI));

// Hard disks have no energy, only the packing fraction. Halperin and Nelson
// (after Kosterlitz and Thouless) said a 2D crystal melts in two steps: bound
// pairs of dislocations unbind into a hexatic phase that keeps the lattice's
// orientation over long distances but not its rows, and then the hexatic
// melts into a liquid when the dislocations split into free 5s and 7s.
// Bernard and Krauth (2011) found that for hard disks the liquid to hexatic
// step is first order: the two coexist from 0.700 to 0.716, the hexatic
// holds to 0.720, and the solid starts there.
//
// Measured here, mean over seconds 10 to 40, of the edge-weighted psi6 of
// single disks, and the share of disks without six Voronoi neighbours:
//   0.68  |psi6| 0.60  off six 27%    0.70  |psi6| 0.69  off six 15%
//   0.72  |psi6| 0.75  off six  9%    0.74  |psi6| 0.84  off six  2%
// The whole box's |psi6| goes 0.16, 0.50, 0.63, 0.79: with 440 disks the
// patches reach the box long before the solid does.

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function cellAt(x, y) {
  let cx = floor(x / C), cy = floor(y / C);
  if (cx >= CX) cx -= CX;
  if (cy >= CY) cy -= CY;
  return cy * CX + cx;
}
function put(S, i) {
  const c = cellAt(S.x[i], S.y[i]), k = S.cnt[c]++;
  S.slot[c * CAP + k] = i;
  S.cell[i] = c;
  S.pos[i] = k;
}
function take(S, i) {
  const c = S.cell[i], k = S.pos[i], last = --S.cnt[c], j = S.slot[c * CAP + last];
  S.slot[c * CAP + k] = j;
  S.pos[j] = k;
}

// One straight event chain: disk i moves along direction dir until it
// touches another disk, which takes over the rest of the length, and so on
// until the length is spent. Each chain leaves the uniform distribution of
// valid configurations as it was, so a random mix of the four directions
// does too, and the mix keeps the whole box from drifting one way.
function chain(S, i, dir, len) {
  const d = S.d, d2 = d * d, ex = dir === 0 ? 1 : dir === 2 ? -1 : 0, ey = dir === 1 ? 1 : dir === 3 ? -1 : 0;
  const X = S.x, Y = S.y, cnt = S.cnt, slot = S.slot;
  let lifts = 0;
  while (len > 1e-9 && lifts < 200) {
    const xi = X[i], yi = Y[i], look = len < 2 * C ? len : 2 * C, kf = 1 + floor((look + d) / C);
    const c = S.cell[i], cx = c % CX, cy = (c / CX) | 0;
    let best = look, hit = -1;
    for (let a = 0; a <= kf; a++)
      for (let b = -1; b <= 1; b++) {
        let qx = ex ? cx + ex * a : cx + b, qy = ex ? cy + b : cy + ey * a;
        qx = qx < 0 ? qx + CX : qx >= CX ? qx - CX : qx;
        qy = qy < 0 ? qy + CY : qy >= CY ? qy - CY : qy;
        const q = qy * CX + qx, n = cnt[q];
        for (let m = 0; m < n; m++) {
          const j = slot[q * CAP + m];
          if (j === i) continue;
          const rx = wx(X[j] - xi), ry = wy(Y[j] - yi), along = rx * ex + ry * ey, perp = ex ? ry : rx;
          if (along <= 0 || perp * perp >= d2) continue;
          let s = along - sqrt(d2 - perp * perp);
          if (s < 0) s = 0;
          if (s < best) (best = s), (hit = j);
        }
      }
    take(S, i);
    let nx = xi + ex * best, ny = yi + ey * best;
    nx = nx < 0 ? nx + W : nx >= W ? nx - W : nx;
    ny = ny < 0 ? ny + H : ny >= H ? ny - H : ny;
    X[i] = nx;
    Y[i] = ny;
    put(S, i);
    len -= best;
    if (hit >= 0) (i = hit), lifts++;
  }
  return lifts;
}

// The closest pair in the box. Disks grow to it and no further, so the box
// is compressed without one overlap.
function closest(S) {
  const X = S.x, Y = S.y;
  let m2 = C * C;
  for (let i = 0; i < N; i++) {
    const c = S.cell[i], cx = c % CX, cy = (c / CX) | 0, xi = X[i], yi = Y[i];
    for (let b = -1; b <= 1; b++)
      for (let a = -1; a <= 1; a++) {
        let qx = cx + a, qy = cy + b;
        qx = qx < 0 ? qx + CX : qx >= CX ? qx - CX : qx;
        qy = qy < 0 ? qy + CY : qy >= CY ? qy - CY : qy;
        const q = qy * CX + qx, n = S.cnt[q];
        for (let m = 0; m < n; m++) {
          const j = S.slot[q * CAP + m];
          if (j <= i) continue;
          const rx = wx(X[j] - xi), ry = wy(Y[j] - yi), r2 = rx * rx + ry * ry;
          if (r2 < m2) m2 = r2;
        }
      }
  }
  return sqrt(m2);
}

// Growth by a step of `rate`, then pushes: every overlapping pair is moved
// apart along its axis, a few passes over the box. What overlap is left
// after that is taken back by shrinking the disks to the closest pair, so the
// chains never see two disks overlap.
function grow(S, rate) {
  if (S.dT <= S.d) {
    S.d = S.dT;
    return;
  }
  const d1 = min(S.dT, S.d * (1 + rate)), X = S.x, Y = S.y;
  for (let pass = 0; pass < 4; pass++) {
    let moved = 0;
    for (let i = 0; i < N; i++) {
      const c = S.cell[i], cx = c % CX, cy = (c / CX) | 0;
      for (let b = -1; b <= 1; b++)
        for (let a = -1; a <= 1; a++) {
          let qx = cx + a, qy = cy + b;
          qx = qx < 0 ? qx + CX : qx >= CX ? qx - CX : qx;
          qy = qy < 0 ? qy + CY : qy >= CY ? qy - CY : qy;
          const q = qy * CX + qx, n = S.cnt[q];
          for (let m = 0; m < n; m++) {
            const j = S.slot[q * CAP + m];
            if (j <= i) continue;
            const rx = wx(X[j] - X[i]), ry = wy(Y[j] - Y[i]), r2 = rx * rx + ry * ry;
            if (r2 >= d1 * d1 || r2 === 0) continue;
            const r = sqrt(r2), f = (0.5 * (d1 - r) + 1e-4) / r;
            X[i] -= rx * f;
            Y[i] -= ry * f;
            X[j] += rx * f;
            Y[j] += ry * f;
            moved++;
          }
        }
    }
    for (let i = 0; i < N; i++) {
      X[i] = (X[i] + W) % W;
      Y[i] = (Y[i] + H) % H;
      if (cellAt(X[i], Y[i]) !== S.cell[i]) take(S, i), put(S, i);
    }
    if (!moved) break;
  }
  S.d = min(d1, closest(S) * (1 - 1e-9));
}

// A batch of chains, each 1.5 diameters long in total.
function chains(S, n) {
  let lifts = 0;
  for (let k = 0; k < n; k++) lifts += chain(S, floor(random() * N), floor(random() * 4), 1.5 * S.d);
  return lifts;
}

// The Voronoi cell of disk i, by clipping a square with the bisector of each
// nearby disk, nearest first. Its edges give the neighbours and how much each
// one counts: psi6 = sum over edges of length * exp(6 i theta) / perimeter.
const PX = new Float64Array(40), PY = new Float64Array(40), PL = new Int32Array(40);
const QX = new Float64Array(40), QY = new Float64Array(40), QL = new Int32Array(40);
const CR = new Float64Array(64), CRX = new Float64Array(64), CRY = new Float64Array(64), CJ = new Int32Array(64);
const NBMAX = 12, CPS = 1500;
// Density range, growth per second at Speed 2, melt time.
const ETA0 = 0.68, ETA1 = 0.76, GROW = 0.02, MELT = 1.2, EASE = 0.3;
// The coarse-grained |psi6| that turns slate into full colour, and the slate.
const O0 = 0.35, O1 = 0.62, SL = [0.13, 0.14, 0.2];

function voronoi(S, i) {
  const X = S.x, Y = S.y, xi = X[i], yi = Y[i], c = S.cell[i], cx = c % CX, cy = (c / CX) | 0;
  let nc = 0;
  for (let b = -2; b <= 2; b++)
    for (let a = -2; a <= 2; a++) {
      let qx = cx + a, qy = cy + b;
      qx = qx < 0 ? qx + CX : qx >= CX ? qx - CX : qx;
      qy = qy < 0 ? qy + CY : qy >= CY ? qy - CY : qy;
      const q = qy * CX + qx, n = S.cnt[q];
      for (let m = 0; m < n && nc < 64; m++) {
        const j = S.slot[q * CAP + m];
        if (j === i) continue;
        const rx = wx(X[j] - xi), ry = wy(Y[j] - yi), r2 = rx * rx + ry * ry;
        // Insertion into the list sorted by distance.
        let k = nc++;
        while (k > 0 && CR[k - 1] > r2) {
          CR[k] = CR[k - 1];
          CRX[k] = CRX[k - 1];
          CRY[k] = CRY[k - 1];
          CJ[k] = CJ[k - 1];
          k--;
        }
        CR[k] = r2;
        CRX[k] = rx;
        CRY[k] = ry;
        CJ[k] = j;
      }
    }
  const HS = 2 * C;
  let px = PX, py = PY, pl = PL, qx = QX, qy = QY, ql = QL, nv = 4;
  px[0] = -HS, py[0] = -HS, px[1] = HS, py[1] = -HS, px[2] = HS, py[2] = HS, px[3] = -HS, py[3] = HS;
  pl[0] = pl[1] = pl[2] = pl[3] = -1;
  let far2 = 2 * HS * HS;
  for (let k = 0; k < nc; k++) {
    // A bisector farther out than every corner cannot cut the cell.
    if (CR[k] > 4 * far2) break;
    const ax = CRX[k], ay = CRY[k], h = CR[k] / 2;
    let no = 0;
    for (let v = 0; v < nv; v++) {
      const w = v + 1 < nv ? v + 1 : 0, sv = ax * px[v] + ay * py[v] - h, sw = ax * px[w] + ay * py[w] - h;
      if (sv <= 0) {
        qx[no] = px[v], qy[no] = py[v], ql[no++] = pl[v];
        if (sw > 0) {
          const t = sv / (sv - sw);
          qx[no] = px[v] + t * (px[w] - px[v]), qy[no] = py[v] + t * (py[w] - py[v]), ql[no++] = k;
        }
      } else if (sw <= 0) {
        const t = sv / (sv - sw);
        qx[no] = px[v] + t * (px[w] - px[v]), qy[no] = py[v] + t * (py[w] - py[v]), ql[no++] = pl[v];
      }
    }
    if (no === nv) {
      let same = true;
      for (let v = 0; v < nv && same; v++) if (ql[v] !== pl[v]) same = false;
      if (same) continue;
    }
    let t = px;
    (px = qx), (qx = t), (t = py), (py = qy), (qy = t);
    const tl = pl;
    (pl = ql), (ql = tl), (nv = no);
    far2 = 0;
    for (let v = 0; v < nv; v++) far2 = max(far2, px[v] * px[v] + py[v] * py[v]);
  }
  // Edges: label pl[v] runs from vertex v to vertex v + 1.
  let sr = 0, si = 0, sl = 0, nn = 0;
  for (let v = 0; v < nv; v++) {
    const k = pl[v];
    if (k < 0) continue;
    const w = v + 1 < nv ? v + 1 : 0, len = sqrt((px[w] - px[v]) ** 2 + (py[w] - py[v]) ** 2);
    const r = sqrt(CR[k]), ux = CRX[k] / r, uy = CRY[k] / r;
    // (ux + i uy)^6
    const a2r = ux * ux - uy * uy, a2i = 2 * ux * uy, a4r = a2r * a2r - a2i * a2i, a4i = 2 * a2r * a2i;
    sr += len * (a4r * a2r - a4i * a2i);
    si += len * (a4r * a2i + a4i * a2r);
    sl += len;
    if (len > 1e-6 && nn < NBMAX) S.nb[i * NBMAX + nn++] = CJ[k];
  }
  S.pr[i] = sl > 0 ? sr / sl : 0;
  S.pi[i] = sl > 0 ? si / sl : 0;
  S.nn[i] = nn;
}

export function setup(params) {
  const S = (params.s = {
    x: new Float64Array(N), y: new Float64Array(N), cell: new Int32Array(N), pos: new Int32Array(N),
    cnt: new Int32Array(NC), slot: new Int32Array(NC * CAP),
    pr: new Float32Array(N), pi: new Float32Array(N), nn: new Uint8Array(N), nb: new Int32Array(N * NBMAX),
    qr: new Float32Array(N), qi: new Float32Array(N), col: new Float32Array(N * 3), sx: new Float64Array(N), sy: new Float64Array(N),
    buf: new Float32Array(W * H * 3),
    d: 2.6, dT: diam(0.68), hue: 0, speed: 2, eta: 0.68, cells: 0.06, warm: false, melt: 0, acc: 0, lifts: 0,
  });
  // Random sequential placement at a small diameter, 0.24 packing.
  for (let i = 0; i < N; i++) {
    for (let tries = 0; tries < 2000; tries++) {
      const x = random() * W, y = random() * H;
      let ok = true;
      for (let j = 0; j < i && ok; j++) {
        const rx = wx(S.x[j] - x), ry = wy(S.y[j] - y);
        if (rx * rx + ry * ry < S.d * S.d) ok = false;
      }
      if (ok) {
        S.x[i] = x;
        S.y[i] = y;
        break;
      }
    }
    put(S, i);
  }
}

function analyse(S, ease) {
  for (let i = 0; i < N; i++) voronoi(S, i);
  // Coarse grain over the disk and its Voronoi neighbours, then ease in time.
  for (let i = 0; i < N; i++) {
    let r = S.pr[i], m = S.pi[i];
    const n = S.nn[i];
    for (let k = 0; k < n; k++) {
      const j = S.nb[i * NBMAX + k];
      r += S.pr[j];
      m += S.pi[j];
    }
    r /= n + 1;
    m /= n + 1;
    S.qr[i] += (r - S.qr[i]) * ease;
    S.qi[i] += (m - S.qi[i]) * ease;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.68, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.eta = cl(k[2], ETA0, ETA1);
  S.cells = cl(k[3], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) S.melt = MELT;
  S.melt = max(0, S.melt - d * S.speed / 2);
  S.dT = diam(S.melt > 0 ? 0.6 : S.eta);
  if (!S.warm) {
    for (let r = 0; r < 600 && S.d < S.dT; r++) {
      chains(S, 40);
      grow(S, 0.004);
    }
    for (let r = 0; r < 60; r++) chains(S, 40);
    analyse(S, 1);
    S.sx.set(S.x);
    S.sy.set(S.y);
    S.warm = true;
  }
  // Chains this frame, in three batches with a growth step after each.
  S.acc += S.speed * CPS * d;
  const n = floor(S.acc);
  S.acc -= n;
  let lifts = 0;
  for (let b = 0; b < 3; b++) {
    lifts += chains(S, floor(n / 3) + (b < n % 3 ? 1 : 0));
    grow(S, (GROW * d * S.speed) / 2 / 3);
  }
  S.lifts = lifts;
  analyse(S, 0.35);
  // The disks are drawn where they have been over the last few frames, not
  // where the last chain left them: each one rattles in its cage by about
  // 0.4 LED from frame to frame, which flickers on the panel.
  for (let i = 0; i < N; i++) {
    S.sx[i] += wx(S.x[i] - S.sx[i]) * EASE;
    S.sy[i] += wy(S.y[i] - S.sy[i]) * EASE;
    S.sx[i] = (S.sx[i] + W) % W;
    S.sy[i] = (S.sy[i] + H) % H;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { buf, col, sx: X, sy: Y } = S;
  buf.fill(0);
  // Disk colours: hue from the phase of psi6, and from its size a blend
  // from a dim slate (liquid) to the full colour (crystal).
  for (let i = 0; i < N; i++) {
    const r = S.qr[i], m = S.qi[i], mag = sqrt(r * r + m * m), o = sm(O0, O1, mag), n = S.nn[i], c = i * 3;
    if (n !== 6) {
      const w = 0.5 + 0.5 * o;
      col[c] = col[c + 1] = col[c + 2] = n < 6 ? w : -w;
      continue;
    }
    const h = S.hue + 0.47 + atan2(m, r) / (2 * PI), hh = h - floor(h);
    // Orange and yellow at less than full brightness read brown and olive,
    // so there the colour goes paler instead.
    const warm = sm(0.0, 0.05, hh) * (1 - sm(0.17, 0.24, hh));
    hsv(h, 0.88 - 0.38 * warm, 1, col, c);
    col[c] = SL[0] + (col[c] - SL[0]) * o;
    col[c + 1] = SL[1] + (col[c + 1] - SL[1]) * o;
    col[c + 2] = SL[2] + (col[c + 2] - SL[2]) * o;
  }
  const R = S.d / 2 - 0.25, R7 = R - 0.95;
  for (let i = 0; i < N; i++) {
    const xi = X[i], yi = Y[i], c = i * 3;
    let cr = col[c], cg = col[c + 1], cb = col[c + 2];
    // A 7-neighbour disk is a ring with a dark core.
    const ring = cr < 0;
    if (ring) cr = cg = cb = -cr;
    for (let yy = floor(yi - R - 1); yy <= yi + R + 1; yy++)
      for (let xx = floor(xi - R - 1); xx <= xi + R + 1; xx++) {
        const ex = xx + 0.5 - xi, ey = yy + 0.5 - yi, e = sqrt(ex * ex + ey * ey);
        let cov = cl(R + 0.5 - e, 0, 1);
        if (ring) cov *= cl(e - R7, 0, 1);
        if (cov <= 0) continue;
        const px = (xx + W) % W, py = (yy + H) % H, p = (py * W + px) * 3;
        buf[p] = max(buf[p], cr * cov);
        buf[p + 1] = max(buf[p + 1], cg * cov);
        buf[p + 2] = max(buf[p + 2], cb * cov);
      }
  }
  if (S.cells > 0.02) cells(S, buf, col);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, round(255 * buf[p]), round(255 * buf[p + 1]), round(255 * buf[p + 2]));
}

// The Voronoi field: each LED takes the colour of its nearest disk, darkened
// where the second nearest is almost as near, which draws the cell edges.
function cells(S, buf, col) {
  const X = S.x, Y = S.y, lv = S.cells;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) {
      const fx = x + 0.5, fy = y + 0.5, cx = floor(fx / C), cy = floor(fy / C);
      let b1 = 1e9, b2 = 1e9, j1 = 0;
      for (let b = -1; b <= 1; b++)
        for (let a = -1; a <= 1; a++) {
          let qx = cx + a, qy = cy + b;
          qx = qx < 0 ? qx + CX : qx >= CX ? qx - CX : qx;
          qy = qy < 0 ? qy + CY : qy >= CY ? qy - CY : qy;
          const q = qy * CX + qx, n = S.cnt[q];
          for (let m = 0; m < n; m++) {
            const j = S.slot[q * CAP + m], rx = wx(X[j] - fx), ry = wy(Y[j] - fy), r2 = rx * rx + ry * ry;
            if (r2 < b1) (b2 = b1), (b1 = r2), (j1 = j);
            else if (r2 < b2) b2 = r2;
          }
        }
      // Distance to the bisector of the two nearest is (r2^2 - r1^2) / 2 r12;
      // with r12 about one spacing this is close enough for a seam.
      const edge = sm(0.1, 0.7, (b2 - b1) / (2 * S.d)), c = j1 * 3;
      let cr = col[c], cg = col[c + 1], cb = col[c + 2];
      if (cr < 0) cr = cg = cb = 0.05;
      const g = lv * edge;
      buf[p] = max(buf[p], cr * g);
      buf[p + 1] = max(buf[p + 1], cg * g);
      buf[p + 2] = max(buf[p + 2], cb * g);
    }
}

function sm(a, b, v) {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
