// ===== Patternflow pattern =====
// Title:   Light Clocks
// Family:  relativity
// Idea:    A spacetime diagram scrolls down the panel while three light clocks, each a pair of mirror worldlines with a 45 degree zigzag of light between them, lean over, thin and tick more slowly the faster they move.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the spacetime diagram with light on the diagonals (Minkowski 1908, from memory); the clock made of two mirrors and a pulse of light, and the slowing of a moving one (Einstein 1905 for the result, Lewis and Tolman 1909 for the mirror clock, from memory); length contraction (FitzGerald 1889 and Lorentz 1892, from memory); velocities added as rapidities, hyperbolic angles that simply sum (Varicak 1910 and Robb 1911, from memory); the traveller who turns round (Langevin 1911, from memory); the shift in colour of light from a moving source (Doppler 1842, and Einstein 1905 for the relativistic factor, from memory). Original here: a diagram that keeps scrolling on a universe 64 LED around, three clocks with rest gaps of 0.8, 1 and 1.3 that wander and turn round on their own, the observer's velocity on a knob and a slow sway under it, the two outer clocks setting off apart when all three ride in one band, mirrors drawn outside the gap they close, the leg of light that runs with its clock drawn paler and the leg that runs against it amber, the colours and the drawing, pattern round 246
// Round:   248
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Boost=-1..1, Gap=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel. It opens with gold light bouncing inside ribbons of violet, indigo and blue; left alone, each ribbon roams between cyan and magenta on its own.
// Knob 2: Speed. 0.5 to 4, opening at 2: how fast time scrolls down the panel, 10.5 rows a second at 0.5, 24 at 2, 42 at 4. The clocks change their velocity in real seconds, so a slow scroll shows more bend in each worldline.
// Knob 3: Boost. -1 to 1, opening at 0: the observer's own velocity. At 0 the clocks lean a little each way and one of them often stands upright with a tight, even zigzag. At -1 or 1 the whole diagram leans one way at about 0.72 of the speed of light, the ribbons thin to 0.7 of their width and the light takes long to catch the mirror that runs from it: that long leg turns pale and the short one back turns amber. Rows already drawn keep their old lean and scroll out.
// Knob 4: Gap. -1 to 1, opening at 0.06: the rest distance between the mirrors, 6 LED at -1, about 10.7 at the opening and 18 at 1 for the middle clock. Small gaps tick fast and fine, large ones slow and wide.

const W = 64, H = 128;
const { floor, ceil, min, max, sqrt, exp, sin, cos, tanh, cosh, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d) => (typeof v === "number" && v === v ? v : d);

const NC = 3;                 // clocks
const HN = 256, HM = HN - 1;  // rows of mirror history, a ring
const BN = 128, BM = BN - 1;  // bounces kept for each clock, a ring
const KEEP = 150;             // rows simulated before the first frame
const Q = 0.25;               // one step of the simulation, in rows
const LEAD = 1.25;            // rows the simulation runs ahead of the top row
const BOOST = 0.9;            // the observer's rapidity at the end of the Boost knob: 0.72 of the speed of light
const LMIN = 3;               // the least gap between two mirrors, LED
const LREL = [0.8, 1.0, 1.3]; // rest gaps of the three clocks, times the knob's
const PER = [[23.7, 41.3, 67.9, 8.3], [29.3, 47.1, 61.7, 11.9], [26.9, 37.3, 71.3, 9.7]]; // periods of each clock's wander, seconds
const AMP = [[0.32, 0.24, 0.16, 0.2], [0.24, 0.19, 0.12, 0.08], [0.3, 0.23, 0.14, 0.2]]; // and their sizes, in rapidity: the last is a quicker sway, small for the middle clock
const OPEN = [0.45, 0, -0.22];  // rapidities the three open on: one leans, one stands, one leans a little the other way
const XOPEN = [16, 38, 57];     // and where they stand at the top row
const HUE0 = 0.68, HUES = 0.17; // ribbons roam the cool side of the wheel at Hue 0, cyan to magenta
const HUEC = [1.2, 0.3, -0.35];  // and open violet, indigo and blue: the arcsine of each is its first phase
const HUER = 0.115;             // the light: gold
const HUEP = HUEC.map((v) => Math.asin(cl(v, -1, 1)));
const LS = 1023 / 6;
const LUT = new Uint8Array(1024);
for (let i = 0; i < 1024; i++) LUT[i] = floor(255 * (1 - exp(-i / LS)) + 0.5);

// The pattern keeps its own random stream, started from Math.random once.
function rnd(st) {
  const a = (st.seed = (st.seed + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function setup(params) {
  const st = {
    k: [0, 2, 0, 0.06], init: false, seed: 1,
    t: 0,        // real seconds at the head of the simulation
    q: 0,        // steps simulated: the head is at row q * Q
    Tnow: 0,     // the row at the top of the panel
    ob: 0, sg: 1, l0: 10.4, nextKick: 0, nextPart: 0,
    cl: [], hp: [],
    buf: new Float32Array(W * H * 3),
  };
  for (let i = 0; i < NC; i++)
    st.cl.push({
      lr: LREL[i], per: PER[i], amp: AMP[i], ph: [0, 0, 0, 0],
      w: 0, kick: 0, kt: 0, xc: 0, xl: 0, xr: 0, p: 0, dir: 1,
      ML: new Float64Array(HN), MR: new Float64Array(HN), PH: new Float32Array(HN),
      BX: new Float64Array(BN), BT: new Float64Array(BN), bn: 0,
    });
  params.st = st;
  return st;
}

// A clock's own rapidity before its turnarounds: slow sines whose periods do not divide each other.
function wander(c, t) {
  let w = 0;
  for (let j = 0; j < 4; j++) w += c.amp[j] * sin((TAU * t) / c.per[j] + c.ph[j]);
  return w;
}

const gapOf = (k4) => 10.4 * pow(1.73, k4);
const rateOf = (k2) => 6 + 9 * k2;

// ---- one quarter row of the diagram ------------------------------------------
function simStep(st) {
  const k = st.k, ds = Q / rateOf(k[1]);
  st.t += ds;
  const t = st.t, lag = 1 - exp(-ds / 0.3), ease = 1 - exp(-ds / 0.35), fade = exp(-ds / 7);
  st.ob += (BOOST * k[2] - st.ob) * lag;
  st.l0 += (gapOf(k[3]) - st.l0) * lag;
  // the observer does not hold quite still either: a slow sway that leans the whole diagram, nothing at the first frame
  const ob = st.ob + st.sg * (0.22 * sin((TAU * t) / 33.7) - 0.14 * sin((TAU * t) / 57.3));
  // a turnaround: one clock eases to a new velocity, the reverse of the one it had, or rest, or a fresh one if it stood,
  // and over the next seconds drifts back to its own wander
  if (t >= st.nextKick) {
    const c = st.cl[min(NC - 1, floor(rnd(st) * NC))], u = c.w + c.kick, r1 = rnd(st), r2 = rnd(st), r3 = rnd(st);
    const u2 = r1 < 0.25 ? 0 : abs(u) < 0.25 ? (r2 < 0.5 ? -1 : 1) * (0.35 + 0.4 * r3) : -u * (0.6 + 0.6 * r3);
    c.kt = cl(u2 - c.w, -0.8, 0.8);
    st.nextKick = t + 4 + 5 * rnd(st);
  }
  // when all three ride in one band, the two outer ones set off away from the middle one: a band of three says less than three
  if (t > st.nextPart) {
    const c = st.cl, wr = (a, b) => ((((a - b) % W) + W * 1.5) % W) - W / 2;
    const d01 = wr(c[1].xc, c[0].xc), d02 = wr(c[2].xc, c[0].xc), lo = min(0, d01, d02), hi = max(0, d01, d02);
    if (hi - lo < 22) {
      const il = lo === 0 ? 0 : lo === d01 ? 1 : 2, ih = hi === 0 ? 0 : hi === d01 ? 1 : 2, im = 3 - il - ih;
      if (im >= 0 && im < NC && il !== ih) {
        const um = c[im].w + c[im].kick;
        c[il].kt = cl(um - 0.5 - 0.3 * rnd(st) - c[il].w, -1.1, 1.1);
        c[ih].kt = cl(um + 0.5 + 0.3 * rnd(st) - c[ih].w, -1.1, 1.1);
        st.nextPart = t + 2.5;
      }
    }
  }
  const T0 = st.q * Q;
  st.q++;
  const store = (st.q & 3) === 0, n = (st.q >> 2) & HM;
  for (let i = 0; i < NC; i++) {
    const c = st.cl[i];
    c.kt *= fade;
    c.kick += (c.kt - c.kick) * ease;
    c.w = wander(c, t);
    // rapidities add, and the sum is bent so that no clock reaches the speed of light
    const phi = 2 * tanh((c.w + c.kick - ob) / 2), beta = tanh(phi);
    const L = max(LMIN, (st.l0 * c.lr) / cosh(phi));
    const xl0 = c.xl, xr0 = c.xr;
    c.xc += beta * Q;
    const xl1 = c.xc - L / 2, xr1 = c.xc + L / 2, p0 = c.p;
    let p1 = p0 + c.dir * Q;
    if (c.dir > 0 && p1 >= xr1) {
      const den = Q - (xr1 - xr0), s = den > 1e-6 ? cl((xr0 - p0) / den, 0, 1) : 0, xb = p0 + s * Q;
      c.BX[c.bn & BM] = xb; c.BT[c.bn & BM] = T0 + s * Q; c.bn++;
      c.dir = -1;
      p1 = xb - (1 - s) * Q;
    } else if (c.dir < 0 && p1 <= xl1) {
      const den = Q + (xl1 - xl0), s = den > 1e-6 ? cl((p0 - xl0) / den, 0, 1) : 0, xb = p0 - s * Q;
      c.BX[c.bn & BM] = xb; c.BT[c.bn & BM] = T0 + s * Q; c.bn++;
      c.dir = 1;
      p1 = xb + (1 - s) * Q;
    }
    c.p = cl(p1, xl1, xr1);
    c.xl = xl1;
    c.xr = xr1;
    if (store) (c.ML[n] = xl1), (c.MR[n] = xr1), (c.PH[n] = phi);
  }
}

function start(st) {
  st.init = true;
  st.seed = floor(Math.random() * 4294967296) | 0;
  const k = st.k, rate = rateOf(k[1]);
  for (let i = 0; i < 15; i++) st.hp.push(TAU * rnd(st));
  // phases: of 80 draws keep the one that holds the clock nearest its opening rapidity over the 5 s before the first frame
  for (let i = 0; i < NC; i++) {
    const c = st.cl[i];
    let best = 1e9, keep = c.ph;
    for (let n = 0; n < 80; n++) {
      c.ph = [TAU * rnd(st), TAU * rnd(st), TAU * rnd(st), TAU * rnd(st)];
      const e = abs(wander(c, 0) - OPEN[i]) + abs(wander(c, -2.7) - OPEN[i]) + abs(wander(c, -5.3) - OPEN[i]);
      if (e < best) (best = e), (keep = c.ph);
    }
    c.ph = keep;
  }
  st.ob = BOOST * k[2];
  st.sg = rnd(st) < 0.5 ? -1 : 1;
  st.l0 = gapOf(k[3]);
  st.t = -(KEEP + LEAD) / rate;
  st.nextKick = 3 + 6 * rnd(st);
  st.nextPart = 0.3;
  st.q = 0;
  st.Tnow = KEEP;
  for (let i = 0; i < NC; i++) {
    const c = st.cl[i], phi = 2 * tanh((wander(c, st.t) - st.ob) / 2), L = max(LMIN, (st.l0 * c.lr) / cosh(phi));
    c.xc = 0; c.xl = -L / 2; c.xr = L / 2;
    c.p = L * (rnd(st) - 0.5);
    c.dir = rnd(st) < 0.5 ? -1 : 1;
  }
  // fill the history with the knobs as they are, so the first frame is a whole diagram
  while (st.q * Q < st.Tnow + LEAD) simStep(st);
  for (let i = 0; i < NC; i++) {
    const c = st.cl[i], d = XOPEN[i] + 6 * (rnd(st) - 0.5) - c.xc;
    c.xc += d; c.xl += d; c.xr += d; c.p += d;
    for (let n = 0; n < HN; n++) (c.ML[n] += d), (c.MR[n] += d);
    for (let n = 0; n < BN; n++) c.BX[n] += d;
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [];
  st.k = [num(kv[0], 0), cl(num(kv[1], 2), 0.5, 4), cl(num(kv[2], 0), -1, 1), cl(num(kv[3], 0.06), -1, 1)];
  if (!st.init) start(st);
  st.Tnow += rateOf(st.k[1]) * cl(num(dt, 0), 0, 0.1);
  let guard = 64;
  while (st.q * Q < st.Tnow + LEAD && guard-- > 0) simStep(st);
}

// ---- drawing ------------------------------------------------------------------
// A colour for a place on the wheel: three cosines a third of a turn apart.
function pal(h, out) {
  out[0] = 0.5 + 0.5 * cos(TAU * h);
  out[1] = 0.5 + 0.5 * cos(TAU * (h - 1 / 3));
  out[2] = 0.5 + 0.5 * cos(TAU * (h - 2 / 3));
  return out;
}
const CC = [0, 0, 0], CR = [0, 0, 0], CG = [0, 0, 0];

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const buf = st.buf, k = st.k, t = st.t, Tnow = st.Tnow, hp = st.hp, rate = rateOf(k[1]);
  // the ground is off, but for a cold haze where now comes in at the top
  pal(k[0] + 0.63, CG);
  for (let y = 0; y < H; y++) {
    const u = y < 12 ? 1 - y / 12 : 0, g = 0.2 * u * u;
    for (let x = 0, o = y * W * 3; x < W; x++, o += 3) (buf[o] = g * CG[0]), (buf[o + 1] = g * CG[1]), (buf[o + 2] = g * CG[2]);
  }
  for (let i = 0; i < NC; i++) {
    const c = st.cl[i];
    // each clock's ribbon and each clock's light drift along the wheel on their own, the ribbon from where it opens
    const hc = k[0] + HUE0 + HUES * (0.6 * sin((hp[i] < PI ? -TAU : TAU) * (t / (43.3 + 9.1 * i)) + HUEP[i]) + (hp[i + 3] < PI ? -0.4 : 0.4) * sin((TAU * t) / (27.7 + 5.3 * i)));
    const hr = k[0] + HUER + 0.05 * sin((TAU * t) / (44.9 + 7.7 * i) + hp[i + 6]);
    // how full the ribbon is
    const lv = 0.5 + 0.1 * sin((TAU * t) / (49.7 + 8.3 * i) + hp[i + 12]);
    pal(hc, CC);
    // a dim warm colour reads brown on the panel, so the fill is lifted where the wheel turns it warm
    const wm = max(0, cos(TAU * (hc - 0.1))), fl = lv * (1 + 0.5 * wm * wm);
    const fr = fl * CC[0], fg = fl * CC[1], fb = fl * CC[2];
    const mr = 1.05 * CC[0] + 0.1, mg = 1.05 * CC[1] + 0.1, mb = 1.05 * CC[2] + 0.1;
    const kmin = max(0, c.bn - BN);
    let kb = c.bn - 1, ux = c.p, uT = st.q * Q;
    for (let y = 0; y < H; y++) {
      const Tc = Tnow - y - 0.5, n0 = floor(Tc), f = Tc - n0;
      const a0 = c.ML[n0 & HM], b0 = c.MR[n0 & HM];
      const sl = c.ML[(n0 + 1) & HM] - a0, sr = c.MR[(n0 + 1) & HM] - b0;
      // a leaning line is widened across so that it stays 2 LED thick; the mirror lies outside the gap, its face on the gap's edge
      const hl = sqrt(1 + sl * sl), hr2 = sqrt(1 + sr * sr);
      const xl = a0 + sl * f, xr = b0 + sr * f, cL = xl - hl, cR = xr + hr2;
      // where the light is on this row
      while (kb >= kmin && c.BT[kb & BM] > Tc) (ux = c.BX[kb & BM]), (uT = c.BT[kb & BM]), kb--;
      let rx = 0, ray = false, rs = 0, rw = 0;
      if (kb >= kmin) {
        const lx = c.BX[kb & BM], lT = c.BT[kb & BM];
        rx = uT - lT > 1e-6 ? lx + ((ux - lx) * (Tc - lT)) / (uT - lT) : lx;
        ray = true;
        // Doppler: light that runs the way its clock moves comes to the observer bluer, here whiter and brighter, and light that
        // runs against it redder, a deep amber
        const e = tanh(1.1 * (ux > lx ? 1 : -1) * c.PH[n0 & HM]), ws = 0.5 + 0.5 * e;
        pal(hr - 0.035 + 0.06 * e, CR);
        rs = 2 - 0.4 * ws;
        rw = 0.1 + 0.45 * ws * ws;
      }
      const i0 = floor(cL - 1.5 * hl - 0.5), i1 = ceil(cR + 1.5 * hr2 - 0.5), row = y * W;
      for (let ix = i0; ix <= i1; ix++) {
        const px = ix + 0.5;
        const fill = cl(px - cL + 0.5, 0, 1) * cl(cR - px + 0.5, 0, 1);
        const m = cl(1.5 - abs(px - cL) / hl, 0, 1) + cl(1.5 - abs(px - cR) / hr2, 0, 1);
        let rr = 0, rg = 0, rb = 0;
        if (ray) {
          const a = cl(1.5 - abs(px - rx) * 0.7071, 0, 1);
          if (a > 0) {
            const wv = rw + 0.45 * a;
            (rr = a * (rs * CR[0] + wv)), (rg = a * (rs * CR[1] + wv)), (rb = a * (rs * CR[2] + wv));
          }
        }
        const o = (row + (((ix % W) + W) % W)) * 3;
        buf[o] += fill * fr + m * mr + rr;
        buf[o + 1] += fill * fg + m * mg + rg;
        buf[o + 2] += fill * fb + m * mb + rb;
      }
    }
    // the bounces: a soft glow at each, and the newest ones flash as they come in
    pal(hr, CR);
    const gr = 0.9 * CR[0] + 0.75, gg = 0.9 * CR[1] + 0.75, gb = 0.9 * CR[2] + 0.75;
    for (let kk = c.bn - 1; kk >= kmin; kk--) {
      const sy = Tnow - c.BT[kk & BM], sx = c.BX[kk & BM];
      if (sy > H + 4) break;
      if (sy < -5) continue;
      const fresh = exp(-max(0, sy) / (0.3 * rate)), amp = 0.9 + 1.7 * fresh, sg = 1.15 * (1 + 0.45 * fresh), R = 2.7 * sg, iv = 1 / (2 * sg * sg);
      const y0 = max(0, floor(sy - R)), y1 = min(H - 1, ceil(sy + R)), x0 = floor(sx - R), x1 = ceil(sx + R);
      for (let y = y0; y <= y1; y++) {
        const dy = y + 0.5 - sy;
        for (let ix = x0; ix <= x1; ix++) {
          const dx = ix + 0.5 - sx, a = amp * exp(-(dx * dx + dy * dy) * iv);
          if (a < 0.02) continue;
          const o = (y * W + (((ix % W) + W) % W)) * 3;
          buf[o] += a * gr;
          buf[o + 1] += a * gg;
          buf[o + 2] += a * gb;
        }
      }
    }
  }
  // tone: each channel bent by 1 - e^-x
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let r = buf[o] * LS, g = buf[o + 1] * LS, b = buf[o + 2] * LS;
      r = r > 1023 ? 1023 : r;
      g = g > 1023 ? 1023 : g;
      b = b > 1023 ? 1023 : b;
      display.setPixel(x, y, LUT[r | 0], LUT[g | 0], LUT[b | 0]);
    }
  }
}
