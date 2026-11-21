// ===== Patternflow pattern =====
// Title:   Map Lichen
// Family:  lichen
// Idea:    Crustose lichen colonies on a bare rock face: each starts as a spore and grows outward as a rough, lobed disc at its own slow speed, stops a thin dark line short of any colony it meets, so the rock fills with a mosaic of rounded, mutually truncated patches with borders like a political map, while every old colony dies from the middle and leaves a living ring round a pale scar that weathers back to bare rock for new spores.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the map lichen Rhizocarpon geographicum and its black prothallus lines between neighbouring thalli, lichenometry (dating a rock face from the diameters of its map-lichen colonies, Roland Beschel), the Eden growth process on a lattice (Murray Eden, 1961), nucleation-and-growth mosaics (Kolmogorov 1937, Johnson and Mehl 1939, Avrami 1939), and cellular noise for the cracked areoles (Steven Worley, 1996); pattern round 209
// Round:   209
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0.4..3, Colonies=-1..1, Crust=-1..1
//
// Knob 1: Hue. Turns the palette of the lichen species round the colour wheel once. It opens on sulphur yellow-green, orange, grey-white, olive and sage; a quarter turn takes them through green and teal to blue, and at 1 they are back. The bare rock stays warm grey.
// Knob 2: Growth. How fast the colonies spread and age: the front moves 0.09 LEDs a second at 0.4, 0.45 at the opening 2 (one LED every 2.2 s, a colony 28 LEDs across in about 30 s) and 0.67 at 3. Spores keep landing at their own rate, so fast growth gives fewer, larger colonies and slow growth a crowd of small ones.
// Knob 3: Colonies. How often a spore lands and how big a colony gets before it stops: about one spore every 9 s and colonies up to 36 LEDs across at -1, one every 4 s and 26 across at the opening 0, one every 1.7 s and 17 across at 1.
// Knob 4: Crust. How coarse the crust is: areoles (the cracked islands) 2.8 LEDs across at -1 and a thin living ring, 3.6 at the opening 0.06, 4.9 at 1 with a thick ring about 9 LEDs wide, and deeper cracks as it goes up.

const W = 64;
const H = 128;
const N = W * H;
const { floor, round, exp, sin, cos, abs, min, max, sqrt, atan2, log, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;

const FREE = -1;
const ZONE = -2;
const NCOL = 72; // colony slots
const TW = 128; // the crack and lump fields live on a torus this big, and each colony reads it at its own offset
const TH = 256;

const SPORE0 = 0.4; // spores a second at Colonies 0 and Growth 2
const CLEAR = 3; // a spore needs this many LEDs of bare rock round it, each way
const V0 = 0.33; // LEDs a second for each unit of Growth, before a colony's own factor
const STEP = 0.1; // seconds a simulation step covers once the picture is running
const PRE = 330; // seconds of growth played before the first frame
const DIE = 2; // seconds a ring of dead crust takes to fade, past the live age's share (see colony())

// species: edge (young, pale), main, old (dull) as OKLCH [L, C, hue]; the hue turns with Hue
const SPECIES = [
  { w: 0.3, e: [0.88, 0.07, 106], m: [0.8, 0.088, 109], o: [0.66, 0.055, 104] }, // sulphur yellow-green
  { w: 0.18, e: [0.82, 0.055, 74], m: [0.7, 0.07, 60], o: [0.56, 0.045, 54] }, // orange, as Xanthoria
  { w: 0.2, e: [0.82, 0.012, 100], m: [0.76, 0.02, 104], o: [0.63, 0.016, 100] }, // grey-white
  { w: 0.15, e: [0.6, 0.055, 122], m: [0.5, 0.065, 120], o: [0.42, 0.04, 114] }, // dark olive
  { w: 0.17, e: [0.82, 0.04, 140], m: [0.72, 0.055, 136], o: [0.6, 0.035, 130] }, // sage
];
const ROCK = [0.53, 0.016, 76];
const SCAR = [0.66, 0.02, 85];
const DARK = [0.32, 0.03, 105];

function oklch(L, C, hDeg, out, o) {
  const h = (hDeg * PI) / 180;
  const a = C * cos(h);
  const b = C * sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  for (let i = 0; i < 3; i++) {
    const v = cl(lin[i], 0, 1);
    out[o + i] = 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055);
  }
}

function hash(ix, iy, s) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// A smooth value noise on the torus: a coarse lattice of random values, smoothstep between them.
function torusNoise(lam, seed) {
  const gx = max(2, round(TW / lam));
  const gy = max(2, round(TH / lam));
  const g = new Float32Array(gx * gy);
  for (let i = 0; i < g.length; i++) g[i] = hash(i % gx, floor(i / gx), seed);
  const out = new Float32Array(TW * TH);
  for (let y = 0; y < TH; y++) {
    const fy = (y / TH) * gy;
    const iy = floor(fy);
    const ty = sm(fy - iy);
    for (let x = 0; x < TW; x++) {
      const fx = (x / TW) * gx;
      const ix = floor(fx);
      const tx = sm(fx - ix);
      const a = g[(iy % gy) * gx + (ix % gx)];
      const b = g[(iy % gy) * gx + ((ix + 1) % gx)];
      const c = g[((iy + 1) % gy) * gx + (ix % gx)];
      const d = g[((iy + 1) % gy) * gx + ((ix + 1) % gx)];
      out[y * TW + x] = mix(mix(a, b, tx), mix(c, d, tx), ty);
    }
  }
  return out;
}

// Cracked areoles: cellular noise on the torus. D is F2 - F1, twice the distance to the nearest
// crack, AID a random 0..1 for each islet. Rebuilt when Crust moves the islet size.
function areoles(S, size) {
  const gx = max(8, round(TW / size));
  const gy = max(16, round(TH / size));
  const sx = TW / gx;
  const sy = TH / gy;
  const px = new Float32Array(gx * gy);
  const py = new Float32Array(gx * gy);
  const pid = new Float32Array(gx * gy);
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const k = j * gx + i;
      px[k] = (i + 0.04 + 0.92 * hash(i, j, S.seed + 1)) * sx;
      py[k] = (j + 0.04 + 0.92 * hash(i, j, S.seed + 2)) * sy;
      pid[k] = hash(i, j, S.seed + 3);
    }
  for (let y = 0; y < TH; y++) {
    const cj = floor(y / sy);
    for (let x = 0; x < TW; x++) {
      const ci = floor(x / sx);
      let f1 = 1e9;
      let f2 = 1e9;
      let id = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = (cj + dj + gy) % gy;
        const wy = cj + dj < 0 ? -TH : cj + dj >= gy ? TH : 0;
        for (let di = -1; di <= 1; di++) {
          const ii = (ci + di + gx) % gx;
          const wx = ci + di < 0 ? -TW : ci + di >= gx ? TW : 0;
          const k = jj * gx + ii;
          const dx = x + 0.5 - (px[k] + wx);
          const dy = y + 0.5 - (py[k] + wy);
          const d = dx * dx + dy * dy;
          if (d < f1) {
            f2 = f1;
            f1 = d;
            id = pid[k];
          } else if (d < f2) f2 = d;
        }
      }
      S.crackD[y * TW + x] = sqrt(f2) - sqrt(f1);
      S.crackId[y * TW + x] = id;
    }
  }
  S.areoleSize = size;
}

function colony(S, x, y, sp) {
  let c = null;
  for (let k = 0; k < NCOL; k++)
    if (!S.cols[k].alive) {
      c = S.cols[k];
      c.k = k;
      break;
    }
  if (!c) return;
  const r = Math.random;
  c.alive = true;
  c.x = x + 0.5;
  c.y = y + 0.5;
  c.g0 = S.G;
  c.sp = sp;
  c.v = V0 * (0.72 + 0.62 * r());
  c.rmax = S.rmax * (0.78 + 0.5 * r());
  const rot = r() * PI;
  c.ec = cos(rot);
  c.es = sin(rot);
  c.ay = 0.82 + 0.18 * r();
  c.br = 0.93 + 0.14 * r();
  c.a2 = 0.05 + 0.07 * r();
  c.a3 = 0.03 + 0.06 * r();
  c.a5 = 0.015 + 0.04 * r();
  c.p2 = r() * 6.28;
  c.p3 = r() * 6.28;
  c.p5 = r() * 6.28;
  c.q2 = (r() - 0.5) * 0.09;
  c.q3 = (r() - 0.5) * 0.12;
  c.q5 = (r() - 0.5) * 0.16;
  c.live = S.ring / c.v;
  c.fade = 0.65 * c.live + DIE;
  c.spread = 3.5 / c.v + 2;
  c.ox = floor(r() * TW);
  c.oy = floor(r() * TH);
  c.lx = floor(r() * TW);
  c.ly = floor(r() * TH);
  c.R = 1.5;
  c.n = 0;
  const i = floor(y) * W + floor(x);
  S.own[i] = c.k;
  S.cg[i] = S.G;
  c.n++;
}

// Where a spore lands: the best of a few random tries, the spot with the least crust round it,
// and it needs CLEAR LEDs of bare rock each way.
function spore(S) {
  let bx = -1;
  let by = -1;
  let bs = 1e9;
  for (let t = 0; t < 8; t++) {
    const x = floor(Math.random() * W);
    const y = floor(Math.random() * H);
    if (S.own[y * W + x] !== FREE) continue;
    let near = 0;
    let bad = false;
    for (let dy = -9; dy <= 9 && !bad; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      for (let dx = -9; dx <= 9; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= W) continue;
        if (S.own[yy * W + xx] === FREE) continue;
        if (abs(dx) <= CLEAR && abs(dy) <= CLEAR) {
          bad = true;
          break;
        }
        near++;
      }
    }
    if (bad) continue;
    near += Math.random() * 6;
    if (near < bs) {
      bs = near;
      bx = x;
      by = y;
    }
  }
  if (bx < 0) return;
  // a species unlike the ones close by, when there is one
  const seen = [0, 0, 0, 0, 0];
  for (let a = 0; a < 16; a++) {
    const th = (a / 16) * 2 * PI;
    for (let rr = 7; rr <= 13; rr += 6) {
      const xx = floor(bx + cos(th) * rr);
      const yy = floor(by + sin(th) * rr);
      if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const o = S.own[yy * W + xx];
      if (o >= 0) seen[S.cols[o].sp]++;
    }
  }
  let tot = 0;
  const wt = [];
  for (let s = 0; s < SPECIES.length; s++) {
    const w = SPECIES[s].w / (1 + 1.5 * seen[s]);
    wt.push(w);
    tot += w;
  }
  let pick = Math.random() * tot;
  let sp = 0;
  for (let s = 0; s < wt.length; s++) {
    pick -= wt[s];
    if (pick <= 0) {
      sp = s;
      break;
    }
  }
  colony(S, bx, by, sp);
}

function inside(c, jx, jy, j, G, S) {
  const dx = jx + 0.5 - c.x;
  const dy = jy + 0.5 - c.y;
  const u = dx * c.ec + dy * c.es;
  const w = (-dx * c.es + dy * c.ec) / c.ay;
  const rho2 = u * u + w * w;
  const lim = c.R * 1.25 + 1;
  if (rho2 > lim * lim) return false;
  const th = atan2(w, u);
  const lobe = 1 + c.a2 * sin(2 * th + c.p2 + c.q2 * G) + c.a3 * sin(3 * th + c.p3 + c.q3 * G) + c.a5 * sin(5 * th + c.p5 + c.q5 * G);
  return sqrt(rho2) < c.R * lobe + S.jit[j];
}

// A free cell is closed to a colony when another colony stands within two cells of it.
function blocked(S, jx, jy, k) {
  const own = S.own;
  for (let dy = -2; dy <= 2; dy++) {
    const yy = jy + dy;
    if (yy < 0 || yy >= H) continue;
    for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy > 4) continue;
      const xx = jx + dx;
      if (xx < 0 || xx >= W) continue;
      const o = own[yy * W + xx];
      if (o >= 0 && o !== k) return true;
    }
  }
  return false;
}

function toZone(S, jx, jy, k) {
  const own = S.own;
  const j = jy * W + jx;
  own[j] = ZONE;
  S.zdie[j] = 1e9;
  S.zg[j] = S.G;
  // close the gap on the way to the other colony
  for (let dy = -1; dy <= 1; dy++) {
    const yy = jy + dy;
    if (yy < 0 || yy >= H) continue;
    for (let dx = -1; dx <= 1; dx++) {
      const xx = jx + dx;
      if (xx < 0 || xx >= W) continue;
      const m = yy * W + xx;
      if (own[m] !== FREE) continue;
      let hit = false;
      for (let ey = -1; ey <= 1 && !hit; ey++) {
        const y2 = yy + ey;
        if (y2 < 0 || y2 >= H) continue;
        for (let ex = -1; ex <= 1; ex++) {
          const x2 = xx + ex;
          if (x2 < 0 || x2 >= W) continue;
          const o = own[y2 * W + x2];
          if (o >= 0 && o !== k) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        own[m] = ZONE;
        S.zdie[m] = 1e9;
        S.zg[m] = S.G;
      }
    }
  }
}

const NB = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

function step(S, dt) {
  const G = (S.G += dt * S.gs);
  S.T += dt;
  const own = S.own;
  const cg = S.cg;
  const cols = S.cols;
  // spores land at their own rate in panel time
  const lam = SPORE0 * S.sporeFac * pow(S.gs, -0.4);
  while (S.T >= S.nextSpore) {
    spore(S);
    S.nextSpore += -log(1 - Math.random()) / lam;
    if (S.nextSpore < S.T - 5) S.nextSpore = S.T;
  }
  for (let k = 0; k < NCOL; k++) {
    const c = cols[k];
    if (c.alive) c.R = min(c.rmax, 1.5 + c.v * (G - c.g0));
  }
  // one pass over the rock: crust that is too old goes back to bare stone, young crust at the
  // edge spreads to free cells it reaches and that no other colony stands close to
  let i = floor(Math.random() * N);
  for (let n = 0; n < N; n++, i += 4099) {
    if (i >= N) i -= N;
    if (i >= N) i %= N;
    const k = own[i];
    if (k < 0) continue;
    const c = cols[k];
    const age = G - cg[i];
    if (age > c.live + c.fade * (0.45 + 0.55 * S.rj[i])) {
      own[i] = FREE;
      c.n--;
      continue;
    }
    if (age > c.spread) continue;
    const x = i % W;
    const y = (i - x) / W;
    for (let b = 0; b < 8; b++) {
      const xx = x + NB[b][0];
      const yy = y + NB[b][1];
      if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const j = yy * W + xx;
      if (own[j] !== FREE) continue;
      if (!inside(c, xx, yy, j, G, S)) continue;
      if (blocked(S, xx, yy, k)) {
        toZone(S, xx, yy, k);
        continue;
      }
      own[j] = k;
      cg[j] = G;
      c.n++;
    }
  }
  // dark lines stay while a colony stands near them, then fade
  S.zph = (S.zph + 1) & 7;
  for (let i = S.zph; i < N; i += 8) {
    if (own[i] !== ZONE) continue;
    const x = i % W;
    const y = (i - x) / W;
    // a line stays while two colonies still stand on either side of it
    let first = -1;
    let has = false;
    for (let dy = -3; dy <= 3 && !has; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= W) continue;
        const o = own[yy * W + xx];
        if (o < 0) continue;
        const co = cols[o];
        if (G - cg[yy * W + xx] > co.live + 0.3 * co.fade) continue;
        if (first < 0) first = o;
        else if (o !== first) {
          has = true;
          break;
        }
      }
    }
    if (has) S.zdie[i] = 1e9;
    else if (S.zdie[i] > 1e8) S.zdie[i] = G;
    else if (G - S.zdie[i] > 4) own[i] = FREE;
  }
  for (let k = 0; k < NCOL; k++) {
    const c = cols[k];
    if (c.alive && c.n <= 0 && G - c.g0 > 2) c.alive = false;
  }
}

export function setup(params) {
  const S = {
    seed: floor(Math.random() * 1e6),
    G: 0,
    T: 0,
    gs: 1,
    nextSpore: 0,
    zph: 0,
    acc: 0,
    rolled: false,
    hue: 0,
    sporeFac: 1,
    rmax: 13,
    ring: 7,
    palKey: -1,
    areoleSize: 0,
  };
  S.own = new Int16Array(N).fill(FREE);
  S.cg = new Float32Array(N);
  S.zdie = new Float32Array(N);
  S.zg = new Float32Array(N);
  S.jit = new Float32Array(N);
  S.rj = new Float32Array(N);
  S.grain = new Float32Array(N);
  S.cols = [];
  for (let k = 0; k < NCOL; k++) S.cols.push({ alive: false, k });
  // static fields: the ragged edge, which crumbs of dead crust go first, the rock's grain
  const white = new Float32Array(N);
  for (let i = 0; i < N; i++) white[i] = Math.random();
  const blur = (src) => {
    const dst = new Float32Array(N);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
            s += src[yy * W + xx];
            n++;
          }
        dst[y * W + x] = s / n;
      }
    return dst;
  };
  const sm1 = blur(blur(blur(blur(white))));
  // spread the blurred values back over 0..1
  const sorted = Float32Array.from(sm1).sort();
  for (let i = 0; i < N; i++) {
    let lo = 0;
    let hi = N - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < sm1[i]) lo = mid + 1;
      else hi = mid;
    }
    S.rj[i] = lo / (N - 1);
    S.jit[i] = (white[i] - 0.5) * 0.9 + (S.rj[i] - 0.5) * 0.8;
    S.grain[i] = Math.random();
  }
  S.lump = torusNoise(15, S.seed + 11);
  S.lump2 = torusNoise(7, S.seed + 12);
  S.rockLump = torusNoise(11, S.seed + 13);
  S.crackD = new Float32Array(TW * TH);
  S.crackId = new Float32Array(TW * TH);
  S.pal = new Float32Array(SPECIES.length * 9 + 12);
  S.buf = new Float32Array(3);
  params.s = S;
}

function knobs(S, kn) {
  S.hue = cl(kn[0], 0, 1);
  const grow = cl(kn[1], 0.4, 3);
  S.gs = grow / 2;
  const col = cl(kn[2], -1, 1);
  S.sporeFac = pow(2.4, col);
  S.rmax = 13 / sqrt(S.sporeFac);
  const cr = cl(kn[3], -1, 1);
  S.crust = cr;
  S.ring = 8.5 * pow(1.25, cr);
  S.areole = 4 * pow(1.28, cr);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  knobs(S, input.knobValues || [0, 2, 0, 0.06]);
  if (!S.rolled) {
    S.rolled = true;
    // Let the rock grow before the first frame: PRE seconds of growth with the knobs as they are.
    const real = cl(PRE / S.gs, PRE * 0.7, PRE * 3.3);
    const ds = cl(0.9 / max(S.gs, 0.5), 0.3, 3.5);
    const n = floor(real / ds);
    S.nextSpore = S.T;
    for (let k = 0; k < n; k++) step(S, real / n);
    S.acc = 0;
  }
  S.acc += cl(dt || 0, 0, 0.2);
  let guard = 0;
  while (S.acc >= STEP && guard++ < 4) {
    step(S, STEP);
    S.acc -= STEP;
  }
}

// Colours for this Hue: per species edge, main, old, then rock, scar, dark; sRGB 0..255.
function palette(S) {
  if (S.palKey === S.hue) return;
  S.palKey = S.hue;
  const turn = 360 * S.hue;
  const P = S.pal;
  for (let s = 0; s < SPECIES.length; s++) {
    const sp = SPECIES[s];
    for (let q = 0; q < 3; q++) {
      const a = q === 0 ? sp.e : q === 1 ? sp.m : sp.o;
      // the greys keep their chroma, so they stay grey under any turn
      oklch(a[0], a[1], a[2] + turn, P, s * 9 + q * 3);
    }
  }
  const o = SPECIES.length * 9;
  oklch(ROCK[0], ROCK[1], ROCK[2], P, o);
  oklch(SCAR[0], SCAR[1], SCAR[2], P, o + 3);
  oklch(DARK[0], DARK[1], DARK[2], P, o + 6);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  if (abs(S.areole - S.areoleSize) > 0.02) areoles(S, S.areole);
  const P = S.pal;
  const po = SPECIES.length * 9;
  const rr = P[po];
  const rg = P[po + 1];
  const rb = P[po + 2];
  const sr = P[po + 3];
  const sg = P[po + 4];
  const sb = P[po + 5];
  const dr = P[po + 6];
  const dg = P[po + 7];
  const db = P[po + 8];
  const G = S.G + S.acc * S.gs;
  const T = S.T + S.acc;
  const own = S.own;
  const cg = S.cg;
  const cols = S.cols;
  const crack = 0.5 + 0.5 * (S.crust + 1) * 0.5; // deeper cracks as Crust goes up
  const asz = S.areoleSize;
  // light on the rock face: a few broad swells that drift slowly past each other
  const t1 = T * 0.37 + 11;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const k = own[i];
      const light =
        1 +
        0.055 * sin(0.052 * x + 0.021 * y + 0.061 * t1) +
        0.05 * sin(0.019 * x - 0.043 * y + 0.047 * t1 + 2) +
        0.035 * sin(0.033 * x + 0.037 * y - 0.083 * t1 + 4);
      // bare rock under this cell
      const rl = 0.93 + 0.1 * S.grain[i] + 0.1 * (S.rockLump[((y + 40) & (TH - 1)) * TW + ((x + 17) & (TW - 1))] - 0.5);
      let r = rr * rl;
      let g = rg * rl;
      let b = rb * rl;
      if (k === FREE) {
        // faint stains where crust has died back
      } else if (k === ZONE) {
        let a = sm((G - S.zg[i]) / 2.5);
        if (S.zdie[i] < 1e8) a *= 1 - sm((G - S.zdie[i]) / 4);
        const dk = 0.85 + 0.3 * S.grain[i];
        r += (dr * dk - r) * a;
        g += (dg * dk - g) * a;
        b += (db * dk - b) * a;
      } else {
        const c = cols[k];
        const age = G - cg[i];
        const sp = c.sp * 9;
        const t = age / c.live;
        // crust colour by age: pale at the edge, full in the ring, duller behind
        const s1 = sm(t / 0.3);
        const s2 = sm((t - 0.5) / 0.5);
        let cr = P[sp] + (P[sp + 3] - P[sp]) * s1 + (P[sp + 6] - P[sp + 3]) * s2;
        let cgc = P[sp + 1] + (P[sp + 4] - P[sp + 1]) * s1 + (P[sp + 7] - P[sp + 4]) * s2;
        let cb = P[sp + 2] + (P[sp + 5] - P[sp + 2]) * s1 + (P[sp + 8] - P[sp + 5]) * s2;
        // dead: d runs 0..1 from the end of the live age to this cell's weathering
        const rel = c.fade * (0.45 + 0.55 * S.rj[i]);
        const d = cl((age - c.live) / rel, 0, 1);
        const pale = sm(d / 0.25) * 0.8;
        // the scar keeps a little of the species' own colour
        cr += (sr * 0.8 + P[sp + 6] * 0.2 - cr) * pale;
        cgc += (sg * 0.8 + P[sp + 7] * 0.2 - cgc) * pale;
        cb += (sb * 0.8 + P[sp + 8] * 0.2 - cb) * pale;
        // large soft lumps, and the colony's own brightness
        const lx = ((y + c.ly) & (TH - 1)) * TW + ((x + c.lx) & (TW - 1));
        const lumpv = (S.lump[lx] - 0.5) * 0.42 + (S.lump2[lx] - 0.5) * 0.08;
        // cracked areoles: none in the young crust, deeper with age, widest in the dying middle
        const ci = ((y + c.oy) & (TH - 1)) * TW + ((x + c.ox) & (TW - 1));
        const D = S.crackD[ci];
        const gone = sm((d - 0.7) / 0.3);
        const ca = sm((t - 0.08) / 0.6) * (1 - gone);
        const wide = 0.45 + 0.55 * sm(t / 1.3);
        const edge = sm((D - (0.35 + 0.45 * wide * crack)) / 0.55);
        const dome = sm(D / (0.6 * asz));
        let shade = 1 + lumpv + (S.crackId[ci] - 0.5) * 0.12 * ca;
        shade *= 1 - ca * 0.24 * (1 - dome);
        const cm = ca * (1 - edge) * (0.45 + 0.2 * crack);
        shade *= c.br;
        cr = cr * shade;
        cgc = cgc * shade;
        cb = cb * shade;
        cr += (dr * 1.1 - cr) * cm;
        cgc += (dg * 1.1 - cgc) * cm;
        cb += (db * 1.1 - cb) * cm;
        // a thin darker rim where crust meets open rock
        let nf = 0;
        if (x > 0 && own[i - 1] === FREE) nf++;
        if (x < W - 1 && own[i + 1] === FREE) nf++;
        if (y > 0 && own[i - W] === FREE) nf++;
        if (y < H - 1 && own[i + W] === FREE) nf++;
        const rim = 1 - 0.07 * nf * (1 - gone);
        cr *= rim;
        cgc *= rim;
        cb *= rim;
        // new crust arrives out of the rock
        const em = sm(age / 1.6) * (1 - gone);
        r += (cr - r) * em;
        g += (cgc - g) * em;
        b += (cb - b) * em;
      }
      display.setPixel(x, y, cl(r * light, 0, 255), cl(g * light, 0, 255), cl(b * light, 0, 255));
    }
  }
}
