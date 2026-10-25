// ===== Patternflow pattern =====
// Title:   Pit and Pendulum
// Family:  halloween
// Idea:    A torchlit stone dungeon seen from the front: from a winch in the dark vault a long rod swings a huge steel crescent across the panel, its edge glinting and its shadows sweeping the wall, sinking a few LEDs with every pass toward an empty stone slab where rats gather; a hand above the slab the torches gutter, the blade stops, and the chain hauls it back up into the dark to start again.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, after Edgar Allan Poe's story The Pit and the Pendulum (1842), pattern round 49
// Round:   49
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Descent=3..12, Torch=0..1
//
// Knob 1: Hue. The torch fire and the light it throws on the stone, in rings that turn toward violet as they dim: at 0 orange flames lighting the wall gold, orange, red and rose; at 0.1 red; at 0.25 magenta; at 0.4 violet; at 0.55 blue; at 0.75 cyan; at 1 green witch fire. Yellow is left out, because its dim rings turn olive. The slab and the steel stay pale.
// Knob 2: Speed. At 2 the pendulum swings there and back in 2.3 s at the top of its run and 3.2 s just above the slab, as a real pendulum slows when it lengthens, and a whole descent with its haul back up takes 25 s at Descent 3. At 0.2 everything, flames too, runs ten times slower; at 3 half as fast again.
// Knob 3: Descent. LEDs the blade sinks with each pass: at 3 it comes down from the middle of the panel to a hand above the slab in 14 passes, 18 seconds at Speed 2, while the rats on the slab grow from two to seven; at 12 it takes 4 passes and under 5 seconds.
// Knob 4: Torch. How far the torchlight reaches: at 0.06 each torch lights the wall 66 LEDs round it in five steps, gold by the flame and rose at the edge, and the floor and the corners stay dark; at 1 the light reaches 100 LEDs and fills the dungeon.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, asin, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => t * t * (3 - 2 * t);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The room: the vault's arch drops from row 12 at the middle to row 23 at
// the sides, the wall meets the floor at row 104, and the slab's top face
// runs rows 95 to 98 and its front 99 to 113, from column 9 to 54.
const FLOOR = 104, SLAB_X0 = 9, SLAB_X1 = 54, SLAB_TOP = 95, SLAB_FRONT = 99, SLAB_BOT = 113;
const archY = (x) => 12 + 20 * (1 - sqrt(max(0, 1 - ((x + 0.5 - 32) / 36) ** 2)));
// The pendulum: the winch in the vault, the rod's length to the blade at
// the start of a descent, at its end (the blade's edge a hand above the
// slab) and hauled up; the rigid rod under the chain; how far the blade
// reaches sideways at the end of a swing; the period at length 40.
const PX = 32, PY = 8, L_START = 34, L_END = 74, L_TOP = 10, ROD = 24, REACH = 22, T40 = 2.4;
// The blade, a crescent hung by its middle with its horns up: inside the
// outer circle and outside the inner one, both centred on the rod's line,
// in LEDs with v down the rod from its end. Its edge is 7.8 below the
// rod's end and its horns 20.8 to either side, 9.1 above it.
const OC = -13.46, OR = 21.26, IC = -28.33, IR = 28.33;
// Two torches on the walls and the shadow's spread from each onto the wall.
const TX = [8, 56], TY = 52, SPREAD = 2.4;
// The story at Speed 2: the torches gutter and the swing dies, the chain
// hauls the blade into the dark, the torches catch again, it is let down.
const GUTTER = 1.4, HAUL = 3, RELIGHT = 0.7, LOWER = 1.5;

// The rat, facing right, feet on the bottom row: # body, e eye.
const RAT = ["     ##   ", "  #####e# ", " #######  ", "## #   #  "];

export function setup(params) {
  // What each LED of the room is: 0 the dark vault, 1 the arch's stones,
  // 2 and 3 the wall's blocks in two tones, 4 the mortar, 5 the floor's
  // flags, 6 their joints.
  const cls = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, ay = archY(x);
      if (y < ay) cls[i] = 0;
      else if (y < ay + 4) cls[i] = abs((x + 0.5 - 32) % 7) < 0.6 ? 4 : 1;
      else if (y < FLOOR) {
        const row = floor((y - 10) / 7), off = row % 2 ? 6 : 0, bx = floor((x + off) / 12);
        const mortar = (y - 10) % 7 === 0 || (x + off) % 12 === 0;
        cls[i] = mortar ? 4 : ((row * 7 + bx * 13) % 5) < 2 ? 3 : 2;
      } else {
        const fy = y - FLOOR, band = fy === 0 || fy === 4 || fy === 9 || fy === 15 || fy === 22;
        const k = ((x + 0.5 - 32) / (y - 70)) / 0.32, joint = abs(k - Math.round(k)) * (y - 70) * 0.32 < 0.55;
        cls[i] = band || joint ? 6 : 5;
      }
    }
  const R = Math.random;
  params.s = {
    cls, rgb: new Float32Array(N * 3), pal: new Float64Array(8 * 3),
    hue: 0.5, speed: 1.5, descent: 3.5, torch: 0.06, rt: 0.5, flick: new Float64Array(2),
    // The story: phase, time in it, rod length, swing phase and how much
    // of the swing is left, the torches' strength, the winch's turn.
    phase: "swing", pt: 0.5, len: L_START + 2.5, phi: 0.35, amp: 0.5, fire: 0.5, wheel: 0.5, th: 0.5,
    ax: 32.5, ay: 40.5,
    // Two rats on the slab already, the rest come as the blade sinks.
    rats: [
      { side: 0, s: 52.5, to: 52.5, wait: 1.5, face: 1, wig: R() * TAU },
      { side: 1, s: 58.5, to: 58.5, wait: 2.5, face: -1, wig: R() * TAU },
    ],
    spawn: 0.5,
  };
}

// The rats' track from either side: in along the floor, up the end of the
// slab, and along its top toward the middle. s counts LEDs from off-panel.
const TRACK = [[-10, 124], [7, 124], [10, 98], [31, 98]];
const SEG = TRACK.slice(1).map((p, k) => hypot(p[0] - TRACK[k][0], p[1] - TRACK[k][1]));
const TRACK_LEN = SEG.reduce((a, b) => a + b, 0), ON_SLAB = SEG[0] + SEG[1];
function ratAt(r) {
  let s = cl(r.s, 0, TRACK_LEN), k = 0;
  while (k < 2 && s > SEG[k]) (s -= SEG[k]), k++;
  const a = TRACK[k], b = TRACK[k + 1], u = cl(s / SEG[k], 0, 1), x = a[0] + (b[0] - a[0]) * u;
  return [r.side ? 63 - x : x, a[1] + (b[1] - a[1]) * u];
}

function rats(S, d, want) {
  const R = Math.random;
  S.spawn -= d;
  const staying = S.rats.filter((r) => r.to > 0);
  if (staying.length < want && S.spawn <= 0) {
    S.rats.push({ side: R() < 0.5 ? 0 : 1, s: 0, to: ON_SLAB + 3 + R() * (TRACK_LEN - ON_SLAB - 4), wait: 1 + R() * 2, face: 1, wig: R() * TAU });
    S.spawn = 0.35 + 0.3 * R();
  } else if (staying.length > want) staying[staying.length - 1].to = -2;
  for (const r of S.rats) {
    const gap = r.to - r.s;
    if (abs(gap) > 0.3) {
      // A rat runs at 16 LEDs a second, faster when it flees.
      const v = (r.to < 0 ? 30 : 16) * d;
      r.s += cl(gap, -v, v);
      r.face = (gap > 0 ? 1 : -1) * (r.side ? -1 : 1);
    } else if ((r.wait -= d) <= 0 && r.to > 0) {
      // Now and then a rat shuffles along the slab.
      r.to = cl(r.s + (R() - 0.5) * 12, ON_SLAB + 3, TRACK_LEN - 1);
      r.wait = 1.2 + 2.5 * R();
    }
    r.wig += d * 9;
  }
  S.rats = S.rats.filter((r) => r.to > 0 || r.s > 0.5);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.descent = cl(k[2], 3, 12);
  S.torch = cl(k[3], 0, 1);
  const g = (d * S.speed) / 2;
  S.rt += g;
  S.pt += g;
  // Each torch's light breathes and now and then jumps, on the story's clock.
  for (let t = 0; t < 2; t++) {
    const c = S.rt * 1.7 + t * 2.3;
    S.flick[t] = 0.88 + 0.07 * sin(c * 3.1) * sin(c * 1.3 + 1) + 0.05 * sin(c * 7.7 + t);
  }
  // A real pendulum: the swing's rate falls as the square root of its length.
  const w = (TAU / T40) * sqrt(40 / S.len);
  let want = 2;
  if (S.phase === "swing") {
    S.phi += w * g;
    // Each pass, half a swing, lowers it Descent LEDs.
    S.len += (S.descent * w * g) / PI;
    S.amp = 1;
    S.fire = 1;
    want = 2 + Math.round((5 * (S.len - L_START)) / (L_END - L_START));
    if (S.len >= L_END) (S.len = L_END), (S.phase = "gutter"), (S.pt = 0);
  } else if (S.phase === "gutter") {
    // The flames sink and sputter, and the swing dies to a stop over the slab.
    const u = cl(S.pt / GUTTER, 0, 1);
    S.phi += w * g;
    S.amp = 1 - ease(u);
    S.fire = 1 - 0.72 * ease(cl(u * 1.6, 0, 1));
    want = 7;
    if (u >= 1) (S.phase = "haul"), (S.pt = 0);
  } else if (S.phase === "haul") {
    const u = cl(S.pt / HAUL, 0, 1), was = S.len;
    S.len = L_END + (L_TOP - L_END) * ease(u);
    S.wheel += (was - S.len) / 5;
    S.amp = 0;
    S.fire = 0.28;
    want = 0;
    if (u >= 1) (S.phase = "relight"), (S.pt = 0);
  } else if (S.phase === "relight") {
    const u = cl(S.pt / RELIGHT, 0, 1);
    S.fire = 0.28 + 0.72 * ease(u) + 0.25 * sin(PI * u);
    want = 0;
    if (u >= 1) (S.phase = "lower"), (S.pt = 0), (S.phi = 0);
  } else {
    // Let down to the middle of the panel, swinging again as it goes.
    const u = cl(S.pt / LOWER, 0, 1), was = S.len;
    S.len = L_TOP + (L_START - L_TOP) * ease(u);
    S.wheel += (was - S.len) / 5;
    S.phi += w * g;
    S.amp = ease(u);
    S.fire = 1;
    want = 1;
    if (u >= 1) (S.phase = "swing"), (S.pt = 0);
  }
  if (S.phase === "swing") S.wheel -= (S.descent * w * g) / PI / 5;
  // The swing: the blade reaches REACH LEDs to either side at full swing.
  S.th = S.amp * asin(min(1, REACH / S.len)) * sin(S.phi);
  S.ax = PX + S.len * sin(S.th);
  S.ay = PY + S.len * cos(S.th);
  rats(S, d, want);
}

// Is (x, y) on the blade? Only the blade casts a shadow: the rod's, a thin
// line across the whole wall, read as a second rope.
function onBlade(S, x, y) {
  const ex = sin(S.th), ey = cos(S.th), bx = x - S.ax, by = y - S.ay, u = bx * ey - by * ex, v = bx * ex + by * ey;
  if (v > 8 || v < -10 || abs(u) > 21) return false;
  return u * u + (v - OC) ** 2 < OR * OR && u * u + (v - IC) ** 2 > IR * IR;
}

// The frame's colours: the stone in six steps of torchlight, from unlit
// through rings that turn from the fire's own hue toward violet as they
// dim (gold, orange, red, rose for orange fire), so no ring goes brown.
// Hue turns the fire from orange the long way round to green, past red,
// violet and blue, and never through yellow, whose dim rings go olive.
function palette(S) {
  const P = S.pal, h = 0.075 - 0.775 * S.hue;
  // The short way round the wheel from the fire's hue to violet.
  let to = 0.76 - h;
  to -= Math.round(to);
  const ring = (f, s, v, o) => hsv(h + to * f, s, v, P, o * 3);
  (P[0] = 0.04), (P[1] = 0.03), (P[2] = 0.07);
  ring(0.75, 0.75, 0.2, 1);
  ring(0.5, 0.85, 0.32, 2);
  ring(0.25, 0.9, 0.48, 3);
  ring(0.05, 0.88, 0.7, 4);
  hsv(h + 0.03, 0.6, 0.92, P, 15);
  // The flame's own colours: its hue at full and a pale core.
  hsv(h, 0.9, 1, P, 18);
  hsv(h + 0.05, 0.35, 1, P, 21);
}

function room(S, R) {
  const { rgb, cls, pal: P } = S, LY = TY - 4, R2 = R * R;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, c = cls[i], o = i * 3;
      if (c === 0) {
        rgb[o] = rgb[o + 1] = rgb[o + 2] = 0;
        continue;
      }
      let f = 0;
      for (let t = 0; t < 2; t++) {
        const dx = x + 0.5 - TX[t], dy = y + 0.5 - LY, dd = dx * dx + dy * dy;
        if (dd >= R2) continue;
        // In the blade's shadow: the line back to the torch, cut at the
        // pendulum's depth, meets the blade.
        if (onBlade(S, TX[t] + dx / SPREAD, LY + dy / SPREAD)) continue;
        f += (1 - sqrt(dd) / R) * S.flick[t];
      }
      let lv = min(5, floor(min(1, f * S.fire) * 6));
      // Mortar and floor joints a step darker, the darker blocks a little.
      if (c === 4 || c === 6) lv = max(0, lv - 1);
      const dim = c === 3 ? 0.82 : c === 5 ? 0.9 : 1;
      (rgb[o] = P[lv * 3] * dim), (rgb[o + 1] = P[lv * 3 + 1] * dim), (rgb[o + 2] = P[lv * 3 + 2] * dim);
    }
}

function put(rgb, x, y, r, g, b) {
  x = floor(x);
  y = floor(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  (rgb[o] = r), (rgb[o + 1] = g), (rgb[o + 2] = b);
}
function add(rgb, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  (rgb[o] += r), (rgb[o + 1] += g), (rgb[o + 2] += b);
}

// The torches: an iron bracket, a flame that leans and leaps, and round it
// three steps of glow in the air.
function torches(S) {
  const { rgb, pal: P } = S, t = S.rt, fire = S.fire;
  for (let k = 0; k < 2; k++) {
    const x0 = TX[k], fl = 0.75 + 0.25 * sin(t * 9.1 + k * 2) * sin(t * 4.3 + k), hgt = (6 + 3 * fl) * (0.4 + 0.6 * fire), lean = 0.8 * sin(t * 2.7 + k * 1.3);
    for (let y = TY - 16; y <= TY + 10; y++)
      for (let x = x0 - 12; x <= x0 + 12; x++) {
        const dd = hypot(x + 0.5 - x0, y + 0.5 - (TY - 4)) / ((0.6 + 0.4 * fire) * S.flick[k]), a = dd < 5 ? 0.42 : dd < 8 ? 0.26 : dd < 11 ? 0.13 : 0;
        if (a > 0) add(rgb, x, y, P[18] * a * fire, P[19] * a * fire, P[20] * a * fire);
      }
    // The bracket and the torch's handle.
    for (let y = TY; y <= TY + 7; y++) put(rgb, x0, y, 0.22, 0.14, 0.1), put(rgb, x0 - 1, y, 0.3, 0.2, 0.13);
    for (let x = x0 - 3; x <= x0 + 3; x++) put(rgb, x, TY + 7, 0.28, 0.26, 0.3);
    for (let y = 0; y < hgt; y++) {
      const q = y / hgt, wd = (q < 0.35 ? 2.4 : 2.4 * (1 - (q - 0.35) / 0.65)) + 0.2, cx = x0 + lean * q * q;
      for (let x = floor(cx - wd); x <= cx + wd; x++) {
        const core = abs(x + 0.5 - cx) < wd * 0.45 && q < 0.6;
        const c = core ? 21 : 18;
        put(rgb, x, TY - 1 - y, P[c], P[c + 1], P[c + 2]);
      }
    }
  }
}

// The slab: a pale top face, its front in two steps, the torchlight on both.
function slab(S, R) {
  const { rgb, pal: P } = S, LY = TY - 4;
  for (let y = SLAB_TOP; y <= SLAB_BOT; y++)
    for (let x = SLAB_X0; x <= SLAB_X1; x++) {
      const top = y < SLAB_FRONT, edge = x === SLAB_X0 || x === SLAB_X1 || y === SLAB_FRONT;
      let f = 0;
      for (let t = 0; t < 2; t++) f += max(0, 1 - hypot(x + 0.5 - TX[t], y + 0.5 - LY) / (R * 1.25));
      const lv = min(4, floor(min(1, f * S.fire) * 6)), base = top ? 0.42 : y > SLAB_BOT - 3 ? 0.17 : 0.26, a = top ? 0.5 : 0.35;
      const o = (y * W + x) * 3, e = edge ? 0.8 : 1;
      (rgb[o] = (base + P[lv * 3] * a) * e), (rgb[o + 1] = (base * 0.94 + P[lv * 3 + 1] * a) * e), (rgb[o + 2] = (base * 1.08 + P[lv * 3 + 2] * a) * e);
    }
}

function drawRats(S) {
  const { rgb } = S;
  for (const r of S.rats) {
    const [x0, y0] = ratAt(r), sit = abs(r.to - r.s) < 0.3, bob = sit ? (sin(r.wig) > 0.6 ? -1 : 0) : floor(r.wig) % 2 ? -1 : 0;
    for (let ry = 0; ry < 4; ry++)
      for (let rx = 0; rx < 10; rx++) {
        const ch = RAT[ry][rx];
        if (ch === " ") continue;
        const x = x0 + (r.face > 0 ? rx - 5 : 4 - rx), y = y0 - 3 + ry + (ry < 2 ? bob : 0);
        // The eye catches the torchlight, and burns red while the torches gutter.
        if (ch === "e") put(rgb, x, y, 1, S.fire < 0.6 ? 0.1 : 0.35, 0.2);
        else {
          // Black fur, the ears and back caught by the torches.
          const rim = (ry === 0 || (ry === 1 && RAT[0][rx] === " ")) * S.fire;
          put(rgb, x, y, 0.07 + 0.26 * rim, 0.05 + 0.15 * rim, 0.07 + 0.14 * rim);
        }
      }
    // The tail, a curl along the stone.
    for (let q = 1; q <= 5; q++) put(rgb, x0 + (r.face > 0 ? -5 - q : 4 + q), y0 + (q > 3 ? -1 : 0), 0.13, 0.08, 0.1);
  }
}

function pendulum(S) {
  const { rgb, pal: P } = S, ex = sin(S.th), ey = cos(S.th), lit = 0.45 + 0.55 * S.fire;
  // The winch in the vault: a drum that turns as the chain pays out, its
  // rim and four spokes.
  for (let y = PY - 6; y <= PY + 6; y++)
    for (let x = PX - 6; x <= PX + 6; x++) {
      const r = hypot(x + 0.5 - PX, y + 0.5 - PY);
      if (r < 5.8) put(rgb, x, y, (r > 4.6 ? 0.36 : 0.15) * lit, (r > 4.6 ? 0.32 : 0.13) * lit, (r > 4.6 ? 0.37 : 0.17) * lit);
    }
  for (let s = 0; s < 4; s++) {
    const t = S.wheel + (s * PI) / 2;
    for (let q = 1; q < 5; q++) put(rgb, PX + q * cos(t), PY + q * sin(t), 0.3 * lit, 0.27 * lit, 0.31 * lit);
  }
  // The chain from the winch, its links moving with it, then the iron rod.
  for (let q = 0; q <= S.len * 2; q++) {
    const a = q / 2, x = PX + a * ex, y = PY + a * ey;
    if (a < S.len - ROD) {
      // Links lying flat and edge on by turns, each 4 LEDs.
      let link = (a + S.wheel * 5) % 4;
      if (link < 0) link += 4;
      const b = link < 2.5 ? 0.58 : 0.22, b2 = link < 2.5 ? 0.24 : 0.46;
      put(rgb, x, y, b * lit, b * 0.94 * lit, b * 0.9 * lit);
      put(rgb, x + ey, y - ex, b2 * lit, b2 * 0.94 * lit, b2 * 0.92 * lit);
    } else {
      put(rgb, x, y, 0.62 * lit, 0.58 * lit, 0.58 * lit);
      put(rgb, x + ey, y - ex, 0.3 * lit, 0.27 * lit, 0.32 * lit);
    }
  }
  // The blade: dark steel inside, brighter toward the edge, the edge itself
  // near white, and a glint that runs along it and flares as it passes the bottom.
  const gl = sin(S.phi) * S.amp, flare = S.amp * max(0, 1 - abs(cos(S.phi)) * 4);
  // Hauled up into the vault the blade leaves the torchlight.
  const bl = lit * cl((S.ay - 8) / 30, 0.3, 1);
  for (let y = floor(S.ay - 22); y <= S.ay + 22; y++)
    for (let x = floor(S.ax - 22); x <= S.ax + 22; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const bx = x + 0.5 - S.ax, by = y + 0.5 - S.ay, u = bx * ey - by * ex, v = bx * ex + by * ey;
      const dOut = OR - sqrt(u * u + (v - OC) ** 2), dIn = sqrt(u * u + (v - IC) ** 2) - IR;
      if (dOut <= 0 || dIn <= 0) continue;
      const hot = abs(u + gl * 16) < 2.6 && dOut < 1.5;
      const st = dOut < 1.1 ? (hot ? 1 : 0.92) : dOut < 2.4 ? 0.62 : 0.4;
      const tint = dOut < 1.1 ? 0.08 : 0.2;
      const o = (y * W + x) * 3;
      (rgb[o] = (st * (1 - tint) + P[12] * tint) * bl), (rgb[o + 1] = (st * 0.98 * (1 - tint) + P[13] * tint) * bl), (rgb[o + 2] = (st * 1.04 * (1 - tint) + P[14] * tint) * bl);
    }
  if (flare > 0.05) {
    // A four-pointed star of light on the edge, under the rod.
    const sx = S.ax + ex * 7.5, sy = S.ay + ey * 7.5, n = 2 + floor(5 * flare);
    for (let q = -n; q <= n; q++) {
      const a = 1 - abs(q) / (n + 1);
      put(rgb, sx + q, sy, 1, 1, 0.9 * a + 0.1);
      put(rgb, sx, sy + q, 1, 1, 0.9 * a + 0.1);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, R = 64 + 36 * S.torch;
  palette(S);
  room(S, R);
  torches(S);
  slab(S, R);
  drawRats(S);
  pendulum(S);
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
