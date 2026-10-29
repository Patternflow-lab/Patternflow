// ===== Patternflow pattern =====
// Title:   Lorem Ipsum
// Family:  type
// Idea:    Cicero's sentence from De finibus is set as a justified block of small type and turned letter by letter into the placeholder it became: an alignment computed at the start says which letters stay, the cut ones drop out of their lines and pile up at the foot of the panel, the kept ones slide into the new justified block, and the missing ones leap back out of the heap or fall in from above.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: lorem ipsum, from Cicero, De finibus bonorum et malorum 1.32-33 (45 BC), the source traced by Richard McClintock (Hampden-Sydney College); the alignment is a longest common subsequence by dynamic programming, the table of Robert Wagner and Michael Fischer's string-to-string correction (1974); pattern round 71
// Round:   71
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Passage=0..3, Gravity=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel together: at 0 the type is cream, letters on their way out turn slate blue and dim in the heap, and letters coming in are mint until they settle.
// Knob 2: Speed. The clock of a turn. At 2 a turn takes 8.1 s: the cut letters fall from 0.35 s to about 2.7 s, the kept ones slide from 1.2 s to 2.6 s, the missing ones arrive from 2.4 s to about 4 s, and the new block holds 3.5 s before it turns back. The first turn starts 0.8 s in. Ten times slower at 0.2, half again as fast at 3.
// Knob 3: Passage. Which sentence and the placeholder made from it: 0 Neque porro quisquam (1.32) and Lorem ipsum, 1 Ut enim ad minima (1.32) and Ut enim ad minim, 2 Quis autem vel eum (1.32) and Duis aute irure, 3 excepturi sint occaecati (1.33) and Excepteur sint occaecat. Turning it sends the block to the new sentence at the next turn.
// Knob 4: Gravity. 240 LEDs/s² at 0, a third of that at -1, three times it at 1. A letter cut from the top line reaches the heap in about 0.9 s at 0, 1.6 s at -1 and 0.55 s at 1, and a letter leaping back out of the heap rises on the same gravity.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const hsv = (h, s, v) => [5, 3, 1].map((n) => ((k) => 255 * v * (1 - s * max(0, min(k, 4 - k, 1))))((n + (h - floor(h)) * 6) % 6));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---- The type: 6 rows, the top one for ascenders, four for the x-height
// and one for descenders; capitals stand on the top five. Rows from the top, comma between
// rows, a missing row blank. Only the letters the eight passages use.
const FONT = {
  a: ",.##,#.#,#.#,.##", b: "#..,##.,#.#,#.#,##.", c: ",.##,#..,#..,.##", d: "..#,.##,#.#,#.#,.##", e: ",.#.,###,#..,.##",
  f: ".##,.#.,###,.#.,.#.", g: ",.##,#.#,#.#,.##,##.", h: "#..,##.,#.#,#.#,#.#", i: "#,,#,#,#", l: "#,#,#,#,#",
  m: ",####.,#.#.#,#.#.#,#.#.#", n: ",##.,#.#,#.#,#.#", o: ",.#.,#.#,#.#,.#.", p: ",##.,#.#,#.#,##.,#..", q: ",.##,#.#,#.#,.##,..#",
  r: ",#.#,##.,#..,#..", s: ",.##,#..,..#,##.", t: ".#.,###,.#.,.#.,..#", u: ",#.#,#.#,#.#,.##", v: ",#.#,#.#,#.#,.#.",
  x: ",#.#,.#.,.#.,#.#", N: "#..#,##.#,#.##,#..#,#..#", L: "#..,#..,#..,#..,###", U: "#.#,#.#,#.#,#.#,###",
  Q: ".##.,#..#,#..#,#..#,.##.,...#", D: "##.,#.#,#.#,#.#,##.", E: "###,#..,##.,#..,###", ",": ",,,,#,#", ".": ",,,,#", "?": "##.,..#,.#.,,.#.",
};
// Each glyph in four turns (0 upright, 1 a quarter turn clockwise, 2 a
// half, 3 a quarter back), with each column's top and bottom ink row, so a
// letter lying on its side in the heap rests on its own strokes.
const GL = {};
for (const ch in FONT) {
  const rows = FONT[ch].split(","), w = max(...rows.map((r) => r.length));
  const b0 = new Uint8Array(w * 6);
  rows.forEach((r, y) => [...r].forEach((v, x) => (b0[y * w + x] = v === "#")));
  GL[ch] = [0, 1, 2, 3].map((t) => {
    const tw = t & 1 ? 6 : w, th = t & 1 ? w : 6, b = new Uint8Array(tw * th);
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < w; x++) {
        if (!b0[y * w + x]) continue;
        const [nx, ny] = t === 0 ? [x, y] : t === 1 ? [5 - y, x] : t === 2 ? [w - 1 - x, 5 - y] : [y, w - 1 - x];
        b[ny * tw + nx] = 1;
      }
    const top = new Int8Array(tw).fill(-1), bot = new Int8Array(tw).fill(-1);
    for (let x = 0; x < tw; x++)
      for (let y = 0; y < th; y++)
        if (b[y * tw + x]) {
          if (top[x] < 0) top[x] = y;
          bot[x] = y;
        }
    return { w: tw, h: th, b, top, bot };
  });
}

// ---- The passages: Cicero's sentence, and the placeholder as it is set
// today. The fourth starts in the middle of Cicero's sentence.
const PAIRS = [
  [
    "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.",
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  ],
  [
    "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur?",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  ],
  [
    "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  ],
  [
    "excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.",
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  ],
];

// The alignment: a longest common subsequence of the two strings, case
// ignored, by the usual table filled from the ends (196 by 123 cells for
// the first pair). Reading the table back gives "=" for a kept character,
// "-" for one cut from a and "+" for one added from b; on a tie it cuts
// before it adds, so a run of cuts stays together.
function align(a, b) {
  const n = a.length, m = b.length, L = new Int32Array((n + 1) * (m + 1)), M = m + 1;
  const eq = (i, j) => a[i].toLowerCase() === b[j].toLowerCase();
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) L[i * M + j] = eq(i, j) ? L[(i + 1) * M + j + 1] + 1 : max(L[(i + 1) * M + j], L[i * M + j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(i, j) && L[i * M + j] === L[(i + 1) * M + j + 1] + 1) ops.push("="), i++, j++;
    else if (L[(i + 1) * M + j] >= L[i * M + j + 1]) ops.push("-"), i++;
    else ops.push("+"), j++;
  }
  while (i++ < n) ops.push("-");
  while (j++ < m) ops.push("+");
  return ops;
}

// ---- Setting. Words are filled greedily into a 62 LED measure from x 1,
// one LED between letters and three between words; every line but the
// last is justified. The extra goes to the word spaces first, up to 4 more
// each, then one LED at a time into the letter spaces from the left. A
// line that would need more than that is left short, as a compositor would
// have hyphenated it. Lines are 7 rows apart from y 2. Returns each
// character's place, null for a space.
const MEAS = 62, X0 = 1, Y0 = 2, LP = 7;
function layout(str) {
  const words = [];
  let at = 0;
  for (const w of str.split(" ")) words.push({ w, at }), (at += w.length + 1);
  const wl = (w) => [...w].reduce((s, c) => s + GL[c][0].w + 1, -1);
  const lines = [];
  let cur = [], len = 0;
  for (const wd of words) {
    const add = wl(wd.w) + (cur.length ? 3 : 0);
    if (cur.length && len + add > MEAS) lines.push(cur), (cur = []), (len = 0);
    len += wl(wd.w) + (cur.length ? 3 : 0);
    cur.push(wd);
  }
  lines.push(cur);
  const pos = new Array(str.length).fill(null);
  lines.forEach((ln, li) => {
    const nat = ln.reduce((s, wd) => s + wl(wd.w), 0) + 3 * (ln.length - 1);
    let extra = li < lines.length - 1 ? MEAS - nat : 0;
    const ws = new Array(ln.length).fill(0), lg = ln.map((wd) => new Array(wd.w.length).fill(0));
    const nWs = ln.length - 1, nLg = ln.reduce((s, wd) => s + wd.w.length - 1, 0);
    if (nWs) for (let k = 0; k < nWs && extra > 0; k++) {
      const give = min(4, floor(extra / (nWs - k)));
      (ws[k] = give), (extra -= give);
    }
    for (let q = 0; q < ln.length && extra > 0; q++) for (let c = 0; c < ln[q].w.length - 1 && extra > 0; c++) lg[q][c]++, extra--;
    let x = X0;
    ln.forEach((wd, q) => {
      for (let c = 0; c < wd.w.length; c++) {
        pos[wd.at + c] = { x, y: Y0 + li * LP, line: li };
        x += GL[wd.w[c]][0].w + 1 + lg[q][c];
      }
      x += 2 + ws[q];
    });
  });
  return pos;
}

// ---- Letters are bodies. Modes:
const LINE = 0, LOOSE = 1, FALL = 2, HEAP = 3, SLIDE = 4, DROP = 5, JUMP = 6, WAIT = 7;
// Times in turn seconds (real seconds at Speed 2) after a turn starts.
const CUE = 0.35, CUT = 1.4, SLIDE_AT = 1.2, SLIDE_T = 1.0, IN_AT = 2.4, IN_SPREAD = 0.8, DONE = 4.6, HOLD = 3.5;
// A heap letter fades after this long unless a later turn takes it back.
const LIFE = 28;

export function setup(params) {
  params.s = { t: 0, ready: false, pair: 0, side: 0, text: "", line: [], bodies: [], next: 0, hue: 0, speed: 2, g: 240, turns: 0, stats: null };
}

function body(ch, x, y, mode) {
  return { ch, rot: 0, x, y, vx: 0, vy: 0, mode, t0: 0, t1: 0, x0: x, y0: y, x1: x, y1: y, to: ch, born: 0, landed: -9, inAt: -9, fresh: false, spin: 0 };
}

function setText(S, str) {
  const pos = layout(str);
  S.text = str;
  S.line = pos.map((p, i) => (p ? body(str[i], p.x, p.y, LINE) : null));
  S.bodies = S.line.filter(Boolean);
}

// Start a turn from the text on the panel to str.
function turn(S, str) {
  const a = S.text, ops = align(a, str), pa = layout(a), pb = layout(str), t = S.t;
  const nl = new Array(str.length).fill(null);
  let nCut = 0, nIn = 0;
  for (let k = 0, i = 0, j = 0; k < ops.length; k++) {
    if (ops[k] === "-" && pa[i]) nCut++;
    if (ops[k] === "+" && pb[j]) nIn++;
    if (ops[k] !== "+") i++;
    if (ops[k] !== "-") j++;
  }
  let cut = 0, inn = 0, kept = 0;
  for (let k = 0, i = 0, j = 0; k < ops.length; k++) {
    const o = ops[k];
    if (o === "=") {
      const b = S.line[i];
      if (b && pb[j]) {
        Object.assign(b, { mode: SLIDE, t0: t + SLIDE_AT + 0.03 * pa[i].line, x0: b.x, y0: b.y, x1: pb[j].x, y1: pb[j].y, to: str[j] });
        b.t1 = b.t0 + SLIDE_T;
        nl[j] = b;
        kept++;
      }
      i++, j++;
    } else if (o === "-") {
      const b = S.line[i];
      // Cut letters go in reading order, the first CUE s before it falls
      // turning towards the colour of the cut.
      if (b) Object.assign(b, { mode: LOOSE, t0: t + CUE + (CUT * cut++) / max(1, nCut - 1) });
      i++;
    } else {
      if (pb[j]) {
        const b = body(str[j], pb[j].x, -8, WAIT);
        Object.assign(b, { t0: t + IN_AT + (IN_SPREAD * inn++) / max(1, nIn - 1), x1: pb[j].x, y1: pb[j].y });
        nl[j] = b;
        S.bodies.push(b);
      }
      j++;
    }
  }
  S.text = str;
  S.line = nl;
  S.next = t + DONE + HOLD;
  S.stats = { kept, cut: nCut, ins: nIn };
}

// Where a sprite at column x would come to rest on the surface.
function restY(surf, sp, x) {
  let y = 1e9;
  for (let c = 0; c < sp.w; c++) if (sp.bot[c] >= 0) y = min(y, surf[x + c] - 1 - sp.bot[c]);
  return y;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.g = 240 * Math.pow(3, cl(k[3], -1, 1));
  const pair = cl(round(k[2]), 0, 3);
  const sd = (d * S.speed) / 2;
  if (!S.ready) {
    S.pair = pair;
    setText(S, PAIRS[pair][0]);
    S.next = 0.8;
    S.ready = true;
  }
  S.t += sd;
  const t = S.t, g = S.g;
  if (t >= S.next) {
    // Turn to the other side of the pair, or to Cicero's side of a new one.
    if (pair !== S.pair) (S.pair = pair), (S.side = 0);
    else S.side ^= 1;
    turn(S, PAIRS[S.pair][S.side]);
    S.turns++;
  }

  // Timed modes.
  const heap = S.bodies.filter((b) => b.mode === HEAP);
  for (const b of S.bodies) {
    if (b.mode === LOOSE && t >= b.t0) {
      // A cut letter tips onto its side a third of the time each way.
      const r = Math.random();
      Object.assign(b, { mode: FALL, vy: 0, vx: 0, y0: b.y, spin: r < 0.25 ? 1 : r < 0.5 ? 3 : 0, born: t });
    } else if (b.mode === SLIDE) {
      const u = cl((t - b.t0) / (b.t1 - b.t0), 0, 1), e = u * u * (3 - 2 * u);
      b.x = b.x0 + (b.x1 - b.x0) * e;
      b.y = b.y0 + (b.y1 - b.y0) * e;
      if (u > 0.5) b.ch = b.to;
      if (u >= 1) b.mode = LINE;
    } else if (b.mode === WAIT && t >= b.t0) {
      // A letter that is needed comes back out of the heap if one like it
      // lies there, the highest first; otherwise it falls in from above.
      let best = null;
      for (const h of heap) if (h.mode === HEAP && h.ch.toLowerCase() === b.ch.toLowerCase() && (!best || h.y < best.y)) best = h;
      b.inAt = t;
      b.fresh = true;
      if (best) {
        best.mode = -1;
        const dy = max(4, best.y - b.y1), T = sqrt((2 * dy) / g);
        Object.assign(b, { mode: JUMP, x0: best.x, y0: best.y, x: best.x, y: best.y, rot: best.rot, t0: t, t1: t + T, vy: -g * T });
      } else Object.assign(b, { mode: DROP, x: b.x1, y: -8 - 10 * Math.random(), vy: 0 });
    } else if (b.mode === DROP) {
      b.vy += g * sd;
      b.y += b.vy * sd;
      if (b.y >= b.y1) Object.assign(b, { y: b.y1, mode: LINE, landed: t });
    } else if (b.mode === JUMP) {
      const s = min(t - b.t0, b.t1 - b.t0), T = b.t1 - b.t0;
      b.x = b.x0 + ((b.x1 - b.x0) * s) / T;
      b.y = b.y0 + b.vy * s + 0.5 * g * s * s;
      if (s > T * 0.4) b.rot = 0;
      if (t >= b.t1) Object.assign(b, { x: b.x1, y: b.y1, mode: LINE, landed: t, rot: 0 });
    }
  }
  S.bodies = S.bodies.filter((b) => b.mode !== -1 && !(b.mode === HEAP && t - b.landed > LIFE + 2));

  // The heap. Resting letters are stacked from the bottom up on a surface
  // of the highest ink in each column; one whose support has gone falls
  // again. A falling letter lands on the surface, unless the column beside
  // it lets it rest two rows lower, when it slides that way first.
  const surf = new Float32Array(W).fill(H);
  const rest = S.bodies.filter((b) => b.mode === HEAP).sort((p, q) => q.y - p.y);
  for (const b of rest) {
    const sp = GL[b.ch][b.rot], ry = restY(surf, sp, b.x);
    if (b.y < ry - 0.5) {
      b.mode = FALL;
      b.vy = 0;
      continue;
    }
    b.y = ry;
    for (let c = 0; c < sp.w; c++) if (sp.top[c] >= 0) surf[b.x + c] = min(surf[b.x + c], ry + sp.top[c]);
  }
  const falling = S.bodies.filter((b) => b.mode === FALL).sort((p, q) => q.y - p.y);
  for (const b of falling) {
    if (b.spin && b.y - b.y0 > 4) (b.rot = b.spin), (b.spin = 0), (b.x = cl(round(b.x) - 1, 0, W - 6));
    const sp = GL[b.ch][b.rot];
    b.x = cl(round(b.x), 0, W - sp.w);
    b.vy += g * sd;
    b.y += b.vy * sd;
    let ry = restY(surf, sp, b.x);
    if (b.y < ry) continue;
    // Look one and two columns either way; step towards the lowest rest
    // if it is 2 rows lower at one column or 3 at two.
    let go = 0, low = ry;
    for (const s of [-1, 1, -2, 2]) {
      const nx = b.x + s;
      if (nx < 0 || nx > W - sp.w) continue;
      const v = restY(surf, sp, nx);
      if (v >= ry + 1 + abs(s) && v > low) (low = v), (go = s > 0 ? 1 : -1);
    }
    if (go) {
      b.x += go;
      b.y = ry;
      b.vy *= 0.5;
      continue;
    }
    Object.assign(b, { y: ry, vy: 0, mode: HEAP, landed: t });
    for (let c = 0; c < sp.w; c++) if (sp.top[c] >= 0) surf[b.x + c] = min(surf[b.x + c], ry + sp.top[c]);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const t = S.t, h = S.hue;
  const cream = hsv(0.11 + h, 0.4, 0.95), slate = hsv(0.6 + h, 0.42, 0.8), mint = hsv(0.45 + h, 0.55, 1);
  const buf = new Float32Array(W * H * 3);
  const order = [LINE, SLIDE, LOOSE, HEAP, FALL, WAIT, DROP, JUMP];
  for (const m of order)
    for (const b of S.bodies) {
      if (b.mode !== m || b.mode === WAIT) continue;
      let c = cream, a = 1;
      if (m === LOOSE) c = mix(cream, slate, cl(1 - (b.t0 - t) / CUE, 0, 1));
      else if (m === FALL) c = slate;
      else if (m === HEAP) {
        const age = t - b.landed;
        a = 1 - 0.45 * cl(age / 2, 0, 1);
        if (age > LIFE) a *= cl(1 - (age - LIFE) / 2, 0, 1);
        c = slate;
      } else if (m === DROP || m === JUMP) c = mint;
      else if (b.fresh && m === LINE) c = mix(mint, cream, cl((t - b.landed) / 1.5, 0, 1));
      const sp = GL[b.ch][b.rot], bx = round(b.x), by = round(b.y);
      for (let y = 0; y < sp.h; y++) {
        const py = by + y;
        if (py < 0 || py >= H) continue;
        for (let x = 0; x < sp.w; x++) {
          const px = bx + x;
          if (px < 0 || px >= W || !sp.b[y * sp.w + x]) continue;
          const p = (py * W + px) * 3;
          buf[p] = c[0] * a, buf[p + 1] = c[1] * a, buf[p + 2] = c[2] * a;
        }
      }
    }
  for (let p = 0; p < W * H; p++) display.setPixel(p % W, floor(p / W), buf[p * 3] | 0, buf[p * 3 + 1] | 0, buf[p * 3 + 2] | 0);
}
