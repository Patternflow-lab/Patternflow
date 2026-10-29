// ===== Patternflow pattern =====
// Title:   Caustic Letters
// Family:  type
// Idea:    The panel is the floor of a pool lit from above, and the water surface is shaped so the light it bends spells a word: while a gust or a dropped stone roughens it the light runs in a net of bright caustic lines, and as the ripples calm the same light gathers into the word, until the next disturbance breaks it and brings the next word.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: goal-based caustics (Marios Papas, Wojciech Jarosz, Wenzel Jakob, Szymon Rusinkiewicz, Wojciech Matusik and Tim Weyrich, Goal-Based Caustics, 2011), high-contrast computational caustic design (Yuliy Schwartzburg, Romain Testuz, Andrea Tagliasacchi and Mark Pauly, 2014); the Knothe-Rosenblatt rearrangement (Murray Rosenblatt, 1952; Herbert Knothe, 1957) stands in here for the optimal-transport map the 2014 paper solves for; pattern round 69
// Round:   69
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ripple=1..3, Focus=-1..1
//
// Knob 1: Hue. Turns the water light round the wheel: at 0 the dim light is a deep azure and the brightest lines a pale aqua.
// Knob 2: Speed. A word's whole cycle, from the gust through the calm to the next gust, takes 8 s at 2, 80 s at 0.2 and 5.3 s at 3; the waves travel faster or slower with it.
// Knob 3: Ripple. How high the waves stand, as a multiple of the opening height. At 1 the net of caustic lines has round cells 15 to 20 LEDs across and the calm word lies nearly still; at 3 the lines fold into sharp-cornered shards and the word trembles even in the calm.
// Knob 4: Focus. Where the floor lies against the depth the surface was shaped for. At 0 the word is sharp. At -1 the floor is at half that depth and the word is a soft glow half way from even light. At 1 it is half as deep again and the light overshoots: each stroke pinches to a thin bright line, and the rows of the map show as faint threads across the gaps between letters.
// Buttons: any knob's button drops a stone, which breaks the word now and brings the next one.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Letters, as strokes of round-ended pen. Latin capitals are drawn in a
// unit box and stacked down the panel like a hotel sign; the three jamo of
// 빛 (ㅂ, ㅣ and the final ㅊ) are drawn straight onto the 64 by 128 panel.
const G_ARC = [];
for (let a = 40; a <= 350; a += 15) G_ARC.push([0.5 + 0.5 * cos((a * PI) / 180), 0.5 - 0.5 * sin((a * PI) / 180)]);
G_ARC.push([0.55, 0.5 - 0.5 * sin((350 * PI) / 180)]);
const LATIN = {
  L: [26, [[[0, 0], [0, 1], [1, 1]]]],
  I: [18, [[[0.5, 0], [0.5, 1]], [[0.1, 0], [0.9, 0]], [[0.1, 1], [0.9, 1]]]],
  G: [34, [G_ARC]],
  H: [32, [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0.5], [1, 0.5]]]],
  T: [36, [[[0, 0], [1, 0]], [[0.5, 0], [0.5, 1]]]],
  W: [46, [[[0, 0], [0.22, 1], [0.5, 0.32], [0.78, 1], [1, 0]]]],
  A: [38, [[[0, 1], [0.5, 0], [1, 1]], [[0.21, 0.66], [0.79, 0.66]]]],
  V: [38, [[[0, 0], [0.5, 1], [1, 0]]]],
  E: [28, [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.85, 0.5]]]],
};
const BIT = [
  [[[9, 8], [9, 58]], [[38, 8], [38, 58]], [[9, 33], [38, 33]], [[9, 58], [38, 58]]],
  [[[53, 5], [53, 70]]],
  [[[25, 77], [37, 77]], [[9, 88], [54, 88]], [[31, 92], [9, 121]], [[25.5, 100], [55, 121]]],
];

// A word becomes a list of segments [x0, y0, x1, y1] in LEDs and a pen radius.
function layout(word) {
  if (word === "빛") return { r: 3.2, segs: BIT.flat().flatMap(segsOf((x, y) => [x, y])) };
  const n = word.length, ch = 124 / n, r = n > 4 ? 2.5 : 2.8, gap = n > 4 ? 4.2 : 5;
  const segs = [];
  for (let i = 0; i < n; i++) {
    const [w, strokes] = LATIN[word[i]];
    const top = 2 + i * ch + r + gap / 2, h = ch - 2 * r - gap, left = 32 - w / 2;
    for (const pl of strokes) segs.push(...segsOf((x, y) => [left + x * w, top + y * h])(pl));
  }
  return { r, segs };
}
function segsOf(map) {
  return (pl) => {
    const out = [];
    for (let k = 0; k + 1 < pl.length; k++) {
      const [a, b] = map(pl[k][0], pl[k][1]), [c, d] = map(pl[k + 1][0], pl[k + 1][1]);
      out.push([a, b, c, d]);
    }
    return out;
  };
}

// The light the floor should receive: the word's mask, softened by one pass
// of a 1-2-1 blur, over a floor of 0.1 so some light lands everywhere.
const FLOOR = 0.1;
function density(word) {
  const { r, segs } = layout(word);
  const d2 = new Float32Array(W * H).fill(1e9), m = new Float32Array(W * H), rho = new Float32Array(W * H);
  // Each segment only looks at the LEDs inside its own box.
  for (const [a, b, c, d] of segs) {
    const ex = c - a, ey = d - b, l2 = ex * ex + ey * ey;
    const x0 = max(0, floor(min(a, c) - r - 1)), x1 = min(W - 1, floor(max(a, c) + r + 1));
    const y0 = max(0, floor(min(b, d) - r - 1)), y1 = min(H - 1, floor(max(b, d) + r + 1));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const t = l2 > 0 ? cl(((px - a) * ex + (py - b) * ey) / l2, 0, 1) : 0;
        const qx = px - a - t * ex, qy = py - b - t * ey, q = qx * qx + qy * qy;
        if (q < d2[y * W + x]) d2[y * W + x] = q;
      }
  }
  for (let p = 0; p < W * H; p++) m[p] = cl(r + 0.5 - sqrt(d2[p]), 0, 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) s += m[cl(y + dy, 0, H - 1) * W + cl(x + dx, 0, W - 1)] * (2 - (dx & 1)) * (2 - (dy & 1));
      rho[y * W + x] = FLOOR + s / 16;
    }
  return rho;
}

// ---- Photons. Two by two per LED leave the surface evenly, each from a
// fixed random point inside its own quarter of the LED; on a regular grid
// the rows of photons landed as dashed lines across the dim floor. The waves
// are summed on the 65 by 129 corners of the LEDs, and each photon reads the
// push under it bilinearly from its cell (PC) at the offsets in PFG.
const PX = 128, PY = 256, NP = PX * PY, GW = W + 1, GH = H + 1;
const SU = new Float32Array(NP), SV = new Float32Array(NP);
const jit = (p, k) => {
  let h = Math.imul(p ^ (k * 0x9e3779b9), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const PC = new Int32Array(NP), PFG = new Float64Array(2 * NP);
for (let j = 0; j < PY; j++)
  for (let i = 0; i < PX; i++) {
    const p = j * PX + i, u = (i + jit(p, 1)) / 2, v = (j + jit(p, 2)) / 2;
    const cx = min(W - 1, floor(u)), cy = min(H - 1, floor(v));
    SU[p] = u, SV[p] = v, PC[p] = cy * GW + cx, PFG[2 * p] = u - cx, PFG[2 * p + 1] = v - cy;
  }

// ---- The Knothe-Rosenblatt map T from even light onto a density rho. The
// height comes first: a photon's share of the way down the surface is
// matched to the same share of rho's row sums. Then, inside the row it lands
// in, its share across is matched to the same share of that row. Both are
// inverse cumulative sums, read linearly inside an LED. T moves light only
// down and then across, so it is not the cheapest map, the one the 2014
// paper solves for by optimal transport, but it carries exactly rho.
function knothe(rho) {
  const Mc = new Float64Array(H + 1), C = new Float64Array(H * (W + 1));
  for (let r = 0; r < H; r++) {
    let s = 0;
    for (let c = 0; c < W; c++) (C[r * (W + 1) + c] = s), (s += rho[r * W + c]);
    C[r * (W + 1) + W] = s;
    Mc[r + 1] = Mc[r] + s;
  }
  const TX = new Float32Array(NP), TY = new Float32Array(NP), M = Mc[H];
  for (let p = 0; p < NP; p++) {
    const v = (SV[p] / H) * M;
    let lo = 0, hi = H - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (Mc[mid] <= v) lo = mid;
      else hi = mid - 1;
    }
    const r = lo, row = Mc[r + 1] - Mc[r], w = (SU[p] / W) * row, o = r * (W + 1);
    let a = 0, b = W - 1;
    while (a < b) {
      const mid = (a + b + 1) >> 1;
      if (C[o + mid] <= w) a = mid;
      else b = mid - 1;
    }
    TY[p] = r + (v - Mc[r]) / row;
    TX[p] = a + (w - C[o + a]) / rho[r * W + a];
  }
  return [TX, TY];
}

const WORDS = ["LIGHT", "빛", "WAVE"];
// A word's map takes about 20 ms, so each is made the first time it is needed.
const MAPS = [];
const mapOf = (i) => MAPS[i] || (MAPS[i] = knothe(density(WORDS[i])));

// ---- Waves. A plane wave is a travelling sine on the surface; a photon is
// pushed along the wave's direction by the surface slope, a cos(k.u - wt),
// where a is set by f = a |k|, the fold number: past f = 1 neighbouring
// photons cross and a caustic line is born. Deep-water dispersion,
// w = sqrt(g k), lets long waves overtake short ones.
const GRAV = 25;
function wave(dir, lambda, f) {
  const k = (2 * PI) / lambda;
  return { kx: k * cos(dir), ky: k * sin(dir), w: sqrt(GRAV * k), ph: Math.random() * 2 * PI, a: f / k, ex: cos(dir), ey: sin(dir) };
}
function gust() {
  const d0 = Math.random() * 2 * PI, out = [];
  for (let i = 0; i < 4; i++) out.push(wave(d0 + (i - 1.5) * 0.75 + (Math.random() - 0.5) * 0.5, 10 + 14 * Math.random(), 1.1));
  return out;
}

const CYCLE = 8;

function startCycle(S, drop) {
  S.prev = S.word;
  S.word = (S.word + 1) % WORDS.length;
  S.ct = 0;
  S.n++;
  S.gust = gust();
  // Every other word is broken by a drop instead of a gust: a ring of waves
  // from one point, with a weaker gust under it.
  S.drop = drop || S.n % 2 === 0;
  S.dx = 10 + 44 * Math.random();
  S.dy = 16 + 96 * Math.random();
}

export function setup(params) {
  const res = [];
  for (let i = 0; i < 3; i++) res.push(wave(0.6 + i * 2.1, 13 + 5 * i, 0.07));
  params.s = {
    t: 0, ct: 0.6, n: 0, word: 0, prev: 0, gust: gust(), drop: false, dx: 32, dy: 64, res,
    hue: 0, speed: 2, ripple: 1, focus: 0.06,
    key: "", B: new Float64Array(2 * NP),
    GX: new Float64Array(GW * GH), GY: new Float64Array(GW * GH), E: new Float64Array((W + 2) * (H + 2)),
    AX: new Float64Array(9), AY: new Float64Array(9),
    CX: new Float64Array(9 * GW), SX: new Float64Array(9 * GW), CY: new Float64Array(9 * GH), SY: new Float64Array(9 * GH),
    GR: new Float32Array(800), LUT: new Uint8Array(3072),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.ripple = cl(k[2], 1, 3);
  S.focus = cl(k[3], -1, 1);
  // Time runs in the seconds of Speed 2.
  const step = (d * S.speed) / 2;
  S.t += step;
  S.ct += step;
  if (S.ct >= CYCLE) startCycle(S, false);
  if (input.btnPressed && input.btnPressed.some(Boolean) && S.ct > 0.5) startCycle(S, true);
}

// Wave q's push and its two tables of sines for this frame.
function setWave(S, q, w, g) {
  const { CX, SX, CY, SY, AX, AY } = S;
  AX[q] = w.a * g * w.ex;
  AY[q] = w.a * g * w.ey;
  for (let i = 0; i < GW; i++) (CX[q * GW + i] = cos(w.kx * i)), (SX[q * GW + i] = sin(w.kx * i));
  for (let j = 0; j < GH; j++) {
    const b = w.ky * j - w.w * S.t + w.ph;
    (CY[q * GH + j] = cos(b)), (SY[q * GH + j] = sin(b));
  }
}

// The drop: a ring packet leaving the point at 20 LEDs a second, spreading
// as it goes and weakening about as 1 / sqrt(r). GR holds its radial push.
function addDrop(S, ct, amp) {
  const { GX, GY, GR } = S;
  const R = 20 * ct, sg = 3 + 1.6 * ct, kd = (2 * PI) / 9, ad = (2.6 / kd) * amp * exp(-ct / 2.2) * smooth(ct / 0.15);
  for (let m = 0; m < 800; m++) {
    const r = m * 0.25, u = (r - R) / sg;
    GR[m] = (ad * exp(-u * u) * sin(kd * (r - R))) / sqrt(1 + r / 12);
  }
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const ux = i - S.dx, uy = j - S.dy, r = sqrt(ux * ux + uy * uy);
      if (r < 0.5) continue;
      const g = GR[min(799, floor(r * 4))] / r;
      GX[j * GW + i] += g * ux;
      GY[j * GW + i] += g * uy;
    }
}

// The push of the slope at each corner: cos(A + B) with A from the column
// and B from the row, so the sines come from two short tables per wave.
function sumWaves(S, nw) {
  const { GX, GY, CX, SX, CY, SY, AX, AY } = S;
  GX.fill(0);
  GY.fill(0);
  for (let q = 0; q < nw; q++) {
    const ax = AX[q], ay = AY[q], qx = q * GW;
    for (let j = 0, o = 0; j < GH; j++, o += GW) {
      const cy = CY[q * GH + j], sy = SY[q * GH + j];
      for (let i = 0; i < GW; i++) {
        const c = CX[qx + i] * cy - SX[qx + i] * sy;
        GX[o + i] += ax * c;
        GY[o + i] += ay * c;
      }
    }
  }
}

// Land every photon and splat it bilinearly into E, which has a border of
// one LED all round so the splat needs no tests.
function splat(S, s) {
  const { GX, GY, E, B } = S, EW = W + 2;
  E.fill(0);
  for (let p = 0; p < NP; p++) {
    const c = PC[p], f = PFG[2 * p], g = PFG[2 * p + 1], c2 = c + GW;
    const dx = (GX[c] + (GX[c + 1] - GX[c]) * f) * (1 - g) + (GX[c2] + (GX[c2 + 1] - GX[c2]) * f) * g;
    const dy = (GY[c] + (GY[c + 1] - GY[c]) * f) * (1 - g) + (GY[c2] + (GY[c2 + 1] - GY[c2]) * f) * g;
    const fx = B[2 * p] + s * dx, fy = B[2 * p + 1] + s * dy;
    const x0 = floor(fx), y0 = floor(fy);
    if (x0 < -1 || x0 >= W || y0 < -1 || y0 >= H) continue;
    const ax = fx - x0, ay = fy - y0, o = (y0 + 1) * EW + x0 + 1, by = 1 - ay;
    E[o] += (1 - ax) * by;
    E[o + 1] += ax * by;
    E[o + EW] += (1 - ax) * ay;
    E[o + EW + 1] += ax * ay;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const ct = S.ct, amp = S.ripple;

  // The gust rises to its height at 0.9 s and dies away; the water is
  // nearly still by 4.5 s.
  const tau = 0.9, env = (ct / tau) * exp(1 - ct / tau);
  let nw = 0;
  if (env > 0.01) for (const w of S.gust) setWave(S, nw++, w, env * amp * (S.drop ? 0.3 : 1));
  for (const w of S.res) setWave(S, nw++, w, amp);
  sumWaves(S, nw);
  if (S.drop && ct < 6) addDrop(S, ct, amp);

  // The floor at depth s of the shaped depth gets u + s (T(u) - u + slope
  // push): s = 1 is in focus.
  const s = 1 + 0.5 * S.focus;
  // How much of the shaped relief shows through the waves: none while the
  // gust stands above half its height, all of it once the water is still.
  // The relief changes to the next word at 1 s, while none of it shows.
  const calm = 1 - smooth(min(1, env / 0.5)), wi = ct < 1 ? S.prev : S.word;
  // Where each photon would land on still water, kept until the focus, the
  // calm or the word changes.
  const key = s + "," + calm + "," + wi, B = S.B, EW = W + 2;
  if (key !== S.key) {
    S.key = key;
    const [TX, TY] = mapOf(wi), sc = s * calm;
    for (let p = 0; p < NP; p++) {
      B[2 * p] = SU[p] + sc * (TX[p] - SU[p]) - 0.5;
      B[2 * p + 1] = SV[p] + sc * (TY[p] - SV[p]) - 0.5;
    }
  }
  splat(S, s);

  // Tone map 1 - exp(-k E) through a table of 1024 steps of 1/16 photon:
  // four photons an LED is even light, and the deep colour gives way to the
  // pale one as the light piles up.
  const deep = hsv(0.56 + S.hue, 0.85, 1), pale = hsv(0.47 + S.hue, 0.28, 1), LUT = S.LUT, E = S.E;
  for (let m = 0; m < 1024; m++) {
    const b = 1 - exp(-0.13 * (m / 16)), w = b * b;
    for (let ch = 0; ch < 3; ch++) LUT[m * 3 + ch] = 255 * b * (deep[ch] + (pale[ch] - deep[ch]) * w);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0, p = (y + 1) * EW + 1; x < W; x++, p++) {
      const m = min(1023, (E[p] * 16) | 0) * 3;
      display.setPixel(x, y, LUT[m], LUT[m + 1], LUT[m + 2]);
    }
}
