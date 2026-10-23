// ===== Patternflow pattern =====
// Title:   Wireworld
// Family:  automata
// Idea:    A working Wireworld circuit fills the tall panel: four clock loops of 12, 18, 24 and 30 cells send electrons down through diodes and delay lines into XOR and OR gates, and three lamps at the foot flash out what the gates decide.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Brian Silverman's Wireworld (1987), as A. K. Dewdney described it in Scientific American in January 1990
// Round:   16
// ===============================
// @matrix 64x128
// @knobs Palette=0..3, Speed=0..4, Pulses=1..3, Glow=0..1
//
// Knob 1: Palette. 0 copper wire with blue-white heads and red-orange tails, 1 green phosphor, 2 blueprint, 3 neon.
// Knob 2: Speed. Ticks per second, from 2 to 14 (8 at the start); the afterglow behind an electron fades in a quarter second at any speed, so a fast electron draws a long streak and a slow one hops cell to cell.
// Knob 3: Pulses. One, two or three electrons on each clock loop, six cells apart (the 12-cell loop holds two), which changes the rhythm of every lamp; at three the first XOR gets a pulse on both inputs every bit and its lamp goes out.
// Knob 4: Glow. The light electrons and lamps throw on the dark board, from a one-LED rim to a bloom four LEDs wide, and the afterglow stretches from 0.25 s to 0.8 s.
// Buttons: K1 tap feeds six electrons in a row into each of the four lines, timed to meet at the gates: the first XOR lamp goes dark for six bits while the OR lamp and the last lamp burn.

const W = 64;
const H = 128;
// One Wireworld cell is 2x2 LEDs: a wire is two LEDs wide and a head reads
// as a block, which a single LED on this panel does not.
const CW = 32;
const CH = 64;
const NC = CW * CH;
const HEAD = 1;
const TAIL = 2;
const WIRE = 3;
// Every loop is a multiple of six cells long, so every electron in the
// circuit rides a six-tick bit grid. Pulses that meet at a gate either arrive
// on the same tick or a whole bit apart; anything closer merges in the XOR
// and the gate no longer computes.
const BIT = 6;
const PRE = 240;
// Copper warms with the electrons that cross it and cools over this many
// seconds, so a busy line glows a little warmer than an idle one.
const HEAT = 1.5;

// Gates drawn for signals flowing down the panel. The diode passes downward
// and its block of three stops an electron coming up. The XOR is the usual
// Wireworld one with a loop: one input passes, two on the same tick put three
// heads next to the output cell, which then stays copper. The OR is the same
// junction without the loop.
const DIODE = ['.#.', '###', '#.#', '.#.'];
const XOR = ['#.....#', '#.###.#', '.##.##.', '..#.#..', '..###..', '...#...'];
const OR = ['#...#', '#.#.#', '.###.', '..#..'];

// Where each loop's first electron sits at tick 0, counted clockwise from the
// loop's top left cell. Found by running the circuit: with these, A and B
// reach the first XOR on the same tick of the bit, C and D the OR, and the
// two gate outputs the last XOR. The fifth is the six-cell heartbeat.
const PHASE = [0, 1, 4, 4, 0];
// Ticks each line holds a K1 burst back. From the feed points the first XOR
// is 45 ticks away along A and 49 along B, the OR 20 along C and 46 along D,
// and the outputs reach the last XOR 58 and 32 ticks after A and C were fed;
// with these waits the six bits of every line meet their partners together.
const WAIT = [4, 0, 30, 4];
// Pulses k puts min(k, m) electrons, spread evenly, on a loop of m bits:
// loop A has two, B three, C four, D five.
function slotsOf(k, m) {
  const n = Math.min(k, m);
  const out = [];
  for (let j = 0; j < n; j++) out.push(Math.floor((j * m) / n));
  return out;
}

// Trace, component, head, tail and lamp for each palette. Components (the
// diodes, gates and lamp loops) are a lighter metal than the traces, so the
// parts read as parts.
const PALETTES = [
  [[128, 84, 16], [172, 132, 64], [175, 215, 255], [255, 80, 16], [255, 226, 150]],
  [[26, 84, 34], [70, 140, 80], [215, 255, 215], [40, 210, 80], [190, 255, 130]],
  [[30, 60, 138], [90, 120, 190], [255, 255, 255], [40, 205, 255], [215, 240, 255]],
  [[84, 28, 116], [140, 80, 170], [120, 255, 235], [255, 40, 150], [255, 210, 100]],
];

function buildMap() {
  // 1 for a trace, 2 for a component.
  const map = new Uint8Array(NC);
  const rings = [];
  let ink = 1;
  const set = (x, y) => {
    if (x >= 0 && x < CW && y >= 0 && y < CH) map[y * CW + x] = ink;
  };
  // A polyline of straight and 45 degree runs.
  const path = (pts) => {
    for (let i = 0; i < pts.length - 1; i++) {
      let x = pts[i][0];
      let y = pts[i][1];
      const x1 = pts[i + 1][0];
      const y1 = pts[i + 1][1];
      set(x, y);
      while (x !== x1 || y !== y1) {
        x += Math.sign(x1 - x);
        y += Math.sign(y1 - y);
        set(x, y);
      }
    }
  };
  const stamp = (x, y, rows) => {
    ink = 2;
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '#') set(x + i, y + j);
    ink = 1;
  };
  // A loop w cells across and h down with its corners cut, so each cell
  // touches exactly two others and the length is 2(w + h). Kept in clockwise
  // order for placing electrons.
  const ring = (x, y, w, h) => {
    const c = [];
    for (let i = 1; i <= w; i++) c.push([x + i, y]);
    for (let j = 1; j <= h; j++) c.push([x + w + 1, y + j]);
    for (let i = w; i >= 1; i--) c.push([x + i, y + h + 1]);
    for (let j = h; j >= 1; j--) c.push([x, y + j]);
    for (const [a, b] of c) set(a, b);
    rings.push(c.map(([a, b]) => b * CW + a));
  };
  // A lamp is a loop the signal enters at one side; it splits both ways
  // round and the halves cancel on the far side. Its glass is the hole.
  const lamps = [];
  const lamp = (x, y, w, trig) => {
    ink = 2;
    ring(x, y, w, w);
    ink = 1;
    lamps.push({ ring: rings.pop(), trig: trig[1] * CW + trig[0], cx: 2 * x + w + 2, cy: 2 * y + w + 2, rad: w + 0.15 });
  };
  // A delay line: runs between x0 and x1 two cells apart, turning on the
  // diagonal so no cell of one run touches the next.
  const meander = (pts, x0, x1, y, runs) => {
    for (let r = 0; r < runs; r++, y += 2) {
      if (r % 2 === 0) pts.push([x1, y], [x1 + 1, y + 1]);
      else pts.push([x0, y], [x0 - 1, y + 1]);
    }
    return pts;
  };

  // The four clocks stand on row 11 like organ pipes, 12, 18, 24 and 30
  // cells round, each tapped at the bottom and guarded by a diode.
  ring(1, 6, 2, 4);
  ring(8, 4, 3, 6);
  ring(16, 2, 4, 8);
  ring(24, 0, 5, 10);
  for (const x of [3, 10, 19, 27]) {
    set(x, 12);
    stamp(x - 1, 13, DIODE);
  }
  // Over clock A a six-cell loop, one bit round, beats the bit into a
  // small lamp.
  ring(0, 0, 1, 2);
  path([[3, 1], [4, 1]]);
  lamp(5, 0, 2, [5, 1]);
  // A: a horizontal delay line. B: three long verticals, down, up, down.
  // C: a zigzag. D: the delay line again.
  path(meander([[3, 16], [3, 17], [1, 19]], 1, 5, 19, 7).concat([[4, 34], [4, 35]]));
  path([[10, 16], [10, 17], [9, 18], [9, 32], [10, 33], [11, 32], [11, 19], [12, 18], [13, 19], [13, 33], [11, 35]]);
  path([[19, 16], [19, 17], [22, 20], [16, 26], [22, 32], [22, 34], [21, 35], [21, 36]]);
  path(meander([[27, 16], [27, 17], [25, 19]], 25, 29, 19, 7).concat([[26, 36]]));
  stamp(4, 36, XOR);
  stamp(21, 37, OR);
  // Each gate's output forks: one branch winds down to its own lamp, the
  // other meets the other gate's in the last XOR.
  path([[7, 41], [7, 43], [6, 44], [2, 48], [8, 48], [9, 49], [8, 50], [1, 50], [0, 51], [1, 52], [8, 52], [9, 53], [8, 54], [3, 54], [3, 56]]);
  path([[7, 43], [8, 44], [12, 48]]);
  path([[23, 40], [23, 43], [22, 44], [19, 47], [19, 48]]);
  path([[23, 43], [24, 44], [28, 48], [23, 48], [22, 49], [23, 50], [30, 50], [31, 51], [30, 52], [23, 52], [22, 53], [23, 54], [28, 54], [28, 56]]);
  stamp(13, 49, XOR);
  path([[16, 54], [16, 56]]);
  lamp(0, 57, 4, [3, 57]);
  lamp(13, 57, 4, [16, 57]);
  lamp(26, 57, 4, [28, 57]);
  return { map, rings, lamps };
}

export function setup(params) {
  const P = params;
  const { map, rings, lamps } = buildMap();
  // Index the copper: a step only visits wire cells, each with the list of
  // wire cells it touches.
  const id = new Int16Array(NC).fill(-1);
  let n = 0;
  for (let p = 0; p < NC; p++) if (map[p]) id[p] = n++;
  P.nw = n;
  P.pos = new Int16Array(n);
  P.part = new Uint8Array(n);
  P.nb = new Int16Array(n * 8).fill(-1);
  for (let p = 0; p < NC; p++) {
    const i = id[p];
    if (i < 0) continue;
    P.pos[i] = p;
    P.part[i] = map[p] === 2 ? 1 : 0;
    const x = p % CW;
    const y = (p / CW) | 0;
    let k = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= CW || yy >= CH) continue;
        if (id[yy * CW + xx] >= 0) P.nb[i * 8 + k++] = id[yy * CW + xx];
      }
  }
  P.id = id;
  P.clocks = rings.map((r) => r.map((p) => id[p]));
  P.lamps = lamps.map((l) => ({ trig: id[l.trig], cx: l.cx, cy: l.cy, rad: l.rad, flash: 0 }));
  P.s = new Uint8Array(n).fill(WIRE);
  P.s2 = new Uint8Array(n);
  P.after = new Float32Array(n);
  P.heat = new Float32Array(n);
  // Where K1 feeds each line, just under its diode, and the cell behind it.
  P.inj = [3, 10, 19, 27].map((x) => [id[17 * CW + x], id[16 * CW + x]]);
  P.injPhase = [0, 0, 0, 0];
  P.burst = [0, 0, 0, 0];
  P.wait = [0, 0, 0, 0];
  P.halo = new Float32Array(W * H);
  P.glowTail = new Float32Array(W * H);
  P.lamp = new Float32Array(W * H);
  P.tick = 0;
  P.acc = 0;
  P.level = 0;
  P.ready = false;
}

// Put the electrons of every clock where they would be at this tick, for the
// current number of pulses. Slot s rides six cells behind slot 0.
function seedClocks(P) {
  for (let c = 0; c < P.clocks.length; c++) {
    const r = P.clocks[c];
    const L = r.length;
    for (const i of r) P.s[i] = WIRE;
    for (const s of slotsOf(c < 4 ? P.level + 1 : 1, L / BIT)) {
      const at = (((PHASE[c] + P.tick - BIT * s) % L) + L) % L;
      P.s[r[at]] = HEAD;
      P.s[r[(at - 1 + L) % L]] = TAIL;
    }
  }
}

function step(P) {
  const s = P.s;
  const o = P.s2;
  const nb = P.nb;
  for (let i = 0; i < P.nw; i++) {
    const v = s[i];
    if (v === HEAD) o[i] = TAIL;
    else if (v === TAIL) {
      o[i] = WIRE;
      P.after[i] = 1;
    } else {
      let c = 0;
      for (let k = i * 8, e = k + 8; k < e; k++) {
        const j = nb[k];
        if (j < 0) break;
        if (s[j] === HEAD) c++;
      }
      if (c === 1 || c === 2) {
        o[i] = HEAD;
        P.heat[i] += 1;
      } else o[i] = WIRE;
    }
  }
  P.s = o;
  P.s2 = s;
  P.tick++;
  // Learn each line's place on the bit grid from the electrons the clocks
  // send past the feed point, so a burst lands on the same grid.
  for (let c = 0; c < 4; c++) {
    const [a, b] = P.inj[c];
    if (o[a] === HEAD && o[b] === TAIL) P.injPhase[c] = P.tick % BIT;
  }
  for (const l of P.lamps) if (o[l.trig] === HEAD) l.flash = 1;
  // A burst fills the next bits of each line; a bit the clock already
  // carries counts as filled.
  for (let c = 0; c < 4; c++) {
    if (P.wait[c] > 0) {
      P.wait[c]--;
      continue;
    }
    if (P.burst[c] === 0 || P.tick % BIT !== P.injPhase[c]) continue;
    const [a, b] = P.inj[c];
    if (o[a] === WIRE && o[b] === WIRE) {
      o[a] = HEAD;
      o[b] = TAIL;
    }
    P.burst[c]--;
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = Math.min(dt, 0.1);
  P.pal = PALETTES[Math.max(0, Math.min(3, Math.round(k[0])))];
  const tps = 2 + 3 * Math.max(0, Math.min(4, k[1]));
  const level = Math.max(1, Math.min(3, Math.round(k[2]))) - 1;
  P.glow = Math.max(0, Math.min(1, k[3]));

  if (!P.ready) {
    P.level = level;
    seedClocks(P);
    // Run the circuit until every line and lamp has had its signal, so the
    // panel opens on a board that is already working.
    const cool = Math.exp(-1 / tps / HEAT);
    for (let t = 0; t < PRE; t++) {
      step(P);
      for (let i = 0; i < P.nw; i++) P.heat[i] *= cool;
    }
    P.after.fill(0);
    for (const l of P.lamps) l.flash = 0;
    P.ready = true;
  }
  if (level !== P.level) {
    P.level = level;
    seedClocks(P);
  }
  if (input.btnPressed && input.btnPressed[0]) {
    P.burst.fill(6);
    for (let c = 0; c < 4; c++) P.wait[c] = WAIT[c];
  }

  P.acc += dt * tps;
  let n = 0;
  while (P.acc >= 1 && n < 4) {
    step(P);
    P.acc -= 1;
    n++;
  }
  if (P.acc > 1) P.acc = 1;

  // The afterglow fades in seconds, not ticks, so it streaks further behind
  // a faster electron; Glow stretches it from 0.25 s to 0.8 s.
  const fade = Math.exp(-dt / (0.25 + 0.55 * P.glow));
  const after = P.after;
  for (let i = 0; i < P.nw; i++) if (after[i] > 0) after[i] = after[i] > 0.02 ? after[i] * fade : 0;
  const cool = Math.exp(-dt / HEAT);
  const heat = P.heat;
  for (let i = 0; i < P.nw; i++) heat[i] *= cool;
  const lampFade = Math.exp(-dt / 0.5);
  for (const l of P.lamps) l.flash *= lampFade;
}

export function draw(display, params, time) {
  const P = params;
  if (!P.ready) return;
  const pal = P.pal;
  const head = pal[2];
  const tail = pal[3];
  const lampC = pal[4];
  const g = P.glow;
  const halo = P.halo;
  const lamp = P.lamp;
  const id = P.id;
  halo.fill(0);
  lamp.fill(0);

  // Heads and tails throw their colour on the LEDs around their cell: a rim
  // one LED wide at the bottom of the knob, four LEDs of bloom at the top.
  const rim = 0.35 + 0.55 * g;
  const reach = 1 + Math.round(3 * g);
  const s = P.s;
  const glowTail = P.glowTail;
  glowTail.fill(0);
  for (let i = 0; i < P.nw; i++) {
    const v = s[i];
    if (v !== HEAD && v !== TAIL) continue;
    const buf = v === HEAD ? halo : glowTail;
    const amt = v === HEAD ? rim : rim * 0.6;
    const p = P.pos[i];
    const x0 = (p % CW) * 2;
    const y0 = ((p / CW) | 0) * 2;
    for (let dy = -reach; dy < 2 + reach; dy++) {
      const y = y0 + dy;
      if (y < 0 || y >= H) continue;
      const ey = dy < 0 ? -dy : dy > 1 ? dy - 1 : 0;
      for (let dx = -reach; dx < 2 + reach; dx++) {
        const x = x0 + dx;
        if (x < 0 || x >= W) continue;
        const ex = dx < 0 ? -dx : dx > 1 ? dx - 1 : 0;
        const d = Math.max(ex, ey);
        if (d > 0) buf[y * W + x] += amt / (d * d + (ex && ey ? 0.6 : 0));
      }
    }
  }

  // Each lamp's glass glows faintly when dark and fills when a signal
  // arrives, and the flash blooms past its loop onto the board.
  for (const l of P.lamps) {
    const f = l.flash;
    const out = l.rad + (6 + 10 * g) * (l.rad / 4);
    const x0 = Math.max(0, Math.floor(l.cx - out));
    const x1 = Math.min(W, Math.ceil(l.cx + out));
    for (let y = Math.max(0, Math.floor(l.cy - out)); y < Math.min(H, Math.ceil(l.cy + out)); y++) {
      for (let x = x0; x < x1; x++) {
        const d = Math.hypot(x + 0.5 - l.cx, y + 0.5 - l.cy);
        let v = 0;
        if (d < l.rad) v = 0.13 + 0.87 * f * (1 - 0.15 * (d / l.rad));
        else if (d < out) v = f * 0.9 * ((out - d) / (out - l.rad)) ** 1.3;
        if (v > lamp[y * W + x]) lamp[y * W + x] = v;
      }
    }
  }

  // Black board, then every wire cell by its state. Plain copper takes a
  // share of the light around it; a cell an electron just left still burns
  // with the tail colour for a moment.
  const after = P.after;
  const heat = P.heat;
  for (let y = 0; y < H; y++) {
    const row = (y >> 1) * CW;
    for (let x = 0; x < W; x++) {
      const q = y * W + x;
      const i = id[row + (x >> 1)];
      const h = halo[q] < 1 ? halo[q] : 1;
      const t = glowTail[q] < 1 ? glowTail[q] : 1;
      const m = lamp[q];
      let r = head[0] * h + tail[0] * t + lampC[0] * m;
      let gg = head[1] * h + tail[1] * t + lampC[1] * m;
      let b = head[2] * h + tail[2] * t + lampC[2] * m;
      if (i >= 0) {
        const v = s[i];
        if (v === HEAD) {
          r = head[0];
          gg = head[1];
          b = head[2];
        } else if (v === TAIL) {
          r = tail[0];
          gg = tail[1];
          b = tail[2];
        } else {
          const c = pal[P.part[i]];
          const w = 0.72 + 0.25 * (heat[i] < 2 ? heat[i] : 2);
          const a = after[i] * 0.8;
          r = c[0] * w + (tail[0] - c[0] * w) * a + r * 0.5;
          gg = c[1] * w + (tail[1] - c[1] * w) * a + gg * 0.5;
          b = c[2] * w + (tail[2] - c[2] * w) * a + b * 0.5;
        }
      }
      display.setPixel(x, y, r < 255 ? r : 255, gg < 255 ? gg : 255, b < 255 ? b : 255);
    }
  }
}
