// ===== Patternflow pattern =====
// Title:   Grim Reaper
// Family:  halloween
// Idea:    A hooded reaper in a tattered black robe drifts across a hillside graveyard in front of a huge pale moon and a sickly green horizon, two toxic green points burning in its hood and shreds of its ragged hem streaming behind, swinging a long scythe over its head in a wide arc whose blade glints, while the grave candles gutter and go out as it passes over them and light again behind it.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 48
// Round:   48
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Graves=6..30, Fog=0..1
//
// Knob 1: Hue. The glow at the horizon, the moon's tint and the eyes; the sky overhead stays deep purple and the candles gold. At 0 a sickly green horizon, a pale yellow moon and toxic green eyes; at 0.25 a teal horizon, a mint moon and sky blue eyes; at 0.5 violet, lavender and magenta; at 0.75 a red horizon, a pink moon and orange eyes.
// Knob 2: Speed. At 2 a pass takes 10 s: in from the right in 1.8 s, 5.7 s drifting 18 LEDs across the moon while it sways 5 LEDs either way and bobs 6 up and down every 2.9 s, and out to the left in 2.5 s. The scythe swings every 3.2 s (wound back in 0.55 s, the stroke in 0.32 s, held 0.3 s, brought back in 1.2 s), and a candle lights again 0.6 to 1.8 s after the robe has passed it. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Graves. How many graves, six to a row, each with a candle at its foot. At 6 one row stands along the bottom and the robe is all against the sky; at 12 a second row stands 9 LEDs higher on a hill, at 18, 24 and 30 a third, fourth and fifth, each a sixth smaller, until the hill's crest reaches row 82 and the candles climb it.
// Knob 4: Fog. A lilac fog rolling to the right at 8 to 11 LEDs a second. At 0 none; at 0.06 a thin haze over the bottom 22 rows, at most a fifth thick; at 0.5 it reaches row 88 and 0.38 thick; at 1 row 68, over the hem and the lower robe, 0.58 thick.
// Buttons: K1 tap swings the scythe at once, from rest or while it is being brought back.

const W = 64, H = 128, N = W * H;
const { floor, round, ceil, min, max, abs, sqrt, sin, cos, exp, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, sd) => {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash(i * 7919 + sd) * (1 - u) + hash((i + 1) * 7919 + sd) * u) * 2 - 1;
};
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}

// A huge moon high in the middle; the horizon glows low down.
const MX = 31, MY = 45, MR = 30;
// Headstones, each [width, height] near: a round-topped slab, a cross, a
// broken slab, an obelisk and a slab with its corners cut.
const KINDS = [[11, 18], [9, 21], [11, 15], [7, 24], [12, 16]];
function solid(kind, i, j, w, h) {
  const c = (w - 1) / 2, dx = abs(i - c);
  if (kind === 0) return j >= w / 2 || (i + 0.5 - w / 2) ** 2 + (w / 2 - j - 0.5) ** 2 <= (w / 2) ** 2;
  if (kind === 1) return dx <= 1 || (j >= 3 && j <= 4) || (j >= h - 2 && dx <= 2.5);
  if (kind === 2) return j >= (h * 0.35 * i) / w + (abs(i - c * 0.8) < 1 ? 2 : 0);
  if (kind === 3) return j >= h - 2 || dx <= (j < 3 ? j * 0.5 : 0.8 + (1.2 * j) / h);
  return j > 0 || dx < c - 0.5;
}

// The reaper, in its own frame: u across (negative is forward, the way it
// drifts), v down from its shoulders, both in LEDs.
// The scythe: the hand holds the snath LO below and UP above the grip; the
// blade, BL long, leaves the top at right angles and curls back down.
const UP = 27, LO = 12, BL = 19, CURL = 0.3;
// Swing angles of the snath from straight up, forward positive: at rest,
// wound back over the shoulder, and at the end of the stroke, low in front.
const REST = 0.18, BACK = -0.62, END = 3.0;
// Seconds at Speed 2: wind back, the stroke, the hold, the return, and the
// rest before the next swing.
const TW = 0.55, TS = 0.32, TF = 0.3, TR = 1.2, TREST = 0.8;
// One pass across the panel, in seconds at Speed 2.
const PASS = 10;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, ng: 0, fog: 0.06,
    pass: 0.1, bx: 60, by: 50,
    sw: "rest", st: TREST - 1.1, from: REST, phi: REST, glint: -1, glintT: 2,
    candles: [], smoke: [], shreds: [], shredT: 0,
    scene: new Uint8Array(N), bg: new Float32Array(N * 3), bgKey: -1, buf: new Float32Array(N * 3), mask: new Uint8Array(N),
    c: [0, 0, 0], e: [0, 0, 0], fn: new Float32Array(2 * W), stamps: {},
  };
}

// The graveyard climbs a hill, six graves to a row: the first row stands at
// the foot, each further row 9 to 10 LEDs higher and a sixth smaller, and the
// hill rises behind the last row, so more graves cover more of the glowing
// horizon. Each grave has a candle at its foot.
const PER = 6, rowBase = (r) => 124 - 9 * r - (r > 1 ? r - 1 : 0), rowScale = (r) => 1 - 0.17 * r;
// Scene codes: 0 sky, 1 hill, 2 its moonlit crest, 10 + r a stone of row r,
// 20 + r its moonlit top.
function graveyard(S, n) {
  const sc = S.scene, R = ceil(n / PER);
  sc.fill(0);
  for (let x = 0; x < W; x++) {
    const top = rowBase(R - 1) - 3 + round(1.3 * sin(x / 9 + 0.7) + 0.6 * sin(x / 4.1));
    for (let y = top; y < H; y++) sc[y * W + x] = y === top ? 2 : 1;
  }
  const old = S.candles;
  S.candles = [];
  for (let r = R - 1; r >= 0; r--) {
    const m = min(PER, n - r * PER), sz = rowScale(r);
    for (let j = 0; j < m; j++) {
      const i = r * PER + j, kind = floor(hash(i * 17 + 3) * KINDS.length), w = max(3, round(KINDS[kind][0] * sz)), h = max(4, round(KINDS[kind][1] * sz));
      const cx = (round(((j + 0.5 + (r % 2) * 0.5) * 64) / PER + (hash(i * 5 + 1) - 0.5) * 5) + W) % W, x0 = cx - (w >> 1);
      const base = rowBase(r) + round(1.3 * sin(cx / 9 + 0.7));
      for (let jj = 0; jj < h; jj++)
        for (let k = 0; k < w; k++) {
          const x = x0 + k, y = base - h + jj + 1;
          if (x >= 0 && x < W && y < H && solid(kind, (k * KINDS[kind][0]) / w, (jj * KINDS[kind][1]) / h, KINDS[kind][0], KINDS[kind][1])) sc[y * W + x] = 10 + r;
        }
      const x = cl(cx + (hash(i * 11 + 7) < 0.5 ? -(w >> 1) - 1 : (w >> 1) + 1), 1, W - 2);
      const prev = old.find((c) => c.x === x && c.y === base);
      S.candles.push(prev || { x, y: base, f: 1, out: false, wait: 0, sd: i * 97 + 5, h: max(1, round((3 + floor(hash(i * 7) * 2)) * sz)), sz });
    }
  }
  for (let p = N - 1; p >= W; p--) if (sc[p] >= 10 && sc[p] < 20 && sc[p - W] !== sc[p]) sc[p] += 10;
  S.ng = n;
}

// Where the reaper is along a pass: in from the right, a slow drift across
// the moon, and out to the left.
function passX(a) {
  if (a < 0.18) return 104 - 54 * (1 - (1 - a / 0.18) ** 2);
  if (a < 0.75) return 50 - 18 * ((a - 0.18) / 0.57);
  const b = (a - 0.75) / 0.25;
  return 32 - 62 * b * b - 16 * b;
}

function swing(S, ds, tap) {
  S.st += ds;
  if (tap && (S.sw === "rest" || S.sw === "back")) (S.sw = "wind"), (S.st = 0), (S.from = S.phi);
  if (S.sw === "rest") {
    S.phi = REST + 0.25 * sin(S.st * 2.6);
    if (S.st > TREST) (S.sw = "wind"), (S.st = 0), (S.from = S.phi);
  } else if (S.sw === "wind") {
    S.phi = S.from + (BACK - S.from) * sm(S.st / TW);
    if (S.st > TW) (S.sw = "strike"), (S.st = 0), (S.glint = 0);
  } else if (S.sw === "strike") {
    const u = cl(S.st / TS, 0, 1);
    S.phi = BACK + (END - BACK) * (u * u * (2 - u));
    if (S.st > TS) (S.sw = "follow"), (S.st = 0);
  } else if (S.sw === "follow") {
    S.phi = END + 0.06 * sin(S.st * 20) * exp(-S.st * 8);
    if (S.st > TF) (S.sw = "back"), (S.st = 0);
  } else {
    S.phi = END + (REST - END) * sm(S.st / TR);
    if (S.st > TR) (S.sw = "rest"), (S.st = 0);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 6, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.fog = cl(k[3], 0, 1);
  const ng = round(cl(k[2], 6, 30));
  if (ng !== S.ng) graveyard(S, ng);
  const ds = (d * S.speed) / 2;
  S.t += ds;
  S.pass += ds / PASS;
  if (S.pass >= 1) S.pass -= 1;
  // A sway and a bob on top of the drift: it never hangs still.
  S.bx = passX(S.pass) + 5 * sin(S.t * 1.9);
  S.by = 46 + 6 * sin(S.t * 2.2);
  swing(S, ds, input.btnPressed && input.btnPressed[0]);
  // A glint runs along the blade with every stroke, and now and then the
  // moon catches it at rest.
  if (S.glint >= 0) {
    S.glint += ds / 0.45;
    if (S.glint > 1.3) S.glint = -1;
  } else if ((S.glintT -= ds) < 0) (S.glint = 0), (S.glintT = 2.5 + 2 * hash(floor(S.t * 10)));
  // Candles: a flame gutters as the hem comes near, goes out under the
  // robe and lights again a moment after the reaper has passed.
  for (const c of S.candles) {
    const rel = c.x - S.bx;
    if (!c.out) {
      const tf = rel < -26 || rel > 20 ? 1 : rel < -14 ? (-14 - rel) / 12 : 0;
      c.f += (tf - c.f) * min(1, ds * (tf < c.f ? 5 : 2));
      if (c.f < 0.12) {
        c.out = true;
        c.f = 0;
        c.wait = 0.6 + 1.2 * hash(c.sd + floor(S.t));
        for (let i = 0; i < 3; i++) S.smoke.push({ x: c.x, y: c.y - c.h - i, a: -0.15 * i, sd: c.sd + i });
      }
    } else if (rel > 18 || rel < -44) {
      if ((c.wait -= ds) < 0) (c.out = false), (c.f = 1.7);
    }
    if (c.f > 1) c.f = max(1, c.f - ds * 2.5);
  }
  // Shreds of the hem tear off and blow away behind it.
  for (let n = S.shredT + ds * 22; n >= 1; n--) {
    const v = 44 + Math.random() * 14;
    S.shreds.push({ x: S.bx + 15 + (v - 44) * 0.6 + Math.random() * 4, y: S.by + v, vx: 9 + Math.random() * 9, vy: -3 + Math.random() * 4, a: 0 });
  }
  S.shredT = (S.shredT + ds * 22) % 1;
  let kept = 0;
  for (const m of S.shreds) {
    m.a += ds;
    m.x += m.vx * ds;
    m.y += m.vy * ds;
    if (m.a < 1.1 && m.x < W + 2) S.shreds[kept++] = m;
  }
  S.shreds.length = kept;
  // Smoke from a flame that went out rises and drifts off.
  kept = 0;
  for (const m of S.smoke) {
    m.a += ds;
    m.y -= ds * 7;
    m.x += ds * (2 + 3 * vn(S.t + m.sd, m.sd));
    if (m.a < 1.6) S.smoke[kept++] = m;
  }
  S.smoke.length = kept;
}

// Sky, moon and horizon for one hue, in flat steps: deep purple overhead,
// turning the short way round the wheel to the glow at the horizon, sickly
// green at Hue 0. The moon is pale, with a hint of the glow.
function background(S) {
  if (S.bgKey === S.hue) return;
  S.bgKey = S.hue;
  const bg = S.bg, gh = 0.27 + S.hue, sky = [0, 0, 0], moon = hsv(gh - 0.1, 0.16, 0.95, [0, 0, 0]), sea = hsv(gh - 0.05, 0.2, 0.8, [0, 0, 0]);
  let dh = gh - 0.76;
  dh -= Math.round(dh);
  for (let y = 0; y < H; y++) {
    const f = y < 40 ? 0 : floor(min(1, pow((y - 40) / 74, 0.85)) * 11) / 11;
    hsv(0.76 + dh * f, 0.62 + 0.04 * f, 0.2 + 0.46 * f, sky);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, dx = x + 0.5 - MX, dy = y + 0.5 - MY, r = sqrt(dx * dx + dy * dy);
      for (let c = 0; c < 3; c++) bg[o + c] = sky[c];
      if (r < MR) {
        const s = vn(x * 0.3 + 3, 11) + vn(y * 0.27 + 7, 23) + 0.6 * vn((x + y) * 0.21, 5) > 0.75;
        const t = r > MR - 1.2 ? 0.88 : 1;
        for (let c = 0; c < 3; c++) bg[o + c] = (s ? sea[c] : moon[c]) * t;
      } else {
        const g = r < MR + 3 ? 0.2 : r < MR + 7 ? 0.11 : r < MR + 13 ? 0.05 : 0;
        for (let c = 0; c < 3; c++) bg[o + c] += moon[c] * g;
      }
    }
  }
}

// The robe's spans on one row, in the reaper's frame, into SP as pairs;
// returns how many. The hood's dark opening is FACE.
const SP = new Float32Array(32), FACE = [0, 0];
function spans(v, t) {
  FACE[0] = FACE[1] = 0;
  if (v < -22 || v > 64) return 0;
  if (v < -4) {
    // The hood, its peak leaning back, and the opening in front.
    const top = v < -12 ? pow((v + 22) / 10, 0.7) : 1, cu = 1 + max(0, -12 - v) * 0.5, hw = 7.4 * top + (v > -8 ? (v + 8) * 0.6 : 0);
    const fv = 1 - ((v + 10.5) / 4.6) ** 2;
    if (fv > 0) (FACE[0] = -3 - 3.3 * sqrt(fv)), (FACE[1] = -3 + 3.3 * sqrt(fv));
    SP[0] = cu - hw;
    SP[1] = cu + hw;
    return 1;
  }
  if (v < 12) {
    const hw = v < 2 ? 8.5 + (v + 4) * 0.5 : 11.5 + (v - 2) * 0.05;
    SP[0] = 1.5 - hw;
    SP[1] = 1.5 + hw;
    return 1;
  }
  // The skirt widens and leans back, its back edge rippling.
  const cu = 1.5 + (v - 12) * 0.1, hw = 12 + (v - 12) * 0.12;
  const back = (w) => cu + hw + (1.5 + 3 * ((w - 12) / 32)) * sin(w * 0.3 - t * 6.5);
  if (v < 44) {
    SP[0] = cu - hw + 2 * sin(v * 0.25 - t * 5.5);
    SP[1] = back(v);
    return 1;
  }
  // Below the hem, eight tattered strips stream back and flutter.
  const L = cu - hw + 2 * sin(44 * 0.25 - t * 5.5), R = back(44), wd = (R - L) / 8;
  let n = 0;
  for (let i = 0; i < 8; i++) {
    const len = 8 + 13 * hash(i * 13 + 1) + 3 * sin(t * 2.4 + i * 2.3), s = (v - 44) / len;
    if (s > 1) continue;
    const du = (v - 44) * 0.5 + sin(t * 9 + i * 1.9 - (v - 44) * 0.4) * 3.6 * s, c = L + (i + 0.5) * wd + du, w = wd * 0.62 * (1 - s) + 0.3;
    SP[2 * n] = c - w;
    SP[2 * n + 1] = c + w;
    n++;
  }
  return n;
}

// A tapered capsule from (ax, ay) to (bx, by) into the mask, radius ra to rb.
function capsule(mask, ox, oy, ax, ay, bx, by, ra, rb) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const x0 = max(0, floor(ox + min(ax, bx) - ra)), x1 = min(W - 1, ceil(ox + max(ax, bx) + ra)), y0 = max(0, floor(oy + min(ay, by) - ra)), y1 = min(H - 1, ceil(oy + max(ay, by) + ra));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ox - ax, py = y + 0.5 - oy - ay, s = cl((px * dx + py * dy) / l, 0, 1);
      if ((px - dx * s) ** 2 + (py - dy * s) ** 2 < (ra + (rb - ra) * s) ** 2 && !mask[y * W + x]) mask[y * W + x] = 1;
    }
}

// Neighbour steps, a point on the blade, and where along the blade the sweep runs.
const NB4 = [1, 0, -1, 0, 0, 1, 0, -1], BP = [0, 0], ALONG = [0.55, 0.8, 1];

function put(buf, x, y, r, g, b, a) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] += (r - buf[o]) * a;
  buf[o + 1] += (g - buf[o + 1]) * a;
  buf[o + 2] += (b - buf[o + 2]) * a;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ng) return;
  background(S);
  const { buf, mask, bg, scene } = S, t = S.t, hs = S.hue;
  buf.set(bg);
  // The hill, dark, with its crest lit by the moon.
  for (let p = 0; p < N; p++) {
    const m = scene[p];
    if (!m) continue;
    const o = p * 3;
    if (m === 1) (buf[o] = 10), (buf[o + 1] = 7), (buf[o + 2] = 15);
    else if (m === 2) (buf[o] = 50), (buf[o + 1] = 58), (buf[o + 2] = 60);
    else {
      // Stones: grey faces in the moonlight, dimmer row by row up the hill.
      const f = 1 - 0.13 * (m % 10), lit = m >= 20 ? 2.05 : 1;
      buf[o] = 44 * f * lit;
      buf[o + 1] = 40 * f * lit;
      buf[o + 2] = 58 * f * lit;
    }
  }
  // Candles: a wax stub and a flame that leans and flickers, smaller up the hill.
  for (const c of S.candles) {
    for (let j = 0; j < c.h; j++) put(buf, c.x, c.y - j, 196, 184, 160, 1);
    if (c.out || c.f <= 0.02) continue;
    const fl = 0.75 + 0.25 * vn(t * 9 + c.sd, c.sd), gut = c.f < 1 ? 1 + 2.5 * (1 - c.f) * vn(t * 23, c.sd + 3) : 0;
    const f = c.f * fl, top = c.y - c.h, R = 7.5 * c.sz;
    const ht = max(1, round((1 + 2.4 * f) * c.sz)), lean = round(gut + 0.3 * vn(t * 2, c.sd + 9));
    // A warm light on whatever stands round it.
    let st = S.stamps[c.sz];
    if (!st) {
      st = S.stamps[c.sz] = [];
      for (let j = -floor(R); j <= R; j++)
        for (let i = -floor(R); i <= R; i++) {
          const r = sqrt(i * i + j * j * 1.4) / c.sz;
          if (r < 7.5) st.push(i, j, r < 3 ? 0.3 : r < 5.5 ? 0.17 : 0.08);
        }
    }
    for (let q = 0; q < st.length; q += 3) put(buf, c.x + st[q], top - 1 + st[q + 1], 255, 214, 120, f * st[q + 2]);
    for (let j = 0; j < ht; j++) {
      const e = j / ht, x = c.x + round(lean * e);
      if (j === 0) put(buf, x, top - j, 255, 244, 190, min(1, f + 0.3));
      else put(buf, x, top - j, 255, 186 - 60 * e, 50, min(1, f));
    }
    if (c.f > 1.05) put(buf, c.x, top - ht, 255, 255, 230, 1);
  }
  for (const m of S.smoke) if (m.a >= 0) put(buf, m.x, m.y, 110, 104, 120, 0.6 * (1 - m.a / 1.6));

  // The reaper: its robe by rows, then the arm and the sleeve hanging under it.
  const bx = S.bx, by = S.by, phi = S.phi, ux = -sin(phi), uy = -cos(phi);
  // The hand goes forward and down with the stroke and up for the wind-up.
  const sg = (phi - REST) / (END - REST), gx = -12 - 4 * max(0, sg) + 3 * min(0, sg), gy = 8 + 4 * max(0, sg) + 6 * min(0, sg);
  const y0 = max(0, floor(by - 23)), y1 = min(H - 1, floor(by + 66));
  mask.fill(0, y0 * W, (y1 + 1) * W);
  for (let y = y0; y <= y1; y++) {
    const n = spans(y + 0.5 - by, t);
    for (let i = 0; i < n; i++)
      for (let x = max(0, ceil(bx + SP[2 * i] - 0.5)); x <= min(W - 1, floor(bx + SP[2 * i + 1] - 0.5)); x++) mask[y * W + x] = 1;
    if (FACE[1] > FACE[0])
      for (let x = max(0, ceil(bx + FACE[0] - 0.5)); x <= min(W - 1, floor(bx + FACE[1] - 0.5)); x++) mask[y * W + x] = 2;
  }
  capsule(mask, bx, by, -2, -1, gx + 1.5, gy - 0.5, 3.3, 2.5);
  capsule(mask, bx, by, (gx - 2) * 0.55 + 1, gy * 0.55 + 1, gx + 3, gy + 6, 2.6, 1.2);
  const robeC = [22, 15, 32], x0 = max(0, floor(bx - 24)), x1 = min(W - 1, ceil(bx + 36));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const p = y * W + x, m = mask[p];
      if (!m) continue;
      const o = p * 3;
      if (m === 2) {
        buf[o] = buf[o + 1] = buf[o + 2] = 0;
        continue;
      }
      // Cloth, with a rim of the light behind it along its outline.
      const edge = (x > 0 && !mask[p - 1]) || (x < W - 1 && !mask[p + 1]) || (y > 0 && !mask[p - W]) || (y < H - 1 && !mask[p + W]);
      const a = edge ? 0.3 : 0;
      for (let c = 0; c < 3; c++) buf[o + c] = robeC[c] + (bg[o + c] - robeC[c]) * a;
    }
  // Shreds of cloth blowing off the hem, two LEDs wide, then one, then gone.
  for (const m of S.shreds) {
    const a = m.a < 0.7 ? 0.9 : 0.9 * (1 - (m.a - 0.7) / 0.4);
    put(buf, m.x - 0.5, m.y - 0.5, 22, 15, 32, a);
    if (m.a < 0.5) put(buf, m.x + 0.5, m.y - 0.5, 22, 15, 32, a);
    if (m.a < 0.25) put(buf, m.x - 0.5, m.y + 0.5, 22, 15, 32, a);
  }
  // The snath, dark wood.
  const hx = bx + gx, hy = by + gy, tx = hx + ux * UP, ty = hy + uy * UP;
  for (let s = -LO; s <= UP; s += 0.4) put(buf, hx + ux * s - 0.5, hy + uy * s - 0.5, 34, 22, 16, 1);
  // The blade: steel along its back, a bright edge on the inside of the curve.
  const nx = cos(phi), ny = -sin(phi);
  // A point s along the blade, f LEDs in from its back, into BP.
  const bladeAt = (s, f) => {
    BP[0] = tx + nx * BL * s - ux * CURL * BL * s * s - ux * f;
    BP[1] = ty + ny * BL * s - uy * CURL * BL * s * s - uy * f;
  };
  for (let s = 0; s <= 1; s += 0.025) {
    bladeAt(s, 0);
    put(buf, BP[0] - 0.5, BP[1] - 0.5, 120, 128, 146, 1);
    if (s < 0.88) {
      bladeAt(s, 1);
      put(buf, BP[0] - 0.5, BP[1] - 0.5, 196, 210, 228, 1);
    }
  }
  // A sweep of pale light behind the outer half of the blade during the stroke.
  if (S.sw === "strike" || (S.sw === "follow" && S.st < 0.12)) {
    const span = S.sw === "strike" ? min(1.6, (S.phi - BACK) * 0.9) : 1.2 * (1 - S.st / 0.12);
    for (let a = 0.04; a < span; a += 0.025) {
      const q = phi - a, qx = -sin(q), qy = -cos(q), mx = cos(q), my = -sin(q);
      for (const b of ALONG) {
        const ex = hx + qx * UP + mx * BL * b - qx * CURL * BL * b * b, ey = hy + qy * UP + my * BL * b - qy * CURL * BL * b * b;
        put(buf, ex - 0.5, ey - 0.5, 210, 255, 220, 0.6 * (1 - a / span));
      }
    }
  }
  // The glint, running along the edge, with a small star at its brightest.
  if (S.glint >= 0 && S.glint <= 1) {
    bladeAt(S.glint, 1);
    const gx2 = BP[0] - 0.5, gy2 = BP[1] - 0.5, b = sin(S.glint * PI);
    put(buf, gx2, gy2, 255, 255, 255, 1);
    for (let k = 0; k < 8; k += 2) put(buf, gx2 + NB4[k], gy2 + NB4[k + 1], 255, 255, 255, 0.7 * b);
    if (b > 0.8) for (let k = 0; k < 8; k += 2) put(buf, gx2 + 2 * NB4[k], gy2 + 2 * NB4[k + 1], 255, 255, 255, 0.5);
  }
  // The bony hand on the snath.
  put(buf, hx - 0.5, hy - 0.5, 206, 196, 172, 1);
  put(buf, hx - 1.5, hy - 0.5, 176, 166, 146, 1);
  put(buf, hx - 0.5, hy + 0.5, 176, 166, 146, 1);
  // Two points of toxic green in the hood, flaring with the stroke.
  const eye = hsv(0.3 + hs, 0.7, 1, S.e), flare = S.sw === "strike" || S.sw === "follow" ? 1 : 0.75 + 0.25 * vn(t * 6, 3);
  for (const ex of [-4.6, -1.5]) {
    const x = bx + ex, y = by - 10.5;
    put(buf, x - 0.5, y - 0.5, eye[0], eye[1], eye[2], flare);
    for (let k = 0; k < 8; k += 2) put(buf, x - 0.5 + NB4[k], y - 0.5 + NB4[k + 1], eye[0], eye[1], eye[2], 0.28 * flare);
  }

  // Fog over the ground, rolling slowly to the right: one noise across the
  // panel and another for each band of eight rows.
  if (S.fog > 0) {
    const fc = hsv(0.76 + hs, 0.22, 0.6, S.c), topY = 108 - 40 * S.fog, a0 = 0.18 + 0.4 * S.fog, FN = S.fn;
    for (let x = 0; x < W; x++) FN[x] = vn(x * 0.08 - t * 0.9, 41);
    for (let y = max(0, floor(topY)); y < H; y++) {
      const ramp = min(1, (y - topY) / 14), band = y >> 3;
      if ((y & 7) === 0 || y === floor(topY)) for (let x = 0; x < W; x++) FN[W + x] = 0.6 * vn(x * 0.19 - t * 1.6, 43 + band);
      for (let x = 0; x < W; x++) {
        const a = a0 * ramp * cl(0.55 + 0.5 * (FN[x] + FN[W + x]), 0, 1);
        if (a < 0.03) continue;
        const o = (y * W + x) * 3, q = round(a * 8) / 8;
        for (let c = 0; c < 3; c++) buf[o + c] += (fc[c] - buf[o + c]) * q;
      }
    }
  }
  for (let p = 0, o = 0; p < N; p++, o += 3)
    display.setPixel(p % W, (p / W) | 0, min(255, round(buf[o] / 4) * 4), min(255, round(buf[o + 1] / 4) * 4), min(255, round(buf[o + 2] / 4) * 4));
}
