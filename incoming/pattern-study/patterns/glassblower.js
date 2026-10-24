// ===== Patternflow pattern =====
// Title:   Glassblower
// Family:  glass
// Idea:    A gaffer on a platform swings a gather of molten glass on his blowpipe down into a dark swing pit, where it stretches into a long vase and cools from yellow to deep red until its own colour shows, goes back to the glory hole, is blown and swung again, and is cut off to shatter on the cullet heap.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 27, after the swing pit of a glass studio, where a gather is stretched long
// Round:   27
// ===============================
// @matrix 64x128
// @knobs Glass=0..1, Speed=0.2..3, Length=-1..1, Heat=0..1
//
// Knob 1: Glass. The batch colour that comes through as the glow fades, in the piece and in the broken glass of the heap: clear with a pale aqua tint at 0, then cobalt, amber, green, ruby at 1. Hot, they all glow the same.
// Knob 2: Speed. At 2 a swing takes 2.3 seconds and a piece goes from gather to cut in 21; at 0.2 everything runs ten times slower.
// Knob 3: Length. How much glass the gaffer gathers and how far he lets it stretch: a short vase to row 90 at -1, a cane swung in a wide arc down to the heap at 1.
// Knob 4: Heat. How hot the glory hole runs, orange-yellow at 0 and near white at 1; the gather comes out that hot and lights the shop brighter.
// Buttons: K1 tap takes the piece back to the glory hole to reheat. K2 tap blows into the pipe and the bubble inside swells.

const W = 64, H = 128, N = W * H, NN = 40;
const { min, max, floor, ceil, sin, cos, sqrt, exp, abs, atan2, cbrt, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
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
// Distance to a segment; TT is how far along it.
let TT = 0, QX = 0, QY = 0;
function seg(px, py, ex, ey) {
  TT = cl((px * ex + py * ey) / (ex * ex + ey * ey + 1e-6), 0, 1);
  (QX = px - TT * ex), (QY = py - TT * ey);
  return sqrt(QX * QX + QY * QY);
}

// Black body, 0..1: dark red, red, orange, yellow, near white.
const BBK = [0, 0, 0, 0, 0.12, 46, 3, 0, 0.25, 118, 10, 0, 0.38, 196, 34, 0, 0.5, 245, 80, 6, 0.62, 255, 132, 22, 0.75, 255, 180, 62, 0.87, 255, 222, 132, 1, 255, 246, 216];
const BB = new Float32Array(513 * 3);
for (let q = 0, k = 0; q <= 512; q++) {
  const T = q / 512;
  while (k < 28 && T > BBK[k + 4]) k += 4;
  for (let c = 0; c < 3; c++) BB[q * 3 + c] = mix(BBK[k + 1 + c], BBK[k + 5 + c], (T - BBK[k]) / (BBK[k + 4] - BBK[k]));
}
const bq = (T) => (((T < 0 ? 0 : T > 1 ? 1 : T) * 512 + 0.5) | 0) * 3;
// Clear, cobalt, amber, green, ruby: colour and body when cold, then what passes of the glow.
const GLASS = [
  [150, 212, 204, 0.3, 1, 0.97, 0.9], [34, 72, 238, 1, 0.3, 0.38, 1], [238, 138, 24, 1, 1, 0.62, 0.2],
  [40, 208, 88, 1, 0.42, 1, 0.5], [228, 18, 70, 1, 1, 0.18, 0.4],
];
// As the glow fades the glass filters it, and the colour comes through.
const flt = (T) => 0.95 * (1 - sm(0.45, 0.85, T));

// Deck, floor, the pit's opening, the glory hole (a drum seen end on at a slant), hands and pipe.
const DK = 26, FL = 31, PT = 35, OX0 = 19, OX1 = 47;
const MX = 49, MY = 15, MRX = 3.6, MRY = 7, FRX = 6.5, FRY = 11;
const PIPE = 27, BACK = 8, TH0 = 0.34, HX = 24.5, HY = 19.5, HX2 = 25.5, HY2 = 17.5;
const THF = atan2(MX - HX2, MY - HY2);
const GATHER = 0, OUT = 1, BLOW = 2, SWING = 3, LIFT = 4, REHEAT = 5, CUT = 6, EMPTY = 7;
const DUR = [1.3, 1, 0.8, 5, 0.9, 1.8, 1.4, 0.9];
const V0 = 1300, OM = (2 * PI) / 2.3, START = 13.6, FS = new Float32Array(NN), CP = new Float32Array(80);

export function setup(params) {
  const F = (n) => new Float32Array(n), piece = () => ({ X: F(NN), Y: F(NN), R: F(NN), B: F(NN), T: F(NN), on: 0, dy: 0, vy: 0 });
  const S = (params.s = {
    t: 0, th: THF, rho: 1, sw: 0, be: 0, bv: 0, vx: 0, tx: 0, ty: 0, l: 4, R0: 3, bl: 9, rot: 0, pT: 0, boom: 0, tmax: 0.8, live: 0, k1: -1, gl: [0, 0, 0, 1, 1, 1, 1], pc: piece(), fall: piece(), sp: [], lt: F(84),
    fa: F(N), se: F(N), ci: new Uint8Array(N), hc: F(256), cx: F(256), cn: F(256), top: F(W),
    f: F(N * 3), lr: F(N), lg: F(N), lb: F(N), mat: new Uint8Array(N), al: F(N * 3), gm: F(N),
    gd: F(N).fill(99), gs: F(N), gr: F(N), gu: F(N), gb: F(N), gt: F(N),
  });
  maps(S);
  go(S, GATHER);
}

function maps(S) {
  const M = S.mat, A = S.al, HG = S.top;
  for (let x = 0; x < W; x++) HG[x] = 122 - 10 * ((x + 0.5 - 33) / 31) ** 2 + 2 * (vn(x * 0.3, 5) - 0.5);
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, px = x + 0.5, py = y + 0.5, gr = 0.85 + 0.3 * hash(x, y);
    let m = 0, a = 0, c = [1, 0.9, 0.8];
    if (((px - MX) / MRX) ** 2 + ((py - MY) / MRY) ** 2 < 1) m = 3;
    else if (((px - MX) / FRX) ** 2 + ((py - MY) / FRY) ** 2 < 1) (m = 2), (a = 0.5 * (0.8 + 0.3 * hash(x, y + 7))), (c = [1, 0.84, 0.7]);
    else if (x > MX && y < FL && y > MY - FRY - 1) {
      // The drum with a rim on top and two bands, a dark stand below.
      m = 1;
      a = y < MY + FRY ? (y === MY - FRY ? 0.9 : 0.3 * (0.35 + 0.65 * cos(((py - MY) / FRY) * 1.45))) * (x === 56 || x === 61 ? 1.8 : 1) : y === MY + FRY ? 0.7 : 0.12;
      c = [0.9, 0.93, 1];
    } else if (y >= FL && y < PT && (x < OX0 || x > OX1)) (m = 4), (a = y === FL ? 0.8 : 0.3 * gr * (0.8 + 0.4 * hash(x >> 1, y))), (c = [1, 0.95, 0.88]);
    else if ((y >= DK && y < DK + 2 && x < 23) || ((x === 3 || x === 19) && y >= DK && y < FL)) (m = 5), (a = y === DK ? 0.9 : 0.35), (c = [0.9, 0.93, 1]);
    else if (py >= HG[x]) {
      // Broken glass: facets on a jittered grid, dark seams between them.
      m = 7;
      let d1 = 9, d2 = 9, id = 0, ci = 0;
      for (let j = 0; j < 9; j++) {
        const cx = floor(x / 3) + (j % 3) - 1, cy = floor(y / 2.5) + floor(j / 3) - 1, d = (px - (cx + hash(cx, cy)) * 3) ** 2 + (py - (cy + hash(cy, cx + 9)) * 2.5) ** 2;
        if (d < d1) (d2 = d1), (d1 = d), (id = hash(cx + 31, cy)), (ci = cl((cy - 42) * 24 + cx + 1, 0, 254));
        else if (d < d2) d2 = d;
      }
      (S.ci[i] = ci), (S.cx[ci] += px), S.cn[ci]++;
      (S.fa[i] = id), (S.se[i] = sm(0.9, 0.2, sqrt(d2) - sqrt(d1)) * 0.7 + (py - HG[x] < 1 ? -0.3 : 0));
    } else if (y >= FL) {
      // Firebrick courses, sooted in clouds.
      m = 6;
      const r = floor(y / 3), sx = x + (r & 1) * 3;
      a = y % 3 === 2 || sx % 7 === 6 ? 0.1 : 0.5 * (0.7 + 0.6 * hash(floor(sx / 7), r)) * (0.45 + 0.7 * vn(x * 0.11, y * 0.045)) * gr * (x < 2 || x > 61 ? 0.45 : 1);
      c = [1, 0.76, 0.58];
    } else {
      // Corrugated sheeting behind the shop.
      a = 0.5 * (0.88 + 0.12 * cos(px * PI * 0.5)) * (x % 16 === 15 ? 0.55 : 1) * (0.85 + 0.3 * vn(x * 0.07, y * 0.15));
      c = [0.95, 0.9, 0.85];
    }
    M[i] = m;
    for (let j = 0; j < 3; j++) A[i * 3 + j] = a * c[j];
  }
}
// Heat left in the heap where hot glass lands, shard by shard.
function heat(S, x, y, T, r) {
  for (let j = floor(y - r); j <= y + r; j++)
    for (let i = floor(x - r); i <= x + r; i++) {
      if (i < 0 || i >= W || j < 0 || j >= H || S.mat[j * W + i] !== 7) continue;
      const c = S.ci[j * W + i];
      S.hc[c] = max(S.hc[c], T * sm(r + 0.5, r * 0.3, sqrt((i + 0.5 - x) ** 2 + (j + 0.5 - y) ** 2)));
    }
}

function go(S, ph) {
  (S.ph = ph), (S.pt = 0), (S.th1 = S.th);
  if (ph === GATHER) (S.pc.on = 1), (S.V = 60), (S.b = S.bt = 0), (S.sb = S.sbt = 0.3), (S.pass = 1), S.pc.T.fill(S.tmax);
  else if (ph === BLOW) blow(S, S.pass > 1 ? 0.1 : 0.4);
  else if (ph === SWING) S.sw = 0;
}
function next(S) {
  const p = S.ph;
  go(S, p === SWING ? (S.pass > 1 ? CUT : LIFT) : p === REHEAT ? OUT : p === EMPTY ? GATHER : p + 1);
  if (p === REHEAT) S.pass++;
}
function blow(S, db) {
  (S.bt = min(0.74, S.b + db)), (S.sbt = min(0.84, S.pass > 1 ? S.sb + 0.12 : 0.55)), (S.bl = 0);
}
const live = (S) => S.pc.on && (S.ph === BLOW || S.ph === SWING || (S.ph === CUT && S.pt < 0.4));

// Radius from volume and length: a neck, a body narrowing down, a round end.
function shape(S) {
  const P = S.pc, l = max(4, S.l), dl = l / (NN - 1);
  let R = max(1, S.R0);
  for (let it = 0; it < 3; it++) {
    let sum = 0;
    for (let i = 0; i < NN; i++) {
      const s = i / (NN - 1), a = s * l, ct = 1 - min(1, (a + 0.25 * R) / (1.1 * R)), cb = 1 - min(1, (l - a) / (0.62 * R));
      FS[i] = (1 - 0.38 * s) * sqrt(1 - ct * ct) * sqrt(max(0, 1 - cb * cb));
      sum += FS[i] * FS[i];
    }
    R = max(1, sqrt(S.V / (PI * dl * max(1e-3, sum))));
  }
  S.R0 = R;
  for (let i = 0; i < NN; i++) {
    const q = (i / (NN - 1) - 0.05) / (S.sb - 0.05), B = q > 0 && q < 1 ? S.b * sqrt(1 - (2 * q - 1) ** 2) : 0;
    (P.B[i] = B), (P.R[i] = (R * FS[i]) / sqrt(1 - B * B));
  }
}
// Off the pipe along its axis, then hanging and trailing the swing; straight when lifted.
function line(S) {
  const P = S.pc, l = max(4, S.l), dl = l / (NN - 1), th = S.th, w0 = 0.8 * S.R0 + 1.5;
  let x = S.tx - sin(th) * 1.2, y = S.ty - cos(th) * 1.2;
  for (let i = 0; i < NN; i++) {
    (P.X[i] = x), (P.Y[i] = y);
    const s = i / (NN - 1), w = exp((-s * l) / w0), a = mix(th * w + (1 - w) * S.be * s ** 0.8, th, S.rho);
    (x += sin(a) * dl), (y += cos(a) * dl);
  }
}
// Radiative cooling, faster where the glass is thin.
const cool = (T, R, d) => T - ((0.22 * (T + 0.1)) / max(2.2, R) ** 0.7) * d;

function step(S, d) {
  (S.t += d), (S.pt += d);
  const dur = () => (S.ph === SWING ? (S.pass > 1 ? 6.5 : 5) : DUR[S.ph]);
  if (S.pt >= dur()) next(S);
  const ph = S.ph, pt = S.pt, D = dur(), u = sm(0, 1, pt / D), P = S.pc, F = S.fall, HG = S.top;
  let th = S.th, rho = S.rho, inH = 0;
  S.env = 0;
  if (ph === GATHER || ph === REHEAT) (th = THF + 0.015 * sin(S.t * 3)), (rho = inH = 1);
  else if (ph === OUT) (th = mix(S.th1, TH0, u)), (rho = 1 - sm(0.3, 0.9, pt / D)), (inH = 1 - sm(0, 0.25, pt / D));
  else if (ph === BLOW) (th = TH0 + 0.03 * sin(pt * 4)), (rho = 0);
  else if (ph === SWING) {
    S.env = sm(0, 1.4, pt) * (1 - sm(D - 1.1, D, pt));
    S.sw += d * OM * sqrt(62 / S.L) * (1 - 0.15 * (S.l / S.L));
    (th = TH0 + S.A * S.env * sin(S.sw)), (rho = 0);
  } else if (ph === LIFT || ph === EMPTY) (th = mix(S.th1, THF, u)), (rho = sm(0, 0.3, pt / D)), (inH = sm(0.75, 1, pt / D));
  else {
    (th = mix(S.th1, TH0, sm(0, 0.4, pt))), (rho = 0);
    if (P.on && pt >= 0.4) cut(S);
  }
  const q = cl((th - TH0) / (THF - TH0), 0, 1);
  (S.th = th), (S.rho = rho), (S.hx = mix(HX, HX2, q)), (S.hy = mix(HY, HY2, q));
  const tx = S.hx + PIPE * sin(th), ty = S.hy + PIPE * cos(th), vx = (tx - S.tx) / d, ax = cl((vx - S.vx) / d, -400, 400), Le = max(10, 0.55 * S.l);
  (S.tx = tx), (S.ty = ty), (S.vx = vx);
  // The hanging part is a pendulum on a moving pivot.
  if (rho > 0.5) S.be = S.bv = 0;
  else (S.bv += ((-190 / Le) * sin(S.be) - 1.3 * S.bv - (ax / Le) * cos(S.be)) * d), (S.be = cl(S.be + S.bv * d, -0.7, 0.7));
  (S.b += (S.bt - S.b) * min(1, d * 4)), (S.sb += (S.sbt - S.sb) * min(1, d * 4)), (S.bl += d), (S.rot += d * (3 + 5 * inH));
  if (P.on) {
    if (ph === GATHER) (S.V = max(60, V0 * (S.L / 62) * sm(0, 1.1, pt))), (S.l = 1.9 * cbrt((3 * S.V) / (4 * PI)));
    let tm = 0;
    for (let i = 0; i < NN; i++) tm += P.T[i] / NN;
    if (rho < 0.5) S.l += 0.42 * sm(0.15, 0.55, tm) * max(0, (S.pass > 1 ? S.L : 0.64 * S.L) - S.l) * (0.3 + 0.7 * S.env) * d;
    shape(S), line(S);
    // The glory hole brings it all back up.
    for (let i = 0; i < NN; i++) {
      const T = P.T[i] + (S.tmax - P.T[i]) * (1 - exp(-1.9 * d)) * inH;
      P.T[i] = mix(T, cool(T, P.R[i], d), 1 - inH);
    }
    (S.pT = mix(S.pT, P.T[0] * 0.7, min(1, d * 2))), (S.gx = P.X[NN >> 1]), (S.gy = P.Y[NN >> 1]);
  } else S.pT *= exp(-d * 0.5);
  if (F.on) {
    (F.vy += 300 * d), (F.dy += F.vy * d), (S.gx = F.X[NN >> 1]), (S.gy = F.Y[NN >> 1] + F.dy);
    for (let i = 0; i < NN; i++) F.T[i] = cool(F.T[i], F.R[i], d);
    // It hits the heap and goes to pieces.
    const bx = F.X[NN - 1], hy = HG[cl(bx | 0, 0, W - 1)];
    if (F.Y[NN - 1] + F.dy > hy - 1) {
      heat(S, bx, hy + 1, F.T[NN - 1] + 0.1, 3.5);
      for (let i = 0; i < NN * 2; i++) {
        const j = i >> 1;
        S.sp.push({ x: F.X[j] + (rnd() - 0.5) * F.R[j], y: F.Y[j] + F.dy, vx: (rnd() - 0.5) * 60, vy: F.vy * (0.5 + 0.4 * rnd()) - 30 * rnd(), l: 9, T: F.T[j] });
      }
      (F.on = 0), (S.boom = 1), (S.bx = bx);
    }
  }
  for (let c = 0; c < 255; c++) if (S.hc[c] > 0) S.hc[c] -= 0.03 * (S.hc[c] + 0.08) * d;
  S.boom = max(0, S.boom - d * 2.5);
  for (const p of S.sp) {
    (p.vy += 200 * d), (p.x += p.vx * d), (p.y += p.vy * d), (p.l -= d * 1.2);
    if (p.x < 0.5 || p.x > W - 0.5) (p.vx *= -0.5), (p.x = cl(p.x, 0.5, W - 0.5));
    // A shard bounces, then settles into the heap and leaves its heat there.
    if (p.l > 5 && p.y > HG[p.x | 0]) p.vy > 70 ? ((p.vy *= -0.35), (p.vx *= 0.6), (p.y = HG[p.x | 0])) : (heat(S, p.x, p.y + 1, p.T, 1.3 + rnd()), (p.l = 0));
  }
  S.sp = S.sp.filter((p) => p.l > 0 && p.y < H + 2);
}

// The jacks score the neck and the piece drops away into the pit.
function cut(S) {
  const P = S.pc, F = S.fall;
  for (const k of "XYRBT") F[k].set(P[k]);
  (F.on = 1), (F.dy = F.vy = P.on = 0), (S.pT = 0.75), (S.l = 4), (S.V = 60);
  for (let k = 0; k < 14; k++) S.sp.push({ x: S.tx, y: S.ty + 1, vx: (rnd() - 0.5) * 34, vy: -10 - 28 * rnd(), l: 0.6 + 0.4 * rnd(), T: 0.8 });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], k1 = cl(k[0], 0, 1), k3 = cl(k[2], -1, 1), k4 = cl(k[3], 0, 1);
  if (k1 !== S.k1) {
    const u = k1 * 4, i = min(3, floor(u)), f = sm(0.25, 0.75, u - i);
    for (let c = 0; c < 7; c++) S.gl[c] = mix(GLASS[i][c], GLASS[i + 1][c], f);
    S.k1 = k1;
  }
  (S.L = 62 + 18 * k3), (S.A = 0.29 + 0.15 * k3), (S.hot = 0.84 + 0.16 * k4), (S.tmax = 0.86 + 0.18 * k4), (S.fI = 1 + 0.55 * k4);
  if (!S.live) {
    while (!S.live) step(S, 1 / 30), (S.live = S.t >= START ? 1 : 0);
    // The last piece lies broken in the heap, still red.
    heat(S, 31 + 6 * rnd(), 125, 0.44, 5);
    for (let k = 0; k < 7; k++) heat(S, 2 + 60 * rnd(), 112 + 16 * rnd(), 0.18 + 0.14 * rnd(), 1.5 + 2 * rnd());
  }
  const bp = input.btnPressed || [];
  if (bp[0] && live(S)) go(S, LIFT);
  if (bp[1] && live(S)) blow(S, 0.14);
  step(S, cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3) * 0.5);
}

// Lights: the glory hole, seven points along the gather, the heap's embers, the crash.
function lights(S) {
  const LT = S.lt, M = S.mat, HC = S.hc, GL = S.gl;
  let n = 0;
  const add = (x, y, T, w, sg, g = 0) => {
    const o = n++ * 6, b = bq(T), f = g * flt(T);
    (LT[o] = x), (LT[o + 1] = y), (LT[o + 5] = 1 / (sg * sg));
    for (let c = 0; c < 3; c++) LT[o + 2 + c] = (BB[b + c] / 255) * w * (1 - f + f * GL[4 + c]);
  };
  add(MX - 2.5, MY + 0.5, S.hot, S.fI * (0.92 + 0.12 * vn(S.t * 4, 3)), 13);
  for (const P of [S.pc, S.fall]) {
    if (!P.on) continue;
    for (let i = 3; i < NN; i += 6) {
      const x = P.X[i], y = P.Y[i] + P.dy, m = x >= 0 && x < W && y >= 0 && y < H ? M[(y | 0) * W + (x | 0)] : 0;
      if (y < H + 12) add(x, y, P.T[i], 0.32 * min(2, P.R[i] / 3) * (m === 1 || m === 2 ? 0.15 : 1), 10 + 1.4 * P.R[i], 1);
    }
  }
  for (let h = 0; h < 2; h++) {
    let w = 0, T = 0, sx = 0;
    for (let c = 0; c < 255; c++) {
      const e = (HC[c] - 0.15) * S.cn[c], x = S.cx[c] / S.cn[c];
      if (e > 0 && x < 32 === !h) (w += e), (sx += e * x), (T = max(T, HC[c]));
    }
    if (w > 0) add(sx / w, 118, T, min(3, w * 0.12), 20, 0.7);
  }
  if (S.boom > 0) add(S.bx, 112, 0.75, S.boom * 1.6, 18);
  return n;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.k1 < 0) return;
  const F = S.f, M = S.mat, A = S.al, LR = S.lr, LG = S.lg, LB = S.lb, LT = S.lt, GM = S.gm, t = S.t, hot = S.hot, n = lights(S);
  const lx = LT[0], ly = LT[1], fw = LT[2] / (BB[bq(hot)] / 255), gc = bq(hot * 0.6);
  figure(S);
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, px = x + 0.5, py = y + 0.5, o = i * 3, m = M[i], ds = (px - lx) ** 2 + (py - ly) ** 2, qa = 1 / (1 + ds * LT[5]);
    // The glory hole's near pool and long reach; below the floor, only through the opening.
    let fq = qa * qa + 0.62 / (1 + ds / 500);
    if (y > FL + 1) {
      const xc = lx + ((px - lx) * (FL - ly)) / (py - ly);
      fq *= 0.06 + 0.94 * sm(OX0 - 3, OX0 + 3, xc) * sm(OX1 + 3, OX1 - 3, xc) * exp(-(py - FL) / 40);
    }
    let r = 0.004 + LT[2] * fq, g = 0.003 + LT[3] * fq, b = 0.003 + LT[4] * fq;
    for (let j = 6; j < n * 6; j += 6) {
      const dx = px - LT[j], dy = py - LT[j + 1];
      let q = 1 / (1 + (dx * dx + dy * dy) * LT[j + 5]);
      q *= q;
      (r += LT[j + 2] * q), (g += LT[j + 3] * q), (b += LT[j + 4] * q);
    }
    (LR[i] = r), (LG[i] = g), (LB[i] = b);
    const ex = (px - MX) / MRX, ey = (py - MY) / MRY, e2 = ex * ex + ey * ey;
    if (m === 3) {
      // The mouth, hottest in the middle, the fire churning.
      const c = bq(hot * (1 - 0.2 * e2) + 0.07 * (vn(x * 0.6, y * 0.5 - t * 5) - 0.5));
      for (let j = 0; j < 3; j++) F[o + j] = BB[c + j];
      continue;
    }
    // The refractory round the mouth glows from the heat.
    const gw = m === 2 ? exp(-(sqrt(e2) - 1) * 2.4) * 0.9 * fw : 0;
    (F[o] = A[o] * r * 255 + BB[gc] * gw), (F[o + 1] = A[o + 1] * g * 255 + BB[gc + 1] * gw), (F[o + 2] = A[o + 2] * b * 255 + BB[gc + 2] * gw);
    // The gaffer, a silhouette with a rim of light.
    const c = GM[i];
    if (c > 0) {
      const rim = max(1 - GM[i + 1], 0.6 * (1 - GM[i + W]), 0.4 * (1 - GM[i - W])) * 330;
      (F[o] = mix(F[o], 5 + r * rim, c)), (F[o + 1] = mix(F[o + 1], 4 + g * rim, c)), (F[o + 2] = mix(F[o + 2], 4 + b * rim, c));
    }
  }
  heap(S);
  if (S.pc.on) glass(S, S.pc);
  if (S.fall.on) glass(S, S.fall);
  flames(S);
  pipe(S);
  for (const p of S.sp) {
    const c = bq(p.l > 5 ? p.T + 0.1 : 0.55 + 0.4 * p.l), a = p.l > 5 ? 1 : min(1, p.l * 1.5);
    put(F, p.x, p.y, c, a), put(F, p.x - p.vx * 0.025, p.y - p.vy * 0.025, c, a * 0.5);
  }
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}

function put(F, x, y, c, a) {
  (x = floor(x)), (y = floor(y));
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  for (let j = 0, o = (y * W + x) * 3; j < 3; j++) F[o + j] = mix(F[o + j], BB[c + j], a);
}

// The cullet heap: hot shards glow, cool ones show their colour and glint.
function heap(S) {
  const { f: F, mat: M, lr: LR, lg: LG, lb: LB, gl: GL, hc: HC, ci: CI, fa: FA, se: SE } = S;
  for (let i = 108 * W; i < N; i++) {
    if (M[i] !== 7) continue;
    const o = i * 3, fa = FA[i], se = SE[i], T = HC[CI[i]] * (0.94 + 0.12 * fa), v = 1 - sm(0.1, 0.34, T), lum = (LR[i] + LG[i] + LB[i]) / 3;
    const gl = max(0, cos(fa * 12.6 - 2 * atan2(S.gy - (i >> 6), S.gx - (i & 63)))) ** 10 * lum * 2.4 * v * (1 - se);
    const b = (0.3 + 3 * lum) * (0.35 + 0.8 * fa) * (1 - se) * v * GL[3], c = bq(T), f = 0.7 * flt(T);
    for (let j = 0; j < 3; j++) F[o + j] = BB[c + j] * (0.95 - 0.4 * se) * (1 - f + f * GL[4 + j]) + GL[j] * b + gl * (100 + GL[j]);
  }
}

// The glass as capsules between nodes, the nearest one winning each LED.
function glass(S, P) {
  const { gd: GD, gs: GS, gr: GR, gu: GU, gb: GB, gt: GT, f: F, mat: M, lr: LR, lg: LG, lb: LB, gl: GL } = S, oy = P.dy;
  let X0 = W, X1 = -1, Y0 = H, Y1 = -1;
  for (let i = 0; i < NN - 1; i++) {
    const ax = P.X[i], ay = P.Y[i] + oy, bx = P.X[i + 1], by = P.Y[i + 1] + oy, ra = P.R[i], rb = P.R[i + 1], rr = max(ra, rb) + 1;
    const x0 = max(0, floor(min(ax, bx) - rr)), x1 = min(W - 1, ceil(max(ax, bx) + rr)), y0 = max(0, floor(min(ay, by) - rr)), y1 = min(H - 1, ceil(max(ay, by) + rr));
    (X0 = min(X0, x0)), (X1 = max(X1, x1)), (Y0 = min(Y0, y0)), (Y1 = max(Y1, y1));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const k = y * W + x, dd = seg(x + 0.5 - ax, y + 0.5 - ay, bx - ax, by - ay), r = ra + (rb - ra) * TT;
        if (dd - r < GD[k]) (GD[k] = dd - r), (GS[k] = (i + TT) / (NN - 1)), (GR[k] = r), (GU[k] = QX * (by - ay) - QY * (bx - ax) >= 0 ? dd : -dd), (GB[k] = mix(P.B[i], P.B[i + 1], TT)), (GT[k] = mix(P.T[i], P.T[i + 1], TT));
      }
  }
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      const k = y * W + x, sd = GD[k], m = M[k];
      if (sd >= 0.5) continue;
      GD[k] = 99;
      if (m === 1 || m === 2) continue;
      const a = cl(0.5 - sd, 0, 1), r = max(0.5, GR[k]), d = GU[k], u = cl(d / r, -1, 1), ad = abs(d), rb = GB[k] * r, o = k * 3;
      const ib = rb > 0.6 ? sm(0, 0.8, rb - ad) : 0, ch = 2 * r * sqrt(1 - u * u) * (1 - 0.5 * ib);
      // More glow through more glass, less through the bubble; the skin cools first.
      const e = 1 - exp(-0.3 * ch), T = GT[k] - 0.16 * u * u, st = sin(GS[k] * S.l * 0.55 - S.rot + u * 2.4);
      const c = bq(T * (0.62 + 0.38 * e) * (1 + 0.05 * st) + 0.06 * (1 - u * u) - 0.08 * ib), dim = 1 - 0.28 * ib, v = 1 - sm(0.14, 0.42, T), f = flt(T);
      // Cool glass shows its colour and a highlight.
      const lum = (LR[k] + LG[k] + LB[k]) / 3, bod = (0.25 + 1.2 * lum) * (0.55 + 0.45 * (1 - u * u)) * (0.85 + 0.15 * st) * (1 - 0.35 * ib) * GL[3];
      const sp = exp(-(((u - 0.45) / 0.2) ** 2)) * (0.25 + 1.3 * lum) * 160 * v;
      for (let j = 0; j < 3; j++) F[o + j] = mix(F[o + j], BB[c + j] * dim * (1 - f + f * GL[4 + j]) + v * (GL[j] * bod + sp), a);
    }
}

// Fire licks out over the top lip of the glory hole.
function flames(S) {
  const F = S.f, t = S.t, amt = 1.5 + 3 * (S.hot - 0.84), top = MY - MRY + 2;
  for (let y = max(0, top - 15); y < top; y++) {
    const h = (top - y) / 15;
    for (let x = MX - 7; x < MX + 6; x++) {
      const dx = (x + 0.5 - (MX - 0.8 + 2.5 * h + sin(t * 3 + y * 0.4) * h)) / (4.4 * (1 - 0.35 * h));
      const dens = sm(0.2, 0.55, vn(x * 0.3, y * 0.25 + t * 7) * (1.2 - h) * exp(-dx * dx) * amt), c = bq(0.48 + 0.36 * dens);
      for (let j = 0; j < 3; j++) F[(y * W + x) * 3 + j] += BB[c + j] * dens;
    }
  }
}

// The gaffer: capsules for head, cap, body and limbs, posed by the pipe.
function figure(S) {
  const GM = S.gm, q = cl((S.th - TH0) / (THF - TH0), 0, 1), lean = (1 - q) * (0.9 + 1.4 * (S.th - TH0)), bob = 0.8 * sin(PI * cl(S.bl / 0.8, 0, 1));
  const hpx = 14.5 + 0.5 * lean, hpy = 16.6, shx = 16 + lean, shy = 9.8 + 0.4 * lean, hx = S.hx, hy = S.hy;
  const hdx = mix(16.8 + 1.2 * lean, hx - BACK * sin(S.th) - 2, bob), hdy = mix(5.4 + 0.3 * lean, hy - BACK * cos(S.th) - 2.4, bob);
  const ebx = shx + 0.4 * (hx - shx) - 0.5, eby = shy + 0.62 * (hy - shy) + 1.8;
  let n = 0;
  const cap = (a, b, c, d, r) => ((CP[n] = a), (CP[n + 1] = b), (CP[n + 2] = c - a), (CP[n + 3] = d - b), (CP[n + 4] = r), (n += 5));
  // Body, apron, neck, capped head, arm, legs, feet.
  cap(hpx, hpy, shx, shy, 2.9), cap(hpx - 0.3, hpy + 1.5, hpx + 1.2, hpy + 3.2, 2.4), cap(shx, shy, hdx, hdy, 1.2), cap(hdx, hdy, hdx, hdy, 2.5), cap(hdx - 1.2, hdy - 1.7, hdx + 3.4, hdy - 1.3, 0.9);
  cap(shx, shy, ebx, eby, 1.4), cap(ebx, eby, hx, hy, 1.2);
  cap(hpx, hpy + 2, 12.2, 21.6, 1.7), cap(12.2, 21.6, 10.6, 25.4, 1.4), cap(hpx + 0.6, hpy + 2, 17.6, 21.2, 1.7), cap(17.6, 21.2, 18.4, 25.4, 1.4);
  cap(10.2, 25.6, 12.4, 25.6, 0.9), cap(18.2, 25.6, 20.4, 25.6, 0.9);
  for (let y = 0; y < DK + 1; y++)
    for (let x = 5; x < 32; x++) {
      let c = 0;
      for (let j = 0; j < n; j += 5) c = max(c, cl(CP[j + 4] + 0.5 - seg(x + 0.5 - CP[j], y + 0.5 - CP[j + 1], CP[j + 2], CP[j + 3]), 0, 1));
      GM[y * W + x] = c;
    }
}

// The blowpipe, steel, its far end hot from the glass.
function pipe(S) {
  const F = S.f, M = S.mat, st = sin(S.th), ct = cos(S.th), L = PIPE + BACK, ax = S.hx - BACK * st, ay = S.hy - BACK * ct, ex = L * st, ey = L * ct;
  for (let y = max(0, floor(min(ay, ay + ey) - 1)); y <= min(H - 1, max(ay, ay + ey) + 1); y++)
    for (let x = max(0, floor(min(ax, ax + ex) - 1)); x <= min(W - 1, max(ax, ax + ex) + 1); x++) {
      const k = y * W + x, c = cl(1.1 - seg(x + 0.5 - ax, y + 0.5 - ay, ex, ey), 0, 1), hb = bq(S.pT * sm(PIPE - 7, PIPE + 1, TT * L - BACK)), o = k * 3;
      if (c <= 0 || M[k] === 1) continue;
      (F[o] = mix(F[o], 26 + S.lr[k] * 190 + BB[hb], c)), (F[o + 1] = mix(F[o + 1], 26 + S.lg[k] * 190 + BB[hb + 1], c)), (F[o + 2] = mix(F[o + 2], 30 + S.lb[k] * 200 + BB[hb + 2], c));
    }
}
