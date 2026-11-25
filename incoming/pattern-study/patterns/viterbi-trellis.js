// ===== Patternflow pattern =====
// Title:   Viterbi Trellis
// Family:  viterbi
// Idea:    The trellis of a convolutional code scrolls up the panel, one column per code state and one row of nodes per time step, and a Viterbi decoder keeps one surviving branch into every state, so the survivors braid together and merge into one near-white decoded path a few steps back, while bursts of channel errors flash on the branch that was sent and make rival paths flare and die.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Viterbi algorithm, maximum-likelihood decoding of a convolutional code by keeping one survivor path into every state of its trellis (Andrew Viterbi, 1967, from memory); the rate 1/2 constraint length 4 code with generators 15 and 17 in octal (the textbook code, Forney's trellis of 1973, from memory); the two-state bursty channel that is good most of the time and bad in bursts (Gilbert 1960 and Elliott 1963, from memory); puncturing and erasures that leave a decoder without the bits it would have compared (Cain, Clark and Geist 1979, from memory); the decoder, the channel and the drawing of the survivors, their merge and the branches that were sent are original, pattern round 244
// Round:   244
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=1.5..9, Noise=-0.6..1, Erasure=0..1
//
// Knob 1: Hue. Turns the whole picture round the wheel and opens in electric cyan, with the lattice running to violet, the weak survivors in magenta and the error flashes in amber. The flashes turn with the rest and stay a warm contrast to the lattice.
// Knob 2: Speed. 1.5 to 9 steps a second, opening at 2: how fast the trellis scrolls up and new steps of the code come in from the bottom edge. At 1.5 one step crosses the panel in 8 s and the braid can be followed branch by branch; at 9 it streams.
// Knob 3: Noise. -0.6 to 1, opening at 0: how often the channel is in its bad state and how bad it is. At -0.6 the channel is clean, no flashes come, and the survivors merge into the decoded path 4 or 5 steps back. At the opening a burst of errors comes every few seconds. At 1 the channel is bad half the time, flashes run along the path, and four or five rival paths stay alive 6 steps back.
// Knob 4: Erasure. 0 to 1, opening at 0.06: the share of coded bits that are erased before the decoder sees them, up to 70 percent. A step that lost bits glows as a faint band across the panel, and the decoder has nothing to compare, so rivals tie and live on: at 0 the survivors merge in about 4 steps, and at 1 they stay split down the whole length of the panel.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, exp, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();

// ---- the code ---------------------------------------------------------------
// Rate 1/2, constraint length 4, so 8 states. A state is the last three source bits, the newest in bit 2. The coder
// takes a new bit u, forms r = u<<3 | state, and sends two parities of r: taps 1101 and 1111 (15 and 17 octal).
// The next state is u<<2 | state>>1, so state ns is entered from (ns&3)<<1 and (ns&3)<<1 | 1.
const NS = 8;
const OUT = new Uint8Array(16);
const par = (x) => {
  x ^= x >> 2;
  x ^= x >> 1;
  return x & 1;
};
for (let r = 0; r < 16; r++) OUT[r] = par(r & 13) | (par(r & 15) << 1);

// The states stand across the panel in the order that makes the branches shortest (found by trying all 40320).
const COLST = [0, 1, 4, 2, 5, 3, 6, 7];
const XS = new Float32Array(NS);
for (let c = 0; c < NS; c++) XS[COLST[c]] = 4 + 8 * c;
const XCOL = new Float32Array(NS);
for (let c = 0; c < NS; c++) XCOL[COLST[c]] = c;

const RS = 10;          // LED between one step and the next
const NH = 48;          // steps kept
const YREF = 118;       // row of the step that has just come on
const PRE = 140;        // steps run before the first frame
const OCC = 60;         // steps over which the rails remember where the code has been
const NVIS = 18;        // steps looked at when drawing

// ---- colour -----------------------------------------------------------------
// a dim colour on the orange and yellow stretch of the wheel reads brown on the panel, so it is paled
const warm = (h) => {
  const d = (h - floor(h) - 0.1) * 6;
  return exp(-d * d);
};
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- state ------------------------------------------------------------------
export function setup(params) {
  params.st = {
    k: [0, 2, 0, 0.06], init: false,
    T: 0, u: 0, ts: 0, bad: false,
    M: new Float64Array(NS),
    pred: new Int8Array(NH * NS), gap: new Float32Array(NH * NS),
    trueS: new Int8Array(NH), flips: new Uint8Array(NH), erased: new Uint8Array(NH), recv: new Uint8Array(NH), emask: new Uint8Array(NH), fade: new Float32Array(NH), fz: 0,
    cnt: new Float32Array(NH * NS),
    buf: [0, 1, 2, 3, 4].map(() => new Float32Array(W * H * 3)),
    occ: new Float32Array(NS).fill(1 / NS),
  };
}

// One step of the code, the channel and the decoder.
function stepModel(st) {
  const n = cl((st.k[2] + 0.6) / 1.6, 0, 1), e = cl(st.k[3], 0, 1);
  const pg = 0.03 * n, pb = 0.5 * pow(n, 0.7), pa = n > 0 ? 0.03 + 0.4 * n : 0, pbg = 0.3 - 0.1 * n, pe = 0.7 * e;
  // the source bit and the two bits sent
  // the source bits are random, a little less likely to repeat than a coin, so the path does not sit on one state
  const u = rnd() < 0.6 ? 1 - (st.ts >> 2) : st.ts >> 2;
  const sent = OUT[(u << 3) | st.ts];
  st.ts = (u << 2) | (st.ts >> 1);
  for (let s = 0; s < NS; s++) st.occ[s] += ((s === st.ts ? 1 : 0) - st.occ[s]) / OCC;
  // the channel, good or bad, flips bits; the receiver loses some
  st.bad = st.bad ? rnd() > pbg : rnd() < pa;
  const p = st.bad ? pb : pg;
  let y = sent, er = 0, fl = 0, ne = 0;
  for (let i = 0; i < 2; i++) {
    const flip = rnd() < p, lost = rnd() < pe;
    if (flip) y ^= 1 << i;
    if (lost) (er |= 1 << i), ne++;
    else if (flip) fl++;
  }
  // add, compare, select
  const M = st.M, NM = new Float64Array(NS);
  const slot = (st.T + 1) % NH, base = slot * NS;
  for (let ns = 0; ns < NS; ns++) {
    const sa = (ns & 3) << 1, sb = sa | 1, uu = ns >> 2;
    const da = (OUT[(uu << 3) | sa] ^ y) & ~er & 3, db = (OUT[(uu << 3) | sb] ^ y) & ~er & 3;
    const ma = M[sa] + (da & 1) + (da >> 1), mb = M[sb] + (db & 1) + (db >> 1);
    if (ma < mb || (ma === mb && rnd() < 0.5)) (NM[ns] = ma), (st.pred[base + ns] = sa);
    else (NM[ns] = mb), (st.pred[base + ns] = sb);
  }
  let mn = 1e9;
  for (let s = 0; s < NS; s++) mn = min(mn, NM[s]);
  for (let s = 0; s < NS; s++) {
    M[s] = NM[s] - mn;
    st.gap[base + s] = min(9, M[s]);
  }
  st.T++;
  st.trueS[slot] = st.ts;
  st.flips[slot] = fl;
  st.erased[slot] = ne;
  st.recv[slot] = y;
  // the level the receiver sees wanders from step to step, and drops in a burst
  st.fz = 0.25 * st.fz + 0.97 * (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;
  st.fade[slot] = (0.5 + 0.5 * Math.tanh(1.8 * st.fz)) * (st.bad ? 0.35 : 1);
  st.emask[slot] = er;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.init = true;
    // a channel that may start in a burst, and a decoder that has run a long time
    st.bad = rnd() < 0.2;
    for (let i = 0; i < PRE; i++) stepModel(st);
    st.u = st.T - 1.5;
  }
  st.u += cl(dt || 0, 0, 0.1) * cl(kv[1], 1.5, 9);
  while (st.T < floor(st.u) + 2) stepModel(st);
}

// ---- drawing ----------------------------------------------------------------
// One branch between two nodes, as an S curve: it leaves a node straight down and comes into the next straight down.
// Each pixel row takes a soft profile across the curve; where the curve runs along the row it spreads, so the
// thickness stays the same across the line. Layers are combined by max.
function edge(buf, xa, ya, xb, yb, sig, amp, c, amp1 = amp) {
  const dy = yb - ya, dx = xb - xa;
  if (yb < 0 || ya > H || (amp <= 0.004 && amp1 <= 0.004)) return;
  const y0 = max(0, ceil(ya - 0.5)), y1 = min(H - 1, floor(yb - 0.5));
  for (let py = y0; py <= y1; py++) {
    const tau = (py + 0.5 - ya) / dy, sm = tau * tau * (3 - 2 * tau);
    const cx = xa + dx * sm, sl = (dx * 6 * tau * (1 - tau)) / dy;
    const sh = sig * sqrt(1 + sl * sl), inv = -0.5 / (sh * sh);
    const x0 = max(0, floor(cx - 3 * sh)), x1 = min(W - 1, ceil(cx + 3 * sh));
    for (let px = x0; px <= x1; px++) {
      const d = px + 0.5 - cx, w = (amp + (amp1 - amp) * tau) * exp(d * d * inv), i = (py * W + px) * 3;
      if (w * c[0] > buf[i]) buf[i] = w * c[0];
      if (w * c[1] > buf[i + 1]) buf[i + 1] = w * c[1];
      if (w * c[2] > buf[i + 2]) buf[i + 2] = w * c[2];
    }
  }
}

// A soft round dot.
function dot(buf, x, y, sig, amp, c) {
  const r = ceil(3 * sig), inv = -0.5 / (sig * sig);
  const y0 = max(0, floor(y - r)), y1 = min(H - 1, ceil(y + r)), x0 = max(0, floor(x - r)), x1 = min(W - 1, ceil(x + r));
  for (let py = y0; py <= y1; py++) {
    const dy = py + 0.5 - y;
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x, w = amp * exp((dx * dx + dy * dy) * inv), i = (py * W + px) * 3;
      if (w * c[0] > buf[i]) buf[i] = w * c[0];
      if (w * c[1] > buf[i + 1]) buf[i + 1] = w * c[1];
      if (w * c[2] > buf[i + 2]) buf[i + 2] = w * c[2];
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const h0 = 0.5 + st.k[0];
  const [LAT, SV, DEC, FL, BG] = st.buf;
  for (let b = 0; b < 5; b++) st.buf[b].fill(0);
  // the colours: survivors by how far their metric is from the best, the lattice from cyan to violet across, the path
  // near white, the flash warm
  const gc = [], lc = [], tmp = [0, 0, 0];
  for (let g = 0; g < 10; g++) {
    {
      const hh = h0 + 0.3 * (1 - exp(-g / 2.2));
      hsv(hh, (0.82 - 0.05 * min(g, 4)) * (1 - 0.45 * warm(hh)), 1, tmp, 0);
    }
    gc.push([tmp[0], tmp[1], tmp[2]]);
  }
  for (let c = 0; c < NS * 2; c++) {
    {
      const hh = h0 + 0.2 * (c / (NS * 2 - 2));
      hsv(hh, 0.85 * (1 - 0.5 * warm(hh)), 1, tmp, 0);
    }
    lc.push([tmp[0], tmp[1], tmp[2]]);
  }
  const decC = [0, 0, 0], decH = [0, 0, 0], flC = [0, 0, 0];
  hsv(h0 + 0.02, 0.1, 1, decC, 0);
  hsv(h0 + 0.02, 0.7, 1, decH, 0);
  hsv(h0 + 0.6, 0.92, 1, flC, 0);

  const T = st.T, u = st.u, T0 = T - NVIS;
  const yOf = (t) => YREF + (t - u) * RS;
  // how bright a step is drawn follows the level the receiver saw there
  const lv = (t) => 0.3 + 0.7 * st.fade[t % NH];
  // trace every current state back through the steps; cnt counts the paths through a node
  const cnt = st.cnt;
  for (let t = T0; t <= T; t++) for (let s = 0; s < NS; s++) cnt[(t % NH) * NS + s] = 0;
  for (let s = 0; s < NS; s++) cnt[(T % NH) * NS + s] = 1;
  for (let t = T; t > T0; t--) {
    const a = (t % NH) * NS, b = ((t - 1) % NH) * NS;
    for (let s = 0; s < NS; s++) if (cnt[a + s] > 0) cnt[b + st.pred[a + s]] += cnt[a + s];
  }

  for (let t = T0 + 1; t <= T; t++) {
    const ya = yOf(t - 1), yb = yOf(t), a = (t % NH) * NS;
    if (yb < -6 || ya > H + 6) continue;
    for (let ns = 0; ns < NS; ns++) {
      const sa = (ns & 3) << 1;
      // the whole lattice, very faint
      // the branches whose two bits agree with what was received light up a little: the decoder's branch metric
      const yr = st.recv[t % NH], em = st.emask[t % NH], uu = ns >> 2;
      for (let k = 0; k < 2; k++) {
        const sp = sa | k, d = (OUT[(uu << 3) | sp] ^ yr) & ~em & 3, bm = (d & 1) + (d >> 1);
        edge(LAT, XS[sp], ya, XS[ns], yb, bm === 0 ? 0.85 : 0.7, (bm === 0 ? 0.3 : bm === 1 ? 0.13 : 0.07) * (0.3 + 0.7 * st.fade[t % NH]), lc[XCOL[sp] + XCOL[ns]]);
      }
      // the survivor into this state
      const p = st.pred[a + ns], g = st.gap[a + ns], cw = cnt[a + ns];
      const alive = cw > 0;
      const amp = alive ? (0.5 + 0.5 * exp(-g / 1.8)) * (0.8 + 0.2 * min(cw, 4) / 4) : 0.27;
      edge(SV, XS[p], ya, XS[ns], yb, alive ? 0.95 : 0.7, amp * lv(t - 1), gc[floor(g)], amp * lv(t));
    }
  }
  // the received level of each step, a soft band across the panel
  for (let t = T0 + 1; t <= T; t++) {
    const y = yOf(t), w0 = 0.4 * st.fade[t % NH];
    for (let py = max(0, floor(y - 8)); py <= min(H - 1, ceil(y + 8)); py++) {
      const dy = py + 0.5 - y, w = w0 * exp(-dy * dy / 14);
      for (let px = 0; px < W; px++) {
        const i = (py * W + px) * 3, c = lc[min(15, 2 + (px >> 3) * 2)];
        BG[i] += w * c[0];
        BG[i + 1] += w * c[1];
        BG[i + 2] += w * c[2];
      }
    }
  }
  // a rail up every state column, brighter the more often the code has stood in that state lately
  for (let s = 0; s < NS; s++) {
    const o = st.occ[s] * NS, c = lc[XCOL[s] * 2], amp = cl(0.3 * (o - 0.3), 0, 0.4);
    for (let y = 0; y < H; y++) {
      for (let x = max(0, floor(XS[s] - 7)); x <= min(W - 1, XS[s] + 6); x++) {
        const d = x + 0.5 - XS[s], w = amp * exp(-d * d / 5.5), i = (y * W + x) * 3;
        BG[i] += w * c[0];
        BG[i + 1] += w * c[1];
        BG[i + 2] += w * c[2];
      }
    }
  }
  // the nodes
  for (let t = T0; t <= T; t++) {
    const y = yOf(t);
    if (y < -4 || y > H + 4) continue;
    const a = (t % NH) * NS;
    for (let s = 0; s < NS; s++) {
      const g = st.gap[a + s], alive = cnt[a + s] > 0;
      dot(SV, XS[s], y, alive ? 1.25 : 0.9, alive ? 0.85 * (0.55 + 0.45 * exp(-g / 2)) : 0.2, gc[floor(g)]);
    }
  }
  // the decoded path: the best state now, traced back
  let best = 0;
  for (let s = 1; s < NS; s++) if (st.M[s] < st.M[best]) best = s;
  let s = best;
  for (let t = T; t > T0; t--) {
    const p = st.pred[(t % NH) * NS + s], ya = yOf(t - 1), yb = yOf(t);
    edge(DEC, XS[p], ya, XS[s], yb, 2.3, 0.7 * st.fade[(t - 1) % NH] + 0.03, decH, 0.7 * st.fade[t % NH] + 0.03);
    edge(DEC, XS[p], ya, XS[s], yb, 1.0, 0.62 + 0.38 * st.fade[(t - 1) % NH], decC, 0.62 + 0.38 * st.fade[t % NH]);
    s = p;
  }
  // the branch that was sent, flashing where bits were lost to the channel; it fades as it climbs
  for (let t = T0 + 1; t <= T; t++) {
    const f = st.flips[t % NH];
    if (!f) continue;
    const ya = yOf(t - 1), yb = yOf(t), age = max(0, H - (ya + yb) / 2) / 55;
    const amp = cl(((0.95 + 0.1 * (f - 1)) * exp(-age) - 0.1) / 0.9, 0, 1);
    if (amp <= 0) continue;
    const sp = st.trueS[(t - 1) % NH], sn = st.trueS[t % NH];
    edge(FL, XS[sp], ya, XS[sn], yb, 1.6, amp, flC);
  }
  // steps that lost bits: a faint band across the panel
  const hz = st.k[3] > 0.02;
  if (hz) {
    for (let t = T0 + 1; t <= T; t++) {
      const ne = st.erased[t % NH];
      if (!ne) continue;
      const y = yOf(t);
      for (let py = max(0, floor(y - 6)); py <= min(H - 1, ceil(y + 6)); py++) {
        const dy = py + 0.5 - y, w = 0.09 * ne * exp(-dy * dy / 6);
        for (let px = 0; px < W; px++) {
          const i = (py * W + px) * 3, c = lc[min(15, 7 + (px >> 3))];
          if (w * c[0] > LAT[i]) LAT[i] = w * c[0];
          if (w * c[1] > LAT[i + 1]) LAT[i + 1] = w * c[1];
          if (w * c[2] > LAT[i + 2]) LAT[i + 2] = w * c[2];
        }
      }
    }
  }
  // compose: screen the layers over a deep indigo ground
  const g0 = 0.02, g1 = 0.012, g2 = 0.07;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = 1 - (1 - g0) * (1 - BG[i]) * (1 - LAT[i]) * (1 - SV[i]) * (1 - DEC[i]) * (1 - FL[i]);
      const g = 1 - (1 - g1) * (1 - BG[i + 1]) * (1 - LAT[i + 1]) * (1 - SV[i + 1]) * (1 - DEC[i + 1]) * (1 - FL[i + 1]);
      const b = 1 - (1 - g2) * (1 - BG[i + 2]) * (1 - LAT[i + 2]) * (1 - SV[i + 2]) * (1 - DEC[i + 2]) * (1 - FL[i + 2]);
      display.setPixel(x, y, (r * 255 + 0.5) | 0, (g * 255 + 0.5) | 0, (b * 255 + 0.5) | 0);
    }
  }
}
