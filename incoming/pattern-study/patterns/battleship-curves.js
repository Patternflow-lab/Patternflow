// ===== Patternflow pattern =====
// Title:   Battleship Curves
// Family:  battleship
// Idea:    Down the page runs time, one row to a generation of potters, and in each of twelve lanes a pottery style swells out of a thread into a smooth lens, peaks, shrinks and ends, while the next new style opens in the lane to its right, so the spindles of ochre, slate and terracotta lean down the panel in a diagonal ladder that never repeats because the potters copy each other at random.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: frequency seriation and the battleship curve, the share of each pottery style layer by layer swelling and fading in a staircase (Phillips, Ford and Griffin, 1951, and Ford, 1962, from memory); neutral cultural transmission as random copying (Neiman, 1995, and Bentley, Hahn and Shennan, 2004, from memory); conformist and anti-conformist bias in copying (Boyd and Richerson, 1985, from memory); the fashion decay, the lane rule and the drawing are original, pattern round 249
// Round:   249
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tempo=0.5..8, Invention=-1..1, Conformity=-1..1
//
// Knob 1: Hue. Turns every style colour round the wheel together; at 0 the twelve are the earth tones of ochre, terracotta, slate, sage and plum on a dark warm ground.
// Knob 2: Tempo. 0.5 to 8 generations a second, opening at 2: how fast the layers are laid down at the foot of the panel and the picture drifts up, from a row every two seconds to eight a second.
// Knob 3: Invention. -1 to 1, opening at 0: how often a potter makes up a new style. At -1 a new thread opens about every half minute and a few broad spindles live a couple of minutes; at 1 one opens most seconds and the lanes fill with slimmer, shorter ones.
// Knob 4: Conformity. -1 to 1, opening near 0: how the potters copy. At -1 they favour the rare, shares stay even and many slim spindles live side by side; at 0 they copy at random; at 1 they follow the crowd and one fat spindle holds nearly all of the panel for half a minute before a newer one unseats it.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, log, pow, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = () => Math.random();
const TP = 2 * PI;

const NP = 90;             // potters in a generation
const C = 12;              // lanes
const LW = 5;              // LED a lane is wide
const X0 = 2;              // LED left of the first lane
const HWMAX = 2.2;         // half width of the fullest lens, leaving half an LED of dark between neighbours
const RING = 192;          // generations kept
const GEN0 = 200;          // where the count starts, so the oldest rows read empty zeros
const TFASH = 80;          // generations of fashion decay
const EPS = 0.03;          // a floor under every share so a new style is not struck out by conformity alone
const P0 = 0.2;            // share at which the lens is full
const COOL = 7;            // generations a lane rests dark before the next style may open in it
const PRIME = 320;
// thirteen-tap binomial blur over generations (sigma 1.7 rows), sums to 1
const KER = [1, 12, 66, 220, 495, 792, 924, 792, 495, 220, 66, 12, 1].map((v) => v / 4096);
const KH = 6;
const SLAG = KH + 1;       // the newest generation drawn is this far behind the newest simulated

// earth tones in the order they are handed out: neighbours in the order are far apart in hue
const PAL = [
  [201, 149, 58],   // ochre
  [95, 127, 154],   // slate blue
  [196, 87, 58],    // terracotta
  [127, 160, 122],  // sage
  [122, 74, 106],   // plum
  [212, 177, 60],   // mustard
  [62, 138, 122],   // teal green
  [184, 106, 120],  // dusty rose
  [138, 138, 58],   // olive
  [216, 207, 180],  // bone
  [168, 64, 42],    // rust
  [172, 112, 68],   // umber, lifted a little: 140,90,60 goes to mud on the panel
];
const BG = [14, 11, 10];

// ---- colour ------------------------------------------------------------------
function rgb2hsv(r, g, b, o) {
  r /= 255; g /= 255; b /= 255;
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  o[0] = h; o[1] = mx > 0 ? d / mx : 0; o[2] = mx;
}
function hsv2rgb(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// ---- state -------------------------------------------------------------------
export function setup(params) {
  const tw = (a, b) => a + (b - a) * rnd();
  const st = (params.st = {
    k: [0, 2, 0, 0.06], t: 0, frac: 0, primed: false,
    n: GEN0,                          // newest generation simulated
    cnt: new Int16Array(C),           // potters in each lane's style
    age: new Float32Array(C),         // generations since the style began
    sid: new Int32Array(C).fill(-1),  // style id in the lane
    freeAt: new Int32Array(C).fill(-999),
    lastCi: new Int16Array(C),        // palette index of the lane's latest style
    ptr: floor(tw(0, C)),             // lane of the latest style that proved itself
    nextId: 0,
    P: new Float32Array(RING * C),    // raw share, per generation and lane
    S: new Float32Array(RING * C),    // blurred share
    D: new Float32Array(RING * C),    // 1 while the style is well past its peak, blurred in S's way
    DR: new Float32Array(RING * C),
    peak: new Float32Array(C),
    CI: new Int16Array(RING * C),     // palette index drawn for the lane at that generation
    wgt: new Float32Array(C),
    pal: [], palKey: -1,
    pa: new Float32Array(C).map(() => tw(0, TP)),
    pb: new Float32Array(C).map(() => tw(0, TP)),
    wl: new Float32Array(C).map(() => tw(0.04, 0.11)),
    pool: [0, 1, 2, 3, 4, 5].map((k) => ({
      f: [tw(0.04, 0.1), tw(0.011, 0.03), tw(0.03, 0.08), tw(0.009, 0.025), tw(0.02, 0.06)],
      p: [tw(0, TP), tw(0, TP), tw(0, TP), tw(0, TP), tw(0, TP)],
      sx: tw(10, 20), sy: tw(20, 36), a0: tw(0.6, 1), a: 0, cx: 0, cy: 0, gy: 0, gx: new Float32Array(W),
    })),
    ofs: floor(tw(0, 12)),
  });
  for (let l = 0; l < C; l++) st.lastCi[l] = (l * 5 + st.ofs) % C;
  for (let i = 0; i < RING * C; i++) st.CI[i] = st.lastCi[i % C];
  // the first style: a whole population on one lane, which the priming wears away
  const l0 = st.ptr;
  st.cnt[l0] = NP; st.sid[l0] = st.nextId++; st.lastCi[l0] = ci(st, st.sid[l0]);
  return st;
}

const ci = (st, id) => (id + 7 * floor(id / C) + st.ofs) % C;
const gi = (g, l) => (((g % RING) + RING) % RING) * C + l;

// ---- the model: one generation of potters -------------------------------------
function rates(st) {
  const k3 = cl(st.k[2], -1, 1), k4 = cl(st.k[3], -1, 1);
  // inventions a generation, 0.015 to 0.35 on a log scale; 0.07 in the middle
  const lam = exp(log(0.015) + (log(0.35) - log(0.015)) * (k3 + 1) * 0.5);
  // exponent of the share: 0.55 at -1, 1 at 0, 1.4 at 1
  const b = k4 < 0 ? pow(0.55, -k4) : pow(1.4, k4);
  return { lam, b };
}

function stepGen(st, lam, b) {
  const { cnt, age, sid, freeAt, wgt } = st;
  const n = st.n + 1;
  // weights: share to the power b, spoiled by age
  const tf = (b > 1 ? b * b : 1) / TFASH;
  let tot = 0, live = 0;
  for (let l = 0; l < C; l++) {
    if (cnt[l] > 0) {
      live++;
      // a new style starts at a third of its pull and takes about ten generations to catch on, which gives the thread time
      wgt[l] = pow(cnt[l] / NP + EPS, b) * exp(-age[l] * tf) * (0.35 + 0.65 * (1 - exp(-age[l] / 10)));
      tot += wgt[l];
    } else wgt[l] = 0;
  }
  // inventions this generation; when almost nothing is alive one is made sure of
  let want = 0;
  // following the crowd starves a new style, so the potters try more often, and a new one comes with a few followers
  const lamE = live <= 2 ? max(lam, 0.4) : lam * (b > 1 ? 1 + 5 * (b - 1) : 1);
  const seed = b > 1 ? 1 + floor(3.3 * (b - 1)) : 1;
  for (let q = exp(-lamE), p = rnd(); p > q; p *= rnd()) want++;
  const nc = new Int16Array(C);
  let made = 0;
  const born = [];
  for (let i = 0; i < want; i++) {
    // the lane after the last proven style, else the next one resting long enough
    let lane = -1;
    for (let s = 1; s <= C; s++) {
      const l = (st.ptr + s) % C;
      if (cnt[l] === 0 && nc[l] === 0 && n - freeAt[l] >= COOL) { lane = l; break; }
    }
    if (lane < 0) break;
    nc[lane] = seed;
    born.push(lane);
    made += seed;
  }
  // everybody else copies
  for (let i = made; i < NP; i++) {
    let r = rnd() * tot, l = 0;
    for (; l < C - 1; l++) { if (wgt[l] > 0) { r -= wgt[l]; if (r <= 0) break; } }
    while (wgt[l] === 0) l = (l + C - 1) % C;
    nc[l]++;
  }
  // the last one or two followers of a style long past its peak give it up
  for (let l = 0; l < C; l++) {
    if (nc[l] > 0 && nc[l] <= 2 && st.peak[l] > 0.08 && age[l] > 12 && rnd() < 0.3) {
      const k = nc[l];
      nc[l] = 0;
      // they take up the most followed style instead
      let bl = -1, bv = -1;
      for (let j = 0; j < C; j++) if (j !== l && nc[j] > bv) { bv = nc[j]; bl = j; }
      if (bl >= 0 && bv > 0) nc[bl] += k; else nc[l] = k;
    }
  }
  for (let l = 0; l < C; l++) {
    const was = cnt[l] > 0;
    if (was) age[l] += 1;
    cnt[l] = nc[l];
    if (was && nc[l] === 0) { sid[l] = -1; freeAt[l] = n; }
  }
  for (const l of born) {
    sid[l] = st.nextId++;
    age[l] = 0;
    st.lastCi[l] = ci(st, sid[l]);
    st.peak[l] = 0;
    // the rows before the birth already wear the new colour, for the blur's fringe
    for (let d = 1; d <= KH; d++) st.CI[gi(n - d, l)] = st.lastCi[l];
  }
  // a style that has stood four generations makes its lane the one the ladder steps from
  for (let l = 0; l < C; l++) if (cnt[l] > 0 && age[l] === 4) st.ptr = l;
  // record the generation
  for (let l = 0; l < C; l++) {
    const pp = cnt[l] / NP;
    if (pp > st.peak[l]) st.peak[l] = pp;
    st.P[gi(n, l)] = pp;
    st.DR[gi(n, l)] = cnt[l] > 0 && pp < 0.55 * st.peak[l] ? 1 : 0;
    st.CI[gi(n, l)] = st.lastCi[l];
  }
  st.n = n;
  // the generation n - KH now has all its neighbours: blur it
  const g = n - KH;
  for (let l = 0; l < C; l++) {
    let s = 0, e = 0;
    for (let d = -KH; d <= KH; d++) { s += KER[d + KH] * st.P[gi(g + d, l)]; e += KER[d + KH] * st.DR[gi(g + d, l)]; }
    st.S[gi(g, l)] = s;
    st.D[gi(g, l)] = e;
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  const { lam, b } = rates(st);
  if (!st.primed) {
    st.primed = true;
    for (let i = 0; i < PRIME; i++) stepGen(st, lam, b);
  }
  st.t += dt;
  st.frac += dt * cl(st.k[1], 0.5, 8);
  while (st.frac >= 1) {
    st.frac -= 1;
    stepGen(st, lam, b);
  }
}

// ---- frame -------------------------------------------------------------------
export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.primed) update(0, null, params);
  const hue = cl(st.k[0], 0, 1);
  if (st.palKey !== hue) {
    st.palKey = hue;
    const h = [0, 0, 0], o = [0, 0, 0];
    st.pal = PAL.map((c) => {
      rgb2hsv(c[0], c[1], c[2], h);
      hsv2rgb(h[0] + hue, h[1], h[2], o);
      return [o[0], o[1], o[2]];
    });
  }
  const pal = st.pal;
  const f = st.frac, t = st.t;
  // soft pools of warm light wander over the panel on slow clocks of their own, lighting the lenses where they pass
  const NPOOL = st.pool.length;
  for (let k = 0; k < NPOOL; k++) {
    const q = st.pool[k];
    q.cx = 32 + 30 * sin(q.f[0] * t + q.p[0]) + 14 * sin(q.f[1] * t + q.p[1]);
    q.cy = 64 + 60 * sin(q.f[2] * t + q.p[2]) + 24 * sin(q.f[3] * t + q.p[3]);
    // each pool also swells and fades on its own clock
    q.a = q.a0 * (0.55 + 0.45 * sin(q.f[4] * t + q.p[4]));
    for (let x = 0; x < W; x++) q.gx[x] = exp(-((x - q.cx) * (x - q.cx)) / (2 * q.sx * q.sx));
  }
  const hw = new Float32Array(C), it = new Float32Array(C), cid = new Int16Array(C);
  const gNew = st.n - SLAG;
  for (let y = 0; y < H; y++) {
    const g0 = gNew - (H - 1 - y);
    for (let k = 0; k < NPOOL; k++) { const q = st.pool[k]; q.gy = exp(-((y - q.cy) * (y - q.cy)) / (2 * q.sy * q.sy)); }
    for (let l = 0; l < C; l++) {
      const i0 = gi(g0, l), i1 = gi(g0 + 1, l);
      const s0 = st.S[i0], s1 = st.S[i1];
      const pn = s0 + (s1 - s0) * f;
      cid[l] = s1 > s0 ? st.CI[i1] : st.CI[i0];
      // the lens is the share to a power; below 1.5 percent a soft thread takes over
      const dn = st.D[i0] + (st.D[i1] - st.D[i0]) * f;
      const lens = HWMAX * pow(cl(pn / P0, 0, 1), 0.8);
      const thread = 0.8 + 0.2 * sstep(0.003, 0.02, pn);
      // each lane swells and eases on a clock of its own, a little along its length too, so a slow scroll still moves
      const breath = 1 + 0.13 * sin(st.wl[l] * t + 0.045 * y + st.pa[l]) + 0.05 * sin(0.093 * t - 0.031 * y + st.pb[l]);
      hw[l] = max(lens * breath, thread);
      // a style on its way out lets go of the thread sooner than a new one builds it
      it[l] = sstep(0.008 + 0.01 * dn, 0.024 + 0.04 * dn, pn);
    }
    for (let x = 0; x < W; x++) {
      let lt = 0;
      for (let k = 0; k < NPOOL; k++) lt += st.pool[k].a * st.pool[k].gx[x] * st.pool[k].gy;
      if (lt > 1.3) lt = 1.3;
      let r = BG[0] + 4 * lt, g = BG[1] + 2 * lt, b = BG[2] + lt;
      const lx = x - X0;
      if (lx >= 0 && lx < C * LW) {
        const l = floor(lx / LW);
        const xc = X0 + l * LW + LW * 0.5;
        const d = abs(x + 0.5 - xc);
        const w = hw[l];
        const cov = cl(w - d + 0.5, 0, 1) * it[l];
        if (cov > 0.002) {
          const u = min(1, d / max(w, 0.6));
          const core = 1 - u * u;
          const v = (0.72 + 0.28 * core) * (0.55 + 0.6 * lt);
          const c = pal[cid[l]];
          const lift = 0.16 * core * core * core;
          const cr = c[0] * v + (255 - c[0]) * lift;
          const cg = c[1] * v + (255 - c[1]) * lift;
          const cb = c[2] * v + (255 - c[2]) * lift;
          r += (cr - r) * cov; g += (cg - g) * cov; b += (cb - b) * cov;
        }
      }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(g, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
}
