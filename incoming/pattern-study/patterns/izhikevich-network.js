// ===== Patternflow pattern =====
// Title:   Izhikevich Network
// Family:  rhythm
// Idea:    A thousand of Izhikevich's model neurons, 800 excitatory and 200 inhibitory with random synapses and noisy thalamic input, write their spike raster down the panel two milliseconds a row, so the population rhythms stand as horizontal bands of synchrony.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: simple model of spiking neurons (Eugene Izhikevich, 2003), pattern round 63
// Round:   63
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Drive=-1.5..3, Inhibition=0.8..1.6
//
// Knob 1: Hue. Turns both kinds of cell round the wheel together, skipping red-orange to orange, which reads brown when dim. At 0 the 800 excitatory cells are azure and the 200 inhibitory cells magenta; a column that fires two or more spikes in one row goes paler, toward white.
// Knob 2: Speed. At 2 the raster moves 14 rows a second, 28 ms of the network, so it runs 36 times slower than a brain and the panel holds the last 256 ms; at 0.2 it moves 1.4 rows a second, at 3, 21.
// Knob 3: Drive. The thalamic noise: each excitatory cell gets 5 + Drive mV times a fresh Gaussian every millisecond and each inhibitory cell 0.4 of that, so 0 is the paper's 5 and 2. At -1.5 the cells fire 1.6 times a second and the panel is nearly dark; at -1, 4.2 times in bursts 180 to 900 ms apart; at 0, 8.5 times in bursts every 124 ms; at 3, 15 times, and the bands break into a 50 Hz ripple.
// Knob 4: Inhibition. Scales every inhibitory synapse against the paper's. At 0.8 the network locks into a burst every 124 ms, 8.1 Hz, with an autocorrelation of 0.63; at 1, the paper's network, the bursts loosen to 0.16 and a weak ripple near 30 Hz shows between them; at 1.6 the bursts are gone and a 38 Hz rhythm runs through the raster as thin stripes 13 rows apart.
// Buttons: K1 tap gives every cell 12 mV more input for 2 ms: the whole network fires one volley about 18 ms long, falls silent for about 120 ms and comes back in a burst.

const W = 64, H = 128, NE = 800, NI = 200, N = NE + NI, EC = 50, MS = 2, KICK = 12;
const { floor, sqrt, log, cos, sin, PI, min } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// A fixed generator, so the network is the same one every time the pattern
// opens and each knob setting means the same rhythm.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setup(params) {
  const rnd = mulberry(2003);
  const a = new Float32Array(N), b = new Float32Array(N), c = new Float32Array(N), d = new Float32Array(N);
  const col = new Uint8Array(N);
  // Izhikevich's listing draws re and ri uniform on [0, 1]; here they are
  // drawn sorted, so the columns run from regular spiking on the left to
  // chattering cells, and the inhibitory ones from slow to fast.
  const re = Array.from({ length: NE }, rnd).sort((x, y) => x - y);
  const ri = Array.from({ length: NI }, rnd).sort((x, y) => x - y);
  for (let i = 0; i < NE; i++) {
    const r2 = re[i] * re[i];
    a[i] = 0.02; b[i] = 0.2; c[i] = -65 + 15 * r2; d[i] = 8 - 6 * r2;
    col[i] = floor((i * EC) / NE);
  }
  for (let k = 0; k < NI; k++) {
    const i = NE + k;
    a[i] = 0.02 + 0.08 * ri[k]; b[i] = 0.25 - 0.05 * ri[k]; c[i] = -65; d[i] = 2;
    col[i] = EC + floor((k * (W - EC)) / NI);
  }
  // The weights S(i, j) are stored by the firing cell j, so a spike adds
  // one run of 1000 numbers and a quiet cell costs nothing.
  const S = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    const o = j * N;
    if (j < NE) for (let i = 0; i < N; i++) S[o + i] = 0.5 * rnd();
    else for (let i = 0; i < N; i++) S[o + i] = -rnd();
  }
  const v = new Float64Array(N).fill(-65), u = new Float64Array(N);
  for (let i = 0; i < N; i++) u[i] = b[i] * v[i];
  params.s = {
    a, b, c, d, col, S, v, u, I: new Float32Array(N), fired: new Int32Array(N),
    rnd: mulberry(1963), spare: 0, hasSpare: false,
    rows: new Uint8Array(W * H), cur: new Uint8Array(W), head: 0, acc: 0,
    fresh: true, hue: 0, drive: 5, inh: 1, kick: 0, rgb: [0, 0, 0],
  };
}

function randn(S) {
  if (S.hasSpare) { S.hasSpare = false; return S.spare; }
  let x = S.rnd();
  while (x === 0) x = S.rnd();
  const r = sqrt(-2 * log(x)), th = 2 * PI * S.rnd();
  S.spare = r * sin(th);
  S.hasSpare = true;
  return r * cos(th);
}

// One millisecond of the network, as in the paper's listing: thalamic noise,
// reset of the cells at 30 mV, their synapses, and two half steps of v.
function step(S) {
  const { a, b, c, d, v, u, I, fired, col, cur } = S;
  const gE = S.drive, gI = 0.4 * S.drive, wI = S.inh;
  const kick = S.kick > 0 ? (S.kick--, KICK) : 0;
  for (let i = 0; i < NE; i++) I[i] = gE * randn(S) + kick;
  for (let i = NE; i < N; i++) I[i] = gI * randn(S) + kick;
  let nf = 0;
  for (let i = 0; i < N; i++)
    if (v[i] >= 30) {
      fired[nf++] = i;
      v[i] = c[i];
      u[i] += d[i];
      if (cur[col[i]] < 255) cur[col[i]]++;
    }
  const Sw = S.S;
  for (let k = 0; k < nf; k++) {
    const j = fired[k], o = j * N, w = j < NE ? 1 : wI;
    for (let i = 0; i < N; i++) I[i] += w * Sw[o + i];
  }
  for (let i = 0; i < N; i++) {
    let x = v[i];
    const ui = u[i], Ii = I[i];
    x += 0.5 * (0.04 * x * x + 5 * x + 140 - ui + Ii);
    x += 0.5 * (0.04 * x * x + 5 * x + 140 - ui + Ii);
    v[i] = x;
    u[i] = ui + a[i] * (b[i] * x - ui);
  }
}

// Ends the row being written: it becomes the top row and the rest move down.
function pushRow(S) {
  S.head = (S.head + H - 1) % H;
  S.rows.set(S.cur, S.head * W);
  S.cur.fill(0);
}

function runRows(S, n) {
  for (let r = 0; r < n; r++) {
    for (let m = 0; m < MS; m++) step(S);
    pushRow(S);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.drive = 5 + cl(k[2], -1.5, 3);
  S.inh = cl(k[3], 0.8, 1.6);
  if (input.btnPressed && input.btnPressed[0]) S.kick = 2;
  if (S.fresh) {
    // The paper's run starts every cell at -65 mV, and the first 50 ms are
    // one big volley with 100 quiet ones after it. The panel opens 300 ms
    // in, already full.
    S.fresh = false;
    for (let m = 0; m < 300; m++) step(S);
    S.cur.fill(0);
    runRows(S, H);
  }
  const rate = 7 * cl(k[1], 0.2, 3);
  S.acc += cl(dt || 0, 0, 0.1) * rate;
  let n = floor(S.acc);
  S.acc -= n;
  n = min(n, 8);
  runRows(S, n);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, h = S.hue;
  // The wheel skips red-orange to orange (0 to 0.11), which reads brown
  // when dim. At Hue 0 the excitatory cells are azure, the inhibitory
  // ones magenta.
  const wheel = (f) => 0.11 + 0.89 * (f - floor(f));
  const hE = wheel(h + 0.528), hI = wheel(h + 0.843);
  const sat = [0, 0.8, 0.5, 0.25], val = [0, 0.82, 1, 1];
  for (let y = 0; y < H; y++) {
    const o = ((S.head + y) % H) * W;
    for (let x = 0; x < W; x++) {
      const n = S.rows[o + x];
      if (!n) { display.setPixel(x, y, 0, 0, 0); continue; }
      const m = min(3, n);
      hsv(x < EC ? hE : hI, sat[m], val[m], rgb);
      display.setPixel(x, y, rgb[0] | 0, rgb[1] | 0, rgb[2] | 0);
    }
  }
}
