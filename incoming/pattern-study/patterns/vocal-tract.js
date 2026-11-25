// ===== Patternflow pattern =====
// Title:   Vocal Tract
// Family:  vocaltract
// Idea:    A Kelly-Lochbaum tube stands up the panel, a chain of sixty cylinders whose widths are the cross-section of a throat that slides between vowel shapes, with glottal pulses entering at the foot as rose compressions trailed by blue rarefactions, climbing the tube slowed to under a second, throwing a smaller echo back from every narrowing and an inverted one from every widening, and leaving the open top as round waves.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the digital model of the vocal tract as a chain of cylindrical tubes with a forward and a backward travelling wave and a reflection coefficient k = (A1 - A2) / (A1 + A2) at each change of area (Kelly and Lochbaum 1962, from memory); the scattering-junction waveguide that Julius O. Smith's digital waveguide notes lay out (from memory); the source-filter picture of speech, a pulse train from the glottis shaped by the resonances of the tube (Gunnar Fant 1960, from memory); the area functions are invented shapes, not measured ones, and the time is slowed to about 0.85 s for the pulse to cross the tube; pattern round 242
// Round:   242
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pitch=0..4, Shape=-1..1, Loss=-1..1
//
// Knob 1: Hue. Turns the pressure colours round the wheel and opens on rose for compression with a deep blue for rarefaction, the blue always lying 0.3 of the wheel behind the compression colour. The wall line and the dark ground stay pale and dark.
// Knob 2: Pitch. 0 to 4, opening at 2: how many glottal pulses are climbing the tube at once, 1.5 at 0, 3.2 at 2 and 7 at 4, each one jittered a little in its spacing and its strength. Low, a few separate bands cross a dark tube; high, the bands run together and the echoes standing between them show as stripes that hold their place in a resonance.
// Knob 3: Shape. -1 to 1, opening at 0: the lean of every vowel shape. At -1 the back of the tube is wide, the front narrow and the lip end pinched; at 1 the back is narrow and the front opens wide. The throat still slides between its shapes on its own, so this moves where every one of them sits.
// Knob 4: Loss. -1 to 1, opening at 0.06 near the middle: how much of a wave the wall takes on each section and how much the lip end throws back, 0.97 of it at -1 and 0.55 at 1. At -1 the pulses keep ringing up and down the tube for ten seconds and the radiated rings are faint; at 1 each one climbs, leaves and is gone.

const W = 64, H = 128;
const { floor, min, max, abs, sin, cos, sqrt, exp, tanh, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

// ---- the tube ---------------------------------------------------------------
const N = 60;                    // sections, glottis at 0, lips at N - 1
const T_CROSS = 0.85;            // seconds a wave takes to go the length of the tube
const DTS = T_CROSS / N;         // one step of the waveguide
const Y_G = 117.5, Y_L = 22.5;   // rows of the glottis end and the lip end
const CX = 31.5;                 // the axis
const CP = 9;                    // control points of a shape, glottis to lips
const NV = 9;
// Relative radii from the glottis to the lips. They are made up to have the look of the old area functions: a wide back
// cavity against a narrow front one and the other way about, a pinch at the palate, a pinch at the lips only, and so on.
const VOW = [
  [0.45, 0.38, 0.32, 0.30, 0.45, 0.72, 0.95, 1.00, 1.00],
  [0.40, 0.75, 0.95, 1.00, 0.85, 0.45, 0.20, 0.18, 0.35],
  [0.45, 0.62, 0.80, 0.52, 0.24, 0.30, 0.85, 0.78, 0.26],
  [0.50, 0.46, 0.52, 0.62, 0.50, 0.52, 0.82, 0.92, 0.92],
  [0.45, 0.34, 0.42, 0.66, 0.90, 0.78, 0.52, 0.40, 0.34],
  [0.58, 0.60, 0.60, 0.62, 0.62, 0.62, 0.60, 0.60, 0.62],
  [0.60, 0.72, 0.82, 0.88, 0.92, 0.84, 0.68, 0.30, 0.14],
  [0.90, 0.55, 0.25, 0.22, 0.50, 0.90, 1.00, 0.70, 0.50],
  [0.25, 0.22, 0.60, 0.95, 0.60, 0.22, 0.30, 0.80, 0.95],
];
const WMIN = 6, WMAX = 40;       // the width of the tube in LED, for relative radius 0 and 1
const AF = 2;                    // area is width to this power

// Catmull-Rom through the control points, x from 0 to 1.
function prof(c, x) {
  const u = cl(x, 0, 1) * (CP - 1);
  let i = floor(u);
  if (i > CP - 2) i = CP - 2;
  const f = u - i;
  const p0 = c[i > 0 ? i - 1 : 0], p1 = c[i], p2 = c[i + 1], p3 = c[i + 2 < CP ? i + 2 : CP - 1];
  return p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)));
}

// ---- noise ------------------------------------------------------------------
function ih(a, b, s) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, k, s) {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return mix(ih(i, k, s), ih(i + 1, k, s), u);
}
const gauss = () => cl((Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.7320508, -2, 2);

// ---- colour -----------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}
const NL = 256;
const GROUND = [3, 2, 9];
const INSIDE = [15, 10, 38];
const HUE0 = 0.935;              // rose, where the knob opens
// A dim colour on the red to olive stretch of the wheel reads brown, so there it is paled and lifted.
function brown(h, m) {
  const hh = h - floor(h);
  return (hh > 0.5 ? sstep(0.8, 0.95, hh) : 1 - sstep(0.13, 0.26, hh)) * (1 - m);
}
function buildLut(st, hue) {
  const c = [0, 0, 0];
  const hp = HUE0 + hue, hn = hp - 0.3;
  for (let i = 0; i < NL; i++) {
    const m = i / (NL - 1), a = sstep(0, 0.2, m);
    let b = brown(hp, m);
    hsv(hp, (0.8 - 0.42 * m * m) * (1 - 0.3 * b), min(1, (0.4 + 0.6 * pow07(m)) * (1 + 0.1 * b)), c, 0);
    for (let k = 0; k < 3; k++) st.lp[i * 3 + k] = mix(INSIDE[k], c[k], a);
    b = brown(hn, m);
    hsv(hn, (0.92 - 0.34 * m * m) * (1 - 0.3 * b), min(1, (0.34 + 0.6 * pow07(m)) * (1 + 0.1 * b)), c, 0);
    for (let k = 0; k < 3; k++) st.ln[i * 3 + k] = mix(INSIDE[k], c[k], a);
  }
  hsv(hp + 0.03, 0.3, 1, st.wall, 0);
}
const pow07 = (m) => Math.pow(m, 0.7);

// ---- the glottal pulse ------------------------------------------------------
// Compression first, then a rarefaction, over about seven steps: a flow derivative with the sharp closure left out.
const UPOS = 0.58;
function shape(u) {
  if (u < 0 || u >= 1) return 0;
  if (u < UPOS) {
    const s = sin((PI * u) / UPOS);
    return s * s;
  }
  const s = sin((PI * (u - UPOS)) / (1 - UPOS));
  return -0.9 * s * s;
}

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, ts: 0, acc: 0, hue: -9,
    rt: new Float64Array(N), lf: new Float64Array(N), nrt: new Float64Array(N), nlf: new Float64Array(N),
    K: new Float64Array(N - 1), P0: new Float64Array(N + 1), P1: new Float64Array(N + 1),
    hist: new Float32Array(128), hp: 0,
    ctrl: new Float64Array(CP), tgt: new Float64Array(CP),
    pulses: [], nextP: 0.1, rms: 0.4, glow: 0,
    lossF: 0.99, rl: -0.8, rg: 0.75, radg: 0.7, npl: 3.2, bias: 0,
    tNext: 5 + Math.random() * 8, tHold: 0, pull: 0, goal: 0,
    af: [], ph: [Math.random() * 6.283, Math.random() * 6.283, Math.random() * 6.283], seed: floor(Math.random() * 1e9),
    lp: new Float32Array(NL * 3), ln: new Float32Array(NL * 3), wall: [255, 255, 255],
    hw: new Float32Array(H), ps: new Float32Array(H), sl: new Float32Array(H), ef: new Float32Array(H), en: new Float32Array(H),
    tmp: [0, 0, 0],
  });
  // each vowel moves with three slow sines whose frequencies share no common period
  const base = [0.0317, 0.0521, 0.0883];
  for (let v = 0; v < NV; v++) {
    const f = [];
    for (let j = 0; j < 3; j++) f.push({ f: base[j] * (0.7 + 0.6 * Math.random()), p: Math.random() * 6.283, a: [0.5, 0.35, 0.25][j] });
    st.af.push(f);
  }
  return st;
}

function derive(st) {
  const k = st.k;
  st.npl = 1.5 * Math.pow(2, 0.55 * cl(k[1], 0, 4));
  st.bias = cl(k[2], -1, 1);
  const L = (cl(k[3], -1, 1) + 1) / 2;
  st.lossF = 1 - (0.0015 + 0.022 * L * L);
  st.rl = -(0.97 - 0.42 * L);
  st.rg = 0.85 - 0.3 * L;
  st.radg = Math.pow(1 + st.rl, 0.35) * 1.5;
}

// The shape the throat has at time t: a soft maximum of nine vowel shapes whose weights are slow sines, now and then drawn
// towards a target made of two shapes and some noise, with the lean of the Shape knob put on top.
function wander(st, dt) {
  const t = st.t, c = st.ctrl;
  if (t > st.tNext) {
    const a = floor(Math.random() * NV), b = floor(Math.random() * NV), wa = 0.3 + 0.7 * Math.random();
    for (let m = 0; m < CP; m++) st.tgt[m] = cl(VOW[a][m] * wa + VOW[b][m] * (1 - wa) + 0.22 * (Math.random() - 0.5), 0.12, 1);
    st.goal = 0.5 + 0.3 * Math.random();
    st.tHold = t + 4 + 6 * Math.random();
    st.tNext = t + 20 + 28 * Math.random();
  }
  if (t > st.tHold) st.goal = 0;
  st.pull += (st.goal - st.pull) * (1 - exp(-dt / 2.4));
  const w = [];
  let mx = -9;
  for (let v = 0; v < NV; v++) {
    let s = 0;
    for (const o of st.af[v]) s += o.a * sin(6.2831853 * o.f * t + o.p);
    w.push(s);
    if (s > mx) mx = s;
  }
  let tot = 0;
  for (let v = 0; v < NV; v++) tot += w[v] = exp(3.2 * (w[v] - mx));
  for (let m = 0; m < CP; m++) {
    let r = 0;
    for (let v = 0; v < NV; v++) r += VOW[v][m] * w[v];
    r /= tot;
    r += 0.07 * (vn(t * 0.09 + m * 2.3, m, st.seed) - 0.5) * 2;
    r = mix(r, st.tgt[m], st.pull);
    // the lean: back wide and front narrow for a low knob with the lip end pinched, the other way about for a high one
    const x = m / (CP - 1), s = st.bias, lip = exp(-((x - 0.97) / 0.1) * ((x - 0.97) / 0.1));
    r *= exp(0.85 * s * (2 * x - 1));
    if (s < 0) r *= 1 + 0.5 * s * lip;
    r = r / Math.pow(1 + Math.pow(r / 1.02, 4), 0.25);
    c[m] = cl(r, 0.12, 1);
  }
}

function tubeAreas(st) {
  const c = st.ctrl, K = st.K;
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const wd = WMIN + (WMAX - WMIN) * cl(prof(c, (i + 0.5) / N), 0.08, 1.05);
    const a = Math.pow(wd, AF);
    if (i > 0) K[i - 1] = (prev - a) / (prev + a);
    prev = a;
  }
}

// ---- the waveguide ----------------------------------------------------------
function glottis(st) {
  let g = 0;
  const ps = st.pulses;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i], u = (st.ts - p.t0) / p.w;
    if (u >= 1) ps.splice(i, 1);
    else g += p.a * shape(u);
  }
  return g;
}

function launch(st) {
  const t = st.t;
  while (st.ts >= st.nextP) {
    const n = st.npl * (1 + 0.1 * sin(6.2831853 * 0.0431 * t + st.ph[0]) + 0.07 * sin(6.2831853 * 0.0713 * t + st.ph[1]));
    // a pulse is stronger or weaker with a slow shimmer and a little of its own, and now and then one is weak
    const am = (0.8 + 0.4 * vn(t * 0.35, 3, st.seed)) * (1 + 0.15 * gauss()) * (Math.random() < 0.05 ? 0.45 : 1);
    st.pulses.push({ t0: st.nextP, w: DTS * (6.5 + 2.5 * Math.random()), a: am });
    st.nextP += (T_CROSS / n) * cl(1 + 0.1 * gauss(), 0.6, 1.5);
  }
}

function step(st) {
  const rt = st.rt, lf = st.lf, nrt = st.nrt, nlf = st.nlf, K = st.K, P = st.P1, L = st.lossF;
  st.P0.set(P);
  launch(st);
  const g = glottis(st);
  const in0 = g + st.rg * lf[0];
  P[0] = in0 + lf[0];
  nrt[0] = L * in0;
  for (let j = 0; j < N - 1; j++) {
    const a = rt[j], c = lf[j + 1], k = K[j], inL = k * a + (1 - k) * c;
    nrt[j + 1] = L * ((1 + k) * a - k * c);
    nlf[j] = L * inL;
    P[j + 1] = a + inL;
  }
  const aL = rt[N - 1], bL = st.rl * aL;
  nlf[N - 1] = L * bL;
  P[N] = aL + bL;
  st.rt = nrt;
  st.nrt = rt;
  st.lf = nlf;
  st.nlf = lf;
  st.ts += DTS;
  st.hp = (st.hp + 1) & 127;
  st.hist[st.hp] = aL * st.radg;
  st.glow += (abs(g) - st.glow) * 0.4;
}

function advance(st, dt) {
  st.t += dt;
  wander(st, dt);
  tubeAreas(st);
  st.acc += dt;
  while (st.acc >= DTS) {
    st.acc -= DTS;
    step(st);
  }
  let e = 0;
  for (let i = 0; i <= N; i++) e += st.P1[i] * st.P1[i];
  st.rms += (sqrt(e / (N + 1)) - st.rms) * (1 - exp(-dt / 1.2));
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  derive(st);
  if (!st.init) {
    st.init = true;
    st.t = 40 * Math.random();
    st.nextP = st.ts + 0.05;
    st.tNext = st.t + 6 + 6 * Math.random();
    // run the tube for ten seconds so the pulses are already climbing in it
    for (let i = 0; i < 300; i++) advance(st, 1 / 30);
    return;
  }
  advance(st, cl(dt || 0, 0, 0.1));
}

// ---- drawing ----------------------------------------------------------------
const CRAD = 0.9;                // rows a step for the round waves leaving the lips

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  if (abs(st.k[0] - st.hue) > 1e-4) (st.hue = st.k[0]), buildLut(st, st.k[0]);
  const w = st.acc / DTS, P0 = st.P0, P1 = st.P1, ctrl = st.ctrl;
  const agc = 1 / max(1, st.rms / 0.6), lp = st.lp, ln = st.ln, wl = st.wall;
  const hw = st.hw, ps = st.ps, sl = st.sl, ef = st.ef, en = st.en;
  const span = Y_G - Y_L;
  // the rows: half width, pressure, how steep the wall runs, and a fade at the two ends
  for (let y = 0; y < H; y++) {
    const yy = y + 0.5, x = cl((Y_G - yy) / span, 0, 1), m = x * N, i = min(floor(m), N - 1), f = m - i;
    const p = mix(mix(P0[i], P1[i], w), mix(P0[i + 1], P1[i + 1], w), f);
    ps[y] = tanh((p * agc) / 0.85);
    hw[y] = 0.5 * (WMIN + (WMAX - WMIN) * cl(prof(ctrl, x), 0.08, 1.05));
  }
  for (let y = 0; y < H; y++) {
    const a = hw[y > 0 ? y - 1 : 0], b = hw[y < H - 1 ? y + 1 : H - 1], s = (b - a) / 2;
    sl[y] = sqrt(1 + s * s);
    ef[y] = sstep(Y_L - 1.5, Y_L + 2.5, y + 0.5) * (1 - sstep(Y_G - 2, Y_G + 2, y + 0.5));
    en[y] = abs(ps[y]);
  }
  // the lip end: the wave that has gone out, kept as a history, drawn as rings round the lip
  const hist = st.hist, hp = st.hp;
  const radius = 27;
  for (let y = 0; y < H; y++) {
    const yy = y + 0.5, h = hw[y], sg = ps[y], sf = sl[y], ee = ef[y];
    const dyv = Y_L - yy, below = Y_G - yy;
    const near = yy > Y_L - 1.5 && yy < Y_G + 6;
    for (let x = 0; x < W; x++) {
      let r = GROUND[0], g = GROUND[1], b = GROUND[2];
      const dx = abs(x + 0.5 - CX);
      if (yy < Y_L + 1 && dyv > -1) {
        // the rings
        const d = sqrt(dx * dx + dyv * dyv + 0.25);
        if (d < radius) {
          const age = d / CRAD + (1 - w), a0 = floor(age), fa = age - a0;
          const s = mix(hist[(hp - a0) & 127], hist[(hp - a0 - 1) & 127], fa);
          const ang = 0.35 + 0.65 * max(0, dyv) / d;
          const v = tanh((s * agc * ang) / (0.85 * (1 + d / 9))) * (1 - sstep(15, radius, d));
          const idx = floor(min(1, abs(v)) * (NL - 1)) * 3, lut = v >= 0 ? lp : ln, al = sstep(0, 0.12, abs(v));
          r = mix(r, lut[idx], al);
          g = mix(g, lut[idx + 1], al);
          b = mix(b, lut[idx + 2], al);
        }
      }
      if (near) {
        const d = dx - h;
        if (ee > 0) {
          // inside the tube: pressure, a little less towards the wall
          const ci = cl(0.5 - d, 0, 1) * ee;
          if (ci > 0) {
            const cr = dx / (h + 0.01), v = sg * (1 - 0.2 * cr * cr);
            const idx = floor(min(1, abs(v)) * (NL - 1)) * 3, lut = v >= 0 ? lp : ln;
            r = mix(r, lut[idx], ci);
            g = mix(g, lut[idx + 1], ci);
            b = mix(b, lut[idx + 2], ci);
          }
          // a glow outside the wall in the colour of the pressure behind it
          if (d > 0) {
            const hl = exp(-d / 3) * abs(sg) * 0.4 * ee;
            if (hl > 0.004) {
              const idx = floor(min(1, abs(sg) * 0.9) * (NL - 1)) * 3, lut = sg >= 0 ? lp : ln;
              r = mix(r, lut[idx], hl);
              g = mix(g, lut[idx + 1], hl);
              b = mix(b, lut[idx + 2], hl);
            }
          }
          // the wall: a line 2 LED thick that does not thin where the wall runs across
          const cw = cl(((1.1 * sf - abs(d)) / sf) * 1.1 + 0.5, 0, 1) * ee;
          if (cw > 0) {
            const br = 0.5 + 0.5 * min(1, en[y] * 1.3);
            r = mix(r, wl[0] * br, cw);
            g = mix(g, wl[1] * br, cw);
            b = mix(b, wl[2] * br, cw);
          }
        }
      }
      if (below < 0 && yy < Y_G + 12) {
        // the glottis: the source, a soft glow under the foot of the tube
        const hg = hw[H - 1 > 0 ? floor(Y_G) : 0];
        const gx = dx / (hg + 2), gy = -below / 5, v = tanh(st.glow * 1.2) * exp(-gx * gx - gy * gy * 1.2) * 0.9;
        if (v > 0.01) {
          const idx = floor(min(1, v) * (NL - 1)) * 3;
          r = mix(r, lp[idx], min(1, v * 1.2));
          g = mix(g, lp[idx + 1], min(1, v * 1.2));
          b = mix(b, lp[idx + 2], min(1, v * 1.2));
        }
      }
      display.setPixel(x, y, cl(r + 0.5, 0, 255) | 0, cl(g + 0.5, 0, 255) | 0, cl(b + 0.5, 0, 255) | 0);
    }
  }
}
