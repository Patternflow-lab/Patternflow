// ===== Patternflow pattern =====
// Title:   Paper Lantern Ghost
// Family:  halloween
// Idea:    On a rainy purple night a ribbed paper lantern swings from an eave until one big eye opens on it and its seam tears into a wide grin with a long red tongue lolling out, while below a one-eyed paper umbrella hops on its single leg back and forth across the wet ground, tongue out, splashing the puddles that carry the lantern's light.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 50
// Round:   50
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Rain=0..1, Hop=0..1
//
// Knob 1: Hue. The lantern's light: the paper, its halo, the rain it lights and its reflection in the puddles. Orange at 0, green at 0.25, sky blue at 0.5, magenta at 0.75; the umbrella stays toxic green and the tongues red.
// Knob 2: Speed. Everything's clock, rain included. At the opening 2 the eye opens at 0.8 s, the grin tears open at 1.2 s, the tongue is out by 2.4 s, the eye blinks at 4.6 s and the face closes back into a plain lantern at 7.4 s before it starts again at 9 s; the umbrella hops every 0.6 s. At 0.2 ten times slower, at 3 half again as fast.
// Knob 3: Rain. At 0 a steady rain of 90 short streaks falling nearly straight; at 1 a downpour of 420 longer ones driven slantwise by the wind. Each drop that lands rings a puddle or splashes the stones.
// Knob 4: Hop. How high and far the umbrella hops: 10 LEDs up and 8 along at 0, a little more at the opening 0.06, 46 up and 18 along at 1, high enough to reach the lantern's tongue, each hop longer in the air.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const ease = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const hsv = (h, s, o) => [5, 3, 1].forEach((n, c) => {
  const k = (n + (h - floor(h)) * 6) % 6;
  o[c] = 255 * (1 - s * max(0, min(k, 4 - k, 1)));
});

const PX = 32, PY = 9, LC = 27, GROUND = 110, FOOT = 117;
// Puddles on the stones: [x, y, half width, half height].
const PUDDLES = [[13, 116, 11, 2.6], [46, 120.5, 13, 3], [24, 125.5, 9, 1.8]];
const inPuddle = (x, y) => PUDDLES.some(([a, b, c, d]) => ((x - a) / c) ** 2 + ((y - b) / d) ** 2 < 1);

export function setup(params) {
  params.s = {
    hue: -1, t: 0, ph: 0, th: 0, wind: 0, L: [0, 0, 0], paper: [0, 0, 0],
    bg: new Float32Array(N * 3), buf: new Float32Array(N * 3),
    // The tongue: a hanging chain, each point with where it was last frame.
    tg: Array.from({ length: 8 }, () => [PX, PY + LC + 8, PX, PY + LC + 8]),
    // The umbrella: where it took off and where it lands, the way it faces,
    // and how far through the hop it is.
    U: { x0: 12, x1: 21, dir: 1, p: 0.1, x: 12, y: 0, tilt: 0, sq: 1, leg: 13 },
    drops: [], rings: [], bits: [],
    face: { eye: 0, mouth: 0, tongue: 0 },
  };
  background(params.s);
}

// A new drop, upwind far enough that the wind carries some to every column.
function drop(top, wind) {
  return { x: Math.random() * (66 + wind * 140) - wind * 140, y: top ? Math.random() * -30 : Math.random() * FOOT, v: 95 + Math.random() * 40, fy: GROUND + Math.random() * 17, len: 3 + floor(Math.random() * 3 + wind * 8) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const hue = cl(k[0], 0, 1), rain = cl(k[2], 0, 1), hop = cl(k[3], 0, 1);
  const d = cl(dt || 0, 0, 0.1) * (cl(k[1], 0.2, 3) / 2);
  if (hue !== S.hue) {
    S.hue = hue;
    hsv(0.075 + hue, 0.78, S.L);
    // The paper glows paler than the light it gives.
    for (let c = 0; c < 3; c++) S.paper[c] = mix(S.L[c], [255, 246, 214][c], 0.5);
  }
  S.t += d;
  // The face, on a 9 s loop: the eye opens, the seam tears into a grin, the
  // tongue lolls out; a blink; then it all closes up again.
  const tau = S.t % 9, F = S.face;
  F.eye = ease((tau - 0.8) / 0.3) * (1 - ease((tau - 7.9) / 0.3)) * (1 - sin(PI * cl((tau - 4.6) / 0.25, 0, 1)));
  F.mouth = ease((tau - 1.2) / 0.5) * (1 - ease((tau - 7.4) / 0.5));
  F.tongue = 25 * ease((tau - 1.5) / 0.9) * (1 - ease((tau - 6.9) / 0.6));
  // The swing: wider while the face is open.
  S.ph += d * 1.8;
  S.th = (0.15 + 0.1 * F.mouth) * sin(S.ph) + 0.04 * sin(S.ph * 1.7 + 1);
  // The tongue hangs from the lower lip and swings behind the lantern.
  const [ax, ay] = toWorld(S.th, 0.5, LC + 6 + 4 * F.mouth), seg = F.tongue / 7, g = 140 * d * d;
  S.tg[0] = [ax, ay, ax, ay];
  for (let i = 1; i < 8; i++) {
    const p = S.tg[i], vx = (p[0] - p[2]) * 0.94, vy = (p[1] - p[3]) * 0.94;
    (p[2] = p[0]), (p[3] = p[1]);
    (p[0] += vx), (p[1] += vy + g);
  }
  for (let n = 0; n < 3; n++)
    for (let i = 1; i < 8; i++) {
      const a = S.tg[i - 1], b = S.tg[i], dx = b[0] - a[0], dy = b[1] - a[1], l = sqrt(dx * dx + dy * dy) || 1;
      (b[0] = a[0] + (dx / l) * seg), (b[1] = a[1] + (dy / l) * seg);
    }
  // The umbrella: crouch, a parabola from one landing to the next, a squash
  // on landing; it turns round at either side.
  const U = S.U, P = 0.55 + 0.45 * hop, hh = 10 + 36 * hop, step = 8 + 10 * hop, was = U.p;
  U.p += d / P;
  if (U.p >= 1) {
    U.p -= 1;
    U.x0 = U.x1;
    if (U.x0 + U.dir * step > 54 || U.x0 + U.dir * step < 10) U.dir = -U.dir;
    U.x1 = U.x0 + U.dir * step;
  }
  const a = cl((U.p - 0.2) / 0.65, 0, 1), cr = U.p < 0.2 ? sin((PI * U.p) / 0.2) : U.p > 0.85 ? sin((PI * (U.p - 0.85)) / 0.15) : 0;
  U.x = mix(U.x0, U.x1, a);
  U.y = -hh * 4 * a * (1 - a);
  U.tilt = 0.16 * U.dir * sin(PI * a);
  U.sq = 1 - 0.16 * cr + 0.06 * sin(PI * a);
  U.leg = 13 - 5 * cr;
  if (was < 0.85 && U.p >= 0.85) {
    // Landing: a ring in the puddle and a spray of drops.
    S.rings.push([U.x, FOOT, 0, 1.6]);
    for (let i = 0; i < 12; i++) S.bits.push([U.x + (Math.random() - 0.5) * 8, FOOT - 1, (Math.random() - 0.5) * 50, -25 - Math.random() * 35, 0]);
  }
  // Rain, its rings in the puddles and splashes on the stones.
  const want = round(90 + 330 * rain), wind = (S.wind = 0.08 + 0.32 * rain);
  while (S.drops.length < want) S.drops.push(drop(false, wind));
  if (S.drops.length > want) S.drops.length = want;
  for (const r of S.drops) {
    r.y += r.v * d;
    r.x += r.v * d * wind;
    if (r.y > r.fy) {
      if (inPuddle(r.x, r.fy)) S.rings.length < 60 && S.rings.push([r.x, r.fy, 0, 1]);
      else if (S.bits.length < 120) S.bits.push([r.x, r.fy, (Math.random() - 0.5) * 20, -18, 0.25]);
      Object.assign(r, drop(true, wind));
    }
  }
  S.rings = S.rings.filter((r) => (r[2] += d) < 0.45 * r[3]);
  S.bits = S.bits.filter((b) => {
    b[0] += b[2] * d;
    b[1] += b[3] * d;
    b[3] += 160 * d;
    return (b[4] += d) < 0.55 && b[1] < FOOT + 2;
  });
}
const toWorld = (th, x, y) => [PX + x * cos(th) - y * sin(th), PY + x * sin(th) + y * cos(th)];

// --- the night, laid out once: the eave of a roof along the top with a row
// of round tile ends, a purple sky stepping lighter downward, a bamboo fence,
// wet paving with three puddles.
function background(S) {
  const bg = S.bg;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, v = floor(cl((y - 8) / 84, 0, 1) * 12) / 12;
      let r = 34 + 60 * v, g = 20 + 40 * v, b = 62 + 76 * v;
      const te = (((x + 3) % 6) - 2.5) ** 2 + (y - 2.5) ** 2;
      if (y < 8) {
        // Round tile ends along the roof's edge over a dark beam.
        const rim = (y < 4 && te > 3 && te < 7.5) || y === 7;
        (r = rim ? 76 : 20), (g = rim ? 52 : 12), (b = rim ? 96 : 28);
      } else if (y >= 88 && y < GROUND) {
        // Slats of split bamboo, two bindings across.
        const slat = x % 3 !== 2 || y < 90, bind = abs(y - 93) < 1 || abs(y - 104) < 1;
        if (slat || bind) (r = bind ? 46 : 16), (g = bind ? 30 : 10), (b = bind ? 52 : 24);
        if (y === 88 && slat) (r = 70), (g = 50), (b = 90);
      } else if (y >= GROUND) {
        const joint = (y - GROUND) % 6 === 5 || (x + (floor((y - GROUND) / 6) & 1) * 5) % 10 === 0;
        (r = joint ? 16 : 34), (g = joint ? 10 : 22), (b = joint ? 24 : 46);
        if (inPuddle(x + 0.5, y + 0.5)) (r = 62), (g = 44), (b = 104);
      }
      bg[o] = r;
      bg[o + 1] = g;
      bg[o + 2] = b;
    }
}

const put = (buf, o, c) => {
  buf[o] = c[0];
  buf[o + 1] = c[1];
  buf[o + 2] = c[2];
};
const addc = (buf, o, c, a) => {
  buf[o] += c[0] * a;
  buf[o + 1] += c[1] * a;
  buf[o + 2] += c[2] * a;
};
const RAIN = [110, 100, 170], BLACK = [18, 8, 22], WHITE = [255, 250, 236], GULLET = [70, 0, 22], TONGUE = [244, 62, 96], GROOVE = [186, 26, 66];
const GREEN = [120, 236, 44], GREEN2 = [74, 178, 26], RIB = [30, 80, 20], SKIN = [244, 208, 172];

// The lantern in its own frame, hung from the hook: a barrel of paper 26
// wide between two black lacquered caps, ribbed every 3.3 LEDs.
function lantern(S, buf) {
  const F = S.face, th = S.th, c = cos(th), s = sin(th), L = S.L, Pp = S.paper;
  // Where the eye looks: at the umbrella.
  const [cx, cy] = toWorld(th, 0, LC), ux = S.U.x - cx, uy = FOOT - 20 + S.U.y - cy, ul = sqrt(ux * ux + uy * uy) || 1;
  const lx0 = ((ux * c + uy * s) / ul) * 2.4, ly0 = ((-ux * s + uy * c) / ul) * 1.8;
  for (let y = PY; y < PY + 54; y++)
    for (let x = 6; x < 58; x++) {
      const dx = x + 0.5 - PX, dy = y + 0.5 - PY, bx = dx * c + dy * s, by = -dx * s + dy * c - LC, o = (y * W + x) * 3;
      if (by < -19.5) {
        if ((abs(bx) < 0.6 && by > -LC) || (abs(bx) < 2.4 && by > -22)) put(buf, o, BLACK);
        continue;
      }
      if (abs(by) > 16.5) {
        if (abs(bx) < (by < 0 ? 7.5 : 8.5) && abs(by) < 20) put(buf, o, abs(by) < 17.6 ? [90, 66, 100] : BLACK);
        continue;
      }
      const hw = 13 * sqrt(1 - (by / 19.5) ** 2);
      if (abs(bx) > hw) continue;
      // The eye, its lids and the pupil looking at the umbrella.
      const ey = (bx - 2) ** 2 / 36 + (by + 5) ** 2 / (25 * F.eye * F.eye + 0.01);
      if (F.eye > 0.04 && ey < 1.45) {
        put(buf, o, ey > 1 ? BLACK : (bx - 2 - lx0) ** 2 + (by + 5 - ly0 * F.eye) ** 2 < 6.8 ? ((bx - 2.7 - lx0) ** 2 + (by + 5.8 - ly0) ** 2 < 0.7 ? WHITE : BLACK) : WHITE);
        continue;
      }
      // The grin: the seam at row 6 tears open, corners curling up, the
      // torn edges ragged.
      const q = bx / 11.5, m = F.mouth, rag = 0.5 * sin(bx * 2.7) * m;
      const top = 6 - m * (1.6 * (1 - q * q) + 3.2 * q ** 4) + rag, bot = 6 + m * (8.5 * (1 - q * q) - 3.2 * q ** 4) + rag;
      if (abs(q) < 1 && by > top - 0.45 && by < bot + 0.45) {
        put(buf, o, m < 0.05 || by < top + 0.35 || by > bot - 0.35 ? [150, 40, 30] : GULLET);
        continue;
      }
      // Paper: palest in the middle, the light's own colour at the sides,
      // ribs a little darker, bowed with the barrel.
      const e = (bx / hw) ** 2, rb = (by + 16.5 + 0.9 * e) % 3.3 < 0.8;
      for (let ch = 0; ch < 3; ch++) buf[o + ch] = mix(Pp[ch], L[ch], e) * (rb ? 0.78 : 1);
    }
}

// The tongue: a capsule along the chain, thinning to a round tip, a groove
// down the middle, outlined dark.
function tongue(S, buf) {
  const T = S.tg, F = S.face;
  if (F.tongue < 1) return;
  let xa = 64, xb = 0, ya = 128, yb = 0;
  for (const p of T) (xa = min(xa, p[0])), (xb = max(xb, p[0])), (ya = min(ya, p[1])), (yb = max(yb, p[1]));
  for (let y = max(0, floor(ya - 4)); y < min(H, yb + 5); y++)
    for (let x = max(0, floor(xa - 4)); x < min(W, xb + 5); x++) {
      let dm = 9, cm = 9;
      for (let i = 1; i < 8; i++) {
        const [ax, ay] = T[i - 1], [bx, by] = T[i], vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
        const t = cl(((x + 0.5 - ax) * vx + (y + 0.5 - ay) * vy) / l2, 0, 1), dd = sqrt((x + 0.5 - ax - vx * t) ** 2 + (y + 0.5 - ay - vy * t) ** 2);
        const r = i === 7 ? 2.6 : 2.7 - 0.08 * i;
        if (dd - r < dm) (dm = dd - r), (cm = dd);
      }
      const o = (y * W + x) * 3;
      if (dm < 0) put(buf, o, cm < 0.55 && y > T[1][1] ? GROOVE : TONGUE);
      else if (dm < 1) for (let ch = 0; ch < 3; ch++) buf[o + ch] *= 0.3;
    }
}

// The umbrella in its own frame, origin where the leg meets the canopy, y
// down: a bell of oiled paper 26 wide and 28 tall on five ribs, scalloped
// between the ribs at the rim, one eye, a tongue, one leg on a clog.
function canopy(x, y) {
  if (y < -28 || y > 1.4 * abs(sin((PI * x) / 6.5))) return 0;
  const s = -y / 28;
  return abs(x) < (y < 0 ? 13 * sqrt(1 - s) * (1 - 0.15 * s) : 13) ? 1 : 0;
}
function umbrella(S, buf) {
  const U = S.U, c = cos(U.tilt), s = sin(U.tilt), ox = U.x, oy = FOOT - 3.3 - U.leg + U.y, f = U.dir, z = 1 / U.sq;
  for (let y = max(0, floor(oy - 34 * U.sq)); y < min(H, oy + U.leg + 5); y++)
    for (let x = max(0, floor(ox - 17)); x < min(W, ox + 18); x++) {
      const dx = x + 0.5 - ox, dy = y + 0.5 - oy, lx = dx * c + dy * s, ly = -dx * s + dy * c, cy = ly * z, o = (y * W + x) * 3;
      // The tongue, out of the mouth under the eye and down over the rim,
      // flapping with the hop.
      const tl = (cy + 8.5) / 13.5, tx = f * (0.6 + (1.5 + 2.5 * sin(PI * U.p)) * tl);
      if (tl > 0 && tl < 1 && abs(lx - tx) < 1.9 - 0.4 * tl) {
        put(buf, o, abs(lx - tx) < 0.45 && tl > 0.2 ? GROOVE : TONGUE);
        continue;
      }
      if (canopy(lx, cy)) {
        const hw = cy < 0 ? 13 * sqrt(1 + cy / 28) * (1 + (0.15 * cy) / 28) : 13, u = lx / hw;
        const ey = (lx - f) ** 2 / 20 + (cy + 15) ** 2 / 16;
        if (ey < 1.4) {
          // The eye looks the way it is going.
          put(buf, o, ey > 1 ? BLACK : (lx - 2 * f) ** 2 + (cy + 15.5) ** 2 < 3.6 ? BLACK : WHITE);
        } else if (abs(lx - f * 0.6) < 3 && abs(cy + 8.6) < 1) put(buf, o, GULLET);
        else if (cy < -26.5) put(buf, o, BLACK);
        else {
          const rib = abs(u * 2 - round(u * 2)) * hw < 0.55, side = floor((u + 1) * 2) & 1;
          put(buf, o, rib ? RIB : side ? GREEN2 : GREEN);
          if (cy > -1.5) for (let ch = 0; ch < 3; ch++) buf[o + ch] *= 0.62;
        }
        continue;
      }
      if (canopy(lx + 0.9, cy) || canopy(lx - 0.9, cy) || canopy(lx, cy + 0.9) || canopy(lx, cy - 0.9)) {
        for (let ch = 0; ch < 3; ch++) buf[o + ch] *= 0.3;
        continue;
      }
      // The tip.
      if (lx * lx + (cy + 29.6) ** 2 < 2.6) {
        put(buf, o, BLACK);
        continue;
      }
      // The leg, its knee bending forward in a crouch, and the clog.
      const kx = f * (13 - U.leg) * 0.9, kl = U.leg / 2, legd = ly < kl ? abs(lx - kx * (ly / kl)) : abs(lx - kx * (1 - (ly - kl) / kl));
      if (ly > 0 && ly < U.leg && legd < 1.15) put(buf, o, SKIN);
      else if (ly >= U.leg && ly < U.leg + 1.4 && abs(lx) < 3.8) put(buf, o, [150, 30, 40]);
      else if (ly >= U.leg + 1.4 && ly < U.leg + 3.3 && abs(abs(lx) - 2.3) < 0.8) put(buf, o, [92, 56, 40]);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.hue < 0) return;
  const buf = S.buf, L = S.L;
  buf.set(S.bg);
  const [cx, cy] = toWorld(S.th, 0, LC);
  // The halo around the lantern in three steps, and its light under the eave.
  for (let y = 0; y < GROUND; y++)
    for (let x = 0; x < W; x++) {
      const r = sqrt((x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) * 0.8) ** 2), a = r < 22 ? 0.3 : r < 30 ? 0.17 : r < 40 ? 0.07 : 0;
      if (a) addc(buf, (y * W + x) * 3, L, a * (y < 9 ? 1.6 : 1));
    }
  // The puddles hold the lantern upside down, broken up by ripples, and the
  // wet stones catch its light where it falls.
  for (let y = GROUND; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, wob = sin(y * 2.1 + S.t * 5) * 1.2;
      if (inPuddle(x + 0.5, y + 0.5)) {
        const w = abs(x + 0.5 + wob - cx);
        if (w < 11) addc(buf, o, S.paper, w < 6 ? 0.8 : 0.45);
      } else if (abs(x + 0.5 - cx) < 11 - (y - GROUND) * 0.3 && (y - GROUND) % 6 === 0) addc(buf, o, L, 0.75);
    }
  for (const [x, y, t, big] of S.rings) {
    const rr = 1 + (t / 0.45 / big) * 4.5 * big, a = 0.6 * (1 - t / 0.45 / big);
    for (let i = 0; i < 20; i++) {
      const px = round(x + rr * cos((i * TAU) / 20)), py = round(y + rr * 0.32 * sin((i * TAU) / 20));
      if (px >= 0 && px < W && py < H && inPuddle(px + 0.5, py + 0.5)) addc(buf, (py * W + px) * 3, [190, 180, 230], a);
    }
  }
  lantern(S, buf);
  // The tongue swings in front of the lantern's lower half and below it.
  tongue(S, buf);
  umbrella(S, buf);
  // Rain: pale lilac streaks, lit the lantern's colour near it.
  const wind = S.wind;
  for (const r of S.drops) {
    const dl = sqrt((r.x - cx) ** 2 + ((r.y - cy) * 0.8) ** 2), lit = dl < 20 ? 0.85 : dl < 32 ? 0.5 : dl < 46 ? 0.22 : 0;
    for (let i = 0; i < r.len; i++) {
      const x = round(r.x - wind * i), y = round(r.y - i);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const o = (y * W + x) * 3, a = 1 - i / r.len;
      // Lit drops lose the lilac, so they read orange rather than peach.
      addc(buf, o, RAIN, 0.55 * a * (1 - lit));
      if (lit) addc(buf, o, L, lit * a);
    }
  }
  for (const [x, y, , , t] of S.bits) {
    const px = round(x), py = round(y);
    if (px >= 0 && px < W && py >= 0 && py < H) addc(buf, (py * W + px) * 3, [170, 160, 220], 1 - t / 0.55);
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, buf[o]) & 252, min(255, buf[o + 1]) & 252, min(255, buf[o + 2]) & 252);
}
