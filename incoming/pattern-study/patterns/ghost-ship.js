// ===== Patternflow pattern =====
// Title:   Ghost Ship
// Family:  halloween
// Idea:    A tattered three-masted ship drifts across a dark sea under a pale moon, pitching and heaving on the swells under her while her torn sails flap, her slack rigging swings, St. Elmo's fire flickers on her mast tops and green lanterns sway at bow and stern and throw their light on the water and into the fog, and now and then she turns half see-through so the moon shows through her, or sinks into the rolling purple fog and comes back further on.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 46
// Round:   46
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Swell=1..4, Fog=0..1
//
// Knob 1: Hue. The ghost light: lanterns, their halos, streaks and glow in the fog, the glow round her outline, gunports, rail and St. Elmo's fire. At 0 toxic green, at 0.25 azure, at 0.5 violet, at 0.75 red orange; the moon, the sails and the orange cabin windows stay as they are.
// Knob 2: Speed. At 2 a swell passes under her every 3.5 seconds, the sails flap 1.2 times a second and she drifts 12 LEDs in 24 seconds before the fog takes her and gives her back at the right; at 0.2 all ten times slower, at 3 half as fast again.
// Knob 3: Swell. At 1 a gentle sea: she pitches 0.1 rad either way, her main truck swings 16 LEDs and spray flies about once a second; at 2.5 she pitches 0.25 rad, heaves 5 LEDs and throws spray at every plunge; at 4 she pitches 0.38 rad, heaves 8 LEDs and the near swells wash over her hull.
// Knob 4: Fog. At 0 and at the opening 0.06, wisps along the waterline, thickest round the hull; at 0.5 the fog swallows the lower hull and the far sea and reaches the lower sails; at 1 it climbs to row 20, her hull is gone and only the sails, masts and lantern glow show through.
// Buttons: K1 tap sinks the ship into the fog: she fades out in a second, the fog closes over where she was, and 1.5 seconds later she comes back 5 LEDs further on.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, atan, exp, PI } = Math;
const TAU = 2 * PI, R = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
  return out;
}
// Into the float frame: set, add colour c times v, move towards a colour by a.
const put = (B, p, r, g, b) => ((B[p] = r), (B[p + 1] = g), (B[p + 2] = b));
const add = (B, p, c, v) => ((B[p] += c[0] * v), (B[p + 1] += c[1] * v), (B[p + 2] += c[2] * v));
const mix = (B, p, r, g, b, a) => ((B[p] += (r - B[p]) * a), (B[p + 1] += (g - B[p + 1]) * a), (B[p + 2] += (b - B[p + 2]) * a));
// Value noise for the fog.
const NT = new Float32Array(65536);
for (let i = 0; i < 65536; i++) NT[i] = hash(i * 7 + 3);
function vn(x, y) {
  const xi = floor(x), yi = floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8;
  const a = NT[y0 + x0], b = NT[y0 + x1], c = NT[y1 + x0], d = NT[y1 + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// The night, built once: the horizon row, the moon's centre and radius.
const HZ = 84, MX = 46, MY = 25, MR = 10;
// Sky in eight flat steps, near black at the top to a purple haze on the horizon.
const SKY = new Float32Array(N * 3);
for (let y = 0; y < HZ + 6; y++) {
  const t = round(8 * sm(0, HZ, y)) / 8;
  for (let x = 0; x < W; x++) {
    put(SKY, (y * W + x) * 3, 0.03 + 0.2 * t, 0.02 + 0.1 * t, 0.09 + 0.24 * t);
  }
}
// The moon with three darker seas, and its halo in stepped rings.
const MOON = new Float32Array(N);
const SEAS = [[-3, -3, 4, 3], [4, 1, 3, 4], [-2, 5, 3, 2]];
for (let y = 0; y < HZ; y++)
  for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - MX, dy = y + 0.5 - MY, r = sqrt(dx * dx + dy * dy), p = (y * W + x) * 3;
    if (r < MR) {
      let e = 9;
      for (const [cx, cy, rx, ry] of SEAS) e = min(e, ((dx - cx) / rx) ** 2 + ((dy - cy) / ry) ** 2);
      MOON[y * W + x] = e < 1 ? 0.84 : 1;
      continue;
    }
    add(SKY, p, [0.9, 0.85, 0.8], r < MR + 3 ? 0.2 : r < MR + 7 ? 0.11 : r < MR + 13 ? 0.05 : 0);
  }
// Stars, each with a twinkle phase.
const STARS = [];
for (let i = 0; STARS.length < 22 && i < 500; i++) {
  const x = floor(hash(i * 3 + 1) * W), y = floor(hash(i * 3 + 2) * 70);
  if ((x - MX) ** 2 + (y - MY) ** 2 < (MR + 5) ** 2) continue;
  STARS.push([x, y, hash(i * 3 + 3) * TAU]);
}

// How a lantern's light in the fog falls off with the squared distance.
const FALL = new Float32Array(900);
for (let i = 0; i < 900; i++) FALL[i] = exp(-sqrt(i) / 10);

// Thin clouds far behind her: row, length, thickness, speed, start.
const CLOUDS = [[13, 30, 2.2, 1.6, 62], [33, 24, 1.8, 2.3, 78], [46, 36, 2.6, 1.2, 50]];

// ---- The sea: six layers of swell, far to near. Each is a wave line
// (base row, amplitude per unit of Swell, wavenumber, frequency, phase) with a
// flat face below it; the ship rides on layer 3.
const LAYERS = [
  [87, 0.35, 0.24, 2.0, 0.0],
  [91, 0.6, 0.18, 1.95, 1.7],
  [96, 0.9, 0.14, 1.9, 3.1],
  [101, 2.0, 0.105, 1.8, 0.6],
  [110, 2.6, 0.085, 1.7, 2.4],
  [121, 3.2, 0.07, 1.6, 4.4],
];
const SHIP_LAYER = 3;
// Face and crest colours of each layer: hazy far, black-blue near.
const FACE = [[0.15, 0.12, 0.3], [0.11, 0.1, 0.25], [0.08, 0.075, 0.2], [0.06, 0.06, 0.16], [0.045, 0.045, 0.13], [0.035, 0.035, 0.11]];
const CREST = [[0.32, 0.27, 0.5], [0.3, 0.27, 0.52], [0.3, 0.28, 0.55], [0.33, 0.32, 0.6], [0.34, 0.33, 0.62], [0.36, 0.35, 0.66]];
function eta(j, x, t, swell) {
  const L = LAYERS[j], k = L[2], w = L[3];
  return swell * L[1] * (sin(k * x - w * t + L[4]) + 0.35 * sin(2.3 * k * x + 1.7 * w * t + 2 * L[4]));
}

// ---- The ship, in her own frame: u along the hull, bow at -u, w up from
// the waterline.
const MASTS = [[-11, 68], [0, 79], [11, 58]];
// Sails: top and bottom centre, top and bottom row, top and bottom half width.
// Three tiers on fore and main, two on the mizzen, a jib to the bowsprit.
const SAILS = [
  [-11, -11, 64, 54, 2.5, 3.5], [-11, -11, 52, 41, 3.5, 4.5], [-11, -11, 39, 27, 4, 4.8],
  [0, 0, 75, 65, 2.5, 3.5], [0, 0, 63, 51, 3.5, 4.5], [0, 0, 49, 35, 4.2, 5],
  [11, 11, 54, 45, 2.5, 3.5], [11, 11, 43, 31, 3.5, 4.5],
  [-12.5, -22, 48, 15, 0.3, 4.5],
];
// Yards across the square sails' tops and bottoms: mast u, row, half width.
const YARDS = [];
for (const s of SAILS.slice(0, 8)) YARDS.push([s[0], s[2], s[4] + 1], [s[0], s[3] + 0.5, s[5] + 0.5]);
const hullTop = (u) => 9 + 2.5 * sm(-14, -19, u) + 4 * sm(10, 12, u) + 2 * sm(14, 21, u);
const hullBot = (u) => -5 + 15 * sm(-15, -23, u) + 7 * sm(17, 22, u);
// Broken stretches of rail, as rows taken off the top.
const RAIL = new Float32Array(48);
for (let i = 0; i < 48; i++) RAIL[i] = hash(i + 900) < 0.22 ? 1 : 0;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, swell: 1, fog: 0.06, t: 0,
    // Where she is, her pitch, heave and lagging pitch (the lanterns swing
    // from it), and the bow's depth and how fast it plunges.
    xs: 36, pitch: 0, heave: 0, lag: 0, bowY: 0, bowV: 0,
    // Her opacity: a ghost dip now and then, and the vanish that the button
    // or the end of a crossing starts (age -1 when none).
    alpha: 1, dip: -1, dipWait: 5, van: -1, moveTo: 36,
    spray: [], fires: [], buf: new Float32Array(N * 3), ship: new Float32Array(N * 4),
    lines: new Float32Array(W * 6), aura: new Float32Array(N), tmp: new Float32Array(N), lamps: [[0, 0], [0, 0]], g: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.swell = cl(k[2], 1, 4);
  S.fog = cl(k[3], 0, 1);
  const ds = (d * S.speed) / 2;
  S.t += ds;
  const t = S.t, sw = S.swell;
  // She rides her layer's swell: heave from the water under her middle,
  // pitch from the slope between bow and stern, both lagging a little.
  const e0 = eta(SHIP_LAYER, S.xs - 17, t, sw), e1 = eta(SHIP_LAYER, S.xs + 17, t, sw), em = eta(SHIP_LAYER, S.xs, t, sw);
  const tp = atan((e0 - e1) / 34) * 0.75;
  S.pitch += (tp - S.pitch) * min(1, ds * 5);
  S.heave += (0.85 * em - S.heave) * min(1, ds * 5);
  S.lag += (S.pitch - S.lag) * min(1, ds * 2.2);
  // Drift: 12 LEDs in 24 s, then she sinks into the fog and comes back
  // at the right.
  if (S.van < 0) S.xs -= ds * 0.5;
  if (S.van < 0 && S.xs < 26) start(S, 38);
  if (input.btnPressed && input.btnPressed[0] && S.van < 0) start(S, S.xs - 5 < 26 ? 38 : S.xs - 5);
  // The vanish: out in 1 s, gone 1.5 s (she moves then), back in 1.5 s.
  let a = 1;
  if (S.van >= 0) {
    S.van += ds;
    if (S.van < 1) a = 1 - sm(0, 1, S.van);
    else if (S.van < 2.5) {
      a = 0;
      S.xs = S.moveTo;
    } else if (S.van < 4) a = sm(2.5, 4, S.van);
    else S.van = -1;
  } else if (S.dip >= 0) {
    // A ghost dip: down to 0.45 in 0.8 s, held 1.2 s, back in 0.8 s.
    S.dip += ds;
    a = 1 - 0.55 * (S.dip < 0.8 ? sm(0, 0.8, S.dip) : S.dip < 2 ? 1 : 1 - sm(2, 2.8, S.dip));
    if (S.dip > 2.8) {
      S.dip = -1;
      S.dipWait = 8 + 7 * R();
    }
  } else {
    S.dipWait -= ds;
    if (S.dipWait <= 0) S.dip = 0;
  }
  S.alpha = a;
  // Spray: the bow's depth in the water under it (LEDs, deeper positive),
  // and droplets thrown forward and up while it plunges.
  const bx = S.xs - 22 * cos(S.pitch), wl = LAYERS[SHIP_LAYER][0];
  const by = 22 * sin(S.pitch) - S.heave + eta(SHIP_LAYER, bx, t, sw);
  S.bowV = ds > 0 && S.t > ds ? (by - S.bowY) / ds : 0;
  S.bowY = by;
  if (S.bowV > 2 && by > -3 && S.spray.length < 60 && a > 0.2 && R() < ds * 0.8 * sw * (S.bowV - 2)) {
    const n = 1 + floor(R() * sw);
    for (let i = 0; i < n; i++)
      S.spray.push({ x: bx - 2 * R(), y: wl - eta(SHIP_LAYER, bx, t, sw) - 1, vx: -6 - 10 * R(), vy: -(8 + 7 * sw) * (0.6 + 0.6 * R()), age: 0, life: 0.5 + 0.5 * R() });
  }
  for (const p of S.spray) {
    p.age += ds;
    p.vy += 45 * ds;
    p.x += p.vx * ds;
    p.y += p.vy * ds;
  }
  S.spray = S.spray.filter((p) => p.age < p.life);
}

function start(S, to) {
  S.van = 0;
  S.dip = -1;
  S.moveTo = to;
}

// The ship's frame to the screen.
function toScreen(S, u, w, out) {
  const c = cos(S.pitch), s = sin(S.pitch), y0 = LAYERS[SHIP_LAYER][0] - S.heave;
  out[0] = S.xs + u * c - w * s;
  out[1] = y0 - (u * s + w * c);
  return out;
}

// One sail: is (u, w) on its cloth, and how lit. 0 when not.
function sailAt(S, i, u, w) {
  const sl = SAILS[i], wt = sl[2], wb = sl[3];
  if (w > wt + 0.5 || w < wb - 4) return 0;
  const ut = sl[0], ub = sl[1], ht = sl[4], hb = sl[5], t = S.t;
  const span = wt - wb, s = (wt - w) / span, hw = ht + (hb - ht) * cl(s, 0, 1);
  if (abs(u - ut - (ub - ut) * s) > hw + 3.5) return 0;
  // The flap: a wave running down the cloth about once a second, pushing the
  // lower part to and fro, with the belly blown towards the bow.
  const ph = 7.5 * t - 2.6 * s + i * 1.9;
  const du = (1.2 + 0.3 * S.swell) * s * s * sin(ph) - 1.6 * s * (1 - s);
  const ul = u - ut - (ub - ut) * s - du;
  if (abs(ul) > hw + 0.5) return 0;
  // The torn foot: tongues of cloth of different lengths, each swinging.
  const tongue = floor((ul + 12) / 1.7) + i * 31;
  const rag = (hash(tongue) - 0.35) * 0.5 + 0.06 * sin(ph * 1.3 + tongue);
  const belly = 0.1 * (1 - (ul / hw) ** 2);
  if (s > 1 + belly + rag || s < 0) return 0;
  // Holes, fixed to the cloth.
  if (hash(floor((ul + 12) / 1.6) * 97 + floor((s * span) / 1.6) * 13 + i * 7) < 0.1) return 0;
  // Folds catch the moon as the wave runs down: three tones.
  const lit = 0.5 + 0.5 * cos(ph + ul * 0.5);
  return lit > 0.66 ? 1 : lit > 0.33 ? 0.76 : 0.52;
}

function plot(S, x, y, r, g, b, a) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const q = (y * W + x) * 4, sh = S.ship;
  if (a < sh[q + 3]) return;
  put(sh, q, r, g, b);
  sh[q + 3] = a;
}
// A line in the ship's frame, sagging sideways by sag at its middle.
const P = [0, 0];
function line(S, u0, w0, u1, w1, sag, r, g, b, a) {
  const len = sqrt((u1 - u0) ** 2 + (w1 - w0) ** 2), n = Math.ceil(len * 1.6);
  const nu = -(w1 - w0) / (len || 1), nw = (u1 - u0) / (len || 1);
  for (let i = 0; i <= n; i++) {
    const f = i / n, bow = 4 * f * (1 - f) * sag;
    toScreen(S, u0 + (u1 - u0) * f + nu * bow, w0 + (w1 - w0) * f + nw * bow, P);
    plot(S, P[0], P[1], r, g, b, a);
  }
}

// A 7-wide running mean along each of the lines of a frame: n LEDs a line,
// lines starting ls apart, LEDs st apart along them.
function box(src, dst, n, lines, ls, st) {
  for (let l = 0; l < lines; l++) {
    let run = 0;
    const o = l * ls;
    for (let i = -3; i < n + 3; i++) {
      if (i + 3 < n) run += src[o + (i + 3) * st];
      if (i - 4 >= 0) run -= src[o + (i - 4) * st];
      if (i >= 0 && i < n) dst[o + i * st] = run / 7;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const t = S.t, sw = S.swell, A = S.alpha, B = S.buf, sh = S.ship, G = S.g;
  // The ghost light, toxic green at the opening.
  hsv(0.3 + S.hue, 0.85, 1, G);
  const flick = 0.82 + 0.1 * sin(t * 13.1) + 0.08 * sin(t * 29.7 + 1);

  // Sky, moon and stars.
  B.set(SKY);
  for (let p = 0; p < N; p++)
    if (MOON[p] > 0) put(B, 3 * p, 0.9 * MOON[p], 0.88 * MOON[p], 0.78 * MOON[p]);
  for (const [x, y, ph] of STARS) {
    const v = 0.3 + 0.25 * sin(t * 2.3 + ph), p = (y * W + x) * 3;
    put(B, p, max(B[p], v), max(B[p + 1], v), max(B[p + 2], v * 1.1));
  }

  // Clouds: dark slate with a rim lit by the moon along the top, brighter
  // and see-through where they cross the moon.
  for (let k = 0; k < CLOUDS.length; k++) {
    const [cy, len, th, sp, x0] = CLOUDS[k], cx = ((((x0 - sp * t) % 110) + 110) % 110) - 23;
    for (let x = max(0, floor(cx - len / 2 - 2)); x < min(W, cx + len / 2 + 2); x++) {
      const u = (x + 0.5 - cx) / (len / 2);
      if (abs(u) >= 1) continue;
      const half = th * sqrt(1 - u * u) * (0.75 + 0.25 * sin(u * 7 + k * 2)), mid = cy + 1.2 * sin(u * 2.5 + k);
      for (let y = max(0, floor(mid - half)); y < min(HZ, mid + half + 1); y++) {
        const p = (y * W + x) * 3, near = MOON[y * W + x] > 0;
        const rim = y + 0.5 < mid - half + 1, a = near ? 0.6 : 0.85;
        mix(B, p, rim ? 0.42 : 0.13, rim ? 0.38 : 0.09, rim ? 0.5 : 0.22, a);
      }
    }
  }

  // The sea lines for every column, then the layers far to near.
  const L = S.lines;
  for (let j = 0; j < 6; j++) for (let x = 0; x < W; x++) L[j * W + x] = round(LAYERS[j][0] - eta(j, x + 0.5, t, sw));
  // Which layer's water each LED shows, -1 for sky; she shows only in
  // front of the sky and the layers behind hers.
  const layerOf = (x, y) => {
    for (let j = 5; j >= 0; j--) if (y >= L[j * W + x]) return j;
    return -1;
  };
  for (let y = HZ - 6; y < H; y++)
    for (let x = 0; x < W; x++) {
      const j = layerOf(x, y);
      if (j < 0) continue;
      const p = (y * W + x) * 3, top = y - L[j * W + x];
      // Crests one LED thick on the far layers, two on the near ones.
      const c = top < 1 || (top < 2 && j >= SHIP_LAYER) ? CREST[j] : FACE[j];
      put(B, p, c[0], c[1], c[2]);
      // Moon glitter: dashes under the moon, wider towards the viewer,
      // flickering with the crests.
      const spread = 0.8 + (y - HZ) * 0.08, dx = abs(x + 0.5 - MX + 0.12 * (y - HZ));
      if (dx < spread && (top < 1 || hash(x * 131 + y * 7 + floor(t * 7) * 1009) < 0.1)) {
        const v = top < 1 ? 0.85 : 0.5;
        put(B, p, 0.9 * v, 0.87 * v, 0.72 * v);
      } else if (top >= 2 && top === round(3.5 + 2.5 * sin(x * LAYERS[j][2] * 2.1 + t * 2.3 + j * 1.3))) {
        // A ripple across each face, a second, fainter crest.
        put(B, p, (c[0] + CREST[j][0]) / 2, (c[1] + CREST[j][1]) / 2, (c[2] + CREST[j][2]) / 2);
      }
    }

  // ---- The ship, into its own buffer with an opacity per LED.
  sh.fill(0);
  if (A > 0.01) {
    const c = cos(S.pitch), s = sin(S.pitch), y0 = LAYERS[SHIP_LAYER][0] - S.heave;
    // Hull and sails, LED by LED, in a box round her.
    const x0 = max(0, floor(S.xs - 40)), x1 = min(W - 1, Math.ceil(S.xs + 40));
    const yTop = max(0, floor(y0 - 77 * c - 32 * abs(s)));
    for (let y = yTop; y < y0 + 8 && y < H; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - S.xs, dy = y0 - (y + 0.5);
        const u = dx * c + dy * s, w = -dx * s + dy * c, q = (y * W + x) * 4;
        if (w < 15.5 && u > -23 && u < 22 && w > hullBot(u) && w < hullTop(u)) {
          const top = hullTop(u), rail = RAIL[cl(floor(u + 24), 0, 47)];
          if (w > top - rail) continue;
          let r = 0.07, g = 0.05, b = 0.11;
          // Planks: a lighter seam every third row.
          if (((w + 30) | 0) % 3 === 0) (r = 0.1), (g = 0.08), (b = 0.15);
          // The rail lit by the ghost light.
          if (w > top - rail - 1.1) (r = G[0] * 0.3), (g = G[1] * 0.3), (b = G[2] * 0.3);
          // Gunports glowing from inside.
          const gp = (u + 30) / 5 - floor((u + 30) / 5);
          if (w > 4 && w < 6 && gp > 0.45 && gp < 0.8 && u > -15 && u < 10) (r = G[0] * 0.6 * flick), (g = G[1] * 0.6 * flick), (b = G[2] * 0.6 * flick);
          // The stern's cabin windows, candle orange.
          if (w > 9.5 && w < 11.6 && ((u > 13.5 && u < 15.5) || (u > 17 && u < 19))) (r = 1 * flick), (g = 0.45 * flick), (b = 0.06);
          put(sh, q, r, g, b);
          sh[q + 3] = A;
          continue;
        }
        if (w < 12 || w > 76 || u < -30 || u > 19) continue;
        for (let i = 0; i < SAILS.length; i++) {
          const v = sailAt(S, i, u, w);
          if (v > 0) {
            put(sh, q, 0.68 * v, 0.66 * v, 0.78 * v);
            sh[q + 3] = 0.88 * A;
            break;
          }
        }
      }
    // Masts, yards and bowsprit in dark grey-violet; the rigging fainter,
    // slack and swinging.
    const mr = 0.2, mg = 0.17, mb = 0.27;
    for (const [mu, mh] of MASTS) line(S, mu, 8, mu, mh, 0, mr, mg, mb, A);
    line(S, 0.6, 8, 0.6, 60, 0, mr, mg, mb, A);
    for (const [yu, yw, yh] of YARDS) line(S, yu - yh, yw, yu + yh, yw, 0, mr, mg, mb, A);
    line(S, -21, 10, -31, 16, 0, mr, mg, mb, A);
    const rr = 0.13, rg = 0.12, rb = 0.2;
    MASTS.forEach(([mu, mh], i) => {
      const sway = 0.9 * sin(t * 2.1 + i * 2) + 6 * (S.pitch - S.lag);
      line(S, mu, mh, i ? MASTS[i - 1][0] : -31, i ? MASTS[i - 1][1] - 14 : 16, sway, rr, rg, rb, 0.8 * A);
      line(S, mu, mh - 3, mu + 7, hullTop(mu + 7), -0.5 * sway, rr, rg, rb, 0.8 * A);
      line(S, mu, mh - 3, mu - 6, hullTop(mu - 6), 0.5 * sway, rr, rg, rb, 0.8 * A);
    });
    line(S, 11, 58, 21, hullTop(21), 0.7 * sin(t * 1.7), rr, rg, rb, 0.8 * A);
    // A torn pennant streaming forward off the main truck.
    for (let i = 0; i <= 14; i++) {
      const f = i / 14, pw = 79 - 1.2 * f + 1.6 * f * sin(t * 9 - 5 * f);
      toScreen(S, -f * 9, pw, P);
      plot(S, P[0], P[1], 0.6, 0.58, 0.7, A);
      if (f < 0.55) {
        toScreen(S, -f * 9, pw - 1, P);
        plot(S, P[0], P[1], 0.6, 0.58, 0.7, A);
      }
    }
    // Lanterns at bow and stern, swinging on hooks against the pitch.
    const sway = cl(-4 * (S.pitch - S.lag) + 0.15 * sin(t * 3), -0.9, 0.9);
    [[-20, 14], [20, 18]].forEach(([lu, lw], i) => {
      toScreen(S, lu, lw, P);
      const hx = P[0], hy = P[1];
      const lx = hx + 2.5 * sin(sway + S.pitch), ly = hy + 2.5 * cos(sway + S.pitch);
      S.lamps[i] = [lx, ly];
      for (let k = 0; k <= 3; k++) plot(S, hx + (lx - hx) * (k / 3), hy + (ly - hy) * (k / 3) - 1, mr, mg, mb, A);
    });
    // Where St. Elmo's fire can burn: the three mast tops and the main
    // course yard's two arms.
    S.fires.length = 0;
    for (const [mu, mh] of MASTS) S.fires.push(toScreen(S, mu, mh + 1, [0, 0]));
    S.fires.push(toScreen(S, -6, 36, [0, 0]), toScreen(S, 6, 36, [0, 0]));
  }

  // The ghost light round her: her opacity blurred twice over 7 x 7 LEDs,
  // laid on in four flat steps just outside her outline.
  const au = S.aura, tm = S.tmp;
  for (let i = 0; i < N; i++) au[i] = sh[i * 4 + 3];
  for (let pass = 0; pass < 2; pass++) {
    box(au, tm, W, H, W, 1);
    box(tm, au, H, W, 1, W);
  }
  // The ship over the sky and far sea, under her own water.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = (y * W + x) * 4, a = sh[q + 3], i = y * W + x;
      // Only outside her outline: inside a sail's holes the blur runs high.
      if (au[i] > 0.04 && au[i] < 0.5 && a < 0.5 && y < LAYERS[SHIP_LAYER][0] + 2) {
        add(B, i * 3, G, (round(min(1, au[i] * 2) * 4) / 4) * 0.36 * flick);
      }
      if (a > 0 && layerOf(x, y) < SHIP_LAYER) mix(B, i * 3, sh[q], sh[q + 1], sh[q + 2], a);
    }

  // Lantern light: halos in stepped rings and a trembling streak below.
  const la = (0.35 + 0.65 * A) * flick;
  if (A > 0.01)
    for (const [lx, ly] of S.lamps) {
      for (let y = max(0, floor(ly - 13)); y < min(H, ly + 14); y++)
        for (let x = max(0, floor(lx - 13)); x < min(W, lx + 14); x++) {
          const r = sqrt((x + 0.5 - lx) ** 2 + (y + 0.5 - ly) ** 2), p = (y * W + x) * 3;
          const v = r < 1.2 ? 1 : r < 3 ? 0.42 : r < 5.5 ? 0.2 : r < 9 ? 0.09 : r < 13 ? 0.04 : 0;
          if (v === 1) put(B, p, 0.6 + 0.4 * G[0], 0.6 + 0.4 * G[1], 0.6 + 0.4 * G[2]);
          else add(B, p, G, v * la);
        }
      const wl = LAYERS[SHIP_LAYER][0] - eta(SHIP_LAYER, lx, t, sw);
      for (let y = round(wl) + 1; y < H; y += 1) {
        const f = (y - wl) / 30, wob = round(lx + 1.8 * sin(y * 0.8 - t * 5) * (0.5 + f));
        if (hash(y * 17 + floor(t * 9) * 131 + round(lx)) > 0.62 - 0.2 * f) continue;
        const v = la * 0.75 * (1 - 0.6 * cl(f, 0, 1));
        for (let x = max(0, wob - 1); x <= min(W - 1, wob + 1); x++) add(B, (y * W + x) * 3, G, x === wob ? v : v / 2);
      }
    }
  // St. Elmo's fire: each point flares and dies on its own noise, a core
  // with a flame licking upward.
  if (A > 0.01)
    S.fires.forEach(([fx, fy], i) => {
      const on = vn(t * 2.6 + i * 37, i * 11) * (0.6 + 0.4 * sin(t * 17 + i * 3));
      if (on < 0.42) return;
      const v = cl((on - 0.42) * 3, 0, 1) * (0.4 + 0.6 * A), lick = round(1 + 1.5 * vn(t * 9 + i * 5, 3));
      const pts = [[0, 0, 1], [-1, 0, 0.45], [1, 0, 0.45], [0, 1, 0.35]];
      for (let k = 1; k <= lick; k++) pts.push([round(0.6 * sin(t * 11 + i + k)), -k, 0.7 - 0.25 * k]);
      for (const [ox, oy, e] of pts) {
        const x = round(fx) + ox, y = round(fy) + oy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        mix(B, (y * W + x) * 3, 0.5 * G[0] + 0.5, 0.5 * G[1] + 0.5, 0.5 * G[2] + 0.5, v * e);
      }
    });
  // Spray off the bow.
  for (const s of S.spray) {
    const x = round(s.x), y = round(s.y);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const v = 0.85 * (1 - s.age / s.life), p = (y * W + x) * 3;
    put(B, p, max(B[p], 0.8 * v), max(B[p + 1], 0.85 * v), max(B[p + 2], v));
  }

  // The fog bank: two octaves of rolling noise along the waterline,
  // thickened where she has just vanished, in five flat steps.
  const fogAmt = 0.5 + 1.4 * S.fog, gone = 1 - A, roll = 0.4 * sin(t * 0.4);
  const [l0x, l0y] = S.lamps[0], [l1x, l1y] = S.lamps[1], lit = A > 0.01 ? 0.6 * la : 0;
  for (let y = floor(48 - 28 * S.fog); y < H; y++) {
    const band = sm(48 - 28 * S.fog, 80 - 20 * S.fog, y) * (1 - 0.5 * sm(104, 127, y));
    for (let x = 0; x < W; x++) {
      const n = 0.6 * vn(x * 0.045 + t * 0.4, y * 0.09 + 7) + 0.4 * vn(x * 0.13 - t * 0.8 + 3, y * 0.26 + roll);
      let dd = band * fogAmt * (n * 2.2 - 0.75);
      if (gone > 0) dd += gone * 0.9 * exp(-(((x - S.xs) / 18) ** 2)) * sm(30, 70, y) * (1 - sm(105, 125, y));
      dd = round(cl(dd, 0, 0.9) * 5) / 5;
      if (dd <= 0) continue;
      // The fog glows with the lanterns near them.
      const r0 = round((x - l0x) ** 2 + (y - l0y) ** 2), r1 = round((x - l1x) ** 2 + (y - l1y) ** 2);
      const gl = round(lit * ((r0 < 900 ? FALL[r0] : 0) + (r1 < 900 ? FALL[r1] : 0)) * 10) / 10;
      mix(B, (y * W + x) * 3, 0.36 + G[0] * gl, 0.25 + G[1] * gl, 0.5 + G[2] * gl, dd);
    }
  }

  for (let p = 0; p < N; p++)
    display.setPixel(p % W, floor(p / W), round(cl(B[3 * p], 0, 1) * 255), round(cl(B[3 * p + 1], 0, 1) * 255), round(cl(B[3 * p + 2], 0, 1) * 255));
}
