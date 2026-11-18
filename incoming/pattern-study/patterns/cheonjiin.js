// ===== Patternflow pattern =====
// Title:   Cheonjiin
// Family:  type
// Idea:    A phone-style Cheonjiin keypad stands at the foot of the panel and types a Korean phrase one key press at a time, each key lighting as it is pressed and sending its stroke up into a big syllable block where the dot, the bar and the standing person join into vowels (a bar then a dot grows into ㅏ, a second dot into ㅑ, a third key into ㅐ), a consonant key pressed again turns ㄱ into ㅋ and ㄲ, a final that meets a vowel jumps into the next block, and each finished block shrinks into a growing line down the right edge.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Cheonjiin keypad (the three-key Hangul input method of Korean phones, late 1990s, year from memory; key layout from memory), after the three strokes of the Hunminjeongeum Haerye (King Sejong, 1446): the dot for heaven, the flat bar for earth, the standing bar for the person; jamo strokes and syllable slots from jamo-assembly; hsv and tint helpers from de-casteljau; pattern round 111
// Round:   111
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3, Phrase=0..3, Weight=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the dot key (heaven) is amber, the flat bar (earth) green, the standing bar (person) blue and the consonants pink, in the keys, the big block, the key tape and the line; the keypad frame is blue-grey. Amber is made paler so it does not dim to brown.
// Knob 2: Speed. How fast the typing goes. At 2 a new key lands every 0.36 s, the same key again every 0.22 s, a space 0.45 s after the last key and the first key after it 0.5 s, so 하늘 땅 사람 takes 9.2 s to type, the finished line is read for 2.6 s and a round is 13.7 s; at 0.3 it is 6.7 times slower and at 3 one and a half times faster.
// Knob 3: Phrase. 0 하늘 땅 사람 (sky, earth, person: 23 key presses), 1 해 달 별 (sun, moon, star: 16), 2 나무 까치 (tree, magpie: 15), 3 꽃잎 야옹 (petal, meow: 19). The line takes blocks 14 LEDs wide for the five syllables of the first phrase and 15 for the others.
// Knob 4: Weight. How heavy the strokes are, in every letter at once. The standing bar of ㅏ in the big block is 2 LEDs wide at -1, 4 at the opening 0.06 and 6 at 1; the strokes in the line, which are small, run from 1 LED at -1 to 2 at 1.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sqrt, exp, cos, sin, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: orange and yellow are paler and a little lighter.
function tint(h, s, v, out) {
  const f = fr(h);
  if (f > 0.02 && f < 0.2) {
    s *= 0.6;
    v = min(1, v * 1.2);
  }
  hsv(h, s, v, out);
}

// ---- The input method --------------------------------------------------
// Keys 4 to 9 and 0 are consonant keys, each a cycle of letters that a repeated
// press steps through; I (standing bar), D (dot) and E (flat bar) are the vowel
// keys; a space is a space and . ends the phrase.
const KEYS = { 4: "ㄱㅋㄲ", 5: "ㄴㄹ", 6: "ㄷㅌㄸ", 7: "ㅂㅍㅃ", 8: "ㅅㅎㅆ", 9: "ㅈㅊㅉ", 0: "ㅇㅁ" };
// Vowels are the keys pressed in a row; a row that is no vowel's start begins a new vowel.
const VSEQ = {
  I: "ㅣ", E: "ㅡ", ID: "ㅏ", IDD: "ㅑ", DI: "ㅓ", DDI: "ㅕ", DE: "ㅗ", DDE: "ㅛ", ED: "ㅜ", EDD: "ㅠ", EI: "ㅢ",
  IDI: "ㅐ", IDDI: "ㅒ", DII: "ㅔ", DDII: "ㅖ", DEI: "ㅚ", DEID: "ㅘ", DEIDI: "ㅙ", EDI: "ㅟ", EDDI: "ㅝ", EDDII: "ㅞ",
};
const VPRE = new Set();
for (const k in VSEQ) for (let i = 1; i <= k.length; i++) VPRE.add(k.slice(0, i));
// The Unicode orders of the 19 initials, 21 vowels and 28 finals (the first is none).
const INIT = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const MED = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const FIN = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
const CL2 = { ㄳ: "ㄱㅅ", ㄵ: "ㄴㅈ", ㄶ: "ㄴㅎ", ㄺ: "ㄹㄱ", ㄻ: "ㄹㅁ", ㄼ: "ㄹㅂ", ㄽ: "ㄹㅅ", ㄾ: "ㄹㅌ", ㄿ: "ㄹㅍ", ㅀ: "ㄹㅎ", ㅄ: "ㅂㅅ" };
const clusterOf = (a, b) => Object.keys(CL2).find((k) => CL2[k] === a + b);

const letterOf = (it) => KEYS[it.k][it.i];
const vowelOf = (it) => VSEQ[it.vk] || "?";

// One key press into the stream of items: a consonant item (key, step), a
// vowel item (the keys so far) or a bar (space, end).
function press(st, ch) {
  const it = st.items, top = it[it.length - 1];
  if (KEYS[ch]) {
    if (st.last === ch) top.i = (top.i + 1) % KEYS[ch].length;
    else it.push({ k: ch, i: 0, id: st.n++ });
  } else if ("IDE".includes(ch)) {
    if (top && top.vk !== undefined && VPRE.has(top.vk + ch)) top.vk += ch;
    else it.push({ vk: ch, id: st.n++ });
  } else it.push({ bar: ch, id: st.n++ });
  st.last = ch;
}

// The stream read as syllables, from the start every time: a consonant opens
// a syllable, goes under a vowel as its final (two finals if they make a
// cluster), and a final that meets a vowel moves up to start the next block.
function parse(items) {
  const out = [];
  let cur = null;
  const push = () => {
    if (cur) out.push(cur);
    cur = null;
  };
  for (const it of items) {
    if (it.bar) push();
    else if (it.vk !== undefined) {
      if (!cur) cur = { ini: null, vow: it, fin: [] };
      else if (!cur.vow) cur.vow = it;
      else {
        const m = cur.fin.pop();
        push();
        cur = { ini: m || null, vow: it, fin: [] };
      }
    } else {
      const l = letterOf(it);
      if (!cur) cur = { ini: it, vow: null, fin: [] };
      else if (!cur.vow) {
        push();
        cur = { ini: it, vow: null, fin: [] };
      } else if (cur.fin.length === 0 && !"ㄸㅃㅉ".includes(l)) cur.fin = [it];
      else if (cur.fin.length === 1 && clusterOf(letterOf(cur.fin[0]), l)) cur.fin.push(it);
      else {
        push();
        cur = { ini: it, vow: null, fin: [] };
      }
    }
  }
  push();
  return out;
}

function charOf(s) {
  if (!s.vow) return s.ini ? letterOf(s.ini) : "";
  const v = vowelOf(s.vow), vi = MED.indexOf(v);
  if (!s.ini || vi < 0) return (s.ini ? letterOf(s.ini) : "") + v;
  const f = s.fin.length === 2 ? clusterOf(letterOf(s.fin[0]), letterOf(s.fin[1])) : s.fin.length ? letterOf(s.fin[0]) : " ";
  return String.fromCharCode(0xac00 + (INIT.indexOf(letterOf(s.ini)) * 21 + vi) * 28 + FIN.indexOf(f));
}

// A text into the keys that type it.
function keysOf(text) {
  const jk = (l) => {
    for (const k in KEYS) if (KEYS[k].includes(l)) return k.repeat(KEYS[k].indexOf(l) + 1);
    return "";
  };
  let out = "";
  for (const ch of text) {
    if (ch === " ") {
      out += " ";
      continue;
    }
    const c = ch.charCodeAt(0) - 0xac00, L = floor(c / 588), V = floor((c % 588) / 28), T = c % 28;
    out += jk(INIT[L]) + Object.keys(VSEQ).find((k) => VSEQ[k] === MED[V]);
    if (T) out += CL2[FIN[T]] ? jk(CL2[FIN[T]][0]) + jk(CL2[FIN[T]][1]) : jk(FIN[T]);
  }
  return out + ".";
}

const PHRASES = ["하늘 땅 사람", "해 달 별", "나무 까치", "꽃잎 야옹"];

// ---- Letter strokes on a 20 x 20 grid, y down; a stroke is a polyline of
// x, y pairs, and one that starts with -1 is an ellipse cx, cy, rx, ry
// (these are jamo-assembly's, with the double consonants made from two).
const O = -1;
const BASE = {
  ㄱ: [[3, 3, 17, 3, 17, 18]], ㄴ: [[3, 2, 3, 17, 18, 17]], ㄷ: [[17, 3, 3, 3, 3, 17, 18, 17]],
  ㄹ: [[3, 2, 17, 2, 17, 10, 3, 10, 3, 18, 18, 18]], ㅁ: [[3, 3, 17, 3, 17, 17, 3, 17, 3, 3]],
  ㅂ: [[3, 2, 3, 18, 17, 18, 17, 2], [3, 10, 17, 10]], ㅅ: [[10, 2, 2, 18], [10, 2, 18, 18]], ㅇ: [[O, 10, 10, 7.5, 7.5]],
  ㅈ: [[3, 3, 17, 3], [10, 3, 3, 18], [10, 3, 17, 18]], ㅊ: [[10, 0, 10, 4], [3, 5, 17, 5], [10, 5, 3, 19], [10, 5, 17, 19]],
  ㅋ: [[3, 3, 17, 3, 17, 18], [3, 10, 17, 10]], ㅌ: [[17, 2, 3, 2, 3, 18, 18, 18], [3, 10, 17, 10]],
  ㅍ: [[2, 3, 18, 3], [2, 17, 18, 17], [7, 3, 7, 17], [13, 3, 13, 17]], ㅎ: [[10, 0, 10, 3], [3, 5, 17, 5], [O, 10, 13, 5.5, 5]],
};
const DBL = { ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ" };
// Vowel strokes, each tagged with the key that makes it: the bar by I or E,
// the dots by D. The keys so far give the shape so far: D alone is a dot,
// DD two dots, and the shape changes as the next key lands.
const VG = {
  I: [["I", 10, 1, 10, 19]], E: [["E", 1, 10, 19, 10]], D: [["D", 9.2, 10, 10.8, 10]], DD: [["D", 9.2, 7, 10.8, 7], ["D", 9.2, 13, 10.8, 13]],
  ID: [["I", 7, 1, 7, 19], ["D", 7, 10, 17, 10]], IDD: [["I", 7, 1, 7, 19], ["D", 7, 7, 17, 7], ["D", 7, 13, 17, 13]],
  DI: [["I", 13, 1, 13, 19], ["D", 3, 10, 13, 10]], DDI: [["I", 13, 1, 13, 19], ["D", 3, 7, 13, 7], ["D", 3, 13, 13, 13]],
  DE: [["D", 10, 4, 10, 13], ["E", 1, 13, 19, 13]], DDE: [["D", 7, 4, 7, 13], ["D", 13, 4, 13, 13], ["E", 1, 13, 19, 13]],
  ED: [["E", 1, 7, 19, 7], ["D", 10, 7, 10, 16]], EDD: [["E", 1, 7, 19, 7], ["D", 7, 7, 7, 16], ["D", 13, 7, 13, 16]],
  IDI: [["I", 5, 1, 5, 19], ["D", 5, 10, 13, 10], ["I", 15, 0, 15, 20]],
  IDDI: [["I", 5, 1, 5, 19], ["D", 5, 7, 13, 7], ["D", 5, 13, 13, 13], ["I", 15, 0, 15, 20]],
  DII: [["D", 2, 10, 9, 10], ["I", 9, 1, 9, 19], ["I", 16, 0, 16, 20]],
  DDII: [["D", 2, 7, 9, 7], ["D", 2, 13, 9, 13], ["I", 9, 1, 9, 19], ["I", 16, 0, 16, 20]],
};
const HORZ = new Set(["E", "DE", "DDE", "ED", "EDD"]);

// Every stroke is kept as NP points, so one can turn into another by moving
// its points: ㅅ into ㅎ, a bar into ㅏ's bar, a dot into a tick.
const NP = 14;
function expand(q) {
  const v = [];
  for (let i = 0; i < q.length; i += 2) v.push([q[i], q[i + 1]]);
  while (v.length < NP) {
    let bi = 0, bl = -1;
    for (let i = 0; i < v.length - 1; i++) {
      const l = hypot(v[i + 1][0] - v[i][0], v[i + 1][1] - v[i][1]);
      if (l > bl) {
        bl = l;
        bi = i;
      }
    }
    v.splice(bi + 1, 0, [(v[bi][0] + v[bi + 1][0]) / 2, (v[bi][1] + v[bi + 1][1]) / 2]);
  }
  const o = new Float32Array(NP * 2);
  for (let i = 0; i < NP; i++) {
    o[i * 2] = v[i][0];
    o[i * 2 + 1] = v[i][1];
  }
  return o;
}
function ellipse(cx, cy, rx, ry) {
  const o = new Float32Array(NP * 2);
  for (let i = 0; i < NP; i++) {
    const a = ((i + 0.5) / NP) * 2 * PI + PI / 2;
    o[i * 2] = cx + rx * cos(a);
    o[i * 2 + 1] = cy + ry * sin(a);
  }
  return o;
}
function strokesOf(it) {
  if (it.vk !== undefined) {
    let k = it.vk;
    while (k && !VG[k]) k = k.slice(0, -1);
    return (VG[k] || []).map((s) => ({ role: s[0], p: expand(s.slice(1)) }));
  }
  const l = letterOf(it), d = DBL[l], out = [];
  for (const [ox, sx] of d ? [[0, 0.46], [10.8, 0.46]] : [[0, 1]])
    for (const s of BASE[d || l]) {
      if (s[0] === O) out.push({ role: "C", p: ellipse(ox + s[1] * sx, s[2], s[3] * sx, s[4]) });
      else {
        const q = s.slice();
        for (let i = 0; i < q.length; i += 2) q[i] = ox + q[i] * sx;
        out.push({ role: "C", p: expand(q) });
      }
    }
  return out;
}

// A letter changing: strokes of the same kind and order carry over, new ones
// grow from their middle, spare ones shrink away.
function reshape(it, nl) {
  const live = (it.st || []).filter((s) => !s.dying);
  const tag = (l) => {
    const n = {};
    return l.map((s) => s.role + (n[s.role] = (n[s.role] || 0) + 1));
  };
  const ok = tag(live), nk = tag(nl), next = [], used = new Set();
  nl.forEach((s, i) => {
    const j = ok.indexOf(nk[i]);
    if (j >= 0) {
      live[j].t = s.p;
      live[j].role = s.role;
      used.add(j);
      next.push(live[j]);
    } else {
      let cx = 0, cy = 0;
      for (let k = 0; k < NP; k++) {
        cx += s.p[k * 2] / NP;
        cy += s.p[k * 2 + 1] / NP;
      }
      const p = new Float32Array(NP * 2);
      for (let k = 0; k < NP; k++) {
        p[k * 2] = cx;
        p[k * 2 + 1] = cy;
      }
      next.push({ role: s.role, p, t: s.p });
    }
  });
  live.forEach((s, j) => {
    if (!used.has(j)) {
      s.dying = true;
      next.push(s);
    }
  });
  it.st = next;
}

// ---- Where things sit -----------------------------------------------------
const WORK = [3, 5, 40, 48]; // the big block
const SLOTS = {
  V: [[1, 3, 11, 14], [12, 0, 7, 20]], VF: [[1, 1, 11, 10], [12, 0, 7, 12], [3, 13, 14, 7]],
  H: [[3, 1, 14, 10], [0, 10, 20, 9]], HF: [[3, 0, 14, 7], [0, 6, 20, 6], [3, 13, 14, 7]],
};
const KX = 2, KY = 87, KW = 19, KH = 9; // the keypad: 4 rows of 3 keys
const KPOS = { I: [0, 0], D: [0, 1], E: [0, 2], 4: [1, 0], 5: [1, 1], 6: [1, 2], 7: [2, 0], 8: [2, 1], 9: [2, 2], 0: [3, 1], " ": [3, 2] };
const keyRect = (ch) => [KX + KPOS[ch][1] * (KW + 1), KY + KPOS[ch][0] * (KH + 1), KW, KH];
const TAPE = [3, 58]; // the key tape: 6 cells across, 4 down, 6 by 7 LEDs

// 5 x 5 letters for the keys and the tape.
const G5 = {};
"ㄱ#####/....#/....#/....#/....#,ㅋ#####/....#/#####/....#/....#,ㄴ#..../#..../#..../#..../#####,ㄹ#####/....#/#####/#..../#####,ㄷ#####/#..../#..../#..../#####,ㅌ#####/#..../#####/#..../#####,ㅂ#...#/#...#/#####/#...#/#####,ㅍ#####/.#.#./.#.#./.#.#./#####,ㅅ..#../..#../.#.#./.#.#./#...#,ㅎ..#../#####/.###./#...#/.###.,ㅈ#####/..#../.#.#./.#.#./#...#,ㅊ..#../#####/..#../.#.#./#...#,ㅇ.###./#...#/#...#/#...#/.###.,ㅁ#####/#...#/#...#/#...#/#####"
  .split(",")
  .forEach((s) => (G5[s[0]] = s.slice(1).split("/")));

// ---- The show -------------------------------------------------------------
const GAPS = { first: 0.9, key: 0.36, again: 0.22, space: 0.45, afterSpace: 0.5, end: 0.8 };
const HOLD = 2.6, OUT = 0.8;

function build(S, idx) {
  S.phrase = idx;
  const text = PHRASES[idx], keys = keysOf(text);
  S.st = { items: [], last: "", n: 0 };
  S.syl = [];
  S.ev = [];
  S.ei = 0;
  S.tape = [];
  S.lit = {};
  S.t = 0;
  let t = GAPS.first, prev = "";
  for (const ch of keys) {
    if (prev) t += ch === prev ? GAPS.again : ch === "." ? GAPS.end : ch === " " ? GAPS.space : prev === " " ? GAPS.afterSpace : GAPS.key;
    S.ev.push({ ch, t });
    prev = ch;
  }
  S.last = t;
  S.rj = -1;
  S.hold = t + HOLD;
  S.end = S.hold + OUT + 0.3;
  // The line: one slot a syllable down the right edge, a gap at each space.
  const n = [...text].filter((c) => c !== " ").length, sp = [...text].filter((c) => c === " ").length;
  const B = min(15, floor((82 - sp * 4 + 1) / n) - 1);
  S.B = B;
  S.slots = [];
  let y = 3;
  for (const c of text) {
    if (c === " ") y += 4;
    else {
      S.slots.push([W - 3 - B, y, B, B]);
      y += B + 1;
    }
  }
}

export function setup(params) {
  params.s = { phrase: -1, hue: 0, speed: 2, wt: 1, buf: new Float32Array(W * H * 3), col: {} };
}

const scaleRect = (u, box) => [box[0] + (u[0] / 20) * box[2], box[1] + (u[1] / 20) * box[3], (u[2] / 20) * box[2], (u[3] / 20) * box[3]];

function place(it, r, B, working) {
  it.tx = r[0];
  it.ty = r[1];
  it.tw = r[2];
  it.th = r[3];
  it.tB = B;
  it.rate = working ? 13 : 8;
}

// Every item is aimed at its slot for the syllables as they now parse: the
// last syllable in the big block while the phrase is mid-word, the rest in the line.
function layout(S) {
  const items = S.st.items, last = items[items.length - 1];
  const wk = last && !last.bar ? S.syl.length - 1 : -1;
  S.syl.forEach((s, i) => {
    const work = i === wk, box = work ? WORK : S.slots[min(i, S.slots.length - 1)];
    const B = min(box[2], box[3]), vk = s.vow ? s.vow.vk : "", f = s.fin.length > 0;
    const sl = SLOTS[(HORZ.has(vk) ? "H" : "V") + (f ? "F" : "")];
    for (const it of [s.ini, s.vow, ...s.fin]) if (it) it.si = i;
    if (s.ini) place(s.ini, s.vow ? scaleRect(sl[0], box) : scaleRect([2, 2, 16, 16], box), B, work);
    if (s.vow) place(s.vow, scaleRect(sl[1], box), B, work);
    if (f) {
      const r = scaleRect(sl[2], box);
      if (s.fin.length === 1) place(s.fin[0], r, B, work);
      else {
        place(s.fin[0], [r[0], r[1], r[2] * 0.48, r[3]], B, work);
        place(s.fin[1], [r[0] + r[2] * 0.52, r[1], r[2] * 0.48, r[3]], B, work);
      }
    }
    if (!work)
      for (const it of [s.ini, s.vow, ...s.fin])
        if (it && !it.cm) {
          it.cm = true;
          it.fl = 1;
        }
  });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.3, 3);
  S.wt = 0.4 + 0.7 * (cl(k[3], -1, 1) + 1);
  const idx = cl(round(k[2]), 0, PHRASES.length - 1);
  if (idx !== S.phrase) build(S, idx);
  const tau = (d * S.speed) / 2;
  S.t += tau;
  if (S.t > S.end) build(S, idx);
  let changed = false;
  while (S.ei < S.ev.length && S.ev[S.ei].t <= S.t) {
    const ch = S.ev[S.ei++].ch, st = S.st, n0 = st.items.length;
    press(st, ch);
    changed = true;
    const top = st.items[st.items.length - 1];
    if (ch !== "." && ch !== " ") {
      const r = keyRect(ch);
      if (st.items.length > n0) Object.assign(top, { x: r[0] + 6.5, y: r[1] + 1.5, w: 6, h: 6, B: 8, st: [], fl: 0.6 });
      top.fl = 0.9;
      const cur = strokesOf(top);
      reshape(top, cur);
      S.lit[ch] = { t: S.t, i: top.i || 0 };
      S.tape.push({ ch, t: S.t });
    }
  }
  if (changed) {
    S.syl = parse(S.st.items);
    layout(S);
  }
  // When the phrase is typed, the line is read: each syllable lights in turn.
  if (S.ei >= S.ev.length && S.t > S.last + 0.5) {
    const j = floor((S.t - S.last - 0.5) / 0.28);
    if (j !== S.rj) {
      S.rj = j;
      for (const it of S.st.items) if (it.si === j && !it.bar) it.fl = 0.85;
    }
  }
  // Items glide to their slots and their strokes to their shapes.
  for (const it of S.st.items) {
    if (it.bar || it.x === undefined) continue;
    const e = 1 - exp(-tau * (it.rate || 10)), e2 = 1 - exp(-tau * 18);
    it.x += (it.tx - it.x) * e;
    it.y += (it.ty - it.y) * e;
    it.w += (it.tw - it.w) * e;
    it.h += (it.th - it.h) * e;
    it.B += (it.tB - it.B) * e;
    it.fl *= exp(-tau * 4.5);
    for (let j = it.st.length - 1; j >= 0; j--) {
      const s = it.st[j];
      if (s.dying) {
        let cx = 0, cy = 0;
        for (let q = 0; q < NP; q++) {
          cx += s.p[q * 2] / NP;
          cy += s.p[q * 2 + 1] / NP;
        }
        let sp = 0;
        s.t = new Float32Array(NP * 2);
        for (let q = 0; q < NP; q++) {
          s.t[q * 2] = cx;
          s.t[q * 2 + 1] = cy;
          sp = max(sp, abs(s.p[q * 2] - cx), abs(s.p[q * 2 + 1] - cy));
        }
        if (sp < 0.5) {
          it.st.splice(j, 1);
          continue;
        }
      }
      for (let q = 0; q < NP * 2; q++) s.p[q] += (s.t[q] - s.p[q]) * e2;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.phrase < 0) return;
  const buf = S.buf, C = S.col, hb = S.hue;
  buf.fill(0);
  if (!C.C) {
    for (const n of ["C", "I", "D", "E", "K", "W"]) C[n] = [0, 0, 0];
  }
  tint(hb + 0.92, 0.5, 1, C.C);
  tint(hb + 0.6, 0.78, 1, C.I);
  tint(hb + 0.12, 0.85, 1, C.D);
  tint(hb + 0.36, 0.85, 1, C.E);
  tint(hb + 0.62, 0.3, 1, C.K);
  tint(hb, 0.05, 1, C.W);
  const T = S.t, fade = T > S.hold ? max(0, 1 - (T - S.hold) / OUT) : 1;

  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    if (c[0] * a > buf[o]) buf[o] = c[0] * a;
    if (c[1] * a > buf[o + 1]) buf[o + 1] = c[1] * a;
    if (c[2] * a > buf[o + 2]) buf[o + 2] = c[2] * a;
  };
  const rect = (r, c, a) => {
    const x0 = round(r[0]), y0 = round(r[1]), x1 = round(r[0] + r[2]) - 1, y1 = round(r[1] + r[3]) - 1;
    for (let x = x0; x <= x1; x++) {
      put(x, y0, c, a);
      put(x, y1, c, a);
    }
    for (let y = y0 + 1; y < y1; y++) {
      put(x0, y, c, a);
      put(x1, y, c, a);
    }
  };
  const fill = (r, c, a) => {
    for (let y = round(r[1]); y < round(r[1] + r[3]); y++) for (let x = round(r[0]); x < round(r[0] + r[2]); x++) put(x, y, c, a);
  };
  // A stroke segment of width w, round-capped, one LED across at w = 1.
  const seg = (x0, y0, x1, y1, w, c, a) => {
    const r = w / 2 + 0.4;
    const lx = max(0, floor(min(x0, x1) - r)), hx = min(W - 1, ceil(max(x0, x1) + r));
    const ly = max(0, floor(min(y0, y1) - r)), hy = min(H - 1, ceil(max(y0, y1) + r));
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
    for (let y = ly; y <= hy; y++)
      for (let x = lx; x <= hx; x++) {
        const px = x + 0.5 - x0, py = y + 0.5 - y0, u = cl((px * dx + py * dy) / L2, 0, 1), ex = px - u * dx, ey = py - u * dy;
        const f = cl((r - sqrt(ex * ex + ey * ey)) * 1.8, 0, 1);
        if (f > 0) put(x, y, c, f * a);
      }
  };
  const blit = (g, x, y, c, a) => {
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (g[j][i] === "#") put(x + i, y + j, c, a);
  };
  // The vowel keys as pictures: the standing bar, the dot, the flat bar.
  const vicon = (ch, x, y, c, a) => {
    if (ch === "I") for (let j = 0; j < 5; j++) put(x + 2, y + j, c, a);
    else if (ch === "E") for (let i = 0; i < 5; i++) put(x + i, y + 2, c, a);
    else for (let q = 0; q < 4; q++) put(x + 2 + (q & 1), y + 2 + (q >> 1), c, a);
  };
  
  // The line's slots as corner ticks, and the big block's four corners.
  const corners = (r, a) => {
    const x0 = round(r[0]) - 1, y0 = round(r[1]) - 1, x1 = round(r[0] + r[2]), y1 = round(r[1] + r[3]);
    for (let i = 0; i < 3; i++)
      for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
        put(x + sx * i, y, C.K, a);
        put(x, y + sy * i, C.K, a);
      }
  };
  corners(WORK, 0.45);
  for (const r of S.slots) corners(r, 0.3);

  // The letters: the line first, the block over it.
  const items = S.st.items.filter((it) => !it.bar && it.x !== undefined);
  const work = new Set();
  const last = S.st.items[S.st.items.length - 1];
  if (last && !last.bar && S.syl.length) {
    const s = S.syl[S.syl.length - 1];
    for (const it of [s.ini, s.vow, ...s.fin]) if (it) work.add(it);
  }
  for (const pass of [0, 1])
    for (const it of items) {
      if ((pass === 1) !== work.has(it)) continue;
      const wd = cl(it.B * 0.072 * S.wt, 0.9, 5.4);
      for (const s of it.st) {
        const base = C[s.role], a = fade;
        const c = [base[0], base[1], base[2]];
        for (let q = 0; q < 3; q++) c[q] = c[q] + (1 - c[q]) * it.fl * 0.8;
        for (let q = 1; q < NP; q++)
          seg(
            it.x + (s.p[q * 2 - 2] / 20) * it.w, it.y + (s.p[q * 2 - 1] / 20) * it.h,
            it.x + (s.p[q * 2] / 20) * it.w, it.y + (s.p[q * 2 + 1] / 20) * it.h, wd, c, a,
          );
      }
    }

  // The key tape: the keys pressed so far, six to a row, in the colour of the key.
  S.tape.forEach(({ ch, t }, n) => {
    const cx = TAPE[0] + (n % 6) * 6, cy = TAPE[1] + (floor(n / 6) % 4) * 7;
    const a = 0.55 + 0.45 * exp(-max(0, T - t) * 3);
    if ("IDE".includes(ch)) vicon(ch, cx, cy, C[ch], a * fade);
    else blit(G5[KEYS[ch][0]], cx, cy, C.C, a * fade);
  });

  // The keypad; the bottom left key is left blank.
  rect([KX, KY + 3 * (KH + 1), KW, KH], C.K, 0.34);
  for (const ch of Object.keys(KPOS)) {
    const r = keyRect(ch), lit = S.lit[ch] ? exp(-max(0, T - S.lit[ch].t) / 0.22) : 0;
    const role = "IDE".includes(ch) ? ch : "C", col = C[role];
    if (lit > 0.02) fill(r, col, 0.5 * lit);
    rect(r, C.K, 0.34 + 0.5 * lit);
    const gx = r[0] + 3, gy = r[1] + 2;
    if ("IDE".includes(ch)) {
      const cx = r[0] + 7, cy = r[1] + 2;
      vicon(ch, cx, cy, col, 0.75 + 0.25 * lit);
    } else if (ch === " ") {
      for (let i = 0; i < 9; i++) put(r[0] + 5 + i, r[1] + 6, C.K, 0.6 + 0.4 * lit);
      for (const x of [r[0] + 5, r[0] + 13]) {
        put(x, r[1] + 4, C.K, 0.6 + 0.4 * lit);
        put(x, r[1] + 5, C.K, 0.6 + 0.4 * lit);
      }
    } else {
      const li = S.lit[ch] ? S.lit[ch].i : -1, hi = lit > 0.02 ? lit : 0;
      for (let g = 0; g < 2; g++) {
        const on = hi > 0 && (li === g || li === 2) ? 1 : 0;
        blit(G5[KEYS[ch][g]], gx + g * 7, gy, on ? C.W : C.C, on ? 0.7 + 0.3 * hi : 0.5);
      }
    }
  }

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
