// ===== Patternflow pattern =====
// Title:   Interchange
// Family:  longexposure
// Idea:    A long-exposure photograph of night traffic on a stacked highway interchange at blue hour, kept alive: the cars follow a car-following model along ramps that swing across each other on three levels, each leaves its light in a buffer that fades with the shutter time, so white headlights one way and red taillights the other draw thin even ribbons where traffic flows and blaze thick where it jams, and the stop-and-go wave walks backward up the road as a bright blob.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the long-exposure night-traffic photograph (light trails as the time integral of moving points, an exponential shutter here); the Intelligent Driver Model of car following (Martin Treiber, Ralf Hennecke and Dirk Helbing, 2000), whose queues form at a bottleneck and send stop-and-go waves backward against the flow; pattern round 210
// Round:   210
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Traffic=0..2.5, Shutter=-1..1, Bend=-1..1
//
// Knob 1: Hue. Turns the sky glow and every car light round the colour wheel. At 0 the sky runs from indigo at the top to an orange glow on the horizon at row 33, headlights are warm white, taillights red and trucks amber; at 0.5 the glow is blue-green and the taillights cyan; at 1 it is back where it began.
// Knob 2: Traffic. How many cars enter each lane. At 0 about 5 a minute, so each lane is a few lone comets with long tails; at the opening 2 about 34 a minute, a lane at about four fifths of what it can carry, so a queue forms at a slow patch now and then and fades; at 2.5 about 53 a minute, more than a lane can carry, so queues stand on every road and the ribbons blaze. The picture is metered, so the sparse end is not dark.
// Knob 3: Shutter. How long the light stays on the film, 0.7 s at -1 to 14 s at 1 (3.1 s at the opening 0). At -1 each car is a bright point with a tail of 8 to 28 LEDs and the ribbons are broken; at the opening they are continuous with a dash here and there; at 1 a jam is a smear that takes about half a minute to fade and the whole picture is about twice as bright.
// Knob 4: Bend. How far the roads swing, by moving their Bezier control points. At -1 the ramp and the side road are near-straight diagonals that cross the highway once; at the opening 0.06 they sweep in S-curves; at 1 the ramp swings out to the left edge and back across the highway to the right horizon, and the flyover bows into an S.

const W = 64;
const H = 128;
const NPX = W * H;
const YH = 33; // the horizon row
const { sin, cos, sqrt, exp, floor, ceil, max, min, abs, log, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// how near the viewer a row is: 0 at the horizon, 1 at the bottom
const near = (y) => cl((y - YH) / (H - YH), 0, 1);
// the mild perspective: how big a thing is at row y
const ps = (y) => 0.42 + 0.98 * near(y);

const SIM_H = 1 / 30; // the traffic steps at 30 Hz whatever the frame rate
const PRERUN = 30; // seconds of traffic and exposure already on the film at the start
const TAU_MIN = 0.7;
const TAU_MAX = 14;
const KB = 0.55; // how much of the blurred exposure is laid over the sharp one

// ---- colour ----
// OKLCH to linear sRGB, scaled so the brightest channel is 1.
function tint(hueTurns, L, C, out) {
  const h = hueTurns * TAU;
  const a = C * cos(h);
  const b = C * sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  r = max(r, 0);
  g = max(g, 0);
  bl = max(bl, 0);
  const k = 1 / max(r, g, bl, 1e-6);
  out[0] = r * k;
  out[1] = g * k;
  out[2] = bl * k;
}

// encode: linear light, soft knee above 0.6, then 1/2.2
const NLUT = 2048;
const ENC = new Uint8Array(NLUT + 1);
for (let i = 0; i <= NLUT; i++) {
  const x = (i / NLUT) * 2.5;
  const y = x < 0.6 ? x : 0.6 + 0.4 * (1 - exp(-(x - 0.6) / 0.4));
  ENC[i] = Math.round(255 * Math.pow(y, 0.45));
}

// a gaussian by table: index = d2 / (2 sigma^2) * 256 / 7
const GT = new Float32Array(257);
for (let i = 0; i <= 256; i++) GT[i] = i === 256 ? 0 : exp((-i / 256) * 7);

function hash(i) {
  const h = sin(i * 12.9898 + 4.1414) * 43758.5453;
  return h - floor(h);
}

// ---- the roads ----
// Each road is a chain of cubic Beziers in panel space, given twice: a (the
// Bend knob at -1, near straight) and b (at +1, wide). A road is two lanes,
// one each way, either side of the centre line by off (LEDs at the scale of
// row 128, smaller toward the horizon). lvl is the level it runs on: a road
// on a higher level hides the light of the lower ones under its deck.
// rise is the stretch of the road, as a fraction of its length, over which a
// ramp climbs onto its deck. bn is where the slow patch sits, as a fraction of
// the lane, and dem how much of the traffic the knob asks for each lane gets.
const ROADS = [
  // the highway: from the bottom left, an S up to the horizon
  { lvl: 0, off: 3.2, a: [14, 142, 22, 116, 34, 98, 38, 80, 40, 66, 40, 52, 40, 36], b: [10, 142, 2, 106, 54, 110, 48, 82, 44, 60, 20, 54, 36, 36], rise: [0, 0.01], bn: [0.5, 0.42], dem: [1.0, 0.9] },
  // the ramp: from the bottom right, over the highway, out to the left and up
  { lvl: 1, off: 2.3, a: [72, 140, 54, 116, 26, 88, 10, 64, 4, 54, 0, 46, -2, 38], b: [76, 136, 40, 134, -4, 118, 4, 90, 12, 64, 46, 80, 54, 38], rise: [0.12, 0.34], bn: [0.62, 0.55], dem: [0.95, 0.85] },
  // the flyover: across the whole frame in the middle distance
  { lvl: 2, off: 2.5, a: [-8, 70, 20, 62, 46, 58, 72, 50], b: [-8, 78, 22, 40, 46, 88, 72, 48], rise: [0, 0.01], bn: [0.55, 0.4], dem: [0.85, 1.0] },
  // the side road: in from the right edge, down under the ramp to the bottom
  { lvl: 0, off: 2.4, a: [72, 92, 62, 104, 54, 122, 50, 142], b: [72, 84, 40, 90, 70, 118, 44, 142], rise: [0, 0.01], bn: [0.5, 0.45], dem: [0.8, 0.8] },
];
const NSEG = 60;
const NCAP = 420; // table length of a lane, in world units

// car-following (IDM) in world units: the length of road as the road would
// measure it at row 128 scale, so a car far away crosses fewer LEDs a second
const V0 = 20;
const ACC = 5;
const DEC = 7;
const THW = 1.1; // time headway
const S0 = 2.2; // standstill gap
const CARLEN = 2.8;

const PX = new Float32Array(NSEG * 4 + 8);
const PY = new Float32Array(NSEG * 4 + 8);
const NX = new Float32Array(NSEG * 4 + 8);
const NY = new Float32Array(NSEG * 4 + 8);
const OX = new Float32Array(NSEG * 4 + 8);
const OY = new Float32Array(NSEG * 4 + 8);
const CW = new Float32Array(NSEG * 4 + 8);

export function setup(params) {
  const S = {
    warm: false,
    t: 0,
    simT: 0,
    acc: 0,
    hue: 0,
    traffic: 2,
    shut: 0,
    bend: 0.06,
    builtBend: 9,
    builtHue: 9,
    builtDrift: 99,
    bendE: 0.06,
    sway: 0,
    skyDrift: 0,
    tau: 3,
    flow: 0.4,
    lb: [new Float32Array(NPX * 3), new Float32Array(NPX * 3), new Float32Array(NPX * 3)],
    dk: [null, new Float32Array(NPX), new Float32Array(NPX)],
    comp: new Float32Array(NPX * 3),
    cb: new Float32Array(NPX * 3),
    cbt: new Float32Array(NPX * 3),
    lo1: new Float32Array(16 * 32 * 3),
    lo1b: new Float32Array(16 * 32 * 3),
    lo2: new Float32Array(8 * 16 * 3),
    lo2b: new Float32Array(8 * 16 * 3),
    cws: [],
    tmp: [0, 0, 0],
    HL: [1, 1, 1],
    BW: [1, 1, 1],
    TL: [1, 0.1, 0.1],
    AMB: [1, 0.5, 0.1],
    SKYT: [0.1, 0.1, 0.5],
    SKYM: [0.5, 0.2, 0.6],
    SKYG: [1, 0.5, 0.2],
    HAZE: [1, 0.4, 0.3],
    city: [],
    row: new Float32Array(H * 3),
  };
  let idx = 0;
  for (let ri = 0; ri < ROADS.length; ri++) {
    for (let dir = 0; dir < 2; dir++) {
      const R = ROADS[ri];
      S.cws.push({
        ri,
        dir,
        idx,
        lvl: R.lvl,
        X: new Float32Array(NCAP),
        Y: new Float32Array(NCAP),
        WT: new Float32Array(NCAP),
        nT: 2,
        cars: [],
        next: hash(idx * 7.7 + 1) * 1.5,
        cnt: 0,
        dem: R.dem[dir],
        sbf: R.bn[dir],
        p1: hash(idx * 3.1 + 2) * TAU,
        p2: hash(idx * 5.3 + 3) * TAU,
        p3: hash(idx * 9.7 + 4) * TAU,
        fb: 1,
      });
      idx++;
    }
  }
  // the lights of a far town along the horizon
  for (let k = 0; k < 10; k++) {
    S.city.push({
      x: 3 + 58 * hash(k * 2.3 + 7),
      y: YH + 2.6 + 5.5 * hash(k * 4.1 + 2) * hash(k * 1.7 + 5),
      sx: 1.5 + 1.5 * hash(k * 6.1 + 3),
      sy: 1.0 + 0.9 * hash(k * 8.3 + 9),
      a: 0.09 + 0.16 * hash(k * 3.7 + 1),
      kind: hash(k * 5.9 + 4),
      w: 0.31 + 0.9 * hash(k * 1.3 + 8),
      p: TAU * hash(k * 9.1 + 6),
    });
  }
  params.s = S;
}

// ---- geometry ----
function buildAll(S) {
  const u = cl((S.bendE + 1) * 0.5, 0, 1);
  S.dk[1].fill(0);
  S.dk[2].fill(0);
  for (let ri = 0; ri < ROADS.length; ri++) buildRoad(S, ri, u);
  S.builtBend = S.bendE;
}

function buildRoad(S, ri, u) {
  const R = ROADS[ri];
  const nseg = (R.a.length / 2 - 1) / 3;
  let m = 0;
  for (let g = 0; g < nseg; g++) {
    const o = g * 6;
    const x0 = lerp(R.a[o], R.b[o], u);
    const y0 = lerp(R.a[o + 1], R.b[o + 1], u);
    const x1 = lerp(R.a[o + 2], R.b[o + 2], u);
    const y1 = lerp(R.a[o + 3], R.b[o + 3], u);
    const x2 = lerp(R.a[o + 4], R.b[o + 4], u);
    const y2 = lerp(R.a[o + 5], R.b[o + 5], u);
    const x3 = lerp(R.a[o + 6], R.b[o + 6], u);
    const y3 = lerp(R.a[o + 7], R.b[o + 7], u);
    const kmax = g === nseg - 1 ? NSEG : NSEG - 1;
    for (let k = 0; k <= kmax; k++) {
      const t = k / NSEG;
      const mt = 1 - t;
      const c0 = mt * mt * mt;
      const c1 = 3 * mt * mt * t;
      const c2 = 3 * mt * t * t;
      const c3 = t * t * t;
      PX[m] = c0 * x0 + c1 * x1 + c2 * x2 + c3 * x3;
      PY[m] = c0 * y0 + c1 * y1 + c2 * y2 + c3 * y3;
      m++;
    }
  }
  for (let i = 0; i < m; i++) {
    const ia = i > 0 ? i - 1 : 0;
    const ib = i < m - 1 ? i + 1 : m - 1;
    const tx = PX[ib] - PX[ia];
    const ty = PY[ib] - PY[ia];
    const l = sqrt(tx * tx + ty * ty) || 1;
    NX[i] = -ty / l;
    NY[i] = tx / l;
  }
  // the two lanes
  for (let dir = 0; dir < 2; dir++) {
    const cw = S.cws[ri * 2 + dir];
    const sg = dir === 0 ? 1 : -1;
    for (let i = 0; i < m; i++) {
      const j = dir === 0 ? i : m - 1 - i;
      const f = sg * R.off * ps(PY[j]);
      OX[i] = PX[j] + NX[j] * f;
      OY[i] = PY[j] + NY[j] * f;
    }
    // world length along the lane
    CW[0] = 0;
    for (let i = 1; i < m; i++) {
      const dx = OX[i] - OX[i - 1];
      const dy = OY[i] - OY[i - 1];
      CW[i] = CW[i - 1] + sqrt(dx * dx + dy * dy) / ps(0.5 * (OY[i] + OY[i - 1]));
    }
    const tot = CW[m - 1];
    const nT = min(NCAP - 2, floor(tot));
    let p = 0;
    for (let j = 0; j <= nT; j++) {
      while (p < m - 2 && CW[p + 1] < j) p++;
      const seg = CW[p + 1] - CW[p] || 1;
      const f = cl((j - CW[p]) / seg, 0, 1);
      cw.X[j] = lerp(OX[p], OX[p + 1], f);
      cw.Y[j] = lerp(OY[p], OY[p + 1], f);
    }
    for (let j = 0; j < nT; j++) {
      const dx = cw.X[j + 1] - cw.X[j];
      const dy = cw.Y[j + 1] - cw.Y[j];
      const l = sqrt(dx * dx + dy * dy) || 1;
      // heading down the panel is coming toward the viewer: headlights
      cw.WT[j] = sm(-0.18, 0.5, dy / l);
    }
    cw.WT[nT] = cw.WT[nT - 1];
    cw.nT = nT;
    cw.sb = cw.sbf * nT;
  }
  // the deck of a road above the ground hides what is under it
  if (R.lvl > 0) {
    const dk = S.dk[R.lvl];
    // arc length along the centre line, for the rise
    let tot = 0;
    for (let i = 1; i < m; i++) tot += sqrt((PX[i] - PX[i - 1]) ** 2 + (PY[i] - PY[i - 1]) ** 2);
    let run = 0;
    for (let i = 0; i < m; i++) {
      let a = 0;
      let b = 1;
      let nsub = 1;
      if (i > 0) {
        a = 0;
        b = 1;
        nsub = max(1, ceil(sqrt((PX[i] - PX[i - 1]) ** 2 + (PY[i] - PY[i - 1]) ** 2) / 0.5));
      }
      for (let k = 0; k < nsub; k++) {
        let cx = PX[i];
        let cy = PY[i];
        let fr = run / tot;
        if (i > 0) {
          const tt = (k + 1) / nsub;
          cx = lerp(PX[i - 1], PX[i], tt);
          cy = lerp(PY[i - 1], PY[i], tt);
          fr = (run + tt * sqrt((PX[i] - PX[i - 1]) ** 2 + (PY[i] - PY[i - 1]) ** 2)) / tot;
        }
        const cov = sm(R.rise[0], R.rise[1], fr);
        if (cov < 0.01) continue;
        const hw = ps(cy) * (R.off + 2.2);
        const x0 = max(0, floor(cx - hw - 1.2));
        const x1 = min(W - 1, ceil(cx + hw + 1.2));
        const y0 = max(0, floor(cy - hw - 1.2));
        const y1 = min(H - 1, ceil(cy + hw + 1.2));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const dx = x + 0.5 - cx;
            const dy = y + 0.5 - cy;
            const d = sqrt(dx * dx + dy * dy);
            const c = sm(hw + 0.7, hw - 0.5, d) * cov;
            const o = y * W + x;
            if (c > dk[o]) dk[o] = c;
          }
        }
      }
      if (i > 0) run += sqrt((PX[i] - PX[i - 1]) ** 2 + (PY[i] - PY[i - 1]) ** 2);
    }
  }
}

// ---- colours at the knob's hue ----
function buildColours(S) {
  const h = S.hue;
  const tmp = S.tmp;
  const set = (dst, deg, L, C) => {
    tint((((deg / 360 + h) % 1) + 1) % 1, L, C, tmp);
    dst[0] = tmp[0];
    dst[1] = tmp[1];
    dst[2] = tmp[2];
  };
  set(S.HL, 95, 0.97, 0.025);
  set(S.BW, 245, 0.92, 0.07);
  set(S.TL, 27, 0.63, 0.25);
  set(S.AMB, 68, 0.82, 0.17);
  set(S.SKYT, 283 + S.skyDrift, 0.4, 0.14);
  set(S.SKYM, 335 + S.skyDrift, 0.55, 0.17);
  set(S.SKYG, 42 + S.skyDrift, 0.78, 0.16);
  set(S.HAZE, 20 + S.skyDrift, 0.7, 0.14);
  S.builtHue = S.hue;
  S.builtDrift = S.skyDrift;
}

// ---- the traffic ----
function stepSim(S, h) {
  S.simT += h;
  const T = S.simT;
  const kd = exp(-h / S.tau);
  // the exposure: every buffer fades with the shutter time
  for (let l = 0; l < 3; l++) {
    const b = S.lb[l];
    for (let i = 0; i < b.length; i++) {
      const v = b[i] * kd;
      b[i] = v < 1e-4 ? 0 : v;
    }
  }
  // the film is metered: fewer cars, longer exposure of each
  const pw = 0.23 * pow(3 / S.tau, 0.42) * pow(0.55 / S.flow, S.flow < 0.55 ? 0.6 : 0.3) * h; // light a unit car leaves per step
  for (let k = 0; k < S.cws.length; k++) stepLane(S, S.cws[k], h, T, pw);
}

function stepLane(S, cw, h, T, pw) {
  const cars = cw.cars;
  const nT = cw.nT;
  // a slow patch somewhere on the lane that comes and goes: where the queues start
  const w = sin(0.21 * T + cw.p1) + 0.8 * sin(0.137 * T + cw.p2) + 0.5 * sin(0.071 * T + cw.p3);
  cw.fb = 0.05 + 0.95 * sm(-0.7, 0.45, w);
  // spawn
  if (T >= cw.next) {
    const last = cars.length ? cars[cars.length - 1] : null;
    if (!last || last.s > 5 + last.v * 0.6) {
      const r1 = hash(cw.idx * 131.7 + cw.cnt * 7.13 + 0.5);
      const r2 = hash(cw.idx * 17.9 + cw.cnt * 3.77 + 1.5);
      const r3 = hash(cw.idx * 53.3 + cw.cnt * 5.19 + 2.5);
      const r4 = hash(cw.idx * 29.1 + cw.cnt * 11.3 + 3.5);
      const kind = r2 < 0.07 ? 1 : r2 < 0.15 ? 2 : 0;
      const v0 = V0 * (0.9 + 0.2 * r3) * (kind === 1 ? 0.72 : 1);
      const v = min(v0, last ? last.v + 3 : v0) * 0.9;
      cars.push({ s: 0, sp: 0, v, v0, kind, br: 0, slow: 0, inc: r4 < 0.4 ? (0.2 + 0.6 * hash(cw.cnt * 1.9 + cw.idx)) * nT : -1, len: kind === 1 ? 4.4 : CARLEN });
      cw.cnt++;
      const q = max(0.02, S.flow * cw.dem);
      cw.next = T + max(0.4, -log(1 - 0.985 * r1) / q);
    } else cw.next = T + 0.1;
  }
  const lb = S.lb[cw.lvl];
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    const lead = i > 0 ? cars[i - 1] : null;
    c.sp = c.s;
    let v0 = c.v0;
    const bz = (c.s - cw.sb) / 12;
    v0 *= 1 - (1 - cw.fb) * exp(-0.5 * bz * bz);
    if (c.inc > 0 && c.s >= c.inc) {
      c.slow = 2.0;
      c.inc = -1;
    }
    if (c.slow > 0) {
      v0 *= 0.2;
      c.slow -= h;
    }
    let acc;
    const ratio = c.v / max(v0, 0.5);
    const r2 = ratio * ratio;
    if (lead) {
      const gap = max(lead.s - c.s - lead.len, 0.25);
      const dv = c.v - lead.v;
      const star = S0 + max(0, c.v * THW + (c.v * dv) / (2 * sqrt(ACC * DEC)));
      acc = ACC * (1 - r2 * r2 - (star / gap) * (star / gap));
    } else acc = ACC * (1 - r2 * r2);
    acc = cl(acc, -2 * DEC, ACC);
    c.v = max(0, c.v + acc * h);
    c.s += c.v * h;
    if (lead && c.s > lead.s - lead.len) {
      c.s = max(c.sp, lead.s - lead.len);
      c.v = min(c.v, lead.v);
    }
    c.br += ((acc < -1.2 ? 1 : 0) - c.br) * 0.2;
    if (c.s < nT - 1.01) deposit(S, cw, c, lb, pw);
  }
  while (cars.length && cars[0].s >= nT - 1.01) cars.shift();
}

function deposit(S, cw, c, lb, pw) {
  const X = cw.X;
  const Y = cw.Y;
  const b = c.s;
  const a = max(0, b - c.len * 1.5);
  const ia = a | 0;
  const ib = b | 0;
  const fa = a - ia;
  const fb = b - ib;
  const xa = X[ia] + (X[ia + 1] - X[ia]) * fa;
  const ya = Y[ia] + (Y[ia + 1] - Y[ia]) * fa;
  const xb = X[ib] + (X[ib + 1] - X[ib]) * fb;
  const yb = Y[ib] + (Y[ib + 1] - Y[ib]) * fb;
  const ym = 0.5 * (ya + yb);
  const xm = 0.5 * (xa + xb);
  if (xm < -6 || xm > W + 6 || ym < YH || ym > H + 6) return;
  const q = near(ym);
  const fade = sm(YH + 0.5, YH + 9, ym);
  const sig = 0.7 + 0.3 * q;
  const inv = (1 / (2 * sig * sig)) * (256 / 7);
  // colour: headlights when the lane heads for the viewer, taillights when it heads away
  const wt = cw.WT[ib] + (cw.WT[ib + 1] - cw.WT[ib]) * fb;
  let r;
  let g;
  let bl;
  let kamp = 1;
  if (c.kind === 1) {
    r = S.AMB[0];
    g = S.AMB[1];
    bl = S.AMB[2];
  } else {
    const hl = c.kind === 2 ? S.BW : S.HL;
    const tl = 0.8 + 1.1 * c.br;
    const wh = wt * 1.5;
    const wr = (1 - wt) * tl;
    r = wh * hl[0] + wr * S.TL[0];
    g = wh * hl[1] + wr * S.TL[1];
    bl = wh * hl[2] + wr * S.TL[2];
    if (c.kind === 2) kamp = 1.1;
  }
  // a car that crawls leaves its lights on the film longer and its brake lights on
  const gy = (0.6 + 0.8 * q) * (1 + 1.5 * (1 - sm(0, 9, c.v)));
  const dx = xb - xa;
  const dy = yb - ya;
  const len = sqrt(dx * dx + dy * dy);
  const n = 1 + floor(len / 0.9);
  const amp = (pw * gy * fade * kamp) / n;
  const rad = ceil(2.6 * sig);
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0.5 : k / (n - 1);
    const cx = xa + dx * t;
    const cy = ya + dy * t;
    const x0 = max(0, floor(cx - rad));
    const x1 = min(W - 1, floor(cx + rad));
    const y0 = max(0, floor(cy - rad));
    const y1 = min(H - 1, floor(cy + rad));
    for (let y = y0; y <= y1; y++) {
      const ddy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const ddx = x + 0.5 - cx;
        const gi = ((ddx * ddx + ddy * ddy) * inv) | 0;
        if (gi >= 256) continue;
        const wgt = GT[gi] * amp;
        const o = (y * W + x) * 3;
        lb[o] += wgt * r;
        lb[o + 1] += wgt * g;
        lb[o + 2] += wgt * bl;
      }
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const d = cl(dt || 0, 0, 0.1);
  const kn = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(kn[0], 0, 1);
  S.traffic = cl(kn[1], 0, 2.5);
  S.shut = cl(kn[2], -1, 1);
  S.bend = cl(kn[3], -1, 1);
  S.t += d;
  // the evening moves on its own: the demand swells and ebbs over a minute or two, the
  // roads sway a little, the sky's tint wanders, all on periods that do not divide
  const tt = S.t;
  const swell = 1 + 0.3 * sin(0.043 * tt) + 0.14 * sin(0.0171 * tt + 3.0) - 0.14 * sin(3.0);
  S.sway = 0.13 * sin(0.0313 * tt) + 0.07 * sin(0.0127 * tt + 2.2) - 0.07 * sin(2.2);
  S.skyDrift = 14 * sin(0.0211 * tt + 1.2) - 14 * sin(1.2);
  S.bendE = cl(S.bend + S.sway, -1, 1);
  const tauT = TAU_MIN * pow(TAU_MAX / TAU_MIN, (S.shut + 1) * 0.5);
  S.flow = 0.09 * pow(6.2, S.traffic / 2) * swell;
  if (S.builtHue !== S.hue || abs(S.skyDrift - S.builtDrift) > 0.6) buildColours(S);
  if (!S.warm) {
    S.warm = true;
    S.tau = tauT;
    buildColours(S);
    buildAll(S);
    for (let i = 0, n = Math.round(PRERUN / SIM_H); i < n; i++) stepSim(S, SIM_H);
    return;
  }
  S.tau += (tauT - S.tau) * (1 - exp(-d / 0.25));
  if (abs(S.bendE - S.builtBend) > 0.002) buildAll(S);
  S.acc += d;
  while (S.acc >= SIM_H) {
    S.acc -= SIM_H;
    stepSim(S, SIM_H);
  }
}

// ---- the picture ----
// the sky at row y (above the horizon) into out, at the sky's slow breathing
function skyAt(S, y, out, br) {
  const t = cl((y + 0.5) / YH, 0, 1);
  const a = 0.021 * pow(1 - t, 1.3);
  const b = 0.07 * pow(t, 1.5) * (1 - pow(t, 5));
  const c = 0.4 * br * pow(t, 4.6);
  for (let k = 0; k < 3; k++) out[k] = S.SKYT[k] * a + S.SKYM[k] * b + S.SKYG[k] * c;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const t = S.t;
  const comp = S.comp;
  const l0 = S.lb[0];
  const l1 = S.lb[1];
  const l2 = S.lb[2];
  const d1 = S.dk[1];
  const d2 = S.dk[2];

  // ---- the three exposures, each under the deck of the level above ----
  for (let p = 0, o = 0; p < NPX; p++, o += 3) {
    const k1 = 1 - d1[p];
    const k2 = 1 - d2[p];
    comp[o] = (l0[o] * k1 + l1[o]) * k2 + l2[o];
    comp[o + 1] = (l0[o + 1] * k1 + l1[o + 1]) * k2 + l2[o + 1];
    comp[o + 2] = (l0[o + 2] * k1 + l1[o + 2]) * k2 + l2[o + 2];
  }

  blur5(comp, S.cbt, S.cb);
  const cb = S.cb;

  // ---- glow: two lower-resolution copies, blurred, added back ----
  const lo1 = S.lo1;
  const lo1b = S.lo1b;
  const lo2 = S.lo2;
  const lo2b = S.lo2b;
  for (let by = 0; by < 32; by++) {
    for (let bx = 0; bx < 16; bx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let yy = 0; yy < 4; yy++) {
        let o = ((by * 4 + yy) * W + bx * 4) * 3;
        for (let xx = 0; xx < 4; xx++) {
          r += comp[o];
          g += comp[o + 1];
          b += comp[o + 2];
          o += 3;
        }
      }
      const q = (by * 16 + bx) * 3;
      lo1[q] = r * 0.0625;
      lo1[q + 1] = g * 0.0625;
      lo1[q + 2] = b * 0.0625;
    }
  }
  blur3(lo1, lo1b, 16, 32);
  for (let by = 0; by < 16; by++) {
    for (let bx = 0; bx < 8; bx++) {
      const a = (by * 2 * 16 + bx * 2) * 3;
      const q = (by * 8 + bx) * 3;
      for (let c = 0; c < 3; c++) lo2[q + c] = 0.25 * (lo1[a + c] + lo1[a + 3 + c] + lo1[a + 48 + c] + lo1[a + 51 + c]);
    }
  }
  blur3(lo2, lo2b, 8, 16);
  blur3(lo2, lo2b, 8, 16);

  // ---- sky, haze and the far town ----
  const br = 1 + 0.1 * sin(0.0863 * t + 0.6) + 0.06 * sin(0.0391 * t + 2.2);
  const row = S.row;
  const tmp = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    if (y < YH) {
      skyAt(S, y, tmp, br);
    } else {
      // the ground: a faint blue lift, and the haze of the town just under the horizon
      const dy = y + 0.5 - YH;
      const hz = 0.06 * br * exp(-dy / 4.2) + 0.006 * exp(-dy / 16);
      for (let k = 0; k < 3; k++) tmp[k] = S.HAZE[k] * hz;
      const ridge = 1 - 0.6 * (1 - sm(0, 2.8, dy));
      for (let k = 0; k < 3; k++) tmp[k] *= ridge;
      tmp[0] += 0.0012;
      tmp[1] += 0.0022;
      tmp[2] += 0.0062 + 0.004 * exp(-dy / 25);
    }
    row[y * 3] = tmp[0];
    row[y * 3 + 1] = tmp[1];
    row[y * 3 + 2] = tmp[2];
  }

  // ---- out ----
  const sc = NLUT / 2.5;
  const city = S.city;
  let p = 0;
  for (let y = 0; y < H; y++) {
    const fy = (y + 0.5) * 0.25 - 0.5;
    let iy0 = floor(fy);
    const wy = fy - iy0;
    let iy1 = iy0 + 1;
    if (iy0 < 0) iy0 = 0;
    if (iy1 > 31) iy1 = 31;
    const rr = row[y * 3];
    const rg = row[y * 3 + 1];
    const rb = row[y * 3 + 2];
    for (let x = 0; x < W; x++, p++) {
      const fx = (x + 0.5) * 0.25 - 0.5;
      let ix0 = floor(fx);
      const wx = fx - ix0;
      let ix1 = ix0 + 1;
      if (ix0 < 0) ix0 = 0;
      if (ix1 > 15) ix1 = 15;
      const a = (iy0 * 16 + ix0) * 3;
      const b = (iy0 * 16 + ix1) * 3;
      const c = (iy1 * 16 + ix0) * 3;
      const e = (iy1 * 16 + ix1) * 3;
      const w00 = (1 - wx) * (1 - wy);
      const w10 = wx * (1 - wy);
      const w01 = (1 - wx) * wy;
      const w11 = wx * wy;
      // second glow at an eighth
      const fx2 = (x + 0.5) * 0.125 - 0.5;
      const fy2 = (y + 0.5) * 0.125 - 0.5;
      let jx0 = floor(fx2);
      let jy0 = floor(fy2);
      const vx = fx2 - jx0;
      const vy = fy2 - jy0;
      let jx1 = jx0 + 1;
      let jy1 = jy0 + 1;
      if (jx0 < 0) jx0 = 0;
      if (jy0 < 0) jy0 = 0;
      if (jx1 > 7) jx1 = 7;
      if (jy1 > 15) jy1 = 15;
      const ja = (jy0 * 8 + jx0) * 3;
      const jb = (jy0 * 8 + jx1) * 3;
      const jc = (jy1 * 8 + jx0) * 3;
      const je = (jy1 * 8 + jx1) * 3;
      const v00 = (1 - vx) * (1 - vy);
      const v10 = vx * (1 - vy);
      const v01 = (1 - vx) * vy;
      const v11 = vx * vy;
      const o = p * 3;
      // the deck is a dark shape against the glow behind it
      const dd = d1[p] > d2[p] ? d1[p] : d2[p];
      const bk = 1 - 0.7 * dd;
      let r = rr * bk + comp[o] + KB * cb[o] + 0.26 * (lo1[a] * w00 + lo1[b] * w10 + lo1[c] * w01 + lo1[e] * w11) + 0.13 * (lo2[ja] * v00 + lo2[jb] * v10 + lo2[jc] * v01 + lo2[je] * v11);
      let g = rg * bk + comp[o + 1] + KB * cb[o + 1] + 0.26 * (lo1[a + 1] * w00 + lo1[b + 1] * w10 + lo1[c + 1] * w01 + lo1[e + 1] * w11) + 0.13 * (lo2[ja + 1] * v00 + lo2[jb + 1] * v10 + lo2[jc + 1] * v01 + lo2[je + 1] * v11);
      let bl = rb * bk + comp[o + 2] + KB * cb[o + 2] + 0.26 * (lo1[a + 2] * w00 + lo1[b + 2] * w10 + lo1[c + 2] * w01 + lo1[e + 2] * w11) + 0.13 * (lo2[ja + 2] * v00 + lo2[jb + 2] * v10 + lo2[jc + 2] * v01 + lo2[je + 2] * v11);
      if (y > YH - 4 && y < YH + 14) {
        for (let k = 0; k < city.length; k++) {
          const cc = city[k];
          const ex = (x + 0.5 - cc.x) / cc.sx;
          const ey = (y + 0.5 - cc.y) / cc.sy;
          const q = ex * ex + ey * ey;
          if (q > 9) continue;
          const f = cc.a * exp(-0.5 * q) * (1 + 0.22 * sin(cc.w * t + cc.p)) * bk;
          r += f * (cc.kind < 0.6 ? 1 : cc.kind < 0.85 ? 0.8 : 0.7);
          g += f * (cc.kind < 0.6 ? 0.8 : cc.kind < 0.85 ? 0.55 : 0.85);
          bl += f * (cc.kind < 0.6 ? 0.55 : cc.kind < 0.85 ? 0.2 : 1);
        }
      }
      // a hot core: what is over-exposed goes toward white
      const m = max(r, g, bl);
      if (m > 0.7) {
        const hot = (m - 0.7) * 0.42;
        r += hot;
        g += hot;
        bl += hot;
      }
      display.setPixel(x, y, ENC[min(NLUT, (r * sc) | 0)], ENC[min(NLUT, (g * sc) | 0)], ENC[min(NLUT, (bl * sc) | 0)]);
    }
  }
}

// a [1 2 1] blur over a small float image of 3 channels, in place through tmp
function blur3(img, tmp, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xl = x > 0 ? x - 1 : 0;
      const xr = x < w - 1 ? x + 1 : w - 1;
      const o = (y * w + x) * 3;
      const l = (y * w + xl) * 3;
      const r = (y * w + xr) * 3;
      tmp[o] = 0.25 * img[l] + 0.5 * img[o] + 0.25 * img[r];
      tmp[o + 1] = 0.25 * img[l + 1] + 0.5 * img[o + 1] + 0.25 * img[r + 1];
      tmp[o + 2] = 0.25 * img[l + 2] + 0.5 * img[o + 2] + 0.25 * img[r + 2];
    }
  }
  for (let y = 0; y < h; y++) {
    const yu = y > 0 ? y - 1 : 0;
    const yd = y < h - 1 ? y + 1 : h - 1;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      const u = (yu * w + x) * 3;
      const d = (yd * w + x) * 3;
      img[o] = 0.25 * tmp[u] + 0.5 * tmp[o] + 0.25 * tmp[d];
      img[o + 1] = 0.25 * tmp[u + 1] + 0.5 * tmp[o + 1] + 0.25 * tmp[d + 1];
      img[o + 2] = 0.25 * tmp[u + 2] + 0.5 * tmp[o + 2] + 0.25 * tmp[d + 2];
    }
  }
}

// a separable [1 4 6 4 1] blur of the full panel, 3 channels, src to dst through tmp
function blur5(src, tmp, dst) {
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const x0 = x > 1 ? x - 2 : 0;
      const x1 = x > 0 ? x - 1 : 0;
      const x3 = x < W - 1 ? x + 1 : W - 1;
      const x4 = x < W - 2 ? x + 2 : W - 1;
      const o = (row + x) * 3;
      const a = (row + x0) * 3;
      const b = (row + x1) * 3;
      const d = (row + x3) * 3;
      const e = (row + x4) * 3;
      tmp[o] = (src[a] + 4 * src[b] + 6 * src[o] + 4 * src[d] + src[e]) * 0.0625;
      tmp[o + 1] = (src[a + 1] + 4 * src[b + 1] + 6 * src[o + 1] + 4 * src[d + 1] + src[e + 1]) * 0.0625;
      tmp[o + 2] = (src[a + 2] + 4 * src[b + 2] + 6 * src[o + 2] + 4 * src[d + 2] + src[e + 2]) * 0.0625;
    }
  }
  for (let y = 0; y < H; y++) {
    const y0 = (y > 1 ? y - 2 : 0) * W;
    const y1 = (y > 0 ? y - 1 : 0) * W;
    const y3 = (y < H - 1 ? y + 1 : H - 1) * W;
    const y4 = (y < H - 2 ? y + 2 : H - 1) * W;
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const o = (row + x) * 3;
      const a = (y0 + x) * 3;
      const b = (y1 + x) * 3;
      const d = (y3 + x) * 3;
      const e = (y4 + x) * 3;
      dst[o] = (tmp[a] + 4 * tmp[b] + 6 * tmp[o] + 4 * tmp[d] + tmp[e]) * 0.0625;
      dst[o + 1] = (tmp[a + 1] + 4 * tmp[b + 1] + 6 * tmp[o + 1] + 4 * tmp[d + 1] + tmp[e + 1]) * 0.0625;
      dst[o + 2] = (tmp[a + 2] + 4 * tmp[b + 2] + 6 * tmp[o + 2] + 4 * tmp[d + 2] + tmp[e + 2]) * 0.0625;
    }
  }
}
