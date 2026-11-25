// ===== Patternflow pattern =====
// Title:   Stromatolite
// Family:  stromatolite
// Idea:    A cross-section of a stromatolite being built in time-lapse: a microbial mat grows upward along its own surface, bumps that stand higher catch more light and grow faster so domes split, merge and stretch into columns while hollows fill with dim speckled sediment, every instant lays a lamina of pale carbonate, dark organic film, iron pink or sage whose thickness never repeats, storms now and then plane the crowns down under a rust-red film and bury the relief in a coarse layer with bright specks, and the camera holds the growing surface in the upper third of the panel while the older rock sinks away below it.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: laminated microbial buildups as seen in sections of Precambrian carbonates, domes (Collenia-like), columns and cones (Conophyton-like) after the types in Grotzinger and Knoll 1999, "Stromatolites in Precambrian carbonates" (from memory); growth along the surface normal, faster on the high points, with a smoothing term, is a plain height-field model of my own (the Huygens upwind step is the standard one for fronts); the storm layer over an eroded cut follows the way such sections are read; the rest is original, pattern round 243
// Round:   243
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0..4, Relief=-1..1, Storms=-1..1
//
// Knob 1: Hue. Turns the palette of the rock round the wheel. At 0 the minerals are the natural ones: cream and sand carbonate, umber and near-black organic film, iron pink, a few olive bands, a rust-red cut; at 1 the wheel has come round again.
// Knob 2: Growth. 0 to 4, opening at 2. How fast the mat grows and so how fast the rock sinks past the camera: about 0.4 LED a second at 0, 1.6 at 2 and 6 at 4. The laminae keep their thickness, the whole section just runs faster.
// Knob 3: Relief. -1 to 1, opening at 0. How hard the high points are favoured against the smoothing. At -1 a flat stratiform mat with long low swells; at 0 round domes about 18 LED across that split and merge; at 0.7 tall narrow columns with dim fill between them; at 1 steep cones with sharp tops.
// Knob 4: Storms. -1 to 1, opening near 0. How often a storm comes and how big. At -1 none at all and the mat grows undisturbed. Raised, the crowns are now and then planed off under a rust-red film and the hollows filled with a thick coarse layer of sand and bright specks, from one in about two hundred LED of rock to one every fourteen, each deeper and thicker.

const W = 64, H = 128;
const NS = 128, DX = W / NS;          // samples across the surface, LED between two of them
const RB = 256;                       // rows of rock kept, a ring
const YS = 31;                        // the row the mean surface is held at
const { floor, ceil, min, max, abs, exp, sqrt, sin, cos, tanh, log, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;
const hash = (i, r) => {
  let x = (Math.imul(i, 374761393) + Math.imul(r, 668265263)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

// ---- the minerals, 0..255 ---------------------------------------------------
const CREAM = [246, 232, 198], SAND = [206, 176, 132], PINK = [230, 150, 142];
const UMBER = [84, 48, 28], BLACK = [20, 12, 10];
const SAGE = [150, 164, 108], OLIVE = [66, 72, 34];
const RUST = [196, 60, 24], SEDI = [112, 90, 66], STORM = [224, 208, 176], SPECK = [255, 250, 230];
const MAT = [176, 168, 60];
const mix3 = (a, b, t, o) => {
  o[0] = a[0] + (b[0] - a[0]) * t;
  o[1] = a[1] + (b[1] - a[1]) * t;
  o[2] = a[2] + (b[2] - a[2]) * t;
};

// ---- knobs as the model's numbers --------------------------------------------
// keyframes against relief r in 0..1: light catch b, its scale Lr, the reach of the light sg (LED), smoothing D, sediment fill ks
const KR = [0, 0.25, 0.5, 0.75, 1];
const KB = [0.12, 0.4, 0.8, 1.2, 1.5];
const KL = [4, 3.5, 3, 3, 3.5];
const KS = [10, 8, 6.5, 4.6, 7];
const KD = [2.1, 1.1, 0.7, 0.42, 0.12];
const KK = [0.35, 0.18, 0.22, 0.25, 0.3];
const tab = (T, r) => {
  const f = cl(r, 0, 1) * 4, i = min(3, floor(f));
  return T[i] + (T[i + 1] - T[i]) * (f - i);
};
function targets(k) {
  const r = (cl(k[2], -1, 1) + 1) / 2, u = (cl(k[3], -1, 1) + 1) / 2;
  return {
    g: 0.3 * pow(20, cl(k[1], 0, 4) / 4),          // nominal LED a second
    b: tab(KB, r), Lr: tab(KL, r), sg: tab(KS, r), D: tab(KD, r), ks: tab(KK, r) * (1 + 0.5 * u),
    u,
  };
}

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false,
    tau: 0, h: new Float64Array(NS), hn: new Float64Array(NS), S: new Float64Array(NS),
    nz: new Float32Array(NS), gs: new Float32Array(NS), mark: new Float32Array(NS), sb: new Float64Array(NS),
    buf: new Float32Array(NS * RB * 3),
    P: null, ker: null, kn: 0, kSig: -1,
    storm: 0, stT: 0, stD: 0, stSize: 0, stFr: 0.7, stLev: 0, stThick: 0, stSpk: 0, nextStorm: 0,
    cam: 0, mr: 1, mean: 0, cr: [0, 0, 0],
    ph: [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU],
    rot: new Float32Array(9), rotK: -1,
  });
  return st;
}

// The colour of a lamina laid down at season tau, in column i.
function lamina(st, tau, i, out) {
  const p = st.ph, t = tau + 0.7 * sin(0.31 * tau + p[5]);
  const u = 0.46 * sin(TAU * t / 4.7 + p[0]) + 0.34 * sin(TAU * t / 8.1 + p[1]) + 0.3 * sin(TAU * t / 13.3 + p[2]) + 0.2 * sin(TAU * t / 2.9 + p[3] * 1.7 + 1) + 0.2 * sin(0.11 * i + 0.05 * tau + p[3]);
  const light = 0.5 + 0.5 * tanh(4.5 * (u + 0.08));
  const q1 = sin(TAU * tau / 41.3 + p[4]) + 0.7 * sin(TAU * tau / 27.1 + p[5]);
  const q2 = sin(TAU * tau / 67.9 + p[6]) + 0.75 * sin(TAU * tau / 33.7 + p[1] * 2 + p[4]);
  const pinkW = sstep(0.5, 1.3, q1), oliveW = sstep(1.2, 1.55, q2);
  const lc = [0, 0, 0], dc = [0, 0, 0];
  mix3(SAND, CREAM, sstep(0, 0.6, u), lc);
  mix3(lc, PINK, pinkW, lc);
  mix3(lc, SAGE, oliveW, lc);
  mix3(UMBER, BLACK, sstep(0.2, 0.7, -u), dc);
  mix3(dc, OLIVE, oliveW, dc);
  mix3(dc, lc, light, out);
}

// Paint a soft bright speck into the rock at (sample i, row rc).
function speck(st, i, rc) {
  const h = st.h, buf = st.buf;
  const r0 = floor(rc - 2.2), r1 = ceil(rc + 2.2);
  for (let dj = -4; dj <= 4; dj++) {
    const ii = (i + dj + NS) % NS, dxl = dj * DX;
    for (let r = r0; r <= r1; r++) {
      if (r + 1 > h[ii] - 0.3) continue;
      const dy = r + 0.5 - rc, w = exp(-(dxl * dxl + dy * dy) / 0.9);
      if (w < 0.04) continue;
      const p = (ii * RB + (((r % RB) + RB) % RB)) * 3, a = 0.9 * w;
      for (let c = 0; c < 3; c++) buf[p + c] += (SPECK[c] - buf[p + c]) * a;
    }
  }
}

// Add the thickness h0 -> h1 of one colour to a column, an area-weighted mean in each row it touches.
function deposit(st, i, h0, h1, kind, c0) {
  const buf = st.buf, cr = st.cr;
  const r0 = floor(h0), r1 = floor(h1);
  for (let r = r0; r <= r1; r++) {
    const o = min(h1, r + 1) - max(h0, r);
    if (o <= 0) continue;
    // colour of this row's material
    if (kind === 0) {
      cr[0] = c0[0]; cr[1] = c0[1]; cr[2] = c0[2];
    } else if (kind === 1) {
      // dim speckled sediment
      const hv = hash(i, r), m = 0.5 + 0.95 * hv * hv + (hash(i + 977, r) < 0.07 ? 0.5 : 0);
      cr[0] = c0[0] * m; cr[1] = c0[1] * m; cr[2] = c0[2] * m;
    } else {
      // coarse storm sand
      const hv = hash(i + 311, r), m = 0.88 + 0.24 * hv;
      cr[0] = STORM[0] * m; cr[1] = STORM[1] * m; cr[2] = STORM[2] * m;
    }
    const p = (i * RB + (((r % RB) + RB) % RB)) * 3, f = cl(h0 - r, 0, 1), s = f + o;
    for (let c = 0; c < 3; c++) buf[p + c] = f > 0 ? (buf[p + c] * f + cr[c] * o) / s : cr[c];
  }
}

// One step of the growth, dtau in season units (one unit is one LED of mat at the nominal rate).
function step(st, dtau) {
  const P = st.P, h = st.h, hn = st.hn, S = st.S, nz = st.nz, gs = st.gs, mark = st.mark;
  // the light: height against a Gaussian mean of the neighbourhood
  if (st.kSig !== P.sg) {
    st.kSig = P.sg;
    const K = ceil(3 * P.sg / DX), ker = new Float64Array(K + 1);
    let sum = 0;
    for (let j = 0; j <= K; j++) {
      const d = j * DX;
      ker[j] = exp(-d * d / (2 * P.sg * P.sg));
      sum += j === 0 ? ker[j] : 2 * ker[j];
    }
    for (let j = 0; j <= K; j++) ker[j] /= sum;
    st.ker = ker;
    st.kn = K;
  }
  const ker = st.ker, K = st.kn;
  let mean0 = 0;
  for (let i = 0; i < NS; i++) {
    let a = ker[0] * h[i];
    for (let j = 1; j <= K; j++) a += ker[j] * (h[(i + j) % NS] + h[(i - j + NS) % NS]);
    S[i] = a;
    mean0 += h[i];
  }
  mean0 /= NS;
  // slow smooth noise in the growth rate
  for (let i = 0; i < NS; i++) gs[i] = gauss();
  const dec = exp(-dtau / 3), amp = 0.4 * sqrt(dtau);
  for (let i = 0; i < NS; i++) nz[i] = nz[i] * dec + amp * (gs[(i + NS - 1) % NS] + gs[i] + gs[(i + 1) % NS]) * 0.33;
  // the storms
  if (st.storm === 0) {
    st.nextStorm -= dtau;
    if (st.nextStorm <= 0 && P.u > 0.04) startStorm(st, mean0);
    else if (st.nextStorm <= 0) st.nextStorm = 20;
  }
  const b = P.b, Lr = P.Lr, D = P.D, ks = P.ks, tau = st.tau;
  const inErode = st.storm === 1, inFill = st.storm === 2;
  const dtD = D * dtau / (DX * DX);
  for (let i = 0; i < NS; i++) {
    const hc = h[i], hm = h[(i + NS - 1) % NS], hp = h[(i + 1) % NS];
    let dh = 0, kind = 0, ws = 0;
    if (inErode) {
      if (hc > st.stLev) {
        dh = -min(hc - st.stLev, 10 * dtau);
        mark[i] = 1.3;
      }
    } else {
      const rel = hc - S[i];
      let v = 1 + b * tanh(rel / Lr) + nz[i];
      if (v < 0.05) v = 0.05;
      const q = max(0, (hm - hc) / DX, (hp - hc) / DX);
      let sed = rel < -1.2 ? min(ks * (-rel - 1.2), 1.6) : 0;
      let rate = v * sqrt(1 + q * q);
      if (inFill) {
        rate *= 0.25;
        sed = 0;
        const sbi = st.sb[i], gap = max(0, sbi + st.stFr * max(0, st.stLev - sbi) - hc);
        rate += 3 * gap + st.stThick;
        kind = 2;
      } else {
        rate += sed;
        ws = cl(1.7 * sed / max(rate, 0.05), 0, 0.9);
        kind = ws > 0.1 ? 1 : 0;
      }
      dh = rate * dtau + dtD * (hp - 2 * hc + hm);
      if (dh < -0.05) dh = -0.05;
      if (dh > 0 && mark[i] > 0) {
        // the film on a cut
        deposit(st, i, hc, hc + dh, 0, RUST);
        mark[i] -= dh;
        hn[i] = hc + dh;
        continue;
      }
      if (dh > 0) {
        if (kind === 0) {
          lamina(st, tau, i, st.cr);
          deposit(st, i, hc, hc + dh, 0, st.cr);
        } else if (kind === 1) {
          lamina(st, tau, i, st.cr);
          const m = [0, 0, 0];
          mix3(st.cr, SEDI, ws, m);
          deposit(st, i, hc, hc + dh, 1, m);
        } else {
          deposit(st, i, hc, hc + dh, 2, null);
        }
      }
    }
    hn[i] = hc + dh;
  }
  h.set(hn);
  if (inErode) {
    st.stT -= dtau;
    let any = false;
    for (let i = 0; i < NS; i++) if (h[i] > st.stLev + 0.01) { any = true; break; }
    if (st.stT <= 0 || !any) {
      st.storm = 2;
      st.stT = st.stD;
      for (let i = 0; i < NS; i++) st.sb[i] = h[i];
      st.stLev = st.stLev + 0.5 + 1.3 * st.stSize;
    }
  } else if (inFill) {
    st.stT -= dtau;
    // specks in the coarse layer
    st.stSpk += dtau * st.spkRate;
    while (st.stSpk >= 1) {
      st.stSpk -= 1;
      const i = floor(rnd() * NS), t = h[i] - st.sb[i];
      if (t > 1.1) speck(st, i, st.sb[i] + 0.35 * t + 0.4 * rnd() * t);
    }
    if (st.stT <= 0) {
      st.storm = 0;
      const u = P.u;
      st.nextStorm = (0.5 - 0.5 * log(1 - rnd())) * (14 + 230 * pow(1 - u, 2.2)) + 4;
    }
  }
  st.tau += dtau;
  let mean1 = 0;
  for (let i = 0; i < NS; i++) mean1 += h[i];
  mean1 /= NS;
  st.mr += ((mean1 - mean0) / dtau - st.mr) * min(1, dtau / 4);
  st.mean = mean1;
}

function startStorm(st, hm) {
  const P = st.P, h = st.h, u = P.u;
  let hx = -1e9;
  for (let i = 0; i < NS; i++) hx = max(hx, h[i]);
  const size = cl((0.2 + 0.75 * pow(u, 0.7)) * (0.7 + 0.6 * rnd()), 0.15, 1);
  st.stSize = size;
  st.stFr = 0.55 + 0.3 * size;
  st.stD = 1.5 + 3 * size;
  st.stThick = (1.2 + 3 * size) / st.stD;
  st.spkRate = (5 + 12 * size) / st.stD;
  st.stSpk = 0;
  const relief = hx - hm;
  if (relief > 2.5 && rnd() < 0.3 + 0.5 * size) {
    st.storm = 1;
    st.stT = 1.4;
    st.stLev = hm + relief * (0.2 + 0.4 * rnd());
    // the film lies on the planed crowns; the fill level comes after the cut
  } else {
    st.storm = 2;
    st.stT = st.stD;
    for (let i = 0; i < NS; i++) st.sb[i] = h[i];
    st.stLev = hm + relief * (0.05 + 0.4 * size) + 0.5;
  }
}

// ---- update -----------------------------------------------------------------
export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  const T = targets(st.k);
  if (!st.init) {
    st.init = true;
    st.P = Object.assign({}, T);
    // basement: flat laminae below the starting surface
    const h0 = 300;
    st.tau = 0;
    for (let i = 0; i < NS; i++) st.h[i] = h0 - 250;
    const c = [0, 0, 0];
    for (let r = h0 - 250; r < h0; r++) {
      lamina(st, (r - h0) / 1.0, 0, c);
      for (let i = 0; i < NS; i++) {
        lamina(st, (r - h0) / 1.0, i, c);
        const p = (i * RB + (r % RB)) * 3;
        buf3(st.buf, p, c);
      }
    }
    for (let i = 0; i < NS; i++) st.h[i] = h0;
    for (let i = 0; i < NS; i++) st.nz[i] = 0;
    st.nextStorm = 30 + 40 * rnd();
    // the section as it would be after a long growth: run it through its own history
    for (let n = 0; n < 3300; n++) step(st, 0.04);
    // the rock was laid at the knob settings the panel opened with; start the camera
    st.cam = st.mean + YS;
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  // the knobs move the numbers gently
  const P = st.P, a = 1 - exp(-dt / 2.5);
  for (const key in T) P[key] += (T[key] - P[key]) * a;
  P.u = T.u;
  let left = P.g * dt;
  const n = max(1, ceil(left / 0.04));
  for (let s = 0; s < n; s++) step(st, left / n);
  // the camera follows the mean surface with its own smooth speed
  const e = st.mean + YS - st.cam;
  st.cam += dt * (P.g * st.mr + 0.2 * e);
}

function buf3(buf, p, c) {
  buf[p] = c[0]; buf[p + 1] = c[1]; buf[p + 2] = c[2];
}

// ---- draw -------------------------------------------------------------------
export function draw(display, params) {
  let st = params.st;
  if (!st) st = setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const h = st.h, buf = st.buf;
  // hue rotation about the grey axis
  if (st.rotK !== st.k[0]) {
    st.rotK = st.k[0];
    const th = TAU * st.k[0], c = cos(th), s = sin(th) / sqrt(3), d = (1 - c) / 3, R = st.rot;
    R[0] = c + d; R[1] = d - s; R[2] = d + s;
    R[3] = d + s; R[4] = c + d; R[5] = d - s;
    R[6] = d - s; R[7] = d + s; R[8] = c + d;
  }
  const R = st.rot;
  const cam = st.cam;
  for (let y = 0; y < H; y++) {
    const rho = cam - (y + 0.5);
    const rf = rho - 0.5, r0 = floor(rf), f = rf - r0;
    const ra = ((r0 % RB) + RB) % RB, rb = (ra + 1) % RB;
    for (let x = 0; x < W; x++) {
      let pr = 0, pg = 0, pb = 0;
      for (let j = 0; j < 2; j++) {
        const s = 2 * x + j, hs = h[s];
        const cov = cl(hs - rf, 0, 1);
        if (cov <= 0) continue;
        const ca = cl(hs - r0, 0, 1) * (1 - f), cb = cl(hs - r0 - 1, 0, 1) * f;
        const pa = (s * RB + ra) * 3, pbb = (s * RB + rb) * 3;
        let rr = buf[pa] * ca + buf[pbb] * cb, gg = buf[pa + 1] * ca + buf[pbb + 1] * cb, bb = buf[pa + 2] * ca + buf[pbb + 2] * cb;
        // the living film on the surface
        const d = hs - rho;
        if (d < 3.2) {
          const mw = 0.55 * exp(-max(d, 0) / 1.1) * cov;
          rr = rr * (1 - mw) + MAT[0] * mw;
          gg = gg * (1 - mw) + MAT[1] * mw;
          bb = bb * (1 - mw) + MAT[2] * mw;
        }
        pr += rr; pg += gg; pb += bb;
      }
      pr *= 0.5; pg *= 0.5; pb *= 0.5;
      const o0 = R[0] * pr + R[1] * pg + R[2] * pb, o1 = R[3] * pr + R[4] * pg + R[5] * pb, o2 = R[6] * pr + R[7] * pg + R[8] * pb;
      display.setPixel(x, y, cl(floor(o0 + 0.5), 0, 255), cl(floor(o1 + 0.5), 0, 255), cl(floor(o2 + 0.5), 0, 255));
    }
  }
}
