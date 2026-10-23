// ===== Patternflow pattern =====
// Title:   Stained Glass
// Family:  glass
// Idea:    A gothic lancet window fills the standing panel, a rose in its pointed head and a tree of life in its shaft, every piece of jewel glass held in black lead, and the light through it brightens and moves as the sun crosses behind and a cloud shadow passes.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 18, after the medallion lancets and Jesse Tree windows of Chartres
// Round:   18
// ===============================
// @matrix 64x128
// @knobs Glass=0..1, Speed=0.2..3, Pieces=1..4, Clouds=0..1
//
// Knob 1: Glass. Turns every pane round the colour wheel together, starting from the cathedral set: a cobalt ground, a ruby and gold border, ruby petals and emerald leaves.
// Knob 2: Speed. How fast the sun and the clouds travel behind the window: at 2 the sun takes 26 s to cross it and comes round every 64 s, and a cloud shadow sweeps over in about 6 s; at 0.2 the light hardly moves.
// Knob 3: Pieces. How finely the glazier cut the glass: at 1 the border squares are 5 LEDs long and the blue quarries 7 across, at 4 they are 3.5 and 4, and the rose gets 12 petals instead of 8.
// Knob 4: Clouds. At 0.06 one cumulus drifts across now and then; turned up, more and darker clouds follow and hide the sun, until the window glows only in patches.

const W = 64;
const H = 128;
const N = W * H;
const HALF = 32;
const TAU = Math.PI * 2;
// The window: its axis, half width, and an equilateral pointed arch whose two
// arcs have the span (62) as radius and spring from row 55.
const X0 = 32;
const WH = 31;
const R = 62;
const YS = 55;
// Iron saddle bars across the shaft, one row each.
const BARS = [55, 80, 105];
// The rose in the arch head: centre row and radius.
const ROSE_Y = 34;
const ROSE_R = 17.5;
// Kinds of glass, and their colour at Glass 0.
const RUBY = 0;
const GOLD = 1;
const WHITE = 2;
const COBALT = 3;
const SKY = 4;
const EMERALD = 5;
const LEAF = 6;
const AMBER = 7;
const VIOLET = 8;
const PINK = 9;
const STEM = 10;
const GLASS = [
  [212, 26, 38],
  [236, 176, 34],
  [214, 222, 204],
  [30, 60, 208],
  [62, 134, 228],
  [24, 170, 82],
  [130, 198, 46],
  [214, 116, 28],
  [140, 46, 194],
  [228, 92, 150],
  [236, 210, 128],
];
// Not glass: stone round the window, lead cames and the iron bars.
const STONE = -1;
const LEAD = -2;
const IRON = -3;
const DARK = { [STONE]: [11, 9, 8], [LEAD]: [8, 8, 10], [IRON]: [6, 6, 7] };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function rotateHue(rgb, turn) {
  const [r, g, b] = rgb.map((v) => v / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const c = mx - mn;
  let h = 0;
  if (c > 0) {
    if (mx === r) h = ((g - b) / c + 6) % 6;
    else if (mx === g) h = (b - r) / c + 2;
    else h = (r - g) / c + 4;
  }
  h = (((h / 6 + turn) % 1) + 1) % 1;
  const s = mx > 0 ? c / mx : 0;
  const k = (n) => {
    const q = (n + h * 6) % 6;
    return mx * (1 - s * clamp(Math.min(q, 4 - q), 0, 1));
  };
  return [k(5) * 255, k(3) * 255, k(1) * 255];
}

// A quadratic curve sampled into points with their running length.
function curve(a, b, c, n) {
  const pts = [];
  let len = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = (1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * b[0] + t * t * c[0];
    const y = (1 - t) * (1 - t) * a[1] + 2 * t * (1 - t) * b[1] + t * t * c[1];
    if (i) len += Math.hypot(u - pts[pts.length - 1][0], y - pts[pts.length - 1][1]);
    pts.push([u, y, len]);
  }
  return pts;
}

// The tree of life, drawn on the left half (u is the distance from the axis):
// in each panel of the shaft a branch leaves the trunk, curls up and out and
// ends in a flower, with a leaf hanging under it and one standing over it.
function tree() {
  const tiers = [];
  for (const [y0, flower] of [
    [75, PINK],
    [100, RUBY],
  ]) {
    const pts = curve([1.5, y0], [5, y0 - 7], [13.5, y0 - 9], 16);
    const at = (t) => pts[Math.round(t * 16)];
    const a = at(0.55);
    const b = at(0.3);
    tiers.push({
      pts,
      box: [0, y0 - 19, 30, y0 + 9],
      flower: [16.5, y0 - 11, 5.2, flower],
      leaves: [
        [a[0] + 2.6, a[1] + 3.6, 0.55, 4.6, 2.2],
        [b[0] + 4.8, b[1] + 4.6, 0.95, 4.2, 2.0],
        [b[0] - 1.2, b[1] - 6, -1.75, 4.0, 1.9],
      ],
    });
  }
  // Two long lily leaves rise from the foot of the trunk in the lowest panel.
  const low = {
    pts: [],
    box: [0, 104, 32, 122],
    flower: null,
    leaves: [
      [9, 113, -2.45, 7.5, 2.4],
      [19, 115.5, -2.75, 6, 2.2],
    ],
  };
  tiers.push(low);
  return tiers;
}

// What the glazier cut at one point of the left half: a kind of glass (or
// STONE, IRON) and two numbers that name the piece.
function cell(px, py, cut, T) {
  const u = X0 - px;
  const side = WH - u;
  const bottom = 127 - py;
  let d = Math.min(side, bottom);
  const arch = py < YS;
  if (arch) d = Math.min(d, R - Math.hypot(WH + u, YS - py));
  if (d <= 0) return [STONE, 0, 0];
  // The border of small square quarries and the white pearled fillet inside it.
  if (d <= 6.2) {
    const fillet = d > 4.2;
    const len = fillet ? 3 : 5 - 1.5 * cut;
    let part;
    let i;
    if (arch) {
      const rr = R - d;
      const top = Math.atan2(Math.sqrt(rr * rr - WH * WH), WH);
      i = Math.floor(((top - Math.atan2(YS - py, WH + u)) * rr) / len + 0.5);
      part = 0;
    } else if (side < bottom) {
      i = Math.floor((py - YS) / len);
      part = 1;
    } else {
      i = Math.floor(u / len + 0.5);
      part = 2;
    }
    if (fillet) return [WHITE, 10 + part, i];
    return [i % 2 ? GOLD : RUBY, 20 + part, i];
  }
  for (const yb of BARS) if (py >= yb && py < yb + 1) return [IRON, 0, 0];

  // The rose: a gold boss, petals, a ring of pearls and a rim.
  const ry = py - ROSE_Y;
  const rr = Math.hypot(u, ry);
  if (rr < ROSE_R) {
    const th = Math.atan2(u, -ry);
    if (rr < 3) return [GOLD, 30, 0];
    const n1 = cut < 0.5 ? 8 : 12;
    const s1 = TAU / n1;
    if (rr < 11) {
      const k = Math.floor(th / s1 + 0.5);
      const t = Math.abs(th - k * s1) / (s1 / 2);
      if (rr < 3 + 8 * Math.sqrt(Math.max(0, 1 - t * t))) return [RUBY, 31, k];
      return [SKY, 32, Math.floor(th / s1)];
    }
    const n2 = cut < 0.5 ? 16 : 24;
    const k2 = Math.floor(th / (TAU / n2) + 0.5);
    if (rr < 13.6) return [k2 % 2 ? WHITE : GOLD, 33, k2];
    return [k2 % 2 ? VIOLET : EMERALD, 34, k2];
  }

  // The tree.
  for (let ti = 0; ti < T.length; ti++) {
    const tier = T[ti];
    const [b0, b1, b2, b3] = tier.box;
    if (u < b0 || u > b2 || py < b1 || py > b3) continue;
    if (tier.flower) {
      const [fu, fy, fr, kind] = tier.flower;
      const du = u - fu;
      const dy = py - fy;
      const f = Math.hypot(du, dy);
      if (f < fr + 0.5) {
        if (f < 2.1) return [GOLD, 40 + ti, 0];
        const a = Math.atan2(du, -dy);
        const n = cut < 0.5 ? 5 : 7;
        const k = Math.floor(((a / TAU) * n + n + 0.5) % n);
        const c = Math.abs(Math.cos((a * n) / 2));
        if (f < fr * (0.74 + 0.26 * c)) return [kind, 44 + ti, k];
      }
    }
    for (let li = 0; li < tier.leaves.length; li++) {
      const [lu, ly, al, la, lb] = tier.leaves[li];
      const du = u - lu;
      const dy = py - ly;
      const q1 = (du * Math.cos(al) + dy * Math.sin(al)) / la;
      const q2 = (-du * Math.sin(al) + dy * Math.cos(al)) / lb;
      if (Math.abs(q1) < 1 && Math.abs(q2) < 1 - q1 * q1) {
        const half = cut >= 0.5 && q2 < 0 ? 1 : 0;
        return [(li + ti) % 2 ? LEAF : EMERALD, 50 + ti * 8 + li * 2 + half, 0];
      }
    }
    const pts = tier.pts;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay, al] = pts[i - 1];
      const [bx, by] = pts[i];
      const vx = bx - ax;
      const vy = by - ay;
      const t = clamp(((u - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1);
      if (Math.hypot(u - ax - t * vx, py - ay - t * vy) < 2) {
        const s = al + t * Math.hypot(vx, vy);
        return [GOLD, 70 + ti, Math.floor(s / (8 - 3 * cut))];
      }
    }
  }
  // The trunk, rooted in the mound and reaching up into the rose.
  const mound = 117.5 + 0.009 * u * u;
  if (py > ROSE_Y && py < mound + 1 && u < 1.9 + 1.6 * clamp((py - 56) / 62, 0, 1)) return [STEM, 80, Math.floor((py - 56) / (9 - 3 * cut))];
  if (py >= mound) {
    const row = Math.floor((py - mound) / 3.2);
    const col = Math.floor((u + (row % 2) * 3) / (7 - 2 * cut));
    return [(row + col) % 2 ? LEAF : EMERALD, 90 + row, col];
  }

  // The ground: diamond quarries of cobalt, here and there sky blue or violet.
  const q = 7 - 3 * cut;
  const a = Math.floor((u + py) / q);
  const b = Math.floor((py - u) / q);
  const h = (((a * 73856093) ^ (b * 19349663)) >>> 0) % 13;
  return [h < 2 ? SKY : h === 2 ? VIOLET : COBALT, 100 + (a & 1023), b + 512];
}

function build(P, cut) {
  P.cut = cut;
  const T = tree();
  const key = new Float64Array(HALF * H);
  const kind = new Int8Array(HALF * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < HALF; x++) {
      const [k, a, b] = cell(x + 0.5, y + 0.5, cut, T);
      kind[y * HALF + x] = k;
      key[y * HALF + x] = k < 0 ? k : (k * 1000 + a) * 4096 + b + 2048;
    }
  // A lead came runs along every join: the LED on the left of or above a join
  // between two pieces becomes lead.
  const lead = new Uint8Array(HALF * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < HALF; x++) {
      const p = y * HALF + x;
      if (kind[p] < 0) continue;
      if ((x < HALF - 1 && key[p + 1] !== key[p]) || (y < H - 1 && key[p + HALF] !== key[p])) lead[p] = 1;
    }
  // Pieces that reach the axis are one piece with their mirror image.
  const central = new Set();
  for (let y = 0; y < H; y++) if (!lead[y * HALF + HALF - 1]) central.add(key[y * HALF + HALF - 1]);
  const ids = new Int32Array(N);
  const index = new Map();
  const kinds = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const left = x < HALF;
      const p = y * HALF + (left ? x : W - 1 - x);
      if (kind[p] < 0) ids[y * W + x] = kind[p];
      else if (lead[p]) ids[y * W + x] = LEAD;
      else {
        const k = left || central.has(key[p]) ? key[p] : -key[p] - 1;
        let id = index.get(k);
        if (id === undefined) {
          id = kinds.length;
          index.set(k, id);
          kinds.push(kind[p]);
        }
        ids[y * W + x] = id;
      }
    }
  const n = kinds.length;
  const cx = new Float32Array(n);
  const cy = new Float32Array(n);
  const count = new Float32Array(n);
  for (let p = 0; p < N; p++) {
    const id = ids[p];
    if (id < 0) continue;
    cx[id] += p % W;
    cy[id] += Math.floor(p / W);
    count[id]++;
  }
  // Each piece is its own sheet: a little lighter or darker and warmer or
  // cooler than its neighbours, with faint streaks running one way across it.
  const tint = new Float32Array(n * 3);
  const streak = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    cx[i] = cx[i] / count[i] + 0.5;
    cy[i] = cy[i] / count[i] + 0.5;
    const v = 0.84 + 0.16 * Math.random();
    for (let c = 0; c < 3; c++) tint[i * 3 + c] = v * (0.94 + 0.12 * Math.random());
    const ang = Math.random() * Math.PI;
    streak[i * 3] = (Math.cos(ang) * TAU) / 10;
    streak[i * 3 + 1] = (Math.sin(ang) * TAU) / 10;
    streak[i * 3 + 2] = Math.random() * TAU;
  }
  // Antique glass is uneven: per LED a speck of grain, along the streaks a
  // ripple of 2.5 levels, and now and then a seed of trapped air.
  const tex = new Int8Array(N * 3);
  for (let p = 0; p < N; p++) {
    const id = ids[p];
    const x = p % W;
    const y = Math.floor(p / W);
    if (id < 0) {
      for (let c = 0; c < 3; c++) tex[p * 3 + c] = Math.floor(Math.random() * 3) - 1;
      continue;
    }
    const s = 2.5 * Math.sin(x * streak[id * 3] + y * streak[id * 3 + 1] + streak[id * 3 + 2]);
    const seed = Math.random() < 0.012 ? 7 : 0;
    for (let c = 0; c < 3; c++) tex[p * 3 + c] = Math.round(s + seed) + Math.floor(Math.random() * 5) - 2;
  }
  Object.assign(P, { ids, kinds, cx, cy, tint, tex, n, col: new Float32Array(n * 3) });
}

export function setup(params) {
  const P = params;
  P.tau = 0;
  P.started = false;
  P.cut = -1;
  P.hue = -1;
  P.palette = GLASS;
  P.noise = new Float32Array(24 * 12);
  for (let i = 0; i < P.noise.length; i++) P.noise[i] = Math.random();
}

// The light behind a point of the window: the sky, the sun's glow and the
// cloud shadows, from about 0.3 to 1, and how much of it is the sun.
function light(P, x, y) {
  const g = Math.exp(-((x - P.sx) ** 2 + (y - P.sy) ** 2) / (2 * 24 * 24)) * P.sunClear;
  let shade = 0;
  for (const c of P.clouds) shade += c.dark * Math.exp(-(((x - c.x) / c.rx) ** 2 + ((y - c.y) / c.ry) ** 2));
  // Cumulus is lumpy: its shadow is mottled in puffs about 11 LEDs across
  // that travel with the wind.
  if (shade > 0.01) shade *= 0.15 + 1.4 * puff(P, x - P.wind, y);
  shade = Math.min(0.55, shade);
  const sky = P.skyLight * (1 - 0.1 * (y / H));
  return [(sky + (1 - sky) * g) * (1 - shade), g * (1 - shade)];
}

// Smooth value noise on a 24 by 12 lattice of 11 LED cells, wrapping.
function puff(P, x, y) {
  const gx = x / 11;
  const gy = y / 11;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (i, j) => P.noise[(((j % 12) + 12) % 12) * 24 + (((i % 24) + 24) % 24)];
  const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
  const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
  return a + (b - a) * sy;
}

// The sun and the clouds at time tau (seconds at Speed 2).
function sky(P, cloudy) {
  const tau = P.tau;
  // The sun crosses a 160 LED stretch of sky in 64 s, low at the sides and
  // highest over the rose, then comes round again unseen.
  const sx = ((tau * 2.5 + 23) % 160) - 48;
  P.sx = sx;
  P.sy = 36 + 0.006 * (sx - X0) * (sx - X0);
  // Clouds drift right at 18 LEDs a second through a 280 LED loop, each two
  // puffs. The first is always there; more come in as Clouds turns up.
  P.clouds = [];
  P.wind = tau * 18;
  const C = [
    [61.5, 48, 24, 38, 0.5],
    [131, 24, 20, 26, 0.5],
    [201, 100, 26, 30, 0.5],
    [271, 72, 18, 44, 0.55],
    [26, 16, 30, 24, 0.5],
    [166, 114, 22, 22, 0.5],
  ];
  for (let i = 0; i < C.length; i++) {
    const [x0, y, rx, ry, dark] = C[i];
    const w = i === 0 ? 1 : clamp(cloudy * 6 - i + 0.6, 0, 1);
    if (w <= 0) continue;
    const x = ((x0 + tau * 18) % 280) - 70;
    const dk = dark * w * (0.85 + 0.4 * cloudy);
    const yy = y + 5 * Math.sin(tau * 0.07 + i);
    P.clouds.push({ x, y: yy, rx, ry, dark: dk });
    P.clouds.push({ x: x - rx * 0.9, y: yy + ry * 0.45, rx: rx * 0.7, ry: ry * 0.6, dark: dk * 0.6 });
  }
  // A cloud over the sun takes its glow, and an overcast sky takes some of it
  // anyway and turns the daylight grey and cool.
  let over = 0;
  for (const c of P.clouds) over += c.dark * 1.6 * Math.exp(-(((P.sx - c.x) / c.rx) ** 2 + ((P.sy - c.y) / c.ry) ** 2));
  P.sunClear = clamp(1 - over, 0, 1) * (1 - 0.75 * cloudy);
  P.skyLight = 0.64 - 0.12 * cloudy;
  P.cool = cloudy;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = clamp(dt, 0, 0.1);
  const hue = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0, 3) / 2;
  const cut = Math.round(clamp((k[2] - 1) / 3, 0, 1) * 6) / 6;
  P.cloudy = clamp(k[3], 0, 1);
  if (cut !== P.cut) build(P, cut);
  if (hue !== P.hue) {
    P.hue = hue;
    P.palette = GLASS.map((c) => rotateHue(c, hue));
  }
  // The window opens with the sun just inside its left edge and the first
  // cloud coming up behind it, ten seconds further on at the knob's speed,
  // so the opening light already differs from one Speed to the next.
  if (!P.started) {
    P.started = true;
    P.tau = 2 + 10 * speed;
  }
  P.tau += dt * speed;
}

export function draw(display, params) {
  const P = params;
  if (P.cut < 0) return;
  sky(P, P.cloudy);
  const { kinds, cx, cy, tint, col, palette, ids, tex } = P;
  // Sunlight is warm; an overcast sky is grey and a little blue.
  const day = [1 - 0.22 * P.cool, 1 - 0.1 * P.cool, 0.94 + 0.1 * P.cool];
  for (let i = 0; i < P.n; i++) {
    const [L, g] = light(P, cx[i], cy[i]);
    // Where the sun stands right behind the glass it burns toward white.
    const bloom = 0.5 * g * g * g;
    const base = palette[kinds[i]];
    for (let c = 0; c < 3; c++) {
      const v = base[c] * tint[i * 3 + c] * L * day[c];
      col[i * 3 + c] = v + ((c === 2 ? 225 : 255) - v) * bloom;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const id = ids[p];
      const c = id < 0 ? DARK[id] : null;
      const r = c ? c[0] : col[id * 3];
      const g = c ? c[1] : col[id * 3 + 1];
      const b = c ? c[2] : col[id * 3 + 2];
      display.setPixel(x, y, Math.round(r) + tex[p * 3], Math.round(g) + tex[p * 3 + 1], Math.round(b) + tex[p * 3 + 2]);
    }
}
