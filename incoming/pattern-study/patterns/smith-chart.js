// ===== Patternflow pattern =====
// Title:   Smith Chart
// Family:  smithchart
// Idea:    A network analyser sweeping an antenna on a long cable: a Smith chart above where three resonances hang as loops off the rim and a white dot runs round them leaving a cooling trail, and a waterfall of the return loss below where each resonance is a ridge that drifts and deepens and now and then flares as a tuner pulls its loop through the centre.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Smith chart (Phillip H. Smith, Bell Telephone Laboratories, 1939, from memory; an earlier form by Tosaku Mizuhashi, 1937, from memory), the reflection coefficient of a load on a transmission line, gamma = (Z - Z0) / (Z + Z0), turning by two electrical lengths along the line (from memory), a series RLC resonance tracing a constant-resistance circle (from memory), a lossless matching network as a Moebius map of the unit disc onto itself (from memory), the vector network analyser and its return-loss display (Hewlett-Packard 8410, 1967, from memory); pattern round 234
// Round:   234
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sweep=0.3..3, Line=-1..1, Match=-1..1
//
// Knob 1: Hue. Turns the dot's trail and the ridges of the waterfall round the colour wheel: at 0 the dot is white and its trail cools through amber and red to violet while the ridges burn red to amber, at 0.25 the trail and the ridges are green, at 0.5 cyan, at 0.75 violet and magenta, and at 1 it is the opening again. The floor of the waterfall stays a dark violet-blue and the grid blue-grey.
// Knob 2: Sweep. How fast the analyser works: at 0.3 one sweep takes 21 s, the trail lasts 3.2 s and the waterfall scrolls 0.5 rows a second, so its 61 rows hold two minutes; at the opening 2 a sweep takes 3.2 s, the trail 1.1 s and the waterfall 3.4 rows a second, 18 s of history; at 3 a sweep takes 2.1 s, the trail 0.7 s and the waterfall 5.1 rows a second, 12 s.
// Knob 3: Line. The length of the cable between the antenna and the analyser: the whole chart turns about its centre as one rigid picture, a quarter turn clockwise at 0.5 and a quarter turn counter-clockwise at -0.5 from where the loops hang at 0, and at -1 and at 1 it has gone half a turn either way round to the same picture. The ridges of the waterfall stay where they are, since a lossless cable cannot change how much comes back, and only its faint floor tilts as the cable's own small mismatch comes round.
// Knob 4: Match. How well the antenna is coupled to the line: at -1 the loops are 3 to 12 LED across and hug the rim, the best return is 0.4 to 0.75 of the wave and the waterfall holds only faint violet ridges; at the opening 0.06 the loops are 9 to 32 LED across, 19 typically, the best return runs 0.03 to 0.37 and a tuner pulls one loop through the centre about a third of the time; at 1 the loops are 21 to 42 LED across, pass within 0.1 of the centre two thirds of the time, and the ridges burn amber to white.

const W = 64;
const H = 128;
const { floor, ceil, exp, log, sqrt, sin, cos, abs, min, max, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;

// ---- the instrument
const CX = 32; // the chart's centre, LED
const CY = 33;
const R = 29.5; // its rim
const SMY = 66; // the chart owns rows 0..65
const WY0 = 67; // the waterfall's newest row, and 61 rows of it
const WROWS = 61;
const NC = 64; // a column a LED
const NL = 320; // samples along the locus
const SLATE = [30, 44, 60]; // the grid, one cool tone

// ---- the load: three series resonances in parallel, on a cable
const F_MEAN = [0.17, 0.5, 0.83]; // where they sit on the axis, 0 to 1
const Q_MEAN = [30, 24, 19];
const R_FAC = [0.8, 1, 1.3];
const MIS_R = 0.026; // the connector at the analyser's end sends back a little of its own, 0.035 at 37 degrees, which tilts the floor of the waterfall as the cable's turn changes
const MIS_I = 0.021;
// slow random walks: where each resonance sits (3), its Q (3), its coupling (3), the cable's electrical length (1) and a fixed turn of it (1), the sweep's pace (1)
const OU_SIG = [0.07, 0.07, 0.07, 0.3, 0.3, 0.3, 0.55, 0.55, 0.55, 0.3, 0.6, 0.18];
const OU_TAU = [17, 19, 15, 16, 18, 14, 13, 15, 12, 50, 70, 20];

// ---- the heat scale: floor, magenta, red, amber, white
const STOPS = [
  [0, 268, 0.85, 0],
  [0.04, 268, 0.85, 0.17],
  [0.14, 292, 0.85, 0.36],
  [0.26, 322, 0.85, 0.62],
  [0.42, 352, 0.9, 0.88],
  [0.62, 392, 0.95, 1],
  [0.8, 404, 0.8, 1],
  [1, 410, 0.35, 1],
  [1.3, 410, 0.04, 1],
];
const VMAX = 1.3;
const NLUT = 400;

function hsv(h, s, v, out, o) {
  const hh = (((h % 360) + 360) % 360) / 60;
  const i = floor(hh);
  const f = hh - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  let r;
  let g;
  let b;
  if (i === 0) {
    r = v;
    g = t;
    b = p;
  } else if (i === 1) {
    r = q;
    g = v;
    b = p;
  } else if (i === 2) {
    r = p;
    g = v;
    b = t;
  } else if (i === 3) {
    r = p;
    g = q;
    b = v;
  } else if (i === 4) {
    r = t;
    g = p;
    b = v;
  } else {
    r = v;
    g = p;
    b = q;
  }
  out[o] = r * 255;
  out[o + 1] = g * 255;
  out[o + 2] = b * 255;
}

function buildLut(P, shift) {
  const L = P.lut;
  const floorHue = 266 - 14 * sin((shift * PI) / 180);
  let s = 0;
  for (let i = 0; i < NLUT; i++) {
    const v = (i / (NLUT - 1)) * VMAX;
    while (s < STOPS.length - 2 && v > STOPS[s + 1][0]) s++;
    const a = STOPS[s];
    const b = STOPS[s + 1];
    const t = cl((v - a[0]) / (b[0] - a[0]), 0, 1);
    // the ridges and the trail turn with the knob; the quiet floor and the first skirts stay a dark cool blue-violet, since a dark warm tone reads as brown
    const hot = mix(a[1], b[1], t) + shift;
    const w = sm(0.14, 0.5, v);
    const diff = ((hot - floorHue + 540) % 360) - 180;
    hsv(floorHue + diff * w, mix(a[2], b[2], t), mix(a[3], b[3], t), L, i * 3);
  }
  P.lutShift = shift;
}

// ---- the grid, built once: the rim, the real axis, the circles of constant resistance and the arcs of constant reactance
function buildGrid() {
  const G = new Float32Array(W * H);
  const circ = [];
  const add = (gx, gy, rad, v) => circ.push([gx * R, gy * R, rad * R, v]);
  for (const [r, v] of [[0.5, 0.45], [1, 0.9], [2, 0.45]]) add(r / (1 + r), 0, 1 / (1 + r), v);
  for (const [x, v] of [[0.5, 0.45], [1, 0.45], [2, 0.45]]) {
    add(1, 1 / x, 1 / x, v);
    add(1, -1 / x, 1 / x, v);
  }
  for (let y = 0; y < SMY; y++)
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - CX;
      const py = CY - (y + 0.5); // up is positive
      const d0 = sqrt(px * px + py * py);
      if (d0 > R + 1.2) continue;
      let g = 0;
      g = max(g, 1 - abs(d0 - R) / 1.1);
      if (d0 < R - 0.6) {
        g = max(g, 0.85 * max(0, 1 - abs(py) / 0.9));
        for (let c = 0; c < circ.length; c++) {
          const cc = circ[c];
          const dx = px - cc[0];
          const dy = py - cc[1];
          const o = abs(sqrt(dx * dx + dy * dy) - cc[2]);
          if (o < 1) g = max(g, cc[3] * (1 - o));
        }
      }
      G[y * W + x] = g;
    }
  return G;
}

// ---- the background: a faint cool plate, lighter toward the corners the disc leaves
function buildBg() {
  const B = new Float32Array(W * H * 3);
  for (let y = 0; y < SMY; y++)
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - CX;
      const py = y + 0.5 - CY;
      const d = sqrt(px * px + py * py) / R;
      const k = sm(0.3, 1.5, d);
      const o = (y * W + x) * 3;
      B[o] = mix(12, 18, k);
      B[o + 1] = mix(18, 25, k);
      B[o + 2] = mix(30, 39, k);
    }
  return B;
}

// ---- setup
export function setup(P) {
  const ou = OU_SIG.map((s) => s * gauss());
  Object.assign(P, {
    ou,
    wb: new Float32Array(3), // a quicker flutter of each branch's coupling, as a hand near the antenna would give it
    wbx: new Float32Array(3), // and the same after a low-pass, so a row of the waterfall does not jump from the one before
    ox: Float32Array.from(ou), // the walks after a second, slower low-pass, so a row 2 s on does not jump
    E: new Float32Array(W * H), // the trail's phosphor, in heat units
    LV: new Float32Array(W * H), // this moment's whole locus
    grid: buildGrid(),
    bg: buildBg(),
    lut: new Float32Array(NLUT * 3),
    lutShift: -999,
    rows: Array.from({ length: WROWS + 2 }, () => new Float32Array(NC)),
    head: 0, // the ring's newest row
    scroll: 0,
    live: new Float32Array(NC),
    xm: Math.random(), // where the sweep is, 0 to 1
    prevXm: 0,
    k: [0, 2, 0, 0.06],
    c: { f0: [0, 0, 0], q: [0, 0, 0], r: [0, 0, 0], bg: 0, th: 0, n: 1, xi: 0, xs: 0.5, ar: 0, ai: 0, loss: 0.93 },
    tn: { st: 0, t: 0, dur: 1, k: 0, xs: 0.5, ar: 0, ai: 0, xi: 0, next: 20 + 20 * Math.random(), hold: 14 },
    tmp: [0, 0],
    tmp2: [0, 0],
    minG: 1,
    warm: false,
  });
}

// ---- the physics
function coefs(P, k) {
  const c = P.c;
  const o = P.ox;
  const rb = couple(k[3]);
  for (let i = 0; i < 3; i++) {
    c.f0[i] = 0.55 + 0.9 * (F_MEAN[i] + o[i]);
    c.q[i] = Q_MEAN[i] * exp(o[3 + i]);
    c.r[i] = rb * R_FAC[i] * exp(o[6 + i] + 0.3 * P.wbx[i]);
  }
  c.n = cl(0.95 + o[9], 0.3, 1.7);
  c.th = PI * cl(k[2], -1, 1) + o[10];
  const t = P.tn;
  c.xi = t.st === 0 ? 0 : t.xi;
  c.ar = t.ar * c.xi;
  c.ai = t.ai * c.xi;
  c.xs = t.xs;
}

// the resistance each branch shows the line, in units of the line's: 9 at the Match knob's minimum, 2.1 at the opening, 0.85 at the top
function couple(k4) {
  const u = (cl(k4, -1, 1) + 1) / 2;
  return exp(u < 0.53 ? mix(2.197, 0.742, u / 0.53) : mix(0.742, -0.163, (u - 0.53) / 0.47));
}

// the reflection coefficient at x on the axis, as the analyser sees it through the cable
function gam(c, x, out) {
  const f = 0.55 + 0.9 * x;
  let yr = 0;
  let yi = c.bg;
  for (let k = 0; k < 3; k++) {
    const q = c.q[k] * (f / c.f0[k] - c.f0[k] / f);
    const dn = c.r[k] * (1 + q * q);
    yr += 1 / dn;
    yi -= q / dn;
  }
  const nr = 1 - yr;
  const ni = -yi;
  const dr = 1 + yr;
  const di = yi;
  const den = dr * dr + di * di;
  let gr = (nr * dr + ni * di) / den;
  let gi = (ni * dr - nr * di) / den;
  if (c.xi > 0) {
    // a lossless match at the load end, tuned to one band: the unit disc mapped onto itself, by an amount that dies away from c.xs
    const wx = (x - c.xs) / 0.11;
    const wg = exp(-wx * wx);
    const ar = c.ar * wg;
    const ai = c.ai * wg;
    const pr = gr - ar;
    const pi = gi - ai;
    const qr = 1 - (ar * gr + ai * gi);
    const qi = -(ar * gi - ai * gr);
    const dd = qr * qr + qi * qi;
    gr = (pr * qr + pi * qi) / dd;
    gi = (pi * qr - pr * qi) / dd;
  }
  const ph = c.th + TAU * c.n * x;
  const cs = cos(ph);
  const sn = sin(ph);
  out[0] = (gr * cs + gi * sn) * c.loss + MIS_R;
  out[1] = (gi * cs - gr * sn) * c.loss + MIS_I;
}

// return loss in dB laid on 0 to 1: 0.03 is the floor where everything comes back, 1 is a match 18 dB deep
function vOf(mag) {
  const rl = -20 * Math.log10(max(mag, 1e-3));
  return 0.04 + 0.96 * pow(cl(rl / 18, 0, 1), 0.8);
}

function wfRow(c, out) {
  const g = [0, 0];
  for (let i = 0; i < NC; i++) {
    let s = 0;
    for (let j = -1; j <= 1; j++) {
      gam(c, (i + 0.5 + j * 0.33) / NC, g);
      s += vOf(sqrt(g[0] * g[0] + g[1] * g[1]) * (0.985 / c.loss));
    }
    out[i] = s / 3;
  }
}

// ---- lines: an anti-aliased capsule, 2 LED wide, kept at the larger value where lines cross
function seg(A, x0, y0, x1, y1, v0, v1) {
  const pad = 1.5;
  const xa = max(0, floor(min(x0, x1) - pad));
  const xb = min(W - 1, ceil(max(x0, x1) + pad));
  const ya = max(0, floor(min(y0, y1) - pad));
  const yb = min(SMY - 1, ceil(max(y0, y1) + pad));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0;
      const py = y + 0.5 - y0;
      const t = l2 > 1e-9 ? cl((px * dx + py * dy) / l2, 0, 1) : 0;
      const ex = px - t * dx;
      const ey = py - t * dy;
      const d = sqrt(ex * ex + ey * ey);
      if (d >= 1.2) continue;
      const v = (1 - sm(0.35, 1.2, d)) * mix(v0, v1, t);
      const i = y * W + x;
      if (v > A[i]) A[i] = v;
    }
}

function deposit(P, x0, x1) {
  if (x1 <= x0) return;
  const c = P.c;
  const g = P.tmp;
  const n = max(1, ceil((x1 - x0) * 700));
  gam(c, x0, g);
  let px = CX + R * g[0];
  let py = CY - R * g[1];
  for (let i = 1; i <= n; i++) {
    gam(c, x0 + ((x1 - x0) * i) / n, g);
    const nx = CX + R * g[0];
    const ny = CY - R * g[1];
    seg(P.E, px, py, nx, ny, 1.25, 1.25);
    px = nx;
    py = ny;
  }
}

// ---- time
function evolve(P, d, k, painting) {
  const o = P.ou;
  const ox = P.ox;
  const lp = 1 - exp(-d / 7);
  // the flutter lasts about three rows of the waterfall, never less than 2.2 s, so a slow sweep does not read it as noise
  const rho2 = exp(-d / max(2.2, 3 / (1.7 * cl(k[1], 0.3, 3))));
  const ns2 = sqrt(1 - rho2 * rho2);
  const lp2 = 1 - exp(-d / max(1, 1.5 / (1.7 * cl(k[1], 0.3, 3))));
  for (let i = 0; i < 3; i++) {
    P.wb[i] = rho2 * P.wb[i] + ns2 * gauss();
    P.wbx[i] += (P.wb[i] - P.wbx[i]) * lp2;
  }
  for (let i = 0; i < o.length; i++) {
    const rho = exp(-d / OU_TAU[i]);
    o[i] = rho * o[i] + sqrt(1 - rho * rho) * OU_SIG[i] * gauss();
    ox[i] += (o[i] - ox[i]) * lp;
  }
  // the tuner: a lossless network chosen to put one resonance's best point at the centre, held while the load wanders off, then let go
  const t = P.tn;
  const k4 = (cl(k[3], -1, 1) + 1) / 2;
  t.t += d;
  if (t.st === 0) {
    t.next -= d;
    if (t.next <= 0) {
      coefs(P, k);
      const c = P.c;
      const keep = c.xi;
      c.xi = 0;
      t.k = floor(Math.random() * 3);
      const g = P.tmp2;
      let best = 9;
      let bx = F_MEAN[t.k] + ox[t.k];
      for (let i = -40; i <= 40; i++) {
        const x = F_MEAN[t.k] + ox[t.k] + i * 0.0025;
        gam(c, x, g);
        const m = g[0] * g[0] + g[1] * g[1];
        if (m < best) {
          best = m;
          bx = x;
        }
      }
      // the match lives in the load, before the cable: take the point without the cable's turn
      const th = c.th;
      const n = c.n;
      c.th = 0;
      c.n = 0;
      gam(c, bx, g);
      c.th = th;
      c.n = n;
      c.xi = keep;
      t.ar = g[0];
      t.ai = g[1];
      t.xs = bx;
      t.st = 1;
      t.t = 0;
      t.dur = 5 + 3 * Math.random();
      t.hold = 4 + 6 * Math.random();
    }
  } else if (t.st === 1) {
    const u = cl(t.t / t.dur, 0, 1);
    t.xi = (0.3 + 0.7 * k4) * u * u * (3 - 2 * u);
    if (u >= 1) {
      t.st = 2;
      t.t = 0;
    }
  } else if (t.st === 2) {
    t.xi = 0.3 + 0.7 * k4;
    if (t.t > t.hold) {
      t.st = 3;
      t.t = 0;
      t.dur = 6;
    }
  } else {
    const u = cl(t.t / t.dur, 0, 1);
    t.xi = (0.3 + 0.7 * k4) * (1 - u * u * (3 - 2 * u));
    if (u >= 1) {
      t.st = 0;
      t.xi = 0;
      t.next = 20 + 40 * Math.random();
    }
  }
  coefs(P, k);
  const c = P.c;

  // the sweep: the dot's place on the axis
  const rate = (cl(k[1], 0.3, 3) / 6.4) * exp(o[11]);
  const x0 = P.xm;
  let x1 = x0 + rate * d;
  P.prevXm = x0;
  if (painting) {
    P.tau = cl(0.34 / rate, 0.55, 3.2);
    const a = exp(-d / P.tau);
    const E = P.E;
    for (let i = 0; i < E.length; i++) E[i] *= a;
    if (x1 >= 1) {
      deposit(P, x0, 1);
      x1 -= 1;
      deposit(P, 0, x1);
    } else deposit(P, x0, x1);
  } else if (x1 >= 1) x1 -= 1;
  P.xm = x1 % 1;

  // the waterfall: scrolls at a rate that follows the sweep knob and takes in the newest row when a whole row has gone by
  const rr = 1.7 * cl(k[1], 0.3, 3);
  P.scroll += rr * d;
  while (P.scroll >= 1) {
    P.scroll -= 1;
    P.head = (P.head + WROWS + 1) % (WROWS + 2);
    wfRow(c, P.rows[P.head]);
  }
}

export function update(dt, input, P) {
  if (!P.ou) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  P.k = k;
  if (!P.warm) {
    P.warm = true;
    // open on a waterfall that has been scrolling for a while at this sweep speed
    const rr = 1.7 * cl(k[1], 0.3, 3);
    const secs = (WROWS + 3) / rr + 6;
    const n = ceil(secs / 0.1);
    for (let s = 0; s < n; s++) evolve(P, 0.1, k, false);
    const m = 60;
    for (let s = 0; s < m; s++) evolve(P, 1 / 30, k, true);
    if (P.tn.st === 0) P.tn.next = 1.5; // a tuner still running from the run-up simply goes on
  }
  const d = cl(dt || 0, 0, 0.1);
  if (d <= 0) return;
  evolve(P, d, k, true);
  wfRow(P.c, P.live);
}

// ---- drawing
export function draw(display, P) {
  if (!P.ou) return;
  const k = P.k;
  const shift = 360 * cl(k[0], 0, 1);
  if (abs(shift - P.lutShift) > 0.5) buildLut(P, shift);
  const L = P.lut;
  const c = P.c;
  const E = P.E;
  const LV = P.LV;
  LV.fill(0);

  // this moment's whole locus, drawn as a line whose heat is the return loss at that point, so the chart and the waterfall use one scale
  const g = P.tmp;
  gam(c, 0, g);
  let px = CX + R * g[0];
  let py = CY - R * g[1];
  let pv = 0.1 + 0.9 * vOf(sqrt(g[0] * g[0] + g[1] * g[1]));
  let minG = 1;
  for (let i = 1; i <= NL; i++) {
    gam(c, i / NL, g);
    const m = sqrt(g[0] * g[0] + g[1] * g[1]);
    if (m < minG) minG = m;
    const nx = CX + R * g[0];
    const ny = CY - R * g[1];
    const nv = 0.1 + 0.9 * vOf(m);
    seg(LV, px, py, nx, ny, pv, nv);
    px = nx;
    py = ny;
    pv = nv;
  }
  P.minG = minG;

  // the dot
  gam(c, P.xm, g);
  const mx = CX + R * g[0];
  const my = CY - R * g[1];
  const mmag = sqrt(g[0] * g[0] + g[1] * g[1]);
  const bloom = max(sm(0.3, 0.06, minG), sm(0.14, 0.04, mmag));
  const xcur = P.xm * NC;

  const G = P.grid;
  const BG = P.bg;
  const LI = (NLUT - 1) / VMAX;
  for (let y = 0; y < SMY; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o3 = i * 3;
      let v = max(E[i], LV[i]);
      // the dot, white, in a glow that runs down the same heat scale; the same scale makes a spark at the centre when the load is matched
      const dx = x + 0.5 - mx;
      const dy = y + 0.5 - my;
      const r2 = dx * dx + dy * dy;
      v = max(v, 1.3 * (1 - sm(1.6, 2.6, sqrt(r2))), 0.6 * exp(-r2 / 7));
      const cx = x + 0.5 - CX;
      const cy = y + 0.5 - CY;
      const rc2 = cx * cx + cy * cy;
      if (bloom > 0.01) v = max(v, 1.15 * bloom * exp(-rc2 / 6), 0.45 * bloom * exp(-rc2 / 16));
      const li = (min(v, VMAX) * LI + 0.5) | 0;
      let r = BG[o3] + L[li * 3];
      let gg = BG[o3 + 1] + L[li * 3 + 1];
      let b = BG[o3 + 2] + L[li * 3 + 2];
      // the grid, fading under a bright trace
      const gr = G[i] * (1 - sm(0.1, 0.55, v));
      // the screen catches a little of the dot's light, in the grid's own cool tone
      const sp = gr + 0.55 * exp(-r2 / 160);
      r += sp * SLATE[0];
      gg += sp * SLATE[1];
      b += sp * SLATE[2];
      display.setPixel(x, y, min(255, r) | 0, min(255, gg) | 0, min(255, b) | 0);
    }
  }

  // the cursor's tick in the gap between the two displays
  for (let y = SMY; y < WY0; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - xcur;
      const dy = y + 0.5 - (SMY + 1.4);
      const w = 1 - sm(0.7, 1.8, sqrt(dx * dx + dy * dy));
      const q = (w * 255) | 0;
      display.setPixel(x, y, q, q, (q * 0.9) | 0);
    }
  }

  // the waterfall: the live trace on top, older sweeps beneath, the cursor running down through them
  const rows = P.rows;
  const s = P.scroll;
  const live = P.live;
  const hd = P.head;
  const rowAt = (n) => rows[(hd + n) % (WROWS + 2)];
  for (let yy = 0; yy < WROWS; yy++) {
    const y = WY0 + yy;
    let ra;
    let rb;
    let t;
    if (yy < s) {
      ra = live;
      rb = rowAt(0);
      t = yy / s;
    } else {
      const q = yy - s;
      const n = floor(q);
      ra = rowAt(n);
      rb = rowAt(n + 1);
      t = q - n;
    }
    const bright = (1 - 0.2 * (yy / WROWS)) * (1 + 0.25 * exp(-yy / 2.2));
    const cur = 0.2 * (1 - 0.5 * (yy / WROWS)) + 0.45 * exp(-yy / 1.8);
    for (let x = 0; x < W; x++) {
      const v = mix(ra[x], rb[x], t);
      const li = (min(v, VMAX) * LI + 0.5) | 0;
      let r = L[li * 3] * bright;
      let gg = L[li * 3 + 1] * bright;
      let b = L[li * 3 + 2] * bright;
      const dx = x + 0.5 - xcur;
      const cw = cur * exp(-(dx * dx) / 1.3);
      if (cw > 0.004) {
        r += cw * 255;
        gg += cw * 245;
        b += cw * 225;
      }
      display.setPixel(x, y, min(255, r) | 0, min(255, gg) | 0, min(255, b) | 0);
    }
  }
}
