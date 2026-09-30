import type { DemoAction, SceneDef } from "../scenes";

// 05 Community — the script for the chapter on the second page (/guide/make).
// Step N here is on stage while step N of copy/community.ts is in the
// middle of the screen; the two lists must be the same length (pages.test.ts
// checks it, and the page warns in development).
//
// The board all through is the one the first page left: powered, the Basics
// deck on it, running. What arrives from the community arrives over Wi-Fi —
// the stream Fx.tsx draws from behind the card into the board (the same one
// 03 uses for Basics) — on the two steps that put something on it.
//
// Import only TYPES from "../scenes": scenes.ts imports this file, so a value
// import from it here would be a cycle that runs before scenes.ts has set its
// constants. The demo below is written out here for the same reason.

// K1..K4 turning in turn, a few detents each way: on the wall the wheel over
// a card's screen turns its knobs, and these are the knobs it stands for.
const turnEach: DemoAction[] = [0, 1, 2, 3].flatMap((k, i) => {
  const t0 = i * 1100;
  return [
    { at: t0, turn: k, detents: 2 },
    { at: t0 + 150, turn: k, detents: 2 },
    { at: t0 + 300, turn: k, detents: 2 },
    { at: t0 + 550, turn: k, detents: -2 },
    { at: t0 + 700, turn: k, detents: -2 },
  ];
});

// The pattern list open, K4 stepping through it one pattern (three detents)
// at a time — where a deck ends up: in the list (in the deck's order when it
// arrives as a zip or a public deck's install; the dock's Send over Wi-Fi
// doesn't carry the order yet, copy/community.ts says so).
const browseList: DemoAction[] = [
  { at: 700, turn: 3, detents: 3 },
  { at: 1400, turn: 3, detents: 3 },
  { at: 2100, turn: 3, detents: 3 },
  { at: 2800, turn: 3, detents: 3 },
  { at: 3500, turn: 3, detents: 3 },
];

const board = { power: true, pack: "basics" } as const;

export const COMMUNITY_SCENE: SceneDef = {
  id: "community",
  steps: [
    // 0 — the wall: every card plays, and the wheel turns its knobs
    { ...board, view: "screenKnobs", mode: "run", demo: turnEach, period: 4800 },
    // 1 — .h: what the board itself runs, square on
    { ...board, view: "screen", mode: "run" },
    // 2 — one pattern, over Wi-Fi into the board
    { ...board, view: "front", mode: "run", stream: true },
    // 3 — your deck: a running order, which on the board is the K4 list
    { ...board, view: "screenKnobs", mode: "select", focus: 3, demo: browseList, period: 4200 },
    // 4 — someone else's deck, installed whole
    { ...board, view: "front", mode: "run", stream: true },
    // 5 — open it in the Lab (06 next)
    { ...board, view: "front", mode: "run" },
  ],
};
