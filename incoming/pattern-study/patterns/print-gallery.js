// ===== Patternflow pattern =====
// Title:   Print Gallery
// Family:  fractal
// Idea:    A checker of square rings in four to eight colours, which holds itself scaled down by s, is seen through de Smit and Lenstra's map, log z divided by 2 pi i / (2 pi i + log s), so its nested copies join into spiral arms and its white frame into one spiral line, and an endless zoom turns the panel round and in until after one period it shows the same picture to the last LED.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the conformal map behind M. C. Escher's Print Gallery (Bart de Smit and Hendrik Lenstra, 2003), the Droste effect, pattern round 58
// Round:   58
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Scale=16..256, Unwind=0..1
//
// Knob 1: Hue. Turns the ring colours round the wheel together, each ring a light cell beside a dark one. At 0 and Scale 16 the four rings run aqua, azure, violet and magenta; at 0.5 pink, red, green and sea green. The wheel skips dim orange, which reads brown.
// Knob 2: Speed. The zoom passes one ring of the base, a factor 2, every 1.4 seconds at 2, so one period at Scale 16 takes 5.6 seconds and at 256 takes 11.2; 0.2 is ten times slower, 3 one and a half times faster.
// Knob 3: Scale. The Droste factor s, snapped to 16, 32, 64, 128 or 256: the base holds 4 to 8 rings before it repeats, and they become as many spiral arms. One period of the twisted picture is a zoom of 10.2 with a turn of 59 degrees at 16, 18.0 and 110 degrees at 64, and 22.6 and 158 degrees at 256, the factor Escher drew.
// Knob 4: Unwind. Undoes the twist. Up to 0.1 the map is Escher's, from 0.9 the panel shows the plain Droste picture of nested squares, and in between the picture tears along the ray left of the centre, where the rings fail to meet by s to the power of the twist: at Scale 16 and 0.5 the two sides are two rings apart.

const W = 64, H = 128;
const { floor, max, exp, log, sqrt, cos, sin, atan2, abs, round, PI, LN2 } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The base picture is a Droste picture: square rings, each twice the size of
// the one inside it, the ring between half-sides 2^j and 2^(j+1) a checker of
// cells 2^(j-1) wide with dark grout between them. Ring j takes colour j mod
// m, and ring 0 has a white frame round its inside, so the picture holds
// itself scaled by 1/s, s = 2^m, and by no smaller factor. f(z) = f(z / s):
// in w = log z it is periodic under the lattice Z log s + Z 2 pi i.
// The twisted picture shows f(exp(w / beta)), beta = 2 pi i / (2 pi i + log s),
// so 1 / beta = 1 - i log s / (2 pi). Then 2 pi i / beta = log s + 2 pi i is
// a lattice vector and the picture is single-valued: once round the centre
// takes a ring to the same-coloured ring s times bigger, and the m rings of
// a period join into m spiral arms. Between 1 and 1 / beta the seam along the
// cut, the ray to the left of the centre, does not close.

// Each subsample's log-polar place, fixed: ln r in LEDs and the angle. Out
// past 20 LEDs from the centre a cell is 7 LEDs or more and 2 x 2 samples
// clean its edges; inside, where the rings shrink, 3 x 3.
const START = new Int32Array(W * H + 1), FP = new Float32Array(W * H);
const LRa = [], THa = [];
for (let y = 0, p = 0; y < H; y++)
  for (let x = 0; x < W; x++, p++) {
    const dx = x + 0.5 - 32, dy = y + 0.5 - 64, r = sqrt(dx * dx + dy * dy);
    const ss = r < 20 ? 3 : 2;
    START[p] = LRa.length;
    for (let j = 0; j < ss; j++)
      for (let i = 0; i < ss; i++) {
        const ex = x + (i + 0.5) / ss - 32, ey = y + (j + 0.5) / ss - 64;
        LRa.push(0.5 * log(ex * ex + ey * ey + 1e-9));
        THa.push(atan2(ey, ex));
      }
    // 1 / r: how far one LED reaches in log z.
    FP[p] = 1 / max(r, 1e-3);
  }
START[W * H] = LRa.length;
const LR = Float32Array.from(LRa), TH = Float32Array.from(THa);

// Dim orange reads brown on the panel, so the wheel skips 0.03 to 0.16.
function hsv(h, s, v, out, o) {
  h = 0.16 + 0.87 * (h - 0.16 - floor(h - 0.16));
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, m: 4, tw: 1, zoom: 0, pal: new Float32Array(9 * 3 * 3), palKey: "", mean: [0, 0, 0] };
}

// The twist for Unwind u: 1 (Escher's map) up to 0.1, 0 (the plain Droste
// picture) from 0.9, straight between.
const twistOf = (u) => 1 - cl((u - 0.1) / 0.8, 0, 1);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  // s snaps to a power of two: m rings to a period.
  S.m = cl(round(Math.log2(cl(k[2], 16, 256))), 4, 8);
  S.tw = twistOf(cl(k[3], 0, 1));
  // One ring of the base, a factor 2, every 1.4 s at Speed 2. zoom runs
  // down, so the base point under each LED moves inward: the panel zooms in.
  S.zoom -= (d * S.speed * LN2) / 2.8;
  const L = S.m * LN2;
  if (S.zoom < -L) S.zoom += L;
}

// Palette: per ring colour, light cell, dark cell, frame.
function palette(S) {
  const key = S.hue.toFixed(4) + "," + S.m;
  if (key === S.palKey) return;
  S.palKey = key;
  const m = S.m, P = S.pal;
  let r = 0, g = 0, b = 0;
  for (let j = 0; j < m; j++) {
    const h = S.hue + 0.5 + (0.62 * j) / m;
    hsv(h, 0.72, 1, P, j * 9);
    hsv(h + 0.03, 0.9, 0.3, P, j * 9 + 3);
    hsv(h, 0.12, 1, P, j * 9 + 6);
    r += (P[j * 9] + P[j * 9 + 3]) / (2 * m);
    g += (P[j * 9 + 1] + P[j * 9 + 4]) / (2 * m);
    b += (P[j * 9 + 2] + P[j * 9 + 5]) / (2 * m);
  }
  // Grout covers a sixth of the base.
  S.mean = [0.83 * r, 0.83 * g, 0.83 * b];
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  // 1 / beta = 1 - i c1, c1 = log s / (2 pi) at full twist.
  const m = S.m, L = m * LN2, c1 = (S.tw * L) / (2 * PI), P = S.pal, zoom = S.zoom;
  // |1 / beta|: how much the map stretches log z.
  const na = sqrt(1 + c1 * c1), mean = S.mean;
  for (let p = 0; p < W * H; p++) {
    // Near the centre one LED covers more of the base than its samples can
    // hold, so it fades to the picture's mean colour.
    const fp = FP[p] * na, keep = cl((0.3 - fp) / 0.15, 0, 1);
    let r = 0, g = 0, b = 0;
    if (keep > 0) {
      const q0 = START[p], q1 = START[p + 1];
      for (let q = q0; q < q1; q++) {
        // w / beta = (1 - i c1)(ln r + i theta), and the zoom.
        const lr = LR[q], th = TH[q];
        let re = lr + c1 * th + zoom;
        const im = th - c1 * lr;
        // Reduce to the ring: re mod ln 2, then the square norm into [1, 2).
        let j = floor(re / LN2);
        re -= j * LN2;
        const e = exp(re), X = e * cos(im), Y = e * sin(im);
        let ax = abs(X), ay = abs(Y), n = ax > ay ? ax : ay;
        if (n < 1) (ax *= 2), (ay *= 2), (n *= 2), j--;
        else if (n >= 2) (ax *= 0.5), (ay *= 0.5), (n *= 0.5), j++;
        const c = ((j % m) + m) % m;
        const gx = ax * 2, gy = ay * 2, fx = gx - floor(gx), fy = gy - floor(gy);
        let o = -1;
        if (c === 0 && n < 1.07) o = c * 9 + 6;
        else if (fx > 0.045 && fx < 0.955 && fy > 0.045 && fy < 0.955)
          o = c * 9 + (((floor(gx) + floor(gy) + (X < 0) + (Y < 0)) & 1) ? 3 : 0);
        if (o >= 0) (r += P[o]), (g += P[o + 1]), (b += P[o + 2]);
      }
      const inv = 1 / (q1 - q0);
      r *= inv;
      g *= inv;
      b *= inv;
    }
    const f = 1 - keep;
    r = r * keep + mean[0] * f;
    g = g * keep + mean[1] * f;
    b = b * keep + mean[2] * f;
    display.setPixel(p % W, (p / W) | 0, round(r * 255), round(g * 255), round(b * 255));
  }
}
