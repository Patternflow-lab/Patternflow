// ===== Patternflow pattern =====
// Title:   Lap Pool
// Family:  sport
// Idea:    A 25 m outdoor pool seen from straight above: swimmers in coloured caps swim lengths at their own paces, kick up white water, rock the lane ropes with their V wakes and flip-turn at the walls over a floor netted with sun caustics.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after overhead drone photographs of outdoor lap pools
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Stroke=0..3, Speed=0.2..3, Swimmers=4..15, Sun=-1..1
//
// Knob 1: Stroke. What everyone swims: freestyle at 0, backstroke at 1, breaststroke at 2 with its frog kick and glide, butterfly at 3 with both arms swung across the lane. Breaststroke and butterfly churn the water and break up the caustic net.
// Knob 2: Speed. How fast the swimmers and the water go: at 2 a freestyle length takes 10 to 14 s, breaststroke nearer 20.
// Knob 3: Swimmers. Four swimmers in four of the five lanes at 4; past five they share lanes and swim in circles, three a lane at 15.
// Knob 4: Sun. Near noon at 0.06, with a bright caustic net and short shadows. Towards -1 the morning sun comes low from the east, towards 1 the evening sun from the west: gold light, a faint stretched net, long shadows across the lanes.

const { min, max, floor, ceil, round, sin, cos, abs, sqrt, exp, pow, asin, tan, PI } = Math;
const hyp = (a, b) => sqrt(a * a + b * b);
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

const [W, H, N] = [64, 128, 8192];
// Pixel centres on whole numbers. Water: rows 8..119 (25 m), columns 2..61, five lanes of 12.
const [Y0, Y1] = [8, 119];
const LANE = (k) => 7.5 + 12 * k;
const ROPE = (k) => 13.5 + 12 * k;
// Backstroke flags 5 m out from each wall.
const FLAGS = [Y0 + 22, Y1 - 22];
// Body centre VC rows behind the crown; swimmers drawn SZ times life size.
const [VC, SZ] = [4.5, 1.3];
const HV = VC * SZ;
const [SWIM, TURN, GLIDE] = [0, 1, 2];
// Per stroke: pace (rows/s at Speed 2), arm cycles/s, wake, kick spray/s, churn.
const STROKE = [[9.2, 1.15, 0.5, 22, 0.2], [8, 1, 0.45, 26, 0.15], [5.8, 0.95, 0.9, 0, 0.7], [8.6, 1.05, 1.25, 0, 1]];
const CAPS = [[252, 212, 20], [232, 36, 48], [242, 242, 236], [34, 34, 40], [36, 204, 92], [255, 122, 18], [255, 84, 170], [28, 104, 238], [182, 188, 198], [150, 64, 226]];
const SKIN = [[238, 192, 160], [214, 160, 118], [176, 116, 78], [122, 78, 52], [248, 206, 178]];
const SUIT = [[22, 26, 70], [18, 18, 22], [184, 22, 44], [0, 112, 132], [96, 32, 124], [34, 64, 168]];
// Lanes fill from the middle, so four swimmers leave lane 4 free.
const ORDER = [2, 0, 4, 1, 3];
// Light through 2 m of water, and the blue it scatters back.
const TW = [0.36, 0.72, 0.82];
const SC = [2, 18, 30];

function build(P) {
  const { alb, mat, blk } = P;
  const set = (x, y, m, r, g, b) => ((mat[y * W + x] = m), alb.set([r, g, b], (y * W + x) * 3));
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, g = hash(x, y) - 0.5, e = min(y - Y0, Y1 - y);
    if (e >= 0 && x >= 2 && x <= 61) {
      // White tiles on a 4 LED grid; lane lines end in a T 2 m from the wall.
      const t = (1 + (hash(x >> 2, (y - Y0) >> 2) - 0.5) * 0.07 + g * 0.04) * ((x - 2) % 4 && (y - Y0) % 4 ? 1 : 0.88);
      const dc = abs(x - LANE(floor((x - 1.5) / 12)));
      if (e > 8 && (dc < 1 || (dc < 3 && e < 11))) set(x, y, 3, 0.1 * t, 0.14 * t, 0.38 * t);
      else set(x, y, 3, 0.84 * t, 0.92 * t, 0.95 * t);
    } else if (e === -1 && x >= 2 && x <= 61) set(x, y, 2, 0.12, 0.28 + g * 0.04, 0.58);
    else if (e >= -3 && x >= 1 && x <= 62) {
      // The overflow gutter's grate: white bars over dark water.
      const bar = (e < -1 ? x : y) % 2 === 0;
      set(x, y, 1, bar ? 0.86 : 0.04, bar ? 0.88 : 0.17, bar ? 0.89 : 0.23);
    } else {
      // Stone paving, darker where the splashes land.
      const side = x === 0 || x === 63, j = side ? y % 8 === 0 : x % 8 === 0 || e === -8;
      const k = (0.92 + 0.16 * hash(side ? x : x >> 3, side ? y >> 3 : y > 64) + g * 0.07) * (j ? 0.84 : 1) * (e === -4 || side ? 0.88 - 0.1 * hash(x, y + 7) : 1);
      set(x, y, 0, 0.8 * k, 0.75 * k, 0.66 * k);
    }
  }
  const box = (x0, y0, w, h, c, rd) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) if (!rd || (x > x0 && x < x0 + w - 1) || (y > y0 && y < y0 + h - 1)) (blk[y * W + x] = 1), set(x, y, 0, ...c);
  };
  // Starting blocks: kick plate, blue grip, white rim.
  for (let k = 0, x; k < 5; k++) (x = round(LANE(k) - 2.5)), box(x, 1, 6, 5, [0.9, 0.91, 0.92]), box(x, 1, 6, 1, [0.5, 0.53, 0.57]), box(x + 1, 2, 4, 3, [0.12, 0.28, 0.72]);
  // Kickboards, bottles, a towel and flip-flops on the far deck.
  box(3, 123, 5, 4, [0.96, 0.76, 0.12], 1);
  box(5, 124, 5, 4, [0.16, 0.42, 0.92], 1);
  for (const [x, c] of [[11, [0.3, 0.62, 0.95]], [35, [0.92, 0.2, 0.22]], [47, [0.3, 0.82, 0.42]]]) box(x, 124, 2, 2, c), set(x, 124, 0, 0.95, 0.95, 0.95);
  for (let y = 123; y < 127; y++) box(50, y, 7, 1, y & 1 ? [0.95, 0.94, 0.88] : [0.1, 0.62, 0.62]);
  for (const x of [41, 43]) box(x, 124, 1, 3, [0.96, 0.4, 0.62]);
}

// Sun height and bearing: shadows, light colour, the stretch of the caustic net.
function paint(P, s) {
  const q = pow(abs(s), 1.3), a = ((25 + 100 * s) * PI) / 180, e = ((52 - 36 * abs(s)) * PI) / 180, za = PI / 2 - e;
  const L = 11 * tan(asin(sin(za) / 1.33)), ux = sin(a), uy = -cos(a), F = L + 8 * tan(za), I = 1 - 0.18 * q, warm = s < 0 ? [1, 0.86, 0.66] : [1, 0.76, 0.56];
  Object.assign(P, { sx: ux * L, sy: uy * L, fx: ux * F, fy: uy * F, str: 0.8 * sin(e) ** 2 + 0.25, glint: (1 - abs(s)) ** 2 * 150 });
  P.lc = [1, 0.98, 0.93].map((v, c) => mix(v, warm[c], q) * I);
  // Low sun leaves the floor to the sky's light.
  P.amb = [0.1, 0.15, 0.2].map((v, c) => v + q * [0.06, 0.12, 0.18][c]);
  // The caustic net, squeezed along the sun's bearing when it is low.
  const st = 1 - 1 / (1 + 1.4 * (1 - sin(e))), { wv, CS, CC, alb, mat, blk, bg, SB, lc, amb } = P;
  wv.forEach(([an, l], i) => {
    const kx = (cos(an) * 2 * PI) / l, ky = (sin(an) * 2 * PI) / l, kd = (kx * ux + ky * uy) * st;
    P.ky[i] = ky - kd * uy;
    for (let x = 0; x < W; x++) (CS[i * W + x] = sin((kx - kd * ux) * x)), (CC[i * W + x] = cos((kx - kd * ux) * x));
  });
  // Shadows: the blocks' on the deck; the walls', ropes' and flags' on the floor.
  const bx = ux * 2 * tan(za), by = uy * 2 * tan(za);
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6;
    if (mat[p] === 3) {
      const wx = x - P.sx, wy = y - P.sy;
      let sh = 1 - sm(min(wx - 1.5, 61.5 - wx, wy - Y0 + 0.5, Y1 + 0.5 - wy) + 0.5);
      for (let k = 0; k < 4; k++) sh += 0.6 * cl(1.3 - abs(wx - ROPE(k)), 0, 1);
      for (const f of FLAGS) sh += 0.35 * cl(1 - abs(y - P.fy - f), 0, 1) * (floor(x - P.fx) % 3 ? 1 : 0.4);
      SB[p] = min(1, sh);
    } else {
      const sx = round(x - bx), sy = round(y - by), shade = !blk[p] && sx >= 0 && sx < W && sy >= 0 && sy < H && blk[sy * W + sx] ? 0.5 : 1;
      for (let c = 0; c < 3; c++) bg[p * 3 + c] = alb[p * 3 + c] * (amb[c] * 0.7 + lc[c] * 0.74 * shade) * 255;
    }
  }
}

// Swimmers are capsules in body coordinates: u across (+ right), v back from the crown.
let nc = 0;
const CP = new Float32Array(20 * 8);
const cap = (u0, v0, u1, v1, r, c, sub) => CP.set([u0, v0, u1, v1, r, c, sub], nc++ * 8);
// An arm from the shoulder to the hand, the elbow bent out to its side.
function arm(sg, [hu, hv, bend, sub, hr = 0.5], deep) {
  const su = sg * 1.8, dx = hu - su, dv = hv - 2.5, l = hyp(dx, dv) || 1, f = (dv * sg < 0 ? -bend : bend) / l, eu = (su + hu) / 2 + dv * f, ev = (2.5 + hv) / 2 - dx * f;
  cap(su, 2.5, eu, ev, 0.55, 1, max(sub, deep));
  cap(eu, ev, hu, hv, hr, 1, max(sub, deep));
}

// Hand [u, v, elbow bend, how far under, hand size] for each stroke and phase.
function hand(s, sg, ph) {
  const th = fr(ph + (sg > 0 || s > 1 ? 0 : 0.5)), p = th * 2 - 1, q = th * 2 * PI;
  if (s === 0) return th < 0.5 ? [sg * (0.5 + 0.7 * sin(q)), -2.4 + 8.2 * sm(th * 2), 0.5, 0.5] : [sg * (1.6 + 2.3 * sin(p * PI)), 5.8 - 8.2 * sm(p), 1.3, 0];
  // Backstroke's straight arm passes the vertical: from above, a bright hand.
  if (s === 1) return th < 0.5 ? [sg * 2.1, 2.5 + 4.8 * cos(q), 0, 0, 0.5 + 0.4 * sin(q)] : [sg * (1.3 + 2.6 * sin(p * PI)), -2.3 + 8.8 * sm(p), 1.2, 0.5];
  if (s === 2) {
    if (th < 0.22) return [sg * (0.4 + 2.8 * sm(th / 0.22)), -3.4 + 7.3 * th, 0.9, 0.4];
    if (th < 0.38) return [sg * mix(3.2, 0.7, sm((th - 0.22) / 0.16)), mix(-1.8, 1.4, (th - 0.22) / 0.16), 1, 0.32];
    if (th < 0.52) return [sg * mix(0.7, 0.4, (th - 0.38) / 0.14), mix(1.4, -3.4, sm((th - 0.38) / 0.14)), 0.6, 0.4];
    return [sg * 0.4, -3.4, 0.3, 0.45];
  }
  if (th < 0.5) return [sg * (1.6 - 0.9 * sin(q)), mix(-2.6, 6, sm(th * 2)), 0.6, 0.5];
  return th < 0.8 ? [sg * (1.8 + 3.8 * sin(((th - 0.5) / 0.3) * PI)), mix(6, -2.6, sm((th - 0.5) / 0.3)), 0.4, 0] : [sg * 1.6, -2.6, 0.4, 0.32];
}

// This frame's capsules; returns how far the body is curled up.
function pose(S, s) {
  nc = 0;
  const { ph, z, st } = S, t = S.t / S.tt;
  let sc = 1, up = 0, hs, feet = null;
  if (st === SWIM) (hs = [hand(s, 1, ph), hand(s, -1, ph)]), (up = s === 2 ? sm(1 - abs(ph - 0.36) / 0.16) : s === 3 ? sm(1 - abs(ph - 0.47) / 0.14) : 0);
  else if (st === GLIDE) hs = [[0.3, -4.1, 0.2, z], [-0.3, -4.1, 0.2, z]];
  else {
    sc = t < 0.5 ? 1 - 0.55 * sm(t / 0.35) : 0.45 + 0.55 * sm(t * 2 - 1);
    hs = t >= 0.5 ? [[0.3, -3.6, 0.2, 0.7], [-0.3, -3.6, 0.2, 0.7]] : S.open ? [[1, -3.4, 0.4, 0], [-1, -3.4, 0.4, 0]] : [[1.6, 6, 0.3, 0.5], [-1.6, 6, 0.3, 0.5]];
    up = S.open && t < 0.6 ? 1 : 0;
    // In a flip the legs come over the top.
    if (!S.open && t > 0.25 && t < 0.62) feet = 9.6 * cos((PI * (t - 0.25)) / 0.37);
  }
  const deep = st === TURN ? 0.4 : z, under = (i) => hs[i][3] > 0.3;
  for (let i = 0; i < 2; i++) if (under(i)) arm(1 - 2 * i, hs[i], deep);
  for (const sg of [1, -1]) {
    // The frog kick draws the heels up and whips them round and together.
    const r = st || s - 2 ? 0 : cl(1 - abs(ph - 0.52) / 0.14, 0, 1), w = ph > 0.52 ? 8.8 * r * (1 - r) : 0;
    let fu = sg * (0.5 + 1.2 * r + w), fv = 9.4 - 2.2 * r + (s < 2 ? 0.3 * sin(S.kp + (sg > 0 ? 0 : PI)) : 0), ku = sg * (0.6 + 1.6 * r), kv = 7.9 - 0.6 * r;
    if (st === SWIM && s === 3) fv = 9.4 + 0.5 * sin(ph * 4 * PI);
    if (st === GLIDE) fv = 9.5 + 0.4 * sin(S.t * 16);
    if (feet !== null) [ku, kv, fu, fv] = [sg * 0.6, VC + feet * 0.45, sg * 0.5, VC + feet];
    cap(sg * 0.6, 6.3, ku, kv, 0.62, 1, max(0.42, deep));
    cap(ku, kv, fu, fv, 0.5, 1, feet !== null ? 0.6 * abs(feet / 9.6) : max(0.42, deep));
  }
  // Hips, back, shoulders (the one over a recovering arm rides higher), head.
  cap(0, 5.2, 0, 6.3, 1.15, 2, max(s === 3 && st === SWIM ? 0.3 + 0.25 * sin(ph * 4 * PI) : 0.35, deep));
  cap(0, 2.8, 0, 5, 1.35, S.sb ? 2 : 1, max(0.25 - 0.2 * up, deep));
  for (let i = 0; i < 2; i++) cap(0, 2.4, 1.8 - 3.6 * i, 2.5, 0.75, 1, max(under(i) ? 0.3 : 0.05, deep) * (1 - 0.6 * up));
  const h = (st === TURN && !S.open ? 0.6 * sm(t / 0.3) : 0.05 * (1 - up)) + deep * 0.6;
  if (s === 1 && st !== GLIDE) {
    // Face up: cap, face, goggles.
    cap(0, 0.55, 0, 0.9, 0.95, 0, h);
    cap(0, 1.45, 0, 1.45, 0.75, 1, h);
    cap(-0.45, 1.2, 0.45, 1.2, 0.28, 3, h);
  } else cap(0, 0.7, 0, 1.3, 0.95 + 0.15 * up, 0, h);
  for (let i = 0; i < 2; i++) if (!under(i)) arm(1 - 2 * i, hs[i], deep * 0.6);
  return sc;
}

// Screen position of a body point.
const sxy = (S, sc, u, v) => [S.x - S.d * u * SZ * (1.3 - 0.3 * sc), S.y - S.d * (v - VC) * sc * SZ];

// White water: n flecks round a point. Kinds: foam, spray, kick.
function foam(P, [x, y], n, spread, life, size, kind, vel) {
  for (let i = 0, a, r, l; i < n; i++) (a = rnd() * 2 * PI), (r = spread * sqrt(rnd())), (l = life * (0.6 + 0.6 * rnd())), P.fo.push([x + cos(a) * r, y + sin(a) * r, cos(a) * vel * rnd(), sin(a) * vel * rnd(), l, l, size * (0.7 + 0.6 * rnd()), kind]);
}
const ring = (P, S, [x, y], amp) => P.ri.push([x, y, 0, amp, S.k, rnd() * 7]);
const fade = (r, amp) => amp * max(0, 1 - r / 10);

function newSwimmer(P, i, fresh) {
  const k = ORDER[i % 5], d = rnd() < 0.5 ? 1 : -1;
  const S = { k, d, x: LANE(k) + rnd() - 0.5, o: (rnd() - 0.5) * 1.2, f: 0.8 + rnd() * 0.36, ph: rnd(), kp: rnd() * 7, st: SWIM, t: 0, tt: 1, z: 0, v: 0, ring: rnd() * 0.12, cap: CAPS[P.caps[i % 10]], skin: SKIN[floor(rnd() * 5)], suit: SUIT[floor(rnd() * 6)], sb: rnd() < 0.5 };
  // At the start they are spread along their lanes; later ones push off a wall.
  if (fresh) S.y = Y0 + 16 + fr(0.29 * floor(i / 5) + rnd() * 0.85) * (Y1 - Y0 - 32);
  else Object.assign(S, { y: (d > 0 ? Y0 - 0.5 : Y1 + 0.5) + d * 5.6 * SZ, st: GLIDE, z: 0.85 });
  return S;
}

function stepSwimmer(P, S, d, s) {
  const [pace0, hz, wamp, kf] = STROKE[s], pace = pace0 * S.f, wall = S.d > 0 ? Y1 + 0.5 : Y0 - 0.5;
  const head = () => sxy(S, 1, 0, 0.6), feet = () => sxy(S, 1, 0, 9.8);
  S.t += d;
  S.x += cl(LANE(S.k) + (P.cnt[S.k] > 1 ? -S.d * 2.4 : S.o) - S.x, -4 * d, 4 * d);
  S.kp += d * (s < 2 ? 17 : 6);
  let v = 0;
  if (S.st === SWIM) {
    const p0 = S.ph, ph = (S.ph += hz * (0.55 + 0.45 * S.f) * d), crossed = (at) => floor(p0 - at) !== floor(ph - at);
    // Breaststroke and butterfly surge after each kick.
    v = pace * (s === 2 ? 0.6 + 1.82 * exp(-4.5 * fr(ph - 0.6)) : s === 3 ? 0.7 + exp(-3 * fr(2 * ph - 0.1)) : 1 + 0.06 * sin(ph * 4 * PI));
    // Keep behind a slower swimmer going the same way.
    for (const O of P.sw) if (O.k === S.k && O.d === S.d && !O.st && (O.y - S.y) * S.d > 0 && (O.y - S.y) * S.d < 13) v = min(v, O.v);
    // Splash where a hand goes in; butterfly throws spray.
    for (const sg of [1, -1]) {
      const at = [sg > 0 ? 0 : 0.5, sg > 0 ? 0.5 : 0, -1, 0.8][s];
      if (at >= 0 && crossed(at)) {
        const h = hand(s, sg, at + 0.001), xy = sxy(S, 1, h[0], h[1]);
        foam(P, xy, s === 3 ? 6 : 3, s === 3 ? 1.6 : 0.8, 0.6, s === 3 ? 0.85 : 0.75, 0, s === 3 ? 5 : 2);
        if (s === 3) foam(P, xy, 4, 0.5, 0.35, 0.8, 1, 9);
      }
    }
    if (kf && rnd() < kf * d * 1.5) {
      const [x, y] = feet();
      foam(P, [x + (rnd() - 0.5) * 2.2, y + S.d * rnd() * 1.5], 1, 0.4, 0.5, 0.75, 2, 0);
    }
    if ((s === 2 && crossed(0.6)) || (s === 3 && (crossed(0.08) || crossed(0.58)))) foam(P, feet(), 5, 2, 0.7, 0.85, 0, 3);
    // Each stroke sends out a pulse, so the arms of the V come in dashes.
    if ((S.ring -= d) <= 0) (S.ring = 0.2), ring(P, S, head(), wamp * (0.35 + 1.3 * (s < 2 ? cos(2 * PI * ph) ** 2 : sm(1 - abs(fr(ph) - (s === 2 ? 0.45 : 0.78)) / 0.22))));
    // At the wall: a flip turn, or a two-hand touch for breaststroke and butterfly.
    if ((wall - S.y) * S.d - HV < (s > 1 ? 1.2 : 2.3)) Object.assign(S, { st: TURN, t: 0, y0: S.y, w: wall, yb: wall - S.d * 3 * SZ, open: s > 1, tt: s > 1 ? 1.15 : 0.9, flip: 0 });
    else S.y += S.d * v * d;
  } else if (S.st === TURN) {
    const t = S.t / S.tt;
    if (t >= 0.5 && !S.flip) {
      S.flip = true;
      S.d = -S.d;
      const xy = sxy(S, 0.45, 0, VC + 3);
      foam(P, xy, S.open ? 5 : 9, 2.4, 0.9, 0.95, 0, 4);
      if (!S.open) foam(P, xy, 5, 1, 0.35, 0.8, 1, 8);
      ring(P, S, xy, 1.1);
    }
    S.y = t < 0.5 ? mix(S.y0, S.yb, sm(t * 2)) : mix(S.yb, S.w + S.d * 5.6 * SZ, sm(t * 2 - 1));
    if (t >= 1) Object.assign(S, { st: GLIDE, t: 0, z: 0.85 });
  } else {
    // Underwater off the wall, rising as it slows, then a breakout.
    const t = S.t / 1.05;
    v = pace * (1.75 - 0.85 * t);
    S.z = 0.85 - 0.75 * sm(t);
    S.y += S.d * v * d;
    if ((S.ring -= d) <= 0) (S.ring = 0.2), ring(P, S, head(), 0.45 * (1 - S.z));
    if (t >= 1) {
      foam(P, head(), s === 3 ? 7 : 5, 1.8, 0.7, 0.85, 0, 3);
      ring(P, S, head(), 0.9);
      Object.assign(S, { st: SWIM, t: 0, z: 0, ph: s === 2 ? 0.1 : 0 });
    }
  }
  S.v = v;
}

export function setup(params) {
  const P = params, F = (n) => new Float32Array(n);
  Object.assign(P, { alb: F(N * 3), mat: new Uint8Array(N), blk: new Uint8Array(N), bg: F(N * 3), buf: F(N * 3), SB: F(N), SS: F(N), FL: F(N), SF: F(N), acc: F(W) });
  Object.assign(P, { CS: F(7 * W), CC: F(7 * W), RS: F(7 * H), RC: F(7 * H), ky: F(7), chop: -1, rock: F(4 * H), sun: 9, t: 0, sw: [], fo: [], ri: [], cnt: [0, 0, 0, 0, 0] });
  // Five long swells make the caustic net; two short ripples are the swimmers' chop.
  P.wv = Array.from({ length: 7 }, (_, i) => {
    const l = i < 5 ? 9 + rnd() * 6 : 5 + rnd() * 1.5;
    return [(i * PI) / 5 + (rnd() - 0.5) * 0.4 + (i > 4) * 0.3, l, ((i < 5 ? 1.6 + rnd() * 1.4 : 3 + rnd()) * 2 * PI) / l, rnd() * 7];
  });
  // Bright caps first.
  P.caps = [0, 1, 5, 4, 6, 7].sort(() => rnd() - 0.5).concat([2, 9, 8, 3]);
  build(P);
}

export function update(dt, input, params) {
  const P = params, k = input.knobValues || [0, 2, 4, 0.06], { rock } = P;
  const s = (P.s = cl(round(k[0]), 0, 3)), sun = cl(k[3], -1, 1), n = round(cl(k[2], 4, 15)), d = cl(dt, 0, 0.1) * (cl(k[1], 0.2, 3) / 2);
  if (abs(sun - P.sun) > 0.002) (P.sun = sun), paint(P, sun);
  // Butterfly and breaststroke churn the pool; more swimmers churn it more.
  const chop = STROKE[s][4] * (0.7 + (0.3 * (n - 4)) / 11), fresh = !P.t;
  P.chop = fresh ? chop : P.chop + (chop - P.chop) * min(1, d * 1.5);
  while (P.sw.length < n) P.sw.push(newSwimmer(P, P.sw.length, fresh));
  P.sw.length = n;
  P.cnt.fill(0);
  for (const S of P.sw) P.cnt[S.k]++;
  P.t += d;
  for (const S of P.sw) stepSwimmer(P, S, d, s);
  // Wakes spread at 3 rows a second, slower than the swimmers, so their rings
  // pile up into a V. Where one meets a rope, the floats rock.
  for (let i = 0; i < 4 * H; i++) rock[i] *= exp(-1.8 * d);
  P.ri = P.ri.filter((R) => {
    const r = (R[2] += 3 * d), f = fade(r, R[3]);
    for (const j of [R[4] - 1, R[4]]) {
      const dx = abs(ROPE(j) - R[0]), dy = sqrt(r * r - dx * dx);
      if (j >= 0 && j < 4 && r > dx) for (const y of [round(R[1] - dy), round(R[1] + dy)]) if (y >= 0 && y < H) rock[j * H + y] = max(rock[j * H + y], f);
    }
    return r < 10;
  });
  const dk = exp(-4 * d);
  P.fo = P.fo.filter((f) => ((f[0] += f[2] * d), (f[1] += f[3] * d), (f[2] *= dk), (f[3] *= dk), (f[4] -= d) > 0));
}

let BUF;
function blend(p, r, g, b, a) {
  const o = p * 3;
  BUF[o] += (r - BUF[o]) * a;
  BUF[o + 1] += (g - BUF[o + 1]) * a;
  BUF[o + 2] += (b - BUF[o + 2]) * a;
}
function splat(B, x, y, v) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi, p = yi * W + xi;
  if (xi < 2 || xi > 60 || yi < Y0 || yi >= Y1) return;
  B[p] += v * (1 - fx) * (1 - fy);
  B[p + 1] += v * fx * (1 - fy);
  B[p + W] += v * (1 - fx) * fy;
  B[p + W + 1] += v * fx * fy;
}

// One capsule on screen: into the colour buffer, or as a soft shadow into SS.
function stamp(P, x0, y0, x1, y1, r, col, sub, shadow) {
  const dx = x1 - x0, dy = y1 - y0, ll = dx * dx + dy * dy || 1e-6, e = shadow ? r + 1.4 : r + 0.6, { lc, amb, SS } = P, op = 1 - 0.3 * sub;
  const c = [0, 1, 2].map((i, v) => ((v = col[i] * (lc[i] * 0.86 + amb[i] * 0.45)), mix(v, v * TW[i] * 1.15 + SC[i], sub)));
  for (let y = max(0, floor(min(y0, y1) - e)), yb = min(H - 1, ceil(max(y0, y1) + e)); y <= yb; y++)
    for (let x = max(2, floor(min(x0, x1) - e)), xb = min(61, ceil(max(x0, x1) + e)); x <= xb; x++) {
      const px = x - x0, py = y - y0, t = cl((px * dx + py * dy) / ll, 0, 1), dd = hyp(px - t * dx, py - t * dy), p = y * W + x;
      if (shadow) SS[p] = max(SS[p], cl((r + 1 - dd) / 1.8, 0, 1) * 0.85);
      else if (r + 0.5 > dd) blend(p, c[0], c[1], c[2], min(1, r + 0.5 - dd) * op);
    }
}

function swimmers(P, shadow) {
  for (const S of P.sw) {
    const sc = pose(S, P.s), cols = [S.cap, S.skin, S.suit, [20, 40, 90]], off = shadow ? 1 - 0.6 * S.z : 0;
    // White water pushed up round the head and shoulders.
    if (shadow && S.z < 0.5)
      for (let i = 0; i <= 10; i++) {
        const a = (i - 5) * 0.38, [x, y] = sxy(S, sc, sin(a) * 2.6, 1.6 - cos(a) * 2.4);
        splat(P.SF, x, y, (0.9 - 0.08 * abs(i - 5)) * (1 - 2 * S.z) * (S.st === TURN ? 1.6 : 1));
      }
    for (let i = 0, o = 0; i < nc; i++, o += 8) {
      const [x0, y0] = sxy(S, sc, CP[o], CP[o + 1]), [x1, y1] = sxy(S, sc, CP[o + 2], CP[o + 3]);
      stamp(P, x0 + P.sx * off, y0 + P.sy * off, x1 + P.sx * off, y1 + P.sy * off, CP[o + 4] * SZ, cols[CP[o + 5]], CP[o + 6], shadow);
    }
  }
}

export function draw(display, params) {
  const P = params, { buf, alb, mat, bg, SB, SS, FL, SF, CS, CC, RS, RC, lc, amb, str, acc, sx, sy, glint } = P;
  BUF = buf;
  for (const B of [SS, FL, SF]) B.fill(0);
  swimmers(P, true);
  // Wake rings: crest and trough on the surface, focused light on the floor.
  for (const [cx, cy, r, amp, k, sd] of P.ri) {
    const f = fade(r, amp), n = f > 0.03 ? max(6, ceil(r * 4.2)) : 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * PI, ca = cos(a), sa = sin(a), x = cx + ca * r, y = cy + sa * r, w = f * (abs(x - LANE(k)) > 6.2 ? 0.2 : 1) * (0.6 + 0.4 * sin(a * 3 + sd));
      splat(SF, x, y, w * 3);
      splat(SF, x - ca, y - sa, -w * 1.6);
      splat(FL, x + sx, y + sy, w * 0.9);
      splat(FL, x + sx - 1.5 * ca, y + sy - 1.5 * sa, -w * 0.6);
    }
  }
  for (let i = 0; i < 7; i++) {
    const [, , om, ps] = P.wv[i], ky = P.ky[i], a = i < 5 ? 0.21 : 0.3 * P.chop;
    for (let y = 0, q; y < H; y++) (q = ky * y - om * P.t + ps), (RS[i * H + y] = a * sin(q)), (RC[i * H + y] = a * cos(q));
  }
  // The floor: tiles under the caustic net, the shadows, and the wakes' light.
  const [A0, A1, A2] = amb.map((v, c) => v * TW[c] * 255), [L0, L1, L2] = lc.map((v, c) => v * TW[c] * 255);
  for (let y = Y0; y <= Y1; y++) {
    acc.fill(0);
    for (let i = 0; i < 7; i++) for (let x = 2, rc = RC[i * H + y], rs = RS[i * H + y]; x < 62; x++) acc[x] += CS[i * W + x] * rc + CC[i * W + x] * rs;
    for (let x = 2, p = y * W + 2; x < 62; x++, p++) {
      const s = abs(acc[x]) * 7, c = s < 1 ? (1 - s) * (1 - s) : 0, li = max(0, 0.62 + str * c + FL[p]) * (1 - 0.85 * min(1, SB[p] + SS[p])), sf = SF[p], gl = sf > 0.45 ? (sf - 0.45) * glint : 0;
      const o = p * 3;
      buf[o] = alb[o] * (A0 + L0 * li) + 2 + sf * 40 + gl;
      buf[o + 1] = alb[o + 1] * (A1 + L1 * li) + 18 + sf * 62 + gl;
      buf[o + 2] = alb[o + 2] * (A2 + L2 * li) + 30 + sf * 66 + gl;
    }
  }
  // Deck; water moving in the gutters.
  for (let p = 0, o = 0; p < N; p++, o += 3)
    if (mat[p] !== 3) {
      const q = mat[p] === 1 && alb[o] < 0.5 ? 0.75 + 0.5 * sin(P.t * 3 + (p & 63) * 0.9 + (p >> 6) * 0.7) : 1;
      for (let c = 0; c < 3; c++) buf[o + c] = bg[o + c] * q;
    }
  ropes(P);
  swimmers(P, false);
  for (const [x, y, , , life, l0, size, kind] of P.fo) {
    const f = life / l0, r = size * (0.55 + 0.45 * f), a = [0.8, 0.95, 0.6][kind] * pow(f, 0.7);
    for (let yy = max(Y0 - 1, floor(y - r)); yy <= min(Y1 + 1, y + r); yy++)
      for (let xx = max(2, floor(x - r)); xx <= min(61, x + r); xx++) {
        const q = cl(r + 0.5 - hyp(xx - x, yy - y), 0, 1) * a;
        if (q > 0.02) blend(yy * W + xx, 236 * lc[0] + 20, 244 * lc[1] + 10, 248 * lc[2] + 6, q);
      }
  }
  flags(P);
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) {
      const r = buf[o], g = buf[o + 1], b = buf[o + 2];
      display.setPixel(x, y, r > 255 ? 255 : r < 0 ? 0 : r, g > 255 ? 255 : g < 0 ? 0 : g, b > 255 ? 255 : b < 0 ? 0 : b);
    }
}

// Lane ropes: red floats 5 m from each end, blue and white between; a wake rocks them.
const FLOAT = [[222, 38, 40], [236, 236, 232], [28, 72, 206]];
function ropes({ rock, t, lc, amb }) {
  const k3 = lc.map((v, c) => v * 0.9 + amb[c] * 0.4);
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 56; i++) {
      const y = Y0 + 2 * i, rk = min(1.2, max(rock[j * H + y], rock[j * H + y + 1])), c = FLOAT[i < 11 || i > 44 ? 0 : (i >> 1) & 1 ? 1 : 2], on = rk > 0.12;
      const sh = on ? round(sin(t * 11 + i * 1.3) * min(1, rk) * 0.9) : 0, hi = on ? floor(t * 7 * rk + i * 0.5) & 3 : 0;
      for (let q = 0, k; q < 4; q++) (k = (q === hi ? 1.28 : q === 3 - hi ? 0.62 : 0.92) * (1 + 0.15 * rk)), blend((y + (q >> 1)) * W + ROPE(j) - 0.5 + (q & 1) + sh, c[0] * k * k3[0], c[1] * k * k3[1], c[2] * k * k3[2], 1);
    }
}

// Backstroke flags strung across between posts on the side decks.
const FLAGC = [[228, 40, 44], [240, 240, 236], [30, 80, 220], [250, 206, 30]];
function flags({ lc }) {
  for (const f of FLAGS) for (let x = 0, c; x < W; x++) (c = x % 3 > 1 ? [70, 70, 74] : FLAGC[floor(x / 3) & 3].map((v, i) => v * lc[i])), blend(f * W + x, ...c, 0.95);
}
