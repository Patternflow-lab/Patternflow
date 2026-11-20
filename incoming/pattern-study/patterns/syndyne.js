// ===== Patternflow pattern =====
// Title:   Syndyne
// Family:  comet
// Idea:    A comet with the camera riding on its nucleus: thousands of dust grains leave it and are pushed by sunlight into a curved fan that bends back along the orbit, a narrow blue ion tail points straight away from the sun with kinks running down it and now and then breaks off, and the view slowly wanders.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: syndynes and synchrones of comet dust tails, after Bessel (1836) and Bredikhin (1877), made quantitative by Finson and Probstein (1968); ion tail disconnection events after Niedner and Brandt (1978)
// Round:   201
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Activity=0..3, Sun=-1..1, Spread=-1..1
//
// Knob 1: Hue. The colour of the dust and the coma round the wheel, from cream gold dust and a green coma where the knob opens; away from there the dust takes on more colour. The ion tail stays electric blue and leans away when the dust comes near blue.
// Knob 2: Activity. How much dust the nucleus gives off and how often it bursts: at 0 a faint dust tail and no outbursts, where it opens an outburst every ten seconds or so, at 3 a bright fan crossed by many striae.
// Knob 3: Sun. Distance from the sun, 1.6 units at the bottom, 1 where it opens, 0.6 at the top. Nearer the sun the grains are pushed harder, so the tails grow longer, brighter and more curved and the coma swells.
// Knob 4: Spread. The range of grain sizes: at the bottom nearly one size, a thin sharp curved dust tail; where it opens beta spans a factor of four; at the top a factor of twenty and the tail opens into a wide fan.

const W = 64;
const H = 128;
const N = W * H;
const TAU = Math.PI * 2;
// LEDs per unit of distance from the sun, and the sun's pull: together they set how fast grains drift down and how far the fan bends.
const S = 500;
const GM = 0.002;
// Grains: how many at once, longest life and fade in seconds, and how far out one is dropped.
const POOL = 24000;
const MAX_AGE = 90;
const FADE = 50;
const KILL = 175 / S;
// Ion tail parcels, and their speed and acceleration down the tail in LEDs a second.
const ION = 3000;
const U0 = 10;
const UA = 16;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(x) {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
}

function hsv(h, s, v, out) {
  h -= Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

export function setup(params) {
  params.t = 140;
  params.seed = Math.floor(Math.random() * 4294967296) >>> 0;
  for (const n of ["gx", "gy", "vx", "vy"]) params[n] = new Float64Array(POOL);
  for (const n of ["beta", "age", "wt"]) params[n] = new Float32Array(POOL);
  params.live = new Uint8Array(POOL);
  params.free = new Int32Array(POOL);
  for (let i = 0; i < POOL; i++) params.free[i] = POOL - 1 - i;
  params.nfree = POOL;
  // Ion parcels, a ring: distance down the tail, speed, angle off the axis, sideways offset and its speed, brightness.
  for (const n of ["is", "iu", "ia", "il", "ilv", "ib"]) params[n] = new Float32Array(ION);
  params.ihead = 0;
  params.iacc = [0, 0, 0, 0];
  params.rays = [0, 1, 2].map((r) => ({ off: 0, age: 4 * r, life: 1, b: 0 }));
  params.gust = params.gustT = params.gustNext = params.knot = params.kinkNext = 0;
  params.kinks = [];
  params.deNext = params.t + 30 + 50 * rnd(params);
  params.deGap = params.burst = params.burstRate = params.flash = 0;
  // One star in each cell of a two by five grid, so no three line up.
  params.stars = [];
  for (let i = 0; i < 10; i++)
    params.stars.push({ x: (i % 2) * 32 + 4 + 24 * Math.random(), y: Math.floor(i / 2) * 25.6 + 3 + 19 * Math.random(), b: 0.22 + 0.14 * Math.random(), warm: Math.random(), tw: TAU * Math.random() });
  for (const n of ["acc", "spl", "tmp", "blr", "glo", "ion", "sps", "acs", "bls"]) params[n] = new Float32Array(N);
  params.star = new Float32Array(N * 2);
  params.ou = [0, 0, 0, 0, 0, 0];
  params.ous = [0, 0, 0, 0, 0, 0];
  Object.assign(params, { hb: 1, fresh: true, theta: 0, Rk: 1, R: 1, psi: 0, psiW: 0, side: 0, drop: 0, zoom: 1, slow: 0, wind: 0, lagA: 0.6, tilt: 1, xn: 36, yn: 20, lum: 1, act: 1 });
  for (const n of ["cdust", "cdim", "ccoma", "cion", "csmall"]) params[n] = new Float32Array(3);
}

// Geometry, outbursts and solar wind draw from their own generator, so their course is the same whatever the knobs do to the grain count.
function rnd(params) {
  let a = (params.seed = (params.seed + 0x6d2b79f5) >>> 0);
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

function gauss(params) {
  const u = Math.max(1e-9, rnd(params));
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd(params));
}

// The view wanders on sines whose periods never line up, plus six smoothed random walks: the swing of the anti-sun line, where the nucleus sits across and down, how open the orbit plane is, the grain size given off, and how near the comet is to us.
function geometry(params, dt) {
  const t = params.t;
  const f = (p, ph) => Math.sin((TAU * t) / p + ph);
  const ou = params.ou;
  const sm = params.ous;
  // The walks stand still while the comet is run ahead, so the opening view is always the same.
  if (!params.ahead)
    for (let j = 0; j < 6; j++) {
      ou[j] += -ou[j] * (dt / 40) + Math.sqrt((2 * dt) / 40) * gauss(params);
      sm[j] += (ou[j] - sm[j]) * (1 - Math.exp(-dt / 6));
    }
  params.R = params.Rk * Math.exp(0.15 * f(97, 0.4) + 0.09 * f(151, 2.0) + 0.05 * f(61, 1.0));
  params.psiW = 0.04 + 0.1 * f(113, 1.1) + 0.08 * f(47, 0.3) + 0.15 * sm[0];
  // Now and then we cross the orbit plane: the fan closes to a spike on the ion tail and opens on the other side, in about ten seconds.
  const x = 0.5 * f(277, 2.84) + 0.08 * f(79, 0.7) + 0.35 * sm[3];
  params.tilt = (0.82 * x) / Math.sqrt(x * x + 0.05);
  params.drop = 4 * f(61, 0.5) + 3 * f(131, 2.2) + 6 * sm[1];
  params.side = 4 * f(53, 1.3) + 3 * f(103, 0.1) + 8 * sm[2];
  params.zoom = Math.exp(0.12 * f(71, 0.4) + 0.1 * f(149, 2.44) + 0.14 * sm[5]);
}

function emit(params, beta, vej, wt, dt) {
  if (params.nfree === 0) return;
  const i = params.free[--params.nfree];
  params.live[i] = 1;
  // Thrown off the sunlit side in a wide cone, at a random moment inside the step, so a long step leaves no clumps.
  const a = params.theta + Math.PI + (Math.random() - 0.5) * 2.4;
  const v = vej * (0.4 + 0.6 * Math.random());
  const tau = dt * Math.random();
  const push = (beta * GM) / (params.R * params.R);
  const ex = Math.cos(params.theta);
  const ey = Math.sin(params.theta);
  params.vx[i] = v * Math.cos(a) + push * ex * tau;
  params.vy[i] = v * Math.sin(a) + push * ey * tau;
  params.gx[i] = v * Math.cos(a) * tau + 0.5 * push * ex * tau * tau;
  params.gy[i] = v * Math.sin(a) * tau + 0.5 * push * ey * tau * tau;
  params.beta[i] = beta;
  params.age[i] = tau;
  params.wt[i] = wt;
}

function step(params, dt, k) {
  params.t += dt;
  geometry(params, dt);
  const R = params.R;
  params.theta += (dt * Math.sqrt(GM * params.Rk)) / (R * R);
  const th = params.theta;
  const cx = R * Math.cos(th);
  const cy = R * Math.sin(th);
  const gc = GM / (R * R * R);
  const { gx, gy, vx, vy, beta, age, live, free } = params;
  // Each grain feels the sun's pull times (1 - beta), measured from the nucleus, which falls freely.
  for (let i = 0; i < POOL; i++) {
    if (!live[i]) continue;
    const px = cx + gx[i];
    const py = cy + gy[i];
    const r2 = px * px + py * py;
    const f = (GM * (1 - beta[i])) / (r2 * Math.sqrt(r2));
    vx[i] += (-f * px + gc * cx) * dt;
    vy[i] += (-f * py + gc * cy) * dt;
    gx[i] += vx[i] * dt;
    gy[i] += vy[i] * dt;
    age[i] += dt;
    if (age[i] > MAX_AGE || gx[i] * gx[i] + gy[i] * gy[i] > KILL * KILL) {
      live[i] = 0;
      free[params.nfree++] = i;
    }
  }
  // New grains, beta spread log-evenly round its middle. The count stays steady so the fan stays smooth; the light a grain carries follows the production.
  const h = (params.hb = 0.68 * Math.exp(0.8 * k[3]));
  const vej = 0.00025 * (1 + 0.8 * (k[3] + 1));
  const lb = Math.log(0.3) + 0.4 * params.ous[4];
  const out = params.burst > 0;
  let n = (320 / Math.sqrt(R)) * dt;
  if (out) {
    n += params.burstRate * dt;
    params.burst -= dt;
  }
  // Production flickers over seconds and wanders slowly, so bands of grains of one age, synchrones, lie across the fan.
  const t = params.t;
  params.slow += -params.slow * (dt / 25) + Math.sqrt((2 * dt) / 25) * gauss(params);
  params.wind += -params.wind * (dt / 15) + Math.sqrt((2 * dt) / 15) * gauss(params);
  const prod = Math.exp(params.slow) * Math.max(0.15, 1 + 0.4 * Math.sin(0.83 * t + 0.5) + 0.3 * Math.sin(0.53 * t + 2.1) + 0.25 * Math.sin(1.37 * t + 4.0));
  let m = Math.floor(n + Math.random());
  while (m-- > 0) {
    const b = Math.exp(lb + h * (2 * Math.random() - 1));
    emit(params, b, vej * Math.sqrt(b / 0.3) * (out ? 1.4 : 1), Math.pow(b / 0.3, -0.3) * (0.6 + 0.8 * Math.random()) * (out ? 3.2 : prod), dt);
  }
  // Outbursts come at random, more often the more active the comet and the nearer the sun. While the comet is run ahead there is one, a minute before the opening.
  const rate = Math.pow(k[1] / 2, 1.5) / 10 / R;
  const r1 = rnd(params);
  const r2 = rnd(params);
  const go = params.ahead ? k[1] > 0.4 && params.t > params.burstAt && params.t - dt <= params.burstAt : r1 < rate * dt;
  if (params.burst <= 0 && go) {
    params.burst = 0.4;
    params.burstRate = ((600 + 600 * r2) * clamp(k[1] / 2, 0.3, 1.5)) / 0.4;
    params.flash = 1;
  }
  params.flash *= Math.exp(-dt / 2.5);
  ionStep(params, dt);
}

function ionStep(params, dt) {
  const t = params.t;
  const { is, iu, ia, il, ilv, ib } = params;
  for (let i = 0; i < ION; i++) {
    if (ib[i] <= 0) continue;
    is[i] += iu[i] * dt;
    iu[i] += UA * dt;
    il[i] += ilv[i] * dt;
    if (is[i] > 200) ib[i] = 0;
  }
  // Slow gusts in the solar wind swing the tail at the nucleus, and the swing runs down it.
  if (t > params.gustNext) {
    params.gustT = (rnd(params) - 0.5) * 0.16;
    params.gustNext = t + 3 + 5 * rnd(params);
  }
  params.gust += (params.gustT - params.gust) * (1 - Math.exp(-dt / 1.2));
  // Kinks: a sideways bend starts at the nucleus and runs out with the plasma, growing as it goes.
  const kinks = params.kinks;
  for (let j = kinks.length - 1; j >= 0; j--) {
    const q = kinks[j];
    q.age += dt;
    q.s = U0 * q.age + 0.5 * UA * q.age * q.age;
    if (q.s > 220) kinks.splice(j, 1);
  }
  if (t > params.kinkNext) {
    kinks.push({ age: 0, s: 0, amp: (rnd(params) < 0.5 ? -1 : 1) * (1 + 1.2 * rnd(params)) });
    params.kinkNext = t + 1.2 + 3.5 * rnd(params);
  }
  const r3 = rnd(params);
  const r4 = rnd(params);
  if (r3 < dt / 2.5) params.knot = 0.3 + 0.3 * r4;
  params.knot *= Math.exp(-dt / 0.5);
  const wind = 0.03 * Math.sin(0.71 * t + 0.3) + 0.02 * Math.sin(1.93 * t + 1.1) + params.gust;
  // A disconnection: the tail is cut at the nucleus and the piece already out drifts off sideways.
  if (t > params.deNext) {
    params.deNext = t + 40 + 60 * rnd(params);
    params.deGap = 1.3;
    const drift = (rnd(params) < 0.5 ? -1 : 1) * (2.5 + 2 * rnd(params));
    for (let i = 0; i < ION; i++) if (ib[i] > 0) ilv[i] = drift * (0.6 + is[i] / 100);
  }
  let cut = 1;
  if (params.deGap > 0) {
    params.deGap -= dt;
    cut = 0;
  }
  // The tail leans a little back along the orbit (aberration); fainter rays fold in towards it and fade as they do.
  const ab = -0.06;
  const streams = [[0, ab + wind, cut * (1 + params.knot)]];
  params.rays.forEach((ray, r) => {
    ray.age += dt;
    if (ray.age > ray.life) {
      ray.age = 0;
      ray.life = 6 + 6 * rnd(params);
      ray.off = (rnd(params) < 0.5 ? -1 : 1) * (0.16 + 0.14 * rnd(params));
      ray.b = 0.4 + 0.3 * rnd(params);
    }
    const off = ray.off * Math.exp(-ray.age / 4);
    streams.push([r + 1, ab + 0.6 * wind + off, cut * ray.b * Math.sin(Math.PI * Math.min(1, ray.age / ray.life)) * Math.exp(-ray.age / 6)]);
  });
  for (const [id, ang, b] of streams) {
    const rate = id === 0 ? 60 : 30;
    params.iacc[id] += dt * rate;
    while (params.iacc[id] >= 1) {
      params.iacc[id] -= 1;
      const i = params.ihead;
      params.ihead = (i + 1) % ION;
      // Born part way through the step, so the parcels string out evenly.
      const tau = params.iacc[id] / rate;
      is[i] = U0 * tau + 0.5 * UA * tau * tau;
      iu[i] = U0 + UA * tau;
      ia[i] = ang;
      il[i] = ilv[i] = 0;
      ib[i] = Math.max(0.001, b);
    }
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const Rk = Math.pow(2, -0.7 * clamp(k[2], -1, 1));
  if (params.ahead === undefined) {
    params.Rk = Rk;
    // Run the comet for a while first, so the tails are already out.
    params.ahead = true;
    params.burstAt = params.t + 40;
    for (let i = 0; i < 1000; i++) step(params, 0.1, k);
    params.ahead = false;
  }
  params.Rk += (Rk - params.Rk) * (1 - Math.exp(-dt / 1.5));
  step(params, Math.min(dt, 0.1), k);
  const R = params.R;
  params.act = 0.08 + 0.46 * clamp(k[1], 0, 3);
  params.lum = (params.act / (R * R)) * Math.sqrt(R);
  params.ionGain = Math.pow(1 / R, 1.5) * Math.exp(0.3 * params.wind);
  const hue = 0.115 + k[0];
  // Away from the opening the dust takes on more colour, or the hues would hardly differ.
  const far = 0.5 - 0.5 * Math.cos(TAU * k[0]);
  hsv(hue - 0.01, 0.36 + 0.5 * far, 1, params.cdust);
  hsv(hue + 0.03, 0.08 + 0.62 * far, 1, params.cdim);
  hsv(hue + 0.03, 0.17 + 0.5 * far, 1, params.csmall);
  hsv(hue + 0.31, 0.6 + 0.25 * far, 1, params.ccoma);
  const d = hue - 0.6 - Math.round(hue - 0.6);
  hsv(0.6 - Math.sign(d) * 0.14 * Math.exp(-(d * d) / 0.012), 0.72, 1, params.cion);
  // Stars drift slowly as the camera follows the comet.
  const sa = 2.3 + 0.5 * Math.sin(params.t / 91);
  for (const s of params.stars) {
    s.x += 0.2 * Math.cos(sa) * dt;
    s.y += 0.2 * Math.sin(sa) * dt;
    if (s.x < -2) s.x += 68;
    if (s.x > 66) s.x -= 68;
    if (s.y < -2) s.y += 132;
    if (s.y > 130) s.y -= 132;
  }
  // The nucleus sits lower when the tails are short or the comet is far from us, and is eased off the top edge.
  let yt = 20 + 9 * clamp((R - 1) / 0.6, -0.6, 1) + 30 * (1 - params.zoom) + params.drop;
  if (yt < 14) yt = 14 - 6 * Math.tanh((14 - yt) / 6);
  params.yn += (yt - params.yn) * (1 - Math.exp(-dt / 4));
}

// Separable Gaussian blur of 1.2 LEDs.
const KB = [0.333, 0.236, 0.083, 0.015];
function blur(src, dst, tmp) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = KB[0] * src[y * W + x];
      for (let j = 1; j < 4; j++) {
        if (x >= j) s += KB[j] * src[y * W + x - j];
        if (x < W - j) s += KB[j] * src[y * W + x + j];
      }
      tmp[y * W + x] = s;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let s = KB[0] * tmp[i];
      for (let j = 1; j < 4; j++) {
        if (y >= j) s += KB[j] * tmp[i - j * W];
        if (y < H - j) s += KB[j] * tmp[i + j * W];
      }
      dst[i] = s;
    }
}

function box(src, dst, tmp, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let s = 0;
    for (let x = 0; x <= r; x++) s += src[o + x];
    for (let x = 0; x < W; x++) {
      tmp[o + x] = s / n;
      if (x + r + 1 < W) s += src[o + x + r + 1];
      if (x - r >= 0) s -= src[o + x - r];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = 0; y <= r; y++) s += tmp[y * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = s / n;
      if (y + r + 1 < H) s += tmp[(y + r + 1) * W + x];
      if (y - r >= 0) s -= tmp[(y - r) * W + x];
    }
  }
}

// Project the grains onto the panel, and turn the view and move the nucleus to suit.
function project(params) {
  const { gx, gy, wt, age, beta, live, spl, sps } = params;
  const lb = Math.log(0.3);
  const hb = Math.max(0.4, params.hb);
  const ct = Math.cos(params.theta);
  const st = Math.sin(params.theta);
  const psi = params.psi;
  const Dx = Math.sin(psi);
  const Dy = Math.cos(psi);
  const Px = Math.cos(psi);
  const Py = -Math.sin(psi);
  const tilt = params.tilt;
  // How near the comet is to us: the whole picture is drawn larger or smaller.
  const zoom = params.zoom;
  const sz = S * zoom;
  const xn = params.xn;
  const yn = params.yn;
  spl.fill(0);
  sps.fill(0);
  let latS = 0;
  let latN = 0;
  let mu = 0;
  let mw = 0;
  // A second buffer carries grain size, so the colour can tell big grains from small.
  const put = (i, a, fw, fs) => {
    spl[i] += fw * a;
    sps[i] += fs * a;
  };
  for (let i = 0; i < POOL; i++) {
    if (!live[i]) continue;
    const u = (gx[i] * ct + gy[i] * st) * sz;
    const w = (-gx[i] * st + gy[i] * ct) * sz * tilt;
    const ox = u * Dx + w * Px;
    const oy = u * Dy + w * Py;
    const fw = wt[i] * Math.exp(-age[i] / FADE) * smooth((MAX_AGE - age[i]) / 20);
    const r2 = u * u + w * w;
    if (r2 > 625 && r2 < 10000) {
      latS += ox * fw;
      latN += fw;
      mu += u * fw;
      mw += w * fw;
    }
    const x = xn + ox - 0.5;
    const y = yn + oy - 0.5;
    if (x < -1 || x >= W || y < -1 || y >= H) continue;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const fs = fw * clamp((Math.log(beta[i]) - lb) / hb, -1, 1);
    if (x0 >= 0 && y0 >= 0) put(y0 * W + x0, (1 - fx) * (1 - fy), fw, fs);
    if (x0 + 1 < W && y0 >= 0) put(y0 * W + x0 + 1, fx * (1 - fy), fw, fs);
    if (x0 >= 0 && y0 + 1 < H) put((y0 + 1) * W + x0, (1 - fx) * fy, fw, fs);
    if (x0 + 1 < W && y0 + 1 < H) put((y0 + 1) * W + x0 + 1, fx * fy, fw, fs);
  }
  // The view turns so the ion tail and the middle of the dust fan lean either side of straight down, and the nucleus moves against the way they lean.
  const lat = latN > 0 ? latS / latN : 0;
  const lag = latN > 0 ? Math.atan2(-mw, mu) : 0.6;
  if (params.fresh) params.lagA = lag;
  else params.lagA += (lag - params.lagA) * 0.01;
  params.psi = clamp(params.psiW + 0.5 * params.lagA, -0.5, 0.5);
  const xt = clamp(32 - 0.55 * (0.4 * lat + 0.6 * 90 * Dx) + params.side, 12, 52);
  if (params.fresh) params.xn = xt;
  else params.xn += (xt - params.xn) * 0.004;
}

export function draw(display, params) {
  // On the first frame the view is not yet turned, so the grains are projected twice.
  project(params);
  if (params.fresh) project(params);
  const { acc, spl, sps, acs, tmp, blr, bls, glo, ion, star } = params;
  const psi = params.psi;
  const Dx = Math.sin(psi);
  const Dy = Math.cos(psi);
  const Px = Math.cos(psi);
  const Py = -Math.sin(psi);
  const tilt = params.tilt;
  const zoom = params.zoom;
  const xn = params.xn;
  const yn = params.yn;
  const a = params.fresh ? 0 : 0.75;
  for (let i = 0; i < N; i++) {
    acc[i] = acc[i] * a + spl[i] * (1 - a);
    acs[i] = acs[i] * a + sps[i] * (1 - a);
  }
  params.fresh = false;
  blur(acc, blr, tmp);
  blur(acs, bls, tmp);
  box(blr, glo, tmp, 2);
  box(glo, glo, tmp, 2);
  box(glo, glo, tmp, 2);
  // The ion tail, each parcel a soft dot about two LEDs across.
  ion.fill(0);
  const { is, iu, ia, il, ib, kinks } = params;
  for (let i = 0; i < ION; i++) {
    if (ib[i] <= 0) continue;
    const s = is[i];
    let kink = 0;
    for (const q of kinks) {
      const z = (s - q.s) / (3 + 0.1 * q.s);
      if (z > -3 && z < 3) kink += q.amp * (1 + q.s / 35) * Math.exp(-z * z);
    }
    const u = s * Math.cos(ia[i]) * zoom;
    const w = ((s * Math.sin(ia[i]) + il[i]) * tilt + kink) * zoom;
    const x = xn + u * Dx + w * Px;
    const y = yn + u * Dy + w * Py;
    if (x < -3 || x > W + 3 || y < -3 || y > H + 3) continue;
    // A parcel's light is spread along the stretch it stands for, so the tail is as bright where the plasma runs fast.
    const b = ib[i] * (iu[i] / 40) * Math.exp(-s / 160) * smooth(s / 5);
    const x0 = Math.floor(x - 2.6);
    const y0 = Math.floor(y - 2.6);
    for (let yy = Math.max(0, y0); yy <= y0 + 5 && yy < H; yy++)
      for (let xx = Math.max(0, x0); xx <= x0 + 5 && xx < W; xx++) {
        const dx = xx + 0.5 - x;
        const dy = yy + 0.5 - y;
        const q = 1 - (dx * dx + dy * dy) / 4.4;
        if (q > 0) ion[yy * W + xx] += b * q * q;
      }
  }
  // Stars, soft and two LEDs across, some warm and some cool.
  star.fill(0);
  const t = params.t;
  for (const sr of params.stars) {
    const b = sr.b * (1 + 0.12 * Math.sin(1.7 * t + sr.tw));
    const x0 = Math.floor(sr.x - 1.2);
    const y0 = Math.floor(sr.y - 1.2);
    for (let yy = Math.max(0, y0); yy <= y0 + 3 && yy < H; yy++)
      for (let xx = Math.max(0, x0); xx <= x0 + 3 && xx < W; xx++) {
        const dx = xx + 0.5 - sr.x;
        const dy = yy + 0.5 - sr.y;
        const q = 1 - (dx * dx + dy * dy) / 2.6;
        if (q <= 0) continue;
        star[(yy * W + xx) * 2] += b * q * sr.warm;
        star[(yy * W + xx) * 2 + 1] += b * q * (1 - sr.warm);
      }
  }
  const { cdust: cd, cdim: cm, ccoma: cc, cion: ci, csmall: cs } = params;
  const ig = params.ionGain;
  // Surface brightness does not change with distance, so the light per LED is kept as the picture grows or shrinks.
  const lum = params.lum * 0.12 * zoom * zoom;
  const flash = params.flash;
  const comaB = (0.3 + 0.45 * Math.sqrt(params.act)) * Math.pow(1 / params.R, 0.7) * (1 + 1.2 * flash);
  const comaR = (1 + 0.4 * flash) * Math.sqrt(zoom);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // The box blur's running sums can leave a hair below zero.
      const d = Math.max(0, blr[i] + 0.35 * glo[i]) * lum;
      let bd = 0.95 * (1 - Math.exp(-0.6 * Math.pow(d, 0.55)));
      // The faintest dust is let go: on the panel it would only read as an olive haze.
      bd *= smooth((bd - 0.02) / 0.13);
      // Mean grain size here: -1 the biggest grains, on the curved side of the fan; 1 the smallest, nearest the sun line.
      const z = blr[i] > 1e-4 ? clamp(bls[i] / blr[i], -1, 1) : 0;
      const zs = smooth(0.5 + 0.7 * z);
      const bi = (1 - Math.exp(-ion[i] * 0.4 * ig)) * 0.9;
      const dx = x + 0.5 - xn;
      const dy = y + 0.5 - yn;
      const r2 = (dx * dx + dy * dy) / (comaR * comaR);
      // A small white core inside a green coma.
      const core = comaB * Math.exp(-r2 / 1.3);
      const bc = comaB * (0.45 * Math.exp(-r2 / 12) + 0.12 / (1 + r2 / 40));
      const sm = smooth(bd / 0.5);
      const c = [0, 0, 0];
      for (let j = 0; j < 3; j++) {
        const dust = (cm[j] + (cd[j] - cm[j]) * sm) * bd;
        c[j] = dust + (cs[j] * bd - dust) * zs + ci[j] * bi + cc[j] * bc;
      }
      const sw = star[i * 2];
      const sc = star[i * 2 + 1];
      c[0] += sw + 0.8 * sc;
      c[1] += 0.95 * sw + 0.9 * sc;
      c[2] += 0.82 * sw + sc;
      // Where tails overlap the light is scaled down, not clipped, so it keeps its colour instead of going white.
      const mx = Math.max(1, c[0], c[1], c[2]);
      const white = smooth(core / 0.9) * 0.9;
      for (let j = 0; j < 3; j++) c[j] = clamp((c[j] / mx + (1 - c[j] / mx) * white) * 255, 0, 255);
      display.setPixel(x, y, c[0], c[1], c[2]);
    }
}
