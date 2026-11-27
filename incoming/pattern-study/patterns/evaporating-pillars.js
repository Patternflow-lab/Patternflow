// ===== Patternflow pattern =====
// Title:   Evaporating Pillars
// Family:  photoevap
// Idea:    Starlight from above strips a molecular cloud, and wherever a dense clump casts its shadow the gas behind it survives, so the cloud is carved into dark pillars that stand toward the stars, each with a glowing gold rim on the lit side and a round head that may be cut loose as an egg.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the ionization front and its speed, the photon flux over the gas it must ionize (Spitzer 1954; Kahn 1954); the columns in the Eagle Nebula seen by Hubble (Hester et al. 1996) and the shadowing of the gas behind a dense clump that leaves it standing as a pillar (Gritschneder et al. 2010, from memory). Original here: a grid of cells, not a hydrodynamic code, and every constant is tuned by eye on the panel; round 266
// Round:   266
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Erosion=0.8..4, Clumps=-1..1, Starlight=0..2
//
// Knob 1: Hue. Turns the whole palette round the wheel. At 0 it is the Hubble one: the rims run crimson through orange to gold and near white, the ionized gas above is teal-green, the sky is blue-black and the cloud a teal-black silhouette. At 0.33 it is green and cyan with a magenta sky, at 0.5 blue rims over a red-brown haze.
// Knob 2: Erosion. 0.5 to 4, opening at 2. How hard the starlight eats the cloud, which is also how fast the picture runs: the pillars grow, lose their heads and are replaced about four times as fast at 4 as at 0.5, and at 2 the cloud climbs the panel at about 1.5 LED a second. Even at 0.5 the pillars rise at a third of that.
// Knob 3: Clumps. -1 to 1, opening at 0. The size and the number of the dense clumps in the cloud, so what is left standing: at -1 a few fat pillars with round heads 12 to 16 LED across, at 0 six to eight pillars 6 to 10 LED across at the base, at 1 a forest of thin spires 3 or 4 LED across. New cloud comes in at the bottom with the new clump size, and while the knob is moving the whole scene runs faster, so the change is on the front in a few seconds.
// Knob 4: Starlight. 0 to 2, opening at 0.06. Where the stars stand and how wide they are: at 0 they are 22 degrees to the upper left and the pillars lean toward them with long dark shadows, at 1 they are overhead, spread wider, and the pillars stand straight and are lit on both flanks, at 2 they have crossed to the right. The stars on the top edge move with it.

// What the picture is. A cloud of cold gas fills the bottom of the panel, dark teal against a sky that the starlight has ionized to a teal-green haze, brightest where it meets the cloud. Out of the cloud
// rise pillars with round heads, and the gas that faces the stars glows: a crimson fringe, an orange to gold rim 2 to 3 LED wide, near white on the cap of a head that looks straight at a star. The side turned away
// from the stars is a plain silhouette. The pillars climb the panel slowly as the front eats the cloud under them, lose their heads when the head is gone, and now and then a head is cut off from its neck and
// rises alone as an egg with a short tail. New clumps come in from below for ever.
// The model. A grid of 64 x 128 cells holds the gas density n (a sum of Gaussian clumps, big, small and fine, laid down in a log-normal way in rows that come in at the bottom) and the share f of each cell that is
// still neutral. The light comes from three stars, in three directions a few degrees apart, and each ray is followed down through the grid, its transmission reduced by exp(-1) for a whole cell of neutral gas, so a cell sees the
// fraction T of the starlight that has not been stopped above it. The ionization front moves at a speed that goes as T over n to the 1.4: dense clumps are stripped slowly and the gas in the shadow of a clump
// not at all. When a cell is ionized it lets the light through. The cloud is a slab that moves toward the stars in the picture, at the speed that keeps the amount of gas on the panel constant, so the front stays
// in the middle of the panel and the picture can run for ever. Gas is not moved by pressure here, which in the real pillars matters, and the rocket effect and the heating are not modelled; the shapes come from shadows alone.
// The glow is the lit neutral gas (T times f, blurred) weighted by how squarely its surface faces the stars (from the gradient of f), a gold ramp for the rim and a teal haze that is the rim blurred and carried up
// along the light. The sub-cell scroll is drawn by blending rows, so the climb is smooth.

const W = 64, H = 128, NC = W * H;
const { floor, sqrt, exp, sin, cos, tan, abs, min, max, pow, PI, log, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;

const PEXP = 2; // the front's speed goes as density to the power -PEXP
const KAP = 0.63; // a whole cell of neutral gas passes 1 - KAP of the starlight
const TCUT = 0.2; // light weaker than this does not move the front
const RATE = 0.4; // cells per unit of model time, at density 1 and full light
const N0 = 0.3; // the density the clumps are laid on
const DS = 0.2;
const TS = 3; // model time per second at Erosion 2 // the longest model step
const RAD = PI / 180;
const SS = 4, RM = W * SS - 1; // the most rays to a cell, and the mask of the ray array
const SSD = [4, 4, 4, 2, 2]; // rays to a cell for each light; the wide ones do not need the fine grid
const DEEP = 12; // cells of gas over a cell that has been given a new density
const K2MIN = 0.8, K2MAX = 4;
const COV = 0.3, KY = 1.6, SC0 = 2.3; // how much of the cloud the clumps cover, how much taller than wide they are, their width at Clumps 0 // how much of the cloud the clumps cover
const C0 = 4900; // cells of neutral gas the panel should hold; the scroll keeps it there
const ND = 5, WS = [0.25, 0.38, 0.25, 0.06, 0.06], OFS = [-1, 0.15, 1, 0, 0]; // three stars and two wide ones that stand for the diffuse light

function hsv(h, s, v, out) {
  h = (((h % 1) + 1) % 1) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  out[0] = [v, q, p, p, t, v][i % 6];
  out[1] = [t, v, v, q, p, p][i % 6];
  out[2] = [p, p, t, v, v, q][i % 6];
}

export function setup(params) {
  const mk = () => new Float32Array(NC);
  params.s = {
    ready: false, t: 0, cool: 0, k3g: 0, ks: [0, 2, 0, 0.06], k3p: 0, warp: 0,
    F: mk(), Nd: mk(), IP: mk(), T: mk(), tr: new Float32Array(W * SS), rowN: new Float32Array(W), gtmp: new Float32Array(W), ctmp: new Float32Array(W),
    blobs: [], ev1: 0, ev2: 0, ev3: 0, Yg: 0, sc: 3.6, off: 0, vf: 1.5, C: C0, th: [0, 0, 0, 0, 0], sw: [[], [], [], [], []],
    Fb: mk(), Fb2: mk(), Fb3: mk(), Lm: mk(), Iv: mk(), Gl: mk(), Hz: mk(), tA: mk(), tB: mk(),
    lut: new Float32Array(65 * 3), rim: 0,
  };
}

// ---- the cloud's density, laid down a row at a time
function spawn(S, Y) {
  const sc = S.sc, rc = (W * COV) / (PI * pow(1.7 * sc, 2) * KY);
  while (S.ev1 <= Y) {
    const s = sc * exp(0.18 * gauss()), ky = KY * exp(0.15 * gauss());
    S.blobs.push({ c: 1, x: rnd() * W, y: S.ev1 + 3 * s * ky, s, ky, a: 1.5 + 8 * pow(rnd(), 2), r: 3.2 * s, ry: 3.2 * s * ky });
    S.ev1 += -log(1 - rnd()) / rc;
  }
  while (S.ev2 <= Y) {
    const s = 7 + 3 * rnd();
    S.blobs.push({ x: rnd() * W, y: S.ev2 + 3 * s, s, ky: 1, a: 0.1 * gauss(), r: 3.2 * s, ry: 3.2 * s });
    S.ev2 += -log(1 - rnd()) * 7;
  }
  while (S.ev3 <= Y) {
    S.blobs.push({ x: rnd() * W, y: S.ev3 + 5, s: 1.5, ky: 1, a: 0.3 * (rnd() < 0.5 ? -1 : 1), r: 5, ry: 5 });
    S.ev3 += -log(1 - rnd()) / 1.4;
  }
}

function genRow(S, Y, out) {
  spawn(S, Y);
  const bl = S.blobs, g = S.gtmp, c = S.ctmp;
  let j = 0;
  for (let i = 0; i < bl.length; i++) if (bl[i].y + bl[i].ry >= Y) bl[j++] = bl[i];
  bl.length = j;
  g.fill(0);
  c.fill(0);
  for (let i = 0; i < j; i++) {
    const b = bl[i], dy = (Y - b.y) / b.ky;
    if (abs(Y - b.y) >= b.ry) continue;
    const s2 = 1 / (2 * b.s * b.s), dy2 = dy * dy;
    for (let x = 0; x < W; x++) {
      let dx = abs(x - b.x);
      if (dx > 32) dx = 64 - dx;
      if (dx >= b.r) continue;
      (b.c ? c : g)[x] += b.a * exp(-(dx * dx + dy2) * s2);
    }
  }
  for (let x = 0; x < W; x++) out[x] = cl(N0 * (1 + c[x]) * exp(g[x]), 0.15, 7);
}

function putRow(S, y, Y) {
  genRow(S, Y, S.rowN);
  const o = y * W;
  for (let x = 0; x < W; x++) {
    S.Nd[o + x] = S.rowN[x];
    S.IP[o + x] = pow(S.rowN[x], -PEXP);
    S.F[o + x] = 1;
  }
}

// a new clump size is laid into the gas that is more than DEEP cells under the surface, which the front has not reached, so a turn of Clumps shows up in seconds
function regen(S) {
  const Y0 = S.Yg - H, nn = S.nn || (S.nn = new Float32Array(NC));
  S.blobs.length = 0;
  S.ev1 = S.ev2 = S.ev3 = Y0;
  for (let y = 0; y < H; y++) {
    genRow(S, Y0 + y, S.rowN);
    for (let x = 0; x < W; x++) nn[y * W + x] = S.rowN[x];
  }
  for (let x = 0; x < W; x++) {
    let c = 0;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if (S.F[i] > 0.5) c++;
      if (c > DEEP) {
        S.Nd[i] = nn[i];
        S.IP[i] = pow(nn[i], -PEXP);
      }
    }
  }
  S.k3g = S.ks[2];
}

function shiftUp(S) {
  S.F.copyWithin(0, W);
  S.Nd.copyWithin(0, W);
  S.IP.copyWithin(0, W);
  putRow(S, H - 1, S.Yg++);
}

// ---- the light: three stars, each ray followed through the grid at its own angle
function lights(S, k4, t) {
  const th0 = (1 - k4) * 10 + 4.5 * (0.6 * sin(0.0713 * t) + 0.4 * sin(0.0431 * t + 1.3));
  const dl = 15 - 4 * abs(1 - k4);
  for (let k = 0; k < ND; k++) {
    const th = (k < 3 ? th0 + OFS[k] * dl : th0 + (k === 3 ? -58 : 58)) * RAD;
    S.th[k] = th;
    const s = tan(th), sw = S.sw[k];
    for (let y = 0; y < H; y++) sw[y] = -s * y;
  }
}

function flux(S) {
  const T = S.T, F = S.F, tr = S.tr;
  T.fill(0);
  for (let k = 0; k < ND; k++) {
    const sw = S.sw[k], nr = SSD[k], w = WS[k] / nr, st = SS / nr;
    tr.fill(1);
    for (let y = 0; y < H; y++) {
      const o = y * W, q = round(sw[y] * nr);
      for (let x = 0; x < W; x++) {
        const i = x * nr + q;
        let t = 0;
        for (let j = 0; j < nr; j++) t += tr[((i + j) * st) & RM];
        T[o + x] += w * t;
      }
      for (let x = 0; x < W; x++) {
        const a = 1 - KAP * F[o + x];
        if (a >= 1) continue;
        const i = x * nr + q;
        for (let j = 0; j < nr; j++) tr[((i + j) * st) & RM] *= a;
      }
    }
  }
}

function erode(S, dtm) {
  const F = S.F, T = S.T, IP = S.IP, r = RATE * dtm * 1.25;
  let removed = 0, c = 0;
  for (let i = 0; i < NC; i++) {
    const f = F[i];
    if (f <= 0) continue;
    const e = T[i] - TCUT;
    if (e > 0) {
      // a bit of gas one cell wide, or one cell tall, is gone at once
      const x = i & 63, y = i >> 6;
      const l = F[i - x + ((x + 63) & 63)] + F[i - x + ((x + 1) & 63)], u = y > 0 ? F[i - W] : 0, dn = y < H - 1 ? F[i + W] : 1;
      let d = r * e * IP[i] * (l < 0.7 || u + dn < 0.7 ? 5 : 1);
      if (d > f) d = f;
      F[i] = f - d;
      removed += d;
      c += f - d;
    } else c += f;
  }
  S.C = c;
  return removed;
}

// one step of model time dtm: light, erosion, and the scroll that keeps the front where it is
function step(S, dtm) {
  flux(S);
  const rem = erode(S, dtm);
  S.vf += (rem / (W * dtm) - S.vf) * (1 - exp(-dtm / 3));
  const v = cl(S.vf + (0.12 * (C0 - S.C)) / W, 0.3, 7);
  S.off += v * dtm;
  while (S.off >= 1) {
    S.off -= 1;
    shiftUp(S);
  }
}

function init(S) {
  S.sc = SC0 * exp(-0.5 * S.ks[2]);
  for (let y = 0; y < H; y++) putRow(S, y, S.Yg++);
  for (let y = 0; y < 58; y++) S.F.fill(0, y * W, (y + 1) * W);
  lights(S, S.ks[3], 0);
  for (let k = 0; k < 260; k++) step(S, 0.3);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const k = [cl(kn[0], 0, 1), cl(kn[1], K2MIN, K2MAX), cl(kn[2], -1, 1), cl(kn[3], 0, 2)];
  if (!S.ready) {
    S.ready = true;
    S.ks = k.slice();
    S.k3p = S.k3g = k[2];
    init(S);
  }
  const e = 1 - exp(-d / 0.12);
  for (let i = 0; i < 4; i++) S.ks[i] += (k[i] - S.ks[i]) * e;
  // turning Clumps runs the scene faster for a few seconds, so the new clumps reach the front
  S.warp = cl(S.warp + abs(k[2] - S.k3p) * 3, 0, 1) * exp(-d / 2.2);
  S.cool -= d;
  if (abs(k[2] - S.k3g) > 0.08 && S.cool <= 0) {
    S.sc = SC0 * exp(-0.5 * k[2]);
    S.ks[2] = k[2];
    regen(S);
    S.cool = 1;
  }
  S.k3p = k[2];
  S.sc = SC0 * exp(-0.5 * k[2]);
  S.t += d;
  lights(S, S.ks[3], S.t);
  const dtm = d * S.ks[1] * (TS / 2) * (1 + 3 * S.warp), n = Math.ceil(dtm / DS);
  for (let i = 0; i < n; i++) step(S, dtm / n);
  prepare(S);
}

// ---- the picture
function blur3(src, dst, tmp) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) tmp[o + x] = 0.25 * src[o + ((x + 63) & 63)] + 0.5 * src[o + x] + 0.25 * src[o + ((x + 1) & 63)];
  }
  for (let y = 0; y < H; y++) {
    const o = y * W, a = max(0, y - 1) * W, b = min(H - 1, y + 1) * W;
    for (let x = 0; x < W; x++) dst[o + x] = 0.25 * tmp[a + x] + 0.5 * tmp[o + x] + 0.25 * tmp[b + x];
  }
}

function boxH(src, dst, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let s = 0;
    for (let i = -r; i <= r; i++) s += src[o + (i & 63)];
    for (let x = 0; x < W; x++) {
      dst[o + x] = s / n;
      s += src[o + ((x + r + 1) & 63)] - src[o + ((x - r) & 63)];
    }
  }
}

function boxV(src, dst, r) {
  const n = 2 * r + 1;
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += src[cl(i, 0, H - 1) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = s / n;
      s += src[min(H - 1, y + r + 1) * W + x] - src[max(0, y - r) * W + x];
    }
  }
}

function prepare(S) {
  const F = S.F, F3 = S.Fb3, T = S.T, Fb = S.Fb, Fb2 = S.Fb2, Lm = S.Lm, Iv = S.Iv, tA = S.tA, tB = S.tB, Gl = S.Gl;
  blur3(F, Fb, tA);
  blur3(Fb, Fb2, tA);
  blur3(Fb2, S.Fb3, tA);
  // how much starlight reaches the open gas beside each surface: T where the gas is open, blurred, over the weight of the open gas
  for (let i = 0; i < NC; i++) {
    const o = 1 - Fb[i];
    tB[i] = T[i] * o * o;
    Lm[i] = o * o;
  }
  blur3(tB, Gl, tA);
  blur3(Gl, tB, tA);
  blur3(Lm, Gl, tA);
  blur3(Gl, Lm, tA);
  // the direction to each star
  const lx = [], ly = [];
  for (let k = 0; k < 3; k++) {
    lx.push(-sin(S.th[k]));
    ly.push(-cos(S.th[k]));
  }
  for (let y = 0; y < H; y++) {
    const o = y * W, a = max(0, y - 1) * W, b = min(H - 1, y + 1) * W;
    for (let x = 0; x < W; x++) {
      const gx = F3[o + ((x + 1) & 63)] - F3[o + ((x + 63) & 63)], gy = F3[b + x] - F3[a + x];
      const m = sqrt(gx * gx + gy * gy) + 1e-4, nx = -gx / m, ny = -gy / m;
      let fc = 0;
      for (let k = 0; k < 3; k++) fc += WS[k] * max(0, nx * lx[k] + ny * ly[k]);
      const f = 0.5 * (Fb[o + x] + Fb2[o + x]), band = 4 * f * (1 - f), open = tB[o + x] / (Lm[o + x] + 0.02);
      tB[o + x] = cl(pow(1.9 * band * min(1, open) * (0.04 + 0.96 * fc / 0.88), 0.8), 0, 1);
    }
  }
  blur3(tB, Iv, tA);
  // the ionized glow: the rim blurred, then carried up along the light
  boxH(Iv, tA, 3);
  boxV(tA, tB, 3);
  const G = S.Gl;
  for (let i = 0; i < NC; i++) G[i] = tB[i];
  // the haze: the cloud's own mass, wide, carried up
  const Hz = S.Hz;
  boxH(Fb, tA, 7);
  for (let x = 0; x < W; x++) {
    let h = 0;
    for (let y = H - 1; y >= 0; y--) {
      h = max(tA[y * W + x], h * 0.955);
      Hz[y * W + x] = h;
    }
  }
}

const rc = [0, 0, 0], tc = [0, 0, 0];

function buildLut(S, h) {
  // crimson fringe, orange, gold, pale gold, near white
  const stops = [
    [0.0, 0.985, 1, 0.5], [0.18, 0.985, 1, 0.95], [0.38, 0.025, 1, 1], [0.58, 0.07, 1, 1], [0.76, 0.115, 0.97, 1],
    [0.9, 0.135, 0.62, 1], [1.0, 0.145, 0.2, 1],
  ];
  const L = S.lut, a = [0, 0, 0], b = [0, 0, 0];
  for (let i = 0; i <= 64; i++) {
    const u = i / 64;
    let j = 0;
    while (j < stops.length - 2 && u > stops[j + 1][0]) j++;
    const p = stops[j], q = stops[j + 1], f = cl((u - p[0]) / (q[0] - p[0]), 0, 1);
    hsv(p[1] + h, p[2], p[3], a);
    hsv(q[1] + h, q[2], q[3], b);
    for (let c = 0; c < 3; c++) L[i * 3 + c] = a[c] + (b[c] - a[c]) * f;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const h = S.ks[0], o = S.off, gn = pow(S.ks[1] / 2, 0.5);
  buildLut(S, h);
  const deep = [0, 0, 0], teal = [0, 0, 0], cloud = [0, 0, 0], star = [0, 0, 0];
  hsv(0.625 + h, 0.95, 0.12, deep);
  hsv(0.47 + h, 0.9, 1, teal);
  hsv(0.52 + h, 0.85, 0.16, cloud);
  hsv(0.56 + h, 0.25, 1, star);
  const F = S.Fb, G = S.Gl, Iv = S.Iv, Hz = S.Hz, Nd = S.Nd, L = S.lut;
  const buf = S.fr || (S.fr = new Float32Array(NC * 3));
  for (let y = 0; y < H; y++) {
    const y2 = min(H - 1, y + 1), o1 = y * W, o2 = y2 * W, w2 = o, w1 = 1 - o;
    for (let x = 0; x < W; x++) {
      const a = o1 + x, b = o2 + x;
      const A = cl((F[a] * w1 + F[b] * w2 - 0.3) * 2.2, 0, 1);
      const I = cl((Iv[a] * w1 + Iv[b] * w2) * gn, 0, 1);
      const g = (G[a] * w1 + G[b] * w2) * gn;
      const hz = Hz[a] * w1 + Hz[b] * w2;
      const n = Nd[a] * w1 + Nd[b] * w2;
      const ty = 0.1 + 0.9 * ss(-0.5, 1.4, log(n * 2.5));
      // sky: the haze hugging the cloud, and the glow of the rim
      const sk = (0.5 * pow(hz, 1.2) + 0.9 * g) * (0.5 + 0.5 * gn);
      let r = deep[0] + teal[0] * sk, gg = deep[1] + teal[1] * sk, bb = deep[2] + teal[2] * sk;
      // the cloud, dark with a texture
      const cv = 0.6 + 0.35 * ty + 1.1 * g * g;
      r += (cloud[0] * cv - r) * A;
      gg += (cloud[1] * cv - gg) * A;
      bb += (cloud[2] * cv - bb) * A;
      // the rim
      const al = ss(0.03, 0.4, I), li = floor(cl(I, 0, 1) * 64) * 3;
      r += (L[li] - r) * al;
      gg += (L[li + 1] - gg) * al;
      bb += (L[li + 2] - bb) * al;
      const p = a * 3;
      buf[p] = r;
      buf[p + 1] = gg;
      buf[p + 2] = bb;
    }
  }
  // the stars on the top edge
  for (let k = 0; k < 3; k++) {
    const sx = cl(32 - 40 * tan(S.th[k]), 4, 59), sy = [0.9, 3.4, -0.4][k], br = [1, 0.8, 0.9][k], rr = [2.6, 1.8, 2.2][k];
    for (let y = 0; y < 10; y++)
      for (let x = max(0, floor(sx) - 6); x <= min(W - 1, floor(sx) + 6); x++) {
        const dx = x + 0.5 - sx, dy = y + 0.5 - sy, d2 = dx * dx + dy * dy;
        const v = br * (exp(-d2 / rr) + 0.25 * exp(-d2 / 14));
        const p = (y * W + x) * 3;
        buf[p] += star[0] * v;
        buf[p + 1] += star[1] * v;
        buf[p + 2] += star[2] * v;
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, cl(buf[p] * 255, 0, 255) | 0, cl(buf[p + 1] * 255, 0, 255) | 0, cl(buf[p + 2] * 255, 0, 255) | 0);
    }
}
