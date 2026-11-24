// ===== Patternflow pattern =====
// Title:   Collapse Map
// Family:  wavecollapse
// Idea:    A map of six levels, deep indigo sea to pale crest, builds itself the way Wave Function Collapse builds a layout: every lattice vertex keeps the set of levels it may still become and glows as a soft blend of them while undecided, then snaps to one level and a crisp contour band when the lowest-entropy vertex is collapsed, while wandering patches of the map are forgotten and fall back into superposition, so a collapse front is always moving somewhere and the map never finishes.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Wave Function Collapse (Maxim Gumin, 2016, from memory), after Paul Merrell's model synthesis (2007, from memory): collapse the cell of lowest entropy to one option by weight and propagate the neighbour rule, here that levels of neighbouring vertices differ by at most one so the bands nest like contours, with the weights leaning on a slowly drifting noise field and an erasing pass that reopens wandering patches; pattern round 232
// Round:   232
// ===============================
// @matrix 64x128
// @knobs Palette=0..1, Collapses=0.5..8, Sea level=-1..1, Forgetting=-1..1
//
// Knob 1: Palette. Walks the colours of the six levels through four ramps by hue: indigo, teal, sand and green sea and land at 0, a violet sea with mint and azure land at 0.25, a rose sea with gold land at 0.5, a deep teal sea with butter and periwinkle land at 0.75, and back at 1.
// Knob 2: Collapses. How many vertices collapse each second, four and a half times the knob: 2.25 a second at 0.5, 9 at the opening 2 and 36 at 8, so the front either creeps across a forgotten patch or races over it.
// Knob 3: Sea level. How much of the map is water: at -1 the weights lean toward the high levels and dark green and pale crest take most of the map, at 0 sea and land share it, at 1 indigo and teal take most of it.
// Knob 4: Forgetting. How much of the map is held in superposition and how fast the forgetting patches wander: a twenty-fifth of the map at -1 and the patches crawl, about a fifth at the opening, a little over a third at 1 with the patches larger and five times quicker.

const W = 64;
const H = 128;
const N = W * H;
const GX = 17; // lattice vertices across, 4 LED apart
const GY = 33; // and down
const NV = GX * GY;
const NL = 6; // levels: deep, shallow, sand, green, dark green, crest
const FULL = 63; // bit mask of all six levels
const { floor, sqrt, cos, sin, exp, log, max, min, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the rule: a bit mask of allowed levels per vertex, and tables to read one
const POP = new Uint8Array(64);
const LVL = new Uint8Array(64);
for (let m = 1; m < 64; m++) {
  let c = 0;
  let lo = -1;
  for (let l = 0; l < NL; l++)
    if ((m >> l) & 1) {
      c++;
      if (lo < 0) lo = l;
    }
  POP[m] = c;
  LVL[m] = lo;
}

const SIG = 0.8; // how tightly a collapse follows the drifting preference
const BETA = 0.3; // how much a collapse likes the levels its decided neighbours already hold
const WFLOOR = 0.012; // every allowed level keeps a little weight
const NBR_BONUS = 0.22; // entropy a decided neighbour takes off, so the front grows from what is known

// ---- the colours: six stops of four ramps in OKLCH (lightness, chroma, hue)
const RAMPS = [
  [[0.3, 0.13, 275], [0.64, 0.105, 205], [0.91, 0.045, 92], [0.72, 0.15, 142], [0.42, 0.09, 160], [0.95, 0.06, 135]],
  [[0.28, 0.12, 330], [0.62, 0.15, 295], [0.91, 0.06, 165], [0.72, 0.13, 225], [0.4, 0.11, 255], [0.95, 0.05, 200]],
  [[0.3, 0.13, 355], [0.68, 0.15, 370], [0.92, 0.05, 435], [0.85, 0.15, 450], [0.42, 0.12, 300], [0.96, 0.04, 390]],
  [[0.3, 0.07, 200], [0.7, 0.14, 165], [0.93, 0.07, 460], [0.74, 0.14, 250], [0.42, 0.11, 250], [0.95, 0.05, 520]],
];
const LUT_N = 24; // table entries between two levels
const PEARL = [255, 247, 232];

function oklch(L, C, hDeg) {
  const h = (hDeg * PI) / 180;
  let c = C;
  let rgb = [0, 0, 0];
  for (let it = 0; it < 14; it++) {
    const a = c * cos(h);
    const b = c * sin(h);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l3 = l_ * l_ * l_;
    const m3 = m_ * m_ * m_;
    const s3 = s_ * s_ * s_;
    const lin = [
      4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
      -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
      -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
    ];
    let ok = true;
    for (let k = 0; k < 3; k++) {
      const v = lin[k];
      if (v < -0.002 || v > 1.002) ok = false;
      const q = cl(v, 0, 1);
      rgb[k] = 255 * (q <= 0.0031308 ? 12.92 * q : 1.055 * Math.pow(q, 1 / 2.4) - 0.055);
    }
    if (ok) break;
    c *= 0.9;
  }
  return rgb;
}

// The stops of the ramp the Palette knob points at: neighbouring ramps are blended stop by stop, lightness, chroma and hue.
function stopsFor(u) {
  const pos = (u - floor(u)) * RAMPS.length;
  const a = floor(pos) % RAMPS.length;
  const b = (a + 1) % RAMPS.length;
  const t = sm(0, 1, pos - floor(pos));
  const out = [];
  for (let s = 0; s < NL; s++) {
    const p = RAMPS[a][s];
    const q = RAMPS[b][s];
    // the last ramp comes back to the first one, whose hues sit a turn or two lower
    let hq = q[2];
    if (b === 0) while (hq < p[2] - 180) hq += 360;
    out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (hq - p[2]) * t]);
  }
  return out;
}

function buildLut(P) {
  const key = Math.round(P.u * 2000);
  if (key === P.lutKey) return;
  P.lutKey = key;
  const st = stopsFor(P.u);
  let n = 0;
  for (let s = 0; s < NL - 1; s++)
    for (let e = 0; e < LUT_N; e++) {
      const t = e / LUT_N;
      const a = st[s];
      const b = st[s + 1];
      let dh = (b[2] - a[2]) % 360;
      if (dh > 180) dh -= 360;
      if (dh < -180) dh += 360;
      const c = oklch(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + dh * t);
      P.lut[n++] = c[0];
      P.lut[n++] = c[1];
      P.lut[n++] = c[2];
    }
  const c = oklch(st[NL - 1][0], st[NL - 1][1], st[NL - 1][2]);
  P.lut[n++] = c[0];
  P.lut[n++] = c[1];
  P.lut[n++] = c[2];
}

// ---- cubic B-spline weights for the four LED phases between two lattice vertices
const PHW = new Float32Array(16);
for (let q = 0; q < 4; q++) {
  const t = (q + 0.5) / 4;
  PHW[q * 4] = ((1 - t) * (1 - t) * (1 - t)) / 6;
  PHW[q * 4 + 1] = (3 * t * t * t - 6 * t * t + 4) / 6;
  PHW[q * 4 + 2] = (-3 * t * t * t + 3 * t * t + 3 * t + 1) / 6;
  PHW[q * 4 + 3] = (t * t * t) / 6;
}

// ---- setup
export function setup(P) {
  const f = (n) => new Float32Array(n);
  Object.assign(P, {
    ready: true,
    mask: new Uint8Array(NV).fill(FULL),
    mark: new Uint8Array(NV),
    inq: new Uint8Array(NV),
    age: f(NV),
    rv: f(NV),
    bias: f(NV),
    hs: f(NV),
    us: f(NV),
    fs: f(NV),
    nb: new Int16Array(NV * 4).fill(-1),
    wt: new Float64Array(NL),
    pen: new Float64Array(NL),
    hf: f(N),
    uf: f(N),
    ff: f(N),
    hw: f(N),
    wob: f(N),
    wob2: f(N),
    tmp: f(GY * W),
    lut: f(3 * ((NL - 1) * LUT_N + 1)),
    lutKey: -1,
    waves: [],
    blobs: [],
    t: 0,
    tb: -9,
    tv: 0,
    bt: 0,
    acc: 0,
    warm: false,
    u: 0,
    sea: 0,
    rate: 6,
    rearm: 8,
    cap: 0.17,
    m4: 1,
    r0: 3.4,
    bad: -1,
    mending: 0,
    und: 0,
  });
  for (let j = 0; j < GY; j++)
    for (let i = 0; i < GX; i++) {
      const v = j * GX + i;
      P.rv[v] = Math.random();
      let c = 0;
      if (i > 0) P.nb[v * 4 + c++] = v - 1;
      if (i < GX - 1) P.nb[v * 4 + c++] = v + 1;
      if (j > 0) P.nb[v * 4 + c++] = v - GX;
      if (j < GY - 1) P.nb[v * 4 + c++] = v + GX;
    }
  // The preference field: six waves, 6 to 13 lattice steps long, each drifting at its own pace.
  const lams = [14, 11, 17, 8.5, 12.5, 10];
  const pers = [210, 150, 290, 125, 180, 320];
  for (let k = 0; k < 6; k++) {
    const ang = Math.random() * TAU;
    P.waves.push({
      kx: (TAU / lams[k]) * cos(ang),
      ky: (TAU / lams[k]) * sin(ang),
      w: ((Math.random() < 0.5 ? -1 : 1) * TAU) / pers[k],
      ph: Math.random() * TAU,
      wm: TAU / (240 + 90 * Math.random()),
      pm: Math.random() * TAU,
    });
  }
  // Three patches that forget, each wandering on a path of its own.
  for (let k = 0; k < 3; k++)
    P.blobs.push({
      ax: 4.5 + 2 * Math.random(),
      ay: 8 + 4 * Math.random(),
      wx: TAU / (70 + 70 * Math.random()),
      wy: TAU / (110 + 100 * Math.random()),
      px: Math.random() * TAU,
      py: Math.random() * TAU,
      bx2: 1 + Math.random(),
      by2: 1.5 + 2 * Math.random(),
      w2x: TAU / (31 + 20 * Math.random()),
      w2y: TAU / (43 + 25 * Math.random()),
      pr: Math.random() * TAU,
      x: 8,
      y: 16,
      r: 3,
    });
  // Two fixed ripples that keep the contours from following the lattice and, crossfaded, let the coastlines breathe.
  const rip = [];
  for (let k = 0; k < 4; k++) {
    const lam = 8 + Math.random() * 7;
    const ang = Math.random() * TAU;
    rip.push([(TAU / lam) * cos(ang), (TAU / lam) * sin(ang), Math.random() * TAU]);
  }
  const rip2 = [];
  for (let k = 0; k < 4; k++) {
    const lam = 8 + Math.random() * 7;
    const ang = Math.random() * TAU;
    rip2.push([(TAU / lam) * cos(ang), (TAU / lam) * sin(ang), Math.random() * TAU]);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      let v2 = 0;
      for (const r of rip) v += sin(r[0] * x + r[1] * y + r[2]);
      for (const r of rip2) v2 += sin(r[0] * x + r[1] * y + r[2]);
      P.wob[y * W + x] = 0.03 * v;
      P.wob2[y * W + x] = 0.03 * v2;
    }
}

// ---- the preference: which level a vertex leans toward right now
function updateBias(P) {
  const ws = P.waves;
  const t = P.t;
  const ph = [];
  const am = [];
  let nrm = 0;
  for (let k = 0; k < ws.length; k++) {
    ph.push(ws[k].w * t + ws[k].ph);
    const a = 1 + 0.3 * sin(ws[k].wm * t + ws[k].pm);
    am.push(a);
    nrm += (a * a) / 2;
  }
  nrm = 1 / sqrt(nrm);
  const mid = 2.35 - 1.2 * P.sea;
  for (let j = 0; j < GY; j++)
    for (let i = 0; i < GX; i++) {
      let s = 0;
      for (let k = 0; k < ws.length; k++) s += am[k] * sin(ws[k].kx * i + ws[k].ky * j + ph[k]);
      P.bias[j * GX + i] = mid + 2.3 * s * nrm;
    }
}

// ---- Wave Function Collapse on the lattice
// Weights of the levels a vertex may still take: the drifting preference, and the levels its decided neighbours hold.
function weights(P, v) {
  const { mask, bias, wt, pen, nb } = P;
  const m = mask[v];
  const p = bias[v];
  pen.fill(0);
  for (let k = 0; k < 4; k++) {
    const n = nb[v * 4 + k];
    if (n < 0) continue;
    const mn = mask[n];
    if (POP[mn] === 1) {
      const L = LVL[mn];
      for (let l = 0; l < NL; l++) pen[l] += (l - L) * (l - L);
    }
  }
  let s = 0;
  for (let l = 0; l < NL; l++) {
    if ((m >> l) & 1) {
      const z = (l - p) / SIG;
      const w = exp(-0.5 * z * z - BETA * pen[l]) + WFLOOR;
      wt[l] = w;
      s += w;
    } else wt[l] = 0;
  }
  return s;
}

// The rule between 4-neighbours: levels differ by at most one. A queue carries a change outward until nothing moves.
function propagate(P, q) {
  const { mask, nb, inq } = P;
  for (let h = 0; h < q.length; h++) {
    const v = q[h];
    inq[v] = 0;
    const mv = mask[v];
    const allow = (mv | (mv << 1) | (mv >> 1)) & FULL;
    for (let k = 0; k < 4; k++) {
      const n = nb[v * 4 + k];
      if (n < 0) continue;
      const nm = mask[n] & allow;
      if (nm === mask[n]) continue;
      if (nm === 0) {
        P.bad = n;
        continue;
      }
      mask[n] = nm;
      if (!inq[n]) {
        inq[n] = 1;
        q.push(n);
      }
    }
  }
}

// Put vertices back to every level, widen what their old decisions had narrowed, and let the neighbours that stand outside narrow it again.
function forget(P, list) {
  const { mask, mark, nb } = P;
  for (const v of list) {
    mask[v] = FULL;
    mark[v] = 1;
  }
  for (const v of list) {
    const i = v % GX;
    const j = (v - i) / GX;
    for (let dy = -4; dy <= 4; dy++) {
      const jj = j + dy;
      if (jj < 0 || jj >= GY) continue;
      const rx = 4 - Math.abs(dy);
      for (let dx = -rx; dx <= rx; dx++) {
        const ii = i + dx;
        if (ii < 0 || ii >= GX) continue;
        const w = jj * GX + ii;
        if (POP[mask[w]] > 1) {
          mask[w] = FULL;
          mark[w] = 1;
        }
      }
    }
  }
  const q = [];
  for (let v = 0; v < NV; v++) {
    let hit = mark[v] === 1;
    if (!hit)
      for (let k = 0; k < 4; k++) {
        const n = nb[v * 4 + k];
        if (n >= 0 && mark[n] === 1) hit = true;
      }
    if (hit) {
      q.push(v);
      P.inq[v] = 1;
    }
  }
  mark.fill(0);
  propagate(P, q);
  mend(P);
}

// A domain that ran empty reopens a small patch round it. The nesting rule cannot cause one, this is the net under it.
function mend(P) {
  if (P.mending > 3) {
    P.bad = -1;
    return;
  }
  P.mending++;
  let guard = 0;
  while (P.bad >= 0 && guard++ < 4) {
    const n = P.bad;
    P.bad = -1;
    const i = n % GX;
    const j = (n - i) / GX;
    const list = [];
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const ii = i + dx;
        const jj = j + dy;
        if (ii >= 0 && jj >= 0 && ii < GX && jj < GY) list.push(jj * GX + ii);
      }
    forget(P, list);
  }
  P.bad = -1;
  P.mending--;
}

// Collapse the vertex of lowest entropy to one level, drawn by weight.
function collapseOne(P) {
  const { mask, wt, nb } = P;
  let best = -1;
  let bs = 1e9;
  for (let v = 0; v < NV; v++) {
    if (POP[mask[v]] < 2) continue;
    const s = weights(P, v);
    let e = 0;
    for (let l = 0; l < NL; l++) if (wt[l] > 0) e -= wt[l] * log(wt[l]);
    e = log(s) + e / s;
    let dec = 0;
    for (let k = 0; k < 4; k++) {
      const n = nb[v * 4 + k];
      if (n >= 0 && POP[mask[n]] === 1) dec++;
    }
    const score = e - NBR_BONUS * dec + 0.06 * Math.random();
    if (score < bs) {
      bs = score;
      best = v;
    }
  }
  if (best < 0) return false;
  const s = weights(P, best);
  let r = Math.random() * s;
  let pick = LVL[mask[best]];
  for (let l = 0; l < NL; l++) {
    if (wt[l] <= 0) continue;
    pick = l;
    r -= wt[l];
    if (r <= 0) break;
  }
  mask[best] = 1 << pick;
  P.fs[best] = 1;
  const q = [best];
  P.inq[best] = 1;
  propagate(P, q);
  mend(P);
  return true;
}

// ---- forgetting: patches that wander and reopen what they cross, as far as the budget allows
function forgetStep(P, d) {
  const { mask, age, rv, blobs } = P;
  P.bt += d * P.m4;
  const tau = P.bt;
  for (const b of blobs) {
    b.x = 8 + b.ax * sin(b.wx * tau + b.px) + b.bx2 * sin(b.w2x * tau + b.pr);
    b.y = 16 + b.ay * sin(b.wy * tau + b.py) + b.by2 * sin(b.w2y * tau + b.px);
    b.r = P.r0 * (1 + 0.22 * sin(0.11 * tau + b.pr));
  }
  let und = 0;
  const cand = [];
  const empty = [];
  for (let v = 0; v < NV; v++) {
    if (mask[v] === 0) {
      empty.push(v);
      continue;
    }
    if (POP[mask[v]] > 1) {
      und++;
      age[v] = 0;
      continue;
    }
    age[v] += d;
    if (age[v] < P.rearm) continue;
    const i = v % GX;
    const j = (v - i) / GX;
    let nd = 9;
    for (const b of blobs) {
      const dx = i - b.x;
      const dy = j - b.y;
      const e = sqrt(dx * dx + dy * dy) / b.r;
      if (e < nd) nd = e;
    }
    if (nd < 1 - 0.3 * rv[v]) cand.push([nd, v]);
  }
  P.und = und;
  if (empty.length) {
    forget(P, empty);
    return;
  }
  const budget = floor(P.cap * NV) - und;
  if (budget < 1 || !cand.length) return;
  cand.sort((a, b) => a[0] - b[0]);
  const take = min(budget, cand.length);
  const list = [];
  for (let k = 0; k < take; k++) {
    list.push(cand[k][1]);
    age[cand[k][1]] = 0;
  }
  forget(P, list);
}

function stepModel(P, d) {
  P.t += d;
  if (P.t - P.tb > 0.25) {
    updateBias(P);
    P.tb = P.t;
  }
  forgetStep(P, d);
  P.acc += P.rate * d;
  let n = floor(P.acc);
  P.acc -= n;
  if (n > 14) n = 14;
  for (; n > 0; n--)
    if (!collapseOne(P)) {
      P.acc = 0;
      break;
    }
}

// ---- what a vertex shows: the mean of the levels it may still take, and how unsure it is
function targets(P, v, out) {
  const m = P.mask[v];
  if (POP[m] === 1) {
    out[0] = LVL[m];
    out[1] = 0;
    return;
  }
  const s = weights(P, v);
  let mu = 0;
  for (let l = 0; l < NL; l++) mu += (P.wt[l] / s) * l;
  out[0] = mu;
  out[1] = Math.pow((POP[m] - 1) / (NL - 1), 0.8);
}

const TG = [0, 0];

function ease(P, d) {
  const ah = 1 - exp(-d / 0.28);
  const au = 1 - exp(-d / 0.45);
  const df = exp(-d / 0.55);
  for (let v = 0; v < NV; v++) {
    targets(P, v, TG);
    P.hs[v] += (TG[0] - P.hs[v]) * ah;
    P.us[v] += (TG[1] - P.us[v]) * au;
    P.fs[v] *= df;
  }
}

function snap(P) {
  for (let v = 0; v < NV; v++) {
    targets(P, v, TG);
    P.hs[v] = TG[0];
    P.us[v] = TG[1];
    P.fs[v] = 0;
  }
}

export function update(dt, input, P) {
  if (!P.ready) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  P.u = cl(k[0], 0, 1);
  P.rate = 4.5 * cl(k[1], 0.5, 8);
  // seconds a vertex stays decided before a passing patch may forget it again: shorter when the front runs faster
  P.rearm = cl(30 / P.rate, 1.5, 8);
  P.sea = cl(k[2], -1, 1);
  const q = (cl(k[3], -1, 1) + 1) / 2;
  P.cap = 0.04 + 0.32 * Math.pow(q, 1.25);
  P.m4 = 1.4 * exp(1.3 * (q * 2 - 1));
  P.r0 = 3.1 + 1.7 * q;
  if (!P.warm) {
    // Open on a map that has been collapsing and forgetting for a couple of minutes.
    P.warm = true;
    updateBias(P);
    P.tb = 0;
    let g = 0;
    while (collapseOne(P) && g++ < NV + 8);
    for (let s = 0; s < 1300; s++) stepModel(P, 0.1);
    snap(P);
  }
  stepModel(P, d);
  ease(P, d);
  P.tv += d;
}

// ---- drawing
function spline(src, dst, tmp) {
  for (let j = 0; j < GY; j++) {
    const row = j * GX;
    for (let x = 0; x < W; x++) {
      const i0 = x >> 2;
      const ph = (x & 3) * 4;
      const a = src[row + (i0 > 0 ? i0 - 1 : 0)];
      const b = src[row + i0];
      const c = src[row + (i0 + 1 < GX ? i0 + 1 : GX - 1)];
      const e = src[row + (i0 + 2 < GX ? i0 + 2 : GX - 1)];
      tmp[j * W + x] = PHW[ph] * a + PHW[ph + 1] * b + PHW[ph + 2] * c + PHW[ph + 3] * e;
    }
  }
  for (let y = 0; y < H; y++) {
    const j0 = y >> 2;
    const ph = (y & 3) * 4;
    const ja = (j0 > 0 ? j0 - 1 : 0) * W;
    const jb = j0 * W;
    const jc = (j0 + 1 < GY ? j0 + 1 : GY - 1) * W;
    const je = (j0 + 2 < GY ? j0 + 2 : GY - 1) * W;
    for (let x = 0; x < W; x++)
      dst[y * W + x] = PHW[ph] * tmp[ja + x] + PHW[ph + 1] * tmp[jb + x] + PHW[ph + 2] * tmp[jc + x] + PHW[ph + 3] * tmp[je + x];
  }
}

export function draw(display, P) {
  if (!P.ready || !P.warm) return;
  buildLut(P);
  const { hf, uf, ff, hw, wob, lut } = P;
  spline(P.hs, hf, P.tmp);
  spline(P.us, uf, P.tmp);
  spline(P.fs, ff, P.tmp);
  const t = P.tv;
  const wc = cos(0.3 * t);
  const ws = sin(0.3 * t);
  for (let i = 0; i < N; i++) hw[i] = cl(hf[i] + wob[i] * wc + P.wob2[i] * ws, 0, 5);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const h = hw[i];
      const gx = (hw[x < W - 1 ? i + 1 : i] - hw[x > 0 ? i - 1 : i]) * 0.5;
      const gy = (hw[y < H - 1 ? i + W : i] - hw[y > 0 ? i - W : i]) * 0.5;
      const e = cl(0.6 * sqrt(gx * gx + gy * gy), 0.04, 0.35);
      const l0 = floor(h + 0.5);
      const stair = l0 - 1 + sm(l0 - 0.5 - e, l0 - 0.5 + e, h) + sm(l0 + 0.5 - e, l0 + 0.5 + e, h);
      const u = cl(uf[i], 0, 1);
      const soft = sm(0.05, 0.5, u);
      let c = stair + (h - stair) * soft;
      let gain = 1;
      let lift = 0;
      if (u > 0.01 || ff[i] > 0.01) {
        // An undecided patch flickers between the levels it might still become, and is brightest along the front where it meets what is decided.
        const sh = sin(0.5 * x + 0.33 * y + 1.7 * sin(0.21 * x - 0.17 * y + 0.4 * t) - 1.3 * t) + sin(0.31 * x - 0.44 * y + 0.9 * t + 2) * 0.7;
        const rim = 4 * u * (1 - u);
        c += 0.3 * sh * u * soft;
        gain = 1 + 0.12 * u + rim * 0.3 + ff[i] * 0.3;
        lift = cl(rim * 0.12 + ff[i] * 0.22, 0, 0.5);
      }
      c = cl(c, 0, 5) * LUT_N;
      const c0 = floor(c);
      const fr = c - c0;
      const o = c0 >= (NL - 1) * LUT_N ? (NL - 1) * LUT_N * 3 : c0 * 3;
      const o2 = c0 >= (NL - 1) * LUT_N ? o : o + 3;
      const r = (lut[o] + (lut[o2] - lut[o]) * fr) * gain;
      const g = (lut[o + 1] + (lut[o2 + 1] - lut[o + 1]) * fr) * gain;
      const b = (lut[o + 2] + (lut[o2 + 2] - lut[o + 2]) * fr) * gain;
      const rr = r + (PEARL[0] - r) * lift;
      const gg = g + (PEARL[1] - g) * lift;
      const bb = b + (PEARL[2] - b) * lift;
      display.setPixel(x, y, cl(rr, 0, 255) | 0, cl(gg, 0, 255) | 0, cl(bb, 0, 255) | 0);
    }
  }
}
