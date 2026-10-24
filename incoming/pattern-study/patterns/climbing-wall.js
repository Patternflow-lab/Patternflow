// ===== Patternflow pattern =====
// Title:   Climbing Wall
// Family:  sport
// Idea:    A gym's lead wall seen straight on, plywood set with routes of coloured holds: a climber moves hand and foot up hers in a follow spot, clips each quickdraw and the anchor, is lowered off, and once the rope is pulled through she and her belayer swap places.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 27, after an indoor lead-climbing wall
// Round:   27
// ===============================
// @matrix 64x128
// @knobs Route=0..1, Speed=0.2..3, Climbers=1..3, Light=-1..1
//
// Knob 1: Route. The colour she climbs: green at 0, then yellow, blue, pink, orange and purple at 1. She moves to its lane; her spot and the house lights take a little of its colour.
// Knob 2: Speed. At 2 a hand or foot move takes a third of a second and a climb from the mat to the anchor half a minute; 0.2 is ten times slower, and she opens lower on the wall.
// Knob 3: Climbers. One rope party at 1, two or three side by side, each a climber and a belayer on a rope of its own colour.
// Knob 4: Light. House lights full at -1. At 0 an evening session, the lights turned down and a follow spot on each climber; at 1 only the spots, and the holds and slings glow under UV tubes.
// Buttons: K1 tap: the climber comes off. The rope catches her below her last quickdraw with a soft bounce that lifts her belayer off the mat, and she climbs back on.


const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, sin, cos, sqrt, abs, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const ease = (u) => ((u = cl(u, 0, 1)), u * u * (3 - 2 * u));
const hyp = (x, y) => sqrt(x * x + y * y), F32 = (n) => new Float32Array(n);
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const blend = (o, c, k, a) => {
  for (let j = 0; j < 3; j++) F[o + j] += (c[j] * k - F[o + j]) * a;
};
const hash = (i, j) => ((Math.imul(i * 7919 + j * 104729 + 17, 2654435761) >>> 8) & 1023) / 1024;

// Rows of the mat and the kickboard. Each lane's bolt line LX: eight quickdraws
// (the rope runs CLP under the bolt) and a lower-off ring.
const FL = 121, FT = FL - 0.5, KICK = 117, LX = [11, 32, 53], BOLT = [95, 84, 73, 62, 51, 40, 29, 18], CLP = 3.5, RING = 11;
// A route: NH hand holds HS rows apart, left and right in turn, a foot chip
// CHIP rows under each. A lane has two routes, one each side of its bolts.
const NH = 20, HY0 = 105, HS = 5, CHIP = 15;
// The body in LEDs: arm, forearm, thigh, shin, hip to shoulders; hips standing.
const UA = 4.1, FA = 4.1, TH = 4.8, SN = 4.8, TOR = 6, STAND = FL - 10.05;
// Route colours in Route's order with the lane and side each is set on.
const RC = "3ceb6e ffd41e 288cff ff46aa ff7614 af5fff".split(" ").map(hex);
const RL = [1, 2, 0, 1, 2, 0], RS = [-1, -1, -1, 1, 1, 1], ROUTE = [[2, 5], [0, 3], [1, 4]];
const rcx = (r) => LX[RL[r]] + 0.5 + RS[r] * 5;
const lane = (P) => LX[P.l] + 0.5, bxOf = (P) => lane(P) - RS[P.r] * 3.5;
// A rope a lane, two people a party: skin, hair, top, tights, harness, shoes,
// chalk bag, 1 for a ponytail.
const ROPE = "46d7ff ff7828 beff46".split(" ").map(hex);
const OUT = [
  "ecac84 c86032 ff6054 968cc4 ffc81e 8246d2 e6283c 1", "c88c64 ebc878 f5f5f0 3c60b4 96e628 f05a28 2878e6 0",
  "ecb088 60301a 1ec8cd acb2c4 ff4696 464650 fad228 1", "a06e50 bebec4 facd32 466ed2 e63278 3c8cf0 3cb450 0",
  "ecac84 f0dcaa 965ff0 c8c8ce ffc81e 288cf0 f0f0f0 1", "be825f 281e1a 46c864 a03c54 ff5a28 ebebeb c83cc8 0",
].map((s) => s.split(" ").map((h, i) => (i < 7 ? hex(h) : +h)));

// The wall is built once, with the house light on it in L0.
const AL = F32(N * 3), EM = F32(N * 3), L0 = F32(N), MK = new Uint8Array(N);
const HX = F32(6 * NH), HY = F32(6 * NH), CX = F32(6 * NH), CY = F32(6 * NH);
// Jug, crimp, sloper, pinch, big jug: LEDs as digit pairs, column + 2, row + 1.
const SHAPES = ["112131122232", "112131", "2011213122", "203021312232", "1020300111213141122232"];
// Volumes, pyramids on a diamond: middle, half width, half height, colour.
const VOL = [[21.5, 46, 4.5, 7, "9698a2"], [43, 84, 4.5, 6.5, "3c969c"], [21.5, 100, 4, 5, "c49664"], [43, 26, 4, 6, "d6d6dc"], [1, 70, 3.5, 8, "785496"], [63, 52, 3.5, 7, "9698a2"]];
const STEEL = "bebec8 ece8de dcd8d0 aab0bc".split(" ").map(hex);
// Colour c times k on the wall, e of it glowing under UV.
function px(x, y, c, k, e) {
  if (x < 0 || x >= W || y < 4 || y >= FL) return;
  for (let j = 0, o = (y * W + x) * 3; j < 3; j++) (AL[o + j] = min(255, c[j] * k)), (EM[o + j] = AL[o + j] * e);
  MK[y * W + x] = 1;
}
function shade(x, y, k) {
  if (x < 0 || x >= W || y < 4 || y >= FL || MK[y * W + x]) return;
  for (let c = 0, o = (y * W + x) * 3; c < 3; c++) AL[o + c] *= k;
}
// A hold, lit from above, and its shadow.
function hold(x, y, t, c) {
  const S = SHAPES[t];
  for (let j = 0; j < S.length; j += 2) shade(x + +S[j] - 2, y + +S[j + 1], 0.5), shade(x + +S[j] - 1, y + +S[j + 1], 0.72);
  for (let j = 0; j < S.length; j += 2) px(x + +S[j] - 2, y + +S[j + 1] - 1, c, [1.22, 1.08, 0.78][S[j + 1]] - 0.06 * (S[j] - 2), 0.55);
}
(function build() {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 3;
      let r, g, b, L = 0.85, e = 0;
      if (y < 4) {
        // The ceiling: a truss, a lamp over each lane that is also a UV tube.
        r = g = b = y === 1 ? ((x + 1) % 6 < 2 ? 56 : 32) : y ? 9 : 14;
        for (const l of LX) if ((y === 2 && abs(x - l) < 2) || (y === 3 && x === l)) (e = x === l ? 1 : 0.6), (r = 255 * e), (g = 238 * e), (b = 210 * e);
        (L = 1.47), (EM[o] = 175 * e), (EM[o + 1] = 100 * e), (EM[o + 2] = 255 * e);
      } else if (y < FL) {
        // Plywood sheets 12 by 23, grain running up them. Seams and T-nuts darken it.
        const qx = floor((x + 6) / 12), qy = floor((y - 4) / 23);
        let k = (0.86 + 0.18 * hash(qx + 3, qy + 7)) * (0.9 + 0.14 * hash(x, qy) * (0.6 + 0.4 * sin(y * 0.2 + x)));
        if ((x + 6) % 12 === 0 || (y - 4) % 23 === 22) k *= 0.62;
        if (y % 4 === 1 && (x + (y >> 2) * 2) % 4 === 0) k *= 0.84;
        if (y >= KICK) (k = y === KICK ? 0.7 : 1), (r = 50 * k), (g = 50 * k), (b = 56 * k);
        else (r = 132 * k), (g = 101 * k), (b = 70 * k);
        // Lamp light fanning down from the top, a wash over the floor.
        L = 0.62 + 0.4 * ease((y - 86) / 34);
        for (const l of LX) L += 0.95 * exp(-(((x - l) / (1.5 + 0.28 * y)) ** 2) - (y - 4) / 34) * ease((y - 3) / 6);
      } else {
        // Blue foam mats with seams; the front lip catches the light.
        const k = (x % 16 === 7 ? 0.6 : 1) * (y === FL ? 1.35 : 0.88 + 0.03 * (y - FL));
        (r = 34 * k), (g = 62 * k), (b = 140 * k);
      }
      (AL[o] = r), (AL[o + 1] = g), (AL[o + 2] = b), (L0[i] = L);
    }
  for (const [cx, cy, w, h, c] of VOL)
    for (let y = floor(cy - h); y <= cy + h; y++)
      for (let x = floor(cx - w); x <= cx + w; x++) {
        const dx = (x + 0.5 - cx) / w, dy = (y + 0.5 - cy) / h;
        if (abs(dx) + abs(dy) <= 1) px(x, y, hex(c), (dy < 0 ? 1.1 : 0.62) + (dx < 0 ? 0.08 : -0.12), 0.08);
      }
  for (let y = FL - 1; y > 4; y--) for (let x = 0; x < W; x++) if (MK[(y - 1) * W + x] && !MK[y * W + x]) shade(x, y, 0.55);
  MK.fill(0);
  for (let k = 0; k < 6 * NH; k++) {
    const r = floor(k / NH), i = k % NH, s = i & 1 ? 1 : -1, c = RC[r];
    HX[k] = round(rcx(r) - 0.5 + s * (s === RS[r] ? 3.4 + 1.2 * hash(r, i) : 3 + 0.5 * hash(r, i)));
    HY[k] = round(HY0 - HS * i + (hash(r + 5, i) - 0.5) * 1.6);
    (CX[k] = round(HX[k] + s * 0.6 - 0.5)), (CY[k] = HY[k] + CHIP);
    // The two start holds are taped.
    hold(HX[k], HY[k], i < 2 ? 0 : i === NH - 1 ? 4 : floor(hash(k, 11) * 5), c);
    if (i < 2) for (let j = 2; j < 4; j++) px(HX[k] + s * j, HY[k] + j - 1, c, 0.8, 0.5);
  }
  // Quickdraws, a white sling between hanger and carabiner, and the anchors.
  for (const l of LX) {
    for (const b of BOLT) for (let j = 0; j < 4; j++) px(l, b + j, STEEL[j], 1, j % 3 ? 0.7 : 0.1);
    px(l - 1, 8, STEEL[0], 1, 0.1), px(l + 1, 8, STEEL[0], 1, 0.1), px(l, 9, STEEL[3], 1, 0.1), px(l, 10, STEEL[1], 1, 0.4);
  }
})();

// A plan step: limb (hands 0 1, feet 2 3, 4 waits), target, which, seconds,
// then what; LOOP brings the rope up with the hand.
const HOLD = 0, CHIPT = 1, BAG = 2, HARN = 3, DRAW = 4, ANCHOR = 5;
const PUFF = 1, CLIP = 2, ANCH = 3, GRAB = 4, LOOP = 5;
const START = 0, CLIMB = 1, LOWER = 2, LAND = 3, PULL = 4, SWAP = 5, FALL = 6;
const PC = 96, PRE = [17, 31, 4.5], SRX = 17, SRY = 28, TG = F32(2);

const party = (l) => ({ l, r: ROUTE[l][0], on: 0, c: 0, pt: 0, lhx: 0, lvx: 0, E: F32(8), plan: [], bl: 0, feed: 0, len: 0, pa: 0, pv: 0 });

export function setup(params) {
  params.s = { P: [0, 1, 2].map(party), F: F32(N * 3), LB: F32(N * 3), pc: F32(PC * 5), init: 0, k4: 0.06, r0: 0, t: 0 };
}

function target(P, kind, k) {
  const R = P.r * NH + k;
  if (kind === HOLD) (TG[0] = HX[R] + 0.5), (TG[1] = HY[R] + 0.2);
  else if (kind === CHIPT) (TG[0] = CX[R] + 1), (TG[1] = CY[R] + 0.1);
  else if (kind < DRAW) (TG[0] = P.hx + (kind === BAG ? 0.4 : 0)), (TG[1] = P.hy - (kind === BAG ? 0.6 : 1.2));
  else (TG[0] = lane(P)), (TG[1] = kind === DRAW ? BOLT[k] + CLP : RING);
}
function aim(E, k, ...T) {
  for (let j = 0; j < 8; j++) E[j] += (T[j] - E[j]) * k;
}

function enter(P, ph) {
  (P.ph = ph), (P.pt = 0), (P.plan.length = 0), (P.mv = -1);
  if (ph !== START) return;
  // Chalk each hand and set it on a taped start hold, then step on.
  Object.assign(P, { hx: rcx(P.r), hy: STAND, iL: 0, iR: 1, seq: 0, nc: 0, anc: 0, loop: 0, hm: 0, vx: 0, vy: 0 });
  P.E.set([P.hx - 2.5, STAND + 1, P.hx + 2.5, STAND + 1, P.hx - 1.15, FT, P.hx + 1.15, FT]);
  for (const h of [0, 1]) P.plan.push([h, BAG, 0, 0.3], [4, 0, 0, 0.22, PUFF], [h, HOLD, h, 0.42, GRAB]);
  P.plan.push([2, CHIPT, 0, 0.32], [3, CHIPT, 1, 0.32], [4, 0, 0, 0.2]);
}

function puff(S, x, y, n, sp) {
  const p = S.pc, R = Math.random;
  for (let k = 0; k < PC * 5 && n > 0; k += 5) if (p[k + 4] <= 0) (p[k] = x), (p[k + 1] = y), (p[k + 2] = (R() - 0.5) * 8 * sp), (p[k + 3] = (R() - 0.75) * 5 * sp), (p[k + 4] = 0.6 + 0.6 * R()), n--;
}

function advance(S, P, d) {
  const E = P.E, m = P.mv, te = P.te;
  P.u += d / P.dur;
  if (m < 4) {
    target(P, P.mk, P.mi);
    const e = ease(P.u), a = sin(PI * min(1, P.u));
    E[m * 2] = mix(P.m0x, TG[0], e) + (m & 1 ? a : -a) * (m < 2 ? 0.9 : 1.4);
    E[m * 2 + 1] = mix(P.m0y, TG[1], e) - a * 0.7;
  }
  if (P.u < 1) return;
  P.mv = -1;
  if (te === PUFF) puff(S, P.hx + 0.4, P.hy - 0.8, 8, 1);
  else if (te === GRAB && Math.random() < 0.4) puff(S, E[m * 2], E[m * 2 + 1], 2, 0.4);
  else if (te === CLIP) P.nc++, (P.loop = 0);
  else if (te === ANCH) (P.anc = 1), (P.loop = 0), enter(P, LOWER);
}

// Clip a draw level with her chest or the anchor at the top; else step a foot
// up, then reach with that side's hand.
function decide(P) {
  const R = P.r * NH, pl = P.plan;
  if (P.nc < 8 && BOLT[P.nc] + CLP > P.hy - TOR - 1.5) {
    const h = HY[R + P.iL] > HY[R + P.iR] ? 0 : 1;
    pl.push([h, HARN, 0, 0.22], [h, DRAW, P.nc, 0.3, 0, LOOP], [4, 0, 0, 0.16, CLIP], [h, HOLD, h ? P.iR : P.iL, 0.24, GRAB]);
  } else if (P.iL + 2 >= NH && P.iR + 2 >= NH) pl.push([1, HARN, 0, 0.22], [1, ANCHOR, 0, 0.36, 0, LOOP], [4, 0, 0, 0.3, ANCH]);
  else {
    const q = P.seq, h = q < 2 ? 0 : 1, k = (h ? P.iR : P.iL) + 2;
    P.seq = (q + 1) & 3;
    if (k >= NH) return;
    if (!(q & 1)) return pl.push([2 + h, CHIPT, k, 0.28], [4, 0, 0, 0.06]);
    if (P.hm++ % 3 === 2) pl.push([h, BAG, 0, 0.24], [4, 0, 0, 0.22, PUFF]);
    pl.push([h, HOLD, k, 0.34, GRAB], [4, 0, 0, 0.08]);
    h ? (P.iR = k) : (P.iL = k);
  }
}

// Back on after a fall or a change of route: the holds nearest her hips.
function rejoin(P) {
  const R = P.r * NH;
  let i = 0;
  for (let j = 2; j + 1 < NH; j += 2) if (abs(CY[R + j] + CY[R + j + 1] - 12 - 2 * P.hy) < abs(CY[R + i] + CY[R + i + 1] - 12 - 2 * P.hy)) i = j;
  enter(P, CLIMB);
  Object.assign(P, { iL: i, iR: i + 1, seq: 0, loop: 0, vx: 0, vy: 0 });
  P.plan.push([1, HOLD, i + 1, 0.45, GRAB], [0, HOLD, i, 0.45, GRAB], [3, CHIPT, i + 1, 0.35], [2, CHIPT, i, 0.35], [4, 0, 0, 0.3]);
}
function fall(P) {
  if (P.ph !== CLIMB) return;
  P.R = P.nc ? hyp(P.hx - LX[P.l] - 0.5, P.hy - 1 - BOLT[P.nc - 1] - CLP) + 3 + (P.loop ? 4 : 0) : 0;
  enter(P, FALL);
  (P.vy = -8), (P.vx = 0), (P.loop = 0);
}

// The rope from the guide hand through the clipped draws to the climber.
const RP = F32(48);
let RLEN = 0;
function path(P, gx, gy) {
  let n = 0;
  RLEN = 0;
  const put = (x, y) => ((RP[n++] = x), (RP[n++] = y));
  put(gx, gy);
  for (let j = 0; j < P.nc; j++) put(lane(P), BOLT[j] + CLP);
  if (P.anc) put(lane(P), RING);
  if (P.ph === PULL) put(P.ex, P.ey);
  else {
    if (P.loop) put(P.E[P.loop * 2 - 2], P.E[P.loop * 2 - 1]);
    put(P.hx, P.hy - 1);
  }
  for (let j = 2; j < n; j += 2) RLEN += hyp(RP[j] - RP[j - 2], RP[j + 1] - RP[j - 1]);
  return n >> 1;
}

function stepParty(S, P, d) {
  P.pt += d;
  const E = P.E, ph = P.ph, x = P.hx, y = P.hy, k = 1 - exp(-d * 9);
  if (ph <= CLIMB) {
    if (P.mv >= 0) advance(S, P, d);
    if (P.mv < 0 && P.ph === ph) {
      const it = P.plan.shift();
      if (it) {
        (P.mv = it[0]), (P.mk = it[1]), (P.mi = it[2]), (P.dur = it[3]), (P.te = it[4] || 0), (P.u = 0);
        if (P.mv < 4) (P.m0x = E[P.mv * 2]), (P.m0y = E[P.mv * 2 + 1]);
        if (it[5] === LOOP) P.loop = P.mv + 1;
      } else if (ph === START) P.ph = CLIMB;
      else decide(P);
    }
    // Hips where all four limbs reach, hanging on the arms and off the moving one.
    const lo = max(E[5], E[7]) - 9.3, hi = min(E[1], E[3]) + 8 + TOR;
    let ty = ((E[5] + E[7]) / 2 - 7 + hi) / 2, tx = 0.55 * ((E[4] + E[6]) / 2) + 0.45 * ((E[0] + E[2]) / 2);
    ty = lo <= hi ? cl(ty, lo, hi) : (lo + hi) / 2;
    if (P.mv >= 0 && P.mv < 4) tx -= (P.mv & 1 ? 1 : -1) * 0.7;
    if (P.ph === ph) (P.hx += (tx - x) * k), (P.hy += (ty - y) * k);
  } else if (ph === LOWER) {
    // Sat in her harness and walking her feet down the wall.
    P.hy = min(STAND, y + 12 * d * ease(P.pt * 1.5));
    P.hx += (rcx(P.r) - x) * (1 - exp(-d * 1.5));
    const f = P.hy * 0.45;
    aim(E, k, x - 0.4, y - TOR - 1.8, x + 0.6, y - TOR - 3.6, x - 3.2, y + 5.3 - 1.6 * max(0, sin(f)), x + 3.2, y + 5.3 - 1.6 * max(0, -sin(f)));
    if (P.hy >= STAND - 0.01) enter(P, LAND);
  } else if (ph === LAND || ph === PULL) {
    // Down, she unties and the belayer pulls the rope through.
    P.hy += (STAND - y) * k;
    const u = ph === LAND && P.pt > 0.5 && P.pt < 1.3;
    aim(E, k, x + (u ? -0.8 : -2.5), y + (u ? -1 : 1), x + (u ? 0.8 : 2.5), y + (u ? -1.3 : 1), x - 1.15, FT, x + 1.15, FT);
    if (ph === LAND && P.pt > 1.4) enter(P, PULL), (P.ex = x), (P.ey = y - 1), (P.pull = 0);
    if (ph === PULL && (P.pull += 110 * d) > P.len + 2) enter(P, SWAP);
  } else if (ph === SWAP) {
    if (P.pt > 1.6) (P.c ^= 1), enter(P, START);
  } else {
    // Falling until the rope from the last draw comes tight, a stretchy catch.
    P.vy += 150 * d;
    if (P.nc) {
      const dx = x - LX[P.l] - 0.5, dy = y - 1 - BOLT[P.nc - 1] - CLP, L = hyp(dx, dy) + 1e-6, e = L - P.R;
      if (e > 0) {
        const ux = dx / L, uy = dy / L, f = (80 * e + 8 * (P.vx * ux + P.vy * uy)) * d;
        (P.vx -= f * ux), (P.vy -= f * uy), (P.bl = max(P.bl, min(3, e)));
      }
    }
    (P.hx += P.vx * d), (P.hy += P.vy * d);
    if (P.hy >= STAND) {
      (P.hy = STAND), (P.vy = P.vx = 0);
      if (!P.nc) return enter(P, START);
    }
    const fl = P.pt < 0.45, X = P.hx, Y = P.hy - TOR;
    aim(E, 1 - exp(-d * (fl ? 6 : 4)), X - (fl ? 3.2 : 0.4), Y - (fl ? 4.5 : 2.5), X + (fl ? 3.2 : 0.5), Y - (fl ? 4.5 : 4.2), X - 2.7, P.hy + (fl ? 7.5 : 4.4), X + 2.7, P.hy + (fl ? 7 : 4.4));
    if (P.pt > 2.4) rejoin(P);
  }
  P.bl *= exp(-d * 1.8);
  // Rope paid out moves the belayer's guide hand; the ponytail swings.
  const L = (path(P, bxOf(P), STAND - 4), RLEN), vx = (P.hx - P.lhx) / max(d, 1e-4);
  if (P.ph <= CLIMB) P.feed += abs(L - P.len);
  if (P.ph !== PULL) P.len = L;
  P.pv += (-28 * P.pa - 2.6 * P.pv) * d - cl(vx - P.lvx, -20, 20) * 0.04;
  (P.pa = cl(P.pa + P.pv * d, -1, 1)), (P.lhx = P.hx), (P.lvx = vx);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const r0 = min(5, floor(cl(k[0], 0, 1) * 6)), np = round(cl(k[2], 1, 3)), l0 = RL[r0], sp = cl(k[1], 0.2, 3);
  (S.k4 = cl(k[3], -1, 1)), (S.r0 = r0);
  for (const P of S.P) {
    const r = P.l === l0 ? r0 : ROUTE[P.l][RS[r0] > 0 ? 1 : 0], j = (P.l - l0 + 3) % 3;
    if (j >= np) P.on = 0;
    else if (!P.on) {
      (P.on = 1), (P.r = r), enter(P, START);
      // Each party opens some way into its climb, further at a faster Speed.
      if (!S.init) for (let n = PRE[j] * 30; n > 0; n--) stepParty(S, P, (sp / 2) ** 1.6 / 30);
    } else if (P.r !== r) (P.r = r), P.ph === CLIMB ? rejoin(P) : P.ph === START && enter(P, START);
  }
  if (!S.init) S.pc.fill(0), (S.init = 1);
  if (input.btnPressed && input.btnPressed[0]) fall(S.P[l0]);
  const d = (cl(dt || 0, 0, 0.1) * sp) / 2, p = S.pc;
  S.t += d;
  for (const P of S.P) if (P.on) stepParty(S, P, d);
  for (let j = 0, e = exp(-2 * d); j < PC * 5; j += 5) if (p[j + 4] > 0) (p[j] += p[j + 2] * d), (p[j + 1] += p[j + 3] * d), (p[j + 2] *= e), (p[j + 3] = p[j + 3] * e + 2 * d), (p[j + 4] -= 0.6 * d);
}

let F = null, LB = null;
function splat(x, y, c, k, a) {
  const ix = floor(x - 0.5), iy = floor(y - 0.5), fx = x - 0.5 - ix, fy = y - 0.5 - iy;
  for (let j = 0; j < 4; j++) {
    const xx = ix + (j & 1), yy = iy + (j >> 1);
    if (xx >= 0 && xx < W && yy >= 0 && yy < H) blend((yy * W + xx) * 3, c, k, (j & 1 ? fx : 1 - fx) * (j >> 1 ? fy : 1 - fy) * a);
  }
}
const lightAt = (x, y) => {
  const o = (cl(floor(y), 0, H - 1) * W + cl(floor(x), 0, W - 1)) * 3;
  return cl(0.3 + 0.35 * (LB[o] + LB[o + 1]), 0.62, 1.2);
};
// A rope span, slack spans sagging; the weave's flecks ride with the rope.
function span(x0, y0, x1, y1, sag, s0, lim, rc, lf) {
  const L = hyp(x1 - x0, y1 - y0), n = ceil(L * 2.2) + 1, mx = (x0 + x1) / 2 + sag * 0.3, my = (y0 + y1) / 2 + sag * 2;
  for (let i = 0; i <= n; i++) {
    const u = i / n, s = s0 + u * L, q = s - lim + 1000, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    if (s > lim) break;
    const w = q * 0.2 - floor(q * 0.2) < 0.16;
    splat(a * x0 + b * mx + c * x1, a * y0 + b * my + c * y1, w ? STEEL[1] : rc, w ? lf : (0.74 + 0.26 * cos(q * 2.3)) * lf, 0.9);
  }
  return s0 + L;
}

// A person from behind, facing the wall: hips at hx, hy, hands and feet in E.
const PT = F32(30 * 6), BE = F32(8);
let NP = 0, KX = 0, KY = 0, EX = 0, EY = 0;
const cap = (...a) => (PT.set(a, NP * 6), NP++);
// Two-bone reach; elbows bend out and down, knees out and up.
function ik(ax, ay, bx, by, l1, l2, sg, up) {
  let dx = bx - ax, dy = by - ay, L = hyp(dx, dy) + 1e-6;
  const Lm = l1 + l2 - 0.05;
  if (L > Lm) (bx = ax + (dx / L) * Lm), (by = ay + (dy / L) * Lm), (dx = bx - ax), (dy = by - ay), (L = Lm);
  const a = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = sqrt(max(0, l1 * l1 - a * a)), ux = dx / L, uy = dy / L, f = -uy * sg + up * 0.3 * ux < 0 ? -h : h;
  (KX = ax + ux * a - uy * f), (KY = ay + uy * a + ux * f), (EX = bx), (EY = by);
}
function person(hx, hy, E, o, lf, pa) {
  NP = 0;
  const sx = hx + 0.2 * ((E[0] + E[2]) / 2 - hx), sy = hy - TOR;
  for (let s = -1; s < 2; s += 2) {
    const j = s + 1;
    ik(hx + s * 1.15, hy + 0.4, E[4 + j], E[5 + j], TH, SN, s, -1);
    cap(hx + s * 1.15, hy + 0.4, KX, KY, 1.1, 3), cap(KX, KY, EX, EY, 0.83, 3), cap(EX, EY, EX + s * 0.9, EY + 0.3, 0.7, 5);
  }
  cap(hx - 1.1, hy, hx + 1.1, hy, 1.25, 3), cap(hx, hy - 1, sx, sy + 1, 1.95, 2), cap(sx - 2.2, sy + 0.7, sx + 2.2, sy + 0.7, 1.15, 2);
  cap(hx - 1.8, hy - 1.1, hx + 1.8, hy - 1.1, 0.55, 4), cap(hx + 0.3, hy - 1.2, hx + 0.3, hy - 0.1, 0.8, 6);
  for (let s = -1; s < 2; s += 2) {
    ik(sx + s * 2.3, sy + 0.8, E[s + 1], E[s + 2], UA, FA, s, 1);
    cap(sx + s * 2.3, sy + 0.8, KX, KY, 0.76, 0), cap(KX, KY, EX, EY, 0.64, 0), cap(EX, EY, EX, EY - 0.2, 0.75, 0);
  }
  cap(sx, sy + 0.2, sx, sy - 1.2, 0.7, 0), cap(sx, sy - 3, sx, sy - 3.1, 1.95, 1);
  if (o[7]) cap(sx, sy - 3, sx + 3.7 * sin(pa), sy - 3 + 4.1 * cos(pa), 0.63, 1);
  // A dark rim round her, holds near her greyed, then her.
  for (let pass = 0; pass < 2; pass++)
    for (let y = max(0, floor(hy - 21)); y < min(H, hy + 16); y++)
      for (let x = max(0, floor(hx - 13)); x < min(W, hx + 14); x++) {
        const qx = x + 0.5, qy = y + 0.5, i = (y * W + x) * 3;
        let dm = 9;
        for (let j = 0; j < NP * 6; j += 6) {
          const ax = PT[j], ay = PT[j + 1], dx = PT[j + 2] - ax, dy = PT[j + 3] - ay, r = PT[j + 4];
          if (abs(qx - ax - dx / 2) > abs(dx) / 2 + r + 3 || abs(qy - ay - dy / 2) > abs(dy) / 2 + r + 3) continue;
          const tt = cl(((qx - ax) * dx + (qy - ay) * dy) / (dx * dx + dy * dy + 1e-6), 0, 1), e = hyp(qx - ax - dx * tt, qy - ay - dy * tt) - r;
          if (pass && e < 0.5) blend(i, o[PT[j + 5]], lf, min(1, 0.5 - e));
          dm = min(dm, e);
        }
        const g = ease((dm - 1.3) / 1.4), m = ((F[i] + F[i + 1] + F[i + 2]) / 3) * 0.6;
        if (!pass && g < 1) for (let c = 0; c < 3; c++) F[i + c] = mix(m, F[i + c], g) * (0.25 + 0.75 * g);
      }
}
function walk(x, ph, o, lf) {
  const y = STAND - 0.3 * abs(sin(ph)), s = sin(ph), s2 = sin(ph + 1.6);
  BE.set([x - 2.5 - 0.6 * s, y + 0.8, x + 2.5 - 0.6 * s, y + 0.8, x - 1.3 + 0.8 * s, FT - 1.2 * max(0, cos(ph)), x + 1.3 + 0.8 * s2, FT - 1.2 * max(0, cos(ph + 1.6))]);
  person(x, y, BE, o, lf, 0);
}

// A party: rope pile, rope, climber, then the belayer in front.
function scene(S, P, t) {
  const gs = RS[P.r], bx = bxOf(P), cx = rcx(P.r), A = OUT[P.l * 2 + P.c], B = OUT[P.l * 2 + 1 - P.c], rc = ROPE[P.l];
  const lfB = lightAt(bx, FL - 10), px0 = bx - gs * 2.6;
  for (let j = 0; j < 22; j++) splat(px0 + 2.4 * cos(j * 0.6) * (1 - j * 0.02), FL + 3.2 + 0.9 * sin(j * 0.6), rc, 0.8 * lfB, 0.8);
  if (P.ph === SWAP) {
    const e = ease(P.pt / 1.6), ph = P.pt * 9;
    return walk(mix(cx, bx, e), ph, A, lfB), walk(mix(bx, cx, e), ph + PI, B, lfB);
  }
  // The belayer: guide hand up the rope feeding it out, brake hand low.
  const hy = STAND - P.bl, hx = bx + gs * P.bl * 0.4, gi = gs > 0 ? 2 : 0, bi = 2 - gi;
  let gy = hy - 3.4 - 1.8 * abs(sin(P.feed * 0.35)), by = hy + 0.8;
  if (P.ph === PULL) (gy = hy - 3 - 2.6 * abs(sin(t * 6))), (by = hy - 3 - 2.6 * abs(cos(t * 6)));
  else if (P.ph === LOWER) by = hy + 0.6 + 0.8 * sin(t * 5);
  (BE[gi] = hx + gs * 0.7), (BE[gi + 1] = gy), (BE[bi] = hx - gs * 2.2), (BE[bi + 1] = by);
  (BE[4] = hx - 1.15), (BE[6] = hx + 1.15), (BE[5] = BE[7] = min(FT, hy + 9.5));
  span(BE[bi], by, px0, FL + 2.5, 1.2, 0, 1e9, rc, lightAt(BE[bi], by + 2));
  const n = path(P, BE[gi], gy), lim = RLEN - (P.ph === PULL ? P.pull : 0), taut = P.ph === FALL || P.ph === LOWER || P.ph === PULL;
  for (let j = 1, s = 0; j < n; j++) {
    const sag = j === 1 ? (n === 2 && !taut ? 2.5 : 1.5) : j === n - 1 && !taut ? 1 : 0;
    s = span(RP[j * 2 - 2], RP[j * 2 - 1], RP[j * 2], RP[j * 2 + 1], sag, s, lim, rc, lightAt(RP[j * 2], RP[j * 2 + 1]));
  }
  person(P.hx, P.hy, P.E, A, lightAt(P.hx, P.hy - 4), P.pa);
  person(hx, hy, BE, B, lfB, 0.2);
}

// House light tinted by the route, a follow spot with a gel on each climber.
function light(S) {
  const k = S.k4, hs = k < 0 ? mix(0.68, 1.12, -k) : mix(0.68, 0.06, k), lv = k < 0 ? mix(1, 0.35, -k) : mix(1, 1.2, k), u = max(0, k);
  const T = [1, 0.95, 0.86].map((w, j) => mix(w, RC[S.r0][j] / 255, 0.14) * hs), V = [0.1 * u, 0.04 * u, 0.24 * u];
  for (let o = 0; o < N * 3; o++) LB[o] = L0[(o / 3) | 0] * T[o % 3];
  for (const P of S.P) {
    if (!P.on) continue;
    const sx = P.hx, sy = P.hy - 4, G = [1, 0.96, 0.9].map((w, j) => lv * mix(w, RC[P.r][j] / 255, 0.35));
    for (let y = max(4, floor(sy - SRY)); y < min(FL, sy + SRY); y++)
      for (let x = max(0, floor(sx - SRX)); x < min(W, sx + SRX); x++) {
        const q = ((y + 0.5 - sy) / SRY) ** 2 + ((x + 0.5 - sx) / SRX) ** 2, o = (y * W + x) * 3;
        for (let c = 0; c < 3 && q < 1; c++) LB[o + c] += (1 - q) * (1 - q) * G[c];
      }
  }
  for (let o = 0; o < N * 3; o++) F[o] = AL[o] * (LB[o] + V[o % 3]) + EM[o] * u;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.init) return;
  (F = S.F), (LB = S.LB);
  light(S);
  for (const P of S.P) if (P.on) scene(S, P, S.t);
  const p = S.pc, u = max(0, S.k4);
  for (let j = 0, C = [240, 240 - 40 * u, 236 + 19 * u]; j < PC * 5; j += 5) if (p[j + 4] > 0) splat(p[j], p[j + 1], C, 1, min(1, p[j + 4]) * 0.8);
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
