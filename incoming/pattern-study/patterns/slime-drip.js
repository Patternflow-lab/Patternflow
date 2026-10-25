// ===== Patternflow pattern =====
// Title:   Slime Drip
// Family:  halloween
// Idea:    Toxic green ectoplasm oozes from under a purple stone ledge along the top edge, bulges swell and stretch into drips whose necks thin and pinch off, some hanging long on a thread and swaying before they snap, and the drops fall the full height of the panel to splat into a glowing puddle at the bottom that grows and bubbles.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 44
// Round:   44
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Drips=5..12, Viscosity=-1..1
//
// Knob 1: Hue. The slime's colour, the stone opposite it on the wheel. At 0 toxic green on purple stone; at 0.3 aqua on dark red, at 0.5 blue, at 0.75 violet on olive and at 1 pink. The warm hues from red to yellow are left out: in the slime's dark edges and its glow they turn brown.
// Knob 2: Speed. At 2 a drip swells for half a second and stretches for 2 to 2.6 s, a drip on a thread hangs and sways 2.3 to 3.3 s more, and a drop falls from row 10 to the puddle in 1.1 s at up to 130 rows a second; at 0.2 all of it ten times slower, at 3 half as fast again.
// Knob 3: Drips. How many drips hang from the ledge, 5 to 12, spread along it. At 5 about 0.9 drops fall a second and the puddle rises from 9 rows deep at the start to 18 in a minute; at 12 about 2.1 a second and it rises to 26.
// Knob 4: Viscosity. How thick the slime is. At -1 it runs: drops 4 to 6 LEDs across let go about 19 rows down, 1.6 a second, and one drip at a time hangs long on a thread. At 0.06 drops 7 or 8 across let go anywhere from row 28 to 96, 0.9 a second, and three drips of five hang on threads at a time, swaying, with lumps of goo sliding down them. At 1 every drip stretches to row 74 to 102 on a thread before it drops 9 or 10 LEDs across, 0.5 a second.

const W = 64, H = 128, STONE = 4;
const { floor, ceil, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + (b - a) * Math.random();

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// Tones: 0 dark, 1 glow, 2 slime edge, 3 slime, 4 slime core, 5 shine,
// 6 stone, 7 stone lip, 8 deep puddle, 9 bubble, 10 faint glow.
const SLIME = 2;

export function setup(params) {
  params.s = {
    begun: false, t: 0, hue: 0, speed: 1, n: 0, visc: 0.53,
    drips: [], drops: [], bits: [], rips: [], bubs: [], flashes: [],
    level: 6, bubWait: 0.3,
    tone: new Uint8Array(W * H), pal: Array.from({ length: 11 }, () => [0, 0, 0]),
  };
}

// The underside of the slime coat on the stone, a slow wave.
const coat = (S, x) => 7.5 + 1.3 * sin(x * 0.21 + S.t * 0.5) + 0.8 * sin(x * 0.53 - S.t * 0.8);

function newCycle(S, d) {
  const v = S.visc;
  d.phase = "swell";
  d.pt = 0;
  d.Rt = 2.2 + 2.2 * v + rnd(0, 0.8);
  // Drips take turns at hanging long: a drip hangs when fewer than the
  // share of them are hanging already.
  let hanging = 0;
  for (const o of S.drips) if (o !== d && o.long && o.phase !== "rest" && o.phase !== "recoil") hanging++;
  d.long = hanging < round(S.n * (0.1 + 0.8 * v)) || Math.random() < 0.1;
  d.Lp = d.long ? rnd(50, 95) : 10 + 10 * v + rnd(0, 40 * v);
  d.T = 0.8 + 2.2 * v + rnd(0, 0.6);
  d.hang = 1.2 + 2 * v + rnd(0, 1);
  d.amp = d.long ? rnd(0.07, 0.16) : rnd(0.02, 0.06);
  d.w = rnd(2.2, 3.4);
  d.ph = rnd(0, 2 * PI);
  d.Ls = d.L;
}

function build(S, n) {
  S.n = n;
  S.drips = [];
  const slot = W / n;
  for (let i = 0; i < n; i++) {
    const d = {
      x: (i + 0.5) * slot + rnd(-0.15, 0.15) * slot, root: min(slot * 0.36, 3 + 1.5 * S.visc + rnd(0, 1)),
      L: 2, R: 1.2, neck: 1.5, th: 0, phase: "rest", pt: 0, lump: -rnd(0, 20),
      // Starts spread over a whole cycle, so the drips never fall in step.
      wait: (((i * 0.618) % 1) + rnd(0, 0.1)) * (1.5 + 5 * S.visc),
    };
    S.drips.push(d);
  }
}

// The surface of the puddle at column x, in rows from the top.
function surface(S, x) {
  let y = H - S.level;
  for (const r of S.rips) {
    const dx = abs(x - r.x), front = 16 * r.age + 2;
    if (dx > front) continue;
    y -= r.a * exp(-r.age * 1.8 - dx / 22) * cos(0.7 * dx - 10 * r.age);
  }
  return y;
}

function splat(S, x, y, R, vy) {
  S.level += (PI * R * R) / W;
  S.rips.push({ x, age: 0, a: 0.5 + 0.35 * R });
  S.flashes.push({ x, y, age: 0, r: R });
  const n = 3 + round(R * 1.6);
  for (let i = 0; i < n; i++)
    S.bits.push({ x, y: y - 1, vx: rnd(-1, 1) * (18 + 8 * R), vy: -rnd(25, 45 + 0.1 * vy) * sqrt(R / 3), big: Math.random() < 0.35 });
}

function step(S, dt) {
  S.t += dt;
  const g = 260;
  for (const d of S.drips) {
    d.pt += dt;
    // Lumps of goo slide down a long drip into its bulb.
    d.lump += 16 * dt;
    if (d.lump > d.L) d.lump = -rnd(4, 16);
    if (d.phase === "rest") {
      if (d.pt > d.wait) newCycle(S, d);
    } else if (d.phase === "swell") {
      const u = cl(d.pt / 0.5, 0, 1);
      d.R = 1.2 + (d.Rt * 0.7 - 1.2) * u;
      d.L = d.Ls + (d.R + 1 - d.Ls) * u;
      d.neck = d.root * (0.9 - 0.3 * u);
      if (u >= 1) (d.phase = "stretch"), (d.pt = 0), (d.Ls = d.L), (d.n0 = d.neck);
    } else if (d.phase === "stretch") {
      // The bulb grows and sinks faster as it fills; the neck above it thins.
      const u = cl(d.pt / d.T, 0, 1);
      d.R = d.Rt * (0.7 + 0.3 * u);
      d.L = d.Ls + (d.Lp - d.Ls) * u * u * (1.5 - 0.5 * u);
      // A drip that will hang keeps a thread 2 LEDs wide; the others thin to one.
      const thin = d.long ? 1 : 0.5;
      d.neck = thin + (d.n0 - thin) * (1 - u) ** 1.4;
      if (u >= 1) {
        if (d.long) (d.phase = "hang"), (d.pt = 0), (d.L0 = d.L);
        else pinch(S, d);
      }
    } else if (d.phase === "hang") {
      // On a thread: the bulb sways like a pendulum and creeps lower.
      d.L = d.L0 + 8 * (d.pt / d.hang) + 1.5 * sin(d.pt * 7);
      if (d.pt > d.hang) pinch(S, d);
    } else if (d.phase === "recoil") {
      // What is left above the pinch snaps back up and wobbles.
      const u = d.pt;
      d.L = d.stub + (d.Lr - d.stub) * exp(-u * 11) + 1.2 * sin(u * 26) * exp(-u * 5);
      d.R = 1.3;
      d.neck = d.root * 0.6 * (1 - exp(-u * 4)) + 0.5;
      if (u > 0.6) (d.phase = "rest"), (d.pt = 0), (d.wait = rnd(0.1, 0.7));
    }
    // Sway: the angle of the bulb under the root.
    if (d.phase === "recoil") d.th = d.th0 * exp(-d.pt * 5);
    else d.th = (d.phase === "hang" ? d.amp * min(1, d.pt / 0.6) : d.amp * 0.4) * sin(d.pt * d.w + d.ph);
  }
  // Drops fall, with air holding them under 130 rows a second.
  for (const p of S.drops) {
    p.vy += (g - 0.0154 * p.vy * p.vy) * dt;
    p.y += p.vy * dt;
    p.x += p.vx * dt;
    p.vx *= exp(-dt * 1.5);
    if (p.x < p.R) (p.x = p.R), (p.vx = abs(p.vx));
    if (p.x > W - p.R) (p.x = W - p.R), (p.vx = -abs(p.vx));
    if (p.y + p.R >= surface(S, p.x)) (p.dead = true), splat(S, p.x, surface(S, p.x), p.R, p.vy);
  }
  S.drops = S.drops.filter((p) => !p.dead);
  for (const b of S.bits) {
    b.vy += g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.vy > 0 && b.y >= surface(S, b.x)) b.dead = true;
    if (b.x < 0 || b.x >= W) b.dead = true;
  }
  S.bits = S.bits.filter((b) => !b.dead);
  for (const r of S.rips) r.age += dt;
  S.rips = S.rips.filter((r) => r.age < 2.5);
  for (const f of S.flashes) f.age += dt;
  S.flashes = S.flashes.filter((f) => f.age < 0.2);
  // The puddle drains slowly toward 6 rows.
  S.level -= (S.level - 6) * 0.06 * dt;
  S.level = min(S.level, 26);
  // Bubbles rise through the puddle, swell into a dome and pop.
  S.bubWait -= dt;
  if (S.bubWait <= 0) {
    S.bubWait = rnd(0.15, 0.6);
    S.bubs.push({ x: rnd(3, W - 3), y: H - 1, r: rnd(1, 1.6), vy: rnd(5, 10), dome: -1 });
  }
  for (const b of S.bubs) {
    const top = surface(S, b.x);
    if (b.dome < 0) {
      b.y -= b.vy * dt;
      b.r = min(b.r + dt * 1.2, 3);
      if (b.y - b.r <= top) b.dome = 0;
    } else {
      b.dome += dt;
      b.y = top;
      if (b.dome > 0.45) {
        b.dead = true;
        S.flashes.push({ x: b.x, y: top - b.r, age: 0, r: b.r * 0.7 });
        for (let i = 0; i < 2; i++) S.bits.push({ x: b.x, y: top - b.r, vx: rnd(-14, 14), vy: rnd(-40, -20), big: false });
      }
    }
  }
  S.bubs = S.bubs.filter((b) => !b.dead);
}

function pinch(S, d) {
  const X = d.L * sin(d.th), y = coat(S, d.x) + d.L;
  const swing = d.L * d.amp * d.w * cos(d.pt * d.w + d.ph);
  S.drops.push({ x: d.x + X, y, vx: d.phase === "hang" ? swing : 0, vy: 15, R: d.R });
  // Now and then a small satellite drop from the neck.
  if (Math.random() < 0.5) S.drops.push({ x: d.x + X * 0.85, y: y - d.R - 2, vx: 0, vy: 5, R: 1 });
  d.phase = "recoil";
  d.pt = 0;
  d.th0 = d.th;
  d.Lr = max(3, d.L - d.R * 1.6);
  d.stub = rnd(3, 8);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 5, 0.06];
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3) / 2;
  S.visc = (cl(k[3], -1, 1) + 1) / 2;
  const n = cl(round(k[2]), 5, 12);
  if (n !== S.n) build(S, n);
  if (!S.begun) {
    // The first frame is a drip already running: 8 s of it, run at once.
    S.begun = true;
    for (let i = 0; i < 240; i++) step(S, 1 / 30);
  }
  step(S, cl(dt || 0, 0, 0.1) * S.speed);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.begun) return;
  const { tone, pal } = S;
  tone.fill(0);
  const put = (x, y, v) => {
    x = floor(x);
    y = floor(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = y * W + x;
    if (v > tone[o] || tone[o] >= 8 || tone[o] === 1) tone[o] = v;
  };
  // A horizontal run of slime at row y between xa and xb, lit from the left.
  const span = (y, xc, h) => {
    const a = floor(xc - h + 0.5), b = max(a, floor(xc + h - 0.5));
    for (let x = a; x <= b; x++) {
      const u = h < 1.2 ? 0 : (x + 0.5 - xc) / h;
      put(x, y, u > 0.7 || u < -0.85 ? 2 : u > -0.6 && u < -0.15 ? 4 : 3);
    }
  };
  // The stone ledge and its slime coat.
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < STONE; y++) put(x, y, y === STONE - 1 || ((x * 7 + y * 13) % 11 === 0 && y > 0) ? 7 : 6);
    const c = round(coat(S, x));
    for (let y = STONE; y < c; y++) put(x, y, y === STONE ? 4 : y === c - 1 ? 2 : 3);
  }
  // Drips: a root that tapers into the neck, and the bulb under it.
  for (const d of S.drips) {
    const y0 = coat(S, d.x) - 1, X = d.L * sin(d.th), k = 3 + 0.12 * d.L;
    const yb = y0 + d.L * cos(d.th), R = d.R, ry = R * 1.12;
    for (let y = floor(y0); y <= min(H - 1, ceil(yb + ry)); y++) {
      const dd = y + 0.5 - y0;
      if (dd <= d.L) {
        const f = dd / max(1, d.L);
        const lump = d.L > 18 && (d.phase === "stretch" || d.phase === "hang") ? 1.1 * exp(-(((dd - d.lump) / 2.5) ** 2)) : 0;
        span(y, d.x + X * f * f, d.neck + (d.root - d.neck) * exp(-dd / k) + lump);
      }
      const dy = (y + 0.5 - yb) / ry;
      if (abs(dy) < 1) span(y, d.x + X, R * sqrt(1 - dy * dy));
    }
    if (R > 2) put(d.x + X - R * 0.45, yb - ry * 0.45, 5);
  }
  // Falling drops: round below, drawn out to a point above as they speed up.
  for (const p of S.drops) {
    const s = 1 + p.vy / 260, rx = p.R / sqrt(s), ry = p.R * s;
    for (let y = floor(p.y - ry * 1.7); y <= p.y + ry; y++) {
      const dy = (y + 0.5 - p.y) / ry;
      const h = dy >= 0 ? rx * sqrt(max(0, 1 - dy * dy)) : rx * max(0, 1 + dy / 1.7) ** 1.4;
      if (h > 0.3) span(y, p.x, max(0.5, h));
    }
    if (p.R > 1.5) put(p.x - rx * 0.4, p.y - ry * 0.35, 5);
  }
  // The puddle: a bright skin, slime under it and deep slime below.
  for (let x = 0; x < W; x++) {
    const top = round(surface(S, x));
    for (let y = max(0, top); y < H; y++) put(x, y, y === top ? 4 : y < top + 4 ? 3 : 8);
  }
  for (const b of S.bubs) {
    if (b.dome < 0) {
      // A rising bubble: a bright ring in the deep slime.
      const r = b.r;
      for (let a = 0; a < 12; a++) put(b.x + r * cos((a * PI) / 6), b.y + r * sin((a * PI) / 6), 9);
    } else {
      const r = b.r * min(1, b.dome / 0.2 + 0.3);
      for (let y = floor(b.y - r); y <= b.y; y++) {
        const dy = (y + 0.5 - b.y) / r;
        if (abs(dy) < 1) span(y, b.x, r * sqrt(1 - dy * dy));
      }
      put(b.x - r * 0.4, b.y - r * 0.6, 5);
    }
  }
  for (const b of S.bits) {
    put(b.x, b.y, 3);
    if (b.big) put(b.x + 1, b.y, 3), put(b.x, b.y - 1, 4);
  }
  for (const f of S.flashes) {
    const r = f.r + f.age * 40;
    for (let a = 0; a < 16; a++) put(f.x + r * cos((a * PI) / 8), f.y - abs(r * 0.6 * sin((a * PI) / 8)), 5);
  }
  // Glow: one LED of light round every bit of slime.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      if (tone[o]) continue;
      let lit = false;
      for (let j = max(0, y - 1); j <= min(H - 1, y + 1) && !lit; j++)
        for (let i = max(0, x - 1); i <= min(W - 1, x + 1); i++) {
          const v = tone[j * W + i];
          if (v >= SLIME && v <= 5) {
            lit = true;
            break;
          }
        }
      if (lit) tone[o] = 1;
    }
  // And a fainter LED round that.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      if (tone[o]) continue;
      if ((x > 0 && tone[o - 1] === 1) || (x < W - 1 && tone[o + 1] === 1) || (y > 0 && tone[o - W] === 1) || (y < H - 1 && tone[o + W] === 1)) tone[o] = 10;
    }
  const h = 0.31 + 0.62 * S.hue;
  hsv(h, 1, 0.26, pal[1]);
  hsv(h, 1, 0.13, pal[10]);
  hsv(h + 0.01, 1, 0.55, pal[2]);
  hsv(h, 0.92, 0.86, pal[3]);
  hsv(h - 0.04, 0.6, 1, pal[4]);
  hsv(h - 0.04, 0.16, 1, pal[5]);
  hsv(h + 0.47, 0.6, 0.3, pal[6]);
  hsv(h + 0.47, 0.5, 0.46, pal[7]);
  hsv(h + 0.02, 1, 0.42, pal[8]);
  hsv(h + 0.47, 0.45, 0.9, pal[9]);
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) {
      const t = tone[o];
      if (!t) continue;
      const c = pal[t];
      display.setPixel(x, y, round(c[0] * 255), round(c[1] * 255), round(c[2] * 255));
    }
}
