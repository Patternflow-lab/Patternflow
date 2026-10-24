// ===== Patternflow pattern =====
// Title:   Velvet Nap
// Family:  cosmetic
// Idea:    The whole panel is matte velvet under a low light from the left that sways slowly, and two unseen fingertips wander over it in slow strokes, brushing the pile their own way: trails turn dark and rich where the pile is pushed towards the light and pale and silvery where it lies away from it, and cross and overwrite each other like writing on suede, while every few seconds a palm strokes one band from top to bottom so its pile lies one way again.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 34, after the matte velvet of flocked compacts and velvet lip tints
// Round:   34
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Width=0..1, Pile=-1..1
//
// Knob 1: Hue. The dye of the velvet, once round the wheel, the sheen a pale tint of it. At 0 emerald, at 0.2 sapphire, at 0.35 violet, at 0.5 berry, at 0.6 crimson, at 0.68 orange, at 0.76 yellow, at 0.84 lime. From orange to lime the body is lifted towards 0.8 of full brightness and its darker faces lean to ruby, so it never reads rust, mustard or olive.
// Knob 2: Speed. At 2 the fingertips travel 26 LEDs a second in strokes of 1.2 to 3 seconds, lifting for 0.2 to 0.5 seconds between them; a palm strokes down a band every 7 seconds and takes 1.6 seconds over it, and the light sways across and back once every 12 seconds. At 0.2 all of it runs ten times slower, at 3 half as fast again.
// Knob 3: Width. The fingertip: a trail about 4 LEDs wide at 0, 7 at 0.5 and 10 at 1, so the writing goes from a fine hand to broad smears that cover most of the panel.
// Knob 4: Pile. The length of the nap. At -1 a short suede nap whose fibres lean only 36 degrees when brushed, with a broad weak sheen, so the trails are faint; at 0 they lean 54 degrees; at 1 a long plush pile leans 72 degrees, the dark trails go deepest and the silvery ones carry a tight sheen that glints with the fibre grain.
// Buttons: K1 tap lays a palm on the whole panel at once: in about half a second every trail is smoothed away and the pile lies straight down again.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, sin, cos, atan2, round, pow, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// The pile of each LED is a vector in the plane of the cloth: its direction
// is where the fibres lean, its length how far they lean, 0 upright and 1 as
// far over as the pile goes. A palm lays it straight down the panel.
const PALM = 0.85;
// The light comes from the left and a little below, 22 degrees above the
// cloth, and sways 29 degrees either way every 12 seconds.
const ELEV = (22 * PI) / 180, LAZ = PI - 0.36, SWAY = 0.5;

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, width: 0, pile: 0.06, warm: false, clock: 0, palmT: 0, palmY: -99, palmX: 32, flat: 0,
    qx: new Float32Array(N), qy: new Float32Array(N),
    ga: new Float32Array(N), gl: new Float32Array(N), gb: new Float32Array(N),
    fingers: [], c: [0, 0, 0], d: [0, 0, 0],
  });
  for (let p = 0; p < N; p++) {
    S.qy[p] = PALM;
    // The fibre grain: each LED's tuft leans a little off the brushed way,
    // a little more or less, and holds a little more or less dye.
    S.ga[p] = (random() - 0.5) * 0.3;
    S.gl[p] = 1 + (random() - 0.5) * 0.16;
    S.gb[p] = 1 + (random() - 0.5) * 0.05;
  }
  for (let i = 0; i < 2; i++) S.fingers.push(newFinger(i));
}

// The two fingers start one in each half of the panel.
function newFinger(i) {
  return {
    x: 10 + random() * 44, y: (i + 0.15 + random() * 0.7) * 64, hd: random() * 2 * PI, turn: 0,
    down: true, t: random() * 1.5, len: 1.2 + random() * 1.8,
  };
}

// One finger, one step: it curves as it goes and steers away from the edges.
// A stroke lasts 1.2 to 3 seconds, then the finger lifts for 0.2 to 0.5
// seconds and comes down somewhere else.
function moveFinger(S, f, ds) {
  f.t += ds;
  if (!f.down) {
    if (f.t >= f.len) {
      f.down = true;
      f.t = 0;
      f.len = 1.2 + random() * 1.8;
      // It comes down where the velvet is least written: the best of four
      // tries, scored by how far the pile round each is from the palm's.
      let best = 1e9;
      for (let k = 0; k < 4; k++) {
        const x = 6 + random() * (W - 13), y = 6 + random() * (H - 13);
        let sc = 0;
        for (let v = -9; v <= 9; v += 3)
          for (let u = -9; u <= 9; u += 3) {
            const p = cl(round(y + v), 0, H - 1) * W + cl(round(x + u), 0, W - 1);
            sc += Math.abs(S.qx[p]) + Math.abs(S.qy[p] - PALM);
          }
        if (sc < best) (best = sc), (f.x = x), (f.y = y);
      }
      f.hd = random() * 2 * PI;
      f.turn = (random() - 0.5) * 3;
    }
    return false;
  }
  if (f.t >= f.len) {
    f.down = false;
    f.t = 0;
    f.len = 0.2 + random() * 0.3;
    return false;
  }
  f.turn += (random() - 0.5) * 14 * ds - f.turn * 0.8 * ds;
  f.turn = cl(f.turn, -2.6, 2.6);
  // Steer back towards the middle near an edge.
  const mx = 10, cx = f.x < mx ? 1 : f.x > W - 1 - mx ? -1 : 0, cy = f.y < mx ? 1 : f.y > H - 1 - mx ? -1 : 0;
  if (cx || cy) {
    const want = atan2(cy || (32 - f.y) * 0.01, cx || (32 - f.x) * 0.01);
    let dh = want - f.hd;
    dh -= 2 * PI * Math.round(dh / (2 * PI));
    f.turn += dh * 4 * ds;
  }
  f.hd += f.turn * ds;
  return true;
}

// Brush the pile under the fingertip towards the way it moves.
function brush(S, x, y, dx, dy, r) {
  const r2 = (r + 1) * (r + 1);
  for (let yy = max(0, floor(y - r - 1)); yy <= min(H - 1, y + r + 1); yy++)
    for (let xx = max(0, floor(x - r - 1)); xx <= min(W - 1, x + r + 1); xx++) {
      const ex = xx - x, ey = yy - y, e2 = ex * ex + ey * ey;
      if (e2 > r2) continue;
      const w = 0.55 * (1 - sm(0.45 * r, r + 0.6, sqrt(e2))), p = yy * W + xx;
      S.qx[p] += (dx - S.qx[p]) * w;
      S.qy[p] += (dy - S.qy[p]) * w;
    }
}

function step(S, d) {
  const sp = S.speed / 2, ds = d * sp, r = 2.2 + 3.6 * S.width, v = 26;
  S.clock += ds;
  for (const f of S.fingers) {
    if (!moveFinger(S, f, ds)) continue;
    const dx = cos(f.hd), dy = sin(f.hd), dist = v * ds, n = Math.max(1, Math.ceil(dist / 0.7));
    for (let i = 0; i < n; i++) {
      f.x += (dx * dist) / n;
      f.y += (dy * dist) / n;
      brush(S, f.x, f.y, dx, dy, r);
    }
  }
  // Every 7 seconds a palm strokes down one band 22 LEDs wide, from the
  // top edge to the bottom in 1.6 seconds, and lays its pile straight down.
  S.palmT += ds;
  if (S.palmT >= 7) {
    S.palmT -= 7;
    S.palmY = -14;
    S.palmX = 11 + random() * 42;
  }
  if (S.palmY > -50 && S.palmY < H + 14) {
    const y0 = S.palmY;
    S.palmY += (156 / 1.6) * ds;
    const ym = (y0 + S.palmY) / 2;
    for (let y = max(0, floor(y0 - 12)); y <= min(H - 1, S.palmY + 12); y++) {
      const wy = 1 - sm(4, 12, Math.abs(y - ym));
      if (wy <= 0) continue;
      for (let x = max(0, floor(S.palmX - 13)); x <= min(W - 1, S.palmX + 13); x++) {
        const w = 0.5 * wy * (1 - sm(7, 12, Math.abs(x - S.palmX))), p = y * W + x;
        S.qx[p] += (0 - S.qx[p]) * w;
        S.qy[p] += (PALM - S.qy[p]) * w;
      }
    }
  }
  if (S.flat > 0) {
    S.flat -= ds;
    for (let p = 0; p < N; p++) {
      S.qx[p] += (0 - S.qx[p]) * 0.2;
      S.qy[p] += (PALM - S.qy[p]) * 0.2;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.width = cl(k[2], 0, 1);
  S.pile = cl(k[3], -1, 1);
  if (!S.warm) {
    // Open on velvet that has been written on for fourteen seconds, with the
    // next palm due 2.5 seconds in.
    const sp = S.speed;
    S.speed = 2;
    for (let i = 0; i < 420; i++) step(S, 1 / 30);
    S.speed = sp;
    S.palmT = 4.5;
    S.palmY = -99;
    S.warm = true;
  }
  if (input.btnPressed && input.btnPressed[0]) S.flat = 0.5;
  step(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const c = S.c, dcol = S.d;
  // Pile length: a short nap leans 36 degrees when brushed and its sheen is
  // broad; a long plush one leans 72 degrees with a tight bright sheen.
  const u = (S.pile + 1) / 2, bmax = ((36 + 36 * u) * PI) / 180, pex = 3 + 4 * u;
  const az = LAZ + SWAY * sin((2 * PI * S.clock) / 12);
  const lx = cos(az) * cos(ELEV), ly = sin(az) * cos(ELEV), lz = sin(ELEV);
  const h0 = S.hue + 0.42, hh = h0 - floor(h0);
  // Orange, gold and chartreuse velvet read rust, mustard or olive at the
  // body's level, so there the body is lifted towards 0.8 and its darker
  // faces lean to ruby.
  const warm = sm(0.0, 0.05, hh) * (1 - sm(0.24, 0.34, hh));
  // The sheen is a pale tint of the dye.
  hsv(h0, 0.18, 1, dcol);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const qx = S.qx[p], qy = S.qy[p];
      let m = sqrt(qx * qx + qy * qy);
      const ang = (m > 1e-4 ? atan2(qy, qx) : 0) + S.ga[p];
      m = min(1, m * S.gl[p]);
      // The fibre axis t: leaning by beta towards the pile's way.
      const be = m * bmax, sb = sin(be), cb = cos(be);
      const tx = sb * cos(ang), ty = sb * sin(ang), tz = cb;
      const tl = tx * lx + ty * ly + tz * lz, sl = sqrt(max(0, 1 - tl * tl));
      // Kajiya-Kay for a fibre: the lit side goes with the sine to the
      // light, and a tuft seen end-on shows less of its side. The sheen is
      // the reflection cone round the fibre crossing the eye straight ahead.
      const diff = sl * (0.35 + 0.65 * sb);
      const spec = pow(max(0, sl * sb - tl * cb), pex);
      const body = (0.22 + 0.78 * diff) * S.gb[p];
      const rich = 1 - diff;
      hsv(h0 - (0.012 + 0.06 * warm) * rich, 0.78 + 0.2 * rich - 0.25 * spec, 1, c);
      const vb = body * (0.8 + 0.2 * warm) + 0.5 * warm * (1 - body), vs = 0.55 * spec;
      display.setPixel(
        x, y,
        round(255 * min(1, c[0] * vb + dcol[0] * vs)),
        round(255 * min(1, c[1] * vb + dcol[1] * vs)),
        round(255 * min(1, c[2] * vb + dcol[2] * vs)),
      );
    }
}
