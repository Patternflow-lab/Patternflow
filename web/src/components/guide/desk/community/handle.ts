// What the practice community (Make · 01) tells the chapter's tutorial
// (tutorials/community.ts): where the reader is in it, and a couple of demo
// hooks the pointer may use there. Types and names only — the tutorial is
// part of the guide's main bundle, and this file must not pull the practice
// community (its presets, its runtime) in with it.
//
// The app registers its handle with registerDeskApp("community", …) and a
// beat reads it through ctx.app<CommunityHandle>("community"). It raises the
// signals below with deskSignal when the READER does something (a demo's
// hooks never raise them).

/** A page of the practice community. */
export type PracticePage =
  | { kind: "wall" }
  | { kind: "pattern"; id: string }
  | { kind: "decks" }
  | { kind: "deck"; id: string };

export type CommunityHandle = {
  page: () => PracticePage;
  /** The pattern ships a .h (can go on a board, into a deck). */
  hasCpp: (id: string) => boolean;
  /** "Flashable now" is on. */
  flashableOnly: () => boolean;
  /** Pattern ids in the deck, in running order. */
  deck: () => string[];
  /** The one-pattern send dialog: closed, open, or Send over Wi-Fi pressed. */
  sending: () => "closed" | "open" | "sent";
  /** The deck bar's Send to my board: not pressed, building, built. */
  built: () => "idle" | "running" | "done";
  /**
   * Demo: play a card as if the mouse were on its screen, and after a moment
   * turn its first knob a little, as the wheel would. Returns the undo.
   */
  demoPlay: (id: string) => () => void;
  /** Demo: put a pattern in the deck, as dropping its card on the bar would. */
  demoAdd: (id: string) => void;
};

/** deskSignal names the practice community raises when the reader does something. */
export const COMMUNITY_SIGNAL = {
  /** Rolled the wheel over a card's screen (a knob turned). */
  turned: "community:turned",
  /** A pattern went into the deck (its + or a drop on the bar). */
  added: "community:added",
  /** A slot of the deck moved. */
  reordered: "community:reordered",
  /** A slot was dropped on ✕. */
  removed: "community:removed",
} as const;
