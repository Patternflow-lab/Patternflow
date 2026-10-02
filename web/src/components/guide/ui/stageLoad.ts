// How far the 3D stage is from being on the page — between the stage's own
// chunk, which knows (ui/StageLoadReport, loaded with three.js), and the
// page's preloader, which shows it (ui/Preloader, in the page's bundle and so
// there from the first paint). Nothing here pulls three.js into the page.

export type StageLoad = {
  /** The stage's chunk has arrived and its canvas is mounting. */
  staged: boolean;
  /** The models: 0..1 of what the loader has been asked for. */
  frac: number;
  /** The device has been drawn and the frames run smooth: the stage can be shown. */
  ready: boolean;
  /** There will be no stage: this browser cannot draw it (no WebGL). */
  failed: boolean;
};

const state: StageLoad = { staged: false, frac: 0, ready: false, failed: false };
const subs = new Set<() => void>();

export const stageLoad = {
  get: (): Readonly<StageLoad> => state,
  set(patch: Partial<StageLoad>) {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof StageLoad)[]) {
      if (state[key] !== patch[key]) {
        (state[key] as StageLoad[typeof key]) = patch[key] as StageLoad[typeof key];
        changed = true;
      }
    }
    if (changed) subs.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
};
