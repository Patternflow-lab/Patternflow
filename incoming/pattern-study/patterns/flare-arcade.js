// ===== Patternflow pattern =====
// Title:   Flare Arcade
// Family:  flareloops
// Idea:    The loop arcade that stands behind a solar flare, seen edge on above a dark brown photosphere strip at the foot of the panel: every flare raises nested arches one by one, each higher and wider than the one before so the two flare ribbons at the feet spread apart, the newest are white-blue hot and the older ones cool down a ladder of yellow, orange, red and dark purple, and blobs of coronal rain slide down the legs of the cool loops while the next, randomly timed and sized flare builds a new arcade over the old one.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the standard flare model and its post-flare loop arcade (Carmichael 1964, Sturrock 1966, Hirayama 1974, Kopp and Pneuman 1976), from memory: reconnection above builds loops one under the other, each higher with its feet wider apart, which then cool while coronal rain runs down their legs and a thin current sheet stands above the newest; the superellipse arch with straight legs, the square-root growth in time, the two-stage temperature ladder, the gravity of the rain along each loop, the random flare scheduler and the haze are original, pattern round 251
// Round:   251
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flare=0..3, Cooling=-1..1, Shear=-1..1
//
// Knob 1: Hue. Turns the whole temperature ladder round the wheel; it opens on the white-blue, yellow, orange, red and dark purple ladder.
// Knob 2: Flare. 0 to 3, opening at 2. How often flares happen and how big they are: at 0 one about every fifteen seconds with arcades a fifth lower, at 3 one about every five seconds at full height, two arcades building at once.
// Knob 3: Cooling. -1 to 1, opening at 0. How long a loop takes to cool, from 8 seconds at -1 to 80 at 1 (25 at the opening): short and only the youngest loops are hot, with a few dark ones left; long and loops stay bright and pile up in layers.
// Knob 4: Shear. -1 to 1, opening at about 0.06. How far the feet of the arcade slide along the surface so the arches lean: upright at 0, leaning left at -1 and right at 1.

const W = 64, H = 128, N = W * H;
const BASE = 120;               // row of the surface line; every loop stands on it
const TM = 160;                 // segments in the table of one arch
const CAP = 28;                 // loops that stay alive at once
const CW = 16, CH = 32;         // the coarse grid of the halo, 4 by 4 LED a cell
const BCAP = 9;                 // coronal rain lumps at once
const PIV = 0.35;               // how much of the lean the feet take, so the arches lean about their middle
const GRAV = 7.5;               // LED per second squared along the loop
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, pow, imul, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = () => Math.random();
const rr = (a, b) => a + (b - a) * rnd();
const fin = (v, d) => (Number.isFinite(v) ? v : d);

// ---- arch tables: a superellipse half, left foot to right foot, legs standing straight ----
function makeTab(n) {
  const X = new Float32Array(TM + 1), Y = new Float32Array(TM + 1), e = 2 / n;
  for (let i = 0; i <= TM; i++) {
    const a = (PI * i) / TM, c = cos(a), s = sin(a);
    X[i] = (c > 0 ? -1 : 1) * pow(abs(c), e);
    Y[i] = pow(max(s, 0), e);
  }
  X[0] = -1; X[TM] = 1; Y[0] = 0; Y[TM] = 0;
  return { X, Y };
}
const TABS = [makeTab(2.2), makeTab(2.5), makeTab(2.9)];

// ---- the temperature ladder: hot at the top, a dark purple at the bottom ----
const LT = [1.15, 0.92, 0.72, 0.54, 0.38, 0.22, 0.1];
const LC = [
  [0.8, 0.97, 1.0], [1.0, 0.95, 0.62], [0.96, 0.66, 0.12], [0.82, 0.3, 0.05],
  [0.66, 0.12, 0.04], [0.34, 0.04, 0.06], [0.19, 0.02, 0.17],
];
// slow drifting columns of haze: centre, speed, width, then the pace and phase at which each comes and goes
const STR = [[0.083, 0.7, 8, 0.131, 2.1], [0.117, 3.9, 11, 0.097, 0.3], [0.071, 5.5, 7, 0.163, 4.6], [0.057, 2.4, 9, 0.113, 1.2], [0.101, 4.8, 6, 0.071, 5.1]];
const RAIN = [1.0, 0.86, 0.74];
const SURF = [0.3, 0.13, 0.045];
const HAZE = [0.5, 0.33, 0.72];
const RIM = [0.5, 0.1, 0.04];

function rotMat(a) {
  const c = cos(a), s = sin(a);
  return [
    0.299 + 0.701 * c + 0.168 * s, 0.587 - 0.587 * c + 0.33 * s, 0.114 - 0.114 * c - 0.497 * s,
    0.299 - 0.299 * c - 0.328 * s, 0.587 + 0.413 * c + 0.035 * s, 0.114 - 0.114 * c + 0.292 * s,
    0.299 - 0.3 * c + 1.25 * s, 0.587 - 0.588 * c - 1.05 * s, 0.114 + 0.886 * c - 0.203 * s,
  ];
}
function rot(m, c, out, o) {
  out[o] = max(0, m[0] * c[0] + m[1] * c[1] + m[2] * c[2]);
  out[o + 1] = max(0, m[3] * c[0] + m[4] * c[1] + m[5] * c[2]);
  out[o + 2] = max(0, m[6] * c[0] + m[7] * c[1] + m[8] * c[2]);
}
function ladder(lad, T, out) {
  let i = 0;
  while (i < 5 && T < LT[i + 1]) i++;
  const t = cl((T - LT[i + 1]) / (LT[i] - LT[i + 1]), 0, 1), u = t * t * (3 - 2 * t);
  const a = (i + 1) * 3, b = i * 3;
  out[0] = lad[a] + (lad[b] - lad[a]) * u;
  out[1] = lad[a + 1] + (lad[b + 1] - lad[a + 1]) * u;
  out[2] = lad[a + 2] + (lad[b + 2] - lad[a + 2]) * u;
}

function hash3(x, y, z) {
  let h = imul(x, 374761393) ^ imul(y, 668265263) ^ imul(z, 1274126177);
  h = imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, z) {
  const ix = floor(x), iy = floor(y), iz = floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = hash3(ix, iy, iz), b = hash3(ix + 1, iy, iz), c = hash3(ix, iy + 1, iz), d = hash3(ix + 1, iy + 1, iz);
  const e = hash3(ix, iy, iz + 1), f = hash3(ix + 1, iy, iz + 1), g = hash3(ix, iy + 1, iz + 1), h = hash3(ix + 1, iy + 1, iz + 1);
  const p = (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  const q = (e + (f - e) * fx) + ((g + (h - g) * fx) - (e + (f - e) * fx)) * fy;
  return p + (q - p) * fz;
}

export function setup(params) {
  const mk = () => new Float32Array(N);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, t: 0,
    glow: 0, loops: [], events: [], blobs: [], next: rr(0.4, 2), lastCx: 32,
    hm: rotMat(0), lad: new Float32Array(21), tint: new Float32Array(12),
    LR: mk(), LG: mk(), LB: mk(), TR: mk(), TG: mk(), TB: mk(), OR: mk(), OG: mk(), OB: mk(),
    CR: new Float32Array(CW * CH), CG: new Float32Array(CW * CH), CB: new Float32Array(CW * CH), CT: new Float32Array(CW * CH), sx: new Float32Array(W), cxa: new Float32Array(W), cw: new Float32Array(W),
  });
  return st;
}

// ---- flares ----------------------------------------------------------------
function newEvent(st) {
  const f2 = cl(st.ks[1] / 2, 0, 1);
  const sz = rnd();
  const Hmax = (40 + 72 * sz) * (0.8 + 0.2 * f2);
  const wr = 0.5 * ((Hmax - 40) / 72) + 0.5 * rnd();
  const Wmax = 8 + 20 * wr;
  const n = cl(Math.round(Wmax / 5 + rr(-0.6, 0.9)), 3, 6);
  const D = 5 + 20 * (0.4 * sz + 0.6 * rnd());
  let cx = 32 + rr(-10, 10);
  for (let i = 0; i < 4 && abs(cx - st.lastCx) < 6; i++) cx = 32 + rr(-10, 10);
  cx = cl(cx, Wmax + 4, 60 - Wmax);
  st.lastCx = cx;
  const bt = [];
  for (let j = 0; j < n; j++) bt.push((j / n) * D * rr(0.9, 1.1));
  st.glow = min(1.4, st.glow + 0.6 * (0.5 + 0.5 * f2));
  st.events.push({ t: 0, D, n, born: 0, bt, Hmax, Wmax, cx, tab: TABS[floor(rnd() * 3)], en: 0.75 + 0.25 * f2, hNow: 6, ph: rr(0, 6.28), tilt: rr(-0.07, 0.07) });
}

function addLoop(st, ev, j) {
  const s = (j + 1) / ev.n;
  st.loops.push({
    cx: ev.cx + rr(-1.2, 1.2), w: ev.Wmax * pow(s, 0.85) * rr(0.96, 1.04), h: min(ev.Hmax * pow(s, 0.5) * rr(0.95, 1.05), BASE - 4), tilt: ev.tilt,
    tab: ev.tab, age: 0, q: 0.7, f: 0.3, ra: 1, mul: 1, fade: 1, dying: false, rain: 0,
    sw: rr(0.6, 1.4) + 0.012 * ev.Hmax, sf: rr(0.2, 0.45), sp: rr(0, 6.28), ph: rr(0, 6.28),
  });
  let alive = 0;
  for (const l of st.loops) if (!l.dying) alive++;
  while (alive > CAP) {
    let lo = null;
    for (const l of st.loops) if (!l.dying && (!lo || l.q + l.f < lo.q + lo.f)) lo = l;
    lo.dying = true; alive--;
  }
}

function step(st, dt) {
  const k2 = cl(st.ks[1], 0, 3);
  const cool = 8 * pow(10, (cl(st.ks[2], -1, 1) + 1) * 0.5);
  st.t += dt;
  st.glow *= exp(-dt / 5);
  st.next -= dt;
  if (st.next <= 0) {
    if (st.events.length < 2) newEvent(st);
    st.next = (15 / (1 + 0.2 * k2 * k2)) * rr(0.55, 1.45);
  }
  for (let i = st.events.length - 1; i >= 0; i--) {
    const ev = st.events[i];
    ev.t += dt;
    ev.hNow += (ev.Hmax * pow(max(ev.born, 1) / ev.n, 0.5) - ev.hNow) * (1 - exp(-dt / 0.7));
    while (ev.born < ev.n && ev.t >= ev.bt[ev.born]) addLoop(st, ev, ev.born++);
    if (ev.t > ev.D + 8) st.events.splice(i, 1);
  }
  const end = 2.4 * cool + 14;
  for (let i = st.loops.length - 1; i >= 0; i--) {
    const l = st.loops[i];
    l.age += dt;
    l.q *= exp(-dt / cool);
    l.f *= exp(-dt / min(0.3 * cool, 9));
    l.fade = min(l.fade, cl(1 - (l.age - end) / 8, 0, 1));
    if (l.dying) l.mul -= dt / 1.6;
    if (l.fade <= 0 || l.mul <= 0) {
      for (let j = st.blobs.length - 1; j >= 0; j--) if (st.blobs[j].lp === l) st.blobs.splice(j, 1);
      st.loops.splice(i, 1);
      continue;
    }
    if (l.q + l.f < 0.5 && l.age > 4 && l.rain < 2 && !l.dying && st.blobs.length < BCAP && rnd() < dt * 0.035) {
      const side = rnd() < 0.5 ? -1 : 1;
      st.blobs.push({ lp: l, q: TM / 2 + side * rr(1, 6), v: side * rr(0.4, 1.4), life: 0 });
      l.rain++;
    }
  }
  // only the warmest dozen loops stay at full strength; the colder ones sink into the dark by rank
  const order = st.loops.filter((l) => !l.dying).sort((a, b) => b.q + b.f - a.q - a.f);
  const ka = 1 - exp(-dt / 1.2);
  for (let i = 0; i < order.length; i++) order[i].ra += (1 - 0.85 * sstep(11, 27, i) - order[i].ra) * ka;
  for (let i = st.blobs.length - 1; i >= 0; i--) {
    const b = st.blobs[i], l = b.lp, X = l.tab.X, Y = l.tab.Y;
    const k = cl(floor(b.q), 0, TM - 1);
    const dx = l.w * (X[k + 1] - X[k]), dy = l.h * (Y[k + 1] - Y[k]);
    const ds = max(sqrt(dx * dx + dy * dy), 0.05);
    b.v = cl(b.v - GRAV * (dy / ds) * dt, -45, 45);
    b.q += (b.v * dt) / ds;
    b.life += dt;
    if (b.q <= 0.5 || b.q >= TM - 0.5 || b.life > 40) { l.rain--; st.blobs.splice(i, 1); }
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
    for (let i = 0; i < 800; i++) step(st, 0.1);
  } else {
    const a = 1 - exp(-dt / 0.15);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  const n = max(1, ceil(dt / 0.1));
  for (let i = 0; i < n; i++) step(st, dt / n);
  // the colours turn with the Hue knob
  st.hm = rotMat(6.2831853 * cl(st.ks[0], 0, 1));
  for (let i = 0; i < 7; i++) rot(st.hm, LC[i], st.lad, i * 3);
  rot(st.hm, RAIN, st.tint, 0); rot(st.hm, SURF, st.tint, 3); rot(st.hm, HAZE, st.tint, 6); rot(st.hm, RIM, st.tint, 9);
}

// ---- drawing ----------------------------------------------------------------
function splatLoop(st, lp, lean, col, gain, wl, hl) {
  const X = lp.tab.X, Y = lp.tab.Y, LR = st.LR, LG = st.LG, LB = st.LB;
  const t = st.t, sw = lp.sw * sin(lp.sf * t + lp.sp), ph = lp.ph - 1.3 * t;
  const Lh = (lean + lp.tilt) * lp.h, cx = lp.cx - PIV * Lh;
  let px = cx + wl * X[0], py = BASE - hl * Y[0];
  for (let k = 1; k <= TM; k++) {
    const x1 = cx + wl * X[k] + (Lh + sw) * Y[k], y1 = BASE - hl * Y[k];
    const dx = x1 - px, dy = y1 - py, len = sqrt(dx * dx + dy * dy);
    if (len > 1e-4) {
      const ns = ceil(len / 0.6), wt = len / ns * gain * (0.75 + 0.3 * Y[k]) * (1 + 0.28 * sin(0.2 * k + ph));
      for (let j = 0; j < ns; j++) {
        const f = (j + 0.5) / ns;
        const fx = px + dx * f - 0.5, fy = py + dy * f - 0.5;
        const ix = floor(fx), iy = floor(fy);
        if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) continue;
        const tx = fx - ix, ty = fy - iy, i = iy * W + ix;
        const w00 = (1 - tx) * (1 - ty) * wt, w10 = tx * (1 - ty) * wt, w01 = (1 - tx) * ty * wt, w11 = tx * ty * wt;
        LR[i] += col[0] * w00; LG[i] += col[1] * w00; LB[i] += col[2] * w00;
        LR[i + 1] += col[0] * w10; LG[i + 1] += col[1] * w10; LB[i + 1] += col[2] * w10;
        LR[i + W] += col[0] * w01; LG[i + W] += col[1] * w01; LB[i + W] += col[2] * w01;
        LR[i + W + 1] += col[0] * w11; LG[i + W + 1] += col[1] * w11; LB[i + W + 1] += col[2] * w11;
      }
    }
    px = x1; py = y1;
  }
}

function blur3(src, tmp, dst) {
  const S = 0.19, C = 1 - 2 * S;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    tmp[o] = src[o] * (C + S) + src[o + 1] * S;
    for (let x = 1; x < W - 1; x++) tmp[o + x] = src[o + x - 1] * S + src[o + x] * C + src[o + x + 1] * S;
    tmp[o + W - 1] = src[o + W - 1] * (C + S) + src[o + W - 2] * S;
  }
  for (let x = 0; x < W; x++) dst[x] = tmp[x] * (C + S) + tmp[x + W] * S;
  for (let y = 1; y < H - 1; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) dst[o + x] = tmp[o - W + x] * S + tmp[o + x] * C + tmp[o + W + x] * S;
  }
  const o = (H - 1) * W;
  for (let x = 0; x < W; x++) dst[o + x] = tmp[o + x] * (C + S) + tmp[o - W + x] * S;
}

function blurC(a, t) {
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const o = y * CW;
    t[o + x] = a[o + max(x - 1, 0)] * 0.25 + a[o + x] * 0.5 + a[o + min(x + 1, CW - 1)] * 0.25;
  }
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    a[y * CW + x] = t[max(y - 1, 0) * CW + x] * 0.25 + t[y * CW + x] * 0.5 + t[min(y + 1, CH - 1) * CW + x] * 0.25;
  }
}
function haloAdd(st, gain) {
  const { OR, OG, OB, CR, CG, CB, CT } = st;
  CR.fill(0); CG.fill(0); CB.fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = (y >> 2) * CW + (x >> 2), i = y * W + x;
    CR[c] += OR[i]; CG[c] += OG[i]; CB[c] += OB[i];
  }
  const g = gain / 16;
  for (let i = 0; i < CW * CH; i++) { CR[i] *= g; CG[i] *= g; CB[i] *= g; }
  for (let r = 0; r < 2; r++) { blurC(CR, CT); blurC(CG, CT); blurC(CB, CT); }
  for (let y = 0; y < H; y++) {
    const v = cl((y + 0.5) / 4 - 0.5, 0, CH - 1), y0 = min(floor(v), CH - 2), ty = v - y0;
    for (let x = 0; x < W; x++) {
      const u = cl((x + 0.5) / 4 - 0.5, 0, CW - 1), x0 = min(floor(u), CW - 2), tx = u - x0;
      const a = y0 * CW + x0, b = a + CW;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty, i = y * W + x;
      OR[i] += CR[a] * w00 + CR[a + 1] * w10 + CR[b] * w01 + CR[b + 1] * w11;
      OG[i] += CG[a] * w00 + CG[a + 1] * w10 + CG[b] * w01 + CG[b + 1] * w11;
      OB[i] += CB[a] * w00 + CB[a + 1] * w10 + CB[b] * w01 + CB[b + 1] * w11;
    }
  }
}

const gxb = new Float32Array(24), gyb = new Float32Array(16);
function glow(OR, OG, OB, x0, y0, sx, sy, col, amp) {
  const rx = ceil(sx * 2.6), ry = ceil(sy * 2.6);
  const ix0 = floor(x0), iy0 = floor(y0);
  const a = -0.5 / (sx * sx), b = -0.5 / (sy * sy);
  let nx = 0, ny = 0;
  for (let x = ix0 - rx; x <= ix0 + rx; x++) gxb[nx++] = exp(a * (x + 0.5 - x0) * (x + 0.5 - x0));
  for (let y = iy0 - ry; y <= iy0 + ry; y++) gyb[ny++] = exp(b * (y + 0.5 - y0) * (y + 0.5 - y0));
  for (let j = 0; j < ny; j++) {
    const y = iy0 - ry + j;
    if (y < 0 || y >= H) continue;
    for (let i = 0; i < nx; i++) {
      const x = ix0 - rx + i;
      if (x < 0 || x >= W) continue;
      const w = gxb[i] * gyb[j] * amp, p = y * W + x;
      OR[p] += col[0] * w; OG[p] += col[1] * w; OB[p] += col[2] * w;
    }
  }
}

function pt(tab, q, lp, lean, out) {
  const k = cl(floor(q), 0, TM - 1), f = cl(q - k, 0, 1);
  const X = tab.X[k] + (tab.X[k + 1] - tab.X[k]) * f, Y = tab.Y[k] + (tab.Y[k + 1] - tab.Y[k]) * f;
  out[0] = lp.cx + lp.w * X + (lean + lp.tilt) * lp.h * (Y - PIV);
  out[1] = BASE - lp.h * Y;
}

const pp = [0, 0], lc = [0, 0, 0];
export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const LR = st.LR, LG = st.LG, LB = st.LB, OR = st.OR, OG = st.OG, OB = st.OB;
  const lean = 0.16 * cl(st.ks[3], -1, 1);
  LR.fill(0); LG.fill(0); LB.fill(0);
  for (const lp of st.loops) {
    const a = lp.mul * lp.fade * lp.ra;
    if (a < 0.01) continue;
    const g = 1 - pow(1 - min(1, lp.age / 1.4), 3);
    const T = lp.q + lp.f + 0.35 * exp(-lp.age / 3);
    ladder(st.lad, T, lc);
    splatLoop(st, lp, lean, lc, a * 2.1 * (0.35 + 0.65 * g) * (1 + 0.5 * sstep(0.7, 1.1, T)), lp.w * (0.92 + 0.08 * g), lp.h * (0.8 + 0.2 * g));
  }
  blur3(LR, st.TR, OR); blur3(LG, st.TG, OG); blur3(LB, st.TB, OB);
  haloAdd(st, 0.13);

  // glows at the feet: the ribbons
  for (const lp of st.loops) {
    const a = lp.mul * lp.fade * lp.ra;
    const T = lp.q + lp.f + 0.35 * exp(-lp.age / 3);
    const I = a * pow(max(T - 0.08, 0), 1.3) * 0.5 * min(1, lp.age / 1);
    if (I < 0.02) continue;
    ladder(st.lad, T, lc);
    const fx = lp.cx - PIV * (lean + lp.tilt) * lp.h;
    glow(OR, OG, OB, fx - lp.w, BASE - 0.5, 2.6, 2.2, lc, I);
    glow(OR, OG, OB, fx + lp.w, BASE - 0.5, 2.6, 2.2, lc, I);
  }
  for (const ev of st.events) {
    const rs = cl(ev.t / ev.D, 1 / ev.n, 1), w = ev.Wmax * pow(rs, 0.85);
    const I = ev.en * 0.9 * (ev.t < ev.D ? 1 : exp(-(ev.t - ev.D) / 2.5));
    ladder(st.lad, 1.05, lc);
    const fx = ev.cx - PIV * (lean + ev.tilt) * ev.hNow;
    glow(OR, OG, OB, fx - w, BASE - 0.5, 3.2, 2.6, lc, I);
    glow(OR, OG, OB, fx + w, BASE - 0.5, 3.2, 2.6, lc, I);
    // the current sheet above the arcade: a pale ray up from the newest loop's top, with bands running up it
    const hn = BASE - ev.hNow, xc = ev.cx + (lean + ev.tilt) * ev.hNow * (1 - PIV), Is = 0.36 * ev.en * (ev.t < ev.D ? 1 : exp(-(ev.t - ev.D) / 5)) * sstep(0, 2, ev.t);
    if (Is > 0.01) {
      for (let y = 0; y < hn - 1; y++) {
        const d = hn - y, am = Is * exp(-d / 36) * (0.7 + 0.3 * sin(0.3 * d - 4.5 * st.t + ev.ph)) * sstep(0, 5, d);
        const x0 = floor(xc - 4);
        for (let x = max(0, x0); x <= min(W - 1, x0 + 8); x++) {
          const dx = x + 0.5 - xc, wv = am * exp(-dx * dx / 3.4), p = y * W + x;
          OR[p] += lc[0] * wv; OG[p] += lc[1] * wv; OB[p] += lc[2] * wv;
        }
      }
    }
  }

  // coronal rain
  const tint = st.tint;
  for (const b of st.blobs) {
    const l = b.lp;
    const a = cl(l.mul * l.fade * 3, 0, 1);
    pt(l.tab, b.q, l, lean, pp);
    const hx = pp[0], hy = pp[1];
    const foot = sstep(0, 7, BASE - hy) * sstep(0, 3, b.life);
    const dir = b.v < 0 ? -1 : 1;
    const k = cl(floor(b.q), 0, TM - 1);
    const dx = l.w * (l.tab.X[k + 1] - l.tab.X[k]), dy = l.h * (l.tab.Y[k + 1] - l.tab.Y[k]);
    const dq = (0.9 / max(sqrt(dx * dx + dy * dy), 0.05)) * dir;
    glow(OR, OG, OB, hx, hy, 1.3, 1.3, tint, 1.5 * a * foot);
    for (let i = 1; i <= 8; i++) {
      pt(l.tab, b.q - dq * i * (1 + 0.2 * i), l, lean, pp);
      glow(OR, OG, OB, pp[0], pp[1], 0.95, 0.95, tint, 0.8 * a * foot * pow(1 - i / 9, 1.5));
    }
  }

  // haze and surface
  const t = st.t;
  const sx = st.sx, cxa = st.cxa, cw = st.cw;
  for (let x = 0; x < W; x++) { sx[x] = sin(0.07 * x + 0.9 + 0.031 * t); cxa[x] = cos(0.07 * x + 0.9 + 0.031 * t); cw[x] = 0; }
  for (let i = 0; i < STR.length; i++) {
    const c = 32 + 24 * sin(STR[i][0] * t + STR[i][1]), s2 = STR[i][2], a = pow(0.5 + 0.5 * sin(STR[i][3] * t + STR[i][4]), 2);
    for (let x = 0; x < W; x++) { const d = x + 0.5 - c; cw[x] += a * exp(-d * d / (2 * s2 * s2)); }
  }
  const hz = st.tint, sf = [hz[3], hz[4], hz[5]], hc = [hz[6], hz[7], hz[8]], rim = [hz[9], hz[10], hz[11]];
  for (let y = 0; y < H; y++) {
    const above = BASE - y;
    const hbase = above > 0 ? (0.2 + 0.17 * exp(-above / 30)) * (1 + 0.9 * st.glow) : 0;
    const sy1 = sin(0.045 * y + 2.1 - 0.027 * t), cy1 = cos(0.045 * y + 2.1 - 0.027 * t);
    const sy2 = sin(0.021 * y - 0.8 + 0.017 * t), cy2 = cos(0.021 * y - 0.8 + 0.017 * t);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let r = OR[i], g = OG[i], b = OB[i];
      if (above > 0) {
        const wv = 0.62 + 0.3 * (sx[x] * cy1 + cxa[x] * sy1) + 0.15 * (sin(0.031 * x - 0.011 * t + 0.4) * cy2 + cos(0.031 * x - 0.011 * t + 0.4) * sy2);
        const h = hbase * wv + 0.2 * cw[x] * (0.55 + 0.45 * (1 - y / BASE));
        r += hc[0] * h; g += hc[1] * h; b += hc[2] * h;
        if (above < 3) {
          const rv = (3 - above) / 3 * (0.5 + 0.5 * vnoise(x * 0.35 + t * 0.2, 0.5, t * 0.35)) * 0.55;
          r += rim[0] * rv; g += rim[1] * rv; b += rim[2] * rv;
        }
      } else {
        const depth = (y - BASE) / (H - BASE);
        const n = vnoise(x * 0.2 + t * 0.045, y * 0.5, t * 0.1) * 0.7 + vnoise(x * 0.43 - t * 0.03, y * 0.9 + 7, t * 0.17) * 0.3;
        const v = (0.38 + 1.0 * n) * (1 - 0.3 * depth);
        r += sf[0] * v; g += sf[1] * v; b += sf[2] * v;
      }
      // soft clip so overlaps get brighter but never leave 255
      const m = max(r, g, b);
      if (m > 0.72) {
        const k = (0.72 + 0.28 * (1 - exp(-(m - 0.72) / 0.28))) / m;
        r *= k; g *= k; b *= k;
      }
      display.setPixel(x, y, floor(cl(r, 0, 1) * 255), floor(cl(g, 0, 1) * 255), floor(cl(b, 0, 1) * 255));
    }
  }
}
