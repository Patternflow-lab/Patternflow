// ===== Patternflow pattern =====
// Title:   Roman Addition
// Family:  type
// Idea:    A running sum is worked in Roman numerals down a slate the way they add without place value: the two terms are written, each subtractive pair glows and the symbols it stands for burst out of it (IV sends out IIII, CM sends out DCCCC) as every symbol drops into one line sorted from M down to I, then line after line five I, X or C or two V, L or D slide together and fuse with a flash into the next symbol up, and the result is folded back into subtractive form under a double rule and rises to the top to be the next first term.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: adding Roman numerals by merging, sorting and carrying fives and twos, the written trace of the Roman counting board (Karl Menninger, Zahlwort und Ziffer, 1934; Georges Ifrah, Histoire universelle des chiffres, 1981); capitals 7 LEDs tall with 2-LED stems drawn for this pattern; pattern round 100
// Round:   100
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Step=0..999, Notation=0..1
//
// Knob 1: Hue. Turns the symbol colours round the wheel together. At 0 the units and fives (I, V) are aqua, the tens (X, L) azure, the hundreds (C, D) violet and the thousands (M) pink, 0.12 of a turn apart, with V, L and D paler than I, X and C; signs and rules are a pale grey of the same hue.
// Knob 2: Speed. At 2 the second term is written at 12.5 symbols a second, the merge drops a symbol every 0.06 s, each fusion line takes 1 s and the result is held 1.6 s. The opening sum, 1994 + 47, has 22 symbols to merge and six fusions and is worked, held and lifted in 14.1 s; every time goes as 2 / Speed.
// Knob 3: Step. What is added each beat. At 0 every beat adds a fresh term from 1 to 1500, small ones more often (1500 times the product of two uniform draws); any other value adds that number again and again, 250 as CCL, 999 as CMXCIX. When the total would pass 3999, the largest number the subtractive form writes without a bar, the slate fades and a new total starts below 100.
// Knob 4: Notation. Below 0.5 the terms and the result are written in the subtractive form (IV, IX, XL, XC, CD, CM): each pair glows for 0.7 s before the merge and its additive symbols burst out of it, and the result is folded back with a flash. From 0.5 up everything is written in the older additive form (IIII, VIIII, XXXX, DCCCC), the way many Roman inscriptions and most clock faces write four, and the slate goes straight to the merge.

// Roman numerals carry no place value: MDCCCCLXXXXIIII is a pile of
// counters, one M, one D, four C and so on, and its value is their sum. To
// add two of them you pile the counters together, which is the whole of
// Roman addition, and then tidy the pile: five I make a V, two V an X, five
// X an L, two L a C, five C a D and two D an M. Menninger (1934) takes the
// numerals as the written trace of reckoning with counters, I, X, C and M on
// the lines of the board and V, L and D in the spaces between, where only
// the result was written down; the tidying is the board's carry. The
// subtractive pairs IV, IX, XL, XC, CD and CM are a writing habit on top of
// that, settled in the Middle Ages, and have to be unfolded before the
// piles are merged.
//
// The slate keeps every line: the first term, + and the second, a rule, the
// merged line sorted by value, one new line for each fusion, taken from the
// small end because a fusion of I can make the V that completes a pair, a
// double rule, and = with the result. A term below 4000 holds at most four
// I, so the two together hold at most eight and there is never more than
// one group to fuse at a level. Lines wrap after 60 LEDs with one blank row
// under a wrapped row and 4 to 10 under a line, as many as fill the panel;
// a slate still too tall scrolls with the writing.
//
// Each symbol on the slate is a sprite with a time to appear, a move and a
// time to fade, and the whole sum is laid out as soon as it starts, so a
// frame only evaluates the sprites at the slate's own clock.

const W = 64, H = 128;
const { floor, round, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ramp = (t, a, b) => (t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a));
const ease = (u) => u * u * (3 - 2 * u);

// I V X L C D M, then + and =: 7 rows, stems 2 LEDs wide.
const ROWS = [
  ["##", "##", "##", "##", "##", "##", "##"],
  ["##.##", "##.##", "##.##", "##.##", ".###.", ".###.", "..#.."],
  ["#...#", "##.##", ".###.", "..#..", ".###.", "##.##", "#...#"],
  ["##..", "##..", "##..", "##..", "##..", "##..", "####"],
  [".###", "##..", "##..", "##..", "##..", "##..", ".###"],
  ["####.", "##.##", "##.##", "##.##", "##.##", "##.##", "####."],
  ["##...##", "###.###", "##.#.##", "##.#.##", "##...##", "##...##", "##...##"],
  ["...", "...", ".#.", "###", ".#.", "...", "..."],
  ["...", "...", "###", "...", "###", "...", "..."],
];
const PLUS = 7, EQ = 8;
const GW = ROWS.map((r) => r[0].length);
const GLYPH = ROWS.map((rows) => {
  const px = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => c === "#" && px.push(x, y)));
  return px;
});

// Row pitch inside a line, the left edge of the numerals, the hue step a decade.
const RP = 8, X0 = 4, DEC = 0.12, MAXV = 3999;
// Brightness of a line once the next one is written, and of the terms.
const DIM = 0.5, DIMT = 0.62;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// A number as symbols, each with the decade it was written for.
function numeral(n, sub) {
  const out = [];
  const ds = [floor(n / 1000), floor(n / 100) % 10, floor(n / 10) % 10, n % 10];
  for (let k = 0; k < 4; k++) {
    const dec = 3 - k, one = 2 * dec, five = one + 1, ten = one + 2;
    let d = ds[k];
    if (dec === 3) { for (let i = 0; i < d; i++) out.push({ s: 6, dec }); continue; }
    if (sub && d === 4) { out.push({ s: one, dec }, { s: five, dec }); continue; }
    if (sub && d === 9) { out.push({ s: one, dec }, { s: ten, dec }); continue; }
    if (d >= 5) { out.push({ s: five, dec }); d -= 5; }
    for (let i = 0; i < d; i++) out.push({ s: one, dec });
  }
  return out;
}

// Positions in a line: x from X0, wrapping to a new text row past column 63.
function layout(toks) {
  let x = X0, r = 0;
  for (const t of toks) {
    const w = GW[t.s];
    if (x + w > W) { x = X0; r++; }
    t.lx = x; t.lr = r;
    x += w + 1;
  }
  return r + 1;
}

const copy = (toks) => toks.map((t) => ({ s: t.s, dec: t.dec }));

// Lay out one whole sum: lines, sprites, rules and the view's waypoints.
function build(a, b, sub, fresh) {
  const sp = [], rules = [], view = [];
  const aS = numeral(a, sub), aA = numeral(a, false), bS = numeral(b, sub), bA = numeral(b, false);
  const rA = layout(aS), rB = layout(bS);
  // The merged line, sorted by value, each symbol remembering where it came from.
  const merged = [...aA.map((t) => ({ s: t.s, src: t, y: 0 })), ...bA.map((t) => ({ s: t.s, src: t, y: 1 }))];
  merged.sort((p, q) => q.s - p.s);
  const lines = [merged];
  const steps = [];
  for (let s = 0; s < 6; s++) {
    const need = s % 2 ? 2 : 5;
    for (;;) {
      const prev = lines[lines.length - 1];
      const idx = [];
      prev.forEach((t, i) => t.s === s && idx.length < need && idx.push(i));
      if (idx.length < need) break;
      const next = [], map = [];
      let at = -1;
      prev.forEach((t, i) => {
        if (idx.includes(i)) return;
        if (at < 0 && t.s < s + 1) { at = next.length; next.push({ s: s + 1 }); }
        map[i] = next.length;
        next.push({ s: t.s });
      });
      if (at < 0) { at = next.length; next.push({ s: s + 1 }); }
      // The five fusing symbols land on the new symbol's slot.
      idx.forEach((i) => (map[i] = -1 - at));
      lines.push(next);
      steps.push({ map, at });
    }
  }
  const last = lines[lines.length - 1];
  const res = numeral(a + b, sub);
  const lineRows = lines.map((l) => layout(l));
  const rR = max(layout(res), layout(last.map((t) => ({ s: t.s }))));
  // Line heights, then the leading between lines: as much as fills the
  // panel, from 4 to 10 LEDs, with 2 more round a rule and 4 round the double.
  const hs = [rA, rB, ...lineRows, rR].map((r) => (r - 1) * RP + 7);
  const plain = lineRows.length;
  const sumH = hs.reduce((p, q) => p + q, 0);
  const lg = cl(floor((H - 4 - sumH - 6) / (plain + 2)), 4, 10);
  let y = 0;
  const yA0 = y; y += hs[0] + lg;
  const yB0 = y; y += hs[1];
  const rule10 = y + floor((lg + 2) / 2); y += lg + 2;
  const yL0 = lines.map((l, i) => { const v = y; y += hs[2 + i] + (i < lines.length - 1 ? lg : 0); return v; });
  const rule20 = y + floor((lg + 4) / 2) - 1; y += lg + 4;
  const yR0 = y; y += hs[hs.length - 1];
  // Centre the slate; one too tall starts at the top and scrolls.
  const y0 = max(2, floor((H - y) / 2));
  const yA = yA0 + y0, yB = yB0 + y0, rule1 = rule10 + y0, rule2 = rule20 + y0, yR = yR0 + y0;
  const yL = yL0.map((v) => v + y0);
  const bottom = y + y0, maxOff = max(0, bottom + 2 - H);
  const off = (yb) => cl(yb + 2 - H, 0, maxOff);
  const pos = (t, yy) => [t.lx, yy + t.lr * RP];
  const add = (o) => { const s = Object.assign({ m0: 0, m1: 0, a0: -1, a1: -1, d0: 1e9, d1: 1e9, f: -1, g0: -1, dimAt: 1e9, dim: DIM }, o); sp.push(s); return s; };

  // The first term: there already, or faded in on a fresh slate.
  layout(aS);
  const spA = aS.map((t) => add({ g: t.s, x0: t.lx, y0: yA + t.lr * RP, x1: t.lx, y1: yA + t.lr * RP, a0: fresh ? 0 : -1, a1: fresh ? 0.4 : -1, dim: DIMT }));
  let tt = 0.35;
  // + and the second term, symbol by symbol.
  layout(bS);
  add({ g: PLUS, x0: 0, y0: yB, x1: 0, y1: yB, a0: tt, a1: tt + 0.15, sign: 1, dim: DIMT });
  tt += 0.15;
  view.push([tt, off(yB + (rB - 1) * RP + 7)]);
  const spB = bS.map((t, k) => add({ g: t.s, x0: t.lx, y0: yB + t.lr * RP, x1: t.lx, y1: yB + t.lr * RP, a0: tt + 0.08 * k, a1: tt + 0.08 * k + 0.12, dim: DIMT }));
  tt += 0.08 * bS.length + 0.25;
  rules.push({ y: rule1, a0: tt - 0.15, a1: tt + 0.25 });

  // Each additive symbol starts from the written one it copies, or, where a
  // decade holds a subtractive pair, bursts out of the middle of the pair,
  // which glows first: IV sends out IIII, CM sends out DCCCC.
  const tU = tt + 0.1;
  let pairs = false;
  const sources = (subT, subSp, addT) => {
    for (let dec = 0; dec < 4; dec++) {
      const o = [], n = [];
      subT.forEach((t, i) => t.dec === dec && o.push(i));
      addT.forEach((t, i) => t.dec === dec && n.push(i));
      if (o.length === n.length) {
        n.forEach((i, k) => { addT[i].fx = subSp[o[k]].x0; addT[i].fy = subSp[o[k]].y0; addT[i].burst = false; });
        continue;
      }
      pairs = true;
      const cx = o.reduce((p, i) => p + subSp[i].x0 + GW[subT[i].s] / 2, 0) / o.length;
      o.forEach((i) => (subSp[i].g0 = tU));
      n.forEach((i) => { addT[i].fx = cx - GW[addT[i].s] / 2; addT[i].fy = subSp[o[0]].y0; addT[i].burst = true; });
    }
  };
  sources(aS, spA, aA);
  sources(bS, spB, bA);
  tt = pairs ? tU + 0.7 : tt + 0.1;

  // Merge: a copy of every symbol drops into the sorted line.
  const tM = tt;
  for (const s of [...spA, ...spB]) s.dimAt = min(s.dimAt, tM + 0.3);
  view.push([tM, off(yL[0] + (lineRows[0] - 1) * RP + 7)]);
  layout(merged);
  const n0 = merged.length;
  let prevSp = merged.map((t, k) => {
    const to = pos(t, yL[0]), m0 = tM + 0.06 * k;
    return add({ g: t.s, x0: t.src.fx, y0: t.src.fy, x1: to[0], y1: to[1], m0, m1: m0 + 0.7, a0: m0, a1: m0 + 0.08, f: t.src.burst ? m0 : -1 });
  });
  tt = tM + 0.06 * n0 + 0.85;

  // One line for each fusion.
  steps.forEach((st, j) => {
    const prev = lines[j], next = lines[j + 1], yp = yL[j], yn = yL[j + 1];
    layout(prev); layout(next);
    const tc = tt;
    prevSp.forEach((s) => (s.dimAt = min(s.dimAt, tc + 0.3)));
    view.push([tc, off(yn + (lineRows[j + 1] - 1) * RP + 7)]);
    const nextSp = new Array(next.length);
    const slot = pos(next[st.at], yn);
    prev.forEach((t, i) => {
      const from = pos(t, yp), k = st.map[i];
      if (k >= 0) {
        const to = pos(next[k], yn);
        nextSp[k] = add({ g: t.s, x0: from[0], y0: from[1], x1: to[0], y1: to[1], m0: tc, m1: tc + 0.6, a0: tc, a1: tc });
      } else {
        add({ g: t.s, x0: from[0], y0: from[1], x1: slot[0] + (GW[st.at >= 0 ? next[st.at].s : 0] - GW[t.s]) / 2, y1: slot[1], m0: tc, m1: tc + 0.5, a0: tc, a1: tc, d0: tc + 0.4, d1: tc + 0.55 });
      }
    });
    nextSp[st.at] = add({ g: next[st.at].s, x0: slot[0], y0: slot[1], x1: slot[0], y1: slot[1], a0: tc + 0.48, a1: tc + 0.55, f: tc + 0.5 });
    prevSp = nextSp;
    tt += 1.0;
  });

  // The result, folded back into subtractive form a decade at a time.
  const tR = tt;
  prevSp.forEach((s) => (s.dimAt = min(s.dimAt, tR + 0.4)));
  rules.push({ y: rule2, a0: tR, a1: tR + 0.3 }, { y: rule2 + 2, a0: tR + 0.05, a1: tR + 0.35 });
  view.push([tR, off(yR + (rR - 1) * RP + 7)]);
  const resSp = [add({ g: EQ, x0: 0, y0: yR, x1: 0, y1: yR, a0: tR + 0.1, a1: tR + 0.3, sign: 1, dim: 1, res: 1 })];
  const lastT = last.map((t) => ({ s: t.s, dec: t.s >> 1 }));
  layout(lastT); layout(res);
  const yLast = yL[lines.length - 1];
  let folded = false;
  for (let dec = 0; dec < 4; dec++) {
    const o = [], n = [];
    lastT.forEach((t, i) => t.dec === dec && o.push(i));
    res.forEach((t, i) => t.dec === dec && n.push(i));
    const same = o.length === n.length && o.every((i, k) => lastT[i].s === res[n[k]].s);
    if (same) {
      o.forEach((i, k) => {
        const from = pos(lastT[i], yLast), to = pos(res[n[k]], yR);
        resSp.push(add({ g: lastT[i].s, x0: from[0], y0: from[1], x1: to[0], y1: to[1], m0: tR + 0.2, m1: tR + 0.8, a0: tR + 0.2, a1: tR + 0.2, dim: 1, res: 1 }));
      });
      continue;
    }
    folded = true;
    const ocx = o.reduce((p, i) => p + lastT[i].lx + GW[lastT[i].s] / 2, 0) / o.length;
    const ncx = n.reduce((p, i) => p + res[i].lx + GW[res[i].s] / 2, 0) / n.length;
    o.forEach((i) => {
      const from = pos(lastT[i], yLast);
      add({ g: lastT[i].s, x0: from[0], y0: from[1], x1: ncx - GW[lastT[i].s] / 2, y1: yR + res[n[0]].lr * RP, m0: tR + 0.2, m1: tR + 0.7, a0: tR + 0.2, a1: tR + 0.2, d0: tR + 0.55, d1: tR + 0.7 });
    });
    n.forEach((i) => {
      const to = pos(res[i], yR);
      resSp.push(add({ g: res[i].s, x0: ncx - GW[res[i].s] / 2, y0: to[1], x1: to[0], y1: to[1], m0: tR + 0.6, m1: tR + 0.95, a0: tR + 0.6, a1: tR + 0.7, f: tR + 0.65, dim: 1, res: 1 }));
    });
  }
  tt = tR + (folded ? 1.05 : 0.9);
  const glint = tt + 0.2;
  const rise = tt + 1.6;
  return { sp, rules, view, resSp, yA, yR, open: tU, rise, glint, end: rise + 1.3, a, b, total: a + b };
}

// The term each beat adds: the knob's number, or at 0 a fresh one, small
// ones more often.
const nextStep = (S) => (S.step > 0 ? S.step : 1 + floor(Math.random() * Math.random() * 1500));

function newSum(S, a, b, fresh) {
  S.sum = build(a, b, S.sub, fresh);
  S.t = 0;
  S.lifted = false;
}

// A wiped slate starts a new total below 100.
function wipe(S) {
  let b = nextStep(S);
  const a = 1 + floor(Math.random() * 99);
  if (a + b > MAXV) b = MAXV - a;
  newSum(S, a, b, true);
}

export function setup(params) {
  params.s = { t: 0, hue: 0, speed: 2, step: 0, sub: true, sum: null, buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.step = round(cl(k[2] || 0, 0, 999));
  S.sub = (k[3] == null ? 0.06 : k[3]) < 0.5;
  // The first slate opens on 1994 + 47 (or the knob's step), both terms
  // written and the pairs about to glow.
  if (!S.sum) {
    newSum(S, 1994, S.step > 0 ? S.step : 47, true);
    S.t = S.sum.open - 0.2;
  }
  S.t += (d * S.speed) / 2;
  const sum = S.sum;
  // At the lift the next sum is laid out, so the result knows where to rise to.
  if (!S.lifted && S.t >= sum.rise) {
    S.lifted = true;
    const nextA = sum.total, b = nextStep(S);
    if (nextA + b > MAXV) {
      for (const s of sum.resSp) { s.d0 = sum.rise; s.d1 = sum.rise + 0.5; }
      sum.next = null;
    } else {
      const now = S.t;
      newSum(S, nextA, b, false);
      sum.next = S.sum;
      S.sum = sum;
      S.t = now;
      S.lifted = true;
      const cur = viewAt(sum, sum.rise), ty = sum.next.yA;
      for (const s of sum.resSp) {
        if (s.sign) { s.d0 = sum.rise; s.d1 = sum.rise + 0.4; continue; }
        s.x0 = s.x1; s.y0 = s.y1; s.y1 = ty + cur + (s.y0 - sum.yR);
        s.m0 = sum.rise + 0.25; s.m1 = sum.rise + 1.15;
      }
    }
    for (const s of sum.sp) if (!s.res) { s.d0 = min(s.d0, sum.rise); s.d1 = min(s.d1, sum.rise + 0.5); }
    for (const r of sum.rules) r.d0 = sum.rise;
  }
  if (S.t >= sum.end) {
    if (sum.next) { S.sum = sum.next; S.t -= sum.end; S.lifted = false; }
    else wipe(S);
  }
}

// The view's scroll at time t: eased from waypoint to waypoint.
function viewAt(sum, t) {
  let v = 0;
  for (const [t0, o] of sum.view) {
    if (t < t0) break;
    v += (o - v) * ease(ramp(t, t0, t0 + 0.6));
  }
  return v;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.sum) return;
  const sum = S.sum, t = S.t, buf = S.buf;
  buf.fill(0);
  const off = viewAt(sum, t);
  const cols = [];
  for (let s = 0; s < 7; s++) cols.push(hsv(S.hue + 0.48 + DEC * (s >> 1), s % 2 ? 0.5 : 0.88, 1));
  const grey = hsv(S.hue + 0.48, 0.12, 0.85);
  const plot = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 3;
    buf[i] += r; buf[i + 1] += g; buf[i + 2] += b;
  };
  // Rules: drawn from the left, faded at the lift.
  for (const r of sum.rules) {
    const u = ease(ramp(t, r.a0, r.a1)), fade = 1 - ramp(t, r.d0 || 1e9, (r.d0 || 1e9) + 0.5);
    const yy = round(r.y - off), xe = round(60 * u);
    const rl = 255 * 0.45 * fade;
    for (let x = 0; x < xe; x++) plot(x + 2, yy, grey[0] * rl, grey[1] * rl, grey[2] * rl);
  }
  const gl = sum.glint;
  for (const s of sum.sp) {
    const al = (s.a0 < 0 ? 1 : ramp(t, s.a0, s.a1 + 1e-6)) * (1 - ramp(t, s.d0, s.d1 + 1e-6));
    if (al <= 0) continue;
    const u = s.m1 > s.m0 ? ease(ramp(t, s.m0, s.m1)) : t >= s.m0 ? 1 : 0;
    const x = s.x0 + (s.x1 - s.x0) * u, y = s.y0 + (s.y1 - s.y0) * u - off;
    const lv = 1 + (s.dim - 1) * ramp(t, s.dimAt, s.dimAt + 0.4);
    let fl = s.f >= 0 && t >= s.f ? 1.2 * exp(-(t - s.f) / 0.22) : 0;
    if (s.g0 >= 0) fl += 0.8 * ramp(t, s.g0, s.g0 + 0.25) * (1 - ramp(t, s.g0 + 0.7, s.g0 + 1.1));
    if (s.res && t > gl && t < gl + 1.2) {
      const gx = -6 + 76 * (t - gl) / 1.2, dx = (x + GW[s.g] / 2 - gx) / 4;
      fl += 0.7 * exp(-dx * dx);
    }
    const c = s.sign ? grey : cols[s.g];
    const r = (c[0] * lv + fl) * al * 255, g = (c[1] * lv + fl) * al * 255, b = (c[2] * lv + fl) * al * 255;
    const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const px = GLYPH[s.g];
    for (let p = 0; p < px.length; p += 2) {
      const gx = ix + px[p], gy = iy + px[p + 1];
      plot(gx, gy, r * w00, g * w00, b * w00);
      if (w10 > 0.004) plot(gx + 1, gy, r * w10, g * w10, b * w10);
      if (w01 > 0.004) plot(gx, gy + 1, r * w01, g * w01, b * w01);
      if (w11 > 0.004) plot(gx + 1, gy + 1, r * w11, g * w11, b * w11);
    }
    // A fusion glows round the new symbol.
    if (fl > 0.05 && s.f >= 0) {
      const hr = c[0] * fl * al * 70, hg = c[1] * fl * al * 70, hb = c[2] * fl * al * 70;
      const cx = round(x + (GW[s.g] - 1) / 2), cy = round(y + 3);
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > 0 && d2 <= 16) plot(cx + dx, cy + dy, hr / d2, hg / d2, hb / d2);
        }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, min(255, round(buf[i])), min(255, round(buf[i + 1])), min(255, round(buf[i + 2])));
    }
}
