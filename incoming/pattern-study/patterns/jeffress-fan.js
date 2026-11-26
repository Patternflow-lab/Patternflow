// ===== Patternflow pattern =====
// Title:   Jeffress Fan
// Family:  binaural
// Idea:    The panel is the cross-correlogram of the two ears, internal delay across and cochlear channel down, where every talker is a bright straight spine at its own interaural delay with curved fringes fanning out from it toward the low channels and crowding together toward the high ones, so that two to four talkers drift round the listener in mint, rose and teal and their fans cross and mix over a grainy floor of room reverberation.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lloyd Jeffress's place theory of sound localisation, coincidence detectors in the brainstem lying along delay lines so that the place of the most coincidences gives the difference in arrival time at the two ears (Jeffress, 1948, from memory); the delay lines and detectors found in the medial superior olive of the barn owl (Catherine Carr and Masakazu Konishi, 1990, from memory) and the dissent over whether mammals use them (Benedikt Grothe and colleagues, 2010, from memory); the running cross-correlogram of the two ears' cochlear channels with a straightness cue across frequency (Richard Stern and Constantine Trahiotis, 1990s, from memory); the equivalent rectangular bandwidth of an auditory filter (Brian Glasberg and Brian Moore, 1990, from memory); original code, pattern round 261
// Round:   261
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Walk=0.25..4, Sources=-1.5..1.5, Room=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together, once for the knob's travel. At 0 the first talker is mint green, the second rose, the third teal and the fourth indigo, and the negative correlation is a dim indigo under the green.
// Knob 2: Walk. How fast the talkers wander in delay, 1 at the opening 2. The talkers move at about 0.03 ms a second at 2 (one LED a second), a quarter of that at 0.25 and twice it at 4, and their pitch glides with them.
// Knob 3: Sources. How many talkers are in the room, 2.5 at the opening 0 and 1 at -1.5 and 4 at 1.5. A fraction fades the next talker in, so at the opening there are two in full and a third at half strength.
// Knob 4: Room. How reverberant it is. At -1 the room is nearly dry and the fringes stay crisp down to the lowest row; at 1 the coherence of the two ears falls away toward the high channels, the fringes there turn to grain and the spines fade.

const W = 64, H = 128, NP = W * H;
const { sin, cos, exp, sqrt, abs, floor, min, max, log, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// ---- the panel's axes
const TPX = 2 / W; // ms of internal delay a column holds: the panel is -1 ms (left) to +1 ms (right)
const F0 = 180, F1 = 4200; // centre frequencies of the first and last channel row, Hz, on a log scale
const NS = 4; // talkers (slots)
const MASK = 0.7, HZ = 0.7, FLOOR = 0.075; // how much of a fringe the room can take away, and how bright its haze is

const FROW = new Float64Array(H), ERBROW = new Float64Array(H), KAPROW = new Float64Array(H);
for (let y = 0; y < H; y++) {
  const f = F0 * pow(F1 / F0, (y + 0.5) / H);
  FROW[y] = f;
  ERBROW[y] = 24.7 * (4.37 * f / 1000 + 1); // Glasberg and Moore's equivalent rectangular bandwidth, Hz
  const sg = 0.075 * pow(f / 180, -0.3); // ms: how wide the main lobe is allowed to stay in the low rows
  KAPROW[y] = max(1.5, 1 / (TAU * f / 1000 * sg) ** 2);
}

// ---- colours: [base, core] of a bright fringe, and the tint of its negative correlation
const SRC = [
  { b: [0.12, 0.8, 0.5], c: [0.55, 0.45, 0.6], n: [0.2, 0.14, 0.7], gain: 1.0 }, // mint green over indigo
  { b: [1.0, 0.2, 0.42], c: [0.0, 0.62, 0.55], n: [0.04, 0.46, 0.52], gain: 0.92 }, // rose over teal
  { b: [0.04, 0.72, 0.85], c: [0.5, 0.45, 0.3], n: [0.3, 0.12, 0.62], gain: 0.85 }, // teal over indigo-violet
  { b: [0.22, 0.28, 1.0], c: [0.45, 0.55, 0.0], n: [0.08, 0.5, 0.36], gain: 0.78 }, // indigo over sea green
];
const DIFF = [0.2, 0.62, 0.62], HAZE = [0.13, 0.2, 0.75]; // the diffuse field's tints: teal for its fringes, indigo for the haze

function randn() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

function newSlot(k, first) {
  const o = {
    p: 0, v: 0, j: 0, a: 0, on: true, tmr: 0, fade: 9, ci: k,
    lf0: 0, vf: 0, c1: 0, c2: 0, v1: 0, v2: 0, w1: 22, w2: 26, dep: 0.7,
  };
  respawn(o, null, k, first);
  return o;
}

// a talker appears at a delay away from the others, with its own pitch and its own bright bands
function respawn(o, slots, k, first) {
  let best = 0, bd = -1;
  for (let t = 0; t < 10; t++) {
    const p = (Math.random() * 2 - 1) * 0.62;
    let d = 9;
    if (slots) for (let j = 0; j < NS; j++) if (j !== k && slots[j].a > 0.02) d = min(d, abs(slots[j].p - p));
    if (d > bd) { bd = d; best = p; }
  }
  o.p = best; o.v = 0;
  if (slots) {
    // a colour no one in the room is wearing, if there is one
    const used = [false, false, false, false];
    for (let j = 0; j < NS; j++) if (j !== k && slots[j].a > 0.02) used[slots[j].ci] = true;
    const free = [];
    for (let c = 1; c < NS; c++) if (!used[c]) free.push(c);
    if (free.length) o.ci = free[floor(Math.random() * free.length)];
  }
  o.lf0 = Math.log2(105 + Math.random() * 120); o.vf = 0;
  o.c1 = 10 + Math.random() * 40; o.c2 = 60 + Math.random() * 55;
  o.w1 = 16 + Math.random() * 12; o.w2 = 18 + Math.random() * 14;
  o.dep = 0.4 + Math.random() * 0.35;
  o.fade = 7 + Math.random() * 5;
  o.on = true;
  o.tmr = first ? 6 + Math.random() * 70 : 30 + Math.random() * 60;
  o.a = first ? 1 : 0;
}

function setup(params) {
  const S = {
    ready: false, t: 0, nt: 0,
    slots: [], w: [0, 0, 0, 0], Rs: 0.5, hueAt: -1,
    col: new Float32Array(NS * 9 + 6), // b, c, n of each talker and the diffuse tint, hue-turned
    spec: new Float32Array(H), rr: new Float32Array(W), gg: new Float32Array(W), bb: new Float32Array(W),
    zr: new Float32Array(10 * 34), zi: new Float32Array(10 * 34), rzr: new Float32Array(W), rzi: new Float32Array(W), mk: new Float32Array(W),
    xi: new Int32Array(W), xf: new Float32Array(W),
    tone: new Float32Array(2048),
  };
  for (let k = 0; k < NS; k++) S.slots.push(newSlot(k, true));
  S.slots[0].a = 1; S.slots[0].on = true; S.slots[0].tmr = 1e9;
  S.slots[1].a = 1;
  S.slots[2].a = Math.random() < 0.7 ? 1 : 0; S.slots[3].a = Math.random() < 0.4 ? 1 : 0;
  for (let k = 2; k < NS; k++) if (S.slots[k].a === 0) { S.slots[k].on = false; S.slots[k].tmr = 3 + Math.random() * 15; }
  for (let x = 0; x < W; x++) {
    const u = x / 15, i = floor(u);
    S.xi[x] = i; S.xf[x] = sm(u - i);
  }
  for (let i = 0; i < 2048; i++) S.tone[i] = 1 - exp(-i / 512 * 1.4);
  params.s = S;
}

// a hash of a noise node to [-1, 1]
function node(i, j, k, c) {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(j + 7, 668265263) ^ Math.imul(k + 13, 2147483647 & 1274126177) ^ Math.imul(c + 3, 1103515245);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

function hueTurn(S, hue) {
  if (S.hueAt === hue) return;
  S.hueAt = hue;
  const A = -TAU * hue, c = cos(A), s = sin(A);
  const m0 = 0.213 + c * 0.787 - s * 0.213, m1 = 0.715 - c * 0.715 - s * 0.715, m2 = 0.072 - c * 0.072 + s * 0.928;
  const m3 = 0.213 - c * 0.213 + s * 0.143, m4 = 0.715 + c * 0.285 + s * 0.14, m5 = 0.072 - c * 0.072 - s * 0.283;
  const m6 = 0.213 - c * 0.213 - s * 0.787, m7 = 0.715 - c * 0.715 + s * 0.715, m8 = 0.072 + c * 0.928 + s * 0.072;
  const put = (o, v) => {
    S.col[o] = max(0, v[0] * m0 + v[1] * m1 + v[2] * m2);
    S.col[o + 1] = max(0, v[0] * m3 + v[1] * m4 + v[2] * m5);
    S.col[o + 2] = max(0, v[0] * m6 + v[1] * m7 + v[2] * m8);
  };
  for (let k = 0; k < NS; k++) { put(k * 9, SRC[k].b); put(k * 9 + 3, SRC[k].c); put(k * 9 + 6, SRC[k].n); }
  put(NS * 9, DIFF); put(NS * 9 + 3, HAZE);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const walk = kn[1] / 2, count = cl(2.5 + kn[2], 1, 4), R = 0.12 + 0.88 * cl((kn[3] + 1) / 2, 0, 1) ** 2;
  hueTurn(S, kn[0]);
  S.t += d;
  S.nt += d;
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < NS; k++) S.w[k] = cl(count - k, 0, 1);
    S.Rs = R;
  }
  S.Rs += (R - S.Rs) * (1 - exp(-d / 0.3));
  const sl = S.slots;
  const ex = exp(-d / 7), exf = exp(-d / 9), exc = exp(-d / 12), exj = exp(-d / 0.7);
  for (let k = 0; k < NS; k++) {
    const o = sl[k];
    S.w[k] += (cl(count - k, 0, 1) - S.w[k]) * (1 - exp(-d / 0.35));
    // the talker walks: an Ornstein-Uhlenbeck velocity in delay, held inside the head's range
    o.v = o.v * ex + 0.034 * sqrt(1 - ex * ex) * randn();
    let rep = 0;
    for (let j = 0; j < NS; j++) if (j !== k && sl[j].a > 0.05) {
      const dd = o.p - sl[j].p, ad = abs(dd);
      if (ad < 0.2) rep += (dd < 0 ? -1 : 1) * (0.2 - ad);
    }
    o.v += 0.5 * rep * d - 1.2 * max(0, abs(o.p) - 0.5) * (o.p < 0 ? -1 : 1) * d;
    o.p = cl(o.p + o.v * walk * d, -0.85, 0.85);
    o.j = o.j * exj + 0.012 * sqrt(1 - exj * exj) * randn(); // a slight tremor of the delay, 0.4 LED
    // the pitch and the two bright bands wander more slowly
    o.vf = o.vf * exf + 0.009 * sqrt(1 - exf * exf) * randn();
    o.lf0 += o.vf * (0.35 + 0.65 * walk) * d;
    o.vf -= 0.0025 * (o.lf0 - 7.25) * d; // pulled gently toward 150 Hz
    o.v1 = o.v1 * exc + 1.3 * sqrt(1 - exc * exc) * randn();
    o.v2 = o.v2 * exc + 1.3 * sqrt(1 - exc * exc) * randn();
    o.c1 = cl(o.c1 + o.v1 * d, 6, 56); o.c2 = cl(o.c2 + o.v2 * d, 56, 122);
    // appear, stay a while, fade, stay away, appear again somewhere else
    if (k > 0) {
      o.tmr -= d;
      if (o.on) {
        o.a = min(1, o.a + d / o.fade);
        if (o.tmr <= 0) { o.on = false; o.tmr = 6 + Math.random() * 20; }
      } else {
        o.a = max(0, o.a - d / o.fade);
        if (o.a <= 0 && o.tmr <= 0) respawn(o, sl, k, false);
      }
    }
  }
}

export function draw(display, params) {
  if (!params.s) setup(params);
  const S = params.s, sl = S.slots, col = S.col, Rs = S.Rs;
  hueTurn(S, S.hueAt < 0 ? 0 : S.hueAt);
  const rr = S.rr, gg = S.gg, bb = S.bb, tone = S.tone;
  const tz = S.nt * 0.35, kz = floor(tz), fz = sm(tz - kz);
  // the diffuse field: a smooth complex random field Z(delay, channel, time), nodes 11 columns by 4 rows
  const NJ = 34, NI = 10;
  for (let j = 0; j < NJ; j++)
    for (let i = 0; i < NI; i++) {
      const a0 = node(i, j, kz, 0), a1 = node(i, j, kz + 1, 0), b0 = node(i, j, kz, 1), b1 = node(i, j, kz + 1, 1);
      S.zr[j * NI + i] = a0 + (a1 - a0) * fz;
      S.zi[j * NI + i] = b0 + (b1 - b0) * fz;
    }
  
  for (let y = 0; y < H; y++) {
    const f = FROW[y], fk = f / 1000, kap = KAPROW[y];
    const gam = exp(-1.0 * Rs * (f / 2000)), hzR = sm((Rs - 0.12) / 0.88);
    const halo = 0.2 * sm((1300 - f) / 1000);
    const envS = (0.42 * (1 - 0.45 * Rs)) / (ERBROW[y] / 1000); // ms
    rr.fill(0); gg.fill(0); bb.fill(0);
    // the room's field along this row: a smooth complex noise, and from it the places where the two ears have lost each other
    const wd = sqrt(max(0, 1 - gam * gam));
    const yj = y / 6, j0 = floor(yj), fy = sm(yj - j0), jb = j0 * NI, jc = (j0 + 1) * NI, zr = S.zr, zi = S.zi, ZR = S.rzr, ZI = S.rzi, MK = S.mk;
    for (let x = 0; x < W; x++) {
      const i0 = S.xi[x], fx = S.xf[x];
      const ar = zr[jb + i0] + (zr[jc + i0] - zr[jb + i0]) * fy, br = zr[jb + i0 + 1] + (zr[jc + i0 + 1] - zr[jb + i0 + 1]) * fy;
      const ai = zi[jb + i0] + (zi[jc + i0] - zi[jb + i0]) * fy, bi = zi[jb + i0 + 1] + (zi[jc + i0 + 1] - zi[jb + i0 + 1]) * fy;
      ZR[x] = ar + (br - ar) * fx; ZI[x] = ai + (bi - ai) * fx;
      MK[x] = 1 - wd * MASK * sm(0.5 + 0.75 * ZI[x]);
    }
    const dph = TAU * fk * TPX, cd = cos(dph), sd = sin(dph); // phase step a column makes, radians
    const t0 = -(W - 1) / 2 * TPX; // delay of column 0, ms
    for (let k = 0; k < NS; k++) {
      const o = sl[k], wt = o.a * S.w[k];
      if (wt < 0.004) continue;
      // spectrum of the talker at this channel: two bright bands and the resolved harmonics of its pitch
      const g1 = (y - o.c1) / o.w1, g2 = (y - o.c2) / o.w2;
      let band = exp(-0.5 * g1 * g1) + 0.85 * exp(-0.5 * g2 * g2);
      band = 0.32 + 0.68 * (band > 1 ? 1 : band);
      const f0 = pow(2, o.lf0), res = 1 - sm((ERBROW[y] / f0 - 0.55) / 0.8);
      const comb = 0.5 + 0.5 * cos(TAU * f / f0);
      const spec = band * (1 - o.dep * res * (1 - comb));
      const A = SRC[k].gain * wt * gam * spec;
      const ci = o.ci;
      const a0 = t0 - o.p - o.j; // delay from the spine at column 0, ms
      const ph0 = TAU * fk * a0;
      let c = cos(ph0), s = sin(ph0);
      let e = exp(-0.5 * (a0 / envS) ** 2);
      let r = exp(-(2 * a0 * TPX + TPX * TPX) / (2 * envS * envS));
      const q = exp(-(TPX * TPX) / (envS * envS));
      const cb = ci * 9;
      const br = col[cb], bg = col[cb + 1], bbl = col[cb + 2];
      const cr = col[cb + 3], cg = col[cb + 4], cbb = col[cb + 5];
      const nr = col[cb + 6], ng = col[cb + 7], nb = col[cb + 8];
      for (let x = 0; x < W; x++) {
        const amp = A * e * MK[x];
        if (amp > 0.002) {
          const u = kap * (1 - c);
          const v = u < 7 ? exp(-u) : 0;
          const hh = (1 + c) * 0.5, nn = (1 - c) * 0.5, n2 = nn * nn, n6 = n2 * n2 * n2 * 0.6;
          const v4 = v * v * v * v, hl = hh * hh * halo;
          rr[x] += amp * (br * (v + hl) + cr * v4 + nr * n6);
          gg[x] += amp * (bg * (v + hl) + cg * v4 + ng * n6);
          bb[x] += amp * (bbl * (v + hl) + cbb * v4 + nb * n6);
        }
        const cn = c * cd - s * sd;
        s = s * cd + c * sd; c = cn;
        e *= r; r *= q;
      }
    }
    // the diffuse part: what the room leaves of the two ears' signals is the same fringes with a random phase from patch to patch,
    // and under it a deep haze of the field's own bright patches, strongest in the low channels where the spines are bare
    {
      const dr = col[NS * 9], dg = col[NS * 9 + 1], db = col[NS * 9 + 2];
      const hr = col[NS * 9 + 3], hg = col[NS * 9 + 4], hb = col[NS * 9 + 5];
      let c = cos(TAU * fk * t0), s = sin(TAU * fk * t0);
      const gw = wd * HZ * hzR, fl = FLOOR * sm((95 - y) / 70);
      for (let x = 0; x < W; x++) {
        const zr = ZR[x], zi = ZI[x];
        if (gw > 0.01) {
          const mag = sqrt(zr * zr + zi * zi) * 1.5, cs = (zr * c - zi * s) / (mag + 0.0001) * 1.5;
          const v = (mag > 1 ? 1 : mag) * exp(-2.4 * (1 - cs));
          const aa = gw * v;
          rr[x] += dr * aa; gg[x] += dg * aa; bb[x] += db * aa;
        }
        if (fl > 0.001) {
          const h = sm(1.1 * zr * 1.6 + 0.3);
          const aa = fl * h * h;
          rr[x] += hr * aa; gg[x] += hg * aa; bb[x] += hb * aa;
        }
        const cn = c * cd - s * sd;
        s = s * cd + c * sd; c = cn;
      }
    }
    for (let x = 0; x < W; x++) {
      const ir = rr[x] * 512, ig = gg[x] * 512, ib = bb[x] * 512;
      const R8 = tone[ir > 2047 ? 2047 : ir | 0], G8 = tone[ig > 2047 ? 2047 : ig | 0], B8 = tone[ib > 2047 ? 2047 : ib | 0];
      display.setPixel(x, y, (R8 * 255 + 0.5) | 0, (G8 * 255 + 0.5) | 0, (B8 * 255 + 0.5) | 0);
    }
  }
}
