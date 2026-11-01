// ===== Patternflow pattern =====
// Title:   Sixteen Dice
// Family:  type
// Idea:    A tray of sixteen letter dice in four rows of four fills the top half of the panel and a depth-first search pruned by a prefix tree walks it, a gold probe path growing die to die and backing off where no word goes on, and every word it finds along a chain of touching dice is drawn as a bent polyline through their centres in its own colour and typed in small capitals into the list of blanks that fills the lower half, until the board is solved, all its paths shine at once and the dice shake and roll again.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the 4 by 4 letter-dice word game (Allan Turoff, 1972) solved by depth-first search over a prefix tree, the trie (René de la Briandais, 1959; the name from Edward Fredkin, 1960); capitals 5 by 7 (shown 8 by 10) and small capitals 5 rows tall drawn for this pattern; pattern round 84
// Round:   84
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Min=3..6, Probe=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the dice are dark slate blue with ivory capitals, the probe's rims are gold, a die the prefix tree turns away gets a rose rim, and the words come in a band from green through cyan and blue to violet and magenta, each 0.382 of the band on from the one before.
// Knob 2: Speed. At 2 the probe takes 0.05 s to step onto a die and 0.03 s to step back, and each new word holds it 0.35 s, so a board of 20 to 30 words is solved in 15 to 23 s; it shines 3 s and shakes 1.2 s. At 0.2 everything takes ten times as long, at 3 two thirds as long.
// Knob 3: Min. The shortest word that counts, 3 to 6 letters. Only words that long get a blank in the list, a polyline and a pause, and the dice are rolled until the tray holds 20 to 30 of them at 3, 10 to 20 at 4, 3 to 10 at 5 and 1 to 4 at 6. Turning it reflows the list at once and changes the next roll.
// Knob 4: Probe. How much of the search is drawn. At 0 and the opening 0.06 the probe's path, its gold rims, the rose rims of the dice turned away and a warming of each face by how often the probe has stood on it all show; at 1 they are gone, and the dice no word has used yet sink to a third, so the answers light up on a dark tray.

// The game: sixteen dice in a 4 by 4 tray, and a word is read along a
// chain of dice each touching the one before, across, down or on a
// diagonal, no die used twice in one word. So a word can bend at every
// letter, where a word search only reads in straight lines.
//
// The dice here are not the game's own: each face is rolled with the
// weight of how often its letter turns up in English text (E 12.7%, T 9.1,
// A 8.2 down to Z 0.07), and Q is left out because the game's Q face reads
// QU. The tray is rolled again until it holds a fair number of words as
// long as Min asks (board() below).
//
// The search: the 648 words below go into a prefix tree, one node for
// every beginning of a word. From each die in reading order the probe
// steps onto a neighbour only if the letters so far plus the neighbour's
// letter are still the beginning of some word; the neighbours that fail
// that test flash and are skipped, and when a die has no neighbour left
// the probe steps back off it. Three paths in four stop by the third
// letter and nearly all by the fourth, so a board costs 90 to 160 steps
// onto a die. The tray holds
// 12,029,640 paths in all, and 31,656 of them are six dice or shorter,
// which is what a search without the tree would walk for these words. A
// node that ends a word reports it; a word met again along another path
// makes its entry blink.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, abs, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Seconds at Speed 2: a step onto a die, a step back, the hold on a word,
// the shine of a solved board and the shake.
const PUSH = 0.05, POP = 0.03, FIND = 0.35, SHINE = 3, SHAKE = 1.2;
// The list: up to nine lines of small capitals from row 67.
const LIST_Y = 67, LINE = 7, LINES = 9;

const WORDS = (
  "ACE ACT ADD AGE AGO AID AIM AIR ALE ALL AND ANT ANY APE ARC ARE ARM ART ASH ASK ATE AWE BAD BAN BAR " +
  "BAT BED BEE BET BID BIG BIN BIT BOY BUN BUS BUT CAB CAN CAP CAR CAT COD COT COW CRY CUE CUT DAD DAY " +
  "DEN DEW DID DIE DIG DIM DIP DOE DOG DOT DRY DUE DYE EAR EAT EEL EGG ELF ELM END ERA EVE EYE FAN FAR " +
  "FED FEE FEW FIG FIN FIR FIT FLY FOE FOG FOR FUN FUR GAP GAS GEM GET GOT HAD HAM HAS HAT HAY HEN HER " +
  "HID HIM HIP HIS HIT HOE HOP HOT HOW HUB HUE HUG HUM HUT ICE ICY ILL INK INN ION ITS KID KIN KIT LAB " +
  "LAD LAP LAW LAY LED LEG LET LID LIE LIP LIT LOG LOT LOW MAD MAN MAP MAT MAY MEN MET NAP NET NEW NOD " +
  "NOR NOT NOW NUT OAK OAR OAT ODD ODE OIL OLD ONE OPT ORB ORE OUR OUT OWE OWL OWN PAD PAN PAT PAW PAY " +
  "PEA PEN PET PIE PIG PIN PIT POD POT PUN PUT RAG RAN RAT RAW RAY RED RIB RID RIM RIP ROD ROE ROT ROW " +
  "RUN SAD SAT SAW SAY SEA SEE SET SEW SHE SHY SIP SIR SIT SKI SLY SON SOW SOY SPA SPY SUM SUN TAB TAG " +
  "TAN TAP TAR TEA TEN THE TIE TIN TIP TOE TON TOO TOP TOW TOY TRY TUB TUG TWO URN USE VAN VAT VET WAS " +
  "WAY WEB WED WET WHO WHY WIG WIN WIT WON YAM YES YET YEW YOU " +
  "ABLE ACHE ACRE AIDE ALSO ARCH AREA AUNT BEAD BEAN BEAR BEAT BELT BENT BEST BITE BOOT BOTH CAME CANE " +
  "CARE CART CASE CAST CELL CHAT CHIN COAL COAT CODE COIN CONE CORE CORN COST CREW CURE DARE DART DASH " +
  "DATE DEAR DEED DEEP DEER DENT DIAL DICE DIET DINE DIRT DISH DOME DONE DOOR DOSE DOWN DUET DUNE EACH " +
  "EARN EASE EAST EASY EDGE ELSE EVEN EVER FAIR FAST FEAR FEED FEEL FEET FELT FERN FILE FINE FIRE FLAT " +
  "FOOD FOOT FORT FREE GAIN GATE GEAR GOAT GONE GRIN HAIL HAIR HAND HANG HARD HARE HEAD HEAL HEAP HEAR " +
  "HEAT HELD HERD HERE HERO HIDE HINT HOLE HOME HOOD HORN HOSE HOST HUNT IDEA INCH IRON ISLE ITEM KNOT " +
  "LACE LAND LANE LAST LATE LEAD LEAF LEAN LEFT LEND LENS LESS LIFT LIME LINE LION LIST LOAD LOAF LONE " +
  "LOST MADE MAIN MARE MAST MATE MEAL MEAN MEET MELT MENU MILE MIND MINE MINT MOAT MOON MORE MOSS MOST " +
  "MOTH NAIL NAME NEAR NEAT NEED NEST NEWS NICE NINE NODE NONE NOON NOSE NOTE OATH ONCE OPEN PAIR PALE " +
  "PART PAST PATH PEAR PINE POET PORT POSE POST RACE RAIN RARE RATE READ REAL REED REST RICE RICH RIDE " +
  "RING RISE ROAD ROAR ROBE RODE ROLE ROOF ROOM ROOT ROPE ROSE RUST SAFE SAID SAIL SALT SAME SAND SANG " +
  "SAVE SEAL SEAT SEED SEEN SELF SEND SENT SHED SHOE SHOW SIDE SIGN SING SITE SLID SLOT SNOW SOAP SOFT " +
  "SOIL SOLE SOME SOON SORT SOUL SPOT STAR STAY STEM STEP STIR STOP SUIT SURE TAIL TALE TAME TAPE TEAM " +
  "TEAR TELL TEND TENT TERM TEST THAN THAT THEM THEN THEY THIN THIS TIDE TIED TILE TIME TINY TIRE TOAD " +
  "TOLD TONE TOOL TOUR TOWN TREE TRIM TRIO TRIP TRUE TUNE TURN TWIN UNIT VASE VEST VOTE WADE WAIT WANT " +
  "WEAR WEED WENT WEST WHAT WHEN WIDE WINE WIRE WISE WITH YEAR " +
  "ALONE ARENA ARISE ASIDE EARTH ENTER ERASE HEART HORSE INNER LEARN LINEN NOISE NORTH ONION OTHER " +
  "OTTER RAISE RIDER ROAST SAINT SENSE SHARE SLATE STAGE STAIR STARE START STEEL STONE STORE TASTE " +
  "TEACH THERE THESE THREE TOAST TOOTH TOTAL TRADE TRAIN TREAT WRITE " +
  "ACTION ARTIST CANDLE CENTER CHANCE COTTON DESERT DINNER ENGINE FATHER FLOWER FOREST GOLDEN LETTER " +
  "LITTLE MINUTE NATURE ORANGE PLANET REASON SEASON SECRET SILENT SISTER STREET SUNSET TIMBER WINTER "
).split(" ").filter(Boolean);

// Capitals 5 by 7, top row first.
const BIG = (
  ".###. #...# #...# ##### #...# #...# #...#|####. #...# #...# ####. #...# #...# ####.|.#### #.... #.... #.... #.... #.... .####|" +
  "####. #...# #...# #...# #...# #...# ####.|##### #.... #.... ####. #.... #.... #####|##### #.... #.... ####. #.... #.... #....|" +
  ".#### #.... #.... #..## #...# #...# .###.|#...# #...# #...# ##### #...# #...# #...#|##### ..#.. ..#.. ..#.. ..#.. ..#.. #####|" +
  "....# ....# ....# ....# ....# #...# .###.|#...# #..#. #.#.. ##... #.#.. #..#. #...#|#.... #.... #.... #.... #.... #.... #####|" +
  "#...# ##.## #.#.# #.#.# #...# #...# #...#|#...# ##..# ##..# #.#.# #..## #..## #...#|.###. #...# #...# #...# #...# #...# .###.|" +
  "####. #...# #...# ####. #.... #.... #....|.###. #...# #...# #...# #.#.# #..#. .##.#|####. #...# #...# ####. #.#.. #..#. #...#|" +
  ".#### #.... #.... .###. ....# ....# ####.|##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..|#...# #...# #...# #...# #...# #...# .###.|" +
  "#...# #...# #...# #...# .#.#. .#.#. ..#..|#...# #...# #...# #.#.# #.#.# ##.## #...#|#...# #...# .#.#. ..#.. .#.#. #...# #...#|" +
  "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..|##### ....# ...#. ..#.. .#... #.... #####"
).split("|");
// Drawn 8 by 10 on a die: the outer and middle columns and rows two LEDs
// thick, the others one, so stems and bars come out bold.
const SX = [2, 1, 2, 1, 2], SY = [2, 1, 1, 2, 1, 1, 2];
const BIGMAP = BIG.map((g) => {
  const rows = g.split(" "), m = new Uint8Array(80);
  for (let r = 0, y = 0; r < 7; y += SY[r++])
    for (let c = 0, x = 0; c < 5; x += SX[c++])
      if (rows[r][c] === "#") for (let dy = 0; dy < SY[r]; dy++) for (let dx = 0; dx < SX[c]; dx++) m[(y + dy) * 8 + x + dx] = 1;
  return m;
});

// Small capitals 5 rows tall, three wide except M, N and W.
const SMALL = (
  ".#. #.# ### #.# #.#|##. #.# ##. #.# ##.|.## #.. #.. #.. .##|##. #.# #.# #.# ##.|### #.. ##. #.. ###|### #.. ##. #.. #..|" +
  ".## #.. #.# #.# .##|#.# #.# ### #.# #.#|### .#. .#. .#. ###|..# ..# ..# #.# .#.|#.# #.# ##. #.# #.#|#.. #.. #.. #.. ###|" +
  "#...# ##.## #.#.# #...# #...#|#..# ##.# #.## #..# #..#|.#. #.# #.# #.# .#.|##. #.# ##. #.. #..|.#. #.# #.# ##. .##|" +
  "##. #.# ##. #.# #.#|.## #.. .#. ..# ##.|### .#. .#. .#. .#.|#.# #.# #.# #.# ###|#.# #.# #.# #.# .#.|" +
  "#...# #...# #.#.# ##.## #...#|#.# #.# .#. #.# #.#|#.# #.# .#. .#. .#.|### ..# .#. #.. ###"
).split("|").map((g) => g.split(" "));

// Letter weights, in hundredths of a percent of English text; no Q.
const FREQ = "E1270 T906 A817 O751 I697 N675 S633 H609 R599 D425 L403 C278 U276 M241 W236 F223 G202 Y197 P193 B129 V98 K77 J15 X15 Z7"
  .split(" ").map((s) => [s.charCodeAt(0) - 65, +s.slice(1)]);
const FTOT = FREQ.reduce((a, f) => a + f[1], 0);

// The prefix tree: 26 children a node, -1 for none, and the word a node ends.
const KIDS = [new Int32Array(26).fill(-1)], ENDS = [-1];
WORDS.forEach((w, i) => {
  let n = 0;
  for (let j = 0; j < w.length; j++) {
    const c = w.charCodeAt(j) - 65;
    if (KIDS[n][c] < 0) {
      KIDS[n][c] = KIDS.length;
      KIDS.push(new Int32Array(26).fill(-1));
      ENDS.push(-1);
    }
    n = KIDS[n][c];
  }
  ENDS[n] = i;
});

// Each die's neighbours, in reading order.
const NB = [];
for (let i = 0; i < 16; i++) {
  const r = i >> 2, c = i & 3, l = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < 4 && cc >= 0 && cc < 4) l.push(rr * 4 + cc);
    }
  NB.push(l);
}
const CX = (d) => (d & 3) * 16 + 7.5, CY = (d) => (d >> 2) * 16 + 7.5;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
}

const roll = () => {
  const L = new Int8Array(16);
  for (let i = 0; i < 16; i++) {
    let r = Math.random() * FTOT, k = 0;
    while (k < FREQ.length - 1 && (r -= FREQ[k][1]) >= 0) k++;
    L[i] = FREQ[k][0];
  }
  return L;
};

// The search as a machine that takes one step at a time, so the drawing can
// show every step and the solver below can run the same steps to the end.
function searcher(L) {
  return { L, sd: new Int8Array(8), sn: new Int32Array(8), sk: new Int8Array(8), depth: 0, used: 0, si: 0, done: false };
}

// One step: onto a die (push) or back off one (pop). Returns what happened:
// the die, the neighbours turned away on the way, and a word ended, or -1.
function step(s) {
  const ev = { push: false, die: -1, rej: [], word: -1 };
  if (s.depth === 0) {
    if (s.si >= 16) {
      s.done = true;
      return ev;
    }
    const d = s.si++, n = KIDS[0][s.L[d]];
    if (n < 0) {
      ev.rej.push(d);
      return ev;
    }
    push(s, d, n, ev);
    return ev;
  }
  const top = s.depth - 1, d = s.sd[top], nb = NB[d];
  while (s.sk[top] < nb.length) {
    const e = nb[s.sk[top]++];
    if (s.used & (1 << e)) continue;
    const n = KIDS[s.sn[top]][s.L[e]];
    if (n < 0) {
      ev.rej.push(e);
      continue;
    }
    push(s, e, n, ev);
    return ev;
  }
  s.depth--;
  s.used &= ~(1 << d);
  ev.die = d;
  return ev;
}

function push(s, d, n, ev) {
  s.sd[s.depth] = d;
  s.sn[s.depth] = n;
  s.sk[s.depth] = 0;
  s.depth++;
  s.used |= 1 << d;
  ev.push = true;
  ev.die = d;
  if (ENDS[n] >= 0 && s.depth >= 3) ev.word = ENDS[n];
}

// Every word a board holds, each once, in the order the search meets it.
function solve(L) {
  const s = searcher(L), out = [], seen = new Set();
  while (!s.done) {
    const ev = step(s);
    if (ev.word >= 0 && !seen.has(ev.word)) {
      seen.add(ev.word);
      out.push({ w: ev.word, path: Array.from(s.sd.subarray(0, s.depth)), at: -1, blink: 0, i: out.length });
    }
  }
  return out;
}

const wordWidth = (w) => {
  let x = -1;
  for (let j = 0; j < w.length; j++) x += SMALL[w.charCodeAt(j) - 65][0].length + 1;
  return x;
};

// Where each listed word goes: flowing text, wrapped at the panel's edge,
// its lines 7 to 9 rows apart so that a short list still reaches down.
function layout(sol, mn) {
  const pos = [];
  let x = 1, line = 0;
  for (const e of sol) {
    const w = WORDS[e.w];
    if (w.length < mn) continue;
    const ww = wordWidth(w);
    if (x + ww > W - 1) {
      x = 1;
      line++;
    }
    pos.push({ e, x, line });
    x += ww + 4;
  }
  const pitch = line ? cl(floor((H - 6 - LIST_Y) / line), LINE, 9) : LINE;
  for (const p of pos) p.y = LIST_Y + p.line * pitch;
  return pos;
}

// Roll until the board holds a fair number of words of at least mn letters
// (20 to 30 of three letters or more, 10 to 20 of four, 3 to 10 of five,
// 1 to 4 of six) and they fit the list; after 80 rolls take the nearest.
const BAND = [[20, 30], [10, 20], [3, 10], [1, 4]];
function board(mn) {
  const [lo, hi] = BAND[mn - 3];
  let best = null, bestScore = 1e9;
  for (let t = 0; t < 80; t++) {
    const L = roll(), sol = solve(L), pos = layout(sol, mn);
    const n = pos.length, lines = pos.reduce((m, p) => max(m, p.line + 1), 0);
    const score = max(0, lo - n, n - hi) + (lines > LINES ? 100 : 0);
    if (score < bestScore) (best = { L, sol }), (bestScore = score);
    if (!score) break;
  }
  return best;
}

export function setup(params) {
  params.s = {
    hue: 0, mn: 3, probe: 0.06,
    phase: 0, t: 0, acc: 0, wait: 0, clock: 0,
    L: null, sol: null, byWord: new Map(), s: null,
    flash: new Float32Array(16), back: new Float32Array(16), visits: new Float32Array(16),
    shown: new Int8Array(16), jx: new Int8Array(16), jy: new Int8Array(16), jt: 0,
    rgb: new Float32Array(N * 3),
  };
}

function begin(S, b) {
  S.L = b.L;
  S.sol = b.sol;
  S.byWord = new Map(b.sol.map((e) => [e.w, e]));
  S.s = searcher(b.L);
  S.shown.set(b.L);
  S.jx.fill(0);
  S.jy.fill(0);
  S.visits.fill(0);
  S.phase = 0;
  S.t = 0;
  S.acc = 0;
  S.wait = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.mn = round(cl(k[2] == null ? 3 : k[2], 3, 6));
  S.probe = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (!S.L) begin(S, board(S.mn));
  const dd = (d * speed) / 2;
  S.clock += dd;
  S.t += dd;
  const fall = exp(-dd * 7);
  for (let i = 0; i < 16; i++) {
    S.flash[i] *= fall;
    S.back[i] *= fall;
  }
  for (const e of S.sol) e.blink *= fall;
  if (S.phase === 0) {
    if (S.wait > 0) {
      S.wait = max(0, S.wait - dd);
      return;
    }
    S.acc += dd;
    // Each step shows at once and is paid for after: a step onto a die
    // holds the picture PUSH seconds, a step back POP.
    while (S.phase === 0 && S.wait <= 0 && S.acc > 0) {
      const ev = step(S.s);
      if (S.s.done) {
        S.phase = 1;
        S.t = 0;
        break;
      }
      S.acc -= ev.push ? PUSH : POP;
      for (const r of ev.rej) S.flash[r] = 1;
      if (!ev.push && ev.die >= 0) S.back[ev.die] = 1;
      if (ev.push) S.visits[ev.die]++;
      if (ev.word >= 0) {
        const e = S.byWord.get(ev.word);
        if (e.at < 0) {
          e.at = S.clock;
          if (WORDS[e.w].length >= S.mn) S.wait = FIND;
        } else e.blink = 1;
      }
    }
  } else if (S.phase === 1) {
    if (S.t >= SHINE) {
      S.phase = 2;
      S.t = 0;
      S.next = board(S.mn);
    }
  } else {
    // The shake: dice jolt and tumble, then land on the new roll.
    S.jt -= dd;
    if (S.jt <= 0) {
      S.jt = 0.06;
      for (let i = 0; i < 16; i++) {
        S.jx[i] = floor(Math.random() * 5) - 2;
        S.jy[i] = floor(Math.random() * 5) - 2;
        if (Math.random() < 0.6) S.shown[i] = FREQ[floor(Math.random() * 12)][0];
      }
    }
    if (S.t >= SHAKE) begin(S, S.next);
  }
}

function add(rgb, x, y, c, v) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  rgb[p] += c[0] * v;
  rgb[p + 1] += c[1] * v;
  rgb[p + 2] += c[2] * v;
}

// An antialiased line, one step per LED along its longer side.
function line(rgb, xa, ya, xb, yb, c, v) {
  const dx = xb - xa, dy = yb - ya, n = max(abs(dx), abs(dy));
  if (n < 0.5) return;
  const g = v * sqrt(dx * dx + dy * dy) / n;
  for (let i = 0; i <= n; i++) {
    const x = xa + (dx * i) / n, y = ya + (dy * i) / n;
    if (abs(dx) >= abs(dy)) {
      const fy = y - floor(y);
      add(rgb, x, floor(y), c, g * (1 - fy));
      add(rgb, x, floor(y) + 1, c, g * fy);
    } else {
      const fx = x - floor(x);
      add(rgb, floor(x), y, c, g * (1 - fx));
      add(rgb, floor(x) + 1, y, c, g * fx);
    }
  }
}

function path(rgb, p, c, v, off) {
  for (let j = 0; j + 1 < p.length; j++) line(rgb, CX(p[j]) + off, CY(p[j]) + off * 0.5, CX(p[j + 1]) + off, CY(p[j + 1]) + off * 0.5, c, v);
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.L) return;
  const rgb = S.rgb, h = S.hue, pv = 1 - S.probe, mn = S.mn;
  rgb.fill(0);
  const face = hsv(h + 0.6, 0.45, 1), pale = hsv(h + 0.12, 0.3, 1), ivory = hsv(h + 0.12, 0.12, 1), gold = hsv(h + 0.12, 0.6, 1), rose = hsv(h + 0.95, 0.55, 1), white = [1, 1, 1];
  const wcol = (e) => hsv(h + 0.27 + ((e.i * 0.381966) % 1) * 0.6, 0.75, 1);
  const shaking = S.phase === 2, shine = S.phase === 1 ? min(1, S.t / 0.5) : 0;
  const onPath = new Int8Array(16);
  if (S.phase === 0) for (let j = 0; j < S.s.depth; j++) onPath[S.s.sd[j]] = j === S.s.depth - 1 ? 2 : 1;
  // The newest word still holding the search lights its dice.
  let fresh = null;
  for (const e of S.sol) if (e.at >= 0 && WORDS[e.w].length >= mn && (!fresh || e.at > fresh.at)) fresh = e;
  const freshAge = fresh ? S.clock - fresh.at : 99;
  const freshDie = new Int8Array(16);
  if (fresh && freshAge < 0.6 && !shaking) for (const d of fresh.path) freshDie[d] = 1;
  const fc = fresh ? wcol(fresh) : white;

  let vmax = 1;
  for (let d = 0; d < 16; d++) vmax = max(vmax, S.visits[d]);
  // Dice faces: a rounded square of slate, warmer the more often the probe
  // has stood on it this board, and a rim round it that shows what the
  // search is doing there: gold under the probe, white at its head, rose
  // where the prefix tree turned the probe away, the word's own colour on
  // the dice of a word just found.
  for (let d = 0; d < 16; d++) {
    const x0 = (d & 3) * 16 + 1 + S.jx[d], y0 = (d >> 2) * 16 + 1 + S.jy[d];
    const heat = sqrt(S.visits[d] / vmax) * pv;
    let c = mix(face, pale, 0.8 * heat), v = 0.12 + 0.26 * heat, rc = face, rv = 0.15;
    if (freshDie[d]) (c = fc), (v = 0.3), (rc = fc), (rv = 1);
    else if (onPath[d] === 2) (v = 0.15 + 0.15 * pv), (rc = mix(gold, white, 0.6)), (rv = 0.15 + 0.85 * pv);
    else if (onPath[d]) (v = 0.15 + 0.07 * pv), (rc = gold), (rv = 0.15 + 0.75 * pv);
    if (S.flash[d] > 0.05 && !freshDie[d] && !onPath[d]) (rc = rose), (rv = 0.15 + 0.75 * S.flash[d] * pv);
    if (S.back[d] > 0.05 && !freshDie[d] && !onPath[d]) (rc = mix(rc, gold, S.back[d])), (rv = max(rv, 0.5 * S.back[d] * pv));
    for (let y = 0; y < 14; y++)
      for (let x = 0; x < 14; x++) {
        const ex = x === 0 || x === 13, ey = y === 0 || y === 13;
        if (ex && ey) continue;
        if (ex || ey) add(rgb, x0 + x, y0 + y, rc, rv);
        else add(rgb, x0 + x, y0 + y, c, v);
      }
  }

  // Found words: their paths, bright when new and dim later, all bright
  // once the board is solved; each word a little offset from the others.
  for (const e of S.sol) {
    if (e.at < 0 || WORDS[e.w].length < mn || shaking) continue;
    const age = S.clock - e.at, v = max(0.3 + 0.7 * exp(-age / 1.2), 1.2 * shine);
    path(rgb, e.path, wcol(e), v, ((e.i % 5) - 2) * 0.8);
  }
  // The probe's path.
  if (S.phase === 0 && pv > 0.01) path(rgb, Array.from(S.s.sd.subarray(0, S.s.depth)), gold, 0.9 * pv, 0);

  // Capitals on the dice, drawn over everything in the tray. As Probe
  // hides the search, the dice no word has used yet sink to a third.
  const used = new Int8Array(16);
  for (const e of S.sol) if (e.at >= 0 && WORDS[e.w].length >= mn) for (const d of e.path) used[d] = 1;
  for (let d = 0; d < 16; d++) {
    const g = BIGMAP[S.shown[d]], x0 = (d & 3) * 16 + 4 + S.jx[d], y0 = (d >> 2) * 16 + 3 + S.jy[d];
    let c = ivory, v = (0.82 - 0.3 * shine) * (used[d] || shaking ? 1 : 1 - 0.65 * S.probe);
    if (freshDie[d]) (c = mix(white, fc, 0.3)), (v = 1);
    else if (onPath[d]) (c = mix(ivory, white, pv)), (v = 0.82 + 0.18 * pv);
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 8; x++) {
        if (!g[y * 8 + x]) continue;
        const xx = x0 + x, yy = y0 + y;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const p = (yy * W + xx) * 3;
        rgb[p] = c[0] * v;
        rgb[p + 1] = c[1] * v;
        rgb[p + 2] = c[2] * v;
      }
  }

  // A dotted rule under the tray.
  for (let x = 2; x < W - 2; x += 2) add(rgb, x, 65, face, 0.3);

  // The list: a blank per letter until the word is found, then the word.
  const fade = shaking ? max(0, 1 - S.t / 0.6) : 1;
  for (const { e, x, y } of layout(S.sol, mn)) {
    if (y + 5 > H) break;
    const w = WORDS[e.w], age = e.at < 0 ? -1 : S.clock - e.at;
    const c = wcol(e), typed = age < 0 ? 0 : min(w.length, floor(age / 0.06) + 1);
    let xx = x;
    for (let j = 0; j < w.length; j++) {
      const g = SMALL[w.charCodeAt(j) - 65], gw = g[0].length;
      if (j < typed) {
        const v = fade * min(1, 0.85 + 0.15 * shine + 0.6 * e.blink + (age < 0.5 ? 0.3 : 0));
        const cc = e.blink > 0.05 ? mix(c, white, e.blink) : c;
        for (let r = 0; r < 5; r++) for (let q = 0; q < gw; q++) if (g[r][q] === "#") add(rgb, xx + q, y + r, cc, v);
      } else for (let q = 0; q < gw; q++) add(rgb, xx + q, y + 4, face, 0.3 * fade);
      xx += gw + 1;
    }
  }

  for (let p = 0; p < N; p++) {
    const o = p * 3;
    display.setPixel(p % W, floor(p / W), round(255 * min(1, rgb[o])), round(255 * min(1, rgb[o + 1])), round(255 * min(1, rgb[o + 2])));
  }
}
