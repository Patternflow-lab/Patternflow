// ===== Patternflow pattern =====
// Title:   Cushion Mesh
// Family:  cosmetic
// Idea:    The net over a cushion compact seen from a few millimetres, thread and hole every other LED, while an unseen puff dabs it twice a second: under each dab liquid foundation wells up through the holes as glossy one-LED beads, which turn from white to the tint as they wait and are drawn back from the rim of the mark inward, leaving the holes wet and dark until they dry; a band of light slides down across the mesh every seven seconds and whitens the beads it passes.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 32, after the mesh net of a cushion compact
// Round:   32
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Press=-1..1, Puff=0..1
//
// Knob 1: Hue. The tint of the foundation, once round the wheel. At 0 rose beige: the dry mesh dusky rose, fresh beads near white and older ones salmon; at 0.1 apricot and honey, at 0.3 a green colour corrector, at 0.55 a sky-blue primer, at 0.75 lilac.
// Knob 2: Speed. At 2 the puff dabs every 0.5 seconds, each dab down in 0.12 s, held 0.22 s and up in 0.12 s, and a wet hole dries in 1.5 s; at 0.2 a dab every 5 seconds and the beads hardly move; at 3 one every 0.33 s.
// Knob 3: Press. How hard the puff presses. At 0 about 78% of the holes under a dab bead and the mesh holds 769 beads, 9.4% of the panel; at -1 the dabs are light pats that bead 62% of their holes and the mesh holds 350, 4.3% of the panel; at 1, 97% of them bead and the mesh holds 1692, 21% of the panel.
// Knob 4: Puff. The size of the dab mark: about 26 LEDs across at 0, 54 at 1, nearly the panel's width.
// Buttons: K1 tap presses the whole cushion at once: for half a second foundation comes up through about 70% of the holes on the panel, then drains back to the usual amount over 2.5 seconds.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, sin, exp, atan2, round, random } = Math;
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

// The mesh is a one-LED checker: the threads (x + y odd) are black, the
// holes show the soaked sponge at level 40, and a bead is a hole at 255. So
// every pair of neighbours is a thread and a hole, 40 apart or 255 apart, and
// the share of beads alone sets the measured edges: 769 beads give 0.190.
// Beads only form off the panel's edge, where each has four threads round it.
const HOLES = [];
for (let y = 1; y < H - 1; y++) for (let x = 2 - (y & 1); x < W - 1; x += 2) HOLES.push(y * W + x);
const BEADS = 769;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, press: 0, puff: 0.06, warm: false, flood: 0, extra: 0, clock: 0,
    dabT: 99, dab: null,
    thr: new Float32Array(N), life: new Float32Array(N), life0: new Float32Array(N), wet: new Float32Array(N),
    P: new Float32Array(N), bead: new Uint8Array(N), list: [], c: [0, 0, 0],
  };
  const S = params.s;
  // How readily each hole lets the foundation through.
  for (const p of HOLES) S.thr[p] = random();
}

function newDab(S) {
  // The puff goes where the mesh is driest: the best of ten tries, scored by
  // the beads and wet holes under it.
  const r = 13 + 14 * S.puff;
  let bx = 32, by = 64, best = 1e9;
  for (let k = 0; k < 10; k++) {
    const x = r * 0.5 + random() * (W - r), y = r * 0.5 + random() * (H - r);
    let score = 0;
    for (let v = -r; v <= r; v += 3)
      for (let u = -r; u <= r; u += 3) {
        const px = round(x + u), py = round(y + v);
        if (u * u + v * v > r * r || px < 0 || px >= W || py < 0 || py >= H) continue;
        const q = py * W + px - ((px + py) & 1);
        score += S.bead[q] + 0.3 * S.wet[q];
      }
    if (score < best) (best = score), (bx = x), (by = y);
  }
  S.dab = { x: bx, y: by, r, w1: random() * 6.28, w2: random() * 6.28 };
  S.dabT = 0;
}

function step(S, d) {
  const sp = S.speed / 2, ds = d * sp;
  S.dabT += ds;
  if (S.dabT >= 0.5) newDab(S);
  const t = S.dabT, a = t < 0.12 ? sm(0, 0.12, t) : t < 0.34 ? 1 : 1 - sm(0.34, 0.46, t);
  const P = S.P;
  P.fill(0);
  if (S.dab && a > 0) {
    // The mark spreads from three quarters of its size as the puff lands,
    // with a soft rim that wobbles round the edge.
    const { x: cx, y: cy, r: r0, w1, w2 } = S.dab, r = r0 * (0.75 + 0.25 * a);
    for (let y = max(1, floor(cy - r - 2)); y <= min(H - 2, cy + r + 2); y++)
      for (let x = max(1, floor(cx - r - 2)); x <= min(W - 2, cx + r + 2); x++) {
        const dx = x - cx, dy = y - cy, th = atan2(dy, dx);
        const e = r * (1 + 0.08 * sin(3 * th + w1) + 0.05 * sin(5 * th + w2));
        const v = a * (1 - sm(0.7 * e, e, sqrt(dx * dx + dy * dy)));
        if (v > 0) P[y * W + x] = v;
      }
  }
  if (S.flood > 0) {
    S.flood = max(0, S.flood - ds);
    const v = 0.9 * sm(0.5, 0.42, S.flood) * sm(0, 0.08, S.flood);
    for (const p of HOLES) P[p] = max(P[p], v);
    if (S.flood === 0) S.extra = 1;
  } else S.extra = max(0, S.extra - ds / 2.5);
  const rho = 0.78 * 1.25 ** S.press, L = 4.5 * 1.4 ** S.press, list = S.list;
  list.length = 0;
  for (const p of HOLES) {
    const pv = P[p];
    if (pv > 0) S.wet[p] = max(S.wet[p], pv);
    S.wet[p] = max(0, S.wet[p] - ds / 1.5);
    if (S.bead[p]) {
      // A bead under the puff is fed; once the puff lifts it waits its turn.
      if (pv < 0.05) S.life[p] -= ds;
      if (S.life[p] <= 0) {
        S.bead[p] = 0;
        S.wet[p] = 1;
        continue;
      }
      list.push(p);
    } else if (pv * rho > S.thr[p]) {
      let q = 1;
      if (S.dab) {
        const dx = (p % W) - S.dab.x, dy = floor(p / W) - S.dab.y;
        q = cl(sqrt(dx * dx + dy * dy) / S.dab.r, 0, 1);
      }
      S.bead[p] = 1;
      S.life[p] = S.life0[p] = L * (0.35 + 0.65 * (1 - q) + 0.25 * random());
      list.push(p);
    }
  }
  // The mesh holds only so much liquid at the surface. Past that, the beads
  // nearest their time go back in first, so a mark drains from its rim.
  const flood = S.flood > 0 ? sm(0.5, 0.42, S.flood) : S.extra;
  const target = round(BEADS * 2.2 ** S.press * (1 + 2.6 * flood));
  if (list.length > target) {
    list.sort((u, v) => S.life[u] - S.life[v]);
    for (let i = 0; i < list.length - target; i++) {
      S.bead[list[i]] = 0;
      S.wet[list[i]] = 1;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.press = cl(k[2], -1, 1);
  S.puff = cl(k[3], 0, 1);
  if (!S.warm) {
    // Open on a compact that has been dabbed for three seconds.
    const sp = S.speed;
    S.speed = 2;
    for (let i = 0; i < 90; i++) step(S, 1 / 30);
    S.speed = sp;
    S.warm = true;
  }
  if (input.btnPressed && input.btnPressed[0] && S.flood === 0) S.flood = 0.5;
  S.clock += d * S.speed;
  step(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const c = S.c, h = S.hue + 0.03;
  // A band of light slides down across the mesh every 7 s at Speed 2 and
  // turns the beads in it white; it changes colour only, never level.
  const u0 = -24 + 196 * ((S.clock / 14) % 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if ((x + y) & 1) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const p = y * W + x, du = (x * 0.8 + y * 0.6 - u0) / 7, g = exp(-du * du);
      if (S.bead[p]) {
        const age = cl(1 - S.life[p] / S.life0[p], 0, 1);
        hsv(h, (0.16 + 0.48 * age) * (1 - 0.85 * g), 1, c);
        display.setPixel(x, y, round(c[0] * 255), round(c[1] * 255), round(c[2] * 255));
      } else {
        const w = S.wet[p];
        hsv(h - 0.02 * w, (0.45 + 0.45 * w) * (1 - 0.6 * g), 1, c);
        display.setPixel(x, y, round(c[0] * 40), round(c[1] * 40), round(c[2] * 40));
      }
    }
}
