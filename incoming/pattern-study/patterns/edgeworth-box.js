// ===== Patternflow pattern =====
// Title:   Edgeworth Box
// Family:  exchange
// Idea:    The panel is the box two people share two goods in: the coral region and the blue region are what each would rather have than the point they hold, the pale lens where the two overlap is every trade both would agree to, and the point zigzags into it one trade after another until the lens closes, and then tastes drift, a new endowment arrives and it opens again.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the exchange of two goods between two traders and its contract curve (Edgeworth 1881, from memory), drawn as a box with one origin in each corner (Pareto 1906, from memory); indifference curves and the lens of trades that leave both better off, textbook results; the CES utility (Arrow, Chenery, Minhas and Solow 1961, from memory) with Cobb-Douglas as its limit; trading in small steps at prices between the two marginal rates of substitution, without an auctioneer (Uzawa 1962 and Hahn 1962, from memory). Original here: utility measured as the place a curve crosses the diagonal, terraces counted from the curve through the point held, a price that favours one trader and then the other, the taste difference tempered as the goods turn into substitutes so the contract curve stays inside the box, the shocks and the wanders, the colours and the drawing, pattern round 246
// Round:   248
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..4, Curve=-1..1, Taste=-1..1
//
// Knob 1: Hue. Turns both people's colours round the wheel. It opens with A coral, rising from the bottom left corner, against B blue, rising from the top right, the lens between them pale and near white, and the ground neither wants a dim blue violet.
// Knob 2: Pace. 0.5 to 4, opening at 2: how fast they trade and how often a new endowment arrives. At 0.5 a trade comes every 1.8 s and the lens stays open for most of a minute's quarter. At 4 the zigzag runs to the contract curve in about two seconds and the next endowment is 5 to 11 s away.
// Knob 3: Curve. -1 to 1, opening at 0: how the two goods stand in for each other. At -1 they are complements, every curve is a sharp elbow and the lens is a small kinked shape. At 0 the curves are smooth hyperbolas. At 1 they are nearly straight lines and the lens is a long thin sliver.
// Knob 4: Taste. -1 to 1, opening at 0.06: how differently the two value the goods. At 0 they agree and the contract curve is the diagonal. Toward 1 A wants the first good and B the second, the two families of curves lean apart and the contract curve bows into the bottom right corner. Toward -1 it bows into the top left.

const W = 64, H = 128;
const { floor, min, max, sqrt, exp, log, sin, cos, pow, abs, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const NS = 7;                  // terraces from one corner of the box to the other
const MX = 4 / W, MY = 4 / H;  // the point stays 4 LED inside the box
const TRADE = 0.9;             // seconds between trades at pace 1
const LIFE = 3;                // how long a trade's segment stays lit, on the clock the endowments run on
const WB = 0.48, WS = 0.07;    // a wash at the curve through the point, and what each terrace above it adds
const D0 = 0.13, DS = 0.028;   // the ground below the curve, and what each terrace below it takes away
const COLA = [1, 0.46, 0.4], COLB = [0.22, 0.48, 1];
const DIMA = [0.7, 0.28, 0.9], DIMB = [0.15, 0.55, 0.95];

// A colour turned about the grey axis.
function turn(c, th, out, o) {
  const cs = cos(th), sn = sin(th) / sqrt(3), k = (1 - cs) / 3;
  out[o] = max(0, c[0] * (cs + k) + c[1] * (k - sn) + c[2] * (k + sn));
  out[o + 1] = max(0, c[0] * (k + sn) + c[1] * (cs + k) + c[2] * (k - sn));
  out[o + 2] = max(0, c[0] * (k - sn) + c[1] * (k + sn) + c[2] * (cs + k));
}

// The pattern keeps its own random stream, started from Math.random once.
function rnd(st) {
  const a = (st.seed = (st.seed + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function setup(params) {
  const f = (n) => new Float64Array(n);
  const st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, seed: 1, ph: [],
    a: 0.5, b: 0.5, rho: 1e-4, kap: 1,
    px: 0.5, py: 0.5, sx: 0.5, sy: 0.5, tx: 0.5, ty: 0.5, gT: 0, gD: 0,
    tradeIn: 0, shockIn: 10, side: false, big: false, pulse: 0, pdx: 1, pdy: 0,
    trail: [],
    CA: f(W), GA: f(W), CB: f(W), GB: f(W), RA: f(H), HA: f(H), RB: f(H), HB: f(H),
    WL: new Float32Array(W * H), pal: f(12),
  };
  params.st = st;
  return st;
}

// ---- tastes -----------------------------------------------------------------
// u(p, q) = (a p^rho + (1 - a) q^rho)^(1 / rho). Along the diagonal u(s, s) = s, so u is also the place where a curve crosses it.
// rho is never closer to 0 than 1e-4: there the same formula is Cobb-Douglas to four places and nothing divides by zero.
function tastes(st) {
  const k = st.k, p = st.ph, t = st.t;
  const kc = k[2] + 0.09 * sin((TAU * t) / 37.3 + p[4]) + 0.06 * sin((TAU * t) / 61.1 + p[5]);
  let rho = min(0.93, kc < 0 ? 4 * kc : 0.8 * kc);
  if (abs(rho) < 1e-4) rho = rho < 0 ? -1e-4 : 1e-4;
  const wa = 0.07 * sin((TAU * t) / 31.7 + p[0]) + 0.05 * sin((TAU * t) / 71.3 + p[1]);
  const wb = 0.07 * sin((TAU * t) / 43.9 + p[2]) + 0.05 * sin((TAU * t) / 83.1 + p[3]);
  const a = 0.5 + 0.35 * tanh((0.28 * k[3] + wa) / 0.35), b = 0.5 + 0.35 * tanh((-0.28 * k[3] + wb) / 0.35);
  // The contract curve is q / (1 - q) = kap p / (1 - p), and kap goes as the taste ratio to the power 1 / (1 - rho). Near
  // straight lines the smallest difference would throw it into a corner, so the difference shrinks as rho rises above 0.
  const m = rho > 0 ? 1 - rho : 1, la = m * log(a / (1 - a)), lb = m * log(b / (1 - b));
  st.a = 1 / (1 + exp(-la));
  st.b = 1 / (1 + exp(-lb));
  st.rho = rho;
  st.kap = exp((lb - la) / (1 - rho));
}

// (u^rho - 1) / rho: it rises with u whatever the sign of rho.
function vOf(p, q, a, rho) {
  return (a * pow(p < 0.01 ? 0.01 : p, rho) + (1 - a) * pow(q < 0.01 ? 0.01 : q, rho) - 1) / rho;
}

// A new endowment: a point at least a fifth of the box away from the contract curve, so the lens opens wide.
function endow(st) {
  const kap = st.kap;
  let bx = 0.5, by = 0.5, best = -1;
  for (let i = 0; i < 24; i++) {
    const p = 0.1 + 0.8 * rnd(st), q = 0.1 + 0.8 * rnd(st);
    const r = p / (1 - p), s = q / (1 - q);
    const d = min(abs(q - (kap * r) / (1 + kap * r)), abs(p - s / (kap + s)));
    if (d >= 0.2) {
      bx = p;
      by = q;
      break;
    }
    if (d > best) (best = d), (bx = p), (by = q);
  }
  st.tx = bx;
  st.ty = by;
}

// One trade: a straight move along a price line that lies between the two marginal rates of substitution.
function trade(st) {
  const { a, b, rho } = st, p = st.px, q = st.py, pace = st.k[1];
  const mA = (a / (1 - a)) * pow(p / q, rho - 1), mB = (b / (1 - b)) * pow((1 - p) / (1 - q), rho - 1);
  const lg = log(mA / mB), sg = lg > 0 ? 1 : -1;
  // the price favours one of them, then the other: that is the zigzag
  st.side = !st.side;
  const f = (st.side ? 0.2 : 0.6) + 0.2 * rnd(st);
  const price = mB * exp(f * lg);
  const L = sqrt(W * W + H * H * price * price);
  const dp = (sg * 0.5) / L, dq = (-sg * price * 0.5) / L; // half an LED
  const vA = vOf(p, q, a, rho), vB = vOf(1 - p, 1 - q, b, rho);
  let n = 0, x = p, y = q;
  for (; n < 500; n++) {
    x += dp;
    y += dq;
    if (x < MX || x > 1 - MX || y < MY || y > 1 - MY) break;
    if (vOf(x, y, a, rho) <= vA || vOf(1 - x, 1 - y, b, rho) <= vB) break;
  }
  if (n < 3) {
    // the lens is closed: one soft pulse along the price both agree on
    if (st.big) {
      st.big = false;
      st.pulse = 1;
      const l = sqrt(dp * dp * W * W + dq * dq * H * H) || 1;
      st.pdx = (dp * W) / l;
      st.pdy = (-dq * H) / l;
    }
    return;
  }
  const m = n * (0.3 + 0.2 * rnd(st));
  st.sx = p;
  st.sy = q;
  st.tx = p + dp * m;
  st.ty = q + dq * m;
  st.gT = 0;
  st.gD = min(0.25, (0.6 * TRADE) / pace);
  if (m >= 4) {
    st.trail.push({ x0: p * W, y0: (1 - q) * H, x1: st.tx * W, y1: (1 - st.ty) * H, age: 0 });
    if (st.trail.length > 10) st.trail.shift();
  }
  if (m >= 6) st.big = true;
}

function step(st, dt) {
  const k = st.k, p = st.ph, pace = k[1], slow = 0.6 + 0.2 * pace, mid = 0.5 + 0.25 * pace;
  st.t += dt * slow;
  const t = st.t;
  tastes(st);
  if (st.gD > 0) {
    st.gT += dt;
    const u = min(1, st.gT / st.gD), e = u * u * (3 - 2 * u);
    st.px = st.sx + (st.tx - st.sx) * e;
    st.py = st.sy + (st.ty - st.sy) * e;
    if (u >= 1) st.gD = 0;
  } else {
    // a slow push that wanders: it keeps pulling the point off the contract curve
    const psi = p[6] + 2.3 * sin((TAU * t) / 41.3 + p[7]) + 1.9 * sin((TAU * t) / 67.9 + p[8]);
    st.px += (0.8 / W) * cos(psi) * dt * slow;
    st.py += (0.8 / H) * sin(psi) * dt * slow;
  }
  st.px = cl(st.px, MX, 1 - MX);
  st.py = cl(st.py, MY, 1 - MY);
  for (let i = st.trail.length - 1; i >= 0; i--) if ((st.trail[i].age += dt * mid) > LIFE) st.trail.splice(i, 1);
  if (st.pulse > 0) st.pulse = max(0, st.pulse - 2 * dt);
  st.shockIn -= dt * mid;
  if (st.shockIn <= 0) {
    endow(st);
    st.sx = st.px;
    st.sy = st.py;
    st.gT = 0;
    st.gD = 0.9;
    st.shockIn = 7 + 9 * rnd(st);
    st.tradeIn = 0.4 * TRADE;
    st.big = false;
  }
  st.tradeIn -= dt * pace;
  if (st.tradeIn <= 0 && st.gD === 0) {
    st.tradeIn = TRADE * (0.85 + 0.3 * rnd(st));
    trade(st);
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], cl(kv[1], 0.5, 4), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  if (!st.init) {
    st.init = true;
    st.seed = floor(Math.random() * 4294967296) | 0;
    for (let i = 0; i < 17; i++) st.ph.push(TAU * rnd(st));
    // an endowment has just arrived: run long enough for the first trade or two, so the lens is open in the first frame
    tastes(st);
    endow(st);
    st.px = st.tx;
    st.py = st.ty;
    st.shockIn = 7 + 9 * rnd(st);
    st.tradeIn = 0.4 * TRADE;
    const pre = (2.1 * TRADE) / st.k[1];
    for (let s = 0; s < pre; s += 1 / 60) step(st, 1 / 60);
  }
  step(st, cl(dt || 0, 0, 0.1));
}

// ---- drawing ----------------------------------------------------------------
// A white line 2 LED thick into the overlay; a tapered one fades toward both ends.
function seg(WL, x0, y0, x1, y1, amp, taper) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-6;
  const xa = max(0, floor(min(x0, x1) - 2.5)), xb = min(W - 1, floor(max(x0, x1) + 2.5));
  const ya = max(0, floor(min(y0, y1) - 2.5)), yb = min(H - 1, floor(max(y0, y1) + 2.5));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const ex = x + 0.5 - x0, ey = y + 0.5 - y0;
      let s = (ex * dx + ey * dy) / l2;
      s = s < 0 ? 0 : s > 1 ? 1 : s;
      const fx = ex - s * dx, fy = ey - s * dy, d = sqrt(fx * fx + fy * fy);
      if (d > 1.6) continue;
      let v = amp * (d < 0.7 ? 1 : (1.6 - d) / 0.9);
      if (taper) v *= 4 * s * (1 - s);
      const o = y * W + x;
      if (v > WL[o]) WL[o] = v;
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { a, b, rho, CA, GA, CB, GB, RA, HA, RB, HB, WL, pal } = st, ir = 1 / rho, p = st.ph, t = st.t;
  for (let x = 0; x < W; x++) {
    const g = max(0.01, (x + 0.5) / W), gb = max(0.01, 1 - (x + 0.5) / W);
    const ca = a * pow(g, rho), cb = b * pow(gb, rho);
    CA[x] = ca;
    GA[x] = ca / g / W;
    CB[x] = cb;
    GB[x] = cb / gb / W;
  }
  for (let y = 0; y < H; y++) {
    const g = max(0.01, 1 - (y + 0.5) / H), gb = max(0.01, (y + 0.5) / H);
    const ra = (1 - a) * pow(g, rho), rb = (1 - b) * pow(gb, rho);
    RA[y] = ra;
    HA[y] = ra / g / H;
    RB[y] = rb;
    HB[y] = rb / gb / H;
  }
  const uAP = pow(a * pow(st.px, rho) + (1 - a) * pow(st.py, rho), ir);
  const uBP = pow(b * pow(1 - st.px, rho) + (1 - b) * pow(1 - st.py, rho), ir);

  // the overlay: the last trades, the pulse when the lens closes, the point
  WL.fill(0);
  const PX = st.px * W, PY = (1 - st.py) * H;
  for (const s of st.trail) {
    const u = 1 - s.age / LIFE;
    seg(WL, s.x0, s.y0, s.x1, s.y1, 0.85 * u * (2 - u), false);
  }
  if (st.pulse > 0) seg(WL, PX - 36 * st.pdx, PY - 36 * st.pdy, PX + 36 * st.pdx, PY + 36 * st.pdy, 0.7 * st.pulse * st.pulse, true);
  for (let y = max(0, floor(PY - 6)); y <= min(H - 1, floor(PY + 6)); y++) {
    for (let x = max(0, floor(PX - 6)); x <= min(W - 1, floor(PX + 6)); x++) {
      const dx = x + 0.5 - PX, dy = y + 0.5 - PY, d2 = dx * dx + dy * dy, d = sqrt(d2);
      const v = max(d < 1.1 ? 1 : d > 2.2 ? 0 : (2.2 - d) / 1.1, 0.4 * exp(-d2 / 9));
      const o = y * W + x;
      if (v > WL[o]) WL[o] = v;
    }
  }

  // the colours: the knob turns both, and each wanders a little on its own
  const hA = -0.025 + 0.035 * sin((TAU * t) / 47.3 + p[9]) + 0.015 * sin((TAU * t) / 113.9 + p[10]);
  const hB = 0.045 * sin((TAU * t) / 53.9 + p[11]) + 0.02 * sin((TAU * t) / 97.3 + p[12]);
  const thA = TAU * (st.k[0] + hA), thB = TAU * (st.k[0] + hB);
  turn(COLA, thA, pal, 0);
  turn(DIMA, thA, pal, 3);
  turn(COLB, thB, pal, 6);
  turn(DIMB, thB, pal, 9);
  const a0 = pal[0], a1 = pal[1], a2 = pal[2], d0 = pal[3], d1 = pal[4], d2 = pal[5];
  const b0 = pal[6], b1 = pal[7], b2 = pal[8], e0 = pal[9], e1 = pal[10], e2 = pal[11];
  // the lens is lifted to a pale tone whatever the two colours add up to
  const l0 = 0.9 * max(0.1, 0.86 - WB * (a0 + b0)), l1 = 0.9 * max(0.1, 0.86 - WB * (a1 + b1)), l2 = 0.9 * max(0.1, 0.86 - WB * (a2 + b2));
  const ra0 = 0.4 * a0 + 0.6, ra1 = 0.4 * a1 + 0.6, ra2 = 0.4 * a2 + 0.6;
  const rb0 = 0.4 * b0 + 0.6, rb1 = 0.4 * b1 + 0.6, rb2 = 0.4 * b2 + 0.6;
  const bA = 1 + 0.1 * sin((TAU * t) / 37.9 + p[13]), bB = 1 + 0.1 * sin((TAU * t) / 61.3 + p[14]);
  const ns = NS * (1 + 0.08 * sin((TAU * t) / 57.1 + p[15]));

  for (let y = 0, o = 0; y < H; y++) {
    const ra = RA[y], ha = HA[y], rb = RB[y], hb = HB[y];
    for (let x = 0; x < W; x++, o++) {
      // A: the level, its slope per LED, the terrace it falls on counted from the curve through the point
      let w = CA[x] + ra, u = pow(w, ir), gx = GA[x], g = (u / w) * sqrt(gx * gx + ha * ha);
      let e = ns * g * 1.2;
      if (e > 1) e = 1;
      let tt = (u - uAP) * ns - 0.5 * e, q = floor(tt), f = tt - q;
      if (f > 1 - e) {
        f = (f - 1 + e) / e;
        q += f * f * (3 - 2 * f);
      }
      let d = abs(u - uAP) / g;
      const rimA = d < 0.7 ? 1 : d > 1.6 ? 0 : (1.6 - d) / 0.9;
      const inA = q <= -1 ? 0 : q >= 0 ? 1 : q + 1;
      const wa = inA * (WB + WS * (q < 0 ? 0 : q > 4 ? 4 : q)) * bA;
      const da = (1 - inA) * (D0 + DS * (q > -1 ? 0 : q < -3 ? -2 : q + 1));
      // B, from the opposite corner
      w = CB[x] + rb;
      u = pow(w, ir);
      gx = GB[x];
      g = (u / w) * sqrt(gx * gx + hb * hb);
      e = ns * g * 1.2;
      if (e > 1) e = 1;
      tt = (u - uBP) * ns - 0.5 * e;
      q = floor(tt);
      f = tt - q;
      if (f > 1 - e) {
        f = (f - 1 + e) / e;
        q += f * f * (3 - 2 * f);
      }
      d = abs(u - uBP) / g;
      const rimB = d < 0.7 ? 1 : d > 1.6 ? 0 : (1.6 - d) / 0.9;
      const inB = q <= -1 ? 0 : q >= 0 ? 1 : q + 1;
      const wb = inB * (WB + WS * (q < 0 ? 0 : q > 4 ? 4 : q)) * bB;
      const db = (1 - inB) * (D0 + DS * (q > -1 ? 0 : q < -3 ? -2 : q + 1));
      const lens = inA * inB, ka = 0.85 * rimA, kb = 0.85 * rimB, ov = WL[o];
      let r = wa * a0 + da * d0 + wb * b0 + db * e0 + lens * l0;
      let gg = wa * a1 + da * d1 + wb * b1 + db * e1 + lens * l1;
      let bb = wa * a2 + da * d2 + wb * b2 + db * e2 + lens * l2;
      r += (ra0 - r) * ka;
      gg += (ra1 - gg) * ka;
      bb += (ra2 - bb) * ka;
      r += (rb0 - r) * kb + ov;
      gg += (rb1 - gg) * kb + ov;
      bb += (rb2 - bb) * kb + ov;
      display.setPixel(x, y, r >= 1 ? 255 : (r * 255 + 0.5) | 0, gg >= 1 ? 255 : (gg * 255 + 0.5) | 0, bb >= 1 ? 255 : (bb * 255 + 0.5) | 0);
    }
  }
}
