// ===== Patternflow pattern =====
// Title:   Mark Stacks
// Family:  type
// Idea:    Five Vietnamese words are typed down the panel letter by letter, each vowel taking its quality mark (circumflex, breve, horn) and its tone mark (acute, grave, hook, tilde, dot below) as they slide in and snap on, and when a stack grows into the line above or below it a hot glow flares at the contact and the lines slide apart until the gap clears.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: quoc ngu, the Latin script of Vietnamese with its stacked marks (Alexandre de Rhodes, 1651), the Czech haček that shrinks to a stroke beside tall letters (Jan Hus, about 1412), pattern round 106
// Round:   106
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Leading=1..2, Word=0..8
//
// Knob 1: Hue. Turns the colours round the wheel together: at 0 the letters are ice blue, the quality marks cream, and the tone marks run from orange for the acute through green for the grave, aqua for the hook and blue for the tilde to violet-pink for the dot below.
// Knob 2: Speed. How fast the typing goes. At 2 a letter takes 0.3 s and each mark 0.55 s, a word 1.7 to 3.1 s, the five words of the opening set 13 s, and the cycle with its 3.5 s hold and its fade 18 s; 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Leading. The baseline-to-baseline distance the lines start at, 1 to 2 times the cap height of 11 LEDs: 11 LEDs at 1, 22 at 2. Under about 17 a stack touches the line above, a glow flares and the lines slide apart to the distance the marks need, 15 to 19 LEDs; over it nothing touches and the lines stay where the knob put them.
// Knob 4: Word. Which word the stack starts with, out of nine: tieng, Viet, nguoi, nuoc, quoc, ngu, duong, nang, to, each with its marks, and the next four words after it below. The stack is built again when the knob moves.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, sqrt, sin, exp, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;

// The type: letters 6 LEDs wide and 8 tall to the x-height, strokes 2 LEDs
// thick, 3 more rows for an ascender or a capital, 4 for a descender.
const XH = 11, GW = 7, TK = 2, DS = 5, ASC = 4, GAPL = 2;
// Where the words sit: the first line's x-height row, the cap height that the
// leading is counted in, the lines and the empty rows the glow needs.
const X0 = 10, TOP0 = 9, UNIT = 10, NL = 5, MING = 1, STAG = 1;

// Marks, by the letter code the words below use: c circumflex, b breve, h horn,
// a acute, g grave, k hook above, t tilde, d dot below, v caron. The first
// three are quality marks, the next five are tones, in the order of the legend.
const MARKS = {
  c: ["..##..", ".####.", "##..##"],
  b: ["##..##", ".####."],
  h: [".#", "##", ".#", ".#"],
  a: ["..##", ".##.", "##.."],
  g: ["##..", ".##.", "..##"],
  k: [".##", "..#", ".#.", ".#."],
  t: [".##.#", "#.##."],
  d: ["##", "##"],
  v: ["#...#", ".#.#.", "..#.."],
  s: [".#", ".#", "#."],
};
const TONES = "agktd";
// The order the legend's lights are kept in.
const USE = "abcdghkt";
const QUAL = "cbh";

// The words, as base letter then the marks it carries in the order Unicode's
// canonical decomposition lists them (a dot below comes before a circumflex or
// breve). "đ" is d with a stroke, which has no decomposition.
const WORDS = [
  ["t", "i", "eca", "n", "g"], // tieng, with the circumflex and acute
  ["V", "i", "edc", "t"], // Viet
  ["n", "g", "uh", "ohg", "i"], // nguoi
  ["n", "uh", "oha", "c"], // nuoc
  ["q", "u", "oca", "c"], // quoc
  ["n", "g", "uht"], // ngu
  ["đ", "uh", "ohg", "n", "g"], // duong
  ["n", "adb", "n", "g"], // nang
  ["t", "ock"], // to
];

function glyphs() {
  const grid = (w, h) => Array.from({ length: h }, () => new Array(w).fill(0));
  const rect = (g, x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < g[y].length) g[y][x] = 1;
  };
  const clr = (g, x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < g[y].length) g[y][x] = 0;
  };
  const cut = (g, x0, y0, x1, y1) => {
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) g[y][x] = 0;
  };
  const rows = (g) => g.map((r) => r.map((v) => (v ? "#" : ".")).join(""));
  const out = {}, W6 = GW, T = TK;
  const add = (ch, top, g) => (out[ch] = { top, rows: rows(g), w: g[0].length });
  const ring = () => {
    const g = grid(W6, XH);
    rect(g, 0, 0, W6 - 1, XH - 1);
    clr(g, T, T, W6 - 1 - T, XH - 1 - T);
    cut(g, 0, 0, W6 - 1, XH - 1);
    return g;
  };
  add("o", 0, ring());
  {
    const g = ring();
    clr(g, W6 - T, T + 1, W6 - 1, XH - T - 2);
    add("c", 0, g);
  }
  {
    const g = ring(), by = (XH - T) >> 1;
    rect(g, 0, by, W6 - 1, by + T - 1);
    clr(g, W6 - T, by + T, W6 - 1, XH - T - 1);
    add("e", 0, g);
  }
  {
    const g = grid(W6, XH);
    rect(g, 0, 0, T - 1, XH - 1);
    rect(g, 0, 0, W6 - 2, T - 1);
    rect(g, W6 - T, 1, W6 - 1, XH - 1);
    add("n", 0, g);
  }
  {
    const g = grid(W6, XH);
    rect(g, 0, 0, T - 1, XH - 2);
    rect(g, W6 - T, 0, W6 - 1, XH - 1);
    rect(g, 1, XH - T, W6 - 1, XH - 1);
    add("u", 0, g);
  }
  for (const ch of ["g", "q"]) {
    const h = XH + DS, g = grid(W6, h), r = ring();
    for (let y = 0; y < XH; y++) for (let x = 0; x < W6; x++) g[y][x] = r[y][x];
    rect(g, W6 - T, 0, W6 - 1, ch === "g" ? h - T : h - 1);
    g[0][W6 - 1] = 0;
    g[XH - 1][W6 - 1] = 1;
    if (ch === "g") {
      rect(g, 0, h - T, W6 - 1, h - 1);
      cut(g, 0, h - T, W6 - 1, h - 1);
      g[h - T][W6 - 1] = 1;
    }
    add(ch, 0, g);
  }
  {
    const g = grid(W6, XH);
    rect(g, 1, 0, W6 - 2, T - 1);
    rect(g, W6 - T, 1, W6 - 1, XH - 1);
    rect(g, 1, (XH >> 1) - 1, W6 - 1, XH >> 1);
    rect(g, 0, XH >> 1, T - 1, XH - 2);
    rect(g, 1, XH - T, W6 - 1, XH - 1);
    add("a", 0, g);
  }
  {
    const wt = W6 - 1, g = grid(wt, XH + 2);
    rect(g, 1, 0, T, XH + 1);
    rect(g, 0, 2, wt - 1, 3);
    rect(g, 1 + T, XH + 1, wt - 1, XH + 1);
    g[XH][1 + T] = 1;
    g[XH + 1][wt - 1] = 1;
    add("t", -2, g);
  }
  {
    const g = grid(T, XH + 3);
    rect(g, 0, 0, T - 1, 1);
    rect(g, 0, 3, T - 1, XH + 2);
    add("i", -3, g);
  }
  {
    const wv = W6 + 2, h = XH + ASC, g = grid(wv, h);
    for (let y = 0; y < h; y++) {
      const x0 = round((y * ((wv - 2 * T) / 2)) / (h - 1));
      rect(g, x0, y, x0 + T - 1, y);
      rect(g, wv - x0 - T, y, wv - x0 - 1, y);
    }
    add("V", -ASC, g);
  }
  for (const ch of ["d", "đ"]) {
    const h = XH + ASC, g = grid(W6, h), r = ring();
    for (let y = 0; y < XH; y++) for (let x = 0; x < W6; x++) g[ASC + y][x] = r[y][x];
    rect(g, W6 - T, 0, W6 - 1, h - 1);
    if (ch !== "d") rect(g, W6 - T - 2, 1, W6 - 1, T);
    add(ch, -ASC, g);
  }
  return out;
}

// Where each mark of a letter goes, as an offset from the letter's top-left
// at the x-height row: a circumflex or breve sits over the letter, a tone with
// a circumflex goes beside its apex (the acute to the right, the grave to the
// left) or above it (the tilde), a tone alone goes over the letter, a dot
// goes below the baseline and a horn on the right shoulder.
function slot(code, w, qual) {
  const q = qual, mid = (n) => (w - n + 1) >> 1;
  switch (code) {
    case "c": return [mid(6), -4];
    case "b": return [mid(6), -3];
    case "h": return [w - 1, -2];
    case "d": return [(w - 2) >> 1, XH + 1];
    case "a": return q === "c" ? [mid(6) + 5, -7] : q === "b" ? [mid(4), -7] : [mid(4), -4];
    case "g": return q === "c" ? [mid(6) - 3, -7] : q === "b" ? [mid(4), -7] : [mid(4) - (q === "h" ? 1 : 0), -4];
    case "k": return q === "c" ? [mid(6) + 5, -8] : q === "b" ? [mid(3), -9] : [mid(3), -5];
    case "t": return q === "c" || q === "b" ? [mid(5), -7] : [mid(5) - (q === "h" ? 1 : 0), -3];
    default: return [0, 0];
  }
}

// A word laid out in cells: its elements are the letters' bodies and their
// marks, each a bitmap at a place, with the first and last row of ink in
// every column it covers, from which the lines' contact is worked out.
function layout(spec, GL) {
  const els = [];
  let x = 0, lettersN = 0;
  for (const code of spec) {
    const base = code[0], mk = code.slice(1).split("").filter(Boolean), g = GL[base];
    const qual = mk.find((m) => QUAL.includes(m)) || "";
    const add = (kind, code2, rows, ex, ey, li, mi) => {
      const c0 = ex, c1 = ex + rows[0].length - 1, top = [], bot = [];
      for (let c = c0; c <= c1; c++) {
        let t = 1e9, b = -1e9;
        for (let r = 0; r < rows.length; r++) if (rows[r][c - ex] === "#") (t = min(t, ey + r)), (b = max(b, ey + r));
        top.push(t);
        bot.push(b);
      }
      els.push({ kind, code: code2, rows, x: ex, y: ey, c0, top, bot, li, mi, t0: 0, t1: 0, sx: 0, sy: 0 });
    };
    add(0, base, g.rows, x, g.top, lettersN, -1);
    mk.forEach((m, mi) => {
      const [dx, dy] = slot(m, g.w, qual);
      add(QUAL.includes(m) ? 1 : 2, m, MARKS[m], x + dx, dy, lettersN, mi);
      const e = els[els.length - 1];
      // Marks slide in from above, the horn from the right and the dot from below.
      e.sx = m === "h" ? 7 : 0;
      e.sy = m === "d" ? 9 : m === "h" ? -3 : -10;
    });
    x += g.w + (mk.includes("h") ? 1 : 0) + GAPL;
    lettersN++;
  }
  return { els, width: x - GAPL, letters: lettersN };
}

export function setup(params) {
  const GL = glyphs();
  params.s = {
    GL,
    wl: WORDS.map((w) => layout(w, GL)),
    B: new Float32Array(N * 3),
    pal: new Float32Array(48), palHue: -1,
    set: -1, t: 1.2, clock: 0, hue: 0, speed: 2, lead: 11,
    // Line k: which word, the times it starts and finishes, its elements
    // with their times, and how far it sits below the line above.
    lines: Array.from({ length: NL }, () => ({ w: 0, els: [], t0: 0, done: 0, top: new Float32Array(W), bot: new Float32Array(W), alpha: 1 })),
    pp: new Float32Array(NL).fill(11),
    ytop: new Int32Array(NL),
    gap: new Float32Array(NL).fill(99), hit: new Uint8Array(NL), glow: new Float32Array(NL), gx: new Float32Array(NL), gy: new Float32Array(NL),
    ceil: new Int32Array(NL), flo: new Int32Array(NL), cols: new Float32Array(W),
    use: new Float32Array(8), useSm: new Float32Array(8),
    trace: null, end: 0, clearAt: 0, collided: 0,
  };
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Starts a stack: the five words from the knob's on, each line's letters timed
// one after another, a word starting once the one above has settled.
function start(S, w0) {
  S.set = w0;
  S.t = 1.2;
  let end = 0;
  for (let k = 0; k < NL; k++) {
    let t = 0.3 + STAG * k;
    const ln = S.lines[k], wi = (w0 + k) % WORDS.length, wl = S.wl[wi];
    ln.w = wi;
    ln.t0 = t;
    ln.els = wl.els.map((e) => ({ ...e }));
    let li = -1, tl = t;
    for (const e of ln.els) {
      if (e.li !== li) {
        li = e.li;
        tl = t;
        t += 0.3;
        e.t0 = tl;
        e.t1 = tl + 0.28;
      } else {
        e.t0 = t + 0.05;
        e.t1 = e.t0 + 0.45;
        t = e.t0 + 0.5;
      }
    }
    t += 0.1;
    ln.done = t;
    ln.alpha = 1;
    end = max(end, t);
  }
  S.end = end;
  S.clearAt = end + 3.2;
  S.pp.fill(S.lead);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.lead = round(cl(kv[2], 1, 2) * UNIT);
  const w0 = cl(round(kv[3]), 0, WORDS.length - 1);
  if (w0 !== S.set) start(S, w0);
  const adv = d * (S.speed / 2);
  S.t += adv;
  S.clock += adv;
  // After the hold the words fade out line by line, and the stack starts over.
  if (S.t > S.clearAt + 0.35 * NL + 0.6) start(S, S.set);
  const t = S.t;
  for (let k = 0; k < NL; k++) {
    const ln = S.lines[k];
    ln.alpha = 1 - sm((t - S.clearAt - 0.35 * k) / 0.6);
  }
  analyse(S, adv);
}

// Which elements are inked by now, each line's top and bottom ink per column,
// and how far each line is from the one above. A line that is touching the
// one above gets a glow where the two are closest, and the pitch eases out
// to the distance that clears it.
function analyse(S, adv) {
  const t = S.t, tot = 1e9;
  S.use.fill(0);
  for (let k = 0; k < NL; k++) {
    const ln = S.lines[k];
    ln.top.fill(tot);
    ln.bot.fill(-tot);
    let c = 1e9, f = -1e9;
    for (const e of ln.els) {
      const on = e.kind === 0 ? t >= e.t0 : t >= e.t1;
      if (!on || ln.alpha <= 0.02) continue;
      if (e.kind > 0) S.use[USE.indexOf(e.code)] += 1;
      for (let i = 0; i < e.top.length; i++) {
        const x = X0 + e.c0 + i;
        if (x < 0 || x >= W) continue;
        if (e.top[i] < ln.top[x]) ln.top[x] = e.top[i];
        if (e.bot[i] > ln.bot[x]) ln.bot[x] = e.bot[i];
      }
      for (let i = 0; i < e.top.length; i++) {
        if (e.top[i] < c) c = e.top[i];
        if (e.bot[i] > f) f = e.bot[i];
      }
    }
    S.ceil[k] = c > 1e8 ? 0 : c;
    S.flo[k] = f < -1e8 ? 0 : f;
  }
  // Pitches: ease toward the larger of the knob's and the one that clears the
  // ink on both sides, then lay the lines out.
  let y = TOP0;
  S.ytop[0] = y;
  S.collided = 0;
  for (let k = 1; k < NL; k++) {
    const a = S.lines[k - 1], b = S.lines[k];
    let pitch = S.pp[k];
    const meet = (p) => {
      // Smallest clear gap of ink in rows, with the columns either side counted,
      // and the middle one of the columns that are that close.
      let g = tot, n = 0;
      const gaps = S.cols;
      for (let x = 0; x < W; x++) {
        gaps[x] = tot;
        const bt = b.top[x];
        if (bt > 1e8) continue;
        const ab = max(a.bot[x], a.bot[max(0, x - 1)], a.bot[min(W - 1, x + 1)]);
        if (ab < -1e8) continue;
        gaps[x] = p + bt - ab - 1;
        if (gaps[x] < g) g = gaps[x];
      }
      const near = [];
      for (let x = 0; x < W; x++) if (gaps[x] <= g + 0.5 && g < 1e8) near.push(x);
      n = near.length ? near[near.length >> 1] : 0;
      return [g, n];
    };
    // The pitch the ink needs to stand a row apart, and the pitch now.
    const [g0] = meet(round(pitch));
    const need = g0 > 1e8 ? 0 : round(pitch) - g0 + MING;
    const want = max(S.lead, need);
    if (want > pitch) pitch = min(want, pitch + 10 * adv);
    else pitch = max(want, pitch - 16 * adv);
    if (S.t < 0.35) pitch = S.lead;
    S.pp[k] = pitch;
    y += round(pitch);
    S.ytop[k] = y;
    const [g, gx] = meet(round(pitch));
    S.gap[k] = g > 1e8 ? 99 : g;
    S.hit[k] = g < MING ? 1 : 0;
    if (S.hit[k]) {
      S.collided++;
      S.gx[k] = gx;
      S.gy[k] = (S.ytop[k - 1] + S.lines[k - 1].bot[gx] + S.ytop[k] + b.top[gx]) / 2;
      S.glow[k] = max(S.glow[k], 0.7 + 0.3 * cl((MING - g) / 3, 0, 1));
    } else S.glow[k] *= exp(-adv * 2.6);
  }
  S.glow[0] = 0;
  for (let i = 0; i < 8; i++) S.useSm[i] += (min(1, S.use[i]) - S.useSm[i]) * min(1, adv * 6);
}

function put(B, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  if (r > B[o]) B[o] = r;
  if (g > B[o + 1]) B[o + 1] = g;
  if (b > B[o + 2]) B[o + 2] = b;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const B = S.B, pal = S.pal, t = S.t;
  if (S.palHue !== S.hue) {
    const h = S.hue;
    hsv(h + 0.58, 0.5, 0.95, pal, 0); // letters
    hsv(h + 0.12, 0.45, 1, pal, 3); // quality marks
    for (let i = 0; i < 5; i++) hsv(h + 0.02 + 0.2 * i, 0.82, 1, pal, 6 + 3 * i); // tones
    hsv(h + 0.7, 0.3, 0.42, pal, 21); // metric guides
    hsv(h + 0.93, 0.5, 0.5, pal, 24); // ceiling and floor
    S.palHue = h;
  }
  const col = (slot) => [pal[slot * 3], pal[slot * 3 + 1], pal[slot * 3 + 2]];
  const cLet = col(0), cQual = col(1), cTone = [col(2), col(3), col(4), col(5), col(6)], cGuide = col(7), cLim = col(8);
  B.fill(0);
  const trace = S.trace;
  const plot = (k, x, y, r, g, b) => {
    put(B, x, y, r, g, b);
    if (trace && x >= 0 && x < W && y >= 0 && y < H) trace[k].push(y * W + x);
  };
  for (let k = 0; k < NL; k++) {
    const ln = S.lines[k], yt = S.ytop[k], al = ln.alpha;
    if (al <= 0.02) continue;
    const gl = t >= ln.done ? exp(-(t - ln.done) / 0.8) : 0, toned = sm((t - ln.done) / 0.3);
    for (const e of ln.els) {
      if (t < e.t0) continue;
      const w = e.rows[0].length;
      let c, ex = X0 + e.x, ey = yt + e.y, vis = e.rows.length, br = 1;
      if (e.kind === 0) {
        const pb = cl((t - e.t0) / 0.28, 0, 1);
        vis = ceil(pb * e.rows.length);
        c = cLet;
      } else {
        const u = cl((t - e.t0) / 0.45, 0, 1), f = (1 - u) ** 3;
        ex += round(f * e.sx);
        ey += round(f * e.sy);
        br = cl(u * 3, 0, 1);
        c = e.kind === 1 ? cQual : cTone[TONES.indexOf(e.code)];
        // A tone mark stays pale until its word is complete, then takes its colour.
        if (e.kind === 2) {
          const ct = cTone[TONES.indexOf(e.code)];
          c = [mix(cQual[0], ct[0], toned), mix(cQual[1], ct[1], toned), mix(cQual[2], ct[2], toned)];
        }
      }
      const land = e.kind > 0 && t >= e.t1 ? exp(-(t - e.t1) / 0.14) : 0;
      const wh = max(land * 0.7, gl * 0.45, e.kind === 0 && t < e.t1 ? 0.5 : 0);
      for (let r = 0; r < vis; r++) {
        const row = e.rows[r], lead = e.kind === 0 && r === vis - 1 && t < e.t1 ? 0.55 : 0;
        for (let q = 0; q < w; q++)
          if (row[q] === "#") {
            const f = max(wh, lead);
            plot(k, ex + q, ey + r, (mix(c[0], 1, f) * br) * al, (mix(c[1], 1, f) * br) * al, (mix(c[2], 1, f) * br) * al);
          }
      }
    }
    // A glow round a word that has just been completed.
    if (gl > 0.02) {
      for (const e of ln.els) {
        if (e.kind > 0 && t < e.t1) continue;
        const ex = X0 + e.x, ey = yt + e.y;
        for (let r = 0; r < e.rows.length; r++)
          for (let q = 0; q < e.rows[0].length; q++)
            if (e.rows[r][q] === "#")
              for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const c = e.kind === 2 ? cTone[TONES.indexOf(e.code)] : cLet;
                put(B, ex + q + dx, ey + r + dy, c[0] * gl * 0.35 * al, c[1] * gl * 0.35 * al, c[2] * gl * 0.35 * al);
              }
      }
    }
    // The metric guides at the left edge: baseline, x-height, cap height, and the
    // ceiling and floor the ink on the line needs.
    const gb = yt + XH, gx = yt - 1, gc = yt - ASC - 1;
    const dim = al;
    for (let x = 0; x < 7; x++) put(B, x, gb, cGuide[0] * dim, cGuide[1] * dim, cGuide[2] * dim);
    for (let x = 0; x < 4; x++) {
      put(B, x, gx, cGuide[0] * 0.8 * dim, cGuide[1] * 0.8 * dim, cGuide[2] * 0.8 * dim);
      put(B, x, gc, cGuide[0] * 0.8 * dim, cGuide[1] * 0.8 * dim, cGuide[2] * 0.8 * dim);
    }
    for (let x = 8; x < W; x += 4) put(B, x, gb, cGuide[0] * 0.28 * dim, cGuide[1] * 0.28 * dim, cGuide[2] * 0.28 * dim);
    if (S.ceil[k] !== 0 || S.flo[k] !== 0) {
      const cy = yt + S.ceil[k] - 1, fy = yt + S.flo[k] + 1;
      for (let x = 0; x < 6; x += 2) {
        put(B, x, cy, cLim[0] * dim, cLim[1] * dim, cLim[2] * dim);
        put(B, x, fy, cLim[0] * dim, cLim[1] * dim, cLim[2] * dim);
      }
    }
  }
  // Where two lines touch: a hot glow at the contact.
  for (let k = 1; k < NL; k++) {
    const gv = S.glow[k];
    if (gv < 0.03) continue;
    const cx = S.gx[k] + 0.5, cy = S.gy[k] + 0.5;
    const x0 = max(0, floor(cx - 14)), x1 = min(W - 1, ceil(cx + 14)), y0 = max(0, floor(cy - 11)), y1 = min(H - 1, ceil(cy + 11));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dd = sqrt(((x + 0.5 - cx) / 1.8) ** 2 + (y + 0.5 - cy) ** 2), v = exp(-(dd * dd) / 26) * gv, core = v * v;
        const o = (y * W + x) * 3;
        B[o] = min(1, B[o] + v * 0.95 + core * 0.5);
        B[o + 1] = min(1, B[o + 1] + v * 0.42 + core * 0.7);
        B[o + 2] = min(1, B[o + 2] + v * 0.1 + core * 0.55);
      }
  }
  // The legend: the five tones and three quality marks, lit once a stack holds one.
  const ly0 = min(111, S.ytop[NL - 1] + XH + DS + 7);
  const LEG = [["a", 2, 0], ["g", 15, 0], ["k", 28, 0], ["t", 38, 2], ["d", 54, 4], ["c", 2, 10], ["b", 17, 11], ["h", 33, 10]];
  for (const [code, lx, dy] of LEG) {
    const ly = ly0 + dy;
    const i = USE.indexOf(code), lit = S.useSm[i], tone = TONES.indexOf(code);
    const c = tone >= 0 ? cTone[tone] : cQual, v = 0.3 + 0.7 * lit, bm = MARKS[code];
    for (let r = 0; r < bm.length; r++)
      for (let q = 0; q < bm[r].length; q++)
        if (bm[r][q] === "#") for (let a = 0; a < 4; a++) put(B, lx + q * 2 + (a & 1), ly + r * 2 + (a >> 1), c[0] * v, c[1] * v, c[2] * v);
  }
  // The Czech aside, a small d on the legend's last row: its haček has no room
  // above the ascender, glows where it meets the ceiling, and shrinks to the
  // stroke that sits beside the stem (the one letter in the legend that
  // changes the shape of its mark when the stack is too tight).
  {
    const u = (S.clock % 7), ax = 44, ay = ly0 + 8;
    const rowsD = ["...##", "...##", ".####", "##.##", "##.##", ".####"];
    const fade = 1 - sm((u - 6.2) / 0.7), wipe = cl(u / 0.8, 0, 1);
    const shown = ceil(wipe * rowsD.length);
    for (let r = 0; r < shown; r++)
      for (let q = 0; q < 5; q++) if (rowsD[r][q] === "#") put(B, ax + q, ay + 3 + r, cLet[0] * fade, cLet[1] * fade, cLet[2] * fade);
    // The ceiling the mark must stay under, dotted, shown while it is in play.
    const lim = sm((u - 1.0) / 0.3) * fade;
    for (let q = 0; q < 12; q += 2) put(B, ax - 2 + q, ay + 2, cLim[0] * lim, cLim[1] * lim, cLim[2] * lim);
    if (u > 1.0 && u < 6.9) {
      let bm, bx, by, hot = 0;
      if (u < 1.7) {
        const f = (1 - cl((u - 1) / 0.7, 0, 1)) ** 3;
        bm = ["##.##", ".###."];
        bx = ax;
        by = ay - round(f * 8);
        hot = u > 1.55 ? 1 : 0;
      } else if (u < 2.3) {
        const f = sm((u - 1.7) / 0.6);
        bm = f < 0.5 ? ["##.##", ".###."] : ["#.#", ".#."];
        bx = ax + round(f * 3);
        by = ay + round(f * 1);
        hot = 1 - f;
      } else {
        const f = sm((u - 2.3) / 0.5);
        bm = [".#", ".#", "#."];
        bx = ax + 3 + round(f * 3);
        by = ay + 1 + round(f * 2);
      }
      for (let r = 0; r < bm.length; r++)
        for (let q = 0; q < bm[r].length; q++)
          if (bm[r][q] === "#") put(B, bx + q, by + r, mix(cQual[0], 1, hot * 0.6) * fade, mix(cQual[1], 0.5, hot * 0.6) * fade, mix(cQual[2], 0.2, hot * 0.6) * fade);
      if (hot > 0.01) {
        // The glow on the ceiling.
        for (let y = ay - 3; y <= ay + 5; y++)
          for (let x = ax - 4; x <= ax + 9; x++) {
            const dd = sqrt(((x - ax - 2) / 1.6) ** 2 + (y - ay - 2) ** 2), v = exp(-(dd * dd) / 6) * hot * 0.8 * fade;
            if (v > 0.02) put(B, x, y, v, v * 0.5, v * 0.15);
          }
      }
    }
  }
  for (let p = 0; p < N; p++) display.setPixel(p & 63, p >> 6, min(255, B[p * 3] * 255), min(255, B[p * 3 + 1] * 255), min(255, B[p * 3 + 2] * 255));
}
