// ===== Patternflow pattern =====
// Title:   Recrystallization
// Family:  mineral
// Idea:    A melt on the standing panel keeps freezing and thawing: faceted crystals nucleate at random places, race outward as hexagons tilted each its own way, meet along kinked grain boundaries, and round hot melt fronts eat the mosaic from one side while fresh crystals refill the liquid they leave behind.
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Johnson-Mehl-Avrami-Kolmogorov crystallization (Andrei Kolmogorov, 1937; William Johnson and Robert Mehl, 1939; Melvin Avrami, 1939; all from memory) with growth that depends on direction, so a crystal is a Wulff shape (Georg Wulff, 1901, from memory) whose gauge, the Minkowski functional (Hermann Minkowski, 1903, from memory), is the time its front needs to arrive; melt events as the reverse process; colour in OKLab (Bjorn Ottosson, 2020, from memory); pattern round 124
// Round:   126
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=1..3.5, Scale=-1..1, Facets=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the orientation hue wheel. At 0 the grains run from teal through blue and violet to rose, with a pale amber and a green among them.
// Knob 2: Pace. The clock of everything at once: front speed, melt speed and both event rates. Front speed is 1.5 LEDs a second at 1, 3.0 at the opening 2 and 5.2 at 3.5.
// Knob 3: Scale. Grain size, 14 LEDs across at -1, 22 at 0 and 35 at 1, which is about 40, 17 and 7 grains on the panel. Grains and melt discs scale together, so the picture is the same process seen larger.
// Knob 4: Facets. How directional the growth is. At -1 every crystal grows as a disc and the boundaries are hyperbola arcs; at 0 hexagons with straight edges; to 1 the six facets grow at different speeds, so the fast ones disappear and the crystals become pentagons, rhomboids and triangles. Crystals already grown keep the shape they were born with.

const { floor, ceil, exp, log, sqrt, abs, sin, cos, PI, min, pow, random } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---- the panel is a torus of 64 columns and 128 rows; pixel centres sit at +0.5
const W = 64, H = 128, N = W * H, HW = 32, HH = 64;

// ---- tunables. Times are seconds at Pace 1; Pace scales the clock.
const D0 = 22; // grain diameter at Scale 0, LEDs
const DSCALE = 1.6; // D = D0 * DSCALE^Scale
const TG = 6.5; // seconds a front needs to cross one grain diameter, so v = D / TG
const KM = 2.0; // melt front speed over growth speed
const TPASS = 24; // mean seconds between melt passages at one LED at Scale 0
const TPEXP = 1.2; // the interval goes as (D0 / D) to this power: bigger grains are eaten by bigger holes, so they need them more often
const RMK = 0.55; // mean melt radius over D
const IK = 3; // nucleation rate over the one that gives mean grain area 1.137 (v/I)^(2/3) = pi/4 D^2
const CAPR = 30.5; // largest radius a crystal reaches, LEDs; under 32 so the nearest image of its nucleus is the only one
const EXCL = 0.6; // a nucleus needs this many grain-crossing times (D / v) before the nearest front reaches it
const RAMP0 = 0.15, RAMP1 = 0.7; // liquid is left alone for RAMP0 grain-crossing times, then its nucleation rises over the stretch to RAMP1
const FMAX = 12; // liquid left alone this long nucleates this many times faster, so no pocket stays
const NEWTON = 3; // melt centres are the stalest of this many random candidates
const TAUZ = 90, SIGZ = 0.3; // wander of the two log-rates: relaxation time and spread
const CAP = 384; // crystal slots; at most 160 are held at any knob place the checks tried
const SPIN = 170, SPINH = 0.25; // the history run in setup: seconds and its step
const RETIRE = true; // false keeps every crystal for ever; the pictures stay the same

// ---- the picture
const TAUR = 0.55; // seconds a growth front keeps its bright rim
const TAUM = 12; // seconds a new piece of crystal takes to mellow
const LR = 0.9, DLM = 0.17, GLINT = 0.08;
const BREATH = 0.12, BREATH0 = 14; // each grain swells and fades in lightness by this much with its own period, about this many seconds
const TAUH = 1.1; // afterglow of melted liquid, seconds

// ---- state
function newWorld() {
  const F = () => new Float64Array(CAP);
  return {
    t: 0,
    Tm: new Float64Array(N).fill(Infinity), // arrival time of the crystal that owns the LED, or Infinity
    own: new Int16Array(N).fill(-1),
    mt: new Float64Array(N).fill(-1e9), // last melt passage
    ring: new Float32Array(N),
    cx: F(), cy: F(), ct: F(), cD: F(), cG: F(), cE: F(), cs: F(), cir: F(), cth: F(), cu: F(), cRc: F(),
    civ: new Float64Array(CAP * 6), cn: new Float64Array(CAP * 6),
    cnt: new Int32Array(CAP), alive: new Uint8Array(CAP),
    cj: new Float64Array(CAP), cph: new Float64Array(CAP), cpe: new Float64Array(CAP), chS: new Float64Array(CAP), chL: new Float64Array(CAP), chA: new Float64Array(CAP), chB: new Float64Array(CAP), chC: new Float64Array(CAP),
    list: [], free: [], melts: [], zn: 0, zm: 0,
    nNuc: 0, nTry: 0, nMelt: 0, maxAlive: 0, // counters the checks read
    sc: 0, kp: 2, k4: 0, hueK: 0,
  };
}

const gauss = () => sqrt(-2 * log(1 - random())) * cos(TAU * random());

// ---- the gauge of crystal i at a displacement: the time its front takes to reach it. The Wulff shape is the intersection of six
// half-planes with normals 60 degrees apart, one speed to each (a hexagon of apothem v t when all six are v), and the round shape
// of speed v is mixed in with weight 1 - cs, so cs = 1 is a polygon with straight edges and cs = 0 is a disc.
let FK = 0; // which facet won, for the shading
function gauge(S, i, dx, dy) {
  const n = S.cn, iv = S.civ, b = i * 6;
  const q0 = n[b] * dx + n[b + 1] * dy, q1 = n[b + 2] * dx + n[b + 3] * dy, q2 = n[b + 4] * dx + n[b + 5] * dy;
  let m = q0 * iv[b], k = 0, e = q1 * iv[b + 1];
  if (e > m) { m = e; k = 1; }
  e = q2 * iv[b + 2];
  if (e > m) { m = e; k = 2; }
  e = -q0 * iv[b + 3];
  if (e > m) { m = e; k = 3; }
  e = -q1 * iv[b + 4];
  if (e > m) { m = e; k = 4; }
  e = -q2 * iv[b + 5];
  if (e > m) { m = e; k = 5; }
  FK = k;
  const cs = S.cs[i];
  return cs * m + (1 - cs) * sqrt(dx * dx + dy * dy) * S.cir[i];
}
// the arrival time of crystal i at LED (px, py): t_i + gauge, or Infinity past the reach
function arrival(S, i, px, py) {
  let dx = px + 0.5 - S.cx[i];
  if (dx >= HW) dx -= W;
  else if (dx < -HW) dx += W;
  let dy = py + 0.5 - S.cy[i];
  if (dy >= HH) dy -= H;
  else if (dy < -HH) dy += H;
  const g = gauge(S, i, dx, dy);
  return g > S.cG[i] ? Infinity : S.ct[i] + g;
}

function setOwner(S, p, i, T) {
  const o = S.own[p];
  if (o !== i) {
    if (o >= 0) S.cnt[o]--;
    S.own[p] = i;
    if (i >= 0) S.cnt[i]++;
  }
  S.Tm[p] = T;
}
// the owner of LED p from scratch: the earliest arrival after the last melt passage, among crystals whose nucleus was still
// unmelted when the front got there
function recompute(S, p) {
  const px = p & 63, py = p >> 6, m = S.mt[p], list = S.list;
  let best = Infinity, bi = -1;
  for (let k = 0; k < list.length; k++) {
    const i = list[k], T = arrival(S, i, px, py);
    if (T > m && T <= S.cD[i] && T < best) { best = T; bi = i; }
  }
  setOwner(S, p, bi, best);
}

// ---- a crystal is born at (x, y) at time t0
function addCrystal(S, cfg, x, y, t0) {
  const i = S.free.length ? S.free.pop() : -1;
  if (i < 0) return -1;
  S.alive[i] = 1;
  S.list.push(i);
  S.cx[i] = x; S.cy[i] = y; S.ct[i] = t0;
  const th = random() * TAU;
  S.cth[i] = th;
  S.cu[i] = (th % (PI / 3)) / (PI / 3);
  S.cj[i] = random();
  S.cph[i] = random() * TAU;
  S.cpe[i] = BREATH0 * (0.7 + 0.6 * random());
  const v = cfg.v, b = i * 6;
  let vsum = 0;
  for (let k = 0; k < 6; k++) {
    const vk = v * (1 + cfg.irr * (2 * random() - 1));
    S.civ[b + k] = 1 / vk;
    vsum += vk;
  }
  S.cs[i] = cfg.sharp;
  S.cir[i] = 1 / (1.05 * (vsum / 6));
  for (let k = 0; k < 3; k++) {
    S.cn[b + 2 * k] = cos(th + (k * PI) / 3);
    S.cn[b + 2 * k + 1] = sin(th + (k * PI) / 3);
  }
  S.cnt[i] = 0;
  // the unit shape's area, from 120 directions, and its circumradius: the farthest point of it, from the smallest gauge. The six
  // speeds are scaled so that the shape grows as fast in area as the regular hexagon of apothem v, 2 sqrt 3 v^2 a second squared,
  // whatever the facets are: Facets changes the shape and leaves the rate at which melt is taken up alone.
  let ar = 0;
  for (let a = 0; a < 120; a++) {
    const g = gauge(S, i, cos((a * TAU) / 120), sin((a * TAU) / 120));
    ar += 0.5 * (TAU / 120) / (g * g);
  }
  const sc = sqrt((2 * sqrt(3) * v * v) / ar);
  for (let k = 0; k < 6; k++) S.civ[b + k] /= sc;
  S.cir[i] /= sc;
  let gmin = Infinity;
  for (let a = 0; a < 90; a++) {
    const g = gauge(S, i, cos((a * TAU) / 90), sin((a * TAU) / 90));
    if (g < gmin) gmin = g;
  }
  S.cRc[i] = 1 / gmin;
  S.cG[i] = cfg.capR / S.cRc[i];
  // when does a melt front reach the nucleus?
  let D = Infinity;
  for (const m of S.melts) {
    const d = torusDist(x, y, m.x, m.y);
    if (d <= m.R) {
      const M = m.s + d / m.v;
      if (M > t0 && M < D) D = M;
    }
  }
  S.cD[i] = D;
  S.cE[i] = min(D, t0 + S.cG[i]);
  // claim the LEDs it arrives at before anything else does
  const C = ceil(cfg.capR) + 1, x0 = floor(x), y0 = floor(y);
  for (let ddy = -C; ddy <= C; ddy++) {
    const py = (y0 + ddy) & 127;
    for (let ddx = -C; ddx <= C; ddx++) {
      const p = (py << 6) | ((x0 + ddx) & 63), T = arrival(S, i, p & 63, py);
      if (T <= D && T > S.mt[p] && T < S.Tm[p]) setOwner(S, p, i, T);
    }
  }
  if (S.list.length > S.maxAlive) S.maxAlive = S.list.length;
  return i;
}
function torusDist(x, y, u, v) {
  let dx = abs(x - u), dy = abs(y - v);
  if (dx > HW) dx = W - dx;
  if (dy > HH) dy = H - dy;
  return sqrt(dx * dx + dy * dy);
}

// ---- a melt event: a round front of speed v from (x, y) at time s that stops at radius R and leaves liquid behind it
function addMelt(S, cfg, s) {
  let bx = 0, by = 0, bs = -Infinity;
  for (let k = 0; k < NEWTON; k++) {
    const x = random() * W, y = random() * H, st = s - S.mt[(floor(y) << 6) | floor(x)];
    if (st > bs) { bs = st; bx = x; by = y; }
  }
  const R = cfg.RM * (0.6 + 0.8 * random()), v = cfg.vm * (0.85 + 0.3 * random());
  S.melts.push({ x: bx, y: by, s, R, v });
  S.nMelt++;
  // crystals whose nucleus the front will reach stop growing then
  for (const i of S.list) {
    const d = torusDist(bx, by, S.cx[i], S.cy[i]);
    if (d > R) continue;
    const M = s + d / v;
    if (M > S.ct[i] && M < S.cD[i]) {
      S.cD[i] = M;
      S.cE[i] = min(M, S.ct[i] + S.cG[i]);
      // the LEDs it holds with a later arrival are open again
      const C = ceil(S.cG[i] * S.cRc[i]) + 1, x0 = floor(S.cx[i]), y0 = floor(S.cy[i]);
      for (let ddy = -C; ddy <= C; ddy++) {
        const py = (y0 + ddy) & 127;
        for (let ddx = -C; ddx <= C; ddx++) {
          const p = (py << 6) | ((x0 + ddx) & 63);
          if (S.own[p] === i && S.Tm[p] > M) recompute(S, p);
        }
      }
    }
  }
}
// the LEDs a melt front crosses up to time t1 are liquid from the moment it crosses them
function passages(S, t1) {
  for (const m of S.melts) {
    const C = ceil(m.R) + 1, x0 = floor(m.x), y0 = floor(m.y);
    for (let ddy = -C; ddy <= C; ddy++) {
      const py = (y0 + ddy) & 127, dy = ddy + (y0 + 0.5 - m.y);
      for (let ddx = -C; ddx <= C; ddx++) {
        const dx = ddx + (x0 + 0.5 - m.x), d2 = dx * dx + dy * dy;
        if (d2 > m.R * m.R) continue;
        const M = m.s + sqrt(d2) / m.v;
        if (M > t1) continue;
        const p = (py << 6) | ((x0 + ddx) & 63);
        if (M > S.mt[p]) {
          S.mt[p] = M;
          recompute(S, p);
        }
      }
    }
  }
  S.melts = S.melts.filter((m) => m.s + m.R / m.v > t1);
}
// a crystal goes when it owns no LED and its front has stopped for good: it reached its cap, or its nucleus melted. Whatever
// it could still change at any LED has then been settled, so the picture is the same with or without this.
function retire(S, t1) {
  if (!RETIRE) return;
  let any = false;
  for (const i of S.list)
    if (S.cnt[i] === 0 && t1 >= S.cE[i]) { S.alive[i] = 0; S.free.push(i); any = true; }
  if (any) S.list = S.list.filter((i) => S.alive[i]);
}

// ---- the numbers the knobs set
function makeCfg(sc, k4) {
  const D = D0 * pow(DSCALE, sc), v = D / TG, Ag = (PI / 4) * D * D, RM = min(20, RMK * D);
  const u = (k4 + 1) / 2;
  return {
    D, v, vm: KM * v, RM, excl: EXCL * TG, fmax: FMAX, ramp0: RAMP0 * TG, ramp1: RAMP1 * TG, capR: min(CAPR, 1.5 * D),
    I: IK * v * pow(1.137 / Ag, 1.5), // per LED and second
    lamM: N / (PI * RM * RM * TPASS * pow(D0 / D, TPEXP)), // melt events a second over the whole panel
    sharp: sm(0, 0.5, u), irr: 0.06 + 0.6 * sm(0.5, 1, u),
  };
}

// ---- one step of h seconds
function step(S, cfg, h) {
  const t0 = S.t, t1 = t0 + h, a = exp(-h / TAUZ), b = sqrt(1 - a * a) * SIGZ;
  S.zn = S.zn * a + b * gauss();
  S.zm = S.zm * a + b * gauss();
  const rn = cfg.I * N * cfg.fmax * exp(S.zn), rm = cfg.lamM * exp(S.zm);
  for (let u = -log(1 - random()) / rn; u < h; u += -log(1 - random()) / rn) {
    const x = random() * W, y = random() * H, te = t0 + u, p = (floor(y) << 6) | floor(x);
    S.nTry++;
    // thinning: the rate at an LED is I for liquid that melted a moment ago and fmax times I once it has sat for ramp seconds
    const g = 1 + (cfg.fmax - 1) * sm(cfg.ramp0, cfg.ramp1, te - S.mt[p]);
    if (S.Tm[p] > te + cfg.excl && random() * cfg.fmax < g) {
      S.nNuc++;
      addCrystal(S, cfg, x, y, te);
    }
  }
  for (let u = -log(1 - random()) / rm; u < h; u += -log(1 - random()) / rm) addMelt(S, cfg, t0 + u);
  passages(S, t1);
  S.t = t1;
  retire(S, t1);
}

// ---- colour. OKLab (Bjorn Ottosson, 2020, constants from memory)
function lin(L, a, b, o) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const GAM = new Float32Array(4097);
for (let k = 0; k <= 4096; k++) {
  const x = k / 4096;
  GAM[k] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
}
const gam = (x) => GAM[x <= 0 ? 0 : x >= 1 ? 4096 : (x * 4096 + 0.5) | 0];
const O = [0, 0, 0];
const HUE0 = 140, HSPAN = 250;
function put(display, x, y, L, C, ca, sa) {
  for (let it = 0; it < 7; it++) {
    lin(L, C * ca, C * sa, O);
    if (O[0] >= -0.002 && O[1] >= -0.002 && O[2] >= -0.002 && O[0] <= 1.002 && O[1] <= 1.002 && O[2] <= 1.002) break;
    C *= 0.9;
  }
  display.setPixel(x, y, gam(O[0]), gam(O[1]), gam(O[2]));
}

// ---- the knobs, and the pattern's three functions
const KNOB = [0, 2, 0, 0.06];
function build(params, k) {
  const S = (params.s = newWorld());
  S.sc = cl(k[2], -1, 1);
  S.kp = cl(k[1], 1, 3.5);
  S.k4 = cl(k[3], -1, 1);
  S.hueK = cl(k[0], 0, 1);
  for (let i = CAP - 1; i >= 0; i--) S.free.push(i);
  const cfg = makeCfg(S.sc, S.k4);
  for (let t = 0; t < SPIN; t += SPINH) step(S, cfg, SPINH);
}
// the Lab calls setup before it has the knobs, so the history is run on the first update, at the knobs it finds then
export function setup(params, knobValues) {
  if (knobValues) build(params, knobValues);
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) build(params, k);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  if (d <= 0) return;
  const f = 1 - exp(-4 * d);
  S.kp += (cl(k[1], 1, 3.5) - S.kp) * f;
  S.sc += (cl(k[2], -1, 1) - S.sc) * f;
  S.k4 = cl(k[3], -1, 1);
  S.hueK = cl(k[0], 0, 1);
  step(S, makeCfg(S.sc, S.k4), d * S.kp);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const t = S.t, hk = HUE0 + S.hueK * 360;
  // each crystal's colour when mature, from its orientation
  for (const i of S.list) {
    let hd = hk + HSPAN * S.cu[i];
    let dh = (((hd - 104) % 360) + 360) % 360;
    if (dh > 180) dh -= 360;
    // the greenish yellows between 84 and 124 degrees are never used: on the panel they come out as khaki. A grain that would
    // fall there goes to the nearer edge, a pale amber or a lime, and the lightness of both is lifted.
    if (dh > -20 && dh < 20) {
      hd += (dh < 0 ? -20 : 20) - dh;
      dh = dh < 0 ? -20 : 20;
    }
    const wy = exp(-(dh * dh) / 4050);
    S.chL[i] = 0.42 + 0.14 * (S.cj[i] - 0.5) + 0.4 * wy;
    S.chC[i] = 0.11 * (1 - 0.3 * wy);
    S.chS[i] = BREATH * sin((TAU * t) / S.cpe[i] + S.cph[i]);
    const h = (hd * PI) / 180;
    S.chA[i] = cos(h);
    S.chB[i] = sin(h);
  }
  // the hot rim of the live melt fronts
  const ring = S.ring;
  ring.fill(0);
  for (const m of S.melts) {
    const rho = m.v * (t - m.s), C = ceil(m.R) + 4, x0 = floor(m.x), y0 = floor(m.y), amp = 1 - 0.75 * sm(0.55, 1, rho / m.R);
    for (let ddy = -C; ddy <= C; ddy++) {
      const py = (y0 + ddy) & 127, dy = ddy + (y0 + 0.5 - m.y);
      for (let ddx = -C; ddx <= C; ddx++) {
        const dx = ddx + (x0 + 0.5 - m.x), d = sqrt(dx * dx + dy * dy) - rho;
        if (d < -4 || d > 3) continue;
        const g = d > 0 ? exp(-(d * d) / 2.4) : exp(d / 1.7);
        const p = (py << 6) | ((x0 + ddx) & 63);
        ring[p] = min(1.4, ring[p] + amp * g);
      }
    }
  }
  const psi = t * 0.07, hotA = cos(((hk + 230) * PI) / 180), hotB = sin(((hk + 230) * PI) / 180);
  const gA = cos(((hk + 70) * PI) / 180), gB = sin(((hk + 70) * PI) / 180);
  // the dark ground keeps its colour only in the cool hues; a dark orange is brown on the panel, so there it goes to grey
  let gh = (((hk + 70 - 60) % 360) + 360) % 360;
  if (gh > 180) gh -= 360;
  const gC = 1 - 0.85 * exp(-(gh * gh) / 7200);
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, rg = ring[p];
    let L, C, ca, sa;
    if (S.Tm[p] <= t) {
      const i = S.own[p], a = t - S.Tm[p], er = exp(-a / TAUR), em = exp(-a / TAUM);
      L = S.chL[i] + S.chS[i] + (LR - S.chL[i]) * er + DLM * em;
      C = S.chC[i] * (1 + 0.3 * em) * (1 - 0.7 * er);
      ca = S.chA[i];
      sa = S.chB[i];
      let dx = x + 0.5 - S.cx[i], dy = y + 0.5 - S.cy[i];
      if (dx >= HW) dx -= W;
      else if (dx < -HW) dx += W;
      if (dy >= HH) dy -= H;
      else if (dy < -HH) dy += H;
      gauge(S, i, dx, dy);
      L += GLINT * cos(S.cth[i] + (FK * PI) / 3 - psi);
    } else {
      const g = exp(-(t - S.mt[p]) / TAUH);
      L = 0.12 + 0.13 * g;
      C = (0.06 + 0.05 * g) * gC;
      ca = gA;
      sa = gB;
    }
    if (rg > 0.01) {
      const w = min(1, rg), w2 = w * w;
      L += (0.92 - L) * w;
      C = C * (1 - w) + 0.07 * w2;
      ca = ca * (1 - w2) + hotA * w2;
      sa = sa * (1 - w2) + hotB * w2;
    }
    put(display, x, y, L, C, ca, sa);
  }
}
