// The deck when the browser will not keep it. With site data blocked, merely
// reading `window.localStorage` throws a SecurityError, and the dock that
// draws the deck sits on every community page: a throw here took the whole
// page down to "Application error". A private mode that refuses writes is
// the milder case. Either way the deck should still work for the visit.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectedPattern } from "./deck";

const item = (n: number): CollectedPattern => ({
  patternId: `p${n}`,
  title: `Pattern ${n}`,
  code: "#pragma once",
});

// deck.ts keeps what storage refused in module state, so each test starts
// from a fresh copy of the module.
async function freshDeck() {
  vi.resetModules();
  return import("./deck");
}

function blockSiteData() {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  });
}

beforeEach(() => localStorage.clear());

describe("deck with site data blocked", () => {
  it("reads as empty instead of throwing", async () => {
    blockSiteData();
    const deck = await freshDeck();
    expect(deck.deckItems()).toEqual([]);
    expect(deck.deckHas("p1")).toBe(false);
  });

  it("keeps what was collected for the rest of the visit", async () => {
    blockSiteData();
    const deck = await freshDeck();
    const heard = vi.fn();
    window.addEventListener(deck.COLLECTION_EVENT, heard);

    expect(deck.deckAdd(item(1))).toEqual({ ok: true });
    deck.deckAdd(item(2));
    deck.deckAdd(item(3));
    expect(deck.deckHas("p2")).toBe(true);

    deck.deckMove("p3", -1);
    deck.deckReorder(0, 2);
    expect(deck.deckItems().map((i) => i.patternId)).toEqual(["p3", "p2", "p1"]);

    deck.deckRemove("p2");
    expect(deck.deckItems().map((i) => i.patternId)).toEqual(["p3", "p1"]);
    expect(heard).toHaveBeenCalledTimes(6);
    window.removeEventListener(deck.COLLECTION_EVENT, heard);
  });

  it("still stops at the cap", async () => {
    blockSiteData();
    const deck = await freshDeck();
    for (let n = 1; n <= deck.DECK_MAX; n += 1) deck.deckAdd(item(n));
    expect(deck.deckAdd(item(99)).ok).toBe(false);
    expect(deck.deckItems()).toHaveLength(deck.DECK_MAX);
  });
});

describe("deck when storage refuses writes", () => {
  it("shows the deck the person just changed, not the stale stored one", async () => {
    localStorage.setItem("pf-deck", JSON.stringify([item(1)]));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    const deck = await freshDeck();

    deck.deckAdd(item(2));
    expect(deck.deckItems().map((i) => i.patternId)).toEqual(["p1", "p2"]);
    deck.deckClear();
    expect(deck.deckItems()).toEqual([]);
  });
});

describe("deck with storage working", () => {
  it("writes through, so another tab or the next visit sees it", async () => {
    const deck = await freshDeck();
    deck.deckAdd(item(1));
    expect(JSON.parse(localStorage.getItem("pf-deck") ?? "[]")).toEqual([item(1)]);

    const nextVisit = await freshDeck();
    expect(nextVisit.deckItems()).toEqual([item(1)]);
  });
});
