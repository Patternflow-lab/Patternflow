// ===== Patternflow pattern =====
// Title:   Lap Pool
// Family:  sport
// Idea:    An outdoor 25 m pool seen straight down from above with its lanes running the height of the panel: swimmers in coloured caps swim lengths at their own paces, kick up white water, spread V wakes that rock the red, white and blue lane ropes, and flip-turn at the walls over a tiled floor netted with moving sun caustics.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after overhead drone photographs of outdoor lap pools
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Stroke=0..3, Speed=0.2..3, Swimmers=4..15, Sun=-1..1
//
// Knob 1: Stroke. What everyone swims: freestyle at 0, backstroke at 1 (faces up, straight arms over), breaststroke at 2 (a frog kick and a long glide), butterfly at 3 (both arms swing out across the lane and land in a burst of spray).
// Knob 2: Speed. How fast the swimmers and the water go: at 2 a freestyle length takes 11 to 15 s; at 0.2 it is a slow swim and the caustics barely drift.
// Knob 3: Swimmers. Four swimmers in four of the five lanes at 4; past five they share lanes and circle up one side and down the other, three to a lane at 15.
// Knob 4: Sun. Near noon at 0.06: a bright caustic net and short shadows. Towards -1 the low morning sun from the east, towards 1 the evening sun from the west: gold light, a faint stretched net and long shadows thrown across the lanes.

const { min, max, floor, round, sin, cos, abs, sqrt, exp, pow, asin, tan, hypot, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (x) => ((x = cl(x, 0, 1)), x * x * (3 - 2 * x));
const fr = (x) => x - floor(x);
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const [W, H] = [64, 128];
const N = W * H;
// Pixel centres sit on whole numbers. Water fills rows 8..119 (112 rows for
// 25 m) and columns 2..61: five lanes of 12 with rope centres between them.
const [Y0, Y1] = [8, 119];
const LANE = (k) => 7.5 + 12 * k;
const ROPE = (k) => 13.5 + 12 * k;
// Backstroke flags 5 m from each wall.
const FLAGS = [Y0 + 22, Y1 - 22];
// Body centre, rows behind the crown, and how much larger than life the swimmers are drawn.
const VC = 4.5;
const SZ = 1.15;
const HV = VC * SZ;
const [SWIM, TURN, GLIDE, REST] = [0, 1, 2, 3];
// Per stroke: pace (rows/s at Speed 2), arm cycles a second, wake height, kick foam a second.
const STROKE = [
  [9.2, 1.15, 0.55, 22],
  [8.2, 1.0, 0.5, 26],
  [6.6, 0.95, 0.8, 0],
  [8.6, 1.05, 1.0, 0],
];
const CAPS = [[252, 212, 20], [232, 36, 48], [242, 242, 236], [34, 34, 40], [36, 204, 92], [255, 122, 18], [255, 84, 170], [28, 104, 238], [182, 188, 198], [150, 64, 226]];
const SKIN = [[238, 192, 160], [214, 160, 118], [176, 116, 78], [122, 78, 52], [248, 206, 178]];
const SUIT = [[22, 26, 70], [18, 18, 22], [184, 22, 44], [0, 112, 132], [96, 32, 124], [34, 64, 168]];
// Lanes fill middle first, so four swimmers leave lane 4 free.
const ORDER = [2, 0, 4, 1, 3];
// Light through 2 m of water, and the blue it scatters back.
const TW = [0.36, 0.72, 0.82];
const SC = [2, 18, 30];

function build(P) {
  const { alb, mat, blk } = P;
  const set = (x, y, m, r, g, b) => {
    const p = y * W + x;
    mat[p] = m;
    alb.set([r, g, b], p * 3);
  };
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, g = hash(x, y) - 0.5;
    if (y >= Y0 && y <= Y1 && x >= 2 && x <= 61) {
      // White tiles on a 4 LED grid, a dark line down each lane ending in a T 2 m from the wall.
      const t = (1 + (hash(x >> 2, (y - Y0) >> 2) - 0.5) * 0.07 + g * 0.04) * ((x - 2) % 4 && (y - Y0) % 4 ? 1 : 0.88);
      const dc = abs(x - LANE(floor((x - 1.5) / 12))), e = min(y - Y0, Y1 - y);
      if ((dc < 1 && e >= 9) || (dc < 3 && (e === 9 || e === 10))) set(x, y, 3, 0.1 * t, 0.14 * t, 0.38 * t);
      else set(x, y, 3, 0.84 * t, 0.92 * t, 0.95 * t);
    } else if ((y === Y0 - 1 || y === Y1 + 1) && x >= 2 && x <= 61) set(x, y, 2, 0.12, 0.28 + g * 0.04, 0.58);
    else if (((y === 5 || y === 6 || y === 121 || y === 122) && x >= 1 && x <= 62) || ((x === 1 || x === 62) && y > 6 && y < 121)) {
      // The overflow gutter's grate: white bars over dark water.
      const bar = (y < 7 || y > 120 ? x : y) % 2 === 0;
      set(x, y, 1, bar ? 0.86 : 0.04, bar ? 0.88 : 0.17, bar ? 0.89 : 0.23);
    } else {
      // Stone paving, darker where the splashes land.
      const side = x === 0 || x === 63, j = side ? y % 8 === 0 : x % 8 === 0 || y === 0 || y === 127;
      const k = (0.92 + 0.16 * hash(side ? x : x >> 3, side ? y >> 3 : y > 64 ? 9 : 3) + g * 0.07) * (j ? 0.84 : 1) * (y === 4 || y === 123 || side ? 0.88 - 0.1 * hash(x, y + 7) : 1);
      set(x, y, 0, 0.8 * k, 0.75 * k, 0.66 * k);
    }
  }
  // Starting blocks at the top end: kick plate, blue grip, white front edge.
  for (let k = 0; k < 5; k++)
    for (let y = 1; y <= 5; y++)
      for (let x = round(LANE(k) - 2.5); x <= round(LANE(k) + 2.5); x++) {
        const edge = x === round(LANE(k) - 2.5) || x === round(LANE(k) + 2.5);
        blk[y * W + x] = 1;
        if (y === 1) set(x, y, 0, 0.5, 0.53, 0.57);
        else if (y === 5 || edge) set(x, y, 0, 0.9, 0.91, 0.92);
        else set(x, y, 0, 0.12, 0.28, 0.72);
      }
  // Kickboards, bottles at the lane ends, a towel and flip-flops on the far deck.
  const box = (x0, y0, w, h, c, round_) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) if (!round_ || ((x > x0 && x < x0 + w - 1) || (y > y0 && y < y0 + h - 1))) (blk[y * W + x] = 1), set(x, y, 0, ...c);
  };
  box(3, 123, 5, 4, [0.96, 0.76, 0.12], 1);
  box(5, 122 + 2, 5, 4, [0.16, 0.42, 0.92], 1);
  for (const [k, c] of [[0, [0.3, 0.62, 0.95]], [2, [0.92, 0.2, 0.22]], [3, [0.3, 0.82, 0.42]]]) box(round(LANE(k)) + 3, 124, 2, 2, c), set(round(LANE(k)) + 3, 124, 0, 0.95, 0.95, 0.95);
  for (let y = 123; y < 127; y++) box(50, y, 7, 1, y & 1 ? [0.95, 0.94, 0.88] : [0.1, 0.62, 0.62]);
  for (const x of [41, 43]) box(x, 124, 1, 3, [0.96, 0.4, 0.62]);
}

// Sun height and bearing: shadows, light colour, the stretch of the caustic net.
function paint(P, s) {
  const q = pow(abs(s), 1.3), a = ((25 + 100 * s) * PI) / 180, e = ((60 - 44 * abs(s)) * PI) / 180, za = PI / 2 - e;
  const L = 9 * tan(asin(sin(za) / 1.33)), ux = sin(a), uy = -cos(a);
  Object.assign(P, { sx: ux * L, sy: uy * L, fx: ux * (L + 8 * tan(za)), fy: uy * (L + 8 * tan(za)), str: 0.95 * pow(sin(e), 2.2) + 0.12 });
  const I = 1 - 0.18 * q, warm = s < 0 ? [1, 0.86, 0.66] : [1, 0.76, 0.56];
  P.lc = [1, 0.98, 0.93].map((v, c) => mix(v, warm[c], q) * I);
  P.amb = [0.1, 0.15, 0.2].map((v) => v * (1 - 0.2 * q));
  P.glint = pow(1 - abs(s), 2);
  // The caustic net, squeezed along the sun's bearing when it is low.
  const st = 1 + 1.4 * (1 - sin(e)), { wv, CS, CC } = P;
  wv.forEach(([an, l], i) => {
    let kx = (cos(an) * 2 * PI) / l, ky = (sin(an) * 2 * PI) / l;
    const kd = (kx * ux + ky * uy) * (1 - 1 / st);
    kx -= kd * ux;
    P.ky[i] = ky - kd * uy;
    for (let x = 0; x < W; x++) (CS[i * W + x] = 0.21 * sin(kx * x)), (CC[i * W + x] = 0.21 * cos(kx * x));
  });
  // Deck light with the blocks' shadows; on the floor, the walls', ropes' and flags' shadows.
  const { alb, mat, blk, bg, SB, lc, amb } = P, bx = ux * 3.4 * tan(za) * 0.6, by = uy * 3.4 * tan(za) * 0.6;
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6;
    if (mat[p] === 3) {
      const wx = x - P.sx, wy = y - P.sy;
      let sh = 1 - sm(min(wx - 1.5, 61.5 - wx, wy - Y0 + 0.5, Y1 + 0.5 - wy) + 0.5);
      for (let k = 0; k < 4; k++) sh += 0.6 * cl(1.3 - abs(wx - ROPE(k)), 0, 1) * (0.75 + 0.25 * cos(wy * PI));
      for (const f of FLAGS) sh += 0.35 * cl(1 - abs(y - P.fy - f), 0, 1) * (floor(x - P.fx) % 3 ? 1 : 0.4);
      SB[p] = min(1, sh);
    } else {
      const sx = round(x - bx), sy = round(y - by), shade = !blk[p] && sx >= 0 && sx < W && sy >= 0 && sy < H && blk[sy * W + sx] ? 0.5 : 1;
      for (let c = 0; c < 3; c++) bg[p * 3 + c] = alb[p * 3 + c] * (amb[c] * 0.7 + lc[c] * 0.74 * shade) * 255;
    }
  }
}

let nc = 0;
const CP = new Float32Array(20 * 8);
// A capsule in body coordinates: u across (+ is the swimmer's right), v back from the crown.
function cap(u0, v0, u1, v1, r, c, sub) {
  CP.set([u0, v0, u1, v1, r, c, sub], nc++ * 8);
}
// An arm from the shoulder to the hand, the elbow bent out to its side.
function arm(sg, hu, hv, bend, sub, hr = 0.5) {
  const su = sg * 1.8, sv = 2.5, dx = hu - su, dv = hv - sv, l = hypot(dx, dv) || 1;
  let pu = dv / l, pv = -dx / l;
  if (pu * sg < 0) (pu = -pu), (pv = -pv);
  const eu = (su + hu) / 2 + bend * pu, ev = (sv + hv) / 2 + bend * pv;
  cap(su, sv, eu, ev, 0.55, 1, sub);
  cap(eu, ev, hu, hv, hr, 1, sub);
}

// Hand positions [u, v, elbow bend, submerged, hand radius] for each stroke at arm phase th.
function hand(s, sg, ph) {
  const th = fr(ph + (sg > 0 || s > 1 ? 0 : 0.5));
  if (s === 0) {
    if (th < 0.5) return [sg * (0.5 + 0.7 * sin(th * 2 * PI)), -2.4 + 8.2 * sm(th * 2), 0.5, 0.5];
    const p = th * 2 - 1;
    return [sg * (1.6 + 2.3 * sin(p * PI)), 5.8 - 8.2 * sm(p), 1.3, 0];
  }
  if (s === 1) {
    if (th < 0.5) return [sg * 2.1, 2.5 + 4.8 * cos(th * 2 * PI), 0, 0, 0.5 + 0.4 * sin(th * 2 * PI)];
    const p = th * 2 - 1;
    return [sg * (1.3 + 2.6 * sin(p * PI)), -2.3 + 8.8 * sm(p), 1.2, 0.5];
  }
  if (s === 2) {
    if (th < 0.22) return [sg * (0.4 + 2.8 * sm(th / 0.22)), -3.4 + 1.6 * (th / 0.22), 0.9, 0.4];
    if (th < 0.38) return [sg * mix(3.2, 0.7, sm((th - 0.22) / 0.16)), mix(-1.8, 1.4, (th - 0.22) / 0.16), 1, 0.32];
    if (th < 0.52) return [sg * mix(0.7, 0.4, (th - 0.38) / 0.14), mix(1.4, -3.4, sm((th - 0.38) / 0.14)), 0.6, 0.4];
    return [sg * 0.4, -3.4, 0.3, 0.45];
  }
  if (th < 0.5) return [sg * (1.6 - 0.9 * sin(th * 2 * PI)), mix(-2.6, 6, sm(th * 2)), 0.6, 0.5];
  if (th < 0.8) {
    const p = (th - 0.5) / 0.3;
    return [sg * (1.8 + 3.8 * sin(p * PI)), mix(6, -2.6, sm(p)), 0.4, 0];
  }
  return [sg * 1.6, -2.6, 0.4, 0.32];
}

// The swimmer's capsules for this frame; returns how far the body is squeezed.
function pose(S, s) {
  nc = 0;
  const ph = S.ph, z = S.z, back = s === 1 && S.st !== GLIDE;
  let sc = 1, headUp = 0, hands = null, feet = null;
  if (S.st === SWIM) {
    hands = [hand(s, 1, ph), hand(s, -1, ph)];
    if (s === 2) headUp = sm(1 - abs(ph - 0.36) / 0.16);
    if (s === 3) headUp = sm(1 - abs(ph - 0.47) / 0.14);
  } else if (S.st === GLIDE || S.st === REST) {
    hands = S.st === REST ? [[1.6, -2.9, 0.3, 0], [-1.6, -2.9, 0.3, 0]] : [[0.3, -4.1, 0.2, z], [-0.3, -4.1, 0.2, z]];
    headUp = S.st === REST ? 1 : 0;
  } else {
    const t = S.t / S.tt;
    sc = t < 0.5 ? 1 - 0.55 * sm(t / 0.35) : 0.45 + 0.55 * sm((t - 0.5) / 0.5);
    hands = t >= 0.5 ? [[0.3, -3.6, 0.2, 0.7], [-0.3, -3.6, 0.2, 0.7]] : S.open ? [[1, -3.4, 0.4, 0], [-1, -3.4, 0.4, 0]] : [[1.6, 6, 0.3, 0.5], [-1.6, 6, 0.3, 0.5]];
    headUp = S.open && t < 0.6 ? 1 : 0;
    // The legs come over the top in a flip.
    if (!S.open && t > 0.25 && t < 0.62) feet = 9.6 * cos((PI * (t - 0.25)) / 0.37);
  }
  const deep = S.st === TURN ? 0.4 : S.st === REST ? 0.7 : z;
  const under = (h) => h[3] > 0.3;
  for (let i = 0; i < 2; i++) if (under(hands[i])) arm(i ? -1 : 1, hands[i][0], hands[i][1], hands[i][2], max(hands[i][3], deep), hands[i][4]);
  // Legs: flutter, frog kick or dolphin.
  const kick = S.kp, lsub = max(0.42, deep);
  for (const sg of [1, -1]) {
    let fu = sg * 0.5, fv = 9.4 + (s < 2 ? 0.3 * sin(kick + (sg > 0 ? 0 : PI)) : 0), ku = sg * 0.6, kv = 7.9;
    if (S.st === SWIM && s === 2) {
      const t = ph;
      if (t >= 0.38 && t < 0.52) {
        const p = (t - 0.38) / 0.14;
        [ku, kv, fu, fv] = [sg * mix(0.6, 2.2, p), mix(7.9, 7.3, p), sg * mix(0.5, 1.7, p), mix(9.4, 7.2, p)];
      } else if (t >= 0.52 && t < 0.66) {
        const p = (t - 0.52) / 0.14;
        [ku, kv, fu, fv] = [sg * mix(2.2, 0.6, p), mix(7.3, 7.9, p), sg * (mix(1.7, 0.5, p) + 2.2 * sin(p * PI)), mix(7.2, 9.5, sm(p))];
      }
    }
    if (S.st === SWIM && s === 3) fv = 9.4 + 0.5 * sin(ph * 4 * PI);
    if (S.st === GLIDE) fv = 9.5 + 0.4 * sin(S.t * 16);
    if (feet !== null) [ku, kv, fu, fv] = [sg * 0.6, VC + feet * 0.45, sg * 0.5, VC + feet];
    if (S.st === REST) [ku, kv, fu, fv] = [sg * 0.7, 5.6, sg * 0.9, 6.6];
    cap(sg * 0.6, 6.3, ku, kv, 0.62, 1, lsub);
    cap(ku, kv, fu, fv, 0.5, 1, feet !== null ? 0.6 * abs(feet / 9.6) : lsub);
  }
  // Hips, back, shoulders (the one over a recovering arm rides higher), head.
  const bs = s === 3 && S.st === SWIM ? 0.3 + 0.25 * sin(ph * 4 * PI) : 0.35;
  cap(0, 5.2, 0, 6.3, 1.15, 2, max(bs, deep));
  cap(0, 2.8, 0, 5, 1.35, S.sb ? 2 : 1, max(0.25 - 0.2 * headUp, deep));
  for (let i = 0; i < 2; i++) cap(0, 2.4, i ? -1.8 : 1.8, 2.5, 0.75, 1, max(under(hands[i]) ? 0.3 : 0.05, deep) * (1 - 0.6 * headUp));
  const hs = (S.st === TURN && !S.open ? 0.6 * sm(S.t / S.tt / 0.3) : 0.05 * (1 - headUp)) + deep * 0.6;
  if (back) {
    cap(0, 0.55, 0, 0.9, 0.95, 0, hs);
    cap(0, 1.45, 0, 1.45, 0.75, 1, hs);
    cap(0.45, 1.2, 0.45, 1.2, 0.28, 3, hs);
    cap(-0.45, 1.2, -0.45, 1.2, 0.28, 3, hs);
  } else cap(0, 0.7, 0, 1.3, 0.95 + 0.15 * headUp, 0, hs);
  // A breath to the side every one and a half cycles of freestyle.
  if (s === 0 && S.st === SWIM && fr(ph * (2 / 3)) > 0.72 && fr(ph * (2 / 3)) < 0.92) cap(S.bside * 0.95, 1.4, S.bside * 0.95, 1.4, 0.48, 1, 0);
  for (let i = 0; i < 2; i++) if (!under(hands[i])) arm(i ? -1 : 1, hands[i][0], hands[i][1], hands[i][2], max(hands[i][3], deep * 0.6), hands[i][4]);
  return sc;
}

// Screen position of a body point.
const sxy = (S, sc, u, v) => [S.x - S.d * u * SZ * (1 + 0.3 * (1 - sc)), S.y - S.d * (v - VC) * sc * SZ];

function foam(P, x, y, n, spread, life = 0.7, size = 1, kind = 0, vel = 0) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * 2 * PI, r = spread * sqrt(rnd());
    const l = life * (0.6 + 0.6 * rnd());
    P.fo.push([x + cos(a) * r, y + sin(a) * r, cos(a) * vel * rnd(), sin(a) * vel * rnd(), l, l, size * (0.7 + 0.6 * rnd()), kind]);
  }
}
const ring = (P, S, x, y, amp) => P.ri.push([x, y, 0, amp, S.k, rnd() * 7]);
const fade = (R) => R[3] * max(0, 1 - R[2] / 7) ** 1.3;

function newSwimmer(P, i, fresh) {
  const k = ORDER[i % 5], d = rnd() < 0.5 ? 1 : -1, wall = d > 0 ? Y0 - 0.5 : Y1 + 0.5;
  const S = { k, d, x: LANE(k) + (rnd() - 0.5), o: (rnd() - 0.5) * 1.2, f: 0.8 + rnd() * 0.36, ph: rnd(), kp: rnd() * 7, st: SWIM, t: 0, z: 0, n: 0, v: 0, tt: 0.9, open: false, flip: false, ring: rnd() * 0.12, bside: 1 };
  Object.assign(S, { cap: CAPS[P.caps[i % 10]], skin: SKIN[floor(rnd() * 5)], suit: SUIT[floor(rnd() * 6)], sb: rnd() < 0.5 });
  if (fresh) S.y = Y0 + 16 + fr(0.29 * floor(i / 5) + rnd() * 0.85) * (Y1 - Y0 - 32);
  else Object.assign(S, { y: wall + d * 5.6 * SZ, st: GLIDE, z: 0.85 });
  return S;
}

function stepSwimmer(P, S, d, s) {
  const [pace0, hz, wamp, kf] = STROKE[s], pace = pace0 * S.f, wall = S.d > 0 ? Y1 + 0.5 : Y0 - 0.5;
  S.t += d;
  S.x += cl(LANE(S.k) + (P.cnt[S.k] > 1 ? -S.d * 2.4 : S.o) - S.x, -4 * d, 4 * d);
  S.kp += d * (s < 2 ? 17 : 6);
  const head = () => sxy(S, 1, 0, 0.6), feet = () => sxy(S, 1, 0, 9.8);
  let v = 0;
  if (S.st === SWIM) {
    const p0 = S.ph;
    S.ph += hz * (0.55 + 0.45 * S.f) * d;
    const ph = S.ph;
    v = pace * (s === 2 ? 0.6 + 1.82 * exp(-4.5 * fr(ph - 0.6)) : s === 3 ? 0.7 + exp(-3 * fr(2 * ph - 0.1)) : 1 + 0.06 * sin(ph * 4 * PI));
    // Keep behind a slower swimmer going the same way.
    for (const O of P.sw) if (O !== S && O.k === S.k && O.d === S.d && O.st === SWIM && (O.y - S.y) * S.d > 0 && (O.y - S.y) * S.d < 13) v = min(v, O.v);
    // Splashes where the hands go in, and the kick.
    const crossed = (at) => floor(p0 - at) !== floor(ph - at);
    for (const sg of [1, -1]) {
      const entry = [sg > 0 ? 0 : 0.5, sg > 0 ? 0.5 : 0, -1, 0.8][s];
      if (entry >= 0 && crossed(entry)) {
        const h = hand(s, sg, entry + 0.001), [x, y] = sxy(S, 1, h[0], h[1]);
        foam(P, x, y, s === 3 ? 6 : 3, s === 3 ? 1.6 : 0.8, 0.6, s === 3 ? 0.85 : 0.75, 0, s === 3 ? 5 : 2);
        if (s === 3) foam(P, x, y, 4, 0.5, 0.35, 0.8, 1, 9);
      }
    }
    if (s === 0 && crossed(0.5) && rnd() < 0.67) S.bside = -S.bside;
    if (kf && rnd() < kf * d * 1.5) {
      const [x, y] = feet();
      foam(P, x + (rnd() - 0.5) * 2.2, y + S.d * rnd() * 1.5, 1, 0.4, 0.5, 0.75, 3);
    }
    if ((s === 2 && crossed(0.6)) || (s === 3 && (crossed(0.08) || crossed(0.58)))) {
      const [x, y] = feet();
      foam(P, x, y - S.d, 5, 2, 0.7, 0.85, 0, 3);
    }
    if ((S.ring -= d) <= 0) {
      const [x, y] = head();
      // Each stroke sends out a pulse, so the arms of the V come in dashes.
      ring(P, S, x, y, wamp * (0.35 + 1.3 * (s < 2 ? cos(2 * PI * ph) ** 2 : sm(1 - abs(fr(ph) - (s === 2 ? 0.45 : 0.78)) / 0.22))));
      S.ring = 0.16;
    }
    const dist = (wall - S.y) * S.d - HV;
    if (dist < (s > 1 ? 1.2 : 2.3)) {
      if (S.n > 1 && P.t > 10 && rnd() < 0.15) Object.assign(S, { st: REST, t: 0, rest: 2.5 + rnd() * 2.5, y: wall - S.d * (HV + 1) });
      else Object.assign(S, { st: TURN, t: 0, y0: S.y, w: wall, yb: wall - S.d * 3 * SZ, open: s > 1, tt: s > 1 ? 1.15 : 0.9, flip: false });
    } else S.y += S.d * v * d;
  } else if (S.st === TURN) {
    const t = S.t / S.tt;
    if (t >= 0.5 && !S.flip) {
      S.flip = true;
      S.d = -S.d;
      const [x, y] = sxy(S, 0.45, 0, VC + 3);
      foam(P, x, y, S.open ? 5 : 9, 2.4, 0.9, 0.95, 0, 4);
      if (!S.open) foam(P, x, y, 5, 1, 0.35, 0.8, 1, 8);
      ring(P, S, x, y, 1.1);
    }
    S.y = t < 0.5 ? mix(S.y0, S.yb, sm(t * 2)) : mix(S.yb, S.w + S.d * 5.6 * SZ, sm((t - 0.5) * 2));
    if (t >= 1) Object.assign(S, { st: GLIDE, t: 0, z: 0.85, n: S.n + 1 });
  } else if (S.st === GLIDE) {
    const t = S.t / 1.05;
    v = pace * (1.75 - 0.85 * t);
    S.z = 0.85 - 0.75 * sm(t);
    S.y += S.d * v * d;
    if (rnd() < d * 14) {
      const [x, y] = sxy(S, 1, (rnd() - 0.5) * 2, 3 + rnd() * 6);
      foam(P, x, y, 1, 0.3, 0.5, 0.6, 2);
    }
    if ((S.ring -= d) <= 0) {
      const [x, y] = head();
      ring(P, S, x, y, 0.45 * (1 - S.z));
      S.ring = 0.18;
    }
    if (t >= 1) {
      const [x, y] = head();
      foam(P, x, y, s === 3 ? 7 : 5, 1.8, 0.7, 0.85, 0, 3);
      ring(P, S, x, y, 0.9);
      Object.assign(S, { st: SWIM, t: 0, z: 0, ph: s === 2 ? 0.1 : 0 });
    }
  } else {
    S.y = wall - S.d * (HV + 1 + 0.25 * sin(S.t * 3));
    if (S.t > S.rest) Object.assign(S, { st: TURN, t: 0, y0: S.y, w: wall, yb: wall - S.d * 3 * SZ, open: true, tt: 1.15, flip: false });
  }
  S.v = v;
}

export function setup(params) {
  const P = params, F = (n) => new Float32Array(n);
  Object.assign(P, { alb: F(N * 3), mat: new Uint8Array(N), blk: new Uint8Array(N), bg: F(N * 3), buf: F(N * 3), SB: F(N), SS: F(N), FL: F(N), SF: F(N) });
  Object.assign(P, { CS: F(5 * W), CC: F(5 * W), RS: F(5 * H), RC: F(5 * H), ky: F(5), rock: F(4 * H), sun: 9, t: 0, T: 0, sw: [], fo: [], ri: [], cnt: [0, 0, 0, 0, 0] });
  P.wv = Array.from({ length: 5 }, (_, i) => {
    const l = 9 + rnd() * 6;
    return [(i * PI) / 5 + (rnd() - 0.5) * 0.4, l, ((1.6 + rnd() * 1.4) * 2 * PI) / l, rnd() * 7];
  });
  // Bright caps first.
  P.caps = [0, 1, 5, 4, 6, 7].sort(() => rnd() - 0.5).concat([2, 9, 8, 3]);
  build(P);
}

export function update(dt, input, params) {
  const P = params, k = input.knobValues || [0, 2, 4, 0.06];
  const s = cl(round(k[0]), 0, 3), sun = cl(k[3], -1, 1), n = round(cl(k[2], 4, 15)), d = cl(dt, 0, 0.1) * (cl(k[1], 0.2, 3) / 2);
  if (abs(sun - P.sun) > 0.002) (P.sun = sun), paint(P, sun);
  P.s = s;
  const fresh = !P.t;
  while (P.sw.length < n) P.sw.push(newSwimmer(P, P.sw.length, fresh));
  P.sw.length = n;
  P.cnt.fill(0);
  for (const S of P.sw) P.cnt[S.k]++;
  P.t += d;
  P.T += d;
  for (const S of P.sw) stepSwimmer(P, S, d, s);
  // Wakes spread at 3 rows a second, slower than the swimmers, so their rings pile up
  // into a V; where one meets a rope, the floats rock.
  const { rock } = P;
  for (let i = 0; i < rock.length; i++) rock[i] *= exp(-1.8 * d);
  P.ri = P.ri.filter((R) => {
    R[2] += 3 * d;
    const f = fade(R);
    for (const j of [R[4] - 1, R[4]]) {
      const dx = abs(ROPE(j) - R[0]);
      if (j < 0 || j > 3 || R[2] < dx) continue;
      const dy = sqrt(R[2] * R[2] - dx * dx);
      for (const y of [round(R[1] - dy), round(R[1] + dy)]) if (y >= 0 && y < H) rock[j * H + y] = max(rock[j * H + y], f);
    }
    return R[2] < 7;
  });
  P.fo = P.fo.filter((f) => ((f[0] += f[2] * d), (f[1] += f[3] * d), (f[2] *= exp(-4 * d)), (f[3] *= exp(-4 * d)), (f[4] -= d) > 0));
}

let BUF;
function blend(p, r, g, b, a) {
  const o = p * 3;
  BUF[o] += (r - BUF[o]) * a;
  BUF[o + 1] += (g - BUF[o + 1]) * a;
  BUF[o + 2] += (b - BUF[o + 2]) * a;
}

// One capsule on screen: into the colour buffer, or as soft shadow into SS.
function stamp(P, x0, y0, x1, y1, r, col, sub, shadow) {
  const dx = x1 - x0, dy = y1 - y0, ll = dx * dx + dy * dy || 1e-6, e = shadow ? r + 1.4 : r + 0.6;
  const xa = max(2, floor(min(x0, x1) - e)), xb = min(61, Math.ceil(max(x0, x1) + e)), ya = max(0, floor(min(y0, y1) - e)), yb = min(H - 1, Math.ceil(max(y0, y1) + e));
  const { lc, amb, SS } = P, op = 1 - 0.3 * sub;
  const c = [0, 1, 2].map((i) => {
    const lit = col[i] * (lc[i] * 0.86 + amb[i] * 0.45);
    return mix(lit, lit * TW[i] * 1.15 + SC[i], sub);
  });
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x - x0, py = y - y0, t = cl((px * dx + py * dy) / ll, 0, 1), ex = px - t * dx, ey = py - t * dy, dd = sqrt(ex * ex + ey * ey), p = y * W + x;
      if (shadow) SS[p] = max(SS[p], cl((r + 1 - dd) / 1.8, 0, 1) * 0.85);
      else {
        const a = cl(r + 0.5 - dd, 0, 1) * op;
        if (a > 0.01) blend(p, c[0], c[1], c[2], a);
      }
    }
}

function swimmers(P, shadow) {
  for (const S of P.sw) {
    const sc = pose(S, P.s), cols = [S.cap, S.skin, S.suit, [20, 40, 90]], off = shadow ? 1 - 0.6 * S.z : 0;
    // White water pushed up round the head and shoulders.
    if (shadow && S.z < 0.5 && S.st !== REST)
      for (let i = 0; i <= 10; i++) {
        const a = ((i - 5) / 5) * 1.9, [x, y] = sxy(S, sc, sin(a) * 2.6, 1.6 - cos(a) * 2.4);
        splat(P.SF, x, y, (0.9 - 0.4 * abs(i - 5) / 5) * (1 - 2 * S.z) * (S.st === TURN ? 1.6 : 1));
      }
    for (let i = 0; i < nc; i++) {
      const o = i * 8, [x0, y0] = sxy(S, sc, CP[o], CP[o + 1]), [x1, y1] = sxy(S, sc, CP[o + 2], CP[o + 3]);
      stamp(P, x0 + P.sx * off, y0 + P.sy * off, x1 + P.sx * off, y1 + P.sy * off, CP[o + 4] * SZ, cols[CP[o + 5]], CP[o + 6], shadow);
    }
    // A glint on the cap, on the side the sun is.
    if (!shadow && S.z < 0.3) {
      const [hx, hy] = sxy(S, sc, 0, 1), x = round(hx - P.sx * 0.15), y = round(hy - P.sy * 0.15);
      if (x > 1 && x < 62 && y > 0 && y < H) blend(y * W + x, 255, 255, 250, 0.35 * (1 - S.z));
    }
  }
}

function splat(B, x, y, v) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
  if (xi < 2 || xi > 60 || yi < Y0 || yi >= Y1) return;
  const p = yi * W + xi;
  B[p] += v * (1 - fx) * (1 - fy);
  B[p + 1] += v * fx * (1 - fy);
  B[p + W] += v * (1 - fx) * fy;
  B[p + W + 1] += v * fx * fy;
}

export function draw(display, params) {
  const P = params, { buf, alb, mat, bg, SB, SS, FL, SF, CS, CC, RS, RC, lc, amb, str, rock, T } = P;
  BUF = buf;
  SS.fill(0);
  FL.fill(0);
  SF.fill(0);
  swimmers(P, true);
  // Wake rings: a crest on the surface, and the same ring focused onto the floor.
  for (const [cx, cy, r, amp, k, sd] of P.ri) {
    const f = fade([cx, cy, r, amp]), n = max(6, Math.ceil(r * 5));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * PI, x = cx + cos(a) * r, y = cy + sin(a) * r, w = (abs(x - LANE(k)) > 6.2 ? 0.2 : 1) * (0.6 + 0.4 * sin(a * 3 + sd));
      splat(SF, x, y, f * w * 2.2);
      splat(SF, x - cos(a), y - sin(a), -f * w * 1.2);
      splat(FL, x + P.sx, y + P.sy, f * w * 0.6);
    }
  }
  for (let i = 0; i < 5; i++) {
    const [, , om, phs] = P.wv[i], ky = P.ky[i];
    for (let y = 0; y < H; y++) (RS[i * H + y] = sin(ky * y - om * T + phs)), (RC[i * H + y] = cos(ky * y - om * T + phs));
  }
  const glint = P.glint * 150;
  for (let y = Y0; y <= Y1; y++)
    for (let x = 2; x <= 61; x++) {
      const p = y * W + x, o = p * 3;
      let s = 0;
      for (let i = 0; i < 5; i++) s += CS[i * W + x] * RC[i * H + y] + CC[i * W + x] * RS[i * H + y];
      s = abs(s) * 7;
      const c = s < 1 ? (1 - s) * (1 - s) : 0, li = (0.62 + str * c + FL[p]) * (1 - 0.85 * min(1, SB[p] + SS[p])), sf = SF[p], gl = sf > 0.45 ? (sf - 0.45) * glint : 0;
      for (let ch = 0; ch < 3; ch++) buf[o + ch] = alb[o + ch] * (amb[ch] + lc[ch] * li) * TW[ch] * 255 + SC[ch] + sf * [40, 62, 66][ch] + gl;
    }
  for (let p = 0; p < N; p++) if (mat[p] !== 3) for (let c = 0; c < 3; c++) buf[p * 3 + c] = bg[p * 3 + c];
  // Water moving in the gutters.
  for (let p = 0; p < N; p++)
    if (mat[p] === 1 && alb[p * 3] < 0.5) {
      const q = 0.75 + 0.5 * sin(T * 3 + (p & 63) * 0.9 + (p >> 6) * 0.7);
      for (let c = 0; c < 3; c++) buf[p * 3 + c] *= q;
    }
  ropes(P);
  swimmers(P, false);
  for (const [x, y, , , life, l0, size, kind] of P.fo) {
    const f = life / l0, r = size * (0.55 + 0.45 * f), a = [0.8, 0.95, 0.45, 0.6][kind] * pow(f, 0.7);
    for (let yy = floor(y - r); yy <= y + r; yy++)
      for (let xx = floor(x - r); xx <= x + r; xx++) {
        const q = cl(r + 0.5 - hypot(xx - x, yy - y), 0, 1) * a;
        if (q > 0.02 && xx > 1 && xx < 62 && yy >= Y0 - 1 && yy <= Y1 + 1) blend(yy * W + xx, 236 * lc[0] + 20, 244 * lc[1] + 10, 248 * lc[2] + 6, q);
      }
  }
  flags(P);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = p * 3, r = buf[o], g = buf[o + 1], b = buf[o + 2];
      display.setPixel(x, y, r > 255 ? 255 : r < 0 ? 0 : r, g > 255 ? 255 : g < 0 ? 0 : g, b > 255 ? 255 : b < 0 ? 0 : b);
    }
}

// Lane ropes: red floats for the last 5 m at each end, blue and white between.
// A float the wake reaches rocks and turns its shine.
const RED = [222, 38, 40], WHITE = [236, 236, 232], BLUE = [28, 72, 206];
function ropes(P) {
  const { rock, T, lc, amb } = P;
  for (let j = 0; j < 4; j++) {
    const x0 = ROPE(j) - 0.5;
    for (let i = 0; i < 56; i++) {
      const y = Y0 + 2 * i, rk = min(1.2, max(rock[j * H + y], rock[j * H + y + 1])), c = i < 11 || i > 44 ? RED : (i >> 1) & 1 ? WHITE : BLUE;
      const sh = rk > 0.12 ? round(sin(T * 11 + i * 1.3) * min(1, rk) * 0.9) : 0, hi = floor(T * 7 * rk + i * 0.5) & 3;
      for (let q = 0; q < 4; q++) {
        const x = x0 + (q & 1) + sh, yy = y + (q >> 1), k = (q === (rk > 0.12 ? hi : 0) ? 1.28 : q === 3 - (rk > 0.12 ? hi : 0) ? 0.62 : 0.92) * (1 + 0.15 * rk);
        if (x > 1 && x < 62) blend(yy * W + x, c[0] * k * (lc[0] * 0.9 + amb[0] * 0.4), c[1] * k * (lc[1] * 0.9 + amb[1] * 0.4), c[2] * k * (lc[2] * 0.9 + amb[2] * 0.4), 1);
      }
    }
  }
}

// Backstroke flags strung across from posts on the side decks, fluttering.
const FLAGC = [[228, 40, 44], [240, 240, 236], [30, 80, 220], [250, 206, 30]];
function flags(P) {
  const { lc, T } = P;
  for (const f of FLAGS)
    for (let x = 0; x < W; x++) {
      const i = floor(x / 3), c = FLAGC[i & 3], on = x % 3 !== 2;
      const p = f * W + x;
      if (on) blend(p, c[0] * lc[0], c[1] * lc[1], c[2] * lc[2], 0.95);
      else blend(p, 70, 70, 74, 0.6);
      if (on && x % 3 === 0 && sin(T * 6 + i * 2.1) > 0.3) blend(p + W, c[0] * lc[0] * 0.8, c[1] * lc[1] * 0.8, c[2] * lc[2] * 0.8, 0.7);
    }
}
