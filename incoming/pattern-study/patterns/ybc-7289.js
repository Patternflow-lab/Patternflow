// ===== Patternflow pattern =====
// Title:   YBC 7289
// Family:  type
// Idea:    The upper half of the tall panel is the face of the tablet YBC 7289 under a swaying lamp, a square with both diagonals pressed into clay and its numbers in cuneiform wedges, 30 by a side, 1;24,51,10 along the diagonal and 42;25,35 below it, and on the clay below, the averaging x -> (x + 2/x)/2 is written out wedge by wedge from 1;30, one step to a line in sexagesimal places, each place lighting turquoise once it is the square root of 2's own place, so 1;30 and 1;25 light only their 1, 1;24,51,10,35 lights four places and the tablet's number with them, and 1;24,51,10,7 lights all five.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: YBC 7289, Yale Babylonian Collection, Old Babylonian (about 1800 to 1600 BCE); the averaging method for square roots as later written down by Heron of Alexandria (1st century); wedges drawn for this pattern as pyramids pressed into a height field, pattern round 81
// Round:   81
// ===============================
// @matrix 64x128
// @knobs Lamp=0..1, Speed=0.2..3, Start=0..5, Places=0..1
//
// Knob 1: Lamp. Where the lamp stands around the tablet, a full turn over the range; it is always 15 degrees above the clay and sways 29 degrees either way. At 0 it is on the left and a little above, so a wedge's left wall falls into shadow and its right wall catches the light; at 0.25 it is below, at 0.5 on the right, where the bright and dark walls of every wedge change sides, and at 0.75 above.
// Knob 2: Speed. At 2 a wedge is pressed every 0.06 s and each agreeing place lights 0.12 s after the one before, so the four lines from 1;30 are written and checked in 7.9 s and stand 3.5 s before the clay is smoothed over 1.2 s, a round of 13.1 s; the lamp sways once in 7 s. Every time goes as 2 / Speed.
// Knob 3: Start. The first guess: 0 is 1;30 (3/2), 1 is 1;20 (4/3), 2 is 2, 3 is 1, 4 is 1;24 (7/5), 5 is 1;40 (5/3). 1;30 and 1;20 both give 1;25 next, and 2 and 1 both give 1;30, since x and 2/x always lead to the same average; 1;24 agrees in two places at once and needs only three lines. A new start opens on its lines already written, then smooths them and writes them again.
// Knob 4: Places. How many places after the point each step keeps before the next is worked out: all of them below 0.125 (the opening 0.06), so the lines run on until one holds five places that all agree; 4 from 0.125, 3 from 0.375, 2 from 0.625 and 1 from 0.875. Cut to 3, every start lands on 1;24,51,10, the tablet's own number, the next step gives it back unchanged, and the tablet's number lights; cut to 2 or 1 the lines settle on 1;24,51 or 1;24 and the tablet stays dark.

// YBC 7289 carries a square with its two diagonals. One side is marked 30;
// along a diagonal stands 1;24,51,10 and under it 42;25,35. In base 60,
// 1;24,51,10 is 1 + 24/60 + 51/60^2 + 10/60^3 = 1.4142130, the square root
// of 2 to about six decimal places, and 42;25,35 is 30 times it: the
// diagonal of the square of side 30. Halving 1;24,51,10 gives 0;42,25,35,
// so multiplying by 30 is halving and moving one place up.
//
// The method drawn below takes a guess x for the root of 2 and averages it
// with 2/x. When x is too big 2/x is too small by about as much, so the
// average lands far closer, and each step about doubles the places that
// are right. From 3/2: 17/12 = 1;25, then 577/408 = 1;24,51,10,35,... and
// 665857/470832 = 1;24,51,10,7,46,6,9,... where the root is
// 1;24,51,10,7,46,6,4,44. The iterates are kept as exact fractions (BigInt)
// and their places read off one by one, so a place lights only when it is
// the root's own place, not a rounding of it. 1;25 is nearer the root than
// 1;24 but its 25 is not the root's 24, so line two lights only its 1.
//
// Places cuts each step to so many places before the next, as anyone
// working by hand must. Cut to three, the steps from every start reach
// 1;24,51,10 and stop there: the average of 1;24,51,10 and 2 over it is
// the root plus about 1e-13, whose first three places are 1;24,51,10 again.
//
// Numerals: a place from 1 to 59 is its tens as corner wedges
// (Winkelhaken) on the left, stacked in a column (four as two and two,
// five as three and two), and its units as upright wedges in rows of three
// on the right. Places stand a gap apart and a zero place is a wider gap.
// Nothing marks where the whole part ends: the semicolon in 1;24,51,10 is
// the modern reader's, and the wedges are only 1, 24, 51 and 10.
//
// Each wedge is a triangular pyramid pressed into a height field: a
// triangle outline and its deepest point, the stylus's corner. The upright
// wedge is a broad head with a tail; the corner wedge a short triangle
// pointing left. The LEDs average 16 samples each of the surface normal,
// and the light is a lamp at azimuth and elevation, scaled so flat clay
// keeps one brightness: walls facing the lamp glow, walls facing away go
// dark, and the deeper the floor the darker. The lamp sways, so the light
// moves in every wedge on the panel while the stylus works on one.
//
// An agreeing place lights in two ways at once: its wedges turn turquoise
// with the light spilling 4 LEDs round each, and a soft tile fills the box
// of the place, so the agreeing run of a line reads as one highlighted span.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, sin, cos, PI, hypot, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Clay, its shadow floor, and the colour an agreeing place lights.
const CLAY = [168, 132, 92];
const AMB = 0.16, OCC = 0.85;
const GLOW = [45, 230, 220];

// Wedge sizes in LEDs. A size is the cell an upright wedge or a corner
// wedge sits in, c wide and r tall, and the width w of the wedge inside it.
// The tablet writes small, so its 42;25,35 fits under the diagonal; the
// worked lines write a size up.
const SMALL = { c: 3, r: 4, w: 2.6, x0: 0.2, tu: 1 }, LARGE = { c: 4, r: 4, w: 3, x0: 0, tu: 0 };
const DEPTH = 1.1, SS = 4, HALO = 4, PLACE_GAP = 3, ZERO_GAP = 6;

// Timing in model seconds; Speed 2 runs one model second a second.
const T_WEDGE = 0.06, T_PLACE = 0.08, T_PAUSE = 0.25, T_CHECK = 0.12, T_AFTER = 0.3, T_HOLD = 3.5, T_SMOOTH = 1.2, T_REST = 0.5;

const STARTS = [[3n, 2n], [4n, 3n], [2n, 1n], [1n, 1n], [7n, 5n], [5n, 3n]];
// How many places after the point a step keeps, by Places.
const KEEP = [Infinity, 4, 3, 2, 1];
const PLACES = 8;
// The lamp sways SWAY radians either side of where Lamp sets it, once in SWAY_T model seconds.
const SWAY = 0.5, SWAY_T = 7, EL = (15 * PI) / 180;

// ---- Exact arithmetic.
function isqrt(n) {
  if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}
function sexagesimal(p, q, n) {
  const out = [Number(p / q)];
  let r = p % q;
  for (let k = 0; k < n; k++) {
    r *= 60n;
    out.push(Number(r / q));
    r %= q;
  }
  return out;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const ROOT = (() => {
  let v = isqrt(2n * 60n ** BigInt(2 * PLACES));
  const d = [];
  for (let k = 0; k <= PLACES; k++) {
    d.unshift(Number(v % 60n));
    v /= 60n;
  }
  return d;
})();

// ---- Wedges as pyramids. Each returns its footprint on the LEDs: for every
// LED it touches, the change it makes to the averaged normal, the share of
// the LED inside it, the mean depth and how much of its glow reaches it.
function pyramid(tri, P0) {
  const edges = [];
  for (let i = 0; i < 3; i++) {
    const A = tri[(i + 1) % 3], B = tri[(i + 2) % 3], C = tri[i];
    let nx = -(B[1] - A[1]), ny = B[0] - A[0];
    const l = hypot(nx, ny);
    nx /= l;
    ny /= l;
    if (nx * (C[0] - A[0]) + ny * (C[1] - A[1]) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const d0 = nx * (P0[0] - A[0]) + ny * (P0[1] - A[1]);
    const s = DEPTH / d0, nz = 1 / sqrt(1 + s * s);
    edges.push({ ax: A[0], ay: A[1], nx, ny, d0, Nx: s * nx * nz, Ny: s * ny * nz, Nz: nz });
  }
  const x0 = floor(min(tri[0][0], tri[1][0], tri[2][0])), x1 = ceil(max(tri[0][0], tri[1][0], tri[2][0]));
  const y0 = floor(min(tri[0][1], tri[1][1], tri[2][1])), y1 = ceil(max(tri[0][1], tri[1][1], tri[2][1]));
  const out = [];
  const w = 1 / (SS * SS);
  for (let y = max(0, y0 - HALO); y < min(H, y1 + HALO); y++)
    for (let x = max(0, x0 - HALO); x < min(W, x1 + HALO); x++) {
      let dx = 0, dy = 0, dz = 0, cov = 0, dep = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          let best = 2, k = -1;
          for (let i = 0; i < 3; i++) {
            const e = edges[i], u = (e.nx * (px - e.ax) + e.ny * (py - e.ay)) / e.d0;
            if (u < 0) {
              k = -1;
              break;
            }
            if (u < best) {
              best = u;
              k = i;
            }
          }
          if (k < 0) continue;
          const e = edges[k];
          dx += e.Nx * w;
          dy += e.Ny * w;
          dz += (e.Nz - 1) * w;
          cov += w;
          dep += best * DEPTH * w;
        }
      // The glow of an agreeing place spills a little onto the clay round
      // each wedge, falling off over HALO LEDs from its outline.
      let far = 0;
      for (const e of edges) far = max(far, -(e.nx * (x + 0.5 - e.ax) + e.ny * (y + 0.5 - e.ay)));
      const halo = max(cov, 0.75 * cl(1 - far / HALO, 0, 1));
      if (cov > 0 || halo > 0) out.push(y * W + x, dx, dy, dz, cov, dep, halo);
    }
  return Float32Array.from(out);
}
// An upright wedge: broad head at the top, tail down to a point.
const upright = (x, y, z) =>
  pyramid([[x + z.x0, y + 0.1], [x + z.x0 + z.w, y + 0.1], [x + z.x0 + z.w / 2, y + z.r - 0.1]], [x + z.x0 + z.w / 2, y + 1.2]);
// A corner wedge: a short triangle pointing left, deepest near its point.
const corner = (x, y, z) =>
  pyramid([[x + z.x0, y + 1.5], [x + z.x0 + z.w, y + 0.05], [x + z.x0 + z.w, y + 2.95]], [x + z.x0 + 1.1, y + 1.5]);

// ---- Numerals. A place's wedges in writing order, tens first, from the
// place's left edge x and the line's middle row ym.
function placeWidth(v, z) {
  if (v === 0) return ZERO_GAP - PLACE_GAP;
  const t = floor(v / 10), u = v % 10;
  const tw = t === 0 ? 0 : (t <= 3 ? 1 : 2) * z.c;
  const uw = min(u, 3) * z.c;
  return tw + uw + (t && u ? z.tu : 0) - (z.c - z.w - z.x0 > 0.5 ? 1 : 0);
}
function placeWedges(v, x, ym, z) {
  const out = [];
  const t = floor(v / 10), u = v % 10;
  const cols = t === 0 ? [] : t <= 3 ? [t] : t === 4 ? [2, 2] : [3, 2];
  cols.forEach((n, c) => {
    const top = round(ym - (n * z.r - 1) / 2);
    for (let i = 0; i < n; i++) out.push({ kind: 1, x: x + c * z.c, y: top + i * z.r });
  });
  const ux = x + cols.length * z.c + (t && u ? z.tu : 0);
  const rows = ceil(u / 3), top = round(ym - (rows * z.r - 1) / 2);
  for (let r = 0; r < rows; r++) for (let i = 0; i < min(3, u - 3 * r); i++) out.push({ kind: 0, x: ux + i * z.c, y: top + r * z.r });
  return out;
}
// A number from its places, left edge x: the wedges, each tagged with its
// place and its size.
function numberWedges(digits, x, ym, z) {
  const wedges = [];
  digits.forEach((v, k) => {
    for (const w of placeWedges(v, round(x), ym, z)) wedges.push(Object.assign(w, { place: k, z }));
    x += placeWidth(v, z) + PLACE_GAP;
  });
  return wedges;
}
const numberWidth = (digits, z) => digits.reduce((s, v) => s + placeWidth(v, z) + PLACE_GAP, -PLACE_GAP);

// The soft tile of light under an agreeing place: its wedges' box, full
// strength POOL inside and fading out over 1.5 LEDs.
const POOL = 0.6;
function pool(wedges) {
  let x0 = 99, y0 = 999, x1 = -99, y1 = -999;
  for (const w of wedges) {
    x0 = min(x0, w.x + w.z.x0);
    x1 = max(x1, w.x + w.z.x0 + w.z.w);
    y0 = min(y0, w.y);
    y1 = max(y1, w.y + (w.kind ? 3 : w.z.r - 0.1));
  }
  const out = [];
  for (let y = max(0, floor(y0) - 2); y < min(H, ceil(y1) + 2); y++)
    for (let x = max(0, floor(x0) - 2); x < min(W, ceil(x1) + 2); x++) {
      const dx = max(x0 - x - 0.5, x + 0.5 - x1, 0), dy = max(y0 - y - 0.5, y + 0.5 - y1, 0);
      const v = POOL * smooth((1.5 - hypot(dx, dy)) / 1.5);
      if (v > 0) out.push(y * W + x, v);
    }
  return Float32Array.from(out);
}
function places(wedges) {
  const by = new Map();
  for (const w of wedges) {
    if (!by.has(w.place)) by.set(w.place, []);
    by.get(w.place).push(w);
  }
  return by;
}

function makeItem(w) {
  return { fp: w.kind ? corner(w.x, w.y, w.z) : upright(w.x, w.y, w.z), place: w.place, at: 0, glowAt: Infinity };
}

// ---- The tablet face, upper half: grooves of the square and its diagonals
// in a static normal field, a ruled line under it, and its three numbers as
// items that never fade.
const SQ = { cx: 32, cy: 33, r: 30.5 };
function grooves(st, stD) {
  const { cx, cy, r } = SQ;
  const V = [[cx - r, cy], [cx, cy - r], [cx + r, cy], [cx, cy + r]];
  const segs = [[V[0], V[1]], [V[1], V[2]], [V[2], V[3]], [V[3], V[0]], [V[0], V[2]], [V[1], V[3]], [[1, 67.5], [63, 67.5]]];
  const hw = 0.95, dg = 0.55, s = dg / hw, nz = 1 / sqrt(1 + s * s), w = 1 / (SS * SS);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          let bd = 9, ux = 0, uy = 0;
          for (const [A, B] of segs) {
            const dx = B[0] - A[0], dy = B[1] - A[1];
            const t = cl(((px - A[0]) * dx + (py - A[1]) * dy) / (dx * dx + dy * dy), 0, 1);
            const qx = px - (A[0] + t * dx), qy = py - (A[1] + t * dy), d = hypot(qx, qy);
            if (d < bd) {
              bd = d;
              ux = d > 1e-6 ? qx / d : 0;
              uy = d > 1e-6 ? qy / d : 0;
            }
          }
          if (bd >= hw) continue;
          // The groove's wall tilts towards its middle line.
          st[p * 3] += -s * ux * nz * w;
          st[p * 3 + 1] += -s * uy * nz * w;
          st[p * 3 + 2] += (nz - 1) * w;
          stD[p] += dg * (1 - bd / hw) * w;
        }
      // The clay is a low pillow, 1.5 degrees at the edges.
      st[p * 3] += 0.026 * ((x + 0.5 - 32) / 32);
      st[p * 3 + 1] += 0.026 * ((y + 0.5 - 64) / 64);
    }
}

// The tablet's wedges, and the tiles of light under its 1;24,51,10.
function tabletItems() {
  const items = [], pools = [];
  const { cx, cy } = SQ;
  // 30 by the upper left side, 1;24,51,10 above the level diagonal, 42;25,35 below it.
  const groups = [
    { digits: [30], x: 26, ym: 16, tag: 0 },
    { digits: [1, 24, 51, 10], x: cx - numberWidth([1, 24, 51, 10], SMALL) / 2, ym: cy - 6, tag: 1 },
    { digits: [42, 25, 35], x: cx - numberWidth([42, 25, 35], SMALL) / 2, ym: cy + 7, tag: 2 },
  ];
  for (const g of groups) {
    const wedges = numberWedges(g.digits, g.x, g.ym, SMALL);
    for (const w of wedges) {
      const it = makeItem(w);
      it.tag = g.tag;
      items.push(it);
    }
    if (g.tag === 1) for (const ws of places(wedges).values()) pools.push(pool(ws));
  }
  return { items, pools };
}

// ---- The worked lines, lower half.
const LINE_X = 2, LINE_W = 61, LOW_TOP = 69, LOW_BOT = 127;

// The steps from a start, each cut to `keep` places after the point. A
// line holds as many places as fit across the panel. The lines stop when
// one holds five places and all agree with the root, or when a cut step
// gives back the line before it.
function plan(start, keep) {
  let [p, q] = STARTS[start];
  const lines = [];
  let before = null;
  for (let i = 0; i < 6; i++) {
    const d = sexagesimal(p, q, PLACES);
    let n = 1;
    while (n < d.length && numberWidth(d.slice(0, n + 1), LARGE) <= LINE_W) n++;
    while (n > 1 && d[n - 1] === 0) n--;
    const shown = d.slice(0, n);
    let agree = 0;
    while (agree < n && shown[agree] === ROOT[agree]) agree++;
    lines.push({ shown, agree });
    const same = before && before[0] === p && before[1] === q;
    if ((agree === n && n >= 5) || same) break;
    before = [p, q];
    [p, q] = [p * p + 2n * q * q, 2n * p * q];
    if (keep < Infinity) {
      const unit = 60n ** BigInt(keep);
      [p, q] = [(p * unit) / q, unit];
    }
    const g = gcd(p, q);
    p /= g;
    q /= g;
  }
  const pitch = min(14, floor((LOW_BOT - LOW_TOP) / lines.length));
  const top = LOW_TOP + (LOW_BOT - LOW_TOP - pitch * lines.length) / 2;
  const items = [], pools = [];
  let t = 0.3, sync = Infinity;
  lines.forEach((L, i) => {
    const ym = top + pitch * (i + 0.5);
    const wedges = numberWedges(L.shown, LINE_X, ym, LARGE), byPlace = places(wedges);
    let last = -1;
    for (const w of wedges) {
      if (w.place !== last && last >= 0) t += T_PLACE;
      last = w.place;
      const it = makeItem(w);
      it.at = t;
      it.line = i;
      it.agree = w.place < L.agree;
      items.push(it);
      t += T_WEDGE;
    }
    t += T_PAUSE;
    for (let k = 0; k < L.agree; k++) {
      for (const it of items) if (it.line === i && it.place === k) it.glowAt = t;
      pools.push({ fp: pool(byPlace.get(k)), glowAt: t });
      if (k === 3 && sync === Infinity) sync = t;
      t += T_CHECK;
    }
    t += T_AFTER;
  });
  return { items, pools, end: t + T_HOLD, sync };
}

export function setup(params) {
  const st = new Float32Array(N * 3), stD = new Float32Array(N);
  grooves(st, stD);
  params.s = {
    t: 0, clock: 0, start: -1, keep: -1, lampA: 0,
    st, stD,
    dn: new Float32Array(N * 3), dD: new Float32Array(N), glow: new Float32Array(N),
    plan: null,
  };
  const T = tabletItems();
  params.s.tablet = T.items;
  params.s.tabletPools = T.pools;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.lampA = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const start = cl(round(k[2] || 0), 0, STARTS.length - 1);
  const keep = KEEP[cl(round(4 * (k[3] == null ? 0.06 : k[3])), 0, 4)];
  // A new start, or a new cut, opens on its lines already written, 3.2
  // model seconds before the clay is smoothed and they are written again.
  if (start !== S.start || keep !== S.keep) {
    S.start = start;
    S.keep = keep;
    S.plan = plan(start, keep);
    S.t = S.plan.end - 3.2;
  }
  S.t += (d * speed) / 2;
  S.clock += (d * speed) / 2;
  if (S.t > S.plan.end + T_SMOOTH + T_REST) S.t = 0;
}

function light(S, fp, g) {
  const gl = S.glow;
  for (let i = 0; i < fp.length; i += 2) gl[fp[i]] = max(gl[fp[i]], fp[i + 1] * g);
}

function stamp(S, it, scale, glow) {
  const fp = it.fp, dn = S.dn, dD = S.dD, gl = S.glow;
  for (let i = 0; i < fp.length; i += 7) {
    const p = fp[i];
    dn[p * 3] += fp[i + 1] * scale;
    dn[p * 3 + 1] += fp[i + 2] * scale;
    dn[p * 3 + 2] += fp[i + 3] * scale;
    dD[p] += fp[i + 5] * scale;
    if (glow > 0) gl[p] = max(gl[p], fp[i + 6] * glow);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.plan) return;
  const P = S.plan, t = S.t;
  S.dn.fill(0);
  S.dD.fill(0);
  S.glow.fill(0);
  const fade = 1 - smooth((t - P.end) / T_SMOOTH);
  const sync = smooth((t - P.sync) / 0.4) * fade;
  for (const it of S.tablet) stamp(S, it, 1, it.tag === 1 ? sync : 0);
  if (sync > 0) for (const fp of S.tabletPools) light(S, fp, sync);
  for (const pl of P.pools) if (t >= pl.glowAt) light(S, pl.fp, smooth((t - pl.glowAt) / 0.25) * fade);
  for (const it of P.items) {
    if (t < it.at) continue;
    const press = smooth((t - it.at) / 0.06) * fade;
    stamp(S, it, press, it.agree ? smooth((t - it.glowAt) / 0.25) * fade : 0);
  }
  // The lamp, its azimuth counted anticlockwise from the right with up as
  // up: at Lamp 0 it stands on the left and a little above.
  const az = PI - 0.35 + 2 * PI * S.lampA + SWAY * sin((2 * PI * S.clock) / SWAY_T);
  const Lx = cos(EL) * cos(az), Ly = -cos(EL) * sin(az), Lz = sin(EL);
  const st = S.st, stD = S.stD, dn = S.dn, dD = S.dD, gl = S.glow;
  for (let p = 0; p < N; p++) {
    const nx = st[p * 3] + dn[p * 3], ny = st[p * 3 + 1] + dn[p * 3 + 1], nz = 1 + st[p * 3 + 2] + dn[p * 3 + 2];
    const b = cl((nx * Lx + ny * Ly + nz * Lz) / Lz, 0, 2.2);
    const sh = (AMB + (1 - AMB) * b) * (1 - OCC * cl(stD[p] + dD[p], 0, 1));
    let r = CLAY[0] * sh, g = CLAY[1] * sh, bl = CLAY[2] * sh;
    const gw = cl(gl[p], 0, 1) * 0.9;
    if (gw > 0) {
      const lit = 0.45 + 0.4 * min(1, sh);
      r += (GLOW[0] * lit - r) * gw;
      g += (GLOW[1] * lit - g) * gw;
      bl += (GLOW[2] * lit - bl) * gw;
    }
    display.setPixel(p % W, floor(p / W), cl(round(r), 0, 255), cl(round(g), 0, 255), cl(round(bl), 0, 255));
  }
}
