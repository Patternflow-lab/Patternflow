// ===== Patternflow pattern =====
// Title:   Spaghetti
// Family:  ensemble
// Idea:    A weather-centre spaghetti plot: up to forty-eight copies of each storm are started from the same analysed spot with tiny differences and carried through one drifting steering flow of highs, lows and a meandering jet, so every copy leaves a glowing line, the lines lie together at first, then the flow's sensitivity pulls them into a fan, sometimes into two families that recurve out or run on, and a warm white ensemble mean shows how much the forecast can be trusted.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: sensitive dependence on initial conditions (Edward Lorenz, 1963), ensemble forecasting from perturbed starts (Eric Epstein, 1969; the operational ensembles of ECMWF and NCEP from 1992, from memory) and the spaghetti plot of tropical cyclone tracks, with the beta drift of a vortex on a rotating planet (Greg Holland, 1983, from memory); the steering flow is a stream function of Gaussian highs and lows plus a meandering jet, so it cannot pile tracks up, and every member is carried by RK2; the steering weights, the storm schedule, the colour families, the ensemble mean and the cone are original, pattern round 257
// Round:   257
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spread=0..3, Steer=-1..1, Members=-1..1
//
// Knob 1: Hue. Turns every storm family round the wheel together. It opens on teal, with violet and gold coming in as the next storms start, a quarter to a third of the wheel apart each; the members of one storm spread over 0.12 of the wheel by how strongly the flow carries them.
// Knob 2: Spread. 0 to 3, opening at 2. How different the members are: the Gaussian size of the starting scatter, the range of steering weights (0.75 to 1.25 at the opening) and the error in where the highs and lows stand. At 0 they are almost one line, at 2 a fan opens over twenty to forty seconds, at 3 it is wild and splits early.
// Knob 3: Steer. -1 to 1, opening at 0. How fast the storms travel and the highs, lows and jet wander, from 0.6 at -1 to 1.7 times the opening speed at 1. Slow, a storm takes the whole minute to climb the panel; fast, it is over in twenty seconds and the next one is already coming.
// Knob 4: Members. -1 to 1, opening at about 0.06. How many lines each storm carries: 7 at -1, 19 at the opening, 48 at 1. Few lines are separate threads; many pile into a glow that is brightest where they agree.

const W = 64, H = 128, N = W * H;
const MMAX = 48;                 // members integrated for every storm
const TS = 0.6;                  // model seconds between stored track points
const NPT = 104;                 // points a member can store (a storm lives at most 62 s)
const NSTORM = 6;                // storm slots: three alive, up to three fading
const HOFF = 0.5;                // the first storm opens on teal, not red
const HSPREAD = 0.12;            // hue range over the members of one storm
const FADE = 8;                  // seconds a finished storm takes to fade out
const VEER = 0.17;               // radians the steering layer's wind turns for the members at the ends
const CW = 16, CH = 32;            // the cone's grid, a quarter of the panel
const CONE = 0.11;               // peak strength of the cone's glow
const SGM = 0.7;                 // member line width, Gaussian sigma in LED (1.65 LED at half height)
const BX = -0.7, BY = -0.9;     // beta drift of a storm, LED a second, toward the north west
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, tanh, pow, log, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();
const rr = (a, b) => a + (b - a) * rnd();
const gauss = () => sqrt(-2 * log(max(rnd(), 1e-9))) * cos(TP * rnd());

// ---- the steering flow ----------------------------------------------------------------------
// psi(x, y, t) is four Gaussian highs and lows plus a meandering jet. The velocity is
// (dpsi/dy, -dpsi/dx), so the flow is incompressible and the tracks cannot pile up. x runs to
// the right (east), y down the panel (north is up). Every centre wanders on two sine clocks per
// axis, breathes in strength and in size, and none of the rates is a multiple of another.
const CEN = [
  // centre, wander, strength (positive = high, clockwise), size, and the clock rates in rad/s
  { cx: 46, cy: 84, ax: 13, ay: 11, g: 105, s: 19, wx: 0.071, wy: 0.053, wg: 0.037, wg2: 0.0113, ws: 0.061 },
  { cx: 14, cy: 46, ax: 12, ay: 15, g: -80, s: 15, wx: 0.047, wy: 0.083, wg: 0.029, wg2: 0.0171, ws: 0.043 },
  { cx: 50, cy: 22, ax: 12, ay: 11, g: 72, s: 14, wx: 0.059, wy: 0.041, wg: 0.051, wg2: 0.0097, ws: 0.077 },
  { cx: 14, cy: 104, ax: 11, ay: 12, g: -58, s: 13, wx: 0.089, wy: 0.067, wg: 0.023, wg2: 0.0139, ws: 0.033 },
];
const NPH = 48;

function flow(ph, x, y, t, o) {
  let vx = 0, vy = 0;
  for (let i = 0; i < 4; i++) {
    const c = CEN[i], k = i * 7;
    const cx = c.cx + c.ax * sin(c.wx * t + ph[k]) + 0.45 * c.ax * sin(2.31 * c.wx * t + ph[k + 1]);
    const cy = c.cy + c.ay * sin(c.wy * t + ph[k + 2]) + 0.45 * c.ay * sin(1.87 * c.wy * t + ph[k + 3]);
    const g = c.g * (1 + 0.45 * sin(c.wg * t + ph[k + 4]) + 0.25 * sin(c.wg2 * t + ph[k + 6]));
    const s = c.s * (1 + 0.22 * sin(c.ws * t + ph[k + 5]));
    const dx = x - cx, dy = y - cy;
    const e = g * exp(-(dx * dx + dy * dy) / (2 * s * s)) / (s * s);
    vx -= e * dy; vy += e * dx;
  }
  // the jet: speed aw at its core, a ridge and a trough that travel east, a width that breathes
  const lam = 66 + 28 * sin(0.0173 * t + ph[28]);
  const kk = TP / lam;
  const m = 8 + 4 * sin(0.0229 * t + ph[29]);
  const yj = 38 + 12 * sin(0.0131 * t + ph[30]) + m * sin(kk * (x - 1.3 * t) + ph[31]);
  const yjx = m * kk * cos(kk * (x - 1.3 * t) + ph[31]);
  const aw = 2.1 + 1.0 * sin(0.0197 * t + ph[32]);
  const wj = 11 + 3 * sin(0.0283 * t + ph[33]);
  const th = tanh((y - yj) / wj);
  const sech2 = 1 - th * th;
  vx += aw * sech2; vy += aw * sech2 * yjx;
  // a weak northward drift on its own clock
  vy -= 0.7 + 0.45 * sin(0.0151 * t + ph[34]);
  o[0] = vx; o[1] = vy;
}

// ---- storms ---------------------------------------------------------------------------------
function makeStorm() {
  return {
    used: false, born: 0, age: 0, life: 45, nextS: 0, n: 0, fade: 0, off: 0,
    pts: new Float32Array(MMAX * NPT * 2),
    cx: new Float64Array(MMAX), cy: new Float64Array(MMAX),
    alive: new Uint8Array(MMAX), last: new Int16Array(MMAX),
    wz: new Float64Array(MMAX), zd: new Float64Array(MMAX), zv: new Float64Array(MMAX),
    hu: new Float64Array(MMAX),
    mean: new Float32Array(NPT * 2), spr: new Float32Array(NPT), sx: 0,
  };
}

export function setup(params) {
  const ph = new Float64Array(NPH);
  for (let i = 0; i < NPH; i++) ph[i] = rnd() * TP;
  const storms = [];
  for (let i = 0; i < NSTORM; i++) storms.push(makeStorm());
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    t: 300 + rnd() * 600,          // the flow's own clock, in model seconds
    ph, storms,
    hueSeq: -0.3 + rnd() * 0.06, lastSpawn: 0, gap: 8, tgPh: rnd() * TP,
    o: [0, 0], se: 1, M: 19,
    acc: new Float32Array(N * 3), ov: new Float32Array(N * 4), cone: new Float32Array(CW * CH * 3),
    heads: [], job: null,
    pv: { x: new Float64Array(10), y: new Float64Array(10), w: new Float64Array(10), d: new Float64Array(10), v: new Float64Array(10) },
  });
  return st;
}

// one RK2 step of a member: the flow it feels is its steering layer's weight w times the flow read
// d seconds early or late and turned by the angle th, plus the beta drift; the result is left in o2
function rk2(ph, o, x, y, tm, h, w, d, th, o2) {
  const c = w * cos(th), sn = w * sin(th);
  flow(ph, x, y, tm + d, o);
  const ux = c * o[0] - sn * o[1] + BX, uy = sn * o[0] + c * o[1] + BY;
  flow(ph, x + 0.5 * h * ux, y + 0.5 * h * uy, tm + d + 0.5 * h, o);
  o2[0] = x + h * (c * o[0] - sn * o[1] + BX); o2[1] = y + h * (sn * o[0] + c * o[1] + BY);
}

// advance one storm by dtm model seconds; samples fall exactly on multiples of TS
const o2 = [0, 0];
function advance(st, S, dtm) {
  const se = st.se, ph = st.ph, o = st.o;
  let rem = dtm;
  while (rem > 1e-9) {
    let h = min(0.1, rem);
    const toNext = S.nextS - S.age;
    if (toNext < h) h = max(toNext, 1e-6);
    const tm = S.born + S.age;
    for (let m = 0; m < MMAX; m++) {
      if (!S.alive[m]) continue;
      rk2(ph, o, S.cx[m], S.cy[m], tm, h, 1 + 0.25 * se * S.wz[m], 5 * se * S.zd[m], VEER * se * S.zv[m], o2);
      const x = o2[0], y = o2[1];
      S.cx[m] = x; S.cy[m] = y;
      if (x < -30 || x > 94 || y < -26 || y > 150) { S.alive[m] = 0; S.last[m] = S.n - 1; }
    }
    S.age += h; rem -= h;
    if (S.age >= S.nextS - 1e-7) {
      if (S.n < NPT) {
        for (let m = 0; m < MMAX; m++) {
          if (!S.alive[m]) continue;
          const j = (m * NPT + S.n) * 2;
          S.pts[j] = S.cx[m]; S.pts[j + 1] = S.cy[m];
        }
        S.n++;
      }
      S.nextS += TS;
    }
  }
}

// A dry run of a storm that would start at (x0, y0) now: nine members through the flow with the
// current spread, to see where the fan would go before the storm is born.
const PV = 9;
function preview(st, x0, y0, life, others) {
  const pv = st.pv, ph = st.ph, o = st.o, se = max(st.se, 0.6);
  for (let m = 0; m < PV; m++) {
    const z = m === 0 ? 0 : 1;
    pv.x[m] = x0 + z * (0.03 + 3.0 * pow(se, 1.5)) * gauss(); pv.y[m] = y0 + z * (0.03 + 3.0 * pow(se, 1.5)) * gauss();
    pv.w[m] = 1 + z * 0.25 * se * rr(-1, 1); pv.d[m] = z * 5 * se * gauss(); pv.v[m] = z * VEER * se * rr(-1, 1);
  }
  const h = 0.8, steps = floor(min(life, 44) / h);
  let near = 0, cnt = 0, ymin = y0, outs = 0, axs = 0;
  for (let i = 0; i < steps; i++) {
    const tm = st.t + i * h;
    for (let m = 0; m < PV; m++) {
      rk2(ph, o, pv.x[m], pv.y[m], tm, h, pv.w[m], pv.d[m], pv.v[m], o2);
      pv.x[m] = o2[0]; pv.y[m] = o2[1];
    }
    if (pv.y[0] < ymin) ymin = pv.y[0];
    axs += pv.x[0];
    if (pv.x[0] < -2 || pv.x[0] > 66) outs++;
    // how far the control run stays from the other storms' means
    if (i % 3 === 2) {
      let dm = 30;
      for (const S of others) {
        for (let j = 0; j < S.n; j += 3) {
          const dx = S.mean[j * 2] - pv.x[0], dy = S.mean[j * 2 + 1] - pv.y[0];
          const d = dx * dx + dy * dy;
          if (d < dm * dm) dm = sqrt(d);
        }
      }
      near += min(dm, 20); cnt++;
    }
  }
  let mx = 0, my = 0;
  for (let m = 0; m < PV; m++) { mx += pv.x[m]; my += pv.y[m]; }
  mx /= PV; my /= PV;
  let vxx = 0, vyy = 0;
  for (let m = 0; m < PV; m++) { vxx += (pv.x[m] - mx) ** 2; vyy += (pv.y[m] - my) ** 2; }
  const spread = sqrt((vxx + vyy) / PV);
  // the widest gap in the final positions along the longer axis, as a share of their range
  const axis = vxx > vyy ? pv.x : pv.y;
  const srt = Array.from(axis.subarray(0, PV)).sort((a, b) => a - b);
  let gap = 0, gi = 0;
  for (let m = 1; m < PV; m++) if (srt[m] - srt[m - 1] > gap) { gap = srt[m] - srt[m - 1]; gi = m; }
  const range = max(srt[PV - 1] - srt[0], 1e-3);
  const small = min(gi, PV - gi);
  return { spread, ymin, ax: axs / max(steps, 1), out: outs / steps, split: small >= 2 ? gap / range : 0, near: cnt ? near / cnt : 20 };
}

function startPoint() {
  const r = rnd();
  if (r < 0.28) return [rr(8, 22), rr(108, 124)];
  if (r < 0.54) return [rr(24, 42), rr(112, 126)];
  if (r < 0.80) return [rr(44, 58), rr(108, 124)];
  if (r < 0.90) return [rr(4, 9), rr(80, 100)];
  return [rr(55, 60), rr(84, 104)];
}

// A new storm is chosen in two parts so that no frame pays for all of it: a job tries start points
// a few at a time, keeping the one whose fan is the kind of forecast wanted now (tight, wide or
// split) that heads north and keeps clear of the other storms, and then the storm is born there.
const NCAND = 14;
function beginSpawn(st) {
  refreshMeans(st);
  const others = st.storms.filter((q) => q.used && q.age < q.life);
  // where the other storms lie on the panel, left to right, so a new one can go where it is empty
  let ox = 32, on = 0;
  for (const S of others) for (let j = 0; j < S.n; j += 2) { on++; ox += S.mean[j * 2] - 32; }
  return { life: rr(35, 55), mood: rnd(), c: 0, best: null, bs: -1e9, others, ox: ox / (on + 1) };
}

function stepSpawn(st, J, n) {
  for (let i = 0; i < n && J.c < NCAND; i++, J.c++) {
    const p = startPoint();
    const r = preview(st, p[0], p[1], J.life, J.others);
    let close = 0;
    for (const q of J.others) close += max(0, 1 - abs(q.sx - p[0]) / 22);
    let sc = 10 * cl((70 - r.ymin) / 70, 0, 1) - 16 * r.out + r.near * 0.3 - 6 * close;
    if (J.others.length) sc += 3 * min(abs(r.ax - J.ox) / 20, 1.5);
    if (J.mood < 0.25) sc -= r.spread * 0.3;                        // a tight forecast
    else if (J.mood < 0.65) sc -= abs(r.spread - 22) * 0.3;         // a wide fan
    else sc += r.split * 12 + r.spread * 0.1;                       // two families
    if (sc > J.bs) { J.bs = sc; J.best = p; }
  }
  return J.c >= NCAND;
}

function finishSpawn(st, J, age, ended) {
  let S = null;
  for (let i = 0; i < NSTORM; i++) if (!st.storms[i].used) { S = st.storms[i]; break; }
  if (!S) return null;
  S.used = true; S.fade = 0;
  S.life = J.life;
  S.born = st.t - age;
  S.age = 0; S.nextS = 0; S.n = 0;
  st.hueSeq = (st.hueSeq + rr(0.22, 0.38)) % 1;
  S.off = st.hueSeq;
  const x = J.best[0], y = J.best[1];
  S.sx = x;
  const sig0 = 0.03 + 3.0 * pow(st.se, 1.5);
  for (let m = 0; m < MMAX; m++) {
    S.wz[m] = rr(-1, 1);
    S.zd[m] = gauss();
    S.zv[m] = rr(-1, 1);
    S.hu[m] = (S.zv[m] + 1) * 0.5;
    S.cx[m] = x + sig0 * gauss(); S.cy[m] = y + sig0 * gauss();
    S.alive[m] = 1; S.last[m] = 0;
    const j = m * NPT * 2; S.pts[j] = S.cx[m]; S.pts[j + 1] = S.cy[m];
  }
  S.n = 1; S.nextS = TS;
  st.lastSpawn = st.t - age;
  if (age > 0) advance(st, S, min(age, S.life - (ended ? 0 : 0.5)));
  return S;
}

function spawn(st, age, ended) {
  const J = beginSpawn(st);
  stepSpawn(st, J, NCAND);
  return finishSpawn(st, J, age, ended);
}

function activeCount(st) {
  let c = 0;
  for (const S of st.storms) if (S.used && S.age < S.life) c++;
  return c;
}

// one step of the world; dt in real seconds
function step(st, dt, ks) {
  const sp = pow(1.7, cl(ks[2], -1, 1));
  const dtm = dt * sp;
  st.se = cl(ks[1], 0, 3) * 0.5;
  st.t += dtm;
  for (const S of st.storms) {
    if (!S.used) continue;
    if (S.age < S.life) {
      advance(st, S, min(dtm, S.life - S.age));
      if (S.life - S.age < 1e-6) S.age = S.life;
    } else {
      S.fade += dt;
      if (S.fade > FADE) S.used = false;
    }
  }
  const target = 2.7 + 0.7 * sin(0.0071 * st.t + st.tgPh) + 0.25 * sin(0.0113 * st.t);
  const want = target >= 2.5 ? 3 : 2;
  if (st.job) {
    if (stepSpawn(st, st.job, 3)) { finishSpawn(st, st.job, 0, false); st.job = null; st.gap = rr(6, 12); }
  } else {
    const act = activeCount(st);
    if (act < want && (act < 2 || st.t - st.lastSpawn >= st.gap)) st.job = beginSpawn(st);
  }
}

// six lines at -1, fifteen at the opening, forty-eight at 1
const members = (k) => 6 * pow(8, pow((cl(k, -1, 1) + 1) * 0.5, 1.3));

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    st.se = cl(st.ks[1], 0, 3) * 0.5;
    st.M = members(st.ks[3]);
    // the sky has been busy: one storm nearly done, one under way, one that has just ended and is
    // fading; they have run for as long as the steering speed would have carried them
    const sp = pow(1.7, cl(st.ks[2], -1, 1));
    spawn(st, 40 * sp, false);
    refreshMeans(st);
    spawn(st, 18 * sp, false);
    refreshMeans(st);
    const c = spawn(st, 70, true);
    if (c) { c.age = c.life; c.fade = 4; }
    st.lastSpawn = st.t - 8;
  } else {
    const a = 1 - exp(-dt / 0.15);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  st.M += (members(st.ks[3]) - st.M) * (1 - exp(-dt / 0.2));
  if (dt > 0) step(st, dt, st.ks);
}

// the mean track of every live storm over all its members, for the next storm to keep clear of
function refreshMeans(st) {
  for (const S of st.storms) {
    if (!S.used) continue;
    const n = S.n;
    for (let j = 0; j < n; j++) {
      let sx = 0, sy = 0, c = 0;
      for (let m = 0; m < MMAX; m++) {
        if (S.alive[m] || j <= S.last[m]) { sx += S.pts[(m * NPT + j) * 2]; sy += S.pts[(m * NPT + j) * 2 + 1]; c++; }
      }
      if (c === 0) { S.mean[j * 2] = S.mean[j * 2 - 2]; S.mean[j * 2 + 1] = S.mean[j * 2 - 1]; continue; }
      S.mean[j * 2] = sx / c; S.mean[j * 2 + 1] = sy / c;
    }
  }
}

// ---- drawing --------------------------------------------------------------------------------
// A line is a chain of segments, each drawn for the pixels whose foot on the segment falls
// inside it, widened a little at both ends with weights that add to one across a joint, so a
// bend leaves no bead and no gap. Pixel weight is a Gaussian of the distance to the line.
const GS = 40, QMAX = 7;
const GL = new Float32Array(GS * QMAX + 2);
for (let i = 0; i < GL.length; i++) GL[i] = exp(-0.5 * (i / GS));

function hue3(h, out) {
  h -= floor(h);
  const h6 = h * 6;
  const r = cl(abs(h6 - 3) - 1, 0, 1);
  const g = cl(2 - abs(h6 - 2), 0, 1);
  const b = cl(2 - abs(h6 - 4), 0, 1);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const gain = min(1.15, pow(0.6 / max(lum, 0.05), 0.55));
  out[0] = r * gain; out[1] = g * gain; out[2] = b * gain;
}

// adds a * Gaussian(distance to the segment) times the colour into buf, nc channels a cell
function seg(buf, nc, gw, gh, x0, y0, x1, y1, a0, a1, sg, cr, cg, cb, capS, capE) {
  const dx = x1 - x0, dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-6) return;
  const il2 = 1 / l2, hh = 0.3;
  const R = sqrt(QMAX) * sg;
  const pad = R + hh * sqrt(l2);
  const xa = max(0, floor(min(x0, x1) - pad)), xb = min(gw - 1, ceil(max(x0, x1) + pad));
  const ya = max(0, floor(min(y0, y1) - pad)), yb = min(gh - 1, ceil(max(y0, y1) + pad));
  const isg = GS / (sg * sg);
  for (let y = ya; y <= yb; y++) {
    const py = y + 0.5 - y0;
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0;
      const t = (px * dx + py * dy) * il2;
      let wt = 1, d2;
      if (t < 0) {
        if (capS) d2 = px * px + py * py;
        else { if (t < -hh) continue; wt = 0.5 + t / (2 * hh); const c = px * dy - py * dx; d2 = c * c * il2; }
      } else if (t > 1) {
        if (capE) { const qx = px - dx, qy = py - dy; d2 = qx * qx + qy * qy; }
        else { if (t > 1 + hh) continue; wt = 0.5 + (1 - t) / (2 * hh); const c = px * dy - py * dx; d2 = c * c * il2; }
      } else {
        const c = px * dy - py * dx; d2 = c * c * il2;
        if (!capS && t < hh) wt = 0.5 + t / (2 * hh);
        if (!capE && t > 1 - hh) wt *= 0.5 + (1 - t) / (2 * hh);
      }
      const q = (d2 * isg) | 0;
      if (q >= GS * QMAX) continue;
      const tc = t < 0 ? 0 : t > 1 ? 1 : t;
      const v = (a0 + (a1 - a0) * tc) * wt * GL[q];
      const j = (y * gw + x) * nc;
      buf[j] += cr * v; buf[j + 1] += cg * v; buf[j + 2] += cb * v;
      if (nc === 4) buf[j + 3] += v;
    }
  }
}

const cc = [0, 0, 0];

function drawStorm(st, S, k1) {
  const M = st.M, Mi = min(MMAX, ceil(M - 0.02));
  const mfrac = M - floor(M);
  const n = S.n;
  if (n < 1) return;
  let fa = 1;
  if (S.age >= S.life) { const u = cl(S.fade / FADE, 0, 1); fa = (1 - u) * (1 - u); }
  const hl = cl((S.life - S.age) / 2.5, 0, 1);       // the heads go out as the storm ends
  const lone = 0.46 * pow(12 / max(M, 6), 0.55) * fa;
  const acc = st.acc, ov = st.ov;
  const hb = k1 + HOFF + S.off;
  // members
  for (let m = 0; m < Mi; m++) {
    const w = m < floor(M) ? 1 : mfrac;
    if (w < 0.03) continue;
    hue3(hb + HSPREAD * (S.hu[m] - 0.5), cc);
    const al = lone * w;
    const alive = S.alive[m] === 1;
    const lastJ = alive ? n - 1 : min(S.last[m], n - 1);
    const base = m * NPT * 2;
    const tot = max(1, lastJ + 1);
    let px = S.pts[base], py = S.pts[base + 1];
    for (let j = 1; j <= lastJ; j++) {
      const qx = S.pts[base + j * 2], qy = S.pts[base + j * 2 + 1];
      const a0 = al * (0.22 + 0.78 * pow((j - 1) / tot, 1.3)), a1 = al * (0.22 + 0.78 * pow(j / tot, 1.3));
      seg(acc, 3, W, H, px, py, qx, qy, a0, a1, SGM, cc[0], cc[1], cc[2], j === 1, false);
      px = qx; py = qy;
    }
    seg(acc, 3, W, H, px, py, S.cx[m], S.cy[m], al * (0.22 + 0.78 * pow(lastJ / tot, 1.3)), al, SGM, cc[0], cc[1], cc[2], lastJ === 0, true);
  }
  // ensemble mean over the first Mi members
  let nm = 0;
  for (let j = 0; j < n; j++) {
    let sx = 0, sy = 0, c = 0;
    for (let m = 0; m < Mi; m++) {
      if (S.alive[m] || j <= S.last[m]) { sx += S.pts[(m * NPT + j) * 2]; sy += S.pts[(m * NPT + j) * 2 + 1]; c++; }
    }
    if (c < max(2, 0.3 * Mi)) break;
    sx /= c; sy /= c;
    let v = 0;
    for (let m = 0; m < Mi; m++) {
      if (S.alive[m] || j <= S.last[m]) { const ex = S.pts[(m * NPT + j) * 2] - sx, ey = S.pts[(m * NPT + j) * 2 + 1] - sy; v += ex * ex + ey * ey; }
    }
    S.mean[j * 2] = sx; S.mean[j * 2 + 1] = sy; S.spr[j] = sqrt(v / c);
    nm = j + 1;
  }
  let hx = 0, hy = 0, hc = 0;
  for (let m = 0; m < Mi; m++) if (S.alive[m]) { hx += S.cx[m]; hy += S.cy[m]; hc++; }
  const hasHead = hc >= max(2, 0.3 * Mi) && nm === n;
  if (hasHead) { hx /= hc; hy /= hc; }
  // the cone: a soft glow round the mean as wide as the members are spread, on a grid a quarter the size
  hue3(hb, cc);
  for (let j = 1; j < nm; j++) {
    const sg = (0.75 * 0.5 * (S.spr[j - 1] + S.spr[j]) + 2.4) * 0.25;
    seg(st.cone, 3, CW, CH, S.mean[j * 2 - 2] * 0.25, S.mean[j * 2 - 1] * 0.25, S.mean[j * 2] * 0.25, S.mean[j * 2 + 1] * 0.25, CONE * fa, CONE * fa, sg, cc[0], cc[1], cc[2], j === 1, false);
  }
  // the mean, in warm white, twice as thick
  const ma = 0.9 * fa;
  for (let j = 1; j < nm; j++) {
    seg(ov, 4, W, H, S.mean[j * 2 - 2], S.mean[j * 2 - 1], S.mean[j * 2], S.mean[j * 2 + 1], ma * 0.6, ma * (0.6 + 0.4 * j / nm), 1.5, 1.0, 0.86, 0.62, j === 1, false);
  }
  if (nm > 0 && hasHead) {
    seg(ov, 4, W, H, S.mean[nm * 2 - 2], S.mean[nm * 2 - 1], hx, hy, ma * 0.9, ma, 1.5, 1.0, 0.86, 0.62, nm === 1, true);
  }
  // heads wait to be put on top of everything
  if (hl > 0) {
    for (let m = 0; m < Mi; m++) {
      if (!S.alive[m]) continue;
      const w = m < floor(M) ? 1 : mfrac;
      hue3(hb + HSPREAD * (S.hu[m] - 0.5), cc);
      st.heads.push(S.cx[m], S.cy[m], 1.5, 0.5 + 0.5 * cc[0], 0.5 + 0.5 * cc[1], 0.5 + 0.5 * cc[2], 0.95 * hl * w * fa);
    }
  }
  if (hasHead && hl > 0) st.heads.push(hx, hy, 2, 1.0, 0.93, 0.8, hl * fa);
}

function dot(buf, x0, y0, rad, cr, cg, cb, a) {
  const xa = max(0, floor(x0 - rad - 1)), xb = min(W - 1, ceil(x0 + rad + 1));
  const ya = max(0, floor(y0 - rad - 1)), yb = min(H - 1, ceil(y0 + rad + 1));
  for (let y = ya; y <= yb; y++) {
    const py = y + 0.5 - y0;
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0;
      let v = (rad + 0.5 - sqrt(px * px + py * py)) / 1.4;
      if (v <= 0) continue;
      if (v > 1) v = 1;
      v = v * v * (3 - 2 * v) * a;
      const j = (y * W + x) * 4, k = 1 - v;
      buf[j] = buf[j] * k + cr * v; buf[j + 1] = buf[j + 1] * k + cg * v; buf[j + 2] = buf[j + 2] * k + cb * v;
      buf[j + 3] = buf[j + 3] * k + v;
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  const acc = st.acc, ov = st.ov;
  acc.fill(0); ov.fill(0); st.cone.fill(0);
  st.heads.length = 0;
  const k1 = st.ks[0];
  for (const S of st.storms) if (S.used) drawStorm(st, S, k1);
  // the mean lines added up coverage; fold it to at most one, then put the heads over it
  for (let o = 0; o < N * 4; o += 4) {
    const a = ov[o + 3];
    if (a > 1) { const f = 1 / a; ov[o] *= f; ov[o + 1] *= f; ov[o + 2] *= f; ov[o + 3] = 1; }
  }
  const hd = st.heads;
  for (let i = 0; i < hd.length; i += 7) dot(ov, hd[i], hd[i + 1], hd[i + 2], hd[i + 3], hd[i + 4], hd[i + 5], hd[i + 6]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, j = i * 3, o = i * 4;
      let r = acc[j], g = acc[j + 1], b = acc[j + 2];
      {
        let fx = (x + 0.5) * 0.25 - 0.5, fy = (y + 0.5) * 0.25 - 0.5;
        if (fx < 0) fx = 0; else if (fx > CW - 1.001) fx = CW - 1.001;
        if (fy < 0) fy = 0; else if (fy > CH - 1.001) fy = CH - 1.001;
        const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy;
        const c00 = (iy * CW + ix) * 3, c10 = c00 + 3, c01 = c00 + CW * 3, c11 = c01 + 3;
        const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
        const cn = st.cone;
        r += cn[c00] * w00 + cn[c10] * w10 + cn[c01] * w01 + cn[c11] * w11;
        g += cn[c00 + 1] * w00 + cn[c10 + 1] * w10 + cn[c01 + 1] * w01 + cn[c11 + 1] * w11;
        b += cn[c00 + 2] * w00 + cn[c10 + 2] * w10 + cn[c01 + 2] * w01 + cn[c11 + 2] * w11;
      }
      const mx = max(r, g, b);
      if (mx > 0) {
        const s = 1 / (1 + 0.9 * mx);
        r *= s; g *= s; b *= s;
        const wh = 0.18 * mx * s * mx * s;
        r += wh; g += wh; b += wh;
      }
      const a = ov[o + 3];
      if (a > 0) { const k = 1 - a; r = r * k + ov[o]; g = g * k + ov[o + 1]; b = b * k + ov[o + 2]; }
      display.setPixel(
        x, y,
        (r >= 1 ? 1 : r <= 0 ? 0 : r) * 255 + 0.5 | 0,
        (g >= 1 ? 1 : g <= 0 ? 0 : g) * 255 + 0.5 | 0,
        (b >= 1 ? 1 : b <= 0 ? 0 : b) * 255 + 0.5 | 0,
      );
    }
  }
}
