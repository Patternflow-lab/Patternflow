import type { DeskStep, SceneDef } from "../scenes";

// 05 Community — the script for the chapter on the second page (/guide/make).
// Step N here is on the desk while step N of copy/community.ts is in the
// middle of the screen; the two lists must be the same length (pages.test.ts
// checks it, and the page warns in development).
//
// Each step says which app windows are on the desk (desk/types.ts
// DeskPlacement). The chapter happens in the practice community, a small
// replica of the site holding placeholder patterns (desk/community/): the
// reader does each step there, and what the pointer shows them is
// tutorials/community.ts, by the same index. The practice keeps its state
// from step to step, so the deck built in 3 is still there in 4.
//
// Import only TYPES from "../scenes": scenes.ts imports this file, so a value
// import from it here would be a cycle that runs before scenes.ts has set its
// constants.

const community: DeskStep = { desk: { front: "community" } };

export const COMMUNITY_SCENE: SceneDef<DeskStep> = {
  id: "community",
  steps: [
    // 0 — the wall: a card plays under the mouse, the wheel turns a knob
    community,
    // 1 — .h: which patterns can go on a board; Flashable now
    community,
    // 2 — one pattern: ↗ Send to my Patternflow → Send over Wi-Fi
    community,
    // 3 — your deck: +, a card dropped on the bar, the order, ✕, Send to my board
    community,
    // 4 — someone else's deck: the Decks page, Install to my board
    community,
    // 5 — Open in Pattern Lab (06 next): the reader's own Lab waits behind
    { desk: { front: "community", show: ["community", "lab"] } },
  ],
};
