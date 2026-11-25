// ===== Patternflow pattern =====
// Title:   Mother Machine
// Family:  singlecell
// Idea:    Thirteen narrow dead-end channels of a microfluidic mother machine, each packed with a lineage of glass-rimmed rod cells that lengthen, pinch a dark line across their middle and divide, pushing their daughters down to the open mouth where they fall into a dim sideways current and wash away, every cell glowing in two reporter colours that burst on and off at random and are inherited, so cells show up yellow-white together (shared noise) or pure single colours (private bursts) while an occasional cell stops growing and clogs its channel and another filaments.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the mother machine, a chip of dead-end growth channels one cell wide with the old-pole cell held at the closed end for hundreds of generations and the daughters pushed out into a feeding lane (Wang et al. 2010, "Robust growth of Escherichia coli", from memory); two reporters of different colour in one cell to tell intrinsic from extrinsic noise, correlated cells look yellow and uncorrelated ones red or green (Elowitz, Levine, Siggia and Swain 2002, "Stochastic gene expression in a single cell", from memory); bursty gene expression as a telegraph promoter with protein made while it is on (from memory); persister cells that stop growing, pattern round 241
// Round:   241
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0..4, Bursts=-1..1, Length=-1..1
//
// Knob 1: Hue. Turns the two reporter colours round the wheel together, 0 to 1 once round. At 0 they are a spring green and a rose pink that add to near white; at 0.25 a blue and a yellow; at 0.5 a magenta and a green.
// Knob 2: Growth. 0 to 4, opening at 2. The time scale and nutrient level: a cell's length doubles in about 130 s at 0, 50 s at 2 and 19 s at 4 (the slow nutrient wave of the environment moves this by up to a third either way), so at the top the channels run like conveyor belts and the lane is crowded, at the bottom the rods creep.
// Knob 3: Bursts. -1 to 1, opening at 0. How bursty the reporters are. At -1 the promoter flips every second or so and every cell glows an even mixed colour that differs only in brightness; at 0 bursts last a few cell cycles and cells wander between greenish, pinkish and white; at 1 an on-period lasts about 35 s and an off-period 80 s, so many cells are a pure single colour and the lineages of a channel change colour from one cell to the next.
// Knob 4: Length. -1 to 1, opening at 0.06. The length at which a cell divides: 10 LED at -1 (many small cells in each channel, about 15), 12.5 at the opening and 24 at 1 (only a handful of fat long rods, and a division is a rare thing).

const W = 64, H = 128;
const { floor, ceil, min, max, abs, exp, sqrt, sin, cos, pow, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// ---- the chip -----------------------------------------------------------------
// 13 slots 4 LED wide with a 1 LED wall between: x = 5 c .. 5 c + 3, the wall at x = 5 c + 4. A cell is a rod 4 LED wide.
const NCH = 13, PITCH = 5, R = 2.0;
const TOPY = 2.4;       // the closed end; two rows of wall above it
const MOUTH = 113.5;    // the open end; the feeding lane is the rows below
const GAP = 0.7;        // the dark line between two cells
const MU0 = 0.6931 / 50; // growth rate of a cell at 1 (per second of cell time): doubles in 50 s
const GAMMA = 0.005;     // slow decay of a reporter
const TAUE = 90;         // the shared noise of a cell wanders over this time
const PRE = 1500;        // steps of 0.1 s run at the first call, so the panel opens in the middle of its life

const HSV = (h, s, v, o) => {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
};

// A dim red, orange or yellow reads brown on the panel: paled and lifted before it is used.
function lift(c) {
  const mx = max(c[0], c[1], c[2]), mn = min(c[0], c[1], c[2]), d = mx - mn;
  if (mx < 0.02 || d < 1e-4) return;
  const s = d / mx;
  let h = mx === c[0] ? (c[1] - c[2]) / d : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4;
  h = (h + 6) % 6 / 6;
  const w = (h < 0.5 ? 1 - sstep(0.1, 0.2, h) : sstep(0.9, 0.96, h)) * sstep(0.25, 0.6, s);
  if (w < 0.01) return;
  const v = mx < 1 ? pow(mx, 1 - 0.55 * w) : mx;
  HSV(h, s * (1 - 0.3 * w - 0.3 * w * (1 - min(mx, 1))), v, c);
}

// ---- state --------------------------------------------------------------------
export function setup(params) {
  const S = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, hue: -9, nut: 1, walk: 0,
    gm: 1, nu: 0.5, Ld: 12.5, Ton: 1, Toff: 1, beta: 0.05, sige: 0.25,
    chs: [], lane: [], A: [0, 1, 0.5], B: [1, 0.15, 0.5],
    buf: new Float32Array(W * H * 3), bg: new Float32Array(W * H * 3),
    ph: [rnd() * TAU, rnd() * TAU, rnd() * TAU],
    g1: new Float32Array(97 * 6), g2: new Float32Array(61 * 6),
    tmp: [0, 0, 0],
  });
  for (let i = 0; i < S.g1.length; i++) S.g1[i] = rnd();
  for (let i = 0; i < S.g2.length; i++) S.g2[i] = rnd();
  // the chip itself: slots, walls and the bar that closes the channels
  const bg = S.bg, WALL = [0.1, 0.135, 0.2], SLOT = [0.012, 0.02, 0.036];
  for (let y = 0; y < MOUTH + 0.5; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let c = SLOT;
      if (y < 2) c = [0.12, 0.16, 0.24];
      else if (x % PITCH === 4 && x < W - 1) c = y > 112 ? [0.15, 0.2, 0.3] : WALL;
      bg[o] = c[0];
      bg[o + 1] = c[1];
      bg[o + 2] = c[2];
    }
  }
  return S;
}

// the knobs, read once per call
function knobs(S) {
  const k = S.k;
  S.hue = k[0];
  S.gm = pow(2, (cl(k[1], 0, 4) - 2) * 0.72);
  S.nu = cl((k[2] + 1) / 2, 0, 1);
  const l = cl(k[3], -1, 1);
  S.Ld = 12 * exp(l < 0 ? 0.18 * l : 0.69 * l);
  const ne = sqrt(S.nu);
  S.Ton = 1.5 * pow(25, ne);
  S.Toff = 2.4 * pow(35, ne);
  S.beta = (GAMMA + MU0) / (S.Ton / (S.Ton + S.Toff));
  S.sige = 0.18 + 0.17 * S.nu;
}

function palette(S) {
  if (abs(S.k[0] - S.hue) < 1e-6 && S.palH === S.k[0]) return;
  S.palH = S.k[0];
  HSV(0.4 + S.k[0], 0.88, 1, S.A);
  HSV(0.93 + S.k[0], 0.88, 1, S.B);
}

function mkCell(S, len, par) {
  const lmz = rnd();
  let lm = 1 + 0.07 * gauss();
  if (lmz < 0.011) {
    const f = min(2 + rnd(), 36 / S.Ld);
    if (f > 1.5) lm = f;
  }
  const lnm = par ? 0.75 * log(par.m) + 0.66 * 0.3 * gauss() : 0.3 * gauss();
  return {
    y: 0, dl: len, len, lm, m: cl(exp(lnm), 0.45, 1.9), le: par ? par.le + 0.08 * gauss() : S.sige * gauss(),
    cg: par ? par.cg : 0.2 + 1.4 * rnd(), cr: par ? par.cr : 0.2 + 1.4 * rnd(),
    gOn: rnd() < 0.4, rOn: rnd() < 0.4, pinch: 0, pers: 0, dim: 1, dimT: 1,
  };
}

function fillAll(S) {
  for (let c = 0; c < NCH; c++) {
    const ch = { cx: c * PITCH + 2, cells: [], wedge: null, wy: 0, sq: 1, waking: false, end: 0 };
    let y = TOPY;
    while (y < MOUTH + 1) {
      const len = S.Ld * (0.5 + 0.48 * rnd());
      ch.cells.push(mkCell(S, max(len, 4.4), null));
      y += len + GAP;
    }
    S.chs.push(ch);
    layout(S, ch, 0);
  }
}

// ---- one channel --------------------------------------------------------------
// The cells are a rigid stack from the closed end: each sits under the one before it, so a growing cell pushes all the ones below.
// A persister wedges where it stands; the cells above it keep their place from the closed end and are squeezed shorter instead,
// and the cells below it are a stack of their own that starts at it.
function layout(S, ch, dt) {
  const cs = ch.cells;
  let n = cs.length, w = ch.wedge ? cs.indexOf(ch.wedge) : -1;
  if (ch.wedge && (w < 1 || w >= n - 1)) {
    ch.wedge = null;
    ch.waking = false;
    w = -1;
  }
  let s = 1, y = TOPY;
  if (w >= 0) {
    let cum = 0;
    for (let i = 0; i < w; i++) cum += cs[i].len + GAP;
    const yf = TOPY + cum;
    if (ch.waking) {
      ch.wy += (yf - ch.wy) * (1 - exp(-dt / 0.9)) + 0.03 * dt * 10;
      if (ch.wy >= yf - 0.04) {
        ch.wedge = null;
        ch.waking = false;
        w = -1;
      }
    }
    if (w >= 0) {
      s = cl((ch.wy - TOPY) / cum, 0.4, 1);
      let a = 0;
      for (let i = 0; i < w; i++) {
        const c = cs[i];
        c.y = TOPY + a * s;
        c.dl = c.len * s;
        a += c.len + GAP;
      }
      y = ch.wy;
      const p = cs[w];
      p.y = y;
      p.dl = p.len;
      y += p.len + GAP;
      for (let i = w + 1; i < n; i++) {
        const c = cs[i];
        c.y = y;
        c.dl = c.len;
        y += c.len + GAP;
      }
    }
  }
  if (w < 0) {
    for (let i = 0; i < n; i++) {
      const c = cs[i];
      c.y = y;
      c.dl = c.len;
      y += c.len + GAP;
    }
  }
  ch.sq = s;
  const last = cs[n - 1];
  ch.end = last.y + last.dl;
}

function split(S, ch, i) {
  const cs = ch.cells, c = cs[i];
  const tot = c.len - GAP, f = cl(0.5 + 0.03 * gauss(), 0.44, 0.56);
  const B = mkCell(S, tot * (1 - f), c);
  const z1 = 0.11 * gauss(), z2 = 0.11 * gauss();
  B.cg = max(0, c.cg * (1 - z1));
  B.cr = max(0, c.cr * (1 - z2));
  c.cg = max(0, c.cg * (1 + z1));
  c.cr = max(0, c.cr * (1 + z2));
  B.gOn = rnd() < 0.7 ? c.gOn : !c.gOn;
  B.rOn = rnd() < 0.7 ? c.rOn : !c.rOn;
  B.dim = c.dim;
  B.dimT = c.dimT;
  c.len = tot * f;
  c.pinch = 0;
  const p = mkCell(S, 5, c);
  c.m = p.m;
  c.lm = p.lm;
  cs.splice(i + 1, 0, B);
}

function stepChannel(S, ch, dt, dtb, dtp, g) {
  const cs = ch.cells;
  const w = ch.wedge ? cs.indexOf(ch.wedge) : -1;
  const press = sstep(0.72, 0.9, ch.sq);
  const full = ch.end > MOUTH - 12;
  const boost = 1 + cl((MOUTH - 6 - ch.end - 15) / 20, 0, 2);
  let todo = -1;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    // the two reporters
    c.le += (-c.le * dtb) / TAUE + S.sige * sqrt((2 * dtb) / TAUE) * gauss();
    const ex = exp(c.le), lam = GAMMA + MU0 * c.m, p = S.beta * ex;
    if (c.gOn) { if (rnd() < dtb / S.Ton) c.gOn = false; } else if (rnd() < dtb / S.Toff) c.gOn = true;
    if (c.rOn) { if (rnd() < dtb / S.Ton) c.rOn = false; } else if (rnd() < dtb / S.Toff) c.rOn = true;
    c.cg = max(0, c.cg + ((c.gOn ? p : 0) - lam * c.cg) * dtb);
    c.cr = max(0, c.cr + ((c.rOn ? p : 0) - lam * c.cr) * dtb);
    c.dim += (c.dimT - c.dim) * (1 - exp(-dt / (c.dimT < c.dim ? 1.5 : 7)));
    if (c.pers > 0) {
      c.pers -= dtb;
      if (c.pers <= 0) {
        c.pers = 0;
        c.dimT = 1;
        if (ch.wedge === c) ch.waking = true;
      }
      continue;
    }
    // growth: squeezed cells above a clog wait
    const sq = w >= 0 && i < w ? press : 1;
    const grow = (c.pinch > 0 ? 0.3 : 1) * sq * boost;
    c.len *= exp(MU0 * c.m * dtb * grow);
    if (c.pinch > 0) {
      c.pinch += dtp / 1.6;
      if (c.pinch >= 1 && todo < 0) todo = i;
    } else if (c.len >= S.Ld * c.lm && ch.sq > 0.8) {
      c.pinch = 0.001;
    } else if (!ch.wedge && i > 0 && i < cs.length - 1 && full && c.dl > 5 && rnd() < 0.00045 * dtb) {
      // a persister: stops growing, goes dim, and wedges where it stands
      c.pers = 28 + 40 * rnd();
      c.dimT = 0.28;
      c.pinch = 0;
      ch.wedge = c;
      ch.wy = c.y;
      ch.waking = false;
    }
  }
  if (todo >= 0) split(S, ch, todo);
  layout(S, ch, dt);
  // the cell whose middle has passed the mouth falls out into the lane
  while (ch.cells.length > 1) {
    const l = ch.cells[ch.cells.length - 1];
    if (l === ch.wedge || (l.y + l.dl * 0.5 < MOUTH + 3 && !(l.dl > 16 && l.y > MOUTH - 9))) break;
    ch.cells.pop();
    S.lane.push({
      x: ch.cx, y: l.y + l.dl * 0.5, th: PI / 2, len: l.dl, cg: l.cg, cr: l.cr, dim: l.dim, vx: 0.5 + rnd(),
      yt: 117.8 + 6.4 * rnd(), age: 0, life: 5.5 + 3.5 * rnd(), amp: 0.75 + 0.25 * rnd(),
    });
    layout(S, ch, 0);
  }
  if (ch.cells.length === 0) {
    ch.cells.push(mkCell(S, S.Ld * 0.5, null));
    layout(S, ch, 0);
  }
}

const laneSpeed = (y) => 2.6 + 3.6 * max(0, 1 - ((y - 120.5) / 7.2) * ((y - 120.5) / 7.2));

function step(S, dt) {
  S.t += dt;
  S.walk += (-S.walk / 90) * dt + 0.1 * sqrt((2 * dt) / 90) * gauss();
  const t = S.t;
  S.nut = cl(1 + 0.2 * sin((TAU * t) / 71.3 + S.ph[0]) + 0.13 * sin((TAU * t) / 131.7 + S.ph[1]) + 0.08 * sin((TAU * t) / 37.1 + S.ph[2]) + S.walk, 0.5, 1.5);
  const g = S.gm * S.nut, dtb = dt * g, dtp = dt * sqrt(g);
  for (const ch of S.chs) stepChannel(S, ch, dt, dtb, dtp, g);
  const lane = S.lane, U = 0.85 + 0.15 * sin(t * 0.37 + S.ph[1]);
  for (let i = lane.length - 1; i >= 0; i--) {
    const c = lane[i];
    c.age += dt;
    if (c.age > c.life / sqrt(S.gm) || c.x > W + 14) {
      lane[i] = lane[lane.length - 1];
      lane.pop();
      continue;
    }
    c.vx += (laneSpeed(c.y) * U - c.vx) * (1 - exp(-dt / 0.8));
    c.x += c.vx * dt;
    c.y += (c.yt - c.y) * (1 - exp(-dt / 1.0));
    c.th *= exp(-dt / 0.9);
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const S = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  S.k = [kv[0], kv[1], kv[2], kv[3]];
  knobs(S);
  if (!S.init) {
    S.init = true;
    fillAll(S);
    for (let i = 0; i < PRE; i++) step(S, 0.1);
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  if (dt > 0) step(S, dt);
}

// ---- drawing ------------------------------------------------------------------
const LX = -0.55, LY = -0.83;
const GT = [0.28, 0.4, 0.62];

// one rod: (ax, ay) to (bx, by) are the ends of the straight part, R its radius, col the colour, k the strength
function rod(S, ax, ay, bx, by, col, gl, k, pinch, ym, press) {
  const B = S.buf, ex = bx - ax, ey = by - ay, el = ex * ex + ey * ey, hasAx = el > 1e-6;
  const x0 = max(0, floor(min(ax, bx) - R - 2.6)), x1 = min(W - 1, ceil(max(ax, bx) + R + 2.6));
  const y0 = max(0, floor(min(ay, by) - R - 2.6)), y1 = min(H - 1, ceil(max(ay, by) + R + 2.6));
  const neck = pinch > 0 ? 2.9 * pow(pinch, 1.2) : 0, rimK = 0.62 * (1 + 1.1 * press);
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      let tt = hasAx ? cl(((px - ax) * ex + (py - ay) * ey) / el, 0, 1) : 0;
      const qx = px - (ax + ex * tt), qy = py - (ay + ey * tt), rr = sqrt(qx * qx + qy * qy);
      let d = rr - R;
      if (neck > 0) {
        const dm = py - ym;
        d += neck * exp(-dm * dm * 0.78);
      }
      if (d > 2.6) continue;
      const cover = d < -0.5 ? 1 : d > 0.5 ? 0 : 0.5 - d;
      let I, gk = 0;
      if (cover > 0) {
        const nx = rr > 1e-3 ? qx / rr : 0, ny = rr > 1e-3 ? qy / rr : 0;
        const lit = 0.8 + 0.2 * (nx * LX + ny * LY), e = d + 0.55;
        const rim = exp(-2 * e * e);
        I = cover * (0.38 + rimK * rim * lit);
        gk = cover * (0.03 + 0.17 * rim * lit);
      } else I = 0;
      if (cover < 1) I += 0.17 * exp(-(max(d, -0.5) + 0.5) * 1.25) * (1 - cover);
      const o = (y * W + x) * 3;
      B[o] += (col[0] * I + GT[0] * gk) * k;
      B[o + 1] += (col[1] * I + GT[1] * gk) * k;
      B[o + 2] += (col[2] * I + GT[2] * gk) * k;
    }
  }
}

function cellColour(S, c, out) {
  const vg = 1 - exp(-1.3 * c.cg), vr = 1 - exp(-1.3 * c.cr);
  out[0] = S.A[0] * vg + S.B[0] * vr;
  out[1] = S.A[1] * vg + S.B[1] * vr;
  out[2] = S.A[2] * vg + S.B[2] * vr;
  // push the colour away from grey: two reporters at once is white, one alone is a clear colour
  const m = (out[0] + out[1] + out[2]) / 3;
  out[0] = max(0, m + (out[0] - m) * 1.4);
  out[1] = max(0, m + (out[1] - m) * 1.4);
  out[2] = max(0, m + (out[2] - m) * 1.4);
  lift(out);
  const q = c.dim;
  out[0] *= q;
  out[1] *= q;
  out[2] *= q;
}

const smp = (a, N, x, y) => {
  x = ((x % N) + N) % N;
  const i = floor(x), fx = x - i, j = cl(floor(y), 0, 4), fy = cl(y - j, 0, 1), i2 = (i + 1) % N;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a0 = a[j * N + i] + (a[j * N + i2] - a[j * N + i]) * sx, a1 = a[(j + 1) * N + i] + (a[(j + 1) * N + i2] - a[(j + 1) * N + i]) * sx;
  return a0 + (a1 - a0) * sy;
};

export function draw(display, params) {
  let S = params.st;
  if (!S) S = setup(params);
  if (!S.init) update(0, { knobValues: S.k }, params);
  palette(S);
  const B = S.buf, t = S.t, col = S.tmp;
  B.set(S.bg);
  // the feeding lane: a dim current, faster in the middle, with soft streaks carried along
  const U = 0.85 + 0.15 * sin(t * 0.37 + S.ph[1]);
  for (let y = 114; y < H; y++) {
    const u = laneSpeed(y + 0.5) * U, prof = 0.55 + 0.45 * sin((PI * (y - 113.5)) / 14.5);
    for (let x = 0; x < W; x++) {
      const a = smp(S.g1, 97, (x - u * t) * 0.1 + 3.1, (y - 114) * 0.3), b = smp(S.g2, 61, (x - u * 0.7 * t) * 0.065 + 17, (y - 114) * 0.22);
      const v = (0.55 * a + 0.45 * b - 0.3) * 1.35 * prof, vv = max(0, v);
      const o = (y * W + x) * 3;
      B[o] = 0.03 + 0.08 * vv;
      B[o + 1] = 0.05 + 0.15 * vv;
      B[o + 2] = 0.09 + 0.26 * vv;
    }
  }
  // the cells in the channels
  for (const ch of S.chs) {
    const cs = ch.cells, press = 1 - sstep(0.72, 0.98, ch.sq);
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      cellColour(S, c, col);
      const len = max(c.dl, 2 * R), a = c.y + R, b = c.y + len - R;
      rod(S, ch.cx, a, ch.cx, max(a, b), col, 0, 1, c.pinch, c.y + len * 0.5, i < (ch.wedge ? cs.indexOf(ch.wedge) : 0) ? press : 0);
    }
  }
  // the cells washed away
  for (const c of S.lane) {
    cellColour(S, c, col);
    const al = pow(max(0, 1 - c.age / (c.life / sqrt(S.gm))), 1.2) * c.amp * min(1, c.age / 0.3 + 0.4);
    const a = max(0, c.len * 0.5 - R), ux = cos(c.th), uy = sin(c.th);
    rod(S, c.x - a * ux, c.y - a * uy, c.x + a * ux, c.y + a * uy, col, 0, al, 0, 0, 0);
  }
  // out: a soft shoulder so a bright pixel keeps its colour rather than clipping
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let r = B[o], g = B[o + 1], b = B[o + 2];
      r = r < 0.72 ? r : 0.72 + 0.28 * (1 - exp(-(r - 0.72) / 0.28));
      g = g < 0.72 ? g : 0.72 + 0.28 * (1 - exp(-(g - 0.72) / 0.28));
      b = b < 0.72 ? b : 0.72 + 0.28 * (1 - exp(-(b - 0.72) / 0.28));
      display.setPixel(x, y, (r * 255) | 0, (g * 255) | 0, (b * 255) | 0);
    }
  }
}
