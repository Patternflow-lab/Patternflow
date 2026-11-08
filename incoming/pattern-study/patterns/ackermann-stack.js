// ===== Patternflow pattern =====
// Title:   Ackermann Stack
// Family:  algo
// Idea:    The call stack of the Ackermann function A(3, n) is run for real and drawn standing up the tall panel: each column is a stretch of calls in order, each row a frame on the stack, and each frame is coloured by its first argument m, so the stack climbs a jagged ridge to 127 frames for A(3, 4) while a scan line lights the calls as they are made.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ackermann function (Wilhelm Ackermann, 1928; the two-variable form of Rozsa Peter, 1935, and Raphael Robinson, 1948); the 3 by 5 digits of Kasiski Examination (pattern round 108), copied from kasiski-examination.js; pattern round 110
// Round:   110
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Down=0..3, Zoom=0..3
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the frames with m = 3 are azure, m = 2 violet, m = 1 orange and the leaf calls, where m = 0, are near white, and the part of the run still to come is a pale slate.
// Knob 2: Speed. How fast the scan line moves along the calls, 5 columns a second times the knob, so 10 at 2, where a page of 64 columns takes 6.4 s and the whole of A(3, 4), 10307 calls, is drawn in that. The page then holds for 1.2 s, fades for 0.5 s and the next one starts. 0.2 is ten times slower and 3 is half as fast again.
// Knob 3: Down. How far n comes down from 4. It catches at 0 (A(3, 4) = 125, 10307 calls, 127 frames deep, where it opens), 1 (A(3, 3) = 61, 2432 calls, 63 deep), 2 (A(3, 2) = 29, 541 calls, 31 deep) and 3 (A(3, 1) = 13, 106 calls, 15 deep). The deepest stack on a page always reaches the top, so a frame is 1 row for A(3, 4), 2 rows for A(3, 3), 4 for A(3, 2) and 8 for A(3, 1).
// Knob 4: Zoom. How many calls a column stands for. It catches at 0 (the whole run on one page, 162 calls a column for A(3, 4), where it opens), 1 (41 a column, four pages), 2 (11, fifteen pages) and 3 (3, fifty-four pages), and above 0 the pages come in order from the first call, with a bar along the top row for where the page is in the run. A page is drawn as tall as its deepest stack allows, so the first page at 3 has frames 5 rows tall.

const W = 64, H = 128;
const { floor, round, min, max, ceil, pow, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The function itself, run with an explicit stack instead of the language's:
//   A(0, n)     = n + 1
//   A(m+1, 0)   = A(m, 1)
//   A(m+1, n+1) = A(m, A(m+1, n))
// A frame holds m, n and where it has got to: 0 on entry, 1 once the inner call
// A(m, n-1) is on its way, 2 once the outer call A(m-1, ...) is. Every entry
// into a frame is one call, and the stack height after it is that call's depth.
// A frame's m never goes up as the stack goes down, so the stack at any call is
// m = 3 frames, then m = 2, then m = 1, then at most one with m = 0, and the
// four counts say all of it.
function ackermann(M, N) {
  const fm = new Int32Array(1024), fn = new Int32Array(1024), fs = new Uint8Array(1024);
  const cnt = [0, 0, 0, 0];
  const d = [], a = [], b = [], c = [], e = [];
  let sp = 0, ret = 0, maxd = 0;
  const enter = (m, n) => {
    fm[sp] = m;
    fn[sp] = n;
    fs[sp] = 0;
    sp++;
    cnt[m]++;
    if (sp > maxd) maxd = sp;
    d.push(sp);
    a.push(cnt[3]);
    b.push(cnt[2]);
    c.push(cnt[1]);
    e.push(cnt[0]);
  };
  enter(M, N);
  while (sp > 0) {
    const i = sp - 1, m = fm[i], n = fn[i];
    if (fs[i] === 0) {
      if (m === 0) {
        ret = n + 1;
        cnt[0]--;
        sp--;
      } else if (n === 0) {
        fs[i] = 2;
        enter(m - 1, 1);
      } else {
        fs[i] = 1;
        enter(m, n - 1);
      }
    } else if (fs[i] === 1) {
      fs[i] = 2;
      enter(m - 1, ret);
    } else {
      cnt[m]--;
      sp--;
    }
  }
  return { T: d.length, result: ret, maxd, d: Uint8Array.from(d), a: Uint8Array.from(a), b: Uint8Array.from(b), c: Uint8Array.from(c), e: Uint8Array.from(e) };
}

// The digits, 3 wide and 5 tall, for the count of calls.
const FACE = {
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
  "=": "...|###|...|###|...",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((q) => (q === "#" ? 1 : 0));

const RUNS = [];
for (let n = 4; n >= 1; n--) RUNS.push(ackermann(3, n)); // index 0 is A(3, 4)
const COLS_PER_S = 5, HOLD = 0.9, HOLD_K = 0.6, FADE = 0.5;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, down: 0, zoom: 0, ready: false, run: RUNS[0], k: 1, h: 1, page: 0, pages: 1, nvalid: 64,
    t: 0, head: 0, state: 0,
    hi: new Uint8Array(64), pk: new Uint8Array(64 * 4), hl: new Uint8Array(64), lk: new Uint8Array(64 * 4), first: new Int32Array(64),
    buf: new Uint8Array(W * H * 3),
  };
}

// The run's columns for this page: for each column a stretch of k calls, the
// deepest stack in it and the stack at its last call, each as its four counts.
function paginate(S) {
  const R = S.run, k = S.k, base = S.page * 64 * k;
  let top = 1;
  S.nvalid = 0;
  for (let col = 0; col < 64; col++) {
    const i0 = base + col * k, i1 = min(R.T, i0 + k);
    S.first[col] = i0;
    if (i0 >= R.T) {
      S.hi[col] = 0;
      S.hl[col] = 0;
      continue;
    }
    S.nvalid = col + 1;
    let pk = i0;
    for (let i = i0; i < i1; i++) if (R.d[i] > R.d[pk]) pk = i;
    const lk = i1 - 1;
    S.hi[col] = R.d[pk];
    S.hl[col] = R.d[lk];
    S.pk[col * 4] = R.a[pk];
    S.pk[col * 4 + 1] = R.b[pk];
    S.pk[col * 4 + 2] = R.c[pk];
    S.pk[col * 4 + 3] = R.e[pk];
    S.lk[col * 4] = R.a[lk];
    S.lk[col * 4 + 1] = R.b[lk];
    S.lk[col * 4 + 2] = R.c[lk];
    S.lk[col * 4 + 3] = R.e[lk];
    top = max(top, S.hi[col]);
  }
  // The page is drawn as tall as it will go: a frame is as many rows as the deepest stack on the page leaves room for.
  S.h = max(1, floor(126 / top));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kn[0], 0, 1);
  S.speed = cl(kn[1], 0.2, 3);
  const down = cl(round(kn[2]), 0, 3), zoom = cl(round(kn[3]), 0, 3);
  if (down !== S.down || zoom !== S.zoom || !S.ready) {
    S.down = down;
    S.zoom = zoom;
    S.ready = true;
    S.run = RUNS[down];
    const T = S.run.T;
    S.k = max(1, ceil(ceil(T / 64) / pow(4, zoom)));
    S.pages = ceil(T / (64 * S.k));
    S.page = 0;
    S.t = 0;
    S.state = 0;
    paginate(S);
  }
  S.t += d;
  const cps = COLS_PER_S * S.speed;
  const sweep = S.nvalid / cps, hold = HOLD + HOLD_K / S.speed;
  if (S.state === 0) {
    S.head = min(S.nvalid, S.t * cps);
    if (S.t >= sweep) {
      S.state = 1;
      S.t = 0;
    }
  } else {
    S.head = S.nvalid;
    if (S.t >= hold + FADE) {
      S.page = (S.page + 1) % S.pages;
      S.state = 0;
      S.t = 0;
      S.head = 0;
      paginate(S);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, R = S.run, h = S.h, k = S.k;
  buf.fill(0);
  const hb = S.hue + 0.58;
  const MC = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  hsv(hb + 0.5, 0.12, 1, MC[0]);
  hsv(hb + 0.5, 0.85, 1, MC[1]);
  hsv(hb + 0.22, 0.8, 1, MC[2]);
  hsv(hb, 0.75, 1, MC[3]);
  const GHOST = [0, 0, 0];
  hsv(hb - 0.04, 0.5, 1, GHOST);
  // How far the page has been run: 1 for the columns behind the scan line, 0 ahead of it. At the end of a page it
  // fades back, so the next page starts from its shadow.
  const hold = HOLD + HOLD_K / S.speed;
  const fade = S.state === 1 ? sm((S.t - hold) / FADE) : 0;
  const head = S.head;
  const hc = floor(head);

  const put = (x, y, r, g, bl) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    buf[o] = min(255, r * 255);
    buf[o + 1] = min(255, g * 255);
    buf[o + 2] = min(255, bl * 255);
  };
  // The m of the frame at depth j of a stack of four counts.
  const mOf = (j, a, b, c) => (j <= a ? 3 : j <= a + b ? 2 : j <= a + b + c ? 1 : 0);
  // The rows of the frame at depth j: h rows from the floor up, with a gap row at the top of a frame when it has 3 or more.
  // A shadow (kind 0) is mixed toward a cool grey so that it reads as the part of the run still to come.
  const cell = (x, j, m, kind, lv) => {
    const col = MC[m], yb = 127 - (j - 1) * h;
    for (let r = 0; r < h; r++) {
      let v = lv;
      if (h >= 3 && r === h - 1) v = 0;
      else if (h === 2 && r === 1) v *= 0.7;
      else if (h === 1 && (j & 1)) v *= 0.8;
      if (v <= 0) continue;
      if (kind === 0) put(x, yb - r, (0.75 * GHOST[0] + 0.25 * col[0]) * v, (0.75 * GHOST[1] + 0.25 * col[1]) * v, (0.75 * GHOST[2] + 0.25 * col[2]) * v);
      else put(x, yb - r, col[0] * v, col[1] * v, col[2] * v);
    }
  };

  // Each column twice: the deepest stack in its stretch of calls as a shadow, and
  // over it, once the scan line has passed, the stack at the stretch's last call.
  for (let col = 0; col < S.nvalid; col++) {
    const age = col < hc ? 0.72 + 0.28 * exp(-(head - col - 1) / 7) : 1;
    const done = col < hc ? 1 - fade : 0;
    const hi = S.hi[col], a = S.pk[col * 4], b = S.pk[col * 4 + 1], c = S.pk[col * 4 + 2];
    for (let j = 1; j <= hi; j++) cell(col, j, mOf(j, a, b, c), 0, 0.26 * (1 - 0.7 * done));
    if (done > 0) {
      const hl = S.hl[col], la = S.lk[col * 4], lb = S.lk[col * 4 + 1], lc = S.lk[col * 4 + 2];
      for (let j = 1; j <= hl; j++) cell(col, j, mOf(j, la, lb, lc), 1, done * age);
    }
  }

  // The scan line: the stack as it is at the call under it, whole and bright, and a faint line up the page.
  let calls = 0;
  if (S.state === 0 && hc < S.nvalid) {
    const i = min(R.T - 1, S.first[hc] + floor((head - hc) * k));
    calls = i + 1;
    for (let y = 0; y < H; y++) put(hc, y, 0.1, 0.1, 0.12);
    for (let j = 1; j <= R.d[i]; j++) cell(hc, j, mOf(j, R.a[i], R.b[i], R.c[i]), 1, 1);
    const top = 127 - (R.d[i] - 1) * h - (h - 1);
    put(hc, top, 1, 1, 1);
    if (h > 1) put(hc, top + 1, 1, 1, 1);
  } else {
    const last = min(R.T, (S.page * 64 + S.nvalid) * k);
    calls = last;
  }

  // Where the page is in the run, along the top row, when the run takes more than one page.
  if (S.pages > 1) {
    const x0 = floor((S.page * 64) / S.pages), x1 = max(x0 + 1, floor(((S.page + 1) * 64) / S.pages));
    for (let x = 0; x < W; x++) {
      const on = x >= x0 && x < x1;
      put(x, 0, on ? MC[1][0] : 0.1, on ? MC[1][1] : 0.1, on ? MC[1][2] : 0.12);
    }
  }

  // The count of calls so far, top left. At the end of the last page it is the whole of the run's calls and the result.
  const digits = String(calls);
  const dim = S.state === 1 ? 1 : 0.8;
  for (let q = 0; q < digits.length; q++) {
    const g = GLYPH[digits[q]];
    for (let p = 0; p < 15; p++) if (g[p]) put(2 + q * 4 + (p % 3), 2 + floor(p / 3), dim, dim, dim);
  }
  if (S.page === S.pages - 1 && S.state === 1) {
    const text = "=" + R.result;
    for (let q = 0; q < text.length; q++) {
      const g = GLYPH[text[q]];
      for (let p = 0; p < 15; p++) if (g[p]) put(2 + q * 4 + (p % 3), 9 + floor(p / 3), MC[1][0], MC[1][1], MC[1][2]);
    }
  }

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
