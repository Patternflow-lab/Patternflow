// ===== Patternflow pattern =====
// Title:   Kintsugi
// Family:  pottery
// Idea:    A tea bowl on a dark indigo cloth cracks, its shards drift a little apart and turn while lacquer and gold run along their broken edges, then close up again, and a swinging paper lantern sends a glint along the gold seams of every earlier mend.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 25, after kintsugi, the Japanese mending of broken ware with urushi lacquer and powdered gold
// Round:   25
// ===============================
// @matrix 64x128
// @knobs Glaze=0..1, Speed=0.2..3, Mends=2..8, Lamp=-1..1
//
// Knob 1: Glaze. Celadon jade at 0, then shino white with its fire blush, persimmon kaki and raku black at 1. The foot ring stays bare clay, and the broken edges show the same clay before the lacquer goes on.
// Knob 2: Speed. At 2 a break takes about six seconds from the crack to the closed seam, the bowl rests about six seconds between breaks and the lantern swings once in six and a half; at 0.2 it all runs ten times slower.
// Knob 3: Mends. How many earlier breaks the bowl carries, from two to eight: their gold seams, the gold-filled chips in the rim and here and there a piece of another bowl set in where a shard was lost. The more gold, the more warm light it throws on the cloth. Each new mend lays bright gold, and the oldest wears back into the glaze.
// Knob 4: Lamp. Where the lantern hangs, from left of the bowl at -1 to right of it at 1. The lit side of the bowl, the glint on the gold, the pool of light on the cloth and the bowl's shadow move with it.
// Buttons: K1 tap breaks the bowl now, while it stands whole.

const W = 64, H = 128, N = W * H;
const { min, max, floor, round, sin, cos, sqrt, exp, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
const F32 = (n) => new Float32Array(n);
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(xi + 1, yi + 1)) * su * sv;
}

// The bowl turned about x = CX, its foot on the cloth at FB, HT tall with a
// rim RT across, seen a little from above: a circle r across shows E * r tall.
// Its picture is kept in a band of rows from BY0, BH rows tall.
const CX = 32, FB = 104, HT = 40, E = 0.3, RT = 28, HORIZON = 84, BY0 = 52, BH = 58, NB = 64 * BH;
const R = (h) => (h < 4 ? 11.5 : 13.6 + 14.4 * sin((min(1, (h - 4) / (HT - 4)) * PI) / 2) ** 0.75);

// Each glaze and the colour it pools to, from celadon to raku black.
const GLAZE = [
  [[112, 184, 150], [62, 134, 128]],
  [[238, 230, 214], [238, 150, 96]],
  [[240, 120, 44], [150, 60, 26]],
  [[46, 42, 42], [92, 74, 62]],
];
const CLAY = [206, 158, 116], BODY = [232, 212, 178], URUSHI = [184, 44, 30], GOLD = [255, 206, 86], OLDG = [236, 160, 64], GLINT = [255, 246, 216], SHEEN = [255, 238, 210];
const WALL = [92, 74, 56], WOOD = [104, 66, 40], CLOTH = [46, 62, 132];
// Rest, crack, open, gild, close and shine, in seconds at Speed 2.
const DUR = [5, 0.45, 1.3, 2.4, 1.5, 1.2];

export function setup(params) {
  const P = (params.s = {
    ph: 0, pt: 0, tau: 0, wd: 2.4, count: 0, mends: 2, glaze: 0, gs: 0, PX: 33, LX: 33, LY: 29, fade: 1, flare: 0,
    mat: new Uint8Array(NB), nrm: F32(NB * 3), ao: F32(NB), mot: F32(NB), jit: F32(NB), sid: new Int32Array(NB), fid: new Int32Array(NB), off: new Uint8Array(16),
    col: F32(NB * 3), f: F32(N * 3), bg: F32(N * 3), dust: [],
  });
  geometry(P);
  // The breaks the bowl has already been through, oldest first.
  for (let k = 0; k < 8; k++) seams(P, crack(P, 4 + floor(rnd() * 3)), 1 + floor(rnd() * 3));
  brk(P);
  backdrop(P);
  swing(P);
}

// Where each LED of the bowl's picture sits on it: outer wall, inside, lip or
// foot, which way it faces, how much the bowl shades it, and the glaze's pooling.
function geometry(P) {
  const { mat, nrm, ao, mot, jit } = P;
  for (let b = 0; b < NB; b++) {
    const x = b & 63, y = (b >> 6) + BY0, px = x + 0.5 - CX, h0 = FB - y - 0.5;
    let h = h0, r = 0, u = 9, c = 0, n = null, m = 0, a = 1;
    for (let it = 0; it < 4; it++) {
      r = R(h);
      u = px / r;
      c = u * u < 1 ? sqrt(1 - u * u) : 0;
      h = h0 + E * r * c;
    }
    r = R(h);
    u = px / r;
    if (h >= 0 && h <= HT && u * u < 1) {
      c = sqrt(1 - u * u);
      const dR = (R(h + 0.6) - R(h - 0.6)) / 1.2, nl = 1 / sqrt(1 + dR * dR);
      m = h < 4 ? 4 : h > HT - 1.1 ? 3 : 1;
      n = m === 3 ? [u * 0.5, 0.8, 0.35] : [u * nl, -dR * nl, c * nl];
      a = m === 4 ? 0.8 : 1;
    } else {
      const ex = px / RT, ey = (y + 0.5 - (FB - HT)) / (E * RT), e2 = ex * ex + ey * ey;
      if (e2 >= 1) continue;
      // Inside: the far wall seen over the rim, darker the deeper it goes.
      let hb = HT;
      for (let it = 0; it < 4; it++) {
        r = R(hb);
        u = cl(px / r, -1, 1);
        c = sqrt(1 - u * u);
        hb = cl(h0 - E * r * c, 4, HT);
      }
      const dR = (R(hb + 0.6) - R(hb - 0.6)) / 1.2, nl = 1 / sqrt(1 + dR * dR);
      m = e2 > 0.84 && ey < 0.2 ? 3 : 2;
      n = m === 3 ? [ex * 0.5, 0.8, 0.35] : [-u * nl, dR * nl, c * nl];
      a = m === 3 ? 1 : (0.3 + 0.7 * ((hb - 4) / (HT - 4)) ** 0.6) * (1 - 0.35 * sm(0.2, 0.95, ey));
    }
    mat[b] = m;
    nrm.set(n, b * 3);
    ao[b] = a;
    mot[b] = sm(0.3, 0.85, 0.75 * vn(x / 4.5, y / 3.5) + 0.25 * hash(x, y + 999)) * (m === 2 ? 1 : 0.8);
    jit[b] = (hash(x + 77, y) - 0.5) * 0.6;
  }
}

// A break: the bowl's picture split into n shards with ragged edges, taller
// than wide, like cracks that run down from the rim.
function crack(P, n) {
  const S = [], reg = new Uint8Array(NB), ox = rnd() * 400, oy = rnd() * 400;
  while (S.length < n) {
    const b = floor(rnd() * NB);
    if (P.mat[b]) S.push([(b & 63) + 0.5, (b >> 6) + 0.5]);
  }
  for (let b = 0; b < NB; b++) {
    if (!P.mat[b]) continue;
    const x = (b & 63) + 0.5, y = (b >> 6) + 0.5;
    const wx = x + 5 * (vn(x / 7 + ox, y / 7 + oy) - 0.5) + 1.6 * (vn(x / 2 + oy, y / 2) - 0.5);
    const wy = y + 5 * (vn(x / 7 + oy, y / 7 + ox + 50) - 0.5) + 1.6 * (vn(x / 2, y / 2 + ox) - 0.5);
    let best = 1e9;
    for (let i = 0; i < n; i++) {
      const dx = wx - S[i][0], dy = (wy - S[i][1]) * 0.75, dd = dx * dx + dy * dy;
      if (dd < best) (best = dd), (reg[b] = i + 1);
    }
  }
  // Most breaks also knock a chip out of the rim, and the gold fills it.
  if (rnd() < 0.8) {
    let c;
    do c = floor(rnd() * NB);
    while (P.mat[c] !== 3);
    const r = 2.4 + rnd() * 1.8, cx = c & 63, cy = c >> 6;
    for (let b = 0; b < NB; b++) if (reg[b] && ((b & 63) - cx) ** 2 + ((b >> 6) - cy) ** 2 < r * r) reg[b] = 255;
  }
  // Some lose a shard for good, and a piece of another bowl is set in its
  // place (yobitsugi).
  if (rnd() < 0.55) {
    let c;
    do c = floor(rnd() * NB);
    while (P.mat[c] !== 1 && P.mat[c] !== 2);
    const r = 4.5 + rnd() * 2.5, cx = c & 63, cy = c >> 6;
    for (let b = 0; b < NB; b++) {
      const x = b & 63, y = b >> 6, dx = x - cx, dy = (y - cy) * 1.25;
      if (reg[b] && reg[b] < 255 && dx * dx + dy * dy < (r * (0.75 + 0.5 * vn(x / 3 + ox, y / 3))) ** 2) reg[b] = 254;
    }
  }
  return reg;
}
// One side of a crack (for the seam it leaves) or both (for the edges it opens).
function edge(reg, b, both) {
  const r = reg[b], x = b & 63;
  if (!r) return false;
  for (const nb of [x < 63 ? b + 1 : -1, x > 0 ? b - 1 : -1, b + 64 < NB ? b + 64 : -1, b - 64]) {
    if (nb < 0 || !reg[nb] || reg[nb] === r) continue;
    if (both || reg[nb] > r) return true;
  }
  return false;
}
// A closed break becomes the newest seam, with its gold chip and the piece
// from another bowl, glazed off glazes along.
function seams(P, reg, off) {
  const id = ++P.count;
  P.off[id & 15] = off;
  for (let b = 0; b < NB; b++) {
    if (reg[b] === 254) P.fid[b] = id;
    if (reg[b] === 255 || edge(reg, b, 0)) P.sid[b] = id;
  }
}

// The next break: its shards, which way each one drifts and turns, the
// crack's run from where it is struck, and the order the gold goes round.
function brk(P) {
  const n = 4 + floor(rnd() * 3), reg = crack(P, n), S = [];
  for (let i = 0; i < n; i++) S.push({ cx: 0, cy: 0, c: 0, rad: 0, e: [] });
  for (let b = 0; b < NB; b++)
    if (reg[b] && reg[b] < 254) {
      const s = S[reg[b] - 1];
      (s.cx += (b & 63) + 0.5), (s.cy += (b >> 6) + BY0 + 0.5), s.c++;
    }
  for (const s of S) {
    if (!s.c) continue;
    (s.cx /= s.c), (s.cy /= s.c);
    const dx = s.cx - CX, sg = dx < 0 ? -1 : 1;
    Object.assign(s, { tx: dx * 0.28 + sg * (1.5 + rnd() * 1.5), ty: (s.cy - 80) * 0.16 + 1 + rnd(), rot: (rnd() - 0.5) * 0.5, p: rnd() * TAU, o: rnd() });
  }
  const cb = new Uint8Array(NB), ce = new Uint8Array(NB), ga = F32(NB), cd = F32(NB);
  let ib;
  do ib = floor(rnd() * NB);
  while (P.mat[ib] !== 1);
  let md = 1;
  for (let b = 0; b < NB; b++) {
    if (!reg[b] || reg[b] > 253) continue;
    const s = S[reg[b] - 1], x = (b & 63) + 0.5, y = (b >> 6) + BY0 + 0.5;
    const dx = s.cx - x, dy = s.cy - y;
    s.rad = max(s.rad, sqrt(dx * dx + dy * dy) + 1.5);
    if (edge(reg, b, 1)) (ce[b] = 1), s.e.push(b), (ga[b] = (atan2(dy, dx) / TAU + 0.5 + s.o) % 1);
    if (edge(reg, b, 0)) (cb[b] = 1), (md = max(md, (cd[b] = sqrt((x - (ib & 63)) ** 2 + (y - (ib >> 6) - BY0) ** 2))));
  }
  for (let b = 0; b < NB; b++) cd[b] /= md;
  Object.assign(P, { reg, S, cb, ce, ga, cd, noff: 1 + floor(rnd() * 3), ix: (ib & 63) + 0.5, iy: (ib >> 6) + BY0 + 0.5 });
}

// The plaster wall with straw in it, the beam the lantern hangs from, and the
// folded indigo cloth, before the lantern lights them.
function backdrop(P) {
  const B = P.bg;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, q = hash(x, y);
      let col, f;
      if (y < 3) (col = WOOD), (f = (y === 2 ? 0.55 : 0.9) * (0.85 + 0.15 * vn(x / 6, y)));
      else if (y < HORIZON) (col = WALL), (f = (0.86 + 0.2 * vn(x / 4, y / 4) + 0.04 * q) * (q > 0.985 ? 1.3 : 1));
      else {
        // Folds that run across the cloth and ease towards the front.
        const v = 0.5 + 0.5 * sin(x * 0.11 - y * 0.17 + 2.2 * sin(y * 0.05 + x * 0.04)) * sin(x * 0.07 + y * 0.05 + 1);
        (col = CLOTH), (f = (0.6 + 0.5 * v ** 1.4) * (0.94 + 0.06 * ((x + y) & 1)) * (y === HORIZON ? 1.35 : 1));
      }
      for (let c = 0; c < 3; c++) B[o + c] = col[c] * f;
    }
}

function swing(P) {
  const w = (TAU / 6.5) * P.tau, a = 0.42 * sin(w) + 0.07 * sin(2.3 * w + 1);
  P.LX = P.PX + 26 * sin(a);
  P.LY = 3 + 26 * cos(a);
}

function go(P, ph) {
  if (ph === 5) seams(P, P.reg, P.noff), brk(P);
  if (ph === 0) P.wd = DUR[0];
  P.ph = ph;
  P.pt = 0;
}

// Where a shard is now: turned by th about its middle and moved by tx, ty.
function place(P, s) {
  const ph = P.ph, p = P.pt / DUR[ph], e = ph === 2 ? 1 - (1 - p) ** 3 : ph === 3 ? 1 : ph === 4 ? 1 - sm(0, 1, p) : 0;
  const th = (s.rot + 0.05 * sin(P.tau * 1.1 + s.p)) * e;
  return [cos(th), sin(th), s.cx + (s.tx + 0.8 * sin(P.tau * 1.7 + s.p)) * e, s.cy + (s.ty + 0.6 * cos(P.tau * 1.3 + s.p)) * e];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = (cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3)) / 2;
  P.glaze = cl(k[0], 0, 1);
  P.mends = round(cl(k[2], 2, 8));
  P.PX = 32 + 14 * cl(k[3], -1, 1);
  P.tau += d;
  if (input.btnPressed && input.btnPressed[0] && (P.ph === 0 || P.ph === 5)) go(P, 1);
  if ((P.pt += d) >= (P.ph ? DUR[P.ph] : P.wd)) go(P, (P.ph + 1) % 6);
  const p = P.pt / DUR[P.ph];
  P.fade = P.ph === 3 ? 1 - sm(0.2, 1, p) : P.ph === 4 ? 0 : 1;
  P.flare = P.ph === 5 ? 1 - p : 0;
  swing(P);

  // Gold powder dusted on the lacquer falls past the shards to the cloth.
  if (P.ph === 3 && p > 0.3 && rnd() < d * 16) {
    const s = P.S[floor(rnd() * P.S.length)];
    if (s.e.length) {
      const b = s.e[floor(rnd() * s.e.length)], [co, si, tx, ty] = place(P, s), qx = (b & 63) + 0.5 - s.cx, qy = (b >> 6) + BY0 + 0.5 - s.cy;
      P.dust.push([co * qx - si * qy + tx, si * qx + co * qy + ty, 0, FB + 5 + rnd() * 19, 1, rnd() * TAU]);
    }
  }
  P.dust = P.dust.filter((q) => {
    if (q[1] < q[3]) (q[2] += 40 * d), (q[1] = min(q[3], q[1] + q[2] * d));
    else q[4] -= d / 10;
    return q[4] > 0;
  });
  if (P.dust.length > 90) P.dust.shift();
}

// The bowl's colours for this moment: glaze lit by the lantern, the seams of
// the mends it carries, and the crack, the bare clay, the lacquer and the
// gold of the break under way.
function shade(P) {
  // The bowl's glaze and the three others, round the ring of four.
  const G = [0, 1, 2, 3].map((k) => {
    const g = P.glaze * 3 + k, i = floor(g) % 4, f = g - floor(g);
    return [0, 1].map((j) => GLAZE[i][j].map((v, n) => mix(v, GLAZE[(i + 1) % 4][j][n], f)));
  });
  const { mat, nrm, ao, mot, jit, sid, fid, col, LX, LY, ph, count, fade, flare } = P, lo = count - P.mends, p = P.pt / (ph ? DUR[ph] : P.wd);
  const lac = ph === 3 ? sm(0, 0.5, p) * 1.05 : ph === 4 ? 2 : 0, gil = ph === 3 ? sm(0.3, 1, p) * 1.05 : ph === 4 ? 2 : 0, open = ph >= 2 && ph <= 4;
  const vis = (id) => (id > lo ? (id === lo + 1 ? fade : 1) : 0);
  let gs = 0, r = 0, gg = 0, bb = 0, kg = 0, gl = 0;
  const gold = (a, age, fl) => {
    const t = min(1, age / 8);
    gs += a * fl * (kg + gl);
    r = mix(r, (mix(GOLD[0], OLDG[0], t) * kg + GLINT[0] * gl) * fl, a);
    gg = mix(gg, (mix(GOLD[1], OLDG[1], t) * kg + GLINT[1] * gl) * fl, a);
    bb = mix(bb, (mix(GOLD[2], OLDG[2], t) * kg + GLINT[2] * gl) * fl, a);
  };
  const flat = (c, k) => ((r = c[0] * k), (gg = c[1] * k), (bb = c[2] * k));
  for (let b = 0; b < NB; b++) {
    const m = mat[b];
    if (!m) continue;
    const x = (b & 63) + 0.5, y = (b >> 6) + BY0 + 0.5, o = b * 3, nx = nrm[o], ny = nrm[o + 1], nz = nrm[o + 2];
    let lx = LX - x, ly = y - LY, lz = 24;
    const dd = lx * lx + ly * ly + lz * lz, il = 1 / sqrt(dd), fall = 0.55 + 0.6 * exp(-dd / 5000);
    (lx *= il), (ly *= il), (lz *= il);
    const hz = lz + 1, hl = 1 / sqrt(lx * lx + ly * ly + hz * hz), dif = max(0, nx * lx + ny * ly + nz * lz) * fall;
    kg = 0.62 + 0.55 * dif;
    gl = min(1.1, 1.7 * fall * max(0, ((nx + jit[b]) * lx + ny * ly + nz * hz) * hl) ** 30);
    if (m === 4) flat(CLAY, (0.16 + 0.8 * dif) * ao[b]);
    else {
      // Glaze, or the piece of another bowl set into it.
      const t = mot[b], fi = fid[b], nw = ph === 4 && P.reg[b] === 254, gk = nw ? P.noff : fi > lo ? P.off[fi & 15] : 0, ga = !nw && fi === lo + 1 ? fade : 1;
      const k = (0.2 + 0.3 * max(0, -ny) + 0.95 * dif) * ao[b] * (m === 3 ? 1.15 : 1), sh = 0.6 * fall * max(0, (nx * lx + ny * ly + nz * hz) * hl) ** 24;
      const A = G[0], B = G[gk];
      r = mix(mix(A[0][0], A[1][0], t), mix(B[0][0], B[1][0], t), ga) * k + SHEEN[0] * sh;
      gg = mix(mix(A[0][1], A[1][1], t), mix(B[0][1], B[1][1], t), ga) * k + SHEEN[1] * sh;
      bb = mix(mix(A[0][2], A[1][2], t), mix(B[0][2], B[1][2], t), ga) * k + SHEEN[2] * sh;
    }
    const id = sid[b], a = vis(id);
    if (open && P.ce[b]) {
      // An opened edge: bare clay, then red lacquer, then gold.
      const q = P.ga[b];
      if (q < gil) gold(1, 0, 1.15);
      else if (q < lac) flat(URUSHI, 0.5 + 0.6 * dif);
      else flat(BODY, 0.45 + 0.7 * dif);
    } else if (a > 0) gold(a, count - id, id === count ? 1 + 0.6 * flare : 1);
    else if (flare > 0) {
      // Fresh gold glows a little past the line it fills.
      for (let j = 0; j < 4; j++) {
        const nb = b + (j === 0 ? 1 : j === 1 ? -1 : j === 2 ? 64 : -64);
        if (nb >= 0 && nb < NB && sid[nb] === count) {
          gold(0.6 * flare, 0, 1);
          break;
        }
      }
    }
    if (ph === 1 && P.cb[b] && P.cd[b] < p * 1.6) (r *= 0.12), (gg *= 0.12), (bb *= 0.12);
    (col[o] = r), (col[o + 1] = gg), (col[o + 2] = bb);
  }
  P.gs = gs;
}

// The wall and cloth lit by the lantern, the bowl's shadow thrown away from
// it, and the warm light its gold throws down on the cloth.
function back(P, F) {
  const { LX, LY, bg } = P, sx = CX - (LX - CX) * 0.45, gx = CX + (LX - CX) * 0.3, gk = min(1.6, P.gs / 700);
  // The glows fall off as a column term times a row term.
  const X = [], Y = [];
  for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - LX) ** 2;
    X.push([exp(-dx / 380), exp(-dx / 1400), exp(-dx / 1500), gk * exp(-((x + 0.5 - gx) ** 2) / 600)]);
  }
  for (let y = 0; y < H; y++) Y.push([1.2 * exp(-((y + 0.5 - LY) ** 2) / 380), 0.3 * exp(-((y - LY) ** 2) / 4000), 0.9 * exp(-((y - 118) ** 2) / 700), exp(-((y - 111) ** 2) / 160)]);
  for (let y = 0, o = 0; y < H; y++) {
    const [a, b, c, d] = Y[y], ey = (y + 0.5 - FB - 3) / 7;
    for (let x = 0; x < W; x++, o += 3) {
      const C = X[x];
      if (y < HORIZON) {
        const k = 0.3 + a * C[0] + b * C[1];
        (F[o] = bg[o] * k), (F[o + 1] = bg[o + 1] * k), (F[o + 2] = bg[o + 2] * k);
        continue;
      }
      const ex = (x + 0.5 - sx) / 31, g = d * C[3] * (bg[o + 2] / CLOTH[2]);
      let k = 0.42 + c * C[2];
      if (ey * ey < 1.4 && ex * ex < 1.4) k *= 1 - 0.72 * sm(1.15, 0.55, sqrt(ex * ex + ey * ey));
      k *= 1 + 0.7 * g;
      (F[o] = bg[o] * k + 96 * g), (F[o + 1] = bg[o + 1] * k + 74 * g), (F[o + 2] = bg[o + 2] * k + 16 * g);
    }
  }
}

const put = (F, x, y, c, k) => {
  if ((x = floor(x)) >= 0 && x < W && (y = floor(y)) >= 0 && y < H) for (let n = 0, o = (y * W + x) * 3; n < 3; n++) F[o + n] = c[n] * k;
};

// The paper lantern on its cord: ribs across the lit paper, black lacquer caps.
function lantern(P, F) {
  const { LX, LY, PX } = P;
  for (let t = 0; t < 1; t += 0.04) put(F, mix(PX, LX, t), mix(3, LY - 10, t), [70, 58, 46], 1);
  for (let yy = -10; yy <= 10; yy++) {
    const y = round(LY) + yy, cap = yy <= -9 || yy >= 9, w = cap ? 3.6 : 6.3 * sqrt(max(0, 1 - (yy / 9.6) ** 2)) + 0.4;
    for (let x = floor(LX - w); x <= LX + w; x++) {
      const dx = x + 0.5 - LX, cov = cl(w - Math.abs(dx) + 0.5, 0, 1);
      if (y < 0 || x < 0 || x >= W || !cov) continue;
      const o = (y * W + x) * 3, q = dx / w, gl = 1 - q * q, rib = (yy + 9) % 3 ? 1 : 0.7;
      for (let n = 0; n < 3; n++) {
        const c = cap ? [38, 30, 26][n] * (1.2 - 0.4 * q) : mix([236, 118, 44][n], [255, 226, 160][n], gl * (1 - (yy / 10) ** 2)) * rib;
        F[o + n] = mix(F[o + n], c, cov);
      }
    }
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.mat) return;
  const F = P.f, { col, mat, ph } = P;
  shade(P);
  back(P, F);
  lantern(P, F);
  if (ph >= 2 && ph <= 4) {
    // Each shard drawn where it has drifted, read back through its turn.
    for (let i = 0; i < P.S.length; i++) {
      const s = P.S[i];
      if (!s.c) continue;
      const [co, si, tx, ty] = place(P, s);
      for (let y = max(0, floor(ty - s.rad)); y <= min(H - 1, ty + s.rad); y++)
        for (let x = max(0, floor(tx - s.rad)); x <= min(W - 1, tx + s.rad); x++) {
          const dx = x + 0.5 - tx, dy = y + 0.5 - ty, bx = floor(co * dx + si * dy + s.cx), by = floor(-si * dx + co * dy + s.cy) - BY0;
          if (bx < 0 || bx > 63 || by < 0 || by >= BH) continue;
          const b = by * 64 + bx, o = (y * W + x) * 3;
          if (P.reg[b] === i + 1) (F[o] = col[b * 3]), (F[o + 1] = col[b * 3 + 1]), (F[o + 2] = col[b * 3 + 2]);
        }
    }
    // The lost chip comes back as gold, and the lost shard as a piece of
    // another bowl, as the shards close.
    const a = ph === 4 ? sm(0.4, 1, P.pt / DUR[4]) : 0;
    if (a) for (let b = 0, o = BY0 * W * 3; b < NB; b++, o += 3) if (P.reg[b] > 253) for (let n = 0; n < 3; n++) F[o + n] = mix(F[o + n], col[b * 3 + n], a);
  } else for (let b = 0; b < NB; b++) if (mat[b]) F.set(col.subarray(b * 3, b * 3 + 3), (BY0 * W + b) * 3);
  // The ring of the strike.
  if (ph === 1) {
    const p = P.pt / DUR[1];
    for (let y = -7; y <= 7; y++)
      for (let x = -7; x <= 7; x++) {
        const k = (1 - p) * exp(-(x * x + y * y) / (2 + 10 * p)), xx = floor(P.ix + x), yy = floor(P.iy + y);
        if (xx >= 0 && xx < W && yy >= 0 && yy < H) for (let n = 0, o = (yy * W + xx) * 3; n < 3; n++) F[o + n] += 255 * k;
      }
  }
  for (const q of P.dust) {
    const x = floor(q[0]), y = floor(q[1]), k = q[1] < q[3] ? 0.9 : q[4] * (0.25 + 0.75 * max(0, sin(q[5] + P.tau * 4)) ** 3);
    if (x >= 0 && x < W && y >= 0 && y < H) for (let n = 0, o = (y * W + x) * 3; n < 3; n++) F[o + n] = mix(F[o + n], GOLD[n], k);
  }
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
