import type { Beat, BeatCtx, Tutorial } from "../desk/types";
import { deskApp } from "../desk/deskStore";
import { COMMUNITY_SIGNAL, type CommunityHandle } from "../desk/community/handle";

// 05 Community — what the desk's pointer does on each step, by step index:
// entry N plays while step N of copy/community.ts is in the middle of the
// screen (scenes/community.ts says which windows that step puts on the
// desk). Every beat's `win` must be on the desk that step (desk.test.ts
// checks it).
//
// It all happens in the practice community (desk/community/), which holds
// placeholder patterns and is connected to nothing: a beat there may act out
// a demo before handing over (until: <ms> — the pointer really presses), and
// then waits for the reader (until: "reader"). What the reader has done is
// read off the practice community's handle (desk/community/handle.ts) and
// its signals, so a step the reader is already past is passed, not repeated.
//
// Targets are the practice community's data-pc names, set on the same
// controls the real community has; each `say` quotes the real UI's words.
//
// The reader may be quicker than the pointer, or wander off to another page
// of the practice mid-step: a beat that waits also reads the handle's state
// (done), and when its target has left the screen the step starts over from
// its first beat (desk/runner.ts), whose skipIfs pass what is done and lead
// the reader back.
//
// OWNED BY THE COMMUNITY CHAPTER.

const app = (ctx: BeatCtx) => ctx.app<CommunityHandle>("community");
const at = (ctx: BeatCtx) => app(ctx)?.page() ?? { kind: "wall" as const };
const deck = (ctx: BeatCtx) => app(ctx)?.deck() ?? [];

/** On the wall, nothing open over it. */
const onWall = (ctx: BeatCtx) => at(ctx).kind === "wall" && app(ctx)?.sending() === "closed";
/** On the page of a pattern that ships a .h. */
const onFlashable = (ctx: BeatCtx) => {
  const p = at(ctx);
  return p.kind === "pattern" && Boolean(app(ctx)?.hasCpp(p.id));
};

const C = "community" as const;

/** The pointer presses "Patterns" in the nav, unless the reader is on the wall already. */
function toWall(also?: (ctx: BeatCtx) => boolean): Beat {
  return {
    win: C,
    target: '[data-pc="nav-patterns"]',
    do: "press",
    until: 700,
    skipIf: (ctx) => onWall(ctx) || Boolean(also?.(ctx)),
    say: { en: "Patterns, in the nav", ko: "위쪽 Patterns로" },
  };
}

export const COMMUNITY_TUTORIAL: Tutorial = [
  // 0 — the wall: a card plays under the mouse, the wheel turns its knobs.
  [
    toWall(),
    {
      win: C,
      target: '[data-pc-screen="pattern-1"]',
      do: "point",
      until: 1500,
      at: [0.5, 0.62],
      run: (ctx) => app(ctx)?.demoPlay("pattern-1"),
      say: { en: "On a card, it plays", ko: "카드에 올리면 재생돼요" },
    },
    {
      win: C,
      target: '[data-pc-screen="pattern-1"]',
      do: "scroll",
      until: 900,
      at: [0.5, 0.62],
      say: { en: "The wheel turns a knob", ko: "휠을 굴리면 노브가 돌아요" },
    },
    {
      win: C,
      target: '[data-pc-screen="origin"]',
      do: "scroll",
      until: "reader",
      at: [0.3, 0.62],
      signal: COMMUNITY_SIGNAL.turned,
      say: { en: "Your turn: roll the wheel over a card", ko: "이제 직접: 카드 위에서 휠을 굴려요" },
    },
  ],

  // 1 — .h: what can go on a board, and Flashable now.
  [
    toWall(),
    {
      win: C,
      target: '[data-pc-card="origin"] [data-pc="hw"]',
      do: "point",
      until: 1800,
      at: [0.5, 0.5],
      say: { en: ".h: this one can go on a board", ko: ".h가 있으면 보드에 올라가요" },
    },
    {
      win: C,
      target: '[data-pc-screen="pattern-2"]',
      do: "point",
      until: 1800,
      at: [0.25, 0.08],
      skipIf: (ctx) => Boolean(app(ctx)?.flashableOnly()),
      say: { en: "No .h: it plays here, not there", ko: ".h가 없으면 여기서만 돌아요" },
    },
    {
      win: C,
      target: '[data-pc="filter"]',
      do: "press",
      until: "reader",
      skipIf: (ctx) => Boolean(app(ctx)?.flashableOnly()),
      say: { en: "Press Flashable now", ko: "Flashable now를 눌러요" },
    },
  ],

  // 2 — one pattern, over Wi-Fi.
  [
    toWall(onFlashable),
    {
      win: C,
      target: '[data-pc-title="pattern-1"]',
      do: "press",
      until: "reader",
      skipIf: onFlashable,
      done: onFlashable,
      say: { en: "Open Pattern 1", ko: "Pattern 1을 열어요" },
    },
    {
      win: C,
      target: '[data-pc="send"]',
      do: "press",
      until: "reader",
      skipIf: (ctx) => app(ctx)?.sending() !== "closed",
      done: (ctx) => app(ctx)?.sending() !== "closed",
      say: { en: "Press ↗ Send to my Patternflow", ko: "↗ Send to my Patternflow를 눌러요" },
    },
    {
      win: C,
      target: '[data-pc="wifi"]',
      do: "press",
      until: "reader",
      skipIf: (ctx) => app(ctx)?.sending() === "sent",
      done: (ctx) => app(ctx)?.sending() === "sent",
      say: { en: "Then Send over Wi-Fi", ko: "이어서 Send over Wi-Fi를 눌러요" },
    },
  ],

  // 3 — your deck: +, a drop on the bar, the order, ✕, Send to my board.
  [
    toWall(),
    {
      win: C,
      target: '[data-pc-plus="origin"]',
      do: "press",
      until: 900,
      skipIf: (ctx) => deck(ctx).includes("origin"),
      say: { en: "+ puts it in your deck", ko: "+를 누르면 덱에 들어가요" },
    },
    {
      win: C,
      target: '[data-pc-screen="pattern-3"]',
      do: "drag",
      to: '[data-pc="next"]',
      until: 600,
      skipIf: (ctx) => deck(ctx).includes("pattern-3"),
      run: (ctx) => app(ctx)?.demoAdd("pattern-3"),
      say: { en: "Or drag the card onto the bar", ko: "카드를 아래 덱 바에 끌어 놓아도 돼요" },
    },
    {
      win: C,
      // Its + on the wall — or, if the reader opened Pattern 1's page instead, the ▦ Add to deck there.
      target: (root) => {
        const p = deskApp<CommunityHandle>(C)?.page();
        if (p?.kind === "pattern" && p.id === "pattern-1") return root.querySelector('[data-pc="add-deck"]');
        return root.querySelector('[data-pc-plus="pattern-1"]');
      },
      do: "press",
      until: "reader",
      skipIf: (ctx) => deck(ctx).includes("pattern-1"),
      done: (ctx) => deck(ctx).includes("pattern-1"),
      signal: COMMUNITY_SIGNAL.added,
      say: { en: "Your turn: + on Pattern 1", ko: "이제 직접: Pattern 1의 +" },
    },
    {
      win: C,
      target: '[data-pc-slot="0"]',
      do: "drag",
      to: '[data-pc-slot="1"]',
      until: "reader",
      on: [],
      signal: COMMUNITY_SIGNAL.reordered,
      skipIf: (ctx) => deck(ctx).length < 2,
      say: { en: "Drag a slot to move it", ko: "칸을 끌어 자리를 바꿔요" },
    },
    {
      win: C,
      target: '[data-pc-last="1"]',
      do: "drag",
      to: '[data-pc="bin"]',
      until: "reader",
      on: [],
      signal: COMMUNITY_SIGNAL.removed,
      skipIf: (ctx) => deck(ctx).length < 2,
      say: { en: "Drop one on ✕ to take it out", ko: "✕ 위에 놓으면 빠져요" },
    },
    {
      win: C,
      target: '[data-pc="dock-send"]',
      do: "press",
      until: "reader",
      skipIf: (ctx) => app(ctx)?.built() !== "idle" || deck(ctx).length === 0,
      done: (ctx) => app(ctx)?.built() !== "idle",
      say: { en: "Press Send to my board", ko: "Send to my board를 눌러요" },
    },
    {
      win: C,
      target: '[data-pc="dock-wifi"]',
      do: "press",
      until: "reader",
      skipIf: (ctx) => app(ctx)?.built() === "idle",
      say: { en: "Then Send over Wi-Fi", ko: "이어서 Send over Wi-Fi를 눌러요" },
    },
  ],

  // 4 — someone else's deck: the Decks page, Install to my board.
  [
    {
      win: C,
      target: '[data-pc="nav-decks"]',
      do: "press",
      until: 800,
      skipIf: (ctx) => at(ctx).kind === "decks" || at(ctx).kind === "deck",
      say: { en: "Decks, in the nav", ko: "위쪽 Decks로" },
    },
    {
      win: C,
      target: '[data-pc="basics-install"]',
      do: "point",
      until: 2000,
      skipIf: (ctx) => at(ctx).kind !== "decks",
      say: { en: "Basics, from 03: Install to my board", ko: "03의 Basics: Install to my board" },
    },
    {
      win: C,
      target: '[data-pc-deck="deck-1"]',
      do: "press",
      until: "reader",
      skipIf: (ctx) => at(ctx).kind === "deck",
      done: (ctx) => at(ctx).kind === "deck",
      say: { en: "Open Deck 1", ko: "Deck 1을 열어요" },
    },
    {
      win: C,
      target: '[data-pc="deck-install"]',
      do: "press",
      until: "reader",
      say: { en: "Press Install to my board", ko: "Install to my board를 눌러요" },
    },
    {
      win: C,
      target: '[data-pc="deck-copy"]',
      do: "point",
      until: 1800,
      say: { en: "Copy into my deck: to your bar first", ko: "Copy into my deck: 먼저 아래 내 덱에" },
    },
  ],

  // 5 — make it yours: Open in Pattern Lab (06 is next; the Lab waits behind).
  [
    toWall((ctx) => at(ctx).kind === "pattern"),
    {
      win: C,
      target: '[data-pc-title="origin"]',
      do: "press",
      until: "reader",
      skipIf: (ctx) => at(ctx).kind === "pattern",
      done: (ctx) => at(ctx).kind === "pattern",
      say: { en: "Open any pattern", ko: "아무 패턴이나 열어요" },
    },
    {
      win: C,
      target: '[data-pc="open-lab"]',
      do: "press",
      until: "reader",
      say: { en: "Press Open in Pattern Lab", ko: "Open in Pattern Lab을 눌러요" },
    },
  ],
];
