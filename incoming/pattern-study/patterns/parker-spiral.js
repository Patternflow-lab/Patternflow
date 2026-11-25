// ===== Patternflow pattern =====
// Title:   Parker Spiral
// Family:  heliosphere
// Idea:    The solar wind seen from above the Sun's north pole, with the Sun at the middle of the panel: plasma streams out along spiral arms that alternate gold and blue with the magnetic sectors, while fast streams from coronal holes drift, swell and die, overtake the slow wind in front of them and pile it into bright, pale compression ridges with dark rarefactions behind.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Parker spiral, the curve every parcel of solar wind traces in the Sun's rotating frame, phi = phi0 - Omega r / v (Eugene Parker, 1958, from memory); corotating interaction regions, where fast wind from a coronal hole overtakes slow wind and compresses it (Smith and Wolfe, 1976, and Pizzo, 1978, from memory); magnetic sectors of alternating polarity divided by the heliospheric current sheet (from memory); the parcel-path model drawn here, the drift and death of the holes, the sector evolution and the drawing are original, pattern round 247
// Round:   247
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rotation=0..4, Streams=-1..1, Winding=-1..1
//
// Knob 1: Hue. Turns the palette round the wheel. It opens on gold for one magnetic polarity and blue-violet for the other, and the two stay about 200 degrees apart as they turn. Compression ridges go pale at every setting.
// Knob 2: Rotation. 0 to 4, opening at 2. How fast the whole picture turns, counter-clockwise, as the arms trail. At 0 the picture is seen from the Sun's own frame and the arms hold their place while the wind flows out along them. At 2 it turns about 6 degrees a second, and at 4 about 18, a lively sweep.
// Knob 3: Streams. -1 to 1, opening at 0. How many fast streams there are and how hard they push. At -1 there is no stream and the wind is the plain Parker spiral, two or four sectors of one polarity each with a thin pale seam between them. At 0 two or three streams pile the slow wind into ridges. At 1 four strong streams cross each other and the ridges fold.
// Knob 4: Winding. -1 to 1, opening at about 0.06. How tightly the spiral is wound, the Sun's spin over the wind speed. At -1 the arms run almost straight out and curl 30 degrees by the corners. At 0.06 the slow wind curls three quarters of a turn by the corners. At 1 it makes 1.8 turns and the ridges lie round the Sun like rings. The wind also speeds up and slows down on its own over a few minutes, so the winding breathes about 20 percent either side of where the knob puts it.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, sin, cos, atan2, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TP = 2 * PI;

const CX = 32, CY = 64;          // the Sun sits on the middle of the panel
const NR = 112, RMAX = 74;       // rows of the table, and the radius they reach; the corners are 71.5 LED out
const DR = RMAX / (NR - 1);
const NA = 384;                  // bins round the circle, 1.2 LED wide at the corners
const NS = 720;                  // source longitudes on the Sun, half a degree apart
const VREF = 1.3;                // the table is sheared along the spiral of this wind speed so that a ridge stays near one bin as the rows climb
const WMIN = 3.6;                // narrowest ridge across, in LED
const FQ = 0.22;                 // cycles a second of the density packets on slow wind
const LAM = 15;                  // LED between packets
const PKA = 0.28;                // how deep they modulate the wind
const NSL = 4;                   // coronal hole slots

// ---- state ---------------------------------------------------------------
export function setup(params) {
  const tw = (a, b) => a + (b - a) * rnd();
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, rot: tw(0, TP), stale: true,
    v: new Float32Array(NS + 1), pw: new Float32Array(NS + 1), wt: new Float32Array(NS + 1), x: new Float64Array(NS + 1), sj: new Float32Array(NS), cb: new Float32Array(NS + 1), sb: new Float32Array(NS + 1), pj: new Float64Array(NS), dtl: 0,
    Dt: new Float32Array(NR * NA), Dw: new Float32Array(NR * NA),
    dT: new Float32Array(NA + 2), dW: new Float32Array(NA + 2),
    slots: [],
    // sector phases: boundaries drift, and the four sector term swells and fades on its own clock
    sp: [tw(0, TP), tw(0, TP), tw(0, TP), 0.2 * PI, tw(0, TP), tw(0, TP), tw(0, TP)],
    sf: [0.021 * tw(0.8, 1.25), 0.034 * tw(0.8, 1.25), -0.0143 * tw(0.8, 1.25), 0.0262 * tw(0.8, 1.25), 0.0467 * tw(0.8, 1.25), 0.0309 * tw(0.8, 1.25), 0.0377 * tw(0.8, 1.25)],
    ph: new Float32Array(8).map(() => tw(0, TP)),
    pr: null, pa: null,
  });
  // polar coordinates of every LED, taken once
  const n = W * H;
  st.pr = new Float32Array(n);
  st.pa = new Float32Array(n);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX, dy = CY - (y + 0.5);
      st.pr[y * W + x] = sqrt(dx * dx + dy * dy);
      st.pa[y * W + x] = atan2(dy, dx);
    }
  }
  // a first set of holes, well apart, each part way through its life
  let c = tw(0, TP);
  for (let i = 0; i < NSL; i++) {
    const s = { c: 0, w: 0, h: 0, dv: 0, age: 0, life: 0, gap: 0, f1: 0, p1: 0, f2: 0, p2: 0 };
    st.slots.push(s);
    spawn(st, s, c);
    s.age = tw(0.25, 0.55) * s.life;
    c += tw(1.9, 2.5);
  }
  return st;
}

function spawn(st, s, c) {
  const tw = (a, b) => a + (b - a) * rnd();
  if (c === undefined) {
    // away from the holes that are alive, as far as three tries find
    let best = 0, bd = -1;
    for (let tr = 0; tr < 5; tr++) {
      const q = tw(0, TP);
      let dmin = 9;
      for (const o of st.slots) {
        if (o === s || o.gap > 0) continue;
        const d = abs(((q - o.c + 3 * PI) % TP) - PI);
        if (d < dmin) dmin = d;
      }
      if (dmin > bd) { bd = dmin; best = q; }
    }
    c = best;
  }
  s.c = c;
  s.w = tw(0.3, 0.52);                 // 1.67 w is the full width at half height, 29 to 50 degrees
  s.h = tw(0.75, 1.1);                 // 260 to 390 km/s over the 350 km/s of the slow wind
  s.dv = tw(-0.034, 0.034);            // rad/s, up to 2 degrees a second
  s.age = 0;
  s.life = tw(70, 220);
  s.gap = 0;
  s.f1 = tw(0.05, 0.11); s.p1 = tw(0, TP);
  s.f2 = tw(0.021, 0.047); s.p2 = tw(0, TP);
}

// ---- the world: wind speed and polarity by longitude ------------------------
function stepWorld(st, dt) {
  st.t += dt;
  for (const s of st.slots) {
    if (s.gap > 0) {
      s.gap -= dt;
      if (s.gap <= 0) spawn(st, s);
      continue;
    }
    s.age += dt;
    s.c += s.dv * dt + 0.004 * dt * sin(0.031 * st.t + s.p2);
    s.c -= TP * floor(s.c / TP);
    if (s.age > s.life) {
      s.gap = 8 + 40 * rnd();
      s.age = s.life + 1;
    }
  }
}

// the polarity field over longitude: positive is one sector and negative the other
function polarity(st, a) {
  const t = st.t, sp = st.sp, sf = st.sf;
  const t1 = sp[0] + sf[0] * t + 1.2 * sin(sf[1] * t + sp[1]);
  const t2 = sp[2] + sf[2] * t + 0.7 * sin(sf[3] * t + sp[4]);
  const a2 = 1.45 * (0.5 + 0.5 * sin(sf[4] * t + sp[3]));
  const a3 = 0.9 * (0.5 + 0.5 * sin(sf[5] * t + sp[5]));
  const t3 = sp[6] + sf[6] * t;
  return cos(a - t1) + a2 * cos(2 * (a - t2)) + a3 * cos(3 * (a - t3));
}

// fills v (speed over slow wind), pw (warm share) and wt (density weight of a source)
function sources(st, sGate, amp, noiseAmp) {
  const { v, pw, wt, slots, ph, cb, sb, pj } = st;
  const t = st.t;
  for (let j = 0; j < NS; j++) {
    const a = (j / NS) * TP;
    let sp = 1 + noiseAmp * (0.55 * sin(2 * a + ph[0] + 0.041 * t) + 0.45 * sin(3 * a + ph[1] - 0.049 * t) + 0.3 * sin(5 * a + ph[2] + 0.063 * t) + 0.25 * sin(a + ph[3] + 0.027 * t));
    for (let i = 0; i < NSL; i++) {
      const s = slots[i];
      if (s.gap > 0) continue;
      const g = sGate[i];
      if (g <= 0) continue;
      const env = sstep(0, 14, s.age) * sstep(0, 16, s.life - s.age);
      if (env <= 0) continue;
      const d = abs(((a - s.c + 3 * PI) % TP) - PI) / s.w;
      if (d > 3) continue;
      const hgt = s.h * (1 + 0.16 * sin(s.f1 * t + s.p1) + 0.1 * sin(s.f2 * t + s.p2));
      // a flat top and short shoulders: the front steepens as it runs out
      sp += amp * g * env * hgt * exp(-pow(d, 2.4));
    }
    v[j] = sp;
    const p = polarity(st, a);
    pw[j] = 0.5 + 0.5 * Math.tanh(p / 0.2);
    // the plasma sheet on the current sheet is a little denser, and fast wind is thinner
    wt[j] = (1 + 0.8 * exp(-(p * p) / 0.05)) / sp;
  }
  v[NS] = v[0]; pw[NS] = pw[0]; wt[NS] = wt[0];
  // packets ride the wind: a parcel keeps its phase, so a faster one gets through its cycle sooner
  const q = ph[4], q2 = ph[5], q3 = ph[6];
  for (let j = 0; j < NS; j++) {
    const a = (j / NS) * TP;
    pj[j] += st.dtl * FQ * v[j];
    const b = TP * pj[j] + 3 * sin(a + q) + 1.8 * sin(2 * a + q2) + 0.9 * sin(3 * a + q3);
    cb[j] = cos(b);
    sb[j] = sin(b);
  }
  cb[NS] = cb[0]; sb[NS] = sb[0];
}

// ---- the table -----------------------------------------------------------
// One row per radius. Every source longitude puts its share of wind where its parcel is at that radius,
// spread over the stretch between it and its neighbour, so a gap between two parcel paths is a thin
// stretch of wind and a crowd of them a thick one.
function fill(st, K) {
  const { v, pw, wt, x, sj, cb, sb, Dt, Dw, dT, dW } = st;
  const kb = (K * NA) / TP;
  for (let j = 0; j < NS; j++) sj[j] = 1 / v[j] - 1 / VREF;
  const base = NA / NS;
  for (let k = 0; k < NR; k++) {
    const r = k * DR;
    const ak = kb * r;
    const ka = (TP * r) / LAM, sa = PKA * sin(ka), ca = PKA * cos(ka);
    for (let j = 0; j < NS; j++) x[j] = j * base - ak * sj[j];
    x[NS] = x[0] + NA;
    // narrowest stretch: 3.6 LED across the ridge, which on a wound spiral is a long way along the circle
    const rc = max(r, 1), cr = (K / VREF) * rc;
    const lmin = max(1.3, (WMIN * sqrt(1 + cr * cr) * NA) / (TP * rc));
    dT.fill(0);
    dW.fill(0);
    let b0T = 0, b0W = 0;
    for (let j = 0; j < NS; j++) {
      let lo = x[j], hi = x[j + 1];
      if (lo > hi) { const q = lo; lo = hi; hi = q; }
      let L = hi - lo;
      if (L < lmin) { const mid = 0.5 * (lo + hi); lo = mid - 0.5 * lmin; L = lmin; }
      else if (L > NA - 2) L = NA - 2;
      const wj = (0.5 * (wt[j] + wt[j + 1]) * (1 + sa * (cb[j] + cb[j + 1]) * 0.5 - ca * (sb[j] + sb[j + 1]) * 0.5)) * base;
      const d = wj / L;
      const dw = d * 0.5 * (pw[j] + pw[j + 1]);
      lo = lo - NA * floor(lo / NA);
      let hi2 = lo + L;
      let m = floor(lo), u = lo - m;
      dT[m] += d * (1 - u); dT[m + 1] += d * u;
      dW[m] += dw * (1 - u); dW[m + 1] += dw * u;
      if (hi2 >= NA) { hi2 -= NA; b0T += d; b0W += dw; }
      m = floor(hi2); u = hi2 - m;
      dT[m] -= d * (1 - u); dT[m + 1] -= d * u;
      dW[m] -= dw * (1 - u); dW[m + 1] -= dw * u;
    }
    let sT = b0T, sW = b0W;
    const o = k * NA;
    for (let a = 0; a < NA; a++) {
      sT += dT[a]; sW += dW[a];
      Dt[o + a] = sT;
      Dw[o + a] = sW;
    }
  }
}

// ---- colour -----------------------------------------------------------------
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- frame -----------------------------------------------------------------
export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  st.init = true;
  stepWorld(st, dt);
  st.dtl = dt;
  // the turn rate wanders a third either way, so the arms do not keep time with anything else
  const wob = 1 + 0.3 * sin(0.037 * st.t + st.ph[0]) + 0.15 * sin(0.0113 * st.t + st.ph[1]);
  st.rot += dt * wob * (st.k[1] <= 0 ? 0 : 2.2 * (PI / 180) * pow(cl(st.k[1], 0, 4), 1.5));
  st.stale = true;
}

export function draw(display, params) {
  const st = params.st || setup(params);
  const kn = st.k;
  const s3 = cl(kn[2], -1, 1), s4 = cl(kn[3], -1, 1);
  if (st.stale || !st.init) {
    st.init = true;
    st.stale = false;
    // fast streams: how many are let in and how hard they push
    const gate = [0, 0, 0, 0], thr = [-0.95, -0.7, -0.4, 0];
    for (let i = 0; i < NSL; i++) gate[i] = sstep(thr[i], thr[i] + 0.6, s3);
    const amp = 0.5 + 0.8 * sstep(-0.9, 1, s3);
    const noiseAmp = 0.05 + 0.04 * sstep(-1, 0.2, s3);
    sources(st, gate, amp, noiseAmp);
    const ph7 = st.ph[7];
    st.K = exp(-2.8214 + 1.4979 * s4 + -0.5090 * s4 * s4);
    // the whole wind gets a little faster or slower now and then, which unwinds and winds the spiral
    st.K *= 1 + 0.2 * sin(0.071 * st.t + ph7) + 0.11 * sin(0.029 * st.t + 2 * ph7 + 1);
    fill(st, st.K);
  }
  const { Dt, Dw, pr, pa } = st;
  const K = st.K;
  // palette
  const hue = kn[0];
  const warm = [0, 0, 0], cool = [0, 0, 0];
  hsv(0.1 + hue, 0.9, 1, warm);
  hsv(0.1 + hue + 0.56, 0.78, 1, cool);
  const mid = [1, 0.95, 0.9];
  const gr = [0, 0, 0];
  hsv(0.62 + hue, 0.7, 1, gr);
  // tight winding spreads a ridge over more LED, so it gets a lower knee to keep its light
  const zc = (2.1 + 0.3 * sstep(-1, 0, s3)) * (1 - 0.3 * sstep(0.05, 0.16, K));
  const rot = st.rot, kk = K / VREF, ka = NA / TP;
  const t = st.t;
  const breathe = 1 + 0.06 * sin(0.37 * t) + 0.04 * sin(0.91 * t + 1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = pr[i];
      // ground: a faint cool gradient out from the Sun
      const gF = 0.05 + 0.1 * exp(-r / 38);
      let rr = gr[0] * gF * 22, gg = gr[1] * gF * 22, bb = gr[2] * gF * 22;
      if (r > 5) {
        // table read: row by radius, bin by longitude sheared to the reference spiral
        const fr = min(r / DR, NR - 1.001);
        const k0 = floor(fr), tr = fr - k0;
        let fa = (pa[i] - rot + kk * r) * ka;
        fa -= NA * floor(fa / NA);
        const a0 = floor(fa), ta = fa - a0;
        const a1 = a0 + 1 >= NA ? 0 : a0 + 1;
        const o0 = k0 * NA, o1 = o0 + NA;
        const w00 = (1 - tr) * (1 - ta), w01 = (1 - tr) * ta, w10 = tr * (1 - ta), w11 = tr * ta;
        const C = Dt[o0 + a0] * w00 + Dt[o0 + a1] * w01 + Dt[o1 + a0] * w10 + Dt[o1 + a1] * w11;
        const Cw = Dw[o0 + a0] * w00 + Dw[o0 + a1] * w01 + Dw[o1 + a0] * w10 + Dw[o1 + a1] * w11;
        const fw = C > 1e-4 ? cl(Cw / C, 0, 1) : 0.5;
        // density to light: dark in rarefactions, a dim steady wind, bright ridges
        const z = C / zc;
        let L = 1 - exp(-z * z);
        L *= sstep(3, 15, r) * (0.62 + 0.38 * exp(-r / 40)) * breathe;
        // polarity colour through a pale middle
        const q = cl((fw - 0.5) * 2.4, -1, 1);
        const aq = abs(q);
        const c = q > 0 ? warm : cool;
        let cr = mid[0] + (c[0] - mid[0]) * aq, cg = mid[1] + (c[1] - mid[1]) * aq, cb = mid[2] + (c[2] - mid[2]) * aq;
        // ridges go pale as they brighten
        const pale = 0.75 * sstep(0.5, 1, L);
        cr += (1 - cr) * pale; cg += (1 - cg) * pale; cb += (1 - cb) * pale;
        // blue reads darker than gold at the same level, so it gets a lift
        const lv = min(1, L * (1.1 + 0.2 * (1 - cl(fw * 1.4, 0, 1))));
        rr += cr * lv * 255; gg += cg * lv * 255; bb += cb * lv * 255;
      }
      // the Sun: a bright core and a soft corona
      if (r < 22) {
        const core = exp(-(r * r) / 5.5);
        const corona = 0.5 * exp(-r / 5.5) * breathe;
        const sv = min(1, core * 1.3 + corona);
        rr += (warm[0] * 0.5 + 0.5) * sv * 255 * 0.95;
        gg += (warm[1] * 0.45 + 0.52) * sv * 255 * 0.95;
        bb += (warm[2] * 0.4 + 0.5) * sv * 255 * 0.9;
      }
      display.setPixel(x, y, cl(rr, 0, 255) | 0, cl(gg, 0, 255) | 0, cl(bb, 0, 255) | 0);
    }
  }
}
