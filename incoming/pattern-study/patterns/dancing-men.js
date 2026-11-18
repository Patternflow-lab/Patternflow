// ===== Patternflow pattern =====
// Title:   Dancing Men
// Family:  type
// Idea:    Stick men dance five to a row, each one a letter in a made-up alphabet of poses and the last of every word holding a flag, while a tally of poses grows underneath until the tallest bar flashes and is named, E for the story's own line, and then each man's letter lights under him in the order the counting solves them.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the cipher of The Adventure of the Dancing Men (Arthur Conan Doyle, 1903), one figure a letter and a flag at each word end, solved by letter frequency, pattern round 105
// Round:   105
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Beat=0.5..4, Message=0..3, Sway=0..0.2
//
// Knob 1: Hue. Turns the whole palette round the wheel, men, bars and letters together; the figures of one message spread over 0.6 of the wheel, one colour for each pose, so that at 0 they run azure to violet to red and at 0.5 orange to green to cyan.
// Knob 2: Beat. The dance tempo. The men hop once a beat, 90 a minute at 2, 22 at 0.5 and 180 at 4, and every limb swings on the same beat; the message keeps its own pace, about 20 s from the first man to the last letter.
// Knob 3: Message. Picks the message and starts it over at once, 0 AM HERE ABE SLANEY, 1 COME HERE AT ONCE, 2 THE DANCING MEN, 3 MR HILTON CUBITT; four dots at the top left show which is playing, and after one ends the next follows. The commonest figure is E in the first two, N in the third and T in the fourth, and the panel shows whichever letter it counted.
// Knob 4: Sway. How far the arms and legs swing round each pose on the beat: only the hop at 0, 27 degrees of arm at 0.06, where the poses are still plain to read, and 90 degrees at 0.2, where the men throw themselves about.

// The dancing men are a one-figure-a-letter substitution: every letter is a
// stick man in some pose and the last man of a word carries a flag. The story
// gives only some of the poses, so the 26 here are a table of my own, and the
// table is the whole alphabet. A man is two arms, two legs and a head; an arm
// and a leg each take one of a few shapes (ARMS, LEGS, angles in degrees from
// hanging straight down, outward positive, upper segment then lower) and the
// head leans left, upright or right. POSE gives each letter its five choices.
// The 26 are picked from the 5292 combinations one at a time, each the one
// whose silhouette lies furthest from all those already picked, starting from
// the plain standing man; the two nearest differ in 35 LEDs of about 65.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, sin, cos, sqrt, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const fr = (v) => v - floor(v);
const D2R = PI / 180;

const ARMS = [
  [35, 25], // hanging
  [90, 90], // straight out
  [140, 165], // raised in a V
  [90, 170], // elbow out, hand up
  [90, 10], // elbow out, hand down
  [55, -25], // hand on the hip
  [150, 70], // raised, hand turned out
];
const LEGS = [
  [3, 1], // standing
  [32, 26], // wide
  [78, 70], // kicked out sideways
  [48, -8], // knee out, foot under
  [-16, -22], // crossed over
  [62, 4], // knee out high, shin down
];
// Left arm, right arm, left leg, right leg, head (-1 left, 0, 1 right).
const POSE = {
  A: [0, 0, 0, 0, 0], B: [0, 5, 1, 1, -1], C: [3, 4, 2, 2, -1], D: [4, 1, 2, 4, 1], E: [2, 6, 3, 3, 1],
  F: [4, 2, 0, 5, -1], G: [1, 6, 5, 0, -1], H: [0, 4, 1, 2, 1], I: [5, 1, 5, 5, 0], J: [3, 2, 4, 1, 0],
  K: [6, 3, 0, 2, 0], L: [3, 0, 3, 0, 1], M: [1, 0, 0, 3, 1], N: [6, 0, 2, 3, 0], O: [6, 0, 3, 4, -1],
  P: [5, 6, 1, 4, 0], Q: [2, 0, 4, 2, 1], R: [5, 2, 3, 2, -1], S: [2, 4, 1, 0, 0], T: [4, 5, 5, 1, 1],
  U: [5, 3, 4, 3, -1], V: [0, 3, 4, 5, 1], W: [6, 6, 0, 0, 1], X: [5, 3, 2, 0, 0], Y: [6, 4, 0, 1, -1],
  Z: [0, 2, 2, 4, -1],
};

// The 3 by 5 capitals, one string a row.
const FONT = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101011", V: "101101101010010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111",
};

const MSGS = ["AM HERE ABE SLANEY", "COME HERE AT ONCE", "THE DANCING MEN", "MR HILTON CUBITT"];

// ---- The man. Lengths in LEDs, the origin his hip, y down.
const TORSO = 5, UP_ARM = 2.0, LO_ARM = 2.0, UP_LEG = 3, LO_LEG = 3;
const SHOULDER = 1.6, R_TORSO = 1.25, R_ARM = 0.8, R_LEG = 0.85, R_HEAD = 2.1;
const NOWOBBLE = { lean: 0, head: 0, arm: [0, 0], leg: [0, 0] };

// His capsules [x1, y1, x2, y2, radius] and the two hands. w is the wobble of
// the beat: how far the shoulders lean, and degrees added to each limb.
function body(p, w) {
  const segs = [];
  const sx = w.lean, sy = -TORSO + 0.4;
  segs.push([0, 0, sx, -TORSO, R_TORSO]);
  segs.push([sx + (p[4] * 1.5 + w.head), -TORSO - 3.1, sx + (p[4] * 1.5 + w.head), -TORSO - 3.1, R_HEAD]);
  const hands = [];
  for (let s = 0; s < 2; s++) {
    const side = s ? 1 : -1;
    const a = ARMS[p[s]], a1 = (a[0] + w.arm[s]) * D2R, a2 = (a[1] + w.arm[s] * 1.4) * D2R;
    const ex = sx + side * SHOULDER + side * sin(a1) * UP_ARM, ey = sy + cos(a1) * UP_ARM;
    const hx = ex + side * sin(a2) * LO_ARM, hy = ey + cos(a2) * LO_ARM;
    segs.push([sx + side * SHOULDER, sy, ex, ey, R_ARM], [ex, ey, hx, hy, R_ARM]);
    hands.push([hx, hy]);
    const l = LEGS[p[2 + s]], b1 = (l[0] + w.leg[s]) * D2R, b2 = (l[1] + w.leg[s] * 1.2) * D2R;
    const kx = side * 0.9 + side * sin(b1) * UP_LEG, ky = cos(b1) * UP_LEG;
    segs.push([side * 0.9, 0, kx, ky, R_LEG], [kx, ky, kx + side * sin(b2) * LO_LEG, ky + cos(b2) * LO_LEG, R_LEG]);
  }
  return { segs, hands };
}

// Calls fn(x, y, coverage) for every LED a set of capsules touches, drawn at
// (ox, oy). Coverage is 1 inside, falling to 0 over one LED at the edge.
function cover(segs, ox, oy, fn) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const s of segs) {
    x0 = min(x0, s[0], s[2]) - s[4];
    x1 = max(x1, s[0], s[2]) + s[4];
    y0 = min(y0, s[1], s[3]) - s[4];
    y1 = max(y1, s[1], s[3]) + s[4];
  }
  for (let py = floor(oy + y0 - 1); py <= floor(oy + y1 + 1); py++) {
    if (py < 0 || py >= H) continue;
    for (let px = floor(ox + x0 - 1); px <= floor(ox + x1 + 1); px++) {
      if (px < 0 || px >= W) continue;
      const cx = px + 0.5 - ox, cy = py + 0.5 - oy;
      let c = 0;
      for (const s of segs) {
        const dx = s[2] - s[0], dy = s[3] - s[1], l2 = dx * dx + dy * dy;
        const t = l2 ? cl(((cx - s[0]) * dx + (cy - s[1]) * dy) / l2, 0, 1) : 0;
        const d = sqrt((cx - s[0] - dx * t) ** 2 + (cy - s[1] - dy * t) ** 2);
        const v = s[4] + 0.5 - d;
        if (v > c) c = v;
      }
      if (c > 0) fn(px, py, c > 1 ? 1 : c);
    }
  }
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}
// Blue is a third as bright as green at the same level, so it is paled.
function tint(h, s, v) {
  const f = fr(h), u = exp(-(((f - 0.66) / 0.08) ** 2)), o = exp(-(((f - 0.11) / 0.07) ** 2));
  return hsv(h, s * (1 - 0.35 * u - 0.15 * o), v);
}

// ---- The layout. Men stand five to a row, 30 rows apart, each with his letter
// nine rows under his hip; the tally stands on row 119 with its letters below.
const COLX = [7, 19, 32, 45, 57];
const GRID_TOP = 4, GRID_H = 90;
const BASE = 119;

// ---- The message. Times in seconds from its start: a man every 0.45 s, a
// wait, the tallest bar blinking for 1.4 s, then the letters solved one group
// at a time, most frequent first, 0.5 s for a group and 0.18 s more for each
// copy of its man; the finished line holds 3 s and fades in 0.7.
const T0 = 0.15, TA = 0.45, WAIT = 1.0, BLINK = 1.4, STEP = 0.5, PER = 0.18, HOLD = 3, FADE = 0.7;

function begin(S, m, t) {
  const text = MSGS[m], men = [], cnt = {}, first = [];
  for (let i = 0; i < text.length; i++) if (text[i] !== " ") men.push({ ch: text[i], flag: i + 1 >= text.length || text[i + 1] === " " });
  men.forEach((g, i) => {
    if (!(g.ch in cnt)) {
      cnt[g.ch] = 0;
      first.push(g.ch);
    }
    g.slot = first.indexOf(g.ch);
    g.at = T0 + i * TA;
    g.nth = cnt[g.ch]++;
  });
  // Solving order: by count, the earlier man first among equals.
  const rank = first.slice().sort((a, b) => cnt[b] - cnt[a] || first.indexOf(a) - first.indexOf(b));
  S.tBlink = T0 + (men.length - 1) * TA + WAIT;
  let tt = S.tBlink + BLINK;
  const slots = first.map((ch) => ({ ch, count: cnt[ch], times: [], lab: 0, from: 0, to: 0 }));
  rank.forEach((ch) => {
    const sl = slots[first.indexOf(ch)];
    sl.from = tt;
    sl.to = tt + STEP + PER * cnt[ch];
    sl.lab = ch === rank[0] ? S.tBlink + 0.5 : tt;
    men.forEach((g) => {
      if (g.ch === ch) g.rev = tt + PER * g.nth;
    });
    tt = sl.to;
  });
  men.forEach((g) => slots[g.slot].times.push(g.at));
  S.msg = m;
  S.men = men;
  S.slots = slots;
  S.best = first.indexOf(rank[0]);
  S.maxc = cnt[rank[0]];
  S.rows = Math.ceil(men.length / 5);
  S.tEnd = tt + HOLD;
  S.total = S.tEnd + FADE;
  S.t = t;
}

export function setup(params) {
  params.s = { buf: new Float32Array(N * 3), knob: -1, hue: 0, bps: 1.5, sway: 0.06, ph: 0 };
  begin(params.s, 0, 4);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.bps = 0.75 * cl(k[1] == null ? 2 : k[1], 0.5, 4);
  S.sway = cl(k[3] == null ? 0.06 : k[3], 0, 0.2);
  const km = round(cl(k[2] || 0, 0, MSGS.length - 1));
  if (km !== S.knob) {
    // A turn restarts the message four seconds in, with nine men already up.
    begin(S, km, 4);
    S.knob = km;
  }
  S.ph += d * S.bps;
  S.t += d;
  if (S.t >= S.total) begin(S, (S.msg + 1) % MSGS.length, S.t - S.total);
}

// One colour a pose slot, spread by the golden ratio over 0.6 of the wheel.
const slotHue = (S, j) => 0.55 + S.hue + 0.6 * fr(j * 0.618034);

function put(buf, x, y, rgb, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  for (let c = 0; c < 3; c++) if (rgb[c] * a > buf[i + c]) buf[i + c] = rgb[c] * a;
}
function mix(rgb, w) {
  return [rgb[0] + (1 - rgb[0]) * w, rgb[1] + (1 - rgb[1]) * w, rgb[2] + (1 - rgb[2]) * w];
}
function glyph(buf, ch, x, y, rgb, a) {
  const g = FONT[ch];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r * 3 + c] === "1") put(buf, x + c, y + r, rgb, a);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, t = S.t, men = S.men, n = men.length;
  buf.fill(0);
  const pitch = min(30, floor(GRID_H / S.rows));
  const pad = (GRID_H - S.rows * pitch) / 2;
  const amp = min(90, S.sway * 450);
  const flag = [1, 0.93, 0.62];

  men.forEach((g, i) => {
    if (t < g.at) return;
    const col = i % 5, row = floor(i / 5), age = t - g.at;
    const hue = slotHue(S, g.slot);
    const ox = COLX[col], hip = GRID_TOP + 12 + pad + row * pitch;
    // Appearing: he drops in from four rows above, flashing white.
    const e = sm(0, 0.25, age), a = sm(0, 0.2, age);
    let white = 0.85 * (1 - sm(0, 0.45, age));
    // Solved: his letter lights and he jumps a little higher for half a second.
    const ra = g.rev === undefined ? -1 : t - g.rev;
    let hopH = 2;
    if (ra >= 0) {
      white = max(white, 0.7 * (1 - sm(0, 0.5, ra)));
      hopH += 1.6 * (1 - sm(0, 0.5, ra));
    }
    const ph = S.ph + 0.5 * ((col + row) & 1);
    const w = {
      lean: min(1.5, amp * 0.03) * sin(2 * PI * ph),
      head: 0,
      arm: [amp * sin(2 * PI * ph), amp * sin(2 * PI * (ph + 0.5))],
      leg: [0.45 * amp * sin(2 * PI * (ph + 0.25)), 0.45 * amp * sin(2 * PI * (ph + 0.75))],
    };
    w.head = w.lean * 0.6;
    const oy = hip - hopH * sin(PI * fr(ph)) - 4 * (1 - e);
    const b = body(POSE[g.ch], w);
    const rgb = mix(tint(hue, 0.8, 1), white);
    cover(b.segs, ox, oy, (x, y, c) => put(buf, x, y, rgb, c * a));
    if (g.flag) {
      // The man who ends a word holds a flag in his higher hand.
      const hi = b.hands[0][1] <= b.hands[1][1] ? 0 : 1, hx = b.hands[hi][0], hy = b.hands[hi][1];
      const dir = hi ? 1 : -1, fl = 0.6 * sin(2 * PI * (t * 2.2 + i * 0.37));
      const top = hy - 5.2;
      cover([[hx, hy, hx, top, 0.5]], ox, oy, (x, y, c) => put(buf, x, y, mix(flag, white), 0.8 * c * a));
      cover(
        [[hx, top + 0.3, hx + dir * 3, top + 0.4 + fl, 0.75], [hx, top + 1.5, hx + dir * 2.2, top + 1.6 + fl * 0.7, 0.7]],
        ox, oy, (x, y, c) => put(buf, x, y, mix(flag, white), c * a),
      );
    }
    if (ra >= 0) {
      const lw = 1 - sm(0, 0.5, ra);
      glyph(buf, g.ch, ox - 1, GRID_TOP + 12 + pad + row * pitch + 9, mix(tint(hue, 0.3, 1), lw), 1);
    }
  });

  // The tally: a column of tiles for each pose, one tile for every man of
  // that pose who has appeared.
  const ns = S.slots.length, sp = min(6, floor(60 / ns)), x0 = round((W - ns * sp) / 2);
  const unit = min(7, floor(26 / S.maxc)), bw = max(3, sp - 2);
  const base = tint(0.55 + S.hue, 0.5, 0.32);
  for (let x = 2; x < W - 2; x++) put(buf, x, BASE, base, 1);
  S.slots.forEach((sl, j) => {
    const hue = slotHue(S, j), col = tint(hue, 0.8, 1), bx = x0 + j * sp + floor((sp - bw) / 2);
    // The tallest blinks for BLINK seconds from tBlink; a bar being solved glows.
    let glow = 0;
    if (j === S.best && t >= S.tBlink) glow = t < S.tBlink + BLINK ? (sin(2 * PI * 3.2 * (t - S.tBlink)) > 0 ? 0.8 : 0) : 0.25;
    if (t >= sl.from && t < sl.to) glow = max(glow, 0.5 * (1 - sm(sl.from, sl.to, t)) + 0.15);
    sl.times.forEach((ta, k) => {
      const age = t - ta;
      if (age < 0) return;
      const rgb = mix(col, max(glow, 0.9 * (1 - sm(0, 0.4, age))));
      const yb = BASE - 1 - k * unit;
      for (let yy = 0; yy < unit - 1; yy++) for (let xx = 0; xx < bw; xx++) put(buf, bx + xx, yb - yy, rgb, 1);
    });
    if (t >= sl.lab) {
      const age = t - sl.lab, lw = 1 - sm(0, 0.5, age);
      glyph(buf, sl.ch, x0 + j * sp + floor((sp - 3) / 2), BASE + 3, mix(tint(hue, 0.3, 1), lw), 1);
    }
  });

  // Which message is playing: four dots at the top left.
  for (let m = 0; m < MSGS.length; m++) {
    const on = m === S.msg, c = tint(0.55 + S.hue, 0.5, 1);
    for (let x = 0; x < 5; x++) {
      put(buf, 1 + m * 7 + x, 0, c, on ? 1 : 0.45);
      if (on) put(buf, 1 + m * 7 + x, 1, c, 1);
    }
  }

  const fade = 1 - sm(S.tEnd, S.total, t);
  for (let i = 0; i < N; i++) {
    const j = i * 3;
    display.setPixel(i % W, floor(i / W), round(cl(buf[j] * fade, 0, 1) * 255), round(cl(buf[j + 1] * fade, 0, 1) * 255), round(cl(buf[j + 2] * fade, 0, 1) * 255));
  }
}
