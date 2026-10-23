// ===== Patternflow pattern =====
// Title:   Server Rack
// Family:  circuit
// Idea:    A 42U server rack seen from the front fills the panel, and traffic that reaches the switch at the top ripples down through the servers as bursts of drive light while a backup sweeps the storage shelves and the UPS at the bottom shows the load.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 18, after the processor activity lights on the front of the Apple Xserve
// Round:   18
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Load=0..1, Aisle=0..1
//
// Knob 1: Hue. The colour of the status lights: green at 0, then blue, violet and orange, green again at 1; a failed drive stays amber.
// Knob 2: Speed. How fast the rack runs: at 2 the load rises and falls every 12 s, and every 10 s the backup writes all 65 storage drives in 4 s.
// Knob 3: Load. At 0 each load wave lifts the meters from nearly empty to most of the way up; at 1 the rack is saturated, every meter stays near the top and the drive lights flicker about five times as often.
// Knob 4: Aisle. Blue light from the perforated floor tiles in front of the rack, from nothing at 0 to a glow that washes the lower faceplates at 1.

const W = 64;
const H = 128;
const N = W * H;
// Rack units are 3 rows. Equipment sits between the posts, ears on columns 5 and 58.
const U = 3;
const X0 = 6;
const X1 = 57;
// Top to bottom, unit by unit: what is mounted and how many units it takes.
const RACK = [
  ["patch", 1], ["manager", 1], ["switch", 2], ["manager", 1],
  ["s1", 1], ["s1", 1], ["s1", 1], ["s1", 1], ["blank", 1],
  ["s2", 2], ["s2", 2], ["s1", 1], ["s1", 1], ["s2", 2], ["blank", 1],
  ["s2", 2], ["s1", 1], ["s1", 1], ["blank", 1], ["s2", 2],
  ["head", 2], ["shelf", 2], ["shelf", 2], ["blank", 1],
  ["s2", 2], ["kvm", 1], ["s1", 1], ["blank", 1], ["ups", 3],
];
// Patch cord colours: blue, yellow, red, green, white, grey, orange, violet, cyan.
const CORDS = [[40, 96, 230], [236, 200, 40], [220, 44, 40], [40, 186, 76], [210, 210, 210], [128, 128, 140], [244, 124, 24], [150, 64, 210], [40, 200, 214]];
const AMBER = [255, 138, 0];
const BLUE = [60, 120, 255];
// How much of a busy server's light shows through the holes of its bezel, how bright a
// written drive's light pipe is, and how much of a lamp spills onto each LED of metal
// beside it (the corners get 0.4 of that).
const BLEED = 0.2;
const PIPE = 0.8;
const SPILL = 0.25;
const SPILL_AT = [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hsv(h, s, v) {
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}

// The still rack: faceplates, posts, caddies and cords, and the list of every light on it.
function build(P) {
  const base = P.base;
  const wash = P.wash;
  const put = (x, y, c, refl = 0.5) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = y * W + x;
    base[p * 3] = c[0];
    base[p * 3 + 1] = c[1];
    base[p * 3 + 2] = c[2];
    wash[p] = refl;
  };
  const metal = (x, y, v, refl) => {
    const g = v + 2 * (hash(x, y, 3) - 0.5);
    put(x, y, [g, g + 1, g + 3], refl);
  };
  const leds = [];
  const led = (x, y, kind, dev, arg = 0) => leds.push({ p: y * W + x, kind, dev, arg, on: 0, next: 0 });
  P.devs = [];
  P.caddies = [];
  P.holes = [];
  // The rack frame: side panels, posts with square holes, and the cable channels between.
  for (let y = 0; y < H; y++) {
    for (const x of [0, 63]) metal(x, y, 11, 0.3);
    for (const x of [1, 2, 3, 60, 61, 62]) put(x, y, [5, 5, 6], 0.15);
    for (const x of [4, 59]) {
      const hole = (y - 1) % U !== 1 && y > 0 && y < H - 1;
      if (hole) put(x, y, [3, 3, 4], 0.1);
      else metal(x, y, 19, 0.9);
    }
  }
  for (let x = 0; x < W; x++) {
    metal(x, 0, 14, 0.4);
    metal(x, H - 1, 14, 1.2);
  }
  let row = 1;
  RACK.forEach(([type, units], di) => {
    const top = row;
    const h = units * U;
    row += h;
    const dev = { type, top, h, load: 0.2, kick: 0, act: 0.2, flash: -1, phase: hash(di, 1, 9) };
    P.devs.push(dev);
    const d = P.devs.length - 1;
    for (let y = top; y < top + h; y++) {
      metal(5, y, 23, 1);
      metal(58, y, 23, 1);
      // Each faceplate catches light on its top edge and has a dark seam under it.
      const v = type === "blank" ? 13 : 16;
      for (let x = X0; x <= X1; x++) metal(x, y, y === top ? v + 7 : y === top + h - 1 ? v - 5 : v, y === top ? 1 : 0.6);
    }
    // Ear screws.
    for (const x of [5, 58]) {
      put(x, top + 1, [44, 44, 48], 1);
      if (h > 3) put(x, top + h - 2, [44, 44, 48], 1);
    }
    const vent = (x0, x1, y) => {
      for (let x = x0; x <= x1; x++) {
        metal(x, y, (x + y) % 2 ? 9 : 20, 0.5);
        if ((x + y) % 2 && type[0] === "s") P.holes.push(y * W + x, d);
      }
    };
    if (type === "blank") {
      for (let x = X0; x <= X1; x++) metal(x, top, 20, 0.9);
    } else if (type === "manager") {
      for (let y = top; y < top + h; y++) for (let x = X0; x <= X1; x++) put(x, y, [7, 7, 8], 0.2);
      for (let x = X0 + 1; x <= X1; x += 4) for (let y = top; y < top + h; y++) put(x, y, y === top ? [24, 24, 27] : [14, 14, 16], 0.4);
    } else if (type === "patch") {
      for (let i = 0; i < 24; i++) {
        const x = X0 + 2 * i + Math.floor(i / 6);
        put(x, top + 1, [4, 4, 5], 0.1);
        put(x + 1, top + 1, [4, 4, 5], 0.1);
        put(x, top + 2, [30, 30, 33], 0.6);
      }
    } else if (type === "switch") {
      for (let i = 0; i < 24; i++) {
        const x = X0 + 2 * i + Math.floor(i / 6);
        for (const [r, side] of [[2, 1], [3, 0]]) {
          put(x, top + r, [4, 4, 5], 0.1);
          put(x + 1, top + r, [4, 4, 5], 0.1);
          led(x, top + (side ? 1 : 4), "port", d, i * 2 + side);
        }
      }
      for (let i = 0; i < 4; i++) led(X0 + 40 + 3 * i, top + 5, "sfp", d, i);
      led(X0 + 1, top, "pwr", d);
      led(X0 + 3, top, "stat", d);
    } else if (type === "s1" || type === "s2") {
      const m = type === "s1" ? [1] : [1, 3];
      for (let y = top; y < top + h; y++) if (!m.includes(y - top)) vent(14, 37, y);
      // Load meters of eight two-LED segments, one per processor.
      for (const r of m) for (let k = 0; k < 16; k++) led(14 + 3 * (k >> 1) + (k & 1), top + r, "meter", d, (k >> 1) + 8 * (r > 1));
      led(9, top + 1, "pwr", d);
      led(11, top + 1, "stat", d);
      led(12, top + h - 2, "id", d);
      if (type === "s1") {
        for (let b = 0; b < 9; b++) {
          const x = 39 + 2 * b;
          for (let y = top; y < top + 3; y++) {
            metal(x, y, 27, 0.8);
            metal(x + 1, y, 33, 1);
          }
          led(x + 1, top, "act", d);
          led(x + 1, top + 2, "dstat", d);
        }
      } else {
        for (let b = 0; b < 6; b++) {
          const x = 39 + 9 * (b % 2);
          const y0 = top + 2 * Math.floor(b / 2);
          for (let y = y0; y < y0 + 2; y++)
            for (let i = 0; i < 8; i++) metal(x + i, y, i === 0 ? 34 : (i + y) % 3 ? 26 : 21, 0.8);
          led(x + 7, y0, "act", d);
          led(x + 7, y0 + 1, "dstat", d);
        }
      }
    } else if (type === "head" || type === "shelf") {
      const first = type === "head" ? 22 : X0;
      const count = type === "head" ? 17 : 24;
      if (type === "head") {
        // The controller: a small backlit LCD that shows the array and any rebuild.
        for (let y = top + 1; y <= top + 2; y++) for (let x = 8; x <= 19; x++) put(x, y, [8, 22, 24], 0.3);
        P.lcd = { x: 8, y: top + 1 };
        led(8, top + 4, "pwr", d);
        led(10, top + 4, "stat", d);
        led(12, top + 4, "cache", d);
      } else {
        led(55, top + 1, "pwr", d);
        led(55, top + 3, "stat", d);
      }
      for (let c = 0; c < count; c++) {
        const x = first + 2 * c;
        for (let y = top; y < top + 5; y++) {
          metal(x, y, y === top ? 34 : 27, 0.8);
          metal(x + 1, y, 22, 0.6);
        }
        P.caddies.push({ x, top, dev: d });
        led(x, top + 5, "cact", d, P.caddies.length - 1);
        led(x + 1, top + 5, "cstat", d, P.caddies.length - 1);
      }
    } else if (type === "kvm") {
      for (let x = 20; x <= 43; x++) metal(x, top + 1, 34, 1);
      led(10, top + 1, "pwr", d);
    } else if (type === "ups") {
      // The UPS: an LCD with the load and battery bars, three lamps and a wide grille.
      for (let y = top + 2; y <= top + 6; y++) for (let x = 9; x <= 30; x++) put(x, y, [14, 26, 40], 0.3);
      for (let k = 0; k < 20; k++) {
        led(10 + k, top + 3, "upsload", d, k);
        led(10 + k, top + 4, "upsload", d, k);
        led(10 + k, top + 6, "upsbatt", d, k);
      }
      led(34, top + 3, "pwr", d);
      led(36, top + 3, "stat", d);
      for (let y = top + 1; y < top + h - 1; y++) vent(40, 56, y);
      for (let x = X0; x <= X1; x++) metal(x, top + h - 1, 22, 1);
    }
    // A front network port on each server, fed from a side channel.
    if (type[0] === "s" || type === "head") {
      put(X0, top + 1, [4, 4, 5], 0.1);
      put(X1, top + 1, [4, 4, 5], 0.1);
    }
  });
  // Patch cords: the switch's upper ports run straight up to the patch panel; the
  // lower ports drop into the manager, run out to the side channels and down to a server.
  const sw = P.devs[2];
  const mg = P.devs[3];
  const targets = P.devs.map((d, i) => i).filter((i) => P.devs[i].type[0] === "s" || P.devs[i].type === "head");
  let left = 0;
  let right = 0;
  P.linked = new Uint8Array(48);
  for (let i = 0; i < 24; i++) {
    const x = X0 + 2 * i + Math.floor(i / 6);
    const c = CORDS[(i * 5 + 2) % CORDS.length];
    const dim = (k) => [c[0] * k, c[1] * k, c[2] * k];
    if (i % 7 !== 5) {
      P.linked[i * 2 + 1] = 1;
      put(x, sw.top + 2, dim(0.5), 0.2);
      put(x + 1, sw.top + 2, dim(0.38), 0.2);
      for (let y = 2; y < sw.top + 1; y++) put(x + 1, y, dim(y < 4 ? 0.5 : 0.36), 0.2);
      put(x, 2, dim(0.5), 0.2);
    }
    if (i % 3 === 1) continue;
    P.linked[i * 2] = 1;
    put(x, sw.top + 3, dim(0.5), 0.2);
    put(x + 1, sw.top + 3, dim(0.38), 0.2);
    const goLeft = x < 32;
    const n = goLeft ? left++ : right++;
    const t = targets[(goLeft ? 2 * n : 2 * n + 1) % targets.length];
    const ty = P.devs[t].top + 1;
    const lane = mg.top + (n % 3);
    const cx = goLeft ? 1 + (n % 3) : 62 - (n % 3);
    for (let y = sw.top + 4; y <= lane; y++) put(x + 1, y, dim(0.4), 0.2);
    for (let xx = Math.min(x + 1, cx); xx <= Math.max(x + 1, cx); xx++) put(xx, lane, dim(0.34 + 0.06 * (xx % 2)), 0.2);
    for (let y = lane; y <= ty; y++) put(cx, y, dim(0.3 + 0.08 * ((y >> 2) % 2)), 0.2);
    for (let xx = Math.min(cx, goLeft ? X0 : X1); xx <= Math.max(cx, goLeft ? X0 : X1); xx++) put(xx, ty, dim(0.42), 0.2);
  }
  P.leds = leds;
  // The floor tiles' light falls off up the rack and catches bright metal most.
  for (let y = 0; y < H; y++) {
    const f = Math.exp(-(H - 1 - y) / 38);
    for (let x = 0; x < W; x++) P.wash[y * W + x] *= f;
  }
}

export function setup(params) {
  const P = params;
  P.base = new Float32Array(N * 3);
  P.wash = new Float32Array(N);
  P.buf = new Float32Array(N * 3);
  build(P);
  Object.assign(P, { t: 0, hue: 0, speed: 2, load: 0, cold: 0.06, bursts: [], sweep: -20, reset: -99, fault: -1, rebuild: 0, nextFault: 30, started: false });
}

// The rack's load: a wave that rises and falls every 24 rack seconds and lags 45 rows a
// second down the rack, a base set by Load, and the kicks bursts of traffic leave.
function step(P, dt) {
  const g = dt * P.speed;
  P.t += g;
  const L = P.load;
  if (Math.random() < g * (0.7 + 2.6 * L)) {
    const b = { t0: P.t, seed: Math.floor(Math.random() * 1e6), s: 0.4 + 0.6 * Math.random() };
    P.bursts.push(b);
    // It comes in on the uplinks and out of a handful of ports at once.
    for (const l of P.leds)
      if (l.kind === "sfp" || (l.kind === "port" && hash(l.arg, b.seed, 6) < 0.3)) {
        l.on = 1;
        l.next = P.t + P.speed * 0.08;
      }
  }
  for (const b of P.bursts) {
    const f0 = (P.t - g - b.t0) * 45;
    const f1 = (P.t - b.t0) * 45;
    P.devs.forEach((d, i) => {
      if (d.top > f0 && d.top <= f1 && hash(i, b.seed, 5) < 0.45 + 0.4 * L) {
        d.kick += b.s;
        d.flash = P.t;
      }
    });
  }
  P.bursts = P.bursts.filter((b) => (P.t - b.t0) * 45 < H);
  // A burst that reaches a server lights its drives together for a moment, so it is seen going down.
  for (const l of P.leds)
    if (l.kind === "act" && P.devs[l.dev].flash === P.t) {
      l.on = 1;
      l.next = P.t + 0.12 + 0.12 * Math.random();
    }
  for (const d of P.devs) {
    const ph = (P.t - P.t0 - d.top / 45) / 24;
    const wave = 0.5 - 0.5 * Math.cos(2 * Math.PI * ph);
    d.kick *= Math.exp(-g / 1.6);
    const target = clamp(0.03 + 0.62 * L + (0.86 - 0.55 * L) * wave + 0.24 * Math.min(1, d.kick) + 0.05 * Math.sin(P.t * 1.3 + d.phase * 9), 0, 1);
    d.load += (target - d.load) * Math.min(1, g * 2.5);
    d.act = clamp(0.12 + 0.6 * d.load + 0.5 * d.kick, 0, 1.5);
  }
  // The backup walks the storage drives 8 a rack second, then waits 12 rack seconds.
  P.sweep += g * 8;
  if (P.sweep > P.caddies.length + 96) {
    P.sweep = -6;
    P.reset = P.t;
  }
  // Now and then a drive fails: its light goes amber and a rebuild bar crawls for 36 rack seconds.
  if (P.fault < 0 && P.t > P.nextFault) {
    P.fault = Math.floor(Math.random() * P.caddies.length);
    P.rebuild = 0;
  }
  if (P.fault >= 0) {
    P.rebuild += g / 36;
    if (P.rebuild >= 1) {
      P.fault = -1;
      P.nextFault = P.t + 14 + 30 * Math.random();
    }
  }
  for (const l of P.leds) {
    if (l.kind !== "act" && l.kind !== "cact" && l.kind !== "port" && l.kind !== "sfp") continue;
    if (P.t < l.next) continue;
    let a = P.devs[l.dev].act;
    if (l.kind === "cact" && Math.abs(l.arg - P.sweep) < 4) a = 2.5;
    if (l.kind === "sfp") a = 0.5 + L;
    if (l.kind === "port") a = P.devs[4 + ((l.arg * 7) % (P.devs.length - 5))].act;
    l.on = l.on ? 0 : 1;
    // A lamp stays lit about a tenth of a second whatever the speed, so a fast rack looks busier.
    l.next = P.t + (l.on ? P.speed * (0.04 + 0.08 * Math.random()) : (-Math.log(1 - Math.random()) * 0.3) / (a + 0.04));
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.hue = clamp(k[0], 0, 1);
  P.speed = clamp(k[1], 0.2, 3);
  P.load = clamp(k[2], 0, 1);
  P.cold = clamp(k[3], 0, 1);
  if (!P.started) {
    P.started = true;
    // The rack has run for 4 seconds at the knob's speed when the panel opens, with a
    // rebuild a third done. At Speed 2 the load wave is at its low point and the backup
    // on its first drive two seconds later; at other speeds they are further on or behind.
    P.t0 = 12;
    P.fault = 40;
    P.rebuild = 0.3;
    for (let i = 0; i < 80; i++) step(P, 0.05);
    P.sweep = -6 + 8 * (P.t - 12);
  }
  step(P, dt);
}

export function draw(display, params) {
  const P = params;
  if (!P.started) return;
  const buf = P.buf;
  const scheme = hsv((0.33 + P.hue) % 1, 0.8, 1);
  const cold = P.cold;
  const { base, wash } = P;
  for (let p = 0, q = 0; p < N; p++, q += 3) {
    const w = wash[p] * cold;
    buf[q] = base[q] + 30 * w;
    buf[q + 1] = base[q + 1] + 90 * w;
    buf[q + 2] = base[q + 2] + 210 * w;
  }
  const light = (p, c, k, sides = 8) => {
    buf[p * 3] = c[0] * k;
    buf[p * 3 + 1] = c[1] * k;
    buf[p * 3 + 2] = c[2] * k;
    // Light spills onto the faceplate round a lit lamp.
    for (let j = sides === 2 ? 2 : 0; j < (sides === 2 ? 4 : 8); j++) {
      const q = p + SPILL_AT[j];
      if (q < 0 || q >= N) continue;
      const v = k * (sides === 2 ? 0.4 : j < 4 ? SPILL : SPILL * 0.4);
      buf[q * 3] += c[0] * v;
      buf[q * 3 + 1] += c[1] * v;
      buf[q * 3 + 2] += c[2] * v;
    }
  };
  for (const l of P.leds) {
    const d = P.devs[l.dev];
    switch (l.kind) {
      case "pwr":
        light(l.p, scheme, 0.75);
        break;
      case "stat":
        light(l.p, scheme, 0.4);
        break;
      case "id":
        if ((P.t + d.phase * 40) % 40 < 3 && Math.floor(P.t * 2) % 2) light(l.p, BLUE, 0.9);
        break;
      case "act":
      case "cact":
        if (l.on) light(l.p, scheme, 0.95);
        break;
      case "port":
        if (P.linked[l.arg]) light(l.p, scheme, l.on ? 1 : 0.3);
        break;
      case "sfp":
        light(l.p, BLUE, l.on ? 1 : 0.4);
        break;
      case "dstat":
        light(l.p, scheme, 0.32);
        break;
      case "cstat":
        if (l.arg === P.fault) light(l.p, AMBER, P.rebuild < 0.04 && Math.floor(P.t * 4) % 2 ? 0.2 : 1);
        else light(l.p, scheme, 0.32);
        break;
      case "cache":
        light(l.p, AMBER, 0.3 + 0.5 * Math.min(1, d.act));
        break;
      case "meter": {
        const k = l.arg % 8;
        const load = l.arg < 8 ? d.load : d.load * 0.9 + 0.08 * Math.sin(P.t * 0.7 + d.phase * 5);
        const v = clamp(load * 8 - k, 0, 1);
        // A meter's light spills up and down only, so its segments stay apart.
        if (v > 0) light(l.p, k === 7 ? AMBER : scheme, 0.25 + 0.7 * v, 2);
        break;
      }
      case "upsload": {
        let sum = 0;
        for (const e of P.devs) sum += e.load;
        const v = clamp((sum / P.devs.length) * 1.3 * 20 - l.arg, 0, 1);
        if (v > 0) light(l.p, l.arg >= 16 ? AMBER : [200, 230, 255], 0.3 + 0.6 * v);
        break;
      }
      case "upsbatt":
        light(l.p, [60, 220, 90], l.arg < 19 ? 0.7 : 0.25);
        break;
    }
  }
  // The status lights inside a busy server show through the holes of its bezel.
  for (let j = 0; j < P.holes.length; j += 2) {
    const q = P.holes[j] * 3;
    const v = BLEED * P.devs[P.holes[j + 1]].load;
    for (let i = 0; i < 3; i++) buf[q + i] += scheme[i] * v;
  }
  // Drives the backup is writing glow through their light pipes, and stay lit once written.
  for (let c = 0; c < P.caddies.length; c++) {
    // The last pass's lights go out over 3 rack seconds when the next pass starts.
    const old = 0.6 * Math.max(0, 1 - (P.t - P.reset) / 3);
    const v = c < P.sweep - 4 ? 0.6 : Math.max(old, 1 - Math.abs(c - P.sweep) / 4);
    if (v <= 0) continue;
    const cd = P.caddies[c];
    for (let y = cd.top; y < cd.top + 5; y++) {
      const q = (y * W + cd.x + 1) * 3;
      for (let i = 0; i < 3; i++) buf[q + i] += scheme[i] * PIPE * v;
    }
  }
  // The controller's LCD: one cell per shelf of drives, and the rebuild bar under them.
  if (P.lcd) {
    const { x, y } = P.lcd;
    for (let i = 0; i < 12; i++) {
      const busy = Math.abs(i * 5.4 - P.sweep) < 6;
      const q = (y * W + x + i) * 3;
      buf[q] = busy ? 120 : 40;
      buf[q + 1] = busy ? 230 : 120;
      buf[q + 2] = busy ? 220 : 110;
    }
    if (P.fault >= 0)
      for (let i = 0; i < 12; i++) {
        const v = clamp(P.rebuild * 12 - i, 0, 1);
        const q = ((y + 1) * W + x + i) * 3;
        buf[q] = 40 + 200 * v;
        buf[q + 1] = 60 + 80 * v;
        buf[q + 2] = 50 - 30 * v;
      }
  }
  const out = (v) => (v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0);
  for (let y = 0, q = 0; y < H; y++) for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, out(buf[q]), out(buf[q + 1]), out(buf[q + 2]));
}
