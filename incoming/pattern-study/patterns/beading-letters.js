// ===== Patternflow pattern =====
// Title:   Beading Letters
// Family:  type
// Idea:    A three-letter word stacked down the panel in capitals 37 rows tall is poured stroke by stroke as round glossy threads of liquid, and every thread then does what Plateau and Rayleigh showed a cylinder of liquid must do: a ripple about nine and a half radii long grows on it from almost nothing, the strokes neck and pinch off roughly in the order they were poured, and each breaks into evenly spaced drops with a small satellite between them that ring and round off, so the word stands as a dotted, dot-matrix version of itself until the drops run off the bottom and the next word is poured.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Plateau-Rayleigh instability (Joseph Plateau, 1873; Lord Rayleigh, 1878), with the viscous term of Weber's long-wave equation (Constantin Weber, 1931) and the ringing of a drop in Rayleigh's lowest shape mode (Lord Rayleigh, 1879) damped at the rate Horace Lamb gave for a viscous drop; capitals drawn for this pattern as lines and elliptical arcs, pattern round 81
// Round:   81
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Thickness=1.5..2.5, Viscosity=0..1
//
// Knob 1: Hue. The liquid's colour, turned round the wheel from cyan at 0: violet at 0.25, red at 0.5, yellow green at 0.75. The highlight on every thread and drop stays white, and the caustic beside it is the liquid's colour paled.
// Knob 2: Speed. At 2 DEW is poured in 1.7 s, its first stroke breaks at 2.3 s and its last at 3.6 s, the dotted word holds 2 s, and at 5.6 s the drops let go and run off the bottom while INK is poured from 5.8 s. Every time goes as 2 / Speed, ten times slower at 0.2 and one and a half times faster at 3.
// Knob 3: Thickness. The thread's radius in LEDs, from 1.5 at the opening (a thread 3 LEDs across) to 2.5. The fastest ripple is 14.4 LEDs long at 1.5 and 24 at 2.5, so the stem of the D breaks into four drops at 1.5 and keeps only its two corner drops at 2.5, and a drop from the middle of a stroke grows from 5.5 LEDs across to about 9.5. A thicker thread is also slower, as the radius to the power 1.5: at 2.5 everything takes 2.15 times as long.
// Knob 4: Viscosity. The Ohnesorge number, the liquid's viscosity against its surface tension at this size, from 0 to 1. The fastest ripple is 9.02 radii long at 0, 9.6 at the opening 0.06 and 16.1 at 1, so a thicker liquid breaks into fewer, bigger drops, 2.7 times more slowly, and its threads draw out into thin filaments between bulbs before they snap. At the opening a drop rings about once every 0.83 s and the ringing falls by e in 1.7 s; from about 0.8 the drops creep round without ringing.

// Plateau measured it and Rayleigh explained it: a long cylinder of liquid
// held only by surface tension is unstable. Any ripple r = r0 (1 + a cos kz)
// longer than the thread's circumference (k r0 < 1) lowers the surface area
// at fixed volume, so it grows, as a = a0 exp(sigma t). Rayleigh's growth
// rate for an inviscid thread, in units of tau = sqrt(rho r0^3 / gamma), is
//   sigma^2 = x (1 - x^2) I1(x) / I0(x),   x = k r0,
// largest at x = 0.697, a wavelength of 9.02 radii, with sigma = 0.343.
// Viscosity enters through Weber's long-wave equation, which adds a damping
// term 3 Oh x^2 sigma to the left; here that term is added to Rayleigh's
// exact right-hand side, so Oh = 0 gives Rayleigh's numbers back.
//
// Each stroke of a letter is a thread of length L with free ends. Its modes
// are cos(2 pi n s / L), with a crest at both ends (a free end gathers
// liquid), and of the whole numbers n the stroke takes the one whose sigma
// is largest: the fastest ripple that fits. Its crests are where the drops
// form, so a stroke always ends in a drop and every corner of a letter, where
// strokes meet, gets one drop that all of them feed; it forms as soon as the
// first of them breaks, as a bulb on the ends of the others. The ripple grows
// from a small random a0, 0.012 to 0.03, from the moment the liquid is laid,
// so the word pinches roughly in the order it was poured. The volume per
// wavelength is kept: r0 shrinks as a grows, and each drop gets the volume of
// the thread it came from, a free end the volume of a whole wavelength. With
// viscosity the profile is sharpened into bulbs on thin filaments.
//
// After a pinch each drop starts stretched along its stroke and relaxes as a
// spheroid of fixed volume, ringing in Rayleigh's lowest shape mode, omega^2
// = 8 gamma / (rho R^3), damped at Lamb's rate 5 nu / R^2. A small satellite
// is left where each neck broke.
//
// Every thread and drop is drawn as a body of revolution: for each LED the
// nearest point of the stroke, its arc length s and the side the LED is on
// give a surface normal, which a light from the upper left shades with a
// white highlight and a glow on the far side, as light passes through.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sqrt, sin, cos, exp, log, pow, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const WORDS = ["DEW", "INK", "OIL", "SEA", "WET", "SAP", "TAR", "GEL"];
// Letters 37 rows tall, 8 units of 4.625 LEDs, at rows 3, 45.5 and 88.
const LH = 37, U = LH / 8, TOP = 3, PITCH = 42.5;
// Model seconds (real seconds at Speed 2).
const POUR = 1.2, JUMP = 0.05, HOLD = 2.0, NEXT = 0.25, FALL = 520, TAU0 = 0.15, R0REF = 1.5;
const HUE0 = 0.5;

// Strokes: a start point, then "L" x y for a line or "A" cx cy rx ry a0 a1
// for an elliptical arc in degrees (y down); "Z" closes the stroke.
// All joins between strokes are at stroke ends.
const GLYPHS = {
  D: [10, [[0, 0, "L", 0, 8], [0, 0, "L", 5, 0, "A", 5, 4, 5, 4, -90, 90, "L", 0, 8]]],
  E: [9, [[0, 0, "L", 0, 4], [0, 4, "L", 0, 8], [0, 0, "L", 9, 0], [0, 4, "L", 7, 4], [0, 8, "L", 9, 8]]],
  W: [11, [[0, 0, "L", 2.75, 8], [2.75, 8, "L", 5.5, 1.5], [5.5, 1.5, "L", 8.25, 8], [8.25, 8, "L", 11, 0]]],
  I: [6, [[0, 0, "L", 3, 0], [3, 0, "L", 6, 0], [3, 0, "L", 3, 8], [0, 8, "L", 3, 8], [3, 8, "L", 6, 8]]],
  N: [9, [[0, 8, "L", 0, 0], [0, 0, "L", 9, 8], [9, 8, "L", 9, 0]]],
  K: [9, [[0, 0, "L", 0, 4.5], [0, 4.5, "L", 0, 8], [0, 4.5, "L", 9, 0], [0, 4.5, "L", 9, 8]]],
  O: [10, [[10, 4, "A", 5, 4, 5, 4, 0, 360, "Z"]]],
  L: [8, [[0, 0, "L", 0, 8], [0, 8, "L", 8, 8]]],
  S: [9, [[8.397, 1, "A", 4.5, 2, 4.5, 2, -30, -270, "A", 4.5, 6, 4.5, 2, -90, 150]]],
  A: [10, [[0, 8, "L", 1.5625, 5.5], [1.5625, 5.5, "L", 5, 0], [5, 0, "L", 8.4375, 5.5], [8.4375, 5.5, "L", 10, 8], [1.5625, 5.5, "L", 8.4375, 5.5]]],
  T: [10, [[0, 0, "L", 5, 0], [5, 0, "L", 10, 0], [5, 0, "L", 5, 8]]],
  P: [9, [[0, 0, "L", 0, 4.6], [0, 4.6, "L", 0, 8], [0, 0, "L", 5, 0, "A", 5, 2.3, 4, 2.3, -90, 90, "L", 0, 4.6]]],
  R: [9, [[0, 0, "L", 0, 4.6], [0, 4.6, "L", 0, 8], [0, 0, "L", 5, 0, "A", 5, 2.3, 4, 2.3, -90, 90], [5, 4.6, "L", 0, 4.6], [5, 4.6, "L", 9, 8]]],
  G: [10, [[8.83, 1.429, "A", 5, 4, 5, 4, -40, -360], [10, 4, "L", 6, 4]]],
};

// ---- Rayleigh's growth rate with Weber's viscous term.
function besselRatio(x) {
  let t0 = 1, t1 = x / 2, i0 = 0, i1 = 0;
  const h = (x * x) / 4;
  for (let k = 0; k < 10; k++) {
    i0 += t0;
    i1 += t1;
    t0 *= h / ((k + 1) * (k + 1));
    t1 *= h / ((k + 1) * (k + 2));
  }
  return i1 / i0;
}

function growth(x, oh) {
  if (x >= 1) return 0;
  const f = x * (1 - x * x) * besselRatio(x), b = 3 * oh * x * x;
  return (-b + sqrt(b * b + 4 * f)) / 2;
}

// ---- Stroke geometry, in LEDs.
function strokeOf(cmd, ox, oy) {
  const xs = [ox + cmd[0] * U], ys = [oy + cmd[1] * U];
  let closed = false;
  for (let i = 2; i < cmd.length; ) {
    const c = cmd[i];
    if (c === "L") {
      xs.push(ox + cmd[i + 1] * U);
      ys.push(oy + cmd[i + 2] * U);
      i += 3;
    } else if (c === "A") {
      const cx = cmd[i + 1], cy = cmd[i + 2], rx = cmd[i + 3], ry = cmd[i + 4], a0 = (cmd[i + 5] * PI) / 180, a1 = (cmd[i + 6] * PI) / 180;
      const steps = max(4, ceil((abs(a1 - a0) * sqrt((rx * rx + ry * ry) / 2) * U) / 0.8));
      for (let k = 0; k <= steps; k++) {
        const a = a0 + ((a1 - a0) * k) / steps;
        xs.push(ox + (cx + rx * cos(a)) * U);
        ys.push(oy + (cy + ry * sin(a)) * U);
      }
      i += 7;
    } else {
      closed = true;
      i++;
    }
  }
  // Drop repeated points, measure arc length.
  const px = [xs[0]], py = [ys[0]], ps = [0];
  for (let k = 1; k < xs.length; k++) {
    const d = sqrt((xs[k] - px[px.length - 1]) ** 2 + (ys[k] - py[py.length - 1]) ** 2);
    if (d < 1e-4) continue;
    px.push(xs[k]);
    py.push(ys[k]);
    ps.push(ps[ps.length - 1] + d);
  }
  return { px, py, ps, L: ps[ps.length - 1], closed };
}

// Point and unit tangent at arc length s.
function at(st, s, o) {
  const { px, py, ps } = st;
  let i = 0;
  while (i < ps.length - 2 && ps[i + 1] < s) i++;
  const len = ps[i + 1] - ps[i], u = cl((s - ps[i]) / len, 0, 1);
  o[0] = px[i] + (px[i + 1] - px[i]) * u;
  o[1] = py[i] + (py[i + 1] - py[i]) * u;
  o[2] = (px[i + 1] - px[i]) / len;
  o[3] = (py[i + 1] - py[i]) / len;
  return o;
}

function wordOf(index) {
  const text = WORDS[index], strokes = [];
  for (let l = 0; l < text.length; l++) {
    const [w, cmds] = GLYPHS[text[l]];
    const ox = 32 - (w * U) / 2, oy = TOP + l * PITCH;
    for (const c of cmds) {
      const st = strokeOf(c, ox, oy);
      st.letter = l;
      st.eps = 0.012 + 0.018 * Math.random();
      st.envP = TAU * Math.random();
      strokes.push(st);
    }
  }
  return { index, strokes, beads: [], sats: [], S0: 0, Td: 1e9 };
}

// ---- Timing and drops for the current knobs: the mode each stroke takes,
// when it pinches, and the drops it leaves.
function plan(S, wd) {
  const r0 = S.r0, oh = S.oh, tau = TAU0 * pow(r0 / R0REF, 1.5);
  let total = 0;
  for (const st of wd.strokes) total += st.L;
  const v = total / POUR, tmp = [0, 0, 0, 0];
  // The fastest growth an endless thread could have, for the floor below.
  let smax = 0;
  for (let x = 0.02; x < 1; x += 0.01) smax = max(smax, growth(x, oh));
  let t = wd.S0;
  wd.beads = [];
  wd.sats = [];
  const nodes = [];
  for (const st of wd.strokes) {
    let best = -1, bn = st.closed ? 2 : 1;
    for (let n = st.closed ? 2 : 1; n < 40; n++) {
      const g = growth((TAU * n * r0) / st.L, oh);
      if (g > best) {
        best = g;
        bn = n;
      }
      if ((TAU * n * r0) / st.L >= 1) break;
    }
    st.n = bn;
    st.k = (TAU * bn) / st.L;
    // A stroke too short for a fast ripple (at 2.5 LEDs the serif of the I
    // has k r0 >= 1 for every n) still balls up into its end drops, here at
    // no less than 0.6 of the fastest rate.
    st.sig = max(best, 0.6 * smax);
    st.tau = tau;
    st.v = v;
    st.r0 = r0;
    st.t0 = t;
    st.t1 = t + st.L / v;
    // A slow swell 2.7 wavelengths long lets some crests grow ahead of others.
    st.envK = TAU / (2.7 * 9.6 * r0);
    st.tp = max(st.t1 + 0.2, t + st.L / (2 * v) + (tau * log(1 / st.eps)) / st.sig);
    t = st.t1 + JUMP;
    const vol = PI * r0 * r0 * (st.L / bn);
    const first = st.closed ? 0 : 1;
    for (let k = first; k < bn; k++) {
      at(st, (k * st.L) / bn, tmp);
      wd.beads.push({ x: tmp[0], y: tmp[1], tx: tmp[2], ty: tmp[3], V: vol, act: st.tp, e0: 0.5 });
    }
    for (let k = 0; k < bn; k++) {
      at(st, ((k + 0.5) * st.L) / bn, tmp);
      wd.sats.push({ x: tmp[0], y: tmp[1], act: st.tp + 0.04, fall: 0 });
    }
    if (!st.closed)
      for (const e of [0, 1]) {
        at(st, e * st.L, tmp);
        let node = null;
        for (const nd of nodes) if (nd.letter === st.letter && abs(nd.x - tmp[0]) < 0.6 && abs(nd.y - tmp[1]) < 0.6) node = nd;
        if (!node) {
          node = { letter: st.letter, x: tmp[0], y: tmp[1], tx: tmp[2], ty: tmp[3], V: 0, act: 1e9, m: 0, e0: 0.2 };
          nodes.push(node);
        }
        node.V += vol / 2;
        node.m++;
        node.act = min(node.act, st.tp);
      }
  }
  // A free end gathers the liquid of the end it retracts from.
  for (const nd of nodes) {
    if (nd.m === 1) nd.V *= 2;
    wd.beads.push(nd);
  }
  let last = 0;
  for (const st of wd.strokes) last = max(last, st.tp);
  for (const b of wd.beads) {
    b.R = Math.cbrt((3 * b.V) / (4 * PI));
    const q = r0 / b.R;
    b.w = sqrt(8 * q * q * q) / tau;
    b.g = (5 * oh * q * q) / tau;
    b.fall = b.fall || 0;
    last = max(last, b.act);
  }
  wd.Td = last + HOLD;
  wd.v = v;
  wd.Q = 1 + 2 * oh;
  // Means of the sharpened profile c' over a period, for the volume.
  let m1 = 0, m2 = 0;
  for (let i = 0; i < 64; i++) {
    const c = 2 * pow((1 + cos((TAU * (i + 0.5)) / 64)) / 2, wd.Q) - 1;
    m1 += c / 64;
    m2 += (c * c) / 64;
  }
  wd.m1 = m1;
  wd.m2 = m2;
}

// ---- For every LED near a stroke, the nearest point of up to two strokes.
function buildMap(S, wd) {
  const reach = (S.reach = 2.2 * S.r0 + 1.2);
  const { sj, sd, ss, sdx, sdy, stx, sty, scap } = S;
  sj.fill(-1);
  wd.strokes.forEach((st, j) => {
    const { px, py, ps } = st, last = px.length - 2;
    for (let i = 0; i <= last; i++) {
      const ax = px[i], ay = py[i], len = ps[i + 1] - ps[i];
      const tx = (px[i + 1] - ax) / len, ty = (py[i + 1] - ay) / len;
      const x0 = max(0, floor(min(ax, px[i + 1]) - reach)), x1 = min(W - 1, ceil(max(ax, px[i + 1]) + reach));
      const y0 = max(0, floor(min(ay, py[i + 1]) - reach)), y1 = min(H - 1, ceil(max(ay, py[i + 1]) + reach));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const qx = x + 0.5 - ax, qy = y + 0.5 - ay;
          let t = qx * tx + qy * ty, cap = 0;
          if (t < 0) {
            if (!st.closed && i === 0) cap = 1;
            t = 0;
          } else if (t > len) {
            if (!st.closed && i === last) cap = 1;
            t = len;
          }
          let dx = qx - tx * t, dy = qy - ty * t;
          const d = sqrt(dx * dx + dy * dy);
          if (d > reach) continue;
          if (d > 1e-6) {
            dx /= d;
            dy /= d;
          } else {
            dx = -ty;
            dy = tx;
          }
          const p = (y * W + x) * 2;
          let k = -1;
          if (sj[p] === j) k = d < sd[p] ? p : -2;
          else if (sj[p + 1] === j) k = d < sd[p + 1] ? p + 1 : -2;
          else if (sj[p] < 0) k = p;
          else if (sj[p + 1] < 0) k = p + 1;
          else k = sd[p] > sd[p + 1] ? (d < sd[p] ? p : -2) : d < sd[p + 1] ? p + 1 : -2;
          if (k < 0) continue;
          sj[k] = j;
          sd[k] = d;
          ss[k] = ps[i] + t;
          sdx[k] = dx;
          sdy[k] = dy;
          stx[k] = tx;
          sty[k] = ty;
          scap[k] = cap;
        }
    }
  });
  let n = 0;
  for (let p = 0; p < N; p++) if (sj[p * 2] >= 0) S.active[n++] = p;
  S.nActive = n;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, r0: 1.5, oh: 0.06, m: 0, idx: 0, cur: null, old: null, reach: 4.5,
    sj: new Int16Array(N * 2), sd: new Float32Array(N * 2), ss: new Float32Array(N * 2),
    sdx: new Float32Array(N * 2), sdy: new Float32Array(N * 2), stx: new Float32Array(N * 2),
    sty: new Float32Array(N * 2), scap: new Int8Array(N * 2), active: new Int32Array(N), nActive: 0,
    K: new Float32Array(N), C: new Float32Array(N), NX: new Float32Array(N), NY: new Float32Array(N), NZ: new Float32Array(N),
    CA: new Float32Array(N), CB: new Float32Array(N),
    base: [0, 0, 0], tmp: [0, 0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1.5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const r0 = cl(k[2] == null ? 1.5 : k[2], 1.5, 2.5), oh = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const newR = abs(r0 - S.r0) > 0.004, newOh = abs(oh - S.oh) > 0.002;
  if (newR) S.r0 = r0;
  if (newOh) S.oh = oh;
  if (!S.cur) {
    S.cur = wordOf(S.idx);
    S.cur.S0 = 0;
    plan(S, S.cur);
    buildMap(S, S.cur);
  } else if (newR || newOh) {
    plan(S, S.cur);
    if (newR) buildMap(S, S.cur);
  }
  S.m += (d * S.speed) / 2;
  const cur = S.cur;
  if (S.m >= cur.Td) {
    // The drops let go and run off the bottom; the next word is poured.
    for (const b of cur.beads) b.fall = cur.Td + 0.35 * Math.random();
    for (const b of cur.sats) b.fall = cur.Td + 0.35 * Math.random();
    S.old = cur;
    S.idx = (S.idx + 1) % WORDS.length;
    const nw = wordOf(S.idx);
    nw.S0 = cur.Td + NEXT;
    plan(S, nw);
    buildMap(S, nw);
    S.cur = nw;
  }
  if (S.old && S.m > S.old.Td + 1.2) S.old = null;
}

// The radius of stroke st at arc length s, and its slope, at model time t.
function profile(wd, st, s, t, o) {
  let a = st.eps * exp((st.sig * (t - st.t0 - s / st.v)) / st.tau);
  a *= 1 + 0.15 * sin(st.envK * s + st.envP);
  if (a > 1) a = 1;
  const ph = st.k * s, base = (1 + cos(ph)) / 2, bq = pow(base, wd.Q - 1);
  const c = 2 * base * bq - 1, den = st.r0 / sqrt(1 + 2 * a * wd.m1 + a * a * wd.m2);
  o[0] = den * (1 + a * c);
  o[1] = den * a * -wd.Q * bq * sin(ph) * st.k;
}

function wobble(b, t) {
  const e0 = b.e0, w = b.w, g = b.g;
  if (g < w * 0.999) {
    const wd = sqrt(w * w - g * g);
    return e0 * exp(-g * t) * (cos(wd * t) + (g / wd) * sin(wd * t));
  }
  const r = sqrt(max(1e-9, g * g - w * w)), r1 = -g + r, r2 = -g - r;
  return (e0 * (r1 * exp(r2 * t) - r2 * exp(r1 * t))) / (r1 - r2);
}

// A spheroid of semi-axes a along (tx, ty) and b across and up, into the
// buffers: the topmost surface wins each LED.
function spheroid(S, cx, cy, tx, ty, a, b) {
  const { K, C, NX, NY, NZ } = S, ext = max(a, b) + 1;
  const x0 = max(0, floor(cx - ext)), x1 = min(W - 1, ceil(cx + ext)), y0 = max(0, floor(cy - ext)), y1 = min(H - 1, ceil(cy + ext));
  const ia = 1 / (a * a), ib = 1 / (b * b);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5 - cx, qy = y + 0.5 - cy, u = qx * tx + qy * ty, w = -qx * ty + qy * tx;
      const q = u * u * ia + w * w * ib, sq = sqrt(q), gx = u * ia, gy = w * ib, g = sqrt(gx * gx + gy * gy);
      const c = g < 1e-9 ? 1 : cl(0.5 - ((sq - 1) * sq) / g, 0, 1);
      if (c <= 0) continue;
      const h = q < 1 ? b * sqrt(1 - q) : 0, key = h + c, p = y * W + x;
      if (c > C[p]) C[p] = c;
      if (key <= K[p]) continue;
      K[p] = key;
      let nx = gx * tx - gy * ty, ny = gx * ty + gy * tx, nz = h * ib;
      const l = sqrt(nx * nx + ny * ny + nz * nz) || 1;
      NX[p] = nx / l;
      NY[p] = ny / l;
      NZ[p] = nz / l;
    }
}

function drops(S, wd, t) {
  for (const b of wd.beads) {
    if (t < b.act) continue;
    let e = cl(wobble(b, t - b.act), -0.45, 1), tx = b.tx, ty = b.ty, y = b.y;
    if (b.fall && t > b.fall) {
      const f = t - b.fall;
      y += 0.5 * FALL * f * f;
      e = min(0.6, FALL * f * 0.004);
      tx = 0;
      ty = 1;
    }
    if (y - b.R * 2 > H) continue;
    spheroid(S, b.x, y, tx, ty, b.R * (1 + e), b.R / sqrt(1 + e));
  }
  const rs = 0.4 * S.r0;
  for (const sa of wd.sats) {
    if (t < sa.act) continue;
    let y = sa.y;
    if (sa.fall && t > sa.fall) y += 0.5 * FALL * (t - sa.fall) ** 2;
    if (y - 2 > H) continue;
    const grow = cl((t - sa.act) / 0.15, 0, 1);
    spheroid(S, sa.x, y, 1, 0, rs * grow + 0.01, rs * grow + 0.01);
  }
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The light: from the upper left and in front.
const LX = -0.45, LY = -0.6, LZ = 0.66, LN = sqrt(LX * LX + LY * LY + LZ * LZ);
const lx = LX / LN, ly = LY / LN, lz = LZ / LN, HN = sqrt(lx * lx + ly * ly + (lz + 1) ** 2);
const hx = lx / HN, hy = ly / HN, hz = (lz + 1) / HN, LP = sqrt(lx * lx + ly * ly);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cur) return;
  const { K, C, NX, NY, NZ, sj, sd, ss, sdx, sdy, stx, sty, scap, active } = S;
  const t = S.m, wd = S.cur, reach = S.reach, pr = [0, 0], head = S.tmp;
  K.fill(-1);
  C.fill(0);

  // Where each stroke of the current word stands: 0 not poured yet, 1 being
  // poured (head = arc length reached), 2 a thread, 3 broken into drops.
  for (const st of wd.strokes) {
    st.state = t < st.t0 ? 0 : t < st.t1 ? 1 : t < st.tp ? 2 : 3;
    if (st.state === 1) {
      st.head = (t - st.t0) * st.v;
      at(st, st.head, head);
      st.hx = head[0];
      st.hy = head[1];
    }
  }

  for (let a = 0; a < S.nActive; a++) {
    const p = active[a], X = (p % W) + 0.5, Y = floor(p / W) + 0.5;
    for (let q = p * 2; q < p * 2 + 2; q++) {
      const j = sj[q];
      if (j < 0) break;
      const st = wd.strokes[j];
      if (st.state === 0 || st.state === 3) continue;
      let s = ss[q], dist = sd[q], dx = sdx[q], dy = sdy[q], cap = scap[q];
      if (st.state === 1 && s > st.head) {
        if (s - st.head > reach) continue;
        dx = X - st.hx;
        dy = Y - st.hy;
        dist = sqrt(dx * dx + dy * dy);
        if (dist > reach) continue;
        if (dist > 1e-6) {
          dx /= dist;
          dy /= dist;
        }
        s = st.head;
        cap = 1;
      }
      profile(wd, st, s, t, pr);
      const r = pr[0], dr = cap ? 0 : pr[1];
      if (r < 0.03) continue;
      const c = min(1, r - dist + 0.5);
      if (c <= 0) continue;
      const h = dist < r ? sqrt(r * r - dist * dist) : 0, key = h + c;
      if (c > C[p]) C[p] = c;
      if (key <= K[p]) continue;
      K[p] = key;
      const ct = min(1, dist / r);
      let nx = -dr * stx[q] + ct * dx, ny = -dr * sty[q] + ct * dy, nz = h / r;
      const l = sqrt(nx * nx + ny * ny + nz * nz) || 1;
      NX[p] = nx / l;
      NY[p] = ny / l;
      NZ[p] = nz / l;
    }
  }
  drops(S, wd, t);
  if (S.old) drops(S, S.old, t);

  // The caustic: light through each thread or drop comes to a focus on the
  // dark ground beyond it, down and to the right, brightest behind the
  // thickest liquid. Shifted 1.5 and 2 LEDs, then softened once.
  const { CA, CB } = S;
  CA.fill(0);
  for (let p = 0; p < N; p++) {
    const c = C[p];
    if (c <= 0) continue;
    const x = p % W, y = floor(p / W) + 2;
    if (y >= H || x + 2 >= W) continue;
    const w = c * (0.09 + 0.28 * NZ[p]) * 0.5;
    CA[y * W + x + 1] += w;
    CA[y * W + x + 2] += w;
  }
  for (let p = 0; p < N; p++) {
    const x = p % W;
    let v = CA[p] * 0.6;
    if (x > 0) v += CA[p - 1] * 0.1;
    if (x < W - 1) v += CA[p + 1] * 0.1;
    if (p >= W) v += CA[p - W] * 0.1;
    if (p < N - W) v += CA[p + W] * 0.1;
    CB[p] = min(0.4, v);
  }

  const base = hsv(S.hue + HUE0, 0.8, 1, S.base);
  const kr = base[0] * 0.8 + 0.2, kg = base[1] * 0.8 + 0.2, kb = base[2] * 0.8 + 0.2;
  for (let p = 0; p < N; p++) {
    const c = C[p], ca = CB[p] * (1 - c);
    let r = ca * kr, g = ca * kg, b = ca * kb;
    if (c > 0) {
      const nx = NX[p], ny = NY[p], nz = NZ[p];
      const diff = max(0, nx * lx + ny * ly + nz * lz);
      const sh = max(0, nx * hx + ny * hy + nz * hz), spec = pow(sh, 28);
      const back = max(0, -(nx * lx + ny * ly) / LP) * (1 - nz);
      const v = 0.22 + 0.62 * diff + 0.5 * back;
      r += c * (base[0] * v + spec);
      g += c * (base[1] * v + spec);
      b += c * (base[2] * v + spec);
    }
    display.setPixel(p % W, floor(p / W), floor(cl(r, 0, 1) * 255), floor(cl(g, 0, 1) * 255), floor(cl(b, 0, 1) * 255));
  }
}
