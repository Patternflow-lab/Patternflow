// ===== Patternflow pattern =====
// Title:   Senbazuru
// Family:  paper
// Idea:    Strings of folded paper cranes hang from a red lacquered ring in a dim temple room, in bands of colour from the ring down to the silk tassels, and a soft draught sways the strands and turns the cranes so their folds catch the lamp one facet at a time.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 22, after the senbazuru strings of a thousand origami cranes hung in Japanese temples and at the Children's Peace Monument in Hiroshima
// Round:   22
// ===============================
// @matrix 64x128
// @knobs Paper=0..1, Breeze=0.2..3, Strands=8..16, Light=0..1
//
// Knob 1: Paper. Which colours the cranes are folded from: under a row of gold foil cranes at the ring, the bands run from orange through green and blue to violet and pink at the tassels at 0, and turning it moves every band along the rainbow.
// Knob 2: Breeze. How hard the draught blows: at 0.2 the strands hang almost still, at 2 they lean and sway and the cranes turn, at 3 they swing wide and spin.
// Knob 3: Strands. How many strands hang from the ring, from 8 to 16; with more strands the cranes are folded smaller and each strand carries more of them.
// Knob 4: Light. Where the light comes from: a paper lamp low on the left at night at 0, with the round window blue with moonlight, through dusk to daylight from the upper right at 1. The lit folds and the cranes' shadows on the wall swing with it.
// Buttons: K1 tap sends a gust through the room, which spins the cranes and shakes one loose to glide to the floor.

const W = 64;
const H = 128;
const N = W * H;
// The cranes, threads and ring are drawn at twice the resolution and averaged
// down, so a neck one LED wide still reads.
const SW = 128;
const SH = 256;
const SN = SW * SH;
// The ring: its centre column, its row, its radius and how far its front
// hangs below its back. Then the round window behind it and the first row
// of the floor.
const CX = 31.5;
const RY = 12;
const RR = 22;
const RE = 3.6;
const WY = 60;
const WR = 26;
const FLOOR = 121;
const MAXS = 16;
const { sin, cos, min, max, floor, round, sqrt, exp, hypot, PI } = Math;
const TAU = 2 * PI;
const rnd = () => Math.random();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6;
  const f = h - floor(h);
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// A folded crane, head forward along -x, up along y, wings out along z. Each
// face is one flat facet of the paper; the far side mirrors the near one.
const PT = {
  F: [-2.3, 0.3, 0], B: [2.3, 0.3, 0], D: [0, -1.9, 0], S: [0, 0, 1.3],
  W0: [-2.4, 0.5, 0.3], W1: [2.4, 0.5, 0.3], Wm: [0.3, -0.4, 1.3], Wt: [1.5, 2.4, 4.8],
  N0: [-1, -1.6, 0.6], N1: [-3.4, 0.9, 0], Nt: [-4.9, 5.4, 0], H0: [-4.1, 5.8, 0.4], Hp: [-6.6, 4.1, 0],
  T0: [1, -1.6, 0.6], T1: [3.4, 0.9, 0], Tt: [5.3, 5.8, 0],
};
const MESH = Float32Array.from(
  [1, -1].flatMap((s) =>
    "F S D,S B D,W0 Wm Wt,Wm W1 Wt,N0 N1 Nt,Nt H0 Hp,T0 T1 Tt"
      .split(",")
      .flatMap((f) => f.split(" ").flatMap((k) => [PT[k][0], PT[k][1], PT[k][2] * s])),
  ),
);
const TV = new Float32Array(9);
const CE = cos(0.38);
const SE = sin(0.38);
const GOLD = [1, 0.74, 0.3];

export function setup(params) {
  const P = params;
  Object.assign(P, {
    cb: new Float32Array(SN * 3),
    zb: new Float32Array(SN),
    bg: new Float32Array(N * 3),
    rec: new Float32Array(N),
    grain: Float32Array.from({ length: N }, () => rnd() - 0.5),
    key: "",
    started: false,
    ph: 0,
    psi: 0,
    vpsi: 0,
    gust: 0,
    gx: -30,
    next: 7,
    fall: [],
    paper: 0,
    B: 2,
    n: 8,
    light: 0.06,
  });
  P.S = Array.from({ length: MAXS }, () => ({
    ax: 0, vx: 0, az: 0, vz: 0, tw: 0, vt: 0,
    p: rnd() * TAU, q: rnd() * TAU, cut: floor(rnd() * 3.6), dir: rnd() < 0.5 ? 0 : PI, hj: (rnd() - 0.5) * 0.05, lost: 0,
  }));
}

// Crane size, spacing and count for the strand count.
function layout(n) {
  const k = 1.45 - 0.04 * n;
  const dy = 6.6 * k + 1;
  return { k, dy, nmax: floor((104 - RY - 7) / dy) + 1 };
}

function gust(P, g, loosen) {
  P.gust = max(P.gust, g);
  P.gx = -12;
  P.vpsi += 0.35 * g * (rnd() < 0.5 ? -1 : 1);
  for (let s = 0; s < MAXS; s++) P.S[s].vt += g * (2 + 3 * rnd()) * (rnd() < 0.5 ? -1 : 1);
  if (!loosen) return;
  // The bottom crane of the nearest strand that still has a few slips off.
  const { nmax, dy } = layout(P.n);
  let best = -1;
  let bz = -2;
  for (let s = 0; s < P.n; s++) {
    const st = P.S[s];
    const sa = sin(P.psi + ((s + 0.25) / P.n) * TAU);
    if (st.lost < 2 && nmax - st.cut - st.lost > 5 && sa > bz) {
      bz = sa;
      best = s;
    }
  }
  if (best < 0) return;
  const st = P.S[best];
  const i = nmax - st.cut - st.lost - 1;
  st.lost++;
  const phi = P.psi + ((best + 0.25) / P.n) * TAU;
  const u = (7 + i * dy) / 100;
  const z = RR * sin(phi);
  const x = CX + (RR * cos(phi) + st.ax * u) * (1 + z * 0.004);
  P.fall.push({ x, x0: x, y: RY + RE * sin(phi) + 7 + i * dy, z: z + 4, yaw: -phi, t: 0, i, s: best, down: false });
  if (P.fall.length > 5) P.fall.shift();
}

function step(P, h) {
  const B = P.B;
  P.ph += h * (0.35 + 0.65 * sqrt(B / 2));
  const T = P.ph;
  if ((P.next -= h) <= 0) {
    gust(P, 0.35 + 0.3 * rnd(), false);
    P.next = 6 + 7 * rnd();
  }
  P.gust *= exp(-h / 1.8);
  P.gx += h * 36;
  const n = P.n;
  for (let s = 0; s < n; s++) {
    const st = P.S[s];
    const phi = P.psi + ((s + 0.25) / n) * TAU;
    const x = CX + RR * cos(phi);
    // The draught: a lean to the right that breathes, a flutter that runs
    // across the bundle, and the gust front passing left to right.
    const front = 1 / (1 + exp((x - P.gx) / 6));
    const wind = 3 * B * (0.4 + 0.6 * sin(0.61 * T + st.p) + 0.35 * sin(1.37 * T - 0.06 * x + st.q)) + (3 + 2.5 * B) * P.gust * front;
    st.vx += h * (5.5 * (wind - st.ax) - 1.1 * st.vx);
    st.ax += h * st.vx;
    const wz = 2 * B * sin(0.43 * T + st.q) + 3 * B * P.gust * front * sin(st.p);
    st.vz += h * (5.5 * (wz - st.az) - 1.1 * st.vz);
    st.az += h * st.vz;
    const tq = 0.3 * B * sin(0.53 * T + 2 * st.p);
    st.vt += h * (3 * (tq - st.tw) - 0.45 * st.vt);
    st.tw += h * st.vt;
  }
  // The whole hanging twists on its one cord.
  const tr = 0.16 * B * sin(0.23 * T) + 0.06 * B * sin(0.67 * T + 1);
  P.vpsi += h * (1.4 * (tr - P.psi) - 0.35 * P.vpsi);
  P.psi += h * P.vpsi;
  // A loose crane glides down like a leaf, rocking and turning.
  for (const f of P.fall) {
    if (f.down) continue;
    f.t += h;
    const sw = sin(2.1 * f.t);
    f.y += h * (8 + 10 * sw * sw);
    f.x = f.x0 + 7 * sin(2.1 * f.t - 0.3) * min(1, f.t);
    f.yaw += h * 1.6;
    f.roll = 0.55 * cos(2.1 * f.t) * min(1, f.t * 2);
    if (f.y >= FLOOR + 2.6) {
      f.y = FLOOR + 2.6;
      f.roll = 0;
      f.down = true;
    }
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 8, 0.06];
  dt = clamp(dt || 0, 0, 0.1);
  P.paper = clamp(k[0], 0, 1);
  P.B = clamp(k[1], 0.2, 3);
  P.n = clamp(round(k[2]), 8, MAXS);
  P.light = clamp(k[3], 0, 1);
  if (!P.started) {
    P.started = true;
    for (let i = 0; i < 60; i++) step(P, 1 / 15);
  }
  if (input.btnPressed && input.btnPressed[0]) gust(P, 1, true);
  for (let i = 0; i < 2; i++) step(P, dt / 2);
}

// The room: dark wood boards, a round shoji window behind the cranes, the
// lamp, a polished floor. Kept until the light changes.
function room(P) {
  const k = P.light;
  const night = 1 - k;
  const pap = k < 0.5 ? mix3([0.1, 0.15, 0.38], [0.66, 0.38, 0.4], k * 2) : mix3([0.66, 0.38, 0.4], [0.94, 0.88, 0.74], k * 2 - 1);
  const { bg, rec, grain } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const o = p * 3;
      const g = grain[p];
      const dx = x - 31.5;
      const dy = y - WY;
      const lamp = night * exp(-((x - 7) * (x - 7)) / 700 - ((y - 106) * (y - 106)) / 2500);
      const lit = 0.3 + 1.4 * lamp + 0.9 * k * (0.4 + (0.6 * x) / 63) * (1.1 - (0.5 * y) / 127);
      const r = sqrt(dx * dx + dy * dy);
      // Each LED is wood taking w of the light, plus paper glowing pp, and
      // the cranes' shadows fall on it rc dark.
      let w = 0;
      let pp = 0;
      let rc = 0.7;
      if (y < 3) w = y === 2 ? 0.35 : 0.7;
      else if (y >= FLOOR) {
        // Boards, and the window seen dimly in the polish.
        const b = (y - FLOOR) % 3 === 0 ? 0.6 : 1;
        w = 0.75 * b;
        pp = exp(-(dx * dx) / 500) * 0.22 * b;
      } else if (x < 3 || x > 60) w = x === 2 || x === 61 ? 0.8 : 0.53;
      else if (r < WR) {
        // Paper between the kumiko bars, brightest where the moon or sun is.
        const spot = exp(-((dx - 10) * (dx - 10) + (dy + 12) * (dy + 12)) / 500);
        const bar = (x + 1) % 7 === 0 || (y - WY + 99) % 9 === 0;
        pp = (0.62 + 0.55 * spot + 0.04 * g) * (bar ? 0.28 : 1);
        rc = 0.2;
      } else if (r < WR + 2.2) w = r < WR + 1 ? 0.62 : 0.35;
      else {
        const tone = 0.8 + 0.25 * sin(floor((x + 3) / 7) * 12.9898) ** 2 + 0.12 * g;
        w = 0.55 * tone * ((x + 3) % 7 === 0 ? 0.55 : 1);
      }
      w *= lit;
      let cr = 0.42 * w + pap[0] * pp;
      let cg = 0.26 * w + pap[1] * pp;
      let cb = 0.15 * w + pap[2] * pp;
      // The andon: a paper lamp on short legs in the corner, lit at night.
      if (x >= 3 && x <= 12 && y >= 98 && y < FLOOR && (y < 117 || x === 4 || x === 11)) {
        rc = 0;
        if (y >= 117 || x === 3 || x === 12 || y === 98 || y === 107 || y === 116) {
          const f = 0.3 * (0.4 + lit);
          cr = 0.42 * f;
          cg = 0.26 * f;
          cb = 0.15 * f;
        } else {
          const glow = night * (0.55 + 0.3 * exp(-((x - 7.5) * (x - 7.5)) / 6 - ((y - 106) * (y - 106)) / 40));
          cr = 0.14 * lit + glow;
          cg = 0.13 * lit + 0.62 * glow;
          cb = 0.12 * lit + 0.26 * glow;
        }
      }
      rec[p] = rc;
      bg[o] = cr * 255;
      bg[o + 1] = cg * 255;
      bg[o + 2] = cb * 255;
    }
}

function lights(P) {
  const k = P.light;
  const lx = mix(-0.8, 0.65, k);
  const ly = mix(0.35, 0.6, k);
  const lz = mix(0.6, 0.45, k);
  const l = hypot(lx, ly, lz);
  P.L = [lx / l, ly / l, lz / l];
  const hl = hypot(P.L[0], P.L[1], P.L[2] + 1);
  P.Hv = [P.L[0] / hl, P.L[1] / hl, (P.L[2] + 1) / hl];
  P.lc = k < 0.5 ? mix3([1, 0.8, 0.56], [1, 0.68, 0.6], k * 2) : mix3([1, 0.68, 0.6], [0.9, 0.95, 1], k * 2 - 1);
  P.amb = mix3([0.14, 0.16, 0.3], [0.3, 0.29, 0.27], k);
}

function put(P, x, y, z, r, g, b) {
  x = floor(x);
  y = floor(y);
  if (x < 0 || x >= SW || y < 0 || y >= SH) return;
  const i = y * SW + x;
  if (z <= P.zb[i]) return;
  P.zb[i] = z;
  P.cb[i * 3] = r;
  P.cb[i * 3 + 1] = g;
  P.cb[i * 3 + 2] = b;
}

function line(P, x0, y0, z0, x1, y1, z1, c) {
  const n = max(1, Math.ceil(max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let j = 0; j <= n; j++) {
    const t = j / n;
    put(P, mix(x0, x1, t), mix(y0, y1, t), mix(z0, z1, t), c[0], c[1], c[2]);
  }
}

// A lit sphere: a bead or the knot over the ring.
function bead(P, x, y, z, rad, col, occl) {
  const { L, Hv, lc, amb } = P;
  for (let j = floor(y - rad); j <= y + rad; j++)
    for (let i = floor(x - rad); i <= x + rad; i++) {
      const nx = (i + 0.5 - x) / rad;
      const ny = -(j + 0.5 - y) / rad;
      const q = 1 - nx * nx - ny * ny;
      if (q < 0) continue;
      const nz = sqrt(q);
      const d = max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const sp = 0.9 * max(0, nx * Hv[0] + ny * Hv[1] + nz * Hv[2]) ** 10;
      const f = 255 * occl;
      put(P, i, j, z + nz * rad * 0.5, f * (col[0] * (amb[0] + 1.2 * d * lc[0]) + sp * lc[0]), f * (col[1] * (amb[1] + 1.2 * d * lc[1]) + sp * lc[1]), f * (col[2] * (amb[2] + 1.2 * d * lc[2]) + sp * lc[2]));
    }
}

function tri(P, x0, y0, z0, x1, y1, z1, x2, y2, z2, r, g, b) {
  const A = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (A > -0.02 && A < 0.02) return;
  const ia = 1 / A;
  const xa = max(0, floor(min(x0, x1, x2)));
  const xb = min(SW - 1, floor(max(x0, x1, x2)));
  const ya = max(0, floor(min(y0, y1, y2)));
  const yb = min(SH - 1, floor(max(y0, y1, y2)));
  const { zb, cb } = P;
  for (let y = ya; y <= yb; y++) {
    const py = y + 0.5;
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5;
      const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * ia;
      const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * ia;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * z0 + w1 * z1 + w2 * z2;
      const i = y * SW + x;
      if (z <= zb[i]) continue;
      zb[i] = z;
      cb[i * 3] = r;
      cb[i * 3 + 1] = g;
      cb[i * 3 + 2] = b;
    }
  }
}

// One crane at screen point (cx, cy) in LEDs, depth cz, size k, turned yaw
// about its thread and tilted roll in the picture plane. Each facet is lit
// on its own: the side facing the lamp is bright, a facet that turns to
// mirror the lamp into the room flashes.
function crane(P, cx, cy, cz, k, yaw, roll, col, occl, gold) {
  const cw = cos(yaw);
  const sw = sin(yaw);
  const cr = cos(roll);
  const sr = sin(roll);
  const { L, Hv, lc, amb } = P;
  const shine = gold ? 1.1 : 0.35;
  const pw = gold ? 6 : 14;
  for (let t = 0; t < MESH.length; t += 9) {
    for (let v = 0; v < 9; v += 3) {
      const x = MESH[t + v];
      const y = MESH[t + v + 1];
      const z = MESH[t + v + 2];
      const x1 = x * cw + z * sw;
      const z1 = z * cw - x * sw;
      const y1 = x1 * sr + y * cr;
      // Seen from a little above.
      TV[v] = x1 * cr - y * sr;
      TV[v + 1] = y1 * CE - z1 * SE;
      TV[v + 2] = y1 * SE + z1 * CE;
    }
    const ax = TV[3] - TV[0];
    const ay = TV[4] - TV[1];
    const az = TV[5] - TV[2];
    const bx = TV[6] - TV[0];
    const by = TV[7] - TV[1];
    const bz = TV[8] - TV[2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    let nl = sqrt(nx * nx + ny * ny + nz * nz);
    if (nl < 1e-6) continue;
    // Paper has two sides: light the one that faces us.
    if (nz < 0) nl = -nl;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    // Paper lets a little light round the fold, so no facet goes black.
    const d = max(0, nx * L[0] + ny * L[1] + nz * L[2] + 0.35) / 1.35;
    const sp = shine * max(0, nx * Hv[0] + ny * Hv[1] + nz * Hv[2]) ** pw;
    const r = 255 * occl * (col[0] * (amb[0] + 1.15 * d * lc[0]) + sp * lc[0]);
    const g = 255 * occl * (col[1] * (amb[1] + 1.15 * d * lc[1]) + sp * lc[1]);
    const b = 255 * occl * (col[2] * (amb[2] + 1.15 * d * lc[2]) + sp * lc[2]);
    tri(P, 2 * (cx + k * TV[0]), 2 * (cy - k * TV[1]), cz + k * TV[2], 2 * (cx + k * TV[3]), 2 * (cy - k * TV[4]), cz + k * TV[5], 2 * (cx + k * TV[6]), 2 * (cy - k * TV[7]), cz + k * TV[8], r, g, b);
  }
}

// The colour of crane i from the top: bands from orange through the
// rainbow, under a first crane of gold foil on every strand.
function paperOf(P, i, nmax, st) {
  if (i === 0) return GOLD;
  const c = hsv(P.paper + 0.12 + (0.76 * (i - 1)) / max(1, nmax - 2) + st.hj, 0.82, 1);
  return [c[0] * 0.92 + 0.08, c[1] * 0.92 + 0.08, c[2] * 0.92 + 0.08];
}

function hanging(P) {
  const { nmax, k, dy } = layout(P.n);
  const n = P.n;
  const { lc, amb } = P;
  const thread = [0.86, 0.8, 0.7];
  const silk = [0.95, 0.2, 0.14];
  for (let s = 0; s < n; s++) {
    const st = P.S[s];
    const phi = P.psi + ((s + 0.25) / n) * TAU;
    const ca = cos(phi);
    const sa = sin(phi);
    const ya = RY + RE * sa;
    // The inside of the bundle is in shade.
    const occl = 0.4 + 0.6 * (0.5 + 0.5 * sa);
    const cnt = nmax - st.cut - st.lost;
    const tc = thread.map((v, m) => 255 * occl * v * (amb[m] + 0.55 * lc[m]));
    let px = 2 * (CX + RR * ca * (1 + RR * sa * 0.004));
    let py = 2 * ya;
    let pz = RR * sa - 2;
    const pts = [];
    for (let i = 0; i <= cnt; i++) {
      const yy = 7 + i * dy - (i === cnt ? dy * 0.35 : 0);
      const u = yy / 100;
      const dx = st.ax * u + 0.7 * P.B * u * sin(2.1 * P.ph - 3.2 * u + st.p);
      const z = RR * sa + st.az * u;
      const pp = 1 + z * 0.004;
      const x = CX + (RR * ca + dx) * pp;
      const y = ya + yy;
      line(P, px, py, pz, 2 * x, 2 * y, z - 2 * k, tc);
      px = 2 * x;
      py = 2 * y;
      pz = z - 2 * k;
      pts.push([x, y, z, pp, u]);
    }
    for (let i = 0; i < cnt; i++) {
      const [x, y, z, pp, u] = pts[i];
      const slope = (pts[i + 1][0] - x) / dy;
      const yaw = -phi - PI / 2 + st.dir + st.tw * (0.3 + u) + (0.25 + 0.2 * P.B) * sin(1.3 * P.ph - 0.6 * i + st.q);
      crane(P, x, y, z, k * pp, yaw, -slope, paperOf(P, i, nmax, st), occl, i === 0);
    }
    // A gold bead and a silk tassel that trails the swing.
    const [x, y, z] = pts[cnt];
    bead(P, 2 * x, 2 * y, z, 2 * k + 0.2, GOLD, occl);
    const lag = -0.25 * st.vx;
    const sc = silk.map((v, m) => 255 * occl * v * (amb[m] + 0.9 * lc[m]));
    const len = round(15 * k);
    for (let j = 0; j < len; j++) {
      const hw = (1.1 + j * 0.13) * k;
      const xc = 2 * x + lag * j * 0.1;
      for (let xx = floor(xc - hw); xx <= xc + hw; xx++) {
        const f = (xx & 1 ? 0.7 : 1) * (j > len - 3 ? 0.75 : 1);
        put(P, xx, 2 * y + 2 + j, z, sc[0] * f, sc[1] * f, sc[2] * f);
      }
    }
  }
}

function ring(P) {
  const { L, Hv, lc, amb } = P;
  for (let a = 0; a < TAU; a += 0.01) {
    const ca = cos(a);
    const sa = sin(a);
    const z = RR * sa;
    const x = 2 * (CX + RR * ca * (1 + z * 0.004));
    const y = 2 * (RY + RE * sa);
    const occl = 0.45 + 0.55 * (0.5 + 0.5 * sa);
    // Lacquered wood, round in section: lit on top and toward the lamp.
    for (let q = -2; q <= 1; q++) {
      const ny = -(q + 0.5) * 0.7;
      const nl = sqrt(1 + ny * ny);
      const d = max(0, (ca * L[0] + ny * L[1] + sa * L[2]) / nl);
      const sp = 0.8 * max(0, (ca * Hv[0] + ny * Hv[1] + sa * Hv[2]) / nl) ** 12;
      const f = 255 * occl;
      put(P, x, y + q, z + 1, f * (0.85 * (amb[0] + 1.1 * d * lc[0]) + sp * lc[0]), f * (0.16 * (amb[1] + 1.1 * d * lc[1]) + sp * lc[1]), f * (0.09 * (amb[2] + 1.1 * d * lc[2]) + sp * lc[2]));
    }
  }
  // Four cords up to a knot under the beam.
  const cc = [0.9, 0.75, 0.4].map((v, m) => 255 * v * (amb[m] + 0.6 * lc[m]));
  for (let j = 0; j < 4; j++) {
    const a = P.psi + PI / 4 + (j * PI) / 2;
    const z = RR * sin(a);
    line(P, 2 * (CX + RR * cos(a) * (1 + z * 0.004)), 2 * (RY + RE * sin(a)), z, 2 * CX, 10, 0, cc);
  }
  line(P, 2 * CX, 0, 0, 2 * CX, 10, 0, cc);
  bead(P, 2 * CX, 10, 1, 3.2, [0.9, 0.16, 0.12], 1);
}

export function draw(display, params, time) {
  const P = params;
  if (!P.S) return;
  const key = `${P.light}`;
  if (key !== P.key) {
    P.key = key;
    room(P);
  }
  lights(P);
  P.zb.fill(-1e9);
  ring(P);
  hanging(P);
  const { nmax, k } = layout(P.n);
  for (const f of P.fall) crane(P, f.x, f.y, f.z, k, f.yaw, f.roll || 0, paperOf(P, f.i, nmax, P.S[f.s]), 1, false);
  const { zb, cb, bg, rec, L } = P;
  // The cranes' shadows on the wall, thrown away from the light.
  const ox = round(clamp((-L[0] / L[2]) * 16, -24, 24));
  const oy = round(clamp((L[1] / L[2]) * 16, -16, 16));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let c = 0;
      for (let q = 0; q < 4; q++) {
        const i = (2 * y + (q >> 1)) * SW + 2 * x + (q & 1);
        if (zb[i] > -1e8) {
          r += cb[i * 3];
          g += cb[i * 3 + 1];
          b += cb[i * 3 + 2];
          c++;
        }
      }
      const o = (y * W + x) * 3;
      // Thin paper edges count a little more than their share, so a neck
      // half an LED wide still shows.
      const a = min(1, c * 0.36);
      const f = 1 - a;
      const ic = c ? a / c : 0;
      const sx = 2 * x - ox;
      const sy = 2 * y - oy;
      const sh = f * (sx >= 0 && sx < SW && sy >= 0 && sy < SH && zb[sy * SW + sx] > -1e8 ? 1 - 0.6 * rec[o / 3] : 1);
      display.setPixel(x, y, min(255, r * ic + sh * bg[o]), min(255, g * ic + sh * bg[o + 1]), min(255, b * ic + sh * bg[o + 2]));
    }
}
