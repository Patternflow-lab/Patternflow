// ===== Patternflow pattern =====
// Title:   Spiral Word Cloud
// Family:  type
// Idea:    Words sized by how often they occur are laid biggest first on the tall panel, each probe walking a stretched spiral out from the middle and flickering red wherever its letters would touch a letter already there, until the first clear place, where the word lands and the next one starts again from the middle.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Wordle (Jonathan Feinberg, 2008, year from memory), which lays words biggest first along a spiral from the middle until their letters touch no letter placed, after the tag cloud (Flickr, 2004, from memory); words counted by this code from three public-domain texts typed from memory, Lincoln's Gettysburg Address (1863), Blake's The Tyger (1794) and Carroll's Jabberwocky (1871), years from memory; the 3 by 5 capitals of Saccades (pattern round 106) and the digits drawn for Kasiski Examination (pattern round 108), copied from edit-distance.js; pattern round 113
// Round:   113
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Turn=0.2..1, Spiral=3..14
//
// Knob 1: Hue. Turns the four word colours round the wheel together. A word counted once is lavender, twice azure, three times coral and four or more gold at 0; at 0.5 they are yellow-green, salmon, cyan and blue. The probe's red and the steel counters stay as they are.
// Knob 2: Speed. How fast the probe walks: at 2 it tests 1100 places a second at the start of a word and speeds up by 1 + p / 250 once it has tested p, so the long walks of the late words go by in under a second. The Gettysburg cloud is built in 10.1 s, held 3.2 s and thinned out and cleared in the order it was laid in 2.7 s, and the three texts take 53.3 s a round. 0.2 is about ten times slower and 3 is 1.5 times faster.
// Knob 3: Turn. The share of words that start out turned a quarter clockwise, to read downward, 0.2 to 1, opening at 0.2. A word that finds no place turns the other way and walks again before it is dropped, and a word too long for the sheet is turned from the start, so on this narrow sheet more words read downward than the knob says: at 0.2 the Gettysburg cloud has 11 of 14 turned, The Tyger 8 of 18 and Jabberwocky 9 of 28, and at 1 they have 10 of 12, 21 of 21 and 26 of 27.
// Knob 4: Spiral. How far the spiral gains each turn, 3 to 14 LEDs of radius across and 1.9 times that down the sheet, opening at the tightest, 3. The probe steps 1.5 LEDs along it, so a tight spiral tests more places and finds the small gaps: the Gettysburg cloud takes 21,172 probes and lays 14 words at 3, and 4,406 probes and 12 words at 14, where the spiral skips over the gaps between its turns.

const W = 64, H = 128;
const { floor, min, max, abs, exp, sqrt, round, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, f) => a + (b - a) * f;
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// The face: capitals 3 wide and 5 tall from saccades.js and the ten digits, both copied from edit-distance.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// Three public-domain texts, typed from memory. Their words are counted when the pattern starts, the small function words dropped.
const TEXTS = [
  `Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.
Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.
But, in a larger sense, we can not dedicate, we can not consecrate, we can not hallow, this ground. The brave men, living and dead, who struggled here, have consecrated it, far above our poor power to add or detract. The world will little note, nor long remember what we say here, but it can never forget what they did here. It is for us the living, rather, to be dedicated here to the unfinished work which they who fought here have thus far so nobly advanced. It is rather for us to be here dedicated to the great task remaining before us, that from these honored dead we take increased devotion to that cause for which they gave the last full measure of devotion, that we here highly resolve that these dead shall not have died in vain, that this nation, under God, shall have a new birth of freedom, and that government of the people, by the people, for the people, shall not perish from the earth.`,
  `Tyger Tyger, burning bright,
In the forests of the night;
What immortal hand or eye,
Could frame thy fearful symmetry?
In what distant deeps or skies
Burnt the fire of thine eyes?
On what wings dare he aspire?
What the hand dare seize the fire?
And what shoulder, and what art,
Could twist the sinews of thy heart?
And when thy heart began to beat,
What dread hand? And what dread feet?
What the hammer? What the chain?
In what furnace was thy brain?
What the anvil? What dread grasp
Dare its deadly terrors clasp?
When the stars threw down their spears
And watered heaven with their tears,
Did he smile his work to see?
Did he who made the Lamb make thee?
Tyger Tyger, burning bright,
In the forests of the night,
What immortal hand or eye
Dare frame thy fearful symmetry?`,
  `'Twas brillig, and the slithy toves
Did gyre and gimble in the wabe:
All mimsy were the borogoves,
And the mome raths outgrabe.
Beware the Jabberwock, my son!
The jaws that bite, the claws that catch!
Beware the Jubjub bird, and shun
The frumious Bandersnatch!
He took his vorpal sword in hand;
Long time the manxome foe he sought,
So rested he by the Tumtum tree,
And stood awhile in thought.
And, as in uffish thought he stood,
The Jabberwock, with eyes of flame,
Came whiffling through the tulgey wood,
And burbled as it came!
One, two! One, two! And through and through
The vorpal blade went snicker-snack!
He left it dead, and with its head
He went galumphing back.
And hast thou slain the Jabberwock?
Come to my arms, my beamish boy!
O frabjous day! Callooh! Callay!
He chortled in his joy.
'Twas brillig, and the slithy toves
Did gyre and gimble in the wabe:
All mimsy were the borogoves,
And the mome raths outgrabe.`,
];
const STOP = new Set(
  "A AN AND ARE AS AT BE BUT BY CAN FOR FROM HAVE HE HERE HIS IN IS IT ITS MY NOR NOT OF ON OR SHALL SO THAT THE THEY THIS THOSE THOU THROUGH TO US WE WHAT WHICH WHO WILL WITH OUR THESE THEIR WERE WAS HAD THAN THEN THUS THERE THY THINE DID WHEN COULD DOWN THEE ALL".split(" "),
);
// How many words of each text go into the cloud.
const KEEP = 60;

// The sheet: the cloud may use rows TOP to BOT; the counters sit below it. The spiral is centred on the sheet and stretched to its shape.
const TOP = 1, BOT = 121, CX = 32, CY = 61, SY = (BOT - TOP) / W;
const STEP = 1.5, RMAX = 47, GAP = 2;
const HOLD = 3.2, FADE = 0.5, CLEAR = 0.5;

// Counts the words of a text, drops the stop words and any word under three letters, and keeps the commonest, the longer first among equals.
function countWords(text) {
  const m = new Map();
  let order = 0;
  for (const w of text.toUpperCase().replace(/[^A-Z]+/g, " ").split(" ")) {
    if (w.length < 3 || STOP.has(w)) continue;
    const e = m.get(w);
    if (e) e.c++;
    else m.set(w, { w, c: 1, o: order++ });
  }
  return [...m.values()].sort((a, b) => b.c - a.c || b.w.length - a.w.length || a.o - b.o).slice(0, KEEP);
}

// The letters of a word as LED offsets, each pixel of the face a block of s by s; turned a quarter clockwise, the word reads downward.
function bitmap(word, s, vert) {
  const n = word.length, len = (4 * n - 1) * s, px = [];
  for (let L = 0; L < n; L++) {
    const G = GLYPH[word[L]];
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 3; i++)
        if (G[j * 3 + i]) {
          const cx = vert ? (4 - j) * s : (4 * L + i) * s, cy = vert ? (4 * L + i) * s : j * s;
          for (let v = 0; v < s; v++) for (let u = 0; u < s; u++) px.push(cx + u, cy + v);
        }
  }
  return { w: vert ? 5 * s : len, h: vert ? len : 5 * s, px: Int16Array.from(px), s };
}

export function setup(params) {
  params.s = {
    rgb: new Float32Array(W * H * 3), occ: new Uint8Array(W * H), inkMask: new Uint8Array(W * H),
    lists: TEXTS.map(countWords), text: 0, hue: 0, speed: 2, turn: 0.2, pitch: 3, tq: -1, pq: -1,
    words: [], placed: [], phase: 0, clock: 0, pt: 0, settle: 0, acc: 0,
    wi: 0, th: 0, bm: null, turned: false, lx: -99, ly: -99, wprobes: 0, probes: 0, steps: 0, ink: 0, skipped: 0, miss: 0, drop: [],
    gx: new Int16Array(1024), gok: new Uint8Array(512), gn: 0, trail: [], stat: null, pend: false, fast: false,
  };
}

// Starts the cloud of the current text from an empty sheet, with the knobs as they stand.
function begin(S) {
  S.tq = round(S.turn * 20) / 20;
  S.pq = round(S.pitch * 2) / 2;
  S.occ.fill(0);
  S.inkMask.fill(0);
  S.placed = [];
  S.trail = [];
  S.gn = 0;
  S.words = S.lists[S.text].map((e, i) => {
    // A word is drawn as many times the size of a word seen once as it was seen, up to four.
    let s = cl(e.c - 1, 1, 4);
    // The size is held by the sheet: a word that is too long even turned comes down a step.
    const n = e.w.length;
    while (s > 1 && (4 * n - 1) * s > BOT - TOP - 2) s--;
    const wide = (4 * n - 1) * s > W - 2;
    const vert = wide || (0.1 + i * 0.6180339887) % 1 < S.tq;
    return { str: e.w, c: e.c, s, vert, i };
  });
  S.phase = 0;
  S.pt = 0;
  S.wi = -1;
  S.probes = S.steps = S.ink = S.skipped = S.miss = 0;
  S.drop = [];
  S.settle = 0.3;
  S.bm = null;
}

// The next word's bitmap and the spiral back at the middle.
function nextWord(S) {
  S.wi++;
  S.bm = null;
  // The sheet is full when the words run out or three in a row find no place.
  if (S.wi >= S.words.length || S.miss >= 3) {
    S.phase = 1;
    S.pt = 0;
    S.stat = { words: S.placed.length, probes: S.probes, steps: S.steps, ink: S.ink, skipped: S.skipped };
    return;
  }
  const w = S.words[S.wi];
  S.bm = bitmap(w.str, w.s, w.vert);
  S.th = 0;
  S.lx = S.ly = -99;
  S.wprobes = 0;
  S.turned = false;
  S.gn = 0;
  S.trail = [];
}

function fits(S, bm, x0, y0) {
  const px = bm.px, occ = S.occ;
  for (let k = 0; k < px.length; k += 2) if (occ[(y0 + px[k + 1]) * W + x0 + px[k]]) return false;
  return true;
}

// The probe walks the spiral until its letters touch no letter already there, or the spiral leaves the sheet.
function walk(S, budget) {
  const bm = S.bm, P = S.pq, dr = P / (2 * PI);
  let tested = 0;
  S.gn = 0;
  while (tested < budget) {
    const r = dr * S.th, c = cos(S.th), sn = sin(S.th);
    const px = CX + r * c, py = CY + SY * r * sn;
    // The arc length per radian, so that every step is about STEP LEDs along the spiral.
    const vx = dr * c - r * sn, vy = SY * (dr * sn + r * c), sp = sqrt(vx * vx + vy * vy);
    S.th += min(0.6, STEP / max(0.05, sp));
    const x0 = round(px - bm.w / 2), y0 = round(py - bm.h / 2);
    if (x0 === S.lx && y0 === S.ly) continue;
    S.lx = x0;
    S.ly = y0;
    S.steps++;
    // Every sixth step leaves a dot on the spiral.
    if (S.steps % 6 === 0 && px >= 0 && px < W && py >= 0 && py < H) {
      S.trail.push(px, py);
      if (S.trail.length > 600) S.trail.splice(0, 2);
    }
    if (r > RMAX) return -1;
    if (x0 < 0 || y0 < TOP || x0 + bm.w > W || y0 + bm.h > BOT) continue;
    tested++;
    S.probes++;
    S.wprobes++;
    const ok = fits(S, bm, x0, y0);
    S.gx[2 * S.gn] = x0;
    S.gx[2 * S.gn + 1] = y0;
    S.gok[S.gn++] = ok ? 1 : 0;
    if (ok) return 1;
  }
  return 0;
}

function land(S) {
  const w = S.words[S.wi], bm = S.bm, x0 = S.lx, y0 = S.ly;
  const px = bm.px;
  for (let k = 0; k < px.length; k += 2) {
    const x = x0 + px[k], y = y0 + px[k + 1];
    if (!S.inkMask[y * W + x]) (S.inkMask[y * W + x] = 1), S.ink++;
    for (let v = -GAP; v <= GAP; v++)
      for (let u = -GAP; u <= GAP; u++) {
        const xx = x + u, yy = y + v;
        if (xx >= 0 && xx < W && yy >= 0 && yy < H) S.occ[yy * W + xx] = 1;
      }
  }
  S.placed.push({ w, bm, x0, y0, t0: S.clock, probes: S.wprobes });
  S.miss = 0;
  S.settle = 0.1 + 0.06 * w.s;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.2, 3], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.turn = cl(kv[2], 0.2, 1);
  S.pitch = cl(kv[3], 3, 14);
  const g = (d * S.speed) / 2;
  S.clock += d;
  if (S.tq < 0) begin(S);

  // A turn of the knobs that changes the layout thins the cloud quickly and starts it over.
  if ((round(S.turn * 20) / 20 !== S.tq || round(S.pitch * 2) / 2 !== S.pq) && !S.pend) {
    S.pend = true;
    if (S.phase < 2) (S.phase = 2), (S.pt = 0), (S.fast = true);
  }

  if (S.phase === 0) {
    if (S.settle > 0) S.settle -= g;
    if (S.settle <= 0 && !S.bm && S.wi < S.words.length) nextWord(S);
    if (S.phase === 0 && S.bm && S.settle <= 0) {
      // The probe hurries outward the longer it walks.
      S.acc += d * 1100 * (S.speed / 2) * (1 + S.wprobes / 250);
      const n = min(400, floor(S.acc));
      S.acc -= n;
      const res = n > 0 ? walk(S, n) : 0;
      if (res === 1) land(S), (S.bm = null);
      else if (res === -1) {
        // No place on the sheet: the word is turned a quarter and walks again, and if that fails too it is dropped.
        const w = S.words[S.wi];
        if (!S.turned) {
          S.turned = true;
          S.bm = bitmap(w.str, w.s, !w.vert);
          (S.th = 0), (S.lx = S.ly = -99);
        } else (S.skipped++, S.miss++, S.drop.push(w.str + w.s), (S.bm = null), (S.settle = 0.02));
      }
    }
  } else if (S.phase === 1) {
    S.pt += g;
    if (S.pt >= HOLD) (S.phase = 2), (S.pt = 0), (S.fast = false);
  } else if (S.phase === 2) {
    S.pt += g * (S.fast ? 4 : 1);
    const gap = min(0.12, 3 / max(1, S.placed.length));
    if (S.pt >= S.placed.length * gap + FADE + CLEAR) {
      if (!S.pend) S.text = (S.text + 1) % S.lists.length;
      S.pend = false;
      begin(S);
    }
  }
}

function put(rgb, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = (y * W + x) * 3, q = a > 1 ? 1 : a;
  rgb[p] += (c[0] - rgb[p]) * q;
  rgb[p + 1] += (c[1] - rgb[p + 1]) * q;
  rgb[p + 2] += (c[2] - rgb[p + 2]) * q;
}

function glyph(rgb, ch, x, y, c, a) {
  const G = GLYPH[ch];
  if (!G) return;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (G[j * 3 + i]) put(rgb, x + i, y + j, c, a);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.rgb) return;
  const rgb = S.rgb, col = [0, 0, 0], white = [1, 1, 1];
  rgb.fill(0);
  const gap = min(0.12, 3 / max(1, S.placed.length));
  const tone = [[0.7, 0.3], [0.5, 0.5], [0.98, 0.5], [0.12, 0.55]];

  // The words that have landed, each in the colour of its size; a landing is white and settles.
  S.placed.forEach((p, n) => {
    const t = tone[min(3, p.w.c - 1)];
    hsv(t[0] + S.hue + ((p.w.i * 0.37) % 0.06) - 0.03, t[1], 1, col);
    let a = 0.92;
    if (S.phase === 2) a *= 1 - sm((S.pt - n * gap) / FADE);
    let flash = exp(-(S.clock - p.t0) * 5) * 0.85;
    // In the hold a pulse runs through the words in the order they were laid.
    if (S.phase === 1) flash = max(flash, exp(-abs(S.pt - n * 0.12 - 0.15) * 7) * 0.4);
    for (let e = 0; e < 3; e++) col[e] = mix(col[e], 1, flash);
    for (let k = 0; k < p.bm.px.length; k += 2) put(rgb, p.x0 + p.bm.px[k], p.y0 + p.bm.px[k + 1], col, a);
  });

  // The probe: a faint trail along the spiral, and the word's bitmap at five of the places it tested this frame, red where its letters would touch.
  if (S.phase === 0 && S.bm && S.gn > 0) {
    const tr = S.trail, nt = tr.length / 2, px = S.bm.px;
    for (let k = 0; k < nt; k++) put(rgb, round(tr[2 * k]), round(tr[2 * k + 1]), white, 0.1 + 0.5 * (k / nt) ** 2);
    for (let q = 1; q <= 5; q++) {
      const n = floor((q * S.gn) / 5) - 1, x0 = S.gx[2 * n], y0 = S.gx[2 * n + 1];
      for (let k = 0; k < px.length; k += 2) {
        const x = x0 + px[k], y = y0 + px[k + 1];
        if (S.occ[y * W + x]) put(rgb, x, y, [1, 0.12, 0.1], 0.55);
        else put(rgb, x, y, [0.75, 0.9, 1], 0.38);
      }
    }
  }

  // The counters: words laid and positions tested.
  const cc = [0.5, 0.55, 0.7];
  const a = String(S.placed.length), b = String(S.probes);
  for (let i = 0; i < a.length; i++) glyph(rgb, a[i], 1 + i * 4, 123, cc, 0.85);
  for (let i = 0; i < b.length; i++) glyph(rgb, b[i], 64 - b.length * 4 + i * 4, 123, cc, 0.85);

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
