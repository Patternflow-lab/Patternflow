// ===== Patternflow pattern =====
// Title:   Bullwhip
// Family:  bullwhip
// Idea:    A four-stage supply chain, retailer to factory left to right, runs its stock, forecasts and orders with a real simulation, so a small ripple of customer demand fans out into wider and wider swings of orders lane by lane, over tanks that slosh with each stage's stock and pipes where shipments fall toward them.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the bullwhip effect, the amplification of order variance up a supply chain (Jay Forrester, Industrial Dynamics, 1961; the MIT Beer Distribution Game, Sterman, 1989; Lee, Padmanabhan and Whang, 1997; all from memory), simulated here with exponential-smoothing forecasts, an order-up-to policy that counts the pipeline, an information delay of one period and a transport delay of one to six; the noisy customer demand with steps and bursts, the sloshing tanks, the falling shipments and the fan of ribbons are original, pattern round 256
// Round:   256
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..4, Reaction=-1..1, Delay=-1..1
//
// Knob 1: Hue. Turns the four lanes round the wheel together; at 0 the retailer is a cool teal and the lanes warm lane by lane through blue and magenta to a hot orange factory. The whole chain's colour also drifts up to about a tenth of the wheel either side of the knob over a minute or two, and each lane's glow and whiteness breathe on beats of their own.
// Knob 2: Speed. 0.3 to 4, opening at 2. How fast the periods tick: a period lasts 1 / Speed seconds, 0.5 s at 2, 0.25 s at 4 and 3.3 s at 0.3; the ribbons scroll, the shipments fall and the tanks slosh at that pace.
// Knob 3: Reaction. -1 to 1, opening at 0. How hard every stage chases its numbers: the weight of the newest demand in its forecast (0.05 at -1, 0.09 at 0, 0.11 at 1), the share of its gap to the order-up-to level that it orders back each period (0.4, 0.65, 0.9), and how much of the goods still on order it believes in (95 per cent, 85, 82). At -1 the chain is calm and the lanes hardly fan; at 1 the factory's orders swing from nothing to many times the demand.
// Knob 4: Delay. -1 to 1, opening at 0.06. The transport delay of a shipment in whole periods, 1 at -1 up to 6 at 1, and 4 at the start. A longer delay means more packets in each pipe, more goods in flight to be counted, and a wider whip. Turned while running, the packets already in the pipes stretch or squeeze to the new delay.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, sin, pow, round, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();

const NS = 4;                    // retailer, wholesaler, distributor, factory
const LW = 16;                   // one lane
const HN = 256, HM = HN - 1;     // history ring of the orders, in periods
const TOP = 3, RIM = 30, TANKB = 56;      // pipe from TOP to RIM, tank from RIM to TANKB, bottom wall below
const CH_T = 60, CH_H = H - CH_T;         // the strip chart: newest at the top
const RPP = 1.2;                          // chart rows per period
const NC = 10;                            // tank interior columns
const INFO = 1;                           // information delay, periods
// the beats, in seconds, on which each lane's colour and size lean a little either way: its hue, the glow of its ribbon
// and of its tank, its saturation, and the gain of its ribbon and of its tank. Twenty-four of them, picked so that no two
// moments 20 s or more apart wear the same colours and sizes
const HB = [24.1, 34.8, 43.1, 56.5], LB = [36.0, 44.4, 62.1, 26.7], TB = [47.7, 63.8, 28.7, 37.6];
const SB = [66.9, 30.0, 37.9, 47.8], GB = [30.6, 39.8, 54.3, 70.7], KB = [40.9, 55.6, 74.9, 33.6];
const HUE0 = 0.5, HUE_STEP = [0, 0.16, 0.36, 0.57];  // lane hues from teal to red-orange before the knob is added

const hv = [0, 0, 0];
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const mk = (n) => new Float32Array(n);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, T: 0,
    n: 0, frac: 0,
    // the chain
    oh: mk(NS), bl: mk(NS), lo: mk(NS), F: mk(NS), sg: mk(NS), oo: mk(NS), op: mk(NS),
    pk: [[], [], [], []],
    hist: [mk(HN), mk(HN), mk(HN), mk(HN)], dh: mk(HN),
    // what is drawn: the state one period ago and now
    lv0: mk(NS), lv1: mk(NS), bl0: mk(NS), bl1: mk(NS), pg: mk(NS),
    // customer demand
    dx: 0, ev: 0, burst: 0,
    L: 4,
    // the tanks' surfaces
    sh: [mk(NC), mk(NC), mk(NC), mk(NC)], sv: [mk(NC), mk(NC), mk(NC), mk(NC)],
    ph: [rnd() * TP, rnd() * TP, rnd() * TP, rnd() * TP],
    sp: [47 + 13 * rnd(), 25 + 9 * rnd(), 121 + 45 * rnd()],
    fb: new Float32Array(W * H * 3),
  });
  for (let i = 0; i < NS; i++) { st.F[i] = 1; st.sg[i] = 0.15; st.oh[i] = 3; st.op[i] = 1; }
  return st;
}

// customer demand in units of the mean: a mean-reverting wander, white noise, and now and then a step that
// relaxes back over a dozen periods or a short burst
function demand(st) {
  st.dx = 0.8 * st.dx + 0.05 * (rnd() + rnd() + rnd() - 1.5) * 2;
  if (rnd() < 1 / 24) {
    const sign = st.ev > 0.25 ? -1 : st.ev < -0.25 ? 1 : (rnd() < 0.5 ? -1 : 1);
    st.ev += sign * (0.22 + 0.35 * rnd());
  }
  st.ev *= 0.955;
  if (rnd() < 1 / 30) st.burst += 0.5 + 0.8 * rnd();
  st.burst *= 0.4;
  // the seasons: three slow beats that never line up
  const se = 0.2 * sin(st.n * TP / st.sp[0] + st.ph[0]) + 0.13 * sin(st.n * TP / st.sp[1] + st.ph[1]) + 0.16 * sin(st.n * TP / st.sp[2] + st.ph[2]);
  const d = 1 + st.dx + st.ev + st.burst + se + 0.3 * (rnd() - 0.5) * 2 * 0.5;
  return max(0.05, d);
}

// One period of the chain. Stage 0 sells to the customer, stage 3 is the factory, whose supplier is a production line.
// Each stage: take in the shipments that arrive, meet the demand it saw (an order of the stage below, a period old),
// ship what it has, keep the rest as backlog, forecast by exponential smoothing, and order up to
// cover * forecast + a safety stock, counting what is still on order. Orders are never negative.
function tick(st) {
  const n = ++st.n, L = st.L;
  const r = cl((st.ks[2] + 1) / 2, 0, 1);
  const rs = 1 - (1 - r) * (1 - r);
  const alpha = 0.05 + 0.058 * rs;                   // weight of the newest demand
  const beta = 0.4 + 0.5 * r;                        // share of the gap ordered back
  const theta = 0.95 - 0.13 * rs;                    // how much of the goods still on order a stage counts
  const zs = 0.9 + 0.4 * r;                          // safety factor on the forecast error
  const cust = demand(st);
  st.dh[n & HM] = cust;
  for (let i = 0; i < NS; i++) {
    // arrivals
    const list = st.pk[i];
    for (let j = 0; j < list.length; j++) {
      const p = list[j];
      if (!p.done && n >= p.t0 + p.lead) { p.done = true; st.oh[i] += p.q; st.oo[i] -= p.q; }
    }
    for (let j = list.length - 1; j >= 0; j--) if (list[j].done && n > list[j].t0 + list[j].lead + 2) list.splice(j, 1);
    // demand and shipping
    const D = i === 0 ? cust : st.op[i - 1];
    const need = D + st.bl[i];
    const ship = min(max(st.oh[i], 0), need);
    st.oh[i] -= ship;
    st.bl[i] = need - ship;
    if (i > 0 && ship > 0.01) st.pk[i - 1].push({ q: ship, t0: n, lead: L, vo: 0, hit: false, done: false, x: 1.5 + rnd() * (NC - 3) });
    // forecast, spread, order
    const e = D - st.F[i];
    st.F[i] += alpha * e;
    st.sg[i] += 0.04 * (abs(e) - st.sg[i]);
    const cover = L + INFO + 1;
    const S = st.F[i] * cover + zs * 1.25 * st.sg[i] * sqrt(cover);
    const IP = st.oh[i] - st.bl[i] + theta * st.oo[i];
    // the buyer's own whims: orders drift a little off what the rule says, and now and then jump
    st.lo[i] = 0.78 * st.lo[i] + 0.05 * (rnd() + rnd() + rnd() - 1.5) * 2;
    if (rnd() < 1 / 40) st.lo[i] += (rnd() < 0.5 ? -1 : 1) * (0.35 + 0.45 * rnd());
    const o = max(0, beta * (S - IP) + (1 - beta) * st.F[i] + st.lo[i]);
    st.oo[i] += o;
    st.op[i] = o;
    st.hist[i][n & HM] = o;
    if (i === NS - 1 && o > 0.01) st.pk[i].push({ q: o, t0: n, lead: L, vo: 0, hit: false, done: false, x: 1.5 + rnd() * (NC - 3) });
  }
}

// the tank's level from the stock on hand: soft, so a stage that piles up still shows its swings
const levelOf = (oh, i) => 1 - exp(-max(0, oh) / (3 + 2.2 * i));   // bigger tanks upstream
const backOf = (bl) => 1 - exp(-bl / 2.2);

function snapshot(st) {
  for (let i = 0; i < NS; i++) {
    st.lv0[i] = st.lv1[i]; st.bl0[i] = st.bl1[i];
    st.lv1[i] = levelOf(st.oh[i], i); st.bl1[i] = backOf(st.bl[i]);
  }
}

function setLead(st, Ln) {
  if (Ln === st.L) return;
  const Td = st.n - 1 + st.frac;
  for (let i = 0; i < NS; i++) {
    const list = st.pk[i];
    for (let j = 0; j < list.length; j++) {
      const p = list[j];
      if (p.done) continue;
      const f = cl((Td - p.t0) / p.lead + p.vo, 0, 0.999);
      // keep the packet's place along the pipe and let it arrive in whole periods of the new delay
      const rem = max(1, Math.ceil((1 - f) * Ln - 1e-6));
      const t0n = st.n + rem - Ln;
      p.vo = f - (Td - t0n) / Ln;
      p.t0 = t0n; p.lead = Ln;
    }
  }
  st.L = Ln;
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    st.L = cl(round(1 + 5 * (cl(st.ks[3], -1, 1) + 1) / 2), 1, 6);
    // a chain at its steady state (one unit a period down every pipe), then run unseen until it has developed
    for (let i = 0; i < NS; i++) {
      for (let a = 0; a < st.L; a++) st.pk[i].push({ q: 1, t0: -a, lead: st.L, vo: 0, hit: true, done: false, x: 1.5 + rnd() * (NC - 3) });
      st.oo[i] = st.L + (i < NS - 1 ? INFO : 0);
    }
    for (let t = 0; t < 260; t++) { tick(st); if (t === 258) snapshot(st); }
    snapshot(st);
    st.frac = rnd() * 0.5;
  } else {
    const a = 1 - exp(-dt / 0.14);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  st.T += dt;
  const speed = cl(st.ks[1], 0.3, 4);
  setLead(st, cl(round(1 + 5 * (cl(st.k[3], -1, 1) + 1) / 2), 1, 6));
  // periods
  st.frac += dt * speed / 1.0;
  let guard = 0;
  while (st.frac >= 1 && guard++ < 6) {
    st.frac -= 1;
    const before = st.lv1.slice();
    tick(st);
    snapshot(st);
    for (let i = 0; i < NS; i++) {
      const dpx = (st.lv1[i] - before[i]) * (TANKB - RIM);
      const sv = st.sv[i], tilt = cl(dpx, -6, 6) * 0.06 * (rnd() < 0.5 ? -1 : 1);
      for (let j = 0; j < NC; j++) sv[j] += tilt * (j - (NC - 1) / 2) / ((NC - 1) / 2);
    }
  }
  if (st.frac >= 1) st.frac = 0.999;
  // the pipes glow with what is in them, the goods in flight and on order
  for (let i = 0; i < NS; i++) {
    const want = 1 - exp(-max(0, st.oo[i]) / (st.L + 1) / 1.2);
    st.pg[i] += (want - st.pg[i]) * (1 - exp(-dt / 0.5));
  }
  // the tanks' surfaces: a shallow-water ring with damping, split into fixed steps
  const Td = st.n - 1 + st.frac;
  const steps = max(1, round(dt * 60 * (0.5 + 0.25 * speed)));
  for (let i = 0; i < NS; i++) {
    const list = st.pk[i];
    for (let j = 0; j < list.length; j++) {
      const p = list[j];
      p.vo *= exp(-dt / 0.3);
      if (!p.hit && (Td - p.t0) / p.lead + p.vo >= 1) {
        p.hit = true;
        const sv = st.sv[i], amp = 0.55 * sqrt(p.q);
        for (let c = 0; c < NC; c++) { const d = (c - p.x) / 1.3; sv[c] += amp * exp(-d * d); }
      }
    }
    const h = st.sh[i], v = st.sv[i];
    for (let s = 0; s < steps; s++) {
      for (let c = 0; c < NC; c++) {
        const l = h[c > 0 ? c - 1 : 0], rr = h[c < NC - 1 ? c + 1 : NC - 1];
        v[c] += 0.07 * (l + rr - 2 * h[c]) - 0.012 * v[c] - 0.004 * h[c];
      }
      for (let c = 0; c < NC; c++) { h[c] = cl(h[c] + v[c], -4, 4); }
    }
  }
}

function histAt(arr, t, n) {
  const i = floor(t), f = t - i;
  const g = (j) => arr[(j > n ? n : j) & HM];
  const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
  const v = 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f);
  return v < 0 ? 0 : v;
}

const widthOf = (o) => 1.0 + 6.5 * (1 - exp(-o / 1.15));   // half-width in LEDs: a thread of 2 at no orders, nearly the lane at many

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const fb = st.fb, T = st.T, n = st.n, frac = st.frac, Td = n - 1 + frac;
  fb.fill(0);
  const add = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    fb[o] += r; fb[o + 1] += g; fb[o + 2] += b;
  };
  // the whole chain's colour drifts a little round the Hue knob on three beats that never line up
  const huek = fin(st.ks[0], 0) + 0.06 * sin(T * TP / 39.0 + st.ph[0]) + 0.05 * sin(T * TP / 55.4 + st.ph[1]) + 0.04 * sin(T * TP / 69.2 + st.ph[2]);
  const ease = sstep(0.45, 1, frac);
  for (let i = 0; i < NS; i++) {
    // each lane's colour and size lean a little either way on beats of their own, so no two minutes look alike
    const wb = (P, k) => sin(T * TP / P[i] + st.ph[(i + k) & 3] * (1.3 + k));
    const hue = HUE0 + HUE_STEP[i] + huek + 0.055 * wb(HB, 0);
    // blue and violet come out darker than the rest on the panel, so they get a little more
    const hf = hue - floor(hue), bz = 1 + 0.5 * exp(-((hf - 0.68) / 0.09) * ((hf - 0.68) / 0.09));
    const lum = bz * (0.78 + 0.22 * wb(LB, 1));
    const lt = bz * (0.78 + 0.22 * wb(TB, 2));
    const sat = 0.72 + 0.28 * wb(SB, 3);
    const gc = 1 + 0.15 * wb(GB, 0), gk = 1 + 0.15 * wb(KB, 1);
    const x0 = i * LW, cx = x0 + LW / 2;
    const lvl = cl((st.lv0[i] + (st.lv1[i] - st.lv0[i]) * ease) * gk, 0, 1);
    const bk = st.bl0[i] + (st.bl1[i] - st.bl0[i]) * ease;
    const sh = st.sh[i];
    const surf = (c) => {         // surface y over interior column c, smoothed along the tank
      const a = sh[cl(c, 0, NC - 1)];
      return TANKB - lvl * (TANKB - RIM) + a;
    };
    // walls of the tube, dimmer over the pipe and brighter round the tank
    for (let y = TOP - 1; y < TANKB + 2; y++) {
      const w = y < RIM ? 0.16 + 0.14 * sstep(RIM - 10, RIM, y) : 0.34;
      hsv(hue, 0.7, w * lt, hv);
      for (let k = 0; k < 2; k++) {
        add(x0 + 1 + k, y, hv[0], hv[1], hv[2]);
        add(x0 + 13 + k, y, hv[0], hv[1], hv[2]);
      }
    }
    hsv(hue, 0.7, 0.34 * lt, hv);
    for (let x = x0 + 3; x < x0 + 13; x++) for (let y = TANKB; y < TANKB + 2; y++) add(x, y, hv[0], hv[1], hv[2]);
    // the pipe's own glow, brighter the more is on its way
    for (let y = TOP; y < RIM; y++) {
      const gy = 0.6 + 0.4 * sstep(TOP, RIM, y);
      hsv(hue, sat, (0.04 + 0.26 * st.pg[i]) * gy * lt, hv);
      for (let x = x0 + 3; x < x0 + 13; x++) add(x, y, hv[0], hv[1], hv[2]);
    }
    // water
    for (let c = 0; c < NC; c++) {
      const ys = surf(c);
      for (let y = RIM; y < TANKB; y++) {
        const cov = cl(y + 1 - ys, 0, 1);
        if (cov <= 0) continue;
        const d = y + 0.5 - ys;
        const v = (0.5 + 0.45 * exp(-max(d, 0) / 5)) * cov;
        hsv(hue, sat, v * lt, hv);
        add(x0 + 3 + c, y, hv[0], hv[1], hv[2]);
        // the surface line
        const fo = exp(-abs(d) / 0.9) * 0.5 * cov;
        if (fo > 0.02) add(x0 + 3 + c, y, fo, fo, fo * 0.95);
      }
    }
    // backlog: an ember hanging from the rim, flickering, where the tank has nothing to give
    if (bk > 0.02) {
      const len = bk * 0.8 * (TANKB - RIM);
      const hh = HUE0 + HUE_STEP[3] + 0.02 + huek;
      for (let c = 0; c < NC; c++) {
        for (let y = RIM; y < RIM + len + 1; y++) {
          const cov = cl(RIM + len - y + 0.5, 0, 1);
          const fl = 0.6 + 0.4 * sin(y * 1.7 + T * 5 + st.ph[i] + c * 0.9);
          hsv(hh, 0.95, 0.75 * cov * fl, hv);
          add(x0 + 3 + c, y, hv[0], hv[1], hv[2]);
        }
      }
    }
    // shipments falling down the pipe
    const list = st.pk[i];
    for (let j = 0; j < list.length; j++) {
      const p = list[j];
      const f = (Td - p.t0) / p.lead + p.vo;
      if (f < 0) continue;
      const wq = cl(1.5 + 1.8 * sqrt(p.q), 1.8, 4.6);
      if (f <= 1) {
        const yc = TOP + 3 + cl(f, 0, 1) * (RIM - TOP - 3);
        const al = sstep(0, 0.1, f);
        for (let yy = floor(yc - 5); yy <= floor(yc + 2); yy++) {
          const dy = yy + 0.5 - yc;
          // a round-cornered packet 3 rows high with a short tail above it
          const body = dy < 0 ? cl(1.5 + dy, 0, 1) : cl(1.5 - dy, 0, 1);
          const tail = dy < -1.5 ? 0.45 * exp((dy + 1.5) / 1.4) : 0;
          const cov = max(body, tail);
          if (cov <= 0.02) continue;
          const rr = wq - (body > 0 && abs(dy) > 0.9 ? 0.9 : 0);
          for (let x = floor(cx - wq - 1); x <= floor(cx + wq); x++) {
            const dx = abs(x + 0.5 - cx);
            const cv = cl(rr - dx + 0.5, 0, 1) * cov * al;
            if (cv <= 0.01) continue;
            hsv(hue + 0.01, 0.5, 1.0 * cv, hv);
            add(x, yy, hv[0], hv[1], hv[2]);
          }
        }
      } else if (f < 1.4) {
        // the stream from the rim to the surface
        const pf = 1 - (f - 1) / 0.4;
        const ys = surf(p.x);
        for (let y = RIM; y < ys + 1; y++) {
          const cov = cl(ys - y + 0.5, 0, 1) * pf;
          for (let x = floor(cx - wq * 0.5 - 1); x <= floor(cx + wq * 0.5); x++) {
            const cv = cl(wq * 0.5 - abs(x + 0.5 - cx) + 0.5, 0, 1) * cov;
            if (cv <= 0.01) continue;
            hsv(hue + 0.02, 0.4, 0.8 * cv, hv);
            add(x, y, hv[0], hv[1], hv[2]);
          }
        }
      }
    }
    // the strip chart: the orders of this stage, newest at the top, a filled ribbon about the lane's middle
    const hist = st.hist[i];
    for (let row = 0; row < CH_H; row++) {
      const a = (row + 0.5) / RPP;
      const t = Td - a;
      const o = histAt(hist, t, n);
      const hw = 1 + (widthOf(o) - 1) * gc;
      const gd = 1 + (widthOf(histAt(st.dh, t, n)) - 1) * gc;     // the width the customer's own demand would have drawn
      const fa = (1 - 0.4 * pow(row / CH_H, 1.3)) * (0.5 + 0.5 * sstep(0, 1.6, o));   // older rows dim, and so do thin orders
      const hot = cl((o - 1.4) / 3, 0, 1);
      const y = CH_T + row;
      for (let x = x0; x < x0 + LW; x++) {
        const d = abs(x + 0.5 - cx);
        const u = hw - d;
        const cov = cl(u + 0.5, 0, 1);
        const v = cov * (0.36 + 0.7 * exp(-max(u, 0) / 1.4));
        const gl = (1 - cov) * 0.3 * exp(min(0, u) / 1.5);
        const vv = (v + gl) * fa;
        if (vv >= 0.01) {
          hsv(hue + 0.03 * hot, cl(sat + 0.08 - 0.3 * hot, 0, 1), vv * lum, hv);
          add(x, y, hv[0], hv[1], hv[2]);
        }
        const gh = 0.3 * exp(-abs(d - gd) / 0.9) * fa;
        if (gh >= 0.02) add(x, y, gh, gh, gh * 0.95);
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, floor(cl(fb[o], 0, 1) * 255), floor(cl(fb[o + 1], 0, 1) * 255), floor(cl(fb[o + 2], 0, 1) * 255));
    }
  }
}
