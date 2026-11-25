// ===== Patternflow pattern =====
// Title:   Myxobacteria Ripples
// Family:  myxobacteria
// Idea:    A dark swarm of some six hundred soft capsule cells gliding along x, rose when they go right and cyan when they go left, that keep reversing and bump each other into reversing sooner, so dense bands of one heading run sideways across the panel a dozen LED apart, meet bands of the other heading and bounce back, the overlaps going white.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: rippling in Myxococcus xanthus, where gliding rod cells reverse on a clock and a contact signal between cells that meet head on makes them reverse sooner, and a refractory period after a reversal lets the waves persist (Igoshin, Mogilner, Welch, Kaiser and Oster 2001, "Pattern formation and traveling waves in myxobacteria: theory and modeling", from memory); the cell model, the numbers, the hash grid, the lane noise and the colours are original, pattern round 245
// Round:   245
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Period=0..4, Density=-1..1, Wander=-1..1
//
// Knob 1: Hue. Turns the two heading colours round the wheel together. At 0 right-movers are rose and left-movers cyan, and where they overlap the sum goes white.
// Knob 2: Period. 0 to 4, opening at 2. The mean time between a cell's reversals, 4 s at 0, 8.5 s at 2 and 17 s at 4. The ripples follow it: at 0 they are tight bands about 7 LED apart, at 2 about 13 and at 4 broad ones about 25.
// Knob 3: Density. -1 to 1, opening at 0. How many cells there are, 35 percent of the nominal 620 at -1 and 130 percent at 1. Low, cells meet too seldom to hold the waves and the bands melt into a uniform gliding shimmer. High, the bands are crisp and dense.
// Knob 4: Wander. -1 to 1, opening at 0.06. How much the cells turn from the x axis. At -1 they are perfectly aligned and the crests are straight vertical lines. At 1 the cells wander in angle and the crests bend, break and curl. At 0.06 the crests waver a little.

const W = 64, H = 128;
const { floor, min, max, abs, exp, sqrt, sin, cos, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;
const fr = (v) => v - floor(v);

const NMAX = 820;                 // cells in the pool
const NOM = 620;                  // cells at Density 0
const GX = 15, GY = 16;           // hash grid, cells 4.27 LED wide and 8 tall
const GW = W / GX, GH = H / GY;
const RX = 3, RY = 7;             // a cell hears the cells whose centres are inside this ellipse, tall so that rows keep step
const V0 = 3.0;                   // glide speed, LED a second
const REF = 0.25;                 // refractory share of a period
const GAM = 1.0;                  // clock rate gained per unit of contact, a second
const FREE = 0.25;                // share of cells that hear the contact signal only a little
const DEAF = 0.1;                // how much of it they hear
const T0 = 8.5;                   // mean reversal period at Period 2
const RPX = 4.5, RPY = 2.4;       // cells of one heading push each other apart in y inside this ellipse
const KRY = 3.0;                  // LED a second at full overlap
const SEG = 1.2, RAD = 1.3;       // capsule: half length of its core, radius of the full-bright part

function hsv(h, s, v, out) {
  h = fr(h) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const m = i % 6;
  out[0] = m === 0 || m === 5 ? v : m === 1 ? q : m === 4 ? t : p;
  out[1] = m === 1 || m === 2 ? v : m === 0 ? t : m === 3 ? q : p;
  out[2] = m === 3 || m === 4 ? v : m === 2 ? t : m === 5 ? q : p;
}

export function setup(params) {
  const f = (n) => new Float32Array(n);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0,
    x: f(NMAX), y: f(NMAX), th: f(NMAX), v: f(NMAX), phi: f(NMAX), rt: f(NMAX), tf: f(NMAX), s: f(NMAX), w: f(NMAX),
    cnt: f(NMAX), tsum: f(NMAX), nn: f(NMAX), gm: f(NMAX), pu: f(NMAX),
    head: new Int16Array(GX * GY), nxt: new Int16Array(NMAX),
    T: T0, nact: NOM, wd: 0.1,
    ph: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(() => rnd() * TAU),
    DR: f(W * H), DL: f(W * H),
    cr: [1, 0.2, 0.5], cb: [0.1, 0.8, 1],
  });
  for (let i = 0; i < NMAX; i++) {
    st.x[i] = rnd() * W;
    st.y[i] = rnd() * H;
    st.v[i] = cl(V0 + 0.4 * gauss(), 2, 4);
    st.phi[i] = rnd();
    st.tf[i] = 1 + 0.3 * (2 * rnd() - 1);
    st.s[i] = rnd() < 0.5 ? 1 : -1;
    st.gm[i] = rnd() < FREE ? DEAF : 1;
  }
  return st;
}

// ---- the swarm ----------------------------------------------------------------
// A smooth field along y that bends the crests: it speeds the reversal clocks of one stretch of rows and slows another's.
function lane(st, y) {
  const t = st.t, ph = st.ph;
  return (
    0.5 * sin(TAU * (y / 71 + t / 43) + ph[0]) +
    0.35 * sin(TAU * (y / 37 - t / 29) + ph[1]) +
    0.25 * sin(TAU * (y / 23 + t / 19) + ph[2])
  );
}

function sim(st, dt) {
  st.t += dt;
  const t = st.t, kv = st.k, ph = st.ph;
  const a = 1 - exp(-dt / 0.6);
  // smoothed knobs, so a turn reaches the swarm within seconds without a jolt
  const tp = T0 * pow(2, (cl(kv[1], 0, 4) - 2) / 2);
  st.T += (tp - st.T) * a;
  const d = cl(kv[2], -1, 1), nt = NOM * (d < 0 ? 1 + 0.65 * d : 1 + 0.3 * d);
  st.nact += (nt - st.nact) * a;
  const u = (cl(kv[3], -1, 1) + 1) / 2;
  st.wd += (u - st.wd) * a;
  const sig = 0.62 * pow(st.wd, 3);                 // stationary spread of the angle, rad
  const lc = 0.01 + 0.3 * st.wd * st.wd * st.wd;                     // how hard the lane field leans on the clocks
  const TA = 1.2, TB = 0.2;                          // relaxation toward the local mean and toward the x axis, 1/s
  const sg = sig * sqrt(2 * (TA * 0.55 + TB));
  const Tt = st.T * (1 + 0.07 * sin(TAU * t / 97 + ph[3]) + 0.05 * sin(TAU * t / 61 + ph[4]) + 0.03 * sin(TAU * t / 149 + ph[5]));

  const { x, y, th, v, phi, rt, tf, s, w, cnt, tsum, nn, gm, pu, head, nxt } = st;
  const n = NMAX, na = st.nact;
  head.fill(-1);
  for (let i = 0; i < n; i++) {
    w[i] = cl(na - i, 0, 1);
    cnt[i] = 0;
    tsum[i] = 0;
    nn[i] = 0;
    if (w[i] < 0.5) continue;
    const g = floor(x[i] / GW) + GX * floor(y[i] / GH);
    nxt[i] = head[g];
    head[g] = i;
  }
  for (let i = 0; i < n; i++) {
    if (w[i] < 0.5) continue;
    const xi = x[i], yi = y[i], si = s[i];
    const gx = floor(xi / GW), gy = floor(yi / GH);
    let c = 0, ts = 0, k = 0, pp = 0;
    for (let oy = -1; oy <= 1; oy++) {
      const yy = (gy + oy + GY) % GY;
      for (let ox = -1; ox <= 1; ox++) {
        const xx = (gx + ox + GX) % GX;
        for (let j = head[xx + GX * yy]; j >= 0; j = nxt[j]) {
          if (j === i) continue;
          let dx = x[j] - xi, dy = y[j] - yi;
          if (dx > 32) dx -= W; else if (dx < -32) dx += W;
          if (dy > 64) dy -= H; else if (dy < -64) dy += H;
          if (s[j] === si) {
            const qr = (dx * dx) / (RPX * RPX) + (dy * dy) / (RPY * RPY);
            if (qr < 1) pp -= (1 - qr) * (dy > 0.2 ? 1 : dy < -0.2 ? -1 : i < j ? 1 : -1);
          }
          const q = (dx * dx) / (RX * RX) + (dy * dy) / (RY * RY);
          if (q >= 1) continue;
          ts += th[j];
          k++;
          if (s[j] !== si) c += 1 - q;
        }
      }
    }
    cnt[i] = c;
    tsum[i] = ts;
    nn[i] = k;
    pu[i] = pp;
  }
  const sq = sqrt(dt);
  for (let i = 0; i < n; i++) {
    if (w[i] < 0.5) continue;
    // clock
    if (rt[i] > 0) {
      rt[i] -= dt;
    } else {
      const ln = 1 + lc * lane(st, y[i]);
      phi[i] += (dt / (Tt * tf[i])) * ln + GAM * gm[i] * cnt[i] * dt;
      if (phi[i] >= 1) {
        s[i] = -s[i];
        phi[i] = 0;
        rt[i] = REF * Tt * tf[i];
        tf[i] = 1 + 0.3 * (2 * rnd() - 1);
      }
    }
    // angle
    const m = (tsum[i] + th[i]) / (nn[i] + 1);
    th[i] += (-(th[i] - m) * TA - th[i] * TB) * dt + sg * sq * gauss();
    th[i] = cl(th[i], -1.1, 1.1);
    // glide
    const sp = v[i] * s[i] * dt;
    let nx = x[i] + sp * cos(th[i]), ny = y[i] + sp * sin(th[i]) + KRY * pu[i] * dt;
    nx -= W * floor(nx / W);
    ny -= H * floor(ny / H);
    x[i] = nx;
    y[i] = ny;
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.init = true;
    st.T = T0 * pow(2, (cl(st.k[1], 0, 4) - 2) / 2);
    const d = cl(st.k[2], -1, 1);
    st.nact = NOM * (d < 0 ? 1 + 0.65 * d : 1 + 0.3 * d);
    st.wd = (cl(st.k[3], -1, 1) + 1) / 2;
    for (let i = 0; i < 1350; i++) sim(st, 1 / 30);
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  if (dt > 0) sim(st, dt);
}

// ---- the picture --------------------------------------------------------------
export function draw(display, params) {
  let st = params.st;
  if (!st) st = setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const t = st.t, ph = st.ph;
  const h0 = st.k[0] + 0.02 * sin(TAU * t / 83 + ph[6]) + 0.015 * sin(TAU * t / 137 + ph[7]);
  hsv(h0 + 0.94, 0.85, 1, st.cr);
  hsv(h0 + 0.53, 0.8, 1, st.cb);
  const { DR, DL, x, y, th, s, w } = st;
  DR.fill(0);
  DL.fill(0);
  const R2 = 2.2;
  for (let i = 0; i < NMAX; i++) {
    if (w[i] <= 0) continue;
    const cx = x[i], cy = y[i], c = cos(th[i]), sn = sin(th[i]);
    const D = s[i] > 0 ? DR : DL, wi = 0.85 * w[i];
    const ex = (SEG + R2) * abs(c) + R2 * abs(sn), ey = (SEG + R2) * abs(sn) + R2 * abs(c);
    const x0 = floor(cx - ex), x1 = floor(cx + ex), y0 = floor(cy - ey), y1 = floor(cy + ey);
    for (let py = y0; py <= y1; py++) {
      const dy = py + 0.5 - cy, yw = ((py % H) + H) % H;
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - cx;
        let al = dx * c + dy * sn;
        al = al < -SEG ? -SEG : al > SEG ? SEG : al;
        const ex2 = dx - al * c, ey2 = dy - al * sn, d = sqrt(ex2 * ex2 + ey2 * ey2);
        if (d >= R2) continue;
        D[yw * W + (((px % W) + W) % W)] += wi * (1 - sstep(0.3, R2, d));
      }
    }
  }
  const cr = st.cr, cb = st.cb, K = 0.9;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px, r = DR[i], l = DL[i];
      const R = 1 - exp(-K * (r * cr[0] + l * cb[0]));
      const G = 1 - exp(-K * (r * cr[1] + l * cb[1]));
      const B = 1 - exp(-K * (r * cr[2] + l * cb[2]));
      display.setPixel(px, py, (R * 255 + 0.5) | 0, (G * 255 + 0.5) | 0, (B * 255 + 0.5) | 0);
    }
  }
}
