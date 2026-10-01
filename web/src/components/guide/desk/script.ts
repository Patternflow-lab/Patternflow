import { deskStepOf } from "../scenes";
import { COMMUNITY_TUTORIAL } from "../tutorials/community";
import { LAB_TUTORIAL } from "../tutorials/lab";
import type { Beat, BigWin, DeskPlacement, DeskWin, Tutorial } from "./types";

// Where the desk's script is read: which windows a step of the make page puts
// on the desk (its scene step's `desk`), and what the pointer does there (the
// chapter's tutorial). Pure — the page, the desk and the tests all use it.

/** The chapters' tutorials, by scene id. */
export const TUTORIALS: Record<string, Tutorial> = {
  community: COMMUNITY_TUTORIAL,
  lab: LAB_TUTORIAL,
};

const NONE: Beat[] = [];

/** The pointer's beats for a step (empty: no pointer). */
export function beatsFor(scene: string, step: number): Beat[] {
  return TUTORIALS[scene]?.[step] ?? NONE;
}

/** A placement with its defaults filled in: which windows are on the desk, and which big one is on top. */
export type Layout = {
  front: DeskWin;
  /** The big window on top of the other (the front one, or — when the AI is in front — the one under it). */
  top: BigWin;
  shown: Set<DeskWin>;
  ai: "br" | "bl";
  /** The AI window's height as a share of the desk's. */
  aiHeight: number;
  rest: boolean;
};

export function layoutOf(p: DeskPlacement): Layout {
  const shown = new Set<DeskWin>(p.show ?? [p.front]);
  shown.add(p.front);
  // The AI window sits over a big one: the Lab, unless the step shows only the community.
  if (p.front === "ai" && !shown.has("lab") && !shown.has("community")) shown.add("lab");
  const top: BigWin = p.front !== "ai" ? p.front : shown.has("lab") ? "lab" : "community";
  return { front: p.front, top, shown, ai: p.ai ?? "br", aiHeight: p.aiHeight ?? 0.64, rest: Boolean(p.rest) };
}

/** A step's layout, the reader's own choice of window in front applied. */
export function deskLayout(scene: string, step: number, raised: DeskWin | null): Layout {
  const l = layoutOf(deskStepOf(scene, step).desk);
  if (!raised || !l.shown.has(raised)) return l;
  return {
    ...l,
    front: raised,
    top: raised === "ai" ? l.top : raised,
    // A window the reader brought forward is being used: it's not at rest.
    rest: false,
  };
}
