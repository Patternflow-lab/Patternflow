// ===== Patternflow pattern =====
// Title:   Lantern Procession
// Family:  halloween
// Idea:    On a black night a line of hooded walkers with lanterns hung from crooked staffs winds up a path from the foot of the panel to a hilltop near the top, smaller and dimmer the further they go, each lantern a soft warm halo swinging with its walker's steps and each dark robe rimmed with its light and standing in a pool of glowing mist, while now and then a gust runs up the line ducking the flames, a lantern gutters out and a cold green ghost-lantern walks on in its place with a faint green figure under it, and the walkers at the top fade into the fog.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 46
// Round:   46
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Walkers=8..24, Fog=0..1
//
// Knob 1: Hue. The colour of the lanterns and of the light they throw, the ghost-lanterns a quarter of the way on round the wheel. At 0 amber lanterns and green ghosts; at 0.25 lime lanterns and cyan ghosts, at 0.31 the living lanterns themselves ghost green, at 0.5 aqua with violet ghosts, at 0.75 blue with pink ghosts and at 1 violet with orange ones.
// Knob 2: Speed. At 2 a walker climbs the whole path in 28 s at about 1.8 steps a second, its lantern swinging once every two steps; a gust runs up the line every 7 to 11 s and a lantern gutters every 6 to 10 s, flickering down for 1.4 s, dark for 0.9 s and lit again as a ghost over 0.6 s. At 0.2 all of it runs ten times slower, at 3 half as fast again.
// Knob 3: Walkers. How many walk the path, 8 to 24, spread evenly along it, so 8 put seven or eight lanterns in view at once, 16 about fifteen and 24 a close line of 21 or 22 from the foot to the top; a walker is 23 LEDs tall near the foot and 6 at the hilltop. At most a quarter of them are ghosts at once, and a ghost that goes over the top comes round again at the foot with a living lantern.
// Knob 4: Fog. At 0 the night is clear: a lantern near the hilltop keeps 74% of its light and the glow in the air round each lantern spreads 0.42 of its walker's height. At 0.06 the hilltop lanterns keep 65% and faint banks start to drift across. At 1 they keep 9% and are lost, every glow spreads 60% wider and shines twice as bright, the pools of mist on the ground more than twice, and a drifting haze stands in front of the whole procession, thickest up the hill.
// Buttons: K1 tap turns the nearest lantern wholly in view into a ghost: it gutters for 0.4 s, is dark for 0.3 s and lights green.

const W = 64, H = 128, N = W * H;
const { floor, ceil, round, min, max, abs, exp, log, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The path in perspective. A walker's place on it is u, 0 at the foot of
// the panel and 1 at the hilltop; it stands 1 + PK*u times further off than
// at the foot, so it is that much smaller, and its feet are at pathY(u),
// which runs from row Y0 (just under the panel) to row 18 at u = 1.
const Y0 = 134, YK = 68, PK = 4.5, SPAN = 1.16, UIN = -0.12;
const depth = (u) => 1 + PK * max(0, u);
const pathY = (u) => (u < 0 ? Y0 - YK * PK * u : Y0 - YK * log(1 + PK * u));
const pathX = (u) => 32 + (23 * sin(2 * PI * 1.55 * u + 0.45) - 3) / depth(u) + 2;
const uOfY = (y) => (exp((Y0 - y) / YK) - 1) / PK;
// A walker's height in LEDs at the foot of the panel.
const TALL = 34;
// The ridge the path goes over, row by row across the panel.
const CREST = pathY(1);
const ridge = (x) => CREST - 0.6 + 0.0045 * (x - pathX(1)) ** 2 + 0.9 * sin(x * 0.19 + 1.3);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// A hooded robe seen from behind: half its width at heights 0 (the hem) to
// 1 (the hood's point), in walker heights.
const PROF_T = [0, 0.05, 0.4, 0.62, 0.69, 0.75, 0.83, 0.9, 0.96, 1];
const PROF_W = [0.23, 0.235, 0.19, 0.195, 0.165, 0.12, 0.135, 0.115, 0.055, 0];
function prof(t) {
  if (t <= 0 || t >= 1) return t <= 0 ? PROF_W[0] : 0;
  let i = 1;
  while (PROF_T[i] < t) i++;
  const a = (t - PROF_T[i - 1]) / (PROF_T[i] - PROF_T[i - 1]);
  return PROF_W[i - 1] + (PROF_W[i] - PROF_W[i - 1]) * a;
}

// Lantern states: lit, guttering, out, ghost.
const LIT = 0, GUTTER = 1, OUT = 2, GHOST = 3;

function walker(u) {
  return {
    u, side: Math.random() < 0.5 ? -1 : 1, ph: Math.random() * 2, jx: (Math.random() - 0.5) * 3,
    sw: 0.35 + Math.random() * 0.2, state: LIT, st: 0, gut: 1.4, outT: 0.9,
    f1: Math.random() * 7, f2: Math.random() * 7, f3: Math.random() * 7, cad: 0.9 + Math.random() * 0.2,
  };
}

export function setup(params) {
  params.s = {
    begun: false, t: 0, hue: 0, speed: 1, n: 0, fog: 0.06, ws: [], next: 3.2, gust: -1, gustWait: 2.2,
    L: new Float32Array(N * 3), stars: [],
    lc: [0, 0, 0], gc: [0, 0, 0], tmp: [0, 0, 0],
  };
  const S = params.s;
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * W;
    S.stars.push({ x: floor(x), y: floor(Math.random() * (ridge(x) - 2)), a: 8 + Math.random() * 14, f: Math.random() * 7, w: 0.8 + Math.random() * 2 });
  }
}

function build(S, n) {
  S.n = n;
  const ws = [], off = S.ws.length ? S.ws[0].u : 0.0;
  for (let i = 0; i < n; i++) {
    let u = off + (i * SPAN) / n + (Math.random() - 0.5) * (0.25 * SPAN) / n;
    while (u > UIN + SPAN) u -= SPAN;
    const w = walker(u);
    // Staffs on alternate sides down the line, now and then two together.
    w.side = i % 2 ? 1 : -1;
    if (Math.random() < 0.2) w.side = -w.side;
    ws.push(w);
  }
  S.ws = ws;
}

function ghosts(S) {
  let g = 0;
  for (const w of S.ws) if (w.state !== LIT) g++;
  return g;
}

// A lit lantern in view begins to gutter: a random one in the nearer half
// of the path, or with the button the nearest one wholly in view, quickly.
function gutter(S, quick) {
  const c = S.ws.filter((w) => w.state === LIT && w.u > (quick ? 0.07 : 0.04) && w.u < (quick ? 0.85 : 0.55));
  if (!c.length) return;
  c.sort((a, b) => a.u - b.u);
  const w = quick ? c[0] : c[floor(Math.random() * c.length)];
  w.state = GUTTER;
  w.st = 0;
  w.gut = quick ? 0.4 : 1.4;
  w.outT = quick ? 0.3 : 0.9;
}

function step(S, dt) {
  S.t += dt;
  // At Speed 2 a walker climbs the whole path in 28 s and takes 1.8 steps a second.
  const du = (SPAN / 28) * dt;
  for (const w of S.ws) {
    w.u += du;
    w.ph += 1.8 * w.cad * dt;
    w.st += dt;
    if (w.state === GUTTER && w.st > w.gut) (w.state = OUT), (w.st = 0);
    else if (w.state === OUT && w.st > w.outT) (w.state = GHOST), (w.st = 0);
    // Over the hilltop and into the fog: the walker comes round again at the
    // foot of the path with a lit lantern.
    if (w.u > UIN + SPAN) {
      w.u -= SPAN;
      w.state = LIT;
      w.side = Math.random() < 0.5 ? -1 : 1;
    }
  }
  // A gust of wind runs up the line from the foot of the path, 0.9 of the
  // path a second, every 7 to 11 s.
  S.gustWait -= dt;
  if (S.gustWait <= 0) (S.gust = UIN), (S.gustWait = 7 + Math.random() * 4);
  if (S.gust > -1) S.gust = S.gust > 1.3 ? -1 : S.gust + 0.9 * dt;
  S.next -= dt;
  if (S.next <= 0) {
    S.next = 6 + Math.random() * 4;
    if (ghosts(S) < max(1, round(S.n * 0.25))) gutter(S, false);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 8, 0.06];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3) / 2;
  S.fog = cl(k[3], 0, 1);
  const n = cl(round(k[2]), 8, 24);
  if (n !== S.n) build(S, n);
  if (!S.begun) S.begun = true;
  if (input.btnPressed && input.btnPressed[0]) gutter(S, true);
  step(S, cl(dt || 0, 0, 0.1) * S.speed);
}

// The lantern's brightness now, 0..1. Wind does not touch a ghost's light.
function flame(S, w) {
  const t = S.t;
  let fl = 0.74 + 0.11 * sin(t * 9.1 + w.f1) + 0.08 * sin(t * 14.3 + w.f2) + 0.07 * sin(t * 22.7 + w.f3);
  // As the gust reaches a lantern its flame ducks to half and flares after.
  if (S.gust > -1) {
    const g = (w.u - S.gust) / 0.05, f = (w.u - S.gust + 0.13) / 0.07;
    fl *= 1 - 0.5 * exp(-g * g) * (0.8 + 0.2 * sin(t * 31 + w.f1)) + 0.18 * exp(-f * f);
  }
  if (w.state === LIT) return fl;
  if (w.state === GUTTER) {
    const p = w.st / w.gut;
    return fl * (1 - p) * (0.55 + 0.45 * abs(sin(t * 17 + w.f1 * 3) * sin(t * 6.3 + w.f2)));
  }
  if (w.state === OUT) return 0;
  return sm(0, 0.6, w.st) * (0.78 + 0.16 * sin(t * 2.3 + w.f1) + 0.06 * sin(t * 7.7 + w.f2));
}

function add(L, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  L[o] += r;
  L[o + 1] += g;
  L[o + 2] += b;
}

// A soft elliptical glow, amplitude a (0..255) of colour c, sx and sy wide;
// with wisp > 0 it is mist, drifting thicker and thinner through it.
function glow(L, cx, cy, sx, sy, a, c, wisp = 0, t = 0) {
  if (a < 0.5) return;
  const rx = sx * 3, ry = sy * 3;
  const x0 = max(0, floor(cx - rx)), x1 = min(W - 1, ceil(cx + rx)), y0 = max(0, floor(cy - ry)), y1 = min(H - 1, ceil(cy + ry));
  const kx = 1 / (2 * sx * sx), ky = 1 / (2 * sy * sy);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy, ey = exp(-dy * dy * ky) * a;
    if (ey < 0.3) continue;
    const o = y * W * 3;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      let v = ey * exp(-dx * dx * kx);
      if (wisp) v *= 1 - wisp * (0.5 + 0.5 * sin(x * 0.45 + y * 0.21 + t * 2.9) * sin(x * 0.17 - y * 0.52 - t * 2.1));
      const p = o + x * 3;
      L[p] += c[0] * v;
      L[p + 1] += c[1] * v;
      L[p + 2] += c[2] * v;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.begun) return;
  const L = S.L, t = S.t, fog = S.fog;
  L.fill(0);
  hsv(0.085 + 0.7 * S.hue, 0.82, 1, S.lc);
  hsv(0.085 + 0.7 * S.hue + 0.27, 0.7, 1, S.gc);
  // The sky over the ridge, deep violet, a little lighter down at the
  // ridge; faint stars; the hillside under it nearly black, and the path a
  // pale ribbon on it.
  for (let x = 0; x < W; x++) {
    const yr = ridge(x);
    for (let y = 0; y < H; y++) {
      const o = (y * W + x) * 3;
      if (y + 0.5 < yr) {
        const v = 5 + 9 * (y / yr);
        L[o] = v * 0.55;
        L[o + 1] = v * 0.4;
        L[o + 2] = v;
      } else {
        L[o] = 2.2;
        L[o + 1] = 1.6;
        L[o + 2] = 3;
      }
    }
  }
  for (const s of S.stars) {
    const v = s.a * (0.6 + 0.4 * sin(t * s.w + s.f));
    if (s.y + 1 < ridge(s.x)) add(L, s.x, s.y, v * 0.8, v * 0.8, v);
  }
  for (let y = ceil(CREST); y < H; y++) {
    const u = uOfY(y + 0.5), d = depth(u), cx = pathX(u), hw = 4.5 / d + 0.6;
    const x0 = max(0, floor(cx - hw - 1)), x1 = min(W - 1, ceil(cx + hw + 1));
    for (let x = x0; x <= x1; x++) {
      const a = cl(hw - abs(x + 0.5 - cx) + 0.5, 0, 1);
      if (y + 0.5 < ridge(x)) continue;
      const o = (y * W + x) * 3, v = a * (8 + 4 / d);
      L[o] += v * 0.75;
      L[o + 1] += v * 0.62;
      L[o + 2] += v * 0.7;
    }
  }
  // How fast the night and the fog swallow light up the path.
  const dens = 0.25 + 1.8 * fog;
  // Walkers, the furthest first, so the nearer stand in front.
  const order = S.ws.slice().sort((a, b) => b.u - a.u);
  const c = S.tmp;
  for (const w of order) {
    const u = w.u, d = depth(u), hs = TALL / d;
    const fy0 = pathY(u);
    if (fy0 - 1.3 * hs > H + 2) continue;
    const ghost = w.state === GHOST, I = flame(S, w);
    // Far walkers fade into the night and the fog; over the top they are gone.
    const att = exp(-dens * max(0, u) * 1.4) * (u > 0.86 ? sm(1.02, 0.86, u) : 1);
    if (att < 0.01) continue;
    const step = w.ph * PI, bob = ghost ? 0.03 * hs * sin(t * 1.7 + w.f1) : 0.025 * hs * abs(sin(step));
    const fx = pathX(u) + w.jx / d, fy = fy0 - bob - (ghost ? 0.05 * hs : 0);
    const col = ghost ? S.gc : S.lc;
    // The lantern hangs from the tip of a staff held out to one side, at
    // head height, and swings with the steps.
    const th = w.sw * sin(step + 0.4);
    const tx = fx + w.side * 0.33 * hs, ty = fy - 1.2 * hs;
    const lx = tx + sin(th) * 0.17 * hs, ly = ty + cos(th) * 0.17 * hs;
    const Ia = I * att;
    const sg = max(1.1, 0.13 * hs), A = min(240, 90 * sg) * Ia, sa = (0.42 + 0.25 * fog) * hs + 1;
    // The pool of light the lantern throws on the ground and the mist round
    // the walker's feet; the halo, and the glow in the air round it that
    // the hood stands dark against. All of it is behind the walker.
    glow(L, fx + 0.3 * (lx - fx), fy - 0.08 * hs, 0.62 * hs + 1, 0.2 * hs + 0.6, 46 * Ia * (0.6 + 0.8 * fog), col, 0.45, t);
    glow(L, lx, ly + 0.1 * hs, sa, sa * 1.1, A * 0.22 * (1 + fog), col, 0.3, t);
    glow(L, lx, ly, sg, sg * 1.25, A, col);
    // The robe: a dark shape that hides most of the light behind it, warmed
    // on the lantern's side. A ghost lets most of it through.
    const op = (ghost ? 0.75 : 1) * min(1, att * 1.6), front = ghost ? 0.5 : 0.07;
    const soft = max(1, 0.07 * hs), y0 = max(0, floor(fy - hs)), y1 = min(H - 1, floor(fy));
    const sig2 = 2 * (0.6 * hs) ** 2;
    for (let y = y0; y <= y1; y++) {
      const tt = (fy - (y + 0.5)) / hs;
      // The hem swings a little with each step; a ghost's hem trails away.
      const sway = tt < 0.3 ? (0.3 - tt) * 0.06 * hs * sin(step) : 0;
      // The sleeve of the arm that holds the staff stands out on that side.
      const hw = prof(tt) * hs, cxr = fx + sway, sl = 0.07 * hs * sm(0.4, 0.5, tt) * sm(0.68, 0.58, tt);
      const hem = ghost ? sm(0, 0.35, tt) : 1;
      const x0 = max(0, floor(cxr - hw - 2)), x1 = min(W - 1, ceil(cxr + hw + 2));
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cxr, hx = hw + (dx * w.side > 0 ? sl : 0), a = cl((hx - abs(dx)) / soft + 0.5, 0, 1) * op * hem;
        if (a <= 0) continue;
        const ddx = x + 0.5 - lx, ddy = y + 0.5 - ly;
        const near = exp(-(ddx * ddx + ddy * ddy) / sig2);
        // A rim of light down the edge on the lantern's side, a band of about
        // an LED and a half; the rest of the robe stays dark.
        const e = dx * w.side > 0 ? sm(soft + 0.08 * hs, 0, hx - abs(dx)) : 0;
        const rim = 150 * Ia * near * (0.04 + 0.96 * e);
        const o = (y * W + x) * 3, k = 1 - a * (1 - front);
        // A ghost's robe glows faintly from inside in its lantern's colour,
        // most at the hood; a living walker's is a dark violet-grey.
        const gl = ghost ? 30 * Ia * (0.35 + 0.65 * tt) : 0;
        L[o] = L[o] * k + a * (4 + gl * col[0] + rim * col[0]);
        L[o + 1] = L[o + 1] * k + a * (2.8 + gl * col[1] + rim * col[1]);
        L[o + 2] = L[o + 2] * k + a * (5 + gl * col[2] + rim * col[2]);
      }
    }
    // The staff, straight up from the hand to the crook the lantern hangs
    // from, dark against the glow.
    if (hs > 7) {
      const ax = fx + w.side * 0.2 * hs, ay = fy - 0.5 * hs, m = ceil(2 * hs * 0.75);
      let last = -1;
      const k = ghost ? 0.85 : 0.6;
      for (let i = 0; i <= m; i++) {
        // Up the shaft for the first four fifths, then out along the crook.
        const f = i / m, x = floor(f < 0.8 ? ax : ax + ((tx - ax) * (f - 0.8)) / 0.2), y = floor(f < 0.8 ? ay + ((ty - ay) * f) / 0.8 : ty);
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const o = (y * W + x) * 3;
        if (o === last) continue;
        last = o;
        L[o] *= k;
        L[o + 1] *= k;
        L[o + 2] *= k;
      }
    }
    // The lantern itself in front: a whiter core.
    c[0] = 1;
    c[1] = 0.88;
    c[2] = 0.68;
    if (ghost) (c[0] = 0.75), (c[1] = 1), (c[2] = 0.85);
    glow(L, lx, ly, sg * 0.55, sg * 0.7, A * 0.35, c);
  }
  // The fog in front of it all: banks drifting across, thicker up the hill,
  // a dim grey-violet.
  for (let y = 0; y < H && fog > 0.004; y++) {
    const far = 1 - sm(20, 120, y);
    for (let x = 0; x < W; x++) {
      const n = 0.5 + 0.3 * sin(x * 0.09 + y * 0.045 + t * 0.31) + 0.2 * sin(x * 0.043 - y * 0.12 - t * 0.23);
      const v = fog * n * (5 + 11 * far);
      const o = (y * W + x) * 3;
      L[o] += v * 0.8;
      L[o + 1] += v * 0.75;
      L[o + 2] += v;
    }
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    let r = L[o], g = L[o + 1], b = L[o + 2];
    if (r + g + b < 1.5) continue;
    // A soft shoulder above 190, and every channel in steps of 4.
    r = r < 190 ? r : 190 + 65 * (1 - exp(-(r - 190) / 65));
    g = g < 190 ? g : 190 + 65 * (1 - exp(-(g - 190) / 65));
    b = b < 190 ? b : 190 + 65 * (1 - exp(-(b - 190) / 65));
    display.setPixel(p % W, (p / W) | 0, round(r / 4) * 4, round(g / 4) * 4, round(b / 4) * 4);
  }
}
