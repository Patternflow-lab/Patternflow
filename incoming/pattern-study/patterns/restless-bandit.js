// ===== Patternflow pattern =====
// Title:   Restless Bandit
// Family:  bandit
// Idea:    A gambler's belief about each arm stands as a filled bell curve in its own lane, and every round a draw from each bell picks the arm to pull, whose bell hops to the payout and tightens while the bells left alone widen, sink and cool until one of them wins a round again.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the multi-armed bandit as a problem of sequential experiments (Robbins 1952, from memory); choosing an arm by drawing once from each posterior and playing the largest draw (Thompson 1933, from memory); the restless bandit, whose arms change whether they are played or not (Whittle 1988, from memory); a belief of one mean and one variance per arm, updated by the gain v / (v + noise) and widened by a fixed amount of variance per unit of time (Kalman 1960, from memory); a walk pulled back to its centre for the wandering payout (Uhlenbeck and Ornstein 1930, from memory). Original here: beliefs drawn as filled bells whose height is the compressed density, lanes that breathe, colour by how often an arm was pulled lately, the draws as ticks and the payout as a falling drop, a truth made of two slow sines under the walk so that it moves at every setting, pattern round 246
// Round:   248
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..4, Arms=-1..1, Drift=-1..1
//
// Knob 1: Hue. Turns the whole colour scale and the markers round the wheel. It opens with the arm pulled most in mint near white, the others cooling through teal to deep blue, and the true payouts as coral beads under each baseline.
// Knob 2: Pace. 0.5 to 4, opening at 2: rounds a second, 1.5 times the knob. At 0.5 a round falls every 1.3 s and each draw can be followed by eye. At 2 there are three a second. At 4 there are six and the ticks run together.
// Knob 3: Arms. -1 to 1, opening at 0: the number of arms, 3 at -1, 5 at 0, 8 at 1. Lanes are added and dropped at the bottom and the others make room. A new arm starts with the widest bell.
// Knob 4: Drift. -1 to 1, opening at 0.06: how restless the arms are. At -1 the true payouts creep, bells stay narrow for a minute and one favourite holds. At 1 the payouts run, a bell is wide again two seconds after its pull and the gambler changes arm all the time.

const W = 64, H = 128, NA = 8;
const { floor, ceil, min, max, sqrt, exp, sin, log, pow, abs, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const X0 = 5, XS = 54;         // payout u in 0..1 sits at x = X0 + XS u, and the whole scale slides a little
const VMAX = 0.09;             // the prior: a standard deviation of 0.3
const RN = 0.07 * 0.07;        // variance of one payout round its arm's mean
const SDMIN = 0.035;           // the bell that stands at full height
const SDDRAW = 2.2 / XS;       // no bell is drawn narrower than 2.2 LED sigma
const FOOT = 4;                // rows of a lane under the bell: the baseline and the marker
const BREATH = 0.5;            // how far a lane's share of the panel swings
const FLOOR = 0.48;            // the fill, as a share of the rim

function rnd(st) {
  const a = (st.seed = (st.seed + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss(st) {
  return sqrt(-2 * log(max(1e-9, rnd(st)))) * sin(TAU * rnd(st));
}

// A colour from hue in degrees, saturation and value. Orange and yellow are lifted, because dark they read brown on the panel.
function hsv(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const dh = abs(((h - 40 + 540) % 360) - 180), wb = dh < 55 ? 1 - dh / 55 : 0;
  v += (1 - v) * 0.5 * wb;
  const c = v * s, hh = h / 60, x = c * (1 - abs((hh % 2) - 1)), m = v - c;
  const i = floor(hh);
  if (i === 0) return [c + m, x + m, m];
  if (i === 1) return [x + m, c + m, m];
  if (i === 2) return [m, c + m, x + m];
  if (i === 3) return [m, x + m, c + m];
  if (i === 4) return [x + m, m, c + m];
  return [c + m, m, x + m];
}

export function setup(params) {
  const f = () => new Float32Array(NA);
  const st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, seed: 1, acc: 0, sig: 0.13, hph: [0, 0],
    p1: f(), p2: f(), f1: f(), f2: f(), b1: f(), b2: f(), g1: f(), g2: f(), c1: f(), c2: f(),
    z: f(), mu: f(), m: f(), v: f(), dm: f(), ds: f(), rate: f(), heat: f(), lift: f(), w: f(), on: f(),
    tx: f(), ta: f(), tw: f(), top: f(), bot: f(),
    drops: [], hx: new Float32Array(W), kx: new Float32Array(W), buf: new Float32Array(W * H * 3),
  };
  params.st = st;
  return st;
}

// 4 arms below -0.4, 5 up to 0.2, then 6, 7 and 8 from 0.8
const armsOf = (k) => (k < -0.4 ? 4 : k < 0.2 ? 5 : min(8, 6 + floor((k - 0.2) / 0.3 + 1e-6)));

function fresh(st, i) {
  st.on[i] = 1;
  st.m[i] = st.dm[i] = 0.5;
  st.v[i] = VMAX;
  st.ds[i] = sqrt(VMAX);
  st.rate[i] = st.heat[i] = st.lift[i] = 0;
  st.ta[i] = 9;
}

// ---- one round: draw from every belief, pull the best draw, learn from the payout ----
function round(st, n) {
  const { m, v } = st;
  let a = 0, best = -1e9;
  for (let i = 0; i < n; i++) {
    const s = m[i] + sqrt(v[i]) * gauss(st);
    st.tx[i] = s;
    st.ta[i] = 0;
    st.tw[i] = 0;
    if (s > best) (best = s), (a = i);
  }
  st.tw[a] = 1;
  const r = st.mu[a] + 0.07 * gauss(st), gain = v[a] / (v[a] + RN);
  m[a] += gain * (r - m[a]);
  v[a] *= 1 - gain;
  st.rate[a] += 1;
  st.lift[a] += (1 - st.lift[a]) * 0.7;
  st.drops.push({ a, u: r, age: 0 });
  if (st.drops.length > 12) st.drops.shift();
}

function step(st, dt) {
  const k = st.k, t = (st.t += dt);
  const n = armsOf(k[2]);
  const d = exp(1.2 * cl(k[3], -1, 1));
  // the walk's spread stops growing at 0.2, and past that it runs faster instead
  const sig = min(0.13 * d, 0.2), rel = sig / (0.13 * d), tau = 45 * rel * rel;
  st.sig += (sig - st.sig) * (1 - exp(-dt / 0.4));
  const ez = exp(-dt / tau), nz = sqrt(1 - ez * ez);
  const qr = 0.0037 * d * d + 0.0016, back = 1 - exp(-dt / tau);
  const eW = 1 - exp(-dt / 0.3);
  for (let i = 0; i < NA; i++) {
    st.z[i] = st.z[i] * ez + nz * gauss(st);
    const x = 0.2 * sin((TAU * t) / st.p1[i] + st.f1[i]) + 0.14 * sin((TAU * t) / st.p2[i] + st.f2[i]) + st.sig * st.z[i];
    st.mu[i] = 0.5 + 0.42 * tanh(x / 0.42);
    const tgt = i < n ? 1 : 0;
    if (tgt && !st.on[i]) fresh(st, i);
    if (!tgt) st.on[i] = 0;
    st.w[i] += (tgt - st.w[i]) * eW;
    // what is not looked at is forgotten: the belief widens, and its mean slides back to the middle as the truth's would
    if (st.on[i]) (st.v[i] = min(st.v[i] + qr * dt, VMAX)), (st.m[i] += (0.5 - st.m[i]) * back);
  }
  st.acc += dt * 1.5 * cl(k[1], 0.5, 4);
  while (st.acc >= 1) {
    st.acc -= 1;
    round(st, n);
  }
  const e15 = 1 - exp(-dt / 0.15), dec = exp(-dt / 6), el = exp(-dt / 0.35), eh = 1 - exp(-dt / 0.6);
  let tot = 0.3;
  for (let i = 0; i < n; i++) tot += st.rate[i] *= dec;
  for (let i = 0; i < NA; i++) {
    st.dm[i] += (st.m[i] - st.dm[i]) * e15;
    st.ds[i] += (sqrt(st.v[i]) - st.ds[i]) * e15;
    st.lift[i] *= el;
    st.ta[i] += dt;
    if (i < n) st.heat[i] += (pow(st.rate[i] / tot, 0.45) - st.heat[i]) * eh;
  }
  for (let j = st.drops.length - 1; j >= 0; j--) if ((st.drops[j].age += dt) > 0.6) st.drops.splice(j, 1);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0] || 0, kv[1] || 0, kv[2] || 0, kv[3] || 0];
  if (!st.init) {
    st.init = true;
    st.seed = floor(Math.random() * 4294967296) | 0;
    const R = () => rnd(st);
    for (let i = 0; i < NA; i++) {
      st.p1[i] = 37 + 24 * R(); st.p2[i] = 67 + 30 * R();
      st.b1[i] = 43 + 28 * R(); st.b2[i] = 79 + 34 * R();
      st.f1[i] = TAU * R(); st.f2[i] = TAU * R(); st.g1[i] = TAU * R(); st.g2[i] = TAU * R();
      st.c1[i] = 47 + 36 * R(); st.c2[i] = TAU * R();
      st.z[i] = gauss(st);
      st.w[i] = i < armsOf(st.k[2]) ? 1 : 0;
    }
    st.hph = [TAU * R(), TAU * R(), TAU * R(), TAU * R(), TAU * R(), TAU * R()];
    // 150 rounds before the first frame, so the beliefs are already lived in
    const rate = 1.5 * cl(st.k[1], 0.5, 4), T = 150 / rate, h = min(0.1, 0.5 / rate);
    for (let s = 0; s < T; s += h) step(st, h);
  }
  step(st, cl(dt || 0, 0, 0.1));
}

// ---- drawing ----------------------------------------------------------------
export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { buf, hx, kx, top, bot } = st, t = st.t;
  buf.fill(0);
  const hk = 360 * st.k[0] + 12 * sin((TAU * t) / 61.7 + st.hph[0]) + 8 * sin((TAU * t) / 103.3 + st.hph[1]);
  // each lane's share of the panel breathes on two periods of its own
  const ph = st.hph, x0 = X0 + 5.5 * sin((TAU * t) / 57.3 + ph[2]) + 3.5 * sin((TAU * t) / 91.7 + ph[3]);
  // the fewer the lanes, the further each one swings and the wider the margins above and below the stack
  let nw = 0;
  for (let i = 0; i < NA; i++) nw += st.w[i];
  const few = 5 / max(3, nw), br = BREATH * pow(few, 0.8);
  const padT = few * (0.3 + 0.25 * sin((TAU * t) / 49.1 + ph[4])), padB = few * (0.3 + 0.25 * sin((TAU * t) / 73.3 + ph[5]));
  let sum = padT + padB;
  for (let i = 0; i < NA; i++) {
    hx[i] = st.w[i] * exp(br * (0.62 * sin((TAU * t) / st.b1[i] + st.g1[i]) + 0.38 * sin((TAU * t) / st.b2[i] + st.g2[i])));
    sum += hx[i];
  }
  let yy = (H * padT) / sum;
  for (let i = 0; i < NA; i++) {
    top[i] = yy;
    yy += (H * hx[i]) / sum;
    bot[i] = yy;
  }
  const lineC = hsv(196 + hk, 0.85, 0.15), markC = hsv(354 + hk, 0.56, 1), dropC = hsv(4 + hk, 0.26, 1);
  for (let i = 0; i < NA; i++) {
    const room = bot[i] - top[i] - FOOT;
    if (room < 2) continue;
    const base = bot[i] - FOOT, a = st.heat[i];
    const col = hsv(232 - 82 * pow(a, 0.9) + hk + 10 * sin((TAU * t) / st.c1[i] + st.c2[i]), 1 - 0.8 * pow(a, 2.2), 0.55 + 0.45 * pow(a, 0.7));
    const sd = max(st.ds[i], SDDRAW), hp = max(min(4, 0.9 * room), room * 0.85 * cl(pow(SDMIN / st.ds[i], 0.45), 0.26, 1));
    for (let x = 0; x < W; x++) {
      const e = ((x + 0.5 - x0) / XS - st.dm[i]) / sd, g = e * e > 40 ? 0 : exp(-0.5 * e * e);
      const sl = (hp * g * e) / (sd * XS);
      hx[x] = hp * g;
      kx[x] = 1 / sqrt(1 + sl * sl);
    }
    const fadeLen = max(3, 0.4 * hp), lift = 0.15 * sstep(0.45, 0.72, a) + 0.07 * st.lift[i];
    const y0 = max(0, ceil(top[i] - 0.5)), y1 = min(H - 1, ceil(bot[i] - 0.5) - 1);
    for (let y = y0; y <= y1; y++) {
      const dc = base - (y + 0.5), o = y * W * 3;
      const ln = max(0, min(y + 1, base + 2) - max(y, base));
      if (dc <= -0.5) {
        if (ln > 0) for (let x = 0; x < W; x++) (buf[o + x * 3] = ln * lineC[0]), (buf[o + x * 3 + 1] = ln * lineC[1]), (buf[o + x * 3 + 2] = ln * lineC[2]);
        continue;
      }
      const cb = min(1, dc + 0.5), gr = lift * (0.72 + 0.28 * (1 - dc / room)) * cb;
      for (let x = 0; x < W; x++) {
        const s = (hx[x] - dc) * kx[x];
        let v = gr;
        if (s > -0.5) v += cb * min(1, s + 0.5) * (FLOOR + (1 - FLOOR) * (1 - sstep(1.2, 1.2 + fadeLen, s)));
        else if (s > -3) v += cb * 0.22 * (1 + (s + 0.5) / 2.5) * (1 + (s + 0.5) / 2.5);
        const p = o + x * 3;
        buf[p] = max(v * col[0], ln * lineC[0]);
        buf[p + 1] = max(v * col[1], ln * lineC[1]);
        buf[p + 2] = max(v * col[2], ln * lineC[2]);
      }
    }
    // the draw: a tick 2 LED wide standing on the baseline, white where it won
    if (st.ta[i] < 0.45) {
      const win = st.tw[i] > 0, life = win ? 0.45 : 0.3, al = 1 - st.ta[i] / life;
      if (al > 0) {
        const th = max(4, room * (win ? 0.45 : 0.34)), xa = cl(floor(x0 + XS * st.tx[i] + 0.5) - 1, 0, W - 2), ti = al * al * (win ? 1 : 0.62);
        const tr = win ? 1 : 0.5 + 0.5 * col[0], tg = win ? 1 : 0.5 + 0.5 * col[1], tb = win ? 1 : 0.5 + 0.5 * col[2];
        for (let y = max(0, floor(base - th)); y < base && y < H; y++) {
          const c = min(1, y + 1 - (base - th)) * min(1, base - y) * ti;
          for (let x = xa; x < xa + 2; x++) {
            const p = (y * W + x) * 3;
            buf[p] += c * tr; buf[p + 1] += c * tg; buf[p + 2] += c * tb;
          }
        }
      }
    }
    // the true payout: a coral bead hanging under the baseline
    const mx = x0 + XS * st.mu[i], my = base + 2.3, mw = min(1, st.w[i] * 1.5);
    for (let y = max(0, floor(my - 2)); y <= min(H - 1, floor(my + 2)); y++) {
      for (let x = max(0, floor(mx - 3)); x <= min(W - 1, floor(mx + 3)); x++) {
        const dx = x + 0.5 - mx, dy = y + 0.5 - my, c = mw * min(1, 1.25 * exp(-dx * dx / 2.6 - dy * dy / 2)), p = (y * W + x) * 3;
        if (c < 0.06) continue;
        buf[p] = max(buf[p], c * markC[0]); buf[p + 1] = max(buf[p + 1], c * markC[1]); buf[p + 2] = max(buf[p + 2], c * markC[2]);
      }
    }
  }
  // the payout: a drop that falls from the top of the lane onto the curve and fades
  for (const dr of st.drops) {
    const i = dr.a, room = bot[i] - top[i] - FOOT;
    if (room < 2 || !st.on[i]) continue;
    const base = bot[i] - FOOT, sd = max(st.ds[i], SDDRAW), e = (dr.u - st.dm[i]) / sd, dx0 = cl(x0 + XS * dr.u, 1.5, W - 1.5);
    const hp = max(min(4, 0.9 * room), room * 0.85 * cl(pow(SDMIN / st.ds[i], 0.45), 0.26, 1));
    const f = min(1, dr.age / 0.2), ya = top[i] + 1.5, yb = max(ya, base - hp * exp(-0.5 * e * e) - 0.5);
    const cy = ya + (yb - ya) * f * f, al = dr.age < 0.2 ? 0.55 + 0.45 * f : 1 - (dr.age - 0.2) / 0.4;
    if (al <= 0) continue;
    for (let y = max(0, floor(cy - 3)); y <= min(H - 1, floor(cy + 3)); y++) {
      for (let x = max(0, floor(dx0 - 3)); x <= min(W - 1, floor(dx0 + 3)); x++) {
        const dx = x + 0.5 - dx0, dy = y + 0.5 - cy, c = al * min(1, 1.3 * exp(-(dx * dx + dy * dy) / 2.4)), p = (y * W + x) * 3;
        if (c < 0.05) continue;
        buf[p] += c * dropC[0]; buf[p + 1] += c * dropC[1]; buf[p + 2] += c * dropC[2];
      }
    }
  }
  for (let y = 0, p = 0; y < H; y++) {
    for (let x = 0; x < W; x++, p += 3) {
      display.setPixel(x, y, min(255, floor(buf[p] * 255 + 0.5)), min(255, floor(buf[p + 1] * 255 + 0.5)), min(255, floor(buf[p + 2] * 255 + 0.5)));
    }
  }
}
