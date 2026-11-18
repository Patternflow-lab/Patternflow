// ===== Patternflow pattern =====
// Title:   Crossword Fill
// Family:  type
// Idea:    A crossword grid stands up the whole panel, 8 squares across and 16 down, and a backtracking search fills it from a list of 580 common words, each letter appearing in its square as it is written, a crossing square flashing red when the letter leaves its other word with nothing to be, the letters taken back out one by one while the search tries the next word or goes back to the word before, until every row and column of white squares reads as a word and the grid empties for the next one.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: backtracking (Derrick H. Lehmer, 1950s, the name from his lectures), forward checking and the fewest-words-first choice of the next slot (Haralick and Elliott, 1980), the 3 by 5 capitals of Saccades (pattern round 106), copied from scytale.js; pattern round 109
// Round:   109
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=1..6, Order=1..3, Slack=-1..2
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the squares are blue, the word being worked on is violet, a letter that has just landed is white and a square where the search has run into a wall is red. A hue that would leave the squares a dim orange or yellow goes to crimson or green instead.
// Knob 2: Speed. How many moves the solver makes a second, 24 for each step of the knob, so 48 at 2. A move is one letter written or taken out, a slot chosen, or one beat of the six that a red square holds the search for. The first move is at 0.4 s and at 2 a grid is full after 9 s on average and 14 s at most.
// Knob 3: Order. Which slot the solver fills next. At 1 it takes the one with the fewest words left that fit, at 2 the longest one still empty, at 3 the first in reading order, across before down. At 1 a grid takes 260 to 330 moves and 9 to 12 walls on average, at 2 and 3 it takes 460 to 580 moves and 25 to 34 walls.
// Knob 4: Slack. How many black squares the grid has, 44 at -1, 48 at 0, 52 at 1 and 56 at 2. With fewer there are more crossings between words, which makes the grid tighter and the search a little longer: at Order 1 it takes 326 moves on average at -1 and 263 at 2. It snaps to whole numbers and starts a new grid.

const W = 64, H = 128, CW = 8, CH = 16, NC = CW * CH;
const { floor, round, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The face: capitals 3 wide and 5 tall, one string a row, from saccades.js by way of scytale.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch.charCodeAt(0)] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// 580 common words of 3 to 8 letters, no names. The longer a word the fewer of them there are.
const LIST = [
  "ACE ACT ADD AGE AID AIM AIR ALE ALL AND ANT APE ARE ARM ART ASH ATE AWE BAT BEE BIT CAN CAT DEN DOT DUE EAR EAT EEL END EYE FAN FEW FIN FIT GAS GET HAM HAT HAY HEN HER HID HIS HIT HOP HOT HUT ICE INN ITS LAD LAW LET LID LIE LIT LOT MAT MEN MET NET NEW NOD NOR NOT NOW NUT OAR OAT OIL OLD ONE ORE OUR OUT PAT PEA PEN PET PIE PIN PIT POD POT RAN RAT RAY RED RIG RIM ROD ROW RUN SAT SAY SEA SEE SET SIR SIT SON SUN TAG TAN TAP TAR TEA TEN THE TIE TIN TIP TOE TON TOO TOP TOY TRY TWO USE VET WAR WAS WET WHO WIN WON YES YET",
  "AGED ALSO AREA AUNT BEAR BEAT BEND BEST BONE BOOT CARE CART CASE CAST CHAT COAL CORN COST DASH DATA DATE DEAL DEAR DIET DISH DOWN EACH EARN EASE EAST ELSE EVEN EVER FEAR FEEL FOOT GAIN GATE GOAT HAIR HAND HEAD HEAL HEAT HERB HERD HIDE HILL HINT HOLE HOST HOUR ISLE LANE LAST LATE LEAD LEAN LEFT LEND LESS LIFE LION LIST LOAN LOFT MASS MATE MEAL MINT MOST NAME NEAR NEED NEST NINE NODE NOON NOSE NOTE OATH ODOR ONCE ONTO OPEN ORAL PEAR PEEL POOR PORT RACE RAIL RAIN RARE RATE READ REAL REED RENT REST RISE ROAD ROAR ROLE ROOF RUDE RULE RUST SAGE SAID SAIL SALT SEAT SEED SEEM SEND SHED SHOE SHOT SHUT SIDE SITE SLED SNOW SOAR SOFT SOIL SOON SOUL STAR STEM STEP STIR SURE SWAN TAIL TALE TALL TEAM TEAR TENT TERM TEST THAN THEM THEN THEY THIN THIS TIDE TIDY TIED TIRE TOOL TORN TOUR TOWN TREE TRIM TRUE TUNE TWIN VOTE WADE WAIT WANT WINE WIRE WISE WORE",
  "ACORN AGENT AGREE AHEAD ALARM ALERT ALONE ALTER ARENA ARGUE ARISE ASSET AWARE BEARD BIRTH BOOST BRIDE CHAIN CHASE CHESS CHEST COACH COAST CORAL CRANE CREAM DAISY DEPTH DITCH DRAMA DREAM EAGLE EARTH ENEMY ENTER ERASE EVENT FAINT FEAST FINAL FLESH FRESH GRAIN GREEN GREET HABIT HASTE HEART HEDGE HOUSE IRONY LARGE LASER LATER LAYER LEASE LEAVE LINEN LOOSE MEDAL METAL MOOSE MOTOR NIGHT NOISE NOTED NURSE ORDER OTHER OTTER OWNER PAINT PAUSE PHONE PHOTO PIANO PILOT PLANE PRIDE PRINT RADIO RAISE REACH REALM RIDER ROAST RULER SAUCE SENSE SERVE SHADE SHAPE SHARP SHEEP SHEET SHINE SINCE SLEEP SLICE SLIDE SOLID SOUTH SPACE SPARE SPEED STARE STATE STEAM STEEL STILL STONE STOOL STRIP SUITE SWEET TASTE TEETH THEME THREE THROW TIGHT TIRED TOAST TODAY TOOTH TOTAL TOWER TRADE TREAT TREND TRUTH UNION UNITE UNTIL WASTE WATER WHEAT WHEEL WHITE WORSE",
  "ACTION AFRAID AMOUNT ARCADE BANNER BESIDE BETTER CENTER CHEESE CHOOSE COTTON DANGER DESERT DESIGN DETAIL DINNER DIRECT DRAWER ENGINE ESCAPE FASTER FOREST FRIEND HANDLE HONEST ISLAND LADDER LEADER LEGEND LETTER LISTEN MASTER MOTION NATURE NEEDLE NOTICE PARADE POLITE PRINCE RAISIN RATHER READER REASON REMAIN REPAIR RESCUE RETURN SADDLE SCREEN SEASON SECOND SECRET SELECT SIGNAL SILENT SISTER SMOOTH SOCCER STABLE STREAM STREET STRONG SUDDEN TALENT TENNIS THIRTY THREAD TUNNEL WAITER WEALTH",
  "ANOTHER BALANCE BARGAIN BROTHER CENTURY CONTAIN COURAGE CURIOUS DESERVE DRAWING EVENING FEATHER FREEDOM GENERAL HARVEST HEALTHY HUNDRED LANTERN LEATHER MACHINE NEITHER PARTNER PATTERN PRESENT REALITY SCIENCE SEVERAL SHELTER SILENCE SOMEONE STATION STRETCH TEACHER THOUGHT THUNDER TONIGHT WEATHER WELCOME WHISPER WRITING",
  "ACTIVITY AIRPLANE ALPHABET ANYTHING BASEBALL BIRTHDAY CALENDAR ELEPHANT EVERYONE EXERCISE FAMILIAR FESTIVAL FIREWORK FRIENDLY HOSPITAL INSTANCE INTEREST LANGUAGE MARRIAGE PASSPORT PEACEFUL PRESSURE REMEMBER SHOULDER SOMEBODY STRENGTH SUNSHINE TOGETHER TREASURE VACATION",
];
const WORDS = LIST.join(" ").split(" "), NW = WORDS.length;
const WCH = new Uint8Array(NW * 8), WLEN = new Uint8Array(NW);
const BYLEN = []; // the ids of the words of each length, in list order
for (let L = 0; L <= 8; L++) BYLEN.push([]);
WORDS.forEach((w, i) => {
  WLEN[i] = w.length;
  for (let k = 0; k < w.length; k++) WCH[i * 8 + k] = w.charCodeAt(k);
  BYLEN[w.length].push(i);
});

// Four sets of three templates, for Slack -1, 0, 1 and 2: 44, 48, 52 and 56 black squares, rows apart by |.
const TEMPLATES = [
  [
    "#...#...|.##.#.#.|....#.#.|.##.....|#.##.#.#|#.#.....|....#.#.|#.#...#.|.#...#.#|.#.#....|.....#.#|#.#.##.#|.....##.|.#.#....|.#.#.##.|...#...#",
    ".##.....|...#.#.#|.##.....|....####|#.#.#.#.|...#....|#.#.#.#.|#.....#.|.#.....#|.#.#.#.#|....#...|.#.#.#.#|####....|.....##.|#.#.#...|.....##.",
    ".....#.#|.##.#...|....##.#|.#.#...#|#...#...|.##...##|....#.#.|.###....|....###.|.#.#....|##...##.|...#...#|#...#.#.|#.##....|...#.##.|#.#.....",
  ],
  [
    "#.###...|......##|#.#.#...|.#...##.|.####...|...#.#.#|##.#....|.....##.|.##.....|....#.##|#.#.#...|...####.|.##...#.|...#.#.#|##......|...###.#",
    ".##.#.##|.#.....#|.##.#...|....##.#|#.##...#|....#...|.###...#|....#.#.|.#.#....|#...###.|...#....|#...##.#|#.##....|...#.##.|#.....#.|##.#.##.",
    "...#....|#...##.#|...##...|.#....#.|.####.#.|.#....##|.##.#...|#...##.#|#.##...#|...#.##.|##....#.|.#.####.|.#....#.|...##...|#.##...#|....#...",
  ],
  [
    ".....###|#.#.##.#|#.#.#...|...#....|##.##.#.|.#....#.|...#.###|.##....#|#....##.|###.#...|.#....#.|.#.##.##|....#...|...#.#.#|#.##.#.#|###.....",
    "###.####|#.#.#...|.....#.#|#.#.....|...#.#.#|#....###|.#.#....|....###.|.###....|....#.#.|###....#|#.#.#...|.....#.#|#.#.....|...#.#.#|####.###",
    "#.#....#|#.#.##.#|#......#|.#.##...|...#...#|.#.##.##|##.#....|....###.|.###....|....#.##|##.##.#.|#...#...|...##.#.|#......#|#.##.#.#|#....#.#",
  ],
  [
    ".......#|#.#.##.#|#.#....#|####.##.|........|###.###.|#.#.#...|#...##.#|#.##...#|...#.#.#|.###.###|........|.##.####|#....#.#|#.##.#.#|#.......",
    "##.##.##|....#...|##....#.|#...###.|###.#...|#...##.#|#.##....|....###.|.###....|....##.#|#.##...#|...#.###|.###...#|.#....##|...#....|##.##.##",
    "#.##...#|#...##.#|#.##...#|#...#.#.|...##...|##....#.|#.#.###.|#....#.#|#.#....#|.###.#.#|.#....##|...##...|.#.#...#|#...##.#|#.##...#|#...##.#",
  ],
];
// For each template and each Order, the seeds checked to fill it within 720 moves, 15 s at the default Speed.
const SEEDS = [[[[1,7,9,12],[1,9,27,92],[1,6,34,51]],[[0,6,9,10],[17,72,98,99],[31,53,60,65]],[[2,3,6,9],[18,23,35,39],[23,28,30,37]]],[[[0,11,14,17],[15,42,58,65],[6,21,27,83]],[[2,4,10,14],[18,24,27,45],[5,12,17,23]],[[0,6,9,11],[6,55,81,95],[34,35,40,49]]],[[[4,5,7,15],[20,38,92,98],[2,4,12,19]],[[0,5,6,8],[2,4,10,17],[3,5,14,36]],[[5,8,10,12],[6,10,18,30],[12,21,25,91]]],[[[3,6,8,9],[2,6,59,61],[2,12,16,34]],[[3,4,6,9],[7,8,51,64],[7,15,19,20]],[[5,6,9,10],[28,54,55,87],[13,17,23,49]]]];

// ---------------------------------------------------------------------------
// The grid. A template is 16 rows of 8 characters, # a black square and . a
// white one, the same turned half way round. A slot is a run of three or more
// white squares across or down; a square on two slots is where two words cross.
// ---------------------------------------------------------------------------
const MAXS = 64, SHUF = [3, 4, 5, 6, 7, 8];

function build(S, rows) {
  const blk = S.blk;
  for (let r = 0; r < CH; r++) for (let c = 0; c < CW; c++) blk[r * CW + c] = rows[r][c] === "#" ? 1 : 0;
  S.cellSlot.fill(-1);
  let n = 0;
  const add = (dir, r, c, L) => {
    S.sdir[n] = dir;
    S.slen[n] = L;
    for (let i = 0; i < L; i++) {
      const cell = dir === 0 ? r * CW + c + i : (r + i) * CW + c;
      S.scell[n * 8 + i] = cell;
      S.cellSlot[cell * 2 + dir] = n;
    }
    n++;
  };
  for (let r = 0; r < CH; r++)
    for (let c = 0; c < CW; c++) {
      if (blk[r * CW + c]) continue;
      if (c === 0 || blk[r * CW + c - 1]) {
        let L = 0;
        while (c + L < CW && !blk[r * CW + c + L]) L++;
        if (L >= 3) add(0, r, c, L);
      }
      if (r === 0 || blk[(r - 1) * CW + c]) {
        let L = 0;
        while (r + L < CH && !blk[(r + L) * CW + c]) L++;
        if (L >= 3) add(1, r, c, L);
      }
    }
  S.ns = n;
}

// ---------------------------------------------------------------------------
// The solver, backtracking with forward checking. It takes a slot, lists the
// words that fit the letters already in it, in an order that comes from the
// seed, and writes the first a letter at a time. A new letter in a square with
// another slot through it asks that slot whether a word is still left; if none
// is, the square is a wall: the letters this word wrote come out and the next
// word is tried. A slot with no word left sends the search back to the word
// before. Order is how the next slot is chosen. step() makes one small move.
// ---------------------------------------------------------------------------
const M_PICK = 0, M_DEAD = 1, M_NEXT = 2, M_WRITE = 3, M_CONFLICT = 4, M_ERASE = 5, M_UNDO = 6, M_DONE = 7, M_FAIL = 8;
const EV_WRITE = 1, EV_CONFLICT = 2, EV_ERASE = 4, EV_PLACED = 8, EV_DEAD = 16, EV_DONE = 32, EV_PICK = 64, EV_TOUCH = 128;
const PAUSE = 6; // moves a red square holds the search for

function solverInit(S, seed, order) {
  const r = rng(seed * 7919 + 13);
  for (const L of SHUF) {
    const src = BYLEN[L], ids = S.ords[L];
    for (let i = 0; i < src.length; i++) ids[i] = src[i];
    for (let i = src.length - 1; i > 0; i--) {
      const j = floor(r() * (i + 1)), t = ids[i];
      ids[i] = ids[j];
      ids[j] = t;
    }
  }
  S.cell.fill(0);
  S.used.fill(0);
  S.placed.fill(0);
  S.depth = 0;
  S.mode = M_PICK;
  S.order = order;
  S.steps = 0;
  S.nconf = 0;
  S.nundo = 0;
  S.pause = 0;
  S.solved = false;
}

function fits(S, si, w) {
  const base = si * 8, L = S.slen[si];
  for (let i = 0; i < L; i++) {
    const c = S.cell[S.scell[base + i]];
    if (c && c !== WCH[w * 8 + i]) return false;
  }
  return true;
}
function countFit(S, si, lim) {
  const ids = S.ords[S.slen[si]];
  let n = 0;
  for (let k = 0; k < ids.length; k++) {
    const w = ids[k];
    if (!S.used[w] && fits(S, si, w) && ++n >= lim) return n;
  }
  return n;
}
function pickSlot(S) {
  let best = -1, bk = 1e9;
  for (let si = 0; si < S.ns; si++) {
    if (S.placed[si]) continue;
    const key = S.order === 3 ? si : S.order === 2 ? -S.slen[si] * 1000 + si : countFit(S, si, 1e9) * 1000 - S.slen[si] * 10 + si * 0.001;
    if (key < bk) {
      bk = key;
      best = si;
    }
  }
  return best;
}

// One move. It returns the events of the move as bits, and leaves the square it
// touched in S.evCell, the letter taken out in S.evCh and the slot in S.evSlot.
function solverStep(S) {
  S.steps++;
  S.ev = 0;
  const st = S.stack;
  switch (S.mode) {
    case M_PICK: {
      const si = pickSlot(S);
      if (si < 0) {
        S.solved = true;
        S.mode = M_DONE;
        S.ev = EV_DONE;
        return;
      }
      const e = st[S.depth++];
      e.slot = si;
      e.ci = 0;
      e.nc = 0;
      e.word = -1;
      e.nw = 0;
      const ids = S.ords[S.slen[si]];
      for (let k = 0; k < ids.length; k++) if (!S.used[ids[k]] && fits(S, si, ids[k])) e.cand[e.nc++] = ids[k];
      S.evSlot = si;
      S.ev = EV_PICK;
      if (e.nc === 0) {
        S.nconf++;
        S.pause = PAUSE;
        S.mode = M_DEAD;
        S.ev |= EV_DEAD;
      } else S.mode = M_NEXT;
      return;
    }
    case M_DEAD:
      if (--S.pause > 0) return;
      S.depth--;
      S.mode = M_UNDO;
      return;
    case M_NEXT: {
      const e = st[S.depth - 1];
      if (e.ci >= e.nc) {
        S.depth--;
        S.mode = M_UNDO;
        return;
      }
      e.word = e.cand[e.ci++];
      S.used[e.word] = 1;
      e.pos = 0;
      e.nw = 0;
      S.mode = M_WRITE;
      S.evSlot = e.slot;
      return;
    }
    case M_WRITE: {
      const e = st[S.depth - 1], base = e.slot * 8, c = S.scell[base + e.pos], l = WCH[e.word * 8 + e.pos];
      S.evSlot = e.slot;
      S.evCell = c;
      if (!S.cell[c]) {
        S.cell[c] = l;
        e.wrote[e.nw++] = c;
        S.ev = EV_WRITE;
        const o = S.cellSlot[c * 2 + 1 - S.sdir[e.slot]];
        if (o >= 0 && !S.placed[o] && countFit(S, o, 1) === 0) {
          S.nconf++;
          S.pause = PAUSE;
          S.mode = M_CONFLICT;
          S.ev |= EV_CONFLICT;
          return;
        }
      } else S.ev = EV_TOUCH;
      if (++e.pos === S.slen[e.slot]) {
        S.placed[e.slot] = 1;
        S.ev |= EV_PLACED;
        S.mode = M_PICK;
      }
      return;
    }
    case M_CONFLICT:
      if (--S.pause > 0) return;
      S.mode = M_ERASE;
      return;
    case M_ERASE: {
      const e = st[S.depth - 1];
      if (e.nw > 0) {
        const c = e.wrote[--e.nw];
        S.evCh = S.cell[c];
        S.evCell = c;
        S.cell[c] = 0;
        S.ev = EV_ERASE;
        return;
      }
      if (e.word >= 0) {
        S.used[e.word] = 0;
        e.word = -1;
      }
      S.mode = M_NEXT;
      return;
    }
    case M_UNDO:
      if (S.depth === 0) {
        S.mode = M_FAIL;
        return;
      }
      S.nundo++;
      S.placed[st[S.depth - 1].slot] = 0;
      S.mode = M_ERASE;
      return;
  }
}

// ---------------------------------------------------------------------------
// The picture. Each square is 7 by 7 LEDs with a dark line between, so 8 by 16
// squares fill the 64 by 128 panel. A white square is a dim tile, brighter
// once it holds a letter; a black square is left dark.
// ---------------------------------------------------------------------------
const T_START = 0.4, HOLD = 3, WIPE = 0.9; // seconds: the first move, the full grid held, the grid wiped

export function setup(params) {
  const ents = [];
  for (let i = 0; i < MAXS; i++) ents.push({ slot: 0, ci: 0, nc: 0, word: -1, pos: 0, nw: 0, cand: new Int16Array(200), wrote: new Uint8Array(8) });
  params.s = {
    hue: 0, speed: 2, order: 1, tier: 1, sig: -1, cycle: 0, time: 0, acc: 0, tDone: -1,
    blk: new Uint8Array(NC), cellSlot: new Int8Array(NC * 2), sdir: new Uint8Array(MAXS), slen: new Uint8Array(MAXS), scell: new Uint8Array(MAXS * 8), ns: 0,
    cell: new Uint8Array(NC), used: new Uint8Array(NW), placed: new Uint8Array(MAXS), ords: [], stack: ents, depth: 0,
    mode: 0, steps: 0, nconf: 0, nundo: 0, pause: 0, solved: false, ev: 0, evCell: 0, evCh: 0, evSlot: 0,
    born: new Float32Array(NC), redT: new Float32Array(NC), redA: new Float32Array(NC), ghT: new Float32Array(NC), ghCh: new Uint8Array(NC), doneT: new Float32Array(MAXS),
    buf: new Float32Array(W * H * 3),
  };
  for (let L = 0; L <= 8; L++) params.s.ords.push(new Int16Array(BYLEN[L].length));
}

// A new grid: the template and the seed come from the cycle number alone.
function start(S) {
  const c = S.cycle, nt = TEMPLATES[S.tier].length, ti = c % nt, ks = SEEDS[S.tier][ti][S.order - 1];
  build(S, TEMPLATES[S.tier][ti].split("|"));
  solverInit(S, ks[floor(c / nt) % ks.length], S.order);
  S.time = 0;
  S.acc = 0;
  S.tDone = -1;
  S.born.fill(-9);
  S.redT.fill(-9);
  S.ghT.fill(-9);
  S.doneT.fill(-9);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 1, 6);
  const order = cl(round(k[2]), 1, 3), tier = cl(round(k[3]), -1, 2) + 1, sig = tier * 10 + order;
  if (sig !== S.sig) {
    S.sig = sig;
    S.order = order;
    S.tier = tier;
    start(S);
  }
  S.time += d;
  if (S.tDone < 0) {
    if (S.time > T_START) {
      S.acc += d * 24 * S.speed;
      let n = min(12, floor(S.acc));
      S.acc -= floor(S.acc);
      while (n-- > 0 && !S.solved && S.mode !== M_FAIL) {
        solverStep(S);
        const ev = S.ev, t = S.time;
        if (ev & EV_WRITE) S.born[S.evCell] = t;
        if (ev & EV_TOUCH) S.born[S.evCell] = max(S.born[S.evCell], t - 0.1);
        if (ev & EV_CONFLICT) {
          S.redT[S.evCell] = t;
          S.redA[S.evCell] = 1;
        }
        if (ev & EV_DEAD) {
          for (let i = 0; i < S.slen[S.evSlot]; i++) {
            const c = S.scell[S.evSlot * 8 + i];
            S.redT[c] = t;
            S.redA[c] = 0.55;
          }
        }
        if (ev & EV_ERASE) {
          S.ghT[S.evCell] = t;
          S.ghCh[S.evCell] = S.evCh;
          S.born[S.evCell] = -9;
        }
        if (ev & EV_PLACED) S.doneT[S.evSlot] = t;
      }
      if (S.solved || S.mode === M_FAIL || S.steps > 4000) S.tDone = S.time;
    }
  } else if (S.time > S.tDone + HOLD + WIPE) {
    S.cycle++;
    start(S);
  }
}

// A dim orange or yellow reads as brown on the panel, so a hue that would land
// in them for a tile goes to crimson or to green.
function dim(h) {
  h -= floor(h);
  return h < 0.04 || h > 0.2 ? h : h < 0.12 ? 0.95 + h * 0.3 : 0.33;
}

const C1 = [0, 0, 0], C2 = [0, 0, 0], C3 = [0, 0, 0], C4 = [0, 0, 0];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, t = S.time, base = S.hue + 0.58, cell = S.cell, tb = dim(base), ta = dim(base + 0.12);
  buf.fill(0);
  const put = (x, y, c, a) => {
    const o = (y * W + x) * 3;
    buf[o] = c[0] * a;
    buf[o + 1] = c[1] * a;
    buf[o + 2] = c[2] * a;
  };
  // the slot being worked on, the one on top of the search's stack
  const md = S.mode, live = S.tDone < 0 && S.depth > 0 && (md === M_NEXT || md === M_WRITE || md === M_CONFLICT || md === M_ERASE || md === M_DEAD) ? S.stack[S.depth - 1].slot : -1;
  for (let r = 0; r < CH; r++)
    for (let cc = 0; cc < CW; cc++) {
      const i = r * CW + cc;
      if (S.blk[i]) continue;
      const x0 = cc * 8, y0 = r * 8;
      // the grid sweeps in from the top, and wipes out the same way
      let g = sm((t - y0 * 0.0035) / 0.25);
      if (S.tDone >= 0) g *= 1 - sm((t - S.tDone - HOLD - y0 * 0.0045) / 0.3);
      if (g <= 0.003) continue;
      const ch = cell[i];
      const sa = S.cellSlot[i * 2], sb = S.cellSlot[i * 2 + 1];
      let inLive = 0;
      if (live >= 0 && (sa === live || sb === live)) inLive = 1;
      // the tile
      hsv(tb, 0.85, 0.17, C1);
      let lv = 0;
      if (ch) lv = sm((t - S.born[i]) / 0.12);
      else if (S.ghT[i] > -1 && t - S.ghT[i] < 0.4) lv = 1 - (t - S.ghT[i]) / 0.4;
      if (lv > 0) {
        hsv(tb, 0.75, 0.4, C2);
        for (let q = 0; q < 3; q++) C1[q] += (C2[q] - C1[q]) * lv;
      }
      if (inLive) {
        hsv(ta, 0.8, 0.46, C2);
        for (let q = 0; q < 3; q++) C1[q] += (C2[q] - C1[q]) * 0.7;
      }
      // a finished word flashes once, from its first letter to its last
      let wf = 0;
      for (let d = 0; d < 2; d++) {
        const s = S.cellSlot[i * 2 + d];
        if (s < 0 || S.doneT[s] < -1) continue;
        const k = d === 0 ? i - S.scell[s * 8] : floor((i - S.scell[s * 8]) / CW);
        wf = max(wf, exp(-max(0, t - S.doneT[s] - k * 0.05) / 0.22) * (t >= S.doneT[s] + k * 0.05 ? 1 : 0));
      }
      // when the grid is full a diagonal wave of light crosses it once
      if (S.tDone >= 0) {
        const wv = (t - S.tDone - (r + cc) * 0.05) / 0.35;
        if (wv > 0) wf = max(wf, exp(-wv));
      }
      for (let q = 0; q < 3; q++) C1[q] += (1 - C1[q]) * 0.55 * wf;
      // a square the search ran into a wall at, in red
      const ra = S.redA[i], rg = t - S.redT[i] < 0.55 ? ra * (1 - sm((t - S.redT[i] - 0.12) / 0.43)) : 0;
      if (rg > 0) {
        hsv(base + 0.42, 1, 0.95, C2);
        for (let q = 0; q < 3; q++) C1[q] += (C2[q] - C1[q]) * rg;
      }
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) put(x0 + x, y0 + y, C1, g);
      // the letter, white as it lands and settling to a pale tint, or the ghost of one taken out
      let code = ch, la = 1;
      if (ch) {
        const age = t - S.born[i];
        hsv(base, 0.12, 1, C3);
        for (let q = 0; q < 3; q++) C3[q] = 0.8 * C3[q] + 0.2 * (age < 0.3 ? 1 : 0);
        if (rg > 0) {
          hsv(base + 0.42, 0.5, 1, C4);
          for (let q = 0; q < 3; q++) C3[q] += (C4[q] - C3[q]) * rg;
        }
        la = 0.9 + 0.1 * wf;
      } else if (S.ghT[i] > -1 && t - S.ghT[i] < 0.5) {
        code = S.ghCh[i];
        const f = 1 - (t - S.ghT[i]) / 0.5;
        hsv(base + 0.42, 0.6, 1, C3);
        la = f * f * 0.8;
      } else code = 0;
      if (code) {
        const gl = GLYPH[code];
        for (let p = 0; p < 15; p++) if (gl[p]) put(x0 + 2 + (p % 3), y0 + 1 + floor(p / 3), C3, la * g);
      }
    }
  // a red tick along the bottom edge for every wall the search has met
  const bt = min(64, S.nconf + S.nundo);
  hsv(base + 0.42, 1, 0.7, C1);
  for (let x = 0; x < bt; x++) put(x, 127, C1, 1);

  for (let p = 0; p < W * H; p++) {
    const o = p * 3;
    display.setPixel(p & 63, p >> 6, min(255, buf[o] * 255), min(255, buf[o + 1] * 255), min(255, buf[o + 2] * 255));
  }
}
