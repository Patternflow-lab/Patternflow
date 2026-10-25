// ===== Patternflow pattern =====
// Title:   Fogged Mirror
// Family:  halloween
// Idea:    A tall oval mirror in a dark purple room, lit by one candle below, mists over from its rim inwards until the glass is milky; then an unseen finger writes on the fog from the other side, BOO or GET OUT or a smile with too many teeth, stroke by stroke down to the dark glass, drops run from the strokes leaving streaks, and as the fog clears the mirror shows, for one second, a pale thin figure standing in the room behind you.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 45
// Round:   45
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Fog=0..1, Drips=0..1
//
// Knob 1: Hue. Tints the fog and the figure in the glass: at 0 the fog is milky violet and the figure ghost green; at 0.3 the fog is peach and the figure pale cyan; at 0.6 the fog is pale green and the figure pale blue; at 1 the fog is violet again and the figure lilac. The candle and the room stay as they are.
// Knob 2: Speed. At 2 one round takes 9 to 11 seconds: the fog creeps in for 2.2, the finger writes for 3 to 5, the drops run on for 1, the fog clears in 1.3 with the figure showing through it for 1.3, and the glass rests dark for 0.8. At 0.2 everything runs ten times slower, at 3 half as fast again; the candle flickers at its own pace.
// Knob 3: Fog. How thick the fog is and how fast it comes: at 0 it creeps in from the rim in 2.2 seconds to a milky veil with the dark glass faintly through it; at 1 it rolls in within a second, paler and opaque.
// Knob 4: Drips. How wet the breath is: at 0.06 a stroke's end sheds a drop about every other time and the fog gathers a few beads; at 1 every stroke end sheds one, drops fall from the strokes three times as often, the fog is a quarter thinner, beads all over and sweats ten drops a second of its own, each running down the glass and clearing a streak.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sin, cos, sqrt, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const q = (v, n) => round(v * n) / n;
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), qq = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? qq : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? qq : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? qq : p];
}

// The glass: an ellipse, and the frame 3 LEDs round it.
const MX = 32, MY = 52, MA = 27, MB = 47, FR = 3;
// The candle below the mirror: wick, wax body, the dish it stands in.
const CX = 32, WICK = 112, WAX_TOP = 113;
// One round, in story seconds (one a second at Speed 2).
const CREEP = 2.2, HOLD = 1.0, CLEAR = 1.3, STAY = 0.6, REST = 0.8;

// A chunky hand-written font: each letter is strokes on a 4 by 6 grid, in
// the order a finger would draw them.
const FONT = {
  B: [[[0, 6], [0, 0]], [[0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[3, 3], [4, 4], [4, 5], [3, 6], [0, 6]]],
  O: [[[1.5, 0], [0.3, 1], [0, 3], [0.3, 5], [1.5, 6], [2.5, 6], [3.7, 5], [4, 3], [3.7, 1], [2.5, 0], [1.5, 0]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[0.5, 0], [3.5, 0]], [[2, 0], [2, 6]], [[0.5, 6], [3.5, 6]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1.2], [0, 4.8], [1, 6], [3, 6], [4, 5], [4, 3.3], [2.3, 3.3]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 4.8], [1, 6], [3, 6], [4, 4.8], [4, 0]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [0, 4]], [[1.4, 2.7], [4, 6]]],
  A: [[[0, 6], [0, 2], [2, 0], [4, 2], [4, 6]], [[0, 3.6], [4, 3.6]]],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1.2], [0, 4.8], [1, 6], [3, 6], [4, 5]]],
};

// Lay a word out: lines of text, centred on the glass, at a scale chosen so
// the widest line fits. The finger behind the glass writes backwards for
// itself so that it reads the right way round to us. Returns strokes in
// panel LEDs and the finger's radius.
function words(lines, sc, y0) {
  const strokes = [], pitch = 4 * sc + 5, lh = 6 * sc + 6;
  lines.forEach((line, li) => {
    const w = (line.length - 1) * pitch + 4 * sc, x0 = MX - w / 2, top = y0 + li * lh;
    [...line].forEach((ch, ci) => {
      for (const s of FONT[ch]) strokes.push(s.map(([x, y]) => [x0 + ci * pitch + x * sc, top + y * sc]));
    });
  });
  return { strokes, r: 1.6 };
}

// A smile with too many teeth: the face, two eyes, the mouth, eleven teeth.
function smile() {
  const strokes = [], arc = (cx, cy, rx, ry, a0, a1, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + rx * cos(a), cy + ry * sin(a)]);
    }
    return pts;
  };
  strokes.push(arc(MX, 50, 19, 21, -PI / 2, (3 * PI) / 2, 28));
  strokes.push(arc(MX - 7, 42, 2.4, 3, 0, TAU, 8), arc(MX + 7, 42, 2.4, 3, 0, TAU, 8));
  strokes.push(arc(MX, 49, 13, 6, 0.15, PI - 0.15, 12));
  strokes.push(arc(MX, 49, 13, 13, 0.25, PI - 0.25, 14));
  for (let k = 0; k < 11; k++) {
    const x = MX - 11 + 2.2 * k, y = 49 + 6 * sin(PI * (0.08 + (0.84 * k) / 10));
    strokes.push([[x, y - 0.5], [x, y + 6.5 * sin(PI * (0.08 + (0.84 * k) / 10)) + 0.5]]);
  }
  return { strokes, r: 1.1 };
}

// A hand pressed flat against the other side: the palm, then four fingers
// and the thumb pushed out of it, as strokes from the palm outwards.
function hand() {
  const strokes = [], cx = MX + 1, cy = 60;
  for (let ring = 6; ring >= 0; ring -= 2) {
    const pts = [];
    for (let i = 0; i <= 16; i++) pts.push([cx + ring * 1.05 * cos((TAU * i) / 16), cy + ring * 1.2 * sin((TAU * i) / 16)]);
    strokes.push(pts);
  }
  for (const [dx, len, a] of [[-6, 14, -0.32], [-2, 18, -0.1], [2.2, 19, 0.06], [6, 15, 0.24]])
    strokes.push([[cx + dx, cy - 5], [cx + dx + len * sin(a), cy - 5 - len * cos(a)]]);
  strokes.push([[cx - 7, cy + 1], [cx - 15, cy - 7]]);
  return { strokes, r: 2.1 };
}

const MESSAGES = [
  () => words(["BOO"], 2.4, 40),
  () => words(["GET", "OUT"], 2.2, 30),
  smile,
  () => words(["HI"], 3.2, 36),
  hand,
  () => words(["LOOK", "BACK"], 1.7, 37),
];

export function setup(params) {
  const rho = new Float32Array(N), n1 = new Float32Array(N), n2 = new Float32Array(N);
  // Two fixed fields of soft value noise; their blend drifts over time, so
  // the fog's front creeps unevenly.
  const lat = (seed, gx, gy, x, y) => {
    const fx = (x / W) * gx, fy = (y / H) * gy, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy;
    const v = (i, j) => hash(seed + i * 131 + j * 977);
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return mix(mix(v(ix, iy), v(ix + 1, iy), sx), mix(v(ix, iy + 1), v(ix + 1, iy + 1), sx), sy);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      rho[i] = hypot((x + 0.5 - MX) / MA, (y + 0.5 - MY) / MB);
      n1[i] = 0.65 * lat(11, 5, 9, x, y) + 0.35 * lat(23, 11, 19, x, y);
      n2[i] = 0.65 * lat(37, 5, 9, x, y) + 0.35 * lat(51, 11, 19, x, y);
    }
  params.s = {
    t: 0, rt: 0, hue: 0, speed: 2, fogK: 0, drips: 0.06,
    rho, n1, n2,
    clear: new Float32Array(N), wet: new Uint8Array(N), bead: new Uint8Array(N),
    // The round: phase, time in it, which message, the finger's progress.
    phase: "creep", pt: CREEP * 0.3, msg: 0, cur: null, si: 0, sd: 0, pause: 0,
    drops: [], fig: 0, near: 1, flame: 1, sway: 0,
    rgb: new Float32Array(N * 3),
  };
}

// Clear the fog along a segment of the finger's path: inside the radius to
// the glass, and a wet rim one LED round it where the water piles up.
function wipe(S, x0, y0, x1, y1, r) {
  const ex = x1 - x0, ey = y1 - y0, L2 = ex * ex + ey * ey || 1e-6;
  const xa = max(0, floor(min(x0, x1) - r - 2)), xb = min(W - 1, floor(max(x0, x1) + r + 2));
  const ya = max(0, floor(min(y0, y1) - r - 2)), yb = min(H - 1, floor(max(y0, y1) + r + 2));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, t = cl((px * ex + py * ey) / L2, 0, 1);
      const d = hypot(px - t * ex, py - t * ey), i = y * W + x;
      if (d < r) (S.clear[i] = 1), (S.wet[i] = 0);
      else if (d < r + 1.1 && S.clear[i] < 1) S.wet[i] = 1;
    }
}

function spawnDrop(S, x, y, big) {
  if (S.drops.length > 40) return;
  S.drops.push({ x, y, v: 0, wait: 0.15 + 0.6 * Math.random(), stop: 0, big: big ? 1 : 0, ph: TAU * Math.random() });
}

// The fog's thickness at an LED for a front that has come in by p (0 none,
// 1 the whole glass): it starts at the rim and creeps inwards unevenly.
function fogAt(S, i, p, wob) {
  const n = mix(S.n1[i], S.n2[i], wob), front = p * 2 - (1 - S.rho[i]) - 0.55 * n;
  return cl(front / 0.22, 0, 1);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.fogK = cl(k[2], 0, 1);
  S.drips = cl(k[3], 0, 1);
  const g = (d * S.speed) / 2;
  S.t += g;
  S.rt += d;
  S.pt += g;
  // The candle keeps its own time: a flicker of two beats and a slow sway.
  S.flame = 0.86 + 0.08 * sin(S.rt * 13.1) + 0.06 * sin(S.rt * 7.3 + 1.3 * sin(S.rt * 2.1));
  S.sway = 0.7 * sin(S.rt * 1.7) + 0.3 * sin(S.rt * 4.3);
  const creep = mix(CREEP, 1, S.fogK);
  if (S.phase === "creep" && S.pt >= creep) {
    S.phase = "write";
    S.pt = 0;
    S.cur = MESSAGES[S.msg % MESSAGES.length]();
    S.si = 0;
    S.sd = 0;
    S.pause = 0.3;
    let len = 0;
    for (const s of S.cur.strokes) for (let j = 1; j < s.length; j++) len += hypot(s[j][0] - s[j - 1][0], s[j][1] - s[j - 1][1]);
    // The finger writes 55 LEDs a second, faster for a long message so no
    // message takes more than about 3.5 seconds.
    S.fspeed = max(55, len / 3.2);
  }
  if (S.phase === "write") {
    if (S.pause > 0) S.pause -= g;
    else {
      // Move the finger along the current stroke, wiping as it goes.
      let budget = g * S.fspeed;
      const { strokes, r } = S.cur;
      while (budget > 0 && S.si < strokes.length) {
        const st = strokes[S.si];
        let acc = 0, seg = 0;
        for (seg = 1; seg < st.length; seg++) {
          const l = hypot(st[seg][0] - st[seg - 1][0], st[seg][1] - st[seg - 1][1]);
          if (acc + l > S.sd) break;
          acc += l;
        }
        if (seg >= st.length) {
          // The stroke is done: its end sheds a drop, sometimes.
          const end = st[st.length - 1];
          if (Math.random() < 0.45 + 0.55 * S.drips) spawnDrop(S, end[0], end[1] + r, false);
          S.si++;
          S.sd = 0;
          S.pause = 0.1;
          break;
        }
        const a = st[seg - 1], b = st[seg], l = hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
        const u0 = (S.sd - acc) / l, step = min(budget, acc + l - S.sd), u1 = (S.sd - acc + step) / l;
        wipe(S, mix(a[0], b[0], u0), mix(a[1], b[1], u0), mix(a[0], b[0], u1), mix(a[1], b[1], u1), r);
        // Water squeezed off the finger now and then runs from where it is.
        if (Math.random() < step * (0.012 + 0.03 * S.drips)) spawnDrop(S, mix(a[0], b[0], u1), mix(a[1], b[1], u1) + r, false);
        S.sd += step;
        budget -= step;
      }
      if (S.si >= strokes.length) {
        S.phase = "hold";
        S.pt = 0;
      }
    }
  } else if (S.phase === "hold" && S.pt >= HOLD) {
    S.phase = "clear";
    S.pt = 0;
  } else if (S.phase === "clear" && S.pt >= CLEAR + STAY) {
    S.phase = "rest";
    S.pt = 0;
  } else if (S.phase === "rest" && S.pt >= REST) {
    // New breath on the glass: the old writing fogs over with the rest.
    S.phase = "creep";
    S.pt = 0;
    S.msg++;
    S.clear.fill(0);
    S.wet.fill(0);
    S.bead.fill(0);
    S.drops.length = 0;
  }
  // The figure behind you: it is there as the fog thins, stays a second,
  // and is gone in a blink.
  // While it is there it comes a step closer: from 1 to 1.14 times its size.
  if (S.phase === "clear") S.fig = S.pt < CLEAR * 0.45 ? 0 : S.pt < CLEAR + STAY ? 1 : 0;
  else S.fig = 0;
  S.near = S.fig ? 1 + 0.14 * cl((S.pt - CLEAR * 0.45) / (CLEAR * 0.55 + STAY), 0, 1) : 1;
  // Fog that sits gathers beads of water, a few at Drips 0.06 and hundreds
  // a second at 1, and with Drips up it sweats drops of its own.
  const fogged = S.phase === "write" || S.phase === "hold" || (S.phase === "creep" && S.pt > creep * 0.6);
  if (fogged) {
    let nb = g * (6 + 150 * S.drips ** 1.5);
    while (nb > 0) {
      if (nb >= 1 || Math.random() < nb) {
        const i = floor(Math.random() * N);
        if (S.rho[i] < 0.97 && S.clear[i] < 1) S.bead[i] = 1;
      }
      nb -= 1;
    }
  }
  if (fogged && Math.random() < g * 10 * S.drips * S.drips) {
    const a = TAU * Math.random(), rr = sqrt(Math.random()) * 0.8;
    spawnDrop(S, MX + MA * rr * cos(a), MY + MB * rr * sin(a) * 0.7, Math.random() < 0.5);
  }
  // Drops: swell, then run down in fits and starts, clearing a streak.
  for (const p of S.drops) {
    if (p.wait > 0) {
      p.wait -= g;
      continue;
    }
    if (p.stop > 0) p.stop -= g;
    else {
      p.v = min(p.v + g * 55, 26 + 8 * p.big);
      if (Math.random() < g * 1.4) (p.stop = 0.1 + 0.25 * Math.random()), (p.v *= 0.3);
    }
    const y0 = p.y;
    p.y += p.v * (p.stop > 0 ? 0 : g);
    p.x += 0.25 * sin(p.y * 0.3 + p.ph) * g;
    const x = floor(p.x);
    for (let y = floor(y0); y <= floor(p.y); y++) {
      if (y < 0 || y >= H) continue;
      for (let dx = 0; dx <= p.big; dx++) {
        const i = y * W + x + dx;
        if (x + dx >= 0 && x + dx < W && S.clear[i] < 0.8) (S.clear[i] = 0.8), (S.wet[i] = 0);
      }
    }
    const i = cl(floor(p.y), 0, H - 1) * W + cl(x, 0, W - 1);
    if (S.rho[i] > 0.985) p.dead = 1;
  }
  S.drops = S.drops.filter((p) => !p.dead);
}

// How far the fog is in, 0 to 1, by phase.
function fogProgress(S) {
  const creep = mix(CREEP, 1, S.fogK);
  if (S.phase === "creep") return S.pt / creep;
  if (S.phase === "write" || S.phase === "hold") return 1;
  if (S.phase === "clear") return 1 - cl(S.pt / CLEAR, 0, 1);
  return 0;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, fl = S.flame;
  const p = fogProgress(S), wob = 0.5 + 0.5 * sin(S.t * 0.6);
  const thick = mix(0.72, 1, S.fogK);
  // Wetter breath (Drips up) makes a thinner, glassier fog.
  const wetK = 1 - 0.25 * S.drips;
  const fogTint = hsv(0.76 + S.hue, mix(0.24, 0.12, S.fogK), 1);
  // The figure turns only half as far, through the cold hues: a dim warm
  // figure would read brown.
  const ghost = hsv(0.36 + 0.5 * S.hue, 0.22, 1);
  const flameX = CX + S.sway, flameH = 7 + 1.5 * fl;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, ro = S.rho[i];
      let r, gg, b;
      // Candlelight on the room and the frame: brighter near the flame, in
      // steps of a 24th so the glow does not cost a smooth gradient.
      const dl = hypot((x + 0.5 - flameX) * 1.1, y + 0.5 - (WICK - 3));
      const lamp = q(cl(1 - dl / 70, 0, 1) ** 1.6 * fl, 24);
      if (ro < 1) {
        // The glass: the dark room reflected, the candle's own flame low in
        // it, a faint sheen, and sometimes the one standing behind you.
        const sheen = abs(((x - y * 0.45 + 40) % 46) - 23) < 3 ? 0.03 : 0;
        r = 0.04 + sheen + 0.18 * lamp;
        gg = 0.02 + sheen + 0.08 * lamp;
        b = 0.08 + sheen * 1.4 + 0.1 * lamp;
        const fy = y + 0.5 - 96, fx = x + 0.5 - (CX - S.sway * 0.8);
        if (fy > -5 && fy < 2) {
          const w = (fy < 0 ? 1.7 * (1 + fy / 5) : 1.7 - fy * 0.6) * fl;
          if (abs(fx) < w) (r = 1), (gg = fy > -1.5 && abs(fx) < w * 0.5 ? 0.85 : 0.5), (b = 0.1);
        }
        if (S.fig > 0) {
          // Scaled about its feet, below the frame, as it comes closer.
          const f = figure(40 + (x + 0.5 - 40) / S.near, 104 + (y + 0.5 - 104) / S.near);
          if (f > 0) {
            // The face is the palest, lit from below; the body fades into
            // the dark of the room, the hands catch the light again.
            const lit = f === 1 ? (y > 27 ? 0.66 : 0.52) : f === 2 ? 0.05 : f === 5 ? 0.46 : q(0.4 - 0.26 * cl((y - 34) / 62, 0, 1), 16);
            r = ghost[0] * lit;
            gg = ghost[1] * lit;
            b = ghost[2] * lit;
            if (f === 3) (r = ghost[0] * 0.35), (gg = 0.95), (b = ghost[2] * 0.35);
          }
        }
        // The fog over it, thinner on a bead of water.
        const fog = fogAt(S, i, p, wob) * thick * wetK * (1 - S.clear[i]) * (S.bead[i] ? 0.5 : 1);
        if (fog > 0) {
          // The fog scatters the flame's reflection into a warm patch, and
          // hides the flame itself once it is thick.
          const a = min(1, q(fog, 12) * (fy > -6 && fy < 3 ? 1.4 : 1));
          const spot = q(cl(1 - hypot(fx, fy * 0.8) / 10, 0, 1), 8) * fl;
          // Milky, brighter low down where the candle lights it, and a
          // bright rim where the finger piled the water up.
          const L = (0.55 + 0.25 * lamp + 0.1 * (y / H)) * (S.wet[i] ? 1.3 : 1);
          r = mix(r, min(1, fogTint[0] * L + 0.15 * lamp + 0.4 * spot), a);
          gg = mix(gg, min(1, fogTint[1] * L + 0.06 * lamp + 0.15 * spot), a);
          b = mix(b, min(1, fogTint[2] * L), a);
        }
      } else if (ro < 1 + FR / MA) {
        // The frame: dark violet up top, candle gold at the bottom, with a
        // lighter bevel on its inner edge.
        const bev = ro < 1 + 1.2 / MA ? 1.25 : ro > 1 + 2.4 / MA ? 0.7 : 1;
        const warm = cl(lamp * 2.2, 0, 1);
        r = mix(0.2, 1, warm) * bev;
        gg = mix(0.08, 0.6, warm) * bev;
        b = mix(0.26, 0.12, warm) * bev;
      } else {
        // The wall: dark purple, warmer round the candle.
        r = 0.09 + 0.55 * lamp;
        gg = 0.025 + 0.2 * lamp;
        b = 0.15 + 0.08 * lamp;
      }
      // The candle: an ivory stub with a lit left side, in a dish.
      if (y >= WAX_TOP && y < 124 && abs(x + 0.5 - CX) < 4) {
        const side = x + 0.5 - CX;
        const v = side < -1 ? 1 : side < 1.5 ? 0.82 : 0.6;
        (r = 1 * v), (gg = 0.9 * v), (b = 0.72 * v);
        if (y === WAX_TOP && (x === CX - 3 || x === CX + 1)) (r = 1), (gg = 0.97), (b = 0.85);
      } else if (y >= 124 && y < 127 && abs(x + 0.5 - CX) < 9 - (y - 124) * 2) {
        (r = 0.72), (gg = 0.36), (b = 0.1);
        if (y === 124) (r = 1), (gg = 0.6), (b = 0.2);
      }
      // The flame: a teardrop that sways and stretches with the flicker.
      const fy = WICK - (y + 0.5), fx = x + 0.5 - CX - S.sway * (fy / flameH);
      if (fy > -1 && fy < flameH) {
        const u = fy / flameH, w = u < 0.3 ? 2.3 * sqrt(u / 0.3) : 2.3 * (1 - (u - 0.3) / 0.7) ** 0.8;
        if (abs(fx) < w + 0.2) {
          const core = abs(fx) < w * 0.45 && u < 0.6, mid = abs(fx) < w * 0.75 && u < 0.8;
          if (fy < 0.6) (r = 0.35), (gg = 0.3), (b = 0.9);
          else if (core) (r = 1), (gg = 0.97), (b = 0.75);
          else if (mid) (r = 1), (gg = 0.78), (b = 0.2);
          else (r = 1), (gg = 0.5), (b = 0.05);
        }
      }
      const o = i * 3;
      rgb[o] = r;
      rgb[o + 1] = gg;
      rgb[o + 2] = b;
    }
  // Drop heads: a bright bead, bigger for a big drop.
  for (const p of S.drops) {
    const x = floor(p.x), y = floor(p.y);
    for (let dy = -1; dy <= 0; dy++)
      for (let dx = 0; dx <= p.big; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H || S.rho[yy * W + xx] >= 1) continue;
        const o = (yy * W + xx) * 3, v = dy === 0 ? 1 : 0.7;
        rgb[o] = mix(rgb[o], 0.95, v);
        rgb[o + 1] = mix(rgb[o + 1], 0.95, v);
        rgb[o + 2] = mix(rgb[o + 2], 1, v);
      }
  }
  for (let i = 0; i < N; i++) {
    const o = i * 3;
    display.setPixel(i % W, floor(i / W), round(255 * cl(rgb[o], 0, 1)), round(255 * cl(rgb[o + 1], 0, 1)), round(255 * cl(rgb[o + 2], 0, 1)));
  }
}

// The one standing behind you, as the mirror shows it: 1 for the pale
// face, 2 for the eye holes, 3 for the faint light in them, 4 for the body,
// 5 for the hands, 0 elsewhere.
// Tall and thin, head at row 27, arms hanging past the hips.
function figure(x, y) {
  const cx = 40;
  const hx = (x - cx) / 3.6, hy = (y - 27) / 4.8;
  if (hx * hx + hy * hy < 1) {
    for (const ex of [-1.6, 1.6]) {
      const dx = x - (cx + ex), dy = y - 27.2;
      if (abs(dx) < 1 && abs(dy) < 1.2) return abs(dx) < 0.5 && abs(dy) < 0.5 ? 3 : 2;
    }
    return 1;
  }
  if (y >= 31.5 && y < 34 && abs(x - cx) < 1.4) return 4;
  if (y >= 34) {
    // Narrow shoulders, a body that tapers to the waist and widens a little
    // to the hem of a long shape below.
    const u = (y - 34) / 66, half = y < 36 ? 3 + (y - 34) * 1.2 : 5.4 - 2.2 * sin(PI * cl(u * 1.4, 0, 1)) + 1.6 * u;
    if (abs(x - cx) < half) return 4;
    // The arms: a thin line each side, an LED clear of the body.
    const arm = y < 76 ? 1 : 0, side = abs(x - cx), at = 6.6 + 0.02 * (y - 36);
    if (arm && y > 35 && side > at - 0.8 && side < at + 0.7) return y > 68 ? 5 : 4;
  }
  return 0;
}
