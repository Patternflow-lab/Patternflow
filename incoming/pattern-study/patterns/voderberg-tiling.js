// ===== Patternflow pattern =====
// Title:   Voderberg Tiling
// Family:  cells
// Idea:    Copies of Voderberg's nine-sided tile, a 12-degree sliver with a barb at its point, lie in his two-armed spiral: each cycle opens close on the middle, where two tiles shut a third in and then two shut in a pair, then backs out while the tiling grows tile by tile along its arms, turns slowly with the colour running out along each arm, and unwinds from the middle.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Voderberg's tile and spiral tiling (Heinz Voderberg, 1936), spiral tilings in Tilings and Patterns (Branko Grünbaum and G. C. Shephard, 1987), pattern round 59
// Round:   59
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=16..44, Arms=2..6
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 one arm runs from teal at the middle to blue at the rim and the other from violet to rose; a tile that points in is a fifth darker than one that points out, each tile brightens toward its wide end, and the grout is dark. The colours also creep a quarter of the way round the wheel in a cycle and move on a step between cycles.
// Knob 2: Speed. At 2 a cycle takes 34 seconds: 2.2 on the four tiles at the middle, 8 for the tiling to grow out to the rim while the view backs out, 20 of the whole spiral turning at 3 degrees a second with a slow wave of light running out along the arms, and 4 to unwind from the middle. Tiles not yet laid show at a seventh of their brightness. 0.2 is ten times slower, 3 half as fast again.
// Knob 3: Size. How long one tile is once the view has backed out: 16 LEDs at the opening, about 300 tiles on the panel and two turns of each arm from the middle to the top edge, up to 44 LEDs and about 40 tiles. At the start of a cycle a tile is 64 LEDs plus 1.4 times this long, 86 at the opening.
// Knob 4: Arms. 2 is Voderberg's own spiral: below the middle the tiles lie in rings round one point and above it in the same rings turned half round, slipped one ring along, so each ring runs on into the next and two arms wind out. 4 and 6 slip the rings two and three rings along, four and six arms of the same tile; the knob rounds to 2, 4 or 6. Only the 2-arm spiral holds the four tiles of the opening, so 4 and 6 go straight to the growth.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, min, max, cos, sin, sqrt, atan2, round, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => ((u = cl(u, 0, 1)), u * u * (3 - 2 * u));
const EPS = (12 * PI) / 180;
// Rings of tiles built round each centre; ten reach past the corners of the
// panel at the smallest size.
const NRING = 10;
// The cycle, in seconds at Speed 2.
const INTRO = 2.2, GROW = 8, HOLD_END = 30, UNWIND = 4, CYCLE = HOLD_END + UNWIND;
// At the opening a tile is 64 LEDs long plus 1.4 times the knob's size.
const L_INTRO = 64, L_INTRO_K = 1.4;
// Tiles not yet laid, or already taken up, show faintly at this level.
const GHOST = 0.14;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const rot = (p, a) => [p[0] * cos(a) - p[1] * sin(a), p[0] * sin(a) + p[1] * cos(a)];

// Voderberg's nonagon. Z is the apex, ZT = 1 and U is T turned 12 degrees
// about Z, so ZTU is the thin isosceles triangle; S is the middle of ZT and
// R is S turned back 12 degrees. The tile's two long sides are the chain
// Z a1 a2 a3 T and the same chain turned 12 degrees about Z, Z b1 b2 b3 U,
// so 30 tiles turned about Z close up into a regular 30-gon, and its other
// side U T is the triangle's base. b1 = T + Z - U makes Z b1 T U a
// parallelogram, and the chain Z b1 b2 b3 U T is the same chain read
// backwards after a half turn about S (so S lies on b2 b3), which lets a
// tile and its half turn about S fit against each other along all five of
// those edges. The one point left free, a2, is fixed by one more ruler and
// compass step: on the line through a1 square to RS (so the corner at a1
// is square) at distance ZT from U. a3 is a2 turned half round R.
// Angles: 12 at Z, 90 at a1 and U, 158.67 at a2 and b2, 201.33 at a3 and
// b3, 78 at T, 270 at b1; the area is that of the triangle, sin(12)/2.
export function voderbergTile() {
  const T = [1, 0], U = rot(T, EPS), R = rot([0.5, 0], -EPS);
  const b1 = [T[0] - U[0], T[1] - U[1]], a1 = rot(b1, -EPS);
  const d = [cos(-EPS / 2), sin(-EPS / 2)];
  const f = [a1[0] - U[0], a1[1] - U[1]];
  const B = f[0] * d[0] + f[1] * d[1], C = f[0] * f[0] + f[1] * f[1] - 1;
  const t = -B - sqrt(B * B - C);
  const a2 = [a1[0] + t * d[0], a1[1] + t * d[1]];
  const a3 = [2 * R[0] - a2[0], 2 * R[1] - a2[1]];
  return [[0, 0], a1, a2, a3, T, U, rot(a3, EPS), rot(a2, EPS), b1];
}

// The tiling. Round a centre the tiles lie in rings one tile long: ring 0 is
// the 30 tiles turned about Z; in ring r, the tile of ring 0 turned j times
// is moved out r times its own ZT and then 0..r times its barb edge Z a1,
// and between two such neighbours sits the half turn of the first about
// the middle of its a2 a3 edge, pointing in (ring r holds 30 (2r + 1)
// tiles, which is its area over the tile's). Voderberg's spiral takes
// the lower half of these rings round Z and the upper half of the same
// rings turned half round a point slipped one ring along ZT: ring r below
// runs on into ring r + 1 above, so the rings become two arms. A slip of k
// rings gives 2k arms. Each tile keeps s = ring + k * (angle / 180), its
// place along its arm, which grows by 2k a turn.
export function buildTiling(k) {
  const X = voderbergTile();
  const list = [];
  const push = (poly, ring, kind) => {
    let mx = 0, my = 0;
    for (const p of poly) (mx += p[0]), (my += p[1]);
    if (my >= 0) return -1;
    list.push({ poly, ring, kind, mx: mx / 9, my: my / 9 });
    return list.length - 1;
  };
  const special = [push(X, 0, 0), -1];
  for (let j = 1; j < 30; j++) {
    const at = push(X.map((p) => rot(p, j * EPS)), 0, 0);
    if (j === 29) special[1] = at;
  }
  for (let r = 1; r <= NRING; r++)
    for (let j = 0; j < 30; j++) {
      const F = X.map((p) => rot(p, j * EPS));
      const uj = rot([1, 0], j * EPS), um = rot([1, 0], (j - 1) * EPS);
      for (let i = 0; i <= r; i++) {
        const sx = r * uj[0] + i * (um[0] - uj[0]), sy = r * uj[1] + i * (um[1] - uj[1]);
        const O = F.map((p) => [p[0] + sx, p[1] + sy]);
        push(O, r, 1);
        if (i < r) {
          const rx = O[2][0] + O[3][0], ry = O[2][1] + O[3][1];
          push(O.map((p) => [rx - p[0], ry - p[1]]), r, 2);
        }
      }
    }
  const half = list.length, n = 2 * half, c = k / 2;
  // Coordinates are centred on the spiral's middle, half way between Z and
  // the slipped centre. Per tile: centre x, y, reach, s, arm parity, kind.
  const V = new Float32Array(n * 18), info = new Float32Array(n * 6);
  list.forEach((t, a) => {
    const th = -atan2(t.my, t.mx);
    for (let h = 0; h < 2; h++) {
      const id = a + h * half, mx = h ? c - t.mx : t.mx - c, my = h ? -t.my : t.my;
      let rad = 0;
      for (let q = 0; q < 9; q++) {
        const x = h ? c - t.poly[q][0] : t.poly[q][0] - c, y = h ? -t.poly[q][1] : t.poly[q][1];
        V[id * 18 + q * 2] = x;
        V[id * 18 + q * 2 + 1] = y;
        rad = max(rad, hypot(x - mx, y - my));
      }
      info[id * 6] = mx;
      info[id * 6 + 1] = my;
      info[id * 6 + 2] = rad;
      info[id * 6 + 3] = t.ring + (k * th) / PI;
      info[id * 6 + 4] = (t.ring + (h ? k : 0)) & 1;
      info[id * 6 + 5] = t.kind;
    }
  });
  // X, A = X turned -12 degrees about Z, B = X turned half round S, A' = A
  // turned half round S: A and B shut X in, A and A' shut in X and B.
  return { n, V, info, X: special[0], A: special[1], B: special[0] + half, A2: special[1] + half };
}

export function setup(params) {
  params.s = {
    k: 0, T: null, sizeFor: 0, sVis: 6, id: new Int32Array(NPX), shade: new Float32Array(NPX),
    c: 0, turn: 0, dir: 1, hue0: 0, P: new Float32Array(18), xs: new Float32Array(12), rgb: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 16, 2];
  const g = (cl(dt || 0, 0, 0.1) * cl(kv[1], 0.2, 3)) / 2;
  S.hue = cl(kv[0], 0, 1);
  S.size = cl(kv[2], 16, 44);
  const k = cl(round(cl(kv[3], 2, 6) / 2), 1, 3);
  if (k !== S.k) (S.k = k), (S.T = buildTiling(k)), (S.sizeFor = 0);
  if (S.size !== S.sizeFor) {
    // The furthest place along the arms that the panel shows at this size,
    // whichever way the tiling is turned: the growth ends there.
    const reach = hypot(32, 64) / S.size, info = S.T.info;
    S.sVis = 0;
    for (let t = 0; t < S.T.n; t++)
      if (hypot(info[t * 6], info[t * 6 + 1]) - info[t * 6 + 2] < reach) S.sVis = max(S.sVis, info[t * 6 + 3]);
    S.sizeFor = S.size;
  }
  S.c += g;
  S.turn += g * 0.05 * S.dir;
  if (S.c >= CYCLE) {
    // A new cycle: the colours move on a step and the turn reverses.
    S.c -= CYCLE;
    S.dir = -S.dir;
    S.hue0 += 0.08 + 0.1 * Math.random();
    S.turn = (Math.random() < 0.5 ? 0 : PI) + 0.4 * (Math.random() - 0.5);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.T) return;
  const { id, shade, P, xs, rgb } = S;
  const { n, V, info } = S.T, k = S.k, c = S.c;
  const intro = k === 1 ? INTRO : 0.8;
  // The view: close on the middle with X standing up, backing out to the
  // tile size of the knob while the tiling grows.
  const z = ease((c - intro + 0.4) / (GROW * 0.75));
  const L = S.size + (L_INTRO + (L_INTRO_K - 1) * S.size) * (1 - z) * (1 - z);
  const th = PI / 2 + S.turn, ct = cos(th), st = sin(th);
  // The growth front and the unwinding front run along the arms in s.
  const front = c < intro ? -1 : 0.2 + ((c - intro) * (S.sVis + 0.4)) / GROW;
  const back = c < HOLD_END ? -1 : ((c - HOLD_END) * (S.sVis + 0.7)) / (UNWIND - 0.4);
  const T = S.T;
  // The opening on the 2-arm spiral: X, then A and B round it, then A' and
  // B pale too, before the rest grows.
  const lightX = k === 1 ? ease(c / 0.5) : 0;
  const lightAB = k === 1 ? ease((c - 0.5) / 0.5) : 0;
  const lightA2 = k === 1 ? ease((c - 1.25) / 0.5) : 0;
  const paleX = k === 1 ? 1 - ease((c - 1.95) / 0.45) : 0;
  const paleB = k === 1 ? ease((c - 1.25) / 0.35) * paleX : 0;
  const alphaOf = (t) => {
    const s = info[t * 6 + 3];
    let a = cl((front - s) / 0.25, 0, 1);
    if (k === 1) {
      if (t === T.X) a = max(a, lightX);
      else if (t === T.A || t === T.B) a = max(a, lightAB);
      else if (t === T.A2) a = max(a, lightA2);
    }
    if (back >= 0) a *= cl((s - back) / 0.6, 0, 1);
    return a;
  };
  id.fill(-1);
  const cx = 32, cy = 64;
  for (let t = 0; t < n; t++) {
    const o = t * 6;
    const mx = info[o], my = info[o + 1];
    const px = cx + L * (ct * mx - st * my), py = cy - L * (st * mx + ct * my), pr = L * info[o + 2] + 1;
    if (px + pr < 0 || px - pr > W || py + pr < 0 || py - pr > H) continue;
    // Scanline fill of the nonagon: an LED belongs to the tile its centre
    // falls in. The shade runs from the point (0) to the far end (1).
    const vo = t * 18;
    let ymin = 1e9, ymax = -1e9;
    for (let q = 0; q < 9; q++) {
      const x = V[vo + q * 2], y = V[vo + q * 2 + 1];
      P[q * 2] = cx + L * (ct * x - st * y);
      P[q * 2 + 1] = cy - L * (st * x + ct * y);
      if (P[q * 2 + 1] < ymin) ymin = P[q * 2 + 1];
      if (P[q * 2 + 1] > ymax) ymax = P[q * 2 + 1];
    }
    const zx = P[0], zy = P[1], ex = P[8] - zx, ey = P[9] - zy, e2 = ex * ex + ey * ey;
    const y0 = max(0, ceil(ymin - 0.5)), y1 = min(H - 1, floor(ymax - 0.5));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      let m = 0;
      for (let q = 0; q < 9; q++) {
        const q2 = q === 8 ? 0 : q + 1;
        const ax = P[q * 2], ay = P[q * 2 + 1], bx = P[q2 * 2], by = P[q2 * 2 + 1];
        if ((ay <= yc && yc < by) || (by <= yc && yc < ay)) xs[m++] = ax + ((yc - ay) * (bx - ax)) / (by - ay);
      }
      for (let i = 1; i < m; i++) {
        const v = xs[i];
        let j = i - 1;
        while (j >= 0 && xs[j] > v) (xs[j + 1] = xs[j]), j--;
        xs[j + 1] = v;
      }
      for (let i = 0; i + 1 < m; i += 2) {
        const xa = max(0, ceil(xs[i] - 0.5)), xb = min(W - 1, floor(xs[i + 1] - 0.5));
        for (let x = xa; x <= xb; x++) {
          id[y * W + x] = t;
          shade[y * W + x] = cl(((x + 0.5 - zx) * ex + (yc - zy) * ey) / e2, 0, 1);
        }
      }
    }
  }
  // Grout is darker on big tiles, lighter on small ones, so a small tiling
  // does not go grey.
  const grout = 0.18 + 0.22 * cl((30 - L) / 14, 0, 1);
  const wave = c > intro ? 1 : 0;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const t = id[p];
      if (t < 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const o = t * 6, s = info[o + 3], arm = info[o + 4], kind = info[o + 5];
      const a = alphaOf(t);
      // Colour runs along each arm with s, and creeps outward with time.
      const run = (0.045 * s) / k - 0.008 * c;
      let hue = S.hue + S.hue0 + 0.47 + run + (arm ? 0.36 : 0);
      let sat = 0.78, val = (kind === 2 ? 0.8 : 1) * (0.72 + 0.28 * shade[p]);
      val *= 1 - 0.18 * wave * (0.5 + 0.5 * cos(2 * PI * (s / (2 * k) - 0.11 * c)));
      // The tiles of the opening: pale X (and B), A and B bright.
      if (k === 1 && paleX > 0) {
        if (t === T.X || (t === T.B && paleB > 0)) sat *= 1 - 0.85 * (t === T.X ? paleX : paleB);
      }
      // A new tile flashes pale as it lands.
      const fresh = front > 0 && a > 0 ? cl(1 - (front - s) / 0.5, 0, 1) : 0;
      sat *= 1 - 0.6 * fresh;
      hsv(hue, sat, val, rgb);
      const seam = (x < W - 1 && id[p + 1] !== t) || (y < H - 1 && id[p + W] !== t) || (x > 0 && id[p - 1] < 0) || (y > 0 && id[p - W] < 0);
      const kk = (GHOST + (1 - GHOST) * a) * (seam ? grout : 1) * 255;
      display.setPixel(x, y, (rgb[0] * kk) | 0, (rgb[1] * kk) | 0, (rgb[2] * kk) | 0);
    }
}
