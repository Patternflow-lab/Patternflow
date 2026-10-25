// ===== Patternflow pattern =====
// Title:   Brillouin Zones
// Family:  cells
// Idea:    The plane round one point of a slowly turning, shearing lattice is cut into its Brillouin zones, every LED coloured by how many lattice points are closer to it than the origin is, so the first zone sits in the middle as a hexagon or a square and the higher zones spread outwards as rings of scattered shards in rainbow order, a dark band runs out through the zones one index at a time and relights each in its next colour, and every so often the shards of one zone slide along their lattice vectors into the first zone, fill it with no gap and no overlap, and slide back.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Brillouin zones (Léon Brillouin, 1930), pattern round 46
// Round:   46
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Zones=16..48, Shear=0..1
//
// Knob 1: Hue. Turns the whole glass round the colour wheel; zone n sits n - 1 sevenths of the wheel on from zone 1, so the order of the zones reads as a rainbow outwards. At 0 the first zone opens cyan with blue, violet, rose, orange, lime and green round it, and wears blue once the first band has passed; at 0.25 it opens violet, at 0.5 red, at 0.75 lime green.
// Knob 2: Speed. The lattice's clock. At 2 the dark band runs out 3.2 zones a second, a new band every 8.4 s, the lattice turns 3.4 degrees a second and its angle swings between hexagonal and square over about 27 s; at 0.2 everything is ten times slower, at 3 half as fast again. A fold always takes 3.3 s.
// Knob 3: Zones. Roughly how many zones fit between the centre and the top edge, which sets the cell: pi 64^2 / Zones LEDs. At 16 each zone is 804 LEDs and about 21 zones reach the corners; at 24 it is 536 LEDs, at 32 402 and about 41 zones, at 48 268 LEDs and about 60 zones, the outer ones broken into single LEDs.
// Knob 4: Shear. How far the lattice leaves the symmetric ones. At 0 its two arms stay equal within 5% and the angle between them wanders from 55 to 90 degrees, hexagon to square; at 0.06 (the start) the arms differ by 4%; at 0.5 the second arm is 1.35 times the first and the angle runs 45 to 80; at 1 it is 1.7 times and 33 to 68, and the first zone is a long slanted hexagon.
// Buttons: K1 tap folds the next zone of 4, 5, 6, 7, 8 into the first zone at once. Without a press a fold comes at 12 s and every 24 s after on the lattice's clock.

const W = 64, H = 128, N = W * H;
// The origin sits on the corner between the four middle LEDs.
const OX = 32, OY = 64;
const { floor, ceil, min, max, abs, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// A lattice point farther than twice an LED's distance from the origin can
// never be closer to that LED than the origin is.
const RMAX = 2 * sqrt(OX * OX + OY * OY) + 2;
const MAXL = 2048;
// Zone n is n - 1 sevenths of the wheel on from zone 1: neighbouring zones
// are always 51 degrees apart and the order outwards reads as a rainbow.
// Zone 1 at hue 0 is cyan.
const STEP = 1 / 7;
const HUE0 = 0.52;
// Glass saturation, the dim glass's brightness, and the lead between panes.
const SAT = 0.76, VD = 0.3, LEAD = 0.35;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// A dark band BAND_W zones wide runs out through the zones in order 1, 2,
// 3 ..., BAND_RATE zones a second, a new band every BAND_P zones; each zone
// it passes relights in its next colour. Since every zone has the same
// area, the band covers the same area of glass wherever it is.
const BAND_RATE = 3.2, BAND_W = 3, BAND_P = 27, PHI0 = -2;
// Folds come by themselves at 12 s and every 24 s after, in pattern seconds.
const AUTO0 = 12, AUTO_EVERY = 24;
// The fold, in real seconds: the rest of the glass dims, the pieces slide
// home, hold, slide back, the glass comes up again.
const F_IN = 0.35, F_SLIDE = 0.9, F_HOLD = 0.8, F_LEN = 2 * F_IN + 2 * F_SLIDE + F_HOLD;

export function setup(params) {
  params.s = {
    t: 0, nextFold: AUTO0, hue: 0, speed: 2, zones: 16, shear: 0.06,
    zone: new Uint16Array(N), diff: new Int32Array(W + 1),
    lx: new Float32Array(MAXL), ly: new Float32Array(MAXL), nl: 0, zTop: 1,
    // The fold: its age (-1 when none), which zone, how many so far, the
    // frozen lattice sorted by length (origin first), the candidate pieces
    // and the first zone's radius.
    fold: -1, fz: 4, folds: 0,
    sx: new Float32Array(MAXL + 1), sy: new Float32Array(MAXL + 1), sn: new Float32Array(MAXL + 1), ns: 0,
    cx: new Float32Array(512), cy: new Float32Array(512), nc: 0, rv: 1,
    cover: new Int16Array(N),
    pal: new Float32Array(3 * 256), dot: new Uint8Array(N),
  };
}

// The lattice now: basis b1 = a(1,0), b2 = a rho (cos g, sin g), both
// turned by th, with a set so the cell keeps the area the Zones knob asks.
function lattice(S) {
  const t = S.t, sh = S.shear;
  // g wanders between about 55 and 90 degrees: square at 90, hexagonal at 60.
  const g = (72.5 - 12 * sin(0.23 * t) - 5.5 * sin(0.37 * t + 2) - 22 * sh) * PI / 180;
  const rho = 1 + 0.05 * sin(0.17 * t + 1) + 0.7 * sh;
  const th = 0.06 * t + 0.4 * sh;
  const A = (PI * OY * OY) / S.zones;
  const a = sqrt(A / (rho * sin(g)));
  const c = cos(th), s = sin(th);
  const b1x = a * c, b1y = a * s;
  const ux = a * rho * cos(g), uy = a * rho * sin(g);
  const b2x = c * ux - s * uy, b2y = s * ux + c * uy;
  const mi = ceil((RMAX * a * rho) / A) + 1, mj = ceil((RMAX * a) / A) + 1;
  let n = 0;
  for (let i = -mi; i <= mi; i++)
    for (let j = -mj; j <= mj; j++) {
      if (!i && !j) continue;
      const x = i * b1x + j * b2x, y = i * b1y + j * b2y;
      if (x * x + y * y >= RMAX * RMAX || n >= MAXL) continue;
      S.lx[n] = x;
      S.ly[n] = y;
      n++;
    }
  S.nl = n;
}

// Zone of every LED: 1 + how many lattice points are strictly closer to it
// than the origin. L is closer to p exactly when p.L > |L|^2 / 2, a half
// plane bounded by the perpendicular bisector of 0 and L, so along a row
// each lattice point starts or stops counting at one x.
function zones(S) {
  const Z = S.zone, D = S.diff, LX = S.lx, LY = S.ly, nl = S.nl;
  let top = 1;
  for (let y = 0; y < H; y++) {
    D.fill(0);
    const py = y + 0.5 - OY;
    const rr = 4 * (OX * OX + py * py) + 4;
    for (let k = 0; k < nl; k++) {
      const lx = LX[k], ly = LY[k], l2 = lx * lx + ly * ly;
      if (l2 > rr) continue;
      const c = l2 / 2 - py * ly;
      if (abs(lx) < 1e-9) {
        if (c < 0) D[0]++;
        continue;
      }
      const tx = c / lx + OX - 0.5;
      if (lx > 0) {
        const x0 = floor(tx) + 1;
        if (x0 < W) D[x0 < 0 ? 0 : x0]++;
      } else {
        const x1 = ceil(tx);
        if (x1 > 0) {
          D[0]++;
          if (x1 < W) D[x1]--;
        }
      }
    }
    let run = 1;
    for (let x = 0; x < W; x++) {
      run += D[x];
      Z[y * W + x] = run;
      if (run > top) top = run;
    }
  }
  S.zTop = top;
}

// Freeze the lattice for a fold of zone n. Each piece of zone n is the part
// whose nearest lattice point is one L, and it lands on the first zone when
// moved by -L. A point u of the first zone is covered by piece L exactly
// when -L is its n-th nearest lattice point, so L can be a piece only if
// its length is within twice the first zone's radius of the n-th length.
function foldStart(S, n) {
  const m = S.nl, idx = new Array(m);
  for (let k = 0; k < m; k++) idx[k] = k;
  idx.sort((a, b) => S.lx[a] ** 2 + S.ly[a] ** 2 - S.lx[b] ** 2 - S.ly[b] ** 2);
  S.sx[0] = S.sy[0] = S.sn[0] = 0;
  for (let k = 0; k < m; k++) {
    const x = S.lx[idx[k]], y = S.ly[idx[k]];
    S.sx[k + 1] = x;
    S.sy[k + 1] = y;
    S.sn[k + 1] = sqrt(x * x + y * y);
  }
  S.ns = m + 1;
  let rv = 0;
  for (let p = 0; p < N; p++)
    if (S.zone[p] === 1) rv = max(rv, sqrt(((p % W) + 0.5 - OX) ** 2 + (floor(p / W) + 0.5 - OY) ** 2));
  S.rv = rv + 1;
  const below = (r) => {
    let c = 0;
    while (c < S.ns && S.sn[c] < r) c++;
    return c;
  };
  let nc = 0;
  for (let k = 1; k < S.ns && nc < 512; k++) {
    const r = S.sn[k];
    if (below(r - 2 * S.rv) <= n - 1 && below(r + 2 * S.rv) - 1 >= n - 1) {
      S.cx[nc] = S.sx[k];
      S.cy[nc] = S.sy[k];
      nc++;
    }
  }
  S.nc = nc;
  S.fz = n;
  S.fold = 0;
}

// Which piece of the folding zone covers each LED when the pieces have
// moved the fraction s of the way home (0 for none).
function foldCover(S, s) {
  const C = S.cover, n = S.fz, rv = S.rv, SX = S.sx, SY = S.sy, SN = S.sn, ns = S.ns;
  const nshort = min(17, ns);
  C.fill(0);
  for (let k = 0; k < S.nc; k++) {
    const Lx = S.cx[k], Ly = S.cy[k], ox = (1 - s) * Lx, oy = (1 - s) * Ly;
    const x0 = max(0, floor(ox + OX - rv)), x1 = min(W - 1, ceil(ox + OX + rv));
    const y0 = max(0, floor(oy + OY - rv)), y1 = min(H - 1, ceil(oy + OY + rv));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const ux = x + 0.5 - OX - ox, uy = y + 0.5 - OY - oy;
        // u must lie in the first zone: no short lattice vector closer.
        let inside = true;
        for (let j = 1; j < nshort; j++)
          if (ux * SX[j] + uy * SY[j] > (SN[j] * SN[j]) / 2) {
            inside = false;
            break;
          }
        if (!inside) continue;
        // And -L must be its n-th nearest lattice point.
        const ex = ux + Lx, ey = uy + Ly, d2 = ex * ex + ey * ey, lim = sqrt(ux * ux + uy * uy) + sqrt(d2);
        let cnt = 0;
        for (let j = 0; j < ns && SN[j] <= lim; j++) {
          const dx = ux - SX[j], dy = uy - SY[j];
          if (dx * dx + dy * dy < d2 && ++cnt >= n) break;
        }
        if (cnt === n - 1) C[y * W + x] = k + 1;
      }
  }
}

const foldS = (a) => (a < F_IN ? 0 : a < F_IN + F_SLIDE ? sm(F_IN, F_IN + F_SLIDE, a) : a < F_IN + F_SLIDE + F_HOLD ? 1 : 1 - sm(F_LEN - F_IN - F_SLIDE, F_LEN - F_IN, a));
const foldDim = (a) => sm(0, F_IN, a) * (1 - sm(F_LEN - F_IN, F_LEN, a));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 16, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.zones = cl(k[2], 16, 48);
  S.shear = cl(k[3], 0, 1);
  if (S.fold >= 0) {
    // The lattice holds still while its pieces move.
    S.fold += d;
    if (S.fold >= F_LEN) S.fold = -1;
    else {
      foldCover(S, foldS(S.fold));
      return;
    }
  }
  const ds = (d * S.speed) / 2;
  S.t += ds;
  lattice(S);
  zones(S);
  const press = input.btnPressed && input.btnPressed[0];
  const auto = S.t >= S.nextFold;
  if (auto) S.nextFold += AUTO_EVERY;
  if (press || auto) {
    // Zones 4 to 8 in turn.
    foldStart(S, 4 + (S.folds % 5));
    S.folds++;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const Z = S.zone, PAL = S.pal, DOT = S.dot;
  const folding = S.fold >= 0, fd = folding ? foldDim(S.fold) : 0;
  const phi = BAND_RATE * S.t + PHI0;
  // Each zone's glass: its colour moves one golden step on for every band
  // that has passed it.
  const nz = min(S.zTop + 2, 255);
  for (let n = 1; n <= nz; n++) {
    const k = phi >= n ? floor((phi - n) / BAND_P) + 1 : 0;
    hsv(HUE0 + S.hue + (n - 1 + k) * STEP, SAT, 1, PAL, 3 * n);
  }
  // The lattice points themselves, as single pale LEDs.
  DOT.fill(0);
  for (let k = -1; k < S.nl; k++) {
    const x = floor((k < 0 ? 0 : S.lx[k]) + OX), y = floor((k < 0 ? 0 : S.ly[k]) + OY);
    if (x >= 0 && x < W && y >= 0 && y < H) DOT[y * W + x] = 1;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, z = Z[p];
      const e = (x + 1 < W && Z[p + 1] !== z) || (y + 1 < H && Z[p + W] !== z);
      // Where this zone is in the band's cycle: dim inside the band, and
      // flaring towards white just as it relights.
      const o = 3 * min(z, nz), u = phi >= z ? (phi - z) % BAND_P : BAND_P;
      const v = u < BAND_W ? VD : 1;
      let r = PAL[o] * v, g = PAL[o + 1] * v, b = PAL[o + 2] * v;
      const fl = folding || u < BAND_W ? 0 : max(0, 1 - (u - BAND_W) / 1.2) * 0.6;
      r += (1 - r) * fl;
      g += (1 - g) * fl;
      b += (1 - b) * fl;
      // Lead between the panes.
      let f = e ? LEAD : 1;
      if (folding) {
        const pc = S.cover[p];
        if (pc) {
          // A piece of the folding zone, each piece its own shade.
          const q = 3 * S.fz, sh = 0.75 + 0.125 * ((pc * 7) % 3);
          const pe = (x + 1 < W && S.cover[p + 1] !== pc) || (y + 1 < H && S.cover[p + W] !== pc);
          r = PAL[q] * sh;
          g = PAL[q + 1] * sh;
          b = PAL[q + 2] * sh;
          f = pe ? 0.45 : 1;
        } else {
          // The rest dims, the places the pieces left go dark, and the
          // first zone's rim shows white.
          f *= 1 - fd * (z === S.fz ? 0.94 : 0.72);
          const rim = z === 1 && ((x > 0 && Z[p - 1] !== 1) || (x + 1 < W && Z[p + 1] !== 1) || (y > 0 && Z[p - W] !== 1) || (y + 1 < H && Z[p + W] !== 1));
          if (rim) (r = g = b = 1), (f = 0.25 + 0.6 * fd);
        }
      }
      if (DOT[p]) {
        r += (1 - r) * 0.7;
        g += (1 - g) * 0.7;
        b += (1 - b) * 0.7;
        f = max(f, 0.8);
      }
      display.setPixel(x, y, r * f * 255, g * f * 255, b * f * 255);
    }
}
