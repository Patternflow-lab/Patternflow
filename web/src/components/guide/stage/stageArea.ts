// The part of the screen the stage may frame the device in, when something
// other than the step's card decides it.
//
// The camera rig (GuideCanvas) normally measures the free area from the card
// on screen: left of it on a wide screen, above it on a narrow one. A window
// lifted over the page (LabWindow: Pattern Lab beside the device) covers far
// more than the card, so while it is open it says here what it leaves free,
// and the rig fits the device into that instead. CSS px of the viewport.

export type StageArea = { l: number; r: number; t: number; b: number };

let area: StageArea | null = null;

/** Set (or, with null, give back) the area the device must fit in. */
export function setStageArea(next: StageArea | null) {
  area = next;
}

/** The override, if a window has set one. */
export function stageArea(): StageArea | null {
  return area;
}
