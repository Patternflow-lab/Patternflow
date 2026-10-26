// ===== Patternflow pattern =====
// Title:   Jordan Curve
// Family:  topology
// Idea:    One long winding simple closed curve fills the panel and slowly reshapes without ever touching itself; a probe wanders over it casting a ray to the far end of the panel, the ray's crossings with the curve are marked in gold and counted in pips along the top, and from the probe a flood of the colour the count's parity names, odd inside and even outside, spreads through the region it stands in until inside and outside come up as two interlocking territories.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Jordan curve theorem (Camille Jordan, 1887), its first proof accepted as complete (Oswald Veblen, 1905), the crossing-number test for a point in a polygon (M. Shimrat, 1962), pattern round 60
// Round:   60
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tension=-1..1, Probes=1..4
//
// Knob 1: Hue. Moves both territories along a strip of the wheel that leaves out red, orange and yellow, which go brown when dim: at 0 the inside is teal and the outside violet, at 0.25 blue and crimson, at 0.5 violet and teal, at 0.75 crimson and blue. The curve stays white, the crossings and the count gold, the probe white.
// Knob 2: Speed. At 2 the probe walks 7 LEDs a second, a flood takes 250 LEDs a frame and rests 0.8 s once its region is full, fresh colour fades by e every 5 s down to a third, and the curve is offered 60 changes a second, of which about 7 cells take one, each sliding across in 0.7 s; at 0.2 all of it ten times slower, at 3 half as fast again.
// Knob 3: Tension. How much the curve's length costs: a cell changes side with Metropolis probability min(1, e^-dE), E = -beta L + 0.03 (A - A*)^2, L the lattice edges the curve crosses, and beta = 0.4 - 0.5 x Tension below 0 and 0.4 - 1.1 x Tension above. At -1 (beta 0.9) inside and outside are two trees of corridors one cell wide and the curve is about 1390 LEDs long; at the opening 0 (beta 0.4) it is about 1220 LEDs round a branching coral of 127 of the 242 free cells, and a ray crosses it 8 times on average, up to 18; at 0.5 about 940 LEDs; at 1 (beta -0.7) one lobed blob of about 310.
// Knob 4: Probes. 1 to 4, rounded, each with its own ray, its own row of pips and its own two floods, so with 4 both territories are refreshed most of the time.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, abs, sqrt, sin, cos, exp, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// Region colours come off a strip of the wheel that skips red, orange and
// yellow, which turn brown and olive when dim.
const wheel = (u) => 0.34 + 0.63 * (u - floor(u));

// The curve is the zero set of a function that is linear on each triangle
// of a jittered triangular lattice of cells SP LEDs apart. A cell holds a
// value u in [-1, 1] and is inside where u is positive. Within a triangle
// whose corners are not all one sign the zero set is one straight segment,
// so the zero set is a union of disjoint simple closed curves and never
// touches itself. A cell changes side only when that keeps the cells
// inside one connected piece and the cells outside another, so there is
// exactly one curve. The cells within MARGIN of the panel's edge are held
// outside, so the outside reaches the edge all round and a ray that ends
// there ends outside.
const BETA0 = 0.4, LAMBDA = 0.03, FILL = 0.47;
// Tries a second, the seconds a changing cell takes to slide across, the
// floor and fade time of fresh colour, LEDs a flood takes a frame at Speed
// 1, the probe's speed, the ray's swing rate and a flood's rest.
const TRY = 60, SLIDE = 0.7, PFLOOR = 0.35, PTAU = 5, FLOOD = 125, VEL = 7, RAYW = 0.35, REST = 0.8;
const SP = 5.5, RH = (SP * Math.sqrt(3)) / 2, MARGIN = 4.5;
const NCOL = Math.ceil(W / SP) + 3, NROW = Math.ceil(H / RH) + 3, NC = NCOL * NROW;
// Six neighbours of each cell in turning order: right, up-right, up-left,
// left, down-left, down-right.
const NB = new Int32Array(NC * 6).fill(-1);
for (let j = 0; j < NROW; j++)
  for (let i = 0; i < NCOL; i++) {
    const c = j * NCOL + i, odd = j & 1;
    const nb = [[i + 1, j], [i + odd, j - 1], [i - 1 + odd, j - 1], [i - 1, j], [i - 1 + odd, j + 1], [i + odd, j + 1]];
    nb.forEach(([a, b], k) => {
      if (a >= 0 && a < NCOL && b >= 0 && b < NROW) NB[c * 6 + k] = b * NCOL + a;
    });
  }
// Triangles: each cell with its right and down-right neighbours, and with
// its down-right and down-left ones.
const TRI = [];
for (let c = 0; c < NC; c++) {
  const r = NB[c * 6], dr = NB[c * 6 + 5], dl = NB[c * 6 + 4];
  if (r >= 0 && dr >= 0) TRI.push(c, dr, r);
  if (dr >= 0 && dl >= 0) TRI.push(c, dl, dr);
}
const NT = TRI.length / 3;

export function setup(params) {
  const CX = new Float32Array(NC), CY = new Float32Array(NC), FIXED = new Uint8Array(NC), LT = new Int32Array(N);
  // The lattice is jittered once, by up to 0.22 of the spacing, small
  // enough that no triangle turns over.
  for (let j = 0; j < NROW; j++)
    for (let i = 0; i < NCOL; i++) {
      const c = j * NCOL + i, a = random() * 2 * PI, r = 0.22 * SP * sqrt(random());
      CX[c] = (i - 1.5 + (j & 1 ? 0.5 : 0)) * SP + (W - (NCOL - 3) * SP) / 2 + r * cos(a);
      CY[c] = (j - 1.5) * RH + (H - (NROW - 3) * RH) / 2 + r * sin(a);
      let full = true;
      for (let k = 0; k < 6; k++) if (NB[c * 6 + k] < 0) full = false;
      FIXED[c] = !full || CX[c] < MARGIN || CX[c] > W - 1 - MARGIN || CY[c] < MARGIN || CY[c] > H - 1 - MARGIN ? 1 : 0;
    }
  // Each LED's triangle and its three barycentric weights; and each
  // triangle's gradient of the three weights, for the distance to the curve.
  const LV = new Int32Array(N * 3).fill(-1), LW = new Float32Array(N * 3), GR = new Float32Array(NT * 6);
  for (let t = 0; t < NT; t++) {
    const a = TRI[3 * t], b = TRI[3 * t + 1], c = TRI[3 * t + 2];
    const x0 = CX[a], y0 = CY[a], x1 = CX[b], y1 = CY[b], x2 = CX[c], y2 = CY[c];
    const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    // d lambda_k / dx and / dy.
    GR[6 * t] = (y1 - y2) / det, GR[6 * t + 1] = (x2 - x1) / det;
    GR[6 * t + 2] = (y2 - y0) / det, GR[6 * t + 3] = (x0 - x2) / det;
    GR[6 * t + 4] = (y0 - y1) / det, GR[6 * t + 5] = (x1 - x0) / det;
    const xa = max(0, floor(min(x0, x1, x2))), xb = min(W - 1, Math.ceil(max(x0, x1, x2)));
    const ya = max(0, floor(min(y0, y1, y2))), yb = min(H - 1, Math.ceil(max(y0, y1, y2)));
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        const p = y * W + x;
        if (LV[3 * p] >= 0) continue;
        const l1 = ((x - x0) * (y2 - y0) - (x2 - x0) * (y - y0)) / det;
        const l2 = ((x1 - x0) * (y - y0) - (x - x0) * (y1 - y0)) / det;
        const l0 = 1 - l1 - l2;
        if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
        LV[3 * p] = a, LV[3 * p + 1] = b, LV[3 * p + 2] = c;
        LW[3 * p] = l0, LW[3 * p + 1] = l1, LW[3 * p + 2] = l2;
        LT[p] = t;
      }
  }
  const u = new Float32Array(NC).fill(-1), tgt = new Int8Array(NC).fill(-1);
  // Start from one cell in the middle.
  let c0 = 0, bd = 1e9;
  for (let c = 0; c < NC; c++) {
    const d = (CX[c] - W / 2) ** 2 + (CY[c] - H / 2) ** 2;
    if (!FIXED[c] && d < bd) (bd = d), (c0 = c);
  }
  u[c0] = 1, tgt[c0] = 1;
  let free = 0;
  for (let c = 0; c < NC; c++) if (!FIXED[c]) free++;
  params.s = {
    hue: 0, speed: 2, tension: 0, nprobe: 1, warm: false,
    LV, LW, GR, LT, FIXED, CX, CY, u, tgt, area: 1, free, busy: [],
    f: new Float32Array(N), gt: new Float32Array(NT),
    paint: new Float32Array(N), cls: new Int8Array(N), heal: new Int32Array(2 * N), glow: new Float32Array(N), side: new Int8Array(N),
    probes: [], tryAcc: 0, rgb: new Float32Array(N * 3), c: new Float32Array(3), c2: new Float32Array(3),
  };
}

// Can cell c change sides without changing the topology? Its neighbours,
// read round in turn, must be one run of in and one run of out: then adding
// it to either side glues a disc to that side along an arc.
function simple(S, c) {
  let runs = 0;
  const u = S.u;
  for (let k = 0; k < 6; k++) {
    const a = u[NB[c * 6 + k]] > 0, b = u[NB[c * 6 + ((k + 1) % 6)]] > 0;
    if (a !== b) runs++;
  }
  return runs === 2;
}

function inCount(S, c) {
  let n = 0;
  for (let k = 0; k < 6; k++) if (S.u[NB[c * 6 + k]] > 0) n++;
  return n;
}

// One Metropolis try: a cell, if simple and with no neighbour already
// moving, changes sides with probability min(1, e^-dE), where
// E = -beta L + LAMBDA (A - A*)^2, L the number of lattice edges the curve
// crosses, A the cells inside and A* = FILL of the free cells. No two
// neighbours move at once, so a cell that was simple when it set off is
// still simple when its value crosses zero. instant flips it at once (for
// the warm-up); otherwise its value starts to slide towards the other sign.
function attempt(S, beta, instant) {
  const c = floor(random() * NC);
  if (S.FIXED[c] || S.u[c] !== S.tgt[c]) return;
  for (let k = 0; k < 6; k++) {
    const n = NB[c * 6 + k];
    if (S.u[n] !== S.tgt[n]) return;
  }
  if (!simple(S, c)) return;
  const k = inCount(S, c), isIn = S.u[c] > 0;
  const dL = isIn ? 2 * k - 6 : 6 - 2 * k, dA = isIn ? -1 : 1;
  const A0 = S.free * FILL, a = S.area - A0;
  const dE = -beta * dL + LAMBDA * ((a + dA) ** 2 - a ** 2);
  if (dE > 0 && random() >= exp(-dE)) return;
  S.area += dA;
  S.tgt[c] = isIn ? -1 : 1;
  if (instant) S.u[c] = S.tgt[c];
  else S.busy.push(c);
}

// A probe keeps a flood for each side, so a flood it left behind on
// crossing the curve runs on to the end of its region.
const flood = (sign, cls) => ({ sign, cls, q: new Int32Array(N), seen: new Int32Array(N), gen: 0, head: 0, tail: 0, rest: 0 });
function newProbe(S, i) {
  return { x: 12 + random() * 40, y: 16 + random() * 96, h: random() * 2 * PI, ray: PI / 2, down: 1, ph: random() * 2 * PI, F: [flood(1, 1), flood(-1, 2)], hits: [], i };
}

// The function at any point of the panel, read bilinearly off the LEDs.
function fAt(S, x, y) {
  const f = S.f;
  x = cl(x, 0, W - 1.001);
  y = cl(y, 0, H - 1.001);
  const i = floor(x), j = floor(y), a = x - i, b = y - j, p = j * W + i;
  return (f[p] * (1 - a) + f[p + 1] * a) * (1 - b) + (f[p + W] * (1 - a) + f[p + W + 1] * a) * b;
}

// March the probe's ray to the panel's edge in quarter-LED steps; every
// change of sign is a crossing, placed where the line through the two
// samples meets zero. A tangency the steps miss loses two crossings at
// once and leaves the parity alone.
function castRay(S, P) {
  const dx = cos(P.ray), dy = sin(P.ray);
  // From the centre of the LED the probe stands on, so the parity and the
  // sign the flood follows are read at the same point.
  P.sx = round(P.x);
  P.sy = round(P.y);
  let tmax = 1e9;
  if (dx > 1e-6) tmax = min(tmax, (W - 0.5 - P.sx) / dx);
  if (dx < -1e-6) tmax = min(tmax, (-0.5 - P.sx) / dx);
  if (dy > 1e-6) tmax = min(tmax, (H - 0.5 - P.sy) / dy);
  if (dy < -1e-6) tmax = min(tmax, (-0.5 - P.sy) / dy);
  P.tmax = tmax;
  P.hits.length = 0;
  let prev = fAt(S, P.sx, P.sy);
  for (let t = 0.25; t <= tmax; t += 0.25) {
    const v = fAt(S, P.sx + dx * t, P.sy + dy * t);
    if ((v > 0) !== (prev > 0)) P.hits.push(t - 0.25 + (0.25 * prev) / (prev - v));
    prev = v;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.tension = cl(k[2], -1, 1);
  S.nprobe = round(cl(k[3], 1, 4));
  const beta = BETA0 - (S.tension < 0 ? 0.5 : 1.1) * S.tension, ds = (d * S.speed) / 2;
  if (!S.warm) {
    // Grow the opening curve from one cell, 90000 tries at the knob's beta.
    for (let i = 0; i < 90000; i++) attempt(S, beta, true);
    S.warm = true;
  }
  // Shape: tries at TRY a second, each accepted one sliding its cell's
  // value across zero in SLIDE seconds.
  S.tryAcc += ds * TRY;
  while (S.tryAcc >= 1) {
    S.tryAcc -= 1;
    attempt(S, beta, false);
  }
  const step = (2 * ds) / SLIDE;
  for (let i = 0; i < S.busy.length; ) {
    const c = S.busy[i], g = S.tgt[c];
    S.u[c] = g > 0 ? min(1, S.u[c] + step) : max(-1, S.u[c] - step);
    if (S.u[c] === g) {
      S.busy[i] = S.busy[S.busy.length - 1];
      S.busy.pop();
    } else i++;
  }
  // The function on every LED, and each triangle's gradient length. An LED
  // the curve has swept over to the other side loses its colour. Fresh
  // paint fades by e every PTAU seconds down to PFLOOR, the glow of a flood
  // front by e every 0.15 s.
  const { LV, LW, GR, u, f } = S;
  const cls = S.cls, side = S.side, paint = S.paint, glow = S.glow, heal = S.heal;
  const fade = min(1, ds / PTAU), gf = exp(-ds / 0.15);
  for (let p = 0; p < N; p++) {
    const q = 3 * p;
    const v = (f[p] = LV[q] < 0 ? -1 : LW[q] * u[LV[q]] + LW[q + 1] * u[LV[q + 1]] + LW[q + 2] * u[LV[q + 2]]);
    const sd = v > 0 ? 1 : -1;
    if (sd !== side[p]) (cls[p] = 0), (side[p] = sd);
    if (paint[p] > PFLOOR) paint[p] -= (paint[p] - PFLOOR) * fade;
    glow[p] *= gf;
  }
  for (let t = 0; t < NT; t++) {
    const a = u[TRI[3 * t]], b = u[TRI[3 * t + 1]], c = u[TRI[3 * t + 2]];
    const gx = a * GR[6 * t] + b * GR[6 * t + 2] + c * GR[6 * t + 4], gy = a * GR[6 * t + 1] + b * GR[6 * t + 3] + c * GR[6 * t + 5];
    S.gt[t] = sqrt(gx * gx + gy * gy) + 1e-6;
  }
  // A dark LED takes the colour of a coloured neighbour on its own side, one
  // LED a frame, so colour creeps on within a region it has already reached
  // and never crosses the curve. A region no flood has reached stays dark.
  let nh = 0;
  for (let p = 0; p < N; p++) {
    if (cls[p]) continue;
    const x = p & 63, sd = side[p];
    const q = x > 0 && side[p - 1] === sd && cls[p - 1] > 0 ? p - 1
      : x < W - 1 && side[p + 1] === sd && cls[p + 1] > 0 ? p + 1
      : p >= W && side[p - W] === sd && cls[p - W] > 0 ? p - W
      : p < N - W && side[p + W] === sd && cls[p + W] > 0 ? p + W : -1;
    if (q >= 0) (heal[nh++] = p), (heal[nh++] = q);
  }
  for (let i = 0; i < nh; i += 2) (cls[heal[i]] = cls[heal[i + 1]]), (paint[heal[i]] = paint[heal[i + 1]]);
  while (S.probes.length < S.nprobe) S.probes.push(newProbe(S, S.probes.length));
  S.probes.length = S.nprobe;
  const budget = round(FLOOD * S.speed);
  for (const P of S.probes) {
    // Wander: a heading that turns at random, turned back off the margin.
    P.h += (random() - 0.5) * 6 * ds;
    let vx = cos(P.h) * VEL * ds, vy = sin(P.h) * VEL * ds;
    if (P.x + vx < 8 || P.x + vx > W - 9) (P.h = PI - P.h), (vx = -vx);
    if (P.y + vy < 8 || P.y + vy > H - 9) (P.h = -P.h), (vy = -vy);
    P.x += vx;
    P.y += vy;
    // The ray aims at the farther end of the panel, down from the top half
    // and up from the bottom half with 32 rows of slack between, leans
    // towards the middle column by up to 29 degrees and swings 29 degrees
    // either way about that; it turns at most 1.5 radians a second, so a
    // change of end sweeps it round through the horizontal.
    if (P.down > 0 && P.y > 80) P.down = -1;
    else if (P.down < 0 && P.y < 48) P.down = 1;
    P.ph += RAYW * ds;
    let dr = P.down * (PI / 2 + (0.5 * (P.x - 31.5)) / 31.5) + 0.5 * sin(P.ph) - P.ray;
    dr -= 2 * PI * round(dr / (2 * PI));
    P.ray += cl(dr, -1.5 * ds, 1.5 * ds);
    castRay(S, P);
    // Odd: the probe is inside, and the inside's flood is the one it may
    // start, once that flood has run out and rested REST seconds.
    const Fh = P.F[P.hits.length & 1 ? 0 : 1], pl = P.sy * W + P.sx;
    if (Fh.head >= Fh.tail && (Fh.rest -= ds) <= 0) {
      Fh.rest = REST;
      Fh.gen++;
      Fh.head = Fh.tail = 0;
      Fh.q[Fh.tail++] = pl;
      Fh.seen[pl] = Fh.gen;
    }
    // The flood takes a random LED off its front each time, Eden's growth
    // rather than a breadth-first wave, so in the open it spreads as a
    // ragged disc instead of a diamond.
    for (const F of P.F)
      for (let n = 0; n < budget && F.head < F.tail; n++) {
        const r = F.head + floor(random() * (F.tail - F.head)), p = F.q[r];
        F.q[r] = F.q[F.head++];
        if ((f[p] > 0 ? 1 : -1) !== F.sign) continue;
        S.cls[p] = F.cls;
        S.paint[p] = 1;
        S.glow[p] = 1;
        const x = p & 63, y = p >> 6;
        if (x > 0) push(S, F, p - 1);
        if (x < W - 1) push(S, F, p + 1);
        if (y > 0) push(S, F, p - W);
        if (y < H - 1) push(S, F, p + W);
      }
  }
}
function push(S, P, p) {
  if (P.seen[p] === P.gen) return;
  if ((S.f[p] > 0 ? 1 : -1) !== P.sign) return;
  P.seen[p] = P.gen;
  P.q[P.tail++] = p;
}

function put(S, x, y, r, g, b) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3, o = S.rgb;
  o[p] = r, o[p + 1] = g, o[p + 2] = b;
}
function lift(S, x, y, v) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3, o = S.rgb;
  o[p] = max(o[p], v), o[p + 1] = max(o[p + 1], v), o[p + 2] = max(o[p + 2], v);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const o = S.rgb, c = S.c, c2 = S.c2, hu = S.hue;
  // Inside and outside colours, at 150 fresh and 52 faded; an LED no flood
  // has coloured is all but dark, and a flood front glows 70 brighter.
  hsv(wheel(hu + 0.2), 0.85, 1, c, 0);
  hsv(wheel(hu + 0.68), 0.75, 1, c2, 0);
  for (let p = 0; p < N; p++) {
    const q = 3 * p, kc = S.cls[p], a = S.paint[p] * 150, g = S.glow[p] * 70;
    const col = kc === 1 ? c : c2;
    let r = 0, gg = 0, b = 0;
    if (kc) (r = col[0] * a + g), (gg = col[1] * a + g), (b = col[2] * a + g);
    else r = gg = b = 8;
    // The curve, white and about 1.7 LEDs wide: an LED's distance to the
    // zero set is |f| over the gradient's length on its triangle.
    const t = S.LT[p], dd = abs(S.f[p]) / S.gt[t], k = cl2(1 - dd / 0.85);
    o[q] = r + (235 - r) * k, o[q + 1] = gg + (235 - gg) * k, o[q + 2] = b + (235 - b) * k;
  }
  // Each probe's ray, a pale line no brighter than the curve; its
  // crossings as gold beads on the curve; its count as gold pips along the
  // top, one row a probe; the probe a white cross.
  for (const P of S.probes) {
    const dx = cos(P.ray), dy = sin(P.ray);
    for (let t = 1.5; t < P.tmax; t += 0.5) lift(S, P.sx + dx * t, P.sy + dy * t, 150);
    for (const t of P.hits) {
      const x = P.sx + dx * t, y = P.sy + dy * t;
      for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(S, x + ex, y + ey, 190, 120, 10);
      put(S, x, y, 255, 200, 40);
    }
    for (let i = 0; i < P.hits.length; i++) put(S, 2 + 2 * (i % 30), 1 + 2 * P.i + 8 * floor(i / 30), 255, 200, 40);
    for (const [ex, ey] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) put(S, P.sx + ex, P.sy + ey, 255, 255, 255);
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, min(255, round(o[p])), min(255, round(o[p + 1])), min(255, round(o[p + 2])));
}
const cl2 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
