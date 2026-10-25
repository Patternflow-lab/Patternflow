// ===== Patternflow pattern =====
// Title:   Lamellar Cream
// Family:  cosmetic
// Idea:    A thin layer of cream between crossed polarizers under a microscope: on a black field its lamellar droplets drift up the panel as the cream is spread, pack, now and then run together, and each shows a dark Maltese cross along the polarizer axes with Michel-Lévy interference colours in its four bright quadrants that run in rings on the bigger drops.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Maltese cross and Michel-Lévy interference colours (Auguste Michel-Lévy, 1888) of the lamellar liquid-crystal droplets in creams (Stig Friberg, 1969), pattern round 40
// Round:   40
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=0..1, Turn=0..1
//
// Knob 1: Hue. Turns the interference colours round the wheel and gives the white of the small drops a pale tint of the same hue, so the first-order colour most drops show leads. At 0 champagne and gold with violet rings on the biggest drops; at 0.25 green, at 0.5 blue, at 0.75 pink.
// Knob 2: Speed. How fast the cream is spread. At 2 the drops in the middle columns rise about 3.5 LEDs a second and those by the sides about 2, so a drop crosses the panel in 40 to 70 s, and drops pressed together run into one about every 2 s; at 0.2 ten times slower and almost none merge; at 3 about one merge a second.
// Knob 3: Size. Scales every drop, which swells or shrinks over about 2 s; drops crowded out drift out of focus and new ones drift in where there is room. At 0 radii from 3 to 10 LEDs, more small than large. The retardation peaks at 56 nm per LED of radius, so most drops stay in the first order (grey, white, straw, gold) and only those over 9 LEDs reach the first-order red and the violet and blue rings past it. At 1 radii from 5.7 to 19, peaking near 1070 nm, and the big drops carry second-order blue, green, yellow and red rings.
// Knob 4: Turn. How fast the crossed polarizers turn together. The crosses turn with them, not with the drops: at 0 they stand upright as a +; at 0.06 the pair turns once in 200 s, so each cross comes back to itself every 50 s; at 1 once in 12 s.

const W = 64, H = 128, N = W * H;
// Birefringence in nm of retardation per LED of path: a drop of radius R
// peaks at 1.122 * KR * R, 0.652 R out from its centre.
const KR = 50;
// The colour table: retardation 0 to GMAX nm in NT steps.
const GMAX = 2400, NT = 1024;
// Hue of the first-order straw yellow, which leads the palette at Hue 0.
const H0 = 0.12;
// Share of the panel the drops cover.
const FILL = 0.72;
const { floor, min, max, sqrt, exp, sin, cos, atan, round, random, PI, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// The Michel-Lévy colours: white light through a plate of retardation G
// between crossed polarizers keeps sin^2(pi G / lambda) of each wavelength.
// CIE 1931 matching functions in the multi-lobe fit of Wyman, Sloan and
// Shirley (2013), to linear sRGB, balanced so that full transmission is white.
function lobe(l, mu, s1, s2) {
  const s = l < mu ? s1 : s2;
  return exp(-0.5 * ((l - mu) / s) ** 2);
}
function michelLevy() {
  const ws = [];
  for (let l = 380; l <= 720; l += 5) {
    const X = 1.056 * lobe(l, 599.8, 37.9, 31) + 0.362 * lobe(l, 442, 16, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2);
    const Y = 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1);
    const Z = 1.217 * lobe(l, 437, 11.8, 36) + 0.681 * lobe(l, 459, 26, 13.8);
    ws.push([l, 3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z]);
  }
  const full = [0, 0, 0];
  for (const w of ws) for (let c = 0; c < 3; c++) full[c] += w[c + 1];
  const T = new Float32Array(NT * 3);
  for (let i = 0; i < NT; i++) {
    const G = (i / (NT - 1)) * GMAX, s = [0, 0, 0];
    for (const w of ws) {
      const t = sin((PI * G) / w[0]) ** 2;
      for (let c = 0; c < 3; c++) s[c] += t * w[c + 1];
    }
    for (let c = 0; c < 3; c++) T[i * 3 + c] = max(0, s[c] / full[c]);
    // Past the first-order white the dark bands between colours (the
    // first-order red and violet, near 550 nm) are lifted toward a floor of
    // luminance 0.4, so the rings read as jewels and not as mud.
    const lum = 0.3 * T[i * 3] + 0.59 * T[i * 3 + 1] + 0.11 * T[i * 3 + 2];
    if (G > 300 && lum < 0.4) {
      const f = min(3, (0.4 / max(lum, 0.02)) ** 0.7);
      for (let c = 0; c < 3; c++) T[i * 3 + c] *= f;
    }
  }
  return T;
}

// The table turned round the wheel by angle a: the chroma of each colour
// rotated in YIQ, its luminance kept.
function turnTable(S, a) {
  const { ml, tab, tint } = S, ca = cos(a), sa = sin(a), c = [0, 0, 0];
  for (let i = 0; i < NT; i++) {
    const r = ml[i * 3], g = ml[i * 3 + 1], b = ml[i * 3 + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b, I0 = 0.596 * r - 0.274 * g - 0.322 * b, Q0 = 0.211 * r - 0.523 * g + 0.312 * b;
    const I = I0 * ca - Q0 * sa, Q = I0 * sa + Q0 * ca;
    c[0] = max(0, y + 0.956 * I + 0.621 * Q);
    c[1] = max(0, y - 0.272 * I - 0.647 * Q);
    c[2] = max(0, y - 1.106 * I + 1.703 * Q);
    // An orange band turned to yellow keeps the orange's luminance and
    // reads olive on the panel: yellows and limes are lifted and paled.
    const v = max(c[0], c[1], c[2]), mn = min(c[0], c[1], c[2]);
    if (v > 0.05 && v - mn > 0.05) {
      const d = v - mn;
      let h = v === c[0] ? (c[1] - c[2]) / d : v === c[1] ? 2 + (c[2] - c[0]) / d : 4 + (c[0] - c[1]) / d;
      h = (h / 6 + 1) % 1;
      const warm = cl(1 - Math.abs(h - 0.16) / 0.12, 0, 1);
      if (warm > 0) hsv(h, (d / v) * (1 - 0.3 * warm), min(1, v * (1 + 0.7 * warm)), c);
    }
    // The greys and whites of the first order take a pale tint of the lead hue.
    for (let k = 0; k < 3; k++) tab[i * 3 + k] = c[k] * tint[k];
  }
}

export function setup(params) {
  const ml = michelLevy();
  params.s = {
    drops: [], next: null, g: 1, t: 0, pol: 0, hue: -1, speed: 2, size: 0, turn: 0.06, begun: false,
    ml, tab: new Float32Array(NT * 3), tint: [1, 1, 1], own: new Int16Array(N), best: new Float32Array(N), gam: new Uint8Array(1024),
  };
  // Light to LED level, v^0.6.
  for (let i = 0; i < 1024; i++) params.s.gam[i] = round(255 * (i / 1023) ** 0.6);
}

// A new drop, more small than large: p(r) ~ r^-1.5 for r from 3 to 10,
// times the Size scale. v3 is r^3, the volume merges keep.
function newDrop(S, x, y) {
  const r = (3 ** -0.5 + random() * (10 ** -0.5 - 3 ** -0.5)) ** -2;
  return { x, y, R: r * S.g, v3: r * r * r, m: null, into: null, mt: 0, dead: false, fade: false, a: 1 };
}

// Share of the panel covered by drops that are not leaving the focus, each
// counted by the part of its square that lies on the panel.
function cover(S) {
  let a = 0;
  for (const d of S.drops) {
    if (d.fade) continue;
    const R = d.R, fx = max(0, min(W, d.x + R) - max(0, d.x - R)) / (2 * R), fy = max(0, min(H, d.y + R) - max(0, d.y - R)) / (2 * R);
    a += PI * R * R * fx * fy;
  }
  return a / N;
}

// Whether a drop of radius R at x, y overlaps no other.
function free(S, x, y, R) {
  for (const o of S.drops) if (hypot(o.x - x, o.y - y) < o.R + R) return false;
  return true;
}

// Packing: overlapping drops push each other apart, the small one more.
// With merge on, drops that stay pressed together may run into one.
function pack(S, dt, merge) {
  const ds = S.drops, k = min(1, 6 * dt);
  for (let i = 0; i < ds.length; i++)
    for (let j = i + 1; j < ds.length; j++) {
      const a = ds[i], b = ds[j];
      if (a.into === b || b.into === a) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = hypot(dx, dy) + 1e-6, gap = a.R + b.R + 0.2 - d;
      if (gap <= 0) continue;
      const push = min(gap, 2) * 0.5 * k, wa = (b.R * b.R) / (a.R * a.R + b.R * b.R);
      a.x -= (dx / d) * push * wa;
      a.y -= (dy / d) * push * wa;
      b.x += (dx / d) * push * (1 - wa);
      b.y += (dy / d) * push * (1 - wa);
      if (merge && gap > 0.4 && a.y < H - a.R && b.y < H - b.R && !a.m && !b.m && !a.into && !b.into && !a.fade && !b.fade && random() < 0.05 * S.speed * dt) {
        const big = a.R >= b.R ? a : b, sm = big === a ? b : a;
        if (big.v3 + sm.v3 < 1500) {
          sm.into = big;
          sm.mt = 0;
          sm.v0 = sm.v3;
          big.m = sm;
          big.b0 = big.v3;
        }
      }
    }
}

// Share of the band from 12 rows above the bottom to 24 below it that the
// drops whose centres lie in it would cover.
function band(S) {
  let a = 0;
  for (const d of S.drops) if (d.y > H - 12 && d.y < H + 24) a += PI * d.R * d.R;
  return a / (36 * W);
}

// Speed of the flow across the panel, 1 in the middle column.
function flow(x) {
  return 0.55 + 0.45 * sin((PI * cl(x, 0, W)) / W);
}

function step(S, dt) {
  const V = 1.5 * S.speed, rm = 10 * S.g;
  S.t += dt;
  // The Size scale eases to the knob over about two seconds.
  S.g += (1 + 0.9 * S.size - S.g) * min(1, dt / 2);
  for (const d of S.drops) {
    // Drops come into focus over a second and leave it over 0.6 s.
    d.a = d.fade ? d.a - dt / 0.6 : min(1, d.a + dt);
    d.R = Math.cbrt(max(0, d.v3)) * S.g;
  }
  // The flow: up the panel, fastest in the middle columns and for the
  // smaller drops, so drops slide past each other and meet.
  for (const d of S.drops) {
    d.y -= V * flow(d.x) * (1.25 - (0.25 * d.R) / rm) * dt;
    d.x += 0.25 * V * sin(d.y * 0.05 + S.t * 0.07) * dt;
  }
  pack(S, dt, true);
  // Merging: the small drop runs into the big one and gives it its volume
  // over 1.2 s at Speed 1.
  for (const d of S.drops) {
    if (!d.into) continue;
    const big = d.into;
    d.mt += dt * (0.6 + 0.4 * S.speed);
    const f = cl(d.mt / 1.2, 0, 1), e = f * f * (3 - 2 * f), g = min(1, 3 * dt * (0.5 + e));
    d.x += (big.x - d.x) * g;
    d.y += (big.y - d.y) * g;
    d.v3 = d.v0 * (1 - e);
    big.v3 = big.b0 + d.v0 * e;
    d.R = Math.cbrt(max(0, d.v3)) * S.g;
    big.R = Math.cbrt(big.v3) * S.g;
    if (f >= 1) {
      big.m = null;
      d.dead = true;
    }
  }
  for (const d of S.drops) d.x = cl(d.x, -d.R * 0.5, W + d.R * 0.5);
  S.drops = S.drops.filter((d) => !d.dead && d.y > -d.R - 2 && d.R > 0.6 && d.a > 0);
  // The layer is thicker than the focus: when the drops have swelled past
  // what the panel holds the smallest drifts out of focus, and when they
  // have shrunk new ones drift in where there is room.
  const c = cover(S);
  if (c > 1.15 * FILL) {
    let sm = null;
    for (const d of S.drops) if (!d.fade && !d.m && !d.into && d.y < H && (!sm || d.R < sm.R)) sm = d;
    if (sm) sm.fade = true;
  } else if (c < 0.85 * FILL) {
    for (let tries = 0; tries < 6; tries++) {
      const d = newDrop(S, random() * W, random() * H);
      if (free(S, d.x, d.y, d.R)) {
        d.a = 0;
        S.drops.push(d);
        break;
      }
    }
  }
  // New cream comes in just below the panel while the band there is short
  // of drops, more of it where the flow is faster so the packing stays
  // even. The next drop keeps its size until a gap opens for it, so the big
  // ones are not crowded out by the small.
  if (!S.next) S.next = newDrop(S, 0, 0);
  for (let tries = 0; tries < 12 && band(S) < FILL; tries++) {
    const d = S.next;
    d.R = Math.cbrt(d.v3) * S.g;
    d.x = random() * W;
    while (random() > flow(d.x)) d.x = random() * W;
    d.y = H + d.R + 1 + random() * 4;
    if (free(S, d.x, d.y, d.R)) {
      S.drops.push(d);
      S.next = newDrop(S, 0, 0);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (k[0] !== S.hue) {
    S.hue = k[0];
    hsv(H0 + S.hue, 0.3, 1, S.tint);
    // Turning the chroma from I toward Q runs the hue backward, so the table
    // turns by minus the knob.
    turnTable(S, -2 * PI * S.hue);
  }
  S.speed = cl(k[1], 0.2, 3);
  S.size = cl(k[2], 0, 1);
  S.turn = cl(k[3], 0, 1);
  if (!S.begun) {
    S.g = 1 + 0.9 * S.size;
    // Fill the panel, the big drops first, each where it overlaps nothing,
    // then let them settle before any flow.
    const rs = [];
    for (let a = 0; a < FILL * N * 1.1; ) {
      const d = newDrop(S, 0, 0);
      rs.push(d);
      a += PI * d.R * d.R;
    }
    rs.sort((p, q) => q.R - p.R);
    for (const d of rs)
      for (let t = 0; t < 300; t++) {
        d.x = random() * W;
        d.y = random() * H;
        if (S.drops.every((o) => hypot(o.x - d.x, o.y - d.y) >= o.R + d.R - 0.5)) {
          S.drops.push(d);
          break;
        }
      }
    for (let i = 0; i < 60; i++) pack(S, 1 / 30, false);
    S.begun = true;
  }
  step(S, d);
  // The polarizer pair: one turn in 12 s at Turn 1.
  S.pol += ((d * S.turn * 2 * PI) / 12);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { own, best, tab, drops, gam } = S;
  own.fill(-1);
  best.fill(1);
  // Each LED belongs to the drop it lies deepest in.
  for (let i = 0; i < drops.length; i++) {
    const d = drops[i], R = d.R;
    if (R < 0.5) continue;
    const k = 1 / (R * R);
    for (let y = max(0, floor(d.y - R)); y <= min(H - 1, floor(d.y + R)); y++) {
      const ey = (y + 0.5 - d.y) ** 2;
      for (let x = max(0, floor(d.x - R)); x <= min(W - 1, floor(d.x + R)); x++) {
        const s = ((x + 0.5 - d.x) ** 2 + ey) * k, p = y * W + x;
        if (s < best[p]) {
          best[p] = s;
          own[p] = i;
        }
      }
    }
  }
  const c2 = cos(2 * S.pol), s2 = sin(2 * S.pol);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, i = own[p];
      if (i < 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const d = drops[i], dx = x + 0.5 - d.x, dy = y + 0.5 - d.y, r2 = dx * dx + dy * dy + 1e-6, rho = sqrt(r2);
      // Retardation of a sphere whose optic axis points out from its centre:
      // along a ray at distance rho the birefringence goes as sin^2 of the
      // angle to the radius, and integrates to 2 rho atan(L / rho).
      const L = sqrt(max(0, d.R * d.R - r2)), G = KR * 2 * rho * atan(L / rho);
      // Extinction where the radius lies along either polarizer: sin^2 2(alpha - P).
      const sn = ((2 * dx * dy) / r2) * c2 - ((dx * dx - dy * dy) / r2) * s2, I = sn * sn;
      const ti = min(NT - 1, round((G / GMAX) * (NT - 1))) * 3;
      const v = I * d.a;
      let r = tab[ti] * v, g = tab[ti + 1] * v, b = tab[ti + 2] * v;
      // Dim colours go grey rather than brown or olive.
      const lum = 0.3 * r + 0.59 * g + 0.11 * b, sat = 0.25 + 0.75 * v;
      r = lum + (r - lum) * sat;
      g = lum + (g - lum) * sat;
      b = lum + (b - lum) * sat;
      display.setPixel(x, y, gam[round(1023 * cl(r, 0, 1))], gam[round(1023 * cl(g, 0, 1))], gam[round(1023 * cl(b, 0, 1))]);
    }
}
