import { beforeEach, describe, expect, it } from "vitest";
import { COMMUNITY_TUTORIAL } from "../../tutorials/community";
import { DECKS, PATTERNS } from "./data";
import { usePractice } from "./state";

// The practice community's rules, as the real community has them: only a
// pattern with a .h goes into a deck, a deck holds each pattern once, a
// shared deck copied in replaces yours — and every placeholder is really
// there for the tutorial to point at.

const fresh = usePractice.getState();

describe("practice community", () => {
  beforeEach(() => {
    usePractice.setState({ ...fresh, deck: [], page: { kind: "wall" }, send: null, note: null, build: "idle" });
  });

  it("holds Origin and Patterns 1–3, one without a .h, each alive through real preset code", () => {
    expect(PATTERNS.map((p) => p.title)).toEqual(["Origin", "Pattern 1", "Pattern 2", "Pattern 3"]);
    expect(PATTERNS.filter((p) => !p.hasCpp).map((p) => p.id)).toEqual(["pattern-2"]);
    for (const p of PATTERNS) expect(p.code).toMatch(/function\s+draw|draw\s*[(=:]/);
  });

  it("puts only a pattern with a .h in the deck, once", () => {
    const st = usePractice.getState();
    expect(st.add("pattern-2")).toBe(false);
    expect(st.add("origin")).toBe(true);
    expect(st.add("origin")).toBe(false);
    expect(usePractice.getState().deck).toEqual(["origin"]);
  });

  it("reorders and removes as the deck bar does", () => {
    const st = usePractice.getState();
    st.add("origin");
    st.add("pattern-1");
    st.add("pattern-3");
    st.reorder(0, 2);
    expect(usePractice.getState().deck).toEqual(["pattern-1", "pattern-3", "origin"]);
    st.remove("pattern-3");
    expect(usePractice.getState().deck).toEqual(["pattern-1", "origin"]);
  });

  it("copies a shared deck in, in its order, replacing the working one", () => {
    const st = usePractice.getState();
    st.add("pattern-1");
    st.copyDeck("deck-1");
    expect(usePractice.getState().deck).toEqual(DECKS[0].patterns);
    expect(usePractice.getState().copied).toBe(`Loaded ${DECKS[0].patterns.length} patterns into your deck.`);
  });

  it("points the tutorial only at placeholders that exist", () => {
    const ids = new Set(PATTERNS.map((p) => p.id));
    const decks = new Set(DECKS.map((d) => d.id));
    for (const beats of COMMUNITY_TUTORIAL)
      for (const beat of beats ?? []) {
        for (const t of [beat.target, beat.to]) {
          if (typeof t !== "string") continue;
          for (const m of t.matchAll(/data-pc-(?:card|screen|title|plus)="([^"]+)"/g)) expect(ids.has(m[1]), t).toBe(true);
          for (const m of t.matchAll(/data-pc-deck="([^"]+)"/g)) expect(decks.has(m[1]), t).toBe(true);
        }
      }
  });
});
