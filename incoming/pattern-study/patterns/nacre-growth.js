// ===== Patternflow pattern =====
// Title:   Nacre Growth
// Family:  nacre
// Idea:    A cross-section of a growing shell filmed in time-lapse: courses of flat pearl tablets in brick bond climb out of a dark blue-grey matrix at the growth front, each tablet a soft lozenge in its own thin-film colour of pink, gold, green, cyan or lavender that widens until it meets its neighbours in a thin seam, while the finished wall slides down the panel and a slow viewing angle carries every colour along and sweeps a broad sheen across.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the brick-and-mortar structure of nacre (John Currey, 1977; Julian Vincent, Alan Jackson and Peter Turner, 1988, from memory) with tablets that nucleate above the joints of the course below, after the mineral-bridge picture of nacre growth (Tilman Schäffer, Paul Hansma and colleagues, 1997, from memory), coloured by thin-film interference as Robert Hooke saw it in mica (1665) and Isaac Newton measured it (1704); pattern round 232
// Round:   232
// ===============================
// @matrix 64x128
// @knobs Film=0..1, Growth=0.6..4, Tablets=-1..1, Sheen=-1..1
//
// Knob 1: Film. Turns every tablet's colour on round the interference wheel: the opening pearl of pink, gold, green, cyan and lavender at 0, pink tablets turned gold at 0.2, green at 0.4, cyan at 0.6, lavender at 0.8, and the pearl again at 1.
// Knob 2: Growth. How fast the shell grows: one course every 3 to 4 seconds at the opening, a third as fast at 0.6 and twice as fast at 4, the wall sliding down and the front filling in step.
// Knob 3: Tablets. The size of the bricks laid from now on: small thin tablets 6 to 9 LED long in courses 2 LED tall at -1, 9 to 16 long and 2 to 3 tall at 0, long thick ones 15 to 25 long and 3 to 4 tall at 1.
// Knob 4: Sheen. How far the viewing angle moves: at -1 it holds still and the colours stay where growth put them, at 1 every colour slides a long way along the wheel and a broad pearly band sweeps across the wall.

const W = 64;
const H = 128;
const { floor, ceil, sqrt, sin, exp, abs, max, min, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

const FRONT = 124; // height above the bottom edge where a new course is laid down: row 4 from the top
const V0 = 1.0; // LED a second the wall slides at the opening Growth
const NUC = 9; // LED of sliding over which one course's tablets nucleate
const SEAM = [34, 42, 64]; // the organic matrix: dim blue-grey
const BGC = [7, 10, 19]; // above the front
const KEYS = [
  [242, 178, 210], // pink
  [246, 218, 150], // gold
  [165, 238, 186], // green
  [140, 230, 244], // cyan
  [198, 176, 246], // lavender
];
const LUT = 1024;
const SENS = 0.4; // colour turned by one unit of viewing angle, a turn of the wheel
const GRAD = 0.55; // how much the angle differs from one end of the curved shell to the other

// ---- palette: the thin-film colour of an optical path, a number that goes round the wheel once a turn
function buildLut(P) {
  const lut = new Float32Array(LUT * 3);
  const n = KEYS.length;
  for (let i = 0; i < LUT; i++) {
    const pos = (i / LUT) * n;
    const a = floor(pos);
    const f = pos - a;
    const s = 0.5 * f + 0.5 * f * f * (3 - 2 * f);
    const c0 = KEYS[a % n];
    const c1 = KEYS[(a + 1) % n];
    for (let ch = 0; ch < 3; ch++) lut[i * 3 + ch] = mix(c0[ch], c1[ch], s);
  }
  P.lut = lut;
}

// ---- setup
export function setup(P) {
  Object.assign(P, {
    t: 0,
    sc: 0, // height of the bottom edge in the shell's own frame, grows with time
    vs: 0, // the same, as drawn: the wall holds on whole LEDs and glides between them
    nextBase: -12,
    last: null,
    courses: [],
    mu: 0,
    k0: 0,
    q: 0,
    amp: 0.5,
    sheen: 0.5,
    theta: 0,
    speed: 1,
    warm: false,
    waves: [],
    buf: new Float32Array(W * H * 3),
    ph: [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU],
  });
  buildLut(P);
  // The thickness of the tablets drifts over the wall in broad patches that slide down with it.
  // Roll the patches until the opening wall holds every colour of the wheel, none of them under a tenth of it.
  let best = -1;
  let keep = null;
  for (let tries = 0; tries < 60 && best < 0.1; tries++) {
    P.waves = [];
    for (let k = 0; k < 5; k++) {
      const lam = 38 + Math.random() * 60;
      const ang = (Math.random() - 0.5) * 1.8; // from the panel's long side
      P.waves.push({ kx: (TAU / lam) * sin(ang), ky: (TAU / lam) * Math.cos(ang), ph: Math.random() * TAU, a: 0.12 + Math.random() * 0.05 });
    }
    const bins = [0, 0, 0, 0, 0];
    for (let wy = 0; wy < H; wy += 4)
      for (let x = 0; x < W; x += 4) {
        const phi = (((0.3 + field(P, x, wy)) % 1) + 1.1) % 1;
        bins[floor(phi * 5 + 0.5) % 5]++;
      }
    const low = min(...bins) / (bins[0] + bins[1] + bins[2] + bins[3] + bins[4]);
    if (low > best) {
      best = low;
      keep = P.waves;
    }
  }
  P.waves = keep;
}

function field(P, x, w) {
  let v = 0;
  const ws = P.waves;
  for (let k = 0; k < ws.length; k++) v += ws[k].a * sin(ws[k].kx * x + ws[k].ky * w + ws[k].ph);
  return v;
}

// ---- laying a course: where its joints fall, with each tablet's own life
function offsetFrom(pj, x, lo, hi, minOff) {
  lo = ceil(lo);
  hi = floor(hi);
  if (!pj) return cl(Math.round(x), lo, hi);
  // Pull the joint toward the middle of the old tablet it lies over, so the bricks break joint.
  let i = -1;
  for (let k = 0; k + 1 < pj.length; k++)
    if (pj[k] <= x && x < pj[k + 1]) {
      i = k;
      break;
    }
  if (i >= 0) x += (0.5 * (pj[i] + pj[i + 1]) - x) * (0.35 + 0.35 * Math.random());
  x = cl(Math.round(x), lo, hi);
  for (let k = 0; k < pj.length; k++) {
    if (abs(x - pj[k]) >= minOff) continue;
    const c = [pj[k] + minOff, pj[k] - minOff].filter((v) => v >= lo && v <= hi);
    if (c.length) x = c[0] === c[c.length - 1] || abs(c[0] - x) <= abs(c[c.length - 1] - x) ? c[0] : c[c.length - 1];
  }
  return x;
}

function makeJoints(pj, slo, shi) {
  const minOff = max(3, Math.round(0.28 * slo));
  const lo0 = ceil(5 - slo);
  const J = [offsetFrom(pj, lo0 + Math.random() * (0 - lo0), lo0, 0, minOff)];
  while (J[J.length - 1] < W) {
    const last = J[J.length - 1];
    J.push(offsetFrom(pj, last + slo + Math.random() * (shi - slo), last + slo, last + shi, minOff));
  }
  // The last tablet shows at least 5 LED: fold a sliver into its neighbour.
  const n = J.length;
  if (n >= 3 && min(J[n - 1], W) - (J[n - 2] + 1) < 5) {
    if (J[n - 1] - J[n - 3] - 1 <= shi * 1.4) J.splice(n - 2, 1);
    else J[n - 2] = W - 6;
  }
  return J;
}

function spawn(P, base, sc0) {
  const q = P.q;
  const hbar = q < 0 ? 2 + 0.5 * (q + 1) : 2.5 + 1.1 * q;
  const h = floor(hbar + Math.random());
  const slo = Math.round(q < 0 ? mix(7, 10, q + 1) : mix(10, 16, q));
  const shi = Math.round(q < 0 ? mix(10, 17, q + 1) : mix(17, 26, q));
  const prev = P.last;
  const J = makeJoints(prev ? prev.J : null, slo, shi);
  P.mu = 0.95 * P.mu + 0.09 * gauss();
  P.mu = cl(P.mu, -0.3, 0.3);
  const course = { wb: base, h, sc0, J, mu: P.mu, tabs: [] };
  for (let k = 0; k + 1 < J.length; k++) {
    const xa = J[k] + 1;
    const xb = J[k + 1];
    if (xb <= 0 || xa >= W) continue;
    const v0 = max(xa, 0);
    const v1 = min(xb, W);
    const xc = 0.5 * (xa + xb);
    const xn = cl(xc + (Math.random() - 0.5) * 0.35 * (xb - xa), v0 + 2, v1 - 2);
    course.tabs.push({
      xa,
      xb,
      xn,
      far: max(xn - xa, xb - xn),
      an: NUC * Math.random(),
      tg: 8 + 6 * Math.random(),
      phi: 0.3 + field(P, xc, base + 0.5 * h) + P.mu + (Math.random() - 0.5) * 0.09,
      tilt: (Math.random() < 0.5 ? -1 : 1) * (0.07 + 0.06 * Math.random()),
      sens: 0.7 + 0.6 * Math.random(),
      lx: (Math.random() - 0.5) * 2,
    });
  }
  course.top = base + h;
  P.last = course;
  P.courses.push(course);
  P.nextBase = base + h + 1;
}

export function update(dt, input, P) {
  if (!P.courses) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  P.k0 = k[0];
  P.q = cl(k[2], -1, 1);
  const u4 = cl((k[3] + 1) / 2, 0, 1);
  P.amp = 0.04 + 0.96 * u4;
  P.sheen = 0.95 * Math.pow(u4, 1.3);
  if (!P.warm) {
    P.warm = true;
    // Open on a shell that has been growing for minutes: every course below the front is laid down at its own age.
    while (P.nextBase - FRONT <= 0) spawn(P, P.nextBase, P.nextBase - FRONT);
  }
  P.t += d;
  const v = V0 * (cl(k[1], 0.6, 4) / 2);
  P.sc += d * v;
  while (P.nextBase - P.sc <= FRONT) spawn(P, P.nextBase, P.nextBase - FRONT);
  // A seam one LED thick can only be crisp on whole LEDs, so the wall rests on one and glides to the next in a third of a second or so.
  const g = cl(0.4 * v, 0.15, 0.8);
  const fl = floor(P.sc);
  P.vs = fl + sm(1 - g, 1, P.sc - fl);
  while (P.courses.length > 1 && P.courses[0].top + 1 < P.vs) P.courses.shift();
  // The viewing angle: three slow swings that never fall into step.
  const t = P.t;
  const th = 0.55 * sin((TAU * t) / 21.3 + 0.7 + P.ph[0] * 0.15) + 0.35 * sin((TAU * t) / 34.7 + 2.2 + P.ph[1] * 0.15) + 0.25 * sin((TAU * t) / 57.9 + 4.1 + P.ph[2] * 0.15);
  P.theta = P.amp * th;
}

// ---- drawing
function paintTablet(P, c, tb, buf) {
  const age = P.sc - c.sc0 - tb.an;
  if (age <= 0) return;
  const s = min(1, age / tb.tg);
  const el = 1 - (1 - s) * (1 - s);
  const sv = min(1, age / (tb.tg * 1.15));
  const ev = 1 - (1 - sv) * (1 - sv);
  const hw = 0.6 + (tb.far - 0.6) * el;
  // A tablet cut by the panel's edge goes on past it, so it is shaded as a whole and cut after.
  const xl0 = max(tb.xa, tb.xn - hw);
  const xr0 = min(tb.xb, tb.xn + hw);
  const xl = max(xl0, 0);
  const xr = min(xr0, W);
  if (xr <= xl) return;
  const vh = 1 + (c.h - 1) * ev;
  const yb = H - (c.wb - P.vs);
  const yt = yb - vh;
  if (yb <= 0 || yt >= H) return;
  const fade = sm(0, 1.5, age);
  const xm = 0.5 * (xl0 + xr0);
  const half = 0.5 * (xr0 - xl0);
  const lut = P.lut;
  const th = P.theta;
  const sheen = P.sheen;
  const x0 = floor(xl);
  const x1 = ceil(xr) - 1;
  const y0 = max(0, floor(yt));
  const y1 = min(H - 1, ceil(yb) - 1);
  const gro = 1 - ev;
  for (let x = x0; x <= x1; x++) {
    const cx = min(x + 1, xr) - max(x, xl);
    if (cx <= 0) continue;
    const u = cl((x + 0.5 - xm) / half, -1, 1);
    const dome = 1 - u * u;
    const e = max(0, abs(u) - 0.6) / 0.4;
    const tp = min(0.34 * e * e, 0.25 * vh);
    const xd = (x / (W - 1) - 0.5) * 0.75;
    for (let y = y0; y <= y1; y++) {
      const cy = min(y + 1, yb - tp) - max(y, yt + tp);
      if (cy <= 0) continue;
      const cov = cx * cy * fade;
      const v = cl((yb - (y + 0.5)) / vh, 0, 1);
      const tl = th + GRAD * (xd + (y / (H - 1) - 0.5) * 0.55);
      let phi = P.k0 + tb.phi + tb.sens * SENS * tl + 0.06 * dome + tb.tilt * u - 0.22 * gro;
      phi -= floor(phi);
      const warm = 1 - sm(0.1, 0.22, abs(phi - 0.17));
      const li = ((phi * LUT) | 0) * 3;
      const sp = sheen * exp(-(tl * tl) / 0.05);
      let sh = 0.82 + 0.18 * dome + 0.14 * (v - 0.5) + tb.lx * u * 0.05;
      // Gold and peach go brown when dark, so the warm end of the wheel is never shaded below 0.88.
      sh = 0.9 * max(sh, 0.88 * warm) * (0.72 + 0.28 * ev) * (1 + 0.4 * sp);
      const o = (y * W + x) * 3;
      for (let ch = 0; ch < 3; ch++) {
        let col = lut[li + ch] * sh;
        col = mix(col, 246, 0.3 * sp + 0.12 * dome * dome);
        buf[o + ch] = mix(buf[o + ch], col, cov);
      }
    }
  }
}

export function draw(display, P) {
  if (!P.courses) return;
  const buf = P.buf;
  const sc = P.vs;
  const topM = P.last.top;
  const th = P.theta;
  for (let y = 0; y < H; y++) {
    const wlow = sc + (H - y - 1);
    const dp = topM - wlow;
    // The matrix thins out toward the front.
    const cm = cl(dp, 0, 1) * (0.3 + 0.7 * sm(0, 12, dp));
    const yd = (y / (H - 1) - 0.5) * 0.55;
    for (let x = 0; x < W; x++) {
      const tl = th + GRAD * ((x / (W - 1) - 0.5) * 0.75 + yd);
      const lift = 1 + 0.5 * P.sheen * exp(-(tl * tl) / 0.05);
      const o = (y * W + x) * 3;
      for (let ch = 0; ch < 3; ch++) buf[o + ch] = mix(BGC[ch], SEAM[ch] * lift, cm);
    }
  }
  for (const c of P.courses) {
    const yb = H - (c.wb - sc);
    if (yb <= 0 || yb - c.h >= H) continue;
    for (const tb of c.tabs) paintTablet(P, c, tb, buf);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, min(255, buf[o]) | 0, min(255, buf[o + 1]) | 0, min(255, buf[o + 2]) | 0);
    }
}
