// ===== Patternflow pattern =====
// Title:   Neal's Funnel
// Family:  sampler
// Idea:    Sixteen Hamiltonian Monte Carlo chains swing leapfrog arcs through Neal's funnel, a tall trumpet that is a needle at the top and fills the panel at the bottom, and the samples they accept pile up into a glowing heat map while any trajectory whose step is too big for the neck blows up in a red-white burst.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Neal's funnel (Radford Neal, "Slice sampling", 2003), Hybrid Monte Carlo (Simon Duane, A. D. Kennedy, Brian Pendleton and Duncan Roweth, 1987), the leapfrog integrator, divergent transitions as the sign of funnel geometry (Michael Betancourt), pattern round 224
// Round:   224
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Step=0..4, Length=-1..1, Depth=-1..1
//
// Knob 1: Hue. Turns the heat ramp round the wheel; at 0 it runs from deep violet through magenta and red-orange to white-hot, the arcs are cyan-white and a divergence burst is red-white, and the arcs and the burst turn with the ramp so the three stay a complementary set.
// Knob 2: Step. The leapfrog step size epsilon, 0.012 at 0, 0.11 at the opening 2 and 0.5 at 4. Small steps make short arcs and chains that crawl and never reach the neck; at 2 the arcs swing across the funnel and the neck is reached now and then; near 4 the step is too big for any row above the middle of the neck and the top of the panel fills with red-white bursts and stuck chains.
// Knob 3: Length. The leapfrog steps in one trajectory, 10 at -1, 32 at the opening 0 and 100 at 1, at about 45 steps a second per chain. Short trajectories are small hops that leave the chains close together; long ones are arcs that run from the middle to the edge of the mouth and bring a chain to a new place every second.
// Knob 4: Depth. The spread of the log-scale variable v of the funnel, 1.9 at -1, 3.0 at the opening and 4.7 at 1. At -1 the samples gather in the waist and the neck and the mouth stay dark; at 1 they reach the top needle and the wide bottom, and the bottom of the panel fills.

// The target is Neal's funnel: v ~ Normal(0, sv) and x given v ~ Normal(0, exp(v / 2)), so the cloud is as
// wide as exp(v / 2) at height v. The panel shows v down the 128 rows, the needle at the top, and x across.
// The real funnel is far too steep for 64 LEDs (it is 665 times wider at v = +6.5 than at v = -6.5), so x is
// drawn with a per-row scale A(v) = AA exp(-GAM v / 2) that keeps the funnel a trumpet whose standard
// deviation is 2.4 LEDs at the top row and 15 at the bottom. Dynamics and density are the true ones; only
// the drawing scale of x is changed.
//
// Sixteen chains run leapfrog at about 45 steps a second each, with a fresh Normal momentum for every
// trajectory and a Metropolis test on the energy error at its end. Every state the chains accept is splatted
// into a float buffer that fades with a 25 second time constant; the picture is that buffer, log tone-mapped,
// with the arcs of the trajectories on top. A trajectory whose energy error passes DIV stops where it is and
// bursts: the leapfrog was too coarse for the neck there. Two slow sines breathe sv, and two more tilt the
// neck left and right, so the target never settles and the picture does not come back.

const W = 64;
const H = 128;
const MID = 32;
const VLO = -6.5;
const VHI = 6.5;
const VR = VHI - VLO;
const YTOP = 2.5;
const YSPAN = 123;
const GAM = 0.712;
const AA = 6;
const NCH = 16;
const TR = 128;
const NB = 32;
const TAU_D = 25;
const TAU_A = 0.4;
const DIV = 50;
const STUCK = 12;
const PRERUN = 60;
const SIG = 1.5;
const R_ARC = 4.5;

const sqrt = Math.sqrt, exp = Math.exp, log = Math.log, abs = Math.abs, min = Math.min, max = Math.max, floor = Math.floor;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function rnd(S) {
  let t = (S.seed = (S.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss(S) {
  return sqrt(-2 * log(1 - rnd(S))) * Math.cos(6.283185307179586 * rnd(S));
}

function hsv(h, s, v) {
  h = h - floor(h);
  const i = floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  return [
    k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v,
    k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p,
    k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q,
  ];
}

// The heat ramp: violet at the cold end, through magenta and red, to orange and then white. The hue
// offset is the knob plus 0.76 so that knob 0 opens on violet and not on red.
function buildPalette(S) {
  const h0 = 0.76 + S.hue;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const val = Math.pow(min(1, t / 0.7), 0.9);
    const sat = 1 - 0.92 * sm(0.8, 1.0, t);
    const c = hsv(h0 + 0.36 * (0.4 * t + 0.6 * t * t), sat, val);
    S.pal[i * 3] = c[0] * 255;
    S.pal[i * 3 + 1] = c[1] * 255;
    S.pal[i * 3 + 2] = c[2] * 255;
  }
  S.arc = hsv(h0 - 0.26, 0.8, 1).map((v) => v * 255);
  S.red = hsv(h0 + 0.24, 0.95, 1).map((v) => v * 255);
}

// Value and gradient of the funnel's potential U = -log p at (x, v). The funnel axis is not the line x = 0:
// it is bent by a tilt that is zero at the bottom row and grows toward the needle, so the neck sways while
// the mouth stays in the middle. The tilt D is in LEDs on the panel; c(v) is the same bend in x units.
let GX = 0;
let GV = 0;
function potential(S, x, v) {
  const e = exp(-v);
  const s = (VHI - v) / VR;
  let f = 0;
  let df = 0;
  if (s >= 1) f = 1;
  else if (s > 0) {
    f = s * s;
    df = (-2 * s) / VR;
  }
  const k = (S.tilt * exp(0.5 * GAM * v)) / AA;
  const u = x - k * f;
  const ue = u * e;
  const dc = k * (df + 0.5 * GAM * f);
  GX = ue;
  GV = v * S.isv2 + 0.5 - dc * ue - 0.5 * u * ue;
  return 0.5 * v * v * S.isv2 + 0.5 * v + 0.5 * u * ue;
}

function axisX(S, v) {
  const s = (VHI - v) / VR;
  const f = s >= 1 ? 1 : s > 0 ? s * s : 0;
  return (S.tilt * exp(0.5 * GAM * v) * f) / AA;
}

function screenX(x, v) {
  return MID + AA * exp(-0.5 * GAM * v) * x;
}
function screenY(v) {
  return YTOP + ((v - VLO) / VR) * YSPAN;
}

// A new chain starts from an exact draw of the funnel, so every row gets chains, wide at the mouth too.
function seedChain(S, i) {
  const v = cl(S.sv * gauss(S), -6.3, 6.3);
  S.life[i] = 18 + 30 * rnd(S);
  S.cv[i] = v;
  S.cx[i] = axisX(S, v) + gauss(S) * exp(0.5 * v);
  S.st[i] = -1;
  S.rej[i] = 0;
  S.acc[i] = rnd(S) * 3;
}

function pushPoint(S, i, sx, sy, brk) {
  const k = i * TR + S.th[i];
  S.tx[k] = sx;
  S.ty[k] = sy;
  S.tt[k] = S.t;
  S.tw[k] = 1;
  S.tb[k] = brk;
  S.th[i] = (S.th[i] + 1) % TR;
  if (S.tn[i] < TR) S.tn[i]++;
}

function addBurst(S, sx, sy) {
  let slot = 0;
  let oldest = -1;
  for (let b = 0; b < NB; b++) {
    if (S.bage[b] > oldest) {
      oldest = S.bage[b];
      slot = b;
    }
  }
  S.bx[slot] = cl(sx, 2, W - 3);
  S.by[slot] = cl(sy, 2, H - 3);
  S.bage[slot] = 0;
}

function splat(D, sx, sy, w) {
  if (sx < -4 || sx > W + 4 || sy < -4 || sy > H + 4) return;
  const ix = Math.round(sx - 0.5) - 4;
  const iy = Math.round(sy - 0.5) - 4;
  const gx = SPX;
  const gy = SPY;
  for (let j = 0; j < 9; j++) {
    const dx = ix + j + 0.5 - sx;
    const dy = iy + j + 0.5 - sy;
    gx[j] = exp((-dx * dx) / (2 * SIG * SIG));
    gy[j] = exp((-dy * dy) / (2 * SIG * SIG)) * w;
  }
  for (let j = 0; j < 9; j++) {
    const y = iy + j;
    if (y < 0 || y >= H) continue;
    const row = y * W;
    for (let l = 0; l < 9; l++) {
      const x = ix + l;
      if (x >= 0 && x < W) D[row + x] += gx[l] * gy[j];
    }
  }
}
const SPX = new Float32Array(9);
const SPY = new Float32Array(9);

// A sample far up or down in v is rare, so the ends of the funnel would stay dark however long it ran.
// Each one is weighted by about 0.6 of how rare its row is for a spread of 3 (at most 4 times), which keeps
// the mouth and the needle on the panel without flattening the waist. The weight does not follow the Depth
// knob, so turning Depth down still thins the ends.
function rare(S, v) {
  const z = v / 3;
  return min(4, exp(0.3 * z * z));
}

function beginTrajectory(S, i) {
  S.px[i] = gauss(S);
  S.pv[i] = gauss(S);
  S.qx[i] = S.cx[i];
  S.qv[i] = S.cv[i];
  const U = potential(S, S.qx[i], S.qv[i]);
  S.gx[i] = GX;
  S.gv[i] = GV;
  S.h0[i] = U + 0.5 * (S.px[i] * S.px[i] + S.pv[i] * S.pv[i]);
  S.eps[i] = S.epsK * (0.8 + 0.4 * rnd(S));
  S.len[i] = max(4, Math.round(S.lenK * (0.8 + 0.4 * rnd(S))));
  S.st[i] = 0;
  pushPoint(S, i, screenX(S.qx[i], S.qv[i]), screenY(S.qv[i]), 1);
}

// The trajectory is over, accepted or not. The next one starts from wherever the chain now stands.
function endTrajectory(S, i, accepted, diverged) {
  const n = S.st[i] + 1;
  S.stat[0]++;
  if (accepted) S.stat[1]++;
  if (diverged) S.stat[2]++;
  if (accepted) {
    S.cx[i] = S.qx[i];
    S.cv[i] = S.qv[i];
    S.rej[i] = 0;
    // The end state counts as a sample; the states on the way count a little, so the map is filled
    // along the arcs and not only where they stop.
    let k = (S.th[i] + TR - 1) % TR;
    splat(S.D, S.tx[i * TR + k], S.ty[i * TR + k], rare(S, S.cv[i]));
    for (let j = 1; j < n - 1; j += 2) {
      k = (S.th[i] + TR - 1 - j) % TR;
      splat(S.D, S.tx[i * TR + k], S.ty[i * TR + k], 0.12 * rare(S, S.cv[i]));
    }
  } else {
    S.rej[i]++;
    // A rejected move repeats the old sample, as it does in the real chain, and the arc fades faster.
    splat(S.D, screenX(S.cx[i], S.cv[i]), screenY(S.cv[i]), (diverged ? 0.35 : 0.6) * rare(S, S.cv[i]));
    for (let j = 0; j < n && j < TR; j++) S.tw[i * TR + ((S.th[i] + TR - 1 - j) % TR)] = 0.45;
  }
  S.st[i] = -1;
  if (S.rej[i] >= STUCK || abs(S.cv[i]) > 8.5 || S.life[i] < 0) seedChain(S, i);
}

function stepChain(S, i) {
  if (S.st[i] < 0) beginTrajectory(S, i);
  const e = S.eps[i];
  let px = S.px[i] - 0.5 * e * S.gx[i];
  let pv = S.pv[i] - 0.5 * e * S.gv[i];
  const qx = S.qx[i] + e * px;
  const qv = S.qv[i] + e * pv;
  const U = potential(S, qx, qv);
  px -= 0.5 * e * GX;
  pv -= 0.5 * e * GV;
  const dH = U + 0.5 * (px * px + pv * pv) - S.h0[i];
  if (!(dH < DIV) || !(abs(qv) < 60)) {
    // The step was too coarse for this part of the neck: stop where it stood and burst there.
    const k = i * TR + ((S.th[i] + TR - 1) % TR);
    addBurst(S, S.tx[k], S.ty[k]);
    endTrajectory(S, i, false, true);
    S.acc[i] = -0.3 * S.rate[i];
    return;
  }
  S.px[i] = px;
  S.pv[i] = pv;
  S.qx[i] = qx;
  S.qv[i] = qv;
  S.gx[i] = GX;
  S.gv[i] = GV;
  S.st[i]++;
  pushPoint(S, i, screenX(qx, qv), screenY(qv), 0);
  if (S.st[i] >= S.len[i]) {
    const ok = dH <= 0 || rnd(S) < exp(-dH);
    endTrajectory(S, i, ok, false);
  }
}

function advance(S, dt) {
  S.t += dt;
  const D = S.D;
  const f = exp(-dt / TAU_D);
  for (let p = 0; p < D.length; p++) {
    const d = D[p] * f;
    D[p] = d < 1e-6 ? 0 : d;
  }
  // The target breathes: its spread in v and the tilt of the neck follow slow sines that do not share
  // a period.
  const t = S.t;
  S.sv = S.svK * (1 + 0.16 * Math.sin(0.093 * t + 0.9) + 0.1 * Math.sin(0.0413 * t + 2.3));
  S.isv2 = 1 / (S.sv * S.sv);
  S.tilt = 6.5 * Math.sin(0.0337 * t + 0.3) + 4 * Math.sin(0.0143 * t + 1.9) + 1.5 * Math.sin(0.071 * t + 4.1);
  for (let i = 0; i < NCH; i++) {
    S.life[i] -= dt;
    S.acc[i] += dt * S.rate[i];
    while (S.acc[i] >= 1) {
      S.acc[i] -= 1;
      stepChain(S, i);
    }
  }
  for (let b = 0; b < NB; b++) if (S.bage[b] < 2) S.bage[b] += dt;
}

export function setup(params) {
  const S = (params.s = {
    seed: 0x5eed224,
    t: 0,
    hue: 0,
    hueKey: -1,
    epsK: 0.13,
    lenK: 32,
    svK: 3,
    sv: 3,
    isv2: 0.111,
    tilt: 0,
    gain: 1,
    lgain: 0,
    frame: 0,
    ready: false,
    D: new Float32Array(W * H),
    out: new Float32Array(W * H * 3),
    arcI: new Float32Array(W * H),
    pal: new Float32Array(256 * 3),
    arc: [0, 200, 255],
    red: [255, 40, 40],
    hist: new Int32Array(96),
    cx: new Float64Array(NCH), cv: new Float64Array(NCH),
    qx: new Float64Array(NCH), qv: new Float64Array(NCH),
    px: new Float64Array(NCH), pv: new Float64Array(NCH),
    gx: new Float64Array(NCH), gv: new Float64Array(NCH),
    h0: new Float64Array(NCH), eps: new Float64Array(NCH),
    len: new Int32Array(NCH), st: new Int32Array(NCH), rej: new Int32Array(NCH),
    acc: new Float64Array(NCH), rate: new Float64Array(NCH), life: new Float64Array(NCH),
    tx: new Float32Array(NCH * TR), ty: new Float32Array(NCH * TR),
    tt: new Float64Array(NCH * TR), tw: new Float32Array(NCH * TR), tb: new Uint8Array(NCH * TR),
    th: new Int32Array(NCH), tn: new Int32Array(NCH),
    bx: new Float32Array(NB), by: new Float32Array(NB), bage: new Float32Array(NB).fill(9),
    kern: new Float32Array(200),
    stat: new Float64Array(4),
  });
  for (let i = 0; i < NCH; i++) {
    S.rate[i] = 45 * (0.85 + 0.3 * rnd(S));
    seedChain(S, i);
  }
  // Arc profile by squared distance in eighths of an LED squared: a core 1.8 LEDs wide at half height and
  // a faint halo, so a trajectory is never a one-LED line.
  for (let k = 0; k < S.kern.length; k++) {
    const d2 = k / 8;
    S.kern[k] = exp(-d2 / (2 * 0.8 * 0.8)) + 0.28 * exp(-d2 / (2 * 2.1 * 2.1));
  }
  buildPalette(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = cl(kn[0], 0, 1);
  if (S.hue !== S.hueKey) {
    S.hueKey = S.hue;
    buildPalette(S);
  }
  const epsT = 0.012 * Math.pow(42, Math.pow(cl(kn[1], 0, 4) / 4, 0.75));
  const lenT = 32 * Math.pow(3.2, cl(kn[2], -1, 1));
  const svT = 3 * Math.pow(1.55, cl(kn[3], -1, 1));
  if (!S.ready) {
    // Sixty seconds of the sampler run before the first frame, with these knobs, so the heat map is
    // already filled and the knobs show from the first second.
    S.ready = true;
    S.epsK = epsT;
    S.lenK = lenT;
    S.svK = svT;
    for (let n = 0; n < PRERUN * 30; n++) advance(S, 1 / 30);
    gainUpdate(S, true);
  }
  const a = 1 - exp(-dt / 0.35);
  S.epsK += (epsT - S.epsK) * a;
  S.lenK += (lenT - S.lenK) * a;
  S.svK += (svT - S.svK) * a;
  advance(S, dt);
  if (++S.frame % 6 === 0) gainUpdate(S, false);
}

// Exposure follows the 95th percentile of the density over the whole panel, slowly, so the map is never
// blown out or empty whatever the knobs do to how concentrated it is.
function gainUpdate(S, now) {
  const D = S.D;
  const hist = S.hist;
  hist.fill(0);
  let below = 0;
  for (let p = 0; p < D.length; p++) {
    const d = D[p];
    if (d < 1e-4) below++;
    else hist[min(95, floor((Math.log10(d) + 4) * 16))]++;
  }
  const want = 0.05 * D.length;
  let c = 0;
  let q = 1e-3;
  for (let b = 95; b >= 0; b--) {
    c += hist[b];
    if (c >= want) {
      q = Math.pow(10, b / 16 - 4);
      break;
    }
  }
  const target = -log(3.6 * max(q, 1e-3));
  S.lgain = now ? target : S.lgain + (target - S.lgain) * (1 - exp(-0.2 / 8));
  S.gain = exp(S.lgain);
}

// One soft line segment into the arc buffer, brightest value wins where segments meet.
function segment(S, x0, y0, b0, x1, y1, b1) {
  const A = S.arcI;
  const kern = S.kern;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const xa = max(0, floor(min(x0, x1) - R_ARC));
  const xb = min(W - 1, floor(max(x0, x1) + R_ARC));
  const ya = max(0, floor(min(y0, y1) - R_ARC));
  const yb = min(H - 1, floor(max(y0, y1) + R_ARC));
  for (let y = ya; y <= yb; y++) {
    const py = y + 0.5 - y0;
    for (let x = xa; x <= xb; x++) {
      const pxx = x + 0.5 - x0;
      let t = 0;
      if (len2 > 1e-6) t = cl((pxx * dx + py * dy) / len2, 0, 1);
      const ex = pxx - t * dx;
      const ey = py - t * dy;
      const k = ((ex * ex + ey * ey) * 8) | 0;
      if (k >= 200) continue;
      const v = (b0 + (b1 - b0) * t) * kern[k] * 0.68;
      const p = y * W + x;
      if (v > A[p]) A[p] = v;
    }
  }
}

function drawArcs(S) {
  S.arcI.fill(0);
  const now = S.t;
  for (let i = 0; i < NCH; i++) {
    const n = S.tn[i];
    const base = i * TR;
    let prev = -1;
    let pb = 0;
    // From the oldest point still bright to the head.
    for (let j = n - 1; j >= 0; j--) {
      const k = base + ((S.th[i] + TR - 1 - j) % TR);
      const age = now - S.tt[k];
      if (age > 1.5) continue;
      const b = S.tw[k] * exp(-age / TAU_A);
      if (prev >= 0 && !S.tb[k]) segment(S, S.tx[prev], S.ty[prev], pb, S.tx[k], S.ty[k], b);
      prev = k;
      pb = b;
    }
    // The head is a little brighter and rounder than the trail.
    if (prev >= 0) segment(S, S.tx[prev], S.ty[prev], min(1.5, pb * 1.5), S.tx[prev], S.ty[prev], min(1.5, pb * 1.5));
  }
}

function drawBursts(S, out) {
  const red = S.red;
  for (let b = 0; b < NB; b++) {
    const age = S.bage[b];
    if (age > 1) continue;
    const A = exp(-age / 0.3);
    const R = 1.4 + 7 * (1 - exp(-age / 0.22));
    const xa = max(0, floor(S.bx[b] - R - 5));
    const xb = min(W - 1, floor(S.bx[b] + R + 5));
    const ya = max(0, floor(S.by[b] - R - 5));
    const yb = min(H - 1, floor(S.by[b] + R + 5));
    for (let y = ya; y <= yb; y++) {
      const dy = y + 0.5 - S.by[b];
      for (let x = xa; x <= xb; x++) {
        const dx = x + 0.5 - S.bx[b];
        const d = sqrt(dx * dx + dy * dy);
        const core = exp((-d * d) / (2 * 1.5 * 1.5)) * 1.3 * A;
        const ring = exp(-((d - R) * (d - R)) / (2 * 1.3 * 1.3)) * 1.2 * A;
        const o = (y * W + x) * 3;
        const wv = core * 255;
        const rv = ring;
        out[o] += wv + red[0] * rv;
        out[o + 1] += wv + red[1] * rv;
        out[o + 2] += wv + red[2] * rv;
      }
    }
  }
}

function render(S, display) {
  const D = S.D;
  const out = S.out;
  const pal = S.pal;
  const gain = S.gain;
  const K = 100;
  const invLogK = 1 / log(1 + K);
  drawArcs(S);
  const arc = S.arc;
  for (let p = 0; p < W * H; p++) {
    const s = D[p] * gain;
    let t = s > 0.0004 ? log(1 + K * s) * invLogK : 0;
    if (t > 1) t = 1;
    // A bend that keeps the broad body low in the ramp and lets only the dense knots reach orange.
    const idx = (((t * Math.sqrt(t)) * 255) | 0) * 3;
    let r = pal[idx];
    let g = pal[idx + 1];
    let b = pal[idx + 2];
    const a = S.arcI[p];
    if (a > 0.01) {
      const ac = a > 1 ? 1 : a;
      const w = sm(0.7, 1.15, a);
      const k = 1 - 0.8 * ac;
      r = r * k + (arc[0] * (1 - w) + 255 * w) * ac;
      g = g * k + (arc[1] * (1 - w) + 255 * w) * ac;
      b = b * k + (arc[2] * (1 - w) + 255 * w) * ac;
    }
    out[p * 3] = r;
    out[p * 3 + 1] = g;
    out[p * 3 + 2] = b;
  }
  drawBursts(S, out);
  if (!display) return;
  for (let y = 0, p = 0; y < H; y++) {
    for (let x = 0; x < W; x++, p++) {
      display.setPixel(x, y, min(255, out[p * 3]) | 0, min(255, out[p * 3 + 1]) | 0, min(255, out[p * 3 + 2]) | 0);
    }
  }
}

export function draw(display, params) {
  if (params.s) render(params.s, display);
}
