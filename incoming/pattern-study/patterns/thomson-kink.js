// ===== Patternflow pattern =====
// Title:   Thomson Kink
// Family:  wave
// Idea:    A charge runs up and down the middle of the panel and keeps reversing or stopping dead, every change sends out a sphere of news at the speed of light, and each field line is a chain of straight spokes, each aimed at where the charge would now be had it kept the velocity it had between two changes, joined by bright sideways kinks across the expanding shells.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: field of a uniformly moving charge (Oliver Heaviside, 1888), radiation as a kink in the field lines (J. J. Thomson, 1904), Purcell's drawing of the kink (Edward Purcell, 1965), pattern round 61
// Round:   61
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lines=12..32, Velocity=0.3..0.9
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the regions where the news says the charge is moving down are blue, moving up green and standing still near black, the shells and kinks rose and the spokes white; at 0.25 the regions are violet and teal with aqua kinks, at 0.5 green and blue with cyan-blue kinks. The wheel runs from green to magenta and skips red, orange and lime, which read maroon, brown and olive when dim.
// Knob 2: Speed. 2 is real time with light at 36 LEDs a second, so a shell born in the middle reaches the top and bottom rows in 1.8 s while the charge changes its mind every 0.32 to 0.6 s, and four or five shells are out at once; 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Lines. 12 to 32 field lines, an even number, spaced evenly in the angle they would have round a charge at rest: every 30 degrees at 12, every 15 at 24, every 11 at 32. Each keeps that label in every region, so it stays one line through all the kinks.
// Knob 4: Velocity. The charge's speed as a fraction of light, 0.3 to 0.9. At 0.3 the charge moves 11 LEDs a second, and a reversal puts the two pieces of the 75 degree line 18 LEDs apart along a shell 30 LEDs out; at 0.6 the kink of the 75 degree line runs 72 degrees round its shell and the shells read as rings; at 0.9 the charge moves 32 LEDs a second, gamma is 2.3, the spokes crowd towards the horizontal, each shell is a bright ring of lines running along it and the shells pile up in front of the charge. A new speed starts at the charge's next change and spreads out with the news.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Light in LEDs per second of the simulation, the axis the charge runs
// on, and how far it may stray from the middle row.
const C = 36, XC = 32, YC = 64, ROAM = 36;
// The kink shell's thickness in LEDs: the change takes 2.2 / 36 = 0.06 s.
const SHELL = 2.2;
// A shell is forgotten once it is wider than this; no LED is that far from
// any place the charge has been.
const RFORGET = 125;
// Seconds between changes, and the share of changes that stop the charge.
const GAP0 = 0.32, GAP1 = 0.6, STOP = 0.3;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}
// The knob turns hues on a wheel from green through blue and violet to
// magenta, which skips red, orange and lime: dim, they read maroon, brown
// and olive.
const wheel = (h) => 0.3 + 0.56 * (h - floor(h));

export function setup(params) {
  params.s = {
    T: 0, ready: false, beta: 0.3, hue: 0, n: 12,
    // The changes, oldest first: time, the row where it happened, and the
    // velocity after it, in LEDs a second (positive is down the panel).
    ch: [], u0: 0, next: 0,
    acc: new Float32Array(W * H * 3),
    col: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], kc: [0, 0, 0], lc: [0, 0, 0], sc: [0, 0, 0], c: [0, 0, 0],
    sh: [],
  };
}

// Where the charge is at time t, from the last change before it.
function posAt(S, t) {
  const ch = S.ch;
  for (let i = ch.length - 1; i >= 0; i--) if (ch[i].t <= t) return ch[i].p + ch[i].u * (t - ch[i].t);
  return YC + S.u0 * (t - (ch.length ? ch[0].t : t));
}
const velAt = (S) => (S.ch.length ? S.ch[S.ch.length - 1].u : S.u0);

// The charge changes its mind at time t: it reverses, or stops dead, or
// sets off again, now with the knob's speed. A change that would carry it
// past the end of its run turns it round instead.
function change(S, t) {
  const y = posAt(S, t), u = velAt(S), v = S.beta * C;
  const gap = GAP0 + (GAP1 - GAP0) * Math.random();
  let nu;
  if (u !== 0) nu = Math.random() < STOP ? 0 : -Math.sign(u) * v;
  else nu = (Math.random() < 0.7 ? (y < YC ? 1 : -1) : y < YC ? -1 : 1) * v;
  if (abs(y + nu * gap - YC) > ROAM) nu = y + nu * gap > YC ? -v : v;
  if (u === 0 && nu === 0) nu = v;
  S.ch.push({ t, p: y, u: nu });
  S.next = t + gap;
}

function advance(S, T) {
  while (S.next <= T) change(S, S.next);
  // Forget the shells that have left the panel, and with them the
  // velocity the charge had before them.
  while (S.ch.length > 1 && C * (T - S.ch[0].t) > RFORGET) S.u0 = S.ch.shift().u;
  S.T = T;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 12, 0.3], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3);
  S.n = 2 * Math.round(cl(kv[2], 12, 32) / 2);
  S.beta = cl(kv[3], 0.3, 0.9);
  if (!S.ready) {
    // The first frame starts the charge 4 s in the past, so the panel
    // opens full of shells.
    S.ready = true;
    S.u0 = S.beta * C;
    S.ch = [];
    S.next = -4;
    advance(S, 0);
  }
  advance(S, S.T + (d * speed) / 2);
}

// The far end of a ray from s (inside the sphere) along unit d where it
// leaves the sphere of centre (XC, cy) and radius r, as a distance.
function exitRay(sx, sy, dx, dy, cy, r) {
  const ox = sx - XC, oy = sy - cy, b = ox * dx + oy * dy, c = ox * ox + oy * oy - r * r;
  return -b + sqrt(max(0, b * b - c));
}

// Antialiased line, added into the buffer. Each column (or row, for a
// steep line) gets one unit of ink split between the two LEDs the line
// passes between, scaled by the length of line it holds, so a polyline is
// even along its whole length and its joints do not flare.
function line(acc, x0, y0, x1, y1, c, a) {
  // Clip to the panel with a one-LED margin.
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!clip(-dx, x0 + 1) || !clip(dx, W + 1 - x0) || !clip(-dy, y0 + 1) || !clip(dy, H + 1 - y0)) return;
  const ax = x0 + dx * t0, ay = y0 + dy * t0, bx = x0 + dx * t1, by = y0 + dy * t1;
  const steep = abs(by - ay) > abs(bx - ax);
  let u0 = steep ? ay : ax, v0 = steep ? ax : ay, u1 = steep ? by : bx, v1 = steep ? bx : by;
  if (u1 < u0) {
    let t = u0;
    u0 = u1;
    u1 = t;
    t = v0;
    v0 = v1;
    v1 = t;
  }
  const du = u1 - u0;
  if (du < 1e-6) return;
  const g = (v1 - v0) / du, k = a * sqrt(1 + g * g);
  for (let ui = floor(u0); ui <= floor(u1); ui++) {
    const cover = min(u1, ui + 1) - max(u0, ui);
    if (cover <= 0) continue;
    const um = (max(u0, ui) + min(u1, ui + 1)) / 2;
    const vv = v0 + g * (um - u0) - 0.5, vi = floor(vv), f = vv - vi;
    for (let s = 0; s < 2; s++) {
      const p = vi + s, w = (s ? f : 1 - f) * cover * k;
      const x = steep ? p : ui, y = steep ? ui : p;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const o = (y * W + x) * 3;
      acc[o] += c[0] * w;
      acc[o + 1] += c[1] * w;
      acc[o + 2] += c[2] * w;
    }
  }
}

// The kink across a shell centred on row cy, from the inner face to the
// outer one. In a thin shell the line runs along the shell, so it is drawn
// as a spiral piece round the shell's centre: angle and radius both go
// linearly from one end to the other. A straight chord would cut through
// the inside once the kink spans a wide angle, as it does above 0.5 c. It
// is drawn twice, 0.9 LED apart, so it reads two LEDs wide.
function arc(acc, cy, x0, y0, x1, y1, c, a) {
  const r0 = sqrt((x0 - XC) ** 2 + (y0 - cy) ** 2), r1 = sqrt((x1 - XC) ** 2 + (y1 - cy) ** 2);
  const f0 = Math.atan2(x0 - XC, y0 - cy), f1 = Math.atan2(x1 - XC, y1 - cy);
  const steps = 1 + floor(max(abs(f1 - f0) * max(r0, r1), abs(r1 - r0)) / 1.5);
  for (let side = -1; side <= 1; side += 2) {
    let px = 0, py = 0;
    for (let s = 0; s <= steps; s++) {
      const f = f0 + ((f1 - f0) * s) / steps, r = r0 + ((r1 - r0) * s) / steps + side * 0.45;
      const qx = XC + r * sin(f), qy = cy + r * cos(f);
      if (s) line(acc, px, py, qx, qy, c, a * 0.7);
      px = qx;
      py = qy;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const acc = S.acc, T = S.T, ch = S.ch, m = ch.length, hue = S.hue;
  acc.fill(0);
  // The shells, newest last: centre row, radius, thickness, and for the
  // region just inside each one the velocity and where the charge would
  // now be had it kept that velocity.
  const sh = S.sh;
  sh.length = 0;
  for (let i = 0; i < m; i++) {
    const r = C * (T - ch[i].t), b = abs(ch[i].u) / C, ub = i ? ch[i - 1].u : S.u0;
    sh.push({
      cy: ch[i].p, r, w: min(SHELL, 1.2 * r * (1 - b)), u: ch[i].u, s: ch[i].p + ch[i].u * (T - ch[i].t),
      jump: abs(ch[i].u - ub) / (2 * C),
    });
  }
  // Region i lies inside shell i and outside shell i + 1; region -1 lies
  // outside every shell and holds the velocity before the oldest change.
  const sOut = m ? ch[0].p + S.u0 * (T - ch[0].t) : posAt(S, T);
  // Tints: news of moving down, moving up, standing.
  const tint = S.col;
  hsv(wheel(0.59 + hue), 0.9, 0.25, tint[0]);
  hsv(wheel(0.14 + hue), 0.85, 0.2, tint[1]);
  hsv(wheel(0.36 + hue), 0.4, 0.09, tint[2]);
  const glow = hsv(wheel(0.99 + hue), 0.65, 1, S.sc);
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - XC, o = (y * W + x) * 3;
      let reg = -1, g = 0;
      for (let i = 0; i < m; i++) {
        const e = sh[i], dy = py - e.cy, dd = sqrt(px * px + dy * dy);
        if (dd < e.r) reg = i;
        // A faint ring on every shell, brightest at right angles to the
        // motion: the radiated energy goes as sin^2.
        const q = (dd - e.r) / 1.6;
        if (q > -3 && q < 3 && dd > 0.1) {
          const sn = px / dd;
          g += e.jump * (0.12 + 0.88 * sn * sn) * exp(-q * q) * (40 / (40 + e.r));
        }
      }
      const u = reg < 0 ? S.u0 : sh[reg].u, tc = u > 0 ? tint[0] : u < 0 ? tint[1] : tint[2];
      acc[o] = tc[0] + glow[0] * g * 0.5;
      acc[o + 1] = tc[1] + glow[1] * g * 0.5;
      acc[o + 2] = tc[2] + glow[2] * g * 0.5;
    }
  }
  // The field lines. Line j has the angle theta it would have round a
  // charge at rest. In a region whose charge moves at beta it leaves that
  // charge's extrapolated place at theta' with tan theta' = gamma tan theta
  // (Heaviside's field, squeezed towards the plane across the motion).
  const lc = hsv(wheel(0.45 + hue), 0.12, 1, S.lc), kc = hsv(wheel(0.99 + hue), 0.45, 1, S.kc);
  const n = S.n;
  const dirs = new Float32Array(2 * (m + 1));
  for (let j = 0; j < n; j++) {
    const th = ((j + 0.5) * 2 * PI) / n, st = sin(th), ct = cos(th);
    // Directions per region; slot m holds region -1.
    for (let i = -1; i < m; i++) {
      const u = i < 0 ? S.u0 : sh[i].u, b = abs(u) / C, gm = 1 / sqrt(1 - b * b);
      const ex = gm * st, ey = ct, l = sqrt(ex * ex + ey * ey), k = i < 0 ? 2 * m : 2 * i;
      dirs[k] = ex / l;
      dirs[k + 1] = ey / l;
    }
    // From the charge out: the newest region first.
    let ax = XC, ay = m ? sh[m - 1].s : sOut;
    const kink = 0.25 + 0.95 * abs(st);
    for (let i = m - 1; i >= -1; i--) {
      const k = i < 0 ? 2 * m : 2 * i, dx = dirs[k], dy = dirs[k + 1];
      const sx = XC, sy = i < 0 ? sOut : sh[i].s;
      // Where this region's spoke starts: at the charge, or where its ray
      // leaves the outer face of the shell inside it.
      let t0 = 0;
      if (i < m - 1) t0 = exitRay(sx, sy, dx, dy, sh[i + 1].cy, sh[i + 1].r + sh[i + 1].w / 2);
      const bx0 = sx + dx * t0, by0 = sy + dy * t0;
      if (i < m - 1) arc(acc, sh[i + 1].cy, ax, ay, bx0, by0, kc, kink);
      // Where it ends: the inner face of its own shell, or far off.
      let t1 = i < 0 ? 400 : exitRay(sx, sy, dx, dy, sh[i].cy, sh[i].r - sh[i].w / 2);
      if (t1 < t0) t1 = t0;
      const ex = sx + dx * t1, ey = sy + dy * t1;
      line(acc, bx0, by0, ex, ey, lc, 0.46);
      ax = ex;
      ay = ey;
      if (ex < -2 || ex > W + 2 || ey < -2 || ey > H + 2) {
        // Off the panel; the rest of the chain could still swing back in
        // through a kink, so keep going only while it is near.
        if (ex < -40 || ex > W + 40 || ey < -40 || ey > H + 40) break;
      }
    }
  }
  // The charge itself.
  const qy = m ? sh[m - 1].s : sOut, cc = hsv(wheel(0.45 + hue), 0.15, 1, S.c);
  for (let y = floor(qy - 4); y <= qy + 4; y++)
    for (let x = XC - 5; x < XC + 5; x++) {
      if (y < 0 || y >= H) continue;
      const dx = x + 0.5 - XC, dy = y + 0.5 - qy, d2 = dx * dx + dy * dy, v = 1.3 * exp(-d2 / 1.6) + 0.25 * exp(-d2 / 7);
      const o = (y * W + x) * 3;
      acc[o] += cc[0] * v;
      acc[o + 1] += cc[1] * v;
      acc[o + 2] += cc[2] * v;
    }
  // Where lines pile up, scale the LED down as a whole instead of clipping
  // each channel, so a crowded kink stays rose and does not wash to white.
  for (let p = 0, o = 0; p < W * H; p++, o += 3) {
    const pk = max(1, acc[o], acc[o + 1], acc[o + 2]), k = 255 / pk;
    display.setPixel(p % W, (p / W) | 0, (acc[o] * k) | 0, (acc[o + 1] * k) | 0, (acc[o + 2] * k) | 0);
  }
}
