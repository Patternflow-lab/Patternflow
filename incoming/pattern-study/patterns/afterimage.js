// ===== Patternflow pattern =====
// Title:   Afterimage
// Family:  adaptation
// Idea:    Big soft-edged fields of saturated colour slide over black and cut to new hues at random moments, and the panel draws what the retina adds: each LED tires of the colour it is shown and drifts toward grey, and where a colour has just left it lights the opposite colour as a pastel ghost that fades over seconds, red leaving cyan, blue leaving yellow, green leaving magenta.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Troxler fading (Ignaz Troxler, 1804), the opponent-colour afterimage (Ewald Hering's opponent-process theory, 1878) and the gain control of the cone responses (Johannes von Kries, 1902); every LED keeps three adaptation states that follow what it is shown, the picture is the stimulus desaturated by what the LED has adapted to plus the complement of the adapted colour where that colour is no longer shown, and the sliding, cutting, hue-drifting fields that feed it are original, pattern round 255
// Round:   255
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Slide=0..3, Fatigue=-1..1, Echo=-1..1
//
// Knob 1: Hue. Turns the whole colour set round the wheel; it opens on orange, lime, spring green, azure, violet and rose, six fields apart by a sixth of the wheel each, so every colour has its opposite on the panel. Turned while the fields stand, every field changes colour at once and leaves the ghost of the old one.
// Knob 2: Slide. 0 to 3, opening at 2. How fast the fields travel, mostly up and down the tall panel with a little sideways; at 2 a field takes twenty to forty-five seconds to cross it, at 0 they stand still, every colour tires toward grey and the cuts still flip them, which is where the ghosts show best.
// Knob 3: Fatigue. -1 to 1, opening at 0. How long an LED takes to tire of a colour and to forget it again: 1.1 s at -1, 3 s at the start, 8 s at 1. Short and the fields hardly grey and the ghosts are quick flickers; long and they grey slowly and leave trails that hang for ten seconds.
// Knob 4: Echo. -1 to 1, opening at about 0.06. How loud the ghost is: at -1 there is none and the fields only slide and grey, at the start the ghost peaks at about four fifths of the colour that made it, at 1 it outshines it.

const W = 64, H = 128, N = W * H;
const NP = 8;                           // fields on the panel
const PADX = 26, PADY = 42;             // a field wraps this far past the edge, so it is out of sight when it jumps
const EDGE = 2.6;                       // half the soft edge of a field, in LED
const HOFF = 0.08;                      // the colour set opens on orange, not red
const { floor, min, max, abs, sqrt, exp, sin, log, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();
const rr = (a, b) => a + (b - a) * rnd();

// a saturated colour of hue h, with the dimmer blues and brighter yellows pulled toward one level
function hue3(h, out) {
  h -= floor(h);
  const h6 = h * 6;
  const r = cl(abs(h6 - 3) - 1, 0, 1);
  const g = cl(2 - abs(h6 - 2), 0, 1);
  const b = cl(2 - abs(h6 - 4), 0, 1);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const gain = min(1, pow(0.78 / max(lum, 0.05), 0.5));
  out[0] = r * gain; out[1] = g * gain; out[2] = b * gain;
}

function newPatch(P) {
  P.x = rr(-PADX * 0.4, W + PADX * 0.4);
  P.y = rr(-PADY * 0.4, H + PADY * 0.4);
  P.a0 = rr(5.5, 14);
  P.b0 = rr(9, 22);
  P.slot = floor(rnd() * 6);
  P.jit = rr(-0.035, 0.035);
}

function makePatch() {
  const P = {
    x: 0, y: 0, a0: 8, b0: 12, slot: 0, jit: 0,
    vx: (rnd() < 0.5 ? -1 : 1) * rr(0.1, 1.6),
    vy: (rnd() < 0.5 ? -1 : 1) * rr(1.4, 3.4),
    // every field drifts on clocks of its own, none a multiple of another
    fm: rr(0.021, 0.061), pm: rnd() * TP,           // speed modulation
    fh: rr(0.017, 0.053), ph: rnd() * TP,           // hue drift
    fs: rr(0.027, 0.071), ps: rnd() * TP,           // breathing of the size
    fa: rr(0.019, 0.047), pa: rnd() * TP,           // brightness
    mean: rr(4, 9),                                 // the average wait between its cuts, in seconds
    tc: 0,
  };
  newPatch(P);
  P.tc = rr(0.5, P.mean * 1.6);
  return P;
}

export function setup(params) {
  const ps = [];
  for (let i = 0; i < NP; i++) ps.push(makePatch());
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, t: 0,
    ps,
    S: new Float32Array(N * 3),
    A: new Float32Array(N * 3),
    cc: [0, 0, 0],
  });
  return st;
}

function cut(st, P, i) {
  const ps = st.ps;
  const r = rnd();
  if (r < 0.45) {
    // a hard change of colour on the spot, usually to something far round the wheel
    const hop = [1, 2, 3, 3, 3, 4, 5];
    P.slot = (P.slot + hop[floor(rnd() * hop.length)]) % 6;
    P.jit = rr(-0.035, 0.035);
  } else if (r < 0.65) {
    // two fields trade colours
    let j = floor(rnd() * NP);
    if (j === i) j = (j + 1) % NP;
    const Q = ps[j];
    const s = P.slot, q = P.jit;
    P.slot = Q.slot; P.jit = Q.jit;
    Q.slot = s; Q.jit = q;
    if (P.slot === Q.slot) P.slot = (P.slot + 3) % 6;
  } else if (r < 0.85) {
    // two fields trade places
    let j = floor(rnd() * NP);
    if (j === i) j = (j + 1) % NP;
    const Q = ps[j];
    const x = P.x, y = P.y;
    P.x = Q.x; P.y = Q.y;
    Q.x = x; Q.y = y;
  } else {
    // one field goes out and another stands where nothing was
    const oldSlot = P.slot;
    newPatch(P);
    P.x = rr(8, W - 8); P.y = rr(14, H - 14);
    if (P.slot === oldSlot) P.slot = (P.slot + 3) % 6;
  }
  const u = max(rnd(), 1e-4);
  P.tc = 1.3 + (-log(u)) * max(P.mean - 1.3, 1);
}

// one step of the world: the fields move and cut, and every LED tires toward what it is shown
function step(st, dt, ks) {
  const t = st.t += dt;
  const slide = cl(ks[1], 0, 3);
  const k1 = ks[0];
  const tau = 3 * pow(2.7, cl(ks[2], -1, 1));
  const ak = 1 - exp(-dt / tau);
  const S = st.S, A = st.A, ps = st.ps, cc = st.cc;
  S.fill(0);

  for (let i = 0; i < NP; i++) {
    const P = ps[i];
    P.tc -= dt;
    if (P.tc <= 0) cut(st, P, i);
    const m = 1 + 0.45 * sin(TP * P.fm * t + P.pm);
    P.x += P.vx * m * slide * dt;
    P.y += P.vy * m * slide * dt;
    if (P.x > W + PADX) P.x -= W + 2 * PADX; else if (P.x < -PADX) P.x += W + 2 * PADX;
    if (P.y > H + PADY) P.y -= H + 2 * PADY; else if (P.y < -PADY) P.y += H + 2 * PADY;

    const br = 1 + 0.12 * sin(TP * P.fs * t + P.ps);
    const a = P.a0 * br, b = P.b0 * (2 - br);
    const hh = HOFF + k1 + P.slot / 6 + P.jit + 0.06 * sin(TP * P.fh * t + P.ph);
    hue3(hh, cc);
    const amp = 0.88 + 0.12 * sin(TP * P.fa * t + P.pa);
    const c0 = cc[0] * amp, c1 = cc[1] * amp, c2 = cc[2] * amp;
    const rad = min(a, b) * 0.55;
    const x0 = max(0, floor(P.x - a - EDGE)), x1 = min(W - 1, floor(P.x + a + EDGE) + 1);
    const y0 = max(0, floor(P.y - b - EDGE)), y1 = min(H - 1, floor(P.y + b + EDGE) + 1);
    const ix = a - rad, iy = b - rad;
    for (let y = y0; y <= y1; y++) {
      const qy = abs(y + 0.5 - P.y) - iy;
      const qyp = qy > 0 ? qy : 0;
      for (let x = x0; x <= x1; x++) {
        const qx = abs(x + 0.5 - P.x) - ix;
        const qxp = qx > 0 ? qx : 0;
        const d = sqrt(qxp * qxp + qyp * qyp) + min(max(qx, qy), 0) - rad;
        let c = (EDGE - d) / (2 * EDGE);
        if (c <= 0) continue;
        if (c > 1) c = 1;
        c = c * c * (3 - 2 * c);
        const j = (y * W + x) * 3;
        S[j] += c0 * c; S[j + 1] += c1 * c; S[j + 2] += c2 * c;
      }
    }
  }

  for (let j = 0; j < N * 3; j++) {
    let s = S[j];
    if (s > 1) { s = 1; S[j] = 1; }
    A[j] += (s - A[j]) * ak;
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
    // the fields have been about for a while: the LEDs are already tired and the ghosts already hang
    for (let n = 0; n < 220; n++) step(st, 0.1, st.ks);
  } else {
    const a = 1 - exp(-dt / 0.15);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  if (dt > 0) step(st, dt, st.ks);
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  const S = st.S, A = st.A;
  const k4 = cl(st.ks[3], -1, 1);
  const G = k4 < 0 ? 0.8 * pow(1 + k4, 1.3) : 0.8 + 1.1 * k4;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 3;
      const s0 = S[j], s1 = S[j + 1], s2 = S[j + 2];
      const a0 = A[j], a1 = A[j + 1], a2 = A[j + 2];
      const sumS = s0 + s1 + s2, sumA = a0 + a1 + a2;
      const mm = min(s0, a0) + min(s1, a1) + min(s2, a2);   // the part of the stimulus the LED has already tired of
      // the stimulus tires toward a dim grey as far as it is what the LED has adapted to
      const fs = sumS > 0.04 ? min(1, mm / sumS) : 0;
      const ds = 0.62 * fs * fs;
      const sm = max(s0, s1, s2);
      const gr = sm * 0.55;
      const dim = 1 - 0.22 * ds;
      let d0 = (s0 * (1 - ds) + ds * gr) * dim;
      let d1 = (s1 * (1 - ds) + ds * gr) * dim;
      let d2 = (s2 * (1 - ds) + ds * gr) * dim;
      // the ghost: the complement of what the LED has adapted to, where that is no longer shown
      // the ghost reads the adaptation with a gain, so it is full before the colour itself has greyed
      const g0 = min(1, 1.45 * a0), g1 = min(1, 1.45 * a1), g2 = min(1, 1.45 * a2);
      const mA = max(g0, g1, g2);
      const chroma = mA - min(g0, g1, g2);
      if (chroma > 0.08) {
        const match = sumA > 0.05 ? min(1, mm / sumA) : 1;
        // the ghost keeps its hue as it fades: a fixed colour, and a level that follows the chroma
        const w = G * (1 - match) * pow((chroma - 0.07) * 1.08, 0.8) / chroma;
        d0 += w * (mA - g0 + 0.12 * chroma);
        d1 += w * (mA - g1 + 0.12 * chroma);
        d2 += w * (mA - g2 + 0.12 * chroma);
      }
      display.setPixel(
        x, y,
        (d0 >= 1 ? 1 : d0 <= 0 ? 0 : d0) * 255 + 0.5 | 0,
        (d1 >= 1 ? 1 : d1 <= 0 ? 0 : d1) * 255 + 0.5 | 0,
        (d2 >= 1 ? 1 : d2 <= 0 ? 0 : d2) * 255 + 0.5 | 0,
      );
    }
  }
}
