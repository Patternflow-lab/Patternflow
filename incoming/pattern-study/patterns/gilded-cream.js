// ===== Patternflow pattern =====
// Title:   Gilded Cream
// Family:  cosmetic
// Idea:    A thick ivory cream with flakes of gold leaf in it is stretched and folded over itself again and again like a baker's dough, seen from the side, so the few flakes are drawn out into long gold veins and then into thinner and more of them, layer on layer, while a small lamp drifts over the cream's soft relief and the gold glints where it finds it, until the gold is a fine shimmer, the cream settles smooth and fresh flakes are scattered in for the next round.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 35, after the folded baker's map of ergodic theory and gold-leaf cream in white and gold packaging
// Round:   35
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Fold=2..4, Gold=0..1
//
// Knob 1: Hue. Tints the cream once round the wheel while the leaf stays gold. At 0 ivory, at 0.1 pistachio, at 0.25 mint, at 0.45 sky blue, at 0.6 lavender, at 0.78 pink, at 0.9 blush, at 0.95 peach. Round blush, peach, ivory and pistachio the tint is kept pale, because a deeper cream there reads beige or khaki next to the gold.
// Knob 2: Speed. At 2 a fold takes 2 seconds and the cream rests 0.7 between folds; a round of five folds, the settling and the new flakes takes about 15 seconds. At 0.2 all of it runs ten times slower.
// Knob 3: Fold. How many layers each fold makes. At 2 the cream is stretched to twice its length and folded once over itself, five folds a round; at 3 it is stretched threefold and folded in thirds like a letter, three folds a round; at 4 fourfold, three folds a round, and the last one leaves only a shimmer.
// Knob 4: Gold. How much leaf is scattered in: 6 flakes about 7 by 10 LEDs at the opening, up to 17 flakes half as big again at 1.
// Buttons: K1 tap makes one fast fold: the fold under way, or the next one, runs four times as fast, half a second at Speed 2.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, exp, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const hash = (i) => {
  let h = Math.imul(i ^ 0x5bd1e995, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 15), 0x165667b1);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

// Smooth noise in a 128 x 128 tile that wraps, octaves of 8, 16 and 32
// cells: the cream's own soft relief.
const T = 128, TM = T - 1, TEX = new Float32Array(T * T);
function buildTex() {
  let amp = 1, tot = 0;
  for (let o = 0; o < 3; o++) {
    const cells = 8 << o, size = T / cells, g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = hash(i * 17 + o * 6007) * 2 - 1;
    for (let y = 0; y < T; y++) {
      const gy = floor(y / size), fy = sm(y / size - gy), y1 = (gy + 1) % cells;
      for (let x = 0; x < T; x++) {
        const gx = floor(x / size), fx = sm(x / size - gx), x1 = (gx + 1) % cells;
        const a = g[gy * cells + gx], b = g[gy * cells + x1], c = g[y1 * cells + gx], d = g[y1 * cells + x1];
        const top = a + (b - a) * fx;
        TEX[y * T + x] += (top + (c + (d - c) * fx - top) * fy) * amp;
      }
    }
    tot += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < TEX.length; i++) TEX[i] /= tot;
}
function tap(u, v) {
  const fu = floor(u), fv = floor(v), x0 = fu & TM, y0 = fv & TM, x1 = (x0 + 1) & TM, y1 = (y0 + 1) & TM;
  const tx = u - fu, ty = v - fv;
  const a = TEX[y0 * T + x0], b = TEX[y0 * T + x1], c = TEX[y1 * T + x0], d = TEX[y1 * T + x1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

function hsv(h, s, v, out, o) {
  const f = (n) => {
    const k = (n + (h - floor(h)) * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[o] = f(5);
  out[o + 1] = f(3);
  out[o + 2] = f(1);
}

// The cream as it was before any fold, in its own coordinates: u along the
// slab, 0 to 1 across the panel, and v up through it, 0 at the bottom to 1
// at the top. A raster of RU x RV holds where the gold is, which flake it
// belongs to and how each crumpled facet of the leaf is tilted.
const RU = 256, RV = 256;
const MAXF = 17;

function scatter(P) {
  const { GC, GI, GX, GY } = P;
  GC.fill(0);
  GI.fill(-1);
  const n = 6 + floor(11 * P.gold + 0.5), sf = 1 + 0.5 * P.gold, R = P.round * 977;
  const vx = new Float32Array(10), vy = new Float32Array(10), va = new Float32Array(11);
  for (let i = 0; i < n; i++) {
    const s = R + i * 53;
    // Half sizes in LEDs: across the slab and up through it.
    const a = (2.8 + 2.2 * hash(s)) * sf, b = (4 + 3.4 * hash(s + 1)) * sf;
    const cu = 0.1 + 0.8 * hash(s + 2), cv = 0.08 + 0.84 * hash(s + 3), rot = (hash(s + 4) - 0.5) * 1.2;
    // A torn flake: 6 to 9 corners at their own distances round the middle.
    const k = 6 + floor(4 * hash(s + 5));
    for (let m = 0; m < k; m++) {
      const an = (2 * PI * (m + 0.35 * (hash(s + 11 + m) - 0.5))) / k, r = 0.6 + 0.45 * hash(s + 23 + m);
      va[m] = an;
      vx[m] = r * cos(an);
      vy[m] = r * sin(an);
    }
    va[k] = va[0] + 2 * PI;
    const cr = cos(rot), sr = sin(rot), ext = max(a, b) * 1.1;
    const i0 = max(0, floor((cu - ext / W) * RU)), i1 = min(RU - 1, floor((cu + ext / W) * RU));
    const j0 = max(0, floor((cv - ext / H) * RV)), j1 = min(RV - 1, floor((cv + ext / H) * RV));
    for (let j = j0; j <= j1; j++)
      for (let q0 = i0; q0 <= i1; q0++) {
        const dx = ((q0 + 0.5) / RU - cu) * W, dy = ((j + 0.5) / RV - cv) * H;
        const lx = dx * cr + dy * sr, ly = -dx * sr + dy * cr, ex = lx / a, ey = ly / b, d = sqrt(ex * ex + ey * ey);
        let th = Math.atan2(ey, ex);
        if (th < va[0]) th += 2 * PI;
        let m = 0;
        while (m < k - 1 && th > va[m + 1]) m++;
        // Where the ray from the middle meets the outline between corners m
        // and m + 1.
        const m1 = (m + 1) % k, ax = vx[m], ay = vy[m], bx = vx[m1] - ax, by = vy[m1] - ay;
        const dc = cos(th) * by - sin(th) * bx, re = abs(dc) > 1e-6 ? (ax * by - ay * bx) / dc : 1;
        const cov = cl((re - d) * min(a, b) * 2, 0, 1);
        const q = j * RU + q0;
        if (cov <= GC[q]) continue;
        GC[q] = cov;
        GI[q] = i;
        // Crumple facets about 2.5 LEDs across, each tilted its own way.
        const fx = floor(lx / 2.5 + 50), fy = floor(ly / 2.5 + 50);
        GX[q] = hash(s * 31 + fx * 7 + fy * 131) - 0.5;
        GY[q] = hash(s * 37 + fx * 11 + fy * 173) - 0.5;
      }
    P.land[i] = 0.08 + 0.55 * hash(s + 9);
  }
}

export function setup(params) {
  buildTex();
  params.s = {
    c: 0, hue: 0, speed: 2, k3: 2, gold: 0.06, goldBuilt: -1,
    round: 0, folds: [], fk: 2, p: 0, ph: 0, pt: 0, fast: false,
    GC: new Float32Array(RU * RV), GI: new Int8Array(RU * RV), GX: new Float32Array(RU * RV), GY: new Float32Array(RU * RV),
    land: new Float32Array(MAXF),
    hgt: new Float32Array(N), surf: new Float32Array(N), gcov: new Float32Array(N), gfx: new Float32Array(N), gfy: new Float32Array(N), gfl: new Float32Array(N),
    hole: new Float32Array(N), lipd: new Float32Array(N), ob: new Float32Array(N), pal: new Float32Array(12), lastHue: NaN,
  };
}

// The round, in seconds at Speed 2: the flakes land, then folds one after
// another with a rest between, then the cream settles smooth.
const LAND = 0, FOLD = 1, REST = 2, SETTLE = 3;
const LAND_T = 0.7, FOLD_T = 2.0, REST_T = 0.7, SETTLE_T = 1.8;
// Folds a round: until the leaf has been stretched past twenty times.
const foldsFor = (k) => (k === 2 ? 5 : 3);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 2, 0.06], d = (cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3)) / 2;
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.k3 = floor(cl(k[2], 2, 4) + 0.5);
  P.gold = cl(k[3], 0, 1);
  if (abs(P.gold - P.goldBuilt) > 0.004) (scatter(P), (P.goldBuilt = P.gold));
  P.c += d;
  // A tap waits for the next fold if none is under way.
  if (input.btnPressed && input.btnPressed[0]) P.fast = true;
  P.pt += P.ph === FOLD && P.fast ? d * 4 : d;
  if (P.ph === LAND && P.pt >= LAND_T) (P.ph = FOLD), (P.pt = 0), (P.fk = P.k3);
  else if (P.ph === REST && (P.pt >= REST_T || P.fast)) (P.ph = FOLD), (P.pt = 0), (P.fk = P.k3);
  else if (P.ph === FOLD && P.pt >= FOLD_T) {
    P.folds.push(P.fk);
    P.pt = 0;
    P.fast = false;
    P.ph = P.folds.length >= foldsFor(P.fk) ? SETTLE : REST;
  } else if (P.ph === SETTLE && P.pt >= SETTLE_T) {
    // Fresh cream: the folds are forgotten and new flakes fall in.
    P.round++;
    P.folds = [];
    P.ph = LAND;
    P.pt = 0;
    scatter(P);
  }
  P.p = P.ph === FOLD ? sm(P.pt / FOLD_T) : 0;
}

// Sub-samples down each LED: the folds pack the layers thinner than an LED.
const SUB = 4;
// The sliding layer's end is rounded like a rolled lip, LIP LEDs deep.
const LIP = 4.5;

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { GC, GI, GX, GY, hgt, surf, gcov, gfx, gfy, gfl, hole, lipd, ob, pal, folds, land } = P;
  if (P.lastHue !== P.hue) {
    // The cream's tint. Round blush, peach, ivory and pistachio it stays
    // pale and light, where a deeper cream reads beige or khaki beside the
    // gold.
    let h = P.hue + 0.11;
    h -= floor(h);
    const warm = sm((h + 0.03) / 0.07) * (1 - sm((h - 0.22) / 0.08));
    hsv(h, 0.27 - 0.13 * warm, 0.93 + 0.03 * warm, pal, 0);
    // The same cream in its folds' shade: a little deeper, never grey.
    hsv(h - 0.01, 0.36 - 0.14 * warm, 0.74 + 0.1 * warm, pal, 3);
    // The cream down in the gap under a layer still sliding over.
    hsv(h - 0.01, 0.31 - 0.15 * warm, 0.82 + 0.07 * warm, pal, 6);
    P.lastHue = P.hue;
  }
  const c = P.c, L = 1 + (P.fk - 1) * P.p, nF = folds.length, folding = P.ph === FOLD;
  // Mid-fold the slab's far end stands inside the panel.
  const open = folding && L - floor(L) > 0.001;
  // Settling: the layers' relief and the leaf fade away and the cream lies
  // smooth; then the new flakes land one by one and the relief comes back.
  const settle = P.ph === SETTLE ? sm(P.pt / (SETTLE_T * 0.8)) : 0;
  const keep = P.ph === LAND ? sm(P.pt / LAND_T) : 1 - settle;
  // How deep the groove between layers is for each fold, newest first: the
  // newest folds show, the older ones knit together.
  const amp = [];
  let th = H / L;
  amp.push(folding ? 2 * min(1.6, 0.1 * th) * sm(P.p * 3) : 0);
  for (let i = nF - 1; i >= 0; i--) {
    th /= folds[i];
    amp.push(2 * min(1.6, 0.1 * th) * 0.62 ** (nF - 1 - i + P.p));
  }
  const landT = P.ph === LAND ? P.pt : 99;

  for (let x = 0; x < W; x++) {
    const ux = (x + 0.5) / W;
    // Under the lip the top of the layer below swells a little, unevenly.
    const bul = (2 + 1.3 * sin(ux * 7.5 + 0.6 * c) + 0.7 * sin(ux * 17 - c)) / H;
    for (let y = 0; y < H; y++) {
      let g = 0, gx = 0, gy = 0, fl = 0, hh = 0, emp = 0, nS = 0, dl = 99;
      for (let sI = 0; sI < SUB; sI++) {
        let u = ux, v = (H - y - (sI + 0.5) / SUB) / H;
        let rel = 0;
        // The fold under way: the slab stretched to L times its length and
        // as much thinner, laid back and forth across the panel from the
        // bottom up, each layer the other way up from the one below.
        {
          let j = floor(v * L), w = v * L - j, s = j + (j & 1 ? 1 - u : u);
          if (open && j + 1 > L) {
            const send = L - ((1 - 2 * sqrt(w * (1 - w))) * LIP) / W;
            let cv = cl((send - s) * W + 0.5, 0, 1);
            if (cv < 1 && j > 0 && v - j / L < bul) {
              cv = 1;
              j -= 1;
              w = 0.999;
              s = j + (j & 1 ? 1 - u : u);
            }
            emp += (1 - cv) / SUB;
            if (cv <= 0) {
              dl = min(dl, (s - send) * W);
              continue;
            }
          }
          // Each layer is rounded across its thickness, so a groove runs
          // between it and the next.
          if (amp[0] > 0) rel += amp[0] * (sqrt(w * (1 - w)) - 0.39);
          u = s / L;
          v = j & 1 ? 1 - w : w;
        }
        // The folds already made, newest first, back to the cream as it was.
        for (let i = nF - 1, lv = 1; i >= 0; i--, lv++) {
          const k = folds[i], j = min(k - 1, floor(v * k)), w = v * k - j, s = j + (j & 1 ? 1 - u : u);
          rel += amp[lv] * (sqrt(w * (1 - w)) - 0.39);
          u = s / k;
          v = j & 1 ? 1 - w : w;
        }
        // The cream's own soft relief, drawn out with it, read once an LED.
        if (nS === 0) hh += 0.55 * SUB * tap(u * 40, v * 64 + 17);
        hh += rel;
        nS++;
        // The leaf.
        const fu = cl(u * RU - 0.5, 0, RU - 1.001), fv = cl(v * RV - 0.5, 0, RV - 1.001);
        const i0 = floor(fu), j0 = floor(fv), q = j0 * RU + i0;
        const c00 = GC[q], c10 = GC[q + 1], c01 = GC[q + RU], c11 = GC[q + RU + 1];
        if (c00 + c10 + c01 + c11 > 0) {
          const tx = fu - i0, ty = fv - j0;
          let cc = c00 + (c10 - c00) * tx + (c01 - c00) * ty + (c00 - c10 - c01 + c11) * tx * ty;
          const qq = ty < 0.5 ? (tx < 0.5 ? q : q + 1) : tx < 0.5 ? q + RU : q + RU + 1, id = GI[qq];
          if (id >= 0 && landT < 99) {
            // A flake that is landing grows in with a flash.
            const t = (landT - land[id]) / 0.18;
            cc *= sm(t);
            fl = max(fl, t > 0 ? exp(-((t - 1) ** 2) * 1.5) : 0);
          }
          g += cc;
          gx += GX[qq] * cc;
          gy += GY[qq] * cc;
        }
      }
      const p = y * W + x;
      hgt[p] = nS ? (hh / nS) * keep : 0;
      gcov[p] = nS ? g / nS : 0;
      gfx[p] = g > 0 ? gx / g : 0;
      gfy[p] = g > 0 ? gy / g : 0;
      gfl[p] = fl;
      hole[p] = emp;
      lipd[p] = dl;
    }
  }
  // The gap, softened over a few LEDs: the cream rounds down into it.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let d = -2; d <= 2; d++) a += hole[y * W + cl(x + d, 0, W - 1)] * (3 - abs(d));
      surf[y * W + x] = a / 9;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let d = -2; d <= 2; d++) a += surf[cl(y + d, 0, H - 1) * W + x] * (3 - abs(d));
      ob[y * W + x] = a / 9;
    }
  for (let p = 0; p < N; p++) surf[p] = hgt[p] * (1 - hole[p]) - 2.6 * ob[p];

  // A small lamp drifts over the cream; the cream answers with a soft satin
  // sheen and the leaf with a sharp glint off whichever facets face it.
  const Lx = 32 + 38 * sin(0.29 * c + 0.4), Ly = 64 + 58 * sin(0.21 * c + 1.1), Lz = 55;
  const Ex = 32, Ey = 64, Ez = 220;
  const cr = pal[0], cg = pal[1], cb = pal[2], dr = pal[3], dg = pal[4], db = pal[5], pr = pal[6], pg = pal[7], pb = pal[8];
  // The leaf fades into the cream as it settles.
  const gk = 1 - settle;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x, ow = hole[p];
      const zx = (surf[y * W + min(W - 1, x + 1)] - surf[y * W + max(0, x - 1)]) / 2;
      const zy = (surf[min(H - 1, y + 1) * W + x] - surf[max(0, y - 1) * W + x]) / 2;
      const nl = 1 / sqrt(zx * zx + zy * zy + 1), nx = -zx * nl, ny = -zy * nl, nz = nl;
      let lx = Lx - x, ly = Ly - y, lz = Lz - surf[p];
      const li = 1 / sqrt(lx * lx + ly * ly + lz * lz);
      (lx *= li), (ly *= li), (lz *= li);
      let vx = Ex - x, vy = Ey - y, vz = Ez;
      const vi = 1 / sqrt(vx * vx + vy * vy + vz * vz);
      let hx = lx + vx * vi, hy = ly + vy * vi, hz = lz + vz * vi;
      const hi = 1 / sqrt(hx * hx + hy * hy + hz * hz);
      (hx *= hi), (hy *= hi), (hz *= hi);
      const dif = nx * lx + ny * ly + nz * lz;
      // The cream: lit against a level surface, its folds a deeper tint and
      // a little shade where it rounds down into the gap.
      const sh = cl(1 + 1.1 * (dif - lz) - 0.25 * ob[p], 0, 1.3);
      const dk = 1 - sm(sh), lift = max(0, sh - 1);
      let r = cr + (dr - cr) * dk + lift * 0.25, gg = cg + (dg - cg) * dk + lift * 0.25, b = cb + (db - cb) * dk + lift * 0.25;
      const nh = max(0, nx * hx + ny * hy + nz * hz);
      const n2 = nh * nh, n4 = n2 * n2, n8 = n4 * n4, n16 = n8 * n8;
      const sat = 0.1 * n8 * n4 * n2 + 0.12 * n16 * n16 * n16 * n8 * n4;
      r += sat;
      gg += sat;
      b += sat;
      // The leaf: deep gold turned from the lamp, bright gold towards it,
      // and a white-gold glint where a facet mirrors it.
      const gc = gcov[p] * gk;
      if (gc > 0.002) {
        const tx = gfx[p] * 0.9, ty = gfy[p] * 0.9;
        const fnx = nx + tx, fny = ny + ty, fnz = nz, fn = 1 / sqrt(fnx * fnx + fny * fny + fnz * fnz);
        const fd = max(0, (fnx * lx + fny * ly + fnz * lz) * fn), fh = max(0, (fnx * hx + fny * hy + fnz * hz) * fn);
        const f2 = fh * fh, f8 = f2 * f2 * f2 * f2, f32 = f8 * f8 * f8 * f8;
        const lit = 0.5 + 0.62 * fd, gl = 1.3 * f32 * f8 + 0.6 * gfl[p];
        // A vein thinner than an LED still reads as a line of gold.
        const a = min(1, gc * (1.25 + 0.3 * nF));
        r += (0.9 * lit + gl - r) * a;
        gg += (0.62 * lit + gl * 0.92 - gg) * a;
        b += (0.16 * lit + gl * 0.7 - b) * a;
      }
      // Down in the gap: the cream below in its own shade.
      if (ow > 0) {
        // The sliding layer's lip shades the cream just past it.
        const gs = cl(0.92 + 0.5 * (dif - lz), 0.76, 1.05) * (0.84 + 0.16 * sm(lipd[p] / 9));
        r += (pr * gs - r) * ow;
        gg += (pg * gs - gg) * ow;
        b += (pb * gs - b) * ow;
      }
      display.setPixel(x, y, cl(r * 255, 0, 255), cl(gg * 255, 0, 255), cl(b * 255, 0, 255));
    }
  }
}
