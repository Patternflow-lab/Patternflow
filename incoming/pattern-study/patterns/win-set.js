// ===== Patternflow pattern =====
// Title:   Win Set
// Family:  agendachaos
// Idea:    Eleven voters drift over a two-dimensional policy space, each preferring every point nearer to their own ideal point than the status quo, so every LED counts the discs through the status quo that cover it, the points that a quota of the voters prefer glow as warm petals that all meet at the status quo, and the status quo hops to a point inside the petals again and again until a quota near unanimity empties them and it freezes.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the median voter in one dimension (Duncan Black, 1948), the spatial model of voting and the empty core of a majority vote in two dimensions (Charles Plott, 1967), the chaos theorem that a sequence of majority amendments can reach any point of the plane (Richard McKelvey, 1976, with Norman Schofield, 1978), the quota above two thirds that always leaves a core in two dimensions (Joseph Greenberg, 1979; Caplin and Nalebuff, 1988), recalled; the petal drawing, the hop and the drift are original, pattern round 271
// Round:   271
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..3, Quota=0..1, Spread=-1..1
//
// Knob 1: Hue. Turns the pair of colours, the cool ground of the points too few voters prefer and the warm petals of the win set, through six settings a fifth of the knob apart: indigo with amber at 0, teal with coral, sea green with rose, violet with lime, plum with gold and azure with mint at 1. Both hues sway a few hundredths round their setting.
// Knob 2: Pace. How fast the status quo hops. A hop of 30 LED glides for 1.5 s at 0.5, 0.74 s at the opening 2 and 0.55 s at 3, and the status quo rests 3 to 5 s, 0.75 to 1.25 s or 0.5 to 0.8 s before the next one.
// Knob 3: Quota. How many of the eleven voters must prefer a point for it to join the win set: 6, a simple majority, at 0, then 7, 8, 9 and 10 at each quarter of the knob, with a blend between whole numbers so a petal fades instead of jumping. In 240 s the status quo sits still with an empty win set for 0 percent of the time at 6, about a third at 7, four fifths at 8 and nine tenths or more at 9 and 10.
// Knob 4: Spread. How far apart the voters sit. At -1 most are within 6 by 12 LED of their middle, the discs are small and the status quo mills among them; at the opening it fills about half of the panel; at 1 most of it, and the petals grow to a third of it.

// What the picture is. Eleven voters sit at ideal points on a 64 x 128 plane, one LED a unit. For a status quo q a voter prefers exactly the points nearer to their ideal point than q is, the disc centred on the voter that passes through q. Each LED is painted by how many of those discs cover it, 0 to 11. Below the quota that count is the ground, deep indigo brightening through blue to teal at one vote short, and each disc's rim is a faint 1.6 LED ring, so the eleven circles through q read as a pencil. At or above the quota the LED is in the win set W(q): amber, going to pale gold where more voters agree. The petals of W(q) all start at q, since every circle passes through it. q is a bright ring with a dark eye, the voters are soft pale glows with a wide bloom, q leaves a white-gold trail that fades in 14 s, the point it will hop to shows as a small ring through the rest, a ring goes out of q when it lands, and a slower one while W(q) is empty.
// The agenda. q rests, then glides in an eased line to a point of W(q), which a quota of the voters prefer to q, so it is an amendment that passes. An agenda setter picks it: the setter has a goal that wanders over the whole panel on rates that do not divide and takes the point of W(q) nearest it, but one hop in eight, or whenever W(q) is under 260 LEDs, takes the point farthest from q, so q does not stay in the thin star W(q) makes near the middle. A hop is 3 LED or more and prefers a point 2 LED inside the set. While W(q) is empty nothing can move q, which looks again every 0.2 s. At 6 of 11 W(q) is a sliver at worst; from 8 of 11, more than two thirds, a core exists and q freezes in it until the drifting voters slide it off q and the win set opens.
// The voters. A sunflower of eleven radii and angles, each voter on its own orbit at 8 to 23 milliradians a second, its radius breathing 26 percent, with a tremble of 1.2 to 4.4 LED (periods 9 to 25 s) on top; the electorate drifts across the panel by up to 16 LED and 33 down and its spread breathes a fifth either way. Voters and q stay 3 LED inside the edge.
// What is exact and what is not. The count, the discs, the quota and the empty win set are the model's: each LED is tested against each voter's disc, the edge faded over 1.5 LED for the drawing, and the hop is chosen from the hard count. The setter and its goal, the eased glide, the drift and the number of voters are drawing choices, as are the colours, the pencil rings, the six soft clouds drifting over the ground, the slow breathing and tilt of the ground and the brighter ground while q is frozen. They keep the picture from coming round.

const W = 64, H = 128, NP = W * H;
const NV = 11;
const { floor, sqrt, sin, cos, exp, min, max, abs, ceil, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Colour pairs for the Hue knob: the hue of the cool ground and of the warm
// petals at six settings. The ground never goes through red or yellow, where
// a dim colour reads brown.
const HC = [0.645, 0.52, 0.41, 0.77, 0.88, 0.58];
const HW = [0.115, 0.025, -0.07, 0.24, 0.135, 0.42];

const SOFT = 1.5;          // LED over which a disc's edge fades
const AX = 28, AY = 58;    // half-axes of the electorate's ellipse at full spread
const NT = 1100;           // longest trail kept, in samples
const TRAILT = 14;         // seconds a trail takes to fade
const LUT = 64;
const GFLOOR = 21;         // the dimmest any channel of the ground may be
const NB = 6;              // clouds drifting over the ground

export function setup(params) {
  const r = () => Math.random();
  const PR = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
  const S = (params.s = {
    r, T: 0, Tv: 0, init: false,
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06],
    r0: new Float64Array(NV), ph: new Float64Array(NV), om: new Float64Array(NV),
    kp: new Float64Array(NV), ps: new Float64Array(NV), wk: new Float64Array(NV * 2), wp: new Float64Array(NV * 2), land: -9, zx: 32, zy: 64,
    vx: new Float64Array(NV), vy: new Float64Array(NV),
    qx: 0, qy: 0, fx: 0, fy: 0, tx: 0, ty: 0, hasT: false, mode: 0, g: 0, gt: 1, rest: 1, froze: 0, tin: 0,
    trail: new Float32Array(NT * 3), nt: 0,
    C: new Float32Array(NP), CW: new Float32Array(NP), RA: new Float32Array(NP), Ch: new Uint8Array(NP),
    cmax: 5, lw: 14,
    buf: new Float32Array(NP * 3), tr: new Float32Array(NP), ts: new Float32Array(NP),
    cool: new Float32Array(LUT * 3), warm: new Float32Array(LUT * 3), tmp: [0, 0, 0],
  });
  const a0 = r() * TAU;
  for (let i = 0; i < NV; i++) {
    S.r0[i] = (0.2 + 0.78 * sqrt((i + 0.5) / NV)) * (0.9 + 0.2 * r());
    S.ph[i] = a0 + i * 2.399963 + 0.5 * (r() - 0.5);
    const fr = sqrt(PR[(i * 7 + 3) % PR.length] + 0.37);
    S.om[i] = (r() < 0.5 ? -1 : 1) * (0.008 + 0.015 * (fr - floor(fr)));
    const f2 = sqrt(PR[(i * 5 + 1) % PR.length] + 0.71);
    S.kp[i] = 0.035 + 0.05 * (f2 - floor(f2));
    S.ps[i] = r() * TAU;
    for (let j = 0; j < 2; j++) {
      S.wk[i * 2 + j] = 0.25 + 0.45 * r();
      S.wp[i * 2 + j] = r() * TAU;
    }
  }
  S.qx = 20 + 24 * r();
  S.qy = 44 + 40 * r();
  return S;
}

// Where the voters are at their own clock Tv, with the spread sf.
function place(S, sf) {
  const Tv = S.Tv;
  // the whole electorate drifts about the panel, so its middle never stays put
  const cs = 0.25 + 0.75 * sf;
  const ox = cs * (6 * (sin(0.0371 * Tv + S.ps[4]) - sin(S.ps[4])) + 2 * (sin(0.0913 * Tv + S.ps[5]) - sin(S.ps[5])));
  const oy = cs * (13 * (sin(0.0293 * Tv + S.ps[6]) - sin(S.ps[6])) + 3.5 * (sin(0.0771 * Tv + S.ps[7]) - sin(S.ps[7])));
  for (let i = 0; i < NV; i++) {
    const rr = S.r0[i] * (1 + 0.26 * sin(S.kp[i] * Tv + S.ps[i]));
    const th = S.ph[i] + S.om[i] * Tv;
    const aw = 1.2 + 3.2 * sf;
    S.vx[i] = cl(32 + ox + sf * AX * rr * cos(th) + aw * sin(S.wk[i * 2] * S.T + S.wp[i * 2]), 3, 61);
    S.vy[i] = cl(64 + oy + sf * AY * rr * sin(th) + aw * sin(S.wk[i * 2 + 1] * S.T + S.wp[i * 2 + 1]), 3, 125);
  }
}

// The number of voters that prefer (x, y) to the status quo.
function countAt(S, x, y) {
  let c = 0;
  for (let i = 0; i < NV; i++) {
    const ax = S.qx - S.vx[i], ay = S.qy - S.vy[i], bx = x - S.vx[i], by = y - S.vy[i];
    if (bx * bx + by * by < ax * ax + ay * ay) c++;
  }
  return c;
}

// Hard counts for every LED, for choosing where to hop.
function hardField(S) {
  const Ch = S.Ch;
  Ch.fill(0);
  for (let i = 0; i < NV; i++) {
    const vx = S.vx[i], vy = S.vy[i], ax = S.qx - vx, ay = S.qy - vy, R2 = ax * ax + ay * ay;
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - vy, rem = R2 - dy * dy;
      if (rem <= 0) continue;
      const hw = sqrt(rem);
      const x0 = max(0, ceil(vx - hw - 0.5)), x1 = min(W - 1, floor(vx + hw - 0.5));
      for (let x = x0; x <= x1; x++) Ch[y * W + x]++;
    }
  }
}

// Pick a point inside the win set. An agenda setter with a goal z that wanders
// over the panel takes, of a handful of points of the set, the one nearest z,
// and once in five a far hop instead. Returns false if the set is empty.
function pickTarget(S, quota) {
  hardField(S);
  const Ch = S.Ch, cand = S.cand || (S.cand = new Int32Array(NP));
  let n = 0;
  for (let y = 3; y < H - 3; y++)
    for (let x = 3; x < W - 3; x++) {
      if (Ch[y * W + x] < quota) continue;
      const dx = x + 0.5 - S.qx, dy = y + 0.5 - S.qy;
      if (dx * dx + dy * dy < 9) continue;
      cand[n++] = y * W + x;
    }
  if (n < 1) return false;
  // score every point of the set, then take the best that is not on the very
  // edge of a petal; a little noise keeps two hops from the same place apart
  const r = S.r, far = r() < 0.12 || n < 260, sco = S.sco || (S.sco = new Float32Array(NP));
  for (let j = 0; j < n; j++) {
    const p = cand[j], x = p % W + 0.5, y = floor(p / W) + 0.5;
    sco[j] = far ? -((x - S.qx) * (x - S.qx) + (y - S.qy) * (y - S.qy)) * (0.6 + 0.8 * r())
      : (x - S.zx) * (x - S.zx) + (y - S.zy) * (y - S.zy) + 40 * r();
  }
  let best = -1;
  for (let a = 0; a < 10; a++) {
    let bj = -1, bs = 1e12;
    for (let j = 0; j < n; j++) if (sco[j] < bs) { bs = sco[j]; bj = j; }
    sco[bj] = 1e13;
    const p = cand[bj], x = p % W + 0.5, y = floor(p / W) + 0.5;
    if (best < 0) best = p;
    if (countAt(S, x + 2, y) >= quota && countAt(S, x - 2, y) >= quota && countAt(S, x, y + 2) >= quota && countAt(S, x, y - 2) >= quota) { best = p; break; }
  }
  S.tx = best % W + 0.5;
  S.ty = floor(best / W) + 0.5;
  return true;
}

// One step of the agenda: rest, pick a point of the win set, glide there.
function agenda(S, dt, pace, quota) {
  const r = S.r;
  if (S.mode === 0) {
    S.rest -= dt;
    if (!S.hasT) {
      S.tin = 0;
      if (S.rest <= 0) {
        S.hasT = pickTarget(S, quota);
        S.rest = S.hasT ? 0.5 + 1.5 / pace : 0.2;
      }
      S.froze += (1 - S.froze) * (1 - exp(-dt / 0.5));
    } else {
      S.froze += (0 - S.froze) * (1 - exp(-dt / 0.5));
      S.tin += dt;
      if (S.rest <= 0) {
        // is the point still in the win set after the drift? if not, look again
        if (countAt(S, S.tx, S.ty) < quota) {
          S.hasT = pickTarget(S, quota);
          S.rest = S.hasT ? 0.3 : 0.2;
          return;
        }
        S.mode = 1;
        S.g = 0;
        S.fx = S.qx;
        S.fy = S.qy;
        const dist = sqrt((S.tx - S.qx) * (S.tx - S.qx) + (S.ty - S.qy) * (S.ty - S.qy));
        S.gt = (0.9 + 0.007 * dist) / (0.5 + 0.5 * pace);
      }
    }
  } else {
    S.g += dt / S.gt;
    const g = S.g >= 1 ? 1 : S.g, e = g * g * (3 - 2 * g);
    const nx = mix(S.fx, S.tx, e), ny = mix(S.fy, S.ty, e);
    // leave a trail every 0.7 LED of path
    const lx = S.nt ? S.trail[(S.nt - 1) * 3] : S.qx, ly = S.nt ? S.trail[(S.nt - 1) * 3 + 1] : S.qy;
    const seg = sqrt((nx - lx) * (nx - lx) + (ny - ly) * (ny - ly));
    if (seg >= 0.7 || !S.nt) {
      const steps = max(1, floor(seg / 0.7));
      for (let s = 1; s <= steps; s++) {
        const u = s / steps;
        if (S.nt >= NT) {
          S.trail.copyWithin(0, 3, NT * 3);
          S.nt = NT - 1;
        }
        S.trail[S.nt * 3] = mix(lx, nx, u);
        S.trail[S.nt * 3 + 1] = mix(ly, ny, u);
        S.trail[S.nt * 3 + 2] = S.T;
        S.nt++;
      }
    }
    S.qx = nx;
    S.qy = ny;
    if (S.g >= 1) {
      S.mode = 0;
      S.hasT = false;
      S.rest = 0;
      S.land = S.T;
      // the next point is chosen on landing, so it shows during the rest
      S.hasT = pickTarget(S, quota);
      S.rest = S.hasT ? (1.5 + 1.0 * r()) / pace : 0.2;
      S.tin = 0;
    }
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = (input && input.knobValues) || S.k;
  for (let i = 0; i < 4; i++) S.k[i] = Number.isFinite(kv[i]) ? kv[i] : S.k[i];
  dt = cl(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  if (!S.init) {
    S.init = true;
    for (let i = 0; i < 4; i++) S.ks[i] = S.k[i];
    // run the agenda for a while so the trail and the voters are already under way
    const pre = 8, h = 1 / 15;
    for (let t = 0; t < pre; t += h) step(S, h);
  }
  const a = 1 - exp(-dt / 0.15);
  for (let i = 0; i < 4; i++) S.ks[i] += (S.k[i] - S.ks[i]) * a;
  step(S, dt);
  field(S);
}

function step(S, dt) {
  const k = S.ks;
  const pace = cl(k[1], 0.5, 3), u = (cl(k[3], -1, 1) + 1) / 2;
  // the quota steps 6, 7, 8, 9, 10 with a short blend between, so that a petal
  // fades rather than jumps as the knob passes a whole number
  const xq = 4 * cl(k[2], 0, 1), fq = xq - floor(xq), Qr = 5.5 + min(4, floor(xq) + sm((fq - 0.3) / 0.4));
  const sf = (0.3 + 0.7 * Math.pow(u, 0.8)) * (1 + 0.14 * sin(0.047 * S.T + S.ps[4]) + 0.08 * sin(0.083 * S.T + S.ps[5]));
  S.T += dt;
  S.Tv += dt * (1 + 1.4 * cl(k[2], 0, 1));
  // the setter's goal wanders over the whole panel on rates that do not divide
  S.zx = 32 + 25 * sin(0.057 * S.T + S.ps[0]) + 6 * sin(0.131 * S.T + S.ps[1]);
  S.zy = 64 + 52 * sin(0.0413 * S.T + S.ps[2]) + 8 * sin(0.097 * S.T + S.ps[3]);
  place(S, sf);
  agenda(S, dt, pace, ceil(Qr - 1e-6));
  S.Qr = Qr;
  S.lw = 5 + 14 * sf;
}

// Soft counts for every LED, sharp and wide.
function field(S) {
  const C = S.C, CW = S.CW;
  C.fill(0);
  CW.fill(0);
  const RA = S.RA;
  RA.fill(0);
  const iw = 1 / SOFT, il = 1 / S.lw;
  for (let i = 0; i < NV; i++) {
    const vx = S.vx[i], vy = S.vy[i], R = sqrt((S.qx - vx) * (S.qx - vx) + (S.qy - vy) * (S.qy - vy));
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - vy, dy2 = dy * dy;
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - vx, e = R - sqrt(dx * dx + dy2);
        const p = y * W + x;
        let s = 0.5 + e * iw;
        if (s > 0) {
          if (s >= 1) C[p] += 1;
          else C[p] += s * s * (3 - 2 * s);
        }
        let w = 0.5 + e * il;
        if (w > 0) CW[p] += w >= 1 ? 1 : w;
        if (e > -2.2 && e < 2.2) RA[p] += exp(-e * e * 0.78);
      }
    }
  }
}

// A dim colour of hue h is held to the luminance of a blue one, which keeps a
// green ground from glaring.
const lumFix = (h) => {
  const d = abs(h - floor(h) - 0.4), x = min(d, 1 - d) / 0.13;
  return 1 - 0.34 * exp(-x * x);
};
function lutBuild(S, hc, hw) {
  const t = S.tmp, lf = lumFix(hc);
  for (let k = 0; k < LUT; k++) {
    const u = k / (LUT - 1);
    // the cool ground: indigo deep down, a pale teal where one voter short
    hsv(hc - 0.09 * u, 0.76 - 0.14 * u, (0.27 + 0.30 * Math.pow(u, 1.6)) * lf, t);
    S.cool[k * 3] = t[0] * 255; S.cool[k * 3 + 1] = t[1] * 255; S.cool[k * 3 + 2] = t[2] * 255;
    // the petals: amber at the quota, pale gold where every voter agrees
    hsv(hw + 0.02 * u, 0.92 - 0.6 * u * u, 0.86 + 0.14 * u, t);
    S.warm[k * 3] = t[0] * 255; S.warm[k * 3 + 1] = t[1] * 255; S.warm[k * 3 + 2] = t[2] * 255;
  }
}

// Paint colour c (0 to 1 per channel) over buf at index q with weight a, after
// scaling what was there by dk.
function put(buf, q, c, a, dk) {
  buf[q] = mix(buf[q] * dk, c[0] * 255, a);
  buf[q + 1] = mix(buf[q + 1] * dk, c[1] * 255, a);
  buf[q + 2] = mix(buf[q + 2] * dk, c[2] * 255, a);
}
// A ring of radius rad, 3 LED across at its soft edge, weight a.
function ringAt(buf, x, y, rad, a, c, reach) {
  const x0 = max(0, floor(x - reach)), x1 = min(W - 1, floor(x + reach)), y0 = max(0, floor(y - reach)), y1 = min(H - 1, floor(y + reach));
  for (let yy = y0; yy <= y1; yy++)
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + 0.5 - x, dy = yy + 0.5 - y, v = cl(1.5 - abs(sqrt(dx * dx + dy * dy) - rad), 0, 1) * a;
      if (v > 0) put(buf, (yy * W + xx) * 3, c, v, 1);
    }
}

export function draw(display, params) {
  const S = params.s || setup(params);
  if (!S.init) update(0, { knobValues: S.k }, params);
  const k = S.ks, buf = S.buf, C = S.C, CW = S.CW, Qr = S.Qr;
  const sc = cl(k[0], 0, 1) * 5, s0 = min(4, floor(sc)), sf = sc - s0;
  // both hues sway a little round their setting, each on its own rates
  const T0 = S.T;
  const hc = mix(HC[s0], HC[s0 + 1], sf) + 0.035 * (sin(0.0491 * T0 + S.ps[3]) - sin(S.ps[3])) + 0.02 * (sin(0.0817 * T0 + S.ps[7]) - sin(S.ps[7]));
  const hw = mix(HW[s0], HW[s0 + 1], sf) + 0.02 * (sin(0.0613 * T0 + S.ps[8]) - sin(S.ps[8])) + 0.012 * (sin(0.1033 * T0 + S.ps[2]) - sin(S.ps[2]));
  lutBuild(S, hc, hw);
  // the ramp is scaled to the best count on the panel, so a near miss still glows
  let cm = 0;
  for (let p = 0; p < NP; p += 7) if (C[p] > cm) cm = C[p];
  S.cmax += (cm - S.cmax) * 0.06;
  const cref = max(1.5, min(Qr - 0.5, S.cmax + 0.4));
  const cool = S.cool, warm = S.warm;
  // three soft clouds drift over the ground and lift it a little where they pass
  const bl = S.bl || (S.bl = new Float64Array(NB * 3));
  for (let j = 0; j < NB; j++) {
    bl[j * 3] = 32 + 34 * sin((0.052 + 0.0171 * j) * S.T + S.ps[j] * 1.3 + 1.3 * j);
    bl[j * 3 + 1] = 64 + 66 * sin((0.039 + 0.0139 * j) * S.T + S.ps[j + 4] * 1.7);
    bl[j * 3 + 2] = 0.5 / (11 * 11 * (0.8 + 0.22 * j));
  }
    const gb = 1 + 0.1 * sin(0.067 * S.T + S.ps[9]) + 0.07 * sin(0.0431 * S.T + S.ps[10]);
  const ty = 0.12 * sin(0.0521 * S.T + S.ps[1]), tx = 0.08 * sin(0.0613 * S.T + S.ps[2]);
  const nvInv = 1 / NV, glk = 0.22 + 0.75 * S.froze, clk = 0.16 + 0.3 * S.froze;
  const rc = [0, 0, 0], cb = [0, 0, 0];
  hsv(hc - 0.07, 0.66, 0.15 * lumFix(hc - 0.07), cb);
  cb[0] *= 255; cb[1] *= 255; cb[2] *= 255;
  hsv(hc - 0.05, 0.3, 1, rc);
  rc[0] *= 255; rc[1] *= 255; rc[2] *= 255;
  for (let p = 0; p < NP; p++) {
    const c = C[p], cw = CW[p];
    const tc = cl(c / cref, 0, 1) * (LUT - 1), i0 = min(LUT - 2, tc | 0), f = tc - i0;
    const gl = glk * cw * nvInv;
    let r = mix(cool[i0 * 3], cool[i0 * 3 + 3], f), g = mix(cool[i0 * 3 + 1], cool[i0 * 3 + 4], f), b = mix(cool[i0 * 3 + 2], cool[i0 * 3 + 5], f);
    const px = (p % W) + 0.5, py = ((p / W) | 0) + 0.5;
    let cld = 0;
    for (let j = 0; j < NB; j++) { const ddx = px - bl[j * 3], ddy = py - bl[j * 3 + 1]; cld += exp(-(ddx * ddx + ddy * ddy) * bl[j * 3 + 2]); }
    const a = cl(c - Qr + 0.5, 0, 1);
    const gm = (1 + gl + clk * min(1, cld)) * gb * (1 + ty * (py - 64) / 64 + tx * (px - 32) / 32), cn = min(1, cld) * (1 - a) * (1 + 1.4 * S.froze);
    r = r * gm + cb[0] * cn; g = g * gm + cb[1] * cn; b = b * gm + cb[2] * cn;
    // a warm haze on the ground where the count is closing on the quota
    const hz = cl((cw - (Qr - 1.0)) / 1.5, 0, 1), halo = hz * hz * 0.34 * (1 - a);
    if (halo > 0.003) {
      r = mix(r, warm[0] * 0.85, halo);
      g = mix(g, warm[1] * 0.85, halo);
      b = mix(b, warm[2] * 0.85, halo);
    }
    // no channel of the ground falls under the 21 or so that the panel can still show
    if (r < GFLOOR) r = GFLOOR;
    if (g < GFLOOR) g = GFLOOR;
    if (b < GFLOOR) b = GFLOOR;
    if (a > 0) {
      const ex = cl((c - Qr + 0.5) / max(1, NV - Qr), 0, 1) * (LUT - 1), j0 = min(LUT - 2, ex | 0), jf = ex - j0;
      const wr = mix(warm[j0 * 3], warm[j0 * 3 + 3], jf), wg = mix(warm[j0 * 3 + 1], warm[j0 * 3 + 4], jf), wb = mix(warm[j0 * 3 + 2], warm[j0 * 3 + 5], jf);
      const rim = 4 * a * (1 - a) * 0.3;
      const qx = (p % W) + 0.5 - S.qx, qy = ((p / W) | 0) + 0.5 - S.qy, br = 1 + 0.22 * exp(-(qx * qx + qy * qy) / 600);
      r = mix(r, wr * br, a) + 255 * rim;
      g = mix(g, wg * br, a) + 255 * rim;
      b = mix(b, wb * br, a) + 255 * rim;
    }
    const ra = min(0.55, S.RA[p] * 0.27) * (1 - 0.5 * a);
    buf[p * 3] = mix(r, rc[0], ra); buf[p * 3 + 1] = mix(g, rc[1], ra); buf[p * 3 + 2] = mix(b, rc[2], ra);
  }
  // trail: white-gold, with a dark shade beside it so it shows on the petals
  const tr = S.tr, ts = S.ts;
  tr.fill(0);
  ts.fill(0);
  const T = S.T;
  for (let i = 0; i < S.nt; i++) {
    const age = T - S.trail[i * 3 + 2];
    if (age > TRAILT) continue;
    const al = Math.pow(1 - age / TRAILT, 1.4) * 0.85;
    const x = S.trail[i * 3], y = S.trail[i * 3 + 1];
    const x0 = max(0, floor(x - 5)), x1 = min(W - 1, floor(x + 5)), y0 = max(0, floor(y - 5)), y1 = min(H - 1, floor(y + 5));
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - x, dy = yy + 0.5 - y, d2 = dx * dx + dy * dy, q = yy * W + xx;
        const v = exp(-d2 / 1.6) * al, sh = exp(-d2 / 7) * al * 0.4;
        if (v > tr[q]) tr[q] = v;
        if (sh > ts[q]) ts[q] = sh;
      }
  }
  const tc = S.tmp;
  hsv(hw + 0.015, 0.14, 1, tc);
  for (let p = 0; p < NP; p++) if (tr[p] > 0.01 || ts[p] > 0.01) put(buf, p * 3, tc, tr[p], 1 - ts[p] * (1 - tr[p]));
  // the voters: a soft pale glow with a wide bloom round it
  hsv(hc - 0.08, 0.22, 1, tc);
  for (let i = 0; i < NV; i++) {
    const x = S.vx[i], y = S.vy[i];
    const x0 = max(0, floor(x - 13)), x1 = min(W - 1, floor(x + 13)), y0 = max(0, floor(y - 13)), y1 = min(H - 1, floor(y + 13));
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - x, dy = yy + 0.5 - y, d2 = dx * dx + dy * dy;
        put(buf, (yy * W + xx) * 3, tc, max(exp(-d2 / 52) * 0.2, exp(-d2 / 4.4) * 0.95), 1 - 0.3 * exp(-d2 / 9));
      }
  }
  // the point of the next hop, a ring that goes out of q where it lands, and
  // a slower one while no amendment can pass
  if (S.hasT && S.mode === 0) {
    hsv(hw, 0.2, 1, tc);
    ringAt(buf, S.tx, S.ty, 2.6, sm(S.tin / 0.6) * (0.55 + 0.25 * sin(S.T * 5)), tc, 5);
  }
  const la = (S.T - S.land) / 1.1;
  if (la >= 0 && la < 1 && S.nt) {
    hsv(hw + 0.015, 0.25, 1, tc);
    ringAt(buf, S.qx, S.qy, 4 + 11 * (1 - (1 - la) * (1 - la)), (1 - la) * 0.6, tc, 17);
  }
  if (S.froze > 0.02) {
    const ph = S.T / 2.4 - floor(S.T / 2.4);
    hsv(hc - 0.05, 0.3, 1, tc);
    ringAt(buf, S.qx, S.qy, 5 + 15 * ph, S.froze * (1 - ph) * (1 - ph) * 0.5, tc, 22);
  }
  // the status quo: a bright ring with a dark eye where every circle passes
  {
    const x = S.qx, y = S.qy, rr = 3.4 + 0.25 * sin(S.T * 1.7);
    hsv(hw + 0.01, 0.12, 1, tc);
    const x0 = max(0, floor(x - 9)), x1 = min(W - 1, floor(x + 9)), y0 = max(0, floor(y - 9)), y1 = min(H - 1, floor(y + 9));
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - x, dy = yy + 0.5 - y, d = sqrt(dx * dx + dy * dy);
        put(buf, (yy * W + xx) * 3, tc, max(cl(1.6 - abs(d - rr), 0, 1), exp(-d * d / 1.3)), 1 - 0.7 * cl((rr - 0.6 - d) * 0.8, 0, 1));
      }
  }
  for (let p = 0; p < NP; p++) {
    display.setPixel(p % W, (p / W) | 0, cl(buf[p * 3], 0, 255) | 0, cl(buf[p * 3 + 1], 0, 255) | 0, cl(buf[p * 3 + 2], 0, 255) | 0);
  }
}
