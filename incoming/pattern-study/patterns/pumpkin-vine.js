// ===== Patternflow pattern =====
// Title:   Pumpkin Vine
// Family:  halloween
// Idea:    Under a violet night sky and a pale moon a pumpkin vine climbs from the hill at the bottom of the panel to near the top, its stem winding up as broad five-lobed leaves unfold at every joint and tendrils coil out beside them, small orange pumpkins swell at the joints and light one by one from the bottom as jack-o'-lanterns with glowing carved faces, each one lifting the night a little, and when the whole vine has stood lit for a few seconds its leaves wither to a dead violet, sink into the dark, and a new vine starts from the ground.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 47
// Round:   47
// ===============================
// @matrix 64x128
// @knobs Spell=0..1, Speed=0.2..3, Vines=1..3, Curl=0..1
//
// Knob 1: Spell. At 0 an ordinary pumpkin patch under a violet night: leaf-green leaves, candle-yellow faces and an orange glow. Turning it bewitches the vine: by 0.5 the leaves are teal, the faces lime and the night dark slate; at 1 the leaves are violet with toxic green veins, the lanterns burn green and the night is a sickly green. The pumpkins stay orange.
// Knob 2: Speed. At 2 one vine takes 13 seconds: it starts climbing at 0.45, reaches its full height at 6.45, the four lanterns catch at about 3.9, 5.3, 6.0 and 7.4, it stands lit until 11, withers in 1.5 and the ground rests half a second. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Vines. One vine leans away from the moon with four pumpkins. Two share the width with leaves a fifth smaller and three pumpkins each, three with leaves a third smaller and two each, the one under the moon stopping lower. Turning it lays the vines out again at the same stage of growth.
// Knob 4: Curl. How hard the stem winds, how flat the leaves spread and how far the tendrils coil: at 0.06 the stem sways gently, the leaves stand half upright and each tendril makes one turn; at 1 the stem swings in wide S-bends, the leaves spread flat out and the tendrils are springs of two and a half turns.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sin, cos, sqrt, atan2, asin, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// One vine, in story seconds (one a second at Speed 2): the stem starts at
// T0 and reaches the top GROW later; the vine stands until HOLD_END,
// withers in WITHER and the ground rests until CYCLE.
const T0 = 0.45, GROW = 6, HOLD_END = 11, WITHER = 1.5, CYCLE = 13;
// A leaf unfolds in LEAF_T after the tip passes its joint, a pumpkin swells
// in PUMP_T, a tendril coils out in TEND_T, a lantern catches in LIGHT_T.
const LEAF_T = 1.2, PUMP_T = 1.4, TEND_T = 1.3, LIGHT_T = 0.5;
// Each LED a part of the vine covers fades in over this long.
const RAMP = 0.15;
// How much brighter the night is once every lantern is lit.
const SKY_GLOW = 0.33;
// The stem stops this far below the top edge; joints come every GAP LEDs of
// stem; a leaf's radius at the bottom joint.
const TOP_Y = 22, GAP = 13, LEAF_R = 15.5;
// The moon, top right.
const MX = 52, MY = 11, MR = 7.5;
// A pumpkin's half-width and half-height at full size.
const PRX = 8, PRY = 6.5;
// Up to this many parts of the vine are kept per LED, newest on top.
const EV = 4;

export function setup(params) {
  params.s = {
    t: 0, spell: 0, speed: 2, vines: 0, curl: -1,
    bg: new Float32Array(N * 3), bgSpell: NaN,
    evN: new Uint8Array(N), evT: new Float32Array(N * EV), evA: new Float32Array(N * EV), evK: new Uint8Array(N * EV),
    tmpT: new Float32Array(N), tmpA: new Float32Array(N), tmpK: new Uint8Array(N), tmpD: new Float32Array(N), touched: [],
    rgb: new Float32Array(N * 3), lv: new Float32Array(N), pm: new Uint8Array(N), pal: null, palSpell: NaN,
    pumpkins: [], stars: [], seed: 0, rng: null,
  };
}

// The palette for a Spell setting. Parts of the vine store only a kind, so
// turning Spell recolours a vine that has already grown.
// Kinds: 1 stem, 2 stem highlight, 3 leaf lit half, 4 leaf shaded half,
// 5 vein, 6 leaf rim, 7 tendril, and 8, 9 and 11 the lit half, shaded half
// and rim of every other leaf, a yellower green.
function palette(sp) {
  const lh = 0.3 + 0.47 * sp;
  return {
    1: hsv(0.27 + 0.05 * sp, 0.78, 0.8),
    2: hsv(0.24 + 0.06 * sp, 0.6, 0.95),
    3: hsv(lh, 0.86, 0.94),
    4: hsv(lh + 0.02, 0.9, 0.86),
    5: hsv(0.22 + 0.08 * sp, 0.62 + 0.2 * sp, 0.97),
    6: hsv(lh + 0.03, 0.92, 0.7),
    7: hsv(0.2 + 0.08 * sp, 0.6, 0.92),
    8: hsv(lh - 0.07, 0.88, 0.96),
    9: hsv(lh - 0.06, 0.9, 0.88),
    11: hsv(lh - 0.05, 0.92, 0.72),
    fire: hsv(0.14 + 0.17 * sp, 0.62, 1),
    halo: hsv(0.07 + 0.24 * sp, 0.95, 1),
  };
}

// The night: a violet sky darker towards the ground, a few still stars, the
// moon with two faint seas and a soft ring, and a low dark hill.
function sky(S) {
  const bg = S.bg, sp = S.spell;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3, u = y / H;
      // Spell turns the violet night to a sickly green one.
      let r = mix(mix(0.12, 0.035, u), mix(0.02, 0.008, u), sp), g = mix(mix(0.03, 0.008, u), mix(0.17, 0.06, u), sp), b = mix(mix(0.22, 0.075, u), mix(0.09, 0.03, u), sp);
      const d = hypot(x + 0.5 - MX, y + 0.5 - MY);
      if (d < MR) {
        const sea = hypot(x - MX + 2.5, y - MY + 1.5) < 2.6 || hypot(x - MX - 1.5, y - MY - 3) < 2 ? 0.86 : 1;
        r = 1 * sea;
        g = mix(0.95, 1, sp) * sea;
        b = mix(0.76, 0.7, sp) * sea;
      } else if (d < MR + 6) {
        const k = ((MR + 6 - d) / 6) ** 2 * 0.35;
        r += k * 0.9;
        g += k * 0.8;
        b += k * 0.7;
      }
      // The hill the vine grows out of.
      const hill = H - 5 + 3 * cos((x - 30) / 14);
      if (y + 0.5 > hill) (r = 0.18), (g = 0.05), (b = 0.27);
      if (abs(y + 0.5 - hill) < 0.6) (r = 0.32), (g = 0.12), (b = 0.42);
      bg[i] = r;
      bg[i + 1] = g;
      bg[i + 2] = b;
    }
  for (const [x, y, v] of S.stars) {
    const i = (y * W + x) * 3;
    bg[i] = max(bg[i], 0.8 * v);
    bg[i + 1] = max(bg[i + 1], 0.75 * v);
    bg[i + 2] = max(bg[i + 2], v);
  }
  S.bgSpell = sp;
}

// Building a vine: each part is stamped into a scratch layer first (an
// arrival time, a coverage and a kind per LED), then the layer goes on top
// of the parts already there.
function stamp(S, x, y, te, a, kind, d) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = y * W + x;
  if (S.tmpA[p] === 0) (S.touched.push(p), (S.tmpT[p] = te), (S.tmpD[p] = 1e9));
  S.tmpT[p] = min(S.tmpT[p], te);
  S.tmpA[p] = max(S.tmpA[p], a);
  if (d < S.tmpD[p]) (S.tmpD[p] = d), (S.tmpK[p] = kind);
}
function flush(S) {
  for (const p of S.touched) {
    let n = S.evN[p];
    if (n === EV) {
      // Full: the oldest part is under three others; drop it.
      for (let j = 1; j < EV; j++) {
        S.evT[p * EV + j - 1] = S.evT[p * EV + j];
        S.evA[p * EV + j - 1] = S.evA[p * EV + j];
        S.evK[p * EV + j - 1] = S.evK[p * EV + j];
      }
      n--;
    }
    // Kept in order of arrival, so the one that comes last is drawn on top.
    let j = n;
    while (j > 0 && S.evT[p * EV + j - 1] > S.tmpT[p]) {
      S.evT[p * EV + j] = S.evT[p * EV + j - 1];
      S.evA[p * EV + j] = S.evA[p * EV + j - 1];
      S.evK[p * EV + j] = S.evK[p * EV + j - 1];
      j--;
    }
    S.evT[p * EV + j] = S.tmpT[p];
    S.evA[p * EV + j] = S.tmpA[p];
    S.evK[p * EV + j] = S.tmpK[p];
    S.evN[p] = n + 1;
    S.tmpA[p] = 0;
  }
  S.touched.length = 0;
}

// A round brush along a polyline of [x, y, time] points, or [x, y, time,
// radius] where it tapers.
function brush(S, pts, rad, kindAt) {
  for (const [px, py, te, rr] of pts) {
    const r = rr === undefined ? rad : rr;
    for (let y = floor(py - r - 1); y <= py + r + 1; y++)
      for (let x = floor(px - r - 1); x <= px + r + 1; x++) {
        const d = hypot(x + 0.5 - px, y + 0.5 - py);
        stamp(S, x, y, te, cl(r + 0.5 - d, 0, 1), kindAt(d / r), d);
      }
  }
}

// The inverse of smoothstep: the share of the way through an eased
// unfolding at which it has reached u.
const unease = (u) => 0.5 - sin(asin(cl(1 - 2 * u, -1, 1)) / 3);

// One vine from the ground at x0, leaning towards lean as it climbs and
// stopping at row top; it starts at t0, its leaves are scaled by lr and it
// carries np pumpkins.
function vine(S, x0, lean, top, t0, lr, np) {
  const R = S.rng, curl = S.curl;
  // The stem: steered by a heading that swings from side to side, pulled
  // back towards the line it leans along.
  const pts = [], amp = 0.365 + 0.95 * (curl - 0.06), lam = 46 + 10 * R(), ph = TAU * R();
  let x = x0, y = H + 1, s = 0;
  while (y > top) {
    const xc = mix(x0, lean, cl((H - y) / H, 0, 1)), th = amp * sin((TAU * s) / lam + ph) - 0.035 * (x - xc);
    x += 0.5 * sin(th);
    y -= 0.5 * cos(th);
    s += 0.5;
    pts.push([x, y, s]);
  }
  const len = s, tipAt = (ss) => t0 + (GROW * ss) / len;
  brush(S, pts.map(([px, py, ss]) => [px, py, tipAt(ss), (2.2 - (1.1 * ss) / len) * (0.6 + 0.4 * lr)]), 0, (u) => (u < 0.45 ? 2 : 1));
  flush(S);
  // The joints, alternating sides.
  const nodes = [];
  let side = R() < 0.5 ? -1 : 1;
  for (let sn = 9; sn < len - 8; sn += GAP) {
    const pt = pts[min(pts.length - 1, round(sn / 0.5))];
    nodes.push({ s: sn, x: pt[0], y: pt[1], side, t: tipAt(sn) + 0.15 });
    side = -side;
  }
  // Pumpkins at evenly spread joints from the second to the one below the
  // top.
  const last = max(1, nodes.length - 2), pick = new Set();
  for (let j = 0; j < np; j++) pick.add(round(1 + (j * (last - 1)) / max(1, np - 1)));
  const prx = PRX * (0.7 + 0.3 * lr);
  nodes.forEach((nd, j) => {
    // The leaf: a petiole out and up, then a five-lobed blade that unfolds
    // from its stalk outwards, the middle lobe first. Curl spreads the
    // leaves from half upright to flat out.
    const rad = LEAF_R * lr * (1.08 - (0.32 * nd.s) / len), pl = (3.5 + 1.5 * R()) * lr;
    let a = nd.side * (0.75 + (curl - 0.06) + 0.25 * R());
    // A leaf that would cover the moon grows on the other side instead.
    if (hypot(nd.x + sin(a) * (pl + 0.62 * rad) - MX, nd.y - cos(a) * (pl + 0.62 * rad) - MY) < rad + MR + 2) (a = -a), (nd.side = -nd.side);
    const dx = sin(a), dy = -cos(a);
    const bx = nd.x + dx * pl, by = nd.y + dy * pl, cx = bx + dx * 0.62 * rad, cy = by + dy * 0.62 * rad;
    const stalk = [], alt = j % 2 ? 5 : 0;
    for (let l = 0; l <= pl; l += 0.5) stalk.push([nd.x + dx * l, nd.y + dy * l, nd.t + 0.15 * LEAF_T * (l / pl)]);
    brush(S, stalk, 0.9, () => 1);
    for (let yy = floor(cy - rad - 2); yy <= cy + rad + 2; yy++)
      for (let xx = floor(cx - rad - 2); xx <= cx + rad + 2; xx++) {
        const ex = xx + 0.5 - cx, ey = yy + 0.5 - cy, rho = hypot(ex, ey);
        const phi = atan2(ex * dy - ey * dx, ex * dx + ey * dy);
        const edge = rad * (0.62 + 0.38 * abs(cos(2.5 * phi)) ** 0.55);
        const cov = cl(edge - rho + 0.5, 0, 1);
        if (cov <= 0) continue;
        // Veins run from the stalk to the three upper lobe tips.
        const fx = xx + 0.5 - bx, fy = yy + 0.5 - by, fr = hypot(fx, fy);
        const psi = atan2(fx * dy - fy * dx, fx * dx + fy * dy);
        let vein = 9;
        for (const la of [0, 0.4 * PI, -0.4 * PI]) {
          const lx = cx + rad * (cos(la) * dx + sin(la) * dy) - bx, ly = cy + rad * (cos(la) * dy - sin(la) * dx) - by;
          const ll = hypot(lx, ly), t2 = cl((fx * lx + fy * ly) / (ll * ll), 0, 1);
          vein = min(vein, hypot(fx - t2 * lx, fy - t2 * ly));
        }
        // Every other leaf is a yellower green, so neighbours stand apart.
        const kind = edge - rho < 1.1 ? 6 + alt : vein < 0.55 ? 5 : (phi * nd.side > 0 ? 3 : 4) + alt;
        const u = cl((0.72 * fr) / (1.62 * rad) + (0.28 * abs(psi)) / PI, 0, 1);
        stamp(S, xx, yy, nd.t + LEAF_T * (0.15 + 0.85 * unease(u)), cov, kind, 0);
      }
    flush(S);
    if (pick.has(j)) {
      // A pumpkin hangs on the side away from the leaf; the lowest sits on
      // the hill.
      const px = cl(nd.x - nd.side * (prx * 0.75 + 1.5), prx + 0.5, W - prx - 0.5);
      S.pumpkins.push({ x: px, top: min(nd.y + 1, H - 6 - 2 * PRY * (0.7 + 0.3 * lr)), t: nd.t + 0.45, sc: 0.7 + 0.3 * lr });
    } else {
      // A tendril: an Euler spiral, its curvature growing along it, so it
      // runs out straight and winds into a tight coil.
      const turns = mix(1, 2.5, curl), tl = mix(10, 17, curl) * lr, a0 = -nd.side * (1.1 + 0.3 * R()), c0 = 0.04;
      const cb = (TAU * turns - c0 * tl) / (tl * tl), spin = -nd.side;
      const tp = [];
      let qx = nd.x, qy = nd.y, l = 0;
      while (l < tl) {
        const hd = a0 + spin * (c0 * l + cb * l * l);
        qx += 0.3 * sin(hd);
        qy -= 0.3 * cos(hd);
        l += 0.3;
        tp.push([qx, qy, nd.t + 0.3 + TEND_T * (l / tl)]);
      }
      brush(S, tp, 0.55, () => 7);
      flush(S);
    }
  });
}

// Lay out the vines: one leans away from the moon; two or three share the
// width with smaller leaves, starting 0.15 seconds apart.
const LAYOUT = {
  1: [[0, 20, TOP_Y]],
  2: [[17, 15, TOP_Y], [45, 38, TOP_Y + 10]],
  3: [[11, 10, TOP_Y], [32, 28, TOP_Y + 4], [53, 44, TOP_Y + 16]],
};
// A small seeded generator: a vine keeps its seed until the next one
// starts, so turning Curl or Vines bends the same vine instead of drawing
// a new one at every step of the knob.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function build(S) {
  S.rng = rng(S.seed);
  S.evN.fill(0);
  S.lv.fill(0);
  S.pm.fill(0);
  S.pumpkins = [];
  const nv = S.vines, lr = [0, 1, 0.8, 0.68][nv], np = [0, 4, 3, 2][nv];
  LAYOUT[nv].forEach(([x0, lean, top], v) => vine(S, x0 || 30 + 8 * S.rng(), lean, top, T0 + 0.15 * v, lr, np));
  // The lanterns catch one by one in the order their pumpkins swelled.
  S.pumpkins.sort((a, b) => a.t - b.t);
  let light = 0;
  for (const P of S.pumpkins) P.light = light = max(P.t + PUMP_T + 0.25, light + 0.55);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.spell = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  const nv = cl(round(k[2]), 1, 3), curl = cl(k[3], 0, 1);
  if (S.stars.length === 0) {
    for (let i = 0; i < 22; i++) S.stars.push([floor(Math.random() * W), floor(Math.random() * 70), 0.25 + 0.3 * Math.random()]);
    S.seed = floor(Math.random() * 4294967296);
  }
  if (nv !== S.vines || abs(curl - S.curl) > 0.004) {
    S.vines = nv;
    S.curl = curl;
    build(S);
  }
  S.t += (d * S.speed) / 2;
  if (S.t >= CYCLE) {
    S.t -= CYCLE;
    S.seed = floor(Math.random() * 4294967296);
    build(S);
  }
}

// A pumpkin at swell sw (0 to 1) hanging from (x, top), carved face lit by
// f; writes into rgb over whatever is there and marks its LEDs in pm, so
// the withering knows them.
function pumpkin(S, P, sw, f, rgb) {
  const rx = PRX * P.sc * sw, ry = PRY * P.sc * sw, cx = P.x, cy = P.top + 1 + ry, fire = S.pal.fire, stem = S.pal[1];
  for (let y = floor(cy - ry - 3); y <= cy + ry + 1; y++)
    for (let x = floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, rr = sqrt(u * u + v * v);
      const i = (y * W + x) * 3;
      // The stalk, a green stub on top.
      if (y + 0.5 < cy - ry + 1 && y + 0.5 > cy - ry - 2.5 && abs(x + 0.5 - cx - 0.4) < 1.1) {
        rgb[i] = stem[0];
        rgb[i + 1] = stem[1];
        rgb[i + 2] = stem[2];
        S.pm[y * W + x] = 1;
        continue;
      }
      const a = cl((1 - rr) * rx + 0.5, 0, 1);
      if (a <= 0) continue;
      // Every part of a pumpkin keeps red at full, so as it swells no LED
      // under it gets dimmer: ribs are a deeper orange, the shine a yellower one.
      const w = u / sqrt(max(0.05, 1 - v * v)), rib = abs(abs(w) - 0.5) < 0.12 || abs(w) < 0.06;
      let g = rib ? 0.3 : 0.5;
      if (u < -0.15 && v < -0.2 && u * u + v * v > 0.25 && u * u + v * v < 0.6) g = 0.68;
      let r = 1, b = 0;
      if (f > 0) {
        // The carved face: two triangle eyes, a nose and a jagged grin.
        const eye = v <= -0.06 && v >= -0.5 + abs(abs(u) - 0.4) * 1.9 && abs(u) < 0.7;
        const nose = v <= 0.18 && v >= -0.02 + abs(u) * 1.8;
        const top = 0.3 + 0.08 * u * u, bot = 0.62 - 0.18 * u * u;
        let mouth = abs(u) < 0.66 && v >= top && v <= bot;
        if (mouth && ((u > -0.32 && u < -0.14 && v < top + 0.15) || (u > 0.14 && u < 0.32 && v > bot - 0.15))) mouth = false;
        if (eye || nose || mouth) (g = mix(g, fire[1], f)), (b = fire[2] * f), (r = mix(1, max(fire[0], 0.85), f));
      }
      rgb[i] = mix(rgb[i], r, a);
      rgb[i + 1] = mix(rgb[i + 1], g, a);
      rgb[i + 2] = mix(rgb[i + 2], b, a);
      S.pm[y * W + x] = 1;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.pumpkins) return;
  if (S.bgSpell !== S.spell) sky(S);
  if (S.palSpell !== S.spell) (S.pal = palette(S.spell)), (S.palSpell = S.spell), S.lv.fill(0);
  const t = S.t, rgb = S.rgb, bg = S.bg, pal = S.pal;
  const wi = t > HOLD_END ? sstep((t - HOLD_END) / WITHER) : 0;
  // Each lantern that catches lifts the whole night a step, from deep
  // violet towards a warmer, lighter one.
  let glow = 0;
  for (const P of S.pumpkins) glow += cl((t - P.light) / LIGHT_T, 0, 1);
  glow = (glow / max(1, S.pumpkins.length)) * (1 - cl(wi * 2, 0, 1));
  const sg = 1 + SKY_GLOW * glow, warm = 0.025 * glow;
  for (let p = 0; p < N; p++) {
    const i = p * 3;
    let r = bg[i] * sg + warm, g = bg[i + 1] * sg, b = bg[i + 2] * sg;
    for (let j = 0; j < S.evN[p]; j++) {
      const q = p * EV + j, a = S.evA[q] * cl((t - S.evT[q]) / RAMP, 0, 1);
      if (a <= 0) break;
      const c = pal[S.evK[q]];
      r = mix(r, c[0], a);
      g = mix(g, c[1], a);
      b = mix(b, c[2], a);
    }
    rgb[i] = r;
    rgb[i + 1] = g;
    rgb[i + 2] = b;
  }
  // Pumpkins swell, then light one by one; each lit lantern throws a warm
  // glow on the leaves and the sky round it.
  const lit = [];
  for (const P of S.pumpkins) {
    const sw = sstep((t - P.t) / PUMP_T);
    if (sw <= 0) continue;
    const f = cl((t - P.light) / LIGHT_T, 0, 1) * (1 - cl(wi * 2, 0, 1));
    pumpkin(S, P, 0.25 + 0.75 * (1 - (1 - sw) ** 2), f, rgb);
    if (f > 0) lit.push([P.x, P.top + 1 + PRY * P.sc, f, P.sc]);
  }
  const halo = pal.halo, HR = 22;
  for (const [hx, hy, f, sc] of lit)
    for (let y = max(0, floor(hy - HR)); y <= min(H - 1, hy + HR); y++)
      for (let x = max(0, floor(hx - HR)); x <= min(W - 1, hx + HR); x++) {
        const dd = hypot((x + 0.5 - hx) / (PRX * sc), (y + 0.5 - hy) / (PRY * sc));
        if (dd < 1.05) continue;
        const k = 0.45 * f * (1 - min(1, hypot(x + 0.5 - hx, y + 0.5 - hy) / HR)) ** 2, i = (y * W + x) * 3;
        rgb[i] += halo[0] * k;
        rgb[i + 1] += halo[1] * k;
        rgb[i + 2] += halo[2] * k;
      }
  for (let p = 0; p < N; p++) {
    const i = p * 3;
    let r = min(1, rgb[i]), g = min(1, rgb[i + 1]), b = min(1, rgb[i + 2]);
    if (wi > 0) {
      // Withering: the vine dulls to a dead violet and sinks into the night.
      // The sky only loses the lanterns' glow.
      const L = max(r, g, b) * 0.6, w2 = S.evN[p] || S.pm[p] ? cl(wi * 1.6, 0, 1) : 0, w3 = sstep((wi - 0.35) / 0.65);
      r = mix(mix(r, L * 0.62, w2), bg[i], w3);
      g = mix(mix(g, L * 0.18, w2), bg[i + 1], w3);
      b = mix(mix(b, L, w2), bg[i + 2], w3);
    } else {
      // While the vine grows no LED ever gets dimmer: a part that arrives
      // darker than what it covers is lifted to the level that was there.
      const L = max(r, g, b);
      if (L < S.lv[p] && L > 0) {
        const k = S.lv[p] / L;
        (r = min(1, r * k)), (g = min(1, g * k)), (b = min(1, b * k));
      } else S.lv[p] = L;
    }
    display.setPixel(p % W, floor(p / W), round(255 * r), round(255 * g), round(255 * b));
  }
}
