// ===== Patternflow pattern =====
// Title:   Pumpkin Carving
// Family:  halloween
// Idea:    A big orange pumpkin on a dark table at night: a glinting knife saws out two eyes, a nose and a jagged grin piece by piece, each pushed in to drop into the dark inside; a match flares, the candle catches and the face burns gold and flickers, its light spilling over the table, then it gutters out and the pumpkin turns to bring round fresh skin for a different face.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 47
// Round:   47
// ===============================
// @matrix 64x128
// @knobs Warmth=-1..1, Speed=0.2..3, Fierce=0..1, Spill=0..1
//
// Knob 1: Warmth. The pumpkin and its candlelight together: at 0 a bright orange pumpkin burning gold; at -1 a red one burning orange; at 1 a golden yellow one, which the candle turns orange round a pale yellow face. The night and the stem stay as they are.
// Knob 2: Speed. At 2 a calm face takes about 13 seconds: 6 to carve, 0.9 for the match, 3.5 burning, 0.9 to gutter out and 1.8 to turn; a fierce face's long grin adds 2 more to the carving. At 0.2 the story runs ten times slower, at 3 half as fast again; the flame flickers at its own pace.
// Knob 3: Fierce. The faces the knife chooses, each one new: at 0 upright triangle eyes and a smile with two or three square teeth; at 1 bigger eyes slanted down to the nose and a wider, deeper grin with seven or eight pointed teeth above and fangs standing up between them, which appear past 0.3.
// Knob 4: Spill. How far the candlelight carries: at 0.06 a pool of gold, orange and crimson rings 38 LEDs either side and 16 rows down the table, and a crimson rim three LEDs round the pumpkin; at 1 the pool covers the table and the glow reaches 18 to 20 LEDs into the night.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, asin, hypot, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The pumpkin, a spheroid with ten ribs: centre, half-width, half-height;
// the table's back edge; the candle flame's x, seen only through the holes.
const CX = 32, CY = 68, PA = 29.5, PB = 26, RIBS = 10, TABLE = 88, FX = 32;
// The moon's light on the skin, a unit vector toward it: upper left, in front.
const LX = -0.5, LY = -0.62, LZ = 0.6;
// Where the pumpkin stands on the table.
const BASE = CY + PB;
// The story in seconds at Speed 2: the knife moves to a piece, saws round it
// at KNIFE LEDs a second and pushes it in; match, burn, gutter, half turn.
const TRAVEL = 0.22, KNIFE = 60, PUSH = 0.45, MATCH = 0.9, BURN = 3.5, OUT = 0.9, TURN = 1.8, REST = 0.3;
// Across a rib, groove to groove in 256 steps: its bulge and the lean of its normal.
const RIB_B = new Float32Array(256), RIB_L = new Float32Array(256);
for (let i = 0; i < 256; i++) (RIB_B[i] = sin((PI * (i + 0.5)) / 256)), (RIB_L[i] = -0.55 * cos((PI * (i + 0.5)) / 256));
// The knife: blade and handle in LEDs, pointing up and right as a right hand holds it.
const BLADE = 15, HANDLE = 10, KDX = 0.55, KDY = -0.835;
const BOLSTER = [1, 0.95, 0.7, 1, 0.95, 0.7, 1, 0.95, 0.7], HANDLE_C = [0.5, 0.3, 0.62, 0.32, 0.12, 0.42, 0.18, 0.06, 0.26];

// A new face in head-on panel LEDs: left eye, right eye, nose, mouth, each a
// polygon the knife saws round in turn. Fierce scowls the eyes and deepens and
// multiplies the teeth; the rest is chance, so no two faces are the same.
function makeFace(fierce) {
  const R = Math.random, f = fierce, pieces = [];
  const ex = 10 + 2.5 * R(), ey = CY - 9 - 2 * R(), bw = 9 + 3 * R() + 3 * f, eh = 7 + 3 * R() + 2 * f, ap = (R() - 0.5) * 3;
  for (const sd of [-1, 1]) {
    // q runs from the outer corner to the nose. Calm, the triangle stands on
    // its base; fierce, its top runs down to the inner corner.
    const calm = [[-bw / 2, eh / 2], [bw / 2, eh / 2], [ap, -eh / 2]];
    const mad = [[-bw / 2, eh / 2 + 0.5], [bw / 2 + 2, eh / 2 - 1.5], [-bw / 2 + 1, -eh / 2 - 1.5]];
    pieces.push(calm.map(([q, y], i) => [CX + sd * ex - sd * mix(q, mad[i][0], f), ey + mix(y, mad[i][1], f)]));
  }
  const nw = 5 + 2 * R(), nh = 4.5 + 2 * R(), up = R() > 0.25 + 0.4 * f ? 1 : -1;
  pieces.push([[CX - nw / 2, CY + 1 + (up * nh) / 2], [CX + nw / 2, CY + 1 + (up * nh) / 2], [CX, CY + 1 - (up * nh) / 2]]);
  // The mouth: a smile between two curves, its top edge sawn into teeth,
  // square at Fierce 0 and pointed at 1, and past 0.3 its bottom into fangs.
  const mw = 15 + 4 * R() + 4 * f, y0 = CY + 8 + R(), ct = 3 + 2.5 * R(), th0 = 3.5, cb = ct + 5 + 2 * R() + 4 * f;
  const nt = round(2 + 5 * f + R() * 1.4), nb = f > 0.3 ? max(1, nt - 1) : 0, sharp = 0.12 + 0.38 * f;
  const top = (u) => y0 + ct * (1 - u * u), bot = (u) => y0 + th0 + cb * (1 - u * u);
  const edge = (n, yf, dep, dir) => {
    const pts = [], S = 2 * n + 1, nq = max(2, Math.ceil(10 / S));
    for (let j = 0; j < S; j++) {
      const u0 = -1 + (2 * j) / S, u1 = -1 + (2 * (j + 1)) / S;
      if (j % 2 === 0) for (let q = 0; q < nq; q++) {
        const u = u0 + ((u1 - u0) * q) / nq;
        pts.push([CX + mw * u, yf(u)]);
      }
      else {
        const ua = mix(u0, u1, sharp), ub = mix(u1, u0, sharp);
        pts.push([CX + mw * u0, yf(u0)], [CX + mw * ua, yf(ua) + dir * dep(ua)]);
        if (ub > ua + 1e-6) pts.push([CX + mw * ub, yf(ub) + dir * dep(ub)]);
      }
    }
    pts.push([CX + mw, yf(1)]);
    return pts;
  };
  const gap = (u) => bot(u) - top(u), deepT = 0.45 + 0.1 * f, deepB = 0.3 * f;
  const mouth = edge(nt, top, (u) => deepT * gap(u), 1).concat(edge(nb, bot, (u) => deepB * gap(u), -1).reverse());
  pieces.push(mouth);
  return pieces.map((pts) => {
    let len = 0;
    const cum = [0];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      len += hypot(b[0] - a[0], b[1] - a[1]);
      cum.push(len);
    }
    let cx = 0, cy = 0;
    for (const p of pts) (cx += p[0] / pts.length), (cy += p[1] / pts.length);
    return { pts, cum, len, cx, cy, state: 0, t: 0.5 };
  });
}

// Which piece covers each LED of the head-on face, 1 to 4, 0 for skin.
// The candle stands so its flame rises from just inside the top of the mouth.
function maskFace(S) {
  const m = S.mask;
  m.fill(0);
  S.face.forEach((pc, k) => {
    const xs = pc.pts.map((p) => p[0]), ys = pc.pts.map((p) => p[1]);
    for (let y = max(0, floor(min(...ys))); y <= min(H - 1, floor(max(...ys))); y++)
      for (let x = max(0, floor(min(...xs))); x <= min(W - 1, floor(max(...xs))); x++) {
        const px = x + 0.5, py = y + 0.5;
        let inside = false;
        for (let i = 0, j = pc.pts.length - 1; i < pc.pts.length; j = i++) {
          const [xi, yi] = pc.pts[i], [xj, yj] = pc.pts[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) m[y * W + x] = k + 1;
      }
  });
  let top = H;
  for (let i = 0; i < N; i++) if (m[i] === 4) top = min(top, floor(i / W));
  S.fy = top + 3;
}

export function setup(params) {
  // A few stars in the sky, each with its own twinkle.
  const stars = [];
  for (let i = 0; i < 16; i++) stars.push([floor(Math.random() * W), floor(Math.random() * 40), Math.random() * TAU]);
  // The pumpkin's fixed geometry per LED: longitude at no turn (-10 off the
  // pumpkin), its cosine and sine, and the spheroid's normal.
  const geo = new Float32Array(N).fill(-10), cth = new Float32Array(N), sth = new Float32Array(N);
  const gnx = new Float32Array(N), gny = new Float32Array(N), gnz = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5 - CY) / PB, c = sqrt(max(0, 1 - v * v)), rw = PA * c;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX, i = y * W + x;
      if (abs(dx) >= rw) continue;
      const u = dx / rw, th = asin(u);
      (geo[i] = th), (cth[i] = cos(th)), (sth[i] = u);
      (gnx[i] = u * c), (gny[i] = v * 0.9), (gnz[i] = sqrt(max(0, 1 - u * u)) * c);
    }
  }
  params.s = {
    geo, cth, sth, gnx, gny, gnz,
    // Numbers that change every frame start as fractions, so the engine
    // keeps them as floats from the start and does not recompile.
    warmth: 0.5, speed: 1.5, fierce: 0.5, spill: 0.06, rt: 0.5, made: false,
    face: null, mask: new Uint8Array(N), stars, fy: 80.5,
    // The story: phase, time in it, the piece being cut and how far round.
    phase: "cut", pt: 0.5, piece: 3, sub: "trace", cut: 0.5, from: [CX + 0.5, CY + 0.5],
    turned: 0.5, phi: 0.5, light: 0.5, flare: 0.5, mx: 0.5, my: 0.5, glow: 0.5, sway: 0.5,
    rgb: new Float32Array(N * 3), pal: new Float64Array(36), lit: new Float32Array(N), skin: new Uint8Array(N),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.warmth = cl(k[0], -1, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.fierce = cl(k[2], 0, 1);
  S.spill = cl(k[3], 0, 1);
  const g = (d * S.speed) / 2;
  S.rt += d;
  if (!S.made) {
    // The first face opens with the knife part way round the mouth.
    S.made = true;
    S.face = makeFace(S.fierce);
    maskFace(S);
    for (let i = 0; i < 3; i++) S.face[i].state = 3;
    S.face[3].state = 1;
    S.cut = S.face[3].len * 0.45;
  }
  // The flame: a breath, a shiver, now and then a short gust; it leans with them.
  const t = S.rt, gust = max(0, sin(t * 1.9 + 2 * sin(t * 0.7))) ** 6;
  S.glow = cl(1 - 0.14 * (0.5 + 0.5 * sin(t * 11.3) * sin(t * 4.1 + 1)) - 0.05 * sin(t * 23.7) - 0.2 * gust, 0.25, 1.05);
  S.sway = 0.5 * (0.6 * sin(t * 2.3) + 0.4 * sin(t * 5.1 + 0.4)) + 0.8 * gust * sin(t * 0.9);
  S.pt += g;
  const pc = S.face[S.piece];
  if (S.phase === "cut") {
    if (S.sub === "travel") {
      if (S.pt >= TRAVEL) (S.sub = "trace"), (S.pt = 0), (pc.state = 1), (S.cut = 0);
    } else if (S.sub === "trace") {
      S.cut += g * KNIFE;
      if (S.cut >= pc.len) (S.sub = "push"), (S.pt = 0), (pc.state = 2), (pc.t = 0);
    } else {
      pc.t = cl(S.pt / PUSH, 0, 1);
      if (S.pt >= PUSH) {
        pc.state = 3;
        S.from = pc.pts[0];
        S.pt = 0;
        if (S.piece < 3) (S.piece++), (S.sub = "travel");
        else S.phase = "match";
      }
    }
  } else if (S.phase === "match" && S.pt >= MATCH) (S.phase = "burn"), (S.pt = 0);
  else if (S.phase === "burn" && S.pt >= BURN) (S.phase = "out"), (S.pt = 0);
  else if (S.phase === "out" && S.pt >= OUT) (S.phase = "turn"), (S.pt = 0);
  else if (S.phase === "turn" && S.pt >= TURN) {
    // Fresh skin faces us now; the ribs repeat every half turn.
    (S.phase = "rest"), (S.pt = 0), (S.phi = 0), (S.turned += PI);
    S.face = makeFace(S.fierce);
    maskFace(S);
  } else if (S.phase === "rest" && S.pt >= REST) (S.phase = "cut"), (S.pt = 0), (S.piece = 0), (S.sub = "travel"), (S.from = [CX + 22.5, CY - 30.5]);
  S.phi = S.phase === "turn" ? PI * ease(cl(S.pt / TURN, 0, 1)) : 0;
  // How lit the inside is: the match flares and sinks to a small flame, the
  // candle catches with a flash and burns, then gutters out.
  S.flare = 0;
  if (S.phase === "match") {
    const u = S.pt / MATCH;
    S.flare = u < 0.15 ? u / 0.15 : u < 0.5 ? 1 - ((u - 0.15) / 0.35) * 0.7 : 0.3;
    S.light = u < 0.45 ? 0 : u < 0.55 ? 0.3 : 0.3 + 0.7 * ease((u - 0.55) / 0.45) + 0.4 * max(0, 1 - abs(u - 0.75) / 0.1);
    // Struck in the dark right of the stem, put in through the mouth.
    const v = ease(cl((u - 0.2) / 0.3, 0, 1));
    S.mx = mix(50, FX + 2, v);
    S.my = mix(34, S.fy - 1, v * v);
  } else if (S.phase === "burn") S.light = 1;
  else if (S.phase === "out") {
    const u = S.pt / OUT;
    S.light = (1 - u) * (1 - u) * (0.7 + 0.3 * sin(S.pt * 40));
  } else S.light = 0;
}

// The frame's colours in S.pal, three floats each: skin lit, shaded, in the
// grooves and sunk while the candle burns, all saturated (a dim orange reads
// brown); cut flesh; deep orange, gold, white-hot and crimson light; and, by
// how bright the flame burns, the light itself and its pool's inner rings.
const HI = 0, LO = 3, GROOVE = 6, SUNK = 9, FLESH = 12, DEEP = 15, GOLD = 18, HOT = 21, CRIM = 24, GLOW = 27, POOL0 = 30, POOL1 = 33;
const RED = [0.88, 0.08, 0.02];
function hsvTo(P, o, h, s, v) {
  const c = hsv(h, s, v);
  (P[o] = c[0]), (P[o + 1] = c[1]), (P[o + 2] = c[2]);
}
function palette(S, dim) {
  // Warmth runs the pumpkin from red through orange to golden yellow. Lit
  // from inside, a yellow skin would pale to the face's own colour, so it
  // sinks toward orange instead.
  const P = S.pal, hp = 0.075 + 0.075 * S.warmth, wy = cl((hp - 0.09) / 0.06, 0, 1);
  hsvTo(P, HI, hp + 0.015, 0.88, 1);
  hsvTo(P, LO, hp - 0.02, 1, 0.88);
  hsvTo(P, GROOVE, hp - 0.04, 1, 0.74);
  hsvTo(P, SUNK, hp - 0.035 - 0.06 * wy, 1, 0.84);
  hsvTo(P, FLESH, min(hp + 0.06, 0.15), 0.5, 0.95);
  hsvTo(P, DEEP, hp - 0.01, 1, 1);
  hsvTo(P, GOLD, min(hp + 0.06, 0.15), 0.88 - 0.25 * wy, 1);
  hsvTo(P, HOT, min(hp + 0.1, 0.16), 0.28 - 0.1 * wy, 1);
  hsvTo(P, CRIM, hp - 0.07, 0.88, 0.95);
  // Gold at full, deep orange at half, ember red as it gutters, so a dim
  // flame turns red, not brown.
  for (let c = 0; c < 3; c++) {
    P[GLOW + c] = dim < 0.5 ? mix(RED[c], P[DEEP + c], dim * 2) : mix(P[DEEP + c], P[GOLD + c], dim * 2 - 1);
    P[POOL0 + c] = mix(P[CRIM + c], P[GOLD + c], dim);
    P[POOL1 + c] = mix(P[CRIM + c], P[DEEP + c], dim);
  }
}

// The night: violet sky in bands, the table with the pumpkin's shadow, and
// while the candle burns its glow in the air and its pool on the table.
function night(S, L) {
  const P = S.pal, rgb = S.rgb, sp = S.spill, lamp = min(1, L);
  const poolX = 36 + 30 * sp, poolY = 15 + 22 * sp, halo = 0.06 + 0.62 * sp, breathe = 0.72 + 0.3 * L;
  for (let y = 0; y < H; y++) {
    const band = floor((y / TABLE) * 9) / 8, v = (y + 0.5 - CY) / PB;
    const sky = y < TABLE, front = y >= TABLE + 14;
    const b2 = band * band, r0 = sky ? 0.02 + 0.2 * b2 : front ? 0.15 : 0.12, g0 = sky ? 0.004 + 0.05 * b2 : front ? 0.065 : 0.05, b0 = sky ? 0.05 + 0.27 * b2 : front ? 0.22 : 0.19;
    const haloRow = L > 0 && sky && v > -1 - halo && v < 1 + halo, poolRow = L > 0 && y > BASE - 1, shadeRow = !sky && y > BASE - 5 && y < BASE + 5;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let r = r0, g = g0, b = b0;
      if (haloRow) {
        // Three rings of crimson round the pumpkin.
        const hx = (x + 0.5 - CX) / PA, e = (sqrt(hx * hx + v * v) - 1) / halo;
        if (e > 0 && e < 1) {
          const a = (e < 0.35 ? 0.55 : e < 0.7 ? 0.36 : 0.2) * lamp, c = e < 0.35 ? POOL1 : CRIM;
          (r = mix(r, P[c], a)), (g = mix(g, P[c + 1], a)), (b = mix(b, P[c + 2], a));
        }
      }
      if (shadeRow) {
        const sx = (x + 0.5 - CX - 3) / 31, sy = (y + 0.5 - BASE) / 4.5;
        if (sx * sx + sy * sy < 1) (r *= 0.4), (g *= 0.4), (b *= 0.45);
      }
      if (poolRow) {
        // Gold, then orange, then crimson, all sinking to crimson as the
        // flame dips, and the pool breathes with it.
        const px = (x + 0.5 - CX) / poolX, py = (y + 0.5 - BASE - 1) / poolY, dd = sqrt(px * px + py * py) / breathe;
        if (dd < 1) {
          const c = dd < 0.42 ? POOL0 : dd < 0.7 ? POOL1 : CRIM, a = (dd < 0.42 ? 0.88 : dd < 0.7 ? 0.66 : 0.45) * (0.4 + 0.6 * lamp);
          (r = mix(r, P[c], a)), (g = mix(g, P[c + 1], a)), (b = mix(b, P[c + 2], a));
        }
      }
      (rgb[o] = r), (rgb[o + 1] = g), (rgb[o + 2] = b);
    }
  }
}

// The skin: its longitude, turned with the body, sets the ribs, whose sides
// lean the normal so the moon lights one. Five steps of light, three of groove.
function skinAt(S, i, rot, warm) {
  const P = S.pal, rgb = S.rgb, o = i * 3;
  const gq = (((S.geo[i] - rot) * RIBS) / TAU) % 1, ri = floor((gq < 0 ? gq + 1 : gq) * 256) & 255, bulge = RIB_B[ri], lean = RIB_L[ri];
  const nx = S.gnx[i] + lean * S.cth[i], ny = S.gny[i], nz = S.gnz[i] - lean * S.sth[i];
  const lam = floor(cl((nx * LX + ny * LY + nz * LZ) / (sqrt(nx * nx + ny * ny + nz * nz) || 1), 0, 0.999) * 5) / 4;
  const gw = bulge < 0.25 ? 0 : bulge < 0.6 ? 0.55 : 1;
  for (let c = 0; c < 3; c++) rgb[o + c] = mix(mix(P[GROOVE + c], mix(P[LO + c], P[HI + c], lam), gw), P[SUNK + c], warm);
}

// A hole, or a piece on its way in. k is the piece, (fx, y) the LED in
// head-on coordinates. Returns false where the pushed piece still covers it.
function holeAt(S, i, k, fx, y, v, L, dim) {
  const P = S.pal, rgb = S.rgb, mask = S.mask, pc = S.face[k - 1], o = i * 3;
  if (pc.state === 2) {
    // Pushed in: at once a dark gap opens round the piece, then it shrinks
    // and sinks inside its hole, darkening as it goes.
    const p = pc.t, sc = 0.9 - 0.3 * p, qx = floor(pc.cx + (fx + 0.5 - pc.cx) / sc), qy = floor(pc.cy + (y + 0.5 - pc.cy - 0.5 - 4 * p * p) / sc);
    if (qx >= 0 && qx < W && qy >= 0 && qy < H && mask[qy * W + qx] === k) {
      const d = 0.35 + 0.65 * p;
      (rgb[o] = mix(rgb[o], P[GROOVE], d)), (rgb[o + 1] = mix(rgb[o + 1], P[GROOVE + 1], d) * (1 - 0.5 * p)), (rgb[o + 2] *= 1 - d);
      return false;
    }
  }
  // The wall of the cut shows on the side away from the middle.
  const wx = floor(fx + 0.5 + ((fx + 0.5 - CX) / PA) * 2.6), wy = floor(y + 0.5 + v * 2.2);
  if (wx < 0 || wx >= W || wy < 0 || wy >= H || mask[wy * W + wx] !== k) {
    const a = mix(0.9, 1, cl(S.light, 0, 1));
    for (let c = 0; c < 3; c++) rgb[o + c] = mix(P[FLESH + c], P[HOT + c], dim) * a;
    return true;
  }
  // Inside: dark, or the far wall candlelit, gold to white-hot by the flame,
  // brighter than the skin so the face reads as burning.
  const flameX = FX + S.sway, ex = fx + 0.5 - flameX, ey = (y + 0.5 - S.fy) * 0.8;
  const near = floor(cl(1 - sqrt(ex * ex + ey * ey) / 24, 0, 0.999) * 4) / 3;
  const a = (0.55 + 0.45 * min(1, L)) * cl(S.light * 4, 0, 1), hn = near * 0.75 * dim;
  (rgb[o] = 0.03 + mix(P[GLOW], P[HOT], hn) * a), (rgb[o + 1] = 0.01 + mix(P[GLOW + 1], P[HOT + 1], hn) * a), (rgb[o + 2] = 0.04 + mix(P[GLOW + 2], P[HOT + 2], hn) * a);
  S.lit[i] = a;
  // The flame itself, through whichever hole it lies behind.
  const flameH = 6 + 1.5 * S.glow, fy = S.fy - (y + 0.5), fxo = ex - S.sway * 0.4 * (fy / flameH);
  if (S.light > 0.12 && fy > -1 && fy < flameH) {
    const q = fy / flameH, w = q < 0.3 ? 2.2 * sqrt(q / 0.3) : 2.2 * (1 - (q - 0.3) / 0.7) ** 0.8;
    if (fxo > -w - 0.2 && fxo < w + 0.2) {
      const core = fxo > -w * 0.5 && fxo < w * 0.5 && q < 0.65;
      (rgb[o] = 1), (rgb[o + 1] = core ? 0.97 : 0.75), (rgb[o + 2] = core ? 0.8 : 0.2);
    }
  }
  return true;
}

// The pumpkin: skin, and the face carried round with the turn.
function pumpkin(S, L, dim) {
  const { skin, mask, face, geo } = S, rot = S.turned + S.phi, fl = S.phi;
  // While the candle burns the skin sinks to a saturated red-orange round the face.
  const warm = 0.5 * cl(L, 0, 1);
  for (let y = CY - PB; y < CY + PB; y++) {
    const v = (y + 0.5 - CY) / PB, rw = PA * sqrt(max(0, 1 - v * v));
    for (let x = max(0, floor(CX - rw)); x <= min(W - 1, floor(CX + rw)); x++) {
      const i = y * W + x, th = geo[i];
      if (th < -9) continue;
      skinAt(S, i, rot, warm);
      skin[i] = 1;
      const thr = th - fl;
      if (thr <= -PI / 2 || thr >= PI / 2) continue;
      const fx = fl === 0 ? x : floor(CX + rw * sin(thr)), k = fx >= 0 && fx < W ? mask[y * W + fx] : 0;
      if (k && face[k - 1].state >= 2 && holeAt(S, i, k, fx, y, v, L, dim)) skin[i] = 0;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.face) return;
  const { rgb, lit, skin, face, pal: P } = S;
  const L = S.light * S.glow, dim = cl((L - 0.3) / 0.5, 0, 1), rot = S.turned + S.phi;
  palette(S, dim);
  lit.fill(0);
  skin.fill(0);
  night(S, L);
  pumpkin(S, L, dim);
  // Light from the holes blooms gold onto the skin two LEDs round them.
  if (L > 0.02)
    for (let i = (CY - PB) * W; i < (CY + PB) * W; i++) {
      if (!skin[i]) continue;
      const n1 = max(lit[i - 1], lit[i + 1], lit[i - W], lit[i + W]), n2 = max(lit[i - 2], lit[i + 2], lit[i - 2 * W], lit[i + 2 * W]);
      const a = n1 > 0 ? 0.67 * min(1, n1 * 1.2) : 0.33 * min(1, n2 * 1.2);
      if (a > 0) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = mix(rgb[i * 3 + c], P[GOLD + c], a);
    }
  // The stem: a thick green hook from the dimple on top, its lean turning
  // with the pumpkin.
  const lean = 5 * sin(0.9 + rot), sx0 = CX + 0.5, sy0 = CY - PB + 3;
  for (let s = 0; s <= 24; s++) {
    const q = s / 24, px = sx0 + lean * q * q, py = sy0 - 12 * q, rr = 2.6 - 1.1 * q;
    for (let y = floor(py - rr); y <= py + rr; y++)
      for (let x = floor(px - rr); x <= px + rr; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H || (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 > rr * rr) continue;
        const o = (y * W + x) * 3, hi = x + 0.5 < px - 0.4;
        (rgb[o] = hi ? 0.45 : 0.22), (rgb[o + 1] = hi ? 0.95 : 0.72), (rgb[o + 2] = hi ? 0.25 : 0.12);
      }
  }
  // The stars, twinkling.
  for (const [x, y, ph] of S.stars) {
    const o = (y * W + x) * 3, a = 0.35 + 0.3 * sin(S.rt * 1.7 + ph);
    if (!skin[y * W + x]) (rgb[o] = max(rgb[o], a)), (rgb[o + 1] = max(rgb[o + 1], a * 0.9)), (rgb[o + 2] = max(rgb[o + 2], a));
  }
  const put = (x, y, r, g, b) => {
    x = floor(x);
    y = floor(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    (rgb[o] = r), (rgb[o + 1] = g), (rgb[o + 2] = b);
  };
  if (S.phase === "cut") {
    const pc = face[S.piece];
    // The cut so far, a pale line of fresh flesh, ends where the blade is in.
    let tip = [pc.cx + 1, pc.cy];
    if (S.sub === "travel") {
      const u = ease(cl(S.pt / TRAVEL, 0, 1)), to = pc.pts[0];
      tip = [mix(S.from[0], to[0], u), mix(S.from[1], to[1], u)];
    } else if (pc.state === 1)
      for (let j = 0; j < pc.pts.length && pc.cum[j] < S.cut; j++) {
        const a = pc.pts[j], b = pc.pts[(j + 1) % pc.pts.length], l = pc.cum[j + 1] - pc.cum[j] || 1, e = min(1, (S.cut - pc.cum[j]) / l);
        for (let q = 0; q <= e * l * 2; q++) put(mix(a[0], b[0], q / (2 * l)), mix(a[1], b[1], q / (2 * l)), P[FLESH], P[FLESH + 1], P[FLESH + 2]);
        tip = [mix(a[0], b[0], e), mix(a[1], b[1], e)];
      }
    // The knife saws up and down its own length.
    const saw = S.sub === "trace" ? 1.6 * sin(S.rt * 31) : 0;
    const bl = BLADE + saw, sparkle = (S.rt * 1.3) % 1;
    for (let s = 0; s <= (bl + HANDLE) * 2; s++) {
      const a = s / 2, x = tip[0] + KDX * a, y = tip[1] + KDY * a;
      if (a <= bl) {
        // Silver, the edge brightest; the glint runs up it.
        const gl = max(0, 1 - abs(a - sparkle * bl) / 2.5);
        put(x, y, 0.78 + 0.22 * gl, 0.82 + 0.18 * gl, 0.92 + 0.08 * gl);
        put(x + 1, y, 0.5 + 0.4 * gl, 0.54 + 0.4 * gl, 0.66 + 0.3 * gl);
      } else {
        // A brass bolster, then a violet handle lit on its left.
        const c = a < bl + 1 ? BOLSTER : HANDLE_C;
        for (let j = 0; j < 3; j++) put(x + j - 1, y, c[j * 3], c[j * 3 + 1], c[j * 3 + 2]);
      }
    }
  }
  if (S.phase === "match" && S.flare > 0) {
    // The match: a pale stick, a white burst with rays as it is struck,
    // then its own small flame above the head.
    const f = S.flare, x0 = S.mx, y0 = S.my;
    for (let j = 1; j <= 6; j++) put(x0 + 0.55 * j, y0 + 0.85 * j, 0.95, 0.86, 0.62);
    const reach = 3 + 7 * f, core = 1.2 + 2.6 * f;
    for (let y = floor(y0 - reach); y <= y0 + reach; y++)
      for (let x = floor(x0 - reach); x <= x0 + reach; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const ddx = x + 0.5 - x0, ddy = y + 0.5 - y0, dd = sqrt(ddx * ddx + ddy * ddy);
        const ray = (abs(ddx) < 0.6 || abs(ddy) < 0.6 ? 1 : abs(abs(ddx) - abs(ddy)) < 0.7 ? 0.65 : 0) * max(0, 1 - dd / reach);
        const a = min(1, max(ray * f * 1.3, dd < core ? 1 : 0));
        if (a <= 0.05) continue;
        const o = (y * W + x) * 3;
        (rgb[o] = mix(rgb[o], 1, a)), (rgb[o + 1] = mix(rgb[o + 1], dd < core * 0.6 ? 1 : 0.9, a)), (rgb[o + 2] = mix(rgb[o + 2], dd < core * 0.6 ? 0.9 : 0.45, a));
      }
    for (let j = 1; j <= 4; j++) {
      const w = j < 3 ? 1 : 0;
      for (let dx = -w; dx <= w; dx++) put(x0 + dx, y0 - j, 1, j < 2 ? 1 : 0.8, j < 2 ? 0.8 : 0.25);
    }
  }
  for (let i = 0; i < N; i++)
    display.setPixel(i % W, floor(i / W), (255 * cl(rgb[i * 3], 0, 1)) | 0, (255 * cl(rgb[i * 3 + 1], 0, 1)) | 0, (255 * cl(rgb[i * 3 + 2], 0, 1)) | 0);
}
