// ===== Patternflow pattern =====
// Title:   Edge Bundling
// Family:  edgebundling
// Idea:    A hundred and sixty connections between eighteen nodes at the top of the panel and eighteen at the bottom are routed through the hubs of their clusters and the root at the waist, so single hairs gather into a few thick luminous cables that fan out again at both ends, each cable a gradient from its source cluster's colour to its target's with bright dashes of traffic running down it.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hierarchical edge bundles (Danny Holten, 2006, from memory), where each connection is a B-spline through the tree path between its two leaves and a strength beta pulls the control points off the straight line; force-directed edge bundling (Danny Holten and Jarke van Wijk, 2009, from memory) is the other method of the family and is not used here; pattern round 233
// Round:   233
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.3..4, Bundle=-1..1, Spread=-1..1
//
// Knob 1: Hue. Turns all six cluster colours together once round the wheel: teal, blue-violet, magenta, rose, amber and green at 0, and the same set again at 1.
// Knob 2: Flow. How fast the traffic runs: dashes cross a cable at 2 LED a second at 0.3, 15 at the opening 2 and 30 at 4, and the leaves sway and the edge weights wander at the same pace.
// Knob 3: Bundle. Holten's strength beta, 0.05 at -1 so every connection is a straight line and the hairs make a sheaf, 0.5 at 0, 0.95 at 1 so they are pulled into tight cables through the waist.
// Knob 4: Spread. How wide the leaves of a cluster stand and how far apart the clusters sit: 2 LED clumps 11 LED apart at -1, 10 LED fans 17 apart at 0, 18 LED fans 22 apart at 1.

const W = 64;
const H = 128;
const { floor, ceil, sqrt, sin, cos, exp, abs, max, min, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

const NL = 18; // leaves on each side
const NEDGE = 160;
const NCROSS = 130; // top to bottom; the rest stay on one side
const TOP_Y = 5;
const BOT_Y = 122;
const HUB_TOP_Y = 36;
const HUB_BOT_Y = 92;
const ROOT_Y = 64;
const STEP = 1.2; // LED between two stamps along a cable
const SPW = 10; // curve samples per spline window
const CMAX = 2 * 3 * 40; // the longest route in curve samples, with room to spare

// Six cluster colours as Oklch hue angles, 60 degrees apart. Top clusters first, then bottom.
const HUES = [195, 315, 75, 255, 15, 135];

// ---- colour: one lightness, the most chroma that fits in sRGB at every hue, so no hue is dimmer than another
const LUT_L = 0.8;
const LUT_C = 0.19;
function oklab(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const enc = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
function buildLut(P) {
  const lut = new Float32Array(360 * 3);
  for (let h = 0; h < 360; h++) {
    const ca = cos((h * PI) / 180);
    const sa = sin((h * PI) / 180);
    let lo = 0;
    let hi = LUT_C;
    for (let i = 0; i < 14; i++) {
      const c = 0.5 * (lo + hi);
      const q = oklab(LUT_L, c * ca, c * sa);
      if (q[0] >= 0 && q[0] <= 1 && q[1] >= 0 && q[1] <= 1 && q[2] >= 0 && q[2] <= 1) lo = c;
      else hi = c;
    }
    const q = oklab(LUT_L, lo * ca, lo * sa);
    for (let ch = 0; ch < 3; ch++) lut[h * 3 + ch] = cl(enc(cl(q[ch], 0, 1)), 0, 255);
  }
  P.lut = lut;
}

// A uniform cubic B-spline window at SPW parameters, the four weights of each.
const BW = new Float32Array(SPW * 4);
for (let j = 0; j < SPW; j++) {
  const t = j / SPW;
  const t2 = t * t;
  const t3 = t2 * t;
  BW[j * 4] = ((1 - t) * (1 - t) * (1 - t)) / 6;
  BW[j * 4 + 1] = (3 * t3 - 6 * t2 + 4) / 6;
  BW[j * 4 + 2] = (-3 * t3 + 3 * t2 + 3 * t + 1) / 6;
  BW[j * 4 + 3] = t3 / 6;
}

// A soft round stamp: exp(-q) for q in steps of 1/64.
const GT = new Float32Array(700);
for (let i = 0; i < GT.length; i++) GT[i] = exp(-i / 64);

// ---- setup
export function setup(P) {
  Object.assign(P, {
    ft: 0, // time in flow units: the sways and weights run on it
    k: [0, 2, 0, 0.06],
    sp: 0, // spread, smoothed
    bt: 0.5, // beta, smoothed
    ready: false,
    lx: new Float32Array(2 * NL),
    ly: new Float32Array(2 * NL),
    hx: new Float32Array(6),
    hy: new Float32Array(6),
    hxm: new Float32Array(6), // hub follows the cluster's mean with a lag
    rx: 31.5,
    swA: new Float32Array(2 * NL * 4), // leaf sway phases and rates
    swC: new Float32Array(6 * 4), // cluster sway phases and rates
    walk: new Float32Array(9 + 3 + 3), // log traffic: cross pairs, top and bottom
    edges: [],
    E: new Float32Array(W * H),
    C: new Float32Array(W * H),
    S: new Float32Array(W * H),
    T: new Float32Array(W * H),
    Q: new Float32Array(W * H), // the part of the energy that is a dash of traffic
    cx: new Float32Array(CMAX),
    cy: new Float32Array(CMAX),
    cs: new Float32Array(CMAX),
    qx: new Float32Array(CMAX),
    qy: new Float32Array(CMAX),
    px: new Float32Array(12),
    py: new Float32Array(12),
  });
  buildLut(P);
  for (let i = 0; i < P.swA.length; i += 4) {
    P.swA[i] = Math.random() * TAU;
    P.swA[i + 1] = Math.random() * TAU;
    P.swA[i + 2] = TAU / (17 + 29 * Math.random());
    P.swA[i + 3] = TAU / (11 + 17 * Math.random());
  }
  for (let i = 0; i < P.swC.length; i += 4) {
    P.swC[i] = Math.random() * TAU;
    P.swC[i + 1] = Math.random() * TAU;
    P.swC[i + 2] = TAU / (31 + 23 * Math.random());
    P.swC[i + 3] = TAU / (19 + 13 * Math.random());
  }
  for (let i = 0; i < P.walk.length; i++) P.walk[i] = 0.4 * gauss();
  for (let i = 0; i < NEDGE; i++) {
    const e = { kind: i < NCROSS ? 0 : 1 + (i & 1) };
    P.edges.push(e);
  }
}

// ---- the network: who talks to whom
function pickWeighted(P, off, n) {
  let tot = 0;
  for (let i = 0; i < n; i++) tot += exp(P.walk[off + i]);
  let r = Math.random() * tot;
  for (let i = 0; i < n; i++) {
    r -= exp(P.walk[off + i]);
    if (r <= 0) return i;
  }
  return n - 1;
}

function birth(P, e, aged) {
  if (e.kind === 0) {
    const p = pickWeighted(P, 0, 9);
    const ca = floor(p / 3);
    const cb = p % 3;
    e.la = ca * 6 + floor(Math.random() * 6);
    e.lb = NL + cb * 6 + floor(Math.random() * 6);
  } else {
    const side = e.kind === 1 ? 0 : NL;
    const ca = pickWeighted(P, e.kind === 1 ? 9 : 12, 3);
    let cb = ca;
    if (Math.random() < 0.45) cb = (ca + 1 + floor(Math.random() * 2)) % 3;
    e.la = side + ca * 6 + floor(Math.random() * 6);
    do e.lb = side + cb * 6 + floor(Math.random() * 6);
    while (e.lb === e.la);
  }
  e.src = Math.random() < 0.5 ? 0 : 1; // which end the traffic starts from
  e.life = 25 + 45 * Math.random();
  e.age = aged ? Math.random() * e.life : 0;
  e.wa = Math.random() * TAU;
  e.wb = Math.random() * TAU;
  e.ra = TAU / (14 + 26 * Math.random());
  e.rb = TAU / (9 + 14 * Math.random());
  e.sp = 0.8 + 0.45 * Math.random();
  e.ph = Math.random();
  e.len = e.len || 130;
  e.dir = Math.random() < 0.5 ? 1 : -1;
  e.hj = (Math.random() - 0.5) * 30; // each cable strand is a few degrees off its cluster's hue
}

export function update(dt, input, P) {
  if (!P.edges) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) P.k[i] = k[i];
  const d = cl(dt || 0, 0, 0.1);
  if (!P.ready) {
    P.ready = true;
    P.sp = cl(k[3], -1, 1);
    P.bt = beta(cl(k[2], -1, 1));
    // Open on a network that has been running for minutes.
    for (let i = 0; i < NEDGE; i++) birth(P, P.edges[i], true);
    layout(P);
    for (let c = 0; c < 6; c++) P.hxm[c] = clusterMean(P, c);
    for (let s = 0; s < 40; s++) step(P, 0.1, 1, 0.1);
  }
  const fl = cl(k[1], 0.3, 4) / 2;
  step(P, d, fl, d);
}

function clusterMean(P, c) {
  let m = 0;
  for (let i = 0; i < 6; i++) m += P.lx[(c < 3 ? 0 : NL) + (c % 3) * 6 + i];
  return m / 6;
}

function beta(k3) {
  return 0.04 + 0.93 * Math.pow((k3 + 1) / 2, 0.35);
}

function flowSpeed(P) {
  return cl(P.k[1], 0.3, 4);
}

function step(P, d, fl, dl) {
  const k = P.k;
  P.ft += d * fl;
  const a = 1 - exp(-d / 0.4);
  P.sp += (cl(k[3], -1, 1) - P.sp) * a;
  P.bt += (beta(cl(k[2], -1, 1)) - P.bt) * a;
  // Traffic between pairs of clusters drifts like a slow random walk that is pulled back to zero.
  const wk = P.walk;
  for (let i = 0; i < wk.length; i++) wk[i] += -wk[i] * d * fl * 0.03 + 0.1 * sqrt(d * fl) * gauss();
  const age = d * (0.6 + 0.4 * fl);
  for (let i = 0; i < NEDGE; i++) {
    const e = P.edges[i];
    e.age += age;
    if (e.age >= e.life) birth(P, e, false);
    // the dashes cover one length of cable and a gap in 'cyc' LED; the phase counts turns of that
    e.ph = (e.ph + (7.5 * flowSpeed(P) * e.sp * d) / (e.len + 24)) % 1;
  }
  layout(P);
  const lag = 1 - exp(-dl / 1.4);
  for (let c = 0; c < 6; c++) P.hxm[c] += (clusterMean(P, c) - P.hxm[c]) * lag;
  for (let c = 0; c < 6; c++) {
    P.hx[c] = P.hxm[c];
    P.hy[c] = c < 3 ? HUB_TOP_Y : HUB_BOT_Y;
  }
  P.rx = 31.5 + 1.6 * (0.6 * sin(0.21 * P.ft + 1.3) + 0.4 * sin(0.137 * P.ft + 4.1));
}

// ---- leaves: clusters of six on each side, drifting
function layout(P) {
  const s = P.sp;
  const wd = s < 0 ? mix(2, 17, s + 1) : mix(17, 22, s);
  const dd = s < 0 ? mix(11, 20.5, s + 1) : mix(20.5, 22, s);
  const ind = 0.35 + 0.65 * sm(-1, 0.2, s);
  const t = P.ft;
  for (let side = 0; side < 2; side++) {
    for (let c = 0; c < 3; c++) {
      const ci = side * 3 + c;
      const cc = (ci) * 4;
      const sway = 3.2 * (0.6 * sin(P.swC[cc + 2] * t + P.swC[cc]) + 0.4 * sin(P.swC[cc + 3] * t + P.swC[cc + 1]));
      const cxm = 31.5 + (c - 1) * dd + sway;
      for (let i = 0; i < 6; i++) {
        const li = side * NL + c * 6 + i;
        const q = li * 4;
        const own = 1.4 * ind * (0.6 * sin(P.swA[q + 2] * t + P.swA[q]) + 0.4 * sin(P.swA[q + 3] * t + P.swA[q + 1]));
        P.lx[li] = cl(cxm + ((i - 2.5) / 2.5) * 0.5 * wd + own, 2.2, W - 2.2);
        P.ly[li] = side === 0 ? TOP_Y : BOT_Y;
      }
    }
  }
}

// ---- drawing
// The route of an edge from its source leaf to its target leaf, as control points.
function route(P, e, X, Y) {
  const a = e.src === 0 ? e.la : e.lb;
  const b = e.src === 0 ? e.lb : e.la;
  const ca = floor((a % NL) / 6) + (a >= NL ? 3 : 0);
  const cb = floor((b % NL) / 6) + (b >= NL ? 3 : 0);
  let n = 0;
  X[n] = P.lx[a];
  Y[n++] = P.ly[a];
  X[n] = P.hx[ca];
  Y[n++] = P.hy[ca];
  if (ca !== cb) {
    X[n] = P.rx;
    Y[n++] = ROOT_Y;
    X[n] = P.hx[cb];
    Y[n++] = P.hy[cb];
  }
  X[n] = P.lx[b];
  Y[n++] = P.ly[b];
  return n;
}

// Pull the control points toward the straight line between the ends (Holten's beta), then sample the
// clamped B-spline: the end points are tripled so the curve starts and ends on the leaves.
function spline(P, n, bt, X, Y) {
  const x0 = X[0];
  const y0 = Y[0];
  const dx = X[n - 1] - x0;
  const dy = Y[n - 1] - y0;
  const qx = P.qx;
  const qy = P.qy;
  let m = 0;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const bx = bt * X[i] + (1 - bt) * (x0 + f * dx);
    const by = bt * Y[i] + (1 - bt) * (y0 + f * dy);
    if (i === 0 || i === n - 1) {
      qx[m] = bx;
      qy[m++] = by;
      qx[m] = bx;
      qy[m++] = by;
    }
    qx[m] = bx;
    qy[m++] = by;
  }
  // m = n + 4 control points; windows of four
  const cx = P.cx;
  const cy = P.cy;
  let c = 0;
  const wn = m - 3;
  for (let w = 0; w < wn; w++)
    for (let j = 0; j < SPW; j++) {
      const o = j * 4;
      cx[c] = BW[o] * qx[w] + BW[o + 1] * qx[w + 1] + BW[o + 2] * qx[w + 2] + BW[o + 3] * qx[w + 3];
      cy[c++] = BW[o] * qy[w] + BW[o + 1] * qy[w + 1] + BW[o + 2] * qy[w + 2] + BW[o + 3] * qy[w + 3];
    }
  cx[c] = qx[m - 1];
  cy[c++] = qy[m - 1];
  // cumulative length
  const cs = P.cs;
  cs[0] = 0;
  for (let i = 1; i < c; i++) cs[i] = cs[i - 1] + Math.hypot(cx[i] - cx[i - 1], cy[i] - cy[i - 1]);
  return c;
}

const BASE = 0.14; // glow of a cable between dashes
const PULSE = 0.9; // extra at the middle of a dash
const PSIG = 1.9; // LED, a dash is about 6 LED long
const GAIN = 1.7;
// Energy under the cut, 0.07 for tight cables and 0.03 for a loose sheaf, is left dark, so the skirts of a strand do not fill the gaps between strands
const LIFT = 0.7; // the tone curve is lifted so a lone cable shows and a bundle of ten is not flat

function stamp(P, x, y, amp, fr, sg, ch, sh) {
  const R = ceil(2.5 * sg);
  const k = 64 / (2 * sg * sg);
  const x0 = floor(x) - R + 1;
  const y0 = floor(y) - R + 1;
  const x1 = x0 + 2 * R - 1;
  const y1 = y0 + 2 * R - 1;
  const E = P.E;
  const C = P.C;
  const S = P.S;
  const Q = P.Q;
  for (let py = max(y0, 0); py <= min(y1, H - 1); py++) {
    const dy = py + 0.5 - y;
    const dy2 = dy * dy;
    for (let px = max(x0, 0); px <= min(x1, W - 1); px++) {
      const dx = px + 0.5 - x;
      const gi = ((dx * dx + dy2) * k) | 0;
      if (gi >= 700) continue;
      const e = amp * GT[gi];
      const o = py * W + px;
      E[o] += e;
      // The hue of a pixel is the average of the hues that cross it, weighted toward the stronger strand,
      // so a crossing keeps one clear colour instead of drifting to a muddy mix.
      const e2 = e * e;
      C[o] += e2 * ch;
      S[o] += e2 * sh;
      Q[o] += e * fr;
    }
  }
}

// A 1-2-1 blur of the hue field, along x then along y. The brightness stays sharp.
function blur(A, T, n) {
  for (let it = 0; it < n; it++) {
    for (let y = 0; y < H; y++) {
      const r = y * W;
      for (let x = 0; x < W; x++) {
        const l = A[r + (x > 0 ? x - 1 : x)];
        const rr = A[r + (x < W - 1 ? x + 1 : x)];
        T[r + x] = 0.25 * l + 0.5 * A[r + x] + 0.25 * rr;
      }
    }
    for (let y = 0; y < H; y++) {
      const r = y * W;
      const u = (y > 0 ? y - 1 : y) * W;
      const dn = (y < H - 1 ? y + 1 : y) * W;
      for (let x = 0; x < W; x++) A[r + x] = 0.25 * T[u + x] + 0.5 * T[r + x] + 0.25 * T[dn + x];
    }
  }
}

export function draw(display, P) {
  if (!P.ready) return;
  const E = P.E;
  const C = P.C;
  const S = P.S;
  const Q = P.Q;
  E.fill(0);
  C.fill(0);
  S.fill(0);
  P.Q.fill(0);
  const bt = P.bt;
  // A loose sheaf lays all hundred and thirty strands across the whole panel, so each gets less light.
  const tight = sm(0.04, 0.6, bt);
  const boost = 1.0;
  const soft = 0.8 + 0.2 * tight; // the strands of a loose sheaf are wider, to read as silk and not as noise
  const cut = 0.03 + 0.04 * tight;
  // A leaf to leaf connection on one side flattens into a bar along the leaf row as beta goes to 0.
  const flat = sm(0.1, 0.55, bt);
  const cx = P.cx;
  const cy = P.cy;
  const cs = P.cs;
  for (let i = 0; i < NEDGE; i++) {
    const e = P.edges[i];
    const fade = sm(0, 3, e.age) * sm(0, 3, e.life - e.age);
    if (fade <= 0.001) continue;
    const n = route(P, e, P.px, P.py);
    const nc = spline(P, n, bt, P.px, P.py);
    const len = cs[nc - 1];
    const m = 0.6 * sin(e.ra * P.ft + e.wa) + 0.4 * sin(e.rb * P.ft + e.wb);
    const w = 0.65 + 0.35 * m;
    const width = 1.3 + 0.9 * ((w - 0.3) / 0.7);
    const sg = 0.42 * width * soft;
    const norm = (STEP / (sg * 2.5066)) * fade * w * boost * (e.kind === 0 ? 1 : flat);
    // hue run, in the cluster hue space
    const a = e.src === 0 ? e.la : e.lb;
    const b = e.src === 0 ? e.lb : e.la;
    const ha = HUES[floor((a % NL) / 6) + (a >= NL ? 3 : 0)];
    const hb = HUES[floor((b % NL) / 6) + (b >= NL ? 3 : 0)];
    let dh = hb - ha;
    dh -= 360 * Math.round(dh / 360);
    if (abs(abs(dh) - 180) < 1) dh = 180 * e.dir;
    // two dashes
    const cyc = len + 24;
    e.len = len;
    const p1 = e.ph * cyc - 12;
    const p2 = ((e.ph + 0.5) % 1) * cyc - 12;
    let seg = 0;
    for (let s = STEP * 0.5; s < len; s += STEP) {
      while (seg < nc - 2 && cs[seg + 1] < s) seg++;
      const f = (s - cs[seg]) / max(1e-6, cs[seg + 1] - cs[seg]);
      const x = cx[seg] + (cx[seg + 1] - cx[seg]) * f;
      const y = cy[seg] + (cy[seg + 1] - cy[seg]) * f;
      const u = s / len;
      const hh = ((ha + e.hj + dh * sm(0.12, 0.88, u)) * PI) / 180;
      const d1 = (s - p1) / PSIG;
      const d2 = (s - p2) / PSIG;
      const pl = (abs(d1) < 3.5 ? exp(-0.5 * d1 * d1) : 0) + (abs(d2) < 3.5 ? exp(-0.5 * d2 * d2) : 0);
      const tp = 0.35 + 0.65 * sm(0, 5, min(s, len - s));
      const amp = norm * (BASE + PULSE * pl) * tp;
      stamp(P, x, y, amp, (PULSE * pl) / (BASE + PULSE * pl), sg, cos(hh), sin(hh));
    }
  }
  // leaves: soft dots in their cluster's hue
  for (let li = 0; li < 2 * NL; li++) {
    const c = floor((li % NL) / 6) + (li >= NL ? 3 : 0);
    const hh = (HUES[c] * PI) / 180;
    stamp(P, P.lx[li], P.ly[li], 0.8, 0, 0.85, cos(hh), sin(hh));
  }
  blur(C, P.T, 1);
  blur(S, P.T, 1);
  const lut = P.lut;
  const off = 360 * cl(P.k[0], 0, 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      const tot = E[o];
      if (tot < cut) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const hd = (atan2(S[o], C[o]) * 180) / PI + off;
      const hi = (((floor(hd + 0.5) % 360) + 360) % 360) * 3;
      const v = 1 - exp(-GAIN * Math.pow(tot - cut, LIFT));
      const wh = (0.4 * sm(0.8, 5, tot) + 0.25 * sm(4, 14, tot) + 0.5 * sm(0.25, 0.8, Q[o] / tot)) * v;
      display.setPixel(x, y, (mix(lut[hi] * v, 255, wh)) | 0, (mix(lut[hi + 1] * v, 255, wh)) | 0, (mix(lut[hi + 2] * v, 255, wh)) | 0);
    }
}
