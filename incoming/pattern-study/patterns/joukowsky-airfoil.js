// ===== Patternflow pattern =====
// Title:   Joukowsky Airfoil
// Family:  physics
// Idea:    A cambered Joukowsky wing 44 rows long stands in the middle of the panel with the ideal flow running down past it, faint streamlines bending round it, while lines of dye let go across the top row once a second come down, wrap the rounded nose where they split at a red stagnation point, and leave the sharp trailing edge with the half that went over the suction side well ahead of the half that went under, a lead that grows with the angle of attack and is gone when the circulation is taken away.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Joukowsky airfoil (Nikolai Zhukovsky, 1910)
// Round:   35
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Attack=0..15, Camber=0..0.12
//
// Knob 1: Hue. Turns the four dyes round the wheel together. At 0 the lines come gold, green, blue and pink in turn, so one line can be followed past the wing and its two halves matched below it.
// Knob 2: Speed. How fast the free stream runs down the panel: 10 LEDs a second times the knob. At 2 a line crosses the 128 rows in 6.4 s and a new one leaves the top row every second; at 0.2 every ten.
// Knob 3: Attack. The angle of attack, 0 to 15 degrees; the nose tips right into the stream. With Camber at 0.06 the half of a line that goes over the right side reaches the trailing edge 12.6 rows ahead of the other half at 0 degrees, 30 rows at 8, 46 at 15, and the front stagnation point slides down the left side of the nose.
// Knob 4: Camber. The camber of the wing, 0 to 12% of the chord, by lifting the circle's centre. At 0 the wing is symmetric and at 0 degrees the two halves of every line meet again at the trailing edge; at 12% and 15 degrees the lead is 69 rows.
// Buttons: K1 tap takes the circulation away for 10 s (a second tap gives it back). The flow then turns round the sharp trailing edge from the left, the rear stagnation point leaves the edge and moves up the right side, 0.9 LED at 8 degrees and 2.8 at 15 degrees with 12% camber, and the two halves of every line arrive within 6 rows of each other, the left one now first.

// Ideal flow past a circle in the ζ-plane, carried to flow past an airfoil
// by z = ζ + c²/ζ. The circle goes through ζ = c, which lands on the sharp
// trailing edge at z = 2c, and its centre ζ0 = -ε + iδ sits left of the
// origin for thickness and above it for camber. With U = 1,
//   W(ζ) = ζ' e^{-iα} + R² e^{iα}/ζ' + (iΓ/2π) log ζ',   ζ' = ζ - ζ0,
// and the Kutta condition, that the flow leaves the trailing edge smoothly,
// fixes Γ = 4πR sin(α + β), β the angle of ζ0 seen from c. Lengths are in
// LEDs: c = 11, so the chord is 44 rows, centred on the panel, and ε =
// 0.12 c makes the wing 6 LEDs at its thickest, 14% of the chord. The free
// stream runs down the panel at one LED per unit of time.
const W = 64, H = 128, NP = W * H, CX = 32, CY = 64;
const C = 11, EPS = 0.12 * C, LAM = 20, DUTY = 2.2 / 20, TMAX = 400, CHUNK = 768, SPACE = 6;
const { min, max, floor, round, sqrt, sin, cos, atan2, abs, exp, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// One flow: the circle, the angle of attack and the circulation.
function makeFlow(alphaDeg, camber, kutta) {
  const a = (alphaDeg * PI) / 180, d = camber * 2 * C;
  const z0r = -EPS, z0i = d, R = sqrt((C + EPS) ** 2 + d * d), beta = atan2(d, C + EPS);
  const gam = kutta ? 4 * PI * R * sin(a + beta) : 0;
  return { a, ca: cos(a), sa: sin(a), z0r, z0i, R, R2: R * R, beta, gam, key: alphaDeg.toFixed(1) + "/" + camber.toFixed(3) + "/" + kutta };
}

// The flow at ζ: o[0], o[1] = dζ/dt, o[2] = speed on the panel, o[3] =
// |dz/dζ|. dζ/dt = conj(dW/dζ) / |dz/dζ|². At the trailing edge dz/dζ is 0;
// with the Kutta condition dW/dζ is 0 there too and the floor on |dz/dζ|²
// only keeps 0/0 away, without it the speed there is capped at 6.
function flowAt(F, zr, zi, o) {
  const pr = zr - F.z0r, pi = zi - F.z0i, r2 = pr * pr + pi * pi;
  const ir = pr / r2, ii = -pi / r2, i2r = ir * ir - ii * ii, i2i = 2 * ir * ii;
  const er = F.ca * i2r - F.sa * i2i, ei = F.ca * i2i + F.sa * i2r, g = F.gam / TAU;
  const wr = F.ca - F.R2 * er - g * ii, wi = -F.sa - F.R2 * ei + g * ir;
  const q2 = zr * zr + zi * zi, jr = zr / q2, ji = -zi / q2, j2r = jr * jr - ji * ji, j2i = 2 * jr * ji;
  const dr = 1 - C * C * j2r, di = -C * C * j2i, J2 = max(1e-8, dr * dr + di * di);
  let sp = sqrt((wr * wr + wi * wi) / J2), k = 1;
  if (sp > 6) (k = 6 / sp), (sp = 6);
  o[0] = (k * wr) / J2;
  o[1] = (-k * wi) / J2;
  o[2] = sp;
  o[3] = sqrt(J2);
}

// ζ to the panel: z = ζ + c²/ζ, turned back by α so the free stream runs
// down the panel and the suction side faces right. o[0] = X, o[1] = Y.
function toPanel(F, zr, zi, o) {
  const q2 = zr * zr + zi * zi, xr = zr + (C * C * zr) / q2, xi = zi - (C * C * zi) / q2;
  o[0] = CX + xi * F.ca - xr * F.sa;
  o[1] = CY + xr * F.ca + xi * F.sa;
}

// The panel to ζ: of the two roots of ζ² - zζ + c² = 0, the one outside
// the circle. o[2] = |ζ'|²; less than R² means the LED is inside the wing.
function toZeta(F, X, Y, o) {
  const pr = Y - CY, pi = X - CX, zr = pr * F.ca - pi * F.sa, zi = pr * F.sa + pi * F.ca;
  const wr = zr * zr - zi * zi - 4 * C * C, wi = 2 * zr * zi, m = sqrt(wr * wr + wi * wi);
  const sr = sqrt(max(0, (m + wr) / 2)), si = (wi < 0 ? -1 : 1) * sqrt(max(0, (m - wr) / 2));
  const ar = (zr + sr) / 2, ai = (zi + si) / 2, br = (zr - sr) / 2, bi = (zi - si) / 2;
  const da = (ar - F.z0r) ** 2 + (ai - F.z0i) ** 2, db = (br - F.z0r) ** 2 + (bi - F.z0i) ** 2;
  if (da >= db) (o[0] = ar), (o[1] = ai), (o[2] = da);
  else (o[0] = br), (o[1] = bi), (o[2] = db);
}

// When the fluid at an LED crossed the top row: back along its streamline,
// in the ζ-plane where the wing is a circle and easy to keep out of, adding
// up time. Midpoint steps of 0.35 LED by the surface, up to 3 LEDs and 3
// time units away from it.
function arrival(F, X, Y, f, pos) {
  toZeta(F, X, Y, f);
  if (f[2] < F.R2) return -1;
  let zr = f[0], zi = f[1], T = 0;
  for (let it = 0; it < 400; it++) {
    flowAt(F, zr, zi, f);
    const pr = zr - F.z0r, pi = zi - F.z0i, dist = (sqrt(pr * pr + pi * pi) - F.R) * f[3];
    const dt = min(cl(0.35 + 0.3 * dist, 0.35, 3) / max(f[2], 1e-6), 3);
    flowAt(F, zr - 0.5 * dt * f[0], zi - 0.5 * dt * f[1], f);
    zr -= dt * f[0];
    zi -= dt * f[1];
    const qr = zr - F.z0r, qi = zi - F.z0i, q2 = qr * qr + qi * qi;
    if (q2 < F.R2) {
      const s = (F.R * 1.0001) / sqrt(q2);
      zr = F.z0r + qr * s;
      zi = F.z0i + qi * s;
    }
    T += dt;
    toPanel(F, zr, zi, pos);
    // Past the top row: give back the part of the step beyond it.
    if (pos[1] <= 0) return max(0, T + pos[1] / max(0.3, f[2]));
    if (T > TMAX) return TMAX;
  }
  return TMAX;
}

function newField(F) {
  return { F, T: new Float32Array(NP), G: new Float32Array(NP), psi: new Float32Array(NP), sp: new Float32Array(NP), body: new Float32Array(NP), next: 0, st: [0, 0, 0, 0] };
}

// Arrival times for LEDs from..to of a field; the rest once they are all in.
function fill(Fd, to) {
  const { F, T, G, psi, sp, body } = Fd, f = new Float64Array(4), pos = [0, 0];
  for (let p = Fd.next; p < to; p++) T[p] = arrival(F, (p % W) + 0.5, floor(p / W) + 0.5, f, pos);
  Fd.next = to;
  if (to < NP) return false;
  for (let p = 0; p < NP; p++) {
    toZeta(F, (p % W) + 0.5, floor(p / W) + 0.5, f);
    const zr = f[0], zi = f[1], pr = zr - F.z0r, pi = zi - F.z0i, r2 = pr * pr + pi * pi;
    flowAt(F, zr, zi, f);
    sp[p] = f[2];
    // Inside the wing or within half an LED of its edge, by the distance
    // to the circle stretched by |dz/dζ|.
    body[p] = cl(0.5 - (sqrt(r2) - F.R) * f[3], 0, 1);
    // ψ = Im W.
    psi[p] = pi * F.ca - pr * F.sa + (F.R2 * (F.sa * pr - F.ca * pi)) / r2 + (F.gam / (2 * TAU)) * log(r2);
  }
  // How fast the arrival time changes across one LED, from the smaller of
  // the two one-sided steps, so the jump in the wake behind the trailing
  // edge does not count as steep.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, t = T[p], d = (q) => (T[q] < 0 ? 50 : min(50, abs(T[q] - t)));
      const gx = min(x > 0 ? d(p - 1) : 50, x < W - 1 ? d(p + 1) : 50), gy = min(y > 0 ? d(p - W) : 50, y < H - 1 ? d(p + W) : 50);
      G[p] = sqrt(gx * gx + gy * gy);
    }
  // The two stagnation points, where sin(θ - α) = -Γ / 4πR on the circle.
  const s0 = cl(-F.gam / (4 * PI * F.R), -1, 1), th = [F.a + Math.asin(s0), F.a + PI - Math.asin(s0)];
  for (let i = 0; i < 2; i++) {
    toPanel(F, F.z0r + F.R * cos(th[i]), F.z0i + F.R * sin(th[i]), pos);
    Fd.st[i * 2] = pos[0];
    Fd.st[i * 2 + 1] = pos[1];
  }
  return true;
}

export function setup(params) {
  params.s = { cur: null, old: null, nxt: null, fade: 1, s: 0, hue: 0, speed: 2, off: 0, pal: new Float32Array(15), palHue: NaN, rgb: new Float32Array(NP * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  // K1 takes the circulation away for 10 s; a second tap gives it back.
  if (input.btnPressed && input.btnPressed[0]) P.off = P.off > 0 ? 0 : 10;
  P.off = max(0, P.off - d);
  const want = makeFlow(cl(k[2], 0, 15), cl(k[3], 0, 0.12), P.off <= 0);
  if (!P.cur) {
    P.cur = newField(want);
    fill(P.cur, NP);
  } else if (!P.nxt && want.key !== P.cur.F.key) P.nxt = newField(want);
  // A new flow is worked out 768 LEDs a frame, eleven frames for the panel,
  // then faded in over 0.4 s; a knob still turning starts the next one.
  if (P.nxt && fill(P.nxt, min(NP, P.nxt.next + CHUNK))) {
    P.old = P.cur;
    P.cur = P.nxt;
    P.nxt = null;
    P.fade = 0;
  }
  P.fade = min(1, P.fade + d / 0.4);
  P.s += d * 10 * P.speed;
}

function paint(P, Fd, wgt, rgb) {
  const { T, G, psi, sp, body } = Fd, pal = P.pal;
  for (let p = 0, o = 0; p < NP; p++, o += 3) {
    let r = 0.012, g = 0.016, b = 0.05;
    // Streamlines every 6 units of ψ, about one LED wide wherever they are.
    const u = psi[p] / SPACE, du = (abs(u - round(u)) * SPACE) / max(0.05, sp[p]), sl = 0.15 * exp(-2 * du * du);
    r += sl * 0.45;
    g += sl * 0.55;
    b += sl * 0.8;
    const t = T[p];
    if (t >= 0) {
      // The dye: a puff across the top row every 20 time units, lasting 2.2
      // of them, so in the free stream a line 2.2 LEDs thick. Where the flow
      // slows the lines crowd and thin; a line thinner than 1.6 LEDs is drawn
      // 1.6 wide and dimmer, and where they come closer than 4 LEDs they
      // merge into the haze they would make, 2.2/20 of full.
      const ph = (P.s - t) / LAM - DUTY / 2, kk = round(ph), per = LAM / max(0.02, G[p]);
      const wpx = DUTY * per, hw = max(0.8, wpx / 2), dpx = abs(ph - kk) * per;
      const line = cl(hw + 0.5 - dpx, 0, 1) * min(1, wpx / (2 * hw)), mix = cl((per - 4) / 4, 0, 1);
      const c = (((kk % 4) + 4) % 4) * 3, dye = line * mix, haze = DUTY * (1 - mix);
      r += dye * pal[c] + haze * pal[12];
      g += dye * pal[c + 1] + haze * pal[13];
      b += dye * pal[c + 2] + haze * pal[14];
    }
    const bo = body[p];
    r += (0.82 - r) * bo;
    g += (0.84 - g) * bo;
    b += (0.9 - b) * bo;
    rgb[o] += wgt * r;
    rgb[o + 1] += wgt * g;
    rgb[o + 2] += wgt * b;
  }
}

// The two stagnation points, a red LED each on the wing's edge.
function marks(Fd, wgt, rgb) {
  for (let i = 0; i < 2; i++) {
    const x = round(Fd.st[i * 2] - 0.5), y = round(Fd.st[i * 2 + 1] - 0.5);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const o = (y * W + x) * 3;
    rgb[o] += (1 - rgb[o]) * wgt;
    rgb[o + 1] += (0.12 - rgb[o + 1]) * wgt;
    rgb[o + 2] += (0.1 - rgb[o + 2]) * wgt;
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.cur) return;
  const { pal, rgb } = P;
  if (P.palHue !== P.hue) {
    // Four dyes in turn, so a line can be followed past the wing: gold,
    // green, blue and pink at Hue 0. The haze is their mean.
    pal.fill(0, 12);
    for (let i = 0; i < 4; i++) {
      hsv(P.hue + 0.12 + i * 0.25, 0.7, 1, pal, i * 3);
      for (let c = 0; c < 3; c++) pal[12 + c] += pal[i * 3 + c] / 4;
    }
    P.palHue = P.hue;
  }
  rgb.fill(0);
  if (P.old && P.fade < 1) paint(P, P.old, 1 - P.fade, rgb);
  const w = P.old && P.fade < 1 ? P.fade : 1;
  paint(P, P.cur, w, rgb);
  if (w < 1) marks(P.old, 1 - w, rgb);
  marks(P.cur, w, rgb);
  for (let p = 0, o = 0; p < NP; p++, o += 3) display.setPixel(p % W, floor(p / W), min(255, rgb[o] * 255), min(255, rgb[o + 1] * 255), min(255, rgb[o + 2] * 255));
}
