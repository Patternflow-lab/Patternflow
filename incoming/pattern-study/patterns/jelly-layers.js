// ===== Patternflow pattern =====
// Title:   Jelly Layers
// Family:  cosmetic
// Idea:    Sheer jelly polish is brushed down a milky white base in overlapping strokes, each a thin translucent coat with brush lines along it and a bead of polish along its edges; where coats overlap the colour deepens by multiplying, two coats the square of one, the brush lines level out over a few seconds, a gloss window and a passing band of shine sit on top, and every third pass a remover pad wipes the deepest band back to a faint stain.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Beer-Lambert absorption (Pierre Bouguer, 1729; August Beer, 1852), pattern round 40
// Round:   40
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Density=0.35..1.2, Matte=0..1
//
// Knob 1: Hue. The polish, once round the wheel. At 0 raspberry pink, at 0.1 cherry, at 0.2 tangerine, at 0.25 yellow, at 0.35 lime, at 0.5 jade, at 0.6 teal, at 0.75 cobalt, at 0.85 violet. From 0.12 (scarlet) to 0.32 (yellow-green) the grey part of the absorption is taken away, so a deep stack stays a bright colour and never goes brown or olive.
// Knob 2: Speed. At 2 the brush or the pad sets off every 1.6 s, two strokes and then a wipe, and crosses the panel in about 1.3 s; brush lines level with a time constant of 2.5 s. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Density. The optical depth of one coat. For the opening pink one coat passes 66% of the green, two coats 44% and three 29%; at 1.2 one coat passes 24% and two 6%, and the overlaps go to deep raspberry.
// Knob 4: Matte. At 0 a high gloss: a two-pane window reflected in the polish, bent where the coats change thickness, a band of shine running down every 5 s, and a bright rim on the bead edges that face the light. Turned up the reflections spread and fade, and at 1 a matte top coat leaves only a pale frosted veil over the colour.
// Buttons: K1 tap sends the next stroke or wipe at once.

const W = 64, H = 128, N = W * H;
// Live strokes kept apart while their brush marks level; older coats are
// baked into one field.
const SLOTS = 4;
// Seconds between passes (a stroke or a wipe) at Speed 2, brush and pad speed
// in LEDs a second, how long brush lines take to level, the age at which a
// coat is baked, the run before the first frame, and the shine's period.
const PER = 1.6, BRUSH = 120, LEVEL = 2.5, BAKE = 7, PREROLL = 9, SWEEP = 5;
// The bare base, a warm milky white; the grey part of the absorption; opening hue.
const BASE = [0.93, 0.91, 0.88], GREY = 0.18, H0 = 0.9;
const { floor, min, max, abs, sqrt, sin, cos, exp, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

export function setup(params) {
  const S = {
    t: 0, next: 0, n: 0, begun: false, hue: 0, speed: 2, dens: 0.35, matte: 0.06,
    St: new Float32Array(N), T: new Float32Array(N), Tb: new Float32Array(N), tmp: new Float32Array(N), strokes: [], wipes: [], col: [0, 0, 0],
  };
  for (let k = 0; k < SLOTS; k++) S.strokes.push({ live: false, cov: new Float32Array(N), rid: new Float32Array(N) });
  params.s = S;
}

// A gently bowed path down or up the panel at a small slant, through x = xm
// at mid height; s runs along it from where it enters, u across it.
function path(xm, ang, down, bow) {
  const ux = sin(ang) * (down ? 1 : -1), uy = cos(ang) * (down ? 1 : -1);
  const back = 70 / cos(ang);
  return { ux, uy, x0: xm - ux * back, y0: H / 2 - uy * back, len: 2 * back, bow };
}
const across = (P, dx, dy, s) => dx * P.uy - dy * P.ux - P.bow * sin((PI * s) / P.len);

// How much polish lies along the column at x.
function column(S, x) {
  let sum = 0;
  for (let y = 0; y < H; y += 2) sum += S.T[y * W + x];
  return sum;
}

function newStroke(S) {
  let st = S.strokes.find((q) => !q.live);
  if (!st) {
    // Every slot busy: bake the oldest now.
    st = S.strokes.reduce((a, b) => (a.age > b.age ? a : b));
    bake(S, st);
  }
  // The barest of three places.
  let xm = 0, least = 1e9;
  for (let k = 0; k < 3; k++) {
    const x = 6 + floor(random() * 52), c = column(S, x);
    if (c < least) {
      least = c;
      xm = x;
    }
  }
  const ang = (random() - 0.5) * 0.5;
  Object.assign(st, path(xm, ang, random() < 0.6, (random() - 0.5) * 10), {
    live: true, age: 0, sb: 0, hw: 7 + random() * 5, p1: random() * 2 * PI, p2: random() * 2 * PI, p3: random() * 2 * PI,
  });
  st.cov.fill(0);
  st.rid.fill(0);
}

function bake(S, st) {
  const St = S.St, { cov, rid } = st;
  for (let p = 0; p < N; p++) if (cov[p] > 0) St[p] += cov[p] * (1 + 0.06 * rid[p]);
  st.live = false;
}

// Lay the coat the brush has reached this step.
function paint(st, d) {
  const s0 = st.sb;
  st.sb = min(st.len + 20, st.sb + BRUSH * d);
  const { ux, uy, x0, y0, hw, cov, rid, len } = st, R = 0.7 * hw;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - x0, dy = y - y0, s = dx * ux + dy * uy;
      // Only the strip the brush front has touched, including its rounded front.
      if (s > st.sb || s < s0 - R - 1) continue;
      const u = across(st, dx, dy, s);
      if (abs(u) > hw + 1) continue;
      const e = st.sb - s, hwe = hw * sqrt(min(1, e / R)), q = abs(u) / max(hwe, 0.01);
      if (q >= 1) continue;
      // A flat coat with a soft edge, a bead of polish along each edge, and
      // more polish where the stroke starts than where it ends.
      const body = 1 - sm(0.78, 1, q), bead = 0.5 * exp(-(((q - 0.87) / 0.07) ** 2));
      const fp = (body + bead) * (1.2 - 0.4 * (s / len));
      const p = y * W + x;
      if (fp > cov[p]) {
        cov[p] = fp;
        // Brush marks: lines along the stroke, a few LEDs apart.
        rid[p] = 0.6 * sin((2 * PI * u) / 3.4 + st.p1 + 0.5 * sin(s * 0.05 + st.p3)) + 0.4 * sin((2 * PI * u) / 5.3 + st.p2);
      }
    }
}

// A remover pad along a path takes 94% of every coat under it, in streaks.
function wipe(S, w, d) {
  const s0 = w.sb;
  w.sb += BRUSH * d;
  const { ux, uy, x0, y0, hw } = w, R = 0.8 * hw, fields = [S.St];
  for (const st of S.strokes) if (st.live) fields.push(st.cov);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - x0, dy = y - y0, s = dx * ux + dy * uy;
      if (s > w.sb || s < s0 - R) continue;
      const u = across(w, dx, dy, s), q = abs(u) / hw;
      if (q >= 1) continue;
      // The pad's front is round: an LED is wiped once, when the front reaches it.
      const lag = R * q * q;
      if (w.sb - s < lag || s0 - s >= lag) continue;
      const m = (1 - sm(0.7, 1, q)) * (0.94 + 0.06 * sin((2 * PI * u) / 2.7 + w.p1)), k = 1 - 0.94 * m, p = y * W + x;
      for (const F of fields) F[p] *= k;
    }
}

function step(S, d) {
  S.t += d;
  if (S.t >= S.next) {
    S.next = S.t + PER;
    // Two strokes, then one wipe where the polish is deepest.
    if (S.n % 3 === 2) {
      let best = -1, bx = 32;
      for (let x = 8; x < 56; x += 2) {
        const c = column(S, x);
        if (c > best) {
          best = c;
          bx = x;
        }
      }
      const ang = (random() - 0.5) * 0.3;
      S.wipes.push(Object.assign(path(bx, ang, random() < 0.5, (random() - 0.5) * 6), { sb: 0, hw: 15, p1: random() * 2 * PI }));
    } else newStroke(S);
    S.n++;
  }
  for (const st of S.strokes)
    if (st.live) {
      st.age += d;
      if (st.sb < st.len + 20) paint(st, d);
      else if (st.age > BAKE) bake(S, st);
    }
  for (const w of S.wipes) wipe(S, w, d);
  S.wipes = S.wipes.filter((w) => w.sb < w.len + 20);
  // The total thickness, in coats, with the brush marks of the live coats
  // levelling out as they age.
  const T = S.T;
  T.set(S.St);
  for (const st of S.strokes)
    if (st.live) {
      const a = 0.3 * exp(-st.age / LEVEL) + 0.06, { cov, rid } = st;
      for (let p = 0; p < N; p++) if (cov[p] > 0) T[p] += cov[p] * (1 + a * rid[p]);
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.35, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.dens = cl(k[2], 0.35, 1.2);
  S.matte = cl(k[3], 0, 1);
  if (!S.begun) {
    for (let i = 0; i < PREROLL * 30; i++) step(S, 1 / 30);
    S.begun = true;
  }
  // K1 sends the next stroke or wipe now.
  if (input.btnPressed && input.btnPressed[0]) S.next = S.t;
  step(S, (d * S.speed) / 2);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { T, Tb, tmp, col } = S, h = S.hue + H0, hh = h - floor(h);
  hsv(h, 1, 1, col);
  // Orange, yellow and lime would go brown or olive where the coats stack
  // deep, so there the grey part of the absorption is taken away.
  const warm = 1 - sm(0.1, 0.18, min(abs(hh - 0.12), 1 - abs(hh - 0.12)));
  const g = GREY * (1 - warm), D = S.dens;
  // Absorbance per coat in each channel: what the hue does not pass, plus grey.
  const ar = D * (1 - col[0] + g), ag = D * (1 - col[1] + g), ab = D * (1 - col[2] + g);
  // The surface for the gloss: the thickness smoothed over 3 x 3 LEDs.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) tmp[y * W + x] = (T[y * W + max(0, x - 1)] + T[y * W + x] + T[y * W + min(W - 1, x + 1)]) / 3;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) Tb[y * W + x] = (tmp[max(0, y - 1) * W + x] + tmp[y * W + x] + tmp[min(H - 1, y + 1) * W + x]) / 3;
  const mt = S.matte, xl = 22 + 11 * sin(S.t * 0.35), gl = 1 - 0.9 * mt, soft = 0.7 + 4 * mt;
  // Every SWEEP seconds a light passes down the panel on a slant, and its
  // reflection runs down the coats as a band of shine.
  const ph = (S.t % SWEEP) / 2.2, yb = -30 + ph * 190;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, tau = T[p];
      // Beer-Lambert: transmittance multiplies, so n coats are the nth power of one.
      let r = BASE[0] * exp(-ar * tau), gg = BASE[1] * exp(-ag * tau), b = BASE[2] * exp(-ab * tau);
      // Gloss: a tall window, two panes, reflected in the polish and bent by its slope.
      const gx = Tb[y * W + min(W - 1, x + 1)] - Tb[y * W + max(0, x - 1)], coat = sm(0.05, 0.35, tau);
      const gy = Tb[min(H - 1, y + 1) * W + x] - Tb[max(0, y - 1) * W + x];
      const xs = x + 3 * gx - xl;
      const pane = sm(-2.2 - soft, -2.2 + soft, xs) * (1 - sm(2.2 - soft, 2.2 + soft, xs)) + 0.5 * sm(4.6 - soft, 4.6 + soft, xs) * (1 - sm(6 - soft, 6 + soft, xs));
      const ys = y + 0.35 * x + 4 * gy - yb, band = ph < 1 ? exp(-((ys / (3 + 6 * mt)) ** 2)) : 0;
      // The bead along a stroke's edge catches the room light from the upper
      // left as a thin bright rim on the side that faces it.
      const rim = sm(0.06, 0.2, 0.3 * gx + 0.4 * gy);
      const spec = coat * gl * (0.9 * pane + 0.75 * band + 0.55 * rim);
      // A matte top coat scatters a pale veil over the colour.
      const veil = coat * 0.32 * mt;
      r += (1 - r) * min(1, spec + veil);
      gg += (1 - gg) * min(1, spec + veil);
      b += (1 - b) * min(1, spec + veil);
      display.setPixel(x, y, round(255 * r), round(255 * gg), round(255 * b));
    }
}
