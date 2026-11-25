// ===== Patternflow pattern =====
// Title:   Phenogram
// Family:  phylogeny
// Idea:    A traitgram of a lineage tree being born, split and killed: each living lineage is a soft coloured line that wanders sideways as it climbs the panel, splits into two daughters of nearly its own colour that leave the same point in a clean Y, tapers away when it goes extinct, and every few tens of seconds a mass extinction kills most of the tree and the survivors radiate again.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: traitgram or phenogram, a phylogeny drawn with time on one axis and a trait value on the other (a standard figure of comparative phylogenetics), the trait moving as Brownian motion along the branches of a birth-death tree (Joseph Felsenstein, 1985, from memory), with mass extinction as the bottleneck and adaptive radiation as the burst that follows it (from memory), pattern round 228
// Round:   228
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tempo=1.2..4, Diversity=-1..1, Wander=-1..1
//
// Knob 1: Hue. Adds the knob, in turns of the colour wheel, to every lineage's hue, so 0 to 1 goes once round. At 0 a lineage's hue is 0.78 plus 0.27 times a trait q that walks between -1 and 1, which puts the tree between azure (0.51 turn) and orange-red (1.05), through blue, violet and magenta; the two daughters of a split start 0.03 to 0.05 turn apart on either side of the parent, then each drifts about 0.09 turn (rms) over 40 rows, up to 2.5 times as fast just after a mass extinction, so clades are families of near hues.
// Knob 2: Tempo. The speed of the scroll and of everything that happens in it. The panel runs 1.45 rows a second for each unit of the knob: 1.7 at 1.2 (the 128 rows are the last 74 s), 2.9 at the opening 2 (44 s) and 5.8 at 4 (22 s). The model is counted in rows, so a faster tempo moves births, deaths and mass extinctions along with it and leaves the shape of the tree alone; mass extinctions come at least 50 rows apart and 100 on average, which is 34 s at 2.
// Knob 3: Diversity. The balance of splits and deaths, from a few thick lineages to a thicket. Lineages keep 7.0 LEDs apart at -1, 4.4 at 0 and 2.9 at +1, and are drawn about 3.0, 2.2 and 1.8 LEDs wide. About 6 live at -1 (never more than 9 in a 400 s run), 8 at the opening 0 (up to 15) and 18 at +1 (up to 26). A lineage lives 110 rows on average at -1, 65 at 0 and 38 at +1, so the picture holds a handful of long branches at one end and a fast-turning crowd at the other.
// Knob 4: Wander. How far a lineage wanders sideways. Its sideways speed has a standard deviation of 0.03 LEDs a row at -1, 0.12 at the opening 0.06 and 0.72 at +1, remembered for 5, 7.5 and 14 rows, so on its own a line strays about 0.6 LEDs over 40 rows at -1 (near-vertical stems), 3 at the opening and up to 24 at +1 (a sprawl, held in by its neighbours and the walls). Forks open the same way at every setting.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, sqrt, exp, log, abs, min, max, pow, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// Time is counted in rows: one step of the model is one LED line of history, and the panel scrolls at a rate of rows
// a second set by the Tempo knob, so the knob speeds the whole process and leaves the shape of the tree alone.
// The present is the bottom edge and the past scrolls up. Every living lineage keeps a list of sideways positions, one
// for each step it has lived, so an extinct line is just a list that stopped, and the picture reads the lists back.
const AF = 7; // rows over which two sisters open to a full gap
const TAPER = 7; // rows a dying line narrows over
const HEAD = 5; // rows at the live end that run lighter
const XMIN = 2.6, XMAX = 61.4; // the walls, in LEDs, for a line's centre
const XC = (XMIN + XMAX) / 2, XH = (XMAX - XMIN) / 2;
const KC = 0.006; // pull to the middle, at the wall
const KS = 0.0022; // pull toward its slot, per LED away
const SLOT_MAX = 10; // the most LEDs away that count for that pull
const KR = 0.025; // push between neighbours
const RAD_BOOST = 1.8, RAD_TAU = 45; // the radiation after a mass extinction: split rate up, extinction rate down
const MASS_SPREAD = 7; // rows over which a mass extinction takes its victims
const HUE0 = 0.78, HUE_SPAN = 0.27;

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// Everything the knobs set about the model, from the knob values.
function params(kv) {
  const u = cl((kv[2] + 1) / 2, 0, 1); // diversity 0..1
  const w = cl((kv[3] + 1) / 2, 0, 1); // wander 0..1
  const mu = pow(110 / 38, u) / 110; // extinction rate a row and a lineage
  const pitch = u < 0.5 ? 7.0 * pow(4.4 / 7.0, 2 * u) : 4.4 * pow(2.9 / 4.4, 2 * u - 1);
  const tau = 5 + 9 * pow(w, 2);
  return {
    u,
    hue: kv[0],
    speed: 1.45 * cl(kv[1], 1.2, 4),
    pitch,
    hw: 0.88 + 0.6 * pow(1 - u, 1.6),
    thr: (0.95 - 0.1 * u) * pitch,
    mu,
    lam: 3.5 * mu,
    sv: 0.03 * pow(24, pow(w, 1.3)),
    tau, // rows a sideways velocity is remembered for: short for a jitter, long for a slow sweep
    av: exp(-1 / tau),
    nv: sqrt(1 - exp(-2 / tau)),
  };
}

function newLine(P, s0, x, q, v, sib) {
  const L = { s0, xs: [x], qs: [q], v, sib, age: 0, end: -1, kind: 0, die: -1 };
  P.all.push(L);
  return L;
}

const reflect = (q) => (q > 1 ? 2 - q : q < -1 ? -2 - q : q);

function stepSim(P, par) {
  const m = P.m;
  let live = P.live;
  // Mass extinction: most of the living die within a few rows, two or more are spared at random.
  if (m >= P.nextMass) {
    const n = live.length;
    if (n >= 4) {
      const keep = max(2, Math.round(n * (0.2 + 0.2 * Math.random())));
      const idx = live.map((_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = floor(Math.random() * (i + 1));
        const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
      }
      for (let k = keep; k < n; k++) {
        const L = live[idx[k]];
        if (L.die < 0) L.die = m + floor(Math.random() * MASS_SPREAD);
      }
      P.rad0 = m;
      P.nextMass = m + 50 + 50 * -log(1 - Math.random());
    } else P.nextMass = m + 20;
  }
  const rad = m >= P.rad0 ? exp(-(m - P.rad0) / RAD_TAU) : 0;
  const lamK = par.lam * (1 + RAD_BOOST * rad);
  const muK = par.mu * (1 - 0.7 * rad);
  // Extinctions, then splits.
  let nEff = 0;
  for (const L of live) if (L.die < 0) nEff++;
  const next = [];
  for (let i = 0; i < live.length; i++) {
    const L = live[i];
    let dead = false;
    if (L.die >= 0) dead = L.die <= m;
    else if (nEff > 2 && Math.random() < muK) { dead = true; nEff--; }
    if (dead) { L.kind = 1; L.end = m; continue; }
    next.push(L);
  }
  live = next;
  const out = [];
  for (let i = 0; i < live.length; i++) {
    const L = live[i];
    if (L.die < 0) {
      const x = L.xs[L.xs.length - 1];
      // Room on each side, counting the half pitch a neighbour that has just split is about to take.
      const lp = out.length ? out[out.length - 1] : null;
      const xl = lp ? lp.xs[lp.xs.length - 1] + (lp.age === 0 && lp.s0 === m ? 0.5 * par.pitch : 0) : XMIN - 0.8 * par.pitch;
      const xr = i < live.length - 1 ? live[i + 1].xs[live[i + 1].xs.length - 1] : XMAX + 0.8 * par.pitch;
      const room = cl((min(x - xl, xr - x) - par.thr) / (0.6 * par.pitch), 0, 1);
      if (Math.random() < lamK * room) {
        L.kind = 2; L.end = m;
        const q = L.qs[L.qs.length - 1];
        const v0 = (0.5 * par.pitch) / par.tau * (0.85 + 0.3 * Math.random());
        const a = newLine(P, m, x, reflect(q - 0.1 - 0.07 * Math.random()), L.v - v0, null);
        const b = newLine(P, m, x, reflect(q + 0.1 + 0.07 * Math.random()), L.v + v0, a);
        a.sib = b;
        out.push(a, b);
        nEff++;
        continue;
      }
    }
    out.push(L);
  }
  live = out;
  const n = live.length;
  const hq = 0.055 * (1 + 1.5 * rad); // hue drifts faster while the tree radiates
  // The step: velocity, forces, noise, position.
  const x = P.bx, v = P.bv, x0 = P.bx0;
  for (let i = 0; i < n; i++) { x[i] = live[i].xs[live[i].xs.length - 1]; x0[i] = x[i]; v[i] = live[i].v; }
  // A gentle pull toward even spacing across the whole width: line i of n is drawn toward the middle of the
  // i-th of n equal slots, so a tree that has crept to one side drifts back and spreads out again.
  for (let i = 0; i < n; i++) {
    const u = (x[i] - XC) / XH;
    v[i] += KS * cl(XMIN + ((i + 0.5) / n) * (XMAX - XMIN) - x[i], -SLOT_MAX, SLOT_MAX) - KC * u * u * u;
  }
  const R = 1.4 * par.pitch;
  for (let i = 0; i < n - 1; i++) {
    const A = live[i], B = live[i + 1];
    if (A.sib === B && A.age < AF) continue;
    const g = x[i + 1] - x[i];
    if (g < R) {
      const f = (KR * (R - g)) / R;
      v[i] -= f; v[i + 1] += f;
    }
  }
  const RW = 1.0 * par.pitch;
  for (let i = 0; i < n; i++) {
    const gw = x[i] - XMIN, ge = XMAX - x[i];
    if (gw < RW) v[i] += (KR * (RW - gw)) / RW;
    if (ge < RW) v[i] -= (KR * (RW - ge)) / RW;
  }
  for (let i = 0; i < n; i++) {
    const L = live[i];
    const open = min(1, L.age / AF);
    v[i] = par.av * v[i] + par.nv * par.sv * open * gauss();
    x[i] += v[i];
    P.bp[i] = x[i];
  }
  // Keep the order and the gaps. Sisters open their gap over AF rows, everyone else keeps one pitch; when the
  // tree is too crowded to keep them all, every gap shrinks by the same share.
  const need = P.bn;
  let tot = 0;
  for (let i = 0; i < n - 1; i++) {
    const A = live[i];
    let G = par.pitch;
    if (A.sib === live[i + 1] && A.age < AF) {
      const r = (A.age + 1) / AF;
      G = par.pitch * (1 - (1 - r) * (1 - r));
    }
    need[i] = G;
    tot += G;
  }
  const sc = tot > XMAX - XMIN ? (XMAX - XMIN) / tot : 1;
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < n; i++) x[i] = cl(x[i], XMIN, XMAX);
    // The sweeps run left to right and right to left in turn, so no side gets the pushes first.
    for (let k = 0; k < n - 1; k++) {
      const i = pass & 1 ? n - 2 - k : k;
      const G = need[i] * sc, g = x[i + 1] - x[i];
      if (g < G) { const d = (G - g) / 2; x[i] -= d; x[i + 1] += d; }
    }
  }
  for (let i = 0; i < n; i++) x[i] = cl(x[i], XMIN, XMAX);
  for (let i = 0; i < n; i++) {
    const L = live[i];
    // A line keeps its own velocity and only a part of the shove the gaps gave it, so a crowd moving aside does
    // not leave long straight slants behind it.
    L.v = cl(v[i] + 0.3 * (x[i] - P.bp[i]), -0.8, 0.8);
    L.age++;
    L.xs.push(x[i]);
    L.qs.push(reflect(L.qs[L.qs.length - 1] + hq * gauss()));
  }
  P.live = live;
  P.m = m + 1;
}

function hueTable(P, hue) {
  P.hk = hue;
  for (let i = 0; i < 256; i++) {
    const q = i / 127.5 - 1;
    let h = HUE0 + hue + HUE_SPAN * q;
    h -= floor(h);
    const s = 0.84, vv = 1;
    const k = h * 6, j = floor(k), f = k - j;
    const p = vv * (1 - s), qq = vv * (1 - s * f), t = vv * (1 - s * (1 - f));
    const rgb = [[vv, t, p], [qq, vv, p], [p, vv, t], [p, qq, vv], [t, p, vv], [vv, p, qq]][j % 6];
    // Cyan and yellow-green are far brighter to the eye than blue at the same value; ease them down so no
    // clade shouts over the rest.
    const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    const k255 = 255 * cl(0.64 / lum, 0.7, 1);
    P.lut[i * 3] = rgb[0] * k255; P.lut[i * 3 + 1] = rgb[1] * k255; P.lut[i * 3 + 2] = rgb[2] * k255;
  }
}

export function setup(P) {
  P.ready = false;
  P.all = [];
  P.live = [];
  P.m = 0;
  P.T = 0;
  P.nextMass = 0;
  P.rad0 = -1e9;
  P.hk = -9;
  P.lut = new Float32Array(256 * 3);
  P.buf = new Float32Array(NPX * 3);
  P.bx = new Float64Array(128); P.bv = new Float64Array(128); P.bx0 = new Float64Array(128); P.bn = new Float64Array(128); P.bp = new Float64Array(128);
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const par = params(kv);
  P.par = par;
  if (!P.ready) {
    P.ready = true;
    const xs = [XC - 0.55 * XH, XC, XC + 0.55 * XH];
    for (let i = 0; i < 3; i++) P.live.push(newLine(P, 0, xs[i] + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 1.4, 0, null));
    P.nextMass = 60 + floor(Math.random() * 140);
    for (let i = 0; i < 900; i++) stepSim(P, par);
    P.T = P.m - 2;
  }
  if (abs(par.hue - P.hk) > 1e-4) hueTable(P, par.hue);
  P.T += cl(dt, 0, 0.1) * par.speed;
  while (P.m < floor(P.T) + 2) stepSim(P, par);
  // Forget the lines that have scrolled off the top.
  if (P.all.length > 60) P.all = P.all.filter((L) => L.kind === 0 || L.end > P.T - H - 4);
  renderBuf(P, par);
}

function renderBuf(P, par) {
  const { buf, lut } = P;
  const T = P.T;
  buf.fill(0);
  const hw = par.hw;
  for (const L of P.all) {
    const live = L.kind === 0;
    const e = live ? 1e9 : L.end;
    const tEnd = min(e, T);
    const yLo = max(0, ceil(H - 1 - (T - L.s0))), yHi = min(H - 1, floor(H - 1 - (T - tEnd)));
    const nx = L.xs.length;
    for (let y = yLo; y <= yHi; y++) {
      const t = T - (H - 1 - y);
      const idx = t - L.s0;
      let i0 = floor(idx);
      if (i0 < 0) i0 = 0;
      const i1 = min(i0 + 1, nx - 1), f = cl(idx - i0, 0, 1);
      const xc = L.xs[i0] + (L.xs[i1] - L.xs[i0]) * f;
      const q = L.qs[i0] + (L.qs[i1] - L.qs[i0]) * f;
      let amp = 1, w = hw;
      let val = 1 - 0.22 * (1 - y / (H - 1));
      if (L.kind === 1) {
        const g = smooth((e - t) / TAPER);
        w = hw * (0.4 + 0.6 * g);
        amp = 0.62 + 0.38 * g;
      }
      const ci = floor((q + 1) * 127.5 + 0.5) * 3;
      let cr = lut[ci] * val, cg = lut[ci + 1] * val, cb = lut[ci + 2] * val;
      if (live) {
        const hd = H - 1 - y;
        if (hd < HEAD) {
          const k = 0.38 * (1 - hd / HEAD);
          cr += (255 - cr) * k; cg += (255 - cg) * k; cb += (255 - cb) * k;
        }
      }
      const xa = max(0, floor(xc - w - 1.0)), xb = min(W - 1, ceil(xc + w + 1.0));
      for (let px = xa; px <= xb; px++) {
        const d = abs(px + 0.5 - xc);
        const c0 = cl((w + 0.45 - d) / 0.9, 0, 1);
        if (c0 <= 0) continue;
        const a = c0 * c0 * (3 - 2 * c0) * amp;
        const o = (y * W + px) * 3;
        buf[o] += cr * a * (1 - buf[o] / 255);
        buf[o + 1] += cg * a * (1 - buf[o + 1] / 255);
        buf[o + 2] += cb * a * (1 - buf[o + 2] / 255);
      }
    }
  }
}

export function draw(display, P) {
  const { buf } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, buf[o] > 255 ? 255 : buf[o], buf[o + 1] > 255 ? 255 : buf[o + 1], buf[o + 2] > 255 ? 255 : buf[o + 2]);
    }
}
