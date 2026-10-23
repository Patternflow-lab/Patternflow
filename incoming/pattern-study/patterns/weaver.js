// ===== Patternflow pattern =====
// Title:   Weaver
// Family:  bird
// Idea:    A male village weaver builds his nest at the tip of an acacia twig over a river: he tears green strips off the reeds and threads them in, and the nest grows strand by strand from a ring to a round chamber with a downward entrance while old strips fade to straw.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 22, after field photographs of village weaver (Ploceus cucullatus) colonies
// Round:   22
// ===============================
// @matrix 64x128
// @knobs Plumage=0..2, Speed=0.2..3, Nests=3..9, Sky=0..1
//
// Knob 1: Plumage. A village weaver at 0, yellow with a black mask and a red eye, over a river; a golden weaver at 1 over a reed bed; a brown-masked baya weaver at 2 over a paddy field, its nests hung from a woven neck with a long tube.
// Knob 2: Speed. How fast the birds, the wind and the water go: at 2 a strand takes him about eight seconds, there, back and woven in.
// Knob 3: Nests. Three to nine nests in the tree, his among them. The bigger the colony, the further along his nest is at the start, from a ring with its roof begun to a chamber that wants only its entrance.
// Knob 4: Sky. Morning at 0 with the sun low on the right, noon at 0.5, evening at 1 with the sun going down on the left.
// Buttons: K1 tap calls a female: he hangs under his nest and flutters while she looks it over, and a finished nest she turns down he cuts loose into the river.

const [W, H] = [64, 128];
const N = W * H;
// The far bank, the water, the near bank; his twig's tip and root.
const [HOR, WTOP, NEAR, AX, AY, RX, RY] = [89, 95, 121, 37, 38, 40, 19];
const { min, max, floor, ceil, round, sin, cos, abs, hypot, pow, atan2, sign, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const mixc = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const sm = (x) => ((x = cl(x, 0, 1)), x * x * (3 - 2 * x));
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Value noise that wraps every `per` cells.
function vn(x, y, per = 4096) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const x0 = ((xi % per) + per) % per, x1 = (x0 + 1) % per, a = hash(x0, yi), b = hash(x1, yi), c = hash(x0, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(x1, yi + 1)) * su * sv;
}
const hx = (s) => s.split(" ").map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));

// Village, golden, baya: plumage in KEYS order (crown, mask, eye, bill, nape, breast, back, streak,
// wing, wing edge, tail), the fresh strip, and the nest's tube, neck and chamber radii.
const KEYS = "CKEBNYMmWyT";
const SP = [
  [hx("18140e 100c0a f02418 221c18 b25c1a fcd61c f0ca20 28220c 2e2816 e8ca38 706426 5cb234"), [5, 0, 9, 8.5]],
  [hx("ffcc18 fa8c12 faf0ba 1e1812 ffc816 ffc610 e4ac10 c49216 a48c1c fcd02c a48a20 82bc38"), [2, 0, 9.5, 9]],
  [hx("ffd828 482e1a 402616 30241c fad22c f6d040 98703a 5c4226 684e2c d2b476 7c623c 9cc458"), [15, 5, 7.5, 8.5]],
];
const pal = (a) => Object.fromEntries([...KEYS].map((k, i) => [k, a[i]]).concat([["F", [204, 150, 128]]]));
const FPAL = pal(hx("b4a04a d8c670 7c4a28 ccae86 b4a04a e8da92 a08a4a 64522e 725e34 c8b472 867240"));
const [STRAW, OLD] = hx("ceb874 96805c");

// The bird facing right: rows, anchor, bill tip.
const pose = (s, ax, ay, tx, ty) => ({ rows: s.split(" "), ax, ay, tx, ty });
const PERCH = pose("......CCC .....NCCCC .....NKEKKB ....MMKKKBBB ...MmMYKK ..WWWMYYY .yWWWYYYY TyWWyYYY TT..YYY T...F.F", 6, 5, 11, 3);
const POKE = pose(". ...MMM ..WWMNCCC .yWWMNCCCC TyWWYMKEKKB TT.YYYKKKBBB T...YYYKK ....F.F", 5, 4, 11, 5);
const FA = pose("...yW ...yWW ....yWW..CC TTMMMWWNCCKB ..TYYYYYKEKBB .....YYYYKK", 6, 4, 12, 4);
const flap = (t) => (floor(t / 0.065) & 1 ? FB : FA);
const FB = pose(".........CC TTMMMMMNCCKB ..TYYWWWYKEKBB .....yWWWKK ......yWW .......yW", 6, 2, 12, 2);

// Morning, noon, evening: sky overhead, at the horizon, the light, the sun.
const SKY = [
  [...hx("5480c6 fcc28e"), [1.08, 0.9, 0.74], 50, 79],
  [...hx("2c72e0 acd6f6"), [1, 1, 1], 40, -40],
  [...hx("3e3686 ff8442"), [1.12, 0.74, 0.56], 16, 84],
];
// The acacia: limbs as x0, y0, x1, y1, w0, w1, and the flat plates of its crown.
const LIMBS = [[6, 25, 24, 18, 3.6, 2.6], [24, 18, 44, 19, 2.6, 2], [44, 19, 63, 14, 2, 1.3], [40, 19, 57, 26, 1.7, 1.2], [57, 26, 64, 31, 1.2, 1], [7, 50, 20, 45, 2.8, 1.7], [20, 45, 28, 49, 1.7, 1]];
const PLATES = [[32, 3, 42, 6.5], [6, 11, 13, 5], [48, 10, 20, 4.5], [22, 12, 10, 3], [62, 16, 8, 3]];
// The rest of the colony: twig tip, twig root, size, which way it faces.
const COLONY = [[13, 31, 14, 21, 0.72, -1], [55, 56, 57, 26, 0.8, 1], [19, 64, 19, 47, 0.72, 1], [52, 31, 50, 19, 0.62, -1], [29, 82, 26, 48, 0.62, 1], [61, 84, 62, 30, 0.6, -1], [26, 27, 27, 19, 0.52, 1], [14, 85, 12, 51, 0.58, -1]];
// The two tall blades he strips: foot, height, lean.
const PICK = [[15, 123, 20, 3], [50, 122, 21, -2.5]];
const [WEAVE, OUT, TEAR, BACK, SHOW, CUT] = [0, 1, 2, 3, 4, 5];
const DUR = [3.2, 1.5, 1.4, 1.7, 1, 1.6];

// A nest as strands in the order they go in, in LEDs from the twig tip, facing right: the neck
// round the twig, the ring he stands in, the egg chamber from the roof round the back, the front
// wall down to the entrance, the entrance tube. F says which strand closes each LED of the wall.
function gen([tube, nk, rx, ry], seed, s) {
  let c = 0;
  const r = () => hash(seed, c++), S = [], cy = nk + 8, bx = -3, by = cy + 1.5, F = [];
  const add = (p) => S.push({ p, sh: 0.85 + 0.3 * r() });
  const arcs = (n, cx, cy, ax, ay, th, f0, keep) => {
    for (let j = 0; j < n; j++) {
      const p = [], f = f0 + (1 - f0) * r(), t = th(j) + (r() - 0.5) * 0.7, sw = 1.6 + r(), ox = 2 * r() - 1, oy = 2 * r() - 1;
      for (let a = -sw / 2; a < sw / 2; a += 0.5 / (ax * f)) {
        const x = cx + ox + cos(t + a) * ax * f, y = cy + oy + sin(t + a) * ay * f;
        if (keep(x, y)) p.push(x, y);
      }
      add(p);
    }
  };
  const ring = (x, y) => (x / 5) ** 2 + ((y - cy) / 7) ** 2, ball = (x, y) => ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2;
  const door = (x, y) => y > cy + 4.5 && abs(x - 2) < 2.5;
  for (let y = 0; y < nk - 0.5; y += 1.5) {
    const p = [], w = 1 + y * 0.22;
    for (let i = 0; i <= 8; i++) p.push(-w + (w * i) / 4, y + i * 0.3);
    add(p);
  }
  for (let i = 0; i < 6; i++) {
    const p = [], f = 0.9 + 0.2 * r(), a0 = r() * 6.3, sw = 4 + 2 * r();
    for (let a = 0; a < sw; a += 0.12) p.push(cos(a0 + a) * 5 * f, cy + sin(a0 + a) * 7 * f);
    add(p);
  }
  const pre = S.length;
  arcs(16, bx, by, rx, ry, (j) => -PI / 2 - (j / 15) * PI * 1.1, 0.45, (x, y) => ball(x, y) < 1);
  const ch = S.length;
  arcs(7, 0, cy, 6, 8, (k) => -1.2 + k * 0.42, 0.35, (x, y) => ring(x, y) < 1 && !door(x, y));
  const fr = S.length, t0 = cy + 5, nt = 2 + round(tube / 2), dy = (tube + 3) / nt;
  for (let k = 0; k < nt; k++) {
    const p = [], y = t0 + k * dy, hw = k < 2 ? 4.4 - k : 2.6, c = 2.6 + (y - t0) * 0.08;
    for (let i = 0; i <= 8; i++) p.push(c - hw + (hw * i) / 4, y + i * 0.28);
    add(p);
  }
  for (let y = 0; y < t0 + tube + 4; y += 1 / s)
    for (let x = -13; x < 8; x += 1 / s) {
      const g = ring(x, y), tk = floor((y - t0) / dy), w = (1.5 * PI - atan2((y - by) / ry, (x - bx) / rx)) % (2 * PI);
      let k = -1;
      if (y < nk) k = abs(x) < 1 + y * 0.22 ? floor(y / 1.5) : -1;
      else if (g < 1 && !door(x, y)) k = g > 0.6 ? pre - 6 : ch + cl(round((atan2((y - cy) / 8, x / 6) + 1.2) / 0.42), 0, 6);
      else if (ball(x, y) < 1 && !door(x, y)) k = pre + min(15, round(w / (PI * 0.0733)));
      else if (y >= t0 && tk < nt && abs(x - 2.6 - (y - t0) * 0.08) < (tk < 2 ? 4.4 - tk : 2.6)) k = fr + tk;
      if (k >= 0) F.push(x, y, k + (y > t0 + tube + 1.8) * 1000);
    }
  return Object.assign(S, { pre, fr, by, F });
}

// A nest's point on the panel, swaying on its twig and dipping when a bird lands.
const nxy = (n, lx, ly) => [n.x + n.sw * (1 + (ly * n.s) / 20) + lx * n.s * n.face, n.y + n.dip + n.fall + ly * n.s];

function build(P) {
  const { alb, mat } = P;
  const set = (x, y, m, r, g, b) => x >= 0 && x < W && y >= 0 && y < H && ((mat[y * W + x] = m), alb.set([r, g, b], (y * W + x) * 3));
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, k = 0.8 + 0.3 * vn(x * 0.4, y * 0.8) + 0.1 * hash(x + 7, y);
    if (y >= NEAR + round(2 * vn(x * 0.2, 4))) set(x, y, 5, 118 * k, 96 * k, 58 * k);
    else if (y >= WTOP) set(x, y, 4, 0, 0, 0);
    else if (y >= HOR) set(x, y, 3, 200 * k, 166 * k, 96 * k);
  }
  // Flat-topped acacias on the far bank.
  for (let i = 0; i < 6; i++) {
    const cx = 12 + i * 10.5 + rnd() * 5, top = HOR - 4 - floor(rnd() * 4), w = 2 + rnd() * 4;
    for (let y = top; y < top + 2; y++) for (let x = round(cx - w - (y - top) * 1.5); x <= cx + w + (y - top) * 1.5; x++) set(x, y, 6, 44, 60, 50);
    for (let y = top + 2; y < HOR; y++) set(round(cx), y, 6, 52, 56, 46);
  }
  const bark = (x, y, e, k = (0.72 + 0.4 * vn(x * 0.8, y * 0.16)) * (1.1 - 0.45 * e * e) * (e > 0.3 ? 1.12 : 1)) => set(x, y, 1, 112 * k, 94 * k, 76 * k);
  for (let y = 10; y < H; y++) for (let c = 5.5 + 1.8 * sin(y * 0.03 + 0.5), w = 2 + (y / H) * 2.2, x = floor(c - w); x <= c + w; x++) bark(x, y, (x - c) / w);
  for (const [x0, y0, x1, y1, w0, w1] of LIMBS)
    for (let i = 0, n = ceil(hypot(x1 - x0, y1 - y0) * 2); i <= n; i++) {
      const f = i / n, x = mix(x0, x1, f), y = mix(y0, y1, f), w = mix(w0, w1, f);
      for (let dy = -w / 2; dy <= w / 2; dy += 0.5) bark(round(x), round(y + dy), (-2 * dy) / w);
    }
  for (const [cx, cy, rx, ry] of PLATES)
    for (let y = floor(cy - ry); y <= cy + ry; y++)
      for (let x = floor(cx - rx); x <= cx + rx; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2, n = vn(x * 0.35, y * 0.5 + 20) * 0.7 + vn(x * 0.9, y * 1.1) * 0.3;
        const k = 0.55 + 0.6 * n + (y < cy - ry * 0.3 ? 0.28 : 0) - (y > cy + ry * 0.35 ? 0.2 : 0);
        if (d < 1 && n > 0.25 + 0.4 * d) set(x, y, 2, 80 * k, 118 * k, 44 * k);
      }
  // Reeds at the water's edge, and more out in a reed bed.
  P.reeds = Array.from({ length: 40 }, (_, i) =>
    i < 12 ? [(i & 1 ? 44 : 10) + (i >> 1) * 2.4 + rnd() * 2, NEAR + 1, 12 + floor(rnd() * 9), rnd() * 7, i % 3 === 0] : [3 + rnd() * 60, WTOP + 4 + floor(rnd() * 20), 7 + floor(rnd() * 9), rnd() * 7, i % 2 === 0]);
  P.shad = Float32Array.from({ length: 128 }, (_, i) => sm(1 - abs(i - 34) / 26) + 0.7 * sm(1 - abs(i - 96) / 16));
  P.cloud = Float32Array.from({ length: 128 * 36 }, (_, i, x = i & 127, y = i >> 7) => sm((vn(x / 16, y / 4, 8) * 0.65 + vn(x / 7, y / 2.5 + 9, 128 / 7) * 0.35 - 0.5) * 3) * sm(1 - abs(y - 16) / 18));
}

// The sky for the hour, and the water and paddy that reflect it.
function paint(P) {
  const f = P.sk * 2, i = min(1, floor(f)), [top, hor, tint, sx, sy] = SKY[i].map((v, c) => (v.map ? mixc(v, SKY[i + 1][c], f - i) : mix(v, SKY[i + 1][c], f - i)));
  const { alb, mat, bg, wet, rice } = P, G = [70, 160, 44];
  Object.assign(P, { hor, tint, sx, sun: cl(1 - abs(sy - 70) / 60, 0, 1) });
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, m = mat[p], o = p * 3, ds = hypot(x - sx, (y - sy) * 1.2), z = (y - WTOP) / (NEAR - WTOP), row = (y - WTOP + 2) ** 0.7 * 1.6;
    const band = m === 4 && row % 1 < 0.42 && hash(x, floor(row)) > 0.15 ? rice : 0;
    wet[p] = m === 4 ? 1 - band : 0;
    for (let c = 0, a; c < 3; c++)
      (a = alb[o + c] * tint[c]),
        (bg[o + c] =
          m === 0 ? mix(top[c], hor[c], pow(y / HOR, 1.5)) + (sy > 0 ? (ds < 3.2 ? 255 : 120 * Math.exp(-ds / 9)) : 0)
          : m === 4 ? mix(mix(hor[c], top[c], 0.3 + 0.5 * z) * (0.8 - 0.2 * z), G[c] * tint[c] * (0.8 + 0.4 * hash(x, y)), band)
          : m === 3 || m === 6 ? mix(a, hor[c], m === 6 ? 0.4 : 0.22)
          : a);
  }
}

function species(P, s) {
  const i = min(1, floor(s)), f = s - i, [c0, q0] = SP[i], [c1, q1] = SP[i + 1], v = c0.map((c, j) => mixc(c, c1[j], f)), M = P.main;
  Object.assign(P, { pal: pal(v), fresh: v[11], rice: cl(s - 1, 0, 1), reedN: 12 + round(28 * (1 - abs(s - 1))) });
  for (const n of [M, ...P.col]) n.S = gen(mixc(q0, q1, f), n.seed, n.s);
  M.nb = min(M.nb, M.S.length);
}

const nest = (x, y, rx, ry, s, face, seed) => ({ x, y, rx, ry, s, face, seed, nb: 0, age: [], sw: 0, dip: 0, dv: 0, fall: 0, ph: rnd() * 7 });

export function setup(params) {
  const P = params, F = (n) => new Float32Array(n);
  Object.assign(P, { alb: F(N * 3), mat: new Uint8Array(N), bg: F(N * 3), buf: F(N * 3), wet: F(N), sp: -1, sk: -1, t: 0, fs: 0, side: 0, spt: 9 });
  P.main = nest(AX, AY, RX, RY, 1.3, 1, 7);
  P.col = COLONY.map((c, i) => Object.assign(nest(...c, 101 + i * 37), { old: (i * 0.37) % 1, fresh: i === 2 }));
  build(P);
}

// Where he clings to weave strand j at reveal u: outside the wall, facing it.
function wpos(P, j, u) {
  const M = P.main, p = M.S[min(j, M.S.length - 1)].p, i = min(p.length - 2, floor((u * p.length) / 2) * 2);
  const [x, y] = nxy(M, p[i], p[i + 1]), [cx, cy] = nxy(M, -2, M.S.by), l = hypot(x - cx, y - cy) || 1, dx = (x - cx) / l, dy = (y - cy) / l;
  return [x + dx * 4.5, y + dy * 4.5 + (dy > 0.55 ? 1 : -1), dx > 0 ? -1 : 1, dy > 0.55];
}
function bladeTip(P, k) {
  const [bx, by, h, lean] = PICK[k], b = P.bend[k];
  return [bx + lean + sin(P.t * 1.3 + k * 2) * 0.8 + b * sign(lean) * 0.8, by - h + b];
}

function stepMale(P, d) {
  const M = P.main, held = P.fs && P.fs < 4;
  let u = (P.bt += d) / DUR[P.bs];
  const go = (s) => ((P.bs = s), (P.bt = 0), (P.x0 = P.bx), (P.y0 = P.by));
  const fly = ([tx, ty], arc) => ([P.face, P.bx, P.by, P.pose, P.hang] = [tx >= P.x0 ? 1 : -1, mix(P.x0, tx, sm(u)), mix(P.y0, ty, sm(u)) - arc * sin(PI * u), flap(P.bt), false]);
  P.show = false;
  if (held && !P.bs) (P.bt -= d), (P.show = true), (u = -1);
  switch (P.bs) {
    case WEAVE: {
      if (u < 0) break;
      // Five passes, each a push through the wall and a tug that pulls it tight and shakes the twig.
      const k = cl(u, 0, 1) * 5, q = floor(k), f = k - q, rv = min(1, (q + sm(f * 2.5)) / 5);
      [P.bx, P.by, P.face, P.hang] = wpos(P, M.nb, rv);
      [P.rev, P.pose, P.strip] = [rv, f < 0.42 ? POKE : PERCH, (1 - rv) * 13];
      if (f >= 0.42 && !P.tug) M.dv += 5;
      P.tug = f >= 0.42;
      if (u >= 1) (M.age[M.nb++] = P.t), (P.rev = P.strip = 0), go(M.nb >= M.S.length ? SHOW : OUT);
      break;
    }
    case OUT:
      P.tip = bladeTip(P, P.side);
      fly([P.tip[0], P.tip[1] - 4], 5);
      if (u >= 1) go(TEAR);
      break;
    case TEAR: {
      // Bite low on the blade and back off up it, tearing a strip.
      const t = bladeTip(P, P.side), e = sm((u - 0.25) / 0.6), fc = PICK[P.side][3] > 0 ? -1 : 1;
      P.bend[P.side] = min(3, P.bend[P.side] + d * 12);
      [P.face, P.pose, P.hang, P.bx, P.by] = [fc, u < 0.25 || (u > 0.5 && u < 0.6) ? POKE : PERCH, false, t[0] - fc * 3 * e, t[1] - 4 - 2 * e];
      P.tear = u > 0.2 && u < 0.88 ? [t[0] + fc * 3, t[1] + 6] : null;
      if (u >= 1) (P.tear = null), (P.strip = 13), go(BACK), (P.side ^= 1);
      break;
    }
    case BACK:
      fly(wpos(P, M.nb, 0), 6);
      if (u >= 1) (M.dv += 16), go(WEAVE);
      break;
    case SHOW:
      P.show = true;
      if (!P.fs && P.bt > 0.8) callFemale(P);
      if (P.reject) (P.reject = false), go(CUT);
      break;
    case CUT: {
      const [x, y] = nxy(M, 0, 0);
      [P.bx, P.by, P.face, P.hang, P.pose] = [x - 3, y - 3, 1, false, floor(P.bt / 0.2) & 1 ? POKE : PERCH];
      if (u >= 1) (M.fv = -10), (M.fall = 0.01), (M.dv -= 20), go(OUT);
    }
  }
  if (P.bs !== TEAR) P.bend = P.bend.map((b) => max(0, b - d * 8));
}

function callFemale(P) {
  if (!P.fs) Object.assign(P, { fs: 1, ft: 0, fx0: 70, fy0: 30 + rnd() * 20 });
}
function stepFemale(P, d) {
  const M = P.main, done = M.nb >= M.S.length, [rx, ry] = nxy(M, -3, M.S.by - 8.5).map((v, i) => v - 1 - 4 * i), u = (P.ft += d) / [1, 1.8, 3.4, 1, 1.8][P.fs];
  const go = (s) => ((P.fs = s), (P.ft = 0), (P.fx0 = P.fx), (P.fy0 = P.fy));
  if (P.fs === 1 || P.fs === 4) {
    const [tx, ty] = P.fs === 1 ? [rx, ry] : [-12, 24];
    [P.fx, P.fy, P.ff, P.fp] = [mix(P.fx0, tx, sm(u)), mix(P.fy0, ty, sm(u)) - 5 * sin(PI * u), tx > P.fx0 ? 1 : -1, flap(P.ft)];
    if (P.fs === 1 && u >= 1) (M.dv += 10), go(2);
    if (P.fs === 4 && u >= 1) (P.fs = 0), (P.reject = done);
  } else {
    [P.fx, P.fy, P.ff, P.fp] = [rx, ry, floor(P.ft / 0.9) & 1 ? 1 : -1, floor(P.ft / 0.45) % 3 === 1 ? POKE : PERCH];
    if (u >= 1) go(4);
  }
}

export function update(dt, input, params) {
  const P = params, k = input.knobValues || [0, 2, 3, 0.06], sp = cl(k[0], 0, 2), sk = cl(k[3], 0, 1), nn = cl(k[2], 3, 9), M = P.main;
  if (abs(sp - P.sp) > 0.004) (P.sp = sp), species(P, sp), (P.sk = -1);
  if (abs(sk - P.sk) > 0.002) (P.sk = sk), paint(P);
  P.nn = round(nn) - 1;
  if (!P.bend) {
    // Start halfway through a strand.
    M.nb = min(M.S.length - 1, M.S.pre + 3 + round(((nn - 3) / 6) * (M.S.fr - M.S.pre - 3)));
    for (let j = 0; j < M.nb; j++) M.age[j] = -(M.nb - j) * 7.8;
    Object.assign(P, { bs: WEAVE, bt: 1.4, rev: 0, strip: 0, bend: [0, 0] });
  }
  if (input.btnPressed?.[0]) callFemale(P);
  const d = cl(dt, 0, 0.1) * (cl(k[1], 0.2, 3) / 2);
  P.t += d;
  for (const n of [M, ...P.col]) {
    n.sw = (0.55 * sin(P.t * 0.9 + n.ph) + 0.3 * sin(P.t * 2.3 + n.ph * 2)) * (1.4 - n.s * 0.4);
    n.dv += (-70 * n.dip - 5 * n.dv) * d;
    n.dip = cl(n.dip + n.dv * d, -3, 4);
  }
  if (M.fall) {
    M.fall += (M.fv += 90 * d) * d;
    if (M.y + M.fall > WTOP + 2) (P.spx = M.x - 2), (P.spt = 0), (M.fall = M.nb = 0), (M.seed += 11), species(P, P.sp);
  }
  stepMale(P, d);
  if (P.fs) stepFemale(P, d);
  P.spt += d;
}

let BUF, TT;
function Ao(o, r, g, b, a = 1) {
  BUF[o] += (r - BUF[o]) * a;
  BUF[o + 1] += (g - BUF[o + 1]) * a;
  BUF[o + 2] += (b - BUF[o + 2]) * a;
}
const A = (x, y, r, g, b, a) => x >= 0 && x < W && y >= 0 && y < H && Ao((y * W + x) * 3, r, g, b, a);
const AL = (x, y, c, k = 1) => A(x, y, c[0] * k * TT[0], c[1] * k * TT[1], c[2] * k * TT[2]);

// Flipped, he hangs upside down; turned, he hangs head down with his wings going.
function drawBird(S, pl, x0, y0, face, flip, turn) {
  const ox = round(x0), oy = round(y0);
  S.rows.forEach((row, r) =>
    [...row].forEach((ch, c, _, col = ch === "M" && (c + r) & 1 ? pl.m : pl[ch]) => col && (turn ? AL(ox + (r - S.ay) * face, oy + c - S.ax, col) : AL(ox + (c - S.ax) * face, oy + (flip ? S.ay - r : r - S.ay), col))),
  );
  return [ox + (S.tx - S.ax) * face, oy + (flip ? S.ay - S.ty : S.ty - S.ay)];
}

// A strip of grass from the bill: trailing in flight, hanging while he weaves.
function strip(P, [x, y], len, face, flying) {
  let a = flying ? (face > 0 ? PI * 0.9 : PI * 0.1) : PI / 2 - face * 0.6;
  const tg = flying ? a : PI / 2;
  for (let i = 0; i < len; i++) {
    a += (tg - a) * 0.15 + 0.12 * sin(P.t * 9 + i * 0.8);
    AL(round((x += cos(a))), round((y += sin(a))), P.fresh, 1.1 + 0.15 * sin(i));
  }
}

function drawNest(P, n, nb, rev, light) {
  const S = n.S, F = S.F, sd = (P.sx > 32 ? 1 : -1) * n.face, { x: nx, s, face, sw } = n, ny = n.y + n.dip + n.fall, lim = min(nb, S.length - 1), C = [];
  for (let j = 0; j <= lim; j++) {
    C[j] = (n.fresh ? mixc(P.fresh, STRAW, (0.7 * (nb - j)) / 12) : n.old >= 0 ? mixc(STRAW, OLD, n.old) : mixc(P.fresh, STRAW, sm((P.t - (n.age[j] ?? P.t)) / 45))).map((v, c) => v * TT[c]);
  }
  const lit = (lx, ly) => 0.84 + 0.16 * cl((lx * sd) / 9 - (ly - S.by) / 20, -1, 1), at = (lx, ly) => [round(nx + sw * (1 + (ly * s) / 20) + lx * s * face), round(ny + ly * s)];
  n.low = -99;
  for (let i = 0; i < F.length; i += 3) {
    const k = F[i + 2] % 1000, lx = F[i], ly = F[i + 1];
    if (k > lim || (k === nb && rev < 0.7)) continue;
    // The wall behind the strands: straw in slanting runs, the entrance mouth dark.
    const [xi, yi] = at(lx, ly), c = C[k], q = F[i + 2] > 999 ? 0.15 : light * lit(lx, ly) * (0.68 + 0.1 * hash(i, 5) + 0.12 * sin((lx * 0.8 + ly) * 2.2 + 1.5 * sin(lx * 0.5 - ly * 0.3)));
    A(xi, yi, c[0] * q, c[1] * q, c[2] * q);
    if (yi > n.low) [n.low, n.lowx] = [yi, xi];
  }
  for (let j = 0; j <= lim; j++) {
    const p = S[j].p, m = j < nb ? p.length : floor((rev * p.length) / 2) * 2, k0 = light * S[j].sh, [cr, cg, cb] = C[j];
    for (let i = 0; i < m; i += 2) {
      const [xi, yi] = at(p[i], p[i + 1]), k = k0 * (lit(p[i], p[i + 1]) + ((i >> 2) & 1 ? 0.1 : -0.08));
      A(xi, yi + 1, cr * 0.3, cg * 0.3, cb * 0.3, 0.3);
      A(xi, yi, cr * k, cg * k, cb * k);
    }
  }
}

function twig(n) {
  const [tx, ty] = nxy(n, 0, 0);
  for (let i = 0, L = ceil(hypot(tx - n.rx, ty - n.ry) * 1.3); i <= L; i++) AL(round(mix(n.rx, tx, i / L) + 1.5 * sin((PI * i) / L) * n.face), round(mix(n.ry, ty, i / L)), [96, 80, 64]);
}

function sky(P) {
  // Clouds drift behind the tree; the crown flickers in the wind.
  const { buf, mat, wet, t, sun } = P, off = t * 3, CT = P.cloud, cc = P.hor.map((v) => mix(v, 255, 0.55));
  for (let p = 15 * W; p < 86 * W; p++)
    if (!mat[p]) {
      const x = (p & 63) + off, x0 = floor(x), f = x - x0, r = ((p >> 7) - 7) * 128;
      Ao(p * 3, cc[0], cc[1], cc[2], (CT[r + (x0 & 127)] * (1 - f) + CT[r + ((x0 + 1) & 127)] * f) * 0.8);
    }
  for (let p = 0; p < 22 * W; p++) if (mat[p] === 2) for (let c = 0, s = 0.8 + 0.45 * CT[((p >> 6) + 8) * 128 + (((p & 63) + floor(t * 6)) & 127)]; c < 3; c++) buf[p * 3 + c] *= s;
  // Ripples on the water, and the sun's road across it.
  for (let p = WTOP * W; p < (NEAR + 2) * W; p++) {
    if (!wet[p]) continue;
    const x = p & 63, y = p >> 6, z = (y - WTOP) / 26, rp = sin(y * 1.9 + 2.4 * sin(x * 0.2 + t * 0.7 + y * 0.3) - t * 1.6), o = p * 3;
    const g = rp > 0.75 ? cl((0.4 + 1.6 * sun * cl(1 - abs(x - P.sx) / (3 + 9 * z), 0, 1)) * wet[p], 0, 1) * 0.7 : 0;
    for (let c = 0; c < 3; c++) buf[o + c] = mix(buf[o + c] * (1 + 0.1 * rp * wet[p]), [255, 236, 190][c], g);
  }
  for (let r = P.spt * 9, x = floor(P.spx - r); P.spt < 2.5 && x <= P.spx + r; x++) A(x, round(WTOP + 2 + 0.2 * r * (1 - ((x - P.spx) / r) ** 2)), 240, 244, 240, 0.8 - P.spt * 0.3);
}

function reeds(P) {
  for (let i = 0; i < P.reedN; i++) {
    const [rx, ry, h, ph, plume] = P.reeds[i], lean = sin(P.t * 1.4 + ph) * 0.8 + (i & 1 ? 1 : -1);
    for (let j = 0; j < h; j++) {
      const x = round(rx + lean * (j / h) ** 2), k = 0.7 + (0.5 * j) / h;
      AL(x, ry - j, [84, 140, 50], k);
      if (j === round(h * 0.4) || j === round(h * 0.7)) for (let e = 1, sd = (j + i) & 1 ? 1 : -1; e < 4; e++) AL(x + sd * e, ry - j - (e >> 1), [96, 156, 56], k);
    }
    if (plume) for (let j = 0; j < 4; j++) AL(round(rx + lean) + (j & 1), ry - h - j, [160, 112, 74]);
  }
  for (let k = 0; k < 2; k++) {
    const [bx, by, h, lean] = PICK[k], [tx, ty] = bladeTip(P, k);
    for (let j = 0; j <= h; j++) {
      const f = j / h, x = round(mix(bx, tx, f * f)), y = round(mix(by, ty, f));
      AL(x, y, [96, 168, 56], 0.7 + 0.5 * f);
      if (j % 4 === 2) AL(x - sign(lean) * (1 + (j & 4 ? 1 : 0)), y + 1, [80, 150, 50], 0.8);
    }
  }
}

export function draw(display, params) {
  const P = params, { buf, t, pal: pl, mat, shad } = P, M = P.main;
  [BUF, TT] = [buf, P.tint];
  buf.set(P.bg);
  sky(P);
  reeds(P);
  // The colony; its males hang under their nests and flutter, sit on top, or are away.
  for (let i = 0; i < P.nn; i++) {
    const n = P.col[i], c = (t * 0.06 + n.ph * 0.3) % 1, [x, y] = nxy(n, 2 * n.face, n.S.by + 3);
    twig(n);
    drawNest(P, n, n.fresh ? 10 : n.S.length, 0, 0.85);
    if (n.fresh) drawBird(floor(t / 0.5) & 1 ? POKE : PERCH, pl, x + 5 * n.face, y - 3, -n.face);
    else if (i % 3 !== 2) c < 0.35 ? drawBird(flap(t), pl, n.lowx, n.low + 7, n.face, false, true) : c < 0.55 && drawBird(PERCH, pl, ...nxy(n, -3, -3 / n.s), -n.face);
  }
  twig(M);
  drawNest(P, M, M.nb, P.bs === WEAVE ? P.rev : 0, 1);
  if (P.fs) drawBird(P.fp || FA, FPAL, P.fx, P.fy, P.ff);
  if (P.show) drawBird(flap(t), pl, M.lowx, M.low + 7, 1, false, true);
  else {
    const tip = drawBird(P.pose, pl, P.bx, P.by, P.face, P.hang);
    if (P.strip > 0.5) strip(P, tip, round(P.strip), P.face, P.bs === OUT || P.bs === BACK);
    for (let i = 0; P.tear && i <= 8; i++) AL(round(mix(tip[0], P.tear[0], i / 8)), round(mix(tip[1], P.tear[1], i / 8)), P.fresh, 1.1);
  }
  // Out to the panel, under the shadows of the passing clouds.
  for (let p = 0, o = 0, so = floor(t * 3); p < N; p++, o += 3) {
    const s = mat[p] ? 1 - 0.4 * shad[((p & 63) + so - (p >> 7)) & 127] : 1;
    display.setPixel(p & 63, p >> 6, cl(buf[o] * s, 0, 255), cl(buf[o + 1] * s, 0, 255), cl(buf[o + 2] * s, 0, 255));
  }
}
