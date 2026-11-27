// ===== Patternflow pattern =====
// Title:   Magnetotaxis
// Family:  magnetotactic
// Idea:    Some six hundred rod-shaped bacteria, each laid along the field by a chain of magnetite grains like a compass needle, swim in two colours down and up the curving lines of a bar magnet that stands outside the panel, teal ones north and amber ones south in lanes side by side, and when the field reverses a wave of hairpin turns runs across the panel as every cell is turned round by its own torque.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: magnetotactic bacteria, whose chains of magnetosomes turn the cell passively into the field so that it swims along the line without sensing it (Richard Blakemore, 1975, from memory); north-seeking and south-seeking cells, and the U-turns a cell makes when the field is reversed (Richard Frankel, from memory); the field of a bar magnet as two point poles, whose lines of force are the level lines of the angle between the two directions to them; the swimming rules, the lanes and the numbers are original, pattern round 265
// Round:   265
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Swim=0.5..3, Swing=-1..1, North=-1..1
//
// Knob 1: Hue. Turns both colours round the wheel together. At 0 the north-seeking cells are teal and the south-seeking ones amber, and where the two meet the sum goes white. At 0.25 they are violet and green, at 0.5 rose and blue, at 0.75 magenta and lime.
// Knob 2: Swim. How fast the cells swim, 4.3 LEDs a second for each unit of the knob where the field is middling: 8.6 at the opening 2, 2.2 at 0.5 and 12.9 at 3, and a little faster where the lines of force crowd near the magnet. Their turning rate stays the same, so a faster cell makes a wider hairpin, about 2 LEDs across at 2 and 3 at 3. At 0.5 the lanes fill with slow cells that take close to a minute to cross the panel.
// Knob 3: Swing. How far the magnet swings and how often the field reverses, -1 to 1, opening at 0. The magnet tilts up to 11 degrees either way at -1, 26 at 0 and 57 at 1, on three slow periods of about 2, 3 and 7 minutes, and the field reverses on average every 60 s at -1, every 27 s at 0 and every 12 s at 1, the next one after a random 0.55 to 1.45 of that. The first comes 7 to 12 s after the panel opens.
// Knob 4: North. The share of cells that seek north, -1 to 1, opening at 0.06. At -1 it is 12 percent: nearly all the cells are amber and a few teal ones swim back against them. At 0.06 the two are about even, and at 1 it is 88 percent teal. A cell that has to change sides fades out where it is and is born again on the other side.
//
// What the picture is. A bar magnet stands outside the left edge, drawn as two poles 80 LEDs apart, and the panel sees the lines of force that go out of one and into the other as nested arcs. A cell is a rod with a chain of magnetite grains along it, so the field turns it like a needle, at 3 radians a second, and it swims along that line whichever way it is born facing: a north-seeker with the field, a south-seeker against it. It does not sense the field and does not steer.
// The cells keep to lanes of the field, teal ones on one set and amber ones on another set a third of a lane away, so on each arc a teal stream goes one way beside an amber stream going the other. Where the lines crowd near the magnet some lanes are left out, and cells are born outside the panel and swim in along their lane. A tenth of the cells keep no lane and follow a line of their own.
// When the field reverses its strength goes through nothing and comes back the other way, first at the magnet and then outward at 40 LEDs a second. A cell that is turned the wrong way round lies at the unstable end of its needle, tumbles a little as the field passes through nothing, and is turned round in a hairpin of 2 to 3 LEDs. The tails lengthen while the cells are turning, so the hairpins show. Then the lanes fill with cells going the other way.

const W = 64, H = 128;
const { floor, round, sqrt, exp, sin, cos, atan2, abs, min, max, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

const N = 640;          // cells in all, about a fifth of them outside the panel at any moment
const MG = 5;           // LEDs beyond the panel edge where a cell is still alive
const OM = 3.2;         // turning rate toward the field, a second, at the middle of the field's strength
const SIG = 0.1;        // rotational diffusion, radians over the square root of a second
const SPD = 4.3;        // LEDs a second for each unit of Swim
const HALF = 40;        // half the length of the magnet's pole line, in LEDs
const EPS2 = 9;         // softening of a pole, LED squared
const DPSI = 0.26;      // flux between two lanes, in radians of the stream function
const LANE = 0.36;      // how far, in lanes, the south-seekers' band stands from the north-seekers'
const FREE = 0.1;       // the share of cells that are not held to a lane and swim a line of their own
const HOLD = 0.6;       // a second: how fast a cell settles toward the middle of its lane
const SW = 1.3;         // how far from the middle of its lane a cell is born, in LEDs (one sigma)
const FLOORW = 0.06;    // the share of cells that lie between lanes
const KICK = 2.4;       // radians a second at the middle of a reversal, so a cell has turned 0.6 rad by the time the field is back
const VF = 40;          // LEDs a second the reversal travels out from the magnet
const REV = 0.5;        // seconds a reversal of the field takes
const LEN = 1.4;        // body length behind the head, LEDs
const TAIL = 0.4;       // seconds a tail takes to fade by a factor e
const FLK = 0.12;       // how much a cell flickers, as a share of its light
const WOB = 0.4;        // LEDs a cell is drawn to either side of its path as it swims in a helix
const TAMP = 0.5;       // how bright the tail starts, against the body
const S0 = 12;          // LEDs between two lanes that are drawn; where lines of force crowd closer, some of them are left out
const BHI = 0.075;      // where the field is stronger than this, close to a pole, a cell fades away
const PRE = 24;         // seconds the swimmers have swum before the first frame

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const f = (n) => new Float32Array(n);
  const S = {
    ready: false, t: 0, to: 0, k: [0, 2, 0, 0.06], hueSet: NaN,
    hand: 1, mis: 0, hnd: new Float32Array(N), bri: new Float32Array(N), fw: new Float32Array(N), free: new Uint8Array(N),
    x: f(N), y: f(N), th: f(N), v: f(N), age: f(N), life: f(N), r: f(N), ph: f(N), g: f(N), s: new Int8Array(N),
    amp: 0.3, spd: 8.6, ratio: 0.52, fl: 1, tk: 0, fT: 1, tf0: -1e9, tFlip: 1e9, mean: 28, mx: 0, my: 0,
    p0x: 0, p0y: 0, p1x: 0, p1y: 0, bx: 0, by: 0, psi: 0, bp: 0,
    hT: f(W * H), hA: f(W * H), tT: f(W * H), tA: f(W * H),
    lut: [new Float32Array(64 * 3), new Float32Array(64 * 3)],
  };
  for (let i = 0; i < N; i++) {
    S.r[i] = rnd();
    S.ph[i] = rnd() * TAU;
    S.v[i] = 0.9 + 0.2 * rnd();
    S.hnd[i] = rnd() < 0.15 ? -1 : 1;
    S.bri[i] = 0.6 + 0.4 * rnd();
    S.free[i] = rnd() < FREE ? 1 : 0;
    S.fw[i] = 1.1 + 1.3 * rnd();
  }
  params.s = S;
  return S;
}

// Whether a lane is drawn where it stands: all of them where they are S0 apart
// or more, and a share of them, picked by lane, where they crowd.
function lh(k, side) {
  let h = Math.imul((k + 4096 * side) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vis(S, side, bm) {
  const q = S.psi / DPSI + (side > 0 ? 0 : LANE) + S.bp;
  return sm(-0.04, 0.16, cl(DPSI / (bm * S0), 0, 1) - lh(round(q), side > 0 ? 0 : 1));
}

// The magnet: two poles that stand outside the left edge, a line of 2 HALF LEDs
// that tilts a little either way and drifts up and down. B leaves the
// plus pole and enters the minus pole.
function wander(S) {
  const t = S.t - S.to;
  return (0.6 * sin(0.053 * t + 1.2) + 0.4 * sin(0.0347 * t + 0.4) + 0.2 * sin(0.0151 * t + 2.0)) / 1.2;
}
function poles(S) {
  const t = S.t - S.to, a = S.amp * wander(S);
  const ux = sin(a), uy = -cos(a);
  // the line of the poles breathes a little longer and shorter
  const h = HALF * (1 + 0.16 * sin(0.0213 * t + 2.3) + 0.08 * sin(0.0467 * t));
  const cx = -17 - h * abs(ux) + 3 * sin(0.018 * t + 0.7), cy = 64 + 12 * sin(0.02 * t + 1.1);
  S.mx = cx;
  S.my = cy;
  S.p0x = cx + h * ux; S.p0y = cy + h * uy;
  S.p1x = cx - h * ux; S.p1y = cy - h * uy;
  S.bp = 0.7 * sin(0.0149 * t) + 0.4 * sin(0.0344 * t + 1);
}
// The field and its stream function at a point: B from the two poles, and psi
// the angle between the directions to them, which is the same on a field line.
function field(S, x, y) {
  const ax = x - S.p0x, ay = y - S.p0y, bx = x - S.p1x, by = y - S.p1y;
  const qa = 1 / (ax * ax + ay * ay + EPS2), qb = 1 / (bx * bx + by * by + EPS2);
  S.bx = ax * qa - bx * qb;
  S.by = ay * qa - by * qb;
  S.psi = abs(atan2(ax * by - ay * bx, ax * bx + ay * by));
}

// The signed strength of the field at a point, 1 when it is as it was set and -1
// when it is reversed, and the tumble that goes with a reversal in progress.
function fAt(S, x, y) {
  const dx = x - S.mx, dy = y - S.my, u = (S.t - S.tf0 - sqrt(dx * dx + dy * dy) / VF) / REV;
  if (u <= 0) {
    S.fl = -S.fT;
    S.tk = 0;
  } else if (u >= 1) {
    S.fl = S.fT;
    S.tk = 0;
  } else {
    S.fl = -S.fT * cos(PI * u);
    S.tk = KICK * sin(PI * u) * sin(PI * u);
  }
}

// A cell is born on one of the lanes of its side, and not in the middle of the
// panel: a point is picked on a lane inside the panel and the lane is walked
// back, against the way this cell swims, until it is off the panel, so the
// flows come in from outside as they would down a real line of force.
function place(S, i, fresh) {
  const sd = S.r[i] < S.ratio ? 1 : -1;
  S.s[i] = sd;
  const ph = sd > 0 ? 0 : LANE;
  let x = 32, y = 64;
  for (let k = 0; k < 30; k++) {
    x = rnd() * W;
    y = rnd() * H;
    field(S, x, y);
    const q = S.psi / DPSI + ph + S.bp, d = q - round(q), bm = sqrt(S.bx * S.bx + S.by * S.by);
    if (bm < BHI && (S.free[i] || rnd() < (FLOORW + (1 - FLOORW) * exp(-(d * d * DPSI * DPSI) / (2 * SW * SW * bm * bm))) * (0.15 + vis(S, sd, bm)))) break;
  }
  fAt(S, x, y);
  const way = sd * (S.fl < 0 ? -1 : 1);
  if (!fresh) {
    // two-step midpoint walk back along the line, 2 LEDs a step
    for (let k = 0; k < 160; k++) {
      field(S, x, y);
      let m = sqrt(S.bx * S.bx + S.by * S.by) + 1e-9;
      field(S, x - way * (S.bx / m) * 1, y - way * (S.by / m) * 1);
      m = sqrt(S.bx * S.bx + S.by * S.by) + 1e-9;
      x -= way * (S.bx / m) * 2;
      y -= way * (S.by / m) * 2;
      if (x < -MG || x > W + MG || y < -MG || y > H + MG) break;
    }
  }
  field(S, x, y);
  S.x[i] = x;
  S.y[i] = y;
  S.th[i] = atan2(S.by, S.bx) + (way > 0 ? 0 : PI) + 0.1 * gauss();
  S.life[i] = 40 + 30 * rnd();
  S.age[i] = fresh ? rnd() * 30 : 0;
}

function sim(S, d) {
  S.t += d;
  // knobs, followed over a short time so a turn does not jolt
  const e = 1 - exp(-d / 0.6);
  const u = (cl(S.k[2], -1, 1) + 1) / 2;
  S.amp += (0.2 * pow(5, u) - S.amp) * e;
  S.spd += (SPD * cl(S.k[1], 0.5, 3) - S.spd) * e;
  S.mean = 60 * pow(0.2, u);
  const ratio = 0.5 + 0.38 * cl(S.k[3], -1, 1);
  if (abs(ratio - S.ratio) > 1e-4) {
    S.ratio = ratio;
    // the cells that have to change sides fade out first
    for (let i = 0; i < N; i++) {
      const want = S.r[i] < ratio ? 1 : -1;
      if (want !== S.s[i] && S.life[i] - S.age[i] > 0.6) S.age[i] = S.life[i] - 0.5 - 0.6 * rnd();
    }
  }
  // the field reverses: its strength goes through nothing and comes back the
  // other way, first at the magnet and then outward at VF LEDs a second
  if (S.t >= S.tFlip) {
    S.fT = -S.fT;
    S.tf0 = S.t;
    S.hand = rnd() < 0.5 ? 1 : -1;
    S.tFlip = S.t + S.mean * (0.55 + 0.9 * rnd());
  }
  poles(S);
  const v0 = S.spd, sq = sqrt(d);
  let mis = 0;
  for (let i = 0; i < N; i++) {
    S.age[i] += d;
    let x = S.x[i], y = S.y[i];
    if (S.age[i] > S.life[i] || x < -MG - 3 || x > W + MG + 3 || y < -MG - 3 || y > H + MG + 3) {
      place(S, i, false);
      continue;
    }
    field(S, x, y);
    const bm = sqrt(S.bx * S.bx + S.by * S.by), nx = -S.by / bm, ny = S.bx / bm, psi0 = S.psi;
    S.g[i] = (1 - sm(0.052, BHI, bm)) * vis(S, S.s[i], bm);
    // Cells settle, over a second or two, toward the middle of their lane, so
    // the lanes stay lines when the magnet slowly turns under them.
    const q = psi0 / DPSI + (S.s[i] > 0 ? 0 : LANE) + S.bp;
    field(S, x + nx * 0.5, y + ny * 0.5);
    const sl = S.psi > psi0 ? 1 : -1, slide = cl(-HOLD * (S.free[i] ? 0.12 : 1) * (q - round(q)) * (DPSI / bm), -2.5, 2.5) * d;
    x += nx * sl * slide;
    y += ny * sl * slide;
    const om = OM * cl(bm / 0.02, 0.55, 1.7);
    const v = v0 * S.v[i] * cl(pow(bm / 0.03, 0.55), 0.6, 1.7);
    // The torque turns the cell toward the field where it will be in a moment,
    // a speed over a turning rate ahead of it, or a cell on a curved line would
    // lag the line and slide off it to the outside.
    let th = S.th[i];
    const la = v / om;
    field(S, x + cos(th) * la, y + sin(th) * la);
    const tgt = atan2(S.by, S.bx) + (S.s[i] > 0 ? 0 : PI);
    // The field here, and the tumble a cell takes while it is nearly nothing,
    // which is what decides which way each one turns when it comes back.
    fAt(S, x, y);
    const sg = SIG * (1 + 1.5 * (1 - abs(S.fl)) * (1 - abs(S.fl)));
    th += om * S.fl * sin(tgt - th) * d + sg * sq * gauss() + S.tk * S.hnd[i] * S.hand * S.s[i] * d;
    mis += 1 - cos(th - tgt - (S.fl < 0 ? PI : 0));
    S.th[i] = th;
    S.x[i] = x + cos(th) * v * d;
    S.y[i] = y + sin(th) * v * d;
  }
  S.mis += (mis / N - S.mis) * (1 - exp(-d / 0.4));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = (input && input.knobValues) || S.k;
  S.k = [kn[0], kn[1], kn[2], kn[3]];
  if (!S.ready) {
    S.ready = true;
    S.ratio = 0.5 + 0.38 * cl(S.k[3], -1, 1);
    const u = (cl(S.k[2], -1, 1) + 1) / 2;
    S.amp = 0.2 * pow(5, u);
    S.spd = SPD * cl(S.k[1], 0.5, 3);
    S.mean = 60 * pow(0.2, u);
    S.t = -PRE;
    S.to = 0;
    poles(S);
    for (let i = 0; i < N; i++) place(S, i, true);
    for (let k = 0; k < PRE * 30; k++) {
      sim(S, 1 / 30);
      if (k > PRE * 30 - 40) leave(S, 1 / 30);
    }
    S.tFlip = S.t + 7 + 5 * rnd();
    return;
  }
  const d = cl(dt || 0, 0, 0.1);
  sim(S, d);
  leave(S, d);
}

// ---- the picture ----------------------------------------------------------
// A cell's body: a capsule LEN long behind its head, about 2 LEDs wide, either
// added into buf or, for the tail it leaves behind, kept if brighter.
function body(buf, cx, cy, c, sn, amp, keep) {
  const tx = cx - c * LEN, ty = cy - sn * LEN;
  const x0 = max(0, floor(min(cx, tx) - 2)), x1 = min(W - 1, floor(max(cx, tx) + 2));
  const y0 = max(0, floor(min(cy, ty) - 2)), y1 = min(H - 1, floor(max(cy, ty) + 2));
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - tx, dy = py + 0.5 - ty;
      let t = (dx * c + dy * sn) / LEN;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = dx - t * LEN * c, ey = dy - t * LEN * sn;
      const w = 1 - sm(0.35, 1.5, sqrt(ex * ex + ey * ey));
      if (w <= 0) continue;
      const v = amp * w * (keep ? 1 : 0.75 + 0.25 * t), p = py * W + px;
      if (keep) {
        if (v > buf[p]) buf[p] = v;
      } else buf[p] += v;
    }
  }
}
// How much light a cell gives: its own brightness, a flicker as it rolls, and
// the fade when it is born, dies or leaves the lanes' drawn part.
const light = (S, i) => min(1, S.age[i] / 0.5, (S.life[i] - S.age[i]) / 0.5) * S.g[i] * S.bri[i] * (1 + FLK * sin(TAU * S.fw[i] * S.t + S.ph[i]));

// What the cells leave behind: each frame the tails fade, and every cell puts
// its body down at TAMP, so the tail is a short dim copy of the path.
function leave(S, d) {
  const k = exp(-d / (TAIL * (1 + 0.9 * min(1, S.mis * 1.6)))), { tT, tA, x, y, th, s } = S;
  for (let p = 0; p < W * H; p++) {
    tT[p] = tT[p] * k < 0.02 ? 0 : tT[p] * k;
    tA[p] = tA[p] * k < 0.02 ? 0 : tA[p] * k;
  }
  for (let i = 0; i < N; i++) {
    const al = light(S, i);
    if (al > 0.02) {
      const c = cos(th[i]), sn = sin(th[i]), w = WOB * sin(TAU * S.fw[i] * 1.3 * S.t + 2 * S.ph[i]);
      body(s[i] > 0 ? tT : tA, x[i] - sn * w, y[i] + c * w, c, sn, TAMP * al, true);
    }
  }
}

// The colour of a cell for each level of light, one table a side. A dim colour
// on the red to yellow stretch of the wheel reads brown on the panel, so there
// it is lifted and paled.
function build(S, hue) {
  const c = [0, 0, 0];
  for (let side = 0; side < 2; side++) {
    const h = (side === 0 ? 0.485 : 0.1) + hue, lut = S.lut[side];
    for (let i = 0; i < 64; i++) {
      const l = i / 63, hh = h + (side === 0 ? -0.03 : 0.012) * (1 - l), cw = hh - floor(hh);
      const b = cw > 0.9 ? sm(0.9, 0.97, cw) : 1 - sm(0.12, 0.2, cw);
      const v = pow(l, 0.9);
      hsv(hh, (0.45 + 0.4 * (1 - l)) * (1 - 0.2 * b * (1 - l)), min(1, v * (1 + 0.9 * b * (1 - v))), c);
      lut[i * 3] = c[0] * 255;
      lut[i * 3 + 1] = c[1] * 255;
      lut[i * 3 + 2] = c[2] * 255;
    }
  }
}

export function draw(display, params) {
  if (!params.s) setup(params);
  const S = params.s;
  if (!S.ready) update(0, { knobValues: S.k }, params);
  if (S.hueSet !== S.k[0]) {
    S.hueSet = S.k[0];
    build(S, S.k[0]);
  }
  const { hT, hA, tT, tA, x, y, th, s } = S;
  hT.fill(0);
  hA.fill(0);
  for (let i = 0; i < N; i++) {
    const al = light(S, i);
    if (al > 0.02) {
      const c = cos(th[i]), sn = sin(th[i]), w = WOB * sin(TAU * S.fw[i] * 1.3 * S.t + 2 * S.ph[i]);
      body(s[i] > 0 ? hT : hA, x[i] - sn * w, y[i] + c * w, c, sn, al, false);
    }
  }
  const L0 = S.lut[0], L1 = S.lut[1];
  for (let p = 0; p < W * H; p++) {
    const lt = max(tT[p], 1 - exp(-1.5 * hT[p])), la = max(tA[p], 1 - exp(-1.5 * hA[p]));
    const it = floor(lt * 63 + 0.5) * 3, ia = floor(la * 63 + 0.5) * 3;
    // where the two meet the sum is pulled toward white, or teal and amber would make a lime
    const wh = min(lt, la) * 150;
    display.setPixel(p % W, (p / W) | 0, min(255, L0[it] + L1[ia] + wh + 2), min(255, L0[it + 1] + L1[ia + 1] + wh + 4), min(255, L0[it + 2] + L1[ia + 2] + wh + 10));
  }
}
