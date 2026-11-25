// ===== Patternflow pattern =====
// Title:   Holding Stack
// Family:  airtraffic
// Idea:    Seen from straight above, arrivals circle two racetrack holds in nested rings, step inward as the one below them is cleared, and drain along curved paths into one evenly spaced line of gold points that slows down the final approach to a bar at the bottom.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the holding pattern, a racetrack of two straight legs and two half turns flown over a fix, and the stack, in which aircraft wait one level apart and the lowest leaves first while the rest step down (air traffic control practice since the 1940s, from memory); the four stacks that feed London Heathrow (from memory); time-based separation on final, each arrival placed a fixed gap behind the one ahead (from memory); the missed approach, flown back to the hold; the long-persistence phosphor of a plan position radar screen, on which a moving echo drags a fading tail. Original here: one aircraft to a ring with the rings drawn 3.3 LED apart, the slot rule that lets an aircraft leave its hold only when a transit flown from where it is, at the shortest time or stretched by up to 1.6, puts it exactly one gap behind the last one cleared, a final flown at under half the holding speed so that two holds can keep the line full, the marks on the final that show the slots, traffic that comes in waves, a layout that never stops drifting, gold points over teal wakes, pattern round 246
// Round:   248
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Traffic=-1..1, Spacing=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel. It opens with blue-white points and blue tails in the holds, gold points on final with teal wakes behind them, a pink one now and then climbing away from a missed approach, and a green bar at the threshold.
// Knob 2: Speed. 0.5 to 4, opening at 2: how fast everything flies. An aircraft in a hold covers about 11 LED a second at 2, under 3 at 0.5 and 22 at 4. Its tail grows with the speed up to 2 and keeps that length above it. The slow swing of the holds and of the final does not follow this knob.
// Knob 3: Traffic. -1 to 1, opening at 0: how many arrive. At -1 three or four aircraft are in the sky and most leave the hold the first time round. At 0 each hold carries one to three. At 1 both holds stand four rings deep and the arrivals they cannot take cross the top of the panel dimly and leave.
// Knob 4: Spacing. -1 to 1, opening at 0.06: the separation kept at the top of the final, about 9 LED at -1, 15 at 0 and 25 at 1. The dim marks on the final's centre line are the slots, one separation apart, and they close up or spread the moment the knob turns; the aircraft follow as new ones are cleared. Tight, the line is a string of seven or eight points and the marks run together. Wide, it is two or three, fewer land and the holds fill.

const W = 64, H = 128;
const { floor, min, max, sqrt, exp, sin, cos, pow, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const hyp = (x, y) => sqrt(x * x + y * y);

const V = 11;                 // LED a second in a hold, in simulated seconds (the opening runs them at real time)
const LEG = 20;               // a straight leg of a hold, about: each hold's legs breathe
const R0 = 4.2, DR = 3.3;      // radius of the innermost ring, and the step to the next ring out
const NLEV = 4;               // rings to a hold
const LF = 46;                // length of the final
const VF0 = 0.45, VF1 = 0.25; // speed at the top of the final and at the threshold, as a share of V
const STRETCH = 1.6;          // a cleared aircraft may take up to this many times the shortest transit
const ARM = 0.37;             // control arms of the transit curve, as a share of its chord
const MEAN = 3.5;             // seconds between arrivals at Traffic 0 and the opening spacing
const TAIL = 1.6, WARM = 0.42; // time constants of the long glow and of the short gold one, real seconds
const FK = (VF0 - VF1) / (LF * VF0), FR = (V * (VF0 - VF1)) / LF; // the slowing down the final, for the time since the top
const BX = [17, 47], BY = [34, 40], SG = [1, -1];
// periods of the slow drift, seconds; none divides another
const PX = [43.7, 37.1], PY = [67.9, 89.3], PA = [53.3, 71.9];
const QX2 = [19.3, 21.7], QY2 = [23.9, 25.3], QA2 = [27.1, 31.1], PL = [57.7, 79.1];

let QX = 0, QY = 0; // where the last call of hpos or bez landed

// The pattern keeps its own random stream, started from Math.random once.
function rnd(st) {
  const a = (st.seed = (st.seed + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function setup(params) {
  const f = (n) => new Float32Array(n);
  const hold = () => ({ x: 0, y: 0, ax: 0, ay: 1, bx: 1, by: 0, leg: LEG, hl: LEG / 2 });
  const st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, ts: 0, seed: 1, ph: [], hue: 0, wave: 1,
    ac: [], q: [[], []], hc: [hold(), hold()],
    ix: 32, iy: 74, tx: 32, ty: 120, dx: 0, dy: 1,
    slot: -1e9, acc: 0, due: 1, flash: 0, gd: 3, ref: 0, sh: 0,
    G: f(W * H * 3), Wm: f(W * H * 3), F: f(W * H * 3),
  };
  params.st = st;
  return st;
}

// ---- the layout: two holds and the final, all of it drifting -----------------
function layout(st) {
  const t = st.t, p = st.ph;
  for (let h = 0; h < 2; h++) {
    const o = h * 6, hd = st.hc[h];
    hd.x = BX[h] + 5 * sin((TAU * t) / PX[h] + p[o]) + 1.5 * sin((TAU * t) / QX2[h] + p[o + 1]);
    hd.y = BY[h] + 9 * sin((TAU * t) / PY[h] + p[o + 2]) + 2.5 * sin((TAU * t) / QY2[h] + p[o + 3]);
    // the long axis leans a little towards the final and swings about that
    const th = SG[h] * 0.12 + 0.36 * sin((TAU * t) / PA[h] + p[o + 4]) + 0.1 * sin((TAU * t) / QA2[h] + p[o + 5]);
    hd.leg = LEG * (1 + 0.26 * sin((TAU * t) / PL[h] + p[17 + h]) + 0.06 * sin((TAU * t) / 20.9 + p[19 + h]));
    hd.hl = hd.leg / 2;
    hd.ax = sin(th);
    hd.ay = cos(th);
    hd.bx = SG[h] * cos(th);
    hd.by = -SG[h] * sin(th);
  }
  const ps = 0.15 * sin((TAU * t) / 61.3 + p[12]) + 0.06 * sin((TAU * t) / 29.9 + p[13]);
  st.tx = 32 + 5.5 * sin((TAU * t) / 83.9 + p[14]) + 2 * sin((TAU * t) / 33.7 + p[15]);
  st.ty = 119.5 + 2 * sin((TAU * t) / 47.9 + p[16]);
  st.dx = sin(ps);
  st.dy = cos(ps);
  // and the whole palette leans a little one way and the other
  st.hue = 0.05 * sin((TAU * t) / 59.1 + p[21]) + 0.03 * sin((TAU * t) / 97.3 + p[22]);
  // traffic comes in waves: busy spells and quiet ones, from half the mean rate to twice
  st.wave = exp(0.45 * sin((TAU * t) / 71.3 + p[23]) + 0.25 * sin((TAU * t) / 113.9 + p[24])) / 1.07;
  st.ix = st.tx - st.dx * LF;
  st.iy = st.ty - st.dy * LF;
}

// A place on a hold's ring of radius r. ph runs 0 to 4: the leg down the panel, the bottom turn, the leg back up, the top turn.
function hpos(hd, ph, r) {
  let u, v;
  const hl = hd.hl;
  if (ph < 1) (u = -hl + ph * hd.leg), (v = r);
  else if (ph < 2) (u = hl + r * sin((ph - 1) * PI)), (v = r * cos((ph - 1) * PI));
  else if (ph < 3) (u = hl - (ph - 2) * hd.leg), (v = -r);
  else (u = -hl - r * sin((ph - 3) * PI)), (v = -r * cos((ph - 3) * PI));
  QX = hd.x + hd.ax * u + hd.bx * v;
  QY = hd.y + hd.ay * u + hd.by * v;
}
function bez(x0, y0, x1, y1, x2, y2, x3, y3, u) {
  const w = 1 - u, a = w * w * w, b = 3 * w * w * u, c = 3 * w * u * u, d = u * u * u;
  QX = a * x0 + b * x1 + c * x2 + d * x3;
  QY = a * y0 + b * y1 + c * y2 + d * y3;
}

// ---- traffic -----------------------------------------------------------------
// states: 0 inbound, 1 in the hold, 2 cleared and crossing to the final, 3 on final, 4 gone around, 5 turned away
function craft(s, h) {
  return { s, h, x: -9, y: -9, al: 1, u: 0, T: 1, m: 1, sx: 0, sy: 0, ex: 0, ey: 0, ph: 0, rad: R0, rj: R0, d: 0, ga: -1, w: 0, g: 0, ok: false };
}
function ring(n) {
  return R0 + DR * min(NLEV - 1, n);
}
function arrive(st) {
  const n0 = st.q[0].length, n1 = st.q[1].length;
  const h = n0 < n1 ? 0 : n1 < n0 ? 1 : rnd(st) < 0.5 ? 0 : 1;
  if (st.q[h].length >= NLEV) {
    // both holds full: it crosses high up on a straight track and leaves
    let n = 0;
    for (const a of st.ac) if (a.s === 5) n++;
    if (n >= 3) return;
    const a = craft(5, 0), side = rnd(st) < 0.5;
    a.sx = side ? -3 : W + 3;
    a.ex = side ? W + 3 : -3;
    a.sy = 3 + 22 * rnd(st);
    a.ey = 3 + 30 * rnd(st);
    a.T = hyp(a.ex - a.sx, a.ey - a.sy) / V;
    st.ac.push(a);
    return;
  }
  const a = craft(0, h);
  // over the top edge, or over the upper part of the side edge its hold is nearer to
  if (rnd(st) < 0.62) (a.sx = (h ? 22 : 4) + 38 * rnd(st)), (a.sy = -3);
  else (a.sx = h ? W + 3 : -3), (a.sy = 2 + 24 * rnd(st));
  st.q[h].push(a);
  // it joins on any ring above its place in the stack and steps in from there
  a.rj = ring(max(st.q[h].length, 1 + floor(3 * rnd(st))));
  hpos(st.hc[h], 0, a.rj);
  a.T = (1.06 * hyp(QX - a.sx, QY - a.sy)) / V;
  st.ac.push(a);
}
// The lowest aircraft of a hold is on the leg that points down the panel. It leaves from where it is if a transit flown from
// here, at the shortest time or stretched, puts it exactly one gap behind the last one cleared. At the end of the leg, with
// nobody ahead to follow, it leaves anyway; with the slot still too far off, it goes round again.
function clear(st, a, end) {
  const hd = st.hc[a.h], gap = (15 * pow(1.7, st.k[3])) / (VF0 * V);
  hpos(hd, min(1, a.ph), a.rad);
  const D = hyp(st.ix - QX, st.iy - QY), L = ARM * D;
  // the shortest transit leaves the hold at V and reaches the final at the final's own speed
  const T0 = (6 * L) / (V * (1 + VF0)), need = st.slot + gap;
  if (need > st.ts + STRETCH * T0 || (need < st.ts + T0 && !end)) return false;
  const arr = max(need, st.ts + T0);
  a.s = 2;
  a.u = 0;
  a.T = arr - st.ts;
  a.ph = min(1, a.ph);
  a.rj = a.rad;
  a.m = cl(2 - (VF0 * V * a.T) / (3 * L), 0.7, 1.6);
  st.slot = arr;
  // the marks on the final slide until one of them sits on this slot
  const e = (arr - st.ref) / st.gd;
  st.sh = (e - floor(e + 0.5)) * st.gd;
  st.q[a.h].shift();
  return true;
}

function move(st, a, dts) {
  const hd = st.hc[a.h], ease = 1 - exp(-dts / 0.3);
  if (a.s === 0) {
    a.u += dts / a.T;
    if (a.u >= 1) {
      a.s = 1;
      a.ph = 0;
      a.rad = a.rj;
    } else {
      hpos(hd, 0, a.rj);
      const jx = QX, jy = QY, L = 0.36 * hyp(jx - a.sx, jy - a.sy);
      const x2 = jx - hd.ax * L, y2 = jy - hd.ay * L, n = L / (hyp(x2 - a.sx, y2 - a.sy) + 1e-6);
      bez(a.sx, a.sy, a.sx + (x2 - a.sx) * n, a.sy + (y2 - a.sy) * n, x2, y2, jx, jy, a.u);
    }
  } else if (a.s === 2) {
    a.u += dts / a.T;
    if (a.u >= 1) {
      a.s = 3;
      a.d = 0;
      a.ga = rnd(st) < 1 / 12 ? LF * (0.4 + 0.2 * rnd(st)) : -1;
    } else {
      hpos(hd, a.ph, a.rj);
      const ex = QX, ey = QY, L = ARM * hyp(st.ix - ex, st.iy - ey), u = a.u * (a.m - (a.m - 1) * a.u);
      bez(ex, ey, ex + hd.ax * L, ey + hd.ay * L, st.ix - st.dx * L, st.iy - st.dy * L, st.ix, st.iy, u);
    }
  } else if (a.s === 4) {
    a.u += dts / a.T;
    if (a.u >= 1) {
      a.s = 1;
      a.ph = 2;
      a.rad = a.rj;
      a.ok = true;
    } else {
      // a wide turn away from the final and up into the foot of the hold's far leg
      const sx = st.ix + st.dx * a.d, sy = st.iy + st.dy * a.d;
      hpos(hd, 2, a.rj);
      const jx = QX, jy = QY, D = hyp(jx - sx, jy - sy), u = a.u * (0.55 + 0.45 * a.u);
      bez(sx, sy, sx + st.dx * 0.28 * D, sy + st.dy * 0.28 * D, jx + hd.ax * 0.36 * D, jy + hd.ay * 0.36 * D, jx, jy, u);
    }
  } else if (a.s === 5) {
    a.u += dts / a.T;
    if (a.u >= 1) a.al = 0;
    QX = a.sx + (a.ex - a.sx) * a.u;
    QY = a.sy + (a.ey - a.sy) * a.u;
  }
  if (a.s === 1) {
    const q = st.q[a.h], i = q.indexOf(a), p0 = a.ph;
    // stepping down: one ring in about a second and a half
    a.rad += cl((ring(i) - a.rad) * (1 - exp(-dts / 0.4)), -2.6 * dts, 2.6 * dts);
    const onLeg = p0 < 1 || (p0 >= 2 && p0 < 3);
    a.ph = p0 + (dts * V) / (onLeg ? hd.leg : PI * a.rad);
    const end = p0 < 1 && a.ph >= 1;
    if (p0 < 1 && i === 0 && a.ok && a.rad - R0 < 1 && clear(st, a, end)) {
      hpos(hd, a.ph, a.rj);
    } else {
      // an arrival flies one whole circuit before it can be cleared
      if (end) a.ok = true;
      if (a.ph >= 4) a.ph -= 4;
      hpos(hd, a.ph, a.rad);
    }
  }
  if (a.s === 3) {
    const was = a.d;
    a.d += dts * V * (VF0 + (VF1 - VF0) * min(1, a.d / LF));
    if (a.ga > 0 && a.d >= a.ga) {
      const h = st.q[0].length <= st.q[1].length ? 0 : 1;
      if (st.q[h].length < NLEV) {
        a.s = 4;
        a.h = h;
        a.u = 0;
        st.q[h].push(a);
        a.rj = ring(max(st.q[h].length, 1 + floor(3 * rnd(st))));
        hpos(st.hc[h], 2, a.rj);
        a.T = (1.28 * hyp(QX - st.ix - st.dx * a.d, QY - st.iy - st.dy * a.d)) / (0.8 * V);
      }
      a.ga = -1;
    }
    if (a.d >= LF) {
      if (was < LF) st.flash = 1;
      a.al = 1 - (a.d - LF) / 2.5;
    }
    QX = st.ix + st.dx * a.d;
    QY = st.iy + st.dy * a.d;
  }
  a.x = QX;
  a.y = QY;
  a.w += ((a.s === 2 || a.s === 3 ? 1 : 0) - a.w) * ease;
  a.g += ((a.s === 4 ? 1 : 0) - a.g) * ease;
}

// What an aircraft is doing is its colour: C is the point, T its long tail.
const C = [0, 0, 0], T = [0, 0, 0];
function tint(st, a) {
  if (a.s === 5) {
    (C[0] = 0.3), (C[1] = 0.37), (C[2] = 0.52);
    (T[0] = 0.13), (T[1] = 0.2), (T[2] = 0.36);
    return;
  }
  // in the hold: blue-white on the lowest ring, dimmer and bluer further out
  const l = cl(((a.s === 1 ? a.rad : a.rj) - R0) / (DR * (NLEV - 1)), 0, 1), e = 1 - 0.3 * l;
  let r = (0.82 - 0.5 * l) * e, g = (0.93 - 0.4 * l) * e, b = e;
  let tr = (0.38 - 0.2 * l) * e, tg = (0.68 - 0.22 * l) * e, tb = e - 0.15 * l;
  // cleared: gold, whiter down the final; its tail is a teal wake
  const w = a.w, q = a.s === 3 ? min(1, a.d / LF) : 0, q2 = q * q;
  r += (1 - r) * w;
  g += (0.66 + 0.24 * q2 - g) * w;
  b += (0.1 + 0.5 * q2 - b) * w;
  tr += (0.1 - tr) * w;
  tg += (0.62 - tg) * w;
  tb += (0.66 - tb) * w;
  // gone around: pink
  const k = a.g;
  r += (1 - r) * k;
  g += (0.2 - g) * k;
  b += (0.72 - b) * k;
  tr += (0.62 - tr) * k;
  tg += (0.08 - tg) * k;
  tb += (0.5 - tb) * k;
  (C[0] = r), (C[1] = g), (C[2] = b);
  (T[0] = tr), (T[1] = tg), (T[2] = tb);
}

// A soft dot, kept where it is brighter than what is there (mode 0) or added (mode 1).
function dot(buf, x, y, r, g, b, sig, add) {
  const x0 = max(0, floor(x - 3)), x1 = min(W - 1, floor(x + 3)), y0 = max(0, floor(y - 3)), y1 = min(H - 1, floor(y + 3));
  const inv = 1 / (2 * sig * sig);
  for (let py = y0; py <= y1; py++) {
    const dy = py + 0.5 - y;
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x, w = exp(-(dx * dx + dy * dy) * inv);
      if (w < 0.03) continue;
      const o = (py * W + px) * 3;
      if (add) (buf[o] += r * w), (buf[o + 1] += g * w), (buf[o + 2] += b * w);
      else {
        if (r * w > buf[o]) buf[o] = r * w;
        if (g * w > buf[o + 1]) buf[o + 1] = g * w;
        if (b * w > buf[o + 2]) buf[o + 2] = b * w;
      }
    }
  }
}

// ---- one step: dtr of real time for the drift and the glow, dts of simulated time for the traffic ----
function step(st, dtr, dts, glow) {
  st.t += dtr;
  st.ts += dts;
  layout(st);
  let n = 0;
  for (const a of st.ac) if (a.s !== 5) n++;
  // arrivals come at random, at the rate the knobs set now; a tighter final draws a little more traffic and a wider one a
  // little less, but less than it lands. The sky is never left empty: under three aircraft at the least Traffic, five at the
  // opening, the next arrival is brought forward.
  const k = st.k[2], mean = MEAN * pow(k > 0 ? 1.8 : 3, -k) * pow(1.7, 0.4 * (st.k[3] - 0.06));
  st.acc += (dts * st.wave) / mean;
  if (n < 5 + 2 * k && (st.due - st.acc) * mean > 1.5) st.due = st.acc + (0.3 + 1.2 * rnd(st)) / mean;
  if (st.acc >= st.due) {
    arrive(st);
    st.acc = 0;
    st.due = 0.25 - 0.75 * log(1 - 0.999 * rnd(st));
  }
  // the marks on the final: one to a slot, a gap apart, flowing down with the traffic
  st.gd += ((15 * pow(1.7, st.k[3])) / (VF0 * V) - st.gd) * (dtr > 0 ? 1 - exp(-dtr / 0.25) : 1);
  const mv = st.sh * (1 - exp(-dts / 1.2));
  st.ref += mv;
  st.sh -= mv;
  st.ref += st.gd * floor((st.ts - st.ref) / st.gd);
  let dead = false;
  for (const a of st.ac) {
    move(st, a, dts);
    if (a.al <= 0) dead = true;
  }
  if (dead) st.ac = st.ac.filter((a) => a.al > 0);
  st.flash *= exp(-dtr / 0.5);
  if (!glow) return;
  // above the opening speed the long glow fades sooner, so a tail keeps its length and never closes a whole ring
  const { G, Wm } = st, fg = exp((-dtr * max(1, st.k[1] / 2)) / TAIL), fw = exp(-dtr / WARM);
  for (let o = 0; o < W * H * 3; o++) (G[o] *= fg), (Wm[o] *= fw);
  for (const a of st.ac) {
    tint(st, a);
    const al = a.al;
    dot(G, a.x, a.y, T[0] * al, T[1] * al, T[2] * al, 1.3, 0);
    if (a.w > 0.05) {
      const v = 0.8 * a.w * al;
      dot(Wm, a.x, a.y, C[0] * v, C[1] * v, C[2] * v, 1.05, 0);
    }
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], cl(kv[1], 0.25, 4), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  const rate = 0.5 * st.k[1];
  if (!st.init) {
    st.init = true;
    st.seed = floor(Math.random() * 4294967296) | 0;
    for (let i = 0; i < 25; i++) st.ph.push(TAU * rnd(st));
    // the waves of traffic start a little above their mean, on the way up
    st.ph[23] = st.ph[24] = 0.25;
    // fill the sky as the knobs say before the first frame: 90 s of traffic, then the last moments with the glow
    st.t = -2.4;
    for (let i = 0; i < 900; i++) step(st, 0, 0.1, false);
    for (let i = 0; i < 60; i++) step(st, 0.04, 0.04 * rate, true);
  }
  const d = cl(dt || 0, 0, 0.1);
  step(st, d, d * rate, true);
}

// ---- drawing -----------------------------------------------------------------
const soft = (d) => (d < 0.8 ? 1 : d > 1.6 ? 0 : (1.6 - d) / 0.8); // a line 2 LED wide with soft sides

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { F, G, Wm } = st;
  // the ground: a navy too dark for the panel to light, then the glow
  for (let o = 0; o < W * H * 3; o += 3) {
    F[o] = 0.012 + G[o] + Wm[o];
    F[o + 1] = 0.026 + G[o + 1] + Wm[o + 1];
    F[o + 2] = 0.066 + G[o + 2] + Wm[o + 2];
  }
  // the lowest ring of each hold
  for (let h = 0; h < 2; h++) {
    const hd = st.hc[h], hl = hd.hl, ex = (hd.ax < 0 ? -hd.ax : hd.ax) * hl + R0 + 2, ey = hd.ay * hl + R0 + 2;
    const x0 = max(0, floor(hd.x - ex)), x1 = min(W - 1, floor(hd.x + ex)), y0 = max(0, floor(hd.y - ey)), y1 = min(H - 1, floor(hd.y + ey));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - hd.x, py = y + 0.5 - hd.y, u = px * hd.ax + py * hd.ay, v = px * hd.bx + py * hd.by;
        const du = u - cl(u, -hl, hl), d = hyp(du, v) - R0, w = soft(d < 0 ? -d : d);
        if (w <= 0) continue;
        const o = (y * W + x) * 3;
        (F[o] += 0.04 * w), (F[o + 1] += 0.105 * w), (F[o + 2] += 0.175 * w);
      }
    }
  }
  // the final's centre line and the bar at the threshold
  {
    const { ix, iy, tx, ty, dx, dy } = st, fl = 0.72 + 0.28 * st.flash;
    const x0 = max(0, floor(min(ix, tx) - 7)), x1 = min(W - 1, floor(max(ix, tx) + 7));
    for (let y = max(0, floor(iy - 3)); y < H; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ix, py = y + 0.5 - iy, s = px * dx + py * dy, c = px * dy - py * dx;
        const o = (y * W + x) * 3, ds = s - cl(s, 0, LF);
        let w = cl((1.85 - hyp(ds, c)) / 0.8, 0, 1);
        if (w > 0) {
          // when whoever is here came onto the final, counted in gaps: a mark is lit about each whole number
          const q = 1 - (s - ds) * FK, e = (st.ts + log(q) / FR - st.ref) / st.gd, p = e - floor(e + 0.5);
          // where the marks would come closer than about 7 LED the line is left whole
          w *= 1 - cl((st.gd * V * VF0 * q - 6) / 3, 0, 1) * (1 - cl((0.41 - (p < 0 ? -p : p)) / 0.1, 0, 1));
          (F[o] += 0.045 * w), (F[o + 1] += 0.175 * w), (F[o + 2] += 0.21 * w);
        }
        const bs = s - LF, b = cl(5.3 - (c < 0 ? -c : c), 0, 1) * cl((1.7 - (bs < 0 ? -bs : bs)) / 0.7, 0, 1) * fl;
        if (b > 0) (F[o] += 0.5 * b), (F[o + 1] += b), (F[o + 2] += 0.7 * b);
      }
    }
  }
  // the aircraft
  for (const a of st.ac) {
    tint(st, a);
    dot(F, a.x, a.y, C[0] * a.al, C[1] * a.al, C[2] * a.al, 1.12, 1);
  }
  // the hue knob turns every colour about the grey axis
  const th = TAU * (st.k[0] + st.hue), c = cos(th), s = sin(th) / sqrt(3), m0 = c + (1 - c) / 3, m1 = (1 - c) / 3 - s, m2 = (1 - c) / 3 + s;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, r = F[o], g = F[o + 1], b = F[o + 2];
      const R = m0 * r + m1 * g + m2 * b, Gn = m2 * r + m0 * g + m1 * b, B = m1 * r + m2 * g + m0 * b;
      display.setPixel(x, y, R < 0 ? 0 : R > 1 ? 255 : floor(R * 255 + 0.5), Gn < 0 ? 0 : Gn > 1 ? 255 : floor(Gn * 255 + 0.5), B < 0 ? 0 : B > 1 ? 255 : floor(B * 255 + 0.5));
    }
  }
}
