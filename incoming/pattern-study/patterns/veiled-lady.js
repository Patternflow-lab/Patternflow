// ===== Patternflow pattern =====
// Title:   Veiled Lady
// Family:  fungi
// Idea:    A torch-lit time-lapse of a bridal veil stinkhorn on a tropical forest floor before dawn: an egg in the leaf litter splits, a white stalk shoots up under an olive spore cap, a lace veil drops from the cap almost to the leaves, flies come, and it slumps as the next egg swells.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 20, after time-lapse films of Phallus indusiatus, the bridal veil stinkhorn
// Round:   20
// ===============================
// @matrix 64x128
// @knobs Torch=0..1, Speed=0.2..3, Veil=0..1, Rain=0..1
//
// Knob 1: Torch. A warm incandescent bulb at 0, then a cold white LED, a blue gel, and at 1 a UV torch under which the veil glows cyan and the leaves dark red.
// Knob 2: Speed. The time-lapse rate: at 2 one stinkhorn lives about 30 s and a new egg starts every 22 s; 0.2 is ten times slower.
// Knob 3: Veil. At 0 an open net, holes 3 to 4 LEDs across, that stops a hand above the litter; turned up, finer, to holes of 2, longer and wider, its hem on the leaves.
// Knob 4: Rain. Near 0 a light mist and a drip now and then; turned up, drops streak through the beam, splash on the litter and bead on the knots of the net.
// Buttons: K1 tap starts a new egg now.

const W = 64;
const H = 128;
const N = W * H;
const { min, max, abs, sin, cos, sqrt, floor, round, ceil, exp, asin, PI } = Math;
const rnd = () => Math.random();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (a, b, v) => ((v = clamp((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;
function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const f32 = (n) => new Float32Array(n);
const tab = (n, f) => Float32Array.from({ length: n }, (_, i) => f(i));
const ST = tab(1024, (i) => sin((i * PI) / 512));
const fsin = (x) => ST[((x * 162.97) | 0) & 1023];
const AS = tab(1025, (i) => asin(i / 512 - 1));
const CAPF = tab(257, (i) => (1 - (i / 256) ** 2.6) ** 0.45 * (1 - (0.2 * i) / 256));
const JT = tab(512, (i) => hash(i, 31));
const CW = new Float64Array(2);

// One life in time-lapse seconds at Speed 2. The first opens with its veil on the way down.
const [SPLIT, RISE0, RISE1, VEIL0, VEIL1, FLIES, EAT1, WILT, SLUMP0, SLUMP1, GONE, NEXT, OPEN] = [2.6, 3.2, 9.6, 8.3, 13.5, 13, 26, 24, 25.5, 31.5, 38, 22, 8.8];
const TORCH = [[1, 0.9, 0.75], [0.86, 0.92, 1], [0.45, 0.58, 1], [0.55, 0.25, 1]];
const AMB = 0.05;
// Materials: albedo, then glow under UV.
const GLEBA = [0.31, 0.28, 0.09, 0.03, 0.05, 0.01];
const RIDGE = [0.44, 0.4, 0.15, 0.04, 0.07, 0.02];
const GLOSS = [0.95, 0.95, 0.85, 0.05, 0.08, 0.02];
const WHITE = [0.91, 0.89, 0.81, 0.3, 0.4, 0.6];
const PIT = [0.23, 0.2, 0.11, 0.02, 0.03, 0.02];
const EGG = [0.95, 0.86, 0.9, 0.32, 0.4, 0.62];
const CUP = [0.86, 0.77, 0.78, 0.28, 0.34, 0.5];
const FLY = [[0.2, 0.62, 0.42, 0.05, 0.1, 0.05], [0.3, 0.06, 0.05, 0, 0, 0], [0.75, 0.78, 0.8, 0.1, 0.1, 0.2]];

const lightAt = (P, x, y) => AMB + P.PX[x] * P.PY[y];

function put(P, p, l, m, k) {
  const { tc: T, buf: b } = P;
  const u = P.uv * l;
  for (let c = 0, o = p * 3; c < 3; c++, o++) b[o] += ((m[c] * T[c] * l + m[c + 3] * u) * 255 - b[o]) * k;
}

// The forest, painted once.
function paint(P) {
  const [A, F, E, D] = [f32(N * 3), f32(N * 3), f32(N * 3), f32(N)];
  Object.assign(P, { alb: A, flu: F, emi: E, dep: D });
  const front = new Uint8Array(N);
  const lit = (P.lit = new Int16Array(W));
  const set = (x, y, d, r, g, b, fr = 0, fg = 0, fb = 0) => {
    [x, y] = [floor(x), floor(y)];
    if (x < 0 || x >= W || y < 0 || y >= H) return -1;
    const p = y * W + x;
    A.set([r, g, b], p * 3);
    F.set([fr, fg, fb], p * 3);
    E.fill(0, p * 3, p * 3 + 3);
    D[p] = d;
    return p;
  };
  const near = (y) => 1.2 + (0.5 * (y - 104)) / 23;
  for (let p = 0; p < N; p++) {
    const y = (p / W) | 0;
    const [k, f] = [y / 30, 1 - ease(24, 32, y)];
    set(p % W, y, 0.12, 0.03, 0.05, 0.04);
    E.set([(8 + 7 * k) * f, (13 + 12 * k) * f, (34 + 22 * k) * f], p * 3);
  }
  for (let i = 0; i < 46; i++) {
    const [cx, cy, rx, ry] = [rnd() * 70 - 3, -4 + rnd() * 36, 3 + rnd() * 5, 2 + rnd() * 3.5];
    for (let y = floor(cy - ry); y <= cy + ry; y++)
      for (let x = floor(cx - rx); x <= cx + rx; x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 < 1 - 0.35 * hash(x, y + 300)) set(x, y, 0.3, 0.04, 0.1, 0.05, 0.18, 0, 0.02);
  }
  // Trunks, fissured, with lichen; the near left one on buttress roots.
  for (const [x0, w, lean, d, fin] of [[23, 2, 0.01, 0.22, 0], [43, 3, -0.01, 0.26, 0], [56, 5, 0.03, 0.55, 4], [7, 8, -0.02, 0.62, 9]])
    for (let y = 0; y < 112; y++) {
      const cx = x0 + lean * (y - 64);
      const hw = w / 2 + fin * max(0, (y - 82) / 26) ** 2;
      for (let x = floor(cx - hw); x <= cx + hw; x++) {
        const q = (x + 0.5 - cx) / hw;
        if (abs(q) > 1) continue;
        const sh = 0.3 + 0.7 * sqrt(1 - q * q) - 0.2 * q;
        const k = sh * (sin((x - cx) * 2.3 + 1.6 * sin(y * 0.13 + x0)) > 0.55 ? 0.5 : 1);
        if (hash(floor(x / 3) + x0, floor(y / 4)) > 0.87) set(x, y, d, 0.5 * sh, 0.56 * sh, 0.45 * sh, 0.4, 0.55, 0.12);
        else set(x, y, d, 0.36 * k, 0.32 * k, 0.27 * k);
      }
    }
  // Heart-shaped leaves of the understory.
  for (const [bx, by, len, ang, d] of [[-2, 100, 24, -1, 0.85], [-3, 74, 17, -0.45, 0.6], [66, 103, 21, -2.25, 0.75]]) {
    const [ca, sa] = [cos(ang), sin(ang)];
    for (let y = floor(by - len); y <= by + len; y++)
      for (let x = floor(bx - len); x <= bx + len; x++) {
        const [dx, dy] = [x + 0.5 - bx, y + 0.5 - by];
        const u = dx * ca + dy * sa;
        const v = abs(-dx * sa + dy * ca);
        const half = len * 0.5 * sin(PI * (u / len) ** 0.7) * (1 - (0.2 * u) / len);
        if (u < 0 || u > len || v > half) continue;
        const k = (v < 0.6 ? 1.7 : abs(((u * 0.6 - v * 0.8) % 3.2) - 1.6) < 0.45 ? 1.3 : 1) * (v > 0.2 * half && v < 0.6 * half ? 1.25 : 0.95);
        set(x, y, d, 0.07 * k, 0.3 * k, 0.08 * k, 0.5, 0.01, 0.05);
      }
  }
  // Leaf litter, nearer leaves over farther, then twigs.
  const [s1, s2] = [rnd() * 6, rnd() * 6];
  for (let x = 0; x < W; x++) {
    lit[x] = round(105 + 1.6 * sin(x * 0.19 + s1) + 1.1 * sin(x * 0.47 + s2));
    for (let y = lit[x]; y < H; y++) set(x, y, near(y), 0.1, 0.07, 0.05, 0.05, 0.04, 0.01);
  }
  const PAL = [[0.55, 0.33, 0.14], [0.68, 0.5, 0.25], [0.4, 0.22, 0.1], [0.75, 0.6, 0.36], [0.3, 0.17, 0.08], [0.6, 0.28, 0.12], [0.5, 0.45, 0.32]];
  const leaves = [];
  for (let i = 0; i < 300; i++) leaves.push([rnd() * 70 - 3, 102 + rnd() * 27, 2.5 + rnd() * 4.5, 1 + rnd() * 1.8, (rnd() - 0.5) * 1.5, floor(rnd() * 7), 0.7 + 0.5 * rnd()]);
  for (const [cx, cy, len, wid, ang, ci, sh] of leaves.sort((a, b) => a[1] - b[1])) {
    const [ca, sa, c] = [cos(ang), sin(ang), PAL[ci]];
    for (let y = floor(cy - len); y <= cy + len; y++)
      for (let x = floor(cx - len); x <= cx + len; x++) {
        if (x < 0 || x >= W || y >= H || y < lit[x] - 1) continue;
        const [dx, dy] = [x + 0.5 - cx, y + 0.5 - cy];
        const u = (dx * ca + dy * sa) / len;
        const v = (-dx * sa + dy * ca) / wid;
        const q = u * u + v * v;
        const k = sh * (abs(v) < 0.3 ? 0.78 : 1) * (q > 0.7 ? 0.82 : 1) * (0.9 + 0.2 * hash(x, y));
        if (q <= 1) front[set(x, y, near(y), c[0] * k, c[1] * k, c[2] * k, 0.06, 0.05, 0.01)] = cy > 115 ? 1 : 0;
      }
  }
  for (let i = 0; i < 8; i++) {
    const [x0, y0, len, ang, tk] = [rnd() * 64, 106 + rnd() * 20, 8 + rnd() * 22, (rnd() - 0.5) * 0.8, i < 2 ? 1 : 0];
    for (let t = 0; t < len; t += 0.5) {
      const x = x0 + cos(ang) * t;
      const y = y0 + sin(ang) * t + 0.8 * sin(t * 0.3 + i);
      if (x < 0 || x >= W || y < lit[floor(x)] - 1) continue;
      front[set(x, y, near(y), 0.2, 0.13, 0.08)] = front[set(x, y - 1, near(y), 0.36 + 0.14 * tk, 0.27 + 0.13 * tk, 0.18 + 0.12 * tk)] = y0 > 115 ? 1 : 0;
    }
  }
  P.fronts = Int32Array.from(front.reduce((a, f, p) => (f && a.push(p), a), []));
  P.fsave = new Float32Array(P.fronts.length * 3);
}

function spawnBody(P, age, first) {
  let [bx, best] = [33, -1];
  for (let i = 0; i < 24 && !first; i++) {
    const x = 15 + rnd() * 34;
    let d = 18;
    for (const b of P.bodies) if (b.age < SLUMP1) d = min(d, abs(b.bx - x));
    if ((d += rnd() * 4) > best) [best, bx] = [d, x];
  }
  const sc = first ? 1 : 0.86 + rnd() * 0.14;
  const dir = (bx < 32 ? -1 : 1) * (rnd() < 0.25 ? -1 : 1);
  P.bodies.push({ bx, by: 109 + (3 * (sc - 0.86)) / 0.14, sc, H: 78 * sc, dir, age, seed: floor(rnd() * 1000), lean: (rnd() - 0.5) * 0.1, flies: [], maxF: 4 + floor(rnd() * 4) });
}

export function setup(params) {
  const P = params;
  paint(P);
  const f = f32;
  Object.assign(P, { buf: f(N * 3), PX: f(W), PY: f(H), tc: f(3), dB: f(N).fill(99), sB: f(N), hB: f(N), tch: new Int32Array(N) });
  P.G = { cx: f(300), cy: f(300), a: f(300), r: f(300), n: 0, Ls: 0 };
  Object.assign(P, { bodies: [], drops: [], splash: [], t: 0, rate: 1, torch: 0, veil: 0, rain: 0.06, rAcc: 0, tx: 33 });
  spawnBody(P, OPEN, true);
}

// The stalk's centre line: it rises, then crumples and slumps onto the litter.
function geom(P, b) {
  const { G } = P;
  const grow = 1 - (1 - clamp((b.age - RISE0) / (RISE1 - RISE0), 0, 1)) ** 2.2;
  const slump = ease(SLUMP0, SLUMP1, b.age);
  const Ls = (b.H * grow + 1.5) * (1 - 0.72 * slump ** 0.7);
  const bend = b.lean + b.dir * 1.9 * slump ** 0.8;
  const n = min(299, max(2, ceil(Ls / 0.9)));
  let [x, y] = [b.bx, b.by - 2];
  for (let i = 0; i <= n; i++) {
    const a = bend * (i / n) ** 1.2;
    const r = b.sc * (4.3 - (0.9 * i) / n + 0.35 * sin((PI * i) / n));
    G.cx[i] = x;
    G.cy[i] = y;
    G.a[i] = a;
    G.r[i] = r;
    x += (sin(a) * Ls) / n;
    y = min(y - (cos(a) * Ls) / n, P.lit[clamp(round(x), 0, W - 1)] + 2 - 0.5 * r);
  }
  [G.n, G.Ls] = [n, Ls];
}

// The egg; once split, the torn cup round the foot of the stalk.
function egg(P, b, fade) {
  const cup = b.age >= SPLIT;
  const sw = cup ? 1 : mix(0.45, 1, 1 - (1 - clamp(b.age / (SPLIT * 0.9), 0, 1)) ** 2);
  const [ew, eh, ex, ey] = [(cup ? 6.6 : 6.2) * b.sc * sw, 6.8 * b.sc * sw, b.bx, b.by - 1 - 4.5 * sw];
  const crack = cup ? 0 : ease(SPLIT - 0.9, SPLIT, b.age);
  for (let y = max(0, floor(ey - eh)); y <= min(H - 1, ey + eh); y++)
    for (let x = max(0, floor(ex - ew)); x <= min(W - 1, ex + ew); x++) {
      const nx = (x + 0.5 - ex) / ew;
      const ny = (y + 0.5 - ey) / eh;
      const rr = nx * nx + ny * ny;
      const rim = cup ? -0.05 + 0.28 * abs(sin(nx * 4.2 + b.seed)) : -9;
      if (rr > 1 || ny < rim) continue;
      const l = lightAt(P, x, y) * (0.16 + 0.82 * max(0, -0.38 * nx - 0.38 * ny + 0.84 * sqrt(1 - rr))) * (ny < rim + 0.12 ? 1.2 : 1);
      const torn = crack > 0 && ny < -0.1 && abs(nx) < crack * 0.85 && abs(ny + 0.55 + 0.13 * sin(nx * 9 + b.seed)) < 0.06 + 0.12 * crack;
      put(P, y * W + x, l, torn ? GLEBA : cup ? CUP : EGG, fade);
    }
}

// Standing, the stalk fills row by row; slumped, it is stamped as discs.
function stalk(P, b, fade, sleeve, slen, V) {
  const { dB, sB, hB, tch, G } = P;
  let nt = 0;
  const mark = (p, d, s, h) => {
    if (dB[p] > 9) tch[nt++] = p;
    dB[p] = d;
    sB[p] = s;
    hB[p] = h;
  };
  if (abs(G.a[G.n]) < 0.4)
    for (let y = min(H - 1, floor(G.cy[0])), i = 0; y >= max(0, floor(G.cy[G.n])); y--) {
      while (i < G.n && G.cy[i + 1] > y + 0.5) i++;
      const [cx, r] = [G.cx[i], G.r[i]];
      for (let x = max(0, floor(cx - r + 0.5)); x <= min(W - 1, floor(cx + r - 0.5)); x++) {
        const t = ((x + 0.5 - cx) * cos(G.a[i])) / r;
        mark(y * W + x, t * t, t, i / G.n);
      }
    }
  else
    for (let i = 0; i <= G.n; i++) {
      const [cx, cy, r, nx, ny] = [G.cx[i], G.cy[i], G.r[i], cos(G.a[i]), sin(G.a[i])];
      for (let y = max(0, floor(cy - r - 0.5)); y <= min(H - 1, floor(cy + r + 0.5)); y++)
        for (let x = max(0, floor(cx - r - 0.5)); x <= min(W - 1, floor(cx + r + 0.5)); x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = (dx * dx + dy * dy) / (r * r);
          const p = y * W + x;
          if (d < 1 && d < dB[p]) mark(p, d, (dx * nx + dy * ny) / r, i / G.n);
        }
    }
  const wc = ease(WILT, SLUMP1, b.age);
  const crease = ease(SLUMP0, SLUMP1, b.age);
  const m = [mix(0.95, 0.74, wc), mix(0.93, 0.66, wc), mix(0.87, 0.47, wc), 0.3, 0.42, 0.68];
  for (let j = 0; j < nt; j++) {
    const p = tch[j];
    const t = clamp(sB[p], -1, 1);
    const hp = hB[p] * G.Ls;
    const y = (p / W) | 0;
    dB[p] = 99;
    let sh = (0.2 + 0.8 * max(0, 0.92 * sqrt(1 - t * t) - 0.38 * t)) * (1 - 0.25 * wc);
    const arc = asin(t) * 3.2 * b.sc;
    const row = floor(hp / 1.4);
    if (hash(row + b.seed, floor(arc / 1.3 + (row & 1) * 0.5) + 50) < 0.24) sh *= 0.74;
    if (hp % 3.2 < 1) sh *= 1 - 0.4 * crease;
    if (sleeve > 0 && hp > G.Ls - slen) sh *= 1 + sleeve * (fsin(arc * 1.4 + hp * 1.2) * fsin(arc * 1.4 - hp * 1.2) > 0.4 ? 0.22 : -0.18);
    if (y > V.ay + 2 && y < V.ay + V.L) sh *= 1 - 0.42 * V.alpha * V.open;
    put(P, p, lightAt(P, p % W, y) * sh, m, fade);
  }
}

// Worley ridges of the cap: F2 - F1; the cell's id and F1 go in CW.
function cell(u, v, seed) {
  let [f1, f2, id] = [9, 9, 0];
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cu = floor(u) + i;
      const cv = floor(v) + j;
      const j2 = (((cu + seed) & 15) * 16 + (cv & 15)) * 2;
      const dx = u - (cu + 0.15 + 0.7 * JT[j2]);
      const dy = v - (cv + 0.15 + 0.7 * JT[j2 + 1]);
      const d = dx * dx + dy * dy;
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = JT[j2];
      } else if (d < f2) f2 = d;
    }
  CW[0] = id;
  CW[1] = f1;
  return sqrt(f2) - sqrt(f1);
}

function cap(P, b, fade) {
  const { G } = P;
  const [ax, ay, a] = [G.cx[G.n], G.cy[G.n], G.a[G.n]];
  const [ux, uy] = [sin(a), -cos(a)];
  const cs = mix(0.55, 1, ease(SPLIT, RISE0 + 1.5, b.age));
  const [ch, cw] = [15 * b.sc * cs, 7.6 * b.sc * cs];
  const eat = ease(FLIES + 1.5, EAT1, b.age);
  const wc = ease(WILT, SLUMP1, b.age);
  const [ex, ey] = [abs(uy) * (cw + 1), abs(ux) * (cw + 1)];
  const [xa, xb, ya, yb] = [ax - ux * 1.5, ax + ux * ch, ay - uy * 1.5, ay + uy * ch];
  for (let y = max(0, floor(min(ya, yb) - ey)); y <= min(H - 1, max(ya, yb) + ey); y++)
    for (let x = max(0, floor(min(xa, xb) - ex)); x <= min(W - 1, max(xa, xb) + ex); x++) {
      const dx = x + 0.5 - ax;
      const dy = y + 0.5 - ay;
      const av = dx * ux + dy * uy;
      const w = -dx * uy + dy * ux;
      const t = max(0, av) / ch;
      const hw = cw * CAPF[(min(1, t) * 256) | 0] + (av < 0 ? 0.5 : 0);
      if (av < -1.5 || av > ch || abs(w) > hw) continue;
      const q = w / hw;
      const sh = (0.22 + 0.78 * max(0, 0.9 * sqrt(1 - q * q) - 0.4 * q)) * (0.85 + 0.15 * t) * (1 - 0.3 * wc);
      const l = lightAt(P, x, y) * sh;
      const p = y * W + x;
      // A white collar at the top; where flies ate the slime, white ridges.
      if (t > 0.9) put(P, p, l, abs(w) < 0.9 && t > 0.96 ? PIT : WHITE, fade);
      else {
        const ridge = cell((AS[((q + 1) * 512) | 0] * cw) / 2.5, av / 2.3, b.seed) < 0.24;
        if (CW[0] < eat) put(P, p, l, ridge ? WHITE : PIT, fade);
        else if (!ridge && CW[1] < 0.05 && sh > 0.7 && CW[0] > 0.55) put(P, p, l * 1.4, GLOSS, fade);
        else put(P, p, l, ridge ? RIDGE : GLEBA, fade);
      }
    }
  Object.assign(b, { capX: ax, capY: ay, ux, uy, ch, cw });
}

// The veil: a diamond net on a flared cone, its threads crowding at the sides.
function veil(P, b, V, front) {
  const { buf, tc, PX, PY, wet, uv } = P;
  const { ax, ay, L, r0, rb, sway, wob, band, alpha, bright, col } = V;
  const seed = b.seed;
  const C = [0, 1, 2].map((c) => (col[c] * tc[c] + [0.45, 0.95, 1][c] * uv) * 255 * bright);
  for (let y = max(0, ceil(ay)); y <= min(H - 1, floor(ay + L * 1.06)); y++) {
    const s = (y + 0.5 - ay) / L;
    const sc = min(s, 1);
    const R = r0 + (rb - r0) * sc ** 0.8;
    const cx = ax + sway * sc * sc;
    const cw = mix(V.cw0, V.cw1, sc) * V.kw;
    const ch = cw * 1.15 * V.kh;
    const [vv, icw, ich, py] = [(s * L) / ch, 1 / (cw * cw), 1 / (ch * ch), PY[y]];
    for (let x = max(0, floor(cx - R)); x <= min(W - 1, ceil(cx + R)); x++) {
      const sx = (x + 0.5 - cx) / R;
      if (sx <= -1 || sx >= 1) continue;
      const c2 = max(0.0144, 1 - sx * sx);
      const th = front ? AS[((sx + 1) * 512) | 0] : PI - AS[((sx + 1) * 512) | 0];
      const hem = s > 0.94 ? 1 + 0.035 * fsin(th * 7 + seed) + 0.02 * fsin(th * 13) : 2;
      if (s > hem) continue;
      const u = (th * R) / cw;
      const wb = wob * fsin(u * 2.1 + vv * 1.3 + seed);
      const g1 = u + vv + wb;
      const g2 = u - vv - 0.7 * wb;
      const k = 1.4 / sqrt(icw / c2 + ich);
      const d1 = abs(g1 - round(g1)) * k;
      const d2 = abs(g2 - round(g2)) * k;
      let i = (d1 < 1 ? 1 - d1 : 0) + (d2 < 1 ? 1 - d2 : 0);
      if (s * L < 2.2) i = max(i, 0.8);
      if (s > hem - band / L) i = max(i, 0.7);
      if (i < 0.04) continue;
      const l = (AMB + PX[x] * py) * (front ? 0.3 + 0.7 * max(0, 0.94 * sqrt(c2) - 0.34 * sx) : 0.18 + 0.18 * sqrt(c2));
      const a = min(1, i) * alpha;
      for (let c = 0, o = (y * W + x) * 3; c < 3; c++, o++) buf[o] += (C[c] * l - buf[o]) * a;
      if (front && d1 < 0.7 && d2 < 0.7 && hash(round(g1) + seed, round(g2) + 99) < wet) put(P, y * W + x, l * 1.8, WHITE, alpha);
    }
  }
}

function drawBody(P, b) {
  const age = b.age;
  if (age < SPLIT) return egg(P, b, 1);
  geom(P, b);
  const { G, veil: vk } = P;
  const fade = 1 - ease(SLUMP1, GONE, age);
  const f = clamp((age - VEIL0) / (VEIL1 - VEIL0), 0, 1);
  const fu = ease(0, 1, f);
  const c = ease(WILT, WILT + 3.5, age);
  const [ax, ay, r0] = [G.cx[G.n], G.cy[G.n] + 1, G.r[G.n] + 1.4];
  const Lf = max(0, min(b.by - 13 * b.sc + 10 * vk, P.lit[clamp(round(ax), 0, W - 1)] + 2) - ay);
  const V = { ax, ay, r0, L: max(0.5, Lf * fu * (1 - 0.15 * c)), rb: mix((20 + 7 * vk) * b.sc * (0.35 + 0.65 * fu), r0 + 2.5, c), cw0: mix(6, 3.2, vk), cw1: mix(7.6, 4, vk) };
  Object.assign(V, { kw: 0.75 + 0.25 * fu, kh: 0.55 + 0.45 * fu, band: (1 - fu) * 2.5 + 0.6, open: min(1, fu * 2), wob: 0.06 + 0.3 * c, bright: 1 - 0.4 * c });
  V.sway = (3 * sin(age * 0.9 + b.seed) + 0.8 * sin(P.t * 0.7 + b.seed)) * (1 - c);
  V.alpha = fade * (1 - ease(0.55, 1, c)) * (Lf > 1 ? 1 : 0);
  V.col = [mix(0.98, 0.86, c), mix(0.97, 0.79, c), mix(0.93, 0.6, c)];
  const show = f > 0 && V.alpha > 0.01;
  if (show) veil(P, b, V, false);
  stalk(P, b, fade, c, Lf * 0.8, V);
  egg(P, b, fade);
  if (show) veil(P, b, V, true);
  cap(P, b, fade);
  drawFlies(P, b);
}

// Flies land on the cap, crawl, hop, and leave when it wilts.
function capPoint(b, q, a) {
  const av = a * b.ch;
  const w = q * b.cw * CAPF[(clamp(a, 0, 1) * 256) | 0];
  return [b.capX + b.ux * av - b.uy * w, b.capY + b.uy * av + b.ux * w];
}

function updateFlies(b, dt) {
  const want = round(b.maxF * ease(FLIES, FLIES + 3, b.age) * (1 - ease(WILT - 1, WILT + 2.5, b.age)));
  const fl = b.flies;
  const stay = fl.filter((f) => f.s < 2);
  const spot = () => ({ s: 0, q: (rnd() - 0.5) * 1.5, a: 0.15 + rnd() * 0.7 });
  if (stay.length < want && b.capX !== undefined && rnd() < dt * 2) fl.push({ x: rnd() < 0.5 ? -3 : W + 2, y: 15 + rnd() * 60, vx: 0, vy: 0, ...spot() });
  if (stay.length > want) Object.assign(stay[0], { s: 2, tx: rnd() < 0.5 ? -8 : W + 8, ty: rnd() * 50 });
  for (let i = fl.length - 1; i >= 0; i--) {
    const f = fl[i];
    if (f.s === 1) {
      f.q = clamp(f.q + (rnd() - 0.5) * dt * 1.2, -0.8, 0.8);
      f.a = clamp(f.a + (rnd() - 0.5) * dt * 0.6, 0.1, 0.85);
      if (rnd() < dt * 0.3) Object.assign(f, spot());
      continue;
    }
    const [tx, ty] = f.s === 0 ? capPoint(b, f.q, f.a) : [f.tx, f.ty];
    f.vx += ((tx - f.x) * 5 - f.vx * 2.2 + (rnd() - 0.5) * 260) * dt;
    f.vy += ((ty - f.y) * 5 - f.vy * 2.2 + (rnd() - 0.5) * 260) * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.s === 0 && abs(tx - f.x) + abs(ty - f.y) < 1.5) f.s = 1;
    if (f.s === 2 && abs(f.x - W / 2) > W / 2 + 6) fl.splice(i, 1);
  }
}

function drawFlies(P, b) {
  for (const f of b.flies) {
    const [x, y] = (f.s === 1 ? capPoint(b, f.q, f.a) : [f.x, f.y]).map(round);
    if (x < 1 || x >= W - 2 || y < 1 || y >= H) continue;
    const [l, p] = [lightAt(P, x, y), y * W + x];
    put(P, p, l, FLY[0], 1);
    put(P, p + 1, l, FLY[1], 1);
    if (f.s !== 1) for (const dx of [-1, 1]) put(P, p - W + dx + (floor(P.t * 30) & 1), l, FLY[2], 0.8);
    else if (sin(P.t * 5 + f.q * 40) > 0.7) put(P, p, l * 1.6, GLOSS, 1);
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = clamp(dt, 0, 0.1);
  Object.assign(P, { torch: clamp(k[0], 0, 1), rate: clamp(k[1], 0.2, 3) / 2, veil: clamp(k[2], 0, 1), rain: clamp(k[3], 0, 1) });
  P.t += dt;
  for (const b of P.bodies) b.age += dt * P.rate;
  P.bodies = P.bodies.filter((b) => b.age < GONE);
  if (min(...P.bodies.map((b) => b.age)) >= NEXT) spawnBody(P, 0, false);
  if (input.btnPressed && input.btnPressed[0]) {
    if (P.bodies.length >= 3) P.bodies.sort((a, b) => b.age - a.age).shift();
    spawnBody(P, 0, false);
  }
  // The beam follows whatever is coming up.
  let [sw, sx] = [0, 0];
  for (const b of P.bodies) {
    const w = ease(SPLIT - 2, RISE1, b.age) * (1 - ease(SLUMP0, GONE, b.age)) + 0.02;
    sw += w;
    sx += w * b.bx;
  }
  P.tx += ((sx / sw || 33) - P.tx) * (1 - exp(-dt * 0.8));
  for (const b of P.bodies) updateFlies(b, dt * clamp(P.rate, 0.12, 1.6));
  P.rAcc += dt * (0.5 + 40 * P.rain ** 1.5);
  for (; P.rAcc >= 1; P.rAcc--) if (P.drops.length < 160) P.drops.push([rnd() * W, rnd() * 34 - 4, 75 + rnd() * 50]);
  for (let i = P.drops.length - 1; i >= 0; i--) {
    const d = P.drops[i];
    const x = floor(d[0]);
    d[1] += d[2] * dt * (0.7 + 0.3 * min(P.rate, 1.5));
    if (d[1] < P.lit[x] - 1) continue;
    if (P.splash.length < 40) P.splash.push([x, P.lit[x] - 1 + floor(rnd() * 3), 0.15]);
    P.drops.splice(i, 1);
  }
  P.splash = P.splash.filter((s) => (s[2] -= dt) > 0);
}

function light(P) {
  const f = P.torch * 3;
  const i = min(2, floor(f));
  P.uv = ease(0.72, 1, P.torch);
  for (let c = 0; c < 3; c++) P.tc[c] = mix(TORCH[i][c], TORCH[i + 1][c], f - i) * (1 - 0.7 * P.uv);
  // A handheld beam sways.
  const tx = P.tx + 2.5 * sin(P.t * 1.3) + 1.5 * sin(P.t * 2.9 + 1);
  const ty = 66 + 3 * sin(P.t * 1.7 + 2);
  for (let x = 0; x < W; x++) P.PX[x] = exp(-(((x + 0.5 - tx) / 30) ** 2));
  for (let y = 0; y < H; y++) P.PY[y] = exp(-(((y + 0.5 - ty) / 62) ** 4));
  P.haze = (5 + 38 * P.rain) * (1 - 0.4 * P.uv);
  P.wet = 0.1 + 0.55 * P.rain;
}

function background(P) {
  const { alb: A, flu: F, emi: E, dep: D, buf, tc, PX, PY, uv, haze, fronts, fsave } = P;
  const [r, g, b] = tc;
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const pool = PX[p % W] * PY[(p / W) | 0];
    const l = D[p] * (AMB + pool) * 255;
    const u = l * uv;
    const h = haze * pool;
    buf[o] = A[o] * r * l + E[o] + h * r + F[o] * u;
    buf[o + 1] = A[o + 1] * g * l + E[o + 1] + h * g + F[o + 1] * u;
    buf[o + 2] = A[o + 2] * b * l + E[o + 2] + h * b + F[o + 2] * u;
  }
  for (let i = 0; i < fronts.length * 3; i++) fsave[i] = buf[fronts[(i / 3) | 0] * 3 + (i % 3)];
}

function drawRain(P) {
  const { buf, tc, PX, PY } = P;
  const glow = (x, y, v) => {
    if (x >= 0 && x < W && y >= 0 && y < H) for (let c = 0; c < 3; c++) buf[(y * W + x) * 3 + c] += v * (0.6 + 0.05 * c + 0.4 * tc[c]) * (1 - 0.6 * P.uv);
  };
  for (const [x0, y0] of P.drops) for (let j = 0, x = floor(x0); j < 3; j++) glow(x, floor(y0) - j, (25 + 190 * PX[x] * PY[clamp(floor(y0) - j, 0, H - 1)]) * (1 - j * 0.3));
  for (const [x, y, life] of P.splash) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) glow(x + dx, y + dy, life * 900 * PX[x] * PY[min(H - 1, y)]);
}

export function draw(display, params) {
  const P = params;
  const { fronts, fsave, buf } = P;
  light(P);
  background(P);
  for (const b of P.bodies.slice().sort((a, b) => a.by - b.by)) drawBody(P, b);
  for (let i = 0; i < fronts.length * 3; i++) buf[fronts[(i / 3) | 0] * 3 + (i % 3)] = fsave[i];
  drawRain(P);
  for (let y = 0, o = 0; y < H; y++) for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, min(255, buf[o]), min(255, buf[o + 1]), min(255, buf[o + 2]));
}
