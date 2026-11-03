// ===== Patternflow pattern =====
// Title:   Photo Finish
// Family:  type
// Idea:    The letters of a word race down five lanes to a finish line across the middle of the panel, and below the line a photo-finish camera that sees only that one row writes it again and again into a strip that grows downward, so time becomes the vertical axis: a fast letter comes out short, a slow one tall, one that stops on the line smears into streaks, one that slides sideways leans, and the heights in the strip give the order of arrival, which the word spells out at the start line when the race is over.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: strip photography and the photo-finish camera, a slit that images one line across the track onto film moving past it, so the picture's long axis is time; 5 by 7 capitals drawn for this pattern; pattern round 102
// Round:   102
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Field=0..4, Rate=0..1
//
// Knob 1: Hue. Turns the runners' colours round the wheel. At 0 the five letters run from aqua in the left lane through azure and indigo to violet and pink in the right lane, and each keeps its colour in the strip and in the result, so a letter can be followed from lane to photo to place; the film's grey and the lane rules turn with them, blue grey at 0.
// Knob 2: Speed. At 2 a race takes about 5.8 s: 0.7 s on the start line, about 2.5 s of running while the camera writes, 2.6 s holding the finished photo and the result, then the next race with new speeds; everything, the camera included, goes as Speed / 2, so the photo comes out the same and only the watching is slower: at 0.2 the strip grows 3.4 rows a second and each row can be seen being read off the line.
// Knob 3: Field. The race in five stops: 0 PHOTO, five ways to cross, one each: P steady at 58 to 70 LEDs a second, short; H stopping 0.5 to 0.8 s with the line 4 to 6 rows into it, so its legs streak; O stopping a row short of the line and starting from rest at 150 LEDs a second squared; T steady at 21 to 25, tall; O sliding 5 LEDs sideways while it crosses, so it leans. 1 SWIFT, steady speeds from 22 to 70. 2 TIRED, letters that reach the line at 35 to 50 and cross it slowing to 8 to 12 or kicking to 90 to 110, so they come out top-heavy or squashed. 3 PAUSE, every letter stopping once with the line 2 to 12 rows into it for 0.2 to 0.9 s, so the strip shows the row it stopped on as streaks. 4 SLIDE, letters sliding 3 to 5 LEDs sideways while they cross.
// Knob 4: Rate. The camera's line rate in rows a second of race time, 18 + 84 Rate^0.6: 33.5 at the opening 0.06, where a 14-row letter crossing at 33.5 LEDs a second comes out its own height, P is written 7 rows tall and T 20, and the 71 strip rows hold 2.1 s; 18 at 0, where everything is squeezed and the strip holds 3.9 s; 102 at 1, where letters stand three times taller and only the last 0.7 s of the race stays in the picture.

// A photo-finish camera does not take a picture of the track. Its slit
// sees one line, the finish line, and the film moves past the slit at a
// steady rate, so the picture is that one line written again at every
// instant, one instant beside the next. Nothing in it is where it was in
// space; everything is where it was in time. A runner who crosses fast is
// written in few instants and comes out narrow, a slow one wide, and one who
// stops on the line has the same slice of him written over and over, a
// smear of streaks. Whoever crossed first is furthest along the film, which
// is why the picture decides the race.
//
// Here the track runs down the panel and the finish line is row 56. Above
// it are the letters as they are, each in its lane. Below it is the film:
// every 1 / Rate seconds of race time the camera reads row 56 and pushes the
// strip one row down, newest row on top. A letter falling at exactly Rate
// LEDs a second therefore comes out of the line as if nothing had happened,
// its bottom first and lowest; at speed v it is written 14 Rate / v rows
// tall. The letter crossing at v(y) as it goes has every row of it scaled by
// its own speed, so a letter slowing down comes out with its top drawn out,
// one speeding up with its bottom drawn out, and one stopping has one row
// repeated. Sideways motion during the crossing turns into slope, since
// every later row is written further across. A real photo-finish camera
// lays time along the track, across the picture; the tall panel lays it
// down, so speed shows as letter height instead of width.
//
// Every runner's place is an exact function of race time (a few pieces of
// constant speed, constant acceleration and standing still), so the camera
// reads the line at the instant each row stands for, not at frame times,
// and the strip is the same at any frame rate and any Speed. A letter has
// finished when all of it is past the line, the moment its top is written;
// the result word on the start line is the letters in that order, which in
// the strip is the order of their tops from the bottom up. Film the camera
// has not reached is dark, and a written row shows the line itself, grey.

const W = 64, H = 128;
const { floor, round, sqrt, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The finish line, the strip under it, the start line, a letter's size and
// the lanes' left columns.
const LINE = 56, STRIP = H - LINE - 1, TOP = 4, LH = 14, LW = 10;
const LANES = [1, 14, 27, 40, 53];
// Where a letter's bottom touches the line and where its top leaves it.
const TOUCH = LINE + 0.5 - LH, CLEAR = LINE + 0.5;
// Race seconds: on the start line, after the last letter clears, holding.
const READY = 0.7, AFTER = 0.2, HOLD = 2.6;

const FONT = {
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
};
const WORDS = ["PHOTO", "SWIFT", "TIRED", "PAUSE", "SLIDE"];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

const rnd = (a, b) => a + (b - a) * Math.random();

// A runner's way down as pieces {t, y, v, a}: from time t it is at
// y + v u + a u^2 / 2, u = t' - t, until the next piece. Steps:
// ["to", y, v] runs at v to y; ["wait", s] stands; ["acc", a, v, y] starts
// at v, accelerates by a to y and goes on at the speed it reached there;
// ["run", v] runs at v for good.
function plan(steps) {
  const segs = [{ t: -1e9, y: TOP, v: 0, a: 0 }];
  let t = READY, y = TOP, v = 0;
  for (const s of steps) {
    if (s[0] === "wait") {
      segs.push({ t, y, v: 0, a: 0 });
      t += s[1];
      v = 0;
    } else if (s[0] === "to") {
      segs.push({ t, y, v: s[2], a: 0 });
      t += (s[1] - y) / s[2];
      y = s[1];
      v = s[2];
    } else if (s[0] === "acc") {
      const a = s[1], v0 = s[2], d = s[3] - y, v1 = sqrt(max(1, v0 * v0 + 2 * a * d));
      segs.push({ t, y, v: v0, a });
      t += Math.abs(a) < 1e-6 ? d / v0 : (v1 - v0) / a;
      y = s[3];
      v = v1;
    } else segs.push({ t, y, v: (v = s[1]), a: 0 });
  }
  if (steps[steps.length - 1][0] !== "run") segs.push({ t, y, v, a: 0 });
  return segs;
}

function yAt(segs, t) {
  let s = segs[0];
  for (let i = 1; i < segs.length && segs[i].t <= t; i++) s = segs[i];
  const u = t - s.t;
  return s.y + s.v * u + 0.5 * s.a * u * u;
}

// The first time y(t) reaches y, by bisection on a path that never climbs.
function timeAt(segs, y) {
  let lo = READY, hi = READY + 30;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (yAt(segs, m) >= y) hi = m;
    else lo = m;
  }
  return hi;
}

// The five runners of a field, with fresh speeds.
function field(f) {
  const out = [];
  for (let i = 0; i < 5; i++) {
    let steps, slide = 0;
    if (f === 0)
      steps = [
        [["run", rnd(58, 70)]],
        [["to", TOUCH + rnd(3.5, 5.5), 42], ["wait", rnd(0.5, 0.8)], ["run", 42]],
        [["to", TOUCH - 1, 40], ["wait", rnd(0.25, 0.45)], ["acc", 150, 0, CLEAR], ["run", 65]],
        [["run", rnd(21, 25)]],
        [["run", rnd(32, 38)]],
      ][i];
    else if (f === 1) steps = [["run", rnd(22, 70)]];
    else if (f === 2) {
      const v0 = rnd(35, 50), v1 = Math.random() < 0.5 ? rnd(8, 12) : rnd(90, 110);
      steps = [["to", TOUCH, v0], ["acc", (v1 * v1 - v0 * v0) / (2 * LH), v0, CLEAR]];
    } else if (f === 3) steps = [["to", TOUCH + rnd(2, 12), 40], ["wait", rnd(0.2, 0.9)], ["run", 40]];
    else steps = [["run", rnd(30, 42)]];
    if (f === 4 || (f === 0 && i === 4)) slide = (Math.random() < 0.5 ? -1 : 1) * (f === 0 ? 5 : rnd(3, 5));
    const segs = plan(steps), t0 = timeAt(segs, TOUCH), t1 = timeAt(segs, CLEAR);
    out.push({ segs, t0, t1, slide, ch: FONT[WORDS[f][i]] });
  }
  return out;
}

// A runner's left edge: its lane, slid across during the crossing.
function xAt(r, i, t) {
  if (!r.slide) return LANES[i];
  const u = cl((t - r.t0) / max(1e-3, r.t1 - r.t0), 0, 1);
  return LANES[i] + r.slide * (u - 0.5);
}

// Ink of glyph g at (u, v) LEDs from a letter's top left, 0..1, with the
// column covered in two halves so a sliding letter has soft sides.
function ink(g, u, v) {
  if (v < 0 || v >= LH) return 0;
  const gy = floor(v / 2);
  let s = 0;
  for (const du of [0.25, 0.75]) {
    const uu = u + du;
    if (uu >= 0 && uu < LW && g[gy][floor(uu / 2)] === "1") s += 0.5;
  }
  return s;
}

function newRace(S) {
  S.runners = field(S.field);
  S.t = 0;
  S.cam = 0;
  S.camT = READY;
  S.rec = true;
  S.order = S.runners.map((r, i) => i).sort((a, b) => S.runners[a].t1 - S.runners[b].t1);
  S.end = max(...S.runners.map((r) => r.t1)) + AFTER;
  S.ink.fill(0);
  S.who.fill(255);
  S.tick.fill(0);
  S.shot.fill(0);
}

export function setup(params) {
  params.s = {
    field: -1, hue: 0, speed: 2, rate: 33, t: 0, cam: 0, camT: 0, rec: true, runners: [], order: [], end: 0,
    // The strip: per row and column the ink and whose it is, and the time
    // ticks, row 0 the newest, as a ring.
    ink: new Float32Array(STRIP * W), who: new Uint8Array(STRIP * W).fill(255), tick: new Uint8Array(STRIP), shot: new Uint8Array(STRIP), head: 0,
  };
}

// The camera reads the line at race time t into a new top row.
function expose(S, t) {
  S.head = (S.head + STRIP - 1) % STRIP;
  const o = S.head * W;
  for (let x = 0; x < W; x++) {
    S.ink[o + x] = 0;
    S.who[o + x] = 255;
  }
  S.runners.forEach((r, i) => {
    const y = yAt(r.segs, t), v = CLEAR - y;
    if (v < 0 || v >= LH) return;
    const x0 = xAt(r, i, t);
    for (let x = max(0, floor(x0) - 1); x <= min(W - 1, x0 + LW + 1); x++) {
      const k = ink(r.ch, x - x0, v);
      if (k > S.ink[o + x]) {
        S.ink[o + x] = k;
        S.who[o + x] = i;
      }
    }
  });
  // A tick every tenth of a second of race time, a long one every half.
  const tenth = floor(t * 10 + 1e-6), prev = floor((t - 1 / S.rate) * 10 + 1e-6);
  S.tick[S.head] = tenth !== prev ? (tenth % 5 === 0 ? 2 : 1) : 0;
  S.shot[S.head] = 1;
}

function step(S, d) {
  S.t += d;
  if (S.rec && S.t >= READY) {
    S.cam += d * S.rate;
    while (S.cam >= 1 && S.camT < S.end) {
      S.cam -= 1;
      S.camT += 1 / S.rate;
      expose(S, S.camT);
    }
    if (S.camT >= S.end) S.rec = false;
  }
  if (S.t >= S.end + HOLD) newRace(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.rate = 18 + 84 * cl(k[3] == null ? 0.06 : k[3], 0, 1) ** 0.6;
  const f = round(cl(k[2] || 0, 0, 4));
  if (f !== S.field) {
    S.field = f;
    newRace(S);
    // Open ahead, so 2 s in at Speed 2 the race is 1.5 s past the gun,
    // with letters on both sides of the line.
    for (let i = 0; i < 12; i++) step(S, 0.2 / 12);
  }
  step(S, (d * S.speed) / 2);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.runners.length) return;
  const cols = S.runners.map((r, i) => hsv(S.hue + 0.47 + 0.11 * i, 0.72, 1));
  const px = new Float32Array(W * H * 3);
  // The film's own tint and the lane rules, a little way round the wheel
  // from the runners.
  const film = hsv(S.hue + 0.64, 0.42, 0.13), rule = hsv(S.hue + 0.64, 0.4, 0.15);
  const put = (x, y, r, g, b) => {
    const o = (y * W + x) * 3;
    px[o] = r;
    px[o + 1] = g;
    px[o + 2] = b;
  };
  // The track above the line: dim lane rules.
  for (let y = 0; y < LINE; y++) for (const x of [12, 25, 38, 51]) put(x, y, rule[0] * 255, rule[1] * 255, rule[2] * 255);
  const t = S.t, done = t >= S.end;
  // The letters as they are, above the line only.
  if (!done)
    S.runners.forEach((r, i) => {
      const y0 = yAt(r.segs, t), x0 = xAt(r, i, t), c = cols[i];
      for (let y = max(0, floor(y0)); y < min(LINE, y0 + LH); y++)
        for (let x = max(0, floor(x0) - 1); x <= min(W - 1, x0 + LW + 1); x++) {
          const k = ink(r.ch, x - x0, y + 0.5 - y0);
          if (k > 0) put(x, y, c[0] * 255 * k, c[1] * 255 * k, c[2] * 255 * k);
        }
    });
  else {
    // The result: the word again on the start line in the order the
    // letters reached the line, each in its own colour.
    const fade = cl((S.end + HOLD - t) / 0.3, 0, 1) * cl((t - S.end) / 0.3, 0, 1);
    S.order.forEach((i, place) => {
      const c = cols[i], g = S.runners[i].ch;
      for (let v = 0; v < LH; v++)
        for (let u = 0; u < LW; u++)
          if (g[v >> 1][u >> 1] === "1") put(LANES[place] + u, TOP + v, c[0] * 230 * fade, c[1] * 230 * fade, c[2] * 230 * fade);
    });
  }
  // The finish line: bright while the camera runs, its slice of each
  // crossing letter in the letter's colour.
  const lv = S.rec && t >= READY ? 190 : 90;
  for (let x = 0; x < W; x++) put(x, LINE, lv, lv, lv * 1.05);
  if (S.rec && !done)
    S.runners.forEach((r, i) => {
      const v = CLEAR - yAt(r.segs, t);
      if (v < 0 || v >= LH) return;
      const x0 = xAt(r, i, t), c = cols[i];
      for (let x = max(0, floor(x0) - 1); x <= min(W - 1, x0 + LW + 1); x++) {
        const k = ink(r.ch, x - x0, v);
        if (k > 0) put(x, LINE, 255 * (c[0] * k + 0.6 * (1 - k)), 255 * (c[1] * k + 0.6 * (1 - k)), 255 * (c[2] * k + 0.6 * (1 - k)));
      }
    });
  // The strip, newest row just under the line, on the film's own grey.
  for (let row = 0; row < STRIP; row++) {
    const j = (S.head + row) % STRIP, o = j * W, y = LINE + 1 + row;
    for (let x = 0; x < W; x++) {
      const k = S.ink[o + x], w = S.who[o + x];
      // Film the camera has not reached yet is dark; a written row
      // shows the finish line itself, grey, behind the letters.
      const sh = S.shot[j];
      let r = film[0] * 255 * sh, g = film[1] * 255 * sh, b = film[2] * 255 * sh;
      if (k > 0 && w < 5) {
        const c = cols[w];
        r = r * (1 - k) + c[0] * 240 * k;
        g = g * (1 - k) + c[1] * 240 * k;
        b = b * (1 - k) + c[2] * 240 * k;
      }
      put(x, y, r, g, b);
    }
    const tk = S.tick[j];
    if (tk) for (let q = 0; q < tk * 2; q++) put(W - 1 - q, y, 120, 120, 130);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, round(cl(px[o], 0, 255)), round(cl(px[o + 1], 0, 255)), round(cl(px[o + 2], 0, 255)));
    }
}
