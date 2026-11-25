// ===== Patternflow pattern =====
// Title:   Run and Tumble
// Family:  chemotaxis
// Idea:    Three hundred swimming bacteria that run straight and tumble to a random new heading, each tumbling less while the attractant it senses is rising, so they leave long-exposure tails of lime and teal and climb a field of wandering sources that they eat as they go, gathering round a source, spreading from it in a band once it is gone, and finding the next one somewhere else.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the travelling band of cells that eat the attractant ahead of them and so make the gradient they follow (Adler 1966, from memory); the continuum equations that couple a cell density to the attractant it eats, which gather the cells into a clump or run them out as a wave (Keller and Segel 1970, from memory); the receptor that adapts, so that the cell answers the change in attractant and not its level (Macnab and Koshland 1972, from memory); the run and tumble walk, in which the cell tumbles less often when the attractant is rising (Berg and Brown 1972, from memory); the numbers and the picture are original, pattern round 242
// Round:   242
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sensitivity=0..4, Cells=-1..1, Sources=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel. It opens with the tails running from lime just after a tumble to teal on a long run, the tumble flash amber and the attractant a dark blue-violet that turns teal where it is strong.
// Knob 2: Sensitivity. 0 to 4, opening at 2: how hard a rising attractant holds back the tumble. At 0 the cells tumble at one rate whatever they sense and walk at random, spread over the panel and meeting no one source. At 2 they climb to each source and sit round it. At 4 a cell that is going up almost never tumbles and one going down tumbles at once, so they wind tight round the source and the field stays eaten out at its middle.
// Knob 3: Cells. -1 to 1, opening at 0: how many bacteria and how long their tails. 190 cells at the bottom, 300 at the opening and 480 at the top, and the tail runs the other way, about twice as long at the bottom as at the top, so a crowd of 480 still reads as separate lines.
// Knob 4: Sources. -1 to 1, opening near 0: how many places release the attractant at once, 1 at the bottom, 4 at the opening and 6 at the top. A source drifts, lives for half a minute to over a minute and goes, and the knob decides how many are alive: fewer sources feed one big crowd and more split it into a few.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, log, pow, cos, sin, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();

// ---- the field --------------------------------------------------------------
// The attractant lives on a 32 x 64 grid, one cell 2 x 2 LED, and wraps at the edges like the bacteria do.
const GW = 32, GH = 64, GN = GW * GH;
const STEP = 1 / 30;           // seconds a step of the world takes
const DIFF = 3.0;              // diffusion, grid cells squared a second
const DECAY = 0.03;            // the attractant breaks down at this rate a second
const EMIT = 9;                // what a source puts out a second
const UPTAKE = 0.55;           // what a cell eats a second when the attractant is thick
const KC = 0.25;               // the concentration at which a cell eats at half speed
const PRE = 66;                // seconds the world runs before the first frame

// ---- the cell ---------------------------------------------------------------
const NMAX = 490;
const TA = 1.0;                // seconds the receptor takes to adapt
const K0 = 0.006;              // the receptor does not hear attractant below this
const LAM0 = 0.62;             // tumbles a second with nothing to go by
const LAM_MIN = 0.05, LAM_MAX = 2.6;
const SPEED = 7.5;             // LED a second, a little different for each cell
const GAIN = 2.4;              // how many e-folds of tumble rate one unit of the knob is worth per unit of signal

// ---- the tails --------------------------------------------------------------
const TAIL0 = 0.7;             // seconds an e-fold of the tail takes at the opening
const NC = 40;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// The tail colour by seconds since the last tumble: lime at once, teal on a long run. The ground by concentration.
function buildColours(st, hue) {
  const c = [0, 0, 0];
  for (let i = 0; i < NC; i++) {
    const u = sstep(0, 1, min(1, i / (NC - 1) * 1.5));
    hsv(0.25 + 0.22 * u + hue, mix(0.8, 0.88, u), 1, c, 0);
    st.tail[i * 3] = c[0] / 255;
    st.tail[i * 3 + 1] = c[1] / 255;
    st.tail[i * 3 + 2] = c[2] / 255;
  }
  for (let i = 0; i < 128; i++) {
    const u = i / 127;
    const w = 1 - exp(-u * 2.2);
    hsv(mix(0.76, 0.49, pow2(w)) + hue, mix(0.92, 0.8, w), 0.06 + 0.44 * w, c, 0);
    st.bg[i * 3] = c[0];
    st.bg[i * 3 + 1] = c[1];
    st.bg[i * 3 + 2] = c[2];
  }
  hsv(0.115 + hue, 0.78, 1, c, 0);
  st.amber[0] = c[0] / 255;
  st.amber[1] = c[1] / 255;
  st.amber[2] = c[2] / 255;
  hsv(0.24 + hue, 0.3, 1, c, 0);
  st.head[0] = c[0] / 255;
  st.head[1] = c[1] / 255;
  st.head[2] = c[2] / 255;
}
const pow2 = (x) => x * x;

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const st = (params.st = {
    init: false, acc: 0, clock: 0, sim: 0, hue: -9,
    k: [0, 2, 0, 0.06],
    c: new Float32Array(GN), c2: new Float32Array(GN),
    n: 300, tauTail: TAIL0, dec: exp(-STEP / TAIL0), target: 3,
    cx: new Float32Array(NMAX), cy: new Float32Array(NMAX), th: new Float32Array(NMAX), sp: new Float32Array(NMAX),
    m: new Float32Array(NMAX), run: new Float32Array(NMAX), tt: new Float32Array(NMAX), turn: new Float32Array(NMAX),
    wob: new Float32Array(NMAX),
    src: [], spawnIn: 0,
    tr: new Float32Array(W * H), tg: new Float32Array(W * H), tb: new Float32Array(W * H), fl: new Float32Array(W * H),
    tail: new Float32Array(NC * 3), bg: new Float32Array(128 * 3), amber: [1, 0.6, 0.1], head: [1, 1, 1],
    // the grid index and weights for the ground, 64 columns and 128 rows from the 32 x 64 field
    gi0: new Int32Array(W), gi1: new Int32Array(W), gfx: new Float32Array(W),
    gj0: new Int32Array(H), gj1: new Int32Array(H), gfy: new Float32Array(H),
    wx: new Float32Array(4), wy: new Float32Array(4),
  });
  for (let x = 0; x < W; x++) {
    const g = (x + 0.5) / 2 - 0.5, i0 = floor(g);
    st.gi0[x] = (i0 + GW) % GW;
    st.gi1[x] = (i0 + 1 + GW) % GW;
    st.gfx[x] = g - i0;
  }
  for (let y = 0; y < H; y++) {
    const g = (y + 0.5) / 2 - 0.5, j0 = floor(g);
    st.gj0[y] = ((j0 + GH) % GH) * GW;
    st.gj1[y] = ((j0 + 1 + GH) % GH) * GW;
    st.gfy[y] = g - j0;
  }
}

function newCell(st, i) {
  st.cx[i] = rnd() * W;
  st.cy[i] = rnd() * H;
  st.th[i] = rnd() * TAU;
  st.sp[i] = SPEED * (0.8 + 0.4 * rnd());
  st.run[i] = rnd() * 3;
  st.tt[i] = 0;
  st.turn[i] = 0;
  st.wob[i] = 0.5 + rnd();
  st.m[i] = NaN;
}

// A new source goes where the other sources are not.
function newSource(st, age) {
  let bx = W / 2, by = H / 2, bd = -1;
  for (let t = 0; t < 12; t++) {
    const x = 10 + rnd() * (W - 20), y = 14 + rnd() * (H - 28);
    let d = 1e9;
    for (const s of st.src) d = min(d, (s.x - x) ** 2 + ((s.y - y) * 0.7) ** 2);
    if (d > bd) (bd = d), (bx = x), (by = y);
  }
  const life = 28 + 22 * rnd() + 22 * rnd();
  return { x: bx, y: by, hd: rnd() * TAU, v: 0.4 + 0.8 * rnd(), age, life, a: 0, e: EMIT * (0.8 + 0.4 * rnd()) };
}

function derive(st) {
  const kv = st.k;
  const cells = cl(kv[2], -1, 1);
  st.n = floor(300 * 1.6 ** cells + 0.5);
  st.tauTail = TAIL0 * (1 - 0.34 * cells);
  st.dec = exp(-STEP / st.tauTail);
  st.target = 1 + floor((cl(kv[3], -1, 1) + 1) * 2.5 + 0.5);
}

// ---- the world, one step ----------------------------------------------------
function stepWorld(st, draw) {
  const c = st.c, c2 = st.c2, dt = STEP;
  // sources: wander, live, go
  for (let k = st.src.length - 1; k >= 0; k--) {
    const s = st.src[k];
    s.age += dt;
    s.hd += (rnd() - 0.5) * 1.6 * sqrt(dt) * 3;
    // a source that nears the edge turns back toward the middle
    const ex = (s.x - W / 2) / (W / 2 - 9), ey = (s.y - H / 2) / (H / 2 - 13);
    if (abs(ex) > 0.8 || abs(ey) > 0.8) {
      const toward = Math.atan2(-ey * 0.5, -ex);
      let dd = toward - s.hd;
      dd -= TAU * floor((dd + PI) / TAU);
      s.hd += dd * 1.5 * dt;
    }
    s.x += cos(s.hd) * s.v * dt;
    s.y += sin(s.hd) * s.v * dt;
    s.a = sstep(0, 3, s.age) * (1 - sstep(s.life - 2.5, s.life, s.age));
    if (s.age >= s.life) st.src.splice(k, 1);
  }
  // keep as many as the knob says
  let alive = 0;
  for (const s of st.src) if (s.age < s.life - 2.5) alive++;
  if (alive > st.target) {
    let old = null;
    for (const s of st.src) if (s.age < s.life - 2.5 && (!old || s.age > old.age)) old = s;
    if (old) old.life = old.age + 2.5;
  } else if (alive < st.target) {
    st.spawnIn -= dt;
    if (st.spawnIn <= 0) {
      st.src.push(newSource(st, 0));
      st.spawnIn = 0.8 + 6 * rnd() * rnd();
    }
  }
  // emit
  for (const s of st.src) {
    if (s.a <= 0.001) continue;
    const gx = s.x / 2 - 0.5, gy = s.y / 2 - 0.5, i0 = floor(gx), j0 = floor(gy);
    let tot = 0;
    for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) tot += exp(-((i0 + i - gx) ** 2 + (j0 + j - gy) ** 2) / 2.4);
    const q = (s.e * s.a * dt) / tot;
    for (let j = -1; j <= 2; j++)
      for (let i = -1; i <= 2; i++) {
        const w = exp(-((i0 + i - gx) ** 2 + (j0 + j - gy) ** 2) / 2.4);
        c[((j0 + j + GH) % GH) * GW + ((i0 + i + GW) % GW)] += q * w;
      }
  }
  // the cells: sense, adapt, tumble or run, eat
  const n = st.n, gain = GAIN * cl(st.k[1], 0, 4);
  const ad = 1 - exp(-dt / TA);
  const cx = st.cx, cy = st.cy, th = st.th, sp = st.sp, m = st.m, run = st.run, tt = st.tt, turn = st.turn, wob = st.wob;
  const tr = st.tr, tg = st.tg, tb = st.tb, fl = st.fl;
  const tail = st.tail, wx = st.wx, wy = st.wy;
  for (let i = 0; i < n; i++) {
    let x = cx[i], y = cy[i];
    const gx = x * 0.5 - 0.5, gy = y * 0.5 - 0.5, i0 = floor(gx), j0 = floor(gy), fx = gx - i0, fy = gy - j0;
    const ia = (i0 + GW) % GW, ib = (i0 + 1 + GW) % GW, ja = ((j0 + GH) % GH) * GW, jb = ((j0 + 1 + GH) % GH) * GW;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const L = c[ja + ia] * w00 + c[ja + ib] * w10 + c[jb + ia] * w01 + c[jb + ib] * w11;
    const S = log(L + K0);
    if (m[i] !== m[i]) m[i] = S;
    m[i] += (S - m[i]) * ad;
    const r = S - m[i] + (rnd() - 0.5) * 0.12;
    const lam = cl(LAM0 * exp(-gain * r), LAM_MIN, LAM_MAX);
    // eat
    const u = (UPTAKE * dt * L) / (L + KC);
    if (u > 0) {
      c[ja + ia] = max(0, c[ja + ia] - u * w00);
      c[ja + ib] = max(0, c[ja + ib] - u * w10);
      c[jb + ia] = max(0, c[jb + ia] - u * w01);
      c[jb + ib] = max(0, c[jb + ib] - u * w11);
    }
    let moved = 0;
    if (tt[i] > 0) {
      tt[i] -= dt;
      if (draw) {
        // the flash of a tumble, a soft amber blob that stays while the cell turns
        splat(fl, x, y, 0.17, 1.15, wx, wy);
      }
      if (tt[i] <= 0) {
        th[i] = turn[i];
        run[i] = 0;
      }
    } else {
      run[i] += dt;
      th[i] += (rnd() - 0.5) * 0.5 * wob[i] * sqrt(dt) * 3;
      if (rnd() < lam * dt) {
        tt[i] = 0.12 + 0.14 * rnd();
        turn[i] = rnd() * TAU;
      } else {
        const v = sp[i];
        x += cos(th[i]) * v * dt;
        y += sin(th[i]) * v * dt;
        moved = v * dt;
      }
    }
    let wrapped = false;
    if (x < 0) (x += W), (wrapped = true);
    else if (x >= W) (x -= W), (wrapped = true);
    if (y < 0) (y += H), (wrapped = true);
    else if (y >= H) (y -= H), (wrapped = true);
    cx[i] = x;
    cy[i] = y;
    if (draw && moved > 0 && !wrapped) {
      const ci = floor(cl(run[i] / 3.4, 0, 1) * (NC - 1) + 0.5) * 3, a = 0.38 * moved;
      deposit(tr, tg, tb, x, y, a * tail[ci], a * tail[ci + 1], a * tail[ci + 2], wx, wy);
    }
  }
  // the field: diffuse and break down
  const dd = DIFF * dt, kd = 1 - DECAY * dt;
  for (let j = 0; j < GH; j++) {
    const ja = j * GW, ju = ((j + GH - 1) % GH) * GW, jd = ((j + 1) % GH) * GW;
    for (let i = 0; i < GW; i++) {
      const il = i === 0 ? GW - 1 : i - 1, ir = i === GW - 1 ? 0 : i + 1, v = c[ja + i];
      c2[ja + i] = (v + dd * (c[ja + il] + c[ja + ir] + c[ju + i] + c[jd + i] - 4 * v)) * kd;
    }
  }
  st.c = c2;
  st.c2 = c;
}

// A gaussian of sigma 0.8 LED, about 1.9 LED across at half height, added at (x, y) in a 4 x 4 window of LED centres.
function deposit(r, g, b, x, y, vr, vg, vb, wx, wy) {
  const ix = floor(x - 0.5) - 1, iy = floor(y - 0.5) - 1;
  for (let k = 0; k < 4; k++) {
    const dx = ix + k + 0.5 - x, dy = iy + k + 0.5 - y;
    wx[k] = exp(-(dx * dx) / 1.28);
    wy[k] = exp(-(dy * dy) / 1.28);
  }
  for (let j = 0; j < 4; j++) {
    const yy = iy + j;
    if (yy < 0 || yy >= H) continue;
    for (let i = 0; i < 4; i++) {
      const xx = ix + i;
      if (xx < 0 || xx >= W) continue;
      const w = wx[i] * wy[j], p = yy * W + xx;
      r[p] += vr * w;
      g[p] += vg * w;
      b[p] += vb * w;
    }
  }
}
function splat(f, x, y, amp, sig2, wx, wy) {
  const ix = floor(x - 0.5) - 1, iy = floor(y - 0.5) - 1, k2 = 2 * sig2;
  for (let k = 0; k < 4; k++) {
    const dx = ix + k + 0.5 - x, dy = iy + k + 0.5 - y;
    wx[k] = exp(-(dx * dx) / k2);
    wy[k] = exp(-(dy * dy) / k2);
  }
  for (let j = 0; j < 4; j++) {
    const yy = iy + j;
    if (yy < 0 || yy >= H) continue;
    for (let i = 0; i < 4; i++) {
      const xx = ix + i;
      if (xx < 0 || xx >= W) continue;
      f[yy * W + xx] += amp * wx[i] * wy[j];
    }
  }
}

function fade(st) {
  const d = st.dec, f = exp(-STEP / 0.22), tr = st.tr, tg = st.tg, tb = st.tb, fl = st.fl;
  for (let p = 0; p < W * H; p++) {
    tr[p] *= d;
    tg[p] *= d;
    tb[p] *= d;
    fl[p] *= f;
  }
}

function advance(st, steps) {
  for (let s = 0; s < steps; s++) {
    // the picture only keeps what the last few seconds drew
    const rec = st.sim > PRE - 8 || st.init;
    stepWorld(st, rec);
    if (rec) fade(st);
    st.sim += STEP;
  }
}

function resize(st) {
  // cells added or taken away by the knob
  const was = st.have | 0;
  for (let i = was; i < st.n; i++) newCell(st, i);
  st.have = st.n;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  derive(st);
  if (!st.init) {
    // a world that has been going a while: sources of every age, one already gone and its band spreading
    st.have = 0;
    resize(st);
    st.src = [];
    for (let i = 0; i < st.target; i++) {
      const s = newSource(st, 0);
      s.life = i === 0 ? PRE - 14 + 4 * rnd() : s.life;
      s.age = i === 0 ? 0 : rnd() * s.life * 0.9;
      st.src.push(s);
    }
    st.sim = 0;
    advance(st, floor(PRE / STEP));
    st.init = true;
  }
  resize(st);
  st.acc += cl(dt || 0, 0, 0.1);
  let steps = 0;
  while (st.acc >= STEP && steps < 4) {
    st.acc -= STEP;
    steps++;
  }
  if (steps) advance(st, steps);
  st.clock += cl(dt || 0, 0, 0.1);
}

// ---- drawing ----------------------------------------------------------------
export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = st.k[0];
  if (abs(hue - st.hue) > 1e-4) (st.hue = hue), buildColours(st, hue);
  const c = st.c, bg = st.bg, tr = st.tr, tg = st.tg, tb = st.tb, fl = st.fl;
  const am = st.amber, hd = st.head;
  // heads: a soft 2 x 2 spot on every swimming cell, drawn into the tails' sum for this frame only
  const hr = st.hr || (st.hr = new Float32Array(W * H)), hg = st.hg || (st.hg = new Float32Array(W * H)), hb = st.hb || (st.hb = new Float32Array(W * H));
  hr.fill(0);
  hg.fill(0);
  hb.fill(0);
  for (let i = 0; i < st.n; i++) {
    if (st.tt[i] > 0) continue;
    deposit(hr, hg, hb, st.cx[i], st.cy[i], 0.36 * hd[0], 0.36 * hd[1], 0.36 * hd[2], st.wx, st.wy);
  }
  for (let y = 0; y < H; y++) {
    const ja = st.gj0[y], jb = st.gj1[y], fy = st.gfy[y];
    for (let x = 0; x < W; x++) {
      const fx = st.gfx[x], ia = st.gi0[x], ib = st.gi1[x];
      const L = (c[ja + ia] * (1 - fx) + c[ja + ib] * fx) * (1 - fy) + (c[jb + ia] * (1 - fx) + c[jb + ib] * fx) * fy;
      const bi = floor(cl(L * 1.1, 0, 1) * 127 + 0.5) * 3;
      const p = y * W + x, f = fl[p] * 0.95;
      let r = tr[p] + hr[p] + am[0] * f, g = tg[p] + hg[p] + am[1] * f, b = tb[p] + hb[p] + am[2] * f;
      let mx = max(r, g, b);
      if (mx > 0.004) {
        // a gamma on the sum, so the faint end of a tail goes out sooner than it fades, then a soft knee at the top
        let o = pow(mx, 1.55);
        if (o > 0.5) o = 0.5 + 0.5 * (1 - exp(-(o - 0.5) / 0.9));
        const s = o / mx;
        r *= s;
        g *= s;
        b *= s;
      }
      display.setPixel(x, y, cl(bg[bi] + r * 255 + 0.5, 0, 255) | 0, cl(bg[bi + 1] + g * 255 + 0.5, 0, 255) | 0, cl(bg[bi + 2] + b * 255 + 0.5, 0, 255) | 0);
    }
  }
}
