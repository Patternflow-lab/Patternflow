// ===== Patternflow pattern =====
// Title:   Indra's Pearls
// Family:  geometry
// Idea:    The limit set of a Maskit Kleinian group stood on end: the strip it lives in runs down the panel between two white lines, a necklace of tangent discs fills it with chains of ever smaller pearls nested in the gaps, the whole necklace slides down by the group's own translation z -> z + 2, and the parameter mu drifts along the edge of the Maskit slice so the chain pinches and opens into different double-cusp packings.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: limit set of a Kleinian group (Henri Poincaré, 1883), the Maskit slice as drawn in Indra's Pearls (David Mumford, Caroline Series and David Wright, 2002), pattern round 31
// Round:   31
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Shape=0..1, Zoom=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together; at 0 the big discs are deep blue and the pearls teal.
// Knob 2: Speed. At 2 the necklace slides five LEDs a second, the chain pinches and opens again every ten seconds and mu swings along the edge of the slice and back in seventeen; at 0.2 all of it goes ten times slower.
// Knob 3: Shape. Where on the edge of the Maskit slice mu swings: at 0 through the cusp mu = 2i, where the big discs stack straight down the middle, out to the cusp 1/10 on either side, where the necks between them wind into double spirals; turned up, the swing narrows and moves past the cusps 1/8, 1/6, 1/5, 1/4 and 1/3 to 1/2 at mu = -1 + 1.73i, where the discs zigzag from wall to wall.
// Knob 4: Zoom. Closes in, up to four times, on a fixed point of a, where the chain necks and the small pearls spiral in: near 0 the whole strip fits the 64 columns with both walls showing; at 1 the view is a quarter of the strip wide and the spirals fill it as they slide past.
// Buttons: K1 tap lights the pearls one generation after another, from the big ones on the walls inward to the smallest.

const W = 64, H = 128, N = W * H;
const { min, max, floor, exp, abs, sqrt, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Cusps of the Maskit slice, mu = Re + i Im, from the cusp 0/1 at 2i to 1/2.
// Each is the root of tr W_p/q(mu) = 2 with the largest imaginary part,
// found by the Farey recursion on traces (tr a = -i mu, tr b = 2,
// tr ab = -i mu - 2i). Between two of them the slice's edge dips well below
// the chord, so mu on the chord, or a little above, stays inside the slice.
const CUSP = [
  [0, 2], [-0.0216, 1.9374], [-0.0363, 1.9134], [-0.0674, 1.8745], [-0.1427, 1.8103],
  [-0.2201, 1.7667], [-0.3522, 1.7214], [-0.5812, 1.6939], [-1, 1.7321],
];
const NC = CUSP.length - 1;

// The strip 0 < Im z < Im mu spans this many of the 64 columns at Zoom 0,
// which leaves three LEDs on each side for the dark half-planes. Im mu runs
// from 1.69 to 2.06, so that is 28 to 34 LEDs per unit of the plane.
const SPAN = 58;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    scroll: 0, ph: 0, sw: 0, hue: 0, shape: 0, zoom: 0.06, wave: -1,
    mr: 0, mi: 2, uz: SPAN / 2, cx: 0, cy: 1, buf: new Float32Array(N * 3), pal: new Float32Array(64 * 3), palHue: -1,
  };
}

// mu for a place c on the cusp chain (0..NC, and negative for its mirror,
// Re mu -> -Re mu, which the slice shares) lifted by l into the slice.
function muAt(c, l, P) {
  const m = c < 0 ? -1 : 1;
  c = min(abs(c), NC);
  const i = min(floor(c), NC - 1), f = c - i;
  P.mr = m * (CUSP[i][0] + (CUSP[i + 1][0] - CUSP[i][0]) * f);
  P.mi = CUSP[i][1] + (CUSP[i + 1][1] - CUSP[i][1]) * f + l;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const sp = cl(k[1], 0.2, 3);
  P.hue = k[0];
  P.shape = cl(k[2], 0, 1);
  P.zoom = cl(k[3], 0, 1);
  P.ph += d * sp * 0.05;
  P.sw += d * sp * 0.03;
  // The lift above the cusp chain breathes between 0, where the chain
  // pinches into tangent discs, and 0.06, where the invariant component
  // opens into one winding band, every ten seconds at Speed 2. Over about
  // seventeen seconds mu also swings along the chain and back: at Shape 0
  // from the cusp 1/10 through 2i to its mirror image, so the spirals at the
  // necks wind up one way, unwind and wind up the other way.
  const lift = 0.06 * (0.5 - 0.5 * Math.cos(P.ph * 2 * PI)) ** 1.5;
  const c = P.shape * NC + Math.sin(P.sw * 2 * PI) * (1.9 - 1.1 * P.shape);
  muAt(c, lift, P);
  // LEDs per unit of the plane, and the slide: five LEDs a second at Speed 2
  // at any zoom. The picture repeats every 2 along Re z.
  P.uz = (SPAN / P.mi) * 4 ** P.zoom;
  // The zoom closes in on a fixed point of a, (mu - sqrt(mu^2 + 4)) / 2, the
  // one in the lower half of the strip. It lies on the limit set at a neck
  // of the chain, where the small pearls spiral in; the slide carries it
  // through the middle of the view once a period.
  const ar = P.mr * P.mr - P.mi * P.mi + 4, ai = 2 * P.mr * P.mi, am = sqrt(ar * ar + ai * ai);
  let sr = sqrt(max(0, (am + ar) / 2)), si = sqrt(max(0, (am - ar) / 2));
  if (ai < 0) si = -si;
  if (si < 0) {
    sr = -sr;
    si = -si;
  }
  const zs = (1 - 4 ** -P.zoom) / 0.75;
  P.cx = ((P.mr - sr) / 2) * zs;
  P.cy = P.mi / 2 + ((P.mi - si) / 2 - P.mi / 2) * zs;
  P.scroll = (P.scroll + (d * sp * 2.5) / P.uz) % 2;
  const b = input.btnPressed || [];
  if (b[0]) P.wave = 0;
  if (P.wave >= 0) P.wave = P.wave > 14 ? -1 : P.wave + d * 2.2;
}

// One point z = x + iy through Jos Leys's escape algorithm for the Maskit
// group a(z) = mu + 1/z, b(z) = z + 2. Each step wraps z into the strip of b
// (sheared along mu), turns it half round about mu/2 if it lies above the
// separation line (that half turn maps the limit set onto itself and swaps a
// with its inverse), then applies a. It stops when z leaves the strip
// 0 < Im z < Im mu (it was in a pearl, a disc that some word of the group
// sends onto a half-plane), or falls into a 2-cycle (it is in the invariant
// component, or in one of the discs it pinches into at a cusp). OUT holds
// the kind, the step count and a distance to the limit set in plane units.
const OUT = new Float64Array(3);
// 1 - e^-v in steps of 1/32 up to v = 12, for the separation line.
const SEP = new Float64Array(385);
for (let j = 0; j < 385; j++) SEP[j] = 1 - exp(-j / 32);
function trace(x, y, mr, t, maxIt) {
  if (y < 0 || y > t) {
    OUT[0] = 0;
    OUT[1] = 0;
    OUT[2] = y < 0 ? -y : y - t;
    return;
  }
  const sh = mr / t, f = mr > 0 ? -1 : mr < 0 ? 1 : 0, lean = (f * (2 * t - 1.95)) / 4, kk = 7.2 - (1.95 - t) * 15, hm = mr / 2, ht = t / 2, al = abs(lean);
  let lx = x + 9, ly = y, llx = x - 9, lly = y, der = 1;
  for (let i = 0; i < maxIt; i++) {
    const s = x - sh * y;
    if (s >= 1 || s < -1) x -= 2 * floor((s + 1) * 0.5);
    const u = x - hm;
    let up = y >= ht + al;
    if (!up && y >= ht - al) {
      const v = kk * (u > 0 ? u : -u) * 32;
      let sep = 1;
      if (v < 383) {
        const j = v | 0;
        sep = SEP[j] + (SEP[j + 1] - SEP[j]) * (v - j);
      }
      up = y >= ht + (u > 0 ? lean : -lean) * sep;
    }
    if (up) {
      x = mr - x;
      y = t - y;
    }
    const r = 1 / (x * x + y * y);
    der *= r;
    x = mr + x * r;
    y = t - y * r;
    if (y < 0 || y > t) {
      OUT[0] = 1;
      OUT[1] = i + 1;
      OUT[2] = (y < 0 ? -y : y - t) / der;
      return;
    }
    const ex = x - llx, ey = y - lly;
    if (ex * ex + ey * ey < 1e-8) {
      // How far the cycling point lies from the nearest limit set close to
      // the fundamental domain: the two walls and the pearls a^-1(H-) and
      // a^2(H-) that touch them at 0 and mu. Divided by the stretch of the
      // word that brought it there, that is the distance back where it
      // started, to first order.
      let s2 = x - sh * y;
      s2 -= 2 * floor((s2 + 1) / 2);
      x = s2 + sh * y;
      const rr = 0.5 / t, dt2 = t - rr;
      let dd = min(y, t - y);
      dd = min(dd, sqrt(x * x + (y - rr) * (y - rr)) - rr, sqrt((x - mr) * (x - mr) + (y - dt2) * (y - dt2)) - rr);
      OUT[0] = 2;
      OUT[1] = i + 1;
      OUT[2] = max(0, dd) / der;
      return;
    }
    llx = lx;
    lly = ly;
    lx = x;
    ly = y;
  }
  OUT[0] = 3;
  OUT[1] = maxIt;
  OUT[2] = 0;
}

// Colours: 0..31 the invariant component by step count, 32..63 the pearls
// by generation.
function palette(P) {
  const pal = P.pal, h = P.hue + 0.6;
  for (let i = 0; i < 32; i++) {
    const u = i / 31;
    // A dark orange or olive reads as brown, so the discs lift their light
    // where the hue passes through them and turn gold instead.
    let hh = h + 0.07 * u * u;
    hh -= floor(hh);
    const lift = max(0, 1 - abs(hh - 0.1) / 0.16);
    hsv(hh, 0.85 - 0.3 * u * u, 0.2 + 0.5 * u * u + 0.5 * lift * (1 - u * u), pal, i * 3);
    // Generation 1 teal, then cyan, sky, lavender and pink, paler as they
    // shrink.
    const g = min(i, 6) / 6;
    hsv(h - 0.12 + 0.36 * g, 0.72 - 0.32 * g, 0.72 + 0.24 * g, pal, (32 + i) * 3);
  }
  P.palHue = P.hue;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  if (P.palHue !== P.hue) palette(P);
  const buf = P.buf, pal = P.pal, mr = P.mr, t = P.mi;
  const uz = P.uz, su = 1 / uz, maxIt = 40 + ((40 * P.zoom) | 0);
  const y0 = P.cy - (W / 2) * su, x0 = P.cx - P.scroll - (H / 2) * su;
  for (let py = 0, p = 0; py < H; py++) {
    const x = x0 + (py + 0.5) * su;
    for (let px = 0; px < W; px++, p += 3) {
      trace(x, y0 + (px + 0.5) * su, mr, t, maxIt);
      const kind = OUT[0], n = OUT[1], de = OUT[2] * uz;
      let r, g, b;
      if (kind === 0) {
        r = 0.02;
        g = 0.02;
        b = 0.05;
      } else if (kind === 1) {
        const o = (32 + min(n - 1, 31)) * 3;
        // A pearl is a little darker at its rim, so neighbours part.
        const v = 0.55 + 0.45 * min(1, de / 2.5);
        r = pal[o] * v;
        g = pal[o + 1] * v;
        b = pal[o + 2] * v;
        if (P.wave >= 0) {
          const dw = P.wave - n, fl = exp(-dw * dw * 2) * 0.8;
          r += (1 - r) * fl;
          g += (1 - g) * fl;
          b += (1 - b) * fl;
        }
      } else if (kind === 2) {
        // The invariant component glows in from the limit set, about five
        // LEDs deep, over a dark core.
        const o = min(31, (31 * exp(-de / 5)) | 0) * 3;
        r = pal[o];
        g = pal[o + 1];
        b = pal[o + 2];
      } else {
        r = 0.7;
        g = 0.72;
        b = 0.8;
      }
      // The limit set: a white line a LED or so wide wherever the distance
      // to it is under a LED.
      if (kind !== 3) {
        const w = 0.92 * exp(-de * de * 2.4);
        r += (0.92 - r) * w;
        g += (0.94 - g) * w;
        b += (1 - b) * w;
      }
      buf[p] = r * 255;
      buf[p + 1] = g * 255;
      buf[p + 2] = b * 255;
    }
  }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, buf[p], buf[p + 1], buf[p + 2]);
}
