// ===== Patternflow pattern =====
// Title:   Kingfisher
// Family:  bird
// Idea:    A river bank cut from the alder overhead to the pebbles on the bed: a kingfisher watches from a branch, drops straight in with a splash and a trail of bubbles, comes up with a minnow, beats it on the branch and swallows it.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 20, after split-level river photographs of the common kingfisher (Alcedo atthis)
// Round:   20
// ===============================
// @matrix 64x128
// @knobs Hour=0..1, Speed=0.2..3, Fish=6..60, Current=-1..1
//
// Knob 1: Hour. Early morning at 0 with the sun low in the east; noon sends the light shafts straight down, the afternoon goes gold, dusk goes pink.
// Knob 2: Speed. How fast the river, the wind, the clouds and the bird go: at 2 it dives within two seconds, then every ten to fifteen.
// Knob 3: Fish. How rich the river runs: six minnows and eight strands of water-crowfoot at 6, a shoal of sixty in a thick weed bed under reeds and yellow flag at 60. More fish, and the bird goes sooner.
// Knob 4: Current. Near still at 0.06; turned either way the river runs that way, the weed streams out, the minnows face upstream and the alder stirs. Run hard, it goes the colour of tea.
// Buttons: K1 tap sends the kingfisher down now, or as soon as it is back on the branch.

const [W, H] = [64, 128];
const N = W * H;
// Waterline, top of the far bank, the bird's feet on the branch.
const [SURF, BANK, PX, PY] = [84, 47, 37, 33];
const { min, max, floor, round, sin, cos, abs, sqrt, pow, hypot, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
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

// The bird facing right: C cobalt, T turquoise back, O orange, W white, K bill, R feet.
// A pose: rows, anchor, bill tip, and how a fish in the bill lies.
const COL = { C: [24, 92, 214], T: [40, 214, 238], O: [252, 112, 24], o: [200, 78, 20], W: [238, 240, 228], K: [20, 18, 26], R: [236, 72, 58] };
const pose = (s, ax, ay, tx, ty, fo) => ({ rows: s.split(" "), ax, ay, tx, ty, fo });
const BODY = " .CCWW TCCOO TCCOO .CCOo .CC.R .C";
const LEVEL = pose("..CCC .CCCCKKKK .WOOOK" + BODY, 4, 7, 8, 1, "v");
const DOWN = pose("..CCC .CCCCK .WOOOKK .CCWW.KK" + BODY.slice(6), 4, 7, 7, 3, "v");
const UP = pose("......K .....K ..CCK .CCCC .WOOO" + BODY, 4, 9, 6, 0, "d");
const WIND = { ...UP, fo: "h" };
const SLAM = pose(". .CCC TCCCC TCWOOC .CCOOWK .CCOo.K .CC.R.K .C", 4, 6, 6, 6, "h");
const D45 = pose("CT .CTT .OCCT ..OCCC ...WOCK ......K .......K", 5, 4, 7, 6, "h");
const DV = pose(".C .CT OCT OCT OCT WOC .KC .K .K", 1, 5, 1, 8, "h");
const RV = pose(".K .K .KC WOC OCT OCT OCT .CT .C", 1, 3, 1, 0, "h");
const FA = pose("....CC .....CC CTTTTTCCC .COOOOWOCKKK", 5, 2, 11, 3, "v");
const FB = pose(". . CTTTTCCCC .COOCCWOCKKK ....CC .....C", 5, 2, 11, 3, "v");
// Morning to dusk: sky overhead, sky low, light, sun.
const HOURS = [[96, 150, 214, 214, 218, 196, 1, 0.97, 0.9, 0.85], [54, 122, 228, 158, 198, 236, 1, 1, 1, 1], [66, 118, 204, 226, 204, 150, 1.06, 0.97, 0.84, 0.92], [70, 82, 158, 248, 156, 92, 1.12, 0.84, 0.7, 0.7], [36, 38, 94, 212, 100, 104, 0.9, 0.72, 0.82, 0.45]];
const [PERCH, LEAN, DIVE, UNDER, RISE, FLY, BEAT, SWALLOW] = [0, 1, 2, 3, 4, 5, 6, 7];
const DUR = [0, 0.35, 0.62, 0.5, 0.74, 1.5, 2.1, 1.3];
const TUFT = [[1, 0, 0.95], [2, -1, 0.8], [2, 1, 0.5], [3, -1, 0.4], [1, -1, 0.7]];

function build(P) {
  const { alb, mat } = P, crown = [], bed = (P.bed = []), lv = [];
  const set = (x, y, m, r, g, b) => x >= 0 && x < W && y >= 0 && y < H && ((mat[y * W + x] = m), alb.set([r, g, b], (y * W + x) * 3));
  const clump = (x, y) => vn(x * 0.2, y * 0.22) * 0.65 + vn(x * 0.55, y * 0.5) * 0.35;
  for (let x = 0; x < W; x++) (crown[x] = 11 + 8 * vn(x * 0.1, 3.3) + 4 * vn(x * 0.33, 8.1)), (bed[x] = 115.5 + 2.5 * sin(x * 0.11 + 0.7) + 3 * vn(x * 0.25, 11.5));
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, g = hash(x + 900, y) - 0.5, c = y - crown[x], wet = cl((y - SURF + 7) / 6, 0, 1);
    const n = c >= 0 && y <= BANK && clump(x, y), k = n && (0.62 + 0.55 * n + 0.9 * (clump(x - 1.5, y - 1.5) - n)) * (1 - (0.42 * c) / (BANK - crown[x] + 1)) + 0.08 * g + (c < 1.5 ? 0.35 : 0);
    const e = (0.78 + 0.36 * (vn(2.5, y * 0.32) * 0.7 + vn(x * 0.06, y * 0.3) * 0.3) + 0.12 * g) * (1 - 0.38 * wet), q = 0.8 + 0.3 * vn(x * 0.7, y * 0.7) + 0.2 * g;
    if (c < 0) set(x, y, 0, 0, 0, 0);
    else if (y <= BANK) set(x, y, 2, 58 * k, 96 * k, 58 * k + 6);
    else if (y < SURF) set(x, y, 4, 138 * e, (100 + 14 * wet) * e, (64 + 6 * wet) * e);
    else set(x, y, y < bed[x] ? 5 : 6, 150 * q, 134 * q, 98 * q);
  }
  const ST = [[196, 172, 130], [150, 146, 136], [214, 182, 120], [128, 110, 90], [226, 198, 146]];
  for (let n = 0; n < 80; n++) {
    const cx = rnd() * 66 - 1, cy = bed[cl(round(cx), 0, W - 1)] + 1 + rnd() * 9, rx = 1.3 + rnd() * 2.4, ry = 0.9 + rnd() * 1.4, c = ST[floor(rnd() * 5)], t = 0.85 + rnd() * 0.3;
    for (let y = floor(cy - ry); y <= cy + ry; y++)
      for (let x = floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, r = dx * dx + dy * dy, k = t * (r > 0.6 ? 0.62 : 1) * (1 + 0.28 * cl(-dx - dy, -1, 1));
        if (r <= 1 && y < H && y >= bed[x]) set(x, y, 6, c[0] * k, c[1] * k, c[2] * k);
      }
  }
  // Grass, roots, and the kingfisher's burrow.
  for (let x = 0; x < W; x++) for (let y = BANK - floor(rnd() * 3.6), k; y <= BANK + 1; y++) (k = 0.75 + rnd() * 0.5), set(x, y, 3, 74 * k, 124 * k, 46 * k);
  for (let n = 0; n < 6; n++) for (let x = 8 + rnd() * 30, i = 0, len = 5 + rnd() * 12; i < len; i++) set(round((x += (rnd() - 0.5) * 1.2)), BANK + 2 + i, 4, 66, 50, 38);
  for (let y = 53; y < 64; y++)
    for (let x = 16; x < 29; x++) {
      const dx = (x - 22) / 3.1, dy = (y - 57.5) / 2.6, r = dx * dx + dy * dy, q = r * r;
      if (r < 1) set(x, y, 4, 12 + 40 * q, 9 + 28 * q, 7 + 18 * q);
      else if (r < 1.5 && dy > 0.4) set(x, y, 4, 172, 132, 92);
    }
  for (let y = 0; y <= BANK + 1; y++)
    for (let x = 0, w = 4 + max(0, y - 30) * 0.14, k; x < w; x++) (k = (0.72 + 0.4 * vn(x * 0.9, y * 0.13)) * (x < 1 ? 1.25 : x > w - 1.5 ? 0.7 : 1)), set(x, y, 1, 104 * k, 98 * k, 88 * k);
  for (let x = 3; x <= 55; x++) {
    const th = 3.2 - (2.4 * (x - 4)) / 51, n = max(1, round(th)), top = round(35.6 - 0.06 * (x - 4) + 0.0009 * (x - 4) ** 2 - th / 2);
    for (let i = 0, k; i < n; i++) (k = i ? (i === n - 1 ? 0.6 : 0.9) : 1.35), set(x, top + i, 1, 106 * k, 96 * k, 84 * k);
  }
  for (const tw of [[20, 34, 24, 29, 27, 26], [30, 35, 33, 38, 35, 41], [46, 35, 49, 38, 51, 42], [54, 35, 58, 34, 61, 37]])
    for (let s = 0; s < 4; s += 2) for (let i = 0; i <= 8; i++) set(round(mix(tw[s], tw[s + 2], i / 8)), round(mix(tw[s + 1], tw[s + 3], i / 8)), 1, 92, 82, 72);
  // Alder leaves, none in front of the bird.
  for (const [cx, cy, r, n, shade] of [[3, 2, 12, 110, 1], [15, 0, 11, 80, 1], [27, 1, 8, 50, 1], [36, -1, 6, 22, 1], [7, 14, 7, 40, 1], [24, 26, 4, 18], [13, 26, 3, 10], [35, 42, 3, 10], [50, 42, 4, 18], [60, 36, 3, 12], [49, 30, 3, 8]]) {
    for (let y = floor(cy - r); shade && y <= cy + r; y++)
      for (let x = floor(cx - r), d; x <= cx + r; x++) if ((d = hypot(x - cx, (y - cy) * 1.3) / r) < 0.85 && vn(x * 0.45, y * 0.45 + 40) > 0.3 + d * 0.3) set(x, y, 1, 34, 58, 30);
    for (let i = 0; i < n; i++) {
      const a = rnd() * PI * 2, rr = r * sqrt(rnd()), x = round(cx + cos(a) * rr), y = round(cy + sin(a) * rr * 0.75);
      if (x < 31 || x > 46 || y < 21 || y > 33) lv.push(x, y, floor(rnd() * 4), 0.75 + rnd() * 0.5, rnd() * 7, rnd() * 7, cy > 20 ? 1 : 0);
    }
  }
  P.leaves = lv;
  // More weed, reeds and starwort as the river gets richer.
  P.weed = [6, 17, 28, 40, 50, 59, 12, 23, 45, 34, 55, 2, 20, 42, 62, 31, 9, 48, 26, 14, 37, 53, 4, 57].map((x) => [x, 16 + rnd() * 26, rnd() * 7, 0.8 + rnd() * 0.4]);
  P.reeds = Array.from({ length: 32 }, (_, i) => [(i * 23.7 + rnd() * 6) % 64, 7 + rnd() * 10, rnd() * 7, i % 6 === 3]);
  P.tuft = bed.map((_, x) => [vn(x * 0.3, 50.5), 1 + floor(rnd() * 3)]);
  const tex = (h, f) => Float32Array.from({ length: 128 * h }, (_, i) => f(i & 127, i >> 7));
  P.cloud = tex(24, (x, y) => sm((vn(x / 14, y / 5, 128 / 14) * 0.65 + vn(x / 6, y / 3 + 9, 128 / 6) * 0.35 - 0.48) * 3.2) * (1 - y / 30));
  P.shad = tex(1, (i) => sm(1 - abs(i - 34) / 30) + 0.7 * sm(1 - abs(i - 96) / 18));
  const S = (P.shaft = new Float32Array(256));
  for (let n = 0; n < 9; n++) {
    const c = rnd() * 256, w = 6 + rnd() * 18, a = 0.4 + rnd() * 0.6;
    for (let i = 0; i < 256; i++) S[i] = min(1, S[i] + a * Math.exp(-((abs(((i - c + 384) % 256) - 128) / w) ** 2)));
  }
}

// Light for the hour. A river in spate is the colour of tea.
function paint(P, h) {
  const f = h * 4, i = min(3, floor(f)), B = HOURS[i + 1], q = HOURS[i].map((v, c) => mix(v, B[c], f - i)), { alb, mat, bg } = P;
  const sun = (P.sun = q[9]), top = q.slice(0, 3), low = (P.low = q.slice(3, 6)), tint = (P.tint = q.slice(6, 9).map((v) => v * sun)), s = (P.silt = 0.6 * P.cur * P.cur);
  P.sunDir = -0.9 + 1.8 * h;
  const M = (a, b) => a.map((v, c) => mix(v, b[c], s)), WT = M([88, 128, 94], [112, 98, 52]), WD = M([30, 58, 44], [50, 40, 24]), fl = M([0.74, 0.88, 0.72], [0.62, 0.6, 0.4]);
  for (let p = 0; p < N; p++) {
    const y = p >> 6, m = mat[p], ts = pow(cl(y / 24, 0, 1), 1.3), d = cl((y - SURF - 1) / (H - SURF - 2), 0, 1);
    for (let c = 0, o = p * 3, a; c < 3; c++)
      (a = alb[o + c] * tint[c]),
        (bg[o + c] =
          m === 0 ? mix(top[c], low[c], ts)
          : m === 2 ? mix(a, low[c] * 0.5, 0.16)
          : m === 5 ? mix(WT[c], WD[c], pow(d, 0.8)) * tint[c] + low[c] * 0.08 * (1 - d)
          : m === 6 ? mix(a * fl[c] * (0.95 - 0.25 * d), WD[c] * tint[c], s * 0.8)
          : a);
  }
}

function stepFish(P, d) {
  const t = P.t, cx = 32 + 15 * sin(t * 0.13 + 0.4) + 6 * sin(t * 0.31), cy = 103 + 5 * sin(t * 0.21 + 1.3);
  for (const F of P.fish) {
    // The one it has picked drifts into the line of the dive.
    const held = P.bs && P.bs <= UNDER && F === P.prey && P.hit;
    if (held) F.vx += (P.tx - F.x) * 2 * d;
    if (F.s > 0) F.s -= d;
    else if (!held) {
      F.vx += ((cx + F.ox + 4 * sin(t * 0.7 + F.ph) - F.x) * 0.9 - F.vx * 1.1) * d + (rnd() - 0.5) * 30 * d;
      F.vy += ((cy + F.oy + 2 * sin(t * 0.9 + F.ph * 1.3) - F.y) * 0.9 - F.vy * 1.4) * d + (rnd() - 0.5) * 16 * d;
      if (rnd() < d * 0.45) F.g = 0.25;
    }
    const lim = F.s > 0 ? 36 : held ? 8 : 14, sp = hypot(F.vx, F.vy);
    if (sp > lim) (F.vx *= lim / sp), (F.vy *= lim / sp);
    F.x += F.vx * d;
    F.y = cl(F.y + F.vy * d, SURF + 5, P.bed[cl(round(F.x), 0, W - 1)] - 3);
    const f = abs(P.cur) > 0.12 && F.s <= 0 ? (P.cur > 0 ? -1 : 1) : abs(F.vx) > 2 ? Math.sign(F.vx) : F.f;
    if (f !== F.f) (F.f = f), (F.g = 0.3);
    F.g -= d;
  }
}

// Drops, rings, foam; the dive scatters all but its minnow.
function splash(P, x, n, up) {
  for (let i = 0; i < n; i++) P.dr.push([x + (rnd() - 0.5) * 4, SURF - 1, (rnd() - 0.5) * (i % 7 ? 46 : 4), -(18 + rnd() * up) * (i % 7 ? 1 : 1.5)]);
  P.ri.push([x, 0, 1], [x, 0, 0.6, 1]);
  for (const F of n < 30 ? [] : P.fish) {
    const dx = F.x - x, dy = F.y - SURF, r = hypot(dx, dy) + 1;
    if (r > 27 || (F === P.prey && P.hit)) continue;
    [F.s, F.g] = [0.7 + rnd() * 0.6, 0.3];
    F.vx += (dx / r) * 34;
    F.vy += (dy / r) * 20 + 6;
  }
}

function stepBird(P, d) {
  let k, u = (P.bt += d) / (DUR[P.bs] || 1);
  const go = (s) => ((P.bs = s), (P.bt = 0));
  const bub = (p, x, y) => rnd() < p && P.bu.push([P.bx + (rnd() - 0.5) * x, P.by + y, 14 + rnd() * 14, rnd() * 7]);
  switch (P.bs) {
    case PERCH:
      if ((P.look -= d) <= 0) {
        P.pose = rnd() < 0.55 ? LEVEL : DOWN;
        P.look = 0.4 + rnd() * 1.2;
      }
      if (P.bt >= P.wait * (1 - 0.45 * P.rich) || P.go) {
        // A minnow below the branch. One dive in four misses, never the first.
        let best = null, sc = 1e9;
        for (const F of P.fish) {
          const s = abs(F.x - PX - 10) + 0.5 * abs(F.y - 100);
          if (F.x >= PX - 6 && F.x <= 60 && s < sc) [sc, best] = [s, F];
        }
        Object.assign(P, { go: false, prey: best, tx: best ? cl(best.x + best.vx * 0.6, PX - 2, 53) : PX + 10, hit: !!best && (!P.dives++ || rnd() < 0.75) });
        go(LEAN);
      }
      break;
    case LEAN:
      [P.pose, P.bx, P.by, P.face] = [D45, PX + 2, PY - 4 + u, 1];
      if (u >= 1) go(DIVE);
      break;
    case DIVE:
      P.face = P.tx >= PX ? 1 : -1;
      P.bx = mix(PX + 2, P.tx, pow(u, 0.8));
      P.by = mix(PY - 3, SURF - 2, pow(u, 1.8));
      P.pose = u < 0.22 ? D45 : DV;
      if (u >= 1) {
        splash(P, (P.x0 = P.bx), 30, 50);
        for (let i = 0; i < 14; i++) bub(1, 5, 3 + rnd() * 5);
        go(UNDER);
      }
      break;
    case UNDER: {
      const q = P.hit && P.fish.includes(P.prey) ? P.prey : null, e = 1 - (1 - u) * (1 - u);
      P.bx = mix(P.x0, q ? q.x : P.x0, e);
      P.by = mix(SURF - 2, q ? q.y - 2 : 99, e);
      P.pose = DV;
      bub(0.8, 3, -3);
      if (u >= 1) {
        if (q) P.fish.splice(P.fish.indexOf(q), 1);
        [P.fl, P.prey, P.y0] = [q ? 4 : 0, null, P.by];
        go(RISE);
      }
      break;
    }
    case RISE: {
      const w = cl((u - 0.43) / 0.57, 0, 1);
      P.pose = u < 0.22 ? DV : RV;
      if (!w) P.bx += sin(P.bt * 60) * 9 * d;
      P.by = mix(P.y0, SURF - 2, w * w);
      bub(w ? 0.7 : 0.5, 3, w ? 4 : -2);
      if (u >= 1) splash(P, (P.x0 = P.bx), 16, 32), go(FLY);
      break;
    }
    case FLY:
      P.face = PX >= P.x0 ? 1 : -1;
      P.bx = mix(P.x0, PX, sm(u));
      P.by = mix(SURF - 4, PY - 3, 1 - (1 - u) * (1 - u)) - 7 * sin(PI * u);
      P.pose = floor(P.bt / 0.07) & 1 ? FB : FA;
      if (u < 0.25 && rnd() < 0.5) P.dr.push([P.bx + (rnd() - 0.5) * 6, P.by + 2, (rnd() - 0.5) * 10, rnd() * 10]);
      if (u >= 1 && !P.fl) for (let i = 0; i < 10; i++) P.dr.push([PX + (rnd() - 0.5) * 6, PY - 4 - rnd() * 4, (rnd() - 0.5) * 30, -rnd() * 20]);
      if (u >= 1) (k = P.fl), perch(P), k && ((P.fl = k), go(BEAT));
      break;
    case BEAT: {
      // Four whacks on the branch.
      k = floor(P.bt / 0.42);
      const slam = P.bt % 0.42 > 0.24 && k < 4;
      P.pose = k > 3 ? LEVEL : slam ? SLAM : WIND;
      if (slam && !P.slam) (P.shake = 1), P.dr.push([PX + 7, PY - 1, 8 + rnd() * 10, -10 - rnd() * 14]);
      P.slam = slam;
      if (u >= 1) go(SWALLOW);
      break;
    }
    case SWALLOW:
      P.pose = u < 0.85 ? UP : LEVEL;
      P.fl = u < 0.3 ? 3 : u < 0.55 ? 2 : u < 0.8 ? 1 : 0;
      if (u >= 1) perch(P);
  }
}

function perch(P) {
  Object.assign(P, { bs: PERCH, bt: 0, bx: PX, by: PY, face: 1, pose: LEVEL, look: 0.4, fl: 0, wait: P.queued ? 0.3 : 3.5 + rnd() * 4, queued: false });
}

export function setup(params) {
  const P = params, F = (n) => new Float32Array(n);
  Object.assign(P, { alb: F(N * 3), mat: new Uint8Array(N), bg: F(N * 3), buf: F(N * 3), h: -1, t: 0, dives: 0, fish: [], dr: [], bu: [], ri: [], shake: 0 });
  build(P);
  perch(P);
  P.wait = 1.3;
}

export function update(dt, input, params) {
  const P = params, k = input.knobValues || [0, 2, 6, 0.06], h = cl(k[0], 0, 1), cur = cl(k[3], -1, 1);
  const rich = (P.rich = cl((k[2] - 6) / 54, 0, 1)), want = round(cl(k[2], 6, 60)), d = cl(dt, 0, 0.1) * (P.rate = cl(k[1], 0.2, 3) / 2);
  if (abs(h - P.h) > 0.0005 || abs(cur - P.cur) > 0.01) (P.h = h), (P.cur = cur), paint(P, h);
  [P.nweed, P.wlen, P.every] = [8 + round(rich * 16), 0.62 + 0.55 * rich, rich > 0.5 ? 2 : 3];
  for (let e = P.t > 0; P.fish.length < want; )
    P.fish.push({ x: e ? (cur >= 0 ? -3 : 66) : 6 + rnd() * 52, y: e ? 100 + rnd() * 8 : 94 + rnd() * 18, vx: 0, vy: 0, ox: (rnd() - 0.5) * 30, oy: (rnd() - 0.5) * 12, ph: rnd() * 7, f: rnd() < 0.5 ? 1 : -1, s: 0, g: 0 });
  P.fish.length = want;
  // The river's clock starts further in the faster it runs.
  if (!P.t) P.t = 6 * P.rate;
  if (input.btnPressed?.[0]) P[P.bs === PERCH ? "go" : "queued"] = true;
  P.t += d;
  stepFish(P, d);
  stepBird(P, d);
  P.dr = P.dr.filter((p) => ((p[3] += 150 * d), (p[0] += p[2] * d), (p[1] += p[3] * d), !(p[1] > SURF && p[3] > 0)));
  P.bu = P.bu.filter((b) => ((b[1] -= b[2] * d), (b[0] += (sin(b[3] + b[1] * 0.6) * 3 + cur * 8) * d), b[1] > SURF + 1));
  P.ri = P.ri.filter((r) => ((r[1] += 13 * d), (r[0] += cur * 10 * d), (r[2] -= (r[3] ? 1 : 0.42) * d) > 0));
  P.shake = max(0, P.shake - d * 3);
}

let BUF;
function Ao(o, r, g, b, a = 1) {
  BUF[o] += (r - BUF[o]) * a;
  BUF[o + 1] += (g - BUF[o + 1]) * a;
  BUF[o + 2] += (b - BUF[o + 2]) * a;
}
const A = (x, y, r, g, b, a) => x >= 0 && x < W && y >= 0 && y < H && Ao((y * W + x) * 3, r, g, b, a);

function drawBird(P) {
  const S = P.pose, face = P.face, ox = round(P.bx), oy = round(P.by), L = 0.45 + 0.6 * P.sun, fk = 0.5 + 0.5 * P.sun;
  const fl = P.bs && P.bs <= FLY ? 1.2 : 0.8 + 0.3 * max(0, sin(P.t * 2.3));
  S.rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const col = COL[row[c]], x = ox + (c - S.ax) * face, y = oy + r - S.ay, k = L * (row[c] === "T" ? fl : 1), w = y > SURF;
      if (col) A(x, y, col[0] * k * (w ? 0.66 : 1), col[1] * k * (w ? 0.88 : 1), col[2] * k * (w ? 0.8 : 1));
    }
  });
  const [sx, sy, dx, dy] = { v: [-1, -1, 0, 1], h: [-1, 1, 1, 0], d: [1, -1, 1, -1] }[S.fo], tx = ox + (S.tx - S.ax) * face, ty = oy + S.ty - S.ay;
  for (let i = 0; i < P.fl; i++) {
    const x = tx + (sx + i * dx) * face, y = ty + sy + i * dy, k = fk * (y > SURF ? 0.8 : 1), b = i === (dy > 0 ? 3 : dy ? P.fl - 1 : 0);
    A(x, y, (b ? 90 : 210) * k, (b ? 110 : 216) * k, (b ? 84 : 204) * k);
    // Swallowed head first: the tail end sticks out.
    if (dy < 0) A(x - face, y, 90 * k, 110 * k, 84 * k);
  }
}

function leaves({ leaves: L, t, tint, sun, shake }, wind) {
  for (let i = 0; i < L.length; i += 7) {
    const x = L[i] + round(sin(t * (1.1 + wind) + L[i + 5]) * wind * (L[i + 6] ? 1 + shake * 2 : 0.7)), y = L[i + 1], q = max(0, sin(t * (2 + 3 * wind) + L[i + 4])) ** 6;
    const k = L[i + 3] * (0.9 + 0.7 * q), r = 60 * k * tint[0], g = 112 * k * tint[1], b = 50 * k * tint[2] + 30 * q * sun;
    A(x, y, r, g, b);
    if (L[i + 2] & 1) A(x + 1, y, r * 0.85, g * 0.85, b * 0.85);
    if (L[i + 2] > 1) A(x, y + 1, r * 0.8, g * 0.8, b * 0.8);
  }
}

// Light shafts, and caustics on the bed.
function shafts({ buf, mat, tint, sun, cur, t, sunDir, silt, shaft: S }) {
  const sl = sunDir * 2.2, so = t * (1.2 + 5 * cur) * 4, shine = sun * (1.15 - abs(sunDir) * 0.45) * (1 - silt) * 46, [tr, tg, tb] = [tint[0] * 0.85, tint[1], tint[2] * 0.7];
  for (let y = SURF + 1; y < H; y++) {
    const dy = y - SURF, fade = pow(1 - dy / (H - SURF + 6), 1.4) * shine, b0 = so + dy * sl, b1 = 97 - t * 10.4 + dy * sl * 0.5, ph = t * 1.7 + 2 * sin(y * 0.45 - t * 0.9);
    for (let x = 0, p = y * W, o = p * 3; x < W; x++, p++, o += 3) {
      let a = S[(b0 + x * 4) & 255] * (0.55 + 0.45 * S[(b1 + x * 2) & 255]) * fade;
      const c = mat[p] === 6 ? sin(x * 0.8 + ph) + sin(x * 0.37 - y * 0.5 - t * 1.2) : 0;
      if (c > 1.1) a += (c - 1.1) * 40 * sun;
      if (a > 0.5) (buf[o] += a * tr), (buf[o + 1] += a * tg), (buf[o + 2] += a * tb);
    }
  }
}

export function draw(display, params) {
  const P = params, { buf, mat, tint, low, sun, cur, t, rich, bed } = P, wind = 0.35 + 0.65 * abs(cur), wl = 0.55 + 0.45 * sun;
  const At = (x, y, r, g, b) => A(x, y, r * tint[0], g * tint[1], b * tint[2]);
  BUF = buf;
  buf.set(P.bg);
  const off = t * (0.8 + 3.2 * wind), CT = P.cloud, wo = floor(t * wind * 5);
  const cc = low.map((v) => mix(v, 250, 0.6) * (0.55 + 0.45 * sun));
  for (let p = 0, m, r, x0, f; p < (BANK + 1) * W; p++)
    if (!(m = mat[p])) (x0 = floor((f = (p & 63) - off))), (f -= x0), (r = (p >> 6) * 128), Ao(p * 3, cc[0], cc[1], cc[2], (CT[r + (x0 & 127)] * (1 - f) + CT[r + ((x0 + 1) & 127)] * f) * 0.85);
    else if (m === 2) for (let c = 0, s = 0.92 + 0.22 * CT[((p >> 6) % 24) * 128 + (((p & 63) + wo) & 127)]; c < 3; c++) buf[p * 3 + c] *= s;
  for (let i = 0, n = 3 + round(rich * 29); i < n; i++) {
    const [rx, r0, ph, iris] = P.reeds[i], rh = r0 * (0.6 + 0.9 * rich), lean = sin(t * (1.2 + wind) + ph) * wind * 1.4 + wind * 0.8;
    for (let j = 0, f, x, k; j < rh; j++) {
      (f = j / rh), (x = round(rx + lean * f * f)), (k = 0.75 + 0.5 * f);
      At(x, SURF - 1 - j, 92 * k, 146 * k, 52 * k);
    }
    const x = round(rx + lean * 0.5), y = round(SURF - rh * 0.75);
    if (iris) At(x, y, 250, 214, 40), At(x - 1, y + 1, 230, 180, 30);
  }
  shafts(P);
  for (let x = 0, ro = t * (0.8 + 7 * cur); x < W; x++) {
    const r = sin(x * 0.9 + ro + 2 * sin(x * 0.23 - t * 1.1)), gl = r > 0.6 ? (r - 0.6) * 1.5 : 0, o = (SURF * W + x) * 3;
    for (let c = 0; c < 3; c++) buf[o + c] = mix(low[c] * 0.85, 255, gl) * (0.5 + 0.5 * sun);
  }
  // Rings and foam.
  for (const [cx, r, a, foam] of P.ri)
    if (foam) for (let x = round(cx) - 3; x <= round(cx) + 3; x++) for (let y = SURF - 1; y <= SURF + 2; y++) A(x, y, 240, 245, 245, a * 1.4 * (1 - abs(x - cx) / 4));
    else
      for (let x = floor(cx - r), ry = max(0.6, r * 0.11), k = a * (0.6 + 0.4 * sun), e; r > 0 && x <= cx + r; x++) {
        e = ry * sqrt(max(0, 1 - ((x + 0.5 - cx) / r) ** 2));
        A(x, round(SURF - e), 235, 240, 240, k * 0.8);
        A(x, round(SURF + e) + 1, 210, 230, 225, k * 0.5);
      }
  P.tuft.forEach(([n, h], x) => {
    const hh = h + round(rich * 4), sw = round(sin(t * 1.6 + x * 0.5) * 0.6 + cur);
    for (let j = -2, k; n < 0.22 + 0.66 * rich && j < hh; j++) (k = (j < 0 ? 0.6 : 0.75 + (0.35 * j) / hh) * wl), A(x + (j > 1) * sw, round(bed[x]) - j, 36 * k, 96 * k, 30 * k);
  });
  // Water-crowfoot; a stem that reaches the top trails and flowers.
  for (let n = 0; n < P.nweed; n++) {
    const [wx, len0, ph, tone] = P.weed[n], len = len0 * P.wlen, lean = (((n * 5) % 7) - 3) * 0.06, dir = cur > 0.05 ? 1 : cur < -0.05 || lean < 0 ? -1 : 1;
    let x = wx + 0.5, y = bed[wx] + 1, top = false;
    for (let s = 0; s < len; s++) {
      const f = s / len, ang = lean + cur * 1.3 * pow(f, 0.6) + sin(t * 1.3 + ph + s * 0.16) * (0.14 + 0.24 * f) * (0.5 + abs(cur));
      if (y > SURF + 2.5) (x += sin(ang)), (y -= cos(ang));
      else (top = true), (x += dir * (0.8 + 0.2 * sin(t * 2 + s)));
      const k = tone * (0.8 + 0.25 * sin(s * 1.3 + ph)) * wl, xi = round(x - 0.5), yi = round(y), sd = (s + n) % 2 ? 1 : -1;
      A(xi, yi, 14 * k, 54 * k, 12 * k);
      if (s % P.every !== 1 || s < 2) A(xi + 1, yi, 84 * k, 170 * k, 62 * k, 0.8);
      else if (top) {
        A(xi, yi + 1, 104 * k, 196 * k, 74 * k, 0.9);
        A(xi + dir, yi + 2, 84 * k, 164 * k, 60 * k, 0.6);
        if (s % 4 === 1) A(xi, SURF, 244, 244, 232, 0.95), A(xi + 1, SURF, 236, 210, 80, 0.9);
      } else for (const [ex, ey, a] of TUFT) A(xi + ex * sd, yi + ey, 104 * k, 196 * k, 76 * k, a);
    }
  }
  const fk = (0.4 + 0.6 * sun) * (1 - 0.4 * P.silt);
  for (const F of P.fish) {
    const x = round(F.x), y = round(F.y), f = F.f, g = F.g > 0;
    for (let j = 0, s; j < 4; j++) {
      s = (j === 2 ? 0.62 : 1) * (g ? 1.3 : 1) * fk;
      A(x - f * j, y, (g ? 150 : 46) * fk, (g ? 162 : 64) * fk, (g ? 146 : 44) * fk);
      A(x - f * j, y + 1, min(255, 196 * s), min(255, 204 * s), min(255, 186 * s));
    }
    A(x - f * 4, y + (floor(t * 7 + F.ph) & 1), 60 * fk, 78 * fk, 56 * fk);
  }
  for (const [x, y] of P.bu) A(round(x), round(y), 200, 232, 228, 0.7);
  leaves(P, wind);
  drawBird(P);
  for (const [x, y] of P.dr) A(round(x), round(y), 225, 240, 245, 0.9);
  show(display, P, 0.34 * cl((sun - 0.4) / 0.5, 0, 1), 1024 - (floor(off * 1.3) & 127));
}

// To the panel, under a passing cloud's shadow.
function show(display, { buf, mat, shad: sh }, amp, so3) {
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0, xs = so3 - round(y * 0.45); x < W; x++, p++) {
      const o = p * 3, s = mat[p] ? 1 - amp * sh[(x + xs) & 127] : 1, r = buf[o] * s, g = buf[o + 1] * s, b = buf[o + 2] * s;
      display.setPixel(x, y, r > 255 ? 255 : r < 0 ? 0 : r, g > 255 ? 255 : g < 0 ? 0 : g, b > 255 ? 255 : b < 0 ? 0 : b);
    }
}
