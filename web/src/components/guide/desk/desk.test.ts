import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAKE_SCENES } from "../scenes";
import { DESK_QUERY } from "./query";
import { DESK_APPS } from "./apps";
import { TUTORIALS, deskLayout, layoutOf } from "./script";
import type { Beat, BeatCtx } from "./types";

/** A beat's hooks, asked before any window is up. */
const NOWHERE: BeatCtx = { lang: "en", el: null, doc: () => null, root: () => null, app: () => null, since: 0, memo: new Map() };

// The make page's desk: every tutorial lines up with its chapter's script,
// and every beat points into a window that is on the desk at that step.

describe("desk script", () => {
  it("has a tutorial no longer than its chapter, for chapters that exist", () => {
    for (const [scene, tutorial] of Object.entries(TUTORIALS)) {
      const def = MAKE_SCENES.find((s) => s.id === scene);
      expect(def, `tutorials: ${scene} is not a scene of the make page`).toBeDefined();
      expect(tutorial.length, `tutorials/${scene}.ts has more entries than scenes/${scene}.ts has steps`).toBeLessThanOrEqual(def!.steps.length);
    }
  });

  it("points every beat into a window on the desk at that step", () => {
    for (const [scene, tutorial] of Object.entries(TUTORIALS)) {
      const def = MAKE_SCENES.find((s) => s.id === scene)!;
      tutorial.forEach((beats: Beat[] | undefined, i) => {
        const { shown } = layoutOf(def.steps[i].desk);
        for (const [n, beat] of (beats ?? []).entries()) {
          expect(shown.has(beat.win), `${scene} step ${i} beat ${n}: window "${beat.win}" is not in that step's desk.show`).toBe(true);
          // A hint that follows the reader is asked with nothing on the desk: its words for the usual place.
          const say = typeof beat.say === "function" ? beat.say(NOWHERE) : beat.say;
          if (say) expect(Object.keys(say).sort()).toEqual(["en", "ko"]);
          if (beat.do === "drag") expect(beat.to, `${scene} step ${i} beat ${n}: a drag needs \`to\``).toBeDefined();
        }
      });
    }
  });

  it("fills in a placement's defaults", () => {
    expect([...layoutOf({ front: "lab" }).shown]).toEqual(["lab"]);
    expect(layoutOf({ front: "ai" })).toMatchObject({ front: "ai", top: "lab" });
    expect([...layoutOf({ front: "ai" }).shown].sort()).toEqual(["ai", "lab"]);
    expect(layoutOf({ front: "ai", show: ["community", "ai"] }).top).toBe("community");
    expect(layoutOf({ front: "community", show: ["lab"] }).shown.has("community")).toBe(true);
  });

  it("lets the reader bring a window on the desk forward, and nothing else", () => {
    const five = MAKE_SCENES.find((s) => s.id === "community")!.steps.length - 1;
    expect(deskLayout("community", five, "lab")).toMatchObject({ front: "lab", top: "lab" });
    expect(deskLayout("community", 0, "lab")).toMatchObject({ front: "community" });
    expect(deskLayout("opening", 0, "lab")).toMatchObject({ rest: false, top: "lab" });
  });

  it("names every practice window on both languages", () => {
    for (const app of Object.values(DESK_APPS)) {
      expect(Object.keys(app.chrome.title).sort()).toEqual(["en", "ko"]);
      if (app.chrome.badge) expect(Object.keys(app.chrome.badge).sort()).toEqual(["en", "ko"]);
    }
  });

  it("writes the desk's query out the same in the CSS (query.ts), and its opposite covers the rest", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const guide = readFileSync(path.join(here, "../Guide.module.css"), "utf8");
    const desk = readFileSync(path.join(here, "Desk.module.css"), "utf8");
    expect(guide).toContain(`@media ${DESK_QUERY} {`);
    expect(desk).toContain(`@media ${DESK_QUERY} {`);
    // The opposite, tier by tier: every (min-width A) and (min-height B) of the query has its (max-width < A) and (max-height < B).
    const tiers = [...DESK_QUERY.matchAll(/\(min-width: (\d+)px\) and \(min-height: (\d+)px\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(tiers.length).toBeGreaterThan(0);
    const opposite = guide.match(/@media (\(max-width: [\d.]+px\), \(max-height[^{]+)\{/)?.[1] ?? "";
    const minW = Math.min(...tiers.map((t) => t[0]));
    const minH = Math.min(...tiers.map((t) => t[1]));
    expect(opposite).toContain(`(max-width: ${minW - 0.02}px)`);
    expect(opposite).toContain(`(max-height: ${minH - 0.02}px)`);
    const sorted = [...tiers].sort((a, b) => b[0] - a[0]);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(opposite).toContain(`(max-width: ${sorted[i][0] - 0.02}px) and (max-height: ${sorted[i + 1][1] - 0.02}px)`);
    }
  });
});
