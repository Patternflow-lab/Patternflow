// ===== Patternflow pattern =====
// Title:   Yee Diagram
// Family:  socialchoice
// Idea:    Every pixel is the centre of a Gaussian crowd of voters who rank four to six wandering candidates by distance, and the pixel takes the colour of the candidate that wins the election under a positional scoring rule, so the regions are plain Voronoi cells while the crowd is tight and, as it widens and the rule slides from plurality through Borda to anti-plurality, they crowd toward the middle candidates and swallow the ones that split the vote.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Yee diagram of voting rules (Ka-Ping Yee, 2005, from memory), with the Borda count (Jean-Charles de Borda, 1770, from memory) and plurality, which this pattern joins in one family of positional weights ((N-1-k)/(N-1))^p; the nested sunflower crowd with soft ranks, the candidates that push each other apart and slide in from outside the panel, the margin shading and the ripples are original, pattern round 251
// Round:   251
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spread=0..4, Rule=-1..1, Field=-1..1
//
// Knob 1: Hue. Turns the candidate colours round the wheel together; it opens on teal, amber, violet and rose, and each colour also wanders a little round its own hue.
// Knob 2: Spread. 0 to 4, opening at 2. How wide each pixel's crowd of voters is, from 6 LED, where every region is the plain Voronoi cell of its candidate, through 26 LED at the start to 42 LED, where the crowds overlap, the borders blur and the regions merge and turn over; the crowd also breathes by a fifth either way on its own.
// Knob 3: Rule. -1 to 1, opening at 0. The exponent p in the weight ((N-1-k)/(N-1))^p a voter gives its candidate of rank k: plurality at 1 (p = 20), Borda at 0 (p = 1), anti-plurality at -1 (p = 0.2), where only the last place counts against a candidate; the rule also leans a little either way on its own.
// Knob 4: Field. -1 to 1, opening at about 0.06. How many candidates stand, three at -1, four at the start, six at 1; the next one slides in from outside the panel as the knob passes each whole number and its region is pushed in with it.

const W = 64, H = 128;
const NX = 33, NY = 65, NN = NX * NY;          // score nodes, every 2 LED at the finest, upsampled to the LEDs
const NC = 6;                                   // candidate slots
const SOFT = 1.0;
const RIPA = 0.16, RIPL = 20, RIPF = 0.13;       // ripples of light that leave each candidate across its own region
const TAUH = 0.14;                              // how fast the pull of the other candidates on a pixel's hue dies away with their margin
const IRID = 0.03;                              // hue shift of the two light waves that cross the panel, so no region is one flat colour
const HTURN = 0.002;                            // and turns once round the wheel in eight minutes
const HSWAY = 0.04;                              // the whole palette sways this far round the wheel and back
const SPRING = 1.6, DAMP = 2.5, REPEL = 30, REPEL_R = 36;   // the candidates' spring, damping, push and reach
const HDRIFT = 0.06;                            // how far each candidate's colour wanders round its own hue
const VBUDGET = 1.03e7;                         // flops a full pass over the nodes may cost
const MV = 160;                                 // most voters in a crowd, in mirrored pairs
const { floor, min, max, abs, sqrt, exp, log, sin, cos, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();

const hv = [0, 0, 0];
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// candidate hues at Hue = 0: teal, amber, violet, rose, green, magenta; slots in this order stand far apart on the wheel
const CHUE = [0.5, 0.11, 0.76, 0.96, 0.3, 0.87];
const SAT = 0.7, LUMA = 0.76, FLOOR = 0.45, GLOW = 30;
// where each slot lives, the half-sweep of its drift and where it slides in from
const HOMEX = [26, 38, 32, 24, 40, 32], HOMEY = [44, 84, 64, 78, 50, 64];
const AMPX = [22, 22, 24, 22, 22, 24], AMPY = [36, 36, 54, 46, 42, 54];
const FROMX = [0, 0, 0, 240, -150, 32], FROMY = [0, 0, 0, 64, -150, 330];
// the hue step from slot a to slot b by the short way round, so a seam between two colours never turns the long way
const DH = [];
for (let a = 0; a < NC; a++) for (let b = 0; b < NC; b++) { let d = CHUE[b] - CHUE[a]; d -= Math.round(d); DH.push(d); }
// brightness that evens out the hues: yellow and green are dimmed toward blue
const FH = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const h = (i / 256 - floor(i / 256)) * 6, f = h - floor(h), q = 1 - f * SAT, t = 1 - (1 - f) * SAT, k = floor(h) % 6, p0 = 1 - SAT;
  const r = k === 0 || k === 5 ? 1 : k === 1 ? q : k === 4 ? t : p0, g = k === 1 || k === 2 ? 1 : k === 0 ? t : k === 3 ? q : p0, b2 = k === 3 || k === 4 ? 1 : k === 2 ? t : k === 5 ? q : p0;
  FH[i] = min(1, pow(LUMA / (0.299 * r + 0.587 * g + 0.114 * b2), 0.75));
}

export function setup(params) {
  // the crowd: nested low-discrepancy points of a Gaussian, each followed by its mirror image, so any even prefix of
  // them is a fair crowd and the number of voters can follow the cost
  const gx = new Float64Array(MV), gy = new Float64Array(MV);
  for (let j = 0; j < MV / 2; j++) {
    const ux = 0.5 + j * 0.7548776662466927, uy = 0.5 + j * 0.5698402909980532;
    const r = sqrt(-2 * log(1 - 0.985 * (ux - floor(ux)))), a = TP * (uy - floor(uy));
    gx[2 * j] = r * cos(a); gy[2 * j] = r * sin(a);
    gx[2 * j + 1] = -gx[2 * j]; gy[2 * j + 1] = -gy[2 * j];
  }
  // drift frequencies: fractional parts of square roots of primes, so no two ever line up
  const PR = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89];
  const fr = PR.map((p) => TP * (0.009 + 0.016 * (sqrt(p) - floor(sqrt(p)))));
  const ph = [];
  for (let i = 0; i < 24; i++) ph.push(rnd() * TP);
  const hf = [], hp = [];
  for (let k = 0; k < NC; k++) { hf.push(TP * (0.010 + 0.010 * (sqrt(PR[k] + 100) - floor(sqrt(PR[k] + 100))))); hp.push(rnd() * TP); }
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, tau: 0,
    gx, gy, fr, ph, hf, hp,
    cx: new Float64Array(NC), cy: new Float64Array(NC), pres: new Float64Array(NC), hd: new Float64Array(NC),
    px: new Float64Array(NC), py: new Float64Array(NC), vx: new Float64Array(NC), vy: new Float64Array(NC), tx: new Float64Array(NC), ty: new Float64Array(NC), placed: false,
    W: new Float64Array(NC + 1), ip: new Float64Array(NC * NC), ns: 2, nx: NX, ny: NY, wd: 1, par: 0, lastNs: 0, lastN: 0,
    S: new Float32Array(NN * NC), win: new Uint8Array(NN),
    d: new Float64Array(NC), rk: new Int32Array(NC), s: new Float64Array(NC),
    n: 4, mv: 24,
  });
  return st;
}

// Each candidate is pulled by a spring toward its own slow Lissajous target and pushed off the others, so they cross
// the whole panel and sometimes crowd together but never sit on top of one another: two candidates on the same spot
// would split the vote by a coin toss and flicker.
function place(st, dt) {
  const tau = st.tau, F = st.F;
  const px = st.px, py = st.py, vx = st.vx, vy = st.vy, tx = st.tx, ty = st.ty;
  for (let k = 0; k < NC; k++) {
    const i = k * 4;
    const sx = 0.62 * sin(st.fr[i] * tau + st.ph[i]) + 0.38 * sin(st.fr[i + 1] * tau + st.ph[i + 1]);
    const sy = 0.62 * sin(st.fr[i + 2] * tau + st.ph[i + 2]) + 0.38 * sin(st.fr[i + 3] * tau + st.ph[i + 3]);
    tx[k] = HOMEX[k] + AMPX[k] * sx; ty[k] = HOMEY[k] + AMPY[k] * sy;
    const a = k < 3 ? 1 : cl(F - k, 0, 1);
    st.pres[k] = a * a * (3 - 2 * a);
    st.hd[k] = HDRIFT * (0.6 * sin(st.hf[k] * tau + st.hp[k]) + 0.4 * sin(st.hf[k] * 1.618 * tau + st.hp[k] * 2.3));
    if (!st.placed) { px[k] = tx[k]; py[k] = ty[k]; vx[k] = 0; vy[k] = 0; }
  }
  if (!st.placed) {
    // the first frame starts from candidates that have already pushed each other apart
    for (let s = 0; s < 80; s++) {
      for (let k = 0; k < NC; k++) for (let l = 0; l < NC; l++) {
        if (l === k) continue;
        let dx = px[k] - px[l], dy = py[k] - py[l], d = Math.hypot(dx, dy);
        if (d >= REPEL_R) continue;
        if (d < 0.05) { dx = cos(k * 2.4 + l); dy = sin(k * 2.4 + l); d = 1; }
        const f = 0.5 * (1 - d / REPEL_R) / d * 1.5;
        px[k] = cl(px[k] + dx * f, 4, 60); py[k] = cl(py[k] + dy * f, 4, 124);
      }
    }
  }
  st.placed = true;
  const steps = Math.max(1, Math.ceil(dt / 0.02)), h = dt / steps;
  for (let s = 0; s < steps && dt > 0; s++) {
    for (let k = 0; k < NC; k++) {
      let ax = SPRING * (tx[k] - px[k]) - DAMP * vx[k], ay = SPRING * (ty[k] - py[k]) - DAMP * vy[k];
      for (let l = 0; l < NC; l++) {
        if (l === k) continue;
        let dx = px[k] - px[l], dy = py[k] - py[l];
        let d = Math.hypot(dx, dy);
        if (d >= REPEL_R) continue;
        if (d < 0.05) { dx = cos(k * 2.4 + l); dy = sin(k * 2.4 + l); d = 1; }
        const f = REPEL * (1 - d / REPEL_R) * st.pres[l] * st.pres[k] / d;
        ax += dx * f; ay += dy * f;
      }
      vx[k] += ax * h; vy[k] += ay * h;
    }
    for (let k = 0; k < NC; k++) {
      px[k] = cl(px[k] + vx[k] * h, 4, 60); py[k] = cl(py[k] + vy[k] * h, 4, 124);
    }
  }
  for (let k = 0; k < NC; k++) {
    const o = (1 - st.pres[k]) * (1 - st.pres[k]);
    st.cx[k] = px[k] + (FROMX[k] - px[k]) * o;
    st.cy[k] = py[k] + (FROMY[k] - py[k]) * o;
  }
  st.n = F > 5 ? 6 : F > 4 ? 5 : F > 3 ? 4 : 3;
  let neff = 3;
  for (let k = 3; k < NC; k++) neff += st.pres[k];
  st.neff = neff;
}

// the crowd centred on (X, Y) ranks the candidates by distance and each voter gives its candidate of rank r the
// weight w[r]. A voter's ranking flips on the bisector of two candidates; the flip is spread over a soft band so
// that a crowd of a few dozen voters does not leave a staircase of steps. The scores of the n candidates land in s.
function scoreAt(st, X, Y, s) {
  const n = st.n, sg = st.sg, wd = st.wd;
  const w = st.W, gx = st.gx, gy = st.gy, cx = st.cx, cy = st.cy, d = st.d, rk = st.rk, ip = st.ip;
  for (let k = 0; k < n; k++) s[k] = 0;
  for (let v = 0; v < st.mv; v++) {
    const px = X + sg * gx[v], py = Y + sg * gy[v];
    for (let k = 0; k < n; k++) { const dx = px - cx[k], dy = py - cy[k]; d[k] = dx * dx + dy * dy; rk[k] = 0; }
    for (let k = 0; k < n; k++) {
      for (let l = k + 1; l < n; l++) {
        let u = 0.5 + (d[k] - d[l]) * ip[k * NC + l] / wd;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        u = u * u * (3 - 2 * u);
        rk[k] += u; rk[l] += 1 - u;
      }
    }
    for (let k = 0; k < n; k++) { const r = rk[k], i = r | 0; s[k] += w[i] + (r - i) * (w[i + 1] - w[i]); }
  }
}

function score(st) {
  const n = st.n, neff = st.neff, p = st.p;
  const w = st.W, cx = st.cx, cy = st.cy, ip = st.ip;
  for (let r = 0; r <= NC; r++) w[r] = r < n ? pow(max(0, (neff - 1 - r) / (neff - 1)), p) : 0;
  for (let k = 0; k < n; k++) for (let l = k + 1; l < n; l++) {
    ip[k * NC + l] = 0.5 / max(2, Math.hypot(cx[k] - cx[l], cy[k] - cy[l]));
  }
  st.wd = SOFT * st.sg + 0.8;
  const ns = st.ns, nx = st.nx, ny = st.ny;
  const S = st.S, s = st.s, win = st.win;
  // half of the nodes, in a checkerboard, are recomputed each frame; the drift is slow enough that the other half,
  // one frame old, is not seen. A new node grid or candidate count recomputes all of them.
  const all = ns !== st.lastNs || n !== st.lastN || st.mv !== st.lastMv;
  st.lastNs = ns; st.lastN = n; st.lastMv = st.mv; st.par ^= 1;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!all && ((i + j) & 1) !== st.par) continue;
      scoreAt(st, ns * i, ns * j, s);
      const o = (j * nx + i) * NC;
      let b = 0;
      for (let k = 0; k < NC; k++) { S[o + k] = k < n ? s[k] : 0; if (S[o + k] > S[o + b]) b = k; }
      win[j * nx + i] = b;
    }
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
  } else {
    const a = 1 - exp(-dt / 0.12);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  st.tau += dt;
  const k2 = cl(st.ks[1], 0, 4), k3 = cl(st.ks[2], -1, 1), k4 = cl(st.ks[3], -1, 1);
  const tau = st.tau;
  // the crowd breathes and the rule leans a little either way on its own, so no two minutes hold the same election
  st.sg = (6 + 10 * k2 - 0.25 * k2 * k2) * (1 + 0.22 * sin(0.0743 * tau + st.ph[0]) + 0.1 * sin(0.1297 * tau + st.ph[5]));   // 6 LED, 26 at the opening, 42
  st.p = (k3 >= 0 ? pow(20, k3) : pow(0.2, -k3)) * exp(0.8 * sin(0.0587 * tau + st.ph[9]));                                    // 0.2, 1 at 0, 20
  st.F = k4 < 0.06 ? 3 + (k4 + 1) / 1.06 : 4 + 2 * (k4 - 0.06) / 0.94;
  st.ns = cl(Math.round(st.sg / 3.5), 2, 6);
  st.nx = floor(63 / st.ns) + 2; st.ny = floor(127 / st.ns) + 2;
  place(st, dt);
  const nodes = st.nx * st.ny, nn = st.n;
  st.mv = cl(2 * floor(VBUDGET / (nodes * (nn * (nn - 1) * 5 + nn * 8)) / 2), 24, MV);
  score(st);
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const S = st.S, n = st.n, win = st.win, sc = st.sd || (st.sd = new Float64Array(NC));
  const hue = fin(st.ks[0], 0) + HTURN * st.tau + HSWAY * (0.65 * sin(0.0331 * st.tau + st.ph[3]) + 0.35 * sin(0.0817 * st.tau + st.ph[7]));
  const buf = st.buf || (st.buf = new Float32Array(W * H * 3));
  const ns = st.ns, nx = st.nx, pres = st.pres;
  // two travelling waves of hue, each the product form sin(a x + b y + c t) split into a column and a row table
  const wa = st.wa || (st.wa = new Float64Array(4 * W)), wb = st.wb || (st.wb = new Float64Array(4 * H));
  const t0 = st.tau;
  for (let x = 0; x < W; x++) {
    wa[4 * x] = sin(0.052 * x); wa[4 * x + 1] = cos(0.052 * x); wa[4 * x + 2] = sin(-0.019 * x); wa[4 * x + 3] = cos(-0.019 * x);
  }
  for (let y = 0; y < H; y++) {
    const p1 = 0.023 * y + 0.083 * t0 + st.ph[11], p2 = 0.041 * y - 0.061 * t0 + st.ph[13];
    wb[4 * y] = sin(p1); wb[4 * y + 1] = cos(p1); wb[4 * y + 2] = sin(p2); wb[4 * y + 3] = cos(p2);
  }
  for (let y = 0; y < H; y++) {
    const jf = y / ns, j = floor(jf), fy = jf - j;
    for (let x = 0; x < W; x++) {
      const ifl = x / ns, i = floor(ifl), fx = ifl - i;
      const g00 = j * nx + i;
      let b = -1, s1 = -1, s2 = -1, tot = 0, wt = 0;
      const exact = ns === 2 && (fx > 0 || fy > 0) && !(win[g00] === win[g00 + 1] && win[g00] === win[g00 + nx] && win[g00] === win[g00 + nx + 1]);
      if (!exact) {
        const o00 = g00 * NC, o10 = o00 + NC, o01 = o00 + nx * NC, o11 = o01 + NC;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        for (let k = 0; k < n; k++) sc[k] = S[o00 + k] * w00 + S[o10 + k] * w10 + S[o01 + k] * w01 + S[o11 + k] * w11;
      } else scoreAt(st, x, y, sc);
      for (let k = 0; k < n; k++) {
        const v = sc[k];
        tot += v * pres[k]; wt += pres[k];
        if (v > s1) { s2 = s1; s1 = v; b = k; } else if (v > s2) s2 = v;
      }
      const mean = tot / wt;
      const m = (s1 - s2) / max(1e-6, s1 - mean);
      const t = sstep(0, 0.5, m);
      // interior: deep colour, brighter close to its candidate; edge: pale, turned halfway toward the runner-up
      const e = 1 - t, e2 = e * e;
      const dx = x + 0.5 - st.cx[b], dy = y + 0.5 - st.cy[b];
      const dd = dx * dx + dy * dy;
      const dv = (FLOOR + (1 - FLOOR) * exp(-dd / (GLOW * GLOW))) * (1 - RIPA * t * (0.5 + 0.5 * cos(TP * (sqrt(dd) / RIPL - RIPF * st.tau))));
      const ir = IRID * (wa[4 * x] * wb[4 * y + 1] + wa[4 * x + 1] * wb[4 * y] + 0.8 * (wa[4 * x + 2] * wb[4 * y + 3] + wa[4 * x + 3] * wb[4 * y + 2]));
      // the hue leans toward the other candidates by their softmax weight, so a border between the second and the
      // third place of a pixel does not show as a seam in the colour
      let dm = 0;
      if (m < 0.9) {
        const T = TAUH * max(1e-6, s1 - mean);
        let z = 1, a = 0;
        for (let k = 0; k < n; k++) {
          if (k === b) continue;
          const wk = exp((sc[k] - s1) / T);
          z += wk; a += wk * (DH[b * NC + k] + st.hd[k] - st.hd[b]);
        }
        dm = a / z;
      }
      const h = hue + ir + CHUE[b] + st.hd[b] + dm;
      const hh = h - floor(h);
      hsv(h, SAT + (0.3 - SAT) * e2, (dv + (1 - dv) * e2) * FH[((hh * 256) | 0) & 255], hv);
      const q = (y * W + x) * 3;
      buf[q] = hv[0] * 255; buf[q + 1] = hv[1] * 255; buf[q + 2] = hv[2] * 255;
    }
  }
  // the candidates: a bright ring with a dark rim
  for (let k = 0; k < n; k++) {
    const e = st.pres[k];
    if (e < 0.02) continue;
    const cx = st.cx[k], cy = st.cy[k];
    const x0 = max(0, floor(cx - 8)), x1 = min(W - 1, floor(cx + 8)), y0 = max(0, floor(cy - 8)), y1 = min(H - 1, floor(cy + 8));
    hsv(hue + CHUE[k] + st.hd[k], 0.3, 1, hv);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const r = sqrt((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy));
      const ring = cl(1.7 - abs(r - 3.3) * 1.0, 0, 1) * e;
      const dark = cl((6.4 - r) * 0.8, 0, 1) * e;
      if (dark <= 0) continue;
      const q = (y * W + x) * 3;
      const kd = 1 - 0.75 * dark;
      buf[q] = buf[q] * kd + (hv[0] * 255 - buf[q] * kd) * ring;
      buf[q + 1] = buf[q + 1] * kd + (hv[1] * 255 - buf[q + 1] * kd) * ring;
      buf[q + 2] = buf[q + 2] * kd + (hv[2] * 255 - buf[q + 2] * kd) * ring;
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const q = (y * W + x) * 3;
    display.setPixel(x, y, floor(cl(buf[q], 0, 255)), floor(cl(buf[q + 1], 0, 255)), floor(cl(buf[q + 2], 0, 255)));
  }
}
