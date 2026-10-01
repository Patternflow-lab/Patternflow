import { create } from "zustand";
import { knobSetupFromCode } from "@/lib/community/knobs";
import type { PracticePage } from "./handle";
import { DECK_MAX, deckById, patternById } from "./data";
import type { NoteKey } from "./words";

// The practice community's state: all of it local, none of it saved. The real
// community keeps the deck in localStorage and everything else on its server;
// the practice keeps it all here, for the visit, and forgets it on reload.
// Module-level, so it survives the desk being taken down and put back up
// (a window resized below the desk and back).

export type Sort = "new" | "old" | "top" | "forks" | "decks";

export type Note = { key: NoteKey; n: number; seq: number };

type State = {
  page: PracticePage;
  /** Bumped on every navigation: the page scrolls back to its top. */
  visit: number;
  hw: boolean;
  sort: Sort;
  q: string;
  deck: string[];
  knobs: Record<string, number[]>;
  liked: Record<string, boolean>;
  /** The one-pattern send dialog (SendModuleModal). */
  send: { id: string; sent: boolean } | null;
  build: "idle" | "running" | "done";
  /** How many patterns the finished pretend build holds. */
  builtN: number;
  note: Note | null;
  /** A demo is playing this card as if the mouse were on it; `turn` is its knob's travel. */
  demo: { id: string; turning: boolean } | null;
  /** The deck page's note after Copy into my deck (the real page's own words). */
  copied: string | null;

  go: (page: PracticePage) => void;
  setHw: (on: boolean) => void;
  setSort: (sort: Sort) => void;
  setQ: (q: string) => void;
  /** Into the deck: false (with nothing changed) if it has no .h, is in already, or the deck is full. */
  add: (id: string) => boolean;
  remove: (id: string) => void;
  reorder: (from: number, to: number) => void;
  clear: () => void;
  knobsOf: (id: string) => number[];
  setKnobs: (id: string, values: number[]) => void;
  toggleLike: (id: string) => void;
  openSend: (id: string) => void;
  sent: () => void;
  closeSend: () => void;
  startBuild: () => void;
  clearBuild: () => void;
  say: (key: NoteKey, n?: number) => void;
  unsay: () => void;
  setDemo: (demo: State["demo"]) => void;
  copyDeck: (deckId: string) => void;
};

let buildTimer = 0;
let noteSeq = 0;

export const usePractice = create<State>((set, get) => ({
  page: { kind: "wall" },
  visit: 0,
  hw: false,
  sort: "new",
  q: "",
  deck: [],
  knobs: {},
  liked: {},
  send: null,
  build: "idle",
  builtN: 0,
  note: null,
  demo: null,
  copied: null,

  go: (page) =>
    set((s) => ({
      page,
      visit: s.visit + 1,
      send: null,
      note: null,
      copied: null,
    })),
  setHw: (hw) => set({ hw }),
  setSort: (sort) => set({ sort }),
  setQ: (q) => set({ q }),
  add: (id) => {
    const p = patternById(id);
    const { deck } = get();
    if (!p?.hasCpp || deck.includes(id) || deck.length >= DECK_MAX) return false;
    set({ deck: [...deck, id] });
    return true;
  },
  remove: (id) => set((s) => ({ deck: s.deck.filter((x) => x !== id) })),
  reorder: (from, to) =>
    set((s) => {
      if (from === to || from < 0 || to < 0 || from >= s.deck.length || to >= s.deck.length) return {};
      const next = s.deck.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { deck: next };
    }),
  clear: () => set({ deck: [] }),
  knobsOf: (id) => {
    const have = get().knobs[id];
    if (have) return have;
    const p = patternById(id);
    return p ? knobSetupFromCode(p.code).values : [0.5, 0.5, 0.5, 0.5];
  },
  setKnobs: (id, values) => set((s) => ({ knobs: { ...s.knobs, [id]: values } })),
  toggleLike: (id) => set((s) => ({ liked: { ...s.liked, [id]: !s.liked[id] } })),
  openSend: (id) => set({ send: { id, sent: false }, note: null }),
  sent: () => set((s) => (s.send ? { send: { ...s.send, sent: true } } : {})),
  closeSend: () => set({ send: null }),
  startBuild: () => {
    const n = get().deck.length;
    if (n === 0 || get().build === "running") return;
    window.clearTimeout(buildTimer);
    set({ build: "running", builtN: n });
    get().say("built");
    // About half a second a pattern on the real build server, plus the queue.
    buildTimer = window.setTimeout(() => set({ build: "done" }), 900 + 250 * n);
  },
  clearBuild: () => {
    window.clearTimeout(buildTimer);
    set({ build: "idle" });
  },
  say: (key, n = 0) => set({ note: { key, n, seq: ++noteSeq } }),
  unsay: () => set({ note: null }),
  setDemo: (demo) => set({ demo }),
  copyDeck: (deckId) => {
    const d = deckById(deckId);
    if (!d) return;
    const ids = d.patterns.filter((id) => patternById(id)?.hasCpp).slice(0, DECK_MAX);
    // The real page's own note (DeckDetailClient loadIntoWorkingDeck).
    set({
      deck: ids,
      build: "idle",
      copied: `Loaded ${ids.length} pattern${ids.length === 1 ? "" : "s"} into your deck.`,
    });
  },
}));
