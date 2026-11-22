// ===== Patternflow pattern =====
// Title:   cAMP Streams
// Family:  amoeba
// Idea:    Starving Dictyostelium amoebae seen in dark field on a 64 by 128 panel, where waves of cyclic AMP run out in rings and spirals from pacemaker clumps and each wave front pulls the cells a couple of LEDs toward its source, so that a haze of blue cells gathers into branching white streams that flow into amber mounds, until a mound culminates and scatters its cells as fresh ones and new pacemakers start elsewhere.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: cyclic AMP as the signal of slime mould aggregation (Gerisch, 1960s; Konijn, van de Meene, Bonner and Barkley, 1967), chemotactic aggregation as an instability (Evelyn Keller and Lee Segel, 1970), waves in the aggregating field seen in dark field (Alcantara and Monk, 1974), cAMP waves shown by isotope dilution (Tomchik and Devreotes, 1981), excitable models of the relay (Martiel and Goldbeter, 1987; John Tyson and James Murray, 1989), the two-variable excitable medium of Dwight Barkley (1991); pattern round 213
// Round:   215
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Clock=0..3.2, Chemotaxis=-1..1, Excitability=-1..1
//
// Knob 1: Hue. Placeholder.
// Knob 2: Clock. Placeholder.
// Knob 3: Chemotaxis. Placeholder.
// Knob 4: Excitability. Placeholder.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, pow, exp, sin, cos, PI, min, max, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

// ---- the excitable field (Barkley form): lengths in LEDs, time in seconds at Clock 2
const EPS = 0.05, FA = 0.84, FB = 0.07, DL = 1.9, TAUV = 1.0;
const HS = 0.03; // longest step
// ---- the cells
const NP = 6000, WT = N / NP; // cells, and the density one of them stands for (mean density 1)
const D0 = 0.03; // random walk of a cell outside the streams, LED^2 a second
const CAP = 0.3; // longest chemotactic step, LEDs
const SLOW = 4; // steps between the slow fields
const WARM = 1500; // warm-up steps
// ---- streams
const KM = 3, BETA = 0.06, DMT = 0.14, GSRC = 1.4, REACH = 0.9; // pull of the stream field, its fade and spread, strength, growth in LEDs a second
const CATCH = 0.12; // chance a step that a cell beside a stream joins it
// ---- pacemakers and mounds
const NPM = 5, MBIG = 800, SHED = 1 / 14, FLY = 28;

const XP = new Int32Array(N), XM = new Int32Array(N), YP = new Int32Array(N), YM = new Int32Array(N);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    XP[i] = y * W + ((x + 1) % W);
    XM[i] = y * W + ((x + W - 1) % W);
    YP[i] = ((y + 1) % H) * W + x;
    YM[i] = ((y + H - 1) % H) * W + x;
  }

function hsvOf(r, g, b) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h / 6, mx > 0 ? d / mx : 0, mx / 255];
}
function rgbOf(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const r = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  const g = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  const b = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return [r * 255, g * 255, b * 255];
}

const STOPS = [
  [0.0, 8, 6, 28],
  [0.12, 14, 28, 92],
  [0.35, 28, 96, 190],
  [0.55, 76, 186, 236],
  [0.75, 205, 240, 250],
  [0.9, 250, 246, 232],
  [1.0, 255, 214, 140],
];
function stopColour(t, out) {
  let k = 0;
  while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
  const a = STOPS[k], b = STOPS[k + 1], u = cl((t - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * u;
  out[1] = a[2] + (b[2] - a[2]) * u;
  out[2] = a[3] + (b[3] - a[3]) * u;
}

function makeState() {
  const F = () => new Float32Array(N);
  return {
    u: F(), v: F(), un: F(), vn: F(), gate: F(), gx: F(), gy: F(), mt: F(), tmp: F(), tmp2: F(), rb: F(), rs: F(),
    nodeT: new Int8Array(N).fill(-1), nodeN: new Int16Array(N),
    px: new Float32Array(NP), py: new Float32Array(NP), tx: new Float32Array(NP), ty: new Float32Array(NP),
    ex: new Float32Array(NP), ey: new Float32Array(NP), sf: new Float32Array(NP), tt: new Float32Array(NP), nd: new Int16Array(NP),
    st: new Uint8Array(NP), pt: new Uint8Array(NP),
    lut: new Float32Array(256 * 3), hueDone: -1, knobs: [0, 2, 0, 0.06],
    nslow: 0, tm: 0, pm: [],
  };
}

// 1-2-1 blur along x and y on the torus; two passes make the 5-tap binomial
function blur(src, dst, tmp, passes) {
  let a = src;
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < N; i++) tmp[i] = 0.25 * a[XM[i]] + 0.5 * a[i] + 0.25 * a[XP[i]];
    for (let i = 0; i < N; i++) dst[i] = 0.25 * tmp[YM[i]] + 0.5 * tmp[i] + 0.25 * tmp[YP[i]];
    a = dst;
  }
}

// every cell adds its weight to the four LEDs around it; a cell in a stream or a mound weighs more than one in the open
function splat(S, out) {
  const { px, py, st } = S;
  out.fill(0);
  for (let p = 0; p < NP; p++) {
    const x = px[p], y = py[p], x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
    const xa = x0 >= W ? 0 : x0, xb = xa + 1 >= W ? 0 : xa + 1, ya = y0 >= H ? 0 : y0, yb = ya + 1 >= H ? 0 : ya + 1;
    const w = st[p] === 1 || st[p] === 2 ? WT : 0.8 * WT, wa = w * (1 - fx), wb = w * fx;
    out[ya * W + xa] += wa * (1 - fy);
    out[ya * W + xb] += wb * (1 - fy);
    out[yb * W + xa] += wa * fy;
    out[yb * W + xb] += wb * fy;
  }
}

function derive(S) {
  const k = S.knobs;
  const k3 = cl(k[2], -1, 1), k4 = cl(k[3], -1, 1);
  return { ch: 9 * pow(2, k3), tpm: 7.4 * pow(1.32, -k4), ie: 1 / (EPS * pow(1.22, -k4)), clock: cl(k[1], 0, 3.2) / 2 };
}

const wrapd = (d, L) => (d > L / 2 ? d - L : d < -L / 2 ? d + L : d);
const wrap = (x, L) => (x < 0 ? x + L : x >= L ? x - L : x);

// The streams of a mound: stems that leave it at even angles, bend slowly, and fork twice on the way out.
// Each node knows the node nearer the mound, so a cell can walk in along the files.
function buildTree(q) {
  const nx = [], ny = [], par = [], len = [];
  const n0 = 7 + floor(Math.random() * 4), bend = (Math.random() < 0.5 ? -1 : 1) * (0.008 + 0.01 * Math.random());
  const walk = (x, y, th, parent, l0, l1, depth) => {
    let wob = 0, prev = parent;
    for (let l = l0; l < l1; l++) {
      wob = wob * 0.92 + (Math.random() - 0.5) * 0.05;
      th += bend + wob * 0.2;
      x += cos(th);
      y += sin(th);
      nx.push(x);
      ny.push(y);
      par.push(prev);
      len.push(l);
      prev = nx.length - 1;
      if (depth < 2 && l > l0 + 6 && l < l1 - 8 && Math.random() < 0.05) {
        walk(x, y, th + (Math.random() < 0.5 ? -1 : 1) * (0.35 + 0.3 * Math.random()), prev, l, l1 - Math.random() * 18, depth + 1);
      }
    }
  };
  for (let k = 0; k < n0; k++) walk(q.x, q.y, (6.2832 * (k + 0.5 * Math.random())) / n0, -1, 0, 24 + 22 * Math.random(), 0);
  q.nx = Float32Array.from(nx);
  q.ny = Float32Array.from(ny);
  q.np = Int16Array.from(par);
  q.nl = Float32Array.from(len);
  q.nn = nx.length;
  q.maxl = max(...len);
}

function makePacemaker(x, y, born) {
  const q = { x, y, born, life: 150 + 130 * Math.random(), f: 0.92 + 0.3 * Math.random(), next: born + 6 + 4 * Math.random(), mass: 0 };
  buildTree(q);
  return q;
}

// The cell p walks along the file it is on: its place is a point between its node and the next one in.
function placeOnFile(S, p) {
  const q = S.pm[S.pt[p]], n = S.nd[p], t = S.tt[p], pr = q.np[n];
  const ax = q.nx[n], ay = q.ny[n], bx = pr >= 0 ? q.nx[pr] : 0, by = pr >= 0 ? q.ny[pr] : 0;
  S.px[p] = wrap(q.x + ax + (bx - ax) * t + S.ex[p], W) % W;
  S.py[p] = wrap(q.y + ay + (by - ay) * t + S.ey[p], H) % H;
  const w = S.px[p];
  if (w >= W || w < 0) S.px[p] = ((w % W) + W) % W;
  const z = S.py[p];
  if (z >= H || z < 0) S.py[p] = ((z % H) + H) % H;
}

// A cell joins the files of tree k at a node that has grown, in the outer part of the stream where cells come in from the open.
function joinFile(S, p, k, lo) {
  const q = S.pm[k], reach = min((S.tm - q.born - 4) * REACH, q.maxl + 1);
  if (reach < 3) return false;
  for (let tries = 0; tries < 12; tries++) {
    const i = floor(Math.random() * q.nn), l = q.nl[i];
    if (l > reach || l < lo * reach) continue;
    S.pt[p] = k;
    S.nd[p] = i;
    S.tt[p] = Math.random();
    S.ex[p] = (Math.random() - 0.5) * 1;
    S.ey[p] = (Math.random() - 0.5) * 1;
    S.st[p] = 1;
    placeOnFile(S, p);
    return true;
  }
  return false;
}

function throwOut(S, p, q, rmin, rspan) {
  const a = 6.2832 * Math.random(), r = rmin + rspan * sqrt(Math.random());
  S.tx[p] = (((q.x + r * cos(a)) % W) + W) % W;
  S.ty[p] = (((q.y + r * sin(a)) % H) + H) % H;
  S.st[p] = 3;
}

// A mound culminates: nearly all of its cells are thrown out round it as fresh cells, those on the way in are let go,
// and the next pacemaker starts a few LEDs off, after a pause.
function burst(S, k) {
  const q = S.pm[k];
  for (let p = 0; p < NP; p++) {
    if (S.pt[p] !== k) continue;
    if (S.st[p] === 2 && Math.random() < 0.94) throwOut(S, p, q, 6, 32);
    else if (S.st[p] === 1 || S.st[p] === 2) S.st[p] = 0;
  }
  const a = 6.2832 * Math.random(), r = 5 + 8 * Math.random();
  const n = makePacemaker(wrap(q.x + r * cos(a), W) % W, wrap(q.y + r * sin(a), H) % H, S.tm);
  n.next = S.tm + 6 + 4 * Math.random();
  // the old streams' trail goes with them
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = wrapd(x - q.x, W), dy = wrapd(y - q.y, H);
      if (dx * dx + dy * dy < 24 * 24) S.mt[y * W + x] = 0;
    }
  S.pm[k] = n;
}

// The slow fields: the streams that have grown so far, the field they leave, the mounds' bookkeeping
function slow(S, dts) {
  const { mt, tmp, tmp2, nodeT, nodeN, st, pt } = S;
  tmp2.fill(0);
  nodeT.fill(-1);
  for (let k = 0; k < S.pm.length; k++) {
    const q = S.pm[k], reach = (S.tm - q.born - 4) * REACH;
    for (let i = 0; i < q.nn; i++) {
      if (q.nl[i] > reach) continue;
      const xw = wrap(q.x + q.nx[i], W) % W, yw = wrap(q.y + q.ny[i], H) % H, x0 = floor(xw), y0 = floor(yw), fx = xw - x0, fy = yw - y0;
      const xa = x0, xb = (x0 + 1) % W, ya = y0, yb = (y0 + 1) % H, w = GSRC * dts;
      tmp2[ya * W + xa] += w * (1 - fx) * (1 - fy);
      tmp2[ya * W + xb] += w * fx * (1 - fy);
      tmp2[yb * W + xa] += w * (1 - fx) * fy;
      tmp2[yb * W + xb] += w * fx * fy;
      const c = ((fx > 0.5 ? xb : xa)) + W * (fy > 0.5 ? yb : ya);
      nodeT[c] = k;
      nodeN[c] = i;
    }
  }
  const dec = 1 - dts * BETA;
  for (let i = 0; i < N; i++) {
    const m = mt[i];
    tmp[i] = (m + DMT * (mt[XP[i]] + mt[XM[i]] + mt[YP[i]] + mt[YM[i]] - 4 * m)) * dec + tmp2[i];
  }
  mt.set(tmp);
  const cnt = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let p = 0; p < NP; p++) {
    if (st[p] !== 2) continue;
    const k = pt[p];
    if (Math.random() < SHED * dts) {
      // let go: most join a stream far out, a few go back to the open
      if (Math.random() < 0.2 || !joinFile(S, p, k, 0.55)) throwOut(S, p, S.pm[k], 9, 28);
    } else cnt[k]++;
  }
  for (let k = 0; k < S.pm.length; k++) S.pm[k].mass = cnt[k] * WT;
  for (let k = 0; k < S.pm.length; k++) {
    const q = S.pm[k];
    if (S.tm - q.born > q.life || q.mass > MBIG) {
      burst(S, k);
      break;
    }
  }
}

function step(S, P, h) {
  const { u, v, un, vn, gate, gx, gy, mt, px, py, st, tx, ty, nodeT, nodeN } = S;
  const ginv = 1 / (0.6 * h), ie = P.ie;
  for (let i = 0; i < N; i++) {
    const ui = u[i], vi = v[i];
    const lap = u[XP[i]] + u[XM[i]] + u[YP[i]] + u[YM[i]] - 4 * ui;
    let nu = ui + h * (DL * lap + ui * (1 - ui) * (ui - (vi + FB) / FA) * ie);
    nu = nu < 0 ? 0 : nu > 1 ? 1 : nu;
    const g = (nu - ui) * ginv;
    gate[i] = g < 0 ? 0 : g > 1 ? 1 : g;
    un[i] = nu;
    vn[i] = vi + (h * (ui - vi)) / TAUV;
  }
  S.u = un; S.un = u; S.v = vn; S.vn = v;
  const U = S.u;
  S.tm += h;
  // pacemakers: a mound fires a ring when the medium under it has recovered
  for (const q of S.pm) {
    if (S.tm < q.next) continue;
    const xi = floor(q.x + 0.5) % W, yi = floor(q.y + 0.5) % H, c = yi * W + xi;
    if (U[c] > 0.1 || S.v[c] > 0.25) { q.next = S.tm + 0.25; continue; }
    const rk = 2.4 + 1.2 * min(1, q.mass / 600), ri = floor(rk) + 1;
    for (let dy = -ri; dy <= ri; dy++)
      for (let dx = -ri; dx <= ri; dx++) {
        if (dx * dx + dy * dy > rk * rk) continue;
        U[((yi + dy + H) % H) * W + ((xi + dx + W) % W)] = 1;
      }
    q.next = S.tm + P.tpm * q.f * (0.94 + 0.12 * Math.random());
  }
  // the slope a cell in the open climbs: the wave, and the stream field in proportion to the wave
  const m1 = S.tmp;
  for (let i = 0; i < N; i++) m1[i] = mt[i] > 1 ? 1 : mt[i];
  for (let i = 0; i < N; i++) {
    gx[i] = 0.5 * (U[XP[i]] - U[XM[i]]) + KM * U[i] * 0.5 * (m1[XP[i]] - m1[XM[i]]);
    gy[i] = 0.5 * (U[YP[i]] - U[YM[i]]) + KM * U[i] * 0.5 * (m1[YP[i]] - m1[YM[i]]);
  }
  const sx = P.ch * h, sd = sqrt(6 * D0 * h), fstep = FLY * h, sp = P.ch * 0.26 * h;
  for (let p = 0; p < NP; p++) {
    const s = st[p];
    let x = px[p], y = py[p];
    if (s === 3) {
      const dx = wrapd(tx[p] - x, W), dy = wrapd(ty[p] - y, H), d = sqrt(dx * dx + dy * dy);
      if (d <= fstep) {
        x = tx[p]; y = ty[p];
        st[p] = 0;
      } else {
        x += (dx * fstep) / d;
        y += (dy * fstep) / d;
      }
    } else if (s === 1) {
      // in a stream: walk in along the file while the wave is rising under the cell
      let ix = (x + 0.5) | 0, iy = (y + 0.5) | 0;
      if (ix >= W) ix = 0;
      if (iy >= H) iy = 0;
      S.tt[p] += gate[iy * W + ix] * sp * S.sf[p];
      const q = S.pm[S.pt[p]];
      while (S.tt[p] >= 1) {
        S.tt[p] -= 1;
        const pr = q.np[S.nd[p]];
        if (pr < 0) {
          // the mound takes it in
          st[p] = 2;
          const a = 6.2832 * Math.random(), r = (1.4 + 0.11 * sqrt(q.mass)) * sqrt(Math.random());
          px[p] = wrap(q.x + r * cos(a), W) % W;
          py[p] = wrap(q.y + r * sin(a), H) % H;
          break;
        }
        S.nd[p] = pr;
      }
      if (st[p] === 1) placeOnFile(S, p);
      continue;
    } else if (s === 0) {
      let ix = (x + 0.5) | 0, iy = (y + 0.5) | 0;
      if (ix >= W) ix = 0;
      if (iy >= H) iy = 0;
      const c = iy * W + ix, gt = gate[c];
      let vx = gt * sx * gx[c], vy = gt * sx * gy[c];
      const sp2 = vx * vx + vy * vy;
      if (sp2 > CAP * CAP) {
        const k = CAP / sqrt(sp2);
        vx *= k; vy *= k;
      }
      vx += sd * (Math.random() * 2 - 1);
      vy += sd * (Math.random() * 2 - 1);
      x = wrap(x + vx, W);
      y = wrap(y + vy, H);
      if (x >= W) x = 0;
      if (y >= H) y = 0;
      // a cell that walks onto a stream joins the file
      let jx = (x + 0.5) | 0, jy = (y + 0.5) | 0;
      if (jx >= W) jx = 0;
      if (jy >= H) jy = 0;
      const j = jy * W + jx, k = nodeT[j];
      if (k >= 0 && Math.random() < CATCH) {
        S.pt[p] = k;
        S.nd[p] = nodeN[j];
        S.tt[p] = 0;
        S.ex[p] = (Math.random() - 0.5) * 1;
        S.ey[p] = (Math.random() - 0.5) * 1;
        st[p] = 1;
        placeOnFile(S, p);
        continue;
      }
    } else continue;
    px[p] = wrap(x, W) % W;
    py[p] = wrap(y, H) % H;
  }
}

function seedField(S) {
  const { px, py } = S;
  const spots = [[16, 20], [48, 46], [26, 72], [50, 98], [14, 112]];
  for (let k = 0; k < NPM; k++) {
    const q = makePacemaker(spots[k][0], spots[k][1], -(10 + 50 * Math.random()));
    q.next = Math.random() * 4;
    S.pm.push(q);
  }
  for (let p = 0; p < NP; p++) {
    px[p] = Math.random() * W;
    py[p] = Math.random() * H;
    S.sf[p] = 0.35 + 1.3 * Math.random();
    if (Math.random() < 0.5) joinFile(S, p, p % NPM, 0);
  }
}

export function setup(params) {
  const S = (params.s = makeState());
  seedField(S);
  S.knobs = [0, 2, 0, 0.06];
  const P = derive(S);
  slow(S, HS * SLOW);
  for (let n = 0; n < WARM; n++) {
    step(S, P, HS);
    if (++S.nslow % SLOW === 0) slow(S, HS * SLOW);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.knobs = input.knobValues || [0, 2, 0, 0.06];
  const P = derive(S);
  let rest = cl(dt || 0, 0, 0.1) * P.clock;
  while (rest > 1e-9) {
    const h = min(rest, HS);
    step(S, P, h);
    if (++S.nslow % SLOW === 0) slow(S, h * SLOW);
    rest -= h;
  }
}

function buildLut(S, hue) {
  const t = [0, 0, 0];
  for (let k = 0; k < 256; k++) {
    stopColour(k / 255, t);
    const [h, s, v] = hsvOf(t[0], t[1], t[2]);
    S.lut.set(rgbOf(h + hue, s, v), k * 3);
  }
  S.hueDone = hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = cl(S.knobs[0], 0, 1);
  if (S.hueDone !== hue) buildLut(S, hue);
  const { u, v, rb, rs, tmp, tmp2, lut } = S;
  // Chemotaxis shows in the picture straight away: the more it is, the dimmer the haze and the brighter the files.
  const k3 = cl(S.knobs[2], -1, 1), k4 = cl(S.knobs[3], -1, 1), gh = 1 - 0.55 * k3, gs = 1 + 0.45 * k3, gw = 0.75 + 0.4 * k4;
  splat(S, tmp2);
  blur(tmp2, rb, tmp, 2);
  blur(rb, rs, tmp, 3);
  for (let i = 0; i < N; i++) {
    const L = gh * 0.34 * (1 - exp(-rs[i] / 3)) + gs * 0.78 * (1 - exp(-max(0, rb[i] - 0.7) / 3.2));
    const w = gw * (u[i] + 0.5 * v[i] * (1 - u[i]));
    const s = cl(L * (1 + 0.9 * w) + 0.1 * w, 0, 1);
    const li = ((s * 255) | 0) * 3;
    display.setPixel(i % W, (i / W) | 0, lut[li], lut[li + 1], lut[li + 2]);
  }
}
