// ===== Patternflow pattern =====
// Title:   Whipped Soap
// Family:  cosmetic
// Idea:    An unseen star nozzle pipes whipped body soap onto a tray one rosette at a time, each a tight spiral that rises as every turn lands on the one before, its star-cut ridges standing in sharp crests over soft valleys in a soft light from the upper left that sways a little, until the tray holds two across and four down and a blade scrapes it flat for the next batch.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 36, after whipped body soap piped into rosettes in handmade soap shops
// Round:   36
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ridges=5..10, Swirl=-1..1
//
// Knob 1: Hue. Turns the soap and the tray under it round the whole wheel together. At 0 mint on deep teal; at 0.1 powder blue on navy; at 0.2 periwinkle on indigo; at 0.3 lilac on plum; at 0.4 orchid on deep magenta; at 0.5 rose on wine; at 0.6 peach and at 0.7 butter yellow, both on a near-black tray; at 0.8 pistachio on deep green. From 0.55 to 0.89 the foam is paled, its shadows lifted and the tray taken down, so nothing reads brown or olive.
// Knob 2: Speed. At 2 the nozzle runs 30 LEDs a second, a rosette takes about 3 seconds, an empty tray fills in about 26 and the scrape takes 3; the light swings round and back every 7 seconds. At 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Ridges. The points of the star nozzle, 5 to 10, and the star turns slowly as it goes so the ridges wind across each turn: at 5 two or three broad ridges with deep valleys between them, at 10 four or five fine ones close together.
// Knob 4: Swirl. How far each turn closes in, so how many turns a rosette takes: at -1 one turn lying flat, a coil 5 LEDs high; at 0 two and a half turns, each resting half on the one before, rising to a soft point about 12 high; at 1 nearly four turns, a tall tight swirl 17 high.
// Buttons: K1 tap scrapes the tray flat now, the foam rolling ahead of the blade and out at the bottom, and piping starts again from the top left.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sqrt, sin, cos, tan, atan2, abs, round, random, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// The tray: two rosettes across and four down, each in a square 32 LEDs on a side.
const COLS = 2, ROWS = 4, NR = COLS * ROWS, CWD = W / COLS, CHT = H / ROWS;
// The nozzle's path starts R0 LEDs from the rosette's centre; the bead it
// lays is RB LEDs in radius across and stands SQ times that tall.
const R0 = 10, RB = 4.6, SQ = 1.2;
// How deep the star's notches cut into the bead, and how far the star turns
// round the bead for each LED the nozzle travels.
const NOTCH = 0.45, TWIST = 0.11;
// The nozzle runs VN LEDs a second at Speed 2.
const VN = 30;
// A turn lands on the foam laid at least LAG LEDs of path earlier: the
// bead never sits on itself.
const LAG = 2.6 * RB;
// A soft light from the upper left (x right, y down the panel, z out of
// it), ELV radians above the tray, swings SWING radians either way and back
// every SWAY seconds at Speed 2, so shadows and sheen slide round the swirls.
const ELV = 0.58, TANE = tan(ELV), AZ0 = atan2(-0.65, -0.6), SWING = 0.5, SWAY = 7;
// Each LED keeps how high the foam stands toward the light, as a slope,
// looking SHADOW LEDs out at three bearings across the swing.
const SHADOW = 16, NAZ = 3;
// Opening hue: mint, not red.
const H0 = 0.45;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, ridges: 5, swirl: 0, begun: false,
    hgt: new Float32Array(N), lag: new Float32Array(N), t: 0,
    nx: new Float32Array(N), ny: new Float32Array(N), nz: new Float32Array(N).fill(1),
    ao: new Float32Array(N).fill(1), hz: new Float32Array(N * NAZ), foam: new Float32Array(N),
    pend: [], k: 0, pathS: 0, th: 0, ro: null, wait: 0,
    scraping: false, ys: 0, vol: new Float32Array(W), roll: new Float32Array(W), tmp: new Float32Array(W),
    dirty: [0, 0, W - 1, H - 1], prof: new Float32Array(41),
    lit: [0, 0, 0], dark: [0, 0, 0], tray: [0, 0, 0],
  };
}

// A rosette's place on the tray, a little off true as by hand, and where the
// nozzle starts round it.
function newRosette(S, k) {
  const c = k % COLS, r = floor(k / COLS);
  return {
    cx: (c + 0.5) * CWD + (random() - 0.5) * 1.6, cy: (r + 0.5) * CHT + (random() - 0.5) * 1.6,
    a0: random() * 2 * PI, dir: random() < 0.5 ? 1 : -1, tw: random() * 2 * PI,
  };
}

// The nozzle's path: angle th round the centre, out of 2 pi turns in all,
// the radius closing from R0 to nothing. Each turn closes in by a step: the
// bead's full width at Swirl -1, so the turns lie side by side; 0.9 of its
// radius at 0, so each turn rests half on the one before; 0.57 at 1, a tall
// cone.
const turnsOf = (S) => R0 / (RB * (S.swirl < 0 ? 0.9 - 1.1 * S.swirl : 0.9 - 0.33 * S.swirl));
function pathAt(S, ro, th) {
  const T = 2 * PI * turnsOf(S), u = cl(th / T, 0, 1), r = R0 * (1 - u) ** 0.8;
  const a = ro.a0 + ro.dir * th;
  return { x: ro.cx + r * cos(a), y: ro.cy + r * sin(a), r, u, a };
}

// The star bead's top across its width. The star's outline,
// rho = RB (1 - NOTCH + NOTCH (1 - |sin(n phi / 2)|)^2), sharp at the points
// and round in the notches, is walked at 96 angles over its upper half, and
// each edge between two of them lifts the 41 steps across it lies over.
const NP = 96;
function profile(S, alpha, scale) {
  const pr = S.prof, n = S.ridges;
  pr.fill(0);
  let ps = 0, pw = 0;
  for (let m = 0; m <= NP; m++) {
    const ph = (m / NP) * PI, cr = 1 - abs(sin((n * (ph + alpha)) / 2));
    const rho = RB * scale * (1 - NOTCH + NOTCH * cr * cr);
    const s = ((rho * cos(ph)) / RB) * 20 + 20, w = rho * sin(ph) * SQ;
    if (m > 0) {
      const a = min(s, ps), b = max(s, ps);
      for (let k = max(0, ceil(a)); k <= min(40, floor(b)); k++) {
        const t = b > a ? (k - ps) / (s - ps) : 0, v = pw + (w - pw) * t;
        if (v > pr[k]) pr[k] = v;
      }
    }
    ps = s;
    pw = w;
  }
}

function grow(S, x0, y0, x1, y1) {
  const d = S.dirty;
  d[0] = min(d[0], max(0, floor(x0)));
  d[1] = min(d[1], max(0, floor(y0)));
  d[2] = max(d[2], min(W - 1, ceil(x1)));
  d[3] = max(d[3], min(H - 1, ceil(y1)));
}

// Height of the foam laid at least LAG earlier, under a point, bilinear.
function lagAt(S, x, y) {
  const u = cl(x - 0.5, 0, W - 1.001), v = cl(y - 0.5, 0, H - 1.001), i = floor(u), j = floor(v), fu = u - i, fv = v - j;
  const g = S.lag, p = j * W + i;
  return (g[p] * (1 - fu) + g[p + 1] * fu) * (1 - fv) + (g[p + W] * (1 - fu) + g[p + W + 1] * fu) * fv;
}

// Lay the bead at one point of the path.
function lay(S, ro, th) {
  // The direction of travel, from a step back along the path, which still
  // has length at the centre where the radius closes to nothing.
  const P = pathAt(S, ro, th), Q = pathAt(S, ro, max(0, th - 0.15));
  let tx = P.x - Q.x, ty = P.y - Q.y;
  const tl = hypot(tx, ty);
  if (tl < 1e-4) {
    tx = -sin(P.a) * ro.dir;
    ty = cos(P.a) * ro.dir;
  } else {
    tx /= tl;
    ty /= tl;
  }
  // Over the last tenth the bead thins to a point as the nozzle lifts away.
  const scale = 1 - 0.75 * sm(0.88, 1, P.u), lift = 2.2 * sm(0.85, 1, P.u);
  profile(S, ro.tw + TWIST * S.pathS, scale);
  // The bead rests on the turn before: on the foam under the nozzle or a
  // little outward of it, whichever stands higher.
  const ox = P.r > 0.01 ? (P.x - ro.cx) / P.r : 0, oy = P.r > 0.01 ? (P.y - ro.cy) / P.r : 0, rest = 0.45 * RB;
  const base = max(lagAt(S, P.x, P.y), lagAt(S, P.x + ox * rest, P.y + oy * rest) - 0.6) + lift, pr = S.prof, R = RB + 1;
  for (let y = max(0, floor(P.y - R)); y <= min(H - 1, ceil(P.y + R)); y++)
    for (let x = max(0, floor(P.x - R)); x <= min(W - 1, ceil(P.x + R)); x++) {
      const dx = x + 0.5 - P.x, dy = y + 0.5 - P.y, along = dx * tx + dy * ty;
      if (abs(along) > 0.75) continue;
      const s = -dx * ty + dy * tx, b = ((s / RB) * 0.5 + 0.5) * 40;
      if (b < 0 || b > 40) continue;
      const b0 = floor(b), b1 = min(40, b0 + 1), f = b - b0, w0 = pr[b0], w1 = pr[b1];
      const v = base + w0 + (w1 - w0) * f, p = y * W + x;
      if (v > S.hgt[p]) {
        S.hgt[p] = v;
        S.pend.push(p, v, S.pathS);
      }
    }
  grow(S, P.x - R - 2, P.y - R - 2, P.x + R + SHADOW, P.y + R + SHADOW);
}

// Foam laid LAG or more of path ago becomes ground for the next turn.
function settle(S, all) {
  const q = S.pend;
  let k = 0;
  while (k < q.length && (all || S.pathS - q[k + 2] > LAG)) {
    const p = q[k];
    if (q[k + 1] > S.lag[p]) S.lag[p] = q[k + 1];
    k += 3;
  }
  if (k) q.splice(0, k);
}

function startScrape(S) {
  if (S.scraping) return;
  settle(S, true);
  S.scraping = true;
  S.ro = null;
  S.ys = -8;
  S.vol.fill(0);
  S.roll.fill(0);
}

function step(S, dt) {
  S.t += dt;
  if (S.scraping) {
    // A blade runs down the tray at 55 LEDs a second: everything above it
    // is taken up, rolled ahead of it, and leaves past the bottom edge.
    const y0 = S.ys, y1 = S.ys + 55 * dt;
    for (let y = max(0, ceil(y0)); y < min(H, ceil(y1)); y++)
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        S.vol[x] += S.hgt[p];
        S.hgt[p] = 0;
        S.lag[p] = 0;
      }
    S.ys = y1;
    // The roll spreads along the blade: its height across the panel is the
    // scraped foam smoothed over about a rosette's width, lumpy as foam.
    const v = S.vol, t = S.tmp, rl = S.roll;
    for (let pass = 0; pass < 2; pass++) {
      const a = pass ? t : v, b = pass ? rl : t;
      for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let k = -7; k <= 7; k++) sum += a[cl(x + k, 0, W - 1)];
        b[x] = sum / 15;
      }
    }
    for (let x = 0; x < W; x++) rl[x] = 0.55 * sqrt(rl[x]) * (0.85 + 0.15 * sin(x * 0.9 + S.ys * 0.21));
    grow(S, 0, y0 - 3, W - 1, y1 + 10 + SHADOW);
    if (S.ys > H + 14) {
      S.scraping = false;
      S.k = 0;
      S.wait = 0.5;
    }
    return;
  }
  if (S.wait > 0) {
    S.wait -= dt;
    return;
  }
  if (!S.ro) {
    if (S.k >= NR) {
      startScrape(S);
      return;
    }
    S.ro = newRosette(S, S.k);
    S.th = 0;
  }
  // The nozzle runs on along its spiral, laying the bead every 0.4 LED.
  const T = 2 * PI * turnsOf(S);
  let left = VN * dt;
  while (left > 0 && S.ro) {
    const P = pathAt(S, S.ro, S.th), ds = min(0.4, left);
    // Arc length per radian of the spiral, kept off zero at the centre.
    const sp = max(1.2, hypot(P.r, (0.8 * R0 * (1 - P.u) ** -0.2) / T));
    S.th += ds / sp;
    S.pathS += ds;
    left -= ds;
    if (S.th >= T) {
      lay(S, S.ro, T);
      settle(S, true);
      S.ro = null;
      S.k++;
      S.wait = 0.3;
      break;
    }
    lay(S, S.ro, S.th);
    settle(S, false);
  }
}

// A whole rosette at once, for the tray the pattern opens on.
function pipeNow(S) {
  S.ro = newRosette(S, S.k);
  S.th = 0;
  while (S.ro) step(S, 0.02);
  S.wait = 0;
}

// The roll of scraped foam ahead of the blade, at a column and row.
function rollAt(S, x, y) {
  const d = y + 0.5 - S.ys;
  if (!S.scraping || d < 0 || d > 8) return 0;
  return S.roll[x] * sin((PI * d) / 8) ** 0.7;
}

// Survey the foam inside the dirty box: its normal, how far it sits in a
// valley, and its horizon toward the light at each bearing.
function survey(S) {
  const d = S.dirty;
  if (d[0] > d[2]) return;
  const g = S.hgt, ht = (x, y) => {
    const xi = cl(x, 0, W - 1), yi = cl(y, 0, H - 1);
    return max(g[yi * W + xi], rollAt(S, xi, yi));
  };
  for (let y = d[1]; y <= d[3]; y++)
    for (let x = d[0]; x <= d[2]; x++) {
      const p = y * W + x, h0 = ht(x, y);
      const gx = (ht(x + 1, y) - ht(x - 1, y)) * 0.5, gy = (ht(x, y + 1) - ht(x, y - 1)) * 0.5;
      const inv = 1 / sqrt(gx * gx + gy * gy + 1);
      S.nx[p] = -gx * inv;
      S.ny[p] = -gy * inv;
      S.nz[p] = inv;
      // Valleys: the foam lower than its ring of neighbours two LEDs out.
      const ring = (ht(x - 2, y) + ht(x + 2, y) + ht(x, y - 2) + ht(x, y + 2)) * 0.25;
      S.ao[p] = 1 - 0.4 * sm(0, 2.2, ring - h0);
      S.foam[p] = sm(0.08, 0.7, h0);
      for (let k = 0; k < NAZ; k++) {
        const az = AZ0 + SWING * (k - 1), dx = cos(az), dy = sin(az);
        let hor = -1;
        for (let s = 1; s <= SHADOW; s++) {
          const e = (ht(round(x + dx * s), round(y + dy * s)) - h0) / s;
          if (e > hor) hor = e;
        }
        S.hz[k * N + p] = hor;
      }
    }
  d[0] = W;
  d[1] = H;
  d[2] = -1;
  d[3] = -1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.ridges = round(cl(k[2], 5, 10));
  S.swirl = cl(k[3], -1, 1);
  if (!S.begun) {
    // Open on a tray half piped.
    for (let i = 0; i < 4; i++) pipeNow(S);
    S.dirty = [0, 0, W - 1, H - 1];
    S.begun = true;
  }
  if (input.btnPressed && input.btnPressed[0]) startScrape(S);
  step(S, (d * S.speed) / 2);
}

function palette(S) {
  const h = S.hue + H0, hh = h - floor(h);
  // Peach, butter and lime go brown or olive when deep: there the foam is
  // paled, its shadows lifted, and the tray taken down to near black.
  const warm = sm(0.0, 0.07, hh) * (1 - sm(0.24, 0.34, hh));
  hsv(h, 0.3 - 0.1 * warm, 1, S.lit);
  hsv(h + 0.03, 0.5 - 0.2 * warm, 0.5 + 0.14 * warm, S.dark);
  hsv(h + 0.05, 0.75 - 0.4 * warm, 0.24 - 0.15 * warm, S.tray);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  survey(S);
  palette(S);
  const { nx, ny, nz, ao, hz, foam, lit, dark, tray } = S;
  // Where the light is now, and the half vector to the eye straight above.
  const az = AZ0 + SWING * sin((2 * PI * S.t) / SWAY), ce = cos(ELV);
  const lx = cos(az) * ce, ly = sin(az) * ce, lz = sin(ELV);
  const hl = hypot(lx, ly, lz + 1), hx = lx / hl, hy = ly / hl, hz2 = (lz + 1) / hl;
  const u = cl((az - AZ0) / SWING + 1, 0, 1.999), k = floor(u), fk = u - k, o0 = k * N, o1 = o0 + N;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, f = foam[p];
      // Diffuse from the normal, darkened in valleys and where the foam
      // toward the light stands above the light's own slope.
      const hor = hz[o0 + p] + (hz[o1 + p] - hz[o0 + p]) * fk;
      const shade = 1 - 0.8 * sm(TANE - 0.12, TANE + 0.4, hor);
      const nl = max(0, nx[p] * lx + ny[p] * ly + nz[p] * lz);
      const l = (0.2 + 0.8 * nl * shade) * ao[p];
      // A faint sheen: matte foam, not frosting.
      const nh = max(0, nx[p] * hx + ny[p] * hy + nz[p] * hz2), n2 = nh * nh, n4 = n2 * n2;
      const sp = 0.14 * n4 * n4 * n4 * n2 * shade * f;
      // Bare tray: its own colour, lit the same way and shadowed the same.
      const tl = 0.2 + 0.8 * l;
      const r = (dark[0] + (lit[0] - dark[0]) * l) * f + tray[0] * tl * (1 - f) + sp;
      const g = (dark[1] + (lit[1] - dark[1]) * l) * f + tray[1] * tl * (1 - f) + sp;
      const b = (dark[2] + (lit[2] - dark[2]) * l) * f + tray[2] * tl * (1 - f) + sp;
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
}
