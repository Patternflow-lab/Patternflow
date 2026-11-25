// ===== Patternflow pattern =====
// Title:   Haar Quadrants
// Family:  haar
// Idea:    The whole panel is the two-dimensional Haar wavelet transform of a hidden moving picture in the classic quadrant layout, with vertical edges in magenta, horizontal edges in cyan and diagonal edges in gold, so every disc, bar, ring and wedge drifting through the unseen scene shows up as nested ghost outlines in the three big outer quadrants and again, at half the size, in the corner that holds the coarser levels.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Haar wavelet (Alfred Haar, 1909) and the pyramid algorithm and quadrant layout of the discrete wavelet transform (Stephane Mallat, 1989), both from memory; the hidden scene of drifting shapes with their own lives, the orientation colours with edge polarity as a hue shift, the soft threshold and the knee are original, pattern round 250
// Round:   250
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Keep=0..4, Focus=-1..1, Scene=-1..1
//
// Knob 1: Hue. Turns the three orientation colours round the wheel together; it opens on cyan, magenta and gold with a pale slate corner.
// Knob 2: Keep. 0 to 4, opening at 2. The soft threshold on the coefficients: at 0 only the strongest edges of the strongest shapes survive as sparse blocks, at 4 every faint gradient of the hidden scene glows too.
// Knob 3: Focus. -1 to 1, opening at 0. How sharp the edges of the hidden shapes are: crisp at -1, where each outline is a thin bright line at every scale, and blurred at 1, where the outlines in the fine quadrants spread into wide soft glows.
// Knob 4: Scene. -1 to 1, opening at about 0.06. How busy the hidden picture is: three slow shapes at -1, five at the start, seven moving four times as fast at 1.

const W = 64, H = 128, N = W * H;
const ETARGET = 100;
const LEV = 4;                 // levels of the transform: 64x128 down to a 4x8 corner
const NS = 8;                  // slots for hidden shapes
const { floor, min, max, abs, sqrt, exp, sin, cos, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = () => Math.random();
const rr = (a, b) => a + (b - a) * rnd();
const fin = (v, d) => (Number.isFinite(v) ? v : d);

// band bases: 1 vertical edges (top right), 2 horizontal edges (bottom left), 3 diagonal (bottom right)
const HUE = [0.62, 0.85, 0.5, 0.125];
const LGAIN = [1, 1, 1.05, 1.15, 1.3];     // per level, index 1..4
const BGAIN = [1, 1, 1, 3.0];              // per band: diagonal coefficients of a smooth edge are weaker

const hv = [0, 0, 0];
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- shapes ----------------------------------------------------------------
// 0 disc, 1 ring, 2 bar, 3 triangle, 4 wedge, 5 ellipse
// where each slot's shape lives, so the shapes stay spread over the whole panel and the first slots are far apart
const HOME = [[18, 78], [46, 28], [46, 100], [18, 26], [46, 64], [18, 112], [16, 52], [46, 6]];
function newShape(sh, prev, slot) {
  let k = prev;
  while (k === prev) {
    const q = rnd();
    k = q < 0.17 ? 0 : q < 0.32 ? 1 : q < 0.52 ? 2 : q < 0.68 ? 3 : q < 0.84 ? 4 : 5;
  }
  sh.kind = k;
  sh.life = rr(12, 30);
  sh.cx = HOME[slot][0] + rr(-7, 7); sh.cy = HOME[slot][1] + rr(-8, 8);
  sh.ax = rr(6, 14); sh.ay = rr(10, 24);
  sh.fx1 = rr(0.09, 0.24); sh.fy1 = rr(0.08, 0.21);
  sh.fx2 = sh.fx1 * rr(1.9, 2.7); sh.fy2 = sh.fy1 * rr(1.7, 2.5);
  sh.bx = sh.ax * rr(0.2, 0.4); sh.by = sh.ay * rr(0.2, 0.4);
  sh.p = [rr(0, TP), rr(0, TP), rr(0, TP), rr(0, TP), rr(0, TP), rr(0, TP), rr(0, TP)];
  sh.rot0 = rr(0, TP);
  sh.rot = (rnd() < 0.5 ? -1 : 1) * rr(0.05, 0.26);
  sh.wob = rr(0.4, 1.0); sh.fw = rr(0.05, 0.14);
  sh.size = k === 0 ? rr(9, 15) : k === 1 ? rr(11, 17) : k === 2 ? rr(17, 30) : k === 3 ? rr(12, 19) : k === 4 ? rr(28, 52) : rr(12, 20);
  sh.aspect = k === 2 ? rr(0.18, 0.32) : k === 5 ? rr(0.45, 0.7) : 0.5;
  sh.thick = rr(2.6, 4.6);
  sh.half = rr(0.32, 0.62);                          // wedge half-angle
  sh.pulse = rr(0.08, 0.2); sh.fp = rr(0.05, 0.13);
  sh.amp = (rnd() < 0.78 ? 1 : -1) * rr(0.5, 0.95);
}

export function setup(params) {
  const band = new Uint8Array(N), lvl = new Uint8Array(N), blk = new Uint16Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let b = 0, l = LEV, id = 0;
    for (let k = 1; k <= LEV; k++) {
      const w = W >> k, h = H >> k;
      if (x < 2 * w && y < 2 * h && !(x < w && y < h)) { l = k; b = x >= w ? (y >= h ? 3 : 1) : 2; id = k * 4 + b; break; }
    }
    if (id === 0) { l = LEV; b = 0; id = LEV * 4; }
    band[i] = b; lvl[i] = l; blk[i] = id;
  }
  const sep = new Uint8Array(N);
  for (let k = 1; k <= LEV; k++) {
    const w = W >> k, h = H >> k;
    for (let y = 0; y < 2 * h; y++) sep[y * W + w] = 1;
    for (let x = 0; x < 2 * w; x++) sep[h * W + x] = 1;
  }
  const shapes = [];
  for (let i = 0; i < NS; i++) {
    const sh = {};
    newShape(sh, -1, i);
    sh.age = rnd() * sh.life;
    shapes.push(sh);
  }
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    tau: 0, ph: [rr(0, TP), rr(0, TP), rr(0, TP), rr(0, TP)],
    band, lvl, blk, sep, shapes,
    S: new Float32Array(N), A: new Float32Array(N), B: new Float32Array(N),
    coef: new Float32Array(N), P: new Float32Array(N), M: new Float32Array(N),
    P2: new Float32Array(N), M2: new Float32Array(N),
  });
  return st;
}

// ---- the hidden picture -----------------------------------------------------
function paintShape(S, sh, tau, e, act) {
  const u = sh.age / sh.life;
  const env = sstep(0, 0.2, u) * sstep(1, 0.8, u) * act;
  if (env < 0.01) return;
  const t = tau;
  const cx = sh.cx + sh.ax * sin(sh.fx1 * t + sh.p[0]) + sh.bx * sin(sh.fx2 * t + sh.p[1]);
  const cy = sh.cy + sh.ay * sin(sh.fy1 * t + sh.p[2]) + sh.by * sin(sh.fy2 * t + sh.p[3]);
  const th = sh.rot0 + sh.rot * t + sh.wob * sin(sh.fw * t + sh.p[4]);
  const sz = sh.size * (1 + sh.pulse * sin(sh.fp * t + sh.p[5])) * (0.55 + 0.45 * sstep(0, 0.3, u) * sstep(1, 0.7, u));
  const kind = sh.kind;
  const ct = cos(th), sn = sin(th);
  const R = (kind === 2 ? sz * 1.05 : kind === 4 ? sz : kind === 1 ? sz + sh.thick : sz * 1.1) + e * 2 + 2;
  const x0 = max(0, floor(cx - R)), x1 = min(W - 1, floor(cx + R) + 1);
  const y0 = max(0, floor(cy - R)), y1 = min(H - 1, floor(cy + R) + 1);
  const amp = sh.amp * env;
  const asp = sh.aspect, th2 = sh.thick * 0.5, hs = sh.half;
  const ch = cos(hs), sh2 = sin(hs);
  const inv = 1 / (2 * e);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    const o = y * W;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const uu = dx * ct + dy * sn, vv = -dx * sn + dy * ct;
      let d;
      if (kind === 0) d = sz - sqrt(dx * dx + dy * dy);
      else if (kind === 1) d = th2 - abs(sqrt(dx * dx + dy * dy) - sz);
      else if (kind === 2) d = min(sz - abs(uu), sz * asp - abs(vv));
      else if (kind === 3) {
        // equilateral triangle, circumradius sz, inradius sz / 2
        const a1 = uu, a2 = -0.5 * uu + 0.8660254 * vv, a3 = -0.5 * uu - 0.8660254 * vv;
        d = sz * 0.5 - max(a1, a2, a3);
      } else if (kind === 4) {
        const r = sqrt(dx * dx + dy * dy);
        d = min(sz - r, uu * sh2 - abs(vv) * ch);
      } else {
        const q = sqrt((uu * uu) / (sz * sz) + (vv * vv) / (sz * asp * sz * asp));
        d = (1 - q) * sz * asp;
      }
      const a = cl((d + e) * inv, 0, 1);
      if (a > 0) S[o + x] += amp * a * a * (3 - 2 * a);
    }
  }
}

function build(st, dtw) {
  const S = st.S, tau = st.tau, ph = st.ph;
  const k3 = cl(st.ks[2], -1, 1);
  const e = 1.5 * Math.pow(k3 >= 0 ? 3 : 0.45, abs(k3));
  const n = 5.0 + 2.0 * cl(st.ks[3], -1, 1);
  // a slow large-scale gradient so the corner is never flat
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      S[o + x] = 0.3 + 0.14 * sin(0.026 * x + 0.017 * y + ph[0] + 0.041 * tau) + 0.1 * sin(-0.011 * x + 0.029 * y + ph[1] - 0.027 * tau)
        + 0.05 * sin(0.04 * x - 0.02 * y + ph[2] + 0.017 * tau);
    }
  }
  const sh = st.shapes;
  for (let i = 0; i < NS; i++) {
    const s = sh[i];
    s.age += dtw;
    if (s.age >= s.life) { newShape(s, s.kind, i); s.age = 0; }
    const act = sstep(i - 0.5, i + 0.5, n);
    if (act > 0.005) paintShape(S, s, tau, e, act);
  }
}

// ---- the transform ----------------------------------------------------------
function haar(st) {
  const coef = st.coef;
  let cur = st.A, nxt = st.B;
  cur.set(st.S);
  let w = W, h = H;
  for (let l = 1; l <= LEV; l++) {
    const nw = w >> 1, nh = h >> 1;
    for (let y = 0; y < nh; y++) {
      const r0 = 2 * y * w, r1 = r0 + w;
      for (let x = 0; x < nw; x++) {
        const a = cur[r0 + 2 * x], b = cur[r0 + 2 * x + 1], c = cur[r1 + 2 * x], d = cur[r1 + 2 * x + 1];
        nxt[y * nw + x] = (a + b + c + d) * 0.25;
        coef[y * W + nw + x] = (a - b + c - d) * 0.25;            // left minus right: vertical edges
        coef[(nh + y) * W + x] = (a + b - c - d) * 0.25;          // top minus bottom: horizontal edges
        coef[(nh + y) * W + nw + x] = (a - b - c + d) * 0.25;     // diagonal
      }
    }
    const t = cur; cur = nxt; nxt = t;
    w = nw; h = nh;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) coef[y * W + x] = cur[y * w + x];
}

// ---- Lab hooks --------------------------------------------------------------
export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
  } else {
    const a = 1 - exp(-dt / 0.12);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  const speed = 0.55 * exp(0.75 * (cl(st.ks[3], -1, 1) + 1));
  const dtw = dt * speed;
  st.tau += dtw;
  build(st, dtw);
  haar(st);
  // automatic exposure: the total edge energy of the picture steers a slow gain, so a frame with one small shape
  // does not go dim and one with a crowd does not blow out
  const coef = st.coef, band = st.band;
  let E = 0;
  for (let i = 0; i < N; i++) if (band[i] !== 0) E += min(abs(coef[i]), 0.25);
  st.E = E;
  if (!(st.eg > 0)) st.eg = E;
  st.eg += (E - st.eg) * (1 - exp(-dt / 1.2));
  const gt = cl(ETARGET / max(st.eg, 1), 0.6, 2.0);
  st.ag = st.ag > 0 ? st.ag + (gt - st.ag) * (1 - exp(-dt / 0.8)) : gt;
}

const SEP = [12, 18, 30];

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const coef = st.coef, band = st.band, lvl = st.lvl, blk = st.blk;
  const P = st.P, M = st.M, P2 = st.P2, M2 = st.M2;
  const k2 = cl(st.ks[1], 0, 4);
  const T = 0.06 * exp(-1.0 * k2);
  const G = 3.4;
  const ag = st.ag > 0 ? st.ag : 1;
  // a blurred edge spreads its step over more coefficients, each weaker, so the blur lifts them back
  const fe = Math.pow(3, 0.7 * max(0, cl(st.ks[2], -1, 1)));
  const hue = fin(st.ks[0], 0);
  for (let i = 0; i < N; i++) {
    const b = band[i];
    P[i] = 0; M[i] = 0;
    if (b === 0) continue;
    const c = coef[i];
    const m = (abs(c) * BGAIN[b] * fe * ag - T) * LGAIN[lvl[i]];
    if (m > 0) { const v = (1 - exp(-G * Math.pow(m, 0.7))) * sstep(0, 0.014, m); if (c > 0) P[i] = v; else M[i] = v; }
  }
  // glow: a fifth of each lit coefficient goes to its four neighbours inside the same block
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, id = blk[i];
      const K = (band[i] === 3 ? 0.24 : 0.2) + 4 * T;
      let sp = 0, sm = 0;
      if (x > 0 && blk[i - 1] === id) { sp += P[i - 1]; sm += M[i - 1]; }
      if (x < W - 1 && blk[i + 1] === id) { sp += P[i + 1]; sm += M[i + 1]; }
      if (y > 0 && blk[i - W] === id) { sp += P[i - W]; sm += M[i - W]; }
      if (y < H - 1 && blk[i + W] === id) { sp += P[i + W]; sm += M[i + W]; }
      let dp = 0, dm = 0;
      if (band[i] === 3) {
        // the diagonal band is a checker of single blocks: its diagonal neighbours join in
        if (x > 0 && y > 0 && blk[i - W - 1] === id) { dp += P[i - W - 1]; dm += M[i - W - 1]; }
        if (x < W - 1 && y > 0 && blk[i - W + 1] === id) { dp += P[i - W + 1]; dm += M[i - W + 1]; }
        if (x > 0 && y < H - 1 && blk[i + W - 1] === id) { dp += P[i + W - 1]; dm += M[i + W - 1]; }
        if (x < W - 1 && y < H - 1 && blk[i + W + 1] === id) { dp += P[i + W + 1]; dm += M[i + W + 1]; }
      }
      P2[i] = P[i] + K * (sp + 0.6 * dp); M2[i] = M[i] + K * (sm + 0.6 * dm);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const b = band[i];
      let r = 0, g = 0, bl = 0;
      if (b === 0) {
        const v = 0.14 + 0.7 * cl(coef[i], 0, 1);
        hsv(hue + 0.6, 0.3, v, hv);
        r = hv[0]; g = hv[1]; bl = hv[2];
      } else {
        const p = P2[i], m = M2[i], tot = p + m;
        if (tot > 0.004) {
          const v = min(1, tot);
          const s = (p - m) / tot;
          hsv(HUE[b] + hue + (b === 3 ? 0.032 : 0.045) * s, 0.92 - 0.4 * v * v * v, v, hv);
          r = hv[0]; g = hv[1]; bl = hv[2];
        }
      }
      if (st.sep[i]) {
        // faint separator on the quadrant borders, lifted only where the block is dark
        r = max(r, SEP[0] / 255); g = max(g, SEP[1] / 255); bl = max(bl, SEP[2] / 255);
      }
      display.setPixel(x, y, floor(cl(r, 0, 1) * 255), floor(cl(g, 0, 1) * 255), floor(cl(bl, 0, 1) * 255));
    }
  }
}
