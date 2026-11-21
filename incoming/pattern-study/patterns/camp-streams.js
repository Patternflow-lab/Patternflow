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
const { floor, sqrt, pow, exp, log, sin, cos, atan2, PI, min, max, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

// ---- the excitable field (Barkley form): lengths in LEDs, time in seconds at Clock 2
const EPS = 0.05, FA = 0.84, FB = 0.07, DL = 1.9, TAUV = 1.0;
const HS = 0.03; // longest step
// ---- the cells
const NP = 8000, WT = N / NP; // cells, and the density one of them stands for (mean density 1)
const D0 = 0.03; // random walk, LED^2 a second
const CAP = 0.3; // longest chemotactic step, LEDs
const RP = 0.12; // push of crowding
const SLOW = 4; // steps between the slow fields
const WARM = 1500; // warm-up steps
// ---- trails
const KM = 3, BETA = 0.06, DMT = 0.14, GSRC = 1.4, REACH = 0.9; // the stream field: pull, fade, spread a tick, strength, LEDs a second the streams grow
// ---- pacemakers and mounds
const SHED = 1 / 45; // chance a second that a cell in a mound is let go
const NPM = 4, RMASS = 7, MFORM = 250, MBIG = 1000, FLY = 26;

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
    u: F(), v: F(), un: F(), vn: F(), gate: F(), phi: F(), gx: F(), gy: F(),
    rho: F(), rb: F(), rs: F(), tmp: F(), tmp2: F(), mt: F(), rgx: F(), rgy: F(),
    px: new Float32Array(NP), py: new Float32Array(NP), tx: new Float32Array(NP), ty: new Float32Array(NP), fly: new Uint8Array(NP), age: new Float32Array(NP), comp: new Float32Array(NP),
    lut: new Float32Array(256 * 3), hueDone: -1, knobs: [0, 2, 0, 0.06],
    nslow: 0, evK: 0, tm: 0, pm: [],
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

// every cell adds its weight to the four LEDs around it
function splat(S, out) {
  const { px, py } = S;
  out.fill(0);
  for (let p = 0; p < NP; p++) {
    const x = px[p], y = py[p], x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
    const xa = x0 >= W ? 0 : x0, xb = xa + 1 >= W ? 0 : xa + 1, ya = y0 >= H ? 0 : y0, yb = ya + 1 >= H ? 0 : ya + 1;
    const wa = WT * (1 - fx), wb = WT * fx;
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
const tor2 = (ax, ay, bx, by) => {
  const dx = wrapd(ax - bx, W), dy = wrapd(ay - by, H);
  return dx * dx + dy * dy;
};

// The streams of a mound: a few stems that leave it at even angles, bend slowly, and fork twice on the way out.
function buildTree(q) {
  const pts = [];
  const n0 = 7 + floor(Math.random() * 3), bend = (Math.random() < 0.5 ? -1 : 1) * (0.008 + 0.01 * Math.random());
  const walk = (x, y, th, len0, len1, depth, w) => {
    let wob = 0;
    for (let l = len0; l < len1; l += 1) {
      wob += (Math.random() - 0.5) * 0.05;
      wob *= 0.92;
      th += bend + wob * 0.2;
      x += cos(th);
      y += sin(th);
      pts.push(x, y, w * (1 - 0.35 * (l / 40)), l);
      if (depth < 2 && l > len0 + 6 && l < len1 - 8 && Math.random() < 0.045) {
        walk(x, y, th + (Math.random() < 0.5 ? -1 : 1) * (0.35 + 0.3 * Math.random()), l, len1 - 3 * Math.random() * 6, depth + 1, w * 0.85);
      }
    }
  };
  for (let k = 0; k < n0; k++) walk(q.x, q.y, (6.2832 * (k + 0.5 * Math.random())) / n0, 3, 20 + 18 * Math.random(), 0, 1);
  q.pts = Float32Array.from(pts);
}

// The next pacemaker starts a few LEDs from the old one, after a pause.
function newPacemaker(S, q, tm) {
  const a = 6.2832 * Math.random(), r = 5 + 8 * Math.random();
  const n = { x: (((q.x + r * cos(a)) % W) + W) % W, y: (((q.y + r * sin(a)) % H) + H) % H, born: tm, formed: -1, life: 110 + 80 * Math.random(), f: 0.92 + 0.3 * Math.random(), next: tm + 6 + 4 * Math.random(), mass: 0, pts: null };
  buildTree(n);
  return n;
}

// A mound culminates: most of its cells are thrown out round it as fresh cells.
function burst(S, q, tm) {
  const n = newPacemaker(S, q, tm);
  for (let p = 0; p < NP; p++) {
    if (S.fly[p]) continue;
    const dx = wrapd(S.px[p] - q.x, W), dy = wrapd(S.py[p] - q.y, H);
    if (dx * dx + dy * dy > RMASS * RMASS * 2.2 || Math.random() > 0.94) continue;
    const a = 6.2832 * Math.random(), r = 3 + 36 * sqrt(Math.random());
    S.tx[p] = ((((q.x + r * cos(a)) % W) + W) % W);
    S.ty[p] = ((((q.y + r * sin(a)) % H) + H) % H);
    S.fly[p] = 1;
  }
  // the old mound's trails go with it
  const R2 = 16 * 16;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (tor2(x, y, q.x, q.y) < R2) S.mt[y * W + x] = 0;
  S.pm[S.pm.indexOf(q)] = n;
}

// The slow fields: smoothed density, the pressure it pushes with, and the mounds' bookkeeping
function slow(S, dts) {
  const { rho, tmp, tmp2, mt, rgx, rgy, px, py } = S;
  splat(S, tmp2);
  blur(tmp2, rho, tmp, 2);
  // the stream field: the grown part of every tree is a source, which spreads and fades
  tmp2.fill(0);
  for (const q of S.pm) {
    const reach = (S.tm - q.born - 4) * REACH, pts = q.pts;
    for (let k = 0; k < pts.length; k += 4) {
      if (pts[k + 3] > reach) continue;
      const x = pts[k], y = pts[k + 1], w = pts[k + 2] * GSRC * dts;
      const xw = ((x % W) + W) % W, yw = ((y % H) + H) % H, x0 = floor(xw), y0 = floor(yw), fx = xw - x0, fy = yw - y0;
      const xa = x0, xb = (x0 + 1) % W, ya = y0, yb = (y0 + 1) % H;
      tmp2[ya * W + xa] += w * (1 - fx) * (1 - fy);
      tmp2[ya * W + xb] += w * fx * (1 - fy);
      tmp2[yb * W + xa] += w * (1 - fx) * fy;
      tmp2[yb * W + xb] += w * fx * fy;
    }
  }
  const dec = 1 - dts * BETA;
  for (let i = 0; i < N; i++) {
    const m = mt[i];
    tmp[i] = (m + DMT * (mt[XP[i]] + mt[XM[i]] + mt[YP[i]] + mt[YM[i]] - 4 * m)) * dec + tmp2[i];
  }
  mt.set(tmp);
  for (let i = 0; i < N; i++) {
    const a = rho[XP[i]], b = rho[XM[i]], c = rho[YP[i]], d = rho[YM[i]];
    const pa = a > 6 ? (a - 6) * (a - 6) : 0, pb = b > 6 ? (b - 6) * (b - 6) : 0, pc = c > 6 ? (c - 6) * (c - 6) : 0, pd = d > 6 ? (d - 6) * (d - 6) : 0;
    rgx[i] = 0.5 * (pa - pb);
    rgy[i] = 0.5 * (pc - pd);
  }
  for (const q of S.pm) {
    let m = 0;
    for (let p = 0; p < NP; p++) {
      const dx = wrapd(px[p] - q.x, W), dy = wrapd(py[p] - q.y, H);
      if (dx * dx + dy * dy < RMASS * RMASS) m++;
    }
    q.mass = m * WT;
    if (q.formed < 0 && q.mass > MFORM) q.formed = S.tm;
  }
  for (const q of S.pm) {
    const old = S.tm - q.born > q.life;
    if (old || q.mass > MBIG) {
      burst(S, q, S.tm);
      break;
    }
  }
}

function step(S, P, h) {
  const { u, v, un, vn, gate, phi, mt, gx, gy, px, py, fly, tx, ty, rgx, rgy, age, comp } = S;
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
  // the slope the cells climb: the wave, and the stream field in proportion to the wave
  for (let i = 0; i < N; i++) {
    const m = mt[i] > 1 ? 1 : mt[i];
    phi[i] = m;
  }
  for (let i = 0; i < N; i++) {
    gx[i] = 0.5 * (U[XP[i]] - U[XM[i]]) + KM * U[i] * 0.5 * (phi[XP[i]] - phi[XM[i]]);
    gy[i] = 0.5 * (U[YP[i]] - U[YM[i]]) + KM * U[i] * 0.5 * (phi[YP[i]] - phi[YM[i]]);
  }
  // the cells
  const sx = P.ch * h, sd = sqrt(6 * D0 * h), rpush = RP * h, fstep = FLY * h;
  for (let p = 0; p < NP; p++) {
    let x = px[p], y = py[p];
    if (fly[p]) {
      const dx = wrapd(tx[p] - x, W), dy = wrapd(ty[p] - y, H), d = sqrt(dx * dx + dy * dy);
      if (d <= fstep) {
        x = tx[p]; y = ty[p];
        fly[p] = 0;
      } else {
        x += (dx * fstep) / d;
        y += (dy * fstep) / d;
      }
    } else {
      let ix = (x + 0.5) | 0, iy = (y + 0.5) | 0;
      if (ix >= W) ix = 0;
      if (iy >= H) iy = 0;
      const c = iy * W + ix, ag = (age[p] += h), cw = 1, gt = gate[c];
      let vx = gt * sx * gx[c], vy = gt * sx * gy[c];
      const sp2 = vx * vx + vy * vy;
      if (sp2 > CAP * CAP) {
        const k = CAP / sqrt(sp2);
        vx *= k; vy *= k;
      }
      const sp = sqrt(sp2 > CAP * CAP ? CAP * CAP : sp2);
      vx += -rpush * rgx[c] + sd * (Math.random() * 2 - 1);
      vy += -rpush * rgy[c] + sd * (Math.random() * 2 - 1);
      x += vx; y += vy;
    }
    if (x < 0) x += W; else if (x >= W) x -= W;
    if (y < 0) y += H; else if (y >= H) y -= H;
    px[p] = x; py[p] = y;
  }
}

function seedField(S) {
  const { px, py } = S;
  const spots = [[18, 26], [46, 58], [14, 94], [44, 116]];
  for (let k = 0; k < NPM; k++) {
    const [x, y] = spots[k];
    S.pm.push({ x, y, born: -70 * Math.random(), formed: -1, life: 110 + 80 * Math.random(), f: 0.92 + 0.3 * Math.random(), next: Math.random() * 4, mass: 0, pts: null });
    buildTree(S.pm[S.pm.length - 1]);
  }
  const clump = 0.08;
  for (let p = 0; p < NP; p++) {
    if (Math.random() < clump) {
      const q = S.pm[p % NPM];
      const g1 = Math.random() + Math.random() + Math.random() - 1.5, g2 = Math.random() + Math.random() + Math.random() - 1.5;
      px[p] = (((q.x + g1 * 6) % W) + W) % W;
      py[p] = (((q.y + g2 * 6) % H) + H) % H;
      S.age[p] = 300;
    } else {
      px[p] = Math.random() * W;
      py[p] = Math.random() * H;
      S.age[p] = 100 * Math.random();
    }
    S.comp[p] = 8 + 70 * Math.random();
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
  const { u, rb, rs, tmp, tmp2, lut, mt } = S;
  splat(S, tmp2);
  blur(tmp2, rb, tmp, 2);
  blur(rb, rs, tmp, 3);
  for (let i = 0; i < N; i++) {
    const L = 0.55 * (1 - exp(-rs[i] / 4)) + 0.6 * (1 - exp(-max(0, rb[i] - 1.7) / 2.4));
    const w = u[i];
    const s = cl((L + 0.1 * mt[i] / (mt[i] + 1)) * (1 + 0.7 * w) + 0.05 * w, 0, 1);
    const li = ((s * 255) | 0) * 3;
    display.setPixel(i % W, (i / W) | 0, lut[li], lut[li + 1], lut[li + 2]);
  }
}
