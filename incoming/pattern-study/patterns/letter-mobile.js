// ===== Patternflow pattern =====
// Title:   Letter Mobile
// Family:  type
// Idea:    A hanging mobile in the manner of Calder whose weights are the four letters of a word, each weighing its ink, hangs the full height of the panel with every bar balanced by moments and turning slowly on its thread before a lit wall that takes its shadow, and when one letter of the word changes, as in a word ladder, the bars above it tilt and their hanging points slide to the new balance.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Alexander Calder's mobiles (1931-32, named by Marcel Duchamp), the law of the lever (Archimedes, On the Equilibrium of Planes), word ladders (Lewis Carroll's Doublets, 1879), pattern round 75
// Round:   75
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..2, Sway=0..1
//
// Knob 1: Hue. Turns the painted plates round the wheel together: at 0 they are Calder's yellow, blue, red and white, top to bottom. The wires stay steel and the wall a warm grey.
// Knob 2: Speed. One clock for the turning, the swing and the word: at 2 one letter changes every 3.6 s, the bars twist on their threads once in 9 to 14 s and the mobile swings once in 3.3 s. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Word. Which word ladder the mobile climbs, one letter at a time and back: 0 is Carroll's own first, HEAD HEAL TEAL TELL TALL TAIL, from 493 LEDs of ink to 330; 1 is FILL FILM FIRM FORM WORM WARM, light letters turning heavy; 2 is WOMB TOMB TOME TIME TILE TILL, heavy turning light.
// Knob 4: Sway. How far the whole mobile swings from its hook: at 0.06 the bottom letters move 3 LEDs either way, at 1 they move 25.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, round, min, max, sqrt, sin, cos, abs, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Letters. Skeletons in a box one cap height tall (y down), width w,
// drawn with a round pen 4 LEDs wide into plates 22 LEDs tall. Straight
// strokes snap to LED edges so stems come out exactly 4 wide; curves don't.
// A letter weighs its ink, the LEDs its plate lights facing you:
// I 84, L 119, T 126, F 145, A 172, E 180, H 196, O 198, D 204, R 206,
// B 225, W 240, M 242.
function arc(cx, cy, rx, ry, a0, a1, n) {
  const s = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    s.push([cx + rx * cos(t0), cy + ry * sin(t0), cx + rx * cos(t1), cy + ry * sin(t1), 1]);
  }
  return s;
}
const HP = PI / 2;
const SK = {
  A: [0.72, [[0, 1, 0.36, 0], [0.36, 0, 0.72, 1], [0.13, 0.64, 0.59, 0.64]]],
  B: [0.56, [[0, 0, 0, 1], [0, 0, 0.3, 0], ...arc(0.3, 0.235, 0.22, 0.235, -HP, HP, 6), [0.3, 0.47, 0, 0.47], [0, 0.47, 0.32, 0.47], ...arc(0.32, 0.735, 0.24, 0.265, -HP, HP, 6), [0.32, 1, 0, 1]]],
  D: [0.62, [[0, 0, 0, 1], [0, 0, 0.22, 0], ...arc(0.22, 0.5, 0.4, 0.5, -HP, HP, 10), [0.22, 1, 0, 1]]],
  E: [0.52, [[0, 0, 0, 1], [0, 0, 0.52, 0], [0, 0.5, 0.44, 0.5], [0, 1, 0.52, 1]]],
  F: [0.52, [[0, 0, 0, 1], [0, 0, 0.52, 0], [0, 0.5, 0.44, 0.5]]],
  H: [0.62, [[0, 0, 0, 1], [0.62, 0, 0.62, 1], [0, 0.5, 0.62, 0.5]]],
  I: [0, [[0, 0, 0, 1]]],
  L: [0.5, [[0, 0, 0, 1], [0, 1, 0.5, 1]]],
  M: [0.82, [[0, 1, 0, 0], [0, 0, 0.41, 0.66], [0.41, 0.66, 0.82, 0], [0.82, 0, 0.82, 1]]],
  O: [0.72, arc(0.36, 0.5, 0.36, 0.5, 0, 2 * PI, 16)],
  R: [0.58, [[0, 0, 0, 1], [0, 0, 0.3, 0], ...arc(0.3, 0.25, 0.24, 0.25, -HP, HP, 6), [0.3, 0.5, 0, 0.5], [0.26, 0.5, 0.58, 1]]],
  T: [0.66, [[0, 0, 0.66, 0], [0.33, 0, 0.33, 1]]],
  W: [0.94, [[0, 0, 0.21, 1], [0.21, 1, 0.47, 0.32], [0.47, 0.32, 0.73, 1], [0.73, 1, 0.94, 0]]],
};
const GH = 22, PEN = 2, SC = GH - 2 * PEN;

function glyph(ch) {
  const [w, segs] = SK[ch], bw = ceil(w * SC + 2 * PEN) + 1, bits = new Uint8Array(bw * GH);
  let x0 = bw, x1 = -1;
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < bw; i++) {
      const px = i + 0.5, py = j + 0.5;
      let on = 0;
      for (const [sx, sy, ex, ey, curved] of segs) {
        const sn = (v) => (curved ? PEN + v * SC : floor(PEN + v * SC));
        const ax = sn(sx), ay = sn(sy), dx = sn(ex) - ax, dy = sn(ey) - ay, l2 = dx * dx + dy * dy;
        const t = l2 ? cl(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
        const qx = ax + t * dx - px, qy = ay + t * dy - py;
        if (qx * qx + qy * qy <= (PEN + 0.01) * (PEN + 0.01)) {
          on = 1;
          break;
        }
      }
      if (on) (bits[j * bw + i] = 1), (x0 = min(x0, i)), (x1 = max(x1, i));
    }
  // Trimmed to the ink, with a running sum per row for area sampling.
  const gw = x1 - x0 + 1, g = new Uint8Array(gw * GH), cum = new Float32Array((gw + 1) * GH);
  let ink = 0;
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < gw; i++) {
      const b = bits[j * bw + i + x0];
      g[j * gw + i] = b;
      ink += b;
      cum[j * (gw + 1) + i + 1] = cum[j * (gw + 1) + i] + b;
    }
  return { ch, gw, g, cum, ink };
}
const GLYPHS = {};
const glyphOf = (ch) => GLYPHS[ch] || (GLYPHS[ch] = glyph(ch));

// ---- Word ladders: one letter changes at a time, each step a word.
const LADDERS = [
  ["HEAD", "HEAL", "TEAL", "TELL", "TALL", "TAIL"],
  ["FILL", "FILM", "FIRM", "FORM", "WORM", "WARM"],
  ["WOMB", "TOMB", "TOME", "TIME", "TILE", "TILL"],
];

// ---- The mobile. Three bars in a chain, as Calder hung most of his: bar 0
// carries letter 0 on its left end and everything below on its right, bar 1
// carries that rest on its left and letter 1 on its right, bar 2 carries
// letters 2 and 3. Facing you the chain zigzags so the word reads down the
// panel. Each bar hangs from a loop D LEDs above it.
// Bar k: length and the thread below each end. The top hook hangs from
// HOOK.
const BAR = [
  { len: 28, drop: [3, 30] },
  { len: 26, drop: [30, 3] },
  { len: 32, drop: [11, 11] },
];
const HOOK = [30, 4], D = 7;

// Weights on each end of bar k, given the four letters' ink. A sub-mobile
// weighs the sum of what hangs below it; wire and thread weigh nothing.
function loads(ink) {
  const w2 = ink[2] + ink[3], w1 = ink[1] + w2;
  return [[ink[0], w1], [w1, ink[1]], [ink[2], ink[3]]];
}

// The law of the lever: the hook divides the bar so that left weight times
// left arm equals right weight times right arm, so it sits at the fraction
// WR / (WL + WR) of the bar from the left end.
const balance = ([wl, wr]) => wr / (wl + wr);

// Turning: each bar twists to and fro on its thread (amplitude, period at
// Speed 2, phase).
const TWIST = [[1.0, 17, -0.4], [1.25, 13, PI - 0.5], [1.75, 21, -0.35]];

// Lamp up and to the left in front of the mobile, the wall 26 LEDs behind
// the threads.
const LX = -80, LY = -120, LZ = 300, WZ = -26;
const STEP = 3.6, FLIP = 0.7, SLIDE_AT = 0.35, SLIDE = 1.1;

function startWord(S, ladder) {
  S.ladder = ladder;
  S.step = 0;
  S.dir = 1;
  const word = LADDERS[ladder][0];
  S.letters = [0, 1, 2, 3].map((i) => ({ g: glyphOf(word[i]), next: null, flip: -1 }));
  const L = loads(S.letters.map((l) => l.g.ink));
  S.bars = BAR.map((b, k) => ({ f: balance(L[k]), f0: 0, f1: 0, slide: -1, a: 0, av: 0 }));
  S.clock = STEP - 2.1;
}

export function setup(params) {
  params.s = { t: 0, hue: 0, sway: 0.06, ladder: -1, fb: new Float32Array(NP * 3), sh: new Float32Array(NP), tmp: new Float32Array(NP), wall: null };
}

function ink(S) {
  return S.letters.map((l) => l.g.ink);
}

function nextWord(S) {
  const lad = LADDERS[S.ladder];
  if (S.step + S.dir < 0 || S.step + S.dir >= lad.length) S.dir = -S.dir;
  const from = lad[S.step], to = lad[S.step + S.dir];
  S.step += S.dir;
  for (let i = 0; i < 4; i++)
    if (from[i] !== to[i]) {
      S.letters[i].next = glyphOf(to[i]);
      S.letters[i].flip = 0;
    }
}

// The bar's tilt a about its hook. With the hook D above the bar, the weights
// hanging from the ends at arms aL, aR turn it by
//   (WR aR - WL aL) cos a - (WL + WR) D sin a,
// so a bar out of balance by a moment M settles at tan a = M / (W D), and a
// balanced bar hangs level.
function torque(b, len, [wl, wr]) {
  const al = b.f * len, ar = (1 - b.f) * len;
  return { tq: (wr * ar - wl * al) * cos(b.a) - (wl + wr) * D * sin(b.a), I: wl * (al * al + D * D) + wr * (ar * ar + D * D) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.sway = cl(k[3], 0, 1);
  const ladder = cl(round(k[2]), 0, 2);
  if (ladder !== S.ladder) startWord(S, ladder);
  const step = (d * cl(k[1], 0.2, 3)) / 2;
  S.t += step;
  S.clock += step;
  if (S.clock >= STEP) {
    S.clock -= STEP;
    nextWord(S);
  }
  // A letter that changes spins once round on its thread and comes back as
  // the new letter; its weight changes when it is edge-on, a quarter in.
  let changed = false;
  for (const l of S.letters) {
    if (l.flip < 0) continue;
    const was = l.flip;
    l.flip += step / FLIP;
    if (was < 0.25 && l.flip >= 0.25 && l.next) {
      l.g = l.next;
      l.next = null;
      changed = true;
    }
    if (l.flip >= 1) l.flip = -1;
  }
  const L = loads(ink(S));
  if (changed) for (const b of S.bars) b.slide = 0;
  // The hooks slide to the new balance once the bars have tipped.
  S.bars.forEach((b, i) => {
    if (b.slide < 0) return;
    if (b.slide < SLIDE_AT && b.slide + step >= SLIDE_AT) b.f0 = b.f;
    b.slide += step;
    if (b.slide >= SLIDE_AT) {
      const u = ss((b.slide - SLIDE_AT) / SLIDE);
      b.f = b.f0 + (balance(L[i]) - b.f0) * u;
      if (u >= 1) b.slide = -1;
    }
  });
  // Tilts, in four substeps. G sets the swing: a level bar knocked off
  // rocks back about once in 1.4 s.
  const G = 1300, DAMP = 1.5, n = 4, h = step / n;
  for (let s = 0; s < n; s++)
    S.bars.forEach((b, i) => {
      const { tq, I } = torque(b, BAR[i].len, L[i]);
      b.av += (G * tq / I - DAMP * b.av) * h;
      b.a += b.av * h;
      if (abs(b.a) > 0.75) (b.a = 0.75 * Math.sign(b.a)), (b.av = 0);
    });
}

// ---- Geometry: points in LEDs, x right, y down, z towards you.
function layout(S) {
  const t = S.t, phi = (0.012 + 0.2 * S.sway) * sin((2 * PI * t) / 3.3);
  // The whole mobile swings about its hook at the top edge.
  const sw = (p) => [HOOK[0] + (p[0] - HOOK[0]) * cos(phi) - p[1] * sin(phi), (p[0] - HOOK[0]) * sin(phi) + p[1] * cos(phi), p[2]];
  const lines = [], plates = [];
  let piv = [HOOK[0], HOOK[1], 0];
  lines.push({ p: [HOOK[0], -1, 0], q: piv, c: 0, glint: 0 });
  for (let k = 0; k < 3; k++) {
    const B = BAR[k], b = S.bars[k], [amp, per, ph] = TWIST[k];
    const th = amp * sin((2 * PI * t) / per + ph), ex = cos(th), ez = sin(th), ca = cos(b.a), sa = sin(b.a);
    const bx = ca * ex, by = sa, bz = ca * ez;
    // Hook, then the bar's own point under it, then the ends.
    const hp = [piv[0] - sa * ex * D, piv[1] + ca * D, piv[2] - sa * ez * D];
    const al = b.f * B.len, ar = (1 - b.f) * B.len;
    const le = [hp[0] - bx * al, hp[1] - by * al, hp[2] - bz * al], re = [hp[0] + bx * ar, hp[1] + by * ar, hp[2] + bz * ar];
    // The hook glints while it slides along the bar.
    const sl = b.slide >= SLIDE_AT ? sin(PI * cl((b.slide - SLIDE_AT) / SLIDE, 0, 1)) : 0;
    lines.push({ p: piv, q: hp, c: 1, glint: sl }, { p: le, q: re, c: 1, glint: 0 });
    const ends = [le, re];
    for (let side = 0; side < 2; side++) {
      const e = ends[side], drop = B.drop[side], lo = [e[0], e[1] + drop, e[2]];
      lines.push({ p: e, q: lo, c: 0, glint: 0 });
      const li = k === 0 ? (side === 0 ? 0 : -1) : k === 1 ? (side === 1 ? 1 : -1) : 2 + side;
      if (li < 0) piv = lo;
      else {
        const l = S.letters[li], fl = l.flip >= 0 ? 2 * PI * ss(l.flip) : 0;
        plates.push({ top: lo, th: th + fl, l, pos: li });
      }
    }
  }
  for (const L of lines) (L.p = sw(L.p)), (L.q = sw(L.q));
  for (const P of plates) P.top = sw(P.top);
  return { lines, plates };
}

// Where a point lands on the wall, seen from the lamp.
function onWall(p) {
  const s = (WZ - LZ) / (p[2] - LZ);
  return [LX + s * (p[0] - LX), LY + s * (p[1] - LY)];
}

// A line laid down as samples a third of an LED apart, each shared among the
// four LEDs round it.
function put(buf, X, Y, v) {
  if (X >= 0 && X < W && Y >= 0 && Y < H) buf[Y * W + X] += v;
}
function splatLine(buf, x0, y0, x1, y1, a) {
  const n = max(2, ceil(sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) * 3)), w = a / 3;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n - 0.5, y = y0 + ((y1 - y0) * i) / n - 0.5, ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    put(buf, ix, iy, w * (1 - fx) * (1 - fy));
    put(buf, ix + 1, iy, w * fx * (1 - fy));
    put(buf, ix, iy + 1, w * (1 - fx) * fy);
    put(buf, ix + 1, iy + 1, w * fx * fy);
  }
}

// Ink in glyph row j left of column u.
function inkTo(g, j, u) {
  if (u <= 0) return 0;
  const gw = g.gw;
  if (u >= gw) return g.cum[j * (gw + 1) + gw];
  const i = floor(u);
  return g.cum[j * (gw + 1) + i] + (u - i) * g.g[j * gw + i];
}

// Shadows: every plate, wire and thread, cast by the lamp on the wall.
function castShadows(sh, lines, plates) {
  sh.fill(0);
  for (const L of lines) {
    const a = onWall(L.p), b = onWall(L.q);
    splatLine(sh, a[0], a[1], b[0], b[1], 0.9);
  }
  for (const P of plates) {
    const g = P.l.g, gw = g.gw, ex = cos(P.th), ez = sin(P.th), nx = -ez, nz = ex, T = P.top;
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let k = 0; k < 4; k++) {
      const u = (k & 1 ? 0.5 : -0.5) * gw, c = onWall([T[0] + u * ex, T[1] + (k & 2 ? GH : 0), T[2] + u * ez]);
      x0 = min(x0, c[0]);
      x1 = max(x1, c[0]);
      y0 = min(y0, c[1]);
      y1 = max(y1, c[1]);
    }
    const nT = nx * (T[0] - LX) + nz * (T[2] - LZ), Dz = WZ - LZ;
    for (let y = max(0, floor(y0)); y <= min(H - 1, ceil(y1)); y++)
      for (let x = max(0, floor(x0)); x <= min(W - 1, ceil(x1)); x++) {
        // The ray from the lamp to this LED of the wall, met with the plate.
        const Dx = x + 0.5 - LX, Dy = y + 0.5 - LY, den = nx * Dx + nz * Dz;
        if (abs(den) < 1e-6) continue;
        const s = nT / den, qx = LX + s * Dx - T[0], qy = LY + s * Dy - T[1], qz = LZ + s * Dz - T[2];
        const u = floor(qx * ex + qz * ez + gw / 2), v = floor(qy);
        if (u >= 0 && u < gw && v >= 0 && v < GH && g.g[v * gw + u]) sh[y * W + x] = 1;
      }
  }
}

// Soften the shadow edge by one LED (the lamp is not a point) and lay the
// wall, under a spot aimed a little above the middle.
function paintWall(S) {
  const { fb, sh, tmp } = S;
  if (!S.wall) {
    S.wall = new Float32Array(NP);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const r2 = (x - 30) * (x - 30) + (y - 52) * (y - 52) * 0.55;
        S.wall[y * W + x] = 0.105 + 0.13 * exp(-r2 / 2600);
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      tmp[p] = (sh[p] * 2 + (x > 0 ? sh[p - 1] : sh[p]) + (x < W - 1 ? sh[p + 1] : sh[p])) / 4;
    }
  const wallC = hsv(0.58 + S.hue, 0.16, 1), wall = S.wall;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, s = min(1, (tmp[p] * 2 + (y > 0 ? tmp[p - W] : tmp[p]) + (y < H - 1 ? tmp[p + W] : tmp[p])) / 4);
      const v = wall[p] * (1 - 0.62 * s);
      fb[p * 3] = wallC[0] * v;
      fb[p * 3 + 1] = wallC[1] * v;
      fb[p * 3 + 2] = wallC[2] * v;
    }
}

function paintLine(fb, cov, p, q, wgt, col) {
  splatLine(cov, p[0], p[1], q[0], q[1], wgt);
  const xa = max(0, floor(min(p[0], q[0])) - 2), xb = min(W - 1, ceil(max(p[0], q[0])) + 2);
  const ya = max(0, floor(min(p[1], q[1])) - 2), yb = min(H - 1, ceil(max(p[1], q[1])) + 2);
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const pi = y * W + x, a = min(1, cov[pi]);
      if (a <= 0) continue;
      cov[pi] = 0;
      for (let ch = 0; ch < 3; ch++) fb[pi * 3 + ch] += (col[ch] - fb[pi * 3 + ch]) * a;
    }
}

// A plate, foreshortened by its turn: each LED takes the share of the glyph
// it covers, so a plate turned edge-on thins to its edge and turned past it
// shows its back, the letter mirrored.
function paintPlate(fb, g, T, th, base) {
  const gw = g.gw, ex = cos(th), ez = sin(th), c = abs(ex) < 0.07 ? (ex < 0 ? -0.07 : 0.07) : ex, ac = abs(c);
  // Lit by the lamp on whichever face it turns to it.
  const cx = T[0], lx = LX - cx, ly = LY - T[1] - GH / 2, lz = LZ - T[2], ll = sqrt(lx * lx + ly * ly + lz * lz);
  const shade = 0.5 + 0.5 * abs((-ez * lx + ex * lz) / ll), c0 = base[0] * shade, c1 = base[1] * shade, c2 = base[2] * shade;
  const half = (gw / 2) * ac, xa = max(0, floor(cx - half)), xb = min(W - 1, ceil(cx + half));
  const ya = max(0, floor(T[1])), yb = min(H - 1, ceil(T[1] + GH));
  for (let x = xa; x <= xb; x++) {
    let u0 = (x - cx) / c + gw / 2, u1 = (x + 1 - cx) / c + gw / 2;
    if (u0 > u1) {
      const t = u0;
      u0 = u1;
      u1 = t;
    }
    for (let y = ya; y <= yb; y++) {
      // Rows blend where the plate sits between LEDs.
      const v = y - T[1], j0 = floor(v), fv = v - j0;
      let a = 0;
      if (j0 >= 0 && j0 < GH) a += (1 - fv) * (inkTo(g, j0, u1) - inkTo(g, j0, u0));
      if (j0 + 1 >= 0 && j0 + 1 < GH) a += fv * (inkTo(g, j0 + 1, u1) - inkTo(g, j0 + 1, u0));
      a = min(1, a * ac);
      if (a <= 0) continue;
      const o = (y * W + x) * 3;
      fb[o] += (c0 - fb[o]) * a;
      fb[o + 1] += (c1 - fb[o + 1]) * a;
      fb[o + 2] += (c2 - fb[o + 2]) * a;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.letters) return;
  const { fb, sh, tmp } = S;
  const { lines, plates } = layout(S);
  castShadows(sh, lines, plates);
  paintWall(S);
  // The mobile, far things first.
  const items = [];
  for (const L of lines) items.push({ z: (L.p[2] + L.q[2]) / 2, L, P: null });
  for (const P of plates) items.push({ z: P.top[2], L: null, P });
  items.sort((a, b) => a.z - b.z);
  const steel = [0.62, 0.64, 0.68], thread = [0.36, 0.36, 0.38];
  const pal = [hsv(0.14 + S.hue, 0.85, 1), hsv(0.6 + S.hue, 0.8, 1), hsv(0.995 + S.hue, 0.85, 1), hsv(0.6 + S.hue, 0.07, 1)];
  tmp.fill(0);
  for (const it of items) {
    if (it.L) {
      const { p, q, c, glint } = it.L;
      paintLine(fb, tmp, p, q, c ? 1.15 : 0.8, glint ? steel.map((v) => v + (1 - v) * glint) : c ? steel : thread);
    } else paintPlate(fb, it.P.l.g, it.P.top, it.P.th, pal[it.P.pos]);
  }
  for (let p = 0; p < NP; p++)
    display.setPixel(p % W, floor(p / W), min(255, fb[p * 3] * 255) | 0, min(255, fb[p * 3 + 1] * 255) | 0, min(255, fb[p * 3 + 2] * 255) | 0);
}
