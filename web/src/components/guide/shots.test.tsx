import { act, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommunityShots from "./CommunityShots";
import FlasherShots, { type FlasherSet } from "./FlasherShots";
import LabShots from "./LabShots";
import type { GuideLang } from "./store";

// The screens in the Make guide's cards and the flasher's card are pictures
// of English UI. Their captions quote it in both languages, and so did the
// pictures' alt: a reader of /guide/make/ko heard "Paste" for the Code tab
// and "Preview" for three different previews. Each shot now says what it
// shows in the reader's language.

const HANGUL = /\p{Script=Hangul}/u;

beforeEach(() => {
  // Reduced motion: nothing steps on its own, the dots alone move the set.
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    matches: query === "(prefers-reduced-motion: reduce)",
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The alt of the picture on screen, for every screen the viewer holds, in order. */
function alts(ui: ReactElement): string[] {
  const { container, unmount } = render(ui);
  const dots = Array.from(container.querySelectorAll<HTMLButtonElement>("button[data-done]"));
  const seen: string[] = [];
  for (const dot of dots.length ? dots : [null]) {
    if (dot) act(() => dot.click());
    const on = container.querySelectorAll<HTMLImageElement>('img[data-on="1"]');
    expect(on).toHaveLength(1);
    seen.push(on[0].alt);
    // The others are hidden, and say nothing.
    for (const img of container.querySelectorAll<HTMLImageElement>('img[data-on="0"]')) {
      expect(img.alt).toBe("");
      expect(img.getAttribute("aria-hidden")).toBe("true");
    }
  }
  unmount();
  return seen;
}

const VIEWERS: [string, (lang: GuideLang) => ReactElement[]][] = [
  ["LabShots", (lang) => Array.from({ length: 10 }, (_, i) => <LabShots key={i} lang={lang} step={i + 1} />)],
  ["CommunityShots", (lang) => Array.from({ length: 6 }, (_, i) => <CommunityShots key={i} lang={lang} step={i} />)],
  [
    "FlasherShots",
    (lang) => (["install", "dashboard", "wifi"] as FlasherSet[]).map((set) => <FlasherShots key={set} set={set} lang={lang} />),
  ],
];

describe.each(VIEWERS)("%s", (_, viewers) => {
  it("says what each screen shows in the reader's language", () => {
    const en = viewers("en").map(alts);
    const ko = viewers("ko").map(alts);
    expect(ko.map((set) => set.length)).toEqual(en.map((set) => set.length));
    for (const [i, set] of en.entries()) {
      for (const [j, alt] of set.entries()) {
        expect(alt.length, `${i}/${j}`).toBeGreaterThan(20);
        expect(alt, alt).not.toMatch(HANGUL);
        expect(ko[i][j], ko[i][j]).toMatch(HANGUL);
      }
      // Two shots of one image ring different controls, and say so.
      expect(new Set(set).size, set.join(" | ")).toBe(set.length);
      expect(new Set(ko[i]).size, ko[i].join(" | ")).toBe(ko[i].length);
    }
  });
});
