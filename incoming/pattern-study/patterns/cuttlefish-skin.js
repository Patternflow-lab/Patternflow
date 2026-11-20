// ===== Patternflow pattern =====
// Title:   Cuttlefish Skin
// Family:  cephalopod
// Idea:    The skin of a cuttlefish seen close up: a jittered lattice of yellow, red-orange and brown pigment sacs that muscles pull open in a few tenths of a second and let close over about a second, drawn over a teal and emerald iridescent layer, while a drive that crossfades between mottle, stipple and dark passing-cloud bands sweeps across the cells.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the chromatophore organ as described by Cloney and Florey (1968), the uniform, mottle and disruptive body patterns and the passing cloud of Sepia officinalis in Hanlon and Messenger (1988, 1996), the iridophore layer under the pigment in Mathger and colleagues (2009), and the motor neuron map behind the chromatophores in Reiter and colleagues (2018); pattern round 206
// Round:   206
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drive=0.5..4, Cell=-1..1, Wave=-1..1
//
// Knob 1: Hue. Turns the iridescent layer round the wheel from the teal it opens on (0.25 is violet-blue, 0.5 red-pink, 0.75 lime); the pigments only lean up to 18 degrees either way, so they stay yellow, rust and brown.
// Knob 2: Drive. How far the nerves hold the sacs open, from 0.5 to 4: at 0.5 about a quarter of the skin shows pigment and the rest of the sacs are small shadows, at the opening 2 it is a little under half, at 4 about two thirds with the teal left in the gaps; bands and waves also run faster, from 3 to 8 LEDs a second.
// Knob 3: Cell. The spacing of the lattice, 3.6 LEDs at -1, 5 at 0 where it opens and 7 at 1; the sacs grow with it, so an open brown sac is about 9 LEDs across at 5 and 12 at 7, and turning the knob stretches the skin like a sheet.
// Knob 4: Wave. What the drive paints: at -1 fine mottle and stipple, blotches 8 LEDs across and spots of one sac, at 1 mostly passing-cloud bands 24 to 37 LEDs wide, each taking about 25 seconds to cross the panel at Drive 2; the body pattern the skin changes to next is drawn with the same lean.

const W = 64;
const H = 128;
const { floor, ceil, sin, cos, exp, sqrt, abs, log, PI, min, max, tanh, pow, random, imul } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const gauss = () => sqrt(-2 * log(1 - random())) * cos(TAU * random());

// Lattice: columns i = -NI..NI, rows j = -NJ..NJ, in units of one spacing.
const NI = 12;
const NJ = 24;
const NC = (2 * NI + 1) * (2 * NJ + 1);
const ROWH = 0.866;
// Largest sac radius of each class, in spacings: yellow, red-orange, brown.
const RMAX = [0.46, 0.64, 0.86];
// Where the drive opens each class: yellow first, brown last.
const THETA = [0.75, 0.55, 0.3];
// What each body pattern adds to the drive of each class: stipple opens the small yellow sacs and keeps the brown ones shut.
const BONUS = [[0, 0, 0], [0.32, 0.2, -0.1], [-0.1, -0.04, 0.1]];
const TOPEN = [0.09, 0.11, 0.14];
const TCLOSE = [0.8, 1.0, 1.4];

function hash3(i, j, k) {
  let h = imul(i, 374761393) + imul(j, 668265263) + imul(k, 1274126177);
  h = imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn3(x, y, z) {
  const i = floor(x), j = floor(y), k = floor(z);
  let fx = x - i, fy = y - j, fz = z - k;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash3(i, j, k), b = hash3(i + 1, j, k), c = hash3(i, j + 1, k), d = hash3(i + 1, j + 1, k);
  const e = hash3(i, j, k + 1), f = hash3(i + 1, j, k + 1), g = hash3(i, j + 1, k + 1), h = hash3(i + 1, j + 1, k + 1);
  const x0 = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  const x1 = e + (f - e) * fx + (g - e) * fy + (e - f - g + h) * fx * fy;
  return x0 + (x1 - x0) * fz;
}

function hsv(h, s, v, out) {
  h = h - floor(h);
  const i = floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const m = i % 6;
  out[0] = m === 0 ? v : m === 1 ? q : m === 2 ? p : m === 3 ? p : m === 4 ? t : v;
  out[1] = m === 0 ? t : m === 1 ? v : m === 2 ? v : m === 3 ? q : m === 4 ? p : p;
  out[2] = m === 0 ? p : m === 1 ? p : m === 2 ? t : m === 3 ? v : m === 4 ? v : q;
}

export function setup(params) {
  const S = {
    t: 0, first: true, k: [0, 2, 0, 0.06],
    u2: 0.43, kw: 0.06, sp: 5, ksp: 5, rs: 1,
    sd: random() * 500,
    ox: 0, oy: 0, ox2: 0, oy2: 0, dir: random() * TAU,
    bw: [0.3, 0.15, 0.55], bt: [0.3, 0.15, 0.55], mode: 2, timer: 46,
    ew: [0.3, 0.15, 0.55],
    events: [], glints: [], gtimer: 3, bdir: PI / 2 + (random() - 0.5) * 0.8, btimer: 0,
    ux: new Float32Array(NC), uy: new Float32Array(NC),
    cls: new Uint8Array(NC), gain: new Float32Array(NC), pers: new Float32Array(NC),
    o: new Float32Array(NC), tw: new Float32Array(NC), cx: new Float32Array(NC), cy: new Float32Array(NC),
    vis: new Uint8Array(NC), shut: new Float32Array(NC), tone: new Float32Array(NC), id: new Float32Array(NC),
    order: new Int32Array(NC),
    buf: new Float32Array(W * H * 3),
    dens: new Float32Array(W * H),
    pig: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  };
  let n = 0;
  for (let j = -NJ; j <= NJ; j++)
    for (let i = -NI; i <= NI; i++) {
      S.ux[n] = i + 0.5 * (j & 1) + (random() - 0.5) * 0.8;
      S.uy[n] = j * ROWH + (random() - 0.5) * 0.8 * ROWH;
      const r = random();
      S.cls[n] = r < 0.2 ? 0 : r < 0.45 ? 1 : 2;
      S.gain[n] = 0.78 + 0.44 * random();
      S.pers[n] = gauss() * 0.11;
      S.tone[n] = 0.84 + 0.3 * random();
      S.shut[n] = 0.62 + 0.3 * random();
      S.id[n] = random() * 900;
      n++;
    }
  // Painter's order: the brown sacs lie deepest, the yellow ones on top.
  let q = 0;
  for (let c = 2; c >= 0; c--) for (let m = 0; m < NC; m++) if (S.cls[m] === c) S.order[q++] = m;
  params.s = S;
}

// ---------------------------------------------------------------------------
// the drive

function newEvent(S, w) {
  const a = S.bdir + (random() - 0.5) * 0.25;
  const n = [cos(a), sin(a)];
  // Panel corners, as seen along the direction of travel.
  let lo = 1e9, hi = -1e9;
  for (const [px, py] of [[-32, -64], [32, -64], [-32, 64], [32, 64]]) {
    const v = px * n[0] + py * n[1];
    lo = min(lo, v);
    hi = max(hi, v);
  }
  const wid = w * (0.8 + 0.45 * random());
  return {
    n, w: wid, q: lo - 1.3 * wid, hi: hi + 1.3 * wid, amp: 0.85 + 0.3 * random(),
    s1: random() * 300, s2: random() * 300, len: 9 + 10 * random(),
  };
}

function advance(S, dt) {
  S.t += dt;
  const t = S.t;
  const kn = S.k;
  const e = 1 - exp(-dt / 0.6);
  S.u2 += (cl((kn[1] - 0.5) / 3.5, 0, 1) - S.u2) * e;
  S.kw += (cl(kn[3], -1, 1) - S.kw) * e;
  S.ksp = 5 * pow(1.4, cl(kn[2], -1, 1));
  S.sp += (S.ksp - S.sp) * (1 - exp(-dt / 0.35));
  const u2 = S.u2, kw = S.kw, kwn = 0.5 * (kw + 1);
  const sp = S.sp;

  // Which body pattern the skin is in: weights ease towards a target that is
  // redrawn every 14 to 34 seconds, and the Wave knob leans the weights.
  const bias = [exp(-0.9 * kw), exp(-1.4 * kw), exp(1.8 * kw)];
  S.timer -= dt;
  if (S.timer <= 0) {
    S.timer = 14 + 20 * random();
    let tot = 0;
    const pr = [0, 1, 2].map((m) => (m === S.mode ? 0 : bias[m]));
    for (const v of pr) tot += v;
    let r = random() * tot;
    let m = 0;
    while (m < 2 && r > pr[m]) {
      r -= pr[m];
      m++;
    }
    S.mode = m;
    S.bt = [0.09, 0.09, 0.09];
    S.bt[m] = 0.82;
    if (m === 2) {
      // A new train of bands picks a new heading, mostly along the long side of the panel.
      const u = random();
      S.bdir = u < 0.34 ? PI / 2 : u < 0.68 ? -PI / 2 : u < 0.84 ? 0 : PI;
      S.bdir += (random() - 0.5) * 1.1;
    }
  }
  const ke = 1 - exp(-dt / 2.4);
  let bs = 0;
  for (let m = 0; m < 3; m++) {
    S.bw[m] += (S.bt[m] - S.bw[m]) * ke;
    bs += S.bw[m] * bias[m];
  }
  for (let m = 0; m < 3; m++) S.ew[m] = (S.bw[m] * bias[m]) / bs;
  const [wm, ws, wb] = S.ew;
  S.rs = 1 - 0.3 * ws;

  // Mottle and stipple drift over the skin on a slow wandering heading.
  S.dir += 0.05 * sqrt(dt) * gauss();
  const dv = 1.0 + 1.4 * u2;
  S.ox += cos(S.dir) * dv * dt;
  S.oy += sin(S.dir) * dv * dt;
  S.ox2 += cos(S.dir + 2) * dv * 0.6 * dt;
  S.oy2 += sin(S.dir + 2) * dv * 0.6 * dt;

  // Bands: events that cross the panel, each at its own width and heading.
  const bv = 3 + 5 * u2;
  S.btimer -= dt;
  if (wb > 0.2 && S.btimer <= 0) {
    const w = lerp(14, 30, kwn);
    const ev = newEvent(S, w);
    S.events.push(ev);
    S.btimer = (ev.w * (1.7 + 1.1 * random())) / bv;
  }
  for (let i = S.events.length - 1; i >= 0; i--) {
    const ev = S.events[i];
    ev.q += bv * dt;
    if (ev.q > ev.hi) S.events.splice(i, 1);
  }

  // Glints: a soft flash of the iridescent layer sweeps across now and then, as the skin turns to the light.
  S.gtimer -= dt;
  if (S.gtimer <= 0) {
    S.gtimer = 14 + 26 * random();
    const a = random() * TAU;
    const n = [cos(a), sin(a)];
    let lo = 1e9, hi = -1e9;
    for (const [px, py] of [[-32, -64], [32, -64], [-32, 64], [32, 64]]) {
      const v = px * n[0] + py * n[1];
      lo = min(lo, v);
      hi = max(hi, v);
    }
    const w = 14 + 12 * random();
    S.glints.push({ n, w, q: lo - w, hi: hi + w, v: 8 + 6 * random(), amp: 0.7 + 0.3 * random(), ph: random() * TAU });
  }
  for (let i = S.glints.length - 1; i >= 0; i--) {
    const g = S.glints[i];
    g.q += g.v * dt;
    if (g.q > g.hi) S.glints.splice(i, 1);
  }

  // The sacs.
  const L = 0.14 + 0.46 * u2;
  const A = 0.62 + 0.3 * u2;
  const lm = lerp(8, 27, kwn);
  const ls = 1.25 * sp;
  const tr = 0.004 + 0.012 * u2;
  const sd = S.sd;
  const { ux, uy, cls, pers, o, tw, cx, cy, vis, id } = S;
  const margin = 1.2 * sp + 1;
  for (let n = 0; n < NC; n++) {
    const x = 32 + ux[n] * sp, y = 64 + uy[n] * sp;
    cx[n] = x;
    cy[n] = y;
    if (x < -margin || x > W + margin || y < -margin || y > H + margin) {
      vis[n] = 0;
      continue;
    }
    let f = 0;
    const pn = (vn3(id[n], t * 0.11, sd) - 0.5) * 2;
    if (wm > 0.02) {
      const a = vn3((x + S.ox) / lm, (y + S.oy) / lm, t * 0.1 + sd) - 0.5;
      const b = vn3((x + S.ox) / (0.5 * lm) + 17.1, (y + S.oy) / (0.5 * lm) + 3.3, t * 0.17 + sd) - 0.5;
      const m = tanh(2.2 * (a + 0.42 * b));
      f += wm * (0.72 * m + 0.28 * pn);
    }
    if (ws > 0.02) {
      const s = vn3((x + S.ox2) / ls + 40.2, (y + S.oy2) / ls + 11.7, t * 0.3 + sd);
      f += ws * (tanh(3.2 * (2 * s - 1)) * 0.55 + 0.45 * pn);
    }
    if (wb > 0.02) {
      let g = 0;
      for (let i = 0; i < S.events.length; i++) {
        const ev = S.events[i];
        const px = x - 32, py = y - 64;
        const warp = (vn3(px / 11 + ev.s1, py / 11, t * 0.12) - 0.5) * 2 * 6;
        const along = -px * ev.n[1] + py * ev.n[0];
        const u = abs(px * ev.n[0] + py * ev.n[1] - ev.q + warp) / (0.5 * ev.w);
        if (u >= 1) continue;
        const len = 0.45 + 0.55 * sstep(0.25, 0.65, vn3(along / ev.len + ev.s2, ev.q * 0.02, 5.5));
        g += ev.amp * len * (1 - sstep(0.3, 1.0, u));
      }
      f += wb * (-0.55 + 1.7 * min(g, 1) + 0.1 * pn);
    }
    const c = cls[n];
    const d = L + A * f + pers[n] + wm * BONUS[0][c] + ws * BONUS[1][c] + wb * BONUS[2][c];
    const tg = sstep(THETA[c] - 0.3, THETA[c] + 0.3, d + 0.7 * tw[n]);
    if (random() < tr * dt * (1 + 3 * ws)) tw[n] = 1;
    tw[n] *= exp(-dt / 0.35);
    if (!vis[n]) {
      o[n] = tg;
      vis[n] = 1;
    } else {
      const k = tg > o[n] ? 1 - exp(-dt / TOPEN[c]) : 1 - exp(-dt / (TCLOSE[c] * (1.1 - 0.25 * u2)));
      o[n] += (tg - o[n]) * k;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    S.u2 = cl((S.k[1] - 0.5) / 3.5, 0, 1);
    S.kw = cl(S.k[3], -1, 1);
    S.sp = S.ksp = 5 * pow(1.4, cl(S.k[2], -1, 1));
    for (let t = 0; t < 30; t += 0.1) advance(S, 0.1);
    S.first = false;
  }
  advance(S, dt);
}

// ---------------------------------------------------------------------------
// drawing

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const { buf, pig, o, cx, cy, vis, cls, gain, tone, shut, order, dens } = S;
  const t = S.t;
  const k1 = S.k[0] || 0;
  const sp = S.sp;
  // Iridescent layer: hue and sheen drift with three slow waves that never line up.
  const h0 = 0.49 + k1;
  const ph1 = 0.071 * t, ph2 = 0.043 * t + 1.3, ph3 = 0.029 * t + 4.1;
  const tz = t * 0.04;
  const rgb = [0, 0, 0];
  const gls = S.glints;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const w1 = sin(0.047 * x + 0.021 * y + ph1);
      const w2 = sin(-0.018 * x + 0.052 * y + ph2);
      const w3 = sin(0.031 * x - 0.037 * y + ph3);
      const tex = vn3(x / 2.7 + S.sd, y / 2.7, tz) - 0.5;
      const tex2 = vn3(x / 5.1 + S.sd * 1.7, y / 5.1, tz * 1.3 + 9) - 0.5;
      // Leucophore: milky patches, 25 to 40 LEDs across, that wash the iridescence out.
      const lk = sstep(0.5, 0.85, vn3(x / 30 + S.sd * 0.3, y / 30, t * 0.02 + 3));
      let gl = 0;
      for (let e = 0; e < gls.length; e++) {
        const g = gls[e];
        const u = (x - 32) * g.n[0] + (y - 64) * g.n[1] - g.q + 4.5 * sin(0.21 * x + 0.17 * y + g.ph + 0.9 * t);
        gl += g.amp * exp(-0.5 * u * u / (g.w * g.w * 0.17));
      }
      hsv(h0 + 0.05 * w1 + 0.035 * w2 + 0.06 * tex2 + 0.05 * gl, (0.84 - 0.08 * w3) * (1 - 0.5 * lk) * (1 - 0.2 * gl), 0.5 + 0.3 * (0.5 + 0.5 * w3) + 0.12 * (0.5 + 0.5 * w1) + 0.24 * tex + 0.14 * lk + 0.3 * gl, rgb);
      const i = (y * W + x) * 3;
      buf[i] = rgb[0] * 255;
      buf[i + 1] = rgb[1] * 255;
      buf[i + 2] = rgb[2] * 255;
    }
  }
  // Pigments: the hue leans a little with the Hue knob.
  const dh = 0.05 * sin(TAU * k1);
  hsv(0.1 + dh, 0.8, 0.93, pig[0]);
  hsv(0.047 + dh, 0.74, 0.74, pig[1]);
  hsv(0.055 + dh, 0.78, 0.46, pig[2]);
  dens.fill(0);
  for (let q = 0; q < order.length; q++) {
    const n = order[q];
    if (!vis[n]) continue;
    const c = cls[n];
    const op = o[n];
    const r = lerp(0.8 + 0.5 * shut[n], RMAX[c] * sp * gain[n] * S.rs, pow(op, 0.85));
    const ca = 0.86;
    const sh0 = sstep(0, 0.5, op);
    const x0 = max(0, floor(cx[n] - r - 1.3)), x1 = min(W - 1, ceil(cx[n] + r + 1.3));
    const y0 = max(0, floor(cy[n] - r - 1.3)), y1 = min(H - 1, ceil(cy[n] + r + 1.3));
    const pc = pig[c];
    const tn = tone[n];
    const rr = pc[0] * 255 * tn, gg = pc[1] * 255 * tn, bb = pc[2] * 255 * tn;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx[n], dy = y + 0.5 - cy[n];
        const d = sqrt(dx * dx + dy * dy);
        const a = (1 - sstep(r - 0.6, r + 0.6, d)) * ca;
        if (a <= 0.002) continue;
        const u = d / r;
        // An open sac is darkest at its core and thins towards the rim, where the pigment turns warmer and lighter.
        const rim = c === 0 ? 0 : sstep(0.5, 1.05, u);
        const sh = 0.78 + 0.22 * sstep(0.0, 1, u);
        const i = (y * W + x) * 3;
        const sk = shut[n];
        // The sheen of the layer under the sac still shows through its pigment.
        let lu = sh * (0.8 + 0.0026 * (0.3 * buf[i] + 0.59 * buf[i + 1] + 0.11 * buf[i + 2]));
        // Sacs piled on one another are denser there.
        if (c === 2) {
          const dn = dens[i / 3];
          lu *= 1 - 0.13 * min(dn, 2.2);
          dens[i / 3] = dn + a * sh0;
        }
        const wr = 1 + 0.3 * rim, wg = 1 + 0.34 * rim, wb = 1 + 0.3 * rim;
        buf[i] += (lerp(buf[i] * sk, min(255, rr * lu * wr), sh0) - buf[i]) * a;
        buf[i + 1] += (lerp(buf[i + 1] * sk, min(255, gg * lu * wg), sh0) - buf[i + 1]) * a;
        buf[i + 2] += (lerp(buf[i + 2] * sk, min(255, bb * lu * wb), sh0) - buf[i + 2]) * a;
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, min(255, buf[i]), min(255, buf[i + 1]), min(255, buf[i + 2]));
    }
}
