// ===== Patternflow pattern =====
// Title:   Edgeworth Box
// Family:  exchange
// Idea:    The panel is the box two people share two goods in: the coral region and the blue region are what each would rather have than the point they hold, the pale lens where the two overlap is every trade both would agree to, and the point zigzags into it one trade after another until the lens closes, and then tastes drift, a new endowment arrives and it opens again.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the exchange of two goods between two traders and its contract curve (Edgeworth 1881, from memory), drawn as a box with one origin in each corner (Pareto 1906, from memory); indifference curves and the lens of trades that leave both better off, textbook results; the CES utility (Arrow, Chenery, Minhas and Solow 1961, from memory) with Cobb-Douglas as its limit; trading in small steps at prices between the two marginal rates of substitution, without an auctioneer (Uzawa 1962 and Hahn 1962, from memory). Original here: utility measured as the place a curve crosses the diagonal, terraces counted from the curve through the point held, a price that favours one trader and then the other, the taste difference tempered as the goods turn into substitutes so the contract curve stays inside the box, the endowments chosen where the two are about equally well off, the shocks and the wanders, each family of curves lit like a relief by a slowly turning light and a lamp that wanders over it, the swell that climbs the terraces, the colours and the drawing, pattern round 246
// Round:   248
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..4, Curve=-1..1, Taste=-1..1
//
// Knob 1: Hue. Turns both people's colours round the wheel. It opens with A coral, rising from the bottom left corner, against B blue, rising from the top right, the lens between them pale and near white, and the ground neither wants a dim blue violet.
// Knob 2: Pace. 0.5 to 4, opening at 2: how fast they trade and how often a new endowment arrives. At 0.5 a trade comes every 1.5 s, a new endowment every 13 to 27 s, and the lens is often still open when it arrives. At 2 a trade comes every half second and an endowment every 9 to 19 s. At 4 the zigzag runs to the contract curve in two or three seconds and the next endowment is 6 to 14 s away.
// Knob 3: Curve. -1 to 1, opening at 0: how the two goods stand in for each other. At -1 they are complements, every curve is a sharp elbow and the lens is a small kinked shape. At 0 the curves are smooth hyperbolas. At 1 they are nearly straight lines and the lens is a long thin sliver. Each of the two has a curvature of their own that wanders a little about the knob.
// Knob 4: Taste. -1 to 1, opening at 0.06: how differently the two value the goods. At 0 they agree and the contract curve is the diagonal. Toward 1 A wants the first good and B the second, the two families of curves lean apart and the contract curve bows into the bottom right corner. Toward -1 it bows into the top left.

const W = 64, H = 128;
const { floor, min, max, sqrt, exp, log, sin, cos, pow, abs, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const NS = 7;                  // terraces from one corner of the box to the other
const MX = 4 / W, MY = 4 / H;  // the point stays 4 LED inside the box
const TRADE = 0.85;            // seconds between trades at pace 1; the rate goes as pace to the power 0.8
const LIFE = 4;                // how long a trade's segment stays lit, on the clock the endowments run on
const WB = 0.47, WS = 0.065;    // a wash at the curve through the point, and what each terrace above it adds
const D0 = 0.2, DS = 0.04;     // the ground below the curve, and what each terrace below it takes away
const LIGHT = 0.38;            // how deep the turning light shades a wash
const SPOT = 0.46;             // and how much a wash gains under the lamp that wanders over it
const SWELL = 0.18;            // the swell that climbs the terraces
const COLA = [1, 0.55, 0.45], COLB = [0.22, 0.48, 1];
const DEEP = [1, 0.36, 0.48];    // where A's wash is dark it turns toward this rose, since a dark coral reads brown
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
    k: [0, 2, 0, 0.06], init: false, t: 0, c: 0, seed: 1, ph: [],
    a: 0.5, b: 0.5, ra: 1e-4, rb: 1e-4, dp: 0, dq: 0, g: 1,
    px: 0.5, py: 0.5, sx: 0.5, sy: 0.5, tx: 0.5, ty: 0.5, gT: 0, gD: 0,
    tradeIn: 0, shockIn: 10, side: false, big: false, pulse: 0, pdx: 1, pdy: 0,
    trail: [],
    CA: f(W), GA: f(W), CB: f(W), GB: f(W), RA: f(H), HA: f(H), RB: f(H), HB: f(H),
    WL: new Float32Array(W * H), pal: f(27), TA: f(10), TB: f(10), XA: f(W), XB: f(W), YA: f(H), YB: f(H),
  };
  params.st = st;
  return st;
}

// ---- tastes -----------------------------------------------------------------
// u(p, q) = (a p^rho + (1 - a) q^rho)^(1 / rho). Along the diagonal u(s, s) = s, so u is also the place where a curve crosses it.
// rho is never closer to 0 than 1e-4: there the same formula is Cobb-Douglas to four places and nothing divides by zero.
function rhoOf(kc) {
  const r = kc < 0 ? 4 * max(kc, -1.2) : 0.8 * min(kc, 1.15);
  return abs(r) < 1e-4 ? (r < 0 ? -1e-4 : 1e-4) : r;
}
function tastes(st) {
  const k = st.k, p = st.ph, t = st.t;
  // each of the two has a curvature of their own, wandering about the knob
  const ra = rhoOf(k[2] + 0.16 * sin((TAU * t) / 37.3 + p[4]) + 0.1 * sin((TAU * t) / 61.1 + p[5]));
  const rb = rhoOf(k[2] + 0.16 * sin((TAU * t) / 45.7 + p[16]) + 0.1 * sin((TAU * t) / 73.9 + p[17]));
  const wa = 0.14 * sin((TAU * t) / 31.7 + p[0]) + 0.09 * sin((TAU * t) / 71.3 + p[1]);
  const wb = 0.14 * sin((TAU * t) / 43.9 + p[2]) + 0.09 * sin((TAU * t) / 83.1 + p[3]);
  const a = 0.5 + 0.35 * tanh((0.28 * k[3] + wa) / 0.35), b = 0.5 + 0.35 * tanh((-0.28 * k[3] + wb) / 0.35);
  // What the two share, a fashion for one good that comes and goes, tilts both families together and leaves the contract
  // curve where it is. What they differ in bows it, as the taste ratio to the power 1 / (1 - rho): near straight lines the
  // smallest difference would throw it into a corner, and at sharp elbows the largest would hardly show. So the
  // difference counts for less as rho rises above 0 and for more as it falls below, and so does the fashion below 0.
  const la = log(a / (1 - a)), lb = log(b / (1 - b)), d = 0.5 * (la - lb);
  const c = 0.5 * (la + lb) + 0.45 * sin((TAU * t) / 53.3 + p[21]) + 0.3 * sin((TAU * t) / 89.7 + p[22]);
  const fa = ra > 0 ? c + (1 - ra) * d : pow(1 - ra, 0.8) * c + sqrt(1 - ra) * d, ma = ra > 0 ? 1.4 : 0.8 * (1 - ra);
  const fb = rb > 0 ? c - (1 - rb) * d : pow(1 - rb, 0.8) * c - sqrt(1 - rb) * d, mb = rb > 0 ? 1.4 : 0.8 * (1 - rb);
  st.a = 1 / (1 + exp(-cl(fa, -ma, ma)));
  st.b = 1 / (1 + exp(-cl(fb, -mb, mb)));
  st.ra = ra;
  st.rb = rb;
}

// (u^rho - 1) / rho: it rises with u whatever the sign of rho.
function vOf(p, q, a, rho) {
  return (a * pow(p < 0.01 ? 0.01 : p, rho) + (1 - a) * pow(q < 0.01 ? 0.01 : q, rho) - 1) / rho;
}

// From (p, q) along a price line between the two marginal rates of substitution, f of the way from B's to A's: how far
// the line stays inside the lens, in half LEDs. The step is left in st.dp and st.dq.
function reach(st, p, q, f) {
  const { a, b, ra, rb } = st;
  const mA = (a / (1 - a)) * pow(p / q, ra - 1), mB = (b / (1 - b)) * pow((1 - p) / (1 - q), rb - 1);
  const lg = log(mA / mB), sg = lg > 0 ? 1 : -1, price = mB * exp(f * lg);
  const L = sqrt(W * W + H * H * price * price), dp = (sg * 0.5) / L, dq = (-sg * price * 0.5) / L;
  const vA = vOf(p, q, a, ra), vB = vOf(1 - p, 1 - q, b, rb);
  let n = 0, x = p, y = q;
  for (; n < 400; n++) {
    x += dp;
    y += dq;
    if (x < MX || x > 1 - MX || y < MY || y > 1 - MY) break;
    if (vOf(x, y, a, ra) <= vA || vOf(1 - x, 1 - y, b, rb) <= vB) break;
  }
  st.dp = dp;
  st.dq = dq;
  return n;
}

// The level u at a point and, in st.g, its slope per LED.
function lev(st, p, q, a, r) {
  const cp = a * pow(p, r), cq = (1 - a) * pow(q, r), w = cp + cq, u = pow(w, 1 / r), gx = cp / p / W, gy = cq / q / H;
  st.g = (u / w) * sqrt(gx * gx + gy * gy);
  return u;
}

// A new endowment: a point whose lens is at least 15 LED across half way along, so it opens wide, and where the two are
// about as well off as each other, so neither colour is crowded into a corner.
function endow(st) {
  const { a, b, ra, rb } = st;
  let best = -1e9;
  for (let i = 0; i < 30; i++) {
    const p = 0.1 + 0.8 * rnd(st), q = 0.1 + 0.8 * rnd(st), n = reach(st, p, q, 0.5);
    const x = p + 0.5 * n * st.dp, y = q + 0.5 * n * st.dq;
    const ua = lev(st, p, q, a, ra);
    let wd = (lev(st, x, y, a, ra) - ua) / st.g;
    const ub = lev(st, 1 - p, 1 - q, b, rb);
    wd += (lev(st, 1 - x, 1 - y, b, rb) - ub) / st.g;
    const off = max(0, abs(ua - ub) - 0.18), sc = min(wd, 15) - 30 * off;
    if (sc > best) (best = sc), (st.tx = p), (st.ty = q);
    if (sc >= 15) break;
  }
}

// One trade: a straight move along a price line, a part of the way the line stays inside the lens and 7 LED at the most.
function trade(st) {
  const p = st.px, q = st.py;
  // the price favours one of them, then the other: that is the zigzag
  st.side = !st.side;
  const n = reach(st, p, q, (st.side ? 0.2 : 0.6) + 0.2 * rnd(st)), dp = st.dp, dq = st.dq;
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
  const m = min(n * (0.18 + 0.14 * rnd(st)), 9 + 5 * rnd(st));
  st.sx = p;
  st.sy = q;
  st.tx = p + dp * m;
  st.ty = q + dq * m;
  st.gT = 0;
  st.gD = min(0.25, (0.6 * TRADE) / pow(st.k[1], 0.8));
  if (m >= 4) {
    st.trail.push({ x0: p * W, y0: (1 - q) * H, x1: st.tx * W, y1: (1 - st.ty) * H, age: 0 });
    if (st.trail.length > 12) st.trail.shift();
  }
  if (m >= 6) st.big = true;
}

function step(st, dt) {
  const k = st.k, p = st.ph, pace = k[1], slow = 0.6 + 0.2 * pace, mid = 0.5 + 0.25 * pace;
  st.t += dt * slow;
  st.c += dt;
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
    st.px += (1.2 / W) * cos(psi) * dt * slow;
    st.py += (1.2 / H) * sin(psi) * dt * slow;
  }
  st.px = cl(st.px, MX, 1 - MX);
  st.py = cl(st.py, MY, 1 - MY);
  for (let i = st.trail.length - 1; i >= 0; i--) if ((st.trail[i].age += dt * mid) > LIFE) st.trail.splice(i, 1);
  if (st.pulse > 0) st.pulse = max(0, st.pulse - 2 * dt);
  st.shockIn -= dt * slow;
  if (st.shockIn <= 0) {
    endow(st);
    st.sx = st.px;
    st.sy = st.py;
    st.gT = 0;
    st.gD = 0.9;
    st.shockIn = 9 + 10 * rnd(st);
    st.tradeIn = 0.4 * TRADE;
    st.big = false;
  }
  st.tradeIn -= dt * pow(pace, 0.8);
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
    for (let i = 0; i < 42; i++) st.ph.push(TAU * rnd(st));
    // an endowment has just arrived: run long enough for the first trade, so the lens is wide open in the first frame
    tastes(st);
    endow(st);
    st.px = st.tx;
    st.py = st.ty;
    st.shockIn = 9 + 10 * rnd(st);
    st.tradeIn = 0.4 * TRADE;
    const pre = (0.8 * TRADE) / pow(st.k[1], 0.8);
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
  const { a, b, ra: rhA, rb: rhB, CA, GA, CB, GB, RA, HA, RB, HB, WL, pal } = st, irA = 1 / rhA, irB = 1 / rhB, p = st.ph, t = st.t;
  for (let x = 0; x < W; x++) {
    const g = max(0.01, (x + 0.5) / W), gb = max(0.01, 1 - (x + 0.5) / W);
    const ca = a * pow(g, rhA), cb = b * pow(gb, rhB);
    CA[x] = ca;
    GA[x] = ca / g / W;
    CB[x] = cb;
    GB[x] = cb / gb / W;
  }
  for (let y = 0; y < H; y++) {
    const g = max(0.01, 1 - (y + 0.5) / H), gb = max(0.01, (y + 0.5) / H);
    const ra = (1 - a) * pow(g, rhA), rb = (1 - b) * pow(gb, rhB);
    RA[y] = ra;
    HA[y] = ra / g / H;
    RB[y] = rb;
    HB[y] = rb / gb / H;
  }
  const uAP = pow(a * pow(st.px, rhA) + (1 - a) * pow(st.py, rhA), irA);
  const uBP = pow(b * pow(1 - st.px, rhB) + (1 - b) * pow(1 - st.py, rhB), irB);

  // the overlay: the last trades, the pulse when the lens closes, the point
  WL.fill(0);
  const PX = st.px * W, PY = (1 - st.py) * H;
  for (const s of st.trail) {
    const u = 1 - s.age / LIFE;
    seg(WL, s.x0, s.y0, s.x1, s.y1, u * (2 - u), false);
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

  // the colours: the knob turns both, and each wanders a little on its own, on a clock no knob touches
  const c = st.c;
  const hA = -0.02 + 0.035 * sin((TAU * c) / 27.3 + p[9]) + 0.02 * sin((TAU * c) / 61.7 + p[10]);
  const hB = 0.05 * sin((TAU * c) / 33.9 + p[11]) + 0.025 * sin((TAU * c) / 71.3 + p[12]);
  const thA = TAU * (st.k[0] + hA), thB = TAU * (st.k[0] + hB);
  turn(COLA, thA, pal, 0);
  turn(DIMA, thA, pal, 3);
  turn(COLB, thB, pal, 6);
  turn(DIMB, thB, pal, 9);
  turn(DEEP, thA, pal, 12);
  // the lit side of a wash leans one way round the wheel and the shaded side the other: coral toward peach and rose,
  // blue toward cyan and violet
  turn(COLA, thA + 0.2, pal, 15);
  turn(COLA, thA - 0.2, pal, 18);
  turn(COLB, thB - 0.25, pal, 21);
  turn(COLB, thB + 0.25, pal, 24);
  const ta0 = (pal[15] - pal[18]) / (2 * LIGHT), ta1 = (pal[16] - pal[19]) / (2 * LIGHT), ta2 = (pal[17] - pal[20]) / (2 * LIGHT);
  const tb0 = (pal[21] - pal[24]) / (2 * LIGHT), tb1 = (pal[22] - pal[25]) / (2 * LIGHT), tb2 = (pal[23] - pal[26]) / (2 * LIGHT);
  const a0 = pal[0], a1 = pal[1], a2 = pal[2], d0 = pal[3], d1 = pal[4], d2 = pal[5];
  const b0 = pal[6], b1 = pal[7], b2 = pal[8], e0 = pal[9], e1 = pal[10], e2 = pal[11];
  const c0 = pal[12] - a0, c1 = pal[13] - a1, c2 = pal[14] - a2;
  // how bright each wash is at the curve, how much each terrace adds, how bright the ground is: all slow, each on its own.
  // And a slow swell that climbs the terraces toward each one's own corner, a terrace at a time.
  const wA = 1.08 * WB * (1 + 0.16 * sin((TAU * c) / 23.9 + p[13]) + 0.06 * sin((TAU * c) / 37.3 + p[32]));
  const wB = WB * (1 + 0.16 * sin((TAU * c) / 29.3 + p[14]) + 0.06 * sin((TAU * c) / 43.1 + p[33]));
  const sA = WS * (1 + 0.65 * sin((TAU * c) / 52.3 + p[18])), sB = WS * (1 + 0.65 * sin((TAU * c) / 68.9 + p[19]));
  const dg = D0 * (1 + 0.2 * sin((TAU * c) / 43.1 + p[20]));
  const { TA, TB } = st;
  for (let i = 0; i < 10; i++) {
    const j = min(i, 3);
    TA[i] = cl(wA + sA * j + SWELL * sin(1.9 * i - (TAU * c) / 19.3 + p[23]), 0.26, 0.9);
    TB[i] = cl(wB + sB * j + SWELL * sin(1.9 * i - (TAU * c) / 27.1 + p[28]), 0.26, 0.9);
  }
  // Each family of curves is lit like a relief by a light of its own that turns slowly: now the steep end of every curve
  // is the bright one, now the flat end, now the bend between them.
  const mA = (TAU * c) / 23.7 + p[24] + 0.9 * sin((TAU * c) / 41.9 + p[25]), mB = p[26] - (TAU * c) / 29.3 + 0.9 * sin((TAU * c) / 53.1 + p[27]);
  const cLA = LIGHT * cos(mA), sLA = LIGHT * sin(mA), cLB = LIGHT * cos(mB), sLB = LIGHT * sin(mB);
  // And over each wash a broad lamp wanders across the panel, whatever the point and the tastes do.
  const { XA, XB, YA, YB } = st;
  const xa = 32 + 22 * sin((TAU * c) / 13.7 + p[34]) + 12 * sin((TAU * c) / 31.3 + p[38]), ya = 64 + 44 * sin((TAU * c) / 17.9 + p[35]) + 24 * sin((TAU * c) / 37.1 + p[39]);
  const xb = 32 + 22 * sin((TAU * c) / 15.3 + p[36]) + 12 * sin((TAU * c) / 34.7 + p[40]), yb = 64 + 44 * sin((TAU * c) / 21.1 + p[37]) + 24 * sin((TAU * c) / 45.7 + p[41]);
  for (let x = 0; x < W; x++) {
    XA[x] = SPOT * exp(-((x + 0.5 - xa) * (x + 0.5 - xa)) / 2300);
    XB[x] = SPOT * exp(-((x + 0.5 - xb) * (x + 0.5 - xb)) / 2300);
  }
  for (let y = 0; y < H; y++) {
    YA[y] = exp(-((y + 0.5 - ya) * (y + 0.5 - ya)) / 2300);
    YB[y] = exp(-((y + 0.5 - yb) * (y + 0.5 - yb)) / 2300);
  }
  // the lens is lifted to a pale tone whatever the two colours add up to
  const l0 = 0.95 * max(0.1, 0.92 - TA[0] * a0 - TB[0] * b0), l1 = 0.95 * max(0.1, 0.92 - TA[0] * a1 - TB[0] * b1), l2 = 0.95 * max(0.1, 0.92 - TA[0] * a2 - TB[0] * b2);
  const ra0 = 0.4 * a0 + 0.6, ra1 = 0.4 * a1 + 0.6, ra2 = 0.4 * a2 + 0.6;
  const rb0 = 0.4 * b0 + 0.6, rb1 = 0.4 * b1 + 0.6, rb2 = 0.4 * b2 + 0.6;
  const nA = NS * (1 + 0.18 * sin((TAU * c) / 57.1 + p[15])), nB = NS * (1 + 0.18 * sin((TAU * c) / 75.7 + p[29]));

  for (let y = 0, o = 0; y < H; y++) {
    const ra = RA[y], ha = HA[y], rb = RB[y], hb = HB[y], ya1 = YA[y], yb1 = YB[y], off = 0.4 * SPOT;
    for (let x = 0; x < W; x++, o++) {
      // A: the level, its slope per LED, the terrace it falls on counted from the curve through the point
      let w = CA[x] + ra, u = pow(w, irA), gx = GA[x], g2 = gx * gx + ha * ha, g = (u / w) * sqrt(g2);
      const shA = 1 - off + XA[x] * ya1 + (cLA * (gx * gx - ha * ha) + sLA * 2 * gx * ha) / g2;
      let e = nA * g * 1.2;
      if (e > 1) e = 1;
      let tt = (u - uAP) * nA - 0.5 * e, k = floor(tt), f = tt - k, s = 0;
      if (f > 1 - e) {
        f = (f - 1 + e) / e;
        s = f * f * (3 - 2 * f);
      }
      let d = abs(u - uAP) / g;
      const rimA = d < 0.7 ? 1 : d > 1.6 ? 0 : (1.6 - d) / 0.9;
      let inA = 1, wa = 0, da = 0;
      if (k >= 0) {
        if (k > 8) k = 8;
        wa = TA[k] + (TA[k + 1] - TA[k]) * s;
      } else {
        inA = k < -1 ? 0 : s;
        wa = inA * TA[0];
        da = (1 - inA) * (dg + DS * (k < -3 ? -2 : k + 1 + (k < -1 ? s : 0)));
      }
      // B, from the opposite corner
      w = CB[x] + rb;
      u = pow(w, irB);
      gx = GB[x];
      g2 = gx * gx + hb * hb;
      g = (u / w) * sqrt(g2);
      const shB = 1 - off + XB[x] * yb1 + (cLB * (gx * gx - hb * hb) + sLB * 2 * gx * hb) / g2;
      e = nB * g * 1.2;
      if (e > 1) e = 1;
      tt = (u - uBP) * nB - 0.5 * e;
      k = floor(tt);
      f = tt - k;
      s = 0;
      if (f > 1 - e) {
        f = (f - 1 + e) / e;
        s = f * f * (3 - 2 * f);
      }
      d = abs(u - uBP) / g;
      const rimB = d < 0.7 ? 1 : d > 1.6 ? 0 : (1.6 - d) / 0.9;
      let inB = 1, wb = 0, db = 0;
      if (k >= 0) {
        if (k > 8) k = 8;
        wb = TB[k] + (TB[k + 1] - TB[k]) * s;
      } else {
        inB = k < -1 ? 0 : s;
        wb = inB * TB[0];
        db = (1 - inB) * (dg + DS * (k < -3 ? -2 : k + 1 + (k < -1 ? s : 0))) * (1 - 0.75 * inA);
      }
      da *= (1 - 0.75 * inB) * shA;
      wa *= shA;
      wb *= shB;
      db *= shB;
      const lens = inA * inB, ka = 0.85 * rimA, kb = 0.85 * rimB, ov = WL[o], dk = wa > 0.52 ? 0 : wa < 0.3 ? 1 : (0.52 - wa) / 0.22;
      const la = shA - 1, lb = shB - 1;
      let r = wa * (a0 + dk * c0 + la * ta0) + da * d0 + wb * (b0 + lb * tb0) + db * e0 + lens * l0;
      let gg = wa * (a1 + dk * c1 + la * ta1) + da * d1 + wb * (b1 + lb * tb1) + db * e1 + lens * l1;
      let bb = wa * (a2 + dk * c2 + la * ta2) + da * d2 + wb * (b2 + lb * tb2) + db * e2 + lens * l2;
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
