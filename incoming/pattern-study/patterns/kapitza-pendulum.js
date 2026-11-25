// ===== Patternflow pattern =====
// Title:   Kapitza Pendulum
// Family:  kapitza
// Idea:    A row of ten rods on pivots that are shaken up and down at a strength that climbs along the row, so that left of one sharp boundary the rods have fallen and hang in warm amber while right of it they stand upside down in pale sky blue, held up by nothing but the shaking, and where the shaking drifts the boundary slides along the row and the rods it crosses fall over or are flicked upright.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the inverted pendulum held up by a vibrating pivot (Stephenson 1908, from memory; Kapitza 1951, from memory); the effective potential of the fast motion averaged out, stable upright once (a w)^2 > 2 g l (Landau and Lifshitz, Mechanics, from memory); the hanging rod stays stable too under strong shaking, so the strong side holds both states; the numbers and the kicks are original, pattern round 242
// Round:   242
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Shake=0..4, Kick=-1..1, Spread=-1..1
//
// Knob 1: Hue. Turns the colour round the wheel and opens with the standing rods in pale sky blue and the fallen ones in amber and gold; a rod that is caught half way between shows violet and rose.
// Knob 2: Shake. 0 to 4, opening at 2: the mean strength of the shaking over the row. Low, the boundary sits at the right end and almost every rod hangs; at the opening it stands a little left of the middle with about six rods up; at the top almost all of them stand, and the pivots buzz a third wider.
// Knob 3: Kick. -1 to 1, opening at 0: the size of the random knocks, from 0.12 to 2 of the opening size (a quarter of it at the bottom, four times at the top). Low, the standing rods hardly sway and the fallen ones hang still, with a rare flick. At the top the standing rods lean and wander several LED and the ones near the boundary keep falling over and being thrown back up.
// Knob 4: Spread. -1 to 1, opening at about 0: how much the shaking differs from one end of the row to the other, 0.2 of the mean at the bottom, 0.5 at the opening and 1.2 at the top. A small spread puts the boundary wherever Shake says and the whole row crosses it together as the strength drifts; a large one gives each column a strength of its own, the boundary stays sharp and short, and the far left pivots barely move.

const W = 64, H = 128;
const { floor, min, max, abs, sin, cos, sqrt, pow, exp, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const TAU = 2 * PI;

// ---- the world ----------------------------------------------------------------
const N = 10;                 // rods in the row
const Y0 = 68;                // pivot row, LED from the top
const G = 150;                // gravity, LED a second squared: a rod 45 LED long swings in 3.4 s
const OM = 70;                // the shaking, radians a second: 11 Hz, 38 times the hanging swing
const GAM = 0.3;              // damping a second
const HS = 0.0045;            // one small step of the integrator, seconds
const PRE = 40;               // seconds run before the first frame

// ---- noise ---------------------------------------------------------------------
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// ---- colour --------------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The colour of a rod by how upright it is, u = 1 standing and 0 hanging: pale sky, then violet and rose in the short stretch
// between, then amber. NR steps; dim ends are lifted and paled so no amber goes brown on the panel.
const NR = 48;
function buildRamp(ramp, hue) {
  const c = [0, 0, 0];
  for (let i = 0; i < NR; i++) {
    const u = i / (NR - 1), t = sstep(0.12, 0.88, 1 - u);
    const h = 0.545 + hue + 0.575 * t - 0.03 * sin(PI * t);
    const s = mix(0.4, 0.84, sstep(0, 0.75, t)) * (1 - 0.25 * sstep(0.85, 1, t));
    hsv(h, s, 1, c, 0);
    ramp[i * 3] = c[0];
    ramp[i * 3 + 1] = c[1];
    ramp[i * 3 + 2] = c[2];
  }
}

// ---- state ---------------------------------------------------------------------
export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, acc: 0, hue: -9, ramp: new Float32Array(NR * 3),
    th: new Float64Array(N), v: new Float64Array(N), u: new Float64Array(N), cx: new Float64Array(N), len: new Float64Array(N),
    ph: new Float64Array(N), off: new Float64Array(N), f: new Float64Array(N), a: new Float64Array(N), lastKick: new Float64Array(N),
    wph: [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU], sub: 0,
    px: new Float64Array(N), py: new Float64Array(N), bx: new Float64Array(N), by: new Float64Array(N),
    tr: new Float32Array(W * H * 3),
    sr: new Float32Array(W * H), sg: new Float32Array(W * H), sb: new Float32Array(W * H), sa: new Float32Array(W * H),
    gr: new Float32Array(W * H), gg: new Float32Array(W * H), gb: new Float32Array(W * H),
    flicks: 0, topples: 0, pend: [], okf: 0,
  });
  for (let i = 0; i < N; i++) {
    st.cx[i] = (W / N) * (i + 0.5);
    st.len[i] = 45 + 5 * sin(i * 2.399 + 1.1) - 1.5 * cos(i * 4.1);
    st.ph[i] = rnd() * TAU;
    st.off[i] = 0.035 * gauss();
    st.th[i] = (rnd() - 0.5) * 0.5;
    st.u[i] = 1;
  }
  return st;
}

// The strength of the shaking at column i, in units of the one that just holds a rod up (aw)^2 = 2 g l. The mean, the slope along
// the row and the slow wander of it all come from here.
function wander(t, st) {
  return 0.1 * sin((TAU * t) / 67.3 + st.wph[0]) + 0.07 * sin((TAU * t) / 41.1 + st.wph[1]) + 0.05 * sin((TAU * t) / 23.7 + st.wph[2]);
}
function strengths(st) {
  const M = 0.85 + 0.125 * cl(st.k[1], 0, 4), s = 0.5 * pow(2.4, cl(st.k[3], -1, 1)), w = wander(st.t, st);
  for (let i = 0; i < N; i++) {
    const x = (i - (N - 1) / 2) / ((N - 1) / 2);
    const f = cl(M * (1 + s * x) + w + st.off[i], 0.15, 2.8);
    st.f[i] = f;
    st.a[i] = (f * sqrt(2 * G * st.len[i])) / OM;
  }
}

// ---- the physics ---------------------------------------------------------------
// theta is the angle from straight up. The pivot rises y = a cos(psi), so the rod feels g - a w^2 cos(psi):
// theta'' = (g - a w^2 cos psi) / l sin theta - gamma theta'.
function accel(th, v, c, aw2, l) {
  return ((G - aw2 * c) / l) * sin(th) - GAM * v;
}
let RT = 0, RV = 0;
function rk4(th, v, psi, h, aw2, l) {
  const c0 = cos(psi), cm = cos(psi + (OM * h) / 2), c1 = cos(psi + OM * h);
  const a1 = accel(th, v, c0, aw2, l);
  const t2 = th + 0.5 * h * v, v2 = v + 0.5 * h * a1, a2 = accel(t2, v2, cm, aw2, l);
  const t3 = th + 0.5 * h * v2, v3 = v + 0.5 * h * a2, a3 = accel(t3, v3, cm, aw2, l);
  const t4 = th + h * v3, v4 = v + h * a3, a4 = accel(t4, v4, c1, aw2, l);
  th += (h / 6) * (v + 2 * v2 + 2 * v3 + v4);
  v += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
  if (th > PI) th -= TAU;
  else if (th < -PI) th += TAU;
  RT = th;
  RV = v;
}
function stepPend(st, i, h) {
  rk4(st.th[i], st.v[i], OM * st.sub * HS + st.ph[i], h, st.a[i] * OM * OM, st.len[i]);
  st.th[i] = RT;
  st.v[i] = RV;
}
// Whether a rod that starts from the angle and speed given, shaken as it is now, ends up standing after a few seconds.
function lands(st, i, th, v) {
  const aw2 = st.a[i] * OM * OM, l = st.len[i], s0 = st.sub;
  for (let n = 0; n < 1200; n++) {
    rk4(th, v, OM * (s0 + n) * HS + st.ph[i], HS, aw2, l);
    th = RT;
    v = RV;
  }
  return cos(th) > 0.7;
}

// The knocks. A steady jostle (white noise on the angle) keeps the standing rods swaying, and every so often one rod is hit hard:
// a standing one with a knock that may or may not carry it past the saddle, a fallen one on the strong side with a flick that
// would just swing it up past the top if the shaking is going to catch it there.
function kicks(st, dt) {
  const kk = 0.5 * pow(4, cl(st.k[2], -1, 1)), nz = 0.03 + 0.1 * kk, sk = sqrt(kk);
  for (let i = 0; i < N; i++) {
    const O0 = sqrt(G / st.len[i]), f = st.f[i], up = cos(st.th[i]) > 0.3, sgn = rnd() < 0.5 ? -1 : 1;
    if (up) {
      // a jolt, a fraction of what it takes to push the rod over the saddle at this strength, now and then a bit more
      if (rnd() < dt * 0.035 * (0.3 + kk)) {
        st.v[i] += sgn * O0 * (abs(f - 1 / f) + 0.12) * sk * (0.3 + 1.3 * rnd());
        st.topples++;
      }
    } else if (f > 1.12 && abs(st.v[i]) < 3 * O0) {
      // a flick that, with luck, carries the fallen rod past the top, where the shaking can catch it
      if (rnd() < dt * 0.07 * (0.5 + 0.5 * sk)) {
        // try a handful of strengths of flick against the same shaking and keep one of those that lands
        const dir = rnd() < 0.5 ? -1 : 1, ok = [];
        for (let m = 0; m < 12; m++) {
          const q = 0.97 + 0.04 * m;
          if (lands(st, i, st.th[i], st.v[i] + dir * O0 * (f + 1 / f) * q)) ok.push(q);
        }
        if (ok.length) {
          st.v[i] += dir * O0 * (f + 1 / f) * ok[floor(rnd() * ok.length)];
          st.flicks++;
          st.pend.push([i, st.t + 9]);
        }
      }
    } else if (rnd() < dt * 0.04 * (0.5 + kk)) st.v[i] += sgn * O0 * (0.3 + 0.6 * rnd()) * sk;
    st.v[i] += sqrt(2 * dt) * nz * O0 * sqrt(GAM) * gauss();
  }
  for (let q = st.pend.length - 1; q >= 0; q--) {
    if (st.t >= st.pend[q][1]) {
      if (cos(st.th[st.pend[q][0]]) > 0.3) st.okf++;
      st.pend.splice(q, 1);
    }
  }
}

// tip of rod i at the pivot's phase now, and a splat of the colour into the long-exposure trail
function deposit(st, i, wgt) {
  const psi = OM * st.sub * HS + st.ph[i], yp = st.a[i] * cos(psi);
  const th = st.th[i], x = st.cx[i] + st.len[i] * sin(th), y = Y0 - yp - st.len[i] * cos(th);
  const x0 = floor(x - 0.5), y0 = floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
  const ui = floor(cl(st.u[i], 0, 1) * (NR - 1) + 0.5) * 3, tr = st.tr, r = st.ramp;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const xx = x0 + dx, yy = y0 + dy;
      if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const w = wgt * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy), o = (yy * W + xx) * 3;
      tr[o] += r[ui] * w;
      tr[o + 1] += r[ui + 1] * w;
      tr[o + 2] += r[ui + 2] * w;
    }
  }
}

const TRAIL_TAU = 3.2;
const TRAIL_RATE = 3.6;          // intensity a second a splat deposits, so a tip that stays put reaches TRAIL_RATE * TRAIL_TAU / 2 spread

function advance(st, dt) {
  strengths(st);
  kicks(st, dt);
  st.acc += dt;
  let n = 0;
  const dec = exp(-dt / TRAIL_TAU), tr = st.tr;
  if (dec < 1) for (let p = 0; p < tr.length; p++) tr[p] *= dec;
  while (st.acc >= HS) {
    st.acc -= HS;
    for (let i = 0; i < N; i++) stepPend(st, i, HS);
    st.sub++;
    if (n++ % 3 === 0) for (let i = 0; i < N; i++) deposit(st, i, TRAIL_RATE * HS * 3);
  }
  const lp = 1 - exp(-dt / 0.22);
  for (let i = 0; i < N; i++) st.u[i] += (sstep(-0.6, 0.6, cos(st.th[i])) - st.u[i]) * lp;
  st.t += dt;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.init = true;
    // run some seconds before the first frame: the rods on the weak side fall and settle, the ones on the strong side stand
    for (let n = 0; n < PRE * 10; n++) advance(st, 0.1);
    st.tr.fill(0);
    for (let n = 0; n < 40; n++) advance(st, 0.1);
    for (let i = 0; i < N; i++) st.u[i] = sstep(-0.6, 0.6, cos(st.th[i]));
  }
  advance(st, cl(dt || 0, 0, 0.1));
}

// ---- drawing -------------------------------------------------------------------
function capsule(st, ax, ay, bx, by, hw, c0, c1, alpha) {
  const x0 = max(0, floor(min(ax, bx) - hw - 1)), x1 = min(W - 1, floor(max(ax, bx) + hw + 1));
  const y0 = max(0, floor(min(ay, by) - hw - 1)), y1 = min(H - 1, floor(max(ay, by) + hw + 1));
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy + 1e-9;
  const sr = st.sr, sg = st.sg, sb = st.sb, sa = st.sa;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5 - ax, qy = y + 0.5 - ay, t = cl((qx * dx + qy * dy) / L2, 0, 1);
      const ex = qx - t * dx, ey = qy - t * dy, d = sqrt(ex * ex + ey * ey);
      const cov = cl(hw + 0.5 - d, 0, 1) * alpha;
      if (cov <= 0) continue;
      const p = y * W + x, k = 1 - cov, s = mix(c0, c1, t);
      sr[p] = sr[p] * k + st.cr * s * cov;
      sg[p] = sg[p] * k + st.cg * s * cov;
      sb[p] = sb[p] * k + st.cb * s * cov;
      sa[p] = sa[p] * k + cov;
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  if (abs(st.k[0] - st.hue) > 1e-4) (st.hue = st.k[0]), buildRamp(st.ramp, st.hue);
  const sr = st.sr, sg = st.sg, sb = st.sb, sa = st.sa, gr = st.gr, gg = st.gg, gb = st.gb, tr = st.tr, ramp = st.ramp;
  sr.fill(0);
  sg.fill(0);
  sb.fill(0);
  sa.fill(0);
  gr.fill(0);
  gg.fill(0);
  gb.fill(0);
  for (let i = 0; i < N; i++) {
    const psi = OM * st.sub * HS + st.ph[i], a = st.a[i], yp = a * cos(psi), th = st.th[i], l = st.len[i];
    const pyy = Y0 - yp, bx = st.cx[i] + l * sin(th), by = pyy - l * cos(th);
    const ui = floor(cl(st.u[i], 0, 1) * (NR - 1) + 0.5) * 3, cr = ramp[ui], cg = ramp[ui + 1], cb = ramp[ui + 2];
    st.cr = cr;
    st.cg = cg;
    st.cb = cb;
    // the shaken stretch of the pivot, a faint streak the length of the shaking
    for (let y = max(0, floor(Y0 - a - 2)); y <= min(H - 1, floor(Y0 + a + 2)); y++) {
      const e = sstep(0, 1.4, a + 0.7 - abs(y + 0.5 - Y0));
      for (let dx = -1; dx <= 1; dx++) {
        const x = floor(st.cx[i]) + dx;
        if (x < 0 || x >= W) continue;
        const w = 0.28 * e * (dx === 0 ? 1 : 0.5), p = y * W + x;
        gr[p] += cr * w;
        gg[p] += cg * w;
        gb[p] += cb * w;
      }
    }
    // the rod
    capsule(st, st.cx[i], pyy, bx, by, 1, 0.55, 0.85, 1);
    // the bob: a soft round 5 LED across with a glow round it and a pale core
    const R = 2.6, x0 = max(0, floor(bx - 9)), x1 = min(W - 1, floor(bx + 9)), y0 = max(0, floor(by - 9)), y1 = min(H - 1, floor(by + 9));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ex = x + 0.5 - bx, ey = y + 0.5 - by, d2 = ex * ex + ey * ey, d = sqrt(d2), p = y * W + x;
        const glow = 0.5 * exp(-d2 / 14);
        gr[p] += cr * glow;
        gg[p] += cg * glow;
        gb[p] += cb * glow;
        const cov = cl(R + 0.5 - d, 0, 1);
        if (cov <= 0) continue;
        const wc = 0.5 * exp(-d2 / 2.4), k = 1 - cov;
        sr[p] = sr[p] * k + (cr + (1 - cr) * wc) * cov;
        sg[p] = sg[p] * k + (cg + (1 - cg) * wc) * cov;
        sb[p] = sb[p] * k + (cb + (1 - cb) * wc) * cov;
        sa[p] = sa[p] * k + cov;
      }
    }
    // the pivot: a short bright bar that shakes
    const hx0 = st.cx[i] - 2, hx1 = st.cx[i] + 2, hy0 = pyy - 1, hy1 = pyy + 1;
    for (let y = max(0, floor(hy0)); y <= min(H - 1, floor(hy1)); y++) {
      for (let x = max(0, floor(hx0)); x <= min(W - 1, floor(hx1)); x++) {
        const cov = cl(min(x + 1, hx1) - max(x, hx0), 0, 1) * cl(min(y + 1, hy1) - max(y, hy0), 0, 1), p = y * W + x, k = 1 - cov;
        sr[p] = sr[p] * k + (0.55 + 0.45 * cr) * cov;
        sg[p] = sg[p] * k + (0.55 + 0.45 * cg) * cov;
        sb[p] = sb[p] * k + (0.55 + 0.45 * cb) * cov;
        sa[p] = sa[p] * k + cov;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    const dy = (y + 0.5 - Y0) / 22, band = exp(-dy * dy);
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = p * 3;
      // the ground: deep blue-black with a faint line of light where the pivots sit
      let r = 4 + 5 * band, g = 6 + 9 * band, b = 18 + 22 * band;
      // the long exposure, thresholded so a faint trail does not turn into brown
      const tm = max(tr[o], tr[o + 1], tr[o + 2]);
      if (tm > 1e-4) {
        const lv = 0.85 * sstep(0.05, 0.6, tm) / tm;
        r += tr[o] * lv * 255;
        g += tr[o + 1] * lv * 255;
        b += tr[o + 2] * lv * 255;
      }
      r += gr[p] * 255;
      g += gg[p] * 255;
      b += gb[p] * 255;
      const a = sa[p];
      if (a > 0) {
        r = r * (1 - a) + sr[p] * 255;
        g = g * (1 - a) + sg[p] * 255;
        b = b * (1 - a) + sb[p] * 255;
      }
      display.setPixel(x, y, cl(r + 0.5, 0, 255) | 0, cl(g + 0.5, 0, 255) | 0, cl(b + 0.5, 0, 255) | 0);
    }
  }
}
