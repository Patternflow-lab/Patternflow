// ===== Patternflow pattern =====
// Title:   Metapopulation
// Family:  epidemic
// Idea:    Forty towns drawn as discs on a dark map and joined by a few dim travel links catch and lose an epidemic as a seasonal SIRS model, the disc turning from dark teal through amber to hot red with its infected share while a cool halo ring grows with its recovered share, and sparks run along the links at the rate the gravity-weighted traffic carries the infection and ignite quiet towns, so waves of outbreaks cross the map, flare, peak and die back, and come round again as immunity wanes.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the SIR equations of William Kermack and Anderson McKendrick (1927) with waning immunity (SIRS) and a contact rate that swings with the season, towns coupled as a metapopulation the way Leonid Rvachev and Ira Longini coupled cities along a transport network (1985), travel weights from the gravity model (George Zipf's P1 P2 / D rule, 1946); pattern round 231
// Round:   231
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Contagion=1.2..3, Travel=-1..1, Waning=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel; at 0 a town runs from dark teal through amber to hot red and its halo ring is blue.
// Knob 2: Contagion. The basic reproduction number R0 of every town, 1.4 at the bottom of the knob, 2.1 at the opening 2 and 3 at the top: low, only a few towns catch it and the map stays teal between slow flares, high, the outbreaks are bigger and many towns are orange and red at once.
// Knob 3: Travel. How much of a town's infection pressure comes from its neighbours instead of from itself, 8 percent at -1, 40 at 0 and 82 at 1: low, the towns burn alone and a spark is rare, high, sparks stream along the links, the links brighten and an outbreak jumps to a quiet town at once.
// Knob 4: Waning. How long immunity lasts, 80 s on average at -1, 46 s at 0 and 27 s at 1: slow waning leaves the halo rings bright for over a minute and the waves far apart, fast waning lets the rings fade as the towns refill and the waves follow each other sooner.

const W = 64, H = 128;
const { floor, ceil, sqrt, sin, cos, exp, log, abs, max, min, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const NT = 40;
// The model's own pace against the panel's seconds, so that a town is infectious for about 3 s and immunity lasts about 46 s at the opening.
const TSC = 1.4;
const GAMMA = 0.26 * TSC;
const OMEGA0 = (1 / 65) * TSC;
// Immunity is lost after a stretch that is not exponential: the recovered pass through this many stages, each left at NSTAGE times the waning rate, so the time they stay immune is bunched round its mean.
const NSTAGE = 6;
// Sparks: speed along a link in LEDs per second, and the share of a town one spark infects.
const SPEED = 12;
const QPKT = 0.014;
// Importation from outside the map: events per second, and the share of a town each infects.
const IMP_RATE = 0.13;
const QIMP = 0.012;
// The share under which a town counts as extinct.
// The infected share at which a disc is full red follows the peak a town can reach, so it grows with R0.
const IFULL_PER_R0 = 0.068;
const I_DEAD = 0.005;
// The season: a long swing, and a slower, smaller one so the sum never repeats.
const TS1 = 97, TS2 = 223, A1 = 0.22, A2 = 0.10;
// How much of a town's season phase follows where it stands on the map, and how much is its own.
const PHSP = 0.15, PHRN = 0.8;
const MAXSPARK = 140;

function gauss() {
  const u = 1 - Math.random(), v = Math.random();
  return sqrt(-2 * log(u)) * cos(TAU * v);
}

function hsv(out, h, s, v) {
  h = (h - floor(h)) * 6;
  for (let i = 0; i < 3; i++) {
    const k = (5 - 2 * i + h) % 6;
    out[i] = 255 * v * (1 - s * max(0, min(k, 4 - k, 1)));
  }
  return out;
}

// Turn an RGB colour round the wheel by dh, keeping its saturation and value.
const HT = [0, 0, 0];
function shiftHue(out, r, g, b, dh) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  hsv(HT, h + dh, mx > 0 ? d / mx : 0, mx / 255);
  out[0] = HT[0];
  out[1] = HT[1];
  out[2] = HT[2];
  return out;
}

// ---- the map ------------------------------------------------------------------------------------
// Does segment (a,b) properly cross segment (c,d)? Shared endpoints do not count.
function crosses(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const o2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const o3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const o4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function segDist(px, py, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay;
  const t = cl(((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey + 1e-9), 0, 1);
  return sqrt((px - ax - t * ex) ** 2 + (py - ay - t * ey) ** 2);
}

// Towns by best-candidate sampling: each new town takes, out of a handful of random spots, the one that keeps most room to its neighbours, which is Poisson-disk sampling with the sizes of the discs counted in.
function tryLayout(gap) {
  const pops = [];
  for (let i = 0; i < NT; i++) pops.push(exp(0.62 * gauss()));
  pops.sort((a, b) => b - a);
  const towns = [];
  for (const pop of pops) {
    const r = cl(2.8 * pow(pop, 0.55), 2.0, 4.4);
    const m = r + 2.4;
    let best = null, bs = -1e9;
    for (let c = 0; c < 40; c++) {
      const x = m + Math.random() * (W - 2 * m), y = m + Math.random() * (H - 2 * m);
      let s = 1e9;
      for (const t of towns) {
        const d = sqrt((t.x - x) ** 2 + (t.y - y) ** 2) - r - t.r;
        if (d < s) s = d;
      }
      if (s > bs) {
        bs = s;
        best = [x, y];
      }
    }
    if (bs < gap) return null;
    towns.push({ x: best[0], y: best[1], r, pop });
  }
  return towns;
}

function buildMap(P) {
  let towns = null;
  for (let gap = 7.0; gap >= 4.2 && !towns; gap -= 0.3) {
    for (let tries = 0; tries < 6 && !towns; tries++) towns = tryLayout(gap);
  }
  while (!towns) towns = tryLayout(4.2);
  const n = towns.length;
  const dist = (i, j) => sqrt((towns[i].x - towns[j].x) ** 2 + (towns[i].y - towns[j].y) ** 2);
  const pops = towns.map((t) => t.pop).sort((a, b) => a - b);
  const med = pops[floor(n * 0.75)];
  const links = [];
  const has = new Set();
  const deg = new Array(n).fill(0);
  const key = (i, j) => (i < j ? i * 100 + j : j * 100 + i);
  // A link is allowed when it crosses none and does not run through a third town's disc and halo.
  const okLink = (i, j, strict) => {
    const a = towns[i], b = towns[j];
    for (const l of links) {
      if (l.a === i || l.a === j || l.b === i || l.b === j) continue;
      if (crosses(a.x, a.y, b.x, b.y, towns[l.a].x, towns[l.a].y, towns[l.b].x, towns[l.b].y)) return false;
    }
    for (let k = 0; k < n; k++) {
      if (k === i || k === j) continue;
      if (segDist(towns[k].x, towns[k].y, a.x, a.y, b.x, b.y) < towns[k].r + (strict ? 2.6 : 1.0)) return false;
    }
    return true;
  };
  const addLink = (i, j) => {
    links.push({ a: i, b: j });
    has.add(key(i, j));
    deg[i]++;
    deg[j]++;
  };
  // Each town offers links to its two nearest neighbours, three for the larger half.
  const cand = [];
  for (let i = 0; i < n; i++) {
    const order = [];
    for (let j = 0; j < n; j++) if (j !== i) order.push(j);
    order.sort((p, q) => dist(i, p) - dist(i, q));
    const kk = towns[i].pop > med ? 3 : 2;
    for (let q = 0; q < kk; q++) cand.push([i, order[q]]);
  }
  cand.sort((p, q) => dist(p[0], p[1]) - dist(q[0], q[1]));
  for (const [i, j] of cand) {
    if (has.has(key(i, j)) || deg[i] >= 4 || deg[j] >= 4) continue;
    if (okLink(i, j, true)) addLink(i, j);
  }
  // Join what is left apart, shortest bridge first.
  const comp = new Array(n).fill(0).map((_, i) => i);
  const find = (x) => (comp[x] === x ? x : (comp[x] = find(comp[x])));
  for (const l of links) comp[find(l.a)] = find(l.b);
  for (let guard = 0; guard < n; guard++) {
    const roots = new Set();
    for (let i = 0; i < n; i++) roots.add(find(i));
    if (roots.size === 1) break;
    let bi = -1, bj = -1, bd = 1e9;
    for (const strict of [true, false]) {
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          if (find(i) === find(j)) continue;
          const d = dist(i, j);
          if (d < bd && okLink(i, j, strict)) {
            bd = d;
            bi = i;
            bj = j;
          }
        }
      if (bi >= 0) break;
    }
    if (bi < 0) break;
    addLink(bi, bj);
    comp[find(bi)] = find(bj);
  }
  // Every town with a single link gets a second one, the nearest it may have.
  for (let i = 0; i < n; i++) {
    if (deg[i] >= 2) continue;
    let bj = -1, bd = 1e9;
    for (let j = 0; j < n; j++) {
      if (j === i || has.has(key(i, j)) || deg[j] >= 4) continue;
      const d = dist(i, j);
      if (d < bd && okLink(i, j, false)) {
        bd = d;
        bj = j;
      }
    }
    if (bj >= 0) addLink(i, bj);
  }
  // Gravity: the traffic on a link is P_i P_j / d^1.5, scaled so the busiest is 1.
  let gmax = 0;
  for (const l of links) {
    const a = towns[l.a], b = towns[l.b];
    l.len = dist(l.a, l.b);
    l.ux = (b.x - a.x) / l.len;
    l.uy = (b.y - a.y) / l.len;
    l.g = (a.pop * b.pop) / pow(l.len, 1.5);
    if (l.g > gmax) gmax = l.g;
  }
  for (const l of links) l.traffic = l.g / gmax;
  for (let i = 0; i < n; i++) towns[i].nb = [];
  for (let li = 0; li < links.length; li++) {
    const l = links[li];
    towns[l.a].nb.push({ n: l.b, l: li, g: l.g, dir: 1 });
    towns[l.b].nb.push({ n: l.a, l: li, g: l.g, dir: -1 });
  }
  // Seen from town j, neighbour i's share of the pressure is its weight over the sum of the weights of all j's neighbours.
  for (const t of towns) {
    let sum = 0;
    for (const e of t.nb) {
      e.g = towns[e.n].pop / pow(links[e.l].len, 1.5);
      sum += e.g;
    }
    for (const e of t.nb) e.w = e.g / sum;
  }
  let ptot = 0;
  for (const t of towns) ptot += t.pop;
  P.ptot = ptot;
  P.towns = towns;
  P.links = links;
  for (const t of towns) {
    t.S = 1;
    t.I = 0;
    t.R = 0;
    t.rs = new Float64Array(NSTAGE);
    t.flash = 0;
    t.bm = 0.88 + 0.24 * Math.random();
    // Immunity lasts longer in some towns than in others.
    t.wv = 0.72 + 0.56 * Math.random();
    // The season is a few weeks ahead in one corner of the map and behind in the other.
    t.ph1 = TAU * (PHSP * (0.7 * (t.y / H) + 0.3 * (t.x / W)) + PHRN * Math.random());
    t.ph2 = Math.random() * TAU;
    t.beta = 0;
  }
}

// ---- the model -----------------------------------------------------------------------------------
function kick(t, q) {
  const d = q * t.S;
  t.I += d;
  t.S -= d;
  t.flash = 1;
}

function step(P, h) {
  const T = P.towns, K = P.K;
  P.t += h;
  for (const t of T) {
    const seas = 1 + A1 * cos((TAU * P.t) / TS1 - t.ph1) + A2 * cos((TAU * P.t) / TS2 - t.ph2);
    t.beta = K.beta0 * t.bm * max(0.25, seas);
  }
  // Sparks leave a link end at the rate the coupling term says infection flows along it: beta_j * kappa * w_ji * S_j * I_i, in packets of QPKT.
  for (let j = 0; j < T.length; j++) {
    const tj = T[j];
    for (const e of tj.nb) {
      const Ii = T[e.n].I;
      if (Ii < I_DEAD) continue;
      const rate = (tj.beta * K.kappa * e.w * tj.S * Ii) / QPKT;
      if (Math.random() < 1 - exp(-rate * h)) {
        if (P.sparks.length < MAXSPARK) {
          const l = P.links[e.l];
          // dir 1 runs from a to b: the spark goes from town e.n to town j.
          P.sparks.push({ l: e.l, from: e.n, to: j, s: T[e.n].r + 1.2, s1: l.len - tj.r - 0.8 });
        } else kick(tj, QPKT);
      }
    }
  }
  // Each town is infected by itself and by sparks. It recovers, then loses immunity stage by stage.
  for (const t of T) {
    const rs = t.rs;
    const wm = K.omega * NSTAGE * t.wv;
    const lam = t.beta * (1 - K.kappa) * t.I;
    const out = wm * rs[NSTAGE - 1] * h;
    let prev = GAMMA * t.I * h;
    let R = 0;
    for (let k = 0; k < NSTAGE; k++) {
      const leave = wm * rs[k] * h;
      rs[k] += prev - leave;
      prev = leave;
      R += rs[k];
    }
    const dI = (lam * t.S - GAMMA * t.I) * h;
    t.S += out - lam * t.S * h;
    t.I += dI;
    if (t.I < I_DEAD) {
      rs[0] += t.I;
      R += t.I;
      t.I = 0;
    }
    if (t.S < 0) {
      rs[0] += t.S;
      R += t.S;
      t.S = 0;
    }
    t.R = R;
    t.flash = max(0, t.flash - 2.2 * h);
  }
  // Sparks run along their link and land.
  for (let k = P.sparks.length - 1; k >= 0; k--) {
    const sp = P.sparks[k];
    sp.s += SPEED * h;
    if (sp.s >= sp.s1) {
      kick(T[sp.to], QPKT);
      P.sparks[k] = P.sparks[P.sparks.length - 1];
      P.sparks.pop();
    }
  }
  // Now and then a case arrives from outside the map, more likely in a large town.
  let live = 0;
  for (const t of T) if (t.I > 0.01) live++;
  if (Math.random() < IMP_RATE * (1 + 5 * max(0, 1 - live / 6)) * h) {
    let x = Math.random() * P.ptot;
    for (const t of T) {
      x -= t.pop;
      if (x <= 0) {
        kick(t, QIMP);
        break;
      }
    }
  }
}

// ---- colour ----------------------------------------------------------------------------------------
// The infected share's ramp, dark teal through amber to hot red.
const KEYS = [
  [0.0, 4, 60, 74],
  [0.25, 14, 116, 112],
  [0.46, 128, 176, 88],
  [0.64, 246, 184, 38],
  [0.82, 250, 104, 22],
  [1.0, 255, 28, 30],
];
const NLUT = 64;

function rampBase(out, u) {
  let k = 0;
  while (k < KEYS.length - 2 && u > KEYS[k + 1][0]) k++;
  const a = KEYS[k], b = KEYS[k + 1];
  const f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * f;
  out[1] = a[2] + (b[2] - a[2]) * f;
  out[2] = a[3] + (b[3] - a[3]) * f;
  return out;
}

function makeLut(P, dh) {
  const c = [0, 0, 0], o = [0, 0, 0];
  P.lut = new Float32Array((NLUT + 1) * 3);
  for (let i = 0; i <= NLUT; i++) {
    rampBase(c, i / NLUT);
    shiftHue(o, c[0], c[1], c[2], dh);
    P.lut[i * 3] = o[0];
    P.lut[i * 3 + 1] = o[1];
    P.lut[i * 3 + 2] = o[2];
  }
  shiftHue(P.ring, 120, 140, 245, dh);
  shiftHue(P.slate, 70, 104, 124, dh);
  shiftHue(P.spark, 255, 214, 150, dh);
  P.lutDh = dh;
}

function lutAt(P, out, u) {
  const f = cl(u, 0, 1) * NLUT, i = min(NLUT - 1, floor(f)), x = f - i;
  for (let c = 0; c < 3; c++) out[c] = P.lut[i * 3 + c] * (1 - x) + P.lut[(i + 1) * 3 + c] * x;
  return out;
}

// ---- Lab hooks -----------------------------------------------------------------------------------------
export function setup(params) {
  const P = params;
  Object.assign(P, {
    t: 0,
    started: false,
    sparks: [],
    buf: new Float32Array(W * H * 3),
    lut: null,
    lutDh: -1,
    ring: [0, 0, 0],
    slate: [0, 0, 0],
    spark: [0, 0, 0],
    K: { beta0: 0.5, kappa: 0.3, omega: 0.018, ifull: 0.075 },
    hue: 0,
    busy: 1,
  });
  buildMap(P);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = min(dt, 0.1);
  P.hue = k[0];
  const K = P.K;
  const R0 = 1.4 + 0.889 * (cl(k[1], 1.2, 3) - 1.2);
  K.beta0 = R0 * GAMMA;
  K.ifull = IFULL_PER_R0 * (R0 - 1);
  K.kappa = 0.08 + 0.74 * pow(0.5 + 0.5 * cl(k[2], -1, 1), 1.2);
  K.omega = OMEGA0 * exp(0.55 * cl(k[3], -1, 1));
  // The more people travel, the busier the links look, on top of the sparks that carry the infection.
  P.busy = 0.7 + 0.65 * cl(0.5 + 0.5 * k[2], 0, 1);
  if (!P.started) {
    P.started = true;
    // Run the first wave and its aftermath before the first frame, so the map opens in the middle of an epidemic season.
    for (let i = 0; i < 3000; i++) step(P, 0.05);
    P.sparks.length = 0;
  }
  const n = max(1, ceil(dt / 0.03));
  for (let i = 0; i < n; i++) step(P, dt / n);
}

// ---- drawing -------------------------------------------------------------------------------------------
const C0 = [0, 0, 0], C1 = [0, 0, 0];

// Max-blend a colour scaled by v into one pixel.
function putMax(buf, o, c, v) {
  const r = c[0] * v, g = c[1] * v, b = c[2] * v;
  if (r > buf[o]) buf[o] = r;
  if (g > buf[o + 1]) buf[o + 1] = g;
  if (b > buf[o + 2]) buf[o + 2] = b;
}

export function draw(display, params) {
  const P = params;
  if (!P.lut || abs(P.hue - P.lutDh) > 1e-4) makeLut(P, P.hue);
  const buf = P.buf;
  buf.fill(0);
  const T = P.towns;

  // Links: a dim slate band 2 LEDs wide that takes the colour of the busier end's infection.
  for (const l of P.links) {
    const a = T[l.a], b = T[l.b];
    const iu = sqrt(max(a.I, b.I) / P.K.ifull);
    const act = cl(1.5 * iu, 0, 1);
    const v = (0.34 + 0.18 * l.traffic + 0.26 * act) * P.busy;
    const x0 = max(0, floor(min(a.x, b.x) - 2)), x1 = min(W - 1, ceil(max(a.x, b.x) + 2));
    const y0 = max(0, floor(min(a.y, b.y) - 2)), y1 = min(H - 1, ceil(max(a.y, b.y) + 2));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = segDist(x + 0.5, y + 0.5, a.x, a.y, b.x, b.y);
        const s = cl((1.55 - d) / 0.85, 0, 1);
        if (s > 0) putMax(buf, (y * W + x) * 3, P.slate, v * s * s * (3 - 2 * s));
      }
  }

  // Halo rings: the recovered share, a cool band just outside the disc.
  for (const t of T) {
    if (t.R < 0.02) continue;
    const mid = t.r + 1.55, hw = 0.7;
    const v = 0.18 + 0.28 * pow(cl(t.R, 0, 1), 0.8);
    const rr = ceil(mid + hw + 1.2);
    for (let y = max(0, floor(t.y - rr)); y <= min(H - 1, ceil(t.y + rr)); y++)
      for (let x = max(0, floor(t.x - rr)); x <= min(W - 1, ceil(t.x + rr)); x++) {
        const d = sqrt((x + 0.5 - t.x) ** 2 + (y + 0.5 - t.y) ** 2);
        const s = cl((hw + 0.6 - abs(d - mid)) / 1.1, 0, 1);
        if (s > 0) putMax(buf, (y * W + x) * 3, P.ring, v * s * s * (3 - 2 * s));
      }
  }

  // Discs: the infected share. Painted over what is under them, with a lighter heart and a white flash when a spark lands.
  for (const t of T) {
    const u = sqrt(t.I / P.K.ifull);
    lutAt(P, C0, u);
    const fl = 0.4 * t.flash;
    const rr = ceil(t.r + 1.5);
    for (let y = max(0, floor(t.y - rr)); y <= min(H - 1, ceil(t.y + rr)); y++)
      for (let x = max(0, floor(t.x - rr)); x <= min(W - 1, ceil(t.x + rr)); x++) {
        const d = sqrt((x + 0.5 - t.x) ** 2 + (y + 0.5 - t.y) ** 2);
        const c = cl(t.r + 0.5 - d, 0, 1);
        if (c <= 0) continue;
        const q = d / t.r;
        const shade = 1.04 - 0.24 * q * q;
        const o = (y * W + x) * 3;
        for (let ch = 0; ch < 3; ch++) {
          const col = (C0[ch] * (1 - fl) + P.spark[ch] * fl) * shade;
          buf[o + ch] = buf[o + ch] * (1 - c) + col * c;
        }
      }
  }

  // Sparks: a bright head 2 to 3 LEDs wide with a short tail, added on top.
  for (const sp of P.sparks) {
    const l = P.links[sp.l];
    const a = T[sp.from], b = T[sp.to];
    const hx = a.x + (b.x - a.x) * (sp.s / l.len), hy = a.y + (b.y - a.y) * (sp.s / l.len);
    const ts = max(sp.s - 3.6, a.r + 1.2);
    const tx = a.x + (b.x - a.x) * (ts / l.len), ty = a.y + (b.y - a.y) * (ts / l.len);
    const ex = hx - tx, ey = hy - ty, e2 = ex * ex + ey * ey + 1e-9;
    for (let y = max(0, floor(min(hy, ty) - 2.6)); y <= min(H - 1, ceil(max(hy, ty) + 2.6)); y++)
      for (let x = max(0, floor(min(hx, tx) - 2.6)); x <= min(W - 1, ceil(max(hx, tx) + 2.6)); x++) {
        const px = x + 0.5 - tx, py = y + 0.5 - ty;
        const tt = cl((px * ex + py * ey) / e2, 0, 1);
        const d = sqrt((px - tt * ex) ** 2 + (py - tt * ey) ** 2);
        const w = cl((1.75 - d) / 1.0, 0, 1);
        if (w <= 0) continue;
        const v = w * w * (3 - 2 * w) * (0.22 + 0.78 * pow(tt, 1.6));
        const o = (y * W + x) * 3;
        buf[o] = min(255, buf[o] + P.spark[0] * v);
        buf[o + 1] = min(255, buf[o + 1] + P.spark[1] * v);
        buf[o + 2] = min(255, buf[o + 2] + P.spark[2] * v);
      }
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let r = buf[o], g = buf[o + 1], b = buf[o + 2];
      // Anything between 1 and 19 is off on the panel: a faint fringe is dropped, a dim edge is lifted to 20.
      const m = max(r, g, b);
      if (m > 0 && m < 20) {
        if (m < 9) r = g = b = 0;
        else {
          const f = 21 / m;
          r *= f;
          g *= f;
          b *= f;
        }
      }
      display.setPixel(x, y, (r + 0.5) | 0, (g + 0.5) | 0, (b + 0.5) | 0);
    }
}
