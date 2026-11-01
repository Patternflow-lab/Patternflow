// ===== Patternflow pattern =====
// Title:   Cent Mille Milliards
// Family:  type
// Idea:    Fourteen paper strips stand down the tall panel, one line of a sonnet on each, cut from a book of ten sonnets that share their rhymes and their grammar line by line, and the strips turn over one at a time like cut pages, each line folding towards the spine and foreshortening as it lifts to show the same line of another sonnet beneath, so the poem keeps rewriting itself line by line while staying a sonnet, the colour of each strip telling which of the ten it came from, and the Poem knob dials any of the 10^14 by its fourteen digits.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: after Cent mille milliards de poemes (Raymond Queneau, 1961), ten sonnets cut into fourteen strips, 10^14 poems; the ten English sonnets and the 3 by 5 capitals were written and drawn for this pattern, pattern round 83
// Round:   83
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Poem=0..1, Flip=0..1
//
// Knob 1: Hue. Turns the ten sonnets' colours round the wheel together, a tenth of a turn apart. At 0 the first sonnet is azure, the second blue, the third violet, then magenta, rose, coral, yellow, lime and green to sea green for the tenth. A line just uncovered flashes whiter and settles in about a second.
// Knob 2: Speed. How fast the strips turn: a page turn takes 0.7 s and a new turn starts every second at the opening 2, ten times slower at 0.2, and 1.5 times faster at 3.
// Knob 3: Poem. Picks one of the 10^14 poems: the knob times 10^14 - 1, written out in fourteen digits, the top line's digit first, each digit the sonnet that line comes from. At 0 the first sonnet stands whole; turning the knob runs the digits like an odometer, the bottom strips riffling through their pages fastest and the top line changing only every tenth of the knob. The strips the reader has turned stay turned by as many pages on top of the dialled poem.
// Knob 4: Flip. How many strips turn at a time, 1 at the opening up to all 14 at 1. More than one turn as a block, each strip a little after the one above, so at 1 the whole poem turns over in a wave from the top and the ten sonnets come round in turn.

// Raymond Queneau's book of 1961 holds ten sonnets, each line on a strip
// of its own, cut so that any line can be turned without the others. All
// ten use the same rhymes at each position and the same grammar, so any
// choice of the fourteen reads as a sonnet: 10^14 poems. His sonnets are
// still under copyright, so the ten here are new: short English lines
// rhymed ABAB CDCD EFEF GG, each position holding one part of speech, a
// subject in line 1 and a predicate in line 2, a phrase of place in line 5
// and a clause in line 6, and so on, so any line fits any neighbour.
// Every line is at most 16 characters, 59 LEDs wide at most in the 3 by 5
// capitals below with one LED between letters.
//
// A strip turns like a page about the spine at the left edge. The page
// tilts up through a quarter turn and is drawn in perspective: a point u
// along it lands at x = u cos(a) D / (D - u sin(a)), the free edge coming
// towards the eye and growing taller as it narrows, until it stands on
// edge and the line under it is all there is. Each LED takes the average
// of the page's ink over the stretch of page it covers, so the letters
// squeeze smoothly. A turn back plays the same tilt the other way: the
// earlier page comes down over the line from the spine. The lifted page
// casts a shadow on the line it uncovers.

const W = 64, H = 128;
const { floor, min, max, round, cos, sin, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Each strip is SH rows, PR of paper and one cut; text starts TX across and
// TY down the paper. D is the eye's distance in LEDs.
const SH = 9, TOP = 1, PR = 8, PW = 64, TX = 2, TY = 2, D = 200;
const HUE0 = 0.55, STEP = 0.1;
// Scaled seconds: one page turn, the gap between turns, the stagger in a block.
const TURN = 0.7, GAP = 1.0, STAGGER = 0.09;

// 3 by 5 capitals. Punctuation is narrow and the comma drops a row.
const FONT = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"], D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"], J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"], N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."], P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", "##.", ".##"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"], V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"],
  ".": [".", ".", ".", ".", "#"], ",": [".", ".", ".", ".", "#", "#"],
  "'": ["#", "#", ".", ".", "."], "-": ["..", "..", "##", "..", ".."], " ": ["."],
};

// LINES[position][sonnet]. Rhymes: -ight -ay -ight -ay, -ow -ain -ow -ain,
// -ire -ound -ire -ound, -old -old.
const LINES = [
  ["A LAMP AT NIGHT", "A SAIL IN SIGHT", "A FROST TONIGHT", "THE CITY LIGHT", "A BEE IN FLIGHT",
    "A DIAL SET RIGHT", "A HAWK AT HEIGHT", "THE PAGE I WRITE", "A MOON SO WHITE", "A PAPER KITE"],
  ["KEEPS DARK AWAY.", "LIES ON THE BAY.", "LEAVES ALL GREY.", "FADES BY DAY.", "HUMS IN THE HAY.",
    "MEASURES DECAY.", "HANGS OVER PREY.", "GOES ASTRAY.", "LIGHTS THE WAY.", "LONGS TO STRAY."],
  ["A MOTH ALIGHT", "THE TIDE'S MIGHT", "THE COLD'S BITE", "A BAR SHUT TIGHT", "A ROSE'S BLIGHT",
    "THE CHIME'S RITE", "A MOUSE'S FRIGHT", "A WORD TOO TRITE", "EACH SATELLITE", "THE WIND'S SPITE"],
  ["WILL NOT OBEY.", "TURNS TO SPRAY.", "STOPS A SLEIGH.", "ASKS US TO PAY.", "BLACKENS MAY.",
    "BIDS US TO PRAY.", "FLEES THE FRAY.", "FEELS LIKE CLAY.", "DRIFTS IN ARRAY.", "HAS ITS SAY."],
  ["IN AMBER GLOW", "IN THE UNDERTOW", "BENEATH THE SNOW", "AS CROWDS FLOW", "WHERE ROSES GROW",
    "TOO FAST OR SLOW", "FROM HIGH TO LOW", "IN ROW ON ROW", "ACROSS THE FLOE", "AS BREEZES BLOW"],
  ["FLAMES REIGN.", "THE NETS REMAIN.", "WE WAIT IN VAIN.", "I MISS MY TRAIN.", "PETALS STAIN.",
    "HANDS COMPLAIN.", "VOLES ARE SLAIN.", "LINES EXPLAIN.", "SEAS RISE AGAIN.", "STRINGS STRAIN."],
  ["IN STILL TABLEAU", "WHERE SHIPS GO", "AT TEN BELOW", "TOE TO TOE", "AS GARDENERS SOW",
    "AS LONG AGO", "A STONE'S THROW", "AS WRITERS KNOW", "IN OVERFLOW", "TO AND FRO"],
  ["I TAP THE PANE.", "I SAIL THE MAIN.", "SKIES GO PLAIN.", "STREETS DRAIN.", "BEES DRINK RAIN.",
    "TIME IS A CHAIN.", "WE FEEL NO PAIN.", "INK IS A VEIN.", "I WATCH IT WANE.", "WE RUN THE LANE."],
  ["I TEND THE FIRE", "WAVES CONSPIRE", "ICE COATS WIRE", "I HEAR A CHOIR", "I CLIP THE BRIAR",
    "THE HOURS EXPIRE", "IT CLIMBS HIGHER", "MY PENS RETIRE", "I SEE THE SPIRE", "GUSTS INSPIRE"],
  ["WITHOUT A SOUND,", "OUTWARD BOUND,", "STILL, PROFOUND,", "UNDERGROUND,", "ROUND AND ROUND,",
    "TIGHTLY WOUND,", "ABOVE THE MOUND,", "LOST AND FOUND,", "STAR-CROWNED,", "ON THE REBOUND,"],
  ["I FEED DESIRE", "THE SAILS ASPIRE", "WE LIGHT A PYRE", "ALL'S FOR HIRE", "THE PEONIES TIRE",
    "CHIMES ENQUIRE", "WE ALL ADMIRE", "I CUT MY SATIRE", "IT GOES SAPPHIRE", "IT SINGS, A LYRE"],
  ["ON WALLS AROUND.", "AS IF DROWNED.", "ON STONY GROUND.", "FOR A POUND.", "TO ASTOUND.",
    "UNTIL UNWOUND.", "LIKE A HOUND.", "TO BE RENOWNED.", "IN HALOS GOWNED.", "TILL DOWNED."],
  ["NIGHT GROWS OLD,", "ROPE IS ROLLED,", "THE AIR IS COLD,", "THE LOT IS SOLD,", "HIVES DRIP GOLD,",
    "GEARS TAKE HOLD,", "WINGS UNFOLD,", "MY HAND IS BOLD,", "CLOUDS STROLLED,", "WE ARE CONSOLED,"],
  ["FOLD ON FOLD.", "AS GULLS SCOLD.", "AS FORETOLD.", "WELL PATROLLED.", "IN MARIGOLD.",
    "UNCONTROLLED.", "TO BEHOLD.", "IN INK EXTOLLED.", "IN SILVER MOULD.", "WIND-CAJOLED."],
];
const NS = LINES.length, NV = 10;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Every line set once on its own page: 1 where the ink is.
function typeset() {
  const pages = [];
  for (let p = 0; p < NS; p++) {
    const row = [];
    for (let s = 0; s < NV; s++) {
      const ink = new Uint8Array(PW * PR);
      let x = TX;
      for (const ch of LINES[p][s]) {
        const g = FONT[ch] || FONT[" "];
        for (let r = 0; r < g.length; r++)
          for (let c = 0; c < g[r].length; c++) if (g[r][c] === "#" && x + c < PW) ink[(TY + r) * PW + x + c] = 1;
        x += g[0].length + 1;
      }
      row.push(ink);
    }
    pages.push(row);
  }
  return pages;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, poem: -1, flip: 0.06, clock: 0, due: 0.15,
    digit: new Array(NS).fill(0), turned: new Array(NS).fill(0),
    strips: Array.from({ length: NS }, () => ({ shown: 0, from: 0, to: 0, fwd: true, s: 0, dur: TURN, on: false, riffle: false, wait: 0, fresh: 0 })),
    pages: typeset(), first: true,
    r: new Float32Array(W * H), g: new Float32Array(W * H), b: new Float32Array(W * H),
    ink: [], paper: [], c: [0, 0, 0],
  };
  for (let s = 0; s < NV; s++) {
    params.s.ink.push([0, 0, 0]);
    params.s.paper.push([0, 0, 0]);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.flip = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const poem = cl(k[2] || 0, 0, 1);
  if (poem !== S.poem) {
    S.poem = poem;
    // The knob's poem, fourteen digits, the top line's first.
    let n = round(poem * (1e14 - 1));
    for (let i = NS - 1; i >= 0; i--) {
      S.digit[i] = n % 10;
      n = floor(n / 10);
    }
  }
  const sd = d * (S.speed / 2);
  const m = 1 + floor(S.flip * 13.999);
  S.clock += sd;
  if (S.clock >= S.due) {
    // A block of m strips turns one page on, each a little after the one above.
    const start = floor(Math.random() * (NS - m + 1));
    for (let j = 0; j < m; j++) {
      S.turned[start + j] = (S.turned[start + j] + 1) % NV;
      S.strips[start + j].wait = j * STAGGER;
    }
    S.due = S.clock + GAP + 0.12 * (m - 1);
  }
  for (let i = 0; i < NS; i++) {
    const st = S.strips[i], target = (S.digit[i] + S.turned[i]) % NV;
    if (S.first) st.shown = target;
    st.wait -= sd;
    st.fresh *= exp(-1.6 * sd);
    if (st.on) {
      st.s += sd / st.dur;
      if (st.s >= 1) {
        st.shown = st.to;
        st.on = false;
        st.fresh = 1;
      }
    }
    if (!st.on && st.wait <= 0 && st.shown !== target) {
      // The short way round, a page at a time, faster the further it goes.
      const ahead = (target - st.shown + NV) % NV, steps = min(ahead, NV - ahead);
      st.fwd = ahead <= NV - ahead;
      st.from = st.shown;
      st.to = (st.shown + (st.fwd ? 1 : NV - 1)) % NV;
      st.riffle = steps > 1;
      st.dur = st.riffle ? max(0.12, TURN / (1 + 0.8 * (steps - 1))) : TURN;
      st.s = 0;
      st.on = true;
    }
  }
  S.first = false;
}

// A flat page: paper in the sonnet's colour, ink lighter, the gutter by the
// spine a little darker, and the shadow of a page lifted at angle a whose
// free edge stands at xe. A line just uncovered is whiter for a moment.
function flat(S, i, s, sn, xe) {
  const y0 = TOP + SH * i, ink = S.pages[i][s], pc = S.paper[s], fr = S.strips[i].fresh;
  const ic = S.ink[s].map((v) => v + (255 - v) * 0.7 * fr);
  for (let v = 0; v < PR; v++) {
    const y = y0 + v;
    for (let x = 0; x < W; x++) {
      const a = ink[v * PW + x], j = y * W + x;
      let f = x < 5 ? 0.55 + 0.09 * x : 1;
      if (sn > 0 && x >= xe) f *= 1 - 0.62 * sn * exp(-(x - xe) / 5);
      S.r[j] = (pc[0] + a * (ic[0] - pc[0])) * f;
      S.g[j] = (pc[1] + a * (ic[1] - pc[1])) * f;
      S.b[j] = (pc[2] + a * (ic[2] - pc[2])) * f;
    }
  }
}

// A page tilted up by angle a about the spine, in perspective.
function lifted(S, i, s, a) {
  const c = cos(a), sn = sin(a), yc = TOP + SH * i + PR / 2, ink = S.pages[i][s], pc = S.paper[s];
  const lift = 1 + 1.6 * sn, shade = 0.72 + 0.28 * c + 0.3 * sin(2 * a), ic = S.ink[s];
  const at = (x) => (x * D) / (D * c + x * sn + 1e-9);
  const xe = (PW * c * D) / (D - PW * sn);
  for (let x = 0; x <= min(W - 1, floor(xe)); x++) {
    const ua = at(x), ubRaw = at(x + 1), ub = min(PW, ubRaw);
    if (ua >= PW) break;
    const ax = (ub - ua) / (ubRaw - ua), k = D / (D - 0.5 * (ua + ub) * sn);
    const edge = ubRaw >= PW ? 0.22 : 0;
    const ya = floor(yc - (PR / 2) * k), yb = floor(yc + (PR / 2) * k);
    for (let y = max(0, ya); y <= min(H - 1, yb); y++) {
      const va0 = (y - yc) / k + PR / 2, vb0 = (y + 1 - yc) / k + PR / 2;
      const va = max(0, va0), vb = min(PR, vb0);
      if (vb <= va) continue;
      const alpha = ax * ((vb - va) / (vb0 - va0));
      // The ink averaged over the patch of page this LED sees.
      let sum = 0;
      for (let v = floor(va); v < vb; v++) {
        const wv = min(vb, v + 1) - max(va, v);
        for (let u = floor(ua); u < ub; u++) sum += wv * (min(ub, u + 1) - max(ua, u)) * ink[v * PW + u];
      }
      const q = sum / ((ub - ua) * (vb - va)), j = y * W + x;
      const r = ((pc[0] * lift + q * (ic[0] - pc[0] * lift)) * shade + edge * 255) * alpha;
      const g = ((pc[1] * lift + q * (ic[1] - pc[1] * lift)) * shade + edge * 255) * alpha;
      const b = ((pc[2] * lift + q * (ic[2] - pc[2] * lift)) * shade + edge * 255) * alpha;
      S.r[j] = S.r[j] * (1 - alpha) + r;
      S.g[j] = S.g[j] * (1 - alpha) + g;
      S.b[j] = S.b[j] * (1 - alpha) + b;
    }
  }
}

const ease = (t) => t * t * (3 - 2 * t);

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  for (let s = 0; s < NV; s++) {
    const h = S.hue + HUE0 + STEP * s;
    hsv(h, 0.45, 1, S.c);
    for (let j = 0; j < 3; j++) S.ink[s][j] = S.c[j] * 255;
    hsv(h, 0.55, 0.15, S.c);
    for (let j = 0; j < 3; j++) S.paper[s][j] = S.c[j] * 255;
  }
  S.r.fill(0);
  S.g.fill(0);
  S.b.fill(0);
  const angle = (st) => {
    const e = st.riffle ? st.s : ease(cl(st.s, 0, 1));
    return (PI / 2) * (st.fwd ? e : 1 - e);
  };
  // Lines lying flat, and under each turning page the line it uncovers.
  for (let i = 0; i < NS; i++) {
    const st = S.strips[i];
    if (!st.on) flat(S, i, st.shown, 0, W);
    else {
      const a = angle(st), sn = sin(a);
      flat(S, i, st.fwd ? st.to : st.from, sn, (PW * cos(a) * D) / (D - PW * sn));
    }
  }
  // The turning pages last, as they rise over the strips beside them.
  for (let i = 0; i < NS; i++) {
    const st = S.strips[i];
    if (st.on) lifted(S, i, st.fwd ? st.from : st.to, angle(st));
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const j = y * W + x;
      display.setPixel(x, y, min(255, round(S.r[j])), min(255, round(S.g[j])), min(255, round(S.b[j])));
    }
}
